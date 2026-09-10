import { describe, expect, it } from 'vitest';
import { CURRENT_RULES_REV } from '../../src/config/rules';
import type { Action } from '../../src/engine/actions';
import { activatedBlockers, legalActions, validateAction } from '../../src/engine/actions';
import { canActivate, canAttack, compelledAttackers } from '../../src/engine/combat/legality';
import { Game } from '../../src/engine/Game';
import { solveMana } from '../../src/engine/mana';
import type { ActivatedDef, CardDb, CardDef, EffectOp, GameState, Permanent, PlayerId, TargetRef } from '../../src/engine/types';
import { cardIdOf, validateActivatedDef } from '../../src/engine/types';
import {
  canReplay, finishReplay, isReplayLog, recordReplayAction, REPLAY_LOG_VERSION,
  replayDbStamp, replayGame, startReplayDraft,
} from '../../src/meta/Replay';
import { botAction, makeTestState, smallGreenDeck, TEST_DB } from '../helpers';
import { activatedCatalogErrors } from '../activatedFixture';

/**
 * Tap-ability core contract (plan-tap-abilities sections 2 and 3): own-turn
 * main phase, empty stack, untapped and not newly arrived without Warcry.
 * Creature, artifact and enchantment sources share that rule. Costs are paid
 * before immediate, inline-targeted effects; SBA runs before control returns.
 * These cards are fixtures only. No AI policy or presentation is exercised.
 */
type ActivateAction = Extract<Action, { type: 'activate' }>;
const SOURCE = 10;
const TARGET = 20;
const free: ActivatedDef = { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] };
const permanent = (iid: number): TargetRef => ({ kind: 'permanent', iid });

function carrier(id: string, types: CardDef['types'] = ['creature'], extra: Partial<CardDef> = {}): CardDef {
  return {
    id, name: id, types, subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} },
    ...(types.includes('creature') ? { attack: 2, defense: 4 } : {}),
    activated: free,
    ...extra,
  };
}

const DB: CardDb = {
  ...TEST_DB,
  tap_creature: carrier('tap_creature'),
  tap_artifact: carrier('tap_artifact', ['artifact']),
  tap_enchantment: carrier('tap_enchantment', ['enchantment']),
  tap_sentinel: carrier('tap_sentinel', ['creature'], { keywords: ['sentinel'] }),
  tap_rage: carrier('tap_rage', ['creature'], { keywords: ['rage'] }),
  tap_bulwark: carrier('tap_bulwark', ['creature'], { keywords: ['bulwark'] }),
  tap_paid: carrier('tap_paid', ['artifact'], {
    activated: {
      cost: { tap: true, mana: { generic: 1, pips: { G: 1 } } },
      targets: [{ what: 'player' }],
      ops: [{ op: 'damage', n: 3, to: 'target' }],
    },
  }),
  tap_target: carrier('tap_target', ['creature'], {
    activated: {
      cost: { tap: true }, targets: [{ what: 'creature', other: true }],
      ops: [{ op: 'damage', n: 2, to: 'target' }, { op: 'addCounters', n: 1, to: 'self' }],
    },
  }),
  tap_qualified: carrier('tap_qualified', ['creature'], {
    activated: {
      cost: { tap: true }, targets: [{ what: 'any', other: true, marked: true, tapped: true, upTo: 2 }],
      ops: [{ op: 'damage', n: 1, to: 'target' }],
    },
  }),
  tap_move: carrier('tap_move', ['artifact'], {
    activated: {
      cost: { tap: true }, targets: [{ what: 'creature', marked: true }, { what: 'creature' }],
      ops: [{ op: 'moveMark' }],
    },
  }),
  tap_removal: carrier('tap_removal', ['artifact'], {
    activated: {
      cost: { tap: true }, targets: [{ what: 'creature' }],
      ops: [{ op: 'destroy', to: 'target' }, { op: 'damage', n: 3, to: 'target' }, { op: 'gainLife', n: 2 }],
    },
  }),
  tap_replay: carrier('tap_replay', ['artifact'], {
    activated: {
      cost: { tap: true, mana: { generic: 0, pips: { G: 1 } } },
      targets: [{ what: 'player' }], ops: [{ op: 'damage', n: 3, to: 'target' }],
    },
  }),
};

function board(cardId = 'tap_creature', extra: Partial<Permanent>[] = [], patch: Partial<Permanent> = {}): GameState {
  const state = makeTestState({
    battlefield: [{ iid: SOURCE, cardId, controller: 0, ...patch }, ...extra], active: 0,
  });
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 100;
  state.players[0].deck = Array.from({ length: 12 }, () => 'forest');
  state.players[1].deck = Array.from({ length: 12 }, () => 'forest');
  return state;
}

function activations(state: GameState, player: PlayerId = 0, db: CardDb = DB): ActivateAction[] {
  return legalActions(state, db, player).filter((action): action is ActivateAction => action.type === 'activate');
}

function activation(game: Game, iid = SOURCE, player: PlayerId = 0): ActivateAction {
  const action = game.legalActions(player).find(
    (candidate): candidate is ActivateAction => candidate.type === 'activate' && candidate.iid === iid,
  );
  if (!action) throw new Error(`No activation for ${iid}`);
  return action;
}

function source(state: Readonly<GameState>): Permanent {
  const result = state.battlefield.find((perm) => perm.iid === SOURCE);
  if (!result) throw new Error('Fixture source is missing');
  return result;
}

