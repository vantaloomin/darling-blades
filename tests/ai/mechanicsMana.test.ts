import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { makePersonality } from '../../src/ai/personality';
import { empowerOpportunityCost, manaPlanKeeping } from '../../src/ai/value';
import { CARD_DB } from '../../src/data/catalog';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { canPay } from '../../src/engine/mana';
import { createRngState } from '../../src/engine/rng';
import type { ActivatedDef, CardDb, CardDef, GameState, Permanent } from '../../src/engine/types';
import type { PlayerView } from '../../src/engine/view';
import { makeTestState } from '../helpers';
import { body, DB as behaviourDb, lands } from './documentedBehaviourFixture';

afterEach(() => { vi.restoreAllMocks(); });

const cost = (generic: number) => ({ generic, pips: {} });
const creature = (id: string, attack: number, defense: number, mana: number,
  extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, types: ['creature'], subtypes: [], colors: [], rarity: 'c',
  cost: cost(mana), attack, defense, ...extra,
});
const duty = (id: string, ability: ActivatedDef): CardDef => ({
  id, name: id, types: ['artifact'], subtypes: [], colors: [], rarity: 'c',
  cost: cost(1), activated: ability,
});
const DB: CardDb = {
  ...behaviourDb,
  'in-comet-blast': CARD_DB['in-comet-blast'],
  'sb-void-lament': CARD_DB['sb-void-lament'],
  tiny: creature('tiny', 1, 1, 1),
  major: creature('major', 6, 6, 3),
  green_major: creature('green_major', 6, 6, 2, { cost: { generic: 0, pips: { G: 2 } } }),
  massive: creature('massive', 20, 20, 0),
  massive_foe: creature('massive_foe', 20, 21, 0),
  defense_six: creature('defense_six', 1, 6, 0),
  second_body: creature('second_body', 3, 3, 2),
  weak_empower: creature('weak_empower', 4, 4, 3, {
    empower: { cost: cost(2), ops: [{ op: 'gainLife', n: 1 }] },
  }),
  strong_empower: creature('strong_empower', 4, 4, 3, {
    empower: { cost: cost(2), ops: [{ op: 'addCounters', n: 4, to: 'self' }] },
  }),
  discounted_empower: creature('discounted_empower', 5, 5, 1, {
    tithe: { per: 2 }, empower: { cost: cost(3), ops: [{ op: 'gainLife', n: 1 }] },
  }),
  green_empower: creature('green_empower', 4, 4, 3, {
    empower: { cost: { generic: 0, pips: { G: 1 } }, ops: [{ op: 'gainLife', n: 1 }] },
  }),
  green_second: creature('green_second', 3, 3, 1, { cost: { generic: 0, pips: { G: 1 } } }),
  blue_second: creature('blue_second', 3, 3, 1, { cost: { generic: 0, pips: { U: 1 } } }),
  blue_mana_body: creature('blue_mana_body', 1, 2, 1, { manaAbility: ['U'] }),
  warcry_provider: {
    id: 'warcry_provider', name: 'warcry_provider', types: ['artifact'], subtypes: [], colors: [], rarity: 'c',
    cost: cost(0), abilities: [{ when: 'static', static: {
      scope: 'filter', filter: { who: 'yours' }, grantKeywords: ['warcry'],
    } }],
  },
  free_duty: duty('free_duty', { cost: { tap: true }, ops: [{ op: 'draw', n: 1 }] }),
  blue_duty: duty('blue_duty', {
    cost: { tap: true, mana: { generic: 0, pips: { U: 1 } } }, ops: [{ op: 'draw', n: 1 }],
  }),
  duty_third: duty('duty_third', { cost: { tap: true, mana: cost(1) }, ops: [{ op: 'draw', n: 1 }] }),
  duty_second: duty('duty_second', { cost: { tap: true, mana: cost(1) }, ops: [{ op: 'draw', n: 2 }] }),
  duty_best: duty('duty_best', { cost: { tap: true, mana: cost(1) }, ops: [{ op: 'draw', n: 3 }] }),
  targeted_duty: duty('targeted_duty', {
    cost: { tap: true, mana: cost(1) }, targets: [{ what: 'creature' }], ops: [{ op: 'damage', n: 2, to: 'target' }],
  }),
  blue_counter: { ...behaviourDb.counter, id: 'blue_counter', cost: { generic: 0, pips: { U: 1 } } },
  red_counter: { ...behaviourDb.counter, id: 'red_counter', cost: { generic: 0, pips: { R: 1 } } },
  remove_six: { ...behaviourDb.remove_three, id: 'remove_six', cost: cost(6) },
  sweep_six: {
    id: 'sweep_six', name: 'sweep_six', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
    cost: cost(6), abilities: [{ when: 'spell', ops: [{ op: 'massDestroy', filter: 'allCreatures' }] }],
  },
  newest_six: {
    id: 'newest_six', name: 'newest_six', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
    cost: cost(6), abilities: [{ when: 'spell', ops: [{ op: 'destroyNewestOpponentArtifactOrEnchantment' }] }],
  },
  artifact_four: {
    id: 'artifact_four', name: 'artifact_four', types: ['artifact'], subtypes: [], colors: [], rarity: 'c', cost: cost(4),
  },
  tap_charm: {
    id: 'tap_charm', name: 'tap_charm', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
    cost: cost(1), abilities: [{ when: 'spell', targets: [{ what: 'creature' }], ops: [{ op: 'tap', to: 'target' }] }],
  },
  recall_save: {
    id: 'recall_save', name: 'recall_save', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
    cost: cost(1), abilities: [{ when: 'spell', targets: [{ what: 'yourCreature' }], ops: [{ op: 'recall', to: 'target' }] }],
  },
  protected_counter: {
    id: 'protected_counter', name: 'protected_counter', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
    cost: cost(1), abilities: [{ when: 'spell', targets: [{ what: 'spell' }, { what: 'yourCreature' }], ops: [
      { op: 'cancel', to: 'target', targetIndex: 0 },
      { op: 'boost', p: 0, t: 1, scope: 'target', targetIndex: 1 },
    ] }],
  },
  battle_trick: {
    id: 'battle_trick', name: 'battle_trick', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
    cost: cost(1), abilities: [{ when: 'spell', targets: [{ what: 'yourCreature' }],
      ops: [{ op: 'boost', p: 2, t: 2, scope: 'target' }] }],
  },
  marked_trick: {
    id: 'marked_trick', name: 'marked_trick', types: ['charm'], subtypes: [], colors: [], rarity: 'c',
    cost: cost(1), abilities: [{ when: 'spell', targets: [{ what: 'yourCreature' }], ops: [
      { op: 'addCounters', n: 1, to: 'target' }, { op: 'boost', p: 1, t: 1, scope: 'target' },
    ] }],
  },
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => {
    const id = `mana_skimmer_${i}`;
    return [id, creature(id, 1, 1, 20, { skim: { cost: cost(0) } })];
  })),
};

