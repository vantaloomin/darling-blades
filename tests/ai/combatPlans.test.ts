import { describe, expect, it } from 'vitest';
import { chooseAttackers, chooseBlocks, combatForecast, scoreAttack } from '../../src/ai/combatPlans';
import { makePersonality } from '../../src/ai/personality';
import { permValue } from '../../src/ai/value';
import { validateAction, type Action } from '../../src/engine/actions';
import { previewCombat } from '../../src/engine/combat/damage';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, CombatState, GameState, Keyword } from '../../src/engine/types';
import { makeTestState, TEST_DB } from '../helpers';

const creature = (id: string, attack: number, defense: number, keywords: Keyword[] = []): CardDef =>
  ({ ...TEST_DB.bear, id, attack, defense, keywords });
const DB: CardDb = {
  ...TEST_DB,
  five: creature('five', 0, 5),
  three: creature('three', 3, 3),
  wall_eight: creature('wall_eight', 0, 8),
  first_giant: creature('first_giant', 4, 4, ['firstBlade']),
  twin_four: creature('twin_four', 2, 4, ['firstBlade', 'twinBlades']),
  first_four: creature('first_four', 2, 4, ['firstBlade']),
  twin_dread: creature('twin_dread', 4, 4, ['twinBlades', 'dreaded']),
  twin_three: creature('twin_three', 3, 3, ['twinBlades']),
  guard: creature('guard', 1, 1),
  plain_sentinel: { ...TEST_DB.sentinel, id: 'plain_sentinel', keywords: [] },
};

