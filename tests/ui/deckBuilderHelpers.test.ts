import { describe, expect, it } from 'vitest';
import type { CardDb, CardDef } from '../../src/engine/types';
import { switchDeckFormat } from '../../src/meta/DeckStorage';
import { validateDarlingsDeck, validateWarchestDeck } from '../../src/meta/darlings';
import { deckRepairNoticeState } from '../../src/meta/deckRepair';
import { freshSave, type SavedDeck } from '../../src/meta/SaveManager';
import { DARLINGS_DECK_SIZE, WARCHEST_DECK_SIZE } from '../../src/meta/warchest';
import { backLabelFor } from '../../src/ui/navigation';
import {
  acknowledgeDeckRepairNotice,
  activeVisibleSavedDeck,
  deckSaveCta,
  unsavedChangesCopy,
  WARCHEST_RULES_COPY,
  DARLINGS_RULES_COPY,
  builderFormatForDeck,
  collapseDeckRows,
  deckBaseline,
  deckCodeImportBlockers,
  isReplayVisible,
  isSavedDeckVisible,
  formatDeckSize,
  formatLabel,
  formatGauntletUnavailableCopy,
  formatPageCount,
  formatPageSlice,
  gridPosition,
  isDeckBuilderDirty,
  newDeckFormat,
  offeredBuilderFormats,
  reserveLandChipLabel,
  restoreDeckBaseline,
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
    // A format switch writes the saved record at once, so on its own it is
    // still an unsaved change against the baseline.
    const savedStandard = { ...saved, format: 'warchest' as const };
    const workingStandard = { ...sameWorking, landReserve: ['land-plains'], format: 'warchest' as const };
    expect(isDeckBuilderDirty(workingStandard, savedStandard)).toBe(false);
    expect(isDeckBuilderDirty({ ...workingStandard, format: 'darlings' }, savedStandard)).toBe(true);
  });

  it('drafts a deckless builder in a format that can still be saved', () => {
    // Every offered format can be saved, so the draft must be one of them:
    // after classic retirement that rules Constructed out.
    expect(newDeckFormat(true, true)).toBe('warchest');
    expect(offeredBuilderFormats(true, true)).toContain(newDeckFormat(true, true));
    expect(newDeckFormat(true, false)).toBe('constructed');
    expect(newDeckFormat(false, false)).toBe('constructed');
  });
});

/** "Leave Without Saving" puts back the edited deck's last-saved state, and only onto that deck. */
describe('deck builder baseline', () => {
  function deck(id: string, over: Partial<SavedDeck> = {}): SavedDeck {
    return {
      id,
      name: id,
      cards: [],
      heroCardId: null,
      landStyle: null,
      format: 'warchest',
      darlingId: null,
      landReserve: [],
      variantPins: [],
      ...over,
    };
  }

  it('restores cards, Warchest, hero, Darling and format onto the edited deck', () => {
    const edited = deck('deck-1', {
      cards: ['a', 'b'],
      variantPins: [null, 'blue|none|standard'],
      heroCardId: 'b',
      landReserve: ['land-plains', 'land-forest'],
    });
    const decks = [edited];
    const baseline = deckBaseline(edited);

    // Edits made in the builder, including a format switch, land on the saved record.
    edited.cards = ['c'];
    edited.variantPins = [null];
    switchDeckFormat(edited, 'darlings');
    edited.darlingId = 'queen';

    expect(restoreDeckBaseline(decks, baseline, 'deck-1')).toBe(true);
    expect(edited).toMatchObject({
      format: 'warchest',
      cards: ['a', 'b'],
      variantPins: [null, 'blue|none|standard'],
      heroCardId: 'b',
      darlingId: null,
      landReserve: ['land-plains', 'land-forest'],
    });
  });

  it("never writes one deck's baseline onto a different deck", () => {
    // The picker scenario: deck A is being edited, A is deleted, and the
    // builder falls back to deck B while A's baseline is still in hand.
    const deckA = deck('deck-a', { cards: ['a-card'], landReserve: ['land-plains'], heroCardId: 'a-card' });
    const deckB = deck('deck-b', { cards: ['b-card'], landReserve: ['land-island'] });
    const staleBaseline = deckBaseline(deckA);
    const decks = [deckB];
    const before = structuredClone(deckB);

    expect(restoreDeckBaseline(decks, staleBaseline, 'deck-b')).toBe(false);
    expect(deckB).toEqual(before);
    // A baseline whose deck is gone writes nothing, even named as the working deck.
    expect(restoreDeckBaseline(decks, staleBaseline, 'deck-a')).toBe(false);
    expect(deckB).toEqual(before);
  });
});

/**
 * Save Deck always works (owner ruling D10, 2026-09-25): an unfinished deck
 * saves as it stands. The centre CTA offers Save whenever there is something
 * to save, and the repair list only where Save would have nothing to do.
 */
