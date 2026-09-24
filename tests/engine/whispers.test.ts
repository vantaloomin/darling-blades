import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import {
  castCost, hasCastableCharm, hasCastableInstant, legalActions, validateAction,
} from '../../src/engine/actions';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import { startTurn } from '../../src/engine/phases';
import type {
  CardDb, CardDef, CardEntry, CardInstance, GameState, Permanent, PlayerId, TargetRef,
} from '../../src/engine/types';
import {
  cardIdOf, isCardInstance, opponentOf, validateActivatedDef, validateHauntlinkDef,
  validateRiteDef, validateWhispersDef,
} from '../../src/engine/types';
import {
  canReplay, finishReplay, isReplayLog, recordReplayAction,
  replayDbStamp, replayGame, startReplayDraft,
} from '../../src/meta/Replay';
import { botAction, makeTestState, TEST_DB } from '../helpers';

/** Engine-only Drowned Deep fixtures. Neither card data nor AI policy is exercised. */
type CastAction = Extract<Action, { type: 'castSpell' }>;
const ZERO = { generic: 0, pips: {} };
const permanent = (iid: number): TargetRef => ({ kind: 'permanent', iid });

function carrier(id: string, types: CardDef['types'] = ['charm'], extra: Partial<CardDef> = {}): CardDef {
  return {
    id, name: id, types, subtypes: [], colors: [], rarity: 'c',
    cost: { generic: 4, pips: {} }, whispers: { cost: ZERO }, skim: { cost: ZERO },
    ...(types.includes('creature') ? { attack: 2, defense: 3 } : {}),
    ...extra,
  };
}

function spell(id: string, ops: NonNullable<CardDef['abilities']>[number]['ops'], targets?: NonNullable<CardDef['abilities']>[number]['targets']): CardDef {
  return {
    id, name: id, types: ['charm'], subtypes: [], colors: [], rarity: 'c', cost: ZERO,
    abilities: [{ when: 'spell', ops, ...(targets ? { targets } : {}) }],
  };
}

const DB: CardDb = {
  ...TEST_DB,
  wh_charm: carrier('wh_charm', ['charm'], {
    abilities: [{ when: 'spell', ops: [{ op: 'damage', n: 1, to: 'opponent' }] }],
  }),
  wh_creature: carrier('wh_creature', ['creature']),
  wh_ritual: carrier('wh_ritual', ['ritual']),
  wh_artifact: carrier('wh_artifact', ['artifact']),
  wh_enchantment: carrier('wh_enchantment', ['enchantment']),
  wh_paid: carrier('wh_paid', ['charm'], {
    cost: { generic: 9, pips: { R: 1 } },
    whispers: { cost: { generic: 1, pips: { U: 1 } } },
    empower: { cost: { generic: 2, pips: { G: 1 } }, ops: [{ op: 'gainLife', n: 50 }] },
    abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 1 }] }],
  }),
  wh_target: carrier('wh_target', ['charm'], {
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 1, to: 'target' }] }],
  }),
  wh_optional: carrier('wh_optional', ['charm'], {
    abilities: [{ when: 'spell', targets: [{ what: 'any', marked: true, tapped: true, upTo: 2 }], ops: [{ op: 'damage', n: 1, to: 'target' }] }],
    empower: { cost: ZERO, ops: [{ op: 'gainLife', n: 1 }] },
  }),
  wh_trigger: carrier('wh_trigger', ['creature'], {
    abilities: [{ when: 'entersGraveyard', ops: [{ op: 'gainLife', n: 2 }] }],
  }),
  wh_trigger_charm: carrier('wh_trigger_charm', ['charm'], {
    abilities: [{ when: 'entersGraveyard', ops: [{ op: 'gainLife', n: 2 }] }],
  }),
  wh_nine: carrier('wh_nine', ['creature'], { nineLives: true }),
  wh_preserve: carrier('wh_preserve', ['creature'], { preserve: { cost: ZERO } }),
  wh_replay: carrier('wh_replay', ['charm'], {
    cost: { generic: 9, pips: {} },
    abilities: [{ when: 'spell', ops: [{ op: 'damage', n: 3, to: 'opponent' }] }],
  }),
  discard: spell('discard', [{ op: 'discardRandom', n: 1, who: 'opponent' }]),
  mill_self: spell('mill_self', [{ op: 'grind', n: 1, who: 'self' }]),
  mill_opponent: spell('mill_opponent', [{ op: 'grind', n: 1, who: 'opponent' }]),
  sever_top: spell('sever_top', [{ op: 'severTop', n: 1, who: 'self' }]),
  sever_grave: spell('sever_grave', [{ op: 'severGrave', n: 1, who: 'self' }]),
  destroy: spell('destroy', [{ op: 'destroy', to: 'target' }], [{ what: 'creature' }]),
  sever: spell('sever', [{ op: 'sever', to: 'target' }], [{ what: 'creature' }]),
  counter: spell('counter', [{ op: 'cancel', to: 'target' }], [{ what: 'spell' }]),
};

