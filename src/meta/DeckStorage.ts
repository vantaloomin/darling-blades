import { RULES } from '../config/rules';
import type { CardDb } from '../engine/types';
import { def } from '../engine/types';
import { isBasic, ownedCount } from './Collection';
import type { SaveData, SavedDeck } from './SaveManager';

export interface DeckIssue {
  kind: 'error' | 'warning';
  message: string;
}

export const LIMITED_DECK_SIZE = 40;

export type VariantPin = string | null;

/** The two positional arrays that must move together through every deck edit. */
export interface DeckSlots {
  cards: string[];
  variantPins: VariantPin[];
}

/** Return an independent, equal-length pair for a deck's positional slots. */
export function cloneDeckSlots(cards: readonly string[], variantPins?: readonly VariantPin[]): DeckSlots {
  return {
    cards: [...cards],
    variantPins: cards.map((_, index) => variantPins?.[index] ?? null),
  };
}

/** Append one card and its treatment pin without mutating the input pair. */
export function appendDeckSlot(slots: DeckSlots, cardId: string, variantPin: VariantPin = null): DeckSlots {
  const normalized = cloneDeckSlots(slots.cards, slots.variantPins);
  return {
    cards: [...normalized.cards, cardId],
    variantPins: [...normalized.variantPins, variantPin],
  };
}

/** Append several cards, assigning Auto to every new slot. */
export function appendDeckSlots(slots: DeckSlots, cardIds: readonly string[]): DeckSlots {
  return cardIds.reduce((current, cardId) => appendDeckSlot(current, cardId), cloneDeckSlots(slots.cards, slots.variantPins));
}

/** Change one treatment pin while preserving the card/pin pair as a unit. */
export function setDeckSlotVariant(slots: DeckSlots, index: number, variantPin: VariantPin): DeckSlots {
  const normalized = cloneDeckSlots(slots.cards, slots.variantPins);
  if (index < 0 || index >= normalized.cards.length) return normalized;
  normalized.variantPins[index] = variantPin;
  return normalized;
}

/** Remove one slot and its pin without mutating the input pair. */
export function removeDeckSlot(slots: DeckSlots, index: number): DeckSlots {
  const normalized = cloneDeckSlots(slots.cards, slots.variantPins);
  if (index < 0 || index >= normalized.cards.length) return normalized;
  return {
    cards: normalized.cards.filter((_, i) => i !== index),
    variantPins: normalized.variantPins.filter((_, i) => i !== index),
  };
}

/** Remove every slot for one card id while preserving all surviving pairs. */
export function removeAllDeckSlots(slots: DeckSlots, cardId: string): DeckSlots {
  const normalized = cloneDeckSlots(slots.cards, slots.variantPins);
  const kept = normalized.cards
    .map((id, index) => ({ id, pin: normalized.variantPins[index] }))
    .filter((slot) => slot.id !== cardId);
  return { cards: kept.map((slot) => slot.id), variantPins: kept.map((slot) => slot.pin) };
}

/** Sort a deck by card id while carrying each positional pin with its card. */
export function sortDeckSlots(
  slots: DeckSlots,
  compare: (left: string, right: string) => number,
): DeckSlots {
  const normalized = cloneDeckSlots(slots.cards, slots.variantPins);
  const paired = normalized.cards.map((cardId, index) => ({ cardId, pin: normalized.variantPins[index], index }));
  paired.sort((left, right) => compare(left.cardId, right.cardId) || left.index - right.index);
  return { cards: paired.map((slot) => slot.cardId), variantPins: paired.map((slot) => slot.pin) };
}

/** 60 cards, ≤4 copies (basics unlimited), owned, no tokens. */
export function validateDeck(
  db: CardDb,
  save: SaveData,
  cards: readonly string[],
): DeckIssue[] {
  const issues: DeckIssue[] = [];
  if (cards.length !== RULES.deckSize) {
    issues.push({ kind: 'error', message: `Deck has ${cards.length}/${RULES.deckSize} cards` });
  }
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);

  let lands = 0;
  let creatures = 0;
  for (const [id, n] of counts) {
    const d = db[id];
    if (!d) {
      issues.push({ kind: 'error', message: `That card is not available: ${id}` });
      continue;
    }
    if (d.token) issues.push({ kind: 'error', message: `${d.name} is a token` });
    if (!isBasic(db, id)) {
      if (n > RULES.maxCopies)
        issues.push({ kind: 'error', message: `${d.name}: ${n} copies (max ${RULES.maxCopies})` });
      if (n > ownedCount(save, id))
        issues.push({
          kind: 'error',
          message: `${d.name}: ${n} in deck but only ${ownedCount(save, id)} owned`,
        });
    }
    if (d.types.includes('land')) lands += n;
    if (d.types.includes('creature')) creatures += n;
  }
  if (cards.length === RULES.deckSize) {
    if (lands < 20) issues.push({ kind: 'warning', message: `Only ${lands} lands (22–26 is typical)` });
    if (creatures < 12)
      issues.push({ kind: 'warning', message: `Only ${creatures} creatures (combat wins games)` });
  }
  return issues;
}

