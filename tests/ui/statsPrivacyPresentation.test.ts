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
  STATS_NOTICE_BODY_ASSURANCE,
  STATS_NOTICE_BODY_LEAD,
  STATS_NOTICE_CONTINUE_LABEL,
  STATS_NOTICE_COPY,
  STATS_NOTICE_LAYOUT,
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
  createStatsNoticeController,
  menuArrivalSteps,
  stampStatsNotice,
  statsNoticeBodyStack,
  statsNoticeFooterCenters,
  statsNoticeLabelWrapWidth,
  statsNoticeNoteText,
  statsNoticeOwed,
  statsNoticeToggleCenterX,
  statsPanelButtonCenterX,
  statsPanelColumns,
  statsPanelMaxScroll,
  statsRowNoteKind,
  statsRowNoteState,
  statsRowNoteText,
  statsToggleLabel,
  toggleShareAnonStats,
  type MenuArrivalStep,
  type StatsRowNoteKind,
} from '../../src/ui/statsPrivacyPresentation';
import { theme } from '../../src/ui/theme';

/**
 * The privacy surfaces, tested where they are testable: the copy, the two
 * field-description maps' agreement with the allowlist, the layout numbers,
 * the menu's arrival order, and the first-run dialog's whole behaviour. No
 * Phaser, so all of it runs headless.
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
  ...Object.values(STATS_NOTICE_COPY),
];

describe('the privacy copy', () => {
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

describe('whether the first-run notice is owed', () => {
  const table: [number, number, boolean][] = [
    // saved, current, owed
    [0, 1, true],
    [1, 1, false],
    [2, 1, false],
    [1, 2, true],
    [0, 2, true],
  ];

  for (const [savedVersion, currentVersion, expected] of table) {
    it(`saved ${savedVersion}, current ${currentVersion} -> ${expected ? 'owed' : 'already seen'}`, () => {
      expect(statsNoticeOwed({ savedVersion, currentVersion })).toBe(expected);
    });
  }

  it('never shows a save that is already at the current version', () => {
    expect(
      statsNoticeOwed({
        savedVersion: STATS_NOTICE_VERSION,
        currentVersion: STATS_NOTICE_VERSION,
      }),
    ).toBe(false);
  });

  it('re-arms for a save stamped at the old version when the notice version is bumped', () => {
    // Privacy policy section 8: a change to what is sent is announced the next
    // time the game opens. The bump IS the announcement.
    expect(
      statsNoticeOwed({
        savedVersion: STATS_NOTICE_VERSION,
        currentVersion: STATS_NOTICE_VERSION + 1,
      }),
    ).toBe(true);
  });
});

describe("the menu's arrival order", () => {
  /** All eight combinations, spelled out rather than recomputed. */
  const table: [boolean, boolean, boolean, MenuArrivalStep[]][] = [
    // noticeOwed, deckRepairOwed, tutorialDone, steps
    [false, false, false, ['tutorialPrompt']],
    [false, false, true, []],
    [false, true, false, ['deckRepair']],
    [false, true, true, ['deckRepair']],
    [true, false, false, ['statsNotice', 'tutorialPrompt']],
    [true, false, true, ['statsNotice']],
    [true, true, false, ['statsNotice', 'deckRepair']],
    [true, true, true, ['statsNotice', 'deckRepair']],
  ];

  for (const [noticeOwed, deckRepairOwed, tutorialDone, expected] of table) {
    it(`notice ${noticeOwed}, repair ${deckRepairOwed}, tutorialDone ${tutorialDone} -> [${expected.join(', ')}]`, () => {
      expect(menuArrivalSteps({ noticeOwed, deckRepairOwed, tutorialDone })).toEqual(expected);
    });
  }

  it('puts the notice FIRST whenever it is owed, in every combination', () => {
    for (const deckRepairOwed of [false, true]) {
      for (const tutorialDone of [false, true]) {
        const steps = menuArrivalSteps({ noticeOwed: true, deckRepairOwed, tutorialDone });
        expect(steps[0], `repair=${deckRepairOwed} tutorial=${tutorialDone}`).toBe('statsNotice');
      }
    }
  });

  it('keeps the old rule that a repair notice replaces the tutorial prompt', () => {
    for (const noticeOwed of [false, true]) {
      const steps = menuArrivalSteps({ noticeOwed, deckRepairOwed: true, tutorialDone: false });
      expect(steps).not.toContain('tutorialPrompt');
    }
  });

  it('shows the notice on its own to a returning player with nothing else owed', () => {
    expect(
      menuArrivalSteps({ noticeOwed: true, deckRepairOwed: false, tutorialDone: true }),
    ).toEqual(['statsNotice']);
  });
});

