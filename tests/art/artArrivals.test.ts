import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtArrivals } from '../../src/art/artArrivals';

/**
 * The redraw contract behind streamed card art: anything drawn with the
 * loading stand-in waits in this book under the texture it wanted, and runs
 * exactly once when that texture arrives. The Phaser binding
 * (`src/art/artWatch.ts`) feeds `arrived` from the TextureManager and cancels
 * a wait when its view is destroyed or its scene shuts down; what it relies on
 * is tested here.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe('waiting for card art to arrive', () => {
  it('runs a wait once, on the arrival of its own texture only', () => {
    const book = new ArtArrivals();
    const redraw = vi.fn();
    book.watch('artfile-a', redraw);

    book.arrived('artfile-b');
    expect(redraw).not.toHaveBeenCalled();

    book.arrived('artfile-a');
    expect(redraw).toHaveBeenCalledTimes(1);

    book.arrived('artfile-a');
    expect(redraw).toHaveBeenCalledTimes(1);
  });

  it('runs every wait on the same texture', () => {
    const book = new ArtArrivals();
    const tile = vi.fn();
    const thumb = vi.fn();
    book.watch('artfile-a', tile);
    book.watch('artfile-a', thumb);

    book.arrived('artfile-a');
    expect(tile).toHaveBeenCalledTimes(1);
    expect(thumb).toHaveBeenCalledTimes(1);
  });

  it('never runs a cancelled wait, and a cancel touches only its own wait', () => {
    const book = new ArtArrivals();
    const redraw = vi.fn();
    const cancelFirst = book.watch('artfile-a', redraw);
    book.watch('artfile-a', redraw);

    cancelFirst();
    cancelFirst();
    book.arrived('artfile-a');
    expect(redraw).toHaveBeenCalledTimes(1);
  });

  it('forgets every wait once it has run or been cancelled', () => {
    const book = new ArtArrivals();
    const cancel = book.watch('artfile-a', () => {});
    book.watch('artfile-b', () => {});
    expect(book.size).toBe(2);

    cancel();
    book.arrived('artfile-b');
    expect(book.size).toBe(0);
  });

  it('treats a cancel after the wait has run as a no-op, even once a new wait exists', () => {
    const book = new ArtArrivals();
    const first = vi.fn();
    const second = vi.fn();
    const cancelFirst = book.watch('artfile-a', first);
    book.arrived('artfile-a');

    book.watch('artfile-a', second);
    cancelFirst();
    book.arrived('artfile-a');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps a wait registered during an arrival for the next arrival of that texture', () => {
    const book = new ArtArrivals();
    const again = vi.fn();
    book.watch('artfile-a', () => {
      book.watch('artfile-a', again);
    });

    book.arrived('artfile-a');
    expect(again).not.toHaveBeenCalled();
    expect(book.size).toBe(1);

    book.arrived('artfile-a');
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('keeps going past a redraw that throws, so the loader that reports arrivals never sees the error', () => {
    const book = new ArtArrivals();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    book.watch('artfile-a', () => {
      throw new Error('broken view');
    });
    book.watch('artfile-a', after);

    expect(() => book.arrived('artfile-a')).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
