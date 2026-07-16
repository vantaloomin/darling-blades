import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import type { PolicyDayPlan, PolicyView } from '../../scripts/progression-sim';
import { optimizerPolicy, rankOptimizerActions } from '../../scripts/optimizerPolicy';

function view(overrides: Partial<PolicyView> = {}): PolicyView {
  return {
    day: 1,
    today: '2026-07-15',
    gold: 0,
    collectionPct: 0.1,
    collectionSize: 10,
    packsOpened: 0,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    minutesUsed: 0,
    minutesBudget: 45,
    minutesRemaining: 45,
    quests: [],
    quest: { completed: 0, claimed: 0, rerollsRemaining: 0 },
    gauntlet: { activeRung: null, bestRung: 0, completions: 0 },
    streak: { count: 0, wonToday: false, nextCount: 1, nextGold: ECONOMY.dailyStreakGold[0] },
    limited: { active: false, premium: false },
    achievements: { unlocked: 0, claimed: 0 },
    premiumDraftAffordable: false,
    ...overrides,
  };
}

function plannedMinutes(plan: PolicyDayPlan): number {
  const practice = (plan.practice?.count ?? 0) * 10;
  const gauntlet = (plan.gauntlet?.matches ?? 0) * 12;
  const limitedMatches = plan.limited?.matches ?? 0;
  const limited = limitedMatches > 0 ? 14 + limitedMatches * 14 : 0;
  const rerolls = (plan.quests?.rerollIndexes?.length ?? 0) * 0.5;
  return practice + gauntlet + limited + rerolls;
}

describe('optimizer policy', () => {
  it('is deterministic for identical PolicyView values', () => {
    const a = view({ gold: 1_200, premiumDraftAffordable: true });
    const b = { ...a, quests: [...a.quests], quest: { ...a.quest }, gauntlet: { ...a.gauntlet }, streak: { ...a.streak } };

    expect(optimizerPolicy(a)).toEqual(optimizerPolicy(b));
    expect(rankOptimizerActions(a)).toEqual(rankOptimizerActions(b));
  });

  it('chooses the strictly dominant modeled faucet when the day has room for it', () => {
    const current = view({ minutesBudget: 20, minutesRemaining: 20 });
    const ranked = rankOptimizerActions(current);
    const practice = ranked.find((action) => action.kind === 'practice');
    const limited = ranked.find((action) => action.kind === 'free-draft');

    expect(practice).toBeDefined();
    expect(limited).toBeDefined();
    expect(practice!.goldPerMinute).toBeGreaterThan(limited!.goldPerMinute);
    expect(optimizerPolicy(current).practice).toEqual({ difficulty: 'medium', count: 2 });
  });

  it('keeps both draft actions as candidates when the 56-minute run fits the 57-minute budget', () => {
    const current = view({
      gold: ECONOMY.premiumDraftEntry,
      minutesBudget: 57,
      minutesRemaining: 57,
      premiumDraftAffordable: true,
    });
    const draftActions = rankOptimizerActions(current).filter(
      (action) => action.kind === 'free-draft' || action.kind === 'premium-draft',
    );

    expect(draftActions.map((action) => action.kind)).toEqual(['free-draft', 'premium-draft']);
    expect(draftActions.every((action) => action.minutes <= current.minutesRemaining)).toBe(true);
  });

  it('never exceeds the minutes budget or schedules unaffordable spending', () => {
    const current = view({
      gold: ECONOMY.premiumDraftEntry - 1,
      minutesBudget: 45,
      minutesRemaining: 45,
      premiumDraftAffordable: false,
    });
    const plan = optimizerPolicy(current);

    expect(plannedMinutes(plan)).toBeLessThanOrEqual(current.minutesRemaining);
    expect(plan.limited?.premium).not.toBe(true);
    expect(plan.spending?.packPreference).toBe('none');
    expect(plan.spending?.reserveGold ?? 0).toBeGreaterThanOrEqual(0);
  });
});
