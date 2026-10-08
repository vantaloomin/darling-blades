import type { AbilityDef, CardDef, CardType, Color, EffectOp, Keyword, TargetSpec } from '../../engine/types';
import { cost } from '../cardTypes';

/**
 * Dark Tales, The Cursed Storybook. A value-control set where Skim stocks the
 * graveyard and Retell turns efficient Rituals and Charms into late-game
 * inevitability. The card rows mirror docs/expansions/dark-tales.md exactly.
 */
type DarkData = Omit<CardDef, 'id' | 'name' | 'types' | 'subtypes' | 'set'>;

const target = (what: TargetSpec['what']): TargetSpec[] => [{ what }];

function ability(when: AbilityDef['when'], ops: EffectOp[], targets?: TargetSpec[]): AbilityDef {
  return targets ? { when, targets, ops } : { when, ops };
}

const arrives = (ops: EffectOp[]): AbilityDef => ability('arrives', ops);
const dawn = (ops: EffectOp[]): AbilityDef => ability('dawn', ops);
const spell = (ops: EffectOp[], targets?: TargetSpec[]): AbilityDef => ability('spell', ops, targets);
const attached = (p: number, t: number, keywords?: Keyword[]): AbilityDef => ({
  when: 'static',
  static: { scope: 'attached', p, t, grantKeywords: keywords },
});
const filterStatic = (subtype: string | undefined, p: number, t: number, keywords?: Keyword[], other = false): AbilityDef => ({
  when: 'static',
  static: { scope: 'filter', filter: subtype ? { subtype, other } : { other }, p, t, grantKeywords: keywords },
});

function make(
  id: string,
  name: string,
  types: CardType[],
  subtypes: string[],
  data: DarkData,
): CardDef {
  return { id, name, types, subtypes, ...data, set: 'dark-tales' };
}

function creature(id: string, name: string, subtypes: string[], data: DarkData): CardDef {
  return make(id, name, ['creature'], subtypes, data);
}

function artifact(id: string, name: string, subtypes: string[], data: DarkData): CardDef {
  return make(id, name, ['artifact'], subtypes, data);
}

function artifactCreature(id: string, name: string, subtypes: string[], data: DarkData): CardDef {
  return make(id, name, ['artifact', 'creature'], subtypes, data);
}

function charm(id: string, name: string, data: DarkData): CardDef {
  return make(id, name, ['charm'], [], data);
}

function ritual(id: string, name: string, data: DarkData): CardDef {
  return make(id, name, ['ritual'], [], data);
}

function enchantment(id: string, name: string, subtypes: string[], data: DarkData): CardDef {
  return make(id, name, ['enchantment'], subtypes, data);
}

function land(
  id: string,
  name: string,
  manaAbility: Color[],
  rarity: DarkData['rarity'],
  abilities?: AbilityDef[],
): CardDef {
  return make(id, name, ['land'], [], {
    colors: [],
    entersTapped: true,
    manaAbility,
    ...(abilities ? { abilities } : {}),
    rarity,
  });
}

const UR: CardDef[] = [
  creature('dt-glass-coffin-queen', 'Glass-Coffin Queen', ['Human', 'Queen'], {
    supertypes: ['legendary'], cost: cost(3, 'WBB'), colors: ['W', 'B'], attack: 4, defense: 5,
    keywords: ['bloodoath'], abilities: [arrives([{ op: 'raise', to: 'top' }]), dawn([{ op: 'grind', n: 1, who: 'self' }])],
    rarity: 'ur',
  }),
  creature('dt-abyssal-songstress', 'Abyssal Songstress', ['Mermaid', 'Songstress'], {
    supertypes: ['legendary'], cost: cost(3, 'UB'), colors: ['U', 'B'], attack: 4, defense: 5,
    keywords: ['skyborne'], abilities: [dawn([{ op: 'foresee', n: 1 }, { op: 'loseLife', n: 1, who: 'opponent' }])],
    rarity: 'ur',
  }),
  creature('dt-thorn-palace-heiress', 'Thorn-Palace Heiress', ['Human', 'Princess'], {
    supertypes: ['legendary'], cost: cost(4, 'GW'), colors: ['G', 'W'], attack: 4, defense: 6,
    keywords: ['sentinel'], awakening: { p: 2, t: 2, keywords: ['overrun'] },
    abilities: [dawn([{ op: 'awaken', scope: 'self' }])],
    rarity: 'ur',
  }),
  creature('dt-midnight-glass-runner', 'Midnight Glass Runner', ['Human', 'Runner'], {
    supertypes: ['legendary'], cost: cost(0, 'UR'), colors: ['U', 'R'], attack: 3, defense: 3,
    keywords: ['warcry'], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'foresee', n: 2 }])],
    rarity: 'ur',
  }),
  creature('dt-ice-crown-sovereign', 'Ice-Crown Sovereign', ['Human', 'Queen'], {
    supertypes: ['legendary'], cost: cost(3, 'UW'), colors: ['U', 'W'], attack: 4, defense: 4,
    keywords: ['skyborne'], abilities: [arrives([{ op: 'massDestroy', filter: 'allEnchantments' }])],
    rarity: 'ur',
  }),
];

