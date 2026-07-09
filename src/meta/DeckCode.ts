const PREFIX = 'DBD2-';
const LEGACY_PREFIX = 'DBD1-';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DECODE = new Map([...ALPHABET].map((c, i) => [c, i]));
const CARD_ID_RE = /^[a-z0-9-]+$/;
const MAX_DECK_CODE_CARDS = 240;
const HASH_BYTES = 3;
const RUN_BYTES = HASH_BYTES + 1;

export type DeckCodeError =
  | 'empty'
  | 'bad-prefix'
  | 'bad-encoding'
  | 'bad-payload'
  | 'bad-card-id'
  | 'unknown-card'
  | 'too-many-cards';

export type DeckCodeDecodeResult =
  | { ok: true; cards: string[] }
  | { ok: false; error: DeckCodeError };

type LegacyDeckCodeEntry = string | [string, number];

export function encodeDeck(cards: readonly string[]): string {
  if (cards.length > MAX_DECK_CODE_CARDS) throw new Error('Deck code is too large');

  const bytes: number[] = [];
  for (const run of deckRuns(cards)) {
    if (!isCardId(run.id)) throw new Error(`Invalid card id for deck code: ${run.id}`);
    const hash = cardHash24(run.id);
    bytes.push((hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff, run.count);
  }

  return `${PREFIX}${bytesToBase64Url(new Uint8Array(bytes))}`;
}

export function decodeDeck(code: string, knownCardIds: readonly string[] = []): DeckCodeDecodeResult {
  const normalized = code.trim().replace(/\s+/g, '');
  if (normalized.length === 0) return { ok: false, error: 'empty' };

  if (normalized.startsWith(PREFIX)) {
    const bytes = base64UrlToBytes(normalized.slice(PREFIX.length));
    if (!bytes) return { ok: false, error: 'bad-encoding' };
    return decodeBinaryDeck(bytes, knownCardIds);
  }

  if (normalized.startsWith(LEGACY_PREFIX)) {
    const bytes = base64UrlToBytes(normalized.slice(LEGACY_PREFIX.length));
    if (!bytes) return { ok: false, error: 'bad-encoding' };
    return decodeLegacyDeck(bytes);
  }

  return { ok: false, error: 'bad-prefix' };
}

export function deckCodeErrorMessage(error: DeckCodeError): string {
  switch (error) {
    case 'empty':
      return 'No deck code was entered.';
    case 'bad-prefix':
      return 'That is not a Darling Blades deck code.';
    case 'bad-encoding':
    case 'bad-payload':
      return 'That deck code is damaged or unreadable.';
    case 'bad-card-id':
      return 'That deck code contains an invalid card id.';
    case 'unknown-card':
      return 'That deck code references a card this build cannot read.';
    case 'too-many-cards':
      return 'That deck code is too large.';
  }
}

function deckRuns(cards: readonly string[]): { id: string; count: number }[] {
  const runs: { id: string; count: number }[] = [];
  for (const id of cards) {
    const last = runs[runs.length - 1];
    if (last?.id === id) {
      last.count++;
    } else {
      runs.push({ id, count: 1 });
    }
  }
  return runs;
}

function decodeBinaryDeck(bytes: Uint8Array, knownCardIds: readonly string[]): DeckCodeDecodeResult {
  if (bytes.length % RUN_BYTES !== 0) return { ok: false, error: 'bad-payload' };
  const lookup = buildHashLookup(knownCardIds);
  if (!lookup) return { ok: false, error: 'bad-payload' };

  const cards: string[] = [];
  for (let i = 0; i < bytes.length; i += RUN_BYTES) {
    const hash = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    const count = bytes[i + 3];
    const id = lookup.get(hash);
    if (count <= 0) return { ok: false, error: 'bad-payload' };
    if (!id) return { ok: false, error: 'unknown-card' };
    if (cards.length + count > MAX_DECK_CODE_CARDS) return { ok: false, error: 'too-many-cards' };
    for (let n = 0; n < count; n++) cards.push(id);
  }

  return { ok: true, cards };
}

function decodeLegacyDeck(bytes: Uint8Array): DeckCodeDecodeResult {
  let payload: unknown;
  try {
    payload = JSON.parse(bytesToAscii(bytes));
  } catch {
    return { ok: false, error: 'bad-payload' };
  }
  if (!Array.isArray(payload)) return { ok: false, error: 'bad-payload' };

  const cards: string[] = [];
  for (const entry of payload as LegacyDeckCodeEntry[]) {
    let id: string;
    let count = 1;
    if (typeof entry === 'string') {
      id = entry;
    } else if (
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === 'string' &&
      Number.isInteger(entry[1])
    ) {
      id = entry[0];
      count = entry[1];
    } else {
      return { ok: false, error: 'bad-payload' };
    }
    if (!isCardId(id) || count <= 0) return { ok: false, error: 'bad-card-id' };
    if (cards.length + count > MAX_DECK_CODE_CARDS) return { ok: false, error: 'too-many-cards' };
    for (let i = 0; i < count; i++) cards.push(id);
  }

  return { ok: true, cards };
}

function buildHashLookup(knownCardIds: readonly string[]): Map<number, string> | null {
  const lookup = new Map<number, string>();
  for (const id of knownCardIds) {
    if (!isCardId(id)) return null;
    const hash = cardHash24(id);
    const existing = lookup.get(hash);
    if (existing && existing !== id) return null;
    lookup.set(hash, id);
  }
  return lookup;
}

function cardHash24(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  return hash & 0xffffff;
}

function isCardId(id: string): boolean {
  return CARD_ID_RE.test(id);
}

function bytesToAscii(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 0x03) << 4) | ((b ?? 0) >> 4)];
    if (i + 1 < bytes.length) out += ALPHABET[((b & 0x0f) << 2) | ((c ?? 0) >> 6)];
    if (i + 2 < bytes.length) out += ALPHABET[c & 0x3f];
  }
  return out;
}

function base64UrlToBytes(input: string): Uint8Array | null {
  if (input.length === 0) return new Uint8Array();
  if (input.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 4) {
    const a = decodeChar(input[i]);
    const b = decodeChar(input[i + 1]);
    const c = i + 2 < input.length ? decodeChar(input[i + 2]) : 0;
    const d = i + 3 < input.length ? decodeChar(input[i + 3]) : 0;
    if (a === null || b === null || c === null || d === null) return null;
    bytes.push((a << 2) | (b >> 4));
    if (i + 2 < input.length) bytes.push(((b & 0x0f) << 4) | (c >> 2));
    if (i + 3 < input.length) bytes.push(((c & 0x03) << 6) | d);
  }
  return new Uint8Array(bytes);
}

function decodeChar(c: string | undefined): number | null {
  if (c === undefined) return null;
  return DECODE.get(c) ?? null;
}
