import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';
import {
  packRailLayout,
  packSummaryGrid,
  PACK_RAIL_GAP,
  cardDwellMs,
  cardRailX,
  clampRailOffset,
  flipPitchJitter,
  gateProgress,
  indexAtGate,
  inertiaStep,
  minimapSegments,
  PACK_BUTTON_PANEL,
  PACK_BUTTON_Y,
  PACK_INSPECT,
  packInspectLayout,
  PACK_REVEAL_GRID_SCALE,
  PACK_REVEAL_SPECIAL_SCALE,
  packRevealLayout,
  railOffsetForIndex,
  runwayOrder,
  RUNWAY_CARD_DESIGN_HEIGHT,
  RUNWAY_CARD_DESIGN_WIDTH,
  RUNWAY_CARD_SCALE,
  RUNWAY_GATE_X,
  RUNWAY_INERTIA,
  RUNWAY_MINIMAP,
  RUNWAY_PITCH,
  RUNWAY_SKIP,
  virtualRange,
} from '../../src/ui/packRunwayPresentation';

type Tier = 'c' | 'r' | 'sr' | 'ssr' | 'ur';
const t = (
  tier: Tier,
  id: number,
  variant: { frame?: 'white' | 'black' | 'blue'; holo?: 'none' | 'rainbow'; fullArt?: boolean } = {},
): { tier: Tier; id: number; frame: 'white' | 'black' | 'blue'; holo: 'none' | 'rainbow'; fullArt: boolean } => ({
  tier,
  id,
  frame: variant.frame ?? 'white',
  holo: variant.holo ?? 'none',
  fullArt: variant.fullArt ?? false,
});

describe('runwayOrder', () => {
  it('sorts ascending by rarity, stable within a tier', () => {
    const cards = [t('sr', 1), t('c', 2), t('ur', 3), t('c', 4), t('r', 5), t('ssr', 6)];
    expect(runwayOrder(cards).map((c) => c.id)).toEqual([2, 4, 5, 1, 6, 3]);
  });

  it('closes each tier run with its most special variant regardless of pack order', () => {
    // The owner's 10-pack repro: a rainbow secret ssr pulled in an EARLY pack
    // sat mid-run because the global sort dropped the variant key.
    const cards = [
      t('ssr', 1, { frame: 'blue', holo: 'rainbow' }),
      t('ssr', 2),
      t('ur', 3, { frame: 'blue' }),
      t('ssr', 4),
      t('c', 5),
    ];
    expect(runwayOrder(cards).map((c) => c.id)).toEqual([5, 2, 4, 1, 3]);
    // Full Art outranks every non-full-art treatment inside a tier.
    const fa = [t('r', 1, { frame: 'black', holo: 'rainbow' }), t('r', 2, { fullArt: true })];
    expect(runwayOrder(fa).map((c) => c.id)).toEqual([1, 2]);
  });
});

describe('rail geometry', () => {
  it('uses one larger non-overlapping row between the ribbon and summary rail', () => {
    expect(RUNWAY_PITCH).toBeGreaterThan(RUNWAY_CARD_DESIGN_WIDTH * RUNWAY_CARD_SCALE);
  });

  it('parks the indexed card exactly on the gate', () => {
    for (const index of [0, 1, 17, 149]) {
      expect(cardRailX(index, railOffsetForIndex(index))).toBe(RUNWAY_GATE_X);
    }
  });

  it('reports the highest index at or past the gate', () => {
    const total = 150;
    expect(indexAtGate(railOffsetForIndex(0), total)).toBe(0);
    expect(indexAtGate(railOffsetForIndex(0) + 1, total)).toBe(-1);
    expect(indexAtGate(railOffsetForIndex(7), total)).toBe(7);
    expect(indexAtGate(railOffsetForIndex(7) - RUNWAY_PITCH / 2, total)).toBe(7);
    expect(indexAtGate(railOffsetForIndex(500), total)).toBe(149);
  });

  it('clamps the scrub range from first card to last card on the gate', () => {
    const total = 150;
    expect(clampRailOffset(1e9, total)).toBe(railOffsetForIndex(0));
    expect(clampRailOffset(-1e9, total)).toBe(railOffsetForIndex(149));
    const mid = railOffsetForIndex(60);
    expect(clampRailOffset(mid, total)).toBe(mid);
  });
});

