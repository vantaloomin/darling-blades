import { ECONOMY } from '../config/rules';
import type { DeckList } from '../data/starterDecks';
import type { CardDb } from '../engine/types';
import { def } from '../engine/types';
import { addCard } from './Collection';
import type { SaveData } from './SaveManager';
import type { LimitedDeckStyle } from './Limited';
import { PLAIN_VARIANT } from './variants';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface MatchReward {
  gold: number;
  firstWinBonus: boolean;
  /** Loss payout zeroed because the match ended before minTurnsForLossGold. */
  tooEarly: boolean;
}

/** Record a match result and pay out gold (+first-win-of-day bonus).
 * `turns` is the engine's per-player turn counter at game end; a loss (concede
 * included) before ECONOMY.minTurnsForLossGold pays nothing — the loss still
 * counts in stats. */
export function applyMatchResult(
  save: SaveData,
  difficulty: Difficulty,
  won: boolean,
  today: string, // YYYY-MM-DD
  turns: number,
): MatchReward {
  let gold: number;
  let firstWinBonus = false;
  let tooEarly = false;
  if (won) {
    gold = ECONOMY.winGold[difficulty];
    save.stats.wins++;
    save.stats.byDifficulty[difficulty].w++;
    if (save.stats.lastWinDay !== today) {
      save.stats.lastWinDay = today;
      gold += ECONOMY.firstWinOfDayBonus;
      firstWinBonus = true;
    }
  } else {
    tooEarly = turns < ECONOMY.minTurnsForLossGold;
    gold = tooEarly ? 0 : ECONOMY.lossGold;
    save.stats.losses++;
    save.stats.byDifficulty[difficulty].l++;
  }
  save.gold += gold;
  return { gold, firstWinBonus, tooEarly };
}

export interface GauntletReward {
  gold: number;
  firstWinBonus: boolean;
  runOver: boolean; // the run ended (cleared, lost, or completed)
  completed: boolean; // full gauntlet clear
  nextRung: number | null; // rung to fight next, or null if the run is over
}

export interface LimitedMatchReward {
  gold: number;
  firstWinBonus: boolean;
  runOver: boolean;
  wins: number;
  losses: number;
  nextMatch: number | null;
}

export type GauntletClearStyle = 'monoColor' | 'dualColor';

/**
 * Record a gauntlet match and advance/reset the run.
 *
 * The rung's `difficulty` is passed in (not derived from opponents.ts) so the
 * meta layer stays free of data-layer coupling. Win → pay the rung's gold and
 * climb (the final rung pays the completion bonus and ends the run); loss → pay the
 * standard loss gold and reset the run.
 */
export function applyGauntletResult(
  save: SaveData,
  rung: number, // 1-based rung just played
  difficulty: Difficulty,
  won: boolean,
  today: string, // YYYY-MM-DD
  clearStyle?: GauntletClearStyle,
): GauntletReward {
  const g = save.gauntlet;
  let gold: number;
  let firstWinBonus = false;
  let completed = false;
  let nextRung: number | null = null;

  if (won) {
    gold = ECONOMY.gauntletRungGold[rung - 1] ?? 0;
    save.stats.wins++;
    save.stats.byDifficulty[difficulty].w++;
    if (save.stats.lastWinDay !== today) {
      save.stats.lastWinDay = today;
      gold += ECONOMY.firstWinOfDayBonus;
      firstWinBonus = true;
    }
    g.bestRung = Math.max(g.bestRung, rung);
    if (rung >= ECONOMY.gauntletRungGold.length) {
      gold += ECONOMY.gauntletCompletionBonus;
      g.completions++;
      if (clearStyle) g.clearStyles[clearStyle]++;
      g.run = null;
      completed = true;
    } else {
      nextRung = rung + 1;
      // Carry the run's fixed seed forward — every rung of the run derives its
      // duel seed from it (src/meta/gauntletSeed.ts), so the run stays a single
      // reproducible sequence as it climbs.
      const startedAt = g.run?.startedAt ?? Date.now();
      const seed = g.run?.seed ?? ((startedAt & 0x7fffffff) || 1);
      const rosterDay = g.run?.rosterDay ?? 0;
      const rosterSeed = g.run?.rosterSeed ?? 0;
      g.run = { rung: nextRung, startedAt, seed, rosterDay, rosterSeed };
    }
  } else {
    gold = ECONOMY.lossGold;
    save.stats.losses++;
    save.stats.byDifficulty[difficulty].l++;
    g.run = null;
  }

  save.gold += gold;
  return { gold, firstWinBonus, runOver: nextRung === null, completed, nextRung };
}

