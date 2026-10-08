/**
 * One game of the starting-life study (2.0 plan, lane D, D1), played at a
 * given starting life and reduced to a compact record.
 *
 * The life arm is applied by setting `RULES.startingLife` in this process
 * before any game is built. That is sim-only: nothing in the shipped game
 * reads a value other than 20, and the study never writes a file under src/.
 * D3 is where the total becomes a real `GameConfig` field.
 */
import { performance } from 'node:perf_hooks';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { buildAI } from '../../src/ai/personality';
import { RULES } from '../../src/config/rules';
import { CARD_DB } from '../../src/data/catalog';
import { Game } from '../../src/engine/Game';
import type { GameEvent } from '../../src/engine/events';
import { isType, manaValue, type PlayerId } from '../../src/engine/types';

/** Mana values 0..MAX_MV-1, the last bucket holding MAX_MV-1 and above. */
export const MAX_MV = 11;

export interface StudyGameJob {
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
 * Row-relative record: index 0 is the row deck, 1 the column deck, whatever
 * seat each sat in. `w` is 0 (row won), 1 (column won) or 2 (draw).
 */
export interface StudyGameRecord {
  life: number;
  pair: number;
  game: number;
  rowIsP0: boolean;
  w: 0 | 1 | 2;
  reason: 'life' | 'deck' | 'concede' | 'turnLimit' | null;
  /** `state.turn` at the end: each player's turn counts, so a round is two. */
  turns: number;
  endLife: [number, number];
  lands: [number, number];
  creatures: [number, number];
  /** Spells cast by mana value, buckets 0..MAX_MV-1. */
  casts: [number[], number[]];
  overcharged: [number, number];
  tokensRefused: [number, number];
  decisions: [number, number];
  aiMs: [number, number];
}

export function setStartingLife(life: number): void {
  if (!Number.isInteger(life) || life < 1) throw new Error(`bad life ${life}`);
  (RULES as { startingLife: number }).startingLife = life;
}

function timed(ai: AIPlayer, seat: PlayerId, ms: number[], count: number[]): AIPlayer {
  return {
    ...ai,
    chooseAction(view, legal) {
      const t0 = performance.now();
      const action = ai.chooseAction(view, legal);
      ms[seat] += performance.now() - t0;
      count[seat]++;
      return action;
    },
  } as AIPlayer;
}

export function playStudyGame(job: StudyGameJob): StudyGameRecord {
  if (RULES.startingLife !== job.life) setStartingLife(job.life);
  const ms = [0, 0];
  const decisions = [0, 0];
  const casts = [new Array<number>(MAX_MV).fill(0), new Array<number>(MAX_MV).fill(0)];
  const overcharged = [0, 0];
  const tokensRefused = [0, 0];
  // The same AI seeds as balance-matrix runCell: row from gameSeed*7+1,
  // column from gameSeed*13+5.
  const rowAI = buildAI('hard', CARD_DB, job.gameSeed * 7 + 1);
  const colAI = buildAI('hard', CARD_DB, job.gameSeed * 13 + 5);
  const rowSeat: PlayerId = job.rowIsP0 ? 0 : 1;
  const colSeat: PlayerId = job.rowIsP0 ? 1 : 0;
  const seats: AIPlayer[] = [];
  seats[rowSeat] = timed(rowAI, rowSeat, ms, decisions);
  seats[colSeat] = timed(colAI, colSeat, ms, decisions);
  const onEvent = (e: Readonly<GameEvent>): void => {
    if (e.e === 'spellCast') {
      const d = CARD_DB[e.cardId];
      const mv = Math.min(MAX_MV - 1, manaValue(d?.cost));
      casts[e.controller][mv]++;
    } else if (e.e === 'overcharged') {
      overcharged[e.player]++;
    } else if (e.e === 'tokenRefused') {
      tokensRefused[e.player]++;
    }
  };
  const decks: [string[], string[]] = job.rowIsP0
    ? [[...job.rowDeck], [...job.colDeck]]
    : [[...job.colDeck], [...job.rowDeck]];
  const reserves: [string[], string[]] = job.rowIsP0
    ? [[...job.rowReserve], [...job.colReserve]]
    : [[...job.colReserve], [...job.rowReserve]];
  const game = new Game({
    decks,
    seed: job.gameSeed,
    db: CARD_DB,
    format: 'warchest',
    landReserves: reserves,
    eventObserver: onEvent,
  });
  for (let i = 0; ; i++) {
    if (i >= 40_000) throw new Error(`life-study game (seed ${job.gameSeed}) did not terminate`);
    const a = game.awaiting;
    if (a.kind === 'gameOver') break;
    const view = game.viewFor(a.player);
    const legal = game.legalActions(a.player);
    game.submit(a.player, seats[a.player].chooseAction(view, legal));
  }
  const st = game.instanceState;
  const lands = [0, 0];
  const creatures = [0, 0];
  for (const perm of st.battlefield) {
    const d = CARD_DB[perm.cardId];
    if (!d) continue;
    if (isType(d, 'land')) lands[perm.controller]++;
    if (isType(d, 'creature')) creatures[perm.controller]++;
  }
  const rel = <T>(arr: T[]): [T, T] => [arr[rowSeat], arr[colSeat]];
  const winner = st.winner;
  const w: 0 | 1 | 2 = winner === 'draw' || winner === null
    ? 2
    : winner === rowSeat ? 0 : 1;
  return {
    life: job.life,
    pair: job.pair,
    game: job.game,
    rowIsP0: job.rowIsP0,
    w,
    reason: st.winReason,
    turns: st.turn,
    endLife: rel(st.players.map((p) => p.life)),
    lands: rel(lands),
    creatures: rel(creatures),
    casts: rel(casts),
    overcharged: rel(overcharged),
    tokensRefused: rel(tokensRefused),
    decisions: rel(decisions),
    aiMs: rel(ms.map((x) => Math.round(x))),
  };
}
