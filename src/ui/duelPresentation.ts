/**
 * Phaser-free presentation rules shared by the duel board. Keeping these
 * choices data-only makes the playtest geometry and target semantics easy to
 * pin without importing a scene into UI tests.
 */

export type DuelSide = 'you' | 'opponent';
export type TargetRingTone = 'friendly' | 'hostile';

/**
 * A linked card sits beneath its host with its header exposed above the host.
 * The 64% scale and -56px rise leave the header clear of both creature rows;
 * the shallow sideways nudge reads as a physical paper overlap rather than a
 * centered state badge.
 */
export const HAUNTLINK_OVERLAP = {
  scale: 0.64,
  rise: 56,
  sideNudge: 18,
  stackStepX: 10,
  stackStepY: 6,
} as const;

export function hauntlinkOverlap(side: DuelSide, slot = 0): { x: number; y: number; scale: number } {
  return {
    x: (side === 'you' ? -HAUNTLINK_OVERLAP.sideNudge : HAUNTLINK_OVERLAP.sideNudge) + slot * HAUNTLINK_OVERLAP.stackStepX,
    y: -HAUNTLINK_OVERLAP.rise - slot * HAUNTLINK_OVERLAP.stackStepY,
    scale: HAUNTLINK_OVERLAP.scale,
  };
}

/** Controller-side rule for legal target rings, independent of spell intent. */
export function targetRingTone(controller: DuelSide): TargetRingTone {
  return controller === 'opponent' ? 'hostile' : 'friendly';
}

/**
 * Full-motion card travel only. Reduced/off paths deliberately retain their
 * existing compact treatment. These visual tweens never await or extend an
 * action lock.
 */
export const CARD_TRAVEL_MOTION = {
  handExit: { duration: 225, ease: 'Quad.easeIn' },
  drawToHand: { duration: 280, ease: 'Quad.easeOut', destinationPreviewAlpha: 0.42 },
  playToStation: { duration: 420, ease: 'Cubic.easeOut' },
  playerStationHold: 300,
  opponentStationHold: 500,
  stationToBattlefield: { duration: 420, ease: 'Cubic.easeInOut' },
  arrivalFade: { duration: 120, ease: 'Quad.easeIn' },
  skimToGraveyard: { duration: 540, ease: 'Cubic.easeInOut' },
  severToPile: { duration: 540, ease: 'Cubic.easeInOut' },
  batch: { maxAnimatedCards: 3, staggerMs: 70 },
} as const;
