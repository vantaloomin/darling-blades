import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import type { GameEvent } from '../../src/engine/events';
import {
  applyDailyQuestProgress,
  claimDailyQuest,
  DAILY_QUESTS,
  dailyQuestDef,
  dailyQuestStatuses,
  dailyRerollsRemaining,
  dailyStreakStatus,
  ensureDailyState,
  recordDailyWin,
  rerollDailyQuest,
  rollDailyQuestIds,
} from '../../src/meta/Quests';
import { freshSave, type DailyQuestSave } from '../../src/meta/SaveManager';
import { TEST_DB } from '../helpers';

function questState(id: string, progress = 0): DailyQuestSave {
  const def = dailyQuestDef(id);
  if (!def) throw new Error(`Missing daily quest fixture: ${id}`);
  return { id, progress, target: def.target, rewardGold: def.rewardGold, claimed: false };
}

function setDailyQuests(ids: string[]): ReturnType<typeof freshSave> {
  const save = freshSave(0);
  save.daily = {
    day: '2026-07-08',
    quests: ids.map((id) => questState(id)),
    rerollsUsed: 0,
    streak: { count: 0, lastWinDay: null },
  };
  return save;
}

describe('daily quests', () => {
  it('has a 25-objective bank and rolls three deterministic unique quests', () => {
    expect(DAILY_QUESTS).toHaveLength(25);
    expect(new Set(DAILY_QUESTS.map((q) => q.id)).size).toBe(25);

    const a = rollDailyQuestIds('2026-07-08');
    const b = rollDailyQuestIds('2026-07-08');
    expect(a).toEqual(b);
    expect(a).toHaveLength(ECONOMY.dailyQuestCount);
    expect(new Set(a).size).toBe(ECONOMY.dailyQuestCount);
  });

  it('folds public duel events into active quest progress and caps completion', () => {
    const save = setDailyQuests(['cast-creatures-5', 'deal-damage-20', 'win-one']);
    const events: GameEvent[] = [
      { e: 'spellCast', sid: 1, cardId: 'bear', controller: 0, targets: [] },
      { e: 'spellCast', sid: 2, cardId: 'shock', controller: 0, targets: [] },
      { e: 'spellCast', sid: 3, cardId: 'bear', controller: 1, targets: [] },
      { e: 'lifeChanged', player: 1, delta: -8, now: 12 },
      { e: 'gameEnded', winner: 0, reason: 'life' },
    ];

    const first = applyDailyQuestProgress(save, TEST_DB, events, '2026-07-08');
    expect(first.changed).toBe(true);
    expect(save.daily.quests.map((q) => q.progress)).toEqual([1, 8, 1]);
    expect(first.completedQuestIds).toEqual(['win-one']);

    applyDailyQuestProgress(save, TEST_DB, [{ e: 'lifeChanged', player: 1, delta: -50, now: 13 }], '2026-07-08');
    expect(save.daily.quests[1].progress).toBe(20);
  });

  it('claims completed quests once and pays gold through the save', () => {
    const save = setDailyQuests(['win-one', 'play-lands-5', 'cast-red-3']);
    save.daily.quests[0].progress = save.daily.quests[0].target;

    const claim = claimDailyQuest(save, 0, '2026-07-08');
    expect(claim).toEqual({ ok: true, gold: ECONOMY.dailyQuestGold });
    expect(save.gold).toBe(ECONOMY.dailyQuestGold);
    expect(save.daily.quests[0].claimed).toBe(true);

    expect(claimDailyQuest(save, 0, '2026-07-08')).toEqual({
      ok: false,
      gold: 0,
      reason: 'already-claimed',
    });
    expect(save.gold).toBe(ECONOMY.dailyQuestGold);
  });

  it('rerolls individual unclaimed quests up to three total times per day', () => {
    const save = freshSave(0);
    ensureDailyState(save, '2026-07-08');

    for (let i = 0; i < ECONOMY.dailyRerollsPerDay; i++) {
      expect(rerollDailyQuest(save, 0, '2026-07-08')).toEqual({ ok: true });
      expect(new Set(save.daily.quests.map((q) => q.id)).size).toBe(ECONOMY.dailyQuestCount);
    }

    expect(save.daily.rerollsUsed).toBe(ECONOMY.dailyRerollsPerDay);
    expect(dailyRerollsRemaining(save, '2026-07-08')).toBe(0);
    expect(rerollDailyQuest(save, 0, '2026-07-08')).toEqual({ ok: false, reason: 'limit' });
  });

  it('rolls a new day while preserving only an active win streak', () => {
    const save = freshSave(0);
    ensureDailyState(save, '2026-07-08');
    save.daily.quests[0].progress = 2;
    save.daily.rerollsUsed = 2;
    recordDailyWin(save, '2026-07-08');

    expect(ensureDailyState(save, '2026-07-09')).toBe(true);
    expect(save.daily.day).toBe('2026-07-09');
    expect(save.daily.quests).toHaveLength(ECONOMY.dailyQuestCount);
    expect(save.daily.quests.every((q) => q.progress === 0 && !q.claimed)).toBe(true);
    expect(save.daily.rerollsUsed).toBe(0);
    expect(dailyStreakStatus(save, '2026-07-09')).toMatchObject({
      count: 1,
      wonToday: false,
      nextCount: 2,
      nextGold: ECONOMY.dailyStreakGold[1],
    });
  });

  it('advances streaks only on wins, not merely on games played', () => {
    const save = setDailyQuests(['finish-two', 'win-one', 'deal-damage-20']);

    applyDailyQuestProgress(save, TEST_DB, [{ e: 'gameEnded', winner: 1, reason: 'life' }], '2026-07-08');
    expect(dailyQuestStatuses(save, '2026-07-08')[0].progress).toBe(1);
    expect(dailyStreakStatus(save, '2026-07-08')).toMatchObject({
      count: 0,
      wonToday: false,
      nextCount: 1,
    });
    expect(save.gold).toBe(0);

    const firstWin = recordDailyWin(save, '2026-07-08');
    expect(firstWin).toEqual({ advanced: true, count: 1, gold: ECONOMY.dailyStreakGold[0] });
    expect(recordDailyWin(save, '2026-07-08')).toEqual({ advanced: false, count: 1, gold: 0 });

    const secondWin = recordDailyWin(save, '2026-07-09');
    expect(secondWin).toEqual({ advanced: true, count: 2, gold: ECONOMY.dailyStreakGold[1] });

    ensureDailyState(save, '2026-07-11');
    expect(dailyStreakStatus(save, '2026-07-11').count).toBe(0);
    expect(recordDailyWin(save, '2026-07-11')).toMatchObject({ advanced: true, count: 1 });
  });
});
