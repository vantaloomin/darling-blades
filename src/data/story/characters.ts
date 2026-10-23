import type { StoryCharacter } from './types';

/**
 * The three Story Mode heroines (rulings R2, R3, R4, R8c, R10; plan-2.0 P13
 * named the third, Yutu). Order is the unlock chain.
 *
 * Wave 3 starters (owner ruling W2, 2026-10-13): each 30-card starter and its
 * reward pool are built from Core Set I (the shipped catalog) and Core Set II,
 * keeping the heroine's colours and identity: Guan Yu fields Three Kingdoms
 * and Human warriors, Persephone the Greek underworld and spring's plants, and
 * Yutu Beastkin only. They are tuned so each heroine clears Act 1 in 40-50% of
 * the headless 200-seed story matrix (ruling W1; docs/plan-story-mode.md,
 * Measurement). The headless run's trim-two boon cuts the last two cards of
 * the list, so the order below is part of what was measured.
 * Starters are 30 cards (owner ruling 2026-10-12): at 20 the run deck ran out
 * before the avatars' decks did.
 */

export const GUAN_YU_ID = 'guan-yu';
export const PERSEPHONE_ID = 'persephone';
export const YUTU_ID = 'yutu';

export const STORY_CHARACTERS: readonly StoryCharacter[] = [
  {
    id: GUAN_YU_ID,
    name: 'Guan Yu, Saint of War',
    darlingId: 'tk-shu-guanyu',
    colors: ['W', 'R'],
    starterDeck: [
      // Shu, Wu and Wei bodies with Human warriors from the other sets, then burn and removal
      'dd-wreck-runner', 'dd-wreck-runner', 'cs2-shu-village-guard', 'cs2-shu-village-guard',
      'tk-wu-sunce', 'tk-wu-sunce', 'cs2-wu-marine', 'cs2-wu-marine',
      'tk-shu-xingcai', 'tk-shu-xingcai', 'tk-wei-xiahoudun', 'tk-wei-xiahoudun',
      'cs2-fire-ship-captain', 'dd-shore-patrol', 'dt-bell-tower-dancer', 'tk-shu-zhaoyun',
      'tk-other-lubu', 'cs2-dailai-dongzhu', 'dd-brenna-gale', 'fd-kesh-raptor-rider',
      'dt-warrior-ballad-captain', 'in-char', 'in-char', 'cs2-ember-of-red-cliffs',
      'cs2-ember-of-red-cliffs', 'cs2-fire-ships-loosed', 'cs2-court-condemns', 'cs2-wind-at-red-cliffs',
      'cs2-court-condemns', 'tk-wu-sunjian',
    ],
    landReserve: [
      'ld-beacon-ridge', 'ld-beacon-ridge', 'ld-beacon-ridge', 'ld-beacon-ridge',
      'land-plains', 'land-plains', 'land-plains',
      'land-mountain', 'land-mountain', 'land-mountain',
    ],
    rewardPool: [
      // Three Kingdoms first: the weighting is the pool's make-up; then Human warriors and W/R spells
      'tk-shu-zhaoyun', 'tk-other-lubu', 'cs2-dailai-dongzhu', 'tk-shu-xingcai',
      'tk-wei-xiahoudun', 'tk-wu-sunce', 'tk-wu-sunjian', 'tk-wu-taishici',
      'tk-other-zhurong', 'cs2-guan-xing', 'cs2-peach-sworn-sister', 'cs2-wei-muster-captain',
      'cs2-fire-ship-captain', 'cs2-wu-marine', 'dd-brenna-gale', 'dt-warrior-ballad-captain',
      'fd-kesh-raptor-rider', 'dd-shore-patrol', 'dt-bell-tower-dancer', 'fdc-bone-wall-elder-bo',
      'dd-wreck-runner', 'in-char', 'in-comet-blast', 'cs2-fire-ships-loosed',
      'cs2-court-condemns', 'cs2-white-horse-rally',
    ],
    unlock: null,
    placeholderDeck: false,
  },
  {
    id: PERSEPHONE_ID,
    name: 'Persephone, Queen of Two Courts',
    darlingId: 'gk-persephone',
    colors: ['B', 'G'],
    starterDeck: [
      // Walls and shades to hold the ground, the Olympians of the dark, risen dead, and the underworld's judgments
      'dd-tidepool-wall', 'gk-gaia', 'cs2-shade-of-lethe', 'cs2-shade-of-lethe',
      'cs2-lamia', 'cs2-shade-of-asphodel', 'dd-marsh-grave-risen', 'dd-marsh-grave-risen',
      'dt-thorn-castle-warden', 'dt-thorn-castle-warden', 'cs2-nemesis', 'cs2-nemesis',
      'gk-hecate', 'cs2-lamia', 'cs2-medusa', 'gk-hades',
      'cs2-altar-of-hades', 'cs2-sentence-of-death', 'cs2-heavens-edict', 'gk-thanatos',
      'in-doom-bolt', 'cs2-judgment-of-hades', 'in-doom-bolt', 'cs2-hydra-venom',
      'cs2-hydra-venom', 'cs2-hydra-venom', 'cs2-hydra-venom', 'cs2-asphodel-garden',
      'gk-nyx', 'in-reapers-due',
    ],
    landReserve: [
      'ld-asphodel-meadow', 'ld-asphodel-meadow', 'ld-asphodel-meadow', 'ld-asphodel-meadow',
      'land-swamp', 'land-swamp', 'land-swamp',
      'land-forest', 'land-forest', 'land-forest',
    ],
    rewardPool: [
      // The underworld's Olympians, judgments and walls
      'gk-hades', 'cs2-medusa', 'cs2-nemesis', 'gk-hecate',
      'gk-artemis', 'cs2-shade-of-tartarus', 'cs2-shade-of-asphodel', 'cs2-heavens-edict',
      'cs2-hecatomb', 'cs2-judgment-of-hades', 'in-doom-bolt', 'in-reapers-due',
      'cs2-hydra-venom', 'cs2-sentence-of-death', 'cs2-lamia', 'dd-tidepool-wall',
      'dt-thorn-castle-warden', 'cs2-oath-on-the-styx', 'cs2-asphodel-garden', 'cs2-styx-oathsworn',
      'dd-marsh-grave-risen', 'cs2-altar-of-hades',
    ],
    unlock: { predecessorId: GUAN_YU_ID, wins: 1, runs: 3 },
    placeholderDeck: false,
  },
  {
    id: YUTU_ID,
    name: 'Yutu, Jade Rabbit of the Moon Palace',
    darlingId: 'cs2-yutu',
    colors: ['W', 'U'],
    starterDeck: [
      // The Moon Palace's Beastkin, then W/U removal and tricks
      'cs2-moon-palace-kitten', 'cs2-moon-palace-kitten', 'bk-bunny-vanguard', 'bk-bunny-vanguard',
      'cs2-moon-palace-cat', 'cs2-moon-palace-cat', 'bk-kitsune-dreamweaver', 'bk-kitsune-dreamweaver',
      'cs2-otter-thief', 'bk-foxfire-priestess', 'bk-foxfire-priestess', 'cs2-moon-court-messenger',
      'cs2-moon-court-messenger', 'cs2-hare-guard', 'cs2-hare-guard', 'cs2-shield-line-hoplite',
      'cs2-shield-line-hoplite', 'cs2-suanni', 'cs2-suanni', 'cs2-tide-seal',
      'cs2-tide-seal', 'cs2-moon-gate-warden', 'cs2-moon-gate-warden', 'fd-woolly-rhinokin',
      'cs2-banished-frontier', 'cs2-court-condemns', 'in-stand-as-one', 'cs2-court-condemns',
      'cs2-river-current', 'dd-lightkeepers-oath',
    ],
    landReserve: [
      'ld-misty-palace-terrace', 'ld-misty-palace-terrace', 'ld-misty-palace-terrace', 'ld-misty-palace-terrace',
      'land-plains', 'land-plains', 'land-plains',
      'land-island', 'land-island', 'land-island',
    ],
    rewardPool: [
      // Beastkin and W/U spells
      'cs2-moon-court-messenger', 'cs2-suanni', 'cs2-tide-seal', 'cs2-moon-palace-cat',
      'cs2-river-court-diver', 'cs2-lanlan', 'fd-woolly-rhinokin', 'bk-foxfire-priestess',
      'bk-kitsune-dreamweaver', 'cs2-moon-gate-warden', 'cs2-hare-guard', 'cs2-holstaur-herdswoman',
      'cs2-shield-line-hoplite', 'cs2-moon-pestle', 'dd-lightkeepers-oath', 'cs2-white-horse-rally',
      'in-stand-as-one', 'cs2-banished-frontier', 'cs2-river-current', 'cs2-court-condemns',
      'cf-glamour-of-the-hill',
    ],
    unlock: { predecessorId: PERSEPHONE_ID, wins: 1, runs: 3 },
    placeholderDeck: false,
  },
];

/** The character every save starts with (R4). */
export const FIRST_STORY_CHARACTER_ID = GUAN_YU_ID;

export function storyCharacterById(id: string): StoryCharacter | undefined {
  return STORY_CHARACTERS.find((character) => character.id === id);
}
