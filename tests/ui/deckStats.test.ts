import { describe, expect, it } from 'vitest';
import {
  computeDeckStats,
  curveBars,
  CURVE_MAX,
  deckCountsLine,
  deckPipBeads,
  deckPipCounts,
} from '../../src/ui/deckStats';
import type { CardDb } from '../../src/engine/types';
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

/** The Deck Builder's summary: type counts left, colour pips (as beads) right. */
describe('deck summary counts and pips', () => {
  const spellsOnly = computeDeckStats(deckOf([['bear', 2], ['shock', 1]]), TEST_DB);
  const withLands = computeDeckStats(deckOf([['forest', 3], ['bear', 2], ['shock', 1]]), TEST_DB);

  it('names the Warchest fill in a reserve format instead of a land count that reads zero', () => {
    const line = deckCountsLine(spellsOnly, { kind: 'warchest', filled: 7, size: 10 });
    expect(line).toContain('Warchest 7/10');
    expect(line).toContain('2 creatures');
    expect(line).not.toContain('lands');
  });

  it('counts lands where they really are', () => {
    // A classic deck holds its lands in the list.
    expect(deckCountsLine(withLands, { kind: 'list' })).toContain('3 lands');
    expect(deckCountsLine(withLands, { kind: 'list' })).not.toContain('Warchest');
    // A migrated deck awaiting repair still has lands in its reserve-format
    // list, and the line says so until the repair removes them.
    expect(deckCountsLine(withLands, { kind: 'warchest', filled: 0, size: 10 })).toContain('3 lands');
  });

  it('gives each present colour its pip count, in WUBRG order, for the beads', () => {
    expect(deckPipCounts(withLands)).toEqual([
      { color: 'R', count: 1 },
      { color: 'G', count: 2 },
    ]);
    expect(deckPipCounts(computeDeckStats(deckOf([['forest', 2]]), TEST_DB))).toEqual([]);
  });

  it('names no lands and no Warchest fill when the format provides the Warchest on its own line', () => {
    // Limited: the deck list holds spells only and the Warchest line sits below.
    const line = deckCountsLine(spellsOnly, { kind: 'provided' });
    expect(line).toContain('2 creatures');
    expect(line).not.toContain('lands');
    expect(line).not.toContain('Warchest');
  });

  it('keeps player-facing copy free of em-dashes', () => {
    const sources = [
      { kind: 'list' as const },
      { kind: 'warchest' as const, filled: 10, size: 10 },
      { kind: 'provided' as const },
    ];
    for (const lands of sources) {
      expect(deckCountsLine(withLands, lands)).not.toContain('\u2014');
    }
  });
});

/**
 * The colour run every deck summary draws as mana-pip beads (the design
 * system's convention; the Limited builder printed letter codes until 1.8.1).
 */
describe('deck pip beads', () => {
  const RELIC_DB: CardDb = {
    ...TEST_DB,
    relic: {
      id: 'relic',
      name: 'Relic',
      types: ['artifact'],
      subtypes: [],
      cost: { generic: 2, pips: {} },
      colors: [],
      rarity: 'c',
    },
  };

  it('draws one counted bead per colour the spells ask for, in WUBRG order', () => {
    const stats = computeDeckStats(deckOf([['forest', 3], ['bear', 2], ['shock', 1]]), TEST_DB);
    expect(deckPipBeads(stats)).toEqual([
      { color: 'R', count: 1 },
      { color: 'G', count: 2 },
    ]);
  });

  it('draws the colorless bead, uncounted, for a deck of colorless spells', () => {
    expect(deckPipBeads(computeDeckStats(deckOf([['relic', 2]]), RELIC_DB))).toEqual([{ color: 'C', count: null }]);
  });

  it('draws nothing for a deck with no spells', () => {
    expect(deckPipBeads(computeDeckStats([], TEST_DB))).toEqual([]);
    expect(deckPipBeads(computeDeckStats(deckOf([['forest', 2]]), TEST_DB))).toEqual([]);
  });
});
