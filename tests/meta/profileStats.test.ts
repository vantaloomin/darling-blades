import { describe, expect, it } from 'vitest';
import { computeDraftSummary, computeProfile, formatRate, winRate } from '../../src/meta/profileStats';
import type { LimitedHistoryEntry, LimitedState } from '../../src/meta/Limited';

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
      gauntlet: { run: null, bestRung: 4, completions: 1, clearStyles: { monoColor: 0, dualColor: 0 } },
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
      gauntlet: { run: null, bestRung: 0, completions: 0, clearStyles: { monoColor: 0, dualColor: 0 } },
    });
    expect(summary.winRate).toBeNull();
    expect(summary.byDifficulty.every((d) => d.rate === null)).toBe(true);
  });
});

/**
 * The Profile's Draft tab (1.6.3). Everything here already existed in the save;
 * the point of the pure summary is that "record" means COMPLETED runs only, so
 * an abandoned or in-flight draft can never inflate it.
 */
describe('computeDraftSummary', () => {
  function entry(over: Partial<LimitedHistoryEntry> = {}): LimitedHistoryEntry {
    return {
      id: 'r1',
      mode: 'draft',
      seed: 1,
      wins: 2,
      losses: 1,
      deckStyle: 'dual',
      completedAt: 0,
      rewardGold: 100,
      ...over,
    };
  }
  function state(over: Partial<LimitedState> = {}): LimitedState {
    return { activeRun: null, history: [], bestDraftWins: 0, personaSeen: {}, ...over };
  }

  it('reports an empty record without dividing by zero', () => {
    const s = computeDraftSummary(state());
    expect(s.runs).toBe(0);
    expect(s.winRate).toBeNull();
    expect(s.goldEarned).toBe(0);
    expect(s.personasMet).toBe(0);
    expect(s.runInProgress).toBe(false);
  });

  it('totals matches, gold and premium runs across completed runs', () => {
    const s = computeDraftSummary(state({
      history: [
        entry({ id: 'a', wins: 3, losses: 0, rewardGold: 300, premium: true }),
        entry({ id: 'b', wins: 1, losses: 2, rewardGold: 40 }),
      ],
      bestDraftWins: 3,
    }));
    expect(s.runs).toBe(2);
    expect(s.wins).toBe(4);
    expect(s.losses).toBe(2);
    expect(s.winRate).toBeCloseTo(4 / 6, 10);
    expect(s.bestWins).toBe(3);
    expect(s.perfectRuns).toBe(1);
    expect(s.goldEarned).toBe(340);
    expect(s.premiumRuns).toBe(1);
  });

  it('excludes an in-flight run from the record but reports that one is running', () => {
    const s = computeDraftSummary(state({
      history: [entry({ wins: 3, losses: 0 })],
      activeRun: { mode: 'draft' } as LimitedState['activeRun'],
    }));
    expect(s.runs).toBe(1);
    expect(s.wins).toBe(3);
    expect(s.runInProgress).toBe(true);
  });

  it('ignores legacy sealed rows, which are retained only for lossless saves', () => {
    const s = computeDraftSummary(state({
      history: [
        entry({ id: 'draft', wins: 2, losses: 1, rewardGold: 100 }),
        { ...entry({ id: 'sealed', wins: 3, losses: 0, rewardGold: 999 }), mode: 'sealed' },
      ],
    }));
    expect(s.runs).toBe(1);
    expect(s.wins).toBe(2);
    expect(s.goldEarned).toBe(100);
  });

  it('orders deck styles most-built first, with a stable tiebreak', () => {
    const s = computeDraftSummary(state({
      history: [
        entry({ id: '1', deckStyle: 'other' }),
        entry({ id: '2', deckStyle: 'other' }),
        entry({ id: '3', deckStyle: 'mono' }),
      ],
    }));
    expect(s.byDeckStyle[0]).toEqual({ key: 'other', runs: 2 });
    // mono before dual on a 1-vs-0 tie is the declared order, not chance.
    expect(s.byDeckStyle.map((d) => d.key)).toEqual(['other', 'mono', 'dual']);
  });

  it('counts only personas actually drafted against', () => {
    const s = computeDraftSummary(state({ personaSeen: { a: 2, b: 0, c: 1 } }));
    expect(s.personasMet).toBe(2);
  });
});
