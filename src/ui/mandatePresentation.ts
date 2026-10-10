/**
 * The Mandate on the duel board (2.0 lane B4), Phaser-free so its placement
 * and copy can be checked headlessly. `MandateSeal` draws it; DuelScene
 * decides when it moves.
 *
 * Placement follows the owner's mobile calls (ruled 2026-10-10): M1, the held
 * seal sits beside its holder's life badge, on the commander portrait and
 * never over the life number; M2, nothing is shown while no one holds it.
 */
import type { PlayerId } from '../engine/types';
import { DUEL_LAYOUT, LIFE_BADGE_REACH } from './duelLayout';

/** The seal's drawn diameter on the 1280×720 board. */
export const MANDATE_SEAL_SIZE = 30;
/** The seal's hit area: the 44px touch floor. */
export const MANDATE_SEAL_HIT = 44;
/** The claim flight, one tween (the mobile frames' N5). */
export const MANDATE_CLAIM_MS = 600;
/** Air between the life badge's reach and the seal's rim. */
const SEAL_GAP = 4;

/** The rules reminder, word for word from the set plan. */
export const MANDATE_REMINDER =
  'The Mandate begins unclaimed. At your Dawn, if you hold it, draw a card. ' +
  'When your creatures deal combat damage to the player who holds it, you claim it.';

export type MandateSpot = 'you' | 'opponent';

/** Where the seal sits for this holder, from the human's side; null while unclaimed (nothing drawn). */
export function mandateSpot(holder: PlayerId | null | undefined, human: PlayerId): MandateSpot | null {
  if (holder === null || holder === undefined) return null;
  return holder === human ? 'you' : 'opponent';
}

/** The seal's centre beside the holder's life badge. */
export function mandateSealCenter(spot: MandateSpot): { x: number; y: number } {
  const offset = LIFE_BADGE_REACH + SEAL_GAP + MANDATE_SEAL_SIZE / 2;
  // Each life badge sits at its portrait's outer corner; the seal sits inboard of it.
  return spot === 'you'
    ? { x: DUEL_LAYOUT.myLife.x + offset, y: DUEL_LAYOUT.myLife.y }
    : { x: DUEL_LAYOUT.oppLife.x - offset, y: DUEL_LAYOUT.oppLife.y };
}

/** The seal's hover line, which also names it for assistive reading. */
export function mandateSealCaption(spot: MandateSpot): string {
  return spot === 'you' ? 'You hold the Mandate' : 'Your opponent holds the Mandate';
}
