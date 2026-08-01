import { describe, expect, it } from 'vitest';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { recallPermanent, severPermanent } from '../../src/engine/battlefield';
import { Game } from '../../src/engine/Game';
import type { GameEvent } from '../../src/engine/events';
import type { CardDb } from '../../src/engine/types';
import { cardIdOf } from '../../src/engine/types';
import { validateAction } from '../../src/engine/actions';
import { CARD_DB } from '../../src/data/catalog';
import { makeTestState, TEST_DB } from '../helpers';

const DEATH_TEST_DB: CardDb = {
  ...TEST_DB,
  forest: {
    ...TEST_DB.forest,
    abilities: [{ when: 'dies', ops: [{ op: 'gainLife', n: 3 }] }],
  },
  living_forest: {
    id: 'living_forest',
    name: 'Living Forest',
    types: ['land', 'creature'],
    subtypes: [],
    supertypes: ['basic'],
    colors: [],
    manaAbility: ['G'],
    attack: 1,
    defense: 1,
    abilities: [{ when: 'dies', ops: [{ op: 'gainLife', n: 5 }] }],
    rarity: 'c',
  },
};

const SPELL_DECK = Array.from({ length: 50 }, () => 'bear');
const RESERVE = ['forest', 'plains', 'mountain', 'island', 'swamp', 'dual_gw', 'forest', 'plains', 'forest', 'swamp'];

function reserveGame(db: CardDb = TEST_DB): Game {
  return new Game({
    decks: [SPELL_DECK, SPELL_DECK],
    seed: 8128,
    db,
    format: 'warchest',
    landReserves: [RESERVE, RESERVE],
  });
}

function keepBoth(game: Game): void {
  while (game.awaiting.kind !== 'main') {
    const awaiting = game.awaiting;
    if (!('player' in awaiting)) return;
    const player = awaiting.player;
    game.submit(player, { type: 'keepHand' });
  }
}

function opEvents(state: ReturnType<typeof makeTestState>, db: CardDb, ops: Parameters<typeof runOps>[4]): GameEvent[] {
  const events: GameEvent[] = [];
  runOps(state, db, (event) => events.push(event), { controller: 0, sourceCardId: 'bear', targets: [{ kind: 'permanent', iid: 1 }] }, ops);
  return events;
}

