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
    expect(manager.data.version).toBe(21);
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
    expect(manager.data.version).toBe(21);
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
    expect(manager.data.version).toBe(21);
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
    expect(manager.data.version).toBe(21);
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

    expect(manager.data.version).toBe(21);
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
