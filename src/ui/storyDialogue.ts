/**
 * Story Mode dialogue (docs/plan-story-mode.md, "story spine"): the Phaser-free
 * half of the scene player. What a script line shows (name, portrait, side),
 * which art a scene needs, the screen geometry of the dialogue box, the event
 * choice panel and the backlog, and the steps an event choice walks through.
 *
 * Script conventions (02-act-1-script.md, "How to read it"): each line is one
 * tap of Continue; a line with no speaker is narration, shown with no name and
 * no portrait; event choice labels are the button text; once an event's choice
 * resolves, the event's reacting speaker (after `reactsToChoice`) switches to
 * her second expression.
 *
 * Geometry follows storyLayout.ts: measure-then-place, `theme.type` read only
 * when called, every control inside the title-safe frame with a 44 px hit.
 */

import type { StoryCharacter, StoryEvent, StoryLine, StoryScene } from '../data/story/types';
import { STORY_SPEAKERS } from '../data/story/script';
import type { EventChoiceNeeds } from '../meta/story/storyEvents';
import { storySpeakerById } from '../meta/story/storyEvents';
import type { Rect } from './layout';
import { menuLineHeight } from './mainMenuPresentation';
import { shortName } from './storyPresentation';
import { theme } from './theme';

const HIT = (): number => theme.control.minHitHeight;

// ------------------------------------------------------------------ who shows

export type PortraitSide = 'left' | 'right';

/** A portrait on screen: the art is `pt-<speakerId>-<expression>`. */
export interface StoryPortrait {
  speakerId: string;
  expression: string;
  side: PortraitSide;
}

/** One line as the screen shows it. */
export interface StoryLineView {
  /** The name plate's text; null for narration. */
  name: string | null;
  text: string;
  /** Null for narration (the background alone). */
  portrait: StoryPortrait | null;
}

/** The speaker who is the run's heroine (her short name is the speaker's name); null when none matches. */
export function heroineSpeakerId(character: Pick<StoryCharacter, 'name'> | null | undefined): string | null {
  if (!character) return null;
  const name = shortName(character);
  return STORY_SPEAKERS.find((s) => s.name === name)?.id ?? null;
}

/** The heroine stands on the left, everyone else on the right. */
export function portraitSide(speakerId: string, heroineId: string | null): PortraitSide {
  return speakerId === heroineId ? 'left' : 'right';
}

export function portraitArtId(speakerId: string, expression: string): string {
  return `pt-${speakerId}-${expression}`;
}

/** A line's name, text and portrait. A speaker line with no expression shows the speaker's default one. */
export function storyLineView(line: StoryLine, heroineId: string | null): StoryLineView {
  if (line.speakerId === null) return { name: null, text: line.text, portrait: null };
  const speaker = storySpeakerById(line.speakerId);
  const expression = line.expression ?? speaker?.expressions[0] ?? '';
  return {
    name: speaker?.name ?? null,
    text: line.text,
    portrait: speaker ? { speakerId: speaker.id, expression, side: portraitSide(speaker.id, heroineId) } : null,
  };
}

/** The art one scene draws: its background and every portrait its lines show, without repeats. */
export function storySceneArtIds(scene: StoryScene): string[] {
  const ids = new Set<string>([scene.backgroundId]);
  for (const line of scene.lines) {
    const view = storyLineView(line, null);
    if (view.portrait) ids.add(portraitArtId(view.portrait.speakerId, view.portrait.expression));
  }
  return [...ids];
}

/** The speaker an event's choice panel keeps on screen: the last one who spoke in its scene, as she last looked. */
export function eventSpeaker(scene: StoryScene, heroineId: string | null): StoryPortrait | null {
  for (let i = scene.lines.length - 1; i >= 0; i--) {
    const view = storyLineView(scene.lines[i], heroineId);
    if (view.portrait) return view.portrait;
  }
  return null;
}

/**
 * The portrait on an event's result step: the reacting speaker in her second
 * expression after the choice she reacts to; otherwise the event's speaker as
 * the choice panel showed her (or no one, for a narrated event).
 */
export function eventResultPortrait(event: StoryEvent, scene: StoryScene, choiceIndex: number, heroineId: string | null): StoryPortrait | null {
  const shown = eventSpeaker(scene, heroineId);
  if (event.reactingSpeakerId !== null && event.reactsToChoice === choiceIndex) {
    const speaker = storySpeakerById(event.reactingSpeakerId);
    if (speaker) return { speakerId: speaker.id, expression: speaker.expressions[1], side: portraitSide(speaker.id, heroineId) };
  }
  return shown;
}

