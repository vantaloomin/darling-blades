import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { HardAI } from '../../src/ai/HardAI';
import { MediumAI } from '../../src/ai/MediumAI';
import { determinize } from '../../src/ai/determinize';
import * as evaluation from '../../src/ai/evaluate';
import { validateAction, type Action } from '../../src/engine/actions';
import { Game } from '../../src/engine/Game';
import type { CardDb, CardDef, GameState, Permanent } from '../../src/engine/types';
import type { PlayerView } from '../../src/engine/view';
import { body, DB, fixture, invariantErrors, lands } from './documentedBehaviourFixture';

type Cast = Extract<Action, { type: 'castSpell' | 'castDarling' }>;
type Search = {
  medium: MediumAI;
  aggregateOutcome(view: PlayerView, actions: Action[]): { score: number; wonAll: boolean; lostAny: boolean } | null;
  holdComparison(view: PlayerView, cast: Cast): { now: number; held: number } | null;
  mainTwoOutcome(view: PlayerView, cast: Cast, deferred: boolean, seed: number): number | null;
  castInstance(game: Game, cast: Cast): number | undefined;
};

const RITE: CardDef = {
  id: 'timing_rite', name: 'timing_rite', types: ['creature'], subtypes: [], colors: [], rarity: 'c',
  cost: { generic: 3, pips: {} }, attack: 6, defense: 6, rite: { n: 1 },
};
const SKIMMERS: CardDef[] = Array.from({ length: 10 }, (_, index) => ({
  id: `timing_skim_${index}`, name: `timing_skim_${index}`, types: ['ritual'], subtypes: [], colors: [], rarity: 'c',
  cost: { generic: 12, pips: {} }, skim: { cost: { generic: 0, pips: {} } },
}));
const TIMING_DB: CardDb = { ...DB, [RITE.id]: RITE, ...Object.fromEntries(SKIMMERS.map((card) => [card.id, card])) };
const RITE_CAST: Cast = { type: 'castSpell', handIndex: 0, sacrifices: [11] };

afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => { expect(invariantErrors).toEqual([]); });

function timingFixture(hand: string[], battlefield: Partial<Permanent>[], setup?: (state: GameState) => void): Game {
  const state = structuredClone(fixture([], battlefield, setup).instanceState);
  state.players[0].hand = hand;
  return Game.restore(state, TIMING_DB);
}

function riteBoard(step: 'main1' | 'main2' = 'main1', canAttack = true): Game {
  return timingFixture([RITE.id], [
    ...lands(3), body(10, 'giant', 0, { enteredThisTurn: !canAttack }),
    body(11, 'bear', 0, { enteredThisTurn: !canAttack }),
  ], (state) => { state.step = step; state.players[1].life = 10; });
}

function choose(game: Game, brain: HardAI): Action {
  const awaiting = game.awaiting;
  if (awaiting.kind === 'gameOver') throw new Error('Expected a live decision');
  const action = brain.chooseAction(game.viewFor(awaiting.player), game.legalActions(awaiting.player));
  expect(validateAction(game.instanceState, TIMING_DB, awaiting.player, action)).toBeNull();
  return action;
}

