import { describe, expect, it } from 'vitest';
import { compactProfileLayout, compactSaveDialogLayout, profileArtGrid, profileStatColumns } from '../../src/ui/profileCompact';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));

const inside = (r: Rect, box: Rect): boolean =>
  r.x >= box.x - 0.001 && r.y >= box.y - 0.001 && r.x + r.width <= box.x + box.width + 0.001 && r.y + r.height <= box.y + box.height + 0.001;
const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the compact Profile (mock M-Profile)', () => {
  it('keeps the record, the stats and the replay column apart, with the foot inside the column, on every landscape fixture', () => {
    for (const { name, m } of landscape) {
      for (const foot of [{ importSave: 98, exportSave: 102 }, { importSave: 130, exportSave: 135 }]) {
        const l = compactProfileLayout(m.content, foot);
        const main = l.shell.main;
        const column = l.shell.column!;
        for (const r of [l.record, l.tabs, l.rows]) expect(inside(r, main), name).toBe(true);
        expect(overlap(l.record, l.tabs), name).toBe(false);
        expect(overlap(l.record, l.rows), name).toBe(false);
        expect(l.rows.y, name).toBeGreaterThanOrEqual(l.tabs.y + l.tabs.height);
        expect(l.tabs.height).toBeGreaterThanOrEqual(44);
        for (const r of [l.importSave, l.exportSave, l.replays]) expect(inside(r, column), name).toBe(true);
        expect(overlap(l.importSave, l.exportSave), name).toBe(false);
        expect(l.importSave.height).toBeGreaterThanOrEqual(44);
        expect(l.replays.y + l.replays.height, name).toBeLessThan(Math.min(l.importSave.y, l.exportSave.y));
      }
    }
  });

  it('puts Import save beside Export save when both fit, and above it when they do not', () => {
    const content = resolveScreenMetrics(SCREEN_FIXTURES.find((f) => f.name === 'phone-island')!).content;
    const beside = compactProfileLayout(content, { importSave: 98, exportSave: 102 });
    expect(beside.importSave.y).toBe(beside.exportSave.y);
    expect(beside.importSave.x).toBeLessThan(beside.exportSave.x);
    expect(beside.exportSave.width).toBeGreaterThanOrEqual(102);
    const stacked = compactProfileLayout(content, { importSave: 130, exportSave: 135 });
    expect(stacked.importSave.y).toBeLessThan(stacked.exportSave.y);
    expect(stacked.exportSave.width).toBe(stacked.shell.column!.width);
  });

  it('lines the win rates up down a tab whatever the values are, leaving the label what is left', () => {
    const row = { x: 300, y: 0, width: 300, height: 36 };
    const narrow = profileStatColumns(row, 40, 30);
    const wide = profileStatColumns(row, 40, 70);
    expect(narrow.rateRight).toBe(wide.rateRight);
    expect(narrow.valueRight).toBe(wide.valueRight);
    expect(wide.labelWidth).toBe(narrow.labelWidth - 40);
    // A row without a rate puts its value at the rates' edge.
    expect(profileStatColumns(row, 0, 30).valueRight).toBe(narrow.rateRight);
  });

  it('frames the save dialogs as a sheet over the main pane and the top bar, with the column beside it', () => {
    for (const { name, m } of landscape) {
      const l = compactSaveDialogLayout(m.content);
      for (const r of [l.sheet, l.side, l.primary]) expect(inside(r, m.content), name).toBe(true);
      expect(l.sheet.y).toBe(m.content.y);
      expect(overlap(l.sheet, l.side) || overlap(l.sheet, l.primary) || overlap(l.side, l.primary), name).toBe(false);
      expect(l.primary.height).toBeGreaterThanOrEqual(44);
      expect(l.side.width).toBe(l.primary.width);
      // Five across still leaves each card's art big enough to tell apart (the sheet's 24 px padding either side).
      expect(profileArtGrid(l.sheet.width - 48).thumbW, name).toBeGreaterThanOrEqual(60);
    }
  });
});