/** An event's art: its scene's, plus the reacting speaker's second expression. */
export function storyEventArtIds(event: StoryEvent, scene: StoryScene): string[] {
  const ids = new Set(storySceneArtIds(scene));
  for (let choice = 0; choice < event.choices.length; choice++) {
    const portrait = eventResultPortrait(event, scene, choice, null);
    if (portrait) ids.add(portraitArtId(portrait.speakerId, portrait.expression));
  }
  return [...ids];
}

/** Where a story art file lives: the half-size set on the lite tier (phones), full size otherwise. */
export function storyArtUrl(id: string, tier: 'full' | 'lite'): string {
  return `assets/art/${tier === 'lite' ? 'story-half' : 'story'}/${id}.webp`;
}

// ------------------------------------------------------------------ reading through a scene

/** The line after `index`, or 'done' past the last one. */
export function nextLineIndex(index: number, total: number): number | 'done' {
  return index + 1 < total ? index + 1 : 'done';
}

/** Backlog entries: every line up to and including `upTo`, in order. */
export function backlogEntries(lines: readonly StoryLine[], upTo: number, heroineId: string | null): StoryLineView[] {
  return lines.slice(0, Math.max(0, Math.min(lines.length, upTo + 1))).map((line) => storyLineView(line, heroineId));
}

/**
 * Split measured backlog entries into pages of a viewport's height, keeping
 * each entry whole and in order; an entry taller than the viewport gets a page
 * of its own. Returns entry indexes per page (at least one page).
 */
export function backlogPages(heights: readonly number[], viewport: number, gap: number): number[][] {
  const pages: number[][] = [[]];
  let used = 0;
  heights.forEach((h, i) => {
    const page = pages[pages.length - 1];
    const need = page.length === 0 ? h : used + gap + h;
    if (page.length > 0 && need > viewport) {
      pages.push([i]);
      used = h;
      return;
    }
    page.push(i);
    used = need;
  });
  return pages;
}

// ------------------------------------------------------------------ an event's steps

/** What the player has given so far for one choice; a field left out is not asked yet. */
export interface EventChoiceProgress {
  pickId?: string | null;
  removeIds?: readonly string[];
}

export type StoryEventStep =
  | { kind: 'pick'; choiceIndex: number; options: readonly string[] }
  | { kind: 'remove'; choiceIndex: number; upTo: number; atLeast: number }
  | { kind: 'resolve'; choiceIndex: number; pickId: string | null; removeIds: string[] };

/**
 * The next step for an available choice: pick the offered card first, then
 * the cards to remove, then resolve with what was given.
 */
export function nextEventStep(choiceIndex: number, needs: Extract<EventChoiceNeeds, { available: true }>, progress: EventChoiceProgress = {}): StoryEventStep {
  if (needs.pickOptions !== null && progress.pickId === undefined) return { kind: 'pick', choiceIndex, options: needs.pickOptions };
  if (needs.removeUpTo > 0 && progress.removeIds === undefined) {
    return { kind: 'remove', choiceIndex, upTo: needs.removeUpTo, atLeast: needs.removeAtLeast };
  }
  return { kind: 'resolve', choiceIndex, pickId: progress.pickId ?? null, removeIds: [...(progress.removeIds ?? [])] };
}

/** The confirm label of a remove step for `n` cards picked. */
export function removeConfirmLabel(n: number, upTo: number, atLeast: number): string {
  if (upTo === atLeast) return upTo === 1 ? (n === 1 ? 'Remove 1 Card' : 'Choose a Card') : `Remove ${n} of ${upTo}`;
  if (n === 0) return 'Remove No Cards';
  return n === 1 ? 'Remove 1 Card' : `Remove ${n} Cards`;
}

/** The remove step's title and note, for the cards the choice lets the player remove. */
export function removeStepCopy(upTo: number, atLeast: number): { title: string; note: string } {
  if (upTo === 1) {
    return atLeast === 1
      ? { title: 'Remove a Card', note: 'Choose one card to remove from your run deck.' }
      : { title: 'Remove a Card', note: 'Choose a card to remove from your run deck, or none.' };
  }
  if (atLeast === upTo) return { title: 'Remove Cards', note: `Choose ${upTo} cards to remove from your run deck.` };
  const fewest = atLeast === 0 ? ', or none' : `, at least ${atLeast}`;
  return { title: 'Remove Cards', note: `Choose up to ${upTo} cards to remove from your run deck${fewest}.` };
}

