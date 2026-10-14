import { describe, expect, it } from 'vitest';
import {
  BUILDER_DESKTOP,
  deskDeckRow,
  deskPoolHitAt,
  poolChipH,
  poolGrid,
  poolHitAt,
  poolInspectRect,
} from '../../src/ui/deckBuilderCompact';
import { COMPACT, DESKTOP_GRID } from '../../src/ui/compactLayout';

describe('the Deck Builder on the desktop stage (R2 A)', () => {
  it('slims the pool chip line on desktop and keeps the phone pills as they were', () => {
    for (const labelH of [14, 16, 22]) {
      expect(poolChipH(false, labelH)).toBe(Math.max(28, Math.ceil(labelH + 10)));
      const desk = poolChipH(true, labelH);
      expect(desk).toBeGreaterThanOrEqual(BUILDER_DESKTOP.chipH);
      expect(desk).toBeGreaterThanOrEqual(labelH);
      expect(desk).toBeLessThan(poolChipH(false, labelH));
    }
  });

  it('puts the hover inspect button inside the face and hits it before the card; the phone test is unchanged', () => {
    const grid = poolGrid(760, poolChipH(true, 16), false, DESKTOP_GRID.cardMinW);
    const r = poolInspectRect(grid);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(grid.cardW);
    expect(r.y + r.height).toBeLessThan(grid.cardH);
    const count = grid.columns * 3;
    const all = () => true;
    // Second column, second row: on the inspect button, on the face, on the fill chip.
    const ox = grid.pitchX;
    const oy = grid.pitchY;
    const index = grid.columns + 1;
    expect(deskPoolHitAt(grid, count, ox + r.x + r.width / 2, oy + r.y + r.height / 2, all)).toEqual({ index, part: 'inspect' });
    expect(deskPoolHitAt(grid, count, ox + 10, oy + grid.cardH / 2, all)).toEqual({ index, part: 'card' });
    expect(deskPoolHitAt(grid, count, ox + grid.cardW - 2, oy + grid.chipY + 2, all)).toEqual({ index, part: 'all' });
    expect(deskPoolHitAt(grid, count, ox + grid.cardW + 2, oy + 10, all)).toBeNull();
    expect(poolHitAt(grid, count, ox + r.x + r.width / 2, oy + r.y + r.height / 2, all)).toEqual({ index, part: 'card' });
  });

  it('lays a slim deck row: count lane, the full name, the cost only when it fits, controls at the right', () => {
    const rowW = 223;
    const row = deskDeckRow(rowW, 18, 16, 100, 0, 40, 1);
    expect(row.height).toBe(BUILDER_DESKTOP.rowH);
    expect(row.height).toBeLessThan(COMPACT.touch + 8);
    expect(row.nameX).toBeGreaterThan(row.countX + 16 - 1);
    expect(row.nameW).toBeGreaterThanOrEqual(100);
    expect(row.pipsX).not.toBeNull();
    expect(row.pipsX!).toBeGreaterThanOrEqual(row.nameX + 100);
    expect(row.pipsX! + 40).toBeLessThanOrEqual(row.controls[0].x);
    expect(row.controls[0].x + row.controls[0].width).toBe(rowW);

    // A long name keeps all its width and drops the cost rather than being cut.
    const long = deskDeckRow(rowW, 18, 16, 150, 0, 40, 1);
    expect(long.pipsX).toBeNull();
    expect(long.nameW).toBeGreaterThanOrEqual(150);

    // A Classic basic's minus and plus sit side by side, inside the row, and never under the name's room.
    const basic = deskDeckRow(rowW, 18, 16, 60, 0, 0, 2);
    expect(basic.controls).toHaveLength(2);
    expect(basic.controls[1].x).toBeGreaterThanOrEqual(basic.controls[0].x + basic.controls[0].width);
    expect(basic.nameX + basic.nameW).toBeLessThanOrEqual(basic.controls[0].x);

    // Larger text grows the row past the slim floor.
    expect(deskDeckRow(rowW, 30, 16, 60, 0, 0, 1).height).toBe(30 + BUILDER_DESKTOP.rowPad);
  });
});
