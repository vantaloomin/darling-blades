import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { currentAccessibility, setAccessibility, TEXT_SCALES } from '../../src/ui/accessibility';
import { isRectContained, measureThemedButton, type Rect } from '../../src/ui/layout';
import { fitMenuListName, menuTextFindings, menuTextOverlap, type MenuTextLayer, type MenuTextSurface } from '../../src/ui/menuText';
import { theme } from '../../src/ui/theme';

const background: MenuTextLayer = {
  bounds: { x: 20, y: 20, width: 60, height: 20 }, depth: 0, order: 0,
};
const foregroundBounds: Rect = { x: 60, y: 25, width: 60, height: 20 };
const plate: MenuTextSurface = {
  id: 'inspect', bounds: { x: 55, y: 20, width: 80, height: 40 }, depth: 5, order: 0,
};

/** Supplied measurement envelope; the rendered probe checks actual glyphs. */
function measuredName(value: string, fontSize: number) {
  const name = {
    text: value, scale: 1,
    get width() { return name.text.length * fontSize * 0.7; },
    setText(text: string) { name.text = text; },
    setScale(scale: number) { name.scale = scale; },
    setData() {},
  };
  return name;
}

describe('release list-name fitting', () => {
  it('shows every preview card name in full at 100%, shrinking exactly to the release width', () => {
    for (const card of Object.values(CARD_DB)) {
      const name = measuredName(card.name, theme.typeBase.caption);
      const releaseScale = Math.min(1, 184 / name.width);
      fitMenuListName(name, 184, theme.typeBase.caption, theme.typeBase.caption);
      const bounds = { x: 0, y: 0, width: name.width * name.scale, height: 15 * name.scale };
      expect(menuTextFindings({ expected: card.name, actual: name.text, lines: [name.text],
        bounds, box: { ...bounds, width: 184 } }), card.name).toEqual([]);
      expect(name.scale, card.name).toBe(releaseScale);
    }
  });

  it.each([12, 14])('uses a %ipx base-role floor at larger settings before abbreviating', (base) => {
    for (const font of [Math.round(base * 1.15), Math.round(base * 1.3)]) {
      for (const value of ['Short', 'A name of middling length', 'Quan Cong, Daring Marchioness of the Red Cliffs']) {
        const name = measuredName(value, font);
        const fitsAtBase = value.length * base * 0.7 <= 184;
        fitMenuListName(name, 184, font, base);
        expect(name.scale * font).toBeGreaterThanOrEqual(base);
        expect(name.width * name.scale).toBeLessThanOrEqual(184 + 1e-6);
        expect(name.text === value).toBe(fitsAtBase);
      }
    }
  });
});

/** Collision is symmetric even though the plate covering it has a direction. */
function expectOverlap(a: MenuTextLayer, b: MenuTextLayer, expected: boolean): void {
  expect(menuTextOverlap(a, b)).toBe(expected);
  expect(menuTextOverlap(b, a)).toBe(expected);
}

describe('visible menu text collisions', () => {
  it.each([
    { depth: 0, order: 0 },
    { depth: 0, order: 12 },
    { depth: 10, order: 12 },
  ])('reports intersecting base text regardless of its independent display order ($depth, $order)', (draw) => {
    expectOverlap(background, { bounds: foregroundBounds, ...draw }, true);
  });

  it('reports different text on the same plate even when one text draws later', () => {
    const surface = { ...plate, depth: 0, order: 0 };
    expectOverlap(
      { ...background, surface, order: 1 },
      { bounds: foregroundBounds, surface, depth: 0, order: 2 },
      true,
    );
  });

  it('excludes only the background intersection hidden by a higher foreground plate', () => {
    // The background extends left of the plate. That visible remainder never
    // intersects the foreground, so covering the whole background is unnecessary.
    expectOverlap(background, { bounds: foregroundBounds, depth: 5, order: 1, surface: plate }, false);
  });

  it('uses the plate render order when two surfaces share a depth', () => {
    const back = { ...background, depth: 5, order: 2 };
    expectOverlap(back, { bounds: foregroundBounds, depth: 5, order: 4,
      surface: { ...plate, depth: 5, order: 3 } }, false);
  });

  it.each([
    { depth: 4, order: 100 },
    { depth: 5, order: 1 },
    { depth: 5, order: 2 },
  ])('keeps a collision when the covering plate is not above the background ($depth, $order)', (draw) => {
    // The foreground text's depth cannot make its lower plate opaque above back.
    expectOverlap({ ...background, depth: 5, order: 2 }, {
      bounds: foregroundBounds, depth: 10, order: 200, surface: { ...plate, ...draw },
    }, true);
  });

  it.each([
    { x: 61, y: 20, width: 80, height: 40 },
    { x: 55, y: 26, width: 80, height: 40 },
    { x: 55, y: 20, width: 24, height: 40 },
    { x: 55, y: 20, width: 80, height: 19 },
  ])('reports the part of an intersection outside a foreground plate (%j)', (bounds) => {
    // The text intersection is x 60..80, y 25..40; each plate leaves one edge visible.
    expectOverlap(background, { bounds: foregroundBounds, depth: 5, order: 1,
      surface: { ...plate, bounds } }, true);
  });
});

