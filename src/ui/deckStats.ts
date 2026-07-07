import type { CardDb, CardType, Color } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';

/**
 * Pure, Phaser-free deck aggregation for the builder's stats panel — the mana
 * curve, color-pip pie, and type counts. Kept out of the scene so it's
 * unit-testable and can be recomputed cheaply on every renderDeck. The deck
 * (card-id list) + the card DB are the sole inputs; no Services, no mutation.
 */

/** Curve buckets: mana value 0..6 each get a bucket, MV ≥ 7 collapses into index 7. */
export const CURVE_MAX = 7;
/** WUBRG order for the color pie. */
export const PIE_COLORS: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
/** Primary-type resolution order (creature-first, so an artifact creature counts as a creature). */
const TYPE_ORDER: readonly CardType[] = ['creature', 'charm', 'ritual', 'enchantment', 'artifact', 'land'];

export interface DeckStats {
  /** Length CURVE_MAX+1; NONLAND cards bucketed by mana value (index 7 = MV ≥ 7). */
  curve: number[];
  colorPips: Record<Color, number>;
  typeCounts: Record<CardType, number>;
  lands: number;
  nonlands: number;
}

export function computeDeckStats(deck: string[], db: CardDb): DeckStats {
  const curve = new Array<number>(CURVE_MAX + 1).fill(0);
  const colorPips: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const typeCounts: Record<CardType, number> = {
    creature: 0,
    charm: 0,
    ritual: 0,
    enchantment: 0,
    artifact: 0,
    land: 0,
  };
  let lands = 0;

  for (const id of deck) {
    const d = def(db, id);
    // Each card counts once under its primary type (creature-first).
    const primary = TYPE_ORDER.find((t) => isType(d, t)) ?? 'creature';
    typeCounts[primary]++;

    if (isType(d, 'land')) {
      lands++;
      continue; // lands have no mana value or pips — excluded from curve/pie
    }
    curve[Math.min(manaValue(d.cost), CURVE_MAX)]++;
    if (d.cost) {
      for (const [c, n] of Object.entries(d.cost.pips)) colorPips[c as Color] += n ?? 0;
    }
  }

  return { curve, colorPips, typeCounts, lands, nonlands: deck.length - lands };
}
