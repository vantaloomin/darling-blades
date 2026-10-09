import type Phaser from 'phaser';

/**
 * The gold coin drawn beside a price (2026-10-09 UI review, finding 20). It
 * replaces the 🪙 emoji, which every platform drew differently and none drew
 * to the game's style. Baked once to a canvas at twice its largest display
 * size so it stays crisp under the text-size setting.
 */
export const GOLD_ICON_KEY = 'ui-icon-gold';
const SIZE = 64;

/** The coin's display size for a line of text at `fontSize`. */
export function goldIconSize(fontSize: number): number {
  return Math.round(fontSize * 1.15);
}

export function bakeGoldIcon(scene: Phaser.Scene): void {
  if (scene.textures.exists(GOLD_ICON_KEY)) return;
  const tex = scene.textures.createCanvas(GOLD_ICON_KEY, SIZE, SIZE);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = SIZE / 2;
  const r = SIZE / 2 - 2;

  // Rim: a darker band so the coin holds its edge on a gold button plate.
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = '#7a4d0e';
  ctx.fill();

  // Face: warm gold, lit from the upper left.
  const face = ctx.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r * 0.9);
  face.addColorStop(0, '#fff1b8');
  face.addColorStop(0.45, '#f2c24f');
  face.addColorStop(1, '#b57b1c');
  ctx.beginPath();
  ctx.arc(c, c, r - 4, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();

  // Inner ring and a struck four-point star.
  ctx.beginPath();
  ctx.arc(c, c, r - 11, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(122, 77, 14, 0.7)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const s = r * 0.42;
  ctx.beginPath();
  ctx.moveTo(c, c - s);
  ctx.quadraticCurveTo(c + s * 0.16, c - s * 0.16, c + s, c);
  ctx.quadraticCurveTo(c + s * 0.16, c + s * 0.16, c, c + s);
  ctx.quadraticCurveTo(c - s * 0.16, c + s * 0.16, c - s, c);
  ctx.quadraticCurveTo(c - s * 0.16, c - s * 0.16, c, c - s);
  ctx.closePath();
  ctx.fillStyle = '#8a5a12';
  ctx.fill();
  tex.refresh();
}
