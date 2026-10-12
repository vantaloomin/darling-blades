/**
 * The save's Story Mode record (SaveData.story, added in the v37 -> v38 step;
 * docs/plan-story-mode.md "Save-schema impact"): its shape, the fresh default,
 * and the load-time normalizer. Pure and headless.
 *
 * Normalization rules (the plan's): strings are deduplicated, unknown
 * character ids are dropped, a claim is never inferred from a completion (only
 * `claimedRewardKeys` itself says a reward was taken), and an active run that
 * fails validation is dropped rather than repaired.
 */

import { CARD_DB } from '../../data/catalog';
import { BOON_OFFER_COUNT, STORY_ACTS, STORY_BOONS } from '../../data/story/act1';
import { FIRST_STORY_CHARACTER_ID, STORY_CHARACTERS } from '../../data/story/characters';
import type { StoryAct, StoryBoonId } from '../../data/story/types';
import { createRngState, rngShuffle } from '../../engine/rng';
import { clampSeed, rungSeed } from '../gauntletSeed';
import { generateStoryMap, isDuelNode, isStoryDeckCard, storyNodeById, type StoryMap } from './storyMap';

/** R9: fights a run needs before it counts toward an unlock. */
export const RUN_COUNT_FIGHTS = 3;

/** Bumped when shipped story content changes in a way an active run cannot survive. */
export const STORY_CONTENT_VERSION = 1 as const;

export type StoryRunPhase = 'act' | 'endless';

/** A run in progress. Saved at node boundaries, never mid-duel. */
export interface StoryRun {
  runId: string;
  /** The run seed every map, offer and duel seed derives from. */
  seed: number;
  /** The shared daily seed's local date (YYYY-MM-DD) for a daily run, else null. */
  dailyDateKey: string | null;
  characterId: string;
  /** null until the opening boon is chosen. */
  boonId: StoryBoonId | null;
  phase: StoryRunPhase;
  act: number;
  /** Endless loop reached (0 while in an act). */
  endlessLoop: number;
  /** The node the run stands on; null before the first node is entered. */
  nodeId: string | null;
  /** Every node entered this act, in order (the path). */
  visitedNodeIds: string[];
  /** Whether the current node's encounter is over (a duel recorded, an event resolved). */
  nodeResolved: boolean;
  /** The run deck. Run-scoped: it never touches the collection. */
  deck: string[];
  /** Run gold, separate from the save's gold. */
  gold: number;
  /** Card rewards waiting for a pick, oldest first. Each is a list of offered card ids. */
  pendingCardRewards: string[][];
  /** Duels recorded this run (R9: three makes the run count). */
  fightsPlayed: number;
  /** Whether this run has been added to `countedRuns` (once, at three fights). */
  counted: boolean;
}

export interface StoryState {
  contentVersion: typeof STORY_CONTENT_VERSION;
  activeRun: StoryRun | null;
  unlockedCharacterIds: string[];
  /** Per character: runs that reached three fights, each counted once (R9). */
  countedRuns: Record<string, number>;
  /** Per character: wins. In 2.0 a win is an Act 1 clear (S4). */
  wins: Record<string, number>;
  /** Exactly-once reward keys (keeps and permanent buys). */
  claimedRewardKeys: string[];
  seenSceneIds: string[];
  endless: {
    bestLoop: Record<string, number>;
    daily: { dateKey: string; bestLoop: number } | null;
  };
}

export function freshStoryState(): StoryState {
  return {
    contentVersion: STORY_CONTENT_VERSION,
    activeRun: null,
    unlockedCharacterIds: [FIRST_STORY_CHARACTER_ID],
    countedRuns: {},
    wins: {},
    claimedRewardKeys: [],
    seenSceneIds: [],
    endless: { bestLoop: {}, daily: null },
  };
}

export function storyActByNumber(act: number): StoryAct | undefined {
  return STORY_ACTS.find((entry) => entry.act === act);
}

