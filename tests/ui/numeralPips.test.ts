import { describe, expect, it } from 'vitest';
import {
  FORGE_NUMERAL_BOX,
  FORGE_NUMERAL_OPTIONS,
  NUMERAL_PATHS,
  numeralBadgeGeometry,
  numeralLayout,
  numeralPlateGeometry,
  pathInkBox,
  type NumeralGlyph,
  type NumeralLayout,
} from '../../src/art/numeralPaths';
import { ALL_CARDS } from '../../src/data/catalog';
import { FORGE_LIMITS } from '../../src/forge/validate';

// The bead every numeral is baked into (ManaSymbols PIP_SIZE): a disc of
// radius 30 with a 4px outline, so its flat grey face ends at radius 28.
const BEAD = 64;
const CENTRE = BEAD / 2;
const FACE_RADIUS = 28;
/** Ink keeps at least this far inside the bead's grey face. */
const MARGIN = 2;

/**
 * Independent oracle: walk the path's M/L/C commands and sample every
 * segment densely, so the expected ink extent never comes from the
 * production bounding-box maths.
 */
function sampleInk(d: string): Array<[number, number]> {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const points: Array<[number, number]> = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'Z') {
      cmd = '';
      continue;
    }
    if (cmd === 'M' || cmd === 'L') {
      x = Number(tokens[i++]);
      y = Number(tokens[i++]);
      points.push([x, y]);
      continue;
    }
    const [x1, y1, x2, y2, x3, y3] = tokens.slice(i, i + 6).map(Number);
    i += 6;
    for (let s = 1; s <= 400; s++) {
      const t = s / 400;
      const u = 1 - t;
      points.push([
        u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      ]);
    }
    x = x3;
    y = y3;
  }
  return points;
}

const SAMPLES = new Map<NumeralGlyph, Array<[number, number]>>(
  (Object.keys(NUMERAL_PATHS) as NumeralGlyph[]).map((glyph) => [glyph, sampleInk(NUMERAL_PATHS[glyph])]),
);

/** Every sampled ink point of a laid-out group, per glyph, times `scale`
 * (a bake drawn at another size than it is shown). Defaults to n's bead. */
function groupInk(n: number | string, layout: NumeralLayout = numeralLayout(n, BEAD), scale = 1): Array<Array<[number, number]>> {
  return layout.glyphs.map((glyph) =>
    SAMPLES.get(glyph.glyph)!.map(([px, py]): [number, number] =>
      [(glyph.tx + layout.k * px) * scale, (glyph.ty + layout.k * py) * scale]),
  );
}

function extent(points: Array<[number, number]>): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// Every amount a player can see in a bead: the catalog's printed generics and
// rules-text costs, Forge cards (generic capped by FORGE_LIMITS), and the
// two-digit totals Darling tax and repeated pump activations can reach.
const catalogMax = Math.max(...ALL_CARDS.map((card) => card.cost?.generic ?? 0));
const HIGHEST = Math.max(99, catalogMax, FORGE_LIMITS.generic);
const AMOUNTS = Array.from({ length: HIGHEST + 1 }, (_, n) => n);

describe('generic-cost numeral beads', () => {
  it('centres every numeral group on the bead by its real ink, both axes', () => {
    for (const n of AMOUNTS) {
      const box = extent(groupInk(n).flat());
      expect(Math.abs((box.minX + box.maxX) / 2 - CENTRE), `n=${n} horizontal`).toBeLessThan(0.25);
      expect(Math.abs((box.minY + box.maxY) / 2 - CENTRE), `n=${n} vertical`).toBeLessThan(0.25);
    }
  });

  it('keeps every numeral group inside the bead face with a margin', () => {
    for (const n of AMOUNTS) {
      const farthest = Math.max(...groupInk(n).flat().map(([px, py]) => Math.hypot(px - CENTRE, py - CENTRE)));
      expect(farthest, `n=${n}`).toBeLessThanOrEqual(FACE_RADIUS - MARGIN);
    }
  });

  it('sets multi-digit groups on one baseline and cap line (lining figures)', () => {
    for (const n of AMOUNTS.filter((amount) => amount >= 10)) {
      const glyphs = groupInk(n).map(extent);
      for (const glyph of glyphs.slice(1)) {
        expect(Math.abs(glyph.minY - glyphs[0].minY), `n=${n} cap line`).toBeLessThan(0.25);
        expect(Math.abs(glyph.maxY - glyphs[0].maxY), `n=${n} baseline`).toBeLessThan(0.25);
      }
    }
  });

  it('keeps adjacent digits apart so a two-digit amount never reads as one glyph', () => {
    for (const n of AMOUNTS.filter((amount) => amount >= 10)) {
      const glyphs = groupInk(n).map(extent);
      for (let i = 1; i < glyphs.length; i++) {
        expect(glyphs[i].minX - glyphs[i - 1].maxX, `n=${n}`).toBeGreaterThan(0.5);
      }
    }
  });

  it('measures a cubic by the curve it draws, not by its control points', () => {
    // A bulge whose control points reach y=0 but whose curve peaks at y=25.
    const box = pathInkBox('M0 100 C0 0 100 0 100 100 Z');
    expect(box.minY).toBeCloseTo(25, 6);
    expect(box.minX).toBe(0);
    expect(box.maxX).toBe(100);
    expect(() => pathInkBox('M0 0 A5 5 0 0 1 10 10 Z')).toThrow(/unsupported/);
  });
});

