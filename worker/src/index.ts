/**
 * db-signals: the anonymous play-signals endpoint for Darling Blades.
 *
 * Spec: docs/plan-telemetry-and-accounts.md (identity model A, the event schema
 * as amended 2026-09-17, the prohibition list). Rollout:
 * docs/rollout-telemetry-and-accounts.md wave T2. Spike finding:
 * docs/telemetry-t0-finding.md.
 *
 * What this Worker does, and deliberately nothing more:
 *   - accepts POST /v1/signals?e=heartbeat|duel|cards whose body is the output
 *     of the matching builder in src/meta/playSignals.ts VERBATIM, validates it
 *     against src/schema.ts (an exact key set, a closed vocabulary), and writes
 *     it to Workers Analytics Engine. The event kind is in the query rather
 *     than the body because the body is not allowed to gain a field; see the
 *     wire-format note at the top of src/schema.ts;
 *   - computes a daily-rotating de-duplication hash from the connecting IP and a
 *     coarse browser family, keyed by a random value drawn fresh each UTC day
 *     and deleted when the day ends;
 *   - answers GET /health for the kill-switch check and 404s everything else.
 *
 * WHAT IT NEVER DOES, and these are the lines the privacy policy rests on:
 *   - it never writes, logs, forwards or returns the IP address, `cf.country`,
 *     the user agent, or any other request header. `dailyHash` is the ONLY
 *     function that reads a header, the values live in its local scope, and what
 *     leaves it is 8 bytes of HMAC output;
 *   - it never calls `console.log`, and `observability.enabled = false` in
 *     wrangler.toml keeps Cloudflare from retaining invocation logs
 *     (docs/legal/README.md finding 4);
 *   - it never writes a timestamp of its own. Analytics Engine stamps one on
 *     every row itself and it cannot be stripped (finding 3 of the same review);
 *     that one is disclosed in the privacy policy and is the only one.
 *
 * Path note: EasyPrivacy blocks `||workers.dev/api/event` and
 * `||workers.dev/js/script.js` (Plausible's proxy paths), not the domain, so
 * this endpoint stays at /v1/signals and serves no script (T0 finding 6).
 *
 * ===========================================================================
 * ANALYTICS ENGINE COLUMN LAYOUT — dataset `db_signals_v2`
 * ===========================================================================
 * The dataset is versioned and this layout is v2, not the spike's v1: three
 * events instead of two, bucket LABELS instead of small ints, and card rows on
 * their own event. Never edit a column in place; add a v3 dataset instead, or
 * old and new rows silently mix in one table.
 *
 * The index is Analytics Engine's SAMPLING key: points sharing one index value
 * are sampled together once that value's write rate climbs (T0 finding 4). Two
 * consequences are permanent: index choice is a privacy AND an accuracy
 * decision, and EVERY count in a rollup must be `sum(_sample_interval)`, never
 * `count()`.
 *
 * heartbeat — index1 = the daily hash (per install, so sampling spreads)
 *   blob1  'heartbeat'      blob2  BUILD_LABEL     blob3  daily hash
 *   blob4  appVersion       blob5  buildSha        blob6  platform
 *   blob7  formFactor       blob8  lang            blob9  settings.animations
 *   blob10 settings.renderScale              blob11 streakBucket
 *   blob12 achievementsBucket                blob13 winsBucket
 *   blob14 lossesBucket     blob15 packsBucket     blob16 collectionBucket
 *   double1 settings.reducedMotion (0|1)     double2 tutorialDone (0|1)
 *   double3 gauntletBestRung
 *
 * duel — index1 = the daily hash
 *   blob1  'duel'           blob2  BUILD_LABEL     blob3  daily hash
 *   blob4  format           blob5  deckColours     blob6  deckArchetype
 *   blob7  curveBucket      blob8  deckSource      blob9  opponentId
 *   blob10 difficulty       blob11 turnsBucket     blob12 result
 *   double1 mulligans
 *
 * card — index1 = cardId (per card, so no install spreads its own rows)
 *   blob1  'card'           blob2  BUILD_LABEL     blob3  '' (ALWAYS EMPTY)
 *   blob4  cardId           blob5  countBucket     blob6  duelsBucket
 *   (no doubles)
 *
 *   blob3 is the hash column everywhere else and is deliberately left empty
 *   here. Card rows carry NO install hash and are indexed by card, so a duel
 *   row and the cards of the same session cannot be re-joined. That is the
 *   whole reason cards are their own event: "a full decklist is close to a
 *   fingerprint" (plan doc, the k-anonymity caveat). Indexing by card is also
 *   the fair sampling choice — the spike measured 170 card indexes taking no
 *   sampling at all while a single shared index sampled 20 rows down to 2.
 *
 *   Card rows carry no appVersion and no platform, because the `cards` event's
 *   allowlist has three fields and adding one is an owner decision, not ours.
 *   Consequence, stated so nobody rediscovers it at rollup time: card play
 *   cannot be segmented by client version or by web/desktop. If that segment is
 *   wanted, it is a schema proposal, not a Worker change.
 */

