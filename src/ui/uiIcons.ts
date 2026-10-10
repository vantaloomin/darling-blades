import type Phaser from 'phaser';

/**
 * The game's drawn UI icons (2026-10-09 UI review, finding 20). They replace
 * emoji (🪙 👤 📖 📌 🔒 🎲), which every platform drew differently and none
 * drew to the game's style. Each is baked once to a canvas at twice its
 * largest display size. The coin keeps its own colours; the rest are white
 * silhouettes, tinted to the text they sit beside.
 */
export const UI_ICON_NAMES = ['gold', 'profile', 'help', 'book', 'gear', 'pin', 'lock', 'dice', 'sort', 'pencil', 'expand', 'shrink'] as const;
export type UiIconName = (typeof UI_ICON_NAMES)[number];

const SIZE = 64;

export function uiIconKey(name: UiIconName): string {
  return `ui-icon-${name}`;
}

/** Whether the icon takes the colour of the text beside it (all but the coin). */
export function uiIconTinted(name: UiIconName): boolean {
  return name !== 'gold';
}

/** An icon's display size for a line of text at `fontSize`. */
export function uiIconSize(fontSize: number): number {
  return Math.round(fontSize * 1.15);
}

type Draw = (ctx: CanvasRenderingContext2D, c: number) => void;

const WHITE = '#ffffff';

const drawGold: Draw = (ctx, c) => {
  const r = c - 2;
  // Rim: a darker band so the coin holds its edge on a gold button plate.
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = '#7a4d0e';
  ctx.fill();
  const face = ctx.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r * 0.9);
  face.addColorStop(0, '#fff1b8');
  face.addColorStop(0.45, '#f2c24f');
  face.addColorStop(1, '#b57b1c');
  ctx.beginPath();
  ctx.arc(c, c, r - 4, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, c, r - 11, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(122, 77, 14, 0.7)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // A struck four-point star.
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
};

const drawProfile: Draw = (ctx, c) => {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(c, c - 10, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c - 25, c + 28);
  ctx.quadraticCurveTo(c - 25, c + 6, c, c + 6);
  ctx.quadraticCurveTo(c + 25, c + 6, c + 25, c + 28);
  ctx.closePath();
  ctx.fill();
};

const drawHelp: Draw = (ctx, c) => {
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(c, c - 8, 10, Math.PI * 1.05, Math.PI * 2.35);
  ctx.quadraticCurveTo(c, c + 2, c, c + 8);
  ctx.stroke();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(c, c + 18, 4, 0, Math.PI * 2);
  ctx.fill();
};

const drawBook: Draw = (ctx, c) => {
  ctx.fillStyle = WHITE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c + side * 2, c - 16);
    ctx.quadraticCurveTo(c + side * 14, c - 22, c + side * 28, c - 18);
    ctx.lineTo(c + side * 28, c + 20);
    ctx.quadraticCurveTo(c + side * 14, c + 16, c + side * 2, c + 22);
    ctx.closePath();
    ctx.fill();
  }
};

const drawGear: Draw = (ctx, c) => {
  ctx.fillStyle = WHITE;
  const teeth = 8;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? c - 4 : c - 13;
    const half = Math.PI / (teeth * 2) * 0.55;
    ctx.lineTo(c + Math.cos(a - half) * r, c + Math.sin(a - half) * r);
    ctx.lineTo(c + Math.cos(a + half) * r, c + Math.sin(a + half) * r);
  }
  ctx.closePath();
  ctx.arc(c, c, 9, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
};

const drawPin: Draw = (ctx, c) => {
  // A pushpin leaning right: head, collar, needle.
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(Math.PI / 5);
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.ellipse(0, -18, 13, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-6, -14, 12, 16);
  ctx.beginPath();
  ctx.ellipse(0, 2, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = WHITE;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(0, 28);
  ctx.stroke();
  ctx.restore();
};

const drawLock: Draw = (ctx, c) => {
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(c, c - 6, 12, Math.PI, 0);
  ctx.lineTo(c + 12, c + 2);
  ctx.moveTo(c - 12, c + 2);
  ctx.lineTo(c - 12, c - 6);
  ctx.stroke();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.roundRect(c - 21, c - 2, 42, 32, 5);
  ctx.fill();
  // Keyhole, cut out.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(c, c + 10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(c - 2.5, c + 10, 5, 11);
  ctx.globalCompositeOperation = 'source-over';
};

const drawDice: Draw = (ctx, c) => {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.roundRect(c - 26, c - 26, 52, 52, 10);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  for (const [dx, dy] of [[-13, -13], [13, -13], [0, 0], [-13, 13], [13, 13]]) {
    ctx.beginPath();
    ctx.arc(c + dx, c + dy, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
};

const drawSort: Draw = (ctx, c) => {
  // Up and down arrows side by side: the Collection's sort-direction flip.
  ctx.fillStyle = WHITE;
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (const [x, up] of [[c - 12, true], [c + 12, false]] as const) {
    const tip = up ? c - 26 : c + 26;
    const base = up ? c - 8 : c + 8;
    ctx.beginPath();
    ctx.moveTo(x, tip);
    ctx.lineTo(x - 11, base);
    ctx.lineTo(x + 11, base);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, up ? c + 25 : c - 25);
    ctx.stroke();
  }
};

const drawPencil: Draw = (ctx, c) => {
  // A pencil on the diagonal, point at the lower left: the rename control.
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = WHITE;
  // Eraser cap, split from the barrel by a cut-out band.
  ctx.beginPath();
  ctx.roundRect(17, -9, 11, 18, 3);
  ctx.fill();
  ctx.fillRect(-13, -9, 27, 18);
  // The sharpened point, with its graphite tip cut out.
  ctx.beginPath();
  ctx.moveTo(-14, -9);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-14, 9);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(13.5, -10, 3, 20);
  ctx.beginPath();
  ctx.moveTo(-17, -4.5);
  ctx.lineTo(-17, 4.5);
  ctx.lineTo(-25, 1.6);
  ctx.lineTo(-25, -1.6);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(-24, -3.4);
  ctx.lineTo(-30, 0);
  ctx.lineTo(-24, 3.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/** Four corner brackets pointing out (enter full screen, M8) or in (leave it). */
const drawCorners = (outward: boolean): Draw => (ctx, c) => {
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const far = 24;
  const near = outward ? 10 : 6;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    // The bracket's corner sits at the far point (outward) or the near one (inward).
    const corner = outward ? far : near;
    const end = outward ? near : far;
    ctx.beginPath();
    ctx.moveTo(c + sx * end, c + sy * corner);
    ctx.lineTo(c + sx * corner, c + sy * corner);
    ctx.lineTo(c + sx * corner, c + sy * end);
    ctx.stroke();
  }
};

const DRAW: Record<UiIconName, Draw> = {
  gold: drawGold,
  profile: drawProfile,
  help: drawHelp,
  book: drawBook,
  gear: drawGear,
  pin: drawPin,
  lock: drawLock,
  dice: drawDice,
  sort: drawSort,
  pencil: drawPencil,
  expand: drawCorners(true),
  shrink: drawCorners(false),
};

export function bakeUiIcon(scene: Phaser.Scene, name: UiIconName): string {
  const key = uiIconKey(name);
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, SIZE, SIZE);
  if (!tex) return key;
  DRAW[name](tex.getContext(), SIZE / 2);
  tex.refresh();
  return key;
}