// Round badges (pick order, castable count) span these digit heights: the
// pile chip's 7px up to a portrait badge at a large text scale, on the 18px
// chip and the 24px pick discs.
const BADGE_DIGIT_HEIGHTS = [6, 7, 8.7, 10.2, 12, 14, 16];
const BADGE_MIN_DIAMETERS = [18, 24];
/** A ring stroked on the disc edge reaches this far inside (5px high contrast). */
const RING_INSIDE = 2.5;

describe('numeral badges', () => {
  // The badge bake lays the numeral out at twice its shown size (rounded up
  // to whole texture pixels) and is drawn back down to the disc diameter.
  const shownBadge = (n: number | string, digitHeight: number, minDiameter: number) => {
    const geometry = numeralBadgeGeometry(n, digitHeight, minDiameter);
    const size = Math.ceil(geometry.diameter * 2);
    const ink = groupInk(n, numeralLayout(n, size, geometry.options), geometry.diameter / size);
    return { diameter: geometry.diameter, ink };
  };

  it('centres the numeral on the disc by its real ink, as baked and shown', () => {
    for (const height of BADGE_DIGIT_HEIGHTS) {
      for (const min of BADGE_MIN_DIAMETERS) {
        for (const n of AMOUNTS) {
          const { diameter, ink } = shownBadge(n, height, min);
          const box = extent(ink.flat());
          const where = `n=${n} h=${height} min=${min}`;
          expect(Math.abs((box.minX + box.maxX) / 2 - diameter / 2), `${where} horizontal`).toBeLessThan(0.1);
          expect(Math.abs((box.minY + box.maxY) / 2 - diameter / 2), `${where} vertical`).toBeLessThan(0.1);
        }
      }
    }
  });

  it('keeps the numeral clear of the ring, growing the disc for wide counts', () => {
    for (const height of BADGE_DIGIT_HEIGHTS) {
      for (const min of BADGE_MIN_DIAMETERS) {
        for (const n of AMOUNTS) {
          const { diameter, ink } = shownBadge(n, height, min);
          const centre = diameter / 2;
          const farthest = Math.max(...ink.flat().map(([px, py]) => Math.hypot(px - centre, py - centre)));
          expect(farthest, `n=${n} h=${height} min=${min}`).toBeLessThanOrEqual(centre - RING_INSIDE);
          expect(diameter).toBeGreaterThanOrEqual(min);
        }
      }
    }
  });

  it('draws every digit at the requested height', () => {
    for (const height of BADGE_DIGIT_HEIGHTS) {
      for (const n of AMOUNTS) {
        const box = extent(shownBadge(n, height, 24).ink.flat());
        expect(box.maxY - box.minY, `n=${n} h=${height}`).toBeCloseTo(height, 1);
      }
    }
  });
});

// Labels with punctuation: repeated picks (a creature picked for several
// ordered target slots) and Mark counts.
const PICK_LABELS = ['1, 2', '2, 3', '1, 2, 3', '9, 10', '1, 2, 3, 4'];
const MARK_LABELS = ['+1', '+2', '+9', '+10', '+25'];

/** Per glyph of a label: its sampled extent, tagged with the glyph. */
function glyphExtents(label: string, layout: NumeralLayout, scale = 1) {
  return groupInk(label, layout, scale).map((ink, index) => ({ glyph: layout.glyphs[index].glyph, ...extent(ink) }));
}

