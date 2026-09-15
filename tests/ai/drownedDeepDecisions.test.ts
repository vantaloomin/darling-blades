import { describe, expect, it, vi } from 'vitest';
import { HardAI } from '../../src/ai/HardAI';
import { determinize, simDb } from '../../src/ai/determinize';
import { MediumAI } from '../../src/ai/MediumAI';
import type { Action } from '../../src/engine/actions';
import { validateAction } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { PlayerView } from '../../src/engine/view';
import { DB, body, brain, difficulties, gameWith, stateWith } from './drownedDeepFixture';

type Search = {
  aggregateOutcome(view: PlayerView, actions: Action[]): { score: number; wonAll: boolean; lostAny: boolean } | null;
  simulateOutcome(view: PlayerView, actions: Action[], seed: number): { score: number; won: boolean; lost: boolean } | null;
};

describe('Drowned Deep deferred choices in every brain', () => {
  it.each(difficulties)('%s resolves loot under the activating seat and resumes the ordered lethal tail', (name) => {
    const game = gameWith(['bear', 'costly'], [body(10, 'loot_win')]);
    game.submit(0, { type: 'activate', iid: 10 });
    expect(game.awaiting).toMatchObject({ kind: 'discardToHandSize', decision: 'discard', player: 0, count: 1 });
    const action = brain(name).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toEqual({ type: 'discard', handIndices: [1] });
    game.submit(0, action);
    expect(game.state.winner).toBe(0);
  });
  it.each(difficulties)('%s sacrifices for the opponent seat and never feeds its best body', (name) => {
    const game = gameWith(['edict'], [body(10, 'giant', 1), body(11, 'tiny', 1)]);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', decision: 'sacrifice', player: 1 });
    const action = brain(name).chooseAction(game.viewFor(1), game.legalActions(1));
    expect(action).toEqual({ type: 'chooseTarget', target: { kind: 'permanent', iid: 11 } });
    game.submit(1, action);
    expect(game.state.battlefield.map((perm) => perm.iid)).toContain(10);
    expect(game.state.battlefield.map((perm) => perm.iid)).not.toContain(11);
  });
  it.each(difficulties)('%s retains a queued attack target policy after the source leaves the battlefield', (name) => {
    const state = stateWith([], [body(11, 'bear'), body(12, 'bear', 1)]);
    state.pendingDecisions = [{ kind: 'chooseTarget', player: 0, sourceIid: 10, sourceCardId: 'attack_ping', abilityIndex: 0,
      spec: { what: 'creature' }, ops: [{ op: 'damage', n: 2, to: 'target' }], triggerWhen: 'attacks' }];
    state.awaiting = { kind: 'chooseTarget', player: 0, sourceIid: 10, abilityIndex: 0,
      targets: [{ kind: 'permanent', iid: 11 }, { kind: 'permanent', iid: 12 }] };
    const game = Game.restore(state, DB);
    expect(brain(name).chooseAction(game.viewFor(0), game.legalActions(0))).toEqual({ type: 'chooseTarget', target: { kind: 'permanent', iid: 12 } });
  });
  it.each(difficulties)('%s prices mandatory targeted attack and Dawn triggers from their original ability', (name) => {
    for (const [cardId, triggerWhen, expected] of [['attack_ping', 'attacks', 12], ['mark_dawn', 'dawn', 11]] as const) {
      const state = stateWith([], [body(10, cardId), body(11, 'giant'), body(12, 'bear', 1)]);
      const ability = DB[cardId].abilities![0];
      state.pendingDecisions = [{ kind: 'chooseTarget', player: 0, sourceIid: 10, sourceCardId: cardId,
        abilityIndex: 0, spec: ability.targets![0], ops: ability.ops!, triggerWhen }];
      state.awaiting = { kind: 'chooseTarget', player: 0, sourceIid: 10, abilityIndex: 0,
        targets: [10, 11, ...(triggerWhen === 'attacks' ? [12] : [])].map((iid) => ({ kind: 'permanent', iid })) };
      const game = Game.restore(state, DB);
      for (const seed of [7, 41, 83]) {
        const action = brain(name, seed).chooseAction(game.viewFor(0), game.legalActions(0));
        expect(action).toEqual({ type: 'chooseTarget', target: { kind: 'permanent', iid: expected } });
        expect(validateAction(game.instanceState, DB, 0, action)).toBeNull();
      }
    }
  });
});

