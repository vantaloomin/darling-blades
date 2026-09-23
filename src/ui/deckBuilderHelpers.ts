import type { DeckIssue } from '../meta/DeckStorage';
import { DARLINGS_DECK_SIZE, WARCHEST_DECK_SIZE } from '../meta/warchest';
import type { SavedDeck } from '../meta/SaveManager';

export type BuilderFormat = NonNullable<SavedDeck['format']>;

// Standard (the warchest format id) leads every format offer; Darlings is the
// specialty format (owner order, 2026-08-18).
const ALL_BUILDER_FORMATS: readonly BuilderFormat[] = ['constructed', 'warchest', 'darlings'];

/**
 * The format choices the builder may expose for this release.
 *
 * After classic retirement Constructed leaves this list, so no NEW deck can be
 * built classic and no deck can be switched back to it. An existing classic
 * deck keeps its persisted format and stays openable; the two remaining
 * buttons are its conversion affordance.
 */
export function offeredBuilderFormats(
  reserveFormatsEnabled: boolean,
  classicRetired: boolean,
): BuilderFormat[] {
  if (!reserveFormatsEnabled) return ['constructed'];
  return classicRetired
    ? ALL_BUILDER_FORMATS.filter((format) => format !== 'constructed')
    : [...ALL_BUILDER_FORMATS];
}

/**
 * The format a builder with no saved deck drafts in: the first offered format,
 * the same one the New Deck prompt leads with. A deckless builder (every deck
 * deleted) used to fall back to Constructed unconditionally, which after
 * classic retirement drafted a deck that could never be saved, under a red
 * "Classic" label, while the format tabs answered "Save your deck first".
 */
export function newDeckFormat(reserveFormatsEnabled: boolean, classicRetired: boolean): BuilderFormat {
  return offeredBuilderFormats(reserveFormatsEnabled, classicRetired)[0] ?? 'constructed';
}

/**
 * Every offered format is a live conversion tab. The former identity-tab rule
 * (Darlings visible only on Darlings decks, 2026-08-17) made conversion
 * one-way: switching a Darlings deck to Warchest deleted the only way back.
 * Owner reversal 2026-08-18: the Format row offers both directions, and the
 * highlighted tab doubles as the deck's format indicator while editing.
 */
export function visibleBuilderFormatTabs(offered: readonly BuilderFormat[]): BuilderFormat[] {
  return [...offered];
}

// showsSpellListInDeckPanel was deleted 2026-08-18: Warchest's land-only rule
// (owner, 2026-08-17) moved into the pane's Warchest view when the
// Cards / Warchest toggle landed, so every format's Cards view now shows the
// editable spell list and the gate is the pane mode alone.

/** Compact deterministic copy; the picker shows the full land name on tap. */
export function reserveLandChipLabel(slot: number, name: string, maxCharacters = 10): string {
  const prefix = `${slot} `;
  const available = Math.max(1, maxCharacters - prefix.length);
  const compactName = name.length <= available
    ? name
    : available === 1
      ? '…'
      : `${name.slice(0, available - 1).trimEnd()}…`;
  return prefix + compactName;
}

/** Reserve-format metadata is hidden along with its player-facing UI. */
export function isReserveFormat(format: string | null | undefined): format is 'darlings' | 'warchest' {
  return format === 'darlings' || format === 'warchest';
}

export function isSavedDeckVisible(
  deck: Pick<SavedDeck, 'format'>,
  reserveFormatsEnabled: boolean,
): boolean {
  return reserveFormatsEnabled || !isReserveFormat(deck.format);
}

export function visibleSavedDecks(
  decks: readonly SavedDeck[],
  reserveFormatsEnabled: boolean,
): SavedDeck[] {
  return decks.filter((deck) => isSavedDeckVisible(deck, reserveFormatsEnabled));
}

/**
 * Keep a stale reserve-format active id lossless while giving UI consumers a
 * constructed deck, or null when no visible deck exists.
 */
