import type Phaser from 'phaser';
import { theme } from './theme';

export const PILE_ICON_SIZE = 32;

export const PILE_ICON_KEYS = {
  hand: 'pile-icon-hand',
  grave: 'pile-icon-tombstone',
  deck: 'pile-icon-card-back-mini',
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

function drawSevered(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.strokeStyle = theme.colors.body;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = theme.colors.gold;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(16, 7);
  ctx.lineTo(23, 16);
  ctx.lineTo(16, 25);
  ctx.lineTo(9, 16);
  ctx.lineTo(16, 10);
  ctx.lineTo(21, 16);
  ctx.lineTo(16, 22);
  ctx.lineTo(11, 16);
  ctx.lineTo(16, 13);
  ctx.lineTo(18, 16);
  ctx.lineTo(16, 19);
  ctx.stroke();
}

const DRAW_ICON: Record<PileIconKind, IconDraw> = {
  hand: drawHand,
  grave: drawTombstone,
  deck: drawCardBack,
  severed: drawSevered,
};

export function bakePileIcons(scene: Phaser.Scene): void {
  for (const kind of Object.keys(PILE_ICON_KEYS) as PileIconKind[]) {
    const key = PILE_ICON_KEYS[kind];
    if (scene.textures.exists(key)) continue;

    const tex = scene.textures.createCanvas(key, PILE_ICON_SIZE, PILE_ICON_SIZE)!;
    const ctx = tex.getContext();
    drawIconBase(ctx, PILE_ICON_SIZE);
    DRAW_ICON[kind](ctx, PILE_ICON_SIZE);
    tex.refresh();
  }
}
