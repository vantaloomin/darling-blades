/**
 * The db-signals wire schema: the field allowlist, the value vocabulary, and
 * the validator for the three events.
 *
 * PURE TypeScript on purpose. No Cloudflare type, no `env`, no I/O, no global
 * beyond the language. Two things depend on that purity:
 *
 *   1. `tests/worker/signalsSchema.test.ts` in the game repo imports this file
 *      AND `src/meta/playSignals.ts`, and asserts that the two agree in both
 *      directions. That test is the whole reason the Worker lives in this repo
 *      (owner ruling D-T0.3). It cannot import `src/index.ts`, which needs the
 *      Workers runtime, so the schema has to be its own module.
 *   2. Nothing here can accidentally read a header or an IP, because nothing
 *      here can read anything.
 *
 * Why the lists are RESTATED rather than imported from `src/meta/playSignals.ts`:
 * that module imports the card catalog, the avatar roster, the precon lists and
 * the save schema. Importing it would pull roughly a megabyte of game data into
 * a Worker bundle to validate three small objects. The copy is held honest by
 * the test, which is stronger than an import would be anyway: an import proves
 * the Worker uses the same list, the test proves the Worker's list IS the same
 * list even though the two are built independently.
 *
 * Schema source of truth: docs/plan-telemetry-and-accounts.md Part 1, as
 * amended by the owner rulings of 2026-09-17 (three events, `warchest` not
 * `constructed`, `concede`, `lossesBucket`, `duelsBucket`).
 */

// ---------------------------------------------------------------------------
// The wire format
// ---------------------------------------------------------------------------

/**
 * THE REQUEST BODY IS THE BUILDER'S OUTPUT, VERBATIM. Nothing wraps it.
 *
 *   POST /v1/signals?e=heartbeat   body = buildHeartbeat(save, env)
 *   POST /v1/signals?e=duel        body = buildDuelDigest(result, deck, save)
 *   POST /v1/signals?e=cards       body = buildSessionCards(tally, duelsPlayed)
 *
 * The event kind travels in the `e` QUERY PARAMETER rather than in the body,
 * and that is a deliberate privacy property rather than a convenience. The
 * client's contract is that what leaves the device is byte-identical to what
 * the pure, tested builders in `src/meta/playSignals.ts` produced: no
 * discriminator, no version, no timestamp, no session id, no sequence number
 * added in transit. Nothing can hide in a payload that is not allowed to gain a
 * field. The pathname stays exactly `/v1/signals` (T0 finding 6), so the query
 * parameter costs the route nothing.
 *
 * The consequence for this file is the good one: the accepted key set of a
 * heartbeat or duel body is LITERALLY `SIGNAL_FIELDS.heartbeat` / `.duel`, with
 * no exceptions to state, and a `cards` body is literally a JSON array of rows.
 *
 * A version knob survives as an OPTIONAL `v` query parameter. Absent means 1.
 * An explicit value other than 1 is refused, so a future schema break can be
 * made without the current Worker silently accepting the new shape. Nothing
 * enters the body to carry it.
 */
export const WIRE_VERSION = 1;

/** The query parameters this endpoint reads. Nothing else in the URL is looked at. */
export const EVENT_PARAM = 'e';
export const VERSION_PARAM = 'v';

