import { ACHIEVEMENTS } from '../meta/Achievements';
import { queueToast } from './Toast';
import type { ToastSummary } from './toastQueue';

const ACHIEVEMENTS_ROUTE = { scene: 'Achievements', data: { page: 0, filter: 'ready' } } as const;

/** Queue presentation-only notices. Claiming remains owned by AchievementsScene. */
export function queueAchievementUnlockToasts(ids: readonly string[]): void {
  const defs = ids
    .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
    .filter((achievement): achievement is (typeof ACHIEVEMENTS)[number] => achievement !== undefined);
  if (defs.length === 0) return;

  const totalGold = defs.reduce((sum, achievement) => sum + achievement.reward.gold, 0);
  const collapseSummary: ToastSummary = {
    title: 'ACHIEVEMENTS UNLOCKED',
    body: `${defs.length} new goals are ready.`,
    detail: `Claim +${totalGold} Gold in Achievements`,
    cue: 'seal',
    action: ACHIEVEMENTS_ROUTE,
  };
  for (const achievement of defs) {
    queueToast({
      title: 'ACHIEVEMENT UNLOCKED',
      body: achievement.title,
      detail: `Claim +${achievement.reward.gold} Gold in Achievements`,
      cue: 'seal',
      action: ACHIEVEMENTS_ROUTE,
      collapseSummary,
    });
  }
}
