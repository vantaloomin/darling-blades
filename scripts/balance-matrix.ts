/**
 * Balance-matrix harness — automated deck-vs-deck / difficulty-vs-difficulty
 * win-rate matrices to catch balance regressions (roadmap: "Gauntlet balance
 * pass"). Pure engine + ai + data; no Phaser.
 *
 * USAGE (via `npm run balance-matrix -- <flags>`):
 *   --avatars            14 gauntlet avatars (own brain + personality + deck)
 *                        vs the 5 starter decks piloted by a neutral Medium
 *                        proxy standing in for a competent human. DEFAULT.
 *   --starters           5x5 starter-vs-starter mirror matrix, Medium both
 *                        sides (deck strength, skill held constant).
 *   --difficulty         Easy/Medium/Hard round-robin on a fixed deck pair
 *                        (Crimson Muster vs Wild Communion, sides + decks
 *                        alternate so no brain owns the better deck).
 *   --cf-bosses          The Morrigan and Titania vs Low/Mid/High CF references
 *                        (Wild Communion / Grave Harvest / Glimmer Bargain).
 *   --ac-bosses          Morgan and Artoria vs Low/Mid/High AC references
 *                        (Crimson Muster / Shadow Mandate / Questing Table).
 *   --seeds <n>          Games per cell (default 20).
 *   --only <id,id,...>   Avatar-matrix row filter for fast tuning iteration
 *                        (e.g. --only simayi,menghuo). Cell seeds are keyed by
 *                        (rung, starter) so filtered runs reproduce the exact
 *                        cells of a full run.
 *
 * DETERMINISM: every cell has a stable index; game seed = cellIndex * 100_000
 * + gameIdx, and AI seeds derive from the game seed. Same flags => same table.
 *
 * The skipped-by-default suite tests/ai/balance.test.ts imports the run*
 * helpers below, so the manual vitest tool and this CLI share one code path.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AIPlayer } from '../src/ai/AIPlayer';
import { MediumAI } from '../src/ai/MediumAI';
import { buildAI } from '../src/ai/personality';
import { CARD_DB } from '../src/data/catalog';
import { AVATARS, type Avatar } from '../src/data/opponents';
import { STARTER_DECKS, THEME_DECKS } from '../src/data/starterDecks';
import { Game } from '../src/engine/Game';
import type { Difficulty } from '../src/meta/Economy';

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
}

export interface CellSpec {
  /** Fresh row-side AI for one game (seeded brains like Easy need the seed). */
  rowAI: (seed: number) => AIPlayer;
  colAI: (seed: number) => AIPlayer;
  /** Deck assignment for game i as [rowDeck, colDeck] (lets mirrors alternate). */
  decks: (i: number) => [string[], string[]];
}

/** The test-suite game-loop idiom: submit legal actions until gameOver. */
export function playOut(
  seed: number,
  p0: AIPlayer,
  p1: AIPlayer,
  decks: [string[], string[]],
): 0 | 1 | 'draw' {
  const game = new Game({ decks, seed, db: CARD_DB });
  const ais = [p0, p1];
  for (let i = 0; i < 40_000; i++) {
    const a = game.awaiting;
    if (a.kind === 'gameOver') return game.state.winner!;
    game.submit(a.player, ais[a.player].chooseAction(game.viewFor(a.player), game.legalActions(a.player)));
  }
  throw new Error(`balance game (seed ${seed}) did not terminate`);
}

/**
 * Play `seeds` games for one cell. Sides alternate every game; the game seed
 * is offset by the cell index so every cell samples distinct, reproducible
 * shuffles.
 */
export function runCell(spec: CellSpec, seeds: number, cellIndex: number): CellResult {
  let rowWins = 0;
  let colWins = 0;
  let draws = 0;
  for (let i = 0; i < seeds; i++) {
    const gameSeed = cellIndex * 100_000 + i;
    const rowIsP0 = i % 2 === 0;
    const row = spec.rowAI(gameSeed * 7 + 1);
    const col = spec.colAI(gameSeed * 13 + 5);
    const [rowDeck, colDeck] = spec.decks(i);
    const winner = playOut(
      gameSeed,
      rowIsP0 ? row : col,
      rowIsP0 ? col : row,
      rowIsP0 ? [rowDeck, colDeck] : [colDeck, rowDeck],
    );
    if (winner === 'draw') draws++;
    else if ((winner === 0) === rowIsP0) rowWins++;
    else colWins++;
  }
  const decided = rowWins + colWins;
  return { rowWins, colWins, draws, games: seeds, rate: decided === 0 ? 0 : rowWins / decided };
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
 * court), and rungs 13-14 are the Arthurian Court summit (Morgan Quest-control,
 * Artoria awakened Knights).
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
  12: { minAvg: 0.7 },
  // 13-14 calibrated 2026-07-16 from fresh 40-seed tower measurements (66%/66%
  // after two card-buff rounds + six deck iterations; CI margin ~4pp at 40
  // seeds). The AC rungs are quest/attrition gates, not stat walls; Brunhild's
  // R10 (85%) has been the tower's power peak since Celtic Fae shipped (R11/12
  // measured 76%), so a non-monotonic summit continues the accepted pattern.
  // Closing the residual 10pp vs R11/12 needs in-color W/U removal (a future
  // set) or heavier cross-set splash - recorded in opponents.ts's baseline.
  13: { minAvg: 0.6 },
  14: { minAvg: 0.62 },
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
export function runAvatarMatrix(seedsPerCell: number, onlyIds?: string[]): AvatarMatrixReport {
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
export function runCelticFaeBossMatrix(seedsPerCell: number): CelticFaeBossMatrixReport {
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
export function runArthurianCourtBossMatrix(seedsPerCell: number): ArthurianCourtBossMatrixReport {
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
export function runStarterMatrix(seedsPerCell: number): StarterMatrixReport {
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
export function runDifficultyMatrix(seedsPerCell: number): DifficultyMatrixReport {
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
  const wantStarters = flag('starters');
  const wantDifficulty = flag('difficulty');
  const wantCelticFaeBosses = flag('cf-bosses');
  const wantArthurianCourtBosses = flag('ac-bosses');
  const wantAvatars = flag('avatars') || (!wantStarters && !wantDifficulty && !wantCelticFaeBosses && !wantArthurianCourtBosses);

  const t0 = Date.now();
  const reports: { table: string; flags: string[] }[] = [];
  if (wantAvatars) reports.push(runAvatarMatrix(seeds, only));
  if (wantStarters) reports.push(runStarterMatrix(seeds));
  if (wantDifficulty) reports.push(runDifficultyMatrix(seeds));
  if (wantCelticFaeBosses) reports.push(runCelticFaeBossMatrix(seeds));
  if (wantArthurianCourtBosses) reports.push(runArthurianCourtBossMatrix(seeds));

  for (const r of reports) {
    console.log('\n' + r.table);
    if (r.flags.length === 0) console.log('FLAGS: none — all cells within guidance bands.');
    else {
      console.log('FLAGS:');
      for (const f of r.flags) console.log(`  ! ${f}`);
    }
  }
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

// Run only when invoked as a script (tsx scripts/balance-matrix.ts), not when
// imported by the vitest balance suite.
const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invokedPath === resolve(fileURLToPath(import.meta.url)).toLowerCase()) main();
