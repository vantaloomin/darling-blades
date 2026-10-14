import type Phaser from 'phaser';

/**
 * The game's drawn UI icons (2026-10-09 UI review, finding 20). They replace
 * emoji (🪙 👤 📖 📌 🔒 🎲), which every platform drew differently and none
 * drew to the game's style. Each is baked once to a canvas at twice its
 * largest display size. The coin keeps its own colours; the rest are white
 * silhouettes, tinted to the text they sit beside.
 */
export const UI_ICON_NAMES = ['gold', 'profile', 'help', 'book', 'gear', 'pin', 'lock', 'dice', 'sort', 'pencil', 'expand', 'shrink', 'shop', 'cards', 'deck', 'trophy', 'sword', 'chevron', 'info', 'back', 'check', 'external', 'play', 'copy', 'download', 'star', 'close', 'eye', 'search', 'filter', 'share', 'plus', 'minus', 'warning', 'history', 'turn', 'grave', 'bolt', 'scroll', 'hourglass', 'shield', 'flag', 'crown'] as const;
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

/** Line icons for the compact main menu's rows (mock M-MainMenu): 5 px strokes, round ends. */
const stroked = (ctx: CanvasRenderingContext2D): void => {
  ctx.strokeStyle = WHITE;
  ctx.fillStyle = WHITE;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/** A shopfront: a framed panel with an awning line. */
const drawShop: Draw = (ctx, c) => {
  stroked(ctx);
  roundRect(ctx, c - 20, c - 24, 40, 48, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - 20, c - 10);
  ctx.lineTo(c + 20, c - 10);
  ctx.stroke();
};

/** Two cards, the back one peeking out on the right. */
const drawCards: Draw = (ctx, c) => {
  stroked(ctx);
  roundRect(ctx, c - 22, c - 22, 28, 40, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c + 12, c - 16);
  ctx.lineTo(c + 18, c - 16);
  ctx.arcTo(c + 22, c - 16, c + 22, c - 12, 4);
  ctx.lineTo(c + 22, c + 22);
  ctx.arcTo(c + 22, c + 26, c + 18, c + 26, 4);
  ctx.lineTo(c - 12, c + 26);
  ctx.stroke();
};

/** One upright card with a band across its foot. */
const drawDeck: Draw = (ctx, c) => {
  stroked(ctx);
  roundRect(ctx, c - 16, c - 24, 32, 48, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - 16, c + 12);
  ctx.lineTo(c + 16, c + 12);
  ctx.stroke();
};

/** A cup on a stem and foot, with handles. */
const drawTrophy: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.beginPath();
  ctx.moveTo(c - 15, c - 24);
  ctx.lineTo(c + 15, c - 24);
  ctx.lineTo(c + 15, c - 10);
  ctx.quadraticCurveTo(c + 15, c + 6, c, c + 6);
  ctx.quadraticCurveTo(c - 15, c + 6, c - 15, c - 10);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - 15, c - 18);
  ctx.quadraticCurveTo(c - 26, c - 18, c - 24, c - 8);
  ctx.quadraticCurveTo(c - 22, c - 2, c - 13, c - 2);
  ctx.moveTo(c + 15, c - 18);
  ctx.quadraticCurveTo(c + 26, c - 18, c + 24, c - 8);
  ctx.quadraticCurveTo(c + 22, c - 2, c + 13, c - 2);
  ctx.moveTo(c, c + 6);
  ctx.lineTo(c, c + 16);
  ctx.moveTo(c - 12, c + 24);
  ctx.lineTo(c + 12, c + 24);
  ctx.moveTo(c - 6, c + 16);
  ctx.lineTo(c + 6, c + 16);
  ctx.lineTo(c + 8, c + 24);
  ctx.moveTo(c - 6, c + 16);
  ctx.lineTo(c - 8, c + 24);
  ctx.stroke();
};

/** A blade on the diagonal, point at the top right, with a crossguard. */
const drawSword: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.beginPath();
  ctx.moveTo(c + 24, c - 24);
  ctx.lineTo(c - 8, c + 8);
  ctx.moveTo(c + 24, c - 24);
  ctx.lineTo(c + 14, c - 22);
  ctx.moveTo(c + 24, c - 24);
  ctx.lineTo(c + 22, c - 14);
  ctx.moveTo(c - 16, c);
  ctx.lineTo(c, c + 16);
  ctx.moveTo(c - 8, c + 8);
  ctx.lineTo(c - 22, c + 22);
  ctx.stroke();
};

/** A right-pointing chevron (a row that opens another screen). */
const drawChevron: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(c - 8, c - 18);
  ctx.lineTo(c + 10, c);
  ctx.lineTo(c - 8, c + 18);
  ctx.stroke();
};

/** A left-pointing chevron (the compact back control). */
const drawBack: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(c + 8, c - 18);
  ctx.lineTo(c - 10, c);
  ctx.lineTo(c + 8, c + 18);
  ctx.stroke();
};

/** A tick (the active deck, a claimed quest). */
const drawCheck: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(c - 16, c + 1);
  ctx.lineTo(c - 5, c + 12);
  ctx.lineTo(c + 17, c - 12);
  ctx.stroke();
};

