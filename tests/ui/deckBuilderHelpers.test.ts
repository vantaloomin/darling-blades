import { describe, expect, it } from 'vitest';
import { freshSave } from '../../src/meta/SaveManager';
import { variantKey } from '../../src/meta/variants';
import { backLabelFor } from '../../src/ui/navigation';
import {
  BATTLE_BOX_RULES_COPY,
  formatDeckSize,
  formatLabel,
  formatGauntletUnavailableCopy,
  formatPageCount,
  formatPageSlice,
  gridPosition,
  isDeckBuilderDirty,
  variantPickerChoices,
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
    expect(formatLabel('battlebox')).toBe('Battle Box');
    expect(formatDeckSize('constructed')).toBe(60);
    expect(formatDeckSize('darlings')).toBe(50);
    expect(formatDeckSize('battlebox')).toBe(50);
    expect(formatGauntletUnavailableCopy('darlings')).toBe('Darlings decks are available in Practice only.');
    expect(formatGauntletUnavailableCopy('battlebox')).toBe('Battle Box decks are available in Practice only.');
    expect(BATTLE_BOX_RULES_COPY).not.toContain('\u2014');
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

  it('reports owned treatment choices and remaining positional copies', () => {
    const save = freshSave(0);
    const blue = variantKey({ frame: 'blue', holo: 'none', fullArt: false });
    const red = variantKey({ frame: 'red', holo: 'none', fullArt: false });
    save.collection.bear = 3;
    save.collectionVariants.bear = { [blue]: 2, [red]: 1 };
    const choices = variantPickerChoices(save, ['bear', 'bear'], [blue, null], 1, 'bear');
    expect(choices.map((choice) => choice.label)).toEqual(['Auto', 'Red Frame', 'Blue Frame']);
    expect(choices.find((choice) => choice.key === blue)?.remainingCopies).toBe(1);
    expect(choices.find((choice) => choice.key === red)?.remainingCopies).toBe(1);
    expect(choices.find((choice) => choice.key === null)?.remainingCopies).toBe(2);
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
