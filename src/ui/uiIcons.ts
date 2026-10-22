import type Phaser from 'phaser';

/**
 * The game's drawn UI icons (2026-10-09 UI review, finding 20). They replace
 * emoji (🪙 👤 📖 📌 🔒 🎲), which every platform drew differently and none
 * drew to the game's style. Each is baked once to a canvas at twice its
 * largest display size. The coin keeps its own colours; the rest are white
 * silhouettes, tinted to the text they sit beside.
 */
export const UI_ICON_NAMES = ['gold', 'profile', 'help', 'book', 'gear', 'pin', 'lock', 'dice', 'sort', 'pencil', 'expand', 'shrink', 'shop', 'cards', 'deck', 'trophy', 'sword', 'chevron', 'info', 'back', 'check', 'external', 'play', 'copy', 'download', 'star', 'close', 'eye', 'search', 'filter', 'share', 'plus', 'minus', 'warning', 'history', 'turn', 'grave', 'bolt', 'scroll', 'hourglass', 'shield', 'flag', 'crown', 'swords', 'helm', 'eventScroll', 'purse', 'campfire', 'bossCrown', 'discord'] as const;
export type UiIconName = (typeof UI_ICON_NAMES)[number];

const SIZE = 64;

export function uiIconKey(name: UiIconName): string {
  return `ui-icon-${name}`;
}

/**
 * Whether the icon takes the colour of the text beside it: all but the coin,
 * which keeps its own colours, and the Discord mark, which Discord's brand
 * guidelines allow only in white, black or its own blurple.
 */
export function uiIconTinted(name: UiIconName): boolean {
  return name !== 'gold' && name !== 'discord';
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

// The Story map's stops (each struck on its medallion; the map's side panel names the stop).

/** Two blades crossed point-up, each with a crossguard and pommel (a fight). */
const drawSwords: Draw = (ctx, c) => {
  stroked(ctx);
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(c + s * 23, c - 23);
    ctx.lineTo(c - s * 9, c + 9);
    ctx.moveTo(c - s * 16, c + 4);
    ctx.lineTo(c - s * 4, c + 16);
    ctx.moveTo(c - s * 9, c + 9);
    ctx.lineTo(c - s * 17, c + 17);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c - s * 20, c + 20, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** A horned war helm with its visor cut out (an elite). */
const drawHelm: Draw = (ctx, c) => {
  ctx.fillStyle = WHITE;
  // Horns, sweeping up and out from the dome.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c + s * 13, c - 6);
    ctx.quadraticCurveTo(c + s * 27, c - 8, c + s * 27, c - 28);
    ctx.quadraticCurveTo(c + s * 21, c - 15, c + s * 9, c - 15);
    ctx.closePath();
    ctx.fill();
  }
  // Dome and cheek guards.
  ctx.beginPath();
  ctx.moveTo(c - 18, c + 24);
  ctx.lineTo(c - 18, c);
  ctx.arc(c, c, 18, Math.PI, 0);
  ctx.lineTo(c + 18, c + 24);
  ctx.lineTo(c + 6, c + 24);
  ctx.lineTo(c + 6, c + 14);
  ctx.lineTo(c - 6, c + 14);
  ctx.lineTo(c - 6, c + 24);
  ctx.closePath();
  ctx.fill();
  // Eye slits either side of the nose guard.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(c - 14, c + 2, 11, 6);
  ctx.fillRect(c + 3, c + 2, 11, 6);
  ctx.globalCompositeOperation = 'source-over';
};

/** A scroll, rolled at both ends, with a question mark on it (an event). */
const drawEventScroll: Draw = (ctx, c) => {
  stroked(ctx);
  ctx.lineWidth = 4;
  roundRect(ctx, c - 17, c - 20, 34, 40, 2);
  ctx.stroke();
  for (const y of [c - 22, c + 22]) {
    roundRect(ctx, c - 23, y - 4, 46, 8, 4);
    ctx.fill();
  }
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c - 5, 7, Math.PI * 1.1, Math.PI * 2.3);
  ctx.quadraticCurveTo(c, c + 1, c, c + 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c + 13, 3.2, 0, Math.PI * 2);
  ctx.fill();
};

