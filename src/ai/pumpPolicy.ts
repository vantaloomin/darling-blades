import { manaActivationsOf, repeatedManaCost, type Action } from '../engine/actions';
import { blockOptions, minimumBlockersForAttacker } from '../engine/combat/legality';
import { solveMana } from '../engine/mana';
import { getEffectiveStats } from '../engine/statics';
import type { CardDb, CombatState, Keyword, ManaCost, Permanent } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { combatForecast } from './combatPlans';
import { permValue } from './value';

/**
 * The repeatable mana pump (A1.5, "{R}: This gets +1/+0 until Sunset."): when
 * each brain spends it. Every read is public (the redacted view) and returns
 * null unless a legal `activateMana` is on the menu, so no game without the
 * ability changes. All reads happen in combat response windows; the brains
 * never pump in a main phase or at Sunset, where no fight is left to change.
 * docs/plan-first-dawn-engine.md, "As built (A1.5)".
 */
export type ManaActivation = Extract<Action, { type: 'activateMana' }>;

interface Pump {
  action: ManaActivation;
  perm: Permanent;
  p: number;
  t: number;
  keywords: Keyword[];
  cost: ManaCost;
}

/** The pumps on the menu, each with what one activation adds (its self boosts). */
function pumpsOn(view: PlayerView, db: CardDb, legal: readonly Action[]): Pump[] {
  const out: Pump[] = [];
  for (const action of legal) {
    if (action.type !== 'activateMana') continue;
    const perm = view.battlefield.find((p) => p.iid === action.iid);
    const ability = perm && manaActivationsOf(def(db, perm.cardId))[action.abilityIndex];
    if (!perm || !ability) continue;
    let p = 0;
    let t = 0;
    const keywords: Keyword[] = [];
    for (const op of ability.ops) {
      if (op.op !== 'boost' || op.scope !== 'self') continue;
      p += op.p;
      t += op.t;
      keywords.push(...(op.keywords ?? []));
    }
    if (p > 0 || t > 0) out.push({ action, perm, p, t, keywords, cost: ability.cost });
  }
  return out;
}

/** The battlefield with `times` activations of this pump applied. */
function pumped(bf: readonly Permanent[], pump: Pump, times: number): Permanent[] {
  if (times === 0) return [...bf];
  return bf.map((perm) => perm.iid === pump.perm.iid
    ? { ...perm, untilEotMods: [...perm.untilEotMods, { p: pump.p * times, t: pump.t * times, keywords: [...pump.keywords] }] }
    : perm);
}

/** A fight that can still happen: its damage is not prevented this turn. */
function liveCombat(view: PlayerView): CombatState | null {
  const combat = view.combat;
  if (view.awaiting.kind !== 'respond' || view.step !== 'combat' || !combat) return null;
  if (view.fogThisTurn || combat.damagePrevented) return null;
  return combat;
}

const isBlocked = (combat: CombatState, iid: number): boolean => combat.blocks.some((b) => b.attacker === iid);

// ---------------------------------------------------------------------------
// Medium and Easy: the simple rule.
// ---------------------------------------------------------------------------

/**
 * In its own window over the blocks: an unblocked attacker is pumped with all
 * the mana there is (Easy never holds mana, and Medium reserves only in its
 * main phase); a blocked attacker is pumped the fewest times that kill every
 * creature blocking it, when fewer do not. Nothing on defence. Known
 * mistakes: the unblocked pump spends mana a main-two cast wanted, and a
 * blocked pump ignores whether the attacker survives.
 */
