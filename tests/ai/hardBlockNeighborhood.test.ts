import { afterEach, describe, expect, it, vi } from 'vitest';
import * as combatPlans from '../../src/ai/combatPlans';
import { HardAI } from '../../src/ai/HardAI';
import { validateAction, type Action } from '../../src/engine/actions';
import type { Game } from '../../src/engine/Game';
import type { PlayerView } from '../../src/engine/view';
import { body, DB, fixture } from './documentedBehaviourFixture';

type Block = { blocker: number; attacker: number };
type Outcome = { score: number; wonAll: boolean; lostAny: boolean };
type Search = { aggregateOutcome(view: PlayerView, actions: Action[]): Outcome | null };

afterEach(() => { vi.restoreAllMocks(); });

function board(attackers: { iid: number; cardId: string }[], blockers: number[], missingAttacker?: number): Game {
  return fixture([], [
    ...attackers.map(({ iid, cardId }) => body(iid, cardId, 1, { tapped: true })),
    ...blockers.map((iid) => body(iid, 'three')),
  ], (state) => {
    state.activePlayer = 1;
    state.step = 'combat';
    state.awaiting = { kind: 'declareBlockers', player: 0 };
    state.combat = {
      attackers: [...attackers.map(({ iid }) => iid), ...(missingAttacker === undefined ? [] : [missingAttacker])],
      blocks: [], phase: 'attackersDeclared', damagePrevented: false,
    };
  });
}

function moveCandidates(game: Game, baseline: Block[]): Block[][] {
  const baselineAction: Action = { type: 'declareBlockers', blocks: baseline };
  expect(validateAction(game.instanceState, DB, 0, baselineAction)).toBeNull();
  vi.spyOn(combatPlans, 'chooseBlocks').mockReturnValue(baseline);
  const hard = new HardAI(DB);
  // Pin only the baseline and numerical objective. The real neighborhood is
  // observed before simulation can reject illegal candidates. A constant score
  // keeps the climb at that baseline for exactly one round.
  const outcomes = vi.spyOn(hard as unknown as Search, 'aggregateOutcome')
    .mockReturnValue({ score: 0, wonAll: false, lostAny: false });
  const action = hard.chooseAction(game.viewFor(0), game.legalActions(0));
  expect(validateAction(game.instanceState, DB, 0, action)).toBeNull();
  expect(action).toEqual(baselineAction);
  // Unblocks are deliberately unchanged and may await engine rejection. A move
  // preserves assignment count; adds and removals cannot satisfy this filter.
  const moves = outcomes.mock.calls.slice(1).flatMap(([, [candidate]]) =>
    candidate.type === 'declareBlockers' && candidate.blocks.length === baseline.length ? [candidate.blocks] : []);
  for (const blocks of moves) {
    expect(validateAction(game.instanceState, DB, 0, { type: 'declareBlockers', blocks })).toBeNull();
  }
  return moves;
}

describe('Hard block-neighborhood move legality', () => {
  it('never generates a move onto a full three-blocker gang', () => {
    const game = board([{ iid: 20, cardId: 'bear' }, { iid: 21, cardId: 'bear' }], [10, 11, 12, 13]);
    const baseline = [
      { blocker: 10, attacker: 20 }, { blocker: 11, attacker: 20 },
      { blocker: 12, attacker: 20 }, { blocker: 13, attacker: 21 },
    ];
    const moves = moveCandidates(game, baseline);
    expect(moves).toHaveLength(3);
    for (const move of moves) {
      expect(move.filter((block) => block.attacker === 20)).toHaveLength(2);
      expect(move.filter((block) => block.attacker === 21)).toHaveLength(2);
    }
  });

  it('never moves away from a Dreaded pair leaving one blocker', () => {
    const game = board([{ iid: 20, cardId: 'dreaded_four' }, { iid: 21, cardId: 'bear' }], [10, 11, 12]);
    const baseline = [
      { blocker: 10, attacker: 20 }, { blocker: 11, attacker: 20 }, { blocker: 12, attacker: 21 },
    ];
    expect(moveCandidates(game, baseline)).toEqual([[
      { blocker: 10, attacker: 20 }, { blocker: 11, attacker: 20 }, { blocker: 12, attacker: 20 },
    ]]);
  });

  it('never moves one blocker onto an unblocked Dreaded attacker', () => {
    const game = board([{ iid: 20, cardId: 'bear' }, { iid: 21, cardId: 'dreaded_four' }], [10, 11]);
    expect(moveCandidates(game, [{ blocker: 10, attacker: 20 }, { blocker: 11, attacker: 20 }])).toEqual([]);
  });

  it('allows moving away from a three-blocker Dreaded gang while preserving its pair', () => {
    const game = board([{ iid: 20, cardId: 'dreaded_four' }, { iid: 21, cardId: 'bear' }], [10, 11, 12]);
    const baseline = [10, 11, 12].map((blocker) => ({ blocker, attacker: 20 }));
    const moves = moveCandidates(game, baseline);
    expect(moves).toHaveLength(3);
    for (const move of moves) expect(move.filter((block) => block.attacker === 20)).toHaveLength(2);
  });

  it('does not move onto an attacker removed during the response window', () => {
    const game = board([{ iid: 20, cardId: 'bear' }, { iid: 21, cardId: 'bear' }], [10], 22);
    expect(moveCandidates(game, [{ blocker: 10, attacker: 20 }])).toEqual([[{ blocker: 10, attacker: 21 }]]);
  });
});
