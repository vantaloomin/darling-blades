import { describe, expect, it } from 'vitest';
import { MediumAI } from '../../src/ai/MediumAI';
import { LIFE_CURVE_KNEE } from '../../src/ai/evaluate';
import {
  abilityConditionMultiplier, cardValue, faceDamageForCast, questBoardValue, removalKind,
} from '../../src/ai/value';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { createRngState } from '../../src/engine/rng';
import type { AbilityDef, CardDb, CardDef, EffectOp, GameState, Permanent, PlayerId, TargetRef } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const cost = (generic: number) => ({ generic, pips: {} });
const creature = (id: string, attack: number, defense: number, mana = 2, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], colors: [], rarity: 'c', cost: cost(mana), attack, defense, ...extra,
});
const spell = (id: string, mana: number, ops: EffectOp[], targets?: AbilityDef['targets'], ritual = false,
  extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: [ritual ? 'ritual' : 'charm'], subtypes: [], colors: [], rarity: 'c', cost: cost(mana),
  abilities: [{ when: 'spell', ops, ...(targets ? { targets } : {}) }], ...extra,
});
const combo: EffectOp[] = [{ op: 'damage', to: 'opponent', n: 2 }, { op: 'loseLife', who: 'opponent', n: 2 }, { op: 'gainLife', n: 3 }];
const DB: CardDb = {
  ...TEST_DB,
  small: creature('small', 1, 1, 1),
  three: creature('three', 3, 3, 3),
  four: creature('four', 4, 4, 3),
  six: creature('six', 6, 6, 2),
  eight: creature('eight', 8, 8, 6),
  barrier: creature('barrier', 0, 6, 2),
  token_six: creature('token_six', 6, 6, 0, { token: true }),
  flying_small: creature('flying_small', 2, 2, 2, { keywords: ['skyborne'] }),
  flying_six: creature('flying_six', 6, 6, 6, { keywords: ['skyborne'] }),
  fog: spell('fog', 1, [{ op: 'preventCombat' }]),
  shelter: spell('shelter', 1, [{ op: 'preventCombatTo', to: 'target' }], [{ what: 'creature' }]),
  tap: spell('tap', 1, [{ op: 'tap', to: 'target' }], [{ what: 'creature' }]),
  tap_all: spell('tap_all', 1, [{ op: 'tapAll', who: 'opponent' }]),
  shrink: spell('shrink', 1, [{ op: 'boost', p: -1, t: -3, scope: 'target' }], [{ what: 'creature' }]),
  weaken: spell('weaken', 1, [{ op: 'boost', p: -3, t: -1, scope: 'target' }], [{ what: 'creature' }]),
  mark: spell('mark', 1, [{ op: 'addCounters', n: 1, to: 'target' }], [{ what: 'creature' }]),
  move: spell('move', 1, [{ op: 'moveMark' }], [{ what: 'yourCreature' }, { what: 'yourCreature' }]),
  unmark: spell('unmark', 1, [{ op: 'removeMarks', to: 'target' }], [{ what: 'creature' }]),
  rescue: spell('rescue', 1, [{ op: 'recall', to: 'target' }], [{ what: 'yourCreature' }]),
  kill: spell('kill', 1, [{ op: 'destroy', to: 'target' }], [{ what: 'creature' }]),
  scratch: spell('scratch', 1, [{ op: 'damage', to: 'target', n: 2 }], [{ what: 'creature' }]),
  pause: spell('pause', 0, [{ op: 'draw', n: 1 }]),
  heal: spell('heal', 1, [{ op: 'gainLife', n: 20 }]),
  research: spell('research', 2, [{ op: 'draw', n: 3 }], undefined, true),
  blank: spell('blank', 4, [], undefined, true),
  combined: spell('combined', 2, combo, undefined, true),
  expensive_face: spell('expensive_face', 3, [{ op: 'damage', to: 'opponent', n: 4 }], undefined, true),
  whispered_face: spell('whispered_face', 8, combo, undefined, true, { whispers: { cost: cost(1) } }),
  retold_face: spell('retold_face', 8, [{ op: 'damage', to: 'opponent', n: 1 }], undefined, true,
    { retell: { cost: cost(1), ops: combo } }),
  face_charm: spell('face_charm', 1, [{ op: 'damage', to: 'opponent', n: 2 }]),
  drain_charm: spell('drain_charm', 1, [{ op: 'loseLife', who: 'opponent', n: 2 }, { op: 'gainLife', n: 2 }]),
  indexed_face: spell('indexed_face', 1, [
    { op: 'damage', to: 'target', n: 1, targetIndex: 0 },
    { op: 'damage', to: 'target', n: 3, targetIndex: 1 },
  ], [{ what: 'yourCreature' }, { what: 'player' }]),
  creature_sweep: spell('creature_sweep', 3, [{ op: 'massDestroy', filter: 'allCreatures' }], undefined, true),
  flying_sweep: spell('flying_sweep', 3, [{ op: 'massDestroy', filter: 'allFliers' }], undefined, true),
  damage_sweep: spell('damage_sweep', 3, [{ op: 'damage', to: 'eachCreature', n: 6 }], undefined, true),
  threshold: {
    id: 'threshold', name: 'threshold', types: ['artifact'], subtypes: [], colors: [], rarity: 'c', cost: cost(10),
    abilities: [{ when: 'dawn', condition: { kind: 'markedThreshold', n: 2, subject: 'creatures' }, ops: [{ op: 'draw', n: 3 }] }],
  },
  quest: {
    id: 'quest', name: 'quest', types: ['enchantment'], subtypes: [], colors: [], rarity: 'c', cost: cost(2),
    chapters: [[{ op: 'draw', n: 1 }], [{ op: 'gainLife', n: 1 }]],
  },
  quest_body: creature('quest_body', 3, 3, 3, {
    abilities: [{ when: 'dawn', condition: 'questActive', ops: [{ op: 'draw', n: 2 }] }],
  }),
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

function combatWindow(hand: string[], battlefield: Partial<Permanent>[], blocks: { blocker: number; attacker: number }[] = [], life = 20): Game {
  return board(hand, battlefield, (state) => {
    state.activePlayer = 1;
    state.step = 'combat';
    state.players[0].life = life;
    state.awaiting = { kind: 'respond', player: 0, over: { type: 'blockers' } };
    state.combat = { attackers: [20], blocks, phase: 'blockersDeclared', damagePrevented: false };
  });
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

function cast(game: Game, expected: Partial<Extract<Action, { type: 'castSpell' }>> = {}): Action {
  const action = choose(game);
  expect(action).toMatchObject({ type: 'castSpell', ...expected });
  return action;
}

describe('Medium combat Charms', () => {
  it('fogs lethal damage or damage below the life-curve knee, and holds at the knee', () => {
    expect(LIFE_CURVE_KNEE).toBe(9);
    for (const [life, wanted] of [[4, 'castSpell'], [10, 'castSpell'], [13, 'passResponse']] as const) {
      const game = combatWindow(['fog'], [...lands(1), body(20, 'four', 1, { tapped: true })], [], life);
      expect(choose(game).type).toBe(wanted);
    }
  });

  it('uses both global and targeted prevention to save a valuable blocked creature', () => {
    for (const id of ['fog', 'shelter']) {
      const game = combatWindow([id], [...lands(1), body(10, 'six'), body(20, 'eight', 1, { tapped: true })],
        [{ blocker: 10, attacker: 20 }]);
      const action = cast(game, id === 'shelter' ? { targets: [ref(10)] } : {});
      game.submit(0, action);
      expect(game.state.battlefield.some((permanent) => permanent.iid === 10)).toBe(true);
    }
  });

  it('holds prevention in develop and at an end step without combat to prevent', () => {
    for (const id of ['fog', 'shelter']) {
      for (const end of [false, true]) {
        const game = board([id], [...lands(1), body(10, 'six')], (state) => {
          if (end) {
            state.activePlayer = 1;
            state.step = 'end';
            state.awaiting = { kind: 'endStepWindow', player: 0 };
          }
        });
        expect(choose(game)).toEqual({ type: end ? 'passResponse' : 'passStep' });
      }
    }
  });

  it('taps the best blocker before a lethal or clearly profitable attack', () => {
    for (const life of [4, 20]) {
      const game = board(['tap'], [...lands(1), body(10, 'four'), body(20, 'barrier', 1)],
        (state) => { state.players[1].life = life; });
      cast(game, { targets: [ref(20)] });
    }
  });

  it('uses tapAll only when removing the blockers makes the attack lethal', () => {
    for (const life of [4, 20]) {
      const game = board(['tap_all'], [...lands(1), body(10, 'four'), body(20, 'barrier', 1)],
        (state) => { state.players[1].life = life; });
      expect(choose(game)).toEqual(life === 4 ? { type: 'castSpell', handIndex: 0 } : { type: 'passStep' });
    }
  });

  it('taps the best opposing attacker in a legal main-one response when blocks improve', () => {
    const game = board(['tap'], [...lands(1), body(10, 'three'), body(20, 'six', 1), body(21, 'bear', 1)], (state) => {
      state.activePlayer = 1;
      state.awaiting = { kind: 'main', player: 1 };
      state.players[1].hand = ['pause'];
      state.players[0].life = 7;
    });
    game.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ kind: 'respond', player: 0 });
    expect(game.state.step).toBe('main1');
    expect(game.state.combat).toBeNull();
    cast(game, { targets: [ref(20)] });
  });

  it('does not tap a creature that has already been declared as an attacker', () => {
    const game = combatWindow(['tap'], [...lands(1), body(20, 'six', 1, { tapped: true })]);
    expect(game.legalActions(0).some((action) => action.type === 'castSpell')).toBe(true);
    expect(choose(game)).toEqual({ type: 'passResponse' });
  });

  it('uses a killing debuff as removal and holds the same nonlethal debuff outside combat', () => {
    for (const enemy of ['three', 'six']) {
      const game = board(['shrink'], [...lands(1), body(20, enemy, 1)]);
      expect(choose(game)).toEqual(enemy === 'three'
        ? { type: 'castSpell', handIndex: 0, targets: [ref(20)] } : { type: 'passStep' });
    }
  });

  it('uses a nonlethal debuff to turn a losing block into a surviving kill', () => {
    const game = combatWindow(['weaken'], [...lands(1), body(10, 'bear'), body(20, 'three', 1, { tapped: true })],
      [{ blocker: 10, attacker: 20 }]);
    const action = cast(game, { targets: [ref(20)] });
    game.submit(0, action);
    expect(game.state.battlefield.some((permanent) => permanent.iid === 10)).toBe(true);
    expect(game.state.battlefield.some((permanent) => permanent.iid === 20)).toBe(false);
  });
});

