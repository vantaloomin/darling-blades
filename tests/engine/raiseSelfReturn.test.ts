import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { checkStateBased } from '../../src/engine/sba';
import { makeTestState } from '../helpers';

/**
 * A `dies` trigger that raises "the most-recently-buried creature" would pick
 * the card that just died, because it is already in the yard when the trigger
 * fires. That made the source unkillable by damage and destroy, and a second
 * copy under one controller looped the legend rule against the self-return
 * until `checkStateBased` gave up (a frozen duel).
 *
 * Found 2026-08-22 by the canonical progression sim, which crashed on the
 * limited-fan persona after Sands of the Duat went live: Sitra, Ferrywoman of
 * Two Rivers is the pool's only `dies: raise top` card and is legendary.
 * The rule is now Magic's: a raise never returns its own source.
 */
const SITRA = 'sd-sitra-ferrywoman-of-two-rivers';

describe('a dies-triggered raise never returns its own source', () => {
  it('lets a lone self-raiser stay dead when it takes lethal damage', () => {
    const state = makeTestState({
      battlefield: [{ iid: 101, cardId: SITRA, controller: 0, owner: 0, damage: 99 }],
    });

    checkStateBased(state, CARD_DB, () => {});

    expect(state.battlefield.filter((p) => p.cardId === SITRA)).toHaveLength(0);
    expect(state.players[0].graveyard).toContain(SITRA);
  });

  it('stabilizes with two copies under one controller (legend rule + self-raise)', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 201, cardId: SITRA, controller: 0, owner: 0 },
        { iid: 202, cardId: SITRA, controller: 0, owner: 0 },
      ],
    });

    expect(() => checkStateBased(state, CARD_DB, () => {})).not.toThrow();

    // The legend rule keeps the oldest; the duplicate's dies trigger finds no
    // OTHER creature in the yard, so it resolves to nothing and the board is
    // stable.
    expect(state.battlefield.filter((p) => p.cardId === SITRA)).toHaveLength(1);
    expect(state.battlefield[0].iid).toBe(201);
  });

  it('still raises a DIFFERENT creature buried under the source', () => {
    const state = makeTestState({
      battlefield: [{ iid: 301, cardId: SITRA, controller: 0, owner: 0, damage: 99 }],
    });
    // An older corpse the trigger may legally return.
    state.players[0].graveyard.push('bk-harpy-skirmisher');

    checkStateBased(state, CARD_DB, () => {});

    expect(state.battlefield.map((p) => p.cardId)).toContain('bk-harpy-skirmisher');
    expect(state.players[0].graveyard).toContain(SITRA);
  });
});
