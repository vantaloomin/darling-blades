import { describe, expect, it } from 'vitest';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';
import {
  ACHIEVEMENT_LIST,
  ACHIEVEMENT_ROW,
  achievementListLayout,
  achievementRowLayout,
  hallPlinthLayout,
  achievementCascadeDelay,
  achievementCascadeDuration,
  achievementClaimMotion,
  achievementClaimPitch,
  HALL_BUCKETS,
  hallWingFrames,
  togglePin,
  wingFurnishings,
  wingSummaries,
} from '../../src/ui/achievementPresentation';

const status = (bucket: string, id: string, unlocked: boolean, claimed: boolean) => ({
  def: { id, bucket },
  unlocked,
  claimed,
});

describe('wingSummaries', () => {
  it('summarizes each bucket in fixed hall order', () => {
    const summaries = wingSummaries([
      status('collection', 'c1', true, true),
      status('collection', 'c2', true, false),
      status('collection', 'c3', false, false),
      status('mastery', 'm1', true, true),
    ]);
    expect(summaries.map((wing) => wing.bucket)).toEqual([...HALL_BUCKETS]);
    const collection = summaries[0];
    expect(collection).toMatchObject({ total: 3, claimed: 1, ready: 1 });
    expect(collection.percent).toBeCloseTo(1 / 3);
    expect(summaries.find((wing) => wing.bucket === 'variants')).toMatchObject({
      total: 0,
      percent: 0,
      featuredId: null,
    });
  });

  it('features the first ready achievement, else the last claimed', () => {
    const ready = wingSummaries([
      status('theme', 't1', true, true),
      status('theme', 't2', true, false),
    ]).find((wing) => wing.bucket === 'theme');
    expect(ready?.featuredId).toBe('t2');
    const claimedOnly = wingSummaries([
      status('theme', 't1', true, true),
      status('theme', 't3', true, true),
    ]).find((wing) => wing.bucket === 'theme');
    expect(claimedOnly?.featuredId).toBe('t3');
  });
});

