import type { Action } from '../engine/actions';
import { getEffectiveStats } from '../engine/statics';
import type { AbilityDef, CardDb, EffectOp, Permanent, PlayerId, TargetRef } from '../engine/types';
import { def, isType, opponentOf } from '../engine/types';
import type { PlayerView } from '../engine/view';
import {
  cardValue,
  opImpactValue,
  removalTargetValue,
} from './value';

type ChooseTargetAction = Extract<Action, { type: 'chooseTarget' }>;

interface TargetContext {
  view: PlayerView;
  db: CardDb;
  source: Permanent;
  ability: AbilityDef;
}

function permanentFor(ctx: TargetContext, ref: TargetRef): Permanent | undefined {
  return ref.kind === 'permanent'
    ? ctx.view.battlefield.find((perm) => perm.iid === ref.iid)
    : undefined;
}

function playerFor(ctx: TargetContext, ref: TargetRef): PlayerId | undefined {
  if (ref.kind === 'player' || ref.kind === 'grave') return ref.player;
  if (ref.kind === 'permanent') return permanentFor(ctx, ref)?.controller;
  return ctx.view.stack.find((item) => item.sid === ref.sid)?.controller;
}

function harmSign(ctx: TargetContext, ref: TargetRef): number {
  const player = playerFor(ctx, ref);
  return player === opponentOf(ctx.view.myId) ? 1 : -1;
}

function permanentRemovalValue(ctx: TargetContext, perm: Permanent): number {
  return Math.max(0, removalTargetValue(ctx.view.battlefield, ctx.db, perm));
}

function damageTargetValue(ctx: TargetContext, op: Extract<EffectOp, { op: 'damage' }>, ref: TargetRef): number {
  if (op.to !== 'target' || op.n === 'X') return 0;
  const perm = permanentFor(ctx, ref);
  if (!perm) return op.n * 0.9 * harmSign(ctx, ref);
  const d = def(ctx.db, perm.cardId);
  if (!isType(d, 'creature')) return 0;
  const stats = getEffectiveStats(ctx.view.battlefield, ctx.db, perm.iid);
  const lethal = op.n >= stats.defense - perm.damage;
  const impact = lethal
    ? permanentRemovalValue(ctx, perm)
    : op.n * 0.45 + perm.plusOneCounters * 0.15;
  return impact * harmSign(ctx, ref);
}

function boostTargetValue(
  ctx: TargetContext,
  op: Extract<EffectOp, { op: 'boost' }>,
  ref: TargetRef,
): number {
  if (op.scope !== 'target') return 0;
  const perm = permanentFor(ctx, ref);
  if (!perm || !isType(def(ctx.db, perm.cardId), 'creature')) return 0;
  const printedDelta = (op.p + op.t) / 2 + (op.keywords?.length ?? 0) * 0.5;
  // A positive boost helps our body and hurts theirs; a negative boost has the
  // opposite sign. The 0.75 factor keeps a one-turn trick below removal.
  return printedDelta * (perm.controller === ctx.view.myId ? 1 : -1) * 0.75;
}

function markCounterValue(ctx: TargetContext, op: Extract<EffectOp, { op: 'addCounters' }>, ref: TargetRef): number {
  if (op.to !== 'target') return 0;
  const perm = permanentFor(ctx, ref);
  if (!perm) return 0;
  return op.n * 1.2 * (perm.controller === ctx.view.myId ? 1 : -1);
}

