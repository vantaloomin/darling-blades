/**
 * Phaser-free geometry for the Deck Builder's pool side: the header row
 * (screen title, search, Filters), the four-by-three grid of owned cards, and
 * the pool pager under it.
 *
 * Until 1.8.1 the header row sat on y 40 and the pager on y 688, both past the
 * title-safe frame (y 36-684). The header now shares the back button's line
 * and the pager the shared footer line; the grid shrank from 0.43 to 0.41 card
 * scale so its last row ends above the pager's hit band instead of under it.
 * Columns keep their x, so every card sits where it did, a little smaller.
 */

import { DECK_PANE_LAYOUT } from './deckPanePresentation';
import { theme } from './theme';

/** Scale 1 card face, the size every thumbnail scale is relative to. */
const CARD_FACE = { width: 300, height: 420 } as const;
const CARD_SCALE = 0.41;

export const DECK_POOL_LAYOUT = {
  /** Title, search and Filters on the shared header line (the back button's). */
  headerY: theme.design.headerCenterY,
  titleX: 340,
  cols: 4,
  rows: 3,
  cardScale: CARD_SCALE,
  cardWidth: CARD_FACE.width * CARD_SCALE,
  cardHeight: CARD_FACE.height * CARD_SCALE,
  /** Centre of the first card, and the pitch between card centres. */
  x0: 190,
  y0: 172,
  pitchX: 170,
  pitchY: 189,
  /**
   * The in-deck count badge (top right) and the add-a-playset chip (top left)
   * ride the thumbnail's top edge, just inside its corners.
   */
  badgeOffsetY: -80,
  badgeOffsetX: 57,
  chipOffsetX: -55,
  /** The chip's inflated tap target. */
  chipHitWidth: 52,
  chipHitHeight: theme.control.minHitHeight,
  /** The pager's left chevron sits at pagerX; it centres on the shared footer line. */
  pagerX: 350,
  pagerY: theme.design.footerCenterY,
  /** The deck pane's fill starts here; the grid must end before it. */
  paneLeft: DECK_PANE_LAYOUT.panelX,
} as const;

/** Centre of pool grid cell `index` (row-major). */
export function poolCellPosition(index: number): { x: number; y: number } {
  const layout = DECK_POOL_LAYOUT;
  return {
    x: layout.x0 + (index % layout.cols) * layout.pitchX,
    y: layout.y0 + Math.floor(index / layout.cols) * layout.pitchY,
  };
}
