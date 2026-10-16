import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { GUAN_YU_ID, PERSEPHONE_ID, STORY_CHARACTERS } from '../../src/data/story/characters';
import {
  ENDLESS_BAND_WIDTH,
  ENDLESS_HEAD_START_GOLD,
  ENDLESS_HARD_FROM_LOOP,
  ENDLESS_HEAD_START_PICKS,
  ENDLESS_ROSTER,
  endlessBands,
  endlessBrain,
  endlessClaimantHoldsMandate,
  endlessClaimantLifeBonus,
  endlessLoopAct,
} from '../../src/data/story/endless';
import { AVATARS } from '../../src/data/opponents';
import { storyAvatarById } from '../../src/data/story/opponents';
import { Game } from '../../src/engine/Game';
import { freshSave, type SaveData } from '../../src/meta/SaveManager';
import {
  chooseBoon,
  claimKeep,
  dailyBestLoop,
  dailyEndlessSeed,
  endlessHeadStartOffers,
  enterEndless,
  enterNode,
  isAct1Cleared,
  isEndlessLoopCleared,
  isEndlessOpen,
  keepOptions,
  legalNextNodes,
  nextEndlessLoop,
  recordFight,
  resolveRest,
  resolveShop,
  startEndlessRun,
  startRun,
  storyBoonOffers,
  storyDuelSetup,
  takeCardReward,
} from '../../src/meta/story/StoryProgress';
import { storyScreen } from '../../src/meta/story/storyFlow';
import { resolveStoryEventByRule } from '../../src/meta/story/storyEvents';
import { generateStoryMap, isDuelNode, storyMapNodes, validateStoryMap } from '../../src/meta/story/storyMap';
import { normalizeStoryState, type StoryState } from '../../src/meta/story/storyState';
import { checkStoryContent, SHIPPED_STORY_CONTENT } from '../../src/meta/story/storyContent';

const NOW = 1_700_000_000_000;
const TODAY = '2026-10-16';

/** A save whose Guan Yu has cleared Act 1 once, so endless is open from the menu. */
function openSave(): SaveData {
  const save = freshSave(NOW);
  save.story.wins[GUAN_YU_ID] = 1;
  return save;
}

function pickBoon(story: StoryState): void {
  const run = story.activeRun!;
  const boon = storyBoonOffers(run.seed).find((id) => id !== 'trim-two')!;
  expect(chooseBoon(story, CARD_DB, boon).ok).toBe(true);
}

/** Walk the current act or loop forward, winning every duel, until its boss is beaten. */
function clearStage(story: StoryState): void {
  for (let guard = 0; guard < 40; guard++) {
    const run = story.activeRun!;
    while (run.pendingCardRewards.length > 0) takeCardReward(story, null);
    if (isAct1Cleared(run) || isEndlessLoopCleared(run)) return;
    const next = legalNextNodes(story).sort((a, b) => a.id.localeCompare(b.id))[0];
    expect(enterNode(story, next.id).ok).toBe(true);
    if (isDuelNode(next)) expect(recordFight(story, 'win').ok).toBe(true);
    else if (next.kind === 'event') resolveStoryEventByRule(story, CARD_DB);
    else if (next.kind === 'shop') resolveShop(story, CARD_DB, []);
    else resolveRest(story, null);
  }
  throw new Error('stage did not clear');
}

/** Walk to the current loop's claimant and stand on her, duel not yet recorded. */
function walkToClaimant(story: StoryState): void {
  for (let guard = 0; guard < 40; guard++) {
    const run = story.activeRun!;
    while (run.pendingCardRewards.length > 0) takeCardReward(story, null);
    const next = legalNextNodes(story).sort((a, b) => a.id.localeCompare(b.id))[0];
    expect(enterNode(story, next.id).ok).toBe(true);
    if (next.kind === 'boss') return;
    if (isDuelNode(next)) expect(recordFight(story, 'win').ok).toBe(true);
    else if (next.kind === 'shop') resolveShop(story, CARD_DB, []);
    else resolveRest(story, null);
  }
  throw new Error('never reached the claimant');
}

