import type Phaser from 'phaser';
import type { ManaCost } from '../engine/types';
import { ICON_PATHS, type IconKey } from '../art/iconPaths';

const PIP_COLORS: Record<IconKey, { bg: string; fg: string }> = {
  W: { bg: '#f5ecd2', fg: '#5b4a1e' },
  U: { bg: '#8fc4ea', fg: '#123a63' },
  B: { bg: '#b7a5c4', fg: '#1d1226' },
  R: { bg: '#f0a08a', fg: '#611111' },
  G: { bg: '#a8d3a4', fg: '#123f1f' },
  C: { bg: '#cfd2d8', fg: '#3d4148' },
  T: { bg: '#ddd3b8', fg: '#463a22' }, // parchment/neutral tap bead
};

export const PIP_SIZE = 64; // baked ~3×; consumers setDisplaySize down (16–48px)

/** Outline stroke + radial "bead" shading shared by every pip baker — one
 * place to tune the bead look so mono and split pips never drift apart. */
function finishBead(ctx: CanvasRenderingContext2D): void {
  const c = PIP_SIZE / 2;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.stroke();
  const g = ctx.createRadialGradient(c - 10, c - 13, 3, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fill();
}

/** Vector icon on top of a bead, in the key's fg color. evenodd fill: the
 * icon subpaths never overlap, so every nested subpath is a punched hole
 * (skull eyes, flame tongue, hexagon ring). Icon box is 100×100 centered on
 * (50,50); `scale` is relative to the bead diameter. */
function drawIcon(
  ctx: CanvasRenderingContext2D,
  key: IconKey,
  cx: number,
  cy: number,
  scale: number,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  const k = (PIP_SIZE / 100) * scale;
  ctx.scale(k, k);
  ctx.translate(-50, -50);
  ctx.fillStyle = PIP_COLORS[key].fg;
  ctx.fill(new Path2D(ICON_PATHS[key]), 'evenodd');
  ctx.restore();
}

/**
 * Bake circular mana-pip textures once at boot: pip-W … pip-G, pip-C, pip-T.
 * The face of each bead is a hand-authored vector icon (src/art/iconPaths.ts)
 * filled via Path2D — no webfont dependency; generic-cost numerals stay Text
 * objects at the consumers.
 */
export function bakeManaSymbols(scene: Phaser.Scene): void {
  for (const key of Object.keys(PIP_COLORS) as IconKey[]) {
    const texKey = `pip-${key}`;
    if (scene.textures.exists(texKey)) continue;
    const tex = scene.textures.createCanvas(texKey, PIP_SIZE, PIP_SIZE)!;
    const ctx = tex.getContext();
    const c = PIP_SIZE / 2;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fillStyle = PIP_COLORS[key].bg;
    ctx.fill();
    finishBead(ctx);
    // pip-C stays faint so the 13px generic-cost numeral drawn over it
    // (CardView) stays legible.
    drawIcon(ctx, key, c, c, 0.78, key === 'C' ? 0.34 : 1);
    tex.refresh();
  }
}

/**
 * Bake (once) and return the texture key for a flexible mana source's split
 * pip: the bead is divided into equal wedges, one per producible color, so a
 * dual land reads as ONE bead that makes either color — full side-by-side
 * pips read as "provides both" (user-reported 2026-07-12). Two-color beads
 * split on the diagonal like MTG hybrid symbols and carry both mini icons;
 * 3+ colors (the rainbow artifact) get plain wedges. Callers pass colors in
 * canonical WUBRG order so one color PAIR is always one texture.
 */
export function ensureSplitPip(scene: Phaser.Scene, colors: readonly IconKey[]): string {
  const texKey = `pip-${colors.join('')}`;
  if (scene.textures.exists(texKey)) return texKey;
  const tex = scene.textures.createCanvas(texKey, PIP_SIZE, PIP_SIZE)!;
  const ctx = tex.getContext();
  const c = PIP_SIZE / 2;
  const n = colors.length;
  const start = n === 2 ? (-3 * Math.PI) / 4 : -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a0 = start + (i * 2 * Math.PI) / n;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, c - 2, a0, a0 + (2 * Math.PI) / n);
    ctx.closePath();
    ctx.fillStyle = PIP_COLORS[colors[i]].bg;
    ctx.fill();
  }
  finishBead(ctx);
  if (n === 2) {
    // one mini icon per half, offset along the split's normal (up-right /
    // down-left of the top-left→bottom-right diagonal)
    const d = PIP_SIZE * 0.19;
    drawIcon(ctx, colors[0], c + d, c - d, 0.4);
    drawIcon(ctx, colors[1], c - d, c + d, 0.4);
  }
  tex.refresh();
  return texKey;
}

export interface PipSpec {
  texture: string;
  number?: number; // generic amount rendered as a Text on top
}

/** Right-to-left pip order for a cost: colored pips first (rightmost), generic last. */
export function pipsFor(cost: ManaCost): PipSpec[] {
  const out: PipSpec[] = [];
  if (cost.generic > 0) out.push({ texture: 'pip-C', number: cost.generic });
  for (const c of ['W', 'U', 'B', 'R', 'G'] as const) {
    for (let i = 0; i < (cost.pips[c] ?? 0); i++) out.push({ texture: `pip-${c}` });
  }
  return out;
}
