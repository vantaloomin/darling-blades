import type { AbilityDef, CardDef, CardType, Color, EffectOp, TargetSpec } from '../../engine/types';
import { cost } from '../cardTypes';

type StarborneData = Omit<CardDef, 'id' | 'name' | 'types' | 'subtypes' | 'set'>;

const target = (what: TargetSpec['what']): TargetSpec[] => [{ what }];
const arrives = (ops: EffectOp[]): AbilityDef => ({ when: 'arrives', ops });
const arrivesTargeted = (
  spec: TargetSpec,
  ops: EffectOp[],
  condition?: AbilityDef['condition'],
): AbilityDef => ({
  when: 'arrives',
  ...(condition === undefined ? {} : { condition }),
  targets: [spec],
  ops,
});
const dawn = (ops: EffectOp[]): AbilityDef => ({ when: 'dawn', ops });
const spell = (ops: EffectOp[], what?: TargetSpec['what']): AbilityDef => ({
  when: 'spell',
  ...(what ? { targets: target(what) } : {}),
  ops,
});

function make(
  id: string,
  name: string,
  types: CardType[],
  subtypes: string[],
  data: StarborneData,
): CardDef {
  return { id, name, types, subtypes, ...data };
}

function creature(id: string, name: string, subtypes: string[], data: StarborneData): CardDef {
  return make(id, name, ['creature'], subtypes, data);
}

function artifact(id: string, name: string, data: StarborneData): CardDef {
  return make(id, name, ['artifact'], [], data);
}

function enchantment(id: string, name: string, data: StarborneData): CardDef {
  return make(id, name, ['enchantment'], [], data);
}

function charm(id: string, name: string, data: StarborneData): CardDef {
  return make(id, name, ['charm'], [], data);
}

function ritual(id: string, name: string, data: StarborneData): CardDef {
  return make(id, name, ['ritual'], [], data);
}

function land(id: string, name: string, manaAbility: (Color | 'C')[], rarity: StarborneData['rarity'], flavor: string): CardDef {
  return make(id, name, ['land'], [], {
    colors: [],
    entersTapped: true,
    manaAbility,
    rarity,
    flavor,
  });
}

const W: Color[] = ['W'];
const U: Color[] = ['U'];
const B: Color[] = ['B'];
const R: Color[] = ['R'];
const G: Color[] = ['G'];
const C: Color[] = [];

