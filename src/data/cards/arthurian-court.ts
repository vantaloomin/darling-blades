import type { CardDef } from '../cardTypes';
import { cost } from '../cardTypes';

/**
 * ARTHURIAN COURT, The Grail Oath. The fourth collectible set is a court of
 * vows, Quests, awakened champions, and polished steel. The catalog stamps
 * every entry with set:'arthurian-court'; ids use the ac- prefix.
 */
type CourtData = Omit<CardDef, 'id' | 'name' | 'types' | 'subtypes'>;

function creature(id: string, name: string, subtypes: string[], data: CourtData): CardDef {
  return { id, name, types: ['creature'], subtypes, ...data };
}

export const ARTHURIAN_COURT = [
  // =========================================================================
  // ULTRA RARE (4)
  // =========================================================================
  creature('ac-artoria-once-future', 'Artoria, Once and Future Queen', ['Knight', 'Queen'], {
    supertypes: ['legendary'], cost: cost(3, 'WU'), colors: ['W', 'U'], attack: 5, defense: 5,
    keywords: ['sentinel'], awakening: { p: 3, t: 3, keywords: ['firstBlade'] },
    rarity: 'ur',
  }),
  creature('ac-morgan-thorn-crown', 'Morgan of the Thorn Crown', ['Witch', 'Queen'], {
    supertypes: ['legendary'], cost: cost(4, 'UB'), colors: ['U', 'B'], attack: 4, defense: 6,
    abilities: [
      { when: 'arrives', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] },
      { when: 'dawn', ops: [{ op: 'foresee', n: 1 }] },
      { when: 'dawn', condition: 'questActive', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] },
    ],
    rarity: 'ur',
  }),
  creature('ac-nimue-lake-sovereign', 'Nimue, Lake Sovereign', ['Mage', 'Sovereign'], {
    supertypes: ['legendary'], cost: cost(4, 'UW'), colors: ['U', 'W'], attack: 3, defense: 5,
    abilities: [
      { when: 'dawn', ops: [{ op: 'foresee', n: 2 }] },
      { when: 'dawn', condition: 'questActive', ops: [{ op: 'draw', n: 1 }] },
    ],
    rarity: 'ur',
  }),
  {
    id: 'ac-grail-radiant-secret', name: 'The Grail, Radiant Secret', types: ['artifact'], subtypes: [],
    supertypes: ['legendary'], cost: cost(3, 'WG'), colors: ['W', 'G'],
    abilities: [
      { when: 'dawn', ops: [{ op: 'gainLife', n: 2 }] },
      { when: 'dawn', condition: 'questActive', ops: [{ op: 'awaken', scope: 'allYours' }] },
    ],
    rarity: 'ur',
  },

  // =========================================================================
  // SUPER-SUPER RARE (5)
  // =========================================================================
  creature('ac-lancelot-moonlit-shame', 'Lancelot, Moonlit Shame', ['Knight', 'Champion'], {
    supertypes: ['legendary'], cost: cost(3, 'WR'), colors: ['W', 'R'], attack: 5, defense: 4,
    keywords: ['firstBlade'], awakening: { p: 2, t: 1, keywords: ['twinBlades'] },
    rarity: 'ssr',
  }),
  creature('ac-guinevere-court-sun', 'Guinevere, Court Sun', ['Noble', 'Queen'], {
    supertypes: ['legendary'], cost: cost(2, 'WU'), colors: ['W', 'U'], attack: 3, defense: 4,
    abilities: [
      { when: 'arrives', ops: [{ op: 'foresee', n: 1 }] },
      { when: 'dawn', condition: 'questActive', ops: [{ op: 'createToken', token: 'tok-squire', count: 1 }] },
    ],
    rarity: 'ssr',
  }),
  creature('ac-gawain-noonblade', 'Gawain of the Noonblade', ['Knight', 'Champion'], {
    supertypes: ['legendary'], cost: cost(2, 'RW'), colors: ['R', 'W'], attack: 4, defense: 4,
    keywords: ['firstBlade'],
    abilities: [{ when: 'attacks', condition: 'questActive', ops: [{ op: 'damage', n: 2, to: 'opponent' }] }],
    rarity: 'ssr',
  }),
  {
    id: 'ac-quest-for-the-grail', name: 'Quest for the Grail', types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(2, 'W'), colors: ['W'],
    chapters: [
      [{ op: 'foresee', n: 2 }],
      [{ op: 'gainLife', n: 4 }],
      [{ op: 'awaken', scope: 'allYours' }],
    ],
    rarity: 'ssr',
  },
  {
    id: 'ac-fall-of-camelot', name: 'The Fall of Camelot', types: ['enchantment'], subtypes: ['Quest'],
    supertypes: ['legendary'], cost: cost(3, 'BR'), colors: ['B', 'R'],
    chapters: [
      [{ op: 'damage', n: 3, to: 'opponent' }],
      [{ op: 'discardRandom', n: 2, who: 'opponent' }],
      [{ op: 'massDestroy', filter: 'allCreatures' }],
    ],
    rarity: 'ssr',
  },

  // =========================================================================
  // SUPER RARE (7)
  // =========================================================================
  creature('ac-percival-clear-heart', 'Percival, Clear-Heart Knight', ['Knight', 'Grail-Seeker'], {
    supertypes: ['legendary'], cost: cost(2, 'WG'), colors: ['W', 'G'], attack: 4, defense: 4,
    keywords: ['sentinel', 'bloodoath'],
    rarity: 'sr',
  }),
  creature('ac-galahad-silver-oath', 'Galahad, Silver Oath', ['Knight', 'Champion'], {
    supertypes: ['legendary'], cost: cost(3, 'W'), colors: ['W'], attack: 4, defense: 4,
    abilities: [{
      when: 'static', condition: 'questActive',
      static: { scope: 'self', condition: 'questActive', grantKeywords: ['untouchable'] },
    }],
    rarity: 'sr',
  }),
  creature('ac-merlin-crow-clock', 'Merlin, Crow-Clock Sage', ['Mage', 'Sage'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 4,
    abilities: [
      { when: 'arrives', ops: [{ op: 'foresee', n: 2 }] },
      { when: 'dawn', condition: 'questActive', ops: [{ op: 'foresee', n: 1 }] },
    ],
    rarity: 'sr',
  }),
  {
    id: 'ac-excalibur-from-lake', name: 'Excalibur From the Lake', types: ['artifact'], subtypes: [],
    supertypes: ['legendary'], cost: cost(3), colors: [],
    abilities: [{
      when: 'static',
      static: { scope: 'filter', filter: { subtype: 'Knight' }, p: 2, t: 1, grantKeywords: ['firstBlade'] },
    }],
    rarity: 'sr',
  },
  {
    id: 'ac-round-table-vow', name: 'Vow of the Round Table', types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(2, 'W'), colors: ['W'],
    chapters: [
      [{ op: 'createToken', token: 'tok-squire', count: 1 }],
      [{ op: 'boost', p: 1, t: 1, scope: 'allYours' }],
      [{ op: 'awaken', scope: 'allYours' }],
    ],
    rarity: 'sr',
  },
  {
    id: 'ac-green-knight-challenge', name: "The Green Knight's Challenge", types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(2, 'G'), colors: ['G'],
    chapters: [
      [{ op: 'damage', n: 2, to: 'controller' }],
      [{ op: 'boost', p: 2, t: 2, scope: 'allYours' }],
      [{ op: 'boost', p: 3, t: 3, keywords: ['overrun'], scope: 'allYours' }],
    ],
    rarity: 'sr',
  },
  creature('ac-mordred-bastard-star', 'Mordred, Bastard Star', ['Knight', 'Rebel'], {
    supertypes: ['legendary'], cost: cost(3, 'BR'), colors: ['B', 'R'], attack: 4, defense: 4,
    keywords: ['overrun', 'warcry'],
    abilities: [{ when: 'attacks', ops: [{ op: 'damage', n: 2, to: 'opponent' }] }],
    rarity: 'sr',
  }),

  // =========================================================================
  // RARE (25)
  // =========================================================================
  creature('ac-camelot-banneret', 'Camelot Banneret', ['Knight', 'Soldier'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['sentinel'],
    awakening: { p: 1, t: 1, keywords: ['firstBlade'] },
    abilities: [{ when: 'arrives', condition: 'questActive', ops: [{ op: 'createToken', token: 'tok-squire', count: 1 }] }],
    rarity: 'r',
  }),
  creature('ac-lakeblade-initiate', 'Lakeblade Initiate', ['Knight', 'Initiate'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 3, defense: 3, keywords: ['firstBlade'],
    awakening: { p: 1, t: 1, keywords: ['untouchable'] },
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r',
  }),
  creature('ac-chapel-questant', 'Chapel Questant', ['Cleric', 'Quest-Seeker'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['bloodoath'],
    abilities: [{ when: 'dawn', condition: 'questActive', ops: [{ op: 'gainLife', n: 1 }] }],
    rarity: 'r',
  }),
  creature('ac-ashwood-ranger', 'Ashwood Ranger', ['Knight', 'Ranger'], {
    cost: cost(2, 'G'), colors: ['G'], attack: 3, defense: 3, keywords: ['wardingGaze'],
    abilities: [{ when: 'arrives', ops: [{ op: 'addCounters', n: 1, to: 'self' }] }],
    rarity: 'r',
  }),
  creature('ac-velvet-court-spy', 'Velvet Court Spy', ['Spy', 'Courtier'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2,
    abilities: [
      { when: 'arrives', ops: [{ op: 'foresee', n: 1 }] },
      { when: 'combatDamageToPlayer', ops: [{ op: 'discardRandom', n: 1, who: 'opponent' }] },
    ],
    rarity: 'r',
  }),
  creature('ac-tournament-favorite', 'Tournament Favorite', ['Knight', 'Champion'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 3, defense: 2, keywords: ['firstBlade', 'warcry'],
    rarity: 'r',
  }),
  creature('ac-questing-beast-maiden', 'Questing Beast-Maiden', ['Hunter', 'Beast'], {
    cost: cost(2, 'GG'), colors: ['G'], attack: 4, defense: 4, keywords: ['overrun', 'sentinel'],
    rarity: 'r',
  }),
  {
    id: 'ac-mirror-of-avalon', name: 'Mirror of Avalon', types: ['artifact'], subtypes: [],
    cost: cost(0, 'U'), colors: ['U'], abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r',
  },
  {
    id: 'ac-black-chapel-curse', name: 'Black Chapel Curse', types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(1, 'B'), colors: ['B'],
    chapters: [
      [{ op: 'loseLife', n: 2, who: 'opponent' }],
      [{ op: 'discardRandom', n: 1, who: 'opponent' }],
      [{ op: 'severGrave', n: 2, who: 'opponent' }],
    ],
    rarity: 'r',
  },
  {
    id: 'ac-sword-test-stone', name: 'The Sword in the Stone', types: ['artifact'], subtypes: [],
    cost: cost(4), colors: [],
    abilities: [{ when: 'dawn', condition: 'questActive', ops: [{ op: 'awaken', scope: 'allYours' }] }],
    rarity: 'r',
  },
  {
    id: 'ac-grail-procession', name: 'Grail Procession', types: ['ritual'], subtypes: [],
    cost: cost(2, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: 'tok-squire', count: 2 }, { op: 'gainLife', n: 3 }] }],
    rarity: 'r',
  },
  {
    id: 'ac-lion-standard', name: 'Lion Standard', types: ['enchantment'], subtypes: [],
    cost: cost(1, 'W'), colors: ['W'],
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Knight' }, p: 1, t: 1 } }],
    rarity: 'r',
  },
  {
    id: 'ac-courtly-betrayal', name: 'Courtly Betrayal', types: ['ritual'], subtypes: [],
    cost: cost(0, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'discardRandom', n: 1, who: 'opponent' }, { op: 'foresee', n: 1 }] }],
    rarity: 'r',
  },
  creature('ac-lady-of-lilies', 'Lady of Lilies', ['Mage', 'Attendant'], {
    cost: cost(4, 'U'), colors: ['U'], attack: 3, defense: 3,
    abilities: [{ when: 'dawn', condition: 'questActive', ops: [{ op: 'draw', n: 1 }] }],
    rarity: 'r',
  }),
  {
    id: 'ac-red-dragon-banner', name: 'Red Dragon Banner', types: ['enchantment'], subtypes: [],
    cost: cost(3, 'R'), colors: ['R'],
    abilities: [{ when: 'dawn', ops: [{ op: 'boost', p: 2, t: 0, scope: 'allYours' }] }],
    rarity: 'r',
  },
  creature('ac-grail-hermit', 'Grail Hermit', ['Mystic', 'Guide'], {
    cost: cost(3, 'G'), colors: ['G'], attack: 3, defense: 4,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }, { op: 'gainLife', n: 2 }] }],
    rarity: 'r',
  }),
  {
    id: 'ac-moonlit-joust', name: 'Moonlit Joust', types: ['charm'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{
      when: 'spell', targets: [{ what: 'creature' }],
      ops: [{ op: 'boost', p: 2, t: 0, keywords: ['firstBlade'], scope: 'target' }, { op: 'damage', n: 1, to: 'target' }],
    }],
    rarity: 'r',
  },
  {
    id: 'ac-secret-of-avalon', name: 'Secret of Avalon', types: ['ritual'], subtypes: [],
    cost: cost(1, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 1 }, { op: 'foresee', n: 2 }] }],
    rarity: 'r',
  },
  {
    id: 'ac-castle-under-siege', name: 'Castle Under Siege', types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(1, 'R'), colors: ['R'],
    chapters: [
      [{ op: 'createToken', token: 'tok-squire', count: 1 }],
      [{ op: 'damage', n: 2, to: 'opponent' }],
      [{ op: 'boost', p: 2, t: 0, scope: 'allYours' }],
    ],
    rarity: 'r',
  },
  creature('ac-raven-of-camlann', 'Raven of Camlann', ['Bird', 'Omen'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2, keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }],
    rarity: 'r',
  }),
  creature('ac-oathbroken-knight', 'Oathbroken Knight', ['Knight', 'Fallen'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 3, defense: 2, keywords: ['deathblade', 'warcry'],
    rarity: 'r',
  }),
  {
    id: 'ac-lance-of-dawn', name: 'Lance of Dawn', types: ['enchantment'], subtypes: ['Aura'],
    cost: cost(0, 'W'), colors: ['W'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: 2, t: 0, grantKeywords: ['firstBlade'] } }],
    rarity: 'r',
  },
  {
    id: 'ac-queen-regents-command', name: "Queen-Regent's Command", types: ['charm'], subtypes: [],
    cost: cost(3, 'U'), colors: ['U'],
    abilities: [
      { when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }, { op: 'draw', n: 1 }] },
      { when: 'spell', condition: 'questActive', ops: [{ op: 'draw', n: 1 }] },
    ],
    rarity: 'r',
  },
  {
    id: 'ac-holy-well', name: 'Holy Well', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['W', 'G'], entersTapped: true, rarity: 'c',
  },
  {
    id: 'ac-avalon-shore', name: 'Avalon Shore', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['U', 'W'], entersTapped: true, rarity: 'r',
  },

  // Returning-mechanics sprinkle (1.6): twinBlades visits the court. Band
  // per the shipped Ragnarök carriers: attack stays at printed mv minus one.
  creature('ac-paired-blade-errant', 'Paired-Blade Errant', ['Knight', 'Errant'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['twinBlades'],
    rarity: 'r',
  }),

  // =========================================================================
  // COMMON (41)
  // =========================================================================
  creature('ac-novice-squire', 'Novice Squire', ['Squire'], {
    cost: cost(1, 'W'), colors: ['W'], attack: 2, defense: 2, keywords: ['sentinel'],
    rarity: 'c',
  }),
  creature('ac-keep-watchwoman', 'Keep Watchwoman', ['Guard'], {
    cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 4, keywords: ['bulwark'],
    rarity: 'c',
  }),
  creature('ac-lake-attendant', 'Lake Attendant', ['Attendant'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 1, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c',
  }),
  creature('ac-court-minstrel', 'Court Minstrel', ['Bard'], {
    cost: cost(4, 'U'), colors: ['U'], attack: 2, defense: 2,
    abilities: [{ when: 'dawn', condition: 'questActive', ops: [{ op: 'draw', n: 1 }] }],
    rarity: 'c',
  }),
  creature('ac-torchbearer-knight', 'Torchbearer Knight', ['Knight', 'Soldier'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 3, defense: 2, keywords: ['warcry'],
    rarity: 'c',
  }),
  creature('ac-borderland-huntress', 'Borderland Huntress', ['Huntress'], {
    cost: cost(2, 'G'), colors: ['G'], attack: 3, defense: 3, keywords: ['wardingGaze'],
    rarity: 'c',
  }),
  creature('ac-chapel-mender', 'Chapel Mender', ['Cleric'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 2 }] }],
    rarity: 'c',
  }),
  creature('ac-castle-blackguard', 'Castle Blackguard', ['Guard'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 3, defense: 2, keywords: ['deathblade'],
    rarity: 'c',
  }),
  {
    id: 'ac-quest-marker', name: 'Quest Marker', types: ['artifact'], subtypes: [],
    cost: cost(1), colors: [], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }, { when: 'dawn', condition: 'questActive', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: "ac-knights-breakfast", name: "Knight's Breakfast", types: ['ritual'], subtypes: [],
    cost: cost(2, 'G'), colors: ['G'],
    abilities: [
      { when: 'spell', ops: [{ op: 'gainLife', n: 3 }] },
      { when: 'spell', condition: 'questActive', ops: [{ op: 'draw', n: 1 }] },
    ],
    rarity: 'c',
  },
  {
    id: 'ac-steel-prayer', name: 'Steel Prayer', types: ['charm'], subtypes: [],
    cost: cost(0, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 0, t: 3, scope: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'ac-training-yard', name: 'Training Yard', types: ['enchantment'], subtypes: [],
    cost: cost(2, 'R'), colors: ['R'],
    abilities: [{ when: 'dawn', ops: [{ op: 'boost', p: 1, t: 0, scope: 'allYours' }] }],
    rarity: 'c',
  },
  {
    id: 'ac-squire-to-champion', name: 'Squire to Champion', types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(0, 'WW'), colors: ['W'],
    chapters: [
      [{ op: 'boost', p: 1, t: 1, scope: 'allYours' }],
      [{ op: 'awaken', scope: 'allYours' }],
    ],
    rarity: 'c',
  },
  {
    id: 'ac-lantern-in-fog', name: 'Lantern in Fog', types: ['charm'], subtypes: [],
    cost: cost(0, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'ac-bitter-court-rumor', name: 'Bitter Court Rumor', types: ['ritual'], subtypes: [],
    cost: cost(0, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'discardRandom', n: 1, who: 'opponent' }] }],
    rarity: 'c',
  },
  {
    id: 'ac-hunt-the-boar', name: 'Hunt the Boar', types: ['ritual'], subtypes: [],
    cost: cost(2, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 3, to: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'ac-tilting-lance', name: 'Tilting Lance', types: ['charm'], subtypes: [],
    cost: cost(0, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 2, t: 0, keywords: ['firstBlade'], scope: 'target' }] }],
    rarity: 'c',
  },
  creature('ac-white-horse', 'White Horse', ['Horse'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['sentinel'],
    rarity: 'c',
  }),
  creature('ac-riverford-guard', 'Riverford Guard', ['Guard', 'Soldier'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 4, keywords: ['bulwark'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c',
  }),
  {
    id: 'ac-wounded-oath', name: 'Wounded Oath', types: ['enchantment'], subtypes: ['Aura'],
    cost: cost(0, 'B'), colors: ['B'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: -3, t: 0 } }],
    rarity: 'c',
  },
  {
    id: 'ac-candlelit-vigil', name: 'Candlelit Vigil', types: ['enchantment'], subtypes: [],
    cost: cost(0, 'W'), colors: ['W'],
    abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 1 }] }],
    rarity: 'c',
  },
  creature('ac-errant-duelist', 'Errant Duelist', ['Knight', 'Duelist'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 2, defense: 2, keywords: ['firstBlade'],
    awakening: { p: 1, t: 1, keywords: ['untouchable'] },
    rarity: 'c',
  }),
  {
    id: 'ac-grail-glimpse', name: 'Grail Glimpse', types: ['ritual'], subtypes: [],
    cost: cost(0, 'U'), colors: ['U'], abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 4 }] }],
    rarity: 'c',
  },
  creature('ac-root-chapel-warden', 'Root-Chapel Warden', ['Knight', 'Druid'], {
    cost: cost(3, 'G'), colors: ['G'], attack: 2, defense: 5, keywords: ['wardingGaze', 'bloodoath'],
    rarity: 'c',
  }),
  {
    id: 'ac-fallen-banner', name: 'Fallen Banner', types: ['ritual'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{
      when: 'spell', targets: [{ what: 'any' }],
      ops: [
        { op: 'damage', n: 2, to: 'target' },
        { op: 'grind', n: 1, who: 'self' },
        { op: 'grind', n: 1, who: 'opponent' },
      ],
    }],
    rarity: 'c',
  },
  creature('ac-pennant-carrier', 'Pennant Carrier', ['Knight', 'Banneret'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3,
    abilities: [{
      when: 'static', condition: 'questActive',
      static: { scope: 'filter', condition: 'questActive', filter: { subtype: 'Knight', other: true }, p: 1, t: 0 },
    }],
    rarity: 'c',
  }),
  creature('ac-court-archer', 'Court Archer', ['Archer'], {
    cost: cost(1, 'G'), colors: ['G'], attack: 2, defense: 2, keywords: ['wardingGaze'],
    rarity: 'c',
  }),
  {
    id: 'ac-rallying-horn', name: 'Rallying Horn', types: ['ritual'], subtypes: [],
    cost: cost(0, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', ops: [{ op: 'boost', p: 2, t: 0, scope: 'allYours' }] }],
    rarity: 'c',
  },
  creature('ac-prophecy-attendant', "Prophecy Attendant", ['Attendant', 'Seer'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 1, defense: 3,
    abilities: [{ when: 'arrives', condition: 'questActive', ops: [{ op: 'foresee', n: 2 }] }],
    rarity: 'c',
  }),
  {
    id: 'ac-bramble-chapel', name: 'Bramble Reliquary', types: ['artifact'], subtypes: [], colors: ['G'],
    cost: cost(0, 'G'), rarity: 'c',
    activated: { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] },
  },
  {
    id: 'ac-lowland-fort', name: 'Lowland Fort Banner', types: ['artifact'], subtypes: [], colors: ['W'],
    cost: cost(2, 'W'), rarity: 'c',
    activated: { cost: { tap: true, mana: cost(2) }, targets: [{ what: 'opponentCreature' }], ops: [{ op: 'tap', to: 'target' }] },
  },
  {
    id: 'ac-red-tournament-ground', name: 'Tournament Pennant', types: ['artifact'], subtypes: [], colors: ['R'],
    cost: cost(0, 'R'), rarity: 'c',
    activated: { cost: { tap: true }, ops: [{ op: 'foresee', n: 1 }] },
  },
  {
    id: 'ac-court-of-whispers', name: "Listeners' Curtain", types: ['artifact'], subtypes: [], colors: ['B'],
    cost: cost(0, 'B'), rarity: 'c',
    activated: { cost: { tap: true }, ops: [{ op: 'grind', n: 1, who: 'self' }] },
  },
  {
    id: 'ac-mirror-lake', name: 'Mirror-Lake Glass', types: ['artifact'], subtypes: [], colors: ['U'],
    cost: cost(0, 'U'), rarity: 'c',
    activated: { cost: { tap: true, mana: cost(2) }, ops: [{ op: 'foresee', n: 3 }] },
  },
  {
    id: 'ac-shieldwall-call', name: 'Shieldwall Call', types: ['charm'], subtypes: [],
    cost: cost(1, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'boost', p: 0, t: 2, scope: 'allYours' }] }],
    rarity: 'c',
  },
  {
    id: 'ac-woodland-errand', name: 'Woodland Errand', types: ['ritual'], subtypes: [],
    cost: cost(1, 'G'), colors: ['G'], abilities: [{ when: 'spell', ops: [{ op: 'extraLandDrop' }] }],
    rarity: 'c',
  },
  {
    id: 'ac-treasonous-glance', name: 'Treasonous Glance', types: ['charm'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'ac-campfire-tale', name: 'Campfire Tale', types: ['ritual'], subtypes: [],
    cost: cost(2, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', ops: [{ op: 'grind', n: 2, who: 'self' }, { op: 'draw', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'ac-questing-map', name: 'Questing Map', types: ['ritual'], subtypes: [],
    cost: cost(3), colors: [], abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 3 }, { op: 'draw', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'ac-recant-the-vow', name: 'Recant the Vow', types: ['charm'], subtypes: [],
    cost: cost(4, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'enchantment' }], ops: [{ op: 'sever', to: 'target' }, { op: 'draw', n: 1 }] }],
    rarity: 'c',
  },
  // Returning-mechanics sprinkle (1.6): Empower visits the court. The base
  // sits one mana above Muster the Militia so the shipped common stays the
  // efficient pick; Empower is the late-game option.
  {
    id: 'ac-second-muster', name: 'Second Muster', types: ['ritual'], subtypes: [],
    cost: cost(2, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: 'tok-squire', count: 2 }] }],
    empower: { cost: cost(2, 'W'), ops: [{ op: 'boost', p: 1, t: 1, scope: 'allYours' }] },
    rarity: 'c',
  },
] satisfies readonly CardDef[];
