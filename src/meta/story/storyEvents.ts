/**
 * Story Mode events and scenes (the Act 1 script, src/data/story/script.ts):
 * which event an event node plays, what each choice needs from the player,
 * and resolving a choice into the run. Same contract as StoryProgress: a
 * resolve checks everything first and mutates after, so a refused call changes
 * nothing. Pure and headless: no Phaser, no clock, no `Math.random`; every
 * random pick derives from the run or node seed.
 *
 * Rules decided here:
 * - An event node's event: STORY_EVENTS shuffled by the run seed, indexed by
 *   how many event nodes the run entered before this one, so no event repeats
 *   within a run (an act has at most four event floors, nine events).
 * - "Add a card of your choice from three" needs a pick: declining is not a
 *   choice the script offers.
 * - "Remove a card of your choice" removes exactly one (the player paid for
 *   it); "remove up to two cards" allows none, one or two. The data says which
 *   (`atLeast`).
 * - A choice is unavailable when the run gold cannot pay its cost, when its
 *   removals would take the deck below the act's minimum, or when no card fits
 *   its filter.
 * - A 'catalog' filter draws only cards a player could own right now (the
 *   collectible pool, which follows the live-set flags) that a story deck may
 *   hold. A colour filter matches any card of that colour, multicolour too.
 */

import { createRngState, rngInt, rngShuffle } from '../../engine/rng';
import type { CardDb } from '../../engine/types';
import { storyCharacterById } from '../../data/story/characters';
import { STORY_EVENTS, STORY_SCENES, STORY_SPEAKERS } from '../../data/story/script';
import type {
  StoryAct,
  StoryCardFilter,
  StoryCharacter,
  StoryEvent,
  StoryEventChoice,
  StoryScene,
  StorySceneKind,
  StorySpeaker,
} from '../../data/story/types';
import { collectiblePool } from '../collectionFilter';
import { clampSeed, rungSeed } from '../gauntletSeed';
import { isStoryDeckCard, storyNodeById, type StoryNode } from './storyMap';
import type { StoryResult } from './StoryProgress';
import { runMap, storyActByNumber, type StoryRun, type StoryState } from './storyState';

const EVENT_ORDER_SALT = 0x5900;
const PICK_SALT = 0x5a00;
const ADD_SALT = 0x5b00;
const REMOVE_SALT = 0x5c00;
const TRANSFORM_SALT = 0x5d00;

// ------------------------------------------------------------- scene lookups

export function storySceneById(id: string): StoryScene | undefined {
  return STORY_SCENES.find((scene) => scene.id === id);
}

export function storySpeakerById(id: string): StorySpeaker | undefined {
  return STORY_SPEAKERS.find((speaker) => speaker.id === id);
}

function heroineScene(kind: StorySceneKind, characterId: string): StoryScene | undefined {
  return STORY_SCENES.find((scene) => scene.kind === kind && scene.characterId === characterId);
}

/** The heroine's opening (plays after the opening boon). */
export function openingSceneFor(characterId: string): StoryScene | undefined {
  return heroineScene('opening', characterId);
}

export function bossIntroSceneFor(characterId: string): StoryScene | undefined {
  return heroineScene('boss-intro', characterId);
}

export function bossDefeatSceneFor(characterId: string): StoryScene | undefined {
  return heroineScene('boss-defeat', characterId);
}

export function endingSceneFor(characterId: string): StoryScene | undefined {
  return heroineScene('ending', characterId);
}

/** The elite intro for an elite node's avatar; undefined when that avatar has none. */
export function eliteIntroSceneFor(avatarId: string): StoryScene | undefined {
  return STORY_SCENES.find((scene) => scene.kind === 'elite-intro' && scene.avatarId === avatarId);
}

// ------------------------------------------------------------ which event

/**
 * The event an event node plays: the run's seeded order of STORY_EVENTS,
 * indexed by the event nodes the run entered before this one. Throws for a
 * node that is not an event.
 */