describe('repeated-pick and Mark numerals', () => {
  // The bake at twice the size, shown at the disc's diameter (as above).
  const shownBadge = (label: string, digitHeight: number, minDiameter: number) => {
    const geometry = numeralBadgeGeometry(label, digitHeight, minDiameter);
    const size = Math.ceil(geometry.diameter * 2);
    const layout = numeralLayout(label, size, geometry.options);
    return { diameter: geometry.diameter, glyphs: glyphExtents(label, layout, geometry.diameter / size),
      ink: groupInk(label, layout, geometry.diameter / size).flat() };
  };

  it('centres a repeated-pick label on the disc by its digits, with the comma tail clear of the ring', () => {
    for (const height of BADGE_DIGIT_HEIGHTS) {
      for (const label of PICK_LABELS) {
        const { diameter, glyphs, ink } = shownBadge(label, height, 24);
        const where = `${label} h=${height}`;
        const all = extent(ink);
        const digits = glyphs.filter((g) => g.glyph !== ',');
        const capTop = Math.min(...digits.map((g) => g.minY));
        const base = Math.max(...digits.map((g) => g.maxY));
        expect(Math.abs((all.minX + all.maxX) / 2 - diameter / 2), `${where} horizontal`).toBeLessThan(0.1);
        expect(Math.abs((capTop + base) / 2 - diameter / 2), `${where} vertical`).toBeLessThan(0.1);
        expect(base - capTop, `${where} digit height`).toBeCloseTo(height, 1);
        const farthest = Math.max(...ink.map(([px, py]) => Math.hypot(px - diameter / 2, py - diameter / 2)));
        expect(farthest, where).toBeLessThanOrEqual(diameter / 2 - RING_INSIDE);
      }
    }
  });

  it('sets each comma low after its number, apart from both neighbours, so "1, 2" never reads as "12" or "1\'2"', () => {
    for (const label of PICK_LABELS) {
      const geometry = numeralBadgeGeometry(label, 8.7, 24);
      const glyphs = glyphExtents(label, geometry.layout);
      const digits = glyphs.filter((g) => g.glyph !== ',');
      const capTop = Math.min(...digits.map((g) => g.minY));
      const base = Math.max(...digits.map((g) => g.maxY));
      glyphs.forEach((glyph, i) => {
        if (i > 0) expect(glyph.minX - glyphs[i - 1].maxX, `${label} gap ${i}`).toBeGreaterThan(0.3);
        if (glyph.glyph !== ',') return;
        // Below the cap middle, its tail past the baseline.
        expect(glyph.minY, label).toBeGreaterThan((capTop + base) / 2);
        expect(glyph.maxY, label).toBeGreaterThan(base);
        // The word space: wider after the comma than before it.
        expect(glyphs[i + 1].minX - glyph.maxX, label).toBeGreaterThan(glyph.minX - glyphs[i - 1].maxX);
      });
    }
  });

  it('centres a Mark count on its plate, the plus level with its digits', () => {
    for (const height of BADGE_DIGIT_HEIGHTS) {
      for (const label of MARK_LABELS) {
        const spec = { digitHeight: height, padX: 3, padY: 3.5 };
        const plate = numeralPlateGeometry(label, spec);
        const glyphs = glyphExtents(label, plate.layout);
        const all = extent(groupInk(label, plate.layout).flat());
        const digits = glyphs.filter((g) => g.glyph !== '+');
        const plus = glyphs.find((g) => g.glyph === '+')!;
        const where = `${label} h=${height}`;
        expect(Math.abs((all.minX + all.maxX) / 2 - plate.width / 2), `${where} horizontal`).toBeLessThan(0.1);
        expect(Math.abs((all.minY + all.maxY) / 2 - plate.height / 2), `${where} vertical`).toBeLessThan(0.1);
        expect(all.maxY - all.minY, `${where} digit height`).toBeCloseTo(height, 1);
        expect(Math.abs((plus.minY + plus.maxY) / 2 - (digits[0].minY + digits[0].maxY) / 2), where).toBeLessThan(0.1);
        expect(digits[0].minX - plus.maxX, where).toBeGreaterThan(0.3);
        expect(all.minX, where).toBeGreaterThanOrEqual(spec.padX - 0.1);
        expect(plate.width - all.maxX, where).toBeGreaterThanOrEqual(spec.padX - 0.1);
        expect(all.minY, where).toBeGreaterThanOrEqual(spec.padY - 0.1);
      }
    }
  });

  it('keeps a fixed-size count plate at its size and the count centred in it', () => {
    const spec = { digitHeight: 7, padX: 3, padY: 0, minWidth: 40, minHeight: 16 };
    for (const n of AMOUNTS) {
      const plate = numeralPlateGeometry(n, spec);
      const box = extent(groupInk(n, plate.layout).flat());
      expect([plate.width, plate.height], `n=${n}`).toEqual([40, 16]);
      expect(Math.abs((box.minX + box.maxX) / 2 - 20), `n=${n} horizontal`).toBeLessThan(0.1);
      expect(Math.abs((box.minY + box.maxY) / 2 - 8), `n=${n} vertical`).toBeLessThan(0.1);
    }
  });

  it('refuses a label it has no glyphs for', () => {
    for (const label of ['', '1,2', '-1', '1/2', '2+', 'x']) {
      expect(() => numeralLayout(label, BEAD), JSON.stringify(label)).toThrow(/not a numeral label/);
    }
  });
});

describe('Forge generic-pip numerals', () => {
  it('centre every amount in the circle and keep it inside the content box', () => {
    const centre = FORGE_NUMERAL_BOX / 2;
    for (const n of AMOUNTS) {
      const ink = groupInk(n, numeralLayout(n, FORGE_NUMERAL_BOX, FORGE_NUMERAL_OPTIONS)).flat();
      const box = extent(ink);
      expect(Math.abs((box.minX + box.maxX) / 2 - centre), `n=${n} horizontal`).toBeLessThan(0.4);
      expect(Math.abs((box.minY + box.maxY) / 2 - centre), `n=${n} vertical`).toBeLessThan(0.4);
      // The circle's content box is inscribed in its border: keep 5% air.
      const farthest = Math.max(...ink.map(([px, py]) => Math.hypot(px - centre, py - centre)));
      expect(farthest, `n=${n}`).toBeLessThanOrEqual(centre * 0.9);
    }
  });
});
