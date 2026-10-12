/**
 * StoryProgress: the only code that changes `SaveData.story`
 * (docs/plan-story-mode.md, "Meta, save, and economy"). Each function checks
 * everything first and then mutates in place, so a refused call changes
 * nothing; persistence is the caller's (`Services.save.touch()`), the same
 * contract as Economy.ts. Pure and headless: no Phaser, no clock (callers pass
 * `now`), no `Math.random` (every choice derives from the run seed).
 *
 * Rulings applied here: R4 + R10 (unlock chain, predecessor-only counts),
 * R5 (opening boon), R6 (one keep per act cleared, exactly once), R9 (a run
 * counts once it has had three fights, however it ends), S4 (an Act 1 clear
 * is a win in 2.0).
 */

import { createRngState, rngShuffle } from '../../engine/rng';
import type { CardDb } from '../../engine/types';
import type { GameConfig } from '../../engine/Game';
import { avatarById } from '../../data/opponents';
import { BOON_RUN_GOLD } from '../../data/story/act1';
import { storyCharacterById } from '../../data/story/characters';
import type { StoryAct, StoryBoonId, StoryCharacter } from '../../data/story/types';
import { addCards, type AddResult } from '../Collection';
import { clampSeed, rungSeed } from '../gauntletSeed';
import type { SaveData } from '../SaveManager';
import { WARCHEST_HAND_SIZE } from '../warchest';
import { isDuelNode, storyNodeById, type StoryMap, type StoryNode } from './storyMap';
import {
  applyStoryUnlocks,
  RUN_COUNT_FIGHTS,
  runMap,
  storyActByNumber,
  storyBoonOffers,
  type StoryRun,
  type StoryState,
} from './storyState';

export { RUN_COUNT_FIGHTS, storyBoonOffers } from './storyState';

export type StoryResult<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

function refuse(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}

const SR_BOON_SALT = 0x5400;
const REWARD_SALT = 0x5500;
const BOON_REWARD_SALT = 0x5600;
const EVENT_SALT = 0x5700;
const SHOP_SALT = 0x5800;

function actOf(run: StoryRun): StoryAct {
  const act = storyActByNumber(run.act);
  if (!act) throw new Error(`No story act ${run.act}`);
  return act;
}

function characterOf(run: StoryRun): StoryCharacter {
  const character = storyCharacterById(run.characterId);
  if (!character) throw new Error(`Unknown story character ${run.characterId}`);
  return character;
}

function seededPick(seed: number, pool: readonly string[], count: number): string[] {
  return rngShuffle(createRngState(clampSeed(seed)), [...pool]).slice(0, count);
}

export function isCharacterUnlocked(story: StoryState, characterId: string): boolean {
  return story.unlockedCharacterIds.includes(characterId);
}

/** A run id unique per (character, start time, seed); a stable reward-key prefix. */
export function storyRunId(characterId: string, seed: number, now: number): string {
  return `${characterId}-${Math.max(0, Math.trunc(now)).toString(36)}-${clampSeed(seed).toString(36)}`;
}

/** The exactly-once key for an act's keep (R6). */
export function keepRewardKey(runId: string, act: number): string {
  return `${runId}:act${act}:keep`;
}

/** Start a run. Refuses a locked or unknown character, or a second run while one is active. */
export function startRun(
  story: StoryState,
  characterId: string,
  seed: number,
  now: number,
  options: { dailyDateKey?: string } = {},
): StoryResult<{ run: StoryRun }> {
  const character = storyCharacterById(characterId);
  if (!character) return refuse('Unknown character.');
  if (!isCharacterUnlocked(story, characterId)) return refuse('That character is locked.');
  if (story.activeRun) return refuse('A run is already in progress.');
  const runSeed = clampSeed(seed);
  const act = storyActByNumber(1);
  if (!act) return refuse('No act to play.');
  const run: StoryRun = {
    runId: storyRunId(characterId, runSeed, now),
    seed: runSeed,
    dailyDateKey: options.dailyDateKey ?? null,
    characterId,
    boonId: null,
    phase: 'act',
    act: act.act,
    endlessLoop: 0,
    nodeId: null,
    visitedNodeIds: [],
    nodeResolved: false,
    deck: [...character.starterDeck],
    gold: act.economy.startGold,
    pendingCardRewards: [],
    fightsPlayed: 0,
    counted: false,
  };
  story.activeRun = run;
  return { ok: true, run };
}

