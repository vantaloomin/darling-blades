/**
 * Levers 2 and 3 of docs/plan-sweep-speed.md, the statistics half: racing a
 * proposed swap against the incumbent, and screening it under Medium first.
 *
 * Everything here is pure and deterministic. The hill climb in craft.ts owns
 * the games; this module only decides, from per-game outcomes, when a swap has
 * lost clearly enough to stop measuring it.
 *
 * THE RACE is a one-sided group sequential test for futility on PAIRED games.
 * A candidate and the incumbent are measured on the same game seeds (a game's
 * seed derives from its matchup and its index, never from the deck), so game j
 * of the candidate and game j of the incumbent are a pair: same shuffle seed,
 * same opponent, same seat, one card different. The statistic is the paired
 * difference d_j = v(candidate_j) - v(incumbent_j) with v = 1 win, 1/2 draw,
 * 0 loss, pooled over every matchup, standardised as a t statistic. At each
 * interim look (after `batch`, 2 x `batch`, ... seeds per matchup, short of
 * the full count) the race stops the candidate when that statistic falls below
 * -c. The full look is not a test: a candidate that reaches it is measured in
 * full and accepted or rejected by the hill climb's ordinary rule, so a clear
 * winner always runs the full 150 seeds and an accepted swap always carries its
 * full-precision measurement.
 *
 * Repeated looks inflate false stops, so c is not the one-look critical value.
 * It is the constant (Pocock-type) boundary that holds the probability of
 * stopping at ANY interim look, when the candidate is exactly as good as the
 * incumbent, to `alpha`, computed exactly for the look schedule from the
 * canonical joint distribution of a group sequential statistic (Jennison and
 * Turnbull, "Group Sequential Methods", ch. 3 and 19) by recursive numerical
 * integration. `tests/personas/lever.test.ts` checks it against Pocock's
 * published constants.
 *
 * THE SCREEN is not a test. It is the plan's threshold rule: measure the
 * candidate and the incumbent under Medium on the same seeds, and drop the
 * candidate when Medium scores it worse by more than `threshold` points. Only
 * the Hard measurement ever accepts a swap.
 */

export const DEFAULT_RACE_BATCH = 30;
export const DEFAULT_RACE_ALPHA = 0.01;
export const DEFAULT_SCREEN_THRESHOLD = 5;

/** Recorded in the run configuration, so a merge refuses to mix raced and unraced crafts. */
export interface RaceConfig {
  /** Seeds per matchup between looks. */
  batch: number;
  /** The one-sided probability of stopping an equal candidate at any interim look. */
  alpha: number;
}

export interface ScreenConfig {
  difficulty: 'medium';
  /** A candidate Medium scores worse than the incumbent by MORE than this many points is dropped. */
  threshold: number;
  /** Seeds per matchup for each Medium measurement. */
  seeds: number;
}

/** The race as the hill climb runs it: the config plus its look schedule and boundary. */
export interface RacePlan extends RaceConfig {
  /** Seeds per matchup at each interim look, ascending, all short of the full count. */
  looks: number[];
  /** Stop when the paired statistic is below minus this. */
  boundary: number;
}

// --- the normal distribution -------------------------------------------------

/**
 * Complementary error function, Numerical Recipes' Chebyshev fit (fractional
 * error below 1.2e-7 everywhere). Ample for a boundary rounded to 1e-3.
 */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const ans = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? ans : 2 - ans;
}

export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

// --- the boundary ------------------------------------------------------------

const GRID_POINTS = 401; // odd, for Simpson's rule
const GRID_SPREAD = 8; // standard deviations above zero kept on the grid

function simpsonWeights(n: number, step: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    (i === 0 || i === n - 1 ? 1 : i % 2 === 1 ? 4 : 2) * step / 3);
}

