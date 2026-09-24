import { RULES } from '../../config/rules';
import type { Emit } from '../battlefield';
import {
  destroyPermanent,
  firesDiesForDestroy,
  enterBattlefield,
  recallPermanent,
  severPermanent,
} from '../battlefield';
import { anyPayableHauntlink } from '../hauntlinkWindow';
import { drawCards } from '../phases';
import { freshGraveyardCard } from '../graveyard';
import { rngInt } from '../rng';
import { getEffectiveStats, isQuestActive } from '../statics';
import { enumerateTargets, isLegalTarget } from './targeting';
import type {
  AbilityDef,
  CardDb,
  CardEntry,
  EffectOp,
  EffectContinuation,
  GameState,
  Permanent,
  PlayerId,
  TargetRef,
  TargetSpec,
  TriggerWhen,
} from '../types';
import { cardIdOf, def, effectOpUsesTarget, isCardInstance, isType, opponentOf } from '../types';

export interface EffectContext {
  controller: PlayerId;
  /** New observer choices suspend their triggering action before its response window. */
  newDecisionContext?: true;
  /** Reject unexpected targeted decisions or response windows from an activation. */
  activated?: true;
  sourceCardId: string;
  sourceIid?: number; // set for permanents' triggered abilities
  targets: TargetRef[];
  /** True when the spell's one upTo spec selected multiple independent targets. */
  targetBatch?: boolean;
  targetSpecs?: readonly TargetSpec[];
  /** Original cast slots survive an op or conditional branch binding one target. */
  originalTargets?: TargetRef[];
  originalTargetSpecs?: readonly TargetSpec[];
  originalTargetOwners?: (PlayerId | undefined)[];
  /** Owners captured before target effects can move a permanent between zones. */
  targetOwners?: (PlayerId | undefined)[];
  /** Internal mark-event recursion depth. This never enters public state. */
  markTriggerDepth?: number;
  x?: number;
  /**
   * The source's OWN card in its graveyard, excluded from `raise` (Magic's
   * "return ANOTHER creature card" templating). Set only on a `dies` trigger,
   * where the source is already in the yard and would otherwise be the
   * most-recently-buried creature: a self-raise makes the card unkillable by
   * damage/destroy, and a second copy loops the legend rule against the return
   * until `checkStateBased` gives up (measured 2026-08-22, Sitra).
   */
  selfGraveExclusion?: { instanceId?: number; cardId: string; owner?: PlayerId };
}

/**
 * Index of the source's own card in its graveyard, or -1. Matches the physical
 * instance when the engine created one; otherwise the most-recently-buried
 * plain entry of that card id, which is the copy that just died.
 */
function selfGraveIndex(
  grave: readonly CardEntry[],
  exclusion: EffectContext['selfGraveExclusion'],
): number {
  if (!exclusion) return -1;
  for (let i = grave.length - 1; i >= 0; i--) {
    const entry = grave[i];
    if (exclusion.instanceId !== undefined) {
      if (isCardInstance(entry) && entry.instanceId === exclusion.instanceId) return i;
    } else if (!isCardInstance(entry) && entry === exclusion.cardId) {
      return i;
    }
  }
  return -1;
}

function targetPermanent(state: GameState, ref: TargetRef | undefined): Permanent | undefined {
  if (!ref || ref.kind !== 'permanent') return undefined;
  return state.battlefield.find((p) => p.iid === ref.iid);
}

function dealPlayerDamage(state: GameState, emit: Emit, player: PlayerId, n: number): void {
  if (n <= 0) return;
  state.players[player].life -= n;
  emit({ e: 'lifeChanged', player, delta: -n, now: state.players[player].life });
}

function targetRefsForOp(ctx: EffectContext): TargetRef[] {
  return ctx.targetBatch ? ctx.targets : ctx.targets.slice(0, 1);
}

type MarkEvent = 'mark' | 'propagated';
const MAX_MARK_TRIGGER_DEPTH = 8;

/** Spend the allowance before executing or queuing a trigger, including recursive effects. */
function claimTrigger(perm: Permanent, ability: AbilityDef, abilityIndex: number): boolean {
  if (!ability.oncePerTurn) return true;
  if (perm.firedThisTurn?.includes(abilityIndex)) return false;
  (perm.firedThisTurn ??= []).push(abilityIndex);
  return true;
}

const markEventAvailability = new WeakMap<object, {
  any: boolean;
  markedAllyAttacks: boolean;
  allyCreatureArrives: boolean;
}>();

/** Resolve mark-observer availability once per actual, immutable database. */
function markEventAbilitiesIn(db: CardDb): {
  any: boolean;
  markedAllyAttacks: boolean;
  allyCreatureArrives: boolean;
} {
  const cached = markEventAvailability.get(db);
  if (cached) return cached;
  let any = false;
  let markedAllyAttacks = false;
  let allyCreatureArrives = false;
  for (const card of Object.values(db)) {
    for (const ability of card.abilities ?? []) {
      if (
        ability.when === 'gainsMark' ||
        ability.when === 'yourCreatureMarked' ||
        ability.when === 'yourPermanentMarked' ||
        ability.when === 'youAddMark' ||
        ability.when === 'otherCreatureMarked' ||
        ability.when === 'propagated'
      ) any = true;
      if (ability.when === 'markedAllyAttacks') markedAllyAttacks = true;
      if (ability.when === 'allyCreatureArrives') allyCreatureArrives = true;
      if (any && markedAllyAttacks && allyCreatureArrives) {
        const result = { any, markedAllyAttacks, allyCreatureArrives };
        markEventAvailability.set(db, result);
        return result;
      }
    }
  }
  const result = { any, markedAllyAttacks, allyCreatureArrives };
  markEventAvailability.set(db, result);
  return result;
}

/** Dispatch mark observers in live battlefield order for one mark event. */
function fireMarkTriggers(
  state: GameState,
  db: CardDb,
  emit: Emit,
  marked: Permanent | undefined,
  actor: PlayerId,
  event: MarkEvent,
  depth = 0,
): void {
  if (!markEventAbilitiesIn(db).any) return;
  if (depth > MAX_MARK_TRIGGER_DEPTH) return;
  const markedIsCreature = marked !== undefined && isType(def(db, marked.cardId), 'creature');
  for (const source of [...state.battlefield]) {
    if (!state.battlefield.some((perm) => perm.iid === source.iid)) continue;
    const sourceDef = def(db, source.cardId);
    for (const [abilityIndex, ab] of (sourceDef.abilities ?? []).entries()) {
      const matches = event === 'propagated'
        ? ab.when === 'propagated' && source.controller === actor
        : marked !== undefined && (
            (ab.when === 'gainsMark' && source.iid === marked.iid) ||
            (ab.when === 'yourCreatureMarked' && markedIsCreature && source.controller === marked.controller) ||
            (ab.when === 'yourPermanentMarked' && markedIsCreature && source.controller === marked.controller) ||
            (ab.when === 'youAddMark' && markedIsCreature && source.controller === actor) ||
            (ab.when === 'otherCreatureMarked' && markedIsCreature && source.iid !== marked.iid)
          );
      if (!matches || !ab.ops) continue;
      if (ab.condition !== undefined && !conditionSatisfied(state, db, source.controller, ab.condition, source.iid)) continue;
      if (!claimTrigger(source, ab, abilityIndex)) continue;
      emit({ e: 'triggerFired', iid: source.iid, when: ab.when });
      runOps(
        state,
        db,
        emit,
        {
          controller: source.controller,
          sourceCardId: source.cardId,
          sourceIid: source.iid,
          targets: [],
          markTriggerDepth: depth + 1,
        },
        ab.ops,
      );
      if (state.winner !== null) return;
    }
  }
}

