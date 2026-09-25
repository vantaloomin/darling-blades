/**
 * `signals` — the facade the rest of the game uses for anonymous play stats,
 * and the seam the consent UI is built on (rollout wave T2).
 *
 * Five calls, and nothing else is public:
 *
 * ```ts
 * signals.start();                  // once at boot
 * signals.noticeAcknowledged();     // right after the UI stamps statsNoticeVersion
 * signals.cardsPlayed(cardIds);     // human plays, folded into the in-memory tally
 * signals.duelFinished(input);      // one digest per completed duel
 * signals.sessionEnding();          // at every hide: the cards not yet sent this launch
 * ```
 *
 * **Nothing here is persisted, anywhere, ever.** The card tally, the set of
 * cards already reported, the duel counter and the heartbeat flag live in
 * module memory and die with the page. There is no queue and no retry: an
 * event that cannot be sent is lost, which the privacy policy states plainly
 * ("If the game closes unexpectedly, they are simply lost"). There is
 * deliberately no client-side once-per-day cap either, because knowing what
 * day it last sent would require storing a date on the device; the Worker's
 * rotating daily hash does that de-duplication instead (legal review finding
 * 5, 2026-09-10).
 *
 * Every path out of this module goes through `sendSignal()`, which evaluates
 * the gate itself at send time. Nothing here decides whether sending is
 * allowed; it only decides what a payload would contain.
 */

import { CARD_DB } from '../data/catalog';
import type { PlayerId } from '../engine/types';
import type { SaveData } from '../meta/SaveManager';
import { Services } from '../meta/services';
import {
  buildDuelDigest,
  buildHeartbeat,
  buildSessionCards,
  tallyCardsPlayed,
  type CardTally,
  type SignalDifficulty,
  type SignalDuelFormat,
  type SignalEnv,
  type SignalResult,
} from '../meta/playSignals';
import { formFactor, prefersReducedMotion, uiLanguage } from '../platform/clientProfile';
import { isTauri } from '../platform/desktopWindow';
import { APP_VERSION, GIT_SHA } from '../version';
import { currentVerdict, sendSignal } from './signalsClient';

/**
 * The seat DuelScene puts the player in (`const HUMAN: PlayerId = 0`,
 * src/scenes/DuelScene.ts). Kept here so the scene passes the raw engine
 * winner and this module owns the whole outcome mapping.
 */
const HUMAN_SEAT: PlayerId = 0;

/** The deck that was piloted. Nothing on it is emitted; see `DuelDeckInput`. */
export interface DuelSignalDeck {
  cards: readonly string[];
  /** The Warchest reserve, or null outside the reserve formats. */
  landReserve: readonly string[] | null;
  darlingId: string | null;
  /**
   * `SavedDeck.format` verbatim, or null when the duel did not come from a
   * saved deck (Limited, the tutorial, a dev deck override).
   */
  savedFormat: 'constructed' | 'darlings' | 'warchest' | null;
}

/** Everything the scene knows about a finished duel, in its own vocabulary. */
export interface DuelFinishedInput {
  deck: DuelSignalDeck;
  /** This was a Limited (draft) match. */
  limited: boolean;
  /** This was a Gauntlet (Tower) rung. */
  gauntlet: boolean;
  /** The avatar or draft persona faced, or null for a plain practice duel. */
  opponentId: string | null;
  difficulty: string;
  /** `Game.state.winner`: a seat, `'draw'`, or null if the duel never resolved. */
  winner: PlayerId | 'draw' | null;
  /** `gameEnded.reason`, verbatim: `life` | `deck` | `concede` | `turnLimit`. */
  reason: string;
  turns: number;
  mulligans: number;
  /** The save as it stands BEFORE the results path pays out. */
  save: SaveData;
}

// ---------------------------------------------------------------------------
// Launch-scoped memory. All of it dies with the page.
// ---------------------------------------------------------------------------

/**
 * Most distinct cards one LAUNCH may report, across all of its batches (so no
 * single batch can exceed it either). The Worker rejects a larger batch
 * outright with a 400 rather than truncating it, because `buildSessionCards`
 * sorts by card id and a truncation at the edge would bias the card-play
 * distribution alphabetically. The number is a data-point budget: Analytics
 * Engine's free tier caps data points per day and every card row is one, and
 * the budget in worker/src/schema.ts is sized on at most this many card rows
 * per launch. Counting it per launch rather than per batch keeps that true now
 * that a launch can send more than one batch.
 *
 * So the cap is applied HERE, to the tally, where it is a play-order rule
 * rather than an alphabetical one: once the launch has admitted this many
 * distinct cards (already reported plus still pending), a card already pending
 * keeps counting and a new id is simply not admitted. Each batch is still
 * sorted by id before it is sent, so nothing about the order of play within a
 * batch leaves the device. A long session therefore reports its first sixty
 * distinct cards rather than losing all of them, which is the trade the
 * alternative (a rejected batch) does not offer.
 */
