import { describe, expect, it } from 'vitest';
import { DROPS } from '../../src/config/rules';

/**
 * The ShopScene drop-rate panel (Feature 5) renders these tables verbatim, and
 * the pack roll consumes them as cumulative-weight walks over rngFloat()*100
 * (src/meta/variants.ts). Both are only correct if every axis sums to exactly
 * 100 — so this guards the displayed odds AND the roll against silent drift.
 */
describe('DROPS drop tables', () => {
  for (const axis of ['tier', 'frame', 'holo'] as const) {
    it(`${axis} weights sum to 100`, () => {
      const sum = DROPS[axis].reduce((total, [, weight]) => total + weight, 0);
      expect(sum).toBeCloseTo(100, 6);
    });
  }
});
