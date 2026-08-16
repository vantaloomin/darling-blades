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
  RUNWAY_GATE_X,
  RUNWAY_INERTIA,
  RUNWAY_PITCH,
  virtualRange,
} from '../../src/ui/packRunwayPresentation';

const t = (tier: 'c' | 'r' | 'sr' | 'ssr' | 'ur', id: number): { tier: typeof tier; id: number } => ({ tier, id });

describe('runwayOrder', () => {
  it('sorts ascending by rarity, stable within a tier', () => {
    const cards = [t('sr', 1), t('c', 2), t('ur', 3), t('c', 4), t('r', 5), t('ssr', 6)];
    expect(runwayOrder(cards).map((c) => c.id)).toEqual([2, 4, 5, 1, 6, 3]);
  });
});

describe('rail geometry', () => {
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
