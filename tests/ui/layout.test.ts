import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/rules';
import { theme } from '../../src/ui/theme';
import {
  COMPACT_TOUCH_GAP_RANGE,
  GAP_FLOORS,
  anchoredControlBounds,
  anchoredRect,
  clampScrollOffset,
  controlBounds,
  inactiveGap,
  isInsideTitleSafe,
  isRectContained,
  keywordGlossaryViewport,
  measureThemedButton,
  measureControlCluster,
  measuredRowsLayout,
  modalShellLayout,
  scrollOffsetByDelta,
  sceneHeaderFooterLayout,
} from '../../src/ui/layout';

describe('layout geometry', () => {
  it('derives the 90% title-safe frame from the design dimensions', () => {
    const { design } = theme;
    expect(design.safeLeft).toBe(design.width * 0.05);
    expect(design.safeTop).toBe(design.height * 0.05);
    expect(design.safeRight).toBe(design.width - design.safeLeft);
    expect(design.safeBottom).toBe(design.height - design.safeTop);
    expect(design.safeWidth).toBe(design.safeRight - design.safeLeft);
    expect(design.safeHeight).toBe(design.safeBottom - design.safeTop);
    expect(design.safeCenterX).toBe(design.safeLeft + design.safeWidth / 2);
    expect(design.safeCenterY).toBe(design.safeTop + design.safeHeight / 2);
    expect(design.safeCenterX).toBe(design.centerX);
    expect(design.safeCenterY).toBe(design.centerY);
    expect(design.headerCenterY).toBe(design.safeTop + theme.control.minHitHeight / 2);
    expect(design.footerCenterY).toBe(design.safeBottom - theme.control.minHitHeight / 2);
  });

  it('anchors rectangles to safe edges, corners, and centerlines', () => {
    expect(anchoredRect('top-left', 100, 40)).toEqual({ x: 64, y: 36, width: 100, height: 40 });
    expect(anchoredRect('top-center', 100, 40)).toEqual({ x: 590, y: 36, width: 100, height: 40 });
    expect(anchoredRect('bottom-right', 100, 40)).toEqual({ x: 1116, y: 644, width: 100, height: 40 });
    expect(anchoredRect('center', 100, 40, undefined, { x: 4, y: -4 })).toEqual({
      x: 594,
      y: 336,
      width: 100,
      height: 40,
    });
  });

  it('treats edge-touching rectangles as contained and rejects spillover', () => {
    const outer = { x: 10, y: 20, width: 100, height: 80 };
    expect(isRectContained({ x: 10, y: 20, width: 100, height: 80 }, outer)).toBe(true);
    expect(isRectContained({ x: 10, y: 20, width: 40, height: 80 }, outer)).toBe(true);
    expect(isRectContained({ x: 9, y: 20, width: 40, height: 40 }, outer)).toBe(false);
    expect(isRectContained({ x: 10, y: 20, width: 101, height: 40 }, outer)).toBe(false);
    expect(isInsideTitleSafe({ x: 64, y: 36, width: 1152, height: 648 })).toBe(true);
    expect(isInsideTitleSafe({ x: 63, y: 36, width: 100, height: 40 })).toBe(false);
    expect(isInsideTitleSafe({ x: 64, y: 684, width: 100, height: 1 })).toBe(false);
  });

  it('matches centered inflateHitArea semantics in design space', () => {
    const bounds = controlBounds({ x: 100, y: 200, width: 60, height: 30 }, {
      minHitWidth: 90,
      minHitHeight: 44,
    });
    expect(bounds.visual).toEqual({ x: 100, y: 200, width: 60, height: 30 });
    expect(bounds.hit).toEqual({ x: 85, y: 193, width: 90, height: 44 });
    expect(controlBounds({ x: 0, y: 0, width: 100, height: 50 }, {
      minHitWidth: 90,
      minHitHeight: 44,
    }).hit).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('predicts button visual and hit sizes, including relabel growth', () => {
    const short = measureThemedButton(40, 'md');
    expect(short.visual).toEqual({ x: -32, y: -20, width: 64, height: 40 });
    expect(short.hit).toEqual({ x: -45, y: -22, width: 90, height: 44 });
    expect(short.width).toBe(short.visual.width);
    expect(short.hitWidth).toBe(short.hit.width);

    const long = measureThemedButton(160, 'md');
    expect(long.visual.width).toBe(184);
    expect(long.hit.width).toBe(184);
    expect(long.visual.width).toBeGreaterThan(short.visual.width);

    const compact = measureThemedButton(50, 'sm', 90, 10);
    expect(compact.visual).toEqual({ x: -45, y: -15, width: 90, height: 30 });
    expect(compact.hit).toEqual({ x: -45, y: -22, width: 90, height: 44 });
  });

  it('keeps a safe-anchored control hit rect fully inside the title-safe frame', () => {
    const back = anchoredControlBounds('top-left', 70, 18);
    expect(back.hit).toEqual({ x: 64, y: 36, width: 90, height: 44 });
    expect(isInsideTitleSafe(back.hit)).toBe(true);
    expect(isInsideTitleSafe(back.visual)).toBe(true);
  });

  it('derives safe header/footer tracks and measured footer cluster gaps', () => {
    const layout = sceneHeaderFooterLayout({
      backVisual: { width: 70, height: 18 },
      titleVisual: { width: 200, height: 28 },
      currencyVisual: { width: 120, height: 20 },
      footerActionVisuals: [
        { width: 80, height: 40 },
        { width: 120, height: 40 },
      ],
    });
    expect(layout.headerTrack).toEqual({ x: 64, y: 36, width: 1152, height: 44 });
    expect(layout.footerTrack).toEqual({ x: 64, y: 640, width: 1152, height: 44 });
    expect(layout.back.hit).toEqual({ x: 64, y: 36, width: 90, height: 44 });
    expect(layout.currency.x + layout.currency.width).toBe(theme.design.safeRight);
    expect(layout.footerActions.map((action) => action.hit.y)).toEqual([640, 640]);
    expect(layout.footerActions.every((action) => action.hit.y + action.hit.height / 2 === theme.design.footerCenterY)).toBe(true);
    expect(inactiveGap(layout.footerActions[0].hit, layout.footerActions[1].hit).gap).toBe(8);
    expect(layout.tracksInsideTitleSafe).toBe(true);
    expect(layout.footerActions.every((action) => isInsideTitleSafe(action.hit))).toBe(true);
  });

  it('keeps modal title, close, content, and footer tracks contained and isolated', () => {
    for (const modal of [
      { width: 1080, height: 660 },
      { width: 600, height: 680 },
    ]) {
      const layout = modalShellLayout(modal);
      expect(layout.fits).toBe(true);
      expect(layout.tracksInsidePanel).toBe(true);
      expect(layout.tracksInsideTitleSafe).toBe(true);
      expect(isRectContained(layout.closeTrack, layout.panel)).toBe(true);
      expect(inactiveGap(layout.titleTrack, layout.closeTrack).intersects).toBe(false);
      expect(inactiveGap(layout.titleTrack, layout.closeTrack).gap).toBe(16);
      expect(inactiveGap(layout.titleTrack, layout.contentBounds).gap).toBe(16);
      expect(inactiveGap(layout.contentBounds, layout.footerTrack).gap).toBe(16);
    }
  });

  it('keeps the gauntlet recap grid clear of the 820x640 modal footer track', () => {
    // Mirrors DuelScene.showGauntletRunRecap's count-aware grid math; if the
    // scene formula changes, update this in lockstep. Pins the layout facts
    // the recap relies on, then proves the last portrait row (plus its label
    // block) ends above the footer track for the full rung ladder.
    const layout = modalShellLayout({ width: 820, height: 640 });
    expect(layout.footerTrack.y).toBe(612);
    expect(layout.contentBounds.y + layout.contentBounds.height).toBe(596);

    const rungCount = ECONOMY.gauntletRungGold.length;
    const gridTop = Math.max(layout.contentBounds.y, 206);
    const gridBottom = layout.contentBounds.y + layout.contentBounds.height;
    const rows = Math.ceil(rungCount / 6);
    const cols = Math.ceil(rungCount / rows);
    const xPitch = Math.min(132, layout.contentBounds.width / cols);
    const yPitch = Math.min(156, (gridBottom - gridTop) / rows);
    const cellScale = Math.min(1, xPitch / 132, yPitch / 156);
    const y0 = gridTop + (gridBottom - gridTop - rows * yPitch) / 2 + yPitch / 2;

    const portraitH = Math.round(112 * cellScale);
    const lastRowCenter = y0 + (rows - 1) * yPitch;
    // Label sits at portraitBottom + 8 and wraps to at most two 11px lines
    // (~30px with line spacing).
    const labelBottom = lastRowCenter + portraitH / 2 + 8 + 30;
    expect(labelBottom).toBeLessThan(layout.footerTrack.y);

    // The grid's left/right extents stay inside the content track.
    const x0 = theme.design.centerX - ((cols - 1) * xPitch) / 2;
    const halfCell = (92 * cellScale) / 2;
    expect(x0 - halfCell).toBeGreaterThanOrEqual(layout.contentBounds.x);
    expect(x0 + (cols - 1) * xPitch + halfCell).toBeLessThanOrEqual(
      layout.contentBounds.x + layout.contentBounds.width,
    );
  });

  it('reports signed axis gaps and the 82px-pitch overlap', () => {
    const first = { x: 0, y: 0, width: 90, height: 44 };
    const second = { x: 82, y: 0, width: 90, height: 44 };
    const overlap = inactiveGap(first, second);
    expect(overlap.x).toBe(-8);
    expect(overlap.gap).toBe(-8);
    expect(overlap.intersects).toBe(true);

    const separated = inactiveGap(first, { x: 98, y: 0, width: 90, height: 44 });
    expect(separated.x).toBe(8);
    expect(separated.gap).toBe(8);
    expect(separated.intersects).toBe(false);

    const vertical = inactiveGap(first, { x: 0, y: 56, width: 90, height: 44 });
    expect(vertical.y).toBe(12);
    expect(vertical.gap).toBe(12);
  });

  it('measures ordinary, compact-touch, and destructive cluster floors', () => {
    const ordinary = measureControlCluster([
      { id: 'one', visual: { x: 0, y: 0, width: 60, height: 30 } },
      { id: 'two', visual: { x: 98, y: 0, width: 60, height: 30 } },
    ]);
    expect(ordinary.pairs[0].gap.gap).toBe(GAP_FLOORS.ordinary);
    expect(ordinary.meetsFloor).toBe(true);

    const compact = measureControlCluster([
      { id: 'one', visual: { x: 0, y: 0, width: 60, height: 30 } },
      { id: 'two', visual: { x: 102, y: 0, width: 60, height: 30 } },
    ], 'compactTouch');
    expect(compact.pairs[0].gap.gap).toBe(COMPACT_TOUCH_GAP_RANGE.min);
    expect(compact.meetsFloor).toBe(true);
    expect(compact.withinCompactTouchRange).toBe(true);

    const destructive = measureControlCluster([
      { id: 'save', visual: { x: 0, y: 0, width: 60, height: 30 } },
      { id: 'delete', visual: { x: 114, y: 0, width: 60, height: 30 }, destructive: true },
    ]);
    expect(destructive.pairs[0].gap.gap).toBe(GAP_FLOORS.destructive);
    expect(destructive.pairs[0].requiredGap).toBe(GAP_FLOORS.destructive);
    expect(destructive.meetsFloor).toBe(true);

    const collision = measureControlCluster([
      { id: 'one', visual: { x: 0, y: 0, width: 60, height: 30 } },
      { id: 'two', visual: { x: 82, y: 0, width: 60, height: 30 } },
    ]);
    expect(collision.minimumGap).toBe(-8);
    expect(collision.meetsFloor).toBe(false);
  });

  it('lays out measured rows and scrolls only when content exceeds the cap', () => {
    const opts = {
      titleHeight: 20,
      horizontalPadding: 8,
      contentTopPadding: 4,
      contentBottomPadding: 4,
      rowGap: 6,
      rowPadding: 2,
      textGap: 3,
    };
    const entry = { primaryHeight: 10, secondaryHeight: 18 };
    const exact = measuredRowsLayout([entry, entry], 120, 104, opts);
    expect(exact.rows).toEqual([
      { x: 8, y: 24, width: 104, height: 35, primaryY: 26, secondaryY: 39 },
      { x: 8, y: 65, width: 104, height: 35, primaryY: 67, secondaryY: 80 },
    ]);
    expect(exact.contentHeight).toBe(76);
    expect(exact.totalHeight).toBe(104);
    expect(exact.overflow).toBe(false);
    expect(exact.maxScroll).toBe(0);

    const onePixelOver = measuredRowsLayout([entry, entry], 120, 103, opts);
    expect(onePixelOver.overflow).toBe(true);
    expect(onePixelOver.contentViewport.height).toBe(75);
    expect(onePixelOver.totalHeight).toBe(103);
    expect(onePixelOver.maxScroll).toBe(1);
    expect(scrollOffsetByDelta(0, 20, onePixelOver.maxScroll)).toBe(1);
    expect(clampScrollOffset(-4, onePixelOver.maxScroll)).toBe(0);
    expect(clampScrollOffset(99, onePixelOver.maxScroll)).toBe(1);
  });

  it('lets wrapped reminder measurements grow their row instead of clipping them', () => {
    const layout = measuredRowsLayout(
      [{ primaryHeight: 16, secondaryHeight: 48 }],
      170,
      200,
      { titleHeight: 24, horizontalPadding: 10, contentTopPadding: 8, contentBottomPadding: 8 },
    );
    expect(layout.rows[0].width).toBe(150);
    expect(layout.rows[0].height).toBe(76);
    expect(layout.rows[0].secondaryY).toBe(layout.rows[0].primaryY + 20);
    expect(layout.contentHeight).toBe(76);
    expect(layout.overflow).toBe(false);
  });

  it('keeps both real glossary hosts inside their reserved content bounds', () => {
    const compact = keywordGlossaryViewport(170);
    expect(compact).toEqual({ mode: 'compact', width: 170, hostTop: 156, hostBottom: 660, maxHeight: 504 });
    expect(compact.hostTop + compact.maxHeight).toBeLessThanOrEqual(compact.hostBottom);

    const regular = keywordGlossaryViewport(300);
    expect(regular).toEqual({ mode: 'regular', width: 300, hostTop: 150, hostBottom: 660, maxHeight: 510 });
    expect(regular.hostTop + regular.maxHeight).toBeLessThanOrEqual(regular.hostBottom);
  });

  it('caps dense glossary copy at both consumer widths and selects scroll', () => {
    const longRows = Array.from({ length: 7 }, () => ({ primaryHeight: 14, secondaryHeight: 48 }));
    const compact = keywordGlossaryViewport(170);
    const compactLayout = measuredRowsLayout(longRows, compact.width, compact.maxHeight, {
      titleHeight: 32,
      horizontalPadding: 10,
      contentTopPadding: 8,
      contentBottomPadding: 8,
      rowGap: 8,
      rowPadding: 4,
      textGap: 4,
    });
    expect(compactLayout.overflow).toBe(true);
    expect(compactLayout.totalHeight).toBe(compact.maxHeight);
    expect(compactLayout.maxScroll).toBeGreaterThan(0);

    const regular = keywordGlossaryViewport(300);
    const regularLayout = measuredRowsLayout(longRows, regular.width, regular.maxHeight, {
      titleHeight: 32,
      horizontalPadding: 14,
      contentTopPadding: 8,
      contentBottomPadding: 8,
      rowGap: 8,
      rowPadding: 4,
      textGap: 4,
    });
    expect(regularLayout.overflow).toBe(true);
    expect(regularLayout.totalHeight).toBe(regular.maxHeight);
    expect(regularLayout.maxScroll).toBeGreaterThan(0);
  });
});
