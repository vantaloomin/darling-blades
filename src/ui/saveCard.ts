import type Phaser from 'phaser';
import { Art, type ArtRef } from '../art/ArtResolver';
import { isArtLoaded, liveArtStore } from '../art/artLoader';
import { theme } from './theme';

/**
 * Save-card rendering and file plumbing: the browser half of the save-card
 * feature (plan-save-cards.md). The byte-level half — embedding and reading
 * the `tEXt` chunk — is `src/meta/SaveImage.ts`, pure and headlessly tested;
 * everything here needs a DOM and therefore lives in the UI layer.
 *
 * Locked decisions (owner, 2026-08-24): a translucent BOTTOM PLATE across the
 * bottom fifth (not a ribbon, not a card frame) carrying DARLING BLADES in the
 * display face, the export date, and one identity line; owned art only, chosen
 * in the export flow; both formats offered with PNG first.
 */

export const SAVE_CARD_W = 640;
export const SAVE_CARD_H = 800;

export interface SaveCardLines {
  /** e.g. "412 / 1,230 cards · Tower rung 17" */
  identity: string;
  /** e.g. "Exported 2026-09-01" */
  date: string;
}

/**
 * Composite the titled cover: the chosen card's art cover-cropped to 640×800
 * with the bottom plate over it. Returns null when the art is unavailable
 * (missing texture, headless context, or a file still streaming in) so the
 * caller can fall back to a plain message instead of exporting a blank card.
 *
 * Unlike the on-screen portraits this is a one-shot bake into a file, so there
 * is nothing to redraw when the art lands: a `pending` answer means the
 * resolver handed back the flat loading stand-in, which must never ship inside
 * a save card. The Profile's picker waits for the owned art before it opens
 * (`awaitArt`), so this is the backstop: a file that failed its load twice
 * settles without its art (`ArtLoaderScene.loadBatch`), and art streaming can
 * later evict a texture the picker saw loaded.
 */
export function composeSaveCardCanvas(
  scene: Phaser.Scene,
  cardId: string,
  lines: SaveCardLines,
): HTMLCanvasElement | null {
  let ref: ArtRef | undefined;
  try {
    ref = Art.resolver?.getArt(cardId);
  } catch {
    return null; // no art generated for this id — the caller reports it
  }
  if (!ref || ref.pending !== undefined) return null;
  const texture = scene.textures.get(ref.textureKey);
  if (!texture || texture.key === '__MISSING') return null;
  const frame = texture.get(ref.frameName);
  const source = frame?.source?.image as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!frame || !source) return null;

  return drawSaveCard(source, { x: frame.cutX, y: frame.cutY, w: frame.cutWidth, h: frame.cutHeight }, lines);
}

/**
 * `composeSaveCardCanvas` for art that streams through the art store (1.9
 * lane D; docs/plan-art-streaming.md section 1, "The decoded copy"). Under
 * WebGL the store closes each texture's decoded copy right after upload, so
 * nothing can read card-art pixels back from a texture: the export asks the
 * store for the file's bytes (the same source and HTTP cache as the texture)
 * and decodes its own copy, which it closes when the cover is drawn. It takes
 * no lease: nothing here draws the card's texture, and a lease would ask for
 * the same file a second time. A procedural placeholder (no art file) draws
 * from its atlas canvas, as before. Null when the bytes cannot be read or
 * decoded.
 *
 * With no store (the 1.8 queue) this is `composeSaveCardCanvas`, unchanged.
 */
export async function composeSaveCardCanvasAsync(
  scene: Phaser.Scene,
  cardId: string,
  lines: SaveCardLines,
): Promise<HTMLCanvasElement | null> {
  const store = liveArtStore();
  if (store === null || store.textureKeyFor(cardId) === null) return composeSaveCardCanvas(scene, cardId, lines);
  try {
    const blob = await store.fetchBlob(cardId);
    if (blob === null) return null;
    const bitmap = await createImageBitmap(blob);
    try {
      return drawSaveCard(bitmap, { x: 0, y: 0, w: bitmap.width, h: bitmap.height }, lines);
    } finally {
      bitmap.close();
    }
  } catch {
    return null; // a file that will not decode: the caller reports the art as unavailable
  }
}

