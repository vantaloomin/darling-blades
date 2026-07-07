import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { CARD_DB } from '../../src/data/catalog';
import { THEME_DECKS } from '../../src/data/starterDecks';
import { createRngState } from '../../src/engine/rng';
import {
  addCard,
  addCards,
  bestOwnedVariant,
  ownedVariants,
  PLAYSET,
  shardableCount,
  shardExcess,
  shardGold,
} from '../../src/meta/Collection';
import { validateDeck } from '../../src/meta/DeckStorage';
import { applyGauntletResult, applyMatchResult, buyThemeDeck, spendGold } from '../../src/meta/Economy';
import { openPack, packPool } from '../../src/meta/PackOpener';
import { freshSave, SaveManager, type SaveData } from '../../src/meta/SaveManager';
import { PLAIN_VARIANT, shardValue, TIER_RANK, variantKey, variantRank } from '../../src/meta/variants';
import { deckOf, TEST_DB } from '../helpers';

function fakeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
  raw: Map<string, string>;
} {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (k) => raw.get(k) ?? null,
    setItem: (k, v) => void raw.set(k, v),
    removeItem: (k) => void raw.delete(k),
  };
}

/** Invariant: per-card variant counts sum to the aggregate collection count. */
function expectVariantSumInvariant(save: SaveData): void {
  for (const [id, total] of Object.entries(save.collection)) {
    const sum = Object.values(save.collectionVariants[id] ?? {}).reduce((s, n) => s + n, 0);
    expect(sum).toBe(total);
  }
  for (const id of Object.keys(save.collectionVariants)) {
    expect(save.collection[id]).toBeGreaterThan(0);
  }
}

