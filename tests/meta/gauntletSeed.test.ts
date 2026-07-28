import { describe, expect, it } from 'vitest';
import {
  clampSeed,
  daySeed,
  localDateKey,
  resolveGauntletRoster,
  rosterOrder,
  rungSeed,
} from '../../src/meta/gauntletSeed';

describe('clampSeed', () => {
  it('maps any number into the 31-bit non-zero seed domain', () => {
    expect(clampSeed(0)).toBe(1); // never 0 (xoshiro all-zero guard upstream)
    expect(clampSeed(-5)).toBe(5); // sign stripped
    expect(clampSeed(12345)).toBe(12345);
    expect(clampSeed(3.9)).toBe(3); // truncated, not rounded
    expect(clampSeed(2 ** 31)).toBe(1); // wraps to 0 → coerced to 1
    expect(clampSeed(2 ** 31 + 7)).toBe(7);
    expect(clampSeed(NaN)).toBe(1);
    expect(clampSeed(Infinity)).toBe(1);
  });

  it('always returns a valid 31-bit positive integer', () => {
    for (const n of [0, 1, -1, 999999, 2 ** 31, -(2 ** 40), 1.5e9]) {
      const s = clampSeed(n);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThan(2 ** 31);
    }
  });
});

describe('rungSeed', () => {
  it('is deterministic for the same (runSeed, rung)', () => {
    expect(rungSeed(42, 3)).toBe(rungSeed(42, 3));
    expect(rungSeed(1234567, 8)).toBe(rungSeed(1234567, 8));
  });

  it('gives every rung of a run a distinct seed', () => {
    const runSeed = 987654321;
    const seeds = new Set<number>();
    for (let rung = 1; rung <= 8; rung++) seeds.add(rungSeed(runSeed, rung));
    expect(seeds.size).toBe(8); // no two rungs collide → each duel differs
  });

  it('two different run seeds diverge on the same rung', () => {
    // Sample many run seeds: the same rung must almost never collide across runs.
    let collisions = 0;
    for (let a = 1; a <= 50; a++) {
      for (let b = a + 1; b <= 50; b++) {
        if (rungSeed(a, 4) === rungSeed(b, 4)) collisions++;
      }
    }
    expect(collisions).toBe(0);
  });

  it('stays in the 31-bit domain that Game/AI seeding expects', () => {
    for (let runSeed = 1; runSeed <= 20; runSeed++) {
      for (let rung = 1; rung <= 8; rung++) {
        const s = rungSeed(runSeed, rung);
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThan(2 ** 31);
      }
    }
  });

  it('normalizes an out-of-range runSeed the same as clampSeed would', () => {
    expect(rungSeed(-42, 2)).toBe(rungSeed(42, 2)); // sign-stripped by clampSeed
    expect(rungSeed(2 ** 31 + 9, 5)).toBe(rungSeed(9, 5)); // wrapped
  });
});

describe('daySeed', () => {
  it('is deterministic and separates adjacent calendar days', () => {
    expect(daySeed(20260720)).toBe(daySeed(20260720));
    expect(daySeed(20260720)).not.toBe(daySeed(20260721));
  });

  it('always returns a non-zero 31-bit seed', () => {
    for (const dateKey of [20250101, 20251231, 20260720, 20260721]) {
      const seed = daySeed(dateKey);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThan(0);
      expect(seed).toBeLessThan(2 ** 31);
    }
  });
});

describe('localDateKey', () => {
  it('uses the local calendar across month and year boundaries', () => {
    expect(localDateKey(new Date(2025, 0, 31, 23, 59).getTime())).toBe(20250131);
    expect(localDateKey(new Date(2025, 1, 1, 0, 1).getTime())).toBe(20250201);
    expect(localDateKey(new Date(2025, 11, 31, 23, 59).getTime())).toBe(20251231);
    expect(localDateKey(new Date(2026, 0, 1, 0, 1).getTime())).toBe(20260101);
  });
});

describe('rosterOrder', () => {
  for (const count of [14, 16, 18]) {
    it(`returns a deterministic ${count}-entry permutation that varies by seed`, () => {
      const first = rosterOrder(12345, count);
      const repeated = rosterOrder(12345, count);
      const otherSeed = rosterOrder(67890, count);

      expect(first).toEqual(repeated);
      expect(first).not.toEqual(otherSeed);
      expect([...first].sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_, index) => index),
      );
    });
  }
});

describe('resolveGauntletRoster', () => {
  const todayDay = 20260720;
  const count = 14;

  it("uses today's full seeded shuffle before a run starts", () => {
    expect(resolveGauntletRoster(null, todayDay, count)).toEqual({
      rosterDay: todayDay,
      rosterSeed: daySeed(todayDay),
      order: rosterOrder(daySeed(todayDay), count),
      fixed: false,
    });
  });

  it("gives an active run's stamped roster precedence across midnight", () => {
    const rosterDay = 20260719;
    const rosterSeed = daySeed(rosterDay);
    const resolved = resolveGauntletRoster({ rosterDay, rosterSeed }, todayDay, count);

    expect(resolved).toEqual({
      rosterDay,
      rosterSeed,
      order: rosterOrder(rosterSeed, count),
      fixed: false,
    });
    expect(resolved.order).not.toEqual(rosterOrder(daySeed(todayDay), count));
  });

  it('keeps sentinel and unstamped active runs in fixed AVATARS-by-tier order', () => {
    const fixed = Array.from({ length: count }, (_, index) => index);
    expect(resolveGauntletRoster({ rosterDay: 0, rosterSeed: 0 }, todayDay, count)).toEqual({
      rosterDay: 0,
      rosterSeed: 0,
      order: fixed,
      fixed: true,
    });
    expect(resolveGauntletRoster({}, todayDay, count).order).toEqual(fixed);
  });
});
