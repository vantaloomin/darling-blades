import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { ScriptAI } from '../../src/ai/ScriptAI';
import { determinize } from '../../src/ai/determinize';
import { Game } from '../../src/engine/Game';
import type { PlayerId } from '../../src/engine/types';
import { opponentOf } from '../../src/engine/types';
import { smallGreenDeck, TEST_DB } from '../helpers';

function newGame(seed: number, playDrawChoice?: boolean): Game {
  return new Game({
    decks: [smallGreenDeck(), smallGreenDeck()],
    seed,
    db: TEST_DB,
    ...(playDrawChoice === undefined ? {} : { playDrawChoice }),
  });
}

function flipWinner(game: Game): PlayerId {
  const event = game.initialEvents[0];
  if (event?.e !== 'coinFlipped') throw new Error('expected coin flip event');
  return event.winner;
}

function keepBoth(game: Game): void {
  for (let i = 0; i < 2; i++) {
    const awaiting = game.awaiting;
    if (awaiting.kind !== 'mulligan') throw new Error('expected mulligan');
    game.submit(awaiting.player, { type: 'keepHand' });
  }
}

describe('coin flip and play/draw choice', () => {
  it('keeps the legacy opening byte-identical when the flag is omitted or false', () => {
    for (const [seed, expectedStartingPlayer] of [
      [1, 1],
      [7, 0],
    ] as const) {
      const omitted = newGame(seed);
      const explicitOff = newGame(seed, false);

      expect(omitted.state.startingPlayer).toBe(expectedStartingPlayer);
      expect(JSON.stringify(explicitOff.state)).toBe(JSON.stringify(omitted.state));
      expect(JSON.stringify(explicitOff.initialEvents)).toBe(JSON.stringify(omitted.initialEvents));
      expect(omitted.initialEvents[0]).toEqual({
        e: 'firstPlayerChosen',
        player: expectedStartingPlayer,
      });
    }
  });

  it('reuses the legacy roll and RNG stream when the winner chooses to play', () => {
    const legacy = newGame(42);
    const game = newGame(42, true);
    const winner = flipWinner(game);

    expect(winner).toBe(legacy.state.startingPlayer);
    expect(game.state.rng).toEqual(legacy.state.rng);
    expect(game.state.players[0].hand).toEqual([]);
    expect(game.state.players[1].hand).toEqual([]);
    expect(game.state.players[0].deck).toHaveLength(smallGreenDeck().length);
    expect(game.state.players[1].deck).toHaveLength(smallGreenDeck().length);

    const events = game.submit(winner, { type: 'choosePlayDraw', play: true });
    expect(events.slice(0, 2)).toEqual([
      { e: 'playDrawChosen', player: winner, play: true },
      { e: 'firstPlayerChosen', player: winner },
    ]);
    expect(events.filter((event) => event.e === 'drew')).toHaveLength(14);
    expect(JSON.stringify(game.state)).toBe(JSON.stringify(legacy.state));
  });

  it('makes the opponent start when the flip winner chooses to draw', () => {
    const game = newGame(8128, true);
    const winner = flipWinner(game);
    const starter = opponentOf(winner);
    const rngBeforeChoice = [...game.state.rng];

    const events = game.submit(winner, { type: 'choosePlayDraw', play: false });

    expect(events.slice(0, 2)).toEqual([
      { e: 'playDrawChosen', player: winner, play: false },
      { e: 'firstPlayerChosen', player: starter },
    ]);
    expect(events.filter((event) => event.e === 'drew')).toHaveLength(14);
    expect(game.state.rng).toEqual(rngBeforeChoice);
    expect(game.state.startingPlayer).toBe(starter);
    expect(game.state.activePlayer).toBe(starter);
    expect(game.awaiting).toEqual({ player: starter, kind: 'mulligan' });

    keepBoth(game);
    expect(game.state.players[starter].hand).toHaveLength(7);
    expect(game.state.players[winner].hand).toHaveLength(7);

    game.submit(starter, { type: 'passStep' });
    game.submit(starter, { type: 'declareAttackers', attackers: [] });
    game.submit(starter, { type: 'passStep' });

    expect(game.state.activePlayer).toBe(winner);
    expect(game.state.turn).toBe(2);
    expect(game.state.players[starter].hand).toHaveLength(7);
    expect(game.state.players[winner].hand).toHaveLength(8);
  });

  it('exposes exactly play, draw, and concede to the flip winner', () => {
    const game = newGame(7, true);
    const winner = flipWinner(game);

    expect(game.viewFor(winner).awaiting).toEqual({ player: winner, kind: 'choosePlayDraw' });
    expect(game.legalActions(winner)).toEqual([
      { type: 'choosePlayDraw', play: true },
      { type: 'choosePlayDraw', play: false },
      { type: 'concede' },
    ]);
    expect(game.legalActions(opponentOf(winner))).toEqual([]);
  });

  it('has every brain deterministically choose to play', () => {
    const brains: AIPlayer[] = [
      new EasyAI(TEST_DB, 71),
      new MediumAI(TEST_DB),
      new HardAI(TEST_DB),
      new ScriptAI(TEST_DB),
    ];

    for (const brain of brains) {
      const game = newGame(1, true);
      const winner = flipWinner(game);
      const action = brain.chooseAction(game.viewFor(winner), game.legalActions(winner));
      expect(action).toEqual({ type: 'choosePlayDraw', play: true });
      expect(() => game.submit(winner, action)).not.toThrow();
    }
  });

  it('plays an opt-in AI game to completion', () => {
    const game = newGame(31, true);
    const brains: [AIPlayer, AIPlayer] = [new EasyAI(TEST_DB, 101), new MediumAI(TEST_DB)];

    for (let guard = 0; guard < 20_000; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') {
        expect(game.state.winner).not.toBeNull();
        return;
      }
      const player = awaiting.player;
      game.submit(player, brains[player].chooseAction(game.viewFor(player), game.legalActions(player)));
    }
    throw new Error('opt-in AI game did not terminate');
  });

  it('rejects determinization during the pre-mulligan choice', () => {
    const game = newGame(7, true);
    const winner = flipWinner(game);
    expect(() => determinize(game.viewFor(winner), TEST_DB)).toThrow(
      'determinize cannot run before the play/draw choice resolves',
    );
  });
});
