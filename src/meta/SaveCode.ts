import { deflateSync, Inflate, strFromU8, strToU8 } from 'fflate';
import { freshSave, SaveManager, type SaveData } from './SaveManager';

/** The stable text prefix and codec identifier for local save exports. */
export const SAVE_CODE_MAGIC = 'DBS1' as const;
export const SAVE_CODE_CODEC = 'deflate-json-v1' as const;
export const CURRENT_SAVE_SCHEMA_VERSION = 22 as const;

/**
 * A deliberately bounded decoded payload. This is a parser-safety limit, not
 * a QR-size promise. The measurement script reports the real profile sizes
 * that informed future revisions of this constant.
 */
export const MAX_DECODED_SAVE_BYTES = 1024 * 1024;

/** The metadata envelope carried after the visible `DBS1-` prefix. */
export interface SaveCodeEnvelope {
  magic: typeof SAVE_CODE_MAGIC;
  codec: typeof SAVE_CODE_CODEC;
  schemaVersion: number;
  checksum: string;
  payload: string;
}

export interface SaveCodeEncodeOptions {
  /** Replays are intentionally omitted unless the exporter opts in. */
  includeReplays?: boolean;
}

export interface SaveCodeProgressSummary {
  wins: number;
  losses: number;
  bestGauntletRung: number;
  gauntletCompletions: number;
}

export interface SaveCodePreview {
  creationDate: number;
  /** Total owned copies, including duplicate copies of one card. */
  collectionCount: number;
  /** Distinct card ids represented in the aggregate collection. */
  collectionDistinctCount: number;
  gold: number;
  deckCount: number;
  progressSummary: SaveCodeProgressSummary;
  sourceSchemaVersion: number;
  replaysPresent: boolean;
}

export type SaveCodeErrorKind =
  | 'invalid'
  | 'truncated'
  | 'checksum-failed'
  | 'oversized'
  | 'future-version'
  | 'malformed-json'
  | 'prototype-pollution-shaped';

export interface SaveCodeError {
  kind: SaveCodeErrorKind;
  /** Short text suitable for displaying in an import error surface. */
  message: string;
}

export type SaveCodeDecodeResult =
  | { ok: true; save: SaveData; preview: SaveCodePreview }
  | { ok: false; error: SaveCodeError };

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const INFLATE_INPUT_CHUNK_BYTES = 256;

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

const INERT_STORAGE = {
  getItem: (): string | null => null,
  setItem: (): void => undefined,
  removeItem: (): void => undefined,
};

/**
 * Encode a normalized profile as a portable code. The envelope is canonical
 * JSON encoded as UTF-8, then base64url framed after the visible `DBS1-`
 * prefix. The checksum is SHA-256 over the base64url payload text. SHA-256 is
 * implemented here instead of using Web Crypto so browser, Tauri, Node, and
 * tsx use the same synchronous pure-JS path. It detects corruption but does
 * not provide secrecy or authenticity.
 */
export function encode(save: SaveData, options: SaveCodeEncodeOptions = {}): string {
  const normalized = normalizeSave(save);
  const exportSave = options.includeReplays ? normalized : withoutReplays(normalized);
  const decodedJson = canonicalJson(exportSave);
  const decodedBytes = strToU8(decodedJson);
  if (decodedBytes.length > MAX_DECODED_SAVE_BYTES) {
    throw new RangeError(`Save data exceeds the ${MAX_DECODED_SAVE_BYTES}-byte export limit.`);
  }

  const payload = toBase64Url(deflateSync(decodedBytes));
  const envelope: SaveCodeEnvelope = {
    magic: SAVE_CODE_MAGIC,
    codec: SAVE_CODE_CODEC,
    schemaVersion: normalized.version,
    checksum: sha256Hex(strToU8(payload)),
    payload,
  };
  return `${SAVE_CODE_MAGIC}-${toBase64Url(strToU8(canonicalJson(envelope)))}`;
}

/**
 * Decode and migrate a code without touching storage or the active profile.
 * Envelope metadata and the checksum are checked before inflation; the
 * decoded byte limit is checked before UTF-8 or JSON parsing.
 */
