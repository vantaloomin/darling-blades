import { RULES } from '../../config/rules';
import type { Emit } from '../battlefield';
import {
  destroyPermanent,
  firesDiesForDestroy,
  enterBattlefield,
  recallPermanent,
  severPermanent,
} from '../battlefield';
import { drawCards } from '../phases';
import { rngInt } from '../rng';
import { getEffectiveStats, isQuestActive } from '../statics';
import { enumerateTargets } from './targeting';
import type {
  AbilityDef,
  CardDb,
  CardEntry,
  EffectOp,
  GameState,
  Permanent,
  PlayerId,
  TargetRef,
  TargetSpec,
  TriggerWhen,
} from '../types';
import { cardIdOf, def, isCardInstance, isType, opponentOf } from '../types';

export interface EffectContext {
  controller: PlayerId;
  sourceCardId: string;
  sourceIid?: number; // set for permanents' triggered abilities
  targets: TargetRef[];
  /** True when the spell's one upTo spec selected multiple independent targets. */
  targetBatch?: boolean;
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
  selfGraveExclusion?: { instanceId?: number; cardId: string };
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
const markEventAvailability = new WeakMap<object, {
  any: boolean;
  markedAllyAttacks: boolean;
  allyCreatureArrives: boolean;
}>();

/**
 * Resolve mark-observer availability once per database shape. AI
 * determinization creates fresh simDb objects, but their shared stand-in
 * CardDefs provide a stable cache key across those worlds.
 */
function markEventAbilitiesIn(db: CardDb): {
  any: boolean;
  markedAllyAttacks: boolean;
  allyCreatureArrives: boolean;
} {
  const standIn = db.__unknown_c2;
  const key = standIn?.id === '__unknown_c2' ? standIn : db;
  const cached = markEventAvailability.get(key);
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
        markEventAvailability.set(key, result);
        return result;
      }
    }
  }
  const result = { any, markedAllyAttacks, allyCreatureArrives };
  markEventAvailability.set(key, result);
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
  if (depth > MAX_MARK_TRIGGER_DEPTH) {
    throw new Error('Mark-trigger recursion exceeded depth 8.');
  }
  const markedIsCreature = marked !== undefined && isType(def(db, marked.cardId), 'creature');
  for (const source of [...state.battlefield]) {
    if (!state.battlefield.some((perm) => perm.iid === source.iid)) continue;
    const sourceDef = def(db, source.cardId);
    for (const ab of sourceDef.abilities ?? []) {
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
      if (ab.condition !== undefined && !conditionSatisfied(state, db, source.controller, ab.condition)) continue;
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
): boolean {
  if (condition === undefined) return true;
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
    case 'damage': {
      const n = op.n === 'X' ? (ctx.x ?? 0) : op.n;
      if (op.to === 'eachCreature') {
        for (const perm of state.battlefield) {
          if (!isType(def(db, perm.cardId), 'creature') || n <= 0) continue;
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
        const [card] = hand.splice(idx, 1);
        state.players[victim].graveyard.push(card);
        fireGraveyardTriggers(state, db, emit, card, victim, ctx.markTriggerDepth);
        emit({ e: 'discarded', player: victim, cardId: cardIdOf(card) });
      }
      return;
    }
    case 'destroy': {
      for (const ref of targetRefsForOp(ctx)) {
        const perm = targetPermanent(state, ref);
        if (perm && destroyPermanent(
          state,
          db,
          perm,
          emit,
          (card, owner) => fireGraveyardTriggers(state, db, emit, card, owner, ctx.markTriggerDepth),
        ) && firesDiesForDestroy(state, db, perm)) {
          fireTriggers(state, db, emit, 'dies', perm, { markTriggerDepth: ctx.markTriggerDepth });
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
            fireTriggers(state, db, emit, 'dies', perm, { markTriggerDepth: ctx.markTriggerDepth });
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
      if (op.scope === 'target') {
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
        (perm) => perm.controller === ctx.controller && isType(def(db, perm.cardId), 'creature'),
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
        });
        fireTriggers(state, db, emit, 'arrives', perm, { markTriggerDepth: ctx.markTriggerDepth });
      }
      return;
    }
    case 'destroyNewestOpponentArtifactOrEnchantment': {
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
          fireTriggers(state, db, emit, 'dies', perm, { markTriggerDepth: ctx.markTriggerDepth });
        }
        return;
      }
      return;
    }
    case 'massDestroy': {
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
      fireBatchedDies(state, db, emit, fallen, ctx.markTriggerDepth);
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
          state.players[ctx.controller].hand.push(card);
        }
      }
      return;
    }
    case 'grind': {
      const victim = op.who === 'self' ? ctx.controller : opponentOf(ctx.controller);
      const lib = state.players[victim].deck;
      for (let i = 0; i < op.n; i++) {
        const card = lib.pop(); // top of deck is the last element
        if (card === undefined) break; // empty deck: deck-out is a DRAW check, not here
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
      });
      fireTriggers(state, db, emit, 'arrives', perm, { markTriggerDepth: ctx.markTriggerDepth });
      return;
    }
  }
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
    runOp(state, db, emit, ctx, op);
    if (state.pendingDecisions.length === pendingCount) continue;

    const thenOps = ops.slice(index + 1);
    const pending = state.pendingDecisions[state.pendingDecisions.length - 1];
    if (pending?.kind === 'foresee') {
      if (thenOps.length > 0) {
        for (const thenOp of thenOps) assertTargetFreeForeseeContinuation(thenOp);
        pending.thenOps = [...(pending.thenOps ?? []), ...thenOps];
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

/**
 * A Foresee continuation retains only its controller, never the spell's
 * cast-time targets or source permanent. Reject an incompatible card loudly
 * instead of resolving it with missing context.
 */
function assertTargetFreeForeseeContinuation(op: EffectOp): void {
  const targetFree =
    op.op === 'gainLife' ||
    op.op === 'loseLife' ||
    op.op === 'draw' ||
    op.op === 'discardRandom' ||
    op.op === 'severGrave' ||
    op.op === 'severTop' ||
    op.op === 'extraLandDrop' ||
    op.op === 'createToken' ||
    op.op === 'destroyNewestOpponentArtifactOrEnchantment' ||
    op.op === 'massDestroy' ||
    op.op === 'preventCombat' ||
    op.op === 'grind' ||
    (op.op === 'foresee' && op.who === undefined) ||
    (op.op === 'damage' && op.to !== 'target') ||
    (op.op === 'boost' && op.scope !== 'target') ||
    op.op === 'propagate' ||
    op.op === 'markAll' ||
    op.op === 'loseLifePerTheirMarked' ||
    op.op === 'fetchLand' ||
    (op.op === 'addCounters' && op.to === 'self') ||
    (op.op === 'raise' && op.to === 'top') ||
    op.op === 'severSelf' ||
    (op.op === 'awaken' && op.scope === 'allYours');
  if (!targetFree) {
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
    for (const ability of def(db, holder.cardId).abilities ?? []) {
      if (ability.when !== 'allyCreatureArrives' || !ability.ops) continue;
      if (
        ability.condition !== undefined &&
        !conditionSatisfied(state, db, holder.controller, ability.condition)
      ) continue;
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
  options: { deferPostDies?: boolean; markTriggerDepth?: number } = {},
): void {
  const d = def(db, perm.cardId);
  for (let abilityIndex = 0; abilityIndex < (d.abilities ?? []).length; abilityIndex++) {
    const ab = d.abilities![abilityIndex];
    if (ab.when !== when || !ab.ops) continue;
    if (ab.condition !== undefined && !conditionSatisfied(state, db, perm.controller, ab.condition)) continue;
    if (when === 'arrives' && ab.targets && ab.targets.length > 0) {
      if (ab.targets.length !== 1 || ab.targets[0].upTo !== undefined) {
        throw new Error('Targeted arrival abilities must have one single target spec.');
      }
      const spec = ab.targets[0];
      if (enumerateTargets(state, db, perm.controller, spec, perm.iid).length === 0) continue;
      emit({ e: 'triggerFired', iid: perm.iid, when });
      state.pendingDecisions.push({
        kind: 'chooseTarget',
        player: perm.controller,
        sourceIid: perm.iid,
        sourceCardId: perm.cardId,
        abilityIndex,
        spec,
        ops: ab.ops,
      });
      continue;
    }
    emit({ e: 'triggerFired', iid: perm.iid, when });
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
        ...(when === 'dies'
          ? {
              selfGraveExclusion: {
                ...(perm.instanceId === undefined ? {} : { instanceId: perm.instanceId }),
                cardId: perm.cardId,
              },
            }
          : {}),
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
    for (const ability of abilities) {
      if (
        ability.when !== 'markedAllyAttacks' ||
        !ability.ops
      ) continue;
      if (ability.condition !== undefined &&
          !conditionSatisfied(state, db, holder.controller, ability.condition)) continue;
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
): void {
  for (const perm of fallen) {
    if (state.winner !== null) return;
    fireTriggers(state, db, emit, 'dies', perm, {
      deferPostDies: true,
      markTriggerDepth,
    });
  }
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
  if (destroyPermanent(
    state,
    db,
    perm,
    emit,
    (card, owner) => fireGraveyardTriggers(state, db, emit, card, owner, markTriggerDepth),
  ) && firesDiesForDestroy(state, db, perm)) {
    fireTriggers(state, db, emit, 'dies', perm, { markTriggerDepth });
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
