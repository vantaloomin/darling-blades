import { setAccessibility, TEXT_SCALES } from '../../src/ui/accessibility';

/**
 * The six cells of the scale-and-contrast fixture matrix (1.9 lane C; plan
 * "Gates", item 1): text size 100, 115 and 130% by standard and high
 * contrast. A test helper, not a test file. Every test that claims to hold a
 * rule "in every cell" iterates this list, so a new text size or a third
 * contrast reaches all of them at once; `tests/ui/accessibilityLayout.test.ts`
 * lists which tests those are.
 */
export interface A11yCell {
  readonly textScale: number;
  readonly highContrast: boolean;
  /** For assertion messages, e.g. "115% text, high contrast". */
  readonly name: string;
}

export const A11Y_CELLS: readonly A11yCell[] = TEXT_SCALES.flatMap((textScale) =>
  [false, true].map((highContrast) => ({
    textScale,
    highContrast,
    name: `${Math.round(textScale * 100)}% text, ${highContrast ? 'high' : 'standard'} contrast`,
  })),
);

/**
 * Run `fn` once per cell with that cell's settings in force, and put the
 * default back afterwards (also when `fn` throws).
 */
export function forEachA11yCell(fn: (cell: A11yCell) => void): void {
  try {
    for (const cell of A11Y_CELLS) {
      setAccessibility({ textScale: cell.textScale, highContrast: cell.highContrast });
      fn(cell);
    }
  } finally {
    setAccessibility({ textScale: 1, highContrast: false });
  }
}
