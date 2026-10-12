// Card preview bundle for the art-run tracker page (scripts/art-tracker/page.html).
// It exposes the game's own CardView as window.DBCard so the page can draw a candidate
// image inside the real card frame. See scripts/art-tracker/README.md.
import Phaser from 'phaser';
import { Art, ArtResolver, bakeArtLoadingTexture, type ArtRef } from '../../src/art/ArtResolver';
import type { ArtTier } from '../../src/art/artStore';
import { CARD_DB } from '../../src/data/catalog';
import type { CardDef } from '../../src/engine/types';
import { bakeCardFrames } from '../../src/ui/CardFrameFactory';
import { CARD_H, CARD_W, CardView } from '../../src/ui/CardView';
import { bakeFxTextures } from '../../src/ui/fx/HoloEffects';
import { bakeManaSymbols } from '../../src/ui/ManaSymbols';

class PreviewResolver extends ArtResolver {
  key: string | null = null;
  override getArt(cardId: string, landStyle?: string, tier?: ArtTier): ArtRef {
    if (this.key) return { textureKey: this.key };
    return super.getArt(cardId, landStyle, tier);
  }
}

const SCALE = 2;
const PAD = 12;
const W = CARD_W * SCALE + PAD * 2;
const H = CARD_H * SCALE + PAD * 2;
const DONOR = Object.values(CARD_DB).find((d) => d.types.includes('creature') && !d.supertypes?.includes('basic'))!.id;

let view: CardView | null = null;
let textures: Phaser.Textures.TextureManager | null = null;
let seq = 0;
let resolveReady: () => void;
const ready = new Promise<void>((r) => (resolveReady = r));

class PreviewScene extends Phaser.Scene {
  constructor() { super('Preview'); }
  preload(): void { Art.resolver = new PreviewResolver(this, CARD_DB); }
  async create(): Promise<void> {
    try {
      await Promise.all(['700 17px Cinzel', '500 17px Cinzel', '400 12px Inter', '600 12px Inter'].map((f) => document.fonts.load(f)));
      await document.fonts.ready;
    } catch { /* fall back to system faces */ }
    bakeManaSymbols(this);
    bakeCardFrames(this);
    bakeFxTextures(this);
    bakeArtLoadingTexture(this);
    Art.resolver!.generatePlaceholders();
    view = new CardView(this, W / 2, H / 2).setScale(SCALE);
    textures = this.textures;
    resolveReady();
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

async function show(def: CardDef & { __printed?: string }, art: string | HTMLCanvasElement | null, opts: { fullArt?: boolean } = {}): Promise<void> {
  await ready;
  const mine = ++seq;
  const img = typeof art === 'string' ? await loadImage(art) : art;
  if (mine !== seq || !textures || !view) return;
  const resolver = Art.resolver as PreviewResolver;
  const key = 'preview-art-' + mine;
  if (img instanceof HTMLCanvasElement) textures.addCanvas(key, img);
  else if (img) textures.addImage(key, img);
  resolver.key = img ? key : null;
  view.setCard({ ...def, id: DONOR }, { fx: 'full', fullArt: opts.fullArt === true });
  for (const k of textures.getTextureKeys()) if (k.startsWith('preview-art-') && k !== key) textures.remove(k);
}

function mount(parent: HTMLElement): void {
  new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: W,
    height: H,
    transparent: true,
    audio: { noAudio: true },
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    scene: [PreviewScene],
  });
}

/** The card's real definition when it is already in the game data, so the page prints its real rules text. */
function def(id: string): CardDef | null {
  return CARD_DB[id] ?? null;
}

(window as unknown as { DBCard: unknown }).DBCard = { mount, show, def, ready };
