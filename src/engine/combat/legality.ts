import { RULES } from '../../config/rules';
import { boardOf, getEffectiveStats, isSummoningSick, type BoardInput } from '../statics';
import type { CardDb, CombatState, Permanent, PlayerId } from '../types';
import { def, isType } from '../types';

/**
 * Attack/block legality — the ONE place these rules live. The engine
 * validator, the legalActions enumerator, the UI highlighting, and the AI's
 * block construction all call in here. Operates on the battlefield array so
 * it works on redacted views. `board` is the state or view (a bare
 * battlefield also works, reading the Mandate as unclaimed).
 */

export function canAttack(
  board: BoardInput,
  db: CardDb,
  active: PlayerId,
  iid: number,
): boolean {
  const battlefield = boardOf(board).battlefield;
  const perm = battlefield.find((p) => p.iid === iid);
  if (!perm || perm.controller !== active || perm.tapped) return false;
  const d = def(db, perm.cardId);
  if (!isType(d, 'creature')) return false;
  const stats = getEffectiveStats(board, db, iid);
  if (stats.keywords.has('bulwark')) return false;
  if (isSummoningSick(board, db, perm)) return false;
  return true;
}

/** Tap-ability source eligibility, shared by main-phase activation callers. */
export function canActivate(
  board: BoardInput,
  db: CardDb,
  perm: Permanent,
  player: PlayerId,
): boolean {
  const battlefield = boardOf(board).battlefield;
  const source = battlefield.find((candidate) => candidate.iid === perm.iid);
  return !!source && source.controller === player && !!def(db, source.cardId).activated &&
    !source.tapped && !isSummoningSick(board, db, source);
}

export function canBlock(
  board: BoardInput,
  db: CardDb,
  defender: PlayerId,
  blockerIid: number,
  attackerIid: number,
): boolean {
  const battlefield = boardOf(board).battlefield;
  const blocker = battlefield.find((p) => p.iid === blockerIid);
  const attacker = battlefield.find((p) => p.iid === attackerIid);
  if (!blocker || !attacker) return false;
  if (blocker.controller !== defender || blocker.tapped) return false;
  if (!isType(def(db, blocker.cardId), 'creature')) return false;
  // Summoning sickness does not restrict blocking.
  const atkStats = getEffectiveStats(board, db, attackerIid);
  if (atkStats.keywords.has('skyborne')) {
    const blkStats = getEffectiveStats(board, db, blockerIid);
    if (!blkStats.keywords.has('skyborne') && !blkStats.keywords.has('wardingGaze')) return false;
  }
  return true;
}

/** The minimum final assignment size for one attacker. */
export function minimumBlockersForAttacker(
  board: BoardInput,
  db: CardDb,
  attackerIid: number,
): number {
  return getEffectiveStats(board, db, attackerIid).keywords.has('dreaded') ? 2 : 1;
}

export function validateAttackers(
  board: BoardInput,
  db: CardDb,
  active: PlayerId,
  attackers: readonly number[],
): string | null {
  const seen = new Set<number>();
  for (const iid of attackers) {
    if (seen.has(iid)) return `duplicate attacker ${iid}`;
    seen.add(iid);
    if (!canAttack(board, db, active, iid)) return `illegal attacker ${iid}`;
  }
  // Rage is a requirement, not a permission, so it is checked over the whole
  // declaration rather than per attacker: the empty declaration that skips
  // combat is exactly the one a compelled attacker has to reject.
  for (const iid of compelledAttackers(board, db, active)) {
    if (!seen.has(iid)) return `attacker ${iid} has Rage and must attack`;
  }
  return null;
}

export function validateBlocks(
  board: BoardInput,
  db: CardDb,
  defender: PlayerId,
  combat: CombatState,
  blocks: readonly { blocker: number; attacker: number }[],
): string | null {
  const battlefield = boardOf(board).battlefield;
  const blockersSeen = new Set<number>();
  const perAttacker = new Map<number, number>();
  const liveAttackers = new Set(
    combat.attackers.filter((iid) => battlefield.some((p) => p.iid === iid)),
  );
  for (const b of blocks) {
    if (blockersSeen.has(b.blocker)) return `blocker ${b.blocker} assigned twice`;
    blockersSeen.add(b.blocker);
    if (!liveAttackers.has(b.attacker)) return `${b.attacker} is not an attacker`;
    if (!canBlock(board, db, defender, b.blocker, b.attacker))
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
    const minimum = minimumBlockersForAttacker(board, db, attacker);
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
  board: BoardInput,
  db: CardDb,
  defender: PlayerId,
  combat: CombatState,
): { blocker: number; canBlock: number[] }[] {
  const battlefield = boardOf(board).battlefield;
  const out: { blocker: number; canBlock: number[] }[] = [];
  for (const perm of battlefield) {
    if (perm.controller !== defender || perm.tapped) continue;
    if (!isType(def(db, perm.cardId), 'creature')) continue;
    const targets = combat.attackers.filter(
      (a) =>
        battlefield.some((p) => p.iid === a) &&
        canBlock(board, db, defender, perm.iid, a),
    );
    if (targets.length > 0) out.push({ blocker: perm.iid, canBlock: targets });
  }
  return out;
}

/** Eligible attackers for the active player (UI highlighting, AI, enumerator). */
export function eligibleAttackers(
  board: BoardInput,
  db: CardDb,
  active: PlayerId,
): number[] {
  const battlefield = boardOf(board).battlefield;
  return battlefield
    .filter((p) => canAttack(board, db, active, p.iid))
    .map((p) => p.iid);
}

/**
 * Rage: the attackers the active player has no choice about. "Attacks each
 * turn IF ABLE" is the whole rule, so this is deliberately a filter over
 * `eligibleAttackers` and never a second legality path. Anything that makes a
 * creature unable to attack — tapped, summoning sick without Warcry, Bulwark
 * (which reads "cannot attack" and therefore wins), or simply no longer on the
 * battlefield — removes the compulsion with it, because such a creature was
 * never eligible to begin with.
 *
 * Every consumer that lets a player or an AI CHOOSE a subset of attackers must
 * intersect against this: the enumerator, so illegal subsets are never offered;
 * the engine's declare validation, so a hand-built action cannot skip the
 * compulsion; and the AI's attack planner, so its greedy descent cannot drop a
 * compelled attacker.
 */
export function compelledAttackers(
  board: BoardInput,
  db: CardDb,
  active: PlayerId,
): number[] {
  return eligibleAttackers(board, db, active).filter((iid) =>
    getEffectiveStats(board, db, iid).keywords.has('rage'),
  );
}
