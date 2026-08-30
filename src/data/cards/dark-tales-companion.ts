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
    supertypes: ['legendary'], cost: cost(3, 'UW'), colors: ['U', 'W'], attack: 4, defense: 5,
    keywords: ['skyborne', 'sentinel'], nineLives: true,
    abilities: [dawn([{ op: 'foresee', n: 1 }])],
    rarity: 'ur', flavor: 'Each dawn returns her feathers, her crown, and a look at tomorrow.',
  }),
  creature('dt-sea-witch-of-the-drowned-bargain', 'Sea Witch of the Drowned Bargain', ['Human', 'Witch'], {
    supertypes: ['legendary'], cost: cost(5, 'UB'), colors: ['U', 'B'], attack: 5, defense: 5,
    keywords: ['deathblade'], abilities: [arrives([{ op: 'draw', n: 2 }, { op: 'grind', n: 2, who: 'self' }])],
    rarity: 'ur', flavor: 'Two pages read, two pages drowned, and your voice was never the point.',
  }),
];

const SSR: CardDef[] = [
  creature('dt-thorn-fairy-uninvited', 'Thorn Fairy, Uninvited', ['Human', 'Fairy'], {
    supertypes: ['legendary'], cost: cost(3, 'BB'), colors: ['B'], attack: 4, defense: 4,
    keywords: ['skyborne', 'deathblade'], abilities: [arrives([{ op: 'discardRandom', n: 1, who: 'opponent' }])],
    rarity: 'ssr', flavor: 'Nobody sent her an invitation, so she took one from your hand.',
  }),
  creature('dt-teller-of-a-thousand-nights', 'Teller of a Thousand Nights', ['Human', 'Storyteller'], {
    supertypes: ['legendary'], cost: cost(3, 'UR'), colors: ['U', 'R'], attack: 3, defense: 4,
    abilities: [arrives([{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }])], skim: { cost: cost(1) },
    rarity: 'ssr', flavor: 'She always knows the next two chapters and tells only one.',
  }),
  creature('dt-rose-red-of-the-winter-hearth', 'Rose-Red of the Winter Hearth', ['Human', 'Hearthkeeper'], {
    supertypes: ['legendary'], cost: cost(3, 'GW'), colors: ['G', 'W'], attack: 3, defense: 4,
    abilities: [
      arrives([{ op: 'createToken', token: 'tok-hearth-spirit', count: 2 }]),
      dawn([{ op: 'gainLife', n: 1 }]),
    ],
    rarity: 'ssr', flavor: 'She feeds the fire, the bear, and whatever the bear turns out to be.',
  }),
  creature('dt-bluebeards-last-bride', "Bluebeard's Last Bride", ['Human', 'Bride'], {
    supertypes: ['legendary'], cost: cost(2, 'WB'), colors: ['W', 'B'], attack: 3, defense: 3,
    keywords: ['bloodoath'], nineLives: true,
    abilities: [{ when: 'dies', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }],
    rarity: 'ssr', flavor: 'Kill her once and she comes back; kill her twice and the house collects.',
  }),
];

