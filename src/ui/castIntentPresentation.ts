import type { AnimationLevel } from '../platform/animPolicy';

/**
 * Shared carry-cast (CastIntent) presentation state, phase 1: a click on an
 * untargeted castable spell lifts a proxy that follows the cursor; dropping it
 * on the field submits the exact action a click used to, so replays stay
 * byte-identical. Targeted spells keep the arrow flow until phase 2.
 */
export interface CarryFollowPose {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Cursor-follow stiffness. One value so lag feels identical on both axes. */
const FOLLOW_OMEGA = 16;

/** Velocity tilt: degrees per px/s of horizontal cursor speed, and its cap. */
const TILT_DEG_PER_PX_S = 0.012;
const TILT_MAX_DEG = 10;

/**
 * Critically damped spring step toward the cursor, framerate-independent.
 * Reduced and off snap to the target: the carry stays an interaction there,
 * only the lag is decoration.
 */
export function stepCarryFollow(
  pose: CarryFollowPose,
  target: { x: number; y: number },
  dtMs: number,
  animations: AnimationLevel,
): CarryFollowPose {
  if (animations !== 'full' || dtMs <= 0) {
    return { x: target.x, y: target.y, vx: 0, vy: 0 };
  }
  const dt = Math.min(dtMs, 100) / 1000;
  const decay = Math.exp(-FOLLOW_OMEGA * dt);
  const axis = (position: number, velocity: number, to: number): [number, number] => {
    const dx = position - to;
    const c2 = velocity + FOLLOW_OMEGA * dx;
    return [
      to + (dx + c2 * dt) * decay,
      (c2 - FOLLOW_OMEGA * (dx + c2 * dt)) * decay,
    ];
  };
  const [x, vx] = axis(pose.x, pose.vx, target.x);
  const [y, vy] = axis(pose.y, pose.vy, target.y);
  return { x, y, vx, vy };
}

/** Horizontal velocity reads as a lean, capped so fast flicks stay a card. */
export function carryTiltDeg(vx: number, animations: AnimationLevel): number {
  if (animations !== 'full') return 0;
  return Math.max(-TILT_MAX_DEG, Math.min(TILT_MAX_DEG, vx * TILT_DEG_PER_PX_S));
}

/**
 * Whether a resolved cast enters carry instead of acting immediately. Touch
 * keeps the classified tap (tap = cast now), and the Settings escape hatch
 * restores the old instant cast wholesale.
 */
export function carryCastEligible(opts: {
  targeted: boolean;
  touch: boolean;
  instantCast: boolean;
}): boolean {
  return !opts.targeted && !opts.touch && !opts.instantCast;
}

/**
 * A release above the hand fan drops the cast; a release back into the hand
 * band cancels it. One horizontal line keeps the rule readable mid-carry.
 */
export function carryDropAccepted(pointerY: number, handTopY: number): boolean {
  return pointerY < handTopY;
}
