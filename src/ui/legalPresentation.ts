/**
 * The Legal panel's copy and layout, with no Phaser in sight.
 *
 * Three documents ship as pages in the same build as the client
 * (`scripts/gen-legal-pages.ts` writes them into `public/`), so the game can
 * link them without a network: the privacy policy, the terms, and the notices.
 * This module owns the only list of them on the client side, so the Settings
 * header control, the panel's rows and any future surface all read the same
 * three entries and the same three hrefs.
 *
 * The privacy href is NOT restated here. It is imported from
 * `statsPrivacyPresentation.ts`, which the "What is sent" panel already links,
 * so the two surfaces cannot come to disagree about where the policy lives.
 *
 * Player copy rule (docs/design-system.md, Content voice): plain sentences, no
 * em-dashes or en-dashes, short labels. `tests/ui/legalPresentation.test.ts`
 * holds every string in this file to it.
 */

import { STATS_PRIVACY_LINK_HREF } from './statsPrivacyPresentation';
import { theme } from './theme';

// ---------------------------------------------------------------------------
// The three documents
// ---------------------------------------------------------------------------

export interface LegalEntry {
  /** The row's title, and the name the player is looking for. */
  label: string;
  /** Relative on purpose: the Pages site and the desktop bundle both resolve it. */
  href: string;
  /** One line of what the page is, so a row is worth opening or skipping. */
  summary: string;
}

/**
 * In the order a player meets them: what the game does with their data, then
 * what they agreed to by playing, then whose work is in it.
 */
export const LEGAL_ENTRIES: readonly LegalEntry[] = [
  {
    label: 'Privacy policy',
    href: STATS_PRIVACY_LINK_HREF,
    summary: 'What leaves your device, and what never does.',
  },
  {
    label: 'Terms of service',
    href: './terms.html',
    summary: 'The agreement between you and us.',
  },
  {
    label: 'Notices',
    href: './notices.html',
    summary: 'Trademarks, art, and open-source licenses.',
  },
] as const;

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** The Settings header control. One word, because it sits beside a longer one. */
export const LEGAL_BUTTON_LABEL = 'Legal';

/** The panel's title, which is the control's own word again. */
export const LEGAL_PANEL_TITLE = LEGAL_BUTTON_LABEL;

/** The per-row control. The row's title already says what is being read. */
export const LEGAL_READ_LABEL = 'Read';

/** Every string a player reads on these two surfaces, for the copy-rule test. */
export const LEGAL_PLAYER_COPY: readonly string[] = [
  LEGAL_BUTTON_LABEL,
  LEGAL_PANEL_TITLE,
  LEGAL_READ_LABEL,
  ...LEGAL_ENTRIES.flatMap((entry) => [entry.label, entry.summary]),
];

// ---------------------------------------------------------------------------
// The panel's layout
// ---------------------------------------------------------------------------

/**
 * Three rows of two lines each, so the panel is deliberately smaller than the
 * "What is sent" panel it sits beside: that one is a disclosure to read, this
 * one is a menu to leave from. Well inside the 1280x720 design canvas and its
 * title-safe frame, which `modalShellLayout` reports on.
 */
export const LEGAL_PANEL_LAYOUT = {
  width: 640,
  /** Sized for the roomy case (every summary wrapped to two lines under a
   *  Windows font fallback); on the shipped fonts the lower third is slack. */
  height: 420,
  /** Matches the "What is sent" panel, which can open from the same screen. */
  dimAlpha: 0.62,
  /** The row's minimum band, at the touch-target floor. */
  rowHeight: theme.control.minHitHeight,
  /** Between two rows: the design system's between-groups space. */
  rowGap: theme.space(6),
  /** A row's title to its summary line. */
  summaryGap: theme.space(2),
  /** Isolation space between the text column and the Read button's hit box. */
  minControlGap: theme.space(2),
  /** Enough for the label at the shared button's medium size. */
  readMinWidth: 110,
} as const;

export interface LegalRowMeasured {
  /** Rendered height of the row's title. */
  label: number;
  /** Rendered height of the row's summary line, which may wrap. */
  summary: number;
}

export interface LegalRowPlacement {
  /** TOP of the title, local to the shell's content rect. */
  labelY: number;
  /** TOP of the summary line. */
  summaryY: number;
  /** Vertical centre of the whole row band, where the Read button sits. */
  readCenterY: number;
  /** Lowest offset this row reaches. */
  bottom: number;
}

export interface LegalRowStack {
  rows: readonly LegalRowPlacement[];
  /** Total height of the stack, for the fits-the-content-rect assertion. */
  height: number;
}

/**
 * Stack the rows from the MEASURED text heights rather than from a fixed pitch:
 * glyph widths (and so wrap counts) are font-fallback dependent on Windows,
 * which is the playbook's measure-then-place trap. A row never gets less than
 * the touch-target band, so the Read button beside it always has its floor.
 */
export function legalRowStack(measured: readonly LegalRowMeasured[]): LegalRowStack {
  const rows: LegalRowPlacement[] = [];
  let cursor = 0;
  for (const row of measured) {
    const summaryY = cursor + row.label + LEGAL_PANEL_LAYOUT.summaryGap;
    const bottom = Math.max(summaryY + row.summary, cursor + LEGAL_PANEL_LAYOUT.rowHeight);
    rows.push({
      labelY: cursor,
      summaryY,
      readCenterY: (cursor + bottom) / 2,
      bottom,
    });
    cursor = bottom + LEGAL_PANEL_LAYOUT.rowGap;
  }
  const height = rows.length === 0 ? 0 : rows[rows.length - 1].bottom;
  return { rows, height };
}

/** The Read button, right-aligned to the content rect's right edge. */
export function legalReadCenterX(contentRight: number, hitWidth: number): number {
  return contentRight - hitWidth / 2;
}

/** How wide a row's text may wrap before it reaches the Read button's hit box. */
export function legalTextWrapWidth(contentWidth: number, readHitWidth: number): number {
  return Math.max(0, contentWidth - readHitWidth - LEGAL_PANEL_LAYOUT.minControlGap);
}
