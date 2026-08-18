/** Phaser-free state and geometry for the Deck Builder's right-pane views. */

export type DeckPaneMode = 'cards' | 'warchest';

export interface DeckPaneToggleState {
  mode: DeckPaneMode;
  cardsSelected: boolean;
  warchestSelected: boolean;
  warchestWarning: boolean;
  warchestLabel: 'Warchest' | 'Warchest ⚠';
}

export const DECK_PANE_LAYOUT = {
  left: 900,
  right: 1260,
  toggle: {
    labelX: 900,
    cardsX: 1052,
    warchestX: 1182,
    y: 112,
    minWidth: 116,
  },
  content: {
    top: 148,
    bottom: 616,
  },
  warchest: {
    headingY: 170,
    countY: 194,
    validationY: 218,
    slotFirstX: 992,
    slotFirstY: 266,
    slotPitchX: 176,
    slotPitchY: 47,
    slotColumns: 2,
    slotWidth: 168,
    slotLabelWidth: 150,
    rulesTop: 510,
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
    starX: 900,
    pinX: 924,
    nameX: 944,
    nameWidth: 250,
    countRightX: 1244,
    countReserve: 46,
    /** Row iconography (hero star / display pin), sized for the 28px pitch. */
    starSize: 20,
    pinSize: 14,
  },
  /**
   * The bottom summary stack (design-system "Spacing and grouping" tiers).
   * 192px must hold pager, curve, one merged summary line, a one-line status
   * band, and the CTA row; the ledger the test pins is
   * pager band | 12 | stats block | 21 | status | 10 | CTAs. The two old
   * summary lines merged into one so the status band never overlaps the
   * block above it (it could before 2026-08-18).
   */
  summary: {
    pagerY: 492,
    statsHeadingY: 534,
    barBaseY: 584,
    barMaxHeight: 24,
    summaryLineY: 616,
    statusBottomY: 660,
    statusMaxLinesWithStats: 1,
    ctaY: 684,
  },
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

/** Constructed has no Warchest view, so stale state is coerced safely. */
export function resolveDeckPaneMode(mode: DeckPaneMode, hasWarchest: boolean): DeckPaneMode {
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
