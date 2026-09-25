/**
 * A card's own image (`art.custom`): its shape, the checks every copy of it
 * passes on the way in, and which stored images are still in use.
 *
 * Where the image bytes live depends on where the card is:
 * - In the page and the autosave, `image` is the image's id: the SHA-256 of
 *   its bytes, as 64 lowercase hex digits. The bytes themselves are in the
 *   Forge's IndexedDB database, never in localStorage (the game save shares
 *   that storage and its few-megabyte quota).
 * - In an exported set file, `image` is a `data:` URL holding the bytes, so a
 *   set moves between devices whole.
 * - A share link never carries it.
 *
 * Everything from outside the page is hostile until checked: the checks here
 * are structural (the shape, the declared type, the size, the framing ranges,
 * and the file signature and pixel size in the image's own header); the page
 * then decodes the bytes before it keeps them.
 *
 * Headless: no Phaser, no DOM. `atob`, `btoa` and `crypto.subtle` are platform
 * globals in the browser and in Node.
 */
import {
  BACKGROUND_PATTERN,
  MAX_ROTATION,
  MAX_ZOOM,
  MIN_ROTATION,
  type ArtFraming,
} from './framing';

export interface CustomArt extends ArtFraming {
  /** An image id in the page and the autosave; a `data:` URL in a set file. */
  image: string;
}

/** Where a card's `image` value comes from, and so what it must look like. */
export type CustomImageForm = 'id' | 'dataUrl';

/** The formats a player may choose, as the page says: PNG, JPEG, WebP or GIF. */
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/** A chosen file is refused past this, before it is read. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/** Stored images are downscaled so their long side is at most this. */
export const MAX_IMAGE_SIDE = 1600;
/**
 * One stored image's bytes never pass this: the page re-encodes smaller until
 * it fits, and an imported image over it is refused (the card keeps its game
 * art). A set file holds each image as base64, a third larger.
 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
/** A picture whose header claims more pixels than this is refused before it is decoded. */
export const MAX_SOURCE_PIXELS = 100_000_000;

export const IMAGE_ID_PATTERN = /^[0-9a-f]{64}$/;

export function isImageId(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_ID_PATTERN.test(value);
}

// ── Data URLs ───────────────────────────────────────────────────────────────

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/;
/** The longest data URL a stored image can make: its prefix plus base64 of MAX_IMAGE_BYTES. */
export const MAX_DATA_URL_LENGTH = 'data:image/jpeg;base64,'.length + Math.ceil(MAX_IMAGE_BYTES / 3) * 4;

export interface DataUrlParts {
  type: AcceptedImageType;
  base64: string;
}

/** The type and payload of an image data URL within the size cap, or null. */
export function parseImageDataUrl(value: unknown): DataUrlParts | null {
  if (typeof value !== 'string' || value.length > MAX_DATA_URL_LENGTH) return null;
  const match = DATA_URL_PATTERN.exec(value);
  if (!match || match[2].length % 4 !== 0 || match[2].length === 0) return null;
  return { type: match[1] as AcceptedImageType, base64: match[2] };
}

export function base64ToBytes(base64: string): Uint8Array | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

export function bytesToDataUrl(type: string, bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

// ── Image headers ───────────────────────────────────────────────────────────

export interface ImageHeader {
  type: AcceptedImageType;
  width: number;
  height: number;
}

const ascii = (bytes: Uint8Array, start: number, text: string): boolean => (
  bytes.length >= start + text.length && [...text].every((char, index) => bytes[start + index] === char.charCodeAt(0))
);
const u16le = (bytes: Uint8Array, at: number): number => bytes[at] | (bytes[at + 1] << 8);
const u16be = (bytes: Uint8Array, at: number): number => (bytes[at] << 8) | bytes[at + 1];
const u24le = (bytes: Uint8Array, at: number): number => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
const u32be = (bytes: Uint8Array, at: number): number => ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];

function readPng(bytes: Uint8Array): ImageHeader | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte) || !ascii(bytes, 12, 'IHDR')) return null;
  return { type: 'image/png', width: u32be(bytes, 16), height: u32be(bytes, 20) };
}

function readGif(bytes: Uint8Array): ImageHeader | null {
  if (bytes.length < 10 || !(ascii(bytes, 0, 'GIF87a') || ascii(bytes, 0, 'GIF89a'))) return null;
  return { type: 'image/gif', width: u16le(bytes, 6), height: u16le(bytes, 8) };
}

