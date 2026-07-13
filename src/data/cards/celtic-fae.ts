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
    rarity: 'ur', flavor: 'A raven lands on the treaty. The treaty loses its nerve.',
  }),
  fae('cf-titania-silver-court', 'Titania of the Silver Court', 'Queen', {
    supertypes: ['legendary'], cost: cost(3, 'UG'), colors: ['U', 'G'], attack: 4, defense: 5,
    keywords: ['untouchable'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }, { when: 'dawn', ops: [{ op: 'createToken', token: 'tok-bloom', count: 1 }] }],
    rarity: 'ur', flavor: 'Her court applauds softly. The forest grows a new witness.',
  }),
  fae('cf-aine-sunlit-bargain', 'Aine, Sunlit Bargain', 'Sovereign', {
    supertypes: ['legendary'], cost: cost(3, 'WG'), colors: ['W', 'G'], attack: 4, defense: 5,
    keywords: ['bloodoath'],
    abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 3 }] }, { when: 'attacks', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'ur', flavor: 'She gives freely. The bill arrives when you are happy.',
  }),
  fae('cf-nimue-before-the-lake', 'Nimue Before the Lake', 'Mage', {
    supertypes: ['legendary'], cost: cost(3, 'UW'), colors: ['U', 'W'], attack: 4, defense: 5,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }] }, { when: 'dawn', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'ur', flavor: 'The lake keeps every promise, especially the ones you did not mean.',
  }),

  // =========================================================================
  // SUPER-SUPER RARE (5)
  // =========================================================================
  {
    id: 'cf-badb-cathas-warning', name: "Badb Catha's Warning", types: ['ritual'], subtypes: [],
    cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 2 }, { op: 'discardRandom', n: 2, who: 'opponent' }, { op: 'severGrave', n: 2, who: 'opponent' }] }],
    rarity: 'ssr', flavor: 'Three crows circle the field. One of them knows your name.',
  },
  fae('cf-selkie-tide-queen', 'Selkie Tide-Queen', 'Selkie', {
    supertypes: ['legendary'], cost: cost(3, 'UG'), colors: ['U', 'G'], attack: 4, defense: 4,
    keywords: ['untouchable'], abilities: [{ when: 'combatDamageToPlayer', ops: [{ op: 'foresee', n: 2 }] }],
    rarity: 'ssr', flavor: 'The sea returns what it borrows. Her court does not.',
  }),
  {
    id: 'cf-balor-evil-eye', name: "Balor's Evil Eye", types: ['ritual'], subtypes: [],
    supertypes: ['legendary'], cost: cost(2, 'BR'), colors: ['B', 'R'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 5, to: 'target' }, { op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'ssr', flavor: 'Do not meet its gaze. Do not survive its attention.',
  },
  fae('cf-wild-hunt-matriarch', 'Wild Hunt Matriarch', 'Hunter', {
    supertypes: ['legendary'], cost: cost(4, 'RG'), colors: ['R', 'G'], attack: 5, defense: 4,
    keywords: ['warcry', 'overrun'], abilities: [{ when: 'attacks', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'ssr', flavor: 'The horn sounds once. The quarry is already late.',
  }),
  {
    id: 'cf-cauldron-of-dagda', name: 'Cauldron of the Dagda', types: ['artifact'], subtypes: [],
    cost: cost(2, 'G'), colors: ['G'],
    abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 2 }, { op: 'foresee', n: 2 }] }],
    rarity: 'ssr', flavor: 'It never runs empty. Neither does the debt.',
  },

  // =========================================================================
  // SUPER RARE (7)
  // =========================================================================
  fae('cf-bean-sidhe-keening', 'Bean Sidhe Keening', 'Banshee', {
    cost: cost(3, 'B'), colors: ['B'], attack: 3, defense: 3, keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }, { when: 'dawn', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }] }],
    rarity: 'sr', flavor: 'Her song is the sound a family makes before it starts counting chairs.',
  }),
  fae('cf-silver-branch-oracle', 'Silver-Branch Oracle', 'Seer', {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 4,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }] }],
    rarity: 'sr', flavor: 'The branch points to every future. She charges by the direction.',
  }),
  {
    id: 'cf-thorn-crown-geas', name: 'Thorn-Crown Geas', types: ['enchantment'], subtypes: ['Aura'],
    cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: 2, t: 2 } }, { when: 'arrives', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'sr', flavor: 'Wear it proudly. It only tightens when you hesitate.',
  },
  {
    id: 'cf-glamour-of-the-hill', name: 'Glamour of the Hollow Hill', types: ['charm'], subtypes: [],
    cost: cost(2, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'recall', to: 'target' }, { op: 'draw', n: 1 }] }],
    rarity: 'sr', flavor: 'The hill opens. Your champion remembers an urgent appointment elsewhere.',
  },
  fae('cf-redcap-blood-host', 'Redcap Blood-Host', 'Redcap', {
    cost: cost(2, 'RR'), colors: ['R'], attack: 4, defense: 4,
    keywords: ['warcry'], rarity: 'sr', flavor: 'The caps are red because washing them would be an admission.',
  }),
  fae('cf-queen-mab-midnight', 'Mab, Midnight Queen', 'Queen', {
    supertypes: ['legendary'], cost: cost(3, 'UB'), colors: ['U', 'B'], attack: 4, defense: 5,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }, { when: 'attacks', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }],
    rarity: 'sr', flavor: 'She rules the hour when even honest thoughts put on masks.',
  }),
  {
    id: 'cf-ogham-fate-stones', name: 'Ogham Fate-Stones', types: ['artifact'], subtypes: [],
    cost: cost(3), colors: [], abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'sr', flavor: 'The marks are unreadable. The price is not.',
  },

  // =========================================================================
  // RARE (24)
  // =========================================================================
  fae('cf-hollow-hill-gatekeeper', 'Hollow-Hill Gatekeeper', 'Sentinel', {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 5, keywords: ['bulwark'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'She asks where you are going. The wrong answer is any answer.',
  }),
  fae('cf-blackthorn-duelist', 'Blackthorn Duelist', 'Sidhe', {
    cost: cost(1, 'G'), colors: ['G'], attack: 3, defense: 2, keywords: ['firstBlade'],
    abilities: [{ when: 'combatDamageToPlayer', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'She offers first blood. She has already decided whose.',
  }),
  fae('cf-raven-torc-envoy', 'Raven-Torc Envoy', 'Raven', {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 3, keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'r', flavor: 'She brings a silver ring and takes a name from the dead.',
  }),
  fae('cf-moon-pool-selkie', 'Moon-Pool Selkie', 'Selkie', {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 3,
    abilities: [{ when: 'combatDamageToPlayer', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'She slips below the surface whenever the conversation turns honest.',
  }),
  {
    id: 'cf-gold-ring-bargain', name: 'Gold-Ring Bargain', types: ['ritual'], subtypes: [],
    cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 2 }, { op: 'severTop', n: 2, who: 'self' }] }],
    rarity: 'r', flavor: 'Two answers for two memories. A very fair market.',
  },
  fae('cf-hounds-of-annwn', 'Hounds of Annwn', 'Hound', {
    cost: cost(2, 'G'), colors: ['G'], attack: 4, defense: 3, keywords: ['overrun'],
    abilities: [{ when: 'dies', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'r', flavor: 'They do not lose a scent. They merely inherit it.',
  }),
  {
    id: 'cf-brigid-ember-blessing', name: "Brigid's Ember Blessing", types: ['charm'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 1, t: 1, keywords: ['firstBlade'], scope: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'A warm hand on the blade. A warmer debt at dawn.',
  },
  fae('cf-sidhe-silver-lancer', 'Sidhe Silver-Lancer', 'Knight', {
    cost: cost(2, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['sentinel', 'firstBlade'],
    rarity: 'r', flavor: 'Her lance arrives before the invitation does.',
  }),
  {
    id: 'cf-mist-over-tara', name: 'Mist Over Tara', types: ['charm'], subtypes: [],
    cost: cost(1, 'U'), colors: ['U'], abilities: [{ when: 'spell', ops: [{ op: 'preventCombat' }, { op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'The old seat disappears. So does the battle for it.',
  },
  fae('cf-fomorian-raider', 'Fomorian Raider', 'Fomorian', {
    cost: cost(2, 'RR'), colors: ['R'], attack: 5, defense: 3,
    keywords: ['overrun'], abilities: [{ when: 'arrives', ops: [{ op: 'damage', n: 2, to: 'controller' }] }],
    rarity: 'r', flavor: 'It raids because it is hungry. It is hungry because it raids.',
  }),
  {
    id: 'cf-apple-of-emain', name: 'Apple of Emain', types: ['artifact'], subtypes: [],
    cost: cost(0, 'G'), colors: ['G'], abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 3 }, { op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'One bite restores the body. The second restores the obligation.',
  },
  {
    id: 'cf-briar-veil-banishing', name: 'Briar-Veil Banishing', types: ['ritual'], subtypes: [],
    cost: cost(2, 'W'), colors: ['W'], abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'sever', to: 'target' }] }],
    rarity: 'r', flavor: 'The briars do not kill. They merely make leaving impossible.',
  },
  fae('cf-otter-familiar', 'Otter Familiar', 'Otter', {
    cost: cost(1, 'GG'), colors: ['G'], attack: 2, defense: 3,
    manaAbility: ['G'], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'It finds the shallow crossing, then charges a fish for the secret.',
  }),
  fae('cf-crowbone-prophet', 'Crowbone Prophet', 'Oracle', {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'grind', n: 2, who: 'self' }, { op: 'foresee', n: 2 }] }],
    rarity: 'r', flavor: 'She reads the bones. You supply the margin notes.',
  }),
  {
    id: 'cf-dance-under-mound', name: 'Dance Under the Mound', types: ['ritual'], subtypes: [],
    cost: cost(2, 'GG'), colors: ['G'],
    abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: 'tok-bloom', count: 2 }, { op: 'foresee', n: 2 }] }],
    rarity: 'r', flavor: 'The music is free. The years it takes are not.',
  },
  {
    id: 'cf-ash-and-mistletoe', name: 'Ash and Mistletoe', types: ['enchantment'], subtypes: [],
    cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Fae' }, p: 1, t: 1 } }],
    rarity: 'r', flavor: 'The old trees keep the court secrets. The mistletoe keeps receipts.',
  },
  {
    id: 'cf-lake-mirror-vow', name: 'Lake-Mirror Vow', types: ['enchantment'], subtypes: [],
    cost: cost(1, 'U'), colors: ['U'],
    abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 2 }] }],
    rarity: 'r', flavor: 'Swear to your reflection. It has a better memory than you do.',
  },
  {
    id: 'cf-cold-iron-taboo', name: 'Cold-Iron Taboo', types: ['artifact'], subtypes: [],
    cost: cost(2), colors: [], abilities: [{ when: 'dawn', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'r', flavor: 'It cannot name the court. That is why the court fears it.',
  },
  fae('cf-thornmaze-patrol', 'Thornmaze Patrol', 'Ranger', {
    cost: cost(2, 'G'), colors: ['G'], attack: 3, defense: 4, keywords: ['wardingGaze'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'Every hedge is a corridor if she knows your name.',
  }),
  fae('cf-bog-lantern-witch', 'Bog-Lantern Witch', 'Witch', {
    cost: cost(2, 'BB'), colors: ['B'], attack: 2, defense: 3,
    keywords: ['deathblade'], abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'r', flavor: 'Follow her lantern. It always leads somewhere, just never home.',
  }),
  fae('cf-green-knoll-champion', 'Green Knoll Champion', 'Knight', {
    cost: cost(2, 'GG'), colors: ['G'], attack: 4, defense: 4,
    keywords: ['sentinel', 'overrun'], rarity: 'r', flavor: 'She guards the hill because the hill once chose her.',
  }),
  {
    id: 'cf-moonlit-barrow', name: 'Moonlit Barrow', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['U', 'B'], entersTapped: true, rarity: 'r', flavor: 'The dead keep moonlight under the door for callers.',
  },
  {
    id: 'cf-sunwell-grove', name: 'Sunwell Grove', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['G', 'W'], entersTapped: true, rarity: 'r', flavor: 'The water heals what it can. The grove invoices the rest.',
  },
  {
    id: 'cf-blackthorn-crossing', name: 'Blackthorn Crossing', types: ['land'], subtypes: [], colors: [],
    manaAbility: ['B', 'G'], entersTapped: true, rarity: 'r', flavor: 'The road takes a toll in blood or manners.',
  },

  // =========================================================================
  // COMMON (40)
  // =========================================================================
  fae('cf-fae-ring-initiate', 'Fae-Ring Initiate', 'Adept', {
    cost: cost(0, 'U'), colors: ['U'], attack: 1, defense: 2, abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'The first lesson is never take the offered seat.',
  }),
  fae('cf-mistwing-pixie', 'Mistwing Pixie', 'Pixie', {
    cost: cost(1, 'U'), colors: ['U'], attack: 2, defense: 1, keywords: ['skyborne'],
    rarity: 'c', flavor: 'She leaves fingerprints on the fog just to prove she was there.',
  }),
  fae('cf-thorn-sprite', 'Thorn Sprite', 'Sprite', {
    cost: cost(0, 'G'), colors: ['G'], attack: 1, defense: 2, keywords: ['wardingGaze'],
    rarity: 'c', flavor: 'Small enough to miss. Sharp enough to regret.',
  }),
  fae('cf-redcap-skirmisher', 'Redcap Skirmisher', 'Redcap', {
    cost: cost(1, 'R'), colors: ['R'], attack: 3, defense: 1, keywords: ['warcry'],
    rarity: 'c', flavor: 'She starts the fight early so the rules cannot catch up.',
  }),
  fae('cf-bog-banshee', 'Bog Banshee', 'Banshee', {
    cost: cost(1, 'B'), colors: ['B'], attack: 3, defense: 1, keywords: ['deathblade'],
    rarity: 'c', flavor: 'Her wail is a warning. Her silence is worse.',
  }),
  fae('cf-sidhe-page', 'Sidhe Page', 'Sidhe', {
    cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 3, keywords: ['sentinel'],
    rarity: 'c', flavor: 'A page learns every courtly bow before learning where the exits are.',
  }),
  fae('cf-omen-raven', 'Omen Raven', 'Raven', {
    cost: cost(0, 'B'), colors: ['B'], attack: 1, defense: 1, keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'It steals shiny things, then puts them back in the wrong future.',
  }),
  fae('cf-selkie-runner', 'Selkie Runner', 'Selkie', {
    cost: cost(1, 'U'), colors: ['U'], attack: 2, defense: 1, abilities: [{ when: 'combatDamageToPlayer', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'She brings messages across the tide, usually to the wrong shore.',
  }),
  fae('cf-mushroom-ring-guard', 'Mushroom-Ring Guard', 'Guard', {
    cost: cost(1, 'G'), colors: ['G'], attack: 1, defense: 4, keywords: ['bulwark'],
    rarity: 'c', flavor: 'Step inside the ring. Please. We insist.',
  }),
  fae('cf-willow-wisp-guide', 'Willow-Wisp Guide', 'Wisp', {
    cost: cost(2, 'G'), colors: ['G'], attack: 1, defense: 3, manaAbility: ['G'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }], rarity: 'c', flavor: 'It knows the safe road. It prefers the interesting one.',
  }),
  fae('cf-fae-court-tokenmaker', 'Fae Court Reveler', 'Reveler', {
    cost: cost(2, 'G'), colors: ['G'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'createToken', token: 'tok-bloom', count: 1 }] }],
    rarity: 'c', flavor: 'One dance summons a guest. Two dances summon a season.',
  }),
  fae('cf-cold-moon-archer', 'Cold-Moon Archer', 'Archer', {
    cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 3, keywords: ['wardingGaze'],
    rarity: 'c', flavor: 'Her arrows return at moonrise. Their targets do not.',
  }),
  fae('cf-black-dog-of-lane', 'Black Dog of the Lane', 'Hound', {
    cost: cost(1, 'B'), colors: ['B'], attack: 2, defense: 2, keywords: ['deathblade'],
    rarity: 'c', flavor: 'It walks one street ahead of every bad decision.',
  }),
  fae('cf-heatherblade-scout', 'Heatherblade Scout', 'Scout', {
    cost: cost(1, 'G'), colors: ['G'], attack: 3, defense: 2, keywords: ['overrun'],
    rarity: 'c', flavor: 'The heather bends for her. It does not for you.',
  }),
  fae('cf-torclight-envoy', 'Torclight Envoy', 'Diplomat', {
    cost: cost(1, 'W'), colors: ['W'], attack: 2, defense: 2, abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 2 }] }],
    rarity: 'c', flavor: 'Her torch lights the path and counts everyone who takes it.',
  }),
  {
    id: 'cf-glimmerdust-trick', name: 'Glimmerdust Trick', types: ['charm'], subtypes: [], cost: cost(0, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'A little dust in the eyes; a little future under the rug.',
  },
  {
    id: 'cf-fade-beyond-veil', name: 'Fade Beyond the Veil', types: ['charm'], subtypes: [], cost: cost(1, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'recall', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'For one breath, the veil opens. Long enough to ruin an entrance.',
  },
  {
    id: 'cf-barrow-whisper', name: 'Barrow Whisper', types: ['ritual'], subtypes: [], cost: cost(0, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 2 }, { op: 'grind', n: 2, who: 'self' }] }],
    rarity: 'c', flavor: 'The ancestors advise patience. They have plenty of it.',
  },
  {
    id: 'cf-thornsnare', name: 'Thornsnare', types: ['charm'], subtypes: [], cost: cost(0, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 1, t: 2, keywords: ['wardingGaze'], scope: 'target' }] }],
    rarity: 'c', flavor: 'The hedge takes sides. It has always had opinions.',
  },
  {
    id: 'cf-ember-of-brigid', name: 'Ember of Brigid', types: ['charm'], subtypes: [], cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 2, to: 'target' }] }],
    rarity: 'c', flavor: 'A coal for your hearth, a blaze for your oathbreaker.',
  },
  {
    id: 'cf-bargain-for-time', name: 'Bargain for Time', types: ['ritual'], subtypes: [], cost: cost(0, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }] }],
    rarity: 'c', flavor: 'She can spare a minute. She will keep the afternoon.',
  },
  {
    id: 'cf-cold-iron-nail', name: 'Cold-Iron Nail', types: ['artifact'], subtypes: [], cost: cost(1), colors: [],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }],
    rarity: 'c', flavor: 'A very small answer to a very old fear.',
  },
  {
    id: 'cf-mist-road', name: 'Mist Road', types: ['land'], subtypes: [], colors: [], manaAbility: ['U'], entersTapped: true,
    rarity: 'c', flavor: 'It appears when you need a shortcut and disappears when you need one home.',
  },
  {
    id: 'cf-mossy-ring', name: 'Mossy Ring', types: ['land'], subtypes: [], colors: [], manaAbility: ['G'], entersTapped: true,
    rarity: 'c', flavor: 'The moss grows in a circle because the circle asked nicely.',
  },
  {
    id: 'cf-raven-stone', name: 'Raven Stone', types: ['land'], subtypes: [], colors: [], manaAbility: ['B'], entersTapped: true,
    rarity: 'c', flavor: 'Leave an offering. The raven will tell you whether it was enough.',
  },
  {
    id: 'cf-dawn-torc', name: 'Dawn Torc', types: ['artifact'], subtypes: [], cost: cost(1), colors: [],
    abilities: [{ when: 'dawn', ops: [{ op: 'gainLife', n: 2 }] }],
    rarity: 'c', flavor: 'Gold catches the sunrise. Silver catches the promise behind it.',
  },
  {
    id: 'cf-silver-thread', name: 'Silver Thread', types: ['enchantment'], subtypes: ['Aura'], cost: cost(2), colors: [],
    abilities: [{ when: 'static', static: { scope: 'attached', p: 0, t: 2 } }, { when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'Follow it gently. Pull it, and fate pulls back.',
  },
  {
    id: 'cf-night-market-bargain', name: 'Night-Market Bargain', types: ['ritual'], subtypes: [], cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 2 }, { op: 'damage', n: 2, to: 'controller' }] }],
    rarity: 'c', flavor: 'The vendor smiles. The coin purse screams.',
  },
  fae('cf-laughing-pooka', 'Laughing Pooka', 'Pooka', {
    cost: cost(1, 'R'), colors: ['R'], attack: 3, defense: 2, keywords: ['warcry'],
    rarity: 'c', flavor: 'It turns into a horse, a goat, and your worst alibi.',
  }),
  fae('cf-hazelwand-mystic', 'Hazelwand Mystic', 'Druid', {
    cost: cost(1, 'G'), colors: ['G'], attack: 1, defense: 2, manaAbility: ['G'],
    rarity: 'c', flavor: 'Her wand finds water, gold, and the person avoiding you.',
  }),
  {
    id: 'cf-clouded-memory', name: 'Clouded Memory', types: ['charm'], subtypes: [], cost: cost(1, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'recall', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'You remember winning. The court remembers the return trip.',
  },
  {
    id: 'cf-bitter-geas', name: 'Bitter Geas', types: ['enchantment'], subtypes: ['Aura'], cost: cost(0, 'B'), colors: ['B'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: -1, t: -1 } }],
    rarity: 'c', flavor: 'A promise made in anger. A leash worn in public.',
  },
  {
    id: 'cf-hill-feast', name: 'Hill Feast', types: ['ritual'], subtypes: [], cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 4 }, { op: 'createToken', token: 'tok-bloom', count: 1 }] }],
    rarity: 'c', flavor: 'Eat what is offered. Ask nothing about what is missing.',
  },
  {
    id: 'cf-silver-apple-shot', name: 'Silver Apple Shot', types: ['ritual'], subtypes: [], cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 3, to: 'target' }] }],
    rarity: 'c', flavor: 'The apple is the warning. The arrow is the punctuation.',
  },
  {
    id: 'cf-oak-shield-vow', name: 'Oak-Shield Vow', types: ['charm'], subtypes: [], cost: cost(0, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 0, t: 3, scope: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'Stand beneath the oak. It has outlasted worse kings.',
  },
  {
    id: 'cf-fogbell-chime', name: 'Fogbell Chime', types: ['charm'], subtypes: [], cost: cost(0, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'One note, and the road forgets which way is forward.',
  },
  fae('cf-moorland-guide', 'Moorland Guide', 'Guide', {
    cost: cost(1, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['sentinel'],
    rarity: 'c', flavor: 'She knows every dry path. She sells only the wet ones.',
  }),
  fae('cf-veil-touched-hart', 'Veil-Touched Hart', 'Hart', {
    cost: cost(1, 'G'), colors: ['G'], attack: 2, defense: 3, abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'Its antlers hold the last light. Do not follow where they point.',
  }),
  fae('cf-cairnlight-adept', 'Cairnlight Adept', 'Witch', {
    cost: cost(1, 'B'), colors: ['B'], attack: 2, defense: 2, abilities: [{ when: 'arrives', ops: [{ op: 'grind', n: 2, who: 'self' }] }],
    rarity: 'c', flavor: 'She tends the grave-lights. They tend her secrets.',
  }),
  {
    id: 'cf-fae-spark', name: 'Fae Spark', types: ['charm'], subtypes: [], cost: cost(0, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 2, t: 0, scope: 'target' }, { op: 'damage', n: 1, to: 'controller' }] }],
    rarity: 'c', flavor: 'It makes a lovely light. It also knows who paid for it.',
  },
] satisfies readonly CardDef[];
