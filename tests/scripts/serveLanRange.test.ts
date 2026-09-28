import { describe, expect, it } from 'vitest';
import { parseRange } from '../../scripts/serve-lan';

/**
 * The LAN server's byte ranges (scripts/serve-lan.ts): the web build reads a
 * card out of its art pack with a single `bytes=a-b` range, so the server must
 * answer that span as a 206, report a span past the end as a 416, and fall
 * back to the whole file for anything it does not handle (which the game's
 * source copes with as whole-pack mode).
 */
describe('serve-lan byte ranges', () => {
  it('answers a closed span inclusively', () => {
    expect(parseRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=40-40', 100)).toEqual({ start: 40, end: 40 });
  });

  it('answers open and suffix spans, clamped to the file', () => {
    expect(parseRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 });
  });

  it('refuses a span that starts past the end', () => {
    expect(parseRange('bytes=100-120', 100)).toBe('unsatisfiable');
    expect(parseRange('bytes=-0', 100)).toBe('unsatisfiable');
  });

  it('sends the whole file for no header, another unit, a malformed or multi-part range', () => {
    expect(parseRange(undefined, 100)).toBeNull();
    expect(parseRange('items=0-9', 100)).toBeNull();
    expect(parseRange('bytes=9-2', 100)).toBeNull();
    expect(parseRange('bytes=-', 100)).toBeNull();
    expect(parseRange('bytes=0-9,20-29', 100)).toBeNull();
  });
});
