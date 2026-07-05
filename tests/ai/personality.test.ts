import { describe, expect, it } from 'vitest';
import type { AIPlayer } from '../../src/ai/AIPlayer';
import { EasyAI } from '../../src/ai/EasyAI';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { buildAI, DEFAULT_PERSONALITY, type Personality } from '../../src/ai/personality';
import { Game } from '../../src/engine/Game';
import { deckOf, TEST_DB } from '../helpers';

/** Coherent two-color 40-card decks (mirrors the win-rate suite). */
function deckGR(): string[] {
  return deckOf([
    ['forest', 10], ['mountain', 6], ['bear', 4], ['elf', 3], ['giant', 4],
    ['rhino', 3], ['lord', 2], ['fox_mother', 2], ['hasty', 2], ['shock', 2], ['growth', 2],
  ]);
}
function deckWB(): string[] {
  return deckOf([
    ['plains', 10], ['swamp', 6], ['knight', 4], ['sentinel', 3], ['cleric', 4],
    ['wall', 2], ['assassin', 4], ['drainer', 4], ['murder', 3],
  ]);
}

/**
 * SUITE A — Default-equivalence tripwire + lockstep.
 *
 * The personality layer must be a ZERO-behavior-change refactor at DEFAULT
 * values. These tests are the no-regression proof; if any hook drifts they
 * fail. Fix the hook, never the test.
 */

describe('DEFAULT_PERSONALITY tripwire', () => {
  it('matches the documented neutral constants exactly', () => {
    // Frozen so no avatar can mutate the shared default by reference.
    expect(Object.isFrozen(DEFAULT_PERSONALITY)).toBe(true);
    expect({ ...DEFAULT_PERSONALITY, preferredSubtypes: [...DEFAULT_PERSONALITY.preferredSubtypes] }).toEqual({
      aggression: 1,
      holdback: 1,
      attackThreshold: 0,
      blockLifePressure: 1,
      blockThreshold: 0,
      trickRespect: 1,
      mulliganShift: 0,
      removalBias: 0,
      burnFaceLife: 8,
      counterFloor: 4,
      subtypeBias: 0,
      preferredSubtypes: [],
      lifegainBias: 0,
      easyNoise: 0.2,
      easyPassRate: 0.85,
      easyAllIn: 0,
    } satisfies Personality);
  });

  it('buildAI returns the same brains a hand-rolled ternary would', () => {
    expect(buildAI('easy', TEST_DB, 1)).toBeInstanceOf(EasyAI);
    expect(buildAI('medium', TEST_DB, 1)).toBeInstanceOf(MediumAI);
    expect(buildAI('hard', TEST_DB, 1)).toBeInstanceOf(HardAI);
  });
});

/**
 * Lockstep: two brains — one constructed with no personality, one with an
 * explicit DEFAULT — are consulted at EVERY decision. Their chosen actions
 * must be byte-identical (JSON) for the whole game. We drive the game with
 * the "plain" brain's action, so both see the same states throughout.
 */
function lockstep(
  seed: number,
  makePlain: () => AIPlayer,
  makeDefault: () => AIPlayer,
): void {
  const decks: [string[], string[]] =
    seed % 4 < 2 ? [deckGR(), deckWB()] : [deckWB(), deckGR()];
  const game = new Game({ decks, seed, db: TEST_DB });
  const plain = [makePlain(), makePlain()];
  const withDefault = [makeDefault(), makeDefault()];
  for (let i = 0; i < 30000; i++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') return;
    const p = awaiting.player;
    const view = game.viewFor(p);
    const legal = game.legalActions(p);
    const a = plain[p].chooseAction(view, legal);
    const b = withDefault[p].chooseAction(view, legal);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    game.submit(p, a);
  }
  throw new Error(`lockstep game ${seed} did not terminate`);
}

describe('lockstep default-equivalence', () => {
  it('Medium(db) === Medium(db, DEFAULT) at every decision over 15 seeds', () => {
    for (let seed = 0; seed < 15; seed++) {
      lockstep(
        seed,
        () => new MediumAI(TEST_DB),
        () => new MediumAI(TEST_DB, DEFAULT_PERSONALITY),
      );
    }
  }, 60_000);

  it('Easy(db, seed) === Easy(db, seed, DEFAULT) at every decision over 15 seeds', () => {
    // Easy is stochastic; both instances must consume rng in lockstep, so we
    // seed them identically and (critically) each brain must make the SAME
    // number of rng calls at DEFAULT as it always did.
    for (let seed = 0; seed < 15; seed++) {
      const rngSeed = seed * 13 + 5;
      lockstep(
        seed,
        () => new EasyAI(TEST_DB, rngSeed),
        () => new EasyAI(TEST_DB, rngSeed, DEFAULT_PERSONALITY),
      );
    }
  }, 60_000);

  it('Hard(db) === Hard(db, DEFAULT) at every decision over 5 seeds', () => {
    for (let seed = 0; seed < 5; seed++) {
      lockstep(
        seed + 100,
        () => new HardAI(TEST_DB),
        () => new HardAI(TEST_DB, DEFAULT_PERSONALITY),
      );
    }
  }, 120_000);
});