import {
  EVENT_PARAM,
  MAX_BODY_BYTES,
  VERSION_PARAM,
  eventTypeOf,
  validate,
  versionIsAccepted,
  type Json,
  type ValidSignal,
} from './schema';

// ---------------------------------------------------------------------------
// Bindings, declared structurally.
//
// These are the shapes the Workers runtime already satisfies, written out here
// instead of referencing `AnalyticsEngineDataset` / `KVNamespace` / `RateLimit`
// from the generated `worker-configuration.d.ts`. The reason is testability:
// the game repo's Vitest suite imports this module directly and its tsconfig
// has no Cloudflare ambient types, and pulling `@cloudflare/workers-types` into
// the game's global scope would redefine `fetch`, `Request`, `Response` and
// `caches` for the whole client. `src/bindings.check.ts` closes the loop: it
// fails the WORKER's own typecheck if the real generated bindings ever stop
// satisfying these interfaces.
// ---------------------------------------------------------------------------

// Mutable arrays, not `readonly`, because that is what the runtime's
// `AnalyticsEngineDataPoint` declares and `src/bindings.check.ts` holds the two
// assignable.
export interface DataPoint {
  indexes: string[];
  blobs: string[];
  doubles: number[];
}

export interface AnalyticsSink {
  writeDataPoint(point: DataPoint): void;
}

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expiration?: number }): Promise<void>;
}

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  SIGNALS: AnalyticsSink;
  SALT_KV: KvLike;
  SIGNALS_RATE_LIMIT: RateLimiter;
  /**
   * A Worker secret, set once by the owner. NEVER read for any purpose except
   * keying the HMAC below, never logged, never returned, and never defaulted:
   * if it is missing the Worker refuses to write (503). An unsalted or constant
   * hash would make every past day recomputable, which is exactly the property
   * ruling D-T0.2 was re-made to prevent.
   */
  SALT_SECRET?: string;
  BUILD_LABEL?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SALT_BYTES = 32;
const SALT_KEY_PREFIX = 'salt:';
/**
 * How long after the UTC day ends the KV key survives. One hour absorbs clock
 * skew and a request that started at 23:59:59, and keeps the promise in privacy
 * policy 3.3 ("created fresh each day, kept only for that day, and then
 * deleted") true to within that hour. The expiry is ABSOLUTE, computed from the
 * day itself, so every isolate that writes the key agrees on when it dies.
 */
const SALT_GRACE_SECONDS = 3600;

const ALLOWED_ORIGINS = new Set([
  // The custom domain (2026-09-24) and the github.io address it replaced,
  // which redirects there but stays allowed for the transition.
  'https://bladedarlings.com',
  'https://vantaloomin.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
]);

/**
 * `application/json` is what a `fetch` sends. `text/plain` is what
 * `navigator.sendBeacon` sends for a string body, and a beacon is the only way
 * to get the session card batch out during unload, so refusing it would drop
 * the whole `cards` event. Both are also CORS-simple, so neither needs a
 * preflight. Anything else is 415.
 */
const ACCEPTED_CONTENT_TYPES = ['application/json', 'text/plain'];

// ---------------------------------------------------------------------------
// The daily de-duplication key (ruling D-T0.2)
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Per-isolate cache, so KV is read at most once per isolate per day. */
let cachedDay = '';
let cachedKey: CryptoKey | null = null;
/** The in-flight derivation, so a cold isolate serving N concurrent requests still reads KV once. */
let cachedPending: Promise<CryptoKey> | null = null;

/** Seconds since the epoch at which this day's salt should disappear. */
function saltExpiry(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000) + 86400 + SALT_GRACE_SECONDS;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * The day's random value, shared by every isolate through one KV key.
 *
 * Race: KV has no compare-and-set, so two isolates can both miss and both
 * write. The write is followed by a re-read and whatever the store settled on
 * wins, which converges them in the ordinary case. It is NOT a guarantee: KV is
 * eventually consistent and caches negative lookups at the edge for up to a
 * minute, so on a day rollover two isolates can briefly hold different values.
 * The consequence is bounded and already documented as the failure mode in T0
 * finding 5 — distinct-install counts for those first minutes are an upper
 * bound. Both values expire together, and neither is recoverable afterwards.
 */
