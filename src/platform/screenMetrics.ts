/**
 * ScreenMetrics: what kind of screen the game is on and the space it draws in
 * (docs/plan-mobile-overhaul.md, C1 and the profile rule; mobile wave 1).
 *
 * Pure and headless, like quality.ts and renderScale.ts: `resolveScreenMetrics`
 * takes an injected environment so tests drive it with the support matrix's
 * fixtures (src/platform/screenFixtures.ts). Nothing here is saved: the profile
 * is worked out on each load, so a save moved between devices can never be
 * stranded on the wrong layout.
 *
 * The rules, in the plan's words:
 * - **Profile.** Compact when the primary pointer is coarse (phones and
 *   tablets, not a touchscreen laptop driven by its trackpad); wide otherwise.
 *   Wide is today's desktop: the 1280x720 design window fit to the screen.
 * - **Phone or tablet** is told by the screen's shorter side, so a phone held
 *   in landscape is still a phone.
 * - **Phones** draw in their own viewport, one design pixel per CSS pixel. The
 *   content box is the safe area less an 8 px margin, as in the Version C
 *   mocks (718x356 on the 852x393 reference phone).
 * - **Tablets** draw the reference phone's composition scaled up (M22): to the
 *   width in landscape (mock P5, 138% on an 11-inch iPad), and letterboxed at
 *   96% of the width upright (M11, mock P4).
 * - **A phone held upright** gets the rotate screen (M12); a tablet never does.
 * - **The render factor** follows the device pixel ratio, snapped to the
 *   existing `RenderK` steps and capped at 2, then lowered until the backing
 *   store fits the desktop's own budget (1280x720 at k = 2, about 3.7 MP).
 */

import type { RenderK } from './renderScale';

/** Wide is the desktop composition; compact is Version C (C1). */
export type ScreenProfile = 'wide' | 'compact';

/** What the screen is, for layout. Desktop always pairs with the wide profile. */
export type ScreenDevice = 'phone' | 'tablet' | 'desktop';

/**
 * The compact profile's density: `short` is M21's denser variant for a phone
 * left with very little height (phone Safari with its bars showing, about
 * 297 pt in mock P3): 72 pt portraits, 44 pt medallions, pile counts behind
 * the menu. Wide and tablets are always `regular`.
 */
export type ScreenVariant = 'regular' | 'short';

/** What the scene shows: the game, the game letterboxed, or the rotate screen. */
export type ScreenPresentation = 'fill' | 'letterbox' | 'rotate';

/**
 * The longest shorter side a phone has, in CSS px. Phones top out near 440
 * (the Pro Max class) and the smallest iPad's shorter side is 744, so 599 sits
 * in the empty gap between them. It is Android's own tablet line (the 600 dp
 * "smallest width" qualifier). Shared with the play-stats form factor label
 * (src/platform/clientProfile.ts) so both say "phone" about the same screens.
 */
export const PHONE_MAX_SHORT_SIDE = 599;

/**
 * A landscape phone shorter than this, in CSS px, gets the short variant. It
 * sits between the shortest full-height phone in the matrix (360, the Android
 * class) and Safari's 297 with its bars up; the device baseline may move it.
 */
export const SHORT_MAX_HEIGHT = 339;

/** The Version C reference phone (iPhone 15/16, 852x393) the mocks are drawn on. */
export const REFERENCE_PHONE = { width: 852, height: 393, insets: { left: 59, right: 59, top: 0, bottom: 21 } } as const;

/** The mocks' margin between the safe area and the content box, in CSS px. */
export const CONTENT_MARGIN = 8;

/** Upright tablets show the composition at this share of their width (M11, mock P4). */
export const UPRIGHT_TABLET_WIDTH_SHARE = 0.96;

/** The desktop's backing-store budget: 1280x720 at k = 2, in device pixels. */
export const BACKING_STORE_BUDGET = 1280 * 2 * 720 * 2;

