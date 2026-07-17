/**
 * Headless progression/economy harness.
 *
 * Usage:
 *   npx tsx scripts/progression-sim.ts --seeds 8
 *   npx tsx scripts/progression-sim.ts --seeds 12 --days 7,14,30,60 --personas new-casual,hardcore-optimizer
 *   npx tsx scripts/progression-sim.ts --check --seeds 1 --days 7 --personas new-casual,limited-fan,hardcore-optimizer
 *
 * The harness runs the real engine + AI + meta reward systems. It does not
 * auto-build upgraded constructed decks from opened packs; combat power stays
 * tied to each persona's chosen starter/theme deck so the measurement isolates
 * reward pacing and play-style economy.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AIPlayer } from '../src/ai/AIPlayer';
import { buildAI } from '../src/ai/personality';
import { ECONOMY } from '../src/config/rules';
import { CARD_DB } from '../src/data/catalog';
import { draftPersonaById } from '../src/data/draftPersonas';
import { avatarForRung } from '../src/data/opponents';
import { STARTER_DECKS, THEME_DECKS, type DeckList } from '../src/data/starterDecks';
import type { GameEvent } from '../src/engine/events';
import { Game } from '../src/engine/Game';
import { createRngState, rngFloat, type RngState } from '../src/engine/rng';
import { def, isType, type CardDb, type CardDef, type Color, type Rarity } from '../src/engine/types';
import { claimAllAchievements, syncAchievements } from '../src/meta/Achievements';
import { craftCard, craftCost, shardableCount, shardExcess, shardGold } from '../src/meta/Collection';
import { collectiblePool, collectionCompletion } from '../src/meta/collectionFilter';
import { deckColorStyle } from '../src/meta/deckColorIdentity';
import {
  applyGauntletResult,
  applyLimitedMatchResult,
  applyMatchResult,
  buyThemeDeck,
  claimFreeStarter,
  payPremiumDraftEntry,
  premiumWeekKey,
  spendGold,
  type Difficulty,
} from '../src/meta/Economy';
import { rungSeed } from '../src/meta/gauntletSeed';
import {
  buildLimitedDeck,
  completeDraftRun,
  currentDraftPack,
  grantPremiumDraftPool,
  limitedDuelData,
  pickDraftCard,
  startDraftRun,
  type LimitedRun,
} from '../src/meta/Limited';
import { DEFAULT_PICKER, makePicker, pickNoise, scorePick, type PickerProfile } from '../src/meta/draftPicker';
import { openPack } from '../src/meta/PackOpener';
import {
  applyDailyQuestProgress,
  claimDailyQuest,
  dailyQuestStatuses,
  dailyQuestDef,
  dailyRerollsRemaining,
  dailyStreakStatus,
  ensureDailyState,
  recordDailyWin,
  rerollDailyQuest,
} from '../src/meta/Quests';
import { freshSave, type SaveData } from '../src/meta/SaveManager';

const START_DAY_MS = Date.UTC(2026, 6, 9);
const MAX_STEPS = 40_000;
const HUMAN = 0;
export const PRACTICE_MATCH_MINUTES = 10;
export const GAUNTLET_MATCH_MINUTES = 12;
export const LIMITED_MATCH_MINUTES = 14;
export const DRAFT_SETUP_MINUTES = 14;
export const PACK_OPEN_MINUTES = 1.25;
export const DECK_BUY_MINUTES = 1.5;
export const QUEST_REROLL_MINUTES = 0.5;

type PackPreference = 'base' | 'ragnarok' | 'arthurian-court' | 'mixed' | 'none';
type AchievementPolicy = 'claim' | 'ignore';
type DailyCount = number | { min: number; max: number };

interface PracticePlan {
  difficulty: Difficulty;
  games: DailyCount;
}

interface QuestChasePlan {
  difficulty: Difficulty;
  maxExtraGames: number;
}

interface SpendingPlan {
  packPreference: PackPreference;
  reserveGold?: number;
  buyOtherStartersFirst?: boolean;
  buyThemeDeckFirst?: boolean;
}

export interface PolicyQuestView {
  readonly id: string;
  readonly progress: number;
  readonly target: number;
  readonly complete: boolean;
  readonly claimed: boolean;
  readonly rewardGold: number;
}

/** Read-only state passed to a persona's optional daily policy callback. */
export interface PolicyView {
  readonly day: number;
  readonly today: string;
  readonly gold: number;
  readonly collectionPct: number;
  readonly collectionSize: number;
  readonly packsOpened: number;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  /**
   * Start-of-day planning view: this is 0 when the daily policy is called.
   * The time budget is advisory; policies must self-police their planned work.
   */
  readonly minutesUsed: number;
  /** Infinity when the persona did not declare a daily time budget. */
  readonly minutesBudget: number;
  /**
   * Start-of-day planning view: this equals the full declared budget when the
   * daily policy is called. The budget is advisory; policies must self-police.
   */
  readonly minutesRemaining: number;
  readonly quests: readonly PolicyQuestView[];
  readonly quest: {
    readonly completed: number;
    readonly claimed: number;
    readonly rerollsRemaining: number;
  };
  readonly gauntlet: {
    readonly activeRung: number | null;
    readonly bestRung: number;
    readonly completions: number;
  };
  readonly streak: {
    readonly count: number;
    readonly wonToday: boolean;
    readonly nextCount: number;
    readonly nextGold: number;
  };
  readonly limited: {
    readonly active: boolean;
    readonly premium: boolean;
  };
  readonly achievements: {
    readonly unlocked: number;
    readonly claimed: number;
  };
  readonly premiumDraftAffordable: boolean;
}

export interface PolicyDayPlan {
  readonly practice?: { difficulty: Difficulty; count: number };
  readonly gauntlet?: { matches: number; stopAfterLoss?: boolean };
  readonly limited?: { matches: number; premium?: boolean };
  readonly quests?: {
    /** Explicit quest indexes to reroll. The callback owns their ordering. */
    rerollIndexes?: readonly number[];
    rerollOffColor?: boolean;
    claimIndexes?: readonly number[];
    claimCompleted?: boolean;
    chase?: { difficulty: Difficulty; maxExtraGames: number } | null;
  };
  readonly spending?: Partial<SpendingPlan>;
  readonly shardSpecialExcess?: boolean;
  readonly claimAchievements?: boolean;
}

export interface PlayerPersona {
  id: string;
  name: string;
  style: string;
  starterId: string;
  pilotSkill: Difficulty;
  practice?: PracticePlan;
  gauntletMatches?: DailyCount;
  stopGauntletAfterLoss?: boolean;
  limited?: { matches: DailyCount; premiumWhenAffordable?: boolean };
  questChase?: QuestChasePlan;
  rerollOffColorQuests?: boolean;
  shardSpecialExcess?: boolean;
  /**
   * Optional advisory daily budget exposed to a dynamic policy; no budget
   * means Infinity. The simulator does not enforce it, so policies must
   * self-police their planned work: a policy returning practice:{count:500}
   * runs all 500 games.
   */
  timeBudgetMinutes?: number;
  /** Deterministic per-day override layer; absent keeps the scripted persona byte-identical. */
  dailyPolicy?: (view: PolicyView) => PolicyDayPlan;
  spending: SpendingPlan;
  achievements: AchievementPolicy;
}

/**
 * Additive, sim-only economy experiments. An omitted config is the shipped
 * progression model; no product constants are changed by these knobs.
 */
export interface TuningExperimentConfig {
  cooldownDays?: number;
  weeklyCap?: number;
  limitedRunGoldOverride?: readonly [number, number, number, number];
  premiumRunGold?: 'full' | 'none';
  crafting?: { enabled: true; craftCostMult: number };
}

const SHIPPED_TUNING_DEFAULTS: TuningExperimentConfig = Object.freeze({
  weeklyCap: ECONOMY.premiumWeeklyCap,
  premiumRunGold: 'none',
  crafting: { enabled: true as const, craftCostMult: ECONOMY.craftCostMult },
});

export interface RewardLedger {
  starting: number;
  practice: number;
  gauntlet: number;
  limited: number;
  firstWin: number;
  streak: number;
  daily: number;
  achievements: number;
  dupes: number;
  shards: number;
}

export interface SpendLedger {
  packs: number;
  decks: number;
  premiumDraftEntries: number;
  crafts: number;
}

export interface ProgressSnapshot {
  personaId: string;
  personaName: string;
  style: string;
  day: number;
  sample: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  goldEarned: number;
  goldSpent: number;
  goldNet: number;
  finalGold: number;
  packsOpened: number;
  decksOwned: number;
  collectionSize: number;
  uniqueCards: number;
  cardsOwned: number;
  collectionPct: number;
  specialVariants: number;
  /** Distinct owned card identities per rarity tier (graphable acquisition rates). */
  ownedUniquesByTier: Record<Rarity, number>;
  duplicateRefundGold: number;
  shardGold: number;
  achievementsUnlocked: number;
  achievementsClaimed: number;
  dailyQuestCompletions: number;
  dailyQuestClaims: number;
  dailyQuestCompletionRate: number;
  dailyQuestClaimRate: number;
  streakLength: number;
  gauntletBestRung: number;
  gauntletCompletions: number;
  limitedRuns: number;
  premiumDraftRuns: number;
  premiumDraftCardsKept: number;
  limitedWins: number;
  limitedLosses: number;
  limitedAvgWins: number;
  limitedAvgLosses: number;
  sessionMinutes: number;
  minutesPerDay: number;
  craftedUniques?: number;
  rewards: RewardLedger;
  spent: SpendLedger;
}

export interface ProgressAggregate {
  personaId: string;
  personaName: string;
  style: string;
  day: number;
  samples: number;
  games: number;
  winRate: number;
  goldEarned: number;
  goldSpent: number;
  goldNet: number;
  finalGold: number;
  packsOpened: number;
  packsPerDay: number;
  collectionSize: number;
  uniqueCards: number;
  cardsOwned: number;
  collectionPct: number;
  specialVariants: number;
  /** Distinct owned card identities per rarity tier (graphable acquisition rates). */
  ownedUniquesByTier: Record<Rarity, number>;
  duplicateRefundGold: number;
  shardGold: number;
  achievementsUnlocked: number;
  achievementsClaimed: number;
  dailyQuestCompletions: number;
  dailyQuestClaims: number;
  dailyQuestCompletionRate: number;
  dailyQuestClaimRate: number;
  streakLength: number;
  gauntletBestRung: number;
  gauntletCompletions: number;
  limitedRuns: number;
  premiumDraftRuns: number;
  premiumDraftCardsKept: number;
  limitedWins: number;
  limitedLosses: number;
  limitedAvgWins: number;
  limitedAvgLosses: number;
  sessionMinutes: number;
  minutesPerDay: number;
  craftedUniques?: number;
  rewards: RewardLedger;
  spent: SpendLedger;
}

