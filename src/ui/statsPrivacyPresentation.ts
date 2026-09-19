/**
 * The privacy surfaces' copy and layout, with no Phaser in sight (rollout wave
 * T2, the UI half). "Privacy", not "consent": the legal basis for sending by
 * default is the audience-measurement exemption plus legitimate interest, so
 * none of these surfaces asks to be agreed with (docs/legal/README.md,
 * finding 2).
 *
 * Three things live here and nowhere else:
 *
 * 1. **Every player-facing string** the Settings row, the "What is sent" panel
 *    and the first-run notice show. The scenes render from these constants, so
 *    no sentence exists twice and a test can hold the wording against the
 *    privacy policy's.
 * 2. **The three field-description maps**, typed as `Record<HeartbeatField,
 *    string>` and friends. The type makes the key set equal the allowlist at
 *    compile time and `tests/ui/statsPrivacyPresentation.test.ts` proves it in
 *    both directions at runtime, so the panel cannot claim a field the code
 *    does not send, nor stay silent about one it does.
 * 3. **The layout numbers and the pure decisions** (which note the Settings row
 *    shows, whether the notice is owed, what order the menu's arrival overlays
 *    run in, what the dialog's controls do, and what order the stamp runs in),
 *    because tests never import Phaser.
 *
 * It deliberately does NOT import `src/net`: the gate is handed in as a
 * function (`statsRowNoteState`), so the rules stay in one place and
 * `src/net` keeps its short list of importers (tests/net/harnessTrap.test.ts).
 */

import type { CardsField, DuelField, HeartbeatField } from '../meta/playSignals';
import { theme } from './theme';

// ---------------------------------------------------------------------------
// Settings row
// ---------------------------------------------------------------------------

/** The section heading the Privacy row sits under. */
export const STATS_SECTION_TITLE = 'Privacy';

/**
 * The row label. Identical to the privacy policy's wording in section 3.3,
 * which tells players to look for exactly this string; the test pins it.
 */
export const STATS_ROW_LABEL = 'Share anonymous play stats';

/** The row's caption when nothing else is stopping the sends. */
export const STATS_ROW_NOTE_PLAIN =
  'Broad summaries of how the game is played. No name, no account, nothing that identifies you.';

/** The caption when Do Not Track or Global Privacy Control is closing the gate. */
export const STATS_ROW_NOTE_BROWSER =
  'Your browser asks sites not to track you, so nothing is being sent.';

/** The caption in a local development build, where the client only dry-runs. */
export const STATS_ROW_NOTE_DEVELOPMENT = 'Development build: nothing is sent.';

/** The control beside the row that opens the "What is sent" panel. */
export const STATS_PANEL_BUTTON_LABEL = 'What is sent';

// ---------------------------------------------------------------------------
// The "What is sent" panel
// ---------------------------------------------------------------------------

export const STATS_PANEL_TITLE = 'Anonymous play stats';

export const STATS_PANEL_INTRO =
  'When this is on, the game sends three kinds of short summary to a service we run. They carry no name, no account and no identifier, so nobody, including us, can tell which ones came from you.';

/** One heading per event, keyed by the allowlist's own event names. */
export const STATS_PANEL_HEADINGS = {
  heartbeat: 'When you open the game',
  duel: 'After each finished duel',
  cards: 'When you close the game',
} as const;

/**
 * One line per heartbeat field, in allowlist order (the panel iterates
 * `SIGNAL_FIELDS.heartbeat`, not this object's key order). `settings` is the
 * nested object and renders as its single description line.
 */
export const STATS_HEARTBEAT_FIELD_LINES: Record<HeartbeatField, string> = {
  appVersion: 'Game version',
  buildSha: 'Build number',
  platform: 'Web or desktop',
  formFactor: 'Phone, tablet or computer, never your screen size',
  lang: 'Language, as two letters',
  settings: 'Animation level, reduced motion, and render size',
  streakBucket: 'Daily streak, as a range',
  achievementsBucket: 'Share of achievements unlocked, to the nearest tenth',
  winsBucket: 'Wins, as a range',
  lossesBucket: 'Losses, as a range',
  packsBucket: 'Packs opened, as a range',
  collectionBucket: 'Collection size, as a range',
  tutorialDone: 'Whether the tutorial is finished',
  gauntletBestRung: 'Best Gauntlet rung',
};

