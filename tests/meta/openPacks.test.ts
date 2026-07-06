import { describe, expect, it } from 'vitest';
import { createRngState } from '../../src/engine/rng';
import { openPacks } from '../../src/meta/PackOpener';
import { freshSave } from '../../src/meta/SaveManager';
import { TEST_DB } from '../helpers';

/** F10: buy/open N packs at once. openPacks loops openPack off one RNG stream. */
describe('openPacks', () => {
  const ids = (packs: { cards: { cardId: string }[] }[]): string[][] =>
    packs.map((p) => p.cards.map((c) => c.cardId));

  it('opens N boosters deterministically off one seed', () => {
    const a = openPacks(freshSave(0), TEST_DB, createRngState(7), 5);
    const b = openPacks(freshSave(0), TEST_DB, createRngState(7), 5);
    expect(a).toHaveLength(5);
    expect(ids(a)).toEqual(ids(b)); // same seed + count → identical batch

    const c = openPacks(freshSave(0), TEST_DB, createRngState(8), 5);
    expect(ids(c)).not.toEqual(ids(a)); // a different seed diverges
  });

  it('records every pack in stats.packsOpened', () => {
    const save = freshSave(0);
    openPacks(save, TEST_DB, createRngState(1), 3);
    expect(save.stats.packsOpened).toBe(3);
  });

  it('a batch of N equals N single opens off the same stream', () => {
    const batchSave = freshSave(0);
    const batch = openPacks(batchSave, TEST_DB, createRngState(42), 3);

    const loopSave = freshSave(0);
    const rng = createRngState(42);
    const loop = [0, 1, 2].map(() => openPacks(loopSave, TEST_DB, rng, 1)[0]);

    expect(ids(batch)).toEqual(ids(loop.map((p) => p)));
  });
});
