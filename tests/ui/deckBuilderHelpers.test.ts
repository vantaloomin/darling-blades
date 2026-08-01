import { describe, expect, it } from 'vitest';
import { freshSave } from '../../src/meta/SaveManager';
import { DARLINGS_DECK_SIZE, WARCHEST_DECK_SIZE } from '../../src/meta/warchest';
import { backLabelFor } from '../../src/ui/navigation';
import {
  activeVisibleSavedDeck,
  WARCHEST_RULES_COPY,
  DARLINGS_RULES_COPY,
  builderFormatForDeck,
  collapseDeckRows,
  isReplayVisible,
  isSavedDeckVisible,
  formatDeckSize,
  formatLabel,
  formatGauntletUnavailableCopy,
  formatPageCount,
  formatPageSlice,
  gridPosition,
  isDeckBuilderDirty,
  offeredBuilderFormats,
  visibleSavedDecks,
} from '../../src/ui/deckBuilderHelpers';

describe('deck builder helpers', () => {
  it('maps back destinations to the canonical player-facing nouns', () => {
    expect(backLabelFor('MainMenu')).toBe('Menu');
    expect(backLabelFor('Play')).toBe('Play');
    expect(backLabelFor('Draft')).toBe('Draft');
    expect(backLabelFor('Shop')).toBe('Shop');
    expect(backLabelFor('Profile')).toBe('Profile');
  });

  it('keeps format labels, sizes, and launch copy explicit', () => {
    expect(formatLabel('constructed')).toBe('Constructed');
    expect(formatLabel('darlings')).toBe('Darlings');
    expect(formatLabel('warchest')).toBe('Warchest');
    expect(formatDeckSize('constructed')).toBe(60);
    expect(formatDeckSize('darlings')).toBe(DARLINGS_DECK_SIZE);
    expect(formatDeckSize('warchest')).toBe(WARCHEST_DECK_SIZE);
    expect(formatGauntletUnavailableCopy('darlings')).toBe('Darlings decks are available in Practice only.');
    expect(formatGauntletUnavailableCopy('warchest')).toBe('Warchest decks are available in Practice only.');
    expect(WARCHEST_RULES_COPY).toBe(
      'Build your Warchest: 10 lands, up to 5 dual lands. Each turn you move one land from your Warchest Reserves into your Active Warchest. Dual lands arrive tapped. If a dual land is destroyed it is gone; destroyed basic lands return to your Reserves.',
    );
    expect(WARCHEST_RULES_COPY).not.toContain('\u2014');
    expect(DARLINGS_RULES_COPY).toBe(
      'Choose your Darling. Build an 80-card deck in her colors, one copy of each card, and a Warchest of 10 lands. Your Darling begins in your deck and follows the same rules as every other card.',
    );
    expect(DARLINGS_RULES_COPY).not.toContain('\u2014');
  });

  it('offers only Constructed and hides saved reserve decks when the flag is off', () => {
    const save = freshSave(0);
    const constructed = { ...save.decks[0], id: 'constructed', format: 'constructed' as const };
    const darlings = { ...save.decks[0], id: 'darlings', format: 'darlings' as const };
    const warchest = { ...save.decks[0], id: 'warchest', format: 'warchest' as const };
    const decks = [constructed, darlings, warchest];
    const hiddenSnapshot = structuredClone(darlings);

    expect(offeredBuilderFormats(false)).toEqual(['constructed']);
    expect(visibleSavedDecks(decks, false).map((deck) => deck.id)).toEqual(['constructed']);
    expect(isSavedDeckVisible(darlings, false)).toBe(false);
    expect(builderFormatForDeck(darlings, false)).toBe('constructed');
    expect(activeVisibleSavedDeck(decks, 'darlings', false)?.id).toBe('constructed');
    expect(darlings).toEqual(hiddenSnapshot);
    expect(isReplayVisible({ format: 'warchest' }, false)).toBe(false);
  });

  it('restores reserve formats, saved decks, and replay visibility when the flag is on', () => {
    const save = freshSave(0);
    const constructed = { ...save.decks[0], id: 'constructed', format: 'constructed' as const };
    const darlings = { ...save.decks[0], id: 'darlings', format: 'darlings' as const };
    const warchest = { ...save.decks[0], id: 'warchest', format: 'warchest' as const };
    const decks = [constructed, darlings, warchest];

    expect(offeredBuilderFormats(true)).toEqual(['constructed', 'darlings', 'warchest']);
    expect(visibleSavedDecks(decks, true).map((deck) => deck.id)).toEqual(['constructed', 'darlings', 'warchest']);
    expect(activeVisibleSavedDeck(decks, 'warchest', true)?.id).toBe('warchest');
    expect(isReplayVisible({ format: 'darlings' }, true)).toBe(true);
  });

  it('clamps empty paging inputs and preserves item order', () => {
    expect(formatPageCount(0, 6)).toBe(1);
    expect(formatPageCount(13, 6)).toBe(3);
    expect(formatPageSlice(['a', 'b', 'c'], -1, 2)).toEqual(['a', 'b']);
    expect(formatPageSlice(['a', 'b', 'c'], 1, 2)).toEqual(['c']);
  });

  it('produces deterministic grid positions', () => {
    expect(gridPosition(0, 3, 10, 20, 100, 40)).toEqual({ x: 10, y: 20 });
    expect(gridPosition(4, 3, 10, 20, 100, 40)).toEqual({ x: 110, y: 60 });
  });

  it('collapses every deck format to one row per card and retains a legacy-pin marker', () => {
    expect(collapseDeckRows(['bear', 'elf', 'bear', 'bear', 'elf'], [null, 'blue|none|standard', null, 'red|none|standard', null])).toEqual([
      { cardId: 'bear', quantity: 3, firstIndex: 0, hasLegacyVariantPin: true },
      { cardId: 'elf', quantity: 2, firstIndex: 1, hasLegacyVariantPin: true },
    ]);
    expect(collapseDeckRows(['darling'], [null])).toEqual([
      { cardId: 'darling', quantity: 1, firstIndex: 0, hasLegacyVariantPin: false },
    ]);
  });

  it('detects deck, treatment-pin, reserve, and hero edits against the saved record', () => {
    const saved = {
      cards: ['a', 'b'],
      variantPins: [null, 'blue|none|standard'],
      landReserve: ['land-plains'],
      heroCardId: null,
    };
    const sameWorking = { cards: ['a', 'b'], variantPins: [null, 'blue|none|standard'], landReserve: [], heroCardId: null };
    expect(isDeckBuilderDirty({ ...sameWorking, landReserve: ['land-plains'] }, saved)).toBe(false);
    expect(isDeckBuilderDirty({ ...sameWorking, cards: ['b', 'a'], landReserve: ['land-plains'] }, saved)).toBe(true);
    expect(isDeckBuilderDirty({ ...sameWorking, variantPins: [null, null], landReserve: ['land-plains'] }, saved)).toBe(true);
    expect(isDeckBuilderDirty(sameWorking, saved)).toBe(true);
    expect(isDeckBuilderDirty({ ...sameWorking, heroCardId: 'a', landReserve: ['land-plains'] }, saved)).toBe(true);
    expect(isDeckBuilderDirty({ cards: [], variantPins: [], landReserve: [], heroCardId: null }, null)).toBe(false);
    expect(isDeckBuilderDirty({ cards: ['a'], variantPins: [null], landReserve: [], heroCardId: null }, null)).toBe(true);
  });
});
