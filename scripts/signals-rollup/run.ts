/**
 * signals-rollup / run — the only impure file in the rollup.
 *
 *   npx tsx scripts/signals-rollup/run.ts --out signals-data/rollups
 *
 * There is an `npm run signals-rollup` wrapper, but CALL TSX DIRECTLY whenever
 * you pass a flag: npm claims unknown flags as its own config and PowerShell
 * eats `--`, so the arguments arrive stripped and reordered (playbook §11). The
 * workflow runs on bash and calls tsx directly for the same reason.
 *
 * Arguments, config, the SQL fetch and the file writes live here; the floor and
 * the SQL live in core.ts and queries.ts, which are pure and are what the tests
 * mostly exercise. The fetch is injectable, so a test drives a whole run with a
 * fake and NOTHING in the suite touches the network.
 *
 * Flags:
 *   --out <dir>        where day files are written. Default: signals-data/rollups
 *   --day <YYYY-MM-DD> roll up exactly this day instead of the backfill window
 *   --config <file>    a different config.json. LOCAL ONLY; the workflow never passes it
 *   --fixture <file>   read rows from a JSON fixture instead of Cloudflare.
 *                      LOCAL ONLY; the workflow never passes it, and with it set
 *                      no credential is read and no request is made
 *   --force-local      allow --day to overwrite an existing file. Refused when the
 *                      output path is the published one, because re-publishing a
 *                      day with different numbers is a differencing leak
 *
 * Credentials: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_ANALYTICS_TOKEN`, from
 * repo secrets. The token name has NO fallback to a deploy token on purpose: the
 * T0 spike measured that the deploy token is also accepted by the SQL API, and
 * accepting it here would quietly undo the scoping the owner did by hand. The
 * token is read in one place, passed to one `fetch`, and never logged.
 *
 * LOGGING, and this matters: Actions logs on this repo are PUBLIC. Every line
 * printed from here is a day, a path, or a COUNT of values. Never a query, never
 * a result, never a raw count, never a gate, never the name of a value that was
 * folded. `buildDay` returns its own summary precisely so this file never holds
 * a folded value's name in the first place.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertNoSubFloorNumber,
  buildDay,
  daysToRoll,
  serializeDay,
  serializeIndex,
  type DayResult,
  type RawRow,
} from './core';
import { assertDay, addDays, buildQueries, isDay, utcDayOf, type QuerySpec } from './queries';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

export const DEFAULT_CONFIG_FILE = join(HERE, 'config.json');
export const DEFAULT_OUT_DIR = join(REPO_ROOT, 'signals-data', 'rollups');
/** A path segment that means "this is the published branch's working copy". */
export const PUBLISHED_DIR_SEGMENT = 'signals-data';

export interface RollupConfig {
  /**
   * The first day that may be rolled up, or null while the game has not shipped
   * stats. Null means a run prints one line and writes nothing, which also keeps
   * the deploy day's synthetic test rows out of the published series.
   */
  readonly startDate: string | null;
  readonly build: string;
  readonly dataset: string;
}

export type FetchSql = (sql: string) => Promise<RawRow[]>;
export type Logger = (line: string) => void;

export interface RunOptions {
  readonly outDir: string;
  readonly config: RollupConfig;
  readonly fetchSql: FetchSql;
  /** Injected clock. Nothing below reads one. */
  readonly nowMs: number;
  readonly log: Logger;
  /** `--day`: roll exactly this day. */
  readonly day?: string;
  readonly forceLocal?: boolean;
}

export interface RunResult {
  readonly written: string[];
  /** Days that already had a file and were left alone. */
  readonly skipped: string[];
  readonly indexPath: string | null;
}

// ---------------------------------------------------------------------------
// Config and arguments
// ---------------------------------------------------------------------------

export function parseConfig(text: string): RollupConfig {
  const raw = JSON.parse(text) as Partial<RollupConfig>;
  const startDate = raw.startDate ?? null;
  if (startDate !== null && !isDay(startDate)) {
    throw new Error('signals-rollup: config startDate must be null or a UTC day as YYYY-MM-DD');
  }
  if (typeof raw.build !== 'string' || typeof raw.dataset !== 'string') {
    throw new Error('signals-rollup: config must carry a build label and a dataset name');
  }
  return { startDate, build: raw.build, dataset: raw.dataset };
}

export function readConfig(file: string): RollupConfig {
  return parseConfig(readFileSync(file, 'utf8'));
}

