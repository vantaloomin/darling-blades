import { describe, expect, it } from 'vitest';
import {
  compactPracticeLayout,
  compactPracticeLayoutFitting,
  PRACTICE_COMPACT,
  practiceGridHeight,
  practiceTilePosition,
} from '../../src/ui/practiceCompact';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));
const reference = resolveScreenMetrics(SCREEN_FIXTURES.find((f) => f.name === 'phone-island')!);

const inside = (r: Rect, box: Rect): boolean =>
  r.x >= box.x && r.y >= box.y && r.x + r.width <= box.x + box.width + 0.001 && r.y + r.height <= box.y + box.height + 0.001;
const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the compact Practice picker (mock M-Practice)', () => {
  it('sets the picked rival, a three-column grid and the command column on the reference phone', () => {
    const l = compactPracticeLayout(reference.content, 17);
    expect(l.columns).toBe(3);
    expect(l.tileW).toBeGreaterThanOrEqual(PRACTICE_COMPACT.minTileW);
    expect(l.launch).toEqual(l.shell.primary?.visual);
    expect(l.segments.height).toBe(44);
    expect(l.segments.y + l.segments.height).toBeLessThan(l.launch.y);
    expect(l.difficultyLabel.y + 17).toBeLessThanOrEqual(l.segments.y);
    expect(l.blurb.y + l.blurb.height).toBeLessThan(l.difficultyLabel.y);
    expect(l.grid.x).toBeGreaterThan(l.hero.x + l.hero.width);
  });

  it('keeps every part inside the content box, apart, on every landscape fixture', () => {
    for (const { name, m } of landscape) {
      const l = compactPracticeLayout(m.content, 21);
      const parts = [l.hero, l.grid, l.blurb, l.segments, l.launch];
      for (const r of parts) expect(inside(r, m.content), name).toBe(true);
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) expect(overlap(parts[i], parts[j]), `${name} ${i}/${j}`).toBe(false);
      }
      const lastCol = practiceTilePosition(l.columns - 1, l.columns, l.tileW, l.tileH);
      expect(l.grid.x + lastCol.x + l.tileW, name).toBeLessThanOrEqual(l.grid.x + l.grid.width);
    }
  });
});

describe('compactPracticeLayoutFitting', () => {
  it('keeps the first layout when every name fits', () => {
    const fitted = compactPracticeLayoutFitting(reference.content, 17, () => true);
    expect(fitted).toEqual(compactPracticeLayout(reference.content, 17));
  });

  it('narrows the picked rival before it drops a grid column', () => {
    const first = compactPracticeLayout(reference.content, 17);
    const need = first.tileW - 2 * PRACTICE_COMPACT.nameInset + 4;
    const fitted = compactPracticeLayoutFitting(reference.content, 17, (w) => w >= need);
    expect(fitted.columns).toBe(first.columns);
    expect(fitted.hero.width).toBeLessThan(first.hero.width);
    expect(fitted.hero.width).toBeGreaterThanOrEqual(PRACTICE_COMPACT.heroMin);
  });

  it('drops columns, down to one, when the names need it', () => {
    const first = compactPracticeLayout(reference.content, 17);
    const twoCol = compactPracticeLayoutFitting(reference.content, 17, (w) => w >= 120);
    expect(twoCol.columns).toBeLessThan(first.columns);
    expect(twoCol.hero.width).toBe(first.hero.width);
    expect(compactPracticeLayoutFitting(reference.content, 17, () => false).columns).toBe(1);
  });
});

describe('the rival grid', () => {
  it('runs row-major and measures its rows', () => {
    expect(practiceTilePosition(4, 3, 90, 100)).toEqual({ x: 90 + PRACTICE_COMPACT.tileGap, y: 100 + PRACTICE_COMPACT.tileGap });
    expect(practiceGridHeight(7, 3, 100)).toBe(3 * 100 + 2 * PRACTICE_COMPACT.tileGap);
    expect(practiceGridHeight(0, 3, 100)).toBe(0);
  });
});
