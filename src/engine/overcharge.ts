import { RULES } from '../config/rules';
import type { Emit } from './battlefield';
import { isTokenPermanent } from './battlefield';
import type { CardDb, GameState, Permanent, PlayerId } from './types';
import { def, isType } from './types';

/**
 * Overcharge (1.9 A1.7, the owner's rulings of 2026-09-29): a token that would
 * be created while its controller already controls `RULES.maxCreatures`
 * creatures is not created. Instead one creature token that player controls
 * with the SAME NAME gets an Overcharge: +1/+1 each (`getEffectiveStats`), at
 * most `RULES.overchargeLimit` on one creature.
 *
 * - Namesake only: never any other creature, and no fallback. With no eligible
 *   same-name token the refused token simply is not created, as before, and
 *   `tokenRefused` says so (owner, 2026-09-29): no state changes, only the log.
 * - Tokens only: creature spells, raises and Nine Lives returns keep the plain
 *   cap. Preserve never reaches here: it is refused at legality at the cap.
 * - Not a Mark: `Permanent.overcharge` is its own field. No Mark rule reads or
 *   writes it, and no Mark or arrival trigger fires.
 * - The pick is fixed, with no prompt and no AI decision: the eligible
 *   namesake with the fewest Overcharges, ties to the oldest (lowest iid).
 */
export function overchargeRecipient(
  state: GameState,
  db: CardDb,
  controller: PlayerId,
  tokenCardId: string,
): Permanent | undefined {
  const name = def(db, tokenCardId).name;
  let best: Permanent | undefined;
  for (const perm of state.battlefield) {
    if (perm.controller !== controller || !isTokenPermanent(db, perm)) continue;
    const d = def(db, perm.cardId);
    if (d.name !== name || !isType(d, 'creature')) continue;
    const charges = perm.overcharge ?? 0;
    if (charges >= RULES.overchargeLimit) continue;
    const bestCharges = best?.overcharge ?? 0;
    if (!best || charges < bestCharges || (charges === bestCharges && perm.iid < best.iid)) best = perm;
  }
  return best;
}

/**
 * Handle one token refused at the creature cap: overcharge its namesake, if
 * one is eligible; otherwise emit `tokenRefused` so the duel log can say why
 * nothing entered.
 */
export function refuseTokenAtCap(
  state: GameState,
  db: CardDb,
  emit: Emit,
  controller: PlayerId,
  tokenCardId: string,
): void {
  const recipient = overchargeRecipient(state, db, controller, tokenCardId);
  if (!recipient) {
    emit({ e: 'tokenRefused', player: controller, tokenCardId });
    return;
  }
  recipient.overcharge = (recipient.overcharge ?? 0) + 1;
  emit({
    e: 'overcharged',
    player: controller,
    iid: recipient.iid,
    cardId: recipient.cardId,
    tokenCardId,
    total: recipient.overcharge,
  });
}
