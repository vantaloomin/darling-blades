/**
 * The rollup's orchestration: which days a run writes, which it refuses, what it
 * puts on disk, and what it is allowed to say out loud.
 *
 * Every run below is driven by a fake `fetchSql` built from a fixture file. No
 * test here opens a socket, reads an environment variable, or imports Phaser.
 * `cloudflareFetch` is the only function in the rollup that can make a request
 * and nothing in the suite calls it.
 */

import { PLACEHOLDERS } from '../../scripts/gen-legal-pages';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ROLLUP_K, type RawRow } from '../../scripts/signals-rollup/core';
import {
  dayFile,
  existingDays,
  fixtureFetch,
  isPublishedOutDir,
  parseArgs,
  parseConfig,
  runRollup,
  type RollupConfig,
  type RunOptions,
} from '../../scripts/signals-rollup/run';

const FIXTURE = JSON.parse(
  readFileSync(new URL('./fixtures/signals-rollup-rows.json', import.meta.url), 'utf8'),
) as Record<string, Record<string, RawRow[]>>;

const CONFIG: RollupConfig = { startDate: '2026-09-16', build: 't2', dataset: 'db_signals_v2' };
const BUSY_DAY = '2026-09-16';
const QUIET_DAY = '2026-09-17';
/** Noon on the day after the fixture's last day, so both days are complete. */
const NOW = Date.parse('2026-09-18T12:00:00Z');

let outDir = '';
let lines: string[] = [];

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), 'signals-rollup-'));
  lines = [];
});

afterEach(() => {
  rmSync(outDir, { recursive: true, force: true });
});

function options(overrides: Partial<RunOptions> = {}): RunOptions {
  const config = overrides.config ?? CONFIG;
  return {
    outDir,
    config,
    fetchSql: fixtureFetch(FIXTURE, config),
    nowMs: NOW,
    log: (line) => lines.push(line),
    ...overrides,
  };
}

const readDay = (day: string, dir = outDir): string => readFileSync(dayFile(dir, day), 'utf8');

describe('runRollup: the backfill window', () => {
  it('writes exactly the days that are complete, in the window, and missing', async () => {
    const result = await runRollup(options());
    expect(result.written).toEqual([BUSY_DAY, QUIET_DAY]);
    expect(existsSync(dayFile(outDir, BUSY_DAY))).toBe(true);
    expect(existsSync(dayFile(outDir, QUIET_DAY))).toBe(true);
    // Today is never rolled up: it is not a complete UTC day yet.
    expect(existsSync(dayFile(outDir, '2026-09-18'))).toBe(false);
    expect(existingDays(outDir)).toEqual([BUSY_DAY, QUIET_DAY]);
  });

  it('files a day at rollups/YYYY/MM/DD.json', () => {
    expect(dayFile('/out', '2026-09-16')).toBe(join('/out', '2026', '09', '16.json'));
  });

  it('never rewrites a day that already has a file', async () => {
    await runRollup(options());
    const before = readDay(BUSY_DAY);
    writeFileSync(dayFile(outDir, BUSY_DAY), `${before.slice(0, -1)}\n`, 'utf8');
    const second = await runRollup(options());
    expect(second.written).toEqual([]);
    expect(second.skipped).toEqual([]);
    // Nothing was rolled up, so nothing was overwritten: the file is untouched.
    expect(readDay(BUSY_DAY)).toBe(before);
    expect(lines.some((line) => line.includes('no complete day in the window is missing a file'))).toBe(true);
  });

  it('writes byte-identical bytes when a day is rolled up again from scratch', async () => {
    await runRollup(options());
    const first = readDay(BUSY_DAY);
    rmSync(dayFile(outDir, BUSY_DAY));
    await runRollup(options());
    expect(readDay(BUSY_DAY)).toBe(first);
  });

  it('rewrites the index with every day present, sorted', async () => {
    await runRollup(options());
    const index = JSON.parse(readFileSync(join(outDir, 'index.json'), 'utf8')) as {
      days: string[];
      k: number;
      schema: number;
    };
    expect(index).toEqual({ days: [BUSY_DAY, QUIET_DAY], k: ROLLUP_K, schema: 1 });
  });

  it('writes a whole file for a day where every section is below the floor', async () => {
    await runRollup(options());
    const quiet = JSON.parse(readDay(QUIET_DAY)) as Record<string, unknown>;
    expect(quiet.heartbeat).toBeNull();
    expect(quiet.duel).toBeNull();
    expect(quiet.cards).toBeNull();
    expect(quiet.day).toBe(QUIET_DAY);
  });
});

