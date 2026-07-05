import { RULES } from '../config/rules';
import type { CardDb } from '../engine/types';
import { def } from '../engine/types';
import { isBasic, ownedCount } from './Collection';
import type { SaveData } from './SaveManager';

export interface DeckIssue {
  kind: 'error' | 'warning';
  message: string;
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
    if (lands < 20) issues.push({ kind: 'warning', message: `Only ${lands} lands — 22–26 is typical` });
    if (creatures < 12)
      issues.push({ kind: 'warning', message: `Only ${creatures} creatures — combat wins games` });
  }
  return issues;
}

export function saveDeck(
  save: SaveData,
  deck: { id: string; name: string; cards: string[] },
): void {
  const existing = save.decks.findIndex((d) => d.id === deck.id);
  if (existing >= 0) save.decks[existing] = deck;
  else save.decks.push(deck);
}