/** Safe-area insets in CSS px (`env(safe-area-inset-*)`). */
export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A rectangle in design px. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Everything the resolution reads, injected so the decision stays pure. */
export interface ScreenEnv {
  /** The box the page gives the game, in CSS px. */
  viewportWidth: number;
  viewportHeight: number;
  /** Safe-area insets in CSS px; absent means none. */
  insets?: Partial<Insets>;
  /** `(pointer: coarse)` matches: the primary pointer is a finger. */
  coarsePointer: boolean;
  /** `window.devicePixelRatio`; absent or unreadable reads as 1. */
  devicePixelRatio?: number;
}

export interface ScreenMetrics {
  profile: ScreenProfile;
  device: ScreenDevice;
  orientation: 'landscape' | 'portrait';
  presentation: ScreenPresentation;
  variant: ScreenVariant;
  /**
   * The space a scene draws in, in design px. A phone's is its own viewport.
   * A tablet's is its viewport divided by `scale`: the reference phone's
   * composition plus the bands around it. The wide profile's is the 1280x720
   * design window.
   */
  design: { width: number; height: number };
  /** Where controls may go inside the design space: the safe area less the margin. */
  content: Rect;
  /** CSS px per design px: 1 on a phone, the tablet's scale-up on a tablet. Wide reports 1; Phaser's fit sets its real scale. */
  scale: number;
  /** Backing-store factor: device px per CSS px for the canvas (C1). */
  renderK: RenderK;
}

const WIDE_DESIGN = { width: 1280, height: 720 } as const;

/** A finite, positive number, or 0. */
const dim = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

const insetsOf = (raw: Partial<Insets> | undefined): Insets => ({
  left: dim(raw?.left),
  right: dim(raw?.right),
  top: dim(raw?.top),
  bottom: dim(raw?.bottom),
});

/** The safe area less the content margin, never negative. */
function contentBox(width: number, height: number, insets: Insets): Rect {
  const x = insets.left + CONTENT_MARGIN;
  const y = insets.top + CONTENT_MARGIN;
  return {
    x,
    y,
    width: Math.max(0, width - insets.right - CONTENT_MARGIN - x),
    height: Math.max(0, height - insets.bottom - CONTENT_MARGIN - y),
  };
}

/**
 * The largest step of 1, 1.5 and 2 at or below the device pixel ratio whose
 * backing store (CSS size times the factor, squared) fits the budget. Never
 * below 1: a screen so large that even k = 1 exceeds the budget still renders.
 */
export function compactRenderK(cssWidth: number, cssHeight: number, devicePixelRatio: number | undefined): RenderK {
  const dpr = dim(devicePixelRatio) || 1;
  const steps: RenderK[] = [2, 1.5, 1];
  for (const k of steps) {
    if (k > dpr) continue;
    if (cssWidth * k * cssHeight * k <= BACKING_STORE_BUDGET) return k;
  }
  return 1;
}

/**
 * Resolve the screen. Total: unreadable sizes fall back to the reference
 * phone (compact) or the design window (wide) rather than throwing into boot.
 */
