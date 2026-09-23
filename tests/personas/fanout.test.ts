import { cpSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkpointFileName,
  runCli,
  singleCraftFileName,
  type MeasuredRecord,
  type MeasureOptions,
} from '../../scripts/personas/craft';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const temp = (label: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `darling-fanout-${label}-`));
  tempDirs.push(dir);
  return dir;
};

/** Both sides stamp the same date, which is the file names' only free variable. */
const TODAY = '2026-09-22';
const quiet = { today: () => TODAY, log: () => undefined };

const PERSONAS = ['burn', 'weenie'] as const;

/**
 * A measurement that depends only on the field it is handed, for the cases that
 * exercise plumbing rather than simulation. The decks it produces never change,
 * so the loop reaches stability at round 1.
 */
const stubMeasure = (_deck: readonly string[], options: MeasureOptions): MeasuredRecord => ({
  field: options.field,
  seeds: 1,
  matchups: [],
  rowWins: 1,
  losses: 0,
  draws: 0,
  games: 1,
  score: 1,
});

const journalLines = (dir: string): string[] =>
  readFileSync(join(dir, 'craft-journal.jsonl'), 'utf8').split('\n').filter((line) => line.trim());

const craftLines = (dir: string): string[] =>
  journalLines(dir).filter((line) => !line.startsWith('{"type":"config"'));

/** Run the whole fan-out: every persona of every round, then the merge. */
function fanOut(
  fanDir: string,
  mergedDir: string,
  common: string[],
  rounds: number,
  dependencies: Parameters<typeof runCli>[1] = quiet,
): void {
  for (let round = 0; round <= rounds; round++) {
    for (const persona of PERSONAS) {
      const args = ['--metagame-craft', persona, '--round', String(round), ...common,
        '--out', join(fanDir, `r${round}`)];
      if (round > 0) args.push('--field-dir', join(fanDir, `r${round - 1}`));
      expect(runCli(args, dependencies)).toBe(0);
    }
  }
  expect(runCli(['--metagame-merge', fanDir, '--out', mergedDir], dependencies)).toBe(0);
}

/**
 * The fan-out's whole claim is that a sweep run on six machines is the SAME
 * measurement as one run in one process. Anything less than byte identity would
 * leave that claim to inspection, so this compares the files themselves.
 */