/** The region of the art source to cover-crop from. */
interface SourceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Draw the titled cover from `source`'s `cut` region; null without a 2D context. */
function drawSaveCard(source: CanvasImageSource, cut: SourceRect, lines: SaveCardLines): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = SAVE_CARD_W;
  canvas.height = SAVE_CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Cover-crop the cut region into the 640×800 cover. Card art ships at the
  // same 0.8 aspect, so this is normally a straight scale.
  const scale = Math.max(SAVE_CARD_W / cut.w, SAVE_CARD_H / cut.h);
  const srcW = SAVE_CARD_W / scale;
  const srcH = SAVE_CARD_H / scale;
  const sx = cut.x + (cut.w - srcW) / 2;
  const sy = cut.y + (cut.h - srcH) / 2;
  ctx.drawImage(source, sx, sy, srcW, srcH, 0, 0, SAVE_CARD_W, SAVE_CARD_H);

  // The bottom plate: the bottom fifth, dark and translucent so the art stays
  // clean and the file self-describes when it surfaces in a folder later.
  const plateTop = SAVE_CARD_H - SAVE_CARD_H / 5;
  const plate = ctx.createLinearGradient(0, plateTop - 24, 0, plateTop);
  plate.addColorStop(0, 'rgba(12, 9, 24, 0)');
  plate.addColorStop(1, 'rgba(12, 9, 24, 0.82)');
  ctx.fillStyle = plate;
  ctx.fillRect(0, plateTop - 24, SAVE_CARD_W, 24);
  ctx.fillStyle = 'rgba(12, 9, 24, 0.82)';
  ctx.fillRect(0, plateTop, SAVE_CARD_W, SAVE_CARD_H - plateTop);

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.colors.gold;
  ctx.font = `600 34px ${theme.fonts.display}`;
  ctx.fillText('DARLING BLADES', SAVE_CARD_W / 2, plateTop + 52);
  ctx.fillStyle = theme.colors.body;
  ctx.font = `17px ${theme.fonts.ui}`;
  ctx.fillText(lines.identity, SAVE_CARD_W / 2, plateTop + 90);
  ctx.fillStyle = theme.colors.muted;
  ctx.font = `14px ${theme.fonts.ui}`;
  ctx.fillText(lines.date, SAVE_CARD_W / 2, plateTop + 118);
  return canvas;
}

/**
 * Why `composeSaveCardCanvas` returned null, when the reason is one the player
 * can wait out: the card's art file is still in the loader's queue. False for
 * every other reason, including a file the loader gave up on (it settles
 * without its art, so the stand-in would stay), which is "pick another card".
 */
export function saveCardArtStillLoading(cardId: string): boolean {
  let ref: ArtRef | undefined;
  try {
    ref = Art.resolver?.getArt(cardId);
  } catch {
    return false;
  }
  return ref?.pending !== undefined && !isArtLoaded(cardId);
}

/** PNG-encode a canvas. Rejects only when the browser refuses to encode. */
export function canvasPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The browser could not encode the save card.'));
        return;
      }
      blob.arrayBuffer().then(
        (buffer) => resolve(new Uint8Array(buffer)),
        (error: unknown) => reject(error instanceof Error ? error : new Error(String(error))),
      );
    }, 'image/png');
  });
}

/** Hand the bytes to the browser as a file download (anchor-click pattern). */
export function downloadPngBytes(filename: string, bytes: Uint8Array): void {
  // Copy into a fresh buffer: TS types the view as ArrayBufferLike-backed,
  // which BlobPart refuses; the copy is also what guarantees a plain buffer.
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke off the click's back so the download can start from the URL first.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Ask the player for a PNG file. Resolves null on a cancelled dialog where the
 * browser reports it (the `cancel` event); a browser that reports nothing
 * simply never resolves, which leaves the import modal exactly as it was.
 */
export function pickPngFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,.png';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file.arrayBuffer().then(
        (buffer) => resolve({ name: file.name, bytes: new Uint8Array(buffer) }),
        () => resolve(null),
      );
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