export const SESSION_CARD_ROW_CAP = 60;

/** Cards played since the last batch left that no batch this launch has carried yet. */
let cardTally: CardTally = {};
/**
 * Card ids some batch this launch has already carried. A card is reported once
 * per launch, so one row stays one launch that played the card, and the
 * rollup's k = 10 row floor keeps meaning ten launches (owner ruling D11,
 * 2026-09-25). Memory only, like everything else here.
 */
let reportedCards = new Set<string>();
/** Duels this launch whose digest was dispatched. Never reset by a card batch. */
let duelsThisLaunch = 0;
let heartbeatSent = false;

/**
 * Test-only: forget this launch's memory. A real launch resets by being a new
 * page; no production code path calls this.
 */
export function resetSignalsLaunchStateForTest(): void {
  cardTally = {};
  reportedCards = new Set<string>();
  duelsThisLaunch = 0;
  heartbeatSent = false;
}

/** Test-only inspection of the launch memory, so a test can prove it is empty. */
export function signalsLaunchStateForTest(): {
  tally: CardTally;
  reported: ReadonlySet<string>;
  duels: number;
  heartbeatSent: boolean;
} {
  return { tally: cardTally, reported: reportedCards, duels: duelsThisLaunch, heartbeatSent };
}

/**
 * Whether anything may be accumulated at all. A gate that is closed must not
 * leave a tally sitting in memory that a later toggle-on would then send: a
 * card played while the player had stats off was never covered by consent, so
 * it is dropped at the door rather than buffered. A dev build accumulates
 * normally, so the dry run shows what production would have sent.
 */
function permitted(): boolean {
  const verdict = currentVerdict();
  return verdict.allowed || verdict.reason === 'devBuild';
}

// ---------------------------------------------------------------------------
// Payload assembly. The impure facts are gathered here and handed to the pure
// builders; no bucketing, no filtering and no vocabulary lives in this module.
// ---------------------------------------------------------------------------

function signalEnv(): SignalEnv {
  return {
    appVersion: APP_VERSION,
    buildSha: GIT_SHA,
    platform: isTauri() ? 'desktop' : 'web',
    formFactor: formFactor(),
    lang: uiLanguage(),
    reducedMotion: prefersReducedMotion(),
  };
}

/**
 * The save's three deck-format spellings collapse to two signal values.
 * `constructed` is the pre-1.6 name for what is now the reserve-native
 * Warchest build, and a deck with no format at all is a granted deck from
 * before the field existed, which is the same thing: both report `warchest`.
 * A Gauntlet rung and a Limited match are formats of their own and win over
 * whatever list was brought, in the same order `showResults` branches.
 */
function duelFormat(input: DuelFinishedInput): SignalDuelFormat {
  if (input.gauntlet) return 'gauntlet';
  if (input.limited) return 'limited';
  return input.deck.savedFormat === 'darlings' ? 'darlings' : 'warchest';
}

/**
 * The outcome, from the engine's own winner and reason.
 *
 * `concede` means the HUMAN conceded, and only that. The engine reports a
 * concede as `reason: 'concede'` with the *other* seat as winner, so an AI
 * concede arrives here as a human win and is reported as `win`; folding it into
 * `concede` would read as the player giving up. A draw (`turnLimit`, or
 * simultaneous lethal) and an unresolved duel both read as `draw`.
 */
function duelResult(winner: PlayerId | 'draw' | null, reason: string): SignalResult {
  if (winner === 'draw' || winner === null) return 'draw';
  if (winner === HUMAN_SEAT) return 'win';
  return reason === 'concede' ? 'concede' : 'loss';
}

/** Send the launch's one heartbeat, if the gate lets it through. */
function sendHeartbeat(): void {
  if (heartbeatSent || !permitted()) return;
  const payload = buildHeartbeat(Services.save.data, signalEnv());
  if (sendSignal('heartbeat', payload)) heartbeatSent = true;
}

