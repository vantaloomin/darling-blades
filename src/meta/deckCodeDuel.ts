import type { CardDb } from '../engine/types';
import { isLiveCollectible } from '../data/liveness';
import { decodeDeck, deckCodeErrorMessage, encodeDeck, type DeckCodeFormat } from './DeckCode';
import type { DeckIssue } from './DeckStorage';
import { validateDarlingsDeck, validateWarchestDeck } from './darlings';
import { buildAiLandReserve } from './duelSetup';
import type { SaveData, SavedDeck } from './SaveManager';
import { WARCHEST_DECK_SIZE } from './warchest';

/**
 * Duel Deck Codes (2.0): paste a shared deck code and duel it with the AI
 * piloting it. This module turns a code into the AI seat's deck and says
 * whether the player's deck can meet it. Phaser-free.
 *
 * A pasted deck is judged by the format's deck rules (size, copies, the
 * Warchest, the Darling's colors) but never by ownership: the AI fields it,
 * and the player owns none of it. Cards that are not released yet are
 * refused, so a code can never put an unreleased card on the board.
 */

/** The AI seat a code fields. */
export interface DeckCodeOpponent {
  format: DeckCodeFormat;
  cards: string[];
  landReserve: string[];
  darlingId: string | null;
}

export type DeckCodeOpponentResult =
  | { ok: true; deck: DeckCodeOpponent }
  | { ok: false; message: string };

/** A collection that holds every card the deck names, so the format validators judge only deck rules. */
function ownsEverything(ids: readonly string[]): SaveData {
  const collection: Record<string, number> = {};
  for (const id of ids) collection[id] = 99;
  return { collection } as unknown as SaveData;
}

function firstError(issues: readonly DeckIssue[]): string | null {
  return issues.find((issue) => issue.kind === 'error')?.message ?? null;
}

/**
 * The deck a code fields for the AI, or why it cannot be played. A code from
 * before 1.9 carries only a card list: a 40-spell list plays as a Standard
 * deck with a Warchest built from its colors, and anything else is refused
 * (a 60-card list is a retired Constructed deck). A Standard or Darlings code
 * without a Warchest gets one built the same way.
 */
export function deckCodeOpponent(
  code: string,
  db: CardDb,
  knownCardIds: readonly string[],
  isLive: (id: string) => boolean = (id) => { const card = db[id]; return !!card && (card.supertypes?.includes('basic') === true || isLiveCollectible(card)); },
): DeckCodeOpponentResult {
  const decoded = decodeDeck(code, knownCardIds);
  if (!decoded.ok) return { ok: false, message: deckCodeErrorMessage(decoded.error) };

  let format: DeckCodeFormat;
  if (decoded.format !== null) {
    format = decoded.format;
  } else if (decoded.cards.length === WARCHEST_DECK_SIZE && !decoded.cards.some((id) => db[id]?.types.includes('land'))) {
    format = 'warchest';
  } else {
    return { ok: false, message: 'That code is an old Constructed deck. Re-export it as a Standard or Darlings deck to duel it.' };
  }
  if (format === 'darlings' && !decoded.darlingId) return { ok: false, message: 'That Darlings code names no Darling.' };

  const cards = [...decoded.cards];
  const darlingId = format === 'darlings' ? decoded.darlingId : null;
  const landReserve = decoded.landReserve ? [...decoded.landReserve] : buildAiLandReserve(cards, db);
  const named = [...cards, ...landReserve, ...(darlingId ? [darlingId] : [])];
  if (named.some((id) => !isLive(id))) return { ok: false, message: 'That code uses cards that are not released yet.' };

  const save = ownsEverything(named);
  const issue = firstError(format === 'darlings'
    ? validateDarlingsDeck(db, save, cards, darlingId, landReserve)
    : validateWarchestDeck(db, save, cards, landReserve));
  if (issue) return { ok: false, message: `That deck cannot be played: ${issue}` };
  return { ok: true, deck: { format, cards, landReserve, darlingId } };
}

/** Why the player's active deck cannot meet a code's deck, or null when it can. */
export function deckCodeSeatIssue(opponent: DeckCodeOpponent, mine: SavedDeck | null): string | null {
  if (!mine) return 'Choose a deck to play first.';
  const myFormat = mine.format === 'darlings' || mine.format === 'warchest' ? mine.format : null;
  if (myFormat === opponent.format) return null;
  return opponent.format === 'darlings'
    ? 'This is a Darlings deck. Choose one of your Darlings decks to play it.'
    : 'This is a Standard deck. Choose one of your Standard decks to play it.';
}

/** The AI strength levels a code duel offers. Hard is today's Hard; harder levels join with their brains. */
export type DeckCodeLevel = 'hard' | 'expert' | 'master';
export const DECK_CODE_LEVELS: readonly DeckCodeLevel[] = ['hard', 'expert', 'master'];

/**
 * The code for one of the player's own saved decks, so it can be dueled the
 * same way a pasted code is ("or your own!"). Only Standard and Darlings decks
 * have one; a retired Constructed deck gets null.
 */
export function savedDeckDuelCode(deck: Pick<SavedDeck, 'cards' | 'format' | 'darlingId' | 'landReserve'>): string | null {
  if (deck.format !== 'warchest' && deck.format !== 'darlings') return null;
  return encodeDeck({
    cards: deck.cards,
    format: deck.format,
    darlingId: deck.format === 'darlings' ? deck.darlingId ?? null : null,
    landReserve: deck.landReserve ?? null,
  });
}
