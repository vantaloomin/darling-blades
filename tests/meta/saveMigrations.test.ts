import { describe, expect, it } from 'vitest';
import { freshSave, SaveManager } from '../../src/meta/SaveManager';
import { parseVariantKey, PLAIN_VARIANT, variantKey } from '../../src/meta/variants';

function fakeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => void raw.set(key, value),
    removeItem: (key) => void raw.delete(key),
  };
}

describe('SaveData v19 migration', () => {
  it('migrates a v18 blob with no weekly allowance to zero entries', () => {
    const storage = fakeStorage();
    const old = freshSave(123);
    const oldLimited = { ...old.limited } as Record<string, unknown>;
    delete oldLimited.premiumWeek;
    storage.raw.set('darlingblades.save.v1', JSON.stringify({ ...old, version: 18, limited: oldLimited }));

    const manager = new SaveManager(storage, 456);
    expect(manager.data.version).toBe(22);
    expect(manager.data.limited.premiumWeek).toEqual({ week: 0, entries: 0 });
    expect(manager.data.createdAt).toBe(123);
  });

  it('normalizes a malformed v19 allowance without wiping the rest of the save', () => {
    const storage = fakeStorage();
    const current = freshSave(123);
    current.gold = 777;
    storage.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({ ...current, limited: { ...current.limited, premiumWeek: { week: 'bad', entries: -4 } } }),
    );

    const manager = new SaveManager(storage, 456);
    expect(manager.data.version).toBe(22);
    expect(manager.data.gold).toBe(777);
    expect(manager.data.limited.premiumWeek).toEqual({ week: 0, entries: 0 });
  });
});

describe('SaveData v20 migration (deterministic replays)', () => {
  it('migrates a v19 blob to an empty replay reel without touching the rest', () => {
    const storage = fakeStorage();
    const old = freshSave(123) as unknown as Record<string, unknown>;
    delete old.replays;
    old.gold = 555;
    storage.raw.set('darlingblades.save.v1', JSON.stringify({ ...old, version: 19 }));

    const manager = new SaveManager(storage, 456);
    expect(manager.data.version).toBe(22);
    expect(manager.data.replays).toEqual([]);
    expect(manager.data.gold).toBe(555);
    expect(manager.data.createdAt).toBe(123);
  });

  it('drops malformed replay entries on load instead of crashing', () => {
    const storage = fakeStorage();
    const current = freshSave(123);
    storage.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({
        ...current,
        replays: [{ v: 99, junk: true }, 'garbage', null],
      }),
    );

    const manager = new SaveManager(storage, 456);
    expect(manager.data.version).toBe(22);
    expect(manager.data.replays).toEqual([]);
  });
});

describe('SaveData v21 migration (Full Art variant axis)', () => {
  it('rewrites v20 two-part variant keys as non-full-art without changing counts', () => {
    const storage = fakeStorage();
    const old = freshSave(123);
    old.collection.bear = 3;
    old.collectionVariants.bear = { 'white|none': 2, 'gold|void': 1 };
    storage.raw.set('darlingblades.save.v1', JSON.stringify({ ...old, version: 20 }));

    const manager = new SaveManager(storage, 456);

    expect(manager.data.version).toBe(22);
    expect(manager.data.collection.bear).toBe(3);
    expect(manager.data.collectionVariants.bear).toEqual({
      [variantKey(PLAIN_VARIANT)]: 2,
      [variantKey({ frame: 'gold', holo: 'void', fullArt: false })]: 1,
    });
    expect(Object.keys(manager.data.collectionVariants.bear).map(parseVariantKey)).toEqual([
      PLAIN_VARIANT,
      { frame: 'gold', holo: 'void', fullArt: false },
    ]);
  });
});

describe('SaveData v22 migration (tower roster and deck land style)', () => {
  it('preserves an active v21 run with the legacy roster sentinel and defaults saved decks', () => {
    const storage = fakeStorage();
    const old = freshSave(123);
    const oldRun = { rung: 7, startedAt: 111, seed: 222 };
    const oldDecks = [
      { id: 'deck-1', name: 'First', cards: ['bear'], heroCardId: 'bear' },
      { id: 'deck-2', name: 'Second', cards: ['wolf'], heroCardId: null },
    ];
    storage.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({
        ...old,
        version: 21,
        decks: oldDecks,
        gauntlet: { ...old.gauntlet, run: oldRun },
      }),
    );

    const manager = new SaveManager(storage, 456);

    expect(manager.data.version).toBe(22);
    expect(manager.data.gauntlet.run).toEqual({ ...oldRun, rosterDay: 0, rosterSeed: 0 });
    expect(manager.data.decks).toEqual(oldDecks.map((deck) => ({ ...deck, landStyle: null })));
    expect(manager.data.createdAt).toBe(123);
  });

  it('creates fresh saves at v22', () => {
    expect(freshSave(123).version).toBe(22);
  });

  it('stamps an unstamped active v22 run from the UI staging gap', () => {
    const storage = fakeStorage();
    const current = freshSave(123);
    const run = { rung: 2, startedAt: 111, seed: 222 };
    storage.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({ ...current, gauntlet: { ...current.gauntlet, run } }),
    );

    const manager = new SaveManager(storage, 456);

    expect(manager.data.gauntlet.run).toEqual({ ...run, rosterDay: 0, rosterSeed: 0 });
  });

  it('coerces the interim v22 string land style to the default', () => {
    const storage = fakeStorage();
    const current = freshSave(123);
    storage.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({
        ...current,
        decks: [
          {
            id: 'interim',
            name: 'Interim',
            cards: ['land-forest'],
            heroCardId: null,
            landStyle: 'celtic-fae',
          },
          {
            id: 'mapped',
            name: 'Mapped',
            cards: ['land-plains', 'land-forest'],
            heroCardId: null,
            landStyle: { 'land-plains': 'base', 'land-forest': 'celtic-fae' },
          },
        ],
      }),
    );

    const manager = new SaveManager(storage, 456);

    expect(manager.data.version).toBe(22);
    expect(manager.data.decks[0].landStyle).toBeNull();
    expect(manager.data.decks[1].landStyle).toEqual({
      'land-plains': 'base',
      'land-forest': 'celtic-fae',
    });
  });
});