export function decode(code: string): SaveCodeDecodeResult {
  if (typeof code !== 'string') return failure('invalid', 'This is not a valid Darling Blades save code.');
  if (!code.startsWith(`${SAVE_CODE_MAGIC}-`)) {
    return code.startsWith(SAVE_CODE_MAGIC)
      ? failure('truncated', 'This save code appears to be truncated. Copy it again and retry.')
      : failure('invalid', 'This is not a valid Darling Blades save code.');
  }

  const framed = code.slice(SAVE_CODE_MAGIC.length + 1);
  if (framed.length === 0) return failure('truncated', 'This save code appears to be truncated. Copy it again and retry.');

  let envelope: unknown;
  try {
    envelope = JSON.parse(strFromU8(fromBase64Url(framed))) as unknown;
  } catch {
    return failure('truncated', 'This save code appears to be truncated. Copy it again and retry.');
  }

  if (hasDangerousKey(envelope)) {
    return failure('prototype-pollution-shaped', 'This save code contains unsafe object keys and cannot be imported.');
  }
  if (!isPlainObject(envelope)) return failure('invalid', 'This save code has an invalid envelope.');
  const envelopeKeys = Object.keys(envelope).sort();
  if (envelopeKeys.join('\u0000') !== ['checksum', 'codec', 'magic', 'payload', 'schemaVersion'].join('\u0000')) {
    return failure('invalid', 'This save code has an invalid envelope.');
  }

  const candidate = envelope as Record<string, unknown>;
  if (candidate.magic !== SAVE_CODE_MAGIC || candidate.codec !== SAVE_CODE_CODEC) {
    return failure('invalid', 'This save code uses an unsupported format.');
  }
  if (typeof candidate.schemaVersion !== 'number' || !Number.isInteger(candidate.schemaVersion) || candidate.schemaVersion < 1) {
    return failure('invalid', 'This save code has an invalid schema version.');
  }
  if (candidate.schemaVersion > CURRENT_SAVE_SCHEMA_VERSION) {
    return failure('future-version', 'This save code was created by a newer version of Darling Blades.');
  }
  if (typeof candidate.checksum !== 'string' || !/^[0-9a-f]{64}$/.test(candidate.checksum)) {
    return failure('invalid', 'This save code has an invalid checksum field.');
  }
  if (typeof candidate.payload !== 'string' || candidate.payload.length === 0) {
    return failure('truncated', 'This save code appears to be truncated. Copy it again and retry.');
  }

  const payload = candidate.payload;
  if (sha256Hex(strToU8(payload)) !== candidate.checksum) {
    return failure('checksum-failed', 'This save code failed its integrity check. It may have been changed or damaged.');
  }

  let decodedBytes: Uint8Array;
  try {
    decodedBytes = inflateBounded(fromBase64Url(payload));
  } catch (error) {
    if (error instanceof DecodedPayloadLimitError) {
      return failure('oversized', 'This save code is too large to import safely.');
    }
    return failure('invalid', 'This save code contains invalid compressed data.');
  }
  if (decodedBytes.length > MAX_DECODED_SAVE_BYTES) {
    return failure('oversized', 'This save code is too large to import safely.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(decodedBytes)) as unknown;
  } catch {
    return failure('malformed-json', 'This save code contains malformed save data.');
  }
  if (hasDangerousKey(raw)) {
    return failure('prototype-pollution-shaped', 'This save code contains unsafe object keys and cannot be imported.');
  }
  if (!isPlainObject(raw)) return failure('malformed-json', 'This save code does not contain a save object.');

  const rawVersion = raw.version;
  if (typeof rawVersion !== 'number' || !Number.isInteger(rawVersion)) {
    return failure('malformed-json', 'This save code does not contain a valid save version.');
  }
  if (rawVersion !== candidate.schemaVersion) {
    return failure('invalid', 'This save code has mismatched schema metadata.');
  }

  const now = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0;
  let save: SaveData;
  try {
    save = new SaveManager(INERT_STORAGE, now).migrate(raw, now);
  } catch {
    return failure('invalid', 'This save code does not contain an importable save profile.');
  }
  if (save.version !== CURRENT_SAVE_SCHEMA_VERSION) {
    return failure('invalid', 'This save code could not be migrated to the current save format.');
  }
  if (!hasCompleteSaveShape(save)) {
    return failure('invalid', 'This save code does not contain an importable save profile.');
  }

  try {
    return {
      ok: true,
      save,
      preview: previewFor(save, candidate.schemaVersion),
    };
  } catch {
    return failure('invalid', 'This save code does not contain an importable save profile.');
  }
}

class DecodedPayloadLimitError extends Error {}

function inflateBounded(compressed: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let decodedBytes = 0;
  const inflater = new Inflate((chunk) => {
    decodedBytes += chunk.length;
    if (decodedBytes > MAX_DECODED_SAVE_BYTES) throw new DecodedPayloadLimitError();
    chunks.push(chunk);
  });

  for (let offset = 0; offset < compressed.length; offset += INFLATE_INPUT_CHUNK_BYTES) {
    const end = Math.min(offset + INFLATE_INPUT_CHUNK_BYTES, compressed.length);
    inflater.push(compressed.subarray(offset, end), end === compressed.length);
  }

  const output = new Uint8Array(decodedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function normalizeSave(save: SaveData): SaveData {
  const now = Number.isFinite(save.createdAt) ? save.createdAt : 0;
  const normalized = new SaveManager(INERT_STORAGE, now).migrate(save as unknown as Record<string, unknown>, now);
  if (normalized.version !== CURRENT_SAVE_SCHEMA_VERSION) {
    throw new Error('Save data did not migrate to the current schema.');
  }
  return normalized;
}

function withoutReplays(save: SaveData): Omit<SaveData, 'replays'> {
  const copy: Partial<SaveData> = { ...save };
  delete copy.replays;
  return copy as Omit<SaveData, 'replays'>;
}

function hasCompleteSaveShape(save: SaveData): boolean {
  const expected = freshSave(0) as unknown as Record<string, unknown>;
  const candidate = save as unknown as Record<string, unknown>;
  for (const key of Object.keys(expected)) {
    if (!Object.prototype.hasOwnProperty.call(candidate, key) || !matchesSaveField(candidate[key], expected[key])) return false;
  }
  return true;
}

function matchesSaveField(value: unknown, expected: unknown): boolean {
  if (expected === null) return value === null || typeof value === 'string';
  if (Array.isArray(expected)) return Array.isArray(value);
  if (typeof expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (typeof expected === 'boolean') return typeof value === 'boolean';
  if (typeof expected === 'object') return isPlainObject(value);
  return typeof value === typeof expected;
}

function previewFor(save: SaveData, sourceSchemaVersion: number): SaveCodePreview {
  const counts = Object.values(save.collection);
  return {
    creationDate: save.createdAt,
    collectionCount: counts.reduce((total, count) => total + count, 0),
    collectionDistinctCount: counts.filter((count) => count > 0).length,
    gold: save.gold,
    deckCount: save.decks.length,
    progressSummary: {
      wins: save.stats.wins,
      losses: save.stats.losses,
      bestGauntletRung: save.gauntlet.bestRung,
      gauntletCompletions: save.gauntlet.completions,
    },
    sourceSchemaVersion,
    replaysPresent: save.replays.length > 0,
  };
}

function failure(kind: SaveCodeErrorKind, message: string): SaveCodeDecodeResult {
  return { ok: false, error: { kind, message } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasDangerousKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const seen = new Set<object>();
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    for (const key of Object.keys(current)) {
      if (DANGEROUS_KEYS.has(key)) return true;
      pending.push((current as Record<string, unknown>)[key]);
    }
  }
  return false;
}

function canonicalJson(value: unknown): string {
  const json = JSON.stringify(canonicalValue(value, new Set<object>()));
  if (json === undefined) throw new TypeError('Value cannot be represented as JSON.');
  return json;
}

function canonicalValue(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Non-finite numbers are not valid save data.');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('Unsupported value in save data.');
  if (seen.has(value)) throw new TypeError('Cyclic save data cannot be exported.');
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((entry) => canonicalValue(entry, seen));
    seen.delete(value);
    return result;
  }
  if (!isPlainObject(value)) throw new TypeError('Only plain save objects can be exported.');
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (DANGEROUS_KEYS.has(key)) throw new TypeError('Unsafe object key in save data.');
    result[key] = canonicalValue(value[key], seen);
  }
  seen.delete(value);
  return result;
}

function toBase64Url(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    output += BASE64URL_ALPHABET[a >> 2];
    output += BASE64URL_ALPHABET[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) output += BASE64URL_ALPHABET[((b & 15) << 2) | (c >> 6)];
    if (i + 2 < bytes.length) output += BASE64URL_ALPHABET[c & 63];
  }
  return output;
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new Error('Invalid base64url.');
  const output = new Uint8Array(Math.floor((value.length * 6) / 8));
  let buffer = 0;
  let bits = 0;
  let offset = 0;
  for (const char of value) {
    const digit = BASE64URL_ALPHABET.indexOf(char);
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[offset++] = (buffer >> bits) & 0xff;
    }
  }
  return output;
}