describe('runRollup: the refusals', () => {
  it('writes nothing at all while the config has no start date', async () => {
    const config: RollupConfig = { ...CONFIG, startDate: null };
    const result = await runRollup(options({ config, fetchSql: fixtureFetch(FIXTURE, config) }));
    expect(result.written).toEqual([]);
    expect(result.indexPath).toBeNull();
    expect(existingDays(outDir)).toEqual([]);
    expect(existsSync(join(outDir, 'index.json'))).toBe(false);
    expect(lines).toEqual([
      'signals-rollup: config startDate is null, so the game has not shipped stats yet. Nothing written.',
    ]);
  });

  it('refuses a day before the start date', async () => {
    await expect(runRollup(options({ day: '2026-09-15' }))).rejects.toThrow(/before the configured start date/);
    expect(existingDays(outDir)).toEqual([]);
  });

  it('refuses a day that is not complete yet', async () => {
    await expect(runRollup(options({ day: '2026-09-18' }))).rejects.toThrow(/not a complete UTC day/);
  });

  it('refuses to rewrite an existing day without --force-local', async () => {
    await runRollup(options({ day: BUSY_DAY }));
    await expect(runRollup(options({ day: BUSY_DAY }))).rejects.toThrow(/never rewritten/);
  });

  it('allows --force-local into a local folder and refuses it against the published one', async () => {
    await runRollup(options({ day: BUSY_DAY }));
    const again = await runRollup(options({ day: BUSY_DAY, forceLocal: true }));
    expect(again.written).toEqual([BUSY_DAY]);

    const publishedDir = join(outDir, 'signals-data', 'rollups');
    await runRollup(options({ outDir: publishedDir, day: BUSY_DAY }));
    await expect(
      runRollup(options({ outDir: publishedDir, day: BUSY_DAY, forceLocal: true })),
    ).rejects.toThrow(/refused against the published output directory/);
  });

  it('knows the published output directory by its path', () => {
    expect(isPublishedOutDir(join('a', 'signals-data', 'rollups'))).toBe(true);
    expect(isPublishedOutDir(join('a', 'balance', 'signals-rollups'))).toBe(false);
  });
});

