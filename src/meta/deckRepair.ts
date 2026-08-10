import { FEATURES } from '../config/features';
import type { CardDb } from '../engine/types';
import { validateDeck, type DeckIssue } from './DeckStorage';
import { validateDarlingsDeck, validateWarchestDeck } from './darlings';
import type { SaveData, SavedDeck } from './SaveManager';

export interface DeckHealth {
  issues: DeckIssue[];
  blocked: boolean;
}

export interface FlaggedDeckSummary {
  deckId: string;
  name: string;
  issues: DeckIssue[];
  firstIssue: string;
}

/** The one player-facing sentence a retired classic deck reports. */
export const CLASSIC_RETIRED_ISSUE = 'Constructed has retired. Switch this deck to Warchest to play it.';

/**
 * Validate one saved deck against its own persisted format without throwing.
 *
 * After classic retirement a constructed deck is invalid no matter how legal
 * its 60 cards are: it has no Warchest, so no duel can seat it. Reporting that
 * as an ordinary blocking issue is what routes it into the flag-and-fix flow
 * rather than deleting or silently rewriting the player's build. `classicRetired`
 * defaults to the shipped switch so callers stay unchanged, and is explicit so
 * tests can pin either side of the migration.
 */
export function deckHealth(
  db: CardDb,
  save: SaveData,
  deck: SavedDeck,
  classicRetired: boolean = FEATURES.classicRetired,
): DeckHealth {
  try {
    const format = deck.format === 'darlings' || deck.format === 'warchest'
      ? deck.format
      : 'constructed';
    if (format === 'constructed' && classicRetired) {
      return { issues: [{ kind: 'error', message: CLASSIC_RETIRED_ISSUE }], blocked: true };
    }
    const reserve = Array.isArray(deck.landReserve) ? deck.landReserve : [];
    const issues = format === 'darlings'
      ? validateDarlingsDeck(db, save, deck.cards, deck.darlingId ?? null, reserve)
      : format === 'warchest'
        ? validateWarchestDeck(db, save, deck.cards, reserve)
        : validateDeck(db, save, deck.cards);
    return { issues, blocked: issues.some((issue) => issue.kind === 'error') };
  } catch {
    const issues: DeckIssue[] = [{ kind: 'error', message: 'This deck could not be checked' }];
    return { issues, blocked: true };
  }
}

/** Summaries for every blocked saved deck, retaining save order for routing. */
export function flaggedDecks(
  db: CardDb,
  save: SaveData,
  classicRetired: boolean = FEATURES.classicRetired,
): FlaggedDeckSummary[] {
  return save.decks.flatMap((deck) => {
    const health = deckHealth(db, save, deck, classicRetired);
    if (!health.blocked) return [];
    return [{
      deckId: deck.id,
      name: deck.name,
      issues: health.issues,
      firstIssue: health.issues.find((issue) => issue.kind === 'error')?.message ?? health.issues[0]?.message ?? '',
    }];
  });
}

/** Collision-free, stable snapshot of the acknowledged flagged deck-id set. */
export function deckRepairNoticeFingerprint(flagged: readonly Pick<FlaggedDeckSummary, 'deckId'>[]): string {
  return JSON.stringify([...new Set(flagged.map((deck) => deck.deckId))].sort(compareIds));
}

export interface DeckRepairNoticeState {
  acknowledgedFingerprint: string;
  needsNotice: boolean;
}

/**
 * Drop repaired ids from the acknowledgement without warning again. Any id
 * that is currently flagged but absent from the retained set is newly flagged.
 */
export function deckRepairNoticeState(
  flagged: readonly Pick<FlaggedDeckSummary, 'deckId'>[],
  rawAcknowledgement: string,
): DeckRepairNoticeState {
  let acknowledgedIds: string[] = [];
  try {
    const parsed: unknown = JSON.parse(rawAcknowledgement);
    if (Array.isArray(parsed)) acknowledgedIds = parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    // A malformed acknowledgement behaves like no acknowledgement.
  }
  const acknowledged = new Set(acknowledgedIds);
  const currentIds = [...new Set(flagged.map((deck) => deck.deckId))].sort(compareIds);
  const retained = currentIds.filter((id) => acknowledged.has(id));
  return {
    acknowledgedFingerprint: JSON.stringify(retained),
    needsNotice: retained.length !== currentIds.length,
  };
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Classic retirement: convert a granted starter or theme deck to its shipped
 * reserve build, but ONLY if the player never edited it.
 *
 * Owner decision 2026-08-09. A player who never touched their free Crimson
 * Muster should find a working Crimson Muster after the migration, not a
 * repair prompt for a deck they did not build. A player who DID edit theirs
 * made choices, and those deserve the flag-and-fix flow rather than a silent
 * overwrite - so an edited deck returns false and stays invalid on purpose.
 *
 * Wired 2026-08-10 into the save v28 retirement migration. It is safe to
 * re-run: a converted deck is already `warchest`, so the format guard below
 * returns false on every later load.
 */
export function convertUnmodifiedStarter(
  deck: SavedDeck,
  shipped: { id: string; cards: readonly string[]; reserveCards?: string[]; landReserve?: string[] }[],
): boolean {
  const source = shipped.find((entry) => entry.id === deck.id);
  if (!source?.reserveCards || !source.landReserve) return false;
  if (deck.format !== 'constructed' && deck.format !== undefined) return false;

  const sorted = (cards: readonly string[]): string[] => [...cards].sort();
  const untouched =
    deck.cards.length === source.cards.length &&
    sorted(deck.cards).every((id, index) => id === sorted(source.cards)[index]);
  if (!untouched) return false;

  deck.cards = [...source.reserveCards];
  deck.format = 'warchest';
  deck.landReserve = [...source.landReserve];
  deck.darlingId = null;
  // Positional treatment pins are index-aligned to `cards`, so a resized list
  // must drop them rather than leave pins pointing at different cards.
  deck.variantPins = new Array(source.reserveCards.length).fill(null);
  return true;
}
