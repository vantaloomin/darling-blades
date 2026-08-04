import {
  DARLING_PAYDOWN_COST,
  DARLING_PAYDOWN_REDUCTION,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS_IN_RESERVE,
  RULES,
  type GameFormat,
  usesLandReserve,
} from '../config/rules';
import type { Action } from './actions';
import { darlingCastCost, legalActions, validateAction } from './actions';
import { hasCastableInstant } from './actions';
import { resolveCombatDamage } from './combat/damage';
import { fireTriggers, runOps } from './effects/EffectInterpreter';
import type { GameEvent } from './events';
import { combineManaCosts, solveMana } from './mana';
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
  PlayerId,
  StackItem,
} from './types';
import { cardIdOf, def, findPermanent, isCardInstance, opponentOf } from './types';
import type { PlayerView } from './view';
import { viewFor } from './view';

export interface GameConfig {
  decks: [CardEntry[], CardEntry[]];
  seed: number;
  db: CardDb;
  /** Classic is the default. Warchest and Darlings use ordered land reserves. */
  format?: GameFormat;
  /** One ordered ten-land payload per seat for reserve formats. */
  landReserves?: [CardEntry[], CardEntry[]];
  /** One public command-zone Darling per seat (or null for no assigned Darling). */
  darlings?: [string | null, string | null];
  /** Opt into the pre-deal coin-flip winner's play/draw decision. */
  playDrawChoice?: boolean;
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
  private buf: GameEvent[] = [];
  /** Legacy state facade retained so existing callers can make scalar edits before submit. */
  private publicState?: LegacyGameState;
  /** Events produced during construction; opted-in opening draws occur after the choice. */
  readonly initialEvents: GameEvent[] = [];

