import { describe, expect, it } from 'vitest';
import { forcedAction } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import { botAction, combatSetup, makeTestState, smallGreenDeck, TEST_DB } from '../helpers';

describe('forcedAction: main phase', () => {
  it('castable spell in hand → null (real choice)', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'forest', controller: 0 },
        { iid: 2, cardId: 'forest', controller: 0 },
      ],
      hands: [['bear'], []],
      active: 0,
    });
    expect(forcedAction(state, TEST_DB, 0)).toBeNull();
  });

  it('playable land in hand → null (real choice)', () => {
    const state = makeTestState({ hands: [['forest'], []], active: 0 });
    expect(forcedAction(state, TEST_DB, 0)).toBeNull();
  });

  it('empty hand → forced passStep, and concede never counts as a choice', () => {
    const state = makeTestState({ hands: [[], []], active: 0 });
    const game = Game.restore(state, TEST_DB);
    // concede is still legal — but it must not block the skip nor be forced
    expect(game.legalActions(0).some((a) => a.type === 'concede')).toBe(true);
    expect(forcedAction(state, TEST_DB, 0)).toEqual({ type: 'passStep' });
  });

  it('unpayable spell only → forced passStep', () => {
    // bear costs 1G; no lands on the battlefield
    const state = makeTestState({ hands: [['bear'], []], active: 0 });
    expect(forcedAction(state, TEST_DB, 0)).toEqual({ type: 'passStep' });
  });

  it('land in hand but the drop is used → forced passStep', () => {
    const state = makeTestState({ hands: [['forest'], []], active: 0 });
    state.players[0].landPlayedThisTurn = true;
    expect(forcedAction(state, TEST_DB, 0)).toEqual({ type: 'passStep' });
  });

  it("someone else's decision → null", () => {
    const state = makeTestState({ hands: [[], []], active: 0 });
    expect(forcedAction(state, TEST_DB, 1)).toBeNull();
  });
});

describe('forcedAction: declareAttackers', () => {
  it('no creatures at all → forced empty attack', () => {
    const { game } = combatSetup([], []);
    expect(game.awaiting).toMatchObject({ kind: 'declareAttackers', player: 0 });
    expect(forcedAction(game.state, TEST_DB, 0)).toEqual({
      type: 'declareAttackers',
      attackers: [],
    });
  });

  it('only tapped / summoning-sick / defender creatures → forced empty attack', () => {
    const { game } = combatSetup(
      [
        { key: 'tapped', cardId: 'giant', tapped: true },
        { key: 'sick', cardId: 'bear', enteredThisTurn: true },
        { key: 'wall', cardId: 'wall' },
      ],
      [],
    );
    expect(forcedAction(game.state, TEST_DB, 0)).toEqual({
      type: 'declareAttackers',
      attackers: [],
    });
  });

  it('an eligible attacker → null', () => {
    const { game } = combatSetup([{ key: 'ready', cardId: 'bear' }], []);
    expect(forcedAction(game.state, TEST_DB, 0)).toBeNull();
  });

  it('haste makes a fresh creature eligible → null', () => {
    const { game } = combatSetup(
      [{ key: 'hasty', cardId: 'hasty', enteredThisTurn: true }],
      [],
    );
    expect(forcedAction(game.state, TEST_DB, 0)).toBeNull();
  });
});

describe('forcedAction: declareBlockers', () => {
  it('defender has no creatures → forced empty block', () => {
    const { game, iid } = combatSetup([{ key: 'bear', cardId: 'bear' }], []);
    game.submit(0, { type: 'declareAttackers', attackers: [iid.bear] });
    expect(game.awaiting).toMatchObject({ kind: 'declareBlockers', player: 1 });
    expect(forcedAction(game.state, TEST_DB, 1)).toEqual({
      type: 'declareBlockers',
      blocks: [],
    });
  });

  it('only tapped would-be blockers → forced empty block', () => {
    const { game, iid } = combatSetup(
      [{ key: 'atk', cardId: 'bear' }],
      [{ key: 'blk', cardId: 'bear', tapped: true }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.atk] });
    expect(forcedAction(game.state, TEST_DB, 1)).toEqual({
      type: 'declareBlockers',
      blocks: [],
    });
  });

  it('flyer attacking with only ground defenders → forced empty block', () => {
    const { game, iid } = combatSetup(
      [{ key: 'flyer', cardId: 'flyer' }],
      [{ key: 'bear', cardId: 'bear' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.flyer] });
    expect(forcedAction(game.state, TEST_DB, 1)).toEqual({
      type: 'declareBlockers',
      blocks: [],
    });
  });

  it('a legal blocker exists → null', () => {
    const { game, iid } = combatSetup(
      [{ key: 'atk', cardId: 'bear' }],
      [{ key: 'blk', cardId: 'bear' }],
    );
    game.submit(0, { type: 'declareAttackers', attackers: [iid.atk] });
    expect(forcedAction(game.state, TEST_DB, 1)).toBeNull();
  });

  it('summoning-sick creatures CAN block → null', () => {
    const state = makeTestState({
      battlefield: [
        { iid: 1, cardId: 'bear', controller: 0 },
        { iid: 2, cardId: 'bear', controller: 1, enteredThisTurn: true },
      ],
      active: 0,
    });
    const game = Game.restore(state, TEST_DB);
    game.submit(0, { type: 'passStep' });
    game.submit(0, { type: 'declareAttackers', attackers: [1] });
    expect(game.awaiting).toMatchObject({ kind: 'declareBlockers', player: 1 });
    expect(forcedAction(game.state, TEST_DB, 1)).toBeNull();
  });
});

