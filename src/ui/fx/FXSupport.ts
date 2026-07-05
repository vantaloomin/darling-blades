import Phaser from 'phaser';
import { Services } from '../../meta/services';
import { animFxCaps } from '../../platform/animPolicy';
import { qualityTier, type QualityTier } from '../../platform/quality';

/** WebGL FX (preFX/postFX pipelines) availability — checked once, used everywhere. */
export function fxAvailable(scene: Phaser.Scene): boolean {
  return scene.game.renderer.type === Phaser.WEBGL;
}

/**
 * What the current quality tier allows, per FX family. Consumers gate on these
 * flags instead of re-checking renderer type or tier themselves — this table
 * is the single place the lite profile is defined (mobile-lan-plan §1.6).
 */
export interface FxPolicy {
  /** IridescencePostFX post-pipelines (rare ring, foil/radial holo). */
  iridescence: boolean;
  /** preFX shine sweeps (uncommon ring, sheen holo, pack art). */
  shine: boolean;
  /** PackOpening's pulsing postFX glows on the face-down specials. */
  packGlow: boolean;
  /** Multiplier applied to one-shot particle burst quantities. */
  particleScale: number;
}

const POLICIES: Record<QualityTier, FxPolicy> = {
  full: { iridescence: true, shine: true, packGlow: true, particleScale: 1 },
  // lite keeps the cheap stuff (galaxy TileSprite, sparkle emitters — measured
  // trivial in the perf audit) and drops the shader pipelines + dense bursts.
  lite: { iridescence: false, shine: false, packGlow: false, particleScale: 0.4 },
};

/**
 * The effective FX policy for a scene: the tier's table row, intersected with
 * the user's animations setting (src/platform/animPolicy.ts — 'reduced' drops
 * the shader pipelines and halves particles; 'off' kills everything), with the
 * GPU-pipeline flags additionally requiring a WebGL renderer (canvas keeps
 * its existing tint/skip fallbacks regardless of tier).
 *
 * Intersection = most restrictive wins: booleans AND together, particleScale
 * takes the min of the tier row and the setting cap. Consumers read this at
 * scene create(), so a setting change applies on the next scene change (the
 * Settings UI says so).
 */
export function fxPolicy(scene: Phaser.Scene): FxPolicy {
  const p = POLICIES[qualityTier()];
  const caps = animFxCaps(Services.save.data.settings.animations);
  const gl = fxAvailable(scene);
  return {
    iridescence: p.iridescence && caps.iridescence && gl,
    shine: p.shine && caps.shine && gl,
    packGlow: p.packGlow && caps.packGlow && gl,
    particleScale: Math.min(p.particleScale, caps.particleScale),
  };
}
