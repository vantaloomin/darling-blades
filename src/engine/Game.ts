import { activatedAbilitiesOf, isType, type EffectContinuation } from './types';
import {
  CURRENT_RULES_REV,
  DARLING_PAYDOWN_COST,
  DARLING_PAYDOWN_REDUCTION,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS_IN_RESERVE,
  RULES,
  type GameFormat,
  usesLandReserve,
} from '../config/rules';
import type { Action } from './actions';
import { castCost, darlingCastCost, legalActions, validateAction } from './actions';
import { hasCastableCharm, hasCastableInstant, hasPayableHauntlinkAction } from './actions';
import { anyPayableHauntlink } from './hauntlinkWindow';
import { resolveCombatDamage } from './combat/damage';
import {
  deferRemainingOps,
  fireGraveyardTriggers,
  fireCreatureObservers,
  firePlayerObservers,
  runContinuations,
  fireMarkedAllyAttackTriggers,
  fireTriggers,
  runOps,
} from './effects/EffectInterpreter';
import { enumerateTargets } from './effects/targeting';
import type { GameEvent } from './events';
import { solveMana } from './mana';
import { freshGraveyardCard } from './graveyard';
import { attachPermanent, destroyPermanent, firesDiesForDestroy } from './battlefield';
import { checkStateBased } from './sba';
import { getEffectiveStats } from './statics';
import {
  drawCards,
  endGame,
  enterCleanup,
  enterEndStep,
  finishDawn,
  finishCleanup,
  resumeCleanup,
  resumeSunsetWindow,
  setStep,
  startTurn,
} from './phases';
import { createRngState, rngInt, rngShuffle } from './rng';
import type { Emit } from './resolve';
import { enterBattlefield, resolveStackItem } from './resolve';
import type {
  Awaiting,
  CardEntry,
  CardInstance,
  CardDb,
  GameState,
  LegacyAwaiting,
  LegacyGameState,
  PendingDecision,
  PlayerId,
  StackItem,
} from './types';
import { cardIdOf, def, findPermanent, isCardInstance, opponentOf, variantKeyOf } from './types';
import type { PlayerView } from './view';
import { viewFor } from './view';

type HeldTrigger = Extract<PendingDecision, { kind: 'resolveTrigger' }>;

/**
 * A queued decision that stops the stack flush until it is settled. Anything
 * else (a plain Foresee, a plain targeted arrival) waits for the flush to end.
 */
function holdsFlush(p: PendingDecision): boolean {
  return p.kind === 'discard' || p.kind === 'sacrifice' || p.kind === 'resolveTrigger' ||
    p.continuations !== undefined || (p.kind === 'chooseTarget' && p.triggerWhen !== undefined);
}

/**
 * A held dies trigger, as opposed to a targeted trigger held after its target
 * was chosen (which always carries that target). With no payable link the
 * former would have resolved inline, where it fired; the latter would have
 * resolved when its choice was answered.
 */
function isHeldDiesTrigger(p: HeldTrigger): boolean {
  return p.targets.length === 0;
}

export interface GameConfig {
  decks: [CardEntry[], CardEntry[]];
  seed: number;
  db: CardDb;
  /** Simulation override for opening deals and full mulligan redraws. */
  startingHandSize?: number;
  /** Classic is the default. Warchest and Darlings use ordered land reserves. */
  format?: GameFormat;
  /** One ordered ten-land payload per seat for reserve formats. */
  landReserves?: [CardEntry[], CardEntry[]];
  /** One public command-zone Darling per seat (or null for no assigned Darling). */
  darlings?: [string | null, string | null];
  /** Opt into the pre-deal coin-flip winner's play/draw decision. */
  playDrawChoice?: boolean;
  /** Optional synchronous read-only observer for headless instrumentation. */
  eventObserver?: (event: Readonly<GameEvent>, state: Readonly<GameState>) => void;
  /** Observable engine behavior revision. New games default to current. */
  rulesRev?: 1 | 2 | 3 | 4;
}

function buildDarlingInstances(
  cfg: GameConfig,
  nextInstanceId: () => number,
): [CardInstance | null, CardInstance | null] {
  if (!cfg.darlings || cfg.darlings.length !== 2) {
    throw new Error('Darlings games require one darlings payload for each player.');
  }
  return cfg.darlings.map((cardId, player) => {
    if (cardId === null) return null;
    const d = cfg.db[cardId];
    if (!d) throw new Error(`Darlings format P${player} contains unknown Darling id ${cardId}.`);
    if (!d.types.includes('creature') || !d.cost) {
      throw new Error(`Darlings format P${player} Darling ${cardId} must be a creature with a mana cost.`);
    }
    return { instanceId: nextInstanceId(), cardId, variantKey: null } satisfies CardInstance;
  }) as [CardInstance | null, CardInstance | null];
}

function isBasicLand(card: CardEntry, db: CardDb): boolean {
  return db[cardIdOf(card)]?.supertypes?.includes('basic') ?? false;
}

function isDualLand(card: CardEntry, db: CardDb): boolean {
  return new Set(db[cardIdOf(card)]?.manaAbility ?? []).size > 1;
}

function buildReserveInstances(
  cfg: GameConfig,
  nextInstanceId: () => number,
): [CardInstance[], CardInstance[]] {
  if (!cfg.landReserves || cfg.landReserves.length !== 2) {
    throw new Error('Reserve formats require one landReserves payload for each player.');
  }

  const out = cfg.landReserves.map((reserve, player) => {
    if (reserve.length !== LAND_RESERVE_SIZE) {
      throw new Error(
        `Reserve format P${player} needs exactly ${LAND_RESERVE_SIZE} lands (received ${reserve.length}).`,
      );
    }
    let duals = 0;
    const instances = reserve.map((card) => {
      const cardId = cardIdOf(card);
      const d = cfg.db[cardId];
      if (!d) throw new Error(`Reserve format P${player} contains unknown land id ${cardId}.`);
      if (!d.types.includes('land')) {
        throw new Error(`Reserve format P${player} contains non-land card ${cardId}.`);
      }
      if (!isBasicLand(card, cfg.db) && !isDualLand(card, cfg.db)) {
        throw new Error(`Reserve format P${player} contains unsupported land ${cardId}.`);
      }
      if (isDualLand(card, cfg.db)) duals++;
      return {
        instanceId: nextInstanceId(),
        cardId,
        variantKey: isCardInstance(card) ? card.variantKey : null,
      } satisfies CardInstance;
    });
    if (duals > MAX_DUAL_LANDS_IN_RESERVE) {
      throw new Error(
        `Reserve format P${player} may contain at most ${MAX_DUAL_LANDS_IN_RESERVE} dual lands (received ${duals}).`,
      );
    }
    return instances;
  }) as [CardInstance[], CardInstance[]];

  for (const [player, deck] of cfg.decks.entries()) {
    for (const card of deck) {
      const cardId = cardIdOf(card);
      if (cfg.db[cardId]?.types.includes('land')) {
        throw new Error(
          `Reserve format P${player} deck contains land ${cardId}; lands must be supplied in landReserves.`,
        );
      }
    }
  }
  return out;
}

function validateRestoredReserveState(state: GameState, db: CardDb): void {
  for (const [player, data] of state.players.entries()) {
    if (data.landReserve === undefined) continue;
    for (const zone of [data.deck, data.hand]) {
      for (const card of zone) {
        if (db[cardIdOf(card)]?.types.includes('land')) {
          throw new Error(`Reserve format P${player} state contains land ${cardIdOf(card)} outside the reserve.`);
        }
      }
    }
    if (data.landReserve.length > LAND_RESERVE_SIZE) {
      throw new Error(
        `Reserve format P${player} may contain at most ${LAND_RESERVE_SIZE} lands (received ${data.landReserve.length}).`,
      );
    }
    let duals = 0;
    for (const card of data.landReserve) {
      const d = db[cardIdOf(card)];
      if (!d || !d.types.includes('land')) {
        throw new Error(`Reserve format P${player} state contains a non-land reserve card ${cardIdOf(card)}.`);
      }
      if (isDualLand(card, db)) duals++;
    }
    if (duals > MAX_DUAL_LANDS_IN_RESERVE) {
      throw new Error(
        `Reserve format P${player} may contain at most ${MAX_DUAL_LANDS_IN_RESERVE} dual lands (received ${duals}).`,
      );
    }
  }
}

