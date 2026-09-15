import { describe, expect, it } from 'vitest';
import { CURRENT_RULES_REV, RULES } from '../../src/config/rules';
import type { Action } from '../../src/engine/actions';
import { castCost, legalActions, validateAction } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { solveMana } from '../../src/engine/mana';
import { getEffectiveStats } from '../../src/engine/statics';
import type { CardDb, CardDef, GameState, Permanent, PlayerId, TitheDef } from '../../src/engine/types';
import {
  cardIdOf, validateActivatedDef, validateEmpowerDef, validateHauntlinkDef,
  validateRiteDef, validateTitheDef, validateWhispersDef,
} from '../../src/engine/types';
import {
  canReplay, finishReplay, isReplayLog, recordReplayAction, REPLAY_LOG_VERSION,
  replayDbStamp, replayGame, startReplayDraft,
} from '../../src/meta/Replay';
import { botAction, makeTestState, smallGreenDeck, TEST_DB } from '../helpers';

/** Drowned Deep engine fixtures only: no catalog, AI policy or UI dependencies. */
type CastAction = Extract<Action, { type: 'castSpell' }>;

function creature(id: string, defense: number, extra: Partial<CardDef> = {}): CardDef {
  return {
    id, name: id, types: ['creature'], subtypes: ['Beast'], colors: ['G'], rarity: 'c',
    cost: { generic: 0, pips: {} }, attack: 0, defense, ...extra,
  };
}

const DB: CardDb = {
  ...TEST_DB,
  tithe: creature('tithe', 5, { cost: { generic: 3, pips: { G: 1 } }, tithe: { per: 2 } }),
  tithe_small: creature('tithe_small', 4, { cost: { generic: 1, pips: { G: 1 } }, tithe: { per: 2 } }),
  tithe_pips: creature('tithe_pips', 4, { cost: { generic: 0, pips: { G: 1 } }, tithe: { per: 2 } }),
  tithe_empower: creature('tithe_empower', 5, {
    cost: { generic: 3, pips: { G: 1 } }, tithe: { per: 2 },
    empower: { cost: { generic: 2, pips: { G: 1 } }, ops: [{ op: 'gainLife', n: 4 }] },
  }),
  fodder_one: creature('fodder_one', 1),
  fodder_two: creature('fodder_two', 2),
  fodder_three: creature('fodder_three', 3),
  fodder_four: creature('fodder_four', 4),
  fodder_eight: creature('fodder_eight', 8),
  fodder_token: creature('fodder_token', 2, { token: true }),
  fodder_mana: creature('fodder_mana', 2, { manaAbility: ['G'] }),
  fodder_grave: creature('fodder_grave', 2, {
    abilities: [{ when: 'entersGraveyard', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }] }],
  }),
  fodder_spawn: creature('fodder_spawn', 2, {
    abilities: [{ when: 'dies', ops: [{ op: 'createToken', token: 'fodder_token', count: 1 }] }],
  }),
  fodder_order: creature('fodder_order', 2, {
    abilities: [{ when: 'dies', ops: [{ op: 'gainLife', n: 1 }] }],
  }),
  fodder_draw: creature('fodder_draw', 2, {
    abilities: [{ when: 'dies', ops: [{ op: 'draw', n: 1 }] }],
  }),
  fodder_lord: creature('fodder_lord', 1, {
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { other: true }, t: 1 } }],
  }),
  defense_static: {
    id: 'defense_static', name: 'defense_static', types: ['artifact'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'static', static: { scope: 'filter', t: 2 } }],
  },
  counter: {
    id: 'counter', name: 'counter', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'spell', targets: [{ what: 'spell' }], ops: [{ op: 'cancel', to: 'target' }] }],
  },
  tithe_replay: creature('tithe_replay', 3, {
    cost: { generic: 2, pips: { G: 1 } }, tithe: { per: 2 },
    abilities: [{ when: 'arrives', ops: [{ op: 'loseLife', n: 3, who: 'opponent' }] }],
  }),
};

const body = (iid: number, cardId: string, controller: PlayerId = 0): Partial<Permanent> => ({
  iid, cardId, controller,
});
const forests = (count: number): Partial<Permanent>[] =>
  Array.from({ length: count }, (_, index) => body(100 + index, 'forest'));

