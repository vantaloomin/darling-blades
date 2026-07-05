import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { botAction, runBotGame, smallGreenDeck, TEST_DB } from '../helpers';

describe('determinism', () => {
  it('same decks + seed + actions → identical event streams and final state', () => {
    const mk = (): Game =>
      new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 424242, db: TEST_DB });
    const a = mk();
    const b = mk();
    const eventsA = runBotGame(a);
    const eventsB = runBotGame(b);
    expect(JSON.stringify(eventsA)).toBe(JSON.stringify(eventsB));
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it('clone() diverges from the original without affecting it', () => {
    const g = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 5, db: TEST_DB });
    // advance a bit
    for (let i = 0; i < 6; i++) {
      const a = g.awaiting;
      if (a.kind === 'gameOver') break;
      g.submit(a.player, botAction(g.legalActions(a.player)));
    }
    const snapshot = JSON.stringify(g.state);
    const c = g.clone();
    runBotGame(c); // play the clone to completion
    expect(JSON.stringify(g.state)).toBe(snapshot); // original untouched
    expect(c.state.winner).not.toBeNull();
  });

  it('different seeds produce different games', () => {
    const a = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 1, db: TEST_DB });
    const b = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 2, db: TEST_DB });
    expect(JSON.stringify(a.state.players[0].hand)).not.toBe(
      JSON.stringify(b.state.players[0].hand),
    );
  });
});
