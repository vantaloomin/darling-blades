import Phaser from 'phaser';

/**
 * Room for descenders in every Phaser Text, installed once before a Game is
 * built (owner report 2026-10-10: the bottoms of "y", "g" and "p" were cut
 * off in Settings).
 *
 * Phaser 3.90 sizes a Text's canvas from the font's measured ascent and
 * descent (canvas `actualBoundingBox*` of its test string). Where the browser
 * reports those as fractions (Windows and macOS do; Linux Chrome reports
 * whole pixels, which is why it never showed there) three small losses add
 * up at the bottom edge:
 * - `autoRound` snaps the baseline to the nearest pixel, so it can sit up to
 *   half a pixel lower than the ascent the canvas was sized for;
 * - the canvas height is ascent + descent exactly, with no slack for the
 *   antialiased edge of a descender;
 * - the backing canvas is height × resolution truncated to whole pixels, so
 *   at a fractional resolution (render size 1920×1080, the compact zoom) up
 *   to one canvas pixel more is dropped from the bottom.
 *
 * The guard rounds the measured ascent and descent up to whole pixels (the
 * baseline no longer moves when rounded, and the box holds the full
 * descender) and draws each Text with one extra pixel of bottom padding for
 * the antialiased edge and the truncation. Line pitch is unchanged wherever
 * the metrics were already whole pixels; the padding is applied only while
 * the canvas is drawn, so `text.padding` still reads what the caller set.
 */
export const TEXT_BOTTOM_ROOM = 1;

interface Metrics {
  ascent: number;
  descent: number;
  fontSize: number;
}

/** The measured metrics rounded up to whole pixels. */
export function wholePixelMetrics(m: Metrics): Metrics {
  const ascent = Math.ceil(m.ascent);
  const descent = Math.ceil(m.descent);
  return { ascent, descent, fontSize: ascent + descent };
}

let installed = false;

export function installTextRasterGuards(): void {
  if (installed) return;
  installed = true;

  const styleProto = Phaser.GameObjects.TextStyle.prototype as unknown as object;
  const store = new WeakMap<object, Metrics | undefined>();
  Object.defineProperty(styleProto, 'metrics', {
    configurable: true,
    get(this: object) {
      return store.get(this);
    },
    set(this: object, value: Metrics | undefined) {
      store.set(this, value ? wholePixelMetrics(value) : value);
    },
  });

  type TextLike = { padding: { bottom: number } };
  const textProto = Phaser.GameObjects.Text.prototype as unknown as { updateText: (this: TextLike) => unknown };
  const origUpdateText = textProto.updateText;
  textProto.updateText = function (this: TextLike) {
    const bottom = this.padding.bottom;
    this.padding.bottom = bottom + TEXT_BOTTOM_ROOM;
    try {
      return origUpdateText.call(this);
    } finally {
      this.padding.bottom = bottom;
    }
  };
}
