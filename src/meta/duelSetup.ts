import type { Difficulty } from './Economy';
import { floorBrain } from '../ai/tiers';
import type { GameFormat } from '../config/rules';
import type { CardDb, Color } from '../engine/types';
import { deckHealth } from './deckRepair';
import type { SaveData, SavedDeck } from './SaveManager';
import {
  isBasicLand,
  isDualLand,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS,
  WARCHEST_HAND_SIZE,
} from './warchest';

export interface PracticeDuelLaunchData {
  opponentId: string;
  difficulty: Difficulty;
}

/** Keep the selected practice rival and AI strength in one launch payload. */
export function practiceDuelLaunchData(opponentId: string, difficulty: Difficulty): PracticeDuelLaunchData {
  return { opponentId, difficulty };
}

/** Resolve the optional engine override without changing absent-field replay behavior. */
export function resolveDuelStartingHandSize(
  format: GameFormat | undefined,
  replay: { startingHandSize?: number } | null,
): number | undefined {
  if (replay) return replay.startingHandSize;
  // Both reserve formats deal the 5-card opener; classic keeps the default 7.
  return format === 'warchest' || format === 'darlings' ? WARCHEST_HAND_SIZE : undefined;
}

/** Return the first blocking issue before a saved deck enters a duel. */
export function firstDuelLaunchIssue(
  db: CardDb,
  save: SaveData,
  deck: SavedDeck | null,
): string | null {
  if (!deck) return null;
  const { issues } = deckHealth(db, save, deck);
  return issues.find((issue) => issue.kind === 'error')?.message ?? null;
}

/** Validate the engine-facing two-seat reserve payload without ownership rules. */
export function firstReserveConfigIssue(
  db: CardDb,
  reserves: readonly (readonly string[])[] | undefined,
): string | null {
  if (!reserves || reserves.length !== 2) return 'Reserve configuration needs two player reserves';
  for (const [player, reserve] of reserves.entries()) {
    if (reserve.length !== LAND_RESERVE_SIZE) {
      return `Reserve for player ${player + 1} needs exactly ${LAND_RESERVE_SIZE} lands (currently ${reserve.length})`;
    }
    let duals = 0;
    for (const id of reserve) {
      const card = db[id];
      if (!card) return 'That reserve contains an unavailable card';
      if (!isBasicLand(card) && !isDualLand(card)) {
        return `${card.name} is not a basic land or dual land`;
      }
      if (isDualLand(card)) duals++;
    }
    if (duals > MAX_DUAL_LANDS) {
      return `Reserve for player ${player + 1} may contain at most ${MAX_DUAL_LANDS} dual lands (currently ${duals})`;
    }
  }
  return null;
}

const AI_COLOR_ORDER: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
const BASIC_FOR_COLOR: Record<Color, string> = {
  W: 'land-plains',
  U: 'land-island',
  B: 'land-swamp',
  R: 'land-mountain',
  G: 'land-forest',
};

/**
 * Build the AI side's reserve for a reserve-format Practice duel.
 *
 * Reserve Practice is player-built-only per plan-battle-box.md, so the AI
 * pilots the same all-spell list as the active player. Its reserve is
 * ten basics cycling through the deck's printed colors in WUBRG order. This
 * is deliberately conservative and deterministic: it uses no duals, so the
 * five-dual cap is always satisfied, and colorless lists use Plains as the
 * legal basics-only fallback.
 */
export function buildAiLandReserve(deck: readonly string[], db: CardDb): string[] {
  const colors = new Set<Color>();
  for (const cardId of deck) {
    for (const color of db[cardId]?.colors ?? []) colors.add(color);
  }
  const basics = AI_COLOR_ORDER.filter((color) => colors.has(color)).map((color) => BASIC_FOR_COLOR[color]);
  const palette = basics.length > 0 ? basics : [BASIC_FOR_COLOR.W];
  return Array.from({ length: 10 }, (_, index) => palette[index % palette.length]);
}

/**
 * A Tower floor is authoritative because it sets the brain independently of
 * the assigned avatar. Outside the Tower, replay metadata and explicit
 * Practice choices keep their existing precedence.
 */
export function resolveDuelDifficulty(
  replayDifficulty: Difficulty | undefined,
  requestedDifficulty: Difficulty | undefined,
  opponentDifficulty: Difficulty | undefined,
  gauntletRung: number | null = null,
): Difficulty {
  if (gauntletRung !== null) return floorBrain(gauntletRung);
  return replayDifficulty ?? requestedDifficulty ?? opponentDifficulty ?? 'easy';
}
