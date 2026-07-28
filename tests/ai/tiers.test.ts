import { describe, expect, it } from 'vitest';
import { tierMonotonicityFlags } from '../../scripts/balance-matrix';
import { HardAI } from '../../src/ai/HardAI';
import {
  buildTierAI,
  floorBrain,
  floorDifficultyPips,
  floorTier,
  TIER_DEFS,
  type TowerTier,
} from '../../src/ai/tiers';
import { TEST_DB } from '../helpers';

describe('tower AI tiers', () => {
  it('defines six ordered brain tiers with decreasing noise within each brain', () => {
    const tiers = Object.keys(TIER_DEFS).map(Number) as TowerTier[];
    expect(tiers).toEqual([1, 2, 3, 4, 5, 6]);
    expect(tiers.map((tier) => TIER_DEFS[tier].brain)).toEqual([
      'easy',
      'easy',
      'medium',
      'medium',
      'hard',
      'hard',
    ]);
    expect(TIER_DEFS[1].noise).toBeGreaterThan(TIER_DEFS[2].noise);
    expect(TIER_DEFS[3].noise).toBeGreaterThan(TIER_DEFS[4].noise);
    expect(TIER_DEFS[5].noise).toBeGreaterThan(TIER_DEFS[6].noise);
    expect(TIER_DEFS[6].noise).toBe(0);
  });

  it('returns the bare HardAI at tier 6', () => {
    expect(buildTierAI(6, TEST_DB, 123)).toBeInstanceOf(HardAI);
  });

  it('maps all 18 floors and clamps later floors to tier 6', () => {
    expect(Array.from({ length: 18 }, (_, i) => floorTier(i + 1))).toEqual([
      1, 1, 1,
      2, 2, 2,
      3, 3, 3,
      4, 4, 4,
      5, 5, 5,
      6, 6, 6,
    ]);
    expect(floorTier(19)).toBe(6);
    expect(floorTier(1000)).toBe(6);
  });

  it('derives difficulty labels and pips from the floor brain', () => {
    expect(Array.from({ length: 18 }, (_, i) => floorBrain(i + 1))).toEqual([
      'easy', 'easy', 'easy', 'easy', 'easy', 'easy',
      'medium', 'medium', 'medium', 'medium', 'medium', 'medium',
      'hard', 'hard', 'hard', 'hard', 'hard', 'hard',
    ]);
    expect(Array.from({ length: 18 }, (_, i) => floorDifficultyPips(i + 1))).toEqual([
      1, 1, 1, 1, 1, 1,
      2, 2, 2, 2, 2, 2,
      3, 3, 3, 3, 3, 3,
    ]);
  });

  it('accepts an exact 4pp matrix gap and flags a smaller adjacent gap', () => {
    expect(tierMonotonicityFlags([
      { tier: 1, avg: 0.56 },
      { tier: 2, avg: 0.60 },
    ])).toEqual([]);
    expect(tierMonotonicityFlags([
      { tier: 1, avg: 0.56 },
      { tier: 2, avg: 0.599 },
    ])).toHaveLength(1);
  });
});
