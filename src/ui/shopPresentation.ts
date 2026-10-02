import type { SaveData } from '../meta/SaveManager';
import type { BoosterSku } from '../meta/boosterSkus';
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

/** Keep the four-pack release strip and its action anchors. Only reading space grows. */
export function shopPackLayout(title: number, blurb: number, pool: number) {
  const titleY = 172;
  const blurbY = Math.max(198, titleY + title / 2 + theme.space(1) + blurb / 2);
  const poolY = Math.max(220, blurbY + blurb / 2 + theme.space(1) + pool / 2);
  const artTop = Math.max(240, poolY + pool / 2 + theme.space(3));
  return { titleY, blurbY, poolY, artTop, artHeight: 540 - artTop, buyY: 578 };
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
