import { describe, expect, it } from 'vitest';
import { legalActions, validateAction } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { cardIdOf, type TargetRef } from '../../src/engine/types';
import {
  confirmedTargetSelection, removeLastTargetSelection, targetSelectionStep, toggleTargetSelection,
  type TargetSelectionAction,
} from '../../src/ui/targetSelection';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';

const db = dbOf(
  card('body'),
  spell('pair', [{ op: 'tap', to: 'target' }], [{ what: 'creature', exactly: 2 }]),
  spell('optional', [{ op: 'tap', to: 'target' }], [{ what: 'creature', upTo: 2 }]),
  spell('split', [{ op: 'reclaim', targetIndex: 0 }, { op: 'addCounters', n: 1, to: 'target', targetIndex: 1 }],
    [{ what: 'yourGraveCreature' }, { what: 'yourCreature' }]),
  spell('shared', [{ op: 'tap', to: 'target' }, { op: 'addCounters', n: 1, to: 'target', targetIndex: 1 }],
    [{ what: 'yourCreature' }, { what: 'yourCreature' }]),
  card('duties', { types: ['artifact'], activated: [
    { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] },
    { cost: { tap: true, mana: { generic: 1, pips: {} } },
      targets: [{ what: 'creature', exactly: 2 }], ops: [{ op: 'tap', to: 'target' }] },
  ] }),
);

const creatures = [1, 2, 3].map((iid) => ({ iid, cardId: 'body' }));

describe('exact-count target selection', () => {
  it('offers every member first and counts a canonical pair selected in reverse order', () => {
    const state = board([['pair'], []], creatures);
    const actions = legalActions(state, db, 0).filter((action) => action.type === 'castSpell');
    const empty = targetSelectionStep(actions, [], true);
    expect(empty.targets).toEqual([ref(1), ref(2), ref(3)]);
    expect(empty.countText).toBe('0 of 2');
    expect(empty.complete).toBeNull();

    const picked = toggleTargetSelection(actions, [], ref(3), true);
    const partial = targetSelectionStep(actions, picked, true);
    expect(partial.selected).toEqual([ref(3)]);
    expect(partial.targets).toEqual([ref(1), ref(2)]);
    expect(partial.countText).toBe('1 of 2');
    expect(confirmedTargetSelection(state, db, 0, actions, picked, true)).toBeNull();

    const both = toggleTargetSelection(actions, picked, ref(1), true);
    const complete = confirmedTargetSelection(state, db, 0, actions, both, true);
    expect(complete).toBe(actions[1]);
    expect(complete).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(1), ref(3)] });
    expect(targetSelectionStep(actions, both, true).countText).toBe('2 of 2');
    expect(validateAction(state, db, 0, complete!)).toBeNull();
    const game = Game.restore(state, db);
    game.submit(0, complete!);
    expect(game.instanceState.battlefield.map((permanent) => permanent.tapped)).toEqual([true, false, true]);
  });

  it('toggles a full pair without losing alternatives and never permits a third selection', () => {
    const state = board([['pair'], []], creatures);
    const actions = legalActions(state, db, 0).filter((action) => action.type === 'castSpell');
    const selected = [ref(3), ref(1)];
    expect(toggleTargetSelection(actions, selected, ref(2), true)).toEqual(selected);
    const reduced = toggleTargetSelection(actions, selected, ref(1), true);
    expect(reduced).toEqual([ref(3)]);
    expect(confirmedTargetSelection(state, db, 0, actions, reduced, true)).toBeNull();
    const replaced = toggleTargetSelection(actions, reduced, ref(2), true);
    expect(confirmedTargetSelection(state, db, 0, actions, replaced, true)).toBe(actions[2]);
    expect(selected).toEqual([ref(3), ref(1)]);
  });

  it('rejects duplicate, unknown, empty-pool and stale choices at confirmation', () => {
    const state = board([['pair'], []], creatures);
    const actions = legalActions(state, db, 0).filter((action) => action.type === 'castSpell');
    for (const picked of [[ref(1), ref(1)], [ref(1), ref(99)], [ref(1), ref(2), ref(3)]]) {
      expect(targetSelectionStep(actions, picked, true).complete).toBeNull();
      expect(confirmedTargetSelection(state, db, 0, actions, picked, true)).toBeNull();
    }
    expect(toggleTargetSelection(actions, [], ref(99), true)).toEqual([]);
    expect(targetSelectionStep([], [], true)).toMatchObject({ targets: [], complete: null, countText: '0 of 0' });
    state.battlefield = state.battlefield.filter((permanent) => permanent.iid !== 2);
    expect(confirmedTargetSelection(state, db, 0, actions, [ref(1), ref(2)], true)).toBeNull();
  });

  it('retains zero, one and two valid choices for an up-to target spec', () => {
    const state = board([['optional'], []], creatures);
    const actions = legalActions(state, db, 0).filter((action) => action.type === 'castSpell');
    for (const selected of [[], [ref(3)], [ref(3), ref(1)]]) {
      const completed = confirmedTargetSelection(state, db, 0, actions, selected, true);
      expect(completed).not.toBeNull();
      expect(completed!.targets).toHaveLength(selected.length);
      expect(actions).toContain(completed);
    }
    expect(confirmedTargetSelection(state, db, 0, actions, [], true))
      .toEqual({ type: 'castSpell', handIndex: 0, targets: [] });
  });
});

