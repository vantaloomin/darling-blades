/**
 * One game of the rate lab (2.0 plan, lanes B5 and D3): two field decks, each
 * with its arm's four lab cards added, Hard on both seats, at the lab's
 * starting life, reduced to a compact record of what the rates need.
 */
import { buildAI } from '../../src/ai/personality';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { Game } from '../../src/engine/Game';
import type { GameEvent } from '../../src/engine/events';
import { isType, type PlayerId } from '../../src/engine/types';
import { ARMS, LAB_DB, withLabCards, type ArmName } from './cards';

export interface LabGameJob {
  arm: ArmName;
  life: number;
  pair: number;
  game: number;
  gameSeed: number;
  rowIsP0: boolean;
  rowDeck: readonly string[];
  colDeck: readonly string[];
  rowReserve: readonly string[];
  colReserve: readonly string[];
}

/**
 * Row-relative record: index 0 is the row (subject) deck, 1 the column deck,
 * whatever seat each sat in. `w` is 0 (row won), 1 (column won) or 2 (draw).
 */
export interface LabGameRecord {
  arm: ArmName;
  life: number;
  pair: number;
  game: number;
  rowIsP0: boolean;
  w: 0 | 1 | 2;
  reason: 'life' | 'deck' | 'concede' | 'turnLimit' | null;
  /** `state.turn` at the end: each player's turn counts, so a round is two. */
  turns: number;
  /** Turns each side began. */
  dawns: [number, number];
  /** Of those, the dawns it held the Mandate (its extra draws). */
  holdDawns: [number, number];
  /** Claims by a card, and steals in combat. */
  claims: [number, number];
  steals: [number, number];
  /** The turn each side first took the Mandate, or null. */
  firstHold: [number | null, number | null];
  /** Dawns each side began after its first claim: the hold rate's denominator. */
  dawnsSinceClaim: [number, number];
  /** Dawns where the side controlled a legendary creature: Sworn's active rate. */
  legendDawns: [number, number];
}

export function playLabGame(job: LabGameJob): LabGameRecord {
  const arm = ARMS[job.arm];
  const rowSeat: PlayerId = job.rowIsP0 ? 0 : 1;
  const colSeat: PlayerId = job.rowIsP0 ? 1 : 0;
  // The same AI seeds as balance-matrix runCell and the life study.
  const seats: AIPlayer[] = [];
  seats[rowSeat] = buildAI('hard', LAB_DB, job.gameSeed * 7 + 1);
  seats[colSeat] = buildAI('hard', LAB_DB, job.gameSeed * 13 + 5);

  const holdDawns = [0, 0];
  const claims = [0, 0];
  const steals = [0, 0];
  const firstHold: (number | null)[] = [null, null];
  let turnNow = 0;
  const onEvent = (e: Readonly<GameEvent>): void => {
    if (e.e === 'mandateDraw') holdDawns[e.player]++;
    else if (e.e === 'mandateChanged') {
      (e.reason === 'combat' ? steals : claims)[e.to]++;
      firstHold[e.to] ??= turnNow;
    }
  };
  const rowDeck = withLabCards(job.rowDeck, arm.row);
  const colDeck = withLabCards(job.colDeck, arm.col);
  const game = new Game({
    decks: job.rowIsP0 ? [rowDeck, colDeck] : [colDeck, rowDeck],
    seed: job.gameSeed,
    db: LAB_DB,
    format: 'warchest',
    startingLife: job.life,
    landReserves: job.rowIsP0
      ? [[...job.rowReserve], [...job.colReserve]]
      : [[...job.colReserve], [...job.rowReserve]],
    eventObserver: onEvent,
  });

  const dawns = [0, 0];
  const dawnsSinceClaim = [0, 0];
  const legendDawns = [0, 0];
  for (let i = 0; ; i++) {
    if (i >= 40_000) throw new Error(`mandate-lab game (seed ${job.gameSeed}, ${job.arm}) did not terminate`);
    const st = game.instanceState;
    if (st.turn !== turnNow) {
      turnNow = st.turn;
      const active = st.activePlayer;
      dawns[active]++;
      if (firstHold[active] !== null) dawnsSinceClaim[active]++;
      const legend = st.battlefield.some((p) => {
        const d = LAB_DB[p.cardId];
        return p.controller === active && d !== undefined && isType(d, 'creature') && (d.supertypes ?? []).includes('legendary');
      });
      if (legend) legendDawns[active]++;
    }
    const a = game.awaiting;
    if (a.kind === 'gameOver') break;
    game.submit(a.player, seats[a.player].chooseAction(game.viewFor(a.player), game.legalActions(a.player)));
  }
  const st = game.instanceState;
  const rel = <T>(arr: T[]): [T, T] => [arr[rowSeat], arr[colSeat]];
  const w: 0 | 1 | 2 = st.winner === 'draw' || st.winner === null ? 2 : st.winner === rowSeat ? 0 : 1;
  return {
    arm: job.arm,
    life: job.life,
    pair: job.pair,
    game: job.game,
    rowIsP0: job.rowIsP0,
    w,
    reason: st.winReason,
    turns: st.turn,
    dawns: rel(dawns),
    holdDawns: rel(holdDawns),
    claims: rel(claims),
    steals: rel(steals),
    firstHold: rel(firstHold),
    dawnsSinceClaim: rel(dawnsSinceClaim),
    legendDawns: rel(legendDawns),
  };
}
