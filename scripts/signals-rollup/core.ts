/**
 * signals-rollup / core — the k-anonymity floor, and the day file it produces.
 *
 * PURE. No fs, no fetch, no process, no `Date.now`. It takes rows that have
 * already been fetched and returns the object a run will write, plus a summary
 * of counts that is safe to print. Everything that could leak lives in here and
 * leaves only as a published number or as a count of values.
 *
 * WHAT THIS IMPLEMENTS is a promise already made to players, in
 * docs/legal/privacy-policy.md, "How long it is kept":
 *
 *   "we combine them into daily totals, and any value reported by fewer than 10
 *   summaries in a period is merged into 'other' so that no rare combination
 *   stands out. We keep those totals, which contain no individual summaries, and
 *   we may publish them in the game's public code repository."
 *
 * The last clause is why the floor is the deliverable: committing an aggregate
 * to a public repo IS publication (docs/legal/README.md, second-pass findings),
 * and the durable artifact has to be safer than the 90-day raw table it came
 * from (plan-telemetry-and-accounts.md, the k-anonymity caveat). `ROLLUP_K` is a
 * constant here rather than configuration for the same reason, and a test reads
 * the policy and fails if the promised number and this one ever drift apart.
 *
 * TWO UNITS, TWO GATES. A published number `n` and the anonymity measure `gate`
 * are not the same quantity:
 *   - heartbeat entries are counted in INSTALLS, so n and gate are one number;
 *   - duel entries are counted in DUELS but gated by the distinct INSTALLS
 *     behind them, because one install playing fifty duels of a rare archetype
 *     is a population of one however large the duel count looks;
 *   - card entries are counted in ROWS, one row per session that played the
 *     card, and card rows carry no install hash at all, so rows are the gate.
 */

import {
  CARD_CROSSES,
  CARD_DIMENSIONS,
  DUEL_CROSSES,
  DUEL_DIMENSIONS,
  HEARTBEAT_DIMENSIONS,
  addDays,
  assertDay,
  utcDayOf,
  type Cross,
  type Dimension,
  type GateKind,
  type ValueLabel,
} from './queries';

/**
 * The anonymity floor. Ten, because that is the number the privacy policy
 * promises players and the number plan-telemetry-and-accounts.md proposed. It is
 * NOT configuration: a per-run k is a knob that would let one run publish a
 * weaker file than the last, and a reader cannot tell the two apart afterwards.
 */
export const ROLLUP_K = 10;

/** Bumped only when the shape of a day file changes, never for new dimensions. */
export const SCHEMA_VERSION = 1;

/** The fold bucket, and the name a real value of the same spelling is moved to. */
export const OTHER = 'other';
export const OTHER_REPORTED = 'other (reported)';
/** An empty string is a legal blob value; it becomes a readable label. */
export const EMPTY_LABEL = '(empty)';
/** A double that is not a finite number. Unreachable through the Worker; defined anyway. */
export const UNKNOWN_LABEL = '(unknown)';

/** How many days back a run looks for a day it has not written yet. */
export const BACKFILL_DAYS = 7;

// ---------------------------------------------------------------------------
// Rows in, entries out
// ---------------------------------------------------------------------------

export type RawValue = string | number | boolean | null | undefined;
/** One row of the SQL API's `data` array. Its numbers arrive as STRINGS. */
export type RawRow = Record<string, RawValue>;

export interface Entry {
  readonly value: string;
  /** The number that may be published. */
  readonly n: number;
  /** The anonymity measure: installs, or rows where there is no install to count. */
  readonly gate: number;
}

/**
 * Where an entry's gate comes from, and how two gates combine inside `other`.
 * The two are separate questions and getting them confused is the easiest way to
 * build a floor that does not hold:
 *
 *   - heartbeat: the published number IS a distinct-install count, so the gate
 *     is `n` itself, and two folded gates take the MAXIMUM, since the same
 *     install can sit behind two values of one dimension on one day;
 *   - duel: the published number is duels and the gate is a separate
 *     `count(DISTINCT blob3)` column. Same maximum rule, same reason;
 *   - cards: a card row carries no install hash at all, so rows are both the
 *     number and the gate, and rows from different sessions are disjoint, so two
 *     folded gates ADD.
 */
export interface SectionShape {
  readonly gateSource: 'n' | 'column';
  readonly gateKind: GateKind;
}

