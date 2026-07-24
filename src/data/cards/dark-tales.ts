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

function land(id: string, name: string, manaAbility: Color[], rarity: DarkData['rarity'], flavor: string): CardDef {
  return make(id, name, ['land'], [], {
    colors: [],
    entersTapped: true,
    manaAbility,
    rarity,
    flavor,
  });
}

const UR: CardDef[] = [
  creature('dt-glass-coffin-queen', 'Glass-Coffin Queen', ['Human', 'Queen'], {
    supertypes: ['legendary'], cost: cost(5, 'WB'), colors: ['W', 'B'], attack: 4, defense: 5,
    keywords: ['bloodoath'], abilities: [arrives([{ op: 'raise', to: 'top' }]), dawn([{ op: 'grind', n: 1, who: 'self' }])],
    rarity: 'ur', flavor: 'The coffin was transparent so the court could watch her return.',
  }),
  creature('dt-abyssal-songstress', 'Abyssal Songstress', ['Mermaid', 'Songstress'], {
    supertypes: ['legendary'], cost: cost(5, 'UB'), colors: ['U', 'B'], attack: 4, defense: 5,
    keywords: ['skyborne'], abilities: [dawn([{ op: 'foresee', n: 1 }, { op: 'loseLife', n: 1, who: 'opponent' }])],
    rarity: 'ur', flavor: 'Every bargain sounds kinder when sung below the tide line.',
  }),
  creature('dt-thorn-palace-heiress', 'Thorn-Palace Heiress', ['Human', 'Princess'], {
    supertypes: ['legendary'], cost: cost(5, 'GW'), colors: ['G', 'W'], attack: 4, defense: 6,
    keywords: ['sentinel'], awakening: { p: 2, t: 2, keywords: ['overrun'] },
    abilities: [dawn([{ op: 'awaken', scope: 'self' }])],
    rarity: 'ur', flavor: 'The palace slept for a century. Its heir woke with the keys.',
  }),
  creature('dt-midnight-glass-runner', 'Midnight Glass Runner', ['Human', 'Runner'], {
    supertypes: ['legendary'], cost: cost(4, 'UR'), colors: ['U', 'R'], attack: 4, defense: 3,
    keywords: ['warcry'], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'foresee', n: 2 }])],
    rarity: 'ur', flavor: 'The last chime is a deadline, not a suggestion.',
  }),
  creature('dt-ice-crown-sovereign', 'Ice-Crown Sovereign', ['Human', 'Queen'], {
    supertypes: ['legendary'], cost: cost(6, 'UW'), colors: ['U', 'W'], attack: 4, defense: 6,
    keywords: ['skyborne'], abilities: [arrives([{ op: 'preventCombat' }]), dawn([{ op: 'foresee', n: 1 }])],
    rarity: 'ur', flavor: 'The coronation froze the room, the vows, and every exit.',
  }),
];

const SSR: CardDef[] = [
  creature('dt-poison-mirror-regent', 'Poison-Mirror Regent', ['Human', 'Regent'], {
    supertypes: ['legendary'], cost: cost(4, 'B'), colors: ['B'], attack: 4, defense: 4,
    keywords: ['deathblade', 'untouchable'], abilities: [dawn([{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }])],
    rarity: 'ssr', flavor: 'The mirror never lies. It simply chooses a crueler truth.',
  }),
  creature('dt-lantern-tower-witch', 'Lantern-Tower Witch', ['Human', 'Witch'], {
    supertypes: ['legendary'], cost: cost(4, 'UR'), colors: ['U', 'R'], attack: 4, defense: 4,
    skim: { cost: cost(2) }, abilities: [arrives([{ op: 'damage', n: 2, to: 'opponent' }, { op: 'draw', n: 1 }])],
    rarity: 'ssr', flavor: 'Her hair reached the tower roof before her patience did.',
  }),
  creature('dt-beast-manor-belle', "Belle of the Beast Manor", ['Human', 'Scholar'], {
    supertypes: ['legendary'], cost: cost(5, 'WG'), colors: ['W', 'G'], attack: 4, defense: 5,
    keywords: ['bloodoath'], abilities: [arrives([{ op: 'grind', n: 2, who: 'self' }, { op: 'draw', n: 1 }])],
    rarity: 'ssr', flavor: "She read the manor's history and stayed for the footnotes.",
  }),
  ritual('dt-sleeping-curse', 'The Sleeping Curse', {
    cost: cost(5, 'B'), colors: ['B'],
    abilities: [spell([{ op: 'massDestroy', filter: 'allCreatures' }])],
    retell: { cost: cost(6, 'B'), ops: [{ op: 'preventCombat' }] },
    rarity: 'ssr', flavor: 'The first telling fells the court. The echo only dims the candles.',
  }),
  artifact('dt-storybook-of-ashes', 'Storybook of Ashes', ['Book'], {
    supertypes: ['legendary'], cost: cost(4), colors: [],
    abilities: [dawn([{ op: 'grind', n: 1, who: 'self' }, { op: 'draw', n: 1 }])],
    rarity: 'ssr', flavor: 'Every burned page leaves room for one more ending.',
  }),
  creature('dt-desert-wish-princess', 'Desert-Wish Princess', ['Human', 'Princess'], {
    supertypes: ['legendary'], cost: cost(5, 'WR'), colors: ['W', 'R'], attack: 4, defense: 4,
    keywords: ['skyborne', 'warcry'], abilities: [arrives([{ op: 'foresee', n: 2 }])],
    rarity: 'ssr', flavor: 'A palace balcony is just a launch point with better curtains.',
  }),
  creature('dt-warrior-ballad-captain', 'Warrior-Ballad Captain', ['Human', 'Warrior'], {
    supertypes: ['legendary'], cost: cost(4, 'WR'), colors: ['W', 'R'], attack: 4, defense: 4,
    keywords: ['firstBlade', 'sentinel'], abilities: [filterStatic(undefined, 1, 0, undefined, true)],
    rarity: 'ssr', flavor: 'The disguise ends when the sword clears its sheath.',
  }),
  creature('dt-bayou-star-proprietor', 'Bayou-Star Proprietor', ['Human', 'Proprietor'], {
    supertypes: ['legendary'], cost: cost(5, 'WG'), colors: ['W', 'G'], attack: 4, defense: 5,
    keywords: ['bloodoath'], abilities: [arrives([{ op: 'createToken', token: 'tok-firefly', count: 2 }])],
    skim: { cost: cost(2) }, rarity: 'ssr', flavor: 'The house special comes with a second helping of moonlight.',
  }),
];

