import { describe, expect, it } from 'vitest';
import { DROPS, ECONOMY } from '../../src/config/rules';
import { createRngState } from '../../src/engine/rng';
import { openPack } from '../../src/meta/PackOpener';
import { formatOdds, variantOdds } from '../../src/meta/pullOdds';
import { freshSave } from '../../src/meta/SaveManager';
import {
  isPlainVariant,
  parseVariantKey,
  PLAIN_VARIANT,
  rollFrame,
  rollFullArt,
  rollHolo,
  rollTier,
  variantKey,
  variantRank,
} from '../../src/meta/variants';
import { TEST_DB } from '../helpers';

describe('variant keys and ranking', () => {
  it('variantKey/parseVariantKey round-trip', () => {
    const v = { frame: 'gold', holo: 'pearlescent', fullArt: true } as const;
    expect(variantKey(v)).toBe('gold|pearlescent|full-art');
    expect(parseVariantKey('gold|pearlescent|full-art')).toEqual(v);
    expect(parseVariantKey('gold|pearlescent')).toEqual({ ...v, fullArt: false });
    expect(parseVariantKey(variantKey(PLAIN_VARIANT))).toEqual(PLAIN_VARIANT);
  });

  it('PLAIN is white|none|standard and ranks lowest; full art outranks black frame', () => {
    expect(PLAIN_VARIANT).toEqual({ frame: 'white', holo: 'none', fullArt: false });
    expect(isPlainVariant(PLAIN_VARIANT)).toBe(true);
    expect(isPlainVariant({ frame: 'white', holo: 'shiny', fullArt: false })).toBe(false);
    expect(isPlainVariant({ frame: 'white', holo: 'none', fullArt: true })).toBe(false);
    expect(variantRank(PLAIN_VARIANT)).toBe(0);
    // frame is the primary axis: the plainest blue beats the fanciest white
    expect(variantRank({ frame: 'blue', holo: 'none', fullArt: false })).toBeGreaterThan(
      variantRank({ frame: 'white', holo: 'void', fullArt: false }),
    );
    // holo breaks ties within a frame
    expect(variantRank({ frame: 'black', holo: 'void', fullArt: false })).toBeGreaterThan(
      variantRank({ frame: 'black', holo: 'fractal', fullArt: false }),
    );
    expect(variantRank({ frame: 'white', holo: 'none', fullArt: true })).toBeGreaterThan(
      variantRank({ frame: 'black', holo: 'void', fullArt: false }),
    );
  });
});

describe('DROPS tables', () => {
  it('every table sums to exactly 100', () => {
    for (const table of [DROPS.tier, DROPS.frame, DROPS.holo, DROPS.fullArt]) {
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
      expect(rollFullArt(a)).toBe(rollFullArt(b));
    }
  });
});

describe('pull odds', () => {
  it('formats the standard UR black void god roll as 1:4.95M', () => {
    const odds = variantOdds('ur', 'black', 'void', false);
    expect(odds).toBeCloseTo(0.01 * 0.0045 * 0.0045 * 0.9975, 12);
    expect(formatOdds(odds)).toBe('1:4.95M');
  });

  it('formats the common white none pull as 1:6.7', () => {
    const odds = variantOdds('c', 'white', 'none', false);
    expect(odds).toBeCloseTo(0.5 * 0.5 * 0.6 * 0.9975, 12);
    expect(formatOdds(odds)).toBe('1:6.7');
  });

  it('derives a mid-table pull from all four independent axes', () => {
    const odds = variantOdds('r', 'gold', 'pearlescent', false);
    expect(odds).toBeCloseTo(0.3 * 0.0355 * 0.08 * 0.9975, 12);
    expect(formatOdds(odds)).toBe('1:1,180');
  });

  it('derives Full Art odds independently of tier, frame, and holo', () => {
    const odds = variantOdds('ur', 'white', 'none', true);
    expect(odds).toBeCloseTo(0.01 * 0.5 * 0.6 * 0.0025, 12);
    expect(formatOdds(odds)).toBe('1:133,000');
  });

  it('rounds and groups format boundaries predictably', () => {
    expect(formatOdds(1 / 15_000)).toBe('1:15,000');
    expect(formatOdds(1 / 10)).toBe('1:10');
    expect(formatOdds(1 / 999_999)).toBe('1:1,000,000');
    expect(formatOdds(1 / 1_000_000)).toBe('1:1.00M');
  });

  it('covers one total outcome across every tier, frame, and holo combination', () => {
    const total = DROPS.tier.reduce(
      (sum, [tier]) => sum + DROPS.frame.reduce(
        (frameSum, [frame]) => frameSum + DROPS.holo.reduce(
          (holoSum, [holo]) => holoSum + DROPS.fullArt.reduce(
            (fullArtSum, [fullArt]) => fullArtSum + variantOdds(tier, frame, holo, fullArt === 'full-art'),
            0,
          ),
          0,
        ),
        0,
      ),
      0,
    );
    expect(total).toBeCloseTo(1, 12);
  });
});

