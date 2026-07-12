import type { Emit } from './battlefield';
import { destroyPermanent } from './battlefield';
import { fireTriggers } from './effects/EffectInterpreter';
import { endGame } from './phases';
import { getEffectiveStats } from './statics';
import type { CardDb, GameState, Permanent } from './types';
import { def, isType } from './types';

export { destroyPermanent };

/**
 * State-based actions, run after every mutation batch and between damage
 * sub-steps. Loops until stable: a death can orphan an aura, fire a dies
 * trigger that drains life, change lord math, etc.
 */
export function checkStateBased(state: GameState, db: CardDb, emit: Emit): void {
  for (let pass = 0; pass < 30; pass++) {
    if (state.winner !== null) return;
    let changed = false;

    // Players at 0 or less life lose.
    const dead = ([0, 1] as const).filter((p) => state.players[p].life <= 0);
    if (dead.length === 2) {
      endGame(state, emit, 'draw', 'life');
      return;
    }
    if (dead.length === 1) {
      endGame(state, emit, dead[0] === 0 ? 1 : 0, 'life');
      return;
    }

    // Batch semantics (MTG SBAs): every check in a pass condemns against the
    // SAME board snapshot, then ALL the condemned leave the battlefield, then
    // their dies triggers fire in battlefield order. Destroying one-at-a-time
    // (or category-at-a-time) let a second corpse still occupy a battlefield
    // slot while the first corpse's dies-trigger createToken resolved, eating
    // tokens at the creature cap (user-reported 2026-07-12: two attackers die,
    // the token spawner only made 1 of its 2 tokens on a full board).
    const doomedIids = new Set<number>();

    // Creatures with lethal damage, deathtouch damage, or defense <= 0 die —
    // all judged against the same pre-death board (lord math included).
    for (const perm of state.battlefield) {
      if (!isType(def(db, perm.cardId), 'creature')) continue;
      const stats = getEffectiveStats(state.battlefield, db, perm.iid);
      if (
        stats.defense <= 0 ||
        perm.damage >= stats.defense ||
        (perm.deathtouched && perm.damage > 0)
      ) {
        doomedIids.add(perm.iid);
      }
    }

    // Auras attached to something that no longer exists (or dies this pass) die.
    for (const perm of state.battlefield) {
      if (perm.attachedTo === undefined) continue;
      if (
        doomedIids.has(perm.attachedTo) ||
        !state.battlefield.some((p) => p.iid === perm.attachedTo)
      ) {
        doomedIids.add(perm.iid);
      }
    }

    // Legend rule (simple per-player form): among same-name legendaries you
    // control, the OLDEST survives (battlefield order = entry order). A
    // doomed older copy still shields its duplicate for this pass only —
    // the next pass re-runs the rule on the post-death board.
    const seen = new Set<string>();
    for (const perm of state.battlefield) {
      const d = def(db, perm.cardId);
      if (!d.supertypes?.includes('legendary')) continue;
      const key = `${perm.controller}:${d.name}`;
      if (seen.has(key)) doomedIids.add(perm.iid);
      else seen.add(key);
    }

    // Destroy ALL of this pass's deaths (battlefield order), then fire their
    // dies triggers — stopping if one of them ends the game.
    const doomed = state.battlefield.filter((p) => doomedIids.has(p.iid));
    const fallen: Permanent[] = [];
    for (const perm of doomed) {
      if (destroyPermanent(state, db, perm, emit)) fallen.push(perm);
    }
    for (const perm of fallen) {
      if (state.winner !== null) return;
      fireTriggers(state, db, emit, 'dies', perm);
    }
    if (fallen.length > 0) changed = true;

    if (!changed) return;
  }
  throw new Error('checkStateBased did not stabilize');
}
