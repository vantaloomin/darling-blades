import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/config/rules';
import { Game } from '../../src/engine/Game';
import type { GameEvent } from '../../src/engine/events';
import type { CardDb, GameState, Permanent } from '../../src/engine/types';
import { deckOf, makeTestState, runBotGame, TEST_DB } from '../helpers';
import { DARK_TALES_DB } from '../darkTalesFixture';

const FORESEE_DB: CardDb = {
  ...TEST_DB,
  foresee_charm: {
    id: 'foresee_charm',
    name: 'Glimpse the Weave',
    types: ['charm'],
    subtypes: [],
    cost: { generic: 0, pips: { U: 1 } },
    colors: ['U'],
    abilities: [{ when: 'spell', ops: [{ op: 'foresee', n: 2 }] }],
    rarity: 'c',
  },
};

function rev2(state: GameState): GameState {
  state.rulesRev = 2;
  state.episode = { resolvedSinceOffer: 0, reopensThisStep: 0 };
  return state;
}

function lands(controller: 0 | 1, from: number, cardIds: string[]): Partial<Permanent>[] {
  return cardIds.map((cardId, index) => ({ iid: from + index, cardId, controller }));
}

function endStepGame(
  p1Hand: string[],
  battlefield: Partial<Permanent>[],
  db: CardDb = TEST_DB,
): Game {
  const state = rev2(makeTestState({ hands: [[], p1Hand], battlefield, active: 0 }));
  state.step = 'main2';
  state.players[0].deck = ['forest'];
  state.players[1].deck = ['forest', 'bear', 'elf', 'giant'];
  const game = Game.restore(state, db);
  game.submit(0, { type: 'passStep' });
  expect(game.awaiting).toMatchObject({ player: 1, kind: 'endStepWindow' });
  return game;
}

function reopened(events: readonly GameEvent[], over?: 'attackers' | 'blockers'): boolean {
  return events.some((event) => event.e === 'responseWindowOpened' && event.reopened === true) &&
    (over === undefined || events.some(
      (event) => event.e === 'responseWindowOpened' && event.reopened === true,
    ));
}