const SR: CardDef[] = [
  ritual('dt-twelve-dancing-heiresses', 'The Twelve Dancing Heiresses', {
    cost: cost(4, 'W'), colors: ['W'], abilities: [spell([{ op: 'createToken', token: 'tok-masked-guest', count: 3 }])],
    retell: { cost: cost(5, 'W') }, rarity: 'sr', flavor: 'They wear through twelve pairs a night and deny it in chorus.',
  }),
  ritual('dt-poisoned-comb', 'Poisoned Comb', {
    cost: cost(2, 'B'), colors: ['B'], abilities: [spell([{ op: 'destroy', to: 'target' }], target('creature'))],
    retell: { cost: cost(5, 'B') }, rarity: 'sr', flavor: 'The comb is a second opinion, delivered one tooth at a time.',
  }),
  creature('dt-empress-of-the-mirror-shards', 'Empress of the Mirror Shards', ['Human', 'Empress'], {
    supertypes: ['legendary'], cost: cost(2, 'UU'), colors: ['U'], attack: 2, defense: 4,
    keywords: ['skyborne', 'untouchable'], abilities: [arrives([{ op: 'foresee', n: 1 }])], skim: { cost: cost(1) },
    rarity: 'sr', flavor: 'A splinter in the eye, and suddenly everyone sees things her way.',
  }),
  creature('dt-tide-reader-of-the-far-reef', 'Tide-Reader of the Far Reef', ['Human', 'Wayfinder'], {
    supertypes: ['legendary'], cost: cost(2, 'UG'), colors: ['U', 'G'], attack: 2, defense: 4,
    abilities: [arrives([{ op: 'extraLandDrop' }, { op: 'foresee', n: 1 }])], skim: { cost: cost(1) },
    rarity: 'sr', flavor: 'The reef opens where she says it will, mostly out of respect.',
  }),
  creature('dt-bell-tower-dancer', 'Bell-Tower Dancer', ['Human', 'Dancer'], {
    supertypes: ['legendary'], cost: cost(1, 'WR'), colors: ['W', 'R'], attack: 2, defense: 2,
    keywords: ['warcry', 'firstBlade'], skim: { cost: cost(1) },
    rarity: 'sr', flavor: 'She dances fastest when the bells are tolling for somebody else.',
  }),
  creature('dt-duchess-of-the-lost-winter', 'Duchess of the Lost Winter', ['Human', 'Duchess'], {
    supertypes: ['legendary'], cost: cost(2, 'UW'), colors: ['U', 'W'], attack: 2, defense: 4,
    keywords: ['untouchable'], abilities: [arrives([{ op: 'foresee', n: 2 }])], skim: { cost: cost(1) },
    rarity: 'sr', flavor: 'Nobody can prove who she is, which makes it difficult to arrest her.',
  }),
];

