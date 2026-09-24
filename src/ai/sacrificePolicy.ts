import type { Action } from '../engine/actions';
import { def, isType, type CardDb } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { permValue } from './value';

/** Edicts are mandatory: feed the cheapest legal body, even a sole survivor. */
export function chooseSacrifice(view: PlayerView, db: CardDb, legal: readonly Action[]): Action {
  if (view.awaiting.kind !== 'chooseTarget' || view.awaiting.decision !== 'sacrifice' ||
    view.awaiting.player !== view.myId) return legal[0];
  const choices = legal.flatMap((action) => {
    if (action.type !== 'chooseTarget' || action.target.kind !== 'permanent') return [];
    const iid = action.target.iid;
    const index = view.battlefield.findIndex((perm) => perm.iid === iid);
    const perm = view.battlefield[index];
    if (!perm || perm.controller !== view.myId || !isType(def(db, perm.cardId), 'creature')) return [];
    return [{ action, index, value: permValue(view.battlefield, db, iid) }];
  });
  choices.sort((a, b) => a.value - b.value || a.index - b.index);
  return choices[0]?.action ?? legal[0];
}
