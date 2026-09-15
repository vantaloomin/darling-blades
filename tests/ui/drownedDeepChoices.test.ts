import { describe, expect, it } from 'vitest';
import { legalActions, validateAction } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { cardIdOf, type GameState } from '../../src/engine/types';
import { toggleSacrifice } from '../../src/ui/castSacrifice';
import {
  confirmDeferredTarget, deferredTargetPrompt, DUTY_CHOOSER_LAYOUT, dutyChoices, dutyChooserRows,
  edictSacrificeSelection, LOOT_PICKER_LAYOUT, lootDiscardSelection, lootPickerPage, toggleLootDiscard,
} from '../../src/ui/drownedDeepChoices';
import { dutyTargetStep, presentationRectsOverlap, targetAbilityText, targetPromptTitle } from '../../src/ui/duelPresentation';
import { activatedText } from '../../src/ui/rulesText';
import { board, card, dbOf, ref, spell } from '../drownedDeepFixture';

const DB = dbOf(
  card('looter', { activated: { cost: { tap: true }, ops: [{ op: 'draw', n: 2 }, { op: 'discard', n: 2, who: 'self' }] } }),
  card('short', { activated: { cost: { tap: true }, ops: [{ op: 'discard', n: 5, who: 'self' }] } }),
  spell('edict', [{ op: 'sacrifice', who: 'opponent', n: 1 }]),
  spell('each', [{ op: 'sacrifice', who: 'each', n: 1 }]),
  card('ward', { keywords: ['untouchable'] }),
  card('glass', { types: ['artifact'], activated: [
    { cost: { tap: true }, ops: [{ op: 'foresee', n: 2 }] },
    { cost: { tap: true, mana: { generic: 2, pips: {} } }, ops: [{ op: 'draw', n: 1 }] },
    { cost: { tap: true }, targets: [{ what: 'opponentCreature', maxCost: 2 }], ops: [{ op: 'damage', n: 1, to: 'target' }] },
  ] }),
  card('single', { activated: { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] } }),
  card('queen', { name: 'Wrecker Queen', abilities: [{ when: 'attacks', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 1, to: 'target' }] }] }),
  card('gate', { name: 'Marsh Gate', abilities: [{ when: 'dawn', targets: [{ what: 'yourCreature' }], ops: [{ op: 'addCounters', n: 1, to: 'target' }] }] }),
  card('arrival', { abilities: [{ when: 'arrives', targets: [{ what: 'opponentCreature', maxCost: 2 }], ops: [{ op: 'damage', n: 1, to: 'target' }] }] }),
);

function lootGame(): Game {
  const game = Game.restore(board([['bear', 'bear'], []], [{ iid: 1, cardId: 'looter' }]), DB);
  game.submit(0, { type: 'activate', iid: 1 });
  return game;
}

function attackGame(): Game {
  const game = Game.restore(board([[], []], [{ iid: 1, cardId: 'queen' }, { iid: 2, cardId: 'bear', controller: 1 }]), DB);
  game.submit(0, { type: 'passStep' });
  game.submit(0, { type: 'declareAttackers', attackers: [1] });
  return game;
}