/** A cross (closes a full-screen detail). */
const drawClose: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(c - 15, c - 15);
  ctx.lineTo(c + 15, c + 15);
  ctx.moveTo(c + 15, c - 15);
  ctx.lineTo(c - 15, c + 15);
  ctx.stroke();
};

/** A box with an arrow leaving it (a page that opens outside the game). */
const drawExternal: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(c - 2, c - 18);
  ctx.lineTo(c - 18, c - 18);
  ctx.lineTo(c - 18, c + 18);
  ctx.lineTo(c + 18, c + 18);
  ctx.lineTo(c + 18, c + 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - 2, c + 2);
  ctx.lineTo(c + 20, c - 20);
  ctx.moveTo(c + 6, c - 20);
  ctx.lineTo(c + 20, c - 20);
  ctx.lineTo(c + 20, c - 6);
  ctx.stroke();
};

/** A solid triangle pointing right (watch a replay). */
const drawPlay: Draw = (ctx, c) => {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(c - 13, c - 18);
  ctx.lineTo(c + 17, c);
  ctx.lineTo(c - 13, c + 18);
  ctx.closePath();
  ctx.fill();
};

/** Two overlapping sheets (copy to the clipboard). */
const drawCopy: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 5;
  roundRect(ctx, c - 10, c - 10, 28, 28, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c + 2, c - 18);
  ctx.lineTo(c - 18, c - 18);
  ctx.lineTo(c - 18, c + 2);
  ctx.stroke();
};

/** An arrow down onto a tray (save a file). */
const drawDownload: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(c, c - 20);
  ctx.lineTo(c, c + 8);
  ctx.moveTo(c - 11, c - 3);
  ctx.lineTo(c, c + 8);
  ctx.lineTo(c + 11, c - 3);
  ctx.moveTo(c - 19, c + 19);
  ctx.lineTo(c + 19, c + 19);
  ctx.stroke();
};

/** A five-point star outline (make something of your own). */
const drawStar: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 21 : 9;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = c + r * Math.cos(a);
    const y = c + 2 + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
};

/** A ringed "i" (How to play). */
const drawInfo: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c, c - 2);
  ctx.lineTo(c, c + 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c - 13, 3.5, 0, Math.PI * 2);
  ctx.fill();
};

/** An open eye (Preview deck). */
const drawEye: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(c - 24, c);
  ctx.quadraticCurveTo(c, c - 26, c + 24, c);
  ctx.quadraticCurveTo(c, c + 26, c - 24, c);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, 7, 0, Math.PI * 2);
  ctx.fill();
};

/** A lens with a handle (search, where the field folds away). */
const drawSearch: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c - 5, c - 5, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(c + 5, c + 5);
  ctx.lineTo(c + 18, c + 18);
  ctx.stroke();
};

/** A funnel (filters). */
const drawFilter: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(c - 20, c - 16);
  ctx.lineTo(c + 20, c - 16);
  ctx.lineTo(c + 5, c + 2);
  ctx.lineTo(c + 5, c + 18);
  ctx.lineTo(c - 5, c + 12);
  ctx.lineTo(c - 5, c + 2);
  ctx.closePath();
  ctx.stroke();
};

/** An arrow up out of a tray (share a deck code). */
const drawShare: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(c, c + 6);
  ctx.lineTo(c, c - 20);
  ctx.moveTo(c - 11, c - 9);
  ctx.lineTo(c, c - 20);
  ctx.lineTo(c + 11, c - 9);
  ctx.moveTo(c - 10, c - 2);
  ctx.lineTo(c - 18, c - 2);
  ctx.lineTo(c - 18, c + 19);
  ctx.lineTo(c + 18, c + 19);
  ctx.lineTo(c + 18, c - 2);
  ctx.lineTo(c + 10, c - 2);
  ctx.stroke();
};

/** A plus (add one, a new deck). */
const drawPlus: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(c, c - 17);
  ctx.lineTo(c, c + 17);
  ctx.moveTo(c - 17, c);
  ctx.lineTo(c + 17, c);
  ctx.stroke();
};

/** A minus (remove one). */
const drawMinus: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(c - 17, c);
  ctx.lineTo(c + 17, c);
  ctx.stroke();
};

/** A triangle with a bang (a deck that needs fixing). */
const drawWarning: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(c, c - 20);
  ctx.lineTo(c + 21, c + 17);
  ctx.lineTo(c - 21, c + 17);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c, c - 7);
  ctx.lineTo(c, c + 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c + 11, 3, 0, Math.PI * 2);
  ctx.fill();
};

/** A clock face whose rim turns back on itself: the duel's history. */
const drawHistory: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.beginPath();
  ctx.arc(c, c, 21, Math.PI * 0.95, Math.PI * 2.75);
  ctx.stroke();
  // The arrowhead where the rim begins, pointing back the way time ran.
  const ax = c + Math.cos(Math.PI * 0.95) * 21;
  const ay = c + Math.sin(Math.PI * 0.95) * 21;
  ctx.beginPath();
  ctx.moveTo(ax - 9, ay - 5);
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax + 4, ay - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c, c - 12);
  ctx.lineTo(c, c);
  ctx.lineTo(c + 9, c + 6);
  ctx.stroke();
};

