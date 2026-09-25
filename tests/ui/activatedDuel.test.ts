import { activatedAbilitiesOf } from '../../src/engine/types';
import { describe, expect, it } from 'vitest';
import { activatedBlockers, legalActions, validateAction } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { solveMana } from '../../src/engine/mana';
import type { ActivatedDef, CardDb, CardDef, GameState, TargetRef } from '../../src/engine/types';
import { dutyChoices } from '../../src/ui/drownedDeepChoices';
import {
  DUTY_ACTION_LABEL, DUTY_CANCEL_LABEL, DUTY_PLAYER_LABELS,
  dutyBlockedCopy, dutyEffectText, dutyNarration, dutyRowPips, dutyTargetStep, dutyTargetsNeedPicker, dutyWindowReason,
  type DutyAction, permanentActionLabel,
} from '../../src/ui/duelPresentation';
import { segmentManaText } from '../../src/ui/ManaText';
import { makeTestState, TEST_DB } from '../helpers';

const permanent = (iid: number): TargetRef => ({ kind: 'permanent', iid });
function carrier(id: string, activated: ActivatedDef): CardDef {
  return { id, name: id, types: ['artifact'], subtypes: [], colors: [], rarity: 'c', activated };
}
const DB: CardDb = {
  ...TEST_DB,
  free: carrier('free', { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] }),
  paid: carrier('paid', {
    cost: { tap: true, mana: { generic: 1, pips: { G: 1 } } },
    targets: [{ what: 'player' }], ops: [{ op: 'damage', n: 1, to: 'target' }],
  }),
  optional: carrier('optional', {
    cost: { tap: true }, targets: [{ what: 'creature', upTo: 2 }],
    ops: [{ op: 'damage', n: 1, to: 'target' }],
  }),
  move: carrier('move', {
    cost: { tap: true }, targets: [{ what: 'yourCreature', marked: true }, { what: 'yourCreature' }],
    ops: [{ op: 'moveMark' }],
  }),
};
function board(cardId: string): GameState {
  return makeTestState({
    active: 0,
    battlefield: [
      { iid: 10, cardId, controller: 0 },
      { iid: 20, cardId: 'bear', controller: 0, plusOneCounters: 1 },
      { iid: 30, cardId: 'bear', controller: 0 },
      { iid: 40, cardId: 'forest', controller: 0 },
      { iid: 50, cardId: 'plains', controller: 0 },
    ],
  });
}
function actions(state: GameState): DutyAction[] {
  return legalActions(state, DB, 0).filter((action): action is DutyAction => action.type === 'activate');
}

