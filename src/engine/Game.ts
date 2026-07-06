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
  finishCleanup,
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
      awaiting: { player: startingPlayer, kind: 'mulligan' },
      nextIid: 1,
      nextSid: 1,
      winner: null,
      winReason: null,
    };

    const emit: Emit = (e) => this.initialEvents.push(e);
    emit({ e: 'firstPlayerChosen', player: startingPlayer });
    for (const p of [0, 1] as const) {
      drawCards(this.st, emit, p, RULES.startingHandSize);
    }
  }

  private freshPlayer(library: string[]): GameState['players'][0] {
    return {
      life: RULES.startingLife,
      library,
      hand: [],
      graveyard: [],
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
    return this.buf;
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

      case 'mulligan': {
        me.mulligans++;
        me.library.push(...me.hand.splice(0));
        rngShuffle(st.rng, me.library);
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
        // library index 0 is the bottom
        me.library.unshift(...bottomed);
        emit({ e: 'cardsBottomed', player, count: bottomed.length });
        this.nextMulliganOrStart(emit);
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
          if (!getEffectiveStats(st.battlefield, this.db, iid).keywords.has('vigilance')) {
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
      case 'end':
        // The single end-step window has been used.
        enterCleanup(st, this.db, emit);
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
