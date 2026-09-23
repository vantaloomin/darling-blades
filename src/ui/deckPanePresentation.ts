/** Phaser-free state and geometry for the Deck Builder's right-pane views. */

import { theme } from './theme';

/**
 * `style` joined in v33, when card back and playmat became per-deck. It is a
 * third VIEW rather than a new chrome row because the pane is 360px wide and
 * both existing rows are full: the CTA row has no gap at all, and the View row
 * leaves ~54px, under the 90px hit-width floor.
 */
export type DeckPaneMode = 'cards' | 'warchest' | 'style';

export interface DeckPaneToggleState {
  mode: DeckPaneMode;
  cardsSelected: boolean;
  warchestSelected: boolean;
  styleSelected: boolean;
  warchestWarning: boolean;
  warchestLabel: 'Warchest' | 'Warchest ⚠';
}

/**
 * The pane's content column is 360px wide and its right edge sits on the
 * title-safe frame's right edge; every x below is measured from one of its two
 * edges. It spanned 900-1260 until the 1.8 cut (2026-09-23), which put the
 * View toggle, the Warchest slots, the count chips, the Decks button, and the
 * Import button past the frame.
 */
const PANE_WIDTH = 360;
const PANE_RIGHT = theme.design.safeRight;
const PANE_LEFT = PANE_RIGHT - PANE_WIDTH;

/**
 * The bottom summary stack (design-system "Spacing and grouping" tiers).
 * It must hold pager, curve, one merged summary line, a two-line status band,
 * and the CTA row; the ledger the test pins is
 * pager band | 12 | stats block | 16 | status | 8 | CTAs. The two old
 * summary lines merged into one so the status band never overlaps the
 * block above it (it could before 2026-08-18).
 *
 * The whole stack lifted 24px on 2026-08-25 to buy the status band its
 * second line back WITH the stats on screen. Before that lift a blocking
 * deck error had nowhere to go but a panel drawn OVER the curve, so a deck
 * one card short of legal showed no curve and no color balance at all
 * (player report). The error is a status line now, and the curve never
 * leaves.
 *
 * The CTA row sits on the shared footer line (theme.design.footerCenterY).
 * It was centred on y 684 until the 1.8 cut (2026-09-23), so its hit boxes ran
 * to 706, past the title-safe frame; the stack above closed its spare gaps to
 * the tier minimums and the pager rose 6px to make the room.
 */
const SUMMARY = {
  pagerY: 462,
  statsHeadingY: 504,
  barBaseY: 552,
  barMaxHeight: 24,
  summaryLineY: 576,
  statusBottomY: 632,
  /** Two lines in every view: the status band is the only error surface. */
  statusMaxLines: 2,
  ctaY: theme.design.footerCenterY,
} as const;

/** One status-band line, for the band's height budget. */
export const DECK_STATUS_LINE_HEIGHT = 16;

