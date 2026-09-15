import type { Action } from '../engine/actions';
import { castCost } from '../engine/actions';
import { canBlock, eligibleAttackers } from '../engine/combat/legality';
import type { CardDb, EffectOp, ManaCost, Permanent, TargetRef } from '../engine/types';
import { combineManaCosts, solveMana } from '../engine/mana';
import { enumerateTargets } from '../engine/effects/targeting';
import { castTargetSpecsFor } from '../engine/resolve';
import { def, isType, manaValue, opponentOf } from '../engine/types';
import { getEffectiveStats } from '../engine/statics';
import type { PlayerView } from '../engine/view';
import type { AIPlayer } from './AIPlayer';
import { chooseActivate } from './activatedPolicy';
import { chooseAttackers, chooseBlocks, combatForecast, scoreAttack } from './combatPlans';
import { LIFE_CURVE_KNEE } from './evaluate';
import { DEFAULT_PERSONALITY, type Personality } from './personality';
import { determinize } from './determinize';
import { chooseForesee } from './foresee';
import { chooseDiscard } from './discardPolicy';
import { chooseSacrifice } from './sacrificePolicy';
import { chooseDarlingPaydown } from './darlingPolicy';
import { chooseHauntlinkWindow, chooseUnlinkedHauntlink } from './hauntlinkPolicy';
import { chooseReserveLand } from './landPolicy';
import { choosePlayDraw } from './playDraw';
import { choosePreserve } from './preservePolicy';
import { applyRitePolicy, riteSacrificeValue } from './ritePolicy';
import { applyTithePolicy, titheManaSaved } from './tithePolicy';
import { applyWhispersPolicy } from './whispersPolicy';
import { applyVocabularyTargetPolicy, chooseTargetAction } from './targeting';
import {
  cardValue,
  actionManaCost,
  manaPlanKeeping,
  empowerOpportunityCost,
  empowerValue,
  boundCastEffects,
  faceDamageForCast,
  hauntlinkCastValue,
  markBoardAdjust,
  markedBoardValue,
  permValue,
  removalKind,
  removalValueForCast,
  retellValue,
  skimValue,
  targetValueForAbility,
  whispersValue,
} from './value';

type SpellCast = Extract<Action, { type: 'castSpell' }>;
type Cast = Extract<Action, { type: 'castSpell' | 'castDarling' }>;

/**
 * Medium: rule-based priorities with one-step trade math. Plays a fair game
 * of attrition — lethal checks, profitable trades, removal on the biggest
 * threat, trick-risk respect — but no lookahead. Deliberately does not model
 * face-down information beyond "open mana = maybe a trick".
 */
export class MediumAI implements AIPlayer {
  constructor(
    private readonly db: CardDb,
    private readonly pers: Personality = DEFAULT_PERSONALITY,
  ) {}

  chooseAction(view: PlayerView, legal: Action[]): Action {
    legal = applyVocabularyTargetPolicy(view, this.db, legal, true);
    legal = applyTithePolicy(view, this.db, legal, this.pers);
    legal = applyRitePolicy(view, this.db, legal);
    legal = applyWhispersPolicy(view, this.db, legal, (cast) => this.faceDamage(view, cast) >= view.opp.life
      ? 1e6 - this.manaForCast(view, cast) : this.castScore(view, cast));
    switch (view.awaiting.kind) {
      case 'choosePlayDraw':
        return choosePlayDraw(legal);
      case 'mulligan':
        return this.mulligan(view);
      case 'bottomCards':
      case 'discardToHandSize':
        if (view.awaiting.kind === 'discardToHandSize' && view.awaiting.decision === 'discard') {
          return chooseDiscard(view, this.db);
        }
        return this.worstCards(view, legal);
      case 'foresee':
        return chooseForesee(view, this.db);
      case 'main':
        return this.main(view, this.constrainMainMana(view, legal));
      case 'declareAttackers': {
        const attackers = chooseAttackers(
          view.battlefield,
          this.db,
          view.myId,
          view.opp.life,
          this.trickBuff(view),
          view.you.life,
          this.pers,
        );
        return { type: 'declareAttackers', attackers };
      }
      case 'declareBlockers': {
        if (!view.combat) return { type: 'declareBlockers', blocks: [] };
        const blocks = chooseBlocks(
          view.battlefield,
          this.db,
          view.myId,
          view.you.life,
          view.combat,
          this.trickBuff(view),
          this.pers,
        );
        return { type: 'declareBlockers', blocks };
      }
      case 'respond':
        return this.respond(view, legal);
      case 'hauntlinkWindow':
        return chooseHauntlinkWindow(view, this.db, legal) ?? { type: 'passResponse' };
      case 'endStepWindow':
        return this.endStep(view, legal);
      case 'chooseTarget':
        if (view.awaiting.decision === 'sacrifice') return chooseSacrifice(view, this.db, legal);
        return chooseTargetAction(view, this.db, legal);
      default:
        return legal[0];
    }
  }

  // -------------------------------------------------------------------
  /**
   * Is a combat trick plausible? Open mana AND cards actually in hand AND
   * demonstrated capability: the opponent must have shown at least one
   * instant this game (public graveyard — honest information only).
   *
   * The evidence gate was added after the 2026-07-02 difficulty-gap
   * investigation: paying the +2/+2 phantom-trick tax on EVERY combat calc
   * against opponents who merely have untapped lands measurably loses more
   * than the occasional trick blowout it prevents. Measured (200 games/cell,
   * balance-matrix seed family): vs Easy on the creature-only starter pair
   * (Crimson/Wild) 61.0% -> 75.5%; head-to-head vs the old Medium the gated
   * version wins 54-55% even on trick-heavy deck pairs (TEST decks, Burning
   * Tides/Grave Harvest, Shadow Mandate/Burning Tides) and 59% on the
   * creature pair. A softer +1 early prior and a slower "N trickless
   * nonlands seen" decay were both measured and lost to this rule.
   */
  private trickBuff(view: PlayerView): number {
    const opp = opponentOf(view.myId);
    const open = view.battlefield.filter(
      (p) =>
        p.controller === opp &&
        !p.tapped &&
        (def(this.db, p.cardId).manaAbility?.length ?? 0) > 0,
    ).length;
    if (open < 2 || view.opp.handCount < 1) return 0;
    const shownInstant = view.opp.graveyard.some((c) =>
      isType(def(this.db, c), 'charm'),
    );
    return shownInstant ? 2 * this.pers.trickRespect : 0;
  }

