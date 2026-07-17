import { RULES } from '../config/rules';
import type { Action } from './actions';
import { legalActions, validateAction } from './actions';
import { hasCastableInstant } from './actions';
import { resolveCombatDamage } from './combat/damage';
import { fireTriggers } from './effects/EffectInterpreter';
import type { GameEvent } from './events';
import { solveMana } from './mana';
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
  CardDb,
  GameState,
  PlayerId,
  StackItem,
} from './types';
import { def, findPermanent, opponentOf } from './types';
import type { PlayerView } from './view';
import { viewFor } from './view';

export interface GameConfig {
  decks: [string[], string[]];
  seed: number;
  db: CardDb;
  /** Opt into the pre-mulligan coin-flip winner's play/draw decision. */
  playDrawChoice?: boolean;
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
  /** Events produced by setup (shuffles, opening hands, first-player roll). */
  readonly initialEvents: GameEvent[] = [];

  constructor(cfg: GameConfig) {
    this.db = cfg.db;
    const rng = createRngState(cfg.seed);

    const libraries = cfg.decks.map((deck) => rngShuffle(rng, [...deck])) as [
      string[],
      string[],
    ];
    const startingPlayer = rngInt(rng, 2) as PlayerId;

    this.st = {
      rng,
      turn: 0, // becomes 1 when the game actually starts (after mulligans)
      startingPlayer,
      activePlayer: startingPlayer,
      step: 'untap',
      players: [this.freshPlayer(libraries[0]), this.freshPlayer(libraries[1])],
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
      nextSid: 1,
      winner: null,
      winReason: null,
    };

    const emit: Emit = (e) => this.initialEvents.push(e);
    if (cfg.playDrawChoice) emit({ e: 'coinFlipped', winner: startingPlayer });
    else emit({ e: 'firstPlayerChosen', player: startingPlayer });
    for (const p of [0, 1] as const) {
      drawCards(this.st, emit, p, RULES.startingHandSize);
    }
  }

  private freshPlayer(deck: string[]): GameState['players'][0] {
    return {
      life: RULES.startingLife,
      deck,
      hand: [],
      graveyard: [],
      severed: [],
      landPlayedThisTurn: false,
      mulligans: 0,
      keptHand: false,
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  get state(): Readonly<GameState> {
    return this.st;
  }

  get awaiting(): Awaiting {
    return this.st.awaiting;
  }

  legalActions(player: PlayerId): Action[] {
    return legalActions(this.st, this.db, player);
  }

  viewFor(player: PlayerId): PlayerView {
    return viewFor(this.st, player);
  }

  clone(): Game {
    return Game.restore(structuredClone(this.st), this.db);
  }

  static restore(state: GameState, db: CardDb): Game {
    const g = Object.create(Game.prototype) as Game;
    Object.assign(g, { st: state, db, buf: [], initialEvents: [] });
    return g;
  }

  /** Validate → apply → emit. Throws on illegal actions. */
  submit(player: PlayerId, action: Action): GameEvent[] {
    const err = validateAction(this.st, this.db, player, action);
    if (err) throw new Error(`Illegal action ${action.type} by P${player}: ${err}`);

    this.buf = [];
    const emit: Emit = (e) => this.buf.push(e);
    this.apply(player, action, emit);
    this.maybeRaiseDeferredDecision(emit);
    return this.buf;
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
    return this.st.players[player].deck.some((cardId) =>
      def(this.db, cardId).supertypes?.includes('basic'),
    );
  }

  /** Awaiting foresee cards are top-first, matching the player-facing order. */
  private foreseeCards(player: PlayerId, n: number): string[] {
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
        const bottomed: string[] = [];
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
          const idx = lib.lastIndexOf(action.cardId);
          if (idx >= 0) {
            const [cardId] = lib.splice(idx, 1);
            const perm = enterBattlefield(st, this.db, cardId, controller, emit);
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
        emit({ e: 'foresaw', player, kept, bottomed });
        return;
      }

      case 'playLand': {
        const cardId = me.hand.splice(action.handIndex, 1)[0];
        const perm = enterBattlefield(st, this.db, cardId, player, () => {});
        me.landPlayedThisTurn = true;
        emit({ e: 'landPlayed', player, iid: perm.iid, cardId });
        return;
      }

      case 'castSpell': {
        const cardId = me.hand[action.handIndex];
        const d = def(this.db, cardId);
        const extra = action.x ?? 0;
        const plan =
          action.manaPlan ?? solveMana(st, this.db, player, d.cost!, extra)!;
        for (const iid of plan) {
          const src = findPermanent(st, iid)!;
          src.tapped = true;
        }
        if (plan.length > 0) emit({ e: 'manaTapped', player, iids: plan });

        me.hand.splice(action.handIndex, 1);
        const item: StackItem = {
          sid: st.nextSid++,
          cardId,
          controller: player,
          targets: action.targets ?? [],
          x: action.x,
        };
        st.stack.push(item);
        emit({
          e: 'spellCast',
          sid: item.sid,
          cardId,
          controller: player,
          targets: item.targets,
        });
        this.openResponseWindow(opponentOf(player), { type: 'spell', sid: item.sid }, emit);
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
          const [cardId] = me.hand.splice(i, 1);
          me.graveyard.push(cardId);
          emit({ e: 'discarded', player, cardId });
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
