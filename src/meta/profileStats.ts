import { LIMITED_MATCHES, type LimitedDeckStyle, type LimitedState } from './Limited';
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

// ---------------------------------------------------------------------------
// Draft record
// ---------------------------------------------------------------------------

export interface DraftSummary {
  /** Completed runs. An in-flight run is deliberately excluded until it finishes. */
  runs: number;
  wins: number;
  losses: number;
  /** Match win fraction 0..1 across completed runs, or null when none. */
  winRate: number | null;
  /** Best match count in a single run, from the persisted record. */
  bestWins: number;
  /** Runs that finished with the maximum match wins. */
  perfectRuns: number;
  goldEarned: number;
  premiumRuns: number;
  /** Completed-run counts per built deck style, most-built first. */
  byDeckStyle: { key: LimitedDeckStyle; runs: number }[];
  /** Distinct personas the player has actually drafted against. */
  personasMet: number;
  /** True while a run is in progress, so the UI can say the record excludes it. */
  runInProgress: boolean;
}

const DECK_STYLE_ORDER: readonly LimitedDeckStyle[] = ['mono', 'dual', 'other'];

/**
 * Fold the persisted Limited history into a display-ready draft record.
 *
 * Counts only COMPLETED runs: `history` is written at the end of a run, so an
 * abandoned or in-flight draft contributes nothing and cannot inflate the
 * record. Legacy `sealed` entries are excluded too; sealed was cancelled after
 * v14 saves could already persist it, and those rows stay in the blob for
 * losslessness rather than as draft results.
 */
export function computeDraftSummary(
  limited: Pick<LimitedState, 'history' | 'bestDraftWins' | 'personaSeen' | 'activeRun'> & {
    premiumWeek?: unknown;
  },
): DraftSummary {
  const runs = limited.history.filter((entry) => entry.mode === 'draft');
  const wins = runs.reduce((n, entry) => n + entry.wins, 0);
  const losses = runs.reduce((n, entry) => n + entry.losses, 0);
  const byDeckStyle = DECK_STYLE_ORDER.map((key) => ({
    key,
    runs: runs.filter((entry) => entry.deckStyle === key).length,
  })).sort((a, b) => b.runs - a.runs || DECK_STYLE_ORDER.indexOf(a.key) - DECK_STYLE_ORDER.indexOf(b.key));

  return {
    runs: runs.length,
    wins,
    losses,
    winRate: winRate(wins, losses),
    bestWins: limited.bestDraftWins,
    perfectRuns: runs.filter((entry) => entry.wins === LIMITED_MATCHES).length,
    goldEarned: runs.reduce((n, entry) => n + entry.rewardGold, 0),
    premiumRuns: runs.filter((entry) => entry.premium === true).length,
    byDeckStyle,
    personasMet: Object.values(limited.personaSeen ?? {}).filter((n) => n > 0).length,
    runInProgress: limited.activeRun !== null,
  };
}

export const DECK_STYLE_LABEL: Record<LimitedDeckStyle, string> = {
  mono: 'Mono-color',
  dual: 'Two-color',
  other: 'Three or more',
};
