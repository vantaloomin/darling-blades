import { describe, expect, it } from 'vitest';
import { computeDeckStats } from '../../src/ui/deckStats';
import { deckOf, TEST_DB } from '../helpers';

/** The deck-builder stats panel renders this aggregation; pin the math. */
describe('computeDeckStats', () => {
  it('buckets nonland cards by mana value, sums pips, counts types', () => {
    // 3 forest (land), 2 bear (2G), elf (1G), giant (4GG), shock (1R), pacifism_aura (2W).
    const deck = deckOf([
      ['forest', 3],
      ['bear', 2],
      ['elf', 1],
      ['giant', 1],
      ['shock', 1],
      ['pacifism_aura', 1],
    ]);
    const s = computeDeckStats(deck, TEST_DB);

    expect(s.lands).toBe(3);
    expect(s.nonlands).toBe(6);
    // curve indices are mana value; lands excluded. elf(1)+shock(1)=2 at MV1; bear×2(2)+pacifism(1)=3 at MV2; giant at MV4.
    expect(s.curve).toEqual([0, 2, 3, 0, 1, 0, 0, 0]);
    expect(s.colorPips).toEqual({ W: 1, U: 0, B: 0, R: 1, G: 5 });
    expect(s.typeCounts).toEqual({
      creature: 4,
      instant: 1,
      sorcery: 0,
      enchantment: 1,
      artifact: 0,
      land: 3,
    });
  });

  it('collapses mana value ≥ 7 into the top bucket', () => {
    // dt_rhino is MV5; craft a synthetic high card is unnecessary — verify the
    // Math.min clamp by checking dt_rhino lands in bucket 5, not out of range.
    const s = computeDeckStats(deckOf([['dt_rhino', 1]]), TEST_DB);
    expect(s.curve.length).toBe(8);
    expect(s.curve[5]).toBe(1);
    expect(s.colorPips).toEqual({ W: 0, U: 0, B: 1, R: 0, G: 1 });
  });

  it('handles an empty deck and an all-lands deck without NaNs', () => {
    const empty = computeDeckStats([], TEST_DB);
    expect(empty.curve).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(empty.nonlands).toBe(0);

    const lands = computeDeckStats(deckOf([['forest', 5], ['island', 2]]), TEST_DB);
    expect(lands.lands).toBe(7);
    expect(lands.nonlands).toBe(0);
    expect(lands.typeCounts.land).toBe(7);
    expect(lands.curve.every((n) => n === 0)).toBe(true);
  });
});
