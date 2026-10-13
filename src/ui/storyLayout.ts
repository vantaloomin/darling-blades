/**
 * Story Mode run screens: Phaser-free geometry (docs/plan-story-mode.md,
 * "UI scenes"; docs/design-system.md, text scale). Every function places from
 * measured heights the scene passes in (measure-then-place), reads
 * `theme.type` only when called, and keeps controls inside the title-safe
 * frame with hit areas of at least 44 px, so the rules can be tested over the
 * accessibility cells and the compact (phone) shell's touch floor.
 */

import type { Rect } from './layout';
import { menuLineHeight } from './mainMenuPresentation';
import { theme } from './theme';

const HIT = (): number => theme.control.minHitHeight;

/** The line every footer action sits on. */
export function storyFooterY(): number {
  return theme.design.footerCenterY;
}

/** The lowest any screen content reaches above the footer actions. */
export function storyContentBottom(): number {
  return storyFooterY() - HIT() / 2 - theme.space(4);
}

/** Content starts this far under the measured subtitle. */
export function storyContentTop(subtitleBottom: number): number {
  return Math.ceil(subtitleBottom) + theme.space(4);
}

/**
 * Footer actions in one centred row on the footer line, from measured hit
 * widths, a destructive-gap apart when `destructive` is set.
 */
export function storyFooterRow(hitWidths: readonly number[], destructive = false): { xs: number[]; y: number; rects: Rect[] } {
  const gap = destructive ? 24 : theme.space(4);
  const total = hitWidths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, hitWidths.length - 1);
  let x = theme.design.centerX - total / 2;
  const y = storyFooterY();
  const xs: number[] = [];
  const rects: Rect[] = [];
  for (const w of hitWidths) {
    xs.push(x + w / 2);
    rects.push({ x, y: y - HIT() / 2, width: w, height: HIT() });
    x += w + gap;
  }
  return { xs, y, rects };
}

// ------------------------------------------------------------------ character select

export interface StorySelectLayout {
  tiles: Rect[];
  portraits: Rect[];
  texts: Rect[];
}

export const STORY_SELECT_TILE_W = 300;

/**
 * Three heroine tiles across the frame: a portrait on top and a text block
 * under it. The text block is as tall as the tallest measured block, and the
 * portrait gives up height (never the text its size) when text grows.
 */
export function storySelectLayout(top: number, textHeight: number, count = 3): StorySelectLayout {
  const gap = theme.space(6);
  const inset = theme.space(3);
  const width = STORY_SELECT_TILE_W;
  const total = count * width + (count - 1) * gap;
  const left = theme.design.centerX - total / 2;
  const bottom = storyContentBottom();
  const height = bottom - top;
  const textH = Math.ceil(textHeight);
  const portraitH = Math.max(theme.space(20), height - 2 * inset - theme.space(3) - textH);
  const tiles: Rect[] = [];
  const portraits: Rect[] = [];
  const texts: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const tile = { x: left + i * (width + gap), y: top, width, height };
    const portrait = { x: tile.x + inset, y: tile.y + inset, width: width - 2 * inset, height: portraitH };
    const textY = portrait.y + portrait.height + theme.space(3);
    tiles.push(tile);
    portraits.push(portrait);
    texts.push({ x: tile.x + inset, y: textY, width: width - 2 * inset, height: tile.y + tile.height - inset - textY });
  }
  return { tiles, portraits, texts };
}

// ------------------------------------------------------------------ a row of choices

/** Items of one size in a centred row, centred in the band between `top` and `bottom`. */
export function storyChoiceRow(count: number, itemW: number, itemH: number, top: number, bottom = storyContentBottom()): Rect[] {
  const gap = theme.space(6);
  const total = count * itemW + (count - 1) * gap;
  const left = theme.design.centerX - total / 2;
  const y = top + Math.max(0, (bottom - top - itemH) / 2);
  return Array.from({ length: count }, (_, i) => ({ x: left + i * (itemW + gap), y, width: itemW, height: itemH }));
}

/** A card face's size at a CardView scale (the 300x420 face). */
export function cardSize(scale: number): { width: number; height: number } {
  return { width: 300 * scale, height: 420 * scale };
}

/**
 * The scale for a row of `count` cards with a caption band under each, the
 * largest that fits both the band's height and the frame's width, capped at
 * `maxScale`.
 */
export function storyCardRowScale(count: number, top: number, captionBand: number, maxScale = 0.6, bottom = storyContentBottom()): number {
  const gap = theme.space(6);
  const byHeight = (bottom - top - captionBand) / 420;
  const byWidth = (theme.design.safeWidth - (count - 1) * gap) / (count * 300);
  return Math.max(0.2, Math.min(maxScale, byHeight, byWidth));
}

/** The caption band under a card: `lines` lines of caption text and a gap. */
export function storyCaptionBand(lines = 1): number {
  return theme.space(2) + lines * menuLineHeight(theme.type.caption);
}

// ------------------------------------------------------------------ a paged card grid

export interface StoryCardGridLayout {
  scale: number;
  card: { width: number; height: number };
  columns: number;
  rows: number;
  pageSize: number;
  pages: number;
  /** Card rect of the i-th card on a page. */
  cell(i: number): Rect;
  /** The caption band under the i-th card on a page. */
  caption(i: number): Rect;
  /** The pager's centre line, below the last row. */
  pagerY: number;
}

