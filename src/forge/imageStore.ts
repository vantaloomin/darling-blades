/**
 * Where the player's own images are kept: the Forge's IndexedDB database
 * (`darlingblades-forge`, store `images`), keyed by each image's id (the
 * SHA-256 of its bytes), so an image used on several cards is stored once.
 *
 * Never localStorage: the game save lives there, in a quota of a few
 * megabytes, and one image could fill it and make the game's saves fail. The
 * autosave in localStorage holds only the ids (storage.ts).
 *
 * If the browser refuses IndexedDB (blocked, private, or out of room), images
 * are kept in memory for as long as the tab stays open, and the page says so.
 *
 * A record read back is hostile until checked: its fields must have the right
 * types, its bytes must hash to its id and carry an accepted image header.
 * The page decodes it before drawing it.
 *
 * Browser-side (IndexedDB); no Phaser.
 */
import { IMAGE_ID_PATTERN, MAX_IMAGE_BYTES, imageIdFor, readImageHeader, type AcceptedImageType } from './customArt';

export const IMAGE_DB_NAME = 'darlingblades-forge';
export const IMAGE_STORE = 'images';
const IMAGE_DB_VERSION = 1;

export interface StoredImage {
  id: string;
  type: AcceptedImageType;
  bytes: ArrayBuffer;
  /** The decoded picture's size in pixels. */
  width: number;
  height: number;
  /** True when some pixels are see-through (the background shows behind them). */
  hasAlpha: boolean;
}

function promised<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function openDatabase(): Promise<IDBDatabase | null> {
  try {
    const factory = window.indexedDB;
    if (!factory) return null;
    const request = factory.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_STORE)) {
        request.result.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
      }
    };
    // A blocked open (another tab holding an older version) must not hang the page.
    return await Promise.race([
      promised(request),
      new Promise<null>((resolve) => { window.setTimeout(() => resolve(null), 4000); }),
    ]);
  } catch {
    return null;
  }
}

/** A record from the database, rebuilt from checked fields, or null. */
async function checkedRecord(value: unknown): Promise<StoredImage | null> {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<Record<keyof StoredImage, unknown>>;
  if (typeof raw.id !== 'string' || !IMAGE_ID_PATTERN.test(raw.id)) return null;
  if (!(raw.bytes instanceof ArrayBuffer) || raw.bytes.byteLength === 0 || raw.bytes.byteLength > MAX_IMAGE_BYTES) return null;
  if (typeof raw.width !== 'number' || typeof raw.height !== 'number' || typeof raw.hasAlpha !== 'boolean') return null;
  const bytes = new Uint8Array(raw.bytes);
  const header = readImageHeader(bytes);
  if (!header || header.type !== raw.type) return null;
  if (await imageIdFor(bytes) !== raw.id) return null;
  return { id: raw.id, type: header.type, bytes: raw.bytes, width: raw.width, height: raw.height, hasAlpha: raw.hasAlpha };
}

export class ForgeImageStore {
  /** Images kept for this tab when the database is not there (or refused one). */
  private readonly memory = new Map<string, StoredImage>();

  private constructor(private readonly db: IDBDatabase | null) {}

  static async open(): Promise<ForgeImageStore> {
    return new ForgeImageStore(await openDatabase());
  }

  /** True when images survive a reload (the database is open). */
  get persistent(): boolean {
    return this.db !== null;
  }

  /** Keep an image. False when it could only be kept in memory for this tab. */
  async put(image: StoredImage): Promise<boolean> {
    if (this.db) {
      try {
        const transaction = this.db.transaction(IMAGE_STORE, 'readwrite');
        transaction.objectStore(IMAGE_STORE).put(image);
        await completed(transaction);
        this.memory.delete(image.id);
        return true;
      } catch {
        // Out of room, most likely: fall through and keep it for the session.
      }
    }
    this.memory.set(image.id, image);
    return false;
  }

  async get(id: string): Promise<StoredImage | null> {
    const kept = this.memory.get(id);
    if (kept) return kept;
    if (!this.db || !IMAGE_ID_PATTERN.test(id)) return null;
    try {
      const value = await promised(this.db.transaction(IMAGE_STORE, 'readonly').objectStore(IMAGE_STORE).get(id));
      return await checkedRecord(value);
    } catch {
      return null;
    }
  }

  async has(id: string): Promise<boolean> {
    if (this.memory.has(id)) return true;
    if (!this.db) return false;
    try {
      return (await promised(this.db.transaction(IMAGE_STORE, 'readonly').objectStore(IMAGE_STORE).count(id))) > 0;
    } catch {
      return false;
    }
  }

  /** Every image id kept, in the database and in memory. */
  async ids(): Promise<string[]> {
    const ids = new Set(this.memory.keys());
    if (this.db) {
      try {
        const keys = await promised(this.db.transaction(IMAGE_STORE, 'readonly').objectStore(IMAGE_STORE).getAllKeys());
        for (const key of keys) if (typeof key === 'string') ids.add(key);
      } catch {
        // Nothing to add.
      }
    }
    return [...ids];
  }

  async delete(ids: readonly string[]): Promise<void> {
    for (const id of ids) this.memory.delete(id);
    if (!this.db || ids.length === 0) return;
    try {
      const transaction = this.db.transaction(IMAGE_STORE, 'readwrite');
      const store = transaction.objectStore(IMAGE_STORE);
      for (const id of ids) store.delete(id);
      await completed(transaction);
    } catch {
      // Left for the next collection.
    }
  }
}
