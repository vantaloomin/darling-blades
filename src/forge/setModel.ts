/**
 * The set builder's data: a named list of card entries, the JSON file format
 * it exports and imports, and the rules for the card in the editor (which
 * entry it is, whether it has unsaved changes).
 *
 * File format, version 1 (documented in docs/forge.md):
 *
 *   { "format": "darling-blades-forge-set", "version": 1, "name": "<set name>",
 *     "cards": [ { "card": <CardDef, id = a stable per-set id>,
 *                  "art": { "donor": "<catalog card id>",
 *                           "custom"?: { "image": "<data URL>", zoom, x, y,
 *                                        rotation, flip, background } },
 *                  "appearance": { "frame", "holo", "fullArt" },
 *                  "score": { "power", "budget", "delta", "verdict" } } ] }
 *
 * `art.custom` (the player's own image, customArt.ts) is optional and
 * additive: a file without it imports exactly as before. In the page a custom
 * image is referred to by its id; only the file embeds the bytes.
 *
 * `score` is written for people reading the file; on import it is ignored and
 * recomputed. Headless: no Phaser, no DOM.
 */
import { scoreCard, type ScorableCardDef } from '../power/scoreCore';
import type { CustomArt } from './customArt';
import type { ArtFrame } from './framing';
import { bandForDelta, toCardDef, fromCardDef, type BuilderState, type VerdictBand } from './logic';
import {
  CARD_ID_PATTERN,
  FORGE_LIMITS,
  SKIP_REASON_TEXT,
  jsonClone,
  validateEntry,
  type ForgeEntry,
  type SkipReason,
} from './validate';

export const FORGE_SET_FORMAT = 'darling-blades-forge-set';
export const FORGE_SET_VERSION = 1;
export const MAX_SET_CARDS = 500;
/**
 * The largest set file Import JSON reads. A set that embeds its images runs to
 * a few hundred kilobytes per image, so the cap sits far past a full set of
 * text (a few megabytes) while staying a size a browser parses comfortably.
 */
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
export const MAX_IMPORT_LABEL = '100 MB';
export const DEFAULT_SET_NAME = 'My Set';

export interface ForgeSet {
  name: string;
  cards: ForgeEntry[];
}

export interface ScoreSummary {
  power: number;
  budget: number;
  delta: number;
  verdict: VerdictBand;
}

export function emptySet(): ForgeSet {
  return { name: DEFAULT_SET_NAME, cards: [] };
}

/** The set name to show and export: never blank. */
export function setDisplayName(set: ForgeSet): string {
  return set.name.trim() || DEFAULT_SET_NAME;
}

/** Lowercase letters, digits and single hyphens; `fallback` when nothing is left. */
export function slugify(value: string, fallback: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/**
 * A stable per-set id for a new card: `forge-<name slug>-<n>`, where `n` is
 * one more than the highest number any id in the set ends with. Kept for the
 * life of the card, whatever it is renamed to.
 */
export function newCardId(set: ForgeSet, name: string): string {
  const taken = new Set(set.cards.map((entry) => entry.card.id));
  let n = 1 + set.cards.reduce((highest, entry) => {
    const match = /-(\d+)$/.exec(entry.card.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  const slug = slugify(name, 'card');
  while (taken.has(`forge-${slug}-${n}`)) n += 1;
  return `forge-${slug}-${n}`;
}

/** Which art window the card is drawn with. */
export function artFrameOf(state: BuilderState): ArtFrame {
  return state.appearance.fullArt ? 'fullArt' : 'standard';
}

/** The own image the card shows, if it shows one. */
export function activeCustomArt(state: BuilderState): CustomArt | null {
  return state.artSource === 'custom' ? state.customArt : null;
}

/** The card in the editor as a set entry with `id`. Its own image goes in only while it shows it. */
export function entryFromState(state: BuilderState, id: string): ForgeEntry {
  const custom = activeCustomArt(state);
  return jsonClone({
    card: { ...toCardDef(state), id },
    art: custom ? { donor: state.artDonorId, custom: { ...custom } } : { donor: state.artDonorId },
    appearance: { ...state.appearance },
  });
}

/** An entry loaded into the editors. */
export function stateFromEntry(entry: ForgeEntry): BuilderState {
  const state = fromCardDef(entry.card);
  state.artDonorId = entry.art.donor;
  state.artSource = entry.art.custom ? 'custom' : 'game';
  state.customArt = entry.art.custom ? { ...entry.art.custom } : null;
  state.appearance = { ...entry.appearance };
  return state;
}

/** True when the card carries the player's own image. */
export function hasCustomArt(entry: ForgeEntry): boolean {
  return entry.art.custom !== undefined;
}

/** Key-sorted JSON, so two equal entries always compare equal. */
function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, nested) => {
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return nested;
    return Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right)));
  });
}

