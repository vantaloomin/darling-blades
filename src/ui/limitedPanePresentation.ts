import type { TypeRole } from './accessibility';
import { SCENE_TITLE } from './layout';
import { theme } from './theme';

/**
 * How much taller one line of a role renders at the text size in force than
 * at 100%. Every vertical term below is its release (100%) value plus the
 * growth of the lines above it, so the release ledger is unchanged at 100%
 * and each line moves down by exactly what the lines over it gained. Until the
 * 1.9 accessibility pass the label and caption heights were the literals 18
 * and 16 (plan: `LABEL_LINE_HEIGHT` did not grow with the scale).
 */
export function limitedLineGrowth(role: TypeRole): number {
  // Rendered line boxes grow by more than the size step (Inter's line box is
  // about 1.2x its size, plus the rounding of both): 1.5px per pixel of type
  // keeps every measured line inside its share at 115% and 130%.
  return Math.ceil((theme.type[role] - theme.typeBase[role]) * 1.5);
}

/** Rendered heights of the label and caption lines (18 and 16 at 100%), for the header stack. */
const labelLineHeight = (): number => 18 + limitedLineGrowth('label');
const captionLineHeight = (): number => 16 + limitedLineGrowth('caption');

/**
 * The two lines under the builder's title: the rules line on the shared
 * subtitle band, and (Premium runs only) the note that the drafted cards
 * joined the collection, directly under it. The title sat above the
 * title-safe frame until 1.8.1 (2026-09-25); on the header line it pushes
 * these two lines, and the panels under them, 12px down. Live reads: the
 * note follows the rules line's height at the text size in force.
 */
export const LIMITED_BUILDER_HEADER = {
  rulesTop: SCENE_TITLE.subtitleTop,
  get premiumNoteTop(): number {
    return SCENE_TITLE.subtitleTop + labelLineHeight() + theme.space(0.5);
  },
};

/**
 * The Limited deck builder's three panels (Pool, Deck, Details) share one row
 * that spans the title-safe frame edge to edge, with the major-region gap
 * between them, starting one grid step under the header lines. The row ran
 * from x 40 to 1240 until the 1.8 cut (2026-09-23), so the Pool list's rows
 * and pager and the Details text started or ended outside the frame.
 *
 * The row's bottom is fixed one control gap above the footer's hit track
 * (628 at every size, 500px tall at 100%); taller header lines take their
 * height out of the panels, never out of the footer.
 */
const COLUMN_GAP = theme.space(6);
const COLUMN_WIDTH = (theme.design.safeWidth - 2 * COLUMN_GAP) / 3;
const COLUMNS_BOTTOM = theme.design.footerCenterY - theme.control.minHitHeight / 2 - theme.space(3);
const columnsTop = (): number => LIMITED_BUILDER_HEADER.premiumNoteTop + captionLineHeight() + theme.space(2);

