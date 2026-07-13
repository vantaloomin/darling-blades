/**
 * Phaser-free layout primitives for the design-system alignment waves.
 *
 * Rectangles use design-space top-left coordinates. Hit inflation is performed
 * in world/design space and is intentionally centered, matching
 * platform/gestures.ts for an unscaled object.
 */

import { theme } from './theme';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RectEdges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

export type RectAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type HitFloors = Pick<typeof theme.control, 'minHitWidth' | 'minHitHeight'>;

export interface ControlBounds {
  visual: Rect;
  hit: Rect;
}

export const GAP_FLOORS = {
  ordinary: 8,
  compactTouch: 12,
  destructive: 24,
} as const;

export const COMPACT_TOUCH_GAP_RANGE = {
  min: 12,
  max: 16,
} as const;

export const TITLE_SAFE_EDGES: RectEdges = {
  left: theme.design.titleSafe.left,
  right: theme.design.titleSafe.right,
  top: theme.design.titleSafe.top,
  bottom: theme.design.titleSafe.bottom,
};

/** Turn an edge frame into the rectangle it encloses. */
export function rectFromEdges(edges: RectEdges): Rect {
  return {
    x: edges.left,
    y: edges.top,
    width: edges.right - edges.left,
    height: edges.bottom - edges.top,
  };
}

/**
 * Anchor a rectangle to an edge, corner, or centerline of a frame. Offsets are
 * applied to the resulting top-left coordinate and are therefore caller-owned.
 */
export function anchoredRect(
  anchor: RectAnchor,
  width: number,
  height: number,
  frame: RectEdges = theme.design.titleSafe,
  offset: Point = { x: 0, y: 0 },
): Rect {
  const centerX = (frame.left + frame.right) / 2;
  const centerY = (frame.top + frame.bottom) / 2;
  const xByAnchor: Record<RectAnchor, number> = {
    'top-left': frame.left,
    'top-center': centerX - width / 2,
    'top-right': frame.right - width,
    'center-left': frame.left,
    center: centerX - width / 2,
    'center-right': frame.right - width,
    'bottom-left': frame.left,
    'bottom-center': centerX - width / 2,
    'bottom-right': frame.right - width,
  };
  const yByAnchor: Record<RectAnchor, number> = {
    'top-left': frame.top,
    'top-center': frame.top,
    'top-right': frame.top,
    'center-left': centerY - height / 2,
    center: centerY - height / 2,
    'center-right': centerY - height / 2,
    'bottom-left': frame.bottom - height,
    'bottom-center': frame.bottom - height,
    'bottom-right': frame.bottom - height,
  };
  return { x: xByAnchor[anchor] + offset.x, y: yByAnchor[anchor] + offset.y, width, height };
}

/** True when the inner rectangle is fully contained, including edge-touching. */
export function isRectContained(inner: Rect, outer: Rect, epsilon = 0): boolean {
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    inner.x + inner.width <= outer.x + outer.width + epsilon &&
    inner.y + inner.height <= outer.y + outer.height + epsilon
  );
}

/** True when the rectangle is fully inside the title-safe frame. */
export function isInsideTitleSafe(rect: Rect, frame: RectEdges = theme.design.titleSafe): boolean {
  return isRectContained(rect, rectFromEdges(frame));
}

/**
 * Inflate a visual rectangle to the minimum hit floors, centered on its visual
 * bounds. This is the world-space equivalent of inflateHitArea's centered
 * local-space `setTo` calculation when the object has unit scale.
 */
export function inflateHitRect(
  visual: Rect,
  minHitWidth: number,
  minHitHeight: number,
): Rect {
  const width = Math.max(visual.width, minHitWidth);
  const height = Math.max(visual.height, minHitHeight);
  return {
    x: visual.x + (visual.width - width) / 2,
    y: visual.y + (visual.height - height) / 2,
    width,
    height,
  };
}

/** Return both contracts for a control: its visual rect and final hit rect. */
export function controlBounds(
  visual: Rect,
  floors: HitFloors = theme.control,
): ControlBounds {
  return {
    visual: { ...visual },
    hit: inflateHitRect(visual, floors.minHitWidth, floors.minHitHeight),
  };
}

function axisOverlap(aStart: number, aSize: number, bStart: number, bSize: number): number {
  return Math.min(aStart + aSize, bStart + bSize) - Math.max(aStart, bStart);
}

