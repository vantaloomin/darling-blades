import { describe, expect, it } from 'vitest';
import { CURVE_MAX } from '../../src/ui/deckStats';
import { LIMITED_DETAILS_PANEL, limitedDetailsBottom } from '../../src/ui/limitedPanePresentation';

const L = LIMITED_DETAILS_PANEL;
/** Rendered heights of the type scale, measured for isolation arithmetic. */
const H = { h2: 26, label: 18, caption: 16, micro: 14 } as const;

describe('Limited details panel', () => {
  it('fits eight curve bars inside the panel gutters', () => {
    const c = L.curve;
    expect(c.firstX - c.barWidth / 2).toBeGreaterThanOrEqual(L.contentX);
    const lastX = c.firstX + CURVE_MAX * c.pitch;
    expect(lastX + c.barWidth / 2).toBeLessThanOrEqual(L.contentRight);
    // Genuinely full width rather than a stub chart hugging the left gutter.
    expect(CURVE_MAX * c.pitch + c.barWidth).toBeGreaterThanOrEqual(
      (L.contentRight - L.contentX) * 0.9,
    );
    // Bars never touch: the pitch clears the bar width.
    expect(c.pitch).toBeGreaterThan(c.barWidth);
  });

  it('stacks the whole panel without a single overlap', () => {
    const c = L.curve;
    // heading -> curve heading
    expect(c.headingY).toBeGreaterThanOrEqual(L.headingY + H.h2);
    // curve heading -> the tallest bar's count label
    const countLabelTop = c.baseY - c.maxHeight - c.countGap - H.micro / 2;
    expect(countLabelTop).toBeGreaterThanOrEqual(c.headingY + H.label);
    // axis labels -> shape line
    const axisBottom = c.baseY + c.axisGap + H.micro / 2;
    expect(L.shapeLineY).toBeGreaterThanOrEqual(axisBottom);
    // shape -> Warchest -> duals
    expect(L.warchestY).toBeGreaterThanOrEqual(L.shapeLineY + H.caption);
    expect(L.dualsY).toBeGreaterThanOrEqual(L.warchestY + H.label);
    // duals -> the selected card's name. This is the one that was WRONG before
    // 2026-08-25: the name was drawn at y+92 and the duals line at y+100, so
    // selecting a card put its name straight through the duals text.
    expect(L.selected.nameY).toBeGreaterThanOrEqual(L.dualsY + H.caption);
  });

  it('budgets two lines for a long card name and caps the flavor', () => {
    // Names wrap at h2 over 330px, so the detail line must clear two of them.
    expect(L.selected.detailY - L.selected.nameY).toBeGreaterThanOrEqual(2 * H.h2);
    expect(L.selected.flavorY).toBeGreaterThanOrEqual(L.selected.detailY + H.label);
    // Flavor is capped so it can never push the issue list off the panel.
    expect(L.selected.flavorMaxLines).toBeLessThanOrEqual(2);
    const flavorBottom = L.selected.flavorY + L.selected.flavorMaxLines * H.label;
    expect(L.issuesY).toBeGreaterThanOrEqual(flavorBottom);
  });

  it('leaves the issue list room for four lines inside the panel', () => {
    // Limited can report several issues at once (count, pool legality, reserve).
    expect(limitedDetailsBottom() - L.issuesY).toBeGreaterThanOrEqual(4 * (H.caption + 4));
  });

  it('keeps the panel where the Pool and Deck panels put it', () => {
    // The three panels share one band; a lone drifting panel reads as a bug.
    expect(L.y).toBe(116);
    expect(L.height).toBe(500);
    expect(L.contentX).toBe(L.x + 18);
    expect(L.contentRight).toBe(L.x + L.width - 18);
  });
});
