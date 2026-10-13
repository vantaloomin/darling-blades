import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { GUAN_YU_ID, PERSEPHONE_ID, STORY_CHARACTERS, YUTU_ID } from '../../src/data/story/characters';
import { freshSave } from '../../src/meta/SaveManager';
import {
  chooseBoon,
  claimKeep,
  enterNode,
  isAct1Cleared,
  keepOptions,
  legalNextNodes,
  recordFight,
  resolveRest,
  resolveShop,
  startRun,
  storyBoonOffers,
  takeCardReward,
} from '../../src/meta/story/StoryProgress';
import { resolveStoryEventByRule } from '../../src/meta/story/storyEvents';
import { finishClearedRun, storyRoster, storyScreen, storyUnlockProgress } from '../../src/meta/story/storyFlow';
import { isDuelNode, type StoryNode } from '../../src/meta/story/storyMap';
import { freshStoryState, runMap, type StoryState } from '../../src/meta/story/storyState';

const NOW = 1_700_000_000_000;
const SEED = 4242;

function started(seed = SEED): StoryState {
  const story = freshStoryState();
  const run = startRun(story, GUAN_YU_ID, seed, NOW);
  if (!run.ok) throw new Error(run.reason);
  return story;
}

function withBoon(seed = SEED): StoryState {
  const story = started(seed);
  const boon = storyBoonOffers(seed).find((id) => id !== 'trim-two' && id !== 'first-fight-reward')!;
  const chosen = chooseBoon(story, CARD_DB, boon);
  if (!chosen.ok) throw new Error(chosen.reason);
  return story;
}

/** Resolve the current non-duel node by a fixed rule (events by resolveStoryEventByRule). */
function settle(story: StoryState, node: StoryNode): void {
  if (node.kind === 'event') resolveStoryEventByRule(story, CARD_DB);
  else if (node.kind === 'shop') resolveShop(story, CARD_DB, []);
  else if (node.kind === 'rest') resolveRest(story, null);
}

/** Win every duel along the leftmost path until the boss is beaten. */
function clearAct(story: StoryState): void {
  while (story.activeRun && !isAct1Cleared(story.activeRun)) {
    while (story.activeRun.pendingCardRewards.length > 0) takeCardReward(story, null);
    const next = legalNextNodes(story).sort((a, b) => a.id.localeCompare(b.id))[0];
    expect(enterNode(story, next.id).ok).toBe(true);
    if (isDuelNode(next)) expect(recordFight(story, 'win').ok).toBe(true);
    else settle(story, next);
  }
}

/** A run, on some seed, that has just entered a node of `kind` (walking forward until one is legal). */
function seedReaching(kind: StoryNode['kind']): { story: StoryState; node: StoryNode } {
  for (let seed = 1; seed < 400; seed++) {
    const story = withBoon(seed);
    for (let guard = 0; guard < 12 && story.activeRun; guard++) {
      while (story.activeRun.pendingCardRewards.length > 0) takeCardReward(story, null);
      const options = legalNextNodes(story);
      const wanted = options.find((node) => node.kind === kind);
      if (wanted) {
        expect(enterNode(story, wanted.id).ok).toBe(true);
        return { story, node: wanted };
      }
      const next = options[0];
      if (!next) break;
      enterNode(story, next.id);
      if (isDuelNode(next)) recordFight(story, 'win');
      else settle(story, next);
    }
  }
  throw new Error(`no seed reaches a ${kind}`);
}

describe('storyScreen: the one screen a saved run is at', () => {
  it('shows character select with no run', () => {
    expect(storyScreen(freshStoryState()).kind).toBe('select');
  });

  it('shows the opening boon, with the run seed\'s three offers, before anything else', () => {
    const story = started();
    const screen = storyScreen(story);
    expect(screen.kind).toBe('boon');
    if (screen.kind === 'boon') expect(screen.offers).toEqual(storyBoonOffers(SEED));
  });

  it('shows the map once the boon is taken and no node is entered', () => {
    expect(storyScreen(withBoon()).kind).toBe('map');
  });

  it('shows a waiting card reward, oldest first, ahead of the map, and the map once each is taken or skipped', () => {
    const story = withBoon();
    const first = legalNextNodes(story)[0];
    enterNode(story, first.id);
    recordFight(story, 'win');
    story.activeRun!.pendingCardRewards.push(['in-char']); // a second waiting offer
    const screen = storyScreen(story);
    expect(screen.kind).toBe('reward');
    if (screen.kind === 'reward') {
      expect(screen.options).toEqual(story.activeRun!.pendingCardRewards[0]);
      expect(screen.waiting).toBe(2);
    }
    takeCardReward(story, null);
    const second = storyScreen(story);
    expect(second.kind === 'reward' && second.options).toEqual(['in-char']);
    takeCardReward(story, null);
    expect(storyScreen(story).kind).toBe('map');
  });

  it('shows an entered duel that is not yet recorded as a duel to fight', () => {
    const story = withBoon();
    const first = legalNextNodes(story)[0];
    enterNode(story, first.id);
    const screen = storyScreen(story);
    expect(screen.kind).toBe('duel');
    if (screen.kind === 'duel') expect(screen.node.id).toBe(first.id);
  });

  for (const kind of ['event', 'shop', 'rest'] as const) {
    it(`shows an entered ${kind} until it resolves, then the map`, () => {
      const { story, node } = seedReaching(kind);
      const screen = storyScreen(story);
      expect(screen.kind).toBe(kind);
      if (screen.kind === kind) expect(screen.node.id).toBe(node.id);
      settle(story, node);
      expect(storyScreen(story).kind).toBe('map');
    });
  }

  it('shows the keep after the boss, then the cleared summary once the keep is claimed', () => {
    const save = freshSave(NOW);
    save.story = withBoon();
    clearAct(save.story);
    expect(storyScreen(save.story).kind).toBe('keep');
    const card = keepOptions(save.story.activeRun!)[0];
    expect(claimKeep(save, CARD_DB, card).ok).toBe(true);
    expect(storyScreen(save.story).kind).toBe('cleared');
  });

  it('shows character select again after a lost duel ends the run', () => {
    const story = withBoon();
    enterNode(story, legalNextNodes(story)[0].id);
    recordFight(story, 'loss');
    expect(storyScreen(story).kind).toBe('select');
  });
});

