import type { Action } from '../engine/actions';
import { canAttack, canBlock, eligibleAttackers } from '../engine/combat/legality';
import { getEffectiveStats } from '../engine/statics';
import type { ActivatedDef, CardDb, EffectOp, Permanent, PlayerId } from '../engine/types';
import { activatedAbilitiesOf, def, isType, manaValue, opponentOf } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { attackReach, attackWeightInputs, cautiousThrough, chooseAttackers, chooseBlocks, combatForecast, scoreAttack } from './combatPlans';
import { determinize, simDb } from './determinize';
import { DEFAULT_PERSONALITY, type Personality } from './personality';
import { activateActionValue } from './value';

export type ActivateAction = Extract<Action, { type: 'activate' }>;

/**
 * What a brain's own attack planner needs to price a Duty against this
 * turn's attack. Medium and Hard pass one; Easy and ScriptAI do not, so a
 * paid Duty waits for their Afternoon exactly as it did before 1.8.1.
 */
export interface PrecombatContext {
  trickBuff: number;
  pers: Personality;
}

/**
 * A paid Duty moves into the Morning when it improves the attack forecast by
 * more than this, in `scoreAttack` units: two damage through at high life, one
 * at twelve or below, or a blocker worth more than 0.75 removed from the fight.
 * There is no card to pay for, and the develop and Charm reserves in
 * MediumAI.constrainMainMana already charge the mana, so the margin is only a
 * noise floor on the heuristic forecast.
 */
export const PRECOMBAT_DUTY_MARGIN = 0.75;

/** The same bonus `scoreAttack` pays a lethal connection. */
export const PRECOMBAT_LETHAL = 100;

/** Ops that can change this turn's attack when they resolve before it. */
function shapesCombat(ops: readonly EffectOp[]): boolean {
  return ops.some((op) => {
    switch (op.op) {
      case 'tap': case 'tapAll': case 'destroy': case 'sever': case 'recall':
      case 'destroyArtifactOrSeverEnchantment': case 'massDestroy': case 'sacrifice':
      case 'boost': case 'addCounters': case 'markAll': case 'propagate': case 'moveMark': case 'removeMarks':
      case 'loseLife': case 'loseLifePerTheirMarked':
        return true;
      case 'damage':
        return op.to !== 'controller';
      case 'ifTargetMarked':
        return shapesCombat(op.then) || shapesCombat(op.else ?? []);
      default:
        return false;
    }
  });
}

type Edge = { lethal: boolean; gain: number } | null;
type AttackForecast = { lethal: boolean; score: number };

/** The brain's attack plan on a board, priced by the defender's block model.
 * `weightBoard` fixes the creature counts and opposing power the planner
 * weighs damage and holdback by (see `scoreAttack`). */
function attackForecast(
  battlefield: Permanent[], db: CardDb, me: PlayerId, oppLife: number, myLife: number,
  context: PrecombatContext, weightBoard: readonly Permanent[] = battlefield,
): AttackForecast {
  const attackers = chooseAttackers(battlefield, db, me, oppLife, context.trickBuff, myLife, context.pers, weightBoard);
  const combat = { attackers, blocks: [], phase: 'attackersDeclared' as const, damagePrevented: false };
  const blocks = chooseBlocks(battlefield, db, opponentOf(me), oppLife, combat, 0, DEFAULT_PERSONALITY);
  const forecast = combatForecast(battlefield, db, { ...combat, blocks, phase: 'blockersDeclared' });
  return {
    lethal: attackers.length > 0 && forecast.damage >= oppLife,
    score: scoreAttack(battlefield, db, me, oppLife, context.trickBuff, attackers, myLife, context.pers, weightBoard),
  };
}

/**
 * One decision asks for the same edges several times (Medium's mana
 * reserve, then its ladder; Hard's candidate map around both). Views are
 * never mutated once built, so results are keyed on the view object itself,
 * then the database and the planner inputs, and die with the view.
 */
const EDGE_CACHE = new WeakMap<PlayerView, WeakMap<CardDb, Map<string, {
  before?: AttackForecast; allIn?: number; edges: Map<string, Edge>; screens: Map<string, boolean>;
}>>>();

function edgeCacheFor(view: PlayerView, db: CardDb, context: PrecombatContext) {
  let byDb = EDGE_CACHE.get(view);
  if (!byDb) EDGE_CACHE.set(view, byDb = new WeakMap());
  let byContext = byDb.get(db);
  if (!byContext) byDb.set(db, byContext = new Map());
  const key = `${context.trickBuff}|${JSON.stringify(context.pers)}`;
  let entry = byContext.get(key);
  if (!entry) byContext.set(key, entry = { edges: new Map(), screens: new Map() });
  return entry;
}

