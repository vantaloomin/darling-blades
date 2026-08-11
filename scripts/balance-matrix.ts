/**
 * Balance-matrix harness — automated deck-vs-deck / difficulty-vs-difficulty
 * win-rate matrices to catch balance regressions (roadmap: "Gauntlet balance
 * pass"). Pure engine + ai + data; no Phaser.
 *
 * USAGE (via `npm run balance-matrix -- <flags>`):
 *   --avatars            18 gauntlet avatars (own brain + personality + deck)
 *                        vs the 5 starter decks piloted by a neutral Medium
 *                        proxy standing in for a competent human. DEFAULT.
 *   --starters           5x5 starter-vs-starter mirror matrix, Medium both
 *                        sides (deck strength, skill held constant).
 *   --prefabs            Full prefab round-robin (every starter + theme deck),
 *                        the same neutral brain both sides (--ai, default
 *                        hard). Upper triangle simmed, mirrored below; prints
 *                        a per-deck aggregate ranking to surface outliers.
 *   --warchest           5x5 Warchest round-robin over starter-derived legal
 *                        reserve decks. Neutral --ai brain on both sides.
 *   --warchest-tuning    Six sim-only Warchest deck/hand/color-cap configs;
 *                        telemetry is mandatory and one JSON writes per config.
 *   --config <key>       In tuning mode, run exactly one config.
 *   --out <dir>          Tuning JSON directory (default balance/warchest-tuning).
 *   --date <YYYY-MM-DD>  Reproducible tuning artifact date (defaults to today).
 *   --darlings           6x6 Darlings round-robin over a deterministic
 *                        color-spread legendary fleet. Neutral --ai brain.
 *   --darlings-precons   5x5 Darlings round-robin over the curated shop
 *                        precons. Neutral --ai brain on both sides.
 *   --ai <difficulty>    Brain for --prefabs, --warchest, and --darlings:
 *                        easy | medium | hard (default hard). Neutral (no
 *                        avatar personality).
 *   --difficulty         Easy/Medium/Hard round-robin on a fixed deck pair
 *                        (Crimson Muster vs Wild Communion, sides + decks
 *                        alternate so no brain owns the better deck).
 *   --tiers              6 tower AI tiers vs the 5 starter decks, each as a
 *                        mirror against a neutral Medium human proxy.
 *   --tier-probe         candidate (brain, noise) dials on the same harness,
 *                        for pricing a NEW tier without editing TIER_DEFS.
 *   --floors             18 rotating-tower floors (tier brain piloting the
 *                        avatar roster round-robin) vs the 5 starters.
 *   --cf-bosses          The Morrigan and Titania vs Low/Mid/High CF references
 *                        (Wild Communion / Grave Harvest / Glimmer Bargain).
 *   --ac-bosses          Morgan and Artoria vs Low/Mid/High AC references
 *                        (Crimson Muster / Shadow Mandate / Questing Table).
 *   --seeds <n>          Games per cell (default 20).
 *   --telemetry          Collect read-only per-game Warchest diagnostic data.
 *   --telemetry-out <p>  Also write full per-deck/per-cell telemetry JSON.
 *   --only <id,id,...>   Avatar-matrix row filter for fast tuning iteration
 *                        (e.g. --only simayi,menghuo). Cell seeds are keyed by
 *                        (rung, starter) so filtered runs reproduce the exact
 *                        cells of a full run.
 *
 * DETERMINISM: every cell has a stable index; game seed = cellIndex * 100_000
 * + gameIdx, and AI seeds derive from the game seed. Same flags => same table.
 * Cell-index base registry (keep bases disjoint across every runCell caller):
 *   10_000 starters · 20_000 difficulty · 30_000 cf-bosses · 40_000 ac-bosses
 *   50_000 tiers · 60_000..79_999 personas/craft.ts (hash-derived) · 70_000
 *   floors (predates craft.ts; different decks/AIs, left as-is) · 100_000
 *   prefabs. 80_000/90_000 are reserved for the planned warchest/darlings
 *   matrices. 110_000 is reserved for Darlings precons. Warchest tuning uses
 *   120_000..170_000 in 10_000-wide per-config bands.
 *
 * The skipped-by-default suite tests/ai/balance.test.ts imports the run*
 * helpers below, so the manual vitest tool and this CLI share one code path.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AIPlayer } from '../src/ai/AIPlayer';
import { MediumAI } from '../src/ai/MediumAI';
import { buildAI, DEFAULT_PERSONALITY } from '../src/ai/personality';
import { buildDialAI, buildTierAI, floorTier, TIER_DEFS, type TowerTier } from '../src/ai/tiers';
import { CARD_DB } from '../src/data/catalog';
import { DARLINGS_PRECON_MATRIX_FLEET } from '../src/data/darlingsPrecons';
import { AVATARS, type Avatar } from '../src/data/opponents';
import { STARTER_DECKS, THEME_DECKS } from '../src/data/starterDecks';
import type { GameFormat } from '../src/config/rules';
import { WARCHEST_HAND_SIZE } from '../src/meta/warchest';
import { Game } from '../src/engine/Game';
import type { PlayerId } from '../src/engine/types';
import type { Difficulty } from '../src/meta/Economy';
import {
  aggregatePlayerTelemetry,
  GameTelemetry,
  populationStandardDeviation,
  type GameTelemetryRecord,
  type PlayerTelemetryAggregate,
  type PlayerTelemetrySample,
} from '../src/meta/telemetry';
import {
  buildReserveMatrixFleets,
  buildWarchestTuningField,
  type ReserveMatrixDeck,
  type WarchestTuningField,
} from './reserveMatrixDecks';

// ---------------------------------------------------------------------------
// Core sim
// ---------------------------------------------------------------------------

export interface CellResult {
  rowWins: number;
  colWins: number;
  draws: number;
  games: number;
  /** Row-side win rate over DECIDED games (0 if every game drew). */
  rate: number;
  /** Present only when telemetry was requested. Population SD over decided seed outcomes. */
  winRateStdDev?: number;
}

export interface TelemetryCellGame {
  seed: number;
  rowIsP0: boolean;
  record: GameTelemetryRecord;
}

export interface TelemetryCellDetail {
  matrix: string;
  cellIndex: number;
  rowDeck: string;
  colDeck: string;
  games: TelemetryCellGame[];
  row: PlayerTelemetryAggregate;
  col: PlayerTelemetryAggregate;
  rowWinRateStdDev: number;
}

export interface BalanceTelemetryJson {
  decks: PlayerTelemetryAggregate[];
  cells: TelemetryCellDetail[];
}

/** One opt-in sink shared across whichever matrix modes the CLI selected. */
export class BalanceTelemetryCollector {
  private readonly details: TelemetryCellDetail[] = [];

  add(detail: TelemetryCellDetail): void {
    this.details.push(detail);
  }

  toJSON(): BalanceTelemetryJson {
    const samples = new Map<string, PlayerTelemetrySample[]>();
    for (const cell of this.details) {
      for (const game of cell.games) {
        for (const player of [0, 1] as const) {
          const name = game.record.players[player].deckName;
          const rows = samples.get(name) ?? [];
          rows.push({ game: game.record, player });
          samples.set(name, rows);
        }
      }
    }
    const decks = [...samples.values()]
      .map((rows) => aggregatePlayerTelemetry(rows))
      .sort((a, b) => a.deckName.localeCompare(b.deckName));
    return { decks, cells: structuredClone(this.details) };
  }

  render(): string {
    const report = this.toJSON();
    const lines = [
      'MATCHUP WIN-RATE STANDARD DEVIATION (decided seed outcomes):',
      ...report.cells.map((cell) =>
        `  [${cell.matrix}] ${cell.rowDeck} vs ${cell.colDeck}: ${(cell.rowWinRateStdDev * 100).toFixed(1)}pp`
      ),
      '',
      'TELEMETRY PER-DECK AGGREGATE:',
      '  deck                              games cleanup clog turns gravecasts cleanup-fuel deadweight stranded mulligan',
    ];
    for (const deck of report.decks) {
      lines.push(
        `  ${deck.deckName.slice(0, 32).padEnd(32)} ${String(deck.games).padStart(5)} ` +
        `${deck.meanCleanupDiscards.toFixed(2).padStart(7)} ` +
        `${deck.meanHandCloggedTurns.toFixed(2).padStart(4)} ` +
        `${deck.meanTurns.toFixed(1).padStart(5)} ` +
        `${deck.meanGraveyardCasts.toFixed(2).padStart(10)} ` +
        `${(deck.graveyardFuelFromCleanupShare * 100).toFixed(1).padStart(9)}% ` +
        `${deck.meanDeadWeightAtEnd.toFixed(2).padStart(10)} ` +
        `${(deck.colorStrandedTurnsRate * 100).toFixed(1).padStart(7)}% ` +
        `${(deck.mulliganRate * 100).toFixed(1).padStart(7)}%`,
      );
    }
    return lines.join('\n');
  }
}

interface CellTelemetryOptions {
  collector: BalanceTelemetryCollector;
  matrix: string;
  rowDeck: string;
  colDeck: string;
}

function cellTelemetry(
  collector: BalanceTelemetryCollector | undefined,
  matrix: string,
  rowDeck: string,
  colDeck: string,
): CellTelemetryOptions | undefined {
  return collector ? { collector, matrix, rowDeck, colDeck } : undefined;
}

export interface CellSpec {
  /**
   * Fresh row-side AI for one game (seeded brains like Easy need the seed).
   * `gameIndex` lets a cell vary its pilot per game (the floor matrix rotates
   * the avatar roster through one cell); most specs ignore it.
   */
  rowAI: (seed: number, gameIndex: number) => AIPlayer;
  colAI: (seed: number) => AIPlayer;
  /** Deck assignment for game i as [rowDeck, colDeck] (lets mirrors alternate). */
  decks: (i: number) => [string[], string[]];
  /** Absent preserves the original classic Game construction path. */
  format?: GameFormat;
  /** Reserve assignment for game i, in the same row/column order as decks. */
  reserves?: (i: number) => [string[], string[]];
  /** Darling assignment for game i, in the same row/column order as decks. */
  darlings?: (i: number) => [string | null, string | null];
  /** Sim-only opening deal and full-mulligan redraw size. */
  startingHandSize?: number;
}