export interface RewardVerdict {
  label: 'stingy' | 'generous' | 'reasonable' | 'uneven';
  bullets: string[];
}

export interface ProgressionReport {
  seeds: number;
  days: number[];
  personas: PlayerPersona[];
  experiment?: TuningExperimentConfig;
  snapshots: ProgressSnapshot[];
  aggregates: ProgressAggregate[];
  verdict: RewardVerdict;
}

interface SimStats {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  sessionMinutes: number;
  dailyQuestCompletions: number;
  dailyQuestClaims: number;
  dailyQuestSlots: number;
  gauntletCompletions: number;
  limitedRuns: number;
  premiumDraftRuns: number;
  premiumDraftCardsKept: number;
  craftedUniques: number;
  limitedWins: number;
  limitedLosses: number;
  rewards: RewardLedger;
  spent: SpendLedger;
}

interface SimContext {
  persona: PlayerPersona;
  sample: number;
  baseSeed: number;
  experiment?: TuningExperimentConfig;
  save: SaveData;
  rng: RngState;
  serial: number;
  dayMinutes: number;
  lastPremiumDay: number | null;
  premiumEntryDays: string[];
  dayPlan?: PolicyDayPlan;
  stats: SimStats;
}

interface MatchResult {
  winner: 0 | 1 | 'draw';
  events: GameEvent[];
  turns: number;
}

export interface RunOptions {
  seeds?: number;
  days?: readonly number[];
  personas?: readonly PlayerPersona[];
  baseSeed?: number;
  experiment?: TuningExperimentConfig;
}

export const PLAYER_PERSONAS: readonly PlayerPersona[] = Object.freeze([
  {
    id: 'new-casual',
    name: 'New Casual',
    style: '1-2 matches/day, buys packs when affordable, rarely rerolls',
    starterId: 'starter-crimson',
    pilotSkill: 'easy',
    practice: { difficulty: 'easy', games: { min: 1, max: 2 } },
    spending: { packPreference: 'base' },
    achievements: 'claim',
  },
  {
    id: 'daily-grinder',
    name: 'Daily Grinder',
    style: 'clears dailies, first win, and streak',
    starterId: 'starter-wild',
    pilotSkill: 'medium',
    practice: { difficulty: 'medium', games: 3 },
    questChase: { difficulty: 'medium', maxExtraGames: 3 },
    spending: { packPreference: 'mixed' },
    achievements: 'claim',
  },
  {
    id: 'gauntlet-climber',
    name: 'Gauntlet Climber',
    style: 'mostly Tower/Gauntlet, stops after a loss',
    starterId: 'starter-tides',
    pilotSkill: 'hard',
    practice: { difficulty: 'medium', games: 1 },
    gauntletMatches: 5,
    stopGauntletAfterLoss: true,
    spending: { packPreference: 'mixed', reserveGold: 250 },
    achievements: 'claim',
  },
  {
    id: 'limited-fan',
    name: 'Limited Fan',
    style: 'drafts most days and saves for Premium Draft entries',
    starterId: 'starter-mandate',
    pilotSkill: 'medium',
    practice: { difficulty: 'medium', games: 1 },
    limited: { matches: 3, premiumWhenAffordable: true },
    spending: { packPreference: 'mixed', reserveGold: ECONOMY.premiumDraftEntry },
    achievements: 'claim',
  },
  {
    id: 'collector',
    name: 'Collector',
    style: 'opens packs aggressively, chases unique cards and variants',
    starterId: 'starter-harvest',
    pilotSkill: 'medium',
    practice: { difficulty: 'easy', games: 3 },
    shardSpecialExcess: true,
    spending: { packPreference: 'mixed' },
    achievements: 'claim',
  },
  {
    id: 'theme-deck-buyer',
    name: 'Theme Deck Buyer',
    style: 'saves for starter/theme decks before packs',
    starterId: 'starter-crimson',
    pilotSkill: 'medium',
    practice: { difficulty: 'medium', games: 3 },
    spending: {
      packPreference: 'base',
      reserveGold: 0,
      buyOtherStartersFirst: true,
      buyThemeDeckFirst: true,
    },
    achievements: 'claim',
  },
  {
    id: 'hardcore-optimizer',
    name: 'Hardcore Optimizer',
    style: 'rerolls bad quests, plays best reward/hour line',
    starterId: 'starter-wild',
    pilotSkill: 'hard',
    practice: { difficulty: 'hard', games: 4 },
    gauntletMatches: 2,
    questChase: { difficulty: 'hard', maxExtraGames: 3 },
    rerollOffColorQuests: true,
    spending: { packPreference: 'mixed' },
    achievements: 'claim',
  },
  {
    id: 'low-skill-casual',
    name: 'Low Skill Casual',
    style: 'lower win rate, fewer quests completed',
    starterId: 'starter-tides',
    pilotSkill: 'easy',
    practice: { difficulty: 'medium', games: { min: 1, max: 2 } },
    spending: { packPreference: 'base', reserveGold: 150 },
    achievements: 'claim',
  },
  {
    id: 'high-skill-veteran',
    name: 'High Skill Veteran',
    style: 'better win rate, clears harder content',
    starterId: 'starter-mandate',
    pilotSkill: 'hard',
    practice: { difficulty: 'hard', games: 3 },
    gauntletMatches: 3,
    spending: { packPreference: 'mixed', reserveGold: 250 },
    achievements: 'claim',
  },
  {
    id: 'completionist',
    name: 'Completionist',
    style: 'chases achievements even when reward-inefficient',
    starterId: 'starter-harvest',
    pilotSkill: 'hard',
    practice: { difficulty: 'hard', games: 3 },
    gauntletMatches: 2,
    limited: { matches: 1 },
    questChase: { difficulty: 'hard', maxExtraGames: 2 },
    rerollOffColorQuests: true,
    spending: {
      packPreference: 'mixed',
      reserveGold: 0,
      buyOtherStartersFirst: true,
      buyThemeDeckFirst: true,
    },
    achievements: 'claim',
  },
]);

export const CI_FAST_PERSONA_IDS = Object.freeze([
  'new-casual',
  'limited-fan',
] as const);

/**
 * The always-on macro gate: 2 personas x 1 deterministic seed x 7 simulated
 * days. The first measured 3-person run took 13.81s on 2026-07-15, above the
 * roughly-10s CI target, so the gate keeps the casual + Limited coverage and
 * shrinks only the persona count.
 */
export const CI_FAST_CONFIG = Object.freeze({
  seeds: 1,
  days: Object.freeze([7]),
  personas: Object.freeze(
    PLAYER_PERSONAS.filter((persona) => CI_FAST_PERSONA_IDS.includes(persona.id as (typeof CI_FAST_PERSONA_IDS)[number])),
  ),
});

export interface ProgressionBandResult {
  name: string;
  measured: number;
  min?: number;
  max?: number;
  sample: string;
  passed: boolean;
}

export interface ProgressionBandReport {
  day: number;
  coarse: ProgressionBandResult[];
  coarseSkipReason?: string;
  fineFlags: string[];
  violations: string[];
}

/**
 * Coarse CI bands are intentionally wide. The measured reference values and
 * the rationale for these edges are updated from the CI-fast run, never tuned
 * to make an unrelated change pass.
 *
 * CI-fast measurement on 2026-07-16: 2 persona aggregates (New Casual and
 * Limited Fan) x 1 seed x day 7; packs/day median 0.429, minimum quest claim
 * rate 0.286, max-gold/game ÷ cohort-median 1.000, and median collection
 * 0.266. Limited Fan completed 2 Premium runs, matching the weekly cap. The
 * bands [0.15, 2.5], >=0.20, <=4.0, and [0.03, 0.70] leave at least 30%
 * downward headroom on the floor metrics and are deliberately broad enough to
 * catch only large macro drift. The direct simulation took 1.07s.
 */
export const COARSE_PROGRESSION_BANDS = Object.freeze({
  packsPerDay: Object.freeze({ min: 0.15, max: 2.5 }),
  minQuestClaimRate: 0.2,
  maxGoldPerGameMultiple: 4,
  collectionPct: Object.freeze({ min: 0.03, max: 0.7 }),
});

export const CANONICAL_FINE_BASELINE_DATE = '2026-07-15';
export const CANONICAL_FINE_BASELINE_SAMPLE = '10 personas x 8 seeds x 60 days, pre-tuning';

/**
 * Flag-only bands measured from balance/econ-baseline-2026-07-15.report.json.
 * Baseline rows are day-60 aggregates; the wide edges are intentional and do
 * not affect --check's exit code. Measured -> band: collection %, packs/day,
 * premium runs, quest claim rate.
 *
 * new-casual 57.41 -> 45..70, 0.56 -> 0.10..1.20, 0 -> 0..1, 43.33 -> 25..65
 * daily-grinder 80.05 -> 65..95, 1.59 -> 0.90..2.40, 0 -> 0..1, 69.86 -> 50..90
 * gauntlet-climber 77.15 -> 62..92, 1.41 -> 0.80..2.20, 0 -> 0..1, 68.33 -> 48..88
 * limited-fan 96.81 -> 82..100, 0.06 -> 0..0.90, 35.38 -> 25..45, 70.07 -> 50..90
 * collector 71.49 -> 56..87, 1.04 -> 0.50..1.80, 0 -> 0..1, 65.97 -> 45..85
 * theme-deck-buyer 80.27 -> 65..95, 0.91 -> 0.40..1.60, 0 -> 0..1, 60.07 -> 40..80
 * hardcore-optimizer 89.72 -> 75..100, 2.41 -> 1.50..3.40, 0 -> 0..1, 80.83 -> 65..95
 * low-skill-casual 52.47 -> 37..67, 0.47 -> 0.10..1.00, 0 -> 0..1, 40.83 -> 20..60
 * high-skill-veteran 85.10 -> 70..100, 1.93 -> 1.10..2.80, 0 -> 0..1, 78.19 -> 60..95
 * completionist 91.44 -> 76..100, 2.29 -> 1.40..3.20, 0 -> 0..1, 88.54 -> 70..100
 */
