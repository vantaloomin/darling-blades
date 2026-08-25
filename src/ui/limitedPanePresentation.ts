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
export const LIMITED_DETAILS_PANEL = {
  x: 858,
  y: 116,
  width: 382,
  height: 500,
  /** 18px gutter, matching the Pool and Deck panels. */
  contentX: 876,
  contentRight: 1222,
  wrapWidth: 330,
  headingY: 132,
  curve: {
    headingY: 164,
    firstX: 891,
    pitch: 45,
    barWidth: 30,
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
