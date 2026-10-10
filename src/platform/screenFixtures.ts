/**
 * The layout fixtures from docs/mobile-support-matrix.md ("The layout
 * fixtures"), as data: the screens the compact scenes are checked at. Mobile
 * wave 1's device baseline replaces the published sizes with content boxes
 * measured on the tested devices; keep this table and the doc's in step.
 *
 * Every fixture is a touch screen (`coarsePointer: true`). Pixel ratios are
 * the class's usual one: 3 for current iPhones and the Pixel class, 2 for
 * the iPhone SE and iPads, 2.625 for the Android 360 class (Galaxy A).
 */

import type { ScreenEnv } from './screenMetrics';

export interface ScreenFixture extends ScreenEnv {
  name: string;
  /** What the fixture stands for, as in the matrix. */
  standsFor: string;
}

// Pure, so a production build that never names a fixture drops the table.
const fixture = /* #__NO_SIDE_EFFECTS__ */ (
  name: string,
  viewportWidth: number,
  viewportHeight: number,
  [left, right, bottom]: [number, number, number],
  devicePixelRatio: number,
  standsFor: string,
): ScreenFixture => ({
  name,
  viewportWidth,
  viewportHeight,
  insets: { left, right, top: 0, bottom },
  coarsePointer: true,
  devicePixelRatio,
  standsFor,
});

export const SCREEN_FIXTURES: readonly ScreenFixture[] = [
  fixture('phone-narrow', 667, 375, [0, 0, 0], 2, 'iPhone SE'),
  fixture('phone-short', 780, 360, [0, 0, 0], 2.625, 'Android 360 class'),
  fixture('phone-mini', 812, 375, [50, 50, 21], 3, 'iPhone mini'),
  fixture('phone-main', 844, 390, [47, 47, 21], 3, '6.1-inch iPhone'),
  fixture('phone-island', 852, 393, [59, 59, 21], 3, '6.1-inch iPhone with the Dynamic Island'),
  fixture('phone-android', 915, 412, [0, 0, 0], 3, 'Pixel class'),
  fixture('phone-large', 956, 440, [62, 62, 21], 3, 'Pro Max class (16 and 17)'),
  fixture('tablet-mini', 1133, 744, [0, 0, 20], 2, 'iPad mini'),
  fixture('tablet-upright', 820, 1180, [0, 0, 20], 2, 'Upright tablet, letterboxed (M11)'),
];

/**
 * The fixture a dev URL's `viewport=<name>` names (`?layout=compact&viewport=phone-island`),
 * or null. The a11y probe's viewport axis: the dev server boots the compact
 * profile as if on that screen, on any desktop browser.
 */
export function screenFixtureNamed(search: string): ScreenFixture | null {
  try {
    const name = new URLSearchParams(search).get('viewport');
    return SCREEN_FIXTURES.find((f) => f.name === name) ?? null;
  } catch {
    return null;
  }
}
