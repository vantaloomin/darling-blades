import type { Action } from '../engine/actions';
import type { CardDb } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import type { PlayerView } from '../engine/view';

/**
 * Shared deterministic foresee policy. Keep lands while developing; once four
 * mana sources are established, bottom excess lands and cards far above the
 * current early-game curve. The player-facing awaiting cards are top-first.
 */
export function chooseForesee(view: PlayerView, db: CardDb): Action {
  if (view.awaiting.kind !== 'foresee') return { type: 'foresee', bottomIndices: [] };

  const landCards = view.you.hand.filter((cardId) => isType(def(db, cardId), 'land')).length;
  const manaSources = view.battlefield.filter(
    (perm) => perm.controller === view.myId && (def(db, perm.cardId).manaAbility?.length ?? 0) > 0,
  ).length;
  let projectedLands = landCards + manaSources;
  const bottomIndices: number[] = [];

  view.awaiting.cards.forEach((cardId, index) => {
    const d = def(db, cardId);
    if (isType(d, 'land')) {
      if (manaSources >= 4 && projectedLands > 4) {
        bottomIndices.push(index);
        projectedLands--;
      }
      return;
    }
    if (manaSources <= 2 && manaValue(d.cost) > manaSources + 2) {
      bottomIndices.push(index);
    }
  });

  return { type: 'foresee', bottomIndices };
}