export function chooseSimplePump(view: PlayerView, db: CardDb, legal: readonly Action[]): ManaActivation | null {
  const combat = liveCombat(view);
  if (!combat || combat.phase !== 'blockersDeclared' || view.activePlayer !== view.myId) return null;
  for (const pump of pumpsOn(view, db, legal)) {
    if (!combat.attackers.includes(pump.perm.iid)) continue;
    if (!isBlocked(combat, pump.perm.iid)) {
      if (pump.p > 0 && !pump.perm.combatDamagePrevented) return pump.action;
      continue;
    }
    const blockers = combat.blocks.filter((b) => b.attacker === pump.perm.iid).map((b) => b.blocker)
      .filter((iid) => view.battlefield.some((p) => p.iid === iid));
    const killsAll = (times: number): boolean => {
      const dying = combatForecast(pumped(view.battlefield, pump, times), db, combat).dying;
      return blockers.length > 0 && blockers.every((iid) => dying.includes(iid));
    };
    if (killsAll(0)) continue;
    for (let times = 1; times <= pump.action.times; times++) {
      if (killsAll(times)) return { ...pump.action, times };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hard.
// ---------------------------------------------------------------------------

/**
 * Mana Hard keeps back: the dearest card in hand it could cast next (on its
 * own turn anything, for main two; on the opponent's turn a Charm).
 */
function heldCost(view: PlayerView, db: CardDb): ManaCost | undefined {
  const myTurn = view.activePlayer === view.myId;
  let held: ManaCost | undefined;
  for (const id of view.you.hand) {
    const d = def(db, id);
    if (!d.cost || isType(d, 'land') || (!myTurn && !isType(d, 'charm'))) continue;
    if (solveMana(view, db, view.myId, d.cost) === null) continue;
    if (!held || manaValue(d.cost) > manaValue(held)) held = d.cost;
  }
  return held;
}

/** The sources a pump of `times` taps while the held card stays payable; null when it cannot. */
function planKeeping(view: PlayerView, db: CardDb, pump: Pump, times: number, held: ManaCost | undefined): number[] | null {
  const keep = held ? solveMana(view, db, view.myId, held) ?? [] : [];
  return solveMana(view, db, view.myId, repeatedManaCost(pump.cost, times), 0, keep);
}

function withPlan(view: PlayerView, db: CardDb, pump: Pump, times: number, held: ManaCost | undefined): ManaActivation {
  const plan = held ? planKeeping(view, db, pump, times, held) : null;
  return { ...pump.action, times, ...(plan ? { manaPlan: plan } : {}) };
}

/** The most activations that leave the held card payable. */
function spareTimes(view: PlayerView, db: CardDb, pump: Pump, held: ManaCost | undefined): number {
  if (!held) return pump.action.times;
  let times = pump.action.times;
  while (times > 0 && planKeeping(view, db, pump, times, held) === null) times--;
  return times;
}

/** The fight's creature trade from my side: their deaths' worth less mine. */
function trade(view: PlayerView, db: CardDb, bf: readonly Permanent[], combat: CombatState): number {
  let total = 0;
  for (const iid of combatForecast(bf, db, combat).dying) {
    const perm = view.battlefield.find((p) => p.iid === iid);
    if (!perm) continue;
    const worth = permValue(view.battlefield, db, iid);
    total += perm.controller === view.myId ? -worth : worth;
  }
  return total;
}

/** The fewest activations (up to `limit`) that give the best trade, if better than none. */
function bestTradeTimes(view: PlayerView, db: CardDb, pump: Pump, combat: CombatState, limit: number): number {
  let best = trade(view, db, view.battlefield, combat);
  let bestTimes = 0;
  for (let times = 1; times <= limit; times++) {
    const worth = trade(view, db, pumped(view.battlefield, pump, times), combat);
    if (worth > best + 1e-9) {
      best = worth;
      bestTimes = times;
    }
  }
  return bestTimes;
}

/** Turns to kill from `life`, attacking next turn with every creature I keep. */
function clock(view: PlayerView, db: CardDb, bf: readonly Permanent[], combat: CombatState): number {
  const forecast = combatForecast(bf, db, combat);
  const life = view.opp.life - forecast.damage;
  if (life <= 0) return 0;
  // Next turn's board: this turn's pumps and damage are gone.
  const next = bf.filter((perm) => !forecast.dying.includes(perm.iid))
    .map((perm) => ({ ...perm, untilEotMods: [], damage: 0 }));
  const power = next.filter((perm) => perm.controller === view.myId && isType(def(db, perm.cardId), 'creature'))
    .reduce((sum, perm) => sum + Math.max(0, getEffectiveStats(next, db, perm.iid).attack), 0);
  return power > 0 ? Math.ceil(life / power) : Infinity;
}

/**
 * Hard, in a combat response window. In order:
 * 1. Lethal: the fewest activations of one pump that make this combat's
 *    damage kill the opponent, spending any mana.
 * 2. A fight: the fewest activations, within spare mana, that give its
 *    creature's fight its best trade (a blocked attacker killing its blocker;
 *    a blocker killing the attacker it blocks, or surviving it, which is the
 *    defender's read in its reply window after the attacker's pump).
 * 3. Defence before blocks: the fewest activations, within spare mana, after
 *    which a creature that can block an attacker alone kills it, when that
 *    lone block's trade is in Hard's favour (the best such block first). The
 *    block search then sees the bigger blocker.
 * 4. The race: the fewest activations, within spare mana, of an unblocked
 *    attacker's pump that take a turn off Hard's clock on the opponent.
 * Spare mana keeps the dearest card Hard could cast next (heldCost). Nothing
 * else is pumped, so the mana is never spent where it changes nothing. Known
 * mistakes: one pump is read at a time; the clock ignores the opponent's
 * blockers next turn; a defending pump before blocks assumes a lone block;
 * Hard's rollouts play its side with Medium, so a simulated Hard pumps by
 * the simple rule.
 */
export function chooseHardPump(view: PlayerView, db: CardDb, legal: readonly Action[]): ManaActivation | null {
  const combat = liveCombat(view);
  if (!combat) return null;
  const pumps = pumpsOn(view, db, legal);
  if (pumps.length === 0) return null;
  const mine = view.activePlayer === view.myId;

  if (mine && combat.phase === 'blockersDeclared') {
    const base = combatForecast(view.battlefield, db, combat).damage;
    if (base < view.opp.life) {
      for (const pump of pumps) {
        if (!combat.attackers.includes(pump.perm.iid)) continue;
        for (let times = 1; times <= pump.action.times; times++) {
          if (combatForecast(pumped(view.battlefield, pump, times), db, combat).damage >= view.opp.life) {
            return { ...pump.action, times };
          }
        }
      }
    }
  }

  const held = heldCost(view, db);
  for (const pump of pumps) {
    const iid = pump.perm.iid;
    const fighting = combat.phase === 'blockersDeclared' &&
      (combat.blocks.some((b) => b.blocker === iid) || (combat.attackers.includes(iid) && isBlocked(combat, iid)));
    if (!fighting) continue;
    const times = bestTradeTimes(view, db, pump, combat, spareTimes(view, db, pump, held));
    if (times > 0) return withPlan(view, db, pump, times, held);
  }

  if (!mine && combat.phase === 'attackersDeclared') {
    let best: { pump: Pump; times: number; worth: number } | undefined;
    const options = blockOptions(view, db, view.myId, combat);
    for (const pump of pumps) {
      const canBlock = options.find((option) => option.blocker === pump.perm.iid)?.canBlock ?? [];
      const limit = spareTimes(view, db, pump, held);
      for (const attacker of canBlock) {
        if (minimumBlockersForAttacker(view, db, attacker) !== 1) continue;
        const lone: CombatState = { ...combat, blocks: [{ blocker: pump.perm.iid, attacker }], phase: 'blockersDeclared' };
        const kills = (times: number): boolean =>
          combatForecast(pumped(view.battlefield, pump, times), db, lone).dying.includes(attacker);
        if (kills(0)) continue;
        for (let times = 1; times <= limit; times++) {
          if (!kills(times)) continue;
          // Only a block worth making: the attacker is worth more than what it takes.
          const worth = trade(view, db, pumped(view.battlefield, pump, times), lone);
          if (worth > 0 && (!best || worth > best.worth)) best = { pump, times, worth };
          break;
        }
      }
    }
    if (best) return withPlan(view, db, best.pump, best.times, held);
  }

  if (mine && combat.phase === 'blockersDeclared') {
    for (const pump of pumps) {
      if (!combat.attackers.includes(pump.perm.iid) || isBlocked(combat, pump.perm.iid)) continue;
      const now = clock(view, db, view.battlefield, combat);
      let bestClock = now;
      let bestTimes = 0;
      for (let times = 1; times <= spareTimes(view, db, pump, held); times++) {
        const turns = clock(view, db, pumped(view.battlefield, pump, times), combat);
        if (turns < bestClock) {
          bestClock = turns;
          bestTimes = times;
        }
      }
      if (bestTimes > 0) return withPlan(view, db, pump, bestTimes, held);
    }
  }
  return null;
}

/** The menu without the pumps, for a brain whose own read has declined them. */
export function withoutPumps(legal: Action[]): Action[] {
  return legal.some((action) => action.type === 'activateMana')
    ? legal.filter((action) => action.type !== 'activateMana') : legal;
}