function board(
  cardId = 'tithe',
  battlefield: Partial<Permanent>[] = [],
  opponentHand: string[] = [],
): GameState {
  const state = makeTestState({ hands: [[cardId], opponentHand], battlefield, active: 0 });
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 1000;
  state.players[0].deck = Array.from({ length: 12 }, () => 'forest');
  state.players[1].deck = Array.from({ length: 12 }, () => 'forest');
  for (const perm of state.battlefield) if (DB[perm.cardId].token) perm.isToken = true;
  return state;
}

function casts(state: GameState, db: CardDb = DB): CastAction[] {
  return legalActions(state, db, 0).filter((action): action is CastAction => action.type === 'castSpell');
}

function titheCost(state: GameState, sacrifices: number[], empowered = false, db: CardDb = DB) {
  return castCost(db[cardIdOf(state.players[0].hand[0])], empowered, false, false, {
    tithe: true, sacrifices, state, db,
  });
}

function titheAction(sacrifices: number[], extra: Partial<CastAction> = {}): CastAction {
  return { type: 'castSpell', handIndex: 0, tithe: true, sacrifices, ...extra };
}

function firstEvent(events: GameEvent[], kind: GameEvent['e']): number {
  const index = events.findIndex((event) => event.e === kind);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe('Tithe definition contract', () => {
  it('accepts a non-Horror creature, Empower and Duty without adding a Duty exclusion', () => {
    expect(DB.tithe.subtypes).not.toContain('Horror');
    expect(validateTitheDef(DB.tithe)).toEqual([]);
    expect(validateTitheDef(DB.tithe_empower)).toEqual([]);
    expect(validateEmpowerDef(DB.tithe_empower)).toEqual([]);
    const duty: CardDef = {
      ...DB.tithe,
      activated: { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] },
    };
    expect(validateTitheDef(duty)).toEqual([]);
    expect(validateActivatedDef(duty)).toEqual([]);
    expect(validateTitheDef(TEST_DB.bear)).toEqual([]);
  });

  it.each(['artifact', 'enchantment', 'ritual', 'charm'] as const)('rejects a %s carrier', (type) => {
    expect(validateTitheDef({ ...DB.tithe, types: [type] }).join('; ')).toMatch(/creature/i);
  });

  it.each([0, 1, 3, 2.5])('rejects a discount divisor of %s', (per) => {
    expect(validateTitheDef({ ...DB.tithe, tithe: { per } as TitheDef }).length).toBeGreaterThan(0);
  });

  it.each([
    ['Retell', { retell: { cost: { generic: 0, pips: {} } } }],
    ['Rite', { rite: { n: 1 } }],
    ['Hauntlink', { hauntlink: { cost: { generic: 0, pips: {} }, linked: { p: 1 } } }],
    ['Whispers', { whispers: { cost: { generic: 0, pips: {} } } }],
    ['X', { x: { min: 1 } }],
  ] as [string, Partial<CardDef>][])('rejects Tithe with %s', (name, patch) => {
    expect(validateTitheDef({ ...DB.tithe, ...patch }).join('; ')).toContain(name);
  });

  it('mirrors exclusions in Rite, Hauntlink and Whispers validators', () => {
    expect(validateRiteDef({ ...DB.tithe, rite: { n: 1 } }).join('; ')).toContain('Tithe');
    expect(validateHauntlinkDef({
      ...DB.tithe, types: ['artifact'],
      hauntlink: { cost: { generic: 0, pips: {} }, linked: { p: 1 } },
    }).join('; ')).toContain('Tithe');
    expect(validateWhispersDef({
      ...DB.tithe, whispers: { cost: { generic: 0, pips: {} } },
    }).join('; ')).toContain('Tithe');
  });
});

