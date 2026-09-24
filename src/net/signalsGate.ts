/**
 * The gate: the single decision that says whether anything at all may leave
 * this device for the anonymous play stats (rollout wave T2).
 *
 * `signalsAllowed()` is pure and total over plain inputs, so the whole truth
 * table is testable headless. `readSignalsGateInput()` is the thin impure half
 * that gathers those inputs from the save, the browser and the URL.
 *
 * **It is evaluated at SEND time, on every single send.** Nothing caches the
 * verdict, so flipping the Settings toggle off stops the very next send with no
 * restart, which is what the privacy policy's section 3.3 promises ("Any of
 * these stops all play stats immediately ... When it is off, the game makes no
 * requests to our stats service at all").
 *
 * Six suppressors, any one of which stops everything:
 *
 * | reason | source |
 * | --- | --- |
 * | `settingOff` | `settings.shareAnonStats` is false |
 * | `doNotTrack` | `navigator.doNotTrack === '1'` |
 * | `globalPrivacyControl` | `navigator.globalPrivacyControl === true` (binding under CPRA) |
 * | `urlFlag` | `?telemetry=off` |
 * | `noticePending` | the save's `statsNoticeVersion` is below `STATS_NOTICE_VERSION` |
 * | `devBuild` | `IS_DEV` |
 *
 * The order is load-bearing in two places. `settingOff` is first because the
 * player's own explicit choice is the answer we most want to see in a debug
 * log. `devBuild` is **last** because the caller uses that reason as proof that
 * every other suppressor passed: a dev build dry-runs the payload it would have
 * sent (see signalsClient.ts) and must not dry-run a payload that a real player
 * setting would have blocked anyway.
 *
 * `noticePending` is the code behind privacy policy section 8: "If a change
 * affects what the game sends, the game will tell you the next time you open
 * it, **before anything new is sent**." A save that has not seen the current
 * notice sends nothing at all, so the promise holds by construction rather than
 * by the UI remembering to gate itself.
 */

import { Services } from '../meta/services';
import { normalizeStatsNoticeVersion, STATS_NOTICE_VERSION } from '../meta/statsNotice';
import { IS_DEV } from '../platform/env';

/** Why nothing may be sent. `null` only ever accompanies `allowed: true`. */
export type SignalsBlockReason =
  | 'settingOff'
  | 'doNotTrack'
  | 'globalPrivacyControl'
  | 'urlFlag'
  | 'noticePending'
  | 'devBuild';

export interface SignalsGateInput {
  /** `settings.shareAnonStats` from the save. */
  shareAnonStats: boolean;
  /** `settings.statsNoticeVersion` from the save. */
  statsNoticeVersion: number;
  /** The notice version the current field allowlist requires. */
  requiredNoticeVersion: number;
  /** `navigator.doNotTrack`, verbatim. Only the exact string `'1'` suppresses. */
  doNotTrack: string | null;
  /** `navigator.globalPrivacyControl`. Only the boolean `true` suppresses. */
  globalPrivacyControl: boolean | null;
  /** The value of the `telemetry` URL parameter, or null when absent. */
  telemetryParam: string | null;
  /** `IS_DEV` (src/platform/env.ts). */
  isDev: boolean;
  /**
   * Set ONLY by tests, via `setSignalsTestEndpoint()`. When present it both
   * redirects the POST and lifts the dev-build suppressor, so the real send
   * path can be exercised from a suite that always runs with `IS_DEV` true.
   * Nothing in `src/` ever sets it; `tests/net/harnessTrap.test.ts` asserts so.
   */
  testEndpoint: string | null;
}

export type SignalsVerdict =
  | { allowed: true; reason: null }
  | { allowed: false; reason: SignalsBlockReason };

const ALLOWED: SignalsVerdict = { allowed: true, reason: null };

function blocked(reason: SignalsBlockReason): SignalsVerdict {
  return { allowed: false, reason };
}

/**
 * The whole decision. Pure, total, and cheap enough to run on every send.
 *
 * Every suppressor is a hard stop on its own; combinations report the first in
 * the documented order above. Nothing here is an opinion about a *kind* of
 * event: the gate either allows all three events or none of them.
 */
export function signalsAllowed(input: SignalsGateInput): SignalsVerdict {
  if (input.shareAnonStats !== true) return blocked('settingOff');
  if (input.doNotTrack === '1') return blocked('doNotTrack');
  if (input.globalPrivacyControl === true) return blocked('globalPrivacyControl');
  if (input.telemetryParam === 'off') return blocked('urlFlag');
  if (!(input.statsNoticeVersion >= input.requiredNoticeVersion)) return blocked('noticePending');
  if (input.isDev && input.testEndpoint === null) return blocked('devBuild');
  return ALLOWED;
}

/** `navigator.doNotTrack`, plus the two legacy spellings, or null. */
function readDoNotTrack(): string | null {
  try {
    if (typeof navigator === 'undefined') return null;
    const nav = navigator as Navigator & { msDoNotTrack?: string };
    const win = typeof window === 'undefined' ? undefined : (window as Window & { doNotTrack?: string });
    const raw = nav.doNotTrack ?? win?.doNotTrack ?? nav.msDoNotTrack ?? null;
    return typeof raw === 'string' ? raw : null;
  } catch {
    return null;
  }
}

/** `navigator.globalPrivacyControl` (CPRA), or null where unimplemented. */
function readGlobalPrivacyControl(): boolean | null {
  try {
    if (typeof navigator === 'undefined') return null;
    const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    return typeof gpc === 'boolean' ? gpc : null;
  } catch {
    return null;
  }
}

/** The `telemetry` URL parameter, or null when there is no URL to read. */
function readTelemetryParam(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('telemetry');
  } catch {
    return null;
  }
}

/**
 * Gather the gate's inputs. The save is read **fresh on every call** rather
 * than cached at boot, which is the whole mechanism behind "the toggle takes
 * effect immediately, with no restart". Only the test endpoint is passed in,
 * because the client owns it.
 */
export function readSignalsGateInput(testEndpoint: string | null): SignalsGateInput {
  const settings = Services.save.data.settings;
  return {
    shareAnonStats: settings.shareAnonStats === true,
    statsNoticeVersion: normalizeStatsNoticeVersion(settings.statsNoticeVersion),
    requiredNoticeVersion: STATS_NOTICE_VERSION,
    doNotTrack: readDoNotTrack(),
    globalPrivacyControl: readGlobalPrivacyControl(),
    telemetryParam: readTelemetryParam(),
    isDev: IS_DEV,
    testEndpoint,
  };
}
