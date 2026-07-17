import { describe, expect, it } from 'vitest';
import type { CardDef } from '../../src/engine/types';
import {
  applyFilters,
  clampPage,
  collectionCompletion,
  collectiblePool,
  defaultFilterState,
  matchesSearch,
  nextSortMode,
  ownedVariantEntries,
  pageCount,
  pageSlice,
  specialVariantCount,
  variantLabel,
  type CollectionFilterState,
} from '../../src/meta/collectionFilter';
import { freshSave, type SaveData } from '../../src/meta/SaveManager';
import { PLAIN_VARIANT, variantKey } from '../../src/meta/variants';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function card(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id,
    name: id,
    types: ['creature'],
    subtypes: [],
    colors: ['G'],
    rarity: 'c',
    cost: { generic: 1, pips: { G: 1 } },
    attack: 1,
    defense: 1,
    ...over,
  };
}

const POOL: CardDef[] = [
  card('g_bear', { name: 'Bear' }), // G creature, c, mv2
  card('g_giant', { name: 'Giant', cost: { generic: 3, pips: { G: 1 } }, rarity: 'r' }), // mv4
  card('w_knight', { name: 'Knight', colors: ['W'], cost: { generic: 1, pips: { W: 1 } } }),
  card('u_bolt', { name: 'Bolt', types: ['charm'], colors: ['U'], cost: { generic: 0, pips: { U: 1 } }, attack: undefined, defense: undefined, rarity: 'sr' }), // mv1
  card('b_rite', { name: 'Rite', types: ['ritual'], colors: ['B'], cost: { generic: 2, pips: { B: 1 } }, attack: undefined, defense: undefined, rarity: 'ur' }), // mv3
  card('gw_aura', { name: 'Aura', types: ['enchantment'], colors: ['G', 'W'], cost: { generic: 0, pips: { G: 1, W: 1 } }, attack: undefined, defense: undefined, rarity: 'ssr' }), // mv2
  card('dual_land', { name: 'Grove', types: ['land'], colors: [], cost: undefined, attack: undefined, defense: undefined, rarity: 'r' }), // mv0
];

function saveWith(collection: Record<string, number>): SaveData {
  const save = freshSave(0);
  save.collection = { ...collection };
  return save;
}

// ---------------------------------------------------------------------------

describe('collectiblePool', () => {
  it('excludes tokens and basic lands', () => {
    const all = [
      ...POOL,
      card('tok', { token: true }),
      card('forest', { types: ['land'], supertypes: ['basic'], cost: undefined }),
    ];
    expect(collectiblePool(all).map((d) => d.id)).toEqual(POOL.map((d) => d.id));
  });
});

