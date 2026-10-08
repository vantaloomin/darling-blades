import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRngState, rngFloat } from '../../src/engine/rng';
import {
  buildGreedyDeck,
  cardsForPool,
  checkpointFileName,
  recordFromOutcomes,
  runCli,
  runHillClimb,
  singleCraftFileName,
  type FieldCompositionEntry,
  type GameMeasureFunction,
  type GreedyBuild,
  type HillClimbOptions,
  type MeasuredRecord,
  type MeasureOptions,
  type ProposedSwap,
} from '../../scripts/personas/craft';
import {
  leverAccounting,
  pairedComparison,
  raceCandidate,
  racePlan,
  sequentialBoundary,
  type GameOutcomes,
  type RacePlan,
} from '../../scripts/personas/lever';
import { cardRoles } from '../../scripts/personas/score';
import { personaTemplate } from '../../scripts/personas/templates';

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const temp = (label: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `darling-lever-${label}-`));
  tempDirs.push(dir);
  return dir;
};

// --- constructed game sequences ---------------------------------------------

/** One matchup's games: `seeds` long, W where `win(j)`. */
const games = (seeds: number, win: (j: number) => boolean): string =>
  Array.from({ length: seeds }, (_, j) => (win(j) ? 'W' : 'L')).join('');

/** `matchups` copies of one matchup's pattern. */
const field = (matchups: number, pattern: string): GameOutcomes => Array.from({ length: matchups }, () => pattern);

/** A player that plays back fixed outcomes, and counts what it was asked for. */
function playback(outcomes: GameOutcomes): { play: (from: number, to: number) => GameOutcomes; asked: number[] } {
  const asked: number[] = [];
  return {
    asked,
    play: (from, to) => {
      asked.push(to);
      return outcomes.map((row) => row.slice(from, to));
    },
  };
}

const MATCHUPS = 5;
const SEEDS = 150;
const plan001 = racePlan({ batch: 30, alpha: 0.01 }, SEEDS);
/** The incumbent: wins every even-indexed game, 50%. */
const incumbent = field(MATCHUPS, games(SEEDS, (j) => j % 2 === 0));

describe('the race boundary', () => {
  it('reproduces Pocock\'s published constants for equally spaced looks', () => {
    // Pocock (1977), two-sided 0.05 (one-sided 0.025 per side), K = 1..5.
    const published = [1.96, 2.178, 2.289, 2.361, 2.413];
    for (const [index, constant] of published.entries()) {
      const looks = index + 1;
      const fractions = Array.from({ length: looks }, (_, k) => (k + 1) / looks);
      expect(Math.abs(sequentialBoundary(0.025, fractions) - constant)).toBeLessThan(0.003);
    }
  });

  it('plans interim looks every batch short of the full count, with a wider boundary than one look needs', () => {
    expect(plan001.looks).toEqual([30, 60, 90, 120]);
    // One look at alpha 0.01 needs 2.326; four looks need more.
    expect(plan001.boundary).toBeGreaterThan(2.4);
    // No interim look would mean a boundary of infinity, which JSON writes as null.
    expect(() => racePlan({ batch: 150, alpha: 0.01 }, 150)).toThrow('must be below --seeds 150');
  });

  it('refuses an alpha outside (0, 0.5)', () => {
    expect(() => sequentialBoundary(0, [0.5])).toThrow('race alpha');
    expect(() => sequentialBoundary(0.5, [0.5])).toThrow('race alpha');
  });
});

