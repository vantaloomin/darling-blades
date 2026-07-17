import { DROPS, ECONOMY } from '../config/rules';
import { rngInt, type RngState } from '../engine/rng';
import type { CardDb, CardDef, Rarity } from '../engine/types';
import { PLAYSET } from './Collection';
import { packPool } from './PackOpener';
import {
  PLAIN_VARIANT,
  rollFrame,
  rollFullArt,
  rollHolo,
  rollTier,
  shardValue,
  variantKey,
  type CardVariant,
} from './variants';

/** The collection fields needed by the analytic model. SaveData satisfies this shape. */
export interface EconomyOwnership {
  readonly collection: Readonly<Record<string, number>>;
  readonly collectionVariants: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export interface CardValueAxes {
  /** Card identities not owned before this grant. */
  expectedNewUniques: number;
  /** Gold immediately realizable by auto-melting or sharding copies beyond a per-variant playset. */
  expectedShardGold: number;
}

export interface KeptCard {
  cardId: string;
  variant: CardVariant;
}

export interface LimitedRunEv {
  winRate: number;
  expectedWins: number;
  expectedRunGold: number;
}

export interface PremiumDraftRunEv extends LimitedRunEv {
  entryCost: number;
  expectedKeptCardGold: number;
  expectedNetGold: number;
}

export interface GauntletClimbEv {
  expectedGold: number;
  expectedMatches: number;
  expectedRungsCleared: number;
  completionProbability: number;
}

export interface PracticeSessionParams {
  difficulty: keyof typeof ECONOMY.winGold;
  winRate: number;
  matches: number;
  /** Fraction of losses that reach ECONOMY.minTurnsForLossGold. */
  lossGoldEligibilityRate?: number;
  /** Whether this session can earn the day's first-win reward. */
  firstWinAvailable?: boolean;
  /** Consecutive-day streak count this session's first win would claim. Omit for no streak reward. */
  streakCount?: number;
}

export interface PracticeSessionEv {
  expectedWinGold: number;
  expectedLossGold: number;
  expectedFirstWinGold: number;
  expectedStreakGold: number;
  expectedTotalGold: number;
  expectedGoldPerMatch: number;
  probabilityOfAtLeastOneWin: number;
  minTurnsForLossGold: number;
}

export interface DailyQuestCeiling {
  questGold: number;
  streakGold: number;
  totalGold: number;
}

export interface PremiumVsBoostersSide extends CardValueAxes {
  cardCount: number;
  cost: number;
  expectedModeGold: number;
  expectedNetGoldAfterShards: number;
}

export interface PremiumVsBoostersResult {
  samples: number;
  premium: PremiumVsBoostersSide;
  boosters: PremiumVsBoostersSide;
  premiumMinusBoosters: CardValueAxes & { expectedNetGold: number };
}

type MutableOwnership = {
  collection: Record<string, number>;
  collectionVariants: Record<string, Record<string, number>>;
};

type ResolvedPool = { tier: Rarity; pool: string[] };
type ResolvedPools = Record<Rarity, ResolvedPool>;

const TIER_FALLBACK: Record<Rarity, Rarity | null> = {
  ur: 'ssr',
  ssr: 'sr',
  sr: 'r',
  r: 'c',
  c: null,
};

const PROTECTED_TIERS = new Set<Rarity>(['sr', 'ssr', 'ur']);
const PLAIN_KEY = variantKey(PLAIN_VARIANT);

function probability(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
  return value;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer`);
  return value;
}

function cloneOwnership(ownership: EconomyOwnership): MutableOwnership {
  const collectionVariants: Record<string, Record<string, number>> = {};
  for (const [id, variants] of Object.entries(ownership.collectionVariants)) {
    collectionVariants[id] = { ...variants };
  }
  return { collection: { ...ownership.collection }, collectionVariants };
}

function variantCounts(ownership: EconomyOwnership, cardId: string): Readonly<Record<string, number>> {
  const variants = ownership.collectionVariants[cardId];
  if (variants && Object.keys(variants).length > 0) return variants;
  const total = ownership.collection[cardId] ?? 0;
  return total > 0 ? { [PLAIN_KEY]: total } : {};
}

function plainCount(ownership: EconomyOwnership, cardId: string): number {
  return variantCounts(ownership, cardId)[PLAIN_KEY] ?? 0;
}

function resolvePool(
  db: CardDb,
  requestedTier: Rarity,
  set?: CardDef['set'],
): { tier: Rarity; pool: string[] } {
  let tier = requestedTier;
  let pool = packPool(db, tier, set);
  while (pool.length === 0) {
    const down = TIER_FALLBACK[tier];
    if (down === null) throw new Error('booster pool is empty at every tier');
    tier = down;
    pool = packPool(db, tier, set);
  }
  return { tier, pool };
}

function resolvePools(db: CardDb, set?: CardDef['set']): ResolvedPools {
  return Object.fromEntries(
    DROPS.tier.map(([tier]) => [tier, resolvePool(db, tier, set)]),
  ) as unknown as ResolvedPools;
}

function applyKeptCard(state: MutableOwnership, db: CardDb, card: KeptCard): CardValueAxes {
  const total = state.collection[card.cardId] ?? 0;
  const existing = variantCounts(state, card.cardId);
  const key = variantKey(card.variant);
  const variantOwned = existing[key] ?? 0;
  const expectedNewUniques = total === 0 ? 1 : 0;
  if (variantOwned >= PLAYSET) {
    return {
      expectedNewUniques,
      expectedShardGold: shardValue(db[card.cardId].rarity, card.variant),
    };
  }

  const variants = (state.collectionVariants[card.cardId] ??= { ...existing });
  variants[key] = variantOwned + 1;
  state.collection[card.cardId] = total + 1;
  return { expectedNewUniques, expectedShardGold: 0 };
}

/**
 * Build a deterministic reporting snapshot. The requested fraction of each
 * rarity pool is assigned a full plain playset; the remaining identities are
 * unowned. Sorting makes the same database and fraction reproduce exactly.
 */
export function ownershipAtCompletion(
  db: CardDb,
  completion: number,
  set?: CardDef['set'],
): EconomyOwnership {
  probability(completion, 'completion');
  const collection: Record<string, number> = {};
  const collectionVariants: Record<string, Record<string, number>> = {};
  for (const [tier] of DROPS.tier) {
    const pool = packPool(db, tier, set);
    const owned = Math.round(pool.length * completion);
    for (const id of pool.slice(0, owned)) {
      collection[id] = PLAYSET;
      collectionVariants[id] = { [PLAIN_KEY]: PLAYSET };
    }
  }
  return { collection, collectionVariants };
}

/**
 * Closed-form expected auto-melt refund from one collection booster. High-tier
 * playset protection mirrors openPack, including tier fallback and exact
 * per-card aggregate/plain ownership.
 */
export function expectedPlainDupeRefundPerPack(
  db: CardDb,
  ownership: EconomyOwnership,
  set?: CardDef['set'],
): number {
  const plainChance = (DROPS.frame.find(([frame]) => frame === 'white')?.[1] ?? 0) / 100
    * ((DROPS.holo.find(([holo]) => holo === 'none')?.[1] ?? 0) / 100);
  let expectedPerSlot = 0;
  for (const [requestedTier, weight] of DROPS.tier) {
    const { tier, pool } = resolvePool(db, requestedTier, set);
    let selected = pool;
    if (PROTECTED_TIERS.has(tier)) {
      const incomplete = pool.filter((id) => (ownership.collection[id] ?? 0) < PLAYSET);
      if (incomplete.length > 0) selected = incomplete;
    }
    const refundable = selected.filter((id) => plainCount(ownership, id) >= PLAYSET).length;
    expectedPerSlot += (weight / 100) * (refundable / selected.length) * plainChance * ECONOMY.dupeGold[tier];
  }
  return expectedPerSlot * ECONOMY.boosterPackSize;
}

/** Value a concrete kept-card grant by replaying real per-variant playset rules. */
export function keptCardValue(
  db: CardDb,
  ownership: EconomyOwnership,
  cards: readonly KeptCard[],
): CardValueAxes {
  const state = cloneOwnership(ownership);
  return cards.reduce<CardValueAxes>(
    (sum, card) => {
      const value = applyKeptCard(state, db, card);
      return {
        expectedNewUniques: sum.expectedNewUniques + value.expectedNewUniques,
        expectedShardGold: sum.expectedShardGold + value.expectedShardGold,
      };
    },
    { expectedNewUniques: 0, expectedShardGold: 0 },
  );
}

function limitedWinProbabilities(winRate: number): readonly number[] {
  const p = probability(winRate, 'winRate');
  const q = 1 - p;
  return [q ** 3, 3 * p * q ** 2, 3 * p ** 2 * q, p ** 3];
}

/** Three-match free Draft payout, excluding separate daily rewards. */
export function freeDraftRunEv(winRate: number): LimitedRunEv {
  const probabilities = limitedWinProbabilities(winRate);
  return {
    winRate,
    expectedWins: 3 * winRate,
    expectedRunGold: probabilities.reduce((sum, chance, wins) => sum + chance * ECONOMY.limitedRunGold[wins], 0),
  };
}

/** Premium Draft value after its fee; kept-card value is the only run payout. */
export function premiumDraftRunEv(winRate: number, expectedKeptCardGold = 0): PremiumDraftRunEv {
  if (!Number.isFinite(expectedKeptCardGold) || expectedKeptCardGold < 0) {
    throw new RangeError('expectedKeptCardGold must be non-negative');
  }
  const run = freeDraftRunEv(winRate);
  return {
    ...run,
    expectedRunGold: 0,
    entryCost: ECONOMY.premiumDraftEntry,
    expectedKeptCardGold,
    expectedNetGold: expectedKeptCardGold - ECONOMY.premiumDraftEntry,
  };
}

/**
 * Expected value of one climb attempt. A scalar applies to every rung; an
 * array supplies a separate win rate for every rung. Any loss pays lossGold
 * and ends the attempt, while a full clear adds the completion bonus.
 */
export function gauntletClimbEv(winRates: number | readonly number[]): GauntletClimbEv {
  const rates = typeof winRates === 'number'
    ? ECONOMY.gauntletRungGold.map(() => probability(winRates, 'winRate'))
    : [...winRates];
  if (rates.length !== ECONOMY.gauntletRungGold.length) {
    throw new RangeError(`winRates must contain ${ECONOMY.gauntletRungGold.length} rung values`);
  }

  let reachProbability = 1;
  let expectedGold = 0;
  let expectedMatches = 0;
  let expectedRungsCleared = 0;
  for (let i = 0; i < rates.length; i++) {
    const winRate = probability(rates[i], `winRates[${i}]`);
    const winProbability = reachProbability * winRate;
    const lossProbability = reachProbability * (1 - winRate);
    expectedMatches += reachProbability;
    expectedRungsCleared += winProbability;
    expectedGold += winProbability * ECONOMY.gauntletRungGold[i] + lossProbability * ECONOMY.lossGold;
    reachProbability = winProbability;
  }
  expectedGold += reachProbability * ECONOMY.gauntletCompletionBonus;
  return {
    expectedGold,
    expectedMatches,
    expectedRungsCleared,
    completionProbability: reachProbability,
  };
}

/** Practice-session EV, including first-win and streak rewards amortized over the session. */
export function practiceSessionEv(params: PracticeSessionParams): PracticeSessionEv {
  const winRate = probability(params.winRate, 'winRate');
  const eligibleLossRate = probability(params.lossGoldEligibilityRate ?? 1, 'lossGoldEligibilityRate');
  const matches = positiveInteger(params.matches, 'matches');
  const probabilityOfAtLeastOneWin = 1 - (1 - winRate) ** matches;
  const expectedWinGold = matches * winRate * ECONOMY.winGold[params.difficulty];
  const expectedLossGold = matches * (1 - winRate) * eligibleLossRate * ECONOMY.lossGold;
  const expectedFirstWinGold = params.firstWinAvailable === false
    ? 0
    : probabilityOfAtLeastOneWin * ECONOMY.firstWinOfDayBonus;
  let streakGold = 0;
  if (params.streakCount !== undefined) {
    positiveInteger(params.streakCount, 'streakCount');
    const index = Math.min(params.streakCount, ECONOMY.dailyStreakGold.length) - 1;
    streakGold = ECONOMY.dailyStreakGold[index];
  }
  const expectedStreakGold = probabilityOfAtLeastOneWin * streakGold;
  const expectedTotalGold = expectedWinGold + expectedLossGold + expectedFirstWinGold + expectedStreakGold;
  return {
    expectedWinGold,
    expectedLossGold,
    expectedFirstWinGold,
    expectedStreakGold,
    expectedTotalGold,
    expectedGoldPerMatch: expectedTotalGold / matches,
    probabilityOfAtLeastOneWin,
    minTurnsForLossGold: ECONOMY.minTurnsForLossGold,
  };
}

/** Maximum claimable daily quest plus streak gold for the supplied streak day. */
export function dailyQuestCeiling(streakCount = ECONOMY.dailyStreakGold.length): DailyQuestCeiling {
  positiveInteger(streakCount, 'streakCount');
  const questGold = ECONOMY.dailyQuestCount * ECONOMY.dailyQuestGold;
  const streakGold = ECONOMY.dailyStreakGold[Math.min(streakCount, ECONOMY.dailyStreakGold.length) - 1];
  return { questGold, streakGold, totalGold: questGold + streakGold };
}

function drawKeptCard(
  db: CardDb,
  state: MutableOwnership,
  rng: RngState,
  pools: ResolvedPools,
  dupeProtected: boolean,
): CardValueAxes {
  const rolledTier = rollTier(rng);
  const resolved = pools[rolledTier];
  let pool = resolved.pool;
  if (dupeProtected && PROTECTED_TIERS.has(resolved.tier)) {
    const incomplete = pool.filter((id) => (state.collection[id] ?? 0) < PLAYSET);
    if (incomplete.length > 0) pool = incomplete;
  }
  const card: KeptCard = {
    cardId: pool[rngInt(rng, pool.length)],
    variant: { frame: rollFrame(rng), holo: rollHolo(rng), fullArt: rollFullArt(rng) },
  };
  return applyKeptCard(state, db, card);
}

function sampledCardValue(
  db: CardDb,
  ownership: EconomyOwnership,
  rng: RngState,
  cardCount: number,
  samples: number,
  pools: ResolvedPools,
  dupeProtected: boolean,
): CardValueAxes {
  let newUniques = 0;
  let shardGold = 0;
  for (let sample = 0; sample < samples; sample++) {
    const state = cloneOwnership(ownership);
    for (let card = 0; card < cardCount; card++) {
      const value = drawKeptCard(db, state, rng, pools, dupeProtected);
      newUniques += value.expectedNewUniques;
      shardGold += value.expectedShardGold;
    }
  }
  return {
    expectedNewUniques: newUniques / samples,
    expectedShardGold: shardGold / samples,
  };
}

/**
 * Compare a selection-neutral 45-card Premium Draft baseline with three
 * collection boosters (27 rolls). The caller owns the seeded RNG. Premium
 * draws use Limited's unprotected card rolls; booster draws use openPack's
 * high-tier playset protection. Both sides use the same per-variant value rules;
 * Premium's mode-gold term is zero because its entry fee already buys the kept
 * picks.
 */
export function premiumVsBoosters(
  db: CardDb,
  ownership: EconomyOwnership,
  winRate: number,
  rng: RngState,
  samples = 5_000,
): PremiumVsBoostersResult {
  positiveInteger(samples, 'samples');
  const pools = resolvePools(db);
  const premiumCards = sampledCardValue(db, ownership, rng, 45, samples, pools, false);
  const boosterCardCount = ECONOMY.boosterPackSize * 3;
  const boosterCards = sampledCardValue(db, ownership, rng, boosterCardCount, samples, pools, true);
  const run = premiumDraftRunEv(winRate, premiumCards.expectedShardGold);
  const boosterCost = ECONOMY.packPrice * 3;
  const premium: PremiumVsBoostersSide = {
    ...premiumCards,
    cardCount: 45,
    cost: ECONOMY.premiumDraftEntry,
    expectedModeGold: run.expectedRunGold,
    expectedNetGoldAfterShards: run.expectedNetGold,
  };
  const boosters: PremiumVsBoostersSide = {
    ...boosterCards,
    cardCount: boosterCardCount,
    cost: boosterCost,
    expectedModeGold: 0,
    expectedNetGoldAfterShards: boosterCards.expectedShardGold - boosterCost,
  };
  return {
    samples,
    premium,
    boosters,
    premiumMinusBoosters: {
      expectedNewUniques: premium.expectedNewUniques - boosters.expectedNewUniques,
      expectedShardGold: premium.expectedShardGold - boosters.expectedShardGold,
      expectedNetGold: premium.expectedNetGoldAfterShards - boosters.expectedNetGoldAfterShards,
    },
  };
}