export function storyEventFor(run: StoryRun, node: StoryNode): StoryEvent {
  if (node.kind !== 'event') throw new Error(`Node ${node.id} is a ${node.kind}, not an event`);
  const map = runMap(run);
  const at = run.visitedNodeIds.indexOf(node.id);
  const before = at >= 0 ? run.visitedNodeIds.slice(0, at) : run.visitedNodeIds;
  const index = before.filter((id) => storyNodeById(map, id)?.kind === 'event').length;
  const order = rngShuffle(createRngState(clampSeed(rungSeed(run.seed, EVENT_ORDER_SALT + run.act))), [...STORY_EVENTS]);
  return order[index % order.length];
}

// ------------------------------------------------------------ card filters

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

/** Card ids a filter allows, in a stable order (the pool's own order, or by id for the catalog). */
function filterCards(run: StoryRun, filter: StoryCardFilter, db: CardDb): string[] {
  const source = filter.source === 'pool'
    ? [...new Set(characterOf(run).rewardPool)]
    : collectiblePool(Object.values(db)).map((card) => card.id).sort();
  return source.filter((id) => {
    if (!isStoryDeckCard(db, id)) return false;
    const card = db[id];
    if (filter.rarity !== undefined && card.rarity !== filter.rarity) return false;
    if (filter.color !== undefined && !card.colors.includes(filter.color)) return false;
    if (filter.subtype !== undefined && !card.subtypes.includes(filter.subtype)) return false;
    return true;
  });
}

/** Pool cards a deck card could change into: same rarity, a different id. */
function transformTargets(run: StoryRun, cardId: string, db: CardDb): string[] {
  const rarity = db[cardId]?.rarity;
  return filterCards(run, { source: 'pool', rarity }, db).filter((id) => id !== cardId);
}

function effectSeed(node: StoryNode, salt: number, choiceIndex: number, effectIndex: number): number {
  return clampSeed(rungSeed(node.seed, salt + choiceIndex * 16 + effectIndex));
}

// ------------------------------------------------------------ choice needs

export interface EventChoiceInput {
  /** The card taken from an "of your choice" offer (one of `pickOptions`). */
  pickId?: string | null;
  /** The cards removed by a "remove ... of your choice" effect. */
  removeIds?: readonly string[];
}

export type EventChoiceNeeds =
  | {
      available: true;
      /** The offered cards when the choice adds one of the player's choice; else null. */
      pickOptions: string[] | null;
      /** The most cards the player may remove (0 when the choice removes none by choice). */
      removeUpTo: number;
      /** The fewest cards the player must remove. */
      removeAtLeast: number;
    }
  | { available: false; reason: string };

function choiceAt(event: StoryEvent, choiceIndex: number): StoryEventChoice | undefined {
  return Number.isInteger(choiceIndex) ? event.choices[choiceIndex] : undefined;
}

/**
 * What a choice needs from the player, or why it cannot be taken. Walks the
 * effects in order against the run's gold and deck size, so a cost is checked
 * against the gold the choice will actually have when it is paid.
 */
export function eventChoiceNeeds(
  run: StoryRun,
  node: StoryNode,
  event: StoryEvent,
  choiceIndex: number,
  db: CardDb,
): EventChoiceNeeds {
  const choice = choiceAt(event, choiceIndex);
  if (!choice) return { available: false, reason: 'That choice does not exist.' };
  const minDeck = actOf(run).economy.minDeckSize;
  const tooSmall = `Your deck can't go below ${minDeck} cards.`;
  let gold = run.gold;
  let deckSize = run.deck.length;
  let pickOptions: string[] | null = null;
  let removeUpTo = 0;
  let removeAtLeast = 0;
  for (const [effectIndex, effect] of choice.effects.entries()) {
    switch (effect.kind) {
      case 'gold':
        if (gold + effect.amount < 0) return { available: false, reason: `You need ${-effect.amount} gold.` };
        gold += effect.amount;
        break;
      case 'add-random':
        if (filterCards(run, effect.filter, db).length === 0) return { available: false, reason: 'There is no card to add.' };
        deckSize++;
        break;
      case 'add-choice': {
        const cards = filterCards(run, effect.filter, db);
        if (cards.length === 0) return { available: false, reason: 'There is no card to add.' };
        pickOptions = rngShuffle(createRngState(effectSeed(node, PICK_SALT, choiceIndex, effectIndex)), cards)
          .slice(0, effect.options);
        deckSize++;
        break;
      }
      case 'remove-random':
        if (deckSize - 1 < minDeck) return { available: false, reason: tooSmall };
        deckSize--;
        break;
      case 'remove-choice': {
        const room = Math.min(effect.upTo, deckSize - minDeck);
        if (room < effect.atLeast) return { available: false, reason: tooSmall };
        removeUpTo = room;
        removeAtLeast = effect.atLeast;
        deckSize -= effect.atLeast;
        break;
      }
      case 'transform-random':
        if (!run.deck.some((id) => transformTargets(run, id, db).length > 0)) {
          return { available: false, reason: 'There is no card to change.' };
        }
        break;
    }
  }
  return { available: true, pickOptions, removeUpTo, removeAtLeast };
}

