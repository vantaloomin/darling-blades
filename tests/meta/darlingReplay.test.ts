import { describe, expect, it } from 'vitest';
import type { Action } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import type { CardDb, PlayerId } from '../../src/engine/types';
import {
  canReplay,
  finishReplay,
  isReplayLog,
  recordReplayAction,
  replayDbStamp,
  replayGame,
  startReplayDraft,
  type ReplayLog,
} from '../../src/meta/Replay';
import { botAction, TEST_DB } from '../helpers';

const DARLINGS_DECK = Array.from({ length: 79 }, () => 'filler');
const RESERVE = ['forest', 'plains', 'mountain', 'island', 'swamp', 'dual_gw', 'forest', 'plains', 'forest', 'swamp'];
const REPLAY_DB: CardDb = {
  ...TEST_DB,
  filler: {
    id: 'filler',
    name: 'Replay Filler',
    types: ['creature'],
    subtypes: [],
    colors: [],
    rarity: 'c',
  },
};

function recordDarlings(seed: number): { log: ReplayLog; state: string; events: string } {
  const decks: [string[], string[]] = [DARLINGS_DECK.slice(), DARLINGS_DECK.slice()];
  const game = new Game({
    decks,
    darlings: ['bear', 'bear'],
    landReserves: [RESERVE, RESERVE],
    format: 'darlings',
    seed,
    db: REPLAY_DB,
  });
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(REPLAY_DB),
    seed,
    decks,
    darlings: ['bear', 'bear'],
    landReserves: [RESERVE, RESERVE],
    format: 'darlings',
    context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Bot', gauntletRung: null },
  });
  const events: GameEvent[] = [...game.initialEvents];
  for (let guard = 0; guard < 3000; guard++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      return {
        log: finishReplay(draft, game.state.winner === 0 ? 'win' : 'loss', 1234567890, game.state.turn),
        state: JSON.stringify(game.instanceState),
        events: JSON.stringify(events),
      };
    }
    const player = awaiting.player as PlayerId;
    const action: Action = botAction(game.legalActions(player));
    events.push(...game.submit(player, action));
    recordReplayAction(draft, player, action);
  }
  throw new Error('Darlings replay fixture did not finish');
}

describe('Darlings replay v5', () => {
  it('round-trips command-zone state and actions byte-identically', () => {
    const original = recordDarlings(9801);
    expect(original.log.v).toBe(5);
    expect(original.log.format).toBe('darlings');
    expect(original.log.darlings).toEqual(['bear', 'bear']);
    expect(original.log.landReserves).toEqual([RESERVE, RESERVE]);
    expect(original.log.actions.some((step) => step.a.type === 'castDarling')).toBe(true);
    expect(isReplayLog(JSON.parse(JSON.stringify(original.log)))).toBe(true);

    const missingReserve = { ...original.log, landReserves: undefined };
    expect(isReplayLog(missingReserve)).toBe(false);
    expect(() => replayGame(missingReserve, REPLAY_DB)).toThrow(
      'This reserve replay is missing its land-reserve payload.',
    );

    const replayed = replayGame(original.log, REPLAY_DB);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(original.state);
    expect(JSON.stringify(replayed.eventLog)).toBe(original.events);
  });

  it('preserves the v4 Darlings reserve-only shape but refuses it through the v5 execution gate', () => {
    const { log } = recordDarlings(9802);
    const legacy: ReplayLog = {
      ...log,
      v: 4,
      darlings: undefined,
      landReserves: [RESERVE, RESERVE],
    };
    expect(isReplayLog(legacy)).toBe(true);
    expect(canReplay(legacy, REPLAY_DB)).toBe(false);
    expect(() => replayGame(legacy, REPLAY_DB)).toThrow('older replay version');
  });
});