describe('racing a candidate', () => {
  it('stops a clear loser at the first look, having played one batch', () => {
    // Loses every tenth game the incumbent won: ten points worse, on the same seeds.
    const loser = field(MATCHUPS, games(SEEDS, (j) => j % 2 === 0 && j % 10 !== 0));
    const { play, asked } = playback(loser);
    const result = raceCandidate(plan001, incumbent, SEEDS, play);
    expect(result.stoppedAt).toBe(30);
    expect(asked).toEqual([30]);
    expect(result.outcomes.every((row) => row.length === 30)).toBe(true);
    expect(result.z).toBeLessThan(-plan001.boundary);
  });

  it('runs an equal candidate that differs game by game to the full count', () => {
    // Loses a quarter of the games the incumbent won and wins as many it lost.
    const shuffled = field(MATCHUPS, games(SEEDS, (j) => (j % 4 === 0 ? false : j % 4 === 1 ? true : j % 2 === 0)));
    const { play, asked } = playback(shuffled);
    const result = raceCandidate(plan001, incumbent, SEEDS, play);
    expect(result.stoppedAt).toBeUndefined();
    expect(asked).toEqual([30, 60, 90, 120, 150]);
    expect(result.outcomes).toEqual(shuffled);
  });

  it('does not stop a candidate whose early deficit is inside the noise, and it measures better in full', () => {
    // Games 0-29: six of the incumbent's wins lost, four of its losses won
    // (two games behind per matchup). Games 30-149: every tenth-plus-one game
    // the incumbent lost is won (twelve ahead per matchup).
    const recovering = field(MATCHUPS, games(SEEDS, (j) => {
      if (j < 30) {
        if (j % 2 === 0) return j >= 12; // wins 0, 2, ..., 10 lost
        return j <= 7; // losses 1, 3, 5, 7 won
      }
      return j % 2 === 0 || j % 10 === 1;
    }));
    const result = raceCandidate(plan001, incumbent, SEEDS, playback(recovering).play);
    expect(result.stoppedAt).toBeUndefined();
    const fieldEntries = composition(MATCHUPS);
    const options = measureOptions(SEEDS);
    expect(recordFromOutcomes(options, fieldEntries, result.outcomes).score)
      .toBeGreaterThan(recordFromOutcomes(options, fieldEntries, incumbent).score);
  });

  it('without a plan, measures every candidate in full', () => {
    const loser = field(MATCHUPS, games(SEEDS, () => false));
    const { play, asked } = playback(loser);
    expect(raceCandidate(undefined, incumbent, SEEDS, play).stoppedAt).toBeUndefined();
    expect(asked).toEqual([150]);
  });

  it('keeps the paired statistic finite when every pair agrees', () => {
    const all = pairedComparison(field(1, 'LLLLL'), field(1, 'WWWWW'), 5);
    expect(Number.isFinite(all.z)).toBe(true);
    expect(all.meanDifference).toBe(-1);
    expect(pairedComparison(incumbent, incumbent, 30).z).toBe(0);
  });
});

/**
 * Repeated looks inflate false stops. Under the null (the candidate exactly as
 * good as the incumbent, pairs differing at random), the planned boundary must
 * stop about alpha of candidates across all four looks, where stopping at the
 * one-look critical value each time stops far more.
 */
