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

// ── Trophy Hall (Wave C): five wings, one per bucket ─────────────────────────

export const HALL_BUCKETS = ['collection', 'variants', 'theme', 'mastery', 'economy'] as const;
export type HallBucket = (typeof HALL_BUCKETS)[number];

export interface WingStatusLite {
  def: { id: string; bucket: string };
  unlocked: boolean;
  claimed: boolean;
}

export interface WingSummary {
  bucket: HallBucket;
  total: number;
  claimed: number;
  ready: number;
  /** Claimed fraction, 0..1 — the wing's ring gauge. */
  percent: number;
  /** The plinth piece: the first ready achievement, else the last claimed. */
  featuredId: string | null;
}

/** One summary per wing, in fixed hall order, from the evaluated statuses. */
export function wingSummaries(statuses: readonly WingStatusLite[]): WingSummary[] {
  return HALL_BUCKETS.map((bucket) => {
    const inWing = statuses.filter((status) => status.def.bucket === bucket);
    const claimed = inWing.filter((status) => status.claimed);
    const ready = inWing.filter((status) => status.unlocked && !status.claimed);
    return {
      bucket,
      total: inWing.length,
      claimed: claimed.length,
      ready: ready.length,
      percent: inWing.length > 0 ? claimed.length / inWing.length : 0,
      featuredId: ready[0]?.def.id ?? claimed[claimed.length - 1]?.def.id ?? null,
    };
  });
}

export interface WingFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Five plinth frames: three wings up, two centered beneath, inside 72..1208. */
export function hallWingFrames(): WingFrame[] {
  const w = 362;
  const h = 208;
  const gap = 25;
  const topY = 196;
  const bottomY = topY + h + 24;
  const bottomX0 = 72 + (1136 - (2 * w + gap)) / 2;
  return [
    { x: 72, y: topY, w, h },
    { x: 72 + w + gap, y: topY, w, h },
    { x: 72 + 2 * (w + gap), y: topY, w, h },
    { x: bottomX0, y: bottomY, w, h },
    { x: bottomX0 + w + gap, y: bottomY, w, h },
  ];
}

export const SHOWCASE_CAP = 3;

/**
 * Toggle a showcase pin. Pinning past the cap evicts the OLDEST pin, so the
 * showcase never dead-ends; unpinning simply removes.
 */
export function togglePin(pinned: readonly string[], id: string): string[] {
  if (pinned.includes(id)) return pinned.filter((pin) => pin !== id);
  const next = [...pinned, id];
  return next.slice(Math.max(0, next.length - SHOWCASE_CAP));
}

/** Deterministic furnishing picks: which owned cards decorate a wing. */
export function wingFurnishings(
  bucket: HallBucket,
  ownedCardIds: readonly string[],
  count = 2,
): string[] {
  if (ownedCardIds.length === 0) return [];
  let hash = 0;
  for (let i = 0; i < bucket.length; i++) hash = (hash * 31 + bucket.charCodeAt(i)) >>> 0;
  const picks: string[] = [];
  for (let i = 0; i < Math.min(count, ownedCardIds.length); i++) {
    picks.push(ownedCardIds[(hash + i * 7919) % ownedCardIds.length]);
  }
  return [...new Set(picks)];
}
