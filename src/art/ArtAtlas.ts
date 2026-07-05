import Phaser from 'phaser';
import { ART_H, ART_W } from './PlaceholderArtGenerator';

const COLS = 6;
const ROWS = 5;
const PAGE_W = ART_W * COLS; // 1920
const PAGE_H = ART_H * ROWS; // 2000

/**
 * Stitches generated card art into shared DynamicTexture pages (30 arts per
 * page, one GPU texture bind each) instead of one texture per card. Frames
 * are registered as `art-<cardId>` on the page texture.
 */
export class ArtAtlas {
  private pageCount = 0;
  private slot = 0;
  private scratch: Phaser.Textures.CanvasTexture;
  private frames = new Map<string, { textureKey: string; frameName: string }>();

  constructor(private scene: Phaser.Scene) {
    const existing = scene.textures.get('art-scratch');
    this.scratch =
      existing && existing.key === 'art-scratch'
        ? (existing as Phaser.Textures.CanvasTexture)
        : scene.textures.createCanvas('art-scratch', ART_W, ART_H)!;
  }

  private currentPageKey(): string {
    return `art-page-${this.pageCount - 1}`;
  }

  add(cardId: string, draw: (ctx: CanvasRenderingContext2D) => void): void {
    if (this.frames.has(cardId)) return;

    if (this.slot === 0 || this.slot >= COLS * ROWS) {
      this.scene.textures.addDynamicTexture(`art-page-${this.pageCount}`, PAGE_W, PAGE_H);
      this.pageCount++;
      this.slot = 0;
    }

    const ctx = this.scratch.getContext();
    ctx.save();
    ctx.clearRect(0, 0, ART_W, ART_H);
    draw(ctx);
    ctx.restore();
    this.scratch.refresh();

    const x = (this.slot % COLS) * ART_W;
    const y = Math.floor(this.slot / COLS) * ART_H;
    const pageKey = this.currentPageKey();
    const page = this.scene.textures.get(pageKey) as Phaser.Textures.DynamicTexture;
    page.stamp('art-scratch', undefined, x + ART_W / 2, y + ART_H / 2);
    page.add(`art-${cardId}`, 0, x, y, ART_W, ART_H);

    this.frames.set(cardId, { textureKey: pageKey, frameName: `art-${cardId}` });
    this.slot++;
  }

  get(cardId: string): { textureKey: string; frameName: string } | undefined {
    return this.frames.get(cardId);
  }
}