const SR: CardDef[] = [
  ritual('dt-sea-witch-contract', 'Sea-Witch Contract', {
    cost: cost(3, 'B'), colors: ['B'], abilities: [spell([{ op: 'draw', n: 2 }, { op: 'damage', n: 2, to: 'controller' }])],
    retell: { cost: cost(4, 'B') }, rarity: 'sr', flavor: 'The signature dries quickly. The consequences do not.',
  }),
  artifact('dt-glass-slipper-at-midnight', 'Glass Slipper at Midnight', ['Relic'], {
    cost: cost(2, 'U'), colors: ['U'], skim: { cost: cost(1) },
    abilities: [arrives([{ op: 'boost', p: 1, t: 0, keywords: ['dreaded'], scope: 'allYours' }])],
    rarity: 'sr', flavor: 'It fits perfectly, which is how the trap gets invited inside.',
  }),
  creature('dt-red-hood-wolfslayer', 'Red Hood Wolfslayer', ['Human', 'Hunter'], {
    supertypes: ['legendary'], cost: cost(4, 'RG'), colors: ['R', 'G'], attack: 4, defense: 4,
    keywords: ['firstBlade', 'overrun'], rarity: 'sr', flavor: 'She brought a basket, a blade, and no patience for wolves.',
  }),
  enchantment('dt-rose-cage-ballad', 'Rose-Cage Ballad', [], {
    cost: cost(3, 'B'), colors: ['B'], abilities: [dawn([{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }])],
    rarity: 'sr', flavor: 'The chorus is beautiful. The final verse is locked.',
  }),
  charm('dt-tower-braid-escape', 'Tower-Braid Escape', {
    cost: cost(3, 'U'), colors: ['U'], abilities: [spell([{ op: 'recall', to: 'target' }], target('any'))],
    retell: { cost: cost(4, 'U') }, rarity: 'sr', flavor: 'The braid reaches the ground before the guard notices the window.',
  }),
  ritual('dt-apple-of-endless-sleep', 'Apple of Endless Sleep', {
    cost: cost(3, 'B'), colors: ['B'], abilities: [spell([{ op: 'sever', to: 'target' }], target('creature'))],
    skim: { cost: cost(1) }, rarity: 'sr', flavor: 'One bite, one dream, and no second appointment.',
  }),
  creature('dt-winter-palace-duchess', 'Winter-Palace Duchess', ['Human', 'Duchess'], {
    supertypes: ['legendary'], cost: cost(4, 'UW'), colors: ['U', 'W'], attack: 3, defense: 5,
    keywords: ['untouchable'], abilities: [dawn([{ op: 'foresee', n: 1 }])], rarity: 'sr',
    flavor: 'Her invitation is written in frost and impossible to decline.',
  }),
  creature('dt-ocean-wayfinder', 'Ocean Wayfinder', ['Human', 'Wayfinder'], {
    supertypes: ['legendary'], cost: cost(4, 'UG'), colors: ['U', 'G'], attack: 3, defense: 4,
    abilities: [arrives([{ op: 'fetchLand' }, { op: 'foresee', n: 1 }])], skim: { cost: cost(2) }, rarity: 'sr',
    flavor: 'The stars are a map if you know which promises they kept.',
  }),
  creature('dt-forest-colors-diplomat', 'Forest-Colors Diplomat', ['Human', 'Diplomat'], {
    supertypes: ['legendary'], cost: cost(4, 'GW'), colors: ['G', 'W'], attack: 3, defense: 5,
    keywords: ['sentinel'], abilities: [arrives([{ op: 'foresee', n: 2 }, { op: 'gainLife', n: 2 }])], rarity: 'sr',
    flavor: 'She arrives with an open hand and three ways to close the gate.',
  }),
  creature('dt-brave-highland-archer', 'Brave Highland Archer', ['Human', 'Archer'], {
    supertypes: ['legendary'], cost: cost(4, 'RG'), colors: ['R', 'G'], attack: 4, defense: 4,
    keywords: ['wardingGaze', 'firstBlade'], skim: { cost: cost(2) }, rarity: 'sr',
    flavor: 'The target was selected before the tournament began.',
  }),
  creature('dt-casita-miracle-keeper', 'Casita Miracle Keeper', ['Human', 'Keeper'], {
    supertypes: ['legendary'], cost: cost(4, 'WG'), colors: ['W', 'G'], attack: 3, defense: 5,
    abilities: [arrives([{ op: 'createToken', token: 'tok-hearth-spirit', count: 1 }]), dawn([{ op: 'foresee', n: 1 }])],
    rarity: 'sr', flavor: 'The house keeps a room ready for every impossible return.',
  }),
];

