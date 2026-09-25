import { describe, expect, it } from 'vitest';
import { progressPercentLabel } from '../../src/ui/progressPercent';

/** A progress readout never claims a goal is done before it is. */
describe('progressPercentLabel', () => {
  it('shows 100% only for a completed goal', () => {
    expect(progressPercentLabel(199 / 200)).toBe('99%');
    expect(progressPercentLabel(0.999999)).toBe('99%');
    expect(progressPercentLabel(1)).toBe('100%');
    // Achievement status clamps at 1, but an over-full fraction is still done.
    expect(progressPercentLabel(1.2)).toBe('100%');
  });

  it('reads exact counts as their whole percent despite binary rounding', () => {
    // 0.29 * 100 is 28.999999999999996 in floating point.
    expect(progressPercentLabel(29 / 100)).toBe('29%');
    expect(progressPercentLabel(57 / 100)).toBe('57%');
    expect(progressPercentLabel(1 / 3)).toBe('33%');
    expect(progressPercentLabel(2 / 3)).toBe('66%');
  });

  it('shows 0% for no progress, and for a fraction that is not a number', () => {
    expect(progressPercentLabel(0)).toBe('0%');
    expect(progressPercentLabel(Number.NaN)).toBe('0%');
  });
});
