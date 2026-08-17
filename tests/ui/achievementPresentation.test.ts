import { describe, expect, it } from 'vitest';
import {
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
    expect(motion).toMatchObject({ stampMs: 180, settleMs: 100, staggerMs: 70 });
    expect(motion.stampMs + motion.settleMs).toBeLessThanOrEqual(300);
    expect(achievementCascadeDelay(3, 'full')).toBe(210);
  });

  it('removes transform motion for reduced animation while retaining a short fade cascade', () => {
    const motion = achievementClaimMotion('reduced');
    expect(motion).toEqual({
      stampMs: 100,
      settleMs: 0,
      staggerMs: 50,
      scaleFrom: 1,
      angleFrom: 0,
      angleTo: 0,
    });
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