describe('SaveManager', () => {
  it('round-trips through storage', () => {
    const storage = fakeStorage();
    const a = new SaveManager(storage);
    a.data.gold = 777;
    a.data.collection['bear'] = 3;
    a.data.collectionVariants['bear'] = { 'white|none': 2, 'gold|void': 1 };
    a.flush();

    const b = new SaveManager(storage);
    expect(b.data.gold).toBe(777);
    expect(b.data.collection['bear']).toBe(3);
    expect(b.data.collectionVariants['bear']).toEqual({ 'white|none': 2, 'gold|void': 1 });
  });

  it('recovers from corrupt data', () => {
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', '{not json');
    const m = new SaveManager(storage);
    expect(m.data.gold).toBe(0);
    expect(m.data.version).toBe(9);
  });

  it('reads a save left under the legacy waifutcg key (rename survival)', () => {
    // A save written before the WaifuTCG → Darling Blades rename must still load.
    const storage = fakeStorage();
    const a = new SaveManager(storage);
    a.data.gold = 512;
    a.data.collection['bear'] = 2;
    // Simulate a pre-rename blob: move the flushed data to the legacy key.
    a.flush();
    const blob = storage.raw.get('darlingblades.save.v1')!;
    storage.raw.delete('darlingblades.save.v1');
    storage.raw.set('waifutcg.save.v1', blob);

    const b = new SaveManager(storage);
    expect(b.data.version).toBe(9);
    expect(b.data.gold).toBe(512);
    expect(b.data.collection['bear']).toBe(2);
    // The new key takes precedence when both exist.
    storage.raw.set('darlingblades.save.v1', blob.replace('"gold":512', '"gold":999'));
    const c = new SaveManager(storage);
    expect(c.data.gold).toBe(999);
  });

  it('reset() wipes storage and the in-memory blob back to a fresh save', () => {
    const storage = fakeStorage();
    const m = new SaveManager(storage);
    m.data.gold = 4200;
    m.data.collection['bear'] = 3;
    m.data.decks.push({ id: 'd1', name: 'Mine', cards: ['bear'] });
    m.data.starterChosen = 'so-crimson';
    m.data.stats.wins = 9;
    m.flush();
    // A leftover legacy blob must be cleared too, or a reload would resurrect it.
    storage.raw.set('waifutcg.save.v1', storage.raw.get('darlingblades.save.v1')!);

    m.reset(1234);

    // Storage: both slots gone, so a fresh SaveManager boots clean.
    expect(storage.raw.has('darlingblades.save.v1')).toBe(false);
    expect(storage.raw.has('waifutcg.save.v1')).toBe(false);
    // In-memory (shared reference) is a fresh save.
    expect(m.data.gold).toBe(0);
    expect(m.data.collection).toEqual({});
    expect(m.data.decks).toEqual([]);
    expect(m.data.starterChosen).toBeNull();
    expect(m.data.stats.wins).toBe(0);
    expect(m.data.version).toBe(9);
    expect(m.data.createdAt).toBe(1234);
    // A subsequent boot from the same storage is also fresh.
    expect(new SaveManager(storage).data.gold).toBe(0);
  });
});

describe('collection and economy', () => {
  it('a PLAIN 5th copy melts to gold at the tier rate and is not recorded', () => {
    const save = freshSave(0);
    for (let i = 0; i < PLAYSET; i++) {
      expect(addCard(save, TEST_DB, 'bear', PLAIN_VARIANT).dupeGold).toBe(0);
    }
    const fifth = addCard(save, TEST_DB, 'bear'); // variant defaults to PLAIN
    expect(fifth.dupeGold).toBe(ECONOMY.dupeGold.c);
    expect(fifth.isNew).toBe(false);
    expect(fifth.isNewVariant).toBe(false);
    expect(save.collection['bear']).toBe(4);
    expect(save.collectionVariants['bear']).toEqual({ 'white|none': 4 });
    expect(save.gold).toBe(ECONOMY.dupeGold.c);
    expectVariantSumInvariant(save);
    expect(addCard(save, TEST_DB, 'dt_rhino')).toMatchObject({ isNew: true, tier: 'sr' });
  });

  it('a SPECIAL 5th copy is always kept and recorded (collector value)', () => {
    const save = freshSave(0);
    for (let i = 0; i < PLAYSET; i++) addCard(save, TEST_DB, 'bear');
    const special = addCard(save, TEST_DB, 'bear', { frame: 'gold', holo: 'none' });
    expect(special.dupeGold).toBe(0);
    expect(special.isNew).toBe(false);
    expect(special.isNewVariant).toBe(true);
    expect(save.collection['bear']).toBe(5); // aggregate grows past the playset
    expect(save.collectionVariants['bear']).toEqual({ 'white|none': 4, 'gold|none': 1 });
    // …and a repeat of the same special variant is still recorded, not melted
    const again = addCard(save, TEST_DB, 'bear', { frame: 'gold', holo: 'none' });
    expect(again).toMatchObject({ dupeGold: 0, isNewVariant: false });
    expect(save.collection['bear']).toBe(6);
    expect(save.gold).toBe(0);
    expectVariantSumInvariant(save);
  });

  it('per-variant playset: a PLAIN copy is kept while you hold < 4 PLAIN (even past 4 total)', () => {
    const save = freshSave(0);
    // Four SPECIAL copies (gold|none) — aggregate hits the playset…
    for (let i = 0; i < PLAYSET; i++) addCard(save, TEST_DB, 'bear', { frame: 'gold', holo: 'none' });
    expect(save.collection['bear']).toBe(4);
    // …but a PLAIN copy is judged on its own count (0 plain < 4), so it's kept.
    const plain = addCard(save, TEST_DB, 'bear', PLAIN_VARIANT);
    expect(plain.dupeGold).toBe(0);
    expect(plain.isNewVariant).toBe(true);
    expect(save.collection['bear']).toBe(5);
    expect(save.collectionVariants['bear']).toEqual({ 'gold|none': 4, 'white|none': 1 });
    expectVariantSumInvariant(save);
  });

  it('shardExcess sells copies past the per-variant playset at the variant-scaled rate', () => {
    const save = freshSave(0);
    // 5 blue|none + 6 red|none (specials accumulate, never auto-melt).
    for (let i = 0; i < 5; i++) addCard(save, TEST_DB, 'bear', { frame: 'blue', holo: 'none' });
    for (let i = 0; i < 6; i++) addCard(save, TEST_DB, 'bear', { frame: 'red', holo: 'none' });
    expect(save.collection['bear']).toBe(11);

    const expectGold =
      shardValue('c', { frame: 'blue', holo: 'none' }) * 1 + // 1 over the cap
      shardValue('c', { frame: 'red', holo: 'none' }) * 2; // 2 over the cap
    expect(shardableCount(save, 'bear')).toBe(3);
    expect(shardGold(save, TEST_DB, 'bear')).toBe(expectGold);

    const res = shardExcess(save, TEST_DB, 'bear');
    expect(res).toEqual({ gold: expectGold, copies: 3 });
    expect(save.gold).toBe(expectGold);
    // Each over-cap variant is reduced to exactly the playset; plainless card gone.
    expect(save.collectionVariants['bear']).toEqual({ 'blue|none': 4, 'red|none': 4 });
    expect(save.collection['bear']).toBe(8);
    expectVariantSumInvariant(save);
    // A second shard is a no-op — nothing is over the cap now.
    expect(shardExcess(save, TEST_DB, 'bear')).toEqual({ gold: 0, copies: 0 });
  });

  it('shardValue: a plain copy shards for exactly dupeGold; specials pay more', () => {
    expect(shardValue('c', PLAIN_VARIANT)).toBe(ECONOMY.dupeGold.c);
    expect(shardValue('ur', PLAIN_VARIANT)).toBe(ECONOMY.dupeGold.ur);
    expect(shardValue('c', { frame: 'gold', holo: 'void' })).toBeGreaterThan(ECONOMY.dupeGold.c);
    // Higher frame/holo → strictly more gold.
    expect(shardValue('sr', { frame: 'black', holo: 'void' })).toBeGreaterThan(
      shardValue('sr', { frame: 'blue', holo: 'none' }),
    );
  });

  it('shardExcess handles a legacy plain-only aggregate (no variant record)', () => {
    const save = freshSave(0);
    save.collection['bear'] = 6; // pre-variant shape: aggregate, no collectionVariants entry
    expect(shardableCount(save, 'bear')).toBe(2);
    const res = shardExcess(save, TEST_DB, 'bear');
    expect(res.copies).toBe(2);
    expect(res.gold).toBe(shardValue('c', PLAIN_VARIANT) * 2);
    expect(save.collection['bear']).toBe(4);
    expect(save.collectionVariants['bear']).toEqual({ 'white|none': 4 });
    expectVariantSumInvariant(save);
  });

  it('bestOwnedVariant ranks frame first, then holo; plain/legacy reads as PLAIN', () => {
    const save = freshSave(0);
    expect(bestOwnedVariant(save, 'bear')).toEqual(PLAIN_VARIANT);
    // legacy shape: aggregate count with no variant record → plain
    save.collection['elf'] = 3;
    expect(ownedVariants(save, 'elf')).toEqual({ 'white|none': 3 });
    expect(bestOwnedVariant(save, 'elf')).toEqual(PLAIN_VARIANT);

    addCard(save, TEST_DB, 'bear', { frame: 'white', holo: 'void' });
    addCard(save, TEST_DB, 'bear', { frame: 'blue', holo: 'none' });
    // frame outranks holo: blue|none beats white|void
    expect(bestOwnedVariant(save, 'bear')).toEqual({ frame: 'blue', holo: 'none' });
    addCard(save, TEST_DB, 'bear', { frame: 'blue', holo: 'shiny' });
    expect(bestOwnedVariant(save, 'bear')).toEqual({ frame: 'blue', holo: 'shiny' });
    // (no sum-invariant check here: the 'elf' entry above deliberately
    // simulates a legacy aggregate with no variant record)
  });

  it('addCards grants PLAIN copies and seeds collectionVariants (starter grant path)', () => {
    const save = freshSave(0);
    addCards(save, TEST_DB, ['bear', 'bear', 'elf', 'shock', 'shock', 'shock', 'shock']);
    expect(save.collection['bear']).toBe(2);
    expect(save.collectionVariants['bear']).toEqual({ [variantKey(PLAIN_VARIANT)]: 2 });
    expect(save.collectionVariants['shock']).toEqual({ 'white|none': 4 });
    expectVariantSumInvariant(save);
  });

  it('match rewards include a first-win-of-day bonus exactly once', () => {
    const save = freshSave(0);
    const first = applyMatchResult(save, 'medium', true, '2026-07-02');
    expect(first).toEqual({ gold: 200, firstWinBonus: true }); // 100 + 100 bonus
    const second = applyMatchResult(save, 'medium', true, '2026-07-02');
    expect(second).toEqual({ gold: 100, firstWinBonus: false });
    const loss = applyMatchResult(save, 'hard', false, '2026-07-02');
    expect(loss.gold).toBe(20);
    expect(save.stats.wins).toBe(2);
    expect(save.stats.byDifficulty.hard.l).toBe(1);
  });

  it('spendGold refuses overdrafts', () => {
    const save = freshSave(0);
    save.gold = 100;
    expect(spendGold(save, 250)).toBe(false);
    expect(spendGold(save, 100)).toBe(true);
    expect(save.gold).toBe(0);
  });
});

describe('PackOpener', () => {
  it('boosters contain packSize cards — no basics, no tokens — sorted worst→best', () => {
    const save = freshSave(0);
    const rng = createRngState(42);
    const result = openPack(save, TEST_DB, rng);
    expect(result.cards).toHaveLength(ECONOMY.packSize);
    for (const c of result.cards) {
      expect(TEST_DB[c.cardId].token).toBeFalsy();
      expect(TEST_DB[c.cardId].supertypes ?? []).not.toContain('basic');
      expect(c.tier).toBe(TEST_DB[c.cardId].rarity);
    }
    // reveal order: tier rank never decreases; within a tier, variant rank never decreases
    for (let i = 1; i < result.cards.length; i++) {
      const prev = result.cards[i - 1];
      const cur = result.cards[i];
      expect(TIER_RANK[cur.tier]).toBeGreaterThanOrEqual(TIER_RANK[prev.tier]);
      if (cur.tier === prev.tier) {
        expect(
          variantRank({ frame: cur.frame, holo: cur.holo }),
        ).toBeGreaterThanOrEqual(variantRank({ frame: prev.frame, holo: prev.holo }));
      }
    }
    expect(save.stats.packsOpened).toBe(1);
    expectVariantSumInvariant(save);
  });

  it('is deterministic per seed, including variants', () => {
    const a = openPack(freshSave(0), TEST_DB, createRngState(7));
    const b = openPack(freshSave(0), TEST_DB, createRngState(7));
    expect(a).toEqual(b); // full PackResult: ids, tiers, frames, holos, flags
    const c = openPack(freshSave(0), TEST_DB, createRngState(8));
    expect(a).not.toEqual(c); // sanity: a different seed actually differs
  });

  it('a set-scoped Ragnarök booster pulls only ragnarok cards, self-sufficient at every tier', () => {
    for (const tier of ['c', 'r', 'sr', 'ssr', 'ur'] as const) {
      const rgPool = packPool(CARD_DB, tier, 'ragnarok');
      expect(rgPool.length, `ragnarok ${tier} pool`).toBeGreaterThan(0);
      for (const id of rgPool) expect(id.startsWith('rg-'), `${id} in ragnarok pool`).toBe(true);
    }
    const result = openPack(freshSave(0), CARD_DB, createRngState(99), 'ragnarok');
    expect(result.cards).toHaveLength(ECONOMY.packSize);
    for (const c of result.cards) expect(CARD_DB[c.cardId].set).toBe('ragnarok');
  });

  it('dupe-protects the sr/ssr/ur slots (prefers sub-playset cards)', () => {
    // own a playset of every sr except dt_rhino → every sr slot must roll it
    const srs = packPool(TEST_DB, 'sr');
    expect(srs.length).toBeGreaterThan(1);
    let srSeen = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const save = freshSave(0);
      for (const id of srs) {
        if (id === 'dt_rhino') continue;
        save.collection[id] = 4;
        save.collectionVariants[id] = { 'white|none': 4 };
      }
      const result = openPack(save, TEST_DB, createRngState(seed));
      const srPulls = result.cards.filter((c) => c.tier === 'sr');
      srSeen += srPulls.length;
      // Every sr slot must roll dt_rhino — unless dt_rhino completed its own
      // playset mid-pack (4 recorded copies), which legitimately lifts the
      // protection for later sr slots in the same pack.
      const others = srPulls.filter((c) => c.cardId !== 'dt_rhino');
      if (others.length > 0) {
        expect(srPulls.length - others.length).toBeGreaterThanOrEqual(4);
      }
    }
    expect(srSeen).toBeGreaterThan(0); // the assertion above actually ran
  });

  it('falls back one tier down when a tier pool is empty', () => {
    // A db with no ssr/ur cards: those rolls must fall back (ssr→sr, ur→ssr→sr),
    // never crash. 30 packs ≈ 450 slots — ssr/ur (6%) rolls are all but certain.
    const db = Object.fromEntries(
      Object.entries(TEST_DB).filter(([id]) => id !== 'murder' && id !== 'blaze'),
    );
    for (let seed = 1; seed <= 30; seed++) {
      const result = openPack(freshSave(0), db, createRngState(seed));
      expect(result.cards).toHaveLength(ECONOMY.packSize);
      for (const card of result.cards) {
        expect(['c', 'r', 'sr']).toContain(card.tier);
      }
    }
  });
});