export interface LosslessnessCounters {
  gamesPlayed: number;
  gamesDecided: number;
  draws: number;
  engineExceptions: number;
}

/** The test-suite game-loop idiom: submit legal actions until gameOver. */
export function playOut(
  seed: number,
  p0: AIPlayer,
  p1: AIPlayer,
  decks: [string[], string[]],
  format?: GameFormat,
  landReserves?: [string[], string[]],
  onEngineException?: () => void,
  darlings?: [string | null, string | null],
  telemetryDeckNames?: [string, string],
  onTelemetry?: (record: GameTelemetryRecord) => void,
  startingHandSize?: number,
): 0 | 1 | 'draw' {
  const engineCall = <T>(run: () => T): T => {
    try {
      return run();
    } catch (error) {
      onEngineException?.();
      throw error;
    }
  };
  // Keep the original classic constructor object byte-for-byte intact.
  const telemetry = telemetryDeckNames ? new GameTelemetry(CARD_DB, telemetryDeckNames) : undefined;
  const game =
    format === undefined && landReserves === undefined && darlings === undefined && telemetry === undefined &&
      startingHandSize === undefined
      ? engineCall(() => new Game({ decks, seed, db: CARD_DB }))
      : engineCall(() => new Game({
        decks,
        seed,
        db: CARD_DB,
        format,
        ...(landReserves ? { landReserves } : {}),
        ...(darlings ? { darlings } : {}),
        ...(telemetry ? { eventObserver: telemetry.onEvent.bind(telemetry) } : {}),
        ...(startingHandSize === undefined ? {} : { startingHandSize }),
      }));
  const ais = [p0, p1];
  for (let i = 0; i < 40_000; i++) {
    const a = engineCall(() => game.awaiting);
    if (a.kind === 'gameOver') {
      const winner = engineCall(() => game.instanceState.winner!);
      if (telemetry && onTelemetry) {
        onTelemetry(telemetry.finish(game.instanceState, winner));
      }
      return winner;
    }
    const view = engineCall(() => game.viewFor(a.player));
    const legal = engineCall(() => game.legalActions(a.player));
    const action = ais[a.player].chooseAction(view, legal);
    engineCall(() => game.submit(a.player, action));
  }
  throw new Error(`balance game (seed ${seed}) did not terminate`);
}

/**
 * Play `seeds` games for one cell. Sides alternate every game; the game seed
 * is offset by the cell index so every cell samples distinct, reproducible
 * shuffles.
 */
export function runCell(
  spec: CellSpec,
  seeds: number,
  cellIndex: number,
  losslessness?: LosslessnessCounters,
  telemetry?: CellTelemetryOptions,
): CellResult {
  let rowWins = 0;
  let colWins = 0;
  let draws = 0;
  const telemetryGames: TelemetryCellGame[] = [];
  const seedOutcomes: number[] = [];
  for (let i = 0; i < seeds; i++) {
    const gameSeed = cellIndex * 100_000 + i;
    const rowIsP0 = i % 2 === 0;
    const row = spec.rowAI(gameSeed * 7 + 1, i);
    const col = spec.colAI(gameSeed * 13 + 5);
    const [rowDeck, colDeck] = spec.decks(i);
    const reserves = spec.reserves?.(i);
    const darlings = spec.darlings?.(i);
    const seats: [string[], string[]] = rowIsP0 ? [rowDeck, colDeck] : [colDeck, rowDeck];
    const seatReserves = reserves
      ? (rowIsP0 ? [reserves[0], reserves[1]] : [reserves[1], reserves[0]]) as [string[], string[]]
      : undefined;
    const seatDarlings = darlings
      ? (rowIsP0 ? [darlings[0], darlings[1]] : [darlings[1], darlings[0]]) as [string | null, string | null]
      : undefined;
    if (losslessness) losslessness.gamesPlayed++;
    try {
      const winner = playOut(
        gameSeed,
        rowIsP0 ? row : col,
        rowIsP0 ? col : row,
        seats,
        spec.format,
        seatReserves,
        () => {
          if (losslessness) losslessness.engineExceptions++;
        },
        seatDarlings,
        telemetry
          ? (rowIsP0
              ? [telemetry.rowDeck, telemetry.colDeck]
              : [telemetry.colDeck, telemetry.rowDeck])
          : undefined,
        telemetry
          ? (record) => telemetryGames.push({ seed: gameSeed, rowIsP0, record })
          : undefined,
        spec.startingHandSize,
      );
      if (winner === 'draw') {
        draws++;
        if (losslessness) losslessness.draws++;
      } else if ((winner === 0) === rowIsP0) {
        rowWins++;
        if (telemetry) seedOutcomes.push(1);
        if (losslessness) losslessness.gamesDecided++;
      } else {
        colWins++;
        if (telemetry) seedOutcomes.push(0);
        if (losslessness) losslessness.gamesDecided++;
      }
    } catch (error) {
      if (losslessness) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`reserve matrix cell ${cellIndex} game ${i} failed: ${detail}`, { cause: error });
      }
      throw error;
    }
  }
  const decided = rowWins + colWins;
  const rate = decided === 0 ? 0 : rowWins / decided;
  if (!telemetry) return { rowWins, colWins, draws, games: seeds, rate };
  const rowSamples = telemetryGames.map((game) => ({
    game: game.record,
    player: (game.rowIsP0 ? 0 : 1) as PlayerId,
  }));
  const colSamples = telemetryGames.map((game) => ({
    game: game.record,
    player: (game.rowIsP0 ? 1 : 0) as PlayerId,
  }));
  const winRateStdDev = populationStandardDeviation(seedOutcomes);
  telemetry.collector.add({
    matrix: telemetry.matrix,
    cellIndex,
    rowDeck: telemetry.rowDeck,
    colDeck: telemetry.colDeck,
    games: telemetryGames,
    row: aggregatePlayerTelemetry(rowSamples),
    col: aggregatePlayerTelemetry(colSamples),
    rowWinRateStdDev: winRateStdDev,
  });
  return { rowWins, colWins, draws, games: seeds, rate, winRateStdDev };
}

// ---------------------------------------------------------------------------
// Guidance bands (from the balance plan)
// ---------------------------------------------------------------------------

export interface RungBand {
  /** Row average must not exceed this (early rungs must stay beatable). */
  maxAvg?: number;
  /** Row average must reach this (late rungs must threaten). */
  minAvg?: number;
  /** No single starter may lose this often to the rung (no hopeless matchup). */
  cellMax?: number;
}

/**
 * Plan guidance: rungs 1-3 <= ~45% AI-wins vs a Medium-proxied starter,
 * rungs 8-14 escalate (>= ~55/55/60/65/70/65/72%), roughly monotonic in between, and no
 * low rung may make any single starter hopeless. Mid bands are wide on purpose
 * — they catch regressions, not tuning jitter. Rungs 9-10 are the Ragnarök
 * expansion bosses (Hel mill-reanimator, Brunhild double-strike aggro) and
 * rungs 11-12 are the Celtic Fae bosses (Morrigan sever-control, Titania token
 * court), rungs 13-14 are the Arthurian Court pair (Morgan Quest-control,
 * Artoria awakened Knights), rungs 15-16 are the Gothic Monsters pair, and
 * rungs 17-18 are the Dark Tales summit (Glass-Coffin Queen Retell grind,
 * Abyssal Songstress Skim control).
 */
export const RUNG_BANDS: Readonly<Record<number, RungBand>> = Object.freeze({
  1: { maxAvg: 0.45, cellMax: 0.65 },
  2: { maxAvg: 0.45, cellMax: 0.65 },
  3: { maxAvg: 0.45, cellMax: 0.65 },
  4: { minAvg: 0.3, maxAvg: 0.62 },
  5: { minAvg: 0.35, maxAvg: 0.67 },
  6: { minAvg: 0.4, maxAvg: 0.72 },
  7: { minAvg: 0.45 },
  8: { minAvg: 0.55 },
  9: { minAvg: 0.55 },
  10: { minAvg: 0.6 },
  11: { minAvg: 0.65 },
  // 12-20 re-centred 2026-07-31 from the W7 combined re-baseline (200
  // seeds/cell on the post-balance-pass field): each min is the 200-seed
  // average minus a 6.5pp 40-seed noise band, rounded down to the half
  // point. Measured: R12 74 / R13 63 / R14 63 / R15 74 / R16 67 / R17 77 /
  // R18 84 / R19 62 / R20 71. User-authorized one-time downward re-centre
  // (same pattern as the economy bands): the old margins sat INSIDE 40-seed
  // noise (R14's was 1pp). The R19 dip below R18 is a documented inversion.
  12: { minAvg: 0.675 },
  // 13-14 calibrated 2026-07-16 from fresh 40-seed tower measurements (66%/66%
  // after two card-buff rounds + six deck iterations; CI margin ~4pp at 40
  // seeds). The AC rungs are quest/attrition gates, not stat walls; Brunhild's
  // R10 (85%) has been the tower's power peak since Celtic Fae shipped (R11/12
  // measured 76%), so a non-monotonic summit continues the accepted pattern.
  // Closing the residual 10pp vs R11/12 needs in-color W/U removal (a future
  // set) or heavier cross-set splash - recorded in opponents.ts's baseline.
  13: { minAvg: 0.565 },
  14: { minAvg: 0.565 },
  // 15-16 calibrated 2026-07-17 from fresh 40-seed tower measurements (77.6% /
  // 76.8%; CI margin ~4pp at 40 seeds). The Gothic Monsters summit pair sits
  // clearly above Artoria's 70.8%; the pair itself measured a statistical tie
  // (0.8pp, inside noise); ordering expectations live in the win-rate test,
  // not here. Values below superseded by the 2026-07-31 re-centre above
  // (the balance pass reshaped both decks' fields; The Bride now measures
  // 67% at 200 seeds after the AI-fix repair).
  15: { minAvg: 0.675 },
  16: { minAvg: 0.605 },
  // 17-18 first calibrated 2026-07-24 at 40 seeds (77% / 87%, floors 5pp
  // under); values below superseded by the 2026-07-31 re-centre above.
  // R18 remains the measured summit; strict monotonicity is not claimed.
  17: { minAvg: 0.705 },
  18: { minAvg: 0.775 },
  19: { minAvg: 0.555 },
  20: { minAvg: 0.645 },
});

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------

