import Phaser from 'phaser';
import { qualityTier, type QualityTier } from '../../platform/quality';

/** The FXSupport shape consumed by the real CardView/HoloEffects modules. */
export interface FxPolicy {
  iridescence: boolean;
  shine: boolean;
  packGlow: boolean;
  particleScale: number;
}

export function fxAvailable(scene: Phaser.Scene): boolean {
  return scene.game.renderer.type === Phaser.WEBGL;
}

/**
 * Proof-sheet-only equivalent of FXSupport's quality gate. The page forces
 * `qualityTier` to full and has no save-backed animation setting, so the only
 * remaining gate is the actual renderer capability.
 */
export function fxPolicy(scene: Phaser.Scene): FxPolicy {
  const tier: QualityTier = qualityTier();
  const full = tier === 'full';
  const webgl = fxAvailable(scene);
  return {
    iridescence: full && webgl,
    shine: full && webgl,
    packGlow: full && webgl,
    particleScale: full ? 1 : 0.4,
  };
}
