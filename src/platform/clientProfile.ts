/**
 * The three coarse client facts the anonymous play signals need and that no
 * pure module can read: form factor, UI language, and the OS reduced-motion
 * preference (rollout wave T2; `SignalEnv` in src/meta/playSignals.ts names all
 * three as "no source anywhere in src/ today").
 *
 * Everything here is deliberately *coarse*. `formFactor()` reads the viewport
 * width, but the width never leaves this module: it is compared against two
 * thresholds and collapses to one of three labels before it is returned, so the
 * number itself has nowhere to go. That is the privacy policy's promise in
 * section 3.3 ("device size category (phone, tablet, or computer), never your
 * screen size") expressed as a function signature rather than as discipline.
 *
 * Every reader is guarded and total: a missing `window`, a missing `navigator`,
 * a `matchMedia` that throws, or a Tauri webview that does not implement one of
 * these returns the neutral value instead of propagating. Nothing here may ever
 * throw into boot.
 */

import { isTouchDevice } from './gestures';

export type FormFactor = 'mobile' | 'tablet' | 'desktop';

/**
 * Upper bound of the phone class, in CSS px. 768 is the long-standing tablet
 * breakpoint and the exact portrait width of an iPad, so `<= 767` puts phones
 * below it and tablets at or above it.
 */
export const FORM_FACTOR_MOBILE_MAX_WIDTH = 767;

/**
 * Upper bound of the tablet class, in CSS px. 1280 is this game's own design
 * width (see gameBoot.ts: the canvas is 1280x720 logical), so a touch device
 * with at least the full design width in its viewport is a touchscreen laptop
 * or a desktop monitor rather than a tablet, and reads as `desktop`.
 */
export const FORM_FACTOR_TABLET_MAX_WIDTH = 1279;

/** Everything the classification reads, injected so the decision stays pure. */
export interface FormFactorEnv {
  /** Device-level touch capability (src/platform/gestures.ts). */
  touch: boolean;
  /** Viewport width in CSS px. Used for comparison only; never emitted. */
  viewportWidth: number;
}

/**
 * Pure form-factor classification.
 *
 * A pointer device is a computer whatever size its window is, so a non-touch
 * client is always `desktop`: a narrow browser window on a desktop must not
 * masquerade as a phone. Only touch clients are split by width.
 */
export function classifyFormFactor(env: FormFactorEnv): FormFactor {
  if (!env.touch) return 'desktop';
  // A width we could not read (0, negative, NaN, Infinity) reads as 0, so an
  // unreadable touch client lands in `mobile`: at that point the only fact we
  // have is that it is a touch device, and a phone is the likeliest one.
  const width = Number.isFinite(env.viewportWidth) ? env.viewportWidth : 0;
  if (width <= FORM_FACTOR_MOBILE_MAX_WIDTH) return 'mobile';
  if (width <= FORM_FACTOR_TABLET_MAX_WIDTH) return 'tablet';
  return 'desktop';
}

/** Viewport width in CSS px, or 0 when there is no window (headless, tests). */
function viewportWidth(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const inner = window.innerWidth;
    if (typeof inner === 'number' && inner > 0) return inner;
    if (typeof document === 'undefined') return 0;
    const client = document.documentElement?.clientWidth;
    return typeof client === 'number' && client > 0 ? client : 0;
  } catch {
    return 0;
  }
}

/**
 * The device size category. Headless and any environment without a window read
 * as `desktop`, which is also the neutral value the pure builder falls back to.
 */
export function formFactor(): FormFactor {
  try {
    return classifyFormFactor({ touch: isTouchDevice(), viewportWidth: viewportWidth() });
  } catch {
    return 'desktop';
  }
}

/**
 * The raw UI language tag, e.g. `en-GB`. `normalizeLang` in playSignals reduces
 * it to the primary subtag; the region never leaves the device. An environment
 * without `navigator`, or one whose language is absent, yields an empty string,
 * which that function maps to `xx`.
 */
export function uiLanguage(): string {
  try {
    if (typeof navigator === 'undefined') return '';
    const tag = navigator.language;
    if (typeof tag === 'string' && tag.length > 0) return tag;
    const first = navigator.languages?.[0];
    return typeof first === 'string' ? first : '';
  } catch {
    return '';
  }
}

/**
 * The OS "reduce motion" preference. Distinct from the in-game animation
 * setting, which the heartbeat reports separately: this one says what the
 * player asked their system for.
 */
export function prefersReducedMotion(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}