describe('loot discard picker state', () => {
  it('exposes the full hand and toggles physical indices through the shared exact-count gate', () => {
    const game = lootGame();
    const model = lootDiscardSelection(game.instanceState, DB, 0, [])!;
    expect(model).toMatchObject({ count: 2, candidates: [0, 1, 2, 3], prompt: 'Discard 2', progress: '2 remaining', canCancel: false, action: null });
    const initial: number[] = [];
    const one = toggleLootDiscard(initial, 0, model.candidates, model.count);
    const two = toggleLootDiscard(one, 1, model.candidates, model.count);
    expect(initial).toEqual([]);
    expect(two).toEqual([0, 1]); // Identical card names remain distinct hand cards.
    expect(toggleLootDiscard(two, 2, model.candidates, model.count)).toEqual(two);
    expect(toggleLootDiscard(two, 1, model.candidates, model.count)).toEqual([0]);
    expect(toggleLootDiscard([], 99, model.candidates, model.count)).toEqual([]);
    expect(lootDiscardSelection(game.instanceState, DB, 0, one)).toMatchObject({ remaining: 1, progress: '1 remaining', action: null });
  });

  it('confirms exactly the selected hand indices and submits the engine discard shape', () => {
    const game = lootGame();
    const selection = lootDiscardSelection(game.instanceState, DB, 0, [2, 0])!;
    expect(selection).toMatchObject({ remaining: 0, progress: '0 remaining', canCancel: false });
    expect(selection.action).toEqual({ type: 'discard', handIndices: [0, 2] });
    expect(game.legalActions(0)).toContainEqual(selection.action);
    const events = game.submit(0, selection.action!);
    expect(events.filter((event) => event.e === 'discarded')).toEqual([
      { e: 'discarded', player: 0, cardId: 'forest' }, { e: 'discarded', player: 0, cardId: 'bear' },
    ]);
    expect(game.instanceState.players[0].hand.map(cardIdOf)).toEqual(['bear', 'forest']);
    expect(game.awaiting.kind).toBe('main');
    expect(lootDiscardSelection(game.instanceState, DB, 0, [0, 2])).toBeNull();
  });

  it('rejects partial, extra, duplicate, fractional, and stale hand indices', () => {
    const game = lootGame();
    for (const selected of [[], [0], [0, 1, 2], [0, 0], [0, 9], [0, 0.5], [-1, 1]]) {
      expect(lootDiscardSelection(game.instanceState, DB, 0, selected)?.action).toBeNull();
    }
    expect(lootDiscardSelection(game.instanceState, DB, 1, [0, 1])).toBeNull();
  });

  it('uses the engine-clamped count when a discard exceeds the remaining hand', () => {
    const game = Game.restore(board([['bear'], []], [{ iid: 1, cardId: 'short' }]), DB);
    game.submit(0, { type: 'activate', iid: 1 });
    const selection = lootDiscardSelection(game.instanceState, DB, 0, [0])!;
    expect(selection).toMatchObject({ count: 1, prompt: 'Discard 1', action: { type: 'discard', handIndices: [0] } });
    game.submit(0, selection.action!);
    expect(game.instanceState.players[0].hand).toEqual([]);
  });

  it('does not take over cleanup discard or an unrelated pending decision', () => {
    const state: GameState = structuredClone(lootGame().instanceState);
    state.awaiting = { kind: 'discardToHandSize', player: 0, count: 2 };
    expect(lootDiscardSelection(state, DB, 0, [])).toBeNull();
    state.awaiting.decision = 'discard';
    state.pendingDecisions = [];
    expect(lootDiscardSelection(state, DB, 0, [])).toBeNull();
  });
});

describe('edict sacrifice picker state', () => {
  it.each([0, 1] as const)('offers only seat %s own creatures, including Untouchable, and requires one', (player) => {
    const caster = player === 0 ? 1 : 0;
    const state = board(caster === 0 ? [['edict'], []] : [[], ['edict']], [
      { iid: 1, cardId: 'bear', controller: player }, { iid: 2, cardId: 'ward', controller: player, tapped: true },
      { iid: 3, cardId: 'forest', controller: player }, { iid: 4, cardId: 'bear', controller: caster },
    ]);
    state.activePlayer = caster;
    state.awaiting = { kind: 'main', player: caster };
    const game = Game.restore(state, DB);
    game.submit(caster, { type: 'castSpell', handIndex: 0 });
    const empty = edictSacrificeSelection(game.instanceState, DB, player, [])!;
    expect(empty).toMatchObject({ count: 1, candidates: [1, 2], prompt: 'Sacrifice 1', sourceCardId: 'edict', canCancel: false, action: null });
    expect(edictSacrificeSelection(game.instanceState, DB, caster, [])).toBeNull();
    expect(toggleSacrifice([], 4, empty.candidates, empty.count)).toEqual([]);
    expect(toggleSacrifice([1], 2, empty.candidates, empty.count)).toEqual([1]);
    expect(toggleSacrifice([1], 1, empty.candidates, empty.count)).toEqual([]);
    for (const selected of [[1, 2], [2, 2], [3], [4], [99]]) {
      expect(edictSacrificeSelection(game.instanceState, DB, player, selected)?.action).toBeNull();
    }
    const ready = edictSacrificeSelection(game.instanceState, DB, player, [2])!;
    expect(ready.action).toEqual({ type: 'chooseTarget', target: ref(2) });
    expect(game.legalActions(player)).toContainEqual(ready.action);
    game.submit(player, ready.action!);
    expect(game.instanceState.battlefield.some((permanent) => permanent.iid === 2)).toBe(false);
    expect(game.instanceState.players[player].graveyard.map(cardIdOf)).toContain('ward');
  });

  it('keeps each-player sacrifice in caster-first engine order and hides the human picker for the next seat', () => {
    const game = Game.restore(board([['each'], []], [
      { iid: 1, cardId: 'bear' }, { iid: 2, cardId: 'bear', controller: 1 },
    ]), DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 0, decision: 'sacrifice' });
    game.submit(0, edictSacrificeSelection(game.instanceState, DB, 0, [1])!.action!);
    expect(game.awaiting).toMatchObject({ kind: 'chooseTarget', player: 1, decision: 'sacrifice' });
    expect(edictSacrificeSelection(game.instanceState, DB, 0, [])).toBeNull();
    game.submit(1, edictSacrificeSelection(game.instanceState, DB, 1, [2])!.action!);
    expect(game.instanceState.battlefield).toEqual([]);
    expect(game.awaiting.kind).toBe('main');
  });

  it('rejects stale candidates even if the old awaiting list still mentions them', () => {
    const game = Game.restore(board([['each'], []], [{ iid: 1, cardId: 'bear' }]), DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    const state: GameState = structuredClone(game.instanceState);
    state.battlefield[0].controller = 1;
    expect(edictSacrificeSelection(state, DB, 0, [1])).toMatchObject({ candidates: [], action: null });
    state.pendingDecisions = [];
    expect(edictSacrificeSelection(state, DB, 0, [])).toBeNull();
  });
});

