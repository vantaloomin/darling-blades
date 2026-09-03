/**
 * The seeded AI pass for the Starborne AI-watch family.
 *
 * The Starborne overplan spared three threshold cards the design-risk section
 * called hostile to the current AI (Halo Motherboard, Signal Cathedral,
 * Propagation Choir) on the condition that they get seeded win-rate evidence
 * before the set ships; the engine wave added Starborne Relay and Umbral
 * Antenna (4-mark thresholds) and named Gullet of the Hive the flex cut if it
 * blanks. None of the six sits in any shipped AI deck, so this pass plants each
 * one (two copies) into the hard-AI Starborne boss deck that can cast it,
 * plays seeded Warchest games against the Medium-piloted starter columns plus
 * the Starborne theme precon, and watches what the AI does with the card:
 *
 *   seen        copies that reached the row's hand (opening hand + draws)
 *   cast%       cast / seen - does the AI play it at all?
 *   hold        mean turns a copy waited in hand before being cast
 *   dead%       copies still in hand when the game ended
 *   dawns       the row's turn-starts with the card on the battlefield
 *   thr%        share of those dawns at or above the card's mark threshold
 *   probe       the card's own payoff: marked creatures on arrival
 *               (Motherboard's Propagate), youAddMark triggers per game on
 *               board (Choir), opponent marked creatures on arrival (Gullet)
 *   win%        row win rate for the variant, beside the untouched host
 *
 * Informational, deterministic, dev-only: it promotes nothing to a gate.
 *
 *   npx tsx scripts/ai-watch-pass.ts [--seeds 40] [--only <id,id>] [--out <file>]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAI } from '../src/ai/personality';
import { MediumAI } from '../src/ai/MediumAI';
import { CARD_DB } from '../src/data/catalog';
import { AVATARS } from '../src/data/opponents';
import { STARTER_DECKS, THEME_DECKS } from '../src/data/starterDecks';
import { Game } from '../src/engine/Game';
import type { GameEvent } from '../src/engine/events';
import { cardIdOf, type GameState, type PlayerId } from '../src/engine/types';
import { validateWarchestDeck } from '../src/meta/darlings';
import { WARCHEST_HAND_SIZE } from '../src/meta/warchest';
import { buildReserveMatrixFullOwnershipSave } from './reserveMatrixDecks';

type Probe = 'arrivalMarkedMine' | 'addMarkTriggers' | 'arrivalMarkedTheirs' | 'none';

interface WatchCard {
  id: string;
  /** Avatar id whose reserveDeck, landReserve, difficulty and personality host the card. */
  host: string;
  /** Two copies of this host card make room; the baseline keeps them. */
  swapOut: string;
  /** Mark threshold the card's dawn ability needs (own creatures). */
  threshold?: number;
  probe: Probe;
}

/**
 * Hosts: Chrome Broodmother (G/R marks, rung 23) can cast every colourless
 * artifact and the green enchantment; The Violet Signal Queen (U/B anti-mark,
 * rung 24) is the only black boss and so hosts Gullet. Umbral Antenna is
 * colour-identity black but costs {4} generic, so it is measured where marks
 * actually happen. Eclipse-Red Queen is outside this pass: her risk is an
 * attack trigger, not a threshold, and no shipped boss casts {6}{B}{R}.
 */
const WATCH: WatchCard[] = [
  { id: 'sb-halo-motherboard', host: 'chrome-broodmother', swapOut: 'sb-starfall-barrage', probe: 'arrivalMarkedMine' },
  { id: 'sb-signal-cathedral', host: 'chrome-broodmother', swapOut: 'sb-starfall-barrage', threshold: 5, probe: 'none' },
  { id: 'sb-starborne-relay', host: 'chrome-broodmother', swapOut: 'sb-starfall-barrage', threshold: 4, probe: 'none' },
  { id: 'sb-propagation-choir', host: 'chrome-broodmother', swapOut: 'sb-starfall-barrage', probe: 'addMarkTriggers' },
  { id: 'sb-umbral-antenna', host: 'chrome-broodmother', swapOut: 'sb-starfall-barrage', threshold: 4, probe: 'none' },
  { id: 'sb-gullet-of-the-hive', host: 'the-violet-signal-queen', swapOut: 'sb-corpse-lantern', probe: 'arrivalMarkedTheirs' },
];
const COPIES = 2;

interface Column { name: string; cards: string[]; landReserve: string[] }

function columns(): Column[] {
  const picks = [...STARTER_DECKS, ...THEME_DECKS.filter((deck) => deck.id === 'theme-starborne')];
  return picks.map((deck) => {
    if (!deck.reserveCards || !deck.landReserve) throw new Error(`${deck.id} has no reserve build`);
    return { name: deck.name, cards: deck.reserveCards, landReserve: deck.landReserve };
  });
}

