/**
 * Story duels from the run shell (docs/plan-story-mode.md, wave 2): a duel is
 * launched for one node of the active run, its result goes into the run once,
 * and a duel left unfinished counts as a loss on the next launch, like the
 * Tower and Limited (settleAbandonedDuel). DuelScene only calls these.
 */
import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { CARD_DB } from '../../src/data/catalog';
import { markDuelOpen, settleAbandonedDuel } from '../../src/meta/Economy';
import { freshSave, normalizeOpenDuel, SaveManager, type SaveData } from '../../src/meta/SaveManager';
import {
  applyStoryDuelResult,
  chooseBoon,
  enterNode,
  legalNextNodes,
  startRun,
  storyBoonOffers,
  storyDuelSetup,
  storyDuelSetupFor,
  takeCardReward,
  type StoryDuelRef,
} from '../../src/meta/story/StoryProgress';
import { GUAN_YU_ID } from '../../src/data/story/characters';
import { isDuelNode } from '../../src/meta/story/storyMap';

const NOW = 1_700_000_000_000;
const TODAY = '2026-10-12';

/** A save whose active run stands at its first duel node, not yet recorded. */
function saveAtFirstDuel(seed = 7): { save: SaveData; ref: StoryDuelRef; laterNodeId: string } {
  const save = freshSave(0);
  const started = startRun(save.story, GUAN_YU_ID, seed, NOW);
  if (!started.ok) throw new Error(started.reason);
  const boon = storyBoonOffers(started.run.seed).find((id) => id !== 'trim-two')!;
  const chosen = chooseBoon(save.story, CARD_DB, boon);
  if (!chosen.ok) throw new Error(chosen.reason);
  const node = legalNextNodes(save.story).filter(isDuelNode).sort((a, b) => a.id.localeCompare(b.id))[0];
  const entered = enterNode(save.story, node.id);
  if (!entered.ok) throw new Error(entered.reason);
  return { save, ref: { runId: started.run.runId, nodeId: node.id }, laterNodeId: node.nextNodeIds[0] };
}

/** Persist the save as the app would, then launch again from storage and settle. */
function closeAndRelaunch(save: SaveData): { save: SaveData; settled: ReturnType<typeof settleAbandonedDuel> } {
  const raw = new Map<string, string>();
  const storage = {
    getItem: (k: string) => raw.get(k) ?? null,
    setItem: (k: string, v: string) => void raw.set(k, v),
    removeItem: (k: string) => void raw.delete(k),
  };
  const before = new SaveManager(storage, 0);
  Object.assign(before.data, save);
  before.flush();
  const after = new SaveManager(storage, 0).data;
  return { save: after, settled: settleAbandonedDuel(after, TODAY) };
}

describe('story duel launch: storyDuelSetupFor', () => {
  it('builds the duel only for the active run at its current, unrecorded duel node', () => {
    const { save, ref, laterNodeId } = saveAtFirstDuel();
    const plain = storyDuelSetup(save.story, CARD_DB);
    const scoped = storyDuelSetupFor(save.story, CARD_DB, ref);
    if (!plain.ok || !scoped.ok) throw new Error('setup refused');
    expect(scoped.setup.config.seed).toBe(plain.setup.config.seed);
    expect(scoped.setup.config.decks).toEqual(plain.setup.config.decks);

    expect(storyDuelSetupFor(save.story, CARD_DB, { ...ref, runId: 'another-run' }).ok).toBe(false);
    expect(storyDuelSetupFor(save.story, CARD_DB, { ...ref, nodeId: laterNodeId }).ok).toBe(false);
    expect(applyStoryDuelResult(save, ref, true, 'easy', TODAY).ok).toBe(true);
    expect(storyDuelSetupFor(save.story, CARD_DB, ref).ok).toBe(false); // recorded: no second deal
  });
});

describe('story duel result: applyStoryDuelResult records exactly once', () => {
  it('records a win into the run once, clears the open-duel mark, and refuses a second apply', () => {
    const { save, ref } = saveAtFirstDuel();
    const goldBefore = save.story.activeRun!.gold;
    markDuelOpen(save, { mode: 'story', ...ref, difficulty: 'medium' });

    const first = applyStoryDuelResult(save, ref, true, 'medium', TODAY);
    if (!first.ok) throw new Error(first.reason);
    const run = save.story.activeRun!;
    expect(run.fightsPlayed).toBe(1);
    expect(run.nodeResolved).toBe(true);
    expect(run.gold).toBeGreaterThan(goldBefore);
    expect(run.pendingCardRewards.length).toBeGreaterThan(0);
    expect(save.openDuel).toBeUndefined();
    expect(save.stats.wins).toBe(1);
    expect(save.stats.byDifficulty.medium.w).toBe(1);
    expect(first.firstWinBonus).toBe(true);
    expect(save.gold).toBe(ECONOMY.firstWinOfDayBonus);

    const snapshot = JSON.stringify(save);
    expect(applyStoryDuelResult(save, ref, true, 'medium', TODAY).ok).toBe(false);
    expect(applyStoryDuelResult(save, ref, false, 'medium', TODAY).ok).toBe(false);
    expect(JSON.stringify(save)).toBe(snapshot);
  });

  it('stays recorded across a save and reload, so the reloaded run cannot record it again', () => {
    const { save, ref } = saveAtFirstDuel();
    expect(applyStoryDuelResult(save, ref, true, 'easy', TODAY).ok).toBe(true);
    const { save: reloaded } = closeAndRelaunch(save);
    expect(reloaded.story.activeRun?.fightsPlayed).toBe(1);
    expect(applyStoryDuelResult(reloaded, ref, true, 'easy', TODAY).ok).toBe(false);
    expect(reloaded.story.activeRun?.fightsPlayed).toBe(1);
  });

  it('ends the run on a loss and refuses a second apply', () => {
    const { save, ref } = saveAtFirstDuel();
    const lost = applyStoryDuelResult(save, ref, false, 'hard', TODAY);
    if (!lost.ok) throw new Error(lost.reason);
    expect(lost.runEnded).toBe(true);
    expect(save.story.activeRun).toBeNull();
    expect(save.stats.losses).toBe(1);
    expect(save.stats.byDifficulty.hard.l).toBe(1);
    expect(save.gold).toBe(0);
    expect(applyStoryDuelResult(save, ref, false, 'hard', TODAY).ok).toBe(false);
    expect(save.stats.losses).toBe(1);
  });

  it('refuses a result for another run or another node and changes nothing', () => {
    const { save, ref, laterNodeId } = saveAtFirstDuel();
    markDuelOpen(save, { mode: 'story', ...ref, difficulty: 'easy' });
    const snapshot = JSON.stringify(save);
    expect(applyStoryDuelResult(save, { ...ref, runId: 'another-run' }, true, 'easy', TODAY).ok).toBe(false);
    expect(applyStoryDuelResult(save, { ...ref, nodeId: laterNodeId }, false, 'easy', TODAY).ok).toBe(false);
    expect(JSON.stringify(save)).toBe(snapshot);
  });
});

