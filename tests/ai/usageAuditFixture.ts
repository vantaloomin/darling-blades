import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import { STARTER_DECKS, THEME_DECKS } from '../../src/data/starterDecks';
import { DARLINGS_PRECON_MATRIX_FLEET } from '../../src/data/darlingsPrecons';
import { Game } from '../../src/engine/Game';
import type { Action } from '../../src/engine/actions';
import type { PlayerId } from '../../src/engine/types';
import { WARCHEST_HAND_SIZE } from '../../src/meta/warchest';
import positions from './fixtures/usageAuditPositions.json';

/** The audit's actual seeded games, with recorded action prefixes: P1's team
 * combats at 4290e37, and the P2-P4 main-phase positions at 30cbf0e8.
 * Replay the history through the engine so earlier improvements cannot erase
 * the decision under test. No battlefield, hand or RNG state is fabricated.
 * Cell numbering and seats follow scripts/balance-matrix.ts's runCell. */
export function usageAuditGame(name: keyof typeof positions): Game {
  const position = positions[name];
  const avatar = AVATARS.find((entry) => entry.tier === position.rung)!;
  const decks = [...STARTER_DECKS, ...THEME_DECKS];
  const proxy = position.matrix === 'darlings' ? DARLINGS_PRECON_MATRIX_FLEET[position.column] : {
    cards: decks[position.column].reserveCards!, landReserve: decks[position.column].landReserve!, darlingId: null,
  };
  const seats = <T>(row: T, column: T): [T, T] => position.game % 2 === 0 ? [row, column] : [column, row];
  const game = new Game({
    seed: position.cell * 100_000 + position.game, db: CARD_DB,
    format: position.matrix === 'darlings' ? 'darlings' : 'warchest',
    decks: seats(position.matrix === 'darlings' ? avatar.darlingsDeck : avatar.reserveDeck, proxy.cards),
    landReserves: seats(avatar.landReserve, proxy.landReserve), startingHandSize: WARCHEST_HAND_SIZE,
    ...(position.matrix === 'darlings' ? { darlings: seats(avatar.darlingId, proxy.darlingId) } : {}),
  });
  for (const entry of position.prefix) game.submit(entry.player as PlayerId, entry.action as Action);
  if (game.state.turn !== position.turn || game.state.step !== position.step ||
    game.awaiting.kind !== ('awaiting' in position ? position.awaiting : 'main') ||
    game.awaiting.kind === 'gameOver' || game.awaiting.player !== position.player) {
    throw new Error(`Audit position ${name} did not reach its recorded decision`);
  }
  return game;
}
