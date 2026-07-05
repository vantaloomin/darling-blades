/**
 * Pure deck-list pagination shared by the DeckBuilder's desktop and touch
 * profiles. Phaser-free so it is unit-testable — the whole point is to prove
 * every deck row is reachable across pages, replacing the old desktop behavior
 * that hard-clipped (and silently dropped) rows past a fixed y.
 */

/** Number of pages needed to show `entryCount` rows at `rowsPerPage` (≥ 1). */
export function deckPageCount(entryCount: number, rowsPerPage: number): number {
  return Math.max(1, Math.ceil(entryCount / rowsPerPage));
}

/** Clamp a (possibly stale) page index into range for the given entry count. */
export function clampDeckPage(page: number, entryCount: number, rowsPerPage: number): number {
  return Math.min(Math.max(page, 0), deckPageCount(entryCount, rowsPerPage) - 1);
}

/** The slice of `entries` shown on `page` (page is clamped into range first). */
export function deckPageSlice<T>(entries: T[], page: number, rowsPerPage: number): T[] {
  const p = clampDeckPage(page, entries.length, rowsPerPage);
  return entries.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
}
