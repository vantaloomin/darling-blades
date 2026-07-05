import type { CardDb } from '../engine/types';
import type { AIPlayer } from './AIPlayer';
import type { Difficulty } from '../meta/Economy';
import { EasyAI } from './EasyAI';
import { MediumAI } from './MediumAI';
import { HardAI } from './HardAI';

/**
 * Tunable knobs that shape how a brain plays without changing which brain it
 * is. Every knob's DEFAULT value reproduces the pre-personality behavior
 * bit-for-bit — the hook points are written so that at DEFAULT they are
 * algebraically identical to the original code (see the lockstep test in
 * tests/ai/personality.test.ts, which fails if any hook drifts).
 *
 * Personality lives ONLY inside AI objects. It is never serialized and never
 * touches GameState.
 */
export interface Personality {
  // --- combatPlans.ts (Medium + Hard combat) ---
  /** Multiplies the damage weight when scoring attacks. >1 = more eager to swing. */
  aggression: number;
  /** Multiplies the defensive holdback penalty. >1 = more reluctant to over-extend. */
  holdback: number;
  /** Replaces the `best > 0` gate in chooseAttackers. Lower = attacks on thinner margins. */
  attackThreshold: number;
  /** Multiplies the block life-pressure term. >1 = blocks more defensively. */
  blockLifePressure: number;
  /** Replaces the `pair.score > 0` gate in chooseBlocks. Lower = blocks more aggressively. */
  blockThreshold: number;

  // --- MediumAI.ts ---
  /** Multiplies the trick-buff Medium applies to defenders (respect for open mana). */
  trickRespect: number;
  /** Shifts the mulligan keep-band lower bounds (−1|0|+1). Lower = keeps looser. */
  mulliganShift: -1 | 0 | 1;
  /** Added to the 2.5/3.5 removal-value floors (main/respond/endStep). Lower = removes cheaper things. */
  removalBias: number;
  /** Life at/below which Medium sends burn upstairs (replaces the `opp.life <= 8` gate). */
  burnFaceLife: number;
  /** Mana-value at/above which Medium counters a spell (replaces the mv≥4 rule). */
  counterFloor: number;
  /** Value bonus added when a develop-cast creature has a preferred subtype. */
  subtypeBias: number;
  /** Subtypes rewarded by subtypeBias. */
  preferredSubtypes: string[];
  /** Value bonus added to develop-casts that gain life (lifelink / gainLife). */
  lifegainBias: number;

  // --- EasyAI.ts (threshold-only, never changes the count of rng calls) ---
  /** Random-action rate in main phases (was 0.2). */
  easyNoise: number;
  /** Response-window pass rate (was 0.85). */
  easyPassRate: number;
  /** Slack in the all-in attack check: attack when myCreatures + easyAllIn >= oppUntapped. */
  easyAllIn: number;
}

/**
 * The neutral personality: every knob set so the brains behave exactly as they
 * did before the personality layer existed. Frozen so no avatar can mutate the
 * shared default by reference.
 */
export const DEFAULT_PERSONALITY: Readonly<Personality> = Object.freeze({
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
  preferredSubtypes: Object.freeze([]) as unknown as string[],
  lifegainBias: 0,
  easyNoise: 0.2,
  easyPassRate: 0.85,
  easyAllIn: 0,
});

/** Merge partial personality overrides over the neutral default. */
export function makePersonality(overrides: Partial<Personality> = {}): Personality {
  return { ...DEFAULT_PERSONALITY, ...overrides };
}

/**
 * The single AI factory. Replaces DuelScene's hand-rolled ternary. A missing
 * personality means "play like today" (DEFAULT), so practice mode and the
 * win-rate gates are untouched.
 */
export function buildAI(
  difficulty: Difficulty,
  db: CardDb,
  seed: number,
  personality: Personality = DEFAULT_PERSONALITY,
): AIPlayer {
  switch (difficulty) {
    case 'hard':
      return new HardAI(db, personality);
    case 'medium':
      return new MediumAI(db, personality);
    case 'easy':
    default:
      return new EasyAI(db, seed, personality);
  }
}
