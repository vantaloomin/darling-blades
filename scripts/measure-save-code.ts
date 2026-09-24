/**
 * Measure real save-code sizes for representative profiles.
 *
 *   npx tsx scripts/measure-save-code.ts [--json]
 *
 * Built for the 1.5 save-code wave (PR #141) as the fixture matrix
 * docs/plan-save-portability.md asked for before any QR-fit claim; extended
 * in the telemetry T0 spike (docs/telemetry-t0-finding.md) with profiles
 * drawn from the real card catalog, because wave C0 of the accounts rollout
 * sizes the Supabase free tier from these numbers. Reports, per profile and
 * with and without replays: the raw JSON bytes, the deflated payload bytes,
 * and the final `DBS1-` code length. No QR-fit claim is made here.
 *
 * Nothing here reads or writes a real save.
 */

import { strToU8 } from 'fflate';
import { ALL_CARDS } from '../src/data/catalog';
import { decode, encode, MAX_DECODED_SAVE_BYTES } from '../src/meta/SaveCode';
import { REPLAY_CAP } from '../src/meta/Replay';
import { freshSave, type SaveData, type SavedDeck } from '../src/meta/SaveManager';
import { variantKey, type FrameStyle, type HoloFinish } from '../src/meta/variants';

type Fixture = { name: string; save: SaveData };

const NOW = Date.UTC(2026, 8, 10, 12, 0, 0);
const json = process.argv.includes('--json');

// ---------- the 1.5 fixture matrix (kept in shape) ---------------------------

function replay(index: number): SaveData['replays'][number] {
  return {
    v: 2,
    dbStamp: '0.00000000',
    seed: 4800 + index,
    decks: [['stress-card-a'], ['stress-card-b']],
    context: {
      mode: 'practice',
      difficulty: 'easy',
      opponentId: null,
      opponentName: 'Measurement opponent',
      gauntletRung: null,
    },
    actions: [{ p: 0, a: { type: 'passStep' } }],
    result: index % 2 === 0 ? 'win' : 'loss',
    endedAt: NOW + index,
    turns: 1,
  };
}

function legacyDeck(id: string, name: string, cards: string[], landStyle: SavedDeck['landStyle'] = null): SavedDeck {
  return { id, name, cards, heroCardId: null, landStyle };
}

function fixtureMatrix(): Fixture[] {
  const collection = freshSave(NOW + 1);
  collection.gold = 1250;
  for (let i = 0; i < 80; i++) {
    const id = `matrix-card-${i}`;
    collection.collection[id] = (i % 4) + 1;
    collection.collectionVariants[id] = { 'white|none|false': (i % 4) + 1 };
  }

  const progress = freshSave(NOW + 2);
  progress.gold = 9876;
  progress.stats.wins = 42;
  progress.stats.losses = 19;
  progress.gauntlet.bestRung = 12;
  progress.gauntlet.completions = 2;
  progress.replays = [replay(0), replay(1), replay(2)];
  progress.decks = Array.from({ length: 6 }, (_, i) =>
    legacyDeck(`matrix-deck-${i}`, `Matrix deck ${i}`, [`matrix-card-${i}`, `matrix-card-${i + 1}`]),
  );

  const stress = freshSave(NOW + 3);
  stress.gold = 999999;
  for (let i = 0; i < 5000; i++) {
    const id = `stress-card-${i}`;
    const count = (i % 4) + 1;
    stress.collection[id] = count;
    stress.collectionVariants[id] = { 'white|none|false': count };
  }
  stress.decks = Array.from({ length: 48 }, (_, i) =>
    legacyDeck(
      `stress-deck-${i}`,
      `Stress deck ${i}`,
      Array.from({ length: 60 }, (_, k) => `stress-card-${(i * 60 + k) % 5000}`),
      i % 2 === 0 ? { 'land-forest': 'dark-tales' } : null,
    ),
  );
  stress.replays = Array.from({ length: REPLAY_CAP }, (_, i) => replay(i));

  return [
    { name: 'fresh save', save: freshSave(NOW) },
    { name: 'fixture: collection (80 cards)', save: collection },
    { name: 'fixture: progress and 3 replays', save: progress },
    { name: 'stress: 5,000 cards, 48 decks, max replays', save: stress },
  ];
}

// ---------- real-catalog profiles (T0, 2026-09-10) ---------------------------