const R: CardDef[] = [
  creature('dt-glass-mountain-knight', 'Glass-Mountain Knight', ['Human', 'Knight'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 2, defense: 2, keywords: ['sentinel'], nineLives: true,
    rarity: 'r', flavor: 'Nobody reaches the top on the first ride. She budgeted for that.',
  }),
  ritual('dt-ball-before-midnight', 'Ball Before Midnight', {
    cost: cost(2, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 2, t: 2, scope: 'allYours' }])],
    retell: { cost: cost(5, 'W') }, rarity: 'r', flavor: 'One dance from midnight, and every guest is twice what she arrived as.',
  }),
  creature('dt-goose-girl-of-the-wind-meadow', 'Goose-Girl of the Wind Meadow', ['Human', 'Goose-Girl'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 2, defense: 3, keywords: ['skyborne'],
    abilities: [arrives([{ op: 'gainLife', n: 2 }])], preserve: { cost: cost(4, 'W') },
    rarity: 'r', flavor: 'The geese know exactly who she is, and the wind keeps their secret.',
  }),
  ritual('dt-banished-from-the-ball', 'Banished from the Ball', {
    cost: cost(3, 'W'), colors: ['W'], abilities: [spell([{ op: 'sever', to: 'target' }], target('creature'))],
    retell: { cost: cost(5, 'W') }, rarity: 'r', flavor: 'Struck from the list, she is not even allowed to haunt the ballroom.',
  }),
  enchantment('dt-casita-hearth', 'Casita Hearth', [], {
    cost: cost(5, 'W'), colors: ['W'], abilities: [dawn([{ op: 'createToken', token: 'tok-hearth-spirit', count: 1 }, { op: 'gainLife', n: 2 }])],
    rarity: 'r', flavor: 'Every morning the house adds a chair, and every morning someone takes it.',
  }),
  creature('dt-swan-feather-scout', 'Swan-Feather Scout', ['Human', 'Swan-Maiden'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 1, keywords: ['skyborne'], skim: { cost: cost(1) },
    preserve: { cost: cost(3, 'U') }, rarity: 'r', flavor: 'She leaves one feather on the shore so the story can find her again.',
  }),
  creature('dt-gerda-of-the-long-road', 'Gerda of the Long Road', ['Human', 'Wayfarer'], {
    cost: cost(2, 'UU'), colors: ['U'], attack: 3, defense: 4,
    abilities: [arrives([{ op: 'foresee', n: 1 }])], preserve: { cost: cost(4, 'U') },
    rarity: 'r', flavor: 'She walked through winter with no map, and winter eventually apologized.',
  }),
  ritual('dt-drowned-library', 'Drowned Library', {
    cost: cost(3, 'U'), colors: ['U'], abilities: [spell([{ op: 'draw', n: 2 }])],
    retell: { cost: cost(4, 'U') }, rarity: 'r', flavor: 'The tide returns two books a night, still damp and slightly rewritten.',
  }),
  creature('dt-frost-sleigh-maiden', 'Frost-Sleigh Maiden', ['Human', 'Sleigh-Driver'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 4, keywords: ['skyborne'], skim: { cost: cost(1) },
    rarity: 'r', flavor: 'She drives the sleigh above the weather and charges by the kiss.',
  }),
  creature('dt-glass-coffin-sleeper', 'Glass-Coffin Sleeper', ['Human', 'Sleeper'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2, nineLives: true,
    abilities: [{ when: 'dies', ops: [{ op: 'grind', n: 2, who: 'self' }] }],
    rarity: 'r', flavor: 'Every time she dies, the coffin bookmarks two more pages.',
  }),
  charm('dt-laced-too-tight', 'Laced Too Tight', {
    cost: cost(0, 'B'), colors: ['B'], abilities: [spell([{ op: 'boost', p: -2, t: -2, scope: 'target' }], target('creature'))],
    retell: { cost: cost(3, 'B') }, rarity: 'r', flavor: 'Tighter, dear, and tighter; the peddler always asks twice.',
  }),
  creature('dt-sugar-cottage-witch', 'Sugar-Cottage Witch', ['Human', 'Witch'], {
    cost: cost(2, 'BB'), colors: ['B'], attack: 3, defense: 4, keywords: ['deathblade'],
    preserve: { cost: cost(4, 'B') }, rarity: 'r', flavor: 'The icing is a recipe. The oven is a policy.',
  }),
  creature('dt-raven-mother-of-the-mirror', 'Raven-Mother of the Mirror', ['Human', 'Raven-Keeper'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 2, skim: { cost: cost(1) },
    preserve: { cost: cost(3, 'B') }, rarity: 'r', flavor: 'The ravens come back with news; she comes back with the ravens.',
  }),
  creature('dt-woodcutters-daughter', "Woodcutter's Daughter", ['Human', 'Hunter'], {
    cost: cost(2, 'R'), colors: ['R'], attack: 3, defense: 1, keywords: ['firstBlade'], nineLives: true,
    rarity: 'r', flavor: 'She swings first and asks the wolf nothing at all.',
  }),
  charm('dt-carpet-escape', 'Carpet Escape', {
    cost: cost(1, 'R'), colors: ['R'], abilities: [spell([{ op: 'boost', p: 2, t: 0, keywords: ['skyborne'], scope: 'target' }], target('creature'))],
    empower: { cost: cost(1, 'R'), ops: [{ op: 'damage', n: 2, to: 'opponent' }] },
    rarity: 'r', flavor: 'Over the wall in one breath, and the guards below catch the lantern she dropped.',
  }),
  creature('dt-briar-hedge-matriarch', 'Briar-Hedge Matriarch', ['Human', 'Matriarch'], {
    cost: cost(1, 'GG'), colors: ['G'], attack: 2, defense: 4, keywords: ['wardingGaze'],
    preserve: { cost: cost(3, 'G') }, rarity: 'r', flavor: 'Cut her down in autumn and she is back, thornier, by spring.',
  }),
  ritual('dt-chart-the-reef-road', 'Chart the Reef Road', {
    cost: cost(5, 'G'), colors: ['G'], abilities: [spell([{ op: 'extraLandDrop' }, { op: 'foresee', n: 2 }, { op: 'draw', n: 1 }])],
    retell: { cost: cost(4, 'G') }, rarity: 'r', flavor: 'The chart shows one safe passage and two she will check later.',
  }),
  artifactCreature('dt-clockwork-coachwoman', 'Clockwork Coachwoman', ['Construct', 'Coachwoman'], {
    cost: cost(3), colors: [], attack: 2, defense: 3, skim: { cost: cost(1) },
    rarity: 'r', flavor: 'She runs on schedule, gears, and a total indifference to midnight.',
  }),
];

