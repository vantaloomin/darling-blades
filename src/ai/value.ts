import { castCost, type Action } from '../engine/actions';
import { RULES } from '../config/rules';
import { cardHasProvoked } from '../engine/creatureDamage';
import { arrivalHuntIndex } from '../engine/effects/EffectInterpreter';
import { combineManaCosts, solveMana } from '../engine/mana';
import { castTargetSpecsFor } from '../engine/resolve';
import { getEffectiveStats, isQuestActive } from '../engine/statics';
import type { AbilityDef, ActivatedDef, CardDb, EffectOp, Keyword, ManaCost, Permanent, PlayerId, TargetRef, TargetSpec } from '../engine/types';
import { activatedAbilitiesOf, def, effectOpUsesTarget, isTargetBranchOp, isType, manaValue, opponentOf } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { extraManaByTurn, RAMP_ANCHOR, RAMP_DAWN_SHARE, RAMP_STACK, RAMP_TURN_DECAY } from '../power/scoreCore';
import { determinize } from './determinize';

type ManaSpendAction = Extract<Action, { type: 'castSpell' | 'castDarling' | 'activate' }>;

/** The actual public payment, including modes, tax, X and Tithe's generic discount. */
export function actionManaCost(view: PlayerView, db: CardDb, action: ManaSpendAction): ManaCost | undefined {
  if (action.type === 'activate') {
    const source = view.battlefield.find((p) => p.iid === action.iid);
    return source ? activatedAbilitiesOf(def(db, source.cardId))[action.abilityIndex ?? 0]?.cost.mana ??
      { generic: 0, pips: {} } : undefined;
  }
  const id = action.type === 'castDarling' ? view.you.darlingZone :
    (action.retell || action.whispers) && action.graveIndex !== undefined
      ? view.you.graveyard[action.graveIndex] : view.you.hand[action.handIndex];
  if (!id) return undefined;
  const d = def(db, id);
  if (action.type === 'castDarling') return d.cost && {
    generic: d.cost.generic + (view.you.darlingTax ?? 0) + (action.x ?? 0), pips: d.cost.pips,
  };
  const cost = castCost(d, !!action.empowered, !!action.retell, !!action.hauntlinked, { whispers: action.whispers });
  if (!cost) return undefined;
  const discount = action.tithe ? Math.floor((action.sacrifices ?? []).reduce((sum, iid) =>
    sum + getEffectiveStats(view.battlefield, db, iid).defense, 0) / 2) : 0;
  return { generic: Math.max(0, cost.generic - discount) + (action.x ?? 0), pips: cost.pips };
}

/** Pay this action while keeping another cost payable, including colored pips.
 * Usually auto-tap already works. Search partitions only when its allocation
 * spends a scarce color that the held spell needs. All sources are public. */
export function manaPlanKeeping(
  view: PlayerView, db: CardDb, action: ManaSpendAction, held: ManaCost,
): number[] | null {
  const cost = actionManaCost(view, db, action);
  if (!cost) return null;
  const sacrificed = action.type === 'castSpell' ? action.sacrifices ?? [] : [];
  const battlefield = view.battlefield;
  // Mana is paid before Tithe/Rite sacrifices; only the held payment loses those sources.
  const after = (plan: readonly number[]) => ({ battlefield: battlefield.filter((p) => !sacrificed.includes(p.iid)).map((p) =>
    plan.includes(p.iid) || action.type === 'activate' && action.iid === p.iid ? { ...p, tapped: true } : p) });
  const ordinary = solveMana({ battlefield }, db, view.myId, cost);
  if (ordinary === null) return null;
  if (solveMana(after(ordinary), db, view.myId, held) !== null) return ordinary;
  const combined = solveMana({ battlefield }, db, view.myId, combineManaCosts(cost, held));
  if (combined === null) return null;
  const needed = manaValue(cost);
  const visit = (index: number, selected: number[]): number[] | null => {
    if (selected.length === needed) {
      // Restrict payments without removing statics that make a source usable.
      const reserved = battlefield.filter((p) => !selected.includes(p.iid)).map((p) => p.iid);
      return solveMana({ battlefield }, db, view.myId, cost, 0, reserved) !== null &&
        solveMana(after(selected), db, view.myId, held) !== null ? selected : null;
    }
    for (let i = index; i <= combined.length - (needed - selected.length); i++) {
      const found = visit(i + 1, [...selected, combined[i]]);
      if (found) return found;
    }
    return null;
  };
  return visit(0, []);
}

/** Extra Empower mana competes with an indivisible second spell. Price the
 * best displaced develop cast at its score per mana, charging at least its
 * whole score when even a smaller rider payment makes that card uncastable.
 * No charge when both spells fit, or when there is no legal second spell.
 * The temporary world supplies only our known hand and public legal targets. */
export function empowerOpportunityCost(
  view: PlayerView, db: CardDb, cast: Extract<Action, { type: 'castSpell' }>,
  developScore: (alternativeView: PlayerView, alternative: Extract<Action, { type: 'castSpell' | 'castDarling' }>) => number,
): number {
  if (!cast.empowered || view.awaiting.kind !== 'main') return 0;
  const plain = { ...cast, empowered: false };
  const fullCost = actionManaCost(view, db, cast);
  const plainCost = actionManaCost(view, db, plain);
  if (!fullCost || !plainCost) return 0;
  const extra = manaValue(fullCost) - manaValue(plainCost);
  if (extra <= 0) return 0;
  const world = determinize(view, db);
  // Removing this physical hand slot also makes a second copy of the same
  // card visible through the engine's card-id-deduplicated menu.
  world.instanceState.players[view.myId].hand.splice(cast.handIndex, 1);
  const otherView = world.viewFor(view.myId);
  const firstDef = def(db, view.you.hand[cast.handIndex]);
  const firstSacrifices = cast.sacrifices ?? [];
  const creatureCount = view.battlefield.filter((p) => p.controller === view.myId &&
    isType(def(db, p.cardId), 'creature') && !firstSacrifices.includes(p.iid)).length;
  const noncreature = (d: typeof firstDef) => !isType(d, 'creature') && !isType(d, 'land') &&
    (isType(d, 'artifact') || isType(d, 'enchantment')) && !d.subtypes.includes('Aura');
  const permanentCount = view.battlefield.filter((p) => p.controller === view.myId && p.attachedTo === undefined &&
    noncreature(def(db, p.cardId))).length;
  let best = 0;
  for (const other of world.legalActions(view.myId)) {
    if (other.type !== 'castDarling' && (other.type !== 'castSpell' || other.empowered)) continue;
    const cost = actionManaCost(otherView, db, other);
    if (!cost || manaValue(cost) === 0) continue;
    const otherId = other.type === 'castDarling' ? otherView.you.darlingZone! :
      (other.retell || other.whispers) && other.graveIndex !== undefined
        ? otherView.you.graveyard[other.graveIndex] : otherView.you.hand[other.handIndex];
    const otherDef = def(db, otherId);
    const otherSacrifices = other.type === 'castSpell' ? other.sacrifices ?? [] : [];
    if (otherSacrifices.some((iid) => firstSacrifices.includes(iid)) ||
      other.targets?.some((ref) => ref.kind === 'permanent' && firstSacrifices.includes(ref.iid))) continue;
    // The known first permanent occupies a slot. A second body beyond the
    // board cap is not a displaced alternative, even if its mana would fit.
    const otherIsBody = isType(otherDef, 'creature') &&
      !(other.type === 'castSpell' && (other.hauntlinked || other.retell && otherDef.retell?.ops));
    if (otherIsBody && creatureCount + Number(isType(firstDef, 'creature')) - otherSacrifices.length >= RULES.maxCreatures) continue;
    if (noncreature(firstDef) && noncreature(otherDef) && permanentCount + 1 >= RULES.maxNoncreaturePermanents) continue;
    if (manaPlanKeeping(view, db, plain, cost) === null ||
      manaPlanKeeping(view, db, cast, cost) !== null) continue;
    const score = Math.max(0, developScore(otherView, other));
    best = Math.max(best, score * Math.max(1, extra / manaValue(cost)));
  }
  return best;
}

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

/**
 * Attack-scaled keyword shapes from the v4 power scorer, measured by the
 * in-engine keyword lab (624k games; docs/plan-1.8.5.md lane 4, D9). A flat
 * bonus valued a 5/5 flier's evasion like a 1/1's. KEYWORD_BONUS stays each
 * keyword's value at the reference attack, so a 3-attack creature is valued
 * exactly as before; bigger and smaller bodies move along the measured shape.
 * Bulwark's shape is its magnitude (KEYWORD_BONUS carries the sign), and
 * Deathblade shrinks as attack grows. Every other keyword stays flat.
 */
const KEYWORD_REFERENCE_ATTACK = 3;
const KEYWORD_ATTACK_SHAPE: Partial<Record<Keyword, (attack: number) => number>> = {
  skyborne: (a) => 0.5 + 0.27 * a,
  twinBlades: (a) => 0.75 + 0.4 * a,
  firstBlade: (a) => 0.2 + 0.22 * a,
  bloodoath: (a) => 0.2 + 0.25 * a,
  warcry: (a) => 0.15 + 0.1 * a,
  bulwark: (a) => 0.5 + 0.2 * a,
  deathblade: (a) => Math.max(0.2, 1 - 0.15 * a),
};

function keywordBonus(keyword: Keyword, attack: number): number {
  const shape = KEYWORD_ATTACK_SHAPE[keyword];
  if (!shape) return KEYWORD_BONUS[keyword];
  return KEYWORD_BONUS[keyword] * shape(Math.max(0, attack)) / shape(KEYWORD_REFERENCE_ATTACK);
}

/** `attack` is the attack of the creature carrying the keywords. */
function keywordScore(keywords: Iterable<Keyword>, attack: number): number {
  let s = 0;
  for (const k of keywords) s += keywordBonus(k, attack);
  return s;
}

type KeywordBody = { attack: number; keywords: ReadonlySet<Keyword> };

/** A grant uses the printed-keyword price on the receiving body after the
 * boost. An existing keyword adds nothing. Card-only estimates retain the
 * established reference body when the recipient is not known. */
function boostKeywordValue(op: Extract<EffectOp, { op: 'boost' }>, bodies?: readonly KeywordBody[]): number {
  const recipients = bodies ?? [{ attack: KEYWORD_REFERENCE_ATTACK, keywords: new Set<Keyword>() }];
  return recipients.reduce((sum, body) => sum + keywordScore(
    new Set((op.keywords ?? []).filter((keyword) => !body.keywords.has(keyword))), body.attack + op.p,
  ), 0);
}

