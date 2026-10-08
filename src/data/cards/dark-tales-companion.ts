import type { AbilityDef, CardDef, CardType, EffectOp, Keyword, TargetSpec } from '../../engine/types';
import { cost } from '../cardTypes';

type CompanionData = Omit<CardDef, 'id' | 'name' | 'types' | 'subtypes' | 'set'>;

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

function make(
  id: string,
  name: string,
  types: CardType[],
  subtypes: string[],
  data: CompanionData,
): CardDef {
  return { id, name, types, subtypes, ...data, set: 'dark-tales' };
}

function creature(id: string, name: string, subtypes: string[], data: CompanionData): CardDef {
  return make(id, name, ['creature'], subtypes, data);
}

function artifact(id: string, name: string, subtypes: string[], data: CompanionData): CardDef {
  return make(id, name, ['artifact'], subtypes, data);
}

function artifactCreature(id: string, name: string, subtypes: string[], data: CompanionData): CardDef {
  return make(id, name, ['artifact', 'creature'], subtypes, data);
}

function charm(id: string, name: string, data: CompanionData): CardDef {
  return make(id, name, ['charm'], [], data);
}

function ritual(id: string, name: string, data: CompanionData): CardDef {
  return make(id, name, ['ritual'], [], data);
}

function enchantment(id: string, name: string, subtypes: string[], data: CompanionData): CardDef {
  return make(id, name, ['enchantment'], subtypes, data);
}

const UR: CardDef[] = [
  creature('dt-swan-lake-sovereign', 'Swan-Lake Sovereign', ['Human', 'Swan'], {
    supertypes: ['legendary'], cost: cost(2, 'UUW'), colors: ['U', 'W'], attack: 4, defense: 5,
    keywords: ['skyborne'], nineLives: true,
    abilities: [dawn([{ op: 'foresee', n: 1 }])],
    rarity: 'ur',
  }),
  creature('dt-sea-witch-of-the-drowned-bargain', 'Sea Witch of the Drowned Bargain', ['Human', 'Witch'], {
    supertypes: ['legendary'], cost: cost(5, 'UB'), colors: ['U', 'B'], attack: 5, defense: 7,
    keywords: ['deathblade'], abilities: [arrives([{ op: 'draw', n: 2 }, { op: 'grind', n: 2, who: 'self' }])],
    rarity: 'ur',
  }),
];

const SSR: CardDef[] = [
  creature('dt-thorn-fairy-uninvited', 'Thorn Fairy, Uninvited', ['Human', 'Fairy'], {
    supertypes: ['legendary'], cost: cost(3, 'BB'), colors: ['B'], attack: 4, defense: 4,
    keywords: ['skyborne', 'deathblade'], abilities: [arrives([{ op: 'discardRandom', n: 1, who: 'opponent' }])],
    rarity: 'ssr',
  }),
  creature('dt-teller-of-a-thousand-nights', 'Teller of a Thousand Nights', ['Human', 'Storyteller'], {
    supertypes: ['legendary'], cost: cost(3, 'UR'), colors: ['U', 'R'], attack: 3, defense: 4,
    abilities: [arrives([{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }])], skim: { cost: cost(1) },
    rarity: 'ssr',
  }),
  creature('dt-rose-red-of-the-winter-hearth', 'Rose-Red of the Winter Hearth', ['Human', 'Hearthkeeper'], {
    supertypes: ['legendary'], cost: cost(3, 'GW'), colors: ['G', 'W'], attack: 3, defense: 4,
    abilities: [
      arrives([{ op: 'createToken', token: 'tok-hearth-spirit', count: 2 }]),
      dawn([{ op: 'gainLife', n: 1 }]),
    ],
    rarity: 'ssr',
  }),
  creature('dt-bluebeards-last-bride', "Bluebeard's Last Bride", ['Human', 'Bride'], {
    supertypes: ['legendary'], cost: cost(2, 'WB'), colors: ['W', 'B'], attack: 3, defense: 3,
    keywords: ['bloodoath'], nineLives: true,
    abilities: [{ when: 'dies', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }],
    rarity: 'ssr',
  }),
];