async function dayRandom(env: Env, day: string): Promise<string> {
  const key = `${SALT_KEY_PREFIX}${day}`;
  const existing = await env.SALT_KV.get(key);
  if (existing) return existing;
  const fresh = toBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
  await env.SALT_KV.put(key, fresh, { expiration: saltExpiry(day) });
  const settled = await env.SALT_KV.get(key);
  return settled ?? fresh;
}

async function hmacKey(raw: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
  const bytes: BufferSource = raw instanceof Uint8Array ? (raw.slice() as unknown as BufferSource) : raw;
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

/**
 * The key the day's hashes are computed with:
 *
 *   dayKey = HMAC(key = SALT_SECRET, message = day || dayRandom)
 *
 * HMAC and not concatenation, so the two inputs are combined rather than
 * merely adjacent. The properties this buys, both of which the privacy policy
 * states as promises:
 *   - a KV leak alone yields nothing, because the random value is useless
 *     without the secret;
 *   - the secret alone yields nothing either, because the random value is gone
 *     an hour after its day ends and cannot be recomputed. That is the
 *     difference between this and the first D-T0.2 ruling, and it is what makes
 *     "even we cannot connect one day's summaries to another's" true.
 *
 * Returns null when the secret is absent. There is no fallback by design.
 */
async function dayKey(env: Env, day: string): Promise<CryptoKey | null> {
  const secret = env.SALT_SECRET;
  if (typeof secret !== 'string' || secret.length === 0) return null;

  if (day === cachedDay) {
    if (cachedKey) return cachedKey;
    if (cachedPending) return cachedPending;
  }

  cachedDay = day;
  cachedKey = null;
  const pending = (async () => {
    const random = await dayRandom(env, day);
    const secretKey = await hmacKey(encoder.encode(secret));
    const material = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(`${day}|${random}`));
    const derived = await hmacKey(material);
    cachedKey = derived;
    cachedPending = null;
    return derived;
  })();
  cachedPending = pending;
  try {
    return await pending;
  } catch (error) {
    // A KV failure must not poison the isolate for the rest of the day.
    if (cachedPending === pending) {
      cachedPending = null;
      cachedDay = '';
    }
    throw error;
  }
}

/**
 * Coarse browser family. The verbatim user agent is on the prohibition list;
 * this collapses it to one of six words before it is ever mixed in, so even the
 * hash input carries no version, no OS build and no device string.
 */
function coarseFamily(ua: string): string {
  const u = ua.toLowerCase();
  if (u.includes('tauri')) return 'tauri';
  if (u.includes('edg/')) return 'edge';
  if (u.includes('firefox/')) return 'firefox';
  if (u.includes('chrome/') || u.includes('crios/')) return 'chrome';
  if (u.includes('safari/')) return 'safari';
  return 'other';
}

/**
 * The de-duplication hash. THE ONLY PLACE IN THIS WORKER THAT READS A HEADER.
 *
 * The IP and the user agent exist as local constants for the length of this
 * function and are never assigned anywhere else, never returned, never written
 * and never logged. What leaves is 16 hex characters of HMAC output over a
 * key that is destroyed with the day.
 */
