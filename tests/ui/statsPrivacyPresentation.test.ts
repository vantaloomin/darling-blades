import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SIGNAL_FIELDS, SIGNAL_SETTINGS_FIELDS } from '../../src/meta/playSignals';
import { STATS_NOTICE_VERSION } from '../../src/meta/statsNotice';
import { signalsAllowed, type SignalsGateInput } from '../../src/net/signalsGate';
import { modalShellLayout } from '../../src/ui/layout';
import {
  SETTINGS_LEFT_PANEL_BAND,
  SETTINGS_PANEL_BAND,
  SETTINGS_RESET_BLOCK,
  YOUR_TURN_SECTION,
  yourTurnRowY,
} from '../../src/ui/settingsPresentation';
import {
  STATS_CARDS_EXTRA_LINE,
  STATS_CARDS_FIELD_LINES,
  STATS_DUEL_FIELD_LINES,
  STATS_HEARTBEAT_FIELD_LINES,
  STATS_NEVER_SENT_BODY,
  STATS_NEVER_SENT_TITLE,
  STATS_NOTICE_ACTION_LABEL,
  STATS_NOTICE_BODY,
  STATS_NOTICE_HOLD_MS,
  STATS_NOTICE_TITLE,
  STATS_PANEL_BUTTON_LABEL,
  STATS_PANEL_FOOTER,
  STATS_PANEL_HEADINGS,
  STATS_PANEL_INTRO,
  STATS_PANEL_LAYOUT,
  STATS_PANEL_TITLE,
  STATS_PRIVACY_LINK_HREF,
  STATS_PRIVACY_LINK_LABEL,
  STATS_ROW_LABEL,
  STATS_ROW_NOTE_BROWSER,
  STATS_ROW_NOTE_DEVELOPMENT,
  STATS_ROW_NOTE_PLAIN,
  STATS_SECTION_TITLE,
  STATS_SETTINGS_ROW,
  stampStatsNotice,
  statsNoticeDecision,
  statsNoticeToast,
  statsPanelButtonCenterX,
  statsPanelColumns,
  statsPanelMaxScroll,
  statsRowNoteKind,
  statsRowNoteState,
  statsRowNoteText,
  toggleShareAnonStats,
  type StatsRowNoteKind,
} from '../../src/ui/statsPrivacyPresentation';
import { theme } from '../../src/ui/theme';

/**
 * The consent surfaces, tested where they are testable: the copy, the two
 * field-description maps' agreement with the allowlist, the layout numbers,
 * and the three pure decisions. No Phaser, so all of it runs headless.
 */

const ROOT = resolve(__dirname, '../..');

/** Every player-facing string this module owns. */
const EVERY_STRING: readonly string[] = [
  STATS_SECTION_TITLE,
  STATS_ROW_LABEL,
  STATS_ROW_NOTE_PLAIN,
  STATS_ROW_NOTE_BROWSER,
  STATS_ROW_NOTE_DEVELOPMENT,
  STATS_PANEL_BUTTON_LABEL,
  STATS_PANEL_TITLE,
  STATS_PANEL_INTRO,
  ...Object.values(STATS_PANEL_HEADINGS),
  ...Object.values(STATS_HEARTBEAT_FIELD_LINES),
  ...Object.values(STATS_DUEL_FIELD_LINES),
  ...Object.values(STATS_CARDS_FIELD_LINES),
  STATS_CARDS_EXTRA_LINE,
  STATS_NEVER_SENT_TITLE,
  STATS_NEVER_SENT_BODY,
  STATS_PANEL_FOOTER,
  STATS_PRIVACY_LINK_LABEL,
  STATS_NOTICE_TITLE,
  STATS_NOTICE_BODY,
  STATS_NOTICE_ACTION_LABEL,
];

describe('the consent copy', () => {
  it('is complete and follows the owner copy rules', () => {
    for (const line of EVERY_STRING) {
      expect(line.length, line).toBeGreaterThan(0);
      expect(line.trim(), line).toBe(line);
      // Owner rule: no em-dashes and no en-dashes in player copy.
      expect(line.includes('—'), `em-dash in: ${line}`).toBe(false);
      expect(line.includes('–'), `en-dash in: ${line}`).toBe(false);
    }
  });

  it('uses the privacy policy\'s own wording for the toggle', () => {
    // Section 3.3 tells players to look for exactly this row, so the two must
    // never drift: "If \"Share anonymous play stats\" is on in Settings...".
    const policy = readFileSync(resolve(ROOT, 'docs/legal/privacy-policy.md'), 'utf8');
    expect(policy).toContain(`"${STATS_ROW_LABEL}"`);
  });

  it('repeats the policy promise the footer line makes', () => {
    const policy = readFileSync(resolve(ROOT, 'docs/legal/privacy-policy.md'), 'utf8');
    expect(policy.replace(/\s+/g, ' ')).toContain(
      'When it is off, the game makes no requests to our stats service at all.',
    );
    expect(STATS_PANEL_FOOTER).toContain('makes no requests to the stats service at all');
  });

  it('points at a relative privacy page, so Pages and the desktop bundle agree', () => {
    expect(STATS_PRIVACY_LINK_HREF.startsWith('./')).toBe(true);
    expect(STATS_PRIVACY_LINK_HREF).not.toContain('//');
  });
});

