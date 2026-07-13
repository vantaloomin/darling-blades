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

/** A small inert registration shape for the future shared focus manager. */
export interface FocusMetadata {
  group?: string;
  order?: number;
  id?: string;
}

export type ControlSize = 'md' | 'sm';

export interface RectSize {
  width: number;
  height: number;
}

export interface ThemedButtonMeasurement extends ControlBounds {
  size: ControlSize;
  labelWidth: number;
  padding: number;
  width: number;
  height: number;
  hitWidth: number;
  hitHeight: number;
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

/**
 * Shared select geometry. The row track is deliberately wider than its hit
 * rect so adjacent options retain measurable inactive space for touch and
 * controller use.
 */
export const DROPDOWN_GEOMETRY = {
  rowHitHeight: Math.max(theme.control.minHitHeight, 44),
  rowPitch: Math.max(52, Math.max(theme.control.minHitHeight, 44) + GAP_FLOORS.ordinary),
  panelPadding: theme.space(2),
  triggerGap: theme.space(1),
  clampMargin: 0,
} as const;

export type DropdownOpenDirection = 'down' | 'up';

export interface DropdownPopoverOptions {
  panelWidth: number;
  rowHitHeight?: number;
  rowPitch?: number;
  panelPadding?: number;
  triggerGap?: number;
  clampMargin?: number;
  safeFrame?: RectEdges;
}

export interface DropdownPopoverLayout {
  panel: Rect;
  rows: Rect[];
  direction: DropdownOpenDirection;
  rowHitHeight: number;
  rowPitch: number;
  rowGap: number;
  panelPadding: number;
  clampMargin: number;
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Place a dropdown panel from the trigger's world-space hit bounds. Horizontal
 * placement is clamped to the title-safe frame. A down-opening panel wins when
 * it fits exactly; otherwise the panel flips upward and is vertically clamped
 * to the same frame.
 */
export function dropdownPopoverLayout(
  triggerBounds: Rect,
  optionCount: number,
  opts: DropdownPopoverOptions,
): DropdownPopoverLayout {
  const safe = opts.safeFrame ?? TITLE_SAFE_EDGES;
  const rowHitHeight = Math.max(theme.control.minHitHeight, 44, opts.rowHitHeight ?? DROPDOWN_GEOMETRY.rowHitHeight);
  const rowPitch = Math.max(rowHitHeight + GAP_FLOORS.ordinary, opts.rowPitch ?? DROPDOWN_GEOMETRY.rowPitch);
  const rowGap = rowPitch - rowHitHeight;
  const panelPadding = Math.max(0, opts.panelPadding ?? DROPDOWN_GEOMETRY.panelPadding);
  const triggerGap = Math.max(0, opts.triggerGap ?? DROPDOWN_GEOMETRY.triggerGap);
  const clampMargin = Math.max(0, opts.clampMargin ?? DROPDOWN_GEOMETRY.clampMargin);
  const count = Math.max(0, Math.floor(optionCount));
  const maxWidth = Math.max(0, safe.right - safe.left - clampMargin * 2);
  const panelWidth = Math.min(Math.max(0, opts.panelWidth), maxWidth);
  const panelHeight = panelPadding * 2 + count * rowPitch;
  const minX = safe.left + clampMargin;
  const maxX = safe.right - clampMargin - panelWidth;
  const panelX = clamp(triggerBounds.x, minX, maxX);

  const downY = triggerBounds.y + triggerBounds.height + triggerGap;
  const opensDown = downY + panelHeight <= safe.bottom - clampMargin;
  const direction: DropdownOpenDirection = opensDown ? 'down' : 'up';
  const requestedY = opensDown
    ? downY
    : triggerBounds.y - triggerGap - panelHeight;
  const minY = safe.top + clampMargin;
  const maxY = safe.bottom - clampMargin - panelHeight;
  const panelY = clamp(requestedY, minY, maxY);
  const panel = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };
  const rowWidth = Math.max(0, panelWidth - panelPadding * 2);
  const rows = Array.from({ length: count }, (_, index) => ({
    x: panelX + panelPadding,
    y: panelY + panelPadding + index * rowPitch + (rowPitch - rowHitHeight) / 2,
    width: rowWidth,
    height: rowHitHeight,
  }));