/** Add exactly one mark at a time so every added mark gets its own batch. */
function addMarks(
  state: GameState,
  db: CardDb,
  emit: Emit,
  perm: Permanent,
  n: number,
  actor: PlayerId,
  markEventAbilities: boolean,
  depth = 0,
): void {
  if (!isType(def(db, perm.cardId), 'creature')) return;
  if (!markEventAbilities) {
    perm.plusOneCounters += n;
    return;
  }
  for (let i = 0; i < n; i++) {
    if (!state.battlefield.some((candidate) => candidate.iid === perm.iid)) return;
    perm.plusOneCounters += 1;
    fireMarkTriggers(state, db, emit, perm, actor, 'mark', depth);
    if (state.winner !== null) return;
  }
}

function targetOwner(state: GameState, ref: TargetRef | undefined): PlayerId | undefined {
  if (!ref) return undefined;
  if (ref.kind === 'player' || ref.kind === 'grave') return ref.player;
  if (ref.kind === 'permanent') return state.battlefield.find((perm) => perm.iid === ref.iid)?.owner;
  if (ref.kind === 'stackItem') return state.stack.find((item) => item.sid === ref.sid)?.controller;
  return undefined;
}

/** Ability conditions are evaluated from public battlefield state only. */
export function conditionSatisfied(
  state: GameState,
  db: CardDb,
  controller: PlayerId,
  condition: AbilityDef['condition'],
  sourceIid?: number,
): boolean {
  if (condition === undefined) return true;
  if (condition === 'creatureDiedThisTurn') return state.creatureDiedThisTurn === true;
  if (typeof condition === 'object' && condition.kind === 'controlsOther') return state.battlefield.some(p =>
    p.controller === controller && p.iid !== sourceIid && isType(def(db, p.cardId), 'creature') &&
    def(db, p.cardId).subtypes.includes(condition.subtype));
  if (condition === 'questActive') return isQuestActive(state.battlefield, db, controller);
  if (condition === 'controlMarked') {
    // The condition name is retained for replay compatibility, but Marks are
    // now creature-scoped throughout the engine.
    return state.battlefield.some((perm) =>
      perm.controller === controller &&
      perm.plusOneCounters > 0 &&
      isType(def(db, perm.cardId), 'creature'),
    );
  }
  const marked = state.battlefield.filter(
    (perm) => perm.controller === controller &&
      perm.plusOneCounters > 0 &&
      isType(def(db, perm.cardId), 'creature'),
  );
  return marked.length >= condition.n;
}

function awakenPermanent(db: CardDb, perm: Permanent): boolean {
  const d = def(db, perm.cardId);
  if (!isType(d, 'creature') || !d.awakening || perm.awakened) return false;
  perm.awakened = true;
  return true;
}

