import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { CARD_DB } from '../../src/data/catalog';
import { DRAFT_PERSONAS } from '../../src/data/draftPersonas';
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
import { applyGauntletResult, applyMatchResult, buyThemeDeck, previewDeckGrant, spendGold } from '../../src/meta/Economy';
import { assignDraftPersonas } from '../../src/meta/draftPicker';
import { startDraftRun, startSealedRun } from '../../src/meta/Limited';
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
    a.data.collectionVariants['bear'] = {
      [variantKey(PLAIN_VARIANT)]: 2,
      [variantKey({ frame: 'gold', holo: 'void', fullArt: false })]: 1,
    };
    a.flush();

    const b = new SaveManager(storage);
    expect(b.data.gold).toBe(777);
    expect(b.data.collection['bear']).toBe(3);
    expect(b.data.collectionVariants['bear']).toEqual({
      [variantKey(PLAIN_VARIANT)]: 2,
      [variantKey({ frame: 'gold', holo: 'void', fullArt: false })]: 1,
    });
  });

  it('recovers from corrupt data', () => {
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', '{not json');
    const m = new SaveManager(storage);
    expect(m.data.gold).toBe(0);
    expect(m.data.version).toBe(22);
  });

  it('starts fresh saves with auto-skip off', () => {
    expect(freshSave(0).settings.autoSkip).toBe(false);
  });

  it('reads a save left under the legacy waifutcg key (rename survival)', () => {
    // A save written before the WaifuTCG â†’ Darling Blades rename must still load.
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
    expect(b.data.version).toBe(22);
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
    m.data.decks.push({ id: 'd1', name: 'Mine', cards: ['bear'], heroCardId: null, landStyle: null });
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
    expect(m.data.version).toBe(22);
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
    expect(save.collectionVariants['bear']).toEqual({ [variantKey(PLAIN_VARIANT)]: 4 });
    expect(save.gold).toBe(ECONOMY.dupeGold.c);
    expectVariantSumInvariant(save);
    expect(addCard(save, TEST_DB, 'dt_rhino')).toMatchObject({ isNew: true, tier: 'sr' });
  });

  it('a SPECIAL 5th copy is always kept and recorded (collector value)', () => {
    const save = freshSave(0);
    for (let i = 0; i < PLAYSET; i++) addCard(save, TEST_DB, 'bear');
    const special = addCard(save, TEST_DB, 'bear', { frame: 'gold', holo: 'none', fullArt: false });
    expect(special.dupeGold).toBe(0);
    expect(special.isNew).toBe(false);
    expect(special.isNewVariant).toBe(true);
    expect(save.collection['bear']).toBe(5); // aggregate grows past the playset
    expect(save.collectionVariants['bear']).toEqual({
      [variantKey(PLAIN_VARIANT)]: 4,
      [variantKey({ frame: 'gold', holo: 'none', fullArt: false })]: 1,
    });
    // â€¦and a repeat of the same special variant is still recorded, not melted
    const again = addCard(save, TEST_DB, 'bear', { frame: 'gold', holo: 'none', fullArt: false });
    expect(again).toMatchObject({ dupeGold: 0, isNewVariant: false });
    expect(save.collection['bear']).toBe(6);
    expect(save.gold).toBe(0);
    expectVariantSumInvariant(save);
  });

  it('a Full Art copy never auto-melts even with a plain frame and no holo', () => {
    const save = freshSave(0);
    const fullArt = { frame: 'white', holo: 'none', fullArt: true } as const;
    for (let i = 0; i < PLAYSET + 1; i++) {
      expect(addCard(save, TEST_DB, 'bear', fullArt).dupeGold).toBe(0);
    }
    expect(save.collection.bear).toBe(PLAYSET + 1);
    expect(save.collectionVariants.bear).toEqual({ [variantKey(fullArt)]: PLAYSET + 1 });
    expect(save.gold).toBe(0);
  });

  it('per-variant playset: a PLAIN copy is kept while you hold < 4 PLAIN (even past 4 total)', () => {
    const save = freshSave(0);
    // Four SPECIAL copies (gold|none) â€” aggregate hits the playsetâ€¦
    for (let i = 0; i < PLAYSET; i++) {
      addCard(save, TEST_DB, 'bear', { frame: 'gold', holo: 'none', fullArt: false });
    }
    expect(save.collection['bear']).toBe(4);
    // â€¦but a PLAIN copy is judged on its own count (0 plain < 4), so it's kept.
    const plain = addCard(save, TEST_DB, 'bear', PLAIN_VARIANT);
    expect(plain.dupeGold).toBe(0);
    expect(plain.isNewVariant).toBe(true);
    expect(save.collection['bear']).toBe(5);
    expect(save.collectionVariants['bear']).toEqual({
      [variantKey({ frame: 'gold', holo: 'none', fullArt: false })]: 4,
      [variantKey(PLAIN_VARIANT)]: 1,
    });
    expectVariantSumInvariant(save);
  });

  it('shardExcess sells copies past the per-variant playset at the variant-scaled rate', () => {
    const save = freshSave(0);
    // 5 blue|none + 6 red|none (specials accumulate, never auto-melt).
    for (let i = 0; i < 5; i++) addCard(save, TEST_DB, 'bear', { frame: 'blue', holo: 'none', fullArt: false });
    for (let i = 0; i < 6; i++) addCard(save, TEST_DB, 'bear', { frame: 'red', holo: 'none', fullArt: false });
    expect(save.collection['bear']).toBe(11);

    const expectGold =
      shardValue('c', { frame: 'blue', holo: 'none', fullArt: false }) * 1 + // 1 over the cap
      shardValue('c', { frame: 'red', holo: 'none', fullArt: false }) * 2; // 2 over the cap
    expect(shardableCount(save, 'bear')).toBe(3);
    expect(shardGold(save, TEST_DB, 'bear')).toBe(expectGold);

    const res = shardExcess(save, TEST_DB, 'bear');
    expect(res).toEqual({ gold: expectGold, copies: 3 });
    expect(save.gold).toBe(expectGold);
    // Each over-cap variant is reduced to exactly the playset; plainless card gone.
    expect(save.collectionVariants['bear']).toEqual({
      [variantKey({ frame: 'blue', holo: 'none', fullArt: false })]: 4,
      [variantKey({ frame: 'red', holo: 'none', fullArt: false })]: 4,
    });
    expect(save.collection['bear']).toBe(8);
    expectVariantSumInvariant(save);
    // A second shard is a no-op â€” nothing is over the cap now.
    expect(shardExcess(save, TEST_DB, 'bear')).toEqual({ gold: 0, copies: 0 });
  });

  it('shardValue: a plain copy shards for exactly dupeGold; specials pay more', () => {
    expect(shardValue('c', PLAIN_VARIANT)).toBe(ECONOMY.dupeGold.c);
    expect(shardValue('ur', PLAIN_VARIANT)).toBe(ECONOMY.dupeGold.ur);
    expect(shardValue('c', { frame: 'gold', holo: 'void', fullArt: false })).toBeGreaterThan(ECONOMY.dupeGold.c);
    // Higher frame/holo â†’ strictly more gold.
    expect(shardValue('sr', { frame: 'black', holo: 'void', fullArt: false })).toBeGreaterThan(
      shardValue('sr', { frame: 'blue', holo: 'none', fullArt: false }),
    );
    expect(shardValue('ur', { frame: 'white', holo: 'none', fullArt: true })).toBe(12_500);
  });

  it('shardExcess handles a legacy plain-only aggregate (no variant record)', () => {
    const save = freshSave(0);
    save.collection['bear'] = 6; // pre-variant shape: aggregate, no collectionVariants entry
    expect(shardableCount(save, 'bear')).toBe(2);
    const res = shardExcess(save, TEST_DB, 'bear');
    expect(res.copies).toBe(2);
    expect(res.gold).toBe(shardValue('c', PLAIN_VARIANT) * 2);
    expect(save.collection['bear']).toBe(4);
    expect(save.collectionVariants['bear']).toEqual({ [variantKey(PLAIN_VARIANT)]: 4 });
    expectVariantSumInvariant(save);
  });

  it('bestOwnedVariant ranks frame first, then holo; plain/legacy reads as PLAIN', () => {
    const save = freshSave(0);
    expect(bestOwnedVariant(save, 'bear')).toEqual(PLAIN_VARIANT);
    // legacy shape: aggregate count with no variant record â†’ plain
    save.collection['elf'] = 3;
    expect(ownedVariants(save, 'elf')).toEqual({ [variantKey(PLAIN_VARIANT)]: 3 });
    expect(bestOwnedVariant(save, 'elf')).toEqual(PLAIN_VARIANT);

    addCard(save, TEST_DB, 'bear', { frame: 'white', holo: 'void', fullArt: false });
    addCard(save, TEST_DB, 'bear', { frame: 'blue', holo: 'none', fullArt: false });
    // frame outranks holo: blue|none beats white|void
    expect(bestOwnedVariant(save, 'bear')).toEqual({ frame: 'blue', holo: 'none', fullArt: false });
    addCard(save, TEST_DB, 'bear', { frame: 'blue', holo: 'shiny', fullArt: false });
    expect(bestOwnedVariant(save, 'bear')).toEqual({ frame: 'blue', holo: 'shiny', fullArt: false });
    addCard(save, TEST_DB, 'bear', { frame: 'white', holo: 'none', fullArt: true });
    expect(bestOwnedVariant(save, 'bear')).toEqual({ frame: 'white', holo: 'none', fullArt: true });
    // (no sum-invariant check here: the 'elf' entry above deliberately
    // simulates a legacy aggregate with no variant record)
  });

  it('addCards grants PLAIN copies and seeds collectionVariants (starter grant path)', () => {
    const save = freshSave(0);
    addCards(save, TEST_DB, ['bear', 'bear', 'elf', 'shock', 'shock', 'shock', 'shock']);
    expect(save.collection['bear']).toBe(2);
    expect(save.collectionVariants['bear']).toEqual({ [variantKey(PLAIN_VARIANT)]: 2 });
    expect(save.collectionVariants['shock']).toEqual({ [variantKey(PLAIN_VARIANT)]: 4 });
    expectVariantSumInvariant(save);
  });

  it('match rewards include a first-win-of-day bonus exactly once', () => {
    const save = freshSave(0);
    const first = applyMatchResult(save, 'medium', true, '2026-07-02', 1);
    expect(first).toEqual({ gold: 200, firstWinBonus: true, tooEarly: false }); // 100 + 100 bonus
    const second = applyMatchResult(save, 'medium', true, '2026-07-02', 1);
    expect(second).toEqual({ gold: 100, firstWinBonus: false, tooEarly: false });
    const loss = applyMatchResult(save, 'hard', false, '2026-07-02', ECONOMY.minTurnsForLossGold);
    expect(loss.gold).toBe(20);
    expect(save.stats.wins).toBe(2);
    expect(save.stats.byDifficulty.hard.l).toBe(1);
  });

  it('a loss before minTurnsForLossGold pays nothing (anti concede-farm), at the floor pays normally', () => {
    const save = freshSave(0);
    const startGold = save.gold;
    const early = applyMatchResult(save, 'medium', false, '2026-07-02', ECONOMY.minTurnsForLossGold - 1);
    expect(early).toEqual({ gold: 0, firstWinBonus: false, tooEarly: true });
    expect(save.gold).toBe(startGold);
    expect(save.stats.losses).toBe(1); // the loss still counts in stats
    const atFloor = applyMatchResult(save, 'medium', false, '2026-07-02', ECONOMY.minTurnsForLossGold);
    expect(atFloor).toEqual({ gold: ECONOMY.lossGold, firstWinBonus: false, tooEarly: false });
    // wins pay regardless of turn count
    const quickWin = applyMatchResult(save, 'easy', true, '2026-07-03', 1);
    expect(quickWin.gold).toBeGreaterThan(0);
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
  it('boosters contain boosterPackSize cards â€” no basics, no tokens â€” sorted worstâ†’best', () => {
    const save = freshSave(0);
    const rng = createRngState(42);
    const result = openPack(save, TEST_DB, rng);
    expect(result.cards).toHaveLength(ECONOMY.boosterPackSize);
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
          variantRank({ frame: cur.frame, holo: cur.holo, fullArt: cur.fullArt }),
        ).toBeGreaterThanOrEqual(
          variantRank({ frame: prev.frame, holo: prev.holo, fullArt: prev.fullArt }),
        );
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

  it('a set-scoped RagnarÃ¶k booster pulls only ragnarok cards, self-sufficient at every tier', () => {
    for (const tier of ['c', 'r', 'sr', 'ssr', 'ur'] as const) {
      const rgPool = packPool(CARD_DB, tier, 'ragnarok');
      expect(rgPool.length, `ragnarok ${tier} pool`).toBeGreaterThan(0);
      for (const id of rgPool) expect(id.startsWith('rg-'), `${id} in ragnarok pool`).toBe(true);
    }
    const result = openPack(freshSave(0), CARD_DB, createRngState(99), 'ragnarok');
    expect(result.cards).toHaveLength(ECONOMY.boosterPackSize);
    for (const c of result.cards) expect(CARD_DB[c.cardId].set).toBe('ragnarok');
  });

  it('a Celtic Fae booster charges its SKU price and pulls only cf- cards', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.celticFaePackPrice;

    expect(spendGold(save, ECONOMY.celticFaePackPrice)).toBe(true);
    const result = openPack(save, CARD_DB, createRngState(20260710), 'celtic-fae');

    expect(save.gold).toBe(0);
    expect(result.cards).toHaveLength(ECONOMY.boosterPackSize);
    for (const card of result.cards) {
      expect(card.cardId.startsWith('cf-'), `${card.cardId} must be Celtic Fae`).toBe(true);
      expect(CARD_DB[card.cardId].set).toBe('celtic-fae');
    }
  });

  it('a Gothic Monsters booster charges its SKU price and pulls only gm- cards', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.gothicMonstersPackPrice;

    expect(spendGold(save, ECONOMY.gothicMonstersPackPrice)).toBe(true);
    const result = openPack(save, CARD_DB, createRngState(20260717), 'gothic-monsters');

    expect(save.gold).toBe(0);
    expect(result.cards).toHaveLength(ECONOMY.boosterPackSize);
    for (const card of result.cards) {
      expect(card.cardId.startsWith('gm-'), `${card.cardId} must be Gothic Monsters`).toBe(true);
      expect(CARD_DB[card.cardId].set).toBe('gothic-monsters');
    }
  });

  it('dupe-protects the sr/ssr/ur slots (prefers sub-playset cards)', () => {
    // own a playset of every sr except dt_rhino â†’ every sr slot must roll it
    const srs = packPool(TEST_DB, 'sr');
    expect(srs.length).toBeGreaterThan(1);
    let srSeen = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const save = freshSave(0);
      for (const id of srs) {
        if (id === 'dt_rhino') continue;
        save.collection[id] = 4;
        save.collectionVariants[id] = { [variantKey(PLAIN_VARIANT)]: 4 };
      }
      const result = openPack(save, TEST_DB, createRngState(seed));
      const srPulls = result.cards.filter((c) => c.tier === 'sr');
      srSeen += srPulls.length;
      // Every sr slot must roll dt_rhino â€” unless dt_rhino completed its own
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
    // A db with no ssr/ur cards: those rolls must fall back (ssrâ†’sr, urâ†’ssrâ†’sr),
    // never crash. 30 packs â‰ˆ 450 slots â€” ssr/ur (6%) rolls are all but certain.
    const db = Object.fromEntries(
      Object.entries(TEST_DB).filter(([id]) => id !== 'murder' && id !== 'blaze'),
    );
    for (let seed = 1; seed <= 30; seed++) {
      const result = openPack(freshSave(0), db, createRngState(seed));
      expect(result.cards).toHaveLength(ECONOMY.boosterPackSize);
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

/** Save migration: every old version walks the whole chain to the current schema. */
describe('save migration old blobs â†’ current schema', () => {
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

    expect(m.data.version).toBe(22);
    expect(m.data.gold).toBe(640);
    expect(m.data.collection['bk-wolfqueen']).toBe(2);
    expect(m.data.decks).toEqual([
      { id: 'd1', name: 'Mine', cards: ['land-forest'], heroCardId: null, landStyle: null },
    ]);
    expect(m.data.activeDeckId).toBe('d1');
    expect(m.data.starterChosen).toBe('starter-wild');
    expect(m.data.stats.wins).toBe(5);
    expect(m.data.stats.byDifficulty.medium.w).toBe(2);
    // new fields spread in with defaults
    expect(m.data.gauntlet).toEqual({
      run: null,
      bestRung: 0,
      completions: 0,
      clearStyles: { monoColor: 0, dualColor: 0 },
    });
    expect(m.data.heroCardId).toBe(null); // v6 addition: auto face until chosen
    expect(m.data.heroPortraitId).toBe(null); // v9 addition: no premium hero until chosen
    expect(m.data.tutorialDone).toBe(true); // v10: a veteran (5 wins) skips the tutorial
    expect(m.data.achievements).toEqual({ unlocked: [], claimed: [] }); // v11
    expect(m.data.daily.quests).toHaveLength(ECONOMY.dailyQuestCount); // v13
    expect(m.data.daily.rerollsUsed).toBe(0);
    expect(m.data.limited).toEqual({ activeRun: null, history: [], bestSealedWins: 0, bestDraftWins: 0, personaSeen: {}, premiumWeek: { week: 0, entries: 0 } }); // v14/v19
    // v4: pre-variant copies become PLAIN; zero-count entries are not seeded
    expect(m.data.collectionVariants['bk-wolfqueen']).toEqual({ [variantKey(PLAIN_VARIANT)]: 2 });
    expect(m.data.collectionVariants['land-forest']).toBeUndefined();
    // settings: volume preserved, new toggles defaulted, animSpeed dropped,
    // and the v4 'auto' renderScale coerced to the v5 hard-coded default.
    expect(m.data.settings).toEqual({
      volume: 0.5,
      sfxOn: true,
      musicOn: true,
      animations: 'full',
      renderScale: 2,
      autoSkip: true,
      confirmDestructive: true, // v7 default
      keywordReminders: true, // v8 default
    });
    expect('animSpeed' in m.data.settings).toBe(false);
  });

  it('migrates a v2 blob to the current schema, keeping the gauntlet intact', () => {
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

    expect(m.data.version).toBe(22);
    expect(m.data.gold).toBe(320);
    // v2 data survives. v6 derives the seed from startedAt; v22 stamps the
    // legacy fixed-roster sentinel.
    expect(m.data.gauntlet).toEqual({
      run: { rung: 5, startedAt: 400, seed: 400, rosterDay: 0, rosterSeed: 0 },
      bestRung: 6,
      completions: 1,
      clearStyles: { monoColor: 0, dualColor: 0 },
    });
    expect(m.data.collectionVariants['oly-hera']).toEqual({ [variantKey(PLAIN_VARIANT)]: 1 });
    expect(m.data.settings.volume).toBe(0.3);
    expect(m.data.settings.musicOn).toBe(true); // the v3 addition, defaulting on
    expect(m.data.settings.renderScale).toBe(2); // v5: coerced from v4's 'auto'
    expect('animSpeed' in m.data.settings).toBe(false);
  });

  it('migrates a v3 blob to the current schema: variants seeded, settings rebuilt, animSpeed gone', () => {
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

    expect(m.data.version).toBe(22);
    expect(m.data.collection).toEqual({ 'bk-wolfqueen': 4, 'oly-hera': 1 });
    expect(m.data.collectionVariants).toEqual({
      'bk-wolfqueen': { [variantKey(PLAIN_VARIANT)]: 4 },
      'oly-hera': { [variantKey(PLAIN_VARIANT)]: 1 },
    });
    expectVariantSumInvariant(m.data);
    expect(m.data.settings).toEqual({
      volume: 0.6,
      sfxOn: true,
      musicOn: false, // preserved, not defaulted
      animations: 'full',
      renderScale: 2, // v5: coerced from the v4 'auto'
      autoSkip: true,
      confirmDestructive: true, // v7 default
      keywordReminders: true, // v8 default
    });
    expect('animSpeed' in m.data.settings).toBe(false);
    expect(m.data.gauntlet.bestRung).toBe(2);
  });

  it('migrates a v4 blob to the current schema: an explicit renderScale is preserved', () => {
    const storage = fakeStorage();
    const base = freshSave(1);
    const v4blob = { ...base, version: 4, settings: { ...base.settings, renderScale: 2 } };
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v4blob));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(22);
    expect(m.data.settings.renderScale).toBe(2); // 1440p choice survives
  });

  it("migrates a v4 blob to the current schema: the removed 'auto' is coerced to the default", () => {
    const storage = fakeStorage();
    const base = freshSave(1);
    const v4blob = {
      ...base,
      version: 4,
      // 'auto' is no longer a valid value in v5 â€” the migration must coerce it.
      settings: { ...base.settings, renderScale: 'auto' },
    };
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v4blob));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(22);
    expect(m.data.settings.renderScale).toBe(2);
  });

  it('migrates a v5 blob to the current schema: heroCardId defaults null, an in-progress run gets a seed', () => {
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
    expect(m.data.version).toBe(22);
    expect(m.data.heroCardId).toBe(null);
    // v6 derives the seed from startedAt; v22 stamps the legacy fixed-roster sentinel.
    expect(m.data.gauntlet.run).toEqual({ rung: 3, startedAt: 900, seed: 900, rosterDay: 0, rosterSeed: 0 });
    expect(m.data.gauntlet.bestRung).toBe(3);
  });

  it('migrates a v5 blob with no run and preserves an already-set heroCardId', () => {
    const storage = fakeStorage();
    const base = freshSave(1);
    const v5blob = { ...base, version: 5, heroCardId: 'oly-zeus', gauntlet: { run: null, bestRung: 5, completions: 2 } };
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v5blob));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(22);
    expect(m.data.heroCardId).toBe('oly-zeus'); // a pre-set hero survives
    expect(m.data.gauntlet).toEqual({
      run: null,
      bestRung: 5,
      completions: 2,
      clearStyles: { monoColor: 0, dualColor: 0 },
    });
  });

  it('migrates a v6 blob to the current schema: confirmDestructive defaults on, an explicit choice survives', () => {
    const base = freshSave(1);
    // A genuine v6 shape: settings without the v7 confirmDestructive field.
    const v6settings = { ...base.settings } as Record<string, unknown>;
    delete v6settings.confirmDestructive;

    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify({ ...base, version: 6, settings: v6settings }));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(22);
    expect(m.data.settings.confirmDestructive).toBe(true); // default on
    expect(m.data.settings.renderScale).toBe(base.settings.renderScale); // rest of settings intact

    // A veteran who had already turned the guard off keeps it off (no clobber).
    const s2 = fakeStorage();
    s2.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({ ...base, version: 6, settings: { ...v6settings, confirmDestructive: false } }),
    );
    const m2 = new SaveManager(s2);
    expect(m2.data.version).toBe(22);
    expect(m2.data.settings.confirmDestructive).toBe(false);
  });

  it('migrates a v7 blob to the current schema: keywordReminders defaults on, an explicit choice survives', () => {
    const base = freshSave(1);
    // A genuine v7 shape: settings without the v8 keywordReminders field.
    const v7settings = { ...base.settings } as Record<string, unknown>;
    delete v7settings.keywordReminders;

    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify({ ...base, version: 7, settings: v7settings }));
    const m = new SaveManager(storage);
    expect(m.data.version).toBe(22);
    expect(m.data.settings.keywordReminders).toBe(true); // default on
    expect(m.data.settings.confirmDestructive).toBe(base.settings.confirmDestructive); // v7 field intact

    // A veteran who turned reminders off keeps them off across the migration.
    const s2 = fakeStorage();
    s2.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({ ...base, version: 7, settings: { ...v7settings, keywordReminders: false } }),
    );
    const m2 = new SaveManager(s2);
    expect(m2.data.version).toBe(22);
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
    expect(m.data.version).toBe(22);
    expect(m.data.heroPortraitId).toBe(null); // default
    expect(m.data.heroCardId).toBe(base.heroCardId); // the rest is intact

    // A player who had already chosen a premium hero keeps it (no clobber).
    const s2 = fakeStorage();
    s2.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({ ...base, version: 8, heroPortraitId: 'hero-valhalla' }),
    );
    const m2 = new SaveManager(s2);
    expect(m2.data.version).toBe(22);
    expect(m2.data.heroPortraitId).toBe('hero-valhalla');
  });

  it('migrates a v9 blob to v10: tutorialDone is coerced from the win/loss record', () => {
    const base = freshSave(1);
    const v9 = (extra: Record<string, unknown>): Record<string, unknown> => {
      const blob = { ...base, version: 9, ...extra } as Record<string, unknown>;
      delete blob.tutorialDone; // a genuine v9 shape has no such field
      return blob;
    };

    // A zero-record player is still a newcomer â†’ sees the tutorial.
    const fresh = fakeStorage();
    fresh.raw.set('darlingblades.save.v1', JSON.stringify(v9({})));
    const mFresh = new SaveManager(fresh);
    expect(mFresh.data.version).toBe(22);
    expect(mFresh.data.tutorialDone).toBe(false);

    // A player with any win/loss record is a veteran â†’ tutorial already done.
    const vet = fakeStorage();
    vet.raw.set(
      'darlingblades.save.v1',
      JSON.stringify(v9({ stats: { ...base.stats, wins: 2, losses: 1 } })),
    );
    const mVet = new SaveManager(vet);
    expect(mVet.data.tutorialDone).toBe(true);

    // The flag is always derived from the record, so a stray/leaked value can't
    // override it (the v1â†’v2 step spreads the fresh-save default into the blob).
    const spurious = fakeStorage();
    spurious.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({ ...base, version: 9, tutorialDone: false, stats: { ...base.stats, wins: 9 } }),
    );
    expect(new SaveManager(spurious).data.tutorialDone).toBe(true);
  });

  it('migrates a v10 blob to v11: achievements default empty', () => {
    const base = freshSave(1);
    const v10blob = { ...base, version: 10 } as Record<string, unknown>;
    delete v10blob.achievements;
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v10blob));

    const m = new SaveManager(storage);

    expect(m.data.version).toBe(22);
    expect(m.data.achievements).toEqual({ unlocked: [], claimed: [] });
    expect(m.data.gauntlet.clearStyles).toEqual({ monoColor: 0, dualColor: 0 });
    expect(m.data.tutorialDone).toBe(base.tutorialDone);
  });

  it('migrates a v11 blob through the chain: gauntlet clear styles and limited default empty', () => {
    const base = freshSave(1);
    const v11blob = { ...base, version: 11, gauntlet: { run: null, bestRung: 10, completions: 3 } } as Record<
      string,
      unknown
    >;
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v11blob));

    const m = new SaveManager(storage);

    expect(m.data.version).toBe(22);
    expect(m.data.gauntlet).toEqual({
      run: null,
      bestRung: 10,
      completions: 3,
      clearStyles: { monoColor: 0, dualColor: 0 },
    });
    expect(m.data.daily.quests).toHaveLength(ECONOMY.dailyQuestCount);
    expect(m.data.limited).toEqual({ activeRun: null, history: [], bestSealedWins: 0, bestDraftWins: 0, personaSeen: {}, premiumWeek: { week: 0, entries: 0 } });
  });

  it('migrates a v12 blob forward: daily quests, streaks, and limited default', () => {
    const base = freshSave(new Date(2026, 6, 7).getTime());
    const v12blob = { ...base, version: 12 } as Record<string, unknown>;
    delete v12blob.daily;
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v12blob));

    const m = new SaveManager(storage, new Date(2026, 6, 8).getTime());

    expect(m.data.version).toBe(22);
    expect(m.data.daily.day).toBe('2026-07-08');
    expect(m.data.daily.quests).toHaveLength(ECONOMY.dailyQuestCount);
    expect(new Set(m.data.daily.quests.map((q) => q.id)).size).toBe(ECONOMY.dailyQuestCount);
    expect(m.data.daily.rerollsUsed).toBe(0);
    expect(m.data.daily.streak).toEqual({ count: 0, lastWinDay: null });
    expect(m.data.limited).toEqual({ activeRun: null, history: [], bestSealedWins: 0, bestDraftWins: 0, personaSeen: {}, premiumWeek: { week: 0, entries: 0 } });
  });

  it('migrates a v13 blob forward: limited defaults empty', () => {
    const base = freshSave(new Date(2026, 6, 8).getTime());
    const v13blob = { ...base, version: 13 } as Record<string, unknown>;
    delete v13blob.limited;
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v13blob));

    const m = new SaveManager(storage, new Date(2026, 6, 8).getTime());

    expect(m.data.version).toBe(22);
    expect(m.data.daily.day).toBe('2026-07-08');
    expect(m.data.limited).toEqual({ activeRun: null, history: [], bestSealedWins: 0, bestDraftWins: 0, personaSeen: {}, premiumWeek: { week: 0, entries: 0 } });
  });

  it('migrates a v14 blob forward: saved decks gain per-deck hero selections', () => {
    const base = freshSave(new Date(2026, 6, 8).getTime());
    const v14blob = {
      ...base,
      version: 14,
      heroCardId: 'hero-card',
      decks: [
        { id: 'with-default', name: 'With Default', cards: ['hero-card', 'other-card'] },
        { id: 'without-default', name: 'Without Default', cards: ['other-card'] },
        { id: 'explicit', name: 'Explicit', cards: ['alpha', 'beta'], heroCardId: 'beta' },
        { id: 'stale', name: 'Stale', cards: ['alpha'], heroCardId: 'missing' },
      ],
    } as Record<string, unknown>;
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v14blob));

    const m = new SaveManager(storage, new Date(2026, 6, 8).getTime());

    expect(m.data.version).toBe(22);
    expect(m.data.decks).toEqual([
      {
        id: 'with-default',
        name: 'With Default',
        cards: ['hero-card', 'other-card'],
        heroCardId: 'hero-card',
        landStyle: null,
      },
      { id: 'without-default', name: 'Without Default', cards: ['other-card'], heroCardId: null, landStyle: null },
      { id: 'explicit', name: 'Explicit', cards: ['alpha', 'beta'], heroCardId: 'beta', landStyle: null },
      { id: 'stale', name: 'Stale', cards: ['alpha'], heroCardId: null, landStyle: null },
    ]);
  });

  it('migrates a v15 blob forward: backfills in-flight draft personas and leaves sealed runs intact', () => {
    const now = new Date(2026, 6, 8).getTime();
    const seed = 4815;
    const rosterIds = DRAFT_PERSONAS.map((persona) => persona.id);
    const draftRun = startDraftRun(CARD_DB, seed, now);
    const legacyDraft = { ...draftRun.draft } as Record<string, unknown>;
    delete legacyDraft.personaIds;
    const draftStorage = fakeStorage();
    draftStorage.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({
        ...freshSave(now),
        version: 15,
        limited: {
          ...freshSave(now).limited,
          activeRun: { ...draftRun, draft: legacyDraft },
        },
      }),
    );

    const migratedDraft = new SaveManager(draftStorage, now);
    expect(migratedDraft.data.version).toBe(22);
    expect(migratedDraft.data.limited.activeRun?.draft?.personaIds).toEqual(assignDraftPersonas(seed, rosterIds));

    const sealedRun = startSealedRun(CARD_DB, seed, now);
    const sealedStorage = fakeStorage();
    sealedStorage.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({
        ...freshSave(now),
        version: 15,
        limited: { ...freshSave(now).limited, activeRun: sealedRun },
      }),
    );

    const migratedSealed = new SaveManager(sealedStorage, now);
    expect(migratedSealed.data.version).toBe(22);
    expect(migratedSealed.data.limited.activeRun).toEqual(sealedRun);
  });

  it('migrates a v16 blob forward: persona familiarity counters default empty, everything else intact', () => {
    const now = new Date(2026, 6, 14).getTime();
    const v16Save = { ...freshSave(now), gold: 321 } as Record<string, unknown>;
    const v16Limited = { ...freshSave(now).limited } as Record<string, unknown>;
    delete v16Limited.personaSeen;
    v16Save.version = 16;
    v16Save.limited = v16Limited;
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v16Save));

    const m = new SaveManager(storage, now);
    expect(m.data.version).toBe(22);
    expect(m.data.limited.personaSeen).toEqual({});
    expect(m.data.gold).toBe(321);
  });

  it('migrates a v17 blob to v19 with every existing field preserved', () => {
    const now = new Date(2026, 6, 14).getTime();
    const activeRun = startDraftRun(CARD_DB, 1718, now);
    const v17Save = {
      ...freshSave(now),
      version: 17,
      gold: 1718,
      limited: { ...freshSave(now).limited, activeRun },
    };
    const storage = fakeStorage();
    storage.raw.set('darlingblades.save.v1', JSON.stringify(v17Save));

    const m = new SaveManager(storage, now);

    expect(m.data.version).toBe(22);
    expect(m.data.gold).toBe(1718);
    expect(m.data.limited.activeRun).toEqual(activeRun);
  });

  it('leaves an existing current-version save untouched and round-trips the new settings', () => {
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
    expect(b.data.version).toBe(22);
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
    save.gauntlet.run = {
      rung: 1,
      startedAt: 10,
      seed: 777,
      rosterDay: 20260720,
      rosterSeed: 12345,
    };
    const r = applyGauntletResult(save, 1, 'easy', true, '2026-07-02');
    // rung 1 gold 50 + first-win-of-day 100
    expect(r.gold).toBe(ECONOMY.gauntletRungGold[0] + ECONOMY.firstWinOfDayBonus);
    expect(r.firstWinBonus).toBe(true);
    expect(r.completed).toBe(false);
    expect(r.runOver).toBe(false);
    expect(r.nextRung).toBe(2);
    // The run climbs with both duel and roster identity carried forward.
    expect(save.gauntlet.run).toEqual({
      rung: 2,
      startedAt: 10,
      seed: 777,
      rosterDay: 20260720,
      rosterSeed: 12345,
    });
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

  it('clearing the final rung pays the completion bonus and ends the run', () => {
    const finalRung = ECONOMY.gauntletRungGold.length; // 16 since the Gothic Monsters summit
    const save = freshSave(0);
    save.stats.lastWinDay = '2026-07-02'; // no first-win bonus this time
    save.gauntlet.run = { rung: finalRung, startedAt: 1, seed: 42 };
    const r = applyGauntletResult(save, finalRung, 'hard', true, '2026-07-02');
    expect(r.gold).toBe(ECONOMY.gauntletRungGold[finalRung - 1] + ECONOMY.gauntletCompletionBonus);
    expect(r.completed).toBe(true);
    expect(r.runOver).toBe(true);
    expect(r.nextRung).toBeNull();
    expect(save.gauntlet.run).toBeNull();
    expect(save.gauntlet.completions).toBe(1);
    expect(save.gauntlet.bestRung).toBe(finalRung);
    expect(save.gauntlet.clearStyles).toEqual({ monoColor: 0, dualColor: 0 });
  });

  it('records mono-color and dual-color full clears when provided', () => {
    const finalRung = ECONOMY.gauntletRungGold.length;
    const mono = freshSave(0);
    mono.stats.lastWinDay = '2026-07-02';
    mono.gauntlet.run = { rung: finalRung, startedAt: 1, seed: 42 };
    applyGauntletResult(mono, finalRung, 'hard', true, '2026-07-02', 'monoColor');
    expect(mono.gauntlet.clearStyles).toEqual({ monoColor: 1, dualColor: 0 });

    const dual = freshSave(0);
    dual.stats.lastWinDay = '2026-07-02';
    dual.gauntlet.run = { rung: finalRung, startedAt: 1, seed: 42 };
    applyGauntletResult(dual, finalRung, 'hard', true, '2026-07-02', 'dualColor');
    expect(dual.gauntlet.clearStyles).toEqual({ monoColor: 0, dualColor: 1 });
  });

  it('a full 16-rung run pays exactly 3450 gold plus the daily bonus once', () => {
    const save = freshSave(0);
    save.gauntlet.run = { rung: 1, startedAt: 1, seed: 42 };
    let total = 0;
    for (let rung = 1; rung <= ECONOMY.gauntletRungGold.length; rung++) {
      const diff = rung <= 3 ? 'easy' : rung <= 6 ? 'medium' : 'hard';
      total += applyGauntletResult(save, rung, diff, true, '2026-07-02').gold;
    }
    const rungSum = ECONOMY.gauntletRungGold.reduce((s, g) => s + g, 0);
    expect(rungSum).toBe(3200); // 50+70+…+350 across 16 rungs (1.3 added 15-16)
    expect(total).toBe(rungSum + ECONOMY.gauntletCompletionBonus + ECONOMY.firstWinOfDayBonus);
    expect(total).toBe(3550); // 3200 + 250 + 100 (daily bonus once)
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

describe('buyThemeDeck (RagnarÃ¶k precon)', () => {
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

  it('is idempotent â€” a second buy is a no-op that does not spend gold', () => {
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

describe('previewDeckGrant (the shop preview\'s "what you get" math)', () => {
  const deck = THEME_DECKS[0];

  it('mirrors grantDeckCards: the predicted grant equals the copies a buy actually adds', () => {
    const save = freshSave(0);
    // Partial ownership: two copies of one of the deck's non-basics via the
    // real addCard path (keeps the variant-sum invariant intact).
    const aNonBasic = deck.cards.find((id) => !CARD_DB[id].supertypes?.includes('basic'))!;
    addCard(save, CARD_DB, aNonBasic, PLAIN_VARIANT);
    addCard(save, CARD_DB, aNonBasic, PLAIN_VARIANT);
    const before = { ...save.collection };

    const p = previewDeckGrant(save, CARD_DB, deck.cards);
    expect(p.ownedCopies).toBe(2);
    expect(p.nonBasicCopies).toBe(p.ownedCopies + p.grantedCopies);

    save.gold = ECONOMY.preconPrice;
    expect(buyThemeDeck(save, CARD_DB, deck)).toBe(true);
    const added = Object.entries(save.collection).reduce(
      (sum, [id, n]) => sum + n - (before[id] ?? 0),
      0,
    );
    expect(added).toBe(p.grantedCopies);
    expectVariantSumInvariant(save);
  });

  it('owned copies past the deck requirement do not overcount, and a full collection grants zero', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.preconPrice;
    expect(buyThemeDeck(save, CARD_DB, deck)).toBe(true);
    // Overshoot a card the deck runs at 2 (below the playset cap, so the extra
    // plain copy sticks instead of auto-melting) — the preview caps at need.
    addCard(save, CARD_DB, 'rg-jotun-warleader', PLAIN_VARIANT);
    expect(save.collection['rg-jotun-warleader']).toBe(3);

    const p = previewDeckGrant(save, CARD_DB, deck.cards);
    expect(p.grantedCopies).toBe(0);
    expect(p.ownedCopies).toBe(p.nonBasicCopies);
  });
});

describe('buyThemeDeck (Glimmer Bargain precon)', () => {
  const deck = THEME_DECKS.find((d) => d.id === 'theme-celtic-fae')!;

  it('spends preconPrice, grants every non-basic card, and adds the full deck', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.preconPrice + 50;

    expect(buyThemeDeck(save, CARD_DB, deck)).toBe(true);
    expect(save.gold).toBe(50);
    expect(save.decks.find((saved) => saved.id === deck.id)).toMatchObject({
      name: 'Glimmer Bargain',
      cards: deck.cards,
    });

    const counts = new Map<string, number>();
    for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, count] of counts) {
      if (!CARD_DB[id].supertypes?.includes('basic')) expect(save.collection[id]).toBe(count);
    }
  });
});