export const EVENT_TYPES = ['heartbeat', 'duel', 'cards'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** The `?e=` value as an event kind, or null. */
export function eventTypeOf(raw: string | null): EventType | null {
  return raw !== null && (EVENT_TYPES as readonly string[]).includes(raw) ? (raw as EventType) : null;
}

/** True when the optional `?v=` is absent or names the version this Worker speaks. */
export function versionIsAccepted(raw: string | null): boolean {
  return raw === null || raw === String(WIRE_VERSION);
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/**
 * Body cap. Measured 2026-09-17 against the real catalog, posting real builder
 * output at a Worker running under `wrangler dev --local`:
 *
 *   heartbeat  338 to 352 bytes
 *   duel       204 to 209 bytes (card rows have moved off this event)
 *   cards      834 to 1,018 bytes for a realistic 12 to 24 row session batch,
 *              and 4,956 bytes for the worst case: a full 60 rows carrying the
 *              60 LONGEST card ids in the catalog (the longest is 39 characters,
 *              `sd-bakhet-gate-warden-of-the-lower-city`)
 *
 * So the spike's 4 KB cap would have rejected a legitimate full batch with a
 * 413, silently, and only for players with large collections. 8 KB clears the
 * measured worst case with about 40% to spare and is still far too small to be
 * worth abusing; the rate limit, not the body cap, is the spam brake.
 */
export const MAX_BODY_BYTES = 8192;

/**
 * Rows in one `cards` batch. 60, and the number is a data-point budget choice,
 * not a round number.
 *
 * Analytics Engine's free tier caps DATA POINTS at 100,000/day and every card
 * row is its own data point (finding 3 in docs/telemetry-t0-finding.md, which
 * measured card rows at 95% of the budget). With the per-session tally that
 * ruling D-T0.1 introduced, a five-duel session costs 1 heartbeat + 5 duel rows
 * + N card rows:
 *
 *   - at the expected N (~20 distinct cards for a five-duel session, the number
 *     D-T0.1 projected): 26 points, about 3,800 player-days/day of headroom;
 *   - at this cap: 66 points, about 1,515 player-days/day, still above the
 *     ~1,100 the spike measured for the design this replaced.
 *
 * Why not lower: a 40-card Warchest list holds roughly 26 to 30 nonland cards,
 * so a session that switches decks legitimately passes 40. Why not higher: the
 * worst case is what has to fit the budget, and 60 is where truncation becomes
 * rare enough to stop mattering.
 *
 * An over-cap batch is REJECTED, never truncated. `buildSessionCards` sorts by
 * card id, so truncating at the edge would silently bias the card-play
 * distribution toward the start of the alphabet. A 400 is visible; a quiet
 * alphabetical bias in a balance signal is not.
 */
export const MAX_CARD_ROWS = 60;

// ---------------------------------------------------------------------------
// The field allowlist. Held equal to SIGNAL_FIELDS in src/meta/playSignals.ts
// by tests/worker/signalsSchema.test.ts. Order matters: it is the order the
// builders emit and the order the blob columns follow.
// ---------------------------------------------------------------------------

export const SIGNAL_FIELDS = {
  heartbeat: [
    'appVersion',
    'buildSha',
    'platform',
    'formFactor',
    'lang',
    'settings',
    'streakBucket',
    'achievementsBucket',
    'winsBucket',
    'lossesBucket',
    'packsBucket',
    'collectionBucket',
    'tutorialDone',
    'gauntletBestRung',
  ],
  duel: [
    'format',
    'deckColours',
    'deckArchetype',
    'curveBucket',
    'deckSource',
    'opponentId',
    'difficulty',
    'turnsBucket',
    'result',
    'mulligans',
  ],
  cards: ['cardId', 'countBucket', 'duelsBucket'],
} as const;

/** The nested `heartbeat.settings` allowlist. */
export const SIGNAL_SETTINGS_FIELDS = ['animations', 'reducedMotion', 'renderScale'] as const;

/** The one field whose value is a nested object rather than a scalar. */
const NESTED_OBJECT_FIELD = 'settings';

// ---------------------------------------------------------------------------
// The value vocabulary. Held equal to SIGNAL_VOCAB in playSignals.ts.
// ---------------------------------------------------------------------------

export type VocabSpec =
  | { readonly kind: 'enum'; readonly values: readonly string[] }
  | { readonly kind: 'int'; readonly min: number; readonly max: number }
  | { readonly kind: 'bool' }
  | { readonly kind: 'string'; readonly pattern: string; readonly maxLength: number };

const COUNT_BUCKETS = ['0', '1-4', '5-9', '10-24', '25-49', '50-99', '100-249', '250+'] as const;
const CARD_COUNT_BUCKETS = ['1', '2-3', '4-7', '8+'] as const;

/**
 * Ids are checked by SHAPE, not against a list, and the reason is the same one
 * `playSignals.ts` records: the lists are large (1,515 card ids, 46 opponents,
 * 19 precons) and change with every set, an edge allowlist would go stale and
 * silently drop real play, and the k = 10 floor at rollup already collapses a
 * rare value to `other`. Measured 2026-09-17: every id in the catalog matches
 * `^[a-z][a-z0-9-]*$`, longest 39 characters.
 */
const ID_PATTERN = '^[a-z][a-z0-9-]{0,47}$';
const ID_MAX_LENGTH = 48;

/** Charset and length `safeBuildStamp` narrows a build stamp to. Empty is reachable and accepted. */
const BUILD_STAMP_MAX_LENGTH = 40;
const BUILD_STAMP_PATTERN = `^[A-Za-z0-9._-]{0,${BUILD_STAMP_MAX_LENGTH}}$`;

/**
 * Colour identity: `C`, or a non-empty subset of WUBRG in that fixed order.
 * Generated rather than typed out, exactly as the client generates it.
 */
const DECK_COLOUR_VALUES: readonly string[] = (() => {
  const order = ['W', 'U', 'B', 'R', 'G'] as const;
  const out: string[] = ['C'];
  for (let mask = 1; mask < 1 << order.length; mask++) {
    out.push(order.filter((_, bit) => (mask & (1 << bit)) !== 0).join(''));
  }
  return out;
})();

/** Tenths, as `tenthsBucket` emits them: `0.0` through `0.9`, then `1.0`. */
const TENTHS_BUCKETS: readonly string[] = Array.from({ length: 11 }, (_, i) =>
  i === 10 ? '1.0' : `0.${i}`,
);

/**
 * Highest gauntlet rung that exists (`GAUNTLET_RUNG_CAP`, the top avatar tier)
 * and the London-mulligan ceiling (`MULLIGAN_CAP`). Both are asserted equal to
 * the client's by the schema test, so a new top-tier avatar fails the suite
 * here rather than silently dropping that rung's heartbeats at the edge.
 */
const GAUNTLET_RUNG_CAP = 26;
const MULLIGAN_CAP = 3;

export const SIGNAL_VOCAB = {
  // heartbeat
  appVersion: { kind: 'string', pattern: BUILD_STAMP_PATTERN, maxLength: BUILD_STAMP_MAX_LENGTH },
  buildSha: { kind: 'string', pattern: BUILD_STAMP_PATTERN, maxLength: BUILD_STAMP_MAX_LENGTH },
  platform: { kind: 'enum', values: ['web', 'desktop'] },
  formFactor: { kind: 'enum', values: ['mobile', 'tablet', 'desktop'] },
  lang: { kind: 'string', pattern: '^[a-z]{2}$', maxLength: 2 },
  streakBucket: { kind: 'enum', values: ['0', '1', '2', '3', '4-6', '7-13', '14-29', '30+'] },
  achievementsBucket: { kind: 'enum', values: TENTHS_BUCKETS },
  winsBucket: { kind: 'enum', values: COUNT_BUCKETS },
  lossesBucket: { kind: 'enum', values: COUNT_BUCKETS },
  packsBucket: { kind: 'enum', values: COUNT_BUCKETS },
  collectionBucket: {
    kind: 'enum',
    values: ['0', '1-24', '25-99', '100-249', '250-499', '500-999', '1000+'],
  },
  tutorialDone: { kind: 'bool' },
  gauntletBestRung: { kind: 'int', min: 0, max: GAUNTLET_RUNG_CAP },
  // heartbeat.settings
  animations: { kind: 'enum', values: ['full', 'reduced', 'off'] },
  reducedMotion: { kind: 'bool' },
  renderScale: { kind: 'enum', values: ['720p', '1080p', '1440p', 'other'] },
  // duel
  format: { kind: 'enum', values: ['warchest', 'darlings', 'limited', 'gauntlet'] },
  deckColours: { kind: 'enum', values: DECK_COLOUR_VALUES },
  deckArchetype: { kind: 'string', pattern: ID_PATTERN, maxLength: ID_MAX_LENGTH },
  curveBucket: { kind: 'enum', values: ['<2.0', '2.0-2.4', '2.5-2.9', '3.0-3.4', '3.5-3.9', '4.0+'] },
  deckSource: { kind: 'enum', values: ['precon', 'custom', 'drafted'] },
  opponentId: { kind: 'string', pattern: ID_PATTERN, maxLength: ID_MAX_LENGTH },
  difficulty: { kind: 'enum', values: ['easy', 'medium', 'hard'] },
  turnsBucket: { kind: 'enum', values: ['1-5', '6-10', '11-15', '16-20', '21-30', '31+'] },
  result: { kind: 'enum', values: ['win', 'loss', 'draw', 'concede'] },
  mulligans: { kind: 'int', min: 0, max: MULLIGAN_CAP },
  // cards
  cardId: { kind: 'string', pattern: ID_PATTERN, maxLength: ID_MAX_LENGTH },
  countBucket: { kind: 'enum', values: CARD_COUNT_BUCKETS },
  duelsBucket: { kind: 'enum', values: CARD_COUNT_BUCKETS },
} as const satisfies Readonly<Record<string, VocabSpec>>;

/**
 * Key names that must never appear in a body, at any depth, whatever else is
 * true of it. The exact-key-set check below already rejects every one of them,
 * so this is belt and braces: it makes the spec's prohibition list executable
 * code rather than a comment, and it rejects BEFORE the shape check so a body
 * carrying one is refused even if a future edit loosens the shape.
 *
 * Source: docs/plan-telemetry-and-accounts.md, "The prohibition list is part of
 * the schema, not a guideline."
 */
export const PROHIBITED_KEYS: readonly string[] = [
  'accountId',
  'country',
  'deckName',
  'deviceId',
  'email',
  'geo',
  'ip',
  'jwt',
  'replay',
  'saveCode',
  'screen',
  'timestamp',
  'userAgent',
];
const PROHIBITED = new Set(PROHIBITED_KEYS);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type Json = Record<string, unknown>;

/** A body that passed. `rows` always holds the data points to write, one per row. */
export type ValidSignal =
  | { readonly type: 'heartbeat'; readonly payload: Json }
  | { readonly type: 'duel'; readonly payload: Json }
  | { readonly type: 'cards'; readonly rows: readonly Json[] };

/**
 * Why a body was refused. The Worker never returns this to the caller (a 400
 * carries no detail, so the endpoint is not a schema oracle for a spammer); it
 * exists so the tests can assert WHICH rule fired rather than only that
 * something did.
 */
export type RejectReason =
  | 'prohibited-key'
  | 'bad-payload'
  | 'empty-batch'
  | 'batch-too-large'
  | 'batch-duels-disagree';

export type ValidationResult =
  | { readonly ok: true; readonly signal: ValidSignal }
  | { readonly ok: false; readonly reason: RejectReason };

export function isPlainObject(value: unknown): value is Json {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function matches(value: unknown, spec: VocabSpec): boolean {
  switch (spec.kind) {
    case 'enum':
      return typeof value === 'string' && spec.values.includes(value);
    case 'int':
      return typeof value === 'number' && Number.isInteger(value) && value >= spec.min && value <= spec.max;
    case 'bool':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string' && value.length <= spec.maxLength && new RegExp(spec.pattern).test(value);
  }
}

/** True if any key anywhere in the value is on the prohibition list. */
function hasProhibitedKey(value: unknown, depth = 0): boolean {
  // The bodies we accept are two levels deep at most; a deeper one is junk and
  // the bound also stops a hand-crafted body from costing CPU to walk.
  if (depth > 6) return true;
  if (Array.isArray(value)) return value.some((entry) => hasProhibitedKey(entry, depth + 1));
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (PROHIBITED.has(key)) return true;
      if (hasProhibitedKey(child, depth + 1)) return true;
    }
  }
  return false;
}

/**
 * Exact shape: every allowlisted field present and valid, and no other key.
 * "Exact" both ways is the point. A missing field is as much a rejection as an
 * extra one, because a partial payload means the client and the edge disagree
 * about the schema and guessing which one is right is how a silent drift ships.
 */
function checkPayload(payload: unknown, fields: readonly string[]): boolean {
  if (!isPlainObject(payload)) return false;
  const keys = Object.keys(payload);
  if (keys.length !== fields.length) return false;
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) return false;
    const value = payload[field];
    if (field === NESTED_OBJECT_FIELD) {
      if (!checkPayload(value, SIGNAL_SETTINGS_FIELDS)) return false;
      continue;
    }
    const spec: VocabSpec | undefined = (SIGNAL_VOCAB as Readonly<Record<string, VocabSpec>>)[field];
    if (!spec || !matches(value, spec)) return false;
  }
  return true;
}

