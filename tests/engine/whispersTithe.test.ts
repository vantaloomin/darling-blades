import { describe, expect, it } from 'vitest';
import { CURRENT_RULES_REV } from '../../src/config/rules';
import type { Action } from '../../src/engine/actions';
import { castCost, legalActions, validateAction } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { solveMana } from '../../src/engine/mana';
import type {
  CardDb, CardDef, CardInstance, GameState, Permanent, PlayerId,
} from '../../src/engine/types';
import { cardIdOf, validateTitheDef, validateWhispersDef } from '../../src/engine/types';
import { viewFor } from '../../src/engine/view';
import {
  canReplay, finishReplay, isReplayLog, recordReplayAction, REPLAY_LOG_VERSION,
  replayDbStamp, replayGame, startReplayDraft,
} from '../../src/meta/Replay';
import { botAction, makeTestState, TEST_DB } from '../helpers';

/**
 * Owner ruling 2026-09-17: Whispers and Tithe may share a card (Cinderjaw is
 * the first). Engine fixtures only — no catalog, AI policy or UI dependency.
 */
type CastAction = Extract<Action, { type: 'castSpell' }>;
const ZERO = { generic: 0, pips: {} };

function creature(id: string, defense: number, extra: Partial<CardDef> = {}): CardDef {
  return {
    id, name: id, types: ['creature'], subtypes: ['Beast'], colors: ['G'], rarity: 'c',
    cost: { generic: 0, pips: {} }, attack: 0, defense, ...extra,
  };
}

const DB: CardDb = {
  ...TEST_DB,
  // Cinderjaw's shape in miniature: a printed generic the Whispers cost undercuts.
  dual: creature('dual', 4, {
    attack: 5, cost: { generic: 3, pips: { G: 1 } },
    whispers: { cost: { generic: 1, pips: { G: 1 } } }, tithe: { per: 2 }, skim: { cost: ZERO },
  }),
  dual_pips: creature('dual_pips', 4, {
    attack: 5, cost: { generic: 3, pips: { G: 1 } },
    whispers: { cost: { generic: 1, pips: { G: 2 } } }, tithe: { per: 2 },
  }),
  dual_free: creature('dual_free', 4, {
    attack: 5, cost: { generic: 3, pips: { G: 1 } },
    whispers: { cost: { generic: 0, pips: { G: 1 } } }, tithe: { per: 2 },
  }),
  dual_empower: creature('dual_empower', 4, {
    attack: 5, cost: { generic: 3, pips: { G: 1 } },
    whispers: { cost: { generic: 1, pips: { G: 1 } } }, tithe: { per: 2 },
    empower: { cost: { generic: 1, pips: { G: 1 } }, ops: [{ op: 'gainLife', n: 4 }] },
  }),
  dual_replay: creature('dual_replay', 3, {
    attack: 3, cost: { generic: 4, pips: { G: 1 } }, skim: { cost: ZERO },
    whispers: { cost: { generic: 1, pips: { G: 1 } } }, tithe: { per: 2 },
    abilities: [{ when: 'arrives', ops: [{ op: 'loseLife', n: 3, who: 'opponent' }] }],
  }),
  fodder_one: creature('fodder_one', 1),
  fodder_two: creature('fodder_two', 2),
  fodder_four: creature('fodder_four', 4),
  counter: {
    id: 'counter', name: 'counter', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'spell', targets: [{ what: 'spell' }], ops: [{ op: 'cancel', to: 'target' }] }],
  },
};

const body = (iid: number, cardId: string, controller: PlayerId = 0): Partial<Permanent> => ({
  iid, cardId, controller,
});
const forests = (count: number): Partial<Permanent>[] =>
  Array.from({ length: count }, (_, index) => body(100 + index, 'forest'));

function fresh(cardId: string, owner: PlayerId = 0): CardInstance {
  return { cardId, instanceId: 500, variantKey: null, whispersUntilDawnOf: owner === 0 ? 1 : 0 };
}

