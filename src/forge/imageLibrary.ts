/**
 * The page's view of the player's own images: what is stored (imageStore.ts),
 * which are decoded and ready to draw, and the clean-up that deletes images no
 * card refers to any more.
 *
 * Garbage collection: an image is kept while anything refers to it: a card in
 * the set, the card in the editor (even while it shows game art), the card it
 * was opened as, a card another tab saved (read from the autosave text), or an
 * image in the middle of being added. Everything else is deleted, so the
 * database never grows past what the set uses. The reference computation is
 * headless (customArt.referencedImageIds, unreferencedImages).
 *
 * Browser-side; no Phaser.
 */
import { bytesToDataUrl, unreferencedImages } from './customArt';
import { decodeStored, intakeDataUrl, intakeFile, type IntakeProblem } from './imageIntake';
import { ForgeImageStore, type StoredImage } from './imageStore';
import type { ImageSize } from './framing';

export type ImageStatus = 'ready' | 'loading' | 'missing';

export interface ImageInfo extends ImageSize {
  hasAlpha: boolean;
}

/** Decoded pictures kept at once; the editor shows one card, so a few are plenty. */
const DECODED_LIMIT = 6;

export type AddResult =
  | { ok: true; id: string; persistent: boolean }
  | { ok: false; problem: IntakeProblem };

export class ForgeImageLibrary {
  private readonly bitmaps = new Map<string, ImageBitmap>();
  private readonly info = new Map<string, ImageInfo>();
  private readonly loading = new Map<string, Promise<void>>();
  private readonly missing = new Set<string>();
  /**
   * Images held in this tab: its recent additions and loads. Kept so that if
   * another tab's clean-up deletes one this tab still uses, the next autosave
   * puts it back (`ensureStored`).
   */
  private readonly held = new Map<string, StoredImage>();
  private readonly protectedIds = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  private constructor(readonly store: ForgeImageStore) {}

  static async open(): Promise<ForgeImageLibrary> {
    return new ForgeImageLibrary(await ForgeImageStore.open());
  }

  /** True when images survive a reload. */
  get persistent(): boolean {
    return this.store.persistent;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }

  /** The decoded picture, if it is ready. Asks for it otherwise. */
  bitmap(id: string): ImageBitmap | null {
    const bitmap = this.bitmaps.get(id);
    if (bitmap) {
      // Most recently used last.
      this.bitmaps.delete(id);
      this.bitmaps.set(id, bitmap);
      return bitmap;
    }
    this.request(id);
    return null;
  }

  status(id: string): ImageStatus {
    if (this.bitmaps.has(id)) return 'ready';
    if (this.missing.has(id)) return 'missing';
    this.request(id);
    return this.bitmaps.has(id) ? 'ready' : 'loading';
  }

  /** The picture's size and transparency, once it has been read. */
  imageInfo(id: string): ImageInfo | null {
    return this.info.get(id) ?? null;
  }

  /** Read and decode a stored image; `missing` when it is not there or will not decode. */
  request(id: string): void {
    if (this.bitmaps.has(id) || this.loading.has(id) || this.missing.has(id)) return;
    const task = (async () => {
      const stored = this.held.get(id) ?? await this.store.get(id);
      const bitmap = stored ? await decodeStored(stored) : null;
      if (!stored || !bitmap) {
        this.missing.add(id);
        return;
      }
      this.remember(stored, bitmap);
    })().finally(() => {
      this.loading.delete(id);
      this.changed();
    });
    this.loading.set(id, task);
  }

  /** Wait for an image to be read (or found missing). */
  async whenSettled(id: string): Promise<ImageStatus> {
    this.request(id);
    await this.loading.get(id);
    return this.status(id);
  }

  private remember(image: StoredImage, bitmap: ImageBitmap): void {
    this.missing.delete(image.id);
    this.info.set(image.id, { width: image.width, height: image.height, hasAlpha: image.hasAlpha });
    this.held.set(image.id, image);
    const old = this.bitmaps.get(image.id);
    if (old && old !== bitmap) old.close();
    this.bitmaps.delete(image.id);
    this.bitmaps.set(image.id, bitmap);
    while (this.bitmaps.size > DECODED_LIMIT) {
      const [oldestId, oldest] = this.bitmaps.entries().next().value as [string, ImageBitmap];
      oldest.close();
      this.bitmaps.delete(oldestId);
    }
    while (this.held.size > DECODED_LIMIT) this.held.delete(this.held.keys().next().value as string);
  }

  /**
   * Keep an image from outside the page. It stays protected from clean-up
   * until `release` (once a card refers to it).
   */
  private async keep(image: StoredImage, bitmap: ImageBitmap): Promise<boolean> {
    this.protect(image.id);
    const persistent = await this.store.put(image);
    this.remember(image, bitmap);
    this.changed();
    return persistent;
  }

  /** A chosen or dropped file. */
  async addFile(file: Blob): Promise<AddResult> {
    const result = await intakeFile(file);
    if (!result.ok) return result;
    const persistent = await this.keep(result.image, result.bitmap);
    return { ok: true, id: result.image.id, persistent };
  }

  /** An image embedded in an imported set. Null when it could not be read. */
  async addDataUrl(dataUrl: string): Promise<{ id: string; persistent: boolean } | null> {
    const result = await intakeDataUrl(dataUrl);
    if (!result) return null;
    const persistent = await this.keep(result.image, result.bitmap);
    return { id: result.image.id, persistent };
  }

  protect(id: string): void {
    this.protectedIds.set(id, (this.protectedIds.get(id) ?? 0) + 1);
  }

  release(id: string): void {
    const count = (this.protectedIds.get(id) ?? 0) - 1;
    if (count > 0) this.protectedIds.set(id, count);
    else this.protectedIds.delete(id);
  }

  /** An image as a data URL, for Export JSON. Null when it is not stored. */
  async dataUrl(id: string): Promise<string | null> {
    const stored = this.held.get(id) ?? await this.store.get(id);
    return stored ? bytesToDataUrl(stored.type, new Uint8Array(stored.bytes)) : null;
  }

  /** The stored bytes of an image (the ?qa=1 probe compares them). */
  async bytes(id: string): Promise<Uint8Array | null> {
    const stored = this.held.get(id) ?? await this.store.get(id);
    return stored ? new Uint8Array(stored.bytes) : null;
  }

  /** Put back any image this tab still uses that the database lost (another tab's clean-up). */
  async ensureStored(ids: Iterable<string>): Promise<void> {
    if (!this.store.persistent) return;
    for (const id of ids) {
      const image = this.held.get(id);
      if (image && !(await this.store.has(id))) await this.store.put(image);
    }
  }

  /**
   * Delete every stored image outside `referenced` (and not in the middle of
   * being added). `referenced` is read after the stored ids are listed, so an
   * image a card started using meanwhile is kept. Returns what was deleted.
   */
  async collect(referenced: () => ReadonlySet<string>): Promise<string[]> {
    const stored = await this.store.ids();
    const keep = new Set([...referenced(), ...this.protectedIds.keys()]);
    const unused = unreferencedImages(stored, keep);
    await this.store.delete(unused);
    for (const id of unused) {
      this.bitmaps.get(id)?.close();
      this.bitmaps.delete(id);
      this.held.delete(id);
      this.info.delete(id);
    }
    return unused;
  }
}