/** One line per duel-digest field, in allowlist order. */
export const STATS_DUEL_FIELD_LINES: Record<DuelField, string> = {
  format: 'Format',
  deckColours: "Your deck's colours",
  deckArchetype: 'Which starter deck it is, or "custom"',
  curveBucket: 'Mana curve, as a range',
  deckSource: 'Starter, custom or draft deck',
  opponentId: 'Which built-in opponent you played',
  difficulty: 'Difficulty',
  turnsBucket: 'Number of turns, as a range',
  result: 'Win, loss, draw or concede',
  mulligans: 'Mulligans, up to three',
};

/** One line per session-card-row field, in allowlist order. */
export const STATS_CARDS_FIELD_LINES: Record<CardsField, string> = {
  cardId: 'Each card you played',
  countBucket: 'How often, as a range',
  duelsBucket: 'How many duels the session held, as a range',
};

/** The extra line under the third heading, after its field lines. */
export const STATS_CARDS_EXTRA_LINE =
  'These are kept only in memory while you play. If the game closes unexpectedly they are lost.';

export const STATS_NEVER_SENT_TITLE = 'Never sent';

export const STATS_NEVER_SENT_BODY =
  'Deck names or anything else you type, save codes, replays, your exact collection, your IP address or location, your exact screen size.';

export const STATS_PANEL_FOOTER =
  'Turn this off at any time in Settings. When it is off, the game makes no requests to the stats service at all.';

export const STATS_PRIVACY_LINK_LABEL = 'Read the privacy policy';

/**
 * Relative on purpose: it resolves under the Pages site's project path and
 * inside the packaged desktop bundle alike. The page itself is published
 * alongside this build.
 */
export const STATS_PRIVACY_LINK_HREF = './privacy.html';

// ---------------------------------------------------------------------------
// The first-run notice
// ---------------------------------------------------------------------------

/** The copy gives the notice the same name the panel carries. */
export const STATS_NOTICE_TITLE = STATS_PANEL_TITLE;

/** What is shared and how coarse it is. */
export const STATS_NOTICE_BODY_LEAD =
  'Darling Blades shares anonymous play stats to help improve the game. They are broad summaries, like which bosses get beaten and which cards get played.';

/** What is not shared, and where the switch lives afterwards. */
export const STATS_NOTICE_BODY_ASSURANCE =
  'No name, no account, nothing that identifies you. You can change this at any time in Settings.';

/**
 * The dismiss button. It approves NOTHING: the legal basis for sending by
 * default is the audience-measurement exemption plus legitimate interest, not
 * consent, so this label acknowledges the telling and nothing else (see
 * docs/legal/README.md, finding 2).
 */
export const STATS_NOTICE_CONTINUE_LABEL = 'Continue';

/**
 * Every string the first-run dialog renders, gathered so the dialog can hold
 * NO literal of its own: three of these are the existing Settings/panel
 * constants, which is what keeps the notice and the Settings row from drifting.
 * `tests/ui/statsPrivacyPresentation.test.ts` reads the dialog's source and
 * fails if any of this wording is spelled out there instead.
 */
export const STATS_NOTICE_COPY = {
  title: STATS_NOTICE_TITLE,
  bodyLead: STATS_NOTICE_BODY_LEAD,
  bodyAssurance: STATS_NOTICE_BODY_ASSURANCE,
  /** The privacy policy's own wording, shared with the Settings row. */
  toggleLabel: STATS_ROW_LABEL,
  toggleOn: 'On',
  toggleOff: 'Off',
  /** Opens the existing "What is sent" panel. */
  secondaryLabel: STATS_PANEL_BUTTON_LABEL,
  primaryLabel: STATS_NOTICE_CONTINUE_LABEL,
} as const;

/** The toggle's label for a state, in the Settings row's own two words. */
export function statsToggleLabel(on: boolean): string {
  return on ? STATS_NOTICE_COPY.toggleOn : STATS_NOTICE_COPY.toggleOff;
}

// ---------------------------------------------------------------------------
// The row's state-aware note
// ---------------------------------------------------------------------------

export type StatsRowNoteKind = 'development' | 'browserSignal' | 'plain';

export interface StatsRowNoteState {
  /** The build itself is the reason nothing leaves. */
  development: boolean;
  /** Do Not Track or Global Privacy Control is the reason nothing leaves. */
  browserSignal: boolean;
}

