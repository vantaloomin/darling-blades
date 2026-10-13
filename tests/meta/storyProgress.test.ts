import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { ACT1, BOON_RUN_GOLD, STORY_BOONS } from '../../src/data/story/act1';
import { GUAN_YU_ID, PERSEPHONE_ID, STORY_CHARACTERS, YUTU_ID } from '../../src/data/story/characters';
import type { StoryBoonId } from '../../src/data/story/types';
import { freshSave, SaveManager, type SaveData } from '../../src/meta/SaveManager';
import {
  abandonRun,
  chooseBoon,
  claimKeep,
  currentStoryNode,
  enterNode,
  isAct1Cleared,
  keepOptions,
  keepRewardKey,
  legalNextNodes,
  recordFight,
  resolveRest,
  resolveShop,
  shopStock,
  srBoonCard,
  startRun,
  storyBoonOffers,
  storyDuelSetup,
  takeCardReward,
} from '../../src/meta/story/StoryProgress';
import { resolveStoryEventByRule } from '../../src/meta/story/storyEvents';
import { isDuelNode } from '../../src/meta/story/storyMap';
import { freshStoryState, normalizeStoryState, type StoryState } from '../../src/meta/story/storyState';

const NOW = 1_700_000_000_000;
const guanYu = STORY_CHARACTERS.find((c) => c.id === GUAN_YU_ID)!;

function fakeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => void raw.set(key, value),
    removeItem: (key) => void raw.delete(key),
  };
}

/** A seed whose boon offers include `boon`. */
function seedOffering(boon: StoryBoonId): number {
  for (let seed = 1; seed < 1000; seed++) if (storyBoonOffers(seed).includes(boon)) return seed;
  throw new Error(`no seed offers ${boon}`);
}

function begin(story: StoryState, characterId = GUAN_YU_ID, seed = seedOffering('run-gold')): void {
  const started = startRun(story, characterId, seed, NOW);
  if (!started.ok) throw new Error(started.reason);
  const boon = storyBoonOffers(seed).find((id) => id !== 'trim-two')!;
  const chosen = chooseBoon(story, CARD_DB, boon);
  if (!chosen.ok) throw new Error(chosen.reason);
}

/**
 * Walk the run forward by its leftmost legal node. Duels take `result(i)` for
 * the i-th duel (0-based); every other node resolves by a fixed rule. Stops
 * after `duels` duels, at the end of the run, or after the boss.
 */
function walk(story: StoryState, duels: number, result: (i: number) => 'win' | 'loss' = () => 'win'): void {
  let played = 0;
  while (story.activeRun && played < duels && !isAct1Cleared(story.activeRun)) {
    while (story.activeRun.pendingCardRewards.length > 0) takeCardReward(story, null);
    const next = legalNextNodes(story).sort((a, b) => a.id.localeCompare(b.id))[0];
    expect(enterNode(story, next.id).ok).toBe(true);
    if (isDuelNode(next)) {
      expect(recordFight(story, result(played)).ok).toBe(true);
      played++;
    } else if (next.kind === 'event') resolveStoryEventByRule(story, CARD_DB);
    else if (next.kind === 'shop') resolveShop(story, CARD_DB, []);
    else resolveRest(story, null);
  }
}

describe('StoryProgress: starting a run', () => {
  it('starts with only Guan Yu open and refuses a locked character', () => {
    const story = freshStoryState();
    expect(story.unlockedCharacterIds).toEqual([GUAN_YU_ID]);
    expect(startRun(story, PERSEPHONE_ID, 1, NOW)).toEqual({ ok: false, reason: 'That character is locked.' });
    expect(startRun(story, 'nobody', 1, NOW).ok).toBe(false);
    expect(story.activeRun).toBeNull();
  });

  it('deals the starter deck and the act gold, and refuses a second run', () => {
    const story = freshStoryState();
    const started = startRun(story, GUAN_YU_ID, 77, NOW);
    expect(started.ok).toBe(true);
    expect(story.activeRun?.deck).toEqual(guanYu.starterDeck);
    expect(story.activeRun?.gold).toBe(ACT1.economy.startGold);
    expect(startRun(story, GUAN_YU_ID, 78, NOW).ok).toBe(false);
  });

  it('needs the boon before the first node', () => {
    const story = freshStoryState();
    startRun(story, GUAN_YU_ID, 77, NOW);
    expect(legalNextNodes(story)).toEqual([]);
    chooseBoon(story, CARD_DB, storyBoonOffers(77).find((id) => id !== 'trim-two')!);
    expect(legalNextNodes(story).every((node) => node.floor === 1 && node.kind === 'fight')).toBe(true);
  });
});

