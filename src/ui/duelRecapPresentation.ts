import type { Rect } from './layout';

/**
 * The recap's release grid is a compatibility boundary at standard text.
 * Larger text keeps those portrait dimensions and pages measured reading
 * rows, with the pager above the unchanged result buttons.
 */
export function duelRecapLayout(
  bounds: Rect, count: number, labelHeight: number, textScale: number, requestedPage = 0,
) {
  const total = Math.max(1, Math.floor(count));
  const releaseRows = Math.ceil(total / 6);
  const columns = Math.ceil(total / releaseRows);
  const gridTop = Math.max(bounds.y, 206);
  const contentBottom = bounds.y + bounds.height;
  const releaseBottom = contentBottom - 38;
  const xPitch = Math.min(132, bounds.width / columns);
  const releasePitch = Math.min(156, (releaseBottom - gridTop) / releaseRows);
  const cellScale = Math.min(1, xPitch / 132, releasePitch / 156);
  const portraitWidth = Math.round(92 * cellScale);
  const portraitHeight = Math.round(112 * cellScale);
  const labelWidth = xPitch - 4;
  const measuredPitch = portraitHeight + 8 + labelHeight + 8;
  const grows = textScale > 1 && measuredPitch > releasePitch;
  const pagerY = contentBottom - 24;
  const gridBottom = grows ? pagerY - 28 : releaseBottom;
  const pitch = grows ? Math.max(releasePitch, measuredPitch) : releasePitch;
  const rows = grows ? Math.max(1, Math.min(releaseRows, Math.floor((gridBottom - gridTop + 8) / pitch))) : releaseRows;
  const capacity = rows * columns;
  const pageCount = Math.max(1, Math.ceil(total / capacity));
  const page = Math.max(0, Math.min(pageCount - 1, Math.floor(requestedPage)));
  const x0 = bounds.x + bounds.width / 2 - ((columns - 1) * xPitch) / 2;
  const y0 = grows
    ? gridTop + (gridBottom - gridTop - (rows * pitch - 8)) / 2 + portraitHeight / 2
    : gridTop + (releaseBottom - gridTop - rows * pitch) / 2 + pitch / 2;
  const start = page * capacity;
  const visibleCount = Math.min(capacity, total - start);
  const labelClearance = pitch - portraitHeight - 8;
  return {
    rows, columns, capacity, page, pageCount, start, visibleCount,
    pitch, xPitch, x0, y0, cellScale, portraitWidth, portraitHeight, labelWidth,
    gridTop, gridBottom, pagerY, labelClearance,
    // Never silently tighten the standard grid or conceal overflowing names.
    namesClearPortraits: labelHeight <= labelClearance,
    slot(index: number) {
      const x = x0 + (index % columns) * xPitch;
      const y = y0 + Math.floor(index / columns) * pitch;
      return { x, y, labelY: y + portraitHeight / 2 + 8 };
    },
  };
}
