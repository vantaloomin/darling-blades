import { describe, expect, it } from 'vitest';
import {
  compactSettingsLayout,
  settingsActiveSection,
  settingsCompactSectionForTab,
  settingsCompactSections,
  settingsNavRowWidths,
} from '../../src/ui/settingsCompact';
import { ALL_ACCESSIBILITY_CONTROLS, NO_ACCESSIBILITY_CONTROLS } from '../../src/ui/settingsPresentation';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import { desktopCompactMetrics } from '../../src/platform/compactScenes';
import type { Rect } from '../../src/ui/layout';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));

const inside = (r: Rect, box: Rect): boolean =>
  r.x >= box.x && r.y >= box.y && r.x + r.width <= box.x + box.width + 0.001 && r.y + r.height <= box.y + box.height + 0.001;
const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the compact Settings (mock M-Settings)', () => {
  it('lists every setting once, in the mocks order, with render size and animations under Gameplay', () => {
    const sections = settingsCompactSections(ALL_ACCESSIBILITY_CONTROLS, false);
    expect(sections.map((s) => s.key)).toEqual(['audio', 'yourTurn', 'gameplay', 'accessibility', 'privacy', 'saveData']);
    const rows = sections.flatMap((s) => s.rows);
    expect(new Set(rows).size).toBe(rows.length);
    expect(sections[2].rows.slice(0, 2)).toEqual(['animations', 'renderSize']);
    expect(rows).not.toContain('fullScreen');
  });

  it('adds Full screen to Audio where it is offered, and drops a section with nothing to show', () => {
    const withScreen = settingsCompactSections(ALL_ACCESSIBILITY_CONTROLS, true);
    expect(withScreen[0].rows).toContain('fullScreen');
    expect(withScreen[0].title).toBe('Audio & screen');
    const hidden = settingsCompactSections(NO_ACCESSIBILITY_CONTROLS, false);
    expect(hidden.map((s) => s.key)).not.toContain('accessibility');
    // A text size change brings the player back to its controls, or as near as the build allows.
    expect(settingsCompactSectionForTab('accessibility', withScreen)).toBe('accessibility');
    expect(settingsCompactSectionForTab('accessibility', hidden)).toBe('gameplay');
    expect(settingsCompactSectionForTab('game', hidden)).toBeNull();
  });

  it('keeps the jumps two across and the foot inside the column, clear of each other, on every landscape fixture', () => {
    for (const { name, m } of landscape) {
      for (const foot of [{ legal: 64, update: 149 }, { legal: 80, update: 190 }]) {
        const l = compactSettingsLayout(m.content, 6, foot);
        const column = l.shell.column!;
        const parts = [...l.nav, l.legal, l.update];
        for (const r of parts) {
          expect(inside(r, column), name).toBe(true);
          expect(r.height).toBeGreaterThanOrEqual(44);
        }
        for (let i = 0; i < parts.length; i++) {
          for (let j = i + 1; j < parts.length; j++) expect(overlap(parts[i], parts[j]), `${name} ${i}/${j}`).toBe(false);
        }
        expect(l.nav[1].y).toBe(l.nav[0].y);
        expect(l.versionY).toBeGreaterThan(l.nav[5].y + l.nav[5].height);
        expect(l.versionY).toBeLessThan(Math.min(l.legal.y, l.update.y));
        expect(l.list.x + l.list.width).toBeLessThanOrEqual(column.x);
      }
    }
  });

  it('stacks the jumps one per row on desktop, with the list inset on its panel', () => {
    const m = desktopCompactMetrics();
    const l = compactSettingsLayout(m.content, 6, { legal: 64, update: 149 }, [], { desktop: true });
    const column = l.shell.column!;
    for (const r of l.nav) expect(r.width).toBe(column.width);
    for (let i = 1; i < l.nav.length; i++) expect(l.nav[i].y).toBeGreaterThan(l.nav[i - 1].y + l.nav[i - 1].height);
    expect(l.versionY).toBeLessThan(Math.min(l.legal.y, l.update.y));
    expect(l.listPanel).not.toBeNull();
    expect(inside(l.list, l.listPanel!)).toBe(true);
    expect(l.rowW).toBeLessThanOrEqual(640);
    expect(inside(l.listPanel!, l.shell.main)).toBe(true);
    expect(compactSettingsLayout(m.content, 6, { legal: 64, update: 149 }).listPanel).toBeNull();
  });

  it('puts Legal beside Check for updates when both fit, and above it when they do not', () => {
    const content = resolveScreenMetrics(SCREEN_FIXTURES.find((f) => f.name === 'phone-island')!).content;
    const beside = compactSettingsLayout(content, 6, { legal: 64, update: 149 });
    expect(beside.legal.y).toBe(beside.update.y);
    expect(beside.legal.width).toBeGreaterThanOrEqual(64);
    expect(beside.update.width).toBeGreaterThanOrEqual(149);
    const stacked = compactSettingsLayout(content, 6, { legal: 80, update: 190 });
    expect(stacked.legal.y).toBeLessThan(stacked.update.y);
    expect(stacked.update.width).toBe(stacked.shell.column!.width);
  });

  it('splits a jump row unevenly only when a long label needs it and the pair still fits', () => {
    expect(settingsNavRowWidths(230, 80, 90)).toEqual([111, 111]);
    const [left, right] = settingsNavRowWidths(230, 91, 120);
    expect(left).toBeGreaterThanOrEqual(91);
    expect(right).toBeGreaterThanOrEqual(120);
    expect(left + 8 + right).toBe(230);
    expect(settingsNavRowWidths(230, 120, 120)).toEqual([111, 111]);
  });

  it('selects the section whose heading has reached the top, and at the end the one past the middle', () => {
    const tops = [0, 300, 700, 1000, 1100];
    expect(settingsActiveSection(tops, 0, 300, 900)).toBe(0);
    expect(settingsActiveSection(tops, 290, 300, 900)).toBe(1);
    expect(settingsActiveSection(tops, 650, 300, 900)).toBe(1);
    // At the end of the list the last short sections never reach the top.
    expect(settingsActiveSection(tops, 900, 300, 900)).toBe(3);
    expect(settingsActiveSection([], 0, 300, 0)).toBe(-1);
  });
});
