import { describe, expect, it } from 'vitest';
import { computeProfile, formatRate, winRate } from '../../src/meta/profileStats';

/** The ProfileScene renders career stats; this pins the pure win-rate math. */
describe('profileStats', () => {
  it('winRate returns the fraction, or null with no games (no divide-by-zero)', () => {
    expect(winRate(0, 0)).toBeNull();
    expect(winRate(3, 1)).toBe(0.75);
    expect(winRate(1, 2)).toBeCloseTo(1 / 3, 10);
    expect(winRate(5, 0)).toBe(1);
  });

  it('formatRate renders a rounded percent, or an em dash for null', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(2 / 3)).toBe('67%');
    expect(formatRate(1)).toBe('100%');
  });

  it('computeProfile folds stats + gauntlet into a display summary', () => {
    const summary = computeProfile({
      stats: {
        wins: 10,
        losses: 5,
        byDifficulty: { easy: { w: 2, l: 1 }, medium: { w: 3, l: 2 }, hard: { w: 5, l: 2 } },
        packsOpened: 12,
        lastWinDay: null,
      },
      gauntlet: { run: null, bestRung: 4, completions: 1 },
    });

    expect(summary.games).toBe(15);
    expect(summary.winRate).toBeCloseTo(10 / 15, 10);
    expect(summary.packsOpened).toBe(12);
    expect(summary.bestRung).toBe(4);
    expect(summary.completions).toBe(1);
    // by-difficulty preserves easy→medium→hard order with per-tier rates
    expect(summary.byDifficulty.map((d) => d.key)).toEqual(['easy', 'medium', 'hard']);
    expect(summary.byDifficulty[2]).toEqual({ key: 'hard', w: 5, l: 2, rate: 5 / 7 });
  });

  it('computeProfile handles a fresh save (no games) without dividing by zero', () => {
    const summary = computeProfile({
      stats: {
        wins: 0,
        losses: 0,
        byDifficulty: { easy: { w: 0, l: 0 }, medium: { w: 0, l: 0 }, hard: { w: 0, l: 0 } },
        packsOpened: 0,
        lastWinDay: null,
      },
      gauntlet: { run: null, bestRung: 0, completions: 0 },
    });
    expect(summary.winRate).toBeNull();
    expect(summary.byDifficulty.every((d) => d.rate === null)).toBe(true);
  });
});