describe('applyFilters facets', () => {
  const save = saveWith({ g_bear: 2, u_bolt: 1 });
  const state = (over: Partial<CollectionFilterState>): CollectionFilterState => ({
    ...defaultFilterState(),
    ...over,
  });

  it('default state returns the whole pool (rarity-sorted)', () => {
    expect(applyFilters(POOL, defaultFilterState(), save)).toHaveLength(POOL.length);
  });

  it('color facet matches any of the card colors (multicolor included)', () => {
    const w = applyFilters(POOL, state({ color: 'W' }), save).map((d) => d.id);
    expect(w.sort()).toEqual(['gw_aura', 'w_knight']);
  });

  it('type facet', () => {
    expect(applyFilters(POOL, state({ type: 'charm' }), save).map((d) => d.id)).toEqual([
      'u_bolt',
    ]);
    expect(applyFilters(POOL, state({ type: 'land' }), save).map((d) => d.id)).toEqual([
      'dual_land',
    ]);
  });

  it('rarity facet', () => {
    const r = applyFilters(POOL, state({ rarity: 'r' }), save).map((d) => d.id);
    expect(r.sort()).toEqual(['dual_land', 'g_giant']);
  });

  it('owned facet', () => {
    const owned = applyFilters(POOL, state({ ownedOnly: true }), save).map((d) => d.id);
    expect(owned.sort()).toEqual(['g_bear', 'u_bolt']);
  });

  it('facets combine with AND', () => {
    expect(
      applyFilters(POOL, state({ color: 'G', type: 'creature', ownedOnly: true }), save).map(
        (d) => d.id,
      ),
    ).toEqual(['g_bear']);
  });

  it('a facet combination can be empty', () => {
    expect(applyFilters(POOL, state({ color: 'U', type: 'land' }), save)).toEqual([]);
    expect(applyFilters(POOL, state({ rarity: 'ur', ownedOnly: true }), save)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const before = POOL.map((d) => d.id);
    applyFilters(POOL, state({ sort: 'name' }), save);
    expect(POOL.map((d) => d.id)).toEqual(before);
  });
});

describe('search facet (F8)', () => {
  const save = freshSave(0);
  const pool: CardDef[] = [
    card('bear', { name: 'Wildwood Bear', subtypes: ['Beastkin'] }),
    card('drake', { name: 'Storm Drake', subtypes: ['Dragon'], keywords: ['skyborne'] }),
    card('bolt', { name: 'Lightning Bolt', types: ['charm'], subtypes: [] }),
  ];
  const st = (search: string): CollectionFilterState => ({ ...defaultFilterState(), search });

  it("an empty (or whitespace) query matches everything", () => {
    expect(applyFilters(pool, st(''), save)).toHaveLength(3);
    expect(matchesSearch(pool[0], '   ')).toBe(true);
  });

  it('matches the card name, case-insensitively', () => {
    expect(applyFilters(pool, st('storm'), save).map((d) => d.id)).toEqual(['drake']);
    expect(applyFilters(pool, st('BOLT'), save).map((d) => d.id)).toEqual(['bolt']);
  });

  it('matches card type and subtype', () => {
    expect(applyFilters(pool, st('charm'), save).map((d) => d.id)).toEqual(['bolt']);
    expect(applyFilters(pool, st('beast'), save).map((d) => d.id)).toEqual(['bear']);
  });

  it('matches keyword enum values (sky → skyborne)', () => {
    expect(applyFilters(pool, st('sky'), save).map((d) => d.id)).toEqual(['drake']);
  });

  it('combines with other facets (AND) and can be empty', () => {
    expect(applyFilters(pool, { ...defaultFilterState(), search: 'dragon', color: 'G' }, save).map((d) => d.id)).toEqual([
      'drake',
    ]);
    expect(applyFilters(pool, st('nonexistentquery'), save)).toEqual([]);
  });
});

describe('set facet', () => {
  const save = freshSave(0);
  const pool: CardDef[] = [
    card('base_a'), // no set field → treated as base
    card('base_b', { set: 'base' }),
    card('rg_a', { set: 'ragnarok' }),
    card('rg_b', { set: 'ragnarok' }),
  ];
  const st = (set: CollectionFilterState['set']): CollectionFilterState => ({
    ...defaultFilterState(),
    set,
  });

  it("default 'all' returns every set", () => {
    expect(defaultFilterState().set).toBe('all');
    expect(applyFilters(pool, st('all'), save)).toHaveLength(4);
  });

  it("'ragnarok' returns only expansion cards", () => {
    expect(applyFilters(pool, st('ragnarok'), save).map((d) => d.id).sort()).toEqual([
      'rg_a',
      'rg_b',
    ]);
  });

  it("'base' excludes ragnarok and treats an absent set as base", () => {
    expect(applyFilters(pool, st('base'), save).map((d) => d.id).sort()).toEqual([
      'base_a',
      'base_b',
    ]);
  });
});

describe('sorting', () => {
  const save = freshSave(0);

  it('rarity sort: tier desc, then mana value, then name', () => {
    const ids = applyFilters(POOL, { ...defaultFilterState(), sort: 'rarity' }, save).map(
      (d) => d.id,
    );
    expect(ids).toEqual([
      'b_rite', // ur
      'gw_aura', // ssr
      'u_bolt', // sr
      'dual_land', // r, mv0
      'g_giant', // r, mv4
      'g_bear', // c, mv2 'Bear'
      'w_knight', // c, mv2 'Knight'
    ]);
  });

  it('mana sort: lands (no cost) lead at mv 0, names break ties', () => {
    const ids = applyFilters(POOL, { ...defaultFilterState(), sort: 'mana' }, save).map(
      (d) => d.id,
    );
    expect(ids).toEqual([
      'dual_land', // 0
      'u_bolt', // 1
      'gw_aura', // 2 'Aura'
      'g_bear', // 2 'Bear'
      'w_knight', // 2 'Knight'
      'b_rite', // 3
      'g_giant', // 4
    ]);
  });

  it('name sort is alphabetical with a deterministic id tiebreak', () => {
    const twins = [card('b_twin', { name: 'Twin' }), card('a_twin', { name: 'Twin' })];
    const ids = applyFilters(twins, { ...defaultFilterState(), sort: 'name' }, save).map(
      (d) => d.id,
    );
    expect(ids).toEqual(['a_twin', 'b_twin']);
  });

  it('sort mode cycles rarity → mana → name → rarity', () => {
    expect(nextSortMode('rarity')).toBe('mana');
    expect(nextSortMode('mana')).toBe('name');
    expect(nextSortMode('name')).toBe('rarity');
  });
});

describe('paging', () => {
  it('pageCount never reports zero pages', () => {
    expect(pageCount(0, 12)).toBe(1);
    expect(pageCount(1, 12)).toBe(1);
    expect(pageCount(12, 12)).toBe(1);
    expect(pageCount(13, 12)).toBe(2);
    expect(pageCount(200, 12)).toBe(17);
  });

  it('clampPage keeps the index in range as the pool shrinks', () => {
    expect(clampPage(5, 200, 12)).toBe(5);
    expect(clampPage(16, 200, 12)).toBe(16);
    expect(clampPage(17, 200, 12)).toBe(16);
    expect(clampPage(5, 3, 12)).toBe(0);
    expect(clampPage(-1, 200, 12)).toBe(0);
    expect(clampPage(3, 0, 12)).toBe(0);
  });

  it('pageSlice returns full and trailing partial pages', () => {
    const items = Array.from({ length: 15 }, (_, i) => i);
    expect(pageSlice(items, 0, 12)).toEqual(items.slice(0, 12));
    expect(pageSlice(items, 1, 12)).toEqual([12, 13, 14]);
    expect(pageSlice(items, 2, 12)).toEqual([]);
  });
});

describe('variant summaries', () => {
  it('specialVariantCount ignores plain and legacy copies', () => {
    const save = saveWith({ a: 3 }); // legacy aggregate, no variant record → plain
    expect(specialVariantCount(save, 'a')).toBe(0);

    save.collectionVariants.a = {
      [variantKey(PLAIN_VARIANT)]: 2,
      [variantKey({ frame: 'gold', holo: 'none', fullArt: false })]: 1,
      [variantKey({ frame: 'white', holo: 'shiny', fullArt: false })]: 2,
    };
    expect(specialVariantCount(save, 'a')).toBe(3);
    expect(specialVariantCount(save, 'missing')).toBe(0);
  });

  it('ownedVariantEntries sorts most-special first and synthesizes plain for legacy saves', () => {
    const save = saveWith({ a: 4, b: 2 });
    save.collectionVariants.a = {
      [variantKey(PLAIN_VARIANT)]: 2,
      [variantKey({ frame: 'black', holo: 'void', fullArt: false })]: 1,
      [variantKey({ frame: 'white', holo: 'shiny', fullArt: false })]: 1,
    };
    const entries = ownedVariantEntries(save, 'a');
    expect(entries.map((e) => variantKey(e.variant))).toEqual([
      'black|void|standard',
      'white|shiny|standard',
      'white|none|standard',
    ]);
    expect(entries.map((e) => e.count)).toEqual([1, 1, 2]);

    // card b has no variant record → one synthetic plain entry with the aggregate
    expect(ownedVariantEntries(save, 'b')).toEqual([{ variant: PLAIN_VARIANT, count: 2 }]);
    // unowned card → nothing
    expect(ownedVariantEntries(save, 'zzz')).toEqual([]);
  });

  it('variantLabel names both axes, either alone, and plain as Standard', () => {
    expect(variantLabel(PLAIN_VARIANT)).toBe('Standard');
    expect(variantLabel({ frame: 'gold', holo: 'void', fullArt: false })).toBe('Gold Frame · Void');
    expect(variantLabel({ frame: 'black', holo: 'none', fullArt: false })).toBe('Black Frame');
    expect(variantLabel({ frame: 'white', holo: 'pearlescent', fullArt: false })).toBe('Pearlescent');
    expect(variantLabel({ frame: 'white', holo: 'none', fullArt: true })).toBe('Full Art');
  });
});

describe('collectionCompletion', () => {
  it('summarizes owned cards by total, color, rarity, and variant chase counts', () => {
    const save = saveWith({ g_bear: 1, w_knight: 1, gw_aura: 2, dual_land: 1 });
    save.collectionVariants.g_bear = {
      [variantKey(PLAIN_VARIANT)]: 1,
      [variantKey({ frame: 'black', holo: 'none', fullArt: false })]: 1,
    };
    save.collectionVariants.gw_aura = {
      [variantKey({ frame: 'gold', holo: 'void', fullArt: false })]: 2,
    };

    const summary = collectionCompletion(POOL, save);

    expect(summary.total).toBe(POOL.length);
    expect(summary.owned).toBe(4);
    expect(summary.percent).toBeCloseTo(4 / POOL.length, 10);
    expect(summary.byColor.find((row) => row.key === 'G')).toMatchObject({
      owned: 2, // g_bear + gw_aura
      total: 3,
    });
    expect(summary.byColor.find((row) => row.key === 'W')).toMatchObject({
      owned: 2, // w_knight + gw_aura
      total: 2,
    });
    expect(summary.byRarity.find((row) => row.key === 'ssr')).toMatchObject({
      owned: 1,
      total: 1,
    });
    expect(summary.variants).toEqual({
      specialCards: 2,
      specialCopies: 3,
      specialVariants: 2,
      blackFrameCards: 1,
      voidHoloCards: 1,
    });
  });

  it('ignores tokens and basics in the denominator', () => {
    const all = [
      ...POOL,
      card('tok', { token: true }),
      card('forest', { types: ['land'], supertypes: ['basic'], cost: undefined }),
    ];
    const summary = collectionCompletion(all, freshSave(0));
    expect(summary.total).toBe(POOL.length);
  });
});
