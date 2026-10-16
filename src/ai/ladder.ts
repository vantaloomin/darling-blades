import type { CardDb } from '../engine/types';
import type { AIPlayer } from './AIPlayer';
import { HardAI, type HardSearchOptions } from './HardAI';
import { DEFAULT_PERSONALITY } from './personality';

/**
 * Duel any Deck's three AI levels (2.0, owner 2026-10-16): Hard is the base,
 * Expert and Master sit above it. All three are the Hard brain on the same
 * redacted view; the higher levels search wider and further. None reads a
 * hidden card.
 * Nothing here touches the Tower's tier dial (src/ai/tiers.ts).
 */
export type LadderLevel = 'hard' | 'expert' | 'master';

/**
 * Measured with scripts/brain-ladder.ts on the five starter Standard decks,
 * 600 games a pairing, both seats and both decks, at 25 life (2026-10-16):
 *  - Expert, a wide main-phase search (every ordinary cast, not only Medium's
 *    pick) with each line played out to the end of its own turn: 57.0% vs Hard.
 *  - Master, the same search played on through the opponent's turn to its own
 *    next main phase: 54.2% vs Expert (tuning continues).
 * Measured and NOT kept (all within noise of the level below): knowing its own
 * library (with 1 or 3 worlds), a second attack-search turn cycle, rollouts
 * without the wide search, and 14 main-phase slots instead of 8.
 */
export const LADDER_SEARCH: Readonly<Record<Exclude<LadderLevel, 'hard'>, HardSearchOptions>> = {
  expert: { wideMain: true, rollout: 'turn' },
  master: { wideMain: true, rollout: 'cycle' },
};

/** The brain for one level, piloting `deck`. Hard ignores the list and plays exactly as it ships. */
export function buildLadderAI(level: LadderLevel, db: CardDb, deck: readonly string[]): AIPlayer {
  if (level === 'hard') return new HardAI(db, DEFAULT_PERSONALITY);
  const search = LADDER_SEARCH[level];
  return new HardAI(db, DEFAULT_PERSONALITY, search.ownDeck ? { ...search, ownDeck: deck } : search);
}
