import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { Game } from '../../src/engine/Game';
import { makeTestState, TEST_DB } from '../helpers';

const ctx = { controller: 0 as const, sourceCardId: 'x', targets: [] };

describe('fetchLand — basic-land choice', () => {
  it('with ≤1 distinct basic type, fetches the topmost basic immediately (no choice)', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].deck = ['forest', 'bear', 'forest']; // one distinct basic type
    const ev: GameEvent[] = [];
    runOps(state, TEST_DB, (e) => ev.push(e), ctx, [{ op: 'fetchLand' }]);

    const perm = state.battlefield.find((p) => p.cardId === 'forest');
    expect(perm).toBeDefined();
    expect(perm!.tapped).toBe(true); // enters tapped
    expect(state.pendingFetch).toEqual([]); // no deferral
    expect(ev.some((e) => e.e === 'permanentEntered')).toBe(true);
    expect(state.players[0].deck.filter((c) => c === 'forest')).toHaveLength(1); // one fetched
  });

  it('with >1 distinct basic type, defers the fetch and touches nothing yet', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].deck = ['forest', 'swamp', 'bear'];
    const before = [...state.players[0].deck];
    runOps(state, TEST_DB, () => {}, ctx, [{ op: 'fetchLand' }]);

    expect(state.pendingFetch).toEqual([0]); // controller queued
    expect(state.players[0].deck).toEqual(before); // no fetch, no shuffle
    expect(state.battlefield.some((p) => p.cardId === 'forest' || p.cardId === 'swamp')).toBe(false);
  });

  it('with no basics, is a silent no-op (no fetch, no deferral)', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].deck = ['bear', 'giant'];
    runOps(state, TEST_DB, () => {}, ctx, [{ op: 'fetchLand' }]);
    expect(state.pendingFetch).toEqual([]);
    expect(state.battlefield).toHaveLength(0);
  });

  it('surfaces one legal choice per distinct basic (stable sorted order) and fetches the chosen one', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].deck = ['forest', 'swamp', 'bear', 'forest'];
    state.pendingFetch = [0];
    state.awaiting = { player: 0, kind: 'chooseBasicLand' };
    const game = Game.restore(state, TEST_DB);

    const choices = game
      .legalActions(0)
      .filter((a): a is Extract<typeof a, { type: 'chooseBasicLand' }> => a.type === 'chooseBasicLand');
    expect(choices.map((c) => c.cardId)).toEqual(['forest', 'swamp']); // deduped + sorted

    game.submit(0, { type: 'chooseBasicLand', cardId: 'swamp' });
    const st = game.state;
    const swamp = st.battlefield.find((p) => p.cardId === 'swamp');
    expect(swamp).toBeDefined();
    expect(swamp!.tapped).toBe(true);
    expect(st.players[0].deck).toContain('forest'); // the untaken basic stays in the deck
    expect(st.players[0].deck).not.toContain('swamp');
    expect(st.pendingFetch).toEqual([]);
    expect(st.awaiting.kind).toBe('main'); // play resumes
  });

  it('rejects an illegal basic choice (not in deck / not a basic)', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].deck = ['forest', 'swamp', 'bear'];
    state.pendingFetch = [0];
    state.awaiting = { player: 0, kind: 'chooseBasicLand' };
    const game = Game.restore(state, TEST_DB);
    expect(() => game.submit(0, { type: 'chooseBasicLand', cardId: 'bear' })).toThrow(); // not a basic
    expect(() => game.submit(0, { type: 'chooseBasicLand', cardId: 'island' })).toThrow(); // not in deck
  });

  it('resolves identically from identical states + the same choice (determinism)', () => {
    const mk = (): Game => {
      const state = makeTestState({ active: 0 });
      state.players[0].deck = ['forest', 'swamp', 'bear', 'forest', 'swamp'];
      state.pendingFetch = [0];
      state.awaiting = { player: 0, kind: 'chooseBasicLand' };
      return Game.restore(state, TEST_DB);
    };
    const a = mk();
    const b = mk();
    a.submit(0, { type: 'chooseBasicLand', cardId: 'forest' });
    b.submit(0, { type: 'chooseBasicLand', cardId: 'forest' });
    // same reshuffle (same seeded rng) → identical resulting deck order + board
    expect(a.state.players[0].deck).toEqual(b.state.players[0].deck);
    expect(a.state.battlefield.map((p) => p.cardId)).toEqual(b.state.battlefield.map((p) => p.cardId));
  });
});
