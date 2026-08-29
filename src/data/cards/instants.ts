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
    flavor: 'Standard-issue solution to nonstandard problems.',
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
    flavor: 'The forest votes yes. All of it. At once.',
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
    flavor: '“I read it in your posture,” she says, insufferably.',
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
    flavor: 'Feet planted, spear first, questions never.',
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
    flavor: 'The armies met. The valley disagreed.',
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
    flavor: 'The tide files no charges. It just takes you home.',
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
    flavor: 'Tea, bandages, and five whole minutes of quiet.',
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
    flavor: 'A cold shoulder from the underworld itself.',
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
    flavor: 'Subtlety is for people with brakes.',
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
    flavor: 'Oops. Was that your footing?',
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
    flavor: 'One dark syllable, one vacancy.',
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
    flavor: 'Well done. Medium rare was not on offer.',
  },
  {
    id: 'in-stand-as-one',
    name: 'Stand as One',
    types: ['charm'],
    subtypes: [],
    cost: cost(1, 'W'),
    colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'boost', p: 1, t: 1, scope: 'allYours' }] }],
    rarity: 'r',
    flavor: 'One banner, many hands, zero hesitation.',
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
    flavor: 'The answer arrives mid-argument, rude and correct.',
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
    flavor: 'The canopy accepts no overflights.',
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
    flavor: 'Aim, invoice the heavens, release.',
  },
  {
    id: 'in-reapers-due',
    name: 'Reaper’s Due',
    types: ['charm'],
    subtypes: [],
    cost: cost(2, 'B'),
    colors: ['B'],
    abilities: [
      {
        when: 'spell',
        targets: [{ what: 'creature' }],
        ops: [
          { op: 'destroy', to: 'target' },
          { op: 'loseLife', n: 2, who: 'opponent' },
        ],
      },
    ],
    rarity: 'sr',
    flavor: 'Payment collected in full, plus processing fees.',
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
    flavor: 'Your idea was lovely. It is hers now.',
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
    flavor: 'Even Olympus has a cleaning fee, and she collects it in advance.',
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
    flavor: 'The gate was fortified. She was not impressed.',
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
    flavor: 'She left the fort empty, the enemy confused, and the valuables elsewhere.',
  },
] as const satisfies readonly CardDef[];
