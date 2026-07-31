import { strToU8 } from 'fflate';
import { encode } from '../src/meta/SaveCode';
import { REPLAY_CAP } from '../src/meta/Replay';
import { freshSave, type SaveData } from '../src/meta/SaveManager';

type Fixture = { name: string; save: SaveData };

const NOW = 1_700_000_000_000;

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

function currentFixtureMatrix(): Fixture[] {
  const fresh = freshSave(NOW);

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
  progress.decks = Array.from({ length: 6 }, (_, index) => ({
    id: `matrix-deck-${index}`,
    name: `Matrix deck ${index}`,
    cards: [`matrix-card-${index}`, `matrix-card-${index + 1}`],
    heroCardId: null,
    landStyle: null,
  }));

  return [
    { name: 'fresh save', save: fresh },
    { name: 'current fixture: collection', save: collection },
    { name: 'current fixture: progress and replays', save: progress },
  ];
}

function stressFixture(): Fixture {
  const save = freshSave(NOW + 3);
  save.gold = 999999;
  for (let i = 0; i < 5000; i++) {
    const id = `stress-card-${i}`;
    const count = (i % 4) + 1;
    save.collection[id] = count;
    save.collectionVariants[id] = { 'white|none|false': count };
  }
  save.decks = Array.from({ length: 48 }, (_, index) => ({
    id: `stress-deck-${index}`,
    name: `Stress deck ${index}`,
    cards: Array.from({ length: 60 }, (_, cardIndex) => `stress-card-${(index * 60 + cardIndex) % 5000}`),
    heroCardId: null,
    landStyle: index % 2 === 0 ? { 'land-forest': 'dark-tales' } : null,
  }));
  save.replays = Array.from({ length: REPLAY_CAP }, (_, index) => replay(index));
  return { name: 'synthetic stress: 5,000 cards, 48 decks, max replays', save };
}

function rawJsonBytes(save: SaveData, includeReplays: boolean): number {
  const copy = JSON.parse(JSON.stringify(save)) as Record<string, unknown>;
  if (!includeReplays) delete copy.replays;
  return strToU8(JSON.stringify(copy)).length;
}

function measure(fixture: Fixture, includeReplays: boolean): { raw: number; code: number } {
  return {
    raw: rawJsonBytes(fixture.save, includeReplays),
    code: encode(fixture.save, { includeReplays }).length,
  };
}

const fixtures = [...currentFixtureMatrix(), stressFixture()];
console.log('SaveCode size measurement. Code length includes the visible DBS1- envelope.');
console.log('Raw JSON is UTF-8 bytes. No QR-fit claim is made by this measurement.');
console.log('Fixture | Raw JSON bytes without replays | Code chars without replays | Raw JSON bytes with replays | Code chars with replays');
for (const fixture of fixtures) {
  const without = measure(fixture, false);
  const withReplays = measure(fixture, true);
  console.log(`${fixture.name} | ${without.raw} | ${without.code} | ${withReplays.raw} | ${withReplays.code}`);
}
