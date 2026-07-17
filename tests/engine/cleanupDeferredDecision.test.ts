import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import type { CardDb } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * Regression pin for the 2026-07-16 prefab mass-sim crash (seed 4000600333):
 * a foresee cast in the OPPONENT'S end-step window queues a deferred decision
 * that is raised over the active player's cleanup discardToHandSize prompt.
 * Resolving the foresee then rejoined play via resumeAfterFlush at
 * step 'cleanup', which had no case and threw
 * "resumeAfterFlush: unexpected step cleanup". The fix rejoins cleanup
 * (resumeCleanup), re-raising the discard or finishing the turn.
 */
const DB: CardDb = {
  ...TEST_DB,
  foresee_charm: {
    id: 'foresee_charm',
    name: 'Glimpse the Weave',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 0, pips: { U: 1 } },
    colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 2 }] }],
    rarity: 'c',
  },
};

function setup(p0HandSize: number): Game {
  const state = makeTestState({
    // p1 needs untapped blue mana to cast the charm in the end-step window.
    battlefield: [{ iid: 900, cardId: 'island', controller: 1 }],
    hands: [Array(p0HandSize).fill('bear'), ['foresee_charm']],
    active: 0,
  });
  // A real deck so the foresee has cards to view and the next turn can draw.
  state.players[1].deck = ['bear', 'elf', 'giant', 'forest'];
  state.players[0].deck = ['forest', 'forest'];
  return Game.restore(state, DB);
}

/** main1 → (empty combat) → main2 → end step, where p1's charm opens the window. */
function passToEndStep(game: Game): void {
  game.submit(0, { type: 'passStep' });
  game.submit(0, { type: 'declareAttackers', attackers: [] });
  game.submit(0, { type: 'passStep' });
  expect(game.awaiting).toMatchObject({ player: 1, kind: 'endStepWindow' });
}

describe('deferred decision raised over the cleanup discard (playtest mass-sim pin)', () => {
  it('re-raises the discard after an end-step-window foresee resolves', () => {
    const game = setup(9); // two over the 7-card limit at cleanup
    passToEndStep(game);

    // Casting the foresee charm resolves the stack (p0 holds no instants, so
    // no response window), queues the foresee, and play rolls into cleanup
    // where p0 owes a discard; the raised foresee clobbers that prompt.
    game.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ player: 1, kind: 'foresee' });
    expect(game.state.step).toBe('cleanup');

    // Pre-fix this submit threw "resumeAfterFlush: unexpected step cleanup".
    game.submit(1, { type: 'foresee', bottomIndices: [0] });

    // The discard prompt is back with the correct overage.
    expect(game.awaiting).toMatchObject({ player: 0, kind: 'discardToHandSize', count: 2 });
    expect(game.state.step).toBe('cleanup');

    // Discarding finishes cleanup and hands the turn to p1.
    game.submit(0, { type: 'discard', handIndices: [0, 1] });
    expect(game.state.turn).toBe(4);
    expect(game.state.activePlayer).toBe(1);
    expect(game.state.winner).toBeNull();
  });

  it('finishes the turn directly when no discard is owed', () => {
    const game = setup(3); // under the hand limit; cleanup owes nothing
    passToEndStep(game);
    game.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ player: 1, kind: 'foresee' });

    game.submit(1, { type: 'foresee', bottomIndices: [] });
    expect(game.state.turn).toBe(4);
    expect(game.state.activePlayer).toBe(1);
    expect(game.state.winner).toBeNull();
  });
});