// ------------------------------------------------------------------ geometry

/** Dialogue text: a reading role, so it takes the whole text-size step (body at 125%: 20, 23, 26 px). */
export function storyDialogueTextSize(): number {
  return Math.round(theme.type.body * 1.25);
}

export function storyDialogueNameSize(): number {
  return theme.type.h2;
}

/** The scene title over the header row (display face). */
export function storyDialogueTitleSize(): number {
  return theme.type.h2;
}

/** The extra leading the scene player sets on dialogue text (Phaser `lineSpacing`). */
export function storyDialogueLineSpacing(size: number): number {
  return Math.round(size * 0.18);
}

/** One line of dialogue text at the size in force: a generous line box plus the leading. */
export function storyDialogueLineHeight(): number {
  const size = storyDialogueTextSize();
  return menuLineHeight(size) + storyDialogueLineSpacing(size);
}

/**
 * Lines of dialogue text the box always holds room for. The player passes the
 * scene's tallest measured line, so the box keeps one size through a scene.
 */
export const STORY_DIALOGUE_MIN_LINES = 2;

const BOX_PAD = (): number => theme.space(5);
const NAME_PAD_X = (): number => theme.space(4);
const NAME_PAD_Y = (): number => theme.space(1.5);
const ROW_GAP = (): number => theme.space(3);
/** The waist-up portraits are 2:3 (1024x1536, 512x768). */
const PORTRAIT_ASPECT = 2 / 3;

/** The width dialogue text wraps to. */
export function storyDialogueTextWidth(): number {
  return theme.design.safeWidth - 2 * BOX_PAD();
}

/** The name plate's height at the size in force. */
export function storyNamePlateHeight(): number {
  return menuLineHeight(storyDialogueNameSize()) + 2 * NAME_PAD_Y();
}

/** The widest the scene title may wrap to, centred clear of the back button. */
export function storyDialogueTitleMaxWidth(backHit: Rect): number {
  const clear = theme.design.safeCenterX - (backHit.x + backHit.width + theme.space(4));
  return Math.max(0, 2 * clear - 2 * NAME_PAD_X());
}

/** Where portraits may start: under the header row (the back button and the title). */
export function storyPortraitTop(titleBottom: number | null = null): number {
  const header = theme.design.safeTop + HIT() + theme.space(3);
  return titleBottom === null ? header : Math.max(header, titleBottom + theme.space(3));
}

/**
 * A portrait standing on the bottom of the frame with its lower part behind the
 * box (the art fades out there): as tall as the room under the header, 2:3,
 * against the frame's left or right edge.
 */
export function storyPortraitRect(side: PortraitSide, top: number, bottom = theme.design.safeBottom): Rect {
  const height = bottom - top;
  const width = height * PORTRAIT_ASPECT;
  return { x: side === 'left' ? theme.design.safeLeft : theme.design.safeRight - width, y: top, width, height };
}

/** A control's hit size (the measured themed button), placed by the layout. */
export interface HitSize {
  width: number;
  height: number;
}

export interface StoryDialogueInput {
  side: PortraitSide | null;
  /** The measured height of the wrapped text (at `storyDialogueTextWidth()`): the scene's tallest line. */
  textHeight: number;
  /** The measured name width; null for narration (no plate). */
  nameWidth: number | null;
  continueHit: HitSize;
  /** Null when the step has no Backlog or Skip (the event result). */
  backlogHit: HitSize | null;
  skipHit: HitSize | null;
  /** The measured scene title (first line only), wrapped to `storyDialogueTitleMaxWidth`. */
  title: HitSize | null;
}

export interface StoryDialogueLayout {
  box: Rect;
  text: Rect;
  namePlate: Rect | null;
  portrait: Rect | null;
  /** The title plate on the header row, centred on the frame. */
  title: Rect | null;
  continue: Rect;
  backlog: Rect | null;
  skip: Rect | null;
}

/** The bottom row of a box: optional left controls, the main action on the right, on one centre line. */
function bottomRow(box: Rect, right: HitSize, left: readonly (HitSize | null)[]): { right: Rect; left: (Rect | null)[] } {
  const rowH = Math.max(HIT(), right.height, ...left.map((h) => h?.height ?? 0));
  const cy = box.y + box.height - BOX_PAD() - rowH / 2;
  const rightRect = { x: box.x + box.width - BOX_PAD() - right.width, y: cy - right.height / 2, width: right.width, height: right.height };
  let x = box.x + BOX_PAD();
  const leftRects = left.map((h) => {
    if (!h) return null;
    const r = { x, y: cy - h.height / 2, width: h.width, height: h.height };
    x += h.width + ROW_GAP();
    return r;
  });
  return { right: rightRect, left: leftRects };
}