/** The SR card the `sr-card` boon adds for this run (seeded, from the character's pool). */
export function srBoonCard(run: Pick<StoryRun, 'seed' | 'characterId'>, db: CardDb): string | null {
  const character = storyCharacterById(run.characterId);
  if (!character) return null;
  const srs = character.rewardPool.filter((id) => db[id]?.rarity === 'sr');
  return seededPick(rungSeed(run.seed, SR_BOON_SALT), srs, 1)[0] ?? null;
}

/**
 * Choose the opening boon (R5), once, before the first node. `trim-two` needs
 * the two cards to remove (`removeCardIds`, two copies taken from the deck).
 */
export function chooseBoon(
  story: StoryState,
  db: CardDb,
  boonId: StoryBoonId,
  options: { removeCardIds?: readonly [string, string] } = {},
): StoryResult {
  const run = story.activeRun;
  if (!run) return refuse('No run in progress.');
  if (run.boonId !== null) return refuse('The boon is already chosen.');
  if (!storyBoonOffers(run.seed).includes(boonId)) return refuse('That boon is not offered this run.');
  const act = actOf(run);
  switch (boonId) {
    case 'run-gold':
      run.gold += BOON_RUN_GOLD;
      break;
    case 'sr-card': {
      const card = srBoonCard(run, db);
      if (!card) return refuse('No SR card to give.');
      run.deck.push(card);
      break;
    }
    case 'trim-two': {
      const remove = options.removeCardIds;
      if (!remove) return refuse('Choose two cards to remove.');
      if (run.deck.length - 2 < act.economy.minDeckSize) return refuse('The deck is too small to trim.');
      const deck = [...run.deck];
      for (const id of remove) {
        const at = deck.indexOf(id);
        if (at < 0) return refuse('That card is not in the deck.');
        deck.splice(at, 1);
      }
      run.deck = deck;
      break;
    }
    case 'first-fight-reward':
      break; // paid out by recordFight after the first won fight
  }
  run.boonId = boonId;
  return { ok: true };
}

export function currentStoryNode(run: StoryRun, map: StoryMap = runMap(run)): StoryNode | null {
  return run.nodeId ? storyNodeById(map, run.nodeId) ?? null : null;
}

/** Nodes the run may enter next (empty while the current node is unfinished or a reward waits). */
export function legalNextNodes(story: StoryState): StoryNode[] {
  const run = story.activeRun;
  if (!run || run.boonId === null || run.pendingCardRewards.length > 0) return [];
  const map = runMap(run);
  if (run.nodeId === null) return [...map.floors[0]];
  if (!run.nodeResolved) return [];
  const current = storyNodeById(map, run.nodeId);
  return current ? current.nextNodeIds.map((id) => storyNodeById(map, id)!) : [];
}

export function enterNode(story: StoryState, nodeId: string): StoryResult<{ node: StoryNode }> {
  const run = story.activeRun;
  if (!run) return refuse('No run in progress.');
  const node = legalNextNodes(story).find((candidate) => candidate.id === nodeId);
  if (!node) return refuse('That node cannot be entered now.');
  run.nodeId = node.id;
  run.visitedNodeIds.push(node.id);
  run.nodeResolved = false;
  return { ok: true, node };
}

/** R9: count the run once it has three fights. Returns true only the one time it counts. */
function countRunIfDue(story: StoryState, run: StoryRun): boolean {
  if (run.counted || run.fightsPlayed < RUN_COUNT_FIGHTS) return false;
  story.countedRuns[run.characterId] = (story.countedRuns[run.characterId] ?? 0) + 1;
  run.counted = true;
  return true;
}

/** S4: clearing Act 1 is a win in 2.0. Called once, by `recordFight` on the boss win. */
function completeAct1(story: StoryState, run: StoryRun): void {
  story.wins[run.characterId] = (story.wins[run.characterId] ?? 0) + 1;
}

export function cardRewardOptions(run: StoryRun, node: StoryNode, salt = REWARD_SALT): string[] {
  return seededPick(rungSeed(node.seed, salt), characterOf(run).rewardPool, actOf(run).economy.rewardChoices);
}