  private landsIn(cards: readonly string[]): number {
    return cards.filter((c) => isType(def(this.db, c), 'land')).length;
  }

  private mulligan(view: PlayerView): Action {
    const hand = view.you.hand;
    const mulls = view.you.mulligans;
    if (mulls >= 2) return { type: 'keepHand' };
    // `mulliganShift` moves the keep thresholds (default 0).
    const shift = this.pers.mulliganShift;
    if (view.you.landReserve !== undefined) {
      // Reserve formats deal landless hands, so judge curve instead of lands:
      // keep when enough spells are castable by turn 3 off the public reserve.
      const early = hand.filter((c) => manaValue(def(this.db, c).cost) <= 3).length;
      return early >= (mulls === 0 ? 2 : 1) + shift ? { type: 'keepHand' } : { type: 'mulligan' };
    }
    const lands = this.landsIn(hand);
    if (mulls === 0) {
      return lands >= 2 + shift && lands <= 5 ? { type: 'keepHand' } : { type: 'mulligan' };
    }
    return lands >= 1 + shift && lands <= 5 ? { type: 'keepHand' } : { type: 'mulligan' };
  }

  /** Bottom/discard the least valuable cards (excess lands first when flooded). */
  private worstCards(view: PlayerView, legal: Action[]): Action {
    const hand = view.you.hand;
    const count =
      view.awaiting.kind === 'bottomCards' || view.awaiting.kind === 'discardToHandSize'
        ? view.awaiting.count
        : 1;
    const lands = this.landsIn(hand);
    const score = (c: string): number => {
      const d = def(this.db, c);
      if (isType(d, 'land')) return lands > hand.length - lands ? -5 : 5;
      return cardValue(this.db, c);
    };
    const indices = hand
      .map((c, i) => ({ i, s: score(c) }))
      .sort((x, y) => x.s - y.s)
      .slice(0, count)
      .map((e) => e.i)
      .sort((x, y) => x - y);
    const type = view.awaiting.kind === 'bottomCards' ? 'bottomCards' : 'discard';
    const match = legal.find(
      (l) =>
        l.type === type &&
        JSON.stringify((l as { handIndices: number[] }).handIndices) === JSON.stringify(indices),
    );
    return match ?? legal.find((l) => l.type === type) ?? legal[0];
  }

  // -------------------------------------------------------------------
  /**
   * Develop-cast preference: base card value plus personality biases. At
   * DEFAULT (subtypeBias 0, lifegainBias 0) this equals cardValue() exactly.
   */
  private developScore(cardId: string, view: PlayerView, cast: Cast): number {
    let v = cardValue(this.db, cardId, view, cast.type === 'castSpell' ? cast : {});
    if (this.pers.subtypeBias !== 0) {
      const subs = def(this.db, cardId).subtypes ?? [];
      if (subs.some((s) => this.pers.preferredSubtypes.includes(s))) v += this.pers.subtypeBias;
    }
    if (this.pers.lifegainBias !== 0 && this.gainsLife(cardId)) v += this.pers.lifegainBias;
    return v;
  }

  private cardIdFor(view: PlayerView, cast: Cast): string {
    if (cast.type === 'castDarling') return view.you.darlingZone ?? '';
    return (cast.retell || cast.whispers) && cast.graveIndex !== undefined
      ? view.you.graveyard[cast.graveIndex]
      : view.you.hand[cast.handIndex];
  }

  /** Empower competes with the best second develop cast its extra mana displaces. */
  private castScore(view: PlayerView, cast: Cast): number {
    const cardId = this.cardIdFor(view, cast);
    if (cast.type === 'castDarling') return this.developScore(cardId, view, cast);
    if (cast.hauntlinked) {
      const host = cast.targets?.[0];
      return host?.kind === 'permanent'
        ? hauntlinkCastValue(view.battlefield, this.db, cardId, host.iid)
        : -Infinity;
    }
    const value = cast.whispers
      ? whispersValue(this.db, cardId, view) + cardValue(this.db, cardId, view, cast) - cardValue(this.db, cardId)
      : cast.retell
      ? retellValue(this.db, cardId) + 0.01
      : this.developScore(cardId, view, cast) + (cast.x ?? 0) +
          (cast.empowered ? empowerValue(this.db, cardId) + 0.01 -
            empowerOpportunityCost(view, this.db, cast, (otherView, other) =>
              this.isDevelopable(otherView, other) ? this.castScore(otherView, other) : 0) : 0);
    // Printed value cannot see that Propagate and mark-all multiply by the
    // board; on an empty one they are the wrong card to lead with.
    return value + Math.max(0, this.markCastValue(view, cast)) + titheManaSaved(view, this.db, cast) + markBoardAdjust(view.battlefield, this.db, view.myId, cardId) -
      riteSacrificeValue(view, this.db, cast);
  }

  /** Does casting this card gain life (lifelink body or a gainLife op)? */
  private gainsLife(cardId: string): boolean {
    const d = def(this.db, cardId);
    if ((d.keywords ?? []).includes('bloodoath')) return true;
    return (d.abilities ?? []).some((ab) =>
      (ab.ops ?? []).some((o) => o.op === 'gainLife'),
    );
  }

  private opBodies(cardId: string): EffectOp[] {
    return (def(this.db, cardId).abilities ?? [])
      .filter((ab) => ab.when === 'spell')
      .flatMap((ab) => ab.ops ?? []);
  }

  private isRemoval(cardId: string, cast: Cast): ReturnType<typeof removalKind> {
    return removalKind(this.db, cardId, cast.type === 'castSpell' ? cast : {});
  }

  private castOps(view: PlayerView, cast: Cast): EffectOp[] {
    return this.castEffects(view, cast).map(({ op }) => op);
  }

  private castEffects(view: PlayerView, cast: Cast) {
    return boundCastEffects(view, this.db, this.cardIdFor(view, cast), cast.type === 'castSpell' ? cast : {});
  }

  private faceDamage(view: PlayerView, cast: Cast): number {
    return faceDamageForCast(view, this.db, this.cardIdFor(view, cast), cast.type === 'castSpell' ? cast : {});
  }

