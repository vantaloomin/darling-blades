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
 *   --prefabs            7x7 prefab round-robin (5 starters + 2 theme decks),
 *                        the same neutral brain both sides (--ai, default
 *                        hard). Upper triangle simmed, mirrored below; prints
 *                        a per-deck aggregate ranking to surface outliers.
 *   --ai <difficulty>    Brain for --prefabs: easy | medium | hard (default
 *                        hard). Neutral (no avatar personality).
 *   --difficulty         Easy/Medium/Hard round-robin on a fixed deck pair
 *                        (Crimson Muster vs Wild Communion, sides + decks
 *                        alternate so no brain owns the better deck).
 *   --tiers              6 tower AI tiers vs the 5 starter decks, each as a
 *                        mirror against a neutral Medium human proxy.
 *   --floors             18 rotating-tower floors (tier brain piloting the
 *                        avatar roster round-robin) vs the 5 starters.
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
import { buildAI, DEFAULT_PERSONALITY } from '../src/ai/personality';
import { buildTierAI, floorTier, TIER_DEFS, type TowerTier } from '../src/ai/tiers';
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
  /**
   * Fresh row-side AI for one game (seeded brains like Easy need the seed).
   * `gameIndex` lets a cell vary its pilot per game (the floor matrix rotates
   * the avatar roster through one cell); most specs ignore it.
   */
  rowAI: (seed: number, gameIndex: number) => AIPlayer;
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
    const row = spec.rowAI(gameSeed * 7 + 1, i);
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
  // 15-16 calibrated 2026-07-17 from fresh 40-seed tower measurements (77.6% /
  // 76.8%; CI margin ~4pp at 40 seeds). The Gothic Monsters summit pair sits
  // clearly above Artoria's 70.8%; the pair itself measured a statistical tie
  // (0.8pp, inside noise), with the ordering expectation (16 >= 15) encoded in
  // the win-rate test floors (72% / 73%), not here. Full tower re-baseline
  // lands with the 1.3 floor-tier model (plan-1.3.md Pillar 1).
  15: { minAvg: 0.7 },
  16: { minAvg: 0.7 },
  // 17-18 calibrated 2026-07-24 from the standard full 40-seed avatar
  // matrix (77% / 87%); floors leave 5pp below each point estimate for CI
  // variance. R17 clears the fresh R16 row by 2pp and R18 is the highest
  // sampled row by 1pp; strict statistical monotonicity is not claimed.
  17: { minAvg: 0.72 },
  18: { minAvg: 0.82 },
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

export interface PrefabMatrixReport {
  /** Full 7x7 grid; lower triangle is the mirror of the upper, diagonal null. */
  cells: (CellResult | null)[][];
  /** Per-deck aggregate (wins / decided across its 6 matchups), sorted desc. */
  summary: { name: string; wins: number; decided: number; draws: number; rate: number }[];
  totalGames: number;
  table: string;
}

/**
 * All 7 prefab decks (5 starters + 2 theme decks) in a round-robin, the SAME
 * neutral brain piloting both sides so only deck strength varies. Only the
 * upper triangle is simulated (sides alternate per game, so cell (r,c) already
 * contains the (c,r) information); the lower triangle is its mirror and the
 * diagonal is skipped. Cell seeds are stable at 40_000 + r * 10 + c.
 */
