export interface RowPacking {
  /** Tile-center offsets from the row center, ordered left to right. */
  offsets: number[];
  /** Uniform scale applied to every tile in the row. */
  scale: number;
  /** Center-to-center spacing between adjacent tiles before scale is applied. */
  spacing: number;
}

export function packRow(
  count: number,
  usableWidth: number,
  tileWidth: number,
  maxSpacing: number,
  gutter = 6,
): RowPacking {
  const spacing = count > 1 ? Math.min(maxSpacing, (usableWidth - tileWidth) / (count - 1)) : 0;
  // The +14 preserves the existing small overlap allowance before tiles shrink.
  const scale = count > 1
    ? Math.min(1, (spacing + 14) / maxSpacing, (spacing - gutter) / tileWidth)
    : 1;
  const offsets = Array.from(
    { length: Math.max(0, count) },
    (_, i) => i * spacing - ((count - 1) * spacing) / 2,
  );
  return { offsets, scale, spacing };
}