export interface Args {
  out?: string;
  day?: string;
  config?: string;
  fixture?: string;
  forceLocal: boolean;
}

export function parseArgs(argv: readonly string[]): Args {
  const args: Args = { forceLocal: false };
  let i = 0;
  const value = (flag: string): string => {
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`signals-rollup: ${flag} needs a value`);
    i++;
    return next;
  };
  while (i < argv.length) {
    const flag = argv[i];
    if (flag === '--out') args.out = value(flag);
    else if (flag === '--day') args.day = assertDay(value(flag), '--day');
    else if (flag === '--config') args.config = value(flag);
    else if (flag === '--fixture') args.fixture = value(flag);
    else if (flag === '--force-local') args.forceLocal = true;
    else throw new Error(`signals-rollup: unknown argument ${flag}`);
    i++;
  }
  return args;
}

/** True when the output path is the published branch's working copy. */
export function isPublishedOutDir(outDir: string): boolean {
  return resolve(outDir)
    .split(/[\\/]+/)
    .some((segment) => segment === PUBLISHED_DIR_SEGMENT);
}

// ---------------------------------------------------------------------------
// The output tree: rollups/YYYY/MM/DD.json
// ---------------------------------------------------------------------------

export function dayFile(outDir: string, day: string): string {
  assertDay(day, 'a day');
  return join(outDir, day.slice(0, 4), day.slice(5, 7), `${day.slice(8, 10)}.json`);
}

/** Every day already written under `outDir`, sorted. Missing directories read as empty. */
export function existingDays(outDir: string): string[] {
  const days: string[] = [];
  const entries = (dir: string): string[] => {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  };
  for (const year of entries(outDir)) {
    if (!/^\d{4}$/.test(year)) continue;
    for (const month of entries(join(outDir, year))) {
      if (!/^\d{2}$/.test(month)) continue;
      for (const file of entries(join(outDir, year, month))) {
        const match = /^(\d{2})\.json$/.exec(file);
        if (!match) continue;
        const day = `${year}-${month}-${match[1]}`;
        if (isDay(day)) days.push(day);
      }
    }
  }
  return days.sort();
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * The real reader. Called only from `main`, never from a test: the suite has no
 * path that reaches it, because `fetchSql` is injected everywhere else.
 */
export function cloudflareFetch(accountId: string, token: string): FetchSql {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
  return async (sql: string): Promise<RawRow[]> => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'text/plain' },
      body: sql,
    });
    // The status only. A body could echo the query, and the query is not
    // something a public log needs.
    if (!response.ok) throw new Error(`signals-rollup: the Analytics Engine SQL API answered ${response.status}`);
    const text = await response.text();
    let parsed: { data?: unknown };
    try {
      parsed = JSON.parse(text) as { data?: unknown };
    } catch {
      throw new Error('signals-rollup: the Analytics Engine SQL API answered with something that is not JSON');
    }
    return Array.isArray(parsed.data) ? (parsed.data as RawRow[]) : [];
  };
}

/** A fetch that answers from a fixture file. Local only; the workflow never uses it. */
export function fixtureFetch(
  fixture: Readonly<Record<string, Record<string, RawRow[]>>>,
  config: RollupConfig,
): FetchSql {
  const bySql = new Map<string, RawRow[]>();
  for (const [day, byId] of Object.entries(fixture)) {
    // A fixture may carry `_`-prefixed notes; JSON has no comments.
    if (day.startsWith('_')) continue;
    assertDay(day, 'a fixture day');
    for (const query of buildQueries(day, { build: config.build, dataset: config.dataset })) {
      bySql.set(query.sql, byId[query.id] ?? []);
    }
  }
  return (sql: string): Promise<RawRow[]> => Promise.resolve(bySql.get(sql) ?? []);
}

async function fetchAll(queries: readonly QuerySpec[], fetchSql: FetchSql): Promise<Record<string, RawRow[]>> {
  const rows: Record<string, RawRow[]> = {};
  // Sequential on purpose: a day is about forty queries against a free tier of
  // ten thousand reads, so there is nothing to gain by going wide.
  for (const query of queries) rows[query.id] = await fetchSql(query.sql);
  return rows;
}

// ---------------------------------------------------------------------------
// One day
// ---------------------------------------------------------------------------

