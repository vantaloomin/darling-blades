import { describe, expect, it, vi } from 'vitest';
import { ArtArrivals } from '../../src/art/artArrivals';
import { fitNowAndWhenArtLands, type ArtArrivalWait } from '../../src/ui/artRefit';

/**
 * The portrait surfaces' contract with streamed card art (1.9, I9): a
 * portrait drawn while its art file is still loading shows the loading
 * stand-in, and when the file lands it shows the real texture, fitted to that
 * texture's own size. Eight call sites (the tower, the duel's commander frames
 * and run recap, the versus bumper, the practice and shop tiles, the draft
 * seats) go through `src/ui/portraitArt.ts`, which is this rule bound to
 * `redrawWhenArtLands`.
 */

/** Texture sizes this scenario knows: the stand-in and a `lite` half-res file. */
const SIZES: Record<string, { width: number; height: number }> = {
  'art-loading': { width: 640, height: 800 },
  'artfile-portrait': { width: 320, height: 400 },
  'artfile-other': { width: 320, height: 400 },
};

/** A stand-in for a Phaser Image: its size follows its texture, as Phaser's does. */
class FakeImage {
  active = true;
  textureKey: string;
  frame: string | number | undefined;
  width: number;
  height: number;
  scale = 1;

  constructor(textureKey: string, frame?: string) {
    this.textureKey = textureKey;
    this.frame = frame;
    this.width = SIZES[textureKey].width;
    this.height = SIZES[textureKey].height;
  }

  setTexture(key: string, frame?: string | number): this {
    this.textureKey = key;
    this.frame = frame;
    this.width = SIZES[key].width;
    this.height = SIZES[key].height;
    return this;
  }
}

/** Cover a 200-wide window: the scale depends on the texture's width. */
const coverFit = (image: FakeImage): void => {
  image.scale = 200 / image.width;
};

/** The game's wait without Phaser: one book, fed by the test as textures land. */
function arrivalBook(): { book: ArtArrivals; wait: ArtArrivalWait<FakeImage> } {
  const book = new ArtArrivals();
  return { book, wait: (_owner, key, redraw) => book.watch(key, redraw) };
}

describe('a portrait drawn before its art has loaded', () => {
  it('shows the real texture, fitted to its size, once the art lands', () => {
    const { book, wait } = arrivalBook();
    const image = new FakeImage('art-loading');

    fitNowAndWhenArtLands(image, { textureKey: 'art-loading', pending: 'artfile-portrait' }, coverFit, wait);
    expect(image.scale).toBeCloseTo(200 / 640);

    book.arrived('artfile-portrait');
    expect(image.textureKey).toBe('artfile-portrait');
    // A real art file is a whole texture, never an atlas frame.
    expect(image.frame).toBeUndefined();
    expect(image.scale).toBeCloseTo(200 / 320);
  });

  it('keeps the stand-in while other art lands', () => {
    const { book, wait } = arrivalBook();
    const image = new FakeImage('art-loading');
    fitNowAndWhenArtLands(image, { textureKey: 'art-loading', pending: 'artfile-portrait' }, coverFit, wait);

    book.arrived('artfile-other');
    expect(image.textureKey).toBe('art-loading');
    expect(image.scale).toBeCloseTo(200 / 640);
  });

  it('never touches a portrait destroyed before its art lands', () => {
    // A wait that outlives its image (the game's wait ends with the image;
    // this guards the redraw itself, since a redraw on a destroyed GameObject
    // throws inside the loader's event).
    const { book, wait } = arrivalBook();
    const image = new FakeImage('art-loading');
    const setTexture = vi.spyOn(image, 'setTexture');
    const fit = vi.fn(coverFit);
    fitNowAndWhenArtLands(image, { textureKey: 'art-loading', pending: 'artfile-portrait' }, fit, wait);

    image.active = false;
    book.arrived('artfile-portrait');
    expect(setTexture).not.toHaveBeenCalled();
    expect(fit).toHaveBeenCalledTimes(1);
  });

  it('stops waiting when cancelled', () => {
    const { book, wait } = arrivalBook();
    const image = new FakeImage('art-loading');
    const cancel = fitNowAndWhenArtLands(
      image,
      { textureKey: 'art-loading', pending: 'artfile-portrait' },
      coverFit,
      wait,
    );

    cancel();
    expect(book.size).toBe(0);
    book.arrived('artfile-portrait');
    expect(image.textureKey).toBe('art-loading');
  });
});

describe('a portrait drawn with its art already loaded', () => {
  it('is fitted once and waits for nothing', () => {
    const { book, wait } = arrivalBook();
    const image = new FakeImage('artfile-portrait');
    const fit = vi.fn(coverFit);

    fitNowAndWhenArtLands(image, { textureKey: 'artfile-portrait' }, fit, wait);
    expect(fit).toHaveBeenCalledTimes(1);
    expect(image.scale).toBeCloseTo(200 / 320);
    expect(book.size).toBe(0);
  });
});
