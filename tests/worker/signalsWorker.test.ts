import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATARS } from '../../src/data/opponents';
import {
  buildDuelDigest,
  buildHeartbeat,
  buildSessionCards,
  type DuelDeckInput,
  type DuelResultInput,
  type SignalEnv,
} from '../../src/meta/playSignals';
import type { DataPoint, Env, KvLike } from '../../worker/src/index';
import worker, { resetSaltCacheForTests } from '../../worker/src/index';
import { MAX_BODY_BYTES, MAX_CARD_ROWS, WIRE_VERSION, type EventType } from '../../worker/src/schema';
import { TINY_DB, richSave } from '../meta/playSignals.fixtures';

/**
 * The Worker's behaviour: the daily salt, the refusals, and the promise that
 * nothing derived from the request reaches storage.
 *
 * These live under `tests/worker/` rather than inside `worker/` for the same
 * reason the schema test does: this is the repo's only test runner, so it is
 * the only place these run in the ladder and in CI. `worker/src/index.ts`
 * declares its bindings structurally so it can be imported here with no
 * Cloudflare ambient types; `worker/src/bindings.check.ts` is what proves those
 * structural types still match the real ones.
 *
 * "Isolate" below means a fresh module instance. The salt cache is module-level
 * state, which is exactly what a Cloudflare isolate is, so `vi.resetModules()`
 * plus a dynamic import is a faithful simulation of a second isolate sharing
 * one KV namespace.
 */

const ORIGIN = 'https://vantaloomin.github.io';
const URL_BASE = 'https://db-signals.loominvanta.workers.dev';

/** A distinctive IP and user agent, so a substring search over what was written means something. */
const SENTINEL_IP = '203.0.113.77';
const SENTINEL_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 ZZQXSENTINELUA';

const DAY_ONE = '2026-09-17T12:00:00.000Z';
const DAY_TWO = '2026-09-18T00:30:00.000Z';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeKv implements KvLike {
  readonly store = new Map<string, string>();
  readonly gets: string[] = [];
  readonly puts: Array<{ key: string; value: string; expiration?: number }> = [];
  /** When set, every get misses however much is stored: the pathological stale read. */
  alwaysMiss = false;
  private gate: Promise<void> | null = null;
  private open: (() => void) | null = null;

  /** Hold every get until `release()`, so two isolates can be made to miss together. */
  holdGets(): void {
    this.gate = new Promise<void>((resolve) => {
      this.open = () => {
        this.gate = null;
        this.open = null;
        resolve();
      };
    });
  }

  release(): void {
    this.open?.();
  }

  async get(key: string): Promise<string | null> {
    this.gets.push(key);
    if (this.gate) await this.gate;
    if (this.alwaysMiss) return null;
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, options?: { expiration?: number }): Promise<void> {
    this.puts.push({ key, value, expiration: options?.expiration });
    this.store.set(key, value);
  }
}

class FakeSink {
  readonly points: DataPoint[] = [];
  writeDataPoint(point: DataPoint): void {
    this.points.push(JSON.parse(JSON.stringify(point)) as DataPoint);
  }
}

class FakeLimiter {
  readonly keys: string[] = [];
  allow = true;
  async limit(options: { key: string }): Promise<{ success: boolean }> {
    this.keys.push(options.key);
    return { success: this.allow };
  }
}

interface Rig {
  env: Env;
  kv: FakeKv;
  sink: FakeSink;
  limiter: FakeLimiter;
}

function rig(overrides: Partial<Env> = {}, shared: Partial<Rig> = {}): Rig {
  const kv = shared.kv ?? new FakeKv();
  const sink = shared.sink ?? new FakeSink();
  const limiter = shared.limiter ?? new FakeLimiter();
  const env: Env = {
    SIGNALS: sink,
    SALT_KV: kv,
    SIGNALS_RATE_LIMIT: limiter,
    SALT_SECRET: 'a-test-secret-that-is-not-the-real-one',
    BUILD_LABEL: 't2',
    ...overrides,
  };
  return { env, kv, sink, limiter };
}

// ---------------------------------------------------------------------------
// Payloads, built by the real client builders
// ---------------------------------------------------------------------------

