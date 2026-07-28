import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/Game';
import type { Action } from '../../src/engine/actions';
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
import { DARK_TALES_DB } from '../darkTalesFixture';

function recordDarkTales(seed: number): { log: ReplayLog; state: string; events: string } {
  const decks: [string[], string[]] = [
    Array.from({ length: 24 }, () => 'skimRetellCard'),
    Array.from({ length: 24 }, () => 'skimRetellCard'),
  ];
  const game = new Game({ decks, seed, db: DARK_TALES_DB });
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(DARK_TALES_DB),
    seed,
    decks,
    context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Dark Tales Bot', gauntletRung: null },
  });
  const events = [...game.initialEvents];
  const record = (p: 0 | 1, action: Action): void => {
    events.push(...game.submit(p, action));
    recordReplayAction(draft, p, action);
  };

  // Drive the ordinary setup and the starting opponent's turn until P0 has a
  // main phase. Every choice is legal and deterministic from the menu.
  for (let guard = 0; guard < 200; guard++) {
    const a = game.awaiting;
    if (a.kind === 'main' && a.player === 0) break;
    if (a.kind === 'gameOver') throw new Error('dark tales replay setup ended early');
    const p = a.player as 0 | 1;
    let action: Action;
    switch (a.kind) {
      case 'choosePlayDraw': action = { type: 'choosePlayDraw', play: true }; break;
      case 'mulligan': action = { type: 'keepHand' }; break;
      case 'bottomCards': action = { type: 'bottomCards', handIndices: [] }; break;
      case 'main': action = { type: 'passStep' }; break;
      case 'declareAttackers': action = { type: 'declareAttackers', attackers: [] }; break;
      case 'declareBlockers': action = { type: 'declareBlockers', blocks: [] }; break;
      case 'respond':
      case 'endStepWindow': action = { type: 'passResponse' }; break;
      case 'discardToHandSize':
        action = { type: 'discard', handIndices: Array.from({ length: a.count }, (_, i) => i) };
        break;
      case 'chooseBasicLand': action = game.legalActions(p).find((x) => x.type === 'chooseBasicLand')!; break;
      case 'foresee': action = { type: 'foresee', bottomIndices: [] }; break;
      default: throw new Error('unhandled replay setup window');
    }
    record(p, action);
  }

  const skim = game.legalActions(0).find((action) => action.type === 'skim');
  if (!skim) throw new Error('Skim was not legal in replay fixture');
  record(0, skim);
  const retell = game.legalActions(0).find(
    (action) => action.type === 'castSpell' && action.retell === true,
  );
  if (!retell) throw new Error('Retell was not legal in replay fixture');
  record(0, retell);

  const log = finishReplay(draft, 'win', 123, game.state.turn);
  return { log, state: JSON.stringify(game.state), events: JSON.stringify(events) };
}

function recordCancelledRetell(seed: number): { log: ReplayLog; state: string; events: string } {
  const decks: [string[], string[]] = [
    Array.from({ length: 24 }, () => 'skimRetellCard'),
    Array.from({ length: 24 }, () => 'counter'),
  ];
  const game = new Game({ decks, seed, db: DARK_TALES_DB });
  const draft = startReplayDraft({
    dbStamp: replayDbStamp(DARK_TALES_DB),
    seed,
    decks,
    context: { mode: 'practice', difficulty: 'easy', opponentId: null, opponentName: 'Dark Tales Bot', gauntletRung: null },
  });
  const events = [...game.initialEvents];
  const record = (p: 0 | 1, action: Action): void => {
    events.push(...game.submit(p, action));
    recordReplayAction(draft, p, action);
  };

  for (let guard = 0; guard < 200; guard++) {
    const a = game.awaiting;
    if (a.kind === 'main' && a.player === 0) break;
    if (a.kind === 'gameOver') throw new Error('cancelled Retell replay setup ended early');
    const p = a.player as 0 | 1;
    let action: Action;
    switch (a.kind) {
      case 'choosePlayDraw': action = { type: 'choosePlayDraw', play: true }; break;
      case 'mulligan': action = { type: 'keepHand' }; break;
      case 'bottomCards': action = { type: 'bottomCards', handIndices: [] }; break;
      case 'main': action = { type: 'passStep' }; break;
      case 'declareAttackers': action = { type: 'declareAttackers', attackers: [] }; break;
      case 'declareBlockers': action = { type: 'declareBlockers', blocks: [] }; break;
      case 'respond':
      case 'endStepWindow': action = { type: 'passResponse' }; break;
      case 'discardToHandSize':
        action = { type: 'discard', handIndices: Array.from({ length: a.count }, (_, i) => i) };
        break;
      case 'chooseBasicLand': action = game.legalActions(p).find((x) => x.type === 'chooseBasicLand')!; break;
      case 'foresee': action = { type: 'foresee', bottomIndices: [] }; break;
      default: throw new Error('unhandled cancelled Retell setup window');
    }
    record(p, action);
  }

  const skim = game.legalActions(0).find((action) => action.type === 'skim');
  if (!skim) throw new Error('Skim was not legal in cancelled Retell replay');
  record(0, skim);
  const retell = game.legalActions(0).find(
    (action) => action.type === 'castSpell' && action.retell === true,
  );
  if (!retell) throw new Error('Retell was not legal in cancelled Retell replay');
  record(0, retell);
  const counter = game.legalActions(1).find(
    (action) => action.type === 'castSpell' && action.targets?.[0]?.kind === 'stackItem',
  );
  if (!counter) throw new Error('Counter was not legal in cancelled Retell replay');
  record(1, counter);
  if (game.awaiting.kind === 'respond') record(0, { type: 'passResponse' });

  const log = finishReplay(draft, 'win', 456, game.state.turn);
  return { log, state: JSON.stringify(game.state), events: JSON.stringify(events) };
}

describe('Dark Tales replay version 2', () => {
  it('goldens both Skim and Retell action records through replay', () => {
    const original = recordDarkTales(17);
    expect(original.log.v).toBe(2);
    expect(original.log.actions.some((step) => step.a.type === 'skim')).toBe(true);
    expect(original.log.actions.some((step) => step.a.type === 'castSpell' && step.a.retell)).toBe(true);

    const replayed = replayGame(original.log, DARK_TALES_DB);
    expect(JSON.stringify(replayed.game.state)).toBe(original.state);
    expect(JSON.stringify(replayed.eventLog)).toBe(original.events);
  });

  it('goldens a cancelled Retell, including severing on the recorded and replayed sides', () => {
    const original = recordCancelledRetell(23);
    expect(original.log.actions.some((step) => step.a.type === 'castSpell' && step.a.retell)).toBe(true);
    expect(original.log.actions.some(
      (step) => step.a.type === 'castSpell' && step.a.targets?.[0]?.kind === 'stackItem',
    )).toBe(true);
    expect(JSON.parse(original.state).players[0].severed).toEqual(['skimRetellCard']);

    const replayed = replayGame(original.log, DARK_TALES_DB);
    expect(replayed.game.state.players[0].severed).toEqual(['skimRetellCard']);
    expect(JSON.stringify(replayed.game.state)).toBe(original.state);
    expect(JSON.stringify(replayed.eventLog)).toBe(original.events);
  });

  it('fails closed for version-1 logs', () => {
    const { log } = recordDarkTales(17);
    const old = { ...log, v: 1 } as unknown as ReplayLog;
    expect(canReplay(old, DARK_TALES_DB)).toBe(false);
    expect(isReplayLog(old)).toBe(false);
    expect(() => replayGame(old, DARK_TALES_DB)).toThrow(/older replay version/);
  });
});