describe('Warchest reserve engine', () => {
  it('constructs ordered instance-carrying reserves and enumerates ten choices', () => {
    const game = reserveGame();
    keepBoth(game);
    const player = game.instanceState.activePlayer;
    const choices = game.legalActions(player).filter((action) => action.type === 'playLand');

    expect(choices).toHaveLength(10);
    expect(choices[0]).toMatchObject({ type: 'playLand', handIndex: -1, reserveIndex: 0 });
    expect(game.state.players[player].landReserve).toEqual(RESERVE);
    expect(game.instanceState.players[player].landReserve?.every((card) => typeof card !== 'string')).toBe(true);
    expect(game.instanceState.players[player].landReserve?.map(cardIdOf)).toEqual(RESERVE);
    expect(game.viewFor(player).you.landReserve).toEqual(RESERVE);
    expect(game.viewFor(player).opp.landReserve).toEqual(RESERVE);
    expect(game.state.players[player].hand.every((card) => !['forest', 'plains', 'mountain', 'island', 'swamp', 'dual_gw'].includes(card))).toBe(true);
  });

  it('rejects reserve decks containing lands and malformed reserve payloads', () => {
    expect(() => new Game({
      decks: [[...SPELL_DECK.slice(0, 49), 'forest'], SPELL_DECK],
      seed: 1,
      db: TEST_DB,
      format: 'warchest',
      landReserves: [RESERVE, RESERVE],
    })).toThrow('deck contains land forest');
    expect(() => new Game({
      decks: [SPELL_DECK, SPELL_DECK],
      seed: 1,
      db: TEST_DB,
      format: 'warchest',
      landReserves: [RESERVE.slice(0, 9), RESERVE],
    })).toThrow('exactly 10 lands');
    expect(() => new Game({
      decks: [SPELL_DECK, SPELL_DECK],
      seed: 1,
      db: TEST_DB,
      format: 'warchest',
      landReserves: [[...RESERVE.slice(0, 4), 'dual_gw', 'dual_gw', 'dual_gw', 'dual_gw', 'dual_gw', 'dual_gw'], RESERVE],
    })).toThrow('at most 5 dual lands');
    expect(() => new Game({
      decks: [Array.from({ length: 50 }, () => 'cf-cold-iron-nail'), Array.from({ length: 50 }, () => 'cf-cold-iron-nail')],
      seed: 1,
      db: CARD_DB,
      format: 'warchest',
      landReserves: [
        [...Array.from({ length: 9 }, () => 'land-forest'), 'cf-mist-road'],
        Array.from({ length: 10 }, () => 'land-forest'),
      ],
    })).toThrow('unsupported land cf-mist-road');
    expect(() => new Game({
      decks: [SPELL_DECK, SPELL_DECK],
      seed: 1,
      db: TEST_DB,
      format: 'warchest',
      landReserves: [[...RESERVE.slice(0, 9), 'unknown-land'], RESERVE],
    })).toThrow('unknown land id unknown-land');
  });

  it('rejects restored reserve states with smuggled lands and malformed caps', () => {
    const game = reserveGame();
    for (const zone of ['deck', 'hand'] as const) {
      const state = structuredClone(game.instanceState);
      state.players[0][zone].push('forest');
      expect(() => Game.restore(state, TEST_DB)).toThrow('outside the reserve');
    }

    const tooManyDuals = structuredClone(game.instanceState);
    tooManyDuals.players[0].landReserve = [
      ...Array.from({ length: 6 }, () => 'dual_gw'),
      ...Array.from({ length: 4 }, () => 'forest'),
    ];
    expect(() => Game.restore(tooManyDuals, TEST_DB)).toThrow('at most 5 dual lands');

    const tooManyLands = structuredClone(game.instanceState);
    tooManyLands.players[0].landReserve!.push('forest');
    expect(() => Game.restore(tooManyLands, TEST_DB)).toThrow('at most 10 lands');

    keepBoth(game);
    const player = game.instanceState.activePlayer;
    game.submit(player, game.legalActions(player).find((action) => action.type === 'playLand')!);
    expect(() => game.clone()).not.toThrow();
  });

  it('pins every reserve playLand validation branch', () => {
    const reserve = makeTestState({});
    reserve.players[0].landReserve = ['forest'];
    expect(validateAction(reserve, TEST_DB, 0, { type: 'playLand', handIndex: 0, reserveIndex: 0 }))
      .toBe('reserve land actions need handIndex -1');
    expect(validateAction(reserve, TEST_DB, 0, { type: 'playLand', handIndex: -1, reserveIndex: 1 }))
      .toBe('bad reserve index');

    reserve.players[0].landReserve = ['bear'];
    expect(validateAction(reserve, TEST_DB, 0, { type: 'playLand', handIndex: -1, reserveIndex: 0 }))
      .toBe('reserve card is not a land');

    const classic = makeTestState({});
    expect(validateAction(classic, TEST_DB, 0, { type: 'playLand', handIndex: -1, reserveIndex: 0 }))
      .toBe('Classic games do not have a Warchest.');
  });

  it('uses data-driven entry states and enforces the empty-reserve cap', () => {
    const game = reserveGame();
    keepBoth(game);
    const player = game.instanceState.activePlayer;
    const first = game.legalActions(player).find((action) => action.type === 'playLand' && action.reserveIndex === 0)!;
    game.submit(player, first);
    expect(game.instanceState.battlefield.at(-1)?.tapped).toBe(false);

    game.state.players[player].landPlayedThisTurn = false;
    const second = game.legalActions(player).find((action) => action.type === 'playLand' && action.reserveIndex === 0)!;
    game.submit(player, second);
    expect(game.instanceState.battlefield.at(-1)?.cardId).toBe('plains');
    expect(game.instanceState.battlefield.at(-1)?.tapped).toBe(false);

    const capGame = reserveGame();
    keepBoth(capGame);
    const capPlayer = capGame.instanceState.activePlayer;
    for (let i = 0; i < 10; i++) {
      const action = capGame.legalActions(capPlayer).find((candidate) => candidate.type === 'playLand')!;
      capGame.submit(capPlayer, action);
      capGame.state.players[capPlayer].landPlayedThisTurn = false;
    }
    expect(capGame.state.players[capPlayer].landReserve).toEqual([]);
    expect(capGame.legalActions(capPlayer).some((action) => action.type === 'playLand')).toBe(false);
  });

  it('returns destroyed basics without death accounting, while duals die normally', () => {
    const basic = makeTestState({ battlefield: [{ iid: 1, cardId: 'forest', controller: 0 }] });
    basic.players[0].landReserve = ['plains'];
    const basicEvents = opEvents(basic, DEATH_TEST_DB, [{ op: 'destroy', to: 'target' }]);
    expect(basic.players[0].landReserve).toEqual(['plains', 'forest']);
    expect(basic.players[0].graveyard).toEqual([]);
    expect(basicEvents.filter((event) => event.e === 'died')).toHaveLength(0);
    expect(basicEvents.filter((event) => event.e === 'triggerFired')).toHaveLength(0);
    expect(basic.players[0].life).toBe(20);

    const dual = makeTestState({ battlefield: [{ iid: 1, cardId: 'dual_gw', controller: 0 }] });
    dual.players[0].landReserve = ['forest'];
    const dualEvents = opEvents(dual, TEST_DB, [{ op: 'destroy', to: 'target' }]);
    expect(dual.players[0].landReserve).toEqual(['forest']);
    expect(dual.players[0].graveyard).toEqual(['dual_gw']);
    expect(dualEvents.filter((event) => event.e === 'died')).toHaveLength(1);
  });

  it('keeps sever one-way and routes recall of both land classes to reserve', () => {
    const severed = makeTestState({ battlefield: [{ iid: 1, cardId: 'forest', controller: 0 }] });
    severed.players[0].landReserve = [];
    const severEvents: GameEvent[] = [];
    severPermanent(severed, TEST_DB, severed.battlefield[0], (event) => severEvents.push(event));
    expect(severed.players[0].severed).toEqual(['forest']);
    expect(severed.players[0].landReserve).toEqual([]);
    expect(severEvents.some((event) => event.e === 'died')).toBe(false);

    for (const cardId of ['forest', 'dual_gw']) {
      const state = makeTestState({ battlefield: [{ iid: 1, cardId, controller: 0 }] });
      state.players[0].landReserve = [];
      const events: GameEvent[] = [];
      recallPermanent(state, TEST_DB, state.battlefield[0], (event) => events.push(event));
      expect(state.players[0].landReserve).toEqual([cardId]);
      expect(state.players[0].hand).toEqual([]);
      expect(state.players[0].graveyard).toEqual([]);
      expect(events.some((event) => event.e === 'cardsBottomed')).toBe(true);
      expect(events.filter((event) => event.e === 'died')).toHaveLength(cardId === 'forest' ? 0 : 1);
    }

    const classic = makeTestState({ battlefield: [{ iid: 1, cardId: 'forest', controller: 0 }] });
    const classicEvents: GameEvent[] = [];
    recallPermanent(classic, TEST_DB, classic.battlefield[0], (event) => classicEvents.push(event));
    expect(classic.players[0].hand).toEqual(['forest']);
    expect(classicEvents.filter((event) => event.e === 'died')).toHaveLength(1);
  });

  it('handles a mixed mass-destroy batch without counting a returning basic as a death', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'living_forest', controller: 0 },
        { iid: 2, cardId: 'bear', controller: 0 },
      ],
    });
    state.players[0].landReserve = [];
    const events = opEvents(state, DEATH_TEST_DB, [{ op: 'massDestroy', filter: 'allCreatures' }]);
    expect(state.players[0].landReserve).toEqual(['living_forest']);
    expect(state.players[0].graveyard).toEqual(['bear']);
    expect(events.filter((event) => event.e === 'died')).toHaveLength(1);
    expect(events.filter((event) => event.e === 'triggerFired')).toHaveLength(0);
    expect(state.players[0].life).toBe(20);
  });

  it('keeps classic states free of a reserve zone and on the original path', () => {
    const classic = new Game({ decks: [SPELL_DECK, SPELL_DECK], seed: 8128, db: TEST_DB });
    keepBoth(classic);
    expect('landReserve' in classic.instanceState.players[0]).toBe(false);
    expect('landReserve' in classic.viewFor(0).you).toBe(false);
    expect(classic.legalActions(classic.instanceState.activePlayer).some((action) => action.type === 'playLand')).toBe(false);
  });
});
