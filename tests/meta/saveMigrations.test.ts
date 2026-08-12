import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { STARTER_DECKS, THEME_DECKS } from '../../src/data/starterDecks';
import { deckHealth } from '../../src/meta/deckRepair';
import { grantDeckCards } from '../../src/meta/Economy';
import { startDraftRun } from '../../src/meta/Limited';
import { CURRENT_SAVE_VERSION, freshSave, SaveManager, type SaveData } from '../../src/meta/SaveManager';
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

describe('SaveData v27 migration (deck repair acknowledgement)', () => {
  it('preserves invalid decks and their active id while starting the acknowledgement empty', () => {
    const storage = fakeStorage();
    const old = freshSave(123) as unknown as Record<string, unknown>;
    old.version = 26;
    old.deckRepairNoticeAck = '["should-not-survive"]';
    old.activeDeckId = 'legacy-warchest';
    const cards = [...Array.from({ length: 49 }, () => 'gk-athena'), 'unknown-card-id'];
    const reserve = [
      'gk-athena',
      ...Array.from({ length: 6 }, () => 'ld-misty-palace-terrace'),
      'land-plains',
      'unknown-reserve-id',
      42,
    ];
    old.decks = [{
      id: 'legacy-warchest',
      name: 'Legacy Warchest',
      cards,
      heroCardId: null,
      landStyle: null,
      format: 'warchest',
      darlingId: null,
      landReserve: reserve,
      variantPins: cards.map(() => null),
    }];
    storage.raw.set('darlingblades.save.v1', JSON.stringify(old));

    const migrated = new SaveManager(storage, 456).data;

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.activeDeckId).toBe('legacy-warchest');
    expect(migrated.decks[0].cards).toEqual(cards);
    expect(migrated.decks[0].landReserve).toEqual([
      'gk-athena',
      ...Array.from({ length: 6 }, () => 'ld-misty-palace-terrace'),
      'land-plains',
    ]);
    expect(migrated.deckRepairNoticeAck).toBe('[]');
  });

  it('retains and canonicalizes a current-version acknowledgement', () => {
    const storage = fakeStorage();
    const current = freshSave(123) as unknown as Record<string, unknown>;
    current.deckRepairNoticeAck = '["deck-z","deck-a","deck-a"]';
    storage.raw.set('darlingblades.save.v1', JSON.stringify(current));

    expect(new SaveManager(storage, 456).data.deckRepairNoticeAck).toBe('["deck-a","deck-z"]');
  });
});