/** True when two entries describe the same card, art and look (ids aside). */
export function sameEntry(left: ForgeEntry, right: ForgeEntry): boolean {
  const comparable = (entry: ForgeEntry) => ({ ...jsonClone(entry), card: { ...jsonClone(entry.card), id: '' } });
  return stableJson(comparable(left)) === stableJson(comparable(right));
}

export function scoreSummary(card: ScorableCardDef): ScoreSummary {
  const score = scoreCard(card);
  return { power: score.power, budget: score.budget, delta: score.delta, verdict: bandForDelta(score.delta) };
}

// ── The card in the editor ──────────────────────────────────────────────────

/**
 * Which card the editor holds. `editingId` names the set entry being edited;
 * without one the editor holds a new card, and `baseline` is the entry it was
 * opened as (a fresh card, a card from the game) or null when it counts as
 * unsaved from the start (a shared card opened from a link).
 */
export interface EditorSession {
  editingId: string | null;
  baseline: ForgeEntry | null;
}

export function editingIndex(set: ForgeSet, session: EditorSession): number {
  return session.editingId === null ? -1 : set.cards.findIndex((entry) => entry.card.id === session.editingId);
}

/** True when leaving this card now would lose work. */
export function hasUnsavedChanges(set: ForgeSet, session: EditorSession, state: BuilderState): boolean {
  const index = editingIndex(set, session);
  const current = entryFromState(state, '');
  if (index >= 0) return !sameEntry(set.cards[index], current);
  return session.baseline === null || !sameEntry(session.baseline, current);
}

/** The status line under the card. */
export function editorStatus(set: ForgeSet, session: EditorSession, state: BuilderState): string {
  const index = editingIndex(set, session);
  if (index < 0) return 'New card';
  const status = `Editing card ${index + 1} of ${set.cards.length}`;
  return hasUnsavedChanges(set, session, state) ? `${status} · unsaved changes` : status;
}

export type SaveResult =
  | { ok: true; set: ForgeSet; id: string }
  | { ok: false; reason: 'full' };

/** Save the editor's card: update the entry being edited, or add a new one. */
export function saveToSet(set: ForgeSet, session: EditorSession, state: BuilderState): SaveResult {
  const index = editingIndex(set, session);
  if (index >= 0) {
    const id = set.cards[index].card.id;
    const cards = [...set.cards];
    cards[index] = entryFromState(state, id);
    return { ok: true, set: { ...set, cards }, id };
  }
  if (set.cards.length >= MAX_SET_CARDS) return { ok: false, reason: 'full' };
  const id = newCardId(set, state.name);
  return { ok: true, set: { ...set, cards: [...set.cards, entryFromState(state, id)] }, id };
}

// ── The file format ─────────────────────────────────────────────────────────

/**
 * A card's art as the file writes it: the donor, and the own image embedded
 * as a data URL. `images` maps an image id to its data URL; a card whose
 * image is not in it is written with its game art alone.
 */
function exportArt(entry: ForgeEntry, images: ReadonlyMap<string, string>): ForgeEntry['art'] {
  const custom = entry.art.custom;
  const dataUrl = custom ? images.get(custom.image) : undefined;
  return custom && dataUrl ? { donor: entry.art.donor, custom: { ...custom, image: dataUrl } } : { donor: entry.art.donor };
}

export function exportSetDocument(set: ForgeSet, images: ReadonlyMap<string, string> = new Map()): unknown {
  return {
    format: FORGE_SET_FORMAT,
    version: FORGE_SET_VERSION,
    name: setDisplayName(set),
    cards: set.cards.map((entry) => ({
      card: entry.card,
      art: exportArt(entry, images),
      appearance: entry.appearance,
      score: scoreSummary(entry.card),
    })),
  };
}

