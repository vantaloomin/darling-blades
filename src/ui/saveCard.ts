import type Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
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
 * (missing texture, headless context) so the caller can fall back to a plain
 * message instead of exporting a blank card.
 */
export function composeSaveCardCanvas(
  scene: Phaser.Scene,
  cardId: string,
  lines: SaveCardLines,
): HTMLCanvasElement | null {
  let ref: { textureKey: string; frameName?: string } | undefined;
  try {
    ref = Art.resolver?.getArt(cardId);
  } catch {
    return null; // no art generated for this id — the caller reports it
  }
  if (!ref) return null;
  const texture = scene.textures.get(ref.textureKey);
  if (!texture || texture.key === '__MISSING') return null;
  const frame = texture.get(ref.frameName);
  const source = frame?.source?.image as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!frame || !source) return null;

  const canvas = document.createElement('canvas');
  canvas.width = SAVE_CARD_W;
  canvas.height = SAVE_CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Cover-crop the frame's cut region into the 640×800 cover. Card art ships
  // at the same 0.8 aspect, so this is normally a straight scale.
  const scale = Math.max(SAVE_CARD_W / frame.cutWidth, SAVE_CARD_H / frame.cutHeight);
  const srcW = SAVE_CARD_W / scale;
  const srcH = SAVE_CARD_H / scale;
  const sx = frame.cutX + (frame.cutWidth - srcW) / 2;
  const sy = frame.cutY + (frame.cutHeight - srcH) / 2;
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
