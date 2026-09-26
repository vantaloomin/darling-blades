import type { Action } from '../engine/actions';
import { canAttack, canBlock, minimumBlockersForAttacker } from '../engine/combat/legality';
import { isLegalTarget } from '../engine/effects/targeting';
import { getEffectiveStats } from '../engine/statics';
import type { CardDb, EffectOp, Permanent } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { combatForecast } from './combatPlans';
import { determinize } from './determinize';
import { linkedRiderValue, permValue } from './value';

type LinkHauntAction = Extract<Action, { type: 'linkHaunt' }>;
type HeldTrigger = Extract<NonNullable<PlayerView['pendingDecisions']>[number], { kind: 'resolveTrigger' }>;

const MOVE_MARGIN = 0.25;
const LINK_MANA_RATE = 0.65;

/** Virtual attachment changes keep both ends consistent and leave the view untouched. */
function withHost(battlefield: readonly Permanent[], iid: number, hostIid?: number): Permanent[] {
  return battlefield.map((perm) => {
    const changed = { ...perm, attachments: perm.attachments.filter((attached) => attached !== iid) };
    if (perm.iid === iid) {
      if (hostIid === undefined) delete changed.attachedTo;
      else changed.attachedTo = hostIid;
    }
    if (perm.iid === hostIid) changed.attachments.push(iid);
    return changed;
  });
}

/** Marginal rider fit: duplicate keywords contribute nothing; a public fight
 * that changes its outcome contributes the bodies it saves or wins. Marks
 * already enter the effective stats, so a marked host earns only useful gains. */
export function hauntlinkHostFit(
  battlefield: readonly Permanent[], db: CardDb, iid: number, hostIid: number,
): number {
  const carrier = battlefield.find((perm) => perm.iid === iid);
  const host = battlefield.find((perm) => perm.iid === hostIid);
  if (!carrier || !host) return -Infinity;
  const bare = withHost(battlefield, iid);
  const linked = withHost(bare, iid, hostIid);
  let fit = linkedRiderValue(bare, db, carrier.cardId, hostIid);
  const enemies = bare.filter((perm) => perm.controller !== host.controller && isType(def(db, perm.cardId), 'creature'));
  let fightGain = 0;
  for (const enemy of enemies) {
    const pairIsLegal = (board: readonly Permanent[], attacker: Permanent, blocker: Permanent): boolean =>
      canAttack(board, db, attacker.controller, attacker.iid) &&
      canBlock(board, db, blocker.controller, blocker.iid, attacker.iid) &&
      minimumBlockersForAttacker(board, db, attacker.iid) === 1;
    const gainInFight = (attacker: Permanent, blocker: Permanent): number => {
      if (!pairIsLegal(bare, attacker, blocker) || !pairIsLegal(linked, attacker, blocker)) return 0;
      const combat = { attackers: [attacker.iid], blocks: [{ attacker: attacker.iid, blocker: blocker.iid }],
        phase: 'blockersDeclared' as const, damagePrevented: false };
      const before = combatForecast(bare, db, combat);
      const after = combatForecast(linked, db, combat);
      const saved = before.dying.includes(hostIid) && !after.dying.includes(hostIid);
      const won = !before.dying.includes(enemy.iid) && after.dying.includes(enemy.iid);
      return (saved ? permValue(bare, db, hostIid) : 0) + (won ? permValue(bare, db, enemy.iid) : 0);
    };
    // One enemy is one opportunity, whether the host attacks it or blocks it.
    fightGain += Math.max(gainInFight(host, enemy), gainInFight(enemy, host));
    // Evasion earns a fit bonus only against a blocker it actually bypasses.
    if (pairIsLegal(bare, host, enemy) && !pairIsLegal(linked, host, enemy)) fightGain += 1;
  }
  if (enemies.length) fit += fightGain / enemies.length;
  return fit;
}

/** Initial links prefer rider fit, with body value breaking ties. Moving an
 * existing link must repay its mana and a tempo margin; an equal fit never moves. */
