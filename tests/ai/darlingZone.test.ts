import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { Game } from '../../src/engine/Game';
import type { GameState, Permanent, PlayerId } from '../../src/engine/types';
import { TEST_DB } from '../helpers';

const DARLINGS_DECK = Array.from({ length: 79 }, () => 'bear');
const DARLINGS_RESERVE = Array.from({ length: 10 }, () => 'forest');

function keepToMain(game: Game): PlayerId {
  while (game.awaiting.kind !== 'main') {
    const awaiting = game.awaiting;
    if (!('player' in awaiting)) throw new Error(`unexpected setup ${awaiting.kind}`);
    game.submit(awaiting.player, { type: 'keepHand' });
  }
  return game.awaiting.player;
}

function addForests(state: GameState, player: PlayerId, count: number): void {
  for (let i = 0; i < count; i++) {
    const iid = state.nextIid++;
    const permanent: Permanent = {
      iid,
      cardId: 'forest',
      owner: player,
      controller: player,
      tapped: false,
      enteredThisTurn: false,
      damage: 0,
      deathtouched: false,
      attachments: [],
      plusOneCounters: 0,
      untilEotMods: [],
    };
    state.battlefield.push(permanent);
  }
}

function readyDarlingGame(tax = 0, forests = 2): { game: Game; player: PlayerId } {
  const game = new Game({
    decks: [DARLINGS_DECK, DARLINGS_DECK],
    darlings: ['bear', 'bear'],
    landReserves: [DARLINGS_RESERVE, DARLINGS_RESERVE],
    format: 'darlings',
    seed: 9701,
    db: TEST_DB,
  });
  const player = keepToMain(game);
  const state = structuredClone(game.instanceState);
  state.players[player].hand = [];
  state.players[player].darlingTax = tax;
  state.players[player].landDropsUsed = 1;
  addForests(state, player, forests);
  return { game: Game.restore(state, TEST_DB), player };
}

describe('Darlings AI policy', () => {
  it('has every difficulty value the public Darling as a creature cast', () => {
    const { game, player } = readyDarlingGame();
    const view = game.viewFor(player);
    const legal = game.legalActions(player);
    const brains = [new EasyAI(TEST_DB, 1), new MediumAI(TEST_DB), new HardAI(TEST_DB)];
    for (const brain of brains) {
      expect(brain.chooseAction(view, legal)).toMatchObject({ type: 'castDarling' });
    }
  });

  it('pays down only when the Darling is otherwise uncastable and mana has no other use', () => {
    const { game, player } = readyDarlingGame(4, 4);
    const view = game.viewFor(player);
    const legal = game.legalActions(player);
    expect(legal.some((action) => action.type === 'castDarling')).toBe(false);
    expect(legal.some((action) => action.type === 'payDownDarlingTax')).toBe(true);
    const brains = [new EasyAI(TEST_DB, 2), new MediumAI(TEST_DB), new HardAI(TEST_DB)];
    for (const brain of brains) {
      expect(brain.chooseAction(view, legal)).toMatchObject({ type: 'payDownDarlingTax' });
    }
  });

  it('finishes a seeded Darlings game at each difficulty', () => {
    const factories = [
      () => new EasyAI(TEST_DB, 31),
      () => new MediumAI(TEST_DB),
      () => new HardAI(TEST_DB),
    ];
    for (const makeBrain of factories) {
      const game = new Game({
        decks: [DARLINGS_DECK, DARLINGS_DECK],
        darlings: ['bear', 'bear'],
        landReserves: [DARLINGS_RESERVE, DARLINGS_RESERVE],
        format: 'darlings',
        seed: 9702,
        db: TEST_DB,
      });
      const brains = [makeBrain(), makeBrain()];
      for (let actionNo = 0; actionNo < 2500 && game.instanceState.winner === null; actionNo++) {
        const awaiting = game.instanceState.awaiting;
        if (!('player' in awaiting)) break;
        const player = awaiting.player;
        game.submit(player, brains[player].chooseAction(game.viewFor(player), game.legalActions(player)));
      }
      expect(game.instanceState.winner).not.toBeNull();
    }
  }, 120000);
});
