import type { Action } from '../engine/actions';
import { canAttack } from '../engine/combat/legality';
import { getEffectiveStats } from '../engine/statics';
import type { CardDb } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { activateActionValue } from './value';

export type ActivateAction = Extract<Action, { type: 'activate' }>;

/**
 * Duty competes with combat only on an attacking body. Preserve mana for
 * Morning spells, and let the attack planner run before spending that body.
 * Legality and target lists come exclusively from the caller's legal menu.
 */
export function scoredActivationCandidates(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
): { action: ActivateAction; value: number }[] {
  if (view.awaiting.kind !== 'main' || view.awaiting.player !== view.myId ||
    view.activePlayer !== view.myId || (view.step !== 'main1' && view.step !== 'main2')) return [];
  const candidates = legal.filter((action): action is ActivateAction => {
    if (action.type !== 'activate') return false;
    const source = view.battlefield.find((perm) => perm.iid === action.iid);
    if (!source || source.controller !== view.myId) return false;
    const d = def(db, source.cardId);
    if (!d.activated) return false;
    if (view.step === 'main1') {
      if (manaValue(d.activated.cost.mana) > 0) return false;
      if (isType(d, 'creature')) {
        const stats = getEffectiveStats(view.battlefield, db, source.iid);
        // Even a zero-power or Bulwark Rage body never uses the Morning trick.
        if (stats.keywords.has('rage')) return false;
        if (stats.attack > 0 && canAttack(view.battlefield, db, view.myId, source.iid)) return false;
      }
    }
    return true;
  });
  return candidates.map((action) => ({ action, value: activateActionValue(view, db, action) }))
    .filter(({ value }) => value > 0);
}

export function activationCandidates(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
): ActivateAction[] {
  return scoredActivationCandidates(view, db, legal).map(({ action }) => action);
}

/** Highest positive per-use impact; legal enumeration order breaks ties. */
export function chooseActivate(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
): ActivateAction | null {
  let best: ActivateAction | null = null;
  let bestValue = 0;
  for (const { action, value } of scoredActivationCandidates(view, db, legal)) {
    if (value > bestValue) {
      best = action;
      bestValue = value;
    }
  }
  return best;
}