  private manaForCast(view: PlayerView, cast: Cast): number {
    const d = def(this.db, this.cardIdFor(view, cast));
    if (cast.type === 'castDarling') return manaValue(d.cost) + (view.you.darlingTax ?? 0);
    return manaValue(castCost(d, !!cast.empowered, !!cast.retell, !!cast.hauntlinked, { whispers: cast.whispers })) +
      (cast.x ?? 0) - titheManaSaved(view, this.db, cast);
  }

  private removalCastValue(view: PlayerView, cast: Cast, target?: Permanent): number {
    return removalValueForCast(view.battlefield, this.db, view.myId, this.cardIdFor(view, cast), target,
      cast.type === 'castSpell' ? cast : {}, view);
  }

  private targetPerm(view: PlayerView, ref: TargetRef | undefined): Permanent | undefined {
    if (!ref || ref.kind !== 'permanent') return undefined;
    return view.battlefield.find((p) => p.iid === ref.iid);
  }

  /** Bound damage/stat changes may combine only on the same public target. */
  private removedTargets(view: PlayerView, cast: Cast): Permanent[] {
    const kind = this.isRemoval(this.cardIdFor(view, cast), cast);
    if (!kind || kind === 'massDestroy') return [];
    const effects = this.castEffects(view, cast);
    return view.battlefield.filter((perm) => {
      if (perm.controller === view.myId) return false;
      const ops = effects.filter(({ targets }) => targets.some((ref) => ref.kind === 'permanent' && ref.iid === perm.iid))
        .map(({ op }) => op);
      if (ops.some((op) => op.op === 'destroy' || op.op === 'sever' || op.op === 'recall' ||
        op.op === 'destroyArtifactOrSeverEnchantment')) return this.removalCastValue(view, cast, perm) > 0;
      if (ops.some((op) => op.op === 'removeMarks') && perm.plusOneCounters > 0) return true;
      if (!isType(def(this.db, perm.cardId), 'creature')) return false;
      const remaining = getEffectiveStats(view.battlefield, this.db, perm.iid).defense - perm.damage;
      const damage = ops.reduce((sum, op) => sum + (op.op === 'damage' && op.to === 'target'
        ? op.n === 'X' ? cast.x ?? 0 : op.n : op.op === 'boost' && op.scope === 'target' ? -op.t : 0), 0);
      return damage > 0 && damage >= remaining;
    });
  }

  private removalKills(view: PlayerView, cast: Cast): boolean {
    return this.removedTargets(view, cast).length > 0;
  }

  private removalWorth(view: PlayerView, cast: Cast): number {
    return this.removedTargets(view, cast).reduce((sum, perm) => {
      const d = def(this.db, perm.cardId);
      return sum + (isType(d, 'artifact') || isType(d, 'enchantment') ||
        this.isRemoval(this.cardIdFor(view, cast), cast) === 'removeMarks'
        ? this.removalCastValue(view, cast, perm) : permValue(view.battlefield, this.db, perm.iid));
    }, 0);
  }

  /** Permanent marks go on bodies that survive, using the shared target scorer. */
  private markCastValue(view: PlayerView, cast: Cast): number {
    let value = 0;
    for (const { op, targets } of this.castEffects(view, cast)) {
      if (op.op === 'addCounters' && op.to === 'target') {
        for (const ref of targets) {
          const p = this.targetPerm(view, ref);
          if (!p || p.controller !== view.myId || op.n <= 0 ||
            getEffectiveStats(view.battlefield, this.db, p.iid).defense + op.n <= p.damage) return -Infinity;
          value += targetValueForAbility(view, this.db, undefined, { ops: [op] }, ref);
        }
      } else if (op.op === 'moveMark') {
        const refs = (cast.targets ?? []).filter((ref) => ref.kind === 'permanent');
        const from = this.targetPerm(view, refs[0]);
        const to = this.targetPerm(view, refs[1]);
        if (!from || !to || from.iid === to.iid || from.controller !== view.myId || to.controller !== view.myId ||
          from.plusOneCounters < 1) return -Infinity;
        const moved = view.battlefield.map((p) => p.iid === from.iid ? { ...p, plusOneCounters: p.plusOneCounters - 1 } :
          p.iid === to.iid ? { ...p, plusOneCounters: p.plusOneCounters + 1 } : p);
        if ([from, to].some((p) => getEffectiveStats(moved, this.db, p.iid).defense <= p.damage)) return -Infinity;
        const mark: EffectOp = { op: 'addCounters', n: 1, to: 'target' };
        value += targetValueForAbility(view, this.db, undefined, { ops: [mark] }, refs[1]) -
          targetValueForAbility(view, this.db, undefined, { ops: [mark] }, refs[0]);
        value += markedBoardValue(moved, this.db, view.myId, view.you.hand) -
          markedBoardValue(view.battlefield, this.db, view.myId, view.you.hand);
      }
    }
    return value;
  }

  private combatPrediction(view: PlayerView, battlefield = view.battlefield): ReturnType<typeof combatForecast> | undefined {
    if (!view.combat || view.fogThisTurn) return undefined;
    const protectedIds = new Set<number>();
    for (const item of this.pendingSpells(view)) {
      for (const { op, targets } of boundCastEffects({ ...view, myId: item.controller }, this.db, item.cardId, item)) {
        if (op.op === 'preventCombat') return { damage: 0, dying: [] };
        if (op.op === 'preventCombatTo') for (const ref of targets) {
          if (ref.kind === 'permanent') protectedIds.add(ref.iid);
        }
      }
    }
    if (protectedIds.size > 0) battlefield = battlefield.map((p) => protectedIds.has(p.iid)
      ? { ...p, combatDamagePrevented: true } : p);
    const defender = opponentOf(view.activePlayer);
    const blocks = view.combat.phase === 'attackersDeclared'
      ? chooseBlocks(battlefield, this.db, defender, defender === view.myId ? view.you.life : view.opp.life,
        view.combat, this.trickBuff(view), defender === view.myId ? this.pers : DEFAULT_PERSONALITY)
      : view.combat.blocks;
    return combatForecast(battlefield, this.db, { ...view.combat, blocks });
  }

