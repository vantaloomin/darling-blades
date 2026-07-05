import { ECONOMY } from '../config/rules';
import type { SaveData } from './SaveManager';

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
  completed: boolean; // full 8-rung clear
  nextRung: number | null; // rung to fight next, or null if the run is over
}

/**
 * Record a gauntlet match and advance/reset the run.
 *
 * The rung's `difficulty` is passed in (not derived from opponents.ts) so the
 * meta layer stays free of data-layer coupling. Win → pay the rung's gold and
 * climb (rung 8 pays the completion bonus and ends the run); loss → pay the
 * standard loss gold and reset the run.
 */
export function applyGauntletResult(
  save: SaveData,
  rung: number, // 1-based rung just played
  difficulty: Difficulty,
  won: boolean,
  today: string, // YYYY-MM-DD
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