const SIGNAL_ENV: SignalEnv = {
  appVersion: '1.8.0',
  buildSha: 'a1b2c3d',
  platform: 'web',
  formFactor: 'mobile',
  lang: 'en-GB',
  reducedMotion: false,
};

const DECK: DuelDeckInput = {
  cards: ['fx-white-two', 'fx-blue-three'],
  landReserve: null,
  darlingId: null,
  db: TINY_DB,
};

const RESULT: DuelResultInput = {
  format: 'gauntlet',
  opponentId: AVATARS[0].id,
  difficulty: 'hard',
  result: 'concede',
  turns: 12,
  mulligans: 2,
};

// The body is the builder's output verbatim. Nothing wraps it, and the event
// kind travels in `?e=`, which is the wire format the T2 client's contract
// requires: what leaves the device is byte-identical to what the pure builders
// produced.
const heartbeatBody = (): string => JSON.stringify(buildHeartbeat(richSave(), SIGNAL_ENV));
const duelBody = (): string => JSON.stringify(buildDuelDigest(RESULT, DECK, richSave()));
const cardsBody = (duels = 3): string =>
  JSON.stringify(buildSessionCards({ 'fx-black-five': 5, 'fx-white-two': 1, 'fx-red-one': 2 }, duels));

interface PostInit {
  origin?: string | null;
  contentType?: string | null;
  ip?: string;
  ua?: string;
  /** Overrides `?e=`; pass null to leave it off entirely. */
  event?: string | null;
  /** Adds `&v=`. Omitted means the parameter is absent, which is the normal case. */
  version?: string;
}

function post(body: string, kind: EventType, init: PostInit = {}): Request {
  const headers = new Headers();
  if (init.contentType !== null) headers.set('content-type', init.contentType ?? 'application/json');
  if (init.origin !== null) headers.set('origin', init.origin ?? ORIGIN);
  headers.set('cf-connecting-ip', init.ip ?? SENTINEL_IP);
  headers.set('user-agent', init.ua ?? SENTINEL_UA);
  const url = new URL(`${URL_BASE}/v1/signals`);
  const event = init.event === undefined ? kind : init.event;
  if (event !== null) url.searchParams.set('e', event);
  if (init.version !== undefined) url.searchParams.set('v', init.version);
  return new Request(url, { method: 'POST', headers, body });
}

const postHeartbeat = (init: PostInit = {}): Request => post(heartbeatBody(), 'heartbeat', init);
const postDuel = (init: PostInit = {}): Request => post(duelBody(), 'duel', init);
const postCards = (duels = 3, init: PostInit = {}): Request => post(cardsBody(duels), 'cards', init);

/** A fresh module instance: a second Cloudflare isolate, sharing whatever KV it is handed. */
async function freshIsolate(): Promise<typeof import('../../worker/src/index')> {
  vi.resetModules();
  return import('../../worker/src/index');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(DAY_ONE));
  resetSaltCacheForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

// ---------------------------------------------------------------------------

describe('routing', () => {
  it('answers GET /health with the build label and nothing else', async () => {
    const { env } = rig();
    const res = await worker.fetch(new Request(`${URL_BASE}/health`), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, build: 't2' });
  });

  it('404s every other path and 405s the wrong method on the endpoint', async () => {
    const { env } = rig();
    expect((await worker.fetch(new Request(`${URL_BASE}/nope`), env)).status).toBe(404);
    expect((await worker.fetch(new Request(`${URL_BASE}/`), env)).status).toBe(404);
    expect((await worker.fetch(new Request(`${URL_BASE}/api/event`), env)).status).toBe(404);
    const wrongMethod = await worker.fetch(new Request(`${URL_BASE}/v1/signals`), env);
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get('allow')).toBe('POST, OPTIONS');
  });

  it('answers the CORS preflight and echoes only an allowlisted origin', async () => {
    const { env } = rig();
    const allowed = await worker.fetch(
      new Request(`${URL_BASE}/v1/signals`, { method: 'OPTIONS', headers: { origin: ORIGIN } }),
      env,
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN);

    const foreign = await worker.fetch(
      new Request(`${URL_BASE}/v1/signals`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }),
      env,
    );
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('403s a POST from an origin that is not ours, before reading the body', async () => {
    const { env, sink, kv } = rig();
    const res = await worker.fetch(postHeartbeat({ origin: 'https://evil.example' }), env);
    expect(res.status).toBe(403);
    expect(sink.points).toHaveLength(0);
    expect(kv.gets).toHaveLength(0);
  });
});

