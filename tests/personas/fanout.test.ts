import { mkdtempSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
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