function advanceTo(game: Game, ready: (state: Readonly<GameState>) => boolean): void {
  for (let guard = 0; guard < 100; guard++) {
    if (ready(game.instanceState)) return;
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') throw new Error('Fixture ended before the requested phase');
    game.submit(awaiting.player, botAction(game.legalActions(awaiting.player)));
  }
  throw new Error('Fixture did not reach requested phase');
}

describe('activated definition contract', () => {
  it.each([
    { op: 'damage', n: 1, to: 'target' },
    { op: 'addCounters', n: 1, to: 'target' },
    { op: 'reclaim' },
    { op: 'ifTargetMarked', then: [{ op: 'gainLife', n: 1 }] },
    { op: 'foresee', n: 1, who: 'targetOwner' },
  ] satisfies EffectOp[])('rejects an inline-target tail after Foresee: $op', (tail) => {
    const d = carrier('invalid_tail', ['creature'], {
      activated: { cost: { tap: true }, targets: [{ what: 'creature' }], ops: [{ op: 'foresee', n: 1 }, tail] },
    });
    expect(validateActivatedDef(d)).toContain('Activated ops after Foresee cannot need an inline target');
  });

  it('finds Foresee in nested branches before an outer targeted tail', () => {
    const d = carrier('nested_tail', ['creature'], { activated: {
      cost: { tap: true }, targets: [{ what: 'creature' }], ops: [
        { op: 'ifTargetMarked', then: [{ op: 'gainLife', n: 1 }], else: [{ op: 'foresee', n: 1 }] },
        { op: 'damage', n: 1, to: 'target' },
      ],
    } });
    expect(validateActivatedDef(d)).toContain('Activated ops after Foresee cannot need an inline target');
  });

  it('allows source-only and target-free tails, and targeting before Foresee', () => {
    const d = carrier('source_tail', ['creature'], { activated: {
      cost: { tap: true }, targets: [{ what: 'creature' }], ops: [
        { op: 'damage', n: 1, to: 'target' }, { op: 'foresee', n: 1 },
        { op: 'addCounters', n: 1, to: 'self' }, { op: 'awaken', scope: 'self' },
        { op: 'severSelf' }, { op: 'gainLife', n: 2 },
      ],
    } });
    expect(validateActivatedDef(d)).toEqual([]);
  });

  it('rejects spell targets, qualified player targets and X, including nested X', () => {
    for (const targets of [
      [{ what: 'spell' }], [{ what: 'player', marked: true }], [{ what: 'player', tapped: true }],
    ] satisfies NonNullable<ActivatedDef['targets']>[]) {
      expect(validateActivatedDef(carrier('invalid_target', ['creature'], {
        activated: { ...free, targets },
      })).length).toBeGreaterThan(0);
    }
    for (const ops of [
      [{ op: 'damage', n: 'X', to: 'opponent' }],
      [{ op: 'ifTargetMarked', then: [], else: [{ op: 'damage', n: 'X', to: 'target' }] }],
    ] satisfies EffectOp[][]) {
      expect(validateActivatedDef(carrier('invalid_x', ['creature'], {
        activated: { ...free, targets: [{ what: 'creature' }], ops },
      }))).toContain('Activated ops cannot use X');
    }
  });

  it.each(['tap_creature', 'tap_artifact', 'tap_enchantment'])('accepts %s', (id) => {
    expect(validateActivatedDef(DB[id])).toEqual([]);
  });

  it.each([
    ['land', { types: ['land'] }, /never a land/],
    ['land creature', { types: ['land', 'creature'] }, /never a land/],
    ['ritual', { types: ['ritual'] }, /carrier/],
    ['Hauntlink', { hauntlink: { cost: { generic: 0, pips: {} }, linked: { p: 1 } } }, /Hauntlink/],
    ['mana ability', { manaAbility: ['G'] }, /manaAbility/],
    ['empty mana ability', { manaAbility: [] }, /manaAbility/],
    ['empty ops', { activated: { cost: { tap: true }, ops: [] } }, /empty/],
  ] as [string, Partial<CardDef>, RegExp][])('rejects %s carriers or riders', (_name, patch, reason) => {
    expect(validateActivatedDef({ ...DB.tap_creature, ...patch }).join('; ')).toMatch(reason);
  });

  it('rejects non-tap costs, malformed mana and target definitions', () => {
    const invalid = (activated: unknown) => validateActivatedDef({
      ...DB.tap_creature, activated: activated as ActivatedDef,
    }).join('; ');
    expect(invalid({ ...free, cost: { tap: false } })).toMatch(/cost/);
    expect(invalid({ ...free, cost: { tap: true, sacrifice: true } })).toMatch(/cost/);
    expect(invalid({ ...free, cost: { tap: true, mana: { generic: -1, pips: {} } } })).toMatch(/non-negative/);
    expect(invalid({ ...free, cost: { tap: true, mana: { generic: 0, pips: { G: 0.5 } } } })).toMatch(/non-negative/);
    expect(invalid({ ...free, ops: [{ op: 'damage', n: 1, to: 'target' }] })).toMatch(/target specs/);
    expect(invalid({ ...free, targets: [{ what: 'missing' }] })).toMatch(/target kind/);
    expect(invalid({ ...free, targets: [{ what: 'creature', upTo: 3 }] })).toMatch(/upTo/);
    expect(invalid({ ...free, targets: [{ what: 'creature', upTo: 2 }, { what: 'player' }] })).toMatch(/upTo/);
    expect(invalid({ ...free, targets: [{ what: 'creature' }], ops: [{ op: 'moveMark' }] })).toMatch(/two/);
  });

  it('permits the other approved riders, keywords and Quest carrier', () => {
    expect(validateActivatedDef({
      ...DB.tap_creature, keywords: ['warcry', 'sentinel', 'rage', 'bulwark'],
      empower: { cost: { generic: 0, pips: {} }, ops: [{ op: 'gainLife', n: 1 }] },
      rite: { n: 1 }, retell: { cost: { generic: 0, pips: {} } },
      skim: { cost: { generic: 0, pips: {} } }, preserve: { cost: { generic: 0, pips: {} } },
    })).toEqual([]);
    expect(validateActivatedDef({ ...DB.tap_enchantment, types: ['ritual'], chapters: [] })).toEqual([]);
    expect(validateActivatedDef(TEST_DB.bear)).toEqual([]);
  });
});

