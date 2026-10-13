import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FEATURES } from '../../src/config/features';
import { CARD_DB } from '../../src/data/catalog';
import { STORY_CHARACTERS } from '../../src/data/story/characters';
import { STORY_EVENTS, STORY_SCENES, STORY_SPEAKERS } from '../../src/data/story/script';
import type { StoryCardFilter } from '../../src/data/story/types';
import { collectiblePool } from '../../src/meta/collectionFilter';
import {
  bossDefeatSceneFor,
  bossIntroSceneFor,
  endingSceneFor,
  openingSceneFor,
  storySceneById,
  storySpeakerById,
} from '../../src/meta/story/storyEvents';
import { isStoryDeckCard } from '../../src/meta/story/storyMap';

const ART_DIRS = ['public/assets/art/story', 'public/assets/art/story-half'];
const EM_DASH = '—';

function artExists(id: string): boolean {
  return ART_DIRS.every((dir) => existsSync(join(process.cwd(), dir, `${id}.webp`)));
}

/** Cards a filter could give a heroine, worked out here from the card data. */
function cardsFor(filter: StoryCardFilter, rewardPool: readonly string[]): string[] {
  const source = filter.source === 'pool' ? rewardPool : collectiblePool(Object.values(CARD_DB)).map((card) => card.id);
  return source.filter((id) => {
    const card = CARD_DB[id];
    return isStoryDeckCard(CARD_DB, id)
      && (filter.rarity === undefined || card.rarity === filter.rarity)
      && (filter.color === undefined || card.colors.includes(filter.color))
      && (filter.subtype === undefined || card.subtypes.includes(filter.subtype));
  });
}

describe('the Act 1 script as data', () => {
  const liveBefore = FEATURES.coreSet2Live;
  afterEach(() => {
    FEATURES.coreSet2Live = liveBefore;
  });

  it('gives every scene and speaker a unique id', () => {
    expect(new Set(STORY_SCENES.map((scene) => scene.id)).size).toBe(STORY_SCENES.length);
    expect(new Set(STORY_SPEAKERS.map((speaker) => speaker.id)).size).toBe(STORY_SPEAKERS.length);
  });

  it('has art for every background and both portraits of every speaker, at both sizes', () => {
    for (const scene of STORY_SCENES) expect(artExists(scene.backgroundId), `${scene.id}: ${scene.backgroundId}`).toBe(true);
    for (const speaker of STORY_SPEAKERS) {
      for (const expression of speaker.expressions) {
        expect(artExists(`pt-${speaker.id}-${expression}`), `${speaker.id} ${expression}`).toBe(true);
      }
    }
  });

  it('gives every speaker line a known speaker in one of her two expressions, and narration neither', () => {
    for (const scene of STORY_SCENES) {
      expect(scene.lines.length, scene.id).toBeGreaterThan(0);
      for (const line of scene.lines) {
        if (line.speakerId === null) {
          expect(line.expression, `${scene.id}: ${line.text}`).toBeUndefined();
          continue;
        }
        const speaker = storySpeakerById(line.speakerId);
        expect(speaker, `${scene.id}: ${line.speakerId}`).toBeDefined();
        expect(speaker!.expressions, `${scene.id}: ${line.text}`).toContain(line.expression);
      }
    }
  });

  it('has no empty text and no em-dash in any line, title or choice', () => {
    const texts = [
      ...STORY_SCENES.flatMap((scene) => [...scene.lines.map((line) => line.text), ...(scene.title === null ? [] : [scene.title])]),
      ...STORY_EVENTS.flatMap((event) => event.choices.map((choice) => choice.label)),
      ...STORY_SPEAKERS.map((speaker) => speaker.name),
    ];
    for (const text of texts) {
      expect(text.trim().length, JSON.stringify(text)).toBeGreaterThan(0);
      expect(text, text).not.toContain(EM_DASH);
    }
  });

  it('gives every heroine an opening, a boss intro, a boss defeat and an ending of her own', () => {
    for (const character of STORY_CHARACTERS) {
      for (const [kind, scene] of [
        ['opening', openingSceneFor(character.id)],
        ['boss-intro', bossIntroSceneFor(character.id)],
        ['boss-defeat', bossDefeatSceneFor(character.id)],
        ['ending', endingSceneFor(character.id)],
      ] as const) {
        expect(scene, `${character.id} ${kind}`).toBeDefined();
        expect(scene!.kind).toBe(kind);
        expect(scene!.characterId).toBe(character.id);
      }
    }
    const heroineIds = new Set(STORY_CHARACTERS.map((character) => character.id));
    for (const scene of STORY_SCENES) {
      const perHeroine = ['opening', 'boss-intro', 'boss-defeat', 'ending'].includes(scene.kind);
      if (perHeroine) expect(heroineIds.has(scene.characterId ?? ''), scene.id).toBe(true);
      else expect(scene.characterId, scene.id).toBeNull();
      expect(scene.avatarId !== null, scene.id).toBe(scene.kind === 'elite-intro');
    }
  });

  it('pairs every event with an event scene of the same id, and every event scene with an event', () => {
    for (const event of STORY_EVENTS) expect(storySceneById(event.id)?.kind, event.id).toBe('event');
    const eventIds = new Set(STORY_EVENTS.map((event) => event.id));
    for (const scene of STORY_SCENES.filter((s) => s.kind === 'event')) expect(eventIds.has(scene.id), scene.id).toBe(true);
  });

  it('has each reacting speaker speak in her event\'s scene, reacting after a real choice', () => {
    for (const event of STORY_EVENTS) {
      if (event.reactingSpeakerId === null) {
        expect(event.reactsToChoice, event.id).toBeNull();
        continue;
      }
      const speakers = storySceneById(event.id)!.lines.map((line) => line.speakerId);
      expect(speakers, event.id).toContain(event.reactingSpeakerId);
      expect([0, 1], event.id).toContain(event.reactsToChoice);
    }
  });

  it('keeps each choice to one pick and one chosen removal, with sane bounds', () => {
    for (const event of STORY_EVENTS) {
      for (const choice of event.choices) {
        expect(choice.effects.filter((e) => e.kind === 'add-choice').length, choice.label).toBeLessThanOrEqual(1);
        expect(choice.effects.filter((e) => e.kind === 'remove-choice').length, choice.label).toBeLessThanOrEqual(1);
        for (const effect of choice.effects) {
          if (effect.kind === 'remove-choice') {
            expect(effect.atLeast).toBeGreaterThanOrEqual(0);
            expect(effect.atLeast).toBeLessThanOrEqual(effect.upTo);
          }
          if (effect.kind === 'gold') expect(effect.amount).not.toBe(0);
        }
      }
    }
  });

  it('can give every heroine a card from every add filter, with Core Set II live or not', () => {
    for (const live of [false, true]) {
      FEATURES.coreSet2Live = live;
      for (const event of STORY_EVENTS) {
        for (const choice of event.choices) {
          for (const effect of choice.effects) {
            if (effect.kind !== 'add-random' && effect.kind !== 'add-choice') continue;
            for (const character of STORY_CHARACTERS) {
              expect(cardsFor(effect.filter, character.rewardPool).length, `${event.id} ${character.id} live=${live}`)
                .toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });
});