/** The run's map for its current act (regenerated, never saved). */
export function runMap(run: Pick<StoryRun, 'seed' | 'act'>): StoryMap {
  const act = storyActByNumber(run.act);
  if (!act) throw new Error(`No story act ${run.act}`);
  return generateStoryMap(act, run.seed);
}

const BOON_SALT = 0x5300;

/** The three boons a run seed offers, in display order. */
export function storyBoonOffers(runSeed: number): StoryBoonId[] {
  const ids = STORY_BOONS.map((boon) => boon.id);
  return rngShuffle(createRngState(rungSeed(clampSeed(runSeed), BOON_SALT)), ids).slice(0, BOON_OFFER_COUNT);
}

/**
 * Apply the unlock chain (R4 + R10): a character unlocks on one win or three
 * counted runs with her predecessor. Only the predecessor's records count, and
 * unlocks never go away. Returns the newly unlocked ids.
 */
export function applyStoryUnlocks(story: StoryState): string[] {
  const added: string[] = [];
  for (const character of STORY_CHARACTERS) {
    if (story.unlockedCharacterIds.includes(character.id) || !character.unlock) continue;
    const { predecessorId, wins, runs } = character.unlock;
    if ((story.wins[predecessorId] ?? 0) >= wins || (story.countedRuns[predecessorId] ?? 0) >= runs) {
      added.push(character.id);
    }
  }
  if (added.length > 0) {
    const unlocked = new Set([...story.unlockedCharacterIds, ...added]);
    story.unlockedCharacterIds = STORY_CHARACTERS.map((c) => c.id).filter((id) => unlocked.has(id));
  }
  return added;
}

const KNOWN_CHARACTERS = new Set(STORY_CHARACTERS.map((character) => character.id));
const KNOWN_BOONS = new Set<string>(STORY_BOONS.map((boon) => boon.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))];
}

/** Per-character counts: known ids only, whole non-negative numbers only. */
function characterCounts(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(value)) return out;
  for (const character of STORY_CHARACTERS) {
    const count = value[character.id];
    if (isCount(count) && count > 0) out[character.id] = count;
  }
  return out;
}

/** Normalize a stored story record; anything unusable becomes the fresh default. */
export function normalizeStoryState(raw: unknown): StoryState {
  const fresh = freshStoryState();
  if (!isRecord(raw)) return fresh;
  const unlocked = new Set(uniqueStrings(raw.unlockedCharacterIds).filter((id) => KNOWN_CHARACTERS.has(id)));
  unlocked.add(FIRST_STORY_CHARACTER_ID);
  const endless = isRecord(raw.endless) ? raw.endless : {};
  const daily = isRecord(endless.daily)
    && typeof endless.daily.dateKey === 'string'
    && endless.daily.dateKey.length > 0
    && isCount(endless.daily.bestLoop)
    ? { dateKey: endless.daily.dateKey, bestLoop: endless.daily.bestLoop }
    : null;
  const story: StoryState = {
    contentVersion: STORY_CONTENT_VERSION,
    activeRun: null,
    unlockedCharacterIds: STORY_CHARACTERS.map((c) => c.id).filter((id) => unlocked.has(id)),
    countedRuns: characterCounts(raw.countedRuns),
    wins: characterCounts(raw.wins),
    claimedRewardKeys: uniqueStrings(raw.claimedRewardKeys),
    seenSceneIds: uniqueStrings(raw.seenSceneIds),
    endless: { bestLoop: characterCounts(endless.bestLoop), daily },
  };
  applyStoryUnlocks(story);
  // A run from other content cannot be trusted to match today's maps.
  if (raw.contentVersion === STORY_CONTENT_VERSION) {
    // A throw here would reach SaveManager.load, which answers any throw with a
    // fresh save: a bad run must cost the run, never the whole profile.
    try {
      story.activeRun = normalizeStoryRun(raw.activeRun, story.unlockedCharacterIds);
    } catch {
      story.activeRun = null;
    }
  }
  return story;
}

/**
 * Keep a stored run only when every field is well formed and consistent with
 * the map its seed generates; otherwise null (the run is dropped, not repaired).
 */
