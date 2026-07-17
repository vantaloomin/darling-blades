import Phaser from 'phaser';
import manifest from '../../data/art-manifest.json';
import { Art, ArtResolver } from '../../art/ArtResolver';
import { CARD_DB } from '../../data/catalog';
import { bakeCardFrames } from '../../ui/CardFrameFactory';
import { CardView, CARD_H, CARD_W } from '../../ui/CardView';
import { bakeFxTextures } from '../../ui/fx/HoloEffects';
import { bakeManaSymbols } from '../../ui/ManaSymbols';
import { variantForChoices, visiblePage } from './logic';
import type { CardProofStore } from './store';

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 1080;
const GRID_COLUMNS = 4;
const CARD_GAP = 26;
const GRID_TOP = 34;

export const CARDPROOF_GAME_CONFIG = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};

export class CardProofPreloadScene extends Phaser.Scene {
  constructor() {
    super('CardProofPreload');
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      throw new Error(`Card proof asset failed to load: ${file.key} (${file.url})`);
    });

    Art.resolver = new ArtResolver(this, CARD_DB);
    // ArtResolver is the same manifest-gated loader used by PreloadScene. No
    // card-art path is constructed here; only manifest.cards entries queue.
    Art.resolver.queueRealArt();
  }

  async create(): Promise<void> {
    if (!Art.resolver) throw new Error('Card proof ArtResolver was not initialized');
    for (const id of manifest.cards) {
      if (!this.textures.exists(`artfile-${id}`)) {
        throw new Error(`Card proof manifest texture is missing after load: artfile-${id}`);
      }
    }

    try {
      await document.fonts.ready;
    } catch {
      // System font fallback is still rendered by Phaser if the font promise is unavailable.
    }
    bakeManaSymbols(this);
    bakeCardFrames(this);
    bakeFxTextures(this);
    Art.resolver.generatePlaceholders();
    this.scene.start('CardProof', { store: this.registry.get('cardproof-store') });
  }
}

export class CardProofScene extends Phaser.Scene {
  private views: CardView[] = [];
  private unsubscribe: (() => void) | null = null;
  private store: CardProofStore | null = null;

  constructor() {
    super('CardProof');
  }

  create(data: { store?: CardProofStore }): void {
    this.store = data.store ?? (this.registry.get('cardproof-store') as CardProofStore | null);
    if (!this.store) throw new Error('Card proof store was not provided');
    this.cameras.main.setBackgroundColor('#100d18');
    document.querySelector('#canvas-shell .loading-note')?.remove();
    this.unsubscribe = this.store.subscribe(() => this.renderPage());
    this.input.on('pointermove', this.feedHoloPointer, this);
    this.renderPage();
  }

  private renderPage(): void {
    if (!this.store) return;
    for (const view of this.views) view.destroy();
    this.views = [];

    const state = this.store.getState();
    const page = visiblePage(state);
    const cardWidth = CARD_W * state.scale;
    const cardHeight = CARD_H * state.scale;
    const gridWidth = GRID_COLUMNS * cardWidth + (GRID_COLUMNS - 1) * CARD_GAP;
    const left = (CANVAS_WIDTH - gridWidth) / 2;

    page.matches.forEach((card, index) => {
      const column = index % GRID_COLUMNS;
      const row = Math.floor(index / GRID_COLUMNS);
      const x = left + column * (cardWidth + CARD_GAP) + cardWidth / 2;
      const y = GRID_TOP + row * (cardHeight + CARD_GAP) + cardHeight / 2;
      const view = new CardView(this, x, y).setScale(state.scale);
      view.setCard(card, {
        fx: 'full',
        variant: variantForChoices(state),
        fullArt: state.fullArt,
      });
      this.views.push(view);
    });
  }

  private feedHoloPointer(pointer: Phaser.Input.Pointer): void {
    for (const view of this.views) view.setHoloPointer(pointer.worldX, pointer.worldY);
  }

  shutdown(): void {
    this.input.off('pointermove', this.feedHoloPointer, this);
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const view of this.views) view.destroy();
    this.views = [];
  }
}
