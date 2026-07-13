import { describe, expect, it } from 'vitest';
import {
  DROPDOWN_GEOMETRY,
  dropdownPopoverLayout,
  inactiveGap,
  isInsideTitleSafe,
  isRectContained,
  measureThemedButton,
  rectFromEdges,
  TITLE_SAFE_EDGES,
} from '../../src/ui/layout';

describe('dropdown geometry', () => {
  it('keeps rounded trigger sizing stable at the shared hit floors', () => {
    const short = measureThemedButton(52, 'sm', 96);
    const long = measureThemedButton(140, 'sm', 96);

    expect(short.visual).toEqual({ x: -48, y: -15, width: 96, height: 30 });
    expect(short.hit).toEqual({ x: -48, y: -22, width: 96, height: 44 });
    expect(long.visual.height).toBe(short.visual.height);
    expect(long.hit.height).toBe(short.hit.height);
    expect(long.visual.width).toBeGreaterThan(short.visual.width);
  });

  it('keeps option hit rows at 44px with an 8px inactive gap', () => {
    const layout = dropdownPopoverLayout(
      { x: 100, y: 100, width: 120, height: 44 },
      3,
      { panelWidth: 180 },
    );

    expect(layout.rowHitHeight).toBe(44);
    expect(layout.rowPitch).toBe(52);
    expect(layout.rowGap).toBe(8);
    expect(inactiveGap(layout.rows[0], layout.rows[1]).gap).toBe(8);
    expect(inactiveGap(layout.rows[1], layout.rows[2]).gap).toBe(8);
    expect(isRectContained(layout.rows[0], layout.panel)).toBe(true);
    expect(isRectContained(layout.rows[2], layout.panel)).toBe(true);
  });

  it('opens down in the normal case and preserves the selected geometry constants', () => {
    const layout = dropdownPopoverLayout(
      { x: 100, y: 100, width: 120, height: 44 },
      2,
      { panelWidth: 180 },
    );

    expect(layout.direction).toBe('down');
    expect(layout.panel).toEqual({ x: 100, y: 148, width: 180, height: 120 });
    expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(TITLE_SAFE_EDGES.bottom);
    expect(DROPDOWN_GEOMETRY.clampMargin).toBe(0);
  });

  it('clamps a right-edge panel exactly to safe right 1216', () => {
    const layout = dropdownPopoverLayout(
      { x: 1216, y: 100, width: 90, height: 44 },
      2,
      { panelWidth: 200 },
    );

    expect(layout.panel.x).toBe(1016);
    expect(layout.panel.x + layout.panel.width).toBe(1216);
    expect(isInsideTitleSafe(layout.panel)).toBe(true);
  });

  it('flips upward when opening down would cross safe bottom 684', () => {
    const layout = dropdownPopoverLayout(
      { x: 100, y: 640, width: 120, height: 44 },
      2,
      { panelWidth: 180 },
    );

    expect(layout.direction).toBe('up');
    expect(layout.panel).toEqual({ x: 100, y: 516, width: 180, height: 120 });
    expect(layout.panel.y + layout.panel.height).toBe(636);
    expect(isInsideTitleSafe(layout.panel)).toBe(true);
  });

  it('keeps the exact safe-bottom boundary opening downward', () => {
    const layout = dropdownPopoverLayout(
      { x: 100, y: 568, width: 120, height: 44 },
      1,
      { panelWidth: 180 },
    );

    expect(layout.direction).toBe('down');
    expect(layout.panel.y + layout.panel.height).toBe(684);
    expect(isRectContained(layout.panel, rectFromEdges(TITLE_SAFE_EDGES))).toBe(true);
  });
});