describe('activated source and window legality', () => {
  it.each(['tap_creature', 'tap_artifact', 'tap_enchantment'])('%s shares the arrival rule, including Warcry', (id) => {
    const db = { ...DB, [id]: { ...DB[id], keywords: ['warcry'] as CardDef['keywords'] } };
    const ready = board(id);
    expect(canActivate(ready.battlefield, DB, source(ready), 0)).toBe(true);
    expect(activatedBlockers(ready, DB, 0, source(ready))).toBeNull();
    expect(activations(ready)).toEqual([{ type: 'activate', iid: SOURCE }]);
    const arrived = board(id, [], { enteredThisTurn: true });
    expect(canActivate(arrived.battlefield, DB, source(arrived), 0)).toBe(false);
    expect(activatedBlockers(arrived, DB, 0, source(arrived))).toMatch(/arrives.*Warcry/);
    expect(activations(arrived)).toEqual([]);
    expect(validateAction(arrived, DB, 0, { type: 'activate', iid: SOURCE })).toMatch(/arrives/);
    expect(canActivate(arrived.battlefield, db, source(arrived), 0)).toBe(true);
    expect(validateAction(arrived, db, 0, { type: 'activate', iid: SOURCE })).toBeNull();
    const game = Game.restore(arrived, db);
    game.submit(0, activation(game));
    expect(source(game.instanceState).tapped).toBe(true);
    expect(game.instanceState.players[0].life).toBe(21);
  });

  it.each([
    ['tapped', { tapped: true }, /tapped/],
    ['opponent controlled', { controller: 1 }, /control/],
    ['no ability', { cardId: 'bear' }, /no activated ability/],
  ] as [string, Partial<Permanent>, RegExp][])('rejects a %s source', (_name, patch, reason) => {
    const state = board('tap_creature', [], patch);
    expect(canActivate(state.battlefield, DB, source(state), 0)).toBe(false);
    expect(activatedBlockers(state, DB, 0, source(state))).toMatch(reason);
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE })).toMatch(reason);
    expect(activations(state)).toEqual([]);
  });

  it('requires the source to remain on the battlefield', () => {
    const state = board();
    const missing = { ...source(state), iid: 999 };
    expect(canActivate(state.battlefield, DB, missing, 0)).toBe(false);
    expect(activatedBlockers(state, DB, 0, missing)).toMatch(/battlefield/);
    expect(activatedBlockers(state, DB, 0, undefined)).toMatch(/battlefield/);
    expect(validateAction(state, DB, 0, { type: 'activate', iid: 999 })).toMatch(/battlefield/);
  });

  it.each(['main1', 'main2'] as const)('accepts own-turn %s with an empty stack', (step) => {
    const state = board();
    state.step = step;
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE })).toBeNull();
    expect(activations(state)).toHaveLength(1);
  });

  it.each([
    ['respond', { player: 0, kind: 'respond', over: { type: 'spell', sid: 1 } }],
    ['endStepWindow', { player: 0, kind: 'endStepWindow' }],
    ['hauntlinkWindow', { player: 0, kind: 'hauntlinkWindow', over: { type: 'combatDamage' } }],
  ] as [string, GameState['awaiting']][])('never offers or accepts activation in %s', (_name, awaiting) => {
    const state = board();
    state.awaiting = awaiting;
    expect(activatedBlockers(state, DB, 0, source(state))).toMatch(/Morning or Afternoon/);
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE })).toMatch(/Morning or Afternoon/);
    expect(activations(state)).toEqual([]);
  });

  it('rejects the inactive player, another decision owner, a non-main step and a nonempty stack', () => {
    const inactive = board();
    inactive.activePlayer = 1;
    expect(validateAction(inactive, DB, 0, { type: 'activate', iid: SOURCE })).toMatch(/your Morning/);
    expect(activations(inactive)).toEqual([]);
    const wrongDecision = board();
    expect(validateAction(wrongDecision, DB, 1, { type: 'activate', iid: SOURCE })).toMatch(/not your decision/);
    expect(activations(wrongDecision, 1)).toEqual([]);
    const combat = board();
    combat.step = 'combat';
    expect(validateAction(combat, DB, 0, { type: 'activate', iid: SOURCE })).toMatch(/Morning/);
    expect(activations(combat)).toEqual([]);
    const stacked = board();
    stacked.stack.push({ sid: 1, cardId: 'shock', controller: 1, targets: [{ kind: 'player', player: 0 }] });
    expect(activatedBlockers(stacked, DB, 0, source(stacked))).toMatch(/empty stack/);
    expect(validateAction(stacked, DB, 0, { type: 'activate', iid: SOURCE })).toMatch(/empty stack/);
    expect(activations(stacked)).toEqual([]);
  });
});