export function chooseUnlinkedHauntlink(
  view: PlayerView, db: CardDb, legal: readonly Action[],
): LinkHauntAction | undefined {
  const candidates = legal.flatMap((action) => {
    if (action.type !== 'linkHaunt') return [];
    const carrier = view.battlefield.find((perm) => perm.iid === action.iid)!;
    const fit = hauntlinkHostFit(view.battlefield, db, action.iid, action.hostIid);
    if (carrier.attachedTo !== undefined) {
      const previous = hauntlinkHostFit(view.battlefield, db, action.iid, carrier.attachedTo);
      const cost = manaValue(def(db, carrier.cardId).hauntlink!.cost) * LINK_MANA_RATE;
      if (fit - previous <= cost + MOVE_MARGIN) return [];
      const moved = removeDoomed(withHost(view.battlefield, action.iid, action.hostIid), db);
      if (view.battlefield.some((perm) => perm.controller === view.myId && isType(def(db, perm.cardId), 'creature') &&
        !moved.some((remaining) => remaining.iid === perm.iid))) return [];
    }
    return [{ action, fit, body: permValue(withHost(view.battlefield, action.iid), db, action.hostIid) }];
  });
  candidates.sort((a, b) => b.fit - a.fit || b.body - a.body);
  return candidates[0]?.action;
}

/** Only the direct, public state-based consequences are projected. No draw,
 * hidden-card identity, future trigger choice, or opponent action is invented. */
function removeDoomed(battlefield: Permanent[], db: CardDb): Permanent[] {
  let board = battlefield;
  for (let guard = 0; guard < battlefield.length; guard++) {
    const doomed = new Set(board.filter((perm) => {
      if (perm.attachedTo !== undefined && !board.some((host) => host.iid === perm.attachedTo)) return true;
      if (!isType(def(db, perm.cardId), 'creature')) return false;
      const stats = getEffectiveStats(board, db, perm.iid);
      return stats.defense <= perm.damage || perm.deathtouched && perm.damage > 0;
    }).map((perm) => perm.iid));
    if (!doomed.size) return board;
    board = board.filter((perm) => !doomed.has(perm.iid));
  }
  return board;
}

/** Project the held trigger's immediate public effects. The determinized state
 * supplies the engine target validator's typed context only: its hidden-zone
 * stand-ins are never evaluated or executed by this policy. */
