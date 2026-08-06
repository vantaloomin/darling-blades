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
import { HAUNTLINK_DB } from '../hauntlinkFixture';

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
function recordBotGame(seed: number, rulesRev: 1 | 2 = 2, replayVersion = 7): {
  log: ReplayLog;
  finalState: string;
  instanceFinalState: string;
  events: GameEvent[];
} {
  const decks: [string[], string[]] = [testDeck(), testDeck()];
  const game = new Game({ decks: [decks[0].slice(), decks[1].slice()], seed, db: TEST_DB, rulesRev });
  const ais = [new EasyAI(TEST_DB, seed * 2 + 1), new EasyAI(TEST_DB, seed * 2 + 2)];
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(TEST_DB),
    seed,
    decks,
    context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Bot', gauntletRung: null },
  });
  draft.v = replayVersion;
  const events: GameEvent[] = [...game.initialEvents];
  for (let i = 0; i < 20000; i++) {
    const awaiting = game.awaiting;
    if (awaiting.kind === 'gameOver') {
      const log = finishReplay(draft, game.state.winner === 0 ? 'win' : 'loss', 1234567890, game.state.turn);
      return {
        log,
        finalState: JSON.stringify(game.state),
        instanceFinalState: JSON.stringify(game.instanceState),
        events,
      };
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

  it('replays a v6 fixture stream-exactly through the preserved revision-1 path', () => {
    const original = recordBotGame(23, 1, 6);

    expect(original.log.v).toBe(6);
    expect(isReplayLog(original.log)).toBe(true);
    expect(canReplay(original.log, TEST_DB)).toBe(true);
    const replayed = replayGame(original.log, TEST_DB);
    expect('rulesRev' in replayed.game.state).toBe(false);
    expect(JSON.stringify(replayed.game.state)).toBe(original.finalState);
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(original.events));
  });

  it('the current replay round-trips the instance-bearing engine state byte-identically', () => {
    const { log, instanceFinalState } = recordBotGame(17);
    const replayed = replayGame(log, TEST_DB);
    const state = replayed.game.instanceState;
    const cards = [
      ...state.players.flatMap((player) => [
        ...player.deck,
        ...player.hand,
        ...player.graveyard,
        ...player.severed,
      ]),
      ...state.battlefield,
      ...state.stack,
    ];
    expect(cards.every((entry) => typeof entry === 'object' && 'instanceId' in entry)).toBe(true);
    expect(JSON.stringify(state)).toBe(instanceFinalState);
    expect(log.v).toBe(7);
  });

  it('replays a successful linked cast with its public host and instance state', () => {
    const deck = Array.from({ length: 30 }, () => 'free_host').concat(
      Array.from({ length: 30 }, () => 'hauntlink_artifact'),
    );
    const seed = 271;
    const game = new Game({ decks: [deck.slice(), deck.slice()], seed, db: HAUNTLINK_DB });
    const draft = startReplayDraft({
      dbStamp: replayDbStamp(HAUNTLINK_DB),
      seed,
      decks: [deck.slice(), deck.slice()],
      context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Hauntlink Bot', gauntletRung: null },
    });
    const events: GameEvent[] = [...game.initialEvents];
    const record = (p: PlayerId, action: Action): void => {
      events.push(...game.submit(p, action));
      recordReplayAction(draft, p, action);
    };
    let linked: Action | undefined;
    for (let guard = 0; guard < 400 && !linked; guard++) {
      const a = game.awaiting;
      if (a.kind === 'gameOver') break;
      const p = a.player as PlayerId;
      const legal = game.legalActions(p);
      if (a.kind === 'choosePlayDraw') record(p, { type: 'choosePlayDraw', play: true });
      else if (a.kind === 'mulligan') record(p, { type: 'keepHand' });
      else if (a.kind === 'bottomCards') record(p, { type: 'bottomCards', handIndices: [] });
      else if (a.kind === 'main') {
        const mine = game.viewFor(p).you.hand;
        linked = legal.find((candidate) => candidate.type === 'castSpell' && candidate.hauntlinked);
        if (linked) record(p, linked);
        else {
          const host = legal.find(
            (candidate) =>
              candidate.type === 'castSpell' &&
              mine[candidate.handIndex] === 'free_host',
          );
          record(p, host ?? { type: 'passStep' });
        }
      } else if (a.kind === 'declareAttackers') record(p, { type: 'declareAttackers', attackers: [] });
      else if (a.kind === 'declareBlockers') record(p, { type: 'declareBlockers', blocks: [] });
      else if (a.kind === 'respond' || a.kind === 'endStepWindow') record(p, { type: 'passResponse' });
      else if (a.kind === 'discardToHandSize') record(p, { type: 'discard', handIndices: Array.from({ length: a.count }, (_, i) => i) });
      else throw new Error(`unexpected replay setup window ${a.kind}`);
    }
    expect(linked).toBeDefined();
    const log = finishReplay(draft, 'win', 1234567890, game.state.turn);
    expect(log.v).toBe(7);
    expect(log.actions.some((step) => step.a.type === 'castSpell' && step.a.hauntlinked)).toBe(true);
    const replayed = replayGame(log, HAUNTLINK_DB);
    expect(JSON.stringify(replayed.game.instanceState)).toBe(JSON.stringify(game.instanceState));
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(events));
    expect(replayed.game.instanceState.battlefield.some((perm) => perm.attachedTo !== undefined)).toBe(true);
  });

  it('golden replay preserves a FIZZLED linked cast and its full event stream', () => {
    const decks: [string[], string[]] = [
      Array.from({ length: 30 }, () => 'free_host').concat(
        Array.from({ length: 30 }, () => 'hauntlink_artifact'),
      ),
      Array.from({ length: 60 }, () => 'destroy_creature'),
    ];
    const seed = 419;
    const game = new Game({ decks: [decks[0].slice(), decks[1].slice()], seed, db: HAUNTLINK_DB });
    const draft = startReplayDraft({
      dbStamp: replayDbStamp(HAUNTLINK_DB),
      seed,
      decks,
      context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Hauntlink Fizzle Bot', gauntletRung: null },
    });
    const events: GameEvent[] = [...game.initialEvents];
    let fizzled = false;
    let linkHostIid: number | undefined;
    const record = (p: PlayerId, action: Action): void => {
      const submitted = game.submit(p, action);
      events.push(...submitted);
      recordReplayAction(draft, p, action);
      fizzled ||= submitted.some((event) => event.e === 'targetsFizzled');
    };
    for (let guard = 0; guard < 400 && !fizzled; guard++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') break;
      const p = awaiting.player as PlayerId;
      const legal = game.legalActions(p);
      let action: Action | undefined;
      if (awaiting.kind === 'choosePlayDraw') action = { type: 'choosePlayDraw', play: true };
      else if (awaiting.kind === 'mulligan') action = { type: 'keepHand' };
      else if (awaiting.kind === 'bottomCards') action = { type: 'bottomCards', handIndices: [] };
      else if (awaiting.kind === 'main') {
        if (p === 0) {
          action = legal.find((candidate) => candidate.type === 'castSpell' && candidate.hauntlinked === true);
          if (action?.type === 'castSpell') {
            const host = action.targets?.[0];
            if (host?.kind === 'permanent') linkHostIid = host.iid;
          }
          if (!action) {
            const hand = game.viewFor(p).you.hand;
            action = legal.find(
              (candidate) => candidate.type === 'castSpell' && hand[candidate.handIndex] === 'free_host',
            );
          }
        }
        action ??= { type: 'passStep' };
      } else if (awaiting.kind === 'respond' || awaiting.kind === 'endStepWindow') {
        if (p === 1) {
          action = legal.find(
            (candidate) =>
              candidate.type === 'castSpell' &&
              candidate.targets?.[0]?.kind === 'permanent' &&
              candidate.targets[0].iid === linkHostIid,
          );
        }
        action ??= { type: 'passResponse' };
      } else if (awaiting.kind === 'declareAttackers') action = { type: 'declareAttackers', attackers: [] };
      else if (awaiting.kind === 'declareBlockers') action = { type: 'declareBlockers', blocks: [] };
      else if (awaiting.kind === 'discardToHandSize') {
        action = { type: 'discard', handIndices: Array.from({ length: awaiting.count }, (_, i) => i) };
      } else {
        throw new Error(`unexpected replay fizzle setup window ${awaiting.kind}`);
      }
      record(p, action);
    }
    expect(fizzled).toBe(true);
    expect(events.some((event) => event.e === 'hauntlinkFormed')).toBe(false);
    const log = finishReplay(draft, 'win', 1234567890, game.state.turn);
    expect(log.actions.some((step) => step.a.type === 'castSpell' && step.a.hauntlinked)).toBe(true);
    const replayed = replayGame(log, HAUNTLINK_DB);
    expect(replayed.eventLog.some((event) => event.e === 'targetsFizzled')).toBe(true);
    expect(JSON.stringify(replayed.eventLog)).toBe(JSON.stringify(events));
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

  it('accepts a v2 log shape but refuses to replay it', () => {
    const { log } = recordBotGame(5);
    const v2 = { ...log, v: 2 };
    expect(isReplayLog(v2)).toBe(true);
    expect(canReplay(v2, TEST_DB)).toBe(false);
  });
});