export function resolveScreenMetrics(env: ScreenEnv): ScreenMetrics {
  const width = dim(env.viewportWidth);
  const height = dim(env.viewportHeight);
  const orientation = width && height && height > width ? 'portrait' : 'landscape';

  if (!env.coarsePointer) {
    return {
      profile: 'wide',
      device: 'desktop',
      orientation,
      presentation: 'fill',
      variant: 'regular',
      design: { ...WIDE_DESIGN },
      content: { x: 0, y: 0, ...WIDE_DESIGN },
      scale: 1,
      renderK: 1,
    };
  }

  const shortSide = width && height ? Math.min(width, height) : width || height;
  const device: ScreenDevice = shortSide <= PHONE_MAX_SHORT_SIDE ? 'phone' : 'tablet';

  if (device === 'phone' && width && height) {
    const insets = insetsOf(env.insets);
    return {
      profile: 'compact',
      device,
      orientation,
      presentation: orientation === 'portrait' ? 'rotate' : 'fill',
      variant: orientation === 'landscape' && height <= SHORT_MAX_HEIGHT ? 'short' : 'regular',
      design: { width, height },
      content: contentBox(width, height, insets),
      scale: 1,
      renderK: compactRenderK(width, height, env.devicePixelRatio),
    };
  }

  // A tablet, or a phone whose size could not be read: the reference phone's
  // composition, scaled up. The design space grows to cover the whole screen
  // at that scale (the bands the mocks fill with stage or commander art), and
  // the reference content box sits centred in it.
  const ref = REFERENCE_PHONE;
  const refContent = contentBox(ref.width, ref.height, { ...ref.insets });
  if (device === 'phone' || !width || !height) {
    return {
      profile: 'compact',
      device,
      orientation,
      presentation: 'fill',
      variant: 'regular',
      design: { width: ref.width, height: ref.height },
      content: refContent,
      scale: 1,
      renderK: compactRenderK(ref.width, ref.height, env.devicePixelRatio),
    };
  }
  // Landscape: scaled to the width (mock P5); if a squat screen cannot hold
  // that height, the height decides, so nothing is cut off. Upright: 96% of
  // the width, letterboxed (mock P4).
  const landscape = orientation === 'landscape';
  const scale = landscape
    ? Math.min(width / ref.width, height / ref.height)
    : (width * UPRIGHT_TABLET_WIDTH_SHARE) / ref.width;
  const design = { width: width / scale, height: height / scale };
  const offsetX = (design.width - ref.width) / 2;
  const offsetY = (design.height - ref.height) / 2;
  return {
    profile: 'compact',
    device,
    orientation,
    presentation: landscape ? 'fill' : 'letterbox',
    variant: 'regular',
    design,
    content: { ...refContent, x: refContent.x + offsetX, y: refContent.y + offsetY },
    scale,
    renderK: compactRenderK(width, height, env.devicePixelRatio),
  };
}

/**
 * The game canvas under the compact profile, in device px: the screen's own
 * CSS size times the render factor, so Phaser's FIT mode fills the screen
 * with no letterbox of its own (C1). Never below 1x1.
 */
export function compactCanvasSize(m: ScreenMetrics): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(m.design.width * m.scale * m.renderK)),
    height: Math.max(1, Math.round(m.design.height * m.scale * m.renderK)),
  };
}

/**
 * The camera zoom that fits the 1280x720 design window inside a canvas (C2):
 * how a scene not yet migrated to the compact layout keeps drawing as it does
 * today, centred, with the background colour around it.
 */
export function designWindowZoom(canvasWidth: number, canvasHeight: number, widthShare = 1): number {
  const w = dim(canvasWidth) * widthShare;
  const h = dim(canvasHeight);
  if (!w || !h) return 1;
  return Math.min(w / 1280, h / 720);
}

/**
 * The canvas rect the fitted 1280x720 window covers, in canvas px, rounded to
 * whole pixels. A scene's camera is clipped to it, so objects a scene parks
 * just off its 1280x720 stage stay off screen (the emulator showed a panel
 * parked right of x 1280 beside the board, 2026-10-10).
 */
export function designWindowViewport(canvasWidth: number, canvasHeight: number, widthShare = 1): { x: number; y: number; width: number; height: number } {
  const zoom = designWindowZoom(canvasWidth, canvasHeight, widthShare);
  const width = Math.round(1280 * zoom);
  const height = Math.round(720 * zoom);
  return { x: Math.round((dim(canvasWidth) - width) / 2), y: Math.round((dim(canvasHeight) - height) / 2), width, height };
}

/**
 * The compact profile ships behind a switch until wave 1's camera fit is
 * proven on a real phone (M6): `?layout=compact` in the page address turns it
 * on for that load. Without it, every device boots as it does today.
 */
export function compactLayoutRequested(search: string): boolean {
  try {
    return new URLSearchParams(search).get('layout') === 'compact';
  } catch {
    return false;
  }
}
