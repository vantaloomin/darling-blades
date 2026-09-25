/**
 * The `?qa=1` probe's own-image steps (docs/forge.md). Run by main.ts's probe
 * in the middle of its flow; throws on the first failure.
 *
 * It makes a test picture on a canvas (nothing is fetched), puts it on the
 * card through the real controls, frames it (sliders, Flip, the three framing
 * buttons, a drag on the card), and checks the card's texture is that exact
 * composition, in both frames, and that Save Image carries it. Then it saves
 * the card to the set, exports and re-imports the set (same framing, same
 * image bytes), checks a share link leaves the image out, the autosave holds
 * no image bytes, the image is in IndexedDB, and that removing the card
 * deletes it. Every image id it creates is reported, so the caller can delete
 * them whatever happens.
 *
 * Browser-side (the page's own probe); the scene is reached through the caller.
 */
import { base64ToBytes, parseImageDataUrl } from './customArt';
import type { CustomArtPanel } from './customArtPanel';
import {
  CARD_ART_RECTS,
  artToCard,
  artToImage,
  artWindow,
  defaultFraming,
  framingTransform,
  imageToArt,
  leavesFrameEmpty,
  panFraming,
  screenToArtDelta,
  zoomToSlider,
  type ArtFrame,
  type ImageSize,
} from './framing';
import type { ForgeImageLibrary } from './imageLibrary';
import type { ForgeSet, ImportResult } from './setModel';
import type { BuilderStore } from './store';
import type { ForgeEntry } from './validate';
import type { CardImage } from './scene';
import { CARD_H, CARD_W } from '../ui/CardView';

export interface CustomArtQaScene {
  renderedArtTexture: string | null;
  customArtCanvas(): HTMLCanvasElement | null;
  cardArtCrop(): { x: number; y: number; w: number; h: number; scale: number } | null;
  cardPlacement(): { x: number; y: number; scale: number } | null;
  input: { emit(event: string, ...args: unknown[]): boolean };
}

export interface CustomArtQaContext {
  store: BuilderStore;
  images: ForgeImageLibrary;
  panel: CustomArtPanel;
  customTexture: string;
  scene(): CustomArtQaScene | null;
  forgeSet(): ForgeSet;
  exportJson(): Promise<string>;
  importJson(text: string): Promise<ImportResult>;
  flushAutosave(): void;
  forgeKeyText(): string | null;
  shareEntry(): ForgeEntry;
  encodeShare(entry: ForgeEntry): Promise<string>;
  captureImage(): Promise<CardImage>;
  collectImages(): Promise<string[]>;
  /** Image ids the probe made; the caller deletes them when it is done. */
  created: Set<string>;
}

export interface CustomArtQaResult {
  imageId: string;
  storedBytes: number;
  storedType: string;
  imageSize: ImageSize;
  windowMatchesCardView: { standard: boolean; fullArt: boolean };
  dragMoved: { x: number; y: number };
  textureChecks: { standard: number; fullArt: number };
  savedImageChecks: { standard: number; fullArt: number };
  exportedChars: number;
  roundTrip: { framingSame: boolean; bytesSame: boolean; sameId: boolean };
  shareCarriesImage: boolean;
  forgeKeyChars: number;
  inIndexedDb: boolean;
  collectedAfterRemove: boolean;
}

type Rgb = readonly [number, number, number];
const QUADRANTS: Record<'tl' | 'tr' | 'bl' | 'br', Rgb> = {
  tl: [220, 40, 40],
  tr: [40, 200, 60],
  bl: [40, 80, 220],
  br: [230, 200, 40],
};
const BACKGROUND = '#20c0c0';
const BACKGROUND_RGB: Rgb = [0x20, 0xc0, 0xc0];
/** Lossy WebP and texture filtering move a flat color by a few steps; the colors above are far apart. */
const COLOR_TOLERANCE = 28;

function fail(message: string): never {
  throw new Error(`Own image: ${message}`);
}

function byId<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) fail(`control #${id} is missing`);
  return found as T;
}