/**
 * The dialogue screen: a box across the bottom of the frame holding the line
 * (room for at least two lines, more when a measured line needs it) over a
 * row with Backlog and Skip on the left and Continue on the right; the name
 * plate straddles the box's top edge on the speaker's side; the portrait
 * stands on that side from under the header row down behind the box; the
 * scene title sits on the header row, centred.
 */
export function storyDialogueLayout(input: StoryDialogueInput): StoryDialogueLayout {
  const pad = BOX_PAD();
  const plateH = storyNamePlateHeight();
  const textArea = Math.max(Math.ceil(input.textHeight), STORY_DIALOGUE_MIN_LINES * storyDialogueLineHeight());
  const rowH = Math.max(HIT(), input.continueHit.height, input.backlogHit?.height ?? 0, input.skipHit?.height ?? 0);
  const height = plateH / 2 + pad + textArea + ROW_GAP() + rowH + pad;
  const box = { x: theme.design.safeLeft, y: theme.design.safeBottom - height, width: theme.design.safeWidth, height };
  const text = { x: box.x + pad, y: box.y + plateH / 2 + pad, width: storyDialogueTextWidth(), height: textArea };
  const namePlate = input.nameWidth === null ? null : (() => {
    const w = Math.ceil(input.nameWidth) + 2 * NAME_PAD_X();
    const x = input.side === 'right' ? box.x + box.width - pad - w : box.x + pad;
    return { x, y: box.y - plateH / 2, width: w, height: plateH };
  })();
  const title = input.title === null ? null : (() => {
    const w = Math.ceil(input.title.width) + 2 * NAME_PAD_X();
    const h = Math.max(HIT(), Math.ceil(input.title.height) + 2 * NAME_PAD_Y());
    return { x: theme.design.safeCenterX - w / 2, y: theme.design.safeTop, width: w, height: h };
  })();
  const portrait = input.side === null ? null : storyPortraitRect(input.side, storyPortraitTop(title ? title.y + title.height : null));
  const row = bottomRow(box, input.continueHit, [input.backlogHit, input.skipHit]);
  return { box, text, namePlate, portrait, title, continue: row.right, backlog: row.left[0], skip: row.left[1] };
}

/** Choice rows: the text column a row's label (and its reason) wraps to. */
export function storyChoiceTextWidth(): number {
  return theme.design.safeWidth - 2 * BOX_PAD() - 2 * theme.space(4);
}

export interface StoryChoicePanelLayout {
  box: Rect;
  /** The prompt and the run's gold and deck, one line across the top. */
  header: Rect;
  rows: Rect[];
  /** Where a row's text starts, inside its plate. */
  rowInset: { x: number; y: number };
  portrait: Rect | null;
}

/**
 * The event's choice panel in the dialogue box's place: a header line, then
 * one full-width row per choice, each as tall as its measured label (and
 * reason) and never under 44 px, stacked up from the bottom of the frame.
 */
export function storyChoicePanelLayout(side: PortraitSide | null, headerHeight: number, rowTextHeights: readonly number[]): StoryChoicePanelLayout {
  const pad = BOX_PAD();
  const inset = { x: theme.space(4), y: theme.space(3) };
  const rowHeights = rowTextHeights.map((h) => Math.max(HIT(), Math.ceil(h) + 2 * inset.y));
  const header = Math.max(Math.ceil(headerHeight), menuLineHeight(theme.type.label));
  const height = pad + header + ROW_GAP() + rowHeights.reduce((s, h) => s + h, 0) + ROW_GAP() * Math.max(0, rowHeights.length - 1) + pad;
  const box = { x: theme.design.safeLeft, y: theme.design.safeBottom - height, width: theme.design.safeWidth, height };
  let y = box.y + pad + header + ROW_GAP();
  const rows = rowHeights.map((h) => {
    const r = { x: box.x + pad, y, width: box.width - 2 * pad, height: h };
    y += h + ROW_GAP();
    return r;
  });
  return {
    box,
    header: { x: box.x + pad, y: box.y + pad, width: box.width - 2 * pad, height: header },
    rows,
    rowInset: inset,
    portrait: side === null ? null : storyPortraitRect(side, storyPortraitTop()),
  };
}

/** The way on from an event whose every choice is unavailable (not script text: it never shows in normal play). */
export const MOVE_ON_LABEL = 'Move on: nothing changes.';