  /** Public stack, top first; canceled spells do not supply future protection. */
  private pendingSpells(view: PlayerView) {
    const canceled = new Set<number>();
    return [...view.stack].reverse().filter((item) => {
      if (canceled.has(item.sid)) return false;
      for (const { op, targets } of boundCastEffects({ ...view, myId: item.controller }, this.db, item.cardId, item)) {
        if (op.op === 'cancel') for (const ref of targets) if (ref.kind === 'stackItem') canceled.add(ref.sid);
      }
      return true;
    });
  }

  /** Fog buys a life-critical turn or keeps a valuable blocked body alive. */
  private fogForCombat(view: PlayerView, casts: SpellCast[]): SpellCast | undefined {
    const before = this.combatPrediction(view);
    if (!before || !view.combat || view.combat.damagePrevented) return undefined;
    const mine = view.battlefield.filter((p) => p.controller === view.myId && isType(def(this.db, p.cardId), 'creature'));
    const bestValue = Math.max(0, ...mine.map((p) => permValue(view.battlefield, this.db, p.iid)));
    for (const cast of casts) {
      const ops = this.castOps(view, cast);
      const global = ops.some((op) => op.op === 'preventCombat');
      const saved = new Set(this.castEffects(view, cast).flatMap(({ op, targets }) => op.op === 'preventCombatTo'
        ? targets.flatMap((ref) => ref.kind === 'permanent' ? [ref.iid] : []) : []));
      if (!global && saved.size === 0) continue;
      if (global && view.activePlayer !== view.myId && before.damage > 0 &&
        (before.damage >= view.you.life || view.you.life - before.damage < LIFE_CURVE_KNEE)) return cast;
      const important = mine.some((p) => before.dying.includes(p.iid) && (global || saved.has(p.iid)) &&
        permValue(view.battlefield, this.db, p.iid) >= Math.max(4, bestValue) &&
        permValue(view.battlefield, this.db, p.iid) > this.manaForCast(view, cast) + 1.2);
      // Do not fog away our own winning combat to rescue a replaceable body.
      if (important && (!global || view.activePlayer !== view.myId || before.damage < view.opp.life)) return cast;
    }
    return undefined;
  }

  /** Tap only before declaration: tapping an attacker never removes it. */
  private tapBeforeCombat(view: PlayerView, casts: Cast[]): Cast | undefined {
    if (view.step !== 'main1' || view.combat || view.fogThisTurn) return undefined;
    const ownTurn = view.activePlayer === view.myId;
    const attacker = view.activePlayer;
    const defender = opponentOf(attacker);
    const attackLife = ownTurn ? view.you.life : view.opp.life;
    const defendLife = ownTurn ? view.opp.life : view.you.life;
    const plan = (bf: Permanent[]) => chooseAttackers(bf, this.db, attacker, defendLife,
      ownTurn ? this.trickBuff(view) : 0, attackLife, ownTurn ? this.pers : DEFAULT_PERSONALITY);
    const forecast = (bf: Permanent[], attackers: number[]) => combatForecast(bf, this.db, {
      attackers, blocks: chooseBlocks(bf, this.db, defender, defendLife,
        { attackers, blocks: [], phase: 'attackersDeclared', damagePrevented: false }, 0,
        ownTurn ? DEFAULT_PERSONALITY : this.pers), phase: 'blockersDeclared', damagePrevented: false,
    });
    const beforePlan = plan(view.battlefield);
    const before = forecast(view.battlefield, beforePlan);
    const eligible = eligibleAttackers(view.battlefield, this.db, attacker);
    const opponents = view.battlefield.filter((p) => p.controller !== view.myId && !p.tapped &&
      isType(def(this.db, p.cardId), 'creature') && (ownTurn
        ? eligible.some((iid) => canBlock(view.battlefield, this.db, defender, p.iid, iid)) : beforePlan.includes(p.iid)));
    if (opponents.length === 0) return undefined;
    const legalTapIds = new Set(casts.flatMap((cast) => this.castEffects(view, cast).flatMap(({ op, targets }) =>
      op.op === 'tap' ? targets.flatMap((ref) => ref.kind === 'permanent' ? [ref.iid] : []) : [])));
    const tappable = opponents.filter((p) => legalTapIds.has(p.iid));
    const best = tappable.sort((a, b) => permValue(view.battlefield, this.db, b.iid) - permValue(view.battlefield, this.db, a.iid))[0];
    const loss = (result: ReturnType<typeof combatForecast>) => result.damage + result.dying.reduce((sum, iid) => {
      const p = view.battlefield.find((body) => body.iid === iid);
      return sum + (p?.controller === view.myId ? permValue(view.battlefield, this.db, iid) : -permValue(view.battlefield, this.db, iid));
    }, 0);
    for (const cast of casts) {
      const ops = this.castOps(view, cast);
      const all = ops.some((op) => op.op === 'tapAll');
      const targets = new Set(this.castEffects(view, cast).flatMap(({ op, targets: refs }) => op.op === 'tap'
        ? refs.flatMap((ref) => ref.kind === 'permanent' ? [ref.iid] : []) : []));
      if (view.battlefield.some((p) => p.controller === view.myId && targets.has(p.iid))) continue;
      if (!all && !opponents.some((p) => targets.has(p.iid))) continue;
      const projected = view.battlefield.map((p) => p.controller !== view.myId &&
        (all && isType(def(this.db, p.cardId), 'creature') || targets.has(p.iid)) ? { ...p, tapped: true } : p);
      const afterPlan = plan(projected);
      const after = forecast(projected, afterPlan);
      if (ownTurn) {
        const lethal = after.damage >= view.opp.life && before.damage < view.opp.life;
        if (lethal) return cast;
        if (all || !best || !targets.has(best.iid)) continue;
        const gain = scoreAttack(projected, this.db, attacker, defendLife, this.trickBuff(view), afterPlan, attackLife, this.pers) -
          scoreAttack(view.battlefield, this.db, attacker, defendLife, this.trickBuff(view), beforePlan, attackLife, this.pers);
        if (gain > Math.max(1.5, this.manaForCast(view, cast) * 0.8)) return cast;
      } else if (!all && best && targets.has(best.iid) &&
        loss(before) - loss(after) > Math.max(1, this.manaForCast(view, cast) * 0.8)) return cast;
    }
    return undefined;
  }