describe('deck builder save CTA', () => {
  it('offers Save for any unsaved change, however unfinished the deck', () => {
    expect(deckSaveCta({ hasSavedRecord: true, dirty: true, blockingCount: 3 })).toBe('save');
    expect(deckSaveCta({ hasSavedRecord: false, dirty: true, blockingCount: 1 })).toBe('save');
    expect(deckSaveCta({ hasSavedRecord: true, dirty: true, blockingCount: 0 })).toBe('save');
  });

  it('offers the repair list only for a saved, unplayable deck with nothing to save', () => {
    expect(deckSaveCta({ hasSavedRecord: true, dirty: false, blockingCount: 2 })).toBe('repair');
    expect(deckSaveCta({ hasSavedRecord: true, dirty: false, blockingCount: 0 })).toBe('save');
    // A deckless draft has no record to repair.
    expect(deckSaveCta({ hasSavedRecord: false, dirty: false, blockingCount: 2 })).toBe('save');
  });

  it('writes the unsaved-changes prompt in the house copy rules', () => {
    for (const path of ['leave', 'decks', 'format', 'darling'] as const) {
      for (const blocked of [false, true]) {
        const copy = unsavedChangesCopy(path, blocked);
        for (const text of [copy.body, copy.discardLabel]) {
          expect(text).not.toContain('—');
          // Touch parity: the prompt never names a mouse-only action.
          expect(text).not.toMatch(/click/i);
        }
      }
    }
  });
});

/**
 * The Main Menu's deck-repair notice says the rules changed with an update, so
 * a deck the builder writes unfinished is acknowledged for it; the menu's own
 * notice state (deckRepair.ts) is the judge.
 */
describe('deck repair notice acknowledgement', () => {
  it('silences the notice for the acknowledged deck only', () => {
    const flagged = [{ deckId: 'deck-3' }];
    expect(deckRepairNoticeState(flagged, '[]').needsNotice).toBe(true);
    const ack = acknowledgeDeckRepairNotice('[]', 'deck-3');
    expect(deckRepairNoticeState(flagged, ack).needsNotice).toBe(false);
    // A deck flagged by anything else still gets the notice.
    expect(deckRepairNoticeState([...flagged, { deckId: 'deck-7' }], ack).needsNotice).toBe(true);
  });

  it('keeps earlier acknowledgements and survives a malformed one', () => {
    const earlier = acknowledgeDeckRepairNotice('[]', 'deck-1');
    const both = acknowledgeDeckRepairNotice(earlier, 'deck-2');
    expect(deckRepairNoticeState([{ deckId: 'deck-1' }, { deckId: 'deck-2' }], both).needsNotice).toBe(false);
    const recovered = acknowledgeDeckRepairNotice('not json', 'deck-4');
    expect(deckRepairNoticeState([{ deckId: 'deck-4' }], recovered).needsNotice).toBe(false);
  });
});

/**
 * A deck code carries only a card list, so it is judged only on what that list
 * causes; the real reserve-format validators supply the issues.
 */
describe('deck code import', () => {
  function spell(id: string): CardDef {
    return {
      id,
      name: id,
      types: ['creature'],
      subtypes: [],
      colors: ['G'],
      cost: { generic: 1, pips: { G: 1 } },
      attack: 2,
      defense: 2,
      rarity: 'c',
    };
  }
  const SPELLS = Array.from({ length: DARLINGS_DECK_SIZE }, (_, i) => `spell-${i}`);
  const FOREST = 'forest';
  const DB: CardDb = {
    ...Object.fromEntries(SPELLS.map((id) => [id, spell(id)])),
    [FOREST]: {
      ...spell(FOREST),
      types: ['land'],
      supertypes: ['basic'],
      cost: undefined,
      attack: undefined,
      defense: undefined,
      manaAbility: ['G'],
    },
  };
  const save = freshSave(0);
  for (const id of SPELLS) save.collection[id] = 4;
  // 40 cards as ten playsets: a legal Standard list.
  const standardList = SPELLS.slice(0, WARCHEST_DECK_SIZE / 4).flatMap((id) => [id, id, id, id]);

  it('imports a legal code into a new deck whose Warchest is still empty', () => {
    const validate = (cards: readonly string[]) => validateWarchestDeck(DB, save, cards, []);
    // The deck as a whole is not ready (its Warchest is empty)...
    expect(validate(standardList).some((issue) => issue.kind === 'error')).toBe(true);
    // ...but nothing about the imported list blocks it.
    expect(deckCodeImportBlockers(validate, standardList)).toEqual([]);
  });

  it('imports a legal Darlings list before her Darling is chosen', () => {
    const validate = (cards: readonly string[]) => validateDarlingsDeck(DB, save, cards, null, []);
    expect(deckCodeImportBlockers(validate, SPELLS)).toEqual([]);
  });

  it('still rejects a list that breaks the rules itself', () => {
    const validate = (cards: readonly string[]) => validateWarchestDeck(DB, save, cards, []);
    expect(deckCodeImportBlockers(validate, standardList.slice(1)).length).toBeGreaterThan(0);
    expect(deckCodeImportBlockers(validate, [...standardList.slice(1), FOREST]).length).toBeGreaterThan(0);
    // Forty cards, but a fifth copy of spell-0 in place of a spell-9.
    expect(deckCodeImportBlockers(validate, [...standardList.slice(0, -1), 'spell-0']).length).toBeGreaterThan(0);
    expect(deckCodeImportBlockers(validate, []).length).toBeGreaterThan(0);
  });
});