/**
 * The gate's input shape, restated so this module can stay off `src/net`.
 * Structurally identical to `SignalsGateInput`, so the real `signalsAllowed`
 * is passed straight in as `evaluate` with no adapter and no cast.
 */
export interface StatsGateProbeInput {
  shareAnonStats: boolean;
  statsNoticeVersion: number;
  requiredNoticeVersion: number;
  doNotTrack: string | null;
  globalPrivacyControl: boolean | null;
  telemetryParam: string | null;
  isDev: boolean;
  testEndpoint: string | null;
}

/** The gate's verdict shape, widened to what this module reads from it. */
export interface StatsGateProbeVerdict {
  allowed: boolean;
  reason: string | null;
}

/**
 * Ask the gate, twice, which of its suppressors the row should explain.
 *
 * The note is about things the player did NOT choose, so both probes open the
 * player's own switches first (the toggle on, the notice seen, no URL flag);
 * the toggle keeps showing and editing the saved choice either way. Then one
 * probe hides the browser signals to ask "is this a dev build?", and the other
 * clears the dev flag to ask "is a browser signal closing this?". Nothing here
 * restates a rule: `evaluate` is the gate itself, so the row can never disagree
 * with what the client actually does.
 */
export function statsRowNoteState(
  input: StatsGateProbeInput,
  evaluate: (probe: StatsGateProbeInput) => StatsGateProbeVerdict,
): StatsRowNoteState {
  const open: StatsGateProbeInput = {
    ...input,
    shareAnonStats: true,
    statsNoticeVersion: input.requiredNoticeVersion,
    telemetryParam: null,
    testEndpoint: null,
  };
  return {
    development:
      evaluate({ ...open, doNotTrack: null, globalPrivacyControl: null }).reason === 'devBuild',
    browserSignal: evaluate({ ...open, isDev: false }).allowed === false,
  };
}

/** Development wins over a browser signal, which wins over the plain note. */
export function statsRowNoteKind(state: StatsRowNoteState): StatsRowNoteKind {
  if (state.development) return 'development';
  if (state.browserSignal) return 'browserSignal';
  return 'plain';
}

export function statsRowNoteText(kind: StatsRowNoteKind): string {
  if (kind === 'development') return STATS_ROW_NOTE_DEVELOPMENT;
  if (kind === 'browserSignal') return STATS_ROW_NOTE_BROWSER;
  return STATS_ROW_NOTE_PLAIN;
}

/**
 * The same line under the first-run notice's toggle, EXCEPT in the plain case,
 * where the notice shows nothing at all: the dialog's own body already says
 * what the Settings caption says, and repeating it twelve pixels lower reads
 * as a second, weaker disclosure. Only the two "something else is stopping the
 * sends" lines earn the space, and they reuse the row's existing wording.
 */
export function statsNoticeNoteText(kind: StatsRowNoteKind): string | null {
  return kind === 'plain' ? null : statsRowNoteText(kind);
}

// ---------------------------------------------------------------------------
// The toggle, the notice decision, and the stamp
// ---------------------------------------------------------------------------

/**
 * Flip the saved choice and report the new value. The gate re-reads the save on
 * every send, so nothing else has to be told: the very next send obeys this.
 */
export function toggleShareAnonStats(settings: { shareAnonStats: boolean }): boolean {
  settings.shareAnonStats = settings.shareAnonStats !== true;
  return settings.shareAnonStats;
}

export interface StatsNoticeOwedInput {
  /** `settings.statsNoticeVersion`, normalised. */
  savedVersion: number;
  /** `STATS_NOTICE_VERSION`. */
  currentVersion: number;
}

/**
 * Whether the notice is owed on this visit. Pure, so the whole truth table is
 * a test rather than a playthrough.
 *
 * There is no "wait for a clear screen" third answer any more: the notice is
 * the FIRST thing the menu does (owner ruling 2026-09-19), so there is never an
 * overlay to wait behind. A bump of `STATS_NOTICE_VERSION` re-arms this for a
 * save stamped at the old version, which is what makes privacy policy section
 * 8 true ("the game will tell you the next time you open it").
 */
export function statsNoticeOwed(input: StatsNoticeOwedInput): boolean {
  return input.savedVersion < input.currentVersion;
}