const CELL_W = 10;

function pctCell(c: CellResult): string {
  const decided = c.rowWins + c.colWins;
  const p = `${Math.round(c.rate * 100)}%`;
  const tail = c.draws > 0 ? `${decided}+${c.draws}d` : `${decided}`;
  return `${p.padStart(4)} (${tail})`.padEnd(CELL_W);
}

function renderTable(
  header: string,
  rowLabels: string[],
  colLabels: string[],
  cells: CellResult[][],
  rowSuffix?: (r: number) => string,
): string {
  const labelW = Math.max(...rowLabels.map((l) => l.length)) + 2;
  const lines: string[] = [header];
  lines.push(
    ''.padEnd(labelW) + colLabels.map((c) => c.padEnd(CELL_W)).join(' '),
  );
  cells.forEach((row, r) => {
    lines.push(
      rowLabels[r].padEnd(labelW) +
        row.map(pctCell).join(' ') +
        (rowSuffix ? rowSuffix(r) : ''),
    );
  });
  return lines.join('\n');
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const shortName = (starterName: string): string => starterName.split(' ').pop() ?? starterName;

// ---------------------------------------------------------------------------
// Matrix runners (shared by the CLI and tests/ai/balance.test.ts)
// ---------------------------------------------------------------------------

export interface AvatarRow {
  avatar: Avatar;
  cells: CellResult[]; // one per starter, STARTER_DECKS order
  avg: number; // mean of cell rates (equal starter weight)
}

export interface AvatarMatrixReport {
  rows: AvatarRow[];
  flags: string[];
  table: string;
}

/** Avatars (own brain + personality) vs Medium-proxied starters. */
export function runAvatarMatrix(
  seedsPerCell: number,
  onlyIds?: string[],
  telemetry?: BalanceTelemetryCollector,
): AvatarMatrixReport {
  const roster = [...AVATARS]
    .sort((a, b) => a.tier - b.tier)
    .filter((a) => !onlyIds || onlyIds.includes(a.id));
  const rows: AvatarRow[] = roster.map((av) => {
    const cells = STARTER_DECKS.map((starter, sIdx) =>
      runCell(
        {
          rowAI: (seed) => buildAI(av.difficulty, CARD_DB, seed, av.personality),
          colAI: () => new MediumAI(CARD_DB),
          decks: () => [av.deck, starter.cards],
        },
        seedsPerCell,
        av.tier * 100 + sIdx, // stable per (rung, starter) even under --only
        undefined,
        cellTelemetry(telemetry, 'avatars', `Avatar ${av.name}`, starter.name),
      ),
    );
    return { avatar: av, cells, avg: mean(cells.map((c) => c.rate)) };
  });

  const flags: string[] = [];
  for (const row of rows) {
    const band = RUNG_BANDS[row.avatar.tier] ?? {};
    const tag = `Rung ${row.avatar.tier} ${row.avatar.name}`;
    if (band.maxAvg !== undefined && row.avg > band.maxAvg) {
      flags.push(`${tag}: avg ${(row.avg * 100).toFixed(0)}% ABOVE band max ${band.maxAvg * 100}%`);
    }
    if (band.minAvg !== undefined && row.avg < band.minAvg) {
      flags.push(`${tag}: avg ${(row.avg * 100).toFixed(0)}% BELOW band min ${band.minAvg * 100}%`);
    }
    if (band.cellMax !== undefined) {
      row.cells.forEach((c, i) => {
        if (c.rate > band.cellMax!) {
          flags.push(
            `${tag} vs ${STARTER_DECKS[i].name}: cell ${(c.rate * 100).toFixed(0)}% ABOVE per-starter cap ${band.cellMax! * 100}% (starter near-hopeless)`,
          );
        }
      });
    }
  }
  // Soft ladder check (full runs only): flag big difficulty inversions.
  if (!onlyIds) {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].avg < rows[i - 1].avg - 0.12) {
        flags.push(
          `Ladder inversion: rung ${rows[i].avatar.tier} (${(rows[i].avg * 100).toFixed(0)}%) sits >12pp below rung ${rows[i - 1].avatar.tier} (${(rows[i - 1].avg * 100).toFixed(0)}%)`,
        );
      }
    }
  }

  const table = renderTable(
    `=== AVATAR GAUNTLET — avatar win % vs Medium-piloted starter · ${seedsPerCell} seeds/cell ===\n` +
      `    cell = row win % of decided games (decided count, +draws)`,
    rows.map((r) => `R${r.avatar.tier} ${r.avatar.name} [${r.avatar.difficulty}]`),
    STARTER_DECKS.map((s) => shortName(s.name)),
    rows.map((r) => r.cells),
    (r) => `| avg ${(rows[r].avg * 100).toFixed(0).padStart(3)}%`,
  );
  return { rows, flags, table };
}

export interface AvatarReserveMatrixReport {
  rows: AvatarRow[];
  table: string;
  flags: string[];
}

interface ReserveColumn {
  name: string;
  cards: string[];
  landReserve: string[];
  darlingId: string | null;
}

/**
 * Reserve-native avatar ladder (1.6 migration): each avatar pilots its own
 * reserveDeck (or darlingsDeck) with its brain and personality.
 *
 * Both formats now measure against the REAL decks a player can own
 * (2026-08-08): Warchest columns are the shipped starter and theme-precon
 * reserve builds; Darlings columns are the five curated Darlings precons
 * from the shop. Classic RUNG_BANDS do not apply to either. Losslessness
 * counts because reserve formats must never produce dead states.
 */
export function runAvatarReserveMatrix(
  format: 'warchest' | 'darlings',
  seedsPerCell: number,
  onlyIds?: string[],
  telemetry?: BalanceTelemetryCollector,
): AvatarReserveMatrixReport {
  const columns: readonly ReserveColumn[] =
    format === 'warchest'
      ? [...STARTER_DECKS, ...THEME_DECKS].map((deck) => {
          if (!deck.reserveCards || !deck.landReserve) {
            throw new Error(`Deck ${deck.id} has no reserve build; regenerate src/data/starterDecks.ts`);
          }
          return {
            name: deck.name,
            cards: deck.reserveCards,
            landReserve: deck.landReserve,
            darlingId: null,
          };
        })
      : DARLINGS_PRECON_MATRIX_FLEET;
  const losslessness = newLosslessnessCounters();
  const roster = [...AVATARS]
    .sort((a, b) => a.tier - b.tier)
    .filter((a) => !onlyIds || onlyIds.includes(a.id));
  const rows: AvatarRow[] = roster.map((av) => {
    const avatarDeck = format === 'warchest' ? av.reserveDeck : av.darlingsDeck;
    const cells = columns.map((proxy, cIdx) =>
      runCell(
        {
          rowAI: (seed) => buildAI(av.difficulty, CARD_DB, seed, av.personality),
          colAI: () => new MediumAI(CARD_DB),
          decks: () => [avatarDeck, proxy.cards],
          format,
          reserves: () => [av.landReserve, proxy.landReserve],
          ...(format === 'darlings'
            ? { darlings: () => [av.darlingId, proxy.darlingId] as [string | null, string | null] }
            : {}),
          startingHandSize: WARCHEST_HAND_SIZE,
        },
        seedsPerCell,
        // Distinct from the classic avatar block (tier*100) and both reserve
        // fleet blocks (80k/90k); darlings offsets a further 10k.
        200_000 + (format === 'darlings' ? 10_000 : 0) + av.tier * 100 + cIdx,
        losslessness,
        cellTelemetry(telemetry, `avatars-${format}`, `Avatar ${av.name}`, proxy.name),
      ),
    );
    return { avatar: av, cells, avg: mean(cells.map((c) => c.rate)) };
  });
  const table =
    renderTable(
      `=== AVATAR ${format.toUpperCase()} — avatar win % vs Medium-piloted ${
        format === 'warchest' ? 'reserve starters' : 'PROXY fleet'
      } · ${seedsPerCell} seeds/cell ===\n` +
        (format === 'warchest'
          ? '    columns: the shipped starter and theme-precon reserve builds; classic rung bands do not apply'
          : '    columns: the five curated Darlings shop precons; classic rung bands do not apply'),
      rows.map((r) => `R${r.avatar.tier} ${r.avatar.name} [${r.avatar.difficulty}]`),
      columns.map((c) => shortName(c.name)),
      rows.map((r) => r.cells),
      (r) => `| avg ${(rows[r].avg * 100).toFixed(0).padStart(3)}%`,
    ) +
    `\nLOSSLESSNESS: games played ${losslessness.gamesPlayed}; games decided ${losslessness.gamesDecided}; draws (turn-limit hits) ${losslessness.draws}; engine exceptions ${losslessness.engineExceptions}.`;
  return { rows, table, flags: [] };
}

export interface CelticFaeBossRow {
  avatar: Avatar;
  cells: CellResult[]; // low, mid, high reference decks
  avg: number;
}

export interface CelticFaeBossMatrixReport {
  rows: CelticFaeBossRow[];
  flags: string[];
  table: string;
}

/**
 * The directed Celtic Fae boss pass: each summit avatar faces three reference
 * power bands, with the avatar's own Hard brain and a neutral Medium proxy on
 * the reference deck. Cell seeds are stable at 30_000 + row*10 + column so a
 * filtered or repeated run samples the same games.
 */
