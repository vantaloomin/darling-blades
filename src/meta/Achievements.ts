import type { CardDb } from '../engine/types';
import { collectionCompletion, type CollectionCompletionSummary } from './collectionFilter';
import type { SaveData } from './SaveManager';

export type AchievementBucket = 'collection' | 'variants' | 'mastery' | 'economy';

export interface AchievementReward {
  gold: number;
}

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementDef {
  id: string;
  bucket: AchievementBucket;
  title: string;
  description: string;
  reward: AchievementReward;
  progress: (save: SaveData, db: CardDb, completion: CollectionCompletionSummary) => AchievementProgress;
}

export interface AchievementStatus {
  def: AchievementDef;
  current: number;
  target: number;
  percent: number;
  unlocked: boolean;
  claimed: boolean;
}

export interface ClaimResult {
  ok: boolean;
  gold: number;
  reason?: 'unknown' | 'locked' | 'claimed';
}

const pctTarget = (completion: CollectionCompletionSummary, fraction: number): number =>
  Math.max(1, Math.ceil(completion.total * fraction));

const ownedPct = (fraction: number): AchievementDef['progress'] => (_save, _db, completion) => ({
  current: completion.owned,
  target: pctTarget(completion, fraction),
});

const colorComplete = (color: 'W' | 'U' | 'B' | 'R' | 'G'): AchievementDef['progress'] => (
  _save,
  _db,
  completion,
) => {
  const row = completion.byColor.find((entry) => entry.key === color);
  return { current: row?.owned ?? 0, target: Math.max(1, row?.total ?? 0) };
};

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'collection-25',
    bucket: 'collection',
    title: 'Binder Started',
    description: 'Collect 25% of the card pool.',
    reward: { gold: 100 },
    progress: ownedPct(0.25),
  },
  {
    id: 'collection-50',
    bucket: 'collection',
    title: 'Half The Armory',
    description: 'Collect 50% of the card pool.',
    reward: { gold: 200 },
    progress: ownedPct(0.5),
  },
  {
    id: 'collection-75',
    bucket: 'collection',
    title: 'Deep Binder',
    description: 'Collect 75% of the card pool.',
    reward: { gold: 350 },
    progress: ownedPct(0.75),
  },
  {
    id: 'collection-100',
    bucket: 'collection',
    title: 'Complete Gallery',
    description: 'Collect every card in the pool.',
    reward: { gold: 750 },
    progress: ownedPct(1),
  },
  {
    id: 'complete-white',
    bucket: 'collection',
    title: 'White Gallery',
    description: 'Collect every white card.',
    reward: { gold: 200 },
    progress: colorComplete('W'),
  },
  {
    id: 'complete-blue',
    bucket: 'collection',
    title: 'Blue Gallery',
    description: 'Collect every blue card.',
    reward: { gold: 200 },
    progress: colorComplete('U'),
  },
  {
    id: 'complete-black',
    bucket: 'collection',
    title: 'Black Gallery',
    description: 'Collect every black card.',
    reward: { gold: 200 },
    progress: colorComplete('B'),
  },
  {
    id: 'complete-red',
    bucket: 'collection',
    title: 'Red Gallery',
    description: 'Collect every red card.',
    reward: { gold: 200 },
    progress: colorComplete('R'),
  },
  {
    id: 'complete-green',
    bucket: 'collection',
    title: 'Green Gallery',
    description: 'Collect every green card.',
    reward: { gold: 200 },
    progress: colorComplete('G'),
  },
  {
    id: 'variant-first-special',
    bucket: 'variants',
    title: 'First Shine',
    description: 'Own any special frame or holo variant.',
    reward: { gold: 75 },
    progress: (_save, _db, completion) => ({ current: completion.variants.specialCards, target: 1 }),
  },
  {
    id: 'variant-10-special',
    bucket: 'variants',
    title: 'Variant Hunter',
    description: 'Own 10 distinct special card variants.',
    reward: { gold: 150 },
    progress: (_save, _db, completion) => ({ current: completion.variants.specialVariants, target: 10 }),
  },
  {
    id: 'variant-black-frame',
    bucket: 'variants',
    title: 'Black Frame Pull',
    description: 'Own a black-frame card.',
    reward: { gold: 300 },
    progress: (_save, _db, completion) => ({ current: completion.variants.blackFrameCards, target: 1 }),
  },
  {
    id: 'variant-void-holo',
    bucket: 'variants',
    title: 'Void Holo Pull',
    description: 'Own a void-holo card.',
    reward: { gold: 300 },
    progress: (_save, _db, completion) => ({ current: completion.variants.voidHoloCards, target: 1 }),
  },
  {
    id: 'first-win',
    bucket: 'mastery',
    title: 'First Duel Won',
    description: 'Win any duel.',
    reward: { gold: 75 },
    progress: (save) => ({ current: save.stats.wins, target: 1 }),
  },
  {
    id: 'ten-wins',
    bucket: 'mastery',
    title: 'Seasoned Duelist',
    description: 'Win 10 duels.',
    reward: { gold: 150 },
    progress: (save) => ({ current: save.stats.wins, target: 10 }),
  },
  {
    id: 'hard-win',
    bucket: 'mastery',
    title: 'Hard Lesson',
    description: 'Win a hard practice duel.',
    reward: { gold: 150 },
    progress: (save) => ({ current: save.stats.byDifficulty.hard.w, target: 1 }),
  },
  {
    id: 'gauntlet-clear',
    bucket: 'mastery',
    title: 'Tower Cleared',
    description: 'Clear the full Avatar Gauntlet.',
    reward: { gold: 400 },
    progress: (save) => ({ current: save.gauntlet.completions, target: 1 }),
  },
  {
    id: 'packs-10',
    bucket: 'economy',
    title: 'Pack Regular',
    description: 'Open 10 packs.',
    reward: { gold: 100 },
    progress: (save) => ({ current: save.stats.packsOpened, target: 10 }),
  },
  {
    id: 'packs-25',
    bucket: 'economy',
    title: 'Booster Habit',
    description: 'Open 25 packs.',
    reward: { gold: 200 },
    progress: (save) => ({ current: save.stats.packsOpened, target: 25 }),
  },
  {
    id: 'packs-100',
    bucket: 'economy',
    title: 'Box Breaker',
    description: 'Open 100 packs.',
    reward: { gold: 500 },
    progress: (save) => ({ current: save.stats.packsOpened, target: 100 }),
  },
] as const;

