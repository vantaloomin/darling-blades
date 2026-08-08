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

/** Validate one saved deck against its own persisted format without throwing. */
export function deckHealth(db: CardDb, save: SaveData, deck: SavedDeck): DeckHealth {
  try {
    const format = deck.format === 'darlings' || deck.format === 'warchest'
      ? deck.format
      : 'constructed';
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
export function flaggedDecks(db: CardDb, save: SaveData): FlaggedDeckSummary[] {
  return save.decks.flatMap((deck) => {
    const health = deckHealth(db, save, deck);
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