/**
 * P(Z_k <= -c at some look k) for the canonical group sequential statistic
 * Z_k = W(t_k) / sqrt(t_k) of a standard Brownian motion W, with no drift (the
 * candidate exactly as good as the incumbent). Recursive numerical integration
 * of W's density on the continuation region, look by look.
 */
export function crossingProbability(boundary: number, fractions: readonly number[]): number {
  if (fractions.length === 0) return 0;
  let total = normalCdf(-boundary);
  let t = fractions[0];
  const firstLow = -boundary * Math.sqrt(t);
  const firstStep = (GRID_SPREAD * Math.sqrt(t) - firstLow) / (GRID_POINTS - 1);
  let grid = Array.from({ length: GRID_POINTS }, (_, i) => firstLow + i * firstStep);
  let density = grid.map((w) => normalPdf(w / Math.sqrt(t)) / Math.sqrt(t));
  let weights = simpsonWeights(GRID_POINTS, firstStep);

  for (let k = 1; k < fractions.length; k++) {
    const next = fractions[k];
    const spread = Math.sqrt(next - t);
    const nextLow = -boundary * Math.sqrt(next);
    // Stopping at this look: continue from every surviving point, land below the boundary.
    for (let i = 0; i < GRID_POINTS; i++) {
      total += weights[i] * density[i] * normalCdf((nextLow - grid[i]) / spread);
    }
    if (k === fractions.length - 1) break;
    // The density of W at this look, on its own continuation region.
    const nextStep = (GRID_SPREAD * Math.sqrt(next) - nextLow) / (GRID_POINTS - 1);
    const nextGrid = Array.from({ length: GRID_POINTS }, (_, i) => nextLow + i * nextStep);
    const nextDensity = nextGrid.map((w) => {
      let sum = 0;
      for (let i = 0; i < GRID_POINTS; i++) {
        sum += weights[i] * density[i] * normalPdf((w - grid[i]) / spread);
      }
      return sum / spread;
    });
    t = next;
    grid = nextGrid;
    density = nextDensity;
    weights = simpsonWeights(GRID_POINTS, nextStep);
  }
  return total;
}

/**
 * The constant boundary c with crossingProbability(c, fractions) = alpha,
 * rounded UP to 1e-3 (a rounded boundary is a slightly stricter one, never a
 * looser one, and the rounding keeps the stop decision independent of the
 * last bits of the integration).
 */
export function sequentialBoundary(alpha: number, fractions: readonly number[]): number {
  if (!(alpha > 0 && alpha < 0.5)) throw new Error(`race alpha must be above 0 and below 0.5 (got ${alpha})`);
  if (fractions.length === 0) return Number.POSITIVE_INFINITY;
  for (const [index, fraction] of fractions.entries()) {
    if (!(fraction > 0 && fraction <= 1) || (index > 0 && fraction <= fractions[index - 1])) {
      throw new Error(`look fractions must ascend within (0, 1] (got ${fractions.join(', ')})`);
    }
  }
  let low = 0;
  let high = 10;
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    if (crossingProbability(middle, fractions) > alpha) low = middle;
    else high = middle;
  }
  return Math.ceil(high * 1000) / 1000;
}

/** Interim looks, in seeds per matchup: batch, 2 x batch, ... strictly short of `seeds`. */
export function raceLooks(seeds: number, batch: number): number[] {
  const looks: number[] = [];
  for (let look = batch; look < seeds; look += batch) looks.push(look);
  return looks;
}

const planCache = new Map<string, RacePlan>();

/** The race for a measurement of `seeds` per matchup. Cached: the boundary costs a moment to integrate. */
export function racePlan(config: RaceConfig, seeds: number): RacePlan {
  const key = `${config.batch}|${config.alpha}|${seeds}`;
  const cached = planCache.get(key);
  if (cached) return { ...cached, looks: [...cached.looks] };
  const looks = raceLooks(seeds, config.batch);
  if (looks.length === 0) {
    throw new Error(
      `--race-batch ${config.batch} must be below --seeds ${seeds}: with no interim look the race never stops anything`,
    );
  }
  const plan: RacePlan = {
    batch: config.batch,
    alpha: config.alpha,
    looks,
    boundary: sequentialBoundary(config.alpha, looks.map((look) => look / seeds)),
  };
  planCache.set(key, plan);
  return { ...plan, looks: [...plan.looks] };
}

