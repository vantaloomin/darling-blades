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

export interface AvatarReserveSide {
  deck: string[];
  reserve: string[];
  darlingId: string | null;
}

/**
 * The AI seat for a reserve-format duel. Since the 1.6 stage-3 migration the
 * selected avatar fields its own designed reserve deck (Warchest) or Darlings
 * variant; classic retirement extended that from Practice to the Tower, which
 * is why this is no longer named for Practice. The old player-deck mirror
 * survives only for callers that supply no avatar (dev overrides), and a
 * synthetic reserve is built only for that mirror fallback.
 */
export function avatarReserveSide(
  avatar: {
    reserveDeck: readonly string[];
    landReserve: readonly string[];
    darlingsDeck: readonly string[];
    darlingId: string;
  } | null,
  format: 'warchest' | 'darlings',
  playerDeck: readonly string[],
  playerDarlingId: string | null,
  db: CardDb,
): AvatarReserveSide {
  if (avatar) {
    return format === 'darlings'
      ? { deck: [...avatar.darlingsDeck], reserve: [...avatar.landReserve], darlingId: avatar.darlingId }
      : { deck: [...avatar.reserveDeck], reserve: [...avatar.landReserve], darlingId: null };
  }
  const deck = [...playerDeck];
  return { deck, reserve: buildAiLandReserve(deck, db), darlingId: playerDarlingId };
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

/** WUBRG order and the basic for each colour. Exported so Limited's reserve
 * builder shares one basics mapping instead of duplicating it. */
export const AI_COLOR_ORDER: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
export const BASIC_FOR_COLOR: Record<Color, string> = {
  W: 'land-plains',
  U: 'land-island',
  B: 'land-swamp',
  R: 'land-mountain',
  G: 'land-forest',
};

/**
 * Synthesize a reserve for an AI deck that carries none of its own.
 *
 * Since the 1.6 stage-3 migration, Practice avatars field their designed
 * landReserve; this synthetic fallback serves only deck-override edge paths
 * (dev tools, tests) where a bare list arrives without a reserve. Ten basics
 * cycle through the deck's printed colors in WUBRG order: deliberately
 * conservative and deterministic, no duals so the five-dual cap always
 * holds, and colorless lists use Plains as the legal basics-only fallback.
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