const SSR: CardDef[] = [
  creature('dt-poison-mirror-regent', 'Poison-Mirror Regent', ['Human', 'Regent'], {
    supertypes: ['legendary'], cost: cost(4, 'BB'), colors: ['B'], attack: 4, defense: 4,
    keywords: ['deathblade', 'untouchable'], abilities: [dawn([{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }])],
    rarity: 'ssr',
  }),
  creature('dt-lantern-tower-witch', 'Lantern-Tower Witch', ['Human', 'Witch'], {
    supertypes: ['legendary'], cost: cost(3, 'UR'), colors: ['U', 'R'], attack: 4, defense: 4,
    skim: { cost: cost(2) }, abilities: [arrives([{ op: 'damage', n: 2, to: 'opponent' }, { op: 'draw', n: 1 }])],
    rarity: 'ssr',
  }),
  creature('dt-beast-manor-belle', "Belle of the Beast Manor", ['Human', 'Scholar'], {
    supertypes: ['legendary'], cost: cost(5, 'WG'), colors: ['W', 'G'], attack: 4, defense: 5,
    keywords: ['bloodoath'], abilities: [arrives([{ op: 'grind', n: 2, who: 'self' }, { op: 'draw', n: 1 }])],
    rarity: 'ssr',
  }),
  ritual('dt-sleeping-curse', 'The Sleeping Curse', {
    cost: cost(4, 'B'), colors: ['B'],
    abilities: [spell([{ op: 'massDestroy', filter: 'allCreatures' }])],
    // No ops override on Retell (user amendment 2026-07-30): the original
    // override was preventCombat, which is engine-dead on a Ritual (a Ritual
    // resolves only in your own main phase and the fog flag clears before the
    // opponent's combat), so Retell resolved nothing at all. With the override
    // gone, resolve.ts falls through to the printed body: a second wrath for
    // seven total mana, the flashback pattern.
    retell: { cost: cost(6, 'B') },
    rarity: 'ssr',
  }),
  artifact('dt-storybook-of-ashes', 'Storybook of Ashes', ['Book'], {
    supertypes: ['legendary'], cost: cost(6), colors: [],
    abilities: [dawn([{ op: 'grind', n: 1, who: 'self' }, { op: 'draw', n: 1 }])],
    rarity: 'ssr',
  }),
  creature('dt-desert-wish-princess', 'Desert-Wish Princess', ['Human', 'Princess'], {
    supertypes: ['legendary'], cost: cost(3, 'WR'), colors: ['W', 'R'], attack: 4, defense: 4,
    keywords: ['skyborne', 'warcry'], abilities: [arrives([{ op: 'foresee', n: 2 }])],
    rarity: 'ssr',
  }),
  creature('dt-warrior-ballad-captain', 'Warrior-Ballad Captain', ['Human', 'Warrior'], {
    supertypes: ['legendary'], cost: cost(3, 'WR'), colors: ['W', 'R'], attack: 4, defense: 4,
    keywords: ['firstBlade', 'sentinel'], abilities: [filterStatic(undefined, 1, 0, undefined, true)],
    rarity: 'ssr',
  }),
  creature('dt-bayou-star-proprietor', 'Bayou-Star Proprietor', ['Human', 'Proprietor'], {
    supertypes: ['legendary'], cost: cost(6, 'WG'), colors: ['W', 'G'], attack: 3, defense: 5,
    keywords: ['bloodoath'], abilities: [arrives([{ op: 'createToken', token: 'tok-firefly', count: 2 }])],
    skim: { cost: cost(2) }, rarity: 'ssr',
  }),
];

