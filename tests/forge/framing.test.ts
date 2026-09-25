import { describe, expect, it } from 'vitest';
import {
  ART_FILE_H,
  ART_FILE_W,
  ART_FRAMES,
  CARD_ART_RECTS,
  MAX_ZOOM,
  ZOOM_SLIDER_STEPS,
  artToCard,
  artToImage,
  artWindow,
  clampFraming,
  defaultFraming,
  fillFrame,
  fitWholeImage,
  framingTransform,
  imageToArt,
  leavesFrameEmpty,
  minZoom,
  panFraming,
  resetFraming,
  screenToArtDelta,
  sliderToZoom,
  zoomToSlider,
  type ArtFrame,
  type ArtFraming,
  type ImageSize,
} from '../../src/forge/framing';

const WIDE: ImageSize = { width: 1600, height: 900 };
const TALL: ImageSize = { width: 900, height: 1600 };
const SQUARE: ImageSize = { width: 1000, height: 1000 };
const SHAPES: [string, ImageSize][] = [['wide', WIDE], ['tall', TALL], ['square', SQUARE]];
const EPSILON = 1e-6;

/** The picture's four corners, where they land in the art file. */
function corners(image: ImageSize, framing: ArtFraming, frame: ArtFrame): { x: number; y: number }[] {
  const transform = framingTransform(image, framing, frame);
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([su, sv]) => imageToArt(transform, (su * image.width) / 2, (sv * image.height) / 2));
}

/** True when every art point of a fine grid over the frame's window shows the picture. */
function windowCovered(image: ImageSize, framing: ArtFraming, frame: ArtFrame): boolean {
  const transform = framingTransform(image, framing, frame);
  const window = artWindow(frame);
  for (let row = 0; row <= 20; row += 1) {
    for (let column = 0; column <= 20; column += 1) {
      const { u, v } = artToImage(transform, window.x + (window.w * column) / 20, window.y + (window.h * row) / 20);
      if (Math.abs(u) > image.width / 2 + EPSILON || Math.abs(v) > image.height / 2 + EPSILON) return false;
    }
  }
  return true;
}

function insideWindow(point: { x: number; y: number }, frame: ArtFrame): boolean {
  const window = artWindow(frame);
  return point.x >= window.x - EPSILON && point.x <= window.x + window.w + EPSILON
    && point.y >= window.y - EPSILON && point.y <= window.y + window.h + EPSILON;
}

describe('the art windows', () => {
  // The Forge composes in the 640 x 800 art file and CardView cover-crops it:
  // each frame's window is the centered part of the file that crop shows.
  it('are the centered, card-shaped part of the art file each frame shows, spanning it along one axis', () => {
    for (const frame of ART_FRAMES) {
      const window = artWindow(frame);
      const rect = CARD_ART_RECTS[frame];
      expect(window.w / window.h).toBeCloseTo(rect.w / rect.h, 9);
      expect(window.x + window.w / 2).toBeCloseTo(ART_FILE_W / 2, 9);
      expect(window.y + window.h / 2).toBeCloseTo(ART_FILE_H / 2, 9);
      expect(Math.abs(window.w - ART_FILE_W) < EPSILON || Math.abs(window.h - ART_FILE_H) < EPSILON).toBe(true);
      // Its corners land on the corners of the card's art window.
      expect(artToCard(frame, window.x, window.y)).toEqual({ x: expect.closeTo(rect.x, 9), y: expect.closeTo(rect.y, 9) });
      expect(artToCard(frame, window.x + window.w, window.y + window.h))
        .toEqual({ x: expect.closeTo(rect.x + rect.w, 9), y: expect.closeTo(rect.y + rect.h, 9) });
    }
  });
});

