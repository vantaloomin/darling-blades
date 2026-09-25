import Phaser from 'phaser';
import manifest from '../data/art-manifest.json';
import { Art, ArtResolver, bakeArtLoadingTexture } from '../art/ArtResolver';
import { artFileUrl, artKeyFor, artTextureKey } from '../art/artLoader';
import { CARD_DB } from '../data/catalog';
import type { CardDef } from '../engine/types';
import { bakeCardFrames } from '../ui/CardFrameFactory';
import { CardView } from '../ui/CardView';
import { bakeFxTextures } from '../ui/fx/HoloEffects';
import { bakeManaSymbols } from '../ui/ManaSymbols';
import { gameFileUrl } from './gameFiles';
import { appearanceVariant, toCardDef } from './logic';
import type { BuilderStore } from './store';

export const CARD_BUILDER_GAME_CONFIG = { width: 520, height: 660 } as const;
const CARD_SCALE = 1.45;

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
    this.cameras.main.setBackgroundColor('#0a0812');
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