// The documented-behaviour fixture shape: real revision-4 state, redacted
// view, engine menu, validation, and submission. No fabricated legal actions.
function board(hand: string[], battlefield: Partial<Permanent>[], setup?: (state: GameState) => void): Game {
  const state = makeTestState({ hands: [hand, []], battlefield, active: 0 });
  state.rng = createRngState(41);
  state.rulesRev = 4;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  state.step = 'main2';
  state.nextIid = 1000;
  for (const player of state.players) {
    player.deck = Array<string>(20).fill('bear');
    player.landDropsUsed = 1;
  }
  setup?.(state);
  return Game.restore(state, DB);
}

function requireLegal(game: Game, action: Action): void {
  expect(validateAction(game.instanceState, DB, 0, action)).toBeNull();
}

function act(game: Game, brain: AIPlayer = new MediumAI(DB)): Action {
  expect(game.awaiting).toMatchObject({ kind: 'main', player: 0 });
  const view = game.viewFor(0);
  const menu = game.legalActions(0);
  const before = structuredClone({ view, menu });
  const action = brain.chooseAction(view, menu);
  expect({ view, menu }).toEqual(before);
  requireLegal(game, action);
  game.submit(0, action);
  return action;
}

function holdsCounter(hand = ['counter'], own: Partial<Permanent>[] = lands(2), enemyMana = 4,
  enemyHand = ['bear']): Game {
  return board(hand, [...own, ...lands(enemyMana, 1), body(10, 'mana_duty')], (state) => {
    state.players[1].hand = enemyHand;
  });
}

function opponentCastsBear(game: Game): void {
  expect(game.awaiting).toMatchObject({ kind: 'main', player: 1 });
  const action: Action = { type: 'castSpell', handIndex: 0 };
  expect(validateAction(game.instanceState, DB, 1, action)).toBeNull();
  game.submit(1, action);
  expect(game.awaiting).toMatchObject({ kind: 'respond', player: 0 });
}

function respond(game: Game): Action {
  expect(game.awaiting).toMatchObject({ kind: 'respond', player: 0 });
  const view = game.viewFor(0);
  const menu = game.legalActions(0);
  const before = structuredClone({ view, menu });
  const action = new MediumAI(DB).chooseAction(view, menu);
  expect({ view, menu }).toEqual(before);
  requireLegal(game, action);
  game.submit(0, action);
  return action;
}