describe('Duty ability selector state', () => {
  it('lists every canonical activated line and disables unavailable costs or targets', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'glass' }]);
    const choices = dutyChoices(DB.glass, 1, legalActions(state, DB, 0));
    expect(choices.map((choice) => choice.line)).toEqual(activatedText(DB.glass)!.split('\n'));
    expect(choices.map((choice) => choice.enabled)).toEqual([true, false, false]);
    expect(choices[1].cost).toEqual({ tap: true, mana: { generic: 2, pips: {} } });
    expect(choices[1].actions).toEqual([]);
    expect(choices[2].actions).toEqual([]);
  });

  it('preserves the chosen ability index through the existing Duty target flow and real submission', () => {
    const game = Game.restore(board([[], []], [
      { iid: 1, cardId: 'glass' }, { iid: 2, cardId: 'bear', controller: 1 },
      { iid: 3, cardId: 'giant', controller: 1 }, { iid: 4, cardId: 'forest' }, { iid: 5, cardId: 'forest' },
    ]), DB);
    const offered = game.legalActions(0);
    const choices = dutyChoices(DB.glass, 1, offered);
    expect(choices.map((choice) => choice.enabled)).toEqual([true, true, true]);
    const selected = choices[2];
    expect(selected.actions[0]).toBe(offered.find((action) => action.type === 'activate' && action.abilityIndex === 2));
    expect(dutyTargetStep(selected.actions, []).complete).toBeNull();
    expect(dutyTargetStep(selected.actions, []).targets).toEqual([ref(2)]);
    const complete = dutyTargetStep(selected.actions, [ref(2)]).complete;
    expect(complete).toEqual({ type: 'activate', iid: 1, abilityIndex: 2, targets: [ref(2)] });
    expect(validateAction(game.instanceState, DB, 0, complete!)).toBeNull();
    expect(game.submit(0, complete!)).toContainEqual({ e: 'activated', player: 0, iid: 1, cardId: 'glass', abilityIndex: 2 });
    expect(game.instanceState.battlefield.find((permanent) => permanent.iid === 2)?.damage).toBe(1);
    expect(dutyChoices(DB.glass, 1, game.legalActions(0)).every((choice) => !choice.enabled)).toBe(true);
  });

  it('retains the single-Duty legacy action shape and excludes another permanent actions', () => {
    const game = Game.restore(board([[], []], [{ iid: 1, cardId: 'single' }, { iid: 2, cardId: 'single' }]), DB);
    const choices = dutyChoices(DB.single, 2, game.legalActions(0));
    expect(choices).toHaveLength(1);
    expect(choices[0].actions).toEqual([{ type: 'activate', iid: 2 }]);
    game.submit(0, choices[0].actions[0]);
    expect(game.instanceState.players[0].life).toBe(21);
    expect(dutyChoices(DB.bear, 1, game.legalActions(0))).toEqual([]);
  });
});

