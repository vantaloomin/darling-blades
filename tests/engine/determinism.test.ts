import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import { botAction, deckOf, runBotGame, smallGreenDeck, TEST_DB } from '../helpers';

describe('determinism', () => {
  it('same decks + seed + actions → identical event streams and final state', () => {
    const mk = (): Game =>
      new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 424242, db: TEST_DB });
    const a = mk();
    const b = mk();
    const eventsA = runBotGame(a);
    const eventsB = runBotGame(b);
    expect(JSON.stringify(eventsA)).toBe(JSON.stringify(eventsB));
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it('clone() diverges from the original without affecting it', () => {
    const g = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 5, db: TEST_DB });
    // advance a bit
    for (let i = 0; i < 6; i++) {
      const a = g.awaiting;
      if (a.kind === 'gameOver') break;
      g.submit(a.player, botAction(g.legalActions(a.player)));
    }
    const snapshot = JSON.stringify(g.state);
    const c = g.clone();
    runBotGame(c); // play the clone to completion
    expect(JSON.stringify(g.state)).toBe(snapshot); // original untouched
    expect(c.state.winner).not.toBeNull();
  });

  it('different seeds produce different games', () => {
    const a = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 1, db: TEST_DB });
    const b = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 2, db: TEST_DB });
    expect(JSON.stringify(a.state.players[0].hand)).not.toBe(
      JSON.stringify(b.state.players[0].hand),
    );
  });

  it('keeps Charm-dense revision-2 games stream- and state-identical', () => {
    const deck = deckOf([
      ['mountain', 20],
      ['shock', 20],
      ['bear', 20],
    ]);
    const make = (): Game => new Game({ decks: [deck, deck], seed: 771922, db: TEST_DB });
    const run = (game: Game) => {
      const events = [...game.initialEvents];
      for (let guard = 0; guard < 20000; guard++) {
        const awaiting = game.awaiting;
        if (awaiting.kind === 'gameOver') return events;
        const legal = game.legalActions(awaiting.player);
        const action = awaiting.kind === 'endStepWindow' ||
          (awaiting.kind === 'respond' && game.state.step === 'combat')
          ? awaiting.player !== game.state.activePlayer
            ? legal.find((candidate) => candidate.type === 'castSpell') ?? { type: 'passResponse' as const }
            : { type: 'passResponse' as const }
          : awaiting.kind === 'respond'
            ? { type: 'passResponse' as const }
            : awaiting.kind === 'main'
              ? legal.find((candidate) => candidate.type === 'playLand') ??
                legal.find(
                  (candidate) =>
                    candidate.type === 'castSpell' &&
                    game.state.players[awaiting.player].hand[candidate.handIndex] === 'bear',
                ) ??
                { type: 'passStep' as const }
              : botAction(legal);
        events.push(...game.submit(awaiting.player, action));
      }
      throw new Error('Charm-dense determinism game did not terminate');
    };
    const a = make();
    const b = make();
    const eventsA = run(a);
    const eventsB = run(b);

    expect(JSON.stringify(eventsA)).toBe(JSON.stringify(eventsB));
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });
});
