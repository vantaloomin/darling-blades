import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { CARD_DB } from '../../src/data/catalog';
import {
  addCard,
  craftCard,
  craftCost,
  ownedVariants,
} from '../../src/meta/Collection';
import {
  payPremiumDraftEntry,
  premiumEntryStatus,
} from '../../src/meta/Economy';
import { freshSave, SaveManager } from '../../src/meta/SaveManager';
import { PLAIN_VARIANT, variantKey } from '../../src/meta/variants';

function fakeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => void raw.set(key, value),
    removeItem: (key) => void raw.delete(key),
  };
}

function cardOf(tier: keyof typeof ECONOMY.dupeGold) {
  const card = Object.values(CARD_DB).find(
    (candidate) => candidate.rarity === tier && !candidate.token && !candidate.supertypes?.includes('basic'),
  );
  if (!card) throw new Error(`No collectible ${tier} card in CARD_DB`);
  return card;
}

describe('Premium Draft weekly allowance', () => {
  it('allows a first-ever entry, consumes two entries, and blocks only the third', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.premiumDraftEntry * 3;

    expect(premiumEntryStatus(save, '1970-01-01')).toEqual({ allowed: true, remaining: 2, resetsInDays: 7 });
    expect(payPremiumDraftEntry(save, '1970-01-01')).toBe(true);
    expect(payPremiumDraftEntry(save, '1970-01-01')).toBe(true);
    const goldAfterTwo = save.gold;
    const stateAfterTwo = structuredClone(save.limited.premiumWeek);

    expect(payPremiumDraftEntry(save, '1970-01-01')).toBe(false);
    expect(save.gold).toBe(goldAfterTwo);
    expect(save.limited.premiumWeek).toEqual(stateAfterTwo);
    expect(premiumEntryStatus(save, '1970-01-01')).toEqual({ allowed: false, remaining: 0, resetsInDays: 7 });
  });

  it('resets at the UTC week boundary without affecting the next Premium week', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.premiumDraftEntry * 3;
    expect(payPremiumDraftEntry(save, '1970-01-07')).toBe(true);
    expect(payPremiumDraftEntry(save, '1970-01-07')).toBe(true);
    expect(premiumEntryStatus(save, '1970-01-07').remaining).toBe(0);

    expect(premiumEntryStatus(save, '1970-01-08')).toEqual({ allowed: true, remaining: 2, resetsInDays: 7 });
    expect(payPremiumDraftEntry(save, '1970-01-08')).toBe(true);
    expect(save.limited.premiumWeek.entries).toBe(1);
  });

  it('does not record an entry when gold is insufficient and persists allowance state', () => {
    const save = freshSave(0);
    save.gold = ECONOMY.premiumDraftEntry - 1;
    const before = structuredClone(save.limited.premiumWeek);
    expect(payPremiumDraftEntry(save, '1970-01-01')).toBe(false);
    expect(save.gold).toBe(ECONOMY.premiumDraftEntry - 1);
    expect(save.limited.premiumWeek).toEqual(before);

    const storage = fakeStorage();
    const manager = new SaveManager(storage, 0);
    manager.data.gold = ECONOMY.premiumDraftEntry * 2;
    expect(payPremiumDraftEntry(manager.data, '1970-01-01')).toBe(true);
    expect(payPremiumDraftEntry(manager.data, '1970-01-01')).toBe(true);
    manager.flush();

    const loaded = new SaveManager(storage, 0);
    expect(loaded.data.limited.premiumWeek.entries).toBe(2);
    expect(payPremiumDraftEntry(loaded.data, '1970-01-01')).toBe(false);
  });
});

describe('plain missing-unique crafting', () => {
  it('uses six times the tier dupe value for every rarity', () => {
    expect(craftCost(CARD_DB, cardOf('c').id)).toBe(30);
    expect(craftCost(CARD_DB, cardOf('r').id)).toBe(60);
    expect(craftCost(CARD_DB, cardOf('sr').id)).toBe(300);
    expect(craftCost(CARD_DB, cardOf('ssr').id)).toBe(900);
    expect(craftCost(CARD_DB, cardOf('ur').id)).toBe(3000);
    expect(ECONOMY.craftCostMult).toBe(6);
  });

  it('spends gold and grants exactly one PLAIN copy through addCard', () => {
    const card = cardOf('sr');
    const save = freshSave(0);
    const cost = craftCost(CARD_DB, card.id);
    save.gold = cost + 100;

    expect(craftCard(save, CARD_DB, card.id)).toEqual({ ok: true });
    expect(save.gold).toBe(100);
    expect(save.collection[card.id]).toBe(1);
    expect(ownedVariants(save, card.id)).toEqual({ [variantKey(PLAIN_VARIANT)]: 1 });
    expect(craftCard(save, CARD_DB, card.id)).toEqual({ ok: false, reason: 'already-owned' });
    expect(save.collection[card.id]).toBe(1);
  });

  it('rejects unknown, token, basic, owned, and unaffordable cards without mutation', () => {
    const token = Object.values(CARD_DB).find((card) => card.token);
    const basic = Object.values(CARD_DB).find((card) => card.supertypes?.includes('basic'));
    if (!token || !basic) throw new Error('CARD_DB must contain token and basic fixtures');

    const save = freshSave(0);
    save.gold = 10_000;
    expect(craftCard(save, CARD_DB, '__missing__')).toEqual({ ok: false, reason: 'unknown-card' });
    expect(craftCard(save, CARD_DB, token.id)).toEqual({ ok: false, reason: 'not-collectible' });
    expect(craftCard(save, CARD_DB, basic.id)).toEqual({ ok: false, reason: 'not-collectible' });

    const owned = cardOf('c');
    addCard(save, CARD_DB, owned.id, PLAIN_VARIANT);
    const ownedGold = save.gold;
    expect(craftCard(save, CARD_DB, owned.id)).toEqual({ ok: false, reason: 'already-owned' });
    expect(save.gold).toBe(ownedGold);

    const expensive = cardOf('ur');
    save.gold = craftCost(CARD_DB, expensive.id) - 1;
    expect(craftCard(save, CARD_DB, expensive.id)).toEqual({ ok: false, reason: 'insufficient-gold' });
    expect(save.collection[expensive.id]).toBeUndefined();
  });
});
