/**
 * db-signals: the anonymous play-signals endpoint for Darling Blades.
 *
 * Spec: docs/plan-telemetry-and-accounts.md (identity model A, the event
 * schema, the prohibition list). Rollout: docs/rollout-telemetry-and-accounts.md.
 *
 * What this Worker does, and deliberately nothing more:
 *   - accepts POST /v1/signals with a small JSON body, validates it against a
 *     strict allowlist (unknown keys reject; every number is a small bucket),
 *     and writes it to Workers Analytics Engine;
 *   - computes an in-memory, daily-rotating de-duplication hash from the
 *     connecting IP and a coarse browser family. The salt is never persisted,
 *     the IP is read, hashed, and discarded within the request, and neither the
 *     IP nor `cf.country` is ever written;
 *   - answers GET /health for the kill-switch check and 404s everything else.
 *
 * Path note: EasyPrivacy blocks `||workers.dev/api/event` and
 * `||workers.dev/js/script.js` (Plausible's proxy paths), not the domain, so
 * this endpoint lives at /v1/signals and serves no script.
 *
 * Rate limiting is a Cloudflare dashboard rule on the route, not code here.
 */

export interface Env {
  SIGNALS: AnalyticsEngineDataset;
  BUILD_LABEL: string;
}

const MAX_BODY_BYTES = 4096;
const MAX_CARDS_PLAYED = 60;

const ALLOWED_ORIGINS = new Set([
  'https://vantaloomin.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
]);

type Json = Record<string, unknown>;

// ---------- validation -------------------------------------------------------

const PLATFORMS = ['web', 'desktop'] as const;
const FORM_FACTORS = ['mobile', 'tablet', 'desktop'] as const;
const ANIMATIONS = ['full', 'reduced', 'off'] as const;
const STREAK_BUCKETS = ['0', '1', '2', '3', '4-6', '7-13', '14-29', '30+'] as const;
const FORMATS = ['constructed', 'darlings', 'limited', 'gauntlet'] as const;
const DECK_SOURCES = ['precon', 'custom', 'drafted'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const RESULTS = ['win', 'loss', 'draw'] as const;

type Rule =
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'int'; min: number; max: number }
  | { kind: 'bool' }
  | { kind: 'str'; re: RegExp }
  | { kind: 'obj'; fields: Record<string, Rule> }
  | { kind: 'cards' };

const HEARTBEAT: Record<string, Rule> = {
  type: { kind: 'enum', values: ['heartbeat'] },
  v: { kind: 'int', min: 1, max: 1 },
  appVersion: { kind: 'str', re: /^\d{1,2}\.\d{1,2}\.\d{1,2}$/ },
  buildSha: { kind: 'str', re: /^[0-9a-f]{7,12}$/ },
  platform: { kind: 'enum', values: PLATFORMS },
  formFactor: { kind: 'enum', values: FORM_FACTORS },
  lang: { kind: 'str', re: /^[a-z]{2}$/ },
  settings: {
    kind: 'obj',
    fields: {
      animations: { kind: 'enum', values: ANIMATIONS },
      reducedMotion: { kind: 'bool' },
      renderScale: { kind: 'int', min: 1, max: 3 },
    },
  },
  streakBucket: { kind: 'enum', values: STREAK_BUCKETS },
  achievementsBucket: { kind: 'int', min: 0, max: 10 },
  winsBucket: { kind: 'int', min: 0, max: 10 },
  packsBucket: { kind: 'int', min: 0, max: 10 },
  collectionBucket: { kind: 'int', min: 0, max: 10 },
  tutorialDone: { kind: 'bool' },
  gauntletBestRung: { kind: 'int', min: 0, max: 40 },
};

const DUEL: Record<string, Rule> = {
  type: { kind: 'enum', values: ['duel'] },
  v: { kind: 'int', min: 1, max: 1 },
  appVersion: { kind: 'str', re: /^\d{1,2}\.\d{1,2}\.\d{1,2}$/ },
  buildSha: { kind: 'str', re: /^[0-9a-f]{7,12}$/ },
  platform: { kind: 'enum', values: PLATFORMS },
  format: { kind: 'enum', values: FORMATS },
  deckColours: { kind: 'str', re: /^[WUBRG]{0,5}$/ },
  deckArchetype: { kind: 'str', re: /^[a-z][a-z0-9-]{0,23}$/ },
  curveBucket: { kind: 'int', min: 0, max: 5 },
  deckSource: { kind: 'enum', values: DECK_SOURCES },
  opponentId: { kind: 'str', re: /^[a-z][a-z0-9-]{0,39}$/ },
  difficulty: { kind: 'enum', values: DIFFICULTIES },
  turns: { kind: 'int', min: 0, max: 60 },
  result: { kind: 'enum', values: RESULTS },
  mulligans: { kind: 'int', min: 0, max: 4 },
  cardsPlayed: { kind: 'cards' },
};

function check(value: unknown, rule: Rule): boolean {
  switch (rule.kind) {
    case 'enum':
      return typeof value === 'string' && rule.values.includes(value);
    case 'int':
      return Number.isInteger(value) && (value as number) >= rule.min && (value as number) <= rule.max;
    case 'bool':
      return typeof value === 'boolean';
    case 'str':
      return typeof value === 'string' && rule.re.test(value);
    case 'obj':
      return isPlainObject(value) && checkShape(value, rule.fields);
    case 'cards':
      return (
        Array.isArray(value) &&
        value.length <= MAX_CARDS_PLAYED &&
        value.every(
          (row) =>
            isPlainObject(row) &&
            Object.keys(row).length === 2 &&
            typeof row.cardId === 'string' &&
            /^[a-z][a-z0-9-]{0,47}$/.test(row.cardId) &&
            Number.isInteger(row.count) &&
            (row.count as number) >= 1 &&
            (row.count as number) <= 8,
        )
      );
  }
}

function isPlainObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

/** Exact-shape check: every allowlisted key present and valid, no other key. */
function checkShape(obj: Json, rules: Record<string, Rule>): boolean {
  const keys = Object.keys(obj);
  if (keys.length !== Object.keys(rules).length) return false;
  for (const key of keys) {
    const rule = rules[key];
    if (!rule || !check(obj[key], rule)) return false;
  }
  return true;
}

// ---------- the daily-rotating de-duplication hash ---------------------------

let saltDay = '';
let salt = new Uint8Array(0);

function saltFor(day: string): Uint8Array {
  if (day !== saltDay) {
    salt = crypto.getRandomValues(new Uint8Array(32));
    saltDay = day;
  }
  return salt;
}

function coarseFamily(ua: string): string {
  const u = ua.toLowerCase();
  if (u.includes('tauri')) return 'tauri';
  if (u.includes('edg/')) return 'edge';
  if (u.includes('firefox/')) return 'firefox';
  if (u.includes('chrome/') || u.includes('crios/')) return 'chrome';
  if (u.includes('safari/')) return 'safari';
  return 'other';
}

async function dailyHash(req: Request, day: string): Promise<string> {
  const ip = req.headers.get('cf-connecting-ip') ?? '';
  const family = coarseFamily(req.headers.get('user-agent') ?? '');
  const bytes = new TextEncoder().encode(`${day}|${ip}|${family}`);
  // Fetch the salt BEFORE sizing the buffer: on a cold isolate the salt is
  // empty until the first call, and sizing off it first threw a RangeError
  // (the one 500 in the T0 spike's first batch).
  const daySalt = saltFor(day);
  const input = new Uint8Array(daySalt.length + bytes.length);
  input.set(daySalt);
  input.set(bytes, daySalt.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  return Array.from(digest.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- handlers ---------------------------------------------------------

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

function respond(req: Request, status: number, body: string | null = null, extra: Record<string, string> = {}): Response {
  const headers = cors(req, new Headers({ 'cache-control': 'no-store', ...extra }));
  return new Response(body, { status, headers });
}

async function readBody(req: Request): Promise<Json | null> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return null;
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function write(env: Env, point: AnalyticsEngineDataPoint): void {
  env.SIGNALS.writeDataPoint(point);
}

async function handleSignals(req: Request, env: Env): Promise<Response> {
  const body = await readBody(req);
  if (!body) return respond(req, 400);

  const day = new Date().toISOString().slice(0, 10);
  const build = env.BUILD_LABEL ?? 'unknown';

  if (body.type === 'heartbeat') {
    if (!checkShape(body, HEARTBEAT)) return respond(req, 400);
    const s = body.settings as Json;
    const hash = await dailyHash(req, day);
    // The index is WAE's sampling key: points sharing one index value are
    // sampled together once the write rate climbs. The daily hash spreads
    // sampling per install; a build-wide index put every player in one
    // bucket and the T0 spike saw 20 heartbeats stored as 2.
    write(env, {
      indexes: [hash],
      blobs: [
        'heartbeat',
        build,
        hash,
        String(body.appVersion),
        String(body.platform),
        String(body.formFactor),
        String(body.lang),
        String(s.animations),
        String(body.streakBucket),
      ],
      doubles: [
        s.reducedMotion ? 1 : 0,
        Number(s.renderScale),
        Number(body.achievementsBucket),
        Number(body.winsBucket),
        Number(body.packsBucket),
        Number(body.collectionBucket),
        body.tutorialDone ? 1 : 0,
        Number(body.gauntletBestRung),
      ],
    });
    return respond(req, 204);
  }

  if (body.type === 'duel') {
    if (!checkShape(body, DUEL)) return respond(req, 400);
    const hash = await dailyHash(req, day);
    write(env, {
      indexes: [hash],
      blobs: [
        'duel',
        build,
        hash,
        String(body.appVersion),
        String(body.platform),
        String(body.format),
        String(body.deckColours),
        String(body.deckArchetype),
        String(body.deckSource),
        String(body.opponentId),
        String(body.difficulty),
        String(body.result),
      ],
      doubles: [Number(body.curveBucket), Number(body.turns), Number(body.mulligans)],
    });
    // Per-card rows carry NO deck reference and no hash: a decklist must never
    // be reassemblable from what we store (spec, "a full decklist is a fingerprint").
    for (const row of body.cardsPlayed as Array<{ cardId: string; count: number }>) {
      // Indexed by card, not by hash: a hash on the card rows would let the
      // duel row and its cards be re-joined, which is the fingerprint the
      // schema exists to prevent. Per-card sampling is also the fair one.
      write(env, {
        indexes: [row.cardId],
        blobs: ['card', build, '', String(body.appVersion), String(body.platform), String(body.format), row.cardId],
        doubles: [row.count],
      });
    }
    return respond(req, 204);
  }

  return respond(req, 400);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return respond(req, 204);

    if (url.pathname === '/health' && req.method === 'GET') {
      return respond(req, 200, JSON.stringify({ ok: true, build: env.BUILD_LABEL ?? 'unknown' }), {
        'content-type': 'application/json',
      });
    }

    if (url.pathname === '/v1/signals') {
      if (req.method !== 'POST') return respond(req, 405, null, { allow: 'POST, OPTIONS' });
      return handleSignals(req, env);
    }

    return respond(req, 404);
  },
} satisfies ExportedHandler<Env>;
