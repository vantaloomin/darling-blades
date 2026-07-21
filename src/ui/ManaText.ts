import type Phaser from 'phaser';

const NBSP = '\u00a0';
const TOKEN_GROUP = /(?:\{(?:\d+|[WUBRGC])\})+/g;
const TOKEN = /\{(\d+|[WUBRGC])\}/g;

export interface ManaTextPip {
  texture: string;
  number?: number;
}

export type ManaTextSegment =
  | { kind: 'text'; value: string }
  | { kind: 'pipRun'; value: string; pips: ManaTextPip[] };

export interface ManaTextPadding {
  padding: string;
  paddingWidth: number;
  pipWidth: number;
}

export interface PaddedManaText {
  text: string;
  runs: Array<ManaTextPadding & { pips: ManaTextPip[] }>;
}

export interface ManaTextRender {
  text: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Image[];
  numbers: Phaser.GameObjects.Text[];
  reflow: () => void;
  setAlpha: (alpha: number) => void;
  destroy: () => void;
}

/** Split rules copy into ordinary text and adjacent mana-token groups. */
export function segmentManaText(raw: string): ManaTextSegment[] {
  const segments: ManaTextSegment[] = [];
  let cursor = 0;

  for (const match of raw.matchAll(TOKEN_GROUP)) {
    const index = match.index;
    if (index > cursor) segments.push({ kind: 'text', value: raw.slice(cursor, index) });
    const value = match[0];
    const pips: ManaTextPip[] = [];
    for (const token of value.matchAll(TOKEN)) {
      const symbol = token[1];
      if (/^\d+$/.test(symbol)) {
        pips.push({ texture: 'pip-C', number: Number(symbol) });
      } else {
        pips.push({ texture: `pip-${symbol}` });
      }
    }
    segments.push({ kind: 'pipRun', value, pips });
    cursor = index + value.length;
  }

  if (cursor < raw.length) segments.push({ kind: 'text', value: raw.slice(cursor) });
  if (segments.length === 0) segments.push({ kind: 'text', value: raw });
  return segments;
}

/**
 * Reserve a non-breaking text run wide enough for a row of pips. Measuring the
 * whole candidate string (instead of multiplying one glyph) honors browser font
 * metrics and makes the pure math injectable in headless tests.
 */
export function manaPipPadding(
  pipCount: number,
  pipSize: number,
  pipGap: number,
  measure: (value: string) => number,
): ManaTextPadding {
  const pipWidth = pipCount > 0 ? pipCount * pipSize + (pipCount - 1) * pipGap : 0;
  if (pipWidth === 0) return { padding: '', paddingWidth: 0, pipWidth: 0 };

  let padding = NBSP;
  let paddingWidth = measure(padding);
  if (!Number.isFinite(paddingWidth) || paddingWidth <= 0) {
    throw new Error('ManaText requires a positive NBSP measurement');
  }
  while (paddingWidth < pipWidth) {
    padding += NBSP;
    paddingWidth = measure(padding);
  }
  return { padding, paddingWidth, pipWidth };
}

/** Replace each pip group with one unbreakable, measured padding run. */
export function padManaTextSegments(
  segments: readonly ManaTextSegment[],
  pipSize: number,
  pipGap: number,
  measure: (value: string) => number,
): PaddedManaText {
  let text = '';
  const runs: PaddedManaText['runs'] = [];
  for (const segment of segments) {
    if (segment.kind === 'text') {
      text += segment.value;
      continue;
    }
    const padding = manaPipPadding(segment.pips.length, pipSize, pipGap, measure);
    text += padding.padding;
    runs.push({ ...padding, pips: segment.pips });
  }
  return { text, runs };
}

/**
 * Render wrapped text with real mana images over measured NBSP placeholders.
 * The returned objects all live in `container` local space, so CardView dynamic
 * texture bakes retain the pips. Call `reflow()` after changing the Text's
 * position, origin, scale, alpha, or word-wrap width.
 */