/** A 800 x 500 picture in four flat colors, plus one pixel unique to this run. */
async function testImage(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 500;
  const context = canvas.getContext('2d');
  if (!context) fail('no 2D canvas');
  const paint = (color: Rgb, x: number, y: number): void => {
    context.fillStyle = `rgb(${color.join(',')})`;
    context.fillRect(x, y, 400, 250);
  };
  paint(QUADRANTS.tl, 0, 0);
  paint(QUADRANTS.tr, 400, 0);
  paint(QUADRANTS.bl, 0, 250);
  paint(QUADRANTS.br, 400, 250);
  // A run-unique pixel, so the probe's image can never share an id with one of the designer's.
  context.fillStyle = `rgb(${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)})`;
  context.fillRect(0, 0, 1, 1);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) fail('the test picture did not encode');
  return new File([blob], 'forge-qa-picture.png', { type: 'image/png' });
}

const near = (actual: ArrayLike<number>, expected: Rgb): boolean => (
  expected.every((value, index) => Math.abs(actual[index] - value) <= COLOR_TOLERANCE)
);

/**
 * Points in the frame's window where the picture's color is certain: well
 * inside one quadrant, or well outside the picture (the background). Each
 * comes with its art-file position and expected color. `keep` limits them to
 * part of the card (Full Art has text plates over the lower art).
 */
function samplePoints(
  image: ImageSize,
  store: BuilderStore,
  frame: ArtFrame,
  keep: (cardY: number) => boolean,
): { x: number; y: number; color: Rgb }[] {
  const custom = store.getState().customArt;
  if (!custom) fail('the card lost its image');
  const transform = framingTransform(image, custom, frame);
  const window = artWindow(frame);
  const margin = 18 / transform.scale;
  const points: { x: number; y: number; color: Rgb }[] = [];
  for (let row = 1; row < 12; row += 1) {
    for (let column = 1; column < 12; column += 1) {
      const x = window.x + (window.w * column) / 12;
      const y = window.y + (window.h * row) / 12;
      if (!keep(artToCard(frame, x, y).y)) continue;
      const { u, v } = artToImage(transform, x, y);
      const outside = Math.abs(u) > image.width / 2 + margin || Math.abs(v) > image.height / 2 + margin;
      const inside = Math.abs(u) < image.width / 2 - margin && Math.abs(v) < image.height / 2 - margin
        && Math.abs(u) > margin && Math.abs(v) > margin;
      if (outside) points.push({ x, y, color: BACKGROUND_RGB });
      else if (inside) points.push({ x, y, color: QUADRANTS[`${v < 0 ? 't' : 'b'}${u < 0 ? 'l' : 'r'}` as keyof typeof QUADRANTS] });
    }
  }
  return points;
}

function checkSamples(
  points: { x: number; y: number; color: Rgb }[],
  read: (x: number, y: number) => ArrayLike<number>,
  what: string,
  minColors: number,
): number {
  const colors = new Set(points.map((point) => point.color));
  if (points.length < 6 || colors.size < minColors) fail(`${what}: too few points to check (${points.length}, ${colors.size} colors)`);
  for (const point of points) {
    const pixel = read(point.x, point.y);
    if (!near(pixel, point.color)) {
      fail(`${what}: at (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) expected ${point.color.join(',')}, found ${Array.from(pixel).slice(0, 3).join(',')}`);
    }
  }
  return points.length;
}

/** The composed texture holds exactly the framed picture. */
function checkTexture(ctx: CustomArtQaContext, image: ImageSize, frame: ArtFrame): number {
  const scene = ctx.scene();
  if (!scene || scene.renderedArtTexture !== ctx.customTexture) fail(`the card is not drawn with the composed texture (${scene?.renderedArtTexture})`);
  const canvas = scene.customArtCanvas();
  const context = canvas?.getContext('2d');
  if (!canvas || !context) fail('the composed texture has no canvas');
  return checkSamples(
    samplePoints(image, ctx.store, frame, () => true),
    (x, y) => context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data,
    `texture (${frame})`,
    4,
  );
}

