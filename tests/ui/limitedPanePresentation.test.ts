import { describe, expect, it } from 'vitest';
import { CURVE_MAX } from '../../src/ui/deckStats';
import { setAccessibility } from '../../src/ui/accessibility';
import { GAP_FLOORS, isInsideTitleSafe } from '../../src/ui/layout';
import {
  LIMITED_BUILDER_COLUMNS,
  LIMITED_BUILDER_HEADER,
  LIMITED_DETAILS_PANEL,
  limitedDetailsBottom,
  limitedListLayout,
} from '../../src/ui/limitedPanePresentation';
import { theme } from '../../src/ui/theme';
import { forEachA11yCell } from './a11yCells';

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

  it('budgets two lines for a long card name and keeps the readout above the issue list', () => {
    // Names wrap at h2 over 330px, so the detail line must clear two of them.
    expect(L.selected.detailY - L.selected.nameY).toBeGreaterThanOrEqual(2 * H.h2);
    // The one-line detail readout ends above the issue list.
    expect(L.issuesY).toBeGreaterThanOrEqual(L.selected.detailY + H.label);
  });

  it('leaves the issue list room for four lines inside the panel', () => {
    // Limited can report several issues at once (count, pool legality, reserve).
    expect(limitedDetailsBottom() - L.issuesY).toBeGreaterThanOrEqual(4 * (H.caption + 4));
  });

  it('insets its content symmetrically inside the panel', () => {
    expect(L.contentX).toBe(L.x + 18);
    expect(L.contentRight).toBe(L.x + L.width - 18);
  });
});

/**
 * The 1.9 accessibility pass moved every vertical term of the builder onto the
 * text-size resolver (plan: `LABEL_LINE_HEIGHT = 18` did not grow). Text is
 * not measured here (the rendered probe does that); these hold the ledger's
 * rules in every cell: inside the frame and the panel, the footer clear, and
 * each line's distance to the next at least its release distance plus the
 * pixels its own type role grew, so a larger line can never close the gap
 * under it.
 */
describe('Limited builder ledger at every text size', () => {
  const grew = (role: 'h2' | 'label' | 'caption' | 'micro'): number => theme.type[role] - theme.typeBase[role];
  const footerHitTop = theme.design.footerCenterY - theme.control.minHitHeight / 2;
  const release = (() => {
    setAccessibility({ textScale: 1, highContrast: false });
    const c = LIMITED_BUILDER_COLUMNS;
    const d = LIMITED_DETAILS_PANEL;
    return {
      header: { rules: LIMITED_BUILDER_HEADER.rulesTop, note: LIMITED_BUILDER_HEADER.premiumNoteTop, columns: c.y },
      list: limitedListLayout(),
      details: [d.headingY, d.curve.headingY, d.curve.baseY, d.shapeLineY, d.warchestY, d.dualsY, d.selected.nameY, d.issuesY],
    };
  })();

  it('keeps the header lines, the three panels and the footer apart in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      const H = LIMITED_BUILDER_HEADER;
      const c = LIMITED_BUILDER_COLUMNS;
      expect(H.premiumNoteTop - H.rulesTop, cell.name).toBeGreaterThanOrEqual(release.header.note - release.header.rules + grew('label'));
      expect(c.y - H.premiumNoteTop, cell.name).toBeGreaterThanOrEqual(release.header.columns - release.header.note + grew('caption'));
      for (const x of [c.poolX, c.deckX, c.detailsX]) {
        expect(isInsideTitleSafe({ x, y: c.y, width: c.width, height: c.height }), `${cell.name} panel at ${x}`).toBe(true);
      }
      expect(footerHitTop - (c.y + c.height), cell.name).toBeGreaterThanOrEqual(GAP_FLOORS.ordinary);
    });
  });

  it('keeps every list row whole, above the pager and inside its panel in every accessibility cell', () => {
    forEachA11yCell((cell) => {
      const c = LIMITED_BUILDER_COLUMNS;
      const list = limitedListLayout();
      expect(list.rows, cell.name).toBeGreaterThanOrEqual(1);
      // The caption line plus the plate's 5px padding above and below.
      expect(list.rowHeight - release.list.rowHeight, cell.name).toBeGreaterThanOrEqual(grew('caption'));
      expect(list.pitch - list.rowHeight, cell.name).toBeGreaterThanOrEqual(release.list.pitch - release.list.rowHeight);
      expect(list.rowsTop - release.list.rowsTop, cell.name).toBeGreaterThanOrEqual(grew('h2'));
      const lastRowBottom = list.rowsTop + (list.rows - 1) * list.pitch + list.rowHeight;
      // The pager's chevrons (h2 + 4px) are centred on pagerY.
      expect(list.pagerY - (theme.type.h2 + theme.space(1)) / 2 - lastRowBottom, cell.name).toBeGreaterThanOrEqual(GAP_FLOORS.ordinary);
      expect(list.pagerY + (theme.type.h2 + theme.space(1)) / 2, cell.name).toBeLessThanOrEqual(c.height);
    });
  });

  it('keeps the release list density at the standard size', () => {
    setAccessibility({ textScale: 1, highContrast: false });
    const list = limitedListLayout();
    expect({ rows: list.rows, pitch: list.pitch, top: LIMITED_BUILDER_COLUMNS.y + list.rowsTop }).toEqual({ rows: 13, pitch: 31, top: 184 });
  });

  it('stacks the Details ledger in reading order above the panel inset in every accessibility cell', () => {
    const roles = ['h2', 'label', 'micro', 'caption', 'label', 'caption'] as const;
    forEachA11yCell((cell) => {
      const d = LIMITED_DETAILS_PANEL;
      const now = [d.headingY, d.curve.headingY, d.curve.baseY, d.shapeLineY, d.warchestY, d.dualsY, d.selected.nameY, d.issuesY];
      for (let i = 0; i < roles.length; i++) {
        const lines = i === 1 ? grew('label') + grew('micro') : grew(roles[i]);
        expect(now[i + 1] - now[i] - (release.details[i + 1] - release.details[i]), `${cell.name} line ${i}`).toBeGreaterThanOrEqual(lines);
      }
      // Two wrapped issue lines (caption plus its 4px spacing) above the inset.
      expect(limitedDetailsBottom() - d.issuesY, cell.name).toBeGreaterThanOrEqual(2 * (theme.type.caption * 1.25 + 4));
      expect(d.curve.baseY - d.curve.maxHeight - d.curve.countGap - theme.type.micro, cell.name).toBeGreaterThanOrEqual(d.curve.headingY + theme.type.label);
    });
  });
});