describe('zoom', () => {
  it('at 1, covers the whole art file exactly, for wide, tall and square pictures', () => {
    for (const [name, image] of SHAPES) {
      const points = corners(image, defaultFraming(), 'standard');
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const spanX = Math.max(...xs) - Math.min(...xs);
      const spanY = Math.max(...ys) - Math.min(...ys);
      expect(spanX >= ART_FILE_W - EPSILON && spanY >= ART_FILE_H - EPSILON, name).toBe(true);
      // Exactly: one side matches the file, so nothing more is cropped than covering needs.
      expect(Math.min(spanX - ART_FILE_W, spanY - ART_FILE_H), name).toBeCloseTo(0, 9);
    }
  });

  it('can go down to where the whole picture fits either frame at any angle, and no further', () => {
    for (const [name, image] of SHAPES) {
      const floor = minZoom(image);
      for (const frame of ART_FRAMES) {
        for (let rotation = -180; rotation <= 180; rotation += 15) {
          const framing = { ...defaultFraming(), zoom: floor, rotation };
          expect(corners(image, framing, frame).every((point) => insideWindow(point, frame)), `${name} ${frame} ${rotation}`).toBe(true);
        }
      }
      expect(clampFraming(image, { ...defaultFraming(), zoom: floor / 2 }).zoom, name).toBe(floor);
    }
  });

  it('stops at 5 times cover', () => {
    expect(clampFraming(WIDE, { ...defaultFraming(), zoom: 12 }).zoom).toBe(MAX_ZOOM);
  });

  it('runs the slider from the smallest zoom to the largest, and a position maps back to itself', () => {
    for (const [name, image] of SHAPES) {
      expect(sliderToZoom(image, 0), name).toBeCloseTo(minZoom(image), 12);
      expect(sliderToZoom(image, ZOOM_SLIDER_STEPS), name).toBeCloseTo(MAX_ZOOM, 12);
      let previous = 0;
      for (let position = 0; position <= ZOOM_SLIDER_STEPS; position += 37) {
        const zoom = sliderToZoom(image, position);
        expect(zoomToSlider(image, zoom), `${name} ${position}`).toBe(position);
        expect(zoom).toBeGreaterThan(previous);
        previous = zoom;
      }
    }
  });
});

describe('the framing buttons', () => {
  it('Fit Whole Image shows all of the picture, centered, as large as the frame allows', () => {
    for (const [name, image] of SHAPES) {
      for (const frame of ART_FRAMES) {
        for (const rotation of [0, 30, 90, -135]) {
          const label = `${name} ${frame} ${rotation}`;
          const fitted = fitWholeImage(image, { ...defaultFraming(), zoom: 3, x: 0.7, y: -0.5, rotation, flip: true }, frame);
          expect([fitted.x, fitted.y, fitted.rotation, fitted.flip], label).toEqual([0, 0, rotation, true]);
          const points = corners(image, fitted, frame);
          expect(points.every((point) => insideWindow(point, frame)), label).toBe(true);
          // As large as it can be: the picture touches the frame on one axis.
          const window = artWindow(frame);
          const gapX = Math.min(...points.map((point) => point.x)) - window.x;
          const gapY = Math.min(...points.map((point) => point.y)) - window.y;
          expect(Math.min(gapX, gapY), label).toBeCloseTo(0, 6);
        }
      }
    }
  });

  it('Fill the Frame leaves nothing of the frame empty, centered, at the smallest zoom that does', () => {
    for (const [name, image] of SHAPES) {
      for (const frame of ART_FRAMES) {
        for (const rotation of [0, 30, 90, -135]) {
          const label = `${name} ${frame} ${rotation}`;
          const filled = fillFrame(image, { ...defaultFraming(), zoom: 0.4, x: -1, y: 1, rotation }, frame);
          expect([filled.x, filled.y], label).toEqual([0, 0]);
          expect(windowCovered(image, filled, frame), label).toBe(true);
          expect(leavesFrameEmpty(image, filled, frame), label).toBe(false);
          expect(windowCovered(image, { ...filled, zoom: filled.zoom * 0.98 }, frame), label).toBe(false);
        }
      }
    }
  });

  it('Reset returns to zoom 1, centered, upright and unflipped, on a black background', () => {
    expect(resetFraming(WIDE)).toEqual({ zoom: 1, x: 0, y: 0, rotation: 0, flip: false, background: '#000000' });
  });
});

describe('the background', () => {
  it('shows exactly while the picture leaves part of the frame empty', () => {
    // A square picture at zoom 1 is 800 x 800 art pixels: it covers both windows.
    expect(leavesFrameEmpty(SQUARE, defaultFraming(), 'standard')).toBe(false);
    expect(leavesFrameEmpty(SQUARE, defaultFraming(), 'fullArt')).toBe(false);
    // At half size it is 400 x 400: smaller than either window.
    expect(leavesFrameEmpty(SQUARE, { ...defaultFraming(), zoom: 0.5 }, 'standard')).toBe(true);
    // Turned 45 degrees at zoom 1, its corners leave the Full Art window's corners bare.
    expect(leavesFrameEmpty(SQUARE, { ...defaultFraming(), rotation: 45 }, 'fullArt')).toBe(true);
    for (const [name, image] of SHAPES) {
      for (const frame of ART_FRAMES) {
        for (const zoom of [0.3, 0.8, 1, 1.7]) {
          for (const rotation of [0, 20, 45]) {
            const framing = { ...defaultFraming(), zoom, rotation, x: 0.3, y: -0.6 };
            expect(leavesFrameEmpty(image, framing, frame), `${name} ${frame} ${zoom} ${rotation}`).toBe(!windowCovered(image, framing, frame));
          }
        }
      }
    }
  });
});