export const CANONICAL_FINE_BANDS: Readonly<Record<string, {
  collectionPct: readonly [number, number];
  packsPerDay: readonly [number, number];
  premiumDraftRuns: readonly [number, number];
  dailyQuestClaimRate: readonly [number, number];
}>> = Object.freeze({
  'new-casual': { collectionPct: [0.45, 0.7], packsPerDay: [0.1, 1.2], premiumDraftRuns: [0, 1], dailyQuestClaimRate: [0.25, 0.65] },
  'daily-grinder': { collectionPct: [0.65, 0.95], packsPerDay: [0.9, 2.4], premiumDraftRuns: [0, 1], dailyQuestClaimRate: [0.5, 0.9] },
  'gauntlet-climber': { collectionPct: [0.62, 0.92], packsPerDay: [0.8, 2.2], premiumDraftRuns: [0, 1], dailyQuestClaimRate: [0.48, 0.88] },
  'limited-fan': { collectionPct: [0.82, 1], packsPerDay: [0, 0.9], premiumDraftRuns: [25, 45], dailyQuestClaimRate: [0.5, 0.9] },
  collector: { collectionPct: [0.56, 0.87], packsPerDay: [0.5, 1.8], premiumDraftRuns: [0, 1], dailyQuestClaimRate: [0.45, 0.85] },
  'theme-deck-buyer': { collectionPct: [0.65, 0.95], packsPerDay: [0.4, 1.6], premiumDraftRuns: [0, 1], dailyQuestClaimRate: [0.4, 0.8] },
  'hardcore-optimizer': { collectionPct: [0.75, 1], packsPerDay: [1.5, 3.4], premiumDraftRuns: [0, 1], dailyQuestClaimRate: [0.65, 0.95] },
  'low-skill-casual': { collectionPct: [0.37, 0.67], packsPerDay: [0.1, 1], premiumDraftRuns: [0, 1], dailyQuestClaimRate: [0.2, 0.6] },
  'high-skill-veteran': { collectionPct: [0.7, 1], packsPerDay: [1.1, 2.8], premiumDraftRuns: [0, 1], dailyQuestClaimRate: [0.6, 0.95] },
  completionist: { collectionPct: [0.76, 1], packsPerDay: [1.4, 3.2], premiumDraftRuns: [0, 1], dailyQuestClaimRate: [0.7, 1] },
});

const emptyRewards = (): RewardLedger => ({
  starting: 0,
  practice: 0,
  gauntlet: 0,
  limited: 0,
  firstWin: 0,
  streak: 0,
  daily: 0,
  achievements: 0,
  dupes: 0,
  shards: 0,
});

const emptySpent = (): SpendLedger => ({ packs: 0, decks: 0, premiumDraftEntries: 0, crafts: 0 });

function freshStats(): SimStats {
  return {
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    sessionMinutes: 0,
    dailyQuestCompletions: 0,
    dailyQuestClaims: 0,
    dailyQuestSlots: 0,
    gauntletCompletions: 0,
    limitedRuns: 0,
    premiumDraftRuns: 0,
    premiumDraftCardsKept: 0,
    craftedUniques: 0,
    limitedWins: 0,
    limitedLosses: 0,
    rewards: emptyRewards(),
    spent: emptySpent(),
  };
}

function addRewards(a: RewardLedger, b: RewardLedger): RewardLedger {
  return {
    starting: a.starting + b.starting,
    practice: a.practice + b.practice,
    gauntlet: a.gauntlet + b.gauntlet,
    limited: a.limited + b.limited,
    firstWin: a.firstWin + b.firstWin,
    streak: a.streak + b.streak,
    daily: a.daily + b.daily,
    achievements: a.achievements + b.achievements,
    dupes: a.dupes + b.dupes,
    shards: a.shards + b.shards,
  };
}

function addSpent(a: SpendLedger, b: SpendLedger): SpendLedger {
  return {
    packs: a.packs + b.packs,
    decks: a.decks + b.decks,
    premiumDraftEntries: a.premiumDraftEntries + b.premiumDraftEntries,
    crafts: a.crafts + b.crafts,
  };
}

function rewardTotal(rewards: RewardLedger): number {
  return (
    rewards.starting +
    rewards.practice +
    rewards.gauntlet +
    rewards.limited +
    rewards.firstWin +
    rewards.streak +
    rewards.daily +
    rewards.achievements +
    rewards.dupes +
    rewards.shards
  );
}

function spentTotal(spent: SpendLedger): number {
  return spent.packs + spent.decks + spent.premiumDraftEntries + spent.crafts;
}

function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h || 1;
}

function clampSeed(seed: number): number {
  const n = Math.trunc(seed) & 0x7fffffff;
  return n === 0 ? 1 : n;
}

function nextSeed(ctx: SimContext, label: string): number {
  ctx.serial++;
  return clampSeed(hashString(`${ctx.baseSeed}|${ctx.persona.id}|${ctx.sample}|${ctx.serial}|${label}`));
}

function addMinutes(ctx: SimContext, minutes: number): void {
  ctx.stats.sessionMinutes += minutes;
  ctx.dayMinutes += minutes;
}

