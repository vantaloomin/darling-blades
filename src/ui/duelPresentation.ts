/**
 * Phaser-free presentation rules shared by the duel board. Keeping these
 * choices data-only makes the playtest geometry and target semantics easy to
 * pin without importing a scene into UI tests.
 */

export type DuelSide = 'you' | 'opponent';
export type TargetRingTone = 'friendly' | 'hostile';

export const TARGET_ARROW_HEAD_LENGTH = 16;

/** Stop the flat shaft at the back of the filled head instead of under its tip. */
export function targetArrowShaftEnd(
  control: { x: number; y: number },
  tip: { x: number; y: number },
  headLength = TARGET_ARROW_HEAD_LENGTH,
): { x: number; y: number } {
  const dx = tip.x - control.x;
  const dy = tip.y - control.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { ...tip };
  return {
    x: tip.x - (dx / length) * headLength,
    y: tip.y - (dy / length) * headLength,
  };
}

export interface PresentationRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The foe's Warchest pile lives in the narrow right gutter of the opponent
 * plate. These are the scene's audited design-space measurements, kept here
 * so clearance can be proven without importing Phaser into tests.
 */
export const OPPONENT_RESERVE_PILE_LAYOUT = {
  x: 1024,
  y: 132,
  cardScale: 0.12,
  visualHalfWidth: 20,
  visualTop: -28,
  visualBottom: 28,
} as const;

export const OPPONENT_RESERVE_CLEARANCE = {
  plate: { left: 108, right: 1046, top: 16, bottom: 292 },
  manaStrip: { x0: 1006, cy: 56, step: 44, halfHeight: 22 },
  permanentBand: { left: 120, right: 500, cy: 63, halfHeight: 46.75 },
  creatureBand: {
    x: 577,
    cy: 200,
    usable: 860,
    tileWidth: 156,
    tileHeight: 170,
    maxSpacing: 174,
    gutter: 6,
  },
  portrait: { left: 1056, right: 1256, top: 8, bottom: 188 },
  darling: { left: 1126, right: 1186, top: 200, bottom: 284 },
} as const;

export function opponentReservePileBounds(): PresentationRect {
  const pile = OPPONENT_RESERVE_PILE_LAYOUT;
  return {
    left: pile.x - pile.visualHalfWidth,
    right: pile.x + pile.visualHalfWidth,
    top: pile.y + pile.visualTop,
    bottom: pile.y + pile.visualBottom,
  };
}

export function presentationRectsOverlap(a: PresentationRect, b: PresentationRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

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

export function hauntlinkActionLabel(hasLegalAction: boolean, linked: boolean): 'Link' | 'Relink' | null {
  if (!hasLegalAction) return null;
  return linked ? 'Relink' : 'Link';
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

/** Hold-to-confirm progress stays inside the action that owns the choice. */
export const SHARD_HOLD_BUTTON_PROGRESS = {
  inset: 3,
  cornerRadius: 4,
  fillAlpha: 0.3,
  ringWidth: 2,
} as const;
