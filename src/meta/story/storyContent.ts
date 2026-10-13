/**
 * Story content validation: the core of `npm run check-story`
 * (scripts/check-story.ts; docs/plan-story-mode.md "Tooling and invariants").
 * Pure: it reads the story data, the card db and the avatar roster, and
 * returns problems as strings. Art presence is a file question, so the caller
 * passes a `missingArt` probe (src/meta never touches the file system).
 */

import type { CardDb, CardDef } from '../../engine/types';
import { CORE_SET_2_SET } from '../../data/liveness';
import type { Avatar } from '../../data/opponents';
import { STORY_BOONS, STORY_ACTS, BOON_OFFER_COUNT } from '../../data/story/act1';
import { STORY_CHARACTERS, FIRST_STORY_CHARACTER_ID } from '../../data/story/characters';
import { storyAvatarById, storyAvatarIds } from '../../data/story/opponents';
import { STORY_EVENTS, STORY_SCENES, STORY_SPEAKERS } from '../../data/story/script';
import type {
  StoryAct,
  StoryBoon,
  StoryCharacter,
  StoryEvent,
  StoryScene,
  StorySceneKind,
  StorySpeaker,
} from '../../data/story/types';
import { collectiblePool } from '../collectionFilter';
import { isBasicLand, isDualLand, isUtilityTapland, LAND_RESERVE_SIZE, MAX_DUAL_LANDS, reserveColorIdentity } from '../warchest';
import { storyFilterCards } from './storyEvents';
import { isStoryDeckCard } from './storyMap';

/** Starter deck size (owner ruling 2026-10-12: 30, up from the planned 15 to 20, which decked out). */
export const STARTER_DECK_SIZE = 30;

/**
 * Whether a card may sit in a starter deck or reward pool: a collectible card
 * of the live pool, or of Core Set II whether or not that set's flag is on.
 * Owner ruling W2 (2026-10-13): starters and pools draw on Core Set I (the
 * shipped catalog) and Core Set II, since Story Mode ships with Core Set II in
 * 2.0. A token, basic, land or retired utility tapland never qualifies.
 */
function isStoryPoolCard(card: CardDef, collectible: ReadonlySet<string>): boolean {
  if (card.set === CORE_SET_2_SET) return !card.token && !card.supertypes?.includes('basic') && !isUtilityTapland(card);
  return collectible.has(card.id);
}

/** Problems in one character entry (cards, colours, sizes, reserve). */
export function validateStoryCharacter(db: CardDb, character: StoryCharacter): string[] {
  const problems: string[] = [];
  const where = `story character ${character.id}`;
  const collectible = new Set(collectiblePool(Object.values(db)).map((card) => card.id));
  if (!character.name.trim()) problems.push(`${where}: empty name`);
  const darling = db[character.darlingId];
  if (!darling) problems.push(`${where}: unknown Darling ${character.darlingId}`);
  else if (!darling.types.includes('creature') || !darling.supertypes?.includes('legendary') || !darling.cost) {
    problems.push(`${where}: Darling ${character.darlingId} is not a legendary creature with a cost`);
  } else if (darling.colors.some((color) => !character.colors.includes(color))) {
    problems.push(`${where}: Darling colours ${darling.colors.join('')} are not ${character.colors.join('')}`);
  }

  const checkList = (label: string, ids: readonly string[]): void => {
    for (const id of ids) {
      if (!isStoryDeckCard(db, id)) {
        problems.push(`${where}: ${label} card ${id} is unknown, a land or a token`);
        continue;
      }
      const card = db[id];
      if (!isStoryPoolCard(card, collectible)) problems.push(`${where}: ${label} card ${id} is not in the collectible pool`);
      if (card.colors.some((color) => !character.colors.includes(color))) {
        problems.push(`${where}: ${label} card ${id} is outside ${character.colors.join('')}`);
      }
    }
  };
  if (character.starterDeck.length !== STARTER_DECK_SIZE) {
    problems.push(`${where}: starter deck has ${character.starterDeck.length} cards (${STARTER_DECK_SIZE})`);
  }
  checkList('starter', character.starterDeck);
  checkList('reward', character.rewardPool);
  if (new Set(character.rewardPool).size !== character.rewardPool.length) problems.push(`${where}: reward pool repeats a card`);
  if (!character.rewardPool.some((id) => db[id]?.rarity === 'sr')) problems.push(`${where}: reward pool has no SR card for the sr-card boon`);

  if (character.landReserve.length !== LAND_RESERVE_SIZE) {
    problems.push(`${where}: land reserve has ${character.landReserve.length} lands (${LAND_RESERVE_SIZE})`);
  }
  let duals = 0;
  for (const id of character.landReserve) {
    const card = db[id];
    if (!card || !(isBasicLand(card) || isDualLand(card))) problems.push(`${where}: reserve land ${id} is not a basic or dual land`);
    else if (isDualLand(card)) duals++;
  }
  if (duals > MAX_DUAL_LANDS) problems.push(`${where}: land reserve has ${duals} duals (at most ${MAX_DUAL_LANDS})`);
  const reserveColors = reserveColorIdentity(db, character.landReserve);
  if (reserveColors.join('') !== [...character.colors].sort(colorOrder).join('')) {
    problems.push(`${where}: land reserve makes ${reserveColors.join('')}, not ${character.colors.join('')}`);
  }
  return problems;
}

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];
function colorOrder(a: string, b: string): number {
  return COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b);
}