describe('StoryProgress: opening boons (R5)', () => {
  it('offers three different boons per run, fixed by the seed', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const offers = storyBoonOffers(seed);
      expect(offers).toHaveLength(3);
      expect(new Set(offers).size).toBe(3);
      expect(storyBoonOffers(seed)).toEqual(offers);
      offers.forEach((id) => seen.add(id));
    }
    expect(seen).toEqual(new Set(STORY_BOONS.map((boon) => boon.id)));
  });

  it('refuses a boon the run was not offered, and a second boon', () => {
    const seed = seedOffering('run-gold');
    const missing = STORY_BOONS.map((b) => b.id).find((id) => !storyBoonOffers(seed).includes(id))!;
    const story = freshStoryState();
    startRun(story, GUAN_YU_ID, seed, NOW);
    expect(chooseBoon(story, CARD_DB, missing).ok).toBe(false);
    expect(chooseBoon(story, CARD_DB, 'run-gold').ok).toBe(true);
    expect(chooseBoon(story, CARD_DB, 'run-gold').ok).toBe(false);
    expect(story.activeRun?.gold).toBe(ACT1.economy.startGold + BOON_RUN_GOLD);
  });

  it('adds a seeded SR card from the character pool', () => {
    const seed = seedOffering('sr-card');
    const story = freshStoryState();
    startRun(story, GUAN_YU_ID, seed, NOW);
    chooseBoon(story, CARD_DB, 'sr-card');
    const added = story.activeRun!.deck.at(-1)!;
    expect(story.activeRun!.deck).toHaveLength(guanYu.starterDeck.length + 1);
    expect(CARD_DB[added].rarity).toBe('sr');
    expect(guanYu.rewardPool).toContain(added);
    expect(srBoonCard(story.activeRun!, CARD_DB)).toBe(added);
  });

  it('removes exactly the two chosen cards, and refuses cards the deck lacks', () => {
    const seed = seedOffering('trim-two');
    const story = freshStoryState();
    startRun(story, GUAN_YU_ID, seed, NOW);
    expect(chooseBoon(story, CARD_DB, 'trim-two').ok).toBe(false);
    expect(chooseBoon(story, CARD_DB, 'trim-two', { removeCardIds: ['dd-wreck-runner', 'tk-wu-taishici'] }).ok).toBe(false);
    expect(story.activeRun!.deck).toEqual(guanYu.starterDeck);
    expect(chooseBoon(story, CARD_DB, 'trim-two', { removeCardIds: ['dd-wreck-runner', 'dd-wreck-runner'] }).ok).toBe(true);
    expect(story.activeRun!.deck.filter((id) => id === 'dd-wreck-runner')).toHaveLength(0);
    expect(story.activeRun!.deck).toHaveLength(guanYu.starterDeck.length - 2);
  });

  it('pays one extra card reward after the first won fight only', () => {
    const seed = seedOffering('first-fight-reward');
    const story = freshStoryState();
    startRun(story, GUAN_YU_ID, seed, NOW);
    chooseBoon(story, CARD_DB, 'first-fight-reward');
    enterNode(story, legalNextNodes(story)[0].id);
    recordFight(story, 'win');
    expect(story.activeRun!.pendingCardRewards).toHaveLength(2);
    expect(legalNextNodes(story)).toEqual([]); // rewards first
    takeCardReward(story, story.activeRun!.pendingCardRewards[0][0]);
    takeCardReward(story, null);
    expect(story.activeRun!.deck).toHaveLength(guanYu.starterDeck.length + 1);
    // The second won fight pays the ordinary single reward.
    walk(story, 1);
    expect(story.activeRun!.fightsPlayed).toBe(2);
    expect(story.activeRun!.pendingCardRewards).toHaveLength(1);
  });
});

