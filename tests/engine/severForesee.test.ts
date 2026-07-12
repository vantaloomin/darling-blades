import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { ScriptAI } from '../../src/ai/ScriptAI';
import type { GameEvent } from '../../src/engine/events';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { Game } from '../../src/engine/Game';
import { checkStateBased } from '../../src/engine/sba';
import type { CardDb } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const DB: CardDb = {
  ...TEST_DB,
  dies_bear: {
    ...TEST_DB.bear,
    id: 'dies_bear',
    name: 'Dies Bear',
    abilities: [{ when: 'dies', ops: [{ op: 'gainLife', n: 4 }] }],
  },
  test_aura: {
    id: 'test_aura',
    name: 'Test Aura',
    types: ['enchantment'],
    subtypes: ['Aura'],
    cost: { generic: 0, pips: {} },
    colors: [],
    rarity: 'c',
    abilities: [{ when: 'static', static: { scope: 'attached', p: 1, t: 1 } }],
  },
  foresee3: {
    id: 'foresee3',
    name: 'Foresee Three',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    rarity: 'c',
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 3 }] }],
  },
  foresee10: {
    id: 'foresee10',
    name: 'Foresee Ten',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    rarity: 'c',
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 10 }] }],
  },
  foresee0: {
    id: 'foresee0',
    name: 'Foresee Zero',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    rarity: 'c',
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 0 }] }],
  },
  banish: {
    id: 'banish',
    name: 'Banish',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    rarity: 'c',
    abilities: [
      { when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'sever', to: 'target' }] },
    ],
  },
  arrives_foresee: {
    ...TEST_DB.bear,
    id: 'arrives_foresee',
    name: 'Arrives Foresee',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
  },
  attacks_foresee: {
    ...TEST_DB.bear,
    id: 'attacks_foresee',
    name: 'Attacks Foresee',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'attacks', ops: [{ op: 'foresee', n: 1 }] }],
  },
  combat_foresee: {
    ...TEST_DB.bear,
    id: 'combat_foresee',
    name: 'Combat Foresee',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'combatDamageToPlayer', ops: [{ op: 'foresee', n: 1 }] }],
  },
  dawn_foresee: {
    ...TEST_DB.bear,
    id: 'dawn_foresee',
    name: 'Dawn Foresee',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }],
  },
  dies_foresee: {
    ...TEST_DB.bear,
    id: 'dies_foresee',
    name: 'Dies Foresee',
    cost: { generic: 0, pips: {} },
    abilities: [{ when: 'dies', ops: [{ op: 'foresee', n: 1 }] }],
  },
  destroyer: {
    id: 'destroyer',
    name: 'Destroyer',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: {} },
    colors: [],
    rarity: 'c',
    abilities: [
      { when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'destroy', to: 'target' }] },
    ],
  },
};

const ctx = { controller: 0 as const, sourceCardId: 'test', targets: [] };

function foreseeGame(cardId: 'foresee0' | 'foresee3' | 'foresee10', deck: string[]): Game {
  const state = makeTestState({ hands: [[cardId], []], active: 0 });
  state.players[0].deck = [...deck];
  return Game.restore(state, DB);
}

function beginForesee(cardId: 'foresee0' | 'foresee3' | 'foresee10', deck: string[]): Game {
  const game = foreseeGame(cardId, deck);
  game.submit(0, { type: 'castSpell', handIndex: 0 });
  return game;
}