function sha256Hex(bytes: Uint8Array): string {
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  padded[padded.length - 8] = high >>> 24;
  padded[padded.length - 7] = high >>> 16;
  padded[padded.length - 6] = high >>> 8;
  padded[padded.length - 5] = high;
  padded[padded.length - 4] = low >>> 24;
  padded[padded.length - 3] = low >>> 16;
  padded[padded.length - 2] = low >>> 8;
  padded[padded.length - 1] = low;

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const index = offset + i * 4;
      words[i] = (padded[index] << 24) | (padded[index + 1] << 16) | (padded[index + 2] << 8) | padded[index + 3];
    }
    for (let i = 16; i < 64; i++) {
      words[i] = (smallSigma1(words[i - 2]) + words[i - 7] + smallSigma0(words[i - 15]) + words[i - 16]) >>> 0;
    }

    let [a, b, c, d, e, f, g, currentH] = h;
    for (let i = 0; i < 64; i++) {
      const temp1 = (currentH + bigSigma1(e) + ((e & f) ^ (~e & g)) + SHA256_K[i] + words[i]) >>> 0;
      const temp2 = (bigSigma0(a) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      currentH = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + currentH) >>> 0;
  }
  return Array.from(h, (word) => word.toString(16).padStart(8, '0')).join('');
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function bigSigma0(value: number): number {
  return rotateRight(value, 2) ^ rotateRight(value, 13) ^ rotateRight(value, 22);
}

function bigSigma1(value: number): number {
  return rotateRight(value, 6) ^ rotateRight(value, 11) ^ rotateRight(value, 25);
}

function smallSigma0(value: number): number {
  return rotateRight(value, 7) ^ rotateRight(value, 18) ^ (value >>> 3);
}

function smallSigma1(value: number): number {
  return rotateRight(value, 17) ^ rotateRight(value, 19) ^ (value >>> 10);
}