describe('finishClearedRun: ending a run after the act-clear keep', () => {
  it('refuses before the act is cleared, changing nothing', () => {
    const story = withBoon();
    const before = structuredClone(story);
    expect(finishClearedRun(story).ok).toBe(false);
    expect(story).toEqual(before);
  });

  it('refuses while the keep is unclaimed, so leaving never skips the keep', () => {
    const story = withBoon();
    clearAct(story);
    expect(finishClearedRun(story).ok).toBe(false);
    expect(story.activeRun).not.toBeNull();
  });

  it('ends the run after the keep, keeping the win, the count and the kept card, and counts the run only once', () => {
    const save = freshSave(NOW);
    save.story = withBoon();
    clearAct(save.story);
    const card = keepOptions(save.story.activeRun!)[0];
    const owned = save.collection[card] ?? 0;
    claimKeep(save, CARD_DB, card);
    const counted = save.story.countedRuns[GUAN_YU_ID];
    expect(counted).toBe(1);
    const finished = finishClearedRun(save.story);
    expect(finished.ok).toBe(true);
    expect(save.story.activeRun).toBeNull();
    expect(save.story.wins[GUAN_YU_ID]).toBe(1);
    expect(save.story.countedRuns[GUAN_YU_ID]).toBe(1);
    expect(save.collection[card]).toBe(owned + 1);
    expect(save.story.unlockedCharacterIds).toContain(PERSEPHONE_ID);
    expect(storyScreen(save.story).kind).toBe('select');
  });
});

describe('storyUnlockProgress: what a locked heroine still needs (R4, R9, R10)', () => {
  const persephone = STORY_CHARACTERS.find((c) => c.id === PERSEPHONE_ID)!;
  const yutu = STORY_CHARACTERS.find((c) => c.id === YUTU_ID)!;

  it('has the first heroine open with no condition', () => {
    const [first] = storyRoster(freshStoryState());
    expect(first.character.id).toBe(GUAN_YU_ID);
    expect(first.unlocked).toBe(true);
    expect(first.predecessor).toBeNull();
  });

  it('reads only the predecessor\'s counted runs: two Guan Yu runs show 2 of 3 for Persephone and 0 of 3 for Yutu', () => {
    const story = freshStoryState();
    story.countedRuns[GUAN_YU_ID] = 2;
    const p = storyUnlockProgress(story, persephone);
    expect(p.unlocked).toBe(false);
    expect(p.predecessor?.id).toBe(GUAN_YU_ID);
    expect([p.runs, p.runsNeeded]).toEqual([2, 3]);
    expect([p.wins, p.winsNeeded]).toEqual([0, 1]);
    const y = storyUnlockProgress(story, yutu);
    expect(y.predecessor?.id).toBe(PERSEPHONE_ID);
    expect(y.runs).toBe(0);
  });

  it('caps shown progress at the need, so extra runs never read as "5 of 3"', () => {
    const story = freshStoryState();
    story.countedRuns[GUAN_YU_ID] = 5;
    story.unlockedCharacterIds.push(PERSEPHONE_ID);
    const p = storyUnlockProgress(story, persephone);
    expect(p.unlocked).toBe(true);
    expect(p.runs).toBe(3);
  });

});

describe('storyScreen agrees with the map', () => {
  it('a map screen always has a legal next node (the run can always move on)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const story = withBoon(seed);
      for (let step = 0; step < 4; step++) {
        const screen = storyScreen(story);
        if (screen.kind !== 'map') break;
        const options = legalNextNodes(story);
        expect(options.length).toBeGreaterThan(0);
        const map = runMap(story.activeRun!);
        expect(options.every((node) => map.floors.flat().some((n) => n.id === node.id))).toBe(true);
        enterNode(story, options[0].id);
        if (isDuelNode(options[0])) {
          recordFight(story, 'win');
          while (story.activeRun!.pendingCardRewards.length > 0) takeCardReward(story, null);
        } else settle(story, options[0]);
      }
    }
  });
});
