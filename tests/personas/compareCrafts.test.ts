import { describe, expect, it } from 'vitest';
import {
  armAccounting,
  compareCrafts,
  deckSurplus,
  type ComparedCraft,
} from '../../scripts/personas/compare-crafts';
import type { LeverLog } from '../../scripts/personas/lever';

/** A constructed craft: 40 cards, 14 matchups x 150 games, the given accepted swaps. */
function craft(options: {
  deck?: string[];
  accepted?: { iteration: number; out: string; in: string; nextScore: number }[];
  rejected?: number;
  score?: number;
  lever?: LeverLog;
  personaId?: string;
}): ComparedCraft {
  const score = options.score ?? 0.5;
  return {
    personaId: options.personaId ?? 'burn',
    round: 0,
    config: { seed: 13003, seeds: 150, ...(options.lever ? { race: { batch: 30, alpha: 0.01 } } : {}) },
    deck: options.deck ?? [...Array.from({ length: 36 }, (_, i) => `card-${i}`), 'x', 'x', 'y', 'z'],
    measured: {
      field: 'prefabs', seeds: 150, matchups: [], rowWins: Math.round(score * 2100), losses: 2100 - Math.round(score * 2100),
      draws: 0, games: 2100, score,
    },
    hillClimb: {
      initialList: [],
      initialScore: 0.4,
      acceptedSwaps: (options.accepted ?? []).map((swap) => ({
        ...swap, role: 'threats' as const, priorScore: 0.4, scoreDelta: swap.nextScore - 0.4,
      })),
      rejectedSwaps: options.rejected ?? 0,
      unproposedIterations: 0,
      ...(options.lever ? { lever: options.lever } : {}),
    },
  };
}

const swapA = { iteration: 2, out: 'card-1', in: 'x', nextScore: 0.45 };
const swapB = { iteration: 5, out: 'card-2', in: 'y', nextScore: 0.5 };

describe('comparing a raced craft with the unraced one', () => {
  it('counts deck differences with multiplicity', () => {
    expect(deckSurplus(['a', 'a', 'b', 'c'], ['a', 'b', 'b', 'c'])).toEqual(['a']);
    expect(deckSurplus(['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  it('charges an unraced arm a full measurement for the greedy build and every proposal', () => {
    // 2 accepted + 6 rejected = 8 proposals, 9 measurements of 2,100 games.
    const accounting = armAccounting(craft({ accepted: [swapA, swapB], rejected: 6 }));
    expect(accounting).toMatchObject({ proposed: 8, accepted: 2, hardGames: 18_900, unracedHardGames: 18_900, screenGames: 0 });
  });

  it('reads a levered arm\'s own journal', () => {
    const lever: LeverLog = {
      fullGames: 2100, initialHardGames: 2100, initialScreenGames: 2100,
      swaps: [
        { iteration: 1, out: 'a', in: 'b', stop: 'raced-out', accepted: false, hardGames: 420, screenGames: 2100, racedAt: 30, z: -3 },
        { iteration: 2, out: 'c', in: 'd', stop: 'screened-out', accepted: false, hardGames: 0, screenGames: 2100 },
      ],
    };
    expect(armAccounting(craft({ lever }))).toMatchObject({
      proposed: 2, racedOut: 1, screenedOut: 1, hardGames: 2520, screenGames: 6300, unracedHardGames: 6300,
    });
  });

  it('lines up accepted swaps by iteration and says which arms match once the lever keys are stripped', () => {
    const lever: LeverLog = { fullGames: 2100, initialHardGames: 2100, initialScreenGames: 0, swaps: [] };
    const plain = craft({ accepted: [swapA, swapB], rejected: 3 });
    const same = craft({ accepted: [swapA, swapB], rejected: 3, lever });
    const diverged = craft({
      accepted: [swapA], rejected: 4, score: 0.45, lever,
      deck: [...Array.from({ length: 36 }, (_, i) => `card-${i}`), 'x', 'x', 'q', 'z'],
    });
    const lines = compareCrafts([
      { label: 'plain', craft: plain }, { label: 'race', craft: same }, { label: 'race+screen', craft: diverged },
    ]);
    const row = (iteration: number): string | undefined => lines.find((line) => line.trim().startsWith(`${iteration}:`));
    expect(row(5)).toContain('card-2 -> y (50.0%) | card-2 -> y (50.0%) | -');
    expect(lines).toContain('  race: the same 40 cards');
    expect(lines).toContain('  race+screen: +q; -y');
    expect(lines).toContain('  race: yes');
    expect(lines).toContain('  race+screen: no');
  });

  it('refuses crafts of different personas', () => {
    expect(() => compareCrafts([
      { label: 'a', craft: craft({}) }, { label: 'b', craft: craft({ personaId: 'midrange' }) },
    ])).toThrow('is midrange round 0');
  });
});
