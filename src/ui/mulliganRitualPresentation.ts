import type { AnimationLevel } from '../platform/animPolicy';

/**
 * Mulligan ritual (Premium UX Wave C): the opening-hand overlay gets a
 * physical library stack. Bottomed cards drag (or tap) onto it and slide
 * under the top plate, staged until Confirm submits the byte-identical
 * `bottomCards` action; taking a mulligan riffles the stack instead of
 * instantly swapping hands. Everything measurable lives here.
 */

/** "1 card" / "4 cards" — the '(s)' suffix never reaches the player. */
export function cardsLabel(n: number): string {
  return n === 1 ? '1 card' : `${n} cards`;
}

export function mulliganTitle(left: number): string {
  return left > 0
    ? `Keep this hand?  ·  ${left} mulligan${left === 1 ? '' : 's'} left`
    : 'Keep this hand?  ·  no mulligans left';
}

export function bottomingTitle(count: number): string {
  return `Put ${cardsLabel(count)} on the bottom`;
}

export function discardTitle(count: number): string {
  return `Discard ${cardsLabel(count)}`;
}

export interface StackRect {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

/** Forgiving drop test: anywhere on or near the stack counts. */
export function stagedDropAccepted(px: number, py: number, rect: StackRect): boolean {
  return Math.abs(px - rect.x) <= rect.halfW && Math.abs(py - rect.y) <= rect.halfH;
}

/**
 * Visual plates for the library stack: more cards, thicker stack, capped
 * where extra plates stop reading. Top plate last (drawn above the rest).
 */
export function libraryStackPlates(deckSize: number): { dx: number; dy: number }[] {
  const plates = Math.max(2, Math.min(5, Math.ceil(deckSize / 8)));
  return Array.from({ length: plates }, (_, i) => ({ dx: i * 1.5, dy: i * -3 }));
}

export interface RiffleMotion {
  /** Interleaving cut passes; 0 means swap hands instantly (today's behavior). */
  cuts: number;
  cutMs: number;
  /** Halves rejoining after the final cut. */
  gatherMs: number;
  /** Horizontal throw of each half during a cut. */
  splitDx: number;
  totalMs: number;
}

export function riffleShuffleMotion(level: AnimationLevel): RiffleMotion {
  if (level === 'full') {
    return { cuts: 3, cutMs: 140, gatherMs: 160, splitDx: 34, totalMs: 3 * 140 + 160 };
  }
  if (level === 'reduced') {
    return { cuts: 1, cutMs: 90, gatherMs: 90, splitDx: 18, totalMs: 90 + 90 };
  }
  return { cuts: 0, cutMs: 0, gatherMs: 0, splitDx: 0, totalMs: 0 };
}

/** X centers of the retrievable staged-card tab, growing left from the stack. */
export function stagedSlots(count: number, originX: number, pitch: number): number[] {
  return Array.from({ length: count }, (_, i) => originX - i * pitch);
}

/** A press that traveled less than the threshold is a tap, not a drag. */
export function dragMoved(
  startX: number,
  startY: number,
  x: number,
  y: number,
  thresholdPx = 6,
): boolean {
  return Math.hypot(x - startX, y - startY) >= thresholdPx;
}
