import { ECONOMY } from '../config/rules';
import type { DeckList } from '../data/starterDecks';
import type { CardDb } from '../engine/types';
import { def } from '../engine/types';
import { addCard } from './Collection';
import type { SaveData } from './SaveManager';
import { PLAIN_VARIANT } from './variants';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface MatchReward {
  gold: number;
  firstWinBonus: boolean;
}

/** Record a match result and pay out gold (+first-win-of-day bonus). */
export function applyMatchResult(
  save: SaveData,
  difficulty: Difficulty,
  won: boolean,
  today: string, // YYYY-MM-DD
): MatchReward {
  let gold: number;
  let firstWinBonus = false;
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
    gold = ECONOMY.lossGold;
    save.stats.losses++;
    save.stats.byDifficulty[difficulty].l++;
  }
  save.gold += gold;
  return { gold, firstWinBonus };
}

export interface GauntletReward {
  gold: number;
  firstWinBonus: boolean;
  runOver: boolean; // the run ended (cleared, lost, or completed)
  completed: boolean; // full 10-rung clear
  nextRung: number | null; // rung to fight next, or null if the run is over
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
      g.run = { rung: nextRung, startedAt, seed };
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

/** Spend gold if affordable. */
export function spendGold(save: SaveData, amount: number): boolean {
  if (save.gold < amount) return false;
  save.gold -= amount;
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
  save.decks.push({ id: deck.id, name: deck.name, cards: [...deck.cards] });
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
  save.decks.push({ id: deck.id, name: deck.name, cards: [...deck.cards] });
  if (save.activeDeckId === null) save.activeDeckId = deck.id;
  save.starterChosen = deck.id;
  return true;
}
