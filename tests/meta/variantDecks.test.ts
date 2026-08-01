import { describe, expect, it } from 'vitest';
import { addCard, shardExcess } from '../../src/meta/Collection';
import { freshSave } from '../../src/meta/SaveManager';
import { variantKey } from '../../src/meta/variants';
import { TEST_DB } from '../helpers';

const BLUE = variantKey({ frame: 'blue', holo: 'none', fullArt: false });
const RED = variantKey({ frame: 'red', holo: 'none', fullArt: false });

describe('v25 collection-pin shard revalidation', () => {
  it('preserves legacy slot pins and retains an owned collection display pin', () => {
    const save = freshSave(0);
    for (let i = 0; i < 5; i++) addCard(save, TEST_DB, 'bear', { frame: 'blue', holo: 'none', fullArt: false });
    for (let i = 0; i < 6; i++) addCard(save, TEST_DB, 'bear', { frame: 'red', holo: 'none', fullArt: false });
    save.decks = [
      {
        id: 'deck-1',
        name: 'First',
        cards: ['bear', 'bear', 'bear'],
        heroCardId: null,
        landStyle: null,
        format: 'constructed',
        darlingId: null,
        landReserve: null,
        variantPins: [BLUE, RED, RED],
      },
      {
        id: 'deck-2',
        name: 'Second',
        cards: ['bear', 'bear', 'bear', 'bear', 'bear', 'bear', 'bear', 'bear', 'wolf'],
        heroCardId: null,
        landStyle: null,
        format: 'constructed',
        darlingId: null,
        landReserve: null,
        variantPins: [BLUE, BLUE, BLUE, BLUE, RED, RED, RED, RED, null],
      },
    ];
    save.pinnedVariants.bear = RED;

    const result = shardExcess(save, TEST_DB, 'bear');

    expect(result.copies).toBe(3);
    expect(result.clearedDisplayPin).toBe(false);
    expect(save.decks[0].variantPins).toEqual([BLUE, RED, RED]);
    expect(save.decks[1].variantPins).toEqual([BLUE, BLUE, BLUE, BLUE, RED, RED, RED, RED, null]);
    expect(save.pinnedVariants.bear).toBe(RED);
    expect(save.collectionVariants.bear).toEqual({ [BLUE]: 4, [RED]: 4 });
  });
});