describe('Medium permanent marks and rescue', () => {
  it('develops a Mark on the healthy valuable body instead of its damaged peer or an enemy', () => {
    const game = board(['mark'], [...lands(1), body(10, 'six', 0, { damage: 5 }), body(11, 'six'), body(20, 'six', 1)]);
    cast(game, { targets: [ref(11)] });
  });

  it('moves an excess Mark to reach a marked-creature threshold in play or in hand', () => {
    for (const inHand of [false, true]) {
      const game = board(['move', ...(inHand ? ['threshold'] : [])], [
        ...lands(1), body(10, 'bear', 0, { plusOneCounters: 2 }), body(11, 'bear'),
        ...(inHand ? [] : [body(30, 'threshold')]),
      ]);
      const action = cast(game, { targets: [ref(10), ref(11)] });
      game.submit(0, action);
      expect(game.state.battlefield.find((permanent) => permanent.iid === 10)?.plusOneCounters).toBe(1);
      expect(game.state.battlefield.find((permanent) => permanent.iid === 11)?.plusOneCounters).toBe(1);
    }
  });

  it('removes an opponent\'s useful Marks while preserving its own', () => {
    const game = board(['unmark'], [...lands(1), body(10, 'bear', 0, { plusOneCounters: 4 }), body(20, 'bear', 1, { plusOneCounters: 4 })]);
    cast(game, { targets: [ref(20)] });
    expect(choose(board(['unmark'], [...lands(1), body(10, 'bear', 0, { plusOneCounters: 4 })])))
      .toEqual({ type: 'passStep' });
  });

  it('recalls its valuable creature from lethal stack removal and holds against a nonlethal scratch', () => {
    for (const removal of ['kill', 'scratch']) {
      const game = board(['rescue'], [...lands(1), ...lands(1, 1), body(10, 'six')], (state) => {
        state.activePlayer = 1;
        state.awaiting = { kind: 'main', player: 1 };
        state.players[1].hand = [removal];
      });
      game.submit(1, { type: 'castSpell', handIndex: 0, targets: [ref(10)] });
      expect(game.awaiting).toMatchObject({ kind: 'respond', player: 0 });
      const action = choose(game);
      expect(action).toEqual(removal === 'kill'
        ? { type: 'castSpell', handIndex: 0, targets: [ref(10)] } : { type: 'passResponse' });
      if (removal === 'kill') {
        game.submit(0, action);
        expect(game.state.players[0].hand).toContain('six');
        expect(game.state.battlefield.some((permanent) => permanent.iid === 10)).toBe(false);
      }
    }
  });

  it('recalls a valuable losing blocker but spends no rescue on a token or a cheap body', () => {
    for (const defender of ['six', 'token_six', 'small']) {
      const game = combatWindow(['rescue'], [...lands(1), body(10, defender), body(20, 'eight', 1, { tapped: true })],
        [{ blocker: 10, attacker: 20 }]);
      expect(choose(game)).toEqual(defender === 'six'
        ? { type: 'castSpell', handIndex: 0, targets: [ref(10)] } : { type: 'passResponse' });
    }
  });
});