/** Execute one op. SBAs are the CALLER's responsibility after the batch. */
function runOp(state: GameState, db: CardDb, emit: Emit, ctx: EffectContext, op: EffectOp): void {
  // A source with no awakening block is a true no-op, including no event.
  // Successful awakenings retain the normal EffectOp log ordering.
  if (op.op !== 'awaken') emit({ e: 'effectApplied', op: op.op });
  switch (op.op) {
    case 'awaken': {
      const awakened: Permanent[] = [];
      if (op.scope === 'self') {
        const source = state.battlefield.find((p) => p.iid === ctx.sourceIid);
        if (source && awakenPermanent(db, source)) awakened.push(source);
      } else {
        for (const perm of state.battlefield) {
          if (perm.controller !== ctx.controller) continue;
          if (awakenPermanent(db, perm)) awakened.push(perm);
        }
      }
      if (awakened.length > 0) {
        emit({ e: 'effectApplied', op: op.op });
        for (const perm of awakened) {
          emit({ e: 'awakened', iid: perm.iid, cardId: perm.cardId });
        }
      }
      return;
    }
    case 'discard':
      if (op.n > 0 && state.players[ctx.controller].hand.length > 0)
        state.pendingDecisions.push({ kind: 'discard', player: ctx.controller, n: op.n });
      return;
    case 'sacrifice':
      for (const player of op.who === 'each' ? [ctx.controller, opponentOf(ctx.controller)] : [opponentOf(ctx.controller)]) {
        // Earlier sacrifices may change the next seat's board. Re-evaluate
        // their supply when the queued choice is raised; empty seats skip.
        state.pendingDecisions.push({ kind: 'sacrifice', player, n: 1, sourceCardId: ctx.sourceCardId,
          ...(ctx.sourceIid === undefined ? {} : { sourceIid: ctx.sourceIid }) });
      }
      return;
    case 'tapAll':
      for (const perm of state.battlefield) if (perm.controller !== ctx.controller && isType(def(db, perm.cardId), 'creature')) perm.tapped = true;
      return;
    case 'preventCombatTo':
      for (const ref of targetRefsForOp(ctx)) {
        const perm = targetPermanent(state, ref);
        if (perm && isType(def(db, perm.cardId), 'creature')) perm.combatDamagePrevented = true;
      }
      return;
    case 'reclaimSelf': {
      const owner = ctx.selfGraveExclusion?.owner ?? ctx.controller;
      const grave = state.players[owner].graveyard;
      const index = selfGraveIndex(grave, ctx.selfGraveExclusion);
      if (index >= 0) {
        const [card] = grave.splice(index, 1);
        if (isCardInstance(card)) delete card.whispersUntilDawnOf;
        state.players[owner].hand.push(card);
      }
      return;
    }
    case 'damage': {
      const n = op.n === 'X' ? (ctx.x ?? 0) : op.n;
      if (op.to === 'eachCreature' || op.to === 'eachOpponentCreature') {
        for (const perm of state.battlefield) {
          if (!isType(def(db, perm.cardId), 'creature') || n <= 0 || (op.to === 'eachOpponentCreature' && perm.controller === ctx.controller)) continue;
          perm.damage += n;
          if (op.severOnDeath) perm.severBranded = true;
          emit({ e: 'damageMarked', iid: perm.iid, amount: n });
        }
      } else if (op.to === 'controller') {
        dealPlayerDamage(state, emit, ctx.controller, n);
      } else if (op.to === 'opponent') {
        dealPlayerDamage(state, emit, opponentOf(ctx.controller), n);
      } else {
        for (const ref of targetRefsForOp(ctx)) {
          if (ref.kind === 'player') dealPlayerDamage(state, emit, ref.player, n);
          else {
            const perm = targetPermanent(state, ref);
            if (perm && n > 0) {
              perm.damage += n;
              emit({ e: 'damageMarked', iid: perm.iid, amount: n });
            }
          }
        }
      }
      return;
    }
    case 'gainLife': {
      state.players[ctx.controller].life += op.n;
      emit({
        e: 'lifeChanged',
        player: ctx.controller,
        delta: op.n,
        now: state.players[ctx.controller].life,
      });
      if (op.n > 0) firePlayerObservers(state, db, emit, 'youGainLife', ctx.controller, ctx.markTriggerDepth);
      return;
    }
    case 'loseLife':
      dealPlayerDamage(state, emit, opponentOf(ctx.controller), op.n);
      return;
    case 'draw':
      drawCards(state, emit, ctx.controller, op.n);
      return;
    case 'discardRandom': {
      const victim = opponentOf(ctx.controller);
      const hand = state.players[victim].hand;
      for (let i = 0; i < op.n && hand.length > 0; i++) {
        const idx = rngInt(state.rng, hand.length);
        // Hand -> graveyard (opponent's random discard): enables Whispers.
        const card = freshGraveyardCard(state, db, hand.splice(idx, 1)[0], victim);
        state.players[victim].graveyard.push(card);
        fireGraveyardTriggers(state, db, emit, card, victim, ctx.markTriggerDepth);
        emit({ e: 'discarded', player: victim, cardId: cardIdOf(card) });
      }
      return;
    }
    case 'destroy': {
      const observers = [...state.battlefield];
      for (const ref of targetRefsForOp(ctx)) {
        const perm = targetPermanent(state, ref);
        if (perm && destroyPermanent(
          state,
          db,
          perm,
          emit,
          (card, owner) => fireGraveyardTriggers(state, db, emit, card, owner, ctx.markTriggerDepth),
        ) && firesDiesForDestroy(state, db, perm)) {
          fireTriggers(state, db, emit, 'dies', perm, { markTriggerDepth: ctx.markTriggerDepth, observers });
        }
      }
      return;
    }
    case 'sever': {
      for (const ref of targetRefsForOp(ctx)) {
        const perm = targetPermanent(state, ref);
        // Sever removes the permanent and lets SBAs clean up orphaned auras, but
        // deliberately does not fire `dies` triggers.
        if (perm) severPermanent(state, db, perm, emit);
      }
      return;
    }
    case 'severSelf': {
      const source = state.battlefield.find((perm) => perm.iid === ctx.sourceIid);
      if (source) severPermanent(state, db, source, emit);
      return;
    }
    case 'destroyArtifactOrSeverEnchantment': {
      const observers = [...state.battlefield];
      for (const ref of targetRefsForOp(ctx)) {
        const perm = targetPermanent(state, ref);
        if (!perm) continue;
        const d = def(db, perm.cardId);
        // Artifact wins for a multi-typed permanent. This keeps the branch
        // deterministic and mirrors the op name's left-to-right contract.
        if (isType(d, 'artifact')) {
          if (destroyPermanent(
            state,
            db,
            perm,
            emit,
            (card, owner) => fireGraveyardTriggers(state, db, emit, card, owner, ctx.markTriggerDepth),
          ) && firesDiesForDestroy(state, db, perm)) {
            fireTriggers(state, db, emit, 'dies', perm, { markTriggerDepth: ctx.markTriggerDepth, observers });
          }
        } else if (isType(d, 'enchantment')) {
          severPermanent(state, db, perm, emit);
        }
      }
      return;
    }
    case 'severGrave': {
      const victim = op.who === 'self' ? ctx.controller : opponentOf(ctx.controller);
      const grave = state.players[victim].graveyard;
      for (let i = 0; i < op.n; i++) {
        const card = grave.pop(); // most recent card is the graveyard top
        if (card === undefined) break;
        if (isCardInstance(card)) delete card.whispersUntilDawnOf;
        state.players[victim].severed.push(card);
        emit({ e: 'severed', player: victim, cardId: cardIdOf(card), from: 'graveyard' });
      }
      return;
    }
    case 'severTop': {
      const lib = state.players[ctx.controller].deck;
      for (let i = 0; i < op.n; i++) {
        const card = lib.pop(); // top of deck is the last element
        if (card === undefined) break;
        state.players[ctx.controller].severed.push(card);
        emit({ e: 'severed', player: ctx.controller, cardId: cardIdOf(card), from: 'deck' });
      }
      return;
    }
    case 'recall': {
      for (const ref of targetRefsForOp(ctx)) {
        const perm = targetPermanent(state, ref);
        if (perm) recallPermanent(state, db, perm, emit);
      }
      return;
    }
    case 'cancel': {
      for (const ref of ctx.targets.filter((target) => target.kind === 'stackItem')) {
        if (ref.kind !== 'stackItem') continue;
        const idx = state.stack.findIndex((s) => s.sid === ref.sid);
        if (idx >= 0) {
          const [item] = state.stack.splice(idx, 1);
          const card = stackCard(state, item);
          if (item.retell) {
            state.players[item.controller].severed.push(card);
            emit({ e: 'severed', player: item.controller, cardId: item.cardId, from: 'graveyard' });
          } else {
            // Stack -> graveyard (cancel): stackCard carries identity only,
            // never a Whispers freshness marker.
            state.players[item.controller].graveyard.push(card);
            fireGraveyardTriggers(state, db, emit, card, item.controller, ctx.markTriggerDepth);
          }
          emit({ e: 'spellCountered', sid: item.sid });
        }
      }
      return;
    }
    case 'boost': {
      const mod = { p: op.p, t: op.t, keywords: op.keywords ?? [] };
      if (op.scope === 'self') {
        state.battlefield.find(p => p.iid === ctx.sourceIid)?.untilEotMods.push(mod);
      } else if (op.scope === 'target') {
        for (const ref of targetRefsForOp(ctx)) {
          const perm = targetPermanent(state, ref);
          perm?.untilEotMods.push({ ...mod, keywords: [...mod.keywords] });
        }
      } else {
        for (const perm of state.battlefield) {
          if (
            (op.scope === 'all' ||
              (op.scope !== 'theirMarked' && perm.controller === ctx.controller) ||
              (op.scope === 'theirMarked' && perm.controller === opponentOf(ctx.controller))) &&
            (op.scope !== 'yourMarked' && op.scope !== 'theirMarked' || perm.plusOneCounters > 0) &&
            isType(def(db, perm.cardId), 'creature')
          ) {
            perm.untilEotMods.push({ ...mod, keywords: [...mod.keywords] });
          }
        }
      }
      return;
    }
    case 'addCounters': {
      const perms = op.to === 'self'
        ? [state.battlefield.find((p) => p.iid === ctx.sourceIid)]
        : targetRefsForOp(ctx).map((ref) => targetPermanent(state, ref));
      const markEventAbilities = markEventAbilitiesIn(db).any;
      for (const perm of perms) {
        if (perm) addMarks(
          state,
          db,
          emit,
          perm,
          op.n,
          ctx.controller,
          markEventAbilities,
          ctx.markTriggerDepth ?? 0,
        );
      }
      return;
    }
    case 'propagate': {
      // Puts one more Mark on each already-Marked creature you control.
      // A creature at zero Marks is skipped, so Propagate never starts one.
      // Yours only, and no target, so there is no choice to make.
      const marked = state.battlefield.filter(
        (perm) => perm.controller === ctx.controller &&
          perm.plusOneCounters > 0 &&
          isType(def(db, perm.cardId), 'creature'),
      );
      const markEventAbilities = markEventAbilitiesIn(db).any;
      for (const perm of marked) {
        addMarks(
          state,
          db,
          emit,
          perm,
          1,
          ctx.controller,
          markEventAbilities,
          ctx.markTriggerDepth ?? 0,
        );
        if (state.winner !== null) return;
      }
      fireMarkTriggers(state, db, emit, undefined, ctx.controller, 'propagated', ctx.markTriggerDepth ?? 0);
      return;
    }
    case 'moveMark': {
      const permanentTargets = ctx.targets.filter((target) => target.kind === 'permanent');
      const from = targetPermanent(state, permanentTargets[0]);
      const to = targetPermanent(state, permanentTargets[1]);
      if (
        !from ||
        !to ||
        from.iid === to.iid ||
        from.controller !== ctx.controller ||
        to.controller !== ctx.controller ||
        !isType(def(db, from.cardId), 'creature') ||
        !isType(def(db, to.cardId), 'creature') ||
        from.plusOneCounters <= 0
      ) return;
      from.plusOneCounters -= 1;
      const markEventAbilities = markEventAbilitiesIn(db).any;
      addMarks(
        state,
        db,
        emit,
        to,
        1,
        ctx.controller,
        markEventAbilities,
        ctx.markTriggerDepth ?? 0,
      );
      return;
    }
    case 'removeMarks': {
      for (const ref of targetRefsForOp(ctx)) {
        const perm = targetPermanent(state, ref);
        if (perm && isType(def(db, perm.cardId), 'creature')) perm.plusOneCounters = 0;
      }
      return;
    }
    case 'markAll': {
      const creatures = [...state.battlefield].filter(
        (perm) => perm.controller === ctx.controller && (!op.other || perm.iid !== ctx.sourceIid) && isType(def(db, perm.cardId), 'creature'),
      );
      const markEventAbilities = markEventAbilitiesIn(db).any;
      for (const perm of creatures) {
        addMarks(
          state,
          db,
          emit,
          perm,
          1,
          ctx.controller,
          markEventAbilities,
          ctx.markTriggerDepth ?? 0,
        );
        if (state.winner !== null) return;
      }
      return;
    }
    case 'loseLifePerTheirMarked': {
      const count = state.battlefield.filter(
        (perm) => perm.controller === opponentOf(ctx.controller) &&
          perm.plusOneCounters > 0 &&
          isType(def(db, perm.cardId), 'creature'),
      ).length;
      dealPlayerDamage(state, emit, opponentOf(ctx.controller), count);
      return;
    }
    case 'fetchLand': {
      const deck = state.players[ctx.controller].deck;
      let index = -1;
      for (let i = deck.length - 1; i >= 0; i--) {
        if (isType(def(db, deck[i]), 'land')) {
          index = i;
          break;
        }
      }
      if (index < 0) return;
      const [card] = deck.splice(index, 1);
      const perm = enterBattlefield(state, db, card, ctx.controller, emit, { tapped: true });
      fireTriggers(state, db, emit, 'arrives', perm, { markTriggerDepth: ctx.markTriggerDepth });
      return;
    }
    case 'ifTargetMarked': {
      const refs = targetRefsForOp(ctx);
      for (let index = 0; index < refs.length; index++) {
        const ref = refs[index];
        const target = targetPermanent(state, ref);
        runOps(
          state,
          db,
          emit,
          {
            ...ctx,
            targets: [ref],
            targetBatch: false,
            ...(ctx.targetSpecs ? { targetSpecs: [ctx.targetSpecs[ctx.targetBatch ? 0 : index]] } : {}),
            targetOwners: [ctx.targetOwners?.[index]],
          },
          target &&
          isType(def(db, target.cardId), 'creature') &&
          target.plusOneCounters > 0
            ? op.then
            : (op.else ?? []),
        );
      }
      return;
    }
    case 'tap': {
      for (const ref of targetRefsForOp(ctx)) {
        const perm = targetPermanent(state, ref);
        if (perm) perm.tapped = true;
      }
      return;
    }
    case 'extraLandDrop':
      state.players[ctx.controller].extraLandDrops += op.n ?? 1;
      return;
    case 'createToken': {
      for (let i = 0; i < op.count; i++) {
        const count = state.battlefield.filter(
          (p) => p.controller === ctx.controller && isType(def(db, p.cardId), 'creature'),
        ).length;
        if (count >= RULES.maxCreatures) return; // cap: excess tokens are not created
        const perm = enterBattlefield(state, db, op.token, ctx.controller, emit, {
          asToken: true,
          ...(op.marks === undefined ? {} : { plusOneCounters: op.marks }),
        });
        fireTriggers(state, db, emit, 'arrives', perm, { markTriggerDepth: ctx.markTriggerDepth });
      }
      return;
    }
    case 'destroyNewestOpponentArtifactOrEnchantment': {
      const observers = [...state.battlefield];
      const opponent = opponentOf(ctx.controller);
      for (let i = state.battlefield.length - 1; i >= 0; i--) {
        const perm = state.battlefield[i];
        if (perm.controller !== opponent) continue;
        const d = def(db, perm.cardId);
        if (!isType(d, 'artifact') && !isType(d, 'enchantment')) continue;
        if (destroyPermanent(
          state,
          db,
          perm,
          emit,
          (card, owner) => fireGraveyardTriggers(state, db, emit, card, owner, ctx.markTriggerDepth),
        ) && firesDiesForDestroy(state, db, perm)) {
          fireTriggers(state, db, emit, 'dies', perm, { markTriggerDepth: ctx.markTriggerDepth, observers });
        }
        return;
      }
      return;
    }
    case 'massDestroy': {
      const observers = [...state.battlefield];
      const doomed = state.battlefield.filter((p) => {
        const d = def(db, p.cardId);
        if (op.filter === 'allEnchantments') return isType(d, 'enchantment');
        if (!isType(d, 'creature')) return false;
        if (op.filter === 'allFliers') {
          return getEffectiveStats(state.battlefield, db, p.iid).keywords.has('skyborne');
        }
        return true;
      });
      const fallen: Permanent[] = [];
      const graveyardEntries: { card: CardEntry; owner: PlayerId }[] = [];
      for (const perm of doomed) {
        if (destroyPermanent(
          state,
          db,
          perm,
          emit,
          (card, owner) => graveyardEntries.push({ card, owner }),
        ) && firesDiesForDestroy(state, db, perm)) {
          fallen.push(perm);
        }
      }
      for (const entry of graveyardEntries) {
        if (state.winner !== null) return;
        fireGraveyardTriggers(state, db, emit, entry.card, entry.owner, ctx.markTriggerDepth);
      }
      fireBatchedDies(state, db, emit, fallen, ctx.markTriggerDepth, observers);
      return;
    }
    case 'preventCombat':
      state.fogThisTurn = true;
      return;
    case 'reclaim': {
      const grave = state.players[ctx.controller].graveyard;
      for (const ref of [...targetRefsForOp(ctx)].sort((a, b) => {
        if (a.kind !== 'grave' || b.kind !== 'grave') return 0;
        return b.index - a.index;
      })) {
        if (ref.kind !== 'grave' || ref.player !== ctx.controller) continue;
        if (ref.index < grave.length) {
          const [card] = grave.splice(ref.index, 1);
          if (isCardInstance(card)) delete card.whispersUntilDawnOf;
          state.players[ctx.controller].hand.push(card);
        }
      }
      return;
    }
    case 'grind': {
      const victim = op.who === 'self' ? ctx.controller : opponentOf(ctx.controller);
      const lib = state.players[victim].deck;
      for (let i = 0; i < op.n; i++) {
        const milled = lib.pop(); // top of deck is the last element
        if (milled === undefined) break; // empty deck: deck-out is a DRAW check, not here
        // Deck -> graveyard (self or opponent grind): enables Whispers.
        const card = freshGraveyardCard(state, db, milled, victim);
        state.players[victim].graveyard.push(card);
        fireGraveyardTriggers(state, db, emit, card, victim, ctx.markTriggerDepth);
        emit({ e: 'milled', player: victim, cardId: cardIdOf(card) });
      }
      return;
    }
    case 'foresee': {
      // The interpreter stays synchronous; Game surfaces this FIFO decision
      // after the current resolution batch. The action itself performs the
      // deterministic deck rewrite.
      const subject = op.who === 'targetOwner'
        ? (ctx.targetOwners?.[0] ?? targetOwner(state, ctx.targets[0]))
        : ctx.controller;
      if (subject !== undefined && op.n > 0 && state.players[subject].deck.length > 0) {
        state.pendingDecisions.push({ kind: 'foresee', player: subject, n: op.n });
      }
      return;
    }
    case 'raise': {
      const grave = state.players[ctx.controller].graveyard;
      // A dies-triggered raise may never return its own source: see
      // EffectContext.selfGraveExclusion.
      const excludedIndex = selfGraveIndex(grave, ctx.selfGraveExclusion);
      let index: number;
      if (op.to === 'top') {
        // most-recently-buried creature (trigger-safe: no target decision)
        index = -1;
        for (let i = grave.length - 1; i >= 0; i--) {
          if (i === excludedIndex) continue;
          if (isType(def(db, grave[i]), 'creature')) {
            index = i;
            break;
          }
        }
        if (index < 0) return;
      } else {
        index = -1;
        for (const ref of targetRefsForOp(ctx)) {
          if (ref.kind !== 'grave' || ref.player !== ctx.controller) continue;
          if (ref.index < 0 || ref.index >= grave.length) continue;
          if (ref.index === excludedIndex) continue;
          if (!isType(def(db, grave[ref.index]), 'creature')) continue;
          index = ref.index;
          break;
        }
        if (index < 0) return;
      }
      // Respect the creature cap like createToken — check BEFORE removing the
      // card, so a full board is a harmless no-op that leaves it in the yard.
      const count = state.battlefield.filter(
        (p) => p.controller === ctx.controller && isType(def(db, p.cardId), 'creature'),
      ).length;
      if (count >= RULES.maxCreatures) return;
      const [cardId] = grave.splice(index, 1);
      const plusOneCounters = op.to === 'top' ? op.withMarks : undefined;
      const perm = enterBattlefield(state, db, cardId, ctx.controller, emit, {
        ...(plusOneCounters === undefined ? {} : { plusOneCounters }),
        ...(op.grantKeywords === undefined ? {} : { grantKeywords: op.grantKeywords }),
      });
      fireTriggers(state, db, emit, 'arrives', perm, { markTriggerDepth: ctx.markTriggerDepth });
      return;
    }
  }
}