/** A coin purse tied at the neck, a coin cut into its face (a shop). */
const drawPurse: Draw = (ctx, c) => {
  ctx.fillStyle = WHITE;
  // The gathered cloth above the tie.
  ctx.beginPath();
  ctx.moveTo(c - 8, c - 13);
  ctx.lineTo(c - 15, c - 25);
  ctx.quadraticCurveTo(c, c - 19, c + 15, c - 25);
  ctx.lineTo(c + 8, c - 13);
  ctx.closePath();
  ctx.fill();
  // The sack.
  ctx.beginPath();
  ctx.moveTo(c - 8, c - 10);
  ctx.bezierCurveTo(c - 30, c - 2, c - 28, c + 26, c, c + 26);
  ctx.bezierCurveTo(c + 28, c + 26, c + 30, c - 2, c + 8, c - 10);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  // The tie, a cut between cloth and sack.
  ctx.fillRect(c - 12, c - 13.5, 24, 3);
  // A coin stamped on the cloth.
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c, c + 9, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
};

/** A flame over two crossed logs (a rest). */
const drawCampfire: Draw = (ctx, c) => {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(c, c - 27);
  ctx.bezierCurveTo(c + 6, c - 16, c + 17, c - 10, c + 15, c + 2);
  ctx.bezierCurveTo(c + 14, c + 10, c + 7, c + 13, c, c + 13);
  ctx.bezierCurveTo(c - 7, c + 13, c - 14, c + 10, c - 15, c + 2);
  ctx.bezierCurveTo(c - 16, c - 8, c - 9, c - 11, c - 7, c - 19);
  ctx.bezierCurveTo(c - 3, c - 14, c - 2, c - 20, c, c - 27);
  ctx.closePath();
  ctx.fill();
  // The flame's heart, cut out.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(c + 1, c - 7);
  ctx.bezierCurveTo(c + 6, c - 1, c + 8, c + 3, c + 7, c + 6);
  ctx.bezierCurveTo(c + 6, c + 9, c + 3, c + 10, c, c + 10);
  ctx.bezierCurveTo(c - 3, c + 10, c - 6, c + 9, c - 7, c + 6);
  ctx.bezierCurveTo(c - 8, c + 1, c - 3, c - 1, c + 1, c - 7);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  stroked(ctx);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(c - 22, c + 25);
  ctx.lineTo(c + 22, c + 15);
  ctx.moveTo(c + 22, c + 25);
  ctx.lineTo(c - 22, c + 15);
  ctx.stroke();
};

/** A five-point crown on a band, jewels on its points (the boss). */
const drawBossCrown: Draw = (ctx, c) => {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(c - 22, c + 12);
  ctx.lineTo(c - 25, c - 12);
  ctx.lineTo(c - 12, c);
  ctx.lineTo(c, c - 18);
  ctx.lineTo(c + 12, c);
  ctx.lineTo(c + 25, c - 12);
  ctx.lineTo(c + 22, c + 12);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, c - 23, c + 14, 46, 9, 2);
  ctx.fill();
  for (const [x, y] of [[c - 25, c - 16], [c, c - 22], [c + 25, c - 16]]) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(c, c + 18.5, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
};

/**
 * The Discord mark (Clyde), white, from Discord's own artwork (path via Simple
 * Icons, CC0; the mark is Discord's trademark, used to link to the game's
 * server under Discord's brand guidelines; docs/legal/README.md). Unaltered:
 * only scaled and centred.
 */
const DISCORD_PATH = 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z';

/** The Discord mark, 24-unit artwork scaled to the 44 px span the other icons fill. */
const drawDiscord: Draw = (ctx, c) => {
  const scale = 44 / 24;
  ctx.save();
  ctx.translate(c - 12 * scale, c - 12 * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = WHITE;
  ctx.fill(new Path2D(DISCORD_PATH));
  ctx.restore();
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
  swords: drawSwords,
  helm: drawHelm,
  eventScroll: drawEventScroll,
  purse: drawPurse,
  campfire: drawCampfire,
  bossCrown: drawBossCrown,
  discord: drawDiscord,
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
