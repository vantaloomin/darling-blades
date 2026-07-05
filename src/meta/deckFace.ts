/**
 * Deck face-card picker — chooses the deterministic "commander" creature that
 * represents a deck when it has no hand-curated portrait.
 *
 * Sole consumer today is DuelScene (1a layout): the bottom-left
 * `CommanderPortrait` shows YOUR deck's face card, and the opponent strip's
 * avatar disc uses the AI deck's face card IN PRACTICE MODE only — gauntlet
 * avatars keep their hand-picked `Avatar.portraitCardId` (DuelScene prefers it
 * over this). Not wired to deck tiles or gauntlet portraits.
 *
 * PURE module (src/meta layer: no Phaser, no browser APIs). The card pool is
 * injected as a CardDb so tests can use tiny synthetic databases.
 */

import { def, isType, manaValue, type CardDb, type CardDef } from '../engine/types';
import { TIER_RANK } from './variants';

function isLegendary(d: CardDef): boolean {
  return d.supertypes?.includes('legendary') ?? false;
}

/**
 * Pick the deck's face card id, or null when the deck has no creatures known
 * to `db`. Unknown ids in the deck list are skipped, never thrown on.
 *
 * Preference: legendary creatures first; if the deck has none, all creatures.
 * Within the candidate pool, order by copy count desc, rarity tier desc
 * (TIER_RANK), mana value desc, then name asc / id asc for full determinism.
 */
export function faceCardFor(deck: readonly string[], db: CardDb): string | null {
  const counts = new Map<string, number>();
  for (const id of deck) {
    const d: CardDef | undefined = db[id];
    if (!d || !isType(d, 'creature')) continue; // skips unknown ids and non-creatures
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const ids = [...counts.keys()];
  const legendaries = ids.filter((id) => isLegendary(def(db, id)));
  const pool = legendaries.length > 0 ? legendaries : ids;

  pool.sort((a, b) => {
    const da = def(db, a);
    const dbCard = def(db, b);
    return (
      counts.get(b)! - counts.get(a)! || // copy count desc
      TIER_RANK[dbCard.rarity] - TIER_RANK[da.rarity] || // rarity desc
      manaValue(dbCard.cost) - manaValue(da.cost) || // mana value desc
      // Plain codepoint comparison (not localeCompare) so the winner never
      // depends on the host locale.
      (da.name < dbCard.name ? -1 : da.name > dbCard.name ? 1 : 0) || // name asc
      (a < b ? -1 : a > b ? 1 : 0) // id asc — total order
    );
  });
  return pool[0];
}
