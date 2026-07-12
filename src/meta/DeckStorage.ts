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
    const d = def(db, id);
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
  deck: { id: string; name: string; cards: string[]; heroCardId?: string | null },
): void {
  const existing = save.decks.findIndex((d) => d.id === deck.id);
  const preservedHero = existing >= 0 ? save.decks[existing].heroCardId : null;
  const heroCardId = deck.heroCardId ?? preservedHero;
  const saved: SavedDeck = {
    id: deck.id,
    name: deck.name,
    cards: deck.cards,
    heroCardId: heroCardId && deck.cards.includes(heroCardId) ? heroCardId : null,
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
 * remaining deck (or null when none remain) — the invariant DuelScene/Gauntlet
 * rely on: activeDeckId always points to an existing deck, or is null.
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
  save.decks.push({ id, name: `${src.name} copy`, cards: [...src.cards], heroCardId: src.heroCardId });
  return id;
}

/** Rename a deck in place (no-op when the id is unknown). */
export function renameDeck(save: SaveData, deckId: string, name: string): void {
  const deck = save.decks.find((d) => d.id === deckId);
  if (deck) deck.name = name;
}
