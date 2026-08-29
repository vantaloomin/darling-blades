import type { CardDb, CardDef, Color } from '../engine/types';
import { RULES } from '../config/rules';
import { ownedCount } from './Collection';
import type { DeckIssue } from './DeckStorage';
import type { SaveData } from './SaveManager';

export const WARCHEST_DECK_SIZE = 40;
/**
 * The reserve-format opener: Warchest (ratified 2026-08-07) and Darlings
 * (ratified 2026-08-08 from its own 5-vs-7 measurement) both deal 5. Classic
 * keeps RULES.startingHandSize = 7.
 */
export const WARCHEST_HAND_SIZE = 5;
/** Darlings carries its selected legendary creature outside this spell list. */
export const DARLINGS_DECK_SIZE = 79;
export const LAND_RESERVE_SIZE = 10;
export const MAX_DUAL_LANDS = 5;

const COLOR_ORDER: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];

/** Parameters used only by explicit Warchest tuning callers. */
export interface WarchestDeckValidationOptions {
  deckSize?: number;
  maxReserveColors?: number;
}

/**
 * A capped reserve must carry the deck it is validating so color containment
 * cannot be accidentally skipped. The absent-cap shape preserves existing
 * three-argument calls and their behavior.
 */
export type LandReserveValidationOptions =
  | { maxReserveColors?: undefined; deck?: never }
  | { maxReserveColors: number; deck: readonly string[] };

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

/** Non-token lands outside the basic/dual reserve vocabulary. */
export function isUtilityTapland(card: CardDef): boolean {
  return !card.token && isLand(card) && !isBasicLand(card) && !isDualLand(card);
}

function isAllowedReserveLand(card: CardDef): boolean {
  return isBasicLand(card) || isDualLand(card);
}

/** Distinct colors produced by valid reserve lands, in WUBRG order. */
export function reserveColorIdentity(db: CardDb, landReserve: readonly string[]): Color[] {
  const colors = new Set<Color>();
  for (const id of landReserve) {
    const card = db[id];
    if (!card || !isAllowedReserveLand(card)) continue;
    for (const color of card.manaAbility ?? []) {
      if (color !== 'C') colors.add(color);
    }
  }
  return COLOR_ORDER.filter((color) => colors.has(color));
}

function costColors(card: CardDef): Color[] {
  return COLOR_ORDER.filter((color) => (card.cost?.pips[color] ?? 0) > 0);
}

/** Validate the shared 10-card Warchest Reserves contract. */
export function validateLandReserve(
  db: CardDb,
  save: SaveData,
  landReserve: readonly string[],
  options: LandReserveValidationOptions = {},
): DeckIssue[] {
  const issues: DeckIssue[] = [];
  if (landReserve.length !== LAND_RESERVE_SIZE) {
    issues.push({
      kind: 'error',
      message: `Warchest Reserves need exactly ${LAND_RESERVE_SIZE} lands (currently ${landReserve.length})`,
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
        message: `${card.name}: ${count} copies in Warchest Reserves (max ${RULES.maxCopies})`,
      });
    }
    if (count > ownedCount(save, id)) {
      issues.push({
        kind: 'error',
        message: `${card.name}: ${count} in Warchest Reserves but only ${ownedCount(save, id)} owned`,
      });
    }
  }

  if (duals > MAX_DUAL_LANDS) {
    issues.push({
      kind: 'error',
      message: `Warchest Reserves may contain at most ${MAX_DUAL_LANDS} dual lands (currently ${duals})`,
    });
  }

  if (options.maxReserveColors !== undefined) {
    const reserveColors = reserveColorIdentity(db, landReserve);
    if (reserveColors.length > options.maxReserveColors) {
      issues.push({
        kind: 'error',
        message: `Warchest Reserves may contain at most ${options.maxReserveColors} colors (currently ${reserveColors.length})`,
      });
    }

    // The union type prevents this for TypeScript callers; retain a runtime
    // issue for malformed JavaScript or deserialized input instead of silently
    // skipping the deck-containment half of the capped rule.
    if (!Array.isArray(options.deck)) {
      issues.push({ kind: 'error', message: 'Capped Warchest validation requires the deck cards' });
    } else {
      const reserveColorSet = new Set(reserveColors);
      const checked = new Set<string>();
      for (const id of options.deck) {
        if (checked.has(id)) continue;
        checked.add(id);
        const card = db[id];
        if (!card) continue;
        const missing = costColors(card).filter((color) => !reserveColorSet.has(color));
        if (missing.length > 0) {
          issues.push({
            kind: 'error',
            message: `${card.name} has cost colors absent from its Warchest Reserves: ${missing.join('/')}`,
          });
        }
      }
    }
  }
  return issues;
}

/** Validate an all-spell Warchest-format deck shape at its required size. */
export function validateWarchestDeckShape(
  db: CardDb,
  cards: readonly string[],
  deckSize = WARCHEST_DECK_SIZE,
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
      message: 'Decks in this format hold no lands; build your Warchest instead',
    });
  }
  return issues;
}