function containsNewPlayerChoice(ops: readonly EffectOp[]): boolean {
  return ops.some(op => op.op === 'discard' || op.op === 'sacrifice' ||
    (op.op === 'ifTargetMarked' && (containsNewPlayerChoice(op.then) || containsNewPlayerChoice(op.else ?? []))));
}

function containsSelfReclaim(ops: readonly EffectOp[]): boolean {
  return ops.some(op => op.op === 'reclaimSelf' ||
    (op.op === 'ifTargetMarked' && (containsSelfReclaim(op.then) || containsSelfReclaim(op.else ?? []))));
}

export function runOps(
  state: GameState,
  db: CardDb,
  emit: Emit,
  ctx: EffectContext,
  ops: readonly EffectOp[],
): void {
  ctx.targetOwners ??= ctx.targets.map((ref) => targetOwner(state, ref));
  for (let index = 0; index < ops.length; index++) {
    const op = ops[index];
    if (state.winner !== null) return;
    const pendingCount = state.pendingDecisions.length;
    let bound = ctx;
    if ('targetIndex' in op && op.targetIndex !== undefined) {
      const slot = op.targetIndex;
      const originals = ctx.originalTargets ?? ctx.targets;
      const originalSpecs = ctx.originalTargetSpecs ?? ctx.targetSpecs;
      const originalOwners = ctx.originalTargetOwners ?? ctx.targetOwners;
      const ref = originals[slot];
      const spec = originalSpecs?.[slot];
      bound = { ...ctx, targetBatch: false,
        originalTargets: originals, originalTargetSpecs: originalSpecs, originalTargetOwners: originalOwners,
        targetSpecs: spec ? [spec] : undefined,
        targets: ref && (!spec || isLegalTarget(state, db, ctx.controller, spec, ref, ctx.sourceIid)) ? [ref] : [],
        targetOwners: [originalOwners?.[slot]] };
    } else if (ctx.targetSpecs) {
      const legalIndexes = ctx.targets.flatMap((ref, i) => {
        const spec = ctx.targetBatch ? ctx.targetSpecs![0] : ctx.targetSpecs![i];
        return !spec || isLegalTarget(state, db, ctx.controller, spec, ref, ctx.sourceIid) ? [i] : [];
      });
      // A multi-slot spell's implicit target remains slot zero. Filtering the
      // whole list would silently redirect it to the next surviving slot.
      const selected = ctx.targetBatch ? legalIndexes
        : op.op === 'moveMark' ? legalIndexes.length === ctx.targets.length ? legalIndexes : []
        : legalIndexes.includes(0) ? [0] : [];
      bound = { ...ctx,
        originalTargets: ctx.originalTargets ?? ctx.targets,
        originalTargetSpecs: ctx.originalTargetSpecs ?? ctx.targetSpecs,
        originalTargetOwners: ctx.originalTargetOwners ?? ctx.targetOwners,
        targets: selected.map(i => ctx.targets[i]),
        targetOwners: selected.map(i => ctx.targetOwners?.[i]),
      };
    }
    runOp(state, db, emit, bound, op);
    if (state.pendingDecisions.length === pendingCount) continue;

    const thenOps = ops.slice(index + 1);
    const pending = state.pendingDecisions[state.pendingDecisions.length - 1];
    if (ctx.newDecisionContext) {
      for (const decision of state.pendingDecisions.slice(pendingCount)) decision.continuations ??= [];
    }
    if (pending && (pending.kind === 'discard' || pending.kind === 'sacrifice' || pending.continuations !== undefined ||
      (pending.kind === 'chooseTarget' && pending.triggerWhen !== undefined))) {
      pending.continuations ??= [];
      if (thenOps.length) pending.continuations.push({ context: structuredClone(ctx), ops: [...thenOps] });
      return;
    }
    if (ctx.activated) {
      for (const decision of state.pendingDecisions.slice(pendingCount)) {
        if (decision.kind !== 'foresee') {
          throw new Error('An activation cannot defer a targeted decision or response window.');
        }
        // A nested trigger may own the tail; preserve its context and the guard.
        if (decision.thenContext) decision.thenContext.activated = true;
      }
    }
    if (pending?.kind === 'foresee') {
      if (thenOps.length > 0) {
        for (const thenOp of thenOps) assertTargetFreeForeseeContinuation(thenOp);
        if (containsSelfReclaim(thenOps)) {
          pending.continuations ??= [];
          pending.continuations.push({ context: structuredClone(ctx), ops: [...thenOps] });
          return;
        }
        const thenContext = {
          controller: ctx.controller,
          sourceCardId: ctx.sourceCardId,
          ...(ctx.sourceIid === undefined ? {} : { sourceIid: ctx.sourceIid }),
          ...(ctx.activated ? { activated: true as const } : {}),
        };
        const prior = pending.thenContext;
        if (pending.thenOps?.length && prior && (
          prior.controller !== thenContext.controller || prior.sourceCardId !== thenContext.sourceCardId ||
          prior.sourceIid !== thenContext.sourceIid || prior.activated !== thenContext.activated
        )) throw new Error('Cannot combine Foresee tails with different source contexts.');
        pending.thenContext = thenContext;
        pending.thenOps = [...(pending.thenOps ?? []), ...thenOps];
        // Preserve the legacy target-free tail validation above. A new choice
        // later in that tail still needs public continuation/resume plumbing.
        if (containsNewPlayerChoice(pending.thenOps)) pending.continuations ??= [];
      }
    } else if (pending?.kind === 'chooseTarget' && thenOps.length > 0) {
      if (pending.sourceCardId !== ctx.sourceCardId || pending.sourceIid !== ctx.sourceIid) {
        throw new Error(
          `Cannot append deferred target-trigger tail from ${ctx.sourceCardId} to ${pending.sourceCardId}; ` +
          'the continuation has a different source context.',
        );
      }
      pending.ops = [...pending.ops, ...thenOps];
    }
    return;
  }
}