describe('activated inline targets', () => {
  it('requires a legal mandatory target and excludes its own source with other', () => {
    const state = board('tap_target');
    expect(activations(state)).toEqual([]);
    expect(activatedBlockers(state, DB, 0, source(state))).toMatch(/no legal targets/);
    state.battlefield.push(...board('bear').battlefield.map((perm) => ({ ...perm, iid: TARGET })));
    expect(activations(state)).toEqual([{ type: 'activate', iid: SOURCE, targets: [permanent(TARGET)] }]);
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE, targets: [permanent(SOURCE)] })).toMatch(/illegal target/);
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE })).toMatch(/number of targets/);
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE, targets: [permanent(999)] })).toMatch(/illegal target/);
  });

  it('composes other, marked, tapped and upTo, filtering player refs from any', () => {
    const state = board('tap_qualified', [
      { iid: 30, cardId: 'bear', controller: 0, tapped: true, plusOneCounters: 1 },
      { iid: 20, cardId: 'bear', controller: 1, tapped: true, plusOneCounters: 1 },
      { iid: 40, cardId: 'bear', controller: 0, tapped: false, plusOneCounters: 1 },
      { iid: 50, cardId: 'bear', controller: 0, tapped: true },
      { iid: 60, cardId: 'tap_artifact', controller: 1, tapped: true, plusOneCounters: 1 },
      { iid: 70, cardId: 'hexproof_bear', controller: 1, tapped: true, plusOneCounters: 1 },
    ], { plusOneCounters: 1 });
    const offered = activations(state);
    expect(offered.map((action) => action.targets)).toEqual([
      [], [permanent(30)], [permanent(20)], [permanent(30), permanent(20)],
    ]);
    for (const action of offered) expect(validateAction(state, DB, 0, action)).toBeNull();
    for (const target of [permanent(SOURCE), permanent(40), permanent(50), permanent(60), permanent(70), { kind: 'player', player: 1 } as TargetRef]) {
      expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE, targets: [target] })).toMatch(/illegal target/);
    }
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE, targets: [permanent(30), permanent(30)] })).toMatch(/distinct/);
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE, targets: [permanent(30), permanent(20), permanent(40)] })).toMatch(/too many/);
    const game = Game.restore(state, DB);
    game.submit(0, offered[3]);
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 30)?.damage).toBe(1);
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 20)?.damage).toBe(1);
  });

  it('allows zero optional targets and rejects extraneous targets on a target-free ability', () => {
    const optional = board('tap_qualified');
    expect(activations(optional)).toEqual([{ type: 'activate', iid: SOURCE, targets: [] }]);
    const game = Game.restore(optional, DB);
    game.submit(0, activation(game));
    expect(source(game.instanceState).tapped).toBe(true);
    expect(validateAction(board(), DB, 0, { type: 'activate', iid: SOURCE, targets: [permanent(SOURCE)] })).toMatch(/number of targets/);
  });

  it('keeps battlefield order before target-list order', () => {
    const state = board('tap_paid', [
      { iid: 3, cardId: 'tap_paid', controller: 0 },
      { iid: 90, cardId: 'forest', controller: 0 },
      { iid: 91, cardId: 'forest', controller: 0 },
    ]);
    expect(activations(state)).toEqual([SOURCE, 3].flatMap((iid) => [0, 1].map((player) => ({
      type: 'activate', iid, targets: [{ kind: 'player', player }],
    }))));
  });

  it('binds moveMark to two distinct controlled creatures in donor/recipient order', () => {
    const state = board('tap_move', [
      { iid: 20, cardId: 'bear', controller: 0, plusOneCounters: 1 },
      { iid: 30, cardId: 'bear', controller: 0 },
      { iid: 40, cardId: 'bear', controller: 1, plusOneCounters: 1 },
    ]);
    expect(activations(state)).toEqual([{ type: 'activate', iid: SOURCE, targets: [permanent(20), permanent(30)] }]);
    for (const targets of [[permanent(20), permanent(20)], [permanent(20), permanent(40)]]) {
      expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE, targets })).toMatch(/two distinct creatures you control/);
    }
    const game = Game.restore(state, DB);
    game.submit(0, activation(game));
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 20)?.plusOneCounters).toBe(0);
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 30)?.plusOneCounters).toBe(1);
  });

  it.each(['ordinary', 'Empower'])('ignores the carrier\'s %s moveMark when enumerating its separate activation', (rider) => {
    const move = { targets: [{ what: 'yourCreature' }, { what: 'yourCreature' }], ops: [{ op: 'moveMark' }] } as const;
    const def: CardDef = {
      ...DB.tap_target,
      ...(rider === 'ordinary'
        ? { abilities: [{ when: 'spell', targets: [...move.targets], ops: [...move.ops] }] }
        : { empower: { cost: { generic: 0, pips: {} }, targets: [...move.targets], ops: [...move.ops] } }),
    };
    const db = { ...DB, tap_target: def };
    const state = board('tap_target', [{ iid: TARGET, cardId: 'bear', controller: 1 }]);
    const actions = activations(state, 0, db);
    expect(actions).toEqual([{ type: 'activate', iid: SOURCE, targets: [permanent(TARGET)] }]);
    expect(validateAction(state, db, 0, actions[0])).toBeNull();
  });
});

