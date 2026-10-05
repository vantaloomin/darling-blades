import { describe, expect, it } from 'vitest';
import { NUMERAL_PATHS, numeralLayout, pathInkBox, type Digit } from '../../src/art/numeralPaths';
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

const SAMPLES = new Map<Digit, Array<[number, number]>>(
  (Object.keys(NUMERAL_PATHS) as Digit[]).map((digit) => [digit, sampleInk(NUMERAL_PATHS[digit])]),
);

/** Every sampled ink point of n's numeral group, in bead pixels. */
function groupInk(n: number): Array<Array<[number, number]>> {
  const layout = numeralLayout(n, BEAD);
  return layout.glyphs.map((glyph) =>
    SAMPLES.get(glyph.digit)!.map(([px, py]): [number, number] => [glyph.tx + layout.k * px, glyph.ty + layout.k * py]),
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