/** Fire a card's graveyard-entry abilities after any zone pushes the card into its owner's graveyard. */
export function fireGraveyardTriggers(
  state: GameState,
  db: CardDb,
  emit: Emit,
  card: CardEntry,
  owner: PlayerId,
  markTriggerDepth = 0,
): void {
  const cardId = cardIdOf(card);
  const d = db[cardId];
  if (!d) return;
  for (const ab of d.abilities ?? []) {
    if (
      ab.when !== 'entersGraveyard' ||
      !ab.ops ||
      !conditionSatisfied(state, db, owner, ab.condition)
    ) continue;
    emit({
      e: 'graveyardTriggerFired',
      cardId,
      owner,
      when: 'entersGraveyard',
      ...(isCardInstance(card) ? { instanceId: card.instanceId } : {}),
    });
    runOps(
      state,
      db,
      emit,
      { controller: owner, sourceCardId: cardId, targets: [], markTriggerDepth },
      ab.ops,
    );
    if (state.winner !== null) return;
  }
}

/** Foresee preserves the source context, but never an inline target binding. */
function assertTargetFreeForeseeContinuation(op: EffectOp): void {
  if (effectOpUsesTarget(op)) {
    throw new Error(`A target-dependent op cannot follow foresee: ${op.op}.`);
  }
}

