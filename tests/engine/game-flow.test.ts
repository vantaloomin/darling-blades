import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/config/rules';
import { Game } from '../../src/engine/Game';
import { runBotGame, smallGreenDeck, TEST_DB } from '../helpers';

function newGame(seed = 7): Game {
  return new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed, db: TEST_DB });
}

/** Keep both hands, returning the game at turn 1 main 1. */
function keepBoth(g: Game): void {
  for (let i = 0; i < 2; i++) {
    const a = g.awaiting;
    if (a.kind !== 'mulligan') throw new Error('expected mulligan');
    g.submit(a.player, { type: 'keepHand' });
  }
}

describe('setup and mulligans', () => {
  it('deals 7-card opening hands and picks a starting player', () => {
    const g = newGame();
    expect(g.state.players[0].hand).toHaveLength(7);
    expect(g.state.players[1].hand).toHaveLength(7);
    expect(g.initialEvents[0]).toMatchObject({ e: 'firstPlayerChosen' });
    expect(g.awaiting).toMatchObject({ kind: 'mulligan', player: g.state.startingPlayer });
  });

  it('first mulligan is free (keep 7), second bottoms one', () => {
    const g = newGame();
    const p = g.state.startingPlayer;

    g.submit(p, { type: 'mulligan' });
    expect(g.state.players[p].hand).toHaveLength(7);
    g.submit(p, { type: 'mulligan' });
    expect(g.state.players[p].hand).toHaveLength(7);
    expect(g.state.players[p].mulligans).toBe(2);

    g.submit(p, { type: 'keepHand' });
    expect(g.awaiting).toMatchObject({ kind: 'bottomCards', count: 1 });
    g.submit(p, { type: 'bottomCards', handIndices: [0] });
    expect(g.state.players[p].hand).toHaveLength(6);
    // now the other player decides
    expect(g.awaiting).toMatchObject({ kind: 'mulligan', player: p === 0 ? 1 : 0 });
  });

  it('caps mulligans at RULES.maxMulligans — keep/concede only at the cap', () => {
    const g = newGame();
    const p = g.state.startingPlayer;
    for (let i = 0; i < RULES.maxMulligans; i++) g.submit(p, { type: 'mulligan' });
    expect(g.state.players[p].mulligans).toBe(RULES.maxMulligans);
    const kinds = g.legalActions(p).map((a) => a.type);
    expect(kinds).toContain('keepHand');
    expect(kinds).toContain('concede'); // the escape hatch surfaced in the UI
    expect(kinds).not.toContain('mulligan'); // no further mulligan at the cap
  });

  it('bottom-count after the max mulligans stays within the hand (no soft-lock)', () => {
    const g = newGame();
    const p = g.state.startingPlayer;
    for (let i = 0; i < RULES.maxMulligans; i++) g.submit(p, { type: 'mulligan' });
    g.submit(p, { type: 'keepHand' });
    const a = g.awaiting;
    if (a.kind !== 'bottomCards') throw new Error('expected bottomCards');
    expect(a.count).toBe(RULES.maxMulligans - 1);
    // the pick must be satisfiable — count never exceeds the cards on hand
    expect(a.count).toBeLessThanOrEqual(g.state.players[p].hand.length);
    g.submit(p, {
      type: 'bottomCards',
      handIndices: Array.from({ length: a.count }, (_, i) => i),
    });
    expect(g.state.players[p].hand).toHaveLength(RULES.startingHandSize - (RULES.maxMulligans - 1));
  });

  it('starting player skips the turn-1 draw', () => {
    const g = newGame();
    const p = g.state.startingPlayer;
    keepBoth(g);
    expect(g.state.turn).toBe(1);
    expect(g.state.step).toBe('main1');
    expect(g.state.activePlayer).toBe(p);
    expect(g.state.players[p].hand).toHaveLength(7); // no 8th card
  });
});

