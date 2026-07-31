import type { CardDb } from '../engine/types';
import type { SaveData } from './SaveManager';
import { syncAchievements } from './Achievements';

export interface AchievementCheckpoint {
  changed: boolean;
  ids: string[];
}

/**
 * Latch achievements at a durable mutation boundary. Persistence and player
 * feedback remain scene concerns so this stays headless and reusable.
 */
export function checkpointAchievements(save: SaveData, db: CardDb): AchievementCheckpoint {
  const ids = syncAchievements(save, db);
  return { changed: ids.length > 0, ids };
}