describe('Hard main-phase pass and timing', () => {
  it.each([
    ['above', 0.001, 'passStep'],
    ['at', 0, 'castSpell'],
    ['below', -0.001, 'castSpell'],
  ] as const)('takes pass only %s the existing zero main margin', (_name, delta, expected) => {
    const game = timingFixture(['bear'], lands(2));
    const hard = new HardAI(TIMING_DB);
    const seam = hard as unknown as Search;
    const cast: Action = { type: 'castSpell', handIndex: 0 };
    vi.spyOn(seam.medium, 'chooseAction').mockReturnValueOnce(cast);
    // Only the numerical boundary is controlled. Candidate generation and
    // final legality still use the engine's public menu.
    const outcomes = vi.spyOn(seam, 'aggregateOutcome').mockImplementation((_view, [action]) => ({
      score: action.type === 'passStep' ? 10 + delta : 10, wonAll: false, lostAny: false,
    }));
    expect(choose(game, hard)).toEqual(expected === 'passStep' ? { type: 'passStep' } : cast);
    expect(outcomes.mock.calls.slice(1).map(([, actions]) => actions[0])).toContainEqual({ type: 'passStep' });
  });

  it('holds a Rite creature so its fodder attacks before being sacrificed in main two', () => {
    const game = riteBoard();
    const hard = new HardAI(TIMING_DB);
    expect(new MediumAI(TIMING_DB).chooseAction(game.viewFor(0), game.legalActions(0))).toEqual(RITE_CAST);
    const comparison = (hard as unknown as Search).holdComparison(game.viewFor(0), RITE_CAST);
    expect(comparison).not.toBeNull();
    expect(comparison!.held).toBeGreaterThan(comparison!.now);

    const first = choose(game, hard);
    expect(first).toEqual({ type: 'passStep' });
    game.submit(0, first);
    // The real engine confirms both bodies can attack before Rite consumes
    // the bear. There are no enemy creatures or response cards in this test.
    game.submit(0, { type: 'declareAttackers', attackers: [10, 11] });
    for (let guard = 0; guard < 20 && game.awaiting.kind !== 'main'; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') throw new Error('Combat should not yet be lethal');
      if (awaiting.kind === 'declareBlockers') game.submit(awaiting.player, { type: 'declareBlockers', blocks: [] });
      else if (awaiting.kind === 'respond' || awaiting.kind === 'hauntlinkWindow') game.submit(awaiting.player, { type: 'passResponse' });
      else throw new Error(`Unexpected combat decision ${awaiting.kind}`);
    }
    expect(game.state.step).toBe('main2');
    expect(game.awaiting).toEqual({ kind: 'main', player: 0 });
    expect(game.state.players[1].life).toBe(4);
    const second = choose(game, hard);
    expect(second).toEqual(RITE_CAST);
    game.submit(0, second);
    expect(game.state.battlefield.some((permanent) => permanent.iid === 10)).toBe(true);
    expect(game.state.battlefield.some((permanent) => permanent.iid === 11)).toBe(false);
    expect(game.state.battlefield.some((permanent) => permanent.cardId === RITE.id)).toBe(true);
  });

  it('compares the same settled main-two endpoint and the same final material', () => {
    const game = riteBoard();
    const view = game.viewFor(0);
    const seam = new HardAI(TIMING_DB) as unknown as Search;
    const scores = vi.spyOn(evaluation, 'evaluate');
    const now = seam.mainTwoOutcome(view, RITE_CAST, false, 1);
    const held = seam.mainTwoOutcome(view, RITE_CAST, true, 1);
    expect(now).not.toBeNull();
    expect(held).not.toBeNull();
    expect(scores).toHaveBeenCalledTimes(2);
    const [immediate, deferred] = scores.mock.calls.map(([state]) => state);
    for (const state of [immediate, deferred]) {
      expect(state.turn).toBe(view.turn);
      expect(state.activePlayer).toBe(0);
      expect(state.step).toBe('main2');
      expect(state.awaiting).toEqual({ kind: 'main', player: 0 });
      expect(state.stack).toEqual([]);
    }
    expect(deferred.battlefield).toEqual(immediate.battlefield);
    expect(deferred.players[0].hand).toEqual(immediate.players[0].hand);
    expect(immediate.players[1].life).toBe(6);
    expect(deferred.players[1].life).toBe(4);
    expect(held!).toBeGreaterThan(now!);
  });

  it.each([
    ['no eligible attacker', 'main1', false],
    ['already in main two', 'main2', true],
  ] as const)('does not offer a hold with %s', (_name, step, canAttack) => {
    const game = riteBoard(step, canAttack);
    const hard = new HardAI(TIMING_DB);
    const comparison = vi.spyOn(hard as unknown as Search, 'holdComparison');
    expect(choose(game, hard)).toEqual(RITE_CAST);
    expect(comparison).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps pass and any hold within eight ordinary slots (attack=%s)', (canAttack) => {
    const game = timingFixture(['bear', ...SKIMMERS.map((card) => card.id)], [
      ...lands(2), ...(canAttack ? [body(10, 'giant')] : []),
    ]);
    const hard = new HardAI(TIMING_DB);
    const seam = hard as unknown as Search;
    vi.spyOn(seam.medium, 'chooseAction').mockReturnValueOnce({ type: 'castSpell', handIndex: 0 });
    const outcomes = vi.spyOn(seam, 'aggregateOutcome').mockReturnValue({ score: 0, wonAll: false, lostAny: false });
    const comparison = vi.spyOn(seam, 'holdComparison').mockReturnValue({ now: 0, held: 0 });
    expect(game.legalActions(0).filter((action) => action.type === 'skim')).toHaveLength(10);
    expect(choose(game, hard)).toEqual({ type: 'castSpell', handIndex: 0 });
    const ordinary = outcomes.mock.calls.slice(1).map(([, actions]) => actions[0]);
    expect(ordinary.filter((action) => action.type === 'passStep')).toHaveLength(1);
    expect(ordinary.filter((action) => action.type === 'skim')).toHaveLength(canAttack ? 6 : 7);
    expect(comparison).toHaveBeenCalledTimes(canAttack ? 1 : 0);
    expect(ordinary.length + comparison.mock.calls.length).toBe(8);
  });

  it('tracks normalized physical card identity inside the determinized clone', () => {
    const game = riteBoard();
    const clone = determinize(game.viewFor(0), TIMING_DB, 1);
    const card = clone.instanceState.players[0].hand[0];
    expect(card).toMatchObject({ cardId: RITE.id, instanceId: expect.any(Number) });
    if (typeof card === 'string') throw new Error('Game.restore must normalize cards into physical instances');
    expect((new HardAI(TIMING_DB) as unknown as Search).castInstance(clone, RITE_CAST)).toBe(card.instanceId);
  });
});
