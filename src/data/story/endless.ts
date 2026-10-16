import { AVATARS, type Avatar } from '../opponents';

type Difficulty = Avatar['difficulty'];
import { ACT1 } from './act1';
import type { StoryAct, StoryMapTemplate } from './types';

/**
 * Story Mode's endless run (owner rulings E1 to E7, 2026-10-16; the plan is
 * docs/plan-story-mode.md, "Endless"). After Act 1, or from the menu once any
 * Act 1 is cleared, the run goes on through short generated loops, each
 * ending at a claimant who holds the Mandate, until a loss. Pure data.
 *
 * E1: a loop is 6 floors with about 4 duels. It has no event floors: the nine
 * Act 1 events are scenes on the road to Sima Yi's crater, which is behind
 * the player by then, and E7 adds no new writing in 2.0.
 *
 * E2: the opponents climb the Tower roster a few rungs a loop, on Medium
 * brains at most until ENDLESS_HARD_FROM_LOOP and on their own Tower brains
 * from then on (so Hard arrives with the higher rungs), the claimant starts
 * holding the Mandate from loop 7, and from loop 8 she also starts with
 * `ENDLESS_LIFE_PER_LOOP` more life per loop, a step that never runs out.
 *
 * Numbers are first guesses for the headless matrix to tune.
 */

/** E1: the loop's floor table. Floor 6 is the claimant. */
export const ENDLESS_MAP_TEMPLATE: StoryMapTemplate = {
  id: 'endless-map',
  floors: [
    { floor: 1, kinds: ['fight'] },
    { floor: 2, kinds: ['fight', 'rest'] },
    { floor: 3, kinds: ['shop', 'fight'] },
    { floor: 4, kinds: ['elite', 'fight'] },
    { floor: 5, kinds: ['rest', 'shop'] },
    { floor: 6, kinds: ['boss'] },
  ],
  minWidth: 2,
  maxWidth: 3,
};

/**
 * Tower avatars endless may field, weakest first. Sima Yi is Act 1's boss, so
 * she never returns as a claimant. Avatars held for Acts 2 and 3 (Jia Nanfeng,
 * Sima Yan) are not Tower avatars today; if they join the roster, add them here.
 */
export const ENDLESS_EXCLUDED_AVATAR_IDS: readonly string[] = ['simayi'];

export const ENDLESS_ROSTER: readonly string[] = [...AVATARS]
  .sort((a, b) => a.tier - b.tier)
  .map((avatar) => avatar.id)
  .filter((id) => !ENDLESS_EXCLUDED_AVATAR_IDS.includes(id));

/** How many roster places each band (fights, elites, claimants) spans. */
export const ENDLESS_BAND_WIDTH = 3;
/** Roster places the bands climb per loop. */
export const ENDLESS_RUNGS_PER_LOOP = 2;
/** Where loop 1's fight band starts in ENDLESS_ROSTER (0 is the weakest). */
export const ENDLESS_FIRST_FIGHT_PLACE = 0;

/** E2: before this loop no endless opponent plays above a Medium brain. */
export const ENDLESS_HARD_FROM_LOOP = 2;

/** E2: the loop from which the claimant starts each duel holding the Mandate. */
export const ENDLESS_MANDATE_FROM_LOOP = 7;
/** E2: the loop from which the claimant starts with extra life. */
export const ENDLESS_LIFE_FROM_LOOP = 8;
/** E2: extra claimant life per loop from ENDLESS_LIFE_FROM_LOOP on (3 at loop 8, 6 at loop 9, ...). */
export const ENDLESS_LIFE_PER_LOOP = 3;

/** E3: a run started from the menu takes this many card picks before loop 1. */
export const ENDLESS_HEAD_START_PICKS = 3;
/** E3: and starts with this much run gold (about what an Act 1 clear ends with). */
export const ENDLESS_HEAD_START_GOLD = 150;

/**
 * Endless loops reuse the act shape so maps, duels, shops and rests run
 * unchanged. Loop N is numbered `ENDLESS_ACT_BASE + N` for its map seed and
 * node ids (`a101-f1-n0`), which keeps every loop's map apart from Act 1's
 * and from each other. The run's own `act` field stays the last act played.
 */
export const ENDLESS_ACT_BASE = 100;

export interface EndlessBands {
  fights: string[];
  elites: string[];
  claimants: string[];
}

/** The three bands of roster avatars loop `loop` (1-based) draws from. */
export function endlessBands(loop: number): EndlessBands {
  if (!Number.isSafeInteger(loop) || loop < 1) throw new Error(`No endless loop ${loop}`);
  const last = ENDLESS_ROSTER.length - 3 * ENDLESS_BAND_WIDTH;
  const start = Math.min(ENDLESS_FIRST_FIGHT_PLACE + ENDLESS_RUNGS_PER_LOOP * (loop - 1), last);
  const band = (offset: number): string[] =>
    ENDLESS_ROSTER.slice(start + offset * ENDLESS_BAND_WIDTH, start + (offset + 1) * ENDLESS_BAND_WIDTH);
  return { fights: band(0), elites: band(1), claimants: band(2) };
}

/** Extra life the claimant starts with on loop `loop` (E2). */
export function endlessClaimantLifeBonus(loop: number): number {
  return loop < ENDLESS_LIFE_FROM_LOOP ? 0 : ENDLESS_LIFE_PER_LOOP * (loop - ENDLESS_LIFE_FROM_LOOP + 1);
}

/** The brain an avatar plays on loop `loop`: its own, capped at Medium before ENDLESS_HARD_FROM_LOOP (E2). */
export function endlessBrain(loop: number, own: Difficulty): Difficulty {
  return loop < ENDLESS_HARD_FROM_LOOP && own === 'hard' ? 'medium' : own;
}

/** Whether the claimant starts loop `loop`'s boss duel holding the Mandate (E2). */
export function endlessClaimantHoldsMandate(loop: number): boolean {
  return loop >= ENDLESS_MANDATE_FROM_LOOP;
}

/**
 * Loop `loop` as an act: its template, its bands and Act 1's economy. The
 * claimant is one of the loop's claimant band, picked by the map like an
 * elite (`bossAvatarIds`), so a loop's claimant varies with the run seed.
 */
export function endlessLoopAct(loop: number): StoryAct {
  const bands = endlessBands(loop);
  return {
    id: `endless-${loop}`,
    act: ENDLESS_ACT_BASE + loop,
    mapTemplate: ENDLESS_MAP_TEMPLATE,
    fightAvatarIds: bands.fights,
    eliteAvatarIds: bands.elites,
    bossAvatarId: bands.claimants[0],
    bossAvatarIds: bands.claimants,
    economy: ACT1.economy,
  };
}