  /** A negative boost is a fight-flipping trick when it cannot kill outright. */
  private debuffForCombat(view: PlayerView, casts: SpellCast[]): SpellCast | undefined {
    if (!view.combat || view.combat.phase === 'attackersDeclared') return undefined;
    const before = this.combatPrediction(view);
    if (!before) return undefined;
    for (const cast of casts) {
      let projected = view.battlefield;
      for (const { op, targets: refs } of this.castEffects(view, cast)) {
        if (op.op !== 'boost' || op.scope !== 'target' || op.p + op.t > 0) continue;
        projected = projected.map((p) => p.controller !== view.myId && refs.some((ref) => ref.kind === 'permanent' && ref.iid === p.iid)
          ? { ...p, untilEotMods: [...p.untilEotMods, { p: op.p, t: op.t, keywords: op.keywords ?? [] }] } : p);
      }
      if (projected === view.battlefield) continue;
      const after = this.combatPrediction(view, projected)!;
      const saves = before.dying.some((iid) => !after.dying.includes(iid) && this.targetPerm(view, { kind: 'permanent', iid })?.controller === view.myId);
      const wins = after.dying.some((iid) => !before.dying.includes(iid) && this.targetPerm(view, { kind: 'permanent', iid })?.controller !== view.myId);
      if (saves || wins) return cast;
    }
    return undefined;
  }

  private bounceToSave(view: PlayerView, casts: SpellCast[]): SpellCast | undefined {
    const combat = this.combatPrediction(view);
    for (const cast of casts) {
      for (const { op, targets } of this.castEffects(view, cast)) {
        if (op.op !== 'recall') continue;
        for (const ref of targets) {
          const p = this.targetPerm(view, ref);
          if (!p || p.controller !== view.myId || p.owner !== view.myId || !isType(def(this.db, p.cardId), 'creature') ||
            def(this.db, p.cardId).token) continue;
          const stats = getEffectiveStats(view.battlefield, this.db, p.iid);
          const threatened = this.pendingSpells(view).some((item) => {
            if (item.controller === view.myId) return false;
            const ops = boundCastEffects({ ...view, myId: item.controller }, this.db, item.cardId, item)
              .filter(({ targets: refs }) => refs.some((target) => target.kind === 'permanent' && target.iid === p.iid))
              .map(({ op: effect }) => effect);
            return ops.some((effect) => effect.op === 'destroy' || effect.op === 'sever') ||
              ops.reduce((sum, effect) => sum + (effect.op === 'damage' && effect.to === 'target'
                ? effect.n === 'X' ? item.x ?? 0 : effect.n :
                effect.op === 'boost' && effect.scope === 'target' ? -effect.t : 0), 0) >= stats.defense - p.damage;
          });
          if (!threatened && !combat?.dying.includes(p.iid)) continue;
          const tempo = this.manaForCast(view, cast) + manaValue(def(this.db, p.cardId).cost) * 0.5 + 1.2;
          if (permValue(view.battlefield, this.db, p.iid) > tempo) return cast;
        }
      }
    }
    return undefined;
  }
  /** Shared with Hard's candidate search; Easy deliberately never holds mana. */
  constrainMainMana(view: PlayerView, legal: Action[]): Action[] {
    const paidDuty = legal.some((a) => a.type === 'activate' &&
      manaValue(actionManaCost(view, this.db, a)) > 0);
    const hasCharm = view.you.hand.some((id) => isType(def(this.db, id), 'charm'));
    if (!paidDuty && !hasCharm) return legal;
    const held = hasCharm ? this.liveCharm(view, legal) : undefined;
    const keep = (action: Action, cost: ManaCost): Action | undefined => {
      if (action.type !== 'activate' && action.type !== 'castSpell' && action.type !== 'castDarling') return action;
      const plan = manaPlanKeeping(view, this.db, action, cost);
      if (plan === null) return undefined;
      const payment = actionManaCost(view, this.db, action);
      const ordinary = action.manaPlan ?? (payment && solveMana(view, this.db, view.myId, payment));
      return JSON.stringify(plan) === JSON.stringify(ordinary) ? action : { ...action, manaPlan: plan };
    };
    const heldMenu = held ? legal.flatMap((action) => {
      const duty = action.type === 'activate' && manaValue(actionManaCost(view, this.db, action)) > 0;
      const marginal = (action.type === 'castSpell' || action.type === 'castDarling') &&
        !(action.type === 'castSpell' && !action.retell && !action.whispers && action.handIndex === held.handIndex) &&
        this.isDevelopable(view, action) && this.castScore(view, action) < held.value;
      if (!duty && !marginal) return [action];
      const payable = keep(action, held.cost);
      return payable ? [payable] : [];
    }) : legal;
    if (!paidDuty || view.step !== 'main2') return heldMenu;
    const develop = heldMenu.filter((a): a is Cast =>
      (a.type === 'castSpell' || a.type === 'castDarling') && this.isDevelopable(view, a))
      .sort((a, b) => this.castScore(view, b) - this.castScore(view, a))[0];
    if (!develop) return heldMenu;
    const cost = actionManaCost(view, this.db, develop);
    if (!cost) return heldMenu;
    const developIsHeld = held && develop.type === 'castSpell' && !develop.retell && !develop.whispers &&
      develop.handIndex === held.handIndex;
    const reserved = held && !developIsHeld ? combineManaCosts(cost, held.cost) : cost;
    // A tap-only Duty retains its old place. Paid Duties use only mana the
    // best develop cast does not need; the live menu is reconsidered next action.
    return heldMenu.flatMap((action) => {
      if (action.type !== 'activate' || manaValue(actionManaCost(view, this.db, action)) === 0) return [action];
      const payable = keep(action, reserved);
      return payable ? [payable] : [];
    });
  }