describe('minimap CTA geometry', () => {
  it('places Skip immediately to the right of the ribbon', () => {
    const ribbonRight = RUNWAY_MINIMAP.x + RUNWAY_MINIMAP.width;
    expect(RUNWAY_SKIP.x - 50).toBeGreaterThan(ribbonRight);
    expect(RUNWAY_SKIP.x).toBeLessThan(1280);
    expect(RUNWAY_SKIP.y).toBeCloseTo(RUNWAY_MINIMAP.y + 4);
  });
});

describe('cardDwellMs', () => {
  it('runs an accelerando through the commons with a floor', () => {
    expect(cardDwellMs('c', 0, 'full')).toBe(300);
    expect(cardDwellMs('c', 3, 'full')).toBe(210);
    expect(cardDwellMs('c', 50, 'full')).toBe(120);
  });

  it('ritardandos into the specials', () => {
    expect(cardDwellMs('r', 0, 'full')).toBeGreaterThan(cardDwellMs('c', 10, 'full'));
    expect(cardDwellMs('sr', 0, 'full')).toBeGreaterThan(cardDwellMs('r', 0, 'full'));
    expect(cardDwellMs('ssr', 0, 'full')).toBeGreaterThan(cardDwellMs('sr', 0, 'full'));
    expect(cardDwellMs('ur', 0, 'full')).toBeGreaterThan(cardDwellMs('ssr', 0, 'full'));
  });

  it('halves under reduced motion with a floor', () => {
    expect(cardDwellMs('ssr', 0, 'reduced')).toBe(500);
    expect(cardDwellMs('c', 50, 'reduced')).toBe(80);
  });
});

describe('inertiaStep', () => {
  it('caps the throw, decays it, and rests below the floor', () => {
    expect(Math.abs(inertiaStep(99999, 16))).toBeLessThanOrEqual(RUNWAY_INERTIA.maxSpeed);
    const v1 = inertiaStep(1000, 16);
    expect(v1).toBeLessThan(1000);
    expect(v1).toBeGreaterThan(0);
    expect(inertiaStep(41, 500)).toBe(0);
    expect(inertiaStep(-1000, 16)).toBeCloseTo(-v1, 6);
  });
});

describe('virtualRange', () => {
  it('materializes only the visible strip plus margin', () => {
    const total = 150;
    const atStart = virtualRange(railOffsetForIndex(0), total);
    expect(atStart.first).toBe(0);
    expect(atStart.last).toBeLessThan(15);
    const mid = virtualRange(railOffsetForIndex(75), total);
    expect(mid.first).toBeGreaterThan(60);
    expect(mid.last).toBeLessThan(90);
    expect(mid.last - mid.first).toBeLessThan(16);
    const end = virtualRange(railOffsetForIndex(149), total);
    expect(end.last).toBe(149);
  });
});

describe('minimapSegments', () => {
  it('merges contiguous tier runs into fractions', () => {
    const segments = minimapSegments([t('c', 1), t('c', 2), t('r', 3), t('ur', 4)]);
    expect(segments).toEqual([
      { tier: 'c', from: 0, to: 0.5 },
      { tier: 'r', from: 0.5, to: 0.75 },
      { tier: 'ur', from: 0.75, to: 1 },
    ]);
  });

  it('handles empty and single-tier rides', () => {
    expect(minimapSegments([])).toEqual([]);
    expect(minimapSegments([t('c', 1)])).toEqual([{ tier: 'c', from: 0, to: 1 }]);
  });
});

describe('gateProgress', () => {
  it('tracks the needle from 0 to 1', () => {
    expect(gateProgress(-1, 150)).toBe(0);
    expect(gateProgress(74, 150)).toBeCloseTo(0.5, 6);
    expect(gateProgress(149, 150)).toBe(1);
    expect(gateProgress(0, 0)).toBe(0);
  });
});

describe('flipPitchJitter', () => {
  it('is deterministic and bounded', () => {
    for (let i = 0; i < 40; i++) {
      const pitch = flipPitchJitter(i);
      expect(pitch).toBeGreaterThanOrEqual(0.95);
      expect(pitch).toBeLessThanOrEqual(1.08);
      expect(pitch).toBe(flipPitchJitter(i));
    }
  });
});