/** CardView crops the composed art to exactly the window framing.ts assumes. */
function checkWindow(ctx: CustomArtQaContext, frame: ArtFrame): boolean {
  const crop = ctx.scene()?.cardArtCrop();
  const window = artWindow(frame);
  if (!crop) return false;
  const close = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;
  return close(crop.x, window.x) && close(crop.y, window.y) && close(crop.w, window.w) && close(crop.h, window.h)
    && Math.abs(crop.scale - window.cardPxPerArtPx) < 1e-6;
}

/** Save Image's PNG shows the framed picture where the card's art window is. */
async function checkSavedImage(ctx: CustomArtQaContext, image: ImageSize, frame: ArtFrame): Promise<number> {
  const png = await ctx.captureImage();
  const bitmap = await createImageBitmap(png.blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) fail('no 2D canvas');
  context.drawImage(bitmap, 0, 0);
  const scale = png.width / CARD_W;
  const overhang = png.height - CARD_H * scale;
  bitmap.close();
  // Full Art lays the name, type and text plates over the art: sample between the name and the type line.
  const keep = frame === 'fullArt' ? (cardY: number) => cardY > -160 && cardY < 0 : () => true;
  return checkSamples(
    samplePoints(image, ctx.store, frame, keep),
    (x, y) => {
      const card = artToCard(frame, x, y);
      return context.getImageData(Math.floor((card.x + CARD_W / 2) * scale), Math.floor((card.y + CARD_H / 2) * scale + overhang), 1, 1).data;
    },
    `Save Image (${frame})`,
    // The band Full Art leaves clear of its plates shows the picture's upper half only.
    frame === 'fullArt' ? 2 : 4,
  );
}