describe('the race\'s error rate over repeated looks', () => {
  const trials = 2000;
  const alpha = 0.05;
  const simulate = (plan: RacePlan, shift: number): { stopped: number; firstLook: number } => {
    const rng = createRngState(20260928);
    let stopped = 0;
    let firstLook = 0;
    for (let trial = 0; trial < trials; trial++) {
      const ours: string[] = [];
      const theirs: string[] = [];
      for (let matchup = 0; matchup < MATCHUPS; matchup++) {
        let a = '';
        let b = '';
        for (let j = 0; j < SEEDS; j++) {
          const incumbentWins = rngFloat(rng) < 0.5;
          // Seven games in ten play out the same; the rest are fresh coin flips,
          // less `shift` for a candidate that is truly worse.
          const same = rngFloat(rng) < 0.7;
          const candidateWins = same ? incumbentWins : rngFloat(rng) < 0.5 - shift;
          b += incumbentWins ? 'W' : 'L';
          a += candidateWins ? 'W' : 'L';
        }
        ours.push(a);
        theirs.push(b);
      }
      const result = raceCandidate(plan, theirs, SEEDS, (from, to) => ours.map((row) => row.slice(from, to)));
      if (result.stoppedAt !== undefined) stopped++;
      if (result.stoppedAt === 30) firstLook++;
    }
    return { stopped: stopped / trials, firstLook: firstLook / trials };
  };

  it('stops an equal candidate at about alpha, where naive repeated looks stop far more', () => {
    const planned = racePlan({ batch: 30, alpha }, SEEDS);
    const naive: RacePlan = { ...planned, boundary: 1.645 };
    const tolerance = 3 * Math.sqrt((alpha * (1 - alpha)) / trials);
    const plannedRate = simulate(planned, 0).stopped;
    expect(plannedRate).toBeLessThan(alpha + tolerance);
    expect(plannedRate).toBeGreaterThan(alpha - tolerance);
    expect(simulate(naive, 0).stopped).toBeGreaterThan(alpha + 2 * tolerance);
  });

  it('stops a candidate that is truly worse almost always, and mostly at the first look', () => {
    // 0.3 x 0.3 = nine points worse per game.
    const result = simulate(racePlan({ batch: 30, alpha: 0.01 }, SEEDS), 0.3);
    expect(result.stopped).toBeGreaterThan(0.99);
    expect(result.firstLook).toBeGreaterThan(0.4);
  });
});

// --- the hill climb with levers ---------------------------------------------

const hash32 = (text: string): number => {
  let hash = 2_166_136_261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  // MurmurHash3's finaliser: FNV alone leaves similar strings' values correlated.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85eb_ca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2_ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
};
const unit = (text: string): number => hash32(text) / 2 ** 32;

/**
 * A deck's win probability from its cards: each card has a fixed value, and a
 * swap moves the deck by up to ten points. Game j of matchup m wins when a
 * fixed draw for (m, j) falls under the deck's probability, so every deck is
 * measured on the same draws and a better deck wins a superset of games: the
 * race and the screen can only ever be right, which is the point here.
 */
const strength = (deck: readonly string[], bias = 0): number => {
  const mean = deck.reduce((sum, id) => sum + unit(`card|${id}`), 0) / deck.length;
  return Math.min(0.98, Math.max(0.02, 0.5 + 4 * (mean - 0.5) + bias));
};

const fakeGames = (mediumBias = 0): GameMeasureFunction => (deck, options, request) => {
  const p = strength(deck, request.difficulty === 'medium' ? mediumBias : 0);
  const matchups = options.fieldComposition?.length ?? MATCHUPS;
  return Array.from({ length: matchups }, (_, m) => {
    let row = '';
    for (let j = request.from; j < request.to; j++) row += unit(`${request.difficulty}|${m}|${j}`) < p ? 'W' : 'L';
    return row;
  });
};

function composition(matchups: number): FieldCompositionEntry[] {
  return Array.from({ length: matchups }, (_, index) => ({
    kind: 'static' as const, id: `ref-${index}`, name: `Reference ${index}`, deck: [], landReserve: [],
  }));
}

function measureOptions(seeds: number): MeasureOptions {
  return { field: 'starters', seeds, seed: 1, personaId: 'draw-go', fieldComposition: composition(MATCHUPS) };
}

function climbOptions(iterations: number): Omit<HillClimbOptions, 'measure'> & { options: MeasureOptions } {
  const template = personaTemplate('draw-go');
  const pool = cardsForPool('all');
  return { initial: buildGreedyDeck(template, pool, 91), pool, template, iterations, seed: 44, options: measureOptions(SEEDS) };
}

