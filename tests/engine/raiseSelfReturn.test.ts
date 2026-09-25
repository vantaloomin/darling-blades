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

  // Owner ruling 2026-09-25. With a third copy on top of the yard, the
  // duplicate's return brought back a Sitra that died to the legend rule and
  // returned the other, forever.
  it('passes over a copy of a legend its controller still controls, and not otherwise', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 401, cardId: SITRA, controller: 0, owner: 0 },
        { iid: 402, cardId: SITRA, controller: 0, owner: 0 },
      ],
    });
    state.players[0].graveyard.push('bk-harpy-skirmisher', SITRA);
    const sitrasInYard = () => state.players[0].graveyard.filter((card) =>
      (typeof card === 'string' ? card : card.cardId) === SITRA).length;

    expect(() => checkStateBased(state, CARD_DB, () => {})).not.toThrow();
    // The duplicate died; its return passed over the third Sitra for the Harpy.
    expect(state.battlefield.map((p) => p.cardId)).toEqual([SITRA, 'bk-harpy-skirmisher']);
    expect(sitrasInYard()).toBe(2);

    // With no Sitra left on the battlefield, the next Sitra's death may
    // return another.
    state.battlefield.find((p) => p.iid === 401)!.damage = 99;
    checkStateBased(state, CARD_DB, () => {});
    expect(state.battlefield.map((p) => p.cardId).sort()).toEqual(['bk-harpy-skirmisher', SITRA].sort());
    expect(sitrasInYard()).toBe(2);
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
