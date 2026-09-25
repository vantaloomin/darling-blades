/**
 * A progress fraction (0..1) as a whole percent that never claims more than is
 * done: it rounds DOWN, so "100%" appears only when the goal is complete. The
 * Achievements screen rounded to nearest until 1.8.1 (2026-09-25), which put
 * 199 of 200 on screen as "100%" beside an unfinished gauge.
 *
 * The epsilon absorbs binary representation error before flooring (29 / 100
 * is 0.29, and 0.29 * 100 is 28.999999999999996); it is far smaller than the
 * gap between any real count ratio and the next whole percent.
 */
export function progressPercentLabel(fraction: number): string {
  if (!(fraction > 0)) return '0%';
  if (fraction >= 1) return '100%';
  return `${Math.min(99, Math.floor(fraction * 100 + 1e-9))}%`;
}
