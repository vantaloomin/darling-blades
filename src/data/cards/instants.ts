import type { CardDef } from '../cardTypes';
import { cost } from '../cardTypes';

/**
 * Charms (the `charm` card type) — instant-speed tricks, burn, and answers
 * across all five colors. The `in-` id prefix and the `INSTANTS` export keep
 * the legacy namespace: card ids are opaque save keys, so they are not renamed.
 */
export const INSTANTS = [
  {
    id: 'in-fire-attack',
    name: 'Fire Attack',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'R'),
    colors: ['R'],
    abilities: [
      { when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 2, to: 'target' }] },
    ],
    rarity: 'c',
  },
  {
    id: 'in-wild-surge',
    name: 'Wild Surge',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'G'),
    colors: ['G'],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'creature' }],
        ops: [{ op: 'boost', p: 3, t: 3, scope: 'target' }],
      },
    ],
    rarity: 'c',
  },
  {
    id: 'in-read-the-ruse',
    name: 'Read the Ruse',
    types: ['charm'],
    subtypes: [],
    cost: cost(1, 'UU'),
    colors: ['U'],
    abilities: [
      { when: 'spell', targets: [{ what: 'spell' }], ops: [{ op: 'cancel', to: 'target' }] },
    ],
    rarity: 'c',
  },
  {
    id: 'in-shieldwall',
    name: 'Shieldwall Discipline',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'W'),
    colors: ['W'],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'creature' }],
        ops: [{ op: 'boost', p: 1, t: 3, keywords: ['firstBlade'], scope: 'target' }],
      },
    ],
    rarity: 'c',
  },
  {
    id: 'in-valley-mist',
    name: 'Valley Mist',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'G'),
    colors: ['G'],
    abilities: [{ when: 'spell', ops: [{ op: 'preventCombat' }] }],
    rarity: 'c',
  },
  {
    id: 'in-undertow',
    name: 'Undertow',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'U'),
    colors: ['U'],
    abilities: [
      { when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'recall', to: 'target' }] },
    ],
    rarity: 'c',
  },
  {
    id: 'in-blessed-respite',
    name: 'Blessed Respite',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'W'),
    colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 4 }] }],
    rarity: 'c',
  },
  {
    id: 'in-grave-chill',
    name: 'Grave Chill',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'B'),
    colors: ['B'],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'creature' }],
        ops: [{ op: 'boost', p: -2, t: -2, scope: 'target' }],
      },
    ],
    rarity: 'c',
  },
  {
    id: 'in-boar-rush',
    name: 'Boar Rush',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'R'),
    colors: ['R'],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'creature' }],
        ops: [{ op: 'boost', p: 2, t: 0, keywords: ['overrun'], scope: 'target' }],
      },
    ],
    rarity: 'c',
  },
  {
    id: 'in-tidal-slip',
    name: 'Tidal Slip',
    types: ['charm'],
    subtypes: [],
    cost: cost(1, 'U'),
    colors: ['U'],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'creature' }],
        ops: [
          { op: 'tap', to: 'target' },
          { op: 'draw', n: 1 },
        ],
      },
    ],
    rarity: 'c',
  },
  {
    id: 'in-doom-bolt',
    name: 'Doom Bolt',
    types: ['charm'],
    subtypes: [],
    cost: cost(1, 'BB'),
    colors: ['B'],
    abilities: [
      { when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'destroy', to: 'target' }] },
    ],
    rarity: 'r',
  },
  {
    id: 'in-char',
    name: 'Char',
    types: ['charm'],
    subtypes: [],
    cost: cost(1, 'R'),
    colors: ['R'],
    abilities: [
      { when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 3, to: 'target' }] },
    ],
    rarity: 'r',
  },
  {
    id: 'in-stand-as-one',
    name: 'Stand as One',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'W'),
    colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'boost', p: 1, t: 1, scope: 'allYours' }] }],
    rarity: 'r',
  },
  {
    id: 'in-sudden-insight',
    // Renamed from "Sudden Insight" 2026-07-30: that exact name is a real
    // Magic card. A collision rather than a reproduction (different cost,
    // type, and rarity), but the same class of exposure as PR #158.
    name: 'Uninvited Insight',
    types: ['charm'],
    subtypes: [],
    // {3}{U}, not {2}{U}: at equal cost the instant strictly dominates our own
    // draw-2 Ritual, so the common could never be the right card. Through the
    // target era the instant costs a full mana more than the sorcery (Counsel
    // of the Soratami {2}{U} sorcery 2004, Weave Fate {3}{U} instant 2014).
    // The 2026-08-29 assay slate proposed {2}{U}; reverted, because that is
    // exactly the dominance this note forbids (so-divination is a {2}{U}
    // common Ritual with identical text). The formula's instant premium is
    // below real precedent here, so this stays a documented accept.
    cost: cost(3, 'U'),
    colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 2 }] }],
    rarity: 'r',
  },
  {
    id: 'in-skysweeper-gale',
    name: 'Skysweeper Gale',
    types: ['charm'],
    subtypes: [],
    cost: cost(2, 'G'),
    colors: ['G'],
    abilities: [{ when: 'spell', ops: [{ op: 'massDestroy', filter: 'allFliers' }] }],
    rarity: 'r',
  },
  {
    id: 'in-comet-blast',
    name: 'Comet Blast',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'R'),
    colors: ['R'],
    x: { min: 1 },
    abilities: [
      { when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 'X', to: 'target' }] },
    ],
    rarity: 'sr',
  },
  {
    id: 'in-reapers-due',
    name: 'Reaper’s Due',
    types: ['charm'],
    subtypes: [],
    cost: cost(3, 'B'),
    colors: ['B'],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'creature' }],
        ops: [
          { op: 'destroy', to: 'target' },
          { op: 'loseLife', n: 1, who: 'opponent' },
        ],
      },
    ],
    rarity: 'sr',
  },
  {
    id: 'in-dream-fracture',
    name: 'Dream Fracture',
    types: ['charm'],
    subtypes: [],
    cost: cost(2, 'UU'),
    colors: ['U'],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'spell' }],
        ops: [
          { op: 'cancel', to: 'target' },
          { op: 'draw', n: 1 },
        ],
      },
    ],
    rarity: 'sr',
  },
  {
    id: 'in-cleanse-the-shrine',
    name: 'Cleanse the Shrine',
    types: ['charm'],
    subtypes: [],
    cost: cost(2, 'W'),
    colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'artifactOrEnchantment' }], ops: [{ op: 'sever', to: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'in-ram-the-gates',
    name: 'Ram the Gates',
    types: ['charm'],
    subtypes: [],
    cost: cost(2, 'R'),
    colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'artifact' }], ops: [{ op: 'destroy', to: 'target' }] }],
    empower: { cost: cost(1, 'R'), ops: [{ op: 'damage', n: 2, to: 'opponent' }] },
    rarity: 'c',
  },
  {
    id: 'in-empty-fort-stratagem',
    name: 'Empty Fort Stratagem',
    types: ['charm'],
    subtypes: [],
    cost: cost(0, 'U'),
    colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'artifactOrEnchantment' }], ops: [{ op: 'recall', to: 'target' }] }],
    rarity: 'c',
  },
] as const satisfies readonly CardDef[];