export const STARBORNE = [
  creature('sb-lumen-warder', 'Lumen Warder', ['Alien', 'Soldier'], {
    cost: cost(1, 'W'), colors: W, attack: 2, defense: 2, keywords: ['sentinel'], rarity: 'c',
    flavor: 'She keeps the docking ring bright enough for a fleet to find home.',
  }),
  creature('sb-orbit-guard', 'Orbit Guard', ['Soldier'], {
    cost: cost(2, 'W'), colors: W, attack: 2, defense: 4, keywords: ['wardingGaze'], rarity: 'c',
    flavor: 'Nothing crosses the orbital garden without her permission.',
  }),
  creature('sb-violet-medica', 'Violet Medica', ['Alien', 'Medic'], {
    cost: cost(2, 'W'), colors: W, attack: 2, defense: 3, abilities: [arrives([{ op: 'gainLife', n: 2 }])], rarity: 'c',
    flavor: 'Her hands glow violet where the wound used to be.',
  }),
  creature('sb-aurora-habitat', 'Aurora Habitat', ['Alien', 'Civilian'], {
    cost: cost(1, 'W'), colors: W, attack: 2, defense: 2,
    abilities: [{ when: 'gainsMark', ops: [{ op: 'gainLife', n: 1 }] }], rarity: 'c',
    flavor: 'Even the apartment blocks grow small halos at night.',
  }),
  creature('sb-cosmic-shieldmaiden', 'Cosmic Shieldmaiden', ['Vanguard'], {
    cost: cost(3, 'W'), colors: W, attack: 3, defense: 3, keywords: ['firstBlade'], rarity: 'c',
    flavor: 'Her shield is a polished piece of a dead moon.',
  }),
  creature('sb-radiant-deckhand', 'Radiant Deckhand', ['Deckhand'], {
    cost: cost(1, 'W'), colors: W, attack: 2, defense: 1, keywords: ['warcry'], rarity: 'c',
    flavor: 'She can cross a burning deck faster than a warning can travel.',
  }),
  creature('sb-white-comet-aide', 'White-Comet Aide', ['Alien', 'Aide'], {
    cost: cost(3, 'W'), colors: W, attack: 3, defense: 4,
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }])], rarity: 'c',
    flavor: 'Her smile is gentle. Her medical adhesive is not.',
  }),
  creature('sb-star-reader', 'Star Reader', ['Alien', 'Oracle'], {
    cost: cost(1, 'U'), colors: U, attack: 1, defense: 3, abilities: [arrives([{ op: 'foresee', n: 2 }])], rarity: 'c',
    flavor: 'She reads the stars as if they are gossiping in another room.',
  }),
  creature('sb-ion-bloom-scout', 'Ion-Bloom Scout', ['Scout'], {
    cost: cost(1, 'U'), colors: U, attack: 2, defense: 1, abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'c',
    flavor: 'The flowers on her helmet open whenever danger is near.',
  }),
  creature('sb-quasar-cartographer', 'Quasar Cartographer', ['Navigator'], {
    cost: cost(3, 'U'), colors: U, attack: 3, defense: 3, abilities: [arrives([{ op: 'foresee', n: 2 }])], rarity: 'c',
    flavor: 'She maps explosions by the shapes they leave in the dark.',
  }),
  creature('sb-void-blood-scavenger', 'Void-Blood Scavenger', ['Alien', 'Scavenger'], {
    cost: cost(1, 'B'), colors: B, attack: 2, defense: 2, keywords: ['deathblade'], rarity: 'c',
    flavor: 'She strips useful organs from wrecks before the wrecks cool.',
  }),
  creature('sb-eclipse-broodhunter', 'Eclipse Broodhunter', ['Hunter'], {
    cost: cost(2, 'B'), colors: B, attack: 3, defense: 2, abilities: [arrives([{ op: 'grind', n: 2, who: 'self' }])], rarity: 'c',
    flavor: 'She follows the dark patches where young things learn to hunt.',
  }),
  creature('sb-night-orbit-duelist', 'Night-Orbit Duelist', ['Duelist'], {
    cost: cost(2, 'B'), colors: B, attack: 3, defense: 2, keywords: ['firstBlade'], rarity: 'c',
    flavor: 'Her first cut is ceremonial. The second is for the audience.',
  }),
  creature('sb-violet-maw', 'Violet Maw', ['Alien', 'Beast'], {
    cost: cost(4, 'B'), colors: B, attack: 4, defense: 4, keywords: ['dreaded'], rarity: 'c',
    flavor: 'The nebula made her beautiful right up until she opened her mouth.',
  }),
  creature('sb-darkmatter-harvester', 'Darkmatter Harvester', ['Harvester'], {
    cost: cost(3, 'B'), colors: B, attack: 3, defense: 3, abilities: [arrives([{ op: 'severGrave', n: 1, who: 'opponent' }])], rarity: 'c',
    flavor: 'She harvests what the stars forgot to finish consuming.',
  }),
  creature('sb-stargrave-leech', 'Stargrave Leech', ['Parasite'], {
    cost: cost(1, 'B'), colors: B, attack: 1, defense: 2, abilities: [arrives([{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }])], rarity: 'c',
    flavor: 'It glows only after it has fed. The crew pretends not to notice.',
  }),
  creature('sb-flarewing-raider', 'Flarewing Raider', ['Alien', 'Raider'], {
    cost: cost(1, 'R'), colors: R, attack: 2, defense: 1, keywords: ['warcry'], rarity: 'c',
    flavor: 'She arrives with a grin and leaves with the emergency beacon.',
  }),
  creature('sb-chrome-meteorist', 'Chrome Meteorist', ['Mage'], {
    cost: cost(2, 'R'), colors: R, attack: 3, defense: 2,
    abilities: [arrivesTargeted({ what: 'any' }, [{ op: 'damage', n: 1, to: 'target' }])], rarity: 'c',
    flavor: 'She throws stones at the sky until the sky throws back.',
  }),
  creature('sb-ion-storm-brawler', 'Ion-Storm Brawler', ['Brawler'], {
    cost: cost(2, 'R'), colors: R, attack: 3, defense: 2,
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 1, t: 0 } }], rarity: 'c',
    flavor: "Her pulse runs hot enough to make the ship's ribs sing.",
  }),
  creature('sb-violet-thruster-ace', 'Violet Thruster Ace', ['Thruster', 'Ace'], {
    cost: cost(3, 'R'), colors: R, attack: 3, defense: 3, keywords: ['skyborne'], rarity: 'c',
    flavor: 'She treats a meteor shower as a crowded flight lane.',
  }),
  creature('sb-solar-riot-engineer', 'Solar Riot Engineer', ['Engineer'], {
    cost: cost(3, 'R'), colors: R, attack: 3, defense: 3,
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }])], rarity: 'c',
    flavor: 'She can turn a reactor leak into a weapon and a weapon into applause.',
  }),
  creature('sb-redshift-corsair', 'Redshift Corsair', ['Corsair'], {
    cost: cost(2, 'R'), colors: R, attack: 2, defense: 2, keywords: ['warcry'], skim: { cost: cost(1) }, rarity: 'c',
    flavor: 'She steals fuel with one hand and waves with the other.',
  }),
  creature('sb-comet-kick-marauder', 'Comet-Kick Marauder', ['Marauder'], {
    cost: cost(3, 'R'), colors: R, attack: 4, defense: 3, keywords: ['overrun'], rarity: 'c',
    flavor: 'Her boots leave impact craters in places the charts call floors.',
  }),
  creature('sb-starfire-lancer', 'Starfire Lancer', ['Soldier'], {
    cost: cost(2, 'R'), colors: R, attack: 3, defense: 2, keywords: ['firstBlade'], rarity: 'c',
    flavor: 'Her lance is a solar flare taught to hold still.',
  }),
  creature('sb-orbit-breaker', 'Orbit Breaker', ['Brute'], {
    cost: cost(4, 'R'), colors: R, attack: 4, defense: 4,
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'damage', n: 2, to: 'target' }])], rarity: 'c',
    flavor: 'She considers every orbit a personal insult.',
  }),
  creature('sb-burning-hull-runner', 'Burning Hull Runner', ['Alien', 'Runner'], {
    cost: cost(2, 'R'), colors: R, attack: 2, defense: 2,
    abilities: [{ when: 'static', condition: 'controlMarked', static: { scope: 'self', p: 1, t: 0 } }], rarity: 'c',
    flavor: 'She runs along the outside of the ship because the inside is boring.',
  }),
  creature('sb-mycelial-star-gardener', 'Mycelial Star Gardener', ['Alien', 'Druid'], {
    cost: cost(1, 'G'), colors: G, attack: 2, defense: 2,
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])], rarity: 'c',
    flavor: "She plants living constellations in the ship's hydroponics deck.",
  }),
  creature('sb-cometroot-grafter', 'Cometroot Grafter', ['Engineer'], {
    cost: cost(2, 'G'), colors: G, attack: 3, defense: 3,
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 1, t: 0 } }], rarity: 'c',
    flavor: 'She grafts alien roots to chrome and calls the result a garden.',
  }),
  creature('sb-voidvine-tender', 'Voidvine Tender', ['Alien', 'Gardener'], {
    cost: cost(2, 'G'), colors: G, attack: 2, defense: 3, abilities: [arrives([{ op: 'gainLife', n: 2 }])], rarity: 'c',
    flavor: 'She waters vines with captured moonlight.',
  }),
  creature('sb-living-hull-seedling', 'Living Hull Seedling', ['Starship'], {
    cost: cost(3, 'G'), colors: G, attack: 3, defense: 3, abilities: [arrives([{ op: 'propagate' }])], rarity: 'c',
    flavor: 'It is small enough to hug and old enough to remember a planet.',
  }),
  creature('sb-aurora-beastcaller', 'Aurora Beastcaller', ['Caller'], {
    cost: cost(4, 'G'), colors: G, attack: 4, defense: 4,
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }])], rarity: 'c',
    flavor: 'Her song wakes every sleeping engine in the valley.',
  }),
  creature('sb-star-orchard-keeper', 'Star Orchard Keeper', ['Alien', 'Farmer'], {
    cost: cost(3, 'G'), colors: G, attack: 3, defense: 3,
    abilities: [arrives([{ op: 'fetchLand' }])], rarity: 'c',
    flavor: 'She grows fruit that contains a complete weather system.',
  }),
  creature('sb-solar-canopy-guardian', 'Solar Canopy Guardian', ['Guardian'], {
    cost: cost(3, 'G'), colors: G, attack: 3, defense: 4, keywords: ['wardingGaze'], rarity: 'c',
    flavor: 'The canopy moves when she tells it to, and never before.',
  }),
  creature('sb-blooming-satellite', 'Blooming Satellite', ['Starship'], {
    cost: cost(5, 'G'), colors: G, attack: 5, defense: 5, abilities: [arrives([{ op: 'propagate' }])], rarity: 'c',
    flavor: 'Its antennae flower whenever another hull learns to live.',
  }),
  charm('sb-prism-deflection', 'Prism Deflection', {
    cost: cost(1, 'W'), colors: W,
    abilities: [spell([{ op: 'boost', p: 0, t: 3, scope: 'target' }, { op: 'preventCombat' }], 'creature')], rarity: 'c',
    flavor: 'A shield can be a wall, a mirror, or a very pointed suggestion.',
  }),
  ritual('sb-orbital-cleansing', 'Orbital Cleansing', {
    cost: cost(1, 'WB'), colors: ['W', 'B'], abilities: [spell([{ op: 'sever', to: 'target' }], 'creature')], rarity: 'c',
    flavor: 'The cleanest orbit is the one with nothing left to collide.',
  }),
  artifact('sb-chrome-medallion', 'Chrome Medallion', {
    cost: cost(2), colors: C, abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'c',
    flavor: 'A crew badge, a key, and a small lie about rank.',
  }),
  ritual('sb-cometary-verdict', 'Cometary Verdict', {
    cost: cost(3, 'W'), colors: W,
    abilities: [{ when: 'spell', targets: [{ what: 'creature', tapped: true }], ops: [{ op: 'sever', to: 'target' }] }], rarity: 'c',
    flavor: 'The tribunal waits until the target has nowhere left to run.',
  }),
  land('sb-pale-nebula', 'Pale Nebula', ['W'], 'c', 'The cloud looks soft until you try to navigate it.'),
  charm('sb-signal-inversion', 'Signal Inversion', {
    cost: cost(1, 'U'), colors: U,
    abilities: [spell([
      { op: 'recall', to: 'target' },
      { op: 'foresee', n: 1, who: 'targetOwner' },
    ], 'creature')], rarity: 'c',
    flavor: 'A perfect reply is just a message sent back sharpened.',
  }),
  charm('sb-prism-current', 'Prism Current', {
    cost: cost(1, 'U'), colors: U, abilities: [spell([{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }])], rarity: 'c',
    flavor: 'The current carries away bad options and leaves the useful ones bright.',
  }),
  enchantment('sb-relay-station', 'Relay Station', {
    cost: cost(3, 'U'), colors: U, abilities: [dawn([{ op: 'foresee', n: 1 }])], rarity: 'c',
    flavor: 'It has not missed a signal in four hundred years.',
  }),
  ritual('sb-sky-map', 'Sky Map', {
    cost: cost(1), colors: C, skim: { cost: cost(1) }, abilities: [spell([{ op: 'foresee', n: 1 }])], rarity: 'c',
    flavor: 'Fold it once and it becomes a route through the impossible.',
  }),
  land('sb-deepfield-lands', 'Deepfield Lands', ['U'], 'c', 'The deep field is quiet because everything there is listening.'),
  charm('sb-night-market-bargain', 'Night-Market Bargain', {
    cost: cost(2, 'B'), colors: B, abilities: [spell([{ op: 'draw', n: 1 }, { op: 'loseLife', n: 1, who: 'opponent' }])], rarity: 'c',
    flavor: 'The seller offers memories, replacement organs, and a discount for honesty.',
  }),
  artifact('sb-umbral-antenna', 'Umbral Antenna', {
    cost: cost(4), colors: B,
    abilities: [
      arrives([{ op: 'grind', n: 1, who: 'self' }]),
      dawn([{ op: 'foresee', n: 1 }, { op: 'grind', n: 1, who: 'self' }]),
      {
        when: 'dawn',
        condition: { kind: 'markedThreshold', n: 4, subject: 'creatures' },
        ops: [{ op: 'severSelf' }, { op: 'raise', to: 'top', withMarks: 2 }],
      },
    ], rarity: 'c',
    flavor: 'It receives transmissions from places that have no coordinates.',
  }),
  charm('sb-corpse-lantern', 'Corpse Lantern', {
    cost: cost(1, 'B'), colors: B, abilities: [spell([{ op: 'damage', n: 2, to: 'target' }, { op: 'gainLife', n: 1 }], 'any')], rarity: 'c',
    flavor: 'It burns with the last useful thought in a dead thing.',
  }),
  land('sb-darkside-landing', 'Darkside Landing', ['B'], 'c', 'The landing lights are violet because red would look too hopeful.'),
  ritual('sb-flareburst', 'Flareburst', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 2, to: 'target' }], 'any')], rarity: 'c',
    flavor: 'The smallest star can still ruin a morning.',
  }),
  charm('sb-solar-arc', 'Solar Arc', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 1, to: 'target' }, { op: 'damage', n: 1, to: 'opponent' }], 'creature')], rarity: 'c',
    flavor: 'The shot curves around the hull to make a point.',
  }),
  enchantment('sb-ignition-hymn', 'Ignition Hymn', {
    cost: cost(3, 'R'), colors: R,
    abilities: [{ when: 'markedAllyAttacks', ops: [{ op: 'boost', p: 1, t: 0, scope: 'yourMarked' }] }], rarity: 'c',
    flavor: 'The crew sings in perfect rhythm with the reactor alarms.',
  }),
  artifact('sb-redline-salvage', 'Redline Salvage', {
    cost: cost(2), colors: R, skim: { cost: cost(1) },
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }])], rarity: 'c',
    flavor: 'It was scrap until someone gave it a pulse.',
  }),
  ritual('sb-starfall-barrage', 'Starfall Barrage', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 4, to: 'target' }], 'creature')], rarity: 'c',
    flavor: 'A small meteor is still a large argument.',
  }),
  land('sb-ember-lane', 'Ember Lane', ['R'], 'c', 'The lane is hot, crowded, and officially one-way.'),
  charm('sb-warhead-glint', 'Warhead Glint', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'boost', p: 3, t: 1, keywords: ['warcry'], scope: 'target' }], 'creature')], rarity: 'c',
    flavor: 'Her war paint is an emergency light with excellent cheekbones.',
  }),
  charm('sb-root-of-light', 'Root of Light', {
    cost: cost(1, 'G'), colors: G, abilities: [spell([{ op: 'addCounters', n: 1, to: 'target' }, { op: 'gainLife', n: 1 }], 'creature')], rarity: 'c',
    flavor: 'The roots drink starlight and return it as courage.',
  }),
  ritual('sb-gravitic-bloom', 'Gravitic Bloom', {
    cost: cost(3, 'G'), colors: G,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature', upTo: 2 }],
      ops: [{ op: 'addCounters', n: 1, to: 'target' }],
    }], rarity: 'c',
    flavor: 'The flowers open toward the heaviest thing in the room.',
  }),
  enchantment('sb-orbital-graft', 'Orbital Graft', {
    cost: cost(2, 'G'), colors: G,
    abilities: [{ when: 'allyCreatureArrives', ops: [{ op: 'addCounters', n: 1, to: 'target' }] }], rarity: 'c',
    flavor: 'The garden does not distinguish between crew and crop.',
  }),
  land('sb-overcanopy', 'Overcanopy', ['G'], 'c', 'A green aurora hangs low enough to touch from the watch deck.'),
  artifact('sb-starborne-relay', 'Starborne Relay', {
    cost: cost(5), colors: C,
    abilities: [
      arrives([{ op: 'draw', n: 1 }]),
      dawn([{ op: 'foresee', n: 1 }]),
      {
        when: 'dawn',
        condition: { kind: 'markedThreshold', n: 4, subject: 'creatures' },
        ops: [{ op: 'draw', n: 1 }],
      },
    ], rarity: 'c',
    flavor: 'It carries a message from every deck and forgets none of them.',
  }),
  artifact('sb-null-orbit-array', 'Null-Orbit Array', {
    cost: cost(1), colors: C, skim: { cost: cost(2) }, abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'c',
    flavor: 'Its one job is to make the impossible route look routine.',
  }),
