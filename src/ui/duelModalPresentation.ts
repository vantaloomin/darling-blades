import { isRectContained, type Rect } from './layout';

/** One authored horizontal band, measured after wrapping its text. */
export interface DuelModalRowMeasurement {
  readonly y: number;
  readonly bounds: Rect;
}

export interface DuelModalRowLayout extends DuelModalRowMeasurement {
  readonly offsetY: number;
}

export interface DuelModalLayout {
  readonly panel: Rect;
  readonly rows: readonly DuelModalRowLayout[];
  /** False means the caller needs a dedicated reading-region layout. No text is masked. */
  readonly fits: boolean;
}

/**
 * Keep release anchors at 100%. At larger text settings, only a measured
 * collision pushes a later band down; the panel grows to contain those bands.
 * When growth reaches the safe bottom, move the complete dialog up together.
 */
export function duelModalLayout(
  panel: Rect,
  measurements: readonly DuelModalRowMeasurement[],
  textScale: number,
  options: { gap?: number; padding?: number; safe?: Rect } = {},
): DuelModalLayout {
  const gap = options.gap ?? 6, padding = options.padding ?? 24;
  let previousBottom = Number.NEGATIVE_INFINITY;
  const rows = measurements.map(({ y, bounds }): DuelModalRowLayout => {
    const offsetY = textScale > 1 ? Math.max(0, previousBottom + gap - bounds.y) : 0;
    const shifted = { ...bounds, y: bounds.y + offsetY };
    previousBottom = shifted.y + shifted.height;
    return { y: y + offsetY, offsetY, bounds: shifted };
  });
  let frame = { ...panel };
  if (textScale > 1 && rows.length > 0) {
    const top = Math.min(frame.y, rows[0].bounds.y - padding);
    const bottom = Math.max(frame.y + frame.height, rows[rows.length - 1].bounds.y + rows[rows.length - 1].bounds.height + padding);
    frame = { ...frame, y: top, height: bottom - top };
    if (options.safe && frame.height <= options.safe.height) {
      const shift = Math.max(options.safe.y - frame.y, Math.min(0, options.safe.y + options.safe.height - frame.y - frame.height));
      frame.y += shift;
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        rows[index] = { y: row.y + shift, offsetY: row.offsetY + shift, bounds: { ...row.bounds, y: row.bounds.y + shift } };
      }
    }
  }
  const contained = rows.every((row) => isRectContained(row.bounds, frame, 0.5));
  const separate = rows.every((row, index) => index === 0 || row.bounds.y >= rows[index - 1].bounds.y + rows[index - 1].bounds.height);
  return { panel: frame, rows, fits: contained && separate && (!options.safe || isRectContained(frame, options.safe, 0.5)) };
}