describe('turn flow', () => {
  it('one land per turn, and the drop is enforced', () => {
    const g = newGame();
    keepBoth(g);
    const p = g.state.activePlayer;

    const landIdx = g.state.players[p].hand.findIndex((c) => c === 'forest');
    expect(landIdx).toBeGreaterThanOrEqual(0);
    g.submit(p, { type: 'playLand', handIndex: landIdx });
    expect(g.state.battlefield).toHaveLength(1);

    const secondIdx = g.state.players[p].hand.findIndex((c) => c === 'forest');
    if (secondIdx >= 0) {
      expect(() => g.submit(p, { type: 'playLand', handIndex: secondIdx })).toThrow(
        /already played a land/,
      );
    }
    expect(g.legalActions(p).some((a) => a.type === 'playLand')).toBe(false);
  });

  it('casts a creature by auto-tapping, with summoning sickness marked', () => {
    const g = newGame();
    keepBoth(g);
    // Fast-forward: give the active player battlefield lands directly is not
    // possible through the public API, so walk two turns of land drops.
    const passTurn = (): void => {
      const p = g.state.activePlayer;
      const landIdx = g.state.players[p].hand.findIndex((c) => c === 'forest');
      if (landIdx >= 0 && !g.state.players[p].landPlayedThisTurn) {
        g.submit(p, { type: 'playLand', handIndex: landIdx });
      }
      g.submit(p, { type: 'passStep' });
      g.submit(p, { type: 'declareAttackers', attackers: [] });
      g.submit(p, { type: 'passStep' });
    };

    const first = g.state.activePlayer;
    passTurn(); // first player: land 1
    passTurn(); // second player: land 1
    // back to first player, second land
    expect(g.state.activePlayer).toBe(first);
    const p = first;
    const landIdx = g.state.players[p].hand.findIndex((c) => c === 'forest');
    g.submit(p, { type: 'playLand', handIndex: landIdx });

    const bearIdx = g.state.players[p].hand.findIndex((c) => c === 'bear');
    if (bearIdx < 0) return; // unlucky shuffle — other specs cover casting
    const events = g.submit(p, { type: 'castSpell', handIndex: bearIdx });

    expect(events.some((e) => e.e === 'manaTapped')).toBe(true);
    expect(events.some((e) => e.e === 'spellCast')).toBe(true);
    expect(events.some((e) => e.e === 'permanentEntered')).toBe(true);

    const bear = g.state.battlefield.find((b) => b.cardId === 'bear')!;
    expect(bear.enteredThisTurn).toBe(true);
    const lands = g.state.battlefield.filter((b) => b.cardId === 'forest' && b.controller === p);
    expect(lands.every((l) => l.tapped)).toBe(true);
  });

  it('rejects actions from the wrong player and illegal casts', () => {
    const g = newGame();
    keepBoth(g);
    const p = g.state.activePlayer;
    const other = p === 0 ? 1 : 0;
    expect(() => g.submit(other, { type: 'passStep' })).toThrow(/not your decision/);

    const bearIdx = g.state.players[p].hand.findIndex((c) => c === 'bear');
    if (bearIdx >= 0) {
      // No lands on turn 1 before a land drop → unpayable.
      expect(() => g.submit(p, { type: 'castSpell', handIndex: bearIdx })).toThrow(
        /cannot pay cost/,
      );
    }
  });

  it('concede ends the game immediately', () => {
    const g = newGame();
    const p = g.awaiting.kind === 'mulligan' ? g.awaiting.player : 0;
    const events = g.submit(p, { type: 'concede' });
    expect(events.at(-1)).toMatchObject({ e: 'gameEnded', reason: 'concede' });
    expect(g.state.winner).toBe(p === 0 ? 1 : 0);
    expect(g.legalActions(p)).toHaveLength(0);
  });
});

describe('full bot games', () => {
  it('two scripted bots play to decking within the turn limit', () => {
    const g = newGame(99);
    const events = runBotGame(g);
    const end = events.at(-1);
    expect(end).toMatchObject({ e: 'gameEnded', reason: 'deck' });
    expect(g.state.turn).toBeLessThan(100);
    // Both players should have developed a board along the way.
    expect(g.state.battlefield.length).toBeGreaterThan(4);
  });

  it('terminates across many seeds (mini-fuzz)', () => {
    for (let seed = 0; seed < 25; seed++) {
      const g = new Game({ decks: [smallGreenDeck(), smallGreenDeck()], seed, db: TEST_DB });
      const events = runBotGame(g);
      expect(events.at(-1)?.e).toBe('gameEnded');
    }
  });
});
