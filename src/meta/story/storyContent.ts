/**
 * Story content validation (the core of the planned check-story tooling,
 * docs/plan-story-mode.md "Tooling and invariants"). Pure: it reads the story
 * data, the card db and the avatar roster, and returns problems as strings.
 */

import type { CardDb } from '../../engine/types';
import { CORE_SET_2_SET } from '../../data/liveness';
import { AVATARS } from '../../data/opponents';
import { STORY_BOONS, STORY_ACTS, BOON_OFFER_COUNT } from '../../data/story/act1';
import { STORY_CHARACTERS, FIRST_STORY_CHARACTER_ID } from '../../data/story/characters';
import type { StoryCharacter } from '../../data/story/types';
import { isBasicLand, isDualLand, LAND_RESERVE_SIZE, MAX_DUAL_LANDS, reserveColorIdentity } from '../warchest';
import { isStoryDeckCard } from './storyMap';

/**
 * Problems in one character entry. Wave 1 decks and pools use shipped cards
 * only: Core Set II is not live, so a card from it would be unobtainable in a
 * release build. Only the Darling may come from it (Yutu is a Core Set II
 * legend by ruling P13). Wave 3 relaxes this when the set ships.
 */
export function validateStoryCharacter(db: CardDb, character: StoryCharacter): string[] {
  const problems: string[] = [];
  const where = `story character ${character.id}`;
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
      if (card.set === CORE_SET_2_SET) problems.push(`${where}: ${label} card ${id} is from Core Set II, which is not live`);
      if (card.colors.some((color) => !character.colors.includes(color))) {
        problems.push(`${where}: ${label} card ${id} is outside ${character.colors.join('')}`);
      }
    }
  };
  if (character.starterDeck.length < 15 || character.starterDeck.length > 20) {
    problems.push(`${where}: starter deck has ${character.starterDeck.length} cards (15 to 20)`);
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

/** Every problem in the shipped story content. An empty list is a pass. */
export function validateStoryContent(db: CardDb): string[] {
  const problems: string[] = [];
  const avatarIds = new Set(AVATARS.map((avatar) => avatar.id));
  const seen = new Set<string>();
  STORY_CHARACTERS.forEach((character, index) => {
    if (!character.id) problems.push('a story character has an empty id');
    if (seen.has(character.id)) problems.push(`duplicate story character id ${character.id}`);
    seen.add(character.id);
    if (index === 0 && (character.id !== FIRST_STORY_CHARACTER_ID || character.unlock !== null)) {
      problems.push('the first story character must be the open one');
    }
    if (index > 0) {
      const previous = STORY_CHARACTERS[index - 1];
      if (!character.unlock || character.unlock.predecessorId !== previous.id) {
        problems.push(`${character.id} must unlock from ${previous.id} (R10: the character just before her)`);
      }
    }
    problems.push(...validateStoryCharacter(db, character));
  });

  for (const act of STORY_ACTS) {
    for (const id of [...act.fightAvatarIds, ...act.eliteAvatarIds, act.bossAvatarId]) {
      if (!avatarIds.has(id)) problems.push(`act ${act.id}: unknown avatar ${id}`);
    }
    const tierOf = (id: string): number => AVATARS.find((avatar) => avatar.id === id)?.tier ?? 0;
    const hardestFight = Math.max(...act.fightAvatarIds.map(tierOf));
    if (act.eliteAvatarIds.some((id) => tierOf(id) <= hardestFight)) {
      problems.push(`act ${act.id}: every elite must be a stronger avatar than every fight`);
    }
    const floors = act.mapTemplate.floors;
    if (floors.some((floor, i) => floor.floor !== i + 1 || floor.kinds.length === 0)) {
      problems.push(`act ${act.id}: floors must be numbered from 1 with at least one kind each`);
    }
    if (!floors[floors.length - 1]?.kinds.includes('boss') || floors.slice(0, -1).some((f) => f.kinds.includes('boss'))) {
      problems.push(`act ${act.id}: the boss must be the last floor and only there`);
    }
  }

  const boonIds = new Set(STORY_BOONS.map((boon) => boon.id));
  if (boonIds.size !== STORY_BOONS.length) problems.push('duplicate boon id');
  if (STORY_BOONS.length < BOON_OFFER_COUNT) problems.push('fewer boons than a run offers');
  return problems;
}