/**
 * Fire a permanent's triggered abilities of the given kind. Targeted arrival
 * abilities queue their mandatory choice; ally-arrival observers use the
 * arriving creature as an automatic subject target; other trigger kinds stay
 * target-free.
 */
function fireAllyCreatureArrivesTriggers(
  state: GameState,
  db: CardDb,
  emit: Emit,
  arriving: Permanent,
  markTriggerDepth = 0,
): void {
  const arrivingDef = def(db, arriving.cardId);
  if (!isType(arrivingDef, 'creature') || !markEventAbilitiesIn(db).allyCreatureArrives) return;

  const arrivingRef: TargetRef = { kind: 'permanent', iid: arriving.iid };
  for (const holder of [...state.battlefield]) {
    if (
      holder.iid === arriving.iid ||
      holder.controller !== arriving.controller ||
      !state.battlefield.some((perm) => perm.iid === holder.iid)
    ) continue;
    for (const [abilityIndex, ability] of (def(db, holder.cardId).abilities ?? []).entries()) {
      if (ability.when !== 'allyCreatureArrives' || !ability.ops) continue;
      if (
        ability.condition !== undefined &&
        !conditionSatisfied(state, db, holder.controller, ability.condition, holder.iid)
      ) continue;
      if (!claimTrigger(holder, ability, abilityIndex)) continue;
      emit({ e: 'triggerFired', iid: holder.iid, when: ability.when });
      runOps(
        state,
        db,
        emit,
        {
          controller: holder.controller,
          sourceCardId: holder.cardId,
          sourceIid: holder.iid,
          // The arrival is the observer subject, not a choice. This is the
          // target context used by Orbital Graft's "mark it" operation.
          targets: [arrivingRef],
          markTriggerDepth,
        },
        ability.ops,
      );
      if (state.winner !== null) return;
    }
  }
}