const DIFFICULTY_RANK: Readonly<Record<Avatar['difficulty'], number>> = { easy: 0, medium: 1, hard: 2 };

/**
 * Whether `elite` is a stronger opponent than `fight`: a harder brain, or the
 * same brain on a higher Tower rung (Story-only opponents sit on no rung, tier
 * 0, so against a same-difficulty Tower avatar they do not count as stronger).
 */
export function isStrongerOpponent(elite: Avatar, fight: Avatar): boolean {
  const byBrain = DIFFICULTY_RANK[elite.difficulty] - DIFFICULTY_RANK[fight.difficulty];
  if (byBrain !== 0) return byBrain > 0;
  return elite.tier > 0 && fight.tier > 0 && elite.tier > fight.tier;
}

/** Where scene art lives (relative to the repo root): full size, then phones. Files are `<art id>.webp`. */
export const STORY_ART_DIRS: readonly string[] = ['public/assets/art/story', 'public/assets/art/story-half'];

/** Scene kinds every heroine has one of her own. */
export const PER_HEROINE_SCENE_KINDS: readonly StorySceneKind[] = ['opening', 'boss-intro', 'boss-defeat', 'ending'];

const EM_DASH = '—';

/** Everything the check reads; the shipped data by default (tests pass a broken copy). */
export interface StoryContentSource {
  characters: readonly StoryCharacter[];
  acts: readonly StoryAct[];
  boons: readonly StoryBoon[];
  scenes: readonly StoryScene[];
  speakers: readonly StorySpeaker[];
  events: readonly StoryEvent[];
}

export const SHIPPED_STORY_CONTENT: StoryContentSource = {
  characters: STORY_CHARACTERS,
  acts: STORY_ACTS,
  boons: STORY_BOONS,
  scenes: STORY_SCENES,
  speakers: STORY_SPEAKERS,
  events: STORY_EVENTS,
};

export interface StoryContentOptions {
  content?: StoryContentSource;
  /** Opponent ids that exist (default: the Story-only opponents and the Tower avatars). */
  avatarIds?: readonly string[];
  /**
   * The places an art id is missing from (empty when present everywhere). Left
   * out, art is not checked.
   */
  missingArt?: (artId: string) => readonly string[];
}

export interface StoryContentReport {
  errors: string[];
  warnings: string[];
  /** What was checked, for the summary line. */
  counts: { characters: number; scenes: number; lines: number; events: number; speakers: number; artIds: number };
}

