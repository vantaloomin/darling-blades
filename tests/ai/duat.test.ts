import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { DEFAULT_PERSONALITY } from '../../src/ai/personality';
import { chooseRiteSacrifices } from '../../src/ai/ritePolicy';
import { Game } from '../../src/engine/Game';
import type { Action } from '../../src/engine/actions';
import type { GameState } from '../../src/engine/types';
import { DUAT_DB, duatPermanent } from '../duatFixture';
import { makeTestState } from '../helpers';

function gameWith(opts: {
  hands: [string[], string[]];
  battlefield: ReturnType<typeof duatPermanent>[];
  decks?: [string[], string[]];
}): Game {
  const state: GameState = makeTestState({
    hands: opts.hands,
    battlefield: opts.battlefield,
    active: 0,
  });
  state.players[0].deck = [...(opts.decks?.[0] ?? [])];
  state.players[1].deck = [...(opts.decks?.[1] ?? [])];
  return Game.restore(state, DUAT_DB);
}

function brains(): AIPlayer[] {
  return [
    new EasyAI(DUAT_DB, 17, { ...DEFAULT_PERSONALITY, easyNoise: 0 }),
    new MediumAI(DUAT_DB),
    new HardAI(DUAT_DB),
  ];
}

function castChoice(brain: AIPlayer, game: Game): Action {
  return brain.chooseAction(game.viewFor(0), game.legalActions(0));
}

describe('Sands of the Duat Rite AI', () => {
  it('replaces the canonical set with the lowest-value body for every brain', () => {
    const createGame = (): Game => gameWith({
      hands: [['du-rite-one'], []],
      battlefield: [
        duatPermanent(1, 'forest'),
        duatPermanent(10, 'du-best-body'),
        duatPermanent(11, 'du-mid-body'),
        duatPermanent(12, 'du-cheap-fodder'),
      ],
    });
    const policyGame = createGame();
    const canonical = policyGame.legalActions(0).find(
      (action): action is Extract<Action, { type: 'castSpell' }> => action.type === 'castSpell',
    );
    if (!canonical) throw new Error('Rite was not legal');
    expect(canonical.sacrifices).toEqual([10]);
    expect(chooseRiteSacrifices(policyGame.viewFor(0), DUAT_DB, canonical)).toEqual([12]);

    for (const brain of brains()) {
      expect(castChoice(brain, createGame())).toMatchObject({
        type: 'castSpell', sacrifices: [12],
      });
    }
  });

  it('declines when the only legal sacrifice is the protected best body', () => {
    const createGame = (): Game => gameWith({
      hands: [['du-rite-one'], []],
      battlefield: [duatPermanent(1, 'forest'), duatPermanent(10, 'du-best-body')],
    });
    expect(createGame().legalActions(0).some((action) => action.type === 'castSpell')).toBe(true);
    for (const brain of brains()) {
      expect(castChoice(brain, createGame())).toEqual({ type: 'passStep' });
    }
  });

  it('declines when the cheapest unprotected body is worth more than the cast buys', () => {
    const createGame = (): Game => gameWith({
      hands: [['du-rite-one'], []],
      battlefield: [
        duatPermanent(1, 'forest'),
        duatPermanent(10, 'du-best-body'),
        duatPermanent(11, 'giant'),
      ],
    });
    expect(createGame().legalActions(0).some((action) => action.type === 'castSpell')).toBe(true);
    for (const brain of brains()) {
      expect(castChoice(brain, createGame())).toEqual({ type: 'passStep' });
    }
  });

  it('subtracts fed board value from Medium cast scoring', () => {
    const game = gameWith({
      hands: [['du-rite-one', 'du-modest-cast'], []],
      battlefield: [
        duatPermanent(1, 'forest'),
        duatPermanent(10, 'du-best-body'),
        duatPermanent(11, 'du-mid-body'),
      ],
    });
    const choice = castChoice(new MediumAI(DUAT_DB), game);
    expect(choice).toMatchObject({ type: 'castSpell', handIndex: 1 });
  });

  it('lets Hard search an ordinary Rite candidate through stand-in simulations', () => {
    const game = gameWith({
      hands: [['du-rite-one', 'du-modest-cast'], []],
      battlefield: [
        duatPermanent(1, 'forest'),
        duatPermanent(10, 'du-best-body'),
        duatPermanent(11, 'du-mid-payoff'),
      ],
      decks: [
        Array.from({ length: 4 }, () => 'du-cheap-fodder'),
        Array.from({ length: 4 }, () => 'du-cheap-fodder'),
      ],
    });
    expect(castChoice(new MediumAI(DUAT_DB), game)).toMatchObject({
      type: 'castSpell', handIndex: 1,
    });
    expect(castChoice(new HardAI(DUAT_DB), game)).toMatchObject({
      type: 'castSpell', handIndex: 0, sacrifices: [11],
    });
  });

  it('casts Rite in a seeded Medium mirror smoke game', () => {
    const deck = [
      ...Array.from({ length: 8 }, () => 'forest'),
      ...Array.from({ length: 8 }, () => 'du-fodder-spawn'),
      ...Array.from({ length: 8 }, () => 'du-rite-one'),
    ];
    const game = new Game({ decks: [[...deck], [...deck]], seed: 4224, db: DUAT_DB });
    const players: [MediumAI, MediumAI] = [new MediumAI(DUAT_DB), new MediumAI(DUAT_DB)];
    let castRite = false;
    for (let guard = 0; guard < 800 && !castRite; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') break;
      const player = awaiting.player;
      const action = players[player].chooseAction(game.viewFor(player), game.legalActions(player));
      const events = game.submit(player, action);
      castRite = events.some(
        (event) => event.e === 'spellCast' && DUAT_DB[event.cardId]?.rite !== undefined,
      );
    }
    expect(castRite).toBe(true);
  });
});
