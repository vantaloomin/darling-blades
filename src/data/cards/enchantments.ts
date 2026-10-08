import type { CardDef } from '../cardTypes';
import { cost } from '../cardTypes';

/** Enchantments — six Auras plus four battlefield-wide banners. */
export const ENCHANTMENTS = [
  {
    id: 'en-vow-of-peace',
    name: 'Vow of Peace',
    types: ['enchantment'],
    subtypes: ['Aura'],
    cost: cost(1, 'W'),
    colors: ['W'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: -4, t: 0 } }],
    rarity: 'c',
  },
  {
    id: 'en-wild-blessing',
    name: 'Wild Blessing',
    types: ['enchantment'],
    subtypes: ['Aura'],
    cost: cost(1, 'G'),
    colors: ['G'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: 2, t: 2 } }],
    rarity: 'c',
  },
  {
    id: 'en-withering-curse',
    name: 'Withering Curse',
    types: ['enchantment'],
    subtypes: ['Aura'],
    cost: cost(1, 'B'),
    colors: ['B'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: -2, t: -2 } }],
    rarity: 'c',
  },
  {
    id: 'en-clouded-mind',
    name: 'Clouded Mind',
    types: ['enchantment'],
    subtypes: ['Aura'],
    cost: cost(0, 'U'),
    colors: ['U'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: -3, t: 0 } }],
    rarity: 'c',
  },
  {
    id: 'en-wings-of-dawn',
    name: 'Wings of Dawn',
    types: ['enchantment'],
    subtypes: ['Aura'],
    // Owner-ruled 2026-08-29 (Sera's Embrace anchor): +2/+2, Skyborne AND
    // Sentinel at {1}{W}{W} - the aura haircut prices our auras a notch under
    // the MTG sticker, so this lands -0.64 in band.
    cost: cost(1, 'WW'),
    colors: ['W'],
    abilities: [
      { when: 'static', static: { scope: 'attached', p: 2, t: 2, grantKeywords: ['skyborne', 'sentinel'] } },
    ],
    rarity: 'r',
  },
  {
    id: 'en-battle-fervor',
    name: 'Battle Fervor',
    types: ['enchantment'],
    subtypes: ['Aura'],
    cost: cost(0, 'R'),
    colors: ['R'],
    abilities: [
      { when: 'static', static: { scope: 'attached', p: 2, t: 0, grantKeywords: ['warcry'] } },
    ],
    rarity: 'c',
  },
  {
    id: 'en-call-of-the-wilds',
    name: 'Call of the Wilds',
    types: ['enchantment'],
    subtypes: [],
    cost: cost(1, 'G'),
    colors: ['G'],
    abilities: [
      { when: 'static', static: { scope: 'filter', filter: { subtype: 'Beastkin' }, p: 1, t: 1 } },
    ],
    rarity: 'r',
  },
  {
    id: 'en-banner-of-the-hegemon',
    name: 'Banner of the Hegemon',
    types: ['enchantment'],
    subtypes: [],
    cost: cost(1, 'B'),
    colors: ['B'],
    abilities: [
      { when: 'static', static: { scope: 'filter', filter: { subtype: 'Wei' }, p: 1, t: 1 } },
    ],
    rarity: 'r',
  },
  {
    id: 'en-peach-garden-oath',
    name: 'Peach Garden Oath',
    types: ['enchantment'],
    subtypes: [],
    cost: cost(1, 'W'),
    colors: ['W'],
    abilities: [
      { when: 'static', static: { scope: 'filter', filter: { subtype: 'Shu' }, p: 1, t: 1 } },
    ],
    rarity: 'r',
  },
  {
    id: 'en-olympus-ascendant',
    name: 'Olympus Ascendant',
    types: ['enchantment'],
    subtypes: [],
    cost: cost(2, 'WW'),
    colors: ['W'],
    abilities: [
      { when: 'static', static: { scope: 'filter', filter: { subtype: 'Olympian' }, p: 2, t: 2 } },
    ],
    rarity: 'sr',
  },
  // Returning-mechanics sprinkle (1.6): the first Quest outside Grail Oath.
  // All three chapters are trigger-safe and automatic, so every AI tier
  // pilots it at full strength.
  {
    id: 'en-persephones-return',
    name: "Persephone's Return",
    types: ['enchantment'],
    subtypes: ['Quest'],
    cost: cost(2, 'B'),
    colors: ['B'],
    chapters: [
      [{ op: 'grind', n: 2, who: 'self' }],
      [{ op: 'raise', to: 'top' }],
      [{ op: 'boost', p: 1, t: 1, scope: 'allYours' }],
    ],
    rarity: 'r',
  },
] as const satisfies readonly CardDef[];
