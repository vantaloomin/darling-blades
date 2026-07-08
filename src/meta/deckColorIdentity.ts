import type { CardDb, Color } from '../engine/types';
import { isType } from '../engine/types';

export type DeckColorStyle = 'mono' | 'dual' | 'other';

const COLOR_ORDER: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];

/**
 * Color identity for achievement purposes: nonland card colors only. Mana
 * fixing lands do not make a mono-color deck count as dual-color.
 */
export function deckColorIdentity(deck: readonly string[], db: CardDb): Color[] {
  const colors = new Set<Color>();
  for (const id of deck) {
    const card = db[id];
    if (!card || isType(card, 'land')) continue;
    for (const color of card.colors) colors.add(color);
  }
  return COLOR_ORDER.filter((color) => colors.has(color));
}

export function deckColorStyle(deck: readonly string[], db: CardDb): DeckColorStyle {
  const colors = deckColorIdentity(deck, db);
  if (colors.length === 1) return 'mono';
  if (colors.length === 2) return 'dual';
  return 'other';
}