describe('deferred trigger target presentation', () => {
  it('names the attack trigger, shows its source, and submits the shared validated chooseTarget shape', () => {
    const game = attackGame();
    expect(deferredTargetPrompt(game.instanceState, DB, 0)).toEqual({
      sourceCardId: 'queen', title: 'Wrecker Queen attacks: choose a creature',
      text: targetAbilityText(DB.queen, 0), canCancel: false,
    });
    const action = confirmDeferredTarget(game.instanceState, DB, 0, ref(2));
    expect(action).toEqual({ type: 'chooseTarget', target: ref(2) });
    expect(game.legalActions(0)).toContainEqual(action);
    game.submit(0, action!);
    expect(game.instanceState.battlefield.find((permanent) => permanent.iid === 2)?.damage).toBe(1);
    expect(confirmDeferredTarget(game.instanceState, DB, 0, ref(2))).toBeNull();
  });

  it('names Dawn and retains the choosing controller restriction in prompt and submission', () => {
    const state = board([[], []], [{ iid: 1, cardId: 'gate' }, { iid: 2, cardId: 'bear', controller: 1 }]);
    state.activePlayer = 1;
    state.step = 'main2';
    state.awaiting = { kind: 'main', player: 1 };
    const game = Game.restore(state, DB);
    game.submit(1, { type: 'passStep' });
    expect(deferredTargetPrompt(game.instanceState, DB, 0)).toMatchObject({
      sourceCardId: 'gate', title: 'Marsh Gate at Dawn: choose a creature you control', canCancel: false,
    });
    expect(confirmDeferredTarget(game.instanceState, DB, 0, ref(2))).toBeNull();
    game.submit(0, confirmDeferredTarget(game.instanceState, DB, 0, ref(1))!);
    expect(game.instanceState.battlefield.find((permanent) => permanent.iid === 1)?.plusOneCounters).toBe(1);
  });

  it('preserves the existing arrival prompt and its cost-capped legal choices', () => {
    const game = Game.restore(board([['arrival'], []], [
      { iid: 2, cardId: 'bear', controller: 1 }, { iid: 3, cardId: 'giant', controller: 1 },
    ]), DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(deferredTargetPrompt(game.instanceState, DB, 0)?.title).toBe(targetPromptTitle(DB.arrival.name));
    expect(confirmDeferredTarget(game.instanceState, DB, 0, ref(3))).toBeNull();
    expect(confirmDeferredTarget(game.instanceState, DB, 0, ref(2))).toEqual({ type: 'chooseTarget', target: ref(2) });
  });

  it('uses the pending source card after departure and rejects stale targets or mismatched decision identities', () => {
    const state: GameState = structuredClone(attackGame().instanceState);
    state.battlefield = state.battlefield.filter((permanent) => permanent.iid !== 1);
    expect(deferredTargetPrompt(state, DB, 0)?.sourceCardId).toBe('queen');
    expect(confirmDeferredTarget(state, DB, 0, ref(1))).toBeNull();
    expect(confirmDeferredTarget(state, DB, 1, ref(2))).toBeNull();
    expect(deferredTargetPrompt(state, DB, 1)).toBeNull();
    const pending = state.pendingDecisions[0];
    if (pending.kind !== 'chooseTarget') throw new Error('missing target fixture');
    pending.abilityIndex = 9;
    expect(deferredTargetPrompt(state, DB, 0)).toBeNull();
    expect(confirmDeferredTarget(state, DB, 0, ref(2))).toBeNull();
  });

  it('never treats an edict as a deferred targeted ability', () => {
    const game = Game.restore(board([['each'], []], [{ iid: 1, cardId: 'bear' }]), DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(deferredTargetPrompt(game.instanceState, DB, 0)).toBeNull();
    expect(confirmDeferredTarget(game.instanceState, DB, 0, ref(1))).toBeNull();
  });

  it('carries target qualifiers into the trigger prompt', () => {
    const state: GameState = structuredClone(attackGame().instanceState);
    const pending = state.pendingDecisions[0];
    if (pending.kind !== 'chooseTarget') throw new Error('missing target fixture');
    pending.spec = { what: 'opponentCreature', other: true, tapped: true, marked: true, maxCost: 3, minAttack: 2 };
    expect(deferredTargetPrompt(state, DB, 0)?.title).toBe(
      'Wrecker Queen attacks: choose another Marked tapped creature an opponent controls with cost 3 or less and attack 2 or more',
    );
  });
});

function bounds(rect: { x: number; y: number; width: number; height: number }) {
  return { left: rect.x - rect.width / 2, right: rect.x + rect.width / 2, top: rect.y - rect.height / 2, bottom: rect.y + rect.height / 2 };
}

describe('Drowned Deep picker layout', () => {
  it('keeps every Duty row hit area disjoint with at least the 2 px gap across pages', () => {
    const layout = DUTY_CHOOSER_LAYOUT;
    for (const count of [1, 2, 3, 4, 8, 20]) {
      const seen: number[] = [];
      const pageCount = dutyChooserRows(count).pageCount;
      for (let page = 0; page < pageCount; page++) {
        const model = dutyChooserRows(count, page);
        expect(model.rows.length).toBeLessThanOrEqual(3);
        model.rows.forEach((row, index) => {
          seen.push(row.abilityIndex);
          expect(row.left).toBeGreaterThanOrEqual(64);
          expect(row.right).toBeLessThanOrEqual(1216);
          expect(row.height).toBeGreaterThanOrEqual(44);
          expect(row.bottom + 2).toBeLessThanOrEqual(bounds(layout.previous).top);
          if (index > 0) {
            expect(presentationRectsOverlap(model.rows[index - 1], row)).toBe(false);
            expect(row.top - model.rows[index - 1].bottom).toBeGreaterThanOrEqual(2);
          }
        });
      }
      expect(seen).toEqual(Array.from({ length: count }, (_, index) => index));
    }
    const controls = [layout.previous, layout.next, layout.cancel].map(bounds);
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      expect(presentationRectsOverlap(controls[i], controls[j])).toBe(false);
      expect(Math.max(controls[j].left - controls[i].right, controls[j].top - controls[i].bottom)).toBeGreaterThanOrEqual(2);
    }
    expect(bounds(layout.cancel).bottom).toBeLessThanOrEqual(720);
  });

  it('keeps the loot prompt, lifted cards, and footer controls clear at Foresee scale', () => {
    const layout = LOOT_PICKER_LAYOUT;
    const title = bounds({ x: 640, y: layout.titleY, width: layout.titleWidth, height: layout.titleHeight });
    const progress = bounds({ x: 640, y: layout.progressY, width: layout.progressWidth, height: layout.progressHeight });
    expect(progress.top - title.bottom).toBeGreaterThanOrEqual(2);
    const controls = [layout.previous, layout.confirm, layout.next].map(bounds);
    for (const count of [1, 2, 5, 6, 11, 100]) {
      const seen: number[] = [];
      for (let page = 0; page < lootPickerPage(count).pageCount; page++) {
        const model = lootPickerPage(count, page);
        const cards = model.slots.map((slot) => bounds({ x: slot.x, y: slot.y, width: 300 * slot.scale, height: 420 * slot.scale }));
        model.slots.forEach((slot) => seen.push(slot.index));
        cards.forEach((rect, index) => {
          expect(rect.left).toBeGreaterThanOrEqual(64);
          expect(rect.right).toBeLessThanOrEqual(1216);
          expect(rect.top - layout.selectedLift - progress.bottom).toBeGreaterThanOrEqual(2);
          expect(controls[0].top - (rect.bottom + layout.badgeOffset + 14)).toBeGreaterThanOrEqual(2);
          if (index > 0) expect(rect.left - cards[index - 1].right).toBeGreaterThanOrEqual(2);
        });
      }
      expect(seen).toEqual(Array.from({ length: count }, (_, index) => index));
    }
    for (let i = 1; i < controls.length; i++) expect(controls[i].left - controls[i - 1].right).toBeGreaterThanOrEqual(2);
  });

  it('clamps page changes while retaining physical hand and ability indices', () => {
    expect(lootPickerPage(11, -1).slots.map((slot) => slot.index)).toEqual([0, 1, 2, 3, 4]);
    expect(lootPickerPage(11, 99)).toMatchObject({ page: 2, pageCount: 3, canPrevious: true, canNext: false, slots: [{ index: 10 }] });
    expect(dutyChooserRows(8, 2).rows.map((row) => row.abilityIndex)).toEqual([6, 7]);
    expect(lootPickerPage(0)).toMatchObject({ page: 0, pageCount: 1, canPrevious: false, canNext: false, slots: [] });
    expect(dutyChooserRows(0).rows).toEqual([]);
  });
});