export function runCelticFaeBossMatrix(
  seedsPerCell: number,
  telemetry?: BalanceTelemetryCollector,
): CelticFaeBossMatrixReport {
  const wild = STARTER_DECKS.find((deck) => deck.id === 'starter-wild');
  const harvest = STARTER_DECKS.find((deck) => deck.id === 'starter-harvest');
  const glimmer = THEME_DECKS.find((deck) => deck.id === 'theme-celtic-fae');
  if (!wild || !harvest || !glimmer) throw new Error('Celtic Fae balance references are missing');
  const refs = [
    { label: 'LOW Wild Communion', cards: wild.cards },
    { label: 'MID Grave Harvest', cards: harvest.cards },
    { label: 'HIGH Glimmer Bargain', cards: glimmer.cards },
  ] as const;
  const bosses = [...AVATARS].filter((avatar) => avatar.tier >= 11).sort((a, b) => a.tier - b.tier);
  const rows = bosses.map((avatar, rowIndex) => {
    const cells = refs.map((ref, refIndex) =>
      runCell(
        {
          rowAI: (seed) => buildAI(avatar.difficulty, CARD_DB, seed, avatar.personality),
          colAI: () => new MediumAI(CARD_DB),
          decks: () => [avatar.deck, ref.cards],
        },
        seedsPerCell,
        30_000 + rowIndex * 10 + refIndex,
        undefined,
        cellTelemetry(telemetry, 'cf-bosses', `Avatar ${avatar.name}`, ref.label),
      ),
    );
    return { avatar, cells, avg: mean(cells.map((cell) => cell.rate)) };
  });
  const flags: string[] = [];
  for (const row of rows) {
    const band = RUNG_BANDS[row.avatar.tier] ?? {};
    const tag = `Rung ${row.avatar.tier} ${row.avatar.name}`;
    if (band.maxAvg !== undefined && row.avg > band.maxAvg) {
      flags.push(`${tag}: avg ${(row.avg * 100).toFixed(0)}% ABOVE band max ${band.maxAvg * 100}%`);
    }
    if (band.minAvg !== undefined && row.avg < band.minAvg) {
      flags.push(`${tag}: avg ${(row.avg * 100).toFixed(0)}% BELOW band min ${band.minAvg * 100}%`);
    }
  }
  const table = renderTable(
    `=== CELTIC FAE BOSSES — boss win % vs reference decks · ${seedsPerCell} seeds/cell ===\n` +
      '    LOW = Wild Communion · MID = Grave Harvest · HIGH = Glimmer Bargain; decided games (+draws)',
    rows.map((row) => `R${row.avatar.tier} ${row.avatar.name}`),
    refs.map((ref) => ref.label),
    rows.map((row) => row.cells),
    (index) => `| avg ${(rows[index].avg * 100).toFixed(0).padStart(3)}%`,
  );
  return { rows, flags, table };
}

export interface ArthurianCourtBossRow {
  avatar: Avatar;
  cells: CellResult[]; // low, mid, high reference decks
  avg: number;
}

export interface ArthurianCourtBossMatrixReport {
  rows: ArthurianCourtBossRow[];
  flags: string[];
  table: string;
}

/**
 * The directed Arthurian Court boss pass: each summit avatar faces three
 * reference power bands, with the avatar's own Hard brain and a neutral
 * Medium proxy on the reference deck. Its seed range is separate from the
 * Celtic Fae pass so the two harnesses never share sampled games.
 */
export function runArthurianCourtBossMatrix(
  seedsPerCell: number,
  telemetry?: BalanceTelemetryCollector,
): ArthurianCourtBossMatrixReport {
  const low = STARTER_DECKS.find((deck) => deck.id === 'starter-crimson');
  const mid = STARTER_DECKS.find((deck) => deck.id === 'starter-mandate');
  const questingTable = THEME_DECKS.find((deck) => deck.id === 'theme-arthurian-court');
  if (!low || !mid || !questingTable) throw new Error('Arthurian Court balance references are missing');
  const refs = [
    { label: 'LOW Crimson Muster', cards: low.cards },
    { label: 'MID Shadow Mandate', cards: mid.cards },
    { label: 'HIGH Questing Table', cards: questingTable.cards },
  ] as const;
  const bosses = [...AVATARS].filter((avatar) => avatar.tier >= 13).sort((a, b) => a.tier - b.tier);
  const rows = bosses.map((avatar, rowIndex) => {
    const cells = refs.map((ref, refIndex) =>
      runCell(
        {
          rowAI: (seed) => buildAI(avatar.difficulty, CARD_DB, seed, avatar.personality),
          colAI: () => new MediumAI(CARD_DB),
          decks: () => [avatar.deck, ref.cards],
        },
        seedsPerCell,
        40_000 + rowIndex * 10 + refIndex,
        undefined,
        cellTelemetry(telemetry, 'ac-bosses', `Avatar ${avatar.name}`, ref.label),
      ),
    );
    return { avatar, cells, avg: mean(cells.map((cell) => cell.rate)) };
  });
  const flags: string[] = [];
  for (const row of rows) {
    const band = RUNG_BANDS[row.avatar.tier] ?? {};
    const tag = `Rung ${row.avatar.tier} ${row.avatar.name}`;
    if (band.maxAvg !== undefined && row.avg > band.maxAvg) {
      flags.push(`${tag}: avg ${(row.avg * 100).toFixed(0)}% ABOVE band max ${band.maxAvg * 100}%`);
    }
    if (band.minAvg !== undefined && row.avg < band.minAvg) {
      flags.push(`${tag}: avg ${(row.avg * 100).toFixed(0)}% BELOW band min ${band.minAvg * 100}%`);
    }
  }
  const table = renderTable(
    `=== ARTHURIAN COURT BOSSES - boss win % vs reference decks · ${seedsPerCell} seeds/cell ===\n` +
      '    LOW = Crimson Muster · MID = Shadow Mandate · HIGH = Questing Table; decided games (+draws)',
    rows.map((row) => `R${row.avatar.tier} ${row.avatar.name}`),
    refs.map((ref) => ref.label),
    rows.map((row) => row.cells),
    (index) => `| avg ${(rows[index].avg * 100).toFixed(0).padStart(3)}%`,
  );
  return { rows, flags, table };
}

export interface StarterMatrixReport {
  cells: CellResult[][]; // [row starter][col starter]
  flags: string[];
  table: string;
}

/** Starter-vs-starter mirror matrix, neutral Medium piloting both sides. */
export function runStarterMatrix(
  seedsPerCell: number,
  telemetry?: BalanceTelemetryCollector,
): StarterMatrixReport {
  const cells = STARTER_DECKS.map((rowDeck, r) =>
    STARTER_DECKS.map((colDeck, c) =>
      runCell(
        {
          rowAI: () => new MediumAI(CARD_DB),
          colAI: () => new MediumAI(CARD_DB),
          decks: () => [rowDeck.cards, colDeck.cards],
        },
        seedsPerCell,
        10_000 + r * 10 + c,
        undefined,
        cellTelemetry(telemetry, 'starters', rowDeck.name, colDeck.name),
      ),
    ),
  );
  const flags: string[] = [];
  cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (r !== c && (cell.rate >= 0.75 || cell.rate <= 0.25)) {
        flags.push(
          `Lopsided: ${STARTER_DECKS[r].name} vs ${STARTER_DECKS[c].name} = ${(cell.rate * 100).toFixed(0)}% (outside 25..75)`,
        );
      }
    }),
  );
  const table = renderTable(
    `=== STARTER MIRROR — row-deck win %, Medium piloting both sides · ${seedsPerCell} seeds/cell ===`,
    STARTER_DECKS.map((s) => shortName(s.name)),
    STARTER_DECKS.map((s) => shortName(s.name)),
    cells,
    (r) => `| avg ${(mean(cells[r].map((x) => x.rate)) * 100).toFixed(0).padStart(3)}%`,
  );
  return { cells, flags, table };
}

export interface PrefabMatrixReport {
  /** Full 7x7 grid; lower triangle is the mirror of the upper, diagonal null. */
  cells: (CellResult | null)[][];
  /** Per-deck aggregate (wins / decided across its 6 matchups), sorted desc. */
  summary: { name: string; wins: number; decided: number; draws: number; rate: number }[];
  totalGames: number;
  table: string;
}

/**
 * Every prefab deck (all starters + theme decks) in a round-robin, the SAME
 * neutral brain piloting both sides so only deck strength varies. Only the
 * upper triangle is simulated (sides alternate per game, so cell (r,c) already
 * contains the (c,r) information); the lower triangle is its mirror and the
 * diagonal is skipped. Cell seeds are stable at 100_000 + r * 100 + c (moved
 * off 40_000 + r * 10 + c on 2026-07-31: the base collided with the AC-boss
 * matrix, and the 10-stride would alias upper-triangle cells at 13+ decks;
 * prefab numbers measured since then come from fresh seed streams).
 */
