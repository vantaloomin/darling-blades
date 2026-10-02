/**
 * Pure deck-list pagination shared by the DeckBuilder's desktop and touch
 * profiles. Phaser-free so it is unit-testable — the whole point is to prove
 * every deck row is reachable across pages, replacing the old desktop behavior
 * that hard-clipped (and silently dropped) rows past a fixed y.
 */

import { theme } from './theme';

export const DESKTOP_DECK_PITCH = 28;
export const DESKTOP_DECK_ROWS = 6;
export const TOUCH_DECK_PITCH = 44;
export const TOUCH_DECK_ROWS = 5;

/** Baseline density is independent of font scale and inflated input bounds. */
export function deckListProfile(touch: boolean) {
  return touch ? { rowPitch: TOUCH_DECK_PITCH, preferredRows: TOUCH_DECK_ROWS }
    : { rowPitch: DESKTOP_DECK_PITCH, preferredRows: DESKTOP_DECK_ROWS };
}

export interface DeckListTracks {
  top: number;
  bottom: number;
  pagerY: number;
  gap?: number;
  rowPitch?: number;
  preferredRows?: number;
  /** Actual inflated input bands, separate from drawn content. */
  inputHeights?: readonly number[];
  /** Per-row input limits where a visible pager shares the row's x range. */
  inputBottoms?: readonly number[];
}

export interface DeckListRow {
  index: number;
  /** Row centre, in the same coordinates as the supplied tracks. */
  y: number;
  height: number;
}

/** Pack drawn rows at the release pitch, growing only for measured content. */
export function deckListLayout(rowHeights: readonly number[], tracks: DeckListTracks) {
  const gap = tracks.gap ?? theme.space(1);
  const rowPitch = tracks.rowPitch ?? DESKTOP_DECK_PITCH;
  const preferredRows = tracks.preferredRows ?? DESKTOP_DECK_ROWS;
  const heights = rowHeights.map((height) => Math.max(0, height));
  const inputHeights = heights.map((height, i) => Math.max(height, tracks.inputHeights?.[i] ?? rowPitch));
  const distance = (before: number, next: number): number => Math.max(
    (inputHeights[before] + inputHeights[next]) / 2,
    (heights[before] + heights[next]) / 2 + gap,
  );
  const fullHeight = heights.length === 0 ? 0 : heights[0] / 2 + heights[heights.length - 1] / 2
    + heights.slice(1).reduce((sum, _height, i) => sum + distance(i, i + 1), 0);
  const paged = heights.length > preferredRows || fullHeight > tracks.bottom - tracks.top;
  // A pager beside the stats heading sits below this track and costs no list
  // space. A caller placing it inside the track still reserves its hit band.
  const viewportBottom = paged && tracks.pagerY <= tracks.bottom
    ? Math.min(tracks.bottom, tracks.pagerY - theme.control.minHitHeight / 2 - theme.space(2))
    : tracks.bottom;
  const capacity = viewportBottom - tracks.top;
  if (heights.some((height) => height > capacity)) {
    throw new RangeError('The deck list track must fit one complete measured row.');
  }
  const pages: DeckListRow[][] = [[]];
  heights.forEach((height, index) => {
    let page = pages[pages.length - 1];
    const previous = page[page.length - 1];
    let y = previous ? previous.y + distance(previous.index, index) : tracks.top + height / 2;
    const fits = (): boolean => y + height / 2 <= viewportBottom
      && (!paged || y + inputHeights[index] / 2 <= (tracks.inputBottoms?.[index] ?? Infinity));
    if (page.length > 0 && (page.length >= preferredRows || !fits())) {
      page = [];
      pages.push(page);
      y = tracks.top + height / 2;
    }
    if (!fits()) throw new RangeError('The deck list track must fit the row and its input band.');
    page.push({ index, y, height });
  });
  return { pages, paged, viewportBottom };
}

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