describe('the command line and the config file', () => {
  it('reads the flags the workflow uses and the ones only a human uses', () => {
    expect(parseArgs(['--out', 'signals-data/rollups'])).toEqual({
      out: 'signals-data/rollups',
      forceLocal: false,
    });
    expect(parseArgs(['--day', '2026-09-16', '--force-local'])).toEqual({
      day: '2026-09-16',
      forceLocal: true,
    });
    expect(() => parseArgs(['--day', 'yesterday'])).toThrow();
    expect(() => parseArgs(['--out'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--nope'])).toThrow(/unknown argument/);
  });

  it('accepts a null start date and rejects a malformed one', () => {
    expect(parseConfig('{"startDate":null,"build":"t2","dataset":"db_signals_v2"}').startDate).toBeNull();
    expect(parseConfig('{"startDate":"2026-10-01","build":"t2","dataset":"db_signals_v2"}').startDate).toBe(
      '2026-10-01',
    );
    expect(() => parseConfig('{"startDate":"October","build":"t2","dataset":"db_signals_v2"}')).toThrow();
    expect(() => parseConfig('{"startDate":null}')).toThrow();
  });

  it('ships with the start date the legal pages name as the 1.8 effective date', () => {
    // Both are filled at the cut, together: the rollup must not count the
    // deploy-day synthetic rows, and the privacy policy tells players the day
    // the stats began. A null start date is the pre-cut state and writes
    // nothing; once filled, the two surfaces have to agree.
    const shipped = parseConfig(
      readFileSync(new URL('../../scripts/signals-rollup/config.json', import.meta.url), 'utf8'),
    );
    expect(shipped.build).toBe('t2');
    expect(shipped.dataset).toBe('db_signals_v2');
    const effective = new Date(`${PLACEHOLDERS['[1.8 RELEASE DATE]']} UTC`);
    expect(Number.isNaN(effective.getTime())).toBe(false);
    expect(shipped.startDate).toBe(effective.toISOString().slice(0, 10));
  });
});

describe('what the run is allowed to say out loud', () => {
  /**
   * GitHub Actions logs on this repo are PUBLIC. Every line the run prints has
   * to match one of these, so a value name or a raw count cannot reach a log by
   * some path nobody thought of.
   */
  const PERMITTED = [
    /^signals-rollup: \d{4}-\d{2}-\d{2} -> .+$/,
    /^signals-rollup: {3}(heartbeat|duel|cards): published=\d+ folded=\d+ suppressed=\d+$/,
    /^signals-rollup: {3}(heartbeat|duel|cards): absent, the day is below the floor$/,
    /^signals-rollup: \d{4}-\d{2}-\d{2} already has a file, left alone\.$/,
    /^signals-rollup: \d{4}-\d{2}-\d{2} is being rewritten under --force-local \(local output only\)$/,
    /^signals-rollup: no complete day in the window is missing a file\.$/,
    /^signals-rollup: index rewritten with \d+ day\(s\)\.$/,
    /^signals-rollup: config startDate is null, so the game has not shipped stats yet\. Nothing written\.$/,
  ];

  /** Values the fixture keeps below the floor, and the numbers attached to them. */
  const FOLDED_NAMES = [
    'zz-hidden-persona',
    'chrome-broodmother',
    'th-lonely-vigil',
    'th-grove-communion',
    'db-rare-relic',
    'db-obscure-omen',
    'db-moon-bell',
    'marsh-mother',
    'deacon',
  ];
  /**
   * Most sub-floor counts here are small integers that would match by accident,
   * so the fixture gives one of them a distinctive number to assert on. The line
   * allowlist above is what actually forbids the rest: a line that matches it can
   * only carry a day, a path and three counts.
   */
  const FOLDED_NUMBERS = ['137'];

  it('prints counts, days and paths, and never a value or a result', async () => {
    await runRollup(options());
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(PERMITTED.some((pattern) => pattern.test(line)), `unexpected log line: ${line}`).toBe(true);
    }
    const log = lines.join('\n');
    for (const name of FOLDED_NAMES) expect(log, name).not.toContain(name);
    for (const number of FOLDED_NUMBERS) expect(log, number).not.toContain(number);
    // Nor any published number: a published value is safe in the file, but the
    // log has no business carrying data at all.
    expect(log).not.toContain('1840');
    expect(log).not.toContain('220');
  });

  it('names each section once per day it writes', async () => {
    await runRollup(options({ day: BUSY_DAY }));
    const sections = lines.filter((line) => /: {3}(heartbeat|duel|cards):/.test(line));
    expect(sections).toHaveLength(3);
    expect(sections.every((line) => /published=\d+ folded=\d+ suppressed=\d+$/.test(line))).toBe(true);
  });
});

describe('fixtureFetch', () => {
  it('answers the exact SQL the day builds, and an unknown query with nothing', async () => {
    const fetchSql = fixtureFetch(FIXTURE, CONFIG);
    await expect(fetchSql('SELECT 1')).resolves.toEqual([]);
    const result = await runRollup(options({ day: BUSY_DAY, fetchSql }));
    expect(result.written).toEqual([BUSY_DAY]);
  });
});
