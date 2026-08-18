/** Phaser-free state for the duel portraits' reactive input priority. */

export type FaceTargetSeat = 'you' | 'opponent';

export interface FaceTargetSurfaceState {
  targetEnabled: boolean;
  depth: number;
}

/**
 * Board cards top out at the hand-hover band (40). Armed portraits join the
 * HUD band so their child Zones win hit testing without moving above the life
 * badges, which are created later at the same depth.
 */
export const FACE_TARGET_DEPTH = {
  resting: 0,
  armed: 56,
} as const;

export function faceTargetSurfaceState(targetable: boolean): FaceTargetSurfaceState {
  return {
    targetEnabled: targetable,
    depth: targetable ? FACE_TARGET_DEPTH.armed : FACE_TARGET_DEPTH.resting,
  };
}

export function faceTargetSeatStates(
  targetable: Readonly<Record<FaceTargetSeat, boolean>>,
): Record<FaceTargetSeat, FaceTargetSurfaceState> {
  return {
    you: faceTargetSurfaceState(targetable.you),
    opponent: faceTargetSurfaceState(targetable.opponent),
  };
}