describe('activation costs, effects and turn interactions', () => {
  const manaBoard = () => board('tap_paid', [
    { iid: 90, cardId: 'forest', controller: 0 },
    { iid: 91, cardId: 'plains', controller: 0 },
    { iid: 92, cardId: 'plains', controller: 0 },
    { iid: 93, cardId: 'forest', controller: 1 },
    { iid: 94, cardId: 'forest', controller: 0, tapped: true },
  ]);

  it('does not offer an unaffordable mana part', () => {
    const state = board('tap_paid', [{ iid: 90, cardId: 'forest', controller: 0 }]);
    expect(activatedBlockers(state, DB, 0, source(state))).toMatch(/cannot pay cost/);
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE, targets: [{ kind: 'player', player: 1 }] })).toMatch(/cannot pay cost/);
    expect(activations(state)).toEqual([]);
  });

  it.each([[undefined], [[90, 92]]] as [number[] | undefined][])('pays the mana part using auto or explicit plan %j, then resolves immediately', (manaPlan) => {
    const game = Game.restore(manaBoard(), DB);
    const plan = manaPlan ?? solveMana(game.instanceState, DB, 0, DB.tap_paid.activated!.cost.mana!)!;
    const events = game.submit(0, {
      type: 'activate', iid: SOURCE, targets: [{ kind: 'player', player: 1 }],
      ...(manaPlan === undefined ? {} : { manaPlan }),
    });
    expect(events[0]).toEqual({ e: 'manaTapped', player: 0, iids: plan });
    expect(events[1]).toEqual({ e: 'activated', player: 0, iid: SOURCE, cardId: 'tap_paid' });
    for (const iid of plan) expect(game.instanceState.battlefield.find((perm) => perm.iid === iid)?.tapped).toBe(true);
    expect(source(game.instanceState).tapped).toBe(true);
    expect(game.instanceState.players[1].life).toBe(17);
    expect(game.instanceState.stack).toEqual([]);
    expect(game.instanceState.pendingDecisions).toEqual([]);
    expect(game.awaiting).toEqual({ player: 0, kind: 'main' });
    expect(events.some((event) => event.e === 'responseWindowOpened')).toBe(false);
    expect(game.legalActions(0).some((action) => action.type === 'activate')).toBe(false);
    expect(() => game.submit(0, { type: 'activate', iid: SOURCE, targets: [{ kind: 'player', player: 1 }] })).toThrow(/tapped/);
  });

  it.each([
    [[90, 90], /duplicate/], [[91, 92], /cannot pay/], [[90], /cannot pay|source count/],
    [[90, 91, 92], /source count/], [[90, 93], /not an untapped mana source/],
    [[90, 94], /not an untapped mana source/], [[90, SOURCE], /not an untapped mana source/],
  ] as [number[], RegExp][])('rejects invalid mana plan %j atomically', (manaPlan, reason) => {
    const game = Game.restore(manaBoard(), DB);
    const action: ActivateAction = { type: 'activate', iid: SOURCE, targets: [{ kind: 'player', player: 1 }], manaPlan };
    expect(validateAction(game.instanceState, DB, 0, action)).toMatch(reason);
    const before = JSON.stringify(game.instanceState);
    expect(() => game.submit(0, action)).toThrow(reason);
    expect(JSON.stringify(game.instanceState)).toBe(before);
  });

  it('accepts an empty plan for a free ability and rejects unnecessary mana sources', () => {
    const state = board('tap_creature', [{ iid: 90, cardId: 'forest', controller: 0 }]);
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE, manaPlan: [] })).toBeNull();
    expect(validateAction(state, DB, 0, { type: 'activate', iid: SOURCE, manaPlan: [90] })).toMatch(/source count/);
  });

  it('deals lethal damage, adds a source mark and removes the dead target before returning', () => {
    const game = Game.restore(board('tap_target', [{ iid: TARGET, cardId: 'bear', controller: 1 }]), DB);
    const events = game.submit(0, activation(game));
    expect(source(game.instanceState)).toMatchObject({ tapped: true, plusOneCounters: 1 });
    expect(game.instanceState.battlefield.some((perm) => perm.iid === TARGET)).toBe(false);
    expect(game.instanceState.players[1].graveyard.map(cardIdOf)).toEqual(['bear']);
    expect(events.some((event) => event.e === 'died')).toBe(true);
    expect(game.awaiting).toEqual({ player: 0, kind: 'main' });
  });

  it('does not refund the tap when an earlier op removes a later op\'s target', () => {
    const game = Game.restore(board('tap_removal', [{ iid: TARGET, cardId: 'bear', controller: 1 }]), DB);
    const events = game.submit(0, activation(game));
    expect(source(game.instanceState).tapped).toBe(true);
    expect(game.instanceState.players[1].graveyard.map(cardIdOf)).toEqual(['bear']);
    expect(game.instanceState.players[0].life).toBe(22);
    expect(events.filter((event) => event.e === 'damageMarked')).toEqual([]);
    expect(game.legalActions(0).some((action) => action.type === 'activate')).toBe(false);
  });

  it.each(['tap_creature', 'tap_artifact', 'tap_enchantment'])('untaps %s only at its controller\'s next Dawn', (id) => {
    const game = Game.restore(board(id), DB);
    game.submit(0, activation(game));
    advanceTo(game, (state) => state.activePlayer === 1 && state.awaiting.kind === 'main');
    expect(source(game.instanceState).tapped).toBe(true);
    expect(game.legalActions(1).some((action) => action.type === 'activate' && action.iid === SOURCE)).toBe(false);
    advanceTo(game, (state) => state.activePlayer === 0 && state.awaiting.kind === 'main');
    expect(source(game.instanceState)).toMatchObject({ tapped: false, enteredThisTurn: false });
    expect(activation(game)).toEqual({ type: 'activate', iid: SOURCE });
  });

  it('lets Sentinel attack, remain untapped and activate in the Afternoon', () => {
    const game = Game.restore(board('tap_sentinel'), DB);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [SOURCE] });
    advanceTo(game, (state) => state.step === 'main2' && state.awaiting.kind === 'main');
    expect(game.instanceState.players[1].life).toBe(18);
    expect(source(game.instanceState).tapped).toBe(false);
    game.submit(0, activation(game));
    expect(source(game.instanceState).tapped).toBe(true);
    expect(game.instanceState.players[0].life).toBe(21);
  });

  it('allows a Morning activation to remove Rage attack eligibility', () => {
    const game = Game.restore(board('tap_rage'), DB);
    expect(compelledAttackers(game.instanceState.battlefield, DB, 0)).toEqual([SOURCE]);
    game.submit(0, activation(game));
    expect(compelledAttackers(game.instanceState.battlefield, DB, 0)).toEqual([]);
    game.submit(0, { type: 'passStep' });
    expect(game.legalActions(0)).toContainEqual({ type: 'declareAttackers', attackers: [] });
    game.submit(0, { type: 'declareAttackers', attackers: [] });
    expect(game.instanceState.step).toBe('main2');
  });

  it('lets Bulwark activate while still forbidding its attack', () => {
    const state = board('tap_bulwark');
    expect(canAttack(state.battlefield, DB, 0, SOURCE)).toBe(false);
    expect(canActivate(state.battlefield, DB, source(state), 0)).toBe(true);
    const game = Game.restore(state, DB);
    game.submit(0, activation(game));
    expect(source(game.instanceState).tapped).toBe(true);
  });
});