function board(opts: {
  cardId?: string;
  battlefield?: Partial<Permanent>[];
  hand?: string[];
  opponentHand?: string[];
  live?: boolean;
} = {}): GameState {
  const state = makeTestState({
    hands: [opts.hand ?? [], opts.opponentHand ?? []],
    battlefield: opts.battlefield ?? [],
    active: 0,
  });
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 1000;
  state.players[0].deck = Array.from({ length: 12 }, () => 'forest');
  state.players[1].deck = Array.from({ length: 12 }, () => 'forest');
  const cardId = opts.cardId ?? 'dual';
  state.players[0].graveyard = [
    (opts.live ?? true) ? fresh(cardId) : { cardId, instanceId: 500, variantKey: null },
  ];
  return state;
}

function whisperCasts(state: GameState, db: CardDb = DB): CastAction[] {
  return legalActions(state, db, 0).filter(
    (action): action is CastAction => action.type === 'castSpell' && action.whispers === true,
  );
}

function pairCost(state: GameState, sacrifices: number[], cardId = 'dual', db: CardDb = DB) {
  return castCost(db[cardId], false, false, false, { whispers: true, tithe: true, sacrifices, state, db });
}

function pairAction(sacrifices: number[], extra: Partial<CastAction> = {}): CastAction {
  return {
    type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true, tithe: true, sacrifices, ...extra,
  };
}

