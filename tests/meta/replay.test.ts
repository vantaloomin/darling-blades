import { describe, expect, it } from 'vitest';
import { EasyAI } from '../../src/ai/EasyAI';
import type { Action } from '../../src/engine/actions';
import type { GameEvent } from '../../src/engine/events';
import { Game } from '../../src/engine/Game';
import type { CardDef, PlayerId } from '../../src/engine/types';
import {
  canReplay,
  finishReplay,
  isReplayLog,
  pushReplay,
  recordReplayAction,
  REPLAY_CAP,
  replayDbStamp,
  replayGame,
  startReplayDraft,
  undoReplayAction,
  type ReplayLog,
} from '../../src/meta/Replay';
import { deckOf, TEST_DB } from '../helpers';

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

/**
 * Play a full AI-vs-AI game while recording every submit through the real
 * recorder, exactly as DuelScene does. Returns the recorded log plus the
 * original run's final state and full event stream for the golden compare.
 */
function recordBotGame(seed: number): { log: ReplayLog; finalState: string; events: GameEvent[] } {
  const decks: [string[], string[]] = [testDeck(), testDeck()];
  const game = new Game({ decks: [decks[0].slice(), decks[1].slice()], seed, db: TEST_DB });
  const ais = [new EasyAI(TEST_DB, seed * 2 + 1), new EasyAI(TEST_DB, seed * 2 + 2)];
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(TEST_DB),
    seed,
    decks,
    context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Bot', gauntletRung: null },
  });
  const events: GameEvent[] = [...game.initialEvents];
  for (let i = 0; i < 20000; i++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      const log = finishReplay(draft, game.state.winner === 0 ? 'win' : 'loss', 1234567890, game.state.turn);
      return { log, finalState: JSON.stringify(game.state), events };
    }
    const p: PlayerId = awaiting.player;
    const action: Action = ais[p].chooseAction(game.viewFor(p), game.legalActions(p));
    events.push(...game.submit(p, action));
    recordReplayAction(draft, p, action);
  }
  throw new Error(`bot game (seed ${seed}) did not terminate`);
}

describe('deterministic replays (src/meta/Replay.ts)', () => {
  it('golden replay: a recorded game replays to a byte-identical state and event stream', () => {
    for (const seed of [3, 11]) {
      const { log, finalState, events } = recordBotGame(seed);
      const { game, eventLog } = replayGame(log, TEST_DB);
      expect(game.awaiting.kind).toBe('gameOver');
      expect(JSON.stringify(game.state)).toBe(finalState);
      expect(JSON.stringify(eventLog)).toBe(JSON.stringify(events));
    }
  });

  it('replay logs survive a JSON round-trip (the SaveData persistence path)', () => {
    const { log, finalState } = recordBotGame(5);
    const revived = JSON.parse(JSON.stringify(log)) as ReplayLog;
    expect(isReplayLog(revived)).toBe(true);
    const { game } = replayGame(revived, TEST_DB);
    expect(JSON.stringify(game.state)).toBe(finalState);
  });

  it('refuses to replay against a drifted card db (hard-refuse, no divergence)', () => {
    const { log } = recordBotGame(5);
    const bear = TEST_DB.bear as CardDef;
    const drifted = { ...TEST_DB, bear: { ...bear, attack: (bear.attack ?? 0) + 1 } };
    expect(canReplay(log, TEST_DB)).toBe(true);
    expect(canReplay(log, drifted)).toBe(false);
    expect(() => replayGame(log, drifted)).toThrow(/different card database/);
  });

  it('pushReplay keeps a newest-first reel capped at REPLAY_CAP', () => {
    const { log } = recordBotGame(5);
    let reel: ReplayLog[] = [];
    for (let i = 0; i < REPLAY_CAP + 3; i++) {
      reel = pushReplay(reel, { ...log, endedAt: i });
    }
    expect(reel).toHaveLength(REPLAY_CAP);
    expect(reel[0].endedAt).toBe(REPLAY_CAP + 2);
    expect(reel[REPLAY_CAP - 1].endedAt).toBe(3);
  });

  it('undoReplayAction pops only a trailing human action', () => {
    const draft = startReplayDraft({
      dbStamp: 'x',
      seed: 1,
      decks: [[], []],
      context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Bot', gauntletRung: null },
    });
    recordReplayAction(draft, 0, { type: 'passStep' });
    recordReplayAction(draft, 1, { type: 'passStep' });
    undoReplayAction(draft, 0); // AI tail: no-op by the seat check
    expect(draft.actions).toHaveLength(2);
    recordReplayAction(draft, 0, { type: 'concede' });
    undoReplayAction(draft, 0); // human tail: popped
    expect(draft.actions).toHaveLength(2);
    expect(draft.actions[1].p).toBe(1);
  });

  it('recorded actions are deep copies, immune to caller mutation', () => {
    const draft = startReplayDraft({
      dbStamp: 'x',
      seed: 1,
      decks: [[], []],
      context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Bot', gauntletRung: null },
    });
    const action: Action = { type: 'declareAttackers', attackers: [1, 2] };
    recordReplayAction(draft, 0, action);
    action.attackers.push(99);
    expect(draft.actions[0].a).toEqual({ type: 'declareAttackers', attackers: [1, 2] });
  });

  it('isReplayLog rejects malformed blobs', () => {
    expect(isReplayLog(null)).toBe(false);
    expect(isReplayLog({ v: 99 })).toBe(false);
    expect(isReplayLog('nope')).toBe(false);
    const { log } = recordBotGame(5);
    expect(isReplayLog(log)).toBe(true);
    expect(isReplayLog({ ...log, decks: [log.decks[0]] })).toBe(false);
    expect(isReplayLog({ ...log, actions: [{ p: 2, a: { type: 'passStep' } }] })).toBe(false);
  });
});
