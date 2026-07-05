import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import type { TargetRef } from '../../src/engine/types';
import { def, isType } from '../../src/engine/types';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { RULES } from '../../src/config/rules';
import { makeTestState, TEST_DB } from '../helpers';

const graveTarget = (index: number): TargetRef => ({ kind: 'grave', player: 0, index });

describe('reanimate op', () => {
  it('returns a targeted creature from your graveyard to the battlefield, summoning-sick', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].graveyard = ['bear'];
    const ev: GameEvent[] = [];
    runOps(
      state,
      TEST_DB,
      (e) => ev.push(e),
      { controller: 0, sourceCardId: 'x', targets: [graveTarget(0)] },
      [{ op: 'reanimate' }],
    );
    const perm = state.battlefield.find((p) => p.cardId === 'bear');
    expect(perm).toBeDefined();
    expect(perm!.controller).toBe(0);
    expect(perm!.enteredThisTurn).toBe(true); // summoning-sick
    expect(state.players[0].graveyard).toEqual([]);
    expect(ev.some((e) => e.e === 'permanentEntered')).toBe(true);
    expect(ev.some((e) => e.e === 'tokenCreated')).toBe(false); // a real card, not a token
  });

  it('re-fires the reanimated creature ETB', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].graveyard = ['drainer']; // ETB: opponent loses 2, you gain 2
    runOps(
      state,
      TEST_DB,
      () => {},
      { controller: 0, sourceCardId: 'x', targets: [graveTarget(0)] },
      [{ op: 'reanimate' }],
    );
    expect(state.players[0].life).toBe(22);
    expect(state.players[1].life).toBe(18);
  });

  it("to:'top' returns the most-recently-buried creature with no target", () => {
    const state = makeTestState({ active: 0 });
    state.players[0].graveyard = ['bear', 'giant']; // giant buried last (on top)
    runOps(state, TEST_DB, () => {}, { controller: 0, sourceCardId: 'x', targets: [] }, [
      { op: 'reanimate', to: 'top' },
    ]);
    expect(state.battlefield.some((p) => p.cardId === 'giant')).toBe(true);
    expect(state.players[0].graveyard).toEqual(['bear']);
  });

  it("to:'top' skips non-creature cards in the graveyard", () => {
    const state = makeTestState({ active: 0 });
    state.players[0].graveyard = ['bear', 'shock']; // shock (instant) on top → skip to bear
    runOps(state, TEST_DB, () => {}, { controller: 0, sourceCardId: 'x', targets: [] }, [
      { op: 'reanimate', to: 'top' },
    ]);
    expect(state.battlefield.some((p) => p.cardId === 'bear')).toBe(true);
    expect(state.players[0].graveyard).toEqual(['shock']);
  });

  it('respects the creature cap as a no-op that leaves the card in the yard', () => {
    const battlefield = Array.from({ length: RULES.maxCreatures }, (_, i) => ({
      iid: i + 1,
      cardId: 'bear',
      controller: 0 as const,
    }));
    const state = makeTestState({ battlefield, active: 0 });
    state.players[0].graveyard = ['giant'];
    const ev: GameEvent[] = [];
    runOps(
      state,
      TEST_DB,
      (e) => ev.push(e),
      { controller: 0, sourceCardId: 'x', targets: [graveTarget(0)] },
      [{ op: 'reanimate' }],
    );
    const creatures = state.battlefield.filter(
      (p) => p.controller === 0 && isType(def(TEST_DB, p.cardId), 'creature'),
    );
    expect(creatures).toHaveLength(RULES.maxCreatures);
    expect(state.players[0].graveyard).toEqual(['giant']);
    expect(ev.some((e) => e.e === 'permanentEntered')).toBe(false);
  });
});
