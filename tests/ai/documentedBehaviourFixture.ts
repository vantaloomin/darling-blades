import type { AIPlayer } from '../../src/ai/AIPlayer';
import { MediumAI } from '../../src/ai/MediumAI';
import { CARD_DB } from '../../src/data/catalog';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { createRngState } from '../../src/engine/rng';
import type { AbilityDef, CardDb, CardDef, GameState, Permanent } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const cost = (generic: number) => ({ generic, pips: {} });
const creature = (id: string, attack: number, defense: number, mana = 0, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], colors: [], rarity: 'c',
  cost: cost(mana), attack, defense, ...extra,
});
const spell = (id: string, mana: number, ops: NonNullable<AbilityDef['ops']>, targets?: AbilityDef['targets'], ritual = false): CardDef => ({
  id, name: id, types: [ritual ? 'ritual' : 'charm'], subtypes: [], colors: [], rarity: 'c',
  cost: cost(mana), abilities: [{ when: 'spell', ops, ...(targets ? { targets } : {}) }],
});
export const DB: CardDb = {
  ...TEST_DB,
  'tok-kelp-shade': CARD_DB['tok-kelp-shade'],
  costly: creature('costly', 1, 1, 8),
  cheap_value: creature('cheap_value', 6, 6, 2),
  expensive_blank: spell('expensive_blank', 5, [], undefined, true),
  small_guard: creature('small_guard', 1, 1, 2),
  worth_two: creature('worth_two', 2, 2),
  worth_two_half: creature('worth_two_half', 2, 3),
  worth_three: creature('worth_three', 3, 3),
  worth_four: creature('worth_four', 4, 4),
  damaged_target: creature('damaged_target', 2, 4, 1),
  three: creature('three', 3, 3, 3),
  cap_attacker: creature('cap_attacker', 7, 6, 5, { keywords: ['firstBlade', 'overrun'] }),
  first_four: creature('first_four', 4, 4, 4, { keywords: ['firstBlade'] }),
  dreaded_four: creature('dreaded_four', 4, 4, 4, { keywords: ['dreaded'] }),
  plain_sentinel: { ...TEST_DB.sentinel, id: 'plain_sentinel', keywords: [] },
  plain_knight: { ...TEST_DB.knight, id: 'plain_knight', keywords: [] },
  plain_rhino: { ...TEST_DB.rhino, id: 'plain_rhino', keywords: [] },
  burn: spell('burn', 2, [{ op: 'damage', n: 2, to: 'target' }], [{ what: 'any' }]),
  face_ritual: spell('face_ritual', 2, [{ op: 'damage', n: 3, to: 'opponent' }], undefined, true),
  drain_ritual: spell('drain_ritual', 2, [{ op: 'loseLife', n: 3, who: 'opponent' }], undefined, true),
  remove_three: spell('remove_three', 3, [{ op: 'destroy', to: 'target' }], [{ what: 'creature' }]),
  remove_four: spell('remove_four', 4, [{ op: 'destroy', to: 'target' }], [{ what: 'creature' }]),
  remove_five: spell('remove_five', 5, [{ op: 'destroy', to: 'target' }], [{ what: 'creature' }]),
  free_draw: spell('free_draw', 0, [{ op: 'draw', n: 1 }]),
  counter: spell('counter', 1, [{ op: 'cancel', to: 'target' }], [{ what: 'spell' }]),
  fog: spell('fog', 1, [{ op: 'preventCombat' }]),
  wrath: spell('wrath', 3, [{ op: 'massDestroy', filter: 'allCreatures' }], undefined, true),
  tithe_horror: creature('tithe_horror', 5, 5, 4, { subtypes: ['Horror'], tithe: { per: 2 } }),
  mana_duty: { id: 'mana_duty', name: 'mana_duty', types: ['artifact'], subtypes: [], colors: [], rarity: 'c',
    cost: cost(1), activated: { cost: { tap: true, mana: cost(2) }, ops: [{ op: 'draw', n: 1 }] } },
  saving_link: { id: 'saving_link', name: 'saving_link', types: ['artifact'], subtypes: [], colors: [], rarity: 'c',
    cost: cost(0), hauntlink: { cost: cost(0), linked: { t: 2 } } },
  draft_vanilla: creature('draft_vanilla', 2, 2, 2),
  draft_duty: creature('draft_duty', 2, 2, 2, { activated: { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] } }),
  draft_empower: creature('draft_empower', 2, 2, 2, { empower: { cost: cost(1), ops: [{ op: 'draw', n: 1 }] } }),
  draft_bulwark: creature('draft_bulwark', 2, 2, 2, { keywords: ['bulwark'] }),
};

export const body = (iid: number, cardId: string, controller: 0 | 1 = 0, extra: Partial<Permanent> = {}): Partial<Permanent> =>
  ({ iid, cardId, controller, ...extra });
export const lands = (n: number, controller: 0 | 1 = 0): Partial<Permanent>[] =>
  Array.from({ length: n }, (_, i) => body(100 + controller * 20 + i, 'forest', controller));

export function fixture(hand: string[] = [], battlefield: Partial<Permanent>[] = [], setup?: (state: GameState) => void): Game {
  return checked(() => {
    const state = makeTestState({ active: 0, hands: [hand, []], battlefield });
    state.rng = createRngState(41);
    state.rulesRev = 4;
    state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
    for (const player of state.players) {
      player.deck = Array<string>(20).fill('bear');
      player.landDropsUsed = 1;
    }
    state.nextIid = 200;
    setup?.(state);
    return Game.restore(state, DB);
  });
}

// These cumulative errors are asserted in afterAll, outside it.fails' inversion.
// A broken premise, crashing brain, or illegal action must never make an xfail green.
export const invariantErrors: string[] = [];
export function checked<T>(run: () => T): T {
  try { return run(); } catch (error) {
    invariantErrors.push(error instanceof Error ? error.message : String(error));
    throw error;
  }
}
export function act(game: Game, brain: AIPlayer = new MediumAI(DB)): Action {
  return checked(() => {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') throw new Error('Fixture ended before the decision');
    const player = awaiting.player;
    const action = brain.chooseAction(game.viewFor(player), game.legalActions(player));
    const error = validateAction(game.instanceState, DB, player, action);
    if (error !== null) throw new Error(`Illegal brain action ${JSON.stringify(action)}: ${error}`);
    game.submit(player, action);
    return action;
  });
}

export function attacks(cardId: string, enemy: Partial<Permanent>[] = [], life = 20): Game {
  return fixture([], [body(10, cardId), ...enemy], (state) => {
    state.step = 'combat';
    state.awaiting = { kind: 'declareAttackers', player: 0 };
    state.players[0].life = life;
  });
}
export function blocks(attacker: string, defenders: string[]): Game {
  return fixture([], [body(20, attacker, 1, { tapped: true }), ...defenders.map((id, i) => body(10 + i, id))], (state) => {
    state.activePlayer = 1;
    state.step = 'combat';
    state.awaiting = { kind: 'declareBlockers', player: 0 };
    state.combat = { attackers: [20], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
  });
}