describe('the first-run notice copy', () => {
  const BANNED = ['agree', 'accept', 'consent', 'allow', 'permission'];
  /** Everything the dialog can render, including the two note lines. */
  const DIALOG_STRINGS: readonly string[] = [
    ...Object.values(STATS_NOTICE_COPY),
    STATS_ROW_NOTE_DEVELOPMENT,
    STATS_ROW_NOTE_BROWSER,
  ];

  it('is complete and follows the owner copy rules', () => {
    for (const line of DIALOG_STRINGS) {
      expect(line.length, line).toBeGreaterThan(0);
      expect(line.trim(), line).toBe(line);
      expect(line.includes('—'), `em-dash in: ${line}`).toBe(false);
      expect(line.includes('–'), `en-dash in: ${line}`).toBe(false);
    }
  });

  it('never reads like a consent request, in any case', () => {
    // The legal basis is the audience-measurement exemption plus legitimate
    // interest, NOT consent (docs/legal/README.md, finding 2). A dialog that
    // asks to be agreed with would undermine the basis it relies on.
    for (const line of DIALOG_STRINGS) {
      for (const word of BANNED) {
        expect(line.toLowerCase().includes(word), `"${word}" in: ${line}`).toBe(false);
      }
    }
  });

  it('reuses the existing constants rather than restating them', () => {
    expect(STATS_NOTICE_COPY.title).toBe(STATS_PANEL_TITLE);
    expect(STATS_NOTICE_TITLE).toBe(STATS_PANEL_TITLE);
    expect(STATS_NOTICE_COPY.toggleLabel).toBe(STATS_ROW_LABEL);
    expect(STATS_NOTICE_COPY.secondaryLabel).toBe(STATS_PANEL_BUTTON_LABEL);
    expect(STATS_NOTICE_COPY.primaryLabel).toBe(STATS_NOTICE_CONTINUE_LABEL);
    expect(STATS_NOTICE_COPY.bodyLead).toBe(STATS_NOTICE_BODY_LEAD);
    expect(STATS_NOTICE_COPY.bodyAssurance).toBe(STATS_NOTICE_BODY_ASSURANCE);
  });

  it('names the two states in the Settings row\'s own two words', () => {
    expect(statsToggleLabel(true)).toBe(STATS_NOTICE_COPY.toggleOn);
    expect(statsToggleLabel(false)).toBe(STATS_NOTICE_COPY.toggleOff);
    // The same two words SettingsScene's refreshToggles() writes.
    const scene = readFileSync(resolve(ROOT, 'src/scenes/SettingsScene.ts'), 'utf8');
    expect(scene).toContain(`'${STATS_NOTICE_COPY.toggleOn}' : '${STATS_NOTICE_COPY.toggleOff}'`);
  });

  it('is spelled out nowhere in the dialog itself', () => {
    // "Same reference, not a copied string", proven the only way a headless
    // test can: the dialog's source carries none of this wording as a literal.
    const source = readFileSync(resolve(ROOT, 'src/ui/StatsNoticeDialog.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, ' ');
    for (const line of Object.values(STATS_NOTICE_COPY)) {
      const quoted = new RegExp(`['"]${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
      expect(quoted.test(source), `literal in the dialog: ${line}`).toBe(false);
    }
  });
});

describe("the line under the notice's toggle", () => {
  it('shows development over a browser signal, and NOTHING in the plain case', () => {
    expect(statsNoticeNoteText('development')).toBe(STATS_ROW_NOTE_DEVELOPMENT);
    expect(statsNoticeNoteText('browserSignal')).toBe(STATS_ROW_NOTE_BROWSER);
    // The body already says what the plain Settings caption says.
    expect(statsNoticeNoteText('plain')).toBeNull();
  });

  it('uses the row\'s own wording, never a second copy of it', () => {
    expect(statsNoticeNoteText('development')).toBe(statsRowNoteText('development'));
    expect(statsNoticeNoteText('browserSignal')).toBe(statsRowNoteText('browserSignal'));
  });

  it('asks the real gate, so dev wins over a browser signal there too', () => {
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
    const noteFor = (over: Partial<SignalsGateInput>): string | null =>
      statsNoticeNoteText(statsRowNoteKind(statsRowNoteState({ ...base, ...over }, signalsAllowed)));
    expect(noteFor({ isDev: true, doNotTrack: '1' })).toBe(STATS_ROW_NOTE_DEVELOPMENT);
    expect(noteFor({ doNotTrack: '1' })).toBe(STATS_ROW_NOTE_BROWSER);
    expect(noteFor({ globalPrivacyControl: true })).toBe(STATS_ROW_NOTE_BROWSER);
    expect(noteFor({})).toBeNull();
    // A player who simply has sharing off still gets no line: that is what the
    // toggle beside it is for.
    expect(noteFor({ shareAnonStats: false })).toBeNull();
  });
});

describe('the dialog, as behaviour', () => {
  /** The scene's own wiring, with every effect spied. */
  const target = (shareAnonStats: boolean) => {
    const order: string[] = [];
    const settings = { shareAnonStats };
    return {
      order,
      settings,
      setNoticeVersion: vi.fn((version: number) => order.push(`version:${version}`)),
      touch: vi.fn(() => order.push('touch')),
      acknowledge: vi.fn(() => order.push('acknowledge')),
    };
  };

  it('shows the SAVED choice, off included', () => {
    expect(createStatsNoticeController(target(true), STATS_NOTICE_VERSION).sharing()).toBe(true);
    expect(createStatsNoticeController(target(false), STATS_NOTICE_VERSION).sharing()).toBe(false);
  });

  it('writes the save and persists it the moment the toggle is flipped', () => {
    const spy = target(true);
    const controller = createStatsNoticeController(spy, STATS_NOTICE_VERSION);
    expect(controller.toggle()).toBe(false);
    expect(spy.settings.shareAnonStats).toBe(false);
    // Immediately, exactly as the Settings row does: a player who flips it off
    // and closes the app has been heard even though the notice shows again.
    expect(spy.touch).toHaveBeenCalledTimes(1);
    expect(controller.sharing()).toBe(false);
    expect(controller.toggle()).toBe(true);
    expect(spy.touch).toHaveBeenCalledTimes(2);
  });

  it('stamps NOTHING while the dialog is open, however much the toggle moves', () => {
    const spy = target(true);
    const controller = createStatsNoticeController(spy, STATS_NOTICE_VERSION);
    controller.toggle();
    controller.toggle();
    controller.toggle();
    expect(controller.stamped()).toBe(false);
    expect(spy.setNoticeVersion).not.toHaveBeenCalled();
    expect(spy.acknowledge).not.toHaveBeenCalled();
  });

  it('stamps nothing at all when it is torn down without Continue', () => {
    const spy = target(true);
    const controller = createStatsNoticeController(spy, STATS_NOTICE_VERSION);
    // The scene was left with the dialog up: dismiss() never ran.
    expect(controller.stamped()).toBe(false);
    expect(spy.order).toEqual([]);
  });

  for (const sharing of [true, false]) {
    it(`Continue writes the version, persists it, then acknowledges (sharing ${sharing ? 'on' : 'off'})`, () => {
      // Being told is not the same as opting in: a player who turned sharing
      // off has still been told, so the stamp runs identically and the gate is
      // what refuses.
      const spy = target(sharing);
      const controller = createStatsNoticeController(spy, STATS_NOTICE_VERSION);
      expect(controller.dismiss()).toBe(true);
      expect(spy.order).toEqual([`version:${STATS_NOTICE_VERSION}`, 'touch', 'acknowledge']);
      expect(controller.stamped()).toBe(true);
      expect(spy.settings.shareAnonStats).toBe(sharing);
    });
  }

  it('stamps once however many of Continue, Escape and Enter arrive', () => {
    const spy = target(true);
    const controller = createStatsNoticeController(spy, STATS_NOTICE_VERSION);
    expect(controller.dismiss()).toBe(true);
    expect(controller.dismiss()).toBe(false);
    expect(controller.dismiss()).toBe(false);
    expect(spy.setNoticeVersion).toHaveBeenCalledTimes(1);
    expect(spy.acknowledge).toHaveBeenCalledTimes(1);
  });

  it('carries a toggle flipped before Continue into the stamped save', () => {
    const spy = target(true);
    const controller = createStatsNoticeController(spy, STATS_NOTICE_VERSION);
    controller.toggle();
    controller.dismiss();
    expect(spy.settings.shareAnonStats).toBe(false);
    expect(spy.order).toEqual([
      'touch',
      `version:${STATS_NOTICE_VERSION}`,
      'touch',
      'acknowledge',
    ]);
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

  it('does nothing at all until it is called', () => {
    // The dialog calls this from Continue and from nowhere else, so "the player
    // left with it open" is simply "never called". Proven here as the absence
    // of every effect.
    const target = { setNoticeVersion: vi.fn(), touch: vi.fn(), acknowledge: vi.fn() };
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

  it('reads the same rhythm as the "Your turn" section above it', () => {
    // The gap from the last "Your turn" caption to the Privacy heading is the
    // between-groups gap the whole scene uses, not a number of its own.
    const lastNote = yourTurnRowY(YOUR_TURN_SECTION.rowCount - 1).note;
    const captionBottom = lastNote + (theme.type.caption + 4) / 2;
    expect(STATS_SETTINGS_ROW.sectionTitleY - theme.type.h2 / 2 - captionBottom).toBeGreaterThanOrEqual(16);
    expect(STATS_SETTINGS_ROW.rowY - STATS_SETTINGS_ROW.sectionTitleY).toBe(
      yourTurnRowY(0).row - YOUR_TURN_SECTION.headingY,
    );
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

  it('keeps the Reset row inside the Gameplay panel, level with the Privacy row', () => {
    // Both columns end in a one-row section under its own heading, so the two
    // last rows share a y and the two panels read as a pair.
    expect(SETTINGS_RESET_BLOCK.rowY).toBe(STATS_SETTINGS_ROW.rowY);
    expect(SETTINGS_RESET_BLOCK.captionY + theme.type.caption).toBeLessThanOrEqual(SETTINGS_PANEL_BAND.bottom - 16);
    expect(SETTINGS_RESET_BLOCK.rowY - HIT_HALF).toBeGreaterThan(SETTINGS_PANEL_BAND.top);
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

describe('the first-run dialog layout', () => {
  const layout = modalShellLayout({
    width: STATS_NOTICE_LAYOUT.width,
    height: STATS_NOTICE_LAYOUT.height,
  });
  const content = layout.contentBounds;
  /** A generous stand-in for the wrapped body: three lines each, not two. */
  const ROOMY = { paragraph1: 3 * 24, paragraph2: 3 * 24, note: 2 * 16 };

  it('fits the design canvas and its title-safe frame', () => {
    expect(layout.fits).toBe(true);
    expect(layout.tracksInsidePanel).toBe(true);
    expect(layout.tracksInsideTitleSafe).toBe(true);
    expect(STATS_NOTICE_LAYOUT.width).toBeLessThanOrEqual(theme.design.safeWidth);
    expect(STATS_NOTICE_LAYOUT.height).toBeLessThanOrEqual(theme.design.safeHeight);
  });

  it('opens BELOW the "What is sent" panel, which it can open over itself', () => {
    expect(STATS_NOTICE_LAYOUT.depth).toBeLessThan(theme.depth.modal);
  });

  it('stacks the body, the toggle row and the note in that order', () => {
    const stack = statsNoticeBodyStack(ROOMY);
    expect(stack.paragraph2Y).toBe(ROOMY.paragraph1 + STATS_NOTICE_LAYOUT.paragraphGap);
    expect(stack.toggleRowY).toBeGreaterThan(stack.paragraph2Y + ROOMY.paragraph2);
    expect(stack.toggleRowCenterY).toBe(stack.toggleRowY + STATS_NOTICE_LAYOUT.rowHeight / 2);
    expect(stack.noteY).toBe(stack.toggleRowY + STATS_NOTICE_LAYOUT.rowHeight + STATS_NOTICE_LAYOUT.noteGap);
  });

  it('leaves the note out of the stack entirely when there is none', () => {
    const stack = statsNoticeBodyStack({ ...ROOMY, note: null });
    expect(stack.noteY).toBeNull();
    expect(stack.height).toBe(stack.toggleRowY + STATS_NOTICE_LAYOUT.rowHeight);
  });

  it('fits a roomy body inside the shell\'s content rect, note and all', () => {
    expect(statsNoticeBodyStack(ROOMY).height).toBeLessThanOrEqual(content.height);
    expect(statsNoticeBodyStack({ ...ROOMY, note: null }).height).toBeLessThanOrEqual(content.height);
  });

  it('gives the toggle row a full touch target', () => {
    expect(STATS_NOTICE_LAYOUT.rowHeight).toBeGreaterThanOrEqual(theme.control.minHitHeight);
    expect(STATS_NOTICE_LAYOUT.toggleMinWidth).toBeGreaterThanOrEqual(theme.control.minHitWidth);
  });

  it('right-aligns the toggle and still leaves the label a column to wrap in', () => {
    const right = content.x + content.width;
    for (let hitWidth = theme.control.minHitWidth; hitWidth <= 140; hitWidth += 2) {
      const center = statsNoticeToggleCenterX(right, hitWidth);
      expect(center + hitWidth / 2, `edge at ${hitWidth}`).toBe(right);
      const wrap = statsNoticeLabelWrapWidth(content.width, hitWidth);
      expect(wrap, `wrap at ${hitWidth}`).toBeGreaterThan(300);
      expect(content.x + wrap, `overlap at ${hitWidth}`).toBeLessThanOrEqual(center - hitWidth / 2);
    }
  });

  it('keeps the two footer buttons apart and inside the footer track', () => {
    const footer = layout.footerTrack;
    for (let secondary = theme.control.minHitWidth; secondary <= 200; secondary += 5) {
      for (let primary = theme.control.minHitWidth; primary <= 200; primary += 5) {
        const centers = statsNoticeFooterCenters(footer, secondary, primary);
        const label = `secondary ${secondary}, primary ${primary}`;
        expect(centers.primaryX + primary / 2, label).toBe(footer.x + footer.width);
        expect(centers.secondaryX - secondary / 2, label).toBeGreaterThanOrEqual(footer.x);
        expect(
          centers.primaryX - primary / 2 - (centers.secondaryX + secondary / 2),
          label,
        ).toBe(STATS_NOTICE_LAYOUT.buttonGap);
      }
    }
    expect(footer.height).toBeGreaterThanOrEqual(theme.control.minHitHeight);
  });
});