describe('deck validation', () => {
  it('enforces size, copies, ownership; basics are free', () => {
    const save = freshSave(0);
    save.collection['bear'] = 4;
    save.collection['giant'] = 2;

    const deck = deckOf([
      ['forest', 24], // basics: unlimited, unowned is fine
      ['bear', 4],
      ['giant', 2],
      ['elf', 30], // unowned + over max copies
    ]);
    const issues = validateDeck(TEST_DB, save, deck);
    expect(issues.some((i) => i.message.includes('copies'))).toBe(true);
    expect(issues.some((i) => i.message.includes('owned'))).toBe(true);

    const legal = deckOf([
      ['forest', 30],
      ['bear', 4],
      ['giant', 2],
      ['forest', 24],
    ]);
    expect(legal).toHaveLength(60);
    const issues2 = validateDeck(TEST_DB, save, legal);
    expect(issues2.filter((i) => i.kind === 'error')).toHaveLength(0);
  });
});

/** Save migration: every old version walks the whole chain to v8. */
describe('save migration v1/v2/v3/v4/v5/v6/v7/v8 → v9', () => {
  it('walks a v1 blob up the whole chain, preserving everything it had', () => {
    const v1blob = {
      version: 1,
      createdAt: 123,
      gold: 640,
      collection: { 'bk-wolfqueen': 2, 'land-forest': 0 },
      decks: [{ id: 'd1', name: 'Mine', cards: ['land-forest'] }],
      activeDeckId: 'd1',
      starterChosen: 'starter-wild',
      stats: {
        wins: 5,
        losses: 3,
        byDifficulty: { easy: { w: 3, l: 1 }, medium: { w: 2, l: 1 }, hard: { w: 0, l: 1 } },
        packsOpened: 4,
        lastWinDay: '2026-06-30',
      },
      settings: { volume: 0.5, animSpeed: 'fast' },
    };
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v1blob));
    const m = new SaveManager(storage);

    expect(m.data.version).toBe(9);
    expect(m.data.gold).toBe(640);
    expect(m.data.collection['bk-wolfqueen']).toBe(2);
    expect(m.data.decks).toEqual(v1blob.decks);
    expect(m.data.activeDeckId).toBe('d1');
    expect(m.data.starterChosen).toBe('starter-wild');
    expect(m.data.stats.wins).toBe(5);
    expect(m.data.stats.byDifficulty.medium.w).toBe(2);
    // new fields spread in with defaults
    expect(m.data.gauntlet).toEqual({ run: null, bestRung: 0, completions: 0 });
    expect(m.data.heroCardId).toBe(null); // v6 addition: auto face until chosen
    expect(m.data.heroPortraitId).toBe(null); // v9 addition: no premium hero until chosen
    // v4: pre-variant copies become PLAIN; zero-count entries are not seeded
    expect(m.data.collectionVariants['bk-wolfqueen']).toEqual({ 'white|none': 2 });
    expect(m.data.collectionVariants['land-forest']).toBeUndefined();
    // settings: volume preserved, new toggles defaulted, animSpeed dropped,
    // and the v4 'auto' renderScale coerced to the v5 hard-coded default.
    expect(m.data.settings).toEqual({
      volume: 0.5,
      sfxOn: true,
      musicOn: true,
      animations: 'full',
      renderScale: 1.5,
      autoSkip: true,
      confirmDestructive: true, // v7 default
      keywordReminders: true, // v8 default
    });
    expect('animSpeed' in m.data.settings).toBe(false);
  });

  it('migrates a v2 blob to v8, keeping the gauntlet intact', () => {
    const v2blob = {
      version: 2,
      createdAt: 456,
      gold: 320,
      collection: { 'oly-hera': 1 },
      decks: [{ id: 'd2', name: 'Olympus', cards: ['land-plains'] }],
      activeDeckId: 'd2',
      starterChosen: 'starter-olympus',
      stats: {
        wins: 9,
        losses: 2,
        byDifficulty: { easy: { w: 4, l: 0 }, medium: { w: 3, l: 1 }, hard: { w: 2, l: 1 } },
        packsOpened: 7,
        lastWinDay: '2026-07-01',
      },
      gauntlet: { run: { rung: 5, startedAt: 400 }, bestRung: 6, completions: 1 },
      settings: { volume: 0.3, animSpeed: 'normal' },
    };
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v2blob));
    const m = new SaveManager(storage);

    expect(m.data.version).toBe(9);
    expect(m.data.gold).toBe(320);
    // v2 data survives, and v6 stamps the in-progress run with a reproducible
    // seed derived from its startedAt (400 & 0x7fffffff = 400).
    expect(m.data.gauntlet).toEqual({
      run: { rung: 5, startedAt: 400, seed: 400 },
      bestRung: 6,
      completions: 1,
    });
    expect(m.data.collectionVariants['oly-hera']).toEqual({ 'white|none': 1 });
    expect(m.data.settings.volume).toBe(0.3);
    expect(m.data.settings.musicOn).toBe(true); // the v3 addition, defaulting on
    expect(m.data.settings.renderScale).toBe(1.5); // v5: coerced from v4's 'auto'
    expect('animSpeed' in m.data.settings).toBe(false);
  });

  it('migrates a v3 blob to v8: variants seeded, settings rebuilt, animSpeed gone', () => {
    const v3blob = {
      version: 3,
      createdAt: 789,
      gold: 150,
      collection: { 'bk-wolfqueen': 4, 'oly-hera': 1 },
      decks: [],
      activeDeckId: null,
      starterChosen: 'starter-wild',
      stats: {
        wins: 1,
        losses: 0,
        byDifficulty: { easy: { w: 1, l: 0 }, medium: { w: 0, l: 0 }, hard: { w: 0, l: 0 } },
        packsOpened: 2,
        lastWinDay: null,
      },
      gauntlet: { run: null, bestRung: 2, completions: 0 },
      settings: { volume: 0.6, animSpeed: 'fast', musicOn: false },
    };
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v3blob));
    const m = new SaveManager(storage);

    expect(m.data.version).toBe(9);
    expect(m.data.collection).toEqual({ 'bk-wolfqueen': 4, 'oly-hera': 1 });
    expect(m.data.collectionVariants).toEqual({
      'bk-wolfqueen': { 'white|none': 4 },
      'oly-hera': { 'white|none': 1 },
    });
    expectVariantSumInvariant(m.data);
    expect(m.data.settings).toEqual({
      volume: 0.6,
      sfxOn: true,
      musicOn: false, // preserved, not defaulted
      animations: 'full',
      renderScale: 1.5, // v5: coerced from the v4 'auto'
      autoSkip: true,
      confirmDestructive: true, // v7 default
      keywordReminders: true, // v8 default
    });
    expect('animSpeed' in m.data.settings).toBe(false);
    expect(m.data.gauntlet.bestRung).toBe(2);
  });

  it('migrates a v4 blob to v8: an explicit renderScale is preserved', () => {
    const storage = fakeStorage();
    const base = freshSave(1);
    const v4blob = { ...base, version: 4, settings: { ...base.settings, renderScale: 2 } };
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v4blob));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(9);
    expect(m.data.settings.renderScale).toBe(2); // 1440p choice survives
  });

  it("migrates a v4 blob to v8: the removed 'auto' is coerced to the default", () => {
    const storage = fakeStorage();
    const base = freshSave(1);
    const v4blob = {
      ...base,
      version: 4,
      // 'auto' is no longer a valid value in v5 — the migration must coerce it.
      settings: { ...base.settings, renderScale: 'auto' },
    };
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v4blob));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(9);
    expect(m.data.settings.renderScale).toBe(1.5);
  });

  it('migrates a v5 blob to v8: heroCardId defaults null, an in-progress run gets a seed', () => {
    const storage = fakeStorage();
    const base = freshSave(1);
    // A v5 shape: no heroCardId, and a run object without the v6 seed field.
    const v5blob = {
      ...base,
      version: 5,
      gauntlet: { run: { rung: 3, startedAt: 900 }, bestRung: 3, completions: 0 },
    };
    delete (v5blob as { heroCardId?: unknown }).heroCardId;
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v5blob));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(9);
    expect(m.data.heroCardId).toBe(null);
    // The seedless run is stamped deterministically from startedAt (900).
    expect(m.data.gauntlet.run).toEqual({ rung: 3, startedAt: 900, seed: 900 });
    expect(m.data.gauntlet.bestRung).toBe(3);
  });

  it('migrates a v5 blob with no run and preserves an already-set heroCardId', () => {
    const storage = fakeStorage();
    const base = freshSave(1);
    const v5blob = { ...base, version: 5, heroCardId: 'oly-zeus', gauntlet: { run: null, bestRung: 5, completions: 2 } };
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v5blob));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(9);
    expect(m.data.heroCardId).toBe('oly-zeus'); // a pre-set hero survives
    expect(m.data.gauntlet).toEqual({ run: null, bestRung: 5, completions: 2 });
  });

  it('migrates a v6 blob to v8: confirmDestructive defaults on, an explicit choice survives', () => {
    const base = freshSave(1);
    // A genuine v6 shape: settings without the v7 confirmDestructive field.
    const v6settings = { ...base.settings } as Record<string, unknown>;
    delete v6settings.confirmDestructive;

    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify({ ...base, version: 6, settings: v6settings }));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(9);
    expect(m.data.settings.confirmDestructive).toBe(true); // default on
    expect(m.data.settings.renderScale).toBe(base.settings.renderScale); // rest of settings intact

    // A veteran who had already turned the guard off keeps it off (no clobber).
    const s2 = fakeStorage();
    s2.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({ ...base, version: 6, settings: { ...v6settings, confirmDestructive: false } }),
    );
    const m2 = new SaveManager(s2);
    expect(m2.data.version).toBe(9);
    expect(m2.data.settings.confirmDestructive).toBe(false);
  });

  it('migrates a v7 blob to v8: keywordReminders defaults on, an explicit choice survives', () => {
    const base = freshSave(1);
    // A genuine v7 shape: settings without the v8 keywordReminders field.
    const v7settings = { ...base.settings } as Record<string, unknown>;
    delete v7settings.keywordReminders;

    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify({ ...base, version: 7, settings: v7settings }));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(9);
    expect(m.data.settings.keywordReminders).toBe(true); // default on
    expect(m.data.settings.confirmDestructive).toBe(base.settings.confirmDestructive); // v7 field intact

    // A veteran who turned reminders off keeps them off across the migration.
    const s2 = fakeStorage();
    s2.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({ ...base, version: 7, settings: { ...v7settings, keywordReminders: false } }),
    );
    const m2 = new SaveManager(s2);
    expect(m2.data.version).toBe(9);
    expect(m2.data.settings.keywordReminders).toBe(false);
  });

  it('migrates a v8 blob to v9: heroPortraitId defaults null, an explicit choice survives', () => {
    const base = freshSave(1);
    // A genuine v8 shape: no heroPortraitId field yet.
    const v8blob = { ...base, version: 8 } as Record<string, unknown>;
    delete v8blob.heroPortraitId;

    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v8blob));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(9);
    expect(m.data.heroPortraitId).toBe(null); // default
    expect(m.data.heroCardId).toBe(base.heroCardId); // the rest is intact

    // A player who had already chosen a premium hero keeps it (no clobber).
    const s2 = fakeStorage();
    s2.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({ ...base, version: 8, heroPortraitId: 'hero-valhalla' }),
    );
    const m2 = new SaveManager(s2);
    expect(m2.data.version).toBe(9);
    expect(m2.data.heroPortraitId).toBe('hero-valhalla');
  });

  it('leaves an existing v9 save untouched and round-trips the new settings', () => {
    const storage = fakeStorage();
    const a = new SaveManager(storage);
    a.data.gold = 99;
    a.data.gauntlet.bestRung = 4;
    a.data.settings.musicOn = false;
    a.data.settings.autoSkip = false;
    a.data.settings.animations = 'reduced';
    a.data.settings.renderScale = 1.5;
    a.flush();
    const b = new SaveManager(storage);
    expect(b.data.version).toBe(9);
    expect(b.data.gold).toBe(99);
    expect(b.data.gauntlet.bestRung).toBe(4);
    expect(b.data.settings.musicOn).toBe(false);
    expect(b.data.settings.autoSkip).toBe(false);
    expect(b.data.settings.animations).toBe('reduced');
    expect(b.data.settings.renderScale).toBe(1.5);
  });
});