const SR: CardDef[] = [
  ritual('dt-sea-witch-contract', 'Sea-Witch Contract', {
    cost: cost(2, 'B'), colors: ['B'], abilities: [spell([{ op: 'draw', n: 2 }, { op: 'damage', n: 2, to: 'controller' }])],
    retell: { cost: cost(4, 'B') }, rarity: 'sr',
  }),
  // Owner-ruled 2026-08-29: goes {U}{B} AND legendary, so the multicolour
  // nonland invariant holds. (Was parked mono-blue while colour-vs-legendary
  // was an open question.)
  ritual('dt-glass-slipper-at-midnight', 'Glass Slipper at Midnight', {
    supertypes: ['legendary'],
    cost: cost(0, 'UB'), colors: ['U', 'B'], skim: { cost: cost(1) },
    abilities: [spell([{ op: 'boost', p: 1, t: 1, keywords: ['dreaded'], scope: 'allYours' }])],
    rarity: 'sr',
  }),
  creature('dt-red-hood-wolfslayer', 'Red Hood Wolfslayer', ['Human', 'Hunter'], {
    supertypes: ['legendary'], cost: cost(2, 'RG'), colors: ['R', 'G'], attack: 4, defense: 4,
    keywords: ['firstBlade', 'overrun'], rarity: 'sr',
  }),
  enchantment('dt-rose-cage-ballad', 'Rose-Cage Ballad', [], {
    cost: cost(3, 'B'), colors: ['B'], abilities: [dawn([{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }])],
    rarity: 'sr',
  }),
  charm('dt-tower-braid-escape', 'Tower-Braid Escape', {
    cost: cost(0, 'U'), colors: ['U'], abilities: [spell([{ op: 'recall', to: 'target' }], target('creature'))],
    retell: { cost: cost(4, 'U') }, rarity: 'sr',
  }),
  ritual('dt-apple-of-endless-sleep', 'Apple of Endless Sleep', {
    cost: cost(2, 'B'), colors: ['B'], abilities: [spell([{ op: 'sever', to: 'target' }], target('creature'))],
    skim: { cost: cost(1) }, rarity: 'sr',
  }),
  creature('dt-winter-palace-duchess', 'Winter-Palace Duchess', ['Human', 'Duchess'], {
    supertypes: ['legendary'], cost: cost(3, 'UW'), colors: ['U', 'W'], attack: 3, defense: 5,
    keywords: ['untouchable'], abilities: [dawn([{ op: 'foresee', n: 1 }])], rarity: 'sr',
  }),
  creature('dt-ocean-wayfinder', 'Ocean Wayfinder', ['Human', 'Wayfinder'], {
    supertypes: ['legendary'], cost: cost(2, 'UG'), colors: ['U', 'G'], attack: 3, defense: 4,
    abilities: [arrives([{ op: 'extraLandDrop' }, { op: 'foresee', n: 1 }])], skim: { cost: cost(2) }, rarity: 'sr',
  }),
  creature('dt-forest-colors-diplomat', 'Forest-Colors Diplomat', ['Human', 'Diplomat'], {
    supertypes: ['legendary'], cost: cost(2, 'GW'), colors: ['G', 'W'], attack: 3, defense: 5,
    keywords: ['sentinel'], abilities: [arrives([{ op: 'foresee', n: 2 }, { op: 'gainLife', n: 2 }])], rarity: 'sr',
  }),
  creature('dt-brave-highland-archer', 'Brave Highland Archer', ['Human', 'Archer'], {
    supertypes: ['legendary'], cost: cost(3, 'RG'), colors: ['R', 'G'], attack: 4, defense: 4,
    keywords: ['wardingGaze', 'firstBlade'], skim: { cost: cost(2) }, rarity: 'sr',
  }),
  creature('dt-casita-miracle-keeper', 'Casita Miracle Keeper', ['Human', 'Keeper'], {
    supertypes: ['legendary'], cost: cost(4, 'WG'), colors: ['W', 'G'], attack: 3, defense: 5,
    abilities: [arrives([{ op: 'createToken', token: 'tok-hearth-spirit', count: 1 }]), dawn([{ op: 'foresee', n: 1 }])],
    rarity: 'sr',
  }),
];

