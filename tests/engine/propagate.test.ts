import { describe, expect, it } from 'vitest';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import type { GameState, Permanent } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

/**
 * Propagate is one printed sentence: "put another mark on each marked permanent
 * you control." Each spec below pins exactly one clause of it, because every
 * clause was a deliberate choice — "marked" (it compounds, it never creates),
 * "permanent" (not creature), "you control" (no opponent's board), and the
 * absent target (so the AI has no decision to make).
 */

const ctx = { controller: 0 as const, sourceCardId: 'propagator', targets: [] };
const PROPAGATE = [{ op: 'propagate' as const }];

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
  it('changes nothing anywhere when you control no marked permanent', () => {
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

  it('gives each of three marked permanents exactly ONE more mark, not two', () => {
    const state = propagate([
      { iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 1 },
      { iid: 2, cardId: 'knight', controller: 0, plusOneCounters: 2 },
      { iid: 3, cardId: 'giant', controller: 0, plusOneCounters: 5 },
    ]);

    expect(marks(state)).toEqual({ 1: 2, 2: 3, 3: 6 });
  });

  it('never touches a permanent at zero marks, so it can create nothing', () => {
    const state = propagate([
      { iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 0 },
      { iid: 2, cardId: 'knight', controller: 0, plusOneCounters: 1 },
      { iid: 3, cardId: 'giant', controller: 0, plusOneCounters: 0 },
    ]);

    expect(marks(state)).toEqual({ 1: 0, 2: 2, 3: 0 });
  });

  it('leaves an opponent\'s marked permanent alone', () => {
    const state = propagate([
      { iid: 1, cardId: 'bear', controller: 0, plusOneCounters: 1 },
      { iid: 2, cardId: 'giant', controller: 1, plusOneCounters: 3 },
      { iid: 3, cardId: 'knight', controller: 1, plusOneCounters: 1 },
    ]);

    expect(marks(state)).toEqual({ 1: 2, 2: 3, 3: 1 });
  });

  it('grows a marked NON-creature permanent, because the word is "permanent"', () => {
    const state = propagate([
      { iid: 1, cardId: 'pacifism_aura', controller: 0, plusOneCounters: 1 },
      { iid: 2, cardId: 'forest', controller: 0, plusOneCounters: 2 },
      { iid: 3, cardId: 'bear', controller: 0, plusOneCounters: 1 },
    ]);

    expect(marks(state)).toEqual({ 1: 2, 2: 3, 3: 2 });
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

    // Marks are read back off the permanent, exactly as addCounters marks are,
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
    expect(marks(a)).toEqual({ 1: 2, 2: 0, 3: 3, 4: 3 });
  });

  it('compounds when run twice, doubling a single mark into three', () => {
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
});