interface GameStats {
  seen: number;
  cast: number;
  holdTurns: number;
  deadAtEnd: number;
  dawnsOnBoard: number;
  thresholdDawns: number;
  probeSamples: number;
  probeTotal: number;
  /** Marked creatures the row controlled at each of its own dawns, whatever was on board. */
  markedDawns: number;
  markedDawnSum: number;
  maxMarked: number;
  won: boolean;
}

function markedCreatures(state: Readonly<GameState>, controller: PlayerId): number {
  return state.battlefield.filter((perm) =>
    perm.controller === controller &&
    perm.plusOneCounters > 0 &&
    (CARD_DB[perm.cardId]?.types.includes('creature') ?? false),
  ).length;
}

/** One observer per game: everything it learns about `watch.id` on `me`'s side. */
function makeObserver(watch: WatchCard, me: PlayerId, stats: GameStats) {
  const drawTurns: number[] = [];
  const myIids = new Set<number>();
  let handSeeded = false;
  let currentTurn = 0;
  return (event: Readonly<GameEvent>, state: Readonly<GameState>): void => {
    if (!handSeeded) {
      // Opening hands are dealt in construction and emit no `drew`.
      handSeeded = true;
      for (const entry of state.players[me].hand) {
        if (cardIdOf(entry) === watch.id) { stats.seen++; drawTurns.push(0); }
      }
    }
    switch (event.e) {
      case 'turnBegan': {
        currentTurn = event.turn;
        if (event.player !== me) break;
        const markedNow = markedCreatures(state, me);
        stats.markedDawns++;
        stats.markedDawnSum += markedNow;
        if (markedNow > stats.maxMarked) stats.maxMarked = markedNow;
        const onBoard = state.battlefield.some((perm) => perm.controller === me && perm.cardId === watch.id);
        if (!onBoard) break;
        stats.dawnsOnBoard++;
        if (watch.threshold !== undefined && markedCreatures(state, me) >= watch.threshold) stats.thresholdDawns++;
        break;
      }
      case 'drew':
        if (event.player === me && event.cardId === watch.id) { stats.seen++; drawTurns.push(currentTurn); }
        break;
      case 'spellCast':
        if (event.controller === me && event.cardId === watch.id) {
          stats.cast++;
          const drawn = drawTurns.shift();
          if (drawn !== undefined) stats.holdTurns += currentTurn - drawn;
        }
        break;
      case 'permanentEntered':
      case 'tokenCreated': {
        const perm = event.perm;
        if (perm.controller !== me || perm.cardId !== watch.id) break;
        myIids.add(perm.iid);
        if (watch.probe === 'arrivalMarkedMine') {
          stats.probeSamples++;
          stats.probeTotal += markedCreatures(state, me);
        } else if (watch.probe === 'arrivalMarkedTheirs') {
          stats.probeSamples++;
          stats.probeTotal += markedCreatures(state, (1 - me) as PlayerId);
        }
        break;
      }
      case 'triggerFired':
        if (watch.probe === 'addMarkTriggers' && myIids.has(event.iid) && event.when === 'youAddMark') stats.probeTotal++;
        break;
      case 'gameEnded': {
        for (const entry of state.players[me].hand) if (cardIdOf(entry) === watch.id) stats.deadAtEnd++;
        if (watch.probe === 'addMarkTriggers' && stats.dawnsOnBoard > 0) stats.probeSamples++;
        stats.won = event.winner === me;
        break;
      }
      default:
        break;
    }
  };
}

/** The baseline host gets the marks-only observer, so the deck's own mark density is measured untouched. */
function makeMarksObserver(me: PlayerId, stats: GameStats) {
  return (event: Readonly<GameEvent>, state: Readonly<GameState>): void => {
    if (event.e === 'turnBegan' && event.player === me) {
      const markedNow = markedCreatures(state, me);
      stats.markedDawns++;
      stats.markedDawnSum += markedNow;
      if (markedNow > stats.maxMarked) stats.maxMarked = markedNow;
    } else if (event.e === 'gameEnded') {
      stats.won = event.winner === me;
    }
  };
}

interface HostSpec { deck: string[]; landReserve: string[]; ai: (seed: number) => ReturnType<typeof buildAI> }

function hostFor(avatarId: string, watch?: WatchCard): HostSpec {
  const avatar = AVATARS.find((a) => a.id === avatarId);
  if (!avatar) throw new Error(`unknown host avatar ${avatarId}`);
  let deck = [...avatar.reserveDeck];
  if (watch) {
    let removed = 0;
    deck = deck.filter((id) => {
      if (id === watch.swapOut && removed < COPIES) { removed++; return false; }
      return true;
    });
    if (removed !== COPIES) throw new Error(`${avatarId} holds fewer than ${COPIES} ${watch.swapOut}`);
    deck.push(...Array.from({ length: COPIES }, () => watch.id));
  }
  return {
    deck,
    landReserve: [...avatar.landReserve],
    ai: (seed) => buildAI(avatar.difficulty, CARD_DB, seed, avatar.personality),
  };
}

