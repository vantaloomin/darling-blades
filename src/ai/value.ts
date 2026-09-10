import type { Action } from '../engine/actions';
import { getEffectiveStats } from '../engine/statics';
import type { AbilityDef, ActivatedDef, CardDb, EffectOp, Keyword, Permanent, PlayerId, TargetRef, TargetSpec } from '../engine/types';
import { def, effectOpUsesTarget, isType, manaValue, opponentOf } from '../engine/types';
import type { PlayerView } from '../engine/view';

const KEYWORD_BONUS: Record<Keyword, number> = {
  skyborne: 1,
  deathblade: 1,
  bloodoath: 0.5,
  firstBlade: 0.5,
  twinBlades: 1.5,
  overrun: 0.5,
  sentinel: 0.25,
  warcry: 0.25,
  wardingGaze: 0.25,
  untouchable: 0.5,
  bulwark: -0.5,
  dreaded: 1,
  // Negative for the same reason Bulwark is: it takes a decision away from the
  // controller. Small, because the creatures that carry it are built to attack
  // anyway, so the compulsion only bites once the board turns against them.
  rage: -0.25,
};

function keywordScore(keywords: Iterable<Keyword>): number {
  let s = 0;
  for (const k of keywords) s += KEYWORD_BONUS[k];
  return s;
}

/** Modest free-value premium while a Nine Lives body still has no marks. */
export const NINE_LIVES_BONUS = 1;

export function nineLivesValue(
  d: ReturnType<typeof def>,
  plusOneCounters = 0,
): number {
  return d.nineLives && plusOneCounters === 0 ? NINE_LIVES_BONUS : 0;
}

function isLordOrLegendary(db: CardDb, cardId: string): boolean {
  const d = def(db, cardId);
  if (d.supertypes?.includes('legendary')) return true;
  return (d.abilities ?? []).some((ab) => ab.when === 'static' && ab.static?.scope === 'filter');
}

function hasTriggeredAbility(db: CardDb, cardId: string): boolean {
  return (def(db, cardId).abilities ?? []).some(
    (ab) => ab.when !== 'static' && ab.when !== 'spell',
  );
}

function awakeningValue(d: ReturnType<typeof def>): number {
  return (
    ((d.awakening?.p ?? 0) + (d.awakening?.t ?? 0)) / 2 +
    keywordScore(d.awakening?.keywords ?? [])
  );
}

/**
 * Conditional Starborne abilities are real card text, but their floor is
 * lower than an unconditional body until the public board proves the gate.
 * These discounts are intentionally provisional: card-shaped value has no
 * battlefield, so target selection and evaluation do the exact board work.
 */
export function abilityConditionMultiplier(condition: AbilityDef['condition']): number {
  if (condition === 'controlMarked') return 0.55;
  if (typeof condition === 'object' && condition.kind === 'markedThreshold') return 0.5;
  return 1;
}