describe('endless data (E1, E2)', () => {
  it('climbs the Tower roster without Sima Yi, and every band is full and in roster order', () => {
    expect(ENDLESS_ROSTER).not.toContain('simayi');
    expect(ENDLESS_ROSTER.length).toBe(AVATARS.length - 1);
    let previous = -1;
    for (let loop = 1; loop <= 12; loop++) {
      const { fights, elites, claimants } = endlessBands(loop);
      for (const band of [fights, elites, claimants]) expect(band).toHaveLength(ENDLESS_BAND_WIDTH);
      const first = ENDLESS_ROSTER.indexOf(fights[0]);
      expect(first).toBeGreaterThanOrEqual(previous);
      previous = first;
      expect(ENDLESS_ROSTER.indexOf(elites[0])).toBeGreaterThan(ENDLESS_ROSTER.indexOf(fights[fights.length - 1]));
      expect(ENDLESS_ROSTER.indexOf(claimants[0])).toBeGreaterThan(ENDLESS_ROSTER.indexOf(elites[elites.length - 1]));
    }
    // The roster tops out, so a deep loop fields the strongest claimants.
    expect(endlessBands(30).claimants).toEqual(ENDLESS_ROSTER.slice(-ENDLESS_BAND_WIDTH));
  });

  it('caps every opponent at a Medium brain before ENDLESS_HARD_FROM_LOOP, then plays each on its own', () => {
    expect(endlessBrain(ENDLESS_HARD_FROM_LOOP - 1, 'hard')).toBe('medium');
    expect(endlessBrain(ENDLESS_HARD_FROM_LOOP - 1, 'easy')).toBe('easy');
    expect(endlessBrain(ENDLESS_HARD_FROM_LOOP, 'hard')).toBe('hard');
  });

  it('gives the claimant the Mandate from loop 7 and 3 more life a loop from loop 8', () => {
    expect([1, 6, 7, 8].map(endlessClaimantHoldsMandate)).toEqual([false, false, true, true]);
    expect([1, 7, 8, 9, 12].map(endlessClaimantLifeBonus)).toEqual([0, 0, 3, 6, 15]);
  });

  it('generates valid six-floor loops with no events, a claimant from her band, and maps that differ by loop', () => {
    for (const loop of [1, 4, 9]) {
      const act = endlessLoopAct(loop);
      for (let seed = 1; seed <= 200; seed += 7) {
        const map = generateStoryMap(act, seed);
        expect(validateStoryMap(map, act)).toEqual([]);
        expect(map.floors).toHaveLength(6);
        expect(storyMapNodes(map).some((node) => node.kind === 'event')).toBe(false);
        const boss = storyMapNodes(map).find((node) => node.kind === 'boss')!;
        expect(endlessBands(loop).claimants).toContain(boss.avatarId);
      }
    }
    expect(generateStoryMap(endlessLoopAct(1), 5).floors.flat().map((n) => n.id))
      .not.toEqual(generateStoryMap(endlessLoopAct(2), 5).floors.flat().map((n) => n.id));
  });
});

describe('starting endless from the menu (P9, E3)', () => {
  it('stays shut until some heroine clears Act 1', () => {
    const save = freshSave(NOW);
    expect(isEndlessOpen(save.story)).toBe(false);
    const refused = startEndlessRun(save.story, GUAN_YU_ID, 9, NOW);
    expect(refused.ok).toBe(false);
    expect(save.story.activeRun).toBeNull();
  });

  it('opens for every unlocked heroine after any clear, and refuses a locked one', () => {
    const save = openSave();
    expect(isEndlessOpen(save.story)).toBe(true);
    expect(startEndlessRun(save.story, PERSEPHONE_ID, 9, NOW).ok).toBe(false);
    save.story.unlockedCharacterIds.push(PERSEPHONE_ID);
    expect(startEndlessRun(save.story, PERSEPHONE_ID, 9, NOW).ok).toBe(true);
  });

  it('starts at loop 1 with the starter deck, the head-start gold and picks, and the boon to choose', () => {
    const save = openSave();
    const started = startEndlessRun(save.story, GUAN_YU_ID, 9, NOW);
    if (!started.ok) throw new Error(started.reason);
    const run = started.run;
    const guanYu = STORY_CHARACTERS.find((c) => c.id === GUAN_YU_ID)!;
    expect(run.phase).toBe('endless');
    expect(run.endlessLoop).toBe(1);
    expect(run.deck).toEqual(guanYu.starterDeck);
    expect(run.gold).toBe(ENDLESS_HEAD_START_GOLD);
    expect(run.pendingCardRewards).toEqual(endlessHeadStartOffers(run));
    expect(run.pendingCardRewards).toHaveLength(ENDLESS_HEAD_START_PICKS);
    for (const offer of run.pendingCardRewards) for (const id of offer) expect(guanYu.rewardPool).toContain(id);
    expect(storyScreen(save.story).kind).toBe('boon');
    pickBoon(save.story);
    expect(storyScreen(save.story).kind).toBe('reward');
    for (let i = 0; i < ENDLESS_HEAD_START_PICKS; i++) takeCardReward(save.story, run.pendingCardRewards[0][0]);
    expect(run.deck).toHaveLength(guanYu.starterDeck.length + ENDLESS_HEAD_START_PICKS);
    expect(storyScreen(save.story).kind).toBe('map');
  });
});