/**
 * A paged grid of run-deck cards in `area`, centred, with a caption band
 * under each card and the pager's band reserved under the grid.
 */
export function storyCardGridLayout(area: Rect, count: number, scale = 0.36, captionLines = 1): StoryCardGridLayout {
  const gap = theme.space(3);
  const card = cardSize(scale);
  const band = storyCaptionBand(captionLines);
  const pagerBand = HIT() + gap;
  const columns = Math.max(1, Math.floor((area.width + gap) / (card.width + gap)));
  const pitchY = card.height + band + gap;
  const rows = Math.max(1, Math.floor((area.height - pagerBand + gap) / pitchY));
  const pageSize = columns * rows;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const shownCols = Math.min(columns, Math.max(1, count));
  const gridW = shownCols * card.width + (shownCols - 1) * gap;
  const left = area.x + (area.width - gridW) / 2;
  const cell = (i: number): Rect => {
    const r = Math.floor(i / columns);
    const c = i % columns;
    return { x: left + c * (card.width + gap), y: area.y + r * pitchY, width: card.width, height: card.height };
  };
  const caption = (i: number): Rect => {
    const rect = cell(i);
    return { x: rect.x, y: rect.y + rect.height + theme.space(1), width: rect.width, height: band - theme.space(1) };
  };
  return { scale, card, columns, rows, pageSize, pages, cell, caption, pagerY: area.y + area.height - HIT() / 2 };
}

// ------------------------------------------------------------------ the map

/** Node sizes: a 44 px floor in both directions, the boss larger. */
export const STORY_NODE = { width: 72, height: 48, bossWidth: 88, bossHeight: 56 } as const;
export const STORY_SIDE_PANEL_W = 296;

export interface StoryMapGeometry {
  area: Rect;
  panel: Rect;
  nodes: Map<string, Rect>;
}

/**
 * The act map, floor 1 on the left and the boss on the right, beside the run
 * panel. Floors share one pitch across the map's width; a floor's nodes are
 * centred on the map's middle line one row pitch apart.
 */
export function storyMapLayout(floors: readonly (readonly { id: string; kind: string }[])[], top: number): StoryMapGeometry {
  const gap = theme.space(6);
  const area: Rect = {
    x: theme.design.safeLeft,
    y: top,
    width: theme.design.safeWidth - STORY_SIDE_PANEL_W - gap,
    height: theme.design.safeBottom - top,
  };
  const panel: Rect = { x: area.x + area.width + gap, y: top, width: STORY_SIDE_PANEL_W, height: area.height };
  const edge = STORY_NODE.bossWidth / 2;
  const pitchX = floors.length > 1 ? (area.width - 2 * edge) / (floors.length - 1) : 0;
  const widest = Math.max(1, ...floors.map((f) => f.length));
  const rowPitch = widest > 1 ? Math.min(140, (area.height - STORY_NODE.bossHeight) / (widest - 1)) : 0;
  const midY = area.y + area.height / 2;
  const nodes = new Map<string, Rect>();
  floors.forEach((floor, f) => {
    const cx = floors.length > 1 ? area.x + edge + f * pitchX : area.x + area.width / 2;
    floor.forEach((node, i) => {
      const boss = node.kind === 'boss';
      const w = boss ? STORY_NODE.bossWidth : STORY_NODE.width;
      const h = boss ? STORY_NODE.bossHeight : STORY_NODE.height;
      const cy = midY + (i - (floor.length - 1) / 2) * rowPitch;
      nodes.set(node.id, { x: cx - w / 2, y: cy - h / 2, width: w, height: h });
    });
  });
  return { area, panel, nodes };
}

export interface StoryMapPanelLayout {
  inset: number;
  /** The heroine, run gold, deck, fights and floor: measured text goes here. */
  info: Rect;
  viewDeckY: number;
  /** The chosen node's name and summary. */
  detail: Rect;
  primaryY: number;
  /** The standing R9 note, which the armed Abandon consequence replaces. */
  note: Rect;
  abandonY: number;
  buttonWidth: number;
}

/**
 * The run panel, laid out from the bottom: Abandon on the bottom inset, its
 * note above it (room for three caption lines), the main action, the chosen
 * node's detail (two label and two caption lines), View Deck, and the run's
 * info in what is left at the top.
 */
export function storyMapPanelLayout(panel: Rect): StoryMapPanelLayout {
  const inset = theme.space(4);
  const h = HIT();
  const x = panel.x + inset;
  const width = panel.width - 2 * inset;
  const abandonY = panel.y + panel.height - inset - h / 2;
  const noteH = 3 * menuLineHeight(theme.type.caption);
  const note = { x, y: abandonY - h / 2 - theme.space(2) - noteH, width, height: noteH };
  const primaryY = note.y - theme.space(3) - h / 2;
  const detailH = 2 * menuLineHeight(theme.type.label) + 2 * menuLineHeight(theme.type.caption);
  const detail = { x, y: primaryY - h / 2 - theme.space(3) - detailH, width, height: detailH };
  const viewDeckY = detail.y - theme.space(3) - h / 2;
  const infoTop = panel.y + inset;
  const info = { x, y: infoTop, width, height: viewDeckY - h / 2 - theme.space(3) - infoTop };
  return { inset, info, viewDeckY, detail, primaryY, note, abandonY, buttonWidth: width };
}