const C: CardDef[] = [
  creature('dt-pea-mattress-sentry', 'Pea-Mattress Sentry', ['Human', 'Sentry'], {
    cost: cost(1, 'W'), colors: ['W'], attack: 1, defense: 3, skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'She feels the pea through twenty mattresses and the plot through twenty doors.',
  }),
  creature('dt-handmaid-who-woke-twice', 'Handmaid Who Woke Twice', ['Human', 'Handmaid'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 1, defense: 1, keywords: ['bloodoath'], nineLives: true,
    rarity: 'c', flavor: 'The castle slept a hundred years; she got up early, twice.',
  }),
  creature('dt-masquerade-chaperone', 'Masquerade Chaperone', ['Human', 'Chaperone'], {
    cost: cost(2, 'W'), colors: ['W'], attack: 1, defense: 3,
    empower: { cost: cost(2, 'W'), ops: [{ op: 'createToken', token: 'tok-masked-guest', count: 2 }] },
    rarity: 'c', flavor: 'A proper chaperone brings two extra guests and loses none of them.',
  }),
  creature('dt-tower-chatelaine', 'Tower Chatelaine', ['Human', 'Chatelaine'], {
    cost: cost(3, 'W'), colors: ['W'], attack: 2, defense: 5, skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'The tower has no stairs, and she is very comfortable with that.',
  }),
  charm('dt-rose-thorn-parry', 'Rose-Thorn Parry', {
    cost: cost(1, 'W'), colors: ['W'], abilities: [spell([{ op: 'boost', p: 2, t: 0, keywords: ['firstBlade'], scope: 'target' }], target('creature'))],
    retell: { cost: cost(2, 'W') }, rarity: 'c', flavor: 'Offer a rose first, and the blade never gets its turn.',
  }),
  ritual('dt-hearth-blessing', 'Hearth Blessing', {
    cost: cost(2, 'W'), colors: ['W'], abilities: [spell([{ op: 'createToken', token: 'tok-hearth-spirit', count: 1 }, { op: 'gainLife', n: 2 }])],
    retell: { cost: cost(4, 'W') }, rarity: 'c', flavor: 'The hearth spirit asks for kindling and pays back in second helpings.',
  }),
  ritual('dt-sunrise-over-the-ballroom', 'Sunrise Over the Ballroom', {
    cost: cost(1, 'W'), colors: ['W'], abilities: [spell([{ op: 'gainLife', n: 3 }, { op: 'foresee', n: 1 }])],
    empower: { cost: cost(2, 'W'), ops: [{ op: 'createToken', token: 'tok-masked-guest', count: 2 }] },
    rarity: 'c', flavor: 'By sunrise the ballroom has recovered, and two guests have not gone home.',
  }),
  creature('dt-frog-pond-bride', 'Frog-Pond Bride', ['Human', 'Bride'], {
    cost: cost(1, 'U'), colors: ['U'], attack: 1, defense: 2, nineLives: true, rarity: 'c',
    flavor: 'She threw the frog at the wall, and both of them got a second chance.',
  }),
  creature('dt-tide-sister-of-the-deep', 'Tide-Sister of the Deep', ['Mermaid', 'Sister'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 1, defense: 3, keywords: ['skyborne'], skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'Her sisters sold their hair for a knife; she kept hers and learned to fly.',
  }),
  creature('dt-swallow-borne-bride', 'Swallow-Borne Bride', ['Human', 'Bride'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 3, defense: 2, skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'Small enough to ride a swallow, far too large for the mole.',
  }),
  creature('dt-frozen-heart-sister', 'Frozen-Heart Sister', ['Human', 'Sister'], {
    cost: cost(2, 'U'), colors: ['U'], attack: 2, defense: 2, skim: { cost: cost(1) }, preserve: { cost: cost(4, 'U') }, rarity: 'c',
    flavor: 'A frozen heart thaws slowly and comes back knowing the whole castle.',
  }),
  creature('dt-star-chart-navigator', 'Star-Chart Navigator', ['Human', 'Navigator'], {
    cost: cost(3, 'U'), colors: ['U'], attack: 2, defense: 5, skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'She steers by the stars, which at least never change their story.',
  }),
  ritual('dt-drown-the-pages', 'Drown the Pages', {
    cost: cost(2, 'U'), colors: ['U'], abilities: [spell([{ op: 'grind', n: 3, who: 'self' }, { op: 'draw', n: 1 }])],
    retell: { cost: cost(3, 'U') }, rarity: 'c', flavor: 'Three pages to the tide, one back, and that one knows how it ends.',
  }),
  charm('dt-second-verse', 'Second Verse', {
    cost: cost(0, 'UU'), colors: ['U'], abilities: [spell([{ op: 'draw', n: 1 }, { op: 'grind', n: 1, who: 'self' }])],
    retell: { cost: cost(1, 'UU') }, rarity: 'c', flavor: 'The first verse puts the court to sleep. The second decides who wakes.',
  }),
  enchantment('dt-frozen-to-the-floor', 'Frozen to the Floor', ['Aura'], {
    cost: cost(1, 'U'), colors: ['U'], abilities: [attached(-1, 0, ['bulwark'])], skim: { cost: cost(1) },
    rarity: 'c', flavor: 'The guest is welcome to stay. The floor has made sure of it.',
  }),
  creature('dt-eel-twin-of-the-sea-witch', 'Eel-Twin of the Sea Witch', ['Eel', 'Familiar'], {
    cost: cost(1, 'B'), colors: ['B'], attack: 1, defense: 3, skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'There are two of her, and the bargain always needs a witness.',
  }),
  creature('dt-elder-stepsister', 'Elder Stepsister', ['Human', 'Stepsister'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 1, defense: 4, skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'She cut off her toe for the slipper and still calls it a near miss.',
  }),
  creature('dt-gingerbread-crumb-girl', 'Gingerbread-Crumb Girl', ['Human', 'Wayfinder'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 1, defense: 3, nineLives: true, skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'The birds ate the trail; she walked it anyway, from memory.',
  }),
  creature('dt-ink-contract-clerk', 'Ink-Contract Clerk', ['Human', 'Clerk'], {
    cost: cost(2, 'B'), colors: ['B'], attack: 2, defense: 2,
    abilities: [arrives([{ op: 'draw', n: 1 }, { op: 'damage', n: 1, to: 'controller' }])], rarity: 'c',
    flavor: 'Every contract comes with a free reading and a small fee in blood.',
  }),
  creature('dt-huntress-who-spared-her', 'Huntress Who Spared Her', ['Human', 'Huntress'], {
    cost: cost(3, 'B'), colors: ['B'], attack: 4, defense: 2, skim: { cost: cost(1) }, rarity: 'c',
    flavor: "She brought the queen a pig's heart and kept her own.",
  }),
  ritual('dt-apple-half-exchange', 'Apple-Half Exchange', {
    cost: cost(1, 'B'), colors: ['B'], abilities: [spell([{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }])],
    retell: { cost: cost(3, 'B') }, rarity: 'c', flavor: 'She takes the sweet half, you take the other, and everyone calls it sharing.',
  }),
  ritual('dt-shadow-miners-dirge', "Shadow-Miner's Dirge", {
    cost: cost(1, 'B'), colors: ['B'], abilities: [spell([{ op: 'createToken', token: 'tok-shadow-miner', count: 1 }, { op: 'grind', n: 2, who: 'self' }])],
    retell: { cost: cost(3, 'B') }, rarity: 'c', flavor: 'One miner climbs out of the dirge; two pages go in to keep it company.',
  }),
  creature('dt-hearth-ember-dancer', 'Hearth-Ember Dancer', ['Human', 'Dancer'], {
    cost: cost(1, 'R'), colors: ['R'], attack: 2, defense: 1, skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'She dances in the ashes because the ballroom is not open yet.',
  }),
  creature('dt-balcony-leap-runner', 'Balcony-Leap Runner', ['Human', 'Runner'], {
    cost: cost(3, 'R'), colors: ['R'], attack: 3, defense: 3, keywords: ['warcry'], skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'The balcony is a door if you leave it fast enough.',
  }),
  charm('dt-ember-lantern-toss', 'Ember-Lantern Toss', {
    cost: cost(1, 'R'), colors: ['R'], abilities: [spell([{ op: 'damage', n: 2, to: 'target' }], target('any'))],
    retell: { cost: cost(3, 'R') }, rarity: 'c', flavor: 'The lanterns go up every year; this one is coming down on you.',
  }),
  creature('dt-bayou-lamplighter', 'Bayou Lamplighter', ['Human', 'Lamplighter'], {
    cost: cost(1, 'G'), colors: ['G'], attack: 1, defense: 1,
    abilities: [arrives([{ op: 'createToken', token: 'tok-firefly', count: 1 }])], rarity: 'c',
    flavor: 'Her lamp is a firefly, and the firefly has opinions about the route.',
  }),
  creature('dt-canoe-carver-of-the-reef', 'Canoe-Carver of the Reef', ['Human', 'Carver'], {
    cost: cost(2, 'G'), colors: ['G'], attack: 2, defense: 4, skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'The canoe is finished when the ocean stops sending it back.',
  }),
  charm('dt-grandmothers-remedy', "Grandmother's Remedy", {
    cost: cost(1, 'G'), colors: ['G'], abilities: [spell([{ op: 'boost', p: 2, t: 2, keywords: ['wardingGaze'], scope: 'target' }], target('creature'))],
    retell: { cost: cost(2, 'G') }, rarity: 'c', flavor: 'Drink it all, dear; the wolf will not enjoy what you become.',
  }),
  artifactCreature('dt-paper-ballerina', 'Paper Ballerina', ['Construct', 'Ballerina'], {
    cost: cost(3), colors: [], attack: 2, defense: 2, nineLives: true, rarity: 'c',
    flavor: 'The stove took the soldier. She came out of it a little singed.',
  }),
  artifact('dt-pumpkin-shell-lantern', 'Pumpkin-Shell Lantern', ['Relic'], {
    cost: cost(2), colors: [], skim: { cost: cost(1) },
    abilities: [dawn([{ op: 'grind', n: 1, who: 'self' }, { op: 'gainLife', n: 1 }])],
    rarity: 'c', flavor: 'Midnight turned it back into a pumpkin; she turned it into a lamp.',
  }),
];

/** The 60-card Dark Tales companion wave, gated by FEATURES.dtCompanionLive. */
export const DARK_TALES_COMPANION = [...UR, ...SSR, ...SR, ...R, ...C] as const satisfies readonly CardDef[];
