import { afterEach, describe, expect, it } from 'vitest';
import { FEATURES } from '../../src/config/features';
import { CARD_DB } from '../../src/data/catalog';
import { CORE_SET_2_SET } from '../../src/data/liveness';
import { ACT1 } from '../../src/data/story/act1';
import { GUAN_YU_ID, PERSEPHONE_ID, STORY_CHARACTERS, YUTU_ID } from '../../src/data/story/characters';
import { STORY_EVENTS } from '../../src/data/story/script';
import type { StoryCardFilter, StoryEvent } from '../../src/data/story/types';
import {
  chooseBoon,
  currentStoryNode,
  enterNode,
  isAct1Cleared,
  legalNextNodes,
  recordFight,
  resolveRest,
  resolveShop,
  startRun,
  storyBoonOffers,
  takeCardReward,
} from '../../src/meta/story/StoryProgress';
import {
  eventChoiceNeeds,
  eventOutcomeLines,
  moveOnFromStoryEvent,
  resolveStoryEvent,
  resolveStoryEventByRule,
  storyEventFor,
  type EventChoiceInput,
} from '../../src/meta/story/storyEvents';
import { isDuelNode, type StoryNode } from '../../src/meta/story/storyMap';
import { freshStoryState, type StoryState } from '../../src/meta/story/storyState';

const NOW = 1_700_000_000_000;
const MIN_DECK = ACT1.economy.minDeckSize;
const ALL_OPEN = STORY_CHARACTERS.map((character) => character.id);

function newRun(seed: number, characterId = GUAN_YU_ID): StoryState {
  const story = freshStoryState();
  story.unlockedCharacterIds = [...ALL_OPEN];
  const started = startRun(story, characterId, seed, NOW);
  if (!started.ok) throw new Error(started.reason);
  const boon = storyBoonOffers(seed).find((id) => id !== 'trim-two')!;
  const chosen = chooseBoon(story, CARD_DB, boon);
  if (!chosen.ok) throw new Error(chosen.reason);
  return story;
}

/**
 * Walk forward, preferring event nodes, winning every duel, until the run
 * stands at an unresolved event that `stop` accepts. Events `stop` passes over
 * resolve by the fixed rule. Returns the event, or null once the act is done.
 */
function walkToEvent(story: StoryState, stop: (event: StoryEvent) => boolean = () => true): StoryEvent | null {
  while (story.activeRun && !isAct1Cleared(story.activeRun)) {
    const run = story.activeRun;
    while (run.pendingCardRewards.length > 0) takeCardReward(story, null);
    const options = legalNextNodes(story).sort((a, b) => a.id.localeCompare(b.id));
    const next = options.find((node) => node.kind === 'event') ?? options[0];
    if (!enterNode(story, next.id).ok) throw new Error('could not enter');
    if (isDuelNode(next)) recordFight(story, 'win');
    else if (next.kind === 'shop') resolveShop(story, CARD_DB, []);
    else if (next.kind === 'rest') resolveRest(story, null);
    else {
      const event = storyEventFor(run, next);
      if (stop(event)) return event;
      const resolved = resolveStoryEventByRule(story, CARD_DB);
      if (!resolved.ok) throw new Error(resolved.reason);
    }
  }
  return null;
}

/** A run standing at the named event (searching seeds from `from`). */
function atEvent(eventId: string, characterId = GUAN_YU_ID, from = 1): { story: StoryState; node: StoryNode; event: StoryEvent } {
  for (let seed = from; seed < from + 500; seed++) {
    const story = newRun(seed, characterId);
    const event = walkToEvent(story, (e) => e.id === eventId);
    if (event) return { story, node: currentStoryNode(story.activeRun!)!, event };
  }
  throw new Error(`no seed reaches ${eventId}`);
}