export const DECK_PANE_LAYOUT = {
  /** The side panel's fill: one 20px gutter left of the content, to the screen edge. */
  panelX: PANE_LEFT - 20,
  left: PANE_LEFT,
  right: PANE_RIGHT,
  toggle: {
    labelX: PANE_LEFT,
    /** Three views share the row since v33; 84px slots keep them inside the pane. */
    cardsX: PANE_LEFT + 100,
    warchestX: PANE_LEFT + 192,
    styleX: PANE_LEFT + 284,
    y: 112,
    minWidth: 84,
  },
  content: {
    top: 148,
    /** The Warchest panel ends one gap above the status band's top line. */
    bottom: SUMMARY.statusBottomY - DECK_STATUS_LINE_HEIGHT * SUMMARY.statusMaxLines - theme.space(3),
  },
  warchest: {
    headingY: 170,
    countY: 194,
    validationY: 218,
    slotFirstX: PANE_LEFT + 92,
    slotFirstY: 266,
    slotPitchX: 176,
    slotPitchY: 47,
    slotColumns: 2,
    slotWidth: 168,
    slotLabelWidth: 150,
    rulesTop: 490,
    rulesWidth: 336,
  },
  /**
   * Desktop card rows. The name column ends clear of the right-aligned count
   * chip (countRightX is the chip's RIGHT edge; countReserve is the widest
   * chip plus its gap), so a long legend name ellipsizes instead of running
   * under the count - the enforced-isolation test pins that clearance.
   */
  cards: {
    rowPitch: 28,
    starX: PANE_LEFT,
    pinX: PANE_LEFT + 24,
    nameX: PANE_LEFT + 44,
    nameWidth: 250,
    countRightX: PANE_RIGHT - 16,
    countReserve: 46,
    /** Row iconography (hero star / display pin), sized for the 28px pitch. */
    starSize: 20,
    pinSize: 14,
  },
  /**
   * The Format conversion row (Warchest / Darlings). Tabs sit left of the
   * Decks CTA's column: Decks is right-aligned to the pane on the y 32 row,
   * and its inflated hit band reaches down toward y 54, so nothing
   * interactive may share both its column and the adjacent band - the tab
   * row keeps every tab's right edge clear of Decks' hit column (pinned by
   * test).
   */
  formatRow: {
    labelX: PANE_LEFT,
    y: 64,
    tabFirstX: PANE_LEFT + 90,
    tabPitch: 90,
    tabMinWidth: 78,
    decksHitLeft: PANE_RIGHT - 100,
  },
  /** The deck picker's '☰ Decks' button, right-aligned to the pane on the title row. */
  decks: { x: PANE_RIGHT - 45, minWidth: 90 },
  /**
   * The bottom action row: Export left-aligned to the pane's left edge, Import
   * right-aligned to its right edge, Save centred between them, all on
   * `summary.ctaY`.
   */
  cta: {
    exportX: PANE_LEFT + 52,
    saveX: PANE_LEFT + 180,
    importX: PANE_RIGHT - 52,
    sideMinWidth: 104,
    saveMinWidth: 140,
  },
  /** The mana curve stretches the full pane width (owner, 2026-08-18). */
  curve: {
    firstX: PANE_LEFT + 21,
    pitch: 43,
    barWidth: 30,
  },
  summary: SUMMARY,
} as const;

/**
 * The View row inherits the format switch's band (y 64) when that switch is
 * hidden (single-format decks render no dead tab), and everything below rides
 * the same shift so the pane has no empty band above the toggle.
 */
export function deckPaneOffsetY(formatSwitchVisible: boolean): number {
  return formatSwitchVisible ? 0 : DECK_PANE_LAYOUT.toggle.y - 64;
}

export function defaultDeckPaneMode(): DeckPaneMode {
  return 'cards';
}

export function toggleDeckPaneMode(mode: DeckPaneMode): DeckPaneMode {
  return mode === 'cards' ? 'warchest' : 'cards';
}

/**
 * Constructed has no Warchest view, so stale state is coerced safely. Style is
 * available in every format: a deck has a look whether or not it has a reserve.
 */
export function resolveDeckPaneMode(mode: DeckPaneMode, hasWarchest: boolean): DeckPaneMode {
  if (mode === 'style') return 'style';
  return hasWarchest ? mode : 'cards';
}

export function deckPaneToggleState(
  mode: DeckPaneMode,
  reserveIssueCount: number,
): DeckPaneToggleState {
  const warchestWarning = reserveIssueCount > 0;
  return {
    mode,
    cardsSelected: mode === 'cards',
    warchestSelected: mode === 'warchest',
    styleSelected: mode === 'style',
    warchestWarning,
    warchestLabel: warchestWarning ? 'Warchest ⚠' : 'Warchest',
  };
}

export function warchestSlotPosition(index: number): { x: number; y: number } {
  const slot = DECK_PANE_LAYOUT.warchest;
  return {
    x: slot.slotFirstX + (index % slot.slotColumns) * slot.slotPitchX,
    y: slot.slotFirstY + Math.floor(index / slot.slotColumns) * slot.slotPitchY,
  };
}

export function warchestSlotLabel(index: number, name: string): string {
  return `${index + 1}. ${name}`;
}

export type DeckStatusTone = 'success' | 'danger';

/** A one-off builder message (a refused import, a copied code) and how it reads. */
export interface DeckStatusMessage {
  text: string;
  tone: DeckStatusTone;
}

/**
 * The status band is one Text in one colour. A failure message never takes the
 * success colour (a rejected import on a legal deck used to read green), and a
 * blocking deck issue keeps the band red whatever message sits above it. With
 * neither, a message reads as success; warnings alone keep the band's red.
 */
export function deckStatusTone(message: DeckStatusMessage | null, hasBlockingIssue: boolean): DeckStatusTone {
  if (hasBlockingIssue || message?.tone === 'danger') return 'danger';
  return message ? 'success' : 'danger';
}