/**
 * One Duty action's cache key. The mana plan matters only through the mana
 * creatures it taps (such a creature cannot attack after paying), so the key
 * carries those and ignores which lands pay: the reserves may rewrite a land
 * payment between two asks in one decision without changing the forecast.
 */
function dutyKey(view: PlayerView, sdb: CardDb, action: ActivateAction): string {
  const creatures = (action.manaPlan ?? []).filter((iid) => {
    const perm = view.battlefield.find((p) => p.iid === iid);
    return perm !== undefined && isType(def(sdb, perm.cardId), 'creature');
  }).sort((a, b) => a - b);
  return JSON.stringify([action.iid, action.abilityIndex ?? 0, action.targets ?? [], creatures]);
}

/**
 * Can this Duty reach this turn's fight at all? It needs a creature of ours
 * able to attack (no Duty op makes a body able to), and when it is targeted,
 * a target that is a player, one of those attackers, or a blocker for one of
 * them. Cheap, and it runs before any value or forecast is computed.
 */
function reachesFight(
  view: PlayerView, sdb: CardDb, action: ActivateAction, ability: ActivatedDef, eligible: readonly number[],
): boolean {
  if (eligible.length === 0 || !shapesCombat(ability.ops)) return false;
  const targets = action.targets ?? [];
  return targets.length === 0 || targets.some((ref) => ref.kind === 'player' || ref.kind === 'permanent' &&
    (eligible.includes(ref.iid) || eligible.some((attacker) =>
      canBlock(view.battlefield, sdb, opponentOf(view.myId), ref.iid, attacker))));
}

/**
 * What using this Duty before combat does to this turn's attack. The engine
 * performs the Duty on a determinized copy of the public position (so taps,
 * lethal damage, pumps, Marks, a mana creature spent on the payment and life
 * loss all land exactly as they will), then the brain's own attack planner
 * and the defender's block model price both boards.
 *
 * `gain` prices only what the Duty does to the fight: both boards are planned
 * and scored at the life totals, creature counts and opposing power of the
 * board before it, because `scoreAttack` weighs damage by those (0.45 a point
 * above twelve life, 0.9 at or below, more with two extra creatures) and a
 * ping or a kill does the same in main two. `lethal` is the one question the
 * new life totals answer: the real plan on the new board kills, and the old
 * one did not. Null outside our own pre-combat Morning or for a Duty that
 * cannot reach the fight. Reads only the redacted view.
 */
export function precombatDutyEdge(
  view: PlayerView,
  db: CardDb,
  action: ActivateAction,
  context: PrecombatContext,
): Edge {
  if (view.step !== 'main1' || view.activePlayer !== view.myId || view.combat) return null;
  const source = view.battlefield.find((perm) => perm.iid === action.iid);
  const ability = source && activatedAbilitiesOf(def(db, source.cardId))[action.abilityIndex ?? 0];
  if (!ability) return null;
  const me = view.myId;
  // One database for every caller, so a brain and its search share results
  // (the stand-in superset reads real cards exactly as the raw one does).
  const sdb = simDb(db);
  if (!reachesFight(view, sdb, action, ability, eligibleAttackers(view.battlefield, sdb, me))) return null;
  const cache = edgeCacheFor(view, sdb, context);
  const key = dutyKey(view, sdb, action);
  if (cache.edges.has(key)) return cache.edges.get(key)!;
  let edge: Edge;
  try {
    const game = determinize(view, sdb);
    game.submit(me, action);
    if (game.state.winner === me) {
      edge = { lethal: true, gain: PRECOMBAT_LETHAL };
    } else {
      const after = game.viewFor(me);
      const before = cache.before ??= attackForecast(view.battlefield, sdb, me, view.opp.life, view.you.life, context);
      const fixed = attackForecast(after.battlefield, sdb, me, view.opp.life, view.you.life, context, view.battlefield);
      // When the Duty moved none of the weights, the fixed plan is the real one.
      const weightsBefore = attackWeightInputs(view.battlefield, sdb, me);
      const weightsAfter = attackWeightInputs(after.battlefield, sdb, me);
      const unmoved = after.opp.life === view.opp.life && after.you.life === view.you.life &&
        weightsAfter.pressing === weightsBefore.pressing && weightsAfter.oppPower === weightsBefore.oppPower;
      const live = unmoved ? fixed : attackForecast(after.battlefield, sdb, me, after.opp.life, after.you.life, context);
      edge = { lethal: live.lethal && !before.lethal, gain: fixed.score - before.score };
    }
  } catch {
    edge = null;
  }
  cache.edges.set(key, edge);
  return edge;
}

