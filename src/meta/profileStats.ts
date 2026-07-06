import type { SaveData } from './SaveManager';

/**
 * Pure, Phaser-free derivation of the career-record summary the ProfileScene
 * renders. Kept out of the scene so the win-rate math is unit-testable and the
 * meta layer stays browser-free (iron invariant). Reads only existing SaveData
 * fields — no mutation, no schema change.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyRate {
  key: Difficulty;
  w: number;
  l: number;
  /** Win fraction 0..1, or null when no games at this difficulty. */
  rate: number | null;
}

export interface ProfileSummary {
  wins: number;
  losses: number;
  games: number;
  winRate: number | null;
  byDifficulty: DifficultyRate[];
  packsOpened: number;
  bestRung: number;
  completions: number;
}

/** Win rate as a 0..1 fraction, or null when no games have been played (no /0). */
export function winRate(w: number, l: number): number | null {
  const games = w + l;
  return games > 0 ? w / games : null;
}

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

/** Fold the tracked stats + gauntlet progress into a display-ready summary. */
export function computeProfile(save: Pick<SaveData, 'stats' | 'gauntlet'>): ProfileSummary {
  const s = save.stats;
  return {
    wins: s.wins,
    losses: s.losses,
    games: s.wins + s.losses,
    winRate: winRate(s.wins, s.losses),
    byDifficulty: DIFFICULTY_ORDER.map((key) => {
      const { w, l } = s.byDifficulty[key];
      return { key, w, l, rate: winRate(w, l) };
    }),
    packsOpened: s.packsOpened,
    bestRung: save.gauntlet.bestRung,
    completions: save.gauntlet.completions,
  };
}

/** Format a win-rate fraction for display: '—' when null, else a rounded 'NN%'. */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}