interface CellStats { games: number; wins: number; cast: number; seen: number; thresholdDawns: number; dawnsOnBoard: number }

interface Row {
  id: string;
  host: string;
  games: number;
  wins: number;
  seen: number;
  cast: number;
  holdTurns: number;
  deadAtEnd: number;
  dawnsOnBoard: number;
  thresholdDawns: number;
  probeSamples: number;
  probeTotal: number;
  markedDawns: number;
  markedDawnSum: number;
  gamesAt4: number;
  gamesAt5: number;
  perColumn: Record<string, CellStats>;
}

function playSeries(
  label: string,
  host: HostSpec,
  cols: Column[],
  seeds: number,
  watch: WatchCard | undefined,
  log: (line: string) => void,
): Row {
  const row: Row = {
    id: watch?.id ?? 'baseline', host: label, games: 0, wins: 0, seen: 0, cast: 0, holdTurns: 0,
    deadAtEnd: 0, dawnsOnBoard: 0, thresholdDawns: 0, probeSamples: 0, probeTotal: 0, markedDawns: 0, markedDawnSum: 0, gamesAt4: 0, gamesAt5: 0, perColumn: {},
  };
  cols.forEach((column, cIdx) => {
    const cell: CellStats = { games: 0, wins: 0, cast: 0, seen: 0, thresholdDawns: 0, dawnsOnBoard: 0 };
    for (let i = 0; i < seeds; i++) {
      // Distinct from every balance-matrix block (which top out near 210k).
      const gameSeed = 300_000 + cIdx * 1_000 + i;
      const rowIsP0 = i % 2 === 0;
      const me = (rowIsP0 ? 0 : 1) as PlayerId;
      const stats: GameStats = {
        seen: 0, cast: 0, holdTurns: 0, deadAtEnd: 0, dawnsOnBoard: 0, thresholdDawns: 0,
        probeSamples: 0, probeTotal: 0, markedDawns: 0, markedDawnSum: 0, maxMarked: 0, won: false,
      };
      const rowAI = host.ai(gameSeed * 7 + 1);
      const colAI = new MediumAI(CARD_DB);
      const decks: [string[], string[]] = rowIsP0 ? [host.deck, column.cards] : [column.cards, host.deck];
      const reserves: [string[], string[]] = rowIsP0
        ? [host.landReserve, column.landReserve]
        : [column.landReserve, host.landReserve];
      const game = new Game({
        decks, seed: gameSeed, db: CARD_DB, format: 'warchest', landReserves: reserves,
        startingHandSize: WARCHEST_HAND_SIZE,
        eventObserver: watch ? makeObserver(watch, me, stats) : makeMarksObserver(me, stats),
      });
      const ais = rowIsP0 ? [rowAI, colAI] : [colAI, rowAI];
      let winner: PlayerId | 'draw' | undefined;
      for (let step = 0; step < 40_000; step++) {
        const awaiting = game.awaiting;
        if (awaiting.kind === 'gameOver') { winner = game.instanceState.winner!; break; }
        const action = ais[awaiting.player].chooseAction(game.viewFor(awaiting.player), game.legalActions(awaiting.player));
        game.submit(awaiting.player, action);
      }
      if (winner === undefined) throw new Error(`ai-watch game (seed ${gameSeed}) did not terminate`);
      cell.games++; row.games++;
      if (winner === me) { cell.wins++; row.wins++; }
      cell.cast += stats.cast; cell.seen += stats.seen;
      cell.thresholdDawns += stats.thresholdDawns; cell.dawnsOnBoard += stats.dawnsOnBoard;
      row.seen += stats.seen; row.cast += stats.cast; row.holdTurns += stats.holdTurns;
      row.deadAtEnd += stats.deadAtEnd; row.dawnsOnBoard += stats.dawnsOnBoard;
      row.thresholdDawns += stats.thresholdDawns; row.probeSamples += stats.probeSamples;
      row.probeTotal += stats.probeTotal;
      row.markedDawns += stats.markedDawns; row.markedDawnSum += stats.markedDawnSum;
      if (stats.maxMarked >= 4) row.gamesAt4++;
      if (stats.maxMarked >= 5) row.gamesAt5++;
    }
    row.perColumn[column.name] = cell;
    log(`  ${row.id} vs ${column.name}: ${cell.wins}/${cell.games} wins` +
      (watch ? `, cast ${cell.cast}/${cell.seen}, threshold dawns ${cell.thresholdDawns}/${cell.dawnsOnBoard}` : ''));
  });
  return row;
}

