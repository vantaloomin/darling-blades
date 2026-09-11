import type { Action } from '../engine/actions';
import type { AbilityDef, CardDb, Permanent, TargetRef } from '../engine/types';
import { def } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { targetValueForAbility } from './value';

export { targetValueForAbility } from './value';

type ChooseTargetAction = Extract<Action, { type: 'chooseTarget' }>;

function sourceAbility(view: PlayerView, db: CardDb): { source: Permanent; ability: AbilityDef } | undefined {
  const awaiting = view.awaiting;
  if (awaiting.kind !== 'chooseTarget') return undefined;
  const source = view.battlefield.find((perm) => perm.iid === awaiting.sourceIid);
  if (!source) return undefined;
  const ability = def(db, source.cardId).abilities?.[awaiting.abilityIndex];
  return ability ? { source, ability } : undefined;
}

/**
 * Public-board value of choosing `ref` for the currently queued arrival. A
 * strict `>` caller preserves the legalActions battlefield order on ties.
 */
export function targetChoiceValue(view: PlayerView, db: CardDb, ref: TargetRef): number {
  const ctx = sourceAbility(view, db);
  if (!ctx) return 0;
  return targetValueForAbility(view, db, ctx.source, ctx.ability, ref);
}

/** Greedy target selection shared by Easy and Medium, and as Hard's fallback. */
export function chooseTargetAction(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
): Action {
  const choices = legal.filter((action): action is ChooseTargetAction => action.type === 'chooseTarget');
  if (choices.length === 0) return legal[0];
  let best = choices[0];
  let bestValue = targetChoiceValue(view, db, best.target);
  for (const choice of choices.slice(1)) {
    const value = targetChoiceValue(view, db, choice.target);
    if (value > bestValue) {
      best = choice;
      bestValue = value;
    }
  }
  return best;
}
