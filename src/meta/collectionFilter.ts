import type { CardDef, CardType, Color, Rarity } from '../engine/types';
import { manaValue } from '../engine/types';
import { ownedCount, ownedVariants } from './Collection';
import type { SaveData } from './SaveManager';
import {
  isPlainVariant,
  parseVariantKey,
  TIER_RANK,
  variantRank,
  type CardVariant,
} from './variants';

/**
 * Pure, headless filter / sort / paging helpers behind the Collection binder
 * (src/scenes/CollectionScene.ts). No Phaser, no browser APIs — everything a
 * unit test drives directly (tests/meta/collectionFilter.test.ts).
 */

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type SortMode = 'rarity' | 'mana' | 'name';

export const SORT_LABEL: Record<SortMode, string> = {
  rarity: 'Rarity',
  mana: 'Mana',
  name: 'Name',
};

const SORT_CYCLE: readonly SortMode[] = ['rarity', 'mana', 'name'];

/** The sort control cycles rarity → mana → name → rarity. */
export function nextSortMode(mode: SortMode): SortMode {
  return SORT_CYCLE[(SORT_CYCLE.indexOf(mode) + 1) % SORT_CYCLE.length];
}

/** Final tiebreak on every sorter — page layouts stay deterministic. */
function byName(a: CardDef, b: CardDef): number {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

const SORTERS: Record<SortMode, (a: CardDef, b: CardDef) => number> = {
  // Default binder order: best tier first, then cheap-to-expensive, then name.
  rarity: (a, b) =>
    TIER_RANK[b.rarity] - TIER_RANK[a.rarity] ||
    manaValue(a.cost) - manaValue(b.cost) ||
    byName(a, b),
  // Lands have no cost → mana value 0, so they lead this ordering.
  mana: (a, b) => manaValue(a.cost) - manaValue(b.cost) || byName(a, b),
  name: byName,
};

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** One facet per axis; facets combine with AND. */
export interface CollectionFilterState {
  color: Color | 'all';
  type: CardType | 'all';
  rarity: Rarity | 'all';
  ownedOnly: boolean;
  sort: SortMode;
}

export function defaultFilterState(): CollectionFilterState {
  return { color: 'all', type: 'all', rarity: 'all', ownedOnly: false, sort: 'rarity' };
}

/** The collectible pool: no tokens, no basic lands (matches the pack pools). */
export function collectiblePool(cards: readonly CardDef[]): CardDef[] {
  return cards.filter((d) => !d.token && !d.supertypes?.includes('basic'));
}

/** Apply all facets (AND) and the active sort. Never mutates `cards`. */
export function applyFilters(
  cards: readonly CardDef[],
  state: CollectionFilterState,
  save: SaveData,
): CardDef[] {
  return cards
    .filter(
      (d) =>
        (state.color === 'all' || d.colors.includes(state.color)) &&
        (state.type === 'all' || d.types.includes(state.type)) &&
        (state.rarity === 'all' || d.rarity === state.rarity) &&
        (!state.ownedOnly || ownedCount(save, d.id) > 0),
    )
    .sort(SORTERS[state.sort]);
}

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------

/** Number of binder spreads for `total` cards; never 0 (an empty binder is 1 page). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Clamp a page index into the valid range for `total` cards. */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(0, page), pageCount(total, pageSize) - 1);
}

/** The items visible on one page (the last page may be partial). */
export function pageSlice<T>(items: readonly T[], page: number, pageSize: number): T[] {
  return items.slice(page * pageSize, (page + 1) * pageSize);
}

// ---------------------------------------------------------------------------
// Variant summaries (binder badges + inspect panel)
// ---------------------------------------------------------------------------

/** Copies owned in any SPECIAL (non-plain) variant — the binder's ✦ badge. */
export function specialVariantCount(save: SaveData, cardId: string): number {
  let n = 0;
  for (const [key, count] of Object.entries(ownedVariants(save, cardId))) {
    if (count > 0 && !isPlainVariant(parseVariantKey(key))) n += count;
  }
  return n;
}

export interface OwnedVariantEntry {
  variant: CardVariant;
  count: number;
}

/** All owned variants of a card, most special first (variants.ts ranking). */
export function ownedVariantEntries(save: SaveData, cardId: string): OwnedVariantEntry[] {
  return Object.entries(ownedVariants(save, cardId))
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ variant: parseVariantKey(key), count }))
    .sort((a, b) => variantRank(b.variant) - variantRank(a.variant));
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Display name for a variant — title-case sibling of the pack reveal's
 * 'GOLD FRAME · VOID' callout. Plain is 'Standard'.
 */
export function variantLabel(v: CardVariant): string {
  if (isPlainVariant(v)) return 'Standard';
  const parts: string[] = [];
  if (v.frame !== 'white') parts.push(`${cap(v.frame)} Frame`);
  if (v.holo !== 'none') parts.push(cap(v.holo));
  return parts.join(' · ');
}
