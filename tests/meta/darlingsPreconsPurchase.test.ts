import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { CARD_DB } from '../../src/data/catalog';
import { DARLINGS_PRECONS } from '../../src/data/darlingsPrecons';
import { validateDarlingsDeck } from '../../src/meta/darlings';
import {
  buyThemeDeck,
  claimFreeDarlingsDeck,
  deckProductCardIds,
} from '../../src/meta/Economy';
import { freshSave } from '../../src/meta/SaveManager';

const zhouYu = DARLINGS_PRECONS[0];
const hel = DARLINGS_PRECONS[1];

describe('Darlings precon purchase products', () => {
  it('sells a paid Darlings deck once, grants its external cards, and saves its format fields', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.darlingsPreconPrice;

    expect(buyThemeDeck(save, CARD_DB, hel, ECONOMY.darlingsPreconPrice)).toBe(true);
    expect(save.gold).toBe(0);
    expect(save.decks).toHaveLength(1);
    expect(save.decks[0]).toMatchObject({
      id: hel.id,
      name: hel.name,
      cards: hel.cards,
      format: 'darlings',
      darlingId: hel.darlingId,
      landReserve: hel.landReserve,
    });
    expect(validateDarlingsDeck(CARD_DB, save, hel.cards, hel.darlingId, hel.landReserve)).toEqual([]);
    for (const id of deckProductCardIds(hel)) {
      if (!CARD_DB[id].supertypes?.includes('basic')) expect(save.collection[id]).toBeGreaterThanOrEqual(1);
    }

    const beforeRepeat = structuredClone(save);
    expect(buyThemeDeck(save, CARD_DB, hel, ECONOMY.darlingsPreconPrice)).toBe(false);
    expect(save).toEqual(beforeRepeat);
  });

  it('claims Zhou Yu exactly once without spending gold and marks the durable claim state', () => {
    const save = freshSave(0);
    save.gold = 123;

    expect(claimFreeDarlingsDeck(save, CARD_DB, zhouYu)).toBe(true);
    expect(save.gold).toBe(123);
    expect(save.darlingsFreeDeckClaimed).toBe(true);
    expect(save.activeDeckId).toBe(zhouYu.id);
    expect(validateDarlingsDeck(CARD_DB, save, zhouYu.cards, zhouYu.darlingId, zhouYu.landReserve)).toEqual([]);

    const beforeRepeat = structuredClone(save);
    expect(claimFreeDarlingsDeck(save, CARD_DB, zhouYu)).toBe(false);
    expect(save).toEqual(beforeRepeat);
  });
});