/** A three-quarter turn with its arrowhead: a tapped permanent. */
const drawTurn: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(c, c + 3, 18, Math.PI * 1.1, Math.PI * 2.35);
  ctx.stroke();
  const ax = c + Math.cos(Math.PI * 1.1) * 18;
  const ay = c + 3 + Math.sin(Math.PI * 1.1) * 18;
  ctx.beginPath();
  ctx.moveTo(ax - 8, ay + 9);
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax + 10, ay + 5);
  ctx.stroke();
};

/** A rounded headstone on its plinth: the graveyard. */
const drawGrave: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.beginPath();
  ctx.moveTo(c - 14, c + 18);
  ctx.lineTo(c - 14, c - 8);
  ctx.arc(c, c - 8, 14, Math.PI, 0);
  ctx.lineTo(c + 14, c + 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - 22, c + 22);
  ctx.lineTo(c + 22, c + 22);
  ctx.moveTo(c, c - 10);
  ctx.lineTo(c, c + 6);
  ctx.moveTo(c - 6, c - 4);
  ctx.lineTo(c + 6, c - 4);
  ctx.stroke();
};

/** An outlined lightning bolt: a Charm, cast at any window. */
const drawBolt: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(c + 5, c - 26);
  ctx.lineTo(c - 15, c + 4);
  ctx.lineTo(c - 1, c + 4);
  ctx.lineTo(c - 5, c + 26);
  ctx.lineTo(c + 15, c - 4);
  ctx.lineTo(c + 1, c - 4);
  ctx.closePath();
  ctx.stroke();
};

/** A scroll with a curled head: a Ritual. */
const drawScroll: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 4.5;
  roundRect(ctx, c - 15, c - 20, 30, 38, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - 8, c - 8);
  ctx.lineTo(c + 8, c - 8);
  ctx.moveTo(c - 8, c + 1);
  ctx.lineTo(c + 8, c + 1);
  ctx.moveTo(c - 8, c + 10);
  ctx.lineTo(c + 3, c + 10);
  ctx.stroke();
};

/** An hourglass: waiting on the other side. */
const drawHourglass: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.beginPath();
  ctx.moveTo(c - 16, c - 24);
  ctx.lineTo(c + 16, c - 24);
  ctx.moveTo(c - 16, c + 24);
  ctx.lineTo(c + 16, c + 24);
  ctx.moveTo(c - 12, c - 24);
  ctx.lineTo(c + 12, c + 24);
  ctx.moveTo(c + 12, c - 24);
  ctx.lineTo(c - 12, c + 24);
  ctx.stroke();
};

/** A heater shield: a creature blocking. */
const drawShield: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.beginPath();
  ctx.moveTo(c, c - 24);
  ctx.lineTo(c + 20, c - 16);
  ctx.lineTo(c + 18, c + 4);
  ctx.quadraticCurveTo(c + 14, c + 18, c, c + 26);
  ctx.quadraticCurveTo(c - 14, c + 18, c - 18, c + 4);
  ctx.lineTo(c - 20, c - 16);
  ctx.closePath();
  ctx.stroke();
};

/** A flag on its pole: conceding. */
const drawFlag: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.beginPath();
  ctx.moveTo(c - 14, c + 26);
  ctx.lineTo(c - 14, c - 24);
  ctx.lineTo(c + 18, c - 24);
  ctx.lineTo(c + 18, c - 2);
  ctx.lineTo(c - 14, c - 2);
  ctx.stroke();
};

/** A three-pointed crown: a legendary creature. */
const drawCrown: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.beginPath();
  ctx.moveTo(c - 22, c + 18);
  ctx.lineTo(c - 24, c - 14);
  ctx.lineTo(c - 10, c);
  ctx.lineTo(c, c - 20);
  ctx.lineTo(c + 10, c);
  ctx.lineTo(c + 24, c - 14);
  ctx.lineTo(c + 22, c + 18);
  ctx.closePath();
  ctx.stroke();
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
  shop: drawShop,
  cards: drawCards,
  deck: drawDeck,
  trophy: drawTrophy,
  sword: drawSword,
  chevron: drawChevron,
  info: drawInfo,
  back: drawBack,
  check: drawCheck,
  external: drawExternal,
  play: drawPlay,
  copy: drawCopy,
  download: drawDownload,
  star: drawStar,
  close: drawClose,
  eye: drawEye,
  search: drawSearch,
  filter: drawFilter,
  share: drawShare,
  plus: drawPlus,
  minus: drawMinus,
  warning: drawWarning,
  history: drawHistory,
  turn: drawTurn,
  grave: drawGrave,
  bolt: drawBolt,
  scroll: drawScroll,
  hourglass: drawHourglass,
  shield: drawShield,
  flag: drawFlag,
  crown: drawCrown,
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
