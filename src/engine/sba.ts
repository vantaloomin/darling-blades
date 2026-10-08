import type { Emit } from './battlefield';
import { destroyPermanent, firesDiesForDestroy } from './battlefield';
import { cardHasProvoked } from './creatureDamage';
import { fireBatchedDies, fireGraveyardTriggers, fireTriggers } from './effects/EffectInterpreter';
import { endGame } from './phases';
import { getEffectiveStats } from './statics';
import type { CardDb, CardEntry, GameState, Permanent } from './types';
import { def, isType } from './types';

export { destroyPermanent };

/** The pass limit before Provoked; each Provoked creature on the battlefield adds one. */
const BASE_PASSES = 30;

/**
 * The state-based death test for a creature: lethal damage, Deathblade
 * damage, or Defense 0 or less. A creature that passes none of them survives,
 * which is what Provoked reads.
 */
export function isLethallyDamaged(state: GameState, db: CardDb, perm: Permanent): boolean {
  const stats = getEffectiveStats(state.battlefield, db, perm.iid);
  return stats.defense <= 0 || perm.damage >= stats.defense || (perm.deathtouched && perm.damage > 0);
}

/**
 * Is this creature still on the battlefield and not lethally damaged? The
 * test a queued (targeted) Provoked effect re-checks before it resolves.
 */
export function survivesOnBattlefield(state: GameState, db: CardDb, iid: number): boolean {
  const perm = state.battlefield.find((p) => p.iid === iid);
  return perm !== undefined && !isLethallyDamaged(state, db, perm);
}

/**
 * State-based actions, run after every mutation batch and between damage
 * sub-steps. Loops until stable: a death can orphan an aura, fire a dies
 * trigger that drains life, change lord math, etc.
 *
 * `deferPlayerLoss` skips only the life check. It is for a check run between
 * held dies triggers of one batch: with no payable link those triggers run
 * back to back and the life check follows them all (rules.md, Hauntlink).
 *
 * Provoked (plan-first-dawn-engine.md, Part 1) fires here: each pass notes
 * the struck creatures it does not condemn and clears their mark, removes its
 * dead and fires their dies triggers, and then, in battlefield order, fires
 * the Provoked ability of each noted creature still on the battlefield and
 * still not lethally damaged. An untargeted Provoked effect resolves inline,
 * even beside a dies trigger held for a Hauntlink window (the ruled
 * exception); a targeted one queues its choice as a plain `chooseTarget`. A
 * pass that provoked anything is a changed pass. Each creature is provoked at
 * most once each turn, so a chain is bounded by the Provoked creatures on the
 * battlefield, and the pass limit (read each pass) grows by one for each of them.
 */
export function checkStateBased(state: GameState, db: CardDb, emit: Emit, options: { deferPlayerLoss?: boolean } = {}): void {
  // The limit is read each pass, so a Provoked creature that arrives mid-check
  // (a dies token, a Nine Lives return) extends it. With none it is 30.
  const passLimit = (): number => {
    let limit = BASE_PASSES;
    for (const perm of state.battlefield) if (cardHasProvoked(def(db, perm.cardId))) limit++;
    return limit;
  };
  for (let pass = 0; pass < passLimit(); pass++) {
    if (state.winner !== null) return;
    let changed = false;

    // Players at 0 or less life lose.
    const dead = options.deferPlayerLoss ? [] : ([0, 1] as const).filter((p) => state.players[p].life <= 0);
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
      if (isLethallyDamaged(state, db, perm)) doomedIids.add(perm.iid);
    }

    // Provoked: the struck creatures this pass does not condemn. Their mark is
    // cleared now, whatever the pass then does to them.
    const provoked: Permanent[] = [];
    for (const perm of state.battlefield) {
      if (!perm.struck) continue;
      delete perm.struck;
      if (!doomedIids.has(perm.iid)) provoked.push(perm);
    }

    // Orphaned Auras and linked Hauntlinks die with their departing host.
    for (const perm of state.battlefield) {
      if (perm.attachedTo === undefined) continue;
      const hostDeparting =
        doomedIids.has(perm.attachedTo) ||
        !state.battlefield.some((p) => p.iid === perm.attachedTo);
      if (!hostDeparting) continue;
      doomedIids.add(perm.iid);
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
    const observers = [...state.battlefield];
    const doomed = state.battlefield.filter((p) => doomedIids.has(p.iid));
    const fallen: Permanent[] = [];
    const graveyardEntries: { card: CardEntry; owner: 0 | 1 }[] = [];
    for (const perm of doomed) {
      const hostDeparting =
        perm.attachedTo !== undefined &&
        (doomedIids.has(perm.attachedTo) ||
          !state.battlefield.some((p) => p.iid === perm.attachedTo));
      if (hostDeparting && def(db, perm.cardId).hauntlink) {
        emit({
          e: 'hauntlinkBroken',
          linkIid: perm.iid,
          hostIid: perm.attachedTo!,
          cardId: perm.cardId,
          owner: perm.owner,
        });
      }
      if (destroyPermanent(
        state,
        db,
        perm,
        emit,
        (card, owner) => graveyardEntries.push({ card, owner }),
      )) {
        if (firesDiesForDestroy(state, db, perm)) fallen.push(perm);
        changed = true;
      }
    }
    for (const entry of graveyardEntries) {
      if (state.winner !== null) return;
      fireGraveyardTriggers(state, db, emit, entry.card, entry.owner);
    }
    fireBatchedDies(state, db, emit, fallen, 0, observers);
    if (fallen.length > 0) changed = true;

    // After the deaths and their dies triggers: each survivor still on the
    // battlefield and still not lethally damaged is provoked.
    for (const perm of provoked) {
      if (state.winner !== null) return;
      if (!survivesOnBattlefield(state, db, perm.iid)) continue;
      if (fireTriggers(state, db, emit, 'provoked', perm)) changed = true;
    }

    if (!changed) return;
  }
  throw new Error(
    'checkStateBased did not stabilize: ' +
      JSON.stringify({
        turn: state.turn,
        battlefield: state.battlefield.map((p) => ({
          iid: p.iid,
          cardId: p.cardId,
          controller: p.controller,
          damage: p.damage,
          plusOneCounters: p.plusOneCounters,
          overcharge: p.overcharge,
          attachedTo: p.attachedTo,
          def: getEffectiveStats(state.battlefield, db, p.iid).defense,
        })),
      }),
  );
}
