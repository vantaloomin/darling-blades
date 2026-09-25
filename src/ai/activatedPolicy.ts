import type { Action } from '../engine/actions';
import { canAttack, canBlock, eligibleAttackers } from '../engine/combat/legality';
import { getEffectiveStats } from '../engine/statics';
import type { CardDb, EffectOp, Permanent, PlayerId } from '../engine/types';
import { activatedAbilitiesOf, def, isType, manaValue, opponentOf } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { chooseAttackers, chooseBlocks, combatForecast, scoreAttack } from './combatPlans';
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
const PRECOMBAT_LETHAL = 100;

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

/** The brain's attack plan on a board, priced by the defender's block model. */
function attackForecast(
  battlefield: Permanent[], db: CardDb, me: PlayerId, oppLife: number, myLife: number, context: PrecombatContext,
): AttackForecast {
  const attackers = chooseAttackers(battlefield, db, me, oppLife, context.trickBuff, myLife, context.pers);
  const combat = { attackers, blocks: [], phase: 'attackersDeclared' as const, damagePrevented: false };
  const blocks = chooseBlocks(battlefield, db, opponentOf(me), oppLife, combat, 0, DEFAULT_PERSONALITY);
  const forecast = combatForecast(battlefield, db, { ...combat, blocks, phase: 'blockersDeclared' });
  return {
    lethal: attackers.length > 0 && forecast.damage >= oppLife,
    score: scoreAttack(battlefield, db, me, oppLife, context.trickBuff, attackers, myLife, context.pers),
  };
}

/**
 * One decision asks for the same edges several times (Medium's mana
 * reserve, then its ladder; Hard's candidate map around both). Views are
 * never mutated once built, so results are keyed on the view object itself,
 * then the database and the planner inputs, and die with the view.
 */
const EDGE_CACHE = new WeakMap<PlayerView, WeakMap<CardDb, Map<string, {
  before?: AttackForecast; edges: Map<string, Edge>;
}>>>();

function edgeCacheFor(view: PlayerView, db: CardDb, context: PrecombatContext) {
  let byDb = EDGE_CACHE.get(view);
  if (!byDb) EDGE_CACHE.set(view, byDb = new WeakMap());
  let byContext = byDb.get(db);
  if (!byContext) byDb.set(db, byContext = new Map());
  const key = `${context.trickBuff}|${JSON.stringify(context.pers)}`;
  let entry = byContext.get(key);
  if (!entry) byContext.set(key, entry = { edges: new Map() });
  return entry;
}

/**
 * What using this Duty before combat does to this turn's attack. The engine
 * performs the Duty on a determinized copy of the public position (so taps,
 * lethal damage, pumps, Marks, a mana creature spent on the payment and life
 * loss all land exactly as they will), then the brain's own attack planner
 * and the defender's block model price both boards. `lethal` is a forecast
 * that turns lethal only with the Duty; `gain` is the attack-score change.
 * Null outside our own pre-combat Morning, for a Duty that cannot touch the
 * fight, or when no creature of ours can attack this turn at all. Reads only
 * the redacted view.
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
  if (!ability || !shapesCombat(ability.ops)) return null;
  const me = view.myId;
  // One database for every caller, so a brain and its search share results
  // (the stand-in superset reads real cards exactly as the raw one does).
  const sdb = simDb(db);
  // No Duty op makes a body able to attack, so with no eligible attacker
  // there is no attack for it to change.
  const eligible = eligibleAttackers(view.battlefield, sdb, me);
  if (eligible.length === 0) return null;
  // A targeted Duty reaches this fight only through a body in it (a blocker
  // for one of our attackers, or one of those attackers) or through a
  // player's life.
  const targets = action.targets ?? [];
  if (targets.length > 0 && !targets.some((ref) => ref.kind === 'player' || ref.kind === 'permanent' &&
    (eligible.includes(ref.iid) || eligible.some((attacker) =>
      canBlock(view.battlefield, sdb, opponentOf(me), ref.iid, attacker))))) return null;
  const cache = edgeCacheFor(view, sdb, context);
  const key = JSON.stringify([action.iid, action.abilityIndex ?? 0, targets, action.manaPlan ?? null]);
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
      const projected = attackForecast(after.battlefield, sdb, me, after.opp.life, after.you.life, context);
      edge = { lethal: projected.lethal && !before.lethal, gain: projected.score - before.score };
    }
  } catch {
    edge = null;
  }
  cache.edges.set(key, edge);
  return edge;
}

/**
 * Duty competes with combat only on an attacking body: an attacker is never
 * tapped for its Duty in the Morning (a Rage body never at all), and the
 * attack planner runs before that body is spent. A tap-only Duty on anything
 * else is used in the Morning. A paid Duty waits for the Afternoon unless the
 * caller supplies a PrecombatContext and using it now makes the attack lethal
 * or improves it by more than PRECOMBAT_DUTY_MARGIN; such a Duty is ranked by
 * its impact plus that gain (or the lethal bonus). Whether the mana belongs
 * to a better spell is MediumAI.constrainMainMana's call, made before this.
 * Legality and target lists come exclusively from the caller's legal menu.
 */
export function scoredActivationCandidates(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
  precombat?: PrecombatContext,
): { action: ActivateAction; value: number }[] {
  if (view.awaiting.kind !== 'main' || view.awaiting.player !== view.myId ||
    view.activePlayer !== view.myId || (view.step !== 'main1' && view.step !== 'main2')) return [];
  const scored: { action: ActivateAction; value: number }[] = [];
  for (const action of legal) {
    if (action.type !== 'activate') continue;
    const source = view.battlefield.find((perm) => perm.iid === action.iid);
    if (!source || source.controller !== view.myId) continue;
    const d = def(db, source.cardId);
    const ability = activatedAbilitiesOf(d)[action.abilityIndex ?? 0];
    if (!ability) continue;
    if (view.step === 'main1' && isType(d, 'creature')) {
      const stats = getEffectiveStats(view.battlefield, db, source.iid);
      // Even a zero-power or Bulwark Rage body never uses the Morning trick.
      if (stats.keywords.has('rage')) continue;
      if (stats.attack > 0 && canAttack(view.battlefield, db, view.myId, source.iid)) continue;
    }
    const paidMorning = view.step === 'main1' && manaValue(ability.cost.mana) > 0;
    if (paidMorning && !precombat) continue;
    // Never a self-harming ability, whatever the attack would gain.
    const value = activateActionValue(view, db, action);
    if (!(value > 0)) continue;
    let timing = 0;
    if (paidMorning && precombat) {
      const edge = precombatDutyEdge(view, db, action, precombat);
      if (!edge || !edge.lethal && !(edge.gain > PRECOMBAT_DUTY_MARGIN)) continue;
      timing = edge.lethal ? PRECOMBAT_LETHAL : edge.gain;
    }
    scored.push({ action, value: value + timing });
  }
  return scored;
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
export function chooseActivate(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
  precombat?: PrecombatContext,
): ActivateAction | null {
  let best: ActivateAction | null = null;
  let bestValue = 0;
  for (const { action, value } of scoredActivationCandidates(view, db, legal, precombat)) {
    if (value > bestValue) {
      best = action;
      bestValue = value;
    }
  }
  return best;
}