// --- per-game outcomes -------------------------------------------------------

/**
 * One measurement's games, per matchup, as a string of the row's results in
 * game-index order: W (row won), L (row lost), D (draw). Plain JSON, so the
 * incumbent's outcomes ride in a checkpoint.
 */
export type GameOutcomes = string[];

/** Twice the game's value, so every sum below is an exact integer. */
function doubledValue(result: string): number {
  if (result === 'W') return 2;
  if (result === 'D') return 1;
  if (result === 'L') return 0;
  throw new Error(`Unknown game outcome: ${result}`);
}

export interface PairedComparison {
  pairs: number;
  /** Candidate minus incumbent, mean per game on the 1 / 0.5 / 0 scale. */
  meanDifference: number;
  /** The standardised paired difference; negative means the candidate is behind. */
  z: number;
}

/**
 * The paired comparison over the first `seeds` games of every matchup.
 *
 * Two pseudo-pairs, one a full game each way, are added to the spread (not to
 * the sum). That keeps the statistic finite when every pair agrees in a tiny
 * sample, pulls it toward "no difference", and moves nothing at the sweep's
 * sample sizes (hundreds of pairs).
 */
export function pairedComparison(
  candidate: GameOutcomes,
  incumbent: GameOutcomes,
  seeds: number,
): PairedComparison {
  if (candidate.length !== incumbent.length) {
    throw new Error(`paired comparison needs the same matchups (got ${candidate.length} and ${incumbent.length})`);
  }
  let sum = 0;
  let squares = 0;
  let pairs = 0;
  for (let matchup = 0; matchup < candidate.length; matchup++) {
    const ours = candidate[matchup];
    const theirs = incumbent[matchup];
    if (ours.length < seeds || theirs.length < seeds) {
      throw new Error(`paired comparison needs ${seeds} games per matchup (matchup ${matchup} has ${Math.min(ours.length, theirs.length)})`);
    }
    for (let game = 0; game < seeds; game++) {
      const difference = doubledValue(ours[game]) - doubledValue(theirs[game]);
      sum += difference;
      squares += difference * difference;
      pairs++;
    }
  }
  if (pairs === 0) return { pairs, meanDifference: 0, z: 0 };
  // Pseudo-pairs +2 and -2 (doubled units): the sum is unchanged.
  const n = pairs + 2;
  const q = squares + 8;
  const spread = q - (sum * sum) / n;
  const z = sum / Math.sqrt((n * spread) / (n - 1));
  return { pairs, meanDifference: sum / 2 / pairs, z };
}

export interface RaceResult {
  /** Per matchup, the candidate's games played: `seeds` each, or the stopping look's count. */
  outcomes: GameOutcomes;
  /** Raced out: seeds per matchup at the look that stopped it. Absent: it ran the full count. */
  stoppedAt?: number;
  /** Raced out: the paired statistic at that look. */
  z?: number;
}

/**
 * Race one candidate against the incumbent's per-game outcomes. `play(from,
 * to)` plays games [from, to) of every matchup. With no plan (the screen on
 * its own) the candidate simply runs the full count. Deterministic: the same
 * games give the same stop, wherever and in however many processes they ran.
 */
