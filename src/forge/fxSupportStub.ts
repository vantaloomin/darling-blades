import Phaser from 'phaser';
import { qualityTier, type QualityTier } from '../platform/quality';

/**
 * The Forge's stand-in for `src/ui/fx/FXSupport.ts`, swapped in by the alias in
 * `vite.forge.config.ts` (and only there: the game bundle keeps the real one).
 *
 * The real `fxPolicy` reads the player's animations setting from
 * `Services.save`, which would drag the save layer into a page that must never
 * touch the game save: the Forge is served from the same origin as the game,
 * so its localStorage IS the game's. This stub keeps the same exported shape
 * and gates only on the quality tier (the page forces `full`) and on the
 * renderer actually being WebGL. Same shape as the card-proof harness's stub
 * (`src/dev/cardproof/fxSupportStub.ts`), kept separate so the public page does
 * not depend on a developer-only folder.
 */
export interface FxPolicy {
  iridescence: boolean;
  shine: boolean;
  packGlow: boolean;
  particleScale: number;
}

export function fxAvailable(scene: Phaser.Scene): boolean {
  return scene.game.renderer.type === Phaser.WEBGL;
}

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
