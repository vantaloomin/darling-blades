import { createHash } from 'node:crypto';
import { deflateSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { decode, encode, MAX_DECODED_SAVE_BYTES, type SaveCodeDecodeResult } from '../../src/meta/SaveCode';
import { CURRENT_SAVE_VERSION, freshSave, SaveManager, type SaveData } from '../../src/meta/SaveManager';
import { parseVariantKey, variantKey } from '../../src/meta/variants';
import { GOLDEN_FRESH_SAVE_CODE } from './saveCode.fixtures';

const NOW = 1_700_000_000_000;

function currentFixture(): SaveData {
  const save = freshSave(NOW);
  save.gold = 777;
  save.collection = { 'bk-wolfqueen': 2, 'land-forest': 4 };
  save.collectionVariants = {
    'bk-wolfqueen': { 'white|none|false': 2 },
    'land-forest': { 'white|none|false': 4 },
  };
  save.decks = [{
    id: 'deck-1',
    name: 'Forest test',
    cards: ['bk-wolfqueen', 'land-forest'],
    heroCardId: null,
    landStyle: { 'land-forest': 'dark-tales' },
    format: 'constructed',
    darlingId: null,
    landReserve: null,
    variantPins: [null, null],
  }];
  save.activeDeckId = 'deck-1';
  save.stats.wins = 8;
  save.stats.losses = 3;
  save.gauntlet.bestRung = 6;
  save.gauntlet.completions = 1;
  save.replays = [replayFixture()];
  return save;
}

function replayFixture(): SaveData['replays'][number] {
  return {
    v: 2,
    dbStamp: '0.00000000',
    seed: 4815,
    decks: [['bk-wolfqueen'], ['land-forest']],
    context: {
      mode: 'practice',
      difficulty: 'easy',
      opponentId: null,
      opponentName: 'Training dummy',
      gauntletRung: null,
    },
    actions: [{ p: 0, a: { type: 'passStep' } }],
    result: 'win',
    endedAt: NOW + 1000,
    turns: 1,
  };
}

function fakeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
}