export function raceCandidate(
  plan: RacePlan | undefined,
  incumbent: GameOutcomes,
  seeds: number,
  play: (from: number, to: number) => GameOutcomes,
): RaceResult {
  let outcomes: GameOutcomes = incumbent.map(() => '');
  let played = 0;
  const extendTo = (to: number): void => {
    const more = play(played, to);
    outcomes = outcomes.map((games, index) => games + more[index]);
    played = to;
  };
  for (const look of plan?.looks ?? []) {
    extendTo(look);
    const { z } = pairedComparison(outcomes, incumbent, look);
    if (z < -plan!.boundary) return { outcomes, stoppedAt: look, z };
  }
  extendTo(seeds);
  return { outcomes };
}

// --- the per-swap record -----------------------------------------------------

export type LeverStop = 'screened-out' | 'raced-out' | 'full';

/** One proposed swap under the levers: how far it got, why it stopped, what it cost. */
export interface LeverSwapRecord {
  iteration: number;
  out: string;
  in: string;
  stop: LeverStop;
  accepted: boolean;
  /** Hard games this swap's decision played. */
  hardGames: number;
  /** Medium games this swap's screen played. */
  screenGames: number;
  /** Screen: candidate minus incumbent Medium score, in points (2 decimals). */
  screenDelta?: number;
  /** Race, raced out only: seeds per matchup at the stopping look. */
  racedAt?: number;
  /** Race, raced out only: the paired statistic there (3 decimals). */
  z?: number;
}

/** What the levers journal inside a craft's hill-climb log. Absent on an unraced, unscreened craft. */
export interface LeverLog {
  race?: RacePlan;
  screen?: ScreenConfig;
  /** Games in one full Hard measurement: matchups x seeds. */
  fullGames: number;
  /** The greedy build's full Hard measurement. */
  initialHardGames: number;
  /** The greedy build's Medium measurement, the first incumbent the screen compares against. */
  initialScreenGames: number;
  swaps: LeverSwapRecord[];
}

export interface LeverAccounting {
  proposed: number;
  screenedOut: number;
  racedOut: number;
  measuredInFull: number;
  accepted: number;
  hardGames: number;
  screenGames: number;
  /** What the same proposals cost an unraced, unscreened craft: every one a full Hard measurement. */
  unracedHardGames: number;
}

export function leverAccounting(log: LeverLog): LeverAccounting {
  const count = (stop: LeverStop): number => log.swaps.filter((swap) => swap.stop === stop).length;
  return {
    proposed: log.swaps.length,
    screenedOut: count('screened-out'),
    racedOut: count('raced-out'),
    measuredInFull: count('full'),
    accepted: log.swaps.filter((swap) => swap.accepted).length,
    hardGames: log.initialHardGames + log.swaps.reduce((sum, swap) => sum + swap.hardGames, 0),
    screenGames: log.initialScreenGames + log.swaps.reduce((sum, swap) => sum + swap.screenGames, 0),
    unracedHardGames: log.fullGames * (1 + log.swaps.length),
  };
}

/**
 * Game counts only. There is deliberately no Hard-equivalent estimate: the
 * Medium/Hard speed ratio is a property of the machine and its load, not a
 * constant (measured 2026-09-28, single-threaded, a greedy deck against the
 * 14-deck prefab field: 5.9x to 6.0x on the owner's machine, about 3.4x in the
 * review's run). Wall clock on the runner is the real measure of the saving.
 */
export function leverAccountingLines(accounting: LeverAccounting): string[] {
  const n = (value: number): string => value.toLocaleString('en-US');
  const hardShare = accounting.unracedHardGames === 0 ? 0 : accounting.hardGames / accounting.unracedHardGames;
  return [
    `Levers: ${accounting.proposed} swaps proposed; ${accounting.screenedOut} screened out, ` +
      `${accounting.racedOut} raced out, ${accounting.measuredInFull} measured in full, ${accounting.accepted} accepted`,
    `Levers: ${n(accounting.hardGames)} Hard games (${(hardShare * 100).toFixed(1)}% of unraced) + ` +
      `${n(accounting.screenGames)} Medium games, against ${n(accounting.unracedHardGames)} Hard unraced`,
  ];
}