describe('sever zone', () => {
  it('severs a creature without dies triggers and lets SBAs clean up its attachments', () => {
    const state = makeTestState({
      active: 0,
      battlefield: [
        { iid: 1, cardId: 'dies_bear', controller: 0, attachments: [2] },
        { iid: 2, cardId: 'test_aura', controller: 0, attachedTo: 1 },
      ],
    });
    const events: GameEvent[] = [];

    runOps(
      state,
      DB,
      (event) => events.push(event),
      { ...ctx, targets: [{ kind: 'permanent', iid: 1 }] },
      [{ op: 'sever', to: 'target' }],
    );
    checkStateBased(state, DB, (event) => events.push(event));

    expect(state.battlefield).toHaveLength(0);
    expect(state.players[0].severed).toEqual(['dies_bear']);
    expect(state.players[0].graveyard).toEqual(['test_aura']);
    expect(state.players[0].life).toBe(20); // the target's dies ability never fired
    expect(events.some((event) => event.e === 'triggerFired' && event.iid === 1)).toBe(false);
    expect(events).toContainEqual({
      e: 'severed',
      player: 0,
      cardId: 'dies_bear',
      from: 'battlefield',
      iid: 1,
    });
  });

  it('leaves severed cards unreachable by raise and reclaim', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].severed = ['bear'];

    runOps(state, DB, () => {}, ctx, [{ op: 'raise', to: 'top' }]);
    runOps(
      state,
      DB,
      () => {},
      { ...ctx, targets: [{ kind: 'grave', player: 0, index: 0 }] },
      [{ op: 'reclaim' }],
    );

    expect(state.battlefield).toEqual([]);
    expect(state.players[0].hand).toEqual([]);
    expect(state.players[0].severed).toEqual(['bear']);
  });

  it('severs graveyard and deck cards top-first, clamps, and emits zone moves', () => {
    const state = makeTestState({ active: 0 });
    state.players[1].graveyard = ['bear', 'elf', 'giant']; // giant is most recent
    state.players[0].deck = ['bear', 'elf', 'giant']; // giant is the deck top
    const events: GameEvent[] = [];

    runOps(
      state,
      DB,
      (event) => events.push(event),
      ctx,
      [
        { op: 'severGrave', n: 10, who: 'opponent' },
        { op: 'severTop', n: 10, who: 'self' },
      ],
    );

    expect(state.players[1].graveyard).toEqual([]);
    expect(state.players[1].severed).toEqual(['giant', 'elf', 'bear']);
    expect(state.players[0].deck).toEqual([]);
    expect(state.players[0].severed).toEqual(['giant', 'elf', 'bear']);
    expect(events.filter((event) => event.e === 'severed')).toEqual([
      { e: 'severed', player: 1, cardId: 'giant', from: 'graveyard' },
      { e: 'severed', player: 1, cardId: 'elf', from: 'graveyard' },
      { e: 'severed', player: 1, cardId: 'bear', from: 'graveyard' },
      { e: 'severed', player: 0, cardId: 'giant', from: 'deck' },
      { e: 'severed', player: 0, cardId: 'elf', from: 'deck' },
      { e: 'severed', player: 0, cardId: 'bear', from: 'deck' },
    ]);
  });

  it('exposes both players’ sever zones in every PlayerView', () => {
    const state = makeTestState({ active: 0 });
    state.players[0].severed = ['bear'];
    state.players[1].severed = ['giant'];
    const game = Game.restore(state, DB);

    expect(game.viewFor(0).you.severed).toEqual(['bear']);
    expect(game.viewFor(0).opp.severed).toEqual(['giant']);
    expect(game.viewFor(1).you.severed).toEqual(['giant']);
    expect(game.viewFor(1).opp.severed).toEqual(['bear']);
  });
});