/**
 * The deterministic rules engine: validate → apply → emit. Pure TypeScript,
 * plain-JSON state, zero Phaser. (decklists, seed, action sequence) → an
 * identical state and event stream, every time, on every machine.
 */
export class Game {
  private st: GameState;
  private readonly db: CardDb;
  private readonly startingHandSize: number;
  private readonly eventObserver?: GameConfig['eventObserver'];
  private buf: GameEvent[] = [];
  /** Legacy state facade retained so existing callers can make scalar edits before submit. */
  private publicState?: LegacyGameState;
  /** Events produced during construction; opted-in opening draws occur after the choice. */
  readonly initialEvents: GameEvent[] = [];

  constructor(cfg: GameConfig) {
    this.db = cfg.db;
    this.startingHandSize = cfg.startingHandSize ?? RULES.startingHandSize;
    if (!Number.isSafeInteger(this.startingHandSize) || this.startingHandSize <= 0) {
      throw new Error('startingHandSize must be a positive integer.');
    }
    this.eventObserver = cfg.eventObserver;
    const rng = createRngState(cfg.seed);
    const rulesRev = cfg.rulesRev ?? CURRENT_RULES_REV;

    let nextInstanceId = 1;

    const reserveInstances = usesLandReserve(cfg.format)
      ? buildReserveInstances(cfg, () => nextInstanceId++)
      : undefined;
    const darlingInstances = cfg.format === 'darlings'
      ? buildDarlingInstances(cfg, () => nextInstanceId++)
      : undefined;

    const libraries = cfg.decks.map((deck) =>
      rngShuffle(rng, deck.map((card) => ({
        instanceId: nextInstanceId++,
        cardId: cardIdOf(card),
        variantKey: isCardInstance(card) ? card.variantKey : null,
      }))),
    ) as [CardInstance[], CardInstance[]];
    const startingPlayer = rngInt(rng, 2) as PlayerId;

    this.st = {
      ...(rulesRev >= 2
        ? { rulesRev, episode: { resolvedSinceOffer: 0, reopensThisStep: 0 } }
        : {}),
      rng,
      turn: 0, // becomes 1 when the game actually starts (after mulligans)
      startingPlayer,
      activePlayer: startingPlayer,
      step: 'untap',
      players: [
        this.freshPlayer(libraries[0], reserveInstances?.[0], darlingInstances?.[0]),
        this.freshPlayer(libraries[1], reserveInstances?.[1], darlingInstances?.[1]),
      ],
      battlefield: [],
      stack: [],
      stackClosed: false,
      combat: null,
      fogThisTurn: false,
      // Until an opted-in play/draw choice resolves, startingPlayer is the
      // provisional flip winner. No turn or mulligan logic reads it first.
      awaiting: cfg.playDrawChoice
        ? { player: startingPlayer, kind: 'choosePlayDraw' }
        : { player: startingPlayer, kind: 'mulligan' },
      pendingDecisions: [],
      nextIid: 1,
      nextInstanceId,
      nextSid: 1,
      winner: null,
      winReason: null,
    };

    const emit: Emit = (e) => {
      this.initialEvents.push(e);
      this.eventObserver?.(e, this.st);
    };
    if (cfg.playDrawChoice) {
      // The call/reveal happens before either player sees an opening hand.
      // Dealing moves to choosePlayDraw below; drawCards consumes no RNG, so
      // the seeded winner and post-choice RNG stream stay unchanged.
      emit({ e: 'coinFlipped', winner: startingPlayer });
    } else {
      emit({ e: 'firstPlayerChosen', player: startingPlayer });
      for (const p of [0, 1] as const) {
        drawCards(this.st, emit, p, this.startingHandSize);
      }
    }
  }

