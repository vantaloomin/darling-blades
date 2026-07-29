import { theme } from './theme';

export interface BoosterStripRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoosterStripLayout {
  count: number;
  viewport: BoosterStripRect;
  tileWidth: number;
  tileStride: number;
  tileHitGap: number;
  visibleCount: 4;
  currentIndex: number;
  maxIndex: number;
  firstCenter: number;
  tileCenters: number[];
  fullTileRects: BoosterStripRect[];
  tapBand: BoosterStripRect;
  leftPeek: BoosterStripRect;
  rightPeek: BoosterStripRect;
  arrowCenters: { left: number; right: number };
  arrowHitWidth: number;
}

export interface BoosterStripVisibility {
  firstFullIndex: number;
  lastFullIndex: number;
  leftPeekIndex: number | null;
  rightPeekIndex: number | null;
}

export type BoosterStripTap =
  | { kind: 'buy'; index: number }
  | { kind: 'scroll'; targetIndex: number }
  | { kind: 'none' };

/**
 * Pure design-space geometry for the booster carousel. Four 210px product
 * faces fit on the title-safe rail with 30px between their hit silhouettes;
 * the extra 81px at each edge is intentionally clipped peek art. The scene
 * derives its tile count from the SKU list and only supplies that count here.
 */
export function boosterStripLayout(count: number, requestedIndex = 0): BoosterStripLayout {
  const visibleCount = 4 as const;
  const tileWidth = 210;
  const tileStride = 240;
  const tileHitGap = tileStride - tileWidth;
  const safeCount = Math.max(0, Math.trunc(count));
  const viewport: BoosterStripRect = {
    x: theme.design.safeLeft,
    y: 142,
    width: theme.design.safeWidth,
    height: 496,
  };
  const maxIndex = Math.max(0, safeCount - visibleCount);
  const currentIndex = Math.min(maxIndex, Math.max(0, Math.trunc(requestedIndex)));
  const firstCenter = viewport.x + viewport.width / 2 - ((visibleCount - 1) * tileStride) / 2;
  const tileCenters = Array.from(
    { length: safeCount },
    (_, index) => firstCenter + (index - currentIndex) * tileStride,
  );
  const fullTileRects = Array.from({ length: visibleCount }, (_, slot) => ({
    x: firstCenter + slot * tileStride - tileWidth / 2,
    y: viewport.y + 70,
    width: tileWidth,
    height: 300,
  }));
  const leftPeekCenter = firstCenter - tileStride;
  const peekWidth = Math.max(
    0,
    Math.min(viewport.x + viewport.width, leftPeekCenter + tileWidth / 2) -
      Math.max(viewport.x, leftPeekCenter - tileWidth / 2),
  );
  const peekY = viewport.y + 70;
  const leftPeek: BoosterStripRect = {
    x: viewport.x,
    y: peekY,
    width: peekWidth,
    height: 300,
  };
  const rightPeek: BoosterStripRect = {
    x: viewport.x + viewport.width - peekWidth,
    y: peekY,
    width: peekWidth,
    height: 300,
  };
  const tapBand: BoosterStripRect = {
    x: viewport.x,
    y: 240,
    width: viewport.width,
    height: 290,
  };
  const arrowHitWidth = theme.control.minHitWidth;
  return {
    count: safeCount,
    viewport,
    tileWidth,
    tileStride,
    tileHitGap,
    visibleCount,
    currentIndex,
    maxIndex,
    firstCenter,
    tileCenters,
    fullTileRects,
    tapBand,
    leftPeek,
    rightPeek,
    arrowCenters: {
      left: viewport.x + arrowHitWidth / 2 + 1,
      right: viewport.x + viewport.width - arrowHitWidth / 2 - 1,
    },
    arrowHitWidth,
  };
}