describe('the panel cannot drift from what the code sends', () => {
  const cases: [string, readonly string[], Record<string, string>][] = [
    ['heartbeat', SIGNAL_FIELDS.heartbeat, STATS_HEARTBEAT_FIELD_LINES],
    ['duel', SIGNAL_FIELDS.duel, STATS_DUEL_FIELD_LINES],
    ['cards', SIGNAL_FIELDS.cards, STATS_CARDS_FIELD_LINES],
  ];

  for (const [name, allowlist, lines] of cases) {
    it(`${name}: the description map's keys EQUAL the allowlist, both directions`, () => {
      expect(Object.keys(lines).sort()).toEqual([...allowlist].sort());
      for (const field of allowlist) expect(lines[field], field).toBeTruthy();
      for (const key of Object.keys(lines)) expect(allowlist, key).toContain(key);
    });
  }

  it('has one heading per event', () => {
    expect(Object.keys(STATS_PANEL_HEADINGS).sort()).toEqual(Object.keys(SIGNAL_FIELDS).sort());
  });

  it('covers the nested settings object with its one line', () => {
    // `settings` is emitted as an object of three sub-fields and shows as a
    // single description. A fourth sub-field would need new copy, so this
    // fails rather than letting the panel under-report.
    expect(SIGNAL_SETTINGS_FIELDS.length).toBe(3);
    expect(STATS_HEARTBEAT_FIELD_LINES.settings).toBeTruthy();
  });
});

describe('the row note', () => {
  const base: SignalsGateInput = {
    shareAnonStats: true,
    statsNoticeVersion: STATS_NOTICE_VERSION,
    requiredNoticeVersion: STATS_NOTICE_VERSION,
    doNotTrack: null,
    globalPrivacyControl: null,
    telemetryParam: null,
    isDev: false,
    testEndpoint: null,
  };

  /** The real gate decides; this only names which note that makes. */
  const kindFor = (over: Partial<SignalsGateInput>): StatsRowNoteKind =>
    statsRowNoteKind(statsRowNoteState({ ...base, ...over }, signalsAllowed));

  it('picks development over a browser signal over the plain note, in every combination', () => {
    for (const isDev of [false, true]) {
      for (const doNotTrack of [null, '1']) {
        for (const globalPrivacyControl of [null, true]) {
          const kind = kindFor({ isDev, doNotTrack, globalPrivacyControl });
          const browser = doNotTrack === '1' || globalPrivacyControl === true;
          const expected: StatsRowNoteKind = isDev ? 'development' : browser ? 'browserSignal' : 'plain';
          expect(kind, `dev=${isDev} dnt=${doNotTrack} gpc=${globalPrivacyControl}`).toBe(expected);
        }
      }
    }
  });

  it('ignores the player\'s own switches, which the toggle already shows', () => {
    // The caption explains what ELSE is stopping the sends; the toggle is the
    // answer to "what did I choose". A saved "off" must not turn the caption
    // into an explanation of the browser's behaviour, and vice versa.
    expect(kindFor({ shareAnonStats: false })).toBe('plain');
    expect(kindFor({ statsNoticeVersion: 0 })).toBe('plain');
    expect(kindFor({ shareAnonStats: false, isDev: true })).toBe('development');
    expect(kindFor({ shareAnonStats: false, doNotTrack: '1' })).toBe('browserSignal');
  });

  it('maps each kind to its own line', () => {
    expect(statsRowNoteText('development')).toBe(STATS_ROW_NOTE_DEVELOPMENT);
    expect(statsRowNoteText('browserSignal')).toBe(STATS_ROW_NOTE_BROWSER);
    expect(statsRowNoteText('plain')).toBe(STATS_ROW_NOTE_PLAIN);
  });
});

describe('the toggle', () => {
  it('flips the saved choice and reports it', () => {
    const settings = { shareAnonStats: true };
    expect(toggleShareAnonStats(settings)).toBe(false);
    expect(settings.shareAnonStats).toBe(false);
    expect(toggleShareAnonStats(settings)).toBe(true);
    expect(settings.shareAnonStats).toBe(true);
  });
});

