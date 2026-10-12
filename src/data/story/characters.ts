import type { StoryCharacter } from './types';

/**
 * The three Story Mode heroines (rulings R2, R3, R4, R8c, R10; plan-2.0 P13
 * named the third, Yutu). Order is the unlock chain.
 *
 * Wave 1 decks use shipped cards only (no Core Set II card in a deck or pool,
 * since that set is not live yet): Guan Yu's list is the fixture the headless
 * run plays. Persephone's and Yutu's decks are stand-ins so every character is
 * a complete, validated entry; wave 3 replaces all three with the Core Set II
 * starter pools (docs/plan-story-mode.md, Dependencies on Core Set II).
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
      // Early Shu and Three Kingdoms bodies
      'tk-wu-handang', 'tk-wu-handang',
      'tk-shu-guansuo', 'tk-shu-guansuo',
      'tk-other-huaxiong', 'tk-other-huaxiong',
      'tk-other-lulingqi', 'tk-other-lulingqi',
      'tk-shu-wangping', 'tk-shu-wangping',
      'tk-wu-chengpu', 'tk-wu-chengpu',
      'tk-shu-liushan', 'tk-shu-liushan',
      'tk-shu-machao', 'tk-shu-machao',
      'tk-jin-wenyang', 'tk-jin-wenyang',
      'tk-other-yuanshao', 'tk-other-yuanshao',
      // Cheap tricks and reach
      'in-fire-attack', 'in-fire-attack',
      'in-shieldwall', 'in-shieldwall',
      'so-flame-lash', 'so-flame-lash',
      'so-muster-militia', 'so-muster-militia',
      'so-lava-axe', 'so-lava-axe',
    ],
    landReserve: [
      'ld-beacon-ridge', 'ld-beacon-ridge',
      'land-plains', 'land-plains', 'land-plains', 'land-plains',
      'land-mountain', 'land-mountain', 'land-mountain', 'land-mountain',
    ],
    rewardPool: [
      // Shu first: the weighting is the pool's make-up (about three in four are Three Kingdoms).
      'tk-shu-guanping', 'tk-shu-xingcai', 'tk-shu-zhaoyun', 'tk-shu-machao', 'tk-shu-liushan',
      'tk-shu-guansuo', 'tk-shu-wangping',
      'tk-other-lubu', 'tk-other-warband-captain', 'tk-other-zhurong', 'tk-other-lulingqi',
      'tk-wu-sunshangxiang', 'tk-wu-taishici', 'tk-wu-ganning', 'tk-wu-sunce', 'tk-wu-sunjian',
      'tk-wei-xiahoudun', 'tk-wei-caoren', 'tk-wei-xunyu', 'tk-jin-wenyang',
      // A small neutral W/R pool
      'in-char', 'in-comet-blast', 'in-stand-as-one', 'so-judgment-of-heaven',
      'so-parade-of-heroes', 'so-warcry', 'gk-ares', 'dt-warrior-ballad-captain',
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
      'rg-dire-pup', 'rg-dire-pup',
      'rg-corpse-taker', 'rg-corpse-taker', 'rg-corpse-taker',
      'bk-bearkin-guardian', 'bk-bearkin-guardian',
      'rg-wolf-pack-runner', 'rg-wolf-pack-runner',
      'rg-bog-lurker', 'rg-bog-lurker',
      'gk-pan', 'gk-pan',
      'gk-thanatos', 'gk-thanatos',
      'rg-frost-jotun', 'rg-frost-jotun',
      'rg-plaguebearer-draugr', 'rg-plaguebearer-draugr',
      'rg-elder-jotun', 'rg-elder-jotun',
      'in-grave-chill', 'in-grave-chill', 'in-grave-chill',
      'in-valley-mist', 'in-valley-mist',
      'so-creeping-malaise', 'so-creeping-malaise',
      'in-wild-surge', 'in-wild-surge',
    ],
    landReserve: [
      'ld-asphodel-meadow', 'ld-asphodel-meadow',
      'land-swamp', 'land-swamp', 'land-swamp', 'land-swamp',
      'land-forest', 'land-forest', 'land-forest', 'land-forest',
    ],
    rewardPool: [
      'gk-hecate', 'gk-nyx', 'gk-artemis', 'gk-demeter', 'gk-thanatos', 'gk-pan',
      'in-reapers-due', 'in-doom-bolt', 'so-stampede-season', 'so-dirge-of-loss',
      'rg-jotun-earthshaker', 'rg-draugr-jarl', 'rg-great-stag', 'rg-barrow-wight', 'rg-alpha-of-the-hunt',
      'bk-packmother', 'bk-rhinokin-charger', 'bk-deerkin-grovekeeper',
    ],
    unlock: { predecessorId: GUAN_YU_ID, wins: 1, runs: 3 },
    placeholderDeck: true,
  },
  {
    id: YUTU_ID,
    name: 'Yutu, Jade Rabbit of the Moon Palace',
    darlingId: 'cs2-yutu',
    colors: ['W', 'U'],
    starterDeck: [
      'bk-bunny-vanguard', 'bk-bunny-vanguard', 'bk-bunny-vanguard',
      'bk-mousekin-pantry-guard', 'bk-mousekin-pantry-guard',
      'gk-hoplite', 'gk-hoplite', 'gk-hoplite',
      'bk-kitsune-illusionist', 'bk-kitsune-illusionist',
      'bk-mermaid-chartsinger', 'bk-mermaid-chartsinger',
      'bk-holstaur-milkmaid', 'bk-holstaur-milkmaid',
      'gk-selene', 'gk-selene',
      'gk-eos', 'gk-eos',
      'in-shieldwall', 'in-shieldwall',
      'in-tidal-slip', 'in-tidal-slip',
      'in-undertow', 'in-undertow',
      'in-empty-fort-stratagem', 'in-empty-fort-stratagem',
      'so-divination', 'so-divination',
      'so-muster-militia', 'so-muster-militia',
    ],
    landReserve: [
      'ld-misty-palace-terrace', 'ld-misty-palace-terrace',
      'land-plains', 'land-plains', 'land-plains', 'land-plains',
      'land-island', 'land-island', 'land-island', 'land-island',
    ],
    rewardPool: [
      'bk-foxfire-priestess', 'bk-kitsune-dreamweaver', 'gk-hermes', 'gk-apollo',
      'in-dream-fracture', 'so-judgment-of-heaven', 'in-stand-as-one', 'so-parade-of-heroes',
      'in-sudden-insight', 'so-strategic-planning', 'in-read-the-ruse', 'gk-nike',
    ],
    unlock: { predecessorId: PERSEPHONE_ID, wins: 1, runs: 3 },
    placeholderDeck: true,
  },
];

/** The character every save starts with (R4). */
export const FIRST_STORY_CHARACTER_ID = GUAN_YU_ID;

export function storyCharacterById(id: string): StoryCharacter | undefined {
  return STORY_CHARACTERS.find((character) => character.id === id);
}