describe('Duty mana competes with development', () => {
  it('develops before an Afternoon mana Duty that would consume the creature payment', () => {
    const game = board(['three'], [...lands(3), body(10, 'mana_duty')]);
    requireLegal(game, { type: 'activate', iid: 10 });
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    expect(act(game)).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect(game.state.battlefield.some((p) => p.cardId === 'three')).toBe(true);
    expect(game.legalActions(0).some((action) => action.type === 'activate')).toBe(false);
  });

  it('keeps the Duty first when its payment leaves enough mana to develop', () => {
    const game = board(['three'], [...lands(5), body(10, 'mana_duty')]);
    expect(act(game)).toMatchObject({ type: 'activate', iid: 10 });
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    expect(act(game)).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect(game.state.battlefield.some((p) => p.cardId === 'three')).toBe(true);
  });

  it.each(['main1', 'main2'] as const)('preserves tap-only Duty timing in %s', (step) => {
    const game = board(['three'], [...lands(3), body(10, 'free_duty')], (state) => { state.step = step; });
    expect(act(game)).toEqual({ type: 'activate', iid: 10 });
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    expect(act(game)).toMatchObject({ type: 'castSpell', handIndex: 0 });
  });
});

describe('holding mana only for a live Charm rule', () => {
  it('holds removal over a mana Duty when a legal opposing target is below the immediate-removal floor', () => {
    // Four is below the main-phase 0.8 x 6 floor and above the response
    // and end-step 3.5 floor, so this removal has a live later rule.
    const game = board(['remove_six'], [...lands(6), body(10, 'mana_duty'), body(20, 'worth_four', 1)]);
    requireLegal(game, { type: 'activate', iid: 10 });
    requireLegal(game, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 20 }] });
    expect(act(game)).toEqual({ type: 'passStep' });
  });

  it('spends on Duty when removal has no opposing target or cannot be paid', () => {
    for (const [mana, hasEnemy] of [[3, false], [2, true]] as const) {
      const game = board(['remove_three'], [
        ...lands(mana), body(10, 'mana_duty'), ...(hasEnemy ? [body(20, 'worth_two', 1)] : []),
      ]);
      expect(act(game)).toMatchObject({ type: 'activate', iid: 10 });
    }
  });

  it('spends on Duty when the only removal target is below every live-rule floor', () => {
    const game = board(['remove_six'], [...lands(6), body(10, 'mana_duty'), body(20, 'worth_two', 1)]);
    requireLegal(game, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 20 }] });
    expect(act(game)).toMatchObject({ type: 'activate', iid: 10 });
  });

  it('reserves a sweeper with a live net-removal rule and casts it in the next response window', () => {
    const game = board(['sweep_six'], [
      ...lands(6), ...lands(2, 1), body(10, 'mana_duty'), body(11, 'worth_two'),
      body(20, 'worth_four', 1), body(21, 'worth_two', 1),
    ], (state) => { state.players[1].hand = ['bear']; });
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    // Net four is below the main 4.8 floor but above the response 3.5 floor.
    expect(act(game)).toEqual({ type: 'passStep' });
    opponentCastsBear(game);
    expect(respond(game)).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect(game.state.battlefield.some((p) => [11, 20, 21].includes(p.iid))).toBe(false);
  });

  it('spends on Duty when a sweeper has no enemy value or loses more friendly value', () => {
    for (const hasEnemy of [false, true]) {
      const game = board(['sweep_six'], [
        ...lands(6), body(10, 'mana_duty'), body(11, 'worth_four'), body(12, 'worth_two'),
        ...(hasEnemy ? [body(20, 'worth_two', 1)] : []),
      ]);
      requireLegal(game, { type: 'castSpell', handIndex: 0 });
      expect(act(game)).toMatchObject({ type: 'activate', iid: 10 });
    }
  });

  it('reserves targetless newest-artifact removal only when its later rule has a valuable target', () => {
    for (const hasEnemy of [false, true]) {
      const game = board(['newest_six'], [
        ...lands(6), ...lands(2, 1), body(10, 'mana_duty'),
        ...(hasEnemy ? [body(20, 'artifact_four', 1)] : []),
      ], (state) => { state.players[1].hand = ['bear']; });
      requireLegal(game, { type: 'castSpell', handIndex: 0 });
      expect(act(game)).toMatchObject(hasEnemy ? { type: 'passStep' } : { type: 'activate', iid: 10 });
      if (hasEnemy) {
        opponentCastsBear(game);
        expect(respond(game)).toMatchObject({ type: 'castSpell', handIndex: 0 });
        expect(game.state.battlefield.some((p) => p.iid === 20)).toBe(false);
      }
    }
  });

  it('reserves a precombat tap against a meaningful attack and spends on Duty against a harmless one', () => {
    for (const enemy of ['major', 'tiny']) {
      const game = board(['tap_charm'], [
        ...lands(2), ...lands(2, 1), body(10, 'mana_duty'), body(20, enemy, 1),
      ], (state) => { state.players[1].hand = ['bear']; });
      requireLegal(game, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 20 }] });
      expect(act(game)).toMatchObject(enemy === 'major' ? { type: 'passStep' } : { type: 'activate', iid: 10 });
      if (enemy === 'major') {
        opponentCastsBear(game);
        expect(respond(game)).toMatchObject({
          type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 20 }],
        });
        expect(game.state.battlefield.find((p) => p.iid === 20)?.tapped).toBe(true);
      }
    }
  });

  it('reserves recall to save a valuable blocker and uses it after that block is declared', () => {
    const game = board(['recall_save'], [
      ...lands(2), body(10, 'mana_duty'), body(11, 'major'), body(20, 'massive', 1),
    ], (state) => {
      state.players[0].life = 2;
      // The opponent draws an instant next turn, allowing a real response
      // exchange after the block. Their current hand opens no Sunset window.
      state.players[1].deck[state.players[1].deck.length - 1] = 'free_draw';
    });
    const save: Action = { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 11 }] };
    requireLegal(game, save);
    // The nine-value blocker clears recall's 1 + 3 / 2 + 1.2 tempo floor.
    expect(act(game)).toEqual({ type: 'passStep' });
    expect(game.awaiting).toMatchObject({ kind: 'main', player: 1 });
    game.submit(1, { type: 'passStep' });
    game.submit(1, { type: 'declareAttackers', attackers: [20] });
    expect(game.awaiting).toMatchObject({ kind: 'respond', player: 0 });
    game.submit(0, { type: 'passResponse' });
    expect(game.awaiting).toMatchObject({ kind: 'declareBlockers', player: 0 });
    game.submit(0, { type: 'declareBlockers', blocks: [{ blocker: 11, attacker: 20 }] });
    expect(game.awaiting).toMatchObject({ kind: 'respond', player: 1 });
    game.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(respond(game)).toMatchObject(save);
    expect(game.state.battlefield.some((p) => p.iid === 11)).toBe(false);
    expect(game.state.players[0].hand).toContain('major');
  });

  it('spends on Duty when a recallable friendly body faces no public threat', () => {
    const game = board(['recall_save'], [...lands(2), body(10, 'mana_duty'), body(11, 'major')]);
    requireLegal(game, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 11 }] });
    expect(act(game)).toMatchObject({ type: 'activate', iid: 10 });
  });

  it('reserves the cheapest useful Comet Blast X payment and spends only the remaining mana on Duty', () => {
    for (const forests of [6, 8]) {
      const game = board(['in-comet-blast'], [
        ...lands(forests), body(110, 'mountain'), body(10, 'mana_duty'), body(20, 'defense_six', 1),
      ]);
      const kill: Action = { type: 'castSpell', handIndex: 0, x: 6, targets: [{ kind: 'permanent', iid: 20 }] };
      requireLegal(game, kill);
      requireLegal(game, { type: 'activate', iid: 10 });
      // X=6 kills the 3.5-value host for seven mana. The main-phase rule
      // holds it, while the end-step rule is live. Larger X adds no value.
      expect(act(game)).toMatchObject(forests === 6 ? { type: 'passStep' } : { type: 'activate', iid: 10 });
      if (forests === 8) requireLegal(game, kill);
    }
  });

  it('reserves Comet Blast for the healed target after cleanup before spending on Duty', () => {
    for (const forests of [6, 8]) {
      const game = board(['in-comet-blast'], [
        ...lands(forests), body(110, 'mountain'), ...lands(2, 1),
        body(10, 'mana_duty'), body(20, 'defense_six', 1, { damage: 2 }),
      ], (state) => { state.players[1].hand = ['bear']; });
      const kill: Action = { type: 'castSpell', handIndex: 0, x: 6, targets: [{ kind: 'permanent', iid: 20 }] };
      requireLegal(game, { ...kill, x: 4 });
      requireLegal(game, kill);
      requireLegal(game, { type: 'activate', iid: 10 });
      // X=4 kills now, but only the opponent receives our Sunset window.
      // The held spell needs X=6 after our cleanup removes the marked damage.
      expect(act(game)).toMatchObject(forests === 6 ? { type: 'passStep' } : { type: 'activate', iid: 10 });
      if (forests === 8) {
        requireLegal(game, { type: 'passStep' });
        game.submit(0, { type: 'passStep' });
      }
      expect(game.awaiting).toMatchObject({ kind: 'main', player: 1 });
      expect(game.state.battlefield.find((p) => p.iid === 20)?.damage).toBe(0);
      const opponentCast: Action = { type: 'castSpell', handIndex: 0 };
      expect(validateAction(game.instanceState, DB, 1, opponentCast)).toBeNull();
      game.submit(1, opponentCast);
      expect(game.awaiting).toMatchObject({ kind: 'respond', player: 0 });
      requireLegal(game, kill);
      game.submit(0, kill);
      expect(game.state.battlefield.some((p) => p.iid === 20)).toBe(false);
    }
  });

  it.each(['Medium', 'Hard'] as const)('%s holds a counter against public hand and four available enemy mana', (name) => {
    const game = holdsCounter();
    const view = game.viewFor(0);
    expect(view.opp.handCount).toBe(1);
    expect(game.legalActions(0).some((action) => action.type === 'castSpell')).toBe(false);
    requireLegal(game, { type: 'activate', iid: 10 });
    expect(act(game, name === 'Medium' ? new MediumAI(DB) : new HardAI(DB))).toEqual({ type: 'passStep' });
  });

  it('does not reserve counter mana without the public mana or hand evidence', () => {
    for (const [mana, hand] of [[3, ['bear']], [4, []]] as const) {
      const game = holdsCounter(['counter'], lands(2), mana, [...hand]);
      expect(act(game)).toMatchObject({ type: 'activate', iid: 10 });
    }
  });

  it('reserves a counter with another mandatory target only when that public target exists', () => {
    for (const hasHost of [false, true]) {
      const game = board(['protected_counter'], [
        ...lands(2), ...lands(4, 1), body(10, 'mana_duty'), ...(hasHost ? [body(11, 'major')] : []),
      ], (state) => { state.players[1].hand = ['bear']; });
      expect(act(game)).toMatchObject(hasHost ? { type: 'passStep' } : { type: 'activate', iid: 10 });
    }
  });

  it('holds a fog over Duty against lethal public combat and spends when that combat is harmless', () => {
    for (const life of [4, 20]) {
      const game = board(['fog'], [...lands(2), body(10, 'mana_duty'), body(20, 'giant', 1)], (state) => {
        state.players[0].life = life;
      });
      expect(act(game)).toMatchObject(life === 4 ? { type: 'passStep' } : { type: 'activate', iid: 10 });
    }
  });

  it('holds a trick that saves a blocker and spends when there is no opposing fight', () => {
    for (const hasEnemy of [true, false]) {
      const game = board(['battle_trick'], [
        ...lands(2), body(10, 'mana_duty'), body(11, 'bear'), ...(hasEnemy ? [body(20, 'three', 1)] : []),
      ], (state) => { state.players[0].life = 2; });
      requireLegal(game, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 11 }] });
      expect(act(game)).toMatchObject(hasEnemy ? { type: 'passStep' } : { type: 'activate', iid: 10 });
    }
  });

  it('reserves Void Lament from its chosen marked-target branch when that debuff saves a blocker', () => {
    const game = board(['sb-void-lament'], [
      body(100, 'swamp'), body(101, 'forest'), body(10, 'mana_duty'),
      body(11, 'major'), body(20, 'major', 1, { plusOneCounters: 1 }),
    ], (state) => { state.players[0].life = 2; });
    requireLegal(game, { type: 'activate', iid: 10 });
    requireLegal(game, { type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 20 }] });
    // The marked 7/7 survives the -3/-3 spell, so this is a combat trick,
    // not immediate removal: our 6/6 survives and kills the resulting 4/4.
    expect(act(game)).toEqual({ type: 'passStep' });
  });

  it('does not reserve a trick with no friendly host or a fog with no opposing attacker', () => {
    const trick = board(['battle_trick'], [...lands(2), body(10, 'mana_duty'), body(20, 'three', 1)]);
    expect(act(trick)).toMatchObject({ type: 'activate', iid: 10 });
    const fog = board(['fog'], [...lands(2), body(10, 'mana_duty')], (state) => { state.players[0].life = 4; });
    expect(act(fog)).toMatchObject({ type: 'activate', iid: 10 });
  });

  it('holds a live Charm over a marginal body and develops a more valuable body', () => {
    for (const id of ['tiny', 'major']) {
      const game = board(['remove_six', id], [...lands(6), body(20, 'worth_four', 1)]);
      requireLegal(game, { type: 'castSpell', handIndex: 1 });
      expect(act(game)).toMatchObject(id === 'tiny' ? { type: 'passStep' } : { type: 'castSpell', handIndex: 1 });
    }
  });

  it('does not reserve a live mixed mark-and-boost Charm against casting that same physical card', () => {
    const game = board(['marked_trick'], [...lands(1), body(10, 'massive'), body(20, 'massive_foe', 1)], (state) => {
      state.players[0].life = 2;
    });
    expect(act(game)).toMatchObject({ type: 'castSpell', handIndex: 0, targets: [{ kind: 'permanent', iid: 10 }] });
    expect(game.state.battlefield.find((p) => p.iid === 10)?.plusOneCounters).toBe(1);
  });

  it('uses the generic Duty payment that keeps the live counter color available', () => {
    const game = holdsCounter(['blue_counter'], [body(100, 'island'), body(101, 'forest'), body(102, 'forest')]);
    expect(act(game)).toMatchObject({ type: 'activate', iid: 10 });
    expect(game.state.battlefield.find((p) => p.iid === 100)?.tapped).toBe(false);
    expect(canPay(game.instanceState, DB, 0, DB.blue_counter.cost!)).toBe(true);
  });

  it('retains the Warcry provider when finding a mana-creature payment that preserves the counter color', () => {
    const game = board(['blue_counter'], [
      body(100, 'island'), body(10, 'duty_third'), body(11, 'warcry_provider'),
      body(12, 'elf', 0, { enteredThisTurn: true }), ...lands(4, 1),
    ], (state) => { state.players[1].hand = ['bear']; });
    // The engine accepts this source only because the other permanent grants
    // Warcry. Restricting payment choices must retain that public static.
    requireLegal(game, { type: 'activate', iid: 10, manaPlan: [12] });
    expect(act(game)).toMatchObject({ type: 'activate', iid: 10, manaPlan: [12] });
    expect(game.state.battlefield.find((p) => p.iid === 12)?.tapped).toBe(true);
    expect(game.state.battlefield.find((p) => p.iid === 100)?.tapped).toBe(false);
    expect(canPay(game.instanceState, DB, 0, DB.blue_counter.cost!)).toBe(true);
  });

  it('keeps a counter color when a marginal generic cast and the counter are both payable', () => {
    const game = board(['blue_counter', 'tiny'], [body(100, 'island'), body(101, 'forest'), ...lands(4, 1)], (state) => {
      state.players[1].hand = ['bear'];
    });
    expect(act(game)).toMatchObject({ type: 'castSpell', handIndex: 1 });
    expect(game.state.battlefield.find((p) => p.iid === 100)?.tapped).toBe(false);
    expect(canPay(game.instanceState, DB, 0, DB.blue_counter.cost!)).toBe(true);
  });

  it('holds the sole counter color when a colored Duty would consume it despite spare generic mana', () => {
    const game = board(['blue_counter'], [
      body(100, 'island'), body(101, 'forest'), body(102, 'forest'), ...lands(4, 1), body(10, 'blue_duty'),
    ], (state) => { state.players[1].hand = ['bear']; });
    requireLegal(game, { type: 'activate', iid: 10 });
    expect(act(game)).toEqual({ type: 'passStep' });
  });

  it.each(['Medium', 'Hard'] as const)('%s preserves the Charm and develop colors together before a paid Duty', (name) => {
    const game = board(['red_counter', 'green_major'], [
      body(100, 'mountain'), body(101, 'forest'), body(102, 'forest'), ...lands(4, 1), body(10, 'duty_third'),
    ], (state) => { state.players[1].hand = ['bear']; });
    const brain = name === 'Medium' ? new MediumAI(DB) : new HardAI(DB);
    requireLegal(game, { type: 'activate', iid: 10 });
    requireLegal(game, { type: 'castSpell', handIndex: 1 });
    // Each reservation alone fits after a one-mana Duty, but R + GG uses
    // all three sources. Replanning for GG must not spend the held R.
    expect(act(game, brain)).toMatchObject({ type: 'castSpell', handIndex: 1 });
    expect(game.state.battlefield.find((p) => p.iid === 100)?.tapped).toBe(false);
    expect(canPay(game.instanceState, DB, 0, DB.red_counter.cost!)).toBe(true);
    requireLegal(game, { type: 'activate', iid: 10 });
    expect(act(game, brain)).toEqual({ type: 'passStep' });
  });

  it('never counts a sacrificed mana creature as a source for the held Charm', () => {
    const game = board(['tithe_horror', 'blue_counter'], [...lands(3), body(10, 'blue_mana_body')]);
    const cast = game.legalActions(0).find((action): action is Extract<Action, { type: 'castSpell' }> =>
      action.type === 'castSpell' && action.tithe === true);
    expect(cast).toBeDefined();
    requireLegal(game, cast!);
    expect(manaPlanKeeping(game.viewFor(0), DB, cast!, DB.blue_counter.cost!)).toBeNull();
    game.submit(0, cast!);
    expect(game.state.battlefield.some((p) => p.iid === 10)).toBe(false);
    expect(canPay(game.instanceState, DB, 0, DB.blue_counter.cost!)).toBe(false);
  });

  it('can spend a sacrificed mana creature on Tithe now while preserving a surviving Charm source', () => {
    const game = board(['tithe_horror', 'blue_counter'], [
      body(100, 'forest'), body(101, 'forest'), body(102, 'island'), body(10, 'blue_mana_body'),
    ]);
    const cast = game.legalActions(0).find((action): action is Extract<Action, { type: 'castSpell' }> =>
      action.type === 'castSpell' && action.tithe === true);
    expect(cast).toBeDefined();
    const view = game.viewFor(0);
    const before = structuredClone(view);
    const plan = manaPlanKeeping(view, DB, cast!, DB.blue_counter.cost!);
    expect(view).toEqual(before);
    expect(plan).toContain(10);
    expect(plan).not.toContain(102);
    const action = { ...cast!, manaPlan: plan! };
    requireLegal(game, action);
    game.submit(0, action);
    expect(game.state.battlefield.some((p) => p.iid === 10)).toBe(false);
    expect(canPay(game.instanceState, DB, 0, DB.blue_counter.cost!)).toBe(true);
  });
});

