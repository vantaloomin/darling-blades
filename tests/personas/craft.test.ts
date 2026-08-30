import { describe, expect, it } from 'vitest';
import { PERSONA_TEMPLATES } from '../../scripts/personas/templates';
import {
  buildGreedyDeck,
  cardsForPool,
  measureDeckAgainstField,
  runMetagameLoop,
  snapshotDeckCounts,
} from '../../scripts/personas/craft';
import { CARD_DB } from '../../src/data/catalog';
import { validateWarchestDeck } from '../../src/meta/darlings';
import { LAND_RESERVE_SIZE, WARCHEST_DECK_SIZE } from '../../src/meta/warchest';
import { freshSave } from '../../src/meta/SaveManager';

const fullPool = cardsForPool('all');

describe.each(PERSONA_TEMPLATES)('greedy persona builder: $id', (template) => {
  it('builds a legal Warchest deck and reserve under the real validator', () => {
    const build = buildGreedyDeck(template, fullPool, 12_345);
    const save = freshSave(0);
    save.collection = Object.fromEntries(Object.keys(CARD_DB).map((id) => [id, 4]));
    // The same validator the game uses, so a deck this harness measures is one
    // a player could actually register. Classic's validateDeck would pass a
    // landless 40 only by accident.
    const errors = validateWarchestDeck(CARD_DB, save, build.deck, build.landReserve)
      .filter((issue) => issue.kind === 'error');
    expect(errors).toEqual([]);
    expect(build.quotaShortfalls).toEqual([]);
    expect(build.deck.some((id) => CARD_DB[id].types.includes('land'))).toBe(false);
  });

  it('is deterministic for a fixed seed and snapshots aggregate counts', () => {
    // 2026-08-29: refresh reanimator aggregate counts after the Starborne
    // signal-inversion cost change altered the live full-pool selection.
    const first = buildGreedyDeck(template, fullPool, 12_345);
    const second = buildGreedyDeck(template, fullPool, 12_345);
    expect(first).toEqual(second);
    expect(snapshotDeckCounts(first)).toMatchSnapshot();
  });
});

describe('pool selection', () => {
  it('keeps basics available in a set-scoped pool', () => {
    const pool = cardsForPool('gothic-monsters');
    expect(pool.some((card) => card.id === 'land-plains')).toBe(true);
    expect(pool.filter((card) => !card.supertypes?.includes('basic')).every(
      (card) => card.set === 'gothic-monsters',
    )).toBe(true);
  });

  it('rejects an unknown set id', () => {
    expect(() => cardsForPool('not-a-set')).toThrow('Unknown pool');
  });
});

/**
 * The harness measured CLASSIC - the format retired 2026-08-10 - until
 * 2026-08-25, because `playOut` silently falls back to the classic constructor
 * when neither a format nor land reserves are supplied, and the field columns
 * read `DeckList.cards` (the classic 60) instead of the reserve build. Three
 * months of `runAvatarMatrix` went the same way. These tests exist so the
 * fallback can never be reached silently again.
 */
describe('the harness measures Warchest, never classic', () => {
  it('refuses to measure a deck with no land reserve instead of falling back', () => {
    const template = PERSONA_TEMPLATES[0];
    const build = buildGreedyDeck(template, fullPool, 12_345);
    const column = {
      kind: 'static' as const,
      id: 'col',
      name: 'Column',
      deck: [...build.deck],
      landReserve: [...build.landReserve],
    };
    expect(() => measureDeckAgainstField(
      build.deck,
      { field: 'starters', seeds: 1, seed: 1, personaId: template.id },
      [column],
    )).toThrow(/requires a landReserve/);
  });

  it('fields reserve-native columns: every opponent is landless with ten reserve lands', () => {
    const seen: { deck: string[]; landReserve: string[] }[] = [];
    runMetagameLoop({
      poolId: 'all',
      pool: fullPool,
      field: 'starters',
      seeds: 1,
      iterations: 0,
      seed: 77,
      maxRounds: 1,
      personaIds: ['burn', 'weenie'],
      measure: (_deck, options) => {
        for (const entry of options.fieldComposition ?? []) {
          seen.push({ deck: [...entry.deck], landReserve: [...entry.landReserve] });
        }
        return {
          field: options.field, seeds: 1, matchups: [], rowWins: 0,
          losses: 0, draws: 1, games: 1, score: 0.5,
        };
      },
    });

    expect(seen.length).toBeGreaterThan(0);
    for (const column of seen) {
      expect(column.landReserve).toHaveLength(LAND_RESERVE_SIZE);
      expect(column.deck.some((id) => CARD_DB[id].types.includes('land'))).toBe(false);
    }
  });

  it('crafts a landless Warchest deck beside a ten-land reserve', () => {
    const build = buildGreedyDeck(PERSONA_TEMPLATES[0], fullPool, 12_345);
    expect(build.deck).toHaveLength(WARCHEST_DECK_SIZE);
    expect(build.landReserve).toHaveLength(LAND_RESERVE_SIZE);
    expect(build.landReserve.every((id) => CARD_DB[id].types.includes('land'))).toBe(true);
  });
});
