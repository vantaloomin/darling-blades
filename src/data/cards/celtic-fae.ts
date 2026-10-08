import type { CardDef } from '../cardTypes';
import { cost } from '../cardTypes';

/**
 * CELTIC FAE — The Silver Veil, the 2nd expansion. Its court bargains in
 * information and absence: foresee bends the next draw, sever closes doors
 * behind it. Catalog stamps each entry with set:'celtic-fae'; prefix cf-.
 *
 * The existing catalog rule requires every multicolor nonland to be legendary,
 * including the lower-rarity court envoys.
 */
type FaeData = Omit<CardDef, 'id' | 'name' | 'types' | 'subtypes'>;

function fae(id: string, name: string, subtype: string, data: FaeData): CardDef {
  return { id, name, types: ['creature'], subtypes: ['Fae', subtype], ...data };
}

export const CELTIC_FAE = [
  // =========================================================================
  // ULTRA RARE (4)
  // =========================================================================
  fae('cf-morrigan-black-wing', 'Morrigan, Black-Wing Omen', 'Goddess', {
    supertypes: ['legendary'], cost: cost(4, 'BG'), colors: ['B', 'G'], attack: 5, defense: 5,
    keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 3, who: 'opponent' }] }, { when: 'attacks', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'ur',
  }),
  fae('cf-titania-silver-court', 'Titania of the Silver Court', 'Queen', {
    supertypes: ['legendary'], cost: cost(4, 'UG'), colors: ['U', 'G'], attack: 4, defense: 4,
    keywords: ['untouchable'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }, { when: 'dawn', ops: [{ op: 'createToken', token: 'tok-bloom', count: 1 }] }],
    rarity: 'ur',
  }),
  fae('cf-aine-sunlit-bargain', 'Aine, Sunlit Bargain', 'Sovereign', {
    supertypes: ['legendary'], cost: cost(2, 'WG'), colors: ['W', 'G'], attack: 4, defense: 5,
    keywords: ['bloodoath'],
    abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 3 }] }, { when: 'attacks', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'ur',
  }),
  fae('cf-nimue-before-the-lake', 'Nimue Before the Lake', 'Mage', {
    supertypes: ['legendary'], cost: cost(3, 'UW'), colors: ['U', 'W'], attack: 4, defense: 5,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }] }, { when: 'dawn', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'ur',
  }),

  // =========================================================================
  // SUPER-SUPER RARE (5)
  // =========================================================================
  {
    id: 'cf-badb-cathas-warning', name: "Badb Catha's Warning", types: ['ritual'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 2 }, { op: 'discardRandom', n: 2, who: 'opponent' }, { op: 'severGrave', n: 2, who: 'opponent' }] }],
    rarity: 'ssr',
  },
  fae('cf-selkie-tide-queen', 'Selkie Tide-Queen', 'Selkie', {
    supertypes: ['legendary'], cost: cost(2, 'UG'), colors: ['U', 'G'], attack: 4, defense: 4,
    keywords: ['untouchable'], abilities: [{ when: 'combatDamageToPlayer', ops: [{ op: 'foresee', n: 2 }] }],
    rarity: 'ssr',
  }),
  {
    id: 'cf-balor-evil-eye', name: "Balor's Evil Eye", types: ['ritual'], subtypes: [],
    // {3}{B}{R} -> {2}{B}{R} user recost 2026-08-01 from 1.5.5 play.
    supertypes: ['legendary'], cost: cost(2, 'BR'), colors: ['B', 'R'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 5, to: 'target' }, { op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'ssr',
  },
  fae('cf-wild-hunt-matriarch', 'Wild Hunt Matriarch', 'Hunter', {
    supertypes: ['legendary'], cost: cost(3, 'RG'), colors: ['R', 'G'], attack: 5, defense: 4,
    keywords: ['warcry', 'overrun'], abilities: [{ when: 'attacks', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'ssr',
  }),
  {
    id: 'cf-cauldron-of-dagda', name: 'Cauldron of the Dagda', types: ['artifact'], subtypes: [],
    cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 2 }, { op: 'foresee', n: 2 }] }],
    rarity: 'ssr',
  },

  // =========================================================================
  // SUPER RARE (7)
  // =========================================================================
  fae('cf-bean-sidhe-keening', 'Bean Sidhe Keening', 'Banshee', {
    cost: cost(2, 'B'), colors: ['B'], attack: 1, defense: 4, keywords: ['skyborne', 'bulwark'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }, { when: 'dawn', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }] }],
    rarity: 'sr',
  }),
  fae('cf-silver-branch-oracle', 'Silver-Branch Oracle', 'Seer', {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 4,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }] }],
    rarity: 'sr',
  }),
  {
    id: 'cf-thorn-crown-geas', name: 'Thorn-Crown Geas', types: ['enchantment'], subtypes: ['Aura'],
    cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: 2, t: 2 } }, { when: 'arrives', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'sr',
  },
  {
    id: 'cf-glamour-of-the-hill', name: 'Glamour of the Hollow Hill', types: ['charm'], subtypes: [],
    cost: cost(2, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'recall', to: 'target' }, { op: 'draw', n: 1 }] }],
    rarity: 'sr',
  },
  fae('cf-redcap-blood-host', 'Redcap Blood-Host', 'Redcap', {
    cost: cost(2, 'RR'), colors: ['R'], attack: 4, defense: 4,
    keywords: ['warcry'], rarity: 'sr',
  }),
  fae('cf-queen-mab-midnight', 'Mab, Midnight Queen', 'Queen', {
    supertypes: ['legendary'], cost: cost(3, 'UB'), colors: ['U', 'B'], attack: 4, defense: 5,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }, { when: 'attacks', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }],
    rarity: 'sr',
  }),
  {
    id: 'cf-ogham-fate-stones', name: 'Ogham Fate-Stones', types: ['artifact'], subtypes: [],
    cost: cost(1), colors: [], abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'sr',
  },

  // =========================================================================
  // RARE (24)
  // =========================================================================
  fae('cf-hollow-hill-gatekeeper', 'Hollow-Hill Gatekeeper', 'Sentinel', {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 5, keywords: ['bulwark'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r',
  }),
  fae('cf-blackthorn-duelist', 'Blackthorn Duelist', 'Sidhe', {
    cost: cost(2, 'G'), colors: ['G'], attack: 3, defense: 2, keywords: ['firstBlade'],
    abilities: [{ when: 'combatDamageToPlayer', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r',
  }),
  fae('cf-raven-torc-envoy', 'Raven-Torc Envoy', 'Raven', {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 3, keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'r',
  }),
  fae('cf-moon-pool-selkie', 'Moon-Pool Selkie', 'Selkie', {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 3,
    abilities: [{ when: 'combatDamageToPlayer', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r',
  }),
  {
    id: 'cf-gold-ring-bargain', name: 'Gold-Ring Bargain', types: ['ritual'], subtypes: [],
    cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 2 }, { op: 'severTop', n: 2, who: 'self' }] }],
    rarity: 'r',
  },
  fae('cf-hounds-of-annwn', 'Hounds of Annwn', 'Hound', {
    cost: cost(3, 'G'), colors: ['G'], attack: 4, defense: 3, keywords: ['overrun'],
    abilities: [{ when: 'dies', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'r',
  }),
  {
    id: 'cf-brigid-ember-blessing', name: "Brigid's Ember Blessing", types: ['charm'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 1, t: 1, keywords: ['twinBlades'], scope: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'r',
  },
  fae('cf-sidhe-silver-lancer', 'Sidhe Silver-Lancer', 'Knight', {
    cost: cost(1, 'WW'), colors: ['W'], attack: 3, defense: 3, keywords: ['firstBlade'],
    rarity: 'r',
  }),
  {
    id: 'cf-mist-over-tara', name: 'Mist Over Tara', types: ['charm'], subtypes: [],
    cost: cost(1, 'U'), colors: ['U'], abilities: [{ when: 'spell', ops: [{ op: 'preventCombat' }, { op: 'foresee', n: 2 }] }],
    rarity: 'r',
  },
  fae('cf-fomorian-raider', 'Fomorian Raider', 'Fomorian', {
    cost: cost(2, 'RR'), colors: ['R'], attack: 5, defense: 3,
    keywords: ['overrun'], abilities: [{ when: 'arrives', ops: [{ op: 'damage', n: 2, to: 'controller' }] }],
    rarity: 'r',
  }),
  {
    id: 'cf-apple-of-emain', name: 'Apple of Emain', types: ['artifact'], subtypes: [],
    cost: cost(0, 'G'), colors: ['G'], abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 1 }, { op: 'foresee', n: 1 }] }],
    rarity: 'r',
  },
  {
    id: 'cf-briar-veil-banishing', name: 'Briar-Veil Banishing', types: ['ritual'], subtypes: [],
    cost: cost(2, 'W'), colors: ['W'], abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'sever', to: 'target' }] }],
    rarity: 'r',
  },
  fae('cf-otter-familiar', 'Otter Familiar', 'Otter', {
    cost: cost(2, 'GG'), colors: ['G'], attack: 2, defense: 3,
    manaAbility: ['G'], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r',
  }),
  fae('cf-crowbone-prophet', 'Crowbone Prophet', 'Oracle', {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'grind', n: 2, who: 'self' }, { op: 'foresee', n: 2 }] }],
    rarity: 'r',
  }),
  {
    id: 'cf-dance-under-mound', name: 'Dance Under the Mound', types: ['ritual'], subtypes: [],
    cost: cost(1, 'GG'), colors: ['G'],
    abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: 'tok-bloom', count: 2 }, { op: 'foresee', n: 2 }] }],
    rarity: 'r',
  },
  {
    id: 'cf-ash-and-mistletoe', name: 'Ash and Mistletoe', types: ['enchantment'], subtypes: [],
    cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Fae' }, p: 1, t: 1 } }],
    rarity: 'r',
  },
  {
    id: 'cf-lake-mirror-vow', name: 'Lake-Mirror Vow', types: ['enchantment'], subtypes: [],
    cost: cost(0, 'U'), colors: ['U'],
    abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r',
  },
  {
    id: 'cf-cold-iron-taboo', name: 'Cold-Iron Taboo', types: ['artifact'], subtypes: [],
    cost: cost(2), colors: [], abilities: [{ when: 'dawn', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'r',
  },
  fae('cf-thornmaze-patrol', 'Thornmaze Patrol', 'Ranger', {
    cost: cost(3, 'G'), colors: ['G'], attack: 3, defense: 4, keywords: ['wardingGaze'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r',
  }),
  fae('cf-bog-lantern-witch', 'Bog-Lantern Witch', 'Witch', {
    cost: cost(2, 'BB'), colors: ['B'], attack: 2, defense: 3,
    keywords: ['deathblade'], abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'r',
  }),
  fae('cf-green-knoll-champion', 'Green Knoll Champion', 'Knight', {
    cost: cost(2, 'GG'), colors: ['G'], attack: 4, defense: 4,
    keywords: ['sentinel', 'overrun'], rarity: 'r',
  }),
  fae('cf-moundlight-midwife', 'Moundlight Midwife', 'Adept', {
    cost: cost(3, 'G'), colors: ['G'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'createToken', token: 'tok-bloom', count: 2 }] }],
    rarity: 'r',
  }),
  {
    id: 'cf-moonlit-barrow', name: 'Moonlit Barrow', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['U', 'B'], entersTapped: true, rarity: 'r',
  },
  {
    id: 'cf-sunwell-grove', name: 'Sunwell Grove', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['G', 'W'], entersTapped: true, rarity: 'r',
  },
  {
    id: 'cf-blackthorn-crossing', name: 'Blackthorn Crossing', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['B', 'G'], entersTapped: true, rarity: 'r',
  },

  // =========================================================================
  // COMMON (42)
  // =========================================================================
  fae('cf-fae-ring-initiate', 'Fae-Ring Initiate', 'Adept', {
    cost: cost(1, 'U'), colors: ['U'], attack: 1, defense: 2, abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c',
  }),
  fae('cf-mistwing-pixie', 'Mistwing Pixie', 'Pixie', {
    cost: cost(1, 'U'), colors: ['U'], attack: 2, defense: 1, keywords: ['skyborne'],
    rarity: 'c',
  }),
  fae('cf-thorn-sprite', 'Thorn Sprite', 'Sprite', {
    cost: cost(0, 'G'), colors: ['G'], attack: 1, defense: 2, keywords: ['wardingGaze'],
    rarity: 'c',
  }),
  fae('cf-redcap-skirmisher', 'Redcap Skirmisher', 'Redcap', {
    cost: cost(1, 'R'), colors: ['R'], attack: 3, defense: 1, keywords: ['warcry'],
    rarity: 'c',
  }),
  fae('cf-bog-banshee', 'Bog Banshee', 'Banshee', {
    cost: cost(2, 'B'), colors: ['B'], attack: 3, defense: 1, keywords: ['deathblade', 'skyborne'],
    rarity: 'c',
  }),
  fae('cf-sidhe-page', 'Sidhe Page', 'Sidhe', {
    cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 3, keywords: ['sentinel'],
    rarity: 'c',
  }),
  fae('cf-omen-raven', 'Omen Raven', 'Raven', {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 1, keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c',
  }),
  fae('cf-selkie-runner', 'Selkie Runner', 'Selkie', {
    cost: cost(1, 'U'), colors: ['U'], attack: 2, defense: 1, abilities: [{ when: 'combatDamageToPlayer', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c',
  }),
  fae('cf-mushroom-ring-guard', 'Mushroom-Ring Guard', 'Guard', {
    cost: cost(1, 'G'), colors: ['G'], attack: 1, defense: 4, keywords: ['bulwark'],
    rarity: 'c',
  }),
  fae('cf-willow-wisp-guide', 'Willow-Wisp Guide', 'Spirit', {
    cost: cost(2, 'G'), colors: ['G'], attack: 0, defense: 4, manaAbility: ['G'], keywords: ['bulwark'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }], rarity: 'c',
  }),
  fae('cf-fae-court-tokenmaker', 'Fae Court Reveler', 'Reveler', {
    cost: cost(2, 'G'), colors: ['G'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'createToken', token: 'tok-bloom', count: 1 }] }],
    rarity: 'c',
  }),
  fae('cf-cold-moon-archer', 'Cold-Moon Archer', 'Archer', {
    cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 3, keywords: ['wardingGaze'],
    rarity: 'c',
  }),
  fae('cf-black-dog-of-lane', 'Black Dog of the Lane', 'Hound', {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 1, keywords: ['deathblade'],
    rarity: 'c',
  }),
  fae('cf-heatherblade-scout', 'Heatherblade Scout', 'Scout', {
    // W3 minimal trim (2026-07-30): 3/2 -> 2/2. The declared curve policy
    // (adding-cards.md) keeps modern vanilla bodies but discounts the body
    // for text; a 1-mana 3/2 WITH Overrun at common was the concentrated
    // Silver Veil outlier class the audit named, and this card is 3x in the
    // retained go-wide artifact that survived an answered field at 76.2%.
    // One lever, measured before and after; the artifact re-check dates the
    // result in the W3 close-out commit.
    cost: cost(1, 'G'), colors: ['G'], attack: 2, defense: 2, keywords: ['overrun'],
    rarity: 'c',
  }),
  fae('cf-torclight-envoy', 'Torclight Envoy', 'Diplomat', {
    cost: cost(1, 'W'), colors: ['W'], attack: 2, defense: 2, abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 2 }] }],
    rarity: 'c',
  }),
  {
    id: 'cf-glimmerdust-trick', name: 'Glimmerdust Trick', types: ['charm'], subtypes: [], cost: cost(0, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'cf-fade-beyond-veil', name: 'Fade Beyond the Veil', types: ['charm'], subtypes: [], cost: cost(1, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'recall', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'cf-barrow-whisper', name: 'Barrow Whisper', types: ['ritual'], subtypes: [], cost: cost(0, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 2 }, { op: 'grind', n: 2, who: 'self' }] }],
    rarity: 'c',
  },
  {
    id: 'cf-thornsnare', name: 'Thornsnare', types: ['charm'], subtypes: [], cost: cost(0, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 1, t: 2, keywords: ['wardingGaze'], scope: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'cf-ember-of-brigid', name: 'Ember of Brigid', types: ['charm'], subtypes: [], cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 2, to: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'cf-bargain-for-time', name: 'Bargain for Time', types: ['ritual'], subtypes: [], cost: cost(1, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }, { op: 'grind', n: 1, who: 'self' }] }],
    rarity: 'c',
  },
  {
    id: 'cf-cold-iron-nail', name: 'Cold-Iron Nail', types: ['ritual'], subtypes: [], cost: cost(1), colors: [],
    abilities: [{ when: 'spell', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'c',
  },
  {
    id: 'cf-mist-road', name: 'Mist-Road Waymark', types: ['artifact'], subtypes: [], cost: cost(0, 'U'), colors: ['U'],
    activated: { cost: { tap: true }, ops: [{ op: 'foresee', n: 1 }] },
    rarity: 'c',
  },
  {
    id: 'cf-mossy-ring', name: 'Ring-Stone Moss', types: ['artifact'], subtypes: [], cost: cost(0, 'G'), colors: ['G'],
    activated: { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] },
    rarity: 'c',
  },
  {
    id: 'cf-raven-stone', name: 'Raven Stone', types: ['artifact'], subtypes: [], cost: cost(0, 'B'), colors: ['B'],
    activated: { cost: { tap: true }, ops: [{ op: 'foresee', n: 1 }, { op: 'grind', n: 1, who: 'self' }] },
    rarity: 'c',
  },
  {
    id: 'cf-dawn-torc', name: 'Dawn Torc', types: ['artifact'], subtypes: [], cost: cost(1), colors: [],
    abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 2 }] }],
    rarity: 'c',
  },
  {
    id: 'cf-silver-thread', name: 'Silver Thread', types: ['enchantment'], subtypes: ['Aura'], cost: cost(1), colors: [],
    abilities: [{ when: 'static', static: { scope: 'attached', p: 0, t: 2 } }, { when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'cf-night-market-bargain', name: 'Night-Market Bargain', types: ['ritual'], subtypes: [], cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 2 }, { op: 'damage', n: 4, to: 'controller' }] }],
    rarity: 'c',
  },
  fae('cf-laughing-pooka', 'Laughing Pooka', 'Pooka', {
    cost: cost(0, 'RR'), colors: ['R'], attack: 4, defense: 1, keywords: ['rage'],
    rarity: 'c',
  }),
  fae('cf-hazelwand-mystic', 'Hazelwand Mystic', 'Druid', {
    cost: cost(2, 'G'), colors: ['G'], attack: 2, defense: 3, manaAbility: ['G'], keywords: ['bulwark'],
    rarity: 'c',
  }),
  {
    id: 'cf-clouded-memory', name: 'Clouded Memory', types: ['charm'], subtypes: [], cost: cost(1, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'recall', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'cf-bitter-geas', name: 'Bitter Geas', types: ['enchantment'], subtypes: ['Aura'], cost: cost(0, 'B'), colors: ['B'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: -1, t: -1 } }],
    rarity: 'c',
  },
  {
    id: 'cf-hill-feast', name: 'Hill Feast', types: ['ritual'], subtypes: [], cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 4 }, { op: 'createToken', token: 'tok-bloom', count: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'cf-silver-apple-shot', name: 'Silver Apple Shot', types: ['ritual'], subtypes: [], cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 3, to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'cf-oak-shield-vow', name: 'Oak-Shield Vow', types: ['charm'], subtypes: [], cost: cost(0, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 0, t: 3, scope: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    // 1.6: Silver Veil's Hauntlink carrier (owner ruling 2026-08-21). No arrives trigger on purpose: a cheap arrives-Foresee-1 artifact duplicated Quest Marker and Moonwire Mask in 1.5. Dreaded is the one evasion keyword no Yokai rider grants.
    id: 'cf-fogbell-chime', name: 'Fogbell Chime', types: ['artifact'], subtypes: [], cost: cost(0, 'U'), colors: ['U'],
    hauntlink: { cost: cost(1), linked: { grantKeywords: ['dreaded'] } },
    rarity: 'c',
  },
  fae('cf-moorland-guide', 'Moorland Guide', 'Guide', {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['sentinel'],
    rarity: 'c',
  }),
  fae('cf-veil-touched-hart', 'Veil-Touched Hart', 'Hart', {
    cost: cost(2, 'G'), colors: ['G'], attack: 2, defense: 3, abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c',
  }),
  fae('cf-cairnlight-adept', 'Cairnlight Adept', 'Witch', {
    cost: cost(1, 'B'), colors: ['B'], attack: 2, defense: 2, abilities: [{ when: 'arrives', ops: [{ op: 'grind', n: 2, who: 'self' }] }],
    rarity: 'c',
  }),
  {
    id: 'cf-fae-spark', name: 'Fae Spark', types: ['charm'], subtypes: [], cost: cost(0, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 2, t: 0, scope: 'target' }, { op: 'damage', n: 1, to: 'controller' }] }],
    rarity: 'c',
  },
  {
    id: 'cf-bargain-unwound', name: 'Bargain Unwound', types: ['charm'], subtypes: [], cost: cost(1, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'artifactOrEnchantment' }], ops: [{ op: 'recall', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  // Returning-mechanics sprinkle (1.6): Empower and Skim visit the Silver
  // Veil. Base rates sit a notch above Nurture/Cold-Iron Nail on purpose so
  // neither shipped card is dominated; the mechanic is the payoff.
  {
    id: 'cf-tithe-of-seasons', name: 'Tithe of Seasons', types: ['ritual'], subtypes: [],
    cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', targets: [{ what: 'yourCreature' }], ops: [{ op: 'addCounters', n: 2, to: 'target' }] }],
    empower: { cost: cost(2, 'G'), ops: [{ op: 'createToken', token: 'tok-bloom', count: 2 }] },
    rarity: 'c',
  },
  {
    id: 'cf-salt-the-barrow', name: 'Salt the Barrow', types: ['charm'], subtypes: [],
    cost: cost(0, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }],
    skim: { cost: cost(1) },
    rarity: 'c',
  },
] satisfies readonly CardDef[];
