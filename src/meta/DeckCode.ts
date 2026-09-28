/**
 * Deck share codes. Three shapes are read, one is written:
 *
 * - `DBD3-` (written since 1.9): a two-byte header, then the Darling, the
 *   Warchest Reserves and the card list. The header's first byte names the
 *   format (0 = none, a plain card list; 1 = Standard, the `warchest` format
 *   id; 2 = Darlings), the second holds flags (bit 0: a Darling follows, bit 1:
 *   a Warchest follows; no other bit is set). The Darling is one 3-byte card
 *   hash; the Warchest is a run-count byte and that many 4-byte runs; the rest
 *   of the payload is 4-byte card runs to the end.
 * - `DBD2-` (until 1.9): 4-byte card runs only, no header.
 * - `DBD1-`: a JSON array of ids or [id, count] pairs.
 *
 * A run is a 24-bit FNV card hash and a count byte, so a code is short but can
 * only be read against the ids this build knows. `DBD1-` and `DBD2-` codes
 * decode with `format`, `darlingId` and `landReserve` all null: they never
 * carried them, and importing one fills only the card list, as it always did.
 * Codes are a compatibility surface: every shape keeps a golden fixture in
 * tests/meta/deckCode.test.ts.
 */
const PREFIX = 'DBD3-';
const V2_PREFIX = 'DBD2-';
const LEGACY_PREFIX = 'DBD1-';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DECODE = new Map([...ALPHABET].map((c, i) => [c, i]));
const CARD_ID_RE = /^[a-z0-9-]+$/;
const MAX_DECK_CODE_CARDS = 240;
const HASH_BYTES = 3;
const RUN_BYTES = HASH_BYTES + 1;
const HEADER_BYTES = 2;
const FLAG_DARLING = 0x01;
const FLAG_RESERVE = 0x02;
/** A run's count and the Warchest's run count are one byte each. */
const MAX_BYTE = 0xff;

/** The formats a code can name. Constructed is retired, so its codes carry no format. */
export type DeckCodeFormat = 'warchest' | 'darlings';
const FORMAT_BYTE: Record<DeckCodeFormat, number> = { warchest: 1, darlings: 2 };
const BYTE_FORMAT: ReadonlyMap<number, DeckCodeFormat | null> = new Map([
  [0, null],
  [1, 'warchest'],
  [2, 'darlings'],
]);

export type DeckCodeError =
  | 'empty'
  | 'bad-prefix'
  | 'bad-encoding'
  | 'bad-payload'
  | 'bad-card-id'
  | 'unknown-card'
  | 'too-many-cards';

/**
 * What a code rebuilds. A card-list-only code (`DBD1-`, `DBD2-`, or a `DBD3-`
 * code with no format) has the other three null.
 */
export interface DeckCodeContents {
  cards: string[];
  format: DeckCodeFormat | null;
  /** The Darlings format's Darling; always null for any other format. */
  darlingId: string | null;
  /** The Warchest Reserves of a Standard or Darlings deck; null when the code carries none. */
  landReserve: string[] | null;
}

/** The deck an export writes. `format` null (or left out) writes a plain card list. */
export interface DeckCodeDeck {
  cards: readonly string[];
  format?: DeckCodeFormat | null;
  darlingId?: string | null;
  landReserve?: readonly string[] | null;
}

export type DeckCodeDecodeResult =
  | ({ ok: true } & DeckCodeContents)
  | { ok: false; error: DeckCodeError };

type DeckCodeFailure = { ok: false; error: DeckCodeError };
type LegacyDeckCodeEntry = string | [string, number];

export function encodeDeck(deck: DeckCodeDeck): string {
  const format = deck.format ?? null;
  const darlingId = format === 'darlings' ? deck.darlingId ?? null : null;
  const landReserve = format !== null && deck.landReserve ? deck.landReserve : null;
  if (deck.cards.length > MAX_DECK_CODE_CARDS || (landReserve?.length ?? 0) > MAX_DECK_CODE_CARDS) {
    throw new Error('Deck code is too large');
  }

  const bytes: number[] = [
    format === null ? 0 : FORMAT_BYTE[format],
    (darlingId !== null ? FLAG_DARLING : 0) | (landReserve !== null ? FLAG_RESERVE : 0),
  ];
  if (darlingId !== null) pushHash(bytes, darlingId);
  if (landReserve !== null) {
    const runs = deckRuns(landReserve);
    if (runs.length > MAX_BYTE) throw new Error('Deck code is too large');
    bytes.push(runs.length);
    pushRuns(bytes, runs);
  }
  pushRuns(bytes, deckRuns(deck.cards));

  return `${PREFIX}${bytesToBase64Url(new Uint8Array(bytes))}`;
}