export function renderManaText(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  raw: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): ManaTextRender {
  const text = scene.add.text(x, y, raw, style).setOrigin(0, 0);
  container.add(text);
  text.style.syncFont(text.canvas, text.context);

  const metrics = text.style.getTextMetrics();
  const pipSize = metrics.fontSize + text.style.strokeThickness;
  const pipGap = Math.max(1, pipSize * 0.12);
  const measure = (value: string): number => {
    if (text.letterSpacing === 0) return text.context.measureText(value).width;
    let width = 0;
    for (const char of value) width += text.context.measureText(char).width;
    return width + Math.max(0, value.length - 1) * text.letterSpacing;
  };
  const padded = padManaTextSegments(segmentManaText(raw), pipSize, pipGap, measure);
  text.setText(padded.text);

  const pips: Phaser.GameObjects.Image[] = [];
  const numbers: Phaser.GameObjects.Text[] = [];
  for (const run of padded.runs) {
    for (const spec of run.pips) {
      const pip = scene.add.image(0, 0, spec.texture).setVisible(false);
      container.add(pip);
      pips.push(pip);
      if (spec.number !== undefined) {
        const number = scene.add
          .text(0, 0, String(spec.number), {
            fontFamily: 'Cinzel, Georgia, serif',
            fontSize: `${Math.max(8, pipSize * 0.62)}px`,
            fontStyle: 'bold',
            color: '#2b2f36',
            resolution: style.resolution ?? 1,
          })
          .setOrigin(0.5)
          .setVisible(false);
        container.add(number);
        numbers.push(number);
      }
    }
  }

  const reflow = (): void => {
    for (const pip of pips) pip.setVisible(false);
    for (const number of numbers) number.setVisible(false);

    const lines = text.getWrappedText();
    const paddingLeft = text.padding.left ?? 0;
    const paddingRight = text.padding.right ?? 0;
    const paddingTop = text.padding.top ?? 0;
    const contentWidth = text.width - paddingLeft - paddingRight;
    const lineHeight = metrics.fontSize + text.style.strokeThickness;
    const lineStep = lineHeight + text.lineSpacing;
    const baseX = text.x - text.displayOriginX * text.scaleX;
    const baseY = text.y - text.displayOriginY * text.scaleY;
    let searchLine = 0;
    let searchColumn = 0;
    let pipIndex = 0;
    let numberIndex = 0;

    for (const run of padded.runs) {
      let lineIndex = -1;
      let column = -1;
      for (let i = searchLine; i < lines.length; i++) {
        const from = i === searchLine ? searchColumn : 0;
        const found = lines[i].indexOf(run.padding, from);
        if (found >= 0) {
          lineIndex = i;
          column = found;
          searchLine = i;
          searchColumn = found + run.padding.length;
          break;
        }
      }
      if (lineIndex < 0) {
        pipIndex += run.pips.length;
        numberIndex += run.pips.filter((pip) => pip.number !== undefined).length;
        continue;
      }

      const line = lines[lineIndex];
      const lineWidth = measure(line) + text.style.strokeThickness;
      const alignOffset =
        text.style.align === 'center'
          ? (contentWidth - lineWidth) / 2
          : text.style.align === 'right'
            ? contentWidth - lineWidth
            : 0;
      const prefixWidth = measure(line.slice(0, column));
      const runInset = (run.paddingWidth - run.pipWidth) / 2;
      const runX = paddingLeft + text.style.strokeThickness / 2 + alignOffset + prefixWidth + runInset;
      const centerY = paddingTop + lineIndex * lineStep + lineHeight / 2;

      run.pips.forEach((spec, index) => {
        const centerX = runX + index * (pipSize + pipGap) + pipSize / 2;
        const pip = pips[pipIndex++];
        pip
          .setPosition(baseX + centerX * text.scaleX, baseY + centerY * text.scaleY)
          .setDisplaySize(pipSize * Math.abs(text.scaleX), pipSize * Math.abs(text.scaleY))
          .setAlpha(text.alpha)
          .setVisible(text.visible);
        if (spec.number !== undefined) {
          numbers[numberIndex++]
            .setPosition(pip.x, pip.y - text.scaleY * 0.04 * pipSize)
            .setScale(text.scaleX, text.scaleY)
            .setAlpha(text.alpha)
            .setVisible(text.visible);
        }
      });
    }
  };

  const setAlpha = (alpha: number): void => {
    text.setAlpha(alpha);
    for (const pip of pips) pip.setAlpha(alpha);
    for (const number of numbers) number.setAlpha(alpha);
  };

  const destroy = (): void => {
    text.destroy();
    for (const pip of pips) pip.destroy();
    for (const number of numbers) number.destroy();
  };

  reflow();
  return { text, pips, numbers, reflow, setAlpha, destroy };
}
