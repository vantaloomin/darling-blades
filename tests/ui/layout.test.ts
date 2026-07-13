import { describe, expect, it } from 'vitest';
import { theme } from '../../src/ui/theme';
import {
  COMPACT_TOUCH_GAP_RANGE,
  GAP_FLOORS,
  anchoredRect,
  controlBounds,
  inactiveGap,
  isInsideTitleSafe,
  isRectContained,
  measureControlCluster,
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
});