function recordFixtureGame(db: CardDb, decks: [string[], string[]], seed: number, version: number, rulesRev: 1 | 2 | 3 | 4) {
  const game = new Game({ db, decks, seed, rulesRev });
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(db), seed, decks,
    context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Activation fixture', gauntletRung: null },
  });
  draft.v = version;
  const events = [...game.initialEvents];
  for (let guard = 0; guard < 2000; guard++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      return { game, events, log: finishReplay(draft, game.instanceState.winner === 0 ? 'win' : 'loss', 0, game.instanceState.turn) };
    }
    const player = awaiting.player;
    const legal = game.legalActions(player);
    const activate = legal.find((action): action is ActivateAction => action.type === 'activate' &&
      action.targets?.[0]?.kind === 'player' && action.targets[0].player !== player);
    let action: Action;
    const land = legal.find((candidate) => candidate.type === 'playLand');
    if (land) action = land;
    else if (activate) {
      const card = db[game.instanceState.battlefield.find((perm) => perm.iid === activate.iid)!.cardId];
      const cost = card.activated!.cost.mana;
      action = { ...activate, manaPlan: cost ? solveMana(game.instanceState, db, player, cost)! : [] };
    } else action = legal.find((candidate) => candidate.type === 'choosePlayDraw') ?? botAction(legal);
    events.push(...game.submit(player, action));
    recordReplayAction(draft, player, action);
  }
  throw new Error('Recorded fixture game did not terminate');
}

function activationReplayFixture() {
  const deck = [...Array.from({ length: 12 }, () => 'forest'), ...Array.from({ length: 12 }, () => 'tap_replay')];
  return recordFixtureGame(DB, [[...deck], [...deck]], 91837, REPLAY_LOG_VERSION, 4);
}

describe('activation replay and deterministic compatibility', () => {
  it('records inline targets and explicit payment in a naturally terminal game and replays every byte', () => {
    const recorded = activationReplayFixture();
    expect(CURRENT_RULES_REV).toBe(4);
    expect(recorded.log.v).toBe(12);
    expect(recorded.game.awaiting.kind).toBe('gameOver');
    expect(recorded.game.instanceState.winReason).toBe('life');
    const uses = recorded.log.actions.filter((step) => step.a.type === 'activate');
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) expect(use.a).toMatchObject({ targets: [{ kind: 'player' }], manaPlan: [expect.any(Number)] });
    const revived = JSON.parse(JSON.stringify(recorded.log));
    expect(isReplayLog(revived)).toBe(true);
    expect(canReplay(revived, DB)).toBe(true);
    const replayed = replayGame(revived, DB);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(recorded.game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(recorded.events));
  });

  it('keeps same-seed actions, events and terminal state identical', () => {
    const first = activationReplayFixture();
    const second = activationReplayFixture();
    expect(JSON.stringify(second.log.actions)).toBe(JSON.stringify(first.log.actions));
    expect(JSON.stringify(second.events)).toBe(JSON.stringify(first.events));
    expect(JSON.stringify(second.game.instanceState)).toBe(JSON.stringify(first.game.instanceState));
  });

  it.each([6, 7, 8, 9, 10, 11])('keeps v%i logs without activations watchable with byte-identical state and events', (version) => {
    const rulesRev = version >= 11 ? 4 : version >= 8 ? 3 : version >= 7 ? 2 : 1;
    const recorded = recordFixtureGame(TEST_DB, [smallGreenDeck(), smallGreenDeck()], 7611, version, rulesRev);
    expect(recorded.log.actions.some((step) => step.a.type === 'activate')).toBe(false);
    const revived = JSON.parse(JSON.stringify(recorded.log));
    expect(isReplayLog(revived)).toBe(true);
    expect(canReplay(revived, TEST_DB)).toBe(true);
    const replayed = replayGame(revived, TEST_DB);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(recorded.game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(recorded.events));
    expect(replayed.game.instanceState.rulesRev ?? 1).toBe(rulesRev);
  });
});

