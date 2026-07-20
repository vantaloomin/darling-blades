import { RULES } from '../../config/rules';
import type { Emit } from '../battlefield';
import {
  destroyPermanent,
  enterBattlefield,
  recallPermanent,
  severPermanent,
} from '../battlefield';
import { drawCards } from '../phases';
import { rngInt, rngShuffle } from '../rng';
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
import { def, isType, opponentOf } from '../types';

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
      if (op.to === 'controller') {
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
        const [cardId] = hand.splice(idx, 1);
        state.players[victim].graveyard.push(cardId);
        emit({ e: 'discarded', player: victim, cardId });
      }
      return;
    }
    case 'destroy': {
      const perm = targetPermanent(state, ctx.targets[0]);
      if (perm && destroyPermanent(state, db, perm, emit)) {
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
        if (destroyPermanent(state, db, perm, emit)) {
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
        const cardId = grave.pop(); // most recent card is the graveyard top
        if (cardId === undefined) break;
        state.players[victim].severed.push(cardId);
        emit({ e: 'severed', player: victim, cardId, from: 'graveyard' });
      }
      return;
    }
    case 'severTop': {
      const lib = state.players[ctx.controller].deck;
      for (let i = 0; i < op.n; i++) {
        const cardId = lib.pop(); // top of deck is the last element
        if (cardId === undefined) break;
        state.players[ctx.controller].severed.push(cardId);
        emit({ e: 'severed', player: ctx.controller, cardId, from: 'deck' });
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
        state.players[item.controller].graveyard.push(item.cardId);
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
            perm.controller === ctx.controller &&
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
    case 'fetchLand': {
      const lib = state.players[ctx.controller].deck;
      // Distinct basic land types available to fetch.
      const distinct = new Set<string>();
      for (const cardId of lib) {
        if (def(db, cardId).supertypes?.includes('basic')) distinct.add(cardId);
      }
      if (distinct.size >= 2) {
        // >1 type: defer to a player/AI choice, surfaced after the flush (see
        // Game.maybeRaiseDeferredDecision / apply 'chooseBasicLand'). Do NOT fetch or
        // shuffle here — both happen when the choice resolves — so the ≤1-type
        // path below stays byte-identical (determinism.test relies on it).
        state.pendingDecisions.push({ kind: 'chooseBasicLand', player: ctx.controller });
        return;
      }
      // 0 or 1 distinct type: unchanged — grab the topmost basic, enter tapped,
      // reshuffle. (No choice to make, so no reason to interrupt.)
      for (let i = lib.length - 1; i >= 0; i--) {
        if (def(db, lib[i]).supertypes?.includes('basic')) {
          const [cardId] = lib.splice(i, 1);
          const perm = enterBattlefield(state, db, cardId, ctx.controller, emit);
          perm.tapped = true;
          rngShuffle(state.rng, lib);
          return;
        }
      }
      return;
    }
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
        if (destroyPermanent(state, db, perm, emit)) {
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
      for (const perm of doomed) {
        if (destroyPermanent(state, db, perm, emit)) {
          fireTriggers(state, db, emit, 'dies', perm);
        }
      }
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
        const [cardId] = grave.splice(ref.index, 1);
        state.players[ctx.controller].hand.push(cardId);
      }
      return;
    }
    case 'grind': {
      const victim = op.who === 'self' ? ctx.controller : opponentOf(ctx.controller);
      const lib = state.players[victim].deck;
      for (let i = 0; i < op.n; i++) {
        const cardId = lib.pop(); // top of deck is the last element
        if (cardId === undefined) break; // empty deck: deck-out is a DRAW check, not here
        state.players[victim].graveyard.push(cardId);
        emit({ e: 'milled', player: victim, cardId });
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
  for (const op of ops) {
    if (state.winner !== null) return;
    runOp(state, db, emit, ctx, op);
  }
}

/**
 * Fire a permanent's triggered abilities of the given kind. Triggers never
 * target in v1, so they auto-resolve immediately — no decision points.
 */
export function fireTriggers(
  state: GameState,
  db: CardDb,
  emit: Emit,
  when: Exclude<TriggerWhen, 'spell' | 'static'>,
  perm: Permanent,
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
  if (destroyPermanent(state, db, perm, emit)) fireTriggers(state, db, emit, 'dies', perm);
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
