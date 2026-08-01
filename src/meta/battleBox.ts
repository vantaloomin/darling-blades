import type { CardDb, CardDef, EffectOp } from '../engine/types';
import { RULES } from '../config/rules';
import { ownedCount } from './Collection';
import type { DeckIssue } from './DeckStorage';
import type { SaveData } from './SaveManager';

export const BATTLE_BOX_DECK_SIZE = 50;
export const DARLINGS_DECK_SIZE = 80;
export const LAND_RESERVE_SIZE = 10;
export const MAX_DUAL_LANDS = 5;

function isLand(card: CardDef): boolean {
  return card.types.includes('land');
}

export function isBasicLand(card: CardDef): boolean {
  return isLand(card) && (card.supertypes?.includes('basic') ?? false);
}

/** A land that can produce more than one distinct color is a dual. */
export function isDualLand(card: CardDef): boolean {
  return isLand(card) && new Set(card.manaAbility ?? []).size > 1;
}

function isAllowedReserveLand(card: CardDef): boolean {
  return isBasicLand(card) || isDualLand(card);
}

/** Validate the shared 10-card land reserve contract. */
export function validateLandReserve(
  db: CardDb,
  save: SaveData,
  landReserve: readonly string[],
): DeckIssue[] {
  const issues: DeckIssue[] = [];
  if (landReserve.length !== LAND_RESERVE_SIZE) {
    issues.push({
      kind: 'error',
      message: `Land reserves need exactly ${LAND_RESERVE_SIZE} lands (currently ${landReserve.length})`,
    });
  }

  let duals = 0;
  const dualCounts = new Map<string, number>();
  for (const id of landReserve) {
    const card = db[id];
    if (!card) {
      issues.push({ kind: 'error', message: 'That card is not available' });
      continue;
    }
    if (!isAllowedReserveLand(card)) {
      issues.push({ kind: 'error', message: `${card.name} is not a basic land or dual land` });
      continue;
    }
    if (isDualLand(card)) {
      duals++;
      dualCounts.set(id, (dualCounts.get(id) ?? 0) + 1);
    }
  }

  for (const [id, count] of dualCounts) {
    const card = db[id];
    if (!card) continue;
    if (count > RULES.maxCopies) {
      issues.push({
        kind: 'error',
        message: `${card.name}: ${count} copies in land reserve (max ${RULES.maxCopies})`,
      });
    }
    if (count > ownedCount(save, id)) {
      issues.push({
        kind: 'error',
        message: `${card.name}: ${count} in land reserve but only ${ownedCount(save, id)} owned`,
      });
    }
  }

  if (duals > MAX_DUAL_LANDS) {
    issues.push({
      kind: 'error',
      message: `Land reserves may contain at most ${MAX_DUAL_LANDS} dual lands (currently ${duals})`,
    });
  }
  return issues;
}

/** Validate an all-spell reserve-format deck shape at its format's required size. */
export function validateBattleBoxDeckShape(
  db: CardDb,
  cards: readonly string[],
  deckSize = BATTLE_BOX_DECK_SIZE,
): DeckIssue[] {
  const issues: DeckIssue[] = [];
  if (cards.length !== deckSize) {
    issues.push({
      kind: 'error',
      message: `Reserve-format decks need exactly ${deckSize} cards (currently ${cards.length})`,
    });
  }
  if (cards.some((id) => db[id]?.types.includes('land'))) {
    issues.push({
      kind: 'error',
      message: 'Decks in this format hold no lands; build your land reserve instead',
    });
  }
  return issues;
}

function opsFetchLand(ops: readonly EffectOp[] | undefined): boolean {
  return ops?.some((op) => op.op === 'fetchLand') ?? false;
}

/** Whether any data-authored effect on this card fetches a land. */
export function hasLandFetchBehavior(card: CardDef): boolean {
  return (
    card.abilities?.some((ability) => opsFetchLand(ability.ops)) === true ||
    card.chapters?.some((chapter) => opsFetchLand(chapter)) === true ||
    opsFetchLand(card.empower?.ops) ||
    opsFetchLand(card.retell?.ops)
  );
}

/** The current card-pool audit, returned as deterministic card ids. */
export function auditLandFetchCards(db: CardDb): string[] {
  return Object.values(db)
    .filter(hasLandFetchBehavior)
    .map((card) => card.id)
    .sort((a, b) => a.localeCompare(b));
}

/** Builder-facing error for a card excluded because its land fetch is dead. */
export function landFetchExclusionError(db: CardDb, cardId: string): string | null {
  const card = db[cardId];
  return card && hasLandFetchBehavior(card)
    ? `${card.name} cannot find lands here; your lands live in your reserve.`
    : null;
}

// Descriptive aliases keep the audit seam easy to discover from either term.
export const isLandFetchCard = hasLandFetchBehavior;
export const findLandFetchCards = auditLandFetchCards;
export const landInteractionError = landFetchExclusionError;
