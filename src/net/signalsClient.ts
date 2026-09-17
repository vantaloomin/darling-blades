/**
 * The transport: the ONE place in the game that talks to the signals endpoint
 * (rollout wave T2). Everything else goes through `src/net/signals.ts`.
 *
 * Properties this module exists to guarantee, each of which has a test:
 *
 * - **Every send is gated, at send time.** `sendSignal()` evaluates
 *   `signalsAllowed()` itself, so there is no way to reach `fetch` that skips
 *   the gate, not even by calling this module directly.
 * - **The body is the pure builder's output and nothing else.** No envelope, no
 *   timestamp, no session id, no sequence number, no build stamp bolted on. The
 *   event kind travels as a query parameter so the body stays byte-identical to
 *   what `src/meta/playSignals.ts` produced. (See ENDPOINT below.)
 * - **No credentials of any kind.** `credentials: 'omit'` on every request, no
 *   `Authorization` header, no cookie ever set on that origin, and the only
 *   header is `content-type`.
 * - **Fire and forget.** A rejection, a 429, a 500 and a synchronously thrown
 *   `fetch` are all swallowed. There is no retry, no backoff and no queue: a
 *   queue would be state that outlives the send, and the design has none. A
 *   lost event is simply lost, which the privacy policy says out loud.
 * - **Nothing is stored on the device.** This module has no persistence at all.
 *
 * In a dev build the client sends nothing and `console.debug`s the exact
 * payload it would have sent instead, so the owner can watch it while playing.
 * That happens only when the dev build is the *sole* reason the gate closed, so
 * a dev build with the toggle off is as silent as a production one.
 */

import { readSignalsGateInput, signalsAllowed, type SignalsVerdict } from './signalsGate';

/**
 * The endpoint, decided 2026-09-10 (rollout doc, owner prerequisites). It is
 * both here and in the privacy policy, so moving it is a code change.
 *
 * The event kind rides in the `e` query parameter rather than in the body,
 * because the body must stay byte-identical to the pure builder's output. The
 * path stays exactly `/v1/signals`, which is the path EasyPrivacy does not
 * block and the path the Worker already routes on.
 */
export const SIGNALS_ENDPOINT = 'https://db-signals.loominvanta.workers.dev/v1/signals';

/** The three events of the schema, in the order the session produces them. */
export type SignalsEventKind = 'heartbeat' | 'duel' | 'cards';

/** The console prefix a dev build logs an unsent payload under. */
export const DRY_RUN_PREFIX = '[signals:dry-run]';

/**
 * Test-only endpoint override. Nothing in `src/` calls the setter (asserted by
 * tests/net/harnessTrap.test.ts); a suite sets it to point the client at a
 * spy and to lift the dev-build suppressor, since vitest always runs with
 * `import.meta.env.DEV` true.
 */
let testEndpoint: string | null = null;

/** Test-only. See `testEndpoint`. */
export function setSignalsTestEndpoint(url: string | null): void {
  testEndpoint = url;
}

/** The URL a send would use right now. Exported for tests and for the dry run. */
export function signalsEndpoint(): string {
  return testEndpoint ?? SIGNALS_ENDPOINT;
}

/** The current verdict, re-read from the save and the browser on every call. */
export function currentVerdict(): SignalsVerdict {
  return signalsAllowed(readSignalsGateInput(testEndpoint));
}

function requestUrl(kind: SignalsEventKind): string {
  return `${signalsEndpoint()}?e=${kind}`;
}

/**
 * True when `fetch` understands `keepalive`, feature-detected once. A request
 * issued from `pagehide` is only delivered if the transport outlives the
 * document, which is what `keepalive` buys; where it is missing we fall back to
 * `navigator.sendBeacon`, whose whole purpose is that case.
 */
let keepaliveSupport: boolean | null = null;

function fetchKeepaliveSupported(): boolean {
  if (keepaliveSupport === null) {
    try {
      keepaliveSupport =
        typeof Request === 'function' && 'keepalive' in new Request(SIGNALS_ENDPOINT, { method: 'POST' });
    } catch {
      keepaliveSupport = false;
    }
  }
  return keepaliveSupport;
}

/** Test-only: forget the feature probe so a suite can exercise both branches. */
export function resetKeepaliveProbeForTest(): void {
  keepaliveSupport = null;
}

/**
 * POST one already-built payload. Returns whether a send was DISPATCHED (a real
 * request, or the dev-build dry run that stands in for one), so the facade can
 * count "one heartbeat per launch" against attempts rather than against calls
 * the gate refused. A refused call returns false and leaves nothing behind.
 *
 * `sessionEnd` marks the batch that leaves while the page is going away; it is
 * the only caller that may fall back to `sendBeacon`.
 */
export function sendSignal(
  kind: SignalsEventKind,
  payload: unknown,
  opts: { sessionEnd?: boolean } = {},
): boolean {
  const verdict = currentVerdict();
  // Anything but the dev build means a real suppressor fired: send nothing, log
  // nothing. Silence is the promise in privacy policy section 3.3.
  if (!verdict.allowed && verdict.reason !== 'devBuild') return false;

  let body: string;
  try {
    body = JSON.stringify(payload);
  } catch {
    return false; // unserialisable payload: drop it rather than guess
  }

  if (!verdict.allowed) {
    // reason === 'devBuild': every player-facing suppressor passed, so show the
    // owner exactly what a production build would have put on the wire.
    try {
      console.debug(DRY_RUN_PREFIX, kind, body);
    } catch {
      /* a console that throws is not the game's problem */
    }
    return true;
  }

  const url = requestUrl(kind);
  try {
    if (opts.sessionEnd === true && !fetchKeepaliveSupported()) {
      return sendViaBeacon(url, body);
    }
    // `credentials: 'omit'` is the load-bearing option: no cookies, no
    // client certificates, and no chance of an ambient credential riding
    // along. There is no Authorization header and no custom header, which
    // also keeps the CORS preflight to the simple content-type case.
    const result: unknown = fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body,
    });
    // Fire and forget: the response is never read and a rejection is dropped on
    // the floor. Nothing downstream of here can fail the game.
    void Promise.resolve(result).catch(() => undefined);
    return true;
  } catch {
    // `fetch` missing or throwing synchronously (a locked-down webview, an
    // extension that replaced it). The session-end batch still gets its one
    // beacon attempt; anything else is simply dropped.
    if (opts.sessionEnd === true) return sendViaBeacon(url, body);
    return false;
  }
}

/**
 * The unload-safe fallback. `sendBeacon` cannot carry `credentials: 'omit'`,
 * which is acceptable here only because the game never sets a cookie on the
 * signals origin and the Worker never issues one, so there is nothing to send.
 */
function sendViaBeacon(url: string, body: string): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false;
    const blob = typeof Blob === 'function' ? new Blob([body], { type: 'application/json' }) : body;
    navigator.sendBeacon(url, blob as BodyInit);
    return true;
  } catch {
    return false;
  }
}
