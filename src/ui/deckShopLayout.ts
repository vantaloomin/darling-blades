import { theme } from './theme';

/**
 * Two labelled deck-shop sections share one compact, touch-safe plate grid.
 * Keeping the geometry Phaser-free lets the Shop scene and layout tests agree
 * when either deck roster grows.
 */
export const DECK_SHOP_LAYOUT = {
  cols: 2,
  top: 180,
  bottom: 696,
  plateW: 560,
  gapX: 16,
  maxPitch: 118,
  maxPlateH: 100,
  plateGapY: 8,
  sectionBreak: 30,
  headingGap: 12,
} as const;

export interface DeckShopSectionLayout {
  rows: number;
  headingY: number;
  rowCenter(row: number): number;
}

export interface DeckShopLayout {
  rowPitch: number;
  plateH: number;
  colLefts: number[];
  sections: DeckShopSectionLayout[];
}

/** Lay out each labelled section while preserving the existing two-column plates. */
export function deckShopLayout(sectionCounts: readonly number[]): DeckShopLayout {
  const rowsBySection = sectionCounts.map((count) => Math.ceil(Math.max(0, count) / DECK_SHOP_LAYOUT.cols));
  const occupiedSections = rowsBySection.filter((rows) => rows > 0).length;
  const totalRows = Math.max(1, rowsBySection.reduce((sum, rows) => sum + rows, 0));
  const sectionBreaks = Math.max(0, occupiedSections - 1) * DECK_SHOP_LAYOUT.sectionBreak;
  const band = DECK_SHOP_LAYOUT.bottom - DECK_SHOP_LAYOUT.top;
  const rowPitch = Math.min(DECK_SHOP_LAYOUT.maxPitch, (band - sectionBreaks) / totalRows);
  const plateH = Math.min(DECK_SHOP_LAYOUT.maxPlateH, rowPitch - DECK_SHOP_LAYOUT.plateGapY);
  const occupiedH = totalRows * rowPitch + sectionBreaks;
  let cursor = DECK_SHOP_LAYOUT.top + (band - occupiedH) / 2;
  const totalW = DECK_SHOP_LAYOUT.cols * DECK_SHOP_LAYOUT.plateW + (DECK_SHOP_LAYOUT.cols - 1) * DECK_SHOP_LAYOUT.gapX;
  const x0 = (theme.design.width - totalW) / 2;
  const colLefts = Array.from(
    { length: DECK_SHOP_LAYOUT.cols },
    (_, col) => x0 + col * (DECK_SHOP_LAYOUT.plateW + DECK_SHOP_LAYOUT.gapX),
  );

  const sections = rowsBySection.map((rows, index) => {
    const firstRowTop = cursor;
    const section = {
      rows,
      headingY: firstRowTop - DECK_SHOP_LAYOUT.headingGap,
      rowCenter: (row: number) => Math.round(firstRowTop + rowPitch / 2 + row * rowPitch),
    };
    cursor += rows * rowPitch;
    if (rows > 0 && rowsBySection.slice(index + 1).some((nextRows) => nextRows > 0)) {
      cursor += DECK_SHOP_LAYOUT.sectionBreak;
    }
    return section;
  });

  return { rowPitch, plateH, colLefts, sections };
}