describe('Tithe shared cast cost', () => {
  it.each([
    { defense: 0, ids: [], generic: 3 },
    { defense: 1, ids: ['fodder_one'], generic: 3 },
    { defense: 2, ids: ['fodder_one', 'fodder_one'], generic: 2 },
    { defense: 3, ids: ['fodder_one', 'fodder_two'], generic: 2 },
    { defense: 4, ids: ['fodder_two', 'fodder_two'], generic: 1 },
  ])(
    'rounds $defense combined Defense down once and leaves $generic generic', ({ ids, generic }) => {
      const state = board('tithe', ids.map((id, index) => body(10 + index, id)));
      expect(titheCost(state, ids.map((_id, index) => 10 + index))).toEqual({ generic, pips: { G: 1 } });
    },
  );

  it('never discounts colored pips or goes below zero, and leaves the printed cost intact', () => {
    const d: CardDef = { ...DB.tithe, cost: { generic: 1, pips: { B: 1, U: 2 } } };
    const db = { ...DB, tithe: d };
    const state = board('tithe', [body(10, 'fodder_eight')]);
    expect(titheCost(state, [10], false, db)).toEqual({ generic: 0, pips: { B: 1, U: 2 } });
    expect(d.cost).toEqual({ generic: 1, pips: { B: 1, U: 2 } });
    expect(castCost(d, false)).toEqual(d.cost);
  });

  it('counts marks, continuous statics and temporary Defense at the moment of casting', () => {
    const state = board('tithe', [
      { ...body(10, 'fodder_one'), plusOneCounters: 1, untilEotMods: [{ p: 0, t: 2, keywords: [] }] },
      body(20, 'defense_static'),
    ]);
    expect(getEffectiveStats(state.battlefield, DB, 10).defense).toBe(6);
    expect(titheCost(state, [10])).toEqual({ generic: 0, pips: { G: 1 } });
  });

  it('applies the discount to the combined printed and Empower generic cost', () => {
    const state = board('tithe_empower', [body(10, 'fodder_eight')]);
    expect(titheCost(state, [10], false)).toEqual({ generic: 0, pips: { G: 1 } });
    expect(titheCost(state, [10], true)).toEqual({ generic: 1, pips: { G: 2 } });
    expect(castCost(DB.tithe_empower, true)).toEqual({ generic: 5, pips: { G: 2 } });
  });
});

