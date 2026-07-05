import Phaser from 'phaser';
import manifest from '../data/art-manifest.json';
import { IRIDESCENCE_KEY, IridescencePostFX } from '../ui/fx/IridescencePostFX';
import { sceneTextureKey } from '../ui/SceneBackdrop';

/** Scene art keys from the build-time manifest (empty until scene PNGs exist). */
const SCENE_KEYS: string[] = (manifest as { scenes?: string[] }).scenes ?? [];

/** Instant scene: renderer/pipeline setup, then straight to Preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // The preload backdrop must be ready by the time PreloadScene displays it,
    // so Boot (not Preload) queues it — Preload's own load queue is what it
    // decorates. Only loaded when the manifest lists it (zero 404s); the
    // texture persists into PreloadScene via the global TextureManager.
    if (SCENE_KEYS.includes('scene-preload')) {
      this.load.image(sceneTextureKey('scene-preload'), 'assets/art/scenes/scene-preload.png');
    }
  }

  create(): void {
    if (this.game.renderer.type === Phaser.WEBGL) {
      const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      renderer.pipelines.addPostPipeline(IRIDESCENCE_KEY, IridescencePostFX);
    }
    this.scene.start('Preload');
  }
}
