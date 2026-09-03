import { describe, expect, it } from 'vitest';
import {
  DARLING_PAYDOWN_COST,
  DARLING_PAYDOWN_REDUCTION,
  DARLING_TAX_STEP,
} from '../../src/config/rules';
import { runOps } from '../../src/engine/effects/EffectInterpreter';
import { Game } from '../../src/engine/Game';
import type { GameEvent } from '../../src/engine/events';
import type { CardDb, GameState, Permanent, PlayerId } from '../../src/engine/types';
import { opponentOf } from '../../src/engine/types';
import { runBotGame, TEST_DB } from '../helpers';

const DARLING_DECK = Array.from({ length: 79 }, () => 'bear');
const RESERVE_DECK = Array.from({ length: 50 }, () => 'bear');
const RESERVE = ['forest', 'plains', 'mountain', 'island', 'swamp', 'dual_gw', 'forest', 'plains', 'forest', 'swamp'];
const DARLING_RESERVE = Array.from({ length: 10 }, () => 'mountain');

const DARLING_DB: CardDb = {
  ...TEST_DB,
  darling: {
    ...TEST_DB.lubu,
    id: 'darling',
    name: 'Taxed Darling',
    abilities: [{ when: 'dies', ops: [{ op: 'gainLife', n: 3 }] }],
  },
};

function keepToMain(game: Game): PlayerId {
  while (game.awaiting.kind !== 'main') {
    const awaiting = game.awaiting;
    if (!('player' in awaiting)) throw new Error(`unexpected setup state ${awaiting.kind}`);
    game.submit(awaiting.player, { type: 'keepHand' });
  }
  return game.awaiting.player;
}

function addMountains(state: GameState, player: PlayerId, count: number): void {
  for (let i = 0; i < count; i++) {
    const iid = state.nextIid++;
    const perm: Permanent = {
      iid,
      cardId: 'mountain',
      owner: player,
      controller: player,
      tapped: false,
      enteredThisTurn: false,
    damage: 0,
    deathtouched: false,
    severBranded: false,
      attachments: [],
      plusOneCounters: 0,
      untilEotMods: [],
    };
    state.battlefield.push(perm);
  }
}

function destroyDarling(state: GameState, player: PlayerId): GameEvent[] {
  const permanent = state.battlefield.find((perm) => perm.owner === player && perm.cardId === 'darling');
  if (!permanent) throw new Error('Darling is not on the battlefield');
  const events: GameEvent[] = [];
  runOps(
    state,
    DARLING_DB,
    (event) => events.push(event),
    {
      controller: opponentOf(player),
      sourceCardId: 'murder',
      targets: [{ kind: 'permanent', iid: permanent.iid }],
    },
    [{ op: 'destroy', to: 'target' }],
  );
  return events;
}

function manaTappedCount(events: GameEvent[], player: PlayerId): number {
  const event = events.find(
    (candidate): candidate is Extract<GameEvent, { e: 'manaTapped' }> =>
      candidate.e === 'manaTapped' && candidate.player === player,
  );
  return event?.iids.length ?? 0;
}

