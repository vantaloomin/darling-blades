import { describe, expect, it } from 'vitest';
import { chooseDiscard } from '../../src/ai/discardPolicy';
import { chooseSacrifice } from '../../src/ai/sacrificePolicy';
import { chooseActivate } from '../../src/ai/activatedPolicy';
import { chooseRiteSacrifices } from '../../src/ai/ritePolicy';
import { applyVocabularyTargetPolicy, vocabularyCastTargetValue } from '../../src/ai/targeting';
import { activateActionValue, activatedAbilityValue, createPermanentValuer, permValue } from '../../src/ai/value';
import type { Action } from '../../src/engine/actions';
import { validateAction } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { TargetRef } from '../../src/engine/types';
import { DB, body, brain, difficulties, forests, gameWith, stateWith } from './drownedDeepFixture';

const ref = (iid: number): TargetRef => ({ kind: 'permanent', iid });
function loot(hand: string[], count = 1, mana = 2): Game {
  const state = stateWith(hand, forests(mana));
  state.awaiting = { kind: 'discardToHandSize', player: 0, count, decision: 'discard' };
  state.pendingDecisions = [{ kind: 'discard', player: 0, n: count }];
  return Game.restore(state, DB);
}
function edict(): Game {
  const state = stateWith([], [body(10, 'giant'), body(11, 'tiny'), body(12, 'tiny')]);
  state.awaiting = { kind: 'chooseTarget', player: 0, sourceIid: -1, abilityIndex: -1,
    decision: 'sacrifice', targets: [ref(10), ref(12), ref(11)] };
  state.pendingDecisions = [{ kind: 'sacrifice', player: 0, n: 1, sourceCardId: 'edict' }];
  return Game.restore(state, DB);
}

describe('Drowned Deep shared discard policy', () => {
  it('feeds the highest-cost uncastable card before an excess land and preserves the last castable spell', () => {
    const game = loot(['bear', 'costly_red', 'costly', 'forest'], 2, 4);
    expect(chooseDiscard(game.viewFor(0), DB)).toEqual({ type: 'discard', handIndices: [1, 2] });
    const flooded = loot(['bear', 'forest'], 1, 4);
    expect(chooseDiscard(flooded.viewFor(0), DB)).toEqual({ type: 'discard', handIndices: [1] });
  });
  it('checks colored mana and source readiness using the engine payment rules', () => {
    const game = loot(['costly_red', 'bear', 'forest'], 1, 3);
    expect(chooseDiscard(game.viewFor(0), DB)).toEqual({ type: 'discard', handIndices: [0] });
    game.instanceState.battlefield.forEach((perm) => { perm.tapped = true; });
    expect(chooseDiscard(game.viewFor(0), DB)).toEqual({ type: 'discard', handIndices: [0] });
  });
  it('keeps the last affordable spell until a mandatory whole-hand discard must include it', () => {
    expect(chooseDiscard(loot(['bear', 'forest', 'forest'], 2).viewFor(0), DB))
      .toEqual({ type: 'discard', handIndices: [1, 2] });
    expect(chooseDiscard(loot(['bear', 'forest'], 2).viewFor(0), DB))
      .toEqual({ type: 'discard', handIndices: [0, 1] });
  });
  it('does not reinterpret cleanup discards or another seat as loot', () => {
    const game = loot(['costly', 'bear']);
    const view = game.viewFor(0);
    view.awaiting = { kind: 'discardToHandSize', count: 1, player: 0 };
    expect(chooseDiscard(view, DB)).toEqual({ type: 'discard', handIndices: [] });
    expect(chooseDiscard(game.viewFor(1), DB)).toEqual({ type: 'discard', handIndices: [] });
  });
  it.each(difficulties)('%s pins loot choices for seeds 7, 41, 83 without mutating public input', (name) => {
    for (const seed of [7, 41, 83]) {
      const game = loot(['bear', 'costly', 'forest']);
      const view = game.viewFor(0);
      const before = structuredClone(view);
      const action = brain(name, seed).chooseAction(view, game.legalActions(0));
      expect(action).toEqual({ type: 'discard', handIndices: [1] });
      expect(validateAction(game.instanceState, DB, 0, action)).toBeNull();
      expect(view).toEqual(before);
    }
  });
});