// ---------------------------------------------------------------------------
// The facade
// ---------------------------------------------------------------------------

export const signals = {
  /**
   * Called once at boot (src/gameBoot.ts). Sends the heartbeat if the gate
   * allows it. A save that has not yet seen the current notice is blocked here
   * and sends on `noticeAcknowledged()` instead.
   */
  start(): void {
    sendHeartbeat();
  },

  /**
   * Called by the consent UI immediately after it stamps
   * `settings.statsNoticeVersion`. Sends the heartbeat now if one has not
   * already gone out this launch, so accepting the notice does not cost the
   * player a whole session of data and does not double-count either.
   */
  noticeAcknowledged(): void {
    sendHeartbeat();
  },

  /**
   * Fold the human's played cards into the launch tally. Nothing is sent here;
   * a batch leaves at the next hide (`sessionEnding`). Tokens, basic lands and
   * unknown ids are dropped by `tallyCardsPlayed` before they ever enter the
   * tally, and a card an earlier batch already carried is not counted again,
   * because it will never be sent again.
   */
  cardsPlayed(cardIds: readonly string[]): void {
    if (cardIds.length === 0 || !permitted()) return;
    // One id at a time, in play order, so a call carrying several cards admits
    // every one that still fits. At the cap (see SESSION_CARD_ROW_CAP, counted
    // per launch) a card already pending keeps counting and a card that would
    // open a new row does not. (Deciding per CALL dropped every new id in a call
    // that would overflow, including the ones that fit; caught by
    // tests/net/clientToWorker.test.ts, 2026-09-17.)
    for (const cardId of cardIds) {
      if (reportedCards.has(cardId)) continue;
      const next = tallyCardsPlayed(cardTally, [cardId], CARD_DB);
      if (reportedCards.size + Object.keys(next).length <= SESSION_CARD_ROW_CAP) cardTally = next;
    }
  },

  /**
   * One digest per completed duel, and the launch's duel counter, which is the
   * denominator every card batch carries. The counter moves only when the digest
   * was actually dispatched, so a batch never claims duels that were never
   * reported.
   */
  duelFinished(input: DuelFinishedInput): void {
    if (!permitted()) return;
    const payload = buildDuelDigest(
      {
        format: duelFormat(input),
        opponentId: input.opponentId ?? '',
        difficulty: input.difficulty as SignalDifficulty,
        result: duelResult(input.winner, input.reason),
        turns: input.turns,
        mulligans: input.mulligans,
      },
      {
        cards: input.deck.cards,
        landReserve: input.deck.landReserve,
        darlingId: input.deck.darlingId,
        db: CARD_DB,
      },
      input.save,
    );
    if (sendSignal('duel', payload)) duelsThisLaunch++;
  },

  /**
   * The page is being hidden or is going away (pagehide, or the tab being
   * hidden, which is the reliable one on mobile). Called at EVERY hide, so a
   * player who switches away early and keeps playing is still counted (owner
   * ruling D11, 2026-09-25). Each call sends only the cards no earlier batch
   * this launch carried, so a card is still reported once per launch.
   *
   * What each batch carries, and why the rollup's numbers keep their meaning:
   *
   * - one row per card first reported now, its count being every play of it
   *   this launch up to now (a card cannot have been played before without
   *   being in an earlier batch, unless that earlier send was refused, in which
   *   case its plays are still pending here);
   * - the launch's duel count SO FAR, not the count since the last batch, so a
   *   row's play count and its duel count always cover the same span: launch
   *   start to this batch. A since-last-batch count would pair a whole-launch
   *   play count with a fraction of the launch's duels, and would turn the
   *   published `duelsBucket` into "duels between two tab switches".
   *
   * Nothing in the rollup adds the duel count up (it only groups card rows by
   * it; duel totals come from the duel digests), so repeating the launch's
   * running count on a later batch counts nothing twice.
   *
   * A hide with nothing new sends nothing, which is also what makes the
   * pagehide and visibilitychange pair on one close cost a single batch. A
   * batch the gate refuses leaves its cards pending, as before; a new batch
   * leaves only through `sendSignal`, which re-reads the gate.
   */
  sessionEnding(): void {
    const rows = buildSessionCards(cardTally, duelsThisLaunch);
    if (rows.length === 0) return;
    if (!sendSignal('cards', rows, { sessionEnd: true })) return;
    for (const row of rows) reportedCards.add(row.cardId);
    cardTally = {};
  },
};
