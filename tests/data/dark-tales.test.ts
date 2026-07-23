import { describe, expect, it } from 'vitest';
import { DROPS, ECONOMY } from '../../src/config/rules';
import { DARK_TALES } from '../../src/data/cards/dark-tales';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { TOKENS } from '../../src/data/cards/tokens';
import { THEME_DECKS } from '../../src/data/starterDecks';
import type { Keyword } from '../../src/engine/types';
import { applyFilters, defaultFilterState } from '../../src/meta/collectionFilter';
import { grantDeckCards } from '../../src/meta/Economy';
import { packPool, openPack } from '../../src/meta/PackOpener';
import { validateDeck } from '../../src/meta/DeckStorage';
import { freshSave } from '../../src/meta/SaveManager';
import { createRngState } from '../../src/engine/rng';

const RARITY_COUNTS = { c: 60, r: 36, sr: 11, ssr: 8, ur: 5 } as const;
const KEYWORDS = new Set<Keyword>([
  'skyborne', 'wardingGaze', 'firstBlade', 'twinBlades', 'warcry', 'overrun',
  'sentinel', 'bulwark', 'deathblade', 'bloodoath', 'untouchable', 'dreaded',
]);
const OPS = new Set([
  'damage', 'gainLife', 'loseLife', 'draw', 'discardRandom', 'destroy', 'sever',
  'severGrave', 'severTop', 'recall', 'destroyArtifactOrSeverEnchantment', 'cancel',
  'boost', 'addCounters', 'tap', 'fetchLand', 'createToken', 'massDestroy',
  'preventCombat', 'reclaim', 'grind', 'foresee', 'awaken', 'raise',
]);

describe('Dark Tales data integrity', () => {
  it('contains all 120 rows with the approved rarity histogram and namespace', () => {
    expect(DARK_TALES).toHaveLength(120);
    expect(Object.fromEntries(Object.keys(RARITY_COUNTS).map((rarity) => [
      rarity,
      DARK_TALES.filter((card) => card.rarity === rarity).length,
    ]))).toEqual(RARITY_COUNTS);
    for (const card of DARK_TALES) {
      expect(card.id.startsWith('dt-'), `${card.id} should use dt-`).toBe(true);
      expect(card.set).toBe('dark-tales');
      expect(CARD_DB[card.id].set).toBe('dark-tales');
    }
  });

  it('uses only engine keywords and operations, with trigger-safe non-spell abilities', () => {
    for (const card of DARK_TALES) {
      for (const keyword of card.keywords ?? []) expect(KEYWORDS.has(keyword), `${card.id}: ${keyword}`).toBe(true);
      for (const ability of card.abilities ?? []) {
        if (ability.when !== 'spell') expect(ability.targets, `${card.id} trigger targets`).toBeUndefined();
        for (const op of ability.ops ?? []) expect(OPS.has(op.op), `${card.id}: ${op.op}`).toBe(true);
      }
      for (const op of card.retell?.ops ?? []) expect(OPS.has(op.op), `${card.id} Retell: ${op.op}`).toBe(true);
    }
  });

  it('keeps the multicolor legend idiom and gives every creature a subtype', () => {
    for (const card of DARK_TALES) {
      if (card.types.includes('creature')) expect(card.subtypes.length, card.id).toBeGreaterThan(0);
      if (!card.types.includes('land') && card.colors.length > 1) {
        expect(card.supertypes, `${card.id} must be legendary`).toContain('legendary');
      }
    }
    expect(DARK_TALES.filter((card) => card.types.includes('creature') && card.subtypes.includes('Mermaid')).length).toBe(4);
  });

  it('wires exactly the four set-unique tokens and keeps them out of boosters', () => {
    const tokenIds = ['tok-shadow-miner', 'tok-firefly', 'tok-masked-guest', 'tok-hearth-spirit'];
    expect(TOKENS.filter((card) => tokenIds.includes(card.id))).toHaveLength(4);
    for (const id of tokenIds) expect(CARD_DB[id]).toMatchObject({ id, token: true });
    const tokenOps = DARK_TALES.flatMap((card) => (card.abilities ?? []).flatMap((ability) => ability.ops ?? []))
      .filter((op): op is Extract<typeof op, { op: 'createToken' }> => op.op === 'createToken')
      .map((op) => op.token);
    expect([...new Set(tokenOps)].sort()).toEqual(tokenIds.slice(1).concat(tokenIds[0]).sort());
    for (const tier of Object.keys(RARITY_COUNTS) as Array<keyof typeof RARITY_COUNTS>) {
      const pool = packPool(CARD_DB, tier, 'dark-tales');
      expect(pool.length, `${tier} pool`).toBeGreaterThan(0);
      expect(pool.every((id) => id.startsWith('dt-'))).toBe(true);
    }
  });

  it('round-trips the set filter and the 525g set booster', () => {
    const filtered = applyFilters(ALL_CARDS, { ...defaultFilterState(), set: 'dark-tales' }, freshSave(0));
    expect(filtered.map((card) => card.id).sort()).toEqual(DARK_TALES.map((card) => card.id).sort());
    expect(ECONOMY.darkTalesPackPrice).toBe(525);
    const save = freshSave(0);
    const result = openPack(save, CARD_DB, createRngState(20_260_723), 'dark-tales');
    expect(result.cards).toHaveLength(ECONOMY.boosterPackSize);
    expect(result.cards.every((card) => CARD_DB[card.cardId].set === 'dark-tales')).toBe(true);
    for (const axis of [DROPS.tier, DROPS.frame, DROPS.holo, DROPS.fullArt]) {
      expect(axis.reduce((sum, [, weight]) => sum + weight, 0)).toBeCloseTo(100, 9);
    }
  });
});

describe('Midnight Storybook precon', () => {
  const deck = THEME_DECKS.find((entry) => entry.id === 'theme-dark-tales')!;

  it('is a legal 60-card U/B/W Dark Tales deck with 24 lands and no off-set splash', () => {
    expect(deck.name).toBe('Midnight Storybook');
    expect(deck.cards).toHaveLength(60);
    expect(deck.cards.filter((id) => CARD_DB[id].types.includes('land'))).toHaveLength(24);
    const counts = new Map<string, number>();
    for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, count] of counts) {
      if (!CARD_DB[id].supertypes?.includes('basic')) expect(count, `${id} copies`).toBeLessThanOrEqual(4);
      const card = CARD_DB[id];
      if (!card.types.includes('land')) expect(card.set, `${id} set`).toBe('dark-tales');
    }
    const save = freshSave(0);
    grantDeckCards(save, CARD_DB, deck.cards);
    expect(validateDeck(CARD_DB, save, deck.cards).filter((issue) => issue.kind === 'error')).toHaveLength(0);
  });
});
