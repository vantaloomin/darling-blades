import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { Game } from '../../src/engine/Game';
import { deckOf, TEST_DB } from '../helpers';

function aiDeck(): string[] {
  return deckOf([
    ['forest', 7],
    ['plains', 3],
    ['bear', 6],
    ['elf', 3],
    ['giant', 3],
    ['rhino', 2],
    ['sentinel', 2],
    ['knight', 2],
    ['flyer', 2],
  ]);
}

function runAIGame(seed: number): {
  winner: 0 | 1 | 'draw' | null;
  reason: string | null;
  turns: number;
} {
  const game = new Game({ decks: [aiDeck(), aiDeck()], seed, db: TEST_DB });
  const ais = [new EasyAI(TEST_DB, seed * 2 + 1), new EasyAI(TEST_DB, seed * 2 + 2)];
  for (let i = 0; i < 20000; i++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      return {
        winner: game.state.winner,
        reason: game.state.winReason,
        turns: game.state.turn,
      };
    }
    const p = awaiting.player;
    const action = ais[p].chooseAction(game.viewFor(p), game.legalActions(p));
    game.submit(p, action);
  }
  throw new Error(`AI game (seed ${seed}) did not terminate`);
}

describe('EasyAI vs EasyAI smoke sims', () => {
  it('30 seeded games all terminate legally, most by combat damage', () => {
    let lifeKills = 0;
    for (let seed = 0; seed < 30; seed++) {
      const result = runAIGame(seed);
      expect(result.winner).not.toBeNull();
      if (result.reason === 'life') lifeKills++;
    }
    // With creature-heavy 30-card decks, damage should usually finish games.
    expect(lifeKills).toBeGreaterThanOrEqual(20);
  });
});