export function fireTriggers(
  state: GameState,
  db: CardDb,
  emit: Emit,
  when: Exclude<TriggerWhen, 'spell' | 'static'>,
  perm: Permanent,
  options: { deferPostDies?: boolean; markTriggerDepth?: number; observers?: readonly Permanent[]; sacrifice?: boolean; deferObservers?: boolean } = {},
): void {
  const d = def(db, perm.cardId);
  for (let abilityIndex = 0; abilityIndex < (d.abilities ?? []).length; abilityIndex++) {
    const ab = d.abilities![abilityIndex];
    if (ab.when !== when || !ab.ops) continue;
    if (ab.condition !== undefined && !conditionSatisfied(state, db, perm.controller, ab.condition, perm.iid)) continue;
    if (ab.targets && ab.targets.length > 0) {
      if (ab.targets.length !== 1 || ab.targets[0].upTo !== undefined || ab.targets[0].exactly !== undefined) {
        throw new Error('Targeted arrival abilities must have one single target spec.');
      }
      const spec = ab.targets[0];
      if (enumerateTargets(state, db, perm.controller, spec, perm.iid).length === 0) continue;
      if (!claimTrigger(perm, ab, abilityIndex)) continue;
      emit({ e: 'triggerFired', iid: perm.iid, when });
      state.pendingDecisions.push({
        kind: 'chooseTarget',
        player: perm.controller,
        sourceIid: perm.iid,
        sourceCardId: perm.cardId,
        abilityIndex,
        spec,
        ...(when === 'arrives' ? {} : { triggerWhen: when }),
        ops: ab.ops,
      });
      continue;
    }
    if (!claimTrigger(perm, ab, abilityIndex)) continue;
    emit({ e: 'triggerFired', iid: perm.iid, when });
    const selfGraveExclusion =
      when === 'dies'
        ? {
            ...(perm.instanceId === undefined ? {} : { instanceId: perm.instanceId }),
            cardId: perm.cardId,
            ...(ab.ops.some(op => op.op === 'reclaimSelf') ? { owner: perm.owner } : {}),
          }
        : undefined;
    // Revision 4: a dies trigger is held back so Hauntlink windows can be
    // offered before it resolves (owner ruling 2026-09-04). Only when someone
    // can actually pay a link, so a board with none is byte-identical to
    // revision 3. The drain in Game.submit() runs the held ops afterwards.
    if (when === 'dies' && (state.rulesRev ?? 1) >= 4 && anyPayableHauntlink(state, db)) {
      state.pendingDecisions.push({
        kind: 'resolveTrigger',
        controller: perm.controller,
        sourceIid: perm.iid,
        sourceCardId: perm.cardId,
        targets: [],
        ops: ab.ops,
        offered: [],
        ...(options.markTriggerDepth === undefined ? {} : { markTriggerDepth: options.markTriggerDepth }),
        ...(selfGraveExclusion === undefined ? {} : { selfGraveExclusion }),
      });
      continue;
    }
    runOps(
      state,
      db,
      emit,
      {
        controller: perm.controller,
        sourceCardId: perm.cardId,
        sourceIid: perm.iid,
        targets: [],
        markTriggerDepth: options.markTriggerDepth,
        ...(['allyDies', 'youGainLife', 'youCastCharm', 'allyAttacks', 'sunset'].includes(when)
          ? { newDecisionContext: true as const } : {}),
        ...(selfGraveExclusion === undefined ? {} : { selfGraveExclusion }),
      },
      ab.ops,
    );
  }

  if (when === 'arrives') fireAllyCreatureArrivesTriggers(state, db, emit, perm, options.markTriggerDepth);

  if (when === 'arrives' && d.chapters && d.chapters.length > 0) {
    advanceChapter(state, db, emit, perm, true, options.markTriggerDepth);
  } else if (when === 'dawn' && d.chapters && d.chapters.length > 0) {
    advanceChapter(state, db, emit, perm, false, options.markTriggerDepth);
  }

  if (when === 'dies' && !options.deferObservers) fireCreatureObservers(state, db, emit, 'allyDies', perm, options.observers ?? [...state.battlefield, perm], options.sacrifice);

  if (when === 'dies' && !options.deferPostDies && state.winner === null) {
    returnWithNineLives(state, db, emit, perm, options.markTriggerDepth);
  }
}

/**
 * Fire the observer half of "whenever a marked creature you control attacks".
 * The caller supplies attackers in declaration order; holders are read in
 * battlefield order so the resulting trigger sequence is deterministic.
 */
export function fireMarkedAllyAttackTriggers(
  state: GameState,
  db: CardDb,
  emit: Emit,
  attacker: Permanent,
): void {
  if (!isType(def(db, attacker.cardId), 'creature') || attacker.plusOneCounters <= 0) return;
  if (!markEventAbilitiesIn(db).markedAllyAttacks) return;
  for (const holder of [...state.battlefield]) {
    if (
      !state.battlefield.some((perm) => perm.iid === holder.iid) ||
      holder.controller !== attacker.controller
    ) continue;
    const abilities = def(db, holder.cardId).abilities ?? [];
    for (const [abilityIndex, ability] of abilities.entries()) {
      if (
        ability.when !== 'markedAllyAttacks' ||
        !ability.ops
      ) continue;
      if (ability.condition !== undefined &&
          !conditionSatisfied(state, db, holder.controller, ability.condition, holder.iid)) continue;
      if (!claimTrigger(holder, ability, abilityIndex)) continue;
      emit({ e: 'triggerFired', iid: holder.iid, when: ability.when });
      runOps(
        state,
        db,
        emit,
        {
          controller: holder.controller,
          sourceCardId: holder.cardId,
          sourceIid: holder.iid,
          targets: [],
        },
        ability.ops,
      );
      if (state.winner !== null) return;
    }
  }
}

/** Public player events and battlefield-ordered creature observers. */
export function firePlayerObservers(state: GameState, db: CardDb, emit: Emit,
  when: 'youGainLife' | 'youCastCharm', player: PlayerId, markTriggerDepth = 0): void {
  if (when === 'youGainLife' && markTriggerDepth > MAX_MARK_TRIGGER_DEPTH) return;
  for (const source of [...state.battlefield]) {
    if (source.controller === player) fireTriggers(state, db, emit, when, source, { markTriggerDepth });
  }
}