const SR: CardDef[] = [
  ritual('dt-twelve-dancing-heiresses', 'The Twelve Dancing Heiresses', {
    cost: cost(4, 'W'), colors: ['W'], abilities: [spell([{ op: 'createToken', token: 'tok-masked-guest', count: 3 }])],
    retell: { cost: cost(5, 'W') }, rarity: 'sr',
  }),
  ritual('dt-poisoned-comb', 'Poisoned Comb', {
    cost: cost(2, 'B'), colors: ['B'], abilities: [spell([{ op: 'destroy', to: 'target' }], target('creature'))],
    retell: { cost: cost(5, 'B') }, rarity: 'sr',
  }),
  creature('dt-empress-of-the-mirror-shards', 'Empress of the Mirror Shards', ['Human', 'Empress'], {
    supertypes: ['legendary'], cost: cost(2, 'UU'), colors: ['U'], attack: 2, defense: 4,
    keywords: ['skyborne', 'untouchable'], abilities: [arrives([{ op: 'foresee', n: 1 }])], skim: { cost: cost(1) },
    rarity: 'sr',
  }),
  creature('dt-tide-reader-of-the-far-reef', 'Tide-Reader of the Far Reef', ['Human', 'Wayfinder'], {
    supertypes: ['legendary'], cost: cost(2, 'UG'), colors: ['U', 'G'], attack: 2, defense: 4,
    abilities: [arrives([{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }])], skim: { cost: cost(1) },
    rarity: 'sr',
  }),
  creature('dt-bell-tower-dancer', 'Bell-Tower Dancer', ['Human', 'Dancer'], {
    supertypes: ['legendary'], cost: cost(1, 'WR'), colors: ['W', 'R'], attack: 2, defense: 2,
    keywords: ['warcry', 'twinBlades'], skim: { cost: cost(1) },
    rarity: 'sr',
  }),
  creature('dt-duchess-of-the-lost-winter', 'Duchess of the Lost Winter', ['Human', 'Duchess'], {
    supertypes: ['legendary'], cost: cost(2, 'UW'), colors: ['U', 'W'], attack: 2, defense: 4,
    keywords: ['untouchable'], abilities: [arrives([{ op: 'foresee', n: 2 }])], skim: { cost: cost(1) },
    rarity: 'sr',
  }),
];