describe('revision-2 priority-window reopening', () => {
  it('reopens the end step after a Charm resolves', () => {
    const game = endStepGame(['shock', 'shock'], lands(1, 20, ['mountain', 'mountain']));
    const events = game.submit(1, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'player', player: 0 }],
    });

    expect(events).toContainEqual({ e: 'responseWindowOpened', player: 1, reopened: true });
    expect(game.awaiting).toEqual({ player: 1, kind: 'endStepWindow' });
    expect(game.instanceState.episode).toEqual({ resolvedSinceOffer: 0, reopensThisStep: 1 });
  });

  it('does not reopen after an empty combat flush', () => {
    const state = rev2(makeTestState({
      hands: [[], ['shock']],
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0 },
        ...lands(1, 20, ['mountain']),
      ],
      active: 0,
    }));
    state.step = 'combat';
    state.combat = { attackers: [1], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
    state.awaiting = { player: 1, kind: 'respond', over: { type: 'attackers' } };
    const game = Game.restore(state, TEST_DB);

    const events = game.submit(1, { type: 'passResponse' });

    expect(reopened(events)).toBe(false);
    expect(game.awaiting).toEqual({ player: 1, kind: 'declareBlockers' });
    expect(game.instanceState.episode?.resolvedSinceOffer).toBe(0);
  });

  it('reopens at both combat sub-phases after paid flushes', () => {
    const state = rev2(makeTestState({
      hands: [['shock'], ['shock', 'shock', 'shock']],
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0 },
        ...lands(0, 10, ['mountain']),
        ...lands(1, 20, ['mountain', 'mountain', 'mountain']),
      ],
      active: 0,
    }));
    state.step = 'combat';
    state.awaiting = { player: 0, kind: 'declareAttackers' };
    const game = Game.restore(state, TEST_DB);

    game.submit(0, { type: 'declareAttackers', attackers: [1] });
    game.submit(1, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'player', player: 0 }],
    });
    const attackerReopen = game.submit(0, { type: 'passResponse' });
    expect(attackerReopen).toContainEqual({ e: 'responseWindowOpened', player: 1, reopened: true });
    expect(game.awaiting).toMatchObject({ kind: 'respond', over: { type: 'attackers' } });
    game.submit(1, { type: 'passResponse' });
    expect(game.awaiting.kind).toBe('declareBlockers');

    game.submit(1, { type: 'declareBlockers', blocks: [] });
    expect(game.awaiting).toMatchObject({ player: 0, kind: 'respond', over: { type: 'blockers' } });
    game.submit(0, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'player', player: 1 }],
    });
    expect(game.legalActions(1).some((action) => action.type === 'castSpell')).toBe(true);
    expect(game.instanceState.episode).toEqual({ resolvedSinceOffer: 0, reopensThisStep: 1 });
    const blockerReopen = game.submit(1, { type: 'passResponse' });

    expect(blockerReopen).toContainEqual({ e: 'responseWindowOpened', player: 1, reopened: true });
    expect(game.awaiting).toMatchObject({ player: 1, kind: 'respond', over: { type: 'blockers' } });
  });

  it('denies a reopen when the remaining option is Skim-only', () => {
    const game = endStepGame(
      ['shock', 'skimCard'],
      lands(1, 20, ['mountain', 'forest']),
      DARK_TALES_DB,
    );
    const events = game.submit(1, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'player', player: 0 }],
    });

    expect(reopened(events)).toBe(false);
    expect(game.state.step).not.toBe('end');
  });

  it('enforces the per-step cap and resets it on the next step change', () => {
    const state = rev2(makeTestState({
      hands: [[], ['shock']],
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0 },
        ...lands(1, 20, ['mountain']),
      ],
      active: 0,
    }));
    state.step = 'combat';
    state.combat = { attackers: [1], blocks: [], phase: 'attackersDeclared', damagePrevented: false };
    state.awaiting = { player: 1, kind: 'respond', over: { type: 'attackers' } };
    state.episode = {
      resolvedSinceOffer: 1,
      reopensThisStep: RULES.maxWindowReopensPerStep,
    };
    const game = Game.restore(state, TEST_DB);

    const events = game.submit(1, { type: 'passResponse' });
    expect(reopened(events)).toBe(false);
    expect(game.awaiting.kind).toBe('declareBlockers');
    game.submit(1, { type: 'declareBlockers', blocks: [] });
    expect(game.state.step).toBe('main2');
    expect(game.instanceState.episode?.reopensThisStep).toBe(0);
  });

  it('keeps revision-1 construction byte-identical and on classic window behavior', () => {
    const deck = deckOf([
      ['mountain', 20],
      ['shock', 20],
      ['bear', 20],
    ]);
    const make = (): Game => new Game({ decks: [deck, deck], seed: 9137, db: TEST_DB, rulesRev: 1 });
    const a = make();
    const b = make();

    expect('rulesRev' in a.state).toBe(false);
    expect('episode' in a.state).toBe(false);
    const eventsA = runBotGame(a);
    const eventsB = runBotGame(b);
    expect(eventsA.some((event) => event.e === 'responseWindowOpened' && event.reopened)).toBe(false);
    expect(JSON.stringify(eventsA)).toBe(JSON.stringify(eventsB));
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it('preserves reopen credit across a deferred Foresee and rejoins the end step', () => {
    const game = endStepGame(
      ['shock', 'foresee_charm', 'shock'],
      lands(1, 20, ['mountain', 'island', 'mountain']),
      FORESEE_DB,
    );
    game.submit(1, {
      type: 'castSpell',
      handIndex: 0,
      targets: [{ kind: 'player', player: 0 }],
    });
    expect(game.awaiting).toEqual({ player: 1, kind: 'endStepWindow' });

    game.submit(1, { type: 'castSpell', handIndex: 0 });
    expect(game.awaiting).toMatchObject({ player: 1, kind: 'foresee' });
    expect(game.state.step).toBe('end');
    expect(game.instanceState.episode?.resolvedSinceOffer).toBe(1);

    const events = game.submit(1, { type: 'foresee', bottomIndices: [] });
    expect(events).toContainEqual({ e: 'responseWindowOpened', player: 1, reopened: true });
    expect(game.awaiting).toEqual({ player: 1, kind: 'endStepWindow' });
    expect(game.instanceState.episode).toEqual({ resolvedSinceOffer: 0, reopensThisStep: 2 });

    game.submit(1, { type: 'passResponse' });
    expect(game.state.step).not.toBe('end');
  });
});