export function decodeDeck(code: string, knownCardIds: readonly string[] = []): DeckCodeDecodeResult {
  const normalized = code.trim().replace(/\s+/g, '');
  if (normalized.length === 0) return { ok: false, error: 'empty' };

  const shapes: ReadonlyArray<readonly [string, (bytes: Uint8Array) => DeckCodeDecodeResult]> = [
    [PREFIX, (bytes) => decodeV3Deck(bytes, knownCardIds)],
    [V2_PREFIX, (bytes) => decodeV2Deck(bytes, knownCardIds)],
    [LEGACY_PREFIX, decodeLegacyDeck],
  ];
  for (const [prefix, decode] of shapes) {
    if (!normalized.startsWith(prefix)) continue;
    const bytes = base64UrlToBytes(normalized.slice(prefix.length));
    if (!bytes) return { ok: false, error: 'bad-encoding' };
    return decode(bytes);
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

function pushHash(bytes: number[], id: string): void {
  if (!isCardId(id)) throw new Error(`Invalid card id for deck code: ${id}`);
  const hash = cardHash24(id);
  bytes.push((hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff);
}

function pushRuns(bytes: number[], runs: readonly { id: string; count: number }[]): void {
  for (const run of runs) {
    pushHash(bytes, run.id);
    bytes.push(run.count);
  }
}

function deckRuns(cards: readonly string[]): { id: string; count: number }[] {
  const runs: { id: string; count: number }[] = [];
  for (const id of cards) {
    const last = runs[runs.length - 1];
    if (last?.id === id && last.count < MAX_BYTE) {
      last.count++;
    } else {
      runs.push({ id, count: 1 });
    }
  }
  return runs;
}

function decodeV2Deck(bytes: Uint8Array, knownCardIds: readonly string[]): DeckCodeDecodeResult {
  const lookup = buildHashLookup(knownCardIds);
  if (!lookup) return { ok: false, error: 'bad-payload' };
  const cards = readRuns(bytes, 0, bytes.length, lookup);
  if (!Array.isArray(cards)) return cards;
  return { ok: true, cards, format: null, darlingId: null, landReserve: null };
}

function decodeV3Deck(bytes: Uint8Array, knownCardIds: readonly string[]): DeckCodeDecodeResult {
  if (bytes.length < HEADER_BYTES) return { ok: false, error: 'bad-payload' };
  const format = BYTE_FORMAT.get(bytes[0]);
  const flags = bytes[1];
  if (format === undefined || (flags & ~(FLAG_DARLING | FLAG_RESERVE)) !== 0) return { ok: false, error: 'bad-payload' };
  const hasDarling = (flags & FLAG_DARLING) !== 0;
  const hasReserve = (flags & FLAG_RESERVE) !== 0;
  // Only a Darlings code names a Darling, and only a code with a format carries a Warchest.
  if ((hasDarling && format !== 'darlings') || (hasReserve && format === null)) return { ok: false, error: 'bad-payload' };
  const lookup = buildHashLookup(knownCardIds);
  if (!lookup) return { ok: false, error: 'bad-payload' };

  let offset = HEADER_BYTES;
  let darlingId: string | null = null;
  if (hasDarling) {
    if (bytes.length < offset + HASH_BYTES) return { ok: false, error: 'bad-payload' };
    const id = lookup.get(readHash(bytes, offset));
    if (!id) return { ok: false, error: 'unknown-card' };
    darlingId = id;
    offset += HASH_BYTES;
  }

  let landReserve: string[] | null = null;
  if (hasReserve) {
    if (bytes.length < offset + 1) return { ok: false, error: 'bad-payload' };
    const end = offset + 1 + bytes[offset] * RUN_BYTES;
    if (bytes.length < end) return { ok: false, error: 'bad-payload' };
    const reserve = readRuns(bytes, offset + 1, end, lookup);
    if (!Array.isArray(reserve)) return reserve;
    landReserve = reserve;
    offset = end;
  }

  const cards = readRuns(bytes, offset, bytes.length, lookup);
  if (!Array.isArray(cards)) return cards;
  return { ok: true, cards, format, darlingId, landReserve };
}

/** The cards the runs in bytes[start, end) spell out, or the error that stops them. */
function readRuns(
  bytes: Uint8Array,
  start: number,
  end: number,
  lookup: ReadonlyMap<number, string>,
): string[] | DeckCodeFailure {
  if ((end - start) % RUN_BYTES !== 0) return { ok: false, error: 'bad-payload' };
  const cards: string[] = [];
  for (let i = start; i < end; i += RUN_BYTES) {
    const count = bytes[i + HASH_BYTES];
    const id = lookup.get(readHash(bytes, i));
    if (count <= 0) return { ok: false, error: 'bad-payload' };
    if (!id) return { ok: false, error: 'unknown-card' };
    if (cards.length + count > MAX_DECK_CODE_CARDS) return { ok: false, error: 'too-many-cards' };
    for (let n = 0; n < count; n++) cards.push(id);
  }
  return cards;
}

function readHash(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
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

  return { ok: true, cards, format: null, darlingId: null, landReserve: null };
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