  return {
    panel,
    rows,
    direction,
    rowHitHeight,
    rowPitch,
    rowGap,
    panelPadding,
    clampMargin,
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

/** The visual text padding used by the shared button recipes. */
export function controlPadding(size: ControlSize): number {
  return size === 'sm' ? theme.space(2) : theme.space(3);
}

/**
 * Predict the shared button's final visual and hit bounds before creating it.
 * The visual rectangle is centered at the origin, matching a themedButton's
 * unscaled child Zone and Container coordinate system.
 */
export function measureThemedButton(
  labelWidth: number,
  size: ControlSize = 'md',
  minWidth = 0,
  padding = controlPadding(size),
): ThemedButtonMeasurement {
  const safeLabelWidth = Math.max(0, labelWidth);
  const safePadding = Math.max(0, padding);
  const height = size === 'sm' ? theme.control.heightSm : theme.control.heightMd;
  const width = Math.max(minWidth, Math.ceil(safeLabelWidth + safePadding * 2));
  const visual = {
    x: -width / 2,
    y: -height / 2,
    width,
    height,
  };
  const bounds = controlBounds(visual);
  return {
    ...bounds,
    size,
    labelWidth: safeLabelWidth,
    padding: safePadding,
    width,
    height,
    hitWidth: bounds.hit.width,
    hitHeight: bounds.hit.height,
  };
}

/** Place a visual control so its centered hit rectangle is inside a frame. */
export function anchoredControlBounds(
  anchor: RectAnchor,
  visualWidth: number,
  visualHeight: number,
  frame: RectEdges = theme.design.titleSafe,
  floors: HitFloors = theme.control,
  offset: Point = { x: 0, y: 0 },
): ControlBounds {
  const width = Math.max(0, visualWidth);
  const height = Math.max(0, visualHeight);
  const hitWidth = Math.max(width, floors.minHitWidth);
  const hitHeight = Math.max(height, floors.minHitHeight);
  const hit = anchoredRect(anchor, hitWidth, hitHeight, frame, offset);
  return {
    hit,
    visual: {
      x: hit.x + (hit.width - width) / 2,
      y: hit.y + (hit.height - height) / 2,
      width,
      height,
    },
  };
}

function centeredRect(centerX: number, centerY: number, size: RectSize): Rect {
  return {
    x: centerX - size.width / 2,
    y: centerY - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

export interface HeaderFooterLayoutOptions {
  backVisual: RectSize;
  titleVisual: RectSize;
  currencyVisual: RectSize;
  footerActionVisuals?: readonly RectSize[];
  footerGap?: number;
}

export interface HeaderFooterLayout {
  headerTrack: Rect;
  footerTrack: Rect;
  back: ControlBounds;
  titleTrack: Rect;
  title: Rect;
  currency: Rect;
  footerActionTrack: Rect;
  footerActions: ControlBounds[];
  tracksInsideTitleSafe: boolean;
}

/**
 * Derive the shared page header/footer tracks from the title-safe frame. The
 * returned footer action bounds are centered on the canonical footer line and
 * use hit widths when calculating the cluster, so isolation is measurable
 * before Phaser objects are created.
 */
export function sceneHeaderFooterLayout(opts: HeaderFooterLayoutOptions): HeaderFooterLayout {
  const headerTrack = anchoredRect(
    'top-left',
    theme.design.safeWidth,
    theme.control.minHitHeight,
  );
  const footerTrack = anchoredRect(
    'bottom-left',
    theme.design.safeWidth,
    theme.control.minHitHeight,
  );
  const back = anchoredControlBounds(
    'top-left',
    opts.backVisual.width,
    opts.backVisual.height,
  );
  const currency = centeredRect(
    theme.design.safeRight - opts.currencyVisual.width / 2,
    theme.design.headerCenterY,
    opts.currencyVisual,
  );
  const trackGap = theme.space(6);
  const titleTrack = {
    x: back.hit.x + back.hit.width + trackGap,
    y: headerTrack.y,
    width: Math.max(0, currency.x - trackGap - (back.hit.x + back.hit.width + trackGap)),
    height: headerTrack.height,
  };
  const title = centeredRect(
    titleTrack.x + titleTrack.width / 2,
    theme.design.headerCenterY,
    opts.titleVisual,
  );

  const footerGap = opts.footerGap ?? theme.space(2);
  const footerVisuals = opts.footerActionVisuals ?? [];
  const footerMeasured = footerVisuals.map((visual) =>
    controlBounds({ x: 0, y: 0, width: visual.width, height: visual.height }),
  );
  const footerHitWidth = footerMeasured.reduce((sum, bounds) => sum + bounds.hit.width, 0);
  const totalFooterWidth = footerHitWidth + Math.max(0, footerMeasured.length - 1) * footerGap;
  let cursor = theme.design.safeCenterX - totalFooterWidth / 2;
  const footerActions = footerMeasured.map((bounds) => {
    const hit = {
      x: cursor,
      y: theme.design.footerCenterY - bounds.hit.height / 2,
      width: bounds.hit.width,
      height: bounds.hit.height,
    };
    cursor += bounds.hit.width + footerGap;
    return {
      hit,
      visual: {
        x: hit.x + (hit.width - bounds.visual.width) / 2,
        y: hit.y + (hit.height - bounds.visual.height) / 2,
        width: bounds.visual.width,
        height: bounds.visual.height,
      },
    };
  });
  const tracks = [
    headerTrack,
    footerTrack,
    back.hit,
    titleTrack,
    currency,
    ...footerActions.map((action) => action.hit),
  ];
  return {
    headerTrack,
    footerTrack,
    back,
    titleTrack,
    title,
    currency,
    footerActionTrack: footerTrack,
    footerActions,
    tracksInsideTitleSafe: tracks.every((rect) => isInsideTitleSafe(rect)),
  };
}

export interface ModalShellLayoutOptions {
  width: number;
  height: number;
  x?: number;
  y?: number;
  panelPadding?: number;
  trackGap?: number;
  titleTrackHeight?: number;
  footerTrackHeight?: number;
  closeHitWidth?: number;
  closeHitHeight?: number;
}

export interface ModalShellLayout {
  panel: Rect;
  inner: Rect;
  titleTrack: Rect;
  contentBounds: Rect;
  /** Alias for callers that think in terms of reserved tracks. */
  contentTrack: Rect;
  footerTrack: Rect;
  closeTrack: Rect;
  fits: boolean;
  tracksInsidePanel: boolean;
  tracksInsideTitleSafe: boolean;
}

/**
 * Reserve non-intersecting modal tracks. The 24px inset is a hard minimum;
 * title/content/footer rows use a 16px inter-track gap and 44px hit-height
 * defaults, while the close track consumes the measured close target.
 */
export function modalShellLayout(opts: ModalShellLayoutOptions): ModalShellLayout {
  const x = opts.x ?? theme.design.centerX;
  const y = opts.y ?? theme.design.centerY;
  const panel = {
    x: x - opts.width / 2,
    y: y - opts.height / 2,
    width: opts.width,
    height: opts.height,
  };
  const padding = Math.max(theme.space(6), opts.panelPadding ?? theme.space(6));
  const trackGap = Math.max(theme.space(4), opts.trackGap ?? theme.space(4));
  const inner = {
    x: panel.x + padding,
    y: panel.y + padding,
    width: Math.max(0, panel.width - padding * 2),
    height: Math.max(0, panel.height - padding * 2),
  };
  const titleHeight = Math.max(theme.control.minHitHeight, opts.titleTrackHeight ?? theme.control.minHitHeight);
  const footerHeight = Math.max(theme.control.minHitHeight, opts.footerTrackHeight ?? theme.control.minHitHeight);
  const closeWidth = Math.max(theme.control.minHitWidth, opts.closeHitWidth ?? theme.control.minHitWidth);
  const closeHeight = Math.max(theme.control.minHitHeight, opts.closeHitHeight ?? theme.control.minHitHeight);
  const closeTrack = {
    x: inner.x + inner.width - closeWidth,
    y: inner.y,
    width: closeWidth,
    height: closeHeight,
  };
  const titleTrack = {
    x: inner.x,
    y: inner.y,
    width: Math.max(0, closeTrack.x - trackGap - inner.x),
    height: titleHeight,
  };
  const footerTrack = {
    x: inner.x,
    y: inner.y + inner.height - footerHeight,
    width: inner.width,
    height: footerHeight,
  };
  const contentTop = titleTrack.y + titleTrack.height + trackGap;
  const contentBottom = footerTrack.y - trackGap;
  const contentY = Math.min(contentTop, contentBottom);
  const contentBounds = {
    x: inner.x,
    y: contentY,
    width: inner.width,
    height: Math.max(0, contentBottom - contentY),
  };
  const tracks = [titleTrack, contentBounds, footerTrack, closeTrack];
  return {
    panel,
    inner,
    titleTrack,
    contentBounds,
    contentTrack: contentBounds,
    footerTrack,
    closeTrack,
    fits: titleTrack.width > 0 && contentBottom >= contentTop,
    tracksInsidePanel: tracks.every((rect) => isRectContained(rect, panel)),
    tracksInsideTitleSafe: tracks.every((rect) => isInsideTitleSafe(rect)),
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