describe('ordered target slots', () => {
  it('chooses a grave creature before its independent own-creature slot and submits the engine action', () => {
    const state = board([['split'], []], [...creatures, { iid: 4, cardId: 'body', controller: 1 }]);
    state.players[0].graveyard = ['bear', 'giant'];
    const actions = legalActions(state, db, 0).filter((action) => action.type === 'castSpell');
    const grave: TargetRef = { kind: 'grave', player: 0, index: 1 };
    expect(targetSelectionStep(actions, []).targets).toEqual([
      { kind: 'grave', player: 0, index: 0 }, grave,
    ]);
    expect(toggleTargetSelection(actions, [], ref(1))).toEqual([]);
    const first = toggleTargetSelection(actions, [], grave);
    expect(targetSelectionStep(actions, first).targets).toEqual(creatures.map((permanent) => ref(permanent.iid)));
    expect(targetSelectionStep(actions, first).countText).toBe('1 of 2');
    expect(confirmedTargetSelection(state, db, 0, actions, first)).toBeNull();
    expect(toggleTargetSelection(actions, first, ref(4))).toEqual(first);
    const picked = toggleTargetSelection(actions, first, ref(2));
    const complete = confirmedTargetSelection(state, db, 0, actions, picked);
    expect(complete).toEqual({ type: 'castSpell', handIndex: 0, targets: [grave, ref(2)] });
    expect(actions).toContain(complete);
    const game = Game.restore(state, db);
    game.submit(0, complete!);
    expect(game.instanceState.players[0].hand.map(cardIdOf)).toEqual(['giant']);
    expect(game.instanceState.battlefield.map((permanent) => permanent.plusOneCounters)).toEqual([0, 1, 0, 0]);
  });

  it('can repeat a legal ref for independent slots and undo the last slot separately', () => {
    const state = board([['shared'], []], creatures);
    const actions = legalActions(state, db, 0).filter((action) => action.type === 'castSpell');
    const first = toggleTargetSelection(actions, [], ref(1));
    const both = toggleTargetSelection(actions, first, ref(1));
    expect(both).toEqual([ref(1), ref(1)]);
    expect(confirmedTargetSelection(state, db, 0, actions, both))
      .toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(1), ref(1)] });
    const undone = removeLastTargetSelection(both);
    expect(undone).toEqual([ref(1)]);
    expect(confirmedTargetSelection(state, db, 0, actions, undone)).toBeNull();
    expect(targetSelectionStep(actions, undone).targets).toContainEqual(ref(2));
    expect(removeLastTargetSelection([])).toEqual([]);
    expect(both).toEqual([ref(1), ref(1)]);
  });
});

describe('canonical target action confirmation', () => {
  it('preserves the selected Duty index and explicit mana plan, and refuses a now-tapped source', () => {
    const state = board([[], []], [...creatures, { iid: 10, cardId: 'duties' }, { iid: 100, cardId: 'forest' }]);
    const actions = legalActions(state, db, 0)
      .filter((action): action is Extract<TargetSelectionAction, { type: 'activate' }> =>
        action.type === 'activate' && action.abilityIndex === 1)
      .map((action) => ({ ...action, manaPlan: [100] }));
    const complete = confirmedTargetSelection(state, db, 0, actions, [ref(2), ref(1)], true);
    expect(complete).toBe(actions[0]);
    expect(complete).toEqual({ type: 'activate', iid: 10, abilityIndex: 1, targets: [ref(1), ref(2)], manaPlan: [100] });
    state.battlefield.find((permanent) => permanent.iid === 10)!.tapped = true;
    expect(confirmedTargetSelection(state, db, 0, actions, [ref(2), ref(1)], true)).toBeNull();
  });

  it('retains the greatest enumerated X and rejects a payment that is no longer available', () => {
    const state = board([['blaze'], []], [100, 101, 102, 103].map((iid) => ({ iid, cardId: 'mountain' })));
    const actions = legalActions(state, db, 0).filter((action) => action.type === 'castSpell');
    const selected: TargetRef[] = [{ kind: 'player', player: 1 }];
    const complete = confirmedTargetSelection(state, db, 0, actions, selected);
    expect(complete).toEqual({ type: 'castSpell', handIndex: 0, targets: selected, x: 3 });
    expect(actions).toContain(complete);
    state.battlefield.forEach((permanent) => { permanent.tapped = true; });
    expect(confirmedTargetSelection(state, db, 0, actions, selected)).toBeNull();
  });

  it('keeps the engine shape of an untargeted Darling action', () => {
    const state = board();
    state.players[0].darlingZone = 'body';
    const actions = legalActions(state, db, 0).filter((action) => action.type === 'castDarling');
    expect(actions).toHaveLength(1);
    expect(confirmedTargetSelection(state, db, 0, actions, [])).toBe(actions[0]);
    expect(actions[0]).toEqual({ type: 'castDarling' });
  });

  it('distinguishes ref kinds and graveyard owners when narrowing supplied actions', () => {
    const refs: TargetRef[] = [
      ref(1), { kind: 'player', player: 1 }, { kind: 'stackItem', sid: 1 },
      { kind: 'grave', player: 0, index: 1 }, { kind: 'grave', player: 1, index: 1 },
    ];
    const actions: TargetSelectionAction[] = refs.map((target) => ({ type: 'castSpell', handIndex: 0, targets: [target] }));
    expect(targetSelectionStep(actions, []).targets).toEqual(refs);
    for (const [index, target] of refs.entries()) {
      expect(targetSelectionStep(actions, [target]).complete).toBe(actions[index]);
    }
  });
});