function projectTrigger(view: PlayerView, db: CardDb, battlefield: Permanent[], trigger: HeldTrigger): Permanent[] | undefined {
  // A trigger held in the middle of an effect carries the rest of that effect
  // (and any choice resuming behind it). Those ops resolve straight after the
  // trigger and are not modelled here, so the forecast is unknown.
  if (trigger.continuations?.some((frame) => frame.ops.length > 0)) return undefined;
  const context = { ...determinize(view, db).instanceState, battlefield: structuredClone(battlefield) };
  const creature = (perm: Permanent): boolean => isType(def(db, perm.cardId), 'creature');
  const visit = (ops: readonly EffectOp[], branchSlot?: number): boolean => {
    for (const op of ops) {
      const slot = 'targetIndex' in op && op.targetIndex !== undefined ? op.targetIndex : branchSlot ?? 0;
      const slots = op.op === 'moveMark' ? trigger.targets.map((_, i) => i) : [slot];
      const refs = slots.flatMap((index) => {
        const ref = trigger.targets[index];
        const spec = trigger.targetSpecs?.[index];
        return ref && (!spec || isLegalTarget(context, db, trigger.controller, spec, ref, trigger.sourceIid)) ? [ref] : [];
      });
      const targets = refs.flatMap((ref) => ref.kind === 'permanent'
        ? context.battlefield.filter((perm) => perm.iid === ref.iid) : []);
      const source = context.battlefield.find((perm) => perm.iid === trigger.sourceIid);
      const remove = (perms: readonly Permanent[]): void => {
        const ids = new Set(perms.map((perm) => perm.iid));
        context.battlefield = context.battlefield.filter((perm) => !ids.has(perm.iid));
      };
      switch (op.op) {
        case 'ifTargetMarked':
          if (refs.length && !visit(targets[0]?.plusOneCounters > 0 ? op.then : op.else ?? [], slot)) return false;
          break;
        case 'damage': {
          const affected = op.to === 'eachCreature' || op.to === 'eachOpponentCreature'
            ? context.battlefield.filter((perm) => creature(perm) && (op.to !== 'eachOpponentCreature' || perm.controller !== trigger.controller))
            : op.to === 'target' ? targets : [];
          for (const perm of affected) perm.damage += Math.max(0, op.n === 'X' ? 0 : op.n);
          break;
        }
        case 'boost': {
          const affected = op.scope === 'target' ? targets : op.scope === 'self' ? source ? [source] : []
            : context.battlefield.filter((perm) => creature(perm) &&
              (op.scope === 'all' || (op.scope === 'theirMarked' ? perm.controller !== trigger.controller : perm.controller === trigger.controller)) &&
              (op.scope !== 'yourMarked' && op.scope !== 'theirMarked' || perm.plusOneCounters > 0));
          for (const perm of affected) perm.untilEotMods.push({ p: op.p, t: op.t, keywords: op.keywords ?? [] });
          break;
        }
        case 'destroy': case 'sever': case 'recall': remove(targets); break;
        case 'severSelf': if (source) remove([source]); break;
        case 'destroyArtifactOrSeverEnchantment':
          remove(targets.filter((perm) => isType(def(db, perm.cardId), 'artifact') || isType(def(db, perm.cardId), 'enchantment')));
          break;
        case 'destroyNewestOpponentArtifactOrEnchantment': {
          const newest = [...context.battlefield].reverse().find((perm) => perm.controller !== trigger.controller &&
            (isType(def(db, perm.cardId), 'artifact') || isType(def(db, perm.cardId), 'enchantment')));
          if (newest) remove([newest]);
          break;
        }
        case 'massDestroy':
          remove(context.battlefield.filter((perm) => op.filter === 'allEnchantments' ? isType(def(db, perm.cardId), 'enchantment')
            : creature(perm) && (op.filter !== 'allFliers' || getEffectiveStats(context.battlefield, db, perm.iid).keywords.has('skyborne'))));
          break;
        case 'removeMarks': for (const perm of targets.filter(creature)) perm.plusOneCounters = 0; break;
        case 'addCounters':
          for (const perm of (op.to === 'self' ? source ? [source] : [] : targets).filter(creature)) perm.plusOneCounters += op.n;
          break;
        case 'moveMark':
          if (targets.length === 2 && refs.length === trigger.targets.length && targets[0].iid !== targets[1].iid &&
            targets.every((perm) => creature(perm) && perm.controller === trigger.controller) && targets[0].plusOneCounters > 0) {
            targets[0].plusOneCounters--; targets[1].plusOneCounters++;
          }
          break;
        case 'propagate': case 'markAll':
          for (const perm of context.battlefield.filter((perm) => creature(perm) && perm.controller === trigger.controller &&
            (op.op === 'propagate' ? perm.plusOneCounters > 0 : !op.other || perm.iid !== trigger.sourceIid))) perm.plusOneCounters++;
          break;
        case 'tap': for (const perm of targets) perm.tapped = true; break;
        // These do not change the battlefield stats or target legality used
        // by the direct trigger forecast, and do not fire board observers.
        case 'loseLife': case 'loseLifePerTheirMarked': case 'extraLandDrop':
        case 'preventCombat': case 'preventCombatTo': break;
        // Unmodelled operations are unknown, never assumed harmless. Tokens,
        // awakening, life-gain observers and hidden graveyard-entry triggers
        // can all invalidate an apparent survivor, just as deferred choices can.
        default: return false;
      }
    }
    return true;
  };
  if (!visit(trigger.ops)) return undefined;
  return removeDoomed(context.battlefield, db);
}

function hostHarm(before: readonly Permanent[], after: readonly Permanent[], db: CardDb, iid: number): number {
  const original = before.find((perm) => perm.iid === iid);
  if (!original) return 0;
  const remaining = after.find((perm) => perm.iid === iid);
  if (!remaining) return Math.max(1, permValue(before, db, iid)) + 2;
  const a = getEffectiveStats(before, db, iid);
  const b = getEffectiveStats(after, db, iid);
  return (Math.max(0, a.attack - b.attack) + Math.max(0, a.defense - original.damage - b.defense + remaining.damage)) / 2;
}

