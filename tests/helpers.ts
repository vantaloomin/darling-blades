import type { Action } from '../src/engine/actions';
import type { GameEvent } from '../src/engine/events';
import { Game } from '../src/engine/Game';
import { createRngState } from '../src/engine/rng';
import type { CardDb, GameState, PlayerId, Permanent } from '../src/engine/types';

/** Minimal card pool for engine tests. */
export const TEST_DB: CardDb = {
  forest: {
    id: 'forest',
    name: 'Forest',
    types: ['land'],
    subtypes: [],
    supertypes: ['basic'],
    colors: [],
    manaAbility: ['G'],
    rarity: 'c',
  },
  plains: {
    id: 'plains',
    name: 'Plains',
    types: ['land'],
    subtypes: [],
    supertypes: ['basic'],
    colors: [],
    manaAbility: ['W'],
    rarity: 'c',
  },
  mountain: {
    id: 'mountain',
    name: 'Mountain',
    types: ['land'],
    subtypes: [],
    supertypes: ['basic'],
    colors: [],
    manaAbility: ['R'],
    rarity: 'c',
  },
  island: {
    id: 'island',
    name: 'Island',
    types: ['land'],
    subtypes: [],
    supertypes: ['basic'],
    colors: [],
    manaAbility: ['U'],
    rarity: 'c',
  },
  swamp: {
    id: 'swamp',
    name: 'Swamp',
    types: ['land'],
    subtypes: [],
    supertypes: ['basic'],
    colors: [],
    manaAbility: ['B'],
    rarity: 'c',
  },
  dual_gw: {
    id: 'dual_gw',
    name: 'Sunlit Grove',
    types: ['land'],
    subtypes: [],
    colors: [],
    manaAbility: ['G', 'W'],
    entersTapped: true,
    rarity: 'r',
  },
  bear: {
    id: 'bear',
    name: 'Wildwood Bearkin',
    types: ['creature'],
    subtypes: ['Beastkin'],
    cost: { generic: 1, pips: { G: 1 } },
    colors: ['G'],
    attack: 2,
    defense: 2,
    rarity: 'c',
  },
  elf: {
    id: 'elf',
    name: 'Verdant Pathfinder',
    types: ['creature'],
    subtypes: ['Beastkin'],
    cost: { generic: 0, pips: { G: 1 } },
    colors: ['G'],
    attack: 1,
    defense: 1,
    manaAbility: ['G'],
    rarity: 'c',
  },
  knight: {
    id: 'knight',
    name: 'Dawnshield Knight',
    types: ['creature'],
    subtypes: ['Shu', 'Warrior'],
    cost: { generic: 1, pips: { W: 1 } },
    colors: ['W'],
    attack: 2,
    defense: 2,
    keywords: ['firstBlade'],
    rarity: 'c',
  },
  giant: {
    id: 'giant',
    name: 'Hillcrusher Giant',
    types: ['creature'],
    subtypes: ['Beastkin'],
    cost: { generic: 2, pips: { G: 2 } },
    colors: ['G'],
    attack: 4,
    defense: 4,
    rarity: 'c',
  },
  flyer: {
    id: 'flyer',
    name: 'Harpy Skirmisher',
    types: ['creature'],
    subtypes: ['Beastkin', 'Avian'],
    cost: { generic: 1, pips: { U: 1 } },
    colors: ['U'],
    attack: 2,
    defense: 2,
    keywords: ['skyborne'],
    rarity: 'c',
  },
  archer: {
    id: 'archer',
    name: 'Canopy Watcher',
    types: ['creature'],
    subtypes: ['Beastkin'],
    cost: { generic: 1, pips: { G: 1 } },
    colors: ['G'],
    attack: 1,
    defense: 3,
    keywords: ['wardingGaze'],
    rarity: 'c',
  },
  hasty: {
    id: 'hasty',
    name: 'Wolfkin Raider',
    types: ['creature'],
    subtypes: ['Beastkin', 'Wolfkin'],
    cost: { generic: 1, pips: { R: 1 } },
    colors: ['R'],
    attack: 2,
    defense: 1,
    keywords: ['warcry'],
    rarity: 'c',
  },
  sentinel: {
    id: 'sentinel',
    name: 'Vigilant Sentinel',
    types: ['creature'],
    subtypes: ['Shu', 'Warrior'],
    cost: { generic: 2, pips: { W: 1 } },
    colors: ['W'],
    attack: 2,
    defense: 4,
    keywords: ['sentinel'],
    rarity: 'c',
  },
  wall: {
    id: 'wall',
    name: 'Stone Warden',
    types: ['creature'],
    subtypes: ['Wei'],
    cost: { generic: 1, pips: { W: 1 } },
    colors: ['W'],
    attack: 0,
    defense: 4,
    keywords: ['bulwark'],
    rarity: 'c',
  },
  rhino: {
    id: 'rhino',
    name: 'Thundering Rhino',
    types: ['creature'],
    subtypes: ['Beastkin'],
    cost: { generic: 2, pips: { G: 2 } },
    colors: ['G'],
    attack: 4,
    defense: 4,
    keywords: ['overrun'],
    rarity: 'r',
  },
  assassin: {
    id: 'assassin',
    name: 'Nightshade Lamia',
    types: ['creature'],
    subtypes: ['Beastkin', 'Serpent'],
    cost: { generic: 1, pips: { B: 1 } },
    colors: ['B'],
    attack: 1,
    defense: 1,
    keywords: ['deathblade'],
    rarity: 'c',
  },
  dt_rhino: {
    id: 'dt_rhino',
    name: 'Venomhide Behemoth',
    types: ['creature'],
    subtypes: ['Beastkin'],
    cost: { generic: 3, pips: { B: 1, G: 1 } },
    colors: ['B', 'G'],
    attack: 4,
    defense: 4,
    keywords: ['deathblade', 'overrun'],
    rarity: 'sr',
  },
  cleric: {
    id: 'cleric',
    name: 'Hestia’s Attendant',
    types: ['creature'],
    subtypes: ['Olympian'],
    cost: { generic: 1, pips: { W: 1 } },
    colors: ['W'],
    attack: 2,
    defense: 2,
    keywords: ['bloodoath'],
    rarity: 'c',
  },
  lubu: {
    id: 'lubu',
    name: 'Lu Bu, Peerless Flying General',
    types: ['creature'],
    subtypes: ['Other', 'Warrior'],
    supertypes: ['legendary'],
    cost: { generic: 2, pips: { R: 2 } },
    colors: ['R'],
    attack: 5,
    defense: 3,
    keywords: ['warcry'],
    rarity: 'sr',
  },
  lord: {
    id: 'lord',
    name: 'Beastkin Packmother',
    types: ['creature'],
    subtypes: ['Beastkin'],
    cost: { generic: 1, pips: { G: 2 } },
    colors: ['G'],
    attack: 2,
    defense: 2,
    abilities: [
      { when: 'static', static: { scope: 'filter', filter: { subtype: 'Beastkin', other: true }, p: 1, t: 1 } },
    ],
    rarity: 'r',
  },
  shock: {
    id: 'shock',
    name: 'Shock',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 0, pips: { R: 1 } },
    colors: ['R'],
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 2, to: 'target' }] }],
    rarity: 'c',
  },
  growth: {
    id: 'growth',
    name: 'Giant Growth',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 0, pips: { G: 1 } },
    colors: ['G'],
    abilities: [
      { when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'boost', p: 3, t: 3, scope: 'target' }] },
    ],
    rarity: 'c',
  },
  cancel: {
    id: 'cancel',
    name: 'Seen Through',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 1, pips: { U: 1 } },
    colors: ['U'],
    abilities: [{ when: 'spell', targets: [{ what: 'spell' }], ops: [{ op: 'cancel', to: 'target' }] }],
    rarity: 'c',
  },
  murder: {
    id: 'murder',
    name: 'Doom Bolt',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 1, pips: { B: 1 } },
    colors: ['B'],
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'destroy', to: 'target' }] }],
    rarity: 'ur', // meta fixtures need a ur booster pool; rarity is inert in engine tests
  },
  blaze: {
    id: 'blaze',
    name: 'Blaze',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: { R: 1 } },
    colors: ['R'],
    x: { min: 1 },
    abilities: [{ when: 'spell', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 'X', to: 'target' }] }],
    rarity: 'ssr', // meta fixtures need an ssr booster pool; rarity is inert in engine tests
  },
  pacifism_aura: {
    id: 'pacifism_aura',
    name: 'Binding Vow',
    types: ['enchantment'],
    subtypes: ['Aura'],
    cost: { generic: 1, pips: { W: 1 } },
    colors: ['W'],
    abilities: [{ when: 'static', static: { scope: 'attached', p: -3, t: 0 } }],
    rarity: 'c',
  },
  drainer: {
    id: 'drainer',
    name: 'Grave Whisperer',
    types: ['creature'],
    subtypes: ['Beastkin'],
    cost: { generic: 1, pips: { B: 1 } },
    colors: ['B'],
    attack: 1,
    defense: 2,
    abilities: [{ when: 'arrives', ops: [{ op: 'loseLife', n: 2, who: 'opponent' }, { op: 'gainLife', n: 2 }] }],
    rarity: 'c',
  },
  fox_mother: {
    id: 'fox_mother',
    name: 'Kitsune Matron',
    types: ['creature'],
    subtypes: ['Beastkin', 'Kitsune'],
    cost: { generic: 2, pips: { G: 1 } },
    colors: ['G'],
    attack: 2,
    defense: 3,
    abilities: [{ when: 'dies', ops: [{ op: 'createToken', token: 'tok_fox', count: 1 }] }],
    rarity: 'r',
  },
  tok_fox: {
    id: 'tok_fox',
    name: 'Fox Spirit',
    types: ['creature'],
    subtypes: ['Beastkin', 'Kitsune'],
    colors: ['G'],
    cost: { generic: 0, pips: {} },
    attack: 1,
    defense: 1,
    token: true,
    rarity: 'c',
  },
  fog_spell: {
    id: 'fog_spell',
    name: 'Mist of the Valley',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 0, pips: { G: 1 } },
    colors: ['G'],
    abilities: [{ when: 'spell', ops: [{ op: 'preventCombat' }] }],
    rarity: 'c',
  },
  hexproof_bear: {
    id: 'hexproof_bear',
    name: 'Veiled Nekomata',
    types: ['creature'],
    subtypes: ['Beastkin', 'Nekomata'],
    cost: { generic: 1, pips: { G: 1 } },
    colors: ['G'],
    attack: 2,
    defense: 2,
    keywords: ['untouchable'],
    rarity: 'c',
  },
  // --- Ragnarök expansion fixtures: doubleStrike / mill / reanimate ---
  ds_bear: {
    id: 'ds_bear',
    name: 'Einherjar Duelist',
    types: ['creature'],
    subtypes: ['Einherjar'],
    cost: { generic: 2, pips: { R: 1 } },
    colors: ['R'],
    attack: 2,
    defense: 2,
    keywords: ['twinBlades'],
    rarity: 'c',
  },
  ds_elf: {
    id: 'ds_elf',
    name: 'Valkyrie Initiate',
    types: ['creature'],
    subtypes: ['Valkyrie'],
    cost: { generic: 1, pips: { W: 1 } },
    colors: ['W'],
    attack: 1,
    defense: 1,
    keywords: ['twinBlades'],
    rarity: 'c',
  },
  ds_deathtouch: {
    id: 'ds_deathtouch',
    name: 'Draugr Blademaster',
    types: ['creature'],
    subtypes: ['Draugr'],
    cost: { generic: 2, pips: { B: 1 } },
    colors: ['B'],
    attack: 2,
    defense: 2,
    keywords: ['twinBlades', 'deathblade'],
    rarity: 'r',
  },
  ds_trample: {
    id: 'ds_trample',
    name: 'Jotun Reaver',
    types: ['creature'],
    subtypes: ['Jotun'],
    cost: { generic: 2, pips: { R: 1 } },
    colors: ['R'],
    attack: 3,
    defense: 3,
    keywords: ['twinBlades', 'overrun'],
    rarity: 'r',
  },
  ds_lifelink: {
    id: 'ds_lifelink',
    name: 'Radiant Shieldmaiden',
    types: ['creature'],
    subtypes: ['Shieldmaiden'],
    cost: { generic: 2, pips: { W: 1 } },
    colors: ['W'],
    attack: 2,
    defense: 2,
    keywords: ['twinBlades', 'bloodoath'],
    rarity: 'r',
  },
  ds_fs: {
    id: 'ds_fs',
    name: 'Twinstrike Berserker',
    types: ['creature'],
    subtypes: ['Einherjar'],
    cost: { generic: 2, pips: { R: 1 } },
    colors: ['R'],
    attack: 2,
    defense: 2,
    keywords: ['firstBlade', 'twinBlades'],
    rarity: 'r',
  },
  mill_spell: {
    id: 'mill_spell',
    name: 'Grave Tide',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 1, pips: { U: 1 } },
    colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'grind', n: 2, who: 'opponent' }] }],
    rarity: 'c',
  },
  mill_self_spell: {
    id: 'mill_self_spell',
    name: 'Read the Runes',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 0, pips: { U: 1 } },
    colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'grind', n: 2, who: 'self' }] }],
    rarity: 'c',
  },
  reanimate_spell: {
    id: 'reanimate_spell',
    name: 'Call the Einherjar',
    types: ['ritual'],
    subtypes: [],
    cost: { generic: 2, pips: { B: 1 } },
    colors: ['B'],
    abilities: [
      { when: 'spell', targets: [{ what: 'yourGraveCreature' }], ops: [{ op: 'raise' }] },
    ],
    rarity: 'r',
  },
};

