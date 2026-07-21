import type Phaser from 'phaser';
import manifest from '../data/art-manifest.json';
import type { CardDb } from '../engine/types';
import { isBasic } from '../meta/Collection';
import { qualityTier } from '../platform/quality';
import { ArtAtlas } from './ArtAtlas';
import { drawPlaceholderArt } from './PlaceholderArtGenerator';

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
  private half = new Set<string>((manifest as { half?: string[] }).half ?? []);

  constructor(
    private scene: Phaser.Scene,
    private db: CardDb,
  ) {
    this.atlas = new ArtAtlas(scene);
  }

  /** Queue loader requests for manifest-listed real art. Call in preload(). */
  queueRealArt(): void {
    const preferHalf = qualityTier() === 'lite';
    for (const id of this.real) {
      const dir = preferHalf && this.half.has(id) ? 'cards-half' : 'cards';
      this.scene.load.image(`artfile-${id}`, `assets/art/${dir}/${id}.png`);
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
    const styledKey = landStyle && d && isBasic(this.db, cardId) ? `${artKey}--${landStyle}` : null;
    if (styledKey && this.real.has(styledKey)) return { textureKey: `artfile-${styledKey}` };
    if (this.real.has(artKey)) return { textureKey: `artfile-${artKey}` };
    const slot = this.atlas.get(artKey);
    if (!slot) throw new Error(`ArtResolver: no art generated for ${artKey}`);
    return slot;
  }
}

/** Module singleton — set once by PreloadScene, read by CardView everywhere. */
export const Art: { resolver: ArtResolver | null } = { resolver: null };
