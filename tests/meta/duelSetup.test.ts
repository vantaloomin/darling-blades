import { describe, expect, it } from 'vitest';
import { practiceDuelLaunchData, resolveDuelDifficulty } from '../../src/meta/duelSetup';

describe('duel setup', () => {
  it('keeps the selected practice opponent when choosing a difficulty', () => {
    expect(practiceDuelLaunchData('artoria', 'medium')).toEqual({
      opponentId: 'artoria',
      difficulty: 'medium',
    });
  });

  it('lets an explicit practice difficulty override the avatar tower tier', () => {
    expect(resolveDuelDifficulty(undefined, 'medium', 'hard')).toBe('medium');
  });

  it('preserves replay authority and gauntlet avatar fallback', () => {
    expect(resolveDuelDifficulty('easy', 'medium', 'hard')).toBe('easy');
    expect(resolveDuelDifficulty(undefined, undefined, 'hard')).toBe('hard');
    expect(resolveDuelDifficulty(undefined, undefined, undefined)).toBe('easy');
  });
});