export function deckOf(entries: [string, number][]): string[] {
  const out: string[] = [];
  for (const [id, n] of entries) for (let i = 0; i < n; i++) out.push(id);
  return out;
}

/** 20-card mono-green deck — small enough that decking tests finish fast. */
export function smallGreenDeck(): string[] {
  return deckOf([
    ['forest', 9],
    ['bear', 8],
    ['elf', 3],
  ]);
}

let nextIid = 1000;

/** Hand-build a GameState for unit tests that bypass Game's setup. */
export function makeTestState(opts: {
  battlefield?: Partial<Permanent>[];
  hands?: [string[], string[]];
  active?: PlayerId;
}): GameState {
  const battlefield: Permanent[] = (opts.battlefield ?? []).map((p) => ({
    iid: p.iid ?? nextIid++,
    cardId: p.cardId ?? 'forest',
    owner: p.owner ?? p.controller ?? 0,
    controller: p.controller ?? 0,
    tapped: p.tapped ?? false,
    enteredThisTurn: p.enteredThisTurn ?? false,
    damage: p.damage ?? 0,
    deathtouched: p.deathtouched ?? false,
    attachments: p.attachments ?? [],
    attachedTo: p.attachedTo,
    plusOneCounters: p.plusOneCounters ?? 0,
    untilEotMods: p.untilEotMods ?? [],
  }));
  const player = (hand: string[]) => ({
    life: 20,
    deck: [] as string[],
    hand,
    graveyard: [] as string[],
    landPlayedThisTurn: false,
    mulligans: 0,
    keptHand: true,
  });
  return {
    rng: createRngState(1),
    turn: 3,
    startingPlayer: 0,
    activePlayer: opts.active ?? 0,
    step: 'main1',
    players: [player(opts.hands?.[0] ?? []), player(opts.hands?.[1] ?? [])],
    battlefield,
    stack: [],
    stackClosed: false,
    combat: null,
    fogThisTurn: false,
    awaiting: { player: opts.active ?? 0, kind: 'main' },
    pendingFetch: [],
    nextIid: nextIid + 1,
    nextSid: 1,
    winner: null,
    winReason: null,
  };
}