describe('activation catalog arrival gate', () => {
  const targetedToken: CardDef = {
    ...TEST_DB.bear, id: 'targeted_token', token: true,
    abilities: [{ when: 'arrives', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 1, to: 'target' }] }],
  };
  const unsafe = (ops: EffectOp[]) => carrier('arrival_source', ['creature'], {
    activated: { cost: { tap: true }, targets: [{ what: 'yourGraveCreature' }], ops },
  });
  const db: CardDb = { ...TEST_DB, targeted_token: targetedToken };

  it('rejects a targeted-arrival token activation at the catalog gate before Game', () => {
    const d = unsafe([{ op: 'createToken', token: targetedToken.id, count: 1 }]);
    const fixtureDb = { ...db, [d.id]: d };
    const errors = Object.values(fixtureDb).flatMap((card) => activatedCatalogErrors(card, fixtureDb));
    expect(errors).toEqual(['Activated createToken can introduce a targeted arrival']);
  });

  it.each([{ op: 'raise' }, { op: 'raise', to: 'top' }] satisfies EffectOp[])(
    'rejects $op $to when the pool can return a targeted-arrival creature', (op) => {
      expect(activatedCatalogErrors(unsafe([op]), db)).toContain('Activated raise can introduce a targeted arrival');
    },
  );

  it('checks both conditional branches and indirect token arrivals', () => {
    const intermediate: CardDef = {
      ...TEST_DB.bear, id: 'intermediate', token: true,
      abilities: [{ when: 'arrives', ops: [{ op: 'createToken', token: targetedToken.id, count: 1 }] }],
    };
    const d = unsafe([{ op: 'ifTargetMarked', then: [], else: [{ op: 'createToken', token: intermediate.id, count: 1 }] }]);
    expect(activatedCatalogErrors(d, { ...db, [intermediate.id]: intermediate }))
      .toContain('Activated createToken can introduce a targeted arrival');
  });

  it('checks fetched lands, but allows safe arrivals and reclaim to hand', () => {
    const targetedLand: CardDef = { ...targetedToken, id: 'targeted_land', types: ['land'] };
    expect(activatedCatalogErrors(unsafe([{ op: 'fetchLand' }]), { ...db, [targetedLand.id]: targetedLand }))
      .toContain('Activated fetchLand can introduce a targeted arrival');
    expect(activatedCatalogErrors(unsafe([{ op: 'reclaim' }]), db)).toEqual([]);
    expect(activatedCatalogErrors(unsafe([{ op: 'raise' }]), TEST_DB)).toEqual([]);
    expect(activatedCatalogErrors(unsafe([{ op: 'createToken', token: 'bear', count: 1 }]), TEST_DB)).toEqual([]);
  });

  it('throws loudly even for a final targeted-arrival op if an invalid fixture bypasses the catalog', () => {
    const d = unsafe([{ op: 'createToken', token: targetedToken.id, count: 1 }]);
    const state = board(d.id);
    state.players[0].graveyard = ['bear'];
    const game = Game.restore(state, { ...db, [d.id]: d });
    expect(() => game.submit(0, { type: 'activate', iid: SOURCE, targets: [{ kind: 'grave', player: 0, index: 0 }] }))
      .toThrow('An activation cannot defer a targeted decision or response window.');
    expect(game.awaiting.kind).toBe('main');
  });

  it('retains the activation guard when a nested trigger owns the Foresee tail', () => {
    const d = carrier('marked_foreseer', ['creature'], {
      activated: { cost: { tap: true }, ops: [{ op: 'addCounters', n: 1, to: 'self' }] },
      abilities: [{ when: 'gainsMark', ops: [
        { op: 'foresee', n: 1 }, { op: 'createToken', token: targetedToken.id, count: 1 },
      ] }],
    });
    const fixtureDb = { ...db, [d.id]: d };
    expect(activatedCatalogErrors(d, fixtureDb)).toEqual([]);
    const game = Game.restore(board(d.id), fixtureDb);
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(game.awaiting.kind).toBe('foresee');
    expect(game.instanceState.pendingDecisions[0]).toMatchObject({
      thenContext: { controller: 0, sourceCardId: d.id, sourceIid: SOURCE, activated: true },
    });
    expect(() => game.submit(0, { type: 'foresee', bottomIndices: [] }))
      .toThrow('An activation cannot defer a targeted decision or response window.');
    expect(game.awaiting.kind).toBe('foresee');
  });
});