describe('seeded drop distribution', () => {
  it('20000 packs land near every DROPS axis and Full Art stacks independently', () => {
    // One seeded run — deterministic, so these are fixed measurements, not
    // flaky statistics. n = 20,000 × 9 = 180,000 slots. Bands are generous
    // seeded-sample guards. Measured 2026-07-17 (seed 12345, %):
    //   tier  c 49.959 / r 30.047 / sr 13.945 / ssr 5.054 / ur 0.994
    //   frame white 50.006 / blue 29.909 / red 15.126 / gold 3.535
    //         / rainbow 0.961 / black 0.463
    //   holo  none 59.902 / shiny 19.993 / rainbow 10.070 / pearlescent 8.021
    //         / fractal 1.571 / void 0.443
    //   full art 482 pulls = 0.2678%; conditional non-white 54.357%,
    //            holo 38.797%, both 22.407%
    const save = freshSave(0);
    const rng = createRngState(12345);
    const tier: Record<string, number> = {};
    const frame: Record<string, number> = {};
    const holo: Record<string, number> = {};
    let fullArt = 0;
    let fullArtNonWhite = 0;
    let fullArtHolo = 0;
    let fullArtFrameAndHolo = 0;
    const packs = 20_000;
    for (let i = 0; i < packs; i++) {
      const result = openPack(save, TEST_DB, rng);
      for (const c of result.cards) {
        tier[c.tier] = (tier[c.tier] ?? 0) + 1;
        frame[c.frame] = (frame[c.frame] ?? 0) + 1;
        holo[c.holo] = (holo[c.holo] ?? 0) + 1;
        if (c.fullArt) {
          fullArt++;
          if (c.frame !== 'white') fullArtNonWhite++;
          if (c.holo !== 'none') fullArtHolo++;
          if (c.frame !== 'white' && c.holo !== 'none') fullArtFrameAndHolo++;
        }
      }
    }
    const n = packs * ECONOMY.boosterPackSize;
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

    const fullArtPct = (fullArt / n) * 100;
    expect(fullArtPct).toBeGreaterThanOrEqual(0.2);
    expect(fullArtPct).toBeLessThanOrEqual(0.3);
    const conditional = {
      nonWhite: fullArtNonWhite / fullArt,
      holo: fullArtHolo / fullArt,
      both: fullArtFrameAndHolo / fullArt,
    };
    expect(conditional.nonWhite).toBeGreaterThanOrEqual(0.4);
    expect(conditional.nonWhite).toBeLessThanOrEqual(0.6);
    expect(conditional.holo).toBeGreaterThanOrEqual(0.3);
    expect(conditional.holo).toBeLessThanOrEqual(0.5);
    expect(conditional.both).toBeGreaterThanOrEqual(0.12);
    expect(conditional.both).toBeLessThanOrEqual(0.28);

    // Log the measured run so the numbers in reports stay honest.
    console.log(
      `drop distribution (seed 12345, ${packs} packs, ${n} slots):`,
      JSON.stringify({
        tier: Object.fromEntries(Object.entries(tier).map(([k, v]) => [k, +((v / n) * 100).toFixed(3)])),
        frame: Object.fromEntries(Object.entries(frame).map(([k, v]) => [k, +((v / n) * 100).toFixed(3)])),
        holo: Object.fromEntries(Object.entries(holo).map(([k, v]) => [k, +((v / n) * 100).toFixed(3)])),
        fullArt: {
          count: fullArt,
          pct: +fullArtPct.toFixed(4),
          conditionalNonWhitePct: +(conditional.nonWhite * 100).toFixed(3),
          conditionalHoloPct: +(conditional.holo * 100).toFixed(3),
          conditionalBothPct: +(conditional.both * 100).toFixed(3),
        },
      }),
    );
  });
});