/** Every problem in the story content, split into errors (fail the check) and warnings. */
export function checkStoryContent(db: CardDb, options: StoryContentOptions = {}): StoryContentReport {
  const content = options.content ?? SHIPPED_STORY_CONTENT;
  const avatarIds = new Set(options.avatarIds ?? storyAvatarIds());
  const errors: string[] = [];
  const warnings: string[] = [];
  const checkAvatar = (where: string, id: string): void => {
    if (!avatarIds.has(id)) errors.push(`${where}: unknown avatar ${id}`);
  };
  const known = (id: string): Avatar | null => {
    if (!avatarIds.has(id)) return null;
    try {
      return storyAvatarById(id);
    } catch {
      return null;
    }
  };
  const checkText = (where: string, text: string): void => {
    if (!text.trim()) errors.push(`${where}: empty text`);
    else if (text.includes(EM_DASH)) errors.push(`${where}: em-dash in player-facing text`);
  };
  const duplicates = (label: string, ids: readonly string[]): void => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (!id.trim()) errors.push(`a ${label} has an empty id`);
      else if (seen.has(id)) errors.push(`duplicate ${label} id ${id}`);
      seen.add(id);
    }
  };

  // ------------------------------------------------------------ characters
  const characters = content.characters;
  duplicates('story character', characters.map((character) => character.id));
  characters.forEach((character, index) => {
    if (index === 0 && (character.id !== FIRST_STORY_CHARACTER_ID || character.unlock !== null)) {
      errors.push('the first story character must be the open one');
    }
    if (index > 0) {
      const previous = characters[index - 1];
      if (!character.unlock || character.unlock.predecessorId !== previous.id) {
        errors.push(`${character.id} must unlock from ${previous.id} (R10: the character just before her)`);
      }
    }
    errors.push(...validateStoryCharacter(db, character));
  });

  // ------------------------------------------------------------------ acts
  for (const act of content.acts) {
    for (const id of act.fightAvatarIds) checkAvatar(`act ${act.id} fight`, id);
    for (const id of act.eliteAvatarIds) checkAvatar(`act ${act.id} elite`, id);
    checkAvatar(`act ${act.id} boss`, act.bossAvatarId);
    const fights = act.fightAvatarIds.map(known).filter((avatar): avatar is Avatar => avatar !== null);
    const elites = act.eliteAvatarIds.map(known).filter((avatar): avatar is Avatar => avatar !== null);
    if (act.fightAvatarIds.length === 0 || act.eliteAvatarIds.length === 0) errors.push(`act ${act.id}: needs fight and elite avatars`);
    if (elites.some((elite) => fights.some((fight) => !isStrongerOpponent(elite, fight)))) {
      errors.push(`act ${act.id}: every elite must be a stronger avatar than every fight`);
    }
    const floors = act.mapTemplate.floors;
    if (floors.some((floor, i) => floor.floor !== i + 1 || floor.kinds.length === 0)) {
      errors.push(`act ${act.id}: floors must be numbered from 1 with at least one kind each`);
    }
    if (!floors[floors.length - 1]?.kinds.includes('boss') || floors.slice(0, -1).some((f) => f.kinds.includes('boss'))) {
      errors.push(`act ${act.id}: the boss must be the last floor and only there`);
    }
  }

  // ----------------------------------------------------------------- boons
  duplicates('boon', content.boons.map((boon) => boon.id));
  if (content.boons.length < BOON_OFFER_COUNT) errors.push('fewer boons than a run offers');
  for (const boon of content.boons) {
    checkText(`boon ${boon.id} name`, boon.name);
    checkText(`boon ${boon.id} text`, boon.text);
  }

  // -------------------------------------------------------------- speakers
  duplicates('speaker', content.speakers.map((speaker) => speaker.id));
  const speakers = new Map(content.speakers.map((speaker) => [speaker.id, speaker]));
  const artIds = new Set<string>();
  for (const speaker of content.speakers) {
    checkText(`speaker ${speaker.id} name`, speaker.name);
    if (speaker.expressions[0] === speaker.expressions[1]) errors.push(`speaker ${speaker.id}: two expressions must differ`);
    for (const expression of speaker.expressions) {
      if (!expression.trim()) errors.push(`speaker ${speaker.id}: empty expression id`);
      else artIds.add(`pt-${speaker.id}-${expression}`);
    }
  }

  // ---------------------------------------------------------------- scenes
  duplicates('scene', content.scenes.map((scene) => scene.id));
  const characterIds = new Set(characters.map((character) => character.id));
  let lines = 0;
  for (const scene of content.scenes) {
    const where = `scene ${scene.id}`;
    if (scene.title !== null) checkText(`${where} title`, scene.title);
    if (!scene.backgroundId.trim()) errors.push(`${where}: empty background id`);
    else artIds.add(scene.backgroundId);
    const perHeroine = PER_HEROINE_SCENE_KINDS.includes(scene.kind);
    if (perHeroine && !characterIds.has(scene.characterId ?? '')) {
      errors.push(`${where}: a ${scene.kind} scene must belong to a story character (has ${String(scene.characterId)})`);
    }
    if (!perHeroine && scene.characterId !== null) errors.push(`${where}: a ${scene.kind} scene is shared, so its characterId must be null`);
    if (scene.kind === 'elite-intro') {
      if (scene.avatarId === null) errors.push(`${where}: an elite intro needs its elite's avatar id`);
      else checkAvatar(where, scene.avatarId);
    } else if (scene.avatarId !== null) {
      errors.push(`${where}: only an elite intro names an avatar`);
    }
    if (scene.lines.length === 0) errors.push(`${where}: no lines`);
    scene.lines.forEach((line, i) => {
      lines++;
      const at = `${where} line ${i + 1}`;
      checkText(at, line.text);
      if (line.speakerId === null) {
        if (line.expression !== undefined) errors.push(`${at}: narration has an expression`);
        return;
      }
      const speaker = speakers.get(line.speakerId);
      if (!speaker) errors.push(`${at}: unknown speaker ${line.speakerId}`);
      else if (!line.expression || !speaker.expressions.includes(line.expression)) {
        errors.push(`${at}: ${line.speakerId} has no expression ${String(line.expression)}`);
      }
    });
  }
  for (const character of characters) {
    for (const kind of PER_HEROINE_SCENE_KINDS) {
      const count = content.scenes.filter((scene) => scene.kind === kind && scene.characterId === character.id).length;
      if (count !== 1) errors.push(`story character ${character.id}: has ${count} ${kind} scenes (exactly 1)`);
    }
  }

  // ---------------------------------------------------------------- events
  duplicates('event', content.events.map((event) => event.id));
  const scenesById = new Map(content.scenes.map((scene) => [scene.id, scene]));
  const eventIds = new Set(content.events.map((event) => event.id));
  for (const scene of content.scenes) {
    if (scene.kind === 'event' && !eventIds.has(scene.id)) errors.push(`scene ${scene.id}: an event scene with no event`);
  }
  for (const event of content.events) {
    const where = `event ${event.id}`;
    const scene = scenesById.get(event.id);
    if (!scene || scene.kind !== 'event') errors.push(`${where}: no event scene of the same id`);
    if ((event.reactingSpeakerId === null) !== (event.reactsToChoice === null)) {
      errors.push(`${where}: a reacting speaker and the choice she reacts to go together`);
    }
    if (event.reactingSpeakerId !== null) {
      if (!scene?.lines.some((line) => line.speakerId === event.reactingSpeakerId)) {
        errors.push(`${where}: reacting speaker ${event.reactingSpeakerId} does not speak in the scene`);
      }
      if (event.reactsToChoice !== 0 && event.reactsToChoice !== 1) errors.push(`${where}: reacts to choice ${String(event.reactsToChoice)}`);
    }
    event.choices.forEach((choice, c) => {
      const at = `${where} choice ${c + 1}`;
      checkText(`${at} label`, choice.label);
      if (choice.effects.filter((effect) => effect.kind === 'add-choice').length > 1) errors.push(`${at}: more than one card pick`);
      if (choice.effects.filter((effect) => effect.kind === 'remove-choice').length > 1) errors.push(`${at}: more than one chosen removal`);
      for (const effect of choice.effects) {
        if (effect.kind === 'gold' && effect.amount === 0) errors.push(`${at}: a gold effect of 0`);
        if (effect.kind === 'remove-choice' && (effect.atLeast < 0 || effect.atLeast > effect.upTo)) {
          errors.push(`${at}: removal bounds ${effect.atLeast}..${effect.upTo}`);
        }
        if (effect.kind === 'add-choice' && effect.options < 1) errors.push(`${at}: offers ${effect.options} cards`);
        if (effect.kind !== 'add-random' && effect.kind !== 'add-choice') continue;
        const filter = JSON.stringify(effect.filter);
        if (effect.filter.source === 'catalog') {
          if (storyFilterCards(effect.filter, [], db).length === 0) errors.push(`${at}: filter ${filter} matches no catalog card`);
          continue;
        }
        for (const character of characters) {
          if (storyFilterCards(effect.filter, character.rewardPool, db).length === 0) {
            errors.push(`${at}: filter ${filter} matches no card in ${character.id}'s pool`);
          }
        }
      }
    });
  }

  // ------------------------------------------------------------------- art
  if (options.missingArt) {
    for (const id of [...artIds].sort()) {
      const missing = options.missingArt(id);
      if (missing.length > 0) errors.push(`art ${id}: missing from ${missing.join(', ')}`);
    }
  }

  return {
    errors,
    warnings,
    counts: {
      characters: characters.length,
      scenes: content.scenes.length,
      lines,
      events: content.events.length,
      speakers: content.speakers.length,
      artIds: options.missingArt ? artIds.size : 0,
    },
  };
}

/** Every error in the shipped story content (art not checked). An empty list is a pass. */
export function validateStoryContent(db: CardDb): string[] {
  return checkStoryContent(db).errors;
}
