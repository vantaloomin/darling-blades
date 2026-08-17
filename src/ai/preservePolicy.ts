import type { Action } from '../engine/actions';
import type { CardDb } from '../engine/types';
import { def, isType, opponentOf } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { cardValue } from './value';

export type PreserveAction = Extract<Action, { type: 'preserveCard' }>;
export type MainCast = Extract<Action, { type: 'castSpell' | 'castDarling' }>;

/** Full public value of the body and printed arrival riders Preserve will copy. */
export function preserveActionValue(
  view: PlayerView,
  db: CardDb,
  action: PreserveAction,
): number {
  const cardId = view.you.graveyard[action.graveIndex];
  return cardId !== undefined && db[cardId] !== undefined ? cardValue(db, cardId) : -Infinity;
}

/**
 * Preserve the largest affordable public graveyard body when mana would
 * otherwise go unused or our creature count trails the opponent's. A cast
 * that the calling brain scores higher always wins the comparison.
 */
export function choosePreserve(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
  castScore: (cast: MainCast) => number,
): PreserveAction | undefined {
  const preserves = legal.filter(
    (action): action is PreserveAction => action.type === 'preserveCard',
  );
  if (preserves.length === 0) return undefined;

  const casts = legal.filter(
    (action): action is MainCast => action.type === 'castSpell' || action.type === 'castDarling',
  );
  const creatureCount = (controller: PlayerView['myId']): number =>
    view.battlefield.filter(
      (perm) =>
        perm.controller === controller &&
        db[perm.cardId] !== undefined &&
        isType(def(db, perm.cardId), 'creature'),
    ).length;
  const manaOtherwiseIdle = casts.length === 0;
  const behindOnBodies = creatureCount(view.myId) < creatureCount(opponentOf(view.myId));
  if (!manaOtherwiseIdle && !behindOnBodies) return undefined;

  const best = preserves.reduce((current, candidate) =>
    preserveActionValue(view, db, candidate) > preserveActionValue(view, db, current)
      ? candidate
      : current,
  );
  if (!manaOtherwiseIdle) {
    const bestCastScore = Math.max(...casts.map(castScore));
    if (bestCastScore > preserveActionValue(view, db, best)) return undefined;
  }
  return best;
}
