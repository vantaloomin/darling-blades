/**
 * Synthetic sender: fires one of each of the three events at a running
 * signals endpoint, plus the malformed and wrong-route probes, and reports
 * bytes, status codes and latency.
 *
 *   npx tsx worker/scripts/send-synthetic.ts [--n 20] [--url https://db-signals.loominvanta.workers.dev]
 *   npx tsx worker/scripts/send-synthetic.ts --url http://127.0.0.1:8787   # wrangler dev --local
 *
 * THIS SCRIPT IS NEVER PART OF A TEST RUN. It makes real network requests and
 * writes real data points against a live endpoint's daily quota. Vitest
 * collects `tests/**\/*.test.ts` only, so nothing here can be picked up by the
 * suite; it exists to be run by hand, once, after a deploy.
 *
 * The payloads are built by the REAL client builders in src/meta/playSignals.ts
 * rather than hand-written. The spike's script typed its own bodies, which is
 * how it ended up still sending `constructed` and `cardsPlayed` after the
 * schema was ruled. Importing the builders means this script cannot describe a
 * payload the game would not actually send.
 *
 * Wire format, matching the T2 client: the body is the builder's output
 * verbatim and the event kind is the `e` query parameter. Nothing wraps the
 * payload. See the note at the top of worker/src/schema.ts.
 */

import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import {
  buildDuelDigest,
  buildHeartbeat,
  buildSessionCards,
  tallyCardsPlayed,
  type CardTally,
  type DuelDeckInput,
  type SignalEnv,
} from '../../src/meta/playSignals';
import { freshSave } from '../../src/meta/SaveManager';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const URL_BASE = flag('url', 'https://db-signals.loominvanta.workers.dev');
const N = Number(flag('n', '20'));
/** Milliseconds between posts. 0 is a burst, which Analytics Engine samples hard per index. */
const PACE_MS = Number(flag('pace-ms', '0'));
const ORIGIN = 'https://vantaloomin.github.io';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const pick = <T>(xs: readonly T[], i: number): T => xs[i % xs.length];
const byteLength = (s: string): number => new TextEncoder().encode(s).length;

// ---------------------------------------------------------------------------
// Payloads, from the real builders
// ---------------------------------------------------------------------------

const PLAYABLE_IDS: readonly string[] = Object.values(CARD_DB)
  .filter((card) => card.token !== true && !(card.supertypes?.includes('basic') ?? false))
  .map((card) => card.id)
  .sort();

const DECK_IDS: readonly string[] = PLAYABLE_IDS.slice(0, 40);

function save(i: number) {
  const s = freshSave(1_700_000_000_000 + i);
  s.stats.wins = i * 3;
  s.stats.losses = i * 2;
  s.stats.packsOpened = i * 7;
  s.daily.streak.count = i % 31;
  s.gauntlet.bestRung = i % 27;
  s.tutorialDone = i % 4 !== 0;
  s.settings.animations = pick(['full', 'reduced', 'off'] as const, i);
  s.settings.renderScale = pick([1, 1.5, 2] as const, i);
  s.collection = Object.fromEntries(PLAYABLE_IDS.slice(0, 20 + i * 9).map((id) => [id, 1]));
  return s;
}

function env(i: number): SignalEnv {
  return {
    appVersion: '1.8.0',
    buildSha: 'fadbc5d',
    platform: pick(['web', 'desktop'] as const, i),
    formFactor: pick(['desktop', 'mobile', 'tablet'] as const, i),
    lang: pick(['en-GB', 'de', 'ja-JP'], i),
    reducedMotion: i % 5 === 0,
  };
}

function deck(i: number): DuelDeckInput {
  return {
    cards: DECK_IDS.slice(i % 5, 30 + (i % 5)),
    landReserve: null,
    darlingId: null,
    db: CARD_DB,
  };
}

// Each builder's output IS the request body. Nothing wraps it; the event kind
// goes in `?e=`. That is the wire format the T2 client's contract requires, so
// this script sends byte-for-byte what the game will send.
const heartbeat = (i: number): unknown => buildHeartbeat(save(i), env(i));

const duel = (i: number): unknown =>
  buildDuelDigest(
    {
      format: pick(['warchest', 'gauntlet', 'darlings', 'limited'] as const, i),
      opponentId: pick(AVATARS, i).id,
      difficulty: pick(['easy', 'medium', 'hard'] as const, i),
      result: pick(['win', 'loss', 'win', 'draw', 'concede'] as const, i),
      turns: 6 + (i % 14),
      mulligans: i % 3,
    },
    deck(i),
    save(i),
  );

/** A session batch: 12 to 24 distinct cards played across 1 to 8 duels, as a real launch would tally. */
const cardRows = (i: number) => {
  let tally: CardTally = {};
  const distinct = 12 + (i % 13);
  for (let k = 0; k < distinct; k++) {
    const id = DECK_IDS[(i * 7 + k * 3) % DECK_IDS.length];
    tally = tallyCardsPlayed(tally, Array.from({ length: 1 + ((i + k) % 4) }, () => id), CARD_DB);
  }
  return buildSessionCards(tally, 1 + (i % 8));
};

const cards = (i: number): unknown => cardRows(i);

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

const hb = (i: number) => heartbeat(i) as Record<string, unknown>;
const dl = (i: number) => duel(i) as Record<string, unknown>;
const row = (k: number) => ({
  cardId: `fx-${'abcdefghij'[k % 10]}${'abcdefghij'[Math.floor(k / 10)]}`,
  countBucket: '1',
  duelsBucket: '4-7',
});