const R: CardDef[] = [
  creature('dt-ash-maiden', 'Ash Maiden', ['Human', 'Maiden'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 2, defense: 2, keywords: ['warcry'], skim: { cost: cost(1) }, rarity: 'r',
  }),
  creature('dt-pearl-foam-diver', 'Pearl-Foam Diver', ['Mermaid', 'Diver'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2, keywords: ['dreaded'], skim: { cost: cost(1) }, rarity: 'r',
  }),
  creature('dt-thorn-castle-warden', 'Thorn-Castle Warden', ['Plant', 'Warden'], {
    cost: cost(2, 'G'), colors: ['G'], attack: 2, defense: 5, keywords: ['bulwark', 'wardingGaze'], rarity: 'r',
  }),
  enchantment('dt-mirror-apple-curse', 'Mirror-Apple Curse', ['Aura'], {
    cost: cost(1, 'B'), colors: ['B'], abilities: [attached(-2, -2)], skim: { cost: cost(1) }, rarity: 'r',
  }),
  ritual('dt-midnight-coach', 'Midnight Coach', {
    cost: cost(2), colors: [], skim: { cost: cost(1) },
    abilities: [spell([{ op: 'boost', p: 1, t: 0, keywords: ['warcry'], scope: 'allYours' }])], rarity: 'r',
  }),
  creature('dt-fairy-godmother-noir', 'Noir Godmother', ['Human', 'Godmother'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 3,
    abilities: [arrives([{ op: 'foresee', n: 1 }, { op: 'draw', n: 1 }])], rarity: 'r',
  }),
  enchantment('dt-beast-library', "Beast's Library", ['Library'], {
    cost: cost(1, 'U'), colors: ['U'],
    abilities: [arrives([{ op: 'foresee', n: 2 }]), dawn([{ op: 'foresee', n: 1 }])], rarity: 'r',
  }),
  creature('dt-seven-shadow-miners', 'Seven Shadow Miners', ['Dwarf', 'Miner'], {
    cost: cost(4, 'B'), colors: ['B'], attack: 3, defense: 3,
    abilities: [arrives([{ op: 'createToken', token: 'tok-shadow-miner', count: 2 }, { op: 'grind', n: 2, who: 'self' }])], rarity: 'r',
  }),
  artifact('dt-seafoam-dagger', 'Seafoam Dagger', ['Weapon'], {
    cost: cost(2, 'B'), colors: ['B'], abilities: [filterStatic('Mermaid', 1, 0, ['deathblade'])], rarity: 'r',
  }),
  charm('dt-briar-rose-lullaby', 'Briar-Rose Lullaby', {
    cost: cost(0, 'U'), colors: ['U'], abilities: [spell([{ op: 'tap', to: 'target' }, { op: 'foresee', n: 1 }], target('creature'))],
    retell: { cost: cost(2, 'U') }, rarity: 'r',
  }),
  creature('dt-wolf-at-the-door', 'Wolf at the Door', ['Wolf', 'Predator'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 3, defense: 2, keywords: ['dreaded', 'warcry'], rarity: 'r',
  }),
  ritual('dt-cursed-ball-invite', 'Cursed Ball Invite', {
    cost: cost(0, 'B'), colors: ['B'], abilities: [spell([{ op: 'discardRandom', n: 1, who: 'opponent' }])],
    retell: { cost: cost(4, 'B') }, rarity: 'r',
  }),
  creature('dt-glass-stair-duelist', 'Glass-Stair Duelist', ['Human', 'Duelist'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['firstBlade'], skim: { cost: cost(1) }, rarity: 'r',
  }),
  ritual('dt-undersea-bargain', 'Undersea Bargain', {
    cost: cost(2, 'U'), colors: ['U'], abilities: [spell([{ op: 'draw', n: 2 }])], skim: { cost: cost(1) }, rarity: 'r',
  }),
  artifact('dt-thirteenth-spindle', 'Thirteenth Spindle', ['Relic'], {
    cost: cost(1, 'B'), colors: ['B'], abilities: [dawn([{ op: 'damage', n: 1, to: 'opponent' }, { op: 'grind', n: 1, who: 'self' }])], rarity: 'r',
  }),
  charm('dt-mirror-hall-illusion', 'Mirror-Hall Illusion', {
    cost: cost(1, 'U'), colors: ['U'], abilities: [spell([{ op: 'recall', to: 'target' }, { op: 'foresee', n: 1 }], target('creature'))],
    skim: { cost: cost(1) }, rarity: 'r',
  }),
  enchantment('dt-gilded-cage', 'Gilded Cage', ['Aura'], {
    cost: cost(0, 'W'), colors: ['W'], abilities: [attached(-2, 0, ['bulwark'])], rarity: 'r',
  }),
  creature('dt-rose-petal-knight', 'Rose-Petal Knight', ['Human', 'Knight'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['sentinel', 'bloodoath'], rarity: 'r',
  }),
  ritual('dt-clock-strikes-twelve', 'Clock Strikes Twelve', {
    cost: cost(2, 'R'), colors: ['R'], abilities: [spell([{ op: 'damage', n: 3, to: 'target' }], target('any'))],
    retell: { cost: cost(3, 'R') }, rarity: 'r',
  }),
  land('dt-ash-ballroom', 'Ash Ballroom', ['U', 'R'], 'r'),
  artifact('dt-haunted-storybook', 'Haunted Storybook', ['Book'], {
    cost: cost(3), colors: [], abilities: [arrives([{ op: 'foresee', n: 1 }, { op: 'draw', n: 1 }])], hauntlink: { cost: cost(2), linked: { p: 1, grantKeywords: ['dreaded'] } }, rarity: 'r',
  }),
  creature('dt-princess-of-thorns', 'Princess of Thorns', ['Human', 'Princess'], {
    cost: cost(3, 'G'), colors: ['G'], attack: 3, defense: 3, keywords: ['sentinel', 'wardingGaze'], rarity: 'r',
  }),
  creature('dt-black-glass-raven', 'Black-Glass Raven', ['Bird', 'Raven'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 1, keywords: ['skyborne'], skim: { cost: cost(1) }, rarity: 'r',
  }),
  creature('dt-foam-silk-siren', 'Foam-Silk Siren', ['Mermaid', 'Siren'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 3, keywords: ['skyborne'], abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'r',
  }),
  enchantment('dt-lamp-lit-balcony', 'Lamp-Lit Balcony', ['Balcony'], {
    cost: cost(2, 'R'), colors: ['R'], skim: { cost: cost(1) }, abilities: [dawn([{ op: 'damage', n: 1, to: 'opponent' }, { op: 'foresee', n: 1 }])], rarity: 'r',
  }),
  creature('dt-sandstorm-carpet-rider', 'Sandstorm Carpet Rider', ['Human', 'Rider'], {
    cost: cost(3, 'R'), colors: ['R'], attack: 3, defense: 2, keywords: ['skyborne', 'warcry'], skim: { cost: cost(1) }, rarity: 'r',
  }),
  creature('dt-ice-palace-architect', 'Ice-Palace Architect', ['Human', 'Architect'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 3, defense: 4, abilities: [arrives([{ op: 'foresee', n: 1 }]), dawn([{ op: 'grind', n: 1, who: 'self' }])], rarity: 'r',
  }),
  make('dt-snowflake-gate', 'Snowflake Gate', ['ritual'], ['Gate'], {
    cost: cost(1, 'U'), colors: ['U'], skim: { cost: cost(1) }, abilities: [spell([{ op: 'draw', n: 1 }])], rarity: 'r',
  }),
  creature('dt-honor-blade-captain', 'Honor-Blade Captain', ['Human', 'Captain'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['firstBlade'],
    abilities: [arrives([{ op: 'boost', p: 1, t: 0, scope: 'allYours' }])], rarity: 'r',
  }),
  land('dt-reflection-pond', 'Reflection Pond', ['W', 'R'], 'r'),
  ritual('dt-bayou-masquerade', 'Bayou Masquerade', {
    cost: cost(5, 'B'), colors: ['B'], abilities: [spell([{ op: 'createToken', token: 'tok-firefly', count: 2 }])],
    retell: { cost: cost(6, 'B') }, rarity: 'r',
  }),
  creature('dt-frog-prince-bargain', 'Frog-Prince Bargain', ['Frog', 'Noble'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 3, abilities: [arrives([{ op: 'draw', n: 1 }])], skim: { cost: cost(1) }, rarity: 'r',
  }),
  make('dt-verdant-heart-voyage', 'Verdant-Heart Voyage', ['ritual'], ['Relic'], {
    cost: cost(1, 'G'), colors: ['G'], abilities: [spell([{ op: 'extraLandDrop' }])], skim: { cost: cost(1) }, rarity: 'r',
  }),
  creature('dt-wave-skiff-runner', 'Wave-Skiff Runner', ['Human', 'Sailor'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2, keywords: ['dreaded'], skim: { cost: cost(1) }, rarity: 'r',
  }),
  creature('dt-wind-painted-scout', 'Wind-Painted Scout', ['Human', 'Scout'], {
    cost: cost(3, 'G'), colors: ['G'], attack: 2, defense: 4, keywords: ['sentinel'], abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'r',
  }),
  creature('dt-dragon-gem-guardian', 'Dragon-Gem Guardian', ['Human', 'Guardian'], {
    cost: cost(3, 'R'), colors: ['R'], attack: 3, defense: 3, keywords: ['firstBlade', 'warcry'], rarity: 'r',
  }),
];

