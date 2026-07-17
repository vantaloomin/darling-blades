import type { Difficulty } from './Economy';

export interface PracticeDuelLaunchData {
  opponentId: string;
  difficulty: Difficulty;
}

/** Keep the selected practice rival and AI strength in one launch payload. */
export function practiceDuelLaunchData(opponentId: string, difficulty: Difficulty): PracticeDuelLaunchData {
  return { opponentId, difficulty };
}

/**
 * Replay metadata is authoritative. A live Practice choice overrides an
 * avatar's tower tier; Gauntlet launches omit it and inherit the avatar tier.
 */
export function resolveDuelDifficulty(
  replayDifficulty: Difficulty | undefined,
  requestedDifficulty: Difficulty | undefined,
  opponentDifficulty: Difficulty | undefined,
): Difficulty {
  return replayDifficulty ?? requestedDifficulty ?? opponentDifficulty ?? 'easy';
}