export function runPrefabMatrix(seedsPerCell: number, ai: Difficulty): PrefabMatrixReport {
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
        40_000 + r * 10 + c,
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
 * Tower tiers vs a neutral Medium proxy across all five reference starters.
 * Same-deck mirrors isolate the strength dial from prefab deck power; runCell
 * alternates sides and supplies stable per-cell seeds.
 */
export function runTierMatrix(seedsPerCell: number): TierMatrixReport {
  const rows = TOWER_TIERS.map((tier) => {
    const cells = STARTER_DECKS.map((starter, starterIndex) =>
      runCell(
        {
          rowAI: (seed) => buildTierAI(tier, CARD_DB, seed, DEFAULT_PERSONALITY),
          colAI: () => new MediumAI(CARD_DB, DEFAULT_PERSONALITY),
          decks: () => [starter.cards, starter.cards],
        },
        seedsPerCell,
        50_000 + tier * 10 + starterIndex,
      ),
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
 * MEASURED BASELINE - 2026-07-20, `npx tsx scripts/balance-matrix.ts --floors
 * --seeds 80` (18 floors x 5 starters, roster round-robin, 7,200 games):
 *   T1 floors 1-3: 23.5 / 21.7 / 21.0   T2 floors 4-6: 28.0 / 33.1 / 29.7
 *   T3 floors 7-9: 33.0 / 30.8 / 35.8   T4 floors 10-12: 50.3 / 48.0 / 54.7
 *   T5 floors 13-15: 59.9 / 60.3 / 58.4 T6 floors 16-18: provisional
 *   (re-measured 2026-07-20 after the prefab tuning pass touched the
 *   Wild Communion reference starter; every floor moved < 3pp.)
 * Clean tier plateaus, no flags; ~2.4pp SE per row avg (400 games). Bands
 * leave ~7pp margin beyond the measured plateau edges.
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
  // Provisional until the requested 18-floor re-baseline. Mirror the T6
  // shape for both new Dark Tales summit floors without claiming measurements.
  17: { minAvg: 0.68 },
  18: { minAvg: 0.68 },
});

/**
 * The rotating tower's floor difficulty: floorTier's (brain, noise) piloting
 * the avatar roster round-robin (game i uses avatar i mod roster) vs the
 * Medium-proxied starters. One pass measures the tower as the player meets
 * it: floor strength from the tier dial, deck/personality flavor averaged
 * over the daily shuffle's distribution.
 */
export function runFloorMatrix(seedsPerCell: number): FloorMatrixReport {
  const roster = [...AVATARS].sort((a, b) => a.tier - b.tier);
  const floors = Array.from({ length: roster.length }, (_, i) => i + 1);
  const rows: FloorRow[] = floors.map((floor) => {
    const tier = floorTier(floor);
    const cells = STARTER_DECKS.map((starter, sIdx) =>
      runCell(
        {
          rowAI: (seed, gameIndex) =>
            buildTierAI(tier, CARD_DB, seed, roster[gameIndex % roster.length].personality),
          colAI: () => new MediumAI(CARD_DB),
          decks: (i) => [roster[i % roster.length].deck, starter.cards],
        },
        seedsPerCell,
        70_000 + floor * 100 + sIdx,
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
  const wantStarters = flag('starters');
  const wantDifficulty = flag('difficulty');
  const wantTiers = flag('tiers');
  const wantFloors = flag('floors');
  const wantCelticFaeBosses = flag('cf-bosses');
  const wantPrefabs = flag('prefabs');
  const wantArthurianCourtBosses = flag('ac-bosses');
  const wantAvatars =
    flag('avatars') ||
    (!wantStarters &&
      !wantDifficulty &&
      !wantTiers &&
      !wantFloors &&
      !wantCelticFaeBosses &&
      !wantArthurianCourtBosses &&
      !wantPrefabs);
  const ai = (opt('ai') ?? 'hard') as Difficulty;
  if (!DIFFS.includes(ai)) {
    console.error(`--ai must be one of ${DIFFS.join(' | ')} (got ${opt('ai')})`);
    process.exitCode = 1;
    return;
  }

  const t0 = Date.now();
  const reports: { table: string; flags?: string[] }[] = [];
  if (wantAvatars) reports.push(runAvatarMatrix(seeds, only));
  if (wantStarters) reports.push(runStarterMatrix(seeds));
  if (wantDifficulty) reports.push(runDifficultyMatrix(seeds));
  if (wantTiers) reports.push(runTierMatrix(seeds));
  if (wantFloors) reports.push(runFloorMatrix(seeds));
  if (wantCelticFaeBosses) reports.push(runCelticFaeBossMatrix(seeds));
  if (wantArthurianCourtBosses) reports.push(runArthurianCourtBossMatrix(seeds));
  if (wantPrefabs) reports.push(runPrefabMatrix(seeds, ai));

  for (const r of reports) {
    console.log('\n' + r.table);
    if (!r.flags) continue;
    if (r.flags.length === 0) console.log('FLAGS: none.');
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