describe('shared Foresee continuation context', () => {
  const victim: CardDef = {
    ...TEST_DB.bear, id: 'dies_foreseer',
    abilities: [{ when: 'dies', ops: [{ op: 'foresee', n: 1 }] }],
  };
  const spell: CardDef = {
    id: 'kill_gain', name: 'Kill and gain', types: ['ritual'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [
      { op: 'destroy', to: 'target' }, { op: 'gainLife', n: 5 },
    ] }],
  };
  const db: CardDb = { ...DB, [victim.id]: victim, [spell.id]: spell };

  it('spell: caster gains 5 life after the victim controller chooses Foresee', () => {
    const state = board('tap_creature', [{ iid: TARGET, cardId: victim.id, controller: 1 }]);
    state.players[0].hand = [spell.id];
    const game = Game.restore(state, db);
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [permanent(TARGET)] });
    expect(game.awaiting).toMatchObject({ kind: 'foresee', player: 1 });
    expect(game.instanceState.pendingDecisions[0]).toMatchObject({
      thenContext: { controller: 0, sourceCardId: spell.id },
    });
    game.submit(1, { type: 'foresee', bottomIndices: [] });
    expect(game.instanceState.players.map((player) => player.life)).toEqual([25, 20]);
  });

  function foreseeActivation(ops: EffectOp[], player: PlayerId = 0) {
    const d = carrier('tap_foresee', ['creature'], { activated: { cost: { tap: true }, ops } });
    const fixtureDb: CardDb = { ...DB, [d.id]: d };
    expect(activatedCatalogErrors(d, fixtureDb)).toEqual([]);
    const state = board(d.id, [], { controller: player, owner: player });
    state.activePlayer = player;
    state.awaiting = { kind: 'main', player };
    return { game: Game.restore(state, fixtureDb), db: fixtureDb };
  }

  it.each([0, 1] as const)('activation: P%i gains 2 life under its own Foresee context', (player) => {
    const { game, db: fixtureDb } = foreseeActivation([{ op: 'foresee', n: 1 }, { op: 'gainLife', n: 2 }], player);
    game.submit(player, { type: 'activate', iid: SOURCE });
    expect(game.instanceState.pendingDecisions[0]).toMatchObject({
      thenContext: { controller: player, sourceCardId: 'tap_foresee', sourceIid: SOURCE },
    });
    const restored = Game.restore(JSON.parse(JSON.stringify(game.instanceState)), fixtureDb);
    const action = { type: 'foresee' as const, bottomIndices: [] };
    expect(restored.submit(player, action)).toEqual(game.submit(player, action));
    expect(game.instanceState.players.map((seat) => seat.life)).toEqual(player === 0 ? [22, 20] : [20, 22]);
    expect(JSON.stringify(restored.instanceState)).toBe(JSON.stringify(game.instanceState));
  });

  it('activation: Foresee then addCounters self marks its source and keeps life at [20, 20]', () => {
    const { game } = foreseeActivation([{ op: 'foresee', n: 1 }, { op: 'addCounters', n: 1, to: 'self' }]);
    game.submit(0, { type: 'activate', iid: SOURCE });
    game.submit(0, { type: 'foresee', bottomIndices: [] });
    expect(source(game.instanceState)).toMatchObject({ tapped: true, plusOneCounters: 1 });
    expect(game.instanceState.players.map((seat) => seat.life)).toEqual([20, 20]);
  });

  it('activation: Foresee then draw works and untaps at the next controller Dawn', () => {
    const { game } = foreseeActivation([{ op: 'foresee', n: 1 }, { op: 'draw', n: 1 }]);
    game.submit(0, { type: 'activate', iid: SOURCE });
    expect(game.instanceState.players[0].hand).toHaveLength(0);
    game.submit(0, { type: 'foresee', bottomIndices: [] });
    expect(game.instanceState.players[0].hand.map(cardIdOf)).toEqual(['forest']);
    expect(source(game.instanceState).tapped).toBe(true);
    advanceTo(game, (state) => state.activePlayer === 1 && state.awaiting.kind === 'main');
    expect(source(game.instanceState).tapped).toBe(true);
    advanceTo(game, (state) => state.activePlayer === 0 && state.awaiting.kind === 'main');
    expect(source(game.instanceState).tapped).toBe(false);
  });

  it('preserves the runtime throw for an inline-target tail that bypasses validation', () => {
    const d = carrier('unsafe_foresee', ['creature'], { activated: {
      cost: { tap: true }, targets: [{ what: 'creature' }],
      ops: [{ op: 'foresee', n: 1 }, { op: 'damage', n: 1, to: 'target' }],
    } });
    const game = Game.restore(board(d.id), { ...DB, [d.id]: d });
    expect(() => game.submit(0, { type: 'activate', iid: SOURCE, targets: [permanent(SOURCE)] }))
      .toThrow('A target-dependent op cannot follow foresee: damage.');
  });

  it('refuses to silently merge a victim tail and caster tail with different contexts', () => {
    const mixedVictim: CardDef = {
      ...victim, abilities: [{ when: 'dies', ops: [{ op: 'foresee', n: 1 }, { op: 'gainLife', n: 3 }] }],
    };
    const state = board('tap_creature', [{ iid: TARGET, cardId: victim.id, controller: 1 }]);
    state.players[0].hand = [spell.id];
    const game = Game.restore(state, { ...db, [victim.id]: mixedVictim });
    expect(() => game.submit(0, { type: 'castSpell', handIndex: 0, targets: [permanent(TARGET)] }))
      .toThrow('Cannot combine Foresee tails with different source contexts.');
  });
});

