import type { Action } from '../engine/actions';
import type { Color, CardDb } from '../engine/types';
import { def, isType } from '../engine/types';
import type { PlayerView } from '../engine/view';

type LandAction = Extract<Action, { type: 'playLand' }>;

const COLORS: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];

function isBasic(cardId: string, db: CardDb): boolean {
  return def(db, cardId).supertypes?.includes('basic') ?? false;
}

function colorCounts(view: PlayerView, db: CardDb): Record<Color, number> {
  const counts = { W: 0, U: 0, B: 0, R: 0, G: 0 } satisfies Record<Color, number>;
  for (const perm of view.battlefield) {
    if (perm.controller !== view.myId || perm.tapped) continue;
    const d = def(db, perm.cardId);
    if (!isType(d, 'land') && !d.manaAbility) continue;
    for (const color of d.manaAbility ?? []) {
      if (color !== 'C') counts[color]++;
    }
  }
  return counts;
}

/**
 * Count pip colors that the visible hand's affordable plan still lacks. The
 * count is intentionally conservative: a dual source satisfies one unit of
 * each color, while generic costs do not create an invented color preference.
 */
function missingColors(view: PlayerView, db: CardDb): Record<Color, number> {
  const sources = colorCounts(view, db);
  const missing = { W: 0, U: 0, B: 0, R: 0, G: 0 } satisfies Record<Color, number>;
  for (const cardId of view.you.hand) {
    const d = def(db, cardId);
    if (isType(d, 'land') || !d.cost) continue;
    for (const color of COLORS) {
      const pipCount = d.cost.pips[color] ?? 0;
      if (pipCount > sources[color]) missing[color] = Math.max(missing[color], pipCount - sources[color]);
    }
  }
  return missing;
}

/**
 * Shared deterministic reserve policy used by Easy, Medium, Hard, and the
 * scripted teaching brain. The legal menu supplies the ordered physical
 * choices; ties retain that order, so the same view and seed make the same
 * choice. Classic callers receive null and keep their existing hand policy.
 */
export function chooseReserveLand(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
): LandAction | null {
  if (view.you.landReserve === undefined || view.you.landDropsRemaining <= 0) return null;
  const candidates = legal.filter(
    (action): action is LandAction => action.type === 'playLand' && action.reserveIndex !== undefined,
  );
  if (candidates.length === 0) return null;

  const missing = missingColors(view, db);
  const manaIdle = !legal.some((action) => action.type === 'castSpell' || action.type === 'skim');
  let best = candidates[0];
  let bestScore = -Infinity;

  for (const action of candidates) {
    const cardId = view.you.landReserve[action.reserveIndex!];
    const d = def(db, cardId);
    const colors = new Set(d.manaAbility ?? []);
    const missingScore = COLORS.reduce((sum, color) =>
      sum + (colors.has(color) ? missing[color] * 100 : 0), 0);
    const dual = colors.size > 1;
    let score = missingScore;

    if (missingScore === 0) {
      // A tapped dual is a good setup land only when today's mana is idle.
      score += manaIdle ? (dual ? 45 : 0) : (d.entersTapped ? -45 : 20);
      // Basics are the recovery reserve. Spend them only when they fix an
      // immediate gap; otherwise preserve them while a dual remains.
      if (isBasic(cardId, db)) score -= manaIdle ? 10 : 2;
      if (dual) score += manaIdle ? 20 : 0;
    } else if (isBasic(cardId, db)) {
      // With a live mana requirement, an untapped basic is the safer exact fix.
      score += d.entersTapped ? -15 : 10;
    } else if (d.entersTapped && !manaIdle) {
      score -= 15;
    }

    if (score > bestScore) {
      best = action;
      bestScore = score;
    }
  }
  return best;
}
