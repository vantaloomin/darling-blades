/**
 * Card-face geometry: one set of numbers that CardView lays its objects out
 * from and CardFrameFactory bakes the procedural frame from, so the drawn
 * frame and the live layout cannot drift apart.
 *
 * The card carries no flavor text (owner ruling R13, 2026-09-25, docs/plan-1.9.md
 * Lane C) and the room went to the art: the window is 264x216 (ruling D18,
 * 2026-09-28). The type band and the text box sit directly under the window,
 * the text box keeps its bottom edge, and the badge row does not move.
 *
 * Coordinates are card-local (centre origin, 300x420). The frame bake works
 * at 2x (600x840); `toBake` converts. Pure numbers: no Phaser, no DOM.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The card, card-local. */
export const CARD_FACE_W = 300;
export const CARD_FACE_H = 420;

/** The art window's size on the card (D18). */
export const ART_W = 264;
export const ART_H = 216;

/**
 * The frame face's inner edge (the 9 px inset inside the metal border), where
 * the badge row's outer corners sit.
 */
export const FRAME_INNER = { left: -141, right: 141, bottom: 201 } as const;
/** Height of the cost, set-symbol and P/T badges along the card's foot. */
export const BADGE_H = 31;
/** Top edge of the badge row. */
export const BADGE_TOP = FRAME_INNER.bottom - BADGE_H;

/** Gap between the art window, the type band and the text box. */
const PANEL_GAP = 6;
/** Rules text sits this far inside the text box's top edge. */
const TEXT_INSET = 4;
/** The type band's height. */
const TYPE_BAND_H = 22;
/** The type band and the text box are this wide, centred. */
const PANEL_W = 268;
/** The text box's bottom edge (the badge row overlaps its foot). */
const TEXT_BOX_BOTTOM = 192;

const art: Rect = { x: -ART_W / 2, y: -164, w: ART_W, h: ART_H };
const typeBand: Rect = { x: -PANEL_W / 2, y: art.y + art.h + PANEL_GAP, w: PANEL_W, h: TYPE_BAND_H };
const textBoxTop = typeBand.y + typeBand.h + PANEL_GAP;
const textBox: Rect = { x: -PANEL_W / 2, y: textBoxTop, w: PANEL_W, h: TEXT_BOX_BOTTOM - textBoxTop };
const textTop = textBox.y + TEXT_INSET;
/** Rules text stops this far above the badge row. */
const boxBottom = BADGE_TOP - TEXT_INSET;

/** Convert a card-local rect to the 2x frame bake's pixels. */
export function toBake(rect: Rect): Rect {
  return {
    x: (rect.x + CARD_FACE_W / 2) * 2,
    y: (rect.y + CARD_FACE_H / 2) * 2,
    w: rect.w * 2,
    h: rect.h * 2,
  };
}

export interface CardFaceLayout {
  /** The art window. */
  art: Rect;
  /** Type line centre. */
  typeY: number;
  /** Top of the rules text. */
  textTop: number;
  /** Bottom of the usable text area, above the badge row. */
  boxBottom: number;
  /** Land mana row centre: bare, or below a one-line land rule (taplands). */
  landRowY: { bare: number; belowRules: number };
}

/**
 * The standard face. A bare land's mana row sits 12 px below the rules box's
 * centre; below a tapland's rules line it sits 42 px under the text top (the
 * one line ends about 16 px down). Both are the offsets the face had before
 * R13, carried down with the box.
 */
export const CARD_FACE: CardFaceLayout & {
  typeBand: Rect;
  textBox: Rect;
  /** The same panels at 2x, for the frame bake. */
  bake: { art: Rect; typeBand: Rect; textBox: Rect };
} = {
  art,
  typeBand,
  textBox,
  typeY: typeBand.y + typeBand.h / 2,
  textTop,
  boxBottom,
  landRowY: { bare: (textTop + boxBottom) / 2 + 12, belowRules: textTop + 42 },
  bake: { art: toBake(art), typeBand: toBake(typeBand), textBox: toBake(textBox) },
};

/**
 * The full-art face: the art fills the frame interior (the 18 px 2x inset
 * leaves the metal border visible on every edge) and the text sits on plates
 * over it. R13 did not change it: its numbers are the ones it always had, and
 * its rules field fits text to the same 100 px it always did.
 */
export const FULL_ART_FACE: CardFaceLayout = {
  art: { x: FRAME_INNER.left, y: -FRAME_INNER.bottom, w: FRAME_INNER.right * 2, h: FRAME_INNER.bottom * 2 },
  typeY: 45,
  textTop: 66,
  boxBottom,
  landRowY: { bare: 128, belowRules: 108 },
};

/** Land mana-row sizes: one output, or two or more (`[T] -> [W] or [U]`). */
export const LAND_MANA_ROW = {
  mono: { pip: 48, gap: 10, arrowW: 24, orW: 26, arrowFont: 24, orFont: 20 },
  multi: { pip: 36, gap: 8, arrowW: 20, orW: 20, arrowFont: 20, orFont: 16 },
} as const;

/** The rows of an image the window shows, as fractions of the image height. */
export interface ArtBand {
  top: number;
  bottom: number;
}

/**
 * The band of a source image the standard window shows. Mirrors
 * CardView.applyArt's cover crop: for a 4:5 source the width fills the window,
 * so `ART_H / (ART_W / srcW)` source rows show, centred. For 640x800 at
 * 264x216 that is rows 17.3% to 82.7% (y 138 to 662).
 */
export function artBand(srcW = 640, srcH = 800, window: Rect = CARD_FACE.art): ArtBand {
  const scale = Math.max(window.w / srcW, window.h / srcH);
  const visible = window.h / scale / srcH;
  return { top: (1 - visible) / 2, bottom: 1 - (1 - visible) / 2 };
}