const R: CardDef[] = [
  creature('dt-ash-maiden', 'Ash Maiden', ['Human', 'Maiden'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 2, defense: 2, keywords: ['warcry'], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'The cinders are proof she was here and a warning she is not staying.',
  }),
  creature('dt-pearl-foam-diver', 'Pearl-Foam Diver', ['Mermaid', 'Diver'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2, keywords: ['dreaded'], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'She surfaces only when the safer route has already closed.',
  }),
  creature('dt-thorn-castle-warden', 'Thorn-Castle Warden', ['Plant', 'Warden'], {
    cost: cost(3, 'G'), colors: ['G'], attack: 2, defense: 5, keywords: ['bulwark', 'wardingGaze'], rarity: 'r',
    flavor: 'The hedge does not need to move to make the road impassable.',
  }),
  enchantment('dt-mirror-apple-curse', 'Mirror-Apple Curse', ['Aura'], {
    cost: cost(2, 'B'), colors: ['B'], abilities: [attached(-2, -2)], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'The reflection is flawless. The person wearing it is not.',
  }),
  artifact('dt-midnight-coach', 'Midnight Coach', ['Vehicle'], {
    cost: cost(3), colors: [], skim: { cost: cost(1) },
    abilities: [arrives([{ op: 'boost', p: 1, t: 0, keywords: ['warcry'], scope: 'allYours' }])], rarity: 'r',
    flavor: 'It runs on punctuality, pumpkin, and a very strict return time.',
  }),
  creature('dt-fairy-godmother-noir', 'Noir Godmother', ['Human', 'Godmother'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 3,
    abilities: [arrives([{ op: 'foresee', n: 1 }, { op: 'draw', n: 1 }])], rarity: 'r',
    flavor: 'The transformation comes with a contract and excellent lighting.',
  }),
  enchantment('dt-beast-library', "Beast's Library", ['Library'], {
    cost: cost(3, 'U'), colors: ['U'], abilities: [dawn([{ op: 'foresee', n: 1 }])], rarity: 'r',
    flavor: 'The shelves rearrange themselves around the most dangerous question.',
  }),
  creature('dt-seven-shadow-miners', 'Seven Shadow Miners', ['Dwarf', 'Miner'], {
    cost: cost(4, 'B'), colors: ['B'], attack: 3, defense: 3,
    abilities: [arrives([{ op: 'createToken', token: 'tok-shadow-miner', count: 2 }, { op: 'grind', n: 2, who: 'self' }])], rarity: 'r',
    flavor: 'Seven went below. The mine remembered only two names.',
  }),
  artifact('dt-seafoam-dagger', 'Seafoam Dagger', ['Weapon'], {
    cost: cost(3, 'B'), colors: ['B'], abilities: [filterStatic('Mermaid', 1, 0, ['deathblade'])], rarity: 'r',
    flavor: 'A pretty blade is still a blade when the tide turns red.',
  }),
  charm('dt-briar-rose-lullaby', 'Briar-Rose Lullaby', {
    cost: cost(2, 'U'), colors: ['U'], abilities: [spell([{ op: 'tap', to: 'target' }, { op: 'foresee', n: 1 }], target('creature'))],
    retell: { cost: cost(3, 'U') }, rarity: 'r', flavor: 'The melody softens the thorns without making them kinder.',
  }),
  creature('dt-wolf-at-the-door', 'Wolf at the Door', ['Wolf', 'Predator'], {
    cost: cost(3, 'R'), colors: ['R'], attack: 3, defense: 2, keywords: ['dreaded', 'warcry'], rarity: 'r',
    flavor: 'The knock is polite. The answer is not required.',
  }),
  ritual('dt-cursed-ball-invite', 'Cursed Ball Invite', {
    cost: cost(3, 'B'), colors: ['B'], abilities: [spell([{ op: 'discardRandom', n: 1, who: 'opponent' }])],
    retell: { cost: cost(4, 'B') }, rarity: 'r', flavor: 'The guest list edits itself after midnight.',
  }),
  creature('dt-glass-stair-duelist', 'Glass-Stair Duelist', ['Human', 'Duelist'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['firstBlade'], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'Every step rings. Every opponent hears the invitation.',
  }),
  ritual('dt-undersea-bargain', 'Undersea Bargain', {
    cost: cost(3, 'U'), colors: ['U'], abilities: [spell([{ op: 'draw', n: 2 }])], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'The sea accepts payment in secrets, not coins.',
  }),
  artifact('dt-thirteenth-spindle', 'Thirteenth Spindle', ['Relic'], {
    cost: cost(3, 'B'), colors: ['B'], abilities: [dawn([{ op: 'damage', n: 1, to: 'opponent' }, { op: 'grind', n: 1, who: 'self' }])], rarity: 'r',
    flavor: 'The thirteenth turn is when the curse stops pretending to be an accident.',
  }),
  charm('dt-mirror-hall-illusion', 'Mirror-Hall Illusion', {
    cost: cost(2, 'U'), colors: ['U'], abilities: [spell([{ op: 'recall', to: 'target' }, { op: 'foresee', n: 1 }], target('any'))],
    skim: { cost: cost(1) }, rarity: 'r', flavor: 'The door is real. The room behind it is negotiable.',
  }),
  enchantment('dt-gilded-cage', 'Gilded Cage', ['Aura'], {
    cost: cost(2, 'W'), colors: ['W'], abilities: [attached(-2, 0, ['bulwark'])], rarity: 'r',
    flavor: 'The bars are decorative. The lack of movement is not.',
  }),
  creature('dt-rose-petal-knight', 'Rose-Petal Knight', ['Human', 'Knight'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['sentinel', 'bloodoath'], rarity: 'r',
    flavor: 'She wears the rose for ceremony and the thorn for emphasis.',
  }),
  ritual('dt-clock-strikes-twelve', 'Clock Strikes Twelve', {
    cost: cost(2, 'R'), colors: ['R'], abilities: [spell([{ op: 'damage', n: 2, to: 'target' }], target('any'))],
    retell: { cost: cost(3, 'R') }, rarity: 'r', flavor: 'At twelve, every promise becomes a deadline.',
  }),
  land('dt-ash-ballroom', 'Ash Ballroom', ['U', 'R'], 'r', 'The dance floor remembers every hurried departure.'),
  artifact('dt-haunted-storybook', 'Haunted Storybook', ['Book'], {
    cost: cost(3), colors: [], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'foresee', n: 1 }, { op: 'draw', n: 1 }])], rarity: 'r',
    flavor: 'The pages turn themselves when the house wants company.',
  }),
  creature('dt-princess-of-thorns', 'Princess of Thorns', ['Human', 'Princess'], {
    cost: cost(3, 'G'), colors: ['G'], attack: 3, defense: 3, keywords: ['sentinel', 'wardingGaze'], rarity: 'r',
    flavor: 'The crown grew from the hedge and so did the authority.',
  }),
  creature('dt-black-glass-raven', 'Black-Glass Raven', ['Bird', 'Raven'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 1, keywords: ['skyborne'], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'It carries warnings in one direction and reflections in the other.',
  }),
  creature('dt-foam-silk-siren', 'Foam-Silk Siren', ['Mermaid', 'Siren'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 3, keywords: ['skyborne'], abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'r',
    flavor: 'Her voice leaves the shore quieter than it found it.',
  }),
  enchantment('dt-lamp-lit-balcony', 'Lamp-Lit Balcony', ['Balcony'], {
    cost: cost(3, 'R'), colors: ['R'], skim: { cost: cost(1) }, abilities: [dawn([{ op: 'damage', n: 1, to: 'opponent' }, { op: 'foresee', n: 1 }])], rarity: 'r',
    flavor: 'The wish is already airborne when the lamp begins to smoke.',
  }),
  creature('dt-sandstorm-carpet-rider', 'Sandstorm Carpet Rider', ['Human', 'Rider'], {
    cost: cost(3, 'R'), colors: ['R'], attack: 3, defense: 2, keywords: ['skyborne', 'warcry'], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'The fastest route across the city is above the argument.',
  }),
  creature('dt-ice-palace-architect', 'Ice-Palace Architect', ['Human', 'Architect'], {
    cost: cost(4, 'U'), colors: ['U'], attack: 3, defense: 4, abilities: [arrives([{ op: 'foresee', n: 1 }]), dawn([{ op: 'grind', n: 1, who: 'self' }])], rarity: 'r',
    flavor: 'She builds staircases that lead somewhere only at dawn.',
  }),
  artifact('dt-snowflake-gate', 'Snowflake Gate', ['Gate'], {
    cost: cost(2, 'U'), colors: ['U'], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'draw', n: 1 }])], rarity: 'r',
    flavor: 'The hinge opens once for guests and once for the weather.',
  }),
  creature('dt-honor-blade-captain', 'Honor-Blade Captain', ['Human', 'Captain'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 3, defense: 3, keywords: ['firstBlade'],
    abilities: [arrives([{ op: 'boost', p: 1, t: 0, scope: 'allYours' }])], rarity: 'r',
    flavor: 'The family sword is heavy. The family expectations are heavier.',
  }),
  land('dt-reflection-pond', 'Reflection Pond', ['W', 'R'], 'r', 'The water shows the fighter you brought and the one you need.'),
  ritual('dt-bayou-masquerade', 'Bayou Masquerade', {
    cost: cost(3, 'B'), colors: ['B'], abilities: [spell([{ op: 'createToken', token: 'tok-firefly', count: 2 }])],
    retell: { cost: cost(4, 'B') }, rarity: 'r', flavor: 'The masks come off when the fireflies start counting.',
  }),
  creature('dt-frog-prince-bargain', 'Frog-Prince Bargain', ['Frog', 'Noble'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 3, abilities: [arrives([{ op: 'draw', n: 1 }])], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'The kiss is optional. The contract is not.',
  }),
  artifact('dt-verdant-heart-voyage', 'Verdant-Heart Voyage', ['Relic'], {
    cost: cost(3, 'G'), colors: ['G'], abilities: [arrives([{ op: 'fetchLand' }])], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'The relic points home, even when home is still being built.',
  }),
  creature('dt-wave-skiff-runner', 'Wave-Skiff Runner', ['Human', 'Sailor'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2, keywords: ['dreaded'], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'The skiff is small, the wake is loud, and the plan is excellent.',
  }),
  creature('dt-wind-painted-scout', 'Wind-Painted Scout', ['Human', 'Scout'], {
    cost: cost(3, 'G'), colors: ['G'], attack: 2, defense: 4, keywords: ['sentinel'], abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'r',
    flavor: 'The wind carries the paint farther than any messenger could.',
  }),
  creature('dt-dragon-gem-guardian', 'Dragon-Gem Guardian', ['Human', 'Guardian'], {
    cost: cost(3, 'R'), colors: ['R'], attack: 3, defense: 3, keywords: ['firstBlade', 'warcry'], rarity: 'r',
    flavor: 'The gem is cracked, which is why she guards it so closely.',
  }),
];

