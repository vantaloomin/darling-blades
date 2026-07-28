import { RULES } from '../config/rules';
import type { CardDb, CardDef } from '../engine/types';
import { ownedCount } from './Collection';
import type { DeckIssue } from './DeckStorage';
import type { SaveData } from './SaveManager';

export type DarlingsFormat = 'constructed' | 'darlings';

export interface DarlingsDeckFields {
  format: DarlingsFormat;
  darlingId: string | null;
}

/**
 * Normalize only the two Darlings metadata fields. This deliberately accepts
 * unknown input so the v23 save migration can keep malformed saves editable.
 * It has no hero-card fallback: a Darling is preserved only when the stored
 * format is Darlings and the id is still present in the deck.
 */
export function normalizeDarlingsFields(
  format: unknown,
  darlingId: unknown,
  cards: readonly string[],
): DarlingsDeckFields {
  const normalizedFormat: DarlingsFormat = format === 'darlings' ? 'darlings' : 'constructed';
  const normalizedDarling =
    normalizedFormat === 'darlings' && typeof darlingId === 'string' && cards.includes(darlingId)
      ? darlingId
      : null;
  return { format: normalizedFormat, darlingId: normalizedDarling };
}

function isLegendaryCreature(card: CardDef): boolean {
  return card.types.includes('creature') && (card.supertypes?.includes('legendary') ?? false);
}

function isBasic(card: CardDef): boolean {
  return card.types.includes('land') && (card.supertypes?.includes('basic') ?? false);
}

/** The owned legendary-creature cards available to the Darling picker. */
export function listOwnedLegendaryCreatures(db: CardDb, save: SaveData): CardDef[] {
  return Object.values(db)
    .filter((card) => !card.token && isLegendaryCreature(card) && ownedCount(save, card.id) > 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
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
  if (isBasic(card)) return null;

  const darling = db[darlingId];
  if (!darling) return 'Choose an owned legendary creature as your Darling';

  if (darling.colors.length === 0) {
    if (card.types.includes('land')) return `${card.name} is not allowed with a colorless Darling`;
    if (card.colors.length === 0) return null;
  }

  if (card.colors.some((color) => !darling.colors.includes(color))) {
    return `${card.name} is outside your Darling's colors`;
  }
  return null;
}

/**
 * Validate a player-built Darlings deck. The selected Darling is an ordinary
 * card in the 60-card list; this function adds no special zone or game rule.
 */
export function validateDarlingsDeck(
  db: CardDb,
  save: SaveData,
  cards: readonly string[],
  darlingId: string | null,
): DeckIssue[] {
  const issues: DeckIssue[] = [];
  if (cards.length !== RULES.deckSize) {
    issues.push({
      kind: 'error',
      message: `Darlings decks need exactly ${RULES.deckSize} cards (currently ${cards.length})`,
    });
  }

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
  if (darlingId && !cards.includes(darlingId)) {
    issues.push({ kind: 'error', message: 'Your Darling must be in the deck' });
  }

  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);

  for (const [id, count] of counts) {
    const card = db[id];
    if (!card) {
      issues.push({ kind: 'error', message: 'That card is not available' });
      continue;
    }

    if (card.token) issues.push({ kind: 'error', message: `${card.name} is a token` });

    if (!isBasic(card)) {
      if (count > 1) {
        issues.push({ kind: 'error', message: `${card.name} may appear only once in a Darlings deck` });
      }
      if (count > ownedCount(save, id) && id !== darlingId) {
        issues.push({ kind: 'error', message: `${card.name} is not in your collection` });
      }
    }

    if (darlingId && darling) {
      const identityError = darlingsCardError(db, darlingId, id);
      if (identityError) issues.push({ kind: 'error', message: identityError });
    }
  }

  return issues;
}
