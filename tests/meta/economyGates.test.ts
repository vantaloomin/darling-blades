import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { CARD_DB } from '../../src/data/catalog';
import { createRngState } from '../../src/engine/rng';
import {
  gauntletClimbEv,
  ownershipAtCompletion,
  practiceSessionEv,
  premiumDraftRunEv,
  premiumVsBoosters,
  freeDraftRunEv,
} from '../../src/meta/economyModel';
import {
  CI_FAST_CONFIG,
  DRAFT_SETUP_MINUTES,
  GAUNTLET_MATCH_MINUTES,
  evaluateProgressionBands,
  LIMITED_MATCH_MINUTES,
  PRACTICE_MATCH_MINUTES,
  runProgressionSimulation,
} from '../../scripts/progression-sim';

// 45-65% spans low-skill casual through competent regular play in the current
// deterministic sim; using both endpoints also gives the cross-mode checks a
// conservative rate mismatch instead of hiding behind one sampled point.
const REALISTIC_WIN_RATES = [0.45, 0.5, 0.55, 0.6, 0.65] as const;
const PRACTICE_MATCHES = 4;
const PREMIUM_VALUE_SAMPLES = 1_000;

function practiceGoldPerMinute(winRate: number): number {
  return practiceSessionEv({
    difficulty: 'medium',
    winRate,
    matches: PRACTICE_MATCHES,
    firstWinAvailable: false,
  }).expectedTotalGold / (PRACTICE_MATCHES * PRACTICE_MATCH_MINUTES);
}

function freeDraftGoldPerMinute(winRate: number): number {
  return freeDraftRunEv(winRate).expectedRunGold /
    (DRAFT_SETUP_MINUTES + 3 * LIMITED_MATCH_MINUTES);
}

describe('locked Layer-1 economy gates', () => {
  it('keeps the gauntlet lead and free-draft bound across the realistic win-rate range', () => {
    const fullCompletion = ownershipAtCompletion(CARD_DB, 1);
    const premiumCardValue = premiumVsBoosters(
      CARD_DB,
      fullCompletion,
      1,
      createRngState(20260715),
      PREMIUM_VALUE_SAMPLES,
    ).premium.expectedShardGold;
    const fullGauntletGoldPerMinute = gauntletClimbEv(1).expectedGold /
      (ECONOMY.gauntletRungGold.length * GAUNTLET_MATCH_MINUTES);
    const successfulPremiumGoldPerMinute = (
      premiumDraftRunEv(1, premiumCardValue).expectedRunGold + premiumCardValue
    ) / (DRAFT_SETUP_MINUTES + 3 * LIMITED_MATCH_MINUTES);
    // NOTE ON SEMANTICS (adversarial-review caveat, 2026-07-15): premium
    // g/min here is GROSS of the 1,000g entry (net would be negative), and
    // kept-card value uses the FULL-COMPLETION shard valuation (cards fully
    // liquid; at low completion premium is a card faucet, not a gold faucet,
    // and would sit below practice). Both conventions match locked decision
    // 1's gross-income ordering - this gate ranks the flows a run PAYS OUT,
    // not net earnings.
    // `>>>` is a 1.20x multiplicative floor. Measured 2026-07-16 with seed
    // 20260715 and 1,000 Premium value samples: full clear=2,170g,
    // successful Premium=339.14g, ratio=2.488x. Removing Premium run gold
    // makes this inequality strictly easier than the pre-tuning ~1.32x ratio.
    expect(fullGauntletGoldPerMinute).toBeGreaterThanOrEqual(successfulPremiumGoldPerMinute * 1.2);

    const failedPremiumGoldPerMinute = premiumDraftRunEv(0).expectedRunGold /
      (DRAFT_SETUP_MINUTES + 3 * LIMITED_MATCH_MINUTES);
    for (const winRate of REALISTIC_WIN_RATES) {
      const practice = practiceGoldPerMinute(winRate);
      const free = freeDraftGoldPerMinute(winRate);
      // Premium's intentional run-gold removal makes its fully liquidated
      // shard value roughly practice-sized rather than a separate gold faucet;
      // this gate therefore keeps the still-decided free-draft/practice bound.
      expect(practice).toBeGreaterThanOrEqual(free);
      expect(free).toBeGreaterThan(failedPremiumGoldPerMinute);
    }
    // Cross-endpoint checks make the range claim conservative: the weakest
    // practice endpoint still beats the strongest free-draft endpoint.
    expect(practiceGoldPerMinute(REALISTIC_WIN_RATES[0])).toBeGreaterThanOrEqual(
      freeDraftGoldPerMinute(REALISTIC_WIN_RATES[REALISTIC_WIN_RATES.length - 1]),
    );
  });

  it('keeps free-draft gold/hour at or below practice grinding', () => {
    const worstFreeDraftGoldPerMinute = Math.max(...REALISTIC_WIN_RATES.map(freeDraftGoldPerMinute));
    const worstPracticeGoldPerMinute = Math.min(...REALISTIC_WIN_RATES.map(practiceGoldPerMinute));
    // Decision 2 is a 1.0x ceiling. This uses the free draft's best sampled
    // rate against practice's worst sampled rate, so it is not a same-point
    // comparison that could hide a farmable edge. Times are the sim constants.
    expect(worstFreeDraftGoldPerMinute).toBeLessThanOrEqual(worstPracticeGoldPerMinute * 1.0);
  });

  it('keeps the fully successful premium total below a full gauntlet clear', () => {
    const premiumCardValue = premiumVsBoosters(
      CARD_DB,
      ownershipAtCompletion(CARD_DB, 1),
      1,
      createRngState(20260715),
      PREMIUM_VALUE_SAMPLES,
    ).premium.expectedShardGold;
    const premiumTotalGoldValue = premiumDraftRunEv(1, premiumCardValue).expectedRunGold + premiumCardValue;
    const fullGauntletGoldValue = gauntletClimbEv(1).expectedGold;
    // Seed 20260715, 1,000 model samples measured 339.14g kept-card shard
    // value. Premium now totals 339.14g versus 2,170g because run-end gold is
    // intentionally zero.
    expect(premiumTotalGoldValue).toBeLessThan(fullGauntletGoldValue);
  });

  it('gates the measured CI-fast progression bands', () => {
    const report = runProgressionSimulation(CI_FAST_CONFIG);
    const bands = evaluateProgressionBands(report);
    expect(bands.violations).toEqual([]);
    expect(bands.coarse.every((band) => band.passed)).toBe(true);
  // CI runners are 2-core and can contend with other simulation tests.
  }, 30_000);
});

// The four Phase-1 hard invariants are already covered through real meta
// behavior in tests/meta/economyModel.test.ts; this gate file intentionally
// does not duplicate those tests.