describe('StoryProgress: nodes', () => {
  it('only enters legal next nodes, and a duel node compiles to a Darlings-format game', () => {
    const story = freshStoryState();
    begin(story);
    const floor2 = legalNextNodes(story)[0].nextNodeIds[0];
    expect(enterNode(story, floor2).ok).toBe(false);
    const first = legalNextNodes(story)[0];
    expect(enterNode(story, first.id).ok).toBe(true);
    expect(legalNextNodes(story)).toEqual([]); // the duel is not recorded yet
    const setup = storyDuelSetup(story, CARD_DB);
    if (!setup.ok) throw new Error(setup.reason);
    const { config } = setup.setup;
    expect(config.format).toBe('darlings');
    expect(config.darlings?.[0]).toBe('tk-shu-guanyu');
    expect(config.decks[0]).toEqual(story.activeRun!.deck);
    expect(config.landReserves?.[0]).toEqual(guanYu.landReserve);
    expect(config.seed).toBe(first.seed);
    expect(recordFight(story, 'win').ok).toBe(true);
    expect(recordFight(story, 'win').ok).toBe(false); // once per node
  });

  it('charges run gold at a shop, never the save gold, and refuses what it cannot afford', () => {
    const story = freshStoryState();
    begin(story);
    // Walk until the run stands at a shop.
    for (let guard = 0; guard < 20; guard++) {
      while (story.activeRun!.pendingCardRewards.length > 0) takeCardReward(story, null);
      const next = legalNextNodes(story).find((node) => node.kind === 'shop') ?? legalNextNodes(story)[0];
      enterNode(story, next.id);
      if (next.kind === 'shop') break;
      if (isDuelNode(next)) recordFight(story, 'win');
      else if (next.kind === 'event') resolveStoryEventByRule(story, CARD_DB);
      else resolveRest(story, null);
    }
    const run = story.activeRun!;
    const node = currentStoryNode(run)!;
    expect(node.kind).toBe('shop');
    const stock = shopStock(run, node, CARD_DB);
    expect(stock).toHaveLength(ACT1.economy.shopStock);
    run.gold = stock[0].price - 1;
    expect(resolveShop(story, CARD_DB, [stock[0].cardId]).ok).toBe(false);
    run.gold = stock[0].price;
    const deckBefore = run.deck.length;
    expect(resolveShop(story, CARD_DB, [stock[0].cardId]).ok).toBe(true);
    expect(run.gold).toBe(0);
    expect(run.deck).toHaveLength(deckBefore + 1);
  });
});

