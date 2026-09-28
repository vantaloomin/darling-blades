/**
 * The stored accessibility settings' allowed values and normalization, shared
 * by the save (src/meta/SaveManager.ts) and the UI resolver
 * (src/ui/accessibility.ts) so the two can never disagree. No imports: the
 * theme module reads this, and the Forge page loads the theme.
 */

/**
 * The text sizes a player can choose, as multiples of the base type scale.
 * This list is a normalization rule, not part of the schema: `settings.textScale`
 * is stored as a plain number, and a stored value outside this list snaps to
 * the nearest entry on the next load. Changing the list is therefore never a
 * save bump.
 */
export const TEXT_SCALES: readonly number[] = [1, 1.15, 1.3];

/** A fresh save's text size, and the answer for any stored value that is not a finite number. */
export const DEFAULT_TEXT_SCALE = 1;

/** Two distances closer than this count as a tie (decimal midpoints such as 1.225 are not exact in binary). */
const TIE_EPSILON = 1e-9;

/**
 * Snap a stored text scale onto the allowed list. Anything that is not a
 * finite number reads as the default; a number takes the nearest allowed
 * value, and a tie takes the smaller one (the list is ascending and only a
 * strictly nearer entry, by more than the tie epsilon, replaces the pick).
 */
export function normalizeTextScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TEXT_SCALE;
  let nearest = TEXT_SCALES[0];
  for (const scale of TEXT_SCALES) {
    if (Math.abs(value - scale) < Math.abs(value - nearest) - TIE_EPSILON) nearest = scale;
  }
  return nearest;
}

/** High contrast is on only for a stored `true`; anything else reads as off. */
export function normalizeHighContrast(value: unknown): boolean {
  return value === true;
}
