import type { AnimationLevel } from '../platform/animPolicy';
import { theme } from './theme';

export interface AchievementClaimMotion {
  stampMs: number;
  settleMs: number;
  staggerMs: number;
  scaleFrom: number;
  angleFrom: number;
  angleTo: number;
}

const CLAIM_MOTION: Record<AnimationLevel, AchievementClaimMotion> = {
  full: {
    stampMs: theme.motion.base,
    settleMs: theme.motion.fast,
    staggerMs: 70,
    scaleFrom: 1.12,
    angleFrom: -8,
    angleTo: -3,
  },
  reduced: {
    stampMs: theme.motion.fast,
    settleMs: 0,
    staggerMs: 50,
    scaleFrom: 1,
    angleFrom: 0,
    angleTo: 0,
  },
  off: {
    stampMs: 0,
    settleMs: 0,
    staggerMs: 0,
    scaleFrom: 1,
    angleFrom: 0,
    angleTo: 0,
  },
};

export function achievementClaimMotion(level: AnimationLevel): AchievementClaimMotion {
  return CLAIM_MOTION[level];
}

export function achievementCascadeDelay(index: number, level: AnimationLevel): number {
  return Math.max(0, index) * CLAIM_MOTION[level].staggerMs;
}

export function achievementCascadeDuration(count: number, level: AnimationLevel): number {
  if (count <= 0) return 0;
  const motion = CLAIM_MOTION[level];
  return achievementCascadeDelay(count - 1, level) + motion.stampMs + motion.settleMs;
}

/** Rise by a perfect fifth from the first seal to the last. */
export function achievementClaimPitch(index: number, count: number): number {
  if (count <= 1) return 1;
  const position = Math.min(1, Math.max(0, index / (count - 1)));
  return 2 ** ((position * 7) / 12);
}
