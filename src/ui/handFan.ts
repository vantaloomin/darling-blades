/**
 * Pure hand-fan layout math for the duel scene's hand row.
 *
 * Generalizes the flat-row math previously inlined in DuelScene.syncHand():
 * spacing shrinks first to fit the span, and only when cards would overlap
 * past readability (spacing < shrinkBelowSpacing) does the card scale drop
 * from baseScale to smallScale, recomputing spacing at the smaller scale
 * exactly once (no fixpoint loop — mirrors the scene's original behavior).
 * On top of that flat row this adds the fan decoration: a per-card tilt
 * (clamped to maxAngleDeg) and a parabolic arc drop so edge cards sit below
 * the center baseline.
 *
 * PURE module: no Phaser, no browser APIs, no side effects — importable from
 * Vitest and from any layer. All layout values are 1280x720 design-space px.
 */

export interface FanSlot {
  /** Horizontal offset from the fan's center-x (symmetric around 0). */
  dx: number;
  /** Vertical offset from the rest baseline; dy >= 0 means dropped below it. */
  dy: number;
  /** Card tilt in degrees (negative left of center, positive right of it). */
  angleDeg: number;
}

export interface FanLayout {
  /** Card scale to render every slot at. */
  scale: number;
  /** Center-to-center horizontal distance between adjacent cards. */
  spacing: number;
  /** One slot per card, left to right. Empty when n = 0. */
  slots: FanSlot[];
}

export interface FanOpts {
  /** Total horizontal width available to the fan (design-space px). */
  span: number;
  /** Unscaled card width (CardView CARD_W = 300). */
  cardW: number;
  /** Resting card scale. Default 0.6. */
  baseScale?: number;
  /** Fallback scale once cards overlap past readability. Default 0.52. */
  smallScale?: number;
  /** Spacing threshold below which the scale shrink kicks in. Default 78. */
  shrinkBelowSpacing?: number;
  /** Spacing cap so small hands don't spread wall-to-wall. Default 150. */
  maxSpacing?: number;
  /** Tilt clamp for large hands. Default 10. */
  maxAngleDeg?: number;
  /** Tilt added per card away from the fan center. Default 3. */
  anglePerCardDeg?: number;
  /** How far (px) the outermost cards drop below the baseline. Default 16. */
  arcDrop?: number;
}

/**
 * Compute the fan layout for a hand of `n` cards. Deterministic pure math;
 * every output is finite for any n >= 0. n = 0 yields empty slots, n = 1 a
 * single centered flat slot.
 */
export function fanLayout(n: number, opts: FanOpts): FanLayout {
  const {
    span,
    cardW,
    baseScale = 0.6,
    smallScale = 0.52,
    shrinkBelowSpacing = 78,
    maxSpacing = 150,
    maxAngleDeg = 10,
    anglePerCardDeg = 3,
    arcDrop = 16,
  } = opts;

  const spacingFor = (scale: number): number =>
    n > 1 ? Math.min(maxSpacing, (span - cardW * scale) / (n - 1)) : 0;

  let scale = baseScale;
  let spacing = spacingFor(scale);
  if (n > 1 && spacing < shrinkBelowSpacing) {
    scale = smallScale;
    spacing = spacingFor(scale);
  }

  const slots: FanSlot[] = [];
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const off = i - mid; // signed slots-from-center; 0 at the fan center
    const dx = off * spacing;
    const angleDeg = Math.max(-maxAngleDeg, Math.min(maxAngleDeg, off * anglePerCardDeg));
    // Parabolic arc: t in [-1, 1] across the fan, edges drop by arcDrop,
    // center rests on the baseline. A single card lies flat and centered.
    const t = n > 1 ? off / mid : 0;
    const dy = arcDrop * t * t;
    slots.push({ dx, dy, angleDeg });
  }

  return { scale, spacing, slots };
}