describe('Medium spell bodies and face damage', () => {
  it('develops a useful draw Ritual ahead of a creature and a higher-cost blank Ritual', () => {
    const game = board(['bear', 'blank', 'research'], lands(4));
    const view = game.viewFor(0);
    expect(cardValue(DB, 'research')).toBeLessThan(cardValue(DB, 'blank'));
    expect(cardValue(DB, 'research', view)).toBeGreaterThan(cardValue(DB, 'blank', view));
    expect(cardValue(DB, 'research', view)).toBeGreaterThan(cardValue(DB, 'bear', view));
    expect(choose(game)).toEqual({ type: 'castSpell', handIndex: 2 });
  });

  it('combines one targetless spell\'s damage and drain for lethal before developing', () => {
    const game = board(['bear', 'combined'], lands(2), (state) => {
      state.players[0].life = 2;
      state.players[1].life = 4;
      state.fogThisTurn = true;
    });
    const action = cast(game, { handIndex: 1 });
    game.submit(0, action);
    expect(game.state.winner).toBe(0);
  });

  it('counts only the chosen spell\'s face damage, excluding combat and other stack items', () => {
    const game = combatWindow(['combined'], [...lands(2), body(10, 'six'), body(20, 'eight', 1, { tapped: true })]);
    const view = game.viewFor(0);
    view.fogThisTurn = true;
    view.stack = [{ sid: 7, cardId: 'heal', controller: 1, targets: [] }];
    expect(faceDamageForCast(view, DB, 'combined')).toBe(4);
  });

  it('uses the cheaper legal Whispers or Retell lethal mode before an affordable hand lethal', () => {
    for (const alternative of ['whispers', 'retell'] as const) {
      const id = alternative === 'whispers' ? 'whispered_face' : 'retold_face';
      const game = board(['expensive_face', 'bear'], lands(3), (state) => {
        state.players[1].life = 4;
        state.players[0].graveyard = alternative === 'whispers'
          ? [{ cardId: id, instanceId: 1001, variantKey: null, whispersUntilDawnOf: 1 }] : [id];
      });
      expect(game.legalActions(0)).toContainEqual({ type: 'castSpell', handIndex: 0 });
      const action = cast(game, { [alternative]: true, graveIndex: 0 });
      game.submit(0, action);
      expect(game.state.winner).toBe(0);
    }
  });

  it('binds targetIndex damage to the opponent player rather than the first creature target', () => {
    const game = board(['indexed_face', 'bear'], [...lands(2), body(10, 'six')], (state) => { state.players[1].life = 3; });
    const targets: TargetRef[] = [ref(10), { kind: 'player', player: 1 }];
    expect(faceDamageForCast(game.viewFor(0), DB, 'indexed_face', { targets })).toBe(3);
    const action = cast(game, { handIndex: 0, targets });
    game.submit(0, action);
    expect(game.state.winner).toBe(0);
  });

  it('uses targetless damage and drain Charms as reach at eight life and holds them at twelve', () => {
    for (const id of ['face_charm', 'drain_charm']) {
      for (const life of [8, 12]) {
        const game = board([id], lands(1), (state) => { state.players[1].life = life; });
        expect(choose(game)).toEqual(life === 8 ? { type: 'castSpell', handIndex: 0 } : { type: 'passStep' });
      }
    }
  });

  it('applies board asymmetry to creature wraths, flier wraths, and symmetric damage', () => {
    for (const id of ['creature_sweep', 'flying_sweep', 'damage_sweep']) {
      expect(removalKind(DB, id, {})).toBe('massDestroy');
      for (const ahead of [false, true]) {
        const small = id === 'flying_sweep' ? 'flying_small' : 'small';
        const big = id === 'flying_sweep' ? 'flying_six' : 'six';
        const game = board([id], [
          ...lands(3), body(10, ahead ? big : small), body(11, big, ahead ? 0 : 1), body(20, ahead ? small : big, 1),
        ]);
        expect(choose(game)).toEqual(ahead ? { type: 'passStep' } : { type: 'castSpell', handIndex: 0 });
      }
    }
  });
});