interface TargetContext {
  view: PlayerView;
  db: CardDb;
  source: Permanent;
  ability: Pick<AbilityDef, 'ops'>;
  includeActivated: boolean;
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
  return Math.max(0, removalTargetValue(ctx.view.battlefield, ctx.db, perm, ctx.includeActivated));
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

/**
 * A mark is only worth what the body carrying it survives to do. Among our
 * own creatures prefer the one that keeps the mark alive (toughness, evasion,
 * no damage on it) and, when a threshold payoff is in play or in hand, spread
 * marks over unmarked bodies: thresholds and the marked-filter lords count
 * creatures, not counters.
 */
function markCounterValue(ctx: TargetContext, op: Extract<EffectOp, { op: 'addCounters' }>, ref: TargetRef): number {
  if (op.to !== 'target') return 0;
  const perm = permanentFor(ctx, ref);
  if (!perm || !isType(def(ctx.db, perm.cardId), 'creature')) return 0;
  if (perm.controller !== ctx.view.myId) return -op.n * 1.2;
  const stats = getEffectiveStats(ctx.view.battlefield, ctx.db, perm.iid);
  const toughnessAfter = stats.defense + op.n - perm.damage;
  let value = op.n * 1.2;
  if (toughnessAfter >= 4) value += 0.4;
  else if (toughnessAfter <= 1) value -= 0.4;
  if (stats.keywords.has('skyborne') || stats.keywords.has('untouchable')) value += 0.3;
  if (perm.plusOneCounters === 0) {
    value += 0.2;
    if (hasMarkPayoff(ctx.view.battlefield, ctx.db, ctx.view.myId, ctx.view.you.hand)) value += 0.5;
  }
  return value;
}

function effectOnTarget(ctx: TargetContext, op: EffectOp, ref: TargetRef): number {
  switch (op.op) {
    case 'damage':
      return damageTargetValue(ctx, op, ref);
    case 'destroy':
    case 'sever':
    case 'destroyArtifactOrSeverEnchantment': {
      const perm = permanentFor(ctx, ref);
      if (!perm || !isType(def(ctx.db, perm.cardId), 'creature')) return 0;
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
      if (!perm || !isType(def(ctx.db, perm.cardId), 'creature')) return 0;
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
      const branch = perm &&
        isType(def(ctx.db, perm.cardId), 'creature') &&
        perm.plusOneCounters > 0
        ? op.then
        : (op.else ?? []);
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

/** Ability-scoped public target scoring, shared by arrivals and Duty. */
export function targetValueForAbility(
  view: PlayerView,
  db: CardDb,
  source: Permanent,
  ability: Pick<AbilityDef, 'ops'>,
  ref: TargetRef,
  includeActivated = true,
): number {
  const ctx: TargetContext = { view, db, source, ability, includeActivated };
  return (ability.ops ?? []).reduce((sum, op) => sum + effectOnTarget(ctx, op, ref), 0);
}

interface ActivatedImpactContext {
  view: PlayerView;
  db: CardDb;
  source: Permanent;
  targets: readonly TargetRef[];
  targetBatch: boolean;
  /** Board-only potential has no supplied deck count. Action scoring does. */
  trackDeck: boolean;
}

export function opImpactValue(op: EffectOp, activated?: ActivatedImpactContext): number {
  if (activated) return activatedOpImpact(op, activated);
  switch (op.op) {
    case 'gainLife':
      return op.n * 0.35;
    case 'loseLife':
      return op.n * 1.1;
    case 'damage':
      return op.to === 'opponent' ? (op.n === 'X' ? 0 : op.n * 0.9) : 0;
    case 'draw':
      return op.n * 1.25;
    case 'discardRandom':
      return op.n * 1;
    case 'createToken':
      return op.count * 1.5;
    case 'addCounters':
      return op.n * (op.to === 'self' ? 1.5 : 1.2);
    case 'propagate':
      // Propagate's real worth is one Mark per already-Marked creature, so it
      // is board-dependent and ranges from 0 (bare board) upward. This switch
      // sees only the op — its callers (`nonCreatureAbilityImpact`,
      // `retellValue`) are card-shaped, not board-shaped — so price it at the
      // conservative single-mark floor rather than widening the signature.
      // One marked creature is the least a card printing this can expect.
      return 1.5;
    case 'boost':
      return op.scope === 'allYours' || op.scope === 'yourMarked' || op.scope === 'theirMarked'
        ? (Math.max(0, op.p + op.t) / 2 + (op.keywords?.length ?? 0) * 0.5) *
          (op.scope === 'theirMarked' ? 0.65 : 1)
        : 0;
    case 'moveMark':
      // The net mark count is unchanged. Price the destination trigger and
      // flexibility conservatively until a board-aware caller can inspect
      // both source and destination. Provisional value.
      return 0.75;
    case 'removeMarks':
      // Removing an opposing mark is useful, but removing our own mark is a
      // cost. Target-aware scoring supplies the sign. Provisional floor.
      return 0.75;
    case 'markAll':
      // One mark across a relevant creature is the card-shaped floor.
      return 1.25;
    case 'loseLifePerTheirMarked':
      // One marked opposing creature is the least meaningful public board.
      return 1.1;
    case 'fetchLand':
      // Deck composition and landfall-like arrivals are unavailable here.
      return 1;
    case 'severSelf':
      // This is a sacrifice-like cost, not a benefit of the trigger.
      return -1.5;
    case 'raise':
      return op.to === 'top' ? 2.5 + (op.withMarks ?? 0) * 0.65 : 2;
    case 'ifTargetMarked': {
      const thenValue = op.then.reduce((sum, nested) => sum + opImpactValue(nested), 0);
      const elseValue = (op.else ?? []).reduce((sum, nested) => sum + opImpactValue(nested), 0);
      // A card-shaped estimate cannot know whether the target is marked. Keep
      // only a conservative portion of the better branch's upside.
      return Math.min(thenValue, elseValue) * 0.4 + Math.max(thenValue, elseValue) * 0.6;
    }
    case 'severGrave':
      return op.who === 'opponent' ? op.n * 0.6 : 0;
    case 'foresee':
      return op.n * 0.5;
    case 'awaken':
      return op.scope === 'allYours' ? 1.5 : 0;
    case 'massDestroy':
      return op.filter === 'allEnchantments' ? 2.5 : 2;
    case 'destroyNewestOpponentArtifactOrEnchantment':
      return 3;
    default:
      return 0;
  }
}

/** Duty scores a supplied op directly, without a synthetic arrival decision. */
function activatedTargetImpact(op: EffectOp, ctx: ActivatedImpactContext, ref: TargetRef): number {
  const { view, db, source } = ctx;
  const target = ref.kind === 'permanent' ? view.battlefield.find((p) => p.iid === ref.iid) : undefined;
  // The arrival picker historically restricts these removal ops to creatures.
  // Duty also permits artifact/enchantment targets, valued by the same material helper.
  if (target && (op.op === 'destroy' || op.op === 'sever' || op.op === 'destroyArtifactOrSeverEnchantment')) {
    const factor = op.op === 'destroy' ? 1 : op.op === 'sever' ? 0.9 : 0.85;
    return removalTargetValue(view.battlefield, db, target, false) * factor * (target.controller === view.myId ? -1 : 1);
  }
  if (target && op.op === 'boost' && isType(def(db, target.cardId), 'creature') &&
    getEffectiveStats(view.battlefield, db, target.iid).defense + op.t <= target.damage) {
    return removalTargetValue(view.battlefield, db, target, false) * (target.controller === view.myId ? -1 : 1);
  }
  if (op.op === 'tap' && target?.tapped) return 0;
  if (op.op === 'foresee' && op.who === 'targetOwner') {
    const owner = target?.owner ?? (ref.kind === 'player' || ref.kind === 'grave' ? ref.player : undefined);
    return owner === undefined ? 0 : op.n * 0.5 * (owner === view.myId ? 1 : -1);
  }
  return targetValueForAbility(view, db, source, { ops: [op] }, ref, false);
}

/** Signed public-board scoring used only by the new activated rider. */
function activatedOpImpact(op: EffectOp, ctx: ActivatedImpactContext): number {
  const { view, db, source } = ctx;
  const refs = ctx.targetBatch ? ctx.targets : ctx.targets.slice(0, 1);
  const material = (perm: Permanent): number => removalTargetValue(view.battlefield, db, perm, false);
  if (op.op === 'ifTargetMarked') {
    return refs.reduce((sum, ref) => {
      const target = ref.kind === 'permanent' ? view.battlefield.find((p) =>
        p.iid === ref.iid && isType(def(db, p.cardId), 'creature')) : undefined;
      const branch = target && target.plusOneCounters > 0 ? op.then : (op.else ?? []);
      return sum + activatedOpsImpact(branch, {
        ...ctx, targets: [ref], targetBatch: false,
      });
    }, 0);
  }
  if (op.op !== 'moveMark' && effectOpUsesTarget(op)) {
    return refs.reduce((sum, ref) => sum + activatedTargetImpact(op, ctx, ref), 0);
  }
  const creatures = view.battlefield.filter((p) => isType(def(db, p.cardId), 'creature'));
  const mine = creatures.filter((p) => p.controller === view.myId);
  if (op.op === 'moveMark') {
    const targets = ctx.targets.filter((ref) => ref.kind === 'permanent');
    const from = mine.find((p) => p.iid === targets[0]?.iid);
    const to = mine.find((p) => p.iid === targets[1]?.iid);
    if (!from || !to || from.iid === to.iid || from.plusOneCounters <= 0) return 0;
    const mark: EffectOp = { op: 'addCounters', n: 1, to: 'target' };
    return activatedTargetImpact(mark, ctx, { kind: 'permanent', iid: to.iid }) -
      activatedTargetImpact(mark, ctx, { kind: 'permanent', iid: from.iid });
  }
  if (op.op === 'draw' && ctx.trackDeck && op.n > view.you.deckCount) return -Infinity;
  if (op.op === 'damage') {
    if (op.to === 'controller') return op.n === 'X' ? 0 : -op.n * 0.9;
    if (op.to === 'eachCreature') return symmetricCreatureSweepValue(view.battlefield, db, view.myId, op, false);
  }
  if (op.op === 'severSelf') return -Math.max(1.5, material(source));
  if (op.op === 'massDestroy') {
    return view.battlefield.reduce((sum, perm) => {
      const card = def(db, perm.cardId);
      const affected = op.filter === 'allEnchantments' ? isType(card, 'enchantment') :
        isType(card, 'creature') && (op.filter !== 'allFliers' ||
          getEffectiveStats(view.battlefield, db, perm.iid).keywords.has('skyborne'));
      return sum + (affected ? material(perm) * (perm.controller === view.myId ? -1 : 1) : 0);
    }, 0);
  }
  if (op.op === 'boost') {
    const affected = creatures.filter((p) => op.scope === 'all' ||
      (op.scope === 'theirMarked' ? p.controller !== view.myId : p.controller === view.myId) &&
      (op.scope !== 'yourMarked' && op.scope !== 'theirMarked' || p.plusOneCounters > 0));
    return affected.reduce((sum, perm) => sum + activatedTargetImpact(
      { ...op, scope: 'target' }, ctx, { kind: 'permanent', iid: perm.iid },
    ), 0);
  }
  if (op.op === 'addCounters' && op.to === 'self') return isType(def(db, source.cardId), 'creature') ? opImpactValue(op) : 0;
  if (op.op === 'propagate') return mine.filter((p) => p.plusOneCounters > 0).length * opImpactValue(op);
  if (op.op === 'markAll') return mine.length * opImpactValue(op);
  if (op.op === 'loseLifePerTheirMarked') return creatures.filter((p) => p.controller !== view.myId && p.plusOneCounters > 0).length * opImpactValue(op);
  if (op.op === 'severGrave' && op.who === 'self') return -op.n * 0.6;
  return opImpactValue(op);
}

/**
 * Keep only the public facts later ops explicitly inspect: current marks and
 * remaining draw capacity. This is a local scoring projection, not a second
 * engine interpreter; triggers and hidden drawn card identities are not inferred.
 */
function activatedOpsImpact(ops: readonly EffectOp[], ctx: ActivatedImpactContext): number {
  let value = 0;
  for (const op of ops) {
    value += opImpactValue(op, ctx);
    if (!Number.isFinite(value)) return value;
    if (op.op === 'draw' && ctx.trackDeck) ctx.view.you.deckCount -= op.n;
    if (op.op !== 'removeMarks' && op.op !== 'addCounters' && op.op !== 'markAll' &&
      op.op !== 'propagate' && op.op !== 'moveMark') continue;
    const creatures = ctx.view.battlefield.filter((p) => isType(def(ctx.db, p.cardId), 'creature'));
    const mine = creatures.filter((p) => p.controller === ctx.view.myId);
    const refs = ctx.targetBatch ? ctx.targets : ctx.targets.slice(0, 1);
    const targets = creatures.filter((p) => refs.some((ref) => ref.kind === 'permanent' && ref.iid === p.iid));
    if (op.op === 'removeMarks') {
      for (const target of targets) target.plusOneCounters = 0;
    } else if (op.op === 'addCounters') {
      const affected = op.to === 'self' ? creatures.filter((p) => p.iid === ctx.source.iid) : targets;
      for (const target of affected) target.plusOneCounters += Math.max(0, op.n);
    } else if (op.op === 'markAll' || op.op === 'propagate') {
      for (const target of mine) {
        if (op.op === 'markAll' || target.plusOneCounters > 0) target.plusOneCounters++;
      }
    } else if (op.op === 'moveMark') {
      const permanentRefs = ctx.targets.filter((ref) => ref.kind === 'permanent');
      const from = mine.find((p) => p.iid === permanentRefs[0]?.iid);
      const to = mine.find((p) => p.iid === permanentRefs[1]?.iid);
      if (from && to && from.iid !== to.iid && from.plusOneCounters > 0) {
        from.plusOneCounters--;
        to.plusOneCounters++;
      }
    }
  }
  return value;
}

export function activateActionValue(
  view: PlayerView,
  db: CardDb,
  action: Extract<Action, { type: 'activate' }>,
): number {
  return activatedActionImpact(view, db, action, true);
}

/** Mark writes can couple optional targets through later ops or branches. */
function activatedWritesMarks(ops: readonly EffectOp[]): boolean {
  return ops.some((op) => op.op === 'addCounters' || op.op === 'removeMarks' ||
    op.op === 'markAll' || op.op === 'propagate' || op.op === 'moveMark' ||
    (op.op === 'ifTargetMarked' &&
      (activatedWritesMarks(op.then) || activatedWritesMarks(op.else ?? []))));
}

function activatedActionImpact(
  view: PlayerView,
  db: CardDb,
  action: Extract<Action, { type: 'activate' }>,
  trackDeck: boolean,
): number {
  const source = view.battlefield.find((p) => p.iid === action.iid);
  const ability = source && def(db, source.cardId).activated;
  if (!source || !ability) return -Infinity;
  const ctx: ActivatedImpactContext = {
    view: {
      ...view, you: { ...view.you },
      battlefield: activatedWritesMarks(ability.ops)
        ? view.battlefield.map((perm) => ({ ...perm })) : view.battlefield,
    },
    db, source, trackDeck,
    targets: action.targets ?? [],
    targetBatch: ability.targets?.length === 1 && ability.targets[0].upTo !== undefined,
  };
  return activatedOpsImpact(ability.ops, ctx);
}

/** Potential targets from public battlefield data; no GameState or hidden zones. */
function activatedPotentialTargets(view: PlayerView, db: CardDb, source: Permanent, spec: TargetSpec): TargetRef[] {
  const refs: TargetRef[] = [];
  for (const perm of view.battlefield) {
    if (spec.other && perm.iid === source.iid || spec.tapped && !perm.tapped) continue;
    const card = def(db, perm.cardId);
    const creature = isType(card, 'creature');
    if (spec.marked && (!creature || perm.plusOneCounters <= 0)) continue;
    const mine = perm.controller === source.controller;
    const creatureTarget = spec.what === 'creature' || spec.what === 'any';
    if (creatureTarget && !mine && getEffectiveStats(view.battlefield, db, perm.iid).keywords.has('untouchable')) continue;
    const matches = creatureTarget ? creature : spec.what === 'yourCreature' ? mine && creature :
      spec.what === 'yourPermanent' ? mine : spec.what === 'artifactOrEnchantment' ?
        isType(card, 'artifact') || isType(card, 'enchantment') :
        (spec.what === 'artifact' || spec.what === 'enchantment') && isType(card, spec.what);
    if (matches) refs.push({ kind: 'permanent', iid: perm.iid });
  }
  if ((spec.what === 'any' || spec.what === 'player') && !spec.marked && !spec.tapped) {
    refs.push({ kind: 'player', player: source.controller }, { kind: 'player', player: opponentOf(source.controller) });
  }
  return refs;
}

/**
 * One use's potential from the permValue public-board contract. Unavailable
 * hand/grave/stack information stays empty in this neutral view projection;
 * it is not an inferred deck or a fabricated hidden state. Readiness and mana
 * are deliberately ignored: a tapped or newly arrived rider is still valuable.
 */
export function activatedAbilityValue(battlefield: readonly Permanent[], db: CardDb, iid: number): number {
  const source = battlefield.find((p) => p.iid === iid);
  const ability = source && def(db, source.cardId).activated;
  if (!source || !ability) return 0;
  const view: PlayerView = {
    myId: source.controller, activePlayer: source.controller, startingPlayer: source.controller,
    turn: 0, step: 'main2', battlefield: [...battlefield], stack: [], combat: null,
    fogThisTurn: false, awaiting: { kind: 'main', player: source.controller }, winner: null,
    you: { life: 0, hand: [], deckCount: 0, graveyard: [], severed: [], landDropsRemaining: 0, mulligans: 0 },
    opp: { life: 0, handCount: 0, deckCount: 0, graveyard: [], severed: [], landDropsRemaining: 0, mulligans: 0 },
  };
  let lists: TargetRef[][] = [[]];
  for (const spec of ability.targets ?? []) {
    const refs = activatedPotentialTargets(view, db, source, spec);
    if (spec.upTo !== undefined) {
      const score = (targets: TargetRef[]): number =>
        activatedActionImpact(view, db, { type: 'activate', iid, targets }, false);
      const singles = refs.map((ref, index) => ({ ref, index, value: score([ref]) }));
      let best = Math.max(0, score([]), ...singles.map((entry) => entry.value));
      // Read-only ops are additive per target, with target-free ops paid once.
      // Four best singles suffice. Mark projections can couple targets, so
      // retain exact pairs for those uncommon shapes rather than change value.
      const candidates = activatedWritesMarks(ability.ops) ? singles : singles
        .sort((a, b) => b.value - a.value || a.index - b.index).slice(0, 4)
        .sort((a, b) => a.index - b.index);
      for (let first = 0; first < candidates.length; first++) {
        for (let second = first + 1; second < candidates.length; second++) {
          best = Math.max(best, score([candidates[first].ref, candidates[second].ref]));
        }
      }
      return best;
    } else {
      lists = lists.flatMap((chosen) => refs.map((ref) => [...chosen, ref]));
    }
  }
  return Math.max(0, ...lists.map((targets) => activatedActionImpact(view, db, { type: 'activate', iid, targets }, false)));
}

/** Extra battlefield value for non-creature static and recurring engines. */
function nonCreatureAbilityImpact(db: CardDb, cardId: string): number {
  const d = def(db, cardId);
  if (isType(d, 'creature')) return 0;
  let value = 0;
  for (const ab of d.abilities ?? []) {
    if (ab.when === 'static' && ab.static) {
      const st = ab.static;
      const stats = (Math.abs(st.p ?? 0) + Math.abs(st.t ?? 0)) / 2;
      const keywords = (st.grantKeywords?.length ?? 0) * 0.5;
      const base = st.scope === 'filter' ? 1.5 : st.scope === 'attached' ? 0.75 : 1;
      value += base + stats * 0.7 + keywords;
      continue;
    }
    const conditionMultiplier = abilityConditionMultiplier(ab.condition);
    if (ab.when === 'dawn') {
      value += 0.75 + (ab.ops ?? []).reduce((sum, op) => sum + opImpactValue(op), 0) * conditionMultiplier;
    } else if (ab.when !== 'spell') {
      value += 0.35 + (ab.ops ?? []).reduce((sum, op) => sum + opImpactValue(op) * 0.5, 0) * conditionMultiplier;
    }
  }
  if (d.chapters) value += d.chapters.length * 0.5;
  return value;
}

export function removalTargetValue(
  battlefield: readonly Permanent[],
  db: CardDb,
  perm: Permanent,
  includeActivated = true,
): number {
  const d = def(db, perm.cardId);
  const impact = isType(d, 'artifact') || isType(d, 'enchantment')
    ? nonCreatureAbilityImpact(db, perm.cardId)
    : 0;
  return permValue(battlefield, db, perm.iid, includeActivated) + impact;
}

export type RemovalKind =
  | 'destroy'
  | 'sever'
  | 'recall'
  | 'branch'
  | 'massDestroy'
  | 'destroyNewest'
  | 'damage';

function spellOps(db: CardDb, cardId: string): EffectOp[] {
  return (def(db, cardId).abilities ?? [])
    .filter((ab) => ab.when === 'spell')
    .flatMap((ab) => ab.ops ?? []);
}

/**
 * W3.5b's common all-creature sweepers need public-board asymmetry, not a
 * generic spell score: an even effect is harmful when it removes more of the
 * caster's small creatures. Survivors retain a small value for their marked
 * damage or temporary stat loss, while creatures that die use full board value.
 */
function symmetricCreatureSweepValue(
  battlefield: readonly Permanent[],
  db: CardDb,
  caster: PlayerId,
  op: Extract<EffectOp, { op: 'damage' | 'boost' }>,
  includeActivated = true,
): number {
  const opponent = opponentOf(caster);
  let value = 0;
  for (const perm of battlefield) {
    if (!isType(def(db, perm.cardId), 'creature')) continue;
    const stats = getEffectiveStats(battlefield, db, perm.iid);
    const remainingDefense = stats.defense - perm.damage;
    const dies =
      (op.op === 'damage' && op.n !== 'X' && op.n >= remainingDefense) ||
      (op.op === 'boost' && remainingDefense + op.t <= 0);
    const impact = dies
      ? removalTargetValue(battlefield, db, perm, includeActivated)
      : op.op === 'damage'
        ? op.n === 'X' ? 0 : op.n * 0.5
        : (Math.abs(op.p) + Math.abs(op.t)) / 2;
    value += perm.controller === opponent ? impact : -impact;
  }
  return value;
}

/** Classify only cast-time spell bodies. Arrival/dawn removal riders stay ETB value. */
export function removalKind(db: CardDb, cardId: string): RemovalKind | null {
  for (const ab of def(db, cardId).abilities ?? []) {
    if (ab.when !== 'spell') continue;
    const permanentTarget = ab.targets?.some(
      (target) =>
        target.what === 'creature' ||
        target.what === 'yourCreature' ||
        target.what === 'yourPermanent' ||
        target.what === 'any' ||
        target.what === 'artifact' ||
        target.what === 'enchantment' ||
        target.what === 'artifactOrEnchantment',
    );
    for (const op of ab.ops ?? []) {
      if (op.op === 'destroy') return 'destroy';
      if ((op.op === 'sever' || op.op === 'recall') && permanentTarget) {
        return op.op;
      }
      if (op.op === 'destroyArtifactOrSeverEnchantment') return 'branch';
      if (op.op === 'massDestroy' && op.filter === 'allEnchantments') return 'massDestroy';
      if (op.op === 'destroyNewestOpponentArtifactOrEnchantment') return 'destroyNewest';
      if (op.op === 'damage' && op.to === 'target') return 'damage';
      if (op.op === 'damage' && op.to === 'eachCreature') return 'massDestroy';
      if (op.op === 'boost' && op.scope === 'all' && (op.p < 0 || op.t < 0)) return 'massDestroy';
    }
  }
  return null;
}

/** Public-board-only impact of a removal cast. Zero means the cast currently whiffs. */
export function removalValueForCast(
  battlefield: readonly Permanent[],
  db: CardDb,
  caster: PlayerId,
  cardId: string,
  target?: Permanent,
): number {
  const opponent = opponentOf(caster);
  let value = 0;
  for (const op of spellOps(db, cardId)) {
    if (
      (op.op === 'destroy' ||
        op.op === 'sever' ||
        op.op === 'recall' ||
        op.op === 'destroyArtifactOrSeverEnchantment') &&
      target?.controller === opponent
    ) {
      value += removalTargetValue(battlefield, db, target);
    } else if (op.op === 'massDestroy') {
      const doomed = battlefield.filter((perm) => {
        if (perm.controller !== opponent) return false;
        const d = def(db, perm.cardId);
        if (op.filter === 'allEnchantments') return isType(d, 'enchantment');
        if (!isType(d, 'creature')) return false;
        return op.filter === 'allCreatures' || getEffectiveStats(battlefield, db, perm.iid).keywords.has('skyborne');
      });
      value += doomed.reduce((sum, perm) => sum + removalTargetValue(battlefield, db, perm), 0);
    } else if (op.op === 'damage' && op.to === 'eachCreature') {
      value += symmetricCreatureSweepValue(battlefield, db, caster, op);
    } else if (op.op === 'boost' && op.scope === 'all' && (op.p < 0 || op.t < 0)) {
      value += symmetricCreatureSweepValue(battlefield, db, caster, op);
    } else if (op.op === 'destroyNewestOpponentArtifactOrEnchantment') {
      for (let i = battlefield.length - 1; i >= 0; i--) {
        const perm = battlefield[i];
        const d = def(db, perm.cardId);
        if (
          perm.controller === opponent &&
          (isType(d, 'artifact') || isType(d, 'enchantment'))
        ) {
          value += removalTargetValue(battlefield, db, perm);
          break;
        }
      }
    }
  }
  return value;
}

/** Shared card-value heuristic — printed stats (hand cards, hypotheticals). */
export function conditionalAbilityValue(db: CardDb, cardId: string): number {
  const d = def(db, cardId);
  let value = 0;
  for (const ab of d.abilities ?? []) {
    // Spell bodies already have their own cast/removal valuation. This helper
    // prices the new permanent/arrival mechanics without perturbing existing
    // targeted spell decisions such as graveyard raise.
    if (ab.when === 'spell') continue;
    const markedOps = (ab.ops ?? []).some(
      (op) =>
        op.op === 'moveMark' ||
        op.op === 'removeMarks' ||
        op.op === 'markAll' ||
        op.op === 'loseLifePerTheirMarked' ||
        op.op === 'fetchLand' ||
        op.op === 'severSelf' ||
        op.op === 'raise' ||
        op.op === 'ifTargetMarked' ||
        (op.op === 'boost' && (op.scope === 'yourMarked' || op.scope === 'theirMarked')),
    );
    const markedCondition =
      ab.condition === 'controlMarked' ||
      (typeof ab.condition === 'object' && ab.condition.kind === 'markedThreshold');
    if (!markedOps && !markedCondition) continue;
    value += (ab.ops ?? []).reduce((sum, op) => sum + opImpactValue(op), 0) *
      abilityConditionMultiplier(ab.condition) * 0.5;
  }
  return value;
}

export function cardValue(db: CardDb, cardId: string): number {
  const d = def(db, cardId);
  let v = manaValue(d.cost);
  if (isType(d, 'creature')) {
    v += ((d.attack ?? 0) + (d.defense ?? 0)) / 2;
    v += keywordScore(d.keywords ?? []);
    v += nineLivesValue(d);
  }
  if (isLordOrLegendary(db, cardId)) v += 1;
  if (hasTriggeredAbility(db, cardId)) v += 0.75;
  // New marked/arrival mechanics get a conservative printed premium. Keep
  // this restricted to the provisional wave so existing card valuations and
  // their measured win-rate gates remain byte-for-byte behaviorally stable.
  v += conditionalAbilityValue(db, cardId);
  if (d.chapters) v += d.chapters.length * 0.75;
  if (isType(d, 'creature') && d.awakening) v += 0.5 + awakeningValue(d);
  return v;
}

/** Cheap deterministic estimate used when an AI chooses whether to pay Empower. */
export function empowerValue(db: CardDb, cardId: string): number {
  const ops = def(db, cardId).empower?.ops ?? [];
  const opValue = (op: EffectOp): number => {
    switch (op.op) {
      case 'damage':
        return op.n === 'X' ? 0 : op.n * (op.to === 'controller' ? -0.6 : 0.9);
      case 'loseLife':
        return op.n * 0.9;
      case 'gainLife':
        return op.n * 0.25;
      case 'draw':
        return op.n * 1.2;
      case 'addCounters':
        return op.n * 1.5;
      case 'propagate':
        // Same conservative single-mark floor as `opImpactValue`: `empowerValue`
        // is a cheap deterministic card-shaped estimate with no battlefield in
        // its signature, and over-pricing Propagate here would make the AI pay
        // Empower into a board with nothing marked on it.
        return 1.5;
      case 'createToken':
        return op.count * 2;
      case 'raise':
        return op.to === 'target' ? 0 : 3;
      case 'foresee':
        return op.n * 0.6;
      case 'boost':
        return (op.p + op.t) / 2 + (op.keywords?.length ?? 0) * 0.5;
      case 'moveMark':
        return 0.75;
      case 'removeMarks':
        return 0.75;
      case 'markAll':
        return 1.25;
      case 'loseLifePerTheirMarked':
        return 1.1;
      case 'fetchLand':
        return 1;
      case 'severSelf':
        return -1.5;
      case 'ifTargetMarked':
        return op.then.reduce((sum, nested) => sum + opValue(nested), 0) * 0.6 +
          (op.else ?? []).reduce((sum, nested) => sum + opValue(nested), 0) * 0.4;
      default:
        return 0;
    }
  };
  return ops.reduce((sum, op) => sum + opValue(op), 0);
}

/** Cheap deterministic smoothing value for a hand-side Skim action. */
export function skimValue(db: CardDb, cardId: string): number {
  const cost = def(db, cardId).skim?.cost;
  if (!cost) return 0;
  return Math.max(0.1, 1.25 - manaValue(cost) * 0.15);
}

/**
 * Virtual card-advantage value for a Retell cast. Retell consumes a public
 * graveyard card, so its body is priced as extra access to a spell rather than
 * as a second copy in hand. R4 override ops are the body being valued.
 */
export function retellValue(db: CardDb, cardId: string): number {
  const d = def(db, cardId);
  if (!d.retell) return 0;
  const ops = d.retell.ops ?? spellOps(db, cardId);
  return 0.75 + ops.reduce((sum, op) => sum + opImpactValue(op), 0);
}

/**
 * Marginal public-board value of a Hauntlink rider on one proposed host.
 * Existing effective keywords are excluded so the ranker never prefers a
 * duplicate grant over a useful new rider.
 */
export function linkedRiderValue(
  battlefield: readonly Permanent[],
  db: CardDb,
  cardId: string,
  hostIid: number,
): number {
  const rider = def(db, cardId).hauntlink?.linked;
  const host = battlefield.find((perm) => perm.iid === hostIid);
  if (!rider || !host) return 0;
  const current = getEffectiveStats(battlefield, db, hostIid);
  let value = ((rider.p ?? 0) + (rider.t ?? 0)) / 2;
  for (const keyword of rider.grantKeywords ?? []) {
    if (!current.keywords.has(keyword)) value += KEYWORD_BONUS[keyword];
  }
  return value;
}

/**
 * Total value of casting a Hauntlink carrier on a public host. The base card
 * value is adjusted for the actual alternate cost; the rider is then reduced
 * when the host is already damaged near lethal and slightly rewarded for a
 * healthy Untouchable host. No hidden hand or library information is read.
 */
export function hauntlinkCastValue(
  battlefield: readonly Permanent[],
  db: CardDb,
  cardId: string,
  hostIid: number,
): number {
  const d = def(db, cardId);
  const host = battlefield.find((perm) => perm.iid === hostIid);
  if (!d.hauntlink || !host) return -Infinity;
  const stats = getEffectiveStats(battlefield, db, hostIid);
  const remaining = stats.defense - host.damage;
  const costDelta = manaValue(d.hauntlink.cost) - manaValue(d.cost);
  let value = cardValue(db, cardId) - costDelta * 0.65;
  value += linkedRiderValue(battlefield, db, cardId, hostIid);
  if (remaining <= 1) value -= 2.5;
  else if (remaining <= 2) value -= 0.75;
  if (stats.keywords.has('untouchable')) value += 0.3;
  return value;
}

/**
 * NET life lost per turn to `who`'s own dawn triggers: self-damage (e.g.
 * tk-other's "At the start of your turn, this deals 1 damage to you") minus
 * dawn lifegain (gk/cf attendants), floored at 0. This is a forced clock the
 * 1-turn lookahead cannot see: evaluate() prices it convexly against
 * remaining life, and chooseAttackers uses it to force desperation attacks
 * (playtest report 2026-07-12: Hard sat behind a full player bench and bled
 * out to its own trigger). Only 'dawn' triggers count — 'attacks'
 * self-damage is an optional cost the AI controls.
 */
export function dawnSelfBleed(
  battlefield: readonly Permanent[],
  db: CardDb,
  who: PlayerId,
): number {
  let n = 0;
  for (const perm of battlefield) {
    if (perm.controller !== who) continue;
    for (const ab of def(db, perm.cardId).abilities ?? []) {
      if (ab.when !== 'dawn') continue;
      for (const op of ab.ops ?? []) {
        if (op.op === 'damage' && op.to === 'controller' && op.n !== 'X') n += op.n;
        else if (op.op === 'gainLife') n -= op.n;
      }
    }
  }
  return Math.max(0, n);
}

/**
 * A Mark is a permanent investment, not a +1/+1 that happens to persist: it is
 * what Propagate compounds, what the marked-filter lords count, and what every
 * threshold payoff needs alive at dawn. Before this premium the AI valued a
 * marked 3/3 exactly like an unmarked 3/3 and traded it away just as readily
 * (2026-09-03 seeded pass: Chrome Broodmother averaged 0.21 marked creatures
 * at her own dawns). The premium is deliberately small beside the body: it
 * tips even trades, it does not turn marked creatures into untouchables.
 */
export const MARKED_BODY_PREMIUM = 0.5;
export const EXTRA_MARK_PREMIUM = 0.15;

export function markedBodyValue(plusOneCounters: number): number {
  return plusOneCounters > 0 ? MARKED_BODY_PREMIUM + EXTRA_MARK_PREMIUM * (plusOneCounters - 1) : 0;
}

function markedCreatureCount(battlefield: readonly Permanent[], db: CardDb, who: PlayerId): number {
  return battlefield.filter((perm) =>
    perm.controller === who && perm.plusOneCounters > 0 && isType(def(db, perm.cardId), 'creature'),
  ).length;
}

/** The mark count an ability's condition wants alive, or 0 when it has none. */
function markConditionNeed(condition: AbilityDef['condition']): number {
  if (condition === 'controlMarked') return 1;
  if (typeof condition === 'object' && condition.kind === 'markedThreshold') return condition.n;
  return 0;
}

/** Non-negative worth of the ops behind a mark-gated ability. */
function markPayoffWorth(ab: AbilityDef): number {
  return Math.max(0, (ab.ops ?? []).reduce((sum, op) => sum + opImpactValue(op), 0));
}

function hasPropagateSource(d: ReturnType<typeof def>): boolean {
  const ops = [
    ...(d.abilities ?? []).flatMap((ab) => ab.ops ?? []),
    ...(d.empower?.ops ?? []),
    ...(d.chapters ?? []).flat(),
  ];
  return ops.some((op) => op.op === 'propagate');
}

/** Does `who` have a mark-gated payoff in play, or (own hand only) in hand? */
export function hasMarkPayoff(
  battlefield: readonly Permanent[],
  db: CardDb,
  who: PlayerId,
  hand: readonly string[] = [],
): boolean {
  const gated = (cardId: string): boolean =>
    (def(db, cardId).abilities ?? []).some((ab) => markConditionNeed(ab.condition) > 0);
  return battlefield.some((perm) => perm.controller === who && gated(perm.cardId)) || hand.some(gated);
}

/**
 * The board-shaped worth of `who`'s marks beyond the bodies that carry them,
 * for a lookahead that ends before any dawn trigger can fire:
 *
 * - each mark-gated ability in play counts progress toward its need, convex
 *   (progress squared) so the last marked creature is worth the most, paying
 *   1.5x the trigger's ops once the gate is met - roughly the next two dawns;
 * - the same abilities held in `hand` count at half weight, so a board is
 *   built before the payoff is cast rather than after;
 * - every Propagate source in hand (up to two) makes each marked creature on
 *   board worth a little more, because that is exactly what it will compound.
 *
 * Statics that buff marked creatures need no term: they already show through
 * effective stats.
 */
export function markedBoardValue(
  battlefield: readonly Permanent[],
  db: CardDb,
  who: PlayerId,
  hand: readonly string[] = [],
): number {
  const marked = markedCreatureCount(battlefield, db, who);
  let value = 0;
  const progressValue = (cardId: string, weight: number): number => {
    let sum = 0;
    for (const ab of def(db, cardId).abilities ?? []) {
      const need = markConditionNeed(ab.condition);
      if (need === 0) continue;
      const progress = Math.min(marked, need) / need;
      sum += markPayoffWorth(ab) * progress * progress * 1.5 * weight;
    }
    return sum;
  };
  for (const perm of battlefield) {
    if (perm.controller === who) value += progressValue(perm.cardId, 1);
  }
  let propagateSources = 0;
  for (const cardId of hand) {
    value += progressValue(cardId, 0.5);
    if (hasPropagateSource(def(db, cardId))) propagateSources++;
  }
  value += Math.min(propagateSources, 2) * 0.3 * marked;
  return value;
}

/**
 * How much better or worse casting `cardId` is on THIS board than its printed
 * value says: Propagate multiplies by the marked creatures already out (an
 * empty board wastes it), and a mark-all spell multiplies by the creatures it
 * will touch. Negative when the board cannot use the card yet, so a mark
 * generator gets sequenced ahead of the card that compounds it.
 */
export function markBoardAdjust(
  battlefield: readonly Permanent[],
  db: CardDb,
  who: PlayerId,
  cardId: string,
): number {
  const d = def(db, cardId);
  const ops = [
    ...(d.abilities ?? []).filter((ab) => ab.when !== 'static').flatMap((ab) => ab.ops ?? []),
    ...(d.chapters ?? []).flat(),
  ];
  const marked = markedCreatureCount(battlefield, db, who);
  const creatures = battlefield.filter((perm) =>
    perm.controller === who && isType(def(db, perm.cardId), 'creature'),
  ).length;
  let adjust = 0;
  for (const op of ops) {
    if (op.op === 'propagate') adjust += (marked - 1) * 0.8;
    else if (op.op === 'markAll' && op.scope === 'yourCreatures') adjust += (creatures - 1.5) * 0.6;
  }
  return adjust;
}

type ActivatedPotentialCache = Map<ActivatedDef, Map<PlayerId, number>>;

function activatedUsesSource(ops: readonly EffectOp[]): boolean {
  return ops.some((op) => op.op === 'severSelf' ||
    (op.op === 'addCounters' && op.to === 'self') ||
    (op.op === 'awaken' && op.scope === 'self') ||
    (op.op === 'ifTargetMarked' &&
      (activatedUsesSource(op.then) || activatedUsesSource(op.else ?? []))));
}

/** Reuse identical source-independent riders only within this board evaluation. */
export function createPermanentValuer(battlefield: readonly Permanent[], db: CardDb): (iid: number) => number {
  const cache: ActivatedPotentialCache = new Map();
  return (iid) => permValue(battlefield, db, iid, true, cache);
}

function cachedActivatedPotential(
  battlefield: readonly Permanent[], db: CardDb, perm: Permanent,
  ability: ActivatedDef, cache?: ActivatedPotentialCache,
): number {
  if (!cache || ability.targets?.some((spec) => spec.other) || activatedUsesSource(ability.ops)) {
    return activatedAbilityValue(battlefield, db, perm.iid);
  }
  let byController = cache.get(ability);
  const cached = byController?.get(perm.controller);
  if (cached !== undefined) return cached;
  const value = activatedAbilityValue(battlefield, db, perm.iid);
  if (!byController) { byController = new Map(); cache.set(ability, byController); }
  byController.set(perm.controller, value);
  return value;
}

/** Value of a permanent on the battlefield — EFFECTIVE stats. */
export function permValue(
  battlefield: readonly Permanent[],
  db: CardDb,
  iid: number,
  includeActivated = true,
  activatedCache?: ActivatedPotentialCache,
): number {
  const perm = battlefield.find((p) => p.iid === iid);
  if (!perm) return 0;
  const d = def(db, perm.cardId);
  let v = manaValue(d.cost);
  if (isType(d, 'creature')) {
    const stats = getEffectiveStats(battlefield, db, iid);
    v += (stats.attack + Math.max(0, stats.defense - perm.damage)) / 2;
    v += keywordScore(stats.keywords);
    v += nineLivesValue(d, perm.plusOneCounters);
    v += markedBodyValue(perm.plusOneCounters);
  }
  if (isLordOrLegendary(db, perm.cardId)) v += 1;
  if (d.chapters) {
    const completed = perm.chapter ?? 0;
    v += Math.max(0, d.chapters.length - completed) * 0.75;
  }
  if (isType(d, 'creature') && d.awakening && !perm.awakened) {
    v += 0.5 + awakeningValue(d);
  }
  // Duty uses the same expected-use shape as a Dawn rider: two uses on a
  // creature and three on a non-creature. Readiness does not erase potential.
  if (includeActivated && d.activated) {
    v += cachedActivatedPotential(battlefield, db, perm, d.activated, activatedCache) * (isType(d, 'creature') ? 2 : 3);
  }
  return v;
}
