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

/** Story endless claimants (plan-story-mode E2): per-seat extra life and a starting Mandate holder. */
describe('per-seat life bonus and a starting Mandate holder', () => {
  const decks = (): [string[], string[]] => [Array(40).fill('forest'), Array(40).fill('forest')];

  it('adds each seat its own bonus on top of the starting total', () => {
    const game = new Game({ decks: decks(), seed: 3, db: TEST_DB, startingLife: 25, lifeBonus: [0, 6] });
    expect(game.instanceState.players.map((p) => p.life)).toEqual([25, 31]);
    expect(game.startingLife).toBe(25);
  });

  it('refuses a bonus that is not two whole numbers of 0 or more', () => {
    for (const lifeBonus of [[0, -1], [1.5, 0], [0]] as unknown as [number, number][]) {
      expect(() => new Game({ decks: decks(), seed: 3, db: TEST_DB, lifeBonus })).toThrow(/lifeBonus/);
    }
  });

  it('starts the named seat holding the Mandate, visible to both, with no claim event', () => {
    const game = new Game({ decks: decks(), seed: 3, db: TEST_DB, startingMandateHolder: 1 });
    expect(game.instanceState.mandateHolder).toBe(1);
    expect(game.viewFor(0).mandateHolder).toBe(1);
    expect(game.initialEvents.some((e) => e.e === 'mandateChanged')).toBe(false);
    expect(new Game({ decks: decks(), seed: 3, db: TEST_DB }).instanceState.mandateHolder).toBeUndefined();
    expect(() => new Game({ decks: decks(), seed: 3, db: TEST_DB, startingMandateHolder: 2 as 0 })).toThrow(/startingMandateHolder/);
  });

  it('leaves the rest of the deal unchanged: same seed, same hands and first player', () => {
    const plain = new Game({ decks: decks(), seed: 7, db: TEST_DB });
    const setup = new Game({ decks: decks(), seed: 7, db: TEST_DB, lifeBonus: [0, 3], startingMandateHolder: 1 });
    expect(setup.instanceState.startingPlayer).toBe(plain.instanceState.startingPlayer);
    expect(setup.instanceState.players[0].hand).toEqual(plain.instanceState.players[0].hand);
  });
});