// ---------------------------------------------------------------------------
// The menu's arrival chain
// ---------------------------------------------------------------------------

/** One thing the main menu does on arrival, before the player touches it. */
export type MenuArrivalStep = 'statsNotice' | 'deckRepair' | 'tutorialPrompt';

export interface MenuArrivalInput {
  /** `statsNoticeOwed(...)`. */
  noticeOwed: boolean;
  /** The deck-repair notice has something to report. */
  deckRepairOwed: boolean;
  /** `save.tutorialDone`. */
  tutorialDone: boolean;
}

/**
 * What the main menu shows on arrival, in order.
 *
 * The stats notice comes FIRST whenever it is owed (owner ruling 2026-09-19:
 * "a new player sees: Privacy notice ... and then tutorial"), because it is the
 * thing that must be said before anything is sent, and because a notice queued
 * behind a modal is a notice a player can leave without ever seeing.
 *
 * After it, the rule that was already in the scene is unchanged: a deck-repair
 * notice wins over the tutorial prompt, and a player who sees the repair notice
 * is not also asked about the tutorial on the same visit.
 */
export function menuArrivalSteps(input: MenuArrivalInput): readonly MenuArrivalStep[] {
  const steps: MenuArrivalStep[] = [];
  if (input.noticeOwed) steps.push('statsNotice');
  if (input.deckRepairOwed) steps.push('deckRepair');
  else if (!input.tutorialDone) steps.push('tutorialPrompt');
  return steps;
}

/** The three effects the stamp performs, injected so their order is testable. */
export interface StatsNoticeStampTarget {
  setNoticeVersion(version: number): void;
  touch(): void;
  acknowledge(): void;
}

/**
 * Record that the player has been told, in the one order that is safe: write
 * the version, persist it, and only then let the facade send. Reversing the
 * last two would let a heartbeat leave against a save that had not yet been
 * written, so a crash in between would send without the promise being kept.
 */
export function stampStatsNotice(target: StatsNoticeStampTarget, version: number): void {
  target.setNoticeVersion(version);
  target.touch();
  target.acknowledge();
}

// ---------------------------------------------------------------------------
// The first-run dialog's behaviour, with no Phaser attached to it
// ---------------------------------------------------------------------------

export interface StatsNoticeControllerTarget extends StatsNoticeStampTarget {
  /** The live `settings` object from the save; the toggle edits it in place. */
  settings: { shareAnonStats: boolean };
}

/**
 * Everything the dialog can DO, so the dialog itself is only a drawing of it
 * and the whole behaviour is testable headless.
 */
export interface StatsNoticeController {
  /** The saved sharing choice, which is what the toggle shows. */
  sharing(): boolean;
  /** Flip the saved choice and persist it at once. Returns the new value. */
  toggle(): boolean;
  /**
   * Continue, Escape or Enter: the only exit, and the only thing that stamps.
   * Returns whether THIS call was the one that stamped, so a second press is
   * free.
   */
  dismiss(): boolean;
  /** Whether the stamp has been written. False for as long as the dialog is up. */
  stamped(): boolean;
}

/**
 * The dialog's behaviour, with its two rules made structural.
 *
 * 1. **The toggle persists immediately.** A player who switches sharing off and
 *    then closes the app without pressing anything else has still been heard;
 *    the notice simply shows again next launch, because nothing stamped.
 * 2. **Nothing is stamped until the player leaves the dialog.** The gate re-reads
 *    the save at every send and refuses while the saved notice version is below
 *    the current one, so an unstamped save is a save that physically cannot
 *    send. Tearing the dialog down without `dismiss()` therefore sends nothing
 *    and leaves the notice owed.
 *
 * The stamp does NOT depend on the toggle. A player who turned sharing off has
 * still been told, so the version is stamped and `acknowledge()` still runs;
 * the gate is what refuses.
 */
export function createStatsNoticeController(
  target: StatsNoticeControllerTarget,
  version: number,
): StatsNoticeController {
  let stamped = false;
  return {
    sharing: () => target.settings.shareAnonStats === true,
    toggle: () => {
      const on = toggleShareAnonStats(target.settings);
      target.touch();
      return on;
    },
    dismiss: () => {
      if (stamped) return false;
      stamped = true;
      stampStatsNotice(target, version);
      return true;
    },
    stamped: () => stamped,
  };
}