/**
 * The most damage a Duty's own ops add directly: face damage and life loss,
 * and twice the power a single-target pump or Mark gives (a twinBlades body
 * hits twice). A board-wide pump or a board-scaled loss is unbounded here, so
 * the screen below always runs for it.
 */
function dutyReach(ops: readonly EffectOp[]): number {
  let reach = 0;
  for (const op of ops) {
    switch (op.op) {
      case 'damage':
        if (op.to === 'controller' || op.to === 'eachCreature' || op.to === 'eachOpponentCreature') break;
        reach += typeof op.n === 'number' ? op.n : Infinity;
        break;
      case 'loseLife':
        reach += op.n;
        break;
      case 'boost':
        reach += op.scope === 'target' || op.scope === 'self' ? 2 * Math.max(0, op.p) : Infinity;
        break;
      case 'addCounters':
        reach += 2 * Math.max(0, op.n);
        break;
      case 'moveMark':
        reach += 2;
        break;
      case 'markAll': case 'propagate': case 'loseLifePerTheirMarked':
        return Infinity;
      case 'ifTargetMarked':
        reach += Math.max(dutyReach(op.then), dutyReach(op.else ?? []));
        break;
      default:
        break;
    }
  }
  return reach;
}

/**
 * Every eligible attacker sent, the defender blocking with its model: the
 * forecast damage on the board before any Duty. Cached per view.
 */
function allInDamage(view: PlayerView, sdb: CardDb, context: PrecombatContext, attackers: number[]): number {
  const cache = edgeCacheFor(view, sdb, context);
  if (cache.allIn !== undefined) return cache.allIn;
  const combat = { attackers, blocks: [], phase: 'attackersDeclared' as const, damagePrevented: false };
  const blocks = chooseBlocks(view.battlefield, sdb, opponentOf(view.myId), view.opp.life, combat, 0, DEFAULT_PERSONALITY);
  return cache.allIn = combatForecast(view.battlefield, sdb, { ...combat, blocks, phase: 'blockersDeclared' }).damage;
}

/**
 * The lethal test for the targets the full forecast skips: perform the Duty
 * on a determinized copy and send every eligible attacker. The damage must
 * reach the opponent's life against the greedy block model (the model the
 * full forecast then confirms with the real plan) and against a cautious
 * defender (`cautiousThrough`) too. The second bar is what keeps this search
 * honest: these targets are the ones a greedy defender mishandles, and on
 * 1,500 review boards against Hard's blocks, taking them on the greedy test
 * alone traded 23 worse games for 4 better (13 new losses, 1 new win).
 */
function lethalScreen(view: PlayerView, sdb: CardDb, action: ActivateAction, context: PrecombatContext): boolean {
  const cache = edgeCacheFor(view, sdb, context);
  const key = dutyKey(view, sdb, action);
  const known = cache.screens.get(key);
  if (known !== undefined) return known;
  const me = view.myId;
  let lethal: boolean;
  try {
    const game = determinize(view, sdb);
    game.submit(me, action);
    if (game.state.winner === me) {
      lethal = true;
    } else {
      const after = game.viewFor(me);
      const attackers = eligibleAttackers(after.battlefield, sdb, me);
      const combat = { attackers, blocks: [], phase: 'attackersDeclared' as const, damagePrevented: false };
      const blocks = chooseBlocks(after.battlefield, sdb, opponentOf(me), after.opp.life, combat, 0, DEFAULT_PERSONALITY);
      lethal = attackers.length > 0 &&
        combatForecast(after.battlefield, sdb, { ...combat, blocks, phase: 'blockersDeclared' }).damage >= after.opp.life &&
        cautiousThrough(after.battlefield, sdb, attackers, opponentOf(me)) >= after.opp.life;
    }
  } catch {
    lethal = false;
  }
  cache.screens.set(key, lethal);
  return lethal;
}

export interface ScoredActivation {
  action: ActivateAction;
  value: number;
  /** A Morning Duty whose forecast attack is lethal only with it. */
  lethal: boolean;
}

/**
 * Duty competes with combat only on an attacking body: an attacker is never
 * tapped for its Duty in the Morning (a Rage body never at all), and the
 * attack planner runs before that body is spent. A tap-only Duty on anything
 * else is used in the Morning. A paid Duty waits for the Afternoon unless the
 * caller supplies a PrecombatContext and using it now makes the attack lethal
 * or improves it by more than PRECOMBAT_DUTY_MARGIN; such a Duty is ranked by
 * its impact plus that gain (or the lethal bonus). Only the best target of
 * each paid source and ability, by impact among the targets that reach the
 * fight, is forecast for its gain. The other targets are screened for lethal
 * only (a cheap all-in forecast, and only when every eligible attacker
 * unblocked plus the Duty's own damage could reach the opponent's life); a
 * target that passes gets the full forecast, and a lethal one is ranked like
 * any lethal Duty. Whether the mana belongs to a better spell is
 * MediumAI.constrainMainMana's call.
 * Legality and target lists come exclusively from the caller's legal menu.
 */