  /** A reserve requires a rule that can use the opponent's public position.
   * Counter readiness uses public mana capacity and a nonempty hidden hand,
   * never an assumption about which card the opponent holds. Other tricks use
   * the same response rules against a projected next-turn combat. */
  private liveCharm(view: PlayerView, legal: Action[]): { cost: ManaCost; value: number; handIndex: number } | undefined {
    let best: { cost: ManaCost; value: number; handIndex: number } | undefined;
    let cleaned: PlayerView | undefined;
    const afterCleanup = (): PlayerView => cleaned ??= { ...view, fogThisTurn: false, combat: null,
      battlefield: view.battlefield.map((p) => ({ ...p, untilEotMods: [], damage: 0,
        deathtouched: false, severBranded: false, combatDamagePrevented: undefined })) };
    let future: PlayerView | undefined;
    const futureCombat = (): PlayerView => {
      if (future) return future;
      const opp = opponentOf(view.myId);
      const battlefield = afterCleanup().battlefield.map((p) => ({
        ...p,
        ...(p.controller === opp ? { tapped: false, enteredThisTurn: false } : {}),
      }));
      const attackers = chooseAttackers(battlefield, this.db, opp, view.you.life, 0, view.opp.life);
      const combat = { attackers, blocks: [], phase: 'attackersDeclared' as const, damagePrevented: false };
      const blocks = chooseBlocks(battlefield, this.db, view.myId, view.you.life, combat, 0, this.pers);
      future = { ...view, battlefield, activePlayer: opp, step: 'combat', stack: [], fogThisTurn: false,
        combat: { ...combat, blocks, phase: 'blockersDeclared' },
        awaiting: { kind: 'respond', player: view.myId, over: { type: 'blockers' } } };
      return future;
    };
    for (const [handIndex, id] of view.you.hand.entries()) {
      const d = def(this.db, id);
      if (!isType(d, 'charm') || !d.cost || solveMana(view, this.db, view.myId, d.cost) === null) continue;
      const effects = boundCastEffects(view, this.db, id);
      let value = 0;
      let reserveCost = d.cost;
      const offer = (worth: number, cost: ManaCost | undefined): void => {
        if (cost && (worth > value || worth === value && manaValue(cost) < manaValue(reserveCost))) {
          value = worth;
          reserveCost = cost;
        }
      };
      if (effects.some(({ op }) => op.op === 'cancel') && view.opp.handCount > 0) {
        const capacity = view.battlefield.filter((p) => p.controller !== view.myId &&
          (this.db[p.cardId]?.manaAbility?.length ?? 0) > 0).length;
        if (capacity >= this.pers.counterFloor) {
          // A counter may also require public creature or graveyard targets.
          // Only the future spell slot is hypothetical; all other slots must
          // already be satisfiable, including moveMark's distinct hosts.
          const specs = castTargetSpecsFor(d, false).filter((spec) => spec.what !== 'spell');
          const context = specs.length > 0 ? determinize(view, this.db).instanceState : undefined;
          const targets = specs.map((spec) => enumerateTargets(context!, this.db, view.myId, spec));
          const hasTargets = targets.every((refs, i) => specs[i].upTo !== undefined ||
            refs.length >= (specs[i].exactly ?? 1));
          const canMove = !effects.some(({ op }) => op.op === 'moveMark') ||
            targets.length === 2 && targets[0].some((a) => a.kind === 'permanent' &&
              targets[1].some((b) => b.kind === 'permanent' && b.iid !== a.iid));
          const minimum = { generic: d.cost.generic + (d.x?.min ?? 0), pips: d.cost.pips };
          if (hasTargets && canMove && solveMana(view, this.db, view.myId, minimum) !== null) {
            offer(this.pers.counterFloor, minimum);
          }
        }
      }
      const casts = legal.filter((a): a is SpellCast => a.type === 'castSpell' &&
        a.handIndex === handIndex && !a.empowered && !a.retell && !a.whispers);
      for (const cast of casts) {
        // Only the nonactive player gets the Sunset response. Damage and
        // temporary stats clear before our held removal's next-turn window.
        const kind = this.isRemoval(id, cast);
        const worth = kind === 'massDestroy' || kind === 'destroyNewest'
          ? this.removalCastValue(afterCleanup(), cast) : this.removalWorth(afterCleanup(), cast);
        if (worth >= 3.5 + this.pers.removalBias) offer(worth, actionManaCost(view, this.db, cast));
      }
      if (casts.some((cast) => this.castEffects(view, cast).some(({ op }) => op.op === 'boost' || op.op === 'preventCombat' ||
        op.op === 'preventCombatTo' || op.op === 'addCounters' || op.op === 'moveMark' ||
        op.op === 'recall' || op.op === 'tap' || op.op === 'tapAll'))) {
        const projected = futureCombat();
        const choices = [this.respond(projected, [...casts, { type: 'passResponse' }]),
          // Tapping has its own pre-declaration rule; a blocker-window
          // forecast cannot establish its value after attackers are tapped.
          this.tapBeforeCombat({ ...projected, step: 'main1', combat: null }, casts)];
        for (const choice of choices) {
          if (choice?.type !== 'castSpell' || projected.combat!.attackers.length === 0) continue;
          const bodies = (choice.targets ?? []).flatMap((ref) => ref.kind === 'permanent'
            ? [permValue(view.battlefield, this.db, ref.iid)] : []);
          const forecast = combatForecast(projected.battlefield, this.db, projected.combat!);
          offer(Math.max(0, ...bodies, Math.min(forecast.damage, view.you.life)), actionManaCost(view, this.db, choice));
        }
      }
      if (value > 0 && (!best || value > best.value)) best = { cost: reserveCost, value, handIndex };
    }
    return best;
  }

  private isDevelopable(view: PlayerView, c: Cast): boolean {
    const cardId = this.cardIdFor(view, c);
    const d = def(this.db, cardId);
    const ops = this.castOps(view, c);
    if (ops.some((op) => op.op === 'preventCombat' || op.op === 'preventCombatTo' ||
      op.op === 'tap' || op.op === 'tapAll')) return false;
    if (this.isRemoval(cardId, c)) return false;
    if (ops.some((op) => op.op === 'addCounters' && op.to === 'target' || op.op === 'moveMark')) {
      return this.markCastValue(view, c) > 0;
    }
    if (isType(d, 'charm') && !(c.type === 'castSpell' && c.whispers &&
      (c.targets?.length ?? 0) === 0)) return false;
    if (d.subtypes.includes('Aura')) {
      const perm = this.targetPerm(view, c.targets?.[0]);
      const st = (d.abilities ?? []).find((ab) => ab.static)?.static;
      return perm !== undefined && ((st?.p ?? 0) < 0
        ? perm.controller !== view.myId : perm.controller === view.myId);
    }
    return true;
  }