const R: CardDef[] = [
  creature('dt-glass-mountain-knight', 'Glass-Mountain Knight', ['Human', 'Knight'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 2, keywords: ['sentinel'], nineLives: true,
    rarity: 'r',
  }),
  ritual('dt-ball-before-midnight', 'Ball Before Midnight', {
    cost: cost(2, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 2, t: 2, scope: 'allYours' }])],
    retell: { cost: cost(5, 'W') }, rarity: 'r',
  }),
  creature('dt-goose-girl-of-the-wind-meadow', 'Goose-Girl of the Wind Meadow', ['Human', 'Goose-Girl'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['skyborne'],
    abilities: [arrives([{ op: 'gainLife', n: 2 }])], preserve: { cost: cost(4, 'W') },
    rarity: 'r',
  }),
  ritual('dt-banished-from-the-ball', 'Banished from the Ball', {
    cost: cost(3, 'W'), colors: ['W'], abilities: [spell([{ op: 'sever', to: 'target' }], target('creature'))],
    retell: { cost: cost(5, 'W') }, rarity: 'r',
  }),
  enchantment('dt-casita-hearth', 'Casita Hearth', [], {
    cost: cost(5, 'W'), colors: ['W'], abilities: [dawn([{ op: 'createToken', token: 'tok-hearth-spirit', count: 1 }, { op: 'gainLife', n: 2 }])],
    rarity: 'r',
  }),
  creature('dt-swan-feather-scout', 'Swan-Feather Scout', ['Human', 'Swan-Maiden'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 1, keywords: ['skyborne'], skim: { cost: cost(1) },
    preserve: { cost: cost(3, 'U') }, rarity: 'r',
  }),
  creature('dt-gerda-of-the-long-road', 'Gerda of the Long Road', ['Human', 'Wayfarer'], {
    cost: cost(2, 'UU'), colors: ['U'], attack: 3, defense: 4,
    abilities: [arrives([{ op: 'foresee', n: 1 }])], preserve: { cost: cost(4, 'U') },
    rarity: 'r',
  }),
  ritual('dt-drowned-library', 'Drowned Library', {
    cost: cost(3, 'U'), colors: ['U'], abilities: [spell([{ op: 'draw', n: 2 }])],
    retell: { cost: cost(4, 'U') }, rarity: 'r',
  }),
  creature('dt-frost-sleigh-maiden', 'Frost-Sleigh Maiden', ['Human', 'Sleigh-Driver'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 4, keywords: ['skyborne'], skim: { cost: cost(1) },
    rarity: 'r',
  }),
  creature('dt-glass-coffin-sleeper', 'Glass-Coffin Sleeper', ['Human', 'Sleeper'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2, nineLives: true,
    abilities: [{ when: 'dies', ops: [{ op: 'grind', n: 2, who: 'self' }] }],
    rarity: 'r',
  }),
  charm('dt-laced-too-tight', 'Laced Too Tight', {
    cost: cost(0, 'B'), colors: ['B'], abilities: [spell([{ op: 'boost', p: -2, t: -2, scope: 'target' }], target('creature'))],
    retell: { cost: cost(3, 'B') }, rarity: 'r',
  }),
  creature('dt-sugar-cottage-witch', 'Sugar-Cottage Witch', ['Human', 'Witch'], {
    cost: cost(2, 'BB'), colors: ['B'], attack: 3, defense: 4, keywords: ['deathblade'],
    preserve: { cost: cost(4, 'B') }, rarity: 'r',
  }),
  creature('dt-raven-mother-of-the-mirror', 'Raven-Mother of the Mirror', ['Human', 'Raven-Keeper'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 2, skim: { cost: cost(1) },
    preserve: { cost: cost(3, 'B') }, rarity: 'r',
  }),
  creature('dt-woodcutters-daughter', "Woodcutter's Daughter", ['Human', 'Hunter'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 3, defense: 1, keywords: ['firstBlade'], nineLives: true,
    rarity: 'r',
  }),
  charm('dt-carpet-escape', 'Carpet Escape', {
    cost: cost(1, 'R'), colors: ['R'], abilities: [spell([{ op: 'boost', p: 2, t: 0, keywords: ['skyborne'], scope: 'target' }], target('creature'))],
    empower: { cost: cost(1, 'R'), ops: [{ op: 'damage', n: 2, to: 'opponent' }] },
    rarity: 'r',
  }),
  creature('dt-briar-hedge-matriarch', 'Briar-Hedge Matriarch', ['Human', 'Matriarch'], {
    cost: cost(1, 'GG'), colors: ['G'], attack: 2, defense: 4, keywords: ['wardingGaze'],
    preserve: { cost: cost(3, 'G') }, rarity: 'r',
  }),
  ritual('dt-chart-the-reef-road', 'Chart the Reef Road', {
    cost: cost(5, 'G'), colors: ['G'], abilities: [spell([{ op: 'extraLandDrop' }, { op: 'foresee', n: 2 }, { op: 'draw', n: 1 }])],
    retell: { cost: cost(4, 'G') }, rarity: 'r',
  }),
  artifactCreature('dt-clockwork-coachwoman', 'Clockwork Coachwoman', ['Construct', 'Coachwoman'], {
    cost: cost(3), colors: [], attack: 2, defense: 3, skim: { cost: cost(1) },
    rarity: 'r',
  }),
];