describe('forcedAction: decisions that are never forced', () => {
  it('mulligan → null', () => {
    const g = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 5, db: TEST_DB });
    const p = g.state.startingPlayer;
    expect(g.awaiting).toMatchObject({ kind: 'mulligan', player: p });
    expect(forcedAction(g.state, TEST_DB, p)).toBeNull();
  });

  it('bottomCards → null', () => {
    const g = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 5, db: TEST_DB });
    const p = g.state.startingPlayer;
    g.submit(p, { type: 'mulligan' });
    g.submit(p, { type: 'mulligan' });
    g.submit(p, { type: 'keepHand' });
    expect(g.awaiting).toMatchObject({ kind: 'bottomCards', count: 1 });
    expect(forcedAction(g.state, TEST_DB, p)).toBeNull();
  });

  it('discardToHandSize → null', () => {
    const state = makeTestState({ hands: [['bear'], []], active: 0 });
    state.awaiting = { player: 0, kind: 'discardToHandSize', count: 1 };
    expect(forcedAction(state, TEST_DB, 0)).toBeNull();
  });

  it('respond window → null', () => {
    const state = makeTestState({ hands: [[], []], active: 0 });
    state.awaiting = { player: 1, kind: 'respond', over: { type: 'attackers' } };
    expect(forcedAction(state, TEST_DB, 1)).toBeNull();
  });

  it('end-step window → null', () => {
    const state = makeTestState({ hands: [[], []], active: 0 });
    state.step = 'end';
    state.awaiting = { player: 1, kind: 'endStepWindow' };
    expect(forcedAction(state, TEST_DB, 1)).toBeNull();
  });

  it('gameOver → null for both players', () => {
    const state = makeTestState({ hands: [[], []], active: 0 });
    state.awaiting = { kind: 'gameOver' };
    expect(forcedAction(state, TEST_DB, 0)).toBeNull();
    expect(forcedAction(state, TEST_DB, 1)).toBeNull();
  });
});

describe('integration: driving seeded games through forcedAction', () => {
  it('forced submissions are always legal and the game terminates at real decisions or game end', () => {
    let totalForced = 0;
    for (let seed = 0; seed < 10; seed++) {
      const g = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed, db: TEST_DB });
      let guard = 0;
      while (g.awaiting.kind !== 'gameOver' && guard < 20000) {
        guard++;
        const a = g.awaiting;
        const p = a.player;
        const forced = forcedAction(g.state, TEST_DB, p);
        if (forced) {
          totalForced++;
          // only these three decisions can ever be forced — never concede
          expect(['passStep', 'declareAttackers', 'declareBlockers']).toContain(forced.type);
          if (forced.type === 'passStep') {
            // forced main ⇔ legalActions held nothing but passStep + concede
            expect(
              g.legalActions(p).every((x) => x.type === 'passStep' || x.type === 'concede'),
            ).toBe(true);
          }
          // a forced action must always validate — submit() throws otherwise
          expect(() => g.submit(p, forced)).not.toThrow();
          continue;
        }
        // Not forced → the scripted bot must find a real (non-concede) move,
        // i.e. the chain terminated at a genuine decision.
        const chosen = botAction(g.legalActions(p));
        expect(chosen.type).not.toBe('concede');
        g.submit(p, chosen);
      }
      expect(g.awaiting.kind).toBe('gameOver');
    }
    // the loop must have actually exercised auto-skips (empty-hand mains, etc.)
    expect(totalForced).toBeGreaterThan(0);
  });
});
