/**
 * Story Mode run flow for the run screens (docs/plan-story-mode.md, wave 2):
 * which one screen a saved run is at, unlock progress for character select,
 * and finishing a run after its act-clear keep. Pure and headless: no Phaser,
 * no clock, no `Math.random`. It reads `SaveData.story` and changes it only
 * through StoryProgress, so every rule (exactly-once keeps, R9 counting)
 * stays in one place.
 */

import { STORY_CHARACTERS, storyCharacterById } from '../../data/story/characters';
import type { StoryBoonId, StoryCharacter } from '../../data/story/types';
import { isDuelNode, type StoryNode } from './storyMap';
import {
  abandonRun,
  currentStoryNode,
  isAct1Cleared,
  isEndlessLoopCleared,
  keepRewardKey,
  type StoryResult,
} from './StoryProgress';
import { storyBoonOffers, type StoryRun, type StoryState } from './storyState';

/**
 * The one screen a run is at, in priority order: no run, the opening boon,
 * waiting card rewards (oldest first), the act-clear keep and its summary
 * (where the run can go on into endless), a beaten endless claimant (go on to
 * the next loop), an entered node whose encounter is not over, then the map.
 */
export type StoryScreen =
  | { kind: 'select' }
  | { kind: 'boon'; run: StoryRun; offers: StoryBoonId[] }
  | { kind: 'reward'; run: StoryRun; options: string[]; waiting: number }
  | { kind: 'keep'; run: StoryRun }
  | { kind: 'cleared'; run: StoryRun }
  | { kind: 'loopCleared'; run: StoryRun; loop: number }
  | { kind: 'duel'; run: StoryRun; node: StoryNode }
  | { kind: 'event'; run: StoryRun; node: StoryNode }
  | { kind: 'shop'; run: StoryRun; node: StoryNode }
  | { kind: 'rest'; run: StoryRun; node: StoryNode }
  | { kind: 'map'; run: StoryRun };

export function storyScreen(story: StoryState): StoryScreen {
  const run = story.activeRun;
  if (!run) return { kind: 'select' };
  if (run.boonId === null) return { kind: 'boon', run, offers: storyBoonOffers(run.seed) };
  const reward = run.pendingCardRewards[0];
  if (reward) return { kind: 'reward', run, options: [...reward], waiting: run.pendingCardRewards.length };
  if (isAct1Cleared(run)) {
    return story.claimedRewardKeys.includes(keepRewardKey(run.runId, run.act)) ? { kind: 'cleared', run } : { kind: 'keep', run };
  }
  if (isEndlessLoopCleared(run)) return { kind: 'loopCleared', run, loop: run.endlessLoop };
  const node = currentStoryNode(run);
  if (node && !run.nodeResolved) {
    if (isDuelNode(node)) return { kind: 'duel', run, node };
    if (node.kind === 'event' || node.kind === 'shop' || node.kind === 'rest') return { kind: node.kind, run, node };
  }
  return { kind: 'map', run };
}

/**
 * End a run whose act is cleared, once its keep is claimed, instead of going
 * on into endless (`enterEndless`). It ends through `abandonRun`, the meta's
 * "leave by choice" path, which never counts a run twice. Refused,
 * changing nothing, before the clear or while the keep is unclaimed, so the
 * keep can never be skipped by leaving.
 */
export function finishClearedRun(story: StoryState): StoryResult<{ unlocked: string[] }> {
  const run = story.activeRun;
  if (!run) return { ok: false, reason: 'No run in progress.' };
  if (!isAct1Cleared(run)) return { ok: false, reason: 'The act is not cleared.' };
  if (!story.claimedRewardKeys.includes(keepRewardKey(run.runId, run.act))) {
    return { ok: false, reason: 'Keep a card first.' };
  }
  const ended = abandonRun(story);
  return ended.ok ? { ok: true, unlocked: ended.unlocked } : ended;
}

/** Where a character stands on the unlock chain (R4, R9, R10). */
export interface StoryUnlockProgress {
  character: StoryCharacter;
  unlocked: boolean;
  /** The character whose runs unlock this one; null for the first. */
  predecessor: StoryCharacter | null;
  /** Wins needed with the predecessor, and how many she has (capped at the need). */
  winsNeeded: number;
  wins: number;
  /** Counted runs needed with the predecessor, and how many she has (capped at the need). */
  runsNeeded: number;
  runs: number;
}

export function storyUnlockProgress(story: StoryState, character: StoryCharacter): StoryUnlockProgress {
  const unlocked = story.unlockedCharacterIds.includes(character.id);
  const rule = character.unlock;
  if (!rule) return { character, unlocked, predecessor: null, winsNeeded: 0, wins: 0, runsNeeded: 0, runs: 0 };
  return {
    character,
    unlocked,
    predecessor: storyCharacterById(rule.predecessorId) ?? null,
    winsNeeded: rule.wins,
    wins: Math.min(rule.wins, story.wins[rule.predecessorId] ?? 0),
    runsNeeded: rule.runs,
    runs: Math.min(rule.runs, story.countedRuns[rule.predecessorId] ?? 0),
  };
}

/** Every character in unlock order, with her progress. */
export function storyRoster(story: StoryState): StoryUnlockProgress[] {
  return STORY_CHARACTERS.map((character) => storyUnlockProgress(story, character));
}

