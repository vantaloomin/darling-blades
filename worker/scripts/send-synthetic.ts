/**
 * T0 spike sender: fires synthetic heartbeat and duel digests at the signals
 * endpoint and reports payload sizes, status codes and latency, so the
 * free-tier headroom is projected from measured bytes rather than guesses.
 *
 *   npx tsx worker/scripts/send-synthetic.ts [--n 20] [--url https://db-signals.loominvanta.workers.dev]
 *
 * Every value here is a bucket or an enum from the spec's allowlist; nothing
 * identifying exists to leak. Also sends a handful of deliberately malformed
 * bodies and expects 400 for each (the validator is part of what is proven).
 */

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const URL_BASE = flag('url', 'https://db-signals.loominvanta.workers.dev');
const N = Number(flag('n', '20'));
/** Milliseconds between posts. 0 is a burst, which WAE samples hard per index. */
const PACE_MS = Number(flag('pace-ms', '0'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pick = <T>(xs: readonly T[], i: number): T => xs[i % xs.length];
const bytes = (s: string): number => new TextEncoder().encode(s).length;

const heartbeat = (i: number) => ({
  type: 'heartbeat',
  v: 1,
  appVersion: '1.7.2',
  buildSha: 'fadbc5d',
  platform: pick(['web', 'desktop'], i),
  formFactor: pick(['desktop', 'mobile', 'tablet'], i),
  lang: pick(['en', 'de', 'ja'], i),
  settings: { animations: pick(['full', 'reduced', 'off'], i), reducedMotion: i % 5 === 0, renderScale: 1 + (i % 3) },
  streakBucket: pick(['0', '1', '2', '3', '4-6', '7-13', '14-29', '30+'], i),
  achievementsBucket: i % 11,
  winsBucket: (i * 3) % 11,
  packsBucket: (i * 7) % 11,
  collectionBucket: (i * 2) % 11,
  tutorialDone: i % 4 !== 0,
  gauntletBestRung: i % 25,
});

const duel = (i: number) => ({
  type: 'duel',
  v: 1,
  appVersion: '1.7.2',
  buildSha: 'fadbc5d',
  platform: pick(['web', 'desktop'], i),
  format: pick(['constructed', 'gauntlet', 'darlings', 'limited'], i),
  deckColours: pick(['WU', 'BR', 'G', 'UB', 'RW', 'GB'], i),
  deckArchetype: pick(['midrange', 'burn', 'weenie', 'draw-go', 'attrition', 'reanimator'], i),
  curveBucket: i % 6,
  deckSource: pick(['precon', 'custom', 'drafted'], i),
  opponentId: pick(['zhou-yu', 'anubis', 'chrome-broodmother', 'the-bride'], i),
  difficulty: pick(['easy', 'medium', 'hard'], i),
  turns: 6 + (i % 14),
  result: pick(['win', 'loss', 'win', 'draw'], i),
  mulligans: i % 3,
  // 40-card Warchest deck, typical played-card count 12-24, each 1-4 copies.
  cardsPlayed: Array.from({ length: 12 + (i % 13) }, (_, k) => ({ cardId: `card-${(i * 7 + k * 3) % 400}`, count: 1 + ((i + k) % 4) })),
});

const malformed: Array<[string, unknown]> = [
  ['unknown key', { ...heartbeat(1), deckName: 'my deck' }],
  ['raw ua', { ...heartbeat(2), userAgent: 'Mozilla/5.0' }],
  ['out-of-range bucket', { ...heartbeat(3), achievementsBucket: 11 }],
  ['non-bucketed number', { ...duel(4), turns: 999 }],
  ['too many cards', { ...duel(5), cardsPlayed: Array.from({ length: 61 }, (_, k) => ({ cardId: `c${k}`, count: 1 })) }],
  ['wrong type', { type: 'session', v: 1 }],
  ['not an object', [1, 2, 3]],
];

async function post(body: unknown): Promise<{ status: number; ms: number; size: number }> {
  const json = JSON.stringify(body);
  const t0 = performance.now();
  const res = await fetch(`${URL_BASE}/v1/signals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://vantaloomin.github.io' },
    body: json,
  });
  return { status: res.status, ms: performance.now() - t0, size: bytes(json) };
}

async function main(): Promise<void> {
  const health = await fetch(`${URL_BASE}/health`);
  console.log(`health: ${health.status} ${await health.text()}`);

  const results: Record<string, { sizes: number[]; ms: number[]; statuses: Record<number, number> }> = {
    heartbeat: { sizes: [], ms: [], statuses: {} },
    duel: { sizes: [], ms: [], statuses: {} },
  };
  for (let i = 0; i < N; i++) {
    for (const [kind, body] of [
      ['heartbeat', heartbeat(i)],
      ['duel', duel(i)],
    ] as const) {
      const r = await post(body);
      results[kind].sizes.push(r.size);
      results[kind].ms.push(r.ms);
      results[kind].statuses[r.status] = (results[kind].statuses[r.status] ?? 0) + 1;
      if (PACE_MS > 0) await sleep(PACE_MS);
    }
  }
  const stat = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return { min: s[0], median: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
  };
  for (const kind of ['heartbeat', 'duel'] as const) {
    const r = results[kind];
    console.log(
      `${kind}: n=${r.sizes.length} statuses=${JSON.stringify(r.statuses)} bytes=${JSON.stringify(stat(r.sizes))} latency_ms=${JSON.stringify(
        Object.fromEntries(Object.entries(stat(r.ms)).map(([k, v]) => [k, Math.round(v)])),
      )}`,
    );
  }

  let rejected = 0;
  for (const [label, body] of malformed) {
    const r = await post(body);
    const ok = r.status === 400;
    if (ok) rejected++;
    console.log(`malformed (${label}): ${r.status} ${ok ? 'rejected' : 'ACCEPTED - VALIDATOR HOLE'}`);
  }
  console.log(`malformed rejected: ${rejected}/${malformed.length}`);

  const wrong = await fetch(`${URL_BASE}/v1/signals`, { method: 'GET' });
  const missing = await fetch(`${URL_BASE}/nope`);
  console.log(`GET /v1/signals: ${wrong.status} (expect 405) · GET /nope: ${missing.status} (expect 404)`);

  // Data points written per duel = 1 + cardsPlayed rows; state it for the headroom maths.
  const cardRows = Array.from({ length: N }, (_, i) => duel(i).cardsPlayed.length);
  console.log(`duel data points per event: ${JSON.stringify(stat(cardRows.map((c) => c + 1)))} (1 duel row + card rows)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