function tagged(cardId: string, owner: PlayerId = 0, instanceId = 1000): CardInstance {
  return { cardId, instanceId, variantKey: null, whispersUntilDawnOf: opponentOf(owner) };
}

function board(opts: {
  hands?: [string[], string[]];
  graveyards?: [CardEntry[], CardEntry[]];
  battlefield?: Partial<Permanent>[];
  active?: PlayerId;
} = {}): GameState {
  const state = makeTestState(opts);
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.nextIid = 100;
  state.players[0].deck = Array.from({ length: 20 }, () => 'forest');
  state.players[1].deck = Array.from({ length: 20 }, () => 'forest');
  state.players[0].graveyard = opts.graveyards?.[0] ?? [];
  state.players[1].graveyard = opts.graveyards?.[1] ?? [];
  return state;
}

function graveBoard(cardId = 'wh_charm', player: PlayerId = 0): GameState {
  const state = board({ active: player });
  state.players[player].graveyard = [tagged(cardId, player)];
  return state;
}

function whispers(state: GameState, player: PlayerId = 0, db: CardDb = DB): CastAction[] {
  return legalActions(state, db, player).filter(
    (action): action is CastAction => action.type === 'castSpell' && action.whispers === true,
  );
}

function whisperAction(game: Game, player: PlayerId = 0): CastAction {
  const action = whispers(game.instanceState, player)[0];
  if (!action) throw new Error('Fixture has no legal Whispers cast');
  return action;
}

function graveCard(game: Game, player: PlayerId, cardId: string): CardInstance {
  const entry = game.instanceState.players[player].graveyard.find((card) => cardIdOf(card) === cardId);
  if (entry === undefined || !isCardInstance(entry)) throw new Error(`Missing graveyard instance: ${cardId}`);
  return entry;
}

function passUntil(game: Game, ready: (state: Readonly<GameState>) => boolean): void {
  for (let guard = 0; guard < 100; guard++) {
    if (ready(game.instanceState)) return;
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') throw new Error('Fixture ended before requested phase');
    const actions = game.legalActions(awaiting.player);
    const action = actions.find((candidate) => candidate.type === 'passResponse') ??
      actions.find((candidate) => candidate.type === 'passStep') ??
      actions.find((candidate) => candidate.type === 'declareAttackers' && candidate.attackers.length === 0) ??
      botAction(actions);
    game.submit(awaiting.player, action);
  }
  throw new Error('Fixture never reached requested phase');
}

describe('Whispers definition contract', () => {
  it.each(['wh_charm', 'wh_creature', 'wh_ritual', 'wh_artifact', 'wh_enchantment'])('accepts the %s carrier', (id) => {
    expect(validateWhispersDef(DB[id])).toEqual([]);
  });

  it.each([
    ['Retell', { retell: { cost: ZERO } }],
    ['Rite', { rite: { n: 1 } }],
    ['Hauntlink', { hauntlink: { cost: ZERO, linked: { p: 1 } } }],
    ['X', { x: { min: 1 } }],
  ] as [string, Partial<CardDef>][])('refuses %s on a Whispers definition', (name, patch) => {
    expect(validateWhispersDef({ ...DB.wh_creature, ...patch }).join('; ')).toMatch(new RegExp(name, 'i'));
  });

  it('mirrors the exclusions in Rite and Hauntlink validators', () => {
    expect(validateRiteDef({ ...DB.wh_creature, skim: undefined, rite: { n: 1 } }).join('; ')).toMatch(/Whispers/i);
    expect(validateHauntlinkDef({
      ...DB.wh_artifact, skim: undefined, hauntlink: { cost: ZERO, linked: { p: 1 } },
    }).join('; ')).toMatch(/Whispers/i);
  });

  it('allows Empower, Skim, Preserve, Nine Lives and Duty alongside Whispers', () => {
    const duty = carrier('wh_duty', ['creature'], {
      empower: { cost: ZERO, ops: [{ op: 'gainLife', n: 1 }] },
      preserve: { cost: ZERO }, nineLives: true,
      activated: { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] },
    });
    expect(validateWhispersDef(duty)).toEqual([]);
    expect(validateActivatedDef(duty)).toEqual([]);
    expect(validateWhispersDef(TEST_DB.bear)).toEqual([]);
  });
});