export interface FightRecord {
  /** True the one time this fight made the run count (R9). */
  countedNow: boolean;
  /** Characters this result unlocked. */
  unlocked: string[];
  /** A loss ends the run. */
  runEnded: boolean;
  act1Cleared: boolean;
}

/**
 * Record the current duel node's result, once. A win pays run gold and offers
 * a card reward (the boss pays the act clear instead); a loss ends the run.
 */
export function recordFight(story: StoryState, result: 'win' | 'loss'): StoryResult<FightRecord> {
  const run = story.activeRun;
  if (!run) return refuse('No run in progress.');
  const map = runMap(run);
  const node = currentStoryNode(run, map);
  if (!node || !isDuelNode(node)) return refuse('The run is not at a duel.');
  if (run.nodeResolved) return refuse('This duel is already recorded.');

  run.fightsPlayed++;
  run.nodeResolved = true;
  const countedNow = countRunIfDue(story, run);
  let act1Cleared = false;
  let runEnded = false;
  if (result === 'loss') {
    story.activeRun = null;
    runEnded = true;
  } else if (node.kind === 'boss') {
    if (run.act === 1) {
      completeAct1(story, run);
      act1Cleared = true;
    }
  } else {
    const economy = actOf(run).economy;
    run.gold += node.kind === 'elite' ? economy.eliteGold : economy.fightGold;
    run.pendingCardRewards.push(cardRewardOptions(run, node));
    if (run.boonId === 'first-fight-reward' && run.fightsPlayed === 1) {
      run.pendingCardRewards.push(cardRewardOptions(run, node, BOON_REWARD_SALT));
    }
  }
  const unlocked = applyStoryUnlocks(story);
  return { ok: true, countedNow, unlocked, runEnded, act1Cleared };
}

/** Take (a card id) or skip (null) the oldest waiting card reward. */
export function takeCardReward(story: StoryState, cardId: string | null): StoryResult {
  const run = story.activeRun;
  if (!run) return refuse('No run in progress.');
  const offer = run.pendingCardRewards[0];
  if (!offer) return refuse('No card reward is waiting.');
  if (cardId !== null && !offer.includes(cardId)) return refuse('That card is not offered.');
  run.pendingCardRewards.shift();
  if (cardId !== null) run.deck.push(cardId);
  return { ok: true };
}

function unresolvedNode(run: StoryRun | null, kind: StoryNode['kind']): StoryNode | null {
  if (!run || run.nodeResolved) return null;
  const node = currentStoryNode(run);
  return node && node.kind === kind ? node : null;
}

/** The card an event node offers. */
export function eventCard(run: StoryRun, node: StoryNode): string {
  return seededPick(rungSeed(node.seed, EVENT_SALT), characterOf(run).rewardPool, 1)[0];
}

/**
 * Wave 1 events are one generic vignette: take run gold or the offered card.
 * Authored events with their own choices arrive with the content wave.
 */
export function resolveEvent(story: StoryState, choice: 'gold' | 'card'): StoryResult {
  const run = story.activeRun;
  const node = unresolvedNode(run, 'event');
  if (!run || !node) return refuse('The run is not at an event.');
  if (choice === 'gold') run.gold += actOf(run).economy.eventGold;
  else run.deck.push(eventCard(run, node));
  run.nodeResolved = true;
  return { ok: true };
}

export interface ShopOffer {
  cardId: string;
  price: number;
}

export function shopStock(run: StoryRun, node: StoryNode, db: CardDb): ShopOffer[] {
  const economy = actOf(run).economy;
  return seededPick(rungSeed(node.seed, SHOP_SALT), characterOf(run).rewardPool, economy.shopStock)
    .map((cardId) => ({ cardId, price: economy.shopPrice[db[cardId].rarity] }));
}

/** Buy any of the shop's cards into the run deck (each at most once) and leave. */
export function resolveShop(story: StoryState, db: CardDb, buyCardIds: readonly string[]): StoryResult {
  const run = story.activeRun;
  const node = unresolvedNode(run, 'shop');
  if (!run || !node) return refuse('The run is not at a shop.');
  if (new Set(buyCardIds).size !== buyCardIds.length) return refuse('Each card can be bought once.');
  const stock = shopStock(run, node, db);
  let total = 0;
  for (const id of buyCardIds) {
    const offer = stock.find((entry) => entry.cardId === id);
    if (!offer) return refuse('That card is not for sale here.');
    total += offer.price;
  }
  if (total > run.gold) return refuse('Not enough run gold.');
  run.gold -= total;
  run.deck.push(...buyCardIds);
  run.nodeResolved = true;
  return { ok: true };
}