describe('StoryProgress: run counting (R9) and unlocks (R4, R10)', () => {
  it('counts a run exactly once, at its third fight', () => {
    const story = freshStoryState();
    begin(story);
    walk(story, 2);
    expect(story.countedRuns[GUAN_YU_ID] ?? 0).toBe(0);
    walk(story, 1);
    expect(story.countedRuns[GUAN_YU_ID]).toBe(1);
    expect(story.activeRun?.counted).toBe(true);
    walk(story, 2);
    expect(story.countedRuns[GUAN_YU_ID]).toBe(1);
  });

  it('counts an abandon after three fights once, and an abandon before three not at all', () => {
    const early = freshStoryState();
    begin(early);
    walk(early, 2);
    expect(abandonRun(early)).toEqual({ ok: true, countedNow: false, unlocked: [] });
    expect(early.countedRuns[GUAN_YU_ID] ?? 0).toBe(0);
    expect(early.activeRun).toBeNull();

    const late = freshStoryState();
    begin(late);
    walk(late, 3);
    const result = abandonRun(late);
    expect(result.ok && result.countedNow).toBe(false); // it counted at the third fight
    expect(late.countedRuns[GUAN_YU_ID]).toBe(1);
    expect(abandonRun(late).ok).toBe(false);
    expect(late.countedRuns[GUAN_YU_ID]).toBe(1);
  });

  it('counts a run lost on its third fight, and ends it', () => {
    const story = freshStoryState();
    begin(story);
    walk(story, 3, (i) => (i === 2 ? 'loss' : 'win'));
    expect(story.activeRun).toBeNull();
    expect(story.countedRuns[GUAN_YU_ID]).toBe(1);
  });

  it('unlocks Persephone after three counted Guan Yu runs, not before', () => {
    const story = freshStoryState();
    for (let run = 1; run <= 3; run++) {
      begin(story, GUAN_YU_ID, seedOffering('run-gold') + run * 1000);
      walk(story, 3, (i) => (i === 2 ? 'loss' : 'win'));
      expect(story.unlockedCharacterIds.includes(PERSEPHONE_ID)).toBe(run === 3);
    }
    expect(story.unlockedCharacterIds).toEqual([GUAN_YU_ID, PERSEPHONE_ID]);
  });

  it('unlocks Persephone on one Guan Yu Act 1 clear, which is a win (S4)', () => {
    const story = freshStoryState();
    begin(story);
    walk(story, 99);
    expect(isAct1Cleared(story.activeRun)).toBe(true);
    expect(story.wins[GUAN_YU_ID]).toBe(1);
    expect(story.unlockedCharacterIds).toEqual([GUAN_YU_ID, PERSEPHONE_ID]);
    expect(recordFight(story, 'win').ok).toBe(false); // the boss is recorded once
    expect(story.wins[GUAN_YU_ID]).toBe(1);
  });

  it('counts only the predecessor: Guan Yu wins never unlock Yutu, Persephone runs do', () => {
    const story = freshStoryState();
    for (let run = 0; run < 4; run++) {
      begin(story, GUAN_YU_ID, seedOffering('run-gold') + run * 1000);
      walk(story, 99);
      abandonRun(story);
    }
    expect(story.wins[GUAN_YU_ID]).toBe(4);
    expect(story.unlockedCharacterIds).not.toContain(YUTU_ID);
    for (let run = 1; run <= 3; run++) {
      begin(story, PERSEPHONE_ID, seedOffering('run-gold') + run * 1000);
      walk(story, 3, (i) => (i === 2 ? 'loss' : 'win'));
    }
    expect(story.countedRuns[PERSEPHONE_ID]).toBe(3);
    expect(story.unlockedCharacterIds).toEqual([GUAN_YU_ID, PERSEPHONE_ID, YUTU_ID]);
  });
});

describe('StoryProgress: the Act 1 keep (R6) is granted exactly once', () => {
  function clearedSave(): SaveData {
    const save = freshSave(NOW);
    begin(save.story);
    walk(save.story, 99);
    expect(isAct1Cleared(save.story.activeRun)).toBe(true);
    return save;
  }

  it('grants the kept card to the collection with its reward key, and refuses a second claim', () => {
    const save = clearedSave();
    const card = keepOptions(save.story.activeRun!)[0];
    const key = keepRewardKey(save.story.activeRun!.runId, 1);
    const claimed = claimKeep(save, CARD_DB, card);
    expect(claimed.ok).toBe(true);
    expect(save.collection[card]).toBe(1);
    expect(save.story.claimedRewardKeys).toEqual([key]);
    const other = keepOptions(save.story.activeRun!)[1];
    expect(claimKeep(save, CARD_DB, other).ok).toBe(false);
    expect(save.collection[other]).toBeUndefined();
    expect(save.collection[card]).toBe(1);
  });

  it('stays claimed across a save, reload and migrate, so the reloaded run cannot claim again', () => {
    const storage = fakeStorage();
    const first = new SaveManager(storage, NOW);
    Object.assign(first.data, clearedSave());
    const card = keepOptions(first.data.story.activeRun!)[0];
    expect(claimKeep(first.data, CARD_DB, card).ok).toBe(true);
    first.flush();

    const reloaded = new SaveManager(storage, NOW + 1);
    expect(reloaded.data.story.activeRun).toEqual(first.data.story.activeRun);
    expect(isAct1Cleared(reloaded.data.story.activeRun)).toBe(true);
    expect(claimKeep(reloaded.data, CARD_DB, card).ok).toBe(false);
    expect(reloaded.data.collection[card]).toBe(1);
  });

  it('refuses a keep before the act is cleared, and a card outside the run deck', () => {
    const save = freshSave(NOW);
    begin(save.story);
    walk(save.story, 2);
    expect(claimKeep(save, CARD_DB, save.story.activeRun!.deck[0]).ok).toBe(false);
    const cleared = clearedSave();
    // The walk takes no card rewards, so a pool card the starter lacks is not in the run deck.
    expect(cleared.story.activeRun!.deck).not.toContain('cs2-peach-sworn-sister');
    expect(claimKeep(cleared, CARD_DB, 'cs2-peach-sworn-sister').ok).toBe(false);
    expect(cleared.story.claimedRewardKeys).toEqual([]);
  });

  it('never moves a run card into the collection on its own', () => {
    const save = clearedSave();
    expect(save.collection).toEqual({});
    abandonRun(save.story);
    expect(save.collection).toEqual({});
  });
});

