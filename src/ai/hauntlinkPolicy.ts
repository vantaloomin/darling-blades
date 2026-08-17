import type { Action } from '../engine/actions';
import type { CardDb } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { permValue } from './value';

type LinkHauntAction = Extract<Action, { type: 'linkHaunt' }>;

/** Link an unlinked carrier to the strongest public friendly creature. */
export function chooseUnlinkedHauntlink(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
): LinkHauntAction | undefined {
  const candidates = legal.filter((action): action is LinkHauntAction => {
    if (action.type !== 'linkHaunt') return false;
    return view.battlefield.find((perm) => perm.iid === action.iid)?.attachedTo === undefined;
  });
  return candidates.reduce<LinkHauntAction | undefined>((best, action) => {
    if (!best) return action;
    const score = permValue(view.battlefield, db, action.hostIid);
    const bestScore = permValue(view.battlefield, db, best.hostIid);
    return score > bestScore ? action : best;
  }, undefined);
}
