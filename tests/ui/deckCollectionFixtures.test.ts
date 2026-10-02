import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_DB } from '../../src/data/catalog';
import { STARTER_DECKS, THEME_DECKS } from '../../src/data/starterDecks';
import { collectiblePool } from '../../src/meta/collectionFilter';
import { validateDarlingsDeck } from '../../src/meta/darlings';
import { ownedCount, ownedVariants } from '../../src/meta/Collection';
import { collapseDeckRows } from '../../src/ui/deckBuilderHelpers';
import { deckPageCount, deckPageSlice } from '../../src/ui/deckListPaging';
import { WAVE_2B_FIXTURE_IDS, wave2BFixtureSave } from '../../src/dev/deckCollectionFixtures';

describe('Deck Builder and Collection accessibility fixtures', () => {
  it('supplies an owned, legal singleton Darlings deck with its Darling outside the list', () => {
    const save = wave2BFixtureSave();
    const deck = save.decks.find((entry) => entry.id === WAVE_2B_FIXTURE_IDS.darlings)!;
    expect(deck.format).toBe('darlings');
    expect(validateDarlingsDeck(CARD_DB, save, deck.cards, deck.darlingId ?? null, deck.landReserve ?? [])).toEqual([]);
    expect(deck.cards).not.toContain(deck.darlingId);
  });

  it('lets the binder browse every collectible with consistent aggregate and variant ownership', () => {
    const save = wave2BFixtureSave();
    for (const card of collectiblePool(ALL_CARDS)) {
      expect(ownedCount(save, card.id), card.id).toBe(4);
      expect(Object.values(ownedVariants(save, card.id)).reduce((sum, count) => sum + count, 0), card.id)
        .toBe(ownedCount(save, card.id));
    }
  });

  it.each([5, 6, 12])('keeps every catalog identity reachable through %i-row pages', (rowsPerPage) => {
    const save = wave2BFixtureSave();
    const deck = save.decks.find((entry) => entry.id === WAVE_2B_FIXTURE_IDS.fullCatalog)!;
    const rows = collapseDeckRows(deck.cards, deck.variantPins ?? []);
    const reached = Array.from({ length: deckPageCount(rows.length, rowsPerPage) }, (_, page) =>
      deckPageSlice(rows, page, rowsPerPage)).flat().map((row) => row.cardId);
    const expected = collectiblePool(ALL_CARDS).map((card) => card.id);
    expect(new Set(reached)).toEqual(new Set(expected));
    expect(reached).toHaveLength(new Set(expected).size);
    const longest = collectiblePool(ALL_CARDS).reduce((left, right) => left.name.length >= right.name.length ? left : right);
    expect(reached).toContain(longest.id);
  });

  it('includes the longest authored deck identities and an empty working list', () => {
    const save = wave2BFixtureSave();
    const sources = [...STARTER_DECKS, ...THEME_DECKS];
    const longest = sources.reduce((left, right) => left.name.length >= right.name.length ? left : right);
    for (const source of sources.filter((entry) => entry.name.length === longest.name.length)) {
      expect(save.decks.some((entry) => entry.name === source.name)).toBe(true);
    }
    expect(save.decks.find((entry) => entry.id === WAVE_2B_FIXTURE_IDS.empty)?.cards).toEqual([]);
    expect(save.decks.every((entry) => sources.some((source) => source.name === entry.name))).toBe(true);
  });

  it('isolates edits from later fixtures and from canonical deck data', () => {
    const canonical = structuredClone([...STARTER_DECKS, ...THEME_DECKS]);
    const before = wave2BFixtureSave();
    const edited = wave2BFixtureSave();
    const firstCard = edited.decks[0].cards[0];
    edited.gold = 0;
    edited.settings.textScale = 1.3;
    edited.collection[firstCard] = 0;
    edited.collectionVariants[firstCard]['white|none|standard'] = 0;
    edited.pinnedVariants[firstCard] = 'black|void|full-art';
    for (const deck of edited.decks) {
      deck.cards.splice(0, 1);
      deck.landReserve?.splice(0, 1);
      deck.variantPins?.push('black|void|full-art');
    }
    expect(wave2BFixtureSave()).toEqual(before);
    expect([...STARTER_DECKS, ...THEME_DECKS]).toEqual(canonical);
  });
});