const DEFS_BY_ID = new Map(ACHIEVEMENTS.map((def) => [def.id, def]));

function uniqueKnown(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!DEFS_BY_ID.has(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function evaluateAchievements(save: SaveData, db: CardDb): AchievementStatus[] {
  const completion = collectionCompletion(Object.values(db), save);
  const unlocked = new Set(save.achievements.unlocked);
  const claimed = new Set(save.achievements.claimed);
  return ACHIEVEMENTS.map((def) => {
    const progress = def.progress(save, db, completion);
    const current = Math.max(0, progress.current);
    const target = Math.max(1, progress.target);
    return {
      def,
      current,
      target,
      percent: Math.min(1, current / target),
      unlocked: unlocked.has(def.id) || current >= target,
      claimed: claimed.has(def.id),
    };
  });
}

/**
 * Recompute satisfied achievements from durable save + card-db state. This is
 * called by UI entry points rather than persisted as incremental counters, so
 * imported or migrated saves recover their unlocks without drift.
 */
export function syncAchievements(save: SaveData, db: CardDb): string[] {
  save.achievements.unlocked = uniqueKnown(save.achievements.unlocked);
  save.achievements.claimed = uniqueKnown(save.achievements.claimed).filter((id) =>
    save.achievements.unlocked.includes(id),
  );

  const before = new Set(save.achievements.unlocked);
  const newly: string[] = [];
  for (const status of evaluateAchievements(save, db)) {
    if (!status.unlocked || before.has(status.def.id)) continue;
    save.achievements.unlocked.push(status.def.id);
    before.add(status.def.id);
    newly.push(status.def.id);
  }
  return newly;
}

export function claimAchievement(save: SaveData, id: string): ClaimResult {
  const def = DEFS_BY_ID.get(id);
  if (!def) return { ok: false, gold: 0, reason: 'unknown' };
  if (!save.achievements.unlocked.includes(id)) return { ok: false, gold: 0, reason: 'locked' };
  if (save.achievements.claimed.includes(id)) return { ok: false, gold: 0, reason: 'claimed' };
  save.achievements.claimed.push(id);
  save.gold += def.reward.gold;
  return { ok: true, gold: def.reward.gold };
}

export function claimAllAchievements(save: SaveData): { ids: string[]; gold: number } {
  const ids: string[] = [];
  let gold = 0;
  for (const def of ACHIEVEMENTS) {
    const result = claimAchievement(save, def.id);
    if (!result.ok) continue;
    ids.push(def.id);
    gold += result.gold;
  }
  return { ids, gold };
}
