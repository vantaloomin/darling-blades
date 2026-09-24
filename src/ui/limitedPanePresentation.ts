import { theme } from './theme';

/**
 * The Limited deck builder's three panels (Pool, Deck, Details) share one row
 * that spans the title-safe frame edge to edge, with the major-region gap
 * between them. The row ran from x 40 to 1240 until the 1.8 cut (2026-09-23),
 * so the Pool list's rows and pager and the Details text started or ended
 * outside the frame.
 */
const COLUMN_GAP = theme.space(6);
const COLUMN_WIDTH = (theme.design.safeWidth - 2 * COLUMN_GAP) / 3;

export const LIMITED_BUILDER_COLUMNS = {
  y: 116,
  height: 500,
  width: COLUMN_WIDTH,
  gap: COLUMN_GAP,
  /** Content inset inside every panel. */
  inset: 18,
  poolX: theme.design.safeLeft,
  deckX: theme.design.safeLeft + COLUMN_WIDTH + COLUMN_GAP,
  detailsX: theme.design.safeLeft + 2 * (COLUMN_WIDTH + COLUMN_GAP),
} as const;

/** The +/- action's visual width on a Pool or Deck row. */
const ROW_ACTION_WIDTH = 39;
/** Between a row's plate and its action button. */
const ROW_ACTION_GAP = theme.space(2);

/**
 * One Pool or Deck list row inside a panel whose left edge is `panelX`: the
 * name plate starts at the content inset and the action button's visual box
 * ends on the panel's inner edge, so the row fills the panel without leaving it.
 */
export function limitedListRow(panelX: number): {
  plateX: number;
  plateWidth: number;
  actionX: number;
  actionWidth: number;
} {
  const { inset, width } = LIMITED_BUILDER_COLUMNS;
  const plateX = panelX + inset;
  const actionX = panelX + width - inset - ROW_ACTION_WIDTH / 2;
  return {
    plateX,
    plateWidth: actionX - ROW_ACTION_WIDTH / 2 - ROW_ACTION_GAP - plateX,
    actionX,
    actionWidth: ROW_ACTION_WIDTH,
  };
}

/**
 * Phaser-free geometry for the Limited (draft) deck builder's Details panel.
 *
 * The panel is the only place a draft deck can be read as a whole, and until
 * 2026-08-25 it had no mana curve at all: the one chart you actually build a
 * limited deck by was missing from the one builder that most needs it (your
 * pool is fixed, so the curve is the decision). Fitting it meant a real
 * ledger rather than the ad-hoc offsets the panel grew, one of which had the
 * selected card's name overlapping the Warchest duals line whenever a card
 * was selected.
 *
 * Every y here is the TOP of its text (the scene's text helpers use Phaser's
 * default top-left origin); `curve.baseY` is the bar baseline, and bars grow
 * upward from it.
 */
const DETAILS_CONTENT_X = LIMITED_BUILDER_COLUMNS.detailsX + LIMITED_BUILDER_COLUMNS.inset;
const CURVE_BAR_WIDTH = 30;

export const LIMITED_DETAILS_PANEL = {
  x: LIMITED_BUILDER_COLUMNS.detailsX,
  y: LIMITED_BUILDER_COLUMNS.y,
  width: LIMITED_BUILDER_COLUMNS.width,
  height: LIMITED_BUILDER_COLUMNS.height,
  /** 18px gutter, matching the Pool and Deck panels. */
  contentX: DETAILS_CONTENT_X,
  contentRight: LIMITED_BUILDER_COLUMNS.detailsX + LIMITED_BUILDER_COLUMNS.width - LIMITED_BUILDER_COLUMNS.inset,
  wrapWidth: 330,
  headingY: 132,
  curve: {
    headingY: 164,
    firstX: DETAILS_CONTENT_X + CURVE_BAR_WIDTH / 2,
    pitch: 43,
    barWidth: CURVE_BAR_WIDTH,
    baseY: 232,
    maxHeight: 26,
    /** Count label sits this far above a bar's top; axis label this far below the baseline. */
    countGap: 8,
    axisGap: 9,
  },
  shapeLineY: 256,
  warchestY: 280,
  dualsY: 302,
  /** The selected-card readout, shown only while a card is selected. */
  selected: {
    nameY: 336,
    detailY: 392,
    flavorY: 450,
    /** Flavor is decorative and yields its space to the issue list below. */
    flavorMaxLines: 2,
  },
  issuesY: 500,
} as const;

/** Bottom edge of the panel, which nothing inside it may cross. */
export function limitedDetailsBottom(): number {
  return LIMITED_DETAILS_PANEL.y + LIMITED_DETAILS_PANEL.height;
}