describe('hallWingFrames', () => {
  it('lays five non-overlapping wings inside the content band', () => {
    const frames = hallWingFrames();
    expect(frames).toHaveLength(5);
    for (const frame of frames) {
      expect(frame.x).toBeGreaterThanOrEqual(72);
      expect(frame.x + frame.w).toBeLessThanOrEqual(1208);
      expect(frame.y + frame.h).toBeLessThanOrEqual(660);
    }
    for (let i = 0; i < frames.length; i++) {
      for (let j = i + 1; j < frames.length; j++) {
        const a = frames[i];
        const b = frames[j];
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });
});

describe('togglePin', () => {
  it('pins, unpins, and evicts the oldest past the cap', () => {
    expect(togglePin([], 'a')).toEqual(['a']);
    expect(togglePin(['a'], 'a')).toEqual([]);
    expect(togglePin(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(togglePin(['a', 'b', 'c'], 'd')).toEqual(['b', 'c', 'd']);
  });
});

describe('wingFurnishings', () => {
  it('is deterministic, bounded, and empty for an empty collection', () => {
    const owned = ['x1', 'x2', 'x3', 'x4', 'x5'];
    const picks = wingFurnishings('mastery', owned);
    expect(picks).toEqual(wingFurnishings('mastery', owned));
    expect(picks.length).toBeLessThanOrEqual(2);
    for (const pick of picks) expect(owned).toContain(pick);
    expect(wingFurnishings('theme', [])).toEqual([]);
  });
});

describe('achievement claim presentation', () => {
  it('keeps the full cascade staggered and the individual stamp under 300ms', () => {
    const motion = achievementClaimMotion('full');
    expect(motion.stampMs + motion.settleMs).toBeLessThanOrEqual(300);
    expect(motion.staggerMs).toBeGreaterThan(0);
    expect(achievementCascadeDelay(3, 'full')).toBe(3 * motion.staggerMs);
  });

  it('removes transform motion for reduced animation while retaining a short fade cascade', () => {
    const motion = achievementClaimMotion('reduced');
    const full = achievementClaimMotion('full');
    expect(motion.scaleFrom).toBe(1);
    expect(motion.angleFrom).toBe(0);
    expect(motion.angleTo).toBe(0);
    expect(motion.settleMs).toBe(0);
    expect(motion.stampMs).toBeGreaterThan(0);
    expect(motion.stampMs).toBeLessThan(full.stampMs);
  });

  it('makes the off policy immediate without dropping completion timing', () => {
    expect(achievementCascadeDuration(16, 'off')).toBe(0);
    expect(achievementClaimMotion('off').stampMs).toBe(0);
  });

  it('raises cascade pitch monotonically across a perfect fifth', () => {
    const pitches = Array.from({ length: 8 }, (_, index) => achievementClaimPitch(index, 8));
    expect(pitches[0]).toBe(1);
    expect(pitches.at(-1)).toBeCloseTo(2 ** (7 / 12));
    expect(pitches.every((pitch, index) => index === 0 || pitch > pitches[index - 1])).toBe(true);
  });
});

/**
 * Text heights for the headless half: a line box of 1.25 em at the role's
 * size in force. Real glyph metrics are the rendered probe's job; these rules
 * hold for any heights, and these exercise them at every text size.
 */
const line = (size: number): number => Math.ceil(size * 1.25);
const rowMeasure = (titleLines: number, goalLines: number) => ({
  titleHeight: titleLines * line(theme.type.label),
  titleLineHeight: line(theme.type.label),
  goalHeight: goalLines * line(theme.type.caption),
  goalLineHeight: line(theme.type.caption),
  progressHeight: 2 * line(theme.type.caption),
});
const titleSafe = theme.design.titleSafe;

describe('the measured goal list', () => {
  it('keeps every row of a page inside the list band, apart by the release gap, in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      for (const [titleLines, goalLines] of [[1, 1], [2, 2], [3, 3]]) {
        const row = achievementRowLayout(rowMeasure(titleLines, goalLines));
        const list = achievementListLayout(row.height);
        const cells = Array.from({ length: list.perPage }, (_, i) => list.cell(i));
        for (const [i, { x, y }] of cells.entries()) {
          expect(x, cell.name).toBeGreaterThanOrEqual(titleSafe.left);
          expect(x + list.rowWidth, cell.name).toBeLessThanOrEqual(titleSafe.right);
          expect(y, cell.name).toBeGreaterThanOrEqual(ACHIEVEMENT_LIST.top);
          expect(y + list.rowHeight, `${cell.name}: above the pager`).toBeLessThanOrEqual(ACHIEVEMENT_LIST.bottom);
          for (const other of cells.slice(i + 1)) {
            const apartX = other.x >= x + list.rowWidth + ACHIEVEMENT_LIST.rowGap || x >= other.x + list.rowWidth + ACHIEVEMENT_LIST.rowGap;
            const apartY = other.y >= y + list.rowHeight + ACHIEVEMENT_LIST.rowGap || y >= other.y + list.rowHeight + ACHIEVEMENT_LIST.rowGap;
            expect(apartX || apartY, `${cell.name}: rows ${i} and ${cells.indexOf(other)}`).toBe(true);
          }
        }
      }
    });
  });

  it('holds the title block, the goal and the progress column inside the row in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      for (const [titleLines, goalLines] of [[1, 1], [2, 1], [1, 3], [3, 3]]) {
        const m = rowMeasure(titleLines, goalLines);
        const row = achievementRowLayout(m);
        expect(row.titleTop, cell.name).toBeGreaterThanOrEqual(ACHIEVEMENT_ROW.inset);
        expect(row.goalTop, cell.name).toBeGreaterThanOrEqual(row.titleTop + m.titleHeight + ACHIEVEMENT_ROW.inset);
        expect(row.goalTop + m.goalHeight + ACHIEVEMENT_ROW.inset, cell.name).toBeLessThanOrEqual(row.height);
        expect(m.progressHeight + 2 * ACHIEVEMENT_ROW.inset, cell.name).toBeLessThanOrEqual(row.height);
      }
    });
  });

  it('pages the release list at standard text: eight 50px rows a column at a 56px pitch from y 196', () => {
    // Inter's rendered single lines at 14 and 12px (17 and 15px) keep the
    // release row, whose title and goal centres sat at 14 and 35.
    const row = achievementRowLayout({ titleHeight: 17, titleLineHeight: 17, goalHeight: 15, goalLineHeight: 15, progressHeight: 15 });
    expect(row).toEqual({ height: 50, titleTop: 5.5, goalTop: 27.5 });
    const list = achievementListLayout(row.height);
    expect([list.rowsPerColumn, list.perPage, list.pitch]).toEqual([8, 16, 56]);
    expect([list.cell(0), list.cell(8)]).toEqual([{ x: 72, y: 196 }, { x: 72 + 552 + 32, y: 196 }]);
  });

  it('keeps a wing plinth inside its wing and below the wing summary in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      for (const titleLines of [1, 2, 3]) {
        for (const frame of hallWingFrames()) {
          const titleHeight = titleLines * line(theme.type.label);
          const statusHeight = line(theme.type.micro);
          const p = hallPlinthLayout(frame, { titleHeight, titleLineHeight: line(theme.type.label), statusHeight, statusLineHeight: statusHeight });
          // The wing summary line is centred 56px into the frame.
          expect(p.y, `${cell.name}: ${titleLines} title lines`).toBeGreaterThanOrEqual(frame.y + 56 + line(theme.type.caption) / 2 + ACHIEVEMENT_ROW.inset);
          expect(p.y + p.height).toBeLessThanOrEqual(frame.y + frame.h);
          expect(p.x + p.width).toBeLessThanOrEqual(frame.x + frame.w);
          expect(p.statusTop, cell.name).toBeGreaterThanOrEqual(p.titleTop + titleHeight + ACHIEVEMENT_ROW.inset);
          expect(p.statusTop + statusHeight + ACHIEVEMENT_ROW.inset, cell.name).toBeLessThanOrEqual(p.height);
        }
      }
    });
  });
});