/**
 * Deterministic scripted bot: keep every hand, always land-drop, cast the
 * first castable spell, skip combat, pass everything else. Enough behavior to
 * drive full games for decking/determinism specs.
 */
export function botAction(actions: Action[]): Action {
  const prefer: Action['type'][] = [
    'keepHand',
    'bottomCards',
    'playLand',
    'chooseBasicLand', // a deferred fetch — take the first offered basic
    'castSpell',
    'declareAttackers',
    'declareBlockers',
    'passStep',
    'passResponse',
    'discard',
  ];
  for (const t of prefer) {
    const found = actions.find((a) => a.type === t);
    if (found) return found;
  }
  throw new Error(`bot found no action among: ${actions.map((a) => a.type).join(',')}`);
}

/**
 * Build a game mid-combat-declaration: P0 (active) creatures + P1 creatures on
 * the battlefield, P0 at declare-attackers. Returns the restored Game and the
 * iids keyed by the labels passed in.
 */
export function combatSetup(
  p0: { key: string; cardId: string; tapped?: boolean; enteredThisTurn?: boolean }[],
  p1: { key: string; cardId: string; tapped?: boolean }[],
): { game: Game; iid: Record<string, number> } {
  const iid: Record<string, number> = {};
  let n = 1;
  const battlefield: Partial<Permanent>[] = [];
  for (const c of p0) {
    iid[c.key] = n;
    battlefield.push({
      iid: n++,
      cardId: c.cardId,
      controller: 0,
      tapped: c.tapped ?? false,
      enteredThisTurn: c.enteredThisTurn ?? false,
    });
  }
  for (const c of p1) {
    iid[c.key] = n;
    battlefield.push({ iid: n++, cardId: c.cardId, controller: 1, tapped: c.tapped ?? false });
  }
  const state = makeTestState({ battlefield, active: 0 });
  const game = Game.restore(state, TEST_DB);
  game.submit(0, { type: 'passStep' }); // main1 → combat
  return { game, iid };
}

export function runBotGame(game: Game, maxActions = 20000): GameEvent[] {
  const events: GameEvent[] = [...game.initialEvents];
  for (let i = 0; i < maxActions; i++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') return events;
    const player = awaiting.player;
    const action = botAction(game.legalActions(player));
    events.push(...game.submit(player, action));
  }
  throw new Error('bot game did not terminate');
}
