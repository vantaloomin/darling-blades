import type { CardDb } from '../engine/types';
import type { AIPlayer } from './AIPlayer';
import { HardAI, type HardSearchOptions } from './HardAI';
import { DEFAULT_EVAL_WEIGHTS } from './evaluate';
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
 * both seats and both decks, at 25 life (2026-10-16). Picks were made on one
 * seed range and confirmed on fresh seeds (1,200 games each):
 *  - Expert, a wide main-phase search (every ordinary cast, not only Medium's
 *    pick) with each line played out to the end of its own turn: 58.6% vs Hard.
 *  - Master, the same search over which land to play as well, each line played
 *    on through the opponent's turn to its own next main phase, scoring life
 *    higher and cards and its own clock double: 58.3% vs Expert.
 * Land search alone lifts Expert to 63.6% vs Hard, but then Master's step over
 * it shrinks to 53.6%, so it stays Master's.
 * Measured and NOT kept (within noise of the level below, or worse): knowing
 * its own library (1 or 3 worlds), a second attack-search turn cycle, rollouts
 * without the wide search, 14 main-phase slots, every subset of attackers,
 * smaller search margins, averaging both horizons, Hard itself playing the
 * rollouts (also 3-4x slower), guessing the opponent's hidden cards from the
 * spells they have shown (47-50%), assuming the worst of three counterattacks,
 * and single-weight changes besides these.
 */
export const LADDER_SEARCH: Readonly<Record<Exclude<LadderLevel, 'hard'>, HardSearchOptions>> = {
  expert: { wideMain: true, rollout: 'turn' },
  master: {
    wideMain: true,
    wideLand: true,
    rollout: 'cycle',
    weights: { ...DEFAULT_EVAL_WEIGHTS, life: 22.4, card: 2.4, myClock: 1.2 },
  },
};

/** The brain for one level, piloting `deck`. Hard ignores the list and plays exactly as it ships. */
export function buildLadderAI(level: LadderLevel, db: CardDb, deck: readonly string[]): AIPlayer {
  if (level === 'hard') return new HardAI(db, DEFAULT_PERSONALITY);
  const search = LADDER_SEARCH[level];
  return new HardAI(db, DEFAULT_PERSONALITY, search.ownDeck ? { ...search, ownDeck: deck } : search);
}
