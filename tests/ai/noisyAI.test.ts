import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { NoisyAI } from '../../src/ai/NoisyAI';
import { Game } from '../../src/engine/Game';
import type { Action } from '../../src/engine/actions';
import type { PlayerView } from '../../src/engine/view';
import { deckOf, TEST_DB } from '../helpers';

const UNUSED_VIEW = {} as PlayerView;

class FixedAI implements AIPlayer {
  calls = 0;

  constructor(private readonly choice: Action) {}

  chooseAction(): Action {
    this.calls++;
    return this.choice;
  }
}

function testDeck(): string[] {
  return deckOf([
    ['forest', 7],
    ['plains', 3],
    ['bear', 6],
    ['elf', 3],
    ['giant', 3],
    ['rhino', 2],
    ['sentinel', 2],
    ['knight', 2],
    ['flyer', 2],
  ]);
}

describe('NoisyAI', () => {
  it('is deterministic for a fixed seed', () => {
    const legal: Action[] = [
      { type: 'passStep' },
      { type: 'keepHand' },
      { type: 'mulligan' },
      { type: 'choosePlayDraw', play: true },
      { type: 'concede' },
    ];
    const a = new NoisyAI(new FixedAI(legal[0]), 48271, 0.65);
    const b = new NoisyAI(new FixedAI(legal[0]), 48271, 0.65);

    const choicesA = Array.from({ length: 100 }, () => a.chooseAction(UNUSED_VIEW, legal));
    const choicesB = Array.from({ length: 100 }, () => b.chooseAction(UNUSED_VIEW, legal));
    expect(choicesA).toEqual(choicesB);
  });

  it('matches a bare stochastic brain byte-for-byte when noise is zero', () => {
    const game = new Game({ decks: [testDeck(), testDeck()], seed: 719, db: TEST_DB });
    const bare = [new EasyAI(TEST_DB, 11), new EasyAI(TEST_DB, 12)];
    const wrapped = [
      new NoisyAI(new EasyAI(TEST_DB, 11), 101, 0),
      new NoisyAI(new EasyAI(TEST_DB, 12), 102, 0),
    ];
    let decisions = 0;

    for (let guard = 0; guard < 20000; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') break;
      const player = awaiting.player;
      const view = game.viewFor(player);
      const legal = game.legalActions(player);
      const bareChoice = bare[player].chooseAction(view, legal);
      const wrappedChoice = wrapped[player].chooseAction(view, legal);
      expect(JSON.stringify(wrappedChoice)).toBe(JSON.stringify(bareChoice));
      game.submit(player, bareChoice);
      decisions++;
    }

    expect(game.awaiting.kind).toBe('gameOver');
    expect(decisions).toBeGreaterThan(20);
  });

  it('never chooses concede as a noise replacement', () => {
    const inner = new FixedAI({ type: 'concede' });
    const ai = new NoisyAI(inner, 90210, 1);
    const legal: Action[] = [
      { type: 'concede' },
      { type: 'passStep' },
      { type: 'keepHand' },
      { type: 'mulligan' },
    ];

    for (let i = 0; i < 200; i++) {
      expect(ai.chooseAction(UNUSED_VIEW, legal).type).not.toBe('concede');
    }
    expect(inner.calls).toBe(200);
  });

  it('keeps the inner choice when concede is the only legal action', () => {
    const inner = new FixedAI({ type: 'concede' });
    const ai = new NoisyAI(inner, 7, 1);
    expect(ai.chooseAction(UNUSED_VIEW, [{ type: 'concede' }])).toEqual({ type: 'concede' });
    expect(inner.calls).toBe(1);
  });
});