describe('metagame fan-out', { timeout: 600_000 }, () => {
  it('merges fanned-out crafts into the in-process loop byte for byte', () => {
    const loopDir = temp('loop');
    const fanDir = temp('crafts');
    const mergedDir = temp('merged');
    // Deliberately small: five reference decks, two seeds, one hill-climb swap.
    // The loop side alone measured 87 s at this size on an idle box (2026-09-22);
    // the sweep's own 14-deck, 150-seed, 80-iteration shape is a night's work.
    const common = [
      '--personas', 'burn,weenie', '--rounds', '2', '--field', 'starters', '--pool', 'all',
      '--seeds', '2', '--iterations', '1', '--seed', '13003', '--workers', '1',
    ];

    expect(runCli(['--metagame', ...common, '--out', loopDir], quiet)).toBe(0);
    fanOut(fanDir, mergedDir, common, 2);

    for (const persona of PERSONAS) {
      const name = `${TODAY}-metagame-${persona}-all.json`;
      expect(readFileSync(join(mergedDir, name), 'utf8'))
        .toBe(readFileSync(join(loopDir, name), 'utf8'));
    }
    expect(craftLines(mergedDir)).toEqual(craftLines(loopDir));
    // Six crafts: two personas across the seed round and two best responses.
    expect(craftLines(mergedDir)).toHaveLength(6);
  });

  it('stops the merge where the loop stops, discarding rounds the loop never reaches', () => {
    const loopDir = temp('stable-loop');
    const fanDir = temp('stable-crafts');
    const mergedDir = temp('stable-merged');
    const deps = { ...quiet, measure: stubMeasure };
    const common = [
      '--personas', 'burn,weenie', '--rounds', '2', '--field', 'starters', '--pool', 'all',
      '--seeds', '1', '--iterations', '0', '--seed', '424242', '--workers', '1',
    ];

    expect(runCli(['--metagame', ...common, '--out', loopDir], deps)).toBe(0);
    // The fan-out crafts round 2 regardless; the merge must throw it away,
    // because the loop stopped at the stable round and never crafted it.
    fanOut(fanDir, mergedDir, common, 2, deps);

    for (const persona of PERSONAS) {
      const name = `${TODAY}-metagame-${persona}-all.json`;
      expect(readFileSync(join(mergedDir, name), 'utf8'))
        .toBe(readFileSync(join(loopDir, name), 'utf8'));
    }
    const merged = JSON.parse(readFileSync(join(mergedDir, `${TODAY}-metagame-burn-all.json`), 'utf8')) as {
      metagame: { summary: { stoppedReason: string; completedRounds: number; converged: boolean } };
    };
    expect(merged.metagame.summary).toMatchObject({
      stoppedReason: 'stable-decks', completedRounds: 1, converged: true,
    });
    expect(craftLines(mergedDir)).toEqual(craftLines(loopDir));
  });

  it('reports the verdict without writing anything in check mode', () => {
    const fanDir = temp('check-crafts');
    const mergedDir = temp('check-merged');
    const deps = { ...quiet, measure: stubMeasure };
    const common = [
      '--personas', 'burn,weenie', '--rounds', '4', '--field', 'starters', '--pool', 'all',
      '--seeds', '1', '--iterations', '0', '--seed', '424242', '--workers', '1',
    ];
    fanOut(fanDir, mergedDir, common, 1, deps);

    const lines: string[] = [];
    expect(runCli(['--metagame-merge', fanDir, '--check-stable', '--out', mergedDir],
      { ...deps, log: (line) => lines.push(line) })).toBe(0);
    // The workflow reads these straight into a job output and skips the rest of
    // the rounds, which is the only thing that ends a fan-out early.
    expect(lines).toContain('stable=true');
    expect(lines).toContain('done=true');
    expect(lines).toContain('stopped-reason=stable-decks');
    expect(lines).toContain('completed-rounds=1');
  });

  it('refuses an unknown persona', () => {
    const errors: string[] = [];
    expect(runCli([
      '--metagame-craft', 'not-a-persona', '--round', '0', '--personas', 'burn,weenie',
      '--field', 'starters', '--seeds', '1', '--iterations', '0', '--out', temp('unknown'),
    ], { ...quiet, measure: stubMeasure, error: (message) => errors.push(message) })).toBe(1);
    expect(errors).toEqual(['Unknown persona: not-a-persona']);
  });

  it('refuses a round whose field directory is missing a persona', () => {
    const fanDir = temp('gap-crafts');
    const deps = { ...quiet, measure: stubMeasure };
    const common = [
      '--personas', 'burn,weenie', '--rounds', '2', '--field', 'starters',
      '--seeds', '1', '--iterations', '0', '--seed', '424242',
    ];
    const roundZero = join(fanDir, 'r0');
    for (const persona of PERSONAS) {
      expect(runCli(['--metagame-craft', persona, '--round', '0', ...common, '--out', roundZero], deps)).toBe(0);
    }
    unlinkSync(join(roundZero, singleCraftFileName('weenie', 0)));

    const errors: string[] = [];
    expect(runCli([
      '--metagame-craft', 'burn', '--round', '1', ...common,
      '--field-dir', roundZero, '--out', join(fanDir, 'r1'),
    ], { ...deps, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('no round 0 craft for weenie');
  });

  it('refuses a field directory crafted for a different configuration', () => {
    const fanDir = temp('mismatch-crafts');
    const deps = { ...quiet, measure: stubMeasure };
    const roundZero = join(fanDir, 'r0');
    const common = ['--personas', 'burn,weenie', '--rounds', '2', '--field', 'starters', '--iterations', '0', '--seed', '424242'];
    for (const persona of PERSONAS) {
      expect(runCli(['--metagame-craft', persona, '--round', '0', ...common, '--seeds', '1', '--out', roundZero], deps)).toBe(0);
    }

    const errors: string[] = [];
    // Same seed, different sample size: a merge of the two would report a
    // precision the round-0 decks were never measured at.
    expect(runCli([
      '--metagame-craft', 'burn', '--round', '1', ...common, '--seeds', '2',
      '--field-dir', roundZero, '--out', join(fanDir, 'r1'),
    ], { ...deps, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('configuration mismatch');
    expect(errors[0]).toContain('1 seeds');
    expect(errors[0]).toContain('2 seeds');
  });

  it('refuses to merge when no round finished for every persona', () => {
    const fanDir = temp('partial-crafts');
    const deps = { ...quiet, measure: stubMeasure };
    expect(runCli([
      '--metagame-craft', 'burn', '--round', '0', '--personas', 'burn,weenie', '--rounds', '2',
      '--field', 'starters', '--seeds', '1', '--iterations', '0', '--seed', '424242',
      '--out', join(fanDir, 'r0'),
    ], deps)).toBe(0);

    const errors: string[] = [];
    expect(runCli(['--metagame-merge', fanDir, '--out', temp('partial-merged')],
      { ...deps, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('Round 0 is incomplete');
    expect(errors[0]).toContain('weenie');
  });

  it('skips a craft it already has, so a timed-out round can be re-dispatched', () => {
    const fanDir = temp('resume-crafts');
    const resumeDir = temp('resume-source');
    const deps = { ...quiet, measure: stubMeasure };
    const args = (out: string, extra: string[] = []): string[] => [
      '--metagame-craft', 'burn', '--round', '0', '--personas', 'burn,weenie', '--rounds', '2',
      '--field', 'starters', '--seeds', '1', '--iterations', '0', '--seed', '424242',
      '--out', out, ...extra,
    ];
    expect(runCli(args(resumeDir), deps)).toBe(0);
    const crafted = readFileSync(join(resumeDir, singleCraftFileName('burn', 0)), 'utf8');

    const logged: string[] = [];
    expect(runCli(args(fanDir, ['--resume-from', resumeDir]),
      { ...deps, log: (line) => logged.push(line) })).toBe(0);
    // The recovered craft is the one that already ran, not a re-run of it.
    expect(readFileSync(join(fanDir, singleCraftFileName('burn', 0)), 'utf8')).toBe(crafted);
    expect(logged.some((line) => line.includes('already crafted'))).toBe(true);
    expect(craftLines(fanDir)).toHaveLength(1);
  });
});

/**
 * A measurement that depends on the deck's contents and nothing else, so the
 * hill climb accepts some swaps and rejects others. A chunked craft only proves
 * anything if the rng, the retained deck and the accepted-swap log all have to
 * survive the trip through a checkpoint; a constant score would leave the rng
 * the only moving part.
 */
const deckScoreMeasure = (deck: readonly string[], options: MeasureOptions): MeasuredRecord => {
  let hash = 2_166_136_261;
  const text = deck.join(',');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  const rowWins = (hash >>> 0) % 1000;
  return {
    field: options.field,
    seeds: 1,
    matchups: [],
    rowWins,
    losses: 1000 - rowWins,
    draws: 0,
    games: 1000,
    score: rowWins / 1000,
  };
};

interface ChunkRun {
  dir: string;
  logs: string[][];
}

type CliDeps = NonNullable<Parameters<typeof runCli>[1]>;

/**
 * Run one craft as a chain of chunk invocations, each in its own --out and each
 * continuing from the previous one's directory, the way the workflow's chunk
 * jobs hand an artifact to the next job. `dependencies` is called once per
 * chunk, so each chunk can have its own clock, as each job is its own process.
 */
function runChunked(
  label: string,
  args: string[],
  chunkFlags: string[],
  invocations: number,
  dependencies: () => CliDeps,
): ChunkRun {
  const logs: string[][] = [];
  let previous: string | undefined;
  for (let chunk = 0; chunk < invocations; chunk++) {
    const out = temp(`${label}-c${chunk}`);
    const lines: string[] = [];
    const resume = previous === undefined ? [] : ['--resume-from', previous];
    expect(runCli([...args, ...chunkFlags, ...resume, '--out', out],
      { ...dependencies(), log: (line) => lines.push(line) })).toBe(0);
    logs.push(lines);
    previous = out;
  }
  return { dir: previous!, logs };
}

/**
 * A wall clock that moves only while a measurement runs, `seconds` per
 * measurement, paired with the deck-dependent stub measure. Measuring is where
 * a real craft spends its time, and a clock tied to it makes the point where a
 * time budget ends a chunk exact, which the real clock never would be.
 */
function measuredClock(seconds: number): CliDeps {
  let time = 1_700_000_000_000;
  return {
    ...quiet,
    now: () => time,
    measure: (deck, options) => {
      time += seconds * 1000;
      return deckScoreMeasure(deck, options);
    },
  };
}

const nextIterations = (run: ChunkRun): (string | undefined)[] =>
  run.logs.map((lines) => lines.find((line) => line.startsWith('next-iteration=')));

const craftFile = (dir: string, persona: string, round: number): string =>
  readFileSync(join(dir, singleCraftFileName(persona, round)), 'utf8');

/** `args` with the value after `flag` replaced. */
const withFlag = (args: readonly string[], flag: string, value: string): string[] =>
  args.map((arg, index) => args[index - 1] === flag ? value : arg);

/**
 * A craft that spans several processes must be the craft that ran in one. The
 * workflow splits a craft only because a hosted runner stops at 360 minutes;
 * if chunking changed a single byte of the result, the sweep would stop being
 * one measurement.
 */
describe('chunked crafts', { timeout: 600_000 }, () => {
  const stubArgs = [
    '--metagame-craft', 'burn', '--round', '0', '--personas', 'burn,weenie', '--rounds', '2',
    '--field', 'starters', '--pool', 'all', '--seeds', '1', '--iterations', '7', '--seed', '424242',
    '--workers', '1',
  ];
  const stubDeps = { ...quiet, measure: deckScoreMeasure };

  it('finishes byte-identical to an unchunked craft, in three chunks or in two', () => {
    const wholeDir = temp('whole');
    expect(runCli([...stubArgs, '--out', wholeDir], stubDeps)).toBe(0);
    const whole = JSON.parse(craftFile(wholeDir, 'burn', 0)) as {
      hillClimb: { acceptedSwaps: unknown[]; rejectedSwaps: number };
    };
    // The measurement has to move the climb, or the comparison proves little.
    expect(whole.hillClimb.acceptedSwaps.length).toBeGreaterThan(0);
    expect(whole.hillClimb.rejectedSwaps).toBeGreaterThan(0);

    // 3 + 3 + 1 iterations, and 4 + 3.
    const three = runChunked('three', stubArgs, ['--chunk-iterations', '3'], 3, () => stubDeps);
    const two = runChunked('two', stubArgs, ['--chunk-iterations', '4'], 2, () => stubDeps);

    for (const run of [three, two]) {
      expect(craftFile(run.dir, 'burn', 0)).toBe(craftFile(wholeDir, 'burn', 0));
      expect(journalLines(run.dir)).toEqual(journalLines(wholeDir));
      expect(existsSync(join(run.dir, checkpointFileName('burn', 0)))).toBe(false);
      expect(run.logs.at(-1)).toContain('craft-complete=true');
      for (const lines of run.logs.slice(0, -1)) expect(lines).toContain('craft-complete=false');
    }
    expect(nextIterations(three)).toEqual(['next-iteration=4', 'next-iteration=7', 'next-iteration=8']);
  });

  it('writes a checkpoint and no craft or journal line when a chunk stops short', () => {
    const out = temp('short');
    const lines: string[] = [];
    expect(runCli([...stubArgs, '--chunk-iterations', '2', '--out', out],
      { ...stubDeps, log: (line) => lines.push(line) })).toBe(0);
    expect(existsSync(join(out, checkpointFileName('burn', 0)))).toBe(true);
    expect(existsSync(join(out, singleCraftFileName('burn', 0)))).toBe(false);
    expect(existsSync(join(out, 'craft-journal.jsonl'))).toBe(false);
    expect(lines).toContain('craft-complete=false');
    expect(lines).toContain('next-iteration=3');
  });

  it('copies a finished craft forward instead of continuing, and leaves no checkpoint', () => {
    const finished = temp('finished');
    expect(runCli([...stubArgs, '--out', finished], stubDeps)).toBe(0);
    // A stale checkpoint beside the finished craft must not win over it.
    const stale = temp('stale');
    expect(runCli([...stubArgs, '--chunk-iterations', '2', '--out', stale], stubDeps)).toBe(0);
    cpSync(join(stale, checkpointFileName('burn', 0)), join(finished, checkpointFileName('burn', 0)));

    const out = temp('forward');
    const lines: string[] = [];
    expect(runCli([...stubArgs, '--chunk-iterations', '2', '--resume-from', finished, '--out', out],
      { ...stubDeps, log: (line) => lines.push(line) })).toBe(0);
    expect(craftFile(out, 'burn', 0)).toBe(craftFile(finished, 'burn', 0));
    expect(craftLines(out)).toEqual(craftLines(finished));
    expect(existsSync(join(out, checkpointFileName('burn', 0)))).toBe(false);
    expect(lines).toContain('craft-complete=true');
  });

  it('refuses a checkpoint from a different configuration', () => {
    const first = temp('config-first');
    expect(runCli([...stubArgs, '--chunk-iterations', '2', '--out', first], stubDeps)).toBe(0);

    const errors: string[] = [];
    expect(runCli([...withFlag(stubArgs, '--seeds', '2'), '--chunk-iterations', '2', '--resume-from', first,
      '--out', temp('config-next')], { ...stubDeps, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('configuration mismatch');
    expect(errors[0]).toContain('1 seeds');
    expect(errors[0]).toContain('2 seeds');
  });

  /** Round 0 of both personas, whole, as a round-1 field directory. */
  const roundZeroField = (label: string): string => {
    const field = temp(label);
    for (const persona of PERSONAS) {
      expect(runCli([...withFlag(stubArgs, '--metagame-craft', persona), '--out', field], stubDeps)).toBe(0);
    }
    return field;
  };
  const roundOneArgs = (field: string): string[] => [...withFlag(stubArgs, '--round', '1'), '--field-dir', field];

  it('refuses a checkpoint that holds a different round', () => {
    const field = roundZeroField('round-field');
    const source = temp('round-source');
    expect(runCli([...stubArgs, '--chunk-iterations', '2', '--out', source], stubDeps)).toBe(0);
    // A round-0 checkpoint filed under round 1's name.
    renameSync(join(source, checkpointFileName('burn', 0)), join(source, checkpointFileName('burn', 1)));

    const errors: string[] = [];
    expect(runCli([...roundOneArgs(field), '--chunk-iterations', '2', '--resume-from', source,
      '--out', temp('round-next')], { ...stubDeps, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('holds round 0 of burn, not round 1 of burn');
  });

  it('refuses a checkpoint climbed against a different field', () => {
    const field = roundZeroField('fingerprint-field');
    const first = temp('fingerprint-first');
    expect(runCli([...roundOneArgs(field), '--chunk-iterations', '2', '--out', first], stubDeps)).toBe(0);
    expect(existsSync(join(first, checkpointFileName('burn', 1)))).toBe(true);

    // The same sweep configuration with a different weenie deck in round 0,
    // as if round 0 had been re-crafted by different code between dispatches.
    const weeniePath = join(field, singleCraftFileName('weenie', 0));
    const weenie = JSON.parse(readFileSync(weeniePath, 'utf8')) as { deck: string[] };
    weenie.deck.reverse();
    writeFileSync(weeniePath, `${JSON.stringify(weenie, null, 2)}\n`, 'utf8');

    const errors: string[] = [];
    expect(runCli([...roundOneArgs(field), '--chunk-iterations', '2', '--resume-from', first,
      '--out', temp('fingerprint-next')], { ...stubDeps, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('different field');
  });

  it('refuses --chunk-iterations on the in-process loop, which resumes from its journal', () => {
    const errors: string[] = [];
    expect(runCli([
      '--metagame', '--personas', 'burn,weenie', '--rounds', '1', '--field', 'starters',
      '--seeds', '1', '--iterations', '4', '--seed', '424242', '--chunk-iterations', '2',
      '--out', temp('loop-chunk'),
    ], { ...stubDeps, error: (message) => errors.push(message) })).toBe(1);
    expect(errors[0]).toContain('--resume');
  });

  /**
   * The workflow sizes chunks in minutes, because one persona's game costs ten
   * times another's and the measurement may not change. A chunk that stops on
   * its clock must still hand on exactly the climb an unchunked craft runs.
   */
  it('stops a chunk on its time budget, and the chain finishes byte-identical to an unchunked craft', () => {
    const wholeDir = temp('budget-whole');
    expect(runCli([...stubArgs, '--out', wholeDir], stubDeps)).toBe(0);
    const whole = JSON.parse(craftFile(wholeDir, 'burn', 0)) as { hillClimb: { unproposedIterations: number } };
    // Every iteration measures, so the clock moves once per iteration.
    expect(whole.hillClimb.unproposedIterations).toBe(0);

    // 20 seconds a measurement against a one-minute budget. Chunk 0 pays for
    // the greedy build's measurement too, so it runs two iterations; a resumed
    // chunk runs three; the third chunk runs the last two and finishes.
    const run = runChunked('budget', stubArgs, ['--chunk-minutes', '1'], 3, () => measuredClock(20));
    expect(nextIterations(run)).toEqual(['next-iteration=3', 'next-iteration=6', 'next-iteration=8']);
    expect(run.logs.map((lines) => lines.find((line) => line.startsWith('craft-complete='))))
      .toEqual(['craft-complete=false', 'craft-complete=false', 'craft-complete=true']);
    expect(craftFile(run.dir, 'burn', 0)).toBe(craftFile(wholeDir, 'burn', 0));
    expect(journalLines(run.dir)).toEqual(journalLines(wholeDir));
    expect(existsSync(join(run.dir, checkpointFileName('burn', 0)))).toBe(false);
  });

  it('runs one iteration in a chunk that starts past its budget, so the chain still finishes', () => {
    const wholeDir = temp('late-whole');
    expect(runCli([...stubArgs, '--out', wholeDir], stubDeps)).toBe(0);

    // 90 seconds a measurement: the greedy build's measurement alone spends
    // chunk 0's minute before the climb begins, and every later chunk spends it
    // on its first iteration. Seven iterations, seven chunks.
    const run = runChunked('late', stubArgs, ['--chunk-minutes', '1'], 7, () => measuredClock(90));
    expect(nextIterations(run)).toEqual([2, 3, 4, 5, 6, 7, 8].map((next) => `next-iteration=${next}`));
    expect(craftFile(run.dir, 'burn', 0)).toBe(craftFile(wholeDir, 'burn', 0));
    expect(journalLines(run.dir)).toEqual(journalLines(wholeDir));
  });

  it('ends a chunk at whichever bound comes first when both are given', () => {
    const chunkOnce = (label: string, flags: string[]): string[] => {
      const lines: string[] = [];
      expect(runCli([...stubArgs, ...flags, '--out', temp(label)],
        { ...measuredClock(20), log: (line) => lines.push(line) })).toBe(0);
      return lines;
    };
    // The clock alone allows two iterations in chunk 0 (see above).
    expect(chunkOnce('bound-iterations', ['--chunk-minutes', '1', '--chunk-iterations', '1']))
      .toContain('next-iteration=2');
    expect(chunkOnce('bound-minutes', ['--chunk-minutes', '1', '--chunk-iterations', '5']))
      .toContain('next-iteration=3');
  });

  it('refuses --chunk-minutes on the in-process loop, and a budget that is not a positive integer', () => {
    const errors: string[] = [];
    const deps = { ...stubDeps, error: (message: string) => errors.push(message) };
    expect(runCli([
      '--metagame', '--personas', 'burn,weenie', '--rounds', '1', '--field', 'starters',
      '--seeds', '1', '--iterations', '4', '--seed', '424242', '--chunk-minutes', '240',
      '--out', temp('loop-minutes'),
    ], deps)).toBe(1);
    expect(errors[0]).toContain('--chunk-minutes applies to --metagame-craft only');

    for (const value of ['0', '1.5', 'soon']) {
      const out = temp(`minutes-${value}`);
      errors.length = 0;
      expect(runCli([...stubArgs, '--chunk-minutes', value, '--out', out], deps)).toBe(1);
      expect(errors[0]).toBe(`--chunk-minutes must be a positive integer (got ${value})`);
      expect(existsSync(join(out, checkpointFileName('burn', 0)))).toBe(false);
    }
  });

  it('carries a real-engine craft across chunks byte for byte', () => {
    // Tiny on purpose: five starter decks, two games each, four swaps. --no-memo
    // on both sides, so the chunked craft really re-measures under the engine
    // instead of reading the unchunked run's cache.
    const args = [
      '--metagame-craft', 'weenie', '--round', '0', '--personas', 'burn,weenie', '--rounds', '1',
      '--field', 'starters', '--pool', 'all', '--seeds', '2', '--iterations', '4', '--seed', '13003',
      '--workers', '1', '--no-memo',
    ];
    const wholeDir = temp('engine-whole');
    expect(runCli([...args, '--out', wholeDir], quiet)).toBe(0);
    const chunked = runChunked('engine', args, ['--chunk-iterations', '3'], 2, () => quiet);
    expect(craftFile(chunked.dir, 'weenie', 0)).toBe(craftFile(wholeDir, 'weenie', 0));
    expect(journalLines(chunked.dir)).toEqual(journalLines(wholeDir));
  });
});
