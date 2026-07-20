import { describe, expect, it } from 'vitest';
import { PERSONA_TEMPLATES } from '../../scripts/personas/templates';
import { buildGreedyDeck, cardsForPool, snapshotDeckCounts } from '../../scripts/personas/craft';
import { CARD_DB } from '../../src/data/catalog';
import { validateDeck } from '../../src/meta/DeckStorage';
import { freshSave } from '../../src/meta/SaveManager';

const fullPool = cardsForPool('all');

describe.each(PERSONA_TEMPLATES)('greedy persona builder: $id', (template) => {
  it('builds a legal 60-card list under validateDeck minus ownership', () => {
    const build = buildGreedyDeck(template, fullPool, 12_345);
    const save = freshSave(0);
    save.collection = Object.fromEntries(Object.keys(CARD_DB).map((id) => [id, 4]));
    const errors = validateDeck(CARD_DB, save, build.deck).filter((issue) => issue.kind === 'error');
    expect(errors).toEqual([]);
    expect(build.quotaShortfalls).toEqual([]);
  });

  it('is deterministic for a fixed seed and snapshots aggregate counts', () => {
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
