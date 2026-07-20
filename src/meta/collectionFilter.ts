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
  set: 'base' | 'ragnarok' | 'celtic-fae' | 'arthurian-court' | 'gothic-monsters' | 'all';
  ownedOnly: boolean;
  /** Free-text search over name / type / subtype / keyword (F8); '' = no filter. */
  search: string;
  sort: SortMode;
}

export function defaultFilterState(): CollectionFilterState {
  return { color: 'all', type: 'all', rarity: 'all', set: 'all', ownedOnly: false, search: '', sort: 'rarity' };
}

/**
 * Case-insensitive substring match over a card's structured text: name, card
 * types, subtypes, and keyword enum values (e.g. "fly" hits flying, "beast" hits
 * a Beastkin). CardDef has no stored oracle text — rules text is generated in
 * the Phaser UI layer — so full rules-text search is out of scope for this pure
 * layer; structured-field search covers the common lookups.
 */
export function matchesSearch(d: CardDef, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return (
    d.name.toLowerCase().includes(q) ||
    d.types.some((t) => t.includes(q)) ||
    d.subtypes.some((s) => s.toLowerCase().includes(q)) ||
    (d.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false)
  );
}

/** The collectible pool: no tokens, no basic lands (matches the pack pools). */
export function collectiblePool(cards: readonly CardDef[]): CardDef[] {
  return cards.filter((d) => !d.token && !d.supertypes?.includes('basic'));
}

export const COLOR_ORDER: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
export const RARITY_ORDER: readonly Rarity[] = ['c', 'r', 'sr', 'ssr', 'ur'];

export interface CompletionEntry<T extends string> {
  key: T;
  owned: number;
  total: number;
  percent: number;
}

export interface VariantCompletionSummary {
  specialCards: number;
  specialCopies: number;
  specialVariants: number;
  blackFrameCards: number;
  voidHoloCards: number;
}

export interface CollectionCompletionSummary {
  owned: number;
  total: number;
  percent: number;
  byColor: CompletionEntry<Color>[];
  byRarity: CompletionEntry<Rarity>[];
  variants: VariantCompletionSummary;
}

function percent(owned: number, total: number): number {
  return total === 0 ? 0 : owned / total;
}

/**
 * Completion math for profile/achievements/collection UI. A card counts owned
 * once the player owns any variant. Color rows count multicolor cards in each
 * of their colors; colorless cards are excluded from color rows but still count
 * toward total and rarity completion.
 */
export function collectionCompletion(
  cards: readonly CardDef[],
  save: SaveData,
): CollectionCompletionSummary {
  const pool = collectiblePool(cards);
  const ownedCard = (id: string): boolean => ownedCount(save, id) > 0;

  const owned = pool.filter((d) => ownedCard(d.id)).length;
  const byColor = COLOR_ORDER.map((key) => {
    const colorPool = pool.filter((d) => d.colors.includes(key));
    const colorOwned = colorPool.filter((d) => ownedCard(d.id)).length;
    return { key, owned: colorOwned, total: colorPool.length, percent: percent(colorOwned, colorPool.length) };
  });
  const byRarity = RARITY_ORDER.map((key) => {
    const rarityPool = pool.filter((d) => d.rarity === key);
    const rarityOwned = rarityPool.filter((d) => ownedCard(d.id)).length;
    return { key, owned: rarityOwned, total: rarityPool.length, percent: percent(rarityOwned, rarityPool.length) };
  });

  let specialCards = 0;
  let specialCopies = 0;
  let specialVariants = 0;
  let blackFrameCards = 0;
  let voidHoloCards = 0;
  for (const d of pool) {
    let hasSpecial = false;
    let hasBlack = false;
    let hasVoid = false;
    for (const [key, count] of Object.entries(ownedVariants(save, d.id))) {
      if (count <= 0) continue;
      const variant = parseVariantKey(key);
      if (!isPlainVariant(variant)) {
        hasSpecial = true;
        specialCopies += count;
        specialVariants++;
      }
      if (variant.frame === 'black') hasBlack = true;
      if (variant.holo === 'void') hasVoid = true;
    }
    if (hasSpecial) specialCards++;
    if (hasBlack) blackFrameCards++;
    if (hasVoid) voidHoloCards++;
  }

  return {
    owned,
    total: pool.length,
    percent: percent(owned, pool.length),
    byColor,
    byRarity,
    variants: { specialCards, specialCopies, specialVariants, blackFrameCards, voidHoloCards },
  };
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
        (state.set === 'all' || (d.set ?? 'base') === state.set) &&
        (!state.ownedOnly || ownedCount(save, d.id) > 0) &&
        matchesSearch(d, state.search),
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
  if (v.fullArt) parts.push('Full Art');
  if (v.frame !== 'white') parts.push(`${cap(v.frame)} Frame`);
  if (v.holo !== 'none') parts.push(cap(v.holo));
  return parts.join(' · ');
}