describe('the one-time notice decision', () => {
  const table: [number, number, boolean, string][] = [
    // saved, current, screen clear, decision
    [0, 1, true, 'show'],
    [0, 1, false, 'waitForClearScreen'],
    [1, 1, true, 'alreadySeen'],
    [1, 1, false, 'alreadySeen'],
    [2, 1, true, 'alreadySeen'],
    [1, 2, true, 'show'],
    [1, 2, false, 'waitForClearScreen'],
  ];

  for (const [savedVersion, currentVersion, screenClear, expected] of table) {
    it(`saved ${savedVersion}, current ${currentVersion}, clear ${screenClear} -> ${expected}`, () => {
      expect(statsNoticeDecision({ savedVersion, currentVersion, screenClear })).toBe(expected);
    });
  }

  it('never shows a save that is already at the current version', () => {
    for (const screenClear of [true, false]) {
      expect(
        statsNoticeDecision({
          savedVersion: STATS_NOTICE_VERSION,
          currentVersion: STATS_NOTICE_VERSION,
          screenClear,
        }),
      ).toBe('alreadySeen');
    }
  });
});

describe('the notice, as a rail notice', () => {
  it('carries the copy, holds long enough to read, and never collapses', () => {
    const notice = statsNoticeToast(() => undefined);
    expect(notice.title).toBe(STATS_NOTICE_TITLE);
    expect(notice.body).toBe(STATS_NOTICE_BODY);
    expect(notice.detail).toBe(STATS_NOTICE_ACTION_LABEL);
    expect(notice.action).toEqual({ scene: 'Settings' });
    // Two sentences of body: the contract's floor is eight seconds.
    expect(notice.holdMs).toBe(STATS_NOTICE_HOLD_MS);
    expect(STATS_NOTICE_HOLD_MS).toBeGreaterThanOrEqual(8000);
    expect(notice.neverCollapse).toBe(true);
    expect(notice.fitBody).toBe(true);
  });

  it('hands its onShown straight through, which is what the stamp hangs off', () => {
    const shown = vi.fn();
    statsNoticeToast(shown).onShown?.();
    expect(shown).toHaveBeenCalledTimes(1);
  });
});

describe('the stamp', () => {
  it('writes the version, persists it, and only then acknowledges', () => {
    const order: string[] = [];
    const target = {
      setNoticeVersion: vi.fn((version: number) => order.push(`version:${version}`)),
      touch: vi.fn(() => order.push('touch')),
      acknowledge: vi.fn(() => order.push('acknowledge')),
    };
    stampStatsNotice(target, STATS_NOTICE_VERSION);
    expect(order).toEqual([`version:${STATS_NOTICE_VERSION}`, 'touch', 'acknowledge']);
    expect(target.acknowledge).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all when the notice was never shown', () => {
    // The scene hangs the stamp off the rail's onShown, so "never rendered"
    // is simply "never called". Proven here as the absence of every effect.
    const target = { setNoticeVersion: vi.fn(), touch: vi.fn(), acknowledge: vi.fn() };
    const notice = statsNoticeToast(() => stampStatsNotice(target, STATS_NOTICE_VERSION));
    expect(notice.onShown).toBeTypeOf('function');
    expect(target.setNoticeVersion).not.toHaveBeenCalled();
    expect(target.touch).not.toHaveBeenCalled();
    expect(target.acknowledge).not.toHaveBeenCalled();
  });
});