/** Each entry is [label, event kind for `?e=`, body, expected status]. */
const malformed: Array<[string, string, unknown, number]> = [
  ['unknown key', 'heartbeat', { ...hb(1), deckName: 'my deck' }, 400],
  ['raw ua', 'heartbeat', { ...hb(2), userAgent: 'Mozilla/5.0' }, 400],
  ['missing key', 'heartbeat', { ...hb(3), lang: undefined }, 400],
  ['raw count instead of a bucket', 'heartbeat', { ...hb(4), winsBucket: 137 }, 400],
  ['retired format value', 'duel', { ...dl(5), format: 'constructed' }, 400],
  ['the spike’s flattened discriminator', 'heartbeat', { ...hb(6), type: 'heartbeat', v: 1 }, 400],
  ['a body envelope', 'heartbeat', { v: 1, type: 'heartbeat', payload: hb(7) }, 400],
  ['cardsPlayed back on the duel event', 'duel', { ...dl(8), cardsPlayed: [] }, 400],
  ['61 card rows', 'cards', Array.from({ length: 61 }, (_, k) => row(k)), 400],
  [
    'batch disagreeing on duelsBucket',
    'cards',
    [
      { cardId: 'fx-aa', countBucket: '1', duelsBucket: '1' },
      { cardId: 'fx-ab', countBucket: '1', duelsBucket: '8+' },
    ],
    400,
  ],
  ['empty batch', 'cards', [], 400],
  ['a payload posted as the wrong kind', 'duel', hb(9), 400],
  ['not an object', 'heartbeat', [1, 2, 3], 400],
  ['unknown ?e=', 'session', hb(10), 400],
  ['missing ?e=', '', hb(11), 400],
];

async function post(
  body: unknown,
  kind: string,
  init: { contentType?: string; origin?: string; version?: string } = {},
): Promise<{ status: number; ms: number; size: number }> {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  const url = new URL(`${URL_BASE}/v1/signals`);
  if (kind !== '') url.searchParams.set('e', kind);
  if (init.version !== undefined) url.searchParams.set('v', init.version);
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': init.contentType ?? 'application/json', origin: init.origin ?? ORIGIN },
    body: json,
  });
  return { status: res.status, ms: performance.now() - t0, size: byteLength(json) };
}

const stat = (xs: number[]): { min: number; median: number; max: number } => {
  const s = [...xs].sort((a, b) => a - b);
  return { min: s[0], median: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
};

async function main(): Promise<void> {
  const health = await fetch(`${URL_BASE}/health`);
  console.log(`health: ${health.status} ${await health.text()}`);

  const kinds = ['heartbeat', 'duel', 'cards'] as const;
  const results: Record<string, { sizes: number[]; ms: number[]; statuses: Record<number, number> }> = {
    heartbeat: { sizes: [], ms: [], statuses: {} },
    duel: { sizes: [], ms: [], statuses: {} },
    cards: { sizes: [], ms: [], statuses: {} },
  };
  const build = { heartbeat, duel, cards };
  for (let i = 0; i < N; i++) {
    for (const kind of kinds) {
      const r = await post(build[kind](i), kind);
      results[kind].sizes.push(r.size);
      results[kind].ms.push(r.ms);
      results[kind].statuses[r.status] = (results[kind].statuses[r.status] ?? 0) + 1;
      if (PACE_MS > 0) await sleep(PACE_MS);
    }
  }
  for (const kind of kinds) {
    const r = results[kind];
    console.log(
      `${kind}: n=${r.sizes.length} statuses=${JSON.stringify(r.statuses)} bytes=${JSON.stringify(stat(r.sizes))} latency_ms=${JSON.stringify(
        Object.fromEntries(Object.entries(stat(r.ms)).map(([k, v]) => [k, Math.round(v)])),
      )}`,
    );
  }

  let refused = 0;
  for (const [label, kind, body, want] of malformed) {
    const r = await post(body, kind);
    const ok = r.status === want;
    if (ok) refused++;
    console.log(`malformed (${label}): ${r.status} want ${want} ${ok ? 'OK' : 'ACCEPTED - VALIDATOR HOLE'}`);
  }
  console.log(`malformed refused: ${refused}/${malformed.length}`);

  const oversize = await post(JSON.stringify({ pad: 'x'.repeat(9000) }), 'heartbeat');
  const badType = await post(heartbeat(1), 'heartbeat', { contentType: 'text/html' });
  const foreign = await post(heartbeat(1), 'heartbeat', { origin: 'https://evil.example' });
  const badVersion = await post(heartbeat(1), 'heartbeat', { version: '2' });
  const okVersion = await post(heartbeat(1), 'heartbeat', { version: '1' });
  console.log(
    `oversize: ${oversize.status} (expect 413) · bad content-type: ${badType.status} (expect 415) · ` +
      `foreign origin: ${foreign.status} (expect 403) · ?v=2: ${badVersion.status} (expect 400) · ` +
      `?v=1: ${okVersion.status} (expect 204)`,
  );

  const wrongMethod = await fetch(`${URL_BASE}/v1/signals`, { method: 'GET' });
  const missing = await fetch(`${URL_BASE}/nope`);
  console.log(`GET /v1/signals: ${wrongMethod.status} (expect 405) · GET /nope: ${missing.status} (expect 404)`);

  // Data points per player-session, which is the budget that actually binds
  // (docs/telemetry-t0-finding.md finding 3): 1 heartbeat + one row per duel +
  // one row per distinct card the launch played.
  const perSession = Array.from({ length: N }, (_, i) => 1 + (1 + (i % 8)) + cardRows(i).length);
  console.log(
    `data points per player-session: ${JSON.stringify(stat(perSession))} ` +
      `(1 heartbeat + duel rows + card rows) · free cap 100,000/day`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