describe('Whispers graveyard origin matrix', () => {
  it.each([0, 1] as const)('tags P%i hand via Skim with that owner\'s opponent', (player) => {
    const state = board({ active: player });
    state.players[player].hand = ['wh_charm'];
    const game = Game.restore(state, DB);
    const events = game.submit(player, { type: 'skim', handIndex: 0 });
    expect(graveCard(game, player, 'wh_charm').whispersUntilDawnOf).toBe(opponentOf(player));
    expect(events).toContainEqual({ e: 'skimmed', player, cardId: 'wh_charm' });
    expect(game.instanceState.stack).toEqual([]);
  });

  it.each([0, 1] as const)('tags P%i hand via the opponent\'s discardRandom', (owner) => {
    const caster = opponentOf(owner);
    const state = board({ active: caster });
    state.players[owner].hand = ['wh_creature'];
    state.players[caster].hand = ['discard'];
    const game = Game.restore(state, DB);
    game.submit(caster, { type: 'castSpell', handIndex: 0 });
    // The victim's Skim opens the ordinary response window; passing permits discard.
    passUntil(game, (current) => current.stack.length === 0);
    expect(graveCard(game, owner, 'wh_creature').whispersUntilDawnOf).toBe(caster);
  });

  it.each([
    [0, 'mill_self'], [1, 'mill_self'], [0, 'mill_opponent'], [1, 'mill_opponent'],
  ] as const)('tags the deck card milled by P%i using %s', (caster, mill) => {
    const owner = mill === 'mill_self' ? caster : opponentOf(caster);
    const state = board({ active: caster });
    state.players[caster].hand = [mill];
    state.players[owner].deck.push('wh_creature');
    const game = Game.restore(state, DB);
    const events = game.submit(caster, { type: 'castSpell', handIndex: 0 });
    expect(graveCard(game, owner, 'wh_creature').whispersUntilDawnOf).toBe(opponentOf(owner));
    expect(events).toContainEqual({ e: 'milled', player: owner, cardId: 'wh_creature' });
  });

  it('tags a raw legacy-string grind entry with a fresh identity and fires its graveyard trigger once', () => {
    const state = board({ battlefield: [{ iid: 20, cardId: 'bear', controller: 0 }] });
    state.battlefield[0].instanceId = 6000;
    state.players[0].deck.push('wh_trigger');
    const events: GameEvent[] = [];
    expect(state.nextInstanceId).toBeUndefined();
    runOps(state, DB, (event) => events.push(event), {
      controller: 0, sourceCardId: 'mill_self', targets: [],
    }, [{ op: 'grind', n: 1, who: 'self' }]);
    expect(state.players[0].graveyard).toEqual([{
      instanceId: 6001, cardId: 'wh_trigger', variantKey: null, whispersUntilDawnOf: 1,
    }]);
    expect(state.nextInstanceId).toBe(6002);
    expect(events.filter((event) => event.e === 'graveyardTriggerFired')).toHaveLength(1);
    expect(events.filter((event) => event.e === 'milled')).toHaveLength(1);
    expect(state.players[0].life).toBe(22);
  });

  it('tags cleanup hand-size discard before the opponent Dawn clears it', () => {
    const snapshots: CardEntry[][] = [];
    const game = new Game({
      db: DB, decks: [Array<string>(20).fill('forest'), Array<string>(20).fill('forest')], seed: 918,
      eventObserver: (event, current) => {
        if (event.e === 'discarded') snapshots.push(structuredClone(current.players[event.player].graveyard));
      },
    });
    const state = board({ hands: [['wh_creature', ...Array<string>(7).fill('forest')], []] });
    state.step = 'main2';
    Object.assign(game.instanceState, Game.restore(state, DB).instanceState);
    game.submit(0, { type: 'passStep' });
    expect(game.awaiting).toEqual({ player: 0, kind: 'discardToHandSize', count: 1 });
    const events = game.submit(0, { type: 'discard', handIndices: [0] });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0][0]).toMatchObject({ cardId: 'wh_creature', whispersUntilDawnOf: 1 });
    expect(events).toContainEqual({ e: 'turnBegan', player: 1, turn: 4 });
    expect(graveCard(game, 0, 'wh_creature')).not.toHaveProperty('whispersUntilDawnOf');
  });

  it('never tags a battlefield death, including a creature controlled by its owner\'s opponent', () => {
    const state = board({
      hands: [['destroy'], []],
      battlefield: [{ iid: 20, cardId: 'wh_creature', controller: 0, owner: 1 }],
    });
    const game = Game.restore(state, DB);
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [permanent(20)] });
    expect(graveCard(game, 1, 'wh_creature')).not.toHaveProperty('whispersUntilDawnOf');
  });

  it('never tags a hand-cast Whispers spell returning from the stack after resolution', () => {
    const state = board({
      hands: [['wh_charm'], []],
      battlefield: [1, 2, 3, 4].map((iid) => ({ iid, cardId: 'forest', controller: 0 })),
    });
    const game = Game.restore(state, DB);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(graveCard(game, 0, 'wh_charm')).not.toHaveProperty('whispersUntilDawnOf');
    expect(events.some((event) => event.e === 'whispered')).toBe(false);
  });

  it('never tags a hand-cast Whispers spell returning from the stack after cancellation', () => {
    const state = board({
      hands: [['wh_creature'], ['counter']],
      battlefield: [1, 2, 3, 4].map((iid) => ({ iid, cardId: 'forest', controller: 0 })),
    });
    const game = Game.restore(state, DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    const sid = game.instanceState.stack[0].sid;
    const events = game.submit(1, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'stackItem', sid }] });
    expect(events).toContainEqual({ e: 'spellCountered', sid });
    expect(graveCard(game, 0, 'wh_creature')).not.toHaveProperty('whispersUntilDawnOf');
  });

  it('does not tag deck or battlefield cards moved directly to severed', () => {
    for (const origin of ['deck', 'battlefield'] as const) {
      const state = board({
        hands: [[origin === 'deck' ? 'sever_top' : 'sever'], []],
        battlefield: origin === 'battlefield' ? [{ iid: 20, cardId: 'wh_creature', controller: 0 }] : [],
      });
      if (origin === 'deck') state.players[0].deck.push('wh_creature');
      const game = Game.restore(state, DB);
      game.submit(0, { type: 'castSpell', handIndex: 0, ...(origin === 'battlefield' ? { targets: [permanent(20)] } : {}) });
      const severed = game.instanceState.players[0].severed;
      expect(severed).toHaveLength(1);
      expect(severed[0]).toMatchObject({ cardId: 'wh_creature' });
      expect(severed[0]).not.toHaveProperty('whispersUntilDawnOf');
      expect(whispers(game.instanceState)).toEqual([]);
    }
  });

  it('cannot cast a formerly tagged card after it is severed from the graveyard', () => {
    const state = graveBoard();
    state.players[0].hand = ['sever_grave'];
    const game = Game.restore(state, DB);
    game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(game.instanceState.players[0].severed.map(cardIdOf)).toEqual(['wh_charm']);
    expect(whispers(game.instanceState)).toEqual([]);
  });
});

