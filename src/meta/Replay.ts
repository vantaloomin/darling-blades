import type { Action } from '../engine/actions';
import type { GameEvent } from '../engine/events';
import { Game } from '../engine/Game';
import type { CardDb, PlayerId } from '../engine/types';

/**
 * Deterministic replays (1.2, plan-road-to-1.0 Feature 4's deferred slice).
 *
 * The engine's contract — (decklists, seed, action sequence) → an identical
 * state and event stream, every time — means a replay is nothing more than
 * the recorded inputs. This module is the Phaser-free core: the log shape
 * persisted in SaveData v20, the recorder helpers DuelScene drives at its
 * submit sites, and the pure replayer that the golden test and the viewer
 * both run. Card-rule drift is guarded by a content stamp over the card db:
 * a log recorded against different card definitions refuses to replay
 * (hard-refuse chosen over best-effort — a silently divergent replay is
 * worse than an honest "recorded on an older version" notice).
 */

export const REPLAY_LOG_VERSION = 1 as const;
/** Newest-first FIFO cap for SaveData.replays (mirrors limited.history's 20). */
export const REPLAY_CAP = 10;

export interface ReplayContext {
  mode: 'practice' | 'gauntlet' | 'limited';
  /** Tower logs store the floor tier's base brain, not the avatar's old band. */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Avatar id for gauntlet/practice-vs-avatar duels; null for plain AI. */
  opponentId: string | null;
  /** Display name at record time (persona/avatar names survive roster edits). */
  opponentName: string;
  gauntletRung: number | null;
}

export interface ReplayLog {
  v: typeof REPLAY_LOG_VERSION;
  /** Card-db drift stamp (replayDbStamp) — replays refuse a different db. */
  dbStamp: string;
  seed: number;
  /** [human deck, AI deck] card-id lists, exactly as passed to `new Game`. */
  decks: [string[], string[]];
  context: ReplayContext;
  /** Every successful `Game.submit`, in order, both seats. */
  actions: { p: PlayerId; a: Action }[];
  result: 'win' | 'loss';
  endedAt: number;
  turns: number;
}

/** A log being recorded: everything but the outcome fields. */
export type ReplayDraft = Omit<ReplayLog, 'result' | 'endedAt' | 'turns'>;

/**
 * Content stamp over the card db: card count + FNV-1a of the sorted-id
 * definition JSON. Any errata to a card definition (cost, stats, ops) changes
 * the stamp, so drifted replays fail closed instead of diverging silently.
 */
export function replayDbStamp(db: CardDb): string {
  const ids = Object.keys(db).sort();
  const str = JSON.stringify(ids.map((id) => db[id]));
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${ids.length}.${h.toString(16).padStart(8, '0')}`;
}

export function startReplayDraft(init: {
  dbStamp: string;
  seed: number;
  decks: [string[], string[]];
  context: ReplayContext;
}): ReplayDraft {
  return {
    v: REPLAY_LOG_VERSION,
    dbStamp: init.dbStamp,
    seed: init.seed,
    decks: [init.decks[0].slice(), init.decks[1].slice()],
    context: { ...init.context },
    actions: [],
  };
}

/** Record one successful submit. The action is deep-copied so later mutation
 *  of the caller's object can never corrupt the log. */
export function recordReplayAction(draft: ReplayDraft, p: PlayerId, a: Action): void {
  draft.actions.push({ p, a: structuredClone(a) });
}

/**
 * Roll back the last recorded action for the scene's one-deep Undo. Undo is
 * only offered while the last submit was the human's (it invalidates the
 * moment priority reaches the AI), so the tail is that action by contract;
 * the seat check makes a misuse a no-op instead of a corrupted log.
 */
export function undoReplayAction(draft: ReplayDraft, human: PlayerId): void {
  const tail = draft.actions[draft.actions.length - 1];
  if (tail && tail.p === human) draft.actions.pop();
}

export function finishReplay(
  draft: ReplayDraft,
  result: 'win' | 'loss',
  endedAt: number,
  turns: number,
): ReplayLog {
  return { ...draft, actions: draft.actions.slice(), result, endedAt, turns };
}

/** Newest-first push with the FIFO cap; returns a new array (save-friendly). */
export function pushReplay(replays: ReplayLog[], log: ReplayLog): ReplayLog[] {
  return [log, ...replays].slice(0, REPLAY_CAP);
}

export function canReplay(log: ReplayLog, db: CardDb): boolean {
  return log.v === REPLAY_LOG_VERSION && log.dbStamp === replayDbStamp(db);
}

/**
 * Re-run a recorded game to completion. Throws on db drift (see canReplay for
 * a graceful pre-check) and on any illegal recorded action.
 *
 * HONEST LIMIT (adversarial review 2026-07-16): the stamp guards CARD-DATA
 * drift only. A change to engine CODE (combat ordering, resolution rules, …)
 * alters replay behavior without changing the stamp — old logs would then
 * diverge or throw. The discipline: any engine change that alters observable
 * game behavior must bump REPLAY_LOG_VERSION so persisted logs fail closed
 * via the `v` check instead of replaying wrong. The engine determinism suite
 * (tests/engine/determinism + the golden test in tests/meta/replay.test.ts)
 * catches unintentional drift at CI time, not in shipped saves.
 */
export function replayGame(log: ReplayLog, db: CardDb): { game: Game; eventLog: GameEvent[] } {
  if (!canReplay(log, db)) {
    throw new Error('This replay was recorded on a different card database and cannot be replayed.');
  }
  const game = new Game({ decks: [log.decks[0].slice(), log.decks[1].slice()], seed: log.seed, db });
  const eventLog: GameEvent[] = [...game.initialEvents];
  for (const step of log.actions) eventLog.push(...game.submit(step.p, step.a));
  return { game, eventLog };
}

/** Shallow shape check for migration/normalization of persisted blobs. */
export function isReplayLog(value: unknown): value is ReplayLog {
  if (!value || typeof value !== 'object') return false;
  const log = value as Partial<ReplayLog>;
  return (
    log.v === REPLAY_LOG_VERSION &&
    typeof log.dbStamp === 'string' &&
    typeof log.seed === 'number' &&
    Array.isArray(log.decks) &&
    log.decks.length === 2 &&
    log.decks.every((d) => Array.isArray(d) && d.every((id) => typeof id === 'string')) &&
    !!log.context &&
    typeof log.context === 'object' &&
    Array.isArray(log.actions) &&
    log.actions.every(
      (s) => !!s && typeof s === 'object' && (s.p === 0 || s.p === 1) && !!s.a && typeof s.a.type === 'string',
    ) &&
    (log.result === 'win' || log.result === 'loss') &&
    typeof log.endedAt === 'number' &&
    typeof log.turns === 'number'
  );
}