export function normalizeStoryRun(raw: unknown, unlockedCharacterIds: readonly string[]): StoryRun | null {
  if (!isRecord(raw)) return null;
  const r = raw;
  if (typeof r.runId !== 'string' || r.runId.length === 0) return null;
  if (!isCount(r.seed) || r.seed === 0 || clampSeed(r.seed) !== r.seed) return null;
  if (r.dailyDateKey !== null && (typeof r.dailyDateKey !== 'string' || r.dailyDateKey.length === 0)) return null;
  if (typeof r.characterId !== 'string' || !unlockedCharacterIds.includes(r.characterId)) return null;
  if (r.phase !== 'act') return null; // endless runs arrive with the endless wave
  if (!isCount(r.act) || !storyActByNumber(r.act)) return null;
  if (!isCount(r.endlessLoop) || r.endlessLoop !== 0) return null;
  if (!isCount(r.gold) || !isCount(r.fightsPlayed) || typeof r.counted !== 'boolean') return null;
  if (typeof r.nodeResolved !== 'boolean') return null;
  if (!Array.isArray(r.deck) || !r.deck.every((id) => typeof id === 'string' && isStoryDeckCard(CARD_DB, id))) return null;
  if (!Array.isArray(r.pendingCardRewards) || !r.pendingCardRewards.every(
    (offer) => Array.isArray(offer) && offer.length > 0 && offer.every((id) => typeof id === 'string' && isStoryDeckCard(CARD_DB, id)),
  )) return null;

  const boonOffers = storyBoonOffers(r.seed);
  if (r.boonId !== null && (typeof r.boonId !== 'string' || !KNOWN_BOONS.has(r.boonId) || !boonOffers.includes(r.boonId as StoryBoonId))) {
    return null;
  }
  if (!Array.isArray(r.visitedNodeIds) || !r.visitedNodeIds.every((id) => typeof id === 'string')) return null;
  const visited = r.visitedNodeIds as string[];
  const map = runMap({ seed: r.seed, act: r.act });
  if (!isLegalPath(map, visited)) return null;
  const nodeId = visited.length > 0 ? visited[visited.length - 1] : null;
  if (r.nodeId !== nodeId) return null;
  if (nodeId !== null && r.boonId === null) return null; // the boon comes before the first node
  if (nodeId === null && r.nodeResolved !== false) return null;

  // Fights recorded can never exceed the duel nodes entered, and the count flag
  // must agree with R9's threshold (counted exactly when three fights were reached).
  const duelNodes = visited.filter((id) => isDuelNode(storyNodeById(map, id)!)).length;
  const current = nodeId ? storyNodeById(map, nodeId)! : null;
  const resolvedDuels = duelNodes - (current && isDuelNode(current) && !r.nodeResolved ? 1 : 0);
  if (r.fightsPlayed !== resolvedDuels) return null;
  if (r.counted !== (r.fightsPlayed >= RUN_COUNT_FIGHTS)) return null;

  return {
    runId: r.runId,
    seed: r.seed,
    dailyDateKey: r.dailyDateKey as string | null,
    characterId: r.characterId,
    boonId: r.boonId as StoryBoonId | null,
    phase: 'act',
    act: r.act,
    endlessLoop: 0,
    nodeId,
    visitedNodeIds: [...visited],
    nodeResolved: r.nodeResolved,
    deck: [...(r.deck as string[])],
    gold: r.gold,
    pendingCardRewards: (r.pendingCardRewards as string[][]).map((offer) => [...offer]),
    fightsPlayed: r.fightsPlayed,
    counted: r.counted,
  };
}

/** A path starts on floor 1 and follows edges one floor at a time. */
function isLegalPath(map: StoryMap, path: readonly string[]): boolean {
  for (let i = 0; i < path.length; i++) {
    const node = storyNodeById(map, path[i]);
    if (!node || node.floor !== i + 1) return false;
    if (i > 0 && !storyNodeById(map, path[i - 1])!.nextNodeIds.includes(node.id)) return false;
  }
  return true;
}