function pct(n: number, d: number): string {
  return d === 0 ? '   -' : `${(100 * n / d).toFixed(0).padStart(3)}%`;
}

export function runAiWatchPass(seeds: number, only?: string[], log: (line: string) => void = console.log) {
  const save = buildReserveMatrixFullOwnershipSave(CARD_DB);
  const cols = columns();
  const selected = WATCH.filter((watch) => !only || only.includes(watch.id));
  if (selected.length === 0) throw new Error(`--only matched nothing (known: ${WATCH.map((w) => w.id).join(', ')})`);
  const hosts = [...new Set(selected.map((watch) => watch.host))];
  const rows: Row[] = [];
  for (const hostId of hosts) {
    const baseline = hostFor(hostId);
    log(`Baseline ${hostId} (${seeds} seeds x ${cols.length} columns)`);
    rows.push(playSeries(hostId, baseline, cols, seeds, undefined, log));
    for (const watch of selected.filter((w) => w.host === hostId)) {
      const host = hostFor(hostId, watch);
      const issues = validateWarchestDeck(CARD_DB, save, host.deck, host.landReserve);
      if (issues.length > 0) throw new Error(`${watch.id} in ${hostId}: ${issues.map((i) => i.message).join(' | ')}`);
      log(`${watch.id} in ${hostId} (${COPIES}x for ${COPIES}x ${watch.swapOut})`);
      rows.push(playSeries(hostId, host, cols, seeds, watch, log));
    }
  }
  const baselineWin = new Map(rows.filter((r) => r.id === 'baseline').map((r) => [r.host, r.wins / r.games]));
  const lines = [
    '',
    `AI-WATCH PASS - ${seeds} seeds/column, ${cols.length} Medium-piloted columns (${cols.map((c) => c.name).join(', ')})`,
    'card                     host                     games seen cast%  hold  dead% dawns  thr%  probe                        win%  base mk/dawn  >=4g  >=5g',
  ];
  for (const r of rows.filter((r) => r.id !== 'baseline')) {
    const watch = WATCH.find((w) => w.id === r.id)!;
    const probe = watch.probe === 'none' ? '-' :
      watch.probe === 'addMarkTriggers'
        ? `${(r.probeTotal / Math.max(1, r.probeSamples)).toFixed(2)} triggers/game on board`
        : `${(r.probeTotal / Math.max(1, r.probeSamples)).toFixed(2)} marked on arrival (${r.probeSamples})`;
    lines.push(
      r.id.padEnd(24) + ' ' + r.host.padEnd(24) + ' ' +
      String(r.games).padStart(5) + ' ' + String(r.seen).padStart(4) + ' ' + pct(r.cast, r.seen) + '  ' +
      (r.cast ? (r.holdTurns / r.cast).toFixed(1) : '-').padStart(4) + '  ' + pct(r.deadAtEnd, r.seen) + ' ' +
      String(r.dawnsOnBoard).padStart(5) + ' ' + (watch.threshold ? pct(r.thresholdDawns, r.dawnsOnBoard) : '   -') + '  ' +
      probe.padEnd(28) + ' ' + pct(r.wins, r.games) + '  ' + pct(Math.round((baselineWin.get(r.host) ?? 0) * r.games), r.games) +
      ' ' + (r.markedDawnSum / Math.max(1, r.markedDawns)).toFixed(2).padStart(7) + ' ' + pct(r.gamesAt4, r.games) + ' ' + pct(r.gamesAt5, r.games),
    );
  }
  for (const r of rows.filter((r) => r.id === 'baseline')) {
    const mean = (r.markedDawnSum / Math.max(1, r.markedDawns)).toFixed(2);
    lines.push(
      `baseline ${r.host}: win ${pct(r.wins, r.games).trim()}, marked creatures at own dawns mean ${mean}, ` +
      `games ever reaching 4: ${pct(r.gamesAt4, r.games).trim()}, 5: ${pct(r.gamesAt5, r.games).trim()}`,
    );
  }
  for (const line of lines) log(line);
  return { seeds, columns: cols.map((c) => c.name), rows, table: lines.join('\n') };
}

function main(): void {
  const args = process.argv.slice(2);
  const opt = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  const seeds = Number(opt('--seeds') ?? 40);
  if (!Number.isInteger(seeds) || seeds <= 0) throw new Error('--seeds must be a positive integer');
  const only = opt('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
  const out = resolve(opt('--out') ?? `balance/ai-watch/${new Date().toISOString().slice(0, 10)}-ai-watch-pass.json`);
  const result = runAiWatchPass(seeds, only);
  if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ schemaVersion: 1, mode: 'ai-watch-pass', generatedAt: new Date().toISOString(), ...result }, null, 2));
  console.log(`\nArtifact: ${out}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invokedPath === resolve(fileURLToPath(import.meta.url)).toLowerCase()) main();