function migrated(raw: Record<string, unknown>): SaveData {
  return new SaveManager(fakeStorage(), NOW).migrate(raw, NOW);
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function codeForPayload(payloadText: string, schemaVersion: number): string {
  const payload = base64Url(deflateSync(strToU8(payloadText)));
  const envelope = {
    magic: 'DBS1',
    codec: 'deflate-json-v1',
    schemaVersion,
    checksum: createHash('sha256').update(payload, 'utf8').digest('hex'),
    payload,
  };
  return `DBS1-${base64Url(strToU8(JSON.stringify(envelope)))}`;
}

function codeForRaw(raw: Record<string, unknown>): string {
  return codeForPayload(JSON.stringify(raw), raw.version as number);
}

function currentVersionFixture(version: number): Record<string, unknown> {
  const save = currentFixture() as unknown as Record<string, unknown>;
  save.version = version;
  if (version < 24) delete (save.settings as Record<string, unknown>).confirmNoBlock;
  if (version < 23) {
    const decks = save.decks as Array<Record<string, unknown>>;
    for (const deck of decks) {
      delete deck.format;
      delete deck.darlingId;
      delete deck.landReserve;
      delete deck.variantPins;
    }
  }
  if (version < 22) {
    const decks = save.decks as Array<Record<string, unknown>>;
    for (const deck of decks) delete deck.landStyle;
  }
  if (version < 21) {
    const decks = save.decks as Array<Record<string, unknown>>;
    for (const deck of decks) delete deck.landStyle;
  }
  if (version < 20) delete save.replays;
  if (version < 19) delete (save.limited as Record<string, unknown>).premiumWeek;
  if (version < 17) delete (save.limited as Record<string, unknown>).personaSeen;
  if (version < 16) {
    const limited = save.limited as Record<string, unknown>;
    limited.activeRun = null;
  }
  if (version < 15) {
    save.decks = [{ id: 'deck-1', name: 'Forest test', cards: ['bk-wolfqueen', 'land-forest'] }];
  }
  if (version < 14) delete save.limited;
  if (version < 13) delete save.daily;
  if (version < 12) {
    const gauntlet = save.gauntlet as Record<string, unknown>;
    delete gauntlet.clearStyles;
  }
  if (version < 11) delete save.achievements;
  if (version < 10) delete save.tutorialDone;
  if (version < 9) delete save.heroPortraitId;
  if (version < 8) delete (save.settings as Record<string, unknown>).keywordReminders;
  if (version < 7) delete (save.settings as Record<string, unknown>).confirmDestructive;
  if (version < 6) {
    delete save.heroCardId;
    (save.gauntlet as Record<string, unknown>).run = null;
  }
  if (version < 5) (save.settings as Record<string, unknown>).renderScale = 'auto';
  if (version < 4) {
    delete save.collectionVariants;
    save.settings = { volume: 0.5, animSpeed: 'fast' };
  }
  if (version < 3) delete (save.settings as Record<string, unknown>).musicOn;
  if (version < 2) delete save.gauntlet;
  if (version >= 4) {
    save.collectionVariants = { 'bk-wolfqueen': { 'white|none': 2 } };
  }
  return save;
}

function expectOk(result: SaveCodeDecodeResult): Extract<SaveCodeDecodeResult, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe('SaveCode', () => {
  it('round-trips a normalized current save with deep equality', () => {
    const save = currentFixture();
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
    const decoded = expectOk(decode(encode(save, { includeReplays: true })));
    expect(decoded.save).toEqual(migrated(save as unknown as Record<string, unknown>));
    expect(decoded.preview).toEqual({
      creationDate: NOW,
      collectionCount: 6,
      collectionDistinctCount: 2,
      gold: 777,
      deckCount: 1,
      progressSummary: { wins: 8, losses: 3, bestGauntletRung: 6, gauntletCompletions: 1 },
      sourceSchemaVersion: CURRENT_SAVE_VERSION,
      replaysPresent: true,
    });
  });

  it('decodes and migrates a fixture for every historical SaveData version', () => {
    for (let version = 1; version <= CURRENT_SAVE_VERSION; version++) {
      const raw = currentVersionFixture(version);
      const decoded = expectOk(decode(codeForRaw(raw)));
      expect(decoded.preview.sourceSchemaVersion).toBe(version);
      expect(decoded.save).toEqual(migrated(raw));
      expect(decoded.save.version).toBe(CURRENT_SAVE_VERSION);
    }
  });

  it('keeps a literal golden code stable', () => {
    const golden = expectOk(decode(GOLDEN_FRESH_SAVE_CODE));
    const regenerated = expectOk(decode(encode(freshSave(NOW))));
    expect(golden.save).toEqual(regenerated.save);
    expect(golden.preview).toEqual({ ...regenerated.preview, sourceSchemaVersion: 22 });
  });

  it('rejects a corrupted checksum as a structured checksum error', () => {
    const code = encode(freshSave(NOW));
    const envelope = JSON.parse(Buffer.from(code.slice(5), 'base64url').toString('utf8')) as { checksum: string };
    envelope.checksum = `${envelope.checksum.slice(0, -1)}${envelope.checksum.endsWith('0') ? '1' : '0'}`;
    const corrupted = `DBS1-${Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url')}`;
    const result = decode(corrupted);
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'checksum-failed',
        message: 'This save code failed its integrity check. It may have been changed or damaged.',
      },
    });
  });

  it('rejects a truncated code before attempting the payload', () => {
    const result = decode(encode(freshSave(NOW)).slice(0, -1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('truncated');
  });

  it('enforces the bounded decoded payload limit', () => {
    const raw = freshSave(NOW) as unknown as Record<string, unknown>;
    const collection: Record<string, number> = {};
    for (let i = 0; i < 100_000; i++) collection[`stress-${i}`] = 1;
    raw.collection = collection;
    const result = decode(codeForRaw(raw));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('oversized');
  });

  it('stops a high-ratio payload at the decoded byte limit', () => {
    const payloadText = JSON.stringify({ version: 22, padding: 'x'.repeat(MAX_DECODED_SAVE_BYTES) });
    const code = codeForPayload(payloadText, 22);
    expect(code.length).toBeLessThan(10_000);
    const result = decode(code);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('oversized');
  });

  it('rejects a migrated payload that contains only its version', () => {
    const result = decode(codeForRaw({ version: 22 }));
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid',
        message: 'This save code does not contain an importable save profile.',
      },
    });
  });

  it('rejects a migrated payload with an incomplete collection profile', () => {
    const result = decode(codeForRaw({ version: 22, collection: {} }));
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid',
        message: 'This save code does not contain an importable save profile.',
      },
    });
  });

  it('rejects deeply nested payloads without overflowing the stack', () => {
    const depth = 3000;
    const nestedJson = `${'{"child":'.repeat(depth)}{}${'}'.repeat(depth)}`;
    const result = decode(codeForPayload(`{"version":22,"nested":${nestedJson}}`, 22));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid');
  });

  it('rejects mismatched inner and envelope schema metadata', () => {
    const result = decode(codeForPayload(JSON.stringify({ version: 22 }), 21));
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid',
        message: 'This save code has mismatched schema metadata.',
      },
    });
  });

  it('refuses a future schema before accepting its payload', () => {
    const raw = { ...freshSave(NOW), version: CURRENT_SAVE_VERSION + 1 } as unknown as Record<string, unknown>;
    const result = decode(codeForRaw(raw));
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'future-version',
        message: 'This save code was created by a newer version of Darling Blades.',
      },
    });
  });

  it('classifies malformed JSON separately from a checksum failure', () => {
    const result = decode(codeForPayload('{"version":22', 22));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('malformed-json');
  });

  it('rejects prototype-pollution-shaped input without touching Object.prototype', () => {
    const raw = JSON.parse(JSON.stringify(freshSave(NOW))) as Record<string, unknown>;
    raw.collection = JSON.parse('{"__proto__":{"polluted":"yes"}}') as Record<string, unknown>;
    const before = (Object.prototype as Record<string, unknown>).polluted;
    const result = decode(codeForRaw(raw));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('prototype-pollution-shaped');
    expect((Object.prototype as Record<string, unknown>).polluted).toBe(before);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('normalizes noncanonical variant keys through SaveManager migration', () => {
    const raw = currentVersionFixture(20);
    const decoded = expectOk(decode(codeForRaw(raw)));
    const variants = decoded.save.collectionVariants['bk-wolfqueen'];
    expect(variants).toEqual({ [variantKey(parseVariantKey('white|none'))]: 2 });
  });

  it('excludes replays by default and includes them only when requested', () => {
    const save = currentFixture();
    const omitted = expectOk(decode(encode(save)));
    const included = expectOk(decode(encode(save, { includeReplays: true })));
    expect(omitted.save.replays).toEqual([]);
    expect(omitted.preview.replaysPresent).toBe(false);
    expect(included.save.replays).toEqual(save.replays);
    expect(included.preview.replaysPresent).toBe(true);
  });

  it('decodes the same code idempotently', () => {
    const code = encode(currentFixture(), { includeReplays: true });
    expect(decode(code)).toEqual(decode(code));
  });
});