describe('the Settings row layout', () => {
  const HIT_HALF = theme.control.minHitHeight / 2;

  it('sits inside the left panel, clear of the section above it', () => {
    const lastYourTurnNote = yourTurnRowY(YOUR_TURN_SECTION.rowCount - 1).note;
    expect(STATS_SETTINGS_ROW.sectionTitleY - theme.type.h2 / 2).toBeGreaterThan(lastYourTurnNote + 7);
    expect(STATS_SETTINGS_ROW.rowY - HIT_HALF).toBeGreaterThan(
      STATS_SETTINGS_ROW.sectionTitleY + theme.type.h2 / 2,
    );
    // Two wrapped caption lines plus a bottom margin still clear the panel.
    expect(STATS_SETTINGS_ROW.noteTopY + 2 * (theme.type.caption + 4)).toBeLessThanOrEqual(
      SETTINGS_LEFT_PANEL_BAND.bottom,
    );
    expect(SETTINGS_LEFT_PANEL_BAND.bottom).toBeLessThanOrEqual(theme.design.safeBottom);
  });

  it('keeps the caption clear of the row it belongs to', () => {
    expect(STATS_SETTINGS_ROW.noteTopY).toBeGreaterThanOrEqual(STATS_SETTINGS_ROW.rowY + theme.control.heightSm / 2);
  });

  it('leaves the Gameplay column and the "Your turn" section exactly where they were', () => {
    expect(SETTINGS_PANEL_BAND.bottom).toBe(594);
    expect(yourTurnRowY(0).row).toBe(456);
    expect(yourTurnRowY(1).row).toBe(520);
  });

  it('places the panel button clear of the toggle at every plausible width', () => {
    const toggleRight = STATS_SETTINGS_ROW.toggleX + STATS_SETTINGS_ROW.toggleHitHalfWidth;
    for (let hitWidth = theme.control.minHitWidth; hitWidth <= 130; hitWidth += 2) {
      const center = statsPanelButtonCenterX(hitWidth);
      expect(center - hitWidth / 2, `gap at ${hitWidth}`).toBeGreaterThanOrEqual(
        toggleRight + STATS_SETTINGS_ROW.minControlGap,
      );
      // Still inside the panel (70 + 540 = 610), never past its edge.
      expect(center + hitWidth / 2, `edge at ${hitWidth}`).toBeLessThanOrEqual(610);
    }
  });

  it('right-aligns the button to the panel inset when there is room', () => {
    expect(statsPanelButtonCenterX(theme.control.minHitWidth)).toBe(
      STATS_SETTINGS_ROW.buttonRightX - theme.control.minHitWidth / 2,
    );
  });

  it('wraps the caption inside the panel text column', () => {
    expect(STATS_SETTINGS_ROW.labelX + STATS_SETTINGS_ROW.noteWrapWidth).toBeLessThanOrEqual(
      STATS_SETTINGS_ROW.buttonRightX,
    );
  });

  it('keeps the moved Reset block under the Gameplay column and off the footer', () => {
    // It moved 600px right, same rows, when the left column grew.
    expect(SETTINGS_RESET_BLOCK.labelX).toBe(710);
    expect(SETTINGS_RESET_BLOCK.rowY).toBe(620);
    expect(SETTINGS_RESET_BLOCK.captionY).toBe(650);
    expect(SETTINGS_RESET_BLOCK.rowY - HIT_HALF).toBeGreaterThanOrEqual(SETTINGS_PANEL_BAND.bottom);
    // Clear of the "Check for updates" control's 44px band at y 690.
    expect(SETTINGS_RESET_BLOCK.captionY + theme.type.caption).toBeLessThan(690 - HIT_HALF);
  });
});

describe('the "What is sent" panel layout', () => {
  const layout = modalShellLayout({
    width: STATS_PANEL_LAYOUT.width,
    height: STATS_PANEL_LAYOUT.height,
  });

  it('fits the design canvas and its title-safe frame', () => {
    expect(layout.fits).toBe(true);
    expect(layout.tracksInsidePanel).toBe(true);
    expect(layout.tracksInsideTitleSafe).toBe(true);
    expect(STATS_PANEL_LAYOUT.width).toBeLessThanOrEqual(theme.design.width);
    expect(STATS_PANEL_LAYOUT.height).toBeLessThanOrEqual(theme.design.height);
  });

  it('splits the content into three gapped columns that fill it exactly', () => {
    const columns = statsPanelColumns(layout.contentBounds.width);
    expect(columns.offsets).toHaveLength(STATS_PANEL_LAYOUT.columnCount);
    expect(columns.width).toBeGreaterThan(0);
    for (let i = 1; i < columns.offsets.length; i++) {
      expect(columns.offsets[i] - (columns.offsets[i - 1] + columns.width)).toBeCloseTo(
        STATS_PANEL_LAYOUT.columnGap,
      );
    }
    const last = columns.offsets[columns.offsets.length - 1] + columns.width;
    expect(last).toBeCloseTo(layout.contentBounds.width);
  });

  it('leaves room for a bullet and its line inside every column', () => {
    const columns = statsPanelColumns(layout.contentBounds.width);
    expect(STATS_PANEL_LAYOUT.textIndent).toBeGreaterThan(
      STATS_PANEL_LAYOUT.bulletX + STATS_PANEL_LAYOUT.bulletRadius,
    );
    expect(columns.width - STATS_PANEL_LAYOUT.textIndent).toBeGreaterThan(200);
  });

  it('scrolls only when the content is taller than the viewport', () => {
    expect(statsPanelMaxScroll(100, 400)).toBe(0);
    expect(statsPanelMaxScroll(400, 400)).toBe(0);
    expect(statsPanelMaxScroll(640, 400)).toBe(240);
  });

  it('never renders body copy below the type scale\'s supporting size', () => {
    // The panel is dense, but shrinking a consent disclosure is not an option.
    expect(theme.type.caption).toBeGreaterThanOrEqual(theme.type.micro);
  });
});
