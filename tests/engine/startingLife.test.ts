import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/config/rules';
import { Game } from '../../src/engine/Game';
import { TEST_DB } from '../helpers';

/** 2.0 raises starting life (plan-2.0 D3); a game's total is set per game, not read globally. */
describe('starting life', () => {
  const decks = (): [string[], string[]] => [Array(40).fill('forest'), Array(40).fill('forest')];

  it('defaults to the rules total', () => {
    const game = new Game({ decks: decks(), seed: 3, db: TEST_DB });
    expect(game.startingLife).toBe(RULES.startingLife);
    expect(game.instanceState.players.map((p) => p.life)).toEqual([RULES.startingLife, RULES.startingLife]);
  });

  it('both players begin at the configured total', () => {
    const game = new Game({ decks: decks(), seed: 3, db: TEST_DB, startingLife: 25 });
    expect(game.instanceState.players.map((p) => p.life)).toEqual([25, 25]);
    expect(game.viewFor(1).opp.life).toBe(25);
  });

  it('refuses a total that is not a positive whole number', () => {
    for (const startingLife of [0, -1, 20.5, Number.NaN]) {
      expect(() => new Game({ decks: decks(), seed: 3, db: TEST_DB, startingLife })).toThrow(/startingLife/);
    }
  });
});