describe('full identities under advanced word wrapping', () => {
  const expected = 'Chrome-Violet Broodship';
  const bounds = { x: 0, y: 0, width: 120, height: 60 };
  const check = {
    expected, actual: expected, lines: ['Chrome-Vio', 'let Brood', 'ship'],
    maxLines: 3, bounds, box: bounds,
  };

  it('accepts midword line breaks when all source characters remain visible', () => {
    expect(menuTextFindings(check)).toEqual([]);
  });

  it('rejects character loss in the source or in an advanced-wrapped line', () => {
    expect(menuTextFindings({ ...check, actual: 'Chrome-Violet Broodshi' })).toContain('truncatedText');
    expect(menuTextFindings({ ...check, lines: ['Chrome-Vio', 'let Brood', 'shi'] })).toContain('truncatedText');
  });

  it('rejects a missing final word fragment even while the remaining bounds fit', () => {
    expect(menuTextFindings({ ...check, lines: ['Chrome-Vio', 'let Brood'] })).toContain('truncatedText');
  });

  it('rejects a later ring painted across badge ink even when the whole text allocation fits', () => {
    for (const actual of ['Duty', 'Attack', 'Blocks', '1', '1, 2', '+2']) {
      const badge = { expected: actual, actual, lines: [actual], bounds: { x: 0, y: 0, width: 40, height: 20 },
        glyphBounds: { x: 4, y: 4, width: 30, height: 10 }, glyphClip: { x: 0, y: 0, width: 40, height: 20 } };
      expect(menuTextFindings(badge)).toEqual([]);
      expect(menuTextFindings({ ...badge, occluders: [{ x: 0, y: 5, width: 40, height: 3 }] })).toContain('clippedText');
      expect(menuTextFindings({ ...badge, occluders: [{ x: 0, y: 16, width: 40, height: 3 }] })).toEqual([]);
      expect(menuTextFindings({ ...badge, glyphClip: { x: 0, y: 6, width: 40, height: 14 } })).toContain('clippedText');
      expect(menuTextFindings({ ...badge, clip: { x: 0, y: 6, width: 40, height: 14 }, keepVisible: true })).toContain('clippedText');
    }
  });
});

describe('buttons containing measured multiline labels', () => {
  let before = currentAccessibility();
  beforeEach(() => { before = currentAccessibility(); });
  afterEach(() => { setAccessibility(before); });

  const cells = TEXT_SCALES.flatMap((textScale) => [false, true].map((highContrast) => ({ textScale, highContrast })));
  it.each(cells)('contains two and three lines at text scale $textScale, high contrast $highContrast', (cell) => {
    setAccessibility(cell);
    // These are supplied measurement envelopes, not estimates of any font's
    // real glyphs. The browser probe is responsible for those measurements.
    const lineHeight = Math.ceil(theme.type.label * 1.5);
    const labelWidth = 216;
    for (const size of ['sm', 'md'] as const) {
      const oneLine = measureThemedButton(labelWidth, size, 280, 12, lineHeight);
      let previousHeight = oneLine.visual.height;
      for (const lines of [2, 3]) {
        const labelHeight = lines * lineHeight + (lines - 1) * 4;
        const label = { x: -labelWidth / 2, y: -labelHeight / 2, width: labelWidth, height: labelHeight };
        const button = measureThemedButton(labelWidth, size, 280, 12, labelHeight);
        expect(isRectContained(label, button.visual)).toBe(true);
        expect(isRectContained(button.visual, button.hit)).toBe(true);
        expect(button.visual.height).toBeGreaterThan(previousHeight);
        expect(button.visual.width).toBe(oneLine.visual.width);
        expect(label.y - button.visual.y).toBeGreaterThan(0);
        expect(button.visual.y + button.visual.height - label.y - label.height).toBeGreaterThan(0);
        previousHeight = button.visual.height;
      }
    }
  });
});