export const HEARTBEAT_SHAPE: SectionShape = { gateSource: 'n', gateKind: 'installs' };
export const DUEL_SHAPE: SectionShape = { gateSource: 'column', gateKind: 'installs' };
export const CARD_SHAPE: SectionShape = { gateSource: 'n', gateKind: 'rows' };

/** The SQL API returns numbers as strings. Anything unreadable counts as nothing. */
export function parseCount(raw: RawValue): number {
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/**
 * A raw column value as a published label.
 *
 * A literal `other` in the data is renamed here, before the fold can see it, so
 * a real value and the fold bucket can never be confused.
 *
 * This is not hypothetical. `settings.renderScale` really does carry `other`
 * today: `renderScaleBucket` in src/meta/playSignals.ts returns it for any scale
 * that is not one of the three hard-coded ones, and `SIGNAL_VOCAB.renderScale`
 * lists it. Without the rename, every install on an unusual window size would be
 * counted as suppressed and its number would be added to whatever the floor
 * removed. A test pins the exact set of fields that carry the value, so a second
 * one gaining it is a decision rather than a silent merge.
 */
export function labelOf(raw: RawValue, label: ValueLabel): string {
  if (label === 'bool') return parseCount(raw) >= 1 ? 'true' : 'false';
  if (label === 'int') {
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    return Number.isFinite(value) ? String(Math.round(value)) : UNKNOWN_LABEL;
  }
  const text = raw === null || raw === undefined ? '' : String(raw);
  if (text === '') return EMPTY_LABEL;
  return text === OTHER ? OTHER_REPORTED : text;
}

/** Deterministic order for the fold: smallest gate first, then smallest n, then value. */
function compareEntries(a: Entry, b: Entry): number {
  if (a.gate !== b.gate) return a.gate - b.gate;
  if (a.n !== b.n) return a.n - b.n;
  return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
}

/**
 * Grouped rows to entries, merging any two rows whose labels collide (two
 * doubles rounding to one integer, say) so a later fold sees one entry per
 * published label. Merged gates follow the same rule the fold uses: rows add,
 * installs take the larger, because two install sets may overlap.
 */
export function toEntries(
  rows: readonly RawRow[],
  label: ValueLabel,
  shape: SectionShape,
  keys: { value?: string; n?: string; gate?: string } = {},
): Entry[] {
  const valueKey = keys.value ?? 'value';
  const nKey = keys.n ?? 'n';
  const gateKey = keys.gate ?? 'gate';
  const merged = new Map<string, { value: string; n: number; gate: number }>();
  for (const row of rows) {
    const value = labelOf(row[valueKey], label);
    const n = parseCount(row[nKey]);
    const gate = shape.gateSource === 'n' ? n : parseCount(row[gateKey]);
    const prior = merged.get(value);
    if (!prior) {
      merged.set(value, { value, n, gate });
      continue;
    }
    prior.n += n;
    prior.gate = shape.gateSource === 'n' ? prior.n : Math.max(prior.gate, gate);
  }
  return [...merged.values()].sort(compareEntries);
}

// ---------------------------------------------------------------------------
// THE FLOOR
// ---------------------------------------------------------------------------

/** A published dimension: value -> number, with at most one `other`. */
export type Published = Record<string, number>;

export interface FoldOutcome {
  /** null when nothing survived the floor. */
  readonly published: Published | null;
  /** How many values are printed under their own name. */
  readonly publishedCount: number;
  /** How many values ended up inside `other`, complementary suppression included. */
  readonly foldedCount: number;
}

/**
 * Fold one grouped result down to what may be published.
 *
 *  1. An entry is publishable when `gate >= ROLLUP_K` AND `n >= ROLLUP_K`.
 *     Everything else goes into `other`.
 *  2. `other`'s n is the sum of what it holds. Its gate is a LOWER BOUND: rows
 *     are disjoint so they add, but install sets may overlap, so install-gated
 *     folds take the MAXIMUM member. We know the true distinct union is at least
 *     the largest member and we do not know more than that, and guessing upward
 *     here would publish a cell the floor was supposed to catch.
 *  3. COMPLEMENTARY SUPPRESSION: while `other` exists and fails the same test,
 *     the smallest publishable entry is folded in as well and the test re-runs.
 *     Without it, a dimension with one suppressed value publishes everything
 *     else plus a total, and the suppressed cell is simple arithmetic.
 *  4. If everything folds and `other` still fails, the dimension is null.
 *
 * A dimension where nothing folded has no `other` key at all, and a value of
 * zero is never printed: an absent value and a folded value look the same from
 * outside, which is the point.
 */
export function foldEntries(entries: readonly Entry[], gateKind: GateKind): FoldOutcome {
  const sorted = [...entries].filter((entry) => entry.n > 0).sort(compareEntries);
  if (sorted.length === 0) return { published: null, publishedCount: 0, foldedCount: 0 };

  const passes = (candidate: { n: number; gate: number }): boolean =>
    candidate.gate >= ROLLUP_K && candidate.n >= ROLLUP_K;

  /** `other`, recomputed from what it holds: n always adds, the gate depends on the unit. */
  const otherOf = (held: readonly Entry[]): { n: number; gate: number } => ({
    n: held.reduce((total, entry) => total + entry.n, 0),
    gate:
      gateKind === 'rows'
        ? held.reduce((total, entry) => total + entry.gate, 0)
        : held.reduce((largest, entry) => Math.max(largest, entry.gate), 0),
  });

  const publishable: Entry[] = [];
  const folded: Entry[] = [];
  for (const entry of sorted) (passes(entry) ? publishable : folded).push(entry);

  // `publishable` is in ascending fold order already, so shift() is the smallest.
  while (folded.length > 0 && !passes(otherOf(folded))) {
    const smallest = publishable.shift();
    if (!smallest) return { published: null, publishedCount: 0, foldedCount: folded.length };
    folded.push(smallest);
  }

  const published: Published = {};
  for (const entry of publishable) published[entry.value] = entry.n;
  if (folded.length > 0) published[OTHER] = otherOf(folded).n;
  if (Object.keys(published).length === 0) return { published: null, publishedCount: 0, foldedCount: folded.length };
  return { published, publishedCount: publishable.length, foldedCount: folded.length };
}

// ---------------------------------------------------------------------------
// The day file
// ---------------------------------------------------------------------------

export interface CrossRow {
  readonly total: number;
  /** Absent when the split was entirely suppressed; the row keeps its total. */
  split?: Published;
}

export interface CrossSection {
  /** The split dimension's name, so a reader never has to guess. */
  readonly by: string;
  readonly rows: Record<string, CrossRow>;
}

export interface HeartbeatSection {
  readonly installs: number;
  readonly dimensions: Record<string, Published | null>;
}

export interface DuelSection {
  readonly duels: number;
  /** Distinct installs that finished at least one duel. */
  readonly installs: number;
  readonly dimensions: Record<string, Published | null>;
  readonly crosses: Record<string, CrossSection | null>;
}

export interface CardSection {
  readonly rows: number;
  readonly dimensions: Record<string, Published | null>;
  readonly crosses: Record<string, CrossSection | null>;
}

export interface DayJson {
  readonly schema: number;
  readonly day: string;
  readonly k: number;
  readonly build: string;
  readonly heartbeat: HeartbeatSection | null;
  readonly duel: DuelSection | null;
  readonly cards: CardSection | null;
}

export interface SectionSummary {
  readonly section: string;
  /** False when the day gate closed the whole section. */
  readonly present: boolean;
  readonly published: number;
  readonly folded: number;
  /** Dimensions and crosses that came out null. */
  readonly suppressed: number;
}

export interface DayResult {
  readonly json: DayJson;
  readonly summary: readonly SectionSummary[];
}

export interface BuildDayInput {
  readonly day: string;
  readonly build: string;
  /** Grouped rows by query id, exactly as `buildQueries` names them. */
  readonly rows: Readonly<Record<string, readonly RawRow[]>>;
}

function rowsFor(input: BuildDayInput, id: string): readonly RawRow[] {
  const rows = input.rows[id];
  return Array.isArray(rows) ? rows : [];
}

function firstRow(input: BuildDayInput, id: string): RawRow {
  return rowsFor(input, id)[0] ?? {};
}

interface Tally {
  published: number;
  folded: number;
  suppressed: number;
}

function foldDimensions(
  input: BuildDayInput,
  section: string,
  dimensions: readonly Dimension[],
  shape: SectionShape,
  tally: Tally,
): Record<string, Published | null> {
  const out: Record<string, Published | null> = {};
  for (const dimension of dimensions) {
    const entries = toEntries(rowsFor(input, `${section}.dim.${dimension.name}`), dimension.label, shape);
    const outcome = foldEntries(entries, shape.gateKind);
    out[dimension.name] = outcome.published;
    tally.published += outcome.publishedCount;
    tally.folded += outcome.foldedCount;
    if (outcome.published === null) tally.suppressed++;
  }
  return out;
}

/**
 * A cross: the first dimension's own marginal decides which rows exist, and each
 * SURVIVING row's split is folded again inside it.
 *
 * The `other` row carries a total and no split. It is a bag of rows that were
 * each too small to stand alone, and splitting a bag of suppressed rows by
 * result would reopen exactly the question the fold just closed.
 *
 * A row's split is complete (the query groups every split value of that row), so
 * the split sums to the row and there is no residual to subtract. The row total
 * comes from the marginal query rather than from the split, so under sampling
 * the two can differ by a little; both numbers are above the floor either way.
 */
function foldCrosses(
  input: BuildDayInput,
  section: string,
  crosses: readonly Cross[],
  dimensions: readonly Dimension[],
  shape: SectionShape,
  tally: Tally,
): Record<string, CrossSection | null> {
  const out: Record<string, CrossSection | null> = {};
  for (const cross of crosses) {
    const first = dimensions.find((dimension) => dimension.name === cross.first);
    if (!first) throw new Error(`signals-rollup: cross ${cross.first} has no dimension of that name`);

    const marginal = foldEntries(
      toEntries(rowsFor(input, `${section}.dim.${cross.first}`), first.label, shape),
      shape.gateKind,
    );
    if (marginal.published === null) {
      out[cross.first] = null;
      tally.suppressed++;
      continue;
    }

    // Split rows, bucketed by the first dimension's published label.
    const splitRows = new Map<string, RawRow[]>();
    for (const row of rowsFor(input, `${section}.cross.${cross.first}`)) {
      const value = labelOf(row.value, first.label);
      const bucket = splitRows.get(value);
      if (bucket) bucket.push(row);
      else splitRows.set(value, [row]);
    }

    const rows: Record<string, CrossRow> = {};
    for (const [value, total] of Object.entries(marginal.published)) {
      if (value === OTHER) {
        rows[value] = { total };
        continue;
      }
      const entries = toEntries(splitRows.get(value) ?? [], cross.byLabel, shape, { value: 'split' });
      const outcome = foldEntries(entries, shape.gateKind);
      tally.published += outcome.publishedCount;
      tally.folded += outcome.foldedCount;
      if (outcome.published === null) {
        tally.suppressed++;
        rows[value] = { total };
      } else {
        rows[value] = { total, split: outcome.published };
      }
    }
    out[cross.first] = { by: cross.by, rows };
  }
  return out;
}

/**
 * The day's object, and a summary that is safe to print.
 *
 * DAY GATES, applied before any dimension is built: a day with fewer than
 * ROLLUP_K heartbeat installs has no `heartbeat` section at all, a day with
 * fewer than ROLLUP_K dueling installs has no `duel` section, and a day with
 * fewer than ROLLUP_K card rows has no `cards` section. A day where all three
 * close still produces a file, with all three null, so the run stays idempotent
 * and the gap in the series is explained rather than merely missing.
 */
export function buildDay(input: BuildDayInput): DayResult {
  assertDay(input.day, 'the day to build');
  const summary: SectionSummary[] = [];

  // ---- heartbeat ----------------------------------------------------------
  const heartbeatInstalls = parseCount(firstRow(input, 'heartbeat.total').n);
  let heartbeat: HeartbeatSection | null = null;
  if (heartbeatInstalls >= ROLLUP_K) {
    const tally: Tally = { published: 0, folded: 0, suppressed: 0 };
    const dimensions = foldDimensions(input, 'heartbeat', HEARTBEAT_DIMENSIONS, HEARTBEAT_SHAPE, tally);
    heartbeat = { installs: heartbeatInstalls, dimensions };
    summary.push({ section: 'heartbeat', present: true, ...tally });
  } else {
    summary.push({ section: 'heartbeat', present: false, published: 0, folded: 0, suppressed: 0 });
  }

  // ---- duel ---------------------------------------------------------------
  const duelTotal = firstRow(input, 'duel.total');
  const duels = parseCount(duelTotal.n);
  const duelInstalls = parseCount(duelTotal.gate);
  let duel: DuelSection | null = null;
  if (duelInstalls >= ROLLUP_K && duels >= ROLLUP_K) {
    const tally: Tally = { published: 0, folded: 0, suppressed: 0 };
    const dimensions = foldDimensions(input, 'duel', DUEL_DIMENSIONS, DUEL_SHAPE, tally);
    const crosses = foldCrosses(input, 'duel', DUEL_CROSSES, DUEL_DIMENSIONS, DUEL_SHAPE, tally);
    duel = { duels, installs: duelInstalls, dimensions, crosses };
    summary.push({ section: 'duel', present: true, ...tally });
  } else {
    summary.push({ section: 'duel', present: false, published: 0, folded: 0, suppressed: 0 });
  }

  // ---- cards --------------------------------------------------------------
  const cardRows = parseCount(firstRow(input, 'cards.total').n);
  let cards: CardSection | null = null;
  if (cardRows >= ROLLUP_K) {
    const tally: Tally = { published: 0, folded: 0, suppressed: 0 };
    const dimensions = foldDimensions(input, 'cards', CARD_DIMENSIONS, CARD_SHAPE, tally);
    const crosses = foldCrosses(input, 'cards', CARD_CROSSES, CARD_DIMENSIONS, CARD_SHAPE, tally);
    cards = { rows: cardRows, dimensions, crosses };
    summary.push({ section: 'cards', present: true, ...tally });
  } else {
    summary.push({ section: 'cards', present: false, published: 0, folded: 0, suppressed: 0 });
  }

  const json: DayJson = {
    schema: SCHEMA_VERSION,
    day: input.day,
    k: ROLLUP_K,
    build: input.build,
    heartbeat,
    duel,
    cards,
  };
  return { json, summary };
}

// ---------------------------------------------------------------------------
// The invariant
// ---------------------------------------------------------------------------

/**
 * Walk the whole object and prove that every number under `heartbeat`, `duel` or
 * `cards` is a whole number at or above ROLLUP_K. The run calls this before
 * every write and refuses to write if it throws; the tests call it on every
 * fixture's output. It is the last line between a bug in the fold and a number
 * published in a public repo, where it cannot be taken back.
 *
 * The message names the path but NEVER the offending value's own key or number:
 * this error can reach a public Actions log, and a sub-floor value's NAME is
 * exactly as identifying as its count.
 */
export function assertNoSubFloorNumber(dayJson: unknown): void {
  const day = dayJson as Partial<DayJson> | null;
  if (!day || typeof day !== 'object') throw new Error('signals-rollup: the day object is missing');
  for (const section of ['heartbeat', 'duel', 'cards'] as const) {
    walk((day as Record<string, unknown>)[section], section);
  }
}

function walk(node: unknown, path: string): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'number') {
    if (!Number.isInteger(node) || node < ROLLUP_K) {
      // The last path segment is a data value, so it is redacted rather than printed.
      const parent = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : path;
      throw new Error(
        `signals-rollup: a number below the floor of ${ROLLUP_K} was found under ${parent} (value redacted); nothing was written`,
      );
    }
    return;
  }
  if (typeof node === 'string' || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${path}.${index}`));
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) walk(value, `${path}.${key}`);
    return;
  }
  throw new Error(`signals-rollup: unexpected value under ${path}`);
}

// ---------------------------------------------------------------------------
// Serialisation and the day window
// ---------------------------------------------------------------------------

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * The exact bytes of a day file: keys sorted at every level, two-space indent,
 * one trailing newline. Deterministic, so re-running a day that already exists
 * would produce the identical file. (A run never does re-run one. That is rule
 * 3: republishing a day with different numbers is a differencing attack on the
 * difference.)
 */
export function serializeDay(day: DayJson): string {
  return `${JSON.stringify(sortKeys(day), null, 2)}\n`;
}

/** The index file: the sorted list of days present, and nothing else. */
export function serializeIndex(days: readonly string[]): string {
  const sorted = [...new Set(days)].sort();
  return `${JSON.stringify({ days: sorted, k: ROLLUP_K, schema: SCHEMA_VERSION }, null, 2)}\n`;
}

/**
 * Which days a run should roll up: every complete UTC day from
 * max(startDate, today - BACKFILL_DAYS) to yesterday that has no file yet.
 *
 * The clock is injected. Nothing in this module reads one, so a test can stand
 * on any day it likes and the result is a function of its arguments.
 */
export function daysToRoll(options: {
  startDate: string;
  nowMs: number;
  existing: ReadonlySet<string>;
}): string[] {
  assertDay(options.startDate, 'startDate');
  const today = utcDayOf(options.nowMs);
  const yesterday = addDays(today, -1);
  const windowStart = addDays(today, -BACKFILL_DAYS);
  const from = options.startDate > windowStart ? options.startDate : windowStart;
  const out: string[] = [];
  for (let day = from; day <= yesterday; day = addDays(day, 1)) {
    if (!options.existing.has(day)) out.push(day);
  }
  return out;
}