describe('the hill climb with levers', () => {
  it('reaches the plain climb\'s accepted swaps and final measurement while playing fewer Hard games', () => {
    const { options, ...common } = climbOptions(40);
    const entries = composition(MATCHUPS);
    const hardGames = fakeGames();
    const plain = runHillClimb({
      ...common,
      measure: (deck) => recordFromOutcomes(options, entries, hardGames(deck, options, { difficulty: 'hard', from: 0, to: SEEDS })),
    });
    const levered = runHillClimb({
      ...common,
      measure: () => { throw new Error('a levered climb measures per game'); },
      lever: {
        race: plan001,
        screen: { difficulty: 'medium', threshold: 5, seeds: SEEDS },
        seeds: SEEDS,
        games: (deck, request) => hardGames(deck, options, request),
        record: (outcomes) => recordFromOutcomes(options, entries, outcomes),
      },
    });

    expect(levered.log.acceptedSwaps).toEqual(plain.log.acceptedSwaps);
    expect(levered.build.deck).toEqual(plain.build.deck);
    expect(levered.finalMeasurement).toEqual(plain.finalMeasurement);
    expect(levered.log.rejectedSwaps).toBe(plain.log.rejectedSwaps);
    // The comparison proves little unless the climb moved and the levers bit.
    expect(plain.log.acceptedSwaps.length).toBeGreaterThan(0);

    const log = levered.log.lever!;
    const accounting = leverAccounting(log);
    expect(accounting.screenedOut).toBeGreaterThan(0);
    expect(accounting.racedOut).toBeGreaterThan(0);
    expect(accounting.proposed).toBe(accounting.screenedOut + accounting.racedOut + accounting.measuredInFull);
    expect(accounting.accepted).toBe(plain.log.acceptedSwaps.length);
    expect(accounting.hardGames).toBeLessThan(accounting.unracedHardGames);
    const full = MATCHUPS * SEEDS;
    for (const swap of log.swaps) {
      if (swap.stop === 'screened-out') expect(swap.hardGames).toBe(0);
      if (swap.stop === 'raced-out') expect(swap.hardGames).toBe(MATCHUPS * swap.racedAt!);
      // Only a full Hard measurement accepts, so every accepted swap carries one.
      if (swap.stop === 'full' || swap.accepted) expect(swap.hardGames).toBe(full);
      expect(swap.screenGames).toBe(full);
    }
  });

  /** Two proposals in turn, each swapping the first card for a named alternative. */
  function screenScenario(threshold: number, mediumTrail: number): { log: NonNullable<ReturnType<typeof runHillClimb>['log']['lever']>; accepted: number } {
    const { options, ...common } = climbOptions(1);
    const entries = composition(MATCHUPS);
    const role = common.initial.assigned[0].role;
    const alternative = common.pool.find((card) =>
      card.id !== common.initial.assigned[0].cardId &&
      card.colors.every((color) => common.initial.selectedColors.includes(color)) &&
      cardRoles(card).includes(role) && !common.initial.deck.includes(card.id))!.id;
    const swapFirst = (build: GreedyBuild): ProposedSwap => {
      const assigned = build.assigned.map((entry, index) => index === 0 ? { ...entry, cardId: alternative } : { ...entry });
      return { build: { ...build, assigned, deck: assigned.map((entry) => entry.cardId) }, out: build.deck[0], in: alternative, role };
    };
    // The candidate is five points BETTER under Hard, and `mediumTrail` points
    // worse under Medium; the incumbent is 50% under both.
    const scenarioGames: GameMeasureFunction = (deck, _options, request) => {
      const candidate = deck[0] === alternative;
      const rate = request.difficulty === 'hard' ? (candidate ? 0.55 : 0.5) : (candidate ? 0.5 - mediumTrail / 100 : 0.5);
      return field(MATCHUPS, games100(rate)).map((row) => row.slice(request.from, request.to));
    };
    const result = runHillClimb({
      ...common,
      measure: () => { throw new Error('unused'); },
      propose: (current) => swapFirst(current),
      lever: {
        screen: { difficulty: 'medium', threshold, seeds: 100 },
        seeds: 100,
        games: (deck, request) => scenarioGames(deck, options, request),
        record: (outcomes) => recordFromOutcomes(options, entries, outcomes),
      },
    });
    return { log: result.log.lever!, accepted: result.log.acceptedSwaps.length };
  }
  /** 100 games, the first `rate` x 100 of them won. */
  const games100 = (rate: number): string => games(100, (j) => j < Math.round(rate * 100));

  it('screens out a swap Medium scores worse by more than the threshold, before any Hard game', () => {
    const { log, accepted } = screenScenario(5, 10);
    expect(log.swaps[0]).toMatchObject({ stop: 'screened-out', hardGames: 0, screenGames: MATCHUPS * 100, screenDelta: -10 });
    expect(accepted).toBe(0);
  });

  it('passes a swap Medium scores worse by less than the threshold to Hard, which accepts it', () => {
    const { log, accepted } = screenScenario(5, 3);
    expect(log.swaps[0]).toMatchObject({ stop: 'full', accepted: true, hardGames: MATCHUPS * 100, screenDelta: -3 });
    expect(accepted).toBe(1);
  });

  it('screens the same swap out when the threshold is tighter', () => {
    const { log } = screenScenario(2, 3);
    expect(log.swaps[0].stop).toBe('screened-out');
  });
});