export function scoredActivationCandidates(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
  precombat?: PrecombatContext,
): ScoredActivation[] {
  if (view.awaiting.kind !== 'main' || view.awaiting.player !== view.myId ||
    view.activePlayer !== view.myId || (view.step !== 'main1' && view.step !== 'main2')) return [];
  const rows: (ScoredActivation & { index: number })[] = [];
  const morning = new Map<string, { ops: readonly EffectOp[]; targets: { index: number; action: ActivateAction; value: number }[] }>();
  let eligible: number[] | undefined;
  legal.forEach((action, index) => {
    if (action.type !== 'activate') return;
    const source = view.battlefield.find((perm) => perm.iid === action.iid);
    if (!source || source.controller !== view.myId) return;
    const d = def(db, source.cardId);
    const ability = activatedAbilitiesOf(d)[action.abilityIndex ?? 0];
    if (!ability) return;
    if (view.step === 'main1' && isType(d, 'creature')) {
      const stats = getEffectiveStats(view.battlefield, db, source.iid);
      // Even a zero-power or Bulwark Rage body never uses the Morning trick.
      if (stats.keywords.has('rage')) return;
      if (stats.attack > 0 && canAttack(view.battlefield, db, view.myId, source.iid)) return;
    }
    const paidMorning = view.step === 'main1' && manaValue(ability.cost.mana) > 0;
    if (paidMorning && (!precombat || !reachesFight(view, simDb(db), action, ability,
      eligible ??= eligibleAttackers(view.battlefield, simDb(db), view.myId)))) return;
    // Never a self-harming ability, whatever the attack would gain.
    const value = activateActionValue(view, db, action);
    if (!(value > 0)) return;
    if (!paidMorning) {
      rows.push({ index, action, value, lethal: false });
      return;
    }
    const key = `${action.iid}:${action.abilityIndex ?? 0}`;
    const entry = morning.get(key) ?? { ops: ability.ops, targets: [] };
    entry.targets.push({ index, action, value });
    morning.set(key, entry);
  });
  let reach: ReturnType<typeof attackReach> | undefined;
  for (const { ops, targets } of morning.values()) {
    // The best target by impact, the first in legal order on a tie.
    const best = targets.reduce((a, b) => b.value > a.value ? b : a);
    const edge = precombatDutyEdge(view, db, best.action, precombat!);
    if (edge && (edge.lethal || edge.gain > PRECOMBAT_DUTY_MARGIN)) {
      rows.push({ ...best, value: best.value + (edge.lethal ? PRECOMBAT_LETHAL : edge.gain), lethal: edge.lethal });
    }
    if (edge?.lethal || targets.length === 1) continue;
    // Two cheap bounds before any target is screened. Every attacker
    // unblocked cannot reach their life; or, from the all-in forecast before
    // the Duty, one target changing (a blocker gone or tapped, an attacker
    // pumped) frees at most one attacker's damage, plus Overrun spill and
    // the Duty's own reach, under the greedy block model's one-blocker swaps.
    reach ??= attackReach(view.battlefield, simDb(db), eligible!);
    const added = dutyReach(ops);
    if (reach.total + added < view.opp.life) continue;
    if (allInDamage(view, simDb(db), precombat!, eligible!) + reach.biggest + reach.overrun + added < view.opp.life) continue;
    for (const other of targets) {
      if (other === best || !lethalScreen(view, simDb(db), other.action, precombat!)) continue;
      if (!precombatDutyEdge(view, db, other.action, precombat!)?.lethal) continue;
      rows.push({ ...other, value: other.value + PRECOMBAT_LETHAL, lethal: true });
      break;
    }
  }
  return rows.sort((a, b) => a.index - b.index).map(({ action, value, lethal }) => ({ action, value, lethal }));
}

export function activationCandidates(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
  precombat?: PrecombatContext,
): ActivateAction[] {
  return scoredActivationCandidates(view, db, legal, precombat).map(({ action }) => action);
}

/** Highest positive per-use impact; legal enumeration order breaks ties. */
export function bestActivation(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
  precombat?: PrecombatContext,
): ScoredActivation | null {
  let best: ScoredActivation | null = null;
  for (const row of scoredActivationCandidates(view, db, legal, precombat)) {
    if (row.value > (best?.value ?? 0)) best = row;
  }
  return best;
}

export function chooseActivate(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
  precombat?: PrecombatContext,
): ActivateAction | null {
  return bestActivation(view, db, legal, precombat)?.action ?? null;
}
