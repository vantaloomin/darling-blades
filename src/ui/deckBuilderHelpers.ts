import { ownedCount, ownedVariants } from '../meta/Collection';
import { ownedVariantEntries, variantLabel } from '../meta/collectionFilter';
import type { SavedDeck } from '../meta/SaveManager';
import { variantKey, type CardVariant } from '../meta/variants';

export type BuilderFormat = NonNullable<SavedDeck['format']>;

export const BATTLE_BOX_RULES_COPY =
  'Build your land reserve: 10 lands, up to 5 dual lands. Each turn you choose which land to play. Dual lands arrive tapped. If a dual land is destroyed it is gone; destroyed basic lands return to your reserve.';

export const DARLINGS_RULES_COPY =
  'Choose your Darling. Build a 50-card deck in her colors, one copy of each card, and a land reserve of 10. Your Darling begins in your deck and follows the same rules as every other card.';

export function formatLabel(format: BuilderFormat): string {
  if (format === 'darlings') return 'Darlings';
  if (format === 'battlebox') return 'Battle Box';
  return 'Constructed';
}

export function formatDeckSize(format: BuilderFormat): number {
  return format === 'constructed' ? 60 : 50;
}

export function formatRulesCopy(format: BuilderFormat): string | null {
  if (format === 'darlings') return DARLINGS_RULES_COPY;
  if (format === 'battlebox') return BATTLE_BOX_RULES_COPY;
  return null;
}

/** Reserve formats are valid in Practice, but the Gauntlet remains classic-only. */
export function formatGauntletUnavailableCopy(format: BuilderFormat): string | null {
  if (format === 'darlings') return 'Darlings decks are available in Practice only.';
  if (format === 'battlebox') return 'Battle Box decks are available in Practice only.';
  return null;
}

export interface DeckBuilderWorkingState {
  cards: readonly string[];
  variantPins: readonly (string | null)[];
  landReserve: readonly string[];
  heroCardId: string | null;
}

/** Compare every editable deck slot against the last saved deck record. */
export function isDeckBuilderDirty(
  working: DeckBuilderWorkingState,
  saved: Pick<SavedDeck, 'cards' | 'variantPins' | 'landReserve' | 'heroCardId'> | null,
): boolean {
  if (!saved) return working.cards.length > 0 || working.landReserve.length > 0 || working.heroCardId !== null;
  const savedPins = saved.cards.map((_, index) => saved.variantPins?.[index] ?? null);
  const savedReserve = saved.landReserve ?? [];
  return !sameArray(working.cards, saved.cards)
    || !sameArray(working.variantPins, savedPins)
    || !sameArray(working.landReserve, savedReserve)
    || working.heroCardId !== (saved.heroCardId ?? null);
}

function sameArray(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function formatPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

export function formatPageSlice<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const size = Math.max(1, pageSize);
  return items.slice(Math.max(0, page) * size, (Math.max(0, page) + 1) * size);
}

export interface GridPosition {
  x: number;
  y: number;
}

export function gridPosition(
  index: number,
  columns: number,
  originX: number,
  originY: number,
  gapX: number,
  gapY: number,
): GridPosition {
  const safeColumns = Math.max(1, columns);
  const safeIndex = Math.max(0, index);
  return {
    x: originX + (safeIndex % safeColumns) * gapX,
    y: originY + Math.floor(safeIndex / safeColumns) * gapY,
  };
}

export interface VariantPickerChoice {
  key: string | null;
  label: string;
  remainingCopies: number;
  variant: CardVariant | null;
}

/** Remaining owned copies for a slot, excluding pins on the slot itself. */
export function remainingVariantCopies(
  save: Parameters<typeof ownedVariants>['0'],
  cards: readonly string[],
  variantPins: readonly (string | null)[],
  slotIndex: number,
  cardId: string,
  variant: CardVariant,
): number {
  const key = variantKey(variant);
  const usedByOtherSlots = cards.reduce(
    (count, id, index) =>
      id === cardId && index !== slotIndex && variantPins[index] === key ? count + 1 : count,
    0,
  );
  return Math.max(0, (ownedVariants(save, cardId)[key] ?? 0) - usedByOtherSlots);
}

export function autoVariantRemainingCopies(
  save: Parameters<typeof ownedVariants>['0'],
  cards: readonly string[],
  variantPins: readonly (string | null)[],
  slotIndex: number,
  cardId: string,
): number {
  const pinnedByOtherSlots = cards.reduce(
    (count, id, index) =>
      id === cardId && index !== slotIndex && variantPins[index] !== null ? count + 1 : count,
    0,
  );
  return Math.max(0, ownedCount(save, cardId) - pinnedByOtherSlots);
}

/** Auto plus every owned treatment, with counts available to this slot. */
export function variantPickerChoices(
  save: Parameters<typeof ownedVariants>['0'],
  cards: readonly string[],
  variantPins: readonly (string | null)[],
  slotIndex: number,
  cardId: string,
): VariantPickerChoice[] {
  return [
    {
      key: null,
      label: 'Auto',
      remainingCopies: autoVariantRemainingCopies(save, cards, variantPins, slotIndex, cardId),
      variant: null,
    },
    ...ownedVariantEntries(save, cardId).map(({ variant }) => ({
      key: variantKey(variant),
      label: variantLabel(variant),
      remainingCopies: remainingVariantCopies(save, cards, variantPins, slotIndex, cardId, variant),
      variant,
    })),
  ];
}