describe('normalizeStoryState', () => {
  it('turns garbage into the fresh record', () => {
    for (const raw of [undefined, null, 7, 'story', [], {}]) {
      expect(normalizeStoryState(raw)).toEqual(freshStoryState());
    }
  });

  it('dedupes strings, drops unknown characters and bad counts, and always keeps Guan Yu', () => {
    const story = normalizeStoryState({
      contentVersion: 1,
      activeRun: null,
      unlockedCharacterIds: [PERSEPHONE_ID, 'nobody', PERSEPHONE_ID, 5],
      countedRuns: { [GUAN_YU_ID]: 2, nobody: 9, [PERSEPHONE_ID]: -1 },
      wins: { [PERSEPHONE_ID]: 1.5 },
      claimedRewardKeys: ['a:act1:keep', 'a:act1:keep', '', 3],
      seenSceneIds: ['intro', 'intro'],
      endless: { bestLoop: { [GUAN_YU_ID]: 4 }, daily: { dateKey: '', bestLoop: 1 } },
    });
    expect(story.unlockedCharacterIds).toEqual([GUAN_YU_ID, PERSEPHONE_ID]);
    expect(story.countedRuns).toEqual({ [GUAN_YU_ID]: 2 });
    expect(story.wins).toEqual({});
    expect(story.claimedRewardKeys).toEqual(['a:act1:keep']);
    expect(story.seenSceneIds).toEqual(['intro']);
    expect(story.endless).toEqual({ bestLoop: { [GUAN_YU_ID]: 4 }, daily: null });
  });

  it('never infers a claim from a win', () => {
    const story = normalizeStoryState({ ...freshStoryState(), wins: { [GUAN_YU_ID]: 3 } });
    expect(story.claimedRewardKeys).toEqual([]);
    expect(story.unlockedCharacterIds).toContain(PERSEPHONE_ID); // the unlock rule, not a claim
  });

  it('keeps a real run in progress and drops one that fails validation', () => {
    const story = freshStoryState();
    begin(story);
    walk(story, 2);
    const run = JSON.parse(JSON.stringify(story.activeRun));
    const keep = (patch: Record<string, unknown>) =>
      normalizeStoryState({ ...JSON.parse(JSON.stringify(story)), activeRun: { ...run, ...patch } }).activeRun;
    expect(keep({})).toEqual(story.activeRun);
    expect(keep({ characterId: PERSEPHONE_ID })).toBeNull(); // locked
    expect(keep({ deck: ['not-a-card'] })).toBeNull();
    expect(keep({ deck: ['land-plains'] })).toBeNull();
    expect(keep({ visitedNodeIds: [...run.visitedNodeIds].reverse() })).toBeNull();
    expect(keep({ nodeId: run.visitedNodeIds[0] })).toBeNull();
    expect(keep({ fightsPlayed: run.fightsPlayed + 1 })).toBeNull();
    expect(keep({ counted: true })).toBeNull(); // two fights cannot have counted
    expect(keep({ boonId: 'nonsense' })).toBeNull();
    expect(keep({ gold: -5 })).toBeNull();
    expect(keep({ phase: 'endless' })).toBeNull();
    expect(normalizeStoryState({ ...JSON.parse(JSON.stringify(story)), contentVersion: 0 }).activeRun).toBeNull();
  });
});
