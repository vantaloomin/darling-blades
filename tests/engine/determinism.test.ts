import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/config/rules';
import type { Action } from '../../src/engine/actions';
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

  it('plays the same game whether or not anyone reads the legacy public state', () => {
    // Simulated worlds never read game.state, so its facade is built only on a
    // read; building one and syncing it back must leave the game unchanged.
    const mk = (): Game =>
      new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 515151, db: TEST_DB });
    const read = mk();
    const unread = mk();
    const events: [unknown[], unknown[]] = [[], []];
    for (let step = 0; step < 20_000; step++) {
      void read.state;
      const awaiting = unread.instanceState.awaiting;
      if (awaiting.kind === 'gameOver') break;
      const action = botAction(unread.legalActions(awaiting.player));
      events[0].push(...read.submit(awaiting.player, action));
      events[1].push(...unread.submit(awaiting.player, action));
    }
    expect(unread.instanceState.winner).not.toBeNull();
    expect(JSON.stringify(events[1])).toBe(JSON.stringify(events[0]));
    expect(JSON.stringify(unread.instanceState)).toBe(JSON.stringify(read.instanceState));
  });

  it('two Game instances built from the same decks and seed share no state', () => {
    const mk = (): Game =>
      new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 313131, db: TEST_DB });
    const a = mk();
    const b = mk();
    for (let step = 0; step < 12; step++) {
      const awaiting = a.awaiting;
      if (awaiting.kind === 'gameOver') break;
      const action = botAction(a.legalActions(awaiting.player));
      a.submit(awaiting.player, action);
      b.submit(awaiting.player, action);
    }
    const aState = a.instanceState;
    const bState = b.instanceState;
    expect(aState).not.toBe(bState);
    expect(JSON.stringify(aState)).toBe(JSON.stringify(bState));

    // The two games must not alias: a write to one is invisible to the other.
    const snapshot = JSON.stringify(bState);
    aState.players[0].life -= 7;
    aState.players[0].hand.push({ cardId: 'forest', instanceId: 9999, variantKey: null });
    expect(JSON.stringify(aState)).not.toBe(snapshot);
    expect(JSON.stringify(bState)).toBe(snapshot);
  });

  it('a public state or view handed out earlier is a snapshot that later play never writes through', () => {
    // game.state and viewFor are projections of the live state, which the
    // engine mutates in place. Any object a projection shared with the live
    // state would change under a caller still holding the earlier projection.
    const g = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed: 777, db: TEST_DB });
    const held: { projections: unknown[]; json: string }[] = [];
    let mulliganed = false;
    for (let step = 0; step < 20_000; step++) {
      const awaiting = g.awaiting;
      if (awaiting.kind === 'gameOver') break;
      const projections = [g.state, g.viewFor(0), g.viewFor(1)];
      held.push({ projections, json: JSON.stringify(projections) });
      const legal = g.legalActions(awaiting.player);
      // One mulligan reshuffles through the rng in place, so the earlier
      // projections' copy of the rng is checked too, not only the zones.
      const mulligan: Action | undefined = mulliganed ? undefined : legal.find((action) => action.type === 'mulligan');
      mulliganed ||= mulligan !== undefined;
      g.submit(awaiting.player, mulligan ?? botAction(legal));
    }
    expect(mulliganed).toBe(true);
    expect(g.state.winner).not.toBeNull();
    expect(held.length).toBeGreaterThan(100);
    expect(held.findIndex((h) => JSON.stringify(h.projections) !== h.json)).toBe(-1);
  });

  it('keeps an absent hand-size override byte-identical to the shipped default', () => {
    const baseline = new Game({
      decks: [smallGreenDeck(), smallGreenDeck()],
      seed: 9317,
      db: TEST_DB,
    });
    const explicitDefault = new Game({
      decks: [smallGreenDeck(), smallGreenDeck()],
      seed: 9317,
      db: TEST_DB,
      startingHandSize: RULES.startingHandSize,
    });
    const baselineEvents = runBotGame(baseline);
    const explicitEvents = runBotGame(explicitDefault);

    expect(JSON.stringify(baselineEvents)).toBe(JSON.stringify(explicitEvents));
    expect(JSON.stringify(baseline.state)).toBe(JSON.stringify(explicitDefault.state));
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