/** Record one Limited match; pays first-win immediately and free-run gold after match 3. */
export function applyLimitedMatchResult(
  save: SaveData,
  difficulty: Difficulty,
  won: boolean,
  today: string,
  deckStyle: LimitedDeckStyle,
  now = Date.now(),
): LimitedMatchReward {
  const run = save.limited.activeRun;
  if (!run || run.status !== 'matches') throw new Error('No active Limited match to resolve');

  let gold = 0;
  let firstWinBonus = false;
  if (won) {
    run.wins++;
    save.stats.wins++;
    save.stats.byDifficulty[difficulty].w++;
    if (save.stats.lastWinDay !== today) {
      save.stats.lastWinDay = today;
      gold += ECONOMY.firstWinOfDayBonus;
      firstWinBonus = true;
    }
  } else {
    run.losses++;
    save.stats.losses++;
    save.stats.byDifficulty[difficulty].l++;
  }

  run.matchIndex++;
  const runOver = run.matchIndex >= 3;
  let nextMatch: number | null = run.matchIndex;
  if (runOver) {
    // Premium's 1,000g entry buys the 45 kept picks. It never also pays the
    // free-run record reward; first-win and streak rewards remain daily-level
    // rewards and are intentionally handled above/by Quests.
    const rewardGold = run.premium ? 0 : ECONOMY.limitedRunGold[run.wins] ?? 0;
    gold += rewardGold;
    save.limited.bestDraftWins = Math.max(save.limited.bestDraftWins, run.wins);
    save.limited.history.unshift({
      id: run.id,
      mode: run.mode,
      seed: run.seed,
      wins: run.wins,
      losses: run.losses,
      deckStyle,
      completedAt: now,
      rewardGold,
      ...(run.premium ? { premium: true } : {}),
    });
    save.limited.history = save.limited.history.slice(0, 20);
    save.limited.activeRun = null;
    nextMatch = null;
  }

  save.gold += gold;
  return { gold, firstWinBonus, runOver, wins: run.wins, losses: run.losses, nextMatch };
}

/** Spend gold if affordable. */
export function spendGold(save: SaveData, amount: number): boolean {
  if (save.gold < amount) return false;
  save.gold -= amount;
  return true;
}

const UTC_DAY_MS = 24 * 60 * 60 * 1000;

/** The seven-day Premium grid, anchored to the UTC epoch as specified. */
export function premiumWeekKey(today: string): number {
  const timestamp = Date.parse(`${today}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) throw new RangeError(`Invalid day string: ${today}`);
  return Math.floor(timestamp / UTC_DAY_MS / 7);
}

function premiumWeekDay(today: string): number {
  const timestamp = Date.parse(`${today}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) throw new RangeError(`Invalid day string: ${today}`);
  return Math.floor(timestamp / UTC_DAY_MS);
}

function premiumWeekEntries(save: SaveData, today: string): { week: number; entries: number } {
  const week = premiumWeekKey(today);
  const state = save.limited.premiumWeek;
  return { week, entries: state?.week === week ? Math.max(0, state.entries) : 0 };
}

export interface PremiumEntryStatus {
  allowed: boolean;
  remaining: number;
  resetsInDays: number;
}

/** Pure Premium Draft allowance read. Gold affordability is checked at payment time. */
export function premiumEntryStatus(save: SaveData, today: string): PremiumEntryStatus {
  const { entries } = premiumWeekEntries(save, today);
  const day = premiumWeekDay(today);
  const remaining = Math.max(0, ECONOMY.premiumWeeklyCap - entries);
  return {
    allowed: remaining > 0,
    remaining,
    resetsInDays: 7 - (day - premiumWeekKey(today) * 7),
  };
}