// --- the CLI: flags, determinism, chunks, resume ----------------------------

const TODAY = '2026-09-28';
const quiet = { today: () => TODAY, log: () => undefined };
const unusedMeasure = (): MeasuredRecord => { throw new Error('a levered craft measures per game'); };
const leverDeps = { ...quiet, measure: unusedMeasure, measureGames: fakeGames() };

const craftArgs = [
  '--metagame-craft', 'burn', '--round', '0', '--personas', 'burn,weenie', '--rounds', '2',
  '--field', 'starters', '--pool', 'all', '--seeds', '40', '--iterations', '12', '--seed', '424242',
  '--workers', '1',
];
const leverFlags = ['--race', '--race-batch', '10', '--screen', 'medium'];

const craftFile = (dir: string, persona = 'burn', round = 0): string =>
  readFileSync(join(dir, singleCraftFileName(persona, round)), 'utf8');
const journal = (dir: string): string => readFileSync(join(dir, 'craft-journal.jsonl'), 'utf8');

describe('raced and screened crafts from the CLI', { timeout: 120_000 }, () => {
  it('journals per swap why it stopped and what it cost, and prints the accounting', () => {
    const out = temp('journal');
    const lines: string[] = [];
    expect(runCli([...craftArgs, ...leverFlags, '--out', out], { ...leverDeps, log: (line) => lines.push(line) })).toBe(0);
    const crafted = JSON.parse(craftFile(out)) as {
      config: { race?: unknown; screen?: unknown };
      hillClimb: { lever: { race: { looks: number[] }; swaps: { stop: string; hardGames: number; screenGames: number }[] } };
    };
    expect(crafted.config.race).toEqual({ batch: 10, alpha: 0.01 });
    expect(crafted.config.screen).toEqual({ difficulty: 'medium', threshold: 5, seeds: 40 });
    expect(crafted.hillClimb.lever.race.looks).toEqual([10, 20, 30]);
    const stops = new Set(crafted.hillClimb.lever.swaps.map((swap) => swap.stop));
    expect([...stops].every((stop) => ['screened-out', 'raced-out', 'full'].includes(stop))).toBe(true);
    expect(lines.some((line) => /^Levers: \d+ swaps proposed; \d+ screened out, \d+ raced out, \d+ measured in full, \d+ accepted$/.test(line))).toBe(true);
    expect(lines.some((line) => /^Levers: [\d,]+ Hard games \([\d.]+% of unraced\) \+ [\d,]+ Medium games, against [\d,]+ Hard unraced$/.test(line))).toBe(true);
  });

  it('writes an unraced craft with no lever keys at all', () => {
    const out = temp('plain');
    expect(runCli([...craftArgs, '--iterations', '0', '--out', out],
      { ...quiet, measure: (_deck, options) => ({ field: options.field, seeds: 1, matchups: [], rowWins: 1, losses: 0, draws: 0, games: 1, score: 1 }) })).toBe(0);
    expect(craftFile(out)).not.toContain('"race"');
    expect(craftFile(out)).not.toContain('"screen"');
    expect(craftFile(out)).not.toContain('"lever"');
  });

  it('finishes a raced craft in chunks byte-identical to one in a single process', () => {
    const whole = temp('whole');
    expect(runCli([...craftArgs, ...leverFlags, '--out', whole], leverDeps)).toBe(0);
    let previous: string | undefined;
    for (let chunk = 0; chunk < 3; chunk++) {
      const out = temp(`chunk-${chunk}`);
      const resume = previous === undefined ? [] : ['--resume-from', previous];
      expect(runCli([...craftArgs, ...leverFlags, '--chunk-iterations', '5', ...resume, '--out', out], leverDeps)).toBe(0);
      previous = out;
    }
    expect(craftFile(previous!)).toBe(craftFile(whole));
    expect(journal(previous!)).toBe(journal(whole));
    expect(existsSync(join(previous!, checkpointFileName('burn', 0)))).toBe(false);
  });

  it('refuses to continue an unraced checkpoint with the levers on, and the reverse', () => {
    const plainChunk = temp('plain-chunk');
    const stub = { ...quiet, measure: (_deck: readonly string[], options: MeasureOptions): MeasuredRecord =>
      ({ field: options.field, seeds: 1, matchups: [], rowWins: 1, losses: 0, draws: 0, games: 1, score: 1 }) };
    expect(runCli([...craftArgs, '--chunk-iterations', '2', '--out', plainChunk], stub)).toBe(0);
    const errors: string[] = [];
    expect(runCli([...craftArgs, ...leverFlags, '--chunk-iterations', '2', '--resume-from', plainChunk, '--out', temp('next')],
      { ...leverDeps, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('configuration mismatch');
    expect(errors[0]).toContain('no race');

    const leverChunk = temp('lever-chunk');
    expect(runCli([...craftArgs, ...leverFlags, '--chunk-iterations', '2', '--out', leverChunk], leverDeps)).toBe(0);
    errors.length = 0;
    expect(runCli([...craftArgs, '--chunk-iterations', '2', '--resume-from', leverChunk, '--out', temp('next2')],
      { ...stub, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('configuration mismatch');
  });

  it('refuses to merge raced crafts with unraced ones', () => {
    const dir = temp('mixed');
    const stub = { ...quiet, measure: (_deck: readonly string[], options: MeasureOptions): MeasuredRecord =>
      ({ field: options.field, seeds: 1, matchups: [], rowWins: 1, losses: 0, draws: 0, games: 1, score: 1 }) };
    expect(runCli([...craftArgs, ...leverFlags, '--iterations', '1', '--out', dir], leverDeps)).toBe(0);
    const weenie = craftArgs.map((arg) => arg === 'burn' ? 'weenie' : arg);
    expect(runCli([...weenie, '--iterations', '1', '--out', dir], stub)).toBe(0);
    const errors: string[] = [];
    expect(runCli(['--metagame-merge', dir, '--out', temp('merged')], { ...quiet, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('belongs to a different sweep');
  });

  it('resumes an in-process raced loop from its journal, and refuses to resume it unraced', () => {
    const out = temp('loop');
    const loopArgs = [
      '--metagame', '--personas', 'burn,weenie', '--rounds', '1', '--field', 'starters', '--pool', 'all',
      '--seeds', '20', '--iterations', '4', '--seed', '424242', '--workers', '1', ...leverFlags,
    ];
    expect(runCli([...loopArgs, '--out', out], leverDeps)).toBe(0);
    const artifact = `${TODAY}-metagame-burn-all.json`;
    const first = readFileSync(join(out, artifact), 'utf8');
    expect(journal(out).split('\n')[0]).toContain('"race":{"batch":10,"alpha":0.01}');

    const lines: string[] = [];
    // Nothing left to craft: a measure that throws proves the resume re-measured nothing.
    expect(runCli([...loopArgs, '--resume', '--out', out],
      { ...quiet, measure: unusedMeasure, measureGames: () => { throw new Error('re-measured'); }, log: (line) => lines.push(line) })).toBe(0);
    expect(lines).toContain('Resume: 4 completed craft(s) recovered from craft-journal.jsonl');
    expect(readFileSync(join(out, artifact), 'utf8')).toBe(first);

    const errors: string[] = [];
    expect(runCli([...loopArgs.filter((arg) => !leverFlags.includes(arg)), '--resume', '--out', out],
      { ...quiet, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('configuration mismatch');
  });

  it('refuses the lever flags outside the sweep crafts, and malformed ones', () => {
    const cases: [string[], string][] = [
      [['--persona', 'burn', '--race'], '--race and --screen apply to the sweep crafts only'],
      [['--metagame-merge', temp('m'), '--screen', 'medium'], '--race and --screen apply to the sweep crafts only'],
      [[...craftArgs, '--race-alpha', '0.05'], '--race-alpha needs --race'],
      [[...craftArgs, '--screen-threshold', '3'], '--screen-threshold needs --screen medium'],
      [[...craftArgs, '--screen', 'hard'], '--screen takes medium'],
      [[...craftArgs, '--race', '--race-alpha', '0.7'], '--race-alpha must be a number above 0 and below 0.5'],
      [[...craftArgs, '--race', '--race-batch', '0'], '--race-batch must be a positive integer'],
      [[...craftArgs, '--race', '--race-batch', '40'], '--race-batch 40 must be below --seeds 40'],
      [[...craftArgs, '--screen', 'medium', '--screen-threshold', '-1'], '--screen-threshold must be a non-negative number'],
    ];
    for (const [args, message] of cases) {
      const errors: string[] = [];
      expect(runCli([...args, '--out', temp('refuse')], { ...leverDeps, error: (text) => errors.push(text) })).toBe(1);
      expect(errors[0]).toContain(message);
    }
  });
});

describe('levers under the real engine', { timeout: 600_000 }, () => {
  it('a race that never stops and a screen that never drops reproduce the unraced craft exactly, at any worker count', () => {
    // Five starter decks, two games each, three swaps: tiny on purpose. The race
    // runs a look after every game (batch 1) at an alpha whose boundary no five
    // pairs can cross, and the screen drops nothing (100 points), so every swap
    // is measured in full through the per-game path, with Medium games played
    // beside it. Everything but the lever keys must match the unraced craft.
    const args = [
      '--metagame-craft', 'burn', '--round', '0', '--personas', 'burn,weenie', '--rounds', '1',
      '--field', 'starters', '--pool', 'all', '--seeds', '2', '--iterations', '3', '--seed', '13003', '--no-memo',
    ];
    const never = ['--race', '--race-batch', '1', '--race-alpha', '1e-9', '--screen', 'medium', '--screen-threshold', '100'];
    const plainDir = temp('engine-plain');
    const oneWorker = temp('engine-lever-1');
    const twoWorkers = temp('engine-lever-2');
    expect(runCli([...args, '--workers', '1', '--out', plainDir], quiet)).toBe(0);
    expect(runCli([...args, ...never, '--workers', '1', '--out', oneWorker], quiet)).toBe(0);
    expect(runCli([...args, ...never, '--workers', '2', '--out', twoWorkers], quiet)).toBe(0);

    expect(craftFile(twoWorkers)).toBe(craftFile(oneWorker));
    const levered = JSON.parse(craftFile(oneWorker)) as {
      config: Record<string, unknown>; hillClimb: Record<string, unknown> & { lever?: { swaps: { stop: string }[] } };
    };
    expect(levered.hillClimb.lever!.swaps.every((swap) => swap.stop === 'full')).toBe(true);
    delete levered.config.race;
    delete levered.config.screen;
    delete levered.hillClimb.lever;
    expect(`${JSON.stringify(levered, null, 2)}\n`).toBe(craftFile(plainDir));
  });
});