describe('Quest valuation and creature compatibility', () => {
  it('prices an in-hand and on-board Quest rider by its controller\'s active Quest', () => {
    const none = board(['quest_body'], [body(10, 'quest_body')]);
    const ours = board(['quest_body'], [body(10, 'quest_body'), body(30, 'quest')]);
    const theirs = board(['quest_body'], [body(10, 'quest_body'), body(30, 'quest', 1)]);
    expect(abilityConditionMultiplier('questActive', false)).toBe(0.55);
    expect(abilityConditionMultiplier('questActive', true)).toBe(1);
    const base = cardValue(DB, 'quest_body');
    const inactive = cardValue(DB, 'quest_body', none.viewFor(0)) - base;
    const active = cardValue(DB, 'quest_body', ours.viewFor(0)) - base;
    expect(active).toBeGreaterThan(0);
    expect(inactive).toBeCloseTo(active * 0.55);
    expect(cardValue(DB, 'quest_body', theirs.viewFor(0))).toBe(cardValue(DB, 'quest_body', none.viewFor(0)));
    expect(questBoardValue(none.viewFor(0).battlefield, DB, 0))
      .toBeCloseTo(questBoardValue(ours.viewFor(0).battlefield, DB, 0) * 0.55);
    expect(questBoardValue(theirs.viewFor(0).battlefield, DB, 0)).toBe(questBoardValue(none.viewFor(0).battlefield, DB, 0));
  });
});
