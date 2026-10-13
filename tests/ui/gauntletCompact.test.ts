import { describe, expect, it } from 'vitest';
import {
  compactGauntletLayout,
  GAUNTLET_COMPACT,
  gauntletInfoStack,
  gauntletRowTop,
  gauntletTowerHeight,
  gauntletTowerOffset,
} from '../../src/ui/gauntletCompact';
import { rivalShortName } from '../../src/ui/practiceCompact';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));
const reference = resolveScreenMetrics(SCREEN_FIXTURES.find((f) => f.name === 'phone-island')!);

const inside = (r: Rect, box: Rect): boolean =>
  r.x >= box.x && r.y >= box.y && r.x + r.width <= box.x + box.width + 0.001 && r.y + r.height <= box.y + box.height + 0.001;
const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the compact Avatar Gauntlet (mock M-Gauntlet)', () => {
  it('puts Fight at the column foot and the run actions at the centre foot, apart, on the reference phone', () => {
    const l = compactGauntletLayout(reference.content);
    expect(l.launch).toEqual(l.shell.primary?.visual);
    expect(l.actions.height).toBe(44);
    expect(l.actions.y + l.actions.height).toBe(l.info.y + l.info.height);
    expect(l.actions.x + l.actions.width).toBeLessThan(l.launch.x);
    expect(l.tower.y + l.tower.height).toBeLessThan(l.launch.y);
    expect(l.tower.height).toBeGreaterThanOrEqual(GAUNTLET_COMPACT.rowH * 3);
  });

  it('keeps every part inside the content box, apart, on every landscape fixture', () => {
    for (const { name, m } of landscape) {
      const l = compactGauntletLayout(m.content);
      const parts = [l.hero, l.info, l.tower, l.launch];
      for (const r of [...parts, l.actions]) expect(inside(r, m.content), name).toBe(true);
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) expect(overlap(parts[i], parts[j]), `${name} ${i}/${j}`).toBe(false);
      }
    }
  });
});

describe('gauntletInfoStack', () => {
  it('stacks lines down from the top and up from the actions, the blurb between', () => {
    const info = { x: 0, y: 0, width: 300, height: 300 };
    const s = gauntletInfoStack(info, 256, [24, 18, 18], [24, 16, 18, 16]);
    expect(s.topYs).toEqual([0, 28, 50]);
    expect(s.blurb.y).toBe(72);
    const lastBottom = s.bottomYs[3] + 16;
    expect(lastBottom).toBe(256 - 8);
    expect(s.blurb.y + s.blurb.height + GAUNTLET_COMPACT.lineGap).toBe(s.bottomYs[0]);
    for (let i = 1; i < s.bottomYs.length; i++) expect(s.bottomYs[i]).toBeGreaterThan(s.bottomYs[i - 1]);
  });
});

describe('the tower', () => {
  it('runs top rung first and opens on the current rung, clamped to the ends', () => {
    expect(gauntletRowTop(28, 28)).toBe(0);
    expect(gauntletRowTop(1, 28)).toBe(27 * (GAUNTLET_COMPACT.rowH + GAUNTLET_COMPACT.rowGap));
    const height = 252;
    const max = gauntletTowerHeight(28) - height;
    expect(gauntletTowerOffset(1, 28, height)).toBe(max);
    expect(gauntletTowerOffset(28, 28, height)).toBe(0);
    const mid = gauntletTowerOffset(9, 28, height);
    const rowCentre = gauntletRowTop(9, 28) + GAUNTLET_COMPACT.rowH / 2 - mid;
    expect(Math.abs(rowCentre - height / 2)).toBeLessThanOrEqual(1);
  });
});

describe('rivalShortName', () => {
  it('keeps the name before the comma', () => {
    expect(rivalShortName('Anubis, Who Holds the Scale')).toBe('Anubis');
    expect(rivalShortName('The Drowned Deacon')).toBe('The Drowned Deacon');
  });
});