const C: CardDef[] = [
  charm('dt-spindle-prick', 'Spindle Prick', { cost: cost(1, 'B'), colors: ['B'], abilities: [spell([{ op: 'damage', n: 1, to: 'target' }, { op: 'tap', to: 'target' }], target('creature'))], rarity: 'c', flavor: 'A tiny prick can ruin a very long sleep.' }),
  creature('dt-pumpkin-attendant', 'Pumpkin Attendant', ['Human', 'Attendant'], { cost: cost(1, 'R'), colors: ['R'], attack: 2, defense: 1, keywords: ['warcry'], rarity: 'c', flavor: 'The coach leaves at midnight. The attendant leaves first.' }),
  artifactCreature('dt-glass-mouse', 'Glass Mouse', ['Mouse', 'Helper'], { cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 2, keywords: ['sentinel'], rarity: 'c', flavor: 'Small enough for the keyhole, stubborn enough for the lock.' }),
  creature('dt-castle-scullery', 'Castle Scullery', ['Human', 'Worker'], { cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 3, abilities: [arrives([{ op: 'gainLife', n: 2 }])], rarity: 'c', flavor: 'The kitchen keeps better hours than the court.' }),
  creature('dt-seafoam-messenger', 'Seafoam Messenger', ['Mermaid', 'Messenger'], { cost: cost(1, 'U'), colors: ['U'], attack: 1, defense: 2, skim: { cost: cost(1) }, rarity: 'c', flavor: 'The message arrives damp, urgent, and perfectly legible.' }),
  creature('dt-briar-sentinel', 'Briar Sentinel', ['Plant', 'Sentinel'], { cost: cost(2, 'G'), colors: ['G'], attack: 2, defense: 3, keywords: ['wardingGaze'], rarity: 'c', flavor: 'The hedge has one job and takes it personally.' }),
  creature('dt-poisoned-courtier', 'Poisoned Courtier', ['Human', 'Courtier'], { cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2, keywords: ['deathblade'], rarity: 'c', flavor: 'Every toast has a second purpose.' }),
  creature('dt-red-cloak-runner', 'Red-Cloak Runner', ['Human', 'Runner'], { cost: cost(1, 'R'), colors: ['R'], attack: 2, defense: 1, keywords: ['warcry'], rarity: 'c', flavor: 'The path is short when you refuse to look behind you.' }),
  creature('dt-tower-window-seer', 'Tower-Window Seer', ['Human', 'Seer'], { cost: cost(2, 'U'), colors: ['U'], attack: 1, defense: 3, abilities: [arrives([{ op: 'foresee', n: 1 }])], skim: { cost: cost(1) }, rarity: 'c', flavor: 'The best view is the one that spots the guard first.' }),
  artifact('dt-satin-slipper', 'Satin Slipper', ['Relic'], { cost: cost(1), colors: [], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'gainLife', n: 1 }])], rarity: 'c', flavor: 'Soft enough for dancing, hard enough for one last step.' }),
  charm('dt-page-torn-free', 'Page Torn Free', { cost: cost(1, 'U'), colors: ['U'], abilities: [spell([{ op: 'draw', n: 1 }])], retell: { cost: cost(2, 'U') }, rarity: 'c', flavor: 'The missing page is where the story starts behaving.' }),
  charm('dt-once-more-with-magic', 'Once More With Magic', { cost: cost(1, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 1, t: 1, scope: 'target' }], target('creature'))], retell: { cost: cost(2, 'W') }, rarity: 'c', flavor: 'The second chance comes with better timing.' }),
  ritual('dt-wicked-step', 'Wicked Step', { cost: cost(2, 'B'), colors: ['B'], abilities: [spell([{ op: 'discardRandom', n: 1, who: 'opponent' }])], rarity: 'c', flavor: 'The stair creaks for everyone but the person who pushed.' }),
  charm('dt-rose-vine-snare', 'Rose-Vine Snare', { cost: cost(2, 'G'), colors: ['G'], abilities: [spell([{ op: 'boost', p: 2, t: 2, scope: 'target' }], target('creature'))], rarity: 'c', flavor: 'The vine catches, then decides it likes the shape.' }),
  enchantment('dt-candle-in-window', 'Candle in the Window', [], { cost: cost(2, 'W'), colors: ['W'], abilities: [dawn([{ op: 'gainLife', n: 1 }])], rarity: 'c', flavor: 'A small light can make a long road possible.' }),
  artifact('dt-ink-black-carriage', 'Ink-Black Carriage', ['Vehicle'], { cost: cost(2, 'B'), colors: ['B'], abilities: [dawn([{ op: 'grind', n: 1, who: 'self' }])], rarity: 'c', flavor: 'It carries stories away from the people who started them.' }),
  charm('dt-sea-glass-knife', 'Sea-Glass Knife', { cost: cost(1, 'U'), colors: ['U'], abilities: [spell([{ op: 'recall', to: 'target' }], target('any'))], rarity: 'c', flavor: 'Pretty glass, practical edge, no landward warranty.' }),
  ritual('dt-ash-sweep', 'Ash Sweep', { cost: cost(2, 'R'), colors: ['R'], abilities: [spell([{ op: 'damage', n: 2, to: 'target' }], target('any'))], rarity: 'c', flavor: 'The hearth clears more than dust.' }),
  artifact('dt-bookmark-charm', 'Bookmark Charm', ['Relic'], { cost: cost(2), colors: [], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'foresee', n: 2 }])], rarity: 'c', flavor: 'A good place to stop is also a good place to look ahead.' }),
  ritual('dt-lost-in-library', 'Lost in the Library', { cost: cost(3, 'U'), colors: ['U'], abilities: [spell([{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }])], rarity: 'c', flavor: 'The shelves are endless. The useful answer is on the next page.' }),
  enchantment('dt-cursed-rose', 'Cursed Rose', ['Aura'], { cost: cost(1, 'B'), colors: ['B'], abilities: [attached(-1, -1)], skim: { cost: cost(1) }, rarity: 'c', flavor: 'The bloom is beautiful until the thorns learn your name.' }),
  artifact('dt-mirror-shard', 'Mirror Shard', ['Relic'], { cost: cost(2, 'U'), colors: ['U'], abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'c', flavor: 'One fragment is enough to make a room doubt itself.' }),
  artifact('dt-silver-fishbone', 'Silver Fishbone', ['Relic'], { cost: cost(2, 'B'), colors: ['B'], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }])], rarity: 'c', flavor: 'The sea leaves trophies for anyone patient enough to wait.' }),
  land('dt-dreaming-castle', 'Dreaming Castle', ['G', 'W'], 'c', 'The walls sleep beneath a crown of patient thorns.'),
  land('dt-tide-cavern', 'Tide Cavern', ['U', 'B'], 'c', 'The tide keeps the bargain long after the witch is gone.'),
  land('dt-wolf-path', 'Wolf Path', ['G'], 'c', 'The safest road is the one the wolf has not noticed.'),
  land('dt-palace-steps', 'Palace Steps', ['W'], 'c', 'Every guest climbs them. Not every guest reaches the ballroom.'),
  land('dt-midnight-road', 'Midnight Road', ['B'], 'c', 'The road is empty because the invitation was accepted elsewhere.'),
  land('dt-sea-cave', 'Sea Cave', ['U'], 'c', 'Foam hides the entrance and the price of leaving.'),
  land('dt-hearth-cinders', 'Hearth Cinders', ['R'], 'c', 'The fire is out, but the room is still warm enough to remember.'),
  charm('dt-dream-prick', 'Dream Prick', { cost: cost(1, 'U'), colors: ['U'], abilities: [spell([{ op: 'tap', to: 'target' }, { op: 'grind', n: 1, who: 'self' }], target('creature'))], rarity: 'c', flavor: 'A dream can be interrupted without being forgotten.' }),
  charm('dt-rose-petal-shield', 'Rose-Petal Shield', { cost: cost(1, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 0, t: 2, scope: 'target' }], target('creature'))], retell: { cost: cost(2, 'W') }, rarity: 'c', flavor: 'The petals turn aside what the thorns cannot.' }),
  artifact('dt-singing-shell', 'Singing Shell', ['Relic'], { cost: cost(2, 'U'), colors: ['U'], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'c', flavor: 'Put it to your ear and it tells you where the current turns.' }),
  creature('dt-forest-grandmother', 'Forest Grandmother', ['Human', 'Elder'], { cost: cost(3, 'G'), colors: ['G'], attack: 2, defense: 4, abilities: [arrives([{ op: 'gainLife', n: 2 }, { op: 'foresee', n: 1 }])], rarity: 'c', flavor: 'She knows the path, the wolf, and who sent the wolf.' }),
  creature('dt-gilded-stepmother', 'Gilded Stepmother', ['Human', 'Courtier'], { cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2, abilities: [arrives([{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }])], rarity: 'c', flavor: 'She polishes the family silver and the family alibis.' }),
  ritual('dt-palace-masquerade', 'Palace Masquerade', { cost: cost(3, 'W'), colors: ['W'], abilities: [spell([{ op: 'createToken', token: 'tok-masked-guest', count: 2 }, { op: 'foresee', n: 1 }])], rarity: 'c', flavor: 'The guest list is a spell with excellent manners.' }),
  artifact('dt-ragged-ballgown', 'Ragged Ballgown', ['Relic'], { cost: cost(2), colors: [], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'gainLife', n: 2 }])], rarity: 'c', flavor: 'The hem is torn, but the entrance is still worth making.' }),
  ritual('dt-forked-road-choice', 'Forked-Road Choice', { cost: cost(2, 'G'), colors: ['G'], abilities: [spell([{ op: 'fetchLand' }, { op: 'foresee', n: 1 }])], rarity: 'c', flavor: 'One road is safe. The other is more interesting.' }),
  charm('dt-lullaby-refrain', 'Lullaby Refrain', { cost: cost(1, 'U'), colors: ['U'], abilities: [spell([{ op: 'tap', to: 'target' }], target('creature'))], retell: { cost: cost(2, 'U') }, rarity: 'c', flavor: 'The refrain returns when the sleeper thinks it is over.' }),
  artifact('dt-apple-basket', 'Apple Basket', ['Relic'], { cost: cost(2, 'G'), colors: ['G'], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'gainLife', n: 2 }])], rarity: 'c', flavor: 'The basket is full, the orchard is quiet, and the deal is unclear.' }),
  artifact('dt-ice-lace-gloves', 'Ice-Lace Gloves', ['Relic'], { cost: cost(2), colors: [], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'preventCombat' }])], rarity: 'c', flavor: 'A cold touch can end a fight before it finds its rhythm.' }),
  creature('dt-snowcourt-attendant', 'Snowcourt Attendant', ['Human', 'Attendant'], { cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2, abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'c', flavor: 'The court runs on schedules, frost, and careful glances.' }),
  land('dt-winter-bridge', 'Winter Bridge', ['U'], 'c', 'The bridge is clear until the palace decides otherwise.'),
  ritual('dt-palace-market-chase', 'Palace-Market Chase', { cost: cost(2, 'R'), colors: ['R'], abilities: [spell([{ op: 'damage', n: 2, to: 'target' }], target('any'))], skim: { cost: cost(1) }, rarity: 'c', flavor: 'The market parts for a runner with a good enough story.' }),
  artifact('dt-brass-lamp-charm', 'Brass Lamp Charm', ['Relic'], { cost: cost(2), colors: [], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'c', flavor: 'Polish the lamp, then decide which wish can survive daylight.' }),
  land('dt-desert-rooftop', 'Desert Rooftop', ['R'], 'c', 'The city roof catches moonlight and runaway wishes.'),
  artifact('dt-reflection-sword', 'Reflection Sword', ['Weapon'], { cost: cost(3, 'W'), colors: ['W'], abilities: [arrives([{ op: 'boost', p: 1, t: 0, keywords: ['firstBlade'], scope: 'allYours' }])], rarity: 'c', flavor: 'The blade reflects the family it expects you to become.' }),
  charm('dt-training-yard-dawn', 'Training-Yard Dawn', { cost: cost(2, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 1, t: 1, scope: 'target' }, { op: 'foresee', n: 1 }], target('creature'))], rarity: 'c', flavor: 'Practice becomes a promise when the sun comes up.' }),
  charm('dt-ancestor-smoke', "Ancestor's Smoke", { cost: cost(3, 'W'), colors: ['W'], abilities: [spell([{ op: 'foresee', n: 2 }])], retell: { cost: cost(4, 'W') }, rarity: 'c', flavor: 'The smoke curls toward the answer your family avoided.' }),
  artifact('dt-bayou-lantern', 'Bayou Lantern', ['Relic'], { cost: cost(2, 'G'), colors: ['G'], skim: { cost: cost(1) }, abilities: [dawn([{ op: 'gainLife', n: 1 }])], rarity: 'c', flavor: 'The lantern keeps the path visible and the mosquitoes interested.' }),
  artifact('dt-crescent-cookpot', 'Crescent Cookpot', ['Relic'], { cost: cost(3), colors: [], abilities: [arrives([{ op: 'gainLife', n: 1 }, { op: 'foresee', n: 1 }])], rarity: 'c', flavor: 'The recipe is older than the kitchen and twice as patient.' }),
  land('dt-riverboat-kitchen', 'Riverboat Kitchen', ['G', 'B'], 'c', 'The galley drifts while the stew and the story both reduce.'),
  artifact('dt-wayfinder-oar', 'Wayfinder Oar', ['Relic'], { cost: cost(2, 'U'), colors: ['U'], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'foresee', n: 2 }])], rarity: 'c', flavor: 'The oar points where the water wants to go next.' }),
  charm('dt-lagoon-current', 'Lagoon Current', { cost: cost(2, 'U'), colors: ['U'], abilities: [spell([{ op: 'recall', to: 'target' }, { op: 'foresee', n: 1 }], target('any'))], rarity: 'c', flavor: 'The current nudges every problem toward another shore.' }),
  land('dt-oceanic-islet', 'Oceanic Islet', ['U', 'G'], 'c', 'A green island rises from water bright enough to mislead a star.'),
  ritual('dt-windblown-leaf-paint', 'Windblown Leaf-Paint', { cost: cost(3, 'G'), colors: ['G'], abilities: [spell([{ op: 'foresee', n: 2 }, { op: 'gainLife', n: 2 }])], rarity: 'c', flavor: 'The wind edits the painting into a map.' }),
  land('dt-riverbend-trail', 'Riverbend Trail', ['G'], 'c', 'The trail bends around the river and every sensible conclusion.'),
  charm('dt-plaid-arrow', 'Plaid Arrow', { cost: cost(1, 'G'), colors: ['G'], abilities: [spell([{ op: 'boost', p: 1, t: 1, keywords: ['wardingGaze'], scope: 'target' }], target('creature'))], rarity: 'c', flavor: 'The pattern is loud so the shot can be quiet.' }),
  artifact('dt-casita-door-charm', 'Casita Door Charm', ['Relic'], { cost: cost(2, 'W'), colors: ['W'], abilities: [arrives([{ op: 'createToken', token: 'tok-hearth-spirit', count: 1 }, { op: 'foresee', n: 1 }])], rarity: 'c', flavor: 'The door opens for the person the house was waiting to meet.' }),
  artifact('dt-jade-dragon-scale', 'Jade Dragon Egg', ['Relic'], { cost: cost(2, 'G'), colors: ['G'], skim: { cost: cost(1) }, abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'c', flavor: 'The shell sleeps. What curls inside remembers being a storm.' }),
];

/** The 120 collectible rows in the spec's rarity order. */
export const DARK_TALES = [...UR, ...SSR, ...SR, ...R, ...C] as const satisfies readonly CardDef[];
