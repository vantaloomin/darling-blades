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
  reserveLandChipLabel,
  visibleBuilderFormatTabs,
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
    // The warchest FORMAT reads as Standard (owner 2026-08-18); "Warchest"
    // stays the land system's name.
    expect(formatLabel('warchest')).toBe('Standard');
    expect(formatDeckSize('constructed')).toBe(60);
    expect(formatDeckSize('darlings')).toBe(DARLINGS_DECK_SIZE);
    expect(formatDeckSize('warchest')).toBe(WARCHEST_DECK_SIZE);
    expect(formatGauntletUnavailableCopy('darlings', false)).toBe('Darlings decks are available in Practice only.');
    expect(formatGauntletUnavailableCopy('warchest', false)).toBe('Warchest decks are available in Practice only.');
    expect(WARCHEST_RULES_COPY).toBe(
      'Your deck is 40 spells and you open with 5 cards. Build your Warchest: 10 lands, up to 5 dual lands. Each turn you move one land from your Warchest Reserves into your Active Warchest. Dual lands arrive tapped. If a dual land is destroyed it is gone; destroyed basic lands return to your Reserves.',
    );
    expect(WARCHEST_RULES_COPY).not.toContain('\u2014');
    expect(DARLINGS_RULES_COPY).toBe(
      'Choose your Darling. She waits in her own zone, ready when you call. Build a 79-card deck in her colors, one copy of each card, and a Warchest of 10 lands. You open with 5 cards. Each time she falls, her next call costs 2 more.',
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

    expect(offeredBuilderFormats(false, false)).toEqual(['constructed']);
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

    expect(offeredBuilderFormats(true, false)).toEqual(['constructed', 'warchest', 'darlings']);
    expect(visibleSavedDecks(decks, true).map((deck) => deck.id)).toEqual(['constructed', 'darlings', 'warchest']);
    expect(activeVisibleSavedDeck(decks, 'warchest', true)?.id).toBe('warchest');
    expect(isReplayVisible({ format: 'darlings' }, true)).toBe(true);
  });

  it('retires Constructed from the offered formats while keeping classic decks visible', () => {
    const save = freshSave(0);
    const constructed = { ...save.decks[0], id: 'constructed', format: 'constructed' as const };
    const darlings = { ...save.decks[0], id: 'darlings', format: 'darlings' as const };
    const decks = [constructed, darlings];

    // Standard (warchest) leads; Darlings is the specialty format.
    expect(offeredBuilderFormats(true, true)).toEqual(['warchest', 'darlings']);
    // A retired classic deck is never hidden or reassigned: it stays listed and
    // stays the active deck so the flag-and-fix flow can route the player to it.
    expect(visibleSavedDecks(decks, true).map((deck) => deck.id)).toEqual(['constructed', 'darlings']);
    expect(activeVisibleSavedDeck(decks, 'constructed', true)?.id).toBe('constructed');
    expect(builderFormatForDeck(constructed, true)).toBe('constructed');
  });

  it('opens the Tower to Warchest at retirement and leaves Darlings in Practice', () => {
    expect(formatGauntletUnavailableCopy('warchest', true)).toBeNull();
    expect(formatGauntletUnavailableCopy('darlings', true)).toBe('Darlings decks are available in Practice only.');
    expect(formatGauntletUnavailableCopy('constructed', true)).toBeNull();
  });

  it('offers every format as a live two-way conversion tab', () => {
    // Owner reversal 2026-08-18: the old identity-tab rule made Darlings
    // conversion one-way (Darlings -> Warchest deleted the way back).
    const offered = offeredBuilderFormats(true, false);
    expect(visibleBuilderFormatTabs(offered)).toEqual(offered);
    expect(visibleBuilderFormatTabs(offeredBuilderFormats(true, true))).toEqual(
      offeredBuilderFormats(true, true),
    );
  });

  it('compacts long reserve names for the legacy chip label', () => {
    expect(reserveLandChipLabel(1, 'Red Cliffs Anchorage')).toBe('1 Red Cli…');
    expect(reserveLandChipLabel(10, 'Red Cliffs Anchorage')).toBe('10 Red Cl…');
    expect(reserveLandChipLabel(10, 'Red Cliffs Anchorage')).toHaveLength(10);
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