describe('Whispers Dawn expiry', () => {
  it('remains castable through the tagging player\'s Afternoon and expires at the opponent Dawn', () => {
    const game = Game.restore(board({ hands: [['wh_charm'], []] }), DB);
    game.submit(0, { type: 'skim', handIndex: 0 });
    passUntil(game, (state) => state.activePlayer === 0 && state.step === 'main2');
    expect(graveCard(game, 0, 'wh_charm').whispersUntilDawnOf).toBe(1);
    const afternoon = game.clone();
    expect(afternoon.submit(0, whisperAction(afternoon))).toContainEqual({ e: 'whispered', player: 0, cardId: 'wh_charm' });
    passUntil(game, (state) => state.activePlayer === 1 && state.step === 'main1');
    expect(graveCard(game, 0, 'wh_charm')).not.toHaveProperty('whispersUntilDawnOf');
    expect(hasCastableCharm(game.instanceState, DB, 0)).toBe(false);
  });

  it('survives tagging on the opponent turn and the owner\'s whole next turn', () => {
    const game = Game.restore(board({ active: 1, hands: [['wh_charm'], ['discard']] }), DB);
    game.submit(1, { type: 'castSpell', handIndex: 0 });
    passUntil(game, (state) => state.stack.length === 0);
    expect(graveCard(game, 0, 'wh_charm').whispersUntilDawnOf).toBe(1);
    passUntil(game, (state) => state.activePlayer === 1 && state.step === 'main2');
    expect(hasCastableCharm(game.instanceState, DB, 0)).toBe(true);
    passUntil(game, (state) => state.activePlayer === 0 && state.step === 'main1');
    expect(whispers(game.instanceState)).toHaveLength(1);
    passUntil(game, (state) => state.activePlayer === 0 && state.step === 'main2');
    expect(whispers(game.instanceState)).toHaveLength(1);
    passUntil(game, (state) => state.activePlayer === 1 && state.step === 'main1');
    expect(graveCard(game, 0, 'wh_charm')).not.toHaveProperty('whispersUntilDawnOf');
    expect(hasCastableCharm(game.instanceState, DB, 0)).toBe(false);
  });

  it('clears matching Dawn markers in both graveyards and retains other deadlines', () => {
    const state = board({ graveyards: [
      [tagged('wh_charm', 0, 1000), tagged('wh_creature', 1, 1001)],
      [tagged('wh_charm', 0, 1002), tagged('wh_creature', 1, 1003)],
    ], active: 1 });
    // Mixed deadlines deliberately isolate the hook from the origin writer.
    startTurn(state, DB, () => {});
    for (const player of state.players) {
      expect(player.graveyard[0]).not.toHaveProperty('whispersUntilDawnOf');
      expect(player.graveyard[1]).toMatchObject({ whispersUntilDawnOf: 0 });
    }
  });
});

