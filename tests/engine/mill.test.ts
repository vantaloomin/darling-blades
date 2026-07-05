import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { drawCards } from '../../src/engine/phases';
import { makeTestState, TEST_DB } from '../helpers';

const ctx = { controller: 0 as const, sourceCardId: 'x', targets: [] };
const noEmit = () => {};

describe('mill op', () => {
  it('mills the top N of the opponent library into their graveyard', () => {
    const state = makeTestState({ active: 0 });
    state.players[1].library = ['bear', 'elf', 'giant', 'knight']; // top = last (knight)
    const ev: GameEvent[] = [];
    runOps(state, TEST_DB, (e) => ev.push(e), ctx, [{ op: 'mill', n: 2, who: 'opponent' }]);
    expect(state.players[1].library).toEqual(['bear', 'elf']);
    expect(state.players[1].graveyard).toEqual(['knight', 'giant']);
    expect(ev.filter((e) => e.e === 'milled')).toHaveLength(2);
  });

  it('mills your own library when who is self', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].library = ['bear', 'elf'];
    runOps(state, TEST_DB, noEmit, ctx, [{ op: 'mill', n: 1, who: 'self' }]);
    expect(state.players[0].library).toEqual(['bear']);
    expect(state.players[0].graveyard).toEqual(['elf']);
  });

  it('milling past an empty library is a safe no-op, not a loss', () => {
    const state = makeTestState({ active: 0 });
    state.players[1].library = ['bear'];
    runOps(state, TEST_DB, noEmit, ctx, [{ op: 'mill', n: 3, who: 'opponent' }]);
    expect(state.players[1].library).toEqual([]);
    expect(state.players[1].graveyard).toEqual(['bear']);
    expect(state.winner).toBeNull();
  });

  it('a milled-out player loses on their NEXT draw (deck-out), not on the mill', () => {
    const state = makeTestState({ active: 0 });
    state.players[1].library = [];
    drawCards(state, noEmit, 1, 1);
    expect(state.winner).toBe(0);
    expect(state.winReason).toBe('deck');
  });
});
