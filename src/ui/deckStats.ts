import type { CardDb, CardType, Color } from '../engine/types';
import { isType, manaValue } from '../engine/types';

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
  let knownCards = 0;

  for (const id of deck) {
    const d = db[id];
    if (!d) continue;
    knownCards++;
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

  return { curve, colorPips, typeCounts, lands, nonlands: knownCards - lands };
}

/** One bar of a rendered mana curve, in the caller's design-space pixels. */
export interface CurveBar {
  /** Curve bucket: 0..CURVE_MAX, where CURVE_MAX means "that mana value or more". */
  mv: number;
  /** Bar centre. */
  x: number;
  /** Height in px, growing UPWARD from the baseline. */
  height: number;
  count: number;
  /** Axis label: the mana value, or "7+" for the collapsing bucket. */
  label: string;
}

export interface CurveBarOptions {
  /** Centre of the mana-value-0 bar. */
  firstX: number;
  /** Centre-to-centre spacing. */
  pitch: number;
  /** Height of the tallest bar. */
  maxHeight: number;
  /** Height of an EMPTY bucket, drawn as a baseline stub. Default 2. */
  emptyHeight?: number;
  /** Floor for a non-empty bucket so a count of 1 is still visible. Default 3. */
  minHeight?: number;
}

/**
 * Bar geometry for a mana curve, scaled so the tallest bucket is `maxHeight`.
 *
 * Shared because the constructed builder and the Limited builder draw the same
 * chart in differently-sized panels, and a draft deck needs a curve as much as
 * a constructed one does (it had none at all until 2026-08-25).
 */
export function curveBars(curve: readonly number[], opts: CurveBarOptions): CurveBar[] {
  const emptyHeight = opts.emptyHeight ?? 2;
  const minHeight = opts.minHeight ?? 3;
  const maxCount = Math.max(1, ...curve);
  return curve.map((count, mv) => ({
    mv,
    x: opts.firstX + mv * opts.pitch,
    height: count > 0
      ? Math.max(minHeight, Math.round((count / maxCount) * opts.maxHeight))
      : emptyHeight,
    count,
    label: mv >= CURVE_MAX ? `${CURVE_MAX}+` : `${mv}`,
  }));
}

/**
 * The one-line "what is in this deck" summary under a curve: type counts, then
 * the colour pips that decide whether the Warchest can cast any of it.
 */
export function deckShapeLine(stats: DeckStats, options: { lands: boolean }): string {
  const other = stats.nonlands - stats.typeCounts.creature;
  const pips = PIE_COLORS.filter((c) => stats.colorPips[c] > 0)
    .map((c) => `${c}·${stats.colorPips[c]}`)
    .join(' ');
  const counts = options.lands
    ? `${stats.typeCounts.creature} creatures · ${stats.lands} lands · ${other} other`
    : `${stats.typeCounts.creature} creatures · ${other} other`;
  return `${counts}   ${pips || 'colorless'}`;
}
