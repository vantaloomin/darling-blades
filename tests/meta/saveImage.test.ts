import { describe, expect, it } from 'vitest';
import { deflateSync } from 'fflate';
import {
  SAVE_IMAGE_KEYWORD,
  crc32,
  embedSaveCode,
  hasPngSignature,
  isSaveCard,
  readSaveCode,
  saveImageFilename,
} from '../../src/meta/SaveImage';
import { encode } from '../../src/meta/SaveCode';
import { freshSave } from '../../src/meta/SaveManager';

/**
 * Save cards carry a save code in a PNG `tEXt` chunk. The property that matters
 * is that the PNG is a CARRIER, not a format: the bytes inside are the same
 * `DBS1-…` string the text export produces, so SaveCode keeps owning all
 * validation. These tests therefore focus on the byte surgery, which is where
 * silent corruption would hide.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function chunk(type: string, data: number[]): number[] {
  const body = [...type].map((c) => c.charCodeAt(0)).concat(data);
  return [...u32(data.length), ...body, ...u32(crc32(Uint8Array.from(body)))];
}

/**
 * A structurally valid 1x1 PNG. Built rather than fixtured so the test never
 * depends on a binary blob in the repo, and so IHDR/IDAT/IEND ordering is
 * visible in the test itself.
 */
function tinyPng(): Uint8Array {
  const ihdr = chunk('IHDR', [...u32(1), ...u32(1), 8, 2, 0, 0, 0]);
  // One scanline: filter byte 0 then an RGB triple, zlib-wrapped as PNG wants.
  const idatBody = Array.from(deflateSync(Uint8Array.from([0, 0, 0, 0])));
  const idat = chunk('IDAT', idatBody);
  const iend = chunk('IEND', []);
  return Uint8Array.from([...SIGNATURE, ...ihdr, ...idat, ...iend]);
}

function chunkTypes(png: Uint8Array): string[] {
  const types: string[] = [];
  let offset = 8;
  while (offset + 8 <= png.length) {
    const length = ((png[offset] << 24) | (png[offset + 1] << 16) | (png[offset + 2] << 8) | png[offset + 3]) >>> 0;
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    types.push(type);
    offset += 8 + length + 4;
    if (type === 'IEND') break;
  }
  return types;
}

describe('crc32', () => {
  it('matches the known PNG/zlib check values', () => {
    expect(crc32(Uint8Array.from([]))).toBe(0);
    expect(crc32(Uint8Array.from([...'123456789'].map((c) => c.charCodeAt(0))))).toBe(0xcbf43926);
    expect(crc32(Uint8Array.from([...'IEND'].map((c) => c.charCodeAt(0))))).toBe(0xae426082);
  });
});