function effectOnTarget(ctx: TargetContext, op: EffectOp, ref: TargetRef): number {
  switch (op.op) {
    case 'damage':
      return damageTargetValue(ctx, op, ref);
    case 'destroy':
    case 'sever':
    case 'destroyArtifactOrSeverEnchantment': {
      const perm = permanentFor(ctx, ref);
      if (!perm) return 0;
      const multiplier = op.op === 'destroy' ? 1 : op.op === 'sever' ? 0.9 : 0.85;
      return permanentRemovalValue(ctx, perm) * multiplier * harmSign(ctx, ref);
    }
    case 'recall': {
      const perm = permanentFor(ctx, ref);
      return perm ? permanentRemovalValue(ctx, perm) * 0.65 * harmSign(ctx, ref) : 0;
    }
    case 'cancel': {
      const item = ref.kind === 'stackItem'
        ? ctx.view.stack.find((entry) => entry.sid === ref.sid)
        : undefined;
      return item ? cardValue(ctx.db, item.cardId) * harmSign(ctx, ref) : 0;
    }
    case 'boost':
      return boostTargetValue(ctx, op, ref);
    case 'addCounters':
      return markCounterValue(ctx, op, ref);
    case 'removeMarks': {
      const perm = permanentFor(ctx, ref);
      if (!perm) return 0;
      // Marks are printed power. Removing theirs is disruption; removing ours
      // is a cost. The op-level value is deliberately reused as the floor.
      return opImpactValue(op) * perm.plusOneCounters * harmSign(ctx, ref);
    }
    case 'tap': {
      const perm = permanentFor(ctx, ref);
      return perm ? Math.max(0.5, permanentRemovalValue(ctx, perm) * 0.3) * harmSign(ctx, ref) : 0;
    }
    case 'ifTargetMarked': {
      const perm = permanentFor(ctx, ref);
      const branch = perm?.plusOneCounters ? op.then : (op.else ?? []);
      return branch.reduce((sum, nested) => sum + effectOnTarget(ctx, nested, ref), 0);
    }
    case 'raise':
    case 'reclaim': {
      if (ref.kind !== 'grave' || ref.player !== ctx.view.myId) return 0;
      const cards = ref.player === ctx.view.myId ? ctx.view.you.graveyard : ctx.view.opp.graveyard;
      const cardId = cards[ref.index];
      if (!cardId) return 0;
      return cardValue(ctx.db, cardId) * (op.op === 'raise' ? 1 : 0.7);
    }
    case 'moveMark': {
      // A move has two targets and is not a targeted-arrival shape. Keep a
      // small neutral floor for any caller that ranks the op as a whole.
      return opImpactValue(op);
    }
    default:
      // Target-independent ops do not break a target tie. Their value is
      // still routed through the shared op-impact machinery for future ops.
      return 0;
  }
}

function sourceAbility(view: PlayerView, db: CardDb): TargetContext | undefined {
  const awaiting = view.awaiting;
  if (awaiting.kind !== 'chooseTarget') return undefined;
  const source = view.battlefield.find((perm) => perm.iid === awaiting.sourceIid);
  if (!source) return undefined;
  const ability = def(db, source.cardId).abilities?.[awaiting.abilityIndex];
  return ability ? { view, db, source, ability } : undefined;
}

/**
 * Public-board value of choosing `ref` for the currently queued arrival. A
 * strict `>` caller preserves the legalActions battlefield order on ties.
 */
export function targetChoiceValue(view: PlayerView, db: CardDb, ref: TargetRef): number {
  const ctx = sourceAbility(view, db);
  if (!ctx) return 0;
  return (ctx.ability.ops ?? []).reduce((sum, op) => sum + effectOnTarget(ctx, op, ref), 0);
}

/** Greedy target selection shared by Easy and Medium, and as Hard's fallback. */
export function chooseTargetAction(
  view: PlayerView,
  db: CardDb,
  legal: readonly Action[],
): Action {
  const choices = legal.filter((action): action is ChooseTargetAction => action.type === 'chooseTarget');
  if (choices.length === 0) return legal[0];
  let best = choices[0];
  let bestValue = targetChoiceValue(view, db, best.target);
  for (const choice of choices.slice(1)) {
    const value = targetChoiceValue(view, db, choice.target);
    if (value > bestValue) {
      best = choice;
      bestValue = value;
    }
  }
  return best;
}