describe('Tithe legal actions and sacrifice validation', () => {
  it('offers only the full-price cast and one ascending-Defense canonical set per Empower mode', () => {
    const state = board('tithe_empower', [
      ...forests(10), body(20, 'fodder_four'), body(10, 'fodder_one'),
      body(30, 'fodder_three'), body(5, 'fodder_two'),
    ]);
    const offered = casts(state);
    expect(offered).toHaveLength(4);
    expect(offered.filter((action) => !action.empowered).map((action) => action.sacrifices ?? [])).toEqual([[], [10, 5, 30]]);
    expect(offered.filter((action) => action.empowered).map((action) => action.sacrifices ?? [])).toEqual([[], [10, 5, 30, 20]]);
    for (const action of offered) {
      expect(validateAction(state, DB, 0, action)).toBeNull();
      if (action.sacrifices?.length) expect(action.tithe).toBe(true);
    }
  });

  it('sorts by effective Defense and preserves battlefield order for equal Defense', () => {
    const state = board('tithe_small', [
      ...forests(2), { ...body(10, 'fodder_one'), plusOneCounters: 3 },
      body(30, 'fodder_two'), body(20, 'fodder_two'),
    ]);
    expect(casts(state).filter((action) => action.tithe).map((action) => action.sacrifices)).toEqual([[30]]);
  });

  it('offers ordinary and canonical casts only for qualified creature targets, never player refs', () => {
    const db: CardDb = {
      ...DB,
      tithe_small: {
        ...DB.tithe_small,
        empower: {
          cost: { generic: 0, pips: {} },
          targets: [{ what: 'any', marked: true, tapped: true }, { what: 'creature', marked: true, tapped: true }],
          ops: [{ op: 'moveMark' }],
        },
      },
    };
    const state = board('tithe_small', [
      ...forests(2), body(10, 'fodder_two'),
      { ...body(20, 'fodder_two'), plusOneCounters: 1, tapped: true },
      { ...body(30, 'fodder_two'), plusOneCounters: 1, tapped: true },
      { ...body(40, 'fodder_two', 1), tapped: true },
      { ...body(50, 'fodder_two', 1), plusOneCounters: 1 },
    ]);
    expect(validateEmpowerDef(db.tithe_small)).toEqual([]);
    const offered = casts(state, db).filter((action) => action.empowered);
    expect(offered).toHaveLength(4);
    for (const tithe of [false, true]) {
      const variants = offered.filter((action) => (action.tithe === true) === tithe);
      expect(variants.map((action) => action.targets)).toEqual([
        [{ kind: 'permanent', iid: 20 }, { kind: 'permanent', iid: 30 }],
        [{ kind: 'permanent', iid: 30 }, { kind: 'permanent', iid: 20 }],
      ]);
      if (tithe) expect(variants.map((action) => action.sacrifices)).toEqual([[10], [10]]);
    }
    for (const action of offered) expect(validateAction(state, db, 0, action)).toBeNull();
    expect(validateAction(state, db, 0, titheAction([10], {
      empowered: true,
      targets: [{ kind: 'player', player: 1 }, { kind: 'permanent', iid: 20 }],
    }))).toMatch(/illegal target/);
  });

  it('uses all available bodies if their combined discount cannot cover generic', () => {
    const state = board('tithe', [
      ...forests(4), body(30, 'fodder_two'), body(20, 'fodder_one'), body(10, 'fodder_one'),
    ]);
    expect(casts(state).map((action) => action.sacrifices ?? [])).toEqual([[], [20, 10, 30]]);
  });

  it('does not duplicate the no-sacrifice offer with no bodies or no generic cost', () => {
    expect(casts(board('tithe_small', forests(2)))).toHaveLength(1);
    expect(casts(board('tithe_pips', [...forests(1), body(10, 'fodder_four')]))).toHaveLength(1);
  });

  it('offers a discounted cast even when the printed cost cannot be paid', () => {
    const state = board('tithe', [...forests(2), body(10, 'fodder_four')]);
    expect(casts(state)).toEqual([titheAction([10])]);
    expect(validateAction(state, DB, 0, { type: 'castSpell', handIndex: 0 })).toMatch(/cannot pay/);
    const game = Game.restore(state, DB);
    const events = game.submit(0, titheAction([10]));
    expect(events).toContainEqual({ e: 'manaTapped', player: 0, iids: [100, 101] });
    expect(game.instanceState.battlefield.some((perm) => perm.cardId === 'tithe')).toBe(true);
  });

  it('accepts zero sacrifices and a non-canonical legal subset using battlefield iids', () => {
    const state = board('tithe', [
      ...forests(4), body(10, 'fodder_one'), body(20, 'fodder_four'),
      { ...body(30, 'fodder_two'), owner: 1 },
    ]);
    expect(casts(state).some((action) => JSON.stringify(action.sacrifices) === '[20]')).toBe(false);
    expect(validateAction(state, DB, 0, titheAction([20]))).toBeNull();
    expect(validateAction(state, DB, 0, titheAction([30]))).toBeNull();
    expect(validateAction(state, DB, 0, titheAction([]))).toBeNull();
    expect(validateAction(state, DB, 0, { type: 'castSpell', handIndex: 0, tithe: true })).toBeNull();
  });

  it.each([
    ['opponent creature', [40]],
    ['non-creature', [50]],
    ['duplicate iid', [20, 20]],
    ['absent iid', [999]],
    ['array index instead of iid', [0]],
    ['fractional iid', [20.5]],
  ] as [string, number[]][])('rejects an %s sacrifice before mutating any state', (_reason, sacrifices) => {
    const state = board('tithe', [
      ...forests(4), body(20, 'fodder_four'), body(40, 'fodder_four', 1), body(50, 'defense_static'),
    ]);
    const before = JSON.stringify(state);
    expect(validateAction(state, DB, 0, titheAction(sacrifices))).not.toBeNull();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('requires the Tithe rider for optional sacrifices and a Tithe definition for the rider', () => {
    const state = board('tithe', [...forests(4), body(10, 'fodder_four')]);
    expect(validateAction(state, DB, 0, { type: 'castSpell', handIndex: 0, sacrifices: [10] })).not.toBeNull();
    expect(validateAction(board('bear', forests(2)), DB, 0, titheAction([]))).not.toBeNull();
  });

  it('checks explicit mana plans against the discounted cost and preserves colored requirements', () => {
    const state = board('tithe', [...forests(3), body(10, 'fodder_four')]);
    expect(validateAction(state, DB, 0, titheAction([10], { manaPlan: [100, 101] }))).toBeNull();
    expect(validateAction(state, DB, 0, titheAction([10], { manaPlan: [100] }))).toMatch(/cannot pay/);
    expect(validateAction(state, DB, 0, titheAction([10], { manaPlan: [100, 101, 102] }))).toMatch(/source count/);
    const wrongColor = board('tithe', [body(100, 'swamp'), body(101, 'swamp'), body(10, 'fodder_eight')]);
    expect(validateAction(wrongColor, DB, 0, titheAction([10]))).toMatch(/cannot pay/);
    expect(casts(wrongColor)).toEqual([]);
  });

  it('subtracts chosen fodder from the creature-cap check', () => {
    const state = board('tithe_small', [
      ...forests(2), ...Array.from({ length: RULES.maxCreatures }, (_, index) => body(10 + index, 'fodder_two')),
    ]);
    expect(validateAction(state, DB, 0, titheAction([]))).toMatch(/cap/);
    expect(validateAction(state, DB, 0, titheAction([17]))).toBeNull();
    expect(casts(state).map((action) => action.sacrifices)).toEqual([[10]]);
    const game = Game.restore(state, DB);
    game.submit(0, titheAction([17], { manaPlan: [100] }));
    expect(game.instanceState.battlefield.filter((perm) => DB[perm.cardId].types.includes('creature'))).toHaveLength(RULES.maxCreatures);
    expect(game.instanceState.battlefield.some((perm) => perm.iid === 17)).toBe(false);
    expect(game.instanceState.battlefield.some((perm) => perm.cardId === 'tithe_small')).toBe(true);
  });
});

describe('Tithe payment and resolution', () => {
  it('accepts tokens as fodder and evaporates them after their Defense buys the discount', () => {
    const state = board('tithe_small', [...forests(1), body(10, 'fodder_token')]);
    expect(titheCost(state, [10])).toEqual({ generic: 0, pips: { G: 1 } });
    expect(validateAction(state, DB, 0, titheAction([10]))).toBeNull();
    const game = Game.restore(state, DB);
    const events = game.submit(0, titheAction([10], { manaPlan: [100] }));
    expect(events).toContainEqual({ e: 'died', iid: 10, cardId: 'fodder_token', owner: 0 });
    expect(game.instanceState.battlefield.some((perm) => perm.iid === 10)).toBe(false);
    expect(game.instanceState.players[0].graveyard).toEqual([]);
    expect(game.instanceState.battlefield.some((perm) => perm.cardId === 'tithe_small')).toBe(true);
  });

  it('taps a mana creature before sacrificing the same iid', () => {
    const game = Game.restore(board('tithe_small', [body(10, 'fodder_mana')]), DB);
    const events = game.submit(0, titheAction([10], { manaPlan: [10] }));
    expect(events).toContainEqual({ e: 'manaTapped', player: 0, iids: [10] });
    expect(firstEvent(events, 'manaTapped')).toBeLessThan(firstEvent(events, 'died'));
    expect(game.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['fodder_mana']);
  });

  it('batches departures, then graveyard and dies triggers in battlefield order before announcing the spell', () => {
    const game = Game.restore(board('tithe', [
      ...forests(1), body(30, 'fodder_grave'), body(20, 'fodder_spawn'), body(10, 'fodder_order'),
    ], ['counter']), DB);
    const events = game.submit(0, titheAction([10, 20, 30], { manaPlan: [100] }));
    expect(events.filter((event) => event.e === 'died').map((event) => event.iid)).toEqual([30, 20, 10]);
    expect(events.filter((event) => event.e === 'triggerFired').map((event) => event.iid)).toEqual([20, 10]);
    expect(events.filter((event) => event.e === 'graveyardTriggerFired')).toHaveLength(1);
    expect(events.map((event) => event.e).lastIndexOf('died')).toBeLessThan(firstEvent(events, 'graveyardTriggerFired'));
    expect(firstEvent(events, 'graveyardTriggerFired')).toBeLessThan(firstEvent(events, 'triggerFired'));
    expect(firstEvent(events, 'tokenCreated')).toBeLessThan(firstEvent(events, 'spellCast'));
    expect(events.map((event) => event.e).lastIndexOf('triggerFired')).toBeLessThan(firstEvent(events, 'spellCast'));
    expect(game.instanceState.players[0].life).toBe(21);
    expect(game.instanceState.players[1].life).toBe(19);
    expect(game.instanceState.stack.map((item) => item.cardId)).toEqual(['tithe']);
    expect(game.awaiting.kind).toBe('respond');
  });

  it('snapshots Defense before a sacrificed static source leaves the battlefield', () => {
    const state = board('tithe_replay', [...forests(1), body(10, 'fodder_lord'), body(20, 'fodder_two')]);
    expect(getEffectiveStats(state.battlefield, DB, 10).defense).toBe(1);
    expect(getEffectiveStats(state.battlefield, DB, 20).defense).toBe(3);
    expect(titheCost(state, [10, 20])).toEqual({ generic: 0, pips: { G: 1 } });
    const game = Game.restore(state, DB);
    game.submit(0, titheAction([10, 20], { manaPlan: [100] }));
    expect(game.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['fodder_lord', 'fodder_two']);
    expect(game.instanceState.battlefield.some((perm) => perm.cardId === 'tithe_replay')).toBe(true);
  });

  it('pays the combined Empower cost with Tithe and resolves the Empower rider', () => {
    const game = Game.restore(board('tithe_empower', [...forests(3), body(10, 'fodder_eight')]), DB);
    const events = game.submit(0, titheAction([10], { empowered: true, manaPlan: [100, 101, 102] }));
    expect(events).toContainEqual({ e: 'manaTapped', player: 0, iids: [100, 101, 102] });
    expect(game.instanceState.players[0].life).toBe(24);
    expect(game.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['fodder_eight']);
  });

  it('keeps paid fodder dead when the Tithe spell is cancelled', () => {
    const game = Game.restore(board('tithe_small', [...forests(1), body(10, 'fodder_two')], ['counter']), DB);
    game.submit(0, titheAction([10], { manaPlan: [100] }));
    expect(game.instanceState.battlefield.some((perm) => perm.iid === 10)).toBe(false);
    const counter = game.legalActions(1).find((action) => action.type === 'castSpell');
    if (!counter) throw new Error('Tithe fixture has no counter action');
    const events = game.submit(1, counter);
    expect(events.some((event) => event.e === 'spellCountered')).toBe(true);
    expect(game.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['fodder_two', 'tithe_small']);
    expect(game.instanceState.battlefield.some((perm) => ['fodder_two', 'tithe_small'].includes(perm.cardId))).toBe(false);
  });

  it('bails out before announcing the spell when a paid dies draw loses to an empty deck', () => {
    const state = board('tithe_small', [...forests(1), body(10, 'fodder_draw')]);
    state.players[0].deck = [];
    const game = Game.restore(state, DB);
    const events = game.submit(0, titheAction([10], { manaPlan: [100] }));
    expect(game.instanceState.winner).toBe(1);
    expect(game.instanceState.winReason).toBe('deck');
    expect(game.instanceState.stack).toEqual([]);
    expect(events.some((event) => event.e === 'spellCast')).toBe(false);
    expect(game.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['fodder_draw']);
  });
});

function recordTitheFixture() {
  const seed = 77171;
  const deck = [
    ...Array.from({ length: 8 }, () => 'forest'),
    ...Array.from({ length: 8 }, () => 'fodder_two'),
    ...Array.from({ length: 8 }, () => 'tithe_replay'),
  ];
  const decks: [string[], string[]] = [[...deck], [...deck]];
  const game = new Game({ decks, seed, db: DB });
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(DB), seed, decks,
    context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Tithe fixture', gauntletRung: null },
  });
  const events = [...game.initialEvents];
  for (let guard = 0; guard < 2000; guard++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      return { game, events, log: finishReplay(draft, game.instanceState.winner === 0 ? 'win' : 'loss', 0, game.instanceState.turn) };
    }
    const player = awaiting.player;
    const legal = game.legalActions(player);
    const discounted = legal.find((action): action is CastAction =>
      action.type === 'castSpell' && action.tithe === true && (action.sacrifices?.length ?? 0) > 0);
    let action: Action;
    const land = legal.find((candidate) => candidate.type === 'playLand');
    if (land) action = land;
    else if (discounted) {
      const state = game.instanceState;
      const d = DB[cardIdOf(state.players[player].hand[discounted.handIndex])];
      const cost = castCost(d, discounted.empowered === true, false, false, {
        tithe: true, sacrifices: discounted.sacrifices, state, db: DB,
      });
      if (!cost) throw new Error('Tithe replay cost missing');
      const manaPlan = solveMana(state, DB, player, cost);
      if (!manaPlan) throw new Error('Tithe replay mana plan missing');
      action = { ...discounted, manaPlan };
    } else action = legal.find((candidate) => candidate.type === 'choosePlayDraw') ?? botAction(legal);
    events.push(...game.submit(player, action));
    recordReplayAction(draft, player, action);
  }
  throw new Error('Tithe replay fixture did not terminate');
}