export function activeVisibleSavedDeck(
  decks: readonly SavedDeck[],
  activeDeckId: string | null,
  reserveFormatsEnabled: boolean,
): SavedDeck | null {
  const active = decks.find((deck) => deck.id === activeDeckId) ?? null;
  if (active && isSavedDeckVisible(active, reserveFormatsEnabled)) return active;
  if (active && !reserveFormatsEnabled) {
    return decks.find((deck) => isSavedDeckVisible(deck, false)) ?? null;
  }
  return active;
}

/** Replays keep their persisted shape, but hidden reserve matches leave the UI list. */
export function isReplayVisible(
  replay: { format?: string },
  reserveFormatsEnabled: boolean,
): boolean {
  return reserveFormatsEnabled || !isReserveFormat(replay.format);
}

/** Normalize a saved format for a scene that only receives visible decks. */
export function builderFormatForDeck(
  deck: Pick<SavedDeck, 'format'> | null,
  reserveFormatsEnabled: boolean,
): BuilderFormat {
  return reserveFormatsEnabled && isReserveFormat(deck?.format)
    ? deck.format
    : 'constructed';
}

export const WARCHEST_RULES_COPY =
  'Your deck is 40 spells and you open with 5 cards. Build your Warchest: 10 lands, up to 5 dual lands. Each turn you move one land from your Warchest Reserves into your Active Warchest. Dual lands arrive tapped. If a dual land is destroyed it is gone; destroyed basic lands return to your Reserves.';

export const DARLINGS_RULES_COPY =
  'Choose your Darling. She waits in her own zone, ready when you call. Build a 79-card deck in her colors, one copy of each card, and a Warchest of 10 lands. You open with 5 cards. Each time she falls, her next call costs 2 more.';

/**
 * Player-facing format names. The warchest FORMAT reads as "Standard" (owner,
 * 2026-08-18): it is the normal way to build a deck now, and "Warchest" stays
 * the name of the land system every deck carries (Reserves, the builder's
 * Warchest view), so the two words stop competing.
 */
export function formatLabel(format: BuilderFormat): string {
  if (format === 'darlings') return 'Darlings';
  if (format === 'warchest') return 'Standard';
  return 'Constructed';
}

export function formatDeckSize(format: BuilderFormat): number {
  if (format === 'darlings') return DARLINGS_DECK_SIZE;
  if (format === 'warchest') return WARCHEST_DECK_SIZE;
  return 60;
}

export function formatRulesCopy(format: BuilderFormat): string | null {
  if (format === 'darlings') return DARLINGS_RULES_COPY;
  if (format === 'warchest') return WARCHEST_RULES_COPY;
  return null;
}

/**
 * Which formats the Tower accepts. Before classic retirement the Gauntlet was
 * classic-only and both reserve formats were Practice-only. Retirement makes
 * Warchest the Tower's format (every avatar fields a validated `reserveDeck`);
 * Darlings stays Practice-only, because the curated Darlings rival ladder is
 * explicitly not promised for 1.6 (plan-1.6.md non-goals).
 */
export function formatGauntletUnavailableCopy(
  format: BuilderFormat,
  classicRetired: boolean,
): string | null {
  if (format === 'darlings') return 'Darlings decks are available in Practice only.';
  if (format === 'warchest') return classicRetired ? null : 'Warchest decks are available in Practice only.';
  return null;
}

export interface DeckBuilderWorkingState {
  cards: readonly string[];
  variantPins: readonly (string | null)[];
  landReserve: readonly string[];
  heroCardId: string | null;
  darlingId?: string | null;
  format?: SavedDeck['format'];
}

/**
 * The last-saved state of the deck being edited: everything "Leave Without
 * Saving" puts back, format included (a format switch writes the saved record
 * at once, so without it the exit prompt's promise was false). It carries the
 * deck's id so a restore can only ever land on the deck it was taken from.
 */
export type DeckBaseline = Pick<
  SavedDeck,
  'id' | 'format' | 'cards' | 'variantPins' | 'landReserve' | 'heroCardId' | 'darlingId'
>;

