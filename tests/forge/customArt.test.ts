import { describe, expect, it } from 'vitest';
import {
  MAX_DATA_URL_LENGTH,
  MAX_IMAGE_BYTES,
  base64ToBytes,
  bytesToDataUrl,
  imageIdFor,
  imageIdsInText,
  parseImageDataUrl,
  readCustomArt,
  readImageHeader,
  referencedImageIds,
  sha256HexFallback,
  unreferencedImages,
} from '../../src/forge/customArt';

const bytes = (...parts: (number[] | string)[]): Uint8Array => new Uint8Array(parts.flatMap((part) => (
  typeof part === 'string' ? [...part].map((char) => char.charCodeAt(0)) : part
)));
const be32 = (value: number): number[] => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const le16 = (value: number): number[] => [value & 255, (value >>> 8) & 255];
const be16 = (value: number): number[] => [(value >>> 8) & 255, value & 255];
const le24 = (value: number): number[] => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255];
const zeros = (n: number): number[] => new Array<number>(n).fill(0);

const png = (width: number, height: number) => bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), 'IHDR', be32(width), be32(height), [8, 6, 0, 0, 0]);
const gif = (width: number, height: number) => bytes('GIF89a', le16(width), le16(height), zeros(4));
const webpLossy = (width: number, height: number) => bytes('RIFF', zeros(4), 'WEBP', 'VP8 ', zeros(4), zeros(3), [0x9d, 0x01, 0x2a], le16(width), le16(height), zeros(4));
const webpLossless = (width: number, height: number) => {
  const bits = ((width - 1) | ((height - 1) << 14)) >>> 0;
  return bytes('RIFF', zeros(4), 'WEBP', 'VP8L', zeros(4), [0x2f], [bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255], zeros(6));
};
const webpExtended = (width: number, height: number) => bytes('RIFF', zeros(4), 'WEBP', 'VP8X', zeros(4), zeros(4), le24(width - 1), le24(height - 1), zeros(2));
const jpeg = (width: number, height: number, frameMarker = 0xc0) => bytes(
  [0xff, 0xd8],
  [0xff, 0xe0], be16(16), 'JFIF', [0], zeros(9),
  [0xff, 0xdb], be16(4), [0, 1],
  [0xff, frameMarker], be16(17), [8], be16(height), be16(width), zeros(12),
);

describe('reading an image\'s own header', () => {
  it('reads the format and size of PNG, GIF, WebP (all three kinds) and JPEG (baseline and progressive)', () => {
    expect(readImageHeader(png(300, 200))).toEqual({ type: 'image/png', width: 300, height: 200 });
    expect(readImageHeader(gif(64, 48))).toEqual({ type: 'image/gif', width: 64, height: 48 });
    expect(readImageHeader(webpLossy(1024, 768))).toEqual({ type: 'image/webp', width: 1024, height: 768 });
    expect(readImageHeader(webpLossless(1600, 900))).toEqual({ type: 'image/webp', width: 1600, height: 900 });
    expect(readImageHeader(webpExtended(4000, 3000))).toEqual({ type: 'image/webp', width: 4000, height: 3000 });
    expect(readImageHeader(jpeg(1920, 1080))).toEqual({ type: 'image/jpeg', width: 1920, height: 1080 });
    expect(readImageHeader(jpeg(640, 800, 0xc2))).toEqual({ type: 'image/jpeg', width: 640, height: 800 });
  });

  it('refuses anything that is not one of the four accepted formats', () => {
    const refused = [
      bytes('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'),
      bytes('<!doctype html><script>alert(1)</script>'),
      bytes('BM', zeros(60)),
      png(300, 200).slice(0, 20),
      bytes([0xff, 0xd8], [0xff, 0xe0], be16(16), zeros(14), [0xff, 0xda]),
      png(0, 200),
      new Uint8Array(0),
    ];
    for (const value of refused) expect(readImageHeader(value)).toBeNull();
  });

  it('refuses a picture whose header claims too many pixels to decode safely', () => {
    expect(readImageHeader(png(20000, 20000))).toBeNull();
    expect(readImageHeader(webpExtended(16383, 16383))).toBeNull();
  });
});