describe('packRevealLayout', () => {
  type Slot = { x: number; y: number; scale: number };
  const rect = (slot: Slot): { left: number; right: number; top: number; bottom: number } => {
    const w = RUNWAY_CARD_DESIGN_WIDTH * slot.scale;
    const h = RUNWAY_CARD_DESIGN_HEIGHT * slot.scale;
    return { left: slot.x - w / 2, right: slot.x + w / 2, top: slot.y - h / 2, bottom: slot.y + h / 2 };
  };
  const packSize = ECONOMY.boosterPackSize;
  const splits = Array.from({ length: packSize + 1 }, (_, specials) => [packSize - specials, specials] as const);
  const { safeLeft, safeRight, safeTop, safeBottom } = theme.design;
  const headerBottom = safeTop + theme.control.minHitHeight;
  const railTop = PACK_BUTTON_Y - PACK_BUTTON_PANEL.height / 2;

  it('slots every card of every split of a booster', () => {
    for (const [grid, specials] of splits) {
      const layout = packRevealLayout(grid, specials);
      expect(layout.grid).toHaveLength(grid);
      expect(layout.specials).toHaveLength(specials);
    }
  });

  /** The review's repro: grid row two sat under the specials row on every
   *  9-card pack, so the rare covered row two's rules text. */
  it('never lets one card overlap another, with inactive space between neighbours', () => {
    for (const [grid, specials] of splits) {
      const { grid: g, specials: s } = packRevealLayout(grid, specials);
      const cards = [...g, ...s].map(rect);
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          const a = cards[i];
          const b = cards[j];
          const gapX = Math.max(b.left - a.right, a.left - b.right);
          const gapY = Math.max(b.top - a.bottom, a.top - b.bottom);
          expect(Math.max(gapX, gapY), `split ${grid}+${specials}: cards ${i} and ${j}`).toBeGreaterThanOrEqual(12);
        }
      }
    }
  });

  it('keeps every card inside the title-safe frame, below the header row and above the CTA rail', () => {
    for (const [grid, specials] of splits) {
      const { grid: g, specials: s } = packRevealLayout(grid, specials);
      // A full row may run exactly edge to edge; allow float rounding only.
      const eps = 1e-6;
      for (const card of [...g, ...s].map(rect)) {
        expect(card.left).toBeGreaterThanOrEqual(safeLeft - eps);
        expect(card.right).toBeLessThanOrEqual(safeRight + eps);
        expect(card.top).toBeGreaterThanOrEqual(headerBottom);
        expect(card.bottom).toBeLessThan(railTop);
      }
    }
  });

  it('puts the CTA rail buttons inside the title-safe frame', () => {
    const buttonHalfHit = theme.control.minHitHeight / 2;
    expect(PACK_BUTTON_Y - buttonHalfHit).toBeGreaterThanOrEqual(safeTop);
    expect(PACK_BUTTON_Y + buttonHalfHit).toBeLessThanOrEqual(safeBottom);
  });

  it('reads grid first, then the specials one size larger, never above their base size', () => {
    for (const [grid, specials] of splits) {
      const { grid: g, specials: s } = packRevealLayout(grid, specials);
      const gridBottom = Math.max(...g.map((slot) => rect(slot).bottom));
      for (const slot of s) {
        expect(rect(slot).top).toBeGreaterThan(gridBottom);
        expect(slot.scale).toBeLessThanOrEqual(PACK_REVEAL_SPECIAL_SCALE);
        for (const gridSlot of g) expect(slot.scale).toBeGreaterThan(gridSlot.scale);
      }
      for (const slot of g) expect(slot.scale).toBeLessThanOrEqual(PACK_REVEAL_GRID_SCALE);
    }
  });

  /** Legibility gate: fitting a crowded split may shrink cards, but never
   *  below a third of full size (100 x 140 px). */
  it('keeps every card of every split at least a third of full size', () => {
    for (const [grid, specials] of splits) {
      const { grid: g, specials: s } = packRevealLayout(grid, specials);
      for (const slot of [...g, ...s]) expect(slot.scale).toBeGreaterThanOrEqual(1 / 3);
    }
  });
});