describe('applyGauntletResult', () => {
  it('a win pays the rung gold and advances to the next rung', () => {
    const save = freshSave(0);
    save.gauntlet.run = { rung: 1, startedAt: 10, seed: 777 };
    const r = applyGauntletResult(save, 1, 'easy', true, '2026-07-02');
    // rung 1 gold 50 + first-win-of-day 100
    expect(r.gold).toBe(ECONOMY.gauntletRungGold[0] + ECONOMY.firstWinOfDayBonus);
    expect(r.firstWinBonus).toBe(true);
    expect(r.completed).toBe(false);
    expect(r.runOver).toBe(false);
    expect(r.nextRung).toBe(2);
    // The run climbs but its seed is carried forward (reproducible run).
    expect(save.gauntlet.run).toEqual({ rung: 2, startedAt: 10, seed: 777 });
    expect(save.gauntlet.bestRung).toBe(1);
    expect(save.stats.byDifficulty.easy.w).toBe(1);
  });

  it('clearing rung 8 advances the run (does not complete a 10-rung ladder)', () => {
    const save = freshSave(0);
    save.gauntlet.run = { rung: 8, startedAt: 1, seed: 42 };
    const r = applyGauntletResult(save, 8, 'hard', true, '2026-07-02');
    expect(r.completed).toBe(false);
    expect(r.nextRung).toBe(9);
    expect(save.gauntlet.run?.rung).toBe(9);
  });

  it('clearing rung 10 pays the completion bonus and ends the run', () => {
    const save = freshSave(0);
    save.stats.lastWinDay = '2026-07-02'; // no first-win bonus this time
    save.gauntlet.run = { rung: 10, startedAt: 1, seed: 42 };
    const r = applyGauntletResult(save, 10, 'hard', true, '2026-07-02');
    expect(r.gold).toBe(ECONOMY.gauntletRungGold[9] + ECONOMY.gauntletCompletionBonus);
    expect(r.completed).toBe(true);
    expect(r.runOver).toBe(true);
    expect(r.nextRung).toBeNull();
    expect(save.gauntlet.run).toBeNull();
    expect(save.gauntlet.completions).toBe(1);
    expect(save.gauntlet.bestRung).toBe(10);
  });

  it('a full 10-rung run pays exactly 1650 gold plus the daily bonus once', () => {
    const save = freshSave(0);
    save.gauntlet.run = { rung: 1, startedAt: 1, seed: 42 };
    let total = 0;
    for (let rung = 1; rung <= 10; rung++) {
      const diff = rung <= 3 ? 'easy' : rung <= 6 ? 'medium' : 'hard';
      total += applyGauntletResult(save, rung, diff, true, '2026-07-02').gold;
    }
    const rungSum = ECONOMY.gauntletRungGold.reduce((s, g) => s + g, 0);
    expect(rungSum).toBe(1400);
    expect(total).toBe(rungSum + ECONOMY.gauntletCompletionBonus + ECONOMY.firstWinOfDayBonus);
    expect(total).toBe(1750); // 1400 + 250 + 100 (daily bonus once)
    expect(save.gauntlet.completions).toBe(1);
  });

  it('a loss pays standard loss gold and resets the run', () => {
    const save = freshSave(0);
    save.gauntlet.run = { rung: 4, startedAt: 1, seed: 42 };
    save.gauntlet.bestRung = 3;
    const r = applyGauntletResult(save, 4, 'medium', false, '2026-07-02');
    expect(r.gold).toBe(ECONOMY.lossGold);
    expect(r.runOver).toBe(true);
    expect(r.nextRung).toBeNull();
    expect(save.gauntlet.run).toBeNull();
    expect(save.gauntlet.bestRung).toBe(3); // unchanged by a loss
    expect(save.stats.byDifficulty.medium.l).toBe(1);
  });
});

