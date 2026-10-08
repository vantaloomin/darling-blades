import type { CardDef } from '../cardTypes';
import { cost } from '../cardTypes';

/**
 * Rituals (the `ritual` card type) — main-phase haymakers, ramp, and recursion.
 * The `so-` id prefix and the `SORCERIES` export keep the legacy namespace:
 * card ids are opaque save keys, so they are not renamed.
 */
export const SORCERIES = [
  {
    id: 'so-divination',
    name: 'Twice-Read Water',
    types: ['ritual'],
    subtypes: [],
    cost: cost(2, 'U'),
    colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 2 }] }],
    rarity: 'c',
  },
  {
    id: 'so-rampant-growth',
    name: 'Verdant Invitation',
    types: ['ritual'],
    subtypes: [],
    cost: cost(1, 'G'),
    colors: ['G'],
    abilities: [{ when: 'spell', ops: [{ op: 'extraLandDrop' }] }],
    rarity: 'c',
  },
  {
    id: 'so-raise-dead',
    name: 'Summon the Dead',
    types: ['ritual'],
    subtypes: [],
    cost: cost(0, 'B'),
    colors: ['B'],
    abilities: [{ when: 'spell', targets: [{ what: 'yourGraveCreature' }], ops: [{ op: 'reclaim' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    // Charm, not Ritual (owner, 2026-08-29). It STAYS in this file: the id
    // prefix convention is enforced per array (SORCERIES ids must be `so-`)
    // and ids are immutable, so relocating it to instants.ts would break
    // catalog integrity. Only the type changed.
    id: 'so-lava-axe',
    name: 'Molten Cleaver',
    types: ['charm'],
    subtypes: [],
    cost: cost(3, 'R'),
    colors: ['R'],
    abilities: [{ when: 'spell', ops: [{ op: 'damage', n: 5, to: 'opponent' }] }],
    rarity: 'c',
  },
  {
    id: 'so-muster-militia',
    name: 'Muster the Militia',
    types: ['ritual'],
    subtypes: [],
    cost: cost(1, 'W'),
    colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: 'tok-militia', count: 2 }] }],
    rarity: 'c',
  },
  {
    id: 'so-nurture',
    name: 'Nurture',
    types: ['ritual'],
    subtypes: [],
    cost: cost(1, 'G'),
    colors: ['G'],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'yourCreature' }],
        ops: [{ op: 'addCounters', n: 2, to: 'target' }],
      },
    ],
    rarity: 'c',
  },
  {
    id: 'so-night-extortion',
    name: 'Night Extortion',
    types: ['ritual'],
    subtypes: [],
    cost: cost(0, 'BB'),
    colors: ['B'],
    abilities: [
      {
        when: 'spell',
        ops: [
          { op: 'damage', n: 2, to: 'controller' },
          { op: 'draw', n: 1 },
          { op: 'discardRandom', n: 1, who: 'opponent' },
        ],
      },
    ],
    rarity: 'c',
  },
  {
    id: 'so-creeping-malaise',
    name: 'Creeping Malaise',
    types: ['ritual'],
    subtypes: [],
    cost: cost(0, 'B'),
    colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'boost', p: -1, t: -1, scope: 'all' }] }],
    rarity: 'c',
  },
  {
    id: 'so-flame-lash',
    name: 'Flame Lash',
    types: ['ritual'],
    subtypes: [],
    cost: cost(1, 'R'),
    colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 4, to: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'so-ember-squall',
    name: 'Ember Squall',
    types: ['ritual'],
    subtypes: [],
    cost: cost(0, 'R'),
    colors: ['R'],
    abilities: [{ when: 'spell', ops: [{ op: 'damage', n: 1, to: 'eachCreature' }] }],
    rarity: 'c',
  },
  {
    id: 'so-dirge-of-loss',
    name: 'Dirge of Loss',
    types: ['ritual'],
    subtypes: [],
    cost: cost(0, 'BB'),
    colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'discardRandom', n: 2, who: 'opponent' }] }],
    rarity: 'r',
  },
  {
    id: 'so-parade-of-heroes',
    name: 'Parade of Heroes',
    types: ['ritual'],
    subtypes: [],
    cost: cost(2, 'W'),
    colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: 'tok-militia', count: 3 }] }],
    rarity: 'r',
  },
  {
    id: 'so-strategic-planning',
    name: 'Strategic Planning',
    types: ['ritual'],
    subtypes: [],
    cost: cost(2, 'UU'),
    colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 3 }] }],
    rarity: 'r',
  },
  {
    id: 'so-warcry',
    name: 'Warcry',
    types: ['ritual'],
    subtypes: [],
    cost: cost(0, 'R'),
    colors: ['R'],
    abilities: [
      { when: 'spell', ops: [{ op: 'boost', p: 1, t: 0, keywords: ['warcry'], scope: 'allYours' }] },
    ],
    rarity: 'r',
  },
  {
    id: 'so-stampede-season',
    name: 'Stampede Season',
    types: ['ritual'],
    subtypes: [],
    cost: cost(0, 'GG'),
    colors: ['G'],
    abilities: [
      {
        when: 'spell',
        ops: [{ op: 'boost', p: 2, t: 2, keywords: ['overrun'], scope: 'allYours' }],
      },
    ],
    rarity: 'sr',
  },
  {
    id: 'so-judgment-of-heaven',
    name: 'Judgment of Heaven',
    types: ['ritual'],
    subtypes: [],
    cost: cost(2, 'WW'),
    colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'massDestroy', filter: 'allCreatures' }] }],
    rarity: 'sr',
  },
  {
    id: 'so-the-wilds-take-it-back',
    name: 'The Wilds Take It Back',
    types: ['ritual'],
    subtypes: [],
    // Owner-ruled 2026-08-29: goes {G}{W} AND legendary, so the multicolour
    // nonland invariant holds. (Was parked mono-green while colour-vs-legendary
    // was an open question.)
    supertypes: ['legendary'],
    cost: cost(0, 'GW'),
    colors: ['G', 'W'],
    abilities: [{ when: 'spell', ops: [{ op: 'massDestroy', filter: 'allEnchantments' }] }],
    rarity: 'r',
  },
  // Returning-mechanics sprinkle (1.6): Retell and Skim reach the Base Set.
  // Echo's Refrain sits a mana above Bargain for Time so the Veil cantrip
  // stays the efficient pick; the recast is what you pay for. Roadside
  // Shrine sits a mana above Blessed Respite for the same reason: Skim
  // turns the narrow lifegain ritual into a card that is never dead.
  {
    id: 'so-echos-refrain',
    name: "Echo's Refrain",
    types: ['ritual'],
    subtypes: [],
    cost: cost(2, 'U'),
    colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }] }],
    retell: { cost: cost(3, 'U') },
    rarity: 'c',
  },
  {
    id: 'so-roadside-shrine',
    name: 'Roadside Shrine',
    types: ['ritual'],
    subtypes: [],
    cost: cost(0, 'W'),
    colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 4 }] }],
    skim: { cost: cost(1) },
    rarity: 'c',
  },
] as const satisfies readonly CardDef[];