export function deckBaseline(deck: SavedDeck | null | undefined): DeckBaseline | null {
  if (!deck) return null;
  return {
    id: deck.id,
    format: deck.format,
    cards: [...deck.cards],
    variantPins: deck.cards.map((_, index) => deck.variantPins?.[index] ?? null),
    landReserve: deck.landReserve ? [...deck.landReserve] : null,
    heroCardId: deck.heroCardId,
    darlingId: deck.darlingId ?? null,
  };
}

/**
 * Put the edited deck back to its baseline. Writes nothing, and returns false,
 * unless the baseline's deck still exists AND is the deck being edited: a
 * baseline left over from a deck deleted in the picker once wrote that deck's
 * cards, Warchest, hero and Darling over the deck the builder fell back to.
 */
export function restoreDeckBaseline(
  decks: readonly SavedDeck[],
  baseline: DeckBaseline | null,
  workingDeckId: string | null,
): boolean {
  if (!baseline || baseline.id !== workingDeckId) return false;
  const deck = decks.find((candidate) => candidate.id === baseline.id);
  if (!deck) return false;
  deck.format = baseline.format;
  deck.cards = [...baseline.cards];
  deck.variantPins = [...(baseline.variantPins ?? [])];
  deck.landReserve = baseline.landReserve ? [...baseline.landReserve] : null;
  deck.heroCardId = baseline.heroCardId;
  deck.darlingId = baseline.darlingId ?? null;
  return true;
}

/** Compare every editable deck slot, and the format, against the last saved deck record. */
export function isDeckBuilderDirty(
  working: DeckBuilderWorkingState,
  saved: Pick<SavedDeck, 'cards' | 'variantPins' | 'landReserve' | 'heroCardId' | 'darlingId' | 'format'> | null,
): boolean {
  if (!saved) return working.cards.length > 0 || working.landReserve.length > 0 || working.heroCardId !== null || working.darlingId != null;
  const savedPins = saved.cards.map((_, index) => saved.variantPins?.[index] ?? null);
  const savedReserve = saved.landReserve ?? [];
  return !sameArray(working.cards, saved.cards)
    || !sameArray(working.variantPins, savedPins)
    || !sameArray(working.landReserve, savedReserve)
    || working.heroCardId !== (saved.heroCardId ?? null)
    || (working.darlingId ?? null) !== (saved.darlingId ?? null)
    || (working.format ?? 'constructed') !== (saved.format ?? 'constructed');
}

/**
 * The issues that block importing a deck code. A code carries only a card
 * list, so an import is judged only on what that list causes. Anything else
 * (an unfinished Warchest, a Darling not yet chosen) reports the same issue
 * whatever the list holds, so validating an empty list finds
 * exactly those, and they stay in the status band instead of blocking the
 * import. Every new reserve-format deck starts with an empty Warchest, so
 * this used to reject a legal code for every new deck.
 */
export function deckCodeImportBlockers(
  validate: (cards: readonly string[]) => readonly DeckIssue[],
  imported: readonly string[],
): DeckIssue[] {
  // An empty import shares the empty list's deck-size issue, so only a
  // non-empty list can tell card-independent issues apart.
  const unrelated = new Set(imported.length > 0 ? validate([]).map((issue) => issue.message) : []);
  return validate(imported).filter((issue) => issue.kind === 'error' && !unrelated.has(issue.message));
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

/** One visible deck-list row, preserving the first slot for one-copy removal. */
export interface CollapsedDeckRow {
  cardId: string;
  quantity: number;
  firstIndex: number;
  /** Legacy positional pins remain visible but never choose a card's display. */
  hasLegacyVariantPin: boolean;
}

/** Collapse positional deck storage into exactly one row per card id. */
export function collapseDeckRows(
  cards: readonly string[],
  variantPins: readonly (string | null)[],
): CollapsedDeckRow[] {
  const rows = new Map<string, CollapsedDeckRow>();
  cards.forEach((cardId, index) => {
    const existing = rows.get(cardId);
    if (existing) {
      existing.quantity++;
      existing.hasLegacyVariantPin ||= variantPins[index] !== null;
      return;
    }
    rows.set(cardId, {
      cardId,
      quantity: 1,
      firstIndex: index,
      hasLegacyVariantPin: variantPins[index] !== null,
    });
  });
  return [...rows.values()];
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
