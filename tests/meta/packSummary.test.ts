import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { packPool } from '../../src/meta/PackOpener';
import { packPoolSummary } from '../../src/meta/packSummary';
import { freshSave } from '../../src/meta/SaveManager';

function freshSaveData() {
  return freshSave(1_700_000_000_000);
}

describe('packPoolSummary', () => {
  it('counts the full eligible pool for the unfiltered Core pack', () => {
    const save = freshSaveData();
    const summary = packPoolSummary(save, CARD_DB);
    const expected = (['c', 'r', 'sr', 'ssr', 'ur'] as const).reduce(
      (sum, tier) => sum + packPool(CARD_DB, tier).length,
      0,
    );
    expect(summary.poolSize).toBe(expected);
    expect(summary.poolSize).toBeGreaterThan(400); // whole-catalog pack
    expect(summary.ownedDistinct).toBe(0); // fresh save owns nothing
  });

  it('scopes an expansion pack to its own set and counts owned distinct once', () => {
    const save = freshSaveData();
    const gm = packPoolSummary(save, CARD_DB, 'gothic-monsters');
    expect(gm.poolSize).toBeGreaterThan(70);
    expect(gm.poolSize).toBeLessThan(90); // the ~81-card expansion pool
    const [first, second] = packPool(CARD_DB, 'c', 'gothic-monsters');
    save.collection[first] = 3; // multiples of one card count once
    save.collection[second] = 1;
    const after = packPoolSummary(save, CARD_DB, 'gothic-monsters');
    expect(after.ownedDistinct).toBe(2);
    expect(after.poolSize).toBe(gm.poolSize);
  });
});