export function runPrefabMatrix(
  seedsPerCell: number,
  ai: Difficulty,
  telemetry?: BalanceTelemetryCollector,
): PrefabMatrixReport {
  const decks = [...STARTER_DECKS, ...THEME_DECKS];
  const n = decks.length;
  const cells: (CellResult | null)[][] = decks.map(() => decks.map(() => null));
  for (let r = 0; r < n; r++) {
    for (let c = r + 1; c < n; c++) {
      process.stderr.write(`  cell ${decks[r].name} vs ${decks[c].name} (${seedsPerCell} games)...\n`);
      const cell = runCell(
        {
          rowAI: (seed) => buildAI(ai, CARD_DB, seed),
          colAI: (seed) => buildAI(ai, CARD_DB, seed),
          decks: () => [decks[r].cards, decks[c].cards],
        },
        seedsPerCell,
        100_000 + r * 100 + c,
        undefined,
        cellTelemetry(telemetry, 'prefabs', decks[r].name, decks[c].name),
      );
      cells[r][c] = cell;
      const decidedMirror = cell.rowWins + cell.colWins;
      cells[c][r] = {
        rowWins: cell.colWins,
        colWins: cell.rowWins,
        draws: cell.draws,
        games: cell.games,
        rate: decidedMirror === 0 ? 0 : cell.colWins / decidedMirror,
      };
    }
  }

  const summary = decks
    .map((deck, i) => {
      let wins = 0;
      let decided = 0;
      let draws = 0;
      for (let j = 0; j < n; j++) {
        const cell = cells[i][j];
        if (!cell) continue;
        wins += cell.rowWins;
        decided += cell.rowWins + cell.colWins;
        draws += cell.draws;
      }
      return { name: deck.name, wins, decided, draws, rate: decided === 0 ? 0 : wins / decided };
    })
    .sort((a, b) => b.rate - a.rate);

  const totalGames = (n * (n - 1) / 2) * seedsPerCell;
  // First word, not shortName (last word): "Crimson Muster" and "Valhalla's
  // Muster" would otherwise both label as "Muster".
  const labels = decks.map((d) => d.name.split(' ')[0]);
  const labelW = Math.max(...labels.map((l) => l.length)) + 2;
  const lines: string[] = [
    `=== PREFAB ROUND-ROBIN — row-deck win %, neutral ${ai} piloting both sides · ${seedsPerCell} seeds/cell ===\n` +
      '    cell = row win % of decided games (decided count, +draws); diagonal skipped',
  ];
  lines.push(''.padEnd(labelW) + labels.map((l) => l.padEnd(CELL_W)).join(' '));
  cells.forEach((row, r) => {
    lines.push(
      labels[r].padEnd(labelW) +
        row.map((cell) => (cell ? pctCell(cell) : '--'.padStart(4).padEnd(CELL_W))).join(' '),
    );
  });
  lines.push('');
  lines.push('PER-DECK AGGREGATE (wins / decided across all matchups):');
  for (const s of summary) {
    lines.push(
      `  ${s.name.padEnd(labelW + 8)} ${(s.rate * 100).toFixed(1).padStart(5)}%  (${s.wins}/${s.decided}${s.draws > 0 ? ` +${s.draws}d` : ''})`,
    );
  }
  lines.push(`NOTE: ${totalGames} total games across ${n * (n - 1) / 2} cells.`);
  return { cells, summary, totalGames, table: lines.join('\n') };
}

export interface ReserveMatrixReport {
  /** Full grid; lower triangle mirrors the simulated upper triangle. */
  cells: (CellResult | null)[][];
  summary: { name: string; wins: number; decided: number; draws: number; rate: number }[];
  totalGames: number;
  losslessness: LosslessnessCounters;
  table: string;
}

function newLosslessnessCounters(): LosslessnessCounters {
  return { gamesPlayed: 0, gamesDecided: 0, draws: 0, engineExceptions: 0 };
}

/** Shared reserve-format round-robin with mandatory completion accounting. */
function runReserveMatrix(
  title: string,
  format: 'warchest' | 'darlings',
  decks: readonly ReserveMatrixDeck[],
  seedsPerCell: number,
  ai: Difficulty,
  cellBase: number,
  telemetry?: BalanceTelemetryCollector,
  options?: { startingHandSize?: number; telemetryMatrix?: string },
): ReserveMatrixReport {
  const n = decks.length;
  const cells: (CellResult | null)[][] = decks.map(() => decks.map(() => null));
  const losslessness = newLosslessnessCounters();
  for (let r = 0; r < n; r++) {
    for (let c = r + 1; c < n; c++) {
      process.stderr.write(`  cell ${decks[r].name} vs ${decks[c].name} (${seedsPerCell} games)...\n`);
      const cell = runCell(
        {
          rowAI: (seed) => buildAI(ai, CARD_DB, seed),
          colAI: (seed) => buildAI(ai, CARD_DB, seed),
          decks: () => [decks[r].cards, decks[c].cards],
          format,
          reserves: () => [decks[r].landReserve, decks[c].landReserve],
          ...(format === 'darlings'
            ? { darlings: () => [decks[r].darlingId, decks[c].darlingId] as [string | null, string | null] }
            : {}),
          ...(options?.startingHandSize === undefined
            ? {}
            : { startingHandSize: options.startingHandSize }),
        },
        seedsPerCell,
        cellBase + r * 100 + c,
        losslessness,
        cellTelemetry(telemetry, options?.telemetryMatrix ?? format, decks[r].name, decks[c].name),
      );
      cells[r][c] = cell;
      const decidedMirror = cell.rowWins + cell.colWins;
      cells[c][r] = {
        rowWins: cell.colWins,
        colWins: cell.rowWins,
        draws: cell.draws,
        games: cell.games,
        rate: decidedMirror === 0 ? 0 : cell.colWins / decidedMirror,
      };
    }
  }

  const totalGames = (n * (n - 1) / 2) * seedsPerCell;
  if (
    losslessness.gamesPlayed !== totalGames ||
    losslessness.gamesDecided + losslessness.draws !== losslessness.gamesPlayed ||
    losslessness.engineExceptions !== 0
  ) {
    throw new Error(
      `${title} losslessness accounting failed: played ${losslessness.gamesPlayed}/${totalGames}, decided ${losslessness.gamesDecided}, draws ${losslessness.draws}, engine exceptions ${losslessness.engineExceptions}`,
    );
  }

  const summary = decks
    .map((deck, i) => {
      let wins = 0;
      let decided = 0;
      let draws = 0;
      for (let j = 0; j < n; j++) {
        const cell = cells[i][j];
        if (!cell) continue;
        wins += cell.rowWins;
        decided += cell.rowWins + cell.colWins;
        draws += cell.draws;
      }
      return { name: deck.name, wins, decided, draws, rate: decided === 0 ? 0 : wins / decided };
    })
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));

  // Full names stay in the aggregate below; compact first words keep the
  // fixed-width cell grid readable in a terminal.
  const labels = decks.map((deck) => deck.name.split(' ')[0]);
  const labelW = Math.max(...labels.map((label) => label.length)) + 2;
  const lines: string[] = [
    `=== ${title} ROUND-ROBIN - row-deck win %, neutral ${ai} piloting both sides · ${seedsPerCell} seeds/cell ===\n` +
      '    cell = row win % of decided games (decided count, +draws); diagonal skipped',
  ];
  lines.push(''.padEnd(labelW) + labels.map((label) => label.padEnd(CELL_W)).join(' '));
  cells.forEach((row, r) => {
    lines.push(
      labels[r].padEnd(labelW) +
        row.map((cell) => (cell ? pctCell(cell) : '--'.padStart(4).padEnd(CELL_W))).join(' '),
    );
  });
  lines.push('');
  lines.push('PER-DECK AGGREGATE (wins / decided across all matchups):');
  for (const entry of summary) {
    lines.push(
      `  ${entry.name.padEnd(labelW + 8)} ${(entry.rate * 100).toFixed(1).padStart(5)}%  (${entry.wins}/${entry.decided}${entry.draws > 0 ? ` +${entry.draws}d` : ''})`,
    );
  }
  lines.push(`NOTE: ${totalGames} total games across ${n * (n - 1) / 2} cells.`);
  lines.push(
    `LOSSLESSNESS: games played ${losslessness.gamesPlayed}; games decided ${losslessness.gamesDecided}; draws (turn-limit hits) ${losslessness.draws}; engine exceptions ${losslessness.engineExceptions}.`,
  );
  return { cells, summary, totalGames, losslessness, table: lines.join('\n') };
}

/** Starter-derived Warchest field, passed through real reserve validation before play. */
export function runWarchestMatrix(
  seedsPerCell: number,
  ai: Difficulty,
  telemetry?: BalanceTelemetryCollector,
  startingHandSize: number = WARCHEST_HAND_SIZE,
): ReserveMatrixReport {
  return runReserveMatrix('WARCHEST', 'warchest', buildReserveMatrixFleets().warchest, seedsPerCell, ai, 80_000, telemetry, {
    startingHandSize,
  });
}

// The 50-card configs retired at the 2026-08-07 parameter flip: canonical
// lists now author at WARCHEST_DECK_SIZE=40, so a 50-card target is no longer
// buildable. The gate's 50-vs-40 evidence lives in the dated workbench JSONs.
export type WarchestTuningConfigKey =
  | '40-5-nocap'
  | '40-5-cap2'
  | '40-4-nocap'
  | '40-4-cap2';

export interface WarchestTuningConfig {
  key: WarchestTuningConfigKey;
  deckSize: 40;
  startingHandSize: 4 | 5;
  maxReserveColors?: 2;
  cellBase: number;
}

export const WARCHEST_TUNING_CONFIGS: readonly WarchestTuningConfig[] = [
  { key: '40-5-nocap', deckSize: 40, startingHandSize: 5, cellBase: 140_000 },
  { key: '40-5-cap2', deckSize: 40, startingHandSize: 5, maxReserveColors: 2, cellBase: 150_000 },
  { key: '40-4-nocap', deckSize: 40, startingHandSize: 4, cellBase: 160_000 },
  { key: '40-4-cap2', deckSize: 40, startingHandSize: 4, maxReserveColors: 2, cellBase: 170_000 },
];

export interface WarchestTuningArtifact {
  schemaVersion: 1;
  mode: 'warchest-tuning';
  date: string;
  config: WarchestTuningConfig;
  seedsPerCell: number;
  ai: Difficulty;
  field: {
    included: {
      id: string;
      name: string;
      kind: 'roster' | 'probe';
      colors: readonly string[];
      cards: string[];
      landReserve: string[];
    }[];
    excluded: WarchestTuningField['excluded'];
    trims: WarchestTuningField['trimmed'];
  };
  results: Pick<ReserveMatrixReport, 'summary' | 'totalGames' | 'losslessness'>;
  telemetry: BalanceTelemetryJson;
}

export interface WarchestTuningRun {
  config: WarchestTuningConfig;
  field: WarchestTuningField;
  report: ReserveMatrixReport;
  artifact: WarchestTuningArtifact;
  table: string;
}