describe('SaveData v28 migration (classic retirement)', () => {
  const starter = STARTER_DECKS[0];
  const theme = THEME_DECKS[0];

  function grantedDeck(source: { id: string; name: string; cards: string[] }, cards = source.cards) {
    return {
      id: source.id,
      name: source.name,
      cards: [...cards],
      heroCardId: null,
      landStyle: null,
      format: 'constructed',
      darlingId: null,
      landReserve: null,
      variantPins: cards.map(() => null),
    };
  }

  function migrateWithDecks(
    decks: unknown[],
    activeDeckId: string,
    base?: Record<string, unknown>,
  ) {
    const storage = fakeStorage();
    const old = base ?? (freshSave(123) as unknown as Record<string, unknown>);
    old.version = 27;
    old.decks = decks;
    old.activeDeckId = activeDeckId;
    storage.raw.set('darlingblades.save.v1', JSON.stringify(old));
    return new SaveManager(storage, 456).data;
  }

  it('converts an untouched granted starter and theme deck to their shipped reserve builds', () => {
    const migrated = migrateWithDecks(
      [grantedDeck(starter), grantedDeck(theme)],
      starter.id,
    );

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.activeDeckId).toBe(starter.id);
    const [converted, convertedTheme] = migrated.decks;
    expect(converted.format).toBe('warchest');
    expect(converted.cards).toEqual(starter.reserveCards);
    expect(converted.landReserve).toEqual(starter.landReserve);
    // Pins are index-aligned to `cards`, so the resized list must carry a
    // fresh null pin per slot rather than the old 60-slot array.
    expect(converted.variantPins).toHaveLength(starter.reserveCards?.length ?? 0);
    expect(convertedTheme.format).toBe('warchest');
    expect(convertedTheme.cards).toEqual(theme.reserveCards);
  });

  it('leaves an edited granted deck and a player-built deck classic for the fix-it flow', () => {
    const edited = [...starter.cards];
    edited[0] = 'gk-athena';
    const homebrew = {
      ...grantedDeck({ id: 'deck-1', name: 'Homebrew', cards: [...starter.cards] }),
    };

    const migrated = migrateWithDecks([grantedDeck(starter, edited), homebrew], 'deck-1');

    expect(migrated.decks[0].format).toBe('constructed');
    expect(migrated.decks[0].cards).toEqual(edited);
    // Same 60 cards as the shipped starter, but under a player-created id, so
    // there is no shipped source to convert it to.
    expect(migrated.decks[1].format).toBe('constructed');
    expect(migrated.decks[1].cards).toEqual(starter.cards);
    expect(migrated.activeDeckId).toBe('deck-1');
  });

  it.each([STARTER_DECKS[0], STARTER_DECKS[3], THEME_DECKS[0], THEME_DECKS[4]])(
    'leaves $id playable after conversion, not merely converted',
    (source) => {
      // The bug this pins: converting alone is not enough. A pre-retirement
      // player owns the CLASSIC build's cards, and the reserve build needs
      // cards classic never granted - higher counts of the same card, and for
      // theme decks whole cards from other sets. Measured 2026-08-10: without
      // the migration's grant every converted deck came out blocked on
      // ownership, which is the exact repair prompt the auto-convert exists to
      // avoid.
      const fresh = freshSave(123) as unknown as Record<string, unknown>;
      const granted = fresh as unknown as SaveData;
      grantDeckCards(granted, CARD_DB, source.cards);
      const migrated = migrateWithDecks([grantedDeck(source)], source.id, fresh);

      const deck = migrated.decks[0];
      expect(deck.format).toBe('warchest');
      const health = deckHealth(CARD_DB, migrated, deck);
      expect(health.issues.filter((issue) => issue.kind === 'error')).toEqual([]);
      expect(health.blocked).toBe(false);
    },
  );

  it('tops the collection up to the deck requirement without overshooting it', () => {
    const source = STARTER_DECKS[0];
    const fresh = freshSave(123) as unknown as Record<string, unknown>;
    grantDeckCards(fresh as unknown as SaveData, CARD_DB, source.cards);
    const migrated = migrateWithDecks([grantedDeck(source)], source.id, fresh);

    // The grant is a top-up, so no card ends up above what the deck runs.
    const need = new Map<string, number>();
    for (const id of [...migrated.decks[0].cards, ...(migrated.decks[0].landReserve ?? [])]) {
      need.set(id, (need.get(id) ?? 0) + 1);
    }
    for (const [id, count] of need) {
      if (CARD_DB[id].supertypes?.includes('basic')) continue;
      expect(migrated.collection[id]).toBe(count);
    }
  });

  it('is idempotent, so reloading a converted save never re-converts or drifts', () => {
    const first = migrateWithDecks([grantedDeck(starter)], starter.id);

    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(first));
    const second = new SaveManager(storage, 789).data;

    expect(second.decks[0]).toEqual(first.decks[0]);
    expect(second.version).toBe(CURRENT_SAVE_VERSION);
  });
});

describe('SaveData v29 migration (Limited Warchest assignments)', () => {
  it('preserves an active Limited run while adding the new optional reserve fields', () => {
    const storage = fakeStorage();
    const now = 123;
    const activeRun = startDraftRun(CARD_DB, 2901, now);
    const old = freshSave(now) as unknown as Record<string, unknown>;
    old.version = 28;
    old.limited = { ...freshSave(now).limited, activeRun };
    storage.raw.set('darlingblades.save.v1', JSON.stringify(old));

    const migrated = new SaveManager(storage, 456).data;

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.limited.activeRun).toEqual(activeRun);
  });
});
