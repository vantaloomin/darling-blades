import Phaser from 'phaser';
import manifest from '../data/art-manifest.json';
import { Art, ArtResolver, bakeArtLoadingTexture } from '../art/ArtResolver';
import { artFileUrl, artKeyFor, artTextureKey } from '../art/artLoader';
import { CARD_DB } from '../data/catalog';
import type { CardDef } from '../engine/types';
import { bakeCardFrames } from '../ui/CardFrameFactory';
import { CARD_H, CARD_W, CardView } from '../ui/CardView';
import { bakeFxTextures } from '../ui/fx/HoloEffects';
import { bakeManaSymbols } from '../ui/ManaSymbols';
import { gameFileUrl } from './gameFiles';
import { appearanceVariant, toCardDef } from './logic';
import type { BuilderStore } from './store';

export const CARD_BUILDER_GAME_CONFIG = { width: 520, height: 660 } as const;
const CARD_SCALE = 1.45;
const BACKGROUND = '#0a0812';

/**
 * Save Image renders the card at twice its canonical size: 600 x 840, the
 * resolution the card frames are baked at (CardFrameFactory FRAME_W/FRAME_H)
 * and the resolution CardView bakes its text at, so nothing is upscaled.
 */
export const CARD_IMAGE_SCALE = 2;
/** CardView draws the legendary crown 4 px above the card's top edge. */
const CROWN_OVERHANG = 4;

export interface CardImage {
  blob: Blob;
  width: number;
  height: number;
}

interface PixelRect { x: number; y: number; w: number; h: number }

