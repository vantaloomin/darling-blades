import { describe, expect, it } from 'vitest';
import { STATS_NOTICE_VERSION } from '../../src/meta/statsNotice';
import {
  signalsAllowed,
  type SignalsBlockReason,
  type SignalsGateInput,
} from '../../src/net/signalsGate';

/** The one input shape in which everything is allowed. Tests override one field. */
const open = (over: Partial<SignalsGateInput> = {}): SignalsGateInput => ({
  shareAnonStats: true,
  statsNoticeVersion: STATS_NOTICE_VERSION,
  requiredNoticeVersion: STATS_NOTICE_VERSION,
  doNotTrack: null,
  globalPrivacyControl: null,
  telemetryParam: null,
  isDev: false,
  testEndpoint: null,
  ...over,
});

/** Every suppressor, as the single field that turns it on. */
const SUPPRESSORS: { reason: SignalsBlockReason; field: Partial<SignalsGateInput> }[] = [
  { reason: 'settingOff', field: { shareAnonStats: false } },
  { reason: 'doNotTrack', field: { doNotTrack: '1' } },
  { reason: 'globalPrivacyControl', field: { globalPrivacyControl: true } },
  { reason: 'urlFlag', field: { telemetryParam: 'off' } },
  { reason: 'noticePending', field: { statsNoticeVersion: STATS_NOTICE_VERSION - 1 } },
  { reason: 'devBuild', field: { isDev: true } },
];

describe('signalsAllowed — the truth table', () => {
  it('allows only when every suppressor is clear', () => {
    expect(signalsAllowed(open())).toEqual({ allowed: true, reason: null });
  });

  it('each suppressor alone stops everything', () => {
    for (const { reason, field } of SUPPRESSORS) {
      expect(signalsAllowed(open(field))).toEqual({ allowed: false, reason });
    }
  });

  it('every combination of suppressors is still blocked', () => {
    // 2^6 subsets: any non-empty subset must block, and only the empty one may
    // allow. This is the whole point of the module, so it is enumerated rather
    // than sampled.
    let allowedCount = 0;
    for (let mask = 0; mask < 1 << SUPPRESSORS.length; mask++) {
      let input = open();
      for (let bit = 0; bit < SUPPRESSORS.length; bit++) {
        if (mask & (1 << bit)) input = { ...input, ...SUPPRESSORS[bit].field };
      }
      const verdict = signalsAllowed(input);
      if (mask === 0) {
        expect(verdict.allowed).toBe(true);
        allowedCount++;
      } else {
        expect(verdict.allowed).toBe(false);
      }
    }
    expect(allowedCount).toBe(1);
  });

  it('reports the first suppressor in the documented order', () => {
    // The order matters to the caller: `devBuild` last is what proves that a
    // dry run only ever logs a payload a real player would have sent.
    const all = SUPPRESSORS.reduce<SignalsGateInput>((acc, s) => ({ ...acc, ...s.field }), open());
    expect(signalsAllowed(all).reason).toBe('settingOff');
    expect(signalsAllowed({ ...all, shareAnonStats: true }).reason).toBe('doNotTrack');
    expect(signalsAllowed({ ...all, shareAnonStats: true, doNotTrack: null }).reason).toBe(
      'globalPrivacyControl',
    );
    expect(
      signalsAllowed({ ...all, shareAnonStats: true, doNotTrack: null, globalPrivacyControl: null })
        .reason,
    ).toBe('urlFlag');
    expect(
      signalsAllowed({
        ...all,
        shareAnonStats: true,
        doNotTrack: null,
        globalPrivacyControl: null,
        telemetryParam: null,
      }).reason,
    ).toBe('noticePending');
  });
});

describe('the notice-version rule (privacy policy section 8)', () => {
  it('a save below the current notice version sends nothing', () => {
    expect(signalsAllowed(open({ statsNoticeVersion: 0 })).reason).toBe('noticePending');
    expect(signalsAllowed(open({ statsNoticeVersion: STATS_NOTICE_VERSION - 1 })).reason).toBe(
      'noticePending',
    );
  });

  it('a save at or above the current notice version is clear', () => {
    expect(signalsAllowed(open({ statsNoticeVersion: STATS_NOTICE_VERSION })).allowed).toBe(true);
    expect(signalsAllowed(open({ statsNoticeVersion: STATS_NOTICE_VERSION + 5 })).allowed).toBe(true);
  });

  it('a migrated save (version 0) is blocked even with the toggle on', () => {
    expect(signalsAllowed(open({ shareAnonStats: true, statsNoticeVersion: 0 })).allowed).toBe(false);
  });
});

describe('the browser signals are read strictly', () => {
  it('only the exact string "1" is Do Not Track', () => {
    for (const value of ['0', 'unspecified', 'yes', 'true', '', null]) {
      expect(signalsAllowed(open({ doNotTrack: value })).allowed).toBe(true);
    }
    expect(signalsAllowed(open({ doNotTrack: '1' })).allowed).toBe(false);
  });

  it('only boolean true is Global Privacy Control', () => {
    expect(signalsAllowed(open({ globalPrivacyControl: false })).allowed).toBe(true);
    expect(signalsAllowed(open({ globalPrivacyControl: null })).allowed).toBe(true);
    expect(signalsAllowed(open({ globalPrivacyControl: true })).allowed).toBe(false);
  });

  it('only ?telemetry=off is the kill switch', () => {
    expect(signalsAllowed(open({ telemetryParam: 'on' })).allowed).toBe(true);
    expect(signalsAllowed(open({ telemetryParam: 'OFF' })).allowed).toBe(true);
    expect(signalsAllowed(open({ telemetryParam: 'off' })).allowed).toBe(false);
  });

  it('a non-boolean shareAnonStats is treated as off, never as on', () => {
    expect(signalsAllowed(open({ shareAnonStats: undefined as unknown as boolean })).allowed).toBe(false);
    expect(signalsAllowed(open({ shareAnonStats: 1 as unknown as boolean })).allowed).toBe(false);
  });
});

describe('the test endpoint override', () => {
  it('lifts the dev-build suppressor and nothing else', () => {
    const endpoint = 'https://signals.test/v1/signals';
    expect(signalsAllowed(open({ isDev: true })).reason).toBe('devBuild');
    expect(signalsAllowed(open({ isDev: true, testEndpoint: endpoint })).allowed).toBe(true);
    // It never overrides a real suppressor.
    for (const { field } of SUPPRESSORS.filter((s) => s.reason !== 'devBuild')) {
      expect(signalsAllowed(open({ ...field, isDev: true, testEndpoint: endpoint })).allowed).toBe(false);
    }
  });
});
