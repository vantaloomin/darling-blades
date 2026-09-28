/**
 * Card-face geometry, parameterised by the art window's height (R13 mock,
 * docs/plan-1.9.md Lane C). Pure numbers: CardView places its objects from
 * it and CardFrameFactory bakes the matching frame from it, so the drawn
 * frame and the live layout can never drift apart.
 *
 * Coordinates are card-local (center origin, 300x420). The frame bake works
 * at 2x (600x840): `frameY = (localY + 210) * 2`.
 *
 * The art window grows DOWNWARD from a fixed top edge; the type band and the
 * text box move down with it by the same amount, and the text box keeps its
 * bottom edge (the badge row does not move).
 */

/** Today's art window height (with flavor). */
export const LEGACY_ART_H = 192;
/** The heights the owner is choosing between, plus today's. */
export const ART_H_OPTIONS = [192, 216, 228] as const;
export type ArtWindowHeight = (typeof ART_H_OPTIONS)[number];

/** Card-local source rows of a 640x800 image the window shows, as fractions. */
export interface ArtBand {
  top: number;
  bottom: number;
}

export interface CardFaceGeometry {
  artH: ArtWindowHeight;
  /** Whether this face renders flavor text (only the legacy 192 face does). */
  flavor: boolean;
  /** Art window, card-local. */
  art: { x: number; y: number; w: number; h: number };
  /** Type line centre, card-local. */
  typeY: number;
  /** Top of the rules text for a non-land card, card-local. */
  textTop: number;
  /** Bottom of the usable text area (above the badge row), card-local. */
  boxBottom: number;
  /** Frame-bake rects at 2x (600x840). */
  bake: {
    art: { x: number; y: number; w: number; h: number };
    typeBand: { x: number; y: number; w: number; h: number };
    textBox: { x: number; y: number; w: number; h: number };
  };
}

const ART_TOP = -164;
const ART_X = -132;
const ART_W = 264;
const TYPE_Y = 45;
const TEXT_TOP = 66;
const BOX_BOTTOM = 166;
const FRAME_BOTTOM_TEXT_BOX = 804; // text box bottom edge in the 2x bake

export function cardFaceGeometry(artH: ArtWindowHeight = LEGACY_ART_H): CardFaceGeometry {
  const grow = artH - LEGACY_ART_H;
  const bakeGrow = grow * 2;
  const textBoxTop = 544 + bakeGrow;
  return {
    artH,
    flavor: artH === LEGACY_ART_H,
    art: { x: ART_X, y: ART_TOP, w: ART_W, h: artH },
    typeY: TYPE_Y + grow,
    textTop: TEXT_TOP + grow,
    boxBottom: BOX_BOTTOM,
    bake: {
      art: { x: 36, y: 92, w: 528, h: artH * 2 },
      typeBand: { x: 32, y: 488 + bakeGrow, w: 536, h: 44 },
      textBox: { x: 32, y: textBoxTop, w: 536, h: FRAME_BOTTOM_TEXT_BOX - textBoxTop },
    },
  };
}

/**
 * The band of a 640x800 source the window shows. Mirrors CardView.applyArt's
 * cover crop: the width fills the window, so the visible height is
 * `artH / (ART_W / 640)` source rows, centred.
 */
export function artBand(artH: number, srcW = 640, srcH = 800): ArtBand {
  const scale = Math.max(ART_W / srcW, artH / srcH);
  const visible = artH / scale / srcH;
  return { top: (1 - visible) / 2, bottom: 1 - (1 - visible) / 2 };
}

/**
 * Prototype-only switch (proto/19-r13-mock): `?artH=216` or `?artH=228` on the
 * page URL picks the default face for every CardView. Anything else, or no
 * window, is today's 192 face.
 */
export function defaultArtWindowHeight(): ArtWindowHeight {
  if (typeof window === 'undefined') return LEGACY_ART_H;
  const raw = Number(new URLSearchParams(window.location.search).get('artH'));
  return (ART_H_OPTIONS as readonly number[]).includes(raw) ? (raw as ArtWindowHeight) : LEGACY_ART_H;
}

/** Texture-key suffix for a frame baked at this height ('' for today's). */
export function frameKeySuffix(artH: ArtWindowHeight): string {
  return artH === LEGACY_ART_H ? '' : `-a${artH}`;
}
