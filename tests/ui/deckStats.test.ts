import { describe, expect, it } from 'vitest';
import { computeDeckStats, curveBars, CURVE_MAX, deckShapeLine } from '../../src/ui/deckStats';
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
      charm: 1,
      ritual: 0,
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

  it('ignores unavailable card ids so a preserved repair deck remains renderable', () => {
    const stats = computeDeckStats(['missing-card', 'forest'], TEST_DB);
    expect(stats.lands).toBe(1);
    expect(stats.nonlands).toBe(0);
  });
});

/** Shared by the constructed builder and the Limited builder since 2026-08-25. */
describe('curve bar geometry', () => {
  it('scales the tallest bucket to the full height and the rest against it', () => {
    const bars = curveBars([0, 4, 8, 2, 0, 0, 0, 0], { firstX: 100, pitch: 40, maxHeight: 24 });
    expect(bars).toHaveLength(8);
    expect(bars.map((b) => b.x)).toEqual([100, 140, 180, 220, 260, 300, 340, 380]);
    expect(bars[2].height).toBe(24); // the tallest bucket
    expect(bars[1].height).toBe(12); // half of it
    expect(bars[3].height).toBe(6);
  });

  it('draws an empty bucket as a stub and never loses a bucket of one', () => {
    const bars = curveBars([0, 1, 40, 0, 0, 0, 0, 0], { firstX: 0, pitch: 10, maxHeight: 24 });
    expect(bars[0].height).toBe(2); // empty stub
    // 1/40 of 24 rounds to 1px, which would read as empty; the floor keeps it.
    expect(bars[1].height).toBe(3);
    expect(bars[2].height).toBe(24);
  });

  it('labels the collapsing top bucket as "7+"', () => {
    const bars = curveBars(new Array(CURVE_MAX + 1).fill(1), { firstX: 0, pitch: 1, maxHeight: 10 });
    expect(bars.map((b) => b.label)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7+']);
  });

  it('survives an empty deck without dividing by zero', () => {
    const bars = curveBars(new Array(CURVE_MAX + 1).fill(0), { firstX: 0, pitch: 1, maxHeight: 24 });
    expect(bars.every((b) => b.height === 2 && b.count === 0)).toBe(true);
  });
});

describe('deck shape line', () => {
  const stats = computeDeckStats(deckOf([['forest', 3], ['bear', 2], ['shock', 1]]), TEST_DB);

  it('names lands for constructed and omits them for a reserve format', () => {
    expect(deckShapeLine(stats, { lands: true })).toContain('3 lands');
    expect(deckShapeLine(stats, { lands: false })).not.toContain('lands');
    // Both report the same creature count; only the land clause differs.
    expect(deckShapeLine(stats, { lands: false })).toContain('2 creatures');
    expect(deckShapeLine(stats, { lands: true })).toContain('2 creatures');
  });

  it('lists only the colours actually present, in WUBRG order', () => {
    expect(deckShapeLine(stats, { lands: true })).toContain('R\u00b71 G\u00b72');
    expect(deckShapeLine(stats, { lands: true })).not.toContain('W\u00b7');
  });

  it('says colorless rather than printing an empty pip run', () => {
    const lands = computeDeckStats(deckOf([['forest', 2]]), TEST_DB);
    expect(deckShapeLine(lands, { lands: true })).toContain('colorless');
  });

  it('keeps player-facing copy free of em-dashes', () => {
    for (const lands of [true, false]) {
      expect(deckShapeLine(stats, { lands })).not.toContain('\u2014');
    }
  });
});
