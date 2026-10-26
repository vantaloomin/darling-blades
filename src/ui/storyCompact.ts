/**
 * Story Mode's compact composition, Phaser-free (frames N-31 to N-37;
 * docs/plan-mobile-overhaul.md, wave 4).
 *
 * Every run screen is the Version C shell: back, the screen's title over one
 * line of context, and the run's gold and deck size in the right slot; the
 * main pane holds what is being chosen (heroines, boons, cards, the map, the
 * scene); the command column says what the choice does, over the screen's one
 * gold action. A scene's lines put the speaker's portrait left of the text
 * and Continue at the column's foot. One composition serves the phone and the
 * desktop: sizes are compact design px, times `k` (the content box over the
 * reference phone's 718 x 356, up to 1.6) where the frames sized them.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';
import { limitedBuilderScale } from './limitedBuilderCompact';

export const STORY_COMPACT = {
  /** A panel's inner inset. */
  pad: 12,
  /** A card tile's floor and shape (the frames' 72 x 102). */
  tileMinW: 72,
  tileAspect: 102 / 72,
  /** Tiles in a choice row stop growing here (times `k`), so three cards never fill a desktop pane. */
  tileMaxW: 150,
  /** The caption band under a row tile (a price, "Not enough gold"). */
  captionH: 20,
  /** The secondary action's share of a split foot (View deck, Skip, Leave). */
  secondaryShare: 0.42,
  /** The scene portrait's width over the main pane's height (the frame's 150 x 300). */
  portraitShare: 0.5,
  /** Map stops: a stop's and the boss's medallion (times `k`). */
  stopD: 36,
  bossD: 46,
  /** The map's inset from its panel's edge, beyond a medallion's radius. */
  mapPad: 14,
} as const;

/** The compact scale for a content box (the Limited screens' own). */
export function storyCompactScale(content: Rect): number {
  return limitedBuilderScale(content);
}

export interface StoryColumn {
  /** Text over the foot: the column's top to a gap above the foot. */
  body: Rect;
  /** The whole foot, and its two halves when it splits (secondary left, primary right). */
  foot: Rect;
  secondary: Rect;
  primary: Rect;
}

/** The command column's text area and foot; the foot splits secondary : primary by `secondaryShare`. */
export function storyColumn(shell: CompactShell): StoryColumn {
  const main = shell.main;
  const column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };
  const foot = shell.primary?.visual ?? { x: column.x, y: column.y + column.height - COMPACT.primaryH, width: column.width, height: COMPACT.primaryH };
  const secondaryW = Math.round(foot.width * STORY_COMPACT.secondaryShare);
  return {
    body: { x: column.x, y: column.y, width: column.width, height: Math.max(0, foot.y - COMPACT.gap - column.y) },
    foot,
    secondary: { ...foot, width: secondaryW },
    primary: { ...foot, x: foot.x + secondaryW + COMPACT.gap, width: foot.width - secondaryW - COMPACT.gap },
  };
}

export interface StoryScreenLayout {
  shell: CompactShell;
  k: number;
  column: StoryColumn;
}

export function storyScreenLayout(content: Rect): StoryScreenLayout {
  const shell = compactShell(content, { back: true });
  return { shell, k: storyCompactScale(content), column: storyColumn(shell) };
}

/** `count` tall tiles side by side across `area`, its full height (the heroines, the boons). */
export function storyTiles(area: Rect, count: number): Rect[] {
  if (count <= 0) return [];
  const gap = COMPACT.gap;
  const w = Math.floor((area.width - gap * (count - 1)) / count);
  return Array.from({ length: count }, (_, i) => ({ x: area.x + i * (w + gap), y: area.y, width: w, height: area.height }));
}

export interface StoryCardRow {
  /** Each card tile, then its caption band under it. */
  tiles: Rect[];
  captions: Rect[];
}

/**
 * Offered cards in one centred row inside `area`: as wide as the pane allows,
 * no taller than the area leaves above a caption band (with `captions`), and
 * no wider than the tile's cap. The row sits centred in the area.
 */
