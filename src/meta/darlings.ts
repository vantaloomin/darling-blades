import { RULES } from '../config/rules';
import type { CardDb, CardDef, Color } from '../engine/types';
import { ownedCount } from './Collection';
import type { DeckIssue } from './DeckStorage';
import type { SaveData } from './SaveManager';
import {
  DARLINGS_DECK_SIZE,
  WARCHEST_DECK_SIZE,
  isBasicLand,
  landFetchExclusionError,
  validateWarchestDeckShape,
  validateLandReserve,
} from './warchest';
import type {
  LandReserveValidationOptions,
  WarchestDeckValidationOptions,
} from './warchest';

export type DarlingsFormat = 'constructed' | 'darlings' | 'warchest';
export type DeckFormat = DarlingsFormat;

export interface DarlingsDeckFields {
  format: DarlingsFormat;
  darlingId: string | null;
  landReserve: string[] | null;
}

function normalizeLandReserve(db: CardDb, format: DarlingsFormat, raw: unknown): string[] | null {
  if (format === 'constructed') return null;
  if (!Array.isArray(raw)) return [];

  const reserve: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    if (!db[value]) continue;
    reserve.push(value);
  }
  return reserve;
}

/** Normalize the v26 format fields while preserving the external Darling identity. */
export function normalizeDarlingsFields(
  db: CardDb,
  format: unknown,
  darlingId: unknown,
  cards: readonly string[],
  landReserve: unknown,
): DarlingsDeckFields {
  const normalizedFormat: DarlingsFormat =
    format === 'darlings' || format === 'warchest' ? format : 'constructed';
  const normalizedDarling = normalizedFormat === 'darlings' && typeof darlingId === 'string' && db[darlingId]
    ? darlingId
    : null;
  return {
    format: normalizedFormat,
    darlingId: normalizedDarling,
    landReserve: normalizeLandReserve(db, normalizedFormat, landReserve),
  };
}

function isLegendaryCreature(card: CardDef): boolean {
  return card.types.includes('creature') && (card.supertypes?.includes('legendary') ?? false);
}

/** The owned legendary-creature cards available to the Darling picker. */
export function listOwnedLegendaryCreatures(db: CardDb, save: SaveData): CardDef[] {
  return Object.values(db)
    .filter((card) => !card.token && isLegendaryCreature(card) && ownedCount(save, card.id) > 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function identityColors(card: CardDef): readonly Color[] {
  return card.types.includes('land') ? card.manaAbility ?? [] : card.colors;
}

/**
 * Return the player-facing identity error for one card, or null when the card
 * is permitted by the selected Darling. Basic lands are always permitted.
 */
export function darlingsCardError(
  db: CardDb,
  darlingId: string | null,
  cardId: string,
): string | null {
  if (!darlingId) return 'Choose a Darling before playing';
  const card = db[cardId];
  if (!card) return 'That card is not available';
  if (isBasicLand(card)) return null;

  const darling = db[darlingId];
  if (!darling) return 'Choose an owned legendary creature as your Darling';

  if (darling.colors.length === 0) {
    if (card.types.includes('land')) return `${card.name} is not allowed with a colorless Darling`;
    if (card.colors.length === 0) return null;
  }

  if (identityColors(card).some((color) => !darling.colors.includes(color))) {
    return `${card.name} is outside your Darling's colors`;
  }
  return null;
}

function addCardAuditIssue(issues: DeckIssue[], db: CardDb, id: string): void {
  const error = landFetchExclusionError(db, id);
  if (error) issues.push({ kind: 'error', message: error });
}

function addReserveIdentityIssues(
  issues: DeckIssue[],
  db: CardDb,
  darlingId: string | null,
  landReserve: readonly string[],
): void {
  if (!darlingId) return;
  for (const id of landReserve) {
    if (db[id]) {
      const identityError = darlingsCardError(db, darlingId, id);
      if (identityError) issues.push({ kind: 'error', message: identityError });
    }
  }
}

/** Validate a player-built Darlings deck and its 10-land reserve. */
export function validateDarlingsDeck(
  db: CardDb,
  save: SaveData,
  cards: readonly string[],
  darlingId: string | null,
  landReserve: readonly string[],
): DeckIssue[] {
  const issues: DeckIssue[] = [
    ...validateWarchestDeckShape(db, cards, DARLINGS_DECK_SIZE),
    ...validateLandReserve(db, save, landReserve),
  ];

  if (!darlingId) {
    issues.push({ kind: 'error', message: 'Choose a Darling before playing' });
  }

  const darling = darlingId ? db[darlingId] : undefined;
  const darlingIsOwnedLegendaryCreature =
    darlingId !== null &&
    darling !== undefined &&
    !darling.token &&
    ownedCount(save, darlingId) > 0 &&
    isLegendaryCreature(darling);
  if (darlingId && !darlingIsOwnedLegendaryCreature) {
    issues.push({ kind: 'error', message: 'Your Darling must be an owned legendary creature' });
  }
  if (darlingId && cards.includes(darlingId)) {
    issues.push({ kind: 'error', message: 'Your Darling must stay outside the deck' });
  }

  if (darlingId) addCardAuditIssue(issues, db, darlingId);

  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);

  for (const [id, count] of counts) {
    const card = db[id];
    if (!card) {
      issues.push({ kind: 'error', message: 'That card is not available' });
      continue;
    }
    if (card.types.includes('land')) continue;

    if (card.token) issues.push({ kind: 'error', message: `${card.name} is a token` });
    if (count > 1) {
      issues.push({ kind: 'error', message: `${card.name} may appear only once in a Darlings deck` });
    }
    if (count > ownedCount(save, id)) {
      issues.push({ kind: 'error', message: `${card.name} is not in your collection` });
    }
    addCardAuditIssue(issues, db, id);

    if (darlingId && darling) {
      const identityError = darlingsCardError(db, darlingId, id);
      if (identityError) issues.push({ kind: 'error', message: identityError });
    }
  }

  addReserveIdentityIssues(issues, db, darlingId, landReserve);
  return issues;
}

/** Validate a Warchest deck with Constructed copy and ownership limits. */
export function validateWarchestDeck(
  db: CardDb,
  save: SaveData,
  cards: readonly string[],
  landReserve: readonly string[],
  options: WarchestDeckValidationOptions = {},
): DeckIssue[] {
  const reserveOptions: LandReserveValidationOptions = options.maxReserveColors === undefined
    ? {}
    : { maxReserveColors: options.maxReserveColors, deck: cards };
  const issues: DeckIssue[] = [
    ...validateWarchestDeckShape(db, cards, options.deckSize),
    ...validateLandReserve(db, save, landReserve, reserveOptions),
  ];
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);

  for (const [id, count] of counts) {
    const card = db[id];
    if (!card) {
      issues.push({ kind: 'error', message: 'That card is not available' });
      continue;
    }
    if (card.types.includes('land')) continue;
    if (card.token) issues.push({ kind: 'error', message: `${card.name} is a token` });
    if (count > RULES.maxCopies) {
      issues.push({ kind: 'error', message: `${card.name}: ${count} copies (max ${RULES.maxCopies})` });
    }
    if (count > ownedCount(save, id)) {
      issues.push({
        kind: 'error',
        message: `${card.name}: ${count} in deck but only ${ownedCount(save, id)} owned`,
      });
    }
    addCardAuditIssue(issues, db, id);
  }
  return issues;
}

export { WARCHEST_DECK_SIZE, DARLINGS_DECK_SIZE };
