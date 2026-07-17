import { RULES } from '../../config/rules';
import { getEffectiveStats, isSummoningSick } from '../statics';
import type { CardDb, CombatState, Permanent, PlayerId } from '../types';
import { def, isType } from '../types';

/**
 * Attack/block legality — the ONE place these rules live. The engine
 * validator, the legalActions enumerator, the UI highlighting, and the AI's
 * block construction all call in here. Operates on the battlefield array so
 * it works on redacted views.
 */

export function canAttack(
  battlefield: readonly Permanent[],
  db: CardDb,
  active: PlayerId,
  iid: number,
): boolean {
  const perm = battlefield.find((p) => p.iid === iid);
  if (!perm || perm.controller !== active || perm.tapped) return false;
  const d = def(db, perm.cardId);
  if (!isType(d, 'creature')) return false;
  const stats = getEffectiveStats(battlefield, db, iid);
  if (stats.keywords.has('bulwark')) return false;
  if (isSummoningSick(battlefield, db, perm)) return false;
  return true;
}

export function canBlock(
  battlefield: readonly Permanent[],
  db: CardDb,
  defender: PlayerId,
  blockerIid: number,
  attackerIid: number,
): boolean {
  const blocker = battlefield.find((p) => p.iid === blockerIid);
  const attacker = battlefield.find((p) => p.iid === attackerIid);
  if (!blocker || !attacker) return false;
  if (blocker.controller !== defender || blocker.tapped) return false;
  if (!isType(def(db, blocker.cardId), 'creature')) return false;
  // Summoning sickness does not restrict blocking.
  const atkStats = getEffectiveStats(battlefield, db, attackerIid);
  if (atkStats.keywords.has('skyborne')) {
    const blkStats = getEffectiveStats(battlefield, db, blockerIid);
    if (!blkStats.keywords.has('skyborne') && !blkStats.keywords.has('wardingGaze')) return false;
  }
  return true;
}

/** The minimum final assignment size for one attacker. */
export function minimumBlockersForAttacker(
  battlefield: readonly Permanent[],
  db: CardDb,
  attackerIid: number,
): number {
  return getEffectiveStats(battlefield, db, attackerIid).keywords.has('dreaded') ? 2 : 1;
}

export function validateAttackers(
  battlefield: readonly Permanent[],
  db: CardDb,
  active: PlayerId,
  attackers: readonly number[],
): string | null {
  const seen = new Set<number>();
  for (const iid of attackers) {
    if (seen.has(iid)) return `duplicate attacker ${iid}`;
    seen.add(iid);
    if (!canAttack(battlefield, db, active, iid)) return `illegal attacker ${iid}`;
  }
  return null;
}

export function validateBlocks(
  battlefield: readonly Permanent[],
  db: CardDb,
  defender: PlayerId,
  combat: CombatState,
  blocks: readonly { blocker: number; attacker: number }[],
): string | null {
  const blockersSeen = new Set<number>();
  const perAttacker = new Map<number, number>();
  const liveAttackers = new Set(
    combat.attackers.filter((iid) => battlefield.some((p) => p.iid === iid)),
  );
  for (const b of blocks) {
    if (blockersSeen.has(b.blocker)) return `blocker ${b.blocker} assigned twice`;
    blockersSeen.add(b.blocker);
    if (!liveAttackers.has(b.attacker)) return `${b.attacker} is not an attacker`;
    if (!canBlock(battlefield, db, defender, b.blocker, b.attacker))
      return `illegal block ${b.blocker} -> ${b.attacker}`;
    const n = (perAttacker.get(b.attacker) ?? 0) + 1;
    if (n > RULES.maxBlockersPerAttacker)
      return `more than ${RULES.maxBlockersPerAttacker} blockers on ${b.attacker}`;
    perAttacker.set(b.attacker, n);
  }
  // blockOptions() intentionally exposes each individually legal blocker so
  // incremental UI/AI flows can show a lone block-in-progress. A submitted
  // action is final, however, so Dreaded's minimum is enforced here.
  for (const [attacker, count] of perAttacker) {
    const minimum = minimumBlockersForAttacker(battlefield, db, attacker);
    if (count < minimum) return `${attacker} requires at least ${minimum} blockers`;
  }
  return null;
}

/**
 * For UI highlighting and AI block construction. Each pair is individually
 * legal. A lone Dreaded pair is intentionally shown as a partial assignment;
 * validateBlocks rejects it when the player submits the final assignment.
 */
export function blockOptions(
  battlefield: readonly Permanent[],
  db: CardDb,
  defender: PlayerId,
  combat: CombatState,
): { blocker: number; canBlock: number[] }[] {
  const out: { blocker: number; canBlock: number[] }[] = [];
  for (const perm of battlefield) {
    if (perm.controller !== defender || perm.tapped) continue;
    if (!isType(def(db, perm.cardId), 'creature')) continue;
    const targets = combat.attackers.filter(
      (a) =>
        battlefield.some((p) => p.iid === a) &&
        canBlock(battlefield, db, defender, perm.iid, a),
    );
    if (targets.length > 0) out.push({ blocker: perm.iid, canBlock: targets });
  }
  return out;
}

/** Eligible attackers for the active player (UI highlighting, AI, enumerator). */
export function eligibleAttackers(
  battlefield: readonly Permanent[],
  db: CardDb,
  active: PlayerId,
): number[] {
  return battlefield
    .filter((p) => canAttack(battlefield, db, active, p.iid))
    .map((p) => p.iid);
}