describe('Drowned Deep honest determinization and Hard whitelists', () => {
  it('caches simulation databases by actual input identity without conflating fixture pools', () => {
    expect(simDb(DB)).toBe(simDb(DB));
    expect(simDb(simDb(DB))).toBe(simDb(DB));
    const other = { ...DB, fixture_only: { ...DB.bear, id: 'fixture_only' } };
    expect(simDb(other)).not.toBe(simDb(DB));
    expect(simDb(DB).fixture_only).toBeUndefined();
    expect(simDb(other).fixture_only).toBe(other.fixture_only);
  });
  it('copies a loot continuation without exposing the opponent hand or either deck', () => {
    const state = stateWith(['bear', 'costly'], [body(10, 'loot_win')]);
    state.players[1].hand = ['costly_red'];
    const game = Game.restore(state, DB);
    game.submit(0, { type: 'activate', iid: 10 });
    const view = game.viewFor(0);
    expect(view.pendingDecisions?.[0].kind).toBe('discard');
    expect(view.opp).not.toHaveProperty('hand');
    expect(view.you).not.toHaveProperty('deck');
    const before = structuredClone(view);
    const a = determinize(view, DB, 83);
    const b = determinize(view, DB, 83);
    expect(a.instanceState).toEqual(b.instanceState);
    expect(a.state.players[1].hand).toEqual(['__unknown_c3']);
    const choice = brain('Medium').chooseAction(a.viewFor(0), a.legalActions(0));
    a.submit(0, choice);
    expect(a.state.winner).toBe(0);
    expect(view).toEqual(before);
  });
  it('restores known Foresee cards only to the looking seat and preserves the loot continuation', () => {
    const game = gameWith(['costly'], [body(10, 'foresee_loot')]);
    game.state.players[0].deck = ['bear', 'costly_red', 'bear'];
    game.submit(0, { type: 'activate', iid: 10 });
    expect(game.awaiting.kind).toBe('foresee');
    const own = determinize(game.viewFor(0), DB, 7);
    expect(own.viewFor(0).awaiting).toEqual(game.viewFor(0).awaiting);
    const enemy = determinize(game.viewFor(1), DB, 7);
    expect(enemy.viewFor(0).awaiting).toMatchObject({ kind: 'foresee', cards: ['__unknown_c3', '__unknown_c3'] });
    own.submit(0, { type: 'foresee', bottomIndices: [] });
    expect(own.awaiting).toMatchObject({ kind: 'discardToHandSize', decision: 'discard' });
  });
  it('preserves the exact public graveyard instance consumed by a queued self-reclaim', () => {
    const state = stateWith(['forest']);
    state.players[0].graveyard = [
      { cardId: 'bear', instanceId: 101, variantKey: null },
      { cardId: 'bear', instanceId: 102, variantKey: null },
    ];
    state.pendingDecisions = [{ kind: 'discard', player: 0, n: 1, continuations: [{
      context: { controller: 0, sourceCardId: 'bear', sourceIid: 10, targets: [],
        selfGraveExclusion: { instanceId: 101, cardId: 'bear', owner: 0 } },
      ops: [{ op: 'reclaimSelf' }],
    }] }];
    state.awaiting = { kind: 'discardToHandSize', decision: 'discard', player: 0, count: 1 };
    const original = Game.restore(state, DB);
    const sim = determinize(original.viewFor(0), DB, 41);
    expect(sim.viewFor(0).you.graveyardInstances).toEqual([101, 102]);
    sim.submit(0, { type: 'discard', handIndices: [0] });
    expect(sim.state.players[0].hand).toEqual(['bear']);
    expect(sim.instanceState.players[0].graveyard.some((card) => typeof card !== 'string' && card.instanceId === 102)).toBe(true);
    expect(sim.instanceState.players[0].graveyard.some((card) => typeof card !== 'string' && card.instanceId === 101)).toBe(false);
  });
  it('retains a suspended stack flush through a determinized loot decision', () => {
    const state = stateWith(['forest']);
    state.stackClosed = true;
    state.stack = [{ sid: 1, cardId: 'lower_burn', controller: 0, targets: [] }];
    state.pendingDecisions = [{ kind: 'discard', player: 0, n: 1, continuations: [] }];
    state.awaiting = { kind: 'discardToHandSize', decision: 'discard', player: 0, count: 1 };
    const original = Game.restore(state, DB);
    const view = original.viewFor(0);
    expect(view.stackClosed).toBe(true);
    const sim = determinize(view, DB, 41);
    expect(sim.instanceState.stackClosed).toBe(true);
    sim.submit(0, { type: 'discard', handIndices: [0] });
    expect(sim.state.players[1].life).toBe(17);
    expect(sim.state.stack).toEqual([]);
  });
  it('Hard settles its own loot and the opponent edict before evaluating terminal outcomes', () => {
    const hard = new HardAI(DB) as unknown as Search;
    const own = gameWith(['costly'], [body(10, 'loot_win')]);
    expect(hard.simulateOutcome(own.viewFor(0), [{ type: 'activate', iid: 10 }], 1)).toMatchObject({ won: true, lost: false });
    const enemy = gameWith(['edict_win'], [body(10, 'giant', 1), body(11, 'tiny', 1)]);
    expect(hard.simulateOutcome(enemy.viewFor(0), [{ type: 'castSpell', handIndex: 0 }], 1)).toMatchObject({ won: true, lost: false });
  });
  it('Hard searches indexed Duty and targeted creature Retell even when a land is its baseline', () => {
    const game = gameWith(['forest'], [body(10, 'duties'), body(11, 'bear', 1)]);
    game.state.players[0].landDropsUsed = 0;
    game.state.players[0].graveyard = ['retold'];
    const hard = new HardAI(DB);
    const outcomes = vi.spyOn(hard as unknown as Search, 'aggregateOutcome');
    hard.chooseAction(game.viewFor(0), game.legalActions(0));
    const candidates = outcomes.mock.calls.map(([, actions]) => actions[0]);
    expect(candidates[0]).toEqual({ type: 'playLand', handIndex: 0 });
    expect(candidates).toContainEqual({ type: 'activate', iid: 10, abilityIndex: 1 });
    expect(candidates.some((action) => action.type === 'castSpell' && action.retell && action.targets?.[0].kind === 'permanent')).toBe(true);
  });
  it('Hard keeps new edict casts beyond both ordinary main and response fanout caps', () => {
    for (const response of [false, true]) {
      const state = stateWith(['forest', ...Array.from({ length: 11 }, (_, i) => `dd_skim_${i}`), response ? 'edict_charm' : 'edict'],
        [body(10, 'giant', 1), body(11, 'tiny', 1)]);
      state.players[0].landDropsUsed = 0;
      if (response) { state.step = 'end'; state.activePlayer = 1; state.awaiting = { kind: 'endStepWindow', player: 0 }; }
      const game = Game.restore(state, DB);
      const hard = new HardAI(DB);
      const outcomes = vi.spyOn(hard as unknown as Search, 'aggregateOutcome');
      hard.chooseAction(game.viewFor(0), game.legalActions(0));
      const searched = outcomes.mock.calls.slice(1).flatMap(([, actions]) => actions);
      expect(searched.some((action) => action.type === 'castSpell' && action.handIndex === 12)).toBe(true);
      // Phase A: main's 8 skims -> 7 skims plus pass; response remains 10.
      expect(searched.filter((action) => action.type === 'skim')).toHaveLength(response ? 10 : 7);
    }
  });
  it('the new policies leave ordinary Medium cast and cleanup behavior unchanged', () => {
    const game = gameWith(['bear']);
    const medium = new MediumAI(DB);
    expect(medium.chooseAction(game.viewFor(0), game.legalActions(0))).toEqual({ type: 'passStep' });
    expect(game.viewFor(0)).not.toHaveProperty('pendingDecisions');
  });
});
