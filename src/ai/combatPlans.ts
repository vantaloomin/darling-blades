import { canBlock, eligibleAttackers } from '../engine/combat/legality';
import { getEffectiveStats } from '../engine/statics';
import type { CardDb, CombatState, Permanent, PlayerId } from '../engine/types';
import { def, isType, opponentOf } from '../engine/types';
import { DEFAULT_PERSONALITY, type Personality } from './personality';
import { permValue } from './value';

/**
 * Combat planning shared by Medium and Hard. Works on public information
 * only (battlefield array from a redacted view).
 */

interface Combatant {
  iid: number;
  attack: number;
  defense: number; // effective minus marked damage
  deathtouch: boolean;
  firstStrike: boolean;
  trample: boolean;
  lifelink: boolean;
}

function combatant(bf: readonly Permanent[], db: CardDb, iid: number, trickBuff = 0): Combatant {
  const stats = getEffectiveStats(bf, db, iid);
  const perm = bf.find((p) => p.iid === iid)!;
  return {
    iid,
    attack: stats.attack + trickBuff,
    defense: stats.defense - perm.damage + trickBuff,
    deathtouch: stats.keywords.has('deathblade'),
    firstStrike: stats.keywords.has('firstBlade'),
    trample: stats.keywords.has('overrun'),
    lifelink: stats.keywords.has('bloodoath'),
  };
}

/** Does the striker kill the victim in a straight exchange? */
function kills(striker: Combatant, victim: Combatant): boolean {
  if (striker.attack <= 0) return false;
  if (striker.deathtouch) return true;
  // first-strike wins the race if it kills before the victim strikes
  return striker.attack >= victim.defense;
}

function untappedBlockers(
  bf: readonly Permanent[],
  db: CardDb,
  defender: PlayerId,
): Permanent[] {
  return bf.filter(
    (p) => p.controller === defender && !p.tapped && isType(def(db, p.cardId), 'creature'),
  );
}

/** Untapped mana sources the opponent has open (the trick-risk signal). */
export function openMana(bf: readonly Permanent[], db: CardDb, player: PlayerId): number {
  return bf.filter(
    (p) => p.controller === player && !p.tapped && (def(db, p.cardId).manaAbility?.length ?? 0) > 0,
  ).length;
}

/**
 * Choose attackers: unblockable and un-profitably-blockable creatures always
 * attack; contested ones attack when the expected gain (damage upside vs the
 * defender's best block) is positive. `trickBuff` inflates defenders when a
 * combat trick is plausible (caller decides — open mana AND cards in hand).
 */
/**
 * Score an attack set by simulating the defender's best response with OUR
 * own block heuristic (self-play model), then valuing damage-through plus
 * the trade swings. Blocker exhaustion falls out naturally: 7 attackers vs
 * 4 blockers means 3 connect no matter what.
 */