  constructor(cfg: GameConfig) {
    this.db = cfg.db;
    const rng = createRngState(cfg.seed);

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

    const emit: Emit = (e) => this.initialEvents.push(e);
    if (cfg.playDrawChoice) {
      // The call/reveal happens before either player sees an opening hand.
      // Dealing moves to choosePlayDraw below; drawCards consumes no RNG, so
      // the seeded winner and post-choice RNG stream stay unchanged.
      emit({ e: 'coinFlipped', winner: startingPlayer });
    } else {
      emit({ e: 'firstPlayerChosen', player: startingPlayer });
      for (const p of [0, 1] as const) {
        drawCards(this.st, emit, p, RULES.startingHandSize);
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
      landPlayedThisTurn: false,
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
    return Game.restore(structuredClone(this.st), this.db);
  }

  static restore(state: GameState, db: CardDb): Game {
    validateRestoredReserveState(state, db);
    const g = Object.create(Game.prototype) as Game;
    Object.assign(g, { st: normalizeState(state), db, buf: [], initialEvents: [] });
    return g;
  }

  /** Validate → apply → emit. Throws on illegal actions. */
  submit(player: PlayerId, action: Action): GameEvent[] {
    this.syncLegacyMutations();
    const err = validateAction(this.st, this.db, player, action);
    if (err) throw new Error(`Illegal action ${action.type} by P${player}: ${err}`);

    this.buf = [];
    const emit: Emit = (e) => this.buf.push(e);
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
      to.landPlayedThisTurn = from.landPlayedThisTurn;
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
    this.st.step = pub.step;
    this.st.stackClosed = pub.stackClosed;
    this.st.combat = structuredClone(pub.combat);
    this.st.fogThisTurn = pub.fogThisTurn;
    this.st.pendingDecisions = structuredClone(pub.pendingDecisions);
    this.st.awaiting = normalizeAwaiting(pub.awaiting, this.st);
    this.st.winner = pub.winner;
    this.st.winReason = pub.winReason;
  }

  /**
   * After an action fully resolves, drive any fetchLand basic-land choices that
   * were deferred (>1 distinct type — see EffectInterpreter `fetchLand`):
   * override the just-computed awaiting with the choice, or, once the queue
   * drains, resume normal play.
   *
   * PRECONDITION (currently guaranteed): every fetchLand source is cast at
   * sorcery speed, so the chooser is always the active player mid-main and
   * `resumeAfterFlush` lands back on `main`. An instant-speed / flash / attacks-
   * or dies-triggered fetch would break that and MUST NOT be added without
   * revisiting the resume path. No-op in determinized sims (stand-in lands
   * aren't `basic`, so nothing ever queues).
   */
  private maybeRaiseDeferredDecision(emit: Emit): void {
    const st = this.st;
    if (st.winner !== null) return;
    // Skip any queued fetch whose deck no longer holds a basic (a whiff — same
    // as the interpreter's no-basic no-op). Guarantees a raised choice always
    // has ≥1 legal option, so the AI is never handed only `concede` and the
    // human never gets a zero-option overlay.
    const hadPending = st.pendingDecisions.length > 0;
    while (st.pendingDecisions.length > 0) {
      const next = st.pendingDecisions[0];
      if (next.kind === 'chooseBasicLand' && !this.hasFetchableBasic(next.player)) {
        st.pendingDecisions.shift();
        continue;
      }
      if (next.kind === 'foresee' && this.foreseeCards(next.player, next.n).length === 0) {
        st.pendingDecisions.shift();
        continue;
      }
      break;
    }
    const next = st.pendingDecisions[0];
    if (next?.kind === 'chooseBasicLand') {
      st.awaiting = { player: next.player, kind: 'chooseBasicLand' };
    } else if (next?.kind === 'foresee') {
      st.awaiting = { player: next.player, kind: 'foresee', cards: this.foreseeCards(next.player, next.n) };
    } else if (hadPending || st.awaiting.kind === 'chooseBasicLand' || st.awaiting.kind === 'foresee') {
      // The queue is empty: either the last queued choice just resolved (the
      // apply leaves the awaiting stale), or every queued decision whiffed in
      // the drain above (adversarial review 2026-07-16: the dawn path never
      // pre-resumes, so an all-whiff drain — a dawn foresee whose deck was
      // emptied before it raised — used to strand the turn in 'dawn' forever;
      // `hadPending` makes the drain itself rejoin the flush point). The
      // resume re-derives from `st.step` and is idempotent on paths that
      // already resumed, e.g. closeAndFlush.
      this.resumeAfterFlush(emit);
    }
  }

  private hasFetchableBasic(player: PlayerId): boolean {
    return this.st.players[player].deck.some((card) =>
      def(this.db, card).supertypes?.includes('basic'),
    );
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
          drawCards(st, emit, p, RULES.startingHandSize);
        }
        st.awaiting = { player: startingPlayer, kind: 'mulligan' };
        return;
      }

      case 'mulligan': {
        me.mulligans++;
        me.deck.push(...me.hand.splice(0));
        rngShuffle(st.rng, me.deck);
        drawCards(st, emit, player, RULES.startingHandSize);
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

      case 'chooseBasicLand': {
        // Perform the fetch the interpreter deferred: pull the chosen basic from
        // the controller's deck, put it onto the battlefield tapped, reshuffle —
        // same net effect + RNG use as the inline single-type path, just after a
        // player decision. See EffectInterpreter `fetchLand` + pendingDecisions.
        const pending = st.pendingDecisions.shift();
        if (pending?.kind === 'chooseBasicLand') {
          const controller = pending.player;
          const lib = st.players[controller].deck;
          let idx = -1;
          for (let i = lib.length - 1; i >= 0; i--) {
            if (cardIdOf(lib[i]) === action.cardId) {
              idx = i;
              break;
            }
          }
          if (idx >= 0) {
            const [card] = lib.splice(idx, 1);
            const perm = enterBattlefield(st, this.db, card, controller, emit);
            perm.tapped = true;
            rngShuffle(st.rng, lib);
          }
        }
        // maybeRaiseDeferredDecision (post-apply) raises the next queued choice, or
        // resumes normal play once the queue drains — including whiffs.
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
        if (pending.thenOps) {
          // The deferred entry stores only the controller. Tail ops were
          // asserted target-free when stashed, so they cannot need cast-time
          // targets or a source permanent while this action resumes them.
          runOps(
            st,
            this.db,
            emit,
            { controller: pending.player, sourceCardId: 'foresee-continuation', targets: [] },
            pending.thenOps,
          );
        }
        return;
      }

      case 'playLand': {
        const card = me.landReserve !== undefined
          ? me.landReserve.splice(action.reserveIndex!, 1)[0]
          : me.hand.splice(action.handIndex, 1)[0];
        const cardId = cardIdOf(card);
        const perm = enterBattlefield(st, this.db, card, player, () => {});
        me.landPlayedThisTurn = true;
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
        me.graveyard.push(card);
        emit({ e: 'skimmed', player, cardId });
        drawCards(st, emit, player, 1);
        return;
      }

      case 'castSpell': {
        const isRetell = action.retell === true;
        const isHauntlinked = action.hauntlinked === true;
        const sourceIndex = isRetell ? action.graveIndex! : action.handIndex;
        const card = isRetell ? me.graveyard[sourceIndex] : me.hand[sourceIndex];
        const cardId = cardIdOf(card);
        const d = def(this.db, card);
        const extra = action.x ?? 0;
        // Retell replaces the printed cost. Empower is an additional cost on a
        // normal cast (validateAction rejects X+empower and Retell+Empower).
        const cost =
          isHauntlinked
            ? d.hauntlink!.cost
            : isRetell
            ? d.retell!.cost
            : action.empowered && d.empower
              ? combineManaCosts(d.cost!, d.empower.cost)
              : d.cost!;
        const plan = action.manaPlan ?? solveMana(
          st,
          this.db,
          player,
          cost,
          isRetell || isHauntlinked ? 0 : extra,
        )!;
        for (const iid of plan) {
          const src = findPermanent(st, iid)!;
          src.tapped = true;
        }
        if (plan.length > 0) emit({ e: 'manaTapped', player, iids: plan });

        if (isRetell) me.graveyard.splice(sourceIndex, 1);
        else me.hand.splice(sourceIndex, 1);
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
        this.openResponseWindow(opponentOf(player), { type: 'spell', sid: item.sid }, emit);
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
          st.step = 'main2';
          emit({ e: 'stepChanged', step: 'main2' });
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
          if (perm) fireTriggers(st, this.db, emit, 'attacks', perm);
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
        if (st.awaiting.kind === 'endStepWindow') {
          enterCleanup(st, this.db, emit);
        } else {
          this.closeAndFlush(emit);
        }
        return;
      }

      case 'passStep': {
        if (st.step === 'main1') {
          st.step = 'combat';
          emit({ e: 'stepChanged', step: 'combat' });
          st.awaiting = { player: st.activePlayer, kind: 'declareAttackers' };
        } else {
          enterEndStep(st, this.db, emit);
        }
        return;
      }

      case 'discard': {
        const sorted = [...action.handIndices].sort((a, b) => b - a);
        for (const i of sorted) {
          const [card] = me.hand.splice(i, 1);
          me.graveyard.push(card);
          emit({ e: 'discarded', player, cardId: cardIdOf(card) });
        }
        finishCleanup(st, this.db, emit);
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
    if (hasCastableInstant(this.st, this.db, responder)) {
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
      checkStateBased(st, this.db, emit);
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
        // The single end-step window has been used.
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
          st.step = 'main2';
          emit({ e: 'stepChanged', step: 'main2' });
          st.awaiting = { player: st.activePlayer, kind: 'main' };
          return;
        }
        if (combat.phase === 'attackersDeclared') {
          st.awaiting = { player: opponentOf(st.activePlayer), kind: 'declareBlockers' };
          return;
        }
        // blockersDeclared → damage
        resolveCombatDamage(st, this.db, emit);
        if (st.winner !== null) return;
        st.combat = null;
        st.step = 'main2';
        emit({ e: 'stepChanged', step: 'main2' });
        st.awaiting = { player: st.activePlayer, kind: 'main' };
        return;
      }
      default:
        throw new Error(`resumeAfterFlush: unexpected step ${st.step}`);
    }
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