describe('Tithe replay and determinism', () => {
  it('keeps v12 logs without the new mechanics watchable at rules revision 4 byte for byte', () => {
    const seed = 7611;
    const decks: [string[], string[]] = [smallGreenDeck(), smallGreenDeck()];
    const game = new Game({ db: TEST_DB, decks, seed, rulesRev: 4 });
    const draft = startReplayDraft({
      dbStamp: replayDbStamp(TEST_DB), seed, decks,
      context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'v12 fixture', gauntletRung: null },
    });
    draft.v = 12;
    const events = [...game.initialEvents];
    for (let guard = 0; guard < 2000; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') break;
      const action = botAction(game.legalActions(awaiting.player));
      events.push(...game.submit(awaiting.player, action));
      recordReplayAction(draft, awaiting.player, action);
    }
    expect(game.awaiting.kind).toBe('gameOver');
    const log = finishReplay(draft, game.instanceState.winner === 0 ? 'win' : 'loss', 0, game.instanceState.turn);
    expect(log.v).toBe(12);
    expect(log.actions.some((step) => step.a.type === 'castSpell' && (step.a.tithe || step.a.whispers))).toBe(false);
    const revived = JSON.parse(JSON.stringify(log));
    expect(isReplayLog(revived)).toBe(true);
    expect(canReplay(revived, TEST_DB)).toBe(true);
    const replayed = replayGame(revived, TEST_DB);
    expect(replayed.game.instanceState.rulesRev).toBe(4);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(events));
  });

  it('round-trips a naturally terminal game with Tithe iids and explicit mana plans byte for byte', () => {
    const recorded = recordTitheFixture();
    expect(CURRENT_RULES_REV).toBe(4);
    expect(REPLAY_LOG_VERSION).toBe(14);
    expect(recorded.log.v).toBe(14);
    expect(recorded.game.awaiting.kind).toBe('gameOver');
    const sacrifices = recorded.log.actions.filter((step) => step.a.type === 'castSpell' && step.a.tithe);
    expect(sacrifices.length).toBeGreaterThan(0);
    for (const step of sacrifices) {
      expect(step.a).toMatchObject({ tithe: true, sacrifices: expect.any(Array), manaPlan: expect.any(Array) });
    }
    const revived = JSON.parse(JSON.stringify(recorded.log));
    expect(isReplayLog(revived)).toBe(true);
    expect(canReplay(revived, DB)).toBe(true);
    const replayed = replayGame(revived, DB);
    expect(replayed.game.instanceState.rulesRev).toBe(4);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(recorded.game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(recorded.events));
  });

  it('keeps two seeded runs identical in actions, events and terminal state', () => {
    const first = recordTitheFixture();
    const second = recordTitheFixture();
    expect(JSON.stringify(second.log.actions)).toBe(JSON.stringify(first.log.actions));
    expect(JSON.stringify(second.events)).toBe(JSON.stringify(first.events));
    expect(JSON.stringify(second.game.instanceState)).toBe(JSON.stringify(first.game.instanceState));
  });
});