function scoreAttack(
  bf: readonly Permanent[],
  db: CardDb,
  me: PlayerId,
  oppLife: number,
  trickBuff: number,
  attackers: number[],
  myLife = 20,
  pers: Personality = DEFAULT_PERSONALITY,
): number {
  if (attackers.length === 0) return 0;
  const opp = opponentOf(me);
  const virtualCombat: CombatState = {
    attackers,
    blocks: [],
    phase: 'attackersDeclared',
    damagePrevented: false,
  };
  // The opponent model stays NEUTRAL: we don't know their personality, so we
  // simulate their blocks with the default heuristic.
  const blocks = chooseBlocks(bf, db, opp, oppLife, virtualCombat, trickBuff, DEFAULT_PERSONALITY);
  const myCreatures = bf.filter(
    (p) => p.controller === me && isType(def(db, p.cardId), 'creature'),
  ).length;
  const oppCreatures = bf.filter(
    (p) => p.controller === opp && isType(def(db, p.cardId), 'creature'),
  ).length;
  let dmgWeight = oppLife <= 12 ? 0.9 : 0.45;
  if (myCreatures - oppCreatures >= 2) dmgWeight += 0.2; // press an advantage
  dmgWeight *= pers.aggression;

  // Defensive holdback: when we're the one in danger, tapping would-be
  // blockers has a real cost.
  const oppPower = bf
    .filter((p) => p.controller === opp && isType(def(db, p.cardId), 'creature'))
    .reduce((s, p) => s + combatant(bf, db, p.iid).attack, 0);
  const holdbackPenalty =
    (myLife <= 10 && oppPower >= myLife * 0.6 ? 0.4 : myLife <= 14 && oppPower >= myLife ? 0.25 : 0) *
    pers.holdback;
  let total = -holdbackPenalty * attackers.length;
  for (const iid of attackers) {
    const A = combatant(bf, db, iid);
    const myBlockers = blocks.filter((b) => b.attacker === iid).map((b) => b.blocker);
    if (myBlockers.length === 0) {
      total += A.attack * dmgWeight;
      if (A.attack >= oppLife) total += 100; // lethal connection
      continue;
    }
    const combinedPower = myBlockers.reduce(
      (s, b) => s + combatant(bf, db, b, trickBuff).attack,
      0,
    );
    const iDie =
      (combinedPower >= A.defense ||
        myBlockers.some((b) => combatant(bf, db, b, trickBuff).deathtouch)) &&
      !(
        A.firstStrike &&
        myBlockers.every((b) => {
          const bC = combatant(bf, db, b, trickBuff);
          return !bC.firstStrike && kills(A, bC) && myBlockers.length === 1;
        })
      );
    // attacker kills the cheapest blocker it can (auto-assignment)
    const killable = myBlockers
      .map((b) => combatant(bf, db, b, trickBuff))
      .filter((bC) => kills(A, bC));
    const killValue =
      killable.length > 0
        ? Math.min(...killable.map((bC) => permValue(bf, db, bC.iid)))
        : 0;
    total += killValue - (iDie ? permValue(bf, db, iid) : 0);
    if (A.trample && myBlockers.length === 1) {
      const overflow = A.attack - combatant(bf, db, myBlockers[0], trickBuff).defense;
      if (overflow > 0) total += overflow * dmgWeight;
    }
  }
  return total;
}

export function chooseAttackers(
  bf: readonly Permanent[],
  db: CardDb,
  me: PlayerId,
  oppLife: number,
  trickBuff: number,
  myLife = 20,
  pers: Personality = DEFAULT_PERSONALITY,
): number[] {
  const opp = opponentOf(me);
  const eligible = eligibleAttackers(bf, db, me).filter(
    (iid) => combatant(bf, db, iid).attack > 0,
  );
  if (eligible.length === 0) return [];
  const defenders = untappedBlockers(bf, db, opp);

  // Lethal check: assume each defender absorbs the biggest remaining attacker.
  const powers = eligible
    .map((iid) => combatant(bf, db, iid).attack)
    .sort((a, b) => b - a);
  const absorbed = powers.slice(0, defenders.length).reduce((s, p) => s + p, 0);
  const through = powers.reduce((s, p) => s + p, 0) - absorbed;
  if (through >= oppLife) return eligible; // all-in for the kill

  // Greedy descent: start from all-in, drop the attacker whose removal most
  // improves the simulated outcome, until no single drop helps.
  let current = [...eligible];
  let best = scoreAttack(bf, db, me, oppLife, trickBuff, current, myLife, pers);
  for (let iter = 0; iter < eligible.length; iter++) {
    let improved = false;
    for (const drop of [...current]) {
      const candidate = current.filter((iid) => iid !== drop);
      const score = scoreAttack(bf, db, me, oppLife, trickBuff, candidate, myLife, pers);
      if (score > best + 0.01) {
        best = score;
        current = candidate;
        improved = true;
        break;
      }
    }
    if (!improved) break;
  }
  // `attackThreshold` replaces the `best > 0` return gate (default 0).
  return best > pers.attackThreshold ? current : [];
}