/** Pixels of the frame just drawn, top row first, straight (not premultiplied) alpha. */
function readFramePixels(game: Phaser.Game, rect: PixelRect): Uint8ClampedArray {
  const { x, y, w, h } = rect;
  const renderer = game.renderer;
  if (renderer.type === Phaser.WEBGL) {
    const gl = (renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
    const raw = new Uint8Array(w * h * 4);
    gl.readPixels(x, gl.drawingBufferHeight - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const premultiplied = gl.getContextAttributes()?.premultipliedAlpha !== false;
    const out = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row += 1) {
      const from = (h - 1 - row) * w * 4;
      const to = row * w * 4;
      for (let index = 0; index < w * 4; index += 4) {
        const alpha = raw[from + index + 3];
        const unmultiply = premultiplied && alpha > 0 && alpha < 255 ? 255 / alpha : 1;
        out[to + index] = raw[from + index] * unmultiply;
        out[to + index + 1] = raw[from + index + 1] * unmultiply;
        out[to + index + 2] = raw[from + index + 2] * unmultiply;
        out[to + index + 3] = alpha;
      }
    }
    return out;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas for the card image');
  context.drawImage(game.canvas, x, y, w, h, 0, 0, w, h);
  return context.getImageData(0, 0, w, h).data;
}

async function encodePng(pixels: Uint8ClampedArray, width: number, height: number): Promise<CardImage> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas for the card image');
  context.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The card image could not be encoded');
  return { blob, width, height };
}

/** Art keys with a real file on the site (the build-time manifest). */
const REAL_ART = new Set<string>(manifest.cards);

/** The URL of one card-art file, as the Forge page reaches it (see gameFiles.ts). */
export function forgeArtUrl(artKey: string): string {
  return gameFileUrl(artFileUrl(artKey, 'full'));
}

/**
 * The faces CardView draws with, the same four the game's PreloadScene waits
 * for. The @font-face rules themselves are in forge/index.html.
 */
const FONT_FACES_IN_USE = ['700 17px Cinzel', '500 17px Cinzel', '400 12px Inter', '600 12px Inter'] as const;
const FONT_FAMILIES = ['Cinzel', 'Inter'] as const;

export interface FontFaceStatus {
  family: string;
  weight: string;
  status: FontFaceLoadStatus;
}

/** Every declared Cinzel/Inter face on the page and whether it actually loaded. */
export function forgeFontStatus(): FontFaceStatus[] {
  const faces: FontFaceStatus[] = [];
  document.fonts.forEach((face) => {
    const family = face.family.replace(/^["']|["']$/g, '');
    if ((FONT_FAMILIES as readonly string[]).includes(family)) {
      faces.push({ family, weight: face.weight, status: face.status });
    }
  });
  return faces;
}

/** True when each of the game's two families has a face that finished loading. */
export function forgeFontsLoaded(): boolean {
  const faces = forgeFontStatus();
  return FONT_FAMILIES.every((family) => faces.some((face) => face.family === family && face.status === 'loaded'));
}

/**
 * Load the webfonts before the first Text bakes, so the card never renders with
 * a system fallback. A face only downloads once something asks for it, so the
 * faces in use are requested explicitly (as PreloadScene does for the game).
 */
async function loadForgeFonts(): Promise<void> {
  try {
    await Promise.all(FONT_FACES_IN_USE.map((face) => document.fonts.load(face)));
    await document.fonts.ready;
  } catch {
    // Reported below: the status check is the single place a failure surfaces.
  }
  if (!forgeFontsLoaded()) {
    const seen = forgeFontStatus().map((face) => `${face.family} ${face.weight} ${face.status}`).join(', ');
    console.warn(`The Forge could not load the card webfonts (${seen || 'no faces declared'}).`);
  }
}

export class CardBuilderPreloadScene extends Phaser.Scene {
  constructor() {
    super('CardBuilderPreload');
  }

  preload(): void {
    // No card art is queued here. The card scene streams the one file it draws
    // (CardBuilderScene.requestDonorArt); the picker grid uses lazy <img>s.
    Art.resolver = new ArtResolver(this, CARD_DB);
  }

  async create(): Promise<void> {
    if (!Art.resolver) throw new Error('Card Builder ArtResolver was not initialized');
    await loadForgeFonts();
    bakeManaSymbols(this);
    bakeCardFrames(this);
    bakeFxTextures(this);
    // The flat stand-in ArtResolver.getArt returns for a real file that has not
    // landed yet, so the first card draws at once instead of waiting on art.
    bakeArtLoadingTexture(this);
    Art.resolver.generatePlaceholders();
    this.scene.start('CardBuilder', { store: this.registry.get('cardbuilder-store') });
  }
}

export class CardBuilderScene extends Phaser.Scene {
  private store: BuilderStore | null = null;
  private view: CardView | null = null;
  private unsubscribe: (() => void) | null = null;
  /** Art keys already handed to the loader (loaded, in flight, or failed). */
  private readonly requestedArt = new Set<string>();
  /** `performance.now()` when the first card was drawn (read by the ?qa=1 probe). */
  firstDrawnAt: number | null = null;
  /** The art texture the card was last drawn with (read by the ?qa=1 probe). */
  renderedArtTexture: string | null = null;

  constructor() {
    super('CardBuilder');
  }

  create(data: { store?: BuilderStore }): void {
    this.store = data.store ?? (this.registry.get('cardbuilder-store') as BuilderStore | null);
    if (!this.store) throw new Error('Card Builder store was not provided');
    this.cameras.main.setBackgroundColor(BACKGROUND);
    document.querySelector('#canvas-shell .loading-note')?.remove();
    this.view = new CardView(
      this,
      CARD_BUILDER_GAME_CONFIG.width / 2,
      CARD_BUILDER_GAME_CONFIG.height / 2,
    ).setScale(CARD_SCALE);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onArtLoadError, this);
    this.unsubscribe = this.store.subscribe(() => this.renderCard());
    this.input.on('pointermove', this.feedHoloPointer, this);
    this.renderCard();
  }

  private renderCard(): void {
    if (!this.store || !this.view) return;
    const state = this.store.getState();
    const card = toCardDef(state) as CardDef;
    this.requestDonorArt(card.id);
    this.view.setCard(card, {
      fx: 'full',
      variant: appearanceVariant(state),
      fullArt: state.appearance.fullArt,
    });
    this.renderedArtTexture = Art.resolver?.getArt(card.id).textureKey ?? null;
    if (this.firstDrawnAt === null) this.firstDrawnAt = performance.now();
  }

  /**
   * Stream the art for the card on screen, one file at a time: until it lands,
   * ArtResolver hands CardView the loading stand-in, and the file's arrival
   * re-renders the card. Cards whose art is procedural need no file.
   */
  private requestDonorArt(cardId: string): void {
    const artKey = artKeyFor(cardId);
    if (!REAL_ART.has(artKey) || this.requestedArt.has(artKey)) return;
    const textureKey = artTextureKey(artKey);
    if (this.textures.exists(textureKey)) return;
    this.requestedArt.add(artKey);
    this.load.image(textureKey, forgeArtUrl(artKey));
    this.load.once(`filecomplete-image-${textureKey}`, () => {
      if (this.store && artKeyFor(this.store.getState().artDonorId) === artKey) this.renderCard();
    });
    this.load.start();
  }

  private onArtLoadError(file: Phaser.Loader.File): void {
    // The card keeps the loading stand-in; the page stays usable.
    console.warn(`The Forge could not load card art: ${file.key} (${String(file.url)})`);
  }

  /**
   * The card as displayed (frame, art, text, the current holo finish as a
   * still) as a PNG with a transparent background, at CARD_IMAGE_SCALE. The
   * canvas is enlarged for one frame (same aspect, so its size on the page
   * does not change), the card is drawn at the export scale over a clear
   * background, the pixels are read as that frame finishes, and everything is
   * put back. The frame has to be rendered, so the game loop must be running.
   */
  async captureCardImage(timeoutMs = 20000): Promise<CardImage> {
    const view = this.view;
    if (!view) throw new Error('There is no card to capture yet');
    const base = CARD_BUILDER_GAME_CONFIG;
    const factor = CARD_IMAGE_SCALE / CARD_SCALE;
    // Even sizes put the card's edges on whole pixels.
    const width = 2 * Math.ceil((base.width * factor) / 2);
    const height = 2 * Math.ceil((base.height * factor) / 2);
    const overhang = view.card?.supertypes?.includes('legendary') ? CROWN_OVERHANG * CARD_IMAGE_SCALE : 0;
    const rect: PixelRect = {
      x: width / 2 - (CARD_W * CARD_IMAGE_SCALE) / 2,
      y: height / 2 - (CARD_H * CARD_IMAGE_SCALE) / 2 - overhang,
      w: CARD_W * CARD_IMAGE_SCALE,
      h: CARD_H * CARD_IMAGE_SCALE + overhang,
    };
    const camera = this.cameras.main;
    this.scale.setGameSize(width, height);
    view.setPosition(width / 2, height / 2).setScale(CARD_IMAGE_SCALE);
    camera.setBackgroundColor('rgba(0,0,0,0)');
    try {
      const pixels = await new Promise<Uint8ClampedArray>((resolve, reject) => {
        const renderer = this.game.renderer;
        const onFrame = (): void => {
          window.clearTimeout(timer);
          try {
            resolve(readFramePixels(this.game, rect));
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        };
        const timer = window.setTimeout(() => {
          renderer.off(Phaser.Renderer.Events.POST_RENDER, onFrame);
          reject(new Error('The card was not drawn in time'));
        }, timeoutMs);
        renderer.once(Phaser.Renderer.Events.POST_RENDER, onFrame);
      });
      return await encodePng(pixels, rect.w, rect.h);
    } finally {
      this.scale.setGameSize(base.width, base.height);
      view.setPosition(base.width / 2, base.height / 2).setScale(CARD_SCALE);
      camera.setBackgroundColor(BACKGROUND);
    }
  }

  private feedHoloPointer(pointer: Phaser.Input.Pointer): void {
    this.view?.setHoloPointer(pointer.worldX, pointer.worldY);
  }

  shutdown(): void {
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onArtLoadError, this);
    this.input.off('pointermove', this.feedHoloPointer, this);
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.view?.destroy();
    this.view = null;
  }
}
