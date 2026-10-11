import type Phaser from 'phaser';
import { theme } from './theme';

export const PILE_ICON_SIZE = 32;

/**
 * Icons are drawn in 32px units but baked at twice that, so they stay crisp
 * when the canvas renders above 1× or a pile shows them at 36px.
 */
const ICON_BAKE_SCALE = 2;

export const PILE_ICON_KEYS = {
  hand: 'pile-icon-hand',
  grave: 'pile-icon-tombstone',
  deck: 'pile-icon-card-back-mini',
  reserve: 'pile-icon-warchest-reserve',
  severed: 'pile-icon-severed',
} as const;

export type PileIconKind = keyof typeof PILE_ICON_KEYS;

type IconDraw = (ctx: CanvasRenderingContext2D, s: number) => void;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function strokeCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 2): void {
  roundedRect(ctx, x, y, w, h, r);
  ctx.fillStyle = theme.colors.btnGhostBg;
  ctx.fill();
  ctx.strokeStyle = theme.colors.body;
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

function drawIconBase(ctx: CanvasRenderingContext2D, s: number): void {
  roundedRect(ctx, 1.5, 1.5, s - 3, s - 3, 7);
  ctx.fillStyle = theme.colors.rowFill;
  ctx.fill();
  ctx.strokeStyle = theme.colors.panelStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawHand(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.save();
  ctx.translate(s / 2, s / 2 + 1);
  ctx.rotate(-0.24);
  strokeCard(ctx, -13, -11, 13, 20);
  ctx.restore();

  ctx.save();
  ctx.translate(s / 2, s / 2);
  strokeCard(ctx, -6.5, -13, 13, 21);
  ctx.restore();

  ctx.save();
  ctx.translate(s / 2, s / 2 + 1);
  ctx.rotate(0.24);
  strokeCard(ctx, 0, -11, 13, 20);
  ctx.restore();

  ctx.strokeStyle = theme.colors.gold;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(12, 21);
  ctx.lineTo(20, 21);
  ctx.moveTo(14, 24);
  ctx.lineTo(22, 24);
  ctx.stroke();
}

function drawTombstone(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = theme.colors.btnGhostBg;
  ctx.strokeStyle = theme.colors.body;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(9, 26);
  ctx.lineTo(9, 15);
  ctx.arc(s / 2, 15, 7, Math.PI, 0);
  ctx.lineTo(23, 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = theme.colors.gold;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(16, 12);
  ctx.lineTo(16, 22);
  ctx.moveTo(12, 16);
  ctx.lineTo(20, 16);
  ctx.stroke();
}

function drawCardBack(ctx: CanvasRenderingContext2D, s: number): void {
  const cardW = 14;
  const cardH = 22;
  const x = s / 2 - cardW / 2;
  const y = s / 2 - cardH / 2;
  strokeCard(ctx, x, y, cardW, cardH, 2.5);
  ctx.strokeStyle = theme.colors.gold;
  ctx.lineWidth = 1.6;
  roundedRect(ctx, x + 3, y + 3, 8, 16, 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s / 2, y + 6);
  ctx.lineTo(x + 11, s / 2);
  ctx.lineTo(s / 2, y + 16);
  ctx.lineTo(x + 3, s / 2);
  ctx.closePath();
  ctx.stroke();
}

/** Card-back pile marked with a small land bead so Reserves read distinctly. */
function drawReserve(ctx: CanvasRenderingContext2D, s: number): void {
  drawCardBack(ctx, s);
  const cx = s / 2 + 6;
  const cy = s / 2 + 7;
  ctx.fillStyle = theme.colors.success;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.colors.gold;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = theme.colors.panelFill;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 2.5, cy + 1.5);
  ctx.lineTo(cx, cy - 2.5);
  ctx.lineTo(cx + 2.5, cy + 1.5);
  ctx.stroke();
}

/**
 * A card cut in two: its halves pulled apart along a gold diagonal slash.
 * Replaces the 2026-08 nested-diamond squiggle, which read as a smudge at
 * pile size (owner note 2026-10-11).
 */
function drawSevered(ctx: CanvasRenderingContext2D, s: number): void {
  const cardW = 14;
  const cardH = 22;
  const x = s / 2 - cardW / 2;
  const y = s / 2 - cardH / 2;
  // The cut runs from the card's left edge low to its right edge high.
  const cutL = { x: x - 4, y: y + 15 };
  const cutR = { x: x + cardW + 4, y: y + 7 };
  const gap = 2.4;
  for (const side of [-1, 1] as const) {
    ctx.save();
    ctx.translate(side * gap, side * gap);
    ctx.beginPath();
    ctx.moveTo(cutL.x, cutL.y);
    ctx.lineTo(cutR.x, cutR.y);
    if (side < 0) {
      ctx.lineTo(cutR.x, 0);
      ctx.lineTo(cutL.x, 0);
    } else {
      ctx.lineTo(cutR.x, s);
      ctx.lineTo(cutL.x, s);
    }
    ctx.closePath();
    ctx.clip();
    strokeCard(ctx, x, y, cardW, cardH, 2.5);
    ctx.restore();
  }
  ctx.strokeStyle = theme.colors.gold;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cutL.x + 1, cutL.y - 0.4);
  ctx.lineTo(cutR.x - 1, cutR.y + 0.4);
  ctx.stroke();
}

export const RETELL_ICON_KEY = 'retell-icon-tombstone';

/**
 * The graveyard tombstone alone, plate-free, for the card name bar: cards
 * with Retell carry it so they read as graveyard-active at a glance (same
 * tombstone as the graveyard pile for consistency; user pick 2026-07-31).
 */
export function bakeRetellTombstone(scene: Phaser.Scene): void {
  if (scene.textures.exists(RETELL_ICON_KEY)) return;
  const tex = scene.textures.createCanvas(RETELL_ICON_KEY, PILE_ICON_SIZE * ICON_BAKE_SCALE, PILE_ICON_SIZE * ICON_BAKE_SCALE)!;
  const ctx = tex.getContext();
  ctx.scale(ICON_BAKE_SCALE, ICON_BAKE_SCALE);
  drawTombstone(ctx, PILE_ICON_SIZE);
  tex.refresh();
}

const DRAW_ICON: Record<PileIconKind, IconDraw> = {
  hand: drawHand,
  grave: drawTombstone,
  deck: drawCardBack,
  reserve: drawReserve,
  severed: drawSevered,
};

export function bakePileIcons(scene: Phaser.Scene): void {
  for (const kind of Object.keys(PILE_ICON_KEYS) as PileIconKind[]) {
    const key = PILE_ICON_KEYS[kind];
    if (scene.textures.exists(key)) continue;

    const tex = scene.textures.createCanvas(key, PILE_ICON_SIZE * ICON_BAKE_SCALE, PILE_ICON_SIZE * ICON_BAKE_SCALE)!;
    const ctx = tex.getContext();
    ctx.scale(ICON_BAKE_SCALE, ICON_BAKE_SCALE);
    drawIconBase(ctx, PILE_ICON_SIZE);
    DRAW_ICON[kind](ctx, PILE_ICON_SIZE);
    tex.refresh();
  }
}
