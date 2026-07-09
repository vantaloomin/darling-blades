/**
 * Headless progression/economy harness.
 *
 * Usage:
 *   npx tsx scripts/progression-sim.ts --seeds 8
 *   npx tsx scripts/progression-sim.ts --seeds 12 --days 7,14,30,60 --personas new-casual,hardcore-optimizer
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
import { avatarForRung } from '../src/data/opponents';
import { STARTER_DECKS, THEME_DECKS, type DeckList } from '../src/data/starterDecks';
import type { GameEvent } from '../src/engine/events';
import { Game } from '../src/engine/Game';
import { createRngState, rngFloat, type RngState } from '../src/engine/rng';
import { def, isType, manaValue, type CardDb, type CardDef, type Color } from '../src/engine/types';
import { claimAllAchievements, syncAchievements } from '../src/meta/Achievements';
import { collectionCompletion } from '../src/meta/collectionFilter';
import { deckColorStyle } from '../src/meta/deckColorIdentity';
import {
  applyGauntletResult,
  applyLimitedMatchResult,
  applyMatchResult,
  buyThemeDeck,
  claimFreeStarter,
  spendGold,
  type Difficulty,
} from '../src/meta/Economy';
import { rungSeed } from '../src/meta/gauntletSeed';
import {
  buildLimitedDeck,
  completeDraftRun,
  currentDraftPack,
  limitedDuelData,
  pickDraftCard,
  startDraftRun,
  startSealedRun,
  type LimitedMode,
  type LimitedRun,
} from '../src/meta/Limited';
import { openPack } from '../src/meta/PackOpener';
import {
  applyDailyQuestProgress,
  claimDailyQuest,
  dailyQuestStatuses,
  ensureDailyState,
  recordDailyWin,
  rerollDailyQuest,
} from '../src/meta/Quests';
import { freshSave, type SaveData } from '../src/meta/SaveManager';
import { TIER_RANK } from '../src/meta/variants';

const START_DAY_MS = Date.UTC(2026, 6, 9);
const MAX_STEPS = 40_000;
const HUMAN = 0;
const PRACTICE_MATCH_MINUTES = 10;
const GAUNTLET_MATCH_MINUTES = 12;
const LIMITED_MATCH_MINUTES = 14;
const SEALED_SETUP_MINUTES = 8;
const DRAFT_SETUP_MINUTES = 14;
const PACK_OPEN_MINUTES = 1.25;
const DECK_BUY_MINUTES = 1.5;
const QUEST_REROLL_MINUTES = 0.5;

type PackPreference = 'base' | 'ragnarok' | 'mixed' | 'none';
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

export interface PlayerPersona {
  id: string;
  name: string;
  style: string;
  starterId: string;
  pilotSkill: Difficulty;
  practice?: PracticePlan;
  gauntletMatches?: DailyCount;
  stopGauntletAfterLoss?: boolean;
  limited?: { mode: LimitedMode | 'mixed'; matches: DailyCount };
  questChase?: QuestChasePlan;
  rerollOffColorQuests?: boolean;
  spending: SpendingPlan;
  achievements: AchievementPolicy;
}

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
}

export interface SpendLedger {
  packs: number;
  decks: number;
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
  duplicateRefundGold: number;
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
  limitedWins: number;
  limitedLosses: number;
  limitedAvgWins: number;
  limitedAvgLosses: number;
  sessionMinutes: number;
  minutesPerDay: number;
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
  duplicateRefundGold: number;
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
  limitedWins: number;
  limitedLosses: number;
  limitedAvgWins: number;
  limitedAvgLosses: number;
  sessionMinutes: number;
  minutesPerDay: number;
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
  limitedWins: number;
  limitedLosses: number;
  rewards: RewardLedger;
  spent: SpendLedger;
}

interface SimContext {
  persona: PlayerPersona;
  sample: number;
  baseSeed: number;
  save: SaveData;
  rng: RngState;
  serial: number;
  stats: SimStats;
}

interface MatchResult {
  winner: 0 | 1 | 'draw';
  events: GameEvent[];
  turns: number;
}

interface RunOptions {
  seeds?: number;
  days?: number[];
  personas?: readonly PlayerPersona[];
  baseSeed?: number;
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
    style: 'spends most sessions in Sealed/Draft',
    starterId: 'starter-mandate',
    pilotSkill: 'medium',
    practice: { difficulty: 'medium', games: 1 },
    limited: { mode: 'mixed', matches: 3 },
    spending: { packPreference: 'mixed', reserveGold: 250 },
    achievements: 'claim',
  },
  {
    id: 'collector',
    name: 'Collector',
    style: 'opens packs aggressively, chases unique cards and variants',
    starterId: 'starter-harvest',
    pilotSkill: 'medium',
    practice: { difficulty: 'easy', games: 3 },
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
    limited: { mode: 'mixed', matches: 1 },
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
});

const emptySpent = (): SpendLedger => ({ packs: 0, decks: 0 });

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
  };
}

function addSpent(a: SpendLedger, b: SpendLedger): SpendLedger {
  return { packs: a.packs + b.packs, decks: a.decks + b.decks };
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
    rewards.dupes
  );
}

function spentTotal(spent: SpendLedger): number {
  return spent.packs + spent.decks;
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

function dayString(dayIndex: number): string {
  return new Date(START_DAY_MS + dayIndex * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dayTimestamp(dayIndex: number): number {
  return START_DAY_MS + dayIndex * 24 * 60 * 60 * 1000;
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
    if (result.ok) ctx.stats.sessionMinutes += QUEST_REROLL_MINUTES;
  }
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

function chooseLimitedMode(ctx: SimContext, dayIndex: number): LimitedMode {
  const mode = ctx.persona.limited?.mode ?? 'sealed';
  if (mode !== 'mixed') return mode;
  const roll = hashString(`${ctx.baseSeed}|${ctx.persona.id}|${ctx.sample}|${dayIndex}|limited-mode`);
  return roll % 2 === 0 ? 'sealed' : 'draft';
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
  const statuses = dailyQuestStatuses(ctx.save, today);
  for (let i = 0; i < statuses.length; i++) {
    const s = statuses[i];
    if (!s.complete || s.claimed) continue;
    const result = claimDailyQuest(ctx.save, i, today);
    if (!result.ok) continue;
    ctx.stats.dailyQuestClaims++;
    ctx.stats.rewards.daily += result.gold;
  }
}

function claimAchievementRewards(ctx: SimContext): void {
  if (ctx.persona.achievements !== 'claim') return;
  syncAchievements(ctx.save, CARD_DB);
  const result = claimAllAchievements(ctx.save);
  ctx.stats.rewards.achievements += result.gold;
}

function runPractice(ctx: SimContext, difficulty: Difficulty, today: string): void {
  const seed = nextSeed(ctx, `practice-${difficulty}`);
  const player = buildAI(ctx.persona.pilotSkill, CARD_DB, seed ^ 0x13579);
  const opp = buildAI(difficulty, CARD_DB, seed ^ 0x5eed);
  const match = playHeadlessMatch(seed, player, opp, [activeDeck(ctx.save), practiceOpponentDeck(ctx.save)]);
  ctx.stats.sessionMinutes += PRACTICE_MATCH_MINUTES;
  applyDailyQuestProgressToSave(ctx, match.events, today);
  const won = recordOutcome(ctx, match.winner);
  const reward = applyMatchResult(ctx.save, difficulty, won, today);
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
  ctx.stats.sessionMinutes += GAUNTLET_MATCH_MINUTES;
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

function runLimitedMatch(ctx: SimContext, mode: LimitedMode, today: string, now: number): void {
  if (!ctx.save.limited.activeRun) {
    ctx.save.limited.activeRun = startPreparedLimitedRun(ctx, mode, now);
    ctx.stats.limitedRuns++;
    ctx.stats.sessionMinutes += mode === 'draft' ? DRAFT_SETUP_MINUTES : SEALED_SETUP_MINUTES;
  }
  const run = ctx.save.limited.activeRun;
  if (!run || run.status !== 'matches') throw new Error('Limited run did not reach matches');
  const duel = limitedDuelData(run);
  const seed = duel.seedOverride;
  const player = buildAI(ctx.persona.pilotSkill, CARD_DB, seed ^ 0x13579);
  const opp = buildAI(duel.difficulty, CARD_DB, seed ^ 0x5eed);
  const match = playHeadlessMatch(seed, player, opp, [duel.deckOverride, duel.oppDeckOverride]);
  ctx.stats.sessionMinutes += LIMITED_MATCH_MINUTES;
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
  const fw = firstWinGold(reward.firstWinBonus);
  ctx.stats.rewards.limited += reward.gold - fw;
  ctx.stats.rewards.firstWin += fw;
  applyWinStreak(ctx, won, today);
  claimDailyRewards(ctx, today);
}

function limitedDeckStyle(deck: readonly string[]): 'mono' | 'dual' | 'other' {
  return deckColorStyle(deck, CARD_DB);
}

function startPreparedLimitedRun(ctx: SimContext, mode: LimitedMode, now: number): LimitedRun {
  const seed = nextSeed(ctx, `limited-${mode}`);
  let run = mode === 'sealed' ? startSealedRun(CARD_DB, seed, now) : draftRun(CARD_DB, seed, now);
  run = { ...run, status: 'matches', deck: buildLimitedDeck(CARD_DB, run.pool) };
  return run;
}

function draftRun(db: CardDb, seed: number, now: number): LimitedRun {
  let run = startDraftRun(db, seed, now);
  let draft = run.draft;
  if (!draft) throw new Error('Draft run missing draft state');
  while (!draft.completed) {
    const pack = currentDraftPack(draft);
    const pick = chooseDraftPick(db, pack);
    draft = pickDraftCard(db, draft, pick);
  }
  run = completeDraftRun(db, { ...run, draft });
  return run;
}

function chooseDraftPick(db: CardDb, pack: readonly string[]): string {
  if (pack.length === 0) throw new Error('Cannot pick from an empty draft pack');
  return [...pack].sort((a, b) => draftScore(db, b) - draftScore(db, a) || compareCardNames(db, a, b))[0];
}

function draftScore(db: CardDb, id: string): number {
  const card = def(db, id);
  let score = TIER_RANK[card.rarity] * 8 - manaValue(card.cost) * 0.2;
  if (isType(card, 'creature')) {
    score += 5 + (card.attack ?? 0) * 1.1 + (card.defense ?? 0) * 0.9 + (card.keywords?.length ?? 0) * 2;
  }
  if (isType(card, 'charm') || isType(card, 'ritual')) score += 4;
  if (card.abilities?.some((a) => a.ops?.some((op) => op.op === 'destroy' || op.op === 'damage' || op.op === 'cancel'))) {
    score += 6;
  }
  if (card.abilities?.some((a) => a.ops?.some((op) => op.op === 'draw' || op.op === 'raise' || op.op === 'reclaim'))) {
    score += 3;
  }
  return score;
}

function compareCardNames(db: CardDb, a: string, b: string): number {
  const da = def(db, a);
  const dbb = def(db, b);
  return da.name.localeCompare(dbb.name) || a.localeCompare(b);
}

function runDay(ctx: SimContext, dayIndex: number): void {
  const today = dayString(dayIndex);
  const now = dayTimestamp(dayIndex);
  ensureDailyState(ctx.save, today);
  ctx.stats.dailyQuestSlots += ECONOMY.dailyQuestCount;
  rerollOffColorQuests(ctx, today);

  const practiceGames = dailyCount(ctx.persona.practice?.games, ctx, dayIndex, 'practice');
  for (let i = 0; i < practiceGames; i++) {
    runPractice(ctx, ctx.persona.practice!.difficulty, today);
  }
  const gauntletMatches = dailyCount(ctx.persona.gauntletMatches, ctx, dayIndex, 'gauntlet');
  for (let i = 0; i < gauntletMatches; i++) {
    const won = runGauntlet(ctx, today, now);
    if (!won && ctx.persona.stopGauntletAfterLoss) break;
  }
  const limitedMatches = dailyCount(ctx.persona.limited?.matches, ctx, dayIndex, 'limited');
  for (let i = 0; i < limitedMatches; i++) {
    runLimitedMatch(ctx, chooseLimitedMode(ctx, dayIndex), today, now + i);
  }

  if (ctx.persona.questChase) {
    let extra = 0;
    while (extra < ctx.persona.questChase.maxExtraGames && !allDailyQuestsClaimed(ctx.save, today)) {
      runPractice(ctx, ctx.persona.questChase.difficulty, today);
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
  buyPacks(ctx, dayIndex);
  claimAchievementRewards(ctx);
  buyPacks(ctx, dayIndex + 1000);
}

function buyDecks(ctx: SimContext): void {
  const plan = ctx.persona.spending;
  if (plan.buyOtherStartersFirst) {
    for (const deck of STARTER_DECKS) {
      if (deck.id === ctx.persona.starterId) continue;
      if (ctx.save.decks.some((d) => d.id === deck.id)) continue;
      if (buyThemeDeck(ctx.save, CARD_DB, deck, ECONOMY.starterDeckPrice)) {
        ctx.stats.spent.decks += ECONOMY.starterDeckPrice;
        ctx.stats.sessionMinutes += DECK_BUY_MINUTES;
      }
    }
  }
  if (plan.buyThemeDeckFirst) {
    for (const deck of THEME_DECKS) {
      if (ctx.save.decks.some((d) => d.id === deck.id)) continue;
      if (buyThemeDeck(ctx.save, CARD_DB, deck, ECONOMY.preconPrice)) {
        ctx.stats.spent.decks += ECONOMY.preconPrice;
        ctx.stats.sessionMinutes += DECK_BUY_MINUTES;
      }
    }
  }
}

function buyPacks(ctx: SimContext, dayIndex: number): void {
  const plan = ctx.persona.spending;
  if (plan.packPreference === 'none') return;
  const reserve = plan.reserveGold ?? 0;
  let guard = 0;
  while (guard < 2000) {
    const pack = choosePack(ctx, dayIndex + guard);
    if (!pack) return;
    if (ctx.save.gold - reserve < pack.price) return;
    if (!spendGold(ctx.save, pack.price)) return;
    ctx.stats.spent.packs += pack.price;
    ctx.stats.sessionMinutes += PACK_OPEN_MINUTES;
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
  switch (ctx.persona.spending.packPreference) {
    case 'none':
      return null;
    case 'base':
      return { price: ECONOMY.packPrice };
    case 'ragnarok':
      return { price: ECONOMY.ragnarokPackPrice, set: 'ragnarok' };
    case 'mixed':
      return rngFloat(ctx.rng) < (dayIndex % 3 === 0 ? 0.6 : 0.35)
        ? { price: ECONOMY.ragnarokPackPrice, set: 'ragnarok' }
        : { price: ECONOMY.packPrice };
  }
}

function setupContext(persona: PlayerPersona, sample: number, baseSeed: number): SimContext {
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
    save,
    rng: createRngState(clampSeed(hashString(`shop|${baseSeed}|${persona.id}|${sample}`))),
    serial: 0,
    stats: freshStats(),
  };
  ctx.stats.rewards.starting += ECONOMY.startingGold;
  runEconomyMaintenance(ctx, -1);
  return ctx;
}

function collectionSize(save: SaveData): number {
  return Object.values(save.collection).reduce((sum, count) => sum + count, 0);
}

function snapshot(ctx: SimContext, day: number): ProgressSnapshot {
  const completion = collectionCompletion(Object.values(CARD_DB), ctx.save);
  const goldEarned = rewardTotal(ctx.stats.rewards);
  const goldSpent = spentTotal(ctx.stats.spent);
  const uniqueCards = completion.owned;
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
    duplicateRefundGold: ctx.stats.rewards.dupes,
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
    limitedWins: ctx.stats.limitedWins,
    limitedLosses: ctx.stats.limitedLosses,
    limitedAvgWins,
    limitedAvgLosses,
    sessionMinutes: ctx.stats.sessionMinutes,
    minutesPerDay: ctx.stats.sessionMinutes / day,
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
  const maxDay = Math.max(...days);
  const snapshots: ProgressSnapshot[] = [];

  for (const persona of personas) {
    for (let sample = 0; sample < seeds; sample++) {
      const ctx = setupContext(persona, sample, baseSeed);
      for (let dayIndex = 0; dayIndex < maxDay; dayIndex++) {
        runDay(ctx, dayIndex);
        const day = dayIndex + 1;
        if (days.includes(day)) snapshots.push(snapshot(ctx, day));
      }
    }
  }

  const aggregates = aggregateSnapshots(snapshots, personas, days);
  return { seeds, days, personas, snapshots, aggregates, verdict: analyzeRewardTuning(aggregates, days) };
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
        duplicateRefundGold: avg(rows.map((r) => r.duplicateRefundGold)),
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
        limitedWins: avg(rows.map((r) => r.limitedWins)),
        limitedLosses: avg(rows.map((r) => r.limitedLosses)),
        limitedAvgWins: avg(rows.map((r) => r.limitedAvgWins)),
        limitedAvgLosses: avg(rows.map((r) => r.limitedAvgLosses)),
        sessionMinutes: avg(rows.map((r) => r.sessionMinutes)),
        minutesPerDay: avg(rows.map((r) => r.minutesPerDay)),
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
  };
}

function divideSpent(x: SpendLedger, n: number): SpendLedger {
  return { packs: x.packs / n, decks: x.decks / n };
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
        `Free Limited is ahead on collection spend: ${limitedPacks.toFixed(2)} packs/day vs ${baselinePacks.toFixed(2)} for non-Limited personas.`,
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
  const generous = bullets.some((b) => b.includes('high:') || b.includes('Free Limited is ahead'));
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
  lines.push('Time model: practice 10m, Gauntlet 12m, Limited 14m plus setup, packs/decks/rerolls included.');
  for (const day of report.days) {
    const rows = report.aggregates.filter((r) => r.day === day);
    lines.push('');
    lines.push(`--- Day ${day} economy averages ---`);
    lines.push(
      `${pad('Persona', 20)} ${pad('Earn', 7)} ${pad('Spend', 7)} ${pad('Net', 7)} ${pad('Packs', 7)} ${pad('DupeGold', 9)}`,
    );
    for (const r of rows) {
      lines.push(
        `${pad(r.personaName, 20)} ${pad(fixed(r.goldEarned), 7)} ${pad(fixed(r.goldSpent), 7)} ${pad(fixed(r.goldNet), 7)} ${pad(fixed(r.packsOpened, 1), 7)} ${pad(fixed(r.duplicateRefundGold), 9)}`,
      );
    }
    lines.push('');
    lines.push(`--- Day ${day} collection and claims ---`);
    lines.push(
      `${pad('Persona', 20)} ${pad('Copies', 7)} ${pad('Unique', 7)} ${pad('Coll', 6)} ${pad('Variants', 9)} ${pad('Daily C/K', 10)} ${pad('Streak', 7)} ${pad('Ach U/C', 8)}`,
    );
    for (const r of rows) {
      lines.push(
        `${pad(r.personaName, 20)} ${pad(fixed(r.collectionSize, 1), 7)} ${pad(fixed(r.uniqueCards, 1), 7)} ${pad(pct(r.collectionPct), 6)} ${pad(fixed(r.specialVariants, 1), 9)} ${pad(dailyText(r), 10)} ${pad(fixed(r.streakLength, 1), 7)} ${pad(achievementText(r), 8)}`,
      );
    }
    lines.push('');
    lines.push(`--- Day ${day} mode and load ---`);
    lines.push(
      `${pad('Persona', 20)} ${pad('Matches', 8)} ${pad('Win', 6)} ${pad('Load', 12)} ${pad('Limited', 8)} ${pad('AvgRec', 7)} ${pad('Gauntlet', 9)}`,
    );
    for (const r of rows) {
      lines.push(
        `${pad(r.personaName, 20)} ${pad(fixed(r.games, 1), 8)} ${pad(pct(r.winRate), 6)} ${pad(loadText(r), 12)} ${pad(fixed(r.limitedRuns, 1), 8)} ${pad(recordText(r), 7)} ${pad(gauntletText(r), 9)}`,
      );
    }
  }
  lines.push('');
  lines.push(`VERDICT: ${report.verdict.label.toUpperCase()}`);
  for (const bullet of report.verdict.bullets) lines.push(`- ${bullet}`);
  return lines.join('\n');
}

function parseArgs(argv: readonly string[]): RunOptions & { json?: boolean } {
  const opt = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const flag = (name: string): boolean => argv.includes(`--${name}`);
  const personaIds = opt('personas')?.split(',').map((s) => s.trim()).filter(Boolean);
  const personas = personaIds
    ? PLAYER_PERSONAS.filter((p) => personaIds.includes(p.id) || personaIds.includes(p.name.toLowerCase()))
    : undefined;
  if (personaIds && personas?.length !== personaIds.length) {
    const found = new Set(personas?.flatMap((p) => [p.id, p.name.toLowerCase()]) ?? []);
    const missing = personaIds.filter((id) => !found.has(id));
    throw new Error(`Unknown persona(s): ${missing.join(', ')}`);
  }
  return {
    seeds: opt('seeds') === undefined ? undefined : Number(opt('seeds')),
    days: opt('days')?.split(',').map(Number),
    personas,
    baseSeed: opt('base-seed') === undefined ? undefined : Number(opt('base-seed')),
    json: flag('json'),
  };
}

function main(): void {
  try {
    const { json, ...options } = parseArgs(process.argv.slice(2));
    const t0 = Date.now();
    const report = runProgressionSimulation(options);
    if (json) console.log(JSON.stringify(report, null, 2));
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
