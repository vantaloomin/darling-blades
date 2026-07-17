import { RULES } from '../config/rules';
import { hasCastableInstant } from './actions';
import type { Emit } from './battlefield';
import { fireTriggers } from './effects/EffectInterpreter';
import { checkStateBased } from './sba';
import type { CardDb, GameState, PlayerId } from './types';
import { opponentOf } from './types';

export function endGame(
  state: GameState,
  emit: Emit,
  winner: PlayerId | 'draw',
  reason: 'life' | 'deck' | 'concede' | 'turnLimit',
): void {
  if (state.winner !== null) return;
  state.winner = winner;
  state.winReason = reason;
  state.awaiting = { kind: 'gameOver' };
  emit({ e: 'gameEnded', winner, reason });
}

export function drawCards(
  state: GameState,
  emit: Emit,
  player: PlayerId,
  n: number,
): void {
  const p = state.players[player];
  for (let i = 0; i < n; i++) {
    const cardId = p.deck.pop(); // last element = top
    if (cardId === undefined) {
      endGame(state, emit, opponentOf(player), 'deck');
      return;
    }
    p.hand.push(cardId);
    emit({ e: 'drew', player, cardId });
  }
}

/** Untap → dawn → draw, then hand control to Main 1. */
export function startTurn(state: GameState, db: CardDb, emit: Emit): void {
  const active = state.activePlayer;
  emit({ e: 'turnBegan', player: active, turn: state.turn });

  // Untap
  state.step = 'untap';
  emit({ e: 'stepChanged', step: 'untap' });
  const untapped: number[] = [];
  for (const perm of state.battlefield) {
    if (perm.controller !== active) continue;
    if (perm.tapped) {
      perm.tapped = false;
      untapped.push(perm.iid);
    }
    perm.enteredThisTurn = false; // sickness wears off on your own untap
  }
  state.players[active].landPlayedThisTurn = false;
  if (untapped.length > 0) emit({ e: 'untapped', iids: untapped });

  // Dawn — the active player's start-of-turn triggers resolve, no response window.
  state.step = 'dawn';
  emit({ e: 'stepChanged', step: 'dawn' });
  for (const perm of [...state.battlefield]) {
    if (perm.controller !== active) continue;
    if (!state.battlefield.some((p) => p.iid === perm.iid)) continue;
    fireTriggers(state, db, emit, 'dawn', perm);
  }
  checkStateBased(state, db, emit);
  if (state.winner !== null) return;

  // A dawn foresee must resolve before the turn draw. Game will surface the
  // queued choice after the current action, then resume through finishDawn.
  if (state.pendingDecisions.length > 0) return;

  finishDawn(state, emit);
}

/** Complete the draw/main portion of a turn after dawn triggers have settled. */
export function finishDawn(state: GameState, emit: Emit): void {
  const active = state.activePlayer;
  // Draw
  state.step = 'draw';
  emit({ e: 'stepChanged', step: 'draw' });
  const skipsDraw = state.turn === 1 && active === state.startingPlayer;
  if (!skipsDraw) {
    drawCards(state, emit, active, 1);
    if (state.winner !== null) return;
  }

  state.step = 'main1';
  emit({ e: 'stepChanged', step: 'main1' });
  state.awaiting = { player: active, kind: 'main' };
}

/** Main 2 passed: end step. The non-active player gets one instant window. */
export function enterEndStep(state: GameState, db: CardDb, emit: Emit): void {
  state.step = 'end';
  emit({ e: 'stepChanged', step: 'end' });
  const nonActive = opponentOf(state.activePlayer);
  if (hasCastableInstant(state, db, nonActive)) {
    state.awaiting = { player: nonActive, kind: 'endStepWindow' };
    emit({ e: 'responseWindowOpened', player: nonActive });
  } else {
    enterCleanup(state, db, emit);
  }
}

export function enterCleanup(state: GameState, db: CardDb, emit: Emit): void {
  state.step = 'cleanup';
  emit({ e: 'stepChanged', step: 'cleanup' });
  resumeCleanup(state, db, emit);
}

/**
 * Raise (or re-raise) the hand-size discard, or finish the turn. Split from
 * enterCleanup so resumeAfterFlush can rejoin the cleanup step after a
 * deferred decision (e.g. a foresee cast in the end-step window) clobbered
 * the discardToHandSize awaiting — re-entering here recomputes the overage
 * instead of throwing on the unexpected step.
 */
export function resumeCleanup(state: GameState, db: CardDb, emit: Emit): void {
  const active = state.activePlayer;
  const over = state.players[active].hand.length - RULES.maxHandSize;
  if (over > 0) {
    state.awaiting = { player: active, kind: 'discardToHandSize', count: over };
    return;
  }
  finishCleanup(state, db, emit);
}

export function finishCleanup(state: GameState, db: CardDb, emit: Emit): void {
  // Marked damage and until-EOT effects wear off.
  for (const perm of state.battlefield) {
    perm.damage = 0;
    perm.deathtouched = false;
    perm.untilEotMods = [];
  }
  state.combat = null;
  state.fogThisTurn = false;

  if (state.turn >= RULES.turnLimit) {
    endGame(state, emit, 'draw', 'turnLimit');
    return;
  }

  state.turn++;
  state.activePlayer = opponentOf(state.activePlayer);
  startTurn(state, db, emit);
}
