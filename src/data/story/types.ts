import type { Color, Rarity } from '../../engine/types';

/**
 * Story Mode content shapes (docs/plan-story-mode.md, wave 1). Pure data: no
 * code runs from story content. Every id here is a stable string because it
 * becomes a save key (character ids in the unlock and count records, node ids
 * in an active run, boon ids, reward keys). Renaming a shipped id needs a
 * migration map.
 */

export type StoryNodeKind = 'fight' | 'elite' | 'event' | 'shop' | 'rest' | 'boss';

/** Kinds that start a duel (they count toward R9's three fights). */
export const STORY_DUEL_KINDS: readonly StoryNodeKind[] = ['fight', 'elite', 'boss'];

/**
 * R4 + R10: a character unlocks on one win OR `runs` counted runs with the
 * character just before her in the chain. Only the predecessor's records count.
 */
export interface StoryUnlockRule {
  predecessorId: string;
  wins: number;
  runs: number;
}

export interface StoryCharacter {
  /** Stable save key. */
  id: string;
  name: string;
  /** The command-zone Darling (a legendary creature card id). */
  darlingId: string;
  colors: readonly Color[];
  /** The fixed run-start deck: spells and creatures only, lands live in the reserve. */
  starterDeck: readonly string[];
  /** The ten-land Warchest reserve every story duel deals her. */
  landReserve: readonly string[];
  /** Card rewards, shop stock and boon cards draw from this list (its make-up is the weighting). */
  rewardPool: readonly string[];
  /** null: open from the start (the first character). */
  unlock: StoryUnlockRule | null;
  /** True while the deck is a wave 1 stand-in awaiting the Core Set II starter pools (wave 3). */
  placeholderDeck: boolean;
}

/** One floor of an act template: the node kinds its nodes are drawn from. */
export interface StoryFloorTemplate {
  floor: number;
  kinds: readonly StoryNodeKind[];
}

export interface StoryMapTemplate {
  id: string;
  floors: readonly StoryFloorTemplate[];
  /** Nodes per floor (the boss floor always has exactly one). */
  minWidth: number;
  maxWidth: number;
}

/** Gold and prices for one act (run gold only; meta gold is never touched by a run). */
export interface StoryActEconomy {
  startGold: number;
  fightGold: number;
  eliteGold: number;
  eventGold: number;
  /** Run-deck shop price per rarity. */
  shopPrice: Readonly<Record<Rarity, number>>;
  /** Cards a shop stocks. */
  shopStock: number;
  /** Options in one card reward. */
  rewardChoices: number;
  /** A run deck never shrinks below this (boon trims, rests). */
  minDeckSize: number;
}

export interface StoryAct {
  id: string;
  act: number;
  mapTemplate: StoryMapTemplate;
  /** Avatar ids (src/data/opponents.ts) for ordinary fights, chosen per node by seed. */
  fightAvatarIds: readonly string[];
  /** Stronger avatars for elites. */
  eliteAvatarIds: readonly string[];
  bossAvatarId: string;
  economy: StoryActEconomy;
}

export type StoryBoonId = 'run-gold' | 'sr-card' | 'trim-two' | 'first-fight-reward';

export interface StoryBoon {
  id: StoryBoonId;
  name: string;
  /** Player-facing one-liner (no other game's terms). */
  text: string;
}