describe('Duty duel presentation', () => {
  it.each([
    ['Activated source is tapped', 'Duty: this permanent is tapped.'],
    ['Activated source cannot tap the turn it arrives unless it has Warcry', 'Duty: it arrived this turn.'],
    ['cannot pay cost', 'Duty: you cannot pay the cost.'],
    ['no legal targets for activated ability', 'Duty: no legal target.'],
    ['Activated abilities can only be used during your Morning or Afternoon', 'Duty: only in your Morning or Afternoon.'],
    ['Activated abilities need an empty stack', 'Duty: wait for the stack to clear.'],
    ['Activated source is not on the battlefield', 'Duty: this permanent is not on the battlefield.'],
    ['Activated source is not under your control', 'Duty: you do not control this permanent.'],
    ['permanent has no activated ability', 'Duty: this permanent has no Duty.'],
  ])('translates engine blocker "%s" into player-facing Duty copy', (reason, expected) => {
    const copy = dutyBlockedCopy(reason);
    expect(copy).toBe(expected);
    expect(copy).not.toContain('\u2014');
    expect(copy).not.toMatch(/activated|source/i);
  });

  it('shows no blocker copy for a legal Duty', () => {
    expect(dutyBlockedCopy(null)).toBeNull();
  });

  it('keeps unknown diagnostics out of the player-facing notice', () => {
    expect(dutyBlockedCopy('future engine diagnostic')).toBe('Duty: you cannot use it right now.');
    expect(dutyBlockedCopy('toString')).toBe('Duty: you cannot use it right now.');
  });

  it('uses the approved confirmation copy, names whose permanent performed a Duty, and avoids em-dashes', () => {
    expect(DUTY_ACTION_LABEL).toBe('Perform Duty');
    expect(DUTY_CANCEL_LABEL).toBe('Cancel');
    expect(DUTY_PLAYER_LABELS).toEqual(['You', 'Opponent']);
    // The history line follows the Your/Enemy convention of the other permanent lines.
    expect(dutyNarration('Clockwork Keeper', 'you')).toMatch(/^Your Clockwork Keeper /);
    expect(dutyNarration('Clockwork Keeper', 'opponent')).toMatch(/^Enemy Clockwork Keeper /);
    for (const copy of [DUTY_ACTION_LABEL, DUTY_CANCEL_LABEL, ...DUTY_PLAYER_LABELS,
      dutyNarration('Keeper', 'you'), dutyNarration('Keeper', 'opponent')]) {
      expect(copy).not.toContain('\u2014');
    }
  });

  it('says in the history what the Duty did, for either side, without its cost', () => {
    // Two Duties on one permanent, the shape of The Glass That Came Back.
    const lamp: CardDef = {
      id: 'lamp', name: 'Two-Duty Lamp', types: ['artifact'], subtypes: [], colors: ['U'], rarity: 'r',
      activated: [
        { cost: { tap: true }, ops: [{ op: 'foresee', n: 2 }] },
        { cost: { tap: true, mana: { generic: 2, pips: {} } }, ops: [{ op: 'draw', n: 1 }] },
      ],
    };
    const first = dutyEffectText(lamp, 0);
    const second = dutyEffectText(lamp, 1);
    expect(first).toMatch(/foresee 2/i);
    expect(second).toMatch(/draw a card/i);
    for (const effect of [first, second]) expect(effect).not.toMatch(/\{T\}|\{2\}|\n/);
    const yours = dutyNarration('[Two-Duty Lamp]', 'you', second);
    const theirs = dutyNarration('[Two-Duty Lamp]', 'opponent', second);
    expect(yours).toMatch(/^Your \[Two-Duty Lamp\] /);
    expect(theirs).toMatch(/^Enemy \[Two-Duty Lamp\] /);
    for (const line of [yours, theirs]) {
      expect(line).toContain(second);
      expect(line).not.toMatch(/\n|\u2014/);
    }
  });

  it('chips a usable Duty so it reads apart from an attacker, which has no chip', () => {
    expect(permanentActionLabel(null, false)).toBeNull();
    expect(permanentActionLabel(null, true)).toBe('Duty');
    // One chip per tile: a legal Hauntlink move names itself first.
    expect(permanentActionLabel('Link', true)).toBe('Link');
  });

  it('explains a Duty click in a response window: the stack in your own Morning, the phase otherwise', () => {
    const state = board('free');
    state.awaiting = { kind: 'respond', player: 0, over: { type: 'attackers' } };
    const blocked = activatedBlockers(state, DB, 0, state.battlefield[0]);
    expect(blocked).not.toBeNull();
    expect(dutyBlockedCopy(dutyWindowReason(blocked, true))).toBe('Duty: wait for the stack to clear.');
    expect(dutyBlockedCopy(dutyWindowReason(blocked, false))).toBe('Duty: only in your Morning or Afternoon.');
    // Every other blocker keeps its own explanation.
    expect(dutyWindowReason('Activated source is tapped', true)).toBe('Activated source is tapped');
    expect(dutyWindowReason(null, true)).toBeNull();
  });

  it('draws multi-Duty rows in the card face order: mana pips, then the tap, then the effect', () => {
    // The Glass That Came Back's shape: a free tap and a paid tap.
    const glass: CardDef = { ...DB.free, id: 'glass', activated: [
      { cost: { tap: true }, ops: [{ op: 'foresee', n: 2 }] },
      { cost: { tap: true, mana: { generic: 2, pips: {} } }, ops: [{ op: 'draw', n: 1 }] },
    ] };
    const pips = (raw: string) => segmentManaText(raw).flatMap((segment) => segment.kind === 'pipRun' ? segment.pips : []);
    const [free, paid] = dutyChoices(glass, 1, []).map((choice) => dutyRowPips(choice.line));
    for (const row of [free, paid]) {
      // ManaText has no tap symbol: no literal token survives, one pip becomes the tap.
      expect(row.raw).not.toContain('{T}');
      expect(row.tapPips).toHaveLength(1);
    }
    // A free Duty opens on the tap.
    expect(free.tapPips[0]).toBe(0);
    // A paid Duty prints its mana first, as the card face does (#394).
    expect(pips(paid.raw).slice(0, paid.tapPips[0])).toEqual([{ texture: 'pip-C', number: 2 }]);
  });

  it('uses the picker for hidden permanents and grave targets while retaining every mixed option', () => {
    const visible = new Set([20]);
    const face: TargetRef = { kind: 'player', player: 1 };
    const grave: TargetRef = { kind: 'grave', player: 0, index: 0 };
    expect(dutyTargetsNeedPicker([permanent(20), face], visible)).toBe(false);
    expect(dutyTargetsNeedPicker([permanent(40)], visible)).toBe(true); // land without a tile
    expect(dutyTargetsNeedPicker([permanent(60)], visible)).toBe(true); // attached ordinary Aura
    expect(dutyTargetsNeedPicker([grave], visible)).toBe(true);
    expect(dutyTargetsNeedPicker([], visible)).toBe(false); // zero optional targets
    const offered: DutyAction[] = [permanent(20), permanent(40), face].map((target) => ({
      type: 'activate', iid: 10, targets: [target],
    }));
    const step = dutyTargetStep(offered, []);
    expect(dutyTargetsNeedPicker(step.targets, visible)).toBe(true);
    expect(step.targets).toEqual([permanent(20), permanent(40), face]);
  });

  it('keeps a target-free confirmation attached to the original legal action', () => {
    const offered = actions(board('free'));
    const step = dutyTargetStep(offered, []);
    expect(step.targets).toEqual([]);
    expect(step.complete).toBe(offered[0]);
    expect(step.complete?.targets).toBeUndefined();
  });

  it('changes the menu snapshot key after submission and Undo restoration', () => {
    const state = board('free');
    const game = Game.restore(state, DB);
    const before = game.state;
    expect(game.state).toBe(before);
    const undo = game.clone();
    game.submit(0, actions(state)[0]);
    expect(game.state).not.toBe(before);
    expect(actions(game.state)).toEqual([]);
    expect(undo.state).not.toBe(before);
    expect(undo.state).not.toBe(game.state);
    expect(actions(undo.state)).toHaveLength(1);
  });

  it('waits for every required target and preserves donor/recipient order', () => {
    const state = board('move');
    const offered = actions(state);
    expect(dutyTargetStep(offered, []).targets).toEqual([permanent(20)]);
    const first = dutyTargetStep(offered, [permanent(20)]);
    expect(first.complete).toBeNull();
    expect(first.targets).toEqual([permanent(30)]);
    const second = dutyTargetStep(first.actions, [permanent(20), permanent(30)]);
    expect(second.targets).toEqual([]);
    expect(second.complete).toBe(offered[0]);
    expect(validateAction(state, DB, 0, second.complete!)).toBeNull();
    expect(dutyTargetStep(offered, [permanent(30)]).actions).toEqual([]);
    const game = Game.restore(state, DB);
    game.submit(0, second.complete!);
    expect(game.state.battlefield.find((perm) => perm.iid === 20)?.plusOneCounters).toBe(0);
    expect(game.state.battlefield.find((perm) => perm.iid === 30)?.plusOneCounters).toBe(1);
  });

  it('allows zero, one, or two optional targets without choosing an unpicked target', () => {
    const offered = actions(board('optional'));
    const zero = dutyTargetStep(offered, [], true);
    expect(zero.complete?.targets).toEqual([]);
    expect(zero.targets).toEqual([permanent(20), permanent(30)]);
    const one = dutyTargetStep(offered, [permanent(20)], true);
    expect(one.complete?.targets).toEqual([permanent(20)]);
    expect(one.targets).toEqual([permanent(30)]);
    const two = dutyTargetStep(one.actions, [permanent(20), permanent(30)], true);
    expect(two.complete?.targets).toEqual([permanent(20), permanent(30)]);
    expect(two.targets).toEqual([]);
  });

  it('accepts either optional target first while submitting the original canonical pair', () => {
    const state = board('optional');
    const offered = actions(state);
    const first = dutyTargetStep(offered, [permanent(30)], true);
    expect(first.targets).toEqual([permanent(20)]);
    const second = dutyTargetStep(first.actions, [permanent(30), permanent(20)], true);
    expect(second.complete).toBe(offered.find((action) => action.targets?.length === 2));
    expect(second.complete?.targets).toEqual([permanent(20), permanent(30)]);
    expect(validateAction(state, DB, 0, second.complete!)).toBeNull();
  });

  it('rejects illegal picks and duplicate optional targets', () => {
    const offered = actions(board('optional'));
    for (const picked of [[permanent(99)], [permanent(20), permanent(20)]]) {
      expect(dutyTargetStep(offered, picked, true)).toEqual({ actions: [], targets: [], complete: null });
    }
  });

  it('keeps graveyard owner and physical index distinct through sequential picks', () => {
    const first: TargetRef = { kind: 'grave', player: 0, index: 2 };
    const otherOwner: TargetRef = { kind: 'grave', player: 1, index: 2 };
    const otherIndex: TargetRef = { kind: 'grave', player: 0, index: 3 };
    const offered: DutyAction[] = [first, otherOwner, otherIndex].map((target) => ({
      type: 'activate', iid: 10, targets: [target, permanent(30)],
    }));
    expect(dutyTargetStep(offered, []).targets).toEqual([first, otherOwner, otherIndex]);
    const chosen = dutyTargetStep(offered, [first]);
    expect(chosen.actions).toEqual([offered[0]]);
    expect(chosen.complete).toBeNull();
    expect(dutyTargetStep(chosen.actions, [first, permanent(30)]).complete).toBe(offered[0]);
  });

  it('submits the picked paid Duty with its source and solved mana sources tapped', () => {
    const state = board('paid');
    const offered = actions(state);
    const plan = solveMana(state, DB, 0, activatedAbilitiesOf(DB.paid)[0].cost.mana!);
    expect(plan).toEqual([40, 50]);
    const picked = dutyTargetStep(offered, [{ kind: 'player', player: 1 }]).complete!;
    const game = Game.restore(state, DB);
    const events = game.submit(0, picked);
    expect(events).toContainEqual({ e: 'activated', player: 0, iid: 10, cardId: 'paid' });
    expect(game.state.players[1].life).toBe(19);
    for (const iid of [10, ...plan!]) {
      expect(game.state.battlefield.find((perm) => perm.iid === iid)?.tapped).toBe(true);
    }
    const blocked = activatedBlockers(game.state, DB, 0, game.state.battlefield[0]);
    expect(blocked).toBe('Activated source is tapped');
    expect(dutyBlockedCopy(blocked)).toBe('Duty: this permanent is tapped.');
  });
});
