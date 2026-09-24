import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { ScriptAI } from '../../src/ai/ScriptAI';
import { makePersonality } from '../../src/ai/personality';
import { Game } from '../../src/engine/Game';
import type { AbilityDef, ActivatedDef, CardDb, CardDef, GameState, Permanent } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const zero = { generic: 0, pips: {} };
const spell = (id: string, ops: NonNullable<AbilityDef['ops']>, targets?: AbilityDef['targets']): CardDef =>
  ({ id, name: id, types: ['ritual'], subtypes: [], colors: [], rarity: 'c', cost: zero,
    abilities: [{ when: 'spell', ops, ...(targets ? { targets } : {}) }] });
const duty = (id: string, activated: ActivatedDef | ActivatedDef[]): CardDef =>
  ({ id, name: id, types: ['artifact'], subtypes: [], colors: [], rarity: 'c', cost: zero, activated });
export const DB: CardDb = {
  ...TEST_DB,
  ...Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`dd_skim_${i}`, { ...TEST_DB.bear, id: `dd_skim_${i}`,
    cost: { generic: 20, pips: {} }, skim: { cost: zero } }])),
  loot: duty('loot', { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }, { op: 'discard', n: 1, who: 'self' }] }),
  foresee_loot: duty('foresee_loot', { cost: { tap: true }, ops: [
    { op: 'foresee', n: 2 }, { op: 'draw', n: 1 }, { op: 'discard', n: 1, who: 'self' },
  ] }),
  loot_win: duty('loot_win', { cost: { tap: true }, ops: [
    { op: 'draw', n: 1 }, { op: 'discard', n: 1, who: 'self' }, { op: 'damage', n: 30, to: 'opponent' },
  ] }),
  duties: duty('duties', [
    { cost: { tap: true }, ops: [{ op: 'gainLife', n: 1 }] },
    { cost: { tap: true }, ops: [{ op: 'draw', n: 2 }] },
  ]),
  paid_duties: duty('paid_duties', [
    { cost: { tap: true }, ops: [{ op: 'foresee', n: 2 }] },
    { cost: { tap: true, mana: { generic: 2, pips: {} } }, ops: [{ op: 'draw', n: 2 }] },
  ]),
  tap_pair: duty('tap_pair', { cost: { tap: true }, targets: [{ what: 'opponentCreature', exactly: 2, maxCost: 4, minAttack: 2 }],
    ops: [{ op: 'tap', to: 'target' }] }),
  edict_charm: { ...spell('edict_charm', [{ op: 'sacrifice', who: 'opponent', n: 1 }]), types: ['charm'] },
  lower_burn: spell('lower_burn', [{ op: 'damage', n: 3, to: 'opponent' }]),
  edict: spell('edict', [{ op: 'sacrifice', who: 'opponent', n: 1 }]),
  each_edict: spell('each_edict', [{ op: 'sacrifice', who: 'each', n: 1 }]),
  edict_win: spell('edict_win', [{ op: 'sacrifice', who: 'opponent', n: 1 }, { op: 'damage', n: 30, to: 'opponent' }]),
  bound: spell('bound', [{ op: 'reclaim', targetIndex: 0 }, { op: 'addCounters', to: 'target', n: 1, targetIndex: 1 }],
    [{ what: 'yourGraveCreature' }, { what: 'yourCreature' }]),
  pair: spell('pair', [{ op: 'tap', to: 'target' }], [{ what: 'creature', exactly: 2 }]),
  rite_target: { ...spell('rite_target', [{ op: 'addCounters', to: 'target', n: 1 }], [{ what: 'yourCreature' }]), rite: { n: 1 }, cost: { generic: 3, pips: {} } },
  retold: { ...TEST_DB.bear, id: 'retold', retell: { cost: zero, targets: [{ what: 'opponentCreature' }],
    ops: [{ op: 'damage', n: 2, to: 'target' }] } },
  costly: { ...TEST_DB.bear, id: 'costly', cost: { generic: 8, pips: {} } },
  costly_red: { ...TEST_DB.bear, id: 'costly_red', cost: { generic: 0, pips: { R: 3 } } },
  tiny: { ...TEST_DB.bear, id: 'tiny', cost: zero, attack: 0, defense: 1, token: true },
  attack_ping: { ...TEST_DB.bear, id: 'attack_ping', abilities: [
    { when: 'attacks', targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 2, to: 'target' }] },
  ] },
  mark_dawn: { ...TEST_DB.bear, id: 'mark_dawn', abilities: [
    { when: 'dawn', targets: [{ what: 'yourCreature' }], ops: [{ op: 'addCounters', n: 1, to: 'target' }] },
  ] },
};
export const difficulties = ['Easy', 'Medium', 'Hard', 'Script'] as const;
export function brain(name: typeof difficulties[number], seed = 41): AIPlayer {
  return name === 'Easy' ? new EasyAI(DB, seed, makePersonality({ easyNoise: 0, easyPassRate: 0 })) :
    name === 'Medium' ? new MediumAI(DB) : name === 'Hard' ? new HardAI(DB) : new ScriptAI(DB);
}
export function stateWith(hand: string[] = [], battlefield: Partial<Permanent>[] = []): GameState {
  const state = makeTestState({ active: 0, hands: [hand, []], battlefield });
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.players[0].deck = Array<string>(12).fill('bear');
  state.players[1].deck = Array<string>(12).fill('bear');
  state.players[0].landDropsUsed = 1;
  state.nextIid = 100;
  return state;
}
export const body = (iid: number, cardId: string, controller: 0 | 1 = 0): Partial<Permanent> => ({ iid, cardId, controller });
export const forests = (n: number): Partial<Permanent>[] => Array.from({ length: n }, (_, i) => body(50 + i, 'forest'));
export const gameWith = (hand: string[] = [], battlefield: Partial<Permanent>[] = []): Game => Game.restore(stateWith(hand, battlefield), DB);
