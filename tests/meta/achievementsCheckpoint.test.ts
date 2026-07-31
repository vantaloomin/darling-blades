import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { checkpointAchievements } from '../../src/meta/achievementCheckpoint';
import { freshSave } from '../../src/meta/SaveManager';

describe('achievement checkpoints', () => {
  it('reports and latches only newly unlocked achievements', () => {
    const save = freshSave(0);
    save.stats.wins = 1;

    expect(checkpointAchievements(save, CARD_DB)).toEqual({
      changed: true,
      ids: ['first-win'],
    });
    expect(checkpointAchievements(save, CARD_DB)).toEqual({ changed: false, ids: [] });
  });
});
