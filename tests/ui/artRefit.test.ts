import { describe, expect, it, vi } from 'vitest';
import { ArtArrivals } from '../../src/art/artArrivals';
import type { ArtRef } from '../../src/art/ArtResolver';
import { fitAndHoldArt, type ArtHold } from '../../src/ui/artRefit';

/**
 * The portrait surfaces' contract with streamed card art (1.9: I9, then lane
 * D's S4): a portrait shows the best art resident when it is drawn (the full
 * file, else the half file, else the loading stand-in), moves to better art
 * when it lands, and when the texture it shows is removed (evicted, or swept
 * at a context restore) it moves to whatever is still resident and waits
 * again. Every move is fitted to the new texture's own size. Seven call sites
 * go through `src/ui/portraitArt.ts`, which is this rule bound to `holdArt`
 * (whose own lease and lifetime rules are `tests/art/artWatch.test.ts`).
 */

const FULL = 'artfile-portrait';
const HALF = 'arthalf-portrait';
const STAND_IN = 'art-loading';

/** Texture sizes: the stand-in and the full file are 640x800, the half file 320x400. */
const SIZES: Record<string, { width: number; height: number }> = {
  [STAND_IN]: { width: 640, height: 800 },
  [FULL]: { width: 640, height: 800 },
  [HALF]: { width: 320, height: 400 },
};

/** A stand-in for a Phaser Image: its size follows its texture, as Phaser's does. */
class FakeImage {
  active = true;
  textureKey: string;
  frame: string | number | undefined;
  width: number;
  height: number;
  scale = 1;

  constructor(ref: ArtRef) {
    this.textureKey = ref.textureKey;
    this.frame = ref.frameName;
    this.width = SIZES[ref.textureKey].width;
    this.height = SIZES[ref.textureKey].height;
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

/**
 * The textures resident, a resolver over them (the desktop tier's answer:
 * full, else half with the full pending, else the stand-in with the full
 * pending), and a hold with `holdArt`'s firing rules: once, when the pending
 * texture arrives or the drawn one is removed.
 */
function world(resident: string[]): {
  resolve: () => ArtRef;
  hold: ArtHold<FakeImage>;
  add: (key: string) => void;
  remove: (key: string) => void;
  holds: () => number;
} {
  const textures = new Set(resident);
  const arrivals = new ArtArrivals();
  const removals = new ArtArrivals();
  const resolve = (): ArtRef => {
    if (textures.has(FULL)) return { textureKey: FULL };
    if (textures.has(HALF)) return { textureKey: HALF, pending: FULL };
    return { textureKey: STAND_IN, pending: FULL };
  };
  const hold: ArtHold<FakeImage> = (_owner, ref, reapply) => {
    let done = false;
    const stops: (() => void)[] = [];
    const end = (): void => {
      done = true;
      for (const stop of stops) stop();
    };
    const fire = (): void => {
      if (done) return;
      end();
      reapply();
    };
    if (ref.pending !== undefined) stops.push(arrivals.watch(ref.pending, fire));
    if (ref.textureKey !== STAND_IN) stops.push(removals.watch(ref.textureKey, fire));
    return end;
  };
  return {
    resolve,
    hold,
    add: (key) => {
      textures.add(key);
      arrivals.arrived(key);
    },
    remove: (key) => {
      textures.delete(key);
      removals.arrived(key);
    },
    holds: () => arrivals.size + removals.size,
  };
}

function portrait(w: ReturnType<typeof world>, fit = coverFit): FakeImage {
  const first = w.resolve();
  const image = new FakeImage(first);
  fitAndHoldArt(image, first, w.resolve, fit, w.hold);
  return image;
}

describe('a portrait drawn before its art has loaded', () => {
  it('shows the real texture, fitted to its size, once the art lands', () => {
    const w = world([STAND_IN]);
    const image = portrait(w);
    expect(image.textureKey).toBe(STAND_IN);

    w.add(FULL);
    expect(image.textureKey).toBe(FULL);
    // A real art file is a whole texture, never an atlas frame.
    expect(image.frame).toBeUndefined();
    expect(image.scale).toBeCloseTo(200 / 640);
  });

  it('shows the resident half file first, fitted to its size, then the full file', () => {
    const w = world([STAND_IN, HALF]);
    const image = portrait(w);
    expect(image.textureKey).toBe(HALF);
    expect(image.scale).toBeCloseTo(200 / 320);

    w.add(FULL);
    expect(image.textureKey).toBe(FULL);
    expect(image.scale).toBeCloseTo(200 / 640);
  });

  it('keeps the stand-in while other art lands', () => {
    const w = world([STAND_IN]);
    const image = portrait(w);

    w.add('artfile-other');
    expect(image.textureKey).toBe(STAND_IN);
  });

  it('never touches a portrait destroyed before its art lands', () => {
    // A hold that outlives its image (the game's hold ends with the image;
    // this guards the redraw itself, since a redraw on a destroyed GameObject
    // throws inside the texture manager's event).
    const w = world([STAND_IN]);
    const fit = vi.fn(coverFit);
    const image = portrait(w, fit);
    const setTexture = vi.spyOn(image, 'setTexture');

    image.active = false;
    w.add(FULL);
    expect(setTexture).not.toHaveBeenCalled();
    expect(fit).toHaveBeenCalledTimes(1);
  });
});

describe('a portrait whose texture is removed', () => {
  it('moves to the resident half file in the same tick, then back to the full file when it reloads', () => {
    const w = world([STAND_IN, HALF, FULL]);
    const image = portrait(w);
    expect(image.textureKey).toBe(FULL);

    w.remove(FULL);
    expect(image.textureKey).toBe(HALF);
    expect(image.scale).toBeCloseTo(200 / 320);

    w.add(FULL);
    expect(image.textureKey).toBe(FULL);
    expect(image.scale).toBeCloseTo(200 / 640);
  });

  it('moves to the stand-in when nothing else is resident, and keeps exactly one hold', () => {
    const w = world([STAND_IN, FULL]);
    const image = portrait(w);

    w.remove(FULL);
    expect(image.textureKey).toBe(STAND_IN);
    expect(w.holds()).toBe(1);
  });
});

describe('a portrait drawn with its art already loaded', () => {
  it('is fitted once, and holds only against removal', () => {
    const w = world([STAND_IN, FULL]);
    const fit = vi.fn(coverFit);
    const image = portrait(w, fit);

    w.add(HALF);
    expect(fit).toHaveBeenCalledTimes(1);
    expect(image.scale).toBeCloseTo(200 / 640);
    expect(w.holds()).toBe(1);
  });
});