const C: CardDef[] = [
  charm('dt-spindle-prick', 'Spindle Prick', { cost: cost(1, 'B'), colors: ['B'], abilities: [spell([{ op: 'damage', n: 1, to: 'target' }, { op: 'tap', to: 'target' }], target('creature'))], rarity: 'c' }),
  creature('dt-pumpkin-attendant', 'Pumpkin Attendant', ['Human', 'Attendant'], { cost: cost(1, 'R'), colors: ['R'], attack: 2, defense: 1, keywords: ['warcry'], rarity: 'c' }),
  artifactCreature('dt-glass-mouse', 'Glass Mouse', ['Mouse', 'Helper'], { cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 2, keywords: ['sentinel'], rarity: 'c' }),
  creature('dt-castle-scullery', 'Castle Scullery', ['Human', 'Worker'], { cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3, abilities: [arrives([{ op: 'gainLife', n: 2 }])], rarity: 'c' }),
  creature('dt-seafoam-messenger', 'Seafoam Messenger', ['Mermaid', 'Messenger'], { cost: cost(1, 'U'), colors: ['U'], attack: 1, defense: 2, skim: { cost: cost(1) }, rarity: 'c' }),
  creature('dt-briar-sentinel', 'Briar Sentinel', ['Plant', 'Sentinel'], { cost: cost(2, 'G'), colors: ['G'], attack: 2, defense: 3, keywords: ['wardingGaze'], rarity: 'c' }),
  creature('dt-poisoned-courtier', 'Poisoned Courtier', ['Human', 'Courtier'], { cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2, keywords: ['deathblade'], rarity: 'c' }),
  creature('dt-red-cloak-runner', 'Red-Cloak Runner', ['Human', 'Hunter'], { cost: cost(1, 'R'), colors: ['R'], attack: 2, defense: 1, keywords: ['warcry'], rarity: 'c' }),
  creature('dt-tower-window-seer', 'Tower-Window Seer', ['Human', 'Seer'], { cost: cost(2, 'U'), colors: ['U'], attack: 1, defense: 3, abilities: [arrives([{ op: 'foresee', n: 1 }])], skim: { cost: cost(1) }, rarity: 'c' }),
  make('dt-satin-slipper', 'Satin Slipper', ['ritual'], ['Relic'], { cost: cost(1), colors: [], skim: { cost: cost(1) }, abilities: [spell([{ op: 'boost', p: 1, t: 1, scope: 'target' }], target('yourCreature'))], rarity: 'c' }),
  charm('dt-page-torn-free', 'Page Torn Free', { cost: cost(2, 'U'), colors: ['U'], abilities: [spell([{ op: 'draw', n: 1 }])], retell: { cost: cost(2, 'U') }, rarity: 'c' }),
  charm('dt-once-more-with-magic', 'Once More With Magic', { cost: cost(0, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 1, t: 1, scope: 'target' }], target('creature'))], retell: { cost: cost(2, 'W') }, rarity: 'c' }),
  ritual('dt-wicked-step', 'Wicked Step', { cost: cost(0, 'B'), colors: ['B'], abilities: [spell([{ op: 'discardRandom', n: 1, who: 'opponent' }])], rarity: 'c' }),
  charm('dt-rose-vine-snare', 'Rose-Vine Snare', { cost: cost(0, 'G'), colors: ['G'], abilities: [spell([{ op: 'boost', p: 2, t: 2, scope: 'target' }], target('creature'))], rarity: 'c' }),
  enchantment('dt-candle-in-window', 'Candle in the Window', [], { cost: cost(0, 'W'), colors: ['W'], abilities: [dawn([{ op: 'gainLife', n: 1 }])], rarity: 'c' }),
  artifact('dt-ink-black-carriage', 'Ink-Black Carriage', ['Vehicle'], { cost: cost(0, 'B'), colors: ['B'], abilities: [{ when: 'dawn', ops: [{ op: 'grind', n: 1, who: 'self' }, { op: 'loseLife', n: 1, who: 'opponent' }] }], rarity: 'c' }),
  charm('dt-sea-glass-knife', 'Sea-Glass Knife', { cost: cost(0, 'U'), colors: ['U'], abilities: [spell([{ op: 'recall', to: 'target' }], target('creature'))], rarity: 'c' }),
  ritual('dt-ash-sweep', 'Ash Sweep', { cost: cost(1, 'R'), colors: ['R'], abilities: [spell([{ op: 'damage', n: 2, to: 'target' }, { op: 'grind', n: 2, who: 'self' }], target('any'))], rarity: 'c' }),
  make('dt-bookmark-charm', 'Bookmark Charm', ['ritual'], ['Relic'], { cost: cost(1), colors: [], skim: { cost: cost(1) }, abilities: [spell([{ op: 'foresee', n: 2 }, { op: 'grind', n: 1, who: 'self' }])], rarity: 'c' }),
  ritual('dt-lost-in-library', 'Lost in the Library', { cost: cost(1, 'U'), colors: ['U'], abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }, { op: 'grind', n: 2, who: 'self' }] }], rarity: 'c' }),
  enchantment('dt-cursed-rose', 'Cursed Rose', ['Aura'], { cost: cost(0, 'B'), colors: ['B'], abilities: [attached(-1, -1)], skim: { cost: cost(1) }, rarity: 'c' }),
  artifact('dt-mirror-shard', 'Mirror Shard', ['Relic'], { cost: cost(1, 'U'), colors: ['U'], abilities: [arrives([{ op: 'foresee', n: 1 }])], hauntlink: { cost: cost(1, 'U'), linked: { p: 1, grantKeywords: ['untouchable'] } }, rarity: 'c' }),
  make('dt-silver-fishbone', 'Silver Fishbone', ['ritual'], ['Relic'], { cost: cost(0, 'B'), colors: ['B'], skim: { cost: cost(1) }, abilities: [spell([{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }])], rarity: 'c' }),
  land('dt-dreaming-castle', 'Dreaming Castle', ['G', 'W'], 'c'),
  land('dt-tide-cavern', 'Tide Cavern', ['U', 'B'], 'c'),
  artifact('dt-wolf-path', 'Wolf-Path Charm', [], { cost: cost(0, 'G'), colors: ['G'], activated: { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] }, rarity: 'c' }),
  artifact('dt-palace-steps', 'Glass Slipper', [], { cost: cost(0, 'W'), colors: ['W'], activated: { cost: { tap: true, mana: cost(1) }, ops: [{ op: 'gainLife', n: 2 }] }, rarity: 'c' }),
  artifact('dt-midnight-road', 'Midnight Invitation', [], { cost: cost(0, 'B'), colors: ['B'], activated: { cost: { tap: true }, ops: [{ op: 'grind', n: 1, who: 'self' }] }, rarity: 'c' }),
  artifact('dt-sea-cave', 'Sea-Cave Pearl', [], { cost: cost(0, 'U'), colors: ['U'], activated: { cost: { tap: true }, ops: [{ op: 'foresee', n: 1 }] }, rarity: 'c' }),
  artifact('dt-hearth-cinders', 'Banked Cinders', [], { cost: cost(1, 'R'), colors: ['R'], activated: { cost: { tap: true }, ops: [{ op: 'damage', n: 1, to: 'opponent' }] }, rarity: 'c' }),
  charm('dt-dream-prick', 'Dream Prick', { cost: cost(0, 'U'), colors: ['U'], abilities: [spell([{ op: 'tap', to: 'target' }, { op: 'grind', n: 1, who: 'self' }], target('creature'))], rarity: 'c' }),
  charm('dt-rose-petal-shield', 'Rose-Petal Shield', { cost: cost(0, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 0, t: 2, scope: 'target' }], target('creature'))], retell: { cost: cost(2, 'W') }, rarity: 'c' }),
  make('dt-singing-shell', 'Singing Shell', ['ritual'], ['Relic'], { cost: cost(0, 'U'), colors: ['U'], skim: { cost: cost(1) }, abilities: [spell([{ op: 'foresee', n: 2 }])], rarity: 'c' }),
  creature('dt-forest-grandmother', 'Forest Grandmother', ['Human', 'Elder'], { cost: cost(3, 'G'), colors: ['G'], attack: 2, defense: 4, abilities: [arrives([{ op: 'gainLife', n: 2 }, { op: 'foresee', n: 1 }])], rarity: 'c' }),
  creature('dt-gilded-stepmother', 'Gilded Stepmother', ['Human', 'Courtier'], { cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2, abilities: [arrives([{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }])], rarity: 'c' }),
  ritual('dt-palace-masquerade', 'Palace Masquerade', { cost: cost(2, 'W'), colors: ['W'], abilities: [spell([{ op: 'createToken', token: 'tok-masked-guest', count: 2 }, { op: 'foresee', n: 1 }])], rarity: 'c' }),
  make('dt-ragged-ballgown', 'Ragged Ballgown', ['ritual'], ['Relic'], { cost: cost(1), colors: [], skim: { cost: cost(1) }, abilities: [spell([{ op: 'gainLife', n: 2 }])], rarity: 'c' }),
  ritual('dt-forked-road-choice', 'Forked-Road Choice', { cost: cost(2, 'G'), colors: ['G'], abilities: [spell([{ op: 'extraLandDrop' }, { op: 'foresee', n: 1 }])], rarity: 'c' }),
  charm('dt-lullaby-refrain', 'Lullaby Refrain', { cost: cost(0, 'U'), colors: ['U'], abilities: [spell([{ op: 'tap', to: 'target' }], target('creature'))], retell: { cost: cost(2, 'U') }, rarity: 'c' }),
  make('dt-apple-basket', 'Apple Basket', ['ritual'], ['Relic'], { cost: cost(0, 'G'), colors: ['G'], skim: { cost: cost(1) }, abilities: [spell([{ op: 'gainLife', n: 3 }])], rarity: 'c' }),
  artifact('dt-ice-lace-gloves', 'Ice-Lace Gloves', ['Relic'], { cost: cost(2), colors: [], skim: { cost: cost(1) }, abilities: [dawn([{ op: 'severGrave', n: 1, who: 'opponent' }])], rarity: 'c' }),
  creature('dt-snowcourt-attendant', 'Snowcourt Attendant', ['Human', 'Attendant'], { cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2, abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'c' }),
  artifact('dt-winter-bridge', 'Winter-Bridge Toll', [], { cost: cost(0, 'U'), colors: ['U'], activated: { cost: { tap: true }, ops: [{ op: 'severGrave', n: 1, who: 'opponent' }] }, rarity: 'c' }),
  ritual('dt-palace-market-chase', 'Palace-Market Chase', { cost: cost(1, 'R'), colors: ['R'], abilities: [spell([{ op: 'damage', n: 2, to: 'target' }], target('any'))], skim: { cost: cost(1) }, rarity: 'c' }),
  make('dt-brass-lamp-charm', 'Brass Lamp Charm', ['ritual'], ['Relic'], { cost: cost(1), colors: [], skim: { cost: cost(1) }, abilities: [spell([{ op: 'foresee', n: 1 }])], rarity: 'c' }),
  artifact('dt-desert-rooftop', 'Rooftop Spyglass', [], { cost: cost(0, 'R'), colors: ['R'], activated: { cost: { tap: true, mana: cost(1) }, ops: [{ op: 'foresee', n: 2 }] }, rarity: 'c' }),
  ritual('dt-reflection-sword', 'Reflection Sword', { cost: cost(0, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 1, t: 0, keywords: ['firstBlade'], scope: 'allYours' }])], rarity: 'c' }),
  charm('dt-training-yard-dawn', 'Training-Yard Dawn', { cost: cost(0, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 1, t: 1, scope: 'target' }, { op: 'foresee', n: 1 }], target('creature'))], rarity: 'c' }),
  charm('dt-ancestor-smoke', "Ancestor's Smoke", { cost: cost(0, 'W'), colors: ['W'], abilities: [spell([{ op: 'foresee', n: 2 }])], retell: { cost: cost(4, 'W') }, rarity: 'c' }),
  artifact('dt-bayou-lantern', 'Bayou Lantern', ['Relic'], { cost: cost(1, 'G'), colors: ['G'], skim: { cost: cost(1) }, abilities: [dawn([{ op: 'gainLife', n: 2 }])], rarity: 'c' }),
  artifact('dt-crescent-cookpot', 'Crescent Cookpot', ['Relic'], { cost: cost(2), colors: [], abilities: [arrives([{ op: 'foresee', n: 1 }]), dawn([{ op: 'gainLife', n: 1 }])], rarity: 'c' }),
  land('dt-riverboat-kitchen', 'Riverboat Kitchen', ['G', 'B'], 'c'),
  artifact('dt-wayfinder-oar', 'Wayfinder Oar', ['Relic'], { cost: cost(1, 'U'), colors: ['U'], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'foresee', n: 2 }]), dawn([{ op: 'grind', n: 1, who: 'self' }])], rarity: 'c' }),
  charm('dt-lagoon-current', 'Lagoon Current', { cost: cost(1, 'U'), colors: ['U'], abilities: [spell([{ op: 'recall', to: 'target' }, { op: 'foresee', n: 1 }], target('creature'))], rarity: 'c' }),
  land('dt-oceanic-islet', 'Oceanic Islet', ['U', 'G'], 'c'),
  ritual('dt-windblown-leaf-paint', 'Windblown Leaf-Paint', { cost: cost(1, 'G'), colors: ['G'], abilities: [spell([{ op: 'foresee', n: 2 }, { op: 'gainLife', n: 2 }])], rarity: 'c' }),
  artifact('dt-riverbend-trail', 'Riverbend Waterwheel', [], { cost: cost(2, 'G'), colors: ['G'], activated: { cost: { tap: true, mana: cost(3) }, targets: [{ what: 'yourGraveCreature' }], ops: [{ op: 'reclaim' }] }, rarity: 'c' }),
  charm('dt-plaid-arrow', 'Plaid Arrow', { cost: cost(0, 'G'), colors: ['G'], abilities: [spell([{ op: 'boost', p: 1, t: 1, keywords: ['wardingGaze'], scope: 'target' }], target('creature'))], rarity: 'c' }),
  make('dt-casita-door-charm', 'Casita Door Charm', ['ritual'], ['Relic'], { cost: cost(1, 'W'), colors: ['W'], abilities: [spell([{ op: 'createToken', token: 'tok-hearth-spirit', count: 1 }, { op: 'foresee', n: 1 }])], rarity: 'c' }),
  make('dt-jade-dragon-scale', 'Jade Dragon Egg', ['ritual'], ['Relic'], { cost: cost(1), colors: ['G'], skim: { cost: cost(1) }, abilities: [spell([{ op: 'foresee', n: 1 }])], rarity: 'c' }),
];

/** The 120 collectible rows in the spec's rarity order. */
export const DARK_TALES = [...UR, ...SSR, ...SR, ...R, ...C] as const satisfies readonly CardDef[];
