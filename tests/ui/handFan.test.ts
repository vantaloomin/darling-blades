import { describe, expect, it } from 'vitest';
import { fanLayout, type FanOpts } from '../../src/ui/handFan';

// Defaults mirror DuelScene.syncHand(): baseScale 0.6, smallScale 0.52,
// shrinkBelowSpacing 78, maxSpacing 150, CARD_W 300. Span 760 is the
// reference span the shrink-boundary assertions below are computed against.
const OPTS: FanOpts = { span: 760, cardW: 300 };

describe('fanLayout', () => {
  it('n = 0 returns empty slots with finite scale/spacing', () => {
    const l = fanLayout(0, OPTS);
    expect(l.slots).toEqual([]);
    expect(l.spacing).toBe(0);
    expect(Number.isFinite(l.scale)).toBe(true);
    expect(l.scale).toBe(0.6);
  });

  it('n = 1 is a single centered flat slot at base scale', () => {
    const l = fanLayout(1, OPTS);
    expect(l.scale).toBe(0.6);
    expect(l.spacing).toBe(0);
    expect(l.slots).toEqual([{ dx: 0, dy: 0, angleDeg: 0 }]);
  });

  it.each([2, 3, 6, 7, 12])('n = %i is symmetric around the center', (n) => {
    const { slots } = fanLayout(n, OPTS);
    for (let i = 0; i < n; i++) {
      const a = slots[i];
      const b = slots[n - 1 - i];
      expect(a.dx).toBeCloseTo(-b.dx, 9); // dx antisymmetric
      expect(a.angleDeg).toBeCloseTo(-b.angleDeg, 9); // angle antisymmetric
      expect(a.dy).toBeCloseTo(b.dy, 9); // dy symmetric
    }
  });

  it.each([2, 5, 9, 15])('n = %i has strictly increasing dx and finite outputs', (n) => {
    const l = fanLayout(n, OPTS);
    expect(Number.isFinite(l.scale)).toBe(true);
    expect(Number.isFinite(l.spacing)).toBe(true);
    for (let i = 0; i < n; i++) {
      const s = l.slots[i];
      expect(Number.isFinite(s.dx)).toBe(true);
      expect(Number.isFinite(s.dy)).toBe(true);
      expect(Number.isFinite(s.angleDeg)).toBe(true);
      if (i > 0) expect(s.dx).toBeGreaterThan(l.slots[i - 1].dx);
    }
  });

  it('caps the tilt at ±maxAngleDeg for large hands', () => {
    const { slots } = fanLayout(15, OPTS);
    // Unclamped edge tilt would be (0 - 7) * 3 = -21deg.
    expect(slots[0].angleDeg).toBe(-10);
    expect(slots[14].angleDeg).toBe(10);
    for (const s of slots) expect(Math.abs(s.angleDeg)).toBeLessThanOrEqual(10);
    // Inside the clamp the per-card step is still 3deg.
    expect(slots[7].angleDeg).toBe(0);
    expect(slots[8].angleDeg).toBe(3);
  });

  it('never exceeds maxSpacing', () => {
    // n = 2 at span 760: raw spacing (760 - 180) / 1 = 580 -> capped at 150.
    expect(fanLayout(2, OPTS).spacing).toBe(150);
    for (let n = 2; n <= 20; n++) {
      expect(fanLayout(n, OPTS).spacing).toBeLessThanOrEqual(150);
    }
  });

  it('shrinks 0.6 -> 0.52 at exactly the same n as DuelScene for span 760', () => {
    // At scale 0.6: spacing(n) = min(150, (760 - 180) / (n - 1)) = 580 / (n - 1)
    // once below the cap. n = 8 -> 82.857 >= 78 (no shrink); n = 9 -> 72.5 < 78
    // (shrink, then spacing recomputed at 0.52: (760 - 156) / 8 = 75.5).
    const at8 = fanLayout(8, OPTS);
    expect(at8.scale).toBe(0.6);
    expect(at8.spacing).toBeCloseTo(580 / 7, 9);

    const at9 = fanLayout(9, OPTS);
    expect(at9.scale).toBe(0.52);
    expect(at9.spacing).toBeCloseTo(75.5, 9);
  });

  it('drops the edge cards by exactly arcDrop and keeps the center on the baseline', () => {
    const { slots } = fanLayout(7, OPTS);
    expect(slots[0].dy).toBe(16);
    expect(slots[6].dy).toBe(16);
    expect(slots[3].dy).toBe(0); // odd hand: exact center card sits flat
    for (const s of slots) {
      expect(s.dy).toBeGreaterThanOrEqual(0);
      expect(s.dy).toBeLessThanOrEqual(16);
    }
  });

  it('honors option overrides', () => {
    const l = fanLayout(5, {
      span: 760,
      cardW: 300,
      baseScale: 1,
      // maxSpacing 40 sits below the default shrink threshold (78), so turn
      // the shrink off to prove the threshold override is honored too.
      shrinkBelowSpacing: 0,
      maxSpacing: 40,
      maxAngleDeg: 4,
      anglePerCardDeg: 5,
      arcDrop: 30,
    });
    expect(l.scale).toBe(1);
    expect(l.spacing).toBe(40);
    expect(l.slots[0].angleDeg).toBe(-4); // (0 - 2) * 5 = -10 clamped to -4
    expect(l.slots[0].dy).toBe(30);
  });
});
