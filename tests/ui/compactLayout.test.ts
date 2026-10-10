import { describe, expect, it } from 'vitest';
import {
  COMPACT,
  compactDialog,
  compactGrid,
  compactHitProblems,
  compactList,
  compactRowHeight,
  compactSegmented,
  compactSheet,
  compactShell,
  compactSwitchTrack,
  type CompactControl,
} from '../../src/ui/compactLayout';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));
const reference = resolveScreenMetrics(SCREEN_FIXTURES.find((f) => f.name === 'phone-island')!);

describe('the shell matches the Version C mocks on the reference phone', () => {
  it('top bar, main pane, 230 px column, primary action at y 320..364', () => {
    const s = compactShell(reference.content);
    expect(s.back?.visual).toEqual({ x: 67, y: 8, width: 44, height: 44 });
    expect(s.column).toEqual({ x: 555, y: 60, width: 230, height: 304 });
    expect(s.main).toEqual({ x: 67, y: 60, width: 480, height: 304 });
    expect(s.primary?.visual).toEqual({ x: 555, y: 320, width: 230, height: 44 });
  });

  it('a ceremony screen drops the column and gives the main pane the full width', () => {
    const s = compactShell(reference.content, { noColumn: true, back: false });
    expect(s.column).toBeNull();
    expect(s.primary).toBeNull();
    expect(s.back).toBeNull();
    expect(s.main.width).toBe(718);
  });
});

describe('every primitive keeps the touch contract on every landscape fixture', () => {
  for (const { name, m } of landscape) {
    it(name, () => {
      const s = compactShell(m.content);
      const column = s.column!;
      // Shell chrome.
      const chrome: CompactControl[] = [s.back!, s.primary!];
      expect(compactHitProblems(chrome, m.content), 'shell').toEqual([]);
      // A long list in the column above the primary action: rows touch, nothing crowds the action.
      const listPane = { ...column, height: column.height - COMPACT.touch - COMPACT.gap };
      const list = compactList(listPane, 40);
      expect(list.rows.length).toBeGreaterThan(2);
      expect(list.more).toBeGreaterThan(0);
      expect(compactHitProblems([...list.rows, s.primary!], m.content), 'list').toEqual([]);
      // Tabs at the top of the main pane.
      const tabs = compactSegmented({ x: s.main.x, y: s.main.y, width: s.main.width, height: 44 }, 4);
      expect(compactHitProblems(tabs, m.content), 'tabs').toEqual([]);
      // Settings rows: the switch track sits inside its row, at the right.
      const settings = compactList(s.main, 6).rows;
      expect(compactHitProblems(settings, m.content), 'settings').toEqual([]);
      for (const r of settings) {
        const t = compactSwitchTrack(r.visual);
        expect(t.x + t.width).toBe(r.visual.x + r.visual.width);
        expect(t.y).toBeGreaterThanOrEqual(r.visual.y);
      }
      // A two-button confirm and a sheet with a close button.
      const d = compactDialog(m.design, 2);
      expect(compactHitProblems(d.buttons, { x: 0, y: 0, ...m.design }), 'dialog').toEqual([]);
      const sheet = compactSheet({ x: m.content.x, y: m.content.y, width: column.x - 8 - m.content.x, height: m.content.height });
      expect(compactHitProblems([sheet.close!], m.content), 'sheet').toEqual([]);
    });
  }
});

describe('lists', () => {
  it('fit whole rows on the 48 px pitch and say how many more there are', () => {
    const pane = { x: 0, y: 0, width: 200, height: 44 + 48 * 3 };
    expect(compactList(pane, 4)).toMatchObject({ more: 0 });
    expect(compactList(pane, 4).rows).toHaveLength(4);
    // Seven rows into four slots: three rows, then "4 more" in the last slot.
    const long = compactList(pane, 7);
    expect(long.rows).toHaveLength(4);
    expect(long.more).toBe(4);
  });

  it('hit areas touch: each row takes its whole pitch', () => {
    const rows = compactList({ x: 0, y: 100, width: 200, height: 300 }, 5).rows;
    for (let i = 1; i < rows.length; i++) expect(rows[i].hit.y).toBeCloseTo(rows[i - 1].hit.y + rows[i - 1].hit.height, 9);
  });

  it('rows grow at Largest text and never drop below 44', () => {
    expect(compactRowHeight(false)).toBe(44);
    expect(compactRowHeight(true)).toBe(48);
    expect(compactRowHeight(true, 1.3)).toBe(60);
    const tall = compactList({ x: 0, y: 0, width: 200, height: 300 }, 10, compactRowHeight(true, 1.3));
    expect(tall.rows[1].visual.y - tall.rows[0].visual.y).toBe(64);
  });

  it('a pane too short for one row shows none and counts them all', () => {
    expect(compactList({ x: 0, y: 0, width: 200, height: 30 }, 3)).toEqual({ rows: [], more: 3 });
  });
});

describe('grids', () => {
  it('size cards from the pane width and drop a column at larger text', () => {
    const pane = { x: 67, y: 60, width: 480, height: 304 };
    const g = compactGrid(pane, { minCardW: 110 });
    expect(g.columns).toBe(4);
    expect(g.cardW * g.columns + COMPACT.gap * (g.columns - 1)).toBeLessThanOrEqual(480);
    expect(g.cardH).toBe(Math.round(g.cardW * 1.4));
    expect(compactGrid(pane, { minCardW: 110, dropColumns: 1 }).columns).toBe(3);
    const last = g.cell(0, g.columns - 1);
    expect(last.x + last.width).toBeLessThanOrEqual(pane.x + pane.width);
  });

  it('never goes below one column', () => {
    expect(compactGrid({ x: 0, y: 0, width: 50, height: 100 }, { minCardW: 110, dropColumns: 2 }).columns).toBe(1);
  });
});

describe('the hit check itself', () => {
  const c = (x: number, y: number, w = 44, h = 44): CompactControl => ({ visual: { x, y, width: w, height: h }, hit: { x, y, width: w, height: h } });
  const box = { x: 0, y: 0, width: 400, height: 200 };

  it('flags a small hit area, one outside the content box, and two crowded controls', () => {
    expect(compactHitProblems([c(0, 0, 40, 44)], box)).toEqual([{ kind: 'small', index: 0 }]);
    expect(compactHitProblems([c(380, 0)], box)).toEqual([{ kind: 'outside', index: 0 }]);
    expect(compactHitProblems([c(0, 0), c(48, 0)], box)).toEqual([{ kind: 'crowded', index: 0, other: 1 }]);
  });

  it('allows controls that touch or sit 8 px apart', () => {
    expect(compactHitProblems([c(0, 0), c(44, 0), c(96, 0)], box)).toEqual([]);
  });
});
