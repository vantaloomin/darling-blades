/**
 * How a player's own image sits in a card's art window: zoom, pan, rotation,
 * flip, and the background shown where the picture leaves the frame empty.
 *
 * Everything is measured in art-file space: the 640 x 800 canvas a real card
 * art file fills, which CardView cover-crops into the card's art window (a
 * centered band for the standard frame, a taller one for Full Art). The page
 * composes the image into exactly that canvas, so what the card shows is what
 * this module computes, in both frames.
 *
 * The model:
 * - `zoom` 1 means the image exactly covers the 640 x 800 art file (and so
 *   both windows). The smallest zoom lets the whole picture fit inside either
 *   window at any angle; the largest is 5 times cover.
 * - `x` and `y` run from -1 to 1: the fraction of the room the picture has to
 *   move in that direction in the current window. Positive moves it right
 *   (or down). The room on an axis is half the difference between the
 *   picture's rotated extent and the window's, so at 1 a picture larger than
 *   the window has its edge on the window's edge, and a smaller one sits
 *   against the window's far side.
 * - `rotation` is in degrees, -180 to 180, clockwise; `flip` mirrors the
 *   picture left to right (before it is rotated).
 * - `background` is the `#rrggbb` color behind the picture.
 *
 * Headless: no Phaser, no DOM.
 */

/** The art file every card window is cropped from (src/art/ArtResolver.ts). */
export const ART_FILE_W = 640;
export const ART_FILE_H = 800;

export type ArtFrame = 'standard' | 'fullArt';
export const ART_FRAMES: readonly ArtFrame[] = ['standard', 'fullArt'];

/**
 * CardView's art windows in card-local coordinates (center origin): its
 * ART_RECT and FULL_ART_RECT (src/ui/CardView.ts, not exported there). The
 * ?qa=1 probe checks these against the crop CardView actually applies.
 */
export const CARD_ART_RECTS: Record<ArtFrame, { x: number; y: number; w: number; h: number }> = {
  standard: { x: -132, y: -164, w: 264, h: 192 },
  fullArt: { x: -141, y: -201, w: 282, h: 402 },
};

export const MAX_ZOOM = 5;
export const MIN_ROTATION = -180;
export const MAX_ROTATION = 180;
export const DEFAULT_BACKGROUND = '#000000';
export const BACKGROUND_PATTERN = /^#[0-9a-f]{6}$/;

export interface ImageSize {
  width: number;
  height: number;
}

export interface ArtFraming {
  zoom: number;
  x: number;
  y: number;
  rotation: number;
  flip: boolean;
  background: string;
}

/** A fresh image's framing, and what Reset returns to. */
export function defaultFraming(): ArtFraming {
  return { zoom: 1, x: 0, y: 0, rotation: 0, flip: false, background: DEFAULT_BACKGROUND };
}

export interface ArtWindow {
  /** The visible part of the art file, in art-file pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Card pixels per art-file pixel (CardView's cover-crop scale). */
  cardPxPerArtPx: number;
}

/** The part of the art file a frame shows, as CardView crops it. */
export function artWindow(frame: ArtFrame): ArtWindow {
  const rect = CARD_ART_RECTS[frame];
  const scale = Math.max(rect.w / ART_FILE_W, rect.h / ART_FILE_H);
  const w = rect.w / scale;
  const h = rect.h / scale;
  return { x: (ART_FILE_W - w) / 2, y: (ART_FILE_H - h) / 2, w, h, cardPxPerArtPx: scale };
}

/** Where an art-file point shows on the card, in card-local pixels (center origin). */
export function artToCard(frame: ArtFrame, x: number, y: number): { x: number; y: number } {
  const window = artWindow(frame);
  const rect = CARD_ART_RECTS[frame];
  return { x: rect.x + (x - window.x) * window.cardPxPerArtPx, y: rect.y + (y - window.y) * window.cardPxPerArtPx };
}