export async function rollupOneDay(day: string, options: RunOptions): Promise<DayResult> {
  const queries = buildQueries(day, { build: options.config.build, dataset: options.config.dataset });
  const rows = await fetchAll(queries, options.fetchSql);
  return buildDay({ day, build: options.config.build, rows });
}

function logSummary(result: DayResult, log: Logger): void {
  for (const section of result.summary) {
    if (!section.present) {
      log(`signals-rollup:   ${section.section}: absent, the day is below the floor`);
      continue;
    }
    log(
      `signals-rollup:   ${section.section}: published=${section.published} folded=${section.folded} suppressed=${section.suppressed}`,
    );
  }
}

// ---------------------------------------------------------------------------
// A run
// ---------------------------------------------------------------------------

export async function runRollup(options: RunOptions): Promise<RunResult> {
  const { config, log, outDir } = options;

  if (config.startDate === null) {
    log('signals-rollup: config startDate is null, so the game has not shipped stats yet. Nothing written.');
    return { written: [], skipped: [], indexPath: null };
  }

  const today = utcDayOf(options.nowMs);
  const yesterday = addDays(today, -1);
  const already = new Set(existingDays(outDir));

  let days: string[];
  if (options.day !== undefined) {
    const day = assertDay(options.day, '--day');
    if (day < config.startDate) {
      throw new Error(`signals-rollup: ${day} is before the configured start date, so it is never rolled up`);
    }
    if (day > yesterday) {
      throw new Error(`signals-rollup: ${day} is not a complete UTC day yet`);
    }
    if (already.has(day)) {
      // An existing file is never rewritten. Re-publishing a day with different
      // numbers lets a reader difference the two and recover what the floor
      // removed, so the override is local-only and refuses the published path.
      if (!options.forceLocal) {
        throw new Error(`signals-rollup: ${day} already has a file and an existing day is never rewritten`);
      }
      if (isPublishedOutDir(outDir)) {
        throw new Error('signals-rollup: --force-local is refused against the published output directory');
      }
      log(`signals-rollup: ${day} is being rewritten under --force-local (local output only)`);
      already.delete(day);
    }
    days = [day];
  } else {
    days = daysToRoll({ startDate: config.startDate, nowMs: options.nowMs, existing: already });
  }

  const written: string[] = [];
  const skipped: string[] = [];

  if (days.length === 0) {
    log('signals-rollup: no complete day in the window is missing a file.');
  }

  for (const day of days) {
    const file = dayFile(outDir, day);
    if (existsSync(file) && !(options.day === day && options.forceLocal)) {
      skipped.push(day);
      log(`signals-rollup: ${day} already has a file, left alone.`);
      continue;
    }
    const result = await rollupOneDay(day, options);
    // The last line of defence, before anything reaches a file that may be
    // committed to a public repository. It throws, the write does not happen,
    // and main() exits non-zero.
    assertNoSubFloorNumber(result.json);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, serializeDay(result.json), 'utf8');
    written.push(day);
    log(`signals-rollup: ${day} -> ${file}`);
    logSummary(result, log);
  }

  const indexPath = join(outDir, 'index.json');
  const allDays = existingDays(outDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(indexPath, serializeIndex(allDays), 'utf8');
  log(`signals-rollup: index rewritten with ${allDays.length} day(s).`);

  return { written, skipped, indexPath };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = readConfig(args.config ?? DEFAULT_CONFIG_FILE);
  const outDir = args.out ?? DEFAULT_OUT_DIR;
  const log: Logger = (line) => console.log(line);

  let fetchSql: FetchSql;
  if (args.fixture !== undefined) {
    const fixture = JSON.parse(readFileSync(args.fixture, 'utf8')) as Record<string, Record<string, RawRow[]>>;
    fetchSql = fixtureFetch(fixture, config);
    log('signals-rollup: reading rows from a fixture file. No credential is read and no request is made.');
  } else if (config.startDate === null) {
    // Ordered so a run before the 1.8 cut needs no credential at all.
    fetchSql = () => Promise.reject(new Error('signals-rollup: unreachable, startDate is null'));
  } else {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN;
    if (!accountId || !token) {
      throw new Error('signals-rollup: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_ANALYTICS_TOKEN must both be set');
    }
    fetchSql = cloudflareFetch(accountId, token);
  }

  await runRollup({
    outDir,
    config,
    fetchSql,
    nowMs: Date.now(),
    log,
    day: args.day,
    forceLocal: args.forceLocal,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
