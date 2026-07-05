import type { Emit } from './battlefield';
import { destroyPermanent } from './battlefield';
import { fireTriggers } from './effects/EffectInterpreter';
import { endGame } from './phases';
import { getEffectiveStats } from './statics';
import type { CardDb, GameState } from './types';
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

    // Creatures with lethal damage, deathtouch damage, or toughness <= 0 die.
    for (const perm of [...state.battlefield]) {
      const d = def(db, perm.cardId);
      if (!isType(d, 'creature')) continue;
      if (!state.battlefield.some((p) => p.iid === perm.iid)) continue; // already gone this pass
      const stats = getEffectiveStats(state.battlefield, db, perm.iid);
      if (
        stats.toughness <= 0 ||
        perm.damage >= stats.toughness ||
        (perm.deathtouched && perm.damage > 0)
      ) {
        if (destroyPermanent(state, db, perm, emit)) {
          fireTriggers(state, db, emit, 'dies', perm);
          changed = true;
        }
      }
    }

    // Auras attached to something that no longer exists die.
    for (const perm of [...state.battlefield]) {
      if (perm.attachedTo === undefined) continue;
      if (!state.battlefield.some((p) => p.iid === perm.attachedTo)) {
        if (destroyPermanent(state, db, perm, emit)) {
          fireTriggers(state, db, emit, 'dies', perm);
          changed = true;
        }
      }
    }

    // Legend rule (simple per-player form): among same-name legendaries you
    // control, the OLDEST survives (battlefield order = entry order).
    const seen = new Set<string>();
    for (const perm of [...state.battlefield]) {
      const d = def(db, perm.cardId);
      if (!d.supertypes?.includes('legendary')) continue;
      const key = `${perm.controller}:${d.name}`;
      if (seen.has(key)) {
        if (destroyPermanent(state, db, perm, emit)) {
          fireTriggers(state, db, emit, 'dies', perm);
          changed = true;
        }
      } else {
        seen.add(key);
      }
    }

    if (!changed) return;
  }
  throw new Error('checkStateBased did not stabilize');
}
