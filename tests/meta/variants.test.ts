import { describe, expect, it } from 'vitest';
import { DROPS, ECONOMY } from '../../src/config/rules';
import { createRngState } from '../../src/engine/rng';
import { openPack } from '../../src/meta/PackOpener';
import { freshSave } from '../../src/meta/SaveManager';
import {
  isPlainVariant,
  parseVariantKey,
  PLAIN_VARIANT,
  rollFrame,
  rollHolo,
  rollTier,
  variantKey,
  variantRank,
} from '../../src/meta/variants';
import { TEST_DB } from '../helpers';

describe('variant keys and ranking', () => {
  it('variantKey/parseVariantKey round-trip', () => {
    const v = { frame: 'gold', holo: 'pearlescent' } as const;
    expect(variantKey(v)).toBe('gold|pearlescent');
    expect(parseVariantKey('gold|pearlescent')).toEqual(v);
    expect(parseVariantKey(variantKey(PLAIN_VARIANT))).toEqual(PLAIN_VARIANT);
  });

  it('PLAIN is white|none and ranks lowest; frame outranks holo', () => {
    expect(PLAIN_VARIANT).toEqual({ frame: 'white', holo: 'none' });
    expect(isPlainVariant(PLAIN_VARIANT)).toBe(true);
    expect(isPlainVariant({ frame: 'white', holo: 'shiny' })).toBe(false);
    expect(variantRank(PLAIN_VARIANT)).toBe(0);
    // frame is the primary axis: the plainest blue beats the fanciest white
    expect(variantRank({ frame: 'blue', holo: 'none' })).toBeGreaterThan(
      variantRank({ frame: 'white', holo: 'void' }),
    );
    // holo breaks ties within a frame
    expect(variantRank({ frame: 'black', holo: 'void' })).toBeGreaterThan(
      variantRank({ frame: 'black', holo: 'fractal' }),
    );
  });
});

describe('DROPS tables', () => {
  it('every table sums to exactly 100', () => {
    for (const table of [DROPS.tier, DROPS.frame, DROPS.holo]) {
      const sum = table.reduce((s, [, w]) => s + w, 0);
      expect(sum).toBeCloseTo(100, 9);
    }
  });

  it('god-roll arithmetic: P(ur ∧ black ∧ void) ≈ 1 in 4.94M', () => {
    const weight = (table: readonly (readonly [string, number])[], key: string): number =>
      table.find(([k]) => k === key)![1];
    const p =
      (weight(DROPS.tier, 'ur') / 100) *
      (weight(DROPS.frame, 'black') / 100) *
      (weight(DROPS.holo, 'void') / 100);
    const oneIn = 1 / p;
    // 0.01 · 0.0045 · 0.0045 = 2.025e-7 → 1 in ~4,938,272 ("1 in 5,000,000")
    expect(oneIn).toBeGreaterThan(4_600_000);
    expect(oneIn).toBeLessThan(5_300_000);
  });

  it('rolls are deterministic per seed', () => {
    const a = createRngState(99);
    const b = createRngState(99);
    for (let i = 0; i < 200; i++) {
      expect(rollTier(a)).toBe(rollTier(b));
      expect(rollFrame(a)).toBe(rollFrame(b));
      expect(rollHolo(a)).toBe(rollHolo(b));
    }
  });
});

describe('seeded drop distribution', () => {
  it('2000 packs land near the DROPS weights on every axis', () => {
    // One seeded run — deterministic, so these are fixed measurements, not
    // flaky statistics. n = 2000 × 15 = 30,000 slots. Bands are ±~3–4 sd
    // around the table weights. Measured 2026-07-04 (seed 12345, %):
    //   tier  c 49.523 / r 30.017 / sr 14.163 / ssr 5.320 / ur 0.977
    //   frame white 49.950 / blue 29.847 / red 15.147 / gold 3.497
    //         / rainbow 1.023 / black 0.537
    //   holo  none 60.277 / shiny 19.937 / rainbow 10.170 / pearlescent 7.587
    //         / fractal 1.547 / void 0.483
    const save = freshSave(0);
    const rng = createRngState(12345);
    const tier: Record<string, number> = {};
    const frame: Record<string, number> = {};
    const holo: Record<string, number> = {};
    const packs = 2000;
    for (let i = 0; i < packs; i++) {
      const result = openPack(save, TEST_DB, rng);
      for (const c of result.cards) {
        tier[c.tier] = (tier[c.tier] ?? 0) + 1;
        frame[c.frame] = (frame[c.frame] ?? 0) + 1;
        holo[c.holo] = (holo[c.holo] ?? 0) + 1;
      }
    }
    const n = packs * ECONOMY.packSize;
    const pct = (m: Record<string, number>, k: string): number => ((m[k] ?? 0) / n) * 100;

    const expectBand = (
      m: Record<string, number>,
      k: string,
      lo: number,
      hi: number,
    ): void => {
      const v = pct(m, k);
      expect(v, `${k} = ${v.toFixed(3)}% outside [${lo}, ${hi}]`).toBeGreaterThanOrEqual(lo);
      expect(v, `${k} = ${v.toFixed(3)}% outside [${lo}, ${hi}]`).toBeLessThanOrEqual(hi);
    };

    // tier weights: c 50 / r 30 / sr 14 / ssr 5 / ur 1
    expectBand(tier, 'c', 48, 52);
    expectBand(tier, 'r', 28, 32);
    expectBand(tier, 'sr', 12.5, 15.5);
    expectBand(tier, 'ssr', 4.2, 5.8);
    expectBand(tier, 'ur', 0.7, 1.3);

    // frame weights: white 50 / blue 30 / red 15 / gold 3.55 / rainbow 1 / black 0.45
    expectBand(frame, 'white', 48, 52);
    expectBand(frame, 'blue', 28, 32);
    expectBand(frame, 'red', 13.5, 16.5);
    expectBand(frame, 'gold', 2.9, 4.2);
    expectBand(frame, 'rainbow', 0.7, 1.3);
    expectBand(frame, 'black', 0.3, 0.62);

    // holo weights: none 60 / shiny 20 / rainbow 10 / pearlescent 8 / fractal 1.55 / void 0.45
    expectBand(holo, 'none', 58, 62);
    expectBand(holo, 'shiny', 18.5, 21.5);
    expectBand(holo, 'rainbow', 9, 11);
    expectBand(holo, 'pearlescent', 7, 9);
    expectBand(holo, 'fractal', 1.15, 2.0);
    expectBand(holo, 'void', 0.3, 0.62);

    // Log the measured run so the numbers in reports stay honest.
    console.log(
      'drop distribution (seed 12345, 2000 packs, % of 30000 slots):',
      JSON.stringify({
        tier: Object.fromEntries(Object.entries(tier).map(([k, v]) => [k, +((v / n) * 100).toFixed(3)])),
        frame: Object.fromEntries(Object.entries(frame).map(([k, v]) => [k, +((v / n) * 100).toFixed(3)])),
        holo: Object.fromEntries(Object.entries(holo).map(([k, v]) => [k, +((v / n) * 100).toFixed(3)])),
      }),
    );
  });
});