describe('embedSaveCode / readSaveCode', () => {
  it('round-trips a code through a PNG', () => {
    const code = 'DBS1-abcdefghijklmnop';
    const out = embedSaveCode(tinyPng(), code);
    expect(hasPngSignature(out)).toBe(true);
    expect(readSaveCode(out)).toEqual({ ok: true, code });
  });

  it('round-trips a REAL save code, the thing this exists for', () => {
    const code = encode(freshSave(123));
    const result = readSaveCode(embedSaveCode(tinyPng(), code));
    expect(result.ok).toBe(true);
    expect(result.code).toBe(code);
  });

  it('puts the chunk immediately before IEND and leaves the image chunks alone', () => {
    const out = embedSaveCode(tinyPng(), 'DBS1-x');
    expect(chunkTypes(out)).toEqual(['IHDR', 'IDAT', 'tEXt', 'IEND']);
    // The pixel data must be byte-identical: this is metadata, not a re-encode.
    const before = tinyPng();
    const idatBefore = before.subarray(8 + 25, before.length - 12);
    const idatAfter = out.subarray(8 + 25, 8 + 25 + idatBefore.length);
    expect([...idatAfter]).toEqual([...idatBefore]);
  });

  it('replaces its own chunk instead of accumulating them', () => {
    const once = embedSaveCode(tinyPng(), 'DBS1-first');
    const twice = embedSaveCode(once, 'DBS1-second');
    expect(chunkTypes(twice).filter((t) => t === 'tEXt')).toHaveLength(1);
    expect(readSaveCode(twice).code).toBe('DBS1-second');
  });

  it('survives a long payload, which is the whole point over a text code', () => {
    // Text codes hit a UX ceiling long before this; a tEXt chunk does not.
    const code = `DBS1-${'x'.repeat(400_000)}`;
    const result = readSaveCode(embedSaveCode(tinyPng(), code));
    expect(result.ok).toBe(true);
    expect(result.code).toHaveLength(code.length);
  });

  it('keeps every CRC valid, so ordinary image tools still open the file', () => {
    const out = embedSaveCode(tinyPng(), 'DBS1-x');
    let offset = 8;
    let checked = 0;
    while (offset + 8 <= out.length) {
      const length = ((out[offset] << 24) | (out[offset + 1] << 16) | (out[offset + 2] << 8) | out[offset + 3]) >>> 0;
      const body = out.subarray(offset + 4, offset + 8 + length);
      const stored =
        ((out[offset + 8 + length] << 24) |
          (out[offset + 9 + length] << 16) |
          (out[offset + 10 + length] << 8) |
          out[offset + 11 + length]) >>> 0;
      expect(crc32(body)).toBe(stored);
      checked++;
      const type = String.fromCharCode(...out.subarray(offset + 4, offset + 8));
      offset += 8 + length + 4;
      if (type === 'IEND') break;
    }
    expect(checked).toBe(4);
  });
});

describe('readSaveCode failures', () => {
  it('names a non-PNG rather than throwing', () => {
    const result = readSaveCode(Uint8Array.from([1, 2, 3, 4]));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not-png');
    expect(result.message).toContain('not a PNG');
  });

  it('names an ordinary PNG with no save in it', () => {
    const result = readSaveCode(tinyPng());
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-save-chunk');
    // The likeliest real cause is an editor that stripped ancillary chunks.
    expect(result.message).toContain('strip');
  });

  it('rejects a truncated file instead of reading past the buffer', () => {
    const full = embedSaveCode(tinyPng(), 'DBS1-x');
    const result = readSaveCode(full.subarray(0, full.length - 10));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('truncated');
  });

  it('rejects a chunk whose declared length overruns the file', () => {
    const png = embedSaveCode(tinyPng(), 'DBS1-x');
    const tampered = Uint8Array.from(png);
    tampered[8] = 0xff; // blow up IHDR's declared length
    expect(readSaveCode(tampered).ok).toBe(false);
  });

  it('rejects a chunk carrying something that is not a save code', () => {
    const png = embedSaveCode(tinyPng(), 'DBS1-x');
    const hijacked = embedSaveCode(png, 'not-a-save-code');
    const result = readSaveCode(hijacked);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('bad-chunk');
  });

  it('isSaveCard is a cheap yes/no over the same check', () => {
    expect(isSaveCard(embedSaveCode(tinyPng(), 'DBS1-x'))).toBe(true);
    expect(isSaveCard(tinyPng())).toBe(false);
    expect(isSaveCard(Uint8Array.from([0]))).toBe(false);
  });

  it('refuses to embed into something that is not a PNG', () => {
    expect(() => embedSaveCode(Uint8Array.from([1, 2, 3]), 'DBS1-x')).toThrow(/not a PNG/);
  });
});

describe('saveImageFilename', () => {
  it('is stable, sortable and space-free', () => {
    expect(saveImageFilename(new Date(2026, 7, 24))).toBe('darling-blades-save-2026-08-24.png');
    expect(saveImageFilename(new Date(2026, 11, 5))).toBe('darling-blades-save-2026-12-05.png');
  });

  it('uses the keyword the reader looks for', () => {
    expect(SAVE_IMAGE_KEYWORD).toBe('darlingblades-save');
  });
});