function multiset(ids: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Whether a card satisfies a filter, worked out from the card data. */
function fits(id: string, filter: StoryCardFilter, rewardPool: readonly string[]): boolean {
  const card = CARD_DB[id];
  if (!card || card.token || card.types.includes('land')) return false;
  if (filter.source === 'pool' && !rewardPool.includes(id)) return false;
  if (filter.source === 'catalog' && card.set === CORE_SET_2_SET && !FEATURES.coreSet2Live) return false;
  return (filter.rarity === undefined || card.rarity === filter.rarity)
    && (filter.color === undefined || card.colors.includes(filter.color))
    && (filter.subtype === undefined || card.subtypes.includes(filter.subtype));
}

/** Expect `fn` to be refused and to leave the story exactly as it was. */
function expectRefusedUnchanged(story: StoryState, fn: () => { ok: boolean }): void {
  const before = structuredClone(story);
  expect(fn().ok).toBe(false);
  expect(story).toEqual(before);
}

describe('storyEvents: which event a node plays', () => {
  it('throws for a node that is not an event', () => {
    const story = newRun(3);
    const fight = legalNextNodes(story).find((node) => node.kind === 'fight')!;
    expect(() => storyEventFor(story.activeRun!, fight)).toThrow();
  });

  it('is the same event for the same run and node', () => {
    const a = atEvent('ev-meng-ford-toll');
    const again = storyEventFor(structuredClone(a.story.activeRun!), a.node);
    expect(again.id).toBe('ev-meng-ford-toll');
  });

  it('never repeats an event within a run (200 seeds, every event node entered)', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const story = newRun(seed);
      const ids: string[] = [];
      walkToEvent(story, (event) => {
        ids.push(event.id);
        return false;
      });
      expect(new Set(ids).size, `seed ${seed}: ${ids.join(', ')}`).toBe(ids.length);
      ids.forEach((id) => seen.add(id));
    }
    expect(seen.size).toBe(STORY_EVENTS.length);
  });
});