describe('abandoned story duel: settleAbandonedDuel', () => {
  it('counts a dealt duel left unfinished as a loss once, ending the run', () => {
    const { save, ref } = saveAtFirstDuel();
    markDuelOpen(save, { mode: 'story', ...ref, difficulty: 'medium' });

    const { save: relaunched, settled } = closeAndRelaunch(save);

    expect(settled).toBe('story');
    expect(relaunched.story.activeRun).toBeNull();
    expect(relaunched.stats.losses).toBe(1);
    expect(relaunched.stats.byDifficulty.medium.l).toBe(1);
    expect(relaunched.openDuel).toBeUndefined();
    expect(settleAbandonedDuel(relaunched, TODAY)).toBeNull();
    expect(closeAndRelaunch(relaunched).settled).toBeNull();
    expect(relaunched.stats.losses).toBe(1);
  });

  it('drops a mark for a node the run already recorded, without a loss', () => {
    const { save, ref } = saveAtFirstDuel();
    expect(applyStoryDuelResult(save, ref, true, 'easy', TODAY).ok).toBe(true);
    markDuelOpen(save, { mode: 'story', ...ref, difficulty: 'easy' }); // stale: the node is resolved

    const { save: relaunched, settled } = closeAndRelaunch(save);

    expect(settled).toBeNull();
    expect(relaunched.story.activeRun?.fightsPlayed).toBe(1);
    expect(relaunched.stats.losses).toBe(0);
    expect(relaunched.openDuel).toBeUndefined();
  });

  it('drops a mark for another run, without a loss', () => {
    const { save, ref } = saveAtFirstDuel();
    markDuelOpen(save, { mode: 'story', runId: 'an-old-run', nodeId: ref.nodeId, difficulty: 'easy' });

    const { save: relaunched, settled } = closeAndRelaunch(save);

    expect(settled).toBeNull();
    expect(relaunched.story.activeRun?.runId).toBe(ref.runId);
    expect(relaunched.story.activeRun?.nodeResolved).toBe(false);
    expect(relaunched.stats.losses).toBe(0);
    expect(relaunched.openDuel).toBeUndefined();
  });

  it('does not charge a loss once the run has moved past the duel to the next node', () => {
    const { save, ref } = saveAtFirstDuel();
    expect(applyStoryDuelResult(save, ref, true, 'easy', TODAY).ok).toBe(true);
    while (save.story.activeRun!.pendingCardRewards.length > 0) takeCardReward(save.story, null);
    const next = legalNextNodes(save.story)[0];
    expect(enterNode(save.story, next.id).ok).toBe(true);
    markDuelOpen(save, { mode: 'story', ...ref, difficulty: 'easy' }); // the old node's mark

    expect(closeAndRelaunch(save).settled).toBeNull();
  });
});

describe('normalizeOpenDuel: story marks', () => {
  it('keeps a well-formed story mark and drops malformed ones', () => {
    const good = { mode: 'story', runId: 'guan-yu-abc-7', nodeId: 'f1n0', difficulty: 'hard' };
    expect(normalizeOpenDuel(good)).toEqual(good);
    expect(normalizeOpenDuel({ ...good, extra: 1 })).toEqual(good);
    expect(normalizeOpenDuel({ ...good, nodeId: undefined })).toBeUndefined();
    expect(normalizeOpenDuel({ ...good, nodeId: '' })).toBeUndefined();
    expect(normalizeOpenDuel({ ...good, runId: 42 })).toBeUndefined();
    expect(normalizeOpenDuel({ ...good, runId: '' })).toBeUndefined();
    expect(normalizeOpenDuel({ ...good, difficulty: 'brutal' })).toBeUndefined();
  });

  it('carries a story mark through a save and reload', () => {
    const { save, ref } = saveAtFirstDuel();
    markDuelOpen(save, { mode: 'story', ...ref, difficulty: 'easy' });
    const raw = new Map<string, string>();
    const storage = {
      getItem: (k: string) => raw.get(k) ?? null,
      setItem: (k: string, v: string) => void raw.set(k, v),
      removeItem: (k: string) => void raw.delete(k),
    };
    const before = new SaveManager(storage, 0);
    Object.assign(before.data, save);
    before.flush();
    expect(new SaveManager(storage, 0).data.openDuel).toEqual({ mode: 'story', ...ref, difficulty: 'easy' });
  });
});
