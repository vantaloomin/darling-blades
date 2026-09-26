import { SCENE_TITLE } from './layout';
import { theme } from './theme';

/** Rendered heights of the label and caption sizes, for the header stack. */
const LABEL_LINE_HEIGHT = 18;
const CAPTION_LINE_HEIGHT = 16;

/**
 * The two lines under the builder's title: the rules line on the shared
 * subtitle band, and (Premium runs only) the note that the drafted cards
 * joined the collection, directly under it. The title sat above the
 * title-safe frame until 1.8.1 (2026-09-25); on the header line it pushes
 * these two lines, and the panels under them, 12px down.
 */
export const LIMITED_BUILDER_HEADER = {
  rulesTop: SCENE_TITLE.subtitleTop,
  premiumNoteTop: SCENE_TITLE.subtitleTop + LABEL_LINE_HEIGHT + theme.space(0.5),
} as const;

/**
 * The Limited deck builder's three panels (Pool, Deck, Details) share one row
 * that spans the title-safe frame edge to edge, with the major-region gap
 * between them, starting one grid step under the header lines. The row ran
 * from x 40 to 1240 until the 1.8 cut (2026-09-23), so the Pool list's rows
 * and pager and the Details text started or ended outside the frame.
 */
const COLUMN_GAP = theme.space(6);
const COLUMN_WIDTH = (theme.design.safeWidth - 2 * COLUMN_GAP) / 3;
const COLUMNS_TOP = LIMITED_BUILDER_HEADER.premiumNoteTop + CAPTION_LINE_HEIGHT + theme.space(2);

export const LIMITED_BUILDER_COLUMNS = {
  y: COLUMNS_TOP,
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
 * upward from it. Each is an offset from the panel's top, so the ledger moves
 * with the column row.
 */
const DETAILS_CONTENT_X = LIMITED_BUILDER_COLUMNS.detailsX + LIMITED_BUILDER_COLUMNS.inset;
const CURVE_BAR_WIDTH = 30;
const DETAILS_TOP = LIMITED_BUILDER_COLUMNS.y;

export const LIMITED_DETAILS_PANEL = {
  x: LIMITED_BUILDER_COLUMNS.detailsX,
  y: DETAILS_TOP,
  width: LIMITED_BUILDER_COLUMNS.width,
  height: LIMITED_BUILDER_COLUMNS.height,
  /** 18px gutter, matching the Pool and Deck panels. */
  contentX: DETAILS_CONTENT_X,
  contentRight: LIMITED_BUILDER_COLUMNS.detailsX + LIMITED_BUILDER_COLUMNS.width - LIMITED_BUILDER_COLUMNS.inset,
  wrapWidth: 330,
  headingY: DETAILS_TOP + 16,
  curve: {
    headingY: DETAILS_TOP + 48,
    firstX: DETAILS_CONTENT_X + CURVE_BAR_WIDTH / 2,
    pitch: 43,
    barWidth: CURVE_BAR_WIDTH,
    baseY: DETAILS_TOP + 116,
    maxHeight: 26,
    /** Count label sits this far above a bar's top; axis label this far below the baseline. */
    countGap: 8,
    axisGap: 9,
  },
  shapeLineY: DETAILS_TOP + 140,
  warchestY: DETAILS_TOP + 164,
  dualsY: DETAILS_TOP + 186,
  /** The selected-card readout, shown only while a card is selected. */
  selected: {
    nameY: DETAILS_TOP + 220,
    detailY: DETAILS_TOP + 276,
    flavorY: DETAILS_TOP + 334,
    /** Flavor is decorative and yields its space to the issue list below. */
    flavorMaxLines: 2,
  },
  issuesY: DETAILS_TOP + 384,
} as const;

/** Bottom edge of the panel, which nothing inside it may cross. */
export function limitedDetailsBottom(): number {
  return LIMITED_DETAILS_PANEL.y + LIMITED_DETAILS_PANEL.height;
}