/**
 * Pay the fixed Premium Draft entry fee and record the weekly entry. The
 * optional cap is simulator-only so experiment runs can loosen/tighten the
 * shipped default; UI callers should pass just `(save, today)`.
 */
export function payPremiumDraftEntry(
  save: SaveData,
  today = todayString(),
  weeklyCap: number = ECONOMY.premiumWeeklyCap,
): boolean {
  if (!Number.isInteger(weeklyCap) || weeklyCap <= 0) throw new RangeError('weeklyCap must be a positive integer');
  const { week, entries } = premiumWeekEntries(save, today);
  if (entries >= weeklyCap) return false;
  if (!spendGold(save, ECONOMY.premiumDraftEntry)) return false;
  save.limited.premiumWeek = { week, entries: entries + 1 };
  return true;
}

export function todayString(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Grant PLAIN copies of a deck's non-basic cards, topping each up to the deck's
 * count (never removing owned copies). Shared by the free-starter grant
 * (MainMenuScene) and paid theme-deck purchases. Basics are free/unlimited.
 */
export function grantDeckCards(save: SaveData, db: CardDb, cards: readonly string[]): void {
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    if (def(db, id).supertypes?.includes('basic')) continue;
    const have = save.collection[id] ?? 0;
    for (let i = have; i < n; i++) addCard(save, db, id, PLAIN_VARIANT);
  }
}

export interface DeckGrantPreview {
  /** Copy total of the deck's non-basic cards (the grant denominator). */
  nonBasicCopies: number;
  /** Copies of that requirement already in the collection (capped per card at the deck's count). */
  ownedCopies: number;
  /** Plain copies grantDeckCards would actually add. */
  grantedCopies: number;
}

/**
 * Read-only mirror of grantDeckCards: what WOULD buying this deck add to the
 * collection? The shop's deck preview shows this before the purchase — keep
 * the walk in lockstep with grantDeckCards (same basic-skip, same top-up cap).
 */
export function previewDeckGrant(
  save: SaveData,
  db: CardDb,
  cards: readonly string[],
): DeckGrantPreview {
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  let nonBasicCopies = 0;
  let ownedCopies = 0;
  for (const [id, n] of counts) {
    if (def(db, id).supertypes?.includes('basic')) continue;
    nonBasicCopies += n;
    ownedCopies += Math.min(save.collection[id] ?? 0, n);
  }
  return { nonBasicCopies, ownedCopies, grantedCopies: nonBasicCopies - ownedCopies };
}

/**
 * Buy a precon/starter deck: spend `price` (defaults to preconPrice for theme
 * decks; the shop passes starterDeckPrice for the buyable starters), grant its
 * cards, add it to the player's decks. Idempotent — a deck already owned (by id)
 * is a no-op that does NOT spend gold, so the one free-chosen starter reads as
 * owned. Never touches starterChosen (the free-starter flow is independent).
 * Returns true only if the purchase actually happened.
 */
export function buyThemeDeck(
  save: SaveData,
  db: CardDb,
  deck: DeckList,
  price: number = ECONOMY.preconPrice,
): boolean {
  if (save.decks.some((d) => d.id === deck.id)) return false;
  if (!spendGold(save, price)) return false;
  grantDeckCards(save, db, deck.cards);
  save.decks.push({ id: deck.id, name: deck.name, cards: [...deck.cards], heroCardId: null, landStyle: null });
  return true;
}

/**
 * Claim the ONE free starter deck (the Shop's onboarding grant that replaced the
 * old first-launch deck picker). Free (no gold), grants the cards, adds the deck,
 * makes it active if the player has none, and stamps `starterChosen` so only one
 * is ever free — every other starter then costs `starterDeckPrice`. No-op (false)
 * once a starter has been claimed or the deck is already owned.
 */
export function claimFreeStarter(save: SaveData, db: CardDb, deck: DeckList): boolean {
  if (save.starterChosen !== null) return false;
  if (save.decks.some((d) => d.id === deck.id)) return false;
  grantDeckCards(save, db, deck.cards);
  save.decks.push({ id: deck.id, name: deck.name, cards: [...deck.cards], heroCardId: null, landStyle: null });
  if (save.activeDeckId === null) save.activeDeckId = deck.id;
  save.starterChosen = deck.id;
  return true;
}