describe('buyThemeDeck (Ragnarök precon)', () => {
  const deck = THEME_DECKS[0];

  it('spends preconPrice, grants the cards, and adds the deck without touching starterChosen', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.preconPrice + 50;
    save.starterChosen = 'starter-crimson';
    expect(buyThemeDeck(save, CARD_DB, deck)).toBe(true);
    expect(save.gold).toBe(50);
    expect(save.decks.some((d) => d.id === deck.id)).toBe(true);
    expect(save.starterChosen).toBe('starter-crimson'); // the free-starter flow is untouched
    const aNonBasic = deck.cards.find((id) => !CARD_DB[id].supertypes?.includes('basic'))!;
    expect(save.collection[aNonBasic] ?? 0).toBeGreaterThan(0);
  });

  it('is idempotent — a second buy is a no-op that does not spend gold', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.preconPrice * 3;
    expect(buyThemeDeck(save, CARD_DB, deck)).toBe(true);
    const afterFirst = save.gold;
    expect(buyThemeDeck(save, CARD_DB, deck)).toBe(false);
    expect(save.gold).toBe(afterFirst);
    expect(save.decks.filter((d) => d.id === deck.id)).toHaveLength(1);
  });

  it('fails and spends nothing when gold is short', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.preconPrice - 1;
    expect(buyThemeDeck(save, CARD_DB, deck)).toBe(false);
    expect(save.gold).toBe(ECONOMY.preconPrice - 1);
    expect(save.decks.some((d) => d.id === deck.id)).toBe(false);
  });
});
