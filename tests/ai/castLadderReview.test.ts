import { describe, expect, it } from 'vitest';
import { MediumAI } from '../../src/ai/MediumAI';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { createRngState } from '../../src/engine/rng';
import type { AbilityDef, CardDb, CardDef, EffectOp, GameState, Permanent, PlayerId, TargetRef } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const cost = (generic: number) => ({ generic, pips: {} });
const creature = (id: string, attack: number, defense: number, mana = 2, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], colors: [], rarity: 'c', cost: cost(mana), attack, defense, ...extra,
});
const spell = (id: string, ops: EffectOp[], targets?: AbilityDef['targets'], ritual = false): CardDef => ({
  id, name: id, types: [ritual ? 'ritual' : 'charm'], subtypes: [], colors: [], rarity: 'c', cost: cost(1),
  abilities: [{ when: 'spell', ops, ...(targets ? { targets } : {}) }],
});
const DB: CardDb = {
  ...TEST_DB,
  small: creature('small', 1, 1, 1),
  two: creature('two', 2, 2),
  three: creature('three', 3, 3, 3),
  four: creature('four', 4, 4, 3),
  six: creature('six', 6, 6, 2),
  eight: creature('eight', 8, 8, 6),
  untouchable_wall: creature('untouchable_wall', 0, 6, 5, { keywords: ['untouchable'] }),
  branch_shrink: spell('branch_shrink', [{ op: 'ifTargetMarked',
    then: [{ op: 'boost', p: -5, t: -5, scope: 'target' }],
    else: [{ op: 'boost', p: -2, t: -2, scope: 'target' }],
  }], [{ what: 'creature' }]),
  branch_weaken: spell('branch_weaken', [{ op: 'ifTargetMarked',
    then: [{ op: 'boost', p: -4, t: -2, scope: 'target' }],
    else: [{ op: 'boost', p: -3, t: -1, scope: 'target' }],
  }], [{ what: 'creature' }]),
  split_damage: spell('split_damage', [
    { op: 'damage', n: 2, to: 'target', targetIndex: 0 },
    { op: 'damage', n: 2, to: 'target', targetIndex: 1 },
  ], [{ what: 'opponentCreature', exactly: 2 }]),
  split_shrink: spell('split_shrink', [
    { op: 'boost', p: -1, t: -2, scope: 'target', targetIndex: 0 },
    { op: 'boost', p: -1, t: -2, scope: 'target', targetIndex: 1 },
  ], [{ what: 'opponentCreature', exactly: 2 }]),
  fog_pump: spell('fog_pump', [{ op: 'boost', p: 0, t: 3, scope: 'target' }, { op: 'preventCombat' }], [{ what: 'creature' }]),
  damage_wrath: spell('damage_wrath', [{ op: 'damage', n: 3, to: 'target' }, { op: 'massDestroy', filter: 'allCreatures' }],
    [{ what: 'creature' }]),
  mark_wrath: spell('mark_wrath', [{ op: 'addCounters', n: 1, to: 'target' }, { op: 'massDestroy', filter: 'allCreatures' }],
    [{ what: 'yourCreature' }], true),
  tap: spell('tap', [{ op: 'tap', to: 'target' }], [{ what: 'creature' }]),
  fog: spell('fog', [{ op: 'preventCombat' }]),
  shelter: spell('shelter', [{ op: 'preventCombatTo', to: 'target' }], [{ what: 'yourCreature' }]),
  rescue: spell('rescue', [{ op: 'recall', to: 'target' }], [{ what: 'yourCreature' }]),
  counter: spell('counter', [{ op: 'cancel', to: 'target' }], [{ what: 'spell' }]),
  pause: { ...spell('pause', [{ op: 'draw', n: 1 }]), cost: cost(0) },
};

const ref = (iid: number): TargetRef => ({ kind: 'permanent', iid });
const body = (iid: number, cardId: string, controller: PlayerId = 0, extra: Partial<Permanent> = {}): Partial<Permanent> =>
  ({ iid, cardId, controller, ...extra });
const lands = (n: number, controller: PlayerId = 0): Partial<Permanent>[] =>
  Array.from({ length: n }, (_, index) => body(100 + controller * 20 + index, 'forest', controller));