describe('Darlings command zone engine', () => {
  it('starts each configured Darling in the public zone, outside the 79-card deck', () => {
    const game = new Game({
      decks: [DARLING_DECK, DARLING_DECK],
      darlings: ['darling', null],
      landReserves: [DARLING_RESERVE, DARLING_RESERVE],
      format: 'darlings',
      seed: 801,
      db: DARLING_DB,
    });

    expect(game.state.players[0].darlingZone).toBe('darling');
    expect(game.state.players[1].darlingZone).toBeNull();
    expect(game.state.players[0].darlingTax).toBe(0);
    expect(game.state.players[0].deck).not.toContain('darling');
    expect(game.state.players[0].landReserve).toEqual(DARLING_RESERVE);
    expect(game.viewFor(1).opp.darlingZone).toBe('darling');
    expect(game.viewFor(1).opp.darlingTax).toBe(0);
    expect(game.viewFor(1).opp.landReserve).toEqual(DARLING_RESERVE);
  });

  it('coexists with Warchest land plays, then taxes recasts and pays down after a Darling death', () => {
    const game = new Game({
      decks: [DARLING_DECK, DARLING_DECK],
      darlings: ['darling', 'darling'],
      landReserves: [DARLING_RESERVE, DARLING_RESERVE],
      format: 'darlings',
      seed: 802,
      db: DARLING_DB,
    });
    const player = keepToMain(game);
    const reservePlay = game.legalActions(player).find((action) => action.type === 'playLand');
    expect(reservePlay).toEqual({ type: 'playLand', handIndex: -1, reserveIndex: 0 });
    game.submit(player, reservePlay!);
    expect(game.instanceState.players[player].landReserve).toHaveLength(9);
    expect(game.instanceState.battlefield).toContainEqual(expect.objectContaining({
      cardId: 'mountain', controller: player, tapped: false,
    }));

    const prepared = structuredClone(game.instanceState);
    addMountains(prepared, player, 7);
    let scripted = Game.restore(prepared, DARLING_DB);
    expect(scripted.viewFor(player).you.darlingCastable).toBe(true);
    expect(scripted.viewFor(player).opp.darlingCastable).toBe(false);

    const firstCast = scripted.legalActions(player).find((action) => action.type === 'castDarling');
    expect(firstCast).toBeDefined();
    const firstEvents = scripted.submit(player, firstCast!);
    expect(firstEvents.find((event) => event.e === 'manaTapped')).toMatchObject({ player, iids: expect.any(Array) });
    expect(manaTappedCount(firstEvents, player)).toBe(4);

    const afterFirstDeath = structuredClone(scripted.instanceState);
    const deathEvents = destroyDarling(afterFirstDeath, player);
    expect(deathEvents.some((event) => event.e === 'died' && event.cardId === 'darling')).toBe(true);
    expect(afterFirstDeath.players[player].life).toBe(23);
    expect(afterFirstDeath.players[player].darlingTax).toBe(DARLING_TAX_STEP);
    expect(afterFirstDeath.players[player].darlingZone).not.toBeNull();
    for (const permanent of afterFirstDeath.battlefield) {
      if (permanent.controller === player) permanent.tapped = false;
    }

    scripted = Game.restore(afterFirstDeath, DARLING_DB);
    const taxedRecast = scripted.legalActions(player).find((action) => action.type === 'castDarling');
    expect(taxedRecast).toBeDefined();
    const taxedEvents = scripted.submit(player, taxedRecast!);
    expect(manaTappedCount(taxedEvents, player)).toBe(6);

    const afterSecondDeath = structuredClone(scripted.instanceState);
    destroyDarling(afterSecondDeath, player);
    for (const permanent of afterSecondDeath.battlefield) {
      if (permanent.controller === player) permanent.tapped = false;
    }
    scripted = Game.restore(afterSecondDeath, DARLING_DB);
    expect(scripted.instanceState.players[player].darlingTax).toBe(DARLING_TAX_STEP * 2);

    const firstPaydown = scripted.legalActions(player).find((action) => action.type === 'payDownDarlingTax');
    expect(firstPaydown).toBeDefined();
    const firstPaydownEvents = scripted.submit(player, firstPaydown!);
    expect(manaTappedCount(firstPaydownEvents, player)).toBe(DARLING_PAYDOWN_COST);
    expect(scripted.instanceState.players[player].darlingTax).toBe(DARLING_TAX_STEP * 2 - DARLING_PAYDOWN_REDUCTION);

    const secondPaydown = scripted.legalActions(player).find((action) => action.type === 'payDownDarlingTax');
    expect(secondPaydown).toBeDefined();
    const secondPaydownEvents = scripted.submit(player, secondPaydown!);
    expect(manaTappedCount(secondPaydownEvents, player)).toBe(DARLING_PAYDOWN_COST);
    expect(scripted.instanceState.players[player].darlingTax).toBe(0);
    expect(scripted.legalActions(player).some((action) => action.type === 'payDownDarlingTax')).toBe(false);

    const completion = structuredClone(scripted.instanceState);
    completion.players[player].deck = [];
    const completed = Game.restore(completion, DARLING_DB);
    runBotGame(completed);
    expect(completed.instanceState.winner).not.toBeNull();
  });

  it('routes a Darling sever from play to the zone with one tax step', () => {
    const game = new Game({
      decks: [DARLING_DECK, DARLING_DECK],
      darlings: ['darling', 'darling'],
      landReserves: [DARLING_RESERVE, DARLING_RESERVE],
      format: 'darlings',
      seed: 803,
      db: DARLING_DB,
    });
    const player = keepToMain(game);
    const state = structuredClone(game.instanceState);
    addMountains(state, player, 4);
    const cast = Game.restore(state, DARLING_DB);
    cast.submit(player, cast.legalActions(player).find((action) => action.type === 'castDarling')!);
    const severed = structuredClone(cast.instanceState);
    const permanent = severed.battlefield.find((perm) => perm.owner === player && perm.cardId === 'darling')!;
    const events: GameEvent[] = [];
    runOps(
      severed,
      DARLING_DB,
      (event) => events.push(event),
      { controller: opponentOf(player), sourceCardId: 'murder', targets: [{ kind: 'permanent', iid: permanent.iid }] },
      [{ op: 'sever', to: 'target' }],
    );
    expect(events.some((event) => event.e === 'severed' && event.cardId === 'darling')).toBe(true);
    expect(severed.players[player].severed).not.toContain('darling');
    expect(severed.players[player].darlingZone).not.toBeNull();
    expect(severed.players[player].darlingTax).toBe(DARLING_TAX_STEP);
  });

  it('returns a recalled Darling to its zone without tax or a death event', () => {
    const game = new Game({
      decks: [DARLING_DECK, DARLING_DECK],
      darlings: ['darling', 'darling'],
      landReserves: [DARLING_RESERVE, DARLING_RESERVE],
      format: 'darlings',
      seed: 806,
      db: DARLING_DB,
    });
    const player = keepToMain(game);
    const state = structuredClone(game.instanceState);
    addMountains(state, player, 4);
    const cast = Game.restore(state, DARLING_DB);
    cast.submit(player, cast.legalActions(player).find((action) => action.type === 'castDarling')!);
    const recalled = structuredClone(cast.instanceState);
    const permanent = recalled.battlefield.find((perm) => perm.owner === player && perm.cardId === 'darling')!;
    const events: GameEvent[] = [];
    runOps(
      recalled,
      DARLING_DB,
      (event) => events.push(event),
      { controller: opponentOf(player), sourceCardId: 'murder', targets: [{ kind: 'permanent', iid: permanent.iid }] },
      [{ op: 'recall', to: 'target' }],
    );
    expect(recalled.players[player].darlingZone).not.toBeNull();
    expect(recalled.players[player].darlingTax).toBe(0);
    expect(events.some((event) => event.e === 'died')).toBe(false);
  });

  it('keeps classic and Warchest states free of Darling zones and actions', () => {
    const classic = new Game({ decks: [DARLING_DECK, DARLING_DECK], seed: 804, db: DARLING_DB });
    const warchest = new Game({
      decks: [RESERVE_DECK, RESERVE_DECK],
      format: 'warchest',
      landReserves: [RESERVE, RESERVE],
      seed: 805,
      db: DARLING_DB,
    });
    const classicPlayer = keepToMain(classic);
    const warchestPlayer = keepToMain(warchest);

    for (const game of [classic, warchest]) {
      expect(game.state.players.every((player) => player.darlingZone === undefined && player.darlingTax === undefined)).toBe(true);
    }
    expect(classic.legalActions(classicPlayer).some((action) => action.type === 'castDarling' || action.type === 'payDownDarlingTax')).toBe(false);
    expect(warchest.legalActions(warchestPlayer).some((action) => action.type === 'castDarling' || action.type === 'payDownDarlingTax')).toBe(false);
  });

  it('requires both the Warchest reserve and Darling payloads', () => {
    expect(() => new Game({
      decks: [DARLING_DECK, DARLING_DECK],
      darlings: ['darling', 'darling'],
      format: 'darlings',
      seed: 807,
      db: DARLING_DB,
    })).toThrow('Reserve formats require one landReserves payload for each player.');
    expect(() => new Game({
      decks: [DARLING_DECK, DARLING_DECK],
      landReserves: [DARLING_RESERVE, DARLING_RESERVE],
      format: 'darlings',
      seed: 808,
      db: DARLING_DB,
    })).toThrow('Darlings games require one darlings payload for each player.');
  });
});