function firstEvent(events: GameEvent[], kind: GameEvent['e']): number {
  const index = events.findIndex((event) => event.e === kind);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe('Whispers plus Tithe definition contract', () => {
  it('accepts the pair in both validators and keeps every other exclusion', () => {
    expect(validateWhispersDef(DB.dual)).toEqual([]);
    expect(validateTitheDef(DB.dual)).toEqual([]);
    for (const patch of [
      { retell: { cost: ZERO } }, { rite: { n: 1 } }, { hauntlink: { cost: ZERO, linked: { p: 1 } } },
      { x: { min: 1 } },
    ] satisfies Partial<CardDef>[]) {
      expect(validateWhispersDef({ ...DB.dual, ...patch }).length, JSON.stringify(patch)).toBeGreaterThan(0);
      expect(validateTitheDef({ ...DB.dual, ...patch }).length, JSON.stringify(patch)).toBeGreaterThan(0);
    }
  });
});

describe('Whispers plus Tithe legal menu', () => {
  it('offers the plain Whispers cast and exactly one canonical Whispers-plus-Tithe cast', () => {
    const state = board({ battlefield: [...forests(2), body(10, 'fodder_two'), body(20, 'fodder_four')] });
    const casts = whisperCasts(state);
    expect(casts).toHaveLength(2);
    expect(casts.filter((cast) => cast.tithe)).toHaveLength(1);
    const plain = casts.find((cast) => !cast.tithe)!;
    expect(plain).toMatchObject({ whispers: true, graveIndex: 0, handIndex: 0 });
    expect(plain.sacrifices).toBeUndefined();
    // The canonical fodder pays down the WHISPERS generic (1), not the printed
    // generic (3): Defense-ascending, the 2/2 alone already covers it.
    expect(casts.find((cast) => cast.tithe)).toMatchObject({
      whispers: true, tithe: true, graveIndex: 0, handIndex: 0, sacrifices: [10],
    });
  });

  it('offers neither Whispers cast once the marker is no longer live', () => {
    const state = board({ live: false, battlefield: [...forests(2), body(10, 'fodder_two')] });
    expect(whisperCasts(state)).toEqual([]);
    expect(validateAction(state, DB, 0, pairAction([10]))).not.toBeNull();
  });

  it('omits the Tithe variant when the Whispers cost has no generic part to buy down', () => {
    const state = board({ cardId: 'dual_free', battlefield: [...forests(1), body(10, 'fodder_two')] });
    const casts = whisperCasts(state);
    expect(casts).toHaveLength(1);
    expect(casts[0].tithe).toBeUndefined();
  });

  it('still offers the printed-cost Tithe cast from hand on the same card', () => {
    const state = board({ hand: ['dual'], battlefield: [...forests(4), body(10, 'fodder_two'), body(20, 'fodder_four')] });
    const handCasts = legalActions(state, DB, 0).filter(
      (action): action is CastAction => action.type === 'castSpell' && !action.whispers,
    );
    expect(handCasts.filter((cast) => cast.tithe)).toHaveLength(1);
    // Printed generic 3 needs six Defense, so the canonical set takes both bodies.
    expect(handCasts.find((cast) => cast.tithe)?.sacrifices).toEqual([10, 20]);
  });
});

describe('Whispers plus Tithe cast cost', () => {
  it.each([
    { ids: [] as number[], generic: 1 },
    { ids: [10], generic: 0 },
    { ids: [20], generic: 0 },
    { ids: [10, 20], generic: 0 },
  ])('discounts the Whispers generic to $generic for $ids', ({ ids, generic }) => {
    const state = board({ battlefield: [...forests(2), body(10, 'fodder_two'), body(20, 'fodder_four')] });
    expect(pairCost(state, ids)).toEqual({ generic, pips: { G: 1 } });
  });

  it('never reduces coloured pips and never drops the generic below zero', () => {
    const state = board({ cardId: 'dual_pips', battlefield: [...forests(3), body(20, 'fodder_four')] });
    // Four Defense buys two generic against a Whispers generic of one.
    expect(pairCost(state, [20], 'dual_pips')).toEqual({ generic: 0, pips: { G: 2 } });
    expect(pairCost(state, [], 'dual_pips')).toEqual({ generic: 1, pips: { G: 2 } });
  });

  it('prices the printed Tithe cast off the printed cost, not the Whispers one', () => {
    const state = board({ hand: ['dual'], battlefield: [...forests(4), body(10, 'fodder_two')] });
    expect(castCost(DB.dual, false, false, false, { tithe: true, sacrifices: [10], state, db: DB }))
      .toEqual({ generic: 2, pips: { G: 1 } });
  });

  it('refuses the pair on a card missing either block', () => {
    const state = board({ battlefield: [body(10, 'fodder_two')] });
    const db: CardDb = { ...DB, dual: { ...DB.dual, tithe: undefined } };
    expect(castCost(db.dual, false, false, false, { whispers: true, tithe: true, sacrifices: [10], state, db }))
      .toBeUndefined();
    expect(castCost(TEST_DB.bear, false, false, false, { whispers: true, tithe: true, sacrifices: [10], state, db: DB }))
      .toBeUndefined();
  });
});

describe('Whispers plus Tithe payment', () => {
  it('spends the discounted mana and buries the fodder before the spell reaches the stack', () => {
    const game = Game.restore(
      board({ battlefield: [...forests(2), body(10, 'fodder_two')], opponentHand: ['counter'] }), DB,
    );
    const events = game.submit(0, pairAction([10], { manaPlan: [100] }));
    // Whispers {1}{G} minus one generic: a single Forest pays the whole cast.
    expect(events).toContainEqual({ e: 'manaTapped', player: 0, iids: [100] });
    expect(events).toContainEqual({ e: 'died', iid: 10, cardId: 'fodder_two', owner: 0 });
    expect(firstEvent(events, 'manaTapped')).toBeLessThan(firstEvent(events, 'died'));
    expect(firstEvent(events, 'died')).toBeLessThan(firstEvent(events, 'spellCast'));
    expect(events.some((event) => event.e === 'whispered')).toBe(true);
    expect(game.instanceState.battlefield.some((perm) => perm.iid === 10)).toBe(false);
    expect(game.instanceState.battlefield.find((perm) => perm.iid === 101)?.tapped).toBe(false);
    expect(game.instanceState.stack.map((item) => item.cardId)).toEqual(['dual']);
    expect(game.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['fodder_two']);
  });

  it('auto-solves the discounted cost when no mana plan is supplied', () => {
    const game = Game.restore(board({ battlefield: [...forests(2), body(10, 'fodder_four')] }), DB);
    const events = game.submit(0, pairAction([10]));
    const tapped = events.find((event) => event.e === 'manaTapped');
    expect(tapped).toBeDefined();
    expect(tapped && tapped.e === 'manaTapped' ? tapped.iids : []).toHaveLength(1);
  });

  it('resolves the whispered body onto the battlefield and leaves no marker behind', () => {
    const game = Game.restore(board({ battlefield: [...forests(2), body(10, 'fodder_two')] }), DB);
    game.submit(0, pairAction([10], { manaPlan: [100] }));
    for (let guard = 0; guard < 8 && game.instanceState.stack.length > 0; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') break;
      game.submit(awaiting.player, botAction(game.legalActions(awaiting.player)));
    }
    expect(game.instanceState.stack).toEqual([]);
    expect(game.instanceState.battlefield.some((perm) => perm.cardId === 'dual')).toBe(true);
    expect(JSON.stringify(game.instanceState.battlefield)).not.toContain('whispersUntilDawnOf');
  });

  it('still pays and resolves the printed-cost Tithe cast on the same card', () => {
    const game = Game.restore(board({
      hand: ['dual'], battlefield: [...forests(4), body(10, 'fodder_two'), body(20, 'fodder_four')],
    }), DB);
    // Printed {3}{G} minus three generic for nine Defense: one Forest pays it.
    const events = game.submit(0, {
      type: 'castSpell', handIndex: 0, tithe: true, sacrifices: [10, 20], manaPlan: [100],
    });
    expect(events).toContainEqual({ e: 'manaTapped', player: 0, iids: [100] });
    expect(game.instanceState.players[0].graveyard.map(cardIdOf))
      .toEqual(['dual', 'fodder_two', 'fodder_four']);
    // No opponent response is possible here, so the printed cast resolves at once.
    expect(game.instanceState.stack).toEqual([]);
    expect(game.instanceState.battlefield.filter((perm) => perm.cardId === 'dual')).toHaveLength(1);
    expect(JSON.stringify(game.instanceState.battlefield)).not.toContain('whispered');
  });

  it('keeps paid fodder dead when the whispered Tithe spell is cancelled', () => {
    const game = Game.restore(
      board({ battlefield: [...forests(2), body(10, 'fodder_two')], opponentHand: ['counter'] }), DB,
    );
    game.submit(0, pairAction([10], { manaPlan: [100] }));
    const counter = game.legalActions(1).find((action) => action.type === 'castSpell');
    if (!counter) throw new Error('fixture has no counter action');
    game.submit(1, counter);
    expect(game.instanceState.battlefield.some((perm) => perm.iid === 10)).toBe(false);
    expect(game.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['fodder_two', 'dual']);
  });
});

describe('Whispers plus Tithe validation', () => {
  const state = () => board({
    battlefield: [...forests(2), body(10, 'fodder_two'), body(20, 'fodder_four'), body(30, 'fodder_one', 1)],
  });

  it('accepts any legal subset of your own creatures, canonical or not', () => {
    for (const ids of [[10], [20], [10, 20], [20, 10]]) {
      expect(validateAction(state(), DB, 0, pairAction(ids)), String(ids)).toBeNull();
    }
  });

  it('rejects an opposing creature, a duplicate and an absent iid', () => {
    expect(validateAction(state(), DB, 0, pairAction([30]))).toContain('creatures you control');
    expect(validateAction(state(), DB, 0, pairAction([10, 10]))).toContain('duplicate Tithe sacrifice');
    expect(validateAction(state(), DB, 0, pairAction([999]))).toContain('creatures you control');
    expect(validateAction(state(), DB, 0, pairAction([100]))).toContain('creatures you control');
  });

  it('keeps Empower, X, Retell and Hauntlink incompatible with the whispered cast', () => {
    const empowerState = board({
      cardId: 'dual_empower',
      battlefield: [...forests(4), body(10, 'fodder_two')],
    });
    expect(validateAction(empowerState, DB, 0, pairAction([10], { empowered: true })))
      .toBe('Whispers cannot combine with Retell, Hauntlink, Empower or X');
    expect(whisperCasts(empowerState).every((cast) => !cast.empowered)).toBe(true);
    for (const patch of [{ x: 1 }, { retell: true as const }, { hauntlinked: true as const }]) {
      expect(validateAction(state(), DB, 0, pairAction([10], patch))).not.toBeNull();
    }
  });

  it('rejects the pair when the card carries no Tithe block', () => {
    const db: CardDb = { ...DB, dual: { ...DB.dual, tithe: undefined } };
    expect(validateAction(state(), db, 0, pairAction([10]))).toBe('invalid Tithe cast');
  });
});

describe('Whispers plus Tithe redacted view', () => {
  it('publishes the live index and leaks no new hidden state', () => {
    const state = board({ battlefield: [...forests(2), body(10, 'fodder_two')] });
    const view = viewFor(state, 0);
    expect(view.you.whispersLive).toEqual([0]);
    expect(view.opp.whispersLive).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('whispersUntilDawnOf');
    expect(legalActions(state, DB, 1)).toEqual([]);
  });
});

function replayFixture() {
  const seed = 51099;
  const deck = [
    ...Array.from({ length: 9 }, () => 'forest'),
    ...Array.from({ length: 7 }, () => 'fodder_two'),
    ...Array.from({ length: 8 }, () => 'dual_replay'),
  ];
  const decks: [string[], string[]] = [[...deck], [...deck]];
  const game = new Game({ decks, seed, db: DB });
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(DB), seed, decks,
    context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Whispers-Tithe fixture', gauntletRung: null },
  });
  const events: GameEvent[] = [...game.initialEvents];
  for (let guard = 0; guard < 2000; guard++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      return { game, events, log: finishReplay(draft, game.instanceState.winner === 0 ? 'win' : 'loss', 0, game.instanceState.turn) };
    }
    const player = awaiting.player;
    const legal = game.legalActions(player);
    const pair = legal.find((action): action is CastAction =>
      action.type === 'castSpell' && action.whispers === true && action.tithe === true);
    let action: Action | undefined = legal.find((candidate) => candidate.type === 'passResponse');
    if (!action && pair) {
      const st = game.instanceState;
      const d = DB[cardIdOf(st.players[player].graveyard[pair.graveIndex!])];
      const cost = castCost(d, false, false, false, {
        whispers: true, tithe: true, sacrifices: pair.sacrifices, state: st, db: DB,
      });
      if (!cost) throw new Error('Whispers-Tithe replay cost missing');
      const manaPlan = solveMana(st, DB, player, cost);
      if (!manaPlan) throw new Error('Whispers-Tithe replay mana plan missing');
      action = { ...pair, manaPlan };
    }
    action ??= legal.find((candidate) => candidate.type === 'playLand') ??
      legal.find((candidate) => candidate.type === 'skim') ?? botAction(legal);
    events.push(...game.submit(player, action));
    recordReplayAction(draft, player, action);
  }
  throw new Error('Whispers-Tithe replay fixture did not terminate');
}

describe('Whispers plus Tithe replay', () => {
  it('round-trips a terminal game containing the combined cast without a log version bump', () => {
    const recorded = replayFixture();
    expect(CURRENT_RULES_REV).toBe(4);
    // Both castSpell fields already existed: the log shape is unchanged at v14.
    expect(REPLAY_LOG_VERSION).toBe(14);
    expect(recorded.log.v).toBe(14);
    expect(recorded.game.awaiting.kind).toBe('gameOver');
    const pairs = recorded.log.actions.filter((step) =>
      step.a.type === 'castSpell' && step.a.whispers && step.a.tithe);
    expect(pairs.length).toBeGreaterThan(0);
    for (const step of pairs) {
      expect(step.a).toMatchObject({
        whispers: true, tithe: true, graveIndex: expect.any(Number),
        sacrifices: expect.any(Array), manaPlan: expect.any(Array),
      });
    }
    expect(JSON.stringify(recorded.log)).not.toContain('whispersUntilDawnOf');
    const revived = JSON.parse(JSON.stringify(recorded.log));
    expect(isReplayLog(revived)).toBe(true);
    expect(canReplay(revived, DB)).toBe(true);
    const replayed = replayGame(revived, DB);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(recorded.game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(recorded.events));
  });
});
