import { canBlock, compelledAttackers, eligibleAttackers } from '../engine/combat/legality';
import { getEffectiveStats } from '../engine/statics';
import type { CardDb, CombatState, Permanent, PlayerId } from '../engine/types';
import { def, isType, opponentOf } from '../engine/types';
import { DEFAULT_PERSONALITY, type Personality } from './personality';
import { dawnSelfBleed, permValue } from './value';

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
  twinBlades: boolean;
  sentinel: boolean;
  damagePrevented: boolean;
  trample: boolean;
  lifelink: boolean;
  dreaded: boolean;
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
    twinBlades: stats.keywords.has('twinBlades'),
    sentinel: stats.keywords.has('sentinel'),
    damagePrevented: perm.combatDamagePrevented === true,
    trample: stats.keywords.has('overrun'),
    lifelink: stats.keywords.has('bloodoath'),
    dreaded: stats.keywords.has('dreaded'),
  };
}

const fullDamage = (c: Combatant): number => Math.max(0, c.attack) * (c.twinBlades ? 2 : 1);

/** Same sub-step eligibility as engine/combat/damage.ts: FS + Twin = two hits. */
function strikesInStep(c: Combatant, first: boolean): boolean {
  return first ? c.firstStrike || c.twinBlades : c.twinBlades || !c.firstStrike;
}

/** One hit of a combat exchange (module-level so the hot loop allocates no
 * closures). */
function strike(source: Combatant, target: Combatant, amount: number, dying: Set<number>): void {
  if (amount <= 0 || target.damagePrevented) return;
  target.defense -= amount;
  if (source.deathtouch || target.defense <= 0) dying.add(target.iid);
}

/** The damage the striker must assign to make this blocker lethal. */
function lethalNeed(striker: Combatant, b: Combatant): number {
  return striker.deathtouch ? 1 : Math.max(1, b.defense);
}

/** Public-stat exchange, with simultaneous hits and casualties between steps.
 * Carry marked damage forward and use the engine's cheapest-lethal assignment.
 * Effective stats stay fixed for this heuristic; continuous effects changing
 * after a death and triggered abilities remain the engine sim's job. */
function combatExchange(
  attacker: Combatant, blockers: Combatant[], firstStrikeDone = false, wasBlocked = true,
): { damage: number; dying: number[] } {
  const a = { ...attacker };
  const defenders = blockers.map((b) => ({ ...b }));
  const dying = new Set<number>();
  let damage = 0;
  for (const first of [true, false]) {
    if (first && firstStrikeDone) continue;
    if (dying.has(a.iid)) break;
    const living = defenders.filter((b) => !dying.has(b.iid));
    // Snapshot return hits BEFORE assigning damage: dying in this sub-step
    // cannot cancel a simultaneous hit, only a hit in the following step.
    const returning = living.filter((b) => strikesInStep(b, first));
    if (strikesInStep(a, first)) {
      let power = Math.max(0, a.attack);
      const ordered = [...living].sort((x, y) => lethalNeed(a, x) - lethalNeed(a, y));
      for (let i = 0; i < ordered.length && power > 0; i++) {
        const b = ordered[i];
        const amount = a.trample || i < ordered.length - 1 ? Math.min(power, lethalNeed(a, b)) : power;
        strike(a, b, amount, dying);
        power -= amount;
      }
      // An attacker whose first hit killed every blocker is still blocked.
      if (!wasBlocked || a.trample) damage += power;
    }
    for (const b of returning) strike(b, a, Math.max(0, b.attack), dying);
  }
  return { damage, dying: [...dying] };
}