/** A rest removes one card from the run deck (or none) and moves on. */
export function resolveRest(story: StoryState, removeCardId: string | null): StoryResult {
  const run = story.activeRun;
  const node = unresolvedNode(run, 'rest');
  if (!run || !node) return refuse('The run is not at a rest.');
  if (removeCardId !== null) {
    const at = run.deck.indexOf(removeCardId);
    if (at < 0) return refuse('That card is not in the deck.');
    if (run.deck.length - 1 < actOf(run).economy.minDeckSize) return refuse('The deck is too small to trim.');
    run.deck.splice(at, 1);
  }
  run.nodeResolved = true;
  return { ok: true };
}

/** Whether the run has beaten Act 1's boss. */
export function isAct1Cleared(run: StoryRun | null): boolean {
  if (!run || run.act !== 1 || !run.nodeResolved || !run.nodeId) return false;
  return run.nodeId === runMap(run).bossId;
}

/**
 * End the run by choice (an abandon, or leaving after a clear). A run with
 * three fights already counted when its third fight was recorded, so this
 * never counts twice; it only applies R9 for a run that somehow reached three
 * without counting.
 */
export function abandonRun(story: StoryState): StoryResult<{ countedNow: boolean; unlocked: string[] }> {
  const run = story.activeRun;
  if (!run) return refuse('No run in progress.');
  const countedNow = countRunIfDue(story, run);
  story.activeRun = null;
  return { ok: true, countedNow, unlocked: applyStoryUnlocks(story) };
}

/** Cards the act's keep may take: one copy of any card in the run deck. */
export function keepOptions(run: StoryRun): string[] {
  return [...new Set(run.deck)].sort();
}

/**
 * R6: keep one card from the run deck after clearing an act. The reward key is
 * recorded in the same mutation that grants the card through the collection's
 * own grant helper, so a reload, retry or import never grants it twice: a
 * second claim with the same key is refused and changes nothing.
 */
export function claimKeep(save: SaveData, db: CardDb, cardId: string): StoryResult<{ key: string; grant: AddResult }> {
  const story = save.story;
  const run = story.activeRun;
  if (!run) return refuse('No run in progress.');
  if (!isAct1Cleared(run)) return refuse('The act is not cleared.');
  const key = keepRewardKey(run.runId, run.act);
  if (story.claimedRewardKeys.includes(key)) return refuse('This keep is already claimed.');
  if (!keepOptions(run).includes(cardId) || !db[cardId]) return refuse('That card is not in the run deck.');
  const [grant] = addCards(save, db, [cardId]);
  story.claimedRewardKeys.push(key);
  return { ok: true, key, grant };
}

/** Everything a duel at a node needs, as an ordinary engine config plus its labels. */
export interface StoryDuelSetup {
  config: GameConfig;
  avatarId: string;
  nodeId: string;
  nodeKind: StoryNode['kind'];
}

/**
 * Compile the current node's duel to an ordinary Darlings-format GameConfig:
 * the run deck with the character's Darling and reserve against the avatar's
 * own Darlings deck. No engine change: the engine enforces no deck size.
 */
export function storyDuelSetup(story: StoryState, db: CardDb): StoryResult<{ setup: StoryDuelSetup }> {
  const run = story.activeRun;
  if (!run) return refuse('No run in progress.');
  const node = currentStoryNode(run);
  if (!node || !isDuelNode(node) || run.nodeResolved || !node.avatarId) return refuse('The run is not at a duel.');
  const character = characterOf(run);
  const avatar = avatarById(node.avatarId);
  return {
    ok: true,
    setup: {
      avatarId: avatar.id,
      nodeId: node.id,
      nodeKind: node.kind,
      config: {
        decks: [[...run.deck], [...avatar.darlingsDeck]],
        seed: node.seed,
        db,
        format: 'darlings',
        landReserves: [[...character.landReserve], [...avatar.landReserve]],
        darlings: [character.darlingId, avatar.darlingId],
        startingHandSize: WARCHEST_HAND_SIZE,
      },
    },
  };
}
