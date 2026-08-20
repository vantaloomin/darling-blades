import { describe, expect, it } from 'vitest';
import { MediumAI } from '../../src/ai/MediumAI';
import { CARD_DB } from '../../src/data/catalog';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { Game } from '../../src/engine/Game';
import type { Action } from '../../src/engine/actions';
import { GameTelemetry } from '../../src/meta/telemetry';
import { playOut } from '../../scripts/balance-matrix';
import { DUAT_DB, duatPermanent } from '../duatFixture';
import { makeTestState, smallGreenDeck, TEST_DB } from '../helpers';

describe('GameTelemetry', () => {
  it('counts Rite sizes, successful Preserve events, and Nine Lives returns from synthetic events', () => {
    const telemetry = new GameTelemetry(DUAT_DB, ['Duat A', 'Duat B']);
    const state = makeTestState({});

    telemetry.onEvent({
      e: 'spellCast',
      sid: 1,
      cardId: 'du-rite-one',
      controller: 0,
      targets: [],
    }, state);
    telemetry.onEvent({
      e: 'spellCast',
      sid: 2,
      cardId: 'du-rite-two',
      controller: 1,
      targets: [],
    }, state);
    // This is also emitted by severGrave. It must not count as an activation.
    telemetry.onEvent({
      e: 'severed',
      player: 0,
      cardId: 'du-preserve-small',
      from: 'graveyard',
    }, state);
    telemetry.onEvent({
      e: 'preserved',
      player: 0,
      cardId: 'du-preserve-small',
    }, state);
    telemetry.onEvent({
      e: 'nineLivesReturned',
      player: 1,
      iid: 99,
      cardId: 'du-nine-lives',
    }, state);

    const record = telemetry.finish(state, 'draw');
    expect(record.players[0].riteCasts).toEqual({ '1': 1 });
    expect(record.players[1].riteCasts).toEqual({ '2': 1 });
    expect(record.players[0].preserveActivations).toBe(1);
    expect(record.players[1].preserveActivations).toBe(0);
    expect(record.players[0].nineLivesReturns).toBe(0);
    expect(record.players[1].nineLivesReturns).toBe(1);
  });

  it('counts all three mechanics through a scripted seeded Duat game', () => {
    const telemetry = new GameTelemetry(DUAT_DB, ['Scripted Duat', 'Opponent']);
    const state = makeTestState({
      hands: [['du-rite-one'], []],
      battlefield: [
        duatPermanent(1, 'forest'),
        duatPermanent(2, 'du-nine-lives'),
        duatPermanent(3, 'forest'),
      ],
    });
    state.players[0].graveyard = ['du-preserve-small'];
    const game = Game.restore(state, DUAT_DB);
    const observe = (player: 0 | 1, action: Action): void => {
      for (const event of game.submit(player, action)) {
        telemetry.onEvent(event, game.instanceState);
      }
    };

    const rite = game.legalActions(0).find(
      (action): action is Extract<Action, { type: 'castSpell' }> =>
        action.type === 'castSpell' && action.sacrifices !== undefined,
    );
    if (!rite) throw new Error('scripted Rite cast was not legal');
    observe(0, { ...rite, manaPlan: [1] });

    const preserve = game.legalActions(0).find(
      (action): action is Extract<Action, { type: 'preserveCard' }> =>
        action.type === 'preserveCard',
    );
    if (!preserve) throw new Error('scripted Preserve activation was not legal');
    observe(0, { ...preserve, manaPlan: [3] });

    const record = telemetry.finish(game.instanceState, 'draw');
    expect(record.players[0].riteCasts).toEqual({ '1': 1 });
    expect(record.players[0].preserveActivations).toBe(1);
    expect(record.players[0].nineLivesReturns).toBe(1);
  });

  it('records cleanup discards, driven turns, mulligans, and classic reserve state', () => {
    const telemetry = new GameTelemetry(TEST_DB, ['Green A', 'Green B']);
    const game = new Game({
      decks: [smallGreenDeck(), smallGreenDeck()],
      seed: 19,
      db: TEST_DB,
      eventObserver: telemetry.onEvent.bind(telemetry),
    });
    const mulliganPlayer = game.awaiting.kind === 'mulligan' ? game.awaiting.player : 0;
    game.submit(mulliganPlayer, { type: 'mulligan' });
    game.submit(mulliganPlayer, { type: 'keepHand' });
    const other = game.awaiting;
    if (other.kind !== 'mulligan') throw new Error('expected the second mulligan decision');
    game.submit(other.player, { type: 'keepHand' });

    const active = game.instanceState.activePlayer;
    game.state.players[active].hand.push('bear');
    game.submit(active, { type: 'passStep' });
    game.submit(active, { type: 'declareAttackers', attackers: [] });
    game.submit(active, { type: 'passStep' });
    expect(game.awaiting).toMatchObject({
      player: active,
      kind: 'discardToHandSize',
      count: 1,
    });
    game.submit(active, { type: 'discard', handIndices: [0] });

    const record = telemetry.finish(game.instanceState, 'draw');
    expect(record.turns).toBe(2);
    expect(record.players[active].cleanupDiscards).toBe(1);
    expect(record.players[active].cleanupDiscardsFirst6).toBe(1);
    expect(record.players[active].cleanupDiscardsByTurn).toEqual({ '1': 1 });
    expect(record.players[active].handCloggedTurns).toBe(1);
    expect(record.players[mulliganPlayer].mulligans).toBe(1);
    expect(record.players[0].reserveExhaustedTurn).toBeNull();
    expect(record.players[1].reserveExhaustedTurn).toBeNull();
  });

  it('does not change fixed-seed simulation outcomes when attached', () => {
    const decks: [string[], string[]] = [
      STARTER_DECKS[0].cards,
      STARTER_DECKS[1].cards,
    ];
    for (const seed of [101, 202, 303]) {
      const plain = playOut(
        seed,
        new MediumAI(CARD_DB),
        new MediumAI(CARD_DB),
        decks,
      );
      let observed = false;
      const instrumented = playOut(
        seed,
        new MediumAI(CARD_DB),
        new MediumAI(CARD_DB),
        decks,
        undefined,
        undefined,
        undefined,
        undefined,
        ['Crimson Muster', 'Wild Communion'],
        () => {
          observed = true;
        },
      );
      expect(instrumented).toBe(plain);
      expect(observed).toBe(true);
    }
  });
});
