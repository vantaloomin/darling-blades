import { describe, expect, it } from 'vitest';
import { freshSave } from '../../src/meta/SaveManager';
import { variantKey } from '../../src/meta/variants';
import {
  BATTLE_BOX_RULES_COPY,
  formatDeckSize,
  formatLabel,
  formatPageCount,
  formatPageSlice,
  formatUnavailableCopy,
  gridPosition,
  variantPickerChoices,
} from '../../src/ui/deckBuilderHelpers';

describe('deck builder helpers', () => {
  it('keeps format labels, sizes, and launch copy explicit', () => {
    expect(formatLabel('constructed')).toBe('Constructed');
    expect(formatLabel('darlings')).toBe('Darlings');
    expect(formatLabel('battlebox')).toBe('Battle Box');
    expect(formatDeckSize('constructed')).toBe(60);
    expect(formatDeckSize('darlings')).toBe(50);
    expect(formatDeckSize('battlebox')).toBe(50);
    expect(formatUnavailableCopy('constructed')).toBeNull();
    expect(formatUnavailableCopy('darlings')).toBe('Darlings duels arrive later in this update.');
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
});