function board(hand: string[], battlefield: Partial<Permanent>[], setup?: (state: GameState) => void): Game {
  const state = makeTestState({ hands: [hand, []], battlefield });
  state.rng = createRngState(41);
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 1000;
  for (const player of state.players) {
    player.deck = Array<string>(20).fill('bear');
    player.landDropsUsed = 1;
  }
  setup?.(state);
  return Game.restore(state, DB);
}

function choose(game: Game): Action {
  const awaiting = game.awaiting;
  if (awaiting.kind === 'gameOver') throw new Error('Expected a live decision');
  const view = game.viewFor(awaiting.player);
  const menu = game.legalActions(awaiting.player);
  const before = structuredClone({ view, menu });
  const action = new MediumAI(DB).chooseAction(view, menu);
  expect(validateAction(game.instanceState, DB, awaiting.player, action)).toBeNull();
  expect({ view, menu }).toEqual(before);
  return action;
}

function submit(game: Game, player: PlayerId, action: Action): void {
  expect(validateAction(game.instanceState, DB, player, action)).toBeNull();
  game.submit(player, action);
}

function combatBoard(hand: string[], blocked = false, response = 'pause'): Game {
  return board(hand, [...lands(2), ...lands(1, 1), body(20, 'eight', 1, { tapped: true }),
    ...(blocked ? [body(10, 'six')] : [])], (state) => {
    state.activePlayer = 1;
    state.step = 'combat';
    state.players[0].life = blocked ? 20 : 4;
    state.players[1].hand = [response];
    state.awaiting = { kind: 'respond', player: 0, over: { type: 'blockers' } };
    state.combat = { attackers: [20], blocks: blocked ? [{ blocker: 10, attacker: 20 }] : [],
      phase: 'blockersDeclared', damagePrevented: false };
  });
}