describe('Drowned Deep shared sacrifice policy', () => {
  it('feeds the cheapest creature and uses battlefield order for a tie, even if the menu is reversed', () => {
    const game = edict();
    expect(chooseSacrifice(game.viewFor(0), DB, game.legalActions(0)))
      .toEqual({ type: 'chooseTarget', target: ref(11) });
  });
  it('a sole body must be sacrificed and choices outside the menu cannot be invented', () => {
    const game = edict();
    expect(chooseSacrifice(game.viewFor(0), DB, [{ type: 'chooseTarget', target: ref(10) }]))
      .toEqual({ type: 'chooseTarget', target: ref(10) });
  });
  it('does not reinterpret an ordinary target decision as an edict', () => {
    const game = edict();
    const view = game.viewFor(0);
    if (view.awaiting.kind !== 'chooseTarget') throw new Error('Missing target choice');
    delete view.awaiting.decision;
    const legal = game.legalActions(0);
    expect(chooseSacrifice(view, DB, legal)).toBe(legal[0]);
  });
  it.each(difficulties)('%s pins the mandatory cheapest sacrifice for seeds 7, 41, 83', (name) => {
    for (const seed of [7, 41, 83]) {
      const game = edict();
      const action = brain(name, seed).chooseAction(game.viewFor(0), game.legalActions(0));
      expect(action).toEqual({ type: 'chooseTarget', target: ref(11) });
      expect(validateAction(game.instanceState, DB, 0, action)).toBeNull();
    }
  });
  it('Rite excludes its own chosen target as fodder while protecting the best body', () => {
    const game = gameWith(['rite_target'], [body(10, 'giant'), body(11, 'tiny'), body(12, 'tiny')]);
    expect(chooseRiteSacrifices(game.viewFor(0), DB, { type: 'castSpell', handIndex: 0, targets: [ref(11)] })).toEqual([12]);
    expect(chooseRiteSacrifices(game.viewFor(0), DB, { type: 'castSpell', handIndex: 0, targets: [ref(11), ref(12)] })).toBeUndefined();
  });
});

