/**
 * The Mandate on the duel board (2.0 lane B4), Phaser-free so its placement,
 * visibility and copy can be checked headlessly. `MandateSeal` draws it;
 * DuelScene decides when it moves.
 *
 * Placement follows the mobile frames' recommended dock (owner calls M1 and
 * M2, both open; the desktop follows option A until they are ruled): the held
 * seal sits beside its holder's life badge, on the commander portrait and
 * never over the life number, and the unclaimed seal waits beside the turn
 * chip.
 */
import { cardMechanics } from '../data/glossary';
import { cardIdOf, type CardDb, type CardEntry, type GameState, type PlayerId } from '../engine/types';
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

export type MandateSpot = 'you' | 'opponent' | 'unclaimed';

export function mandateSpot(holder: PlayerId | null | undefined, human: PlayerId): MandateSpot {
  if (holder === null || holder === undefined) return 'unclaimed';
  return holder === human ? 'you' : 'opponent';
}

/** The seal's centre for a spot. The unclaimed spot depends on the turn chip's drawn width. */
export function mandateSealCenter(spot: MandateSpot, turnPillWidth: number): { x: number; y: number } {
  const offset = LIFE_BADGE_REACH + SEAL_GAP + MANDATE_SEAL_SIZE / 2;
  switch (spot) {
    case 'you':
      // Your life badge is at the portrait's outer (left) corner; the seal sits inboard of it.
      return { x: DUEL_LAYOUT.myLife.x + offset, y: DUEL_LAYOUT.myLife.y };
    case 'opponent':
      return { x: DUEL_LAYOUT.oppLife.x - offset, y: DUEL_LAYOUT.oppLife.y };
    case 'unclaimed':
      return {
        x: DUEL_LAYOUT.turnPill.x + turnPillWidth / 2 + SEAL_GAP * 2 + MANDATE_SEAL_SIZE / 2,
        y: DUEL_LAYOUT.turnPill.y,
      };
  }
}

/** The seal's hover line, which also names it for assistive reading. */
export function mandateSealCaption(spot: MandateSpot): string {
  switch (spot) {
    case 'you':
      return 'You hold the Mandate';
    case 'opponent':
      return 'Your opponent holds the Mandate';
    case 'unclaimed':
      return 'The Mandate is unclaimed';
  }
}

const readsMandate = new Map<string, boolean>();

/** Whether a card's face names the Mandate (a claim, a "whenever you claim", a hold check). */
export function cardReadsMandate(db: CardDb, cardId: string): boolean {
  let known = readsMandate.get(cardId);
  if (known === undefined) {
    const card = db[cardId];
    known = card !== undefined && cardMechanics(card).includes('mandate');
    readsMandate.set(cardId, known);
  }
  return known;
}

/**
 * Whether the duel shows the Mandate at all. Someone holds it, or a card that
 * names it is one the human can see: anywhere in their own deck (they built
 * it), or face up anywhere public. The opponent's hidden cards never count,
 * so the seal appearing reveals nothing about their deck. Before 2.0's cards
 * exist, no duel shows it.
 */
export function mandateShown(state: GameState, db: CardDb, human: PlayerId): boolean {
  if (state.mandateHolder !== undefined) return true;
  const reads = (entry: CardEntry | null | undefined): boolean =>
    entry !== null && entry !== undefined && cardReadsMandate(db, cardIdOf(entry));
  const mine = state.players[human];
  if ([...mine.deck, ...mine.hand].some(reads) || reads(mine.darlingZone)) return true;
  return (
    state.battlefield.some((perm) => cardReadsMandate(db, perm.cardId)) ||
    state.stack.some((item) => cardReadsMandate(db, item.cardId)) ||
    state.players.some((player) => [...player.graveyard, ...player.severed].some(reads) || reads(player.darlingZone))
  );
}