// ---------------------------------------------------------------------------
// The first-run dialog's layout
// ---------------------------------------------------------------------------

/**
 * The blocking first-run dialog. Same footprint as the deck-repair notice the
 * menu already shows (760x430), so the two arrival overlays read as one family,
 * and well inside the 1280x720 design canvas and its title-safe frame.
 *
 * `depth` puts it BELOW `theme.depth.modal`, which is where the "What is sent"
 * panel opens, so the panel is never obscured by the dialog that opened it.
 */
export const STATS_NOTICE_LAYOUT = {
  width: 760,
  height: 430,
  /** Heavier than the panel's 0.62: this is the only thing on screen. */
  dimAlpha: 0.72,
  depth: theme.depth.overlay,
  /** Between the two body paragraphs. */
  paragraphGap: 14,
  /** Body block to the top of the toggle row's band. */
  toggleGap: 20,
  /** The toggle row's band, at the touch-target floor. */
  rowHeight: theme.control.minHitHeight,
  /** Toggle row band to the state-aware line, when there is one. */
  noteGap: 8,
  /** The On/Off control's track, the same 90px the Settings row uses. */
  toggleMinWidth: theme.control.minHitWidth,
  /** Isolation space between the row label and the toggle beside it. */
  minControlGap: 8,
  /** The two footer buttons. */
  secondaryMinWidth: 150,
  primaryMinWidth: 160,
  buttonGap: 24,
} as const;

export interface StatsNoticeMeasuredBody {
  /** Rendered height of the first paragraph. */
  paragraph1: number;
  /** Rendered height of the second paragraph. */
  paragraph2: number;
  /** Rendered height of the state-aware line, or null when there is none. */
  note: number | null;
}

export interface StatsNoticeBodyStack {
  paragraph2Y: number;
  /** TOP of the 44px row band. */
  toggleRowY: number;
  /** Vertical centre of the row band, where the label and toggle sit. */
  toggleRowCenterY: number;
  /** TOP of the state-aware line, or null when there is none. */
  noteY: number | null;
  /** Total height of the stack, for the fits-the-content-rect assertion. */
  height: number;
}

/**
 * Stack the dialog's body from the MEASURED paragraph heights rather than from
 * hardcoded rows: glyph widths (and so wrap counts) are font-fallback dependent
 * on Windows, which is the playbook's measure-then-place trap. Offsets are
 * local to the modal shell's content rect.
 */
export function statsNoticeBodyStack(measured: StatsNoticeMeasuredBody): StatsNoticeBodyStack {
  const paragraph2Y = measured.paragraph1 + STATS_NOTICE_LAYOUT.paragraphGap;
  const toggleRowY = paragraph2Y + measured.paragraph2 + STATS_NOTICE_LAYOUT.toggleGap;
  const rowBottom = toggleRowY + STATS_NOTICE_LAYOUT.rowHeight;
  const noteY = measured.note === null ? null : rowBottom + STATS_NOTICE_LAYOUT.noteGap;
  return {
    paragraph2Y,
    toggleRowY,
    toggleRowCenterY: toggleRowY + STATS_NOTICE_LAYOUT.rowHeight / 2,
    noteY,
    height: noteY === null ? rowBottom : noteY + (measured.note ?? 0),
  };
}

/** The On/Off control, right-aligned to the content rect's right edge. */
export function statsNoticeToggleCenterX(contentRight: number, hitWidth: number): number {
  return contentRight - hitWidth / 2;
}

/** How wide the row label may wrap before it reaches the toggle's hit box. */
export function statsNoticeLabelWrapWidth(contentWidth: number, toggleHitWidth: number): number {
  return Math.max(0, contentWidth - toggleHitWidth - STATS_NOTICE_LAYOUT.minControlGap);
}

export interface StatsNoticeFooterCenters {
  secondaryX: number;
  primaryX: number;
}

/**
 * The footer pair: `Continue` right-aligned to the footer track, `What is sent`
 * to its left. Measure-then-place again, because both labels are text-width
 * dependent; the test walks every plausible pair of widths and proves the two
 * hit boxes never touch and never leave the track.
 */
