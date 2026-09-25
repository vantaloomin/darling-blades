/**
 * Turning an image from outside the page (a chosen or dropped file, or one
 * embedded in an imported set) into a StoredImage the Forge keeps.
 *
 * Every input is hostile until the browser has decoded it:
 * 1. A chosen file over 20 MB is refused before it is read.
 * 2. Its header must be one of the accepted formats (PNG, JPEG, WebP, GIF)
 *    and declare a sane pixel size (customArt.readImageHeader), so SVG, HTML
 *    and decompression bombs never reach the decoder.
 * 3. It is decoded with createImageBitmap: anything that does not decode is
 *    refused. Nothing is fetched: bytes become a Blob, never a URL.
 * 4. A chosen file is downscaled so its long side is at most 1600 px and
 *    re-encoded: WebP at quality 0.85 (which keeps transparency), or where the
 *    browser cannot encode WebP, PNG for a picture with transparency and JPEG
 *    at 0.85 otherwise. An encoding over the per-image cap is redone smaller.
 * 5. An image embedded in an imported set keeps its exact bytes (so an export
 *    and its import match byte for byte) when it decodes, is already within
 *    1600 px and is not a GIF; otherwise it goes through step 4.
 *
 * Browser-side (canvas, createImageBitmap); no Phaser.
 */
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_SIDE,
  MAX_UPLOAD_BYTES,
  base64ToBytes,
  imageIdFor,
  parseImageDataUrl,
  readImageHeader,
  type AcceptedImageType,
} from './customArt';
import type { StoredImage } from './imageStore';

export type IntakeProblem = 'too-large' | 'unreadable';
export type IntakeResult =
  | { ok: true; image: StoredImage; bitmap: ImageBitmap }
  | { ok: false; problem: IntakeProblem };

const ENCODE_QUALITY = 0.85;
/** Each retry for an encoding over the cap shrinks the picture to this share of its size. */
const SHRINK_STEP = 0.8;

function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No 2D canvas');
  return { canvas, context };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** True when any pixel is not fully opaque. */
export function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data = context.getImageData(0, 0, width, height).data;
  for (let index = 3; index < data.length; index += 4) if (data[index] < 255) return true;
  return false;
}

/** Decode bytes the header check accepted. Null when the browser can't. */
async function decode(bytes: Uint8Array, type: AcceptedImageType, hint: ImageBitmapOptions | null): Promise<ImageBitmap | null> {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type });
  try {
    const bitmap = hint === null ? await createImageBitmap(blob) : await createImageBitmap(blob, hint);
    if (bitmap.width < 1 || bitmap.height < 1) {
      bitmap.close();
      return null;
    }
    return bitmap;
  } catch {
    return null;
  }
}

/** The picture drawn at a size whose long side is at most `limit`. */
function drawScaled(bitmap: ImageBitmap, limit: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const target = canvasOf(width, height);
  target.context.imageSmoothingEnabled = true;
  target.context.imageSmoothingQuality = 'high';
  target.context.drawImage(bitmap, 0, 0, width, height);
  return target;
}

async function encodeCanvas(canvas: HTMLCanvasElement, hasAlpha: boolean): Promise<Blob | null> {
  const webp = await toBlob(canvas, 'image/webp', ENCODE_QUALITY);
  // A browser that can't encode WebP hands back a PNG instead.
  if (webp?.type === 'image/webp') return webp;
  return hasAlpha ? toBlob(canvas, 'image/png') : toBlob(canvas, 'image/jpeg', ENCODE_QUALITY);
}

/** Downscale, re-encode and identify a decoded picture. */
async function reencode(source: ImageBitmap): Promise<IntakeResult> {
  let limit = MAX_IMAGE_SIDE;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { canvas, context } = drawScaled(source, limit);
    const hasAlpha = hasTransparency(context, canvas.width, canvas.height);
    const blob = await encodeCanvas(canvas, hasAlpha);
    if (!blob) return { ok: false, problem: 'unreadable' };
    if (blob.size <= MAX_IMAGE_BYTES) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const header = readImageHeader(bytes);
      const bitmap = header ? await decode(bytes, header.type, null) : null;
      if (!header || !bitmap) return { ok: false, problem: 'unreadable' };
      return {
        ok: true,
        bitmap,
        image: { id: await imageIdFor(bytes), type: header.type, bytes: bytes.buffer as ArrayBuffer, width: bitmap.width, height: bitmap.height, hasAlpha },
      };
    }
    limit = Math.floor(Math.max(canvas.width, canvas.height) * SHRINK_STEP);
  }
  return { ok: false, problem: 'unreadable' };
}

/** A chosen or dropped file, made ready to keep. */
export async function intakeFile(file: Blob): Promise<IntakeResult> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, problem: 'too-large' };
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, problem: 'unreadable' };
  }
  const header = readImageHeader(bytes);
  if (!header) return { ok: false, problem: 'unreadable' };
  // Decode a large picture straight to about twice the stored size, to spare
  // memory. Only its long side is given, so it keeps its shape whichever way
  // the file says to turn it; a browser without resize support ignores the hint.
  const target = MAX_IMAGE_SIDE * 2;
  const hint: ImageBitmapOptions | null = Math.max(header.width, header.height) <= target
    ? null
    : header.width >= header.height
      ? { resizeWidth: target, resizeQuality: 'high' }
      : { resizeHeight: target, resizeQuality: 'high' };
  const bitmap = await decode(bytes, header.type, hint);
  if (!bitmap) return { ok: false, problem: 'unreadable' };
  try {
    return await reencode(bitmap);
  } finally {
    bitmap.close();
  }
}

/**
 * An image embedded in an imported set (already checked structurally by the
 * validator), made ready to keep. Null when it is not an image the Forge can
 * read: the card then keeps its game art.
 */
export async function intakeDataUrl(dataUrl: string): Promise<{ image: StoredImage; bitmap: ImageBitmap } | null> {
  const parts = parseImageDataUrl(dataUrl);
  const bytes = parts ? base64ToBytes(parts.base64) : null;
  const header = bytes ? readImageHeader(bytes) : null;
  if (!parts || !bytes || !header || header.type !== parts.type) return null;
  const bitmap = await decode(bytes, header.type, null);
  if (!bitmap) return null;
  const keepBytes = header.type !== 'image/gif' && Math.max(bitmap.width, bitmap.height) <= MAX_IMAGE_SIDE;
  if (!keepBytes) {
    try {
      const result = await reencode(bitmap);
      return result.ok ? { image: result.image, bitmap: result.bitmap } : null;
    } finally {
      bitmap.close();
    }
  }
  const { canvas, context } = canvasOf(bitmap.width, bitmap.height);
  context.drawImage(bitmap, 0, 0);
  const hasAlpha = hasTransparency(context, canvas.width, canvas.height);
  return {
    bitmap,
    image: { id: await imageIdFor(bytes), type: header.type, bytes: bytes.buffer as ArrayBuffer, width: bitmap.width, height: bitmap.height, hasAlpha },
  };
}

/** Decode a kept image for drawing. Null when its bytes no longer decode. */
export async function decodeStored(image: StoredImage): Promise<ImageBitmap | null> {
  return decode(new Uint8Array(image.bytes), image.type, null);
}