describe('Whispers source, window and cost legality', () => {
  it.each(['wh_charm', 'wh_creature', 'wh_ritual', 'wh_artifact', 'wh_enchantment'])('%s is castable in both own main phases', (id) => {
    for (const step of ['main1', 'main2'] as const) {
      const state = graveBoard(id);
      state.step = step;
      const action = whispers(state)[0];
      expect(action).toMatchObject({ type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true });
      expect(validateAction(state, DB, 0, action)).toBeNull();
    }
  });

  it.each(['respond', 'endStepWindow'] as const)('permits a Charm in %s and refuses the slower card types', (kind) => {
    for (const id of ['wh_charm', 'wh_creature', 'wh_ritual', 'wh_artifact', 'wh_enchantment']) {
      const state = graveBoard(id);
      state.activePlayer = 1;
      state.step = 'combat';
      state.awaiting = kind === 'respond'
        ? { player: 0, kind, over: { type: 'attackers' } }
        : { player: 0, kind };
      const action: CastAction = { type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true };
      expect(whispers(state)).toHaveLength(id === 'wh_charm' ? 1 : 0);
      if (id === 'wh_charm') expect(validateAction(state, DB, 0, action)).toBeNull();
      else expect(validateAction(state, DB, 0, action)).not.toBeNull();
    }
  });

  it.each(['wh_creature', 'wh_ritual', 'wh_artifact', 'wh_enchantment'])('%s requires an own main step and an empty stack', (id) => {
    const action: CastAction = { type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true };
    const wrongTurn = graveBoard(id);
    wrongTurn.activePlayer = 1;
    const wrongStep = graveBoard(id);
    wrongStep.step = 'combat';
    const stacked = graveBoard(id);
    stacked.stack.push({ sid: 1, cardId: 'wh_charm', controller: 1, targets: [] });
    for (const state of [wrongTurn, wrongStep, stacked]) {
      expect(whispers(state)).toEqual([]);
      expect(validateAction(state, DB, 0, action)).not.toBeNull();
    }
  });

  it('never introduces a Charm cast into the Hauntlink-only window', () => {
    const state = graveBoard();
    state.awaiting = { player: 0, kind: 'hauntlinkWindow', over: { type: 'combatDamage' } };
    expect(whispers(state)).toEqual([]);
    expect(validateAction(state, DB, 0, { type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true })).not.toBeNull();
  });

  it('requires a live marker on this player\'s graveyard entry', () => {
    const action: CastAction = { type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true };
    const bare = board({ graveyards: [['wh_charm'], []] });
    const wrongOwner = board({ graveyards: [[], [tagged('wh_charm', 1)]] });
    const expired = graveBoard();
    delete (expired.players[0].graveyard[0] as CardInstance).whispersUntilDawnOf;
    for (const state of [bare, wrongOwner, expired, graveBoard('bear')]) {
      expect(whispers(state)).toEqual([]);
      expect(validateAction(state, DB, 0, action)).not.toBeNull();
    }
  });

  it('treats graveIndex as authoritative and rejects a missing graveIndex or rider', () => {
    const state = board({ hands: [['forest'], []], graveyards: [['bear', tagged('wh_charm')], []] });
    const action: CastAction = { type: 'castSpell', handIndex: 999, graveIndex: 1, whispers: true };
    expect(validateAction(state, DB, 0, action)).toBeNull();
    const game = Game.restore(state, DB);
    game.submit(0, action);
    expect(game.instanceState.players[0].hand.map(cardIdOf)).toEqual(['forest']);
    expect(game.instanceState.players[0].graveyard.map(cardIdOf)).toEqual(['bear', 'wh_charm']);
    expect(validateAction(state, DB, 0, { type: 'castSpell', handIndex: 1, whispers: true })).not.toBeNull();
    expect(validateAction(state, DB, 0, { type: 'castSpell', handIndex: 1, graveIndex: 1 })).not.toBeNull();
  });

  it('uses only the Whispers cost for automatic and explicit mana payment', () => {
    const state = graveBoard('wh_paid');
    state.battlefield = board({ battlefield: [
      { iid: 10, cardId: 'island', controller: 0 }, { iid: 11, cardId: 'forest', controller: 0 },
    ] }).battlefield;
    expect(castCost(DB.wh_paid, false, false, false, { whispers: true })).toEqual({ generic: 1, pips: { U: 1 } });
    const action = whispers(state)[0];
    expect(action).toBeDefined();
    expect(validateAction(state, DB, 0, { ...action, manaPlan: [10] })).not.toBeNull();
    expect(validateAction(state, DB, 0, { ...action, manaPlan: [10, 999] })).not.toBeNull();
    expect(validateAction(state, DB, 0, { ...action, manaPlan: [10, 10] })).not.toBeNull();
    expect(validateAction(state, DB, 0, { ...action, manaPlan: [10, 11] })).toBeNull();
    for (const explicit of [false, true]) {
      const game = Game.restore(state, DB);
      const events = game.submit(0, { ...action, ...(explicit ? { manaPlan: [10, 11] } : {}) });
      expect(events).toContainEqual({ e: 'manaTapped', player: 0, iids: [10, 11] });
      expect(game.instanceState.players[0].life).toBe(21);
    }
    state.battlefield.pop();
    expect(whispers(state)).toEqual([]);
    expect(validateAction(state, DB, 0, action)).not.toBeNull();
  });

  it('rejects Empower, X and conflicting riders on a Whispers cast', () => {
    const state = graveBoard('wh_optional');
    const base: CastAction = { type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true, targets: [] };
    for (const patch of [
      { empowered: true }, { x: 1 }, { retell: true }, { hauntlinked: true }, { tithe: true },
    ] as Partial<CastAction>[]) {
      expect(validateAction(state, DB, 0, { ...base, ...patch })).not.toBeNull();
    }
    const db = { ...DB, wh_charm: { ...DB.wh_charm, x: { min: 1 } } };
    const x = graveBoard();
    expect(whispers(x, 0, db)).toEqual([]);
    expect(validateAction(x, db, 0, { ...base, x: 1 })).not.toBeNull();
  });

  it('refuses incompatible card definitions at enumeration and validation time', () => {
    for (const patch of [
      { retell: { cost: ZERO } }, { rite: { n: 1 } }, { hauntlink: { cost: ZERO, linked: { p: 1 } } },
    ] satisfies Partial<CardDef>[]) {
      const db: CardDb = { ...DB, wh_charm: { ...DB.wh_charm, ...patch } };
      const state = graveBoard();
      expect(whispers(state, 0, db)).toEqual([]);
      expect(validateAction(state, db, 0, { type: 'castSpell', handIndex: 0, graveIndex: 0, whispers: true })).not.toBeNull();
    }
  });

  it('offers the printed mandatory target lists and composes optional target qualifiers without Empower', () => {
    const state = graveBoard('wh_target');
    state.battlefield = board({ battlefield: [
      { iid: 20, cardId: 'bear', controller: 0, tapped: true, plusOneCounters: 1 },
      { iid: 30, cardId: 'bear', controller: 1, tapped: true, plusOneCounters: 1 },
      { iid: 40, cardId: 'hexproof_bear', controller: 1, tapped: true, plusOneCounters: 1 },
      { iid: 50, cardId: 'bear', controller: 0 },
    ] }).battlefield;
    expect(whispers(state).map((action) => action.targets)).toEqual([[permanent(20)], [permanent(30)], [permanent(50)]]);
    state.players[0].graveyard = [tagged('wh_optional')];
    const actions = whispers(state);
    expect(actions.map((action) => action.targets)).toEqual([[], [permanent(20)], [permanent(30)], [permanent(20), permanent(30)]]);
    expect(actions.every((action) => action.empowered === undefined)).toBe(true);
    for (const action of actions) expect(validateAction(state, DB, 0, action)).toBeNull();
    expect(validateAction(state, DB, 0, { ...actions[0], targets: [permanent(20), permanent(20)] })).not.toBeNull();
    expect(validateAction(state, DB, 0, { ...actions[0], targets: [permanent(40)] })).not.toBeNull();
  });

  it('keeps PlayerView graveyards as string IDs while the engine retains the marker', () => {
    const game = Game.restore(graveBoard(), DB);
    expect(game.viewFor(0).you.graveyard).toEqual(['wh_charm']);
    expect(game.viewFor(1).opp.graveyard).toEqual(['wh_charm']);
    expect(graveCard(game, 0, 'wh_charm').whispersUntilDawnOf).toBe(1);
    expect(whisperAction(game).whispers).toBe(true);
  });

  it('clones the fresh marker and physical identity without sharing its graveyard entry', () => {
    const game = Game.restore(graveBoard(), DB);
    const clone = game.clone();
    expect(graveCard(clone, 0, 'wh_charm')).toEqual(graveCard(game, 0, 'wh_charm'));
    expect(whisperAction(clone).whispers).toBe(true);
    delete graveCard(clone, 0, 'wh_charm').whispersUntilDawnOf;
    expect(graveCard(game, 0, 'wh_charm').whispersUntilDawnOf).toBe(1);
  });
});