function setSlider(input: HTMLInputElement, value: number): void {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function inflateShare(payload: string): Promise<string> {
  const base64 = payload.slice(2).replace(/-/g, '+').replace(/_/g, '/');
  const bytes = base64ToBytes(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  if (!bytes) fail('the share payload is not base64');
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

const sameBytes = (left: Uint8Array | null, right: Uint8Array | null): boolean => (
  left !== null && right !== null && left.length === right.length && left.every((byte, index) => byte === right[index])
);

export async function runCustomArtQa(ctx: CustomArtQaContext): Promise<CustomArtQaResult> {
  const { store, images } = ctx;
  if (!images.persistent) fail('IndexedDB is not available in this browser');

  // Choose the picture through the panel, as Choose Image does.
  byId<HTMLInputElement>('full-art').checked = false;
  byId<HTMLInputElement>('full-art').dispatchEvent(new Event('change', { bubbles: true }));
  const customRadio = document.querySelector<HTMLInputElement>('input[name="art-source"][value="custom"]');
  if (!customRadio) fail('the Your Image switch is missing');
  customRadio.click();
  if (byId('custom-art-panel').hidden || byId('custom-art-drop').hidden) fail('Your Image did not open on its empty state');
  if (!(await ctx.panel.applyFile(await testImage()))) fail('the test picture was refused');
  const imageId = store.getState().customArt?.image;
  if (!imageId) fail('the card has no image after choosing one');
  ctx.created.add(imageId);
  const info = images.imageInfo(imageId);
  const stored = await images.store.get(imageId);
  if (!info || !stored) fail('the image was not kept');
  if (Math.max(info.width, info.height) > 1600) fail('the image was not downscaled');
  if (byId('custom-art-controls').hidden) fail('the framing controls did not appear');

  // The three framing buttons each land on their defined state.
  const frame: ArtFrame = 'standard';
  byId<HTMLButtonElement>('custom-art-fill').click();
  if (leavesFrameEmpty(info, store.getState().customArt!, frame) || !byId('custom-art-background-field').hidden) {
    fail('Fill the Frame left part of the frame empty, or still showed Background');
  }
  byId<HTMLButtonElement>('custom-art-fit').click();
  const fitted = store.getState().customArt!;
  const fitTransform = framingTransform(info, fitted, frame);
  const window = artWindow(frame);
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([su, sv]) => imageToArt(fitTransform, (su * info.width) / 2, (sv * info.height) / 2));
  if (corners.some((point) => point.x < window.x - 1e-6 || point.x > window.x + window.w + 1e-6 || point.y < window.y - 1e-6 || point.y > window.y + window.h + 1e-6)) {
    fail('Fit Whole Image did not keep the whole picture inside the frame');
  }
  byId<HTMLButtonElement>('custom-art-reset').click();
  const reset = store.getState().customArt!;
  if (JSON.stringify({ ...reset, image: '' }) !== JSON.stringify({ ...defaultFraming(), image: '' })) fail('Reset did not return to the starting framing');

  // A non-trivial framing through the sliders: zoomed out (the background shows), turned, mirrored, moved.
  setSlider(byId<HTMLInputElement>('custom-art-zoom'), zoomToSlider(info, 0.5));
  setSlider(byId<HTMLInputElement>('custom-art-rotation'), 30);
  byId<HTMLButtonElement>('custom-art-flip').click();
  setSlider(byId<HTMLInputElement>('custom-art-x'), -40);
  setSlider(byId<HTMLInputElement>('custom-art-y'), 25);
  if (byId('custom-art-background-field').hidden) fail('Background was hidden while the picture left the frame empty');
  const backgroundInput = byId<HTMLInputElement>('custom-art-background');
  backgroundInput.value = BACKGROUND;
  backgroundInput.dispatchEvent(new Event('input', { bubbles: true }));
  const framed = store.getState().customArt!;
  if (!framed.flip || framed.rotation !== 30 || framed.x !== -0.4 || framed.y !== 0.25 || framed.background !== BACKGROUND) {
    fail(`the controls did not set the framing (${JSON.stringify(framed)})`);
  }

  // A drag on the card's art window moves the picture by the drag's length in art pixels.
  const scene = ctx.scene();
  const placement = scene?.cardPlacement();
  if (!scene || !placement) fail('no card scene');
  const rect = CARD_ART_RECTS[frame];
  const start = { worldX: placement.x + (rect.x + rect.w / 2) * placement.scale, worldY: placement.y + (rect.y + rect.h / 2) * placement.scale };
  const drag = { dx: 24, dy: -18 };
  const pointer = (worldX: number, worldY: number) => ({ id: 91, worldX, worldY, isDown: true });
  scene.input.emit('pointerdown', pointer(start.worldX, start.worldY));
  scene.input.emit('pointermove', pointer(start.worldX + drag.dx, start.worldY + drag.dy));
  scene.input.emit('pointerup', pointer(start.worldX + drag.dx, start.worldY + drag.dy));
  const delta = screenToArtDelta(drag.dx, drag.dy, placement.scale, frame);
  const expected = panFraming(info, framed, frame, delta.dx, delta.dy);
  const dragged = store.getState().customArt!;
  if (Math.abs(dragged.x - expected.x) > 1e-9 || Math.abs(dragged.y - expected.y) > 1e-9 || dragged.x === framed.x || dragged.y === framed.y) {
    fail(`the drag moved the picture to (${dragged.x}, ${dragged.y}), expected (${expected.x}, ${expected.y})`);
  }

  // The card's texture is the composition, and Save Image carries it; then the same in Full Art.
  const windowStandard = checkWindow(ctx, 'standard');
  if (!windowStandard) fail('CardView crops the standard art window differently from framing.ts');
  const textureStandard = checkTexture(ctx, info, 'standard');
  const savedStandard = await checkSavedImage(ctx, info, 'standard');
  byId<HTMLInputElement>('full-art').checked = true;
  byId<HTMLInputElement>('full-art').dispatchEvent(new Event('change', { bubbles: true }));
  const windowFullArt = checkWindow(ctx, 'fullArt');
  if (!windowFullArt) fail('CardView crops the Full Art window differently from framing.ts');
  const textureFullArt = checkTexture(ctx, info, 'fullArt');
  const savedFullArt = await checkSavedImage(ctx, info, 'fullArt');

  // Save to Set: the set row says Own art; the entry refers to the image by id.
  byId<HTMLButtonElement>('save-to-set').click();
  const savedEntry = ctx.forgeSet().cards.find((entry) => entry.art.custom?.image === imageId);
  if (!savedEntry) fail('Save to Set did not keep the image on the card');
  const row = document.querySelector(`[data-open-card="${CSS.escape(savedEntry.card.id)}"]`);
  if (!row?.querySelector('.own-art-tag')) fail('the set row has no Own art tag');
  if (byId('export-images-note').hidden) fail('the export note did not show');

  // Export, then import: the same framing and the same image bytes.
  const exported = await ctx.exportJson();
  const exportedCard = (JSON.parse(exported) as { cards: ForgeEntry[] }).cards.find((entry) => entry.card.id === savedEntry.card.id);
  const embedded = parseImageDataUrl(exportedCard?.art.custom?.image);
  const embeddedBytes = embedded ? base64ToBytes(embedded.base64) : null;
  const storedBytes = await images.bytes(imageId);
  if (!sameBytes(embeddedBytes, storedBytes)) fail('the export did not embed the stored image bytes');
  const imported = await ctx.importJson(exported);
  if (!imported.ok) fail('the export did not import');
  const importedEntry = ctx.forgeSet().cards.find((entry) => entry.card.id === savedEntry.card.id);
  const framing = (art: ForgeEntry['art']['custom']) => art && JSON.stringify([art.zoom, art.x, art.y, art.rotation, art.flip, art.background]);
  const roundTrip = {
    framingSame: framing(importedEntry?.art.custom) === framing(savedEntry.art.custom),
    sameId: importedEntry?.art.custom?.image === imageId,
    bytesSame: sameBytes(await images.bytes(importedEntry?.art.custom?.image ?? ''), storedBytes),
  };
  if (!roundTrip.framingSame || !roundTrip.bytesSame || !roundTrip.sameId) fail(`export then import changed the image (${JSON.stringify(roundTrip)})`);

  // A share link leaves the image out: the recipient gets the donor's art.
  const shareJson = await inflateShare(await ctx.encodeShare(ctx.shareEntry()));
  const shareCarriesImage = shareJson.includes('"custom"') || shareJson.includes('data:image') || shareJson.includes(imageId);
  if (shareCarriesImage) fail('the share payload carries the image');

  // The autosave refers to the image by id and holds no image bytes; the bytes are in IndexedDB.
  ctx.flushAutosave();
  const forgeKey = ctx.forgeKeyText() ?? '';
  if (forgeKey.includes('data:image') || !forgeKey.includes(imageId)) fail('the autosave does not hold the image by id alone');
  if (forgeKey.length > 64 * 1024) fail(`the autosave grew to ${forgeKey.length} characters`);
  const inIndexedDb = await images.store.has(imageId);
  if (!inIndexedDb) fail('the image is not in IndexedDB');

  // Remove the card (and start a fresh one, so the editor lets go too): the image is deleted.
  const removeButton = document.querySelector<HTMLButtonElement>(`[data-remove-card="${CSS.escape(savedEntry.card.id)}"]`);
  if (!removeButton) fail('the set row has no remove button');
  removeButton.click();
  byId<HTMLButtonElement>('new-card').click();
  ctx.flushAutosave();
  const collected = await ctx.collectImages();
  const collectedAfterRemove = collected.includes(imageId) && !(await images.store.has(imageId));
  if (!collectedAfterRemove) fail('removing the card did not delete its image');

  return {
    imageId,
    storedBytes: stored.bytes.byteLength,
    storedType: stored.type,
    imageSize: { width: info.width, height: info.height },
    windowMatchesCardView: { standard: windowStandard, fullArt: windowFullArt },
    dragMoved: { x: dragged.x - framed.x, y: dragged.y - framed.y },
    textureChecks: { standard: textureStandard, fullArt: textureFullArt },
    savedImageChecks: { standard: savedStandard, fullArt: savedFullArt },
    exportedChars: exported.length,
    roundTrip,
    shareCarriesImage,
    forgeKeyChars: forgeKey.length,
    inIndexedDb,
    collectedAfterRemove,
  };
}