make('sb-interstellar-crossing', 'Interstellar Crossing', ['land'], [], {
    colors: C, entersTapped: true, manaAbility: ['C'], rarity: 'c',
    flavor: 'The crossing takes three days if you walk and one blink if you trust it.',
  }),
  artifact('sb-violet-wake-beacon', 'Violet Wake Beacon', {
    cost: cost(6), colors: C,
    abilities: [
      arrives([{ op: 'createToken', token: 'tok-nebula-firefly', count: 1 }]),
      { when: 'dawn', condition: 'controlMarked', ops: [{ op: 'createToken', token: 'tok-nebula-firefly', count: 1 }] },
    ], rarity: 'c',
    flavor: 'Its pulse is a welcome, a warning, and a dinner bell.',
  }),
  creature('sb-prism-chorister', 'Prism Chorister', ['Alien', 'Singer'], {
    cost: cost(2, 'W'), colors: W, attack: 3, defense: 3, keywords: ['sentinel'], rarity: 'r',
    flavor: 'Her voice turns a battle line into a constellation.',
  }),
  creature('sb-ivory-orbit-vanguard', 'Ivory Orbit Vanguard', ['Vanguard'], {
    cost: cost(3, 'W'), colors: W, attack: 3, defense: 4, keywords: ['firstBlade'], rarity: 'r',
    flavor: 'She holds the front until the stars behind her have moved.',
  }),
  creature('sb-chrome-choir-envoy', 'Chrome Choir Envoy', ['Alien', 'Diplomat'], {
    cost: cost(2, 'W'), colors: W, attack: 2, defense: 3, keywords: ['skyborne'], rarity: 'r',
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true, other: true }, p: 1, t: 0 } }],
    flavor: 'She sings harmony into engines that were designed for war.',
  }),
  creature('sb-aurora-line-captain', 'Aurora-Line Captain', ['Commander'], {
    cost: cost(4, 'W'), colors: W, attack: 4, defense: 4, keywords: ['sentinel'],
    abilities: [arrives([{ op: 'boost', p: 1, t: 0, scope: 'allYours' }])], rarity: 'r',
    flavor: 'Her command is a sunrise that nobody argues with.',
  }),
  creature('sb-velvet-void-cartographer', 'Velvet Void Cartographer', ['Navigator'], {
    cost: cost(2, 'U'), colors: U, attack: 2, defense: 3, abilities: [arrives([{ op: 'foresee', n: 2 }])], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'Her maps are soft, precise, and illegal in four systems.',
  }),
  creature('sb-astral-biomancer', 'Astral Biomancer', ['Alien', 'Mage'], {
    cost: cost(4, 'U'), colors: U, attack: 3, defense: 4, rarity: 'r',
    abilities: [arrivesTargeted(
      { what: 'yourPermanent', other: true },
      [{ op: 'addCounters', n: 1, to: 'target' }, { op: 'foresee', n: 1 }],
      'controlMarked',
    )],
    flavor: 'She grows new organs for ships that have outlived their owners.',
  }),
  creature('sb-tideglass-archivist', 'Tideglass Archivist', ['Archivist'], {
    cost: cost(3, 'U'), colors: U, attack: 2, defense: 4, abilities: [arrives([{ op: 'draw', n: 1 }, { op: 'grind', n: 1, who: 'self' }])], rarity: 'r',
    flavor: 'Every archive has a tide. She waits for the useful things to wash in.',
  }),
  creature('sb-void-choir-reclaimer', 'Void Choir Reclaimer', ['Alien', 'Singer'], {
    cost: cost(3, 'B'), colors: B, attack: 3, defense: 3, keywords: ['deathblade'],
    abilities: [{ when: 'dies', ops: [{ op: 'grind', n: 2, who: 'self' }] }], rarity: 'r',
    flavor: 'Her last note is always the first note of something worse.',
  }),
  creature('sb-eclipse-garden-devourer', 'Eclipse Garden Devourer', ['Alien', 'Beast'], {
    cost: cost(3, 'B'), colors: B, attack: 4, defense: 4, keywords: ['bloodoath'], rarity: 'r',
    flavor: 'It blooms under a dead sun and feeds on anything that applauds.',
  }),
  creature('sb-severance-priestess', 'Severance Priestess', ['Priestess'], {
    cost: cost(2, 'B'), colors: B, attack: 2, defense: 3, abilities: [arrives([{ op: 'severGrave', n: 2, who: 'opponent' }])], rarity: 'r',
    flavor: 'She blesses the dead by making sure nobody can use them twice.',
  }),
  creature('sb-void-halo-assassin', 'Void-Halo Assassin', ['Assassin'], {
    cost: cost(3, 'B'), colors: B, attack: 3, defense: 2, keywords: ['deathblade'], skim: { cost: cost(1) }, rarity: 'r',
    flavor: 'Her halo is a warning label written in ultraviolet.',
  }),
  creature('sb-flare-orbit-captain', 'Flare-Orbit Captain', ['Commander'], {
    cost: cost(2, 'RR'), colors: R, attack: 4, defense: 3, keywords: ['warcry'], rarity: 'r',
    flavor: 'She takes the helm when the ship is on fire and complains when it is not.',
  }),
  creature('sb-chrome-sunbreaker', 'Chrome Sunbreaker', ['Brute'], {
    cost: cost(3, 'R'), colors: R, attack: 4, defense: 4, keywords: ['overrun'], rarity: 'r',
    flavor: 'She breaks suns for the same reason others break locks.',
  }),
  creature('sb-violet-thrust-engineer', 'Violet-Thrust Engineer', ['Engineer'], {
    cost: cost(3, 'R'), colors: R, attack: 3, defense: 3, rarity: 'r',
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])],
    flavor: 'Her engines run on bad ideas and very good timing.',
  }),
  creature('sb-solar-flare-bruiser', 'Solar-Flare Bruiser', ['Brawler'], {
    cost: cost(3, 'R'), colors: R, attack: 3, defense: 2, rarity: 'r',
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'damage', n: 1, to: 'target' }])],
    flavor: 'She calls every repair bill a souvenir.',
  }),
  creature('sb-rootlight-navigator', 'Rootlight Navigator', ['Navigator'], {
    cost: cost(2, 'G'), colors: G, attack: 3, defense: 3, rarity: 'r',
    abilities: [arrives([{ op: 'fetchLand' }])],
    flavor: 'She steers by the living roots woven through the hull.',
  }),
  creature('sb-emerald-bloom-mother', 'Emerald Bloom Mother', ['Alien', 'Matriarch'], {
    cost: cost(4, 'G'), colors: G, attack: 4, defense: 4, abilities: [arrives([{ op: 'propagate' }])], rarity: 'r',
    flavor: 'Her children are seeds, ships, and sometimes a very large problem.',
  }),
  creature('sb-orchard-of-stars-keeper', 'Orchard-of-Stars Keeper', ['Alien', 'Farmer'], {
    cost: cost(3, 'G'), colors: G, attack: 2, defense: 4, rarity: 'r',
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }, { op: 'gainLife', n: 2 }])],
    flavor: 'Her orchard bears fruit only after a good argument with gravity.',
  }),
  creature('sb-radiant-moss-mender', 'Radiant Moss Mender', ['Alien', 'Druid'], {
    cost: cost(2, 'G'), colors: G, attack: 2, defense: 2, rarity: 'r',
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])],
    flavor: 'She fixes broken chrome with moss that remembers its shape.',
  }),
  creature('sb-chrome-aurora-commandant', 'Chrome-Aurora Commandant', ['Alien', 'Commander'], {
    supertypes: ['legendary'], cost: cost(3, 'WU'), colors: ['W', 'U'], attack: 4, defense: 4, keywords: ['skyborne'], rarity: 'r',
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 1, t: 1 } }],
    flavor: 'She commands in two colors of light and never repeats an order.',
  }),
  creature('sb-cinder-nebula-raider', 'Cinder-Nebula Raider', ['Corsair'], {
    supertypes: ['legendary'], cost: cost(3, 'BR'), colors: ['B', 'R'], attack: 4, defense: 3, keywords: ['warcry'], rarity: 'r',
    abilities: [{ when: 'gainsMark', ops: [{ op: 'damage', n: 2, to: 'opponent' }] }],
    flavor: 'She paints her hull with the names of planets she has robbed.',
  }),
  creature('sb-orbitroot-matriarch', 'Orbitroot Matriarch', ['Alien', 'Matriarch'], {
    supertypes: ['legendary'], cost: cost(3, 'RG'), colors: ['R', 'G'], attack: 4, defense: 4, keywords: ['overrun'], abilities: [arrives([{ op: 'propagate' }])], rarity: 'r',
    flavor: 'Her roots cross three decks and all of them are armed.',
  }),
  enchantment('sb-white-signal-bastion', 'White-Signal Bastion', {
    cost: cost(3, 'W'), colors: W,
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 0, t: 2 } }], rarity: 'r',
    flavor: 'The bastion is grown from a single pearl of hull tissue.',
  }),
  artifact('sb-blue-echo-array', 'Blue-Echo Array', {
    cost: cost(1), colors: C, skim: { cost: cost(1) }, abilities: [arrives([{ op: 'foresee', n: 2 }])], rarity: 'r',
    flavor: 'It remembers every route the ship almost took.',
  }),
  ritual('sb-black-starving-orbit', 'Black-Starving Orbit', {
    cost: cost(3, 'B'), colors: B, abilities: [{
      when: 'spell',
      targets: [{ what: 'creature', marked: true }],
      ops: [{ op: 'sever', to: 'target' }],
    }], rarity: 'r',
    flavor: 'It circles the target until the target forgets why it was afraid.',
  }),
  charm('sb-red-solar-lash', 'Red-Solar Lash', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 3, to: 'target' }], 'creature')], rarity: 'r',
    flavor: 'The lash leaves a red line across the darkness and nothing else.',
  }),
  ritual('sb-green-propagation-chorus', 'Green Propagation Chorus', {
    cost: cost(4, 'G'), colors: G, abilities: [spell([{ op: 'propagate' }, { op: 'gainLife', n: 2 }])], rarity: 'r',
    flavor: 'The chorus begins with one throat and ends with the whole garden.',
  }),
  artifact('sb-chromelight-lattice', 'Chromelight Lattice', {
    cost: cost(3), colors: C,
    abilities: [
      arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }]),
      { when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 0, t: 1 } },
    ], rarity: 'r',
    flavor: 'It is a fence, a nursery, and a very patient weapon.',
  }),
  land('sb-pale-violet-crossing', 'Pale-Violet Crossing', ['W', 'U'], 'r', 'The crossing shines brightest where two currents disagree.'),
  land('sb-eclipse-docking-ring', 'Eclipse Docking Ring', ['W', 'B'], 'r', 'The ring accepts every ship and trusts none of them.'),
  land('sb-ember-void-rail', 'Ember-Void Rail', ['B', 'R'], 'r', 'The rail is hot enough to cauterize a bad decision.'),
  land('sb-radiant-comet-lane', 'Radiant-Comet Lane', ['R', 'G'], 'r', 'Comets mark the safe turns for anyone brave enough to follow.'),
  land('sb-aurora-reefway', 'Aurora Reefway', ['G', 'U'], 'r', 'The reef glows whenever a living ship passes above it.'),
  creature('sb-prismatic-fleet-marshal', 'Prismatic Fleet Marshal', ['Alien', 'Commander'], {
    cost: cost(4, 'W'), colors: W, attack: 4, defense: 4, keywords: ['sentinel'], abilities: [arrives([{ op: 'propagate' }])], rarity: 'sr',
    flavor: 'Her fleet forms a flower around the enemy before it closes.',
  }),
  creature('sb-eclipse-blood-artist', 'Eclipse Blood Artist', ['Alien', 'Artist'], {
    cost: cost(3, 'B'), colors: B, attack: 3, defense: 3, keywords: ['bloodoath'],
    abilities: [{ when: 'gainsMark', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }], rarity: 'sr',
    flavor: 'She paints with light stolen from the moment a star dies.',
  }),
  creature('sb-ember-orbit-exarch', 'Ember-Orbit Exarch', ['Alien', 'Priestess'], {
    cost: cost(3, 'R'), colors: R, attack: 4, defense: 3, keywords: ['warcry'], rarity: 'sr',
    flavor: 'Her sermons begin with a spark and end with a crater.',
  }),
  creature('sb-rootlight-broodmother', 'Rootlight Broodmother', ['Alien', 'Matriarch'], {
    cost: cost(4, 'G'), colors: G, attack: 4, defense: 5, abilities: [arrives([{ op: 'propagate' }, { op: 'createToken', token: 'tok-broodling', count: 1 }])], rarity: 'sr',
    flavor: 'She births a swarm from the roots of a starship.',
  }),
  creature('sb-moonlit-hull-repairer', 'Moonlit Hull Repairer', ['Engineer'], {
    cost: cost(3, 'W'), colors: W, attack: 3, defense: 5, keywords: ['sentinel'], rarity: 'sr',
    flavor: 'She repairs the ship with one hand and the crew with the other.',
  }),
  creature('sb-voidcurrent-conjurer', 'Voidcurrent Conjurer', ['Alien', 'Mage'], {
    cost: cost(3, 'U'), colors: U, attack: 3, defense: 3, keywords: ['skyborne'], abilities: [arrives([{ op: 'foresee', n: 3 }])], rarity: 'sr',
    flavor: 'She braids a current through empty space and calls it a road.',
  }),
  creature('sb-solar-thruster-herald', 'Solar-Thruster Herald', ['Alien', 'Herald'], {
    cost: cost(3, 'R'), colors: R, attack: 3, defense: 3, keywords: ['skyborne', 'warcry'],
    abilities: [{ when: 'gainsMark', ops: [{ op: 'damage', n: 2, to: 'opponent' }] }], rarity: 'sr',
    flavor: 'Her arrival is always announced by the sound of something breaking.',
  }),
  creature('sb-ringworld-bloomkeeper', 'Ringworld Bloomkeeper', ['Alien', 'Druid'], {
    cost: cost(4, 'G'), colors: G, attack: 3, defense: 4, keywords: ['wardingGaze'],
    abilities: [{ when: 'otherCreatureMarked', ops: [{ op: 'gainLife', n: 1 }] }], rarity: 'sr',
    flavor: 'She tends a garden that encircles a world and still wants more room.',
  }),
  creature('sb-chrome-veil-admiral', 'Chrome-Veil Admiral', ['Alien', 'Commander'], {
    supertypes: ['legendary'], cost: cost(4, 'WU'), colors: ['W', 'U'], attack: 4, defense: 4, keywords: ['skyborne'],
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 1, t: 1 } }], rarity: 'sr',
    flavor: 'Her veil is a tactical display that looks like a storm of glass.',
  }),
  creature('sb-violet-eclipse-weaver', 'Violet-Eclipse Weaver', ['Alien', 'Weaver'], {
    supertypes: ['legendary'], cost: cost(3, 'BR'), colors: ['B', 'R'], attack: 4, defense: 4, keywords: ['deathblade'],
    abilities: [arrives([{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }])], rarity: 'sr',
    flavor: 'She weaves the last light from a dying sun into a weapon.',
  }),
  enchantment('sb-propagation-engine', 'Propagation Engine', {
    cost: cost(4), colors: C, abilities: [dawn([{ op: 'propagate' }])], rarity: 'sr',
    flavor: 'The machine has no guide because the whole ship is its nervous system.',
  }),
  ritual('sb-deep-space-severance', 'Deep-Space Severance', {
    cost: cost(2, 'B'), colors: B, abilities: [spell([{ op: 'sever', to: 'target' }, { op: 'severGrave', n: 1, who: 'opponent' }], 'creature')], rarity: 'sr',
    flavor: 'It cuts through armor, memory, and the comfort of distance.',
  }),
  charm('sb-hullwake-overdrive', 'Hullwake Overdrive', {
    cost: cost(0, 'R'), colors: R, abilities: [spell([{ op: 'boost', p: 3, t: 0, keywords: ['warcry'], scope: 'target' }], 'creature')], rarity: 'sr',
    flavor: 'The ship gives one crew member permission to become the weather.',
  }),
  creature('sb-queen-of-the-living-hull', 'Queen of the Living Hull', ['Alien', 'Queen'], {
    supertypes: ['legendary'], cost: cost(5, 'W'), colors: W, attack: 5, defense: 5, keywords: ['sentinel'], rarity: 'ssr',
    abilities: [
      arrives([{ op: 'propagate' }]),
      { when: 'static', static: { scope: 'filter', filter: { marked: true, other: true }, p: 1, t: 1 } },
    ],
    flavor: "She wears the ship's living crown and listens through every wall.",
  }),
  creature('sb-astral-reef-singer', 'Astral Reef Singer', ['Alien', 'Singer'], {
    supertypes: ['legendary'], cost: cost(7, 'U'), colors: U, attack: 4, defense: 5, keywords: ['skyborne'], abilities: [dawn([{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }])], rarity: 'ssr',
    flavor: 'Her song makes reefs bloom in the vacuum between systems.',
  }),
  creature('sb-hellion-of-the-redshift', 'Hellion of the Redshift', ['Alien', 'Beast'], {
    supertypes: ['legendary'], cost: cost(3, 'R'), colors: R, attack: 5, defense: 4, keywords: ['warcry', 'overrun'], rarity: 'ssr',
    flavor: 'It is a living engine with a temper and no reverse gear.',
  }),
  creature('sb-worldroot-shipmind', 'Worldroot Shipmind', ['Starship'], {
    supertypes: ['legendary'], cost: cost(5, 'G'), colors: G, attack: 5, defense: 6, abilities: [arrives([{ op: 'propagate' }, { op: 'createToken', token: 'tok-broodling', count: 2 }])], rarity: 'ssr',
    flavor: 'The ship grew a mind so large that the crew became its weather.',
  }),
  creature('sb-chrome-violet-archon', 'Chrome-Violet Archon', ['Alien', 'Archon'], {
    supertypes: ['legendary'], cost: cost(5, 'WU'), colors: ['W', 'U'], attack: 5, defense: 5, keywords: ['skyborne'], rarity: 'ssr',
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, grantKeywords: ['sentinel'] } }],
    flavor: 'She was born in a flash of chrome and immediately issued a safety protocol.',
  }),
  creature('sb-voidflare-empress', 'Voidflare Empress', ['Alien', 'Empress'], {
    supertypes: ['legendary'], cost: cost(5, 'BR'), colors: ['B', 'R'], attack: 5, defense: 4, keywords: ['dreaded', 'warcry'], rarity: 'ssr',
    abilities: [{ when: 'yourCreatureMarked', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }] }],
    flavor: 'Her court follows wherever the signal becomes dangerous.',
  }),
  artifact('sb-signal-cathedral', 'Signal Cathedral', {
    supertypes: ['legendary'], cost: cost(5), colors: C,
    abilities: [
      dawn([{ op: 'foresee', n: 2 }]),
      {
        when: 'dawn',
        condition: { kind: 'markedThreshold', n: 5, subject: 'permanents' },
        ops: [{ op: 'draw', n: 1 }],
      },
    ], rarity: 'ssr',
    flavor: 'The cathedral is a receiver built for a god that may be the ship.',
  }),
  enchantment('sb-propagation-choir', 'Propagation Choir', {
    cost: cost(4, 'G'), colors: G,
    abilities: [{ when: 'youAddMark', ops: [{ op: 'gainLife', n: 1 }, { op: 'createToken', token: 'tok-broodling', count: 1 }] }], rarity: 'ssr',
    flavor: 'The first singer starts the chorus. The hull supplies the harmony.',
  }),
  ritual('sb-starborne-apotheosis', 'Starborne Apotheosis', {
    cost: cost(6, 'W'), colors: W, abilities: [spell([
      { op: 'propagate' },
      { op: 'gainLife', n: 5 },
      { op: 'boost', p: 1, t: 1, scope: 'yourMarked' },
    ])], rarity: 'ssr',
    flavor: 'The crew does not ascend. The whole ship rises with them.',
  }),
  ritual('sb-redline-supernova', 'Redline Supernova', {
    cost: cost(2, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 3, to: 'eachCreature', severOnDeath: true }])], rarity: 'ssr',
    flavor: 'The detonation is visible from three systems and remembered in four.',
  }),
  creature('sb-constellation-matriarch', 'Constellation Matriarch', ['Alien', 'Matriarch'], {
    supertypes: ['legendary'], cost: cost(5, 'W'), colors: W, attack: 5, defense: 6, keywords: ['skyborne', 'sentinel'], rarity: 'ur',
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true, other: true }, p: 1, t: 1 } }],
    flavor: 'She wears a living constellation as a crown and calls it family.',
  }),
  creature('sb-abyssal-iris-regent', 'Abyssal Iris Regent', ['Alien', 'Regent'], {
    supertypes: ['legendary'], cost: cost(4, 'B'), colors: B, attack: 6, defense: 5, keywords: ['deathblade', 'bloodoath'],
    abilities: [{ when: 'dies', ops: [{ op: 'severGrave', n: 3, who: 'opponent' }] }], rarity: 'ur',
    flavor: 'Her irises are windows into a night that wants to come closer.',
  }),
  creature('sb-solar-flare-sovereign', 'Solar-Flare Sovereign', ['Alien', 'Sovereign'], {
    supertypes: ['legendary'], cost: cost(5, 'R'), colors: R, attack: 6, defense: 5, keywords: ['warcry', 'overrun'], rarity: 'ur',
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'damage', n: 3, to: 'target' }])],
    flavor: 'She does not enter combat. Combat enters her orbit.',
  }),
  creature('sb-worldgarden-leviathan', 'Worldgarden Leviathan', ['Alien', 'Beast'], {
    supertypes: ['legendary'], cost: cost(6, 'G'), colors: G, attack: 7, defense: 7, keywords: ['overrun'],
    abilities: [arrives([{ op: 'propagate' }, { op: 'createToken', token: 'tok-chrome-husk', count: 2 }])], rarity: 'ur',
    flavor: 'It carries a garden on its back and a moon in its shadow.',
  }),
  creature('sb-prism-void-comet', 'Prism-Void Comet', ['Alien', 'Comet'], {
    supertypes: ['legendary'], cost: cost(6, 'WU'), colors: ['W', 'U'], attack: 6, defense: 6, keywords: ['skyborne', 'untouchable'], rarity: 'ur',
    abilities: [{ when: 'propagated', ops: [{ op: 'draw', n: 1 }] }],
    flavor: 'It is a living starship, a woman, and a promise moving too fast to catch.',
  }),
  creature('sb-eclipse-red-queen', 'Eclipse-Red Queen', ['Alien', 'Queen'], {
    supertypes: ['legendary'], cost: cost(6, 'BR'), colors: ['B', 'R'], attack: 7, defense: 5, keywords: ['dreaded', 'warcry'], rarity: 'ur',
    abilities: [{ when: 'markedAllyAttacks', ops: [{ op: 'damage', n: 1, to: 'opponent' }] }],
    flavor: 'Her red court arrives after the eclipse and leaves before the mourning.',
  }),
  artifact('sb-halo-motherboard', 'Halo Motherboard', {
    supertypes: ['legendary'], cost: cost(6), colors: C,
    abilities: [
      arrives([{ op: 'propagate' }]),
      { when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 1, t: 1 } },
      dawn([{ op: 'foresee', n: 1 }]),
    ], rarity: 'ur',
    flavor: 'It is the first machine the fleet built that can dream in plural.',
  }),
  charm('sb-quiet-orbit', 'Quiet Orbit', {
    cost: cost(2, 'U'), colors: U, abilities: [{
      when: 'spell',
      targets: [{ what: 'spell' }, { what: 'yourPermanent' }, { what: 'yourPermanent' }],
      ops: [{ op: 'cancel', to: 'target' }, { op: 'moveMark' }],
    }], rarity: 'c',
    flavor: 'The silence between two signals is where she does her work.',
  }),
  charm('sb-marrow-eviction', 'Marrow Eviction', {
    cost: cost(1, 'B'), colors: B, abilities: [spell([{
      op: 'ifTargetMarked',
      then: [{ op: 'boost', p: -4, t: -4, scope: 'target' }],
      else: [{ op: 'boost', p: -2, t: -2, scope: 'target' }],
    }], 'creature')], rarity: 'c',
    flavor: 'What the hull grew, the dark unmakes first.',
  }),
  charm('sb-signal-drown', 'Signal Drown', {
    cost: cost(1, 'UU'), colors: U, abilities: [
      spell([{ op: 'cancel', to: 'target' }], 'spell'),
      { when: 'spell', condition: 'controlMarked', ops: [{ op: 'draw', n: 1 }] },
    ], rarity: 'c',
    flavor: 'Her answer arrives before the question finishes forming.',
  }),
  charm('sb-collapse-the-lane', 'Collapse the Lane', {
    cost: cost(3, 'U'), colors: U, abilities: [spell([{ op: 'cancel', to: 'target' }, { op: 'foresee', n: 2 }], 'spell')], rarity: 'r',
    flavor: 'The lane was there a moment ago. She is certain of it.',
  }),
  creature('sb-drydock-carapace', 'Drydock Carapace', ['Starship'], {
    cost: cost(1, 'W'), colors: W, attack: 0, defense: 4, keywords: ['bulwark'], abilities: [arrives([{ op: 'addCounters', n: 1, to: 'self' }])], rarity: 'c',
    flavor: 'It was grown around the dock, and now the dock is part of it.',
  }),
  creature('sb-hullplate-bastion', 'Hullplate Bastion', ['Alien', 'Warden'], {
    cost: cost(2, 'G'), colors: G, attack: 1, defense: 5, keywords: ['bulwark'], rarity: 'c',
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])],
    flavor: 'She feeds the garden first and the guns second.',
  }),
  creature('sb-static-reef', 'Static Reef', ['Alien', 'Reef'], {
    cost: cost(3, 'U'), colors: U, attack: 2, defense: 6, keywords: ['bulwark'], rarity: 'r',
    abilities: [{ when: 'yourPermanentMarked', ops: [{ op: 'foresee', n: 1 }] }],
    flavor: 'The reef hears every new signal before its crew does.',
  }),
  creature('sb-ossuary-gate', 'Ossuary Gate', ['Starship'], {
    cost: cost(2, 'B'), colors: B, attack: 1, defense: 4, keywords: ['bulwark'], rarity: 'r',
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true, who: 'opponent' }, p: -1, t: 0 } }],
    flavor: 'The gate remembers what the light did to it.',
  }),
  creature('sb-lance-of-two-suns', 'Lance of Two Suns', ['Alien', 'Duelist'], {
    cost: cost(2, 'R'), colors: R, attack: 2, defense: 1, keywords: ['twinBlades'], rarity: 'c',
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])],
    flavor: 'Two stars rose over her homeworld. She fights like both of them.',
  }),
  creature('sb-mirrorblade-consort', 'Mirrorblade Consort', ['Lumenborn'], {
    cost: cost(3, 'W'), colors: W, attack: 2, defense: 3, keywords: ['twinBlades', 'sentinel'], rarity: 'r',
    flavor: 'Her reflection guards the door she is not standing at.',
  }),
  creature('sb-splitlight-corsair', 'Splitlight Corsair', ['Alien', 'Corsair'], {
    cost: cost(4, 'G'), colors: G, attack: 3, defense: 4, keywords: ['twinBlades'], rarity: 'r',
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])],
    flavor: 'The prism split her once and neither half agreed to stop.',
  }),
  charm('sb-relay-bloom', 'Relay Bloom', {
    cost: cost(1, 'G'), colors: G, abilities: [spell([{ op: 'addCounters', n: 1, to: 'target' }], 'creature')], retell: { cost: cost(2, 'G') }, rarity: 'c',
    flavor: 'The garden repeats what it liked hearing.',
  }),
  charm('sb-echo-burst', 'Echo Burst', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 2, to: 'target' }], 'any')], retell: { cost: cost(2, 'R') }, rarity: 'c',
    flavor: 'The shot arrives twice because the corridor insisted.',
  }),
  charm('sb-signal-recall', 'Signal Recall', {
    cost: cost(1, 'U'), colors: U,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'yourPermanent' }, { what: 'yourPermanent' }],
      ops: [{ op: 'moveMark' }],
    }],
    retell: { cost: cost(2, 'U') }, rarity: 'c',
    flavor: 'She files the light somewhere safer.',
  }),
  charm('sb-void-lament', 'Void Lament', {
    cost: cost(1, 'B'), colors: B, abilities: [spell([{
      op: 'ifTargetMarked',
      then: [{ op: 'boost', p: -3, t: -3, scope: 'target' }],
      else: [{ op: 'boost', p: -1, t: -1, scope: 'target' }],
    }], 'creature')], retell: { cost: cost(2, 'B') }, rarity: 'c',
    flavor: 'The dark learned the song and sings it back wrong.',
  }),
  charm('sb-hullsong', 'Hullsong', {
    cost: cost(1, 'W'), colors: W, abilities: [spell([{ op: 'boost', p: 1, t: 1, keywords: ['sentinel'], scope: 'target' }], 'creature')], retell: { cost: cost(2, 'W') }, rarity: 'c',
    flavor: 'The ship hums, and the watch does not sleep.',
  }),
  ritual('sb-bloomdrive-surge', 'Bloomdrive Surge', {
    cost: cost(2, 'G'), colors: G,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature', upTo: 2 }],
      ops: [{ op: 'addCounters', n: 1, to: 'target' }],
    }],
    empower: { cost: cost(2, 'G'), ops: [{ op: 'propagate' }] }, rarity: 'r',
    flavor: 'Feed the drive enough light and the whole garden answers.',
  }),
  charm('sb-overcharge-the-hull', 'Overcharge the Hull', {
    cost: cost(1, 'R'), colors: R,
    abilities: [spell([{ op: 'damage', n: 3, to: 'target' }], 'creature')],
    empower: { cost: cost(2, 'R'), ops: [{ op: 'damage', n: 2, to: 'opponent' }] }, rarity: 'c',
    flavor: 'The reactor was never rated for her temper.',
  }),
  creature('sb-lumen-refit', 'Lumen Refit', ['Starship'], {
    cost: cost(2, 'W'), colors: W, attack: 3, defense: 3, keywords: ['bulwark'],
    empower: { cost: cost(2, 'W'), ops: [{ op: 'addCounters', n: 1, to: 'self' }] }, rarity: 'r',
    flavor: 'Refit in the light of a dying sun, and better for it.',
  }),
  creature('sb-tidewalk-analyst', 'Tidewalk Analyst', ['Alien', 'Analyst'], {
    cost: cost(3, 'U'), colors: U, attack: 2, defense: 4, rarity: 'r',
    empower: {
      cost: cost(3, 'U'),
      targets: [{ what: 'yourPermanent' }, { what: 'yourPermanent' }],
      ops: [{ op: 'moveMark' }],
    },
    flavor: 'She reads the tide as a filing problem.',
  }),
  charm('sb-eclipse-tithe', 'Eclipse Tithe', {
    cost: cost(2, 'B'), colors: B,
    abilities: [spell([{ op: 'removeMarks', to: 'target' }], 'creature')],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }, rarity: 'r',
    flavor: 'Everything the light gave, the eclipse counts back.',
  }),
  creature('sb-appetite-of-the-void', 'Appetite of the Void', ['Alien', 'Devourer'], {
    cost: cost(3, 'B'), colors: B, attack: 4, defense: 5,
    abilities: [arrives([{ op: 'boost', p: -2, t: -2, scope: 'theirMarked' }])],
    rite: { n: 1 }, rarity: 'r',
    flavor: 'It eats the light first, and then whatever the light was attached to.',
  }),
  creature('sb-gullet-of-the-hive', 'Gullet of the Hive', ['Starship'], {
    cost: cost(4, 'B'), colors: B, attack: 5, defense: 5,
    abilities: [arrives([{ op: 'loseLifePerTheirMarked', who: 'opponent' }])],
    rite: { n: 1 }, rarity: 'r',
    flavor: 'The hold is warm, and it is not supposed to be warm.',
  }),
  ritual('sb-brood-communion', 'Brood Communion', {
    cost: cost(1, 'G'), colors: G, abilities: [{ when: 'spell', ops: [{ op: 'markAll', scope: 'yourCreatures' }] }], rite: { n: 1 }, rarity: 'r',
    flavor: 'The swarm agrees, in the way a swarm agrees, and one of them does not come back.',
  }),
  ritual('sb-the-long-crossing', 'The Long Crossing', {
    cost: cost(2, 'G'), colors: G, chapters: [
      [{ op: 'createToken', token: 'tok-broodling', count: 1 }],
      [{ op: 'markAll', scope: 'yourCreatures' }],
      [{ op: 'propagate' }],
    ], rarity: 'sr',
    flavor: 'Three dawns out from anywhere, the hull starts keeping its own crew.',
  }),
] as const satisfies readonly CardDef[];
