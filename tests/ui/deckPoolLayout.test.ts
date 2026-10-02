import { describe, expect, it } from 'vitest';
import { DECK_POOL_LAYOUT, poolCellPosition } from '../../src/ui/deckPoolLayout';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';

/**
 * The Deck Builder's pool side inside the title-safe frame (y 36-684): the
 * header row sat on y 40 and the pager on y 688 until 1.8.1. Hit bands are
 * 44px tall; the pager's chevrons and the playset chip carry inflated ones.
 */
describe('deck builder pool layout', () => {
  const grid = DECK_POOL_LAYOUT;
  const hitHalf = theme.control.minHitHeight / 2;
  const firstCard = poolCellPosition(0);
  const lastCard = poolCellPosition(grid.cols * grid.rows - 1);

  it('keeps the header row and the pager inside the frame', () => {
    expect(grid.headerY - hitHalf).toBeGreaterThanOrEqual(theme.design.safeTop);
    expect(grid.pagerY + hitHalf).toBeLessThanOrEqual(theme.design.safeBottom);
  });

  it('fits the whole grid between the header row and the pager', () => {
    expect(firstCard.y - grid.cardHeight / 2).toBeGreaterThanOrEqual(grid.headerY + hitHalf);
    expect(lastCard.y + grid.cardHeight / 2).toBeLessThanOrEqual(grid.pagerY - hitHalf);
    expect(firstCard.x - grid.cardWidth / 2).toBeGreaterThanOrEqual(theme.design.safeLeft);
    expect(lastCard.x + grid.cardWidth / 2).toBeLessThanOrEqual(grid.paneLeft);
  });

  it("keeps each card's badge and playset chip on that card", () => {
    // Both centre on the card's top edge band, inside its corners.
    expect(-grid.badgeOffsetY).toBeLessThanOrEqual(grid.cardHeight / 2);
    expect(grid.badgeOffsetX).toBeLessThanOrEqual(grid.cardWidth / 2);
    expect(-grid.chipOffsetX).toBeLessThanOrEqual(grid.cardWidth / 2);
    // The chip's tap target never reaches the card in the row above.
    const rowGapBelowCardAbove = grid.pitchY - grid.cardHeight / 2;
    expect(-grid.badgeOffsetY + grid.chipHitHeight / 2).toBeLessThanOrEqual(rowGapBelowCardAbove);
    // Nor the card in the column to its left.
    expect(-grid.chipOffsetX + grid.chipHitWidth / 2).toBeLessThanOrEqual(grid.pitchX - grid.cardWidth / 2);
  });
});

describe('deck builder pool accessibility layout', () => {
  it('keeps exempt card faces and their input bands inside the pool in every accessibility cell', () => {
    forEachA11yCell(() => {
      const grid = DECK_POOL_LAYOUT;
      for (let index = 0; index < grid.cols * grid.rows; index++) {
        const cell = poolCellPosition(index);
        expect(cell.x - grid.cardWidth / 2).toBeGreaterThanOrEqual(theme.design.safeLeft);
        expect(cell.x + grid.cardWidth / 2).toBeLessThanOrEqual(grid.paneLeft);
        expect(cell.y - grid.cardHeight / 2).toBeGreaterThanOrEqual(grid.headerY + theme.control.minHitHeight / 2);
        expect(cell.y + grid.cardHeight / 2).toBeLessThanOrEqual(grid.pagerY - theme.control.minHitHeight / 2);
        expect(grid.chipHitHeight).toBeGreaterThanOrEqual(theme.control.minHitHeight);
        if (index >= grid.cols) {
          const previous = poolCellPosition(index - grid.cols);
          expect(cell.y + grid.badgeOffsetY - grid.chipHitHeight / 2)
            .toBeGreaterThanOrEqual(previous.y + grid.cardHeight / 2);
        }
      }
    });
  });
});
