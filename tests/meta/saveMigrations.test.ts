import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION, freshSave, SaveManager } from '../../src/meta/SaveManager';
import { parseVariantKey, PLAIN_VARIANT, variantKey } from '../../src/meta/variants';

const LEGACY_WARCHEST_FORMAT = 'battle' + 'box';

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
    expect(manager.data.version).toBe(CURRENT_SAVE_VERSION);
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
    expect(manager.data.version).toBe(CURRENT_SAVE_VERSION);
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
    expect(manager.data.version).toBe(CURRENT_SAVE_VERSION);
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
    expect(manager.data.version).toBe(CURRENT_SAVE_VERSION);
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

    expect(manager.data.version).toBe(CURRENT_SAVE_VERSION);
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

    expect(manager.data.version).toBe(CURRENT_SAVE_VERSION);
    expect(manager.data.gauntlet.run).toEqual({ ...oldRun, rosterDay: 0, rosterSeed: 0 });
    expect(manager.data.decks).toEqual(oldDecks.map((deck) => ({
      ...deck,
      landStyle: null,
      format: 'constructed',
      darlingId: null,
      landReserve: null,
      variantPins: [null],
    })));
    expect(manager.data.createdAt).toBe(123);
  });

  it('creates fresh saves at the current version', () => {
    expect(freshSave(123).version).toBe(CURRENT_SAVE_VERSION);
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
            landStyle: { 'land-plains': 'dark-tales', 'land-forest': 'celtic-fae' },
          },
        ],
      }),
    );

    const manager = new SaveManager(storage, 456);

    expect(manager.data.version).toBe(CURRENT_SAVE_VERSION);
    expect(manager.data.decks[0].landStyle).toBeNull();
    expect(manager.data.decks[1].landStyle).toEqual({
      'land-plains': 'dark-tales',
      'land-forest': 'celtic-fae',
    });
  });

  it('round-trips a dark-tales selection through the current v22 save shape', () => {
    const storage = fakeStorage();
    const current = freshSave(123);
    current.decks = [{
      id: 'dark-tales-deck',
      name: 'Storybook',
      cards: ['land-plains'],
      heroCardId: null,
      landStyle: { 'land-plains': 'dark-tales' },
    }];
    storage.raw.set('darlingblades.save.v1', JSON.stringify(current));

    const manager = new SaveManager(storage, 456);

    expect(manager.data.version).toBe(CURRENT_SAVE_VERSION);
    expect(manager.data.decks[0].landStyle).toEqual({ 'land-plains': 'dark-tales' });
  });
});

describe('SaveData v23 migration (formats, reserves, and positional variant pins)', () => {
  it('adds v23 defaults without reordering cards and normalizes malformed new fields', () => {
    const storage = fakeStorage();
    const old = freshSave(123) as unknown as Record<string, unknown>;
    old.version = 22;
    old.collection = { bear: 3 };
    old.collectionVariants = {
      bear: {
        'blue|none|standard': 2,
        'gold|void|full-art': 1,
      },
    };
    old.decks = [{
      id: 'mixed',
      name: 'Mixed',
      cards: ['bear', 'bear', 'bear', 'wolf'],
      heroCardId: 'wolf',
      landStyle: null,
      format: 'darlings',
      darlingId: 'missing-from-cards',
      landReserve: ['land-plains', 'not-a-card', 'bear', 'land-forest'],
      variantPins: [
        'blue|none|false',
        'blue|none|standard',
        'blue|none|standard',
        'not-a-variant',
        'gold|void|full-art',
      ],
    }];
    storage.raw.set('darlingblades.save.v1', JSON.stringify(old));

    const migrated = new SaveManager(storage, 456).data;

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.decks[0]).toMatchObject({
      cards: ['bear', 'bear', 'bear', 'wolf'],
      format: 'darlings',
      darlingId: null,
      landReserve: ['land-plains', 'land-forest'],
      variantPins: [
        variantKey({ frame: 'blue', holo: 'none', fullArt: false }),
        variantKey({ frame: 'blue', holo: 'none', fullArt: false }),
        null,
        null,
      ],
    });
    expect(migrated.decks[0].heroCardId).toBe('wolf');
  });

  it('coerces unknown formats, clears non-Darling fields, and pads or trims pins', () => {
    const storage = fakeStorage();
    const current = freshSave(123) as unknown as Record<string, unknown>;
    current.version = CURRENT_SAVE_VERSION;
    current.decks = [{
      id: 'malformed',
      name: 'Malformed',
      cards: ['bear', 'wolf'],
      heroCardId: null,
      landStyle: null,
      format: 'future-format',
      darlingId: 'bear',
      landReserve: ['land-plains'],
      variantPins: ['white|none|standard', 'white|none|standard', 'extra'],
    }];
    storage.raw.set('darlingblades.save.v1', JSON.stringify(current));

    const migrated = new SaveManager(storage, 456).data;

    expect(migrated.decks[0]).toMatchObject({
      format: 'constructed',
      darlingId: null,
      landReserve: null,
      variantPins: [null, null],
    });
  });
});