describe('foresee', () => {
  it.each([
    [[], ['a', 'b', 'c', 'd']],
    [[0], ['d', 'a', 'b', 'c']],
    [[1], ['c', 'a', 'b', 'd']],
    [[0, 2], ['b', 'd', 'a', 'c']],
  ])('keeps exact deck order when bottoming %j', (bottomIndices, expectedDeck) => {
    const game = beginForesee('foresee3', ['a', 'b', 'c', 'd']);
    expect(game.awaiting).toEqual({ player: 0, kind: 'foresee', cards: ['d', 'c', 'b'] });

    game.submit(0, { type: 'foresee', bottomIndices });

    expect(game.state.players[0].deck).toEqual(expectedDeck);
    expect(game.awaiting.kind).toBe('main');
  });

  it('clamps to deck size, and foresee zero or an empty deck opens no decision', () => {
    const largerThanDeck = beginForesee('foresee10', ['a', 'b']);
    expect(largerThanDeck.awaiting).toEqual({ player: 0, kind: 'foresee', cards: ['b', 'a'] });
    largerThanDeck.submit(0, { type: 'foresee', bottomIndices: [0] });
    expect(largerThanDeck.state.players[0].deck).toEqual(['b', 'a']);

    expect(beginForesee('foresee0', ['a']).awaiting.kind).toBe('main');
    expect(beginForesee('foresee3', []).awaiting.kind).toBe('main');
  });

  it('shows the foreseeing player card ids but redacts them from the opponent', () => {
    const game = beginForesee('foresee3', ['secret_bottom', 'secret_middle', 'secret_top']);
    expect(game.viewFor(0).awaiting).toEqual({
      player: 0,
      kind: 'foresee',
      cards: ['secret_top', 'secret_middle', 'secret_bottom'],
    });
    expect(game.viewFor(1).awaiting).toEqual({ player: 0, kind: 'foresee', cards: [] });
  });

  it('rejects duplicate and out-of-range foresee indices before mutating state', () => {
    const game = beginForesee('foresee3', ['a', 'b', 'c']);
    const before = JSON.stringify(game.state);

    expect(() => game.submit(0, { type: 'foresee', bottomIndices: [0, 0] })).toThrow();
    expect(() => game.submit(0, { type: 'foresee', bottomIndices: [3] })).toThrow();
    expect(JSON.stringify(game.state)).toBe(before);
  });

  it('is decision-safe from every non-static trigger context', () => {
    const arrives = makeTestState({ hands: [['arrives_foresee'], []], active: 0 });
    arrives.players[0].deck = ['bear'];
    const arrivesGame = Game.restore(arrives, DB);
    arrivesGame.submit(0, { type: 'castSpell', handIndex: 0 });
    expect(arrivesGame.awaiting).toMatchObject({ player: 0, kind: 'foresee' });

    const attacks = makeTestState({
      active: 0,
      battlefield: [{ iid: 1, cardId: 'attacks_foresee', controller: 0 }],
    });
    attacks.players[0].deck = ['bear'];
    const attacksGame = Game.restore(attacks, DB);
    attacksGame.submit(0, { type: 'passStep' });
    attacksGame.submit(0, { type: 'declareAttackers', attackers: [1] });
    expect(attacksGame.awaiting).toMatchObject({ player: 0, kind: 'foresee' });
    attacksGame.submit(0, { type: 'foresee', bottomIndices: [] });
    expect(attacksGame.awaiting.kind).toBe('declareBlockers');

    const combat = makeTestState({
      active: 0,
      battlefield: [{ iid: 1, cardId: 'combat_foresee', controller: 0 }],
    });
    combat.players[0].deck = ['bear'];
    const combatGame = Game.restore(combat, DB);
    combatGame.submit(0, { type: 'passStep' });
    combatGame.submit(0, { type: 'declareAttackers', attackers: [1] });
    combatGame.submit(1, { type: 'declareBlockers', blocks: [] });
    expect(combatGame.awaiting).toMatchObject({ player: 0, kind: 'foresee' });

    const dawn = makeTestState({
      active: 1,
      battlefield: [{ iid: 1, cardId: 'dawn_foresee', controller: 0 }],
    });
    dawn.step = 'main2';
    dawn.awaiting = { player: 1, kind: 'main' };
    dawn.players[0].deck = ['bear'];
    const dawnGame = Game.restore(dawn, DB);
    dawnGame.submit(1, { type: 'passStep' });
    expect(dawnGame.awaiting).toMatchObject({ player: 0, kind: 'foresee' });

    const dies = makeTestState({
      hands: [['destroyer'], []],
      active: 0,
      battlefield: [{ iid: 1, cardId: 'dies_foresee', controller: 1 }],
    });
    dies.players[1].deck = ['bear'];
    const diesGame = Game.restore(dies, DB);
    diesGame.submit(0, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'permanent', iid: 1 }],
    });
    expect(diesGame.awaiting).toMatchObject({ player: 1, kind: 'foresee' });
  });
});

function aiForeseeGame(): Game {
  const state = makeTestState({ active: 0 });
  state.players[0].deck = ['forest', 'giant', 'bear'];
  state.pendingDecisions = [{ kind: 'foresee', player: 0, n: 3 }];
  state.awaiting = { player: 0, kind: 'foresee', cards: ['bear', 'giant', 'forest'] };
  return Game.restore(state, DB);
}

function aiDeck(): string[] {
  return [
    ...Array.from({ length: 8 }, () => 'forest'),
    ...Array.from({ length: 6 }, () => 'bear'),
    ...Array.from({ length: 5 }, () => 'foresee3'),
    ...Array.from({ length: 5 }, () => 'banish'),
  ];
}

function runAiGame(seed: number): { events: GameEvent[]; state: string } {
  const game = new Game({ decks: [aiDeck(), aiDeck()], seed, db: DB });
  const ais: [AIPlayer, AIPlayer] = [new MediumAI(DB), new MediumAI(DB)];
  const events = [...game.initialEvents];
  for (let guard = 0; guard < 20_000; guard++) {
    if (game.awaiting.kind === 'gameOver') return { events, state: JSON.stringify(game.state) };
    const player = game.awaiting.player;
    const action = ais[player].chooseAction(game.viewFor(player), game.legalActions(player));
    events.push(...game.submit(player, action));
  }
  throw new Error('AI game did not terminate');
}

describe('AI foresee decisions', () => {
  it('gives every brain a deterministic, legal foresee response', () => {
    const brains: AIPlayer[] = [
      new EasyAI(DB, 71),
      new MediumAI(DB),
      new HardAI(DB),
      new ScriptAI(DB),
    ];

    for (const brain of brains) {
      const game = aiForeseeGame();
      const action = brain.chooseAction(game.viewFor(0), game.legalActions(0));
      expect(action.type).toBe('foresee');
      expect(() => game.submit(0, action)).not.toThrow();
    }
  });

  it('plays a foresee-and-sever AI game to completion with byte-identical repeats', () => {
    const a = runAiGame(8128);
    const b = runAiGame(8128);

    expect(a.events.some((event) => event.e === 'effectApplied' && event.op === 'foresee')).toBe(true);
    expect(a.events.some((event) => event.e === 'severed')).toBe(true);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.state).toBe(b.state);
  });
});