// ------------------------------------------------------------ resolving

export interface EventOutcome {
  /** Net run gold change. */
  gold: number;
  added: string[];
  removed: string[];
  changed: { from: string; to: string }[];
}

function refuse(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}

/** The run's current node when it is an event not yet resolved. */
function openEventNode(run: StoryRun | null): StoryNode | null {
  if (!run || run.nodeResolved || !run.nodeId) return null;
  const node = storyNodeById(runMap(run), run.nodeId);
  return node && node.kind === 'event' ? node : null;
}

/**
 * Leave an event whose every choice is unavailable (no gold to pay, and a deck
 * already at its minimum), so a run is never stuck there. Refused while any
 * choice can still be taken. Nothing changes but the node being resolved.
 */
export function moveOnFromStoryEvent(story: StoryState, db: CardDb): StoryResult {
  const run = story.activeRun;
  const node = openEventNode(run);
  if (!run || !node) return refuse('The run is not at an event.');
  const event = storyEventFor(run, node);
  if (event.choices.some((_, i) => eventChoiceNeeds(run, node, event, i, db).available)) {
    return refuse('A choice is still open.');
  }
  run.nodeResolved = true;
  return { ok: true };
}

/**
 * Resolve the current event node with one of its two choices, once. Random
 * adds, removals and changes are seeded from the node. Refused, changing
 * nothing, when the run is not at an unresolved event, the choice does not
 * exist or is unavailable, a required pick is missing or not offered, or the
 * removal list is the wrong size or names cards the deck does not hold.
 */
