import type { StoryAct, StoryBoon } from './types';

/**
 * Act 1 (ruling S3: 9 floors, about 6 duels). The floor table is the wave 1
 * spec: floor 1 fight; floors 2 and 3 fight or event; floor 4 shop or event;
 * floor 5 elite or fight; floor 6 event or rest; floor 7 fight or elite;
 * floor 8 rest or shop; floor 9 the boss, Sima Yi (ruling S1).
 *
 * Opponents are existing avatars: ordinary fights draw from the first Tower
 * rungs, elites from the next two, so an elite is always a stronger avatar
 * than any ordinary fight. Gold numbers are wave 1 placeholders; wave 3 sets
 * them with progression-sim (they are run gold and never reach the save's gold).
 */
export const ACT1: StoryAct = {
  id: 'act1',
  act: 1,
  mapTemplate: {
    id: 'act1-map',
    floors: [
      { floor: 1, kinds: ['fight'] },
      { floor: 2, kinds: ['fight', 'event'] },
      { floor: 3, kinds: ['fight', 'event'] },
      { floor: 4, kinds: ['shop', 'event'] },
      { floor: 5, kinds: ['elite', 'fight'] },
      { floor: 6, kinds: ['event', 'rest'] },
      { floor: 7, kinds: ['fight', 'elite'] },
      { floor: 8, kinds: ['rest', 'shop'] },
      { floor: 9, kinds: ['boss'] },
    ],
    minWidth: 2,
    maxWidth: 3,
  },
  fightAvatarIds: ['menghuo', 'hestia', 'lupa'],
  eliteAvatarIds: ['hera', 'zhurong'],
  bossAvatarId: 'simayi',
  economy: {
    startGold: 50,
    fightGold: 20,
    eliteGold: 40,
    eventGold: 30,
    shopPrice: { c: 30, r: 50, sr: 80, ssr: 120, ur: 150 },
    shopStock: 3,
    rewardChoices: 3,
    minDeckSize: 12,
  },
};

/** Every act Story Mode ships, by act number (2.0 ships Act 1 only). */
export const STORY_ACTS: readonly StoryAct[] = [ACT1];

/** Gold the `run-gold` boon adds to the run. */
export const BOON_RUN_GOLD = 100;

/** How many of the boons below one run offers (ruling R5: choose one of three). */
export const BOON_OFFER_COUNT = 3;

/** The opening boons (R5). A run is offered three of these, chosen by its seed. */
export const STORY_BOONS: readonly StoryBoon[] = [
  { id: 'run-gold', name: 'War Chest', text: `Start the run with ${BOON_RUN_GOLD} extra gold.` },
  { id: 'sr-card', name: 'A Gift of Steel', text: 'Add a random SR card from your pool to your run deck.' },
  { id: 'trim-two', name: 'Travel Light', text: 'Remove two cards from your starter deck.' },
  { id: 'first-fight-reward', name: 'Spoils Promised', text: 'Take one extra card reward after your first fight.' },
];
