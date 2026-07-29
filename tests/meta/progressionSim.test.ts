import { describe, expect, it } from 'vitest';
import {
  PLAYER_PERSONAS,
  packChoiceForPreference,
  renderProgressionReport,
  runProgressionSimulation,
} from '../../scripts/progression-sim';
import { ECONOMY } from '../../src/config/rules';

describe('progression simulation harness', () => {
  it('maps every pack preference to a purchasable set SKU', () => {
    expect(packChoiceForPreference('base', 0)).toEqual({ price: ECONOMY.packPrice, set: 'base' });
    expect(packChoiceForPreference('mixed', 1, 0.9)).toEqual({ price: ECONOMY.packPrice, set: 'base' });
    // Every choice names a set: an unscoped choice would buy the pre-1.5
    // all-sets product that no SKU sells any more.
    for (const preference of ['base', 'ragnarok', 'arthurian-court', 'mixed'] as const) {
      for (let day = 0; day < 12; day++) {
        expect(packChoiceForPreference(preference, day, 0.1)?.set).toBeDefined();
      }
    }
  });

  it('rotates mixed buyers through every released expansion', () => {
    // A mixed persona that only ever saw one expansion was structurally capped
    // at (205 + 70) / 758 of the pool once Base Set was scoped to its own
    // cards, which is what pinned all six mixed personas near 33% on
    // 2026-07-29 before this rotation existed.
    const sets = new Set<string>();
    for (let day = 0; day < 24; day++) {
      const choice = packChoiceForPreference('mixed', day, 0.1);
      if (choice?.set && choice.set !== 'base') sets.add(choice.set);
    }
    expect([...sets].sort()).toEqual([
      'arthurian-court',
      'celtic-fae',
      'dark-tales',
      'gothic-monsters',
      'ragnarok',
      'yokai-nights',
    ]);
  });

  it('defines 10 unique named player personas', () => {
    expect(PLAYER_PERSONAS).toHaveLength(10);
    expect(new Set(PLAYER_PERSONAS.map((p) => p.id)).size).toBe(10);
    expect(new Set(PLAYER_PERSONAS.map((p) => p.name)).size).toBe(10);
    expect(PLAYER_PERSONAS.map((p) => p.name)).toEqual([
      'New Casual',
      'Daily Grinder',
      'Gauntlet Climber',
      'Limited Fan',
      'Collector',
      'Theme Deck Buyer',
      'Hardcore Optimizer',
      'Low Skill Casual',
      'High Skill Veteran',
      'Completionist',
    ]);
    expect(PLAYER_PERSONAS.some((p) => p.limited?.premiumWhenAffordable)).toBe(true);
    expect(PLAYER_PERSONAS.filter((p) => p.limited).every((p) => !('mode' in p.limited!))).toBe(true);
  });

  it('runs deterministically across fixed seeds', () => {
    const personas = [PLAYER_PERSONAS[0], PLAYER_PERSONAS[3]];
    const options = { seeds: 1, days: [7], baseSeed: 12345, personas };
    const a = runProgressionSimulation(options);
    const b = runProgressionSimulation(options);

    expect(a.snapshots).toEqual(b.snapshots);
    expect(a.aggregates).toEqual(b.aggregates);
    expect(a.snapshots).toHaveLength(personas.length);
    expect(renderProgressionReport(a)).toContain('VERDICT:');
    expect(a.snapshots[0]).toMatchObject({
      goldNet: expect.any(Number),
      collectionSize: expect.any(Number),
      uniqueCards: expect.any(Number),
      duplicateRefundGold: expect.any(Number),
      shardGold: expect.any(Number),
      dailyQuestCompletions: expect.any(Number),
      dailyQuestClaims: expect.any(Number),
      streakLength: expect.any(Number),
      achievementsUnlocked: expect.any(Number),
      achievementsClaimed: expect.any(Number),
      limitedRuns: expect.any(Number),
      premiumDraftRuns: expect.any(Number),
      premiumDraftCardsKept: expect.any(Number),
      sessionMinutes: expect.any(Number),
      rewards: expect.objectContaining({ shards: expect.any(Number) }),
      spent: expect.objectContaining({ premiumDraftEntries: expect.any(Number) }),
    });

    const limitedFan = a.snapshots.find((row) => row.personaId === 'limited-fan');
    expect(limitedFan).toMatchObject({
      limitedRuns: 7,
      premiumDraftRuns: expect.any(Number),
      premiumDraftCardsKept: expect.any(Number),
    });
    expect(limitedFan!.premiumDraftRuns).toBe(2);
    expect(limitedFan!.premiumDraftCardsKept).toBeGreaterThan(0);
    expect(limitedFan!.spent.premiumDraftEntries).toBe(
      limitedFan!.premiumDraftRuns * ECONOMY.premiumDraftEntry,
    );
    const rendered = renderProgressionReport(a);
    expect(rendered).toContain('ShardGold');
    expect(rendered).toContain('PremKeep');
    expect(rendered).toContain('Premium');
  // CI runners are 2-core and can contend with other simulation tests.
  }, 30_000);
});
