import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS_COMPACT,
  achievementHallFrames,
  achievementRowColumns,
  compactAchievementsLayout,
  flowItems,
} from '../../src/ui/achievementsCompact';
import { resolveScreenMetrics } from '../../src/platform/screenMetrics';
import { SCREEN_FIXTURES } from '../../src/platform/screenFixtures';
import type { Rect } from '../../src/ui/layout';

const landscape = SCREEN_FIXTURES.filter((f) => f.viewportWidth > f.viewportHeight).map((f) => ({ name: f.name, m: resolveScreenMetrics(f) }));

const overlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the compact Achievements (mocks M-Achievements, M-AchievementsList)', () => {
  it('puts Claim all at the foot of the column, beside the main pane, on every landscape fixture', () => {
    for (const { name, m } of landscape) {
      const l = compactAchievementsLayout(m.content);
      expect(overlap(l.main, l.column), name).toBe(false);
      expect(l.claimAll.y + l.claimAll.height, name).toBe(l.column.y + l.column.height);
      expect(l.claimAll.height).toBeGreaterThanOrEqual(44);
    }
  });

  it('lays the five wings three over two, filling the pane, and grows a row past it only when its cards need more', () => {
    const fits = achievementHallFrames(480, 320, [120, 120]);
    expect(fits.frames).toHaveLength(5);
    expect(fits.height).toBe(320);
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) expect(overlap(fits.frames[i], fits.frames[j])).toBe(false);
    for (const f of fits.frames) expect(f.x + f.width).toBeLessThanOrEqual(480 + 1e-6);
    // The top row's three cards are narrower than the bottom row's two.
    expect(fits.frames[0].width).toBeLessThan(fits.frames[3].width);
    const tall = achievementHallFrames(480, 320, [190, 120]);
    expect(tall.frames[0].height).toBe(190);
    expect(tall.frames[3].y).toBe(190 + ACHIEVEMENTS_COMPACT.wingGap);
    expect(tall.height).toBeGreaterThan(320);
  });

  it('keeps a row\'s reward and readout whole, moving the reward under the readout when the copy would get too narrow', () => {
    const wide = achievementRowColumns(470, 70, 90);
    expect(wide.stacked).toBe(false);
    expect(wide.copyWidth).toBeGreaterThanOrEqual(ACHIEVEMENTS_COMPACT.copyMin);
    expect(wide.rewardRight).toBeLessThan(wide.progressX);
    expect(wide.copyX + wide.copyWidth).toBeLessThan(wide.rewardRight - 70);
    const narrow = achievementRowColumns(400, 100, 110);
    expect(narrow.stacked).toBe(true);
    expect(narrow.progressX + narrow.progressWidth).toBe(narrow.rewardRight);
    expect(narrow.copyX + narrow.copyWidth).toBeLessThan(narrow.rewardRight - 110);
  });

  it('wraps the colour totals onto a new line rather than past the column', () => {
    const flow = flowItems(230, [90, 90, 90, 90, 90], 20, 14, 8);
    expect(flow.at.map((p) => p.y)).toEqual([0, 0, 28, 28, 56]);
    for (const p of flow.at) expect(p.x + 90).toBeLessThanOrEqual(230);
    expect(flow.height).toBe(76);
  });

  it('on desktop sizes each row of wings to its cards instead of filling the pane; a phone still fills it', () => {
    const desk = achievementHallFrames(780, 500, [120, 110], { desktop: true });
    expect(desk.frames[0].height).toBe(120);
    expect(desk.frames[3].height).toBe(110);
    expect(desk.frames[3].y).toBe(120 + ACHIEVEMENTS_COMPACT.wingGap);
    expect(desk.height).toBe(120 + ACHIEVEMENTS_COMPACT.wingGap + 110);
    const phone = achievementHallFrames(780, 500, [120, 110]);
    expect(phone.height).toBe(500);
    expect(phone.frames[3].height).toBeGreaterThan(110);
  });
});