function dayString(dayIndex: number): string {
  return new Date(START_DAY_MS + dayIndex * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dayTimestamp(dayIndex: number): number {
  return START_DAY_MS + dayIndex * 24 * 60 * 60 * 1000;
}

function configuredLimitedRunGold(
  experiment: TuningExperimentConfig | undefined,
  wins: number,
  premium: boolean,
): number {
  const recordGold = experiment?.limitedRunGoldOverride?.[wins] ?? ECONOMY.limitedRunGold[wins] ?? 0;
  return premium && experiment?.premiumRunGold !== 'full' ? 0 : recordGold;
}

function configuredPremiumWeeklyCap(experiment: TuningExperimentConfig | undefined): number {
  return experiment?.weeklyCap ?? ECONOMY.premiumWeeklyCap;
}

function premiumEntryAllowed(ctx: SimContext, day: number, today: string): boolean {
  if (ctx.experiment?.cooldownDays !== undefined && ctx.lastPremiumDay !== null && day < ctx.lastPremiumDay + ctx.experiment.cooldownDays) {
    return false;
  }
  const week = premiumWeekKey(today);
  const entriesThisWeek = ctx.premiumEntryDays.filter((entryDay) => premiumWeekKey(entryDay) === week).length;
  return entriesThisWeek < configuredPremiumWeeklyCap(ctx.experiment);
}

function starterById(id: string): DeckList {
  const deck = STARTER_DECKS.find((d) => d.id === id);
  if (!deck) throw new Error(`Unknown starter persona deck: ${id}`);
  return deck;
}

function activeDeck(save: SaveData): string[] {
  return save.decks.find((d) => d.id === save.activeDeckId)?.cards ?? STARTER_DECKS[0].cards;
}

function practiceOpponentDeck(save: SaveData): string[] {
  return STARTER_DECKS.find((d) => d.id !== save.activeDeckId)?.cards ?? STARTER_DECKS[1].cards;
}

function deckColors(cards: readonly string[], db: CardDb): Set<Color> {
  const colors = new Set<Color>();
  for (const id of cards) {
    const d = def(db, id);
    if (isType(d, 'land')) continue;
    for (const color of d.colors) colors.add(color);
  }
  return colors;
}

function offColorQuestId(id: string, colors: ReadonlySet<Color>): boolean {
  const map: Record<string, Color> = {
    'cast-white-3': 'W',
    'cast-blue-3': 'U',
    'cast-black-3': 'B',
    'cast-red-3': 'R',
    'cast-green-3': 'G',
  };
  const color = map[id];
  return color !== undefined && !colors.has(color);
}

function rerollOffColorQuests(ctx: SimContext, today: string): void {
  if (!ctx.persona.rerollOffColorQuests) return;
  const colors = deckColors(activeDeck(ctx.save), CARD_DB);
  for (let i = 0; i < ctx.save.daily.quests.length; i++) {
    const q = ctx.save.daily.quests[i];
    if (!q || q.claimed) continue;
    if (!offColorQuestId(q.id, colors)) continue;
    const result = rerollDailyQuest(ctx.save, i, today);
    if (result.ok) addMinutes(ctx, QUEST_REROLL_MINUTES);
  }
}

function rerollQuestIndexes(ctx: SimContext, today: string, indexes: readonly number[]): void {
  for (const index of indexes) {
    if (!Number.isInteger(index) || index < 0) continue;
    const result = rerollDailyQuest(ctx.save, index, today);
    if (result.ok) addMinutes(ctx, QUEST_REROLL_MINUTES);
  }
}

function applyDailyPolicyRerolls(ctx: SimContext, today: string): void {
  const quests = ctx.dayPlan?.quests;
  if (quests?.rerollIndexes !== undefined) {
    rerollQuestIndexes(ctx, today, quests.rerollIndexes);
    return;
  }
  if (quests?.rerollOffColor !== undefined) {
    if (quests.rerollOffColor) rerollOffColorQuests(ctx, today);
    return;
  }
  rerollOffColorQuests(ctx, today);
}

function buildPolicyView(ctx: SimContext, day: number, today: string): PolicyView {
  const completion = collectionCompletion(Object.values(CARD_DB), ctx.save);
  const statuses = dailyQuestStatuses(ctx.save, today);
  const quests = Object.freeze(statuses.map((status) => Object.freeze({
    // Keep the policy view sourced from the definition, not the persisted
    // save value, so per-quest reward changes cannot desync planning.
    rewardGold: dailyQuestDef(status.id)!.rewardGold,
    id: status.id,
    progress: status.progress,
    target: status.target,
    complete: status.complete,
    claimed: status.claimed,
  })));
  const streak = dailyStreakStatus(ctx.save, today);
  const minutesBudget = ctx.persona.timeBudgetMinutes ?? Number.POSITIVE_INFINITY;
  const minutesRemaining = Number.isFinite(minutesBudget)
    ? Math.max(0, minutesBudget - ctx.dayMinutes)
    : Number.POSITIVE_INFINITY;
  return {
    day,
    today,
    gold: ctx.save.gold,
    collectionPct: completion.percent,
    collectionSize: completion.owned,
    packsOpened: ctx.save.stats.packsOpened,
    games: ctx.stats.games,
    wins: ctx.stats.wins,
    losses: ctx.stats.losses,
    draws: ctx.stats.draws,
    minutesUsed: ctx.dayMinutes,
    minutesBudget,
    minutesRemaining,
    quests,
    quest: {
      completed: quests.filter((quest) => quest.complete).length,
      claimed: quests.filter((quest) => quest.claimed).length,
      rerollsRemaining: dailyRerollsRemaining(ctx.save, today),
    },
    gauntlet: {
      activeRung: ctx.save.gauntlet.run?.rung ?? null,
      bestRung: ctx.save.gauntlet.bestRung,
      completions: ctx.save.gauntlet.completions,
    },
    streak: {
      count: streak.count,
      wonToday: streak.wonToday,
      nextCount: streak.nextCount,
      nextGold: streak.nextGold,
    },
    limited: {
      active: ctx.save.limited.activeRun !== null,
      premium: ctx.save.limited.activeRun?.premium ?? false,
    },
    achievements: {
      unlocked: ctx.save.achievements.unlocked.length,
      claimed: ctx.save.achievements.claimed.length,
    },
    premiumDraftAffordable: ctx.save.gold >= ECONOMY.premiumDraftEntry,
  };
}

function dailyCount(count: DailyCount | undefined, ctx: SimContext, dayIndex: number, label: string): number {
  if (count === undefined) return 0;
  if (typeof count === 'number') return Math.max(0, Math.trunc(count));
  const min = Math.max(0, Math.trunc(Math.min(count.min, count.max)));
  const max = Math.max(min, Math.trunc(Math.max(count.min, count.max)));
  if (max === min) return min;
  const roll = hashString(`${ctx.baseSeed}|${ctx.persona.id}|${ctx.sample}|${dayIndex}|${label}`);
  return min + (roll % (max - min + 1));
}

function playHeadlessMatch(
  seed: number,
  p0: AIPlayer,
  p1: AIPlayer,
  decks: [string[], string[]],
): MatchResult {
  const game = new Game({ decks, seed, db: CARD_DB });
  const ais = [p0, p1];
  const events = [...game.initialEvents];
  for (let i = 0; i < MAX_STEPS; i++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      return { winner: game.state.winner ?? 'draw', events, turns: game.state.turn };
    }
    const action = ais[awaiting.player].chooseAction(
      game.viewFor(awaiting.player),
      game.legalActions(awaiting.player),
    );
    events.push(...game.submit(awaiting.player, action));
  }
  throw new Error(`progression sim game seed ${seed} did not terminate`);
}

function recordOutcome(ctx: SimContext, winner: 0 | 1 | 'draw'): boolean {
  ctx.stats.games++;
  if (winner === HUMAN) {
    ctx.stats.wins++;
    return true;
  }
  if (winner === 'draw') ctx.stats.draws++;
  else ctx.stats.losses++;
  return false;
}

function firstWinGold(firstWinBonus: boolean): number {
  return firstWinBonus ? ECONOMY.firstWinOfDayBonus : 0;
}

function applyWinStreak(ctx: SimContext, won: boolean, today: string): void {
  if (!won) return;
  const streak = recordDailyWin(ctx.save, today);
  ctx.stats.rewards.streak += streak.gold;
}

function claimDailyRewards(ctx: SimContext, today: string): void {
  const questPlan = ctx.dayPlan?.quests;
  if (questPlan?.claimCompleted === false) return;
  const statuses = dailyQuestStatuses(ctx.save, today);
  for (let i = 0; i < statuses.length; i++) {
    const s = statuses[i];
    if (!s.complete || s.claimed) continue;
    if (questPlan?.claimIndexes !== undefined && !questPlan.claimIndexes.includes(i)) continue;
    const result = claimDailyQuest(ctx.save, i, today);
    if (!result.ok) continue;
    ctx.stats.dailyQuestClaims++;
    ctx.stats.rewards.daily += result.gold;
  }
}

function claimAchievementRewards(ctx: SimContext): void {
  if (!(ctx.dayPlan?.claimAchievements ?? ctx.persona.achievements === 'claim')) return;
  syncAchievements(ctx.save, CARD_DB);
  const result = claimAllAchievements(ctx.save);
  ctx.stats.rewards.achievements += result.gold;
}

function runPractice(ctx: SimContext, difficulty: Difficulty, today: string): void {
  const seed = nextSeed(ctx, `practice-${difficulty}`);
  const player = buildAI(ctx.persona.pilotSkill, CARD_DB, seed ^ 0x13579);
  const opp = buildAI(difficulty, CARD_DB, seed ^ 0x5eed);
  const match = playHeadlessMatch(seed, player, opp, [activeDeck(ctx.save), practiceOpponentDeck(ctx.save)]);
  addMinutes(ctx, PRACTICE_MATCH_MINUTES);
  applyDailyQuestProgressToSave(ctx, match.events, today);
  const won = recordOutcome(ctx, match.winner);
  const reward = applyMatchResult(ctx.save, difficulty, won, today, match.turns);
  const fw = firstWinGold(reward.firstWinBonus);
  ctx.stats.rewards.practice += reward.gold - fw;
  ctx.stats.rewards.firstWin += fw;
  applyWinStreak(ctx, won, today);
  claimDailyRewards(ctx, today);
}

function runGauntlet(ctx: SimContext, today: string, now: number): boolean {
  if (!ctx.save.gauntlet.run) {
    ctx.save.gauntlet.run = {
      rung: 1,
      startedAt: now,
      seed: nextSeed(ctx, 'gauntlet-run'),
    };
  }
  const run = ctx.save.gauntlet.run;
  const rung = run.rung;
  const avatar = avatarForRung(rung);
  const seed = rungSeed(run.seed, rung);
  const player = buildAI(ctx.persona.pilotSkill, CARD_DB, seed ^ 0x13579);
  const opp = buildAI(avatar.difficulty, CARD_DB, seed ^ 0x5eed, avatar.personality);
  const match = playHeadlessMatch(seed, player, opp, [activeDeck(ctx.save), avatar.deck]);
  addMinutes(ctx, GAUNTLET_MATCH_MINUTES);
  applyDailyQuestProgressToSave(ctx, match.events, today);
  const won = recordOutcome(ctx, match.winner);
  const clearStyle = deckColorStyle(activeDeck(ctx.save), CARD_DB);
  const beforeCompletions = ctx.save.gauntlet.completions;
  const reward = applyGauntletResult(
    ctx.save,
    rung,
    avatar.difficulty,
    won,
    today,
    clearStyle === 'mono' ? 'monoColor' : clearStyle === 'dual' ? 'dualColor' : undefined,
  );
  const fw = firstWinGold(reward.firstWinBonus);
  ctx.stats.rewards.gauntlet += reward.gold - fw;
  ctx.stats.rewards.firstWin += fw;
  if (ctx.save.gauntlet.completions > beforeCompletions) ctx.stats.gauntletCompletions++;
  applyWinStreak(ctx, won, today);
  claimDailyRewards(ctx, today);
  return won;
}

function applyDailyQuestProgressToSave(ctx: SimContext, events: readonly GameEvent[], today: string): void {
  const result = applyDailyQuestProgress(ctx.save, CARD_DB, events, today);
  ctx.stats.dailyQuestCompletions += result.completedQuestIds.length;
}

function runLimitedMatch(ctx: SimContext, today: string, now: number, day: number): void {
  if (!ctx.save.limited.activeRun) {
    ctx.save.limited.activeRun = startPreparedLimitedRun(ctx, now, day, today);
    ctx.stats.limitedRuns++;
    if (ctx.save.limited.activeRun.premium) ctx.stats.premiumDraftRuns++;
    addMinutes(ctx, DRAFT_SETUP_MINUTES);
  }
  const run = ctx.save.limited.activeRun;
  if (!run || run.status !== 'matches') throw new Error('Limited run did not reach matches');
  const premium = run.premium === true;
  const duel = limitedDuelData(run);
  const seed = duel.seedOverride;
  const player = buildAI(ctx.persona.pilotSkill, CARD_DB, seed ^ 0x13579);
  const opponentPersonality = draftPersonaById(duel.limited.opponentPersonaId ?? '')?.personality;
  const opp = buildAI(duel.difficulty, CARD_DB, seed ^ 0x5eed, opponentPersonality);
  const match = playHeadlessMatch(seed, player, opp, [duel.deckOverride, duel.oppDeckOverride]);
  addMinutes(ctx, LIMITED_MATCH_MINUTES);
  applyDailyQuestProgressToSave(ctx, match.events, today);
  const won = recordOutcome(ctx, match.winner);
  if (won) ctx.stats.limitedWins++;
  else ctx.stats.limitedLosses++;
  const reward = applyLimitedMatchResult(
    ctx.save,
    duel.difficulty,
    won,
    today,
    limitedDeckStyle(run.deck),
    now,
  );
  let runGoldAdjustment = 0;
  if (reward.runOver && ctx.experiment) {
    const productRunGold = premium ? 0 : ECONOMY.limitedRunGold[reward.wins] ?? 0;
    const experimentRunGold = configuredLimitedRunGold(ctx.experiment, reward.wins, premium);
    runGoldAdjustment = experimentRunGold - productRunGold;
    if (runGoldAdjustment !== 0) {
      ctx.save.gold += runGoldAdjustment;
      const history = ctx.save.limited.history[0];
      if (history?.id === run.id) history.rewardGold = experimentRunGold;
    }
  }
  const fw = firstWinGold(reward.firstWinBonus);
  ctx.stats.rewards.limited += reward.gold - fw + runGoldAdjustment;
  ctx.stats.rewards.firstWin += fw;
  applyWinStreak(ctx, won, today);
  claimDailyRewards(ctx, today);
}

function limitedDeckStyle(deck: readonly string[]): 'mono' | 'dual' | 'other' {
  return deckColorStyle(deck, CARD_DB);
}

function startPreparedLimitedRun(ctx: SimContext, now: number, day: number, today: string): LimitedRun {
  const seed = nextSeed(ctx, 'limited-draft');
  const weeklyCap = configuredPremiumWeeklyCap(ctx.experiment);
  const premiumRequested = ctx.dayPlan?.limited?.premium ?? ctx.persona.limited?.premiumWhenAffordable;
  const premium = Boolean(
    premiumRequested && premiumEntryAllowed(ctx, day, today) && payPremiumDraftEntry(ctx.save, today, weeklyCap),
  );
  if (premium) {
    ctx.stats.spent.premiumDraftEntries += ECONOMY.premiumDraftEntry;
    ctx.lastPremiumDay = day;
    ctx.premiumEntryDays.push(today);
  }
  let run = draftRun(ctx, CARD_DB, seed, now, premium);
  run = { ...run, status: 'matches', deck: buildLimitedDeck(CARD_DB, run.pool) };
  return run;
}

function draftRun(ctx: SimContext, db: CardDb, seed: number, now: number, premium: boolean): LimitedRun {
  let run = startDraftRun(db, seed, now, { premium });
  let draft = run.draft;
  if (!draft) throw new Error('Draft run missing draft state');
  const profile = pickerProfileForSkill(ctx.persona.pilotSkill);
  while (!draft.completed) {
    const pack = currentDraftPack(draft);
    const pick = chooseHumanDraftPick(db, draft, pack, profile);
    draft = pickDraftCard(db, draft, pick);
  }
  if (premium) {
    const grants = grantPremiumDraftPool(ctx.save, db, { ...run, draft });
    ctx.stats.premiumDraftCardsKept += grants.filter((grant) => grant.dupeGold === 0).length;
    ctx.stats.rewards.dupes += grants.reduce((sum, grant) => sum + grant.dupeGold, 0);
  }
  run = completeDraftRun(db, { ...run, draft });
  return run;
}

const DRAFT_PICKER_BY_SKILL: Readonly<Record<Difficulty, Readonly<PickerProfile>>> = Object.freeze({
  easy: Object.freeze(makePicker({ chaos: 0.35 })),
  medium: Object.freeze(makePicker({ chaos: 0.12 })),
  hard: DEFAULT_PICKER,
});

function pickerProfileForSkill(skill: Difficulty): Readonly<PickerProfile> {
  return DRAFT_PICKER_BY_SKILL[skill];
}

function chooseHumanDraftPick(
  db: CardDb,
  draft: NonNullable<LimitedRun['draft']>,
  pack: readonly string[],
  profile: Readonly<PickerProfile>,
): string {
  if (pack.length === 0) throw new Error('Cannot pick from an empty draft pack');
  const picks = draft.picks[HUMAN];
  return [...pack].sort(
    (a, b) =>
      scorePick(db, b, picks, profile, pickNoise(draft.seed, HUMAN, draft.packIndex, draft.pickIndex, b)) -
        scorePick(db, a, picks, profile, pickNoise(draft.seed, HUMAN, draft.packIndex, draft.pickIndex, a)) ||
      compareCardNames(db, a, b),
  )[0];
}

function compareCardNames(db: CardDb, a: string, b: string): number {
  const da = def(db, a);
  const dbb = def(db, b);
  return da.name.localeCompare(dbb.name) || a.localeCompare(b);
}

function runDay(ctx: SimContext, dayIndex: number): void {
  const today = dayString(dayIndex);
  const now = dayTimestamp(dayIndex);
  ctx.dayMinutes = 0;
  ensureDailyState(ctx.save, today);
  ctx.stats.dailyQuestSlots += ECONOMY.dailyQuestCount;
  ctx.dayPlan = ctx.persona.dailyPolicy?.(buildPolicyView(ctx, dayIndex + 1, today));
  applyDailyPolicyRerolls(ctx, today);

  const practiceGames = ctx.dayPlan?.practice
    ? Math.max(0, Math.trunc(ctx.dayPlan.practice.count))
    : dailyCount(ctx.persona.practice?.games, ctx, dayIndex, 'practice');
  const practiceDifficulty = ctx.dayPlan?.practice?.difficulty ?? ctx.persona.practice?.difficulty ?? 'medium';
  for (let i = 0; i < practiceGames; i++) {
    runPractice(ctx, practiceDifficulty, today);
  }
  const gauntletMatches = ctx.dayPlan?.gauntlet
    ? Math.max(0, Math.trunc(ctx.dayPlan.gauntlet.matches))
    : dailyCount(ctx.persona.gauntletMatches, ctx, dayIndex, 'gauntlet');
  const stopGauntletAfterLoss = ctx.dayPlan?.gauntlet?.stopAfterLoss ?? ctx.persona.stopGauntletAfterLoss;
  for (let i = 0; i < gauntletMatches; i++) {
    const won = runGauntlet(ctx, today, now);
    if (!won && stopGauntletAfterLoss) break;
  }
  const limitedMatches = ctx.dayPlan?.limited
    ? Math.max(0, Math.trunc(ctx.dayPlan.limited.matches))
    : dailyCount(ctx.persona.limited?.matches, ctx, dayIndex, 'limited');
  for (let i = 0; i < limitedMatches; i++) {
    runLimitedMatch(ctx, today, now + i, dayIndex + 1);
  }

  const questChase = ctx.dayPlan?.quests?.chase === null
    ? undefined
    : ctx.dayPlan?.quests?.chase ?? ctx.persona.questChase;
  if (questChase) {
    let extra = 0;
    while (extra < Math.max(0, Math.trunc(questChase.maxExtraGames)) && !allDailyQuestsClaimed(ctx.save, today)) {
      runPractice(ctx, questChase.difficulty, today);
      extra++;
    }
  }

  claimDailyRewards(ctx, today);
  runEconomyMaintenance(ctx, dayIndex);
}

function allDailyQuestsClaimed(save: SaveData, today: string): boolean {
  return dailyQuestStatuses(save, today).every((q) => q.claimed);
}

function runEconomyMaintenance(ctx: SimContext, dayIndex: number): void {
  claimAchievementRewards(ctx);
  buyDecks(ctx);
  // With a craft sink live and the collection near-complete, pack EV per new
  // unique collapses below craft cost; a rational player banks pack gold for
  // crafts instead. Without this gate, greedy pack-buying leaves less than one
  // pack price above reserve, so SSR/UR crafts (900-5000g) are never reachable.
  const banking = craftingBankActive(ctx);
  if (!banking) buyPacks(ctx, dayIndex);
  shardPersonaExcess(ctx);
  claimAchievementRewards(ctx);
  if (!banking) buyPacks(ctx, dayIndex + 1000);
  shardPersonaExcess(ctx);
  craftMissingUniques(ctx);
}

function craftingBankActive(ctx: SimContext): boolean {
  const crafting = ctx.experiment?.crafting;
  if (!crafting?.enabled) return false;
  const completion = collectionCompletion(Object.values(CARD_DB), ctx.save);
  if (completion.percent < 0.85) return false;
  return collectiblePool(Object.values(CARD_DB)).some((card) => (ctx.save.collection[card.id] ?? 0) <= 0);
}

function shardPersonaExcess(ctx: SimContext): void {
  if (!(ctx.dayPlan?.shardSpecialExcess ?? ctx.persona.shardSpecialExcess)) return;
  for (const cardId of Object.keys(ctx.save.collection).sort()) {
    if (shardableCount(ctx.save, cardId) === 0) continue;
    const expectedGold = shardGold(ctx.save, CARD_DB, cardId);
    const result = shardExcess(ctx.save, CARD_DB, cardId);
    if (result.gold !== expectedGold) {
      throw new Error(`Shard preview drifted for ${cardId}: expected ${expectedGold}, paid ${result.gold}`);
    }
    ctx.stats.rewards.shards += result.gold;
  }
}

function craftMissingUniques(ctx: SimContext): void {
  const crafting = ctx.experiment?.crafting;
  if (!crafting?.enabled) return;
  const completion = collectionCompletion(Object.values(CARD_DB), ctx.save);
  if (completion.percent < 0.85) return;

  const reserveGold = spendingPlan(ctx).reserveGold ?? 0;
  const missing = collectiblePool(Object.values(CARD_DB))
    .filter((card) => (ctx.save.collection[card.id] ?? 0) <= 0)
    .sort((a, b) =>
      ECONOMY.dupeGold[a.rarity] - ECONOMY.dupeGold[b.rarity] ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
    );

  for (const card of missing) {
    const cost = craftCost(CARD_DB, card.id, crafting.craftCostMult);
    if (ctx.save.gold - cost < reserveGold) break;
    const result = craftCard(ctx.save, CARD_DB, card.id, crafting.craftCostMult);
    if (!result.ok) throw new Error(`Craft failed for ${card.id}: ${result.reason}`);
    ctx.stats.craftedUniques++;
    ctx.stats.spent.crafts += cost;
  }
}

function spendingPlan(ctx: SimContext): SpendingPlan {
  const override = ctx.dayPlan?.spending;
  return {
    ...ctx.persona.spending,
    ...(override?.packPreference === undefined ? {} : { packPreference: override.packPreference }),
    ...(override?.reserveGold === undefined ? {} : { reserveGold: override.reserveGold }),
    ...(override?.buyOtherStartersFirst === undefined ? {} : { buyOtherStartersFirst: override.buyOtherStartersFirst }),
    ...(override?.buyThemeDeckFirst === undefined ? {} : { buyThemeDeckFirst: override.buyThemeDeckFirst }),
  };
}

function buyDecks(ctx: SimContext): void {
  const plan = spendingPlan(ctx);
  if (plan.buyOtherStartersFirst) {
    for (const deck of STARTER_DECKS) {
      if (deck.id === ctx.persona.starterId) continue;
      if (ctx.save.decks.some((d) => d.id === deck.id)) continue;
      if (buyThemeDeck(ctx.save, CARD_DB, deck, ECONOMY.starterDeckPrice)) {
        ctx.stats.spent.decks += ECONOMY.starterDeckPrice;
        addMinutes(ctx, DECK_BUY_MINUTES);
      }
    }
  }
  if (plan.buyThemeDeckFirst) {
    for (const deck of THEME_DECKS) {
      if (ctx.save.decks.some((d) => d.id === deck.id)) continue;
      if (buyThemeDeck(ctx.save, CARD_DB, deck, ECONOMY.preconPrice)) {
        ctx.stats.spent.decks += ECONOMY.preconPrice;
        addMinutes(ctx, DECK_BUY_MINUTES);
      }
    }
  }
}

function buyPacks(ctx: SimContext, dayIndex: number): void {
  const plan = spendingPlan(ctx);
  if (plan.packPreference === 'none') return;
  const reserve = plan.reserveGold ?? 0;
  let guard = 0;
  while (guard < 2000) {
    const pack = choosePack(ctx, dayIndex + guard);
    if (!pack) return;
    if (ctx.save.gold - reserve < pack.price) return;
    if (!spendGold(ctx.save, pack.price)) return;
    ctx.stats.spent.packs += pack.price;
    addMinutes(ctx, PACK_OPEN_MINUTES);
    const beforeGold = ctx.save.gold;
    const result = openPack(ctx.save, CARD_DB, ctx.rng, pack.set);
    const dupeGold = result.cards.reduce((sum, card) => sum + card.dupeGold, 0);
    ctx.stats.rewards.dupes += dupeGold;
    if (ctx.save.gold < beforeGold + dupeGold) {
      throw new Error('Pack opening lost gold unexpectedly');
    }
    guard++;
  }
  throw new Error('Pack buying guard tripped; check economy loop assumptions');
}

function choosePack(
  ctx: SimContext,
  dayIndex: number,
): { price: number; set?: CardDef['set'] } | null {
  switch (spendingPlan(ctx).packPreference) {
    case 'none':
      return null;
    case 'base':
      return { price: ECONOMY.packPrice };
    case 'ragnarok':
      return { price: ECONOMY.ragnarokPackPrice, set: 'ragnarok' };
    case 'arthurian-court':
      return { price: ECONOMY.arthurianCourtPackPrice, set: 'arthurian-court' };
    case 'mixed':
      return rngFloat(ctx.rng) < (dayIndex % 3 === 0 ? 0.6 : 0.35)
        ? { price: ECONOMY.ragnarokPackPrice, set: 'ragnarok' }
        : { price: ECONOMY.packPrice };
  }
}

function setupContext(
  persona: PlayerPersona,
  sample: number,
  baseSeed: number,
  experiment?: TuningExperimentConfig,
): SimContext {
  const save = freshSave(START_DAY_MS);
  const starter = starterById(persona.starterId);
  if (!claimFreeStarter(save, CARD_DB, starter)) throw new Error(`Failed to claim starter for ${persona.id}`);
  save.tutorialDone = true;
  save.gold += ECONOMY.startingGold;
  save.activeDeckId = starter.id;
  const ctx: SimContext = {
    persona,
    sample,
    baseSeed,
    experiment,
    save,
    rng: createRngState(clampSeed(hashString(`shop|${baseSeed}|${persona.id}|${sample}`))),
    serial: 0,
    dayMinutes: 0,
    lastPremiumDay: null,
    premiumEntryDays: [],
    stats: freshStats(),
  };
  ctx.stats.rewards.starting += ECONOMY.startingGold;
  runEconomyMaintenance(ctx, -1);
  return ctx;
}

function collectionSize(save: SaveData): number {
  return Object.values(save.collection).reduce((sum, count) => sum + count, 0);
}

const RARITY_TIERS = ['c', 'r', 'sr', 'ssr', 'ur'] as const;

function ownedUniquesByTier(save: SaveData): Record<Rarity, number> {
  const out: Record<Rarity, number> = { c: 0, r: 0, sr: 0, ssr: 0, ur: 0 };
  for (const [id, count] of Object.entries(save.collection)) {
    if (count <= 0) continue;
    const d = CARD_DB[id];
    if (d) out[d.rarity]++;
  }
  return out;
}

function avgTiers(rows: readonly ProgressSnapshot[]): Record<Rarity, number> {
  const out: Record<Rarity, number> = { c: 0, r: 0, sr: 0, ssr: 0, ur: 0 };
  for (const tier of RARITY_TIERS) out[tier] = avg(rows.map((r) => r.ownedUniquesByTier[tier]));
  return out;
}

function snapshot(ctx: SimContext, day: number): ProgressSnapshot {
  const completion = collectionCompletion(Object.values(CARD_DB), ctx.save);
  const goldEarned = rewardTotal(ctx.stats.rewards);
  const goldSpent = spentTotal(ctx.stats.spent);
  const uniqueCards = completion.owned;
  const craftedUniques = ctx.experiment?.crafting?.enabled ? ctx.stats.craftedUniques : undefined;
  const limitedAvgWins = ctx.stats.limitedRuns === 0 ? 0 : ctx.stats.limitedWins / ctx.stats.limitedRuns;
  const limitedAvgLosses = ctx.stats.limitedRuns === 0 ? 0 : ctx.stats.limitedLosses / ctx.stats.limitedRuns;
  return {
    personaId: ctx.persona.id,
    personaName: ctx.persona.name,
    style: ctx.persona.style,
    day,
    sample: ctx.sample,
    games: ctx.stats.games,
    wins: ctx.stats.wins,
    losses: ctx.stats.losses,
    draws: ctx.stats.draws,
    winRate: ctx.stats.games === 0 ? 0 : ctx.stats.wins / ctx.stats.games,
    goldEarned,
    goldSpent,
    goldNet: goldEarned - goldSpent,
    finalGold: ctx.save.gold,
    packsOpened: ctx.save.stats.packsOpened,
    decksOwned: ctx.save.decks.length,
    collectionSize: collectionSize(ctx.save),
    uniqueCards,
    cardsOwned: uniqueCards,
    collectionPct: completion.percent,
    specialVariants: completion.variants.specialVariants,
    ownedUniquesByTier: ownedUniquesByTier(ctx.save),
    duplicateRefundGold: ctx.stats.rewards.dupes,
    shardGold: ctx.stats.rewards.shards,
    achievementsUnlocked: ctx.save.achievements.unlocked.length,
    achievementsClaimed: ctx.save.achievements.claimed.length,
    dailyQuestCompletions: ctx.stats.dailyQuestCompletions,
    dailyQuestClaims: ctx.stats.dailyQuestClaims,
    dailyQuestCompletionRate:
      ctx.stats.dailyQuestSlots === 0 ? 0 : ctx.stats.dailyQuestCompletions / ctx.stats.dailyQuestSlots,
    dailyQuestClaimRate: ctx.stats.dailyQuestSlots === 0 ? 0 : ctx.stats.dailyQuestClaims / ctx.stats.dailyQuestSlots,
    streakLength: ctx.save.daily.streak.count,
    gauntletBestRung: ctx.save.gauntlet.bestRung,
    gauntletCompletions: ctx.save.gauntlet.completions,
    limitedRuns: ctx.stats.limitedRuns,
    premiumDraftRuns: ctx.stats.premiumDraftRuns,
    premiumDraftCardsKept: ctx.stats.premiumDraftCardsKept,
    limitedWins: ctx.stats.limitedWins,
    limitedLosses: ctx.stats.limitedLosses,
    limitedAvgWins,
    limitedAvgLosses,
    sessionMinutes: ctx.stats.sessionMinutes,
    minutesPerDay: ctx.stats.sessionMinutes / day,
    ...(craftedUniques === undefined ? {} : { craftedUniques }),
    rewards: { ...ctx.stats.rewards },
    spent: { ...ctx.stats.spent },
  };
}

export function runProgressionSimulation(options: RunOptions = {}): ProgressionReport {
  const seeds = options.seeds ?? 8;
  if (!Number.isInteger(seeds) || seeds <= 0) throw new Error(`seeds must be a positive integer: ${seeds}`);
  const days = normalizeDays(options.days ?? [7, 14, 30, 60]);
  const personas = [...(options.personas ?? PLAYER_PERSONAS)];
  const baseSeed = options.baseSeed ?? 0x5eed_2050;
  const experiment = normalizeExperiment(options.experiment);
  const maxDay = Math.max(...days);
  const snapshots: ProgressSnapshot[] = [];

  for (const persona of personas) {
    for (let sample = 0; sample < seeds; sample++) {
      const ctx = setupContext(persona, sample, baseSeed, experiment);
      for (let dayIndex = 0; dayIndex < maxDay; dayIndex++) {
        runDay(ctx, dayIndex);
        const day = dayIndex + 1;
        if (days.includes(day)) snapshots.push(snapshot(ctx, day));
      }
    }
  }

  const aggregates = aggregateSnapshots(snapshots, personas, days);
  const report = { seeds, days, personas, snapshots, aggregates, verdict: analyzeRewardTuning(aggregates, days) };
  return experiment ? { ...report, experiment } : report;
}

function normalizeExperiment(config: TuningExperimentConfig | undefined): TuningExperimentConfig | undefined {
  const out: TuningExperimentConfig = {
    weeklyCap: SHIPPED_TUNING_DEFAULTS.weeklyCap,
    premiumRunGold: SHIPPED_TUNING_DEFAULTS.premiumRunGold,
    crafting: SHIPPED_TUNING_DEFAULTS.crafting,
  };
  if (!config) return out;
  if (config.cooldownDays !== undefined) {
    if (!Number.isInteger(config.cooldownDays) || config.cooldownDays <= 0) {
      throw new Error(`cooldownDays must be a positive integer: ${config.cooldownDays}`);
    }
    out.cooldownDays = config.cooldownDays;
  }
  if (config.weeklyCap !== undefined) {
    if (!Number.isInteger(config.weeklyCap) || config.weeklyCap <= 0) {
      throw new Error(`weeklyCap must be a positive integer: ${config.weeklyCap}`);
    }
    out.weeklyCap = config.weeklyCap;
  }
  if (config.limitedRunGoldOverride !== undefined) {
    if (
      config.limitedRunGoldOverride.length !== 4 ||
      config.limitedRunGoldOverride.some((value) => !Number.isInteger(value) || value < 0)
    ) {
      throw new Error('limitedRunGoldOverride must contain four non-negative integers');
    }
    out.limitedRunGoldOverride = [...config.limitedRunGoldOverride] as [number, number, number, number];
  }
  if (config.premiumRunGold !== undefined) {
    if (config.premiumRunGold !== 'full' && config.premiumRunGold !== 'none') {
      throw new Error(`premiumRunGold must be full or none: ${config.premiumRunGold}`);
    }
    out.premiumRunGold = config.premiumRunGold;
  }
  if (config.crafting !== undefined) {
    if (
      config.crafting.enabled !== true ||
      !Number.isFinite(config.crafting.craftCostMult) ||
      config.crafting.craftCostMult <= 0
    ) {
      throw new Error('crafting requires enabled=true and a positive craftCostMult');
    }
    out.crafting = { enabled: true, craftCostMult: config.crafting.craftCostMult };
  }
  return out;
}

function normalizeDays(days: readonly number[]): number[] {
  const out = [...new Set(days.map((d) => Math.trunc(d)).filter((d) => d > 0))].sort((a, b) => a - b);
  if (out.length === 0) throw new Error('At least one positive checkpoint day is required');
  return out;
}

function avg(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

function aggregateSnapshots(
  snapshots: readonly ProgressSnapshot[],
  personas: readonly PlayerPersona[],
  days: readonly number[],
): ProgressAggregate[] {
  const out: ProgressAggregate[] = [];
  for (const persona of personas) {
    for (const day of days) {
      const rows = snapshots.filter((s) => s.personaId === persona.id && s.day === day);
      if (rows.length === 0) continue;
      const craftedUniques = rows.some((row) => row.craftedUniques !== undefined)
        ? avg(rows.map((row) => row.craftedUniques ?? 0))
        : undefined;
      out.push({
        personaId: persona.id,
        personaName: persona.name,
        style: persona.style,
        day,
        samples: rows.length,
        games: avg(rows.map((r) => r.games)),
        winRate: avg(rows.map((r) => r.winRate)),
        goldEarned: avg(rows.map((r) => r.goldEarned)),
        goldSpent: avg(rows.map((r) => r.goldSpent)),
        goldNet: avg(rows.map((r) => r.goldNet)),
        finalGold: avg(rows.map((r) => r.finalGold)),
        packsOpened: avg(rows.map((r) => r.packsOpened)),
        packsPerDay: avg(rows.map((r) => r.packsOpened / r.day)),
        collectionSize: avg(rows.map((r) => r.collectionSize)),
        uniqueCards: avg(rows.map((r) => r.uniqueCards)),
        cardsOwned: avg(rows.map((r) => r.cardsOwned)),
        collectionPct: avg(rows.map((r) => r.collectionPct)),
        specialVariants: avg(rows.map((r) => r.specialVariants)),
        ownedUniquesByTier: avgTiers(rows),
        duplicateRefundGold: avg(rows.map((r) => r.duplicateRefundGold)),
        shardGold: avg(rows.map((r) => r.shardGold)),
        achievementsUnlocked: avg(rows.map((r) => r.achievementsUnlocked)),
        achievementsClaimed: avg(rows.map((r) => r.achievementsClaimed)),
        dailyQuestCompletions: avg(rows.map((r) => r.dailyQuestCompletions)),
        dailyQuestClaims: avg(rows.map((r) => r.dailyQuestClaims)),
        dailyQuestCompletionRate: avg(rows.map((r) => r.dailyQuestCompletionRate)),
        dailyQuestClaimRate: avg(rows.map((r) => r.dailyQuestClaimRate)),
        streakLength: avg(rows.map((r) => r.streakLength)),
        gauntletBestRung: avg(rows.map((r) => r.gauntletBestRung)),
        gauntletCompletions: avg(rows.map((r) => r.gauntletCompletions)),
        limitedRuns: avg(rows.map((r) => r.limitedRuns)),
        premiumDraftRuns: avg(rows.map((r) => r.premiumDraftRuns)),
        premiumDraftCardsKept: avg(rows.map((r) => r.premiumDraftCardsKept)),
        limitedWins: avg(rows.map((r) => r.limitedWins)),
        limitedLosses: avg(rows.map((r) => r.limitedLosses)),
        limitedAvgWins: avg(rows.map((r) => r.limitedAvgWins)),
        limitedAvgLosses: avg(rows.map((r) => r.limitedAvgLosses)),
        sessionMinutes: avg(rows.map((r) => r.sessionMinutes)),
        minutesPerDay: avg(rows.map((r) => r.minutesPerDay)),
        ...(craftedUniques === undefined ? {} : { craftedUniques }),
        rewards: rows.map((r) => r.rewards).reduce(addRewards, emptyRewards()),
        spent: rows.map((r) => r.spent).reduce(addSpent, emptySpent()),
      });
      const latest = out[out.length - 1];
      latest.rewards = divideRewards(latest.rewards, rows.length);
      latest.spent = divideSpent(latest.spent, rows.length);
    }
  }
  return out;
}

function divideRewards(x: RewardLedger, n: number): RewardLedger {
  return {
    starting: x.starting / n,
    practice: x.practice / n,
    gauntlet: x.gauntlet / n,
    limited: x.limited / n,
    firstWin: x.firstWin / n,
    streak: x.streak / n,
    daily: x.daily / n,
    achievements: x.achievements / n,
    dupes: x.dupes / n,
    shards: x.shards / n,
  };
}

function divideSpent(x: SpendLedger, n: number): SpendLedger {
  return {
    packs: x.packs / n,
    decks: x.decks / n,
    premiumDraftEntries: x.premiumDraftEntries / n,
    crafts: x.crafts / n,
  };
}

function checkBand(
  name: string,
  measured: number,
  min: number | undefined,
  max: number | undefined,
  sample: string,
): ProgressionBandResult {
  const passed = (min === undefined || measured >= min) && (max === undefined || measured <= max);
  return { name, measured, min, max, sample, passed };
}

export function evaluateProgressionBands(report: ProgressionReport): ProgressionBandReport {
  const coarseDay = report.days.includes(7) ? 7 : Math.max(...report.days);
  const missingPersonaIds = CI_FAST_PERSONA_IDS.filter(
    (id) => !report.personas.some((persona) => persona.id === id),
  );
  const coarseSkipReasons: string[] = [];
  if (!report.days.includes(7)) coarseSkipReasons.push('day 7 is not present');
  if (missingPersonaIds.length > 0) {
    coarseSkipReasons.push(`missing calibrated persona(s): ${missingPersonaIds.join(', ')}`);
  }
  if (coarseSkipReasons.length > 0) {
    return {
      day: coarseDay,
      coarse: [],
      coarseSkipReason: coarseSkipReasons.join('; '),
      fineFlags: evaluateFineProgressionFlags(report),
      violations: [],
    };
  }

  const calibratedPersonaIds = new Set<string>(CI_FAST_PERSONA_IDS);
  const coarseRows = report.aggregates.filter(
    (row) => row.day === 7 && calibratedPersonaIds.has(row.personaId),
  );
  const sample = `${coarseRows.length} persona aggregates, ${report.seeds} seed${report.seeds === 1 ? '' : 's'}, day ${coarseDay}`;
  const packsPerDay = median(coarseRows.map((row) => row.packsPerDay));
  const minQuestClaimRate = coarseRows.length === 0 ? 0 : Math.min(...coarseRows.map((row) => row.dailyQuestClaimRate));
  const goldPerGame = coarseRows
    .filter((row) => row.games > 0)
    .map((row) => row.goldEarned / row.games)
    .filter((value) => Number.isFinite(value));
  const medianGoldPerGame = median(goldPerGame);
  const maxGoldPerGameMultiple = medianGoldPerGame <= 0
    ? 0
    : Math.max(...goldPerGame) / medianGoldPerGame;
  const collectionPct = median(coarseRows.map((row) => row.collectionPct));
  const coarse = [
    checkBand(
      'cohort packs/day',
      packsPerDay,
      COARSE_PROGRESSION_BANDS.packsPerDay.min,
      COARSE_PROGRESSION_BANDS.packsPerDay.max,
      sample,
    ),
    checkBand(
      'minimum quest claim rate',
      minQuestClaimRate,
      COARSE_PROGRESSION_BANDS.minQuestClaimRate,
      undefined,
      sample,
    ),
    checkBand(
      'maximum persona gold/game divided by cohort median',
      maxGoldPerGameMultiple,
      undefined,
      COARSE_PROGRESSION_BANDS.maxGoldPerGameMultiple,
      sample,
    ),
    checkBand(
      `median day-${coarseDay} collection`,
      collectionPct,
      COARSE_PROGRESSION_BANDS.collectionPct.min,
      COARSE_PROGRESSION_BANDS.collectionPct.max,
      sample,
    ),
  ];
  const violations = coarse
    .filter((band) => !band.passed)
    .map((band) => `${band.name}: measured ${band.measured.toFixed(4)} outside ${band.min ?? '-Infinity'}..${band.max ?? 'Infinity'} (${band.sample})`);

  const fineFlags = evaluateFineProgressionFlags(report);
  return { day: coarseDay, coarse, fineFlags, violations };
}

function evaluateFineProgressionFlags(report: ProgressionReport): string[] {
  const finalDay = Math.max(...report.days);
  const fineFlags: string[] = [];
  if (finalDay !== 60) {
    fineFlags.push(`fine bands skipped: requested final day ${finalDay}, canonical fine baseline is day 60`);
  } else {
    const final = report.aggregates.filter((row) => row.day === finalDay);
    for (const [personaId, bands] of Object.entries(CANONICAL_FINE_BANDS)) {
      const row = final.find((candidate) => candidate.personaId === personaId);
      if (!row) continue;
      const checks: [string, number, readonly [number, number]][] = [
        ['collectionPct', row.collectionPct, bands.collectionPct],
        ['packsPerDay', row.packsPerDay, bands.packsPerDay],
        ['premiumDraftRuns', row.premiumDraftRuns, bands.premiumDraftRuns],
        ['dailyQuestClaimRate', row.dailyQuestClaimRate, bands.dailyQuestClaimRate],
      ];
      for (const [metric, measured, [min, max]] of checks) {
        if (measured < min || measured > max) {
          fineFlags.push(
            `${personaId} ${metric}: measured ${measured.toFixed(4)} outside ${min}..${max} (${CANONICAL_FINE_BASELINE_SAMPLE}, baseline ${CANONICAL_FINE_BASELINE_DATE})`,
          );
        }
      }
    }
  }
  return fineFlags;
}

export function analyzeRewardTuning(aggregates: readonly ProgressAggregate[], days: readonly number[]): RewardVerdict {
  const finalDay = Math.max(...days);
  const final = aggregates.filter((r) => r.day === finalDay);
  const bullets: string[] = [];
  if (final.length === 0) return { label: 'reasonable', bullets: ['No final checkpoint rows were produced.'] };

  const medianPacksPerDay = median(final.map((r) => r.packsPerDay));
  const medianCollection = median(final.map((r) => r.collectionPct));
  const byGoldPerGame = final
    .filter((r) => r.games > 0)
    .map((r) => ({ row: r, value: r.goldEarned / r.games }))
    .sort((a, b) => a.value - b.value);
  const low = byGoldPerGame[0];
  const high = byGoldPerGame[byGoldPerGame.length - 1];
  const spread = low && high && low.value > 0 ? high.value / low.value : 1;

  if (medianPacksPerDay < 0.75 || medianCollection < 0.18) {
    bullets.push(
      `Median ${finalDay}-day progress is low: ${medianPacksPerDay.toFixed(2)} packs/day and ${pct(medianCollection)} collection.`,
    );
  } else if (medianPacksPerDay > 2.5 || medianCollection > 0.65) {
    bullets.push(
      `Median ${finalDay}-day progress is high: ${medianPacksPerDay.toFixed(2)} packs/day and ${pct(medianCollection)} collection.`,
    );
  } else {
    bullets.push(
      `Median ${finalDay}-day progress sits in the target band: ${medianPacksPerDay.toFixed(2)} packs/day and ${pct(medianCollection)} collection.`,
    );
  }

  if (low && high && spread > 1.75) {
    bullets.push(
      `Play-style spread is large: ${high.row.personaName} earns ${high.value.toFixed(0)}g/game vs ${low.row.personaName} at ${low.value.toFixed(0)}g/game (${spread.toFixed(1)}x).`,
    );
  }

  const limitedRows = final.filter((r) => r.limitedRuns > 0);
  if (limitedRows.length > 0) {
    const limitedPacks = avg(limitedRows.map((r) => r.packsPerDay));
    const nonLimited = final.filter((r) => r.limitedRuns === 0);
    const baselinePacks = avg(nonLimited.map((r) => r.packsPerDay));
    if (baselinePacks > 0 && limitedPacks > baselinePacks * 1.35) {
      bullets.push(
        `Draft-focused play is ahead on collection spend: ${limitedPacks.toFixed(2)} packs/day vs ${baselinePacks.toFixed(2)} for non-Draft personas.`,
      );
    }
  }

  const questRates = final.map((r) => r.dailyQuestClaimRate);
  if (Math.max(...questRates) - Math.min(...questRates) > 0.35) {
    bullets.push(
      `Daily quest completion is uneven by deck/style: ${pct(Math.min(...questRates))} to ${pct(Math.max(...questRates))} claimed.`,
    );
  }

  const stingy = bullets.some((b) => b.includes('low:'));
  const generous = bullets.some((b) => b.includes('high:') || b.includes('Draft-focused play is ahead'));
  const uneven = bullets.length > 1 && bullets.some((b) => b.includes('spread') || b.includes('uneven'));
  const label: RewardVerdict['label'] = uneven ? 'uneven' : generous ? 'generous' : stingy ? 'stingy' : 'reasonable';
  return { label, bullets };
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function fixed(value: number, digits = 0): string {
  return value.toFixed(digits);
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function recordText(row: ProgressAggregate): string {
  return row.limitedRuns <= 0 ? '-' : `${fixed(row.limitedAvgWins, 1)}-${fixed(row.limitedAvgLosses, 1)}`;
}

function dailyText(row: ProgressAggregate): string {
  return `${fixed(row.dailyQuestCompletions, 1)}/${fixed(row.dailyQuestClaims, 1)}`;
}

function achievementText(row: ProgressAggregate): string {
  return `${fixed(row.achievementsUnlocked, 1)}/${fixed(row.achievementsClaimed, 1)}`;
}

function gauntletText(row: ProgressAggregate): string {
  return `${fixed(row.gauntletBestRung, 1)}/${fixed(row.gauntletCompletions, 1)}`;
}

function loadText(row: ProgressAggregate): string {
  return `${fixed(row.sessionMinutes / 60, 1)}h/${fixed(row.minutesPerDay)}m`;
}

export function renderProgressionReport(report: ProgressionReport): string {
  const lines: string[] = [];
  lines.push(
    `=== PROGRESSION SIM - ${report.personas.length} personas * ${report.seeds} deterministic seeds * ${report.days.join('/')}-day checkpoints ===`,
  );
  lines.push('Assumption: opened cards grow collection only; constructed decks are not auto-rebuilt from pulls.');
  lines.push('Time model: practice 10m, Gauntlet 12m, Draft 14m plus setup, packs/decks/rerolls included.');
  for (const day of report.days) {
    const rows = report.aggregates.filter((r) => r.day === day);
    lines.push('');
    lines.push(`--- Day ${day} economy averages ---`);
    lines.push(
      `${pad('Persona', 20)} ${pad('Earn', 7)} ${pad('Spend', 7)} ${pad('Net', 7)} ${pad('Packs', 7)} ${pad('DupeGold', 9)} ${pad('ShardGold', 10)} ${pad('PremFee', 8)}`,
    );
    for (const r of rows) {
      lines.push(
        `${pad(r.personaName, 20)} ${pad(fixed(r.goldEarned), 7)} ${pad(fixed(r.goldSpent), 7)} ${pad(fixed(r.goldNet), 7)} ${pad(fixed(r.packsOpened, 1), 7)} ${pad(fixed(r.duplicateRefundGold), 9)} ${pad(fixed(r.shardGold), 10)} ${pad(fixed(r.spent.premiumDraftEntries), 8)}`,
      );
    }
    lines.push('');
    lines.push(`--- Day ${day} collection and claims ---`);
    lines.push(
      `${pad('Persona', 20)} ${pad('Copies', 7)} ${pad('Unique', 7)} ${pad('Coll', 6)} ${pad('Variants', 9)} ${pad('PremKeep', 9)} ${pad('Daily C/K', 10)} ${pad('Streak', 7)} ${pad('Ach U/C', 8)}`,
    );
    for (const r of rows) {
      lines.push(
        `${pad(r.personaName, 20)} ${pad(fixed(r.collectionSize, 1), 7)} ${pad(fixed(r.uniqueCards, 1), 7)} ${pad(pct(r.collectionPct), 6)} ${pad(fixed(r.specialVariants, 1), 9)} ${pad(fixed(r.premiumDraftCardsKept, 1), 9)} ${pad(dailyText(r), 10)} ${pad(fixed(r.streakLength, 1), 7)} ${pad(achievementText(r), 8)}`,
      );
    }
    lines.push('');
    lines.push(`--- Day ${day} mode and load ---`);
    lines.push(
      `${pad('Persona', 20)} ${pad('Matches', 8)} ${pad('Win', 6)} ${pad('Load', 12)} ${pad('Drafts', 7)} ${pad('Premium', 8)} ${pad('AvgRec', 7)} ${pad('Gauntlet', 9)}`,
    );
    for (const r of rows) {
      lines.push(
        `${pad(r.personaName, 20)} ${pad(fixed(r.games, 1), 8)} ${pad(pct(r.winRate), 6)} ${pad(loadText(r), 12)} ${pad(fixed(r.limitedRuns, 1), 7)} ${pad(fixed(r.premiumDraftRuns, 1), 8)} ${pad(recordText(r), 7)} ${pad(gauntletText(r), 9)}`,
      );
    }
  }
  lines.push('');
  lines.push(`VERDICT: ${report.verdict.label.toUpperCase()}`);
  for (const bullet of report.verdict.bullets) lines.push(`- ${bullet}`);
  return lines.join('\n');
}

function parseExperimentArgs(argv: readonly string[]): TuningExperimentConfig | undefined {
  const option = (name: string): string | undefined => {
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (inline !== undefined) return inline.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : undefined;
  };
  const hasFlag = (name: string): boolean => argv.includes(`--${name}`);
  const experiment: TuningExperimentConfig = {};
  const cooldownDays = option('cooldown-days');
  const weeklyCap = option('weekly-cap');
  const runGold = option('limited-run-gold');
  const premiumRunGold = option('premium-run-gold');
  const craftCostMult = option('craft-cost-mult');

  if (cooldownDays !== undefined) experiment.cooldownDays = Number(cooldownDays);
  if (weeklyCap !== undefined) experiment.weeklyCap = Number(weeklyCap);
  if (runGold !== undefined) {
    const values = runGold.split(',').map(Number);
    experiment.limitedRunGoldOverride = values as [number, number, number, number];
  }
  if (premiumRunGold !== undefined) experiment.premiumRunGold = premiumRunGold as 'full' | 'none';
  if (hasFlag('crafting') || craftCostMult !== undefined) {
    if (craftCostMult === undefined) throw new Error('--crafting requires --craft-cost-mult K');
    experiment.crafting = { enabled: true, craftCostMult: Number(craftCostMult) };
  }
  return normalizeExperiment(experiment);
}

function parseArgs(argv: readonly string[]): RunOptions & { json?: boolean; check?: boolean } {
  const opt = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const flag = (name: string): boolean => argv.includes(`--${name}`);
  const personaFlagIndex = argv.indexOf('--personas');
  const inlinePersonaArg = argv.find((arg) => arg.startsWith('--personas='));
  const personaValue = inlinePersonaArg === undefined
    ? opt('personas')
    : inlinePersonaArg.slice('--personas='.length);
  const personaOptionProvided = personaFlagIndex >= 0 || inlinePersonaArg !== undefined;
  if (personaOptionProvided && (personaValue === undefined || personaValue.startsWith('--'))) {
    throw new Error('--personas must include at least one known persona');
  }
  const personaIds = personaValue?.split(',').map((s) => s.trim()).filter(Boolean);
  if (personaIds !== undefined && personaIds.length === 0) {
    throw new Error('--personas must include at least one known persona');
  }
  const personas = personaIds
    ? PLAYER_PERSONAS.filter((p) => personaIds.includes(p.id) || personaIds.includes(p.name.toLowerCase()))
    : undefined;
  if (personaIds && personas?.length !== personaIds.length) {
    const found = new Set(personas?.flatMap((p) => [p.id, p.name.toLowerCase()]) ?? []);
    const missing = personaIds.filter((id) => !found.has(id));
    throw new Error(`Unknown persona(s): ${missing.join(', ')}`);
  }
  const experiment = parseExperimentArgs(argv);
  return {
    seeds: opt('seeds') === undefined ? undefined : Number(opt('seeds')),
    days: opt('days')?.split(',').map(Number),
    personas,
    baseSeed: opt('base-seed') === undefined ? undefined : Number(opt('base-seed')),
    ...(experiment ? { experiment } : {}),
    json: flag('json'),
    check: flag('check'),
  };
}

function main(): void {
  try {
    const { json, check, ...options } = parseArgs(process.argv.slice(2));
    const t0 = Date.now();
    const report = runProgressionSimulation(options);
    if (check) {
      const bands = evaluateProgressionBands(report);
      if (json) console.log(JSON.stringify({ report, bands }, null, 2));
      else {
        console.log(renderProgressionReport(report));
        if (bands.coarseSkipReason) {
          console.log(`\ncoarse bands skipped: ${bands.coarseSkipReason}`);
        } else {
          console.log('\n--- Coarse CI bands ---');
          for (const band of bands.coarse) {
            console.log(
              `${band.passed ? 'PASS' : 'FAIL'} ${band.name}: ${band.measured.toFixed(4)} ` +
                `[${band.min ?? '-Infinity'}, ${band.max ?? 'Infinity'}] sample=${band.sample}`,
            );
          }
        }
        if (bands.fineFlags.length === 0) console.log('FINE FLAGS: none');
        else {
          console.log('FINE FLAGS:');
          for (const flag of bands.fineFlags) console.log(`  ! ${flag}`);
        }
      }
      if (bands.violations.length > 0) {
        for (const violation of bands.violations) console.error(`COARSE BAND VIOLATION: ${violation}`);
        process.exitCode = 1;
      }
    } else if (json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(renderProgressionReport(report));
      console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : '';
if (invokedPath === resolve(fileURLToPath(import.meta.url)).toLowerCase()) main();