export function storyCardRow(area: Rect, count: number, k: number, captions: boolean): StoryCardRow {
  const C = STORY_COMPACT;
  if (count <= 0) return { tiles: [], captions: [] };
  const gap = Math.round(COMPACT.gap * Math.min(k, 1.25));
  const band = captions ? Math.round(C.captionH * Math.min(k, 1.25)) : 0;
  const byWidth = (area.width - gap * (count - 1)) / count;
  const byHeight = (area.height - band) / C.tileAspect;
  const w = Math.max(0, Math.floor(Math.min(byWidth, byHeight, C.tileMaxW * k)));
  const h = Math.round(w * C.tileAspect);
  const rowW = count * w + (count - 1) * gap;
  const x0 = Math.round(area.x + (area.width - rowW) / 2);
  const y0 = Math.round(area.y + Math.max(0, (area.height - h - band) / 2));
  const tiles = Array.from({ length: count }, (_, i) => ({ x: x0 + i * (w + gap), y: y0, width: w, height: h }));
  return { tiles, captions: tiles.map((t) => ({ x: t.x, y: t.y + t.height + 2, width: t.width, height: band - 2 })) };
}

export interface StoryMapPlan {
  /** Each stop's centre and diameter, by node id. */
  stops: Map<string, { x: number; y: number; d: number }>;
  /** A stop's hit square: never under the touch floor, never into the next floor's. */
  hit: number;
}

/**
 * The act's floors left to right (owner ruling M1) inside `area`: one column
 * per floor at an even pitch, each floor's stops spread down it, the boss
 * larger. Medallions shrink to keep half a stop's gap between floors.
 */
export function storyMapPlan(area: Rect, floors: readonly (readonly { id: string; kind: string }[])[], k: number): StoryMapPlan {
  const C = STORY_COMPACT;
  const n = floors.length;
  const boss = Math.round(C.bossD * k);
  const pad = Math.round(C.mapPad * k);
  const left = area.x + pad + boss / 2;
  const right = area.x + area.width - pad - boss / 2;
  const pitchX = n > 1 ? (right - left) / (n - 1) : 0;
  const most = Math.max(1, ...floors.map((f) => f.length));
  const top = area.y + pad + boss / 2;
  const bottom = area.y + area.height - pad - boss / 2;
  const pitchY = most > 1 ? (bottom - top) / (most - 1) : 0;
  const room = Math.min(n > 1 ? pitchX : Infinity, most > 1 ? pitchY : Infinity);
  const d = Math.max(20, Math.round(Math.min(C.stopD * k, room / 1.5)));
  const bossD = Math.max(d, Math.round(Math.min(boss, room * 0.9)));
  const stops = new Map<string, { x: number; y: number; d: number }>();
  floors.forEach((floor, f) => {
    const x = Math.round(n > 1 ? left + f * pitchX : area.x + area.width / 2);
    const span = (floor.length - 1) * pitchY;
    const mid = (top + bottom) / 2;
    floor.forEach((node, i) => {
      const y = Math.round(floor.length > 1 ? mid - span / 2 + i * pitchY : mid);
      stops.set(node.id, { x, y, d: node.kind === 'boss' ? bossD : d });
    });
  });
  return { stops, hit: Math.max(d, Math.min(COMPACT.touch, Math.floor(room) - 2)) };
}

export interface StorySceneLayout {
  shell: CompactShell;
  k: number;
  /** The speaker's portrait panel, left; null on narration (the text takes the pane). */
  portrait: Rect | null;
  /** The line's panel. */
  text: Rect;
  /** Under the text, left of the foot: the read-on hint and the line count. */
  hint: Rect;
  column: StoryColumn;
}

/**
 * A scene's line (frame N-34): the portrait down the pane's left, the line's
 * panel beside it running across the column's top, and the hint and Continue
 * under it. With `choices` the panel stops at the main pane and the column
 * lists the choices over Choose.
 */
export function storySceneLayout(content: Rect, portrait: boolean, choices: boolean, hintH: number): StorySceneLayout {
  const shell = compactShell(content, { back: true });
  const k = storyCompactScale(content);
  const column = storyColumn(shell);
  const main = shell.main;
  const pw = portrait ? Math.min(Math.round(main.height * STORY_COMPACT.portraitShare), Math.round(main.width * 0.4)) : 0;
  const pic = portrait ? { x: main.x, y: main.y, width: pw, height: main.height } : null;
  const textX = pic ? pic.x + pic.width + COMPACT.gap : main.x;
  const right = choices ? main.x + main.width : column.foot.x + column.foot.width;
  const bottom = choices ? main.y + main.height : column.foot.y - COMPACT.gap;
  const text = { x: textX, y: main.y, width: Math.max(0, right - textX), height: Math.max(0, bottom - main.y) };
  const hint = choices
    ? { x: textX, y: bottom, width: 0, height: 0 }
    : { x: textX, y: column.foot.y + Math.max(0, (column.foot.height - hintH) / 2), width: Math.max(0, column.foot.x - COMPACT.gap - textX), height: hintH };
  return { shell, k, portrait: pic, text, hint, column };
}
