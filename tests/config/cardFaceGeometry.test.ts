import { describe, expect, it } from 'vitest';
import {
  BADGE_TOP,
  CARD_FACE,
  CARD_FACE_H,
  CARD_FACE_W,
  FULL_ART_FACE,
  LAND_MANA_ROW,
  artBand,
  toBake,
  type Rect,
} from '../../src/config/cardFaceGeometry';

const bottom = (r: Rect): number => r.y + r.h;
const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && bottom(inner) <= bottom(outer);
const CARD: Rect = { x: -CARD_FACE_W / 2, y: -CARD_FACE_H / 2, w: CARD_FACE_W, h: CARD_FACE_H };

describe('card face geometry (R13: no flavor, the art window at 216)', () => {
  it('shows rows 17.3% to 82.7% of a 640x800 art file, the band the art bible composes for', () => {
    // Ruling D18 (docs/plan-1.9.md): the window is 264x216, which cover-crops
    // a 4:5 file to its middle 65.5%.
    const band = artBand(640, 800);
    expect(band.top).toBeCloseTo(0.173, 3);
    expect(band.bottom).toBeCloseTo(0.827, 3);
    expect(Math.round(band.top * 800)).toBe(138);
    expect(Math.round(band.bottom * 800)).toBe(662);
  });

  it('stacks the art window, the type band and the text box top to bottom without overlap', () => {
    expect(inside(CARD_FACE.art, CARD)).toBe(true);
    expect(CARD_FACE.typeBand.y).toBeGreaterThan(bottom(CARD_FACE.art));
    expect(CARD_FACE.textBox.y).toBeGreaterThan(bottom(CARD_FACE.typeBand));
    expect(inside(CARD_FACE.textBox, CARD)).toBe(true);
    // The type line sits on its band.
    expect(CARD_FACE.typeY).toBeGreaterThan(CARD_FACE.typeBand.y);
    expect(CARD_FACE.typeY).toBeLessThan(bottom(CARD_FACE.typeBand));
  });

  it('gives the rules text the text box down to the badge row', () => {
    expect(CARD_FACE.textTop).toBeGreaterThan(CARD_FACE.textBox.y);
    expect(CARD_FACE.boxBottom).toBeLessThan(BADGE_TOP);
    expect(CARD_FACE.boxBottom).toBeLessThanOrEqual(bottom(CARD_FACE.textBox));
    expect(FULL_ART_FACE.boxBottom).toBe(CARD_FACE.boxBottom);
  });

  it('keeps a land mana row inside the rules box, clear of the badge row and under a tapland line', () => {
    for (const size of [LAND_MANA_ROW.mono, LAND_MANA_ROW.multi]) {
      for (const face of [CARD_FACE, FULL_ART_FACE]) {
        const { bare, belowRules } = face.landRowY;
        expect(bare - size.pip / 2).toBeGreaterThanOrEqual(face.textTop);
        for (const y of [bare, belowRules]) expect(y + size.pip / 2).toBeLessThanOrEqual(BADGE_TOP - 2);
        // Room for the tapland's one 13 px rules line above the row.
        expect(belowRules - size.pip / 2 - face.textTop).toBeGreaterThanOrEqual(13);
      }
    }
  });

  it('bakes the frame at twice the card size, so the card corners are the canvas corners', () => {
    expect(toBake(CARD)).toEqual({ x: 0, y: 0, w: 600, h: 840 });
    for (const rect of [CARD_FACE.bake.art, CARD_FACE.bake.typeBand, CARD_FACE.bake.textBox]) {
      expect(inside(rect, { x: 0, y: 0, w: 600, h: 840 })).toBe(true);
    }
  });

  it('fills the frame interior on the full-art face', () => {
    expect(inside(FULL_ART_FACE.art, CARD)).toBe(true);
    expect(FULL_ART_FACE.art.x + FULL_ART_FACE.art.w / 2).toBe(0);
    expect(FULL_ART_FACE.art.y + FULL_ART_FACE.art.h / 2).toBe(0);
    expect(FULL_ART_FACE.art.h).toBeGreaterThan(CARD_FACE.art.h);
  });
});
