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
  /** Stronger opponents for elites (Story-only ones in src/data/story/opponents.ts, or Tower avatars). */
  eliteAvatarIds: readonly string[];
  bossAvatarId: string;
  /** When set, the boss is picked from these by the boss node's seed (endless claimants); else `bossAvatarId`. */
  bossAvatarIds?: readonly string[];
  economy: StoryActEconomy;
}

export type StoryBoonId = 'run-gold' | 'sr-card' | 'trim-two' | 'first-fight-reward';

export interface StoryBoon {
  id: StoryBoonId;
  name: string;
  /** Player-facing one-liner (no other game's terms). */
  text: string;
}

// --------------------------------------------------------------- the script
// The Act 1 script (owner-approved 2026-10-12) as data. Ids are save keys
// (`seenSceneIds`) and art keys, so they are stable once shipped.

/** A speaker who appears with a portrait: two expressions, the first the default (V3). */
export interface StorySpeaker {
  id: string;
  /** The name shown over the dialogue box. */
  name: string;
  /** Expression ids; the portrait art is `pt-<speaker id>-<expression>`. */
  expressions: readonly [string, string];
}

/** One tap of Continue. A null speaker is narration (no name, no portrait). */
export interface StoryLine {
  speakerId: string | null;
  /** One of the speaker's two expressions; omitted for narration. */
  expression?: string;
  text: string;
}

export type StorySceneKind = 'opening' | 'boss-intro' | 'boss-defeat' | 'elite-intro' | 'event' | 'ending' | 'endless-intro';

export interface StoryScene {
  /** Stable id from the script (`open-guanyu`, `ev-meng-ford-toll`). */
  id: string;
  kind: StorySceneKind;
  /** The script's heading, shown as the scene title; null where the script gives none. */
  title: string | null;
  /** Background art id (`bg-<place>`). */
  backgroundId: string;
  /** The heroine a per-heroine scene belongs to; null when shared. */
  characterId: string | null;
  /** The elite's avatar id for an elite intro; null otherwise. */
  avatarId: string | null;
  lines: readonly StoryLine[];
}

/** Which cards an event may add. A filter field left out does not restrict. */
export interface StoryCardFilter {
  /** 'pool': the heroine's reward pool. 'catalog': any collectible non-land card. */
  source: 'pool' | 'catalog';
  rarity?: import('../../engine/types').Rarity;
  color?: import('../../engine/types').Color;
  /** A creature subtype, such as 'Beastkin'. */
  subtype?: string;
}

/**
 * One effect of an event choice. Only gold, adding, removing and changing
 * cards, so no event needs engine work (script notes).
 */
export type StoryEventEffect =
  | { kind: 'gold'; amount: number }
  | { kind: 'add-random'; filter: StoryCardFilter }
  | { kind: 'add-choice'; options: number; filter: StoryCardFilter }
  | { kind: 'remove-random' }
  /**
   * The player removes between `atLeast` and `upTo` cards. "Remove a card of
   * your choice" is exactly one (the player paid for it: atLeast 1); "remove up
   * to two cards" allows none (atLeast 0).
   */
  | { kind: 'remove-choice'; upTo: number; atLeast: number }
  | { kind: 'transform-random' };

export interface StoryEventChoice {
  /** The button text, exactly as the script words it. */
  label: string;
  effects: readonly StoryEventEffect[];
}

/** An event vignette: its scene plays, then two choices. */
export interface StoryEvent {
  /** Same id as its scene. */
  id: string;
  /** The speaker who switches to their second expression once a choice resolves, if any. */
  reactingSpeakerId: string | null;
  /** The choice index after which that speaker switches (the script names one per event). */
  reactsToChoice: number | null;
  choices: readonly [StoryEventChoice, StoryEventChoice];
}