describe('going on into endless after Act 1 (P9)', () => {
  function clearedAct1(): SaveData {
    const save = freshSave(NOW);
    expect(startRun(save.story, GUAN_YU_ID, 11, NOW).ok).toBe(true);
    pickBoon(save.story);
    clearStage(save.story);
    return save;
  }

  it('refuses before the keep, so leaving for endless never skips it, then carries the deck and gold into loop 1', () => {
    const save = clearedAct1();
    expect(enterEndless(save.story).ok).toBe(false);
    const run = save.story.activeRun!;
    expect(claimKeep(save, CARD_DB, keepOptions(run)[0]).ok).toBe(true);
    const deck = [...run.deck];
    const gold = run.gold;
    const fights = run.fightsPlayed;
    expect(enterEndless(save.story).ok).toBe(true);
    expect(run.phase).toBe('endless');
    expect(run.endlessLoop).toBe(1);
    expect(run.act).toBe(1);
    expect([run.deck, run.gold, run.fightsPlayed]).toEqual([deck, gold, fights]);
    expect(run.nodeId).toBeNull();
    expect(storyScreen(save.story).kind).toBe('map');
    // The act's keep belongs to the act: endless never offers another.
    expect(isAct1Cleared(run)).toBe(false);
    expect(claimKeep(save, CARD_DB, keepOptions(run)[0]).ok).toBe(false);
  });

  it('refuses before the act is cleared', () => {
    const save = freshSave(NOW);
    expect(startRun(save.story, GUAN_YU_ID, 11, NOW).ok).toBe(true);
    expect(enterEndless(save.story).ok).toBe(false);
  });
});