function boostRecipients(
  view: PlayerView | undefined, db: CardDb, cardId: string,
  op: Extract<EffectOp, { op: 'boost' }>, mode: SpellMode = {}, earlierOps: readonly EffectOp[] = [],
): KeywordBody[] | undefined {
  if (!op.keywords?.length) return [];
  const d = def(db, cardId);
  if (op.scope === 'self' && isType(d, 'creature')) {
    return [{ attack: d.attack ?? 0, keywords: new Set(d.keywords ?? []) }];
  }
  if (!view) return undefined;
  // A spell can create the bodies its later grant will reach (Stampede of
  // the Long Grass). Only project its explicit tokens, up to the real cap;
  // public statics then price the new bodies just like existing recipients.
  let battlefield = view.battlefield;
  if (earlierOps.some((earlier) => earlier.op === 'createToken')) {
    battlefield = [...battlefield];
    let iid = Math.min(0, ...battlefield.map((perm) => perm.iid)) - 1;
    let room = RULES.maxCreatures - battlefield.filter((perm) => perm.controller === view.myId && isType(def(db, perm.cardId), 'creature')).length;
    for (const earlier of earlierOps) {
      if (earlier.op !== 'createToken') continue;
      for (let count = 0; count < earlier.count && room > 0; count++, room--) {
        battlefield.push({ ...arrivingPermanent(earlier.token, view.myId), iid: iid--,
          isToken: true, plusOneCounters: earlier.marks ?? 0 });
      }
    }
  }
  const targets = spellOpTargets(db, cardId, mode, op);
  return battlefield.filter((perm) => isType(def(db, perm.cardId), 'creature') && (
    op.scope === 'target' ? targets.some((ref) => ref.kind === 'permanent' && ref.iid === perm.iid) :
    op.scope === 'self' ? false : op.scope === 'all' ||
    (op.scope === 'theirMarked' ? perm.controller !== view.myId : perm.controller === view.myId) &&
    (op.scope !== 'yourMarked' && op.scope !== 'theirMarked' || perm.plusOneCounters > 0)
  )).map((perm) => getEffectiveStats(battlefield, db, perm.iid));
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

function hasTriggeredAbility(db: CardDb, cardId: string, view?: PlayerView): boolean {
  return (def(db, cardId).abilities ?? []).some(
    // Live pure-ramp triggers get their entire value from the mana schedule.
    // Keep the existing premium for mixed triggers and card-only estimates.
    (ab) => ab.when !== 'static' && ab.when !== 'spell' &&
      !(view?.you.landReserve !== undefined && (ab.when === 'arrives' || ab.when === 'dawn') &&
        ab.ops?.length && ab.ops.every((op) => op.op === 'extraLandDrop')),
  );
}

/** `attack` is the creature's attack before the rider; its keywords are
 * valued at the attack the rider leaves it with. */
function awakeningValue(d: ReturnType<typeof def>, attack: number): number {
  return (
    ((d.awakening?.p ?? 0) + (d.awakening?.t ?? 0)) / 2 +
    keywordScore(d.awakening?.keywords ?? [], attack + (d.awakening?.p ?? 0))
  );
}

/**
 * Conditional Starborne abilities are real card text, but their floor is
 * lower than an unconditional body until the public board proves the gate.
 * These discounts are intentionally provisional: card-shaped value has no
 * battlefield, so target selection and evaluation do the exact board work.
 */
export function abilityConditionMultiplier(condition: AbilityDef['condition'], questActive?: boolean): number {
  // No public context preserves the legacy shared-policy estimate (Easy).
  if (condition === 'questActive' && questActive !== undefined) return questActive ? 1 : 0.55;
  if (condition === 'creatureDiedThisTurn') return 0.6;
  if (typeof condition === 'object' && condition.kind === 'controlsOther') return 0.65;
  if (condition === 'controlMarked') return 0.55;
  if (typeof condition === 'object' && condition.kind === 'markedThreshold') return 0.5;
  return 1;
}

interface TargetContext {
  view: PlayerView;
  db: CardDb;
  source: Permanent | undefined;
  ability: Pick<AbilityDef, 'ops'>;
  includeActivated: boolean;
  /** A creature being cast whose own Hunt is valued before it is on the
   * battlefield (an arrival Hunt's prey, an Empower Hunt). */
  hunterCardId?: string;
  /** Provoked reads already made on this board (`provokedAfterDamage`). */
  provoked?: ProvokedMemo;
}

function permanentFor(ctx: TargetContext, ref: TargetRef): Permanent | undefined {
  return ref.kind === 'permanent'
    ? ctx.view.battlefield.find((perm) => perm.iid === ref.iid)
    : undefined;
}

/**
 * The card a graveyard ref names, read from the public view: by its identity
 * when the ref and the view carry one (1.8.1), else by the chooser's index.
 */
export function graveRefCardId(view: PlayerView, ref: Extract<TargetRef, { kind: 'grave' }>): string | undefined {
  const side = ref.player === view.myId ? view.you : view.opp;
  if (ref.instanceId !== undefined && side.graveyardInstances) {
    const index = side.graveyardInstances.indexOf(ref.instanceId);
    return index < 0 ? undefined : side.graveyard[index];
  }
  return side.graveyard[ref.index];
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
  // Damage a survivor keeps wears off at cleanup. In an end step nothing is
  // left before then for it to add to, so its residual is worth nothing there
  // (1.9.1), on either side: the price of pinging their creature, and the
  // cost of pinging ours.
  const endStep = ctx.view.step === 'end';
  const impact = lethal
    ? permanentRemovalValue(ctx, perm)
    : endStep ? 0 : op.n * 0.45 + perm.plusOneCounters * 0.15;
  // A creature that survives the damage is provoked: a friendly source earns
  // its own creature's Provoked effect, and provoking theirs is a cost. In an
  // end step an until-Sunset pump (Cinder-Crest's +2/+0) ends unused.
  const provokedAbility = lethal || op.n <= 0 ? undefined : unspentProvoked(ctx.db, perm);
  const provoked = !provokedAbility || endStep && (provokedAbility.ops ?? []).every((o) => o.op === 'boost')
    ? 0 : provokedAfterDamage(ctx, perm.iid, op.n);
  return impact * harmSign(ctx, ref) + provoked;
}

/**
 * Provoked reads made on one board that does not change while the memo
 * lives: one board evaluation (`createPermanentValuer`) or one view
 * (`activateActionValue`). Every Duty that pings a creature asks the same
 * question of it, so the read is kept by creature, damage and side.
 */
type ProvokedMemo = Map<string, number>;

/** The signed Provoked value of `iid` surviving `n` damage on the context's
 * board (the Provoked term of `damageTargetValue`). */
function provokedAfterDamage(ctx: TargetContext, iid: number, n: number): number {
  const memo = provokedDepth > 0 ? undefined : ctx.provoked;
  const key = memo && `${iid}|${n}|${ctx.view.myId}|${ctx.view.creatureDiedThisTurn === true}`;
  const known = key === undefined ? undefined : memo!.get(key);
  if (known !== undefined) return known;
  const value = signedProvokedValue(
    battlefieldAfterDamage(ctx.view.battlefield, ctx.db, new Map([[iid, { damage: n, deathblade: false }]])),
    ctx.db, ctx.view.myId, iid, ctx.view.creatureDiedThisTurn === true);
  if (key !== undefined) memo!.set(key, value);
  return value;
}

/**
 * The Provoked ability a creature still has unspent this turn (Provoked is
 * once each turn, spent in `firedThisTurn` by its ability index), or none.
 * Zero cost on a card without Provoked: the cached card test comes first.
 */
function unspentProvoked(db: CardDb, perm: Permanent): AbilityDef | undefined {
  const d = def(db, perm.cardId);
  if (!cardHasProvoked(d)) return undefined;
  const index = (d.abilities ?? []).findIndex((ability) => ability.when === 'provoked');
  return perm.firedThisTurn?.includes(index) ? undefined : d.abilities![index];
}

/** The public-board-only projection a board-shaped potential is scored in:
 * the battlefield, seen by `controller`, with no hand, deck or graveyard. */
function neutralView(battlefield: readonly Permanent[], controller: PlayerId): PlayerView {
  return {
    myId: controller, activePlayer: controller, startingPlayer: controller,
    turn: 0, step: 'main2', battlefield: [...battlefield], stack: [], combat: null,
    fogThisTurn: false, awaiting: { kind: 'main', player: controller }, winner: null,
    you: { life: 0, hand: [], deckCount: 0, graveyard: [], whispersLive: [], severed: [], landDropsRemaining: 0, mulligans: 0 },
    opp: { life: 0, handCount: 0, deckCount: 0, graveyard: [], whispersLive: [], severed: [], landDropsRemaining: 0, mulligans: 0 },
  };
}

/** Nested Provoked reads are not followed: an effect that provokes another
 * creature is priced by its own ops only, so no chain can recurse. */
let provokedDepth = 0;

/**
 * What a creature's unspent Provoked is worth to its controller if it fires
 * now, on `battlefield` (the board after the damage that provokes it: the dead
 * gone, the damage marked). The effect is scored the way a Duty's use is
 * (`activatedAbilityValue`): its best legal targets on the public board, from
 * its controller's side; a targeted effect with no legal target does not fire
 * and is worth 0, and one whose condition is unmet on that board does not
 * fire either (the engine skips it). `creatureDiedThisTurn` is what the board
 * cannot show: whether a creature has died this turn, the provoking damage's
 * deaths included. Never negative, and 0 for a creature without an unspent
 * Provoked, so no board without one reads anything here.
 */
export function provokedValue(
  battlefield: readonly Permanent[], db: CardDb, perm: Permanent, creatureDiedThisTurn = false,
): number {
  if (provokedDepth > 0) return 0;
  const ability = unspentProvoked(db, perm);
  if (!ability) return 0;
  const view: PlayerView = {
    ...neutralView(battlefield, perm.controller),
    ...(creatureDiedThisTurn ? { creatureDiedThisTurn: true as const } : {}),
  };
  if (!provokedConditionMet(view, db, perm, ability.condition)) return 0;
  provokedDepth++;
  try {
    const source = view.battlefield.find((p) => p.iid === perm.iid) ?? perm;
    let lists: TargetRef[][] = [[]];
    for (const spec of ability.targets ?? []) {
      const refs = activatedPotentialTargets(view, db, source, spec);
      lists = lists.flatMap((chosen) => refs.map((ref) => [...chosen, ref]));
    }
    const ops = ability.ops ?? [];
    const scratch = activatedWritesMarks(ops) ? markScratch(view.battlefield, db) : undefined;
    const score = (targets: TargetRef[]): number => activatedOpsImpact(ops, {
      view: { ...view, you: { ...view.you }, battlefield: scratch ? scratch.reset() : view.battlefield },
      db, source, live: false, targets, targetBatch: false,
    });
    return Math.max(0, ...lists.map(score));
  } finally {
    provokedDepth--;
  }
}

/**
 * The board a mark-writing score writes on. Mark ops change only a creature's
 * `plusOneCounters` (`activatedOpsImpact`), so only the creatures are copied
 * and the rest of the board is shared; `reset` puts every copy's marks back,
 * so one scratch serves every target list of one read (a fresh copy per list
 * made a wide board quadratic in copies).
 */
function markScratch(battlefield: readonly Permanent[], db: CardDb): { reset: () => Permanent[] } {
  const board = battlefield.map((p) => isType(def(db, p.cardId), 'creature') ? { ...p } : p);
  const copies = board.filter((p, i) => p !== battlefield[i]);
  const marks = copies.map((p) => p.plusOneCounters);
  return {
    reset: () => {
      for (let i = 0; i < copies.length; i++) copies[i].plusOneCounters = marks[i];
      return board;
    },
  };
}

/** The engine's condition test (`conditionSatisfied`) on the public board:
 * "another" in `controlsOther` excludes the Provoked creature itself. */
function provokedConditionMet(view: PlayerView, db: CardDb, perm: Permanent, condition: AbilityDef['condition']): boolean {
  if (typeof condition === 'object' && condition.kind === 'controlsOther') {
    return view.battlefield.some((p) => p.controller === perm.controller && p.iid !== perm.iid &&
      isType(def(db, p.cardId), 'creature') && def(db, p.cardId).subtypes.includes(condition.subtype));
  }
  return publicCondition(view, db, condition);
}

/**
 * The signed Provoked value of the survivor `iid` on `after` (the board once
 * the damage that provokes it is marked and its dead are gone): plus for a
 * creature `me` controls, minus for an opponent's. 0 when it is not on that
 * board or has no unspent Provoked. `creatureDiedThisTurn` as in `provokedValue`.
 */
function signedProvokedValue(
  after: readonly Permanent[], db: CardDb, me: PlayerId, iid: number, creatureDiedThisTurn: boolean,
): number {
  const survivor = after.find((perm) => perm.iid === iid);
  if (!survivor) return 0;
  const value = provokedValue(after, db, survivor, creatureDiedThisTurn);
  return survivor.controller === me ? value : -value;
}

/** Mark each hit's damage and drop the creatures it kills (the state-based
 * check's test: lethal damage, or any damage from a Deathblade source).
 * `dies`, when given, replaces that test for the creatures dealt damage (the
 * Hunt has already judged them, with a pump the board does not show). */
function battlefieldAfterDamage(
  battlefield: readonly Permanent[], db: CardDb,
  dealt: ReadonlyMap<number, { damage: number; deathblade: boolean }>,
  dies?: (perm: Permanent) => boolean,
): Permanent[] {
  const lethal = (perm: Permanent, hit: { damage: number; deathblade: boolean }): boolean => hit.damage > 0 &&
    (hit.deathblade || perm.damage + hit.damage >= getEffectiveStats(battlefield, db, perm.iid).defense);
  return battlefield.flatMap((perm) => {
    const hit = dealt.get(perm.iid);
    if (!hit || hit.damage <= 0) return [perm];
    return (dies ? dies(perm) : lethal(perm, hit)) ? [] : [{ ...perm, damage: perm.damage + hit.damage }];
  });
}

/** A creature card as it would stand on the battlefield the moment it
 * arrives under `controller`, for valuing its own arrival or Empower Hunt. */
function arrivingPermanent(cardId: string, controller: PlayerId): Permanent {
  return {
    iid: -1, cardId, owner: controller, controller, tapped: false, enteredThisTurn: true,
    damage: 0, deathtouched: false, severBranded: false, attachments: [], plusOneCounters: 0, untilEotMods: [],
  };
}

/** A pump earlier in the same effect, by iid (Fang and Horn's +2/+2 before its Hunt). */
type HuntMods = ReadonlyMap<number, { p: number; t: number; keywords: readonly Keyword[] }>;

/** The fight a Hunt is on the public board: each creature's Attack and
 * Defense after `mods`, and which of them dies (0 or less deals nothing,
 * marked damage counts, Deathblade makes any damage lethal). Undefined unless
 * both are distinct creatures on `battlefield`, or when the hunter has
 * Bulwark (it deals and takes nothing). */
function huntFight(db: CardDb, battlefield: readonly Permanent[], hunterIid: number, preyIid: number, mods?: HuntMods) {
  const hunter = battlefield.find((perm) => perm.iid === hunterIid);
  const prey = battlefield.find((perm) => perm.iid === preyIid);
  if (!hunter || !prey || hunter.iid === prey.iid ||
    !isType(def(db, hunter.cardId), 'creature') || !isType(def(db, prey.cardId), 'creature')) return undefined;
  const side = (perm: Permanent) => {
    const stats = getEffectiveStats(battlefield, db, perm.iid);
    const mod = mods?.get(perm.iid);
    const keywords = new Set<Keyword>([...stats.keywords, ...(mod?.keywords ?? [])]);
    return { attack: Math.max(0, stats.attack + (mod?.p ?? 0)), defense: stats.defense + (mod?.t ?? 0), keywords };
  };
  const h = side(hunter);
  if (h.keywords.has('bulwark')) return undefined;
  const p = side(prey);
  // The engine checks state only after the whole effect, so a creature an
  // earlier op of the same effect dealt lethal damage to still fights with
  // its full Attack (EffectInterpreter marks damage; creatureDamage leaves
  // deaths to the caller). It is already dying: `doomed`.
  const doomed = (perm: Permanent, defense: number): boolean =>
    perm.damage >= defense || perm.deathtouched && perm.damage > 0;
  const dies = (perm: Permanent, defense: number, damage: number, deathblade: boolean): boolean =>
    doomed(perm, defense) || damage > 0 && (deathblade || perm.damage + damage >= defense);
  return {
    hunter, prey, h, p,
    preyDies: dies(prey, p.defense, h.attack, h.keywords.has('deathblade')),
    hunterDies: dies(hunter, h.defense, p.attack, p.keywords.has('deathblade')),
    preyDoomed: doomed(prey, p.defense),
    hunterDoomed: doomed(hunter, h.defense),
  };
}

/**
 * Where a cast's Hunt lands on the public board (wave 4, M3): the first Hunt
 * among the cast's own ops (its spell body and, when empowered, Empower's),
 * fought after the pumps and damage the ops before it gave its creatures, as
 * `spellTargetsValue` binds them. A spell-form Hunt is slot 0 hunting slot 1;
 * a source-bound one (an Empower Hunt) is the arriving creature hunting slot
 * 0. Damage an earlier op dealt is only marked, as the engine does: a hunter
 * that damage made lethal still fights with its full Attack and then dies.
 * Undefined for a cast without a Hunt, or one whose Hunt fights nothing (a
 * missing creature, a Bulwark hunter). Responses are not read.
 */
export function castHuntOutcome(
  view: PlayerView, db: CardDb, cardId: string, mode: SpellMode = {},
): { hunterDies: boolean; preyDies: boolean } | undefined {
  const ops = castSpellOps(db, cardId, mode, view);
  const targets = mode.targets ?? [];
  const mods = new Map<number, { p: number; t: number; keywords: Keyword[] }>();
  const dealt = new Map<number, number>();
  for (const op of ops) {
    if (op.op === 'hunt') {
      let battlefield: readonly Permanent[] = view.battlefield;
      let hunterIid: number;
      let prey: TargetRef | undefined;
      if (op.hunter === 'target') {
        const hunter = targets[0];
        if (hunter?.kind !== 'permanent') return undefined;
        hunterIid = hunter.iid;
        prey = targets[1];
      } else {
        const arriving = arrivingPermanent(cardId, view.myId);
        battlefield = [...battlefield, arriving];
        hunterIid = arriving.iid;
        prey = targets[0];
      }
      if (prey?.kind !== 'permanent') return undefined;
      if (dealt.size > 0) {
        battlefield = battlefieldAfterDamage(battlefield, db,
          new Map([...dealt].map(([iid, damage]) => [iid, { damage, deathblade: false }])), () => false);
      }
      const fight = huntFight(db, battlefield, hunterIid, prey.iid, mods);
      return fight && { hunterDies: fight.hunterDies, preyDies: fight.preyDies };
    }
    if (!effectOpUsesTarget(op)) continue;
    const ref = targets[('targetIndex' in op ? op.targetIndex : undefined) ?? 0];
    if (ref?.kind !== 'permanent') continue;
    if (op.op === 'boost' && op.scope === 'target') {
      const mod = mods.get(ref.iid) ?? { p: 0, t: 0, keywords: [] };
      mods.set(ref.iid, { p: mod.p + op.p, t: mod.t + op.t, keywords: [...mod.keywords, ...(op.keywords ?? [])] });
    } else if (op.op === 'damage' && op.to === 'target') {
      dealt.set(ref.iid, (dealt.get(ref.iid) ?? 0) + (op.n === 'X' ? mode.x ?? 0 : op.n));
    }
  }
  return undefined;
}

/**
 * The value, to `view.myId`, of `hunterIid` hunting `preyIid` on
 * `battlefield` (plan-first-dawn-engine.md, Part 4, item 1). The exchange is
 * simulated on the public board as the engine resolves it: each deals its
 * Attack (after `mods`) to the other at once, 0 or less deals nothing, marked
 * damage counts, Deathblade makes any damage lethal, and a hunter with Bulwark
 * does nothing. Then: the prey's removal value if it dies (a gain when an
 * opponent controls it, a cost when you do), minus the hunter's value if it
 * dies, each Blood Oath's life, the residual of the damage a survivor takes
 * (0.45 a point, as targeted damage reads it: a gain on an opponent's
 * creature, a cost on yours), and each survivor's unspent Provoked (plus for
 * yours, minus for theirs). So killing and surviving beats trading, and a
 * Hunt that only provokes an opposing creature is worth less than nothing
 * whenever its Provoked outweighs that residual.
 */
export function huntExchangeValue(
  view: PlayerView, db: CardDb, battlefield: readonly Permanent[], hunterIid: number, preyIid: number,
  mods?: HuntMods, includeActivated = true,
): number {
  const fight = huntFight(db, battlefield, hunterIid, preyIid, mods);
  if (!fight) return 0;
  const { hunter, prey, h, p, preyDies, hunterDies, preyDoomed, hunterDoomed } = fight;
  const me = view.myId;
  const lost = (perm: Permanent): number =>
    Math.max(0, removalTargetValue(battlefield, db, perm, includeActivated)) * (perm.controller === me ? -1 : 1);
  let value = 0;
  // A creature already dying to an earlier op of the same effect was charged
  // (or credited) by that op's own damage value; count it once.
  if (preyDies && !preyDoomed) value += lost(prey);
  if (hunterDies && !hunterDoomed) value += lost(hunter);
  // A survivor's damage, at the residual `damageTargetValue` reads (0.45 a point).
  const residual = (perm: Permanent, damage: number, died: boolean): number =>
    died || damage <= 0 ? 0 : damage * 0.45 * (perm.controller === me ? -1 : 1);
  value += residual(prey, h.attack, preyDies) + residual(hunter, p.attack, hunterDies);
  const lifeGain = (perm: Permanent, keywords: ReadonlySet<Keyword>, damage: number): number =>
    keywords.has('bloodoath') && damage > 0 ? damage * 0.35 * (perm.controller === me ? 1 : -1) : 0;
  value += lifeGain(hunter, h.keywords, h.attack) + lifeGain(prey, p.keywords, p.attack);
  const provokable = (perm: Permanent, damage: number, died: boolean): boolean =>
    damage > 0 && !died && unspentProvoked(db, perm) !== undefined;
  const hunterProvoked = provokable(hunter, p.attack, hunterDies);
  const preyProvoked = provokable(prey, h.attack, preyDies);
  if (hunterProvoked || preyProvoked) {
    const dealt = new Map([
      [prey.iid, { damage: h.attack, deathblade: h.keywords.has('deathblade') }],
      [hunter.iid, { damage: p.attack, deathblade: p.keywords.has('deathblade') }],
    ]);
    const after = battlefieldAfterDamage(battlefield, db, dealt, (perm) => perm.iid === prey.iid ? preyDies : hunterDies);
    const died = view.creatureDiedThisTurn === true || preyDies || hunterDies;
    if (hunterProvoked) value += signedProvokedValue(after, db, me, hunter.iid, died);
    if (preyProvoked) value += signedProvokedValue(after, db, me, prey.iid, died);
  }
  return value;
}

/** A source-bound Hunt (`hunter: 'self'`) on one prey: the source when it is
 * on the battlefield, else the creature being cast (`hunterCardId`). */
function selfHuntValue(ctx: TargetContext, ref: TargetRef): number {
  if (ref.kind !== 'permanent') return 0;
  if (ctx.source && ctx.view.battlefield.some((perm) => perm.iid === ctx.source!.iid)) {
    return huntExchangeValue(ctx.view, ctx.db, ctx.view.battlefield, ctx.source.iid, ref.iid, undefined, ctx.includeActivated);
  }
  if (!ctx.hunterCardId) return 0;
  const arriving = arrivingPermanent(ctx.hunterCardId, ctx.view.myId);
  return huntExchangeValue(ctx.view, ctx.db, [...ctx.view.battlefield, arriving], arriving.iid, ref.iid, undefined, ctx.includeActivated);
}

/**
 * The value of casting `cardId` on `targets` for its arrival Hunt (A1.1b: the
 * prey is the cast's one target): the arrival ability's ops on that prey, the
 * Hunt among them, with the arriving creature as the hunter. 0 for a card
 * without an arrival Hunt, and 0 when its condition is unmet on the public
 * board (it arrives and does not hunt).
 */
export function arrivalHuntCastValue(view: PlayerView, db: CardDb, cardId: string, targets: readonly TargetRef[]): number {
  const d = def(db, cardId);
  const index = arrivalHuntIndex(d);
  const ref = targets[0];
  if (index < 0 || !ref) return 0;
  const ability = d.abilities![index];
  if (!publicCondition(view, db, ability.condition)) return 0;
  const ctx: TargetContext = { view, db, source: undefined, ability, includeActivated: true, hunterCardId: cardId };
  return (ability.ops ?? []).reduce((sum, op) => sum + effectOnTarget(ctx, op, ref), 0);
}

/** Does this card print a Hunt anywhere (abilities, Duties, Empower)? */
export function cardHasHunt(d: ReturnType<typeof def>): boolean {
  const hunts = (ops: readonly EffectOp[]): boolean => ops.some((op) => op.op === 'hunt' ||
    op.op === 'ifTargetMarked' && (hunts(op.then) || hunts(op.else ?? [])));
  return (d.abilities ?? []).some((ability) => hunts(ability.ops ?? [])) ||
    activatedAbilitiesOf(d).some((ability) => hunts(ability.ops)) || hunts(d.empower?.ops ?? []);
}

function boostTargetValue(
  ctx: TargetContext,
  op: Extract<EffectOp, { op: 'boost' }>,
  ref: TargetRef,
): number {
  if (op.scope !== 'target') return 0;
  const perm = permanentFor(ctx, ref);
  if (!perm || !isType(def(ctx.db, perm.cardId), 'creature')) return 0;
  const stats = getEffectiveStats(ctx.view.battlefield, ctx.db, perm.iid);
  const printedDelta = (op.p + op.t) / 2 + boostKeywordValue(op, [stats]);
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
    case 'preventCombatTo': {
      const perm = permanentFor(ctx, ref);
      if (!perm || !ctx.view.combat) return 0;
      const fighting = ctx.view.combat.blocks.some((block) => block.blocker === perm.iid || block.attacker === perm.iid);
      return fighting ? permanentRemovalValue(ctx, perm) * (perm.controller === ctx.view.myId ? 1 : -1) : 0;
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
    case 'ifTargetSurvives': {
      // A trigger's gate reads the board as it stands (A1.6).
      const perm = permanentFor(ctx, ref);
      const branch = perm && survivesOnBoard(ctx.view.battlefield, ctx.db, perm) ? op.then : (op.else ?? []);
      return branch.reduce((sum, nested) => sum + effectOnTarget(ctx, nested, ref), 0);
    }
    case 'raise':
    case 'reclaim': {
      if (ref.kind !== 'grave' || ref.player !== ctx.view.myId) return 0;
      const cardId = graveRefCardId(ctx.view, ref);
      if (!cardId) return 0;
      return cardValue(ctx.db, cardId) * (op.op === 'raise' ? 1 : 0.7);
    }
    case 'moveMark': {
      // A move has two targets and is not a targeted-arrival shape. Keep a
      // small neutral floor for any caller that ranks the op as a whole.
      return opImpactValue(op);
    }
    case 'hunt':
      // The spell form needs both of its targets (spellTargetsValue binds
      // them); a source-bound Hunt's one target is its prey.
      return op.hunter === 'self' ? selfHuntValue(ctx, ref) : 0;
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
  source: Permanent | undefined,
  ability: Pick<AbilityDef, 'ops'>,
  ref: TargetRef,
  includeActivated = true,
  hunterCardId?: string,
  provoked?: ProvokedMemo,
): number {
  const ctx: TargetContext = { view, db, source, ability, includeActivated, hunterCardId, provoked };
  return (ability.ops ?? []).reduce((sum, op) => sum + effectOnTarget(ctx, op, ref), 0);
}

/**
 * Signed target contribution for independently bound spell slots. A Hunt is
 * valued as one exchange: the spell form's slot 0 hunts slot 1, after any
 * pump the same effect gave it first; a source-bound Hunt on a cast (an
 * Empower Hunt) is the arriving `hunterCardId` hunting slot 0.
 */
export function spellTargetsValue(
  view: PlayerView, db: CardDb, ops: readonly EffectOp[], targets: readonly TargetRef[],
  batch = false, x = 0, hunterCardId?: string,
): number {
  let value = 0;
  const pumps = ops.some((op) => op.op === 'hunt') ? new Map<number, { p: number; t: number; keywords: Keyword[] }>() : undefined;
  // Damage an earlier op of the same effect dealt (Blaze-Horn Charge's 1 to
  // its own hunter): the exchange is fought on that board, so a hunter left
  // one point from death is read as the hunter it now is.
  const dealt = pumps && new Map<number, number>();
  for (const [index, op] of ops.entries()) {
    if (!effectOpUsesTarget(op)) continue;
    if (op.op === 'ifTargetSurvives') {
      // "If it survived" (A1.6): only the branch the survival read expects
      // counts, target-free effects in it included (the card a hunter that
      // lives draws), so a prey that would kill the hunter loses the draw.
      const ref = targets[op.targetIndex ?? 0];
      const branch = expectsTargetSurvives(view, db, ops.slice(0, index), op, targets, x) ? op.then : op.else ?? [];
      value += branch.reduce((sum, nested) => sum + (effectOpUsesTarget(nested)
        ? ref ? targetValueForAbility(view, db, undefined, { ops: [nested] }, ref) : 0
        : opImpactValue(nested)), 0);
      continue;
    }
    if (op.op === 'hunt') {
      value += op.hunter === 'target'
        ? spellHuntValue(view, db, targets[0], targets[1], pumps, dealt)
        : targets[0] ? targetValueForAbility(view, db, undefined, { ops: [op] }, targets[0], true, hunterCardId) : 0;
      continue;
    }
    const refs = 'targetIndex' in op && op.targetIndex !== undefined ? targets.slice(op.targetIndex, op.targetIndex + 1) :
      batch ? targets : targets.slice(0, 1);
    for (const ref of refs) {
      const resolved = op.op === 'damage' && op.n === 'X' ? { ...op, n: x } : op;
      value += targetValueForAbility(view, db, undefined, { ops: [resolved] }, ref);
      if (dealt && resolved.op === 'damage' && resolved.to === 'target' && typeof resolved.n === 'number' &&
        ref.kind === 'permanent') dealt.set(ref.iid, (dealt.get(ref.iid) ?? 0) + resolved.n);
      if (pumps && op.op === 'boost' && ref.kind === 'permanent') {
        const pump = pumps.get(ref.iid) ?? { p: 0, t: 0, keywords: [] };
        pumps.set(ref.iid, { p: pump.p + op.p, t: pump.t + op.t, keywords: [...pump.keywords, ...(op.keywords ?? [])] });
      }
    }
  }
  return value;
}

/** The state-based test on a public board: lethal damage, Deathblade damage, or Defense 0. */
function survivesOnBoard(battlefield: readonly Permanent[], db: CardDb, perm: Permanent): boolean {
  if (!battlefield.some((p) => p.iid === perm.iid) || !isType(def(db, perm.cardId), 'creature')) return false;
  const defense = getEffectiveStats(battlefield, db, perm.iid).defense;
  return defense > 0 && perm.damage < defense && !(perm.deathtouched && perm.damage > 0);
}

/**
 * The AI's survival read for "If it survived" (A1.6), kept simple: will the
 * gate's target creature pass the state-based check once the ops before the
 * gate in the same effect have run? It plays those ops on the public board in
 * order: a pump or damage to a target slot, removal of the gate's creature (it
 * did not survive), and a spell-form Hunt (each deals its Attack after the
 * pumps to the other; a Bulwark hunter deals and takes nothing; Deathblade
 * makes any damage lethal). Every other op is ignored, and so is anything the
 * opponent might do in response. A target not on the battlefield does not
 * survive.
 */
export function expectsTargetSurvives(
  view: PlayerView, db: CardDb, prior: readonly EffectOp[],
  gate: Extract<EffectOp, { op: 'ifTargetSurvives' }>, targets: readonly TargetRef[], x = 0,
): boolean {
  const slotIid = (slot: number): number | undefined => {
    const ref = targets[slot];
    return ref?.kind === 'permanent' ? ref.iid : undefined;
  };
  const iid = slotIid(gate.targetIndex ?? 0);
  const perm = view.battlefield.find((p) => p.iid === iid);
  if (!perm || !isType(def(db, perm.cardId), 'creature')) return false;
  const mods = new Map<number, { p: number; t: number; keywords: Keyword[] }>();
  const dealt = new Map<number, { damage: number; deathblade: boolean }>();
  const statsOf = (id: number) => {
    const stats = getEffectiveStats(view.battlefield, db, id);
    const mod = mods.get(id);
    return {
      attack: Math.max(0, stats.attack + (mod?.p ?? 0)), defense: stats.defense + (mod?.t ?? 0),
      keywords: new Set<Keyword>([...stats.keywords, ...(mod?.keywords ?? [])]),
    };
  };
  const deal = (id: number, damage: number, deathblade: boolean): void => {
    if (damage <= 0) return;
    const hit = dealt.get(id) ?? { damage: 0, deathblade: false };
    dealt.set(id, { damage: hit.damage + damage, deathblade: hit.deathblade || deathblade });
  };
  for (const op of prior) {
    const target = slotIid(('targetIndex' in op ? op.targetIndex : undefined) ?? 0);
    if (op.op === 'boost' && op.scope === 'target' && target !== undefined) {
      const mod = mods.get(target) ?? { p: 0, t: 0, keywords: [] };
      mods.set(target, { p: mod.p + op.p, t: mod.t + op.t, keywords: [...mod.keywords, ...(op.keywords ?? [])] });
    } else if (op.op === 'damage' && op.to === 'target' && target !== undefined) {
      deal(target, op.n === 'X' ? x : op.n, false);
    } else if ((op.op === 'destroy' || op.op === 'sever' || op.op === 'recall') && target === perm.iid) {
      return false;
    } else if (op.op === 'hunt' && op.hunter === 'target') {
      const hunter = view.battlefield.find((p) => p.iid === slotIid(0));
      const prey = view.battlefield.find((p) => p.iid === slotIid(1));
      if (!hunter || !prey || hunter.iid === prey.iid ||
        !isType(def(db, hunter.cardId), 'creature') || !isType(def(db, prey.cardId), 'creature')) continue;
      const h = statsOf(hunter.iid);
      if (h.keywords.has('bulwark')) continue;
      const p = statsOf(prey.iid);
      deal(prey.iid, h.attack, h.keywords.has('deathblade'));
      deal(hunter.iid, p.attack, p.keywords.has('deathblade'));
    }
  }
  const hit = dealt.get(perm.iid) ?? { damage: 0, deathblade: false };
  const defense = statsOf(perm.iid).defense;
  const damage = perm.damage + hit.damage;
  return defense > 0 && damage < defense && !((perm.deathtouched || hit.deathblade) && damage > 0);
}

/** The card-shaped weight of "If it survived"'s `then` branch when there is no board to read: the scorer's measured rate (2026-10-01 lab, 84.45% of Hunts survived; src/power/scoreCore.ts). */
const IF_SURVIVES_CARD_WEIGHT = 0.845;

/** A gate's card-shaped value: the survival read when there is one, else the measured blend. */
function survivalGateImpact(op: Extract<EffectOp, { op: 'ifTargetSurvives' }>, survives?: boolean, ramp?: RampImpactContext): number {
  const weight = survives === undefined ? IF_SURVIVES_CARD_WEIGHT : survives ? 1 : 0;
  const sum = (ops: readonly EffectOp[]): number => ops.reduce((total, nested) => total + opImpactValue(nested, undefined, undefined, ramp), 0);
  return weight * sum(op.then) + (1 - weight) * sum(op.else ?? []);
}

/** A spell-form Hunt: the creature in slot 0 hunts the one in slot 1, on the
 * board with the damage earlier ops of the same effect dealt (`dealt`, by
 * iid) marked. The engine checks state only after the effect, so a hunter
 * that damage made lethal still fights with its full Attack, then dies. */
function spellHuntValue(
  view: PlayerView, db: CardDb, hunter: TargetRef | undefined, prey: TargetRef | undefined, mods?: HuntMods,
  dealt?: ReadonlyMap<number, number>,
): number {
  if (hunter?.kind !== 'permanent' || prey?.kind !== 'permanent') return 0;
  const battlefield = dealt && dealt.size > 0 ? battlefieldAfterDamage(view.battlefield, db,
    new Map([...dealt].map(([iid, damage]) => [iid, { damage, deathblade: false }])), () => false) : view.battlefield;
  return huntExchangeValue(view, db, battlefield, hunter.iid, prey.iid, mods);
}

interface ActivatedImpactContext {
  view: PlayerView;
  db: CardDb;
  source: Permanent;
  targets: readonly TargetRef[];
  targetBatch: boolean;
  /** Scoring an action on the live board (true) tracks the deck and sees a
   * target's current tap state. Board-only potential (false) has no deck
   * count, and prices a tap as if its target has untapped by the next use:
   * a creature that attacked is tapped only until its controller's untap. */
  live: boolean;
  /** Set only while `view.battlefield` is the memo's own board, unwritten. */
  provoked?: ProvokedMemo;
}

/** A Hunt's card-shaped floor (`opImpactValue`, `empowerValue`): half a destroy. */
export const HUNT_CARD_FLOOR = 1.5;

interface RampImpactContext {
  view: PlayerView;
  db: CardDb;
  everyDawn?: boolean;
}

// Keep §4v's turn-two 1.9 anchor: each scheduled mana uses the scorer's
// absolute-turn decay, and additional mana on one turn its stacking discount.
const rampLeadValue = (extra: number): number => (1 - RAMP_STACK ** extra) / (1 - RAMP_STACK);
const RAMP_PER_WEIGHTED_MANA = RAMP_ANCHOR / extraManaByTurn((turn) => turn === 2 ? 1 : 0)
  .reduce((sum, extra, index) => sum + RAMP_TURN_DECAY ** index * rampLeadValue(extra), 0);

/** §4v (src/power/scoreCore.ts), starting from the live public economy rather
 * than assuming mana value == cast turn == lands in play. Compare this cast
 * with a blank from the same position; both schedules use their normal drops.
 * Extra lands enter tapped, so count the lead only after the NEXT normal
 * drop. A new Dawn engine first fires next turn; its capped schedule receives
 * the scorer's measured Dawn share, once. No view/reserve means no guarantee. */
function extraLandDropValue(n: number, context?: RampImpactContext): number {
  if (!context) return 0;
  const { view, db, everyDawn = false } = context;
  const reserve = view.you.landReserve?.length ?? 0;
  const canPlayThisTurn = view.activePlayer === view.myId && view.step !== 'end' && view.step !== 'cleanup';
  if (!reserve || n <= 0 || !everyDawn && !canPlayThisTurn) return 0;
  const lands = view.battlefield.filter((p) => p.controller === view.myId && isType(def(db, p.cardId), 'land')).length;
  const cap = lands + reserve;
  let normal = Math.min(cap, lands + (canPlayThisTurn ? view.you.landDropsRemaining : 0));
  let ramped = Math.min(cap, normal + (everyDawn ? 0 : n));
  const ownTurn = Math.floor((view.turn + Number(view.startingPlayer === view.myId)) / 2);
  let weightedMana = 0;
  for (let future = 1; normal < cap; future++) {
    normal = Math.min(cap, normal + 1);
    ramped = Math.min(cap, ramped + 1);
    weightedMana += RAMP_TURN_DECAY ** (ownTurn + future - 1) * rampLeadValue(ramped - normal);
    if (everyDawn) ramped = Math.min(cap, ramped + n);
  }
  return weightedMana * RAMP_PER_WEIGHTED_MANA * (everyDawn ? RAMP_DAWN_SHARE : 1);
}


export function opImpactValue(op: EffectOp, activated?: ActivatedImpactContext, recipients?: readonly KeywordBody[], ramp?: RampImpactContext): number {
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
    case 'discard':
      return -op.n * 0.65;
    case 'sacrifice':
      return op.who === 'opponent' ? 2.5 : 0.5;
    case 'tapAll':
      return 1.5;
    case 'reclaimSelf':
      return 2;
    case 'preventCombatTo':
      return 0.75;
    case 'discardRandom':
      return op.n * 1;
    case 'createToken':
      return op.count * (1.5 + (op.marks ?? 0) * 1.2);
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
      return op.scope === 'self' || op.scope === 'allYours' || op.scope === 'yourMarked' || op.scope === 'theirMarked'
        ? (Math.max(0, op.p + op.t) / 2 + boostKeywordValue(op, recipients)) *
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
    case 'extraLandDrop':
      return extraLandDropValue(op.n ?? 1, ramp);
    case 'severSelf':
      // This is a sacrifice-like cost, not a benefit of the trigger.
      return -1.5;
    case 'raise':
      // Card-shaped: the raised creature is unknown, so a granted keyword is
      // valued at the reference attack.
      return (op.to === 'top' ? 2.5 + (op.withMarks ?? 0) * 0.65 : 2) +
        keywordScore(op.grantKeywords ?? [], KEYWORD_REFERENCE_ATTACK);
    case 'ifTargetMarked': {
      const thenValue = op.then.reduce((sum, nested) => sum + opImpactValue(nested, undefined, undefined, ramp), 0);
      const elseValue = (op.else ?? []).reduce((sum, nested) => sum + opImpactValue(nested, undefined, undefined, ramp), 0);
      // A card-shaped estimate cannot know whether the target is marked. Keep
      // only a conservative portion of the better branch's upside.
      return Math.min(thenValue, elseValue) * 0.4 + Math.max(thenValue, elseValue) * 0.6;
    }
    case 'ifTargetSurvives':
      return survivalGateImpact(op, undefined, ramp);
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
    case 'hunt':
      // Card-shaped: the creatures are unknown, so a Hunt is priced at a
      // conditional removal floor, half of Empower's destroy. Its board value
      // is `huntExchangeValue`, which every target decision reads. Provisional.
      return HUNT_CARD_FLOOR;
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
  if (op.op === 'tap' && ctx.live && (target?.tapped ||
    target && target.controller !== view.myId && view.activePlayer === view.myId && view.step === 'main2')) return 0;
  if (op.op === 'foresee' && op.who === 'targetOwner') {
    const owner = target?.owner ?? (ref.kind === 'player' || ref.kind === 'grave' ? ref.player : undefined);
    return owner === undefined ? 0 : op.n * 0.5 * (owner === view.myId ? 1 : -1);
  }
  return targetValueForAbility(view, db, source, { ops: [op] }, ref, false, undefined, ctx.provoked);
}

/** Signed public-board scoring used only by the new activated rider. */
function activatedOpImpact(op: EffectOp, ctx: ActivatedImpactContext): number {
  const { view, db, source } = ctx;
  if (op.op === 'extraLandDrop') return extraLandDropValue(op.n ?? 1, { view, db });
  const refs = 'targetIndex' in op && op.targetIndex !== undefined ? ctx.targets.slice(op.targetIndex, op.targetIndex + 1) :
    ctx.targetBatch ? ctx.targets : ctx.targets.slice(0, 1);
  const material = (perm: Permanent): number => removalTargetValue(view.battlefield, db, perm, false);
  if (isTargetBranchOp(op)) {
    return refs.reduce((sum, ref) => {
      const target = ref.kind === 'permanent' ? view.battlefield.find((p) =>
        p.iid === ref.iid && isType(def(db, p.cardId), 'creature')) : undefined;
      const taken = op.op === 'ifTargetMarked' ? target !== undefined && target.plusOneCounters > 0
        : target !== undefined && survivesOnBoard(view.battlefield, db, target);
      const branch = taken ? op.then : (op.else ?? []);
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
  if (op.op === 'draw' && ctx.live && op.n > view.you.deckCount) return -Infinity;
  if (op.op === 'damage') {
    if (op.to === 'controller') return op.n === 'X' ? 0 : -op.n * 0.9;
    if (op.to === 'eachCreature') return symmetricCreatureSweepValue(view.battlefield, db, view.myId, op, false);
    if (op.to === 'eachYourCreature') return symmetricCreatureSweepValue(view.battlefield, db, view.myId, op, false, source.iid);
    if (op.to === 'eachOpponentCreature') return creatures.filter((perm) => perm.controller !== view.myId)
      .reduce((sum, perm) => sum + activatedTargetImpact({ ...op, to: 'target' }, ctx, { kind: 'permanent', iid: perm.iid }), 0);
  }
  if (op.op === 'tapAll') return creatures.filter((perm) => perm.controller !== view.myId && (!perm.tapped || !ctx.live))
    .reduce((sum, perm) => sum + activatedTargetImpact({ op: 'tap', to: 'target' }, ctx, { kind: 'permanent', iid: perm.iid }), 0);
  if (op.op === 'sacrifice') {
    const cheapest = (mine: boolean): number => {
      const bodies = creatures.filter((perm) => (perm.controller === view.myId) === mine);
      return bodies.length === 0 ? 0 : Math.min(...bodies.map(material));
    };
    return cheapest(false) - (op.who === 'each' ? cheapest(true) : 0);
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
    const affected = creatures.filter((p) => op.scope === 'self' ? p.iid === source.iid : op.scope === 'all' ||
      (op.scope === 'theirMarked' ? p.controller !== view.myId : p.controller === view.myId) &&
      (op.scope !== 'yourMarked' && op.scope !== 'theirMarked' || p.plusOneCounters > 0));
    return affected.reduce((sum, perm) => sum + activatedTargetImpact(
      { ...op, scope: 'target' }, ctx, { kind: 'permanent', iid: perm.iid },
    ), 0);
  }
  if (op.op === 'addCounters' && op.to === 'self') return isType(def(db, source.cardId), 'creature') ? opImpactValue(op) : 0;
  if (op.op === 'propagate') return mine.filter((p) => p.plusOneCounters > 0).length * opImpactValue(op);
  if (op.op === 'markAll') return mine.filter((perm) => !op.other || perm.iid !== source.iid).length * opImpactValue(op);
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
    if (op.op === 'draw' && ctx.live) ctx.view.you.deckCount -= op.n;
    if (op.op !== 'removeMarks' && op.op !== 'addCounters' && op.op !== 'markAll' &&
      op.op !== 'propagate' && op.op !== 'moveMark') continue;
    const creatures = ctx.view.battlefield.filter((p) => isType(def(ctx.db, p.cardId), 'creature'));
    const mine = creatures.filter((p) => p.controller === ctx.view.myId);
    const refs = 'targetIndex' in op && op.targetIndex !== undefined ? ctx.targets.slice(op.targetIndex, op.targetIndex + 1) :
      ctx.targetBatch ? ctx.targets : ctx.targets.slice(0, 1);
    const targets = creatures.filter((p) => refs.some((ref) => ref.kind === 'permanent' && ref.iid === p.iid));
    if (op.op === 'removeMarks') {
      for (const target of targets) target.plusOneCounters = 0;
    } else if (op.op === 'addCounters') {
      const affected = op.to === 'self' ? creatures.filter((p) => p.iid === ctx.source.iid) : targets;
      for (const target of affected) target.plusOneCounters += Math.max(0, op.n);
    } else if (op.op === 'markAll' || op.op === 'propagate') {
      for (const target of mine) {
        if (op.op === 'markAll' ? !op.other || target.iid !== ctx.source.iid : target.plusOneCounters > 0) target.plusOneCounters++;
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

/**
 * One decision values the same Duty several times (the Hunt policy, then
 * Medium's mana reserve and its ladder). Views are never mutated once built
 * (as `activatedPolicy`'s edge cache relies on), so a view's values are kept
 * on the view object itself, by database and by the only parts of the action
 * the value reads, and die with the view.
 */
const ACTIVATE_VALUES = new WeakMap<PlayerView, WeakMap<CardDb, { values: Map<string, number>; provoked: ProvokedMemo }>>();

export function activateActionValue(
  view: PlayerView,
  db: CardDb,
  action: Extract<Action, { type: 'activate' }>,
): number {
  let byDb = ACTIVATE_VALUES.get(view);
  if (!byDb) ACTIVATE_VALUES.set(view, byDb = new WeakMap());
  let memo = byDb.get(db);
  if (!memo) byDb.set(db, memo = { values: new Map(), provoked: new Map() });
  const key = `${action.iid}|${action.abilityIndex ?? 0}|${JSON.stringify(action.targets ?? [])}`;
  let value = memo.values.get(key);
  if (value === undefined) memo.values.set(key, value = activatedActionImpact(view, db, action, true, memo.provoked));
  return value;
}

/** Mark writes can couple optional targets through later ops or branches. */
function activatedWritesMarks(ops: readonly EffectOp[]): boolean {
  return ops.some((op) => op.op === 'addCounters' || op.op === 'removeMarks' ||
    op.op === 'markAll' || op.op === 'propagate' || op.op === 'moveMark' ||
    (isTargetBranchOp(op) &&
      (activatedWritesMarks(op.then) || activatedWritesMarks(op.else ?? []))));
}

function activatedActionImpact(
  view: PlayerView,
  db: CardDb,
  action: Extract<Action, { type: 'activate' }>,
  live: boolean,
  provoked?: ProvokedMemo,
  /** A mark-writing Duty's scratch of `view.battlefield`, kept by a caller that scores many target lists. */
  scratch?: { reset: () => Permanent[] },
): number {
  const source = view.battlefield.find((p) => p.iid === action.iid);
  const ability = source && activatedAbilitiesOf(def(db, source.cardId))[action.abilityIndex ?? 0];
  if (!source || !ability) return -Infinity;
  const writesMarks = activatedWritesMarks(ability.ops);
  const ctx: ActivatedImpactContext = {
    view: {
      ...view, you: { ...view.you },
      battlefield: writesMarks ? (scratch ?? markScratch(view.battlefield, db)).reset() : view.battlefield,
    },
    db, source, live,
    // A mark-writing Duty scores a copy it writes, not the memo's board.
    ...(writesMarks ? {} : { provoked }),
    targets: action.targets ?? [],
    targetBatch: ability.targets?.length === 1 && (ability.targets[0].upTo !== undefined || ability.targets[0].exactly !== undefined),
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
    if (spec.maxCost !== undefined && manaValue(card.cost) > spec.maxCost) continue;
    if (spec.minAttack !== undefined && (!creature || getEffectiveStats(view.battlefield, db, perm.iid).attack < spec.minAttack)) continue;
    const mine = perm.controller === source.controller;
    const creatureTarget = spec.what === 'creature' || spec.what === 'any' || spec.what === 'opponentCreature';
    if (creatureTarget && !mine && getEffectiveStats(view.battlefield, db, perm.iid).keywords.has('untouchable')) continue;
    const matches = spec.what === 'opponentCreature' ? creature && !mine : creatureTarget ? creature : spec.what === 'yourCreature' ? mine && creature :
      spec.what === 'yourPermanent' ? mine : spec.what === 'artifactOrEnchantment' ?
        isType(card, 'artifact') || isType(card, 'enchantment') :
        (spec.what === 'artifact' || spec.what === 'enchantment') && isType(card, spec.what);
    if (matches) refs.push({ kind: 'permanent', iid: perm.iid });
  }
  if ((spec.what === 'any' || spec.what === 'player') && !spec.marked && !spec.tapped && spec.maxCost === undefined && spec.minAttack === undefined) {
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
export function activatedAbilityValue(
  battlefield: readonly Permanent[], db: CardDb, iid: number, abilityIndex = 0, provoked?: ProvokedMemo,
): number {
  const source = battlefield.find((p) => p.iid === iid);
  const ability = source && activatedAbilitiesOf(def(db, source.cardId))[abilityIndex];
  if (!source || !ability) return 0;
  const view = neutralView(battlefield, source.controller);
  // One scratch board for every target list scored below (`markScratch`).
  const scratch = activatedWritesMarks(ability.ops) ? markScratch(view.battlefield, db) : undefined;
  let lists: TargetRef[][] = [[]];
  for (const spec of ability.targets ?? []) {
    const refs = activatedPotentialTargets(view, db, source, spec);
    if (spec.upTo !== undefined || spec.exactly !== undefined) {
      const score = (targets: TargetRef[]): number =>
        activatedActionImpact(view, db, { type: 'activate', iid, abilityIndex, targets }, false, provoked, scratch);
      const singles = refs.map((ref, index) => ({ ref, index, value: score([ref]) }));
      let best = spec.exactly !== undefined ? 0 : Math.max(0, score([]), ...singles.map((entry) => entry.value));
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
  return Math.max(0, ...lists.map((targets) =>
    activatedActionImpact(view, db, { type: 'activate', iid, abilityIndex, targets }, false, provoked, scratch)));
}

/** Extra battlefield value for non-creature static and recurring engines. */
function nonCreatureAbilityImpact(battlefield: readonly Permanent[], db: CardDb, source: Permanent): number {
  const d = def(db, source.cardId);
  if (isType(d, 'creature')) return 0;
  let value = 0;
  for (const ab of d.abilities ?? []) {
    if (ab.when === 'static' && ab.static) {
      const st = ab.static;
      const stats = (Math.abs(st.p ?? 0) + Math.abs(st.t ?? 0)) / 2;
      const base = st.scope === 'filter' ? 1.5 : st.scope === 'attached' ? 0.75 : 1;
      value += base + stats * 0.7;
      continue;
    }
    const conditionMultiplier = abilityConditionMultiplier(ab.condition);
    if (ab.when === 'dawn' || ab.when === 'sunset') {
      value += 0.75 + (ab.ops ?? []).reduce((sum, op) => sum + opImpactValue(op), 0) * conditionMultiplier;
    } else if (ab.when !== 'spell') {
      value += 0.35 + (ab.ops ?? []).reduce((sum, op) => sum + opImpactValue(op) * 0.5, 0) * conditionMultiplier;
    }
  }
  const grants = new Set((d.abilities ?? []).flatMap((ab) => ab.when === 'static' ? ab.static?.grantKeywords ?? [] : []));
  if (grants.size > 0) {
    // Let the engine's static layers enforce attachment, filters, conditions
    // and duplicate grants. Price only keywords this source actually adds.
    const withoutSource = battlefield.filter((perm) => perm.iid !== source.iid);
    for (const perm of withoutSource) {
      if (!isType(def(db, perm.cardId), 'creature')) continue;
      const current = getEffectiveStats(battlefield, db, perm.iid);
      const prior = getEffectiveStats(withoutSource, db, perm.iid);
      const keywords = [...grants].filter((keyword) => current.keywords.has(keyword) && !prior.keywords.has(keyword));
      value += keywordScore(keywords, current.attack) * (perm.controller === source.controller ? 1 : -1);
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
    ? nonCreatureAbilityImpact(battlefield, db, perm)
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
  | 'debuff'
  | 'removeMarks'
  | 'damage';

/** Explicit cast context opts the stronger brains into spell-body decisions. */
export type SpellMode = Pick<Extract<Action, { type: 'castSpell' }>,
  'targets' | 'x' | 'retell' | 'whispers' | 'empowered' | 'hauntlinked'>;

function publicCondition(view: PlayerView, db: CardDb, condition: AbilityDef['condition']): boolean {
  if (condition === undefined) return true;
  if (condition === 'questActive') return isQuestActive(view.battlefield, db, view.myId);
  if (condition === 'creatureDiedThisTurn') return view.creatureDiedThisTurn === true;
  const mine = view.battlefield.filter((p) => p.controller === view.myId && isType(def(db, p.cardId), 'creature'));
  if (condition === 'controlMarked') return mine.some((p) => p.plusOneCounters > 0);
  if (condition.kind === 'controlsOther') return mine.some((p) => def(db, p.cardId).subtypes.includes(condition.subtype));
  return mine.filter((p) => p.plusOneCounters > 0).length >= condition.n;
}

/** The chosen mode's own ops only: Retell replaces the body, Empower appends. */
export function castSpellOps(db: CardDb, cardId: string, mode: SpellMode = {}, view?: PlayerView): EffectOp[] {
  const d = def(db, cardId);
  const ops = mode.retell && d.retell?.ops ? d.retell.ops : (d.abilities ?? [])
    .filter((ab) => ab.when === 'spell' && (!view || publicCondition(view, db, ab.condition)))
    .flatMap((ab) => ab.ops ?? []);
  return [...ops, ...(mode.empowered ? d.empower?.ops ?? [] : [])];
}

/** Undefined for other ops; zero means this Mark payoff has no recipient.
 * Damage to each creature you control is read the same way (Trial by Ember,
 * wave 4): with none of yours it does nothing, so it spends no payoff. */
function markRecipients(view: PlayerView, db: CardDb, op: EffectOp): number | undefined {
  if (op.op !== 'propagate' && !(op.op === 'boost' && op.scope === 'yourMarked') &&
    !(op.op === 'markAll' && op.scope === 'yourCreatures') && !(op.op === 'damage' && op.to === 'eachYourCreature')) return undefined;
  return view.battlefield.filter((perm) => perm.controller === view.myId && isType(def(db, perm.cardId), 'creature') &&
    (op.op === 'markAll' || op.op === 'damage' || perm.plusOneCounters > 0)).length;
}

/** Hold a Mark-only spell until it has a board. Incidental life (Apotheosis)
 * does not spend the payoff; an independent effect such as Reef Bloom's
 * Foresee still has a use. A creature is always allowed to develop its body.
 * A spell that damages and Marks each of your creatures (Trial by Ember) is
 * held with no creature of yours, as Brood Communion is (wave 4). */
export function emptyMarkPayoff(view: PlayerView, db: CardDb, cardId: string, mode: SpellMode = {}): boolean {
  const d = def(db, cardId);
  if (isType(d, 'creature') && !(mode.retell && d.retell?.ops) || mode.hauntlinked) return false;
  const ops = castSpellOps(db, cardId, mode, view);
  const recipients = ops.map((op) => markRecipients(view, db, op));
  return recipients.some((count) => count !== undefined) &&
    ops.every((op, index) => recipients[index] === 0 || op.op === 'gainLife');
}

/** The shared cast menu must not reintroduce an empty payoff through search,
 * Whispers or Retell after the develop ladder has declined it. */
export function usefulMarkCast(view: PlayerView, db: CardDb, action: Action): boolean {
  if (action.type !== 'castSpell') return true;
  const cardId = (action.retell || action.whispers) && action.graveIndex !== undefined
    ? view.you.graveyard[action.graveIndex] : view.you.hand[action.handIndex];
  return !emptyMarkPayoff(view, db, cardId, action);
}

export function spellOpTargets(db: CardDb, cardId: string, mode: SpellMode, op: EffectOp): readonly TargetRef[] {
  const targets = mode.targets ?? [];
  if ('targetIndex' in op && op.targetIndex !== undefined) return targets.slice(op.targetIndex, op.targetIndex + 1);
  if (op.op === 'moveMark') return targets;
  const specs = castTargetSpecsFor(def(db, cardId), !!mode.retell, !!mode.hauntlinked, !!mode.empowered);
  return specs.length === 1 && (specs[0].upTo !== undefined || specs[0].exactly !== undefined) ? targets : targets.slice(0, 1);
}

/** Bind slots and select mark branches using only public facts. Mark writes
 * are projected in order because later ops in this same spell can read them. */
export function boundCastEffects(view: PlayerView, db: CardDb, cardId: string, mode: SpellMode = {}): { op: EffectOp; targets: readonly TargetRef[] }[] {
  const effects: { op: EffectOp; targets: readonly TargetRef[] }[] = [];
  const marks = new Map(view.battlefield.map((p) => [p.iid, p.plusOneCounters]));
  const visit = (ops: readonly EffectOp[], branchTarget?: TargetRef): void => {
    for (const [index, op] of ops.entries()) {
      const refs = branchTarget && !('targetIndex' in op && op.targetIndex !== undefined)
        ? [branchTarget] : spellOpTargets(db, cardId, mode, op);
      if (op.op === 'ifTargetMarked') {
        for (const ref of refs) visit(ref.kind === 'permanent' && (marks.get(ref.iid) ?? 0) > 0 ? op.then : op.else ?? [], ref);
        continue;
      }
      if (op.op === 'ifTargetSurvives') {
        // The branch the survival read expects (A1.6).
        const survives = expectsTargetSurvives(view, db, ops.slice(0, index), op, mode.targets ?? [], mode.x ?? 0);
        visit(survives ? op.then : op.else ?? [], refs[0]);
        continue;
      }
      effects.push({ op, targets: refs });
      if (op.op === 'removeMarks' || op.op === 'addCounters' && op.to === 'target') {
        for (const ref of refs) if (ref.kind === 'permanent') marks.set(ref.iid,
          op.op === 'removeMarks' ? 0 : (marks.get(ref.iid) ?? 0) + op.n);
      } else if (op.op === 'moveMark') {
        const [from, to] = refs.filter((ref) => ref.kind === 'permanent');
        if (from && to && from.iid !== to.iid && (marks.get(from.iid) ?? 0) > 0) {
          marks.set(from.iid, marks.get(from.iid)! - 1);
          marks.set(to.iid, (marks.get(to.iid) ?? 0) + 1);
        }
      }
    }
  };
  visit(castSpellOps(db, cardId, mode, view));
  return effects;
}

/** Spell-only reach, never assumed combat damage, triggers, or other stack items. */
export function faceDamageForCast(view: PlayerView, db: CardDb, cardId: string, mode: SpellMode = {}): number {
  return boundCastEffects(view, db, cardId, mode).reduce((sum, { op, targets }) => {
    if (op.op === 'loseLife') return sum + op.n;
    if (op.op === 'loseLifePerTheirMarked') return sum + view.battlefield.filter((p) =>
      p.controller !== view.myId && p.plusOneCounters > 0 && isType(def(db, p.cardId), 'creature')).length;
    if (op.op === 'damage') {
      const n = op.n === 'X' ? mode.x ?? 0 : op.n;
      if (op.to === 'opponent') return sum + n;
      if (op.to === 'target') return sum + n * targets
        .filter((ref) => ref.kind === 'player' && ref.player !== view.myId).length;
    }
    return sum;
  }, 0);
}

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
  sourceIid?: number,
): number {
  const opponent = opponentOf(caster);
  let value = 0;
  // Damage each creature it survives provokes it (plus for the caster's,
  // minus for the opponent's): read once the whole sweep's damage is marked.
  const damage = op.op === 'damage' && op.n !== 'X' ? op.n : 0;
  const struck: Permanent[] = [];
  for (const perm of battlefield) {
    if (!isType(def(db, perm.cardId), 'creature')) continue;
    if (op.op === 'damage' && op.to === 'eachOpponentCreature' && perm.controller === caster) continue;
    // "Damage each [other] creature you control" (eachYourCreature).
    if (op.op === 'damage' && op.to === 'eachYourCreature' &&
      (perm.controller !== caster || op.other === true && perm.iid === sourceIid)) continue;
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
    if (damage > 0) struck.push(perm);
  }
  if (struck.some((perm) => unspentProvoked(db, perm))) {
    const after = battlefieldAfterDamage(battlefield, db, new Map(struck.map((perm) => [perm.iid, { damage, deathblade: false }])));
    // The board shows only this sweep's deaths, not earlier ones this turn.
    const died = struck.some((perm) => !after.some((p) => p.iid === perm.iid));
    for (const perm of struck) {
      if (unspentProvoked(db, perm)) value += signedProvokedValue(after, db, caster, perm.iid, died);
    }
  }
  return value;
}

/** Classify only cast-time spell bodies. Arrival/dawn removal riders stay ETB value. */
export function removalKind(db: CardDb, cardId: string, mode?: SpellMode): RemovalKind | null {
  const d = def(db, cardId);
  const flatten = (ops: readonly EffectOp[]): EffectOp[] => ops.flatMap((op) => isTargetBranchOp(op)
    ? [op, ...flatten(op.then), ...flatten(op.else ?? [])] : [op]);
  // A mixed targeted/mark body must not bypass the sweeper asymmetry gate.
  if (mode !== undefined && flatten(castSpellOps(db, cardId, mode)).some((op) =>
    op.op === 'massDestroy' || op.op === 'damage' && (op.to === 'eachCreature' || op.to === 'eachOpponentCreature') ||
    op.op === 'boost' && op.scope === 'all' && (op.p < 0 || op.t < 0))) return 'massDestroy';
  const abilities: AbilityDef[] = mode?.retell && d.retell?.ops
    ? [{ when: 'spell', ops: d.retell.ops, targets: d.retell.targets }] : d.abilities ?? [];
  for (const ab of abilities) {
    if (ab.when !== 'spell') continue;
    const permanentTarget = ab.targets?.some(
      (target) =>
        target.what === 'creature' ||
        target.what === 'yourCreature' ||
        target.what === 'opponentCreature' ||
        target.what === 'yourPermanent' ||
        target.what === 'any' ||
        target.what === 'artifact' ||
        target.what === 'enchantment' ||
        target.what === 'artifactOrEnchantment',
    );
    for (const op of mode === undefined ? ab.ops ?? [] : flatten(ab.ops ?? [])) {
      if (op.op === 'destroy') return 'destroy';
      if ((op.op === 'sever' || op.op === 'recall') && permanentTarget) {
        return op.op;
      }
      if (op.op === 'destroyArtifactOrSeverEnchantment') return 'branch';
      if (op.op === 'massDestroy' && (mode !== undefined || op.filter === 'allEnchantments')) return 'massDestroy';
      if (op.op === 'destroyNewestOpponentArtifactOrEnchantment') return 'destroyNewest';
      // Damage the card aims only at a creature of yours (Blaze-Horn Charge,
      // Test of the Hearth) is a cost or a Provoked source, never removal: a
      // cast-aware caller would otherwise hold the spell for a removal window
      // its own creature can never open (wave 4, M1).
      if (op.op === 'damage' && op.to === 'target' && !(mode !== undefined &&
        ab.targets?.[('targetIndex' in op ? op.targetIndex : undefined) ?? 0]?.what === 'yourCreature')) return 'damage';
      if (op.op === 'damage' && (op.to === 'eachCreature' || op.to === 'eachOpponentCreature')) return 'massDestroy';
      if (op.op === 'boost' && op.scope === 'all' && (op.p < 0 || op.t < 0)) return 'massDestroy';
      if (mode !== undefined && op.op === 'boost' && op.scope === 'target' && op.p + op.t <= 0) return 'debuff';
      if (mode !== undefined && op.op === 'removeMarks') return 'removeMarks';
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
  mode?: SpellMode,
  view?: PlayerView,
): number {
  const opponent = opponentOf(caster);
  let value = 0;
  const effects = view && mode ? boundCastEffects(view, db, cardId, mode) :
    (mode === undefined ? spellOps(db, cardId) : castSpellOps(db, cardId, mode))
      .map((op) => ({ op, targets: mode ? spellOpTargets(db, cardId, mode, op) : [] }));
  for (const { op, targets } of effects) {
    const bound = mode === undefined || targets.some((ref) => ref.kind === 'permanent' && ref.iid === target?.iid);
    if (
      (op.op === 'destroy' ||
        op.op === 'sever' ||
        op.op === 'recall' ||
        op.op === 'destroyArtifactOrSeverEnchantment') &&
      target?.controller === opponent && bound
    ) {
      value += removalTargetValue(battlefield, db, target);
    } else if (op.op === 'massDestroy') {
      const doomed = battlefield.filter((perm) => {
        if (perm.controller !== opponent && (mode === undefined || op.filter === 'allEnchantments')) return false;
        const d = def(db, perm.cardId);
        if (op.filter === 'allEnchantments') return isType(d, 'enchantment');
        if (!isType(d, 'creature')) return false;
        return op.filter === 'allCreatures' || getEffectiveStats(battlefield, db, perm.iid).keywords.has('skyborne');
      });
      value += doomed.reduce((sum, perm) => sum + removalTargetValue(battlefield, db, perm) *
        (perm.controller === opponent ? 1 : -1), 0);
    } else if (op.op === 'damage' && (op.to === 'eachCreature' || op.to === 'eachOpponentCreature')) {
      value += symmetricCreatureSweepValue(battlefield, db, caster, op);
    } else if (op.op === 'boost' && op.scope === 'all' && (op.p < 0 || op.t < 0)) {
      value += symmetricCreatureSweepValue(battlefield, db, caster, op);
    } else if (mode !== undefined && target?.controller === opponent) {
      if (bound && isType(def(db, target.cardId), 'creature')) {
        const stats = getEffectiveStats(battlefield, db, target.iid);
        if (op.op === 'damage' && op.to === 'target') {
          const n = op.n === 'X' ? mode.x ?? 0 : op.n;
          value += n >= stats.defense - target.damage ? removalTargetValue(battlefield, db, target) : n * 0.45;
        } else if (op.op === 'boost' && op.scope === 'target' && op.p + op.t <= 0) {
          value += stats.defense + op.t <= target.damage ? removalTargetValue(battlefield, db, target) : -(op.p + op.t) * 0.375;
        } else if (op.op === 'removeMarks') {
          value += stats.defense - target.plusOneCounters <= target.damage
            ? removalTargetValue(battlefield, db, target) : target.plusOneCounters * 1.15;
        }
      }
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
export function conditionalAbilityValue(db: CardDb, cardId: string, view?: PlayerView): number {
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
    const vocabularyTrigger = ['allyDies', 'youGainLife', 'youCastCharm', 'allyAttacks', 'sunset'].includes(ab.when);
    const vocabularyCondition = ab.condition === 'creatureDiedThisTurn' ||
      typeof ab.condition === 'object' && ab.condition.kind === 'controlsOther';
    if (!markedOps && !markedCondition && !vocabularyTrigger && !vocabularyCondition &&
      !(view && ab.condition === 'questActive')) continue;
    value += (ab.ops ?? []).reduce((sum, op, index) => sum + opImpactValue(op, undefined,
      op.op === 'boost' ? boostRecipients(view, db, cardId, op, {}, (ab.ops ?? []).slice(0, index)) : undefined), 0) *
      abilityConditionMultiplier(ab.condition, view && isQuestActive(view.battlefield, db, view.myId)) * 0.5;
  }
  return value;
}

/** One spell ability's printed value as `cardValue` reads it, for the ops
 * `only` keeps (all of them by default). */
function spellAbilityImpact(
  view: PlayerView, db: CardDb, cardId: string, ab: Pick<AbilityDef, 'ops' | 'condition'>, mode: SpellMode,
  only?: (op: EffectOp) => boolean,
): number {
  // "If it survived" reads the cast's own targets when it has them (A1.6).
  return (ab.ops ?? []).reduce((sum, op, index) => sum + (only && !only(op) ? 0 : op.op === 'ifTargetSurvives' && mode.targets
    ? survivalGateImpact(op, expectsTargetSurvives(view, db, (ab.ops ?? []).slice(0, index), op, mode.targets, mode.x ?? 0), { view, db })
    : markRecipients(view, db, op) === 0 ? 0 :
      opImpactValue(op, undefined, op.op === 'boost' ? boostRecipients(view, db, cardId, op, mode, (ab.ops ?? []).slice(0, index)) : undefined, { view, db })), 0) *
    abilityConditionMultiplier(ab.condition, isQuestActive(view.battlefield, db, view.myId));
}

/** What `cardValue` already counts for a spell's target-bound ops (a Hunt's
 * floor, an "If it survived" draw), so a caller that values those ops on
 * the board at the cast's targets can replace them rather than add to them. */
export function spellTargetedBodyImpact(view: PlayerView, db: CardDb, cardId: string, mode: SpellMode = {}): number {
  const d = def(db, cardId);
  if (isType(d, 'creature') || !isType(d, 'charm') && !isType(d, 'ritual')) return 0;
  const abilities = mode.retell && d.retell?.ops ? [{ when: 'spell' as const, ops: d.retell.ops }] : d.abilities ?? [];
  return abilities.reduce((sum, ab) => sum + (ab.when === 'spell'
    ? spellAbilityImpact(view, db, cardId, ab, mode, effectOpUsesTarget) : 0), 0);
}

/** What `cardValue` counts for a spell's ops that name no target (Ember-Flick's
 * Foresee, a removal spell's draw), at the printed rates (`opImpactValue`).
 * A caller that values a cast by its targets alone (Medium's removal worth)
 * adds this so the rest of the card is not worth 0
 * to it (1.9.1). 0 for a creature or a permanent. */
export function spellUntargetedBodyImpact(view: PlayerView, db: CardDb, cardId: string, mode: SpellMode = {}): number {
  const d = def(db, cardId);
  if (isType(d, 'creature') || !isType(d, 'charm') && !isType(d, 'ritual')) return 0;
  const abilities = mode.retell && d.retell?.ops ? [{ when: 'spell' as const, ops: d.retell.ops }] : d.abilities ?? [];
  return abilities.reduce((sum, ab) => sum + (ab.when === 'spell'
    ? spellAbilityImpact(view, db, cardId, ab, mode, (op) => !effectOpUsesTarget(op)) : 0), 0);
}

export function cardValue(db: CardDb, cardId: string, view?: PlayerView, mode: SpellMode = {}): number {
  const d = def(db, cardId);
  if (view && emptyMarkPayoff(view, db, cardId, mode)) return 0;
  let v = manaValue(d.cost);
  if (isType(d, 'creature')) {
    v += ((d.attack ?? 0) + (d.defense ?? 0)) / 2;
    v += keywordScore(d.keywords ?? [], d.attack ?? 0);
    v += nineLivesValue(d);
  }
  if (isLordOrLegendary(db, cardId)) v += 1;
  if (hasTriggeredAbility(db, cardId, view)) v += 0.75;
  if (view) {
    for (const ab of d.abilities ?? []) {
      if (ab.when !== 'arrives' && ab.when !== 'dawn') continue;
      const drops = (ab.ops ?? []).reduce((sum, op) => sum + (op.op === 'extraLandDrop' ? op.n ?? 1 : 0), 0);
      if (drops) v += opImpactValue({ op: 'extraLandDrop', n: drops }, undefined, undefined,
        { view, db, everyDawn: ab.when === 'dawn' }) *
        abilityConditionMultiplier(ab.condition, isQuestActive(view.battlefield, db, view.myId));
    }
  }
  // New marked/arrival mechanics get a conservative printed premium. Keep
  // this restricted to the provisional wave so existing card valuations and
  // their measured win-rate gates remain byte-for-byte behaviorally stable.
  v += conditionalAbilityValue(db, cardId, view);
  // Explicit public context keeps Easy and the shared discard/fodder policies
  // byte-identical. Medium/Hard can price a spell's actual body and target.
  if (view && !isType(d, 'creature') && (isType(d, 'charm') || isType(d, 'ritual'))) {
    const abilities = mode.retell && d.retell?.ops
      ? [{ when: 'spell' as const, ops: d.retell.ops }] : d.abilities ?? [];
    for (const ab of abilities) {
      if (ab.when !== 'spell') continue;
      v += spellAbilityImpact(view, db, cardId, ab, mode);
      // Damage to each of your own creatures: a cost, less every unspent
      // Provoked it sets off on a survivor (a friendly source, Part 4 item 2).
      for (const op of ab.ops ?? []) {
        if (op.op === 'damage' && op.to === 'eachYourCreature') v += symmetricCreatureSweepValue(view.battlefield, db, view.myId, op);
      }
    }
    const targets = view.battlefield.filter((p) => mode.targets?.some((ref) => ref.kind === 'permanent' && ref.iid === p.iid));
    if (removalKind(db, cardId, mode) !== 'massDestroy') {
      for (const target of targets) v += removalValueForCast(view.battlefield, db, view.myId, cardId, target, mode, view);
    }
  }
  if (d.chapters) v += d.chapters.length * 0.75;
  if (isType(d, 'creature') && d.awakening) v += 0.5 + awakeningValue(d, d.attack ?? 0);
  return v;
}

/** Recurring Quest riders beyond body stats; statics already use effective stats. */
export function questBoardValue(battlefield: readonly Permanent[], db: CardDb, controller: PlayerId): number {
  const multiplier = abilityConditionMultiplier('questActive', isQuestActive(battlefield, db, controller));
  return battlefield.filter((p) => p.controller === controller).reduce((sum, p) => sum +
    (def(db, p.cardId).abilities ?? []).filter((ab) => ab.condition === 'questActive' &&
      ab.when !== 'spell' && ab.when !== 'static' && ab.when !== 'arrives')
      .reduce((total, ab) => total + (ab.ops ?? []).reduce((n, op) => n + opImpactValue(op), 0) * multiplier * 0.5, 0), 0);
}

/** Cheap deterministic estimate used when an AI chooses whether to pay Empower. */
export function empowerValue(
  db: CardDb, cardId: string, view?: PlayerView, mode: SpellMode = {},
  /** Count only the ops this keeps (all of them by default). */
  only?: (op: EffectOp) => boolean,
): number {
  const ops = def(db, cardId).empower?.ops ?? [];
  const opValue = (op: EffectOp, index: number): number => {
    switch (op.op) {
      case 'extraLandDrop':
        return opImpactValue(op, undefined, undefined, view ? { view, db } : undefined);
      case 'damage':
        return op.n === 'X' ? 0 : op.n * (op.to === 'controller' ? -0.6 : 0.9);
      case 'destroy':
        return 3;
      case 'discard':
      case 'sacrifice':
      case 'tapAll':
      case 'preventCombatTo':
      case 'reclaimSelf':
        return opImpactValue(op);
      case 'loseLife':
        return op.n * 0.9;
      case 'gainLife':
        return op.n * 0.25;
      case 'draw':
        return op.n * 1.2;
      case 'addCounters':
        return op.n * 1.5;
      case 'propagate':
        // Retain the conservative single-mark estimate. Live recipient
        // pricing here is limited to the granted-keyword change (U2).
        return 1.5;
      case 'createToken':
        return op.count * 2;
      case 'raise':
        return op.to === 'target' ? 0 : 3;
      case 'foresee':
        return op.n * 0.6;
      case 'boost':
        return (op.p + op.t) / 2 + boostKeywordValue(op, boostRecipients(view, db, cardId, op, { ...mode, empowered: true }, ops.slice(0, index)));
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
      case 'hunt':
        return HUNT_CARD_FLOOR;
      case 'ifTargetMarked':
        return op.then.reduce((sum, nested) => sum + opValue(nested, index), 0) * 0.6 +
          (op.else ?? []).reduce((sum, nested) => sum + opValue(nested, index), 0) * 0.4;
      case 'ifTargetSurvives':
        return op.then.reduce((sum, nested) => sum + opValue(nested, index), 0) * IF_SURVIVES_CARD_WEIGHT +
          (op.else ?? []).reduce((sum, nested) => sum + opValue(nested, index), 0) * (1 - IF_SURVIVES_CARD_WEIGHT);
      default:
        return 0;
    }
  };
  return ops.reduce((sum, op, index) => sum + (only && !only(op) ? 0 : opValue(op, index)), 0);
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
export function retellValue(db: CardDb, cardId: string, view?: PlayerView): number {
  const d = def(db, cardId);
  if (!d.retell) return 0;
  const ops = d.retell.ops ?? spellOps(db, cardId);
  return 0.75 + ops.reduce((sum, op) => sum + opImpactValue(op, undefined, undefined, view ? { view, db } : undefined), 0);
}

/** A live marker expires next Dawn on our turn; on theirs it survives ours. */
export function whispersValue(
  db: CardDb,
  cardId: string,
  ctx: Pick<PlayerView, 'myId' | 'activePlayer'>,
): number {
  const d = def(db, cardId);
  if (!d.whispers) return 0;
  const body = isType(d, 'creature')
    ? cardValue(db, cardId)
    : Math.max(cardValue(db, cardId), 0.75 + spellOps(db, cardId).reduce(
      (sum, op) => sum + opImpactValue(op), 0,
    ));
  const saving = manaValue(d.cost) - manaValue(d.whispers.cost);
  return body + saving * 0.65 + (ctx.activePlayer === ctx.myId ? 0.75 : -0.25);
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
  const linkedAttack = current.attack + (rider.p ?? 0);
  for (const keyword of rider.grantKeywords ?? []) {
    if (!current.keywords.has(keyword)) value += keywordBonus(keyword, linkedAttack);
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
    // The live spell price already removed an empty payoff. Keep a mixed
    // spell's independent effect (Reef Bloom's Foresee) without charging it
    // for the absent Mark twice. Creature riders retain their body ordering.
    if (!isType(d, 'creature') && (op.op === 'propagate' && marked === 0 ||
      op.op === 'markAll' && op.scope === 'yourCreatures' && creatures === 0)) continue;
    if (op.op === 'propagate') adjust += (marked - 1) * 0.8;
    else if (op.op === 'markAll' && op.scope === 'yourCreatures') adjust += (creatures - 1.5) * 0.6;
  }
  return adjust;
}

/** One board evaluation's Duty potentials by ability and controller, and its
 * Provoked reads (the board does not change while a valuer lives). */
interface ActivatedPotentialCache {
  potentials: Map<ActivatedDef, Map<PlayerId, number>>;
  provoked: ProvokedMemo;
}

function activatedUsesSource(ops: readonly EffectOp[]): boolean {
  return ops.some((op) => op.op === 'severSelf' ||
    (op.op === 'addCounters' && op.to === 'self') ||
    (op.op === 'awaken' && op.scope === 'self') ||
    (op.op === 'boost' && op.scope === 'self') ||
    (op.op === 'markAll' && op.other === true) ||
    (isTargetBranchOp(op) &&
      (activatedUsesSource(op.then) || activatedUsesSource(op.else ?? []))));
}

/** Reuse identical source-independent riders only within this board evaluation. */
export function createPermanentValuer(battlefield: readonly Permanent[], db: CardDb): (iid: number) => number {
  const cache: ActivatedPotentialCache = { potentials: new Map(), provoked: new Map() };
  return (iid) => permValue(battlefield, db, iid, true, cache);
}

function cachedActivatedPotential(
  battlefield: readonly Permanent[], db: CardDb, perm: Permanent,
  ability: ActivatedDef, abilityIndex: number, cache?: ActivatedPotentialCache,
): number {
  if (!cache || ability.targets?.some((spec) => spec.other) || activatedUsesSource(ability.ops)) {
    return activatedAbilityValue(battlefield, db, perm.iid, abilityIndex, cache?.provoked);
  }
  let byController = cache.potentials.get(ability);
  const cached = byController?.get(perm.controller);
  if (cached !== undefined) return cached;
  const value = activatedAbilityValue(battlefield, db, perm.iid, abilityIndex, cache.provoked);
  if (!byController) { byController = new Map(); cache.potentials.set(ability, byController); }
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
  const stats = isType(d, 'creature') ? getEffectiveStats(battlefield, db, iid) : undefined;
  if (stats) {
    v += (stats.attack + Math.max(0, stats.defense - perm.damage)) / 2;
    v += keywordScore(stats.keywords, stats.attack);
    v += nineLivesValue(d, perm.plusOneCounters);
    v += markedBodyValue(perm.plusOneCounters);
  }
  if (isLordOrLegendary(db, perm.cardId)) v += 1;
  if (d.chapters) {
    const completed = perm.chapter ?? 0;
    v += Math.max(0, d.chapters.length - completed) * 0.75;
  }
  if (stats && d.awakening && !perm.awakened) {
    v += 0.5 + awakeningValue(d, stats.attack);
  }
  // Duty uses the same expected-use shape as a Dawn rider: two uses on a
  // creature and three on a non-creature. Readiness does not erase potential.
  if (includeActivated && d.activated) {
    const potentials = activatedAbilitiesOf(d).map((ability, index) =>
      cachedActivatedPotential(battlefield, db, perm, ability, index, activatedCache));
    // Every Duty spends the same tap: value the best available use, not their sum.
    v += Math.max(0, ...potentials) * (isType(d, 'creature') ? 2 : 3);
  }
  return v;
}