const collectible = ALL_CARDS.filter((c) => !c.token).map((c) => c.id);
const nonLand = ALL_CARDS.filter((c) => !c.token && !c.types.includes('land')).map((c) => c.id);
const FRAMES: FrameStyle[] = ['blue', 'red', 'gold', 'rainbow', 'black'];
const HOLOS: HoloFinish[] = ['shiny', 'rainbow', 'pearlescent', 'fractal', 'void'];

function warchestDeck(i: number): SavedDeck {
  const cards = Array.from({ length: 40 }, (_, k) => nonLand[(i * 97 + k * 13) % nonLand.length]);
  return {
    ...legacyDeck(`deck-${i}`, `Deck ${i}`, cards),
    format: i % 3 === 2 ? 'darlings' : 'warchest',
    darlingId: null,
    landReserve: Array.from({ length: 10 }, (_, k) => (k % 2 ? 'basic-forest' : 'basic-island')),
    variantPins: cards.map(() => null),
  } as SavedDeck;
}

function catalogProfile(name: string, distinct: number, copies: number, variantEvery: number, decks: number, replays: number): Fixture {
  const save = freshSave(NOW + 4);
  for (const [i, id] of collectible.slice(0, distinct).entries()) {
    save.collection[id] = copies;
    if (variantEvery > 0 && i % variantEvery === 0) {
      const key = variantKey({ frame: FRAMES[i % FRAMES.length], holo: HOLOS[i % HOLOS.length], fullArt: i % 7 === 0 });
      save.collectionVariants[id] = { [key]: 1 };
    }
  }
  save.decks = Array.from({ length: decks }, (_, i) => warchestDeck(i));
  save.activeDeckId = decks ? 'deck-0' : null;
  save.replays = Array.from({ length: replays }, (_, i) => replay(i));
  save.gold = 12_345;
  save.tutorialDone = true;
  save.stats.wins = 300;
  save.stats.losses = 180;
  save.stats.packsOpened = 250;
  return { name, save };
}

const fixtures: Fixture[] = [
  ...fixtureMatrix(),
  catalogProfile('catalog: mid-game (200 distinct x2, 10% variants, 5 decks, 3 replays)', 200, 2, 10, 5, 3),
  catalogProfile(`catalog: veteran (all ${collectible.length} x4, 25% variants, 20 decks, max replays)`, collectible.length, 4, 4, 20, REPLAY_CAP),
];

// ---------- measurement ------------------------------------------------------

function rawJsonBytes(save: SaveData, includeReplays: boolean): number {
  const copy = JSON.parse(JSON.stringify(save)) as Record<string, unknown>;
  if (!includeReplays) delete copy.replays;
  return strToU8(JSON.stringify(copy)).length;
}

function deflatedBytes(code: string): number {
  const envelopeJson = Buffer.from(code.slice('DBS1-'.length).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const envelope = JSON.parse(envelopeJson) as { payload: string };
  return Math.round((envelope.payload.length * 3) / 4);
}

const rows = fixtures.map((f) => {
  const without = encode(f.save, { includeReplays: false });
  const withReplays = encode(f.save, { includeReplays: true });
  const rawWithout = rawJsonBytes(f.save, false);
  return {
    profile: f.name,
    rawBytes: rawWithout,
    deflatedBytes: deflatedBytes(without),
    codeChars: without.length,
    rawBytesWithReplays: rawJsonBytes(f.save, true),
    codeCharsWithReplays: withReplays.length,
    shareOfLimit: `${((rawWithout / MAX_DECODED_SAVE_BYTES) * 100).toFixed(1)}%`,
    roundTrip: decode(without).ok ? 'ok' : 'FAILED',
  };
});

if (json) {
  console.log(JSON.stringify({ measuredAt: new Date(NOW).toISOString(), maxDecodedSaveBytes: MAX_DECODED_SAVE_BYTES, replayCap: REPLAY_CAP, rows }, null, 2));
} else {
  console.log('SaveCode size measurement. Code length includes the visible DBS1- envelope; raw JSON is UTF-8 bytes. No QR-fit claim is made.');
  console.log(`MAX_DECODED_SAVE_BYTES = ${MAX_DECODED_SAVE_BYTES}, REPLAY_CAP = ${REPLAY_CAP}`);
  console.table(rows);
}
