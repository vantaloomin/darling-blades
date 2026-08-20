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
import type {
  AbilityDef,
  CardDb,
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
  x?: number;
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

/** Ability conditions are evaluated from public battlefield state only. */
export function conditionSatisfied(
  state: GameState,
  db: CardDb,
  controller: PlayerId,
  condition: AbilityDef['condition'],
): boolean {
  return condition !== 'questActive' || isQuestActive(state.battlefield, db, controller);
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
          emit({ e: 'damageMarked', iid: perm.iid, amount: n });
        }
      } else if (op.to === 'controller') {
        dealPlayerDamage(state, emit, ctx.controller, n);
      } else if (op.to === 'opponent') {
        dealPlayerDamage(state, emit, opponentOf(ctx.controller), n);
      } else {
        const ref = ctx.targets[0];
        if (ref?.kind === 'player') dealPlayerDamage(state, emit, ref.player, n);
        else {
          const perm = targetPermanent(state, ref);
          if (perm && n > 0) {
            perm.damage += n;
            emit({ e: 'damageMarked', iid: perm.iid, amount: n });
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
        emit({ e: 'discarded', player: victim, cardId: cardIdOf(card) });
      }
      return;
    }
    case 'destroy': {
      const perm = targetPermanent(state, ctx.targets[0]);
      if (perm && destroyPermanent(state, db, perm, emit) && firesDiesForDestroy(state, db, perm)) {
        fireTriggers(state, db, emit, 'dies', perm);
      }
      return;
    }
    case 'sever': {
      const perm = targetPermanent(state, ctx.targets[0]);
      // Sever removes the permanent and lets SBAs clean up orphaned auras, but
      // deliberately does not fire `dies` triggers.
      if (perm) severPermanent(state, db, perm, emit);
      return;
    }
    case 'destroyArtifactOrSeverEnchantment': {
      const perm = targetPermanent(state, ctx.targets[0]);
      if (!perm) return;
      const d = def(db, perm.cardId);
      // Artifact wins for a multi-typed permanent. This keeps the branch
      // deterministic and mirrors the op name's left-to-right contract.
      if (isType(d, 'artifact')) {
        if (destroyPermanent(state, db, perm, emit) && firesDiesForDestroy(state, db, perm)) {
          fireTriggers(state, db, emit, 'dies', perm);
        }
      } else if (isType(d, 'enchantment')) {
        severPermanent(state, db, perm, emit);
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
      const perm = targetPermanent(state, ctx.targets[0]);
      if (perm) recallPermanent(state, db, perm, emit);
      return;
    }
    case 'cancel': {
      const ref = ctx.targets[0];
      if (ref?.kind !== 'stackItem') return;
      const idx = state.stack.findIndex((s) => s.sid === ref.sid);
      if (idx >= 0) {
        const [item] = state.stack.splice(idx, 1);
        const card = stackCard(state, item);
        if (item.retell) {
          state.players[item.controller].severed.push(card);
          emit({ e: 'severed', player: item.controller, cardId: item.cardId, from: 'graveyard' });
        } else {
          state.players[item.controller].graveyard.push(card);
        }
        emit({ e: 'spellCountered', sid: item.sid });
      }
      return;
    }
    case 'boost': {
      const mod = { p: op.p, t: op.t, keywords: op.keywords ?? [] };
      if (op.scope === 'target') {
        const perm = targetPermanent(state, ctx.targets[0]);
        perm?.untilEotMods.push({ ...mod, keywords: [...mod.keywords] });
      } else {
        for (const perm of state.battlefield) {
          if (
            (op.scope === 'all' || perm.controller === ctx.controller) &&
            isType(def(db, perm.cardId), 'creature')
          ) {
            perm.untilEotMods.push({ ...mod, keywords: [...mod.keywords] });
          }
        }
      }
      return;
    }
    case 'addCounters': {
      const perm =
        op.to === 'self'
          ? state.battlefield.find((p) => p.iid === ctx.sourceIid)
          : targetPermanent(state, ctx.targets[0]);
      if (perm) perm.plusOneCounters += op.n;
      return;
    }
    case 'tap': {
      const perm = targetPermanent(state, ctx.targets[0]);
      if (perm) perm.tapped = true;
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
        fireTriggers(state, db, emit, 'arrives', perm);
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
        if (destroyPermanent(state, db, perm, emit) && firesDiesForDestroy(state, db, perm)) {
          fireTriggers(state, db, emit, 'dies', perm);
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
      for (const perm of doomed) {
        if (destroyPermanent(state, db, perm, emit) && firesDiesForDestroy(state, db, perm)) {
          fallen.push(perm);
        }
      }
      fireBatchedDies(state, db, emit, fallen);
      return;
    }
    case 'preventCombat':
      state.fogThisTurn = true;
      return;
    case 'reclaim': {
      const ref = ctx.targets[0];
      if (ref?.kind !== 'grave') return;
      const grave = state.players[ctx.controller].graveyard;
      if (ref.index < grave.length) {
        const [card] = grave.splice(ref.index, 1);
        state.players[ctx.controller].hand.push(card);
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
        emit({ e: 'milled', player: victim, cardId: cardIdOf(card) });
      }
      return;
    }
    case 'foresee': {
      // The interpreter stays synchronous; Game surfaces this FIFO decision
      // after the current resolution batch. The action itself performs the
      // deterministic deck rewrite.
      if (op.n > 0 && state.players[ctx.controller].deck.length > 0) {
        state.pendingDecisions.push({ kind: 'foresee', player: ctx.controller, n: op.n });
      }
      return;
    }
    case 'raise': {
      const grave = state.players[ctx.controller].graveyard;
      let index: number;
      if (op.to === 'top') {
        // most-recently-buried creature (trigger-safe: no target decision)
        index = -1;
        for (let i = grave.length - 1; i >= 0; i--) {
          if (isType(def(db, grave[i]), 'creature')) {
            index = i;
            break;
          }
        }
        if (index < 0) return;
      } else {
        const ref = ctx.targets[0];
        if (ref?.kind !== 'grave' || ref.player !== ctx.controller) return;
        if (ref.index < 0 || ref.index >= grave.length) return;
        if (!isType(def(db, grave[ref.index]), 'creature')) return;
        index = ref.index;
      }
      // Respect the creature cap like createToken — check BEFORE removing the
      // card, so a full board is a harmless no-op that leaves it in the yard.
      const count = state.battlefield.filter(
        (p) => p.controller === ctx.controller && isType(def(db, p.cardId), 'creature'),
      ).length;
      if (count >= RULES.maxCreatures) return;
      const [cardId] = grave.splice(index, 1);
      const perm = enterBattlefield(state, db, cardId, ctx.controller, emit);
      fireTriggers(state, db, emit, 'arrives', perm);
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
  for (let index = 0; index < ops.length; index++) {
    const op = ops[index];
    if (state.winner !== null) return;
    const pendingCount = state.pendingDecisions.length;
    runOp(state, db, emit, ctx, op);
    if (op.op !== 'foresee' || state.pendingDecisions.length === pendingCount) continue;

    const thenOps = ops.slice(index + 1);
    if (thenOps.length > 0) {
      for (const thenOp of thenOps) assertTargetFreeForeseeContinuation(thenOp);
      const pending = state.pendingDecisions[state.pendingDecisions.length - 1];
      if (pending?.kind !== 'foresee') {
        throw new Error('Foresee queued an unexpected deferred decision.');
      }
      pending.thenOps = thenOps;
    }
    return;
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
    op.op === 'foresee' ||
    (op.op === 'damage' && op.to !== 'target') ||
    (op.op === 'boost' && op.scope !== 'target') ||
    (op.op === 'addCounters' && op.to === 'self') ||
    (op.op === 'raise' && op.to === 'top') ||
    (op.op === 'awaken' && op.scope === 'allYours');
  if (!targetFree) {
    throw new Error(`A target-dependent op cannot follow foresee: ${op.op}.`);
  }
}

/**
 * Fire a permanent's triggered abilities of the given kind. Triggers never
 * target in v1, so they auto-resolve unless an op defers a resolution-time choice.
 */
export function fireTriggers(
  state: GameState,
  db: CardDb,
  emit: Emit,
  when: Exclude<TriggerWhen, 'spell' | 'static'>,
  perm: Permanent,
  options: { deferPostDies?: boolean } = {},
): void {
  const d = def(db, perm.cardId);
  for (const ab of d.abilities ?? []) {
    if (
      ab.when !== when ||
      !ab.ops ||
      !conditionSatisfied(state, db, perm.controller, ab.condition)
    ) continue;
    emit({ e: 'triggerFired', iid: perm.iid, when });
    runOps(
      state,
      db,
      emit,
      { controller: perm.controller, sourceCardId: perm.cardId, sourceIid: perm.iid, targets: [] },
      ab.ops,
    );
  }

  if (when === 'arrives' && d.chapters && d.chapters.length > 0) {
    advanceChapter(state, db, emit, perm, true);
  } else if (when === 'dawn' && d.chapters && d.chapters.length > 0) {
    advanceChapter(state, db, emit, perm, false);
  }

  if (when === 'dies' && !options.deferPostDies && state.winner === null) {
    returnWithNineLives(state, db, emit, perm);
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
): void {
  for (const perm of fallen) {
    if (state.winner !== null) return;
    fireTriggers(state, db, emit, 'dies', perm, { deferPostDies: true });
  }
  for (const perm of fallen) {
    if (state.winner !== null) return;
    returnWithNineLives(state, db, emit, perm);
  }
}

/** Shared post-dies hook for every death path, including Rite's Game-owned path. */
function returnWithNineLives(
  state: GameState,
  db: CardDb,
  emit: Emit,
  fallen: Permanent,
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
  fireTriggers(state, db, emit, 'arrives', returned);
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
    { controller: perm.controller, sourceCardId: perm.cardId, sourceIid: perm.iid, targets: [] },
    chapters[chapter - 1],
  );
  if (chapter !== chapters.length || state.winner !== null) return;
  if (destroyPermanent(state, db, perm, emit) && firesDiesForDestroy(state, db, perm)) {
    fireTriggers(state, db, emit, 'dies', perm);
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
    if (ab.when !== 'static' && ab.targets && ab.targets.length > 0) return ab.targets;
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
