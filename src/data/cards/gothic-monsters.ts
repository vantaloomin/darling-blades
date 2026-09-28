import type { CardDef } from '../cardTypes';
import { cost } from '../cardTypes';

/**
 * GOTHIC MONSTERS, Nocturne Manor. A candlelit horror-glamour expansion of
 * vampires, stitched constructs, wolf curses, and graveyard pageantry.
 */
type GothicData = Omit<CardDef, 'id' | 'name' | 'types' | 'subtypes'>;

function creature(id: string, name: string, subtypes: string[], data: GothicData): CardDef {
  return { id, name, types: ['creature'], subtypes, ...data };
}

export const GOTHIC_MONSTERS = [
  // =========================================================================
  // ULTRA RARE (4)
  // =========================================================================
  creature('gm-carmilla-crimson-host', 'Carmilla, Crimson Host', ['Vampire', 'Countess'], {
    supertypes: ['legendary'], cost: cost(3, 'BR'), colors: ['B', 'R'], attack: 5, defense: 5,
    keywords: ['skyborne', 'dreaded', 'rage'], empower: {
      cost: cost(1, 'BR'), ops: [{ op: 'loseLife', n: 3, who: 'opponent' }, { op: 'gainLife', n: 3 }],
    },
    rarity: 'ur',
  }),
  creature('gm-bride-storm-crowned', 'The Storm-Crowned Bride', ['Construct', 'Bride'], {
    supertypes: ['legendary'], cost: cost(3, 'UB'), colors: ['U', 'B'], attack: 4, defense: 5,
    keywords: ['deathblade', 'skyborne'], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'raise', to: 'top' }] },
    rarity: 'ur',
  }),
  creature('gm-luna-wolf-matriarch', 'Luna, Wolf-Matriarch of the Moors', ['Wolf', 'Noble'], {
    supertypes: ['legendary'], cost: cost(5, 'RG'), colors: ['R', 'G'], attack: 8, defense: 6,
    keywords: ['dreaded', 'overrun', 'warcry'],
    rarity: 'ur',
  }),
  creature('gm-lenore-velvet-saint', 'Lenore, Velvet Saint', ['Revenant', 'Saint'], {
    supertypes: ['legendary'], cost: cost(3, 'WBB'), colors: ['W', 'B'], attack: 5, defense: 8,
    keywords: ['bloodoath', 'dreaded'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 3, who: 'opponent' }] }],
    rarity: 'ur',
  }),

  // =========================================================================
  // SUPER-SUPER RARE (5)
  // =========================================================================
  {
    id: 'gm-nocturne-manor', name: 'Nocturne Manor', types: ['enchantment'], subtypes: ['Manor'],
    supertypes: ['legendary'], cost: cost(2, 'BB'), colors: ['B'],
    abilities: [{ when: 'dawn', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] }],
    empower: { cost: cost(3, 'B'), ops: [{ op: 'createToken', token: 'tok-bat', count: 2 }] },
    rarity: 'ssr',
  },
  creature('gm-victorine-lightning-heir', 'Victorine, Lightning Heir', ['Scientist', 'Heir'], {
    supertypes: ['legendary'], cost: cost(2, 'UR'), colors: ['U', 'R'], attack: 4, defense: 4,
    keywords: ['warcry'], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    empower: { cost: cost(2, 'R'), ops: [{ op: 'damage', n: 2, to: 'opponent' }, { op: 'draw', n: 1 }] },
    rarity: 'ssr',
  }),
  creature('gm-elizabeth-blood-mirror', 'Elizabeth of the Blood Mirror', ['Vampire', 'Noble'], {
    supertypes: ['legendary'], cost: cost(2, 'BR'), colors: ['B', 'R'], attack: 4, defense: 4,
    keywords: ['dreaded'], abilities: [{ when: 'attacks', ops: [{ op: 'damage', n: 1, to: 'opponent' }] }],
    rarity: 'ssr',
  }),
  creature('gm-white-chapel-witch', 'White-Chapel Witch', ['Witch'], {
    supertypes: ['legendary'], cost: cost(3, 'WB'), colors: ['W', 'B'], attack: 5, defense: 5,
    keywords: ['bloodoath'], abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }],
    empower: { cost: cost(1, 'W'), ops: [{ op: 'gainLife', n: 3 }] },
    rarity: 'ssr',
  }),
  {
    id: 'gm-moon-doll-orchestra', name: 'Moon-Doll Orchestra', types: ['artifact', 'creature'],
    subtypes: ['Doll', 'Construct'], cost: cost(5, 'U'), colors: ['U'], attack: 5, defense: 7,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }],
    empower: { cost: cost(2, 'U'), ops: [{ op: 'createToken', token: 'tok-doll', count: 2 }] },
    rarity: 'ssr',
  },

  // =========================================================================
  // SUPER RARE (7)
  // =========================================================================
  {
    id: 'gm-dracula-ball-invite', name: 'Invitation to the Crimson Ball', types: ['ritual'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] },
    rarity: 'sr',
  },
  {
    id: 'gm-grave-rose-garden', name: 'Grave-Rose Garden', types: ['enchantment'], subtypes: ['Plant'],
    cost: cost(4, 'BG'), colors: ['B', 'G'],
    abilities: [{ when: 'dawn', ops: [{ op: 'createToken', token: 'tok-grave-rose', count: 1 }, { op: 'gainLife', n: 1 }] }],
    rarity: 'sr',
  },
  {
    id: 'gm-stormtower-resurrection', name: 'Stormtower Resurrection', types: ['ritual'], subtypes: [],
    cost: cost(4, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', targets: [{ what: 'yourGraveCreature' }], ops: [{ op: 'raise', to: 'target' }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'draw', n: 2 }] },
    rarity: 'sr',
  },
  creature('gm-silver-bullet-duelist', 'Silver-Bullet Duelist', ['Hunter', 'Duelist'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['firstBlade', 'bloodoath'],
    rarity: 'sr',
  }),
  {
    id: 'gm-porcelain-queen', name: 'Porcelain Queen', types: ['artifact', 'creature'],
    subtypes: ['Doll', 'Construct', 'Queen'], supertypes: ['legendary'], cost: cost(3, 'UW'),
    colors: ['U', 'W'], attack: 4, defense: 4, keywords: ['sentinel'],
    abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'sr',
  },
  creature('gm-black-veil-matron', 'Black-Veil Matron', ['Vampire', 'Matron'], {
    cost: cost(3, 'B'), colors: ['B'], attack: 4, defense: 3, keywords: ['skyborne', 'dreaded'],
    rarity: 'sr',
  }),
  {
    id: 'gm-cathedral-of-bats', name: 'Cathedral of Bats', types: ['enchantment'], subtypes: ['Cathedral'],
    cost: cost(5, 'B'), colors: ['B'],
    abilities: [{ when: 'dawn', ops: [{ op: 'createToken', token: 'tok-bat', count: 1 }] }],
    rarity: 'sr',
  },

  // =========================================================================
  // RARE (24)
  // =========================================================================
  {
    id: 'gm-porcelain-governess', name: 'Porcelain Governess', types: ['artifact', 'creature'],
    subtypes: ['Construct', 'Doll'], cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 3,
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Construct', other: true }, p: 1, t: 0 } }],
    rarity: 'r',
  },
  creature('gm-ravenloft-heiress', 'Ravenloft Heiress', ['Vampire', 'Heiress'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 3, defense: 1, keywords: ['skyborne'],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] },
    rarity: 'r',
  }),
  creature('gm-moonlit-werewolf', 'Moonlit Werewolf', ['Wolf'], {
    cost: cost(3, 'R'), colors: ['R'], attack: 4, defense: 3, keywords: ['dreaded', 'overrun'],
    rarity: 'r',
  }),
  {
    id: 'gm-stitchwork-guardian', name: 'Stitchwork Guardian', types: ['artifact', 'creature'],
    subtypes: ['Construct'], cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 7,
    keywords: ['bulwark', 'untouchable'], empower: { cost: cost(2, 'U'), ops: [{ op: 'draw', n: 1 }] },
    rarity: 'r',
  },
  {
    id: 'gm-candelabra-of-souls', name: 'Candelabra of Souls', types: ['artifact'], subtypes: [],
    cost: cost(2), colors: [], manaAbility: ['W', 'U', 'B', 'R', 'G'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r',
  },
  {
    id: 'gm-velvet-coffin', name: 'Velvet Coffin', types: ['artifact'], subtypes: ['Vampire'],
    cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'dawn', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }, { op: 'gainLife', n: 2 }] }],
    rarity: 'r',
  },
  creature('gm-blood-opera-soloist', 'Blood-Opera Soloist', ['Vampire', 'Performer'], {
    cost: cost(2, 'BB'), colors: ['B'], attack: 3, defense: 3, keywords: ['dreaded', 'bloodoath'],
    rarity: 'r',
  }),
  {
    id: 'gm-graveyard-waltz', name: 'Graveyard Waltz', types: ['ritual'], subtypes: [],
    cost: cost(5, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: 'tok-revenant', count: 2 }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'raise', to: 'top' }] },
    rarity: 'r',
  },
  {
    id: 'gm-wolfsbane-ward', name: 'Wolfsbane Ward', types: ['enchantment'], subtypes: ['Aura'],
    cost: cost(0, 'W'), colors: ['W'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: -1, t: 0, grantKeywords: ['bulwark'] } }],
    rarity: 'r',
  },
  creature('gm-thunder-lab-assistant', 'Thunder-Lab Assistant', ['Scientist', 'Assistant'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }],
    empower: { cost: cost(2, 'U'), ops: [{ op: 'draw', n: 1 }] },
    rarity: 'r',
  }),
  {
    id: 'gm-iron-gate-sentinel', name: 'Iron-Gate Sentinel', types: ['artifact', 'creature'],
    subtypes: ['Construct'], cost: cost(2, 'W'), colors: ['W'], attack: 1, defense: 7,
    keywords: ['bulwark'], rarity: 'r',
  },
  creature('gm-batcloak-cutthroat', 'Batcloak Cutthroat', ['Vampire', 'Assassin'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2, keywords: ['skyborne', 'deathblade'],
    rarity: 'r',
  }),
  creature('gm-madame-macabre', 'Madame Macabre', ['Vampire', 'Hostess'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 3, keywords: ['bloodoath'],
    abilities: [{ when: 'dies', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }] }],
    rarity: 'r',
  }),
  {
    id: 'gm-howling-gallery', name: 'Howling Gallery', types: ['enchantment'], subtypes: ['Gallery'],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Wolf' }, p: 1, t: 0, grantKeywords: ['dreaded'] } }],
    rarity: 'r',
  },
  creature('gm-glasshouse-monster', 'Glasshouse Monster', ['Plant', 'Monster'], {
    cost: cost(4, 'G'), colors: ['G'], attack: 4, defense: 4, keywords: ['overrun'],
    empower: { cost: cost(2, 'G'), ops: [{ op: 'addCounters', n: 2, to: 'self' }] },
    rarity: 'r',
  }),
  {
    id: 'gm-lightning-rod-spire', name: 'Lightning-Rod Spire', types: ['artifact'], subtypes: ['Spire'],
    cost: cost(2, 'U'), colors: ['U'],
    abilities: [{ when: 'dawn', ops: [{ op: 'damage', n: 1, to: 'opponent' }, { op: 'foresee', n: 1 }] }],
    rarity: 'r',
  },
  {
    id: 'gm-black-lace-pact', name: 'Black-Lace Pact', types: ['ritual'], subtypes: [],
    cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 2 }, { op: 'damage', n: 2, to: 'controller' }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] },
    rarity: 'r',
  },
  creature('gm-chapel-exorcist', 'Chapel Exorcist', ['Hunter', 'Cleric'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['bloodoath'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }],
    rarity: 'r',
  }),
  creature('gm-widow-of-the-west-wing', 'Widow of the West Wing', ['Revenant', 'Spirit'], {
    cost: cost(3, 'B'), colors: ['B'], attack: 3, defense: 3, keywords: ['skyborne', 'dreaded'],
    rarity: 'r',
  }),
  {
    id: 'gm-midnight-autopsy', name: 'Midnight Autopsy', types: ['ritual'], subtypes: [],
    cost: cost(4, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'grind', n: 2, who: 'self' }, { op: 'draw', n: 2 }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'raise', to: 'top' }] },
    rarity: 'r',
  },
  {
    id: 'gm-stormglass-golem', name: 'Stormglass Golem', types: ['artifact', 'creature'],
    subtypes: ['Construct'], cost: cost(4), colors: [], attack: 3, defense: 3, keywords: ['firstBlade'],
    empower: { cost: cost(2), ops: [{ op: 'addCounters', n: 2, to: 'self' }] },
    rarity: 'r',
  },
  {
    id: 'gm-red-moon-rampage', name: 'Red-Moon Rampage', types: ['charm'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', ops: [{ op: 'boost', p: 2, t: 0, keywords: ['overrun'], scope: 'allYours' }] }],
    rarity: 'r',
  },
  creature('gm-choir-of-the-dead', 'Choir of the Dead', ['Revenant', 'Spirit'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['skyborne', 'bloodoath'],
    rarity: 'r',
  }),
  {
    id: 'gm-silvered-rapier', name: 'Silvered Rapier', types: ['artifact'], subtypes: ['Weapon'],
    cost: cost(2), colors: [],
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Hunter' }, p: 1, t: 0, grantKeywords: ['firstBlade'] } }],
    rarity: 'r',
  },
  {
    id: 'gm-stormtower-roof', name: 'Stormtower Roof', types: ['land'], subtypes: [], colors: [],
    entersTapped: true, manaAbility: ['U', 'B'], rarity: 'r',
  },
  {
    id: 'gm-moonmoor-estate', name: 'Moonmoor Estate', types: ['land'], subtypes: [], colors: [],
    entersTapped: true, manaAbility: ['R', 'G'], rarity: 'c',
  },

  // =========================================================================
  // COMMON (41)
  // =========================================================================
  creature('gm-manor-thrall', 'Manor Thrall', ['Vampire', 'Servant'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 2, defense: 2, keywords: ['dreaded'],
    rarity: 'c',
  }),
  creature('gm-bat-swarm', 'Bat Swarm', ['Bat'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 2, keywords: ['skyborne'],
    rarity: 'c',
  }),
  creature('gm-wolfbitten-hunter', 'Wolfbitten Hunter', ['Hunter', 'Wolf'], {
    cost: cost(1, 'R'), colors: ['R'], attack: 2, defense: 2, keywords: ['warcry'],
    rarity: 'c',
  }),
  creature('gm-lab-sparkmage', 'Lab Sparkmage', ['Mage'], {
    cost: cost(1, 'U'), colors: ['U'], attack: 1, defense: 2,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c',
  }),
  creature('gm-chapel-guard', 'Chapel Guard', ['Guard'], {
    cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 3, keywords: ['sentinel'],
    rarity: 'c',
  }),
  creature('gm-grave-gardener', 'Grave Gardener', ['Plant', 'Gardener'], {
    cost: cost(1, 'G'), colors: ['G'], attack: 2, defense: 2, keywords: ['wardingGaze'],
    rarity: 'c',
  }),
  {
    id: 'gm-stitched-footman', name: 'Stitched Footman', types: ['artifact', 'creature'],
    subtypes: ['Construct'], cost: cost(1, 'U'), colors: ['U'], attack: 1, defense: 4,
    keywords: ['bulwark'], rarity: 'c',
  },
  creature('gm-blood-drop-initiate', 'Blood-Drop Initiate', ['Vampire', 'Initiate'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 2, keywords: ['bloodoath'],
    rarity: 'c',
  }),
  {
    id: 'gm-candlelit-seance', name: 'Candlelit Seance', types: ['ritual'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'grind', n: 2, who: 'self' }, { op: 'draw', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'gm-kicked-door', name: 'Kicked Door', types: ['ritual'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 2, to: 'target' }] }],
    empower: { cost: cost(1, 'R'), ops: [{ op: 'damage', n: 2, to: 'opponent' }] },
    rarity: 'c',
  },
  {
    id: 'gm-silver-knife', name: 'Silver Knife', types: ['charm'], subtypes: [],
    cost: cost(0, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 1, t: 1, keywords: ['firstBlade'], scope: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'gm-fogged-window', name: 'Fogged Window', types: ['charm'], subtypes: [],
    cost: cost(0, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'gm-rose-thorn-snare', name: 'Rose-Thorn Snare', types: ['charm'], subtypes: [],
    cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 1, t: 2, keywords: ['deathblade'], scope: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'gm-haunted-doll', name: 'Haunted Doll', types: ['artifact', 'creature'], subtypes: ['Doll', 'Construct'],
    cost: cost(2), colors: [], attack: 1, defense: 1, keywords: ['sentinel'],
    rarity: 'c',
  },
  creature('gm-crow-on-gate', 'Crow on the Gate', ['Bird'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 1, keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c',
  }),
  creature('gm-catacomb-ratcatcher', 'Catacomb Ratcatcher', ['Rat', 'Worker'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2,
    abilities: [{ when: 'arrives', ops: [{ op: 'createToken', token: 'tok-rat', count: 1 }] }],
    rarity: 'c',
  }),
  creature('gm-waxwork-double', 'Waxwork Double', ['Construct', 'Figure'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }],
    rarity: 'c',
  }),
  {
    id: 'gm-red-curtain-cut', name: 'Red-Curtain Cut', types: ['charm'], subtypes: [],
    cost: cost(0, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 2, to: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'gm-holy-water-vial', name: 'Holy Water Vial', types: ['ritual'], subtypes: ['Vial'],
    cost: cost(0, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'gm-moonlit-prowl', name: 'Moonlit Prowl', types: ['charm'], subtypes: [],
    cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 2, t: 2, keywords: ['dreaded'], scope: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'gm-cellar-door', name: 'Cellar Door', types: ['artifact'], subtypes: ['Door'],
    cost: cost(1), colors: [], abilities: [{ when: 'dawn', ops: [{ op: 'grind', n: 1, who: 'self' }] }],
    rarity: 'c',
  },
  creature('gm-black-cat-familiar', 'Black Cat Familiar', ['Cat', 'Familiar'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 2, keywords: ['deathblade'],
    rarity: 'c',
  }),
  {
    id: 'gm-thunderclap', name: 'Thunderclap', types: ['charm'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 1, to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'gm-funeral-bell', name: 'Funeral Bell', types: ['ritual'], subtypes: ['Bell'],
    cost: cost(0, 'B'), colors: ['B'], abilities: [{ when: 'spell', ops: [{ op: 'gainLife', n: 2 }] }],
    empower: { cost: cost(1, 'B'), ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] },
    rarity: 'c',
  },
  creature('gm-stitched-hound', 'Stitched Hound', ['Revenant', 'Hound'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 3, defense: 2, keywords: ['dreaded'],
    rarity: 'c',
  }),
  {
    id: 'gm-broken-mirror', name: 'Broken Mirror', types: ['artifact'], subtypes: ['Mirror'],
    cost: cost(1, 'U'), colors: ['U'], abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }, { op: 'grind', n: 1, who: 'self' }] }],
    rarity: 'c',
  },
  creature('gm-raven-courier', 'Raven Courier', ['Bird', 'Courier'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2, keywords: ['skyborne'],
    rarity: 'c',
  }),
  {
    id: 'gm-wolfbane-shot', name: 'Wolfsbane Shot', types: ['charm'], subtypes: [],
    cost: cost(3, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'sever', to: 'target' }] }],
    rarity: 'c',
  },
  {
    id: 'gm-blood-candle', name: 'Blood Candle', types: ['enchantment'], subtypes: ['Ritual'],
    cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'dawn', ops: [{ op: 'damage', n: 3, to: 'controller' }, { op: 'draw', n: 1 }] }],
    rarity: 'c',
  },
  {
    id: 'gm-moor-path', name: 'Moorlight Lantern', types: ['artifact'], subtypes: [], colors: ['B'],
    cost: cost(2, 'B'),
    activated: { cost: { tap: true, mana: cost(3) }, ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] },
    rarity: 'c',
  },
  {
    id: 'gm-chapel-yard', name: 'Chapel-Yard Rosary', types: ['artifact'], subtypes: [], colors: ['W'],
    cost: cost(0, 'W'),
    activated: { cost: { tap: true }, ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] },
    rarity: 'c',
  },
  {
    id: 'gm-lab-annex', name: 'Annex Notebook', types: ['artifact'], subtypes: [], colors: ['U'],
    cost: cost(0, 'U'),
    activated: { cost: { tap: true }, ops: [{ op: 'foresee', n: 1 }] },
    rarity: 'c',
  },
  {
    id: 'gm-red-roof-village', name: 'Festival Rocket', types: ['artifact'], subtypes: [], colors: ['R'],
    cost: cost(2, 'R'),
    activated: { cost: { tap: true, mana: cost(2) }, targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 2, to: 'target' }] },
    rarity: 'c',
  },
  {
    id: 'gm-thorned-cemetery', name: 'Cemetery Thorn', types: ['artifact'], subtypes: [], colors: ['G'],
    cost: cost(0, 'G'),
    activated: { cost: { tap: true }, ops: [{ op: 'grind', n: 1, who: 'self' }] },
    rarity: 'c',
  },
  {
    id: 'gm-midnight-bite', name: 'Midnight Bite', types: ['charm'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 2, to: 'target' }, { op: 'gainLife', n: 2 }] }],
    rarity: 'c',
  },
  {
    id: 'gm-tattered-invitation', name: 'Tattered Invitation', types: ['ritual'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'discardRandom', n: 1, who: 'opponent' }] }],
    empower: { cost: cost(1, 'B'), ops: [{ op: 'damage', n: 2, to: 'opponent' }] },
    rarity: 'c',
  },
  creature('gm-lantern-patrol', 'Lantern Patrol', ['Hunter', 'Patrol'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 2, keywords: ['firstBlade'],
    rarity: 'c',
  }),
  {
    id: 'gm-screaming-staircase', name: 'Screaming Staircase', types: ['artifact', 'creature'],
    subtypes: ['Construct', 'Staircase'], cost: cost(1, 'U'), colors: ['U'], attack: 1, defense: 5,
    keywords: ['bulwark'], rarity: 'c',
  },
  creature('gm-grave-soil-giant', 'Grave-Soil Giant', ['Plant', 'Giant'], {
    cost: cost(5, 'G'), colors: ['G'], attack: 5, defense: 6, keywords: ['overrun'],
    rarity: 'c',
  }),
  {
    id: 'gm-hunters-writ', name: "Hunter's Writ", types: ['charm'], subtypes: [],
    cost: cost(2, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'artifactOrEnchantment' }], ops: [{ op: 'sever', to: 'target' }, { op: 'gainLife', n: 2 }] }],
    rarity: 'c',
  },
  // Returning-mechanics sprinkle (1.6): Retell visits the manor. Base drain
  // sits under Treasonous Glance (no Foresee rider) so the recast is the
  // whole reason to run it.
  {
    id: 'gm-retold-by-candlelight', name: 'Retold by Candlelight', types: ['ritual'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }],
    retell: { cost: cost(2, 'B') },
    rarity: 'c',
  },
] satisfies readonly CardDef[];
