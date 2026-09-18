/**
 * The consent surfaces' copy and layout, with no Phaser in sight (rollout wave
 * T2, the UI half).
 *
 * Three things live here and nowhere else:
 *
 * 1. **Every player-facing string** the Settings row, the "What is sent" panel
 *    and the one-time notice show. The scenes render from these constants, so
 *    no sentence exists twice and a test can hold the wording against the
 *    privacy policy's.
 * 2. **The three field-description maps**, typed as `Record<HeartbeatField,
 *    string>` and friends. The type makes the key set equal the allowlist at
 *    compile time and `tests/ui/statsPrivacyPresentation.test.ts` proves it in
 *    both directions at runtime, so the panel cannot claim a field the code
 *    does not send, nor stay silent about one it does.
 * 3. **The layout numbers and the pure decisions** (which note the Settings row
 *    shows, whether the notice is owed, what order the stamp runs in), because
 *    tests never import Phaser.
 *
 * It deliberately does NOT import `src/net`: the gate is handed in as a
 * function (`statsRowNoteState`), so the rules stay in one place and
 * `src/net` keeps its short list of importers (tests/net/harnessTrap.test.ts).
 */

import type { CardsField, DuelField, HeartbeatField } from '../meta/playSignals';
import type { ToastNotice } from './toastQueue';

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
// The one-time notice
// ---------------------------------------------------------------------------

/** The copy gives the notice the same name the panel carries. */
export const STATS_NOTICE_TITLE = STATS_PANEL_TITLE;

export const STATS_NOTICE_BODY =
  'The game shares anonymous play stats to help improve it. No name, no account. You can turn this off in Settings.';

/** The toast's action line; tapping the card opens Settings. */
export const STATS_NOTICE_ACTION_LABEL = 'Settings';

/** The scene the notice's action starts. */
export const STATS_NOTICE_ACTION_SCENE = 'Settings';

/**
 * How long the notice holds, against the rail's 3200ms default. Two sentences
 * of body plus a title need more than a glance; the contract's floor is 8s.
 */
export const STATS_NOTICE_HOLD_MS = 9000;

/**
 * The notice, as a rail notice. `fitBody` grows the plaque to the measured
 * body (three wrapped lines do not fit the default 86px card), `neverCollapse`
 * keeps it out of a "several notices" summary, and `onShown` is what lets the
 * caller stamp only once the card actually exists on screen.
 */
export function statsNoticeToast(onShown: () => void): ToastNotice {
  return {
    title: STATS_NOTICE_TITLE,
    body: STATS_NOTICE_BODY,
    detail: STATS_NOTICE_ACTION_LABEL,
    action: { scene: STATS_NOTICE_ACTION_SCENE },
    holdMs: STATS_NOTICE_HOLD_MS,
    fitBody: true,
    neverCollapse: true,
    onShown,
  };
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

export type StatsNoticeDecision = 'show' | 'alreadySeen' | 'waitForClearScreen';

export interface StatsNoticeDecisionInput {
  /** `settings.statsNoticeVersion`. */
  savedVersion: number;
  /** `STATS_NOTICE_VERSION`. */
  currentVersion: number;
  /**
   * Nothing is over the menu: no tutorial prompt, no deck-repair notice, no
   * modal, no other overlay, and the rail can present right now.
   */
  screenClear: boolean;
}

/**
 * Whether the notice is owed on this visit. Pure, so the whole truth table is
 * a test rather than a playthrough. `waitForClearScreen` is not a refusal: the
 * notice is still owed and shows the next time the menu is clear, which is why
 * nothing is stamped in that case.
 */
export function statsNoticeDecision(input: StatsNoticeDecisionInput): StatsNoticeDecision {
  if (input.savedVersion >= input.currentVersion) return 'alreadySeen';
  return input.screenClear ? 'show' : 'waitForClearScreen';
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
