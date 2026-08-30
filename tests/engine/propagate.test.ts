import { describe, expect, it } from 'vitest';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { Game } from '../../src/engine/Game';
import { getEffectiveStats } from '../../src/engine/statics';
import type { CardDb, GameState, Permanent } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * Propagate is one printed sentence: "put another Mark on each Marked creature
 * you control." Each spec below pins exactly one clause of it, because every
 * clause was a deliberate choice: "Marked" (it compounds, it never creates),
 * "creature" (noncreature permanents cannot carry marks), "you control" (no opponent's board), and the
 * absent target (so the AI has no decision to make).
 */

const ctx = { controller: 0 as const, sourceCardId: 'propagator', targets: [] };
const PROPAGATE = [{ op: 'propagate' as const }];
const CROSS_MECHANIC_DB: CardDb = {
  ...TEST_DB,
  nine_lives: {
    ...TEST_DB.bear,
    id: 'nine_lives',
    name: 'Nine Lives',
    nineLives: true,
  },
  foresee_propagate: {
    id: 'foresee_propagate',
    name: 'Foresee and Propagate',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    abilities: [{
      when: 'spell',
      ops: [{ op: 'foresee', n: 1 }, { op: 'propagate' }],
    }],
    rarity: 'c',
  },
};

/** Marks on the battlefield, keyed by iid, for compact whole-board assertions. */
function marks(state: GameState): Record<number, number> {
  return Object.fromEntries(state.battlefield.map((p) => [p.iid, p.plusOneCounters]));
}

function propagate(battlefield: Partial<Permanent>[]): GameState {
  const state = makeTestState({ battlefield, active: 0 });
  runOps(state, TEST_DB, () => {}, ctx, PROPAGATE);
  return state;
}

describe('propagate', () => {
  it('changes nothing anywhere when you control no Marked creature', () => {
    const before = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 0 },
        { iid: 2, cardId: 'knight', controller: 0, plusOneCounters: 0 },
        { iid: 3, cardId: 'giant', controller: 1, plusOneCounters: 4 },
      ],
      active: 0,
    });
    const after = structuredClone(before);

    runOps(after, TEST_DB, () => {}, ctx, PROPAGATE);

    expect(after).toEqual(before);
  });

  it('gives each of three Marked creatures exactly ONE more Mark, not two', () => {
    const state = propagate([
      { iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 1 },
      { iid: 2, cardId: 'knight', controller: 0, plusOneCounters: 2 },
      { iid: 3, cardId: 'giant', controller: 0, plusOneCounters: 5 },
    ]);

    expect(marks(state)).toEqual({ 1: 2, 2: 3, 3: 6 });
  });

  it('never touches a creature at zero Marks, so it can create nothing', () => {
    const state = propagate([
      { iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 0 },
      { iid: 2, cardId: 'knight', controller: 0, plusOneCounters: 1 },
      { iid: 3, cardId: 'giant', controller: 0, plusOneCounters: 0 },
    ]);

    expect(marks(state)).toEqual({ 1: 0, 2: 2, 3: 0 });
  });

  it('leaves an opponent\'s Marked creature alone', () => {
    const state = propagate([
      { iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 1 },
      { iid: 2, cardId: 'giant', controller: 1, plusOneCounters: 3 },
      { iid: 3, cardId: 'knight', controller: 1, plusOneCounters: 1 },
    ]);

    expect(marks(state)).toEqual({ 1: 2, 2: 3, 3: 1 });
  });

  it('does not grow marked noncreature permanents', () => {
    const state = propagate([
      { iid: 1, cardId: 'pacifism_aura', controller: 0, plusOneCounters: 1 },
      { iid: 2, cardId: 'forest', controller: 0, plusOneCounters: 2 },
      { iid: 3, cardId: 'bear', controller: 0, plusOneCounters: 1 },
    ]);

    expect(marks(state)).toEqual({ 1: 1, 2: 2, 3: 2 });
    expect(getEffectiveStats(state.battlefield, TEST_DB, 1)).toMatchObject({ attack: 0, defense: 0 });
  });

  it('takes no target, so it is legal as a Foresee continuation', () => {
    const state = makeTestState({
      battlefield: [{ iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 1 }],
      active: 0,
    });
    state.players[0].deck = ['bear', 'knight'];

    expect(() => runOps(state, TEST_DB, () => {}, ctx, [
      { op: 'foresee', n: 1 },
      { op: 'propagate' },
    ])).not.toThrow();
    expect(state.pendingDecisions).toEqual([{
      kind: 'foresee',
      player: 0,
      n: 1,
      thenOps: [{ op: 'propagate' }],
    }]);
  });

  it('logs only the generic effectApplied, adding no bespoke event', () => {
    const state = makeTestState({
      battlefield: [{ iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 1 }],
      active: 0,
    });
    const events: unknown[] = [];

    runOps(state, TEST_DB, (e) => events.push(e), ctx, PROPAGATE);

    // Marks are read back off the creature, exactly as addCounters marks are,
    // so presentation needs no new event to animate the change.
    expect(events).toEqual([{ e: 'effectApplied', op: 'propagate' }]);
    expect(state.battlefield[0].plusOneCounters).toBe(2);
  });

  it('still logs effectApplied when the board has nothing marked to grow', () => {
    const state = makeTestState({
      battlefield: [{ iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 0 }],
      active: 0,
    });
    const events: unknown[] = [];

    runOps(state, TEST_DB, (e) => events.push(e), ctx, PROPAGATE);

    expect(events).toEqual([{ e: 'effectApplied', op: 'propagate' }]);
    expect(state.battlefield[0].plusOneCounters).toBe(0);
  });

  it('is deterministic across two identical runs', () => {
    const board = (): Partial<Permanent>[] => [
      { iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 1 },
      { iid: 2, cardId: 'knight', controller: 0, plusOneCounters: 0 },
      { iid: 3, cardId: 'pacifism_aura', controller: 0, plusOneCounters: 2 },
      { iid: 4, cardId: 'giant', controller: 1, plusOneCounters: 3 },
    ];
    const a = propagate(board());
    const b = propagate(board());

    expect(structuredClone(a.battlefield)).toEqual(structuredClone(b.battlefield));
    expect(marks(a)).toEqual({ 1: 2, 2: 0, 3: 2, 4: 3 });
  });

  it('compounds when run twice, doubling a single Mark into three', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 1 },
        { iid: 2, cardId: 'knight', controller: 0, plusOneCounters: 0 },
      ],
      active: 0,
    });

    runOps(state, TEST_DB, () => {}, ctx, PROPAGATE);
    runOps(state, TEST_DB, () => {}, ctx, PROPAGATE);

    // The unmarked body stays unmarked no matter how often Propagate runs.
    expect(marks(state)).toEqual({ 1: 3, 2: 0 });
  });

  it('follows control, not ownership, when a permanent has been stolen', () => {
    const state = propagate([
      { iid: 1, cardId: 'bear', owner: 1, controller: 0, plusOneCounters: 1 },
      { iid: 2, cardId: 'giant', owner: 0, controller: 1, plusOneCounters: 1 },
    ]);

    expect(marks(state)).toEqual({ 1: 2, 2: 1 });
  });

  it('preserves Nine Lives semantics across Propagate for unmarked and marked creatures', () => {
    const unmarkedGame = Game.restore(
      makeTestState({ battlefield: [{ iid: 1, cardId: 'nine_lives', controller: 0, plusOneCounters: 0 }] }),
      CROSS_MECHANIC_DB,
    );
    const unmarked = unmarkedGame.instanceState;
    runOps(unmarked, CROSS_MECHANIC_DB, () => {}, ctx, PROPAGATE);
    expect(unmarked.battlefield[0].plusOneCounters).toBe(0);

    runOps(unmarked, CROSS_MECHANIC_DB, () => {}, ctx, [{ op: 'massDestroy', filter: 'allCreatures' }]);
    expect(unmarked.battlefield.find((perm) => perm.cardId === 'nine_lives')?.plusOneCounters).toBe(1);
    expect(unmarked.players[0].graveyard).toHaveLength(0);

    const markedGame = Game.restore(
      makeTestState({ battlefield: [{ iid: 1, cardId: 'nine_lives', controller: 0, plusOneCounters: 1 }] }),
      CROSS_MECHANIC_DB,
    );
    const marked = markedGame.instanceState;
    runOps(marked, CROSS_MECHANIC_DB, () => {}, ctx, PROPAGATE);
    expect(marked.battlefield[0].plusOneCounters).toBe(2);

    runOps(marked, CROSS_MECHANIC_DB, () => {}, ctx, [{ op: 'massDestroy', filter: 'allCreatures' }]);
    expect(marked.battlefield).toEqual([]);
    expect(marked.players[0].graveyard).toHaveLength(1);
  });

  it('resumes a Foresee continuation through Game and lands Propagate marks', () => {
    const state = makeTestState({
      hands: [['foresee_propagate'], []],
      battlefield: [{ iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 1 }],
      active: 0,
    });
    state.players[0].deck = ['bear', 'knight'];
    const game = Game.restore(state, CROSS_MECHANIC_DB);

    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ player: 0, kind: 'foresee' });
    expect(game.instanceState.pendingDecisions).toEqual([{ kind: 'foresee', player: 0, n: 1, thenOps: PROPAGATE }]);

    game.submit(0, { type: 'foresee', bottomIndices: [] });

    expect(game.instanceState.battlefield.find((perm) => perm.iid === 1)?.plusOneCounters).toBe(2);
    expect(game.instanceState.pendingDecisions).toEqual([]);
    expect(game.awaiting).toEqual({ player: 0, kind: 'main' });
  });
});
