import { describe, expect, it } from 'vitest';
import { reasonUncastable } from '../../src/engine/actions';
import type { GameState } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * reasonUncastable() is the view-safe engine query behind the "why can't I play
 * this?" UI: given a hand index it returns one player-facing sentence, or null
 * when the card actually is playable. These specs pin the branch coverage the
 * dimmed-card feedback relies on (mana / target / speed / land-timing).
 */
describe('reasonUncastable', () => {
  it('returns null for a creature you can actually cast', () => {
    // bear = 1G; two forests cover it, no target needed → playable.
    const s = makeTestState({
      hands: [['bear'], []],
      battlefield: [
        { cardId: 'forest', controller: 0 },
        { cardId: 'forest', controller: 0 },
      ],
      active: 0,
    });
    expect(reasonUncastable(s, TEST_DB, 0, 0)).toBeNull();
  });

  it('reports missing mana in player-facing copy', () => {
    // bear = 1G with no lands in play → castBlockers "cannot pay cost".
    const s = makeTestState({ hands: [['bear'], []], active: 0 });
    expect(reasonUncastable(s, TEST_DB, 0, 0)).toBe('Not enough mana to cast this.');
  });

  it('reports the one-land-per-turn limit', () => {
    const s = makeTestState({ hands: [['forest'], []], active: 0 });
    s.players[0].landPlayedThisTurn = true;
    expect(reasonUncastable(s, TEST_DB, 0, 0)).toBe('You have already played a land this turn.');
  });

  it('explains sorcery-speed: a non-instant in a response window', () => {
    const s = makeTestState({ hands: [['bear'], []], active: 0 });
    s.awaiting = { player: 0, kind: 'respond', over: { type: 'attackers' } };
    expect(reasonUncastable(s, TEST_DB, 0, 0)).toBe('Only instants can be cast in response.');
  });

  it('reports when a targeted spell has no legal target', () => {
    // Giant Growth targets a creature; a lone forest pays for it but the empty
    // board offers nothing to target.
    const s = makeTestState({
      hands: [['growth'], []],
      battlefield: [{ cardId: 'forest', controller: 0 }],
      active: 0,
    });
    expect(reasonUncastable(s, TEST_DB, 0, 0)).toBe('There are no legal targets for this spell.');
  });

  it('returns null for an empty hand slot (nothing to explain)', () => {
    const s = makeTestState({ hands: [[], []], active: 0 });
    expect(reasonUncastable(s, TEST_DB, 0, 0)).toBeNull();
  });

  it("reports when it isn't your decision", () => {
    // Active player 0 holds priority; player 1's card cannot be acted on.
    const s: GameState = makeTestState({ hands: [[], ['bear']], active: 0 });
    expect(reasonUncastable(s, TEST_DB, 1, 0)).toBe("It isn't your turn to act.");
  });
});