describe('loops, claimants and records (E2, E4, E6)', () => {
  function endlessAtMap(save = openSave(), options: { daily?: string } = {}): StoryState {
    const seed = options.daily ? dailyEndlessSeed(options.daily) : 9;
    const started = startEndlessRun(save.story, GUAN_YU_ID, seed, NOW, options.daily ? { dailyDateKey: options.daily } : {});
    if (!started.ok) throw new Error(started.reason);
    pickBoon(save.story);
    while (save.story.activeRun!.pendingCardRewards.length > 0) takeCardReward(save.story, null);
    return save.story;
  }

  it('beating the claimant pays gold and a card, records the loop, and moves on only after the reward', () => {
    const story = endlessAtMap();
    walkToClaimant(story);
    const run = story.activeRun!;
    const gold = run.gold;
    const recorded = recordFight(story, 'win');
    if (!recorded.ok) throw new Error(recorded.reason);
    expect(recorded.loopCleared).toBe(1);
    expect(recorded.act1Cleared).toBe(false);
    expect(run.gold).toBeGreaterThan(gold);
    expect(story.endless.bestLoop[GUAN_YU_ID]).toBe(1);
    expect(story.wins[GUAN_YU_ID]).toBe(1); // endless is never an Act 1 win
    expect(nextEndlessLoop(story).ok).toBe(false);
    takeCardReward(story, null);
    expect(storyScreen(story)).toMatchObject({ kind: 'loopCleared', loop: 1 });
    expect(nextEndlessLoop(story)).toEqual({ ok: true, loop: 2 });
    expect([run.endlessLoop, run.nodeId, run.visitedNodeIds]).toEqual([2, null, []]);
  });

  it('a loss ends the run and keeps the best loop', () => {
    const story = endlessAtMap();
    clearStage(story);
    takeCardReward(story, null);
    nextEndlessLoop(story);
    walkToClaimant(story);
    const recorded = recordFight(story, 'loss');
    expect(recorded.ok && recorded.runEnded).toBe(true);
    expect(story.activeRun).toBeNull();
    expect(story.endless.bestLoop[GUAN_YU_ID]).toBe(1);
  });

  it('sets the claimant up with the Mandate and extra life only on deep loops', () => {
    const story = endlessAtMap();
    story.activeRun!.endlessLoop = 8;
    walkToClaimant(story);
    const setup = storyDuelSetup(story, CARD_DB);
    if (!setup.ok) throw new Error(setup.reason);
    expect(setup.setup.config.startingMandateHolder).toBe(1);
    expect(setup.setup.config.lifeBonus).toEqual([0, 3]);
    expect(setup.setup.difficulty).toBe(endlessBrain(8, storyAvatarById(setup.setup.avatarId).difficulty));
    const game = new Game(setup.setup.config);
    expect(game.instanceState.mandateHolder).toBe(1);
    expect(game.instanceState.players[1].life - game.instanceState.players[0].life).toBe(3);

    const shallow = endlessAtMap();
    walkToClaimant(shallow);
    const plain = storyDuelSetup(shallow, CARD_DB);
    if (!plain.ok) throw new Error(plain.reason);
    expect(plain.setup.config.startingMandateHolder).toBeUndefined();
    expect(plain.setup.config.lifeBonus).toBeUndefined();
  });

  it('the daily seed is one seed per date, and the day keeps its best try however many runs it takes', () => {
    expect(dailyEndlessSeed(TODAY)).toBe(dailyEndlessSeed(TODAY));
    expect(dailyEndlessSeed(TODAY)).not.toBe(dailyEndlessSeed('2026-10-17'));
    const save = openSave();
    expect(startEndlessRun(save.story, GUAN_YU_ID, 9, NOW, { dailyDateKey: TODAY }).ok).toBe(false);

    // First try: clears loop 1, then loses.
    endlessAtMap(save, { daily: TODAY });
    clearStage(save.story);
    takeCardReward(save.story, null);
    nextEndlessLoop(save.story);
    walkToClaimant(save.story);
    recordFight(save.story, 'loss');
    expect(dailyBestLoop(save.story, TODAY)).toBe(1);

    // Second try (E6: unlimited) loses at once: the day's best stays 1.
    endlessAtMap(save, { daily: TODAY });
    walkToClaimant(save.story);
    recordFight(save.story, 'loss');
    expect(dailyBestLoop(save.story, TODAY)).toBe(1);
    expect(dailyBestLoop(save.story, '2026-10-17')).toBe(0);

    // A new day's record replaces the old one.
    endlessAtMap(save, { daily: '2026-10-17' });
    clearStage(save.story);
    expect(save.story.endless.daily).toEqual({ dateKey: '2026-10-17', bestLoop: 1 });
  });
});

describe('an endless run survives a save and reload', () => {
  it('keeps a mid-loop endless run, and drops one whose loop or count does not fit', () => {
    const save = openSave();
    expect(startEndlessRun(save.story, GUAN_YU_ID, 9, NOW).ok).toBe(true);
    pickBoon(save.story);
    clearStage(save.story);
    takeCardReward(save.story, null);
    nextEndlessLoop(save.story);
    const next = legalNextNodes(save.story)[0];
    expect(next.kind).toBe('fight'); // floor 1 is always a fight
    enterNode(save.story, next.id);
    expect(recordFight(save.story, 'win').ok).toBe(true);
    const raw = JSON.parse(JSON.stringify(save.story));
    expect(normalizeStoryState(raw).activeRun).toEqual(save.story.activeRun);

    expect(normalizeStoryState({ ...raw, activeRun: { ...raw.activeRun, endlessLoop: 0 } }).activeRun).toBeNull();
    expect(normalizeStoryState({ ...raw, activeRun: { ...raw.activeRun, fightsPlayed: 0, counted: false } }).activeRun).toBeNull();
    expect(normalizeStoryState({ ...raw, activeRun: { ...raw.activeRun, phase: 'act', endlessLoop: 0 } }).activeRun).toBeNull();
  });
});

describe('check-story covers endless', () => {
  it('passes on the shipped loops and fails a loop that brings back an act boss or a weaker claimant', () => {
    expect(checkStoryContent(CARD_DB).errors).toEqual([]);
    const loop = endlessLoopAct(1);
    const broken = (act: typeof loop): string[] =>
      checkStoryContent(CARD_DB, { content: { ...SHIPPED_STORY_CONTENT, endlessActs: [act] } }).errors;
    expect(broken({ ...loop, bossAvatarIds: ['simayi'] }).join('\n')).toMatch(/simayi is an act boss/);
    expect(broken({ ...loop, bossAvatarIds: [loop.fightAvatarIds[0]] }).join('\n')).toMatch(/stronger avatar than every elite/);
  });
});
