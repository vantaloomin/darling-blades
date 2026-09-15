import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { HardAI } from '../../src/ai/HardAI';
import { DEFAULT_PERSONALITY } from '../../src/ai/personality';
import { Game } from '../../src/engine/Game';
import type { Awaiting, CardDb, CardDef, CardInstance, Permanent, PlayerId, Step } from '../../src/engine/types';
import { opponentOf } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

function creature(id: string, attack: number, defense: number, extra: Partial<CardDef> = {}): CardDef {
  return { id, name: id, types: ['creature'], subtypes: ['Horror'], colors: [], rarity: 'c',
    cost: { generic: 0, pips: {} }, attack, defense, ...extra };
}
const draw: CardDef = {
  id: 'wh_draw', name: 'Whispers draw fixture', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
  cost: { generic: 3, pips: {} }, whispers: { cost: { generic: 1, pips: {} } },
  abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 1 }] }],
};
export const DB: CardDb = {
  ...TEST_DB,
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`skim_${i}`,
    creature(`skim_${i}`, 1, 1, { cost: { generic: 20, pips: {} },
      skim: { cost: { generic: 0, pips: {} } } })])),
  wh_remove: { ...draw, id: 'wh_remove', cost: { generic: 9, pips: {} },
    abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'destroy', to: 'target' }] }] },
  wh_draw: draw,
  wh_dear: { ...draw, id: 'wh_dear', whispers: { cost: { generic: 3, pips: {} } } },
  wh_body: creature('wh_body', 2, 3, {
    cost: { generic: 5, pips: {} }, whispers: { cost: { generic: 1, pips: {} } },
  }),
  hand_better: { ...draw, id: 'hand_better', whispers: undefined,
    cost: { generic: 8, pips: {} }, abilities: [{ when: 'spell', ops: [{ op: 'draw', n: 6 }] }] },
  tithe_body: creature('tithe_body', 5, 5, { cost: { generic: 3, pips: { G: 1 } }, tithe: { per: 2 } }),
  tithe_empower: creature('tithe_empower', 5, 5, {
    cost: { generic: 1, pips: { G: 1 } }, tithe: { per: 2 },
    empower: { cost: { generic: 2, pips: {} }, ops: [{ op: 'gainLife', n: 3 }] },
  }),
  tithe_pips: creature('tithe_pips', 5, 5, { cost: { generic: 0, pips: { G: 1 } }, tithe: { per: 2 } }),
  best: creature('best', 6, 6, { cost: { generic: 4, pips: {} } }),
  odd: creature('odd', 0, 3, { keywords: ['bulwark'], token: true }),
  one: creature('one', 0, 1, { keywords: ['bulwark'], token: true }),
  even: creature('even', 0, 4, { keywords: ['bulwark'], token: true }),
  attacker: creature('attacker', 1, 4, { token: true }),
  pricey: creature('pricey', 1, 4, { cost: { generic: 4, pips: {} } }),
};

export const difficulties = ['Easy', 'Medium', 'Hard'] as const;
export type Difficulty = typeof difficulties[number];
export function brain(name: Difficulty, seed = 41, quiet = true): AIPlayer {
  const pers = quiet ? { ...DEFAULT_PERSONALITY, easyNoise: 0, easyPassRate: 0 } : DEFAULT_PERSONALITY;
  return name === 'Easy' ? new EasyAI(DB, seed, pers)
    : name === 'Medium' ? new MediumAI(DB, pers) : new HardAI(DB, pers);
}
export function tagged(cardId: string, player: PlayerId = 0, instanceId = 1000): CardInstance {
  return { cardId, instanceId, variantKey: null, whispersUntilDawnOf: opponentOf(player) };
}
export const land = (iid = 1): Partial<Permanent> => ({ iid, cardId: 'forest', controller: 0 });
export const body = (iid: number, cardId: string, extra: Partial<Permanent> = {}): Partial<Permanent> =>
  ({ iid, cardId, controller: 0, ...extra });
export function gameWith(options: {
  hand?: string[]; opponentHand?: string[]; graves?: [CardInstance[], CardInstance[]];
  battlefield?: Partial<Permanent>[]; active?: PlayerId; step?: Step; awaiting?: Awaiting;
} = {}): Game {
  const state = makeTestState({ hands: [options.hand ?? [], options.opponentHand ?? []],
    battlefield: options.battlefield ?? [land()], active: options.active ?? 0 });
  state.rulesRev = 4;
  state.step = options.step ?? state.step;
  state.awaiting = options.awaiting ?? state.awaiting;
  state.players[0].deck = Array.from({ length: 20 }, () => 'bear');
  state.players[1].deck = Array.from({ length: 20 }, () => 'bear');
  state.players[0].graveyard = options.graves?.[0] ?? [];
  state.players[1].graveyard = options.graves?.[1] ?? [];
  state.players[0].landDropsUsed = 1;
  state.nextIid = 100;
  return Game.restore(state, DB);
}
