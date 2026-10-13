import { describe, expect, it } from 'vitest';
import { foldStoryMatrix, renderStoryMatrix, type StoryMatrixRun } from '../../src/meta/story/storyMatrix';

/** Hand-made runs over a 4-floor act (fight, fight, elite, boss). */
const RUNS: StoryMatrixRun[] = [
  // A clear: wins on every floor.
  {
    characterId: 'a', seed: 1, cleared: true, nodes: [
      { floor: 1, kind: 'fight', result: 'win', turns: 10, endReason: 'life' },
      { floor: 2, kind: 'event' },
      { floor: 3, kind: 'elite', result: 'win', turns: 12, endReason: 'deck' },
      { floor: 4, kind: 'boss', result: 'win', turns: 14, endReason: 'life' },
    ],
  },
  // Lost the boss to an empty deck.
  {
    characterId: 'a', seed: 2, cleared: false, nodes: [
      { floor: 1, kind: 'fight', result: 'win', turns: 8, endReason: 'life' },
      { floor: 2, kind: 'fight', result: 'win', turns: 9, endReason: 'life' },
      { floor: 3, kind: 'shop' },
      { floor: 4, kind: 'boss', result: 'loss', turns: 20, endReason: 'deck' },
    ],
  },
  // Lost the first fight on life; then an impossible seed.
  { characterId: 'a', seed: 3, cleared: false, nodes: [{ floor: 1, kind: 'fight', result: 'loss', turns: 7, endReason: 'life' }] },
  { characterId: 'a', seed: 4, error: { kind: 'hung', message: 'story duel (seed 9) did not finish in 40000 actions' } },
  // A second character, whose only run lost an elite to a turn limit.
  { characterId: 'b', seed: 1, cleared: false, nodes: [{ floor: 1, kind: 'elite', result: 'loss', turns: 30, endReason: 'turnLimit' }] },
];

describe('story matrix fold', () => {
  const [a, b] = foldStoryMatrix(RUNS, 4);

  it('reports each character separately, impossible seeds counted as runs but not as finished', () => {
    expect([a.characterId, b.characterId]).toEqual(['a', 'b']);
    expect(a).toMatchObject({ runs: 4, finished: 3, clears: 1 });
    expect(a.impossible).toEqual([{ seed: 4, kind: 'hung', message: 'story duel (seed 9) did not finish in 40000 actions' }]);
    expect(b).toMatchObject({ runs: 1, finished: 1, clears: 0, impossible: [] });
  });

  it('tallies duels overall and by node kind, ignoring non-duel nodes', () => {
    expect(a.duels).toEqual({ wins: 5, losses: 2 });
    expect(a.byKind).toEqual({ fight: { wins: 3, losses: 1 }, elite: { wins: 1, losses: 0 }, boss: { wins: 1, losses: 1 } });
    expect(b.byKind.elite).toEqual({ wins: 0, losses: 1 });
  });

  it('counts survival by floor and where each run was lost', () => {
    expect(a.reachedFloor).toEqual([3, 2, 2, 2]);
    expect(a.lostOnFloor).toEqual([1, 0, 0, 1]);
  });

  it('splits losses into life, deck and other, and averages turns over every duel', () => {
    expect(a.lossesBy).toEqual({ life: 1, deck: 1, other: 0 });
    expect(b.lossesBy).toEqual({ life: 0, deck: 0, other: 1 });
    expect(a.meanTurns).toBeCloseTo((10 + 12 + 14 + 8 + 9 + 20 + 7) / 7);
    expect(foldStoryMatrix([{ characterId: 'c', seed: 1, error: { kind: 'threw', message: 'x' } }], 4)[0].meanTurns).toBeNull();
  });

  it('names every impossible seed in the printed table', () => {
    const table = renderStoryMatrix([a, b], 4);
    expect(table).toContain('a seed 4 hung');
    expect(renderStoryMatrix([b], 1)).toContain('IMPOSSIBLE SEEDS: none.');
  });
});