function signedAxisGap(overlap: number): number {
  if (overlap === 0) return 0;
  return -overlap;
}

export interface RectGap {
  /** Signed separation along each axis: positive gap, negative overlap. */
  x: number;
  y: number;
  /** The relevant 2D clearance: negative for an area overlap. */
  gap: number;
  intersects: boolean;
}

/**
 * Measure inactive space between two rectangles. For a row, `gap` is the x
 * clearance; for a column it is the y clearance. For diagonal rectangles it
 * uses the smaller edge clearance. If both axes overlap, it reports the
 * shallowest negative overlap, preserving useful collision magnitude.
 */
export function inactiveGap(first: Rect, second: Rect): RectGap {
  const overlapX = axisOverlap(first.x, first.width, second.x, second.width);
  const overlapY = axisOverlap(first.y, first.height, second.y, second.height);
  const x = signedAxisGap(overlapX);
  const y = signedAxisGap(overlapY);
  const intersects = overlapX > 0 && overlapY > 0;

  let gap: number;
  if (intersects) gap = -Math.min(overlapX, overlapY);
  else if (overlapX > 0) gap = y;
  else if (overlapY > 0) gap = x;
  else gap = Math.min(x, y);

  return { x, y, gap, intersects };
}

export type ClusterMode = 'ordinary' | 'compactTouch';

export interface ClusterControl {
  id: string;
  visual: Rect;
  floors?: HitFloors;
  destructive?: boolean;
  /** Controls on different tracks are isolated even if their coordinates are close. */
  track?: string | number;
}

export interface ClusterControlBounds extends ControlBounds {
  id: string;
  destructive: boolean;
  track?: string | number;
}

export interface ClusterPairMeasurement {
  firstId: string;
  secondId: string;
  gap: RectGap;
  requiredGap: number;
  isolatedByTrack: boolean;
  meetsFloor: boolean;
}

export interface ControlClusterMeasurement {
  mode: ClusterMode;
  controls: ClusterControlBounds[];
  pairs: ClusterPairMeasurement[];
  /** Minimum geometric gap across all pairs, before track exemptions. */
  minimumGap: number;
  /** True when every pair meets its ordinary/compact/destructive requirement. */
  meetsFloor: boolean;
  /** Compact touch clusters are recommended to stay within 12–16px. */
  withinCompactTouchRange: boolean;
}

/**
 * Compute final hit rectangles and measurable pairwise isolation for a row or
 * column of controls. Destructive controls require 24px unless their track is
 * explicitly different from the neighboring control's track.
 */
export function measureControlCluster(
  controls: readonly ClusterControl[],
  mode: ClusterMode = 'ordinary',
): ControlClusterMeasurement {
  const measured = controls.map((control) => {
    const bounds = controlBounds(control.visual, control.floors ?? theme.control);
    return {
      ...bounds,
      id: control.id,
      destructive: control.destructive ?? false,
      track: control.track,
    };
  });
  const pairs: ClusterPairMeasurement[] = [];
  for (let firstIndex = 0; firstIndex < measured.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < measured.length; secondIndex += 1) {
      const first = measured[firstIndex];
      const second = measured[secondIndex];
      const destructive = first.destructive || second.destructive;
      const requiredGap = destructive
        ? GAP_FLOORS.destructive
        : mode === 'compactTouch'
          ? GAP_FLOORS.compactTouch
          : GAP_FLOORS.ordinary;
      const isolatedByTrack =
        first.track !== undefined && second.track !== undefined && first.track !== second.track;
      const gap = inactiveGap(first.hit, second.hit);
      pairs.push({
        firstId: first.id,
        secondId: second.id,
        gap,
        requiredGap,
        isolatedByTrack,
        meetsFloor: isolatedByTrack || gap.gap >= requiredGap,
      });
    }
  }
  return {
    mode,
    controls: measured,
    pairs,
    minimumGap: pairs.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...pairs.map((pair) => pair.gap.gap)),
    meetsFloor: pairs.every((pair) => pair.meetsFloor),
    withinCompactTouchRange:
      mode !== 'compactTouch' ||
      pairs.every(
        (pair) => pair.isolatedByTrack ||
          (pair.gap.gap >= COMPACT_TOUCH_GAP_RANGE.min && pair.gap.gap <= COMPACT_TOUCH_GAP_RANGE.max),
      ),
  };
}
