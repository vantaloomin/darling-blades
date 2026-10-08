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

function land(id: string, name: string, manaAbility: (Color | 'C')[], rarity: StarborneData['rarity']): CardDef {
  return make(id, name, ['land'], [], {
    colors: [],
    entersTapped: true,
    manaAbility,
    rarity,
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
  }),
  creature('sb-orbit-guard', 'Orbit Guard', ['Soldier'], {
    cost: cost(2, 'W'), colors: W, attack: 2, defense: 4, keywords: ['wardingGaze'], rarity: 'c',
  }),
  creature('sb-violet-medica', 'Violet Medica', ['Alien', 'Medic'], {
    cost: cost(2, 'W'), colors: W, attack: 2, defense: 3, abilities: [arrives([{ op: 'gainLife', n: 2 }])], rarity: 'c',
  }),
  creature('sb-aurora-habitat', 'Aurora Habitat', ['Alien', 'Civilian'], {
    cost: cost(1, 'W'), colors: W, attack: 2, defense: 2,
    abilities: [{ when: 'gainsMark', ops: [{ op: 'gainLife', n: 1 }] }], rarity: 'c',
  }),
  creature('sb-cosmic-shieldmaiden', 'Cosmic Shieldmaiden', ['Vanguard'], {
    cost: cost(3, 'W'), colors: W, attack: 3, defense: 3, keywords: ['firstBlade', 'sentinel'], rarity: 'c',
  }),
  creature('sb-radiant-deckhand', 'Radiant Deckhand', ['Deckhand'], {
    cost: cost(1, 'W'), colors: W, attack: 2, defense: 1, keywords: ['warcry'], rarity: 'c',
  }),
  creature('sb-white-comet-aide', 'White-Comet Aide', ['Alien', 'Aide'], {
    cost: cost(3, 'W'), colors: W, attack: 3, defense: 4,
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }])], rarity: 'c',
  }),
  creature('sb-star-reader', 'Star Reader', ['Alien', 'Oracle'], {
    cost: cost(1, 'U'), colors: U, attack: 1, defense: 3, abilities: [arrives([{ op: 'foresee', n: 2 }])], rarity: 'c',
  }),
  creature('sb-ion-bloom-scout', 'Ion-Bloom Scout', ['Scout'], {
    cost: cost(1, 'U'), colors: U, attack: 2, defense: 1, abilities: [arrives([{ op: 'foresee', n: 1 }])], rarity: 'c',
  }),
  creature('sb-quasar-cartographer', 'Quasar Cartographer', ['Navigator'], {
    cost: cost(3, 'U'), colors: U, attack: 3, defense: 3, abilities: [arrives([{ op: 'foresee', n: 2 }])], rarity: 'c',
  }),
  creature('sb-void-blood-scavenger', 'Void-Blood Scavenger', ['Alien', 'Scavenger'], {
    cost: cost(2, 'B'), colors: B, attack: 2, defense: 2, keywords: ['deathblade'], rarity: 'c',
  }),
  creature('sb-eclipse-broodhunter', 'Eclipse Broodhunter', ['Hunter'], {
    cost: cost(2, 'B'), colors: B, attack: 3, defense: 2, abilities: [arrives([{ op: 'grind', n: 2, who: 'self' }])], rarity: 'c',
  }),
  creature('sb-night-orbit-duelist', 'Night-Orbit Duelist', ['Duelist'], {
    cost: cost(2, 'B'), colors: B, attack: 3, defense: 2, keywords: ['firstBlade'], rarity: 'c',
  }),
  creature('sb-violet-maw', 'Violet Maw', ['Alien', 'Beast'], {
    cost: cost(4, 'B'), colors: B, attack: 4, defense: 4, keywords: ['dreaded'], rarity: 'c',
  }),
  creature('sb-darkmatter-harvester', 'Darkmatter Harvester', ['Harvester'], {
    cost: cost(3, 'B'), colors: B, attack: 3, defense: 3, abilities: [arrives([{ op: 'severGrave', n: 1, who: 'opponent' }])], rarity: 'c',
  }),
  creature('sb-stargrave-leech', 'Stargrave Leech', ['Parasite'], {
    cost: cost(1, 'B'), colors: B, attack: 1, defense: 2, abilities: [arrives([{ op: 'loseLife', n: 1, who: 'opponent' }, { op: 'gainLife', n: 1 }])], rarity: 'c',
  }),
  creature('sb-flarewing-raider', 'Flarewing Raider', ['Alien', 'Raider'], {
    cost: cost(1, 'R'), colors: R, attack: 2, defense: 1, keywords: ['warcry'], rarity: 'c',
  }),
  creature('sb-chrome-meteorist', 'Chrome Meteorist', ['Mage'], {
    cost: cost(2, 'R'), colors: R, attack: 3, defense: 2,
    abilities: [arrivesTargeted({ what: 'any' }, [{ op: 'damage', n: 1, to: 'target' }])], rarity: 'c',
  }),
  creature('sb-ion-storm-brawler', 'Ion-Storm Brawler', ['Brawler'], {
    cost: cost(2, 'R'), colors: R, attack: 3, defense: 2,
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 1, t: 0 } }], rarity: 'c',
  }),
  creature('sb-violet-thruster-ace', 'Violet Thruster Ace', ['Thruster', 'Ace'], {
    cost: cost(3, 'R'), colors: R, attack: 3, defense: 3, keywords: ['skyborne'], rarity: 'c',
  }),
  creature('sb-solar-riot-engineer', 'Solar Riot Engineer', ['Engineer'], {
    cost: cost(3, 'R'), colors: R, attack: 3, defense: 3,
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }])], rarity: 'c',
  }),
  creature('sb-redshift-corsair', 'Redshift Corsair', ['Corsair'], {
    cost: cost(2, 'R'), colors: R, attack: 2, defense: 2, keywords: ['warcry'], skim: { cost: cost(1) }, rarity: 'c',
  }),
  creature('sb-comet-kick-marauder', 'Comet-Kick Marauder', ['Marauder'], {
    cost: cost(3, 'R'), colors: R, attack: 5, defense: 2, keywords: ['overrun'], rarity: 'c',
  }),
  creature('sb-starfire-lancer', 'Starfire Lancer', ['Soldier'], {
    cost: cost(2, 'R'), colors: R, attack: 3, defense: 2, keywords: ['firstBlade'], rarity: 'c',
  }),
  creature('sb-orbit-breaker', 'Orbit Breaker', ['Brute'], {
    cost: cost(4, 'R'), colors: R, attack: 4, defense: 4,
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'damage', n: 2, to: 'target' }])], rarity: 'c',
  }),
  creature('sb-burning-hull-runner', 'Burning Hull Runner', ['Alien', 'Runner'], {
    cost: cost(2, 'R'), colors: R, attack: 2, defense: 2,
    abilities: [{ when: 'static', condition: 'controlMarked', static: { scope: 'self', p: 1, t: 0 } }], rarity: 'c',
  }),
  creature('sb-mycelial-star-gardener', 'Mycelial Star Gardener', ['Alien', 'Druid'], {
    cost: cost(2, 'G'), colors: G, attack: 2, defense: 2, keywords: ['wardingGaze'],
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])], rarity: 'c',
  }),
  creature('sb-cometroot-grafter', 'Cometroot Grafter', ['Engineer'], {
    cost: cost(3, 'G'), colors: G, attack: 3, defense: 3,
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 1, t: 0 } }], rarity: 'c',
  }),
  creature('sb-voidvine-tender', 'Voidvine Tender', ['Alien', 'Gardener'], {
    cost: cost(2, 'G'), colors: G, attack: 2, defense: 3, abilities: [arrives([{ op: 'gainLife', n: 2 }])], rarity: 'c',
  }),
  creature('sb-living-hull-seedling', 'Living Hull Seedling', ['Starship'], {
    cost: cost(3, 'G'), colors: G, attack: 3, defense: 3, abilities: [arrives([{ op: 'propagate' }])], rarity: 'c',
  }),
  creature('sb-aurora-beastcaller', 'Aurora Beastcaller', ['Caller'], {
    cost: cost(4, 'G'), colors: G, attack: 4, defense: 4,
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }])], rarity: 'c',
  }),
  creature('sb-star-orchard-keeper', 'Star Orchard Keeper', ['Alien', 'Farmer'], {
    cost: cost(4, 'G'), colors: G, attack: 4, defense: 4,
    abilities: [arrives([{ op: 'gainLife', n: 1 }])], rarity: 'c',
  }),
  creature('sb-solar-canopy-guardian', 'Solar Canopy Guardian', ['Guardian'], {
    cost: cost(3, 'G'), colors: G, attack: 3, defense: 4, keywords: ['wardingGaze'], rarity: 'c',
  }),
  creature('sb-blooming-satellite', 'Blooming Satellite', ['Starship'], {
    cost: cost(5, 'G'), colors: G, attack: 5, defense: 5, abilities: [arrives([{ op: 'propagate' }])], rarity: 'c',
  }),
  charm('sb-prism-deflection', 'Prism Deflection', {
    cost: cost(1, 'W'), colors: W,
    abilities: [spell([{ op: 'boost', p: 0, t: 3, scope: 'target' }, { op: 'preventCombat' }], 'creature')], rarity: 'c',
  }),
  ritual('sb-orbital-cleansing', 'Orbital Cleansing', {
    cost: cost(1, 'WB'), colors: ['W', 'B'], abilities: [spell([{ op: 'sever', to: 'target' }], 'creature')], rarity: 'c',
  }),
  artifact('sb-chrome-medallion', 'Chrome Medallion', {
    cost: cost(2), colors: C, abilities: [dawn([{ op: 'foresee', n: 1 }])], rarity: 'c',
  }),
  ritual('sb-cometary-verdict', 'Cometary Verdict', {
    cost: cost(3, 'W'), colors: W,
    abilities: [{ when: 'spell', targets: [{ what: 'creature', tapped: true }], ops: [{ op: 'sever', to: 'target' }] }], rarity: 'c',
  }),
  artifact('sb-pale-nebula', 'Nebula Beacon', {
    cost: cost(2, 'W'), colors: W,
    activated: { cost: { tap: true, mana: cost(2) }, targets: [{ what: 'yourCreature' }], ops: [{ op: 'boost', p: 2, t: 2, scope: 'target' }] }, rarity: 'c',
  }),
  charm('sb-signal-inversion', 'Signal Inversion', {
    cost: cost(0, 'U'), colors: U,
    abilities: [spell([
      { op: 'recall', to: 'target' },
      { op: 'foresee', n: 1, who: 'targetOwner' },
    ], 'creature')], rarity: 'c',
  }),
  charm('sb-prism-current', 'Prism Current', {
    cost: cost(1, 'U'), colors: U, abilities: [spell([{ op: 'foresee', n: 2 }, { op: 'draw', n: 1 }])], rarity: 'c',
  }),
  enchantment('sb-relay-station', 'Relay Station', {
    cost: cost(1, 'U'), colors: U, abilities: [dawn([{ op: 'foresee', n: 1 }])], skim: { cost: cost(1) }, rarity: 'c',
  }),
  ritual('sb-sky-map', 'Sky Map', {
    cost: cost(1), colors: C, abilities: [spell([{ op: 'foresee', n: 3 }])], rarity: 'c',
  }),
  artifact('sb-deepfield-lands', 'Deepfield Array', {
    cost: cost(0, 'U'), colors: U,
    activated: { cost: { tap: true, mana: cost(0) }, targets: [{ what: 'yourCreature' }, { what: 'yourCreature' }], ops: [{ op: 'moveMark' }, { op: 'moveMark' }] }, rarity: 'c',
  }),
  charm('sb-night-market-bargain', 'Night-Market Bargain', {
    cost: cost(2, 'B'), colors: B, abilities: [spell([{ op: 'draw', n: 1 }, { op: 'loseLife', n: 1, who: 'opponent' }])], rarity: 'c',
  }),
  artifact('sb-umbral-antenna', 'Umbral Antenna', {
    cost: cost(4), colors: B,
    abilities: [
      dawn([{ op: 'foresee', n: 1 }, { op: 'grind', n: 1, who: 'self' }]),
      {
        when: 'dawn',
        condition: { kind: 'markedThreshold', n: 4, subject: 'creatures' },
        ops: [{ op: 'severSelf' }, { op: 'raise', to: 'top', withMarks: 2 }],
      },
    ], rarity: 'c',
  }),
  charm('sb-corpse-lantern', 'Corpse Lantern', {
    cost: cost(1, 'B'), colors: B, abilities: [spell([{ op: 'damage', n: 2, to: 'target' }, { op: 'gainLife', n: 1 }], 'any')], rarity: 'c',
  }),
  artifact('sb-darkside-landing', 'Violet Landing Light', {
    cost: cost(1, 'B'), colors: B,
    activated: { cost: { tap: true }, targets: [{ what: 'creature', marked: true }], ops: [{ op: 'removeMarks', to: 'target' }] }, rarity: 'c',
  }),
  ritual('sb-flareburst', 'Flareburst', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 1, to: 'target' }, { op: 'markAll', scope: 'yourCreatures' }], 'any')], rarity: 'c',
  }),
  charm('sb-solar-arc', 'Solar Arc', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 1, to: 'target' }, { op: 'damage', n: 1, to: 'opponent' }], 'creature')], rarity: 'c',
  }),
  enchantment('sb-ignition-hymn', 'Ignition Hymn', {
    cost: cost(1, 'R'), colors: R,
    abilities: [{ when: 'markedAllyAttacks', ops: [{ op: 'boost', p: 1, t: 0, scope: 'yourMarked' }] }], rarity: 'c',
  }),
  ritual('sb-redline-salvage', 'Redline Salvage', {
    cost: cost(0, 'R'), colors: R, skim: { cost: cost(1) },
    abilities: [spell([{ op: 'addCounters', n: 1, to: 'target' }], 'creature')], rarity: 'c',
  }),
  ritual('sb-starfall-barrage', 'Starfall Barrage', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 4, to: 'target' }], 'creature')], rarity: 'c',
  }),
  artifact('sb-ember-lane', 'Ember-Lane Flare', {
    cost: cost(0, 'R'), colors: R,
    activated: { cost: { tap: true, mana: cost(1) }, ops: [{ op: 'damage', n: 1, to: 'opponent' }] }, rarity: 'c',
  }),
  charm('sb-warhead-glint', 'Warhead Glint', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'boost', p: 3, t: 1, keywords: ['warcry'], scope: 'target' }], 'creature')], rarity: 'c',
  }),
  charm('sb-root-of-light', 'Root of Light', {
    cost: cost(1, 'G'), colors: G, abilities: [spell([{ op: 'addCounters', n: 1, to: 'target' }, { op: 'gainLife', n: 1 }], 'creature')], rarity: 'c',
  }),
  ritual('sb-gravitic-bloom', 'Gravitic Bloom', {
    cost: cost(0, 'G'), colors: G,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature', upTo: 2 }],
      ops: [{ op: 'addCounters', n: 1, to: 'target' }],
    }], rarity: 'c',
  }),
  enchantment('sb-orbital-graft', 'Orbital Graft', {
    cost: cost(1, 'G'), colors: G,
    abilities: [{ when: 'allyCreatureArrives', ops: [{ op: 'addCounters', n: 1, to: 'target' }] }], rarity: 'c',
  }),
  artifact('sb-overcanopy', 'Overcanopy Trellis', {
    cost: cost(1, 'G'), colors: G,
    activated: { cost: { tap: true, mana: cost(1) }, targets: [{ what: 'yourCreature' }], ops: [{ op: 'addCounters', n: 1, to: 'target' }] }, rarity: 'c',
  }),
  artifact('sb-starborne-relay', 'Starborne Relay', {
    cost: cost(6), colors: C,
    abilities: [
      arrives([{ op: 'draw', n: 1 }]),
      dawn([{ op: 'foresee', n: 1 }]),
      {
        when: 'dawn',
        condition: { kind: 'markedThreshold', n: 4, subject: 'creatures' },
        ops: [{ op: 'draw', n: 1 }],
      },
    ], rarity: 'sr',
  }),
  ritual('sb-null-orbit-array', 'Null-Orbit Array', {
    cost: cost(1), colors: C, skim: { cost: cost(1) }, abilities: [spell([{ op: 'foresee', n: 1 }, { op: 'severGrave', n: 1, who: 'self' }])], rarity: 'c',
  }),
  artifact('sb-interstellar-crossing', 'Crossing Beacon', {
    cost: cost(4), colors: C,
    activated: { cost: { tap: true, mana: cost(3) }, ops: [{ op: 'draw', n: 1 }] }, rarity: 'c',
  }),
  artifact('sb-violet-wake-beacon', 'Violet Wake Beacon', {
    cost: cost(7), colors: C,
    abilities: [
      arrives([{ op: 'createToken', token: 'tok-nebula-firefly', count: 1 }]),
      { when: 'dawn', condition: 'controlMarked', ops: [{ op: 'createToken', token: 'tok-nebula-firefly', count: 1 }] },
    ], rarity: 'ssr',
  }),
  creature('sb-prism-chorister', 'Prism Chorister', ['Alien', 'Singer'], {
    cost: cost(2, 'W'), colors: W, attack: 3, defense: 3, keywords: ['sentinel'], rarity: 'r',
  }),
  creature('sb-ivory-orbit-vanguard', 'Ivory Orbit Vanguard', ['Vanguard'], {
    cost: cost(3, 'W'), colors: W, attack: 3, defense: 4, keywords: ['firstBlade'], rarity: 'r',
  }),
  creature('sb-chrome-choir-envoy', 'Chrome Choir Envoy', ['Alien', 'Diplomat'], {
    cost: cost(2, 'W'), colors: W, attack: 2, defense: 3, keywords: ['skyborne'], rarity: 'r',
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true, other: true }, p: 1, t: 0 } }],
  }),
  creature('sb-aurora-line-captain', 'Aurora-Line Captain', ['Commander'], {
    cost: cost(4, 'W'), colors: W, attack: 4, defense: 4, keywords: ['sentinel'],
    abilities: [arrives([{ op: 'boost', p: 1, t: 0, scope: 'allYours' }])], rarity: 'r',
  }),
  creature('sb-velvet-void-cartographer', 'Velvet Void Cartographer', ['Navigator'], {
    cost: cost(2, 'U'), colors: U, attack: 2, defense: 3, abilities: [arrives([{ op: 'foresee', n: 2 }])], skim: { cost: cost(1) }, rarity: 'r',
  }),
  creature('sb-astral-biomancer', 'Astral Biomancer', ['Alien', 'Mage'], {
    cost: cost(4, 'U'), colors: U, attack: 3, defense: 4, rarity: 'r',
    abilities: [arrivesTargeted(
      { what: 'yourCreature', other: true },
      [{ op: 'addCounters', n: 1, to: 'target' }, { op: 'foresee', n: 1 }],
      'controlMarked',
    )],
  }),
  creature('sb-tideglass-archivist', 'Tideglass Archivist', ['Archivist'], {
    cost: cost(3, 'U'), colors: U, attack: 2, defense: 4, abilities: [arrives([{ op: 'draw', n: 1 }, { op: 'grind', n: 1, who: 'self' }])], rarity: 'r',
  }),
  creature('sb-void-choir-reclaimer', 'Void Choir Reclaimer', ['Alien', 'Singer'], {
    cost: cost(3, 'B'), colors: B, attack: 3, defense: 3, keywords: ['deathblade'],
    abilities: [{ when: 'dies', ops: [{ op: 'grind', n: 2, who: 'self' }] }], rarity: 'r',
  }),
  creature('sb-eclipse-garden-devourer', 'Eclipse Garden Devourer', ['Alien', 'Beast'], {
    cost: cost(3, 'B'), colors: B, attack: 3, defense: 4, keywords: ['bloodoath'], rarity: 'r',
  }),
  creature('sb-severance-priestess', 'Severance Priestess', ['Priestess'], {
    cost: cost(2, 'B'), colors: B, attack: 2, defense: 3, abilities: [arrives([{ op: 'severGrave', n: 2, who: 'opponent' }])], rarity: 'r',
  }),
  creature('sb-void-halo-assassin', 'Void-Halo Assassin', ['Assassin'], {
    cost: cost(3, 'B'), colors: B, attack: 3, defense: 2, keywords: ['deathblade'], skim: { cost: cost(1) }, rarity: 'r',
  }),
  creature('sb-flare-orbit-captain', 'Flare-Orbit Captain', ['Commander'], {
    cost: cost(2, 'RR'), colors: R, attack: 5, defense: 2, keywords: ['warcry'], rarity: 'r',
  }),
  creature('sb-chrome-sunbreaker', 'Chrome Sunbreaker', ['Brute'], {
    cost: cost(3, 'R'), colors: R, attack: 4, defense: 4, keywords: ['overrun'], rarity: 'r',
  }),
  creature('sb-violet-thrust-engineer', 'Violet-Thrust Engineer', ['Engineer'], {
    cost: cost(3, 'R'), colors: R, attack: 3, defense: 3, rarity: 'r',
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])],
  }),
  creature('sb-solar-flare-bruiser', 'Solar-Flare Bruiser', ['Brawler'], {
    cost: cost(3, 'R'), colors: R, attack: 3, defense: 2, rarity: 'r',
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'damage', n: 1, to: 'target' }])],
  }),
  creature('sb-rootlight-navigator', 'Rootlight Navigator', ['Navigator'], {
    cost: cost(3, 'G'), colors: G, attack: 2, defense: 4, rarity: 'r',
    abilities: [arrives([{ op: 'extraLandDrop' }])],
  }),
  creature('sb-emerald-bloom-mother', 'Emerald Bloom Mother', ['Alien', 'Matriarch'], {
    cost: cost(4, 'G'), colors: G, attack: 4, defense: 4, abilities: [arrives([{ op: 'propagate' }])], rarity: 'r',
  }),
  creature('sb-orchard-of-stars-keeper', 'Orchard-of-Stars Keeper', ['Alien', 'Farmer'], {
    cost: cost(3, 'G'), colors: G, attack: 2, defense: 4, rarity: 'r',
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }, { op: 'gainLife', n: 2 }])],
  }),
  creature('sb-radiant-moss-mender', 'Radiant Moss Mender', ['Alien', 'Druid'], {
    cost: cost(2, 'G'), colors: G, attack: 3, defense: 3, rarity: 'r',
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])],
  }),
  creature('sb-chrome-aurora-commandant', 'Chrome-Aurora Commandant', ['Alien', 'Commander'], {
    supertypes: ['legendary'], cost: cost(2, 'WWU'), colors: ['W', 'U'], attack: 2, defense: 4, keywords: ['skyborne'], rarity: 'r',
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 1, t: 1 } }],
  }),
  creature('sb-cinder-nebula-raider', 'Cinder-Nebula Raider', ['Corsair'], {
    supertypes: ['legendary'], cost: cost(3, 'BR'), colors: ['B', 'R'], attack: 4, defense: 3, keywords: ['warcry'], rarity: 'r',
    abilities: [{ when: 'gainsMark', ops: [{ op: 'damage', n: 2, to: 'opponent' }] }],
  }),
  creature('sb-orbitroot-matriarch', 'Orbitroot Matriarch', ['Alien', 'Matriarch'], {
    supertypes: ['legendary'], cost: cost(3, 'RG'), colors: ['R', 'G'], attack: 4, defense: 4, keywords: ['overrun'], abilities: [arrives([{ op: 'propagate' }])], rarity: 'r',
  }),
  enchantment('sb-white-signal-bastion', 'White-Signal Bastion', {
    cost: cost(3, 'W'), colors: W,
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 0, t: 3 } }], rarity: 'r',
  }),
  ritual('sb-blue-echo-array', 'Blue-Echo Array', {
    cost: cost(1), colors: C, skim: { cost: cost(1) }, abilities: [spell([{ op: 'foresee', n: 2 }])], rarity: 'r',
  }),
  ritual('sb-black-starving-orbit', 'Black-Starving Orbit', {
    cost: cost(2, 'B'), colors: B, abilities: [{
      when: 'spell',
      targets: [{ what: 'creature', marked: true }],
      ops: [{ op: 'sever', to: 'target' }],
    }], rarity: 'r',
  }),
  charm('sb-red-solar-lash', 'Red-Solar Lash', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 3, to: 'target' }], 'creature')], rarity: 'r',
  }),
  ritual('sb-green-propagation-chorus', 'Green Propagation Chorus', {
    cost: cost(0, 'G'), colors: G, abilities: [spell([{ op: 'propagate' }, { op: 'gainLife', n: 3 }])], rarity: 'r',
  }),
  artifact('sb-chromelight-lattice', 'Chromelight Lattice', {
    cost: cost(3), colors: C,
    abilities: [
      arrivesTargeted({ what: 'creature' }, [{ op: 'addCounters', n: 1, to: 'target' }]),
      { when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 0, t: 1 } },
    ], rarity: 'r',
  }),
  land('sb-pale-violet-crossing', 'Pale-Violet Crossing', ['W', 'U'], 'r'),
  land('sb-eclipse-docking-ring', 'Eclipse Docking Ring', ['W', 'B'], 'r'),
  land('sb-ember-void-rail', 'Ember-Void Rail', ['B', 'R'], 'r'),
  land('sb-radiant-comet-lane', 'Radiant-Comet Lane', ['R', 'G'], 'r'),
  land('sb-aurora-reefway', 'Aurora Reefway', ['G', 'U'], 'r'),
  creature('sb-prismatic-fleet-marshal', 'Prismatic Fleet Marshal', ['Alien', 'Commander'], {
    cost: cost(4, 'W'), colors: W, attack: 4, defense: 4, keywords: ['sentinel'], abilities: [arrives([{ op: 'propagate' }])], rarity: 'sr',
  }),
  creature('sb-eclipse-blood-artist', 'Eclipse Blood Artist', ['Alien', 'Artist'], {
    cost: cost(3, 'B'), colors: B, attack: 3, defense: 3, keywords: ['bloodoath'],
    abilities: [{ when: 'gainsMark', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }] }], rarity: 'sr',
  }),
  creature('sb-ember-orbit-exarch', 'Ember-Orbit Exarch', ['Alien', 'Priestess'], {
    cost: cost(3, 'R'), colors: R, attack: 4, defense: 3, keywords: ['warcry'], rarity: 'sr',
  }),
  creature('sb-rootlight-broodmother', 'Rootlight Broodmother', ['Alien', 'Matriarch'], {
    cost: cost(5, 'G'), colors: G, attack: 4, defense: 5, abilities: [arrives([{ op: 'propagate' }, { op: 'createToken', token: 'tok-broodling', count: 1 }])], rarity: 'sr',
  }),
  creature('sb-moonlit-hull-repairer', 'Moonlit Hull Repairer', ['Engineer'], {
    cost: cost(3, 'W'), colors: W, attack: 3, defense: 5, keywords: ['sentinel'], rarity: 'sr',
  }),
  creature('sb-voidcurrent-conjurer', 'Voidcurrent Conjurer', ['Alien', 'Mage'], {
    cost: cost(3, 'U'), colors: U, attack: 3, defense: 3, keywords: ['skyborne'], abilities: [arrives([{ op: 'foresee', n: 3 }])], rarity: 'sr',
  }),
  creature('sb-solar-thruster-herald', 'Solar-Thruster Herald', ['Alien', 'Herald'], {
    cost: cost(4, 'R'), colors: R, attack: 3, defense: 3, keywords: ['skyborne', 'warcry'],
    abilities: [{ when: 'gainsMark', ops: [{ op: 'damage', n: 2, to: 'opponent' }] }], rarity: 'sr',
  }),
  creature('sb-ringworld-bloomkeeper', 'Ringworld Bloomkeeper', ['Alien', 'Druid'], {
    cost: cost(4, 'G'), colors: G, attack: 4, defense: 5, keywords: ['wardingGaze'],
    abilities: [{ when: 'otherCreatureMarked', ops: [{ op: 'gainLife', n: 1 }] }], rarity: 'sr',
  }),
  creature('sb-chrome-veil-admiral', 'Chrome-Veil Admiral', ['Alien', 'Commander'], {
    supertypes: ['legendary'], cost: cost(4, 'WU'), colors: ['W', 'U'], attack: 3, defense: 4, keywords: ['skyborne'],
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true, other: true }, p: 1, t: 1 } }], rarity: 'sr',
  }),
  creature('sb-violet-eclipse-weaver', 'Violet-Eclipse Weaver', ['Alien', 'Weaver'], {
    supertypes: ['legendary'], cost: cost(3, 'BR'), colors: ['B', 'R'], attack: 4, defense: 4, keywords: ['deathblade'],
    abilities: [arrives([{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }])], rarity: 'sr',
  }),
  enchantment('sb-propagation-engine', 'Propagation Engine', {
    cost: cost(3), colors: C, abilities: [dawn([{ op: 'propagate' }])], rarity: 'sr',
  }),
  ritual('sb-deep-space-severance', 'Deep-Space Severance', {
    cost: cost(2, 'B'), colors: B, abilities: [spell([{ op: 'sever', to: 'target' }, { op: 'severGrave', n: 1, who: 'opponent' }], 'creature')], rarity: 'sr',
  }),
  charm('sb-hullwake-overdrive', 'Hullwake Overdrive', {
    cost: cost(0, 'R'), colors: R, abilities: [spell([{ op: 'boost', p: 3, t: 0, keywords: ['warcry'], scope: 'target' }], 'creature')], rarity: 'sr',
  }),
  creature('sb-queen-of-the-living-hull', 'Queen of the Living Hull', ['Alien', 'Queen'], {
    supertypes: ['legendary'], cost: cost(5, 'WW'), colors: W, attack: 5, defense: 5, keywords: ['sentinel'], rarity: 'ssr',
    abilities: [
      arrives([{ op: 'propagate' }]),
      { when: 'static', static: { scope: 'filter', filter: { marked: true, other: true }, p: 1, t: 1 } },
    ],
  }),
  creature('sb-astral-reef-singer', 'Astral Reef Singer', ['Alien', 'Singer'], {
    supertypes: ['legendary'], cost: cost(7, 'U'), colors: U, attack: 4, defense: 5, keywords: ['skyborne'], abilities: [dawn([{ op: 'draw', n: 1 }])], rarity: 'ssr',
  }),
  creature('sb-hellion-of-the-redshift', 'Hellion of the Redshift', ['Alien', 'Beast'], {
    supertypes: ['legendary'], cost: cost(3, 'R'), colors: R, attack: 5, defense: 4, keywords: ['warcry', 'overrun'], rarity: 'ssr',
  }),
  creature('sb-worldroot-shipmind', 'Worldroot Shipmind', ['Starship'], {
    supertypes: ['legendary'], cost: cost(7, 'G'), colors: G, attack: 6, defense: 7, abilities: [arrives([{ op: 'propagate' }, { op: 'createToken', token: 'tok-broodling', count: 2 }])], rarity: 'ssr',
  }),
  creature('sb-chrome-violet-archon', 'Chrome-Violet Archon', ['Alien', 'Archon'], {
    supertypes: ['legendary'], cost: cost(5, 'WU'), colors: ['W', 'U'], attack: 5, defense: 5, keywords: ['skyborne'], rarity: 'ssr',
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true }, grantKeywords: ['sentinel'] } }],
  }),
  creature('sb-voidflare-empress', 'Voidflare Empress', ['Alien', 'Empress'], {
    supertypes: ['legendary'], cost: cost(3, 'BR'), colors: ['B', 'R'], attack: 5, defense: 4, keywords: ['dreaded', 'warcry'], rarity: 'ssr',
    abilities: [{ when: 'yourCreatureMarked', ops: [{ op: 'loseLife', n: 1, who: 'opponent' }] }],
  }),
  artifact('sb-signal-cathedral', 'Signal Cathedral', {
    supertypes: ['legendary'], cost: cost(5), colors: C,
    abilities: [
      dawn([{ op: 'foresee', n: 2 }]),
      {
        when: 'dawn',
        condition: { kind: 'markedThreshold', n: 5, subject: 'creatures' },
        ops: [{ op: 'draw', n: 1 }],
      },
    ], rarity: 'ssr',
  }),
  enchantment('sb-propagation-choir', 'Propagation Choir', {
    cost: cost(2, 'G'), colors: G,
    abilities: [{ when: 'youAddMark', ops: [{ op: 'gainLife', n: 1 }, { op: 'createToken', token: 'tok-broodling', count: 1 }] }], rarity: 'ssr',
  }),
  ritual('sb-starborne-apotheosis', 'Starborne Apotheosis', {
    cost: cost(1, 'W'), colors: W, abilities: [spell([
      { op: 'propagate' },
      { op: 'gainLife', n: 8 },
      { op: 'boost', p: 2, t: 2, scope: 'yourMarked' },
    ])], rarity: 'ssr',
  }),
  ritual('sb-redline-supernova', 'Redline Supernova', {
    cost: cost(2, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 3, to: 'eachCreature', severOnDeath: true }])], rarity: 'ssr',
  }),
  creature('sb-constellation-matriarch', 'Constellation Matriarch', ['Alien', 'Matriarch'], {
    supertypes: ['legendary'], cost: cost(6, 'W'), colors: W, attack: 5, defense: 6, keywords: ['skyborne', 'sentinel'], rarity: 'ur',
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true, other: true }, p: 1, t: 1 } }],
  }),
  creature('sb-abyssal-iris-regent', 'Abyssal Iris Regent', ['Alien', 'Regent'], {
    supertypes: ['legendary'], cost: cost(4, 'B'), colors: B, attack: 5, defense: 5, keywords: ['deathblade', 'bloodoath'],
    abilities: [{ when: 'dies', ops: [{ op: 'severGrave', n: 3, who: 'opponent' }] }], rarity: 'ur',
  }),
  creature('sb-solar-flare-sovereign', 'Solar-Flare Sovereign', ['Alien', 'Sovereign'], {
    supertypes: ['legendary'], cost: cost(5, 'R'), colors: R, attack: 6, defense: 5, keywords: ['warcry', 'overrun'], rarity: 'ur',
    abilities: [arrivesTargeted({ what: 'creature' }, [{ op: 'damage', n: 3, to: 'target' }])],
  }),
  creature('sb-worldgarden-leviathan', 'Worldgarden Leviathan', ['Alien', 'Beast'], {
    supertypes: ['legendary'], cost: cost(7, 'G'), colors: G, attack: 8, defense: 7, keywords: ['overrun', 'sentinel'],
    abilities: [arrives([{ op: 'propagate' }, { op: 'createToken', token: 'tok-chrome-husk', count: 1 }])], rarity: 'ur',
  }),
  creature('sb-prism-void-comet', 'Prism-Void Comet', ['Alien', 'Comet'], {
    supertypes: ['legendary'], cost: cost(6, 'WU'), colors: ['W', 'U'], attack: 6, defense: 6, keywords: ['skyborne', 'untouchable'], rarity: 'ur',
    abilities: [{ when: 'propagated', ops: [{ op: 'draw', n: 1 }] }],
  }),
  creature('sb-eclipse-red-queen', 'Eclipse-Red Queen', ['Alien', 'Queen'], {
    supertypes: ['legendary'], cost: cost(6, 'BR'), colors: ['B', 'R'], attack: 7, defense: 6, keywords: ['dreaded', 'warcry', 'bloodoath'], rarity: 'ur',
    abilities: [{ when: 'markedAllyAttacks', ops: [{ op: 'damage', n: 1, to: 'opponent' }] }],
  }),
  artifact('sb-halo-motherboard', 'Halo Motherboard', {
    supertypes: ['legendary'], cost: cost(6), colors: C,
    abilities: [
      arrives([{ op: 'propagate' }]),
      { when: 'static', static: { scope: 'filter', filter: { marked: true }, p: 2, t: 2 } },
      dawn([{ op: 'foresee', n: 1 }]),
    ], rarity: 'ur',
  }),
  charm('sb-quiet-orbit', 'Quiet Orbit', {
    cost: cost(1, 'UU'), colors: U, abilities: [{
      when: 'spell',
      targets: [{ what: 'spell' }, { what: 'yourCreature' }, { what: 'yourCreature' }],
      ops: [{ op: 'cancel', to: 'target' }, { op: 'moveMark' }],
    }], rarity: 'c',
  }),
  charm('sb-marrow-eviction', 'Marrow Eviction', {
    cost: cost(1, 'B'), colors: B, abilities: [spell([{
      op: 'ifTargetMarked',
      then: [{ op: 'boost', p: -4, t: -4, scope: 'target' }],
      else: [{ op: 'boost', p: -2, t: -2, scope: 'target' }],
    }], 'creature')], rarity: 'c',
  }),
  charm('sb-signal-drown', 'Signal Drown', {
    cost: cost(3, 'UU'), colors: U, abilities: [
      spell([{ op: 'cancel', to: 'target' }], 'spell'),
      { when: 'spell', condition: 'controlMarked', ops: [{ op: 'draw', n: 1 }] },
    ], rarity: 'c',
  }),
  charm('sb-collapse-the-lane', 'Collapse the Lane', {
    cost: cost(3, 'U'), colors: U, abilities: [spell([{ op: 'cancel', to: 'target' }, { op: 'foresee', n: 2 }], 'spell')], rarity: 'r',
  }),
  creature('sb-drydock-carapace', 'Drydock Carapace', ['Starship'], {
    cost: cost(1, 'W'), colors: W, attack: 0, defense: 4, keywords: ['bulwark'], abilities: [arrives([{ op: 'addCounters', n: 1, to: 'self' }])], rarity: 'c',
  }),
  creature('sb-hullplate-bastion', 'Hullplate Bastion', ['Alien', 'Warden'], {
    cost: cost(2, 'G'), colors: G, attack: 1, defense: 5, keywords: ['bulwark'], rarity: 'c',
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])],
  }),
  creature('sb-static-reef', 'Static Reef', ['Alien', 'Reef'], {
    cost: cost(3, 'U'), colors: U, attack: 2, defense: 8, keywords: ['bulwark'], rarity: 'r',
    abilities: [{ when: 'yourCreatureMarked', ops: [{ op: 'foresee', n: 1 }] }],
  }),
  creature('sb-ossuary-gate', 'Ossuary Gate', ['Starship'], {
    cost: cost(2, 'B'), colors: B, attack: 1, defense: 4, keywords: ['bulwark'], rarity: 'r',
    abilities: [{ when: 'static', static: { scope: 'filter', filter: { marked: true, who: 'opponent' }, p: -1, t: 0 } }],
  }),
  creature('sb-lance-of-two-suns', 'Lance of Two Suns', ['Alien', 'Duelist'], {
    cost: cost(2, 'R'), colors: R, attack: 2, defense: 1, keywords: ['twinBlades'], rarity: 'c',
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])],
  }),
  creature('sb-mirrorblade-consort', 'Mirrorblade Consort', ['Lumenborn'], {
    cost: cost(3, 'W'), colors: W, attack: 2, defense: 3, keywords: ['twinBlades', 'sentinel'], rarity: 'r',
  }),
  creature('sb-splitlight-corsair', 'Splitlight Corsair', ['Alien', 'Corsair'], {
    cost: cost(4, 'G'), colors: G, attack: 3, defense: 4, keywords: ['twinBlades'], rarity: 'r',
    abilities: [arrivesTargeted({ what: 'creature', other: true }, [{ op: 'addCounters', n: 1, to: 'target' }])],
  }),
  charm('sb-relay-bloom', 'Relay Bloom', {
    cost: cost(1, 'G'), colors: G, abilities: [spell([{ op: 'addCounters', n: 1, to: 'target' }], 'creature')], retell: { cost: cost(2, 'G') }, rarity: 'c',
  }),
  charm('sb-echo-burst', 'Echo Burst', {
    cost: cost(1, 'R'), colors: R, abilities: [spell([{ op: 'damage', n: 2, to: 'target' }], 'any')], retell: { cost: cost(2, 'R') }, rarity: 'c',
  }),
  charm('sb-signal-recall', 'Signal Recall', {
    cost: cost(0, 'U'), colors: U,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'yourCreature' }, { what: 'yourCreature' }],
      ops: [{ op: 'moveMark' }],
    }],
    retell: { cost: cost(2, 'U') }, rarity: 'c',
  }),
  charm('sb-void-lament', 'Void Lament', {
    cost: cost(1, 'B'), colors: B, abilities: [spell([{
      op: 'ifTargetMarked',
      then: [{ op: 'boost', p: -3, t: -3, scope: 'target' }],
      else: [{ op: 'boost', p: -1, t: -1, scope: 'target' }],
    }], 'creature')], retell: { cost: cost(2, 'B') }, rarity: 'c',
  }),
  charm('sb-hullsong', 'Hullsong', {
    cost: cost(1, 'W'), colors: W, abilities: [spell([{ op: 'boost', p: 1, t: 1, keywords: ['sentinel'], scope: 'target' }], 'creature')], retell: { cost: cost(2, 'W') }, rarity: 'c',
  }),
  ritual('sb-bloomdrive-surge', 'Bloomdrive Surge', {
    cost: cost(0, 'G'), colors: G,
    abilities: [{
      when: 'spell',
      targets: [{ what: 'creature', upTo: 2 }],
      ops: [{ op: 'addCounters', n: 1, to: 'target' }],
    }],
    empower: { cost: cost(2, 'G'), ops: [{ op: 'propagate' }] }, rarity: 'r',
  }),
  charm('sb-overcharge-the-hull', 'Vent the Reactor', {
    cost: cost(1, 'R'), colors: R,
    abilities: [spell([{ op: 'damage', n: 3, to: 'target' }], 'creature')],
    empower: { cost: cost(2, 'R'), ops: [{ op: 'damage', n: 2, to: 'opponent' }] }, rarity: 'c',
  }),
  creature('sb-lumen-refit', 'Lumen Refit', ['Starship'], {
    cost: cost(2, 'W'), colors: W, attack: 3, defense: 3, keywords: ['bulwark', 'firstBlade'],
    empower: { cost: cost(2, 'W'), ops: [{ op: 'addCounters', n: 1, to: 'self' }] }, rarity: 'r',
  }),
  creature('sb-tidewalk-analyst', 'Tidewalk Analyst', ['Alien', 'Analyst'], {
    cost: cost(3, 'U'), colors: U, attack: 2, defense: 5, keywords: ['untouchable'], rarity: 'r',
    empower: {
      cost: cost(3, 'U'),
      targets: [{ what: 'yourCreature' }, { what: 'yourCreature' }],
      ops: [{ op: 'moveMark' }],
    },
  }),
  charm('sb-eclipse-tithe', 'Eclipse Tithe', {
    cost: cost(0, 'B'), colors: B,
    abilities: [spell([{ op: 'removeMarks', to: 'target' }], 'creature')],
    empower: { cost: cost(2, 'B'), ops: [{ op: 'loseLife', n: 4, who: 'opponent' }] }, rarity: 'r',
  }),
  creature('sb-appetite-of-the-void', 'Appetite of the Void', ['Alien', 'Devourer'], {
    cost: cost(4, 'B'), colors: B, attack: 4, defense: 5,
    abilities: [arrives([{ op: 'boost', p: -2, t: -2, scope: 'theirMarked' }])],
    rite: { n: 1 }, rarity: 'r',
  }),
  creature('sb-gullet-of-the-hive', 'Gullet of the Hive', ['Starship'], {
    cost: cost(4, 'B'), colors: B, attack: 5, defense: 5,
    keywords: ['bloodoath'],
    abilities: [arrives([{ op: 'loseLifePerTheirMarked', who: 'opponent' }])],
    rite: { n: 1 }, rarity: 'r',
  }),
  ritual('sb-brood-communion', 'Brood Communion', {
    cost: cost(0, 'G'), colors: G, abilities: [{ when: 'spell', ops: [{ op: 'markAll', scope: 'yourCreatures' }] }], rarity: 'r',
  }),
  ritual('sb-the-long-crossing', 'The Long Crossing', {
    cost: cost(1, 'G'), colors: G, displayTypeLine: 'Quest', chapters: [
      [{ op: 'createToken', token: 'tok-broodling', count: 2 }],
      [{ op: 'markAll', scope: 'yourCreatures' }],
      [{ op: 'propagate' }],
    ], rarity: 'sr',
  }),
] as const satisfies readonly CardDef[];