  private main(view: PlayerView, legal: Action[]): Action {
    const paydown = chooseDarlingPaydown(view, legal);
    if (paydown) return paydown;
    const reserveLand = chooseReserveLand(view, this.db, legal);
    if (reserveLand) return reserveLand;
    const land = legal.find((l) => l.type === 'playLand');
    if (land) return land;
    const link = chooseUnlinkedHauntlink(view, this.db, legal);
    if (link) return link;

    const casts = legal.filter((l): l is Cast => l.type === 'castSpell' || l.type === 'castDarling');
    const skims = legal.filter((l) => l.type === 'skim');
    const preserve = choosePreserve(
      view,
      this.db,
      legal,
      (cast) => this.castScore(view, cast),
    );
    if (casts.length === 0 && preserve) return preserve;
    const activate = chooseActivate(view, this.db, legal);
    if (casts.length === 0 && activate) return activate;
    // Smoothing gate: only spend a Skim when no cast line, including Retell,
    // exists.
    if (casts.length === 0 && view.you.deckCount > 0) {
      if (skims.length > 0) {
        return skims.reduce((best, skim) =>
          skimValue(this.db, view.you.hand[skim.handIndex]) >
            skimValue(this.db, view.you.hand[best.handIndex])
            ? skim
            : best,
        );
      }
    }
    if (casts.length > 0) {
      // 1. One spell's combined face damage, at its actual legal cast cost.
      const lethal = casts.filter((c) => this.faceDamage(view, c) >= view.opp.life)
        .sort((a, b) => this.manaForCast(view, a) - this.manaForCast(view, b))[0];
      if (lethal) return lethal;

      // 2. Removal on the opponent's best creature when it's worth the card
      const removals = casts.filter((c) => {
        return this.removalKills(view, c);
      });
      if (removals.length > 0) {
        const best = removals.reduce((a, b) =>
          this.removalWorth(view, a) >= this.removalWorth(view, b)
            ? a
            : b,
        );
        const worth = this.removalWorth(view, best);
        const cost = this.manaForCast(view, best);
        if (worth >= cost * 0.8 && worth >= 2.5 + this.pers.removalBias) return best;
      }

      // Targetless removal still needs a public opposing permanent. In
      // particular, do not cast an all-enchantments sweep with no target.
      const globalRemovals = casts.filter((c) => {
        const cardId = this.cardIdFor(view, c);
        const kind = this.isRemoval(cardId, c);
        return (
          (kind === 'massDestroy' || kind === 'destroyNewest') &&
          this.removalCastValue(view, c) > 0
        );
      });
      if (globalRemovals.length > 0) {
        const best = globalRemovals.reduce((a, b) =>
          this.removalCastValue(view, a) >= this.removalCastValue(view, b)
            ? a
            : b,
        );
        const worth = this.removalCastValue(view, best);
        const cost = this.manaForCast(view, best);
        if (worth >= cost * 0.8 && worth >= 2.5 + this.pers.removalBias) return best;
      }

      // 2b. Burn as reach: send damage at the face once they're in range.
      if (view.opp.life <= this.pers.burnFaceLife) {
        const burns = casts.filter((c) => this.faceDamage(view, c) > 0);
        if (burns.length > 0) {
          return burns.sort((a, b) => this.faceDamage(view, b) - this.faceDamage(view, a) ||
            this.manaForCast(view, a) - this.manaForCast(view, b))[0];
        }
      }

      const tap = this.tapBeforeCombat(view, casts);
      if (tap) return tap;

      if (preserve) return preserve;
      if (activate) return activate;

      // 3. Develop: cast the highest-value creature / permanent. Creatures
      //    without haste in main1 wait for main2 only if we plan to attack;
      //    keeping it simple: cast in whichever main we're in.
      const developable = casts.filter((c) => this.isDevelopable(view, c));
      if (developable.length > 0) {
        const best = developable.reduce((a, b) =>
          this.castScore(view, a) >= this.castScore(view, b)
            ? a
            : b,
        );
        return best;
      }
    }
    return legal.find((l) => l.type === 'passStep') ?? legal[0];
  }

