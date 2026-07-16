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
    supertypes: ['legendary'], cost: cost(4, 'WU'), colors: ['W', 'U'], attack: 4, defense: 5,
    keywords: ['sentinel'], awakening: { p: 2, t: 2, keywords: ['firstBlade'] },
    rarity: 'ur', flavor: 'The crown remembers every oath, even the one that breaks it.',
  }),
  creature('ac-morgan-thorn-crown', 'Morgan of the Thorn Crown', ['Witch', 'Queen'], {
    supertypes: ['legendary'], cost: cost(4, 'UB'), colors: ['U', 'B'], attack: 4, defense: 5,
    abilities: [
      { when: 'arrives', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] },
      { when: 'dawn', ops: [{ op: 'foresee', n: 1 }] },
      { when: 'dawn', condition: 'questActive', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] },
    ],
    rarity: 'ur', flavor: 'She crowns the wound and calls the bleeding a treaty.',
  }),
  creature('ac-nimue-lake-sovereign', 'Nimue, Lake Sovereign', ['Mage', 'Sovereign'], {
    supertypes: ['legendary'], cost: cost(4, 'UW'), colors: ['U', 'W'], attack: 3, defense: 5,
    abilities: [
      { when: 'dawn', ops: [{ op: 'foresee', n: 2 }] },
      { when: 'dawn', condition: 'questActive', ops: [{ op: 'draw', n: 1 }] },
    ],
    rarity: 'ur', flavor: 'The lake keeps her secrets until the kingdom is ready to drown in them.',
  }),
  {
    id: 'ac-grail-radiant-secret', name: 'The Grail, Radiant Secret', types: ['artifact'], subtypes: [],
    supertypes: ['legendary'], cost: cost(4, 'WG'), colors: ['W', 'G'],
    abilities: [
      { when: 'dawn', ops: [{ op: 'gainLife', n: 2 }] },
      { when: 'dawn', condition: 'questActive', ops: [{ op: 'awaken', scope: 'allYours' }] },
    ],
    rarity: 'ur', flavor: 'It offers no answer, only the strength to ask again.',
  },

  // =========================================================================
  // SUPER-SUPER RARE (5)
  // =========================================================================
  creature('ac-lancelot-moonlit-shame', 'Lancelot, Moonlit Shame', ['Knight', 'Champion'], {
    supertypes: ['legendary'], cost: cost(4, 'WR'), colors: ['W', 'R'], attack: 5, defense: 4,
    keywords: ['twinBlades'], awakening: { p: 2, t: 1, keywords: ['firstBlade'] },
    rarity: 'ssr', flavor: 'She rides beneath the moon, carrying a shame no banner can hide.',
  }),
  creature('ac-guinevere-court-sun', 'Guinevere, Court Sun', ['Noble', 'Queen'], {
    supertypes: ['legendary'], cost: cost(4, 'WU'), colors: ['W', 'U'], attack: 3, defense: 4,
    abilities: [
      { when: 'arrives', ops: [{ op: 'foresee', n: 2 }] },
      { when: 'dawn', condition: 'questActive', ops: [{ op: 'createToken', token: 'tok-squire', count: 1 }] },
    ],
    rarity: 'ssr', flavor: 'Her smile makes the hall shine; her silence names the price.',
  }),
  creature('ac-gawain-noonblade', 'Gawain of the Noonblade', ['Knight', 'Champion'], {
    supertypes: ['legendary'], cost: cost(4, 'RW'), colors: ['R', 'W'], attack: 4, defense: 4,
    keywords: ['firstBlade'],
    abilities: [{ when: 'attacks', condition: 'questActive', ops: [{ op: 'damage', n: 2, to: 'opponent' }] }],
    rarity: 'ssr', flavor: 'At noon she is invincible; by dusk, the legend has started to cool.',
  }),
  {
    id: 'ac-quest-for-the-grail', name: 'Quest for the Grail', types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(3, 'W'), colors: ['W'],
    chapters: [
      [{ op: 'foresee', n: 2 }],
      [{ op: 'gainLife', n: 4 }],
      [{ op: 'awaken', scope: 'allYours' }],
    ],
    rarity: 'ssr', flavor: 'Every road is a vow when the radiance waits at its end.',
  },
  {
    id: 'ac-fall-of-camelot', name: 'The Fall of Camelot', types: ['enchantment'], subtypes: ['Quest'],
    supertypes: ['legendary'], cost: cost(5, 'BR'), colors: ['B', 'R'],
    chapters: [
      [{ op: 'damage', n: 3, to: 'opponent' }],
      [{ op: 'discardRandom', n: 2, who: 'opponent' }],
      [{ op: 'massDestroy', filter: 'allCreatures' }],
    ],
    rarity: 'ssr', flavor: 'The stones fall last; the promises fall first.',
  },

  // =========================================================================
  // SUPER RARE (7)
  // =========================================================================
  creature('ac-percival-clear-heart', 'Percival, Clear-Heart Knight', ['Knight', 'Grail-Seeker'], {
    supertypes: ['legendary'], cost: cost(3, 'WG'), colors: ['W', 'G'], attack: 4, defense: 4,
    keywords: ['sentinel', 'bloodoath'],
    rarity: 'sr', flavor: 'She enters the chapel with an empty hand and leaves with a heavier heart.',
  }),
  creature('ac-galahad-silver-oath', 'Galahad, Silver Oath', ['Knight', 'Champion'], {
    supertypes: ['legendary'], cost: cost(3, 'W'), colors: ['W'], attack: 3, defense: 4,
    abilities: [{
      when: 'static', condition: 'questActive',
      static: { scope: 'self', condition: 'questActive', grantKeywords: ['untouchable'] },
    }],
    rarity: 'sr', flavor: 'Her purity is not gentleness; it is a blade that refuses to bend.',
  }),
  creature('ac-merlin-crow-clock', 'Merlin, Crow-Clock Sage', ['Wizard', 'Sage'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 4,
    abilities: [
      { when: 'arrives', ops: [{ op: 'foresee', n: 2 }] },
      { when: 'dawn', condition: 'questActive', ops: [{ op: 'foresee', n: 1 }] },
    ],
    rarity: 'sr', flavor: 'The clock counts down softly; the crows refuse to say to what.',
  }),
  {
    id: 'ac-excalibur-from-lake', name: 'Excalibur From the Lake', types: ['artifact'], subtypes: [],
    supertypes: ['legendary'], cost: cost(3), colors: [],
    abilities: [{
      when: 'static',
      static: { scope: 'filter', filter: { subtype: 'Knight' }, p: 1, t: 1, grantKeywords: ['firstBlade'] },
    }],
    rarity: 'sr', flavor: 'The hand that draws it inherits the lake, the oath, and the ending.',
  },
  {
    id: 'ac-round-table-vow', name: 'Vow of the Round Table', types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(2, 'W'), colors: ['W'],
    chapters: [
      [{ op: 'createToken', token: 'tok-squire', count: 1 }],
      [{ op: 'boost', p: 1, t: 1, scope: 'allYours' }],
      [{ op: 'awaken', scope: 'allYours' }],
    ],
    rarity: 'sr', flavor: 'A round table leaves no one outside the oath, or the blame.',
  },
  {
    id: 'ac-green-knight-challenge', name: "The Green Knight's Challenge", types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(3, 'G'), colors: ['G'],
    chapters: [
      [{ op: 'damage', n: 2, to: 'controller' }],
      [{ op: 'boost', p: 2, t: 2, scope: 'allYours' }],
      [{ op: 'awaken', scope: 'allYours' }],
    ],
    rarity: 'sr', flavor: 'She offers the axe and waits beneath the greenest branch.',
  },
  creature('ac-mordred-bastard-star', 'Mordred, Bastard Star', ['Knight', 'Rebel'], {
    supertypes: ['legendary'], cost: cost(3, 'BR'), colors: ['B', 'R'], attack: 4, defense: 4,
    keywords: ['overrun', 'warcry'],
    abilities: [{ when: 'attacks', ops: [{ op: 'damage', n: 2, to: 'opponent' }] }],
    rarity: 'sr', flavor: 'She was born beneath the crown and learned to sharpen the shadow.',
  }),

  // =========================================================================
  // RARE (24)
  // =========================================================================
  creature('ac-camelot-banneret', 'Camelot Banneret', ['Knight', 'Soldier'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['sentinel'],
    awakening: { p: 1, t: 1, keywords: ['firstBlade'] },
    abilities: [{ when: 'arrives', condition: 'questActive', ops: [{ op: 'createToken', token: 'tok-squire', count: 1 }] }],
    rarity: 'r', flavor: 'She carries the banner because someone must carry the memory.',
  }),
  creature('ac-lakeblade-initiate', 'Lakeblade Initiate', ['Knight', 'Initiate'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 3, defense: 2, keywords: ['firstBlade'],
    awakening: { p: 1, t: 1, keywords: ['untouchable'] },
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'The lake gives her a blade before it gives her permission.',
  }),
  creature('ac-chapel-questant', 'Chapel Questant', ['Cleric', 'Quest-Seeker'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['bloodoath'],
    abilities: [{ when: 'dawn', condition: 'questActive', ops: [{ op: 'gainLife', n: 1 }] }],
    rarity: 'r', flavor: 'She prays for a sign and keeps walking when the sign is silence.',
  }),
  creature('ac-ashwood-ranger', 'Ashwood Ranger', ['Knight', 'Ranger'], {
    cost: cost(2, 'G'), colors: ['G'], attack: 3, defense: 3, keywords: ['wardingGaze'],
    abilities: [{ when: 'arrives', ops: [{ op: 'addCounters', n: 1, to: 'self' }] }],
    rarity: 'r', flavor: 'The ashwood marks her armor; the forest marks her debts.',
  }),
  creature('ac-velvet-court-spy', 'Velvet Court Spy', ['Spy', 'Courtier'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2,
    abilities: [
      { when: 'arrives', ops: [{ op: 'foresee', n: 1 }] },
      { when: 'combatDamageToPlayer', ops: [{ op: 'discardRandom', n: 1, who: 'opponent' }] },
    ],
    rarity: 'r', flavor: 'She smiles at every table and remembers which cups were poisoned.',
  }),
  creature('ac-tournament-favorite', 'Tournament Favorite', ['Knight', 'Champion'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 3, defense: 2, keywords: ['firstBlade', 'warcry'],
    rarity: 'r', flavor: 'The crowd knows her name; the lance knows her reach.',
  }),
  creature('ac-questing-beast-maiden', 'Questing Beast-Maiden', ['Hunter', 'Beast'], {
    cost: cost(3, 'G'), colors: ['G'], attack: 4, defense: 4, keywords: ['overrun', 'sentinel'],
    rarity: 'r', flavor: 'She hunts the impossible beast because ordinary prey has stopped running.',
  }),
  {
    id: 'ac-mirror-of-avalon', name: 'Mirror of Avalon', types: ['artifact'], subtypes: [],
    cost: cost(3, 'U'), colors: ['U'], abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'The mirror shows the shore you left and the shore you deserve.',
  },
  {
    id: 'ac-black-chapel-curse', name: 'Black Chapel Curse', types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(3, 'B'), colors: ['B'],
    chapters: [
      [{ op: 'loseLife', n: 2, who: 'opponent' }],
      [{ op: 'discardRandom', n: 1, who: 'opponent' }],
      [{ op: 'severGrave', n: 2, who: 'opponent' }],
    ],
    rarity: 'r', flavor: 'The chapel bell rings for the living, who know better than to answer.',
  },
  {
    id: 'ac-sword-test-stone', name: 'The Sword in the Stone', types: ['artifact'], subtypes: [],
    cost: cost(3), colors: [],
    abilities: [{ when: 'dawn', condition: 'questActive', ops: [{ op: 'awaken', scope: 'allYours' }] }],
    rarity: 'r', flavor: 'Stone asks no question twice; the sword gives no second chance.',
  },
  {
    id: 'ac-grail-procession', name: 'Grail Procession', types: ['ritual'], subtypes: [],
    cost: cost(3, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: 'tok-squire', count: 2 }, { op: 'gainLife', n: 3 }] }],
    rarity: 'r', flavor: 'The procession moves slowly; hope has learned to keep formation.',
  },
  {
    id: 'ac-lion-standard', name: 'Lion Standard', types: ['enchantment'], subtypes: [],
    cost: cost(2, 'W'), colors: ['W'],
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Knight' }, p: 1, t: 1 } }],
    rarity: 'r', flavor: 'The lion is stitched in gold, but the wind reads the warning in red.',
  },
  {
    id: 'ac-courtly-betrayal', name: 'Courtly Betrayal', types: ['ritual'], subtypes: [],
    cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'discardRandom', n: 1, who: 'opponent' }, { op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'A bow, a whisper, a door closed before the blade is drawn.',
  },
  creature('ac-lady-of-lilies', 'Lady of Lilies', ['Mage', 'Attendant'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 3,
    abilities: [{ when: 'dawn', condition: 'questActive', ops: [{ op: 'draw', n: 1 }] }],
    rarity: 'r', flavor: 'She gathers lilies from the lake and omens from the court.',
  }),
  {
    id: 'ac-red-dragon-banner', name: 'Red Dragon Banner', types: ['enchantment'], subtypes: [],
    cost: cost(3, 'R'), colors: ['R'],
    abilities: [{ when: 'dawn', ops: [{ op: 'boost', p: 2, t: 0, scope: 'allYours' }] }],
    rarity: 'r', flavor: 'The dragon never lands; its shadow is enough to start the charge.',
  },
  creature('ac-grail-hermit', 'Grail Hermit', ['Mystic', 'Guide'], {
    cost: cost(3, 'G'), colors: ['G'], attack: 3, defense: 4,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }, { op: 'gainLife', n: 2 }] }],
    rarity: 'r', flavor: 'She keeps the grail beneath a rough cloak and the answer beneath a smile.',
  }),
  {
    id: 'ac-moonlit-joust', name: 'Moonlit Joust', types: ['charm'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{
      when: 'spell', targets: [{ what: 'creature' }],
      ops: [{ op: 'boost', p: 2, t: 0, keywords: ['firstBlade'], scope: 'target' }, { op: 'damage', n: 1, to: 'target' }],
    }],
    rarity: 'r', flavor: 'The moon makes every duel look noble from a safe distance.',
  },
  {
    id: 'ac-secret-of-avalon', name: 'Secret of Avalon', types: ['ritual'], subtypes: [],
    cost: cost(2, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 1 }, { op: 'foresee', n: 2 }] }],
    rarity: 'r', flavor: 'Avalon reveals itself one reflection at a time.',
  },
  {
    id: 'ac-castle-under-siege', name: 'Castle Under Siege', types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(3, 'R'), colors: ['R'],
    chapters: [
      [{ op: 'createToken', token: 'tok-squire', count: 1 }],
      [{ op: 'damage', n: 2, to: 'opponent' }],
      [{ op: 'boost', p: 2, t: 0, scope: 'allYours' }],
    ],
    rarity: 'r', flavor: 'The walls hold for one more dawn; the banners pretend it is enough.',
  },
  creature('ac-raven-of-camlann', 'Raven of Camlann', ['Bird', 'Omen'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2, keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }],
    rarity: 'r', flavor: 'She circles the battlefield and finds the hour where every oath expires.',
  }),
  creature('ac-oathbroken-knight', 'Oathbroken Knight', ['Knight', 'Fallen'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 3, defense: 2, keywords: ['deathblade', 'warcry'],
    rarity: 'r', flavor: 'The oath broke cleanly; the pieces still cut everyone nearby.',
  }),
  {
    id: 'ac-lance-of-dawn', name: 'Lance of Dawn', types: ['enchantment'], subtypes: ['Aura'],
    cost: cost(2, 'W'), colors: ['W'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: 2, t: 0, grantKeywords: ['firstBlade'] } }],
    rarity: 'r', flavor: 'At first light, even a borrowed weapon can look like destiny.',
  },
  {
    id: 'ac-queen-regents-command', name: "Queen-Regent's Command", types: ['charm'], subtypes: [],
    cost: cost(2, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }, { op: 'draw', n: 1 }] }],
    rarity: 'r', flavor: 'The command is courteous; the consequence is not.',
  },
  {
    id: 'ac-holy-well', name: 'Holy Well', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['W', 'G'], entersTapped: true, rarity: 'c',
    flavor: 'The spring heals the faithful and remembers the faithless.',
  },
  {
    id: 'ac-avalon-shore', name: 'Avalon Shore', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['U', 'W'], entersTapped: true, rarity: 'r',
    flavor: 'The shore appears only for those willing to leave it.',
  },

  // =========================================================================
  // COMMON (40)
  // =========================================================================
  creature('ac-novice-squire', 'Novice Squire', ['Squire'], {
    cost: cost(1, 'W'), colors: ['W'], attack: 2, defense: 2, keywords: ['sentinel'],
    rarity: 'c', flavor: 'She polishes the armor before anyone asks her to wear it.',
  }),
  creature('ac-keep-watchwoman', 'Keep Watchwoman', ['Guard'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 1, defense: 4, keywords: ['bulwark'],
    rarity: 'c', flavor: 'She watches the gate until the gate becomes part of her.',
  }),
  creature('ac-lake-attendant', 'Lake Attendant', ['Attendant'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 1, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'She knows which ripples mean welcome and which mean warning.',
  }),
  creature('ac-court-minstrel', 'Court Minstrel', ['Bard'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2,
    abilities: [{ when: 'dawn', condition: 'questActive', ops: [{ op: 'draw', n: 1 }] }],
    rarity: 'c', flavor: 'She sings the table into courage, one verse at a time.',
  }),
  creature('ac-torchbearer-knight', 'Torchbearer Knight', ['Knight', 'Soldier'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 3, defense: 2, keywords: ['warcry'],
    rarity: 'c', flavor: 'She carries the flame ahead of the army and never looks back.',
  }),
  creature('ac-borderland-huntress', 'Borderland Huntress', ['Huntress'], {
    cost: cost(2, 'G'), colors: ['G'], attack: 3, defense: 3, keywords: ['wardingGaze'],
    rarity: 'c', flavor: 'She hunts beyond the border because the border is where fear gathers.',
  }),
  creature('ac-chapel-mender', 'Chapel Mender', ['Cleric'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 2 }] }],
    rarity: 'c', flavor: 'She repairs the stained glass and the people beneath it.',
  }),
  creature('ac-castle-blackguard', 'Castle Blackguard', ['Guard'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 3, defense: 2, keywords: ['deathblade'],
    rarity: 'c', flavor: 'She guards the dark stair because the dark stair guards her secrets.',
  }),
  {
    id: 'ac-quest-marker', name: 'Quest Marker', types: ['artifact'], subtypes: [],
    cost: cost(1), colors: [], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'A small mark on a long road; enough to keep walking.',
  },
  {
    id: "ac-knights-breakfast", name: "Knight's Breakfast", types: ['ritual'], subtypes: [],
    cost: cost(2, 'G'), colors: ['G'],
    abilities: [
      { when: 'spell', ops: [{ op: 'gainLife', n: 3 }] },
      { when: 'spell', condition: 'questActive', ops: [{ op: 'draw', n: 1 }] },
    ],
    rarity: 'c', flavor: 'Bread, fruit, and the courage to call tomorrow a meal.',
  },
  {
    id: 'ac-steel-prayer', name: 'Steel Prayer', types: ['charm'], subtypes: [],
    cost: cost(1, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 0, t: 3, scope: 'target' }] }],
    rarity: 'c', flavor: 'She raises the shield and lets the prayer take the blow.',
  },
  {
    id: 'ac-training-yard', name: 'Training Yard', types: ['enchantment'], subtypes: [],
    cost: cost(3, 'R'), colors: ['R'],
    abilities: [{ when: 'dawn', ops: [{ op: 'boost', p: 1, t: 0, scope: 'allYours' }] }],
    rarity: 'c', flavor: 'Every morning begins with bruises and ends with a better stance.',
  },
  {
    id: 'ac-squire-to-champion', name: 'Squire to Champion', types: ['enchantment'], subtypes: ['Quest'],
    cost: cost(2, 'W'), colors: ['W'],
    chapters: [
      [{ op: 'boost', p: 1, t: 1, scope: 'allYours' }],
      [{ op: 'awaken', scope: 'allYours' }],
    ],
    rarity: 'c', flavor: 'The first lesson is service; the second is surviving what service costs.',
  },
  {
    id: 'ac-lantern-in-fog', name: 'Lantern in Fog', types: ['charm'], subtypes: [],
    cost: cost(1, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'The lantern finds a path; the fog decides who may follow it.',
  },
  {
    id: 'ac-bitter-court-rumor', name: 'Bitter Court Rumor', types: ['ritual'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'discardRandom', n: 1, who: 'opponent' }] }],
    rarity: 'c', flavor: 'A whisper crosses the hall and leaves every candle colder.',
  },
  {
    id: 'ac-hunt-the-boar', name: 'Hunt the Boar', types: ['ritual'], subtypes: [],
    cost: cost(2, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 3, to: 'target' }] }],
    rarity: 'c', flavor: 'The forest offers a trail; the spear supplies the answer.',
  },
  {
    id: 'ac-tilting-lance', name: 'Tilting Lance', types: ['charm'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 2, t: 0, keywords: ['firstBlade'], scope: 'target' }] }],
    rarity: 'c', flavor: 'A straight charge, a bright lance, and no room for regret.',
  },
  creature('ac-white-horse', 'White Horse', ['Horse'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['sentinel'],
    rarity: 'c', flavor: 'She bears the banner through mud, smoke, and the last clean light.',
  }),
  creature('ac-riverford-guard', 'Riverford Guard', ['Guard', 'Soldier'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 4, keywords: ['bulwark'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'She holds the ford because the river remembers every retreat.',
  }),
  {
    id: 'ac-wounded-oath', name: 'Wounded Oath', types: ['enchantment'], subtypes: ['Aura'],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: -1, t: -1 } }],
    rarity: 'c', flavor: 'The promise weakens the arm that made it and the heart that keeps it.',
  },
  {
    id: 'ac-candlelit-vigil', name: 'Candlelit Vigil', types: ['enchantment'], subtypes: [],
    cost: cost(2, 'W'), colors: ['W'],
    abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 1 }] }],
    rarity: 'c', flavor: 'One candle burns for each name the chapel cannot forget.',
  },
  creature('ac-errant-duelist', 'Errant Duelist', ['Knight', 'Duelist'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 2, defense: 2, keywords: ['firstBlade'],
    awakening: { p: 1, t: 1, keywords: ['untouchable'] },
    rarity: 'c', flavor: 'She wanders from joust to joust, looking for a worthy ending.',
  }),
  {
    id: 'ac-grail-glimpse', name: 'Grail Glimpse', types: ['ritual'], subtypes: [],
    cost: cost(1, 'U'), colors: ['U'], abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 3 }] }],
    rarity: 'c', flavor: 'For one breath, the whole road shines through the mist.',
  },
  creature('ac-root-chapel-warden', 'Root-Chapel Warden', ['Knight', 'Druid'], {
    cost: cost(3, 'G'), colors: ['G'], attack: 2, defense: 5, keywords: ['wardingGaze', 'bloodoath'],
    rarity: 'c', flavor: 'Her chapel has roots instead of walls and a watch that never sleeps.',
  }),
  {
    id: 'ac-fallen-banner', name: 'Fallen Banner', types: ['ritual'], subtypes: [],
    cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 2, to: 'target' }, { op: 'grind', n: 1, who: 'self' }] }],
    rarity: 'c', flavor: 'The banner falls; the names beneath it sink into the earth.',
  },
  creature('ac-pennant-carrier', 'Pennant Carrier', ['Knight', 'Banneret'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3,
    abilities: [{
      when: 'static', condition: 'questActive',
      static: { scope: 'filter', condition: 'questActive', filter: { subtype: 'Knight', other: true }, p: 1, t: 0 },
    }],
    rarity: 'c', flavor: 'She lifts the pennant high enough for every oath to see it.',
  }),
  creature('ac-court-archer', 'Court Archer', ['Archer'], {
    cost: cost(2, 'G'), colors: ['G'], attack: 2, defense: 2, keywords: ['wardingGaze'],
    rarity: 'c', flavor: 'She looses arrows from the gallery and never disturbs the music.',
  }),
  {
    id: 'ac-silver-spur', name: 'Silver Spur', types: ['artifact'], subtypes: [],
    cost: cost(2), colors: [],
    abilities: [{ when: 'arrives', ops: [{ op: 'boost', p: 1, t: 0, scope: 'allYours' }] }],
    rarity: 'c', flavor: 'The spur flashes once; every horse remembers the road home.',
  },
  creature('ac-prophecy-attendant', "Prophecy Attendant", ['Attendant', 'Seer'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 1, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'She carries tomorrow in a silver bowl and never spills a drop.',
  }),
  {
    id: 'ac-bramble-chapel', name: 'Bramble Chapel', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['G'], entersTapped: true, rarity: 'c',
    flavor: 'Thorns frame the altar; the roots keep the old vows.',
  },
  {
    id: 'ac-lowland-fort', name: 'Lowland Fort', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['W'], entersTapped: true, rarity: 'c',
    flavor: 'The fort is low, the walls are tired, and the watch still stands.',
  },
  {
    id: 'ac-red-tournament-ground', name: 'Red Tournament Ground', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['R'], entersTapped: true, rarity: 'c',
    flavor: 'Dust rises where champions promise they are not afraid.',
  },
  {
    id: 'ac-court-of-whispers', name: 'Court of Whispers', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['B'], entersTapped: true, rarity: 'c',
    flavor: 'The court has no throne, only a hundred listeners behind the curtains.',
  },
  {
    id: 'ac-mirror-lake', name: 'Mirror Lake', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['U'], entersTapped: true, rarity: 'c',
    flavor: 'The water reflects the face you bring and the one you leave behind.',
  },
  {
    id: 'ac-shieldwall-call', name: 'Shieldwall Call', types: ['charm'], subtypes: [],
    cost: cost(2, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'boost', p: 0, t: 2, scope: 'allYours' }] }],
    rarity: 'c', flavor: 'One shield is a promise; a wall of shields is an answer.',
  },
  {
    id: 'ac-woodland-errand', name: 'Woodland Errand', types: ['ritual'], subtypes: [],
    cost: cost(2, 'G'), colors: ['G'], abilities: [{ when: 'spell', ops: [{ op: 'fetchLand' }] }],
    rarity: 'c', flavor: 'The forest sends a messenger and asks for no explanation.',
  },
  {
    id: 'ac-treasonous-glance', name: 'Treasonous Glance', types: ['charm'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'The glance lasts a heartbeat; the accusation lasts forever.',
  },
  {
    id: 'ac-campfire-tale', name: 'Campfire Tale', types: ['ritual'], subtypes: [],
    cost: cost(2, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', ops: [{ op: 'grind', n: 2, who: 'self' }, { op: 'draw', n: 1 }] }],
    rarity: 'c', flavor: 'The best stories leave out the part where the heroes lose.',
  },
  {
    id: 'ac-questing-map', name: 'Questing Map', types: ['artifact'], subtypes: [],
    cost: cost(2), colors: [], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }],
    rarity: 'c', flavor: 'The map marks the road in ink that fades after the journey.',
  },
] satisfies readonly CardDef[];
