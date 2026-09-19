/**
 * signals-rollup / queries — the dimension table and the SQL it becomes.
 *
 * PURE. No fs, no fetch, no process, no clock. Everything here is a function of
 * its arguments, so the SQL a run will send can be asserted in a test without a
 * network stack anywhere near it.
 *
 * Read first: the ANALYTICS ENGINE COLUMN LAYOUT header of worker/src/index.ts.
 * That header is the only source of truth for which blob or double carries which
 * field, and this file is the only place in the rollup that knows a column name.
 * If the Worker ever writes a v3 dataset, the table below moves with it.
 *
 * THE ONE RULE FOR EVERY QUERY AGAINST THIS DATASET, restated from
 * worker/scripts/query.ts: counts are `sum(_sample_interval)`, never `count()`.
 * Analytics Engine samples writes per index value, and the T0 spike measured 20
 * heartbeats stored as 2 under a shared index. `count()` reports the sample, not
 * the traffic. The single exception is `count(DISTINCT blob3)`, the distinct
 * install count, which has no sample-corrected form: under sampling it
 * UNDERCOUNTS, and an undercounted anonymity gate is the safe direction — it
 * suppresses more than strictly necessary, never less.
 *
 * Day bounds are half-open UTC: `>= toDateTime('<day> 00:00:00')` and
 * `< toDateTime('<next day> 00:00:00')`, so no row is counted twice and none is
 * missed. Every query also filters `blob2 = '<build>'` so a future build label
 * cannot silently mix two schemas into one total.
 */

// ---------------------------------------------------------------------------
// Day arithmetic. Pure, UTC, and string-in / string-out, so nothing downstream
// ever holds a Date whose local zone could shift a day boundary.
//
// It lives here rather than in core.ts because the SQL needs `nextDay` and
// core.ts already imports this module for the dimension table; one direction of
// dependency is worth more than a tidier filename.
// ---------------------------------------------------------------------------

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Build labels reach a SQL string literal, so the charset is bounded here. */
const BUILD_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;
/** Dataset names reach the FROM clause, so they are bounded the same way. */
const DATASET_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

const MS_PER_DAY = 86_400_000;

export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  // Rejects 2026-02-30 and friends: Date.parse accepts some of them and rolls
  // them forward, so the round trip is the real check.
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

export function assertDay(value: unknown, what: string): string {
  if (!isDay(value)) throw new Error(`signals-rollup: ${what} must be a UTC day as YYYY-MM-DD`);
  return value;
}

/** `2026-10-01`, +1 -> `2026-10-02`. Negative offsets walk backwards. */
export function addDays(day: string, offset: number): string {
  assertDay(day, 'a day');
  return new Date(Date.parse(`${day}T00:00:00Z`) + offset * MS_PER_DAY).toISOString().slice(0, 10);
}

export function nextDay(day: string): string {
  return addDays(day, 1);
}