describe('storyEvents: resolving a choice', () => {
  const liveBefore = FEATURES.coreSet2Live;
  afterEach(() => {
    FEATURES.coreSet2Live = liveBefore;
  });

  it('resolves every choice of every event, deterministically, within gold and deck limits', () => {
    const covered = new Set<string>();
    for (const live of [false, true]) {
      FEATURES.coreSet2Live = live;
      for (let seed = 1; seed <= 60; seed++) {
        const characterId = ALL_OPEN[seed % ALL_OPEN.length];
        const story = newRun(seed, characterId);
        const pool = STORY_CHARACTERS.find((c) => c.id === characterId)!.rewardPool;
        for (;;) {
          const event = walkToEvent(story);
          if (!event) break;
          const run = story.activeRun!;
          const node = currentStoryNode(run)!;
          event.choices.forEach((choice, choiceIndex) => {
            const needs = eventChoiceNeeds(run, node, event, choiceIndex, CARD_DB);
            if (!needs.available) return;
            const input: EventChoiceInput = {
              pickId: needs.pickOptions?.at(-1) ?? null,
              removeIds: run.deck.slice(0, needs.removeUpTo),
            };
            const copies = [structuredClone(story), structuredClone(story)];
            const results = copies.map((copy) => resolveStoryEvent(copy, CARD_DB, choiceIndex, input));
            expect(results[1], `${event.id} ${choiceIndex}`).toEqual(results[0]);
            expect(copies[1]).toEqual(copies[0]);
            const result = results[0];
            if (!result.ok) throw new Error(`${event.id} choice ${choiceIndex}: ${result.reason}`);
            covered.add(`${event.id}:${choiceIndex}`);
            const after = copies[0].activeRun!;
            expect(after.nodeResolved).toBe(true);
            expect(after.gold).toBeGreaterThanOrEqual(0);
            expect(after.gold).toBe(run.gold + choice.effects.reduce((sum, e) => sum + (e.kind === 'gold' ? e.amount : 0), 0));
            expect(after.deck.length).toBeGreaterThanOrEqual(Math.min(MIN_DECK, run.deck.length));
            // The deck changed by exactly the outcome.
            const expected = multiset([...run.deck, ...result.outcome.added, ...result.outcome.changed.map((c) => c.to)]);
            for (const id of [...result.outcome.removed, ...result.outcome.changed.map((c) => c.from)]) {
              expected.set(id, expected.get(id)! - 1);
            }
            expect(multiset(after.deck)).toEqual(new Map([...expected].filter(([, n]) => n > 0)));
            for (const effect of choice.effects) {
              if (effect.kind === 'add-random' || effect.kind === 'add-choice') {
                expect(result.outcome.added.every((id) => fits(id, effect.filter, pool)), `${event.id} ${result.outcome.added}`).toBe(true);
              }
              if (effect.kind === 'transform-random') {
                for (const { from, to } of result.outcome.changed) {
                  expect(to).not.toBe(from);
                  expect(pool).toContain(to);
                  expect(CARD_DB[to].rarity).toBe(CARD_DB[from].rarity);
                }
                expect(result.outcome.changed).toHaveLength(1);
              }
            }
            expect(eventOutcomeLines(result.outcome, CARD_DB).join(' ')).not.toContain('—');
          });
          const moved = resolveStoryEventByRule(story, CARD_DB);
          if (!moved.ok) throw new Error(moved.reason);
        }
      }
    }
    expect(covered.size).toBe(STORY_EVENTS.length * 2);
  });

  it('resolves once: a second resolve is refused and changes nothing', () => {
    const { story } = atEvent('ev-pieces-of-heaven');
    expect(resolveStoryEvent(story, CARD_DB, 1, {}).ok).toBe(true);
    expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 1, {}));
    expectRefusedUnchanged(story, () => resolveStoryEventByRule(story, CARD_DB));
  });

  it('refuses outside an event, and refuses a choice that does not exist, changing nothing', () => {
    const story = newRun(5);
    expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 0, {}));
    const at = atEvent('ev-changban-bridge').story;
    for (const index of [-1, 2, 0.5, Number.NaN]) expectRefusedUnchanged(at, () => resolveStoryEvent(at, CARD_DB, index, {}));
  });

  it('refuses a cost the run gold cannot pay, and takes the last coin when it can', () => {
    const { story, node, event } = atEvent('ev-meng-ford-toll');
    const run = story.activeRun!;
    run.gold = 24;
    const needs = eventChoiceNeeds(run, node, event, 0, CARD_DB);
    expect(needs.available).toBe(false);
    if (!needs.available) expect(needs.reason).toContain('25');
    expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 0, {}));
    run.gold = 25;
    const paid = resolveStoryEvent(story, CARD_DB, 0, {});
    expect(paid.ok).toBe(true);
    expect(run.gold).toBe(0);
  });

  it('never removes a card from a deck at its minimum size', () => {
    const { story, node, event } = atEvent('ev-changban-bridge');
    const run = story.activeRun!;
    run.deck = run.deck.slice(0, MIN_DECK);
    expect(eventChoiceNeeds(run, node, event, 0, CARD_DB).available).toBe(false);
    expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 0, {}));
    run.deck = run.deck.concat(run.deck[0]);
    expect(resolveStoryEvent(story, CARD_DB, 0, {}).ok).toBe(true);
    expect(run.deck).toHaveLength(MIN_DECK);
  });

  it('needs a pick from the offer, and no pick where none is offered', () => {
    const { story, node, event } = atEvent('ev-peach-blossom-inn');
    const run = story.activeRun!;
    const needs = eventChoiceNeeds(run, node, event, 0, CARD_DB);
    if (!needs.available || !needs.pickOptions) throw new Error('the toast should offer cards');
    expect(needs.pickOptions.length).toBeGreaterThan(0);
    expect(needs.pickOptions.length).toBeLessThanOrEqual(3);
    expect(new Set(needs.pickOptions).size).toBe(needs.pickOptions.length);
    const notOffered = STORY_CHARACTERS[0].rewardPool.find((id) => !needs.pickOptions!.includes(id))!;
    expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 0, {}));
    expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 0, { pickId: null }));
    expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 0, { pickId: notOffered }));
    expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 1, { pickId: needs.pickOptions![0], removeIds: [run.deck[0]] }));
    const taken = resolveStoryEvent(story, CARD_DB, 0, { pickId: needs.pickOptions[1] ?? needs.pickOptions[0] });
    expect(taken.ok && taken.outcome.added).toEqual([needs.pickOptions[1] ?? needs.pickOptions[0]]);
  });

  it('removes exactly one card for "a card of your choice", and only cards the deck holds', () => {
    const { story, node, event } = atEvent('ev-peach-blossom-inn');
    const run = story.activeRun!;
    const needs = eventChoiceNeeds(run, node, event, 1, CARD_DB);
    expect(needs).toMatchObject({ available: true, removeUpTo: 1, removeAtLeast: 1 });
    const absent = Object.keys(CARD_DB).find((id) => !run.deck.includes(id))!;
    for (const removeIds of [[], [run.deck[0], run.deck[1]], [absent]]) {
      expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 1, { removeIds }));
    }
    const target = run.deck[5];
    const copies = run.deck.filter((id) => id === target).length;
    const done = resolveStoryEvent(story, CARD_DB, 1, { removeIds: [target] });
    expect(done.ok).toBe(true);
    expect(run.deck.filter((id) => id === target)).toHaveLength(copies - 1);
  });

  it('removes none, one or two for "up to two", capped by the deck minimum', () => {
    const { story, node, event } = atEvent('ev-divine-physician');
    const run = story.activeRun!;
    run.gold = 100;
    expect(eventChoiceNeeds(run, node, event, 0, CARD_DB)).toMatchObject({ available: true, removeUpTo: 2, removeAtLeast: 0 });
    for (const count of [0, 1, 2]) {
      const copy = structuredClone(story);
      const result = resolveStoryEvent(copy, CARD_DB, 0, { removeIds: copy.activeRun!.deck.slice(0, count) });
      expect(result.ok && result.outcome.removed.length).toBe(count);
    }
    expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 0, { removeIds: run.deck.slice(0, 3) }));
    run.deck = run.deck.slice(0, MIN_DECK + 1);
    expect(eventChoiceNeeds(run, node, event, 0, CARD_DB)).toMatchObject({ available: true, removeUpTo: 1 });
    expectRefusedUnchanged(story, () => resolveStoryEvent(story, CARD_DB, 0, { removeIds: run.deck.slice(0, 2) }));
  });

  it('draws catalog cards only from what a player could own now', () => {
    for (const live of [false, true]) {
      FEATURES.coreSet2Live = live;
      for (let from = 1; from < 120; from += 40) {
        const { story } = atEvent('ev-cats-in-the-dark', PERSEPHONE_ID, from);
        const result = resolveStoryEvent(story, CARD_DB, 0, {});
        if (!result.ok) throw new Error(result.reason);
        const [added] = result.outcome.added;
        if (!live) expect(CARD_DB[added].set).not.toBe(CORE_SET_2_SET);
        expect(CARD_DB[added].subtypes).toContain('Beastkin');
        expect(CARD_DB[added].colors).toContain('B');
      }
    }
  });

  it('offers the wounded rider\'s commons from the heroine\'s own pool', () => {
    const { story, node, event } = atEvent('ev-wounded-rider', YUTU_ID);
    const needs = eventChoiceNeeds(story.activeRun!, node, event, 0, CARD_DB);
    const pool = STORY_CHARACTERS.find((c) => c.id === YUTU_ID)!.rewardPool;
    if (!needs.available || !needs.pickOptions) throw new Error('the rider should offer cards');
    for (const id of needs.pickOptions) {
      expect(pool).toContain(id);
      expect(CARD_DB[id].rarity).toBe('c');
    }
  });

  it('describes an outcome in plain lines naming the amounts and cards', () => {
    const [a, b] = STORY_CHARACTERS[0].rewardPool;
    const lines = eventOutcomeLines({ gold: -25, added: [a], removed: [b], changed: [{ from: b, to: a }] }, CARD_DB);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('25');
    expect(lines[1]).toContain(CARD_DB[a].name);
    expect(lines[2]).toContain(CARD_DB[b].name);
    expect(lines[3]).toContain(CARD_DB[b].name);
    expect(lines[3]).toContain(CARD_DB[a].name);
    expect(eventOutcomeLines({ gold: 20, added: [], removed: [], changed: [] }, CARD_DB)[0]).toContain('20');
    expect(eventOutcomeLines({ gold: 0, added: [], removed: [], changed: [] }, CARD_DB)).toHaveLength(1);
  });
});

describe('an event with no choice left', () => {
  it('refuses to move on while a choice is open, and lets a broke run at the deck minimum leave with nothing changed', () => {
    const { story } = atEvent('ev-meng-ford-toll');
    const run = story.activeRun!;
    expect(moveOnFromStoryEvent(story, CARD_DB).ok).toBe(false);
    expect(run.nodeResolved).toBe(false);
    run.gold = 0;
    run.deck = run.deck.slice(0, MIN_DECK);
    const before = structuredClone(run);
    expect(moveOnFromStoryEvent(story, CARD_DB).ok).toBe(true);
    expect({ ...run, nodeResolved: false }).toEqual(before);
    expect(run.nodeResolved).toBe(true);
    expect(moveOnFromStoryEvent(story, CARD_DB).ok).toBe(false);
  });
});