describe('cast ladder adversarial regressions', () => {
  it('uses the selected marked and unmarked debuff branches as lethal removal', () => {
    for (const marked of [false, true]) {
      const game = board(['branch_shrink'], [...lands(1),
        body(20, marked ? 'four' : 'two', 1, { plusOneCounters: marked ? 1 : 0 })]);
      const action = choose(game);
      expect(action).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(20)] });
      submit(game, 0, action);
      expect(game.state.battlefield.some((permanent) => permanent.iid === 20)).toBe(false);
    }
  });

  it('uses a branch-selected nonlethal debuff to save a losing blocker', () => {
    const game = board(['branch_weaken'], [...lands(1), body(10, 'two'), body(20, 'three', 1, { tapped: true })], (state) => {
      state.activePlayer = 1;
      state.step = 'combat';
      state.awaiting = { kind: 'respond', player: 0, over: { type: 'blockers' } };
      state.combat = { attackers: [20], blocks: [{ blocker: 10, attacker: 20 }], phase: 'blockersDeclared', damagePrevented: false };
    });
    const action = choose(game);
    expect(action).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(20)] });
    submit(game, 0, action);
    expect(game.state.battlefield.some((permanent) => permanent.iid === 10)).toBe(true);
    expect(game.state.battlefield.some((permanent) => permanent.iid === 20)).toBe(false);
  });

  it('does not combine distinct target slots into a false damage or debuff kill', () => {
    for (const id of ['split_damage', 'split_shrink']) {
      const game = board([id], [...lands(1), body(20, 'four', 1), body(21, 'four', 1)]);
      const split: Action = { type: 'castSpell', handIndex: 0, targets: [ref(20), ref(21)] };
      expect(game.legalActions(0)).toContainEqual(split);
      expect(choose(game)).toEqual({ type: 'passStep' });
      // The engine confirms that the legal split hurts both bodies but kills neither.
      submit(game, 0, split);
      expect(game.state.battlefield.filter((permanent) => permanent.controller === 1).map((permanent) => permanent.iid))
        .toEqual([20, 21]);
    }
  });

  it('recognizes removal in a later target slot without assigning it to the first body', () => {
    const game = board(['split_damage'], [...lands(1), body(20, 'four', 1), body(21, 'two', 1)]);
    const action = choose(game);
    expect(action).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(20), ref(21)] });
    submit(game, 0, action);
    expect(game.state.battlefield.some((permanent) => permanent.iid === 20)).toBe(true);
    expect(game.state.battlefield.some((permanent) => permanent.iid === 21)).toBe(false);
  });

  it('does not reach the positive-pump fallback with a fog-bearing Charm', () => {
    const game = board(['fog_pump'], [...lands(1), body(10, 'four', 0, { tapped: true })], (state) => {
      state.step = 'combat';
      state.players[1].life = 4;
      state.awaiting = { kind: 'respond', player: 0, over: { type: 'blockers' } };
      state.combat = { attackers: [10], blocks: [], phase: 'blockersDeclared', damagePrevented: false };
    });
    expect(game.legalActions(0)).toContainEqual({ type: 'castSpell', handIndex: 0, targets: [ref(10)] });
    const action = choose(game);
    expect(action).toEqual({ type: 'passResponse' });
    submit(game, 0, action);
    expect(game.state.winner).toBe(0);
  });

  it('keeps mixed targeted-removal and mark spells behind the wrath asymmetry gate', () => {
    for (const id of ['damage_wrath', 'mark_wrath']) {
      const game = board([id], [...lands(1), body(10, 'eight'), body(11, 'eight'), body(20, 'three', 1)]);
      expect(game.legalActions(0).some((action) => action.type === 'castSpell')).toBe(true);
      expect(choose(game)).toEqual({ type: 'passStep' });
    }
  });

  it('taps a legal blocker for lethal when the highest-value blocker is Untouchable', () => {
    const game = board(['tap'], [...lands(1), body(10, 'four'), body(11, 'four'),
      body(20, 'untouchable_wall', 1), body(21, 'small', 1)], (state) => { state.players[1].life = 4; });
    expect(game.legalActions(0)).not.toContainEqual({ type: 'castSpell', handIndex: 0, targets: [ref(20)] });
    const action = choose(game);
    expect(action).toEqual({ type: 'castSpell', handIndex: 0, targets: [ref(21)] });
    submit(game, 0, action);
    expect(game.state.battlefield.find((permanent) => permanent.iid === 21)?.tapped).toBe(true);
    submit(game, 0, { type: 'passStep' });
    submit(game, 0, { type: 'declareAttackers', attackers: [10, 11] });
    submit(game, 1, { type: 'declareBlockers', blocks: [{ blocker: 20, attacker: 10 }] });
    expect(game.state.winner).toBe(0);
  });

  it('holds a second fog when a public pending fog already prevents lethal combat', () => {
    const game = combatBoard(['fog', 'fog']);
    submit(game, 0, { type: 'castSpell', handIndex: 0 });
    submit(game, 1, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ kind: 'respond', player: 0 });
    expect(game.viewFor(0).fogThisTurn).toBe(false);
    expect(game.viewFor(0).stack.map((item) => item.cardId)).toEqual(['fog', 'pause']);
    const action = choose(game);
    expect(action).toEqual({ type: 'passResponse' });
    submit(game, 0, action);
    expect(game.state.players[0].life).toBe(4);
  });

  it('holds recall when pending global or targeted prevention already saves its blocker', () => {
    for (const protection of ['fog', 'shelter']) {
      const game = combatBoard([protection, 'rescue'], true);
      submit(game, 0, { type: 'castSpell', handIndex: 0, ...(protection === 'shelter' ? { targets: [ref(10)] } : {}) });
      submit(game, 1, { type: 'castSpell', handIndex: 0 });
      expect(game.awaiting).toMatchObject({ kind: 'respond', player: 0 });
      const action = choose(game);
      expect(action).toEqual({ type: 'passResponse' });
      submit(game, 0, action);
      expect(game.state.battlefield.some((permanent) => permanent.iid === 10)).toBe(true);
      expect(game.state.players[0].hand).toContain('rescue');
    }
  });

  it('replaces a pending fog that the opponent has countered', () => {
    const game = combatBoard(['fog', 'fog'], false, 'counter');
    submit(game, 0, { type: 'castSpell', handIndex: 0 });
    const fog = game.viewFor(1).stack.at(-1)!;
    submit(game, 1, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'stackItem', sid: fog.sid }] });
    const action = choose(game);
    expect(action).toEqual({ type: 'castSpell', handIndex: 0 });
    submit(game, 0, action);
    expect(game.state.players[0].life).toBe(4);
  });
});