/**
 * Greedy block assignment (the plan's algorithm): positive-score single
 * blocks, chump blocking under lethal pressure, double-blocks on big
 * attackers, and a trick-risk margin that drops blowout-prone blocks.
 */
export function chooseBlocks(
  bf: readonly Permanent[],
  db: CardDb,
  me: PlayerId,
  myLife: number,
  combat: CombatState,
  trickBuff: number,
  pers: Personality = DEFAULT_PERSONALITY,
): { blocker: number; attacker: number }[] {
  const attackers = combat.attackers.filter((iid) => bf.some((p) => p.iid === iid));
  const myCreatures = untappedBlockers(bf, db, me);
  if (attackers.length === 0 || myCreatures.length === 0) return [];

  const incoming = attackers.reduce((s, iid) => s + combatant(bf, db, iid).attack, 0);
  const lethalMode = incoming >= myLife;
  const lifePressure =
    (myLife <= 8 || incoming >= myLife * 0.5 ? 1.0 : myLife <= 14 ? 0.55 : 0.3) *
    pers.blockLifePressure;

  interface Pair {
    blocker: number;
    attacker: number;
    score: number;
  }
  const pairs: Pair[] = [];
  for (const B of myCreatures) {
    for (const aIid of attackers) {
      if (!canBlock(bf, db, me, B.iid, aIid)) continue;
      const A = combatant(bf, db, aIid, trickBuff);
      const bC = combatant(bf, db, B.iid);
      const iKill = kills(bC, A) && !(A.firstStrike && !bC.firstStrike && kills(A, bC));
      const iDie = kills(A, bC);
      const score =
        (iKill ? permValue(bf, db, aIid) : 0) -
        (iDie ? permValue(bf, db, B.iid) : 0) +
        combatant(bf, db, aIid).attack * lifePressure;
      pairs.push({ blocker: B.iid, attacker: aIid, score });
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  const blocks: { blocker: number; attacker: number }[] = [];
  const usedBlockers = new Set<number>();
  const blockedAttackers = new Set<number>();
  for (const pair of pairs) {
    if (usedBlockers.has(pair.blocker) || blockedAttackers.has(pair.attacker)) continue;
    // `blockThreshold` replaces the `pair.score > 0` gate (default 0).
    if (pair.score > pers.blockThreshold || lethalMode) {
      blocks.push({ blocker: pair.blocker, attacker: pair.attacker });
      usedBlockers.add(pair.blocker);
      blockedAttackers.add(pair.attacker);
    }
  }

  // Double-block search on high-value unblocked attackers.
  for (const aIid of attackers) {
    if (blockedAttackers.has(aIid)) continue;
    if (permValue(bf, db, aIid) < 4) continue;
    const A = combatant(bf, db, aIid, trickBuff);
    const free = myCreatures.filter(
      (B) => !usedBlockers.has(B.iid) && canBlock(bf, db, me, B.iid, aIid),
    );
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const b1 = combatant(bf, db, free[i].iid);
        const b2 = combatant(bf, db, free[j].iid);
        const killsIt = b1.attack + b2.attack >= A.defense || b1.deathtouch || b2.deathtouch;
        if (!killsIt) continue;
        // attacker kills at most one of them (cheapest-kill-first auto-assign)
        const cheaper = Math.min(permValue(bf, db, free[i].iid), permValue(bf, db, free[j].iid));
        if (permValue(bf, db, aIid) - cheaper > 1) {
          blocks.push(
            { blocker: free[i].iid, attacker: aIid },
            { blocker: free[j].iid, attacker: aIid },
          );
          usedBlockers.add(free[i].iid);
          usedBlockers.add(free[j].iid);
          blockedAttackers.add(aIid);
          i = free.length; // break both loops
          break;
        }
      }
    }
  }
  return blocks;
}
