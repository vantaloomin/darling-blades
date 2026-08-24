import { describe, expect, it } from 'vitest';
import {
  cardDwellMs,
  cardRailX,
  clampRailOffset,
  flipPitchJitter,
  gateProgress,
  indexAtGate,
  inertiaStep,
  minimapSegments,
  railOffsetForIndex,
  runwayOrder,
  RUNWAY_CARD_DESIGN_WIDTH,
  RUNWAY_CARD_HALF_HEIGHT,
  RUNWAY_CARD_SCALE,
  RUNWAY_GATE_X,
  RUNWAY_INERTIA,
  RUNWAY_MINIMAP,
  RUNWAY_PITCH,
  RUNWAY_SKIP,
  RUNWAY_VIRTUAL_MARGIN,
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
    expect(RUNWAY_CARD_SCALE).toBe(0.6);
    expect(RUNWAY_PITCH).toBe(190);
    expect(RUNWAY_CARD_DESIGN_WIDTH * RUNWAY_CARD_SCALE).toBe(180);
    expect(RUNWAY_PITCH).toBeGreaterThan(RUNWAY_CARD_DESIGN_WIDTH * RUNWAY_CARD_SCALE);
    expect(RUNWAY_CARD_HALF_HEIGHT).toBe(126);
    expect(RUNWAY_VIRTUAL_MARGIN).toBe(280);
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
