/**
 * Share links: one card entry carried in the URL fragment, `#card=<payload>`.
 * The fragment never reaches a server.
 *
 * Payload, version 1: `1.` followed by the base64url (no padding) of the
 * deflate-raw compressed UTF-8 JSON of `{ card, art, appearance }`, the same
 * per-card shape as the set file without its `score`. A decoded payload goes
 * through the same validator as an imported file (validate.ts).
 *
 * A link never carries the player's own image (`art.custom`): the encoder
 * writes the art donor alone, and the decoder drops any `art.custom` a payload
 * brings, so a shared card opens with its game art.
 *
 * A payload is hostile until validated, so decoding caps the payload length
 * and the decompressed size (a few bytes of deflate can expand to gigabytes).
 * Headless: CompressionStream, TextEncoder and btoa are platform globals in
 * both the browser and Node, and nothing here touches the DOM.
 */
import { validateEntry, type EntryCheck, type ForgeEntry } from './validate';

export const SHARE_VERSION_PREFIX = '1.';
export const SHARE_FRAGMENT_KEY = 'card';
/** A share URL longer than this is refused: some apps truncate long links. */
export const MAX_SHARE_URL_LENGTH = 8000;
/** Decoding refuses a payload longer than any link the Forge would make. */
export const MAX_SHARE_PAYLOAD_LENGTH = 10000;
/** One card's JSON is a few kilobytes; anything past this is not a card. */
export const MAX_SHARE_JSON_BYTES = 256 * 1024;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/** Read a whole stream, giving up once it passes `limit` bytes. */
async function readCapped(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit: number): Promise<Uint8Array | null> {
  const writer = stream.writable.getWriter();
  // The write and close settle only as the readable side drains, so they run
  // alongside the capped read; a failed write surfaces as a failed read.
  void writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close()).catch(() => undefined);
  return readCapped(stream.readable, limit);
}

/** The share payload for one entry: the card, its art donor and its look (never its own image). */
export async function encodeSharePayload(entry: ForgeEntry): Promise<string> {
  const json = JSON.stringify({ card: entry.card, art: { donor: entry.art.donor }, appearance: entry.appearance });
  const compressed = await transform(new TextEncoder().encode(json), new CompressionStream('deflate-raw'), Number.POSITIVE_INFINITY);
  if (!compressed) throw new Error('The card could not be compressed');
  return `${SHARE_VERSION_PREFIX}${toBase64Url(compressed)}`;
}

/** `<page URL>#card=<payload>` */
export function shareUrl(pageUrl: string, payload: string): string {
  return `${pageUrl.replace(/#.*$/, '')}#${SHARE_FRAGMENT_KEY}=${payload}`;
}

/** The payload in a location fragment (`#card=...`), or null for any other fragment. */
export function payloadFromFragment(fragment: string): string | null {
  const prefix = `#${SHARE_FRAGMENT_KEY}=`;
  if (!fragment.startsWith(prefix)) return null;
  const raw = fragment.slice(prefix.length);
  try {
    // Some apps percent-encode what they pass along.
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export type ShareDecode = EntryCheck | { ok: false; reason: 'unreadable'; name: null };

/** Decode and validate a share payload. Never throws. */
export async function decodeSharePayload(payload: string): Promise<ShareDecode> {
  const unreadable = { ok: false, reason: 'unreadable', name: null } as const;
  if (payload.length > MAX_SHARE_PAYLOAD_LENGTH || !payload.startsWith(SHARE_VERSION_PREFIX)) return unreadable;
  const bytes = fromBase64Url(payload.slice(SHARE_VERSION_PREFIX.length));
  if (!bytes || bytes.length === 0) return unreadable;
  let inflated: Uint8Array | null;
  try {
    inflated = await transform(bytes, new DecompressionStream('deflate-raw'), MAX_SHARE_JSON_BYTES);
  } catch {
    return unreadable;
  }
  if (!inflated) return unreadable;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(inflated));
  } catch {
    return unreadable;
  }
  return validateEntry(value, 'none');
}
