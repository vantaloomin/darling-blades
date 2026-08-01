import { DARLING_PAYDOWN_REDUCTION } from '../config/rules';
import type { Action } from '../engine/actions';
import type { PlayerView } from '../engine/view';

type PayDownAction = Extract<Action, { type: 'payDownDarlingTax' }>;

/**
 * Shared conservative command-zone valve policy. Spend four mana only when
 * the public zone holds a Darling that cannot currently be cast, there is no
 * available land drop, and no ordinary spell or Skim can use the mana. This
 * is intentionally deterministic and repeatable: a later four-mana action
 * pays another step if the same conditions still hold.
 */
export function chooseDarlingPaydown(
  view: PlayerView,
  legal: readonly Action[],
): PayDownAction | null {
  const paydown = legal.find((action): action is PayDownAction => action.type === 'payDownDarlingTax');
  if (!paydown || view.you.darlingZone === undefined || view.you.darlingZone === null) return null;
  if ((view.you.darlingTax ?? 0) < DARLING_PAYDOWN_REDUCTION) return null;
  if (legal.some((action) => action.type === 'castDarling' || action.type === 'playLand')) return null;
  if (legal.some((action) => action.type === 'castSpell' || action.type === 'skim')) return null;
  return paydown;
}
