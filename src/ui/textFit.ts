import type Phaser from 'phaser';

/**
 * Fit rendered text into a hard width budget.
 *
 * This lives here rather than in `layout.ts` because it needs a real
 * `Phaser.GameObjects.Text` to measure: `layout.ts` is deliberately Phaser-free
 * so headless tests can drive it, and the geometry helpers there compute
 * budgets while this applies one.
 */

/**
 * Truncate with a trailing ellipsis until the text fits `maxWidth`.
 *
 * Binary search over the string length, because Phaser only reports the width
 * of what is currently set: each probe is a real measurement, so a linear walk
 * would re-render once per character. Truncating rather than scaling is the
 * house rule for names (user-directed 2026-07-10: mixed type sizes in one list
 * read as a rendering fault).
 */
export function ellipsizeText(
  text: Phaser.GameObjects.Text,
  maxWidth: number,
  value: string = text.text,
): void {
  text.setText(value);
  if (text.width <= maxWidth) return;

  let low = 0;
  let high = value.length;
  while (low < high) {
    const length = Math.ceil((low + high) / 2);
    text.setText(`${value.slice(0, length).trimEnd()}…`);
    if (text.width <= maxWidth) low = length;
    else high = length - 1;
  }
  text.setText(`${value.slice(0, low).trimEnd()}…`);
}