describe('image ids', () => {
  it('are the SHA-256 of the bytes, the same with or without crypto.subtle', async () => {
    // FIPS 180-2 test vectors.
    expect(sha256HexFallback(bytes('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256HexFallback(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    // Lengths either side of the padding boundaries.
    for (const length of [1, 55, 56, 63, 64, 65, 1000, 70001]) {
      const data = new Uint8Array(length).map((_value, index) => (index * 31 + length) & 255);
      expect(await imageIdFor(data), `${length} bytes`).toBe(sha256HexFallback(data));
    }
  });
});

describe('image data URLs', () => {
  it('carry the exact bytes there and back', () => {
    const data = new Uint8Array(70001).map((_value, index) => (index * 7) & 255);
    const url = bytesToDataUrl('image/webp', data);
    const parts = parseImageDataUrl(url);
    expect(parts?.type).toBe('image/webp');
    expect(base64ToBytes(parts!.base64)).toEqual(data);
  });

  it('refuse other types, broken base64 and anything over the per-image cap', () => {
    for (const value of [
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/png,not-base64',
      'data:image/png;base64,AAA',
      'data:image/png;base64,AA=A',
      'https://example.com/picture.png',
      'data:image/png;base64,',
      42,
    ]) {
      expect(parseImageDataUrl(value), String(value)).toBeNull();
    }
    const atCap = bytesToDataUrl('image/png', new Uint8Array(MAX_IMAGE_BYTES));
    expect(atCap.length).toBeLessThanOrEqual(MAX_DATA_URL_LENGTH);
    expect(parseImageDataUrl(atCap)).not.toBeNull();
    expect(parseImageDataUrl(bytesToDataUrl('image/png', new Uint8Array(MAX_IMAGE_BYTES + 3)))).toBeNull();
  });
});

describe('a card\'s own image from outside the page', () => {
  const ID = 'a'.repeat(64);
  const DATA_URL = bytesToDataUrl('image/png', png(8, 8));
  const framing = { zoom: 1.25, x: -0.5, y: 0.25, rotation: -30, flip: true, background: '#1a2b3c' };

  it('is rebuilt from its checked fields: an id in the autosave, a data URL in a set file', () => {
    expect(readCustomArt({ image: ID, ...framing }, 'id')).toEqual({ image: ID, ...framing });
    expect(readCustomArt({ image: DATA_URL, ...framing }, 'dataUrl')).toEqual({ image: DATA_URL, ...framing });
    expect(readCustomArt({ image: ID, ...framing, background: '#1A2B3C' }, 'id')?.background).toBe('#1a2b3c');
  });

  it('is refused when any field is wrong', () => {
    const refused: [string, unknown, 'id' | 'dataUrl'][] = [
      ['a data URL where an id belongs', { image: DATA_URL, ...framing }, 'id'],
      ['an id where a data URL belongs', { image: ID, ...framing }, 'dataUrl'],
      ['a web address', { image: 'https://example.com/x.png', ...framing }, 'dataUrl'],
      ['an unknown field', { image: ID, ...framing, onload: 'x' }, 'id'],
      ['a missing field', { image: ID, zoom: 1, x: 0, y: 0, rotation: 0, flip: false }, 'id'],
      ['zoom 0', { image: ID, ...framing, zoom: 0 }, 'id'],
      ['zoom past 5', { image: ID, ...framing, zoom: 5.01 }, 'id'],
      ['pan past 1', { image: ID, ...framing, x: 1.5 }, 'id'],
      ['rotation past 180', { image: ID, ...framing, rotation: 181 }, 'id'],
      ['a number as text', { image: ID, ...framing, zoom: '1' }, 'id'],
      ['flip as text', { image: ID, ...framing, flip: 'true' }, 'id'],
      ['a named color', { image: ID, ...framing, background: 'red' }, 'id'],
      ['a style injection', { image: ID, ...framing, background: '#000000;background:url(x)' }, 'id'],
      ['not an object', 'custom', 'id'],
      ['an array', [ID], 'id'],
    ];
    for (const [label, value, form] of refused) expect(readCustomArt(value, form), label).toBeNull();
    const polluted = JSON.parse(`{"image":"${ID}","zoom":1,"x":0,"y":0,"rotation":0,"flip":false,"background":"#000000","__proto__":{"polluted":true}}`) as unknown;
    expect(readCustomArt(polluted, 'id')).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('which stored images are still in use', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((char) => char.repeat(64));
  const card = (image?: string) => ({ art: image ? { custom: { image } } : {} });

  it('keeps every image a card refers to and lets the rest go', () => {
    const referenced = referencedImageIds([card(a), card(), null, card(b), card(a)]);
    expect([...referenced].sort()).toEqual([a, b]);
    expect(unreferencedImages([a, b, c, d], referenced).sort()).toEqual([c, d]);
    expect(unreferencedImages([a, b], referenced)).toEqual([]);
  });

  it('finds the images another tab\'s autosave names', () => {
    const saved = JSON.stringify({ set: { cards: [{ art: { donor: 'x', custom: { image: c, zoom: 1 } } }] }, editor: { entry: { art: { custom: { image: d } } } } });
    expect([...imageIdsInText(saved)].sort()).toEqual([c, d]);
    expect(imageIdsInText('{"image":"not-an-id"}').size).toBe(0);
  });
});