/** Art pixels per image pixel at zoom 1: the image exactly covers the art file. */
export function coverScale(image: ImageSize): number {
  return Math.max(ART_FILE_W / image.width, ART_FILE_H / image.height);
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

/** The picture's rotated extent in art pixels. */
export function rotatedExtent(image: ImageSize, zoom: number, rotation: number): { w: number; h: number } {
  const scale = coverScale(image) * zoom;
  const cos = Math.abs(Math.cos(radians(rotation)));
  const sin = Math.abs(Math.sin(radians(rotation)));
  return {
    w: scale * (image.width * cos + image.height * sin),
    h: scale * (image.width * sin + image.height * cos),
  };
}

/**
 * The smallest zoom: the whole picture fits inside either frame's window at
 * any angle. A rotated picture's extent never exceeds its diagonal, so it is
 * the diagonal that has to fit the shortest side of the two windows.
 */
export function minZoom(image: ImageSize): number {
  const shortest = Math.min(...ART_FRAMES.flatMap((frame) => [artWindow(frame).w, artWindow(frame).h]));
  return shortest / Math.hypot(image.width, image.height) / coverScale(image);
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const finiteOr = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback);

/** A framing inside every range: zoom, pan, rotation, and a valid background. */
export function clampFraming(image: ImageSize, framing: ArtFraming): ArtFraming {
  return {
    zoom: clamp(finiteOr(framing.zoom, 1), minZoom(image), MAX_ZOOM),
    x: clamp(finiteOr(framing.x, 0), -1, 1),
    y: clamp(finiteOr(framing.y, 0), -1, 1),
    rotation: clamp(finiteOr(framing.rotation, 0), MIN_ROTATION, MAX_ROTATION),
    flip: framing.flip === true,
    background: BACKGROUND_PATTERN.test(framing.background) ? framing.background : DEFAULT_BACKGROUND,
  };
}

/** How far, in art pixels, the picture can move each way from the window's center. */
export function panRoom(image: ImageSize, framing: ArtFraming, frame: ArtFrame): { x: number; y: number } {
  const extent = rotatedExtent(image, framing.zoom, framing.rotation);
  const window = artWindow(frame);
  return { x: Math.abs(extent.w - window.w) / 2, y: Math.abs(extent.h - window.h) / 2 };
}

export interface FramingTransform {
  /** Where the picture's center lands in the art file. */
  centerX: number;
  centerY: number;
  /** Art pixels per image pixel. */
  scale: number;
  /** Clockwise, in radians. */
  rotation: number;
  flip: boolean;
}

/** The transform that draws the picture into the art file for one frame. */
export function framingTransform(image: ImageSize, framing: ArtFraming, frame: ArtFrame): FramingTransform {
  const room = panRoom(image, framing, frame);
  return {
    centerX: ART_FILE_W / 2 + framing.x * room.x,
    centerY: ART_FILE_H / 2 + framing.y * room.y,
    scale: coverScale(image) * framing.zoom,
    rotation: radians(framing.rotation),
    flip: framing.flip,
  };
}

/**
 * Where a point of the picture lands in the art file. `u` and `v` are image
 * pixels measured from the picture's center (right and down positive). The
 * picture is mirrored first (flip), then scaled, rotated and placed.
 */
export function imageToArt(transform: FramingTransform, u: number, v: number): { x: number; y: number } {
  const mirroredU = transform.flip ? -u : u;
  const sx = mirroredU * transform.scale;
  const sy = v * transform.scale;
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);
  return { x: transform.centerX + sx * cos - sy * sin, y: transform.centerY + sx * sin + sy * cos };
}

/** The inverse of `imageToArt`: which picture point shows at an art-file point. */
export function artToImage(transform: FramingTransform, x: number, y: number): { u: number; v: number } {
  const dx = x - transform.centerX;
  const dy = y - transform.centerY;
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);
  const sx = dx * cos + dy * sin;
  const sy = -dx * sin + dy * cos;
  const u = sx / transform.scale;
  return { u: transform.flip ? -u : u, v: sy / transform.scale };
}

/**
 * True while the picture leaves part of the frame's window empty (the
 * background shows). Checked at the window's corners: the picture is a convex
 * rectangle, so it covers the window exactly when it covers all four.
 */