describe('Drowned Deep multiple Duty and independent target policy', () => {
  it.each(difficulties)('%s selects ability index 1 on the same carrier', (name) => {
    const game = gameWith([], [body(10, 'duties')]);
    const action = brain(name).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toEqual({ type: 'activate', iid: 10, abilityIndex: 1 });
    expect(validateAction(game.instanceState, DB, 0, action)).toBeNull();
  });
  it('keeps paid Morning Duty out of the policy but considers it in the Afternoon', () => {
    const game = gameWith([], [body(10, 'paid_duties'), ...forests(2)]);
    expect(chooseActivate(game.viewFor(0), DB, game.legalActions(0))).toMatchObject({ abilityIndex: 0 });
    const afternoon = Game.restore({ ...game.instanceState, step: 'main2' }, DB);
    expect(chooseActivate(afternoon.viewFor(0), DB, afternoon.legalActions(0))).toMatchObject({ abilityIndex: 1 });
    expect(activateActionValue(game.viewFor(0), DB, { type: 'activate', iid: 10, abilityIndex: 9 })).toBe(-Infinity);
  });
  it('values one shared tap at the best ability, including evaluation-local caching', () => {
    const game = gameWith([], [body(10, 'duties'), body(11, 'duties')]);
    const view = game.viewFor(0);
    expect(activatedAbilityValue(view.battlefield, DB, 10, 0)).toBeCloseTo(0.35);
    expect(activatedAbilityValue(view.battlefield, DB, 10, 1)).toBe(2.5);
    expect(permValue(view.battlefield, DB, 10)).toBe(7.5);
    const valueOf = createPermanentValuer(view.battlefield, DB);
    expect([valueOf(10), valueOf(11)]).toEqual([7.5, 7.5]);
  });
  it('requires a full eligible pair in Duty potential and enumerated actions', () => {
    const game = gameWith([], [body(10, 'tap_pair'), body(11, 'bear', 1), body(12, 'giant', 1), body(13, 'tiny', 1)]);
    expect(chooseActivate(game.viewFor(0), DB, game.legalActions(0)))
      .toEqual({ type: 'activate', iid: 10, targets: [ref(11), ref(12)] });
    game.instanceState.battlefield.splice(game.instanceState.battlefield.findIndex((perm) => perm.iid === 12), 1);
    expect(activatedAbilityValue(game.viewFor(0).battlefield, DB, 10)).toBe(0);
    expect(chooseActivate(game.viewFor(0), DB, game.legalActions(0))).toBeNull();
  });
  it('ranks graveyard and battlefield target slots independently', () => {
    const game = gameWith(['bound'], [body(10, 'bear'), body(11, 'giant')]);
    game.state.players[0].graveyard = ['bear', 'giant'];
    const menu = applyVocabularyTargetPolicy(game.viewFor(0), DB, game.legalActions(0));
    expect(menu.filter((action) => action.type === 'castSpell')).toEqual([{ type: 'castSpell', handIndex: 0,
      targets: [{ kind: 'grave', player: 0, index: 1 }, ref(11)] }]);
  });
  it('ranks a mandatory two-target spell by both targets and avoids harming friendly bodies', () => {
    const game = gameWith(['pair'], [body(10, 'giant'), body(11, 'bear', 1), body(12, 'giant', 1)]);
    const menu = applyVocabularyTargetPolicy(game.viewFor(0), DB, game.legalActions(0));
    expect(menu.filter((action) => action.type === 'castSpell')).toEqual([{ type: 'castSpell', handIndex: 0, targets: [ref(11), ref(12)] }]);
  });
  it('prices targeted creature Retell from override ops and its graveyard index', () => {
    const game = gameWith([], [body(10, 'bear', 1), body(11, 'giant', 1)]);
    game.state.players[0].graveyard = ['retold'];
    const menu = applyVocabularyTargetPolicy(game.viewFor(0), DB, game.legalActions(0));
    const casts = menu.filter((action) => action.type === 'castSpell');
    expect(casts).toHaveLength(1);
    expect(casts[0]).toMatchObject({ retell: true, graveIndex: 0, targets: [ref(10)] });
    expect(vocabularyCastTargetValue(game.viewFor(0), DB, casts[0])).toBe(4);
  });
  it.each(['Easy', 'Medium', 'Hard'] as const)('%s pins complete pairs and independent spell slots at seeds 7, 41, 83', (name) => {
    for (const seed of [7, 41, 83]) {
      const pair = gameWith(['pair'], [body(10, 'giant'), body(11, 'bear', 1), body(12, 'giant', 1)]);
      expect(brain(name, seed).chooseAction(pair.viewFor(0), pair.legalActions(0))).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(11), ref(12)] });
      const bound = gameWith(['bound'], [body(10, 'bear'), body(11, 'giant')]);
      bound.state.players[0].graveyard = ['bear', 'giant'];
      expect(brain(name, seed).chooseAction(bound.viewFor(0), bound.legalActions(0))).toEqual({ type: 'castSpell', handIndex: 0,
        targets: [{ kind: 'grave', player: 0, index: 1 }, ref(11)] });
    }
  });
  it.each(difficulties)('%s uses the targeted creature Retell override with its chosen legal target', (name) => {
    const game = gameWith([], [body(10, 'bear', 1), body(11, 'giant', 1)]);
    game.state.players[0].graveyard = ['retold'];
    const action = brain(name).chooseAction(game.viewFor(0), game.legalActions(0));
    expect(action).toMatchObject({ type: 'castSpell', retell: true, graveIndex: 0, targets: [ref(10)] });
    game.submit(0, action);
    expect(game.state.battlefield.some((perm) => perm.cardId === 'retold')).toBe(false);
    expect(game.state.players[0].severed).toContain('retold');
  });
  it('keeps old menus and target-value absence byte-identical', () => {
    const game = gameWith(['bear'], forests(2));
    const menu: Action[] = game.legalActions(0);
    expect(applyVocabularyTargetPolicy(game.viewFor(0), DB, menu)).toBe(menu);
    expect(vocabularyCastTargetValue(game.viewFor(0), DB, menu.find((action) => action.type === 'castSpell')!)).toBeUndefined();
  });
});