describe('packInspectLayout', () => {
  /** A line box of 1.25 em at the label role in force; the probe measures real glyphs. */
  const lineHeight = (): number => Math.ceil(theme.type.label * 1.25);
  const inside = (outer: { x: number; y: number; width: number; height: number }, inner: { x: number; y: number; width: number; height: number }): boolean =>
    inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

  it('keeps the card and every detail line inside the dialog and the frame, above its bottom inset, in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      for (let lines = 1; lines <= 6; lines++) {
        const heights = Array<number>(lines).fill(lineHeight());
        const layout = packInspectLayout(heights);
        const frame = { x: theme.design.safeLeft, y: theme.design.safeTop, width: theme.design.safeWidth, height: theme.design.safeHeight };
        expect(inside(frame, layout.panel), `${cell.name}, ${lines} lines`).toBe(true);
        expect(inside(layout.panel, layout.detail), `${cell.name}, ${lines} lines`).toBe(true);
        expect(layout.detail.y + layout.detail.height + PACK_INSPECT.pad, cell.name).toBeLessThanOrEqual(layout.panel.y + layout.panel.height);
        const card = { x: theme.design.centerX - (RUNWAY_CARD_DESIGN_WIDTH * layout.cardScale) / 2, y: layout.cardY - (RUNWAY_CARD_DESIGN_HEIGHT * layout.cardScale) / 2,
          width: RUNWAY_CARD_DESIGN_WIDTH * layout.cardScale, height: RUNWAY_CARD_DESIGN_HEIGHT * layout.cardScale };
        expect(inside(layout.panel, card), `${cell.name}, ${lines} lines: the card`).toBe(true);
        expect(card.y + card.height + PACK_INSPECT.pad, `${cell.name}: card above the plate`).toBeLessThanOrEqual(layout.detail.y + 1e-9);
        layout.lineYs.forEach((y, i) => {
          expect(y - heights[i] / 2, `${cell.name}: line ${i}`).toBeGreaterThanOrEqual(layout.detail.y + PACK_INSPECT.linePad - 1e-9);
          expect(y + heights[i] / 2, `${cell.name}: line ${i}`).toBeLessThanOrEqual(layout.detail.y + layout.detail.height - PACK_INSPECT.linePad + 1e-9);
          if (i > 0) expect(y - layout.lineYs[i - 1], `${cell.name}: line gap`).toBeGreaterThanOrEqual(heights[i] + PACK_INSPECT.lineGap - 1e-9);
        });
      }
    });
  });

  it('never draws the card larger than its release inspect size, and shrinks it only for more lines', () => {
    const scales = [1, 3, 6, 9].map((n) => packInspectLayout(Array<number>(n).fill(17)).cardScale);
    expect(scales[0]).toBeLessThanOrEqual(PACK_INSPECT.cardMaxScale);
    for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeLessThanOrEqual(scales[i - 1]);
  });
});

describe('pack CTA rail', () => {
  it('centres the buttons as one group with one gap, on a panel that holds them inside the frame', () => {
    for (const widths of [[230, 130, 130], [300, 130, 130], [180, 150, 150]]) {
      const rail = packRailLayout(widths);
      const lefts = rail.xs.map((x, i) => x - widths[i] / 2);
      const rights = rail.xs.map((x, i) => x + widths[i] / 2);
      expect((lefts[0] + rights.at(-1)!) / 2).toBeCloseTo(theme.design.centerX);
      for (let i = 1; i < widths.length; i++) expect(lefts[i] - rights[i - 1]).toBeCloseTo(PACK_RAIL_GAP);
      expect(rail.panel.x).toBeLessThan(lefts[0]);
      expect(rail.panel.x + rail.panel.width).toBeGreaterThan(rights.at(-1)!);
      expect(rail.panel.x).toBeGreaterThanOrEqual(theme.design.safeLeft);
    }
  });
});

describe('batch summary grid', () => {
  it('keeps every best pull inside the frame, apart, and between the heading and the rail', () => {
    const headingBottom = 130;
    const railTop = PACK_BUTTON_Y - PACK_BUTTON_PANEL.height / 2;
    for (const count of [1, 5, 8, 9, 16, 20]) {
      const { scale, cells } = packSummaryGrid(count, headingBottom);
      expect(cells).toHaveLength(Math.min(count, 16));
      const w = 300 * scale, h = 420 * scale;
      for (const c of cells) {
        expect(c.x - w / 2).toBeGreaterThanOrEqual(theme.design.safeLeft);
        expect(c.x + w / 2).toBeLessThanOrEqual(theme.design.safeRight);
        expect(c.y - h / 2).toBeGreaterThan(headingBottom);
        expect(c.y + h / 2).toBeLessThan(railTop);
      }
      for (let i = 1; i < cells.length; i++) {
        if (cells[i].y === cells[i - 1].y) expect(cells[i].x - cells[i - 1].x - w).toBeGreaterThanOrEqual(12);
      }
    }
  });
});
