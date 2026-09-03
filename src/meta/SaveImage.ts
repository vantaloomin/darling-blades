import { SAVE_CODE_MAGIC } from './SaveCode';

/**
 * Save cards: a PNG that carries a save code in its metadata.
 *
 * The player picks art they own, we composite a titled cover, and the existing
 * `DBS1-…` string from SaveCode.ts rides along in a PNG `tEXt` chunk. This is
 * the same trick SillyTavern character cards use, and the important property is
 * that it is a new CARRIER, not a new format: the bytes in the chunk are the
 * identical save code, so `decode()` and every check it already performs
 * (magic, codec id, checksum, schema version, decoded byte cap, truncation
 * messages) apply unchanged. Nothing here needs to know what a save looks like.
 *
 * This module is pure and browser-free on purpose — chunk surgery is exactly
 * the kind of byte-level work that should be unit-tested headlessly rather than
 * poked at through a canvas. The rendering half lives in the UI layer.
 */

/** PNG files always begin with these eight bytes. */
const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Our `tEXt` keyword. PNG restricts keywords to 1-79 Latin-1 characters with no
 * leading, trailing, or consecutive spaces; this is deliberately boring so any
 * image tool shows it plainly rather than mangling it.
 */
export const SAVE_IMAGE_KEYWORD = 'darlingblades-save' as const;

export type SaveImageFailure =
  | 'not-png'
  | 'truncated'
  | 'no-save-chunk'
  | 'bad-chunk';

export interface SaveImageReadResult {
  ok: boolean;
  /** The embedded save code, ready to hand to `decode()`. */
  code?: string;
  reason?: SaveImageFailure;
  /** Player-facing sentence; mirrors SaveCode's habit of explaining the failure. */
  message?: string;
}

interface PngChunk {
  type: string;
  data: Uint8Array;
}

// ---------------------------------------------------------------------------
// CRC-32, as PNG specifies it
// ---------------------------------------------------------------------------

/**
 * fflate ships deflate but exposes no CRC-32, and PNG needs one per chunk, so
 * this is the standard reflected table-driven implementation. Built lazily
 * because most sessions never export an image.
 */
let crcTable: Uint32Array | null = null;

function crc32Table(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

export function crc32(bytes: Uint8Array): number {
  const table = crc32Table();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Chunk plumbing
// ---------------------------------------------------------------------------

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
  );
}

function writeUint32(value: number): Uint8Array {
  return Uint8Array.from([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function latin1Bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function latin1String(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

export function hasPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

/**
 * Walk a PNG's chunks. Stops cleanly at IEND, and refuses a chunk whose
 * declared length runs past the end of the buffer rather than reading whatever
 * happens to be in memory after it.
 */
function readChunks(bytes: Uint8Array): PngChunk[] | null {
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = latin1String(bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) return null; // declared length overruns the file
    chunks.push({ type, data: bytes.subarray(dataStart, dataEnd) });
    offset = dataEnd + 4; // skip the chunk's own CRC
    if (type === 'IEND') return chunks;
  }
  return null; // ran out of bytes without ever seeing IEND
}

function encodeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = latin1Bytes(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);

  const out = new Uint8Array(4 + body.length + 4);
  out.set(writeUint32(data.length), 0);
  out.set(body, 4);
  out.set(writeUint32(crc32(body)), 4 + body.length);
  return out;
}

/** `tEXt` payload is `keyword \0 text`, both Latin-1. */
function encodeTextChunk(keyword: string, text: string): Uint8Array {
  const k = latin1Bytes(keyword);
  const t = latin1Bytes(text);
  const data = new Uint8Array(k.length + 1 + t.length);
  data.set(k, 0);
  data[k.length] = 0;
  data.set(t, k.length + 1);
  return encodeChunk('tEXt', data);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert (or replace) the save-code chunk in an existing PNG.
 *
 * The chunk goes immediately before IEND, which every decoder tolerates and
 * which keeps the image itself byte-identical. Re-embedding drops any previous
 * chunk with our keyword first, so exporting twice over the same cover does not
 * accumulate stale saves inside one file.
 */
export function embedSaveCode(png: Uint8Array, code: string): Uint8Array {
  if (!hasPngSignature(png)) throw new Error('embedSaveCode: not a PNG');
  const chunks = readChunks(png);
  if (!chunks) throw new Error('embedSaveCode: malformed PNG');

  const kept = chunks.filter((chunk) => !(chunk.type === 'tEXt' && textChunkKeyword(chunk.data) === SAVE_IMAGE_KEYWORD));
  const iendIndex = kept.findIndex((chunk) => chunk.type === 'IEND');
  if (iendIndex < 0) throw new Error('embedSaveCode: PNG has no IEND');

  const parts: Uint8Array[] = [PNG_SIGNATURE];
  kept.forEach((chunk, index) => {
    if (index === iendIndex) parts.push(encodeTextChunk(SAVE_IMAGE_KEYWORD, code));
    parts.push(encodeChunk(chunk.type, chunk.data));
  });

  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function textChunkKeyword(data: Uint8Array): string | null {
  const nul = data.indexOf(0);
  return nul < 0 ? null : latin1String(data.subarray(0, nul));
}

function textChunkValue(data: Uint8Array): string {
  const nul = data.indexOf(0);
  return nul < 0 ? '' : latin1String(data.subarray(nul + 1));
}

/**
 * Pull the save code back out of a PNG.
 *
 * Every failure is named and explained rather than thrown, because the input is
 * a file a player chose and the likeliest cases are ordinary mistakes: a photo
 * instead of a save card, a truncated download, an image edited by a tool that
 * dropped ancillary chunks. Validating the code itself remains `decode()`'s job.
 */
export function readSaveCode(png: Uint8Array): SaveImageReadResult {
  if (!hasPngSignature(png)) {
    return { ok: false, reason: 'not-png', message: 'That file is not a PNG. Choose a Darling Blades save card.' };
  }
  const chunks = readChunks(png);
  if (!chunks) {
    return { ok: false, reason: 'truncated', message: 'That PNG looks incomplete. Download or copy it again and retry.' };
  }
  for (const chunk of chunks) {
    if (chunk.type !== 'tEXt') continue;
    if (textChunkKeyword(chunk.data) !== SAVE_IMAGE_KEYWORD) continue;
    const code = textChunkValue(chunk.data);
    if (!code.startsWith(`${SAVE_CODE_MAGIC}-`)) {
      return { ok: false, reason: 'bad-chunk', message: 'This save card carries data this version cannot read.' };
    }
    return { ok: true, code };
  }
  return {
    ok: false,
    reason: 'no-save-chunk',
    message: 'That PNG has no save inside it. Some image editors strip the data when re-saving.',
  };
}

/** True when a PNG already carries a save, for a cheap pre-check before parsing. */
export function isSaveCard(png: Uint8Array): boolean {
  return readSaveCode(png).ok;
}

/** `darling-blades-save-2026-08-24.png`; stable, sortable, no spaces. */
export function saveImageFilename(date: Date): string {
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `darling-blades-save-${iso}.png`;
}