describe('Whispers resolution, events and response gates', () => {
  it('announces whispered beside spellCast, carries the stack flag and resolves unsevered without a marker', () => {
    const state = graveBoard();
    state.players[1].hand = ['counter'];
    const game = Game.restore(state, DB);
    const events = game.submit(0, whisperAction(game));
    expect(game.instanceState.stack[0]).toMatchObject({ cardId: 'wh_charm', whispered: true });
    expect(game.instanceState.players[0].graveyard).toEqual([]);
    const castIndex = events.findIndex((event) => event.e === 'spellCast');
    const whisperIndex = events.findIndex((event) => event.e === 'whispered');
    expect(events[whisperIndex]).toEqual({ e: 'whispered', player: 0, cardId: 'wh_charm' });
    expect(Math.abs(castIndex - whisperIndex)).toBe(1);
    game.submit(1, { type: 'passResponse' });
    expect(graveCard(game, 0, 'wh_charm')).not.toHaveProperty('whispersUntilDawnOf');
    expect(game.instanceState.players[0].severed).toEqual([]);
    expect(whispers(game.instanceState)).toEqual([]);
  });

  it('returns a cancelled Whispers spell to the graveyard without a marker', () => {
    const state = graveBoard();
    state.players[1].hand = ['counter'];
    const game = Game.restore(state, DB);
    game.submit(0, whisperAction(game));
    const sid = game.instanceState.stack[0].sid;
    const events = game.submit(1, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'stackItem', sid }] });
    expect(events).toContainEqual({ e: 'spellCountered', sid });
    expect(graveCard(game, 0, 'wh_charm')).not.toHaveProperty('whispersUntilDawnOf');
    expect(game.instanceState.players[0].severed).toEqual([]);
  });

  it('returns a fizzled Whispers spell to the graveyard without a marker', () => {
    const state = graveBoard('wh_target');
    state.players[1].hand = ['destroy'];
    state.battlefield = board({ battlefield: [{ iid: 20, cardId: 'bear', controller: 1 }] }).battlefield;
    const game = Game.restore(state, DB);
    game.submit(0, whisperAction(game));
    const sid = game.instanceState.stack[0].sid;
    const events = game.submit(1, { type: 'castSpell', handIndex: 0, targets: [permanent(20)] });
    expect(events).toContainEqual({ e: 'targetsFizzled', sid });
    expect(graveCard(game, 0, 'wh_target')).not.toHaveProperty('whispersUntilDawnOf');
    expect(game.instanceState.players[0].severed).toEqual([]);
  });

  it('enters a whispered creature normally and never retags its later death', () => {
    const state = graveBoard('wh_creature');
    state.players[0].hand = ['destroy'];
    const game = Game.restore(state, DB);
    game.submit(0, whisperAction(game));
    const creature = game.instanceState.battlefield.find((perm) => perm.cardId === 'wh_creature')!;
    expect(creature).toMatchObject({ owner: 0, controller: 0, enteredThisTurn: true });
    expect(creature).not.toHaveProperty('whispersUntilDawnOf');
    game.submit(0, { type: 'castSpell', handIndex: 0, targets: [permanent(creature.iid)] });
    expect(graveCard(game, 0, 'wh_creature')).not.toHaveProperty('whispersUntilDawnOf');
    expect(whispers(game.instanceState)).toEqual([]);
  });

  it('fires graveyard triggers once on entry and never for departure to the stack', () => {
    const game = Game.restore(board({ hands: [['wh_trigger'], []] }), DB);
    const entry = game.submit(0, { type: 'skim', handIndex: 0 });
    expect(entry.filter((event) => event.e === 'graveyardTriggerFired')).toHaveLength(1);
    expect(game.instanceState.players[0].life).toBe(22);
    const cast = game.submit(0, whisperAction(game));
    expect(cast.filter((event) => event.e === 'graveyardTriggerFired')).toEqual([]);
    expect(game.instanceState.players[0].life).toBe(22);
  });

  it('fires a Charm\'s graveyard trigger exactly once again on its stack exit', () => {
    const game = Game.restore(board({ hands: [['wh_trigger_charm'], []] }), DB);
    const entry = game.submit(0, { type: 'skim', handIndex: 0 });
    const cast = game.submit(0, whisperAction(game));
    expect(entry.filter((event) => event.e === 'graveyardTriggerFired')).toHaveLength(1);
    expect(cast.filter((event) => event.e === 'graveyardTriggerFired')).toHaveLength(1);
    expect(game.instanceState.players[0].life).toBe(24);
    expect(graveCard(game, 0, 'wh_trigger_charm')).not.toHaveProperty('whispersUntilDawnOf');
  });

  it('retains Nine Lives after a whispered creature resolves', () => {
    const state = graveBoard('wh_nine');
    state.players[0].hand = ['destroy'];
    const game = Game.restore(state, DB);
    game.submit(0, whisperAction(game));
    const iid = game.instanceState.battlefield.find((perm) => perm.cardId === 'wh_nine')!.iid;
    const events = game.submit(0, { type: 'castSpell', handIndex: 0, targets: [permanent(iid)] });
    expect(events.some((event) => event.e === 'nineLivesReturned')).toBe(true);
    const returned = game.instanceState.battlefield.find((perm) => perm.cardId === 'wh_nine')!;
    expect(returned).toMatchObject({ plusOneCounters: 1, enteredThisTurn: true });
    expect(returned).not.toHaveProperty('whispersUntilDawnOf');
  });

  it('retains Preserve as an alternative to using the live Whispers cast', () => {
    const game = Game.restore(graveBoard('wh_preserve'), DB);
    expect(whisperAction(game).whispers).toBe(true);
    expect(game.legalActions(0)).toContainEqual({ type: 'preserveCard', graveIndex: 0 });
    game.submit(0, { type: 'preserveCard', graveIndex: 0 });
    expect(game.instanceState.players[0].severed.map(cardIdOf)).toEqual(['wh_preserve']);
    expect(game.instanceState.battlefield.find((perm) => perm.cardId === 'wh_preserve')).toMatchObject({ isToken: true });
    expect(whispers(game.instanceState)).toEqual([]);
  });

  it('counts only payable and targetable live Whispers Charms in both window gates', () => {
    const live = graveBoard();
    expect(hasCastableInstant(live, DB, 0)).toBe(true);
    expect(hasCastableCharm(live, DB, 0)).toBe(true);
    for (const state of [graveBoard('wh_creature'), graveBoard('wh_paid'), graveBoard('wh_target'), board({ graveyards: [['wh_charm'], []] })]) {
      expect(hasCastableInstant(state, DB, 0)).toBe(false);
      expect(hasCastableCharm(state, DB, 0)).toBe(false);
    }
  });

  it('does not open either gate for mandatory qualified any targets when no permanent qualifies', () => {
    const db: CardDb = {
      ...DB,
      wh_qualified: carrier('wh_qualified', ['charm'], {
        abilities: [{
          when: 'spell', targets: [{ what: 'any', marked: true, tapped: true }],
          ops: [{ op: 'damage', n: 1, to: 'target' }],
        }],
      }),
    };
    const state = graveBoard('wh_qualified');
    state.battlefield = board({ battlefield: [{ iid: 20, cardId: 'bear', controller: 0 }] }).battlefield;
    expect(whispers(state, 0, db)).toEqual([]);
    expect(hasCastableInstant(state, db, 0)).toBe(false);
    expect(hasCastableCharm(state, db, 0)).toBe(false);
  });

  it('opens a response window for an opponent whose only castable Charm is whispered', () => {
    const state = board({ hands: [['mill_self'], []], graveyards: [[], [tagged('wh_charm', 1)]] });
    const game = Game.restore(state, DB);
    const events = game.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(events).toContainEqual({ e: 'responseWindowOpened', player: 1 });
    expect(game.awaiting.kind).toBe('respond');
    expect(whisperAction(game, 1)).toMatchObject({ whispers: true, graveIndex: 0 });
  });

  it('reopens an end-step window when a resolved response mills a fresh Whispers Charm', () => {
    const state = board({ hands: [[], ['mill_self']] });
    state.step = 'main2';
    state.players[1].deck.push('wh_charm');
    const game = Game.restore(state, DB);
    game.submit(0, { type: 'passStep' });
    expect(game.awaiting).toEqual({ player: 1, kind: 'endStepWindow' });
    const events = game.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(events).toContainEqual({ e: 'responseWindowOpened', player: 1, reopened: true });
    expect(game.awaiting).toEqual({ player: 1, kind: 'endStepWindow' });
    expect(whisperAction(game, 1).whispers).toBe(true);
  });
});

