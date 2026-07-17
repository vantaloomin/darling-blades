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
    supertypes: ['legendary'], cost: cost(4, 'BR'), colors: ['B', 'R'], attack: 5, defense: 5,
    keywords: ['skyborne', 'dreaded'], empower: {
      cost: cost(1, 'BR'), ops: [{ op: 'loseLife', n: 3, who: 'opponent' }, { op: 'gainLife', n: 3 }],
    },
    rarity: 'ur', flavor: 'She hosts the feast, then invoices the moon for every drop.',
  }),
  creature('gm-bride-storm-crowned', 'The Bride, Storm-Crowned', ['Construct', 'Bride'], {
    supertypes: ['legendary'], cost: cost(4, 'UB'), colors: ['U', 'B'], attack: 4, defense: 5,
    keywords: ['deathblade'], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'raise', to: 'top' }] },
    rarity: 'ur', flavor: 'She married the storm and kept the lightning as a dowry.',
  }),
  creature('gm-luna-wolf-matriarch', 'Luna, Wolf-Matriarch of the Moors', ['Wolf', 'Werewolf', 'Noble'], {
    supertypes: ['legendary'], cost: cost(4, 'RG'), colors: ['R', 'G'], attack: 6, defense: 5,
    keywords: ['dreaded', 'overrun', 'warcry'],
    rarity: 'ur', flavor: 'Moonrise summons the pack; morning delivers the bill.',
  }),
  creature('gm-lenore-velvet-saint', 'Lenore, Velvet Saint', ['Revenant', 'Saint'], {
    supertypes: ['legendary'], cost: cost(4, 'WB'), colors: ['W', 'B'], attack: 4, defense: 5,
    keywords: ['bloodoath', 'dreaded'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 3, who: 'opponent' }] }],
    rarity: 'ur', flavor: 'She blesses the velvet, curses the grave, and never spills either.',
  }),

  // =========================================================================
  // SUPER-SUPER RARE (5)
  // =========================================================================
  {
    id: 'gm-nocturne-manor', name: 'Nocturne Manor', types: ['enchantment'], subtypes: ['Manor'],
    supertypes: ['legendary'], cost: cost(4, 'B'), colors: ['B'],
    abilities: [{ when: 'dawn', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'createToken', token: 'tok-bat', count: 2 }] },
    rarity: 'ssr', flavor: 'The house keeps excellent hours and terrible guests.',
  },
  creature('gm-victorine-lightning-heir', 'Victorine, Lightning Heir', ['Scientist', 'Heir'], {
    supertypes: ['legendary'], cost: cost(3, 'UR'), colors: ['U', 'R'], attack: 4, defense: 4,
    keywords: ['warcry'], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    empower: { cost: cost(2, 'R'), ops: [{ op: 'damage', n: 2, to: 'opponent' }, { op: 'draw', n: 1 }] },
    rarity: 'ssr', flavor: 'The will left her a tower. The weather she fixed herself.',
  }),
  creature('gm-elizabeth-blood-mirror', 'Elizabeth of the Blood Mirror', ['Vampire', 'Noble'], {
    supertypes: ['legendary'], cost: cost(3, 'BR'), colors: ['B', 'R'], attack: 4, defense: 4,
    keywords: ['dreaded'], abilities: [{ when: 'attacks', ops: [{ op: 'damage', n: 1, to: 'opponent' }] }],
    rarity: 'ssr', flavor: 'Mirrors show her no flaws, only appointments.',
  }),
  creature('gm-white-chapel-witch', 'White-Chapel Witch', ['Witch'], {
    supertypes: ['legendary'], cost: cost(3, 'WB'), colors: ['W', 'B'], attack: 3, defense: 4,
    keywords: ['bloodoath'], abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }],
    empower: { cost: cost(2, 'W'), ops: [{ op: 'gainLife', n: 3 }] },
    rarity: 'ssr', flavor: 'Holy water in one hand, a very firm opinion in the other.',
  }),
  {
    id: 'gm-moon-doll-orchestra', name: 'Moon-Doll Orchestra', types: ['artifact', 'creature'],
    subtypes: ['Doll', 'Construct'], cost: cost(4, 'U'), colors: ['U'], attack: 3, defense: 5,
    keywords: ['sentinel'], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }],
    empower: { cost: cost(2, 'U'), ops: [{ op: 'createToken', token: 'tok-doll', count: 2 }] },
    rarity: 'ssr', flavor: 'The encore is compulsory and somehow always in tune.',
  },

  // =========================================================================
  // SUPER RARE (7)
  // =========================================================================
  {
    id: 'gm-dracula-ball-invite', name: 'Invitation to the Crimson Ball', types: ['ritual'], subtypes: [],
    cost: cost(3, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] },
    rarity: 'sr', flavor: 'Dress code: formal. Exit policy: aspirational.',
  },
  {
    id: 'gm-grave-rose-garden', name: 'Grave-Rose Garden', types: ['enchantment'], subtypes: ['Plant'],
    cost: cost(3, 'G'), colors: ['G'],
    abilities: [{ when: 'dawn', ops: [{ op: 'createToken', token: 'tok-grave-rose', count: 1 }, { op: 'gainLife', n: 1 }] }],
    rarity: 'sr', flavor: 'Every rose has thorns. These ones also have burial records.',
  },
  {
    id: 'gm-stormtower-resurrection', name: 'Stormtower Resurrection', types: ['ritual'], subtypes: [],
    cost: cost(4, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', targets: [{ what: 'yourGraveCreature' }], ops: [{ op: 'raise', to: 'target' }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'draw', n: 2 }] },
    rarity: 'sr', flavor: 'The lightning signs the paperwork. The grave supplies the applicant.',
  },
  creature('gm-silver-bullet-duelist', 'Silver-Bullet Duelist', ['Hunter', 'Duelist'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['firstBlade'],
    empower: { cost: cost(2, 'W'), ops: [{ op: 'damage', n: 2, to: 'opponent' }] },
    rarity: 'sr', flavor: 'One bullet. Bringing a second would be gauche.',
  }),
  {
    id: 'gm-porcelain-queen', name: 'Porcelain Queen', types: ['artifact', 'creature'],
    subtypes: ['Doll', 'Construct', 'Queen'], supertypes: ['legendary'], cost: cost(3, 'UW'),
    colors: ['U', 'W'], attack: 4, defense: 4, keywords: ['sentinel'],
    abilities: [{ when: 'dawn', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'sr', flavor: 'Immaculate posture, one hairline fracture, absolute rule.',
  },
  creature('gm-black-veil-matron', 'Black-Veil Matron', ['Vampire', 'Matron'], {
    cost: cost(3, 'B'), colors: ['B'], attack: 4, defense: 3, keywords: ['skyborne', 'dreaded'],
    rarity: 'sr', flavor: 'Only a worthy room ever sees beneath the veil.',
  }),
  {
    id: 'gm-cathedral-of-bats', name: 'Cathedral of Bats', types: ['enchantment'], subtypes: ['Cathedral'],
    cost: cost(3, 'B'), colors: ['B'],
    abilities: [{ when: 'dawn', ops: [{ op: 'createToken', token: 'tok-bat', count: 1 }] }],
    rarity: 'sr', flavor: 'The choir has wings and an impeccable sense of timing.',
  },

  // =========================================================================
  // RARE (24)
  // =========================================================================
  creature('gm-ravenloft-heiress', 'Ravenloft Heiress', ['Vampire', 'Heiress'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 3, defense: 2, keywords: ['skyborne'],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] },
    rarity: 'r', flavor: 'One castle, one curse, and the best balcony in either.',
  }),
  creature('gm-moonlit-werewolf', 'Moonlit Werewolf', ['Wolf', 'Werewolf'], {
    cost: cost(3, 'R'), colors: ['R'], attack: 4, defense: 3, keywords: ['dreaded', 'overrun'],
    rarity: 'r', flavor: 'Moonlight, she maintains, is simply excellent dressing-room lighting.',
  }),
  {
    id: 'gm-stitchwork-guardian', name: 'Stitchwork Guardian', types: ['artifact', 'creature'],
    subtypes: ['Construct'], cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 5,
    keywords: ['bulwark'], empower: { cost: cost(2, 'U'), ops: [{ op: 'draw', n: 1 }] },
    rarity: 'r', flavor: 'Every seam is reinforced. Every objection is ignored.',
  },
  {
    id: 'gm-candelabra-of-souls', name: 'Candelabra of Souls', types: ['artifact'], subtypes: [],
    cost: cost(3), colors: [], manaAbility: ['W', 'U', 'B', 'R', 'G'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'Five flames, one argument about who gets the dramatic entrance.',
  },
  {
    id: 'gm-velvet-coffin', name: 'Velvet Coffin', types: ['artifact'], subtypes: ['Vampire'],
    cost: cost(3, 'B'), colors: ['B'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 3, who: 'opponent' }, { op: 'gainLife', n: 2 }] }],
    rarity: 'r', flavor: 'Silk lining, cedar panels, absolutely no return policy.',
  },
  creature('gm-blood-opera-soloist', 'Blood-Opera Soloist', ['Vampire', 'Performer'], {
    cost: cost(2, 'BB'), colors: ['B'], attack: 3, defense: 3, keywords: ['dreaded', 'bloodoath'],
    rarity: 'r', flavor: 'The high note lands just as the audience does.',
  }),
  {
    id: 'gm-graveyard-waltz', name: 'Graveyard Waltz', types: ['ritual'], subtypes: [],
    cost: cost(4, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'createToken', token: 'tok-revenant', count: 2 }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'raise', to: 'top' }] },
    rarity: 'r', flavor: 'The dancers know all the steps. They have had time to practice.',
  },
  {
    id: 'gm-wolfsbane-ward', name: 'Wolfsbane Ward', types: ['enchantment'], subtypes: ['Aura'],
    cost: cost(1, 'W'), colors: ['W'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: -2, t: -2 } }],
    rarity: 'r', flavor: 'A little herb, a little prayer, a very pointed boundary.',
  },
  creature('gm-thunder-lab-assistant', 'Thunder-Lab Assistant', ['Scientist', 'Assistant'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }],
    empower: { cost: cost(2, 'U'), ops: [{ op: 'draw', n: 1 }] },
    rarity: 'r', flavor: 'Each flask wears a label, even the one that writes its own.',
  }),
  {
    id: 'gm-iron-gate-sentinel', name: 'Iron-Gate Sentinel', types: ['artifact', 'creature'],
    subtypes: ['Construct'], cost: cost(4, 'W'), colors: ['W'], attack: 1, defense: 7,
    keywords: ['bulwark'], rarity: 'r', flavor: 'The gate opens for guests and closes for absolutely everyone else.',
  },
  creature('gm-batcloak-cutthroat', 'Batcloak Cutthroat', ['Vampire', 'Assassin'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 3, defense: 2, keywords: ['skyborne', 'deathblade'],
    rarity: 'r', flavor: 'Arrives as a shadow. Departs as a legal complication.',
  }),
  creature('gm-madame-macabre', 'Madame Macabre', ['Vampire', 'Hostess'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 3, keywords: ['bloodoath'],
    abilities: [{ when: 'dies', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }] }],
    rarity: 'r', flavor: 'She serves grief chilled, with a garnish of plausible deniability.',
  }),
  {
    id: 'gm-howling-gallery', name: 'Howling Gallery', types: ['enchantment'], subtypes: ['Gallery'],
    cost: cost(2, 'R'), colors: ['R'],
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Wolf' }, p: 1, t: 0, grantKeywords: ['dreaded'] } }],
    rarity: 'r', flavor: 'Every portrait is a little louder after midnight.',
  },
  creature('gm-glasshouse-monster', 'Glasshouse Monster', ['Plant', 'Monster'], {
    cost: cost(4, 'G'), colors: ['G'], attack: 4, defense: 4, keywords: ['overrun'],
    empower: { cost: cost(2, 'G'), ops: [{ op: 'addCounters', n: 2, to: 'self' }] },
    rarity: 'r', flavor: 'Glass breaks when the garden is ready to leave, not before.',
  }),
  {
    id: 'gm-lightning-rod-spire', name: 'Lightning-Rod Spire', types: ['artifact'], subtypes: ['Spire'],
    cost: cost(3, 'U'), colors: ['U'],
    abilities: [{ when: 'dawn', ops: [{ op: 'damage', n: 1, to: 'opponent' }, { op: 'foresee', n: 1 }] }],
    rarity: 'r', flavor: 'It attracts lightning and visitors with the same confidence.',
  },
  {
    id: 'gm-black-lace-pact', name: 'Black-Lace Pact', types: ['ritual'], subtypes: [],
    cost: cost(3, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 2 }, { op: 'damage', n: 2, to: 'controller' }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] },
    rarity: 'r', flavor: 'The ink is black, the lace is lovely, and the fine print bites.',
  },
  creature('gm-chapel-exorcist', 'Chapel Exorcist', ['Hunter', 'Cleric'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['bloodoath'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 2, who: 'opponent' }] }],
    rarity: 'r', flavor: 'Spirits evicted promptly. Postage billed to the chapel.',
  }),
  creature('gm-widow-of-the-west-wing', 'Widow of the West Wing', ['Revenant', 'Ghost'], {
    cost: cost(3, 'B'), colors: ['B'], attack: 3, defense: 3, keywords: ['skyborne', 'dreaded'],
    rarity: 'r', flavor: 'West wing, obviously. The east wing has dreadful wallpaper.',
  }),
  {
    id: 'gm-midnight-autopsy', name: 'Midnight Autopsy', types: ['ritual'], subtypes: [],
    cost: cost(3, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'grind', n: 2, who: 'self' }, { op: 'draw', n: 2 }] }],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'raise', to: 'top' }] },
    rarity: 'r', flavor: 'Study the evidence long enough and it studies back.',
  },
  {
    id: 'gm-stormglass-golem', name: 'Stormglass Golem', types: ['artifact', 'creature'],
    subtypes: ['Construct'], cost: cost(4), colors: [], attack: 3, defense: 3, keywords: ['firstBlade'],
    empower: { cost: cost(2), ops: [{ op: 'addCounters', n: 2, to: 'self' }] },
    rarity: 'r', flavor: 'Handle with care. It handles everyone else without it.',
  },
  {
    id: 'gm-red-moon-rampage', name: 'Red-Moon Rampage', types: ['charm'], subtypes: [],
    cost: cost(2, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', ops: [{ op: 'boost', p: 2, t: 0, keywords: ['overrun'], scope: 'allYours' }] }],
    rarity: 'r', flavor: 'The moon rises red, and everyone suddenly has plans.',
  },
  creature('gm-choir-of-the-dead', 'Choir of the Dead', ['Revenant', 'Ghost'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['skyborne', 'bloodoath'],
    rarity: 'r', flavor: 'Admission is free; the harmony comes straight from the grave.',
  }),
  {
    id: 'gm-silvered-rapier', name: 'Silvered Rapier', types: ['artifact'], subtypes: ['Weapon'],
    cost: cost(2), colors: [],
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { subtype: 'Hunter' }, p: 1, t: 0, grantKeywords: ['firstBlade'] } }],
    rarity: 'r', flavor: 'Silver is traditional. The point is what makes it persuasive.',
  },
  {
    id: 'gm-stormtower-roof', name: 'Stormtower Roof', types: ['land'], subtypes: [], colors: [],
    entersTapped: true, manaAbility: ['U', 'B'], rarity: 'r',
    flavor: 'The roof catches storms, secrets, and the occasional ambitious gargoyle.',
  },
  {
    id: 'gm-moonmoor-estate', name: 'Moonmoor Estate', types: ['land'], subtypes: [], colors: [],
    entersTapped: true, manaAbility: ['R', 'G'], rarity: 'c',
    flavor: 'The moor has room for one more estate and no more sensible heirs.',
  },

  // =========================================================================
  // COMMON (40)
  // =========================================================================
  creature('gm-manor-thrall', 'Manor Thrall', ['Vampire', 'Servant'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 2, defense: 2, keywords: ['dreaded'],
    rarity: 'c', flavor: 'She answers every bell and none of the questions.',
  }),
  creature('gm-bat-swarm', 'Bat Swarm', ['Bat'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 2, keywords: ['skyborne'],
    rarity: 'c', flavor: 'They vote by squeak and always choose the ceiling.',
  }),
  creature('gm-wolfbitten-hunter', 'Wolfbitten Hunter', ['Hunter', 'Wolf'], {
    cost: cost(1, 'R'), colors: ['R'], attack: 2, defense: 2, keywords: ['warcry'],
    rarity: 'c', flavor: 'Fresh tracks, familiar teeth, and a firm policy of not counting her own.',
  }),
  creature('gm-lab-sparkmage', 'Lab Sparkmage', ['Mage'], {
    cost: cost(1, 'U'), colors: ['U'], attack: 1, defense: 2,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'First discovery: the spark. Second discovery: her eyebrows, briefly.',
  }),
  creature('gm-chapel-guard', 'Chapel Guard', ['Guard'], {
    cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 3, keywords: ['sentinel'],
    rarity: 'c', flavor: 'Monsters and unapproved hymn requests meet the same reception.',
  }),
  creature('gm-grave-gardener', 'Grave Gardener', ['Plant', 'Gardener'], {
    cost: cost(1, 'G'), colors: ['G'], attack: 2, defense: 2, keywords: ['wardingGaze'],
    rarity: 'c', flavor: 'Roses and rumors, pruned with the same shears.',
  }),
  {
    id: 'gm-stitched-footman', name: 'Stitched Footman', types: ['artifact', 'creature'],
    subtypes: ['Construct'], cost: cost(2, 'U'), colors: ['U'], attack: 1, defense: 4,
    keywords: ['bulwark'], rarity: 'c', flavor: 'Stands where posted. Folds where necessary.',
  },
  creature('gm-blood-drop-initiate', 'Blood-Drop Initiate', ['Vampire', 'Initiate'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 2, keywords: ['bloodoath'],
    rarity: 'c', flavor: 'She brought a thimble to a dynasty.',
  }),
  {
    id: 'gm-candlelit-seance', name: 'Candlelit Seance', types: ['ritual'], subtypes: [],
    cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'grind', n: 2, who: 'self' }, { op: 'draw', n: 1 }] }],
    rarity: 'c', flavor: 'The dead offer advice. The living take notes and lose cards.',
  },
  {
    id: 'gm-kicked-door', name: 'Kicked Door', types: ['ritual'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 2, to: 'target' }] }],
    empower: { cost: cost(1, 'R'), ops: [{ op: 'damage', n: 2, to: 'opponent' }] },
    rarity: 'c', flavor: 'The invitation said knock. She chose a more memorable entrance.',
  },
  {
    id: 'gm-silver-knife', name: 'Silver Knife', types: ['charm'], subtypes: [],
    cost: cost(1, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 1, t: 1, keywords: ['firstBlade'], scope: 'target' }] }],
    rarity: 'c', flavor: 'Small, bright, and entirely uninterested in folklore debates.',
  },
  {
    id: 'gm-fogged-window', name: 'Fogged Window', types: ['charm'], subtypes: [],
    cost: cost(1, 'U'), colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'The view is obscured. The embarrassment remains visible.',
  },
  {
    id: 'gm-rose-thorn-snare', name: 'Rose-Thorn Snare', types: ['charm'], subtypes: [],
    cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 1, t: 2, keywords: ['deathblade'], scope: 'target' }] }],
    rarity: 'c', flavor: 'The garden offers support, then asks where you plan to bleed.',
  },
  {
    id: 'gm-haunted-doll', name: 'Haunted Doll', types: ['artifact', 'creature'], subtypes: ['Doll', 'Construct'],
    cost: cost(2), colors: [], attack: 1, defense: 1, keywords: ['sentinel'],
    rarity: 'c', flavor: 'She sits very still until someone says she sits very still.',
  },
  creature('gm-crow-on-gate', 'Crow on the Gate', ['Bird'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 1, keywords: ['skyborne'],
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'One omen per customer, receipt retained.',
  }),
  creature('gm-catacomb-ratcatcher', 'Catacomb Ratcatcher', ['Rat', 'Worker'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2,
    abilities: [{ when: 'arrives', ops: [{ op: 'createToken', token: 'tok-rat', count: 1 }] }],
    rarity: 'c', flavor: 'Catching rats, raising standards, missing both on occasion.',
  }),
  creature('gm-waxwork-double', 'Waxwork Double', ['Construct', 'Figure'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 3,
    abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }],
    rarity: 'c', flavor: 'The resemblance is uncanny, especially from across the room.',
  }),
  {
    id: 'gm-red-curtain-cut', name: 'Red-Curtain Cut', types: ['charm'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 2, to: 'target' }] }],
    rarity: 'c', flavor: 'The curtain falls. The critics call it decisive.',
  },
  {
    id: 'gm-holy-water-vial', name: 'Holy Water Vial', types: ['artifact'], subtypes: ['Vial'],
    cost: cost(1, 'W'), colors: ['W'],
    abilities: [{ when: 'arrives', ops: [{ op: 'severGrave', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }] }],
    rarity: 'c', flavor: 'Blessed, bottled, and less messy than the full cathedral.',
  },
  {
    id: 'gm-moonlit-prowl', name: 'Moonlit Prowl', types: ['charm'], subtypes: [],
    cost: cost(1, 'G'), colors: ['G'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 2, t: 2, keywords: ['dreaded'], scope: 'target' }] }],
    rarity: 'c', flavor: 'The hunt begins quietly and ends with property damage.',
  },
  {
    id: 'gm-cellar-door', name: 'Cellar Door', types: ['artifact'], subtypes: ['Door'],
    cost: cost(2), colors: [], abilities: [{ when: 'dawn', ops: [{ op: 'grind', n: 1, who: 'self' }] }],
    rarity: 'c', flavor: 'It leads below, which is never the same as leading somewhere.',
  },
  creature('gm-black-cat-familiar', 'Black Cat Familiar', ['Cat', 'Familiar'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 2, keywords: ['deathblade'],
    rarity: 'c', flavor: 'She purrs at midnight and scratches at prophecy.',
  }),
  {
    id: 'gm-thunderclap', name: 'Thunderclap', types: ['charm'], subtypes: [],
    cost: cost(1, 'R'), colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 1, to: 'target' }, { op: 'foresee', n: 1 }] }],
    rarity: 'c', flavor: 'The storm has arrived. Please keep hands inside the tower.',
  },
  {
    id: 'gm-funeral-bell', name: 'Funeral Bell', types: ['artifact'], subtypes: ['Bell'],
    cost: cost(2, 'B'), colors: ['B'], abilities: [{ when: 'arrives', ops: [{ op: 'gainLife', n: 2 }] }],
    empower: { cost: cost(1, 'B'), ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] },
    rarity: 'c', flavor: 'It rings once for the dead and twice for the delighted.',
  },
  creature('gm-stitched-hound', 'Stitched Hound', ['Revenant', 'Hound'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 3, defense: 2, keywords: ['dreaded'],
    rarity: 'c', flavor: 'Fetch means the ball, the bone, or an entire subplot.',
  }),
  {
    id: 'gm-broken-mirror', name: 'Broken Mirror', types: ['artifact'], subtypes: ['Mirror'],
    cost: cost(2, 'U'), colors: ['U'], abilities: [{ when: 'arrives', ops: [{ op: 'foresee', n: 2 }] }],
    rarity: 'c', flavor: 'Seven years bad luck, two cards good planning.',
  },
  creature('gm-raven-courier', 'Raven Courier', ['Bird', 'Courier'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2, keywords: ['skyborne'],
    rarity: 'c', flavor: 'Letters delivered promptly, handwriting judged at no extra charge.',
  }),
  {
    id: 'gm-wolfbane-shot', name: 'Wolfsbane Shot', types: ['charm'], subtypes: [],
    cost: cost(2, 'W'), colors: ['W'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'sever', to: 'target' }] }],
    rarity: 'c', flavor: 'The silver is polished; the apology is still pending.',
  },
  {
    id: 'gm-blood-candle', name: 'Blood Candle', types: ['enchantment'], subtypes: ['Ritual'],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'dawn', ops: [{ op: 'damage', n: 1, to: 'controller' }, { op: 'draw', n: 1 }] }],
    rarity: 'c', flavor: 'It burns brighter whenever someone makes a poor bargain.',
  },
  {
    id: 'gm-moor-path', name: 'Moor Path', types: ['land'], subtypes: [], colors: [],
    entersTapped: true, manaAbility: ['B'], rarity: 'c', flavor: 'The path is damp, dark, and technically a shortcut.',
  },
  {
    id: 'gm-chapel-yard', name: 'Chapel Yard', types: ['land'], subtypes: [], colors: [],
    entersTapped: true, manaAbility: ['W'], rarity: 'c', flavor: 'The graves are tidy and the roses have opinions.',
  },
  {
    id: 'gm-lab-annex', name: 'Lab Annex', types: ['land'], subtypes: [], colors: [],
    entersTapped: true, manaAbility: ['U'], rarity: 'c', flavor: 'The main lab exploded, so this one is the responsible branch.',
  },
  {
    id: 'gm-red-roof-village', name: 'Red-Roof Village', types: ['land'], subtypes: [], colors: [],
    entersTapped: true, manaAbility: ['R'], rarity: 'c', flavor: 'The roofs are red from paint, weather, and one regrettable festival.',
  },
  {
    id: 'gm-thorned-cemetery', name: 'Thorned Cemetery', types: ['land'], subtypes: [], colors: [],
    entersTapped: true, manaAbility: ['G'], rarity: 'c', flavor: 'The vines keep visitors from leaving with the wrong memories.',
  },
  {
    id: 'gm-midnight-bite', name: 'Midnight Bite', types: ['charm'], subtypes: [],
    cost: cost(2, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 2, to: 'target' }, { op: 'gainLife', n: 2 }] }],
    rarity: 'c', flavor: 'A tiny puncture with an impressively large accounting department.',
  },
  {
    id: 'gm-tattered-invitation', name: 'Tattered Invitation', types: ['ritual'], subtypes: [],
    cost: cost(1, 'B'), colors: ['B'],
    abilities: [{ when: 'spell', ops: [{ op: 'discardRandom', n: 1, who: 'opponent' }] }],
    empower: { cost: cost(1, 'B'), ops: [{ op: 'damage', n: 2, to: 'opponent' }] },
    rarity: 'c', flavor: 'The paper is torn, but the insult arrives perfectly dressed.',
  },
  creature('gm-lantern-patrol', 'Lantern Patrol', ['Hunter', 'Patrol'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 2, keywords: ['firstBlade'],
    rarity: 'c', flavor: 'By the time the lantern gutters, the monsters have manners.',
  }),
  {
    id: 'gm-screaming-staircase', name: 'Screaming Staircase', types: ['artifact', 'creature'],
    subtypes: ['Construct', 'Staircase'], cost: cost(3, 'U'), colors: ['U'], attack: 1, defense: 5,
    keywords: ['bulwark'], rarity: 'c', flavor: 'Every step complains, and none of them know the whole story.',
  },
  creature('gm-grave-soil-giant', 'Grave-Soil Giant', ['Plant', 'Giant'], {
    cost: cost(5, 'G'), colors: ['G'], attack: 5, defense: 5, keywords: ['overrun'],
    rarity: 'c', flavor: 'When the harvest goes unauthorized, the garden itself rises to object.',
  }),
] satisfies readonly CardDef[];