function renderWarchestTuningHeadlines(
  report: ReserveMatrixReport,
  telemetry: BalanceTelemetryJson,
): string {
  const byName = new Map(telemetry.decks.map((deck) => [deck.deckName, deck]));
  const lines = [
    'TUNING HEADLINES (per-deck means):',
    '  deck                              win% games cleanup clog turns cleanup-fuel stranded mulligans',
  ];
  for (const result of report.summary) {
    const deck = byName.get(result.name);
    if (!deck) throw new Error(`Missing tuning telemetry for ${result.name}`);
    lines.push(
      `  ${result.name.slice(0, 32).padEnd(32)} ` +
      `${(result.rate * 100).toFixed(1).padStart(5)} ` +
      `${String(deck.games).padStart(5)} ` +
      `${deck.meanCleanupDiscards.toFixed(2).padStart(7)} ` +
      `${deck.meanHandCloggedTurns.toFixed(2).padStart(4)} ` +
      `${deck.meanTurns.toFixed(1).padStart(5)} ` +
      `${(deck.graveyardFuelFromCleanupShare * 100).toFixed(1).padStart(11)}% ` +
      `${(deck.colorStrandedTurnsRate * 100).toFixed(1).padStart(7)}% ` +
      `${deck.meanMulligans.toFixed(2).padStart(9)}`,
    );
  }
  return lines.join('\n');
}

/** Run one single-threaded, telemetry-mandatory tuning config. */
export function runWarchestTuningConfig(
  config: WarchestTuningConfig,
  seedsPerCell: number,
  ai: Difficulty,
  date: string,
): WarchestTuningRun {
  const field = buildWarchestTuningField(config.deckSize, config.maxReserveColors);
  const telemetry = new BalanceTelemetryCollector();
  const report = runReserveMatrix(
    `WARCHEST TUNING ${config.key}`,
    'warchest',
    field.decks,
    seedsPerCell,
    ai,
    config.cellBase,
    telemetry,
    { startingHandSize: config.startingHandSize, telemetryMatrix: config.key },
  );
  const telemetryJson = telemetry.toJSON();
  const artifact: WarchestTuningArtifact = {
    schemaVersion: 1,
    mode: 'warchest-tuning',
    date,
    config: { ...config },
    seedsPerCell,
    ai,
    field: {
      included: field.decks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        kind: deck.id.startsWith('warchest-probe-') ? 'probe' : 'roster',
        colors: [...deck.colors],
        cards: deck.cards.slice(),
        landReserve: deck.landReserve.slice(),
      })),
      excluded: structuredClone(field.excluded),
      trims: structuredClone(field.trimmed),
    },
    results: {
      summary: structuredClone(report.summary),
      totalGames: report.totalGames,
      losslessness: { ...report.losslessness },
    },
    telemetry: telemetryJson,
  };
  return {
    config,
    field,
    report,
    artifact,
    table: `${report.table}\n\n${renderWarchestTuningHeadlines(report, telemetryJson)}`,
  };
}

/** Deterministic color-spread Darlings field, passed through real reserve validation before play. */
export function runDarlingsMatrix(
  seedsPerCell: number,
  ai: Difficulty,
  telemetry?: BalanceTelemetryCollector,
  // Ratified 2026-08-08 from the 5-vs-7 measurement: Darlings deals the same
  // 5-card reserve opener as Warchest. --hand-size still overrides for sims.
  startingHandSize: number = WARCHEST_HAND_SIZE,
): ReserveMatrixReport {
  return runReserveMatrix('DARLINGS', 'darlings', buildReserveMatrixFleets().darlings, seedsPerCell, ai, 90_000, telemetry, {
    startingHandSize,
  });
}

/** Curated five-Darling shop field, retaining the reviewed singleton deck identities. */
/**
 * Every deck a player can own, head to head in Warchest (5 starters + 6 theme
 * precons, reserve builds). The avatar ladder's per-column averages conflate
 * deck power with avatar power; this isolates deck power so the migration's
 * card-quality work targets the right lists.
 */
export function runPlayerDeckMatrix(
  seedsPerCell: number,
  ai: Difficulty,
  telemetry?: BalanceTelemetryCollector,
): ReserveMatrixReport {
  const decks: ReserveMatrixDeck[] = [...STARTER_DECKS, ...THEME_DECKS].map((deck) => {
    if (!deck.reserveCards || !deck.landReserve) {
      throw new Error(`Deck ${deck.id} has no reserve build; regenerate src/data/starterDecks.ts`);
    }
    const colors = (['W', 'U', 'B', 'R', 'G'] as const).filter((color) =>
      deck.reserveCards!.some((id) => CARD_DB[id]?.colors.includes(color)),
    );
    return {
      id: deck.id,
      name: deck.name,
      colors,
      cards: deck.reserveCards,
      landReserve: deck.landReserve,
      darlingId: null,
    };
  });
  return runReserveMatrix('PLAYER DECKS (WARCHEST)', 'warchest', decks, seedsPerCell, ai, 210_000, telemetry, {
    startingHandSize: WARCHEST_HAND_SIZE,
  });
}

export function runDarlingsPreconMatrix(
  seedsPerCell: number,
  ai: Difficulty,
  telemetry?: BalanceTelemetryCollector,
): ReserveMatrixReport {
  return runReserveMatrix('DARLINGS PRECONS', 'darlings', DARLINGS_PRECON_MATRIX_FLEET, seedsPerCell, ai, 110_000, telemetry);
}

export interface DifficultyMatrixReport {
  cells: CellResult[][]; // [row difficulty][col difficulty]
  flags: string[];
  table: string;
}

const DIFFS: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Easy/Medium/Hard round-robin on a fixed deck pair. Decks AND sides alternate
 * across seeds (the winrate.test.ts idiom) so neither brain owns the better
 * deck.
 */
export function runDifficultyMatrix(
  seedsPerCell: number,
  telemetry?: BalanceTelemetryCollector,
): DifficultyMatrixReport {
  const deckA = STARTER_DECKS[0].cards; // Crimson Muster
  const deckB = STARTER_DECKS[1].cards; // Wild Communion
  const cells = DIFFS.map((rowDiff, r) =>
    DIFFS.map((colDiff, c) =>
      runCell(
        {
          rowAI: (seed) => buildAI(rowDiff, CARD_DB, seed),
          colAI: (seed) => buildAI(colDiff, CARD_DB, seed),
          decks: (i) => (i % 4 < 2 ? [deckA, deckB] : [deckB, deckA]),
        },
        seedsPerCell,
        20_000 + r * 10 + c,
        undefined,
        cellTelemetry(
          telemetry,
          'difficulty',
          `${rowDiff} (alternating starters)`,
          `${colDiff} (alternating starters)`,
        ),
      ),
    ),
  );
  const flags: string[] = [];
  for (let hi = 1; hi < DIFFS.length; hi++) {
    for (let lo = 0; lo < hi; lo++) {
      if (cells[hi][lo].rate < 0.5) {
        flags.push(
          `Inversion: ${DIFFS[hi]} beats ${DIFFS[lo]} only ${(cells[hi][lo].rate * 100).toFixed(0)}% on this deck pair`,
        );
      }
    }
  }
  const table = renderTable(
    `=== DIFFICULTY ROUND-ROBIN — row brain win % · ${STARTER_DECKS[0].name} / ${STARTER_DECKS[1].name} (alternating) · ${seedsPerCell} seeds/cell ===`,
    DIFFS.map((d) => d),
    DIFFS.map((d) => d),
    cells,
  );
  return { cells, flags, table };
}

export interface TierRow {
  tier: TowerTier;
  cells: CellResult[]; // one same-deck mirror per starter, STARTER_DECKS order
  avg: number;
}

export interface TierMatrixReport {
  rows: TierRow[];
  flags: string[];
  table: string;
}

const TOWER_TIERS: readonly TowerTier[] = [1, 2, 3, 4, 5, 6];
const MIN_TIER_GAP = 0.04;

export function tierMonotonicityFlags(
  rows: readonly Pick<TierRow, 'tier' | 'avg'>[],
): string[] {
  const flags: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1];
    const current = rows[i];
    // Keep an exact 4pp boundary from failing on binary floating-point drift.
    if (current.avg - previous.avg < MIN_TIER_GAP - 1e-12) {
      flags.push(
        `Tier separation: T${current.tier} avg ${(current.avg * 100).toFixed(1)}% is less than 4pp above T${previous.tier} avg ${(previous.avg * 100).toFixed(1)}%`,
      );
    }
  }
  return flags;
}

/**
 * The reserve mirror columns the tier and probe ladders both measure against:
 * each reference starter's shipped Warchest build, piloted by both seats.
 */
function tierMirrorColumns(): { name: string; cards: string[]; landReserve: string[] }[] {
  return STARTER_DECKS.map((starter) => {
    if (!starter.reserveCards || !starter.landReserve) {
      throw new Error(`Starter ${starter.id} has no reserve build; regenerate src/data/starterDecks.ts`);
    }
    return { name: starter.name, cards: starter.reserveCards, landReserve: starter.landReserve };
  });
}

/**
 * One row of the ladder: a (brain, noise) dial vs a neutral Medium proxy
 * across all five reference starters. Same-deck mirrors isolate the strength
 * dial from prefab deck power; runCell alternates sides and supplies stable
 * per-cell seeds.
 *
 * Reserve-native since classic retired (2026-08-10) — the same defect the
 * floor matrix had. Pricing a tier on decks the game no longer plays would
 * calibrate the whole tower against a dead format.
 */
function runDialRow(
  brain: Difficulty,
  noise: number,
  seedsPerCell: number,
  seedBase: number,
  label: string,
  telemetry: BalanceTelemetryCollector | undefined,
  telemetryMatrix: string,
): CellResult[] {
  return tierMirrorColumns().map((starter, starterIndex) =>
    runCell(
      {
        rowAI: (seed) => buildDialAI(brain, noise, CARD_DB, seed, DEFAULT_PERSONALITY),
        colAI: () => new MediumAI(CARD_DB, DEFAULT_PERSONALITY),
        decks: () => [starter.cards, starter.cards],
        format: 'warchest',
        reserves: () => [starter.landReserve, starter.landReserve],
        startingHandSize: WARCHEST_HAND_SIZE,
      },
      seedsPerCell,
      seedBase + starterIndex,
      undefined,
      cellTelemetry(telemetry, telemetryMatrix, `${label}: ${starter.name}`, starter.name),
    ),
  );
}