/** The UTC day an instant falls in. The ONLY place a clock becomes a day. */
export function utcDayOf(epochMs: number): string {
  if (!Number.isFinite(epochMs)) throw new Error('signals-rollup: the clock must be a finite epoch time');
  return new Date(epochMs).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// The dimension table. DATA, not code: a row per published dimension, naming
// the field (as `src/meta/playSignals.ts` spells it) and the column that holds
// it. `tests/scripts/signalsRollup.test.ts` holds this table equal to
// SIGNAL_FIELDS in both directions, so a schema change that adds a field fails
// the suite until somebody decides how it rolls up.
// ---------------------------------------------------------------------------

/** How a raw column value becomes a published label. */
export type ValueLabel = 'text' | 'bool' | 'int';

/** What an entry's anonymity gate is measured in. */
export type GateKind = 'installs' | 'rows';

export interface Dimension {
  /** The field name as playSignals spells it; `settings.` prefixed for the nested three. */
  readonly name: string;
  /** The Analytics Engine column, per the worker/src/index.ts header. */
  readonly column: string;
  readonly label: ValueLabel;
}

/** A two-dimension grouping: `first` broken down by `by`. */
export interface Cross {
  readonly first: string;
  readonly by: string;
  readonly byColumn: string;
  readonly byLabel: ValueLabel;
}

/**
 * heartbeat, unit = INSTALLS. `buildSha` is deliberately absent: a build hash is
 * a near-unique value, and `appVersion` already answers the question a build
 * breakdown would be asked. `blob3` (the daily hash) is the gate, never a
 * dimension.
 */
export const HEARTBEAT_DIMENSIONS: readonly Dimension[] = [
  { name: 'appVersion', column: 'blob4', label: 'text' },
  { name: 'platform', column: 'blob6', label: 'text' },
  { name: 'formFactor', column: 'blob7', label: 'text' },
  { name: 'lang', column: 'blob8', label: 'text' },
  { name: 'settings.animations', column: 'blob9', label: 'text' },
  { name: 'settings.renderScale', column: 'blob10', label: 'text' },
  { name: 'streakBucket', column: 'blob11', label: 'text' },
  { name: 'achievementsBucket', column: 'blob12', label: 'text' },
  { name: 'winsBucket', column: 'blob13', label: 'text' },
  { name: 'lossesBucket', column: 'blob14', label: 'text' },
  { name: 'packsBucket', column: 'blob15', label: 'text' },
  { name: 'collectionBucket', column: 'blob16', label: 'text' },
  { name: 'settings.reducedMotion', column: 'double1', label: 'bool' },
  { name: 'tutorialDone', column: 'double2', label: 'bool' },
  { name: 'gauntletBestRung', column: 'double3', label: 'int' },
];

/** duel, unit = DUELS, gated by the installs behind them. */
export const DUEL_DIMENSIONS: readonly Dimension[] = [
  { name: 'format', column: 'blob4', label: 'text' },
  { name: 'deckColours', column: 'blob5', label: 'text' },
  { name: 'deckArchetype', column: 'blob6', label: 'text' },
  { name: 'curveBucket', column: 'blob7', label: 'text' },
  { name: 'deckSource', column: 'blob8', label: 'text' },
  { name: 'opponentId', column: 'blob9', label: 'text' },
  { name: 'difficulty', column: 'blob10', label: 'text' },
  { name: 'turnsBucket', column: 'blob11', label: 'text' },
  { name: 'result', column: 'blob12', label: 'text' },
  { name: 'mulligans', column: 'double1', label: 'int' },
];

const RESULT_SPLIT = { by: 'result', byColumn: 'blob12', byLabel: 'text' } as const;

/** The five duel breakdowns that are worth a result split. */
export const DUEL_CROSSES: readonly Cross[] = [
  { first: 'opponentId', ...RESULT_SPLIT },
  { first: 'difficulty', ...RESULT_SPLIT },
  { first: 'format', ...RESULT_SPLIT },
  { first: 'deckArchetype', ...RESULT_SPLIT },
  { first: 'deckColours', ...RESULT_SPLIT },
];

/**
 * card, unit = ROWS. Card rows carry no install hash by design (blob3 is always
 * empty), so one row is one session that played the card and the row count IS
 * the anonymity gate. `countBucket` is published only as the cross below, which
 * is the shape that answers "how often", so it needs no marginal of its own.
 */
export const CARD_DIMENSIONS: readonly Dimension[] = [
  { name: 'cardId', column: 'blob4', label: 'text' },
  { name: 'duelsBucket', column: 'blob6', label: 'text' },
];

export const CARD_CROSSES: readonly Cross[] = [
  { first: 'cardId', by: 'countBucket', byColumn: 'blob5', byLabel: 'text' },
];

/** Every dimension of a section, by name. Used by core.ts and by the tests. */
export function dimensionsByName(dimensions: readonly Dimension[]): ReadonlyMap<string, Dimension> {
  return new Map(dimensions.map((dimension) => [dimension.name, dimension]));
}

export function findDimension(dimensions: readonly Dimension[], name: string): Dimension {
  const found = dimensions.find((dimension) => dimension.name === name);
  if (!found) throw new Error(`signals-rollup: no dimension named ${name}`);
  return found;
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

export interface QuerySpec {
  /** Stable id: `<section>.total`, `<section>.dim.<name>`, `<section>.cross.<first>`. */
  readonly id: string;
  readonly sql: string;
}

export interface QueryOptions {
  readonly build: string;
  readonly dataset: string;
}

/** `blob1` values, one per event, exactly as the Worker writes them. */
const EVENT = { heartbeat: 'heartbeat', duel: 'duel', card: 'card' } as const;

function where(event: string, day: string, options: QueryOptions): string {
  return [
    `WHERE blob1 = '${event}'`,
    `    AND blob2 = '${options.build}'`,
    `    AND timestamp >= toDateTime('${day} 00:00:00')`,
    `    AND timestamp < toDateTime('${nextDay(day)} 00:00:00')`,
  ].join('\n  ');
}

function checkOptions(options: QueryOptions): void {
  if (!BUILD_PATTERN.test(options.build)) {
    throw new Error('signals-rollup: the build label must be 1 to 40 characters of [A-Za-z0-9._-]');
  }
  if (!DATASET_PATTERN.test(options.dataset)) {
    throw new Error('signals-rollup: the dataset name must be 1 to 64 characters of [A-Za-z0-9_]');
  }
}

/**
 * Every query built for one day, in the order a run sends them.
 *
 * `heartbeat` queries publish `installs` (`count(DISTINCT blob3)`) and carry
 * `sum(_sample_interval)` alongside as the sampling witness: it is not
 * published, and it is what makes the one-rule-for-every-query check literal
 * rather than special-cased.
 */
export function buildQueries(day: string, options: QueryOptions): QuerySpec[] {
  assertDay(day, 'the day to roll up');
  checkOptions(options);
  const from = `FROM ${options.dataset}`;
  const out: QuerySpec[] = [];

  // ---- heartbeat ----------------------------------------------------------
  out.push({
    id: 'heartbeat.total',
    sql: [
      'SELECT count(DISTINCT blob3) AS n,',
      '         sum(_sample_interval) AS heartbeats',
      `  ${from}`,
      `  ${where(EVENT.heartbeat, day, options)}`,
    ].join('\n'),
  });
  for (const dimension of HEARTBEAT_DIMENSIONS) {
    out.push({
      id: `heartbeat.dim.${dimension.name}`,
      sql: [
        `SELECT ${dimension.column} AS value,`,
        '         count(DISTINCT blob3) AS n,',
        '         sum(_sample_interval) AS heartbeats',
        `  ${from}`,
        `  ${where(EVENT.heartbeat, day, options)}`,
        '  GROUP BY value',
        '  ORDER BY value',
      ].join('\n'),
    });
  }

  // ---- duel ---------------------------------------------------------------
  out.push({
    id: 'duel.total',
    sql: [
      'SELECT sum(_sample_interval) AS n,',
      '         count(DISTINCT blob3) AS gate',
      `  ${from}`,
      `  ${where(EVENT.duel, day, options)}`,
    ].join('\n'),
  });
  for (const dimension of DUEL_DIMENSIONS) {
    out.push({
      id: `duel.dim.${dimension.name}`,
      sql: [
        `SELECT ${dimension.column} AS value,`,
        '         sum(_sample_interval) AS n,',
        '         count(DISTINCT blob3) AS gate',
        `  ${from}`,
        `  ${where(EVENT.duel, day, options)}`,
        '  GROUP BY value',
        '  ORDER BY value',
      ].join('\n'),
    });
  }
  for (const cross of DUEL_CROSSES) {
    const first = findDimension(DUEL_DIMENSIONS, cross.first);
    out.push({
      id: `duel.cross.${cross.first}`,
      sql: [
        `SELECT ${first.column} AS value,`,
        `         ${cross.byColumn} AS split,`,
        '         sum(_sample_interval) AS n,',
        '         count(DISTINCT blob3) AS gate',
        `  ${from}`,
        `  ${where(EVENT.duel, day, options)}`,
        '  GROUP BY value, split',
        '  ORDER BY value, split',
      ].join('\n'),
    });
  }

  // ---- cards --------------------------------------------------------------
  // No `count(DISTINCT blob3)` anywhere below: on a card row blob3 is always
  // empty by design, so rows are both the unit and the gate.
  out.push({
    id: 'cards.total',
    sql: [
      'SELECT sum(_sample_interval) AS n',
      `  ${from}`,
      `  ${where(EVENT.card, day, options)}`,
    ].join('\n'),
  });
  for (const dimension of CARD_DIMENSIONS) {
    out.push({
      id: `cards.dim.${dimension.name}`,
      sql: [
        `SELECT ${dimension.column} AS value,`,
        '         sum(_sample_interval) AS n',
        `  ${from}`,
        `  ${where(EVENT.card, day, options)}`,
        '  GROUP BY value',
        '  ORDER BY value',
      ].join('\n'),
    });
  }
  for (const cross of CARD_CROSSES) {
    const first = findDimension(CARD_DIMENSIONS, cross.first);
    out.push({
      id: `cards.cross.${cross.first}`,
      sql: [
        `SELECT ${first.column} AS value,`,
        `         ${cross.byColumn} AS split,`,
        '         sum(_sample_interval) AS n',
        `  ${from}`,
        `  ${where(EVENT.card, day, options)}`,
        '  GROUP BY value, split',
        '  ORDER BY value, split',
      ].join('\n'),
    });
  }

  return out;
}
