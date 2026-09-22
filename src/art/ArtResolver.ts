import type Phaser from 'phaser';
import manifest from '../data/art-manifest.json';
import type { CardDb } from '../engine/types';
import { isBasic } from '../meta/Collection';
import { theme } from '../ui/theme';
import { artFileUrl, artTextureKey } from './artLoader';
import { ArtAtlas } from './ArtAtlas';
import { drawPlaceholderArt } from './PlaceholderArtGenerator';

/** Manifest key convention for a styled basic-land file. */
export const landStyleArtKey = (artKey: string, landStyle: string): string => `${artKey}--${landStyle}`;

/** Neutral stand-in for a real art file that has not streamed in yet. */
export const ART_LOADING_TEXTURE = 'art-loading';
/** Source size of a real card art file; the stand-in matches it so the
 *  cover-crop maths in CardView/BoardCardView is identical. */
const ART_FILE_W = 640;
const ART_FILE_H = 800;

/**
 * Bake the flat card-window-coloured stand-in the resolver falls back to while
 * a real file is still in the loader queue (1.8). Call beside the other
 * PreloadScene bakes; a no-op once baked.
 */
export function bakeArtLoadingTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(ART_LOADING_TEXTURE)) return;
  const tex = scene.textures.createCanvas(ART_LOADING_TEXTURE, ART_FILE_W, ART_FILE_H);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.fillStyle = theme.colors.panelFill;
  ctx.fillRect(0, 0, ART_FILE_W, ART_FILE_H);
  tex.refresh();
}

/**
 * Decides real art vs procedural placeholder per card. Only files listed in
 * the build-time manifest are ever requested (zero runtime 404s). Consumers
 * call getArt() and never know which kind they got.
 *
 * On the `lite` quality tier the loader prefers the half-res 320×400 set
 * (`cards-half/`, built by scripts/gen-art-halfres.ts) — same texture keys,
 * ~4× less VRAM. Cards without a half file (the set is generated
 * incrementally and may trail the full set) gracefully load full-res.
 */
export class ArtResolver {
  private atlas: ArtAtlas;
  private real = new Set<string>(manifest.cards);

  constructor(
    private scene: Phaser.Scene,
    private db: CardDb,
  ) {
    this.atlas = new ArtAtlas(scene);
  }

  /**
   * Queue loader requests for every manifest-listed real art file in one go.
   * The game no longer does this — `ArtLoaderScene` streams the same files in
   * batches beside the running scenes (1.8) — but the card-proof harness
   * (`src/dev/cardproof/`) still wants the whole set up front in its own
   * preload, and keeping one entry point keeps the tier rule single-sourced.
   */
  queueRealArt(): void {
    for (const id of this.real) {
      this.scene.load.image(artTextureKey(id), artFileUrl(id));
    }
  }

  /** Generate placeholder art for every card that has no real file. Call in create(). */
  generatePlaceholders(): void {
    for (const d of Object.values(this.db)) {
      const artKey = d.artRef ?? d.id;
      if (this.real.has(artKey)) continue;
      this.atlas.add(artKey, (ctx) => drawPlaceholderArt(ctx, d));
    }
  }

  getArt(cardId: string, landStyle?: string): { textureKey: string; frameName?: string } {
    const d = this.db[cardId];
    const artKey = d?.artRef ?? cardId;
    const styledKey = landStyle && d && isBasic(this.db, cardId) ? landStyleArtKey(artKey, landStyle) : null;
    if (styledKey && this.real.has(styledKey)) return { textureKey: this.realTextureKey(styledKey) };
    if (this.real.has(artKey)) return { textureKey: this.realTextureKey(artKey) };
    const slot = this.atlas.get(artKey);
    if (!slot) throw new Error(`ArtResolver: no art generated for ${artKey}`);
    return slot;
  }

  /**
   * The real file's texture key, or the neutral stand-in while it is still in
   * the loader queue. This is the BACKSTOP for a consumer that `src/ui/artGate.ts`
   * missed, not the mechanism: a gated scene never sees it. Without it Phaser
   * would draw its green missing-texture square.
   */
  private realTextureKey(artKey: string): string {
    const key = artTextureKey(artKey);
    // No scene in the prototype-built test resolver: treat the texture as present.
    const textures = (this.scene as Phaser.Scene | undefined)?.textures;
    if (!textures || textures.exists(key)) return key;
    return textures.exists(ART_LOADING_TEXTURE) ? ART_LOADING_TEXTURE : key;
  }
}

/** Module singleton — set once by PreloadScene, read by CardView everywhere. */
export const Art: { resolver: ArtResolver | null } = { resolver: null };
