/**
 * Pure hand-ordering math for the duel scene's hand fan.
 *
 * The hand is auto-organized for readability WITHOUT ever mutating the engine's
 * canonical hand array — that array is seeded/deterministic and its indices are
 * the `handIndex` the engine's playLand/castSpell actions address. Instead this
 * returns a permutation of hand indices describing the left-to-right DISPLAY
 * order; syncHand() renders in that order while still clicking each card by its
 * true engine hand index, so legality and determinism are untouched.
 *
 * Sort priority (user-specified: "Land → Lowest Cost → Like colors together"):
 *   1. Lands first (all lands cluster on the left).
 *   2. Then lowest mana value first (cheapest spells nearest the lands).
 *   3. Then "like colors together" — same color identity clusters as a
 *      tiebreak, so equal-cost cards of one color sit adjacent.
 * A final (name, original-index) tiebreak keeps the order deterministic and
 * stable, so identical cards never jitter position between syncs.
 *
 * PURE module: no Phaser, no browser APIs, no side effects — importable from
 * Vitest and from any layer.
 */
import type { CardDb, CardDef, Color } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';

const COLOR_RANK: Record<Color, number> = { W: 0, U: 1, B: 2, R: 3, G: 4 };

/**
 * A numeric key that clusters "like colors together":
 *   - monocolor cards sort in canonical WUBRG order (0–4);
 *   - multicolor cards group together AFTER the monocolor cards, with an
 *     identical color set sharing a key so gold cards of the same pair stay
 *     adjacent;
 *   - colorless cards sort last.
 * Lands print no color identity (basics are colorless in the pie), so a land
 * clusters by the colors it TAPS for instead — grouping Plains, Islands, and
 * each dual pair with their own kind.
 */
export function colorClusterKey(d: CardDef): number {
  const colors: readonly Color[] =
    isType(d, 'land') && d.colors.length === 0 && d.manaAbility && d.manaAbility.length > 0
      ? d.manaAbility
      : d.colors;
  if (colors.length === 0) return 999; // colorless / no mana identity: last
  if (colors.length === 1) return COLOR_RANK[colors[0]]; // 0..4
  let mask = 0;
  for (const c of colors) mask |= 1 << COLOR_RANK[c];
  return 5 + mask; // multicolor: after monocolor; identical sets share a key
}

/**
 * The display order (a permutation of hand indices, left → right) for a hand.
 * Deterministic and stable; never mutates the input array.
 */
export function handDisplayOrder(hand: readonly string[], db: CardDb): number[] {
  return hand
    .map((cardId, idx) => ({ idx, d: def(db, cardId) }))
    .sort((a, b) => {
      const landA = isType(a.d, 'land') ? 0 : 1;
      const landB = isType(b.d, 'land') ? 0 : 1;
      if (landA !== landB) return landA - landB; // 1. lands first
      const mvA = manaValue(a.d.cost);
      const mvB = manaValue(b.d.cost);
      if (mvA !== mvB) return mvA - mvB; // 2. lowest cost first
      const ckA = colorClusterKey(a.d);
      const ckB = colorClusterKey(b.d);
      if (ckA !== ckB) return ckA - ckB; // 3. like colors together
      if (a.d.name !== b.d.name) return a.d.name < b.d.name ? -1 : 1;
      return a.idx - b.idx; // stable: identical cards keep a fixed order
    })
    .map((e) => e.idx);
}