describe('pan', () => {
  it('moves the picture by the drag distance, in art pixels, from the canvas pixels the pointer moved', () => {
    // The card is drawn at 1.45 canvas pixels per card pixel; the standard
    // window shows 0.4125 card pixels per art pixel (264 card px for 640 art px).
    const delta = screenToArtDelta(29, -11.6, 1.45, 'standard');
    expect(delta.dx).toBeCloseTo(29 / (1.45 * 0.4125), 9);
    expect(delta.dy).toBeCloseTo(-11.6 / (1.45 * 0.4125), 9);
    for (const [name, image] of SHAPES) {
      for (const frame of ART_FRAMES) {
        const start = { ...defaultFraming(), zoom: 1.8, rotation: 20, flip: true };
        const moved = panFraming(image, start, frame, 15, -9);
        const before = framingTransform(image, start, frame);
        const after = framingTransform(image, moved, frame);
        expect(after.centerX - before.centerX, `${name} ${frame}`).toBeCloseTo(15, 9);
        expect(after.centerY - before.centerY, `${name} ${frame}`).toBeCloseTo(-9, 9);
      }
    }
  });

  it('stops where the picture\'s edge meets the frame\'s edge', () => {
    const start = { ...defaultFraming(), zoom: 2 };
    const frame: ArtFrame = 'standard';
    const moved = panFraming(WIDE, start, frame, 1e6, 1e6);
    expect([moved.x, moved.y]).toEqual([1, 1]);
    // Moved right and down as far as it goes, the picture's top-left corner sits on the window's.
    const window = artWindow(frame);
    const topLeft = imageToArt(framingTransform(WIDE, moved, frame), -WIDE.width / 2, -WIDE.height / 2);
    expect(topLeft.x).toBeCloseTo(window.x, 9);
    expect(topLeft.y).toBeCloseTo(window.y, 9);
  });

  it('leaves an axis alone when the picture spans the frame exactly along it', () => {
    // Fitted into the standard window, a square picture is exactly as tall as the window.
    const fitted = fitWholeImage(SQUARE, defaultFraming(), 'standard');
    const moved = panFraming(SQUARE, fitted, 'standard', 40, 40);
    expect(moved.y).toBe(fitted.y);
    expect(moved.x).not.toBe(fitted.x);
  });
});

describe('placing the picture', () => {
  it('maps picture points to the art file and back, mirrored and turned', () => {
    const transform = framingTransform(WIDE, { ...defaultFraming(), zoom: 1.3, x: 0.4, y: -0.2, rotation: 37, flip: true }, 'fullArt');
    for (const [u, v] of [[0, 0], [300, -120], [-799, 449]]) {
      const art = imageToArt(transform, u, v);
      const back = artToImage(transform, art.x, art.y);
      expect(back.u).toBeCloseTo(u, 9);
      expect(back.v).toBeCloseTo(v, 9);
    }
    // Mirrored, the picture's right edge lands on the left (upright, centered).
    const mirrored = framingTransform(WIDE, { ...defaultFraming(), flip: true }, 'standard');
    expect(imageToArt(mirrored, WIDE.width / 2, 0).x).toBeLessThan(ART_FILE_W / 2);
    // Turned 90 degrees clockwise, the picture's top edge points right.
    const turned = framingTransform(WIDE, { ...defaultFraming(), rotation: 90 }, 'standard');
    expect(imageToArt(turned, 0, -WIDE.height / 2).x).toBeGreaterThan(ART_FILE_W / 2);
  });

  it('keeps every framing inside its ranges', () => {
    const wild = { zoom: Number.NaN, x: -4, y: 9, rotation: 720, flip: 'yes' as unknown as boolean, background: 'red' };
    expect(clampFraming(WIDE, wild)).toEqual({ zoom: 1, x: -1, y: 1, rotation: 180, flip: false, background: '#000000' });
  });
});