const C: CardDef[] = [
  creature('dt-pea-mattress-sentry', 'Pea-Mattress Sentry', ['Human', 'Sentry'], {
    cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 3, skim: { cost: cost(1) }, rarity: 'c',
  }),
  creature('dt-handmaid-who-woke-twice', 'Handmaid Who Woke Twice', ['Human', 'Handmaid'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 1, defense: 1, keywords: ['bloodoath'], nineLives: true,
    rarity: 'c',
  }),
  creature('dt-masquerade-chaperone', 'Masquerade Chaperone', ['Human', 'Chaperone'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 1, defense: 3,
    empower: { cost: cost(2, 'W'), ops: [{ op: 'createToken', token: 'tok-masked-guest', count: 2 }] },
    rarity: 'c',
  }),
  creature('dt-tower-chatelaine', 'Tower Chatelaine', ['Human', 'Chatelaine'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 2, defense: 5, skim: { cost: cost(1) }, rarity: 'c',
  }),
  charm('dt-rose-thorn-parry', 'Rose-Thorn Parry', {
    cost: cost(1, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 2, t: 0, keywords: ['firstBlade'], scope: 'target' }], target('creature'))],
    retell: { cost: cost(2, 'W') }, rarity: 'c',
  }),
  ritual('dt-hearth-blessing', 'Hearth Blessing', {
    cost: cost(2, 'W'), colors: ['W'], abilities: [spell([{ op: 'createToken', token: 'tok-hearth-spirit', count: 1 }, { op: 'gainLife', n: 2 }])],
    retell: { cost: cost(4, 'W') }, rarity: 'c',
  }),
  ritual('dt-sunrise-over-the-ballroom', 'Sunrise Over the Ballroom', {
    cost: cost(1, 'W'), colors: ['W'], abilities: [spell([{ op: 'gainLife', n: 3 }, { op: 'foresee', n: 1 }])],
    empower: { cost: cost(2, 'W'), ops: [{ op: 'createToken', token: 'tok-masked-guest', count: 2 }] },
    rarity: 'c',
  }),
  creature('dt-frog-pond-bride', 'Frog-Pond Bride', ['Human', 'Bride'], {
    cost: cost(1, 'U'), colors: ['U'], attack: 1, defense: 2, nineLives: true, rarity: 'c',
  }),
  creature('dt-tide-sister-of-the-deep', 'Tide-Sister of the Deep', ['Mermaid', 'Sister'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 1, defense: 3, keywords: ['skyborne'], skim: { cost: cost(1) }, rarity: 'c',
  }),
  creature('dt-swallow-borne-bride', 'Swallow-Borne Bride', ['Human', 'Bride'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 3, defense: 2, skim: { cost: cost(1) }, rarity: 'c',
  }),
  creature('dt-frozen-heart-sister', 'Frozen-Heart Sister', ['Human', 'Sister'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2, skim: { cost: cost(1) }, preserve: { cost: cost(4, 'U') }, rarity: 'c',
  }),
  creature('dt-star-chart-navigator', 'Star-Chart Navigator', ['Human', 'Navigator'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 5, skim: { cost: cost(1) }, rarity: 'c',
  }),
  ritual('dt-drown-the-pages', 'Drown the Pages', {
    cost: cost(2, 'U'), colors: ['U'], abilities: [spell([{ op: 'grind', n: 3, who: 'self' }, { op: 'draw', n: 1 }])],
    retell: { cost: cost(3, 'U') }, rarity: 'c',
  }),
  charm('dt-second-verse', 'Second Verse', {
    cost: cost(0, 'UU'), colors: ['U'], abilities: [spell([{ op: 'draw', n: 1 }, { op: 'grind', n: 1, who: 'self' }])],
    retell: { cost: cost(1, 'UU') }, rarity: 'c',
  }),
  enchantment('dt-frozen-to-the-floor', 'Frozen to the Floor', ['Aura'], {
    cost: cost(1, 'U'), colors: ['U'], abilities: [attached(-1, 0, ['bulwark'])], skim: { cost: cost(1) },
    rarity: 'c',
  }),
  creature('dt-eel-twin-of-the-sea-witch', 'Eel-Twin of the Sea Witch', ['Eel', 'Familiar'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 3, skim: { cost: cost(1) }, rarity: 'c',
  }),
  creature('dt-elder-stepsister', 'Elder Stepsister', ['Human', 'Stepsister'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 1, defense: 4, skim: { cost: cost(1) }, rarity: 'c',
  }),
  creature('dt-gingerbread-crumb-girl', 'Gingerbread-Crumb Girl', ['Human', 'Wayfinder'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 1, defense: 3, nineLives: true, skim: { cost: cost(1) }, rarity: 'c',
  }),
  creature('dt-ink-contract-clerk', 'Ink-Contract Clerk', ['Human', 'Clerk'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2,
    abilities: [arrives([{ op: 'draw', n: 1 }, { op: 'damage', n: 1, to: 'controller' }])], rarity: 'c',
  }),
  creature('dt-huntress-who-spared-her', 'Huntress Who Spared Her', ['Human', 'Huntress'], {
    cost: cost(3, 'B'), colors: ['B'], attack: 4, defense: 2, skim: { cost: cost(1) }, rarity: 'c',
  }),
  ritual('dt-apple-half-exchange', 'Apple-Half Exchange', {
    cost: cost(1, 'B'), colors: ['B'], abilities: [spell([{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }])],
    retell: { cost: cost(3, 'B') }, rarity: 'c',
  }),
  ritual('dt-shadow-miners-dirge', "Shadow-Miner's Dirge", {
    cost: cost(1, 'B'), colors: ['B'], abilities: [spell([{ op: 'createToken', token: 'tok-shadow-miner', count: 1 }, { op: 'grind', n: 2, who: 'self' }])],
    retell: { cost: cost(3, 'B') }, rarity: 'c',
  }),
  creature('dt-hearth-ember-dancer', 'Hearth-Ember Dancer', ['Human', 'Dancer'], {
    cost: cost(1, 'R'), colors: ['R'], attack: 2, defense: 1, skim: { cost: cost(1) }, rarity: 'c',
  }),
  creature('dt-balcony-leap-runner', 'Balcony-Leap Runner', ['Human', 'Runner'], {
    cost: cost(3, 'R'), colors: ['R'], attack: 3, defense: 3, keywords: ['warcry'], skim: { cost: cost(1) }, rarity: 'c',
  }),
  charm('dt-ember-lantern-toss', 'Ember-Lantern Toss', {
    cost: cost(1, 'R'), colors: ['R'], abilities: [spell([{ op: 'damage', n: 2, to: 'target' }], target('any'))],
    retell: { cost: cost(2, 'R') }, rarity: 'c',
  }),
  creature('dt-bayou-lamplighter', 'Bayou Lamplighter', ['Human', 'Lamplighter'], {
    cost: cost(1, 'G'), colors: ['G'], attack: 1, defense: 1,
    abilities: [arrives([{ op: 'createToken', token: 'tok-firefly', count: 1 }])], rarity: 'c',
  }),
  creature('dt-canoe-carver-of-the-reef', 'Canoe-Carver of the Reef', ['Human', 'Carver'], {
    cost: cost(2, 'G'), colors: ['G'], attack: 2, defense: 4, skim: { cost: cost(1) }, rarity: 'c',
  }),
  charm('dt-grandmothers-remedy', "Grandmother's Remedy", {
    cost: cost(1, 'G'), colors: ['G'], abilities: [spell([{ op: 'boost', p: 2, t: 2, keywords: ['wardingGaze'], scope: 'target' }], target('creature'))],
    retell: { cost: cost(2, 'G') }, rarity: 'c',
  }),
  artifactCreature('dt-paper-ballerina', 'Paper Ballerina', ['Construct', 'Ballerina'], {
    cost: cost(3), colors: [], attack: 2, defense: 2, nineLives: true, rarity: 'c',
  }),
  artifact('dt-pumpkin-shell-lantern', 'Pumpkin-Shell Lantern', ['Relic'], {
    cost: cost(2), colors: [], skim: { cost: cost(1) },
    abilities: [dawn([{ op: 'grind', n: 1, who: 'self' }, { op: 'gainLife', n: 1 }])],
    rarity: 'c',
  }),
];

/** The 60-card Dark Tales companion wave, gated by FEATURES.dtCompanionLive. */
export const DARK_TALES_COMPANION = [...UR, ...SSR, ...SR, ...R, ...C] as const satisfies readonly CardDef[];