export const LIMITED_BUILDER_COLUMNS = {
  get y(): number {
    return columnsTop();
  },
  get height(): number {
    return COLUMNS_BOTTOM - columnsTop();
  },
  width: COLUMN_WIDTH,
  gap: COLUMN_GAP,
  /** Content inset inside every panel. */
  inset: 18,
  poolX: theme.design.safeLeft,
  deckX: theme.design.safeLeft + COLUMN_WIDTH + COLUMN_GAP,
  detailsX: theme.design.safeLeft + 2 * (COLUMN_WIDTH + COLUMN_GAP),
};

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
 * The Pool and Deck lists' vertical ledger, as offsets from the panel top:
 * the h2 heading, then rows of one caption line centred in a plate, then the
 * pager centred 23px above the panel's bottom edge. At 100% the rows are 36px
 * plates on a 44px pitch from y+56 (9 per page), so each row's +/- target
 * gets the full hit height without reaching into its neighbour's: the
 * release list packed 13 rows at a 31px pitch and its 44px targets overlapped
 * by 13px (owner's call 2026-10-08: full targets over density). Larger text
 * grows the plates and pitch and lowers the first row under the taller
 * heading, and the page holds as many whole rows as fit above the pager.
 */
export function limitedListLayout(): {
  rowsTop: number;
  rowHeight: number;
  /** Vertical padding that centres the caption line on its plate. */
  textPadY: number;
  pitch: number;
  rows: number;
  pagerY: number;
} {
  const height = LIMITED_BUILDER_COLUMNS.height;
  const rowsTop = 56 + limitedLineGrowth('h2');
  const rowHeight = 36 + limitedLineGrowth('caption');
  const textPadY = Math.floor((rowHeight - captionLineHeight()) / 2);
  const pitch = Math.max(theme.control.minHitHeight, 44 + limitedLineGrowth('caption'));
  const pagerY = height - 23;
  // The pager's chevrons (h2 + 4px) reach about 18px above its centre at 100%.
  const listBottom = pagerY - 18 - limitedLineGrowth('h2') / 2;
  const rows = Math.max(1, Math.floor((listBottom - rowsTop + pitch - rowHeight) / pitch));
  return { rowsTop, rowHeight, textPadY, pitch, rows, pagerY };
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
 * upward from it. Each is its release offset from the panel's top plus the
 * growth of the lines above it, read live, so the ledger moves with the
 * column row and with the text size. The selected name's detail line and the
 * issue list follow the name's measured height in the scene; these are their
 * floors.
 */
const DETAILS_CONTENT_X = LIMITED_BUILDER_COLUMNS.detailsX + LIMITED_BUILDER_COLUMNS.inset;
const CURVE_BAR_WIDTH = 30;

function detailsLedger() {
  const top = LIMITED_BUILDER_COLUMNS.y;
  const g = limitedLineGrowth;
  // Running growth of the lines above each line, in reading order.
  const afterHeading = g('h2');
  const afterCurveHeading = afterHeading + g('label');
  const afterCounts = afterCurveHeading + g('micro');
  const afterAxis = afterCounts + g('micro');
  const afterShape = afterAxis + g('caption');
  const afterWarchest = afterShape + g('label');
  const afterDuals = afterWarchest + g('caption');
  return {
    x: LIMITED_BUILDER_COLUMNS.detailsX,
    y: top,
    width: LIMITED_BUILDER_COLUMNS.width,
    height: LIMITED_BUILDER_COLUMNS.height,
    /** 18px gutter, matching the Pool and Deck panels. */
    contentX: DETAILS_CONTENT_X,
    contentRight: LIMITED_BUILDER_COLUMNS.detailsX + LIMITED_BUILDER_COLUMNS.width - LIMITED_BUILDER_COLUMNS.inset,
    wrapWidth: 330,
    headingY: top + 16,
    curve: {
      headingY: top + 48 + afterHeading,
      firstX: DETAILS_CONTENT_X + CURVE_BAR_WIDTH / 2,
      pitch: 43,
      barWidth: CURVE_BAR_WIDTH,
      baseY: top + 116 + afterCounts,
      maxHeight: 26,
      /** Count label sits this far above a bar's top; axis label this far below the baseline. */
      countGap: 8 + g('micro') / 2,
      axisGap: 9 + g('micro') / 2,
    },
    shapeLineY: top + 140 + afterAxis,
    warchestY: top + 164 + afterShape,
    dualsY: top + 186 + afterWarchest,
    /** The selected-card readout, shown only while a card is selected. */
    selected: {
      nameY: top + 220 + afterDuals,
      detailY: top + 276 + afterDuals + 2 * g('h2'),
    },
    issuesY: top + 384 + afterDuals + 2 * g('h2') + g('label'),
  };
}

export const LIMITED_DETAILS_PANEL = {
  get x() { return detailsLedger().x; },
  get y() { return detailsLedger().y; },
  get width() { return detailsLedger().width; },
  get height() { return detailsLedger().height; },
  contentX: DETAILS_CONTENT_X,
  contentRight: LIMITED_BUILDER_COLUMNS.detailsX + LIMITED_BUILDER_COLUMNS.width - LIMITED_BUILDER_COLUMNS.inset,
  wrapWidth: 330,
  get headingY() { return detailsLedger().headingY; },
  get curve() { return detailsLedger().curve; },
  get shapeLineY() { return detailsLedger().shapeLineY; },
  get warchestY() { return detailsLedger().warchestY; },
  get dualsY() { return detailsLedger().dualsY; },
  get selected() { return detailsLedger().selected; },
  get issuesY() { return detailsLedger().issuesY; },
};

/** Bottom edge of the panel, which nothing inside it may cross. */
export function limitedDetailsBottom(): number {
  return LIMITED_DETAILS_PANEL.y + LIMITED_DETAILS_PANEL.height;
}