export function runTierMatrix(
  seedsPerCell: number,
  telemetry?: BalanceTelemetryCollector,
): TierMatrixReport {
  const rows = TOWER_TIERS.map((tier) => {
    const def = TIER_DEFS[tier];
    const cells = runDialRow(
      def.brain,
      def.noise,
      seedsPerCell,
      50_000 + tier * 10,
      `Tier ${tier}`,
      telemetry,
      'tiers',
    );
    return { tier, cells, avg: mean(cells.map((cell) => cell.rate)) };
  });

  const flags = tierMonotonicityFlags(rows);

  const matrix = renderTable(
    `=== TOWER TIERS - tier win % vs neutral Medium mirror \u00b7 ${seedsPerCell} seeds/cell ===\n` +
      '    each tier and proxy pilot the same named starter; decided games (+draws)',
    rows.map((row) => {
      const def = TIER_DEFS[row.tier];
      return `T${row.tier} [${def.brain}, noise ${def.noise}]`;
    }),
    STARTER_DECKS.map((starter) => shortName(starter.name)),
    rows.map((row) => row.cells),
    (index) => `| avg ${(rows[index].avg * 100).toFixed(1).padStart(5)}%`,
  );
  const table =
    matrix +
    `\n\nMONOTONICITY: ${flags.length === 0 ? 'PASS (every adjacent tier gains at least 4pp)' : `FAIL (${flags.length} adjacent separation${flags.length === 1 ? '' : 's'} below 4pp)`}`;
  return { rows, flags, table };
}

/**
 * Candidate dials probed for a NEW tier, deliberately outside `TIER_DEFS` so
 * nobody has to temporarily edit the shipped ladder to measure one.
 *
 * WHY THESE: the T3 -> T4 step is the widest gap on the ladder (+19.6pp on the
 * 2026-08-10 reserve floors, against 5.9-13.8 elsewhere), and both ends are the
 * SAME brain — medium — separated only by noise. The 2026-07-20 classic tuning
 * log recorded a flat shelf: medium noise 0.02..0.28 all landed 38-43%, which
 * is almost exactly the midpoint of today's T3 (33.8) and T4 (53.4). If that
 * shelf survives the move to the reserve field, a tier sits on it and the cliff
 * halves. These three points sample the shelf's middle and both approaches.
 *
 * The classic log also recorded 0.20 measuring ABOVE 0.05 (43.0 vs 40.1 at 40
 * seeds) — an inversion, i.e. the shelf is flat enough that sampling noise
 * outweighs the dial. So read these three as one plateau estimate, not as a
 * ranking, and do not pick between them on a sub-3pp difference.
 */
const TIER_PROBE_DIALS: readonly { label: string; brain: Difficulty; noise: number }[] = [
  { label: 'medium/0.10', brain: 'medium', noise: 0.10 },
  { label: 'medium/0.15', brain: 'medium', noise: 0.15 },
  { label: 'medium/0.20', brain: 'medium', noise: 0.20 },
];

export interface TierProbeReport {
  rows: { label: string; cells: CellResult[]; avg: number }[];
  flags: string[];
  table: string;
}

/**
 * Price candidate tier dials on the same harness the shipped ladder uses, so
 * a probe row and a `--tiers` row are directly comparable.
 */
export function runTierProbeMatrix(
  seedsPerCell: number,
  telemetry?: BalanceTelemetryCollector,
): TierProbeReport {
  const rows = TIER_PROBE_DIALS.map((dial, index) => {
    const cells = runDialRow(
      dial.brain,
      dial.noise,
      seedsPerCell,
      60_000 + index * 10,
      dial.label,
      telemetry,
      'tier-probe',
    );
    return { label: dial.label, cells, avg: mean(cells.map((cell) => cell.rate)) };
  });
  const table = renderTable(
    `=== TIER PROBE - candidate dial win % vs neutral Medium mirror · ${seedsPerCell} seeds/cell ===\n` +
      '    reserve-native same-deck mirrors; candidates are NOT shipped tiers',
    rows.map((row) => row.label.padEnd(11)),
    STARTER_DECKS.map((starter) => shortName(starter.name)),
    rows.map((row) => row.cells),
    (index) => `| avg ${(rows[index].avg * 100).toFixed(1).padStart(5)}%`,
  );
  return { rows, flags: [], table };
}

export interface FloorRow {
  floor: number;
  tier: TowerTier;
  cells: CellResult[]; // one per starter, STARTER_DECKS order
  avg: number;
}

export interface FloorMatrixReport {
  rows: FloorRow[];
  flags: string[];
  table: string;
}

/**
 * Floor guidance bands for the ROTATING tower (1.3 Pillar 1): a floor's
 * difficulty is its TIER strength marginalized over the whole avatar roster
 * (the daily shuffle can put any avatar on any floor), so rows here average
 * the roster rather than pin one avatar. Within-tier floors are statistically
 * identical by construction (same tier, same roster marginal); bands gate the
 * TIER plateaus and are wide on purpose - regressions, not tuning jitter.
 *
 * MEASURED BASELINE - 2026-08-10, `npx tsx scripts/balance-matrix.ts --floors
 * --seeds 80` (20 floors x 5 starters, roster round-robin, 8,000 games), the
 * FIRST reserve-native floor measurement, taken the day classic retired:
 *   T1 floors 1-3:   17.8 / 21.3 / 22.0        avg 20.4
 *   T2 floors 4-6:   27.8 / 26.5 / 24.5        avg 26.3
 *   T3 floors 7-9:   35.5 / 34.0 / 31.8        avg 33.8
 *   T4 floors 10-12: 52.8 / 52.3 / 55.0        avg 53.4
 *   T5 floors 13-15: 61.5 / 59.0 / 58.5        avg 59.7
 *   T6 floors 16-20: 72.0 / 75.8 / 74.5 / 73.8 / 71.0   avg 73.4
 * FLAGS none. Clean tier plateaus, monotonic, every adjacent gap >= 4pp
 * (smallest T1->T2 +5.9pp); ~2.4pp SE per row avg (400 games).
 *
 * THE TOWER SURVIVED THE FORMAT CHANGE. Against the prior classic baselines
 * (2026-07-24 for T1-T5, the 2026-07-31 W7 re-baseline for T6) every tier
 * moved less than 3.5pp: T1 -2.9, T2 -3.2, T3 +0.0, T4 +2.8, T5 -1.1,
 * T6 +3.4. The owner's standing pre-authorization for a DOWNWARD floor
 * re-centre was therefore NOT spent - re-centring a ladder this stable would
 * have moved numbers nothing measured. Two shape observations that are not
 * band violations and remain open: the T3->T4 step is a +19.6pp cliff at
 * floors 9->10 (medium/0.32 -> medium/0, the widest gap on the ladder), and
 * Shadow Mandate is the weakest player column throughout (66-90% against
 * T4+), consistent with its 36.3 in the head-to-head table.
 *
 * Bands are unchanged and still hold with margin; they gate regressions, not
 * tuning jitter. Floors 19-20 gained bands here - the roster reached 20
 * avatars, so runFloorMatrix generates 20 floors, but FLOOR_BANDS stopped at
 * 18 and left the two summit floors ungated.
 */
export const FLOOR_BANDS: Readonly<Record<number, RungBand>> = Object.freeze({
  1: { maxAvg: 0.33, cellMax: 0.5 },
  2: { maxAvg: 0.33, cellMax: 0.5 },
  3: { maxAvg: 0.33, cellMax: 0.5 },
  4: { minAvg: 0.2, maxAvg: 0.42 },
  5: { minAvg: 0.2, maxAvg: 0.42 },
  6: { minAvg: 0.2, maxAvg: 0.42 },
  7: { minAvg: 0.24, maxAvg: 0.45 },
  8: { minAvg: 0.24, maxAvg: 0.45 },
  9: { minAvg: 0.24, maxAvg: 0.45 },
  10: { minAvg: 0.4, maxAvg: 0.62 },
  11: { minAvg: 0.4, maxAvg: 0.62 },
  12: { minAvg: 0.4, maxAvg: 0.62 },
  13: { minAvg: 0.5, maxAvg: 0.72 },
  14: { minAvg: 0.5, maxAvg: 0.72 },
  15: { minAvg: 0.5, maxAvg: 0.72 },
  16: { minAvg: 0.68 },
  // Measured 2026-07-24 at 80 seeds: F17 73.1 / F18 72.5 - the T6 plateau
  // holds across the Dark Tales summit floors with 4.5pp+ margin over 68.
  17: { minAvg: 0.68 },
  18: { minAvg: 0.68 },
  // Floors 19-20 were ungated until 2026-08-10 simply because the roster grew
  // to 20 after these bands were written. Reserve-native measurement at 80
  // seeds: F19 73.8 / F20 71.0, so the same T6 floor keeps 3.0pp+ margin.
  19: { minAvg: 0.68 },
  20: { minAvg: 0.68 },
});

/**
 * The rotating tower's floor difficulty: floorTier's (brain, noise) piloting
 * the avatar roster round-robin (game i uses avatar i mod roster) vs the
 * Medium-proxied starters. One pass measures the tower as the player meets
 * it: floor strength from the tier dial, deck/personality flavor averaged
 * over the daily shuffle's distribution.
 */
