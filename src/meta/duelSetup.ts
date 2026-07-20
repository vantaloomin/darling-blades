import type { Difficulty } from './Economy';
import { floorBrain } from '../ai/tiers';

export interface PracticeDuelLaunchData {
  opponentId: string;
  difficulty: Difficulty;
}

/** Keep the selected practice rival and AI strength in one launch payload. */
export function practiceDuelLaunchData(opponentId: string, difficulty: Difficulty): PracticeDuelLaunchData {
  return { opponentId, difficulty };
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