function readWebp(bytes: Uint8Array): ImageHeader | null {
  if (bytes.length < 30 || !ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WEBP')) return null;
  if (ascii(bytes, 12, 'VP8 ')) {
    // Lossy: a key frame's start code, then 14-bit width and height.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { type: 'image/webp', width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
  }
  if (ascii(bytes, 12, 'VP8L')) {
    // Lossless: a signature byte, then width - 1 and height - 1 in 14 bits each.
    if (bytes[20] !== 0x2f) return null;
    const bits = (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0;
    return { type: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(bytes, 12, 'VP8X')) {
    // Extended: canvas width - 1 and height - 1 in 24 bits each.
    return { type: 'image/webp', width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
  }
  return null;
}

function readJpeg(bytes: Uint8Array): ImageHeader | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === 0xff) { at += 1; continue; }
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = u16be(bytes, at + 2);
    if (length < 2) return null;
    // Start of frame (every SOF but DHT, JPG and DAC): precision, then height and width.
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (at + 9 > bytes.length) return null;
      return { type: 'image/jpeg', width: u16be(bytes, at + 7), height: u16be(bytes, at + 5) };
    }
    at += 2 + length;
  }
  return null;
}

/**
 * The format and pixel size an image's own header declares, for the four
 * accepted formats only; null for anything else (SVG, HTML, BMP, a truncated
 * file). The browser still has to decode it: this only refuses early, and
 * refuses a picture too large to decode safely.
 */
export function readImageHeader(bytes: Uint8Array): ImageHeader | null {
  const header = readPng(bytes) ?? readGif(bytes) ?? readWebp(bytes) ?? readJpeg(bytes);
  if (!header || header.width < 1 || header.height < 1) return null;
  if (header.width * header.height > MAX_SOURCE_PIXELS) return null;
  return header;
}

// ── Image ids ───────────────────────────────────────────────────────────────

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * SHA-256 in plain code, for a page opened where `crypto.subtle` is missing
 * (it needs a secure context: https or localhost). Same digest either way, so
 * an image keeps its id wherever it is stored.
 */
export function sha256HexFallback(bytes: Uint8Array): string {
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(padded.length - 4, bitLength >>> 0);
  const hash = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));
  for (let block = 0; block < padded.length; block += 64) {
    for (let index = 0; index < 16; index += 1) w[index] = view.getUint32(block + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotr(w[index - 15], 7) ^ rotr(w[index - 15], 18) ^ (w[index - 15] >>> 3);
      const s1 = rotr(w[index - 2], 17) ^ rotr(w[index - 2], 19) ^ (w[index - 2] >>> 10);
      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + SHA256_K[index] + w[index]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => { hash[index] = (hash[index] + value) >>> 0; });
  }
  return [...hash].map((value) => value.toString(16).padStart(8, '0')).join('');
}

/** An image's id: the SHA-256 of its bytes, so the same image is stored once. */
export async function imageIdFor(bytes: Uint8Array): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return sha256HexFallback(bytes);
}

// ── Checking a card's custom art ────────────────────────────────────────────

const CUSTOM_FIELDS = ['image', 'zoom', 'x', 'y', 'rotation', 'flip', 'background'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const numberIn = (value: unknown, min: number, max: number): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
);

/**
 * A card's `art.custom` from outside the page, rebuilt from its checked
 * fields, or null when any field is wrong. `form` says what `image` must be:
 * an image id (the autosave) or an image data URL within the size cap (a set
 * file). The framing must be in range; zoom only has to be positive here,
 * because its floor depends on the picture's size, which the page learns when
 * it decodes the image.
 */
export function readCustomArt(value: unknown, form: CustomImageForm): CustomArt | null {
  if (!isPlainObject(value)) return null;
  if (Object.keys(value).some((key) => !(CUSTOM_FIELDS as readonly string[]).includes(key))) return null;
  const { image, zoom, x, y, rotation, flip, background } = value;
  if (form === 'id' ? !isImageId(image) : parseImageDataUrl(image) === null) return null;
  if (!numberIn(zoom, 0, MAX_ZOOM) || zoom === 0) return null;
  if (!numberIn(x, -1, 1) || !numberIn(y, -1, 1) || !numberIn(rotation, MIN_ROTATION, MAX_ROTATION)) return null;
  if (typeof flip !== 'boolean') return null;
  if (typeof background !== 'string' || !BACKGROUND_PATTERN.test(background.toLowerCase())) return null;
  return { image: image as string, zoom, x, y, rotation, flip, background: background.toLowerCase() };
}

// ── Which stored images are still in use ────────────────────────────────────

/** Anything that may hold a card's art: a set entry, or null. */
export interface HasArt {
  art: { custom?: { image: string } };
}

/** The image ids a group of cards refers to. */
export function referencedImageIds(entries: Iterable<HasArt | null | undefined>): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    const image = entry?.art.custom?.image;
    if (isImageId(image)) ids.add(image);
  }
  return ids;
}

/**
 * Image ids named anywhere in a saved text (another tab's autosave). Used only
 * to keep images, never to delete them, so a loose match is safe.
 */
export function imageIdsInText(text: string): Set<string> {
  return new Set([...text.matchAll(/"image"\s*:\s*"([0-9a-f]{64})"/g)].map((match) => match[1]));
}

/** The stored images nothing refers to any more: what the page deletes. */
export function unreferencedImages(stored: Iterable<string>, referenced: ReadonlySet<string>): string[] {
  return [...stored].filter((id) => !referenced.has(id));
}
