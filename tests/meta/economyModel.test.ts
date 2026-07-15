import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { CARD_DB } from '../../src/data/catalog';
import { STARTER_DECKS, THEME_DECKS } from '../../src/data/starterDecks';
import { createRngState } from '../../src/engine/rng';
import { shardExcess } from '../../src/meta/Collection';
import {
  dailyQuestCeiling,
  expectedPlainDupeRefundPerPack,
  freeDraftRunEv,
  gauntletClimbEv,
  keptCardValue,
  ownershipAtCompletion,
  practiceSessionEv,
  premiumDraftRunEv,
  premiumVsBoosters,
  type EconomyOwnership,
} from '../../src/meta/economyModel';
import { applyMatchResult, buyThemeDeck } from '../../src/meta/Economy';
import { openPack } from '../../src/meta/PackOpener';
import { freshSave } from '../../src/meta/SaveManager';
import { PLAIN_VARIANT } from '../../src/meta/variants';
import { TEST_DB } from '../helpers';

function installOwnership(ownership: EconomyOwnership) {
  const save = freshSave(0);
  save.collection = { ...ownership.collection };
  save.collectionVariants = Object.fromEntries(
    Object.entries(ownership.collectionVariants).map(([id, variants]) => [id, { ...variants }]),
  );
  return save;
}

describe('analytic economy EVs', () => {
  it('computes the full-completion pack claim from live drop and refund tables', () => {
    const empty = ownershipAtCompletion(CARD_DB, 0);
    const complete = ownershipAtCompletion(CARD_DB, 1);
    expect(expectedPlainDupeRefundPerPack(CARD_DB, empty)).toBe(0);

    const fullEv = expectedPlainDupeRefundPerPack(CARD_DB, complete);
    expect(fullEv).toBeCloseTo(67.5, 10);
    // rules.ts says approximately 68g. Half a gold is the stated rounding tolerance.
    expect(Math.abs(fullEv - 68)).toBeLessThanOrEqual(0.5);
    expect(fullEv).toBeLessThan(ECONOMY.packPrice);
  });

  it('computes Limited, gauntlet, practice, and daily ceilings from win-rate inputs', () => {
    expect(freeDraftRunEv(0)).toMatchObject({ expectedWins: 0, expectedRunGold: 40 });
    expect(freeDraftRunEv(1)).toMatchObject({ expectedWins: 3, expectedRunGold: 300 });
    expect(premiumDraftRunEv(0.5, 125).expectedNetGold).toBeCloseTo(
      freeDraftRunEv(0.5).expectedRunGold + 125 - ECONOMY.premiumDraftEntry,
    );

    const failedClimb = gauntletClimbEv(0);
    expect(failedClimb).toMatchObject({ expectedGold: ECONOMY.lossGold, completionProbability: 0 });
    const perfectClimb = gauntletClimbEv(1);
    expect(perfectClimb.expectedGold).toBe(
      ECONOMY.gauntletRungGold.reduce((sum, gold) => sum + gold, 0) + ECONOMY.gauntletCompletionBonus,
    );
    expect(perfectClimb.completionProbability).toBe(1);

    const practice = practiceSessionEv({
      difficulty: 'medium',
      winRate: 0.5,
      matches: 4,
      lossGoldEligibilityRate: 0.75,
      streakCount: 3,
    });
    expect(practice.probabilityOfAtLeastOneWin).toBe(0.9375);
    expect(practice.expectedGoldPerMatch).toBeCloseTo(practice.expectedTotalGold / 4);
    expect(practice.minTurnsForLossGold).toBe(ECONOMY.minTurnsForLossGold);
    expect(dailyQuestCeiling()).toEqual({ questGold: 150, streakGold: 125, totalGold: 275 });
  });

  it('values fixed grants and compares both Premium Draft axes deterministically', () => {
    const complete = ownershipAtCompletion(TEST_DB, 1);
    const fixed = keptCardValue(TEST_DB, complete, [
      { cardId: 'bear', variant: PLAIN_VARIANT },
      { cardId: 'murder', variant: PLAIN_VARIANT },
    ]);
    expect(fixed).toEqual({
      expectedNewUniques: 0,
      expectedShardGold: ECONOMY.dupeGold.c + ECONOMY.dupeGold.ur,
    });

    const a = premiumVsBoosters(TEST_DB, complete, 0.5, createRngState(90210), 500);
    const b = premiumVsBoosters(TEST_DB, complete, 0.5, createRngState(90210), 500);
    expect(a).toEqual(b);
    expect(a.premium.expectedNewUniques).toBe(0);
    expect(a.boosters.expectedNewUniques).toBe(0);
    expect(a.premium.cardCount).toBe(45);
    expect(a.boosters.cardCount).toBe(27);
  });
});

describe('hard economy invariants through real meta behavior', () => {
  it('keeps expected and seeded long-sequence pack refunds below total spend', () => {
    const complete = ownershipAtCompletion(TEST_DB, 1);
    const analytic = expectedPlainDupeRefundPerPack(TEST_DB, complete);
    expect(analytic).toBeLessThan(ECONOMY.packPrice);

    const save = installOwnership(complete);
    const rng = createRngState(20260715);
    const packs = 3_000;
    for (let i = 0; i < packs; i++) openPack(save, TEST_DB, rng);
    const observedPerPack = save.gold / packs;
    expect(save.gold).toBeLessThan(packs * ECONOMY.packPrice);
    expect(observedPerPack).toBeCloseTo(analytic, -1);
  });

  it('keeps buy-deck then shard-all-excess strictly negative for every shop deck SKU', () => {
    const skus = [
      ...THEME_DECKS.map((deck) => ({ deck, price: ECONOMY.preconPrice })),
      ...STARTER_DECKS.map((deck) => ({ deck, price: ECONOMY.starterDeckPrice })),
    ];
    for (const { deck, price } of skus) {
      const save = freshSave(0);
      save.gold = price;
      expect(buyThemeDeck(save, CARD_DB, deck, price), deck.id).toBe(true);
      for (const id of new Set(deck.cards)) shardExcess(save, CARD_DB, id);
      expect(save.gold - price, deck.id).toBeLessThan(0);
    }
  });

  it('pays zero for a real practice loss before the minimum turn gate', () => {
    const save = freshSave(0);
    const reward = applyMatchResult(save, 'easy', false, '2026-07-15', ECONOMY.minTurnsForLossGold - 1);
    expect(reward).toEqual({ gold: 0, firstWinBonus: false, tooEarly: true });
    expect(save.gold).toBe(0);
  });

  it('keeps the 100 percent completion plain-dupe EV below pack price', () => {
    const fullEv = expectedPlainDupeRefundPerPack(CARD_DB, ownershipAtCompletion(CARD_DB, 1));
    expect(fullEv).toBeLessThan(ECONOMY.packPrice);
  });
});
