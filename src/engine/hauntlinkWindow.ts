import { canPay } from './mana';
import type { CardDb, GameState, PlayerId } from './types';
import { def, isType } from './types';

/**
 * Revision 4 Hauntlink windows (owner ruling 2026-09-04): Hauntlink alone may
 * act over a trigger about to resolve and at the combat damage step. The
 * engine holds a trigger's ops back only when a window could actually open -
 * someone controls an unlinked-or-movable Hauntlink permanent, a creature to
 * host it, and the mana for the link. A board where that is false takes the
 * revision-3 path unchanged, which keeps the feature strictly additive.
 *
 * Kept free of `actions.ts` so `EffectInterpreter` can ask without an import
 * cycle; the fuller per-action check lives in `hasPayableHauntlinkAction`.
 */
export function canOpenHauntlinkWindow(state: GameState, db: CardDb, player: PlayerId): boolean {
  if ((state.rulesRev ?? 1) < 4) return false;
  const hosts = state.battlefield.filter(
    (perm) => perm.controller === player && isType(def(db, perm.cardId), 'creature'),
  );
  if (hosts.length === 0) return false;
  for (const link of state.battlefield) {
    if (link.controller !== player) continue;
    const d = def(db, link.cardId);
    if (d.hauntlink === undefined || !canPay(state, db, player, d.hauntlink.cost)) continue;
    // A link already on its only possible host has nowhere to move.
    if (hosts.some((host) => host.iid !== link.attachedTo)) return true;
  }
  return false;
}

/** Either player could take a Hauntlink action if offered a window now. */
export function anyPayableHauntlink(state: GameState, db: CardDb): boolean {
  return canOpenHauntlinkWindow(state, db, 0) || canOpenHauntlinkWindow(state, db, 1);
}