/** Clamp a drag offset to the first/last legal snap positions. */
export function clampBoosterStripOffset(layout: BoosterStripLayout, offset: number): number {
  const minOffset = (layout.currentIndex - layout.maxIndex) * layout.tileStride;
  const maxOffset = layout.currentIndex * layout.tileStride;
  return Math.min(maxOffset, Math.max(minOffset, offset));
}

/** Resolve the nearest snap index for a (possibly mid-drag) content offset. */
export function boosterStripIndexForOffset(layout: BoosterStripLayout, offset: number): number {
  const clamped = clampBoosterStripOffset(layout, offset);
  return Math.min(
    layout.maxIndex,
    Math.max(0, layout.currentIndex - Math.round(clamped / layout.tileStride)),
  );
}

/** Return the offset that places a requested SKU at the first full slot. */
export function boosterStripOffsetForIndex(layout: BoosterStripLayout, index: number): number {
  const target = Math.min(layout.maxIndex, Math.max(0, Math.trunc(index)));
  return (layout.currentIndex - target) * layout.tileStride;
}

/** Position one tile at a given content offset. */
export function boosterStripTileRect(
  layout: BoosterStripLayout,
  index: number,
  offset = 0,
): BoosterStripRect {
  const center = layout.tileCenters[index];
  return {
    x: center === undefined ? Number.NaN : center + offset - layout.tileWidth / 2,
    y: layout.fullTileRects[0].y,
    width: layout.tileWidth,
    height: layout.fullTileRects[0].height,
  };
}

/** Count-aware full-tile band and the real one-tile edge peeks. */
export function boosterStripVisibility(
  layout: BoosterStripLayout,
  offset: number,
): BoosterStripVisibility {
  const firstFullIndex = boosterStripIndexForOffset(layout, offset);
  return {
    firstFullIndex,
    lastFullIndex: Math.min(layout.count - 1, firstFullIndex + layout.visibleCount - 1),
    leftPeekIndex: firstFullIndex > 0 ? firstFullIndex - 1 : null,
    rightPeekIndex: firstFullIndex + layout.visibleCount < layout.count
      ? firstFullIndex + layout.visibleCount
      : null,
  };
}

function intersects(a: BoosterStripRect, b: BoosterStripRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

function containsPoint(rect: BoosterStripRect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

/** Whether a tile's product art intersects the masked viewport. */
export function boosterStripTileIsVisible(
  layout: BoosterStripLayout,
  index: number,
  offset: number,
): boolean {
  return intersects(boosterStripTileRect(layout, index, offset), layout.viewport);
}

/**
 * Classify a strip tap. Only the four full tiles buy; a real edge peek moves
 * one snap toward that SKU. The caption row is outside tapBand by design.
 */
export function boosterStripTap(
  layout: BoosterStripLayout,
  offset: number,
  worldX: number,
  worldY: number,
): BoosterStripTap {
  if (!containsPoint(layout.tapBand, worldX, worldY)) return { kind: 'none' };
  const localX = worldX - offset;
  const firstCenter = layout.tileCenters[layout.currentIndex] ?? layout.firstCenter;
  const index = Math.round((localX - firstCenter) / layout.tileStride) + layout.currentIndex;
  if (index < 0 || index >= layout.count) return { kind: 'none' };
  const tile = boosterStripTileRect(layout, index, offset);
  if (Math.abs(worldX - (tile.x + tile.width / 2)) > layout.tileWidth / 2) return { kind: 'none' };

  const visibility = boosterStripVisibility(layout, offset);
  if (index >= visibility.firstFullIndex && index <= visibility.lastFullIndex) {
    return { kind: 'buy', index };
  }
  if (index === visibility.leftPeekIndex) {
    return { kind: 'scroll', targetIndex: visibility.firstFullIndex - 1 };
  }
  if (index === visibility.rightPeekIndex) {
    return { kind: 'scroll', targetIndex: visibility.firstFullIndex + 1 };
  }
  return { kind: 'none' };
}