/**
 * Validate one parsed request body against the event kind the URL named.
 *
 * Nothing about the REQUEST reaches this function: no headers, no IP, no
 * connection facts, by construction, since the arguments are an event kind the
 * caller already narrowed and the parsed JSON.
 */
export function validate(type: EventType, body: unknown): ValidationResult {
  if (hasProhibitedKey(body)) return { ok: false, reason: 'prohibited-key' };

  if (type === 'cards') {
    if (!Array.isArray(body)) return { ok: false, reason: 'bad-payload' };
    if (body.length === 0) return { ok: false, reason: 'empty-batch' };
    if (body.length > MAX_CARD_ROWS) return { ok: false, reason: 'batch-too-large' };
    for (const row of body) {
      if (!checkPayload(row, SIGNAL_FIELDS.cards)) return { ok: false, reason: 'bad-payload' };
    }
    // Every row of one batch reports the same launch, so every row must repeat
    // the same duel count. Rows that disagree are either two batches spliced
    // together or a forged body; either way the denominator is meaningless.
    const rows = body as Json[];
    const duels = rows[0].duelsBucket;
    if (rows.some((row) => row.duelsBucket !== duels)) {
      return { ok: false, reason: 'batch-duels-disagree' };
    }
    return { ok: true, signal: { type: 'cards', rows } };
  }

  if (!checkPayload(body, SIGNAL_FIELDS[type])) return { ok: false, reason: 'bad-payload' };
  return { ok: true, signal: { type, payload: body as Json } };
}