function replayFixture() {
  const decks: [string[], string[]] = [Array<string>(24).fill('wh_replay'), Array<string>(24).fill('wh_replay')];
  const seed = 291807;
  const game = new Game({ db: DB, decks, seed });
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(DB), seed, decks,
    context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Whispers fixture', gauntletRung: null },
  });
  const events: GameEvent[] = [...game.initialEvents];
  for (let guard = 0; guard < 1000; guard++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      return { game, events, log: finishReplay(draft, game.instanceState.winner === 0 ? 'win' : 'loss', 0, game.instanceState.turn) };
    }
    const player = awaiting.player;
    const legal = game.legalActions(player);
    const action = legal.find((candidate) => candidate.type === 'passResponse') ??
      legal.find((candidate) => candidate.type === 'castSpell' && candidate.whispers) ??
      legal.find((candidate) => candidate.type === 'skim') ?? botAction(legal);
    events.push(...game.submit(player, action));
    recordReplayAction(draft, player, action);
  }
  throw new Error('Whispers replay fixture did not terminate');
}

describe('Whispers replay and determinism', () => {
  it('round-trips a naturally terminal v13 log through a whispered cast with byte-identical state and events', () => {
    const recorded = replayFixture();
    expect(recorded.log.v).toBe(14);
    expect(recorded.game.instanceState.winReason).toBe('life');
    const casts = recorded.log.actions.filter((step) => step.a.type === 'castSpell' && step.a.whispers);
    expect(casts.length).toBeGreaterThan(0);
    for (const cast of casts) expect(cast.a).toMatchObject({ whispers: true, graveIndex: expect.any(Number), handIndex: expect.any(Number) });
    expect(JSON.stringify(recorded.log)).not.toContain('whispersUntilDawnOf');
    const revived = JSON.parse(JSON.stringify(recorded.log));
    expect(isReplayLog(revived)).toBe(true);
    expect(canReplay(revived, DB)).toBe(true);
    const replayed = replayGame(revived, DB);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(recorded.game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(recorded.events));
  });

  it('pins identical actions, events and terminal state for two seeded Whispers runs', () => {
    const first = replayFixture();
    const second = replayFixture();
    expect(JSON.stringify(second.log.actions)).toBe(JSON.stringify(first.log.actions));
    expect(JSON.stringify(second.events)).toBe(JSON.stringify(first.events));
    expect(JSON.stringify(second.game.instanceState)).toBe(JSON.stringify(first.game.instanceState));
  });
});