function combat(attacker: string, defenders: string[] = [], db = DB): Game {
  const state = makeTestState({ battlefield: [
    { iid: 1, cardId: attacker, controller: 0, tapped: true },
    ...defenders.map((cardId, i) => ({ iid: 10 + i, cardId, controller: 1 as const })),
  ] });
  state.step = 'combat';
  state.awaiting = { kind: 'declareBlockers', player: 1 };
  state.combat = { attackers: [1], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
  state.players.forEach((p) => { p.deck = Array<string>(20).fill('bear'); });
  return Game.restore(state, db);
}

function legal(game: Game, action: Action, db = DB): Action {
  const awaiting = game.awaiting;
  if (awaiting.kind === 'gameOver') throw new Error('fixture ended');
  expect(validateAction(game.instanceState, db, awaiting.player, action)).toBeNull();
  return action;
}

function blocks(game: Game, threshold = 0): Action {
  const view = game.viewFor(1);
  return legal(game, { type: 'declareBlockers', blocks: chooseBlocks(
    view.battlefield, DB, 1, view.you.life, view.combat!, 0,
    makePersonality({ blockThreshold: threshold }),
  ) });
}

function attack(game: Game, threshold: number): { game: Game; action: Action } {
  const state: GameState = structuredClone(game.instanceState);
  state.battlefield = structuredClone(game.state.battlefield);
  state.battlefield.filter((p) => p.controller === 0).forEach((p) => { p.tapped = false; });
  state.awaiting = { kind: 'declareAttackers', player: 0 };
  state.combat = null;
  const declaring = Game.restore(state, DB);
  const view = declaring.viewFor(0);
  const action = legal(declaring, { type: 'declareAttackers', attackers: chooseAttackers(
    view.battlefield, DB, 0, view.opp.life, 0, view.you.life,
    makePersonality({ attackThreshold: threshold }),
  ) });
  return { game: declaring, action };
}

function assigned(game: Game): CombatState {
  const blocks = game.state.battlefield.filter((p) => p.controller === 1)
    .map((p) => ({ blocker: p.iid, attacker: 1 }));
  legal(game, { type: 'declareBlockers', blocks });
  return { ...game.state.combat!, blocks };
}

describe('shared combat keyword plans', () => {
  it('scores two unblocked Twin Blades hits and their lethal connection', () => {
    for (const id of ['ds_bear', 'ds_fs']) {
      const game = combat(id);
      expect(scoreAttack(game.state.battlefield, DB, 0, 20, 0, [1])).toBeCloseTo(1.8);
      expect(scoreAttack(game.state.battlefield, DB, 0, 3, 0, [1])).toBeCloseTo(103.6);
      expect(combatForecast(game.state.battlefield, DB, game.state.combat!)).toEqual({ damage: 4, dying: [] });
    }
    expect(scoreAttack(combat('bear').state.battlefield, DB, 0, 20, 0, [1])).toBeCloseTo(0.9);
  });

  it('scores the first-hit kill without a normal blocker striking back', () => {
    for (const [attacker, defender] of [['ds_bear', 'bear'], ['ds_deathtouch', 'giant']]) {
      const game = combat(attacker, [defender]);
      // Lethal pressure forces the otherwise losing chump into the score model.
      game.state.players[1].life = 2;
      expect(blocks(game)).toEqual({ type: 'declareBlockers', blocks: [{ blocker: 10, attacker: 1 }] });
      expect(scoreAttack(game.state.battlefield, DB, 0, 2, 0, [1]))
        .toBeCloseTo(permValue(game.state.battlefield, DB, 10));
      expect(combatForecast(game.state.battlefield, DB, assigned(game))).toEqual({ damage: 0, dying: [10] });
    }
  });

  it('keeps the second hit when death is simultaneous, but loses it to first strike', () => {
    const ordinary = combat('ds_bear', ['giant']);
    expect(combatForecast(ordinary.state.battlefield, DB, assigned(ordinary)).dying.sort()).toEqual([1, 10]);
    const first = combat('ds_bear', ['first_giant']);
    expect(combatForecast(first.state.battlefield, DB, assigned(first))).toEqual({ damage: 0, dying: [1] });
    expect(blocks(combat('giant', ['ds_bear'])))
      .toEqual({ type: 'declareBlockers', blocks: [{ blocker: 10, attacker: 1 }] });
    expect(blocks(combat('first_giant', ['ds_bear'])))
      .toEqual({ type: 'declareBlockers', blocks: [] });
  });

  it('does not turn firstBlade plus Twin Blades into three hits against five defense', () => {
    const game = combat('ds_fs', ['five']);
    expect(combatForecast(game.state.battlefield, DB, assigned(game))).toEqual({ damage: 0, dying: [] });
    expect(scoreAttack(game.state.battlefield, DB, 0, 4, 0, [1])).toBe(0);
  });

  it('values a Twin Blades blocker preempting the attacker in the pair score', () => {
    const game = combat('bear', ['ds_bear']);
    const value = permValue(game.state.battlefield, DB, 1);
    // Only a surviving blocker clears this threshold; subtracting its value would fail.
    expect(blocks(game, value)).toEqual({ type: 'declareBlockers', blocks: [{ blocker: 10, attacker: 1 }] });
  });

  it('uses full incoming Twin Blades damage for life pressure and lethal chumps', () => {
    for (const life of [4, 6]) {
      const game = combat('ds_bear', ['guard']);
      game.state.players[1].life = life;
      expect(blocks(game)).toEqual({ type: 'declareBlockers', blocks: [{ blocker: 10, attacker: 1 }] });
      const plain = combat('bear', ['guard']);
      plain.state.players[1].life = life;
      expect(blocks(plain)).toEqual({ type: 'declareBlockers', blocks: [] });
    }
  });

  it('counts two hits in lethal absorption and absorbs the highest full damage first', () => {
    const solo = combat('ds_bear');
    solo.state.players[1].life = 4;
    expect(attack(solo, 1000).action).toEqual({ type: 'declareAttackers', attackers: [1] });
    for (const life of [3, 4]) {
      const game = combat('ds_bear', ['wall_eight']);
      game.state.battlefield.push({ ...game.state.battlefield[0], iid: 2, cardId: 'three' });
      game.state.players[1].life = life;
      expect(attack(game, 1000).action).toEqual({ type: 'declareAttackers', attackers: life === 3 ? [1, 2] : [] });
    }
  });

  it('rejects a false Twin Blades gang kill after the first hit removes a blocker', () => {
    const game = combat('twin_dread', ['three', 'three']);
    expect(blocks(game)).toEqual({ type: 'declareBlockers', blocks: [] });
    expect(combatForecast(game.state.battlefield, DB, assigned(game)).dying.sort()).toEqual([10, 11]);
    // One Twin Blades blocker supplies the missing first-step hit, so this pair really kills.
    const improved = combat('twin_dread', ['three', 'twin_three']);
    expect(blocks(improved)).toEqual({ type: 'declareBlockers', blocks: [
      { blocker: 10, attacker: 1 }, { blocker: 11, attacker: 1 },
    ] });
    game.state.players[1].life = 8;
    expect(blocks(game)).toEqual({ type: 'declareBlockers', blocks: [
      { blocker: 10, attacker: 1 }, { blocker: 11, attacker: 1 },
    ] });
  });

  it('carries both sides of Twin Blades through attackersDeclared and firstStrikeDone', () => {
    for (const phase of ['attackersDeclared', 'firstStrikeDone'] as const) {
      const game = combat('twin_four', ['twin_four']);
      const plan = { ...assigned(game), phase };
      if (phase === 'firstStrikeDone') game.state.battlefield.forEach((p) => { p.damage = 2; });
      expect(combatForecast(game.state.battlefield, DB, plan).dying.sort()).toEqual([1, 10]);
    }
    for (const [id, damage] of [['ds_fs', 2], ['ds_bear', 2], ['knight', 0]] as const) {
      const game = combat(id);
      expect(combatForecast(game.state.battlefield, DB, { ...game.state.combat!, phase: 'firstStrikeDone' }))
        .toEqual({ damage, dying: [] });
    }
  });

  it('counts Twin Blades blocker first-strike power and spends only pure firstBlade', () => {
    const game = combat('bear', ['ds_bear']);
    expect(combatForecast(game.state.battlefield, DB, assigned(game))).toEqual({ damage: 0, dying: [1] });
    for (const defender of ['twin_four', 'first_four']) {
      const after = combat('bear', [defender]);
      const result = combatForecast(after.state.battlefield, DB, { ...assigned(after), phase: 'firstStrikeDone' });
      expect(result).toEqual({ damage: 0, dying: defender === 'twin_four' ? [1] : [] });
    }
  });

  it('spills Overrun in each sub-step and remains blocked after a blocker disappears', () => {
    const game = combat('ds_trample', ['elf']);
    expect(combatForecast(game.state.battlefield, DB, assigned(game))).toEqual({ damage: 5, dying: [10] });
    // Force the chump so scoreAttack also proves five points of overflow.
    game.state.players[1].life = 6;
    expect(blocks(game)).toEqual({ type: 'declareBlockers', blocks: [{ blocker: 10, attacker: 1 }] });
    expect(scoreAttack(game.state.battlefield, DB, 0, 6, 0, [1]))
      .toBeCloseTo(permValue(game.state.battlefield, DB, 10) + 5 * 0.9);
    for (const [id, damage] of [['ds_bear', 0], ['ds_trample', 6]] as const) {
      const missing = combat(id);
      expect(combatForecast(missing.state.battlefield, DB, {
        ...missing.state.combat!, blocks: [{ blocker: 99, attacker: 1 }],
      })).toEqual({ damage, dying: [] });
    }
  });

  it('exempts each Sentinel attacker from holdback and keeps it available to block next turn', () => {
    for (const id of ['plain_sentinel', 'sentinel']) {
      const game = combat(id, ['giant']);
      game.state.battlefield[1].tapped = true;
      expect(scoreAttack(game.state.battlefield, DB, 0, 20, 0, [1], 6))
        .toBeCloseTo(id === 'sentinel' ? 0.9 : 0.5);
      const declared = attack(game, -100);
      declared.game.submit(0, declared.action);
      expect(declared.game.state.battlefield.find((p) => p.iid === 1)?.tapped).toBe(id !== 'sentinel');
      // Carry the actual post-attack tap state into the opponent's next combat.
      const state: GameState = structuredClone(declared.game.instanceState);
      state.activePlayer = 1;
      state.awaiting = { kind: 'declareBlockers', player: 0 };
      state.combat = { attackers: [10], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
      const nextCombat = Game.restore(state, DB);
      const view = nextCombat.viewFor(0);
      const response = legal(nextCombat, { type: 'declareBlockers', blocks: chooseBlocks(
        view.battlefield, DB, 0, 4, view.combat!, 0,
      ) });
      expect(response).toEqual({ type: 'declareBlockers', blocks: id === 'sentinel' ? [{ blocker: 1, attacker: 10 }] : [] });
    }
    const mixed = combat('sentinel', ['twin_four']);
    mixed.state.battlefield[1].tapped = true;
    mixed.state.battlefield.push({ ...mixed.state.battlefield[0], iid: 2, cardId: 'plain_sentinel' });
    // The opposing Twin Blades body represents four power on the counterattack;
    // exactly one of our two attackers incurs the 0.4 holdback charge.
    expect(scoreAttack(mixed.state.battlefield, DB, 0, 20, 0, [1, 2], 6)).toBeCloseTo(1.4);
  });

  it('reads granted effective keywords and retains defender trick buffs', () => {
    const game = combat('bear', ['bear']);
    game.state.battlefield[0].untilEotMods.push({ p: 0, t: 0, keywords: ['twinBlades', 'sentinel'] });
    expect(combatForecast(game.state.battlefield, DB, assigned(game))).toEqual({ damage: 0, dying: [10] });
    expect(scoreAttack(game.state.battlefield, DB, 0, 2, 0, [1]))
      .toBeCloseTo(permValue(game.state.battlefield, DB, 10));
    expect(scoreAttack(game.state.battlefield, DB, 0, 2, 2, [1]))
      .toBeCloseTo(permValue(game.state.battlefield, DB, 10) - permValue(game.state.battlefield, DB, 1));
    game.state.battlefield[1].cardId = 'giant';
    game.state.battlefield[1].tapped = true;
    expect(scoreAttack(game.state.battlefield, DB, 0, 20, 0, [1], 6)).toBeCloseTo(1.8);
  });

  it('matches engine damage for 147 keyword/stat exchanges without mutating the public board', () => {
    const keywords: Keyword[][] = [[], ['firstBlade'], ['twinBlades'], ['firstBlade', 'twinBlades'],
      ['deathblade'], ['twinBlades', 'deathblade'], ['twinBlades', 'overrun']];
    for (const aKeywords of keywords) for (const bKeywords of keywords) {
      for (const [aPower, aDefense, bPower, bDefense] of [[2, 2, 4, 4], [3, 4, 2, 3], [0, 2, 2, 5]]) {
        const db = { ...DB, a: creature('a', aPower, aDefense, aKeywords), b: creature('b', bPower, bDefense, bKeywords) };
        const game = combat('a', ['b'], db);
        const plan = { ...game.state.combat!, blocks: [{ blocker: 10, attacker: 1 }] };
        legal(game, { type: 'declareBlockers', blocks: plan.blocks }, db);
        const before = structuredClone(game.state.battlefield);
        const expected = previewCombat(game.instanceState, db, plan.blocks);
        const actual = combatForecast(game.viewFor(0).battlefield, db, plan);
        expect(actual.damage).toBe(0 - expected.lifeDelta[1]);
        expect(actual.dying.sort()).toEqual(expected.deaths.sort());
        expect(game.state.battlefield).toEqual(before);
      }
    }
  });

  it('keeps prevention and marked damage through both sub-steps', () => {
    const game = combat('ds_trample', ['five']);
    game.state.battlefield[1].damage = 2;
    const plan = assigned(game);
    expect(combatForecast(game.state.battlefield, DB, plan)).toEqual({ damage: 3, dying: [10] });
    game.state.battlefield[1].combatDamagePrevented = true;
    expect(combatForecast(game.state.battlefield, DB, plan)).toEqual({ damage: 0, dying: [] });
    expect(combatForecast(game.state.battlefield, DB, { ...plan, damagePrevented: true }))
      .toEqual({ damage: 0, dying: [] });
  });
});