export function resolveStoryEvent(
  story: StoryState,
  db: CardDb,
  choiceIndex: number,
  input: EventChoiceInput,
): StoryResult<{ outcome: EventOutcome }> {
  const run = story.activeRun;
  const node = openEventNode(run);
  if (!run || !node) return refuse('The run is not at an event.');
  const event = storyEventFor(run, node);
  const choice = choiceAt(event, choiceIndex);
  if (!choice) return refuse('That choice does not exist.');
  const needs = eventChoiceNeeds(run, node, event, choiceIndex, db);
  if (!needs.available) return refuse(needs.reason);

  const pickId = input.pickId ?? null;
  const removeIds = input.removeIds ?? [];
  if (needs.pickOptions === null) {
    if (pickId !== null) return refuse('This choice offers no card to pick.');
  } else {
    if (pickId === null) return refuse('Choose one of the offered cards.');
    if (!needs.pickOptions.includes(pickId)) return refuse('That card is not offered.');
  }
  const removesByChoice = choice.effects.some((effect) => effect.kind === 'remove-choice');
  if (!removesByChoice && removeIds.length > 0) return refuse('This choice removes no card of your choice.');
  if (removesByChoice) {
    if (removeIds.length < needs.removeAtLeast) {
      return refuse(needs.removeAtLeast === 1 ? 'Choose a card to remove.' : `Choose ${needs.removeAtLeast} cards to remove.`);
    }
    if (removeIds.length > needs.removeUpTo) {
      return refuse(needs.removeUpTo === 1 ? 'Remove only one card.' : `Remove at most ${needs.removeUpTo} cards.`);
    }
  }

  // Apply to copies; commit only when every effect went through.
  let gold = run.gold;
  const deck = [...run.deck];
  const outcome: EventOutcome = { gold: 0, added: [], removed: [], changed: [] };
  for (const [effectIndex, effect] of choice.effects.entries()) {
    switch (effect.kind) {
      case 'gold':
        gold += effect.amount;
        outcome.gold += effect.amount;
        break;
      case 'add-random': {
        const cards = filterCards(run, effect.filter, db);
        const id = cards[rngInt(createRngState(effectSeed(node, ADD_SALT, choiceIndex, effectIndex)), cards.length)];
        deck.push(id);
        outcome.added.push(id);
        break;
      }
      case 'add-choice':
        deck.push(pickId!);
        outcome.added.push(pickId!);
        break;
      case 'remove-random': {
        const at = rngInt(createRngState(effectSeed(node, REMOVE_SALT, choiceIndex, effectIndex)), deck.length);
        outcome.removed.push(...deck.splice(at, 1));
        break;
      }
      case 'remove-choice':
        for (const id of removeIds) {
          const at = deck.indexOf(id);
          if (at < 0) return refuse('That card is not in the deck.');
          deck.splice(at, 1);
          outcome.removed.push(id);
        }
        break;
      case 'transform-random': {
        const rng = createRngState(effectSeed(node, TRANSFORM_SALT, choiceIndex, effectIndex));
        const eligible = deck.map((_, i) => i).filter((i) => transformTargets(run, deck[i], db).length > 0);
        const at = eligible[rngInt(rng, eligible.length)];
        const targets = transformTargets(run, deck[at], db);
        const to = targets[rngInt(rng, targets.length)];
        outcome.changed.push({ from: deck[at], to });
        deck[at] = to;
        break;
      }
    }
  }
  if (gold < 0) return refuse(`You need ${-outcome.gold} gold.`);
  if (deck.length < actOf(run).economy.minDeckSize && deck.length < run.deck.length) {
    return refuse(`Your deck can't go below ${actOf(run).economy.minDeckSize} cards.`);
  }

  run.gold = gold;
  run.deck = deck;
  run.nodeResolved = true;
  return { ok: true, outcome };
}

function cardName(db: CardDb, id: string): string {
  return db[id]?.name ?? id;
}

/** Plain player lines for what a resolved choice did. */
export function eventOutcomeLines(outcome: EventOutcome, db: CardDb): string[] {
  const lines: string[] = [];
  if (outcome.gold > 0) lines.push(`Gained ${outcome.gold} gold.`);
  if (outcome.gold < 0) lines.push(`Lost ${-outcome.gold} gold.`);
  for (const id of outcome.added) lines.push(`Added ${cardName(db, id)}.`);
  for (const id of outcome.removed) lines.push(`Removed ${cardName(db, id)}.`);
  for (const { from, to } of outcome.changed) lines.push(`Changed ${cardName(db, from)} into ${cardName(db, to)}.`);
  if (lines.length === 0) lines.push('Nothing changed.');
  return lines;
}

/**
 * The fixed choice rule headless runs and test walks use: the first available
 * choice, the first offered card, and the fewest removals the choice allows
 * (taken from the front of the deck). Deterministic for a given run.
 */
export function resolveStoryEventByRule(
  story: StoryState,
  db: CardDb,
): StoryResult<{ outcome: EventOutcome; choiceIndex: number }> {
  const run = story.activeRun;
  const node = openEventNode(run);
  if (!run || !node) return refuse('The run is not at an event.');
  const event = storyEventFor(run, node);
  for (let choiceIndex = 0; choiceIndex < event.choices.length; choiceIndex++) {
    const needs = eventChoiceNeeds(run, node, event, choiceIndex, db);
    if (!needs.available) continue;
    const resolved = resolveStoryEvent(story, db, choiceIndex, {
      pickId: needs.pickOptions?.[0] ?? null,
      removeIds: run.deck.slice(0, needs.removeAtLeast),
    });
    return resolved.ok ? { ok: true, outcome: resolved.outcome, choiceIndex } : resolved;
  }
  return refuse('No choice is available.');
}