/** 40 cards exactly, restricted to the limited pool; basics are free/unlimited. */
export function validateLimitedDeck(
  db: CardDb,
  pool: readonly string[],
  cards: readonly string[],
): DeckIssue[] {
  const issues: DeckIssue[] = [];
  if (cards.length !== LIMITED_DECK_SIZE) {
    issues.push({ kind: 'error', message: `Limited deck has ${cards.length}/${LIMITED_DECK_SIZE} cards` });
  }

  const poolCounts = new Map<string, number>();
  for (const id of pool) poolCounts.set(id, (poolCounts.get(id) ?? 0) + 1);
  const deckCounts = new Map<string, number>();
  for (const id of cards) deckCounts.set(id, (deckCounts.get(id) ?? 0) + 1);

  let lands = 0;
  let creatures = 0;
  for (const [id, n] of deckCounts) {
    const d = def(db, id);
    if (d.token) issues.push({ kind: 'error', message: `${d.name} is a token` });
    if (!isBasic(db, id) && n > (poolCounts.get(id) ?? 0)) {
      issues.push({
        kind: 'error',
        message: `${d.name}: ${n} in deck but only ${poolCounts.get(id) ?? 0} in pool`,
      });
    }
    if (d.types.includes('land')) lands += n;
    if (d.types.includes('creature')) creatures += n;
  }
  if (cards.length === LIMITED_DECK_SIZE) {
    if (lands < 14 || lands > 20) issues.push({ kind: 'warning', message: `${lands} lands - 16-18 is typical` });
    if (creatures < 10) issues.push({ kind: 'warning', message: `${creatures} creatures - combat wins games` });
  }
  return issues;
}

export function saveDeck(
  save: SaveData,
  deck: {
    id: string;
    name: string;
    cards: readonly string[];
    heroCardId?: string | null;
    format?: SavedDeck['format'];
    darlingId?: string | null;
    landReserve?: readonly string[] | null;
    variantPins?: readonly VariantPin[];
  },
): void {
  const existing = save.decks.findIndex((d) => d.id === deck.id);
  const previous = existing >= 0 ? save.decks[existing] : null;
  const preservedHero = existing >= 0 ? save.decks[existing].heroCardId : null;
  const heroCardId = deck.heroCardId ?? preservedHero;
  const slots = cloneDeckSlots(deck.cards, deck.variantPins);
  const saved: SavedDeck = {
    id: deck.id,
    name: deck.name,
    cards: slots.cards,
    heroCardId: heroCardId && slots.cards.includes(heroCardId) ? heroCardId : null,
    landStyle: previous?.landStyle
      ? { ...previous.landStyle }
      : null,
    format: deck.format ?? previous?.format ?? 'constructed',
    darlingId: deck.darlingId !== undefined ? deck.darlingId : previous?.darlingId ?? null,
    landReserve: deck.landReserve !== undefined
      ? deck.landReserve
        ? [...deck.landReserve]
        : null
      : previous?.landReserve
        ? [...previous.landReserve]
        : null,
    variantPins: slots.variantPins,
  };
  if (existing >= 0) save.decks[existing] = saved;
  else save.decks.push(saved);
}

/** A deck id not already used in save.decks (deck-1, deck-2, … skipping collisions). */
export function generateDeckId(save: SaveData): string {
  const taken = new Set(save.decks.map((d) => d.id));
  let n = save.decks.length + 1;
  while (taken.has(`deck-${n}`)) n++;
  return `deck-${n}`;
}

/**
 * Delete a deck by id. If it was the active deck, reassign activeDeckId to a
 * remaining deck (or null when none remain). Explicit deletion is the only
 * validity-adjacent flow that reassigns this id: an invalid deck stays active
 * so the player can repair it in place. DuelScene/Gauntlet rely on the narrower
 * invariant that activeDeckId always points to an existing deck, or is null.
 */
export function deleteDeck(save: SaveData, deckId: string): void {
  save.decks = save.decks.filter((d) => d.id !== deckId);
  if (save.activeDeckId === deckId) save.activeDeckId = save.decks[0]?.id ?? null;
}

/** Copy a deck: a fresh id + deep-cloned card list + "… copy" name. Returns the new id (null if the source is gone). */
export function copyDeck(save: SaveData, deckId: string): string | null {
  const src = save.decks.find((d) => d.id === deckId);
  if (!src) return null;
  const id = generateDeckId(save);
  save.decks.push({
    id,
    name: `${src.name} copy`,
    cards: [...src.cards],
    heroCardId: src.heroCardId,
    landStyle: src.landStyle ? { ...src.landStyle } : null,
    format: src.format ?? 'constructed',
    darlingId: src.darlingId ?? null,
    landReserve: src.landReserve ? [...src.landReserve] : null,
    variantPins: cloneDeckSlots(src.cards, src.variantPins).variantPins,
  });
  return id;
}

/** Rename a deck in place (no-op when the id is unknown). */
export function renameDeck(save: SaveData, deckId: string, name: string): void {
  const deck = save.decks.find((d) => d.id === deckId);
  if (deck) deck.name = name;
}
