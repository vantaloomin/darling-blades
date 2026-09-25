/**
 * The Forge's autosave: the set, and the card in the editor, kept in browser
 * storage so a reload picks up where the designer left off.
 *
 * The Forge is served from the game's own origin, so the game save
 * (`darlingblades.save.v1`, and the legacy `waifutcg.save.v1`) sits in the
 * same storage. This module reads and writes exactly one key,
 * `darlingblades.forge.v1`, and never clears, removes or enumerates anything.
 * It never sees `localStorage` itself: the page hands it a Storage (or null
 * when the browser refuses one), so tests can hand it a fake that records
 * every call. What it stores is small text (no images), because the game
 * save shares this origin's quota of a few megabytes. A card with its own
 * image stores the image's id only (`art.custom.image`); the bytes are in the
 * Forge's IndexedDB database. The write below drops any custom image that is
 * not an id, so image bytes can never reach this key.
 *
 * Everything read back goes through the same validator as an imported file.
 * Headless: no Phaser, no DOM.
 */
import { isImageId } from './customArt';
import { MAX_SET_CARDS, emptySet, type ForgeSet } from './setModel';
import { CARD_ID_PATTERN, FORGE_LIMITS, validateEntry, type ForgeEntry } from './validate';

export const FORGE_STORAGE_KEY = 'darlingblades.forge.v1';
const AUTOSAVE_FORMAT = 'darling-blades-forge-autosave';
const AUTOSAVE_VERSION = 1;
/**
 * The autosave never grows past this: past it, writing stops and the page says
 * so. It shares the origin's localStorage quota (about 5M UTF-16 units in the
 * major browsers) with the game save, and a game save that fails to write is
 * far worse than a Forge autosave that pauses, so the Forge keeps to a fifth.
 */
export const MAX_AUTOSAVE_CHARS = 1024 * 1024;

/** The two Storage methods the autosave uses, and nothing else. */
export interface ForgeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface EditorSnapshot {
  entry: ForgeEntry;
  /** The set card being edited, or null for a new card. */
  editingId: string | null;
  /** What a new card is compared with to tell whether it has unsaved changes. */
  baseline: ForgeEntry | null;
  /** The game card this one was started from, if any (Start From a Card). */
  loadedFrom: string | null;
  loadedBaseline: ForgeEntry | null;
}

export interface ForgeAutosave {
  set: ForgeSet;
  editor: EditorSnapshot | null;
}

/** An entry as the autosave may hold it: a custom image by id only. */
function storableEntry(entry: ForgeEntry): ForgeEntry {
  const custom = entry.art.custom;
  if (!custom || isImageId(custom.image)) return entry;
  return { ...entry, art: { donor: entry.art.donor } };
}

function storableEditor(editor: EditorSnapshot | null): EditorSnapshot | null {
  if (!editor) return null;
  return {
    ...editor,
    entry: storableEntry(editor.entry),
    baseline: editor.baseline && storableEntry(editor.baseline),
    loadedBaseline: editor.loadedBaseline && storableEntry(editor.loadedBaseline),
  };
}

export function serializeAutosave(save: ForgeAutosave): string {
  return JSON.stringify({
    format: AUTOSAVE_FORMAT,
    version: AUTOSAVE_VERSION,
    set: { ...save.set, cards: save.set.cards.map(storableEntry) },
    editor: storableEditor(save.editor),
  });
}

function readEntry(value: unknown): ForgeEntry | null {
  const checked = validateEntry(value, 'id');
  return checked.ok ? checked.entry : null;
}

/** Parse an autosave. Anything unreadable is dropped, never trusted. */
export function parseAutosave(text: string): ForgeAutosave | null {
  if (text.length > MAX_AUTOSAVE_CHARS) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const doc = raw as { format?: unknown; version?: unknown; set?: unknown; editor?: unknown };
  if (doc.format !== AUTOSAVE_FORMAT || doc.version !== AUTOSAVE_VERSION) return null;

  const set = emptySet();
  const rawSet = doc.set as { name?: unknown; cards?: unknown } | undefined;
  if (typeof rawSet?.name === 'string' && rawSet.name.length <= FORGE_LIMITS.setNameLength) set.name = rawSet.name;
  if (Array.isArray(rawSet?.cards)) {
    for (const value of rawSet.cards.slice(0, MAX_SET_CARDS)) {
      const entry = readEntry(value);
      if (entry && CARD_ID_PATTERN.test(entry.card.id) && !set.cards.some((other) => other.card.id === entry.card.id)) {
        set.cards.push(entry);
      }
    }
  }

  let editor: EditorSnapshot | null = null;
  const rawEditor = doc.editor as Partial<Record<keyof EditorSnapshot, unknown>> | null | undefined;
  const entry = rawEditor ? readEntry(rawEditor.entry) : null;
  if (rawEditor && entry) {
    const editingId = typeof rawEditor.editingId === 'string' && set.cards.some((card) => card.card.id === rawEditor.editingId)
      ? rawEditor.editingId
      : null;
    editor = {
      entry,
      editingId,
      baseline: rawEditor.baseline === null ? null : readEntry(rawEditor.baseline),
      loadedFrom: typeof rawEditor.loadedFrom === 'string' ? rawEditor.loadedFrom : null,
      loadedBaseline: rawEditor.loadedBaseline ? readEntry(rawEditor.loadedBaseline) : null,
    };
  }
  return { set, editor };
}

export type AutosaveRead =
  | { available: false }
  | { available: true; save: ForgeAutosave | null };

/** Read the autosave. `available: false` means this browser is not saving. */
export function readAutosave(storage: ForgeStorage | null): AutosaveRead {
  if (!storage) return { available: false };
  try {
    const text = storage.getItem(FORGE_STORAGE_KEY);
    return { available: true, save: text === null ? null : parseAutosave(text) };
  } catch {
    return { available: false };
  }
}

/** Write the autosave. False when the browser refused it (blocked, or out of room). */
export function writeAutosave(storage: ForgeStorage | null, save: ForgeAutosave): boolean {
  if (!storage) return false;
  const text = serializeAutosave(save);
  if (text.length > MAX_AUTOSAVE_CHARS) return false;
  try {
    storage.setItem(FORGE_STORAGE_KEY, text);
    return true;
  } catch {
    return false;
  }
}
