/**
 * Animation-level policy (SaveData.settings.animations) — the pure decision
 * table mapping the setting to (a) FX capability caps and (b) the scene
 * tween time-scale. Headless like the rest of src/platform; the consumers
 * are src/ui/fx/FXSupport.ts (intersects these caps with the quality tier's
 * FxPolicy row) and src/ui/SceneBackdrop.ts (applies the tween time-scale in
 * the per-scene applyBackdrop hook).
 */

export type AnimationLevel = 'full' | 'reduced' | 'off';

/** Caps the animations setting places on the FX families (FXSupport.FxPolicy shape). */
export interface AnimFxCaps {
  iridescence: boolean;
  shine: boolean;
  packGlow: boolean;
  particleScale: number;
}

/**
 * The locked definition (wave-2 spec):
 * - 'full'    → no caps.
 * - 'reduced' → iridescence:false, packGlow:false, shine:true, particleScale:0.5.
 * - 'off'     → everything false / 0.
 */
const CAPS: Record<AnimationLevel, AnimFxCaps> = {
  full: { iridescence: true, shine: true, packGlow: true, particleScale: 1 },
  reduced: { iridescence: false, shine: true, packGlow: false, particleScale: 0.5 },
  off: { iridescence: false, shine: false, packGlow: false, particleScale: 0 },
};

export function animFxCaps(level: AnimationLevel): AnimFxCaps {
  return CAPS[level];
}

/**
 * 'off' fast-forwards tweens instead of removing them: a high timeScale means
 * every tween completes almost instantly but its onComplete/callbacks STILL
 * fire, so tween-driven game flow (pack reveals, HUD syncs) never deadlocks.
 * 'reduced' deliberately keeps 1 — it trims FX density, not motion.
 */
export const TWEEN_TIMESCALE_OFF = 20;

export function animTimeScale(level: AnimationLevel): number {
  return level === 'off' ? TWEEN_TIMESCALE_OFF : 1;
}