  // -------------------------------------------------------------------
  private respond(view: PlayerView, legal: Action[]): Action {
    const pass = legal.find((l) => l.type === 'passResponse')!;
    const casts = legal.filter((l): l is SpellCast => l.type === 'castSpell');
    if (casts.length === 0) return pass;
    const opp = opponentOf(view.myId);

    // 1. Counter a big enemy spell (mv ≥ 4) or anything targeting my best creature.
    const top = view.stack.at(-1);
    if (top && top.controller === opp) {
      const counter = casts.find((c) => c.targets?.[0]?.kind === 'stackItem');
      if (counter) {
        const topDef = def(this.db, top.cardId);
        const threatens =
          manaValue(topDef.cost) + (top.x ?? 0) >= this.pers.counterFloor ||
          top.targets.some(
            (t) =>
              t.kind === 'permanent' &&
              this.targetPerm(view, t)?.controller === view.myId &&
              permValue(view.battlefield, this.db, t.iid) >= 4,
          ) ||
          this.opBodies(top.cardId).some((o) => o.op === 'massDestroy');
        if (threatens) {
          // Keep every target from the legal menu. Some counter-spells also
          // carry creature targets (for example Quiet Orbit moves a Mark),
          // so replacing the whole list would construct an illegal action.
          const targets = counter.targets?.map((target) =>
            target.kind === 'stackItem' ? { ...target, sid: top.sid } : target,
          );
          return { ...counter, ...(targets ? { targets } : {}) };
        }
      }
    }

    const rescue = this.bounceToSave(view, casts);
    if (rescue) return rescue;
    const fog = this.fogForCombat(view, casts);
    if (fog) return fog;
    const tap = this.tapBeforeCombat(view, casts);
    if (tap) return tap;
    const debuff = this.debuffForCombat(view, casts);
    if (debuff) return debuff;

    // 2. Removal on an attacker that would otherwise hurt (≥ 3 damage or big value).
    if (view.combat && view.combat.attackers.length > 0 && view.activePlayer === opp) {
      const removals = casts.filter((c) => {
        return this.removedTargets(view, c).some((perm) => view.combat!.attackers.includes(perm.iid));
      });
      if (removals.length > 0) {
        const best = removals.reduce((a, b) =>
          this.removalWorth(view, a) >= this.removalWorth(view, b)
            ? a
            : b,
        );
        const v = this.removalWorth(view, best);
        if (v >= 3.5 + this.pers.removalBias) return best;
      }
    }

    const globalRemovals = casts.filter((c) => {
      const cardId = this.cardIdFor(view, c);
      const kind = this.isRemoval(cardId, c);
      return (
        (kind === 'massDestroy' || kind === 'destroyNewest') &&
        this.removalCastValue(view, c) > 0
      );
    });
    if (globalRemovals.length > 0) {
      const best = globalRemovals.reduce((a, b) =>
        this.removalCastValue(view, a) >=
        this.removalCastValue(view, b)
          ? a
          : b,
      );
      if (
        this.removalCastValue(view, best) >=
        3.5 + this.pers.removalBias
      )
        return best;
    }

    // 3. Pump my creature when it helps combat.
    if (view.combat) {
      for (const c of casts) {
        const perm = this.targetPerm(view, c.targets?.[0]);
        if (!perm || perm.controller !== view.myId) continue;
        const ops = this.castOps(view, c);
        if (ops.some((op) => op.op === 'preventCombat' || op.op === 'preventCombatTo')) continue;
        const pump = ops.find((o) => o.op === 'boost');
        if (!pump || pump.op !== 'boost') continue;
        // A negative net boost is a debuff/removal effect, not a combat pump.
        // Never aim that class of spell at our own creature.
        if (pump.p + pump.t <= 0) continue;
        const isAttacker = view.combat.attackers.includes(perm.iid);
        const inBlocks = view.combat.blocks.some(
          (b) => b.blocker === perm.iid || b.attacker === perm.iid,
        );
        // 3a. Unblocked attacker after blocks: pump = free extra damage.
        if (
          isAttacker &&
          view.combat.phase === 'blockersDeclared' &&
          !view.combat.blocks.some((b) => b.attacker === perm.iid) &&
          view.activePlayer === view.myId
        ) {
          return c;
        }
        if (!inBlocks) continue;
        // 3b. Flip a losing fight (save it, win it, or both).
        // A reopened window (rules rev 2) arrives after the flush that earned
        // it resolved; that flush may have killed a combatant, leaving stale
        // iids in combat.blocks. Evaluate only foes still on the battlefield.
        const foes = view.combat.blocks
          .filter((b) => b.blocker === perm.iid || b.attacker === perm.iid)
          .map((b) => (b.blocker === perm.iid ? b.attacker : b.blocker))
          .filter((iid) => view.battlefield.some((p) => p.iid === iid));
        for (const foe of foes) {
          const mine = getEffectiveStats(view.battlefield, this.db, perm.iid);
          const theirs = getEffectiveStats(view.battlefield, this.db, foe);
          const dieNow = theirs.attack >= mine.defense - perm.damage;
          const surviveAfter = theirs.attack < mine.defense - perm.damage + pump.t;
          const killNow = mine.attack >= theirs.defense;
          const killAfter = mine.attack + pump.p >= theirs.defense;
          if ((dieNow && surviveAfter) || (!killNow && killAfter && !dieNow)) return c;
          if (dieNow && surviveAfter && killAfter) return c;
        }
      }
    }
    return this.whispersFreebie(view, casts) ?? pass;
  }

  /** Spend useful targetless Whispers in any response window before expiry. */
  private whispersFreebie(view: PlayerView, casts: SpellCast[]): SpellCast | undefined {
    return casts.filter((cast) => cast.whispers && (cast.targets?.length ?? 0) === 0 &&
      this.isRemoval(this.cardIdFor(view, cast), cast) === null &&
      !this.castOps(view, cast).some((op) => op.op === 'preventCombat' || op.op === 'preventCombatTo' || op.op === 'tap' || op.op === 'tapAll'))
      .sort((a, b) => this.castScore(view, b) - this.castScore(view, a))[0];
  }

  /** End of the opponent's turn: spend spare removal / value instants freely. */
  private endStep(view: PlayerView, legal: Action[]): Action {
    const pass = legal.find((l) => l.type === 'passResponse')!;
    const casts = legal.filter((l): l is SpellCast => l.type === 'castSpell');
    const reach = casts.filter((cast) => this.faceDamage(view, cast) >= view.opp.life ||
      view.opp.life <= this.pers.burnFaceLife && this.faceDamage(view, cast) > 0)
      .sort((a, b) => this.faceDamage(view, b) - this.faceDamage(view, a))[0];
    if (reach) return reach;
    const removals = casts.filter((c) => {
      return this.removalKills(view, c);
    });
    if (removals.length > 0) {
      const best = removals.reduce((a, b) =>
        this.removalWorth(view, a) >= this.removalWorth(view, b)
          ? a
          : b,
      );
      if (
        this.removalWorth(view, best) >=
        3.5 + this.pers.removalBias
      )
        return best;
    }
    const globalRemovals = casts.filter((c) => {
      const cardId = this.cardIdFor(view, c);
      const kind = this.isRemoval(cardId, c);
      return (
        (kind === 'massDestroy' || kind === 'destroyNewest') &&
        this.removalCastValue(view, c) > 0
      );
    });
    if (globalRemovals.length > 0) {
      const best = globalRemovals.reduce((a, b) =>
        this.removalCastValue(view, a) >=
        this.removalCastValue(view, b)
          ? a
          : b,
      );
      if (
        this.removalCastValue(view, best) >=
        3.5 + this.pers.removalBias
      )
        return best;
    }
    // free value instants with no targets (card draw etc.)
    const freebie = casts.find((c) => {
      const d = def(this.db, this.cardIdFor(view, c));
      return (
        (!c.targets || c.targets.length === 0) &&
        this.castOps(view, c).some((o) => o.op === 'draw') &&
        !this.castOps(view, c).some((o) => o.op === 'preventCombat' || o.op === 'preventCombatTo' || o.op === 'tapAll') &&
        isType(d, 'charm')
      );
    });
    const mark = casts.filter((c) => !this.isRemoval(this.cardIdFor(view, c), c) && this.markCastValue(view, c) > 0)
      .sort((a, b) => this.castScore(view, b) - this.castScore(view, a))[0];
    return freebie ?? mark ?? this.whispersFreebie(view, casts) ?? pass;
  }
}
