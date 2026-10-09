import type { SaveData } from '../meta/SaveManager';
import type { BoosterSku } from '../meta/boosterSkus';
import { DECK_SHOP_LAYOUT } from './deckShopLayout';
import { modalShellLayout } from './layout';
import { theme } from './theme';

/** Dev-only scene data. The scene clones the save and never persists it. */
export interface ShopA11yFixture {
  save: SaveData;
  deckTab?: 'standard' | 'darlings';
  deckIndex?: number;
  deckId?: string;
  previewPage?: number;
  inspectIndex?: number;
  odds?: BoosterSku;
  quantity?: number;
}

/** Between neighbouring tab hit boxes: the design system's within-group gap. */
export const SHOP_TAB_GAP = theme.space(3);

/**
 * Centres for one tab row (Card Packs | Decks, or Standard | Darling Decks):
 * measured hit boxes packed at the within-group gap and centred as a cluster
 * on the frame. The rows used to be hand-placed 200 and 220 apart whatever
 * the labels measured, so their gaps never matched each other.
 */
export function shopTabCenters(hitWidths: readonly number[]): number[] {
  const total = hitWidths.reduce((sum, w) => sum + w, 0) + SHOP_TAB_GAP * Math.max(0, hitWidths.length - 1);
  let left = theme.design.centerX - total / 2;
  return hitWidths.map((width) => {
    const center = left + width / 2;
    left += width + SHOP_TAB_GAP;
    return center;
  });
}

/**
 * Where each Shop strip's page arrows sit: in the edge column the neighbour
 * peeks through, but off the peek, so no arrow is drawn over a card (owner,
 * 2026-10-08: keep the peeks, move the arrows). The booster arrows sit on the
 * Buy line under the pack art; the deck arrows on the sub-tab line above the
 * two-row grid, which runs to the frame's bottom.
 */
export const SHOP_STRIP_ARROW_Y = { boosters: 578, decks: DECK_SHOP_LAYOUT.subTabY } as const;

/** Keep the four-pack release strip and its action anchors. Only reading space grows. */
export function shopPackLayout(title: number, blurb: number, pool: number) {
  const titleY = 172;
  const blurbY = Math.max(198, titleY + title / 2 + theme.space(1) + blurb / 2);
  const poolY = Math.max(220, blurbY + blurb / 2 + theme.space(1) + pool / 2);
  const artTop = Math.max(240, poolY + pool / 2 + theme.space(3));
  return { titleY, blurbY, poolY, artTop, artHeight: 540 - artTop, buyY: SHOP_STRIP_ARROW_Y.boosters };
}

/** Nine rows in each of two columns at release pitch; glyph height alone grows it. */
export function shopPreviewListLayout(textHeight: number, top: number, bottom: number) {
  const pitch = Math.max(24, textHeight + theme.space(2));
  // A column can cross three category boundaries in the release list.
  const rows = Math.max(1, Math.min(9, Math.floor((bottom - top) / pitch) - 3));
  return { pitch, rows, pageSize: rows * 2 };
}

/** The release header allows 64px for identity and plays; longer copy adds its measured excess. */
export function shopPreviewModalLayout(titleHeight: number, playsHeight: number) {
  const headerGrowth = Math.max(0, 24 + playsHeight - 64);
  return { ...shopModalLayout(980, 600, 432 + headerGrowth, titleHeight), headerGrowth };
}

/** A dialog can keep its release footprint while measured copy claims extra room. */
export function shopModalLayout(width: number, minHeight: number, contentHeight: number, titleHeight: number, footerHeight = theme.control.minHitHeight) {
  const titleTrackHeight = Math.max(theme.control.minHitHeight, titleHeight);
  const empty = modalShellLayout({ width, height: minHeight, titleTrackHeight, footerTrackHeight: footerHeight });
  const overhead = minHeight - empty.contentBounds.height;
  const height = Math.min(theme.design.safeHeight, Math.max(minHeight, overhead + contentHeight));
  return { width, height, titleTrackHeight, footerTrackHeight: footerHeight,
    tracks: modalShellLayout({ width, height, titleTrackHeight, footerTrackHeight: footerHeight }) };
}