export function fireCreatureObservers(state: GameState, db: CardDb, emit: Emit,
  when: 'allyDies' | 'allyAttacks', subject: Permanent,
  observers: readonly Permanent[] = state.battlefield, sacrifice = false): void {
  if (!isType(def(db, subject.cardId), 'creature')) return;
  for (const source of [...observers]) {
    if (source.controller !== subject.controller) continue;
    const abilities = def(db, source.cardId).abilities ?? [];
    for (let abilityIndex = 0; abilityIndex < abilities.length; abilityIndex++) {
      const ab = abilities[abilityIndex];
      if (ab.when !== when || !ab.ops || (ab.filter?.other && source.iid === subject.iid) ||
        (ab.filter?.subtype && !def(db, subject.cardId).subtypes.includes(ab.filter.subtype)) ||
        (ab.filter?.sacrifice && !sacrifice) || !conditionSatisfied(state, db, source.controller, ab.condition, source.iid)) continue;
      if (ab.targets?.length) {
        if (ab.targets.length !== 1 || ab.targets[0].upTo || ab.targets[0].exactly) throw new Error('Observer needs one single target spec');
        if (!enumerateTargets(state, db, source.controller, ab.targets[0], source.iid).length) continue;
        if (!claimTrigger(source, ab, abilityIndex)) continue;
        state.pendingDecisions.push({ kind: 'chooseTarget', player: source.controller, sourceIid: source.iid,
          sourceCardId: source.cardId, abilityIndex, spec: ab.targets[0], ops: ab.ops, triggerWhen: when });
        emit({ e: 'triggerFired', iid: source.iid, when });
      } else {
        if (!claimTrigger(source, ab, abilityIndex)) continue;
        emit({ e: 'triggerFired', iid: source.iid, when });
        runOps(state, db, emit, { controller: source.controller, sourceCardId: source.cardId, sourceIid: source.iid, targets: [], newDecisionContext: true }, ab.ops);
      }
    }
  }
}

/** Resume a new choice's ordered frames before later queued decisions. */
export function runContinuations(state: GameState, db: CardDb, emit: Emit, frames: readonly EffectContinuation[] = []): void {
  for (let i = 0; i < frames.length; i++) {
    const count = state.pendingDecisions.length;
    runOps(state, db, emit, frames[i].context, frames[i].ops);
    if (state.pendingDecisions.length > count) {
      const pending = state.pendingDecisions[state.pendingDecisions.length - 1];
      pending.continuations = [...(pending.continuations ?? []), ...frames.slice(i + 1)];
      return;
    }
  }
}

/**
 * Fire a complete battlefield-order dies batch before any Nine Lives returns.
 * SBA and mass-destroy callers use this so every corpse leaves and every dies
 * rider resolves before the marked bodies re-enter in the same order.
 */
export function fireBatchedDies(
  state: GameState,
  db: CardDb,
  emit: Emit,
  fallen: readonly Permanent[],
  markTriggerDepth = 0,
  observers: readonly Permanent[] = [...state.battlefield, ...fallen],
  sacrifice = false,
): void {
  for (const perm of fallen) {
    if (state.winner !== null) return;
    fireTriggers(state, db, emit, 'dies', perm, {
      deferPostDies: true,
      deferObservers: true,
      markTriggerDepth,
    });
  }
  for (const perm of fallen) fireCreatureObservers(state, db, emit, 'allyDies', perm, observers, sacrifice);
  for (const perm of fallen) {
    if (state.winner !== null) return;
    returnWithNineLives(state, db, emit, perm, markTriggerDepth);
  }
}

/** Shared post-dies hook for every death path, including Rite's Game-owned path. */
function returnWithNineLives(
  state: GameState,
  db: CardDb,
  emit: Emit,
  fallen: Permanent,
  markTriggerDepth = 0,
): void {
  const d = def(db, fallen.cardId);
  if (!d.nineLives || fallen.plusOneCounters !== 0 || fallen.instanceId === undefined) return;

  const grave = state.players[fallen.owner].graveyard;
  const graveIndex = grave.findIndex(
    (card) => isCardInstance(card) && card.instanceId === fallen.instanceId,
  );
  if (graveIndex < 0) return;

  // Match raise: check the cap before splicing, so a blocked return leaves the
  // physical card in the graveyard and records no separate "used" state.
  const creatureCount = state.battlefield.filter(
    (perm) => perm.controller === fallen.owner && isType(def(db, perm.cardId), 'creature'),
  ).length;
  if (creatureCount >= RULES.maxCreatures) return;

  const [card] = grave.splice(graveIndex, 1);
  const returned = enterBattlefield(state, db, card, fallen.owner, emit, {
    plusOneCounters: 1,
  });
  emit({ e: 'nineLivesReturned', player: fallen.owner, iid: returned.iid, cardId: returned.cardId });
  fireTriggers(state, db, emit, 'arrives', returned, { markTriggerDepth });
}

/**
 * Quest chapters are trigger-safe ops. Arrival enters Chapter I; later dawns
 * increment the current chapter. A final chapter leaves through the ordinary
 * destroy/dies path after its ops finish.
 */
function advanceChapter(
  state: GameState,
  db: CardDb,
  emit: Emit,
  perm: Permanent,
  arriving: boolean,
  markTriggerDepth = 0,
): void {
  const chapters = def(db, perm.cardId).chapters;
  if (!chapters || chapters.length === 0) return;
  const chapter = arriving ? 1 : (perm.chapter ?? 0) + 1;
  if (chapter > chapters.length) return;
  perm.chapter = chapter;
  emit({ e: 'chapterAdvanced', iid: perm.iid, cardId: perm.cardId, chapter });
  runOps(
    state,
    db,
    emit,
    {
      controller: perm.controller,
      sourceCardId: perm.cardId,
      sourceIid: perm.iid,
      targets: [],
      markTriggerDepth,
    },
    chapters[chapter - 1],
  );
  if (chapter !== chapters.length || state.winner !== null) return;
  const observers = [...state.battlefield];
  if (destroyPermanent(
    state,
    db,
    perm,
    emit,
    (card, owner) => fireGraveyardTriggers(state, db, emit, card, owner, markTriggerDepth),
  ) && firesDiesForDestroy(state, db, perm)) {
    fireTriggers(state, db, emit, 'dies', perm, { markTriggerDepth, observers });
  }
}

/** Does this ability list include a triggered ability of the given kind? */
export function hasTrigger(db: CardDb, cardId: string, when: TriggerWhen): boolean {
  return (def(db, cardId).abilities ?? []).some((ab) => ab.when === when);
}

/** The cast-time target specs of a card (spell body or first targeted ability). */
export function targetSpecsOf(
  dAbilities: readonly AbilityDef[] | undefined,
): readonly TargetSpec[] {
  for (const ab of dAbilities ?? []) {
    if (ab.when === 'spell' && ab.targets && ab.targets.length > 0) return ab.targets;
  }
  return [];
}

function stackCard(state: GameState, item: { instanceId?: number; cardId: string; variantKey?: string | null }):
  string | { instanceId: number; cardId: string; variantKey: string | null } {
  if (state.nextInstanceId === undefined) return item.cardId;
  return {
    instanceId: item.instanceId ?? state.nextInstanceId++,
    cardId: item.cardId,
    variantKey: item.variantKey ?? null,
  };
}