export function exportSetJson(set: ForgeSet, images: ReadonlyMap<string, string> = new Map()): string {
  return `${JSON.stringify(exportSetDocument(set, images), null, 2)}\n`;
}

export function exportFileName(set: ForgeSet): string {
  return `${slugify(setDisplayName(set), 'my-set')}.json`;
}

export interface SkippedCard {
  /** The card's own name, or its place in the file when it has none. */
  name: string;
  reason: SkipReason;
}

export type ImportResult =
  | { ok: false; problem: 'not-a-set' | 'too-large' }
  | {
    ok: true;
    /** Cards with their own image hold it as a data URL here; the page stores it and swaps in its id. */
    set: ForgeSet;
    total: number;
    skipped: SkippedCard[];
    overCap: number;
    /** Cards whose own image could not be read: they import with their game art. */
    imageFailures: string[];
  };

/**
 * Read a set file. Every card is validated on its own: a bad one is skipped
 * with a reason and the rest still import. Ids are kept when they are well
 * formed and unique, otherwise the card gets a new one. A card whose own image
 * is unreadable imports with its game art and is named in `imageFailures`.
 */
export function importSetText(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, problem: 'too-large' };
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'not-a-set' };
  }
  if (
    typeof document !== 'object' || document === null || Array.isArray(document)
    || (document as { format?: unknown }).format !== FORGE_SET_FORMAT
    || (document as { version?: unknown }).version !== FORGE_SET_VERSION
    || !Array.isArray((document as { cards?: unknown }).cards)
  ) {
    return { ok: false, problem: 'not-a-set' };
  }
  const raw = document as { name?: unknown; cards: unknown[] };
  const name = typeof raw.name === 'string' && raw.name.trim() && raw.name.length <= FORGE_LIMITS.setNameLength
    ? raw.name
    : DEFAULT_SET_NAME;
  const set: ForgeSet = { name, cards: [] };
  const skipped: SkippedCard[] = [];
  const imageFailures: string[] = [];
  const considered = raw.cards.slice(0, MAX_SET_CARDS);
  considered.forEach((value, index) => {
    const checked = validateEntry(value, 'dataUrl');
    if (!checked.ok) {
      skipped.push({ name: checked.name ?? `card ${index + 1}`, reason: checked.reason });
      return;
    }
    const entry = checked.entry;
    if (checked.imageProblem) imageFailures.push(entry.card.name);
    const id = entry.card.id;
    const unique = CARD_ID_PATTERN.test(id) && id !== 'forge-card' && !set.cards.some((other) => other.card.id === id);
    if (!unique) entry.card = { ...entry.card, id: newCardId(set, entry.card.name) };
    set.cards.push(entry);
  });
  return { ok: true, set, total: raw.cards.length, skipped, overCap: raw.cards.length - considered.length, imageFailures };
}

/** The player-facing summary of an import. */
export function importMessage(result: ImportResult): string {
  if (!result.ok) {
    return result.problem === 'too-large'
      ? `That file is too large (the limit is ${MAX_IMPORT_LABEL}).`
      : 'That file isn\'t a Forge set.';
  }
  const imported = result.set.cards.length;
  const parts = result.skipped.length === 0 && result.overCap === 0
    ? [imported === 1 ? 'Imported 1 card.' : `Imported ${imported} cards.`]
    : [`Imported ${imported} of ${result.total} cards.`];
  const shown = result.skipped.slice(0, 3);
  for (const skip of shown) parts.push(`Skipped ${skip.name}: ${SKIP_REASON_TEXT[skip.reason]}.`);
  const more = result.skipped.length - shown.length;
  if (more > 0) parts.push(more === 1 ? 'Skipped 1 more.' : `Skipped ${more} more.`);
  if (result.overCap > 0) parts.push(`A set holds up to ${MAX_SET_CARDS} cards.`);
  const failures = result.imageFailures;
  if (failures.length === 1) parts.push(`${failures[0]} uses game art: its image couldn't be read.`);
  else if (failures.length > 1) parts.push(`${failures.length} cards use game art: their images couldn't be read.`);
  return parts.join(' ');
}

/** True when an import should read as a problem (anything skipped, or left without its image). */
export function importHadProblems(result: ImportResult): boolean {
  return !result.ok || result.skipped.length > 0 || result.overCap > 0 || result.imageFailures.length > 0;
}