describe('Empower pays the opportunity cost of the other spell', () => {
  const brains = [
    ['Easy', () => new EasyAI(DB, 41, makePersonality({ easyNoise: 0 }))],
    ['Medium', () => new MediumAI(DB)],
  ] as const;

  it.each(brains)('%s casts plain when the weak rider displaces a useful second spell', (_name, makeBrain) => {
    const game = board(['weak_empower', 'second_body'], lands(5));
    requireLegal(game, { type: 'castSpell', handIndex: 0, empowered: true });
    const action = act(game, makeBrain());
    expect(action).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect(action.type === 'castSpell' && action.empowered === true).toBe(false);
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    expect(game.viewFor(0).you.hand[0]).toBe('second_body');
    expect(act(game, makeBrain())).toMatchObject({ type: 'castSpell', handIndex: 0 });
  });

  it.each(brains)('%s pays a rider worth more than the spell it displaces', (_name, makeBrain) => {
    const game = board(['strong_empower', 'second_body'], lands(5));
    expect(act(game, makeBrain())).toMatchObject({ type: 'castSpell', handIndex: 0, empowered: true });
    expect(game.state.battlefield.find((p) => p.cardId === 'strong_empower')?.plusOneCounters).toBe(4);
  });

  it.each(brains)('%s pays the weak rider when enough mana remains for both spells', (_name, makeBrain) => {
    const game = board(['weak_empower', 'second_body'], lands(7));
    expect(act(game, makeBrain())).toMatchObject({ type: 'castSpell', handIndex: 0, empowered: true });
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    expect(act(game, makeBrain())).toMatchObject({ type: 'castSpell', handIndex: 0 });
  });

  it.each(brains)('%s pays the rider when no other playable card is displaced', (_name, makeBrain) => {
    for (const hand of [['weak_empower'], ['weak_empower', 'costly']]) {
      const game = board(hand, lands(5));
      expect(act(game, makeBrain())).toMatchObject({ type: 'castSpell', handIndex: 0, empowered: true });
    }
  });

  it.each(brains)('%s treats another physical copy as a second-spell alternative', (_name, makeBrain) => {
    const game = board(['weak_empower', 'weak_empower'], lands(6));
    const action = act(game, makeBrain());
    expect(action).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect(action.type === 'castSpell' && action.empowered === true).toBe(false);
    expect(game.viewFor(0).you.hand).toEqual(['weak_empower']);
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    expect(act(game, makeBrain())).toMatchObject({ type: 'castSpell', handIndex: 0 });
    expect(game.state.battlefield.filter((p) => p.cardId === 'weak_empower')).toHaveLength(2);
  });

  it.each(brains)('%s pays Empower when the first creature fills the last creature slot', (_name, makeBrain) => {
    const game = board(['weak_empower', 'second_body'], [
      ...lands(6), ...Array.from({ length: 7 }, (_, i) => body(10 + i, 'worth_two')),
    ]);
    requireLegal(game, { type: 'castSpell', handIndex: 0 });
    requireLegal(game, { type: 'castSpell', handIndex: 0, empowered: true });
    requireLegal(game, { type: 'castSpell', handIndex: 1 });
    // Plain plus the second body costs five, while Empower plus the second
    // costs seven. Only the board cap removes this apparent opportunity.
    expect(act(game, makeBrain())).toMatchObject({ type: 'castSpell', handIndex: 0, empowered: true });
    expect(game.state.battlefield.filter((p) => p.controller === 0 && DB[p.cardId].types.includes('creature')))
      .toHaveLength(8);
  });

  it('charges only the extra mana actually paid when Tithe caps differ between plain and Empower', () => {
    const game = board(['discounted_empower', 'tiny'], [...lands(1), body(10, 'defense_six')]);
    const cast = game.legalActions(0).find((action): action is Extract<Action, { type: 'castSpell' }> =>
      action.type === 'castSpell' && action.handIndex === 0 && action.tithe === true && action.empowered === true);
    expect(cast).toBeDefined();
    requireLegal(game, cast!);
    requireLegal(game, { ...cast!, empowered: false });
    const view = game.viewFor(0);
    const before = structuredClone(view);
    // Defense six saves up to three generic mana: plain pays zero and
    // Empower pays one, so the one-mana alternative is charged once.
    expect(empowerOpportunityCost(view, DB, cast!, () => 1)).toBe(1);
    expect(view).toEqual(before);
    game.submit(0, cast!);
    expect(game.state.battlefield.some((p) => p.iid === 10)).toBe(false);
    expect(game.state.players[0].life).toBe(21);
  });

  it.each(brains)('%s prices the colored second spell and ignores an unpayable color', (_name, makeBrain) => {
    for (const id of ['green_second', 'blue_second']) {
      const game = board(['green_empower', id], [
        body(100, 'forest'), body(101, 'plains'), body(102, 'plains'), body(103, 'plains'), body(104, 'plains'),
      ]);
      requireLegal(game, { type: 'castSpell', handIndex: 0, empowered: true });
      const action = act(game, makeBrain());
      expect(action).toMatchObject({ type: 'castSpell', handIndex: 0 });
      expect(action.type === 'castSpell' && action.empowered === true).toBe(id === 'blue_second');
      if (id === 'green_second') requireLegal(game, { type: 'castSpell', handIndex: 0 });
    }
  });
});

