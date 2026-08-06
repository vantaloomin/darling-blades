import { describe, expect, it } from 'vitest';
import { MediumAI } from '../../src/ai/MediumAI';
import { CARD_DB } from '../../src/data/catalog';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { Game } from '../../src/engine/Game';
import { GameTelemetry } from '../../src/meta/telemetry';
import { playOut } from '../../scripts/balance-matrix';
import { smallGreenDeck, TEST_DB } from '../helpers';

describe('GameTelemetry', () => {
  it('records cleanup discards, driven turns, mulligans, and classic reserve state', () => {
    const telemetry = new GameTelemetry(TEST_DB, ['Green A', 'Green B']);
    const game = new Game({
      decks: [smallGreenDeck(), smallGreenDeck()],
      seed: 19,
      db: TEST_DB,
      eventObserver: telemetry.onEvent.bind(telemetry),
    });
    const mulliganPlayer = game.awaiting.kind === 'mulligan' ? game.awaiting.player : 0;
    game.submit(mulliganPlayer, { type: 'mulligan' });
    game.submit(mulliganPlayer, { type: 'keepHand' });
    const other = game.awaiting;
    if (other.kind !== 'mulligan') throw new Error('expected the second mulligan decision');
    game.submit(other.player, { type: 'keepHand' });

    const active = game.instanceState.activePlayer;
    game.state.players[active].hand.push('bear');
    game.submit(active, { type: 'passStep' });
    game.submit(active, { type: 'declareAttackers', attackers: [] });
    game.submit(active, { type: 'passStep' });
    expect(game.awaiting).toMatchObject({
      player: active,
      kind: 'discardToHandSize',
      count: 1,
    });
    game.submit(active, { type: 'discard', handIndices: [0] });

    const record = telemetry.finish(game.instanceState, 'draw');
    expect(record.turns).toBe(2);
    expect(record.players[active].cleanupDiscards).toBe(1);
    expect(record.players[active].cleanupDiscardsFirst6).toBe(1);
    expect(record.players[active].cleanupDiscardsByTurn).toEqual({ '1': 1 });
    expect(record.players[active].handCloggedTurns).toBe(1);
    expect(record.players[mulliganPlayer].mulligans).toBe(1);
    expect(record.players[0].reserveExhaustedTurn).toBeNull();
    expect(record.players[1].reserveExhaustedTurn).toBeNull();
  });

  it('does not change fixed-seed simulation outcomes when attached', () => {
    const decks: [string[], string[]] = [
      STARTER_DECKS[0].cards,
      STARTER_DECKS[1].cards,
    ];
    for (const seed of [101, 202, 303]) {
      const plain = playOut(
        seed,
        new MediumAI(CARD_DB),
        new MediumAI(CARD_DB),
        decks,
      );
      let observed = false;
      const instrumented = playOut(
        seed,
        new MediumAI(CARD_DB),
        new MediumAI(CARD_DB),
        decks,
        undefined,
        undefined,
        undefined,
        undefined,
        ['Crimson Muster', 'Wild Communion'],
        () => {
          observed = true;
        },
      );
      expect(instrumented).toBe(plain);
      expect(observed).toBe(true);
    }
  });
});
