import type { Action } from '../engine/actions';
import type { GameEvent } from '../engine/events';
import { Game } from '../engine/Game';
import type { CardDb, PlayerId } from '../engine/types';
import type { GameFormat, ReserveFormat } from '../config/rules';

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

// Darlings adds public command-zone state plus cast/pay-down actions. Old logs
// must fail closed instead of replaying under the changed action menu.
export const REPLAY_LOG_VERSION = 5 as const;
/** Newest-first FIFO cap for SaveData.replays (mirrors limited.history's 20). */
export const REPLAY_CAP = 10;
const LEGACY_WARCHEST_FORMATS = new Set(['battle' + 'box', 'battle' + 'Box']);

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
  /** Numeric for legacy save fixtures; canReplay/replayGame enforce current v. */
  v: number;
  /** Card-db drift stamp (replayDbStamp) — replays refuse a different db. */
  dbStamp: string;
  seed: number;
  /** [human deck, AI deck] card-id lists, exactly as passed to `new Game`. */
  decks: [string[], string[]];
  /** Present only for reserve-format logs. Classic logs retain their old shape. */
  format?: ReserveFormat;
  /** Ordered reserve payload reconstructed before replaying reserve choices. */
  landReserves?: [string[], string[]];
  /** Public command-zone assignment reconstructed before replaying Darling actions. */
  darlings?: [string | null, string | null];
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
  format?: GameFormat;
  landReserves?: [string[], string[]];
  darlings?: [string | null, string | null];
}): ReplayDraft {
  const draft: ReplayDraft = {
    v: REPLAY_LOG_VERSION,
    dbStamp: init.dbStamp,
    seed: init.seed,
    decks: [init.decks[0].slice(), init.decks[1].slice()],
    context: { ...init.context },
    actions: [],
  };
  if (init.format === 'warchest') {
    if (!init.landReserves) throw new Error('Reserve replay drafts require landReserves.');
    draft.format = 'warchest';
    draft.landReserves = [init.landReserves[0].slice(), init.landReserves[1].slice()];
  } else if (init.format === 'darlings') {
    if (!init.landReserves) throw new Error('Darlings replay drafts require landReserves.');
    if (!init.darlings) throw new Error('Darlings replay drafts require darlings.');
    draft.format = 'darlings';
    draft.landReserves = [init.landReserves[0].slice(), init.landReserves[1].slice()];
    draft.darlings = [init.darlings[0], init.darlings[1]];
  }
  return draft;
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
    if (log.v !== REPLAY_LOG_VERSION) {
      throw new Error('This replay was recorded with an older replay version and cannot be replayed.');
    }
    throw new Error('This replay was recorded on a different card database and cannot be replayed.');
  }
  const format = normalizeReplayFormat(log.format);
  if (log.format && !format) throw new Error('This replay uses an unsupported format.');
  if (format && !log.landReserves) {
    throw new Error('This reserve replay is missing its land-reserve payload.');
  }
  if (format === 'darlings' && !log.darlings) {
    throw new Error('This Darlings replay is missing its Darling payload.');
  }
  const game = new Game({
    decks: [log.decks[0].slice(), log.decks[1].slice()],
    seed: log.seed,
    db,
    ...(format === 'warchest'
      ? {
          format,
          landReserves: [log.landReserves?.[0]?.slice() ?? [], log.landReserves?.[1]?.slice() ?? []],
        }
      : format === 'darlings'
        ? {
            format,
            landReserves: [log.landReserves?.[0]?.slice() ?? [], log.landReserves?.[1]?.slice() ?? []],
            darlings: [log.darlings?.[0] ?? null, log.darlings?.[1] ?? null],
          }
        : {}),
  });
  const eventLog: GameEvent[] = [...game.initialEvents];
  for (const step of log.actions) eventLog.push(...game.submit(step.p, step.a));
  return { game, eventLog };
}

/**
 * Shallow shape check for migration/normalization of persisted blobs. v2 logs
 * remain structurally valid so SaveData/SaveCode can preserve them as an
 * honest non-replayable history entry; canReplay/replayGame still refuse them
 * through the version gate below.
 */
export function isReplayLog(value: unknown): value is ReplayLog {
  if (!value || typeof value !== 'object') return false;
  const log = value as Partial<ReplayLog>;
  const rawFormat = (log as { format?: unknown }).format;
  const format = normalizeReplayFormat(rawFormat);
  const reserveShape = Array.isArray(log.landReserves) &&
    log.landReserves.length === 2 &&
    log.landReserves.every((r) => Array.isArray(r) && r.every((id) => typeof id === 'string'));
  const darlingShape = Array.isArray(log.darlings) &&
    log.darlings.length === 2 &&
    log.darlings.every((id) => id === null || typeof id === 'string');
  // v4 Darlings games used only Warchest reserves. Keep those blobs structurally
  // valid for save preservation, while v5 requires both the reserve and the
  // command-zone payload. canReplay still refuses every older version.
  const payloadShape = log.v === REPLAY_LOG_VERSION
    ? (rawFormat === undefined
        ? log.landReserves === undefined && log.darlings === undefined
        : format === 'warchest'
          ? reserveShape && log.darlings === undefined
          : format === 'darlings'
            ? reserveShape && darlingShape
            : false)
    : ((rawFormat === undefined && log.landReserves === undefined && log.darlings === undefined) ||
      (format !== undefined && reserveShape && log.darlings === undefined));
  const valid =
    (log.v === REPLAY_LOG_VERSION || log.v === 4 || log.v === 3 || log.v === 2) &&
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
    && payloadShape;
  if (valid && format && rawFormat !== format) (log as { format?: ReserveFormat }).format = format;
  return valid;
}

function normalizeReplayFormat(value: unknown): ReserveFormat | undefined {
  if (value === 'warchest' || value === 'darlings') return value;
  return typeof value === 'string' && LEGACY_WARCHEST_FORMATS.has(value) ? 'warchest' : undefined;
}