describe('refusals', () => {
  it('415s a content type that is neither JSON nor a beacon, and one that is absent', async () => {
    const { env } = rig();
    for (const contentType of ['text/html', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
      const res = await worker.fetch(postHeartbeat({ contentType }), env);
      expect(res.status, `${contentType} was not refused`).toBe(415);
    }
    // A body with no content-type at all. A Blob with an empty type is the only
    // way to build one: a string body makes undici stamp text/plain itself.
    const headers = new Headers({ origin: ORIGIN, 'cf-connecting-ip': SENTINEL_IP });
    const bare = new Request(`${URL_BASE}/v1/signals?e=heartbeat`, {
      method: 'POST',
      headers,
      body: new Blob([heartbeatBody()], { type: '' }),
    });
    expect(bare.headers.get('content-type')).toBeNull();
    expect((await worker.fetch(bare, env)).status).toBe(415);
  });

  it('accepts the beacon content type, since the cards batch leaves on unload', async () => {
    const { env, sink } = rig();
    const res = await worker.fetch(postCards(3, { contentType: 'text/plain;charset=UTF-8' }), env);
    expect(res.status).toBe(204);
    expect(sink.points.length).toBeGreaterThan(0);
  });

  it('413s a body over the cap', async () => {
    const { env, sink } = rig();
    const oversize = JSON.stringify({ pad: 'x'.repeat(MAX_BODY_BYTES) });
    expect(oversize.length).toBeGreaterThan(MAX_BODY_BYTES);
    const res = await worker.fetch(post(oversize, 'heartbeat'), env);
    expect(res.status).toBe(413);
    expect(sink.points).toHaveLength(0);
  });

  it('400s a body that is not JSON, and one that is JSON but not the schema', async () => {
    const { env, sink } = rig();
    expect((await worker.fetch(post('not json at all', 'heartbeat'), env)).status).toBe(400);
    expect((await worker.fetch(post('[1,2,3]', 'heartbeat'), env)).status).toBe(400);
    expect((await worker.fetch(post('{}', 'heartbeat'), env)).status).toBe(400);
    expect((await worker.fetch(post('{"deckName":"mine"}', 'duel'), env)).status).toBe(400);
    // The spike's flattened shape and the envelope an earlier draft of this
    // Worker used are both extra keys now, so a client left on either fails loud.
    expect(
      (await worker.fetch(post(`{"v":1,"type":"heartbeat","payload":${heartbeatBody()}}`, 'heartbeat'), env)).status,
    ).toBe(400);
    expect(sink.points).toHaveLength(0);
  });

  it('400s a missing, unknown or misspelt ?e=, and an explicit ?v= this Worker does not speak', async () => {
    const { env, sink } = rig();
    expect(WIRE_VERSION).toBe(1);
    for (const event of [null, '', 'card', 'session', 'HEARTBEAT']) {
      const res = await worker.fetch(postHeartbeat({ event }), env);
      expect(res.status, `?e=${String(event)} was not refused`).toBe(400);
    }
    // Absent is the normal case and means version 1.
    expect((await worker.fetch(postHeartbeat(), env)).status).toBe(204);
    expect((await worker.fetch(postHeartbeat({ version: '1' }), env)).status).toBe(204);
    for (const version of ['', '2', '0', '1.0']) {
      const res = await worker.fetch(postHeartbeat({ version }), env);
      expect(res.status, `?v=${version} was not refused`).toBe(400);
    }
    expect(sink.points).toHaveLength(2);
  });

  it('routes the body by the query, so a payload posted as the wrong kind is refused', async () => {
    const { env, sink } = rig();
    expect((await worker.fetch(post(heartbeatBody(), 'duel'), env)).status).toBe(400);
    expect((await worker.fetch(post(duelBody(), 'cards'), env)).status).toBe(400);
    expect((await worker.fetch(post(cardsBody(), 'heartbeat'), env)).status).toBe(400);
    expect(sink.points).toHaveLength(0);
  });

  it('429s over the rate limit, with no body and nothing written', async () => {
    const { env, sink, limiter } = rig();
    limiter.allow = false;
    const res = await worker.fetch(postHeartbeat(), env);
    expect(res.status).toBe(429);
    expect(await res.text()).toBe('');
    expect(sink.points).toHaveLength(0);
  });

  it('rate limits on the daily hash, not on anything that identifies the caller', async () => {
    const { env, limiter, sink } = rig();
    await worker.fetch(postHeartbeat(), env);
    expect(limiter.keys).toHaveLength(1);
    expect(limiter.keys[0]).toMatch(/^[0-9a-f]{16}$/);
    expect(limiter.keys[0]).toBe(sink.points[0].indexes[0]);
  });

  it('refuses a cards batch one row over the cap, and takes one at the cap', async () => {
    const { env, sink } = rig();
    const tally: Record<string, number> = {};
    for (let i = 0; i < MAX_CARD_ROWS + 1; i++) {
      tally[`fx-card-${'abcdefghij'[i % 10]}${'abcdefghij'[Math.floor(i / 10)]}`] = 1;
    }
    const rows = buildSessionCards(tally, 3);
    expect(rows).toHaveLength(MAX_CARD_ROWS + 1);
    const over = await worker.fetch(post(JSON.stringify(rows), 'cards'), env);
    expect(over.status).toBe(400);
    expect(sink.points).toHaveLength(0);

    const at = await worker.fetch(post(JSON.stringify(rows.slice(0, MAX_CARD_ROWS)), 'cards'), env);
    expect(at.status).toBe(204);
    expect(sink.points).toHaveLength(MAX_CARD_ROWS);
  });
});

// ---------------------------------------------------------------------------

describe('what is written', () => {
  it('writes one heartbeat row in the documented column order', async () => {
    const { env, sink } = rig();
    expect((await worker.fetch(postHeartbeat(), env)).status).toBe(204);
    expect(sink.points).toHaveLength(1);
    const point = sink.points[0];
    const hash = point.indexes[0];
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(point.blobs).toEqual([
      'heartbeat',
      't2',
      hash,
      '1.8.0',
      'a1b2c3d',
      'web',
      'mobile',
      'en',
      'reduced',
      '1080p',
      '30+',
      '0.0',
      '250+',
      '250+',
      '250+',
      '1-24',
    ]);
    expect(point.doubles).toEqual([0, 1, 26]);
  });

  it('writes one duel row in the documented column order, with no card id anywhere', async () => {
    const { env, sink } = rig();
    expect((await worker.fetch(postDuel(), env)).status).toBe(204);
    expect(sink.points).toHaveLength(1);
    const point = sink.points[0];
    expect(point.blobs.slice(0, 2)).toEqual(['duel', 't2']);
    expect(point.blobs[2]).toBe(point.indexes[0]);
    expect(point.blobs.slice(3)).toEqual([
      'gauntlet',
      'WU',
      'custom',
      '2.5-2.9',
      'custom',
      AVATARS[0].id,
      'hard',
      '11-15',
      'concede',
    ]);
    expect(point.doubles).toEqual([2]);
    const serialised = JSON.stringify(point);
    for (const cardId of DECK.cards) expect(serialised).not.toContain(cardId);
  });

  it('writes one data point per card row, indexed by card, carrying no install hash', async () => {
    const { env, sink } = rig();
    // A heartbeat first, so the hash of this install exists to search for.
    await worker.fetch(postHeartbeat(), env);
    const hash = sink.points[0].indexes[0];
    sink.points.length = 0;

    expect((await worker.fetch(postCards(3), env)).status).toBe(204);
    expect(sink.points).toHaveLength(3);
    for (const point of sink.points) {
      expect(point.blobs[0]).toBe('card');
      expect(point.blobs[1]).toBe('t2');
      // blob3 is the hash column on every other event and is ALWAYS empty here:
      // a duel row and the cards of the same session must not be re-joinable.
      expect(point.blobs[2]).toBe('');
      expect(point.indexes).toEqual([point.blobs[3]]);
      expect(point.doubles).toEqual([]);
      expect(JSON.stringify(point)).not.toContain(hash);
    }
    expect(sink.points.map((p) => p.blobs[3])).toEqual(['fx-black-five', 'fx-red-one', 'fx-white-two']);
    expect(sink.points.map((p) => p.blobs[4])).toEqual(['4-7', '2-3', '1']);
    expect(new Set(sink.points.map((p) => p.blobs[5]))).toEqual(new Set(['2-3']));
  });

  it('writes nothing derived from the IP, the user agent or any header', async () => {
    const { env, sink } = rig();
    await worker.fetch(postHeartbeat(), env);
    await worker.fetch(postDuel(), env);
    await worker.fetch(postCards(), env);
    expect(sink.points.length).toBeGreaterThan(2);
    const written = JSON.stringify(sink.points);
    for (const fragment of [SENTINEL_IP, '203.0.113', SENTINEL_UA, 'ZZQXSENTINELUA', 'Mozilla', 'chrome', 'Chrome']) {
      expect(written, `"${fragment}" reached storage`).not.toContain(fragment);
    }
  });

  it('the stored hash is not a function of the IP alone: change the secret, change the hash', async () => {
    const kv = new FakeKv();
    const first = rig({ SALT_SECRET: 'secret-one' }, { kv });
    await worker.fetch(postHeartbeat(), first.env);
    const hashOne = first.sink.points[0].indexes[0];

    resetSaltCacheForTests();
    const second = rig({ SALT_SECRET: 'secret-two' }, { kv });
    await worker.fetch(postHeartbeat(), second.env);
    const hashTwo = second.sink.points[0].indexes[0];

    // Same IP, same user agent, same day, SAME stored random value.
    expect(kv.puts).toHaveLength(1);
    expect(hashOne).not.toBe(hashTwo);
  });

  it('the stored hash is not a function of the secret alone: change the day random, change the hash', async () => {
    const first = rig();
    await worker.fetch(postHeartbeat(), first.env);
    const hashOne = first.sink.points[0].indexes[0];

    // A fresh KV is the world after the day's key has expired: the same secret
    // and the same IP can no longer reproduce yesterday's hash, which is what
    // "even we cannot connect one day's summaries to another's" means.
    resetSaltCacheForTests();
    const second = rig({}, { kv: new FakeKv() });
    await worker.fetch(postHeartbeat(), second.env);
    expect(second.sink.points[0].indexes[0]).not.toBe(hashOne);
  });
});

// ---------------------------------------------------------------------------

describe('the daily salt', () => {
  it('refuses to write at all when SALT_SECRET is missing, and never falls back', async () => {
    for (const secret of [undefined, '']) {
      resetSaltCacheForTests();
      const { env, sink, kv, limiter } = rig({ SALT_SECRET: secret });
      const res = await worker.fetch(postHeartbeat(), env);
      expect(res.status).toBe(503);
      expect(await res.text()).toBe('');
      expect(sink.points).toHaveLength(0);
      expect(limiter.keys).toHaveLength(0);
      // It does not even reach the salt store, so there is no unsalted path to
      // take by accident.
      expect(kv.gets).toHaveLength(0);
    }
  });

  it('reads KV at most once per isolate per day', async () => {
    const { env, kv } = rig();
    await worker.fetch(postHeartbeat(), env);
    const afterFirst = kv.gets.length;
    // Cold path: one miss plus the reconciling re-read.
    expect(afterFirst).toBe(2);
    for (let i = 0; i < 5; i++) await worker.fetch(postDuel(), env);
    expect(kv.gets.length).toBe(afterFirst);
    expect(kv.puts).toHaveLength(1);
  });

  it('stores the day under its own key, with an absolute expiry just past that day', async () => {
    const { env, kv } = rig();
    await worker.fetch(postHeartbeat(), env);
    expect(kv.puts[0].key).toBe('salt:2026-09-17');
    const endOfDay = Date.parse('2026-09-18T00:00:00Z') / 1000;
    expect(kv.puts[0].expiration).toBe(endOfDay + 3600);
    expect(kv.puts[0].expiration).toBeGreaterThan(endOfDay);
    expect(kv.puts[0].expiration).toBeLessThan(endOfDay + 86400);
    // 32 random bytes, base64.
    expect(Buffer.from(kv.puts[0].value, 'base64')).toHaveLength(32);
  });

  it('does not read yesterday’s key today, and hashes the same install differently across days', async () => {
    const kv = new FakeKv();
    const { env, sink } = rig({}, { kv });
    await worker.fetch(postHeartbeat(), env);
    const dayOneHash = sink.points[0].indexes[0];
    expect(kv.gets.every((key) => key === 'salt:2026-09-17')).toBe(true);

    vi.setSystemTime(new Date(DAY_TWO));
    const getsBefore = kv.gets.length;
    await worker.fetch(postHeartbeat(), env);
    const dayTwoHash = sink.points[1].indexes[0];

    const newGets = kv.gets.slice(getsBefore);
    expect(newGets.length).toBeGreaterThan(0);
    expect(newGets.every((key) => key === 'salt:2026-09-18')).toBe(true);
    expect(kv.gets.filter((key) => key === 'salt:2026-09-17')).toHaveLength(getsBefore);
    // Same IP, same user agent, one day apart.
    expect(dayTwoHash).not.toBe(dayOneHash);
    expect(kv.store.has('salt:2026-09-17')).toBe(true);
    expect(kv.store.has('salt:2026-09-18')).toBe(true);
  });

  it('converges two isolates that race to create the same day’s salt', async () => {
    const kv = new FakeKv();
    const isolateA = await freshIsolate();
    const isolateB = await freshIsolate();
    expect(isolateA).not.toBe(isolateB);

    const a = rig({}, { kv });
    const b = rig({}, { kv });

    // Both miss together: the gate holds the first get of each until released.
    kv.holdGets();
    const responses = Promise.all([
      isolateA.default.fetch(postHeartbeat(), a.env),
      isolateB.default.fetch(postHeartbeat(), b.env),
    ]);
    await Promise.resolve();
    kv.release();
    const [resA, resB] = await responses;

    expect(resA.status).toBe(204);
    expect(resB.status).toBe(204);
    // Both wrote, because KV has no compare-and-set...
    expect(kv.puts).toHaveLength(2);
    // ...and both then re-read, so both ended up on the value the store settled
    // on, and one install is still one hash.
    expect(a.sink.points[0].indexes[0]).toBe(b.sink.points[0].indexes[0]);
  });

  it('diverges only in the documented stale-read case, and still writes', async () => {
    // The caveat stated in src/index.ts: KV is eventually consistent and caches
    // a miss at the edge, so on a day rollover the reconciling re-read can also
    // miss and two isolates briefly hold different values. The consequence is
    // bounded to an over-count of distinct installs for those minutes, which T0
    // finding 5 already names as the failure mode. It is never an outage and
    // never an unsalted hash.
    const kv = new FakeKv();
    kv.alwaysMiss = true;
    const isolateA = await freshIsolate();
    const isolateB = await freshIsolate();
    const a = rig({}, { kv });
    const b = rig({}, { kv });

    const resA = await isolateA.default.fetch(postHeartbeat(), a.env);
    const resB = await isolateB.default.fetch(postHeartbeat(), b.env);

    expect(resA.status).toBe(204);
    expect(resB.status).toBe(204);
    expect(a.sink.points[0].indexes[0]).not.toBe(b.sink.points[0].indexes[0]);
    // Both values still expire with the day, so neither survives it.
    expect(kv.puts.every((put) => put.expiration === Date.parse('2026-09-18T00:00:00Z') / 1000 + 3600)).toBe(true);
  });

  it('gives two different installs two different hashes on one day', async () => {
    const { env, sink } = rig();
    await worker.fetch(postHeartbeat({ ip: '203.0.113.1' }), env);
    await worker.fetch(postHeartbeat({ ip: '203.0.113.2' }), env);
    expect(sink.points[0].indexes[0]).not.toBe(sink.points[1].indexes[0]);
  });

  it('gives one install the same hash across requests in a day', async () => {
    const { env, sink } = rig();
    await worker.fetch(postHeartbeat(), env);
    await worker.fetch(postDuel(), env);
    expect(sink.points[0].indexes[0]).toBe(sink.points[1].indexes[0]);
  });
});