export function leavesFrameEmpty(image: ImageSize, framing: ArtFraming, frame: ArtFrame): boolean {
  const transform = framingTransform(image, framing, frame);
  const window = artWindow(frame);
  // A hair of tolerance, so a picture set to exactly fill the frame counts as filling it.
  const halfW = image.width / 2 + 1e-6 * image.width;
  const halfH = image.height / 2 + 1e-6 * image.height;
  const corners = [
    [window.x, window.y], [window.x + window.w, window.y],
    [window.x, window.y + window.h], [window.x + window.w, window.y + window.h],
  ];
  return corners.some(([x, y]) => {
    const point = artToImage(transform, x, y);
    return Math.abs(point.u) > halfW || Math.abs(point.v) > halfH;
  });
}

/** Fit Whole Image: the largest zoom that shows the whole picture in this frame, centered. */
export function fitWholeImage(image: ImageSize, framing: ArtFraming, frame: ArtFrame): ArtFraming {
  const extent = rotatedExtent(image, 1, framing.rotation);
  const window = artWindow(frame);
  const zoom = Math.min(window.w / extent.w, window.h / extent.h);
  return clampFraming(image, { ...framing, zoom, x: 0, y: 0 });
}

/** Fill the Frame: the smallest zoom that leaves nothing of this frame's window empty, centered. */
export function fillFrame(image: ImageSize, framing: ArtFraming, frame: ArtFrame): ArtFraming {
  const window = artWindow(frame);
  const cos = Math.abs(Math.cos(radians(framing.rotation)));
  const sin = Math.abs(Math.sin(radians(framing.rotation)));
  // The window, turned into the picture's own axes, has to fit inside the picture.
  const scale = Math.max(
    (window.w * cos + window.h * sin) / image.width,
    (window.w * sin + window.h * cos) / image.height,
  );
  return clampFraming(image, { ...framing, zoom: scale / coverScale(image), x: 0, y: 0 });
}

/** Reset: the framing a newly chosen image starts with. */
export function resetFraming(image: ImageSize): ArtFraming {
  return clampFraming(image, defaultFraming());
}

/**
 * A drag on the card, in the canvas's own pixels, as art-file pixels: the
 * card is drawn at `cardScale` canvas pixels per card pixel, and the frame's
 * window at `cardPxPerArtPx` card pixels per art pixel.
 */
export function screenToArtDelta(dx: number, dy: number, cardScale: number, frame: ArtFrame): { dx: number; dy: number } {
  const perArtPx = cardScale * artWindow(frame).cardPxPerArtPx;
  return { dx: dx / perArtPx, dy: dy / perArtPx };
}

/**
 * Move the picture by an art-file distance. The move is measured against the
 * framing the drag began with, so it can run into the edge of the range and
 * come back without drifting. An axis with no room to move stays put.
 */
export function panFraming(image: ImageSize, start: ArtFraming, frame: ArtFrame, dx: number, dy: number): ArtFraming {
  const room = panRoom(image, start, frame);
  const EPSILON = 1e-9;
  return clampFraming(image, {
    ...start,
    x: room.x > EPSILON ? start.x + dx / room.x : start.x,
    y: room.y > EPSILON ? start.y + dy / room.y : start.y,
  });
}

/** The Zoom slider runs on a log scale from the smallest zoom to the largest, in this many steps. */
export const ZOOM_SLIDER_STEPS = 1000;

export function zoomToSlider(image: ImageSize, zoom: number): number {
  const min = minZoom(image);
  const clamped = clamp(zoom, min, MAX_ZOOM);
  return Math.round((ZOOM_SLIDER_STEPS * Math.log(clamped / min)) / Math.log(MAX_ZOOM / min));
}

export function sliderToZoom(image: ImageSize, position: number): number {
  const min = minZoom(image);
  const t = clamp(position, 0, ZOOM_SLIDER_STEPS) / ZOOM_SLIDER_STEPS;
  return clamp(min * (MAX_ZOOM / min) ** t, min, MAX_ZOOM);
}
