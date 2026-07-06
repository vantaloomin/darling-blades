import Phaser from 'phaser';
import { Art, ArtResolver } from '../art/ArtResolver';
import manifest from '../data/art-manifest.json';
import { CARD_DB } from '../data/catalog';
import { PREMIUM_HEROES } from '../data/heroes';
import { bakeCardFrames } from '../ui/CardFrameFactory';
import { bakeFxTextures } from '../ui/fx/HoloEffects';
import { bakeManaSymbols } from '../ui/ManaSymbols';
import { applySceneSettings, sceneTextureKey } from '../ui/SceneBackdrop';

/** Scene/menu art keys from the manifest (empty until scene PNGs generate). */
const SCENE_KEYS: string[] = (manifest as { scenes?: string[] }).scenes ?? [];

/**
 * Fonts → shared texture baking (frames, pips, fx) → placeholder art atlas →
 * manifest-listed real art. Everything the rest of the game renders with.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    // Every other scene gets its render-scale camera zoom via applyBackdrop;
    // Preload draws its loading label before any backdrop exists, so it
    // applies the settings hook itself — otherwise at k>1 the unzoomed camera
    // shows the whole 1280k×720k canvas and the design-space label below
    // would sit in the top-left quadrant.
    applySceneSettings(this);
    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;
    const height = 720;

    // Boot-loading backdrop (docs/scene-art.md `scene-preload`): BootScene
    // queued it, so if it's on disk the texture is ready here. Added before the
    // label so the label renders over it; no dim needed at these luminances.
    const bgKey = sceneTextureKey('scene-preload');
    if (this.textures.exists(bgKey)) {
      const img = this.add.image(width / 2, height / 2, bgKey);
      img.setScale(Math.max(width / img.width, height / img.height));
    }

    const label = this.add
      .text(width / 2, height / 2, 'Unsheathing Blades…', {
        fontFamily: 'Georgia, serif',
        fontSize: '22px',
        color: '#8f83a8',
      })
      .setOrigin(0.5);
    this.load.on('progress', (v: number) => {
      label.setText(`Unsheathing Blades… ${Math.round(v * 100)}%`);
    });

    Art.resolver = new ArtResolver(this, CARD_DB);
    Art.resolver.queueRealArt();

    // Queue every manifest-listed scene/menu backdrop as `scene-<key>` (same
    // zero-404 discipline as cards — only files the manifest lists are ever
    // requested). `scene-preload` is the exception: it decorates THIS scene's
    // own load screen, so BootScene queues it before us; skip it here.
    for (const key of SCENE_KEYS) {
      if (key === 'scene-preload') continue;
      this.load.image(sceneTextureKey(key), `assets/art/scenes/${key}.png`);
    }

    // Premium hero portraits (bespoke PNGs). A missing file logs a load error
    // and is skipped — resolveHeroPortrait checks textures.exists and falls back
    // to the card-based hero/face, so the duel never breaks.
    for (const h of PREMIUM_HEROES) {
      this.load.image(h.textureKey, `assets/art/heroes/${h.textureKey}.png`);
    }
  }

  async create(): Promise<void> {
    // Wait for webfonts so no Text object bakes with a fallback font.
    try {
      await Promise.all([
        document.fonts.load('700 17px Cinzel'),
        document.fonts.load('500 17px Cinzel'),
        document.fonts.load('400 12px Inter'),
        document.fonts.load('600 12px Inter'),
      ]);
      await document.fonts.ready;
    } catch {
      // offline — system serif fallback is fine
    }

    bakeManaSymbols(this);
    bakeCardFrames(this);
    bakeFxTextures(this);
    Art.resolver!.generatePlaceholders();

    this.scene.start('MainMenu');
  }
}