describe('SaveData v25 migration (Warchest and collection display pins)', () => {
  it('migrates a v24 Warchest deck, keeps its active deck id, and starts collection pins empty', () => {
    const storage = fakeStorage();
    const old = freshSave(123) as unknown as Record<string, unknown>;
    old.version = 24;
    old.activeDeckId = 'legacy-warchest';
    old.decks = [{
      id: 'legacy-warchest',
      name: 'Legacy Warchest',
      cards: ['bear'],
      heroCardId: null,
      landStyle: null,
      format: LEGACY_WARCHEST_FORMAT,
      darlingId: null,
      landReserve: Array.from({ length: 10 }, () => 'land-plains'),
      variantPins: [null],
    }];
    storage.raw.set('darlingblades.save.v1', JSON.stringify(old));

    const migrated = new SaveManager(storage, 456).data;

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.decks[0].format).toBe('warchest');
    expect(migrated.activeDeckId).toBe('legacy-warchest');
    expect(migrated.pinnedVariants).toEqual({});
  });

  it('drops malformed, unknown, or unowned collection display pins while retaining owned canonical pins', () => {
    const storage = fakeStorage();
    const current = freshSave(123);
    current.collection = { 'land-plains': 1 };
    current.collectionVariants = { 'land-plains': { [variantKey(PLAIN_VARIANT)]: 1 } };
    current.pinnedVariants = {
      'land-plains': 'white|none|standard',
      'land-forest': 'purple|none|standard',
      'land-island': 'white|none|invalid-treatment',
      'land-swamp': 'white|none|standard',
      'not-a-card': 'white|none|standard',
    };
    storage.raw.set('darlingblades.save.v1', JSON.stringify(current));

    const migrated = new SaveManager(storage, 456).data;

    expect(migrated.pinnedVariants).toEqual({
      'land-plains': variantKey(PLAIN_VARIANT),
    });
  });
});

describe('SaveData v26 migration (Darlings command zone tutorial)', () => {
  it('pulls a legacy in-deck Darling and its positional pin into the external identity', () => {
    const storage = fakeStorage();
    const old = freshSave(123) as unknown as Record<string, unknown>;
    old.version = 25;
    old.decks = [{
      id: 'legacy-darlings',
      name: 'Legacy Darlings',
      cards: ['gk-athena', 'land-plains'],
      heroCardId: null,
      landStyle: null,
      format: 'darlings',
      darlingId: 'gk-athena',
      landReserve: Array.from({ length: 10 }, () => 'land-plains'),
      variantPins: ['gold|void|standard', 'white|none|standard'],
    }];
    storage.raw.set('darlingblades.save.v1', JSON.stringify(old));

    const migrated = new SaveManager(storage, 456).data;

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.darlingsTutorialSeen).toBe(false);
    expect(migrated.darlingsFreeDeckClaimed).toBe(false);
    expect(migrated.decks[0]).toMatchObject({
      cards: ['land-plains'],
      darlingId: 'gk-athena',
      variantPins: [null],
    });
  });

  it('keeps v26 normalization strict about the tutorial flag and external Darling card list', () => {
    const storage = fakeStorage();
    const current = freshSave(123) as unknown as Record<string, unknown>;
    current.darlingsTutorialSeen = 'yes';
    current.darlingsFreeDeckClaimed = 'yes';
    current.decks = [{
      id: 'current-darlings',
      name: 'Current Darlings',
      cards: ['gk-athena', 'land-plains'],
      heroCardId: null,
      landStyle: null,
      format: 'darlings',
      darlingId: 'gk-athena',
      landReserve: Array.from({ length: 10 }, () => 'land-plains'),
      variantPins: [null, null],
    }];
    storage.raw.set('darlingblades.save.v1', JSON.stringify(current));

    const migrated = new SaveManager(storage, 456).data;

    expect(migrated.darlingsTutorialSeen).toBe(false);
    expect(migrated.darlingsFreeDeckClaimed).toBe(false);
    expect(migrated.decks[0].cards).toEqual(['land-plains']);
    expect(migrated.decks[0].variantPins).toEqual([null]);
  });

  it('preserves the Darlings tutorial acknowledgement and Zhou Yu claim on a current save', () => {
    const storage = fakeStorage();
    const current = freshSave(123);
    current.darlingsTutorialSeen = true;
    current.darlingsFreeDeckClaimed = true;
    storage.raw.set('darlingblades.save.v1', JSON.stringify(current));

    const migrated = new SaveManager(storage, 456).data;

    expect(migrated.darlingsTutorialSeen).toBe(true);
    expect(migrated.darlingsFreeDeckClaimed).toBe(true);
  });
});