/** Does the striker kill the victim before or during their straight exchange? */
function kills(striker: Combatant, victim: Combatant): boolean {
  return combatExchange(striker, [victim]).dying.includes(victim.iid);
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

/**
 * One board's pure reads, remembered for the length of one planning call.
 *
 * `getEffectiveStats`, `permValue` and `canBlock` are pure functions of the
 * battlefield array and the card db, and a planning call never mutates the
 * board it plans on, so a remembered read is exactly the value a fresh call
 * would return: the memo changes how often the reads run, never what they
 * return. It is the wide-board fix (1.9 lane F): `chooseAttackers` scores up
 * to n squared attack sets, and each score re-ran the block heuristic, which
 * recomputed every creature's effective stats (a full static-layer walk of the
 * battlefield) for every blocker and attacker pair. A memo lives for one
 * exported call and is never shared across boards.
 */
/** The inner map under `key`, created on first use. Nested maps key the memo
 * by whole iids, so no two keys can ever collide. */
function level<K, V>(map: Map<K, Map<number, V>>, key: K): Map<number, V> {
  let inner = map.get(key);
  if (!inner) {
    inner = new Map();
    map.set(key, inner);
  }
  return inner;
}

class BoardMemo {
  private readonly combatants = new Map<number, Map<number, Combatant>>();
  private readonly values = new Map<number, number>();
  /** defender -> blocker -> attacker. */
  private readonly blockable = new Map<PlayerId, Map<number, Map<number, boolean>>>();
  /** trickBuff -> blocker -> attacker. */
  private readonly duels = new Map<number, Map<number, Map<number, { iKill: boolean; iDie: boolean }>>>();
  private readonly untapped = new Map<PlayerId, Permanent[]>();
  private readonly weights = new Map<PlayerId, { pressing: boolean; oppPower: number }>();

  constructor(readonly bf: readonly Permanent[], readonly db: CardDb) {}

  combatant(iid: number, trickBuff = 0): Combatant {
    const byIid = level(this.combatants, trickBuff);
    let c = byIid.get(iid);
    if (!c) {
      c = combatant(this.bf, this.db, iid, trickBuff);
      byIid.set(iid, c);
    }
    return c;
  }

  value(iid: number): number {
    let v = this.values.get(iid);
    if (v === undefined) {
      v = permValue(this.bf, this.db, iid);
      this.values.set(iid, v);
    }
    return v;
  }

  canBlock(defender: PlayerId, blocker: number, attacker: number): boolean {
    const byAttacker = level(level(this.blockable, defender), blocker);
    let ok = byAttacker.get(attacker);
    if (ok === undefined) {
      ok = canBlock(this.bf, this.db, defender, blocker, attacker);
      byAttacker.set(attacker, ok);
    }
    return ok;
  }

  /** The straight exchange between one blocker and one (possibly
   * trick-buffed) attacker, from the blocker's side. */
  duel(blocker: number, attacker: number, trickBuff: number): { iKill: boolean; iDie: boolean } {
    const byAttacker = level(level(this.duels, trickBuff), blocker);
    let out = byAttacker.get(attacker);
    if (!out) {
      const A = this.combatant(attacker, trickBuff);
      const bC = this.combatant(blocker);
      out = { iKill: kills(bC, A), iDie: kills(A, bC) };
      byAttacker.set(attacker, out);
    }
    return out;
  }

  untappedBlockers(defender: PlayerId): Permanent[] {
    let out = this.untapped.get(defender);
    if (!out) {
      out = untappedBlockers(this.bf, this.db, defender);
      this.untapped.set(defender, out);
    }
    return out;
  }

  weightInputs(me: PlayerId): { pressing: boolean; oppPower: number } {
    let out = this.weights.get(me);
    if (!out) {
      out = attackWeightInputs(this.bf, this.db, me);
      this.weights.set(me, out);
    }
    return out;
  }
}

/** Untapped mana sources the opponent has open (the trick-risk signal). */
export function openMana(bf: readonly Permanent[], db: CardDb, player: PlayerId): number {
  return bf.filter(
    (p) => p.controller === player && !p.tapped && (def(db, p.cardId).manaAbility?.length ?? 0) > 0,
  ).length;
}

/**
 * The board inputs `scoreAttack` weighs by, besides the life totals: whether
 * we have two or more creatures than the defender (pressing an advantage)
 * and the defender's total combat damage (the holdback threat).
 */
export function attackWeightInputs(
  bf: readonly Permanent[], db: CardDb, me: PlayerId,
): { pressing: boolean; oppPower: number } {
  const opp = opponentOf(me);
  const creatures = bf.filter((p) => isType(def(db, p.cardId), 'creature'));
  const mine = creatures.filter((p) => p.controller === me).length;
  const theirs = creatures.filter((p) => p.controller === opp);
  return {
    pressing: mine - theirs.length >= 2,
    oppPower: theirs.reduce((sum, p) => sum + fullDamage(combatant(bf, db, p.iid)), 0),
  };
}

/** What these attackers can deal (twinBlades twice): all of them unblocked,
 * the biggest one alone, and the Overrun ones together (the most a changed
 * block can add as spill). */
export function attackReach(
  bf: readonly Permanent[], db: CardDb, attackers: readonly number[],
): { total: number; biggest: number; overrun: number } {
  let total = 0;
  let biggest = 0;
  let overrun = 0;
  for (const iid of attackers) {
    const c = combatant(bf, db, iid);
    const damage = fullDamage(c);
    total += damage;
    biggest = Math.max(biggest, damage);
    if (c.trample) overrun += damage;
  }
  return { total, biggest, overrun };
}

/**
 * Damage through an all-in attack against a cautious defender rather than
 * the greedy block model: attackers are answered biggest first, each by an
 * untapped creature that can still block it (the toughest against Overrun,
 * the weakest otherwise, so a chump costs least), and only unblocked damage
 * and Overrun spill over the blocker's toughness gets through. Dreaded is
 * treated as blockable by one, which only makes the defender stronger.
 */
export function cautiousThrough(
  bf: readonly Permanent[], db: CardDb, attackers: readonly number[], defender: PlayerId,
): number {
  const ordered = attackers.map((iid) => combatant(bf, db, iid)).filter((c) => c.attack > 0)
    .sort((a, b) => fullDamage(b) - fullDamage(a));
  const free = untappedBlockers(bf, db, defender).map((p) => combatant(bf, db, p.iid));
  let through = 0;
  for (const a of ordered) {
    const able = free.filter((b) => canBlock(bf, db, defender, b.iid, a.iid));
    if (able.length === 0) {
      through += fullDamage(a);
      continue;
    }
    const blocker = able.reduce((x, y) => a.trample ? (y.defense > x.defense ? y : x) : (y.defense < x.defense ? y : x));
    free.splice(free.indexOf(blocker), 1);
    if (a.trample) through += Math.max(0, fullDamage(a) - Math.max(0, blocker.defense));
  }
  return through;
}

/**
 * Choose attackers: unblockable and un-profitably-blockable creatures always
 * attack; contested ones attack when the expected gain (damage upside vs the
 * defender's best block) is positive. `trickBuff` inflates defenders when a
 * combat trick is plausible (caller decides — open mana AND cards in hand).
 * `weightBoard` passes through to every `scoreAttack` call (see there).
 */
/**
 * Score an attack set by simulating the defender's best response with OUR
 * own block heuristic (self-play model), then valuing damage-through plus
 * the trade swings. Blocker exhaustion falls out naturally: 7 attackers vs
 * 4 blockers means 3 connect no matter what.
 *
 * `weightBoard` is the board whose creature counts and opposing power set the
 * damage weight and the holdback penalty; it defaults to `bf`. The pre-combat
 * Duty forecast pins it (with the life totals) to the board before the Duty,
 * so a kill or a ping prices only what it changes in the fight itself.
 */
export function scoreAttack(
  bf: readonly Permanent[],
  db: CardDb,
  me: PlayerId,
  oppLife: number,
  trickBuff: number,
  attackers: number[],
  myLife = 20,
  pers: Personality = DEFAULT_PERSONALITY,
  weightBoard: readonly Permanent[] = bf,
): number {
  if (attackers.length === 0) return 0;
  const memo = new BoardMemo(bf, db);
  return scoreAttackWith(memo, weightBoard === bf ? memo : new BoardMemo(weightBoard, db), me, oppLife,
    trickBuff, attackers, myLife, pers);
}

/** `scoreAttack` on memoised reads: `memo` is the board fought on,
 * `weights` the board that sets the damage weight and holdback penalty. */
function scoreAttackWith(
  memo: BoardMemo,
  weights: BoardMemo,
  me: PlayerId,
  oppLife: number,
  trickBuff: number,
  attackers: number[],
  myLife: number,
  pers: Personality,
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
  const blocks = chooseBlocksWith(memo, opp, oppLife, virtualCombat, trickBuff, DEFAULT_PERSONALITY);
  const { pressing, oppPower } = weights.weightInputs(me);
  let dmgWeight = oppLife <= 12 ? 0.9 : 0.45;
  if (pressing) dmgWeight += 0.2; // press an advantage
  dmgWeight *= pers.aggression;

  // Defensive holdback: when we're the one in danger, tapping would-be
  // blockers has a real cost.
  const holdbackPenalty =
    (myLife <= 10 && oppPower >= myLife * 0.6 ? 0.4 : myLife <= 14 && oppPower >= myLife ? 0.25 : 0) *
    pers.holdback;
  let total = 0;
  for (const iid of attackers) {
    const A = memo.combatant(iid);
    if (!A.sentinel) total -= holdbackPenalty;
    const myBlockers = blocks.filter((b) => b.attacker === iid).map((b) => b.blocker);
    if (myBlockers.length === 0) {
      total += fullDamage(A) * dmgWeight;
      if (fullDamage(A) >= oppLife) total += 100; // lethal connection
      continue;
    }
    const defenders = myBlockers.map((b) => memo.combatant(b, trickBuff));
    const exchange = combatExchange(A, defenders);
    const iDie = exchange.dying.includes(iid);
    // attacker kills the cheapest blocker it can (auto-assignment)
    const killable = defenders.filter((bC) => exchange.dying.includes(bC.iid));
    const killValue =
      killable.length > 0
        ? Math.min(...killable.map((bC) => memo.value(bC.iid)))
        : 0;
    total += killValue - (iDie ? memo.value(iid) : 0);
    if (A.trample && myBlockers.length === 1) {
      const overflow = exchange.damage;
      if (overflow > 0) total += overflow * dmgWeight;
    }
  }
  return total;
}

/** Public combat projection for fog, tap and rescue decisions. */
export function combatForecast(
  bf: readonly Permanent[], db: CardDb, combat: CombatState,
): { damage: number; dying: number[] } {
  const result = { damage: 0, dying: [] as number[] };
  if (combat.damagePrevented) return result;
  const exists = (iid: number): boolean => bf.some((p) => p.iid === iid);
  for (const iid of combat.attackers.filter(exists)) {
    const a = combatant(bf, db, iid);
    const assigned = combat.blocks.filter((b) => b.attacker === iid);
    const blockers = assigned.map((b) => b.blocker).filter(exists).map((b) => combatant(bf, db, b));
    const exchange = combatExchange(a, blockers, combat.phase === 'firstStrikeDone', assigned.length > 0);
    result.damage += exchange.damage;
    result.dying.push(...exchange.dying);
  }
  return result;
}

export function chooseAttackers(
  bf: readonly Permanent[],
  db: CardDb,
  me: PlayerId,
  oppLife: number,
  trickBuff: number,
  myLife = 20,
  pers: Personality = DEFAULT_PERSONALITY,
  weightBoard: readonly Permanent[] = bf,
): number[] {
  const opp = opponentOf(me);
  const memo = new BoardMemo(bf, db);
  const weights = weightBoard === bf ? memo : new BoardMemo(weightBoard, db);
  // Rage removes the choice, so the planner is not allowed to score these away.
  // Read from the UNFILTERED legality call on purpose: a compelled attacker
  // with 0 power is still compelled, and the `attack > 0` filter below would
  // otherwise drop it and hand the engine an illegal declaration.
  const compelled = compelledAttackers(bf, db, me);
  const withCompelled = (chosen: readonly number[]): number[] => {
    if (compelled.length === 0) return [...chosen];
    const keep = new Set([...chosen, ...compelled]);
    return eligibleAttackers(bf, db, me).filter((iid) => keep.has(iid));
  };
  const eligible = eligibleAttackers(bf, db, me).filter(
    (iid) => memo.combatant(iid).attack > 0,
  );
  if (eligible.length === 0) return withCompelled([]);
  const defenders = memo.untappedBlockers(opp);

  // Lethal check: assume each defender absorbs the biggest remaining attacker.
  const combatants = eligible.map((iid) => memo.combatant(iid));
  let blockersLeft = defenders.length;
  let absorbed = 0;
  for (const c of [...combatants].sort((a, b) => fullDamage(b) - fullDamage(a))) {
    const needed = c.dreaded ? 2 : 1;
    if (blockersLeft < needed) continue;
    absorbed += fullDamage(c);
    blockersLeft -= needed;
  }
  const through = combatants.reduce((s, c) => s + fullDamage(c), 0) - absorbed;
  if (through >= oppLife) return withCompelled(eligible); // all-in for the kill

  // Greedy descent: start from all-in, drop the attacker whose removal most
  // improves the simulated outcome, until no single drop helps. A compelled
  // attacker is never a drop candidate.
  let current = [...eligible];
  let best = scoreAttackWith(memo, weights, me, oppLife, trickBuff, current, myLife, pers);
  for (let iter = 0; iter < eligible.length; iter++) {
    let improved = false;
    for (const drop of [...current]) {
      if (compelled.includes(drop)) continue;
      const candidate = current.filter((iid) => iid !== drop);
      const score = scoreAttackWith(memo, weights, me, oppLife, trickBuff, candidate, myLife, pers);
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
  const kept = best > pers.attackThreshold ? current : withCompelled([]);
  if (kept.length === 0) {
    // Desperation: our own NET dawn self-bleed kills us in myLife/bleed turns
    // no matter what we hold back, so once that clock is short (≤4 turns) the
    // normal stay-home verdict is a guaranteed loss. Re-run the same greedy
    // descent under a desperation objective (holdback zeroed — blockers we
    // keep home die to the bleed anyway — and no threshold gate) so the
    // OUTPUT is still the best-scored attack set, not an unscored all-in.
    // Personality-neutral: this is a dominated-strategy escape, not a style.
    const bleed = dawnSelfBleed(bf, db, me);
    if (bleed > 0 && myLife <= bleed * 4) {
      const desperate: Personality = { ...pers, holdback: 0, aggression: Math.max(pers.aggression, 1.2) };
      let set = [...eligible];
      let setScore = scoreAttackWith(memo, weights, me, oppLife, trickBuff, set, myLife, desperate);
      for (let iter = 0; iter < eligible.length && set.length > 1; iter++) {
        let improved = false;
        for (const drop of [...set]) {
          if (compelled.includes(drop)) continue;
          const candidate = set.filter((iid) => iid !== drop);
          const score = scoreAttackWith(memo, weights, me, oppLife, trickBuff, candidate, myLife, desperate);
          if (score > setScore + 0.01) {
            setScore = score;
            set = candidate;
            improved = true;
            break;
          }
        }
        if (!improved) break;
      }
      return withCompelled(set); // never empty: the descent stops at 1 attacker
    }
  }
  return withCompelled(kept);
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
  return chooseBlocksWith(new BoardMemo(bf, db), me, myLife, combat, trickBuff, pers);
}

function chooseBlocksWith(
  memo: BoardMemo,
  me: PlayerId,
  myLife: number,
  combat: CombatState,
  trickBuff: number,
  pers: Personality,
): { blocker: number; attacker: number }[] {
  const bf = memo.bf;
  const attackers = combat.attackers.filter((iid) => bf.some((p) => p.iid === iid));
  const myCreatures = memo.untappedBlockers(me);
  if (attackers.length === 0 || myCreatures.length === 0) return [];

  const incoming = attackers.reduce((s, iid) => s + fullDamage(memo.combatant(iid)), 0);
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
      if (!memo.canBlock(me, B.iid, aIid)) continue;
      const { iKill, iDie } = memo.duel(B.iid, aIid, trickBuff);
      const score =
        (iKill ? memo.value(aIid) : 0) -
        (iDie ? memo.value(B.iid) : 0) +
        fullDamage(memo.combatant(aIid)) * lifePressure;
      pairs.push({ blocker: B.iid, attacker: aIid, score });
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  const blocks: { blocker: number; attacker: number }[] = [];
  const usedBlockers = new Set<number>();
  const blockedAttackers = new Set<number>();
  for (const pair of pairs) {
    if (usedBlockers.has(pair.blocker) || blockedAttackers.has(pair.attacker)) continue;
    if (memo.combatant(pair.attacker).dreaded) continue;
    // `blockThreshold` replaces the `pair.score > 0` gate (default 0).
    if (pair.score > pers.blockThreshold || lethalMode) {
      blocks.push({ blocker: pair.blocker, attacker: pair.attacker });
      usedBlockers.add(pair.blocker);
      blockedAttackers.add(pair.attacker);
    }
  }

  // Double-block search on high-value attackers and every Dreaded attacker.
  for (const aIid of attackers) {
    if (blockedAttackers.has(aIid)) continue;
    const A = memo.combatant(aIid, trickBuff);
    if (!A.dreaded && memo.value(aIid) < 4) continue;
    const free = myCreatures.filter(
      (B) => !usedBlockers.has(B.iid) && memo.canBlock(me, B.iid, aIid),
    );
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const b1 = memo.combatant(free[i].iid);
        const b2 = memo.combatant(free[j].iid);
        // Preserve the existing pure-firstBlade gang approximation: Hard's
        // documented three-block search starts from that two-block baseline.
        // Twin Blades gangs must account for casualties before the second hit.
        const killsIt = A.twinBlades || b1.twinBlades || b2.twinBlades
          ? combatExchange(A, [b1, b2]).dying.includes(aIid)
          : b1.attack + b2.attack >= A.defense || b1.deathtouch || b2.deathtouch;
        // A Dreaded attacker may also be double-chumped to survive lethal.
        if (!killsIt && !(A.dreaded && lethalMode)) continue;
        // attacker kills at most one of them (cheapest-kill-first auto-assign)
        const cheaper = Math.min(memo.value(free[i].iid), memo.value(free[j].iid));
        if (A.dreaded || memo.value(aIid) - cheaper > 1) {
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