describe('Hard activation fanout', () => {
  it('searches the best two payable Duties beyond the eight ordinary candidate slots', () => {
    const game = board(['forest', ...Array.from({ length: 10 }, (_, i) => `mana_skimmer_${i}`)], [
      ...lands(2), body(10, 'duty_third'), body(11, 'duty_second'), body(12, 'duty_best'),
    ], (state) => { state.players[0].landDropsUsed = 0; });
    for (const iid of [10, 11, 12]) requireLegal(game, { type: 'activate', iid });
    const hard = new HardAI(DB);
    type Search = {
      aggregateOutcome(view: PlayerView, actions: Action[]): { score: number; wonAll: boolean; lostAny: boolean } | null;
    };
    const outcomes = vi.spyOn(hard as unknown as Search, 'aggregateOutcome');
    act(game, hard);
    const candidates = outcomes.mock.calls.slice(1).map(([, actions]) => actions[0]);
    expect(candidates.filter((action) => action.type === 'skim')).toHaveLength(7);
    expect(candidates.filter((action) => action.type === 'activate')).toEqual([
      { type: 'activate', iid: 12 }, { type: 'activate', iid: 11 },
    ]);
  });

  it('keeps a second Duty when the highest-valued Duty has several legal target variants', () => {
    const game = board(['forest', ...Array.from({ length: 10 }, (_, i) => `mana_skimmer_${i}`)], [
      ...lands(2), body(10, 'targeted_duty'), body(11, 'duty_third'),
      body(20, 'worth_two', 1), body(21, 'worth_two', 1),
    ], (state) => { state.players[0].landDropsUsed = 0; });
    for (const iid of [20, 21]) {
      requireLegal(game, { type: 'activate', iid: 10, targets: [{ kind: 'permanent', iid }] });
    }
    requireLegal(game, { type: 'activate', iid: 11 });
    const hard = new HardAI(DB);
    type Search = {
      aggregateOutcome(view: PlayerView, actions: Action[]): { score: number; wonAll: boolean; lostAny: boolean } | null;
    };
    const outcomes = vi.spyOn(hard as unknown as Search, 'aggregateOutcome');
    act(game, hard);
    const candidates = outcomes.mock.calls.slice(1).map(([, actions]) => actions[0]);
    expect(candidates.filter((action) => action.type === 'activate')).toEqual([
      { type: 'activate', iid: 10, targets: [{ kind: 'permanent', iid: 20 }] },
      { type: 'activate', iid: 11 },
    ]);
    expect(candidates.filter((action) => action.type === 'skim')).toHaveLength(7);
  });
});