export function statsNoticeFooterCenters(
  track: { x: number; width: number },
  secondaryHitWidth: number,
  primaryHitWidth: number,
): StatsNoticeFooterCenters {
  const primaryX = track.x + track.width - primaryHitWidth / 2;
  const secondaryX =
    primaryX - primaryHitWidth / 2 - STATS_NOTICE_LAYOUT.buttonGap - secondaryHitWidth / 2;
  return { secondaryX, primaryX };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * The Privacy section in the Settings scene's LEFT column, which is where new
 * rows land (the Gameplay column has been full at six rows since v34). The
 * numbers are design-space y positions in the same rhythm the rest of the
 * scene uses: a 20px section heading, a row 42px below it, and the caption 24px
 * under the row.
 */
export const STATS_SETTINGS_ROW = {
  /** Section heading baseline (origin 0, 0.5). */
  sectionTitleY: 576,
  /** The row's label and controls (origin 0, 0.5 / centred). */
  rowY: 618,
  /** TOP of the caption, which wraps to two lines. */
  noteTopY: 642,
  /** Wrap width for the caption, from `labelX` to `buttonRightX`. */
  noteWrapWidth: 460,
  labelX: 110,
  /** The left column's shared control track, shared with every other toggle. */
  toggleX: 420,
  /** Half of `theme.control.minHitWidth`; the toggle is at the 90px floor. */
  toggleHitHalfWidth: 45,
  /** The panel's right text inset, mirroring the 40px inset at the left. */
  buttonRightX: 570,
  /** Enough for the label at caption size plus the shared button padding. */
  buttonMinWidth: 96,
  /** Isolation space between two inflated hit rectangles. */
  minControlGap: 8,
} as const;

/**
 * Where the "What is sent" button's centre goes once its hit width is measured.
 *
 * Right-aligned to the panel's text inset, and pushed right if that would put
 * it within the isolation gap of the toggle. Measure-then-place: the label's
 * rendered width is font-fallback dependent on Windows (playbook trap), so the
 * scene measures the real button and asks this function where to put it.
 */
export function statsPanelButtonCenterX(hitWidth: number): number {
  const rightAligned = STATS_SETTINGS_ROW.buttonRightX - hitWidth / 2;
  const clearOfToggle =
    STATS_SETTINGS_ROW.toggleX +
    STATS_SETTINGS_ROW.toggleHitHalfWidth +
    STATS_SETTINGS_ROW.minControlGap +
    hitWidth / 2;
  return Math.max(rightAligned, clearOfToggle);
}

/**
 * The "What is sent" modal. Wider and taller than the game's other dialogs
 * because it lists 27 fields; still inside the 1280x720 design canvas and its
 * title-safe frame, which `modalShellLayout` reports on.
 */
export const STATS_PANEL_LAYOUT = {
  width: 1120,
  height: 632,
  columnCount: 3,
  columnGap: 24,
  /** Centre of the bullet dot, from the column's left edge. */
  bulletX: 5,
  bulletRadius: 2.5,
  /** Where a field line's text starts, from the column's left edge. */
  textIndent: 14,
  /** Heading to its first field line. */
  headingGap: 8,
  /** Between two field lines. */
  rowGap: 6,
  /** Between the major blocks (intro, columns, never-sent, footer). */
  blockGap: 18,
  /** Wheel/drag scroll step floor, so a short overflow still moves visibly. */
  scrollStep: 24,
  /**
   * The footer link's track. Wide enough for its label at the shared button's
   * medium size, so the footer line beside it never has to reflow.
   */
  footerLinkWidth: 224,
} as const;

export interface StatsPanelColumns {
  width: number;
  /** x offsets from the content bounds' left edge, one per column. */
  offsets: readonly number[];
}

/** Split the modal's content width into equal, gapped columns. */
export function statsPanelColumns(
  contentWidth: number,
  gap: number = STATS_PANEL_LAYOUT.columnGap,
  count: number = STATS_PANEL_LAYOUT.columnCount,
): StatsPanelColumns {
  const safeCount = Math.max(1, Math.floor(count));
  const width = Math.max(0, (contentWidth - gap * (safeCount - 1)) / safeCount);
  const offsets: number[] = [];
  for (let i = 0; i < safeCount; i++) offsets.push(i * (width + gap));
  return { width, offsets };
}

/** How far the panel's content may scroll. Zero when everything fits. */
export function statsPanelMaxScroll(contentHeight: number, viewportHeight: number): number {
  return Math.max(0, contentHeight - viewportHeight);
}