  private freshPlayer(
    deck: CardInstance[],
    landReserve?: CardInstance[],
    darlingZone?: CardInstance | null,
  ): GameState['players'][0] {
    const player: GameState['players'][0] = {
      life: RULES.startingLife,
      deck,
      hand: [],
      graveyard: [],
      severed: [],
      landDropsUsed: 0,
      extraLandDrops: 0,
      mulligans: 0,
      keptHand: false,
    };
    if (landReserve !== undefined) player.landReserve = landReserve;
    if (darlingZone !== undefined) {
      player.darlingZone = darlingZone;
      player.darlingTax = 0;
      if (darlingZone !== null) player.darlingInstanceId = darlingZone.instanceId;
    }
    return player;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  get state(): Readonly<LegacyGameState> {
    this.publicState ??= legacyState(this.st);
    return this.publicState;
  }

  /** Instance-bearing state used by the engine spike and future presentation layers. */
  get instanceState(): Readonly<GameState> {
    this.syncLegacyMutations();
    return this.st;
  }

  get awaiting(): LegacyAwaiting {
    return this.state.awaiting;
  }

  legalActions(player: PlayerId): Action[] {
    this.syncLegacyMutations();
    return legalActions(this.st, this.db, player);
  }

  viewFor(player: PlayerId): PlayerView {
    this.syncLegacyMutations();
    const castable = [0, 1].map((seat) =>
      legalActions(this.st, this.db, seat as PlayerId).some((action) => action.type === 'castDarling'),
    ) as [boolean, boolean];
    return viewFor(this.st, player, castable);
  }

  clone(): Game {
    this.syncLegacyMutations();
    return Game.restore(structuredClone(this.st), this.db, this.startingHandSize);
  }

  static restore(
    state: GameState,
    db: CardDb,
    startingHandSize: number = RULES.startingHandSize,
  ): Game {
    validateRestoredReserveState(state, db);
    const g = Object.create(Game.prototype) as Game;
    Object.assign(g, {
      st: normalizeState(state),
      db,
      startingHandSize,
      eventObserver: undefined,
      buf: [],
      initialEvents: [],
    });
    return g;
  }

  /** Validate → apply → emit. Throws on illegal actions. */
  submit(player: PlayerId, action: Action): GameEvent[] {
    this.syncLegacyMutations();
    const err = validateAction(this.st, this.db, player, action);
    if (err) throw new Error(`Illegal action ${action.type} by P${player}: ${err}`);

    this.buf = [];
    const emit: Emit = (e) => {
      this.buf.push(e);
      this.eventObserver?.(e, this.st);
    };
    this.apply(player, action, emit);
    this.maybeRaiseDeferredDecision(emit);
    this.publicState = legacyState(this.st);
    return this.buf;
  }

  private syncLegacyMutations(): void {
    const pub = this.publicState;
    if (!pub) return;
    for (const p of [0, 1] as const) {
      const from = pub.players[p];
      const to = this.st.players[p];
      to.life = from.life;
      to.landDropsUsed = from.landDropsUsed;
      to.extraLandDrops = from.extraLandDrops;
      to.mulligans = from.mulligans;
      to.keptHand = from.keptHand;
      for (const zone of ['deck', 'hand', 'graveyard', 'severed'] as const) {
        const ids = from[zone];
        const current = to[zone];
        if (current.length !== ids.length || current.some((card, i) => cardIdOf(card) !== ids[i])) {
          to[zone] = ids.map((id, i) => {
            const existing = current[i];
            if (existing && cardIdOf(existing) === id && isCardInstance(existing)) return existing;
            return {
              instanceId: this.st.nextInstanceId!++,
              cardId: id,
              variantKey: null,
            };
          });
        }
      }
      if (from.landReserve !== undefined && to.landReserve !== undefined) {
        const ids = from.landReserve;
        const current = to.landReserve;
        if (current.length !== ids.length || current.some((card, i) => cardIdOf(card) !== ids[i])) {
          to.landReserve = ids.map((id, i) => {
            const existing = current[i];
            if (existing && cardIdOf(existing) === id && isCardInstance(existing)) return existing;
            return {
              instanceId: this.st.nextInstanceId!++,
              cardId: id,
              variantKey: null,
            };
          });
        }
      }
      if (from.darlingZone !== undefined && to.darlingZone !== undefined) {
        to.darlingTax = from.darlingTax ?? 0;
        if (from.darlingZone === null) {
          to.darlingZone = null;
        } else if (
          to.darlingZone === null ||
          cardIdOf(to.darlingZone) !== from.darlingZone ||
          !isCardInstance(to.darlingZone)
        ) {
          const card = {
            instanceId: this.st.nextInstanceId!++,
            cardId: from.darlingZone,
            variantKey: null,
          } satisfies CardInstance;
          to.darlingZone = card;
          to.darlingInstanceId = card.instanceId;
        }
      }
    }
    this.st.turn = pub.turn;
    this.st.startingPlayer = pub.startingPlayer;
    this.st.activePlayer = pub.activePlayer;
    if ((this.st.rulesRev ?? 1) >= 2) {
      this.st.episode = structuredClone(pub.episode ?? { resolvedSinceOffer: 0, reopensThisStep: 0 });
    }
    setStep(this.st, pub.step);
    this.st.stackClosed = pub.stackClosed;
    this.st.combat = structuredClone(pub.combat);
    this.st.fogThisTurn = pub.fogThisTurn;
    for (const key of ['creatureDiedThisTurn', 'sunsetPendingWindow', 'decisionResume'] as const) {
      if (pub[key] === undefined) delete this.st[key];
      else Object.assign(this.st, { [key]: structuredClone(pub[key]) });
    }
    this.st.pendingDecisions = structuredClone(pub.pendingDecisions);
    this.st.awaiting = normalizeAwaiting(pub.awaiting, this.st);
    this.st.winner = pub.winner;
    this.st.winReason = pub.winReason;
  }

  /** After an action fully resolves, surface any queued resolution-time choice. */
  private maybeRaiseDeferredDecision(emit: Emit): void {
    const st = this.st;
    if (st.winner !== null) return;
    // A live Hauntlink window stays open across the link/move actions taken
    // inside it; only passResponse hands control back here.
    if (st.awaiting.kind === 'hauntlinkWindow') return;
    const hadPending = st.pendingDecisions.length > 0;
    if (st.pendingDecisions.some(p => p.kind === 'discard' || p.kind === 'sacrifice' ||
      p.continuations !== undefined || (p.kind === 'chooseTarget' && p.triggerWhen !== undefined)) &&
      !st.stackClosed && (st.awaiting.kind === 'respond' || st.awaiting.kind === 'endStepWindow'))
      st.decisionResume ??= structuredClone(st.awaiting);
    while (st.pendingDecisions.length > 0) {
      // A held trigger goes first. With no payable link it would have resolved
      // inline before any queued choice was offered, so it is moved to the
      // head (its window reads the head) and what it raises still queues
      // behind the choices it overtook.
      const heldAt = st.pendingDecisions.findIndex((p) => p.kind === 'resolveTrigger');
      if (heldAt > 0) {
        const [held] = st.pendingDecisions.splice(heldAt, 1) as [HeldTrigger];
        held.movedAhead = (held.movedAhead ?? 0) + heldAt;
        st.pendingDecisions.unshift(held);
      }
      const next = st.pendingDecisions[0];
      if (next.kind === 'discard' || next.kind === 'sacrifice') {
        const count = next.kind === 'discard' ? Math.min(next.n, st.players[next.player].hand.length) :
          st.battlefield.filter(p => p.controller === next.player && isType(def(this.db, p.cardId), 'creature')).length;
        if (!count) {
          st.pendingDecisions.shift();
          this.resumeNewChoice(emit, next.continuations);
          continue;
        }
        st.awaiting = next.kind === 'discard'
          ? { kind: 'discardToHandSize', player: next.player, count, decision: 'discard' }
          : { kind: 'chooseTarget', player: next.player, sourceIid: next.sourceIid ?? -1, abilityIndex: 0, decision: 'sacrifice',
            targets: st.battlefield.filter(p => p.controller === next.player && isType(def(this.db, p.cardId), 'creature')).map(p => ({ kind: 'permanent', iid: p.iid })) };
        return;
      }
      if (next.kind === 'resolveTrigger') {
        // Offer the Hauntlink window to whoever has not had it yet and can
        // pay: the trigger's opponent first, then its controller.
        const candidate = ([opponentOf(next.controller), next.controller] as PlayerId[]).find(
          (p) => !next.offered.includes(p) && hasPayableHauntlinkAction(st, this.db, p),
        );
        if (candidate !== undefined) {
          next.offered.push(candidate);
          st.awaiting = { player: candidate, kind: 'hauntlinkWindow', over: { type: 'trigger', iid: next.sourceIid } };
          emit({ e: 'responseWindowOpened', player: candidate });
          return;
        }
        st.pendingDecisions.shift();
        const resolveTrigger = (): void => runOps(
          st,
          this.db,
          emit,
          {
            controller: next.controller,
            sourceCardId: next.sourceCardId,
            sourceIid: next.sourceIid,
            targets: next.targets,
            ...(next.targetSpecs === undefined ? {} : { targetSpecs: next.targetSpecs }),
            ...(next.newDecisionContext ? { newDecisionContext: true as const } : {}),
            ...(next.markTriggerDepth === undefined ? {} : { markTriggerDepth: next.markTriggerDepth }),
            ...(next.selfGraveExclusion === undefined ? {} : { selfGraveExclusion: next.selfGraveExclusion }),
          },
          next.ops,
        );
        if (isHeldDiesTrigger(next)) {
          this.resolveHeldDiesTrigger(next, resolveTrigger, emit);
        } else if (next.newDecisionContext || next.continuations) {
          this.resumeNewChoice(emit, next.continuations, resolveTrigger);
        } else {
          resolveTrigger();
          checkStateBased(st, this.db, emit);
        }
        if (st.winner !== null) return;
        // Held mid-flush, the trigger resolved where it would have inline.
        // With nothing else holding the flush, the flush carries on before
        // any plain choice raised along the way is offered (a Foresee, a
        // targeted arrival), exactly as it does with no payable link. An
        // empty queue is left to the end of this drain, which re-enters the
        // flush once; resuming here too would resume it twice.
        if (next.heldMidStep && st.stackClosed && st.pendingDecisions.length > 0 &&
          !st.pendingDecisions.some(holdsFlush)) {
          this.closeAndFlush(emit);
          if (st.winner !== null) return;
        }
        continue;
      }
      if (next.kind === 'foresee' && this.foreseeCards(next.player, next.n).length === 0) {
        st.pendingDecisions.shift();
        if (next.continuations) this.resumeNewChoice(emit, next.continuations, next.thenOps ? () => runOps(
          st, this.db, emit,
          { ...(next.thenContext ?? { controller: next.player, sourceCardId: 'foresee-continuation' }), targets: [] },
          next.thenOps!,
        ) : undefined);
        continue;
      }
      if (next.kind === 'chooseTarget') {
        const targets = enumerateTargets(this.st, this.db, next.player, next.spec, next.sourceIid);
        if (targets.length === 0) {
          // The target was legal when the trigger was queued, but an earlier
          // queued trigger may have moved or removed every target. Fizzle
          // without surfacing a mandatory choice or running the ops.
          st.pendingDecisions.shift();
          emit({ e: 'triggerFizzled', iid: next.sourceIid });
          if (next.continuations) this.resumeNewChoice(emit, next.continuations);
          continue;
        }
        st.awaiting = {
          player: next.player,
          kind: 'chooseTarget',
          sourceIid: next.sourceIid,
          abilityIndex: next.abilityIndex,
          targets,
        };
        break;
      }
      break;
    }
    const next = st.pendingDecisions[0];
    if (next?.kind === 'foresee') {
      st.awaiting = { player: next.player, kind: 'foresee', cards: this.foreseeCards(next.player, next.n) };
    } else if (next?.kind === 'chooseTarget') {
      // The chooseTarget awaiting was installed while draining the FIFO above.
      // Do not resume the interrupted phase until its mandatory action runs.
      return;
    } else if (hadPending || st.awaiting.kind === 'foresee' || st.awaiting.kind === 'chooseTarget' ||
      (st.awaiting.kind === 'discardToHandSize' && st.awaiting.decision === 'discard')) {
      // The queue is empty: either the last queued choice just resolved (the
      // apply leaves the awaiting stale), or every queued decision whiffed in
      // the drain above (adversarial review 2026-07-16: the dawn path never
      // pre-resumes, so an all-whiff drain — a dawn foresee whose deck was
      // emptied before it raised — used to strand the turn in 'dawn' forever;
      // `hadPending` makes the drain itself rejoin the flush point). The
      // resume re-derives from `st.step` and is idempotent on paths that
      // already resumed, e.g. closeAndFlush.
      if (st.stackClosed) this.closeAndFlush(emit);
      else if (st.decisionResume) {
        const resume = st.decisionResume;
        delete st.decisionResume;
        if (resume.kind === 'respond' && resume.offerAfterDecision) {
          this.openResponseWindow(resume.player, resume.over, emit);
        } else st.awaiting = resume;
      }
      else this.resumeAfterFlush(emit);
      // Resuming a suspended stack/response can itself stop at another new
      // choice. Raise that fresh queue now instead of leaving stale awaiting.
      if (st.pendingDecisions.length > 0) this.maybeRaiseDeferredDecision(emit);
    }
  }

  /**
   * Resolve a held dies trigger as it would have resolved inline with no
   * payable link (rules.md, Hauntlink). What it raises takes its place in the
   * queue: behind the choices it overtook, ahead of the ones queued after it.
   * The rest of the effect it paused carries on as that effect would have:
   * behind the newest choice the paused op raised (one this trigger just
   * raised, or one the op had queued ahead of it), or at once. A state-based
   * check follows, as after the item or batch the trigger was part of.
   */
  private resolveHeldDiesTrigger(held: HeldTrigger, resolveTrigger: () => void, emit: Emit): void {
    const st = this.st;
    const ahead = st.pendingDecisions.splice(0, held.movedAhead ?? 0);
    const later = st.pendingDecisions.splice(0);
    resolveTrigger();
    let aheadQueued = false;
    const [first, ...rest] = held.continuations ?? [];
    if (first?.heldTail) {
      const inFront = Math.min(first.regionAhead ?? 0, ahead.length);
      if (st.pendingDecisions.length > 0 || inFront > 0) {
        // The op's own earlier choices sit at the end of `ahead`.
        const raisedFrom = ahead.length - inFront;
        st.pendingDecisions.unshift(...ahead);
        aheadQueued = true;
        deferRemainingOps(st, first.context, first.ops, raisedFrom);
      } else {
        runOps(st, this.db, emit, first.context, first.ops);
      }
      // Frames queued behind the paused effect (a choice's own continuation)
      // follow it, as in resumeNewChoice.
      if (rest.length > 0) {
        // One of them may be an enclosing effect's paused ops (this trigger
        // was held inside a trigger held inside that effect). They too wait
        // behind the choices their own op queued ahead of this trigger.
        if (!aheadQueued && rest.some((frame) => frame.heldTail && (frame.regionAhead ?? 0) > 0)) {
          st.pendingDecisions.unshift(...ahead);
          aheadQueued = true;
        }
        const pending = st.pendingDecisions.at(-1);
        if (pending) pending.continuations = [...(pending.continuations ?? []), ...rest];
        else runContinuations(st, this.db, emit, rest);
      }
    } else if (held.continuations) {
      const pending = st.pendingDecisions.at(-1);
      if (pending) pending.continuations = [...(pending.continuations ?? []), ...held.continuations];
      else runContinuations(st, this.db, emit, held.continuations);
    }
    // With no payable link, the other held dies triggers of this batch would
    // have resolved back to back with this one, and the life check after them
    // all: a sweep's own life gain can still save its caster. Creatures still
    // die here, so the next window shows the board as it stands.
    const isHeldDies = (p: PendingDecision): boolean => p.kind === 'resolveTrigger' && isHeldDiesTrigger(p);
    const moreHeld = st.pendingDecisions.some(isHeldDies) || later.some(isHeldDies) || (!aheadQueued && ahead.some(isHeldDies));
    checkStateBased(st, this.db, emit, { deferPlayerLoss: moreHeld });
    if (held.heldMidStep) {
      for (const p of st.pendingDecisions) if (p.kind === 'resolveTrigger') p.heldMidStep = true;
    }
    // This trigger's one queue entry became `placed` entries. A held tail
    // further back whose op's earlier choices include this trigger counts
    // them, whichever frame it rides in.
    const placed = st.pendingDecisions.length - (aheadQueued ? ahead.length : 0);
    later.forEach((p, index) => {
      for (const tail of p.kind === 'resolveTrigger' ? p.continuations ?? [] : []) {
        if (tail.heldTail && (tail.regionAhead ?? 0) > index) tail.regionAhead = (tail.regionAhead ?? 0) + placed - 1;
      }
    });
    if (!aheadQueued) st.pendingDecisions.unshift(...ahead);
    st.pendingDecisions.push(...later);
  }

  private resumeNewChoice(emit: Emit, frames: readonly EffectContinuation[] = [], work?: () => void): void {
    const later = this.st.pendingDecisions.splice(0);
    work?.();
    const pending = this.st.pendingDecisions.at(-1);
    if (pending) pending.continuations = [...(pending.continuations ?? []), ...frames];
    else runContinuations(this.st, this.db, emit, frames);
    checkStateBased(this.st, this.db, emit);
    this.st.pendingDecisions.push(...later);
  }

  /**
   * Awaiting Foresee cards are top-first, matching the player-facing order.
   * A Foresee continuation suspends before its trailing ops mutate this deck.
   */
  private foreseeCards(player: PlayerId, n: number): CardEntry[] {
    if (n <= 0) return [];
    return this.st.players[player].deck.slice(-n).reverse();
  }

  // -------------------------------------------------------------------------
  // Action application
  // -------------------------------------------------------------------------

  private apply(player: PlayerId, action: Action, emit: Emit): void {
    const st = this.st;
    const me = st.players[player];

    switch (action.type) {
      case 'concede':
        endGame(st, emit, opponentOf(player), 'concede');
        return;

      case 'choosePlayDraw': {
        const startingPlayer = action.play ? player : opponentOf(player);
        st.startingPlayer = startingPlayer;
        st.activePlayer = startingPlayer;
        emit({ e: 'playDrawChosen', player, play: action.play });
        emit({ e: 'firstPlayerChosen', player: startingPlayer });
        for (const p of [0, 1] as const) {
          drawCards(st, emit, p, this.startingHandSize);
        }
        st.awaiting = { player: startingPlayer, kind: 'mulligan' };
        return;
      }

      case 'mulligan': {
        me.mulligans++;
        me.deck.push(...me.hand.splice(0));
        rngShuffle(st.rng, me.deck);
        drawCards(st, emit, player, this.startingHandSize);
        emit({ e: 'mulliganTaken', player, count: me.mulligans });
        // stay awaiting the same player's mulligan decision
        return;
      }

      case 'keepHand': {
        me.keptHand = true;
        emit({ e: 'handKept', player });
        // London: bottom one card per mulligan after the free first. Clamp to
        // the hand size so an (already capped) count can never exceed the cards
        // on hand — a defensive floor against the old unbounded soft-lock.
        const bottomCount = Math.min(me.hand.length, Math.max(0, me.mulligans - 1));
        if (bottomCount > 0) {
          st.awaiting = { player, kind: 'bottomCards', count: bottomCount };
        } else {
          this.nextMulliganOrStart(emit);
        }
        return;
      }

      case 'bottomCards': {
        const sorted = [...action.handIndices].sort((a, b) => b - a);
        const bottomed: CardEntry[] = [];
        for (const i of sorted) bottomed.push(...me.hand.splice(i, 1));
        // deck index 0 is the bottom
        me.deck.unshift(...bottomed);
        emit({ e: 'cardsBottomed', player, count: bottomed.length });
        this.nextMulliganOrStart(emit);
        return;
      }

      case 'foresee': {
        const awaiting = st.awaiting;
        const pending = st.pendingDecisions.shift();
        if (awaiting.kind !== 'foresee' || pending?.kind !== 'foresee') return;
        const bottom = new Set(action.bottomIndices);
        const bottomed = awaiting.cards.filter((_, i) => bottom.has(i));
        const kept = awaiting.cards.filter((_, i) => !bottom.has(i));
        const lib = me.deck;
        // Library is bottom-first while awaiting.cards is top-first. Rebuild
        // the viewed segment so both groups retain original top-to-bottom order.
        lib.splice(Math.max(0, lib.length - awaiting.cards.length), awaiting.cards.length);
        lib.unshift(...[...bottomed].reverse());
        lib.push(...[...kept].reverse());
        // Outcome summary for the presentation layer (history log). Carries
        // identities; the presenter redacts the non-local player's cards to
        // counts — see the `foresaw` comment in events.ts.
        emit({
          e: 'foresaw',
          player,
          kept: kept.map(cardIdOf),
          bottomed: bottomed.map(cardIdOf),
        });
        if (pending.continuations) {
          // A nested legacy Foresee may already own an inner tail. Resolve it
          // before appending the enclosing new observer's continuation.
          this.resumeNewChoice(emit, pending.continuations, pending.thenOps ? () => runOps(
            st, this.db, emit,
            { ...(pending.thenContext ?? { controller: pending.player, sourceCardId: 'foresee-continuation' }), targets: [] },
            pending.thenOps!,
          ) : undefined);
          return;
        }
        if (pending.thenOps) {
          // The chooser can be the opponent of the effect's controller.
          // Resume the target-free tail under its captured source context.
          runOps(
            st,
            this.db,
            emit,
            {
              ...(pending.thenContext ?? { controller: pending.player, sourceCardId: 'foresee-continuation' }),
              targets: [],
            },
            pending.thenOps,
          );
          checkStateBased(st, this.db, emit);
        }
        return;
      }

      case 'chooseTarget': {
        if (st.awaiting.kind !== 'chooseTarget') return;
        const pending = st.pendingDecisions[0];
        if (pending?.kind === 'sacrifice') {
          st.pendingDecisions.shift();
          this.resumeNewChoice(emit, pending.continuations, () => {
            const perm = action.target.kind === 'permanent' ? findPermanent(st, action.target.iid) : undefined;
            if (!perm) return;
            const observers = [...st.battlefield];
            if (destroyPermanent(st, this.db, perm, emit, (card, owner) => fireGraveyardTriggers(st, this.db, emit, card, owner)) && firesDiesForDestroy(st, this.db, perm))
              fireTriggers(st, this.db, emit, 'dies', perm, { observers, sacrifice: true });
          });
          return;
        }
        if (
          pending?.kind !== 'chooseTarget' ||
          pending.player !== player ||
          pending.sourceIid !== st.awaiting.sourceIid ||
          pending.abilityIndex !== st.awaiting.abilityIndex
        ) return;
        st.pendingDecisions.shift();
        // Revision 4: hold the ops back so Hauntlink windows can be offered
        // over the now-known target. Only when someone can actually pay a
        // link - otherwise the path below is byte-identical to revision 3.
        if ((st.rulesRev ?? 1) >= 4 && anyPayableHauntlink(st, this.db)) {
          const newTrigger = pending.triggerWhen !== undefined || pending.continuations !== undefined ||
            pending.spec.maxCost !== undefined || pending.spec.minAttack !== undefined || pending.spec.what === 'opponentCreature';
          st.pendingDecisions.unshift({
            kind: 'resolveTrigger',
            controller: pending.player,
            sourceIid: pending.sourceIid,
            sourceCardId: pending.sourceCardId,
            targets: [action.target],
            ops: pending.ops,
            offered: [],
            ...(newTrigger ? { targetSpecs: [pending.spec], newDecisionContext: true as const } : {}),
            ...(pending.continuations ? { continuations: pending.continuations } : {}),
          });
          return;
        }
        if (pending.triggerWhen !== undefined || pending.continuations) {
          this.resumeNewChoice(emit, pending.continuations, () => runOps(st, this.db, emit,
            { controller: pending.player, sourceCardId: pending.sourceCardId, sourceIid: pending.sourceIid,
              targets: [action.target], targetSpecs: [pending.spec] }, pending.ops));
          return;
        }
        runOps(
          st,
          this.db,
          emit,
          {
            controller: pending.player,
            sourceCardId: pending.sourceCardId,
            sourceIid: pending.sourceIid,
            targets: [action.target],
          },
          pending.ops,
        );
        // A deferred-target trigger resolves outside the stack flush, so it
        // gets no state-based check of its own. Without this a creature dealt
        // lethal damage here stayed on the battlefield, and in main 2 - past
        // the attackers-step check - cleanup zeroed the damage and it lived
        // (owner report 2026-09-04; tests/engine/deferredTriggerSba.test.ts).
        // Mirrors closeAndFlush, which checks after every resolved item; any
        // dies-trigger decisions this enqueues are raised by the drain in
        // submit() the same way.
        checkStateBased(st, this.db, emit);
        return;
      }

      case 'playLand': {
        const card = me.landReserve !== undefined
          ? me.landReserve.splice(action.reserveIndex!, 1)[0]
          : me.hand.splice(action.handIndex, 1)[0];
        const cardId = cardIdOf(card);
        const perm = enterBattlefield(st, this.db, card, player, () => {}, {
          tapped: me.landDropsUsed >= 1 ? true : undefined,
        });
        me.landDropsUsed++;
        emit({ e: 'landPlayed', player, iid: perm.iid, cardId });
        fireTriggers(st, this.db, emit, 'arrives', perm);
        return;
      }

      case 'skim': {
        const card = me.hand[action.handIndex];
        const cardId = cardIdOf(card);
        const d = def(this.db, card);
        const plan = action.manaPlan ?? solveMana(st, this.db, player, d.skim!.cost)!;
        for (const iid of plan) {
          const src = findPermanent(st, iid)!;
          src.tapped = true;
        }
        if (plan.length > 0) emit({ e: 'manaTapped', player, iids: plan });
        me.hand.splice(action.handIndex, 1);
        // Hand -> graveyard (Skim): this origin enables Whispers.
        const graveCard = freshGraveyardCard(st, this.db, card, player);
        me.graveyard.push(graveCard);
        fireGraveyardTriggers(st, this.db, emit, graveCard, player);
        emit({ e: 'skimmed', player, cardId });
        drawCards(st, emit, player, 1);
        return;
      }

      case 'preserveCard': {
        const card = me.graveyard[action.graveIndex];
        const cardId = cardIdOf(card);
        const d = def(this.db, card);
        const plan = action.manaPlan ?? solveMana(st, this.db, player, d.preserve!.cost)!;
        for (const iid of plan) findPermanent(st, iid)!.tapped = true;
        if (plan.length > 0) emit({ e: 'manaTapped', player, iids: plan });

        me.graveyard.splice(action.graveIndex, 1);
        if (isCardInstance(card)) delete card.whispersUntilDawnOf;
        me.severed.push(card);
        emit({ e: 'severed', player, cardId, from: 'graveyard' });
        emit({ e: 'preserved', player, cardId });

        // The severed physical card keeps its instance identity. Its token
        // copy gets a fresh identity while retaining the collectible's visual
        // variant and full CardDef, including arrival triggers.
        const perm = enterBattlefield(st, this.db, cardId, player, emit, {
          asToken: true,
          variantKey: variantKeyOf(card),
        });
        fireTriggers(st, this.db, emit, 'arrives', perm);
        return;
      }

      case 'activate': {
        const perm = findPermanent(st, action.iid)!;
        const definition = def(this.db, perm.cardId);
        const ability = activatedAbilitiesOf(definition)[action.abilityIndex ?? 0];
        const plan = action.manaPlan ?? (ability.cost.mana
          ? solveMana(st, this.db, player, ability.cost.mana)!
          : []);
        for (const iid of plan) findPermanent(st, iid)!.tapped = true;
        if (plan.length > 0) emit({ e: 'manaTapped', player, iids: plan });
        perm.tapped = true;
        emit({ e: 'activated', player, iid: perm.iid, cardId: perm.cardId,
          ...(Array.isArray(definition.activated) ? { abilityIndex: action.abilityIndex ?? 0 } : {}) });
        const specs = ability.targets ?? [];
        runOps(st, this.db, emit, {
          controller: player,
          sourceCardId: perm.cardId,
          sourceIid: perm.iid,
          targets: action.targets ?? [],
          ...(specs.some(s => s.exactly || s.maxCost !== undefined || s.minAttack !== undefined) ? { targetSpecs: specs } : {}),
          ...(specs.length === 1 && (specs[0].upTo !== undefined || specs[0].exactly !== undefined) ? { targetBatch: true } : {}),
        }, ability.ops);
        // Like deferred-target triggers, this off-stack path owns its SBA.
        // Whatever the ops queued (a Foresee, a targeted trigger, a held dies
        // trigger and the rest of the Duty behind it) is raised by the drain
        // in submit(), the queue a resolving spell uses.
        checkStateBased(st, this.db, emit);
        return;
      }

      case 'castSpell': {
        const isRetell = action.retell === true;
        const isHauntlinked = action.hauntlinked === true;
        const isWhispers = action.whispers === true;
        const fromGrave = isRetell || isWhispers;
        const sourceIndex = fromGrave ? action.graveIndex! : action.handIndex;
        const card = fromGrave ? me.graveyard[sourceIndex] : me.hand[sourceIndex];
        const cardId = cardIdOf(card);
        const d = def(this.db, card);
        const extra = action.x ?? 0;
        // Price against the pre-payment board, before any sacrificed static
        // source leaves. Enumeration, validation and payment share this cost.
        const cost = castCost(d, action.empowered === true, isRetell, isHauntlinked, {
          whispers: isWhispers, tithe: action.tithe, sacrifices: action.sacrifices, state: st, db: this.db,
        })!;
        const plan = action.manaPlan ?? solveMana(
          st,
          this.db,
          player,
          cost,
          isRetell || isHauntlinked || isWhispers ? 0 : extra,
        )!;
        for (const iid of plan) {
          const src = findPermanent(st, iid)!;
          src.tapped = true;
        }
        if (plan.length > 0) emit({ e: 'manaTapped', player, iids: plan });

        if (fromGrave) me.graveyard.splice(sourceIndex, 1);
        else me.hand.splice(sourceIndex, 1);

        // Rite and Tithe are paid before the spell reaches the stack. Snapshot in
        // battlefield order, remove every sacrifice, then fire their dies
        // triggers in that same order so no trigger observes a half-paid cost.
        if (d.rite || action.tithe) {
          const observers = [...st.battlefield];
          const sacrificeIids = new Set(action.sacrifices ?? []);
          const sacrifices = st.battlefield.filter((perm) => sacrificeIids.has(perm.iid));
          const fallen: typeof sacrifices = [];
          const graveyardEntries: { card: CardEntry; owner: PlayerId }[] = [];
          for (const perm of sacrifices) {
            if (destroyPermanent(
              st,
              this.db,
              perm,
              emit,
              (graveCard, owner) => graveyardEntries.push({ card: graveCard, owner }),
            ) && firesDiesForDestroy(st, this.db, perm)) {
              fallen.push(perm);
            }
          }
          for (const entry of graveyardEntries) {
            if (st.winner !== null) return;
            fireGraveyardTriggers(st, this.db, emit, entry.card, entry.owner);
          }
          for (const perm of fallen) {
            if (st.winner !== null) return;
            fireTriggers(st, this.db, emit, 'dies', perm, { observers, sacrifice: true });
          }
          if (st.winner !== null) return;
          // The payment is a mutation batch like any other, so it gets its
          // own state-based check before anyone is offered a window: a player
          // drained to 0 by a fodder's dies trigger loses here, and a
          // Hauntlink whose host was sacrificed goes with it.
          checkStateBased(st, this.db, emit);
          if (st.winner !== null) return;
        }

        const item: StackItem = {
          sid: st.nextSid++,
          instanceId: isCardInstance(card) ? card.instanceId : st.nextInstanceId!,
          cardId,
          variantKey: isCardInstance(card) ? card.variantKey : null,
          controller: player,
          targets: action.targets ?? [],
          x: action.x,
          ...(action.empowered ? { empowered: true } : {}),
          ...(isRetell ? { retell: true } : {}),
          ...(isWhispers ? { whispered: true } : {}),
          ...(isHauntlinked ? { hauntlinked: true } : {}),
        };
        st.stack.push(item);
        emit({
          e: 'spellCast',
          sid: item.sid,
          cardId,
          controller: player,
          targets: item.targets,
          ...(isHauntlinked ? { hauntlinked: true } : {}),
        });
        if (isType(d, 'charm')) firePlayerObservers(st, this.db, emit, 'youCastCharm', player);
        if (isWhispers) emit({ e: 'whispered', player, cardId });
        this.openResponseWindow(opponentOf(player), { type: 'spell', sid: item.sid }, emit);
        return;
      }

      case 'linkHaunt': {
        const link = findPermanent(st, action.iid)!;
        const host = findPermanent(st, action.hostIid)!;
        const d = def(this.db, link.cardId);
        const plan = action.manaPlan ?? solveMana(st, this.db, player, d.hauntlink!.cost)!;
        for (const iid of plan) findPermanent(st, iid)!.tapped = true;
        if (plan.length > 0) emit({ e: 'manaTapped', player, iids: plan });
        const previousHost = attachPermanent(st, link, host);
        if (previousHost !== undefined) {
          emit({
            e: 'hauntlinkBroken',
            linkIid: link.iid,
            hostIid: previousHost,
            cardId: link.cardId,
            owner: link.owner,
            unlinked: true,
          });
        }
        emit({
          e: 'hauntlinkFormed',
          linkIid: link.iid,
          hostIid: host.iid,
          cardId: link.cardId,
          controller: link.controller,
        });
        return;
      }

      case 'castDarling': {
        const card = me.darlingZone!;
        const cardId = cardIdOf(card);
        const d = def(this.db, card);
        const extra = action.x ?? 0;
        const cost = darlingCastCost(d, me.darlingTax ?? 0)!;
        const plan = action.manaPlan ?? solveMana(st, this.db, player, cost, extra)!;
        for (const iid of plan) {
          findPermanent(st, iid)!.tapped = true;
        }
        if (plan.length > 0) emit({ e: 'manaTapped', player, iids: plan });

        me.darlingZone = null;
        const item: StackItem = {
          sid: st.nextSid++,
          instanceId: isCardInstance(card) ? card.instanceId : st.nextInstanceId!++,
          cardId,
          variantKey: isCardInstance(card) ? card.variantKey : null,
          controller: player,
          targets: action.targets ?? [],
          ...(action.x === undefined ? {} : { x: action.x }),
        };
        st.stack.push(item);
        emit({ e: 'spellCast', sid: item.sid, cardId, controller: player, targets: item.targets, fromDarlingZone: true });
        this.openResponseWindow(opponentOf(player), { type: 'spell', sid: item.sid }, emit);
        return;
      }

      case 'payDownDarlingTax': {
        const cost = { generic: DARLING_PAYDOWN_COST, pips: {} };
        const plan = action.manaPlan ?? solveMana(st, this.db, player, cost)!;
        for (const iid of plan) {
          findPermanent(st, iid)!.tapped = true;
        }
        if (plan.length > 0) emit({ e: 'manaTapped', player, iids: plan });
        me.darlingTax = Math.max(0, (me.darlingTax ?? 0) - DARLING_PAYDOWN_REDUCTION);
        emit({ e: 'darlingTaxPaidDown', player, tax: me.darlingTax });
        return;
      }

      case 'declareAttackers': {
        if (action.attackers.length === 0) {
          // [] skips combat entirely — no windows open.
          st.combat = null;
          setStep(st, 'main2', emit);
          st.awaiting = { player: st.activePlayer, kind: 'main' };
          return;
        }
        for (const iid of action.attackers) {
          const perm = findPermanent(st, iid)!;
          if (!getEffectiveStats(st.battlefield, this.db, iid).keywords.has('sentinel')) {
            perm.tapped = true;
          }
        }
        st.combat = {
          attackers: [...action.attackers],
          blocks: [],
          phase: 'attackersDeclared',
          damagePrevented: false,
        };
        emit({ e: 'attackersDeclared', iids: [...action.attackers] });
        for (const iid of action.attackers) {
          const perm = findPermanent(st, iid);
          if (perm) {
            fireTriggers(st, this.db, emit, 'attacks', perm);
            fireMarkedAllyAttackTriggers(st, this.db, emit, perm);
            fireCreatureObservers(st, this.db, emit, 'allyAttacks', perm);
          }
        }
        checkStateBased(st, this.db, emit);
        if (st.winner !== null) return;
        this.openResponseWindow(opponentOf(player), { type: 'attackers' }, emit);
        return;
      }

      case 'declareBlockers': {
        const combat = st.combat!;
        combat.blocks = action.blocks.map((b) => ({ ...b }));
        combat.phase = 'blockersDeclared';
        emit({ e: 'blockersDeclared', blocks: combat.blocks.map((b) => ({ ...b })) });
        this.openResponseWindow(opponentOf(player), { type: 'blockers' }, emit);
        return;
      }

      case 'passResponse': {
        if (st.awaiting.kind === 'hauntlinkWindow') {
          if (st.awaiting.over.type === 'combatDamage') {
            const combat = st.combat!;
            combat.hauntlinkPassed = [...(combat.hauntlinkPassed ?? []), player];
            this.resumeAfterFlush(emit); // re-enters the combat branch: next player, or damage
          } else {
            // Trigger window: hand control back to the drain in submit(), which
            // offers the next player or resolves the held trigger.
            st.awaiting = { player: st.activePlayer, kind: 'main' };
          }
          return;
        }
        if (st.awaiting.kind === 'endStepWindow') {
          enterCleanup(st, this.db, emit);
        } else {
          this.closeAndFlush(emit);
        }
        return;
      }

      case 'passStep': {
        if (st.step === 'main1') {
          setStep(st, 'combat', emit);
          st.awaiting = { player: st.activePlayer, kind: 'declareAttackers' };
        } else {
          enterEndStep(st, this.db, emit);
        }
        return;
      }

      case 'discard': {
        const pending = st.awaiting.kind === 'discardToHandSize' && st.awaiting.decision === 'discard' ? st.pendingDecisions.shift() : undefined;
        const discard = (): void => {
          const sorted = [...action.handIndices].sort((a, b) => b - a);
          for (const i of sorted) {
            const [card] = me.hand.splice(i, 1);
            // Hand -> graveyard: both cleanup and loot enable Whispers.
            const graveCard = freshGraveyardCard(st, this.db, card, player);
            me.graveyard.push(graveCard);
            fireGraveyardTriggers(st, this.db, emit, graveCard, player);
            emit({ e: 'discarded', player, cardId: cardIdOf(card) });
          }
        };
        if (pending?.kind === 'discard') this.resumeNewChoice(emit, pending.continuations, discard);
        else {
          discard();
          finishCleanup(st, this.db, emit);
        }
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Stack / response-window machinery
  // -------------------------------------------------------------------------

  /**
   * Offer `responder` a window over the just-announced item. Auto-passes when
   * they have no castable instant (Arena-style; saves clicks and AI calls).
   */
  private openResponseWindow(
    responder: PlayerId,
    over: Extract<Awaiting, { kind: 'respond' }>['over'],
    emit: Emit,
  ): void {
    // Any choice the cast or the attack raised is settled first, whatever the
    // responder holds (owner ruling 2026-09-25, as in Magic): a Rite or Tithe
    // fodder whose dies trigger returns a creature that targets or Foresees,
    // an attack trigger's Foresee. The order never depends on the responder's
    // hand, and a window offered now would have been replaced by the choice,
    // stranding the spell on the stack.
    if (this.st.pendingDecisions.length > 0) {
      // No window has been offered yet. Complete cast/attack observers first,
      // then recalculate whether the responder still has a playable Charm.
      // A held revision-4 trigger counts: a Rite or Tithe sacrifice can hold
      // its fodder's dies trigger for a Hauntlink window first.
      this.st.decisionResume = { player: responder, kind: 'respond', over, offerAfterDecision: true };
      return;
    }
    if (hasCastableInstant(this.st, this.db, responder)) {
      if ((this.st.rulesRev ?? 1) >= 2 && this.st.episode) {
        this.st.episode.resolvedSinceOffer = 0;
      }
      this.st.awaiting = { player: responder, kind: 'respond', over };
      emit({ e: 'responseWindowOpened', player: responder });
    } else {
      this.closeAndFlush(emit);
    }
  }

  /** First pass closes the episode: resolve the whole stack LIFO, no more windows. */
  private closeAndFlush(emit: Emit): void {
    const st = this.st;
    st.stackClosed = true;
    while (st.stack.length > 0 && st.winner === null) {
      const item = st.stack.pop()!;
      resolveStackItem(st, this.db, item, emit);
      if ((st.rulesRev ?? 1) >= 2 && st.episode) st.episode.resolvedSinceOffer++;
      checkStateBased(st, this.db, emit);
      // A held revision-4 trigger (raised by this item or by the check after
      // it) resolves before the next item, as it would have inline with no
      // payable link; the drain in submit() re-enters this flush afterwards.
      if (st.pendingDecisions.some(holdsFlush)) {
        for (const p of st.pendingDecisions) if (p.kind === 'resolveTrigger') p.heldMidStep = true;
        return;
      }
    }
    st.stackClosed = false;
    if (st.winner === null) this.resumeAfterFlush(emit);
  }

  /** Where play continues after a stack episode, derived from step + combat. */
  private resumeAfterFlush(emit: Emit): void {
    const st = this.st;
    switch (st.step) {
      case 'main1':
      case 'main2':
        st.awaiting = { player: st.activePlayer, kind: 'main' };
        return;
      case 'dawn':
        finishDawn(st, emit);
        return;
      case 'end':
        if (st.sunsetPendingWindow && st.pendingDecisions.length === 0) { resumeSunsetWindow(st, this.db, emit); return; }
        if ((st.rulesRev ?? 1) >= 2 && st.pendingDecisions.length > 0) return;
        if (this.maybeReopenWindow(
          opponentOf(st.activePlayer),
          { player: opponentOf(st.activePlayer), kind: 'endStepWindow' },
          emit,
        )) return;
        enterCleanup(st, this.db, emit);
        return;
      case 'cleanup':
        // A deferred decision (a foresee or land fetch resolved out of the
        // end-step window's stack) was raised OVER the cleanup discard
        // prompt; rejoin cleanup, which re-raises the discard or ends the
        // turn. Found by the 2026-07-16 prefab mass-sim (seed 4000600333).
        resumeCleanup(st, this.db, emit);
        return;
      case 'combat': {
        const combat = st.combat;
        if (!combat) {
          // Attackers were all removed mid-window; combat dissolves.
          setStep(st, 'main2', emit);
          st.awaiting = { player: st.activePlayer, kind: 'main' };
          return;
        }
        if (combat.phase === 'attackersDeclared') {
          if ((st.rulesRev ?? 1) >= 2 && st.pendingDecisions.length > 0) return;
          if (this.maybeReopenWindow(
            opponentOf(st.activePlayer),
            { player: opponentOf(st.activePlayer), kind: 'respond', over: { type: 'attackers' } },
            emit,
          )) return;
          st.awaiting = { player: opponentOf(st.activePlayer), kind: 'declareBlockers' };
          return;
        }
        // blockersDeclared → damage
        if ((st.rulesRev ?? 1) >= 2 && st.pendingDecisions.length > 0) return;
        if (this.maybeReopenWindow(
          opponentOf(st.activePlayer),
          { player: opponentOf(st.activePlayer), kind: 'respond', over: { type: 'blockers' } },
          emit,
        )) return;
        // Revision 4: the Hauntlink window at the combat damage step. Defender
        // first, then attacker; each only if they can pay a link.
        if ((st.rulesRev ?? 1) >= 4) {
          const passed = combat.hauntlinkPassed ?? [];
          const next = ([opponentOf(st.activePlayer), st.activePlayer] as PlayerId[]).find(
            (p) => !passed.includes(p) && hasPayableHauntlinkAction(st, this.db, p),
          );
          if (next !== undefined) {
            st.awaiting = { player: next, kind: 'hauntlinkWindow', over: { type: 'combatDamage' } };
            emit({ e: 'responseWindowOpened', player: next });
            return;
          }
        }
        resolveCombatDamage(st, this.db, emit);
        if (st.winner !== null) return;
        st.combat = null;
        setStep(st, 'main2', emit);
        st.awaiting = { player: st.activePlayer, kind: 'main' };
        return;
      }
      default:
        throw new Error(`resumeAfterFlush: unexpected step ${st.step}`);
    }
  }

  /** Offer one paid revision-2 reopen, or return false to continue the step. */
  private maybeReopenWindow(
    player: PlayerId,
    awaiting: Extract<Awaiting, { kind: 'respond' | 'endStepWindow' }>,
    emit: Emit,
  ): boolean {
    const st = this.st;
    if ((st.rulesRev ?? 1) < 2 || !st.episode) return false;
    if (st.episode.resolvedSinceOffer <= 0) return false;
    if (st.episode.reopensThisStep >= RULES.maxWindowReopensPerStep) return false;
    if (!hasCastableCharm(st, this.db, player)) return false;
    st.episode.resolvedSinceOffer = 0;
    st.episode.reopensThisStep++;
    st.awaiting = awaiting;
    emit({ e: 'responseWindowOpened', player, reopened: true });
    return true;
  }

  // -------------------------------------------------------------------------
  // Mulligan sequencing: starting player decides first, then the other.
  // -------------------------------------------------------------------------

  private nextMulliganOrStart(emit: Emit): void {
    const st = this.st;
    const other = opponentOf(st.startingPlayer);
    if (!st.players[st.startingPlayer].keptHand) {
      st.awaiting = { player: st.startingPlayer, kind: 'mulligan' };
    } else if (!st.players[other].keptHand) {
      st.awaiting = { player: other, kind: 'mulligan' };
    } else {
      st.turn = 1;
      st.activePlayer = st.startingPlayer;
      startTurn(st, this.db, emit);
    }
  }
}

function legacyAwaiting(awaiting: Awaiting): LegacyAwaiting {
  if (awaiting.kind !== 'foresee') return structuredClone(awaiting) as LegacyAwaiting;
  return { ...awaiting, cards: awaiting.cards.map(cardIdOf) };
}

function normalizeAwaiting(awaiting: LegacyAwaiting, state: GameState): Awaiting {
  if (awaiting.kind === 'chooseTarget') {
    return { ...structuredClone(awaiting), abilityIndex: awaiting.abilityIndex ?? 0 };
  }
  if (awaiting.kind !== 'foresee') return structuredClone(awaiting);
  return {
    ...awaiting,
    cards: state.players[awaiting.player].deck.slice(-awaiting.cards.length).reverse(),
  };
}

function legacyState(state: GameState): LegacyGameState {
  const rest = structuredClone(state) as LegacyGameState;
  delete rest.nextInstanceId;
  const players = state.players.map((player) => {
    const legacy = {
      ...player,
      deck: player.deck.map(cardIdOf),
      hand: player.hand.map(cardIdOf),
      graveyard: player.graveyard.map(cardIdOf),
      severed: player.severed.map(cardIdOf),
    } as LegacyGameState['players'][0];
    if (player.landReserve !== undefined) {
      legacy.landReserve = player.landReserve.map(cardIdOf);
    }
    if (player.darlingZone !== undefined) {
      legacy.darlingZone = player.darlingZone === null ? null : cardIdOf(player.darlingZone);
    }
    return legacy;
  }) as [LegacyGameState['players'][0], LegacyGameState['players'][1]];
  return {
    ...rest,
    players,
    // Battlefield and stack are public zones, so their physical identity is
    // retained in the compatibility projection. Hidden player zones below
    // remain card-id-only.
    battlefield: structuredClone(state.battlefield),
    stack: structuredClone(state.stack),
    awaiting: legacyAwaiting(state.awaiting),
  };
}

/** Normalize every compatibility string[] boundary into physical instances. */
function normalizeState(input: GameState): GameState {
  const state = structuredClone(input) as GameState;
  if ((state.rulesRev ?? 1) >= 2) {
    state.episode ??= { resolvedSinceOffer: 0, reopensThisStep: 0 };
  } else {
    delete state.rulesRev;
    delete state.episode;
  }
  const used = new Set<number>();
  let maxId = 0;
  for (const player of state.players) {
    for (const zone of [
      player.deck,
      player.hand,
      player.graveyard,
      player.severed,
      ...(player.landReserve === undefined ? [] : [player.landReserve]),
      ...(player.darlingZone === undefined || player.darlingZone === null ? [] : [[player.darlingZone]]),
    ]) {
      for (const card of zone) {
        if (isCardInstance(card)) {
          maxId = Math.max(maxId, card.instanceId);
        }
      }
    }
  }
  for (const perm of state.battlefield) {
    if (perm.instanceId !== undefined) {
      used.add(perm.instanceId);
      maxId = Math.max(maxId, perm.instanceId);
    }
  }
  for (const item of state.stack) {
    if (item.instanceId !== undefined) {
      used.add(item.instanceId);
      maxId = Math.max(maxId, item.instanceId);
    }
  }

  let next = Math.max(state.nextInstanceId ?? 1, maxId + 1);
  const freshId = (): number => {
    while (used.has(next)) next++;
    const id = next++;
    used.add(id);
    return id;
  };
  const normalizeCard = (card: CardEntry): CardInstance => {
    if (isCardInstance(card) && !used.has(card.instanceId)) {
      used.add(card.instanceId);
      return { ...card, variantKey: card.variantKey ?? null };
    }
    if (isCardInstance(card)) {
      return { ...card, instanceId: freshId(), variantKey: card.variantKey ?? null };
    }
    return { instanceId: freshId(), cardId: card, variantKey: null };
  };

  for (const player of state.players) {
    player.deck = player.deck.map(normalizeCard);
    player.hand = player.hand.map(normalizeCard);
    player.graveyard = player.graveyard.map(normalizeCard);
    player.severed = player.severed.map(normalizeCard);
    if (player.landReserve !== undefined) player.landReserve = player.landReserve.map(normalizeCard);
    if (player.darlingZone !== undefined) {
      player.darlingZone = player.darlingZone === null ? null : normalizeCard(player.darlingZone);
      player.darlingTax ??= 0;
      if (player.darlingZone !== null) player.darlingInstanceId = player.darlingZone.instanceId;
    }
  }
  for (const perm of state.battlefield) {
    perm.instanceId ??= freshId();
    perm.variantKey ??= null;
    perm.severBranded ??= false;
  }
  for (const item of state.stack) {
    item.instanceId ??= freshId();
    item.variantKey ??= null;
  }
  if (state.awaiting.kind === 'foresee') {
    // A hand-built legacy snapshot has only card IDs here. Rebind it to the
    // corresponding normalized top-of-deck instances before the choice moves
    // those cards, preserving identity through the decision snapshot.
    const deck = state.players[state.awaiting.player].deck;
    state.awaiting.cards = deck.slice(-state.awaiting.cards.length).reverse();
  }
  state.nextInstanceId = next;
  return state;
}