function combatWindowGain(view: PlayerView, db: CardDb, action: LinkHauntAction): number {
  if (!view.combat || view.fogThisTurn) return 0;
  const before = combatForecast(view.battlefield, db, view.combat);
  const changed = removeDoomed(withHost(view.battlefield, action.iid, action.hostIid), db);
  const after = combatForecast(changed, db, view.combat);
  if (view.activePlayer === view.myId ? after.damage < before.damage : after.damage > before.damage) return 0;
  let gain = 0;
  let improvedFight = false;
  for (const perm of view.battlefield.filter((perm) => isType(def(db, perm.cardId), 'creature'))) {
    const deadBefore = before.dying.includes(perm.iid);
    const deadAfter = after.dying.includes(perm.iid) || !changed.some((p) => p.iid === perm.iid);
    if (deadBefore === deadAfter) continue;
    // A rescue never purchases one friendly body with another friendly body.
    if (perm.controller === view.myId && !deadBefore && deadAfter) return 0;
    const sign = perm.controller === view.myId ? 1 : -1;
    const delta = (deadBefore ? 1 : -1) * sign;
    if (delta > 0) improvedFight = true;
    gain += delta * permValue(view.battlefield, db, perm.iid);
  }
  // A link on a doomed combatant dies too, even though it is not a combatant.
  for (const carrier of view.battlefield.filter((perm) => def(db, perm.cardId).hauntlink)) {
    const current = changed.find((perm) => perm.iid === carrier.iid);
    const lostBefore = carrier.attachedTo !== undefined && before.dying.includes(carrier.attachedTo);
    const lostAfter = !current || current.attachedTo !== undefined && after.dying.includes(current.attachedTo);
    if (lostBefore !== lostAfter) gain += (lostBefore ? 1 : -1) *
      (carrier.controller === view.myId ? 1 : -1) * Math.max(1, permValue(view.battlefield, db, carrier.iid));
  }
  return improvedFight ? gain : 0;
}

function triggerWindowGain(view: PlayerView, db: CardDb, action: LinkHauntAction): number {
  const trigger = view.pendingDecisions?.[0];
  if (trigger?.kind !== 'resolveTrigger') return 0;
  const carrier = view.battlefield.find((perm) => perm.iid === action.iid)!;
  const baseline = projectTrigger(view, db, view.battlefield, trigger);
  if (!baseline) return 0;
  const changed = removeDoomed(withHost(view.battlefield, action.iid, action.hostIid), db);
  const projected = projectTrigger(view, db, changed, trigger);
  if (!projected) return 0;
  if (!projected.some((perm) => perm.iid === action.hostIid) || !projected.some((perm) => perm.iid === action.iid)) return 0;
  if (baseline.some((perm) => perm.controller === view.myId && isType(def(db, perm.cardId), 'creature') &&
    !projected.some((remaining) => remaining.iid === perm.iid))) return 0;
  if (carrier.attachedTo === undefined) {
    // A fresh defensive link can also save the threatened prospective host.
    return hostHarm(view.battlefield, baseline, db, action.hostIid) - hostHarm(changed, projected, db, action.hostIid);
  }
  const harm = hostHarm(view.battlefield, baseline, db, carrier.attachedTo);
  if (harm <= 0) return 0;
  const destinationHarm = hostHarm(changed, projected, db, action.hostIid);
  // Equal board-wide shrink is no reason to shuttle a free link forever.
  return harm - destinationHarm;
}

function windowGain(view: PlayerView, db: CardDb, action: LinkHauntAction): number {
  if (view.awaiting.kind !== 'hauntlinkWindow') return 0;
  return view.awaiting.over.type === 'combatDamage' ? combatWindowGain(view, db, action) : triggerWindowGain(view, db, action);
}

/** Rank every legal link, including forecast-neutral ones: Hard's exact engine
 * search can discover improvements beyond this planner's keyword model. */
export function rankedHauntlinkWindowCandidates(
  view: PlayerView, db: CardDb, legal: readonly Action[],
): LinkHauntAction[] {
  if (view.awaiting.kind !== 'hauntlinkWindow') return [];
  return legal.filter((action): action is LinkHauntAction => action.type === 'linkHaunt')
    .map((action) => ({ action, gain: windowGain(view, db, action),
      fit: hauntlinkHostFit(view.battlefield, db, action.iid, action.hostIid),
      body: permValue(view.battlefield, db, action.hostIid) }))
    .sort((a, b) => b.gain - a.gain || b.fit - a.fit || b.body - a.body)
    .map(({ action }) => action);
}

/** All brains share the deliberate revision-4 rescue policy. A helpful link
 * must improve the pending public event; ordinary equal-fit moves still pass. */
export function chooseHauntlinkWindow(
  view: PlayerView, db: CardDb, legal: readonly Action[],
): LinkHauntAction | undefined {
  return rankedHauntlinkWindowCandidates(view, db, legal).find((action) => windowGain(view, db, action) > 0);
}