export function runFloorMatrix(
  seedsPerCell: number,
  telemetry?: BalanceTelemetryCollector,
): FloorMatrixReport {
  const roster = [...AVATARS].sort((a, b) => a.tier - b.tier);
  const floors = Array.from({ length: roster.length }, (_, i) => i + 1);
  // Reserve-native since classic retired (2026-08-10): the Tower fields each
  // avatar's designed reserveDeck against the shipped starter reserve builds,
  // which is exactly what DuelScene's gauntlet path now seats. Measuring the
  // classic decks here would price a format the game no longer plays.
  const columns = STARTER_DECKS.map((starter) => {
    if (!starter.reserveCards || !starter.landReserve) {
      throw new Error(`Starter ${starter.id} has no reserve build; regenerate src/data/starterDecks.ts`);
    }
    return { name: starter.name, cards: starter.reserveCards, landReserve: starter.landReserve };
  });
  const rows: FloorRow[] = floors.map((floor) => {
    const tier = floorTier(floor);
    const cells = columns.map((starter, sIdx) =>
      runCell(
        {
          rowAI: (seed, gameIndex) =>
            buildTierAI(tier, CARD_DB, seed, roster[gameIndex % roster.length].personality),
          colAI: () => new MediumAI(CARD_DB),
          decks: (i) => [roster[i % roster.length].reserveDeck, starter.cards],
          format: 'warchest',
          reserves: (i) => [roster[i % roster.length].landReserve, starter.landReserve],
          startingHandSize: WARCHEST_HAND_SIZE,
        },
        seedsPerCell,
        70_000 + floor * 100 + sIdx,
        undefined,
        cellTelemetry(telemetry, 'floors', `Floor ${floor} rotating avatar`, starter.name),
      ),
    );
    return { floor, tier, cells, avg: mean(cells.map((c) => c.rate)) };
  });

  const flags: string[] = [];
  for (const row of rows) {
    const band = FLOOR_BANDS[row.floor] ?? {};
    const tag = `Floor ${row.floor} (T${row.tier})`;
    if (band.maxAvg !== undefined && row.avg > band.maxAvg) {
      flags.push(`${tag}: avg ${(row.avg * 100).toFixed(0)}% ABOVE band max ${band.maxAvg * 100}%`);
    }
    if (band.minAvg !== undefined && row.avg < band.minAvg) {
      flags.push(`${tag}: avg ${(row.avg * 100).toFixed(0)}% BELOW band min ${band.minAvg * 100}%`);
    }
    if (band.cellMax !== undefined) {
      row.cells.forEach((c, i) => {
        if (c.rate > band.cellMax!) {
          flags.push(
            `${tag}: ${shortName(STARTER_DECKS[i].name)} cell ${(c.rate * 100).toFixed(0)}% ABOVE cellMax ${band.cellMax! * 100}%`,
          );
        }
      });
    }
  }

  const table = renderTable(
    `=== TOWER FLOORS - floor win % vs Medium-proxied starters · ${seedsPerCell} seeds/cell ===\n` +
      '    tier brain+noise pilots the avatar roster round-robin per game',
    rows.map((row) => `F${String(row.floor).padStart(2)} [T${row.tier}]`),
    STARTER_DECKS.map((starter) => shortName(starter.name)),
    rows.map((row) => row.cells),
    (index) => `| avg ${(rows[index].avg * 100).toFixed(1).padStart(5)}%`,
  );
  return { rows, flags, table };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const flag = (name: string): boolean => argv.includes(`--${name}`);
  const opt = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const seeds = Number(opt('seeds') ?? 20);
  if (!Number.isInteger(seeds) || seeds <= 0) {
    console.error(`--seeds must be a positive integer (got ${opt('seeds')})`);
    process.exitCode = 1;
    return;
  }
  const only = opt('only')?.split(',').map((s) => s.trim()).filter(Boolean);
  // Sim-only opener override for --warchest / --darlings (e.g. the Darlings
  // 5-vs-7 measurement). Defaults: warchest WARCHEST_HAND_SIZE, darlings 7.
  const handSizeRaw = opt('hand-size');
  const handSize = handSizeRaw === undefined ? undefined : Number(handSizeRaw);
  if (handSize !== undefined && (!Number.isInteger(handSize) || handSize <= 0 || handSize > 7)) {
    console.error(`--hand-size must be an integer between 1 and 7 (got ${handSizeRaw})`);
    process.exitCode = 1;
    return;
  }
  const telemetryOut = opt('telemetry-out');
  if (flag('telemetry-out') && telemetryOut === undefined) {
    console.error('--telemetry-out requires a path');
    process.exitCode = 1;
    return;
  }
  const wantTelemetry = flag('telemetry') || telemetryOut !== undefined;
  const telemetry = wantTelemetry ? new BalanceTelemetryCollector() : undefined;
  const wantStarters = flag('starters');
  const wantDifficulty = flag('difficulty');
  const wantTiers = flag('tiers');
  const wantTierProbe = flag('tier-probe');
  const wantFloors = flag('floors');
  const wantCelticFaeBosses = flag('cf-bosses');
  const wantPrefabs = flag('prefabs');
  const wantArthurianCourtBosses = flag('ac-bosses');
  const wantWarchest = flag('warchest');
  const wantWarchestTuning = flag('warchest-tuning');
  const wantDarlings = flag('darlings');
  const wantDarlingsPrecons = flag('darlings-precons');
  const wantPlayerDecks = flag('player-decks');
  // Reserve avatar ladders (migration stage 2): --avatars-reserve (or the
  // spelled-out --avatars --reserve) and --avatars-darlings.
  const wantAvatarsReserve = flag('avatars-reserve') || (flag('avatars') && flag('reserve'));
  const wantAvatarsDarlings = flag('avatars-darlings');
  const wantAvatars =
    (flag('avatars') && !flag('reserve')) ||
    (!wantStarters &&
      !wantDifficulty &&
      !wantTiers &&
      !wantTierProbe &&
      !wantFloors &&
      !wantCelticFaeBosses &&
      !wantArthurianCourtBosses &&
      !wantPrefabs &&
      !wantWarchest &&
      !wantWarchestTuning &&
      !wantDarlings &&
      !wantDarlingsPrecons &&
      !wantPlayerDecks &&
      !wantAvatarsReserve &&
      !wantAvatarsDarlings);
  const ai = (opt('ai') ?? 'hard') as Difficulty;
  if (!DIFFS.includes(ai)) {
    console.error(`--ai must be one of ${DIFFS.join(' | ')} (got ${opt('ai')})`);
    process.exitCode = 1;
    return;
  }

  if (wantWarchestTuning) {
    const configKey = opt('config');
    const outputArg = opt('out');
    const dateArg = opt('date');
    if (flag('config') && configKey === undefined) {
      console.error('--config requires a key');
      process.exitCode = 1;
      return;
    }
    if (flag('out') && outputArg === undefined) {
      console.error('--out requires a directory');
      process.exitCode = 1;
      return;
    }
    if (flag('date') && dateArg === undefined) {
      console.error('--date requires YYYY-MM-DD');
      process.exitCode = 1;
      return;
    }
    const date = dateArg ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
      console.error(`--date must be a real YYYY-MM-DD date (got ${date})`);
      process.exitCode = 1;
      return;
    }
    const selected = configKey === undefined
      ? [...WARCHEST_TUNING_CONFIGS]
      : WARCHEST_TUNING_CONFIGS.filter((config) => config.key === configKey);
    if (selected.length === 0) {
      console.error(`--config must be one of ${WARCHEST_TUNING_CONFIGS.map((config) => config.key).join(' | ')} (got ${configKey})`);
      process.exitCode = 1;
      return;
    }

    const outputDir = resolve(outputArg ?? 'balance/warchest-tuning');
    const tuningStarted = Date.now();
    mkdirSync(outputDir, { recursive: true });
    for (const config of selected) {
      const run = runWarchestTuningConfig(config, seeds, ai, date);
      for (const trim of run.field.trimmed) {
        const cards = trim.removed
          .map((entry) => `${entry.cardName} [${entry.cardId}] x${entry.count}`)
          .join(', ');
        process.stderr.write(`  trim ${trim.deckName}: ${cards}\n`);
      }
      for (const excluded of run.field.excluded) {
        process.stderr.write(`  excluded ${excluded.deckName} [${excluded.colors.join('')}]: ${excluded.reason}\n`);
      }
      console.log(`\n${run.table}`);
      const outputPath = resolve(outputDir, `${date}-${config.key}.json`);
      writeFileSync(outputPath, JSON.stringify(run.artifact, null, 2) + '\n', 'utf8');
      console.log(`Tuning JSON: ${outputPath}`);
    }
    console.log(`\n(${((Date.now() - tuningStarted) / 1000).toFixed(1)}s)`);
    return;
  }

  const t0 = Date.now();
  const reports: { table: string; flags?: string[] }[] = [];
  if (wantAvatars) reports.push(runAvatarMatrix(seeds, only, telemetry));
  if (wantAvatarsReserve) reports.push(runAvatarReserveMatrix('warchest', seeds, only, telemetry));
  if (wantAvatarsDarlings) reports.push(runAvatarReserveMatrix('darlings', seeds, only, telemetry));
  if (wantStarters) reports.push(runStarterMatrix(seeds, telemetry));
  if (wantDifficulty) reports.push(runDifficultyMatrix(seeds, telemetry));
  if (wantTiers) reports.push(runTierMatrix(seeds, telemetry));
  if (wantTierProbe) reports.push(runTierProbeMatrix(seeds, telemetry));
  if (wantFloors) reports.push(runFloorMatrix(seeds, telemetry));
  if (wantCelticFaeBosses) reports.push(runCelticFaeBossMatrix(seeds, telemetry));
  if (wantArthurianCourtBosses) reports.push(runArthurianCourtBossMatrix(seeds, telemetry));
  if (wantPrefabs) reports.push(runPrefabMatrix(seeds, ai, telemetry));
  if (wantWarchest) reports.push(runWarchestMatrix(seeds, ai, telemetry, handSize ?? WARCHEST_HAND_SIZE));
  if (wantDarlings) reports.push(runDarlingsMatrix(seeds, ai, telemetry, handSize ?? WARCHEST_HAND_SIZE));
  if (wantDarlingsPrecons) reports.push(runDarlingsPreconMatrix(seeds, ai, telemetry));
  if (wantPlayerDecks) reports.push(runPlayerDeckMatrix(seeds, ai, telemetry));

  for (const r of reports) {
    console.log('\n' + r.table);
    if (!r.flags) continue;
    if (r.flags.length === 0) console.log('FLAGS: none.');
    else {
      console.log('FLAGS:');
      for (const f of r.flags) console.log(`  ! ${f}`);
    }
  }
  if (telemetry) console.log('\n' + telemetry.render());
  if (telemetry && telemetryOut) {
    const outputPath = resolve(telemetryOut);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(telemetry.toJSON(), null, 2) + '\n', 'utf8');
    console.log(`Telemetry JSON: ${outputPath}`);
  }
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

// Run only when invoked as a script (tsx scripts/balance-matrix.ts), not when
// imported by the vitest balance suite.
const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invokedPath === resolve(fileURLToPath(import.meta.url)).toLowerCase()) main();