async function dailyHash(req: Request, env: Env, day: string): Promise<string | null> {
  const key = await dayKey(env, day);
  if (!key) return null;
  const ip = req.headers.get('cf-connecting-ip') ?? '';
  const family = coarseFamily(req.headers.get('user-agent') ?? '');
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${day}|${ip}|${family}`));
  return Array.from(new Uint8Array(signature).subarray(0, 8), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

/** Exposed for the tests, which have to prove a cold isolate really is cold. */
export function resetSaltCacheForTests(): void {
  cachedDay = '';
  cachedKey = null;
  cachedPending = null;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

function cors(req: Request, headers: Headers): Headers {
  const origin = req.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
    headers.set('access-control-allow-headers', 'content-type');
    headers.set('access-control-max-age', '86400');
    headers.set('vary', 'origin');
  }
  return headers;
}

/**
 * Every response body is empty except /health. A 400 in particular carries no
 * detail: the reason codes in schema.ts exist for the tests, not for the wire,
 * so the endpoint cannot be used as a schema oracle to probe what it will take.
 */
function respond(
  req: Request,
  status: number,
  body: string | null = null,
  extra: Record<string, string> = {},
): Response {
  const headers = cors(req, new Headers({ 'cache-control': 'no-store', ...extra }));
  return new Response(body, { status, headers });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number => (typeof value === 'number' ? value : 0);
const flag = (value: unknown): number => (value === true ? 1 : 0);

function writeSignal(env: Env, signal: ValidSignal, hash: string): void {
  const build = env.BUILD_LABEL ?? 'unknown';

  if (signal.type === 'heartbeat') {
    const p = signal.payload;
    const settings = p.settings as Json;
    env.SIGNALS.writeDataPoint({
      indexes: [hash],
      blobs: [
        'heartbeat',
        build,
        hash,
        str(p.appVersion),
        str(p.buildSha),
        str(p.platform),
        str(p.formFactor),
        str(p.lang),
        str(settings.animations),
        str(settings.renderScale),
        str(p.streakBucket),
        str(p.achievementsBucket),
        str(p.winsBucket),
        str(p.lossesBucket),
        str(p.packsBucket),
        str(p.collectionBucket),
      ],
      doubles: [flag(settings.reducedMotion), flag(p.tutorialDone), num(p.gauntletBestRung)],
    });
    return;
  }

  if (signal.type === 'duel') {
    const p = signal.payload;
    env.SIGNALS.writeDataPoint({
      indexes: [hash],
      blobs: [
        'duel',
        build,
        hash,
        str(p.format),
        str(p.deckColours),
        str(p.deckArchetype),
        str(p.curveBucket),
        str(p.deckSource),
        str(p.opponentId),
        str(p.difficulty),
        str(p.turnsBucket),
        str(p.result),
      ],
      doubles: [num(p.mulligans)],
    });
    return;
  }

  // cards: one data point per row, and the hash reaches none of them.
  for (const row of signal.rows) {
    env.SIGNALS.writeDataPoint({
      indexes: [str(row.cardId)],
      blobs: ['card', build, '', str(row.cardId), str(row.countBucket), str(row.duelsBucket)],
      doubles: [],
    });
  }
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

/** UTC day, `YYYY-MM-DD`. The only time value this Worker computes, and it never leaves. */
function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readBody(req: Request): Promise<{ body: unknown } | { status: number }> {
  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!ACCEPTED_CONTENT_TYPES.includes(type)) return { status: 415 };

  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { status: 413 };

  const text = await req.text();
  if (encoder.encode(text).length > MAX_BODY_BYTES) return { status: 413 };

  try {
    return { body: JSON.parse(text) as unknown };
  } catch {
    return { status: 400 };
  }
}

async function handleSignals(req: Request, url: URL, env: Env): Promise<Response> {
  // An Origin from a site that is not ours is refused outright. A request with
  // NO Origin is allowed: browsers always send one cross-origin, so a missing
  // one means a non-browser caller, against which an Origin check is no defence
  // anyway (it is a header the caller chooses). The rate limit and the
  // validator are what actually hold the endpoint.
  const origin = req.headers.get('origin');
  if (origin !== null && !ALLOWED_ORIGINS.has(origin)) return respond(req, 403);

  // The event kind and the optional version are the only things read from the
  // URL, and they are read before the body so a junk request is refused without
  // being parsed. They live here rather than in the payload because the payload
  // is the builder's output verbatim and is not allowed to gain a field.
  const type = eventTypeOf(url.searchParams.get(EVENT_PARAM));
  if (type === null) return respond(req, 400);
  if (!versionIsAccepted(url.searchParams.get(VERSION_PARAM))) return respond(req, 400);

  const read = await readBody(req);
  if ('status' in read) return respond(req, read.status);

  const day = utcDay();

  // The hash comes BEFORE validation so that a flood of junk is rate limited
  // too. Without the salt there is no hash, and without a hash nothing is
  // written: no unsalted fallback, no constant, no writing the row anyway.
  const hash = await dailyHash(req, env, day);
  if (hash === null) return respond(req, 503);

  const allowed = await env.SIGNALS_RATE_LIMIT.limit({ key: hash });
  if (!allowed.success) return respond(req, 429);

  const result = validate(type, read.body);
  if (!result.ok) return respond(req, 400);

  writeSignal(env, result.signal, hash);
  return respond(req, 204);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return respond(req, 204);

    if (url.pathname === '/health' && req.method === 'GET') {
      // The kill-switch check. It reports the build label and nothing else: not
      // the day, not the salt state, not whether the secret is set.
      return respond(req, 200, JSON.stringify({ ok: true, build: env.BUILD_LABEL ?? 'unknown' }), {
        'content-type': 'application/json',
      });
    }

    if (url.pathname === '/v1/signals') {
      if (req.method !== 'POST') return respond(req, 405, null, { allow: 'POST, OPTIONS' });
      return handleSignals(req, url, env);
    }

    return respond(req, 404);
  },
};
