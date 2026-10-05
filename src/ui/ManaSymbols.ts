import type Phaser from 'phaser';
import type { ManaCost } from '../engine/types';
import { ICON_PATHS, type IconKey } from '../art/iconPaths';
import { NUMERAL_PATHS, numeralLayout } from '../art/numeralPaths';

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

/** Generic-cost numeral ink: darker than the C key's fg, so the digit keeps
 * the contrast the old Text overlay had on the grey bead. */
const NUMERAL_INK = '#2b2f36';

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
 * filled via Path2D — no webfont dependency. Generic-cost beads carrying a
 * number are baked on demand by `ensureNumeralPip`.
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
    // Plain pip-C ({C} colorless mana, the empty mana-strip placeholder)
    // keeps a faint crystal; numbered generic beads are pip-C-<n>.
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

/** Texture key of the generic-cost bead printed with `n`. Pure, so
 * segmenters and cost layouts can name it before a scene bakes it. */
export function numeralPipKey(n: number): string {
  return `pip-C-${n}`;
}

/**
 * Bake (once) and return the texture key for a generic-cost bead printed
 * with `n`: the grey C bead and its shading, then the digits as vector paths
 * (src/art/numeralPaths.ts) laid out by `numeralLayout`, which centres the
 * group's real ink box on the bead centre. No webfont and no Text overlay,
 * so the numeral sits the same before and after Cinzel loads, and every
 * consumer (card faces, rules text, prompts, thumbnails) shares one bake.
 * The faint crystal icon is left off numeral beads: the digit is the whole
 * message, and the hexagon's edges would cross two-digit groups at 16px.
 */
export function ensureNumeralPip(scene: Phaser.Scene, n: number): string {
  const texKey = numeralPipKey(n);
  if (scene.textures.exists(texKey)) return texKey;
  const tex = scene.textures.createCanvas(texKey, PIP_SIZE, PIP_SIZE)!;
  const ctx = tex.getContext();
  const c = PIP_SIZE / 2;
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.fillStyle = PIP_COLORS.C.bg;
  ctx.fill();
  finishBead(ctx);
  const layout = numeralLayout(n, PIP_SIZE);
  ctx.fillStyle = NUMERAL_INK;
  for (const glyph of layout.glyphs) {
    ctx.save();
    ctx.translate(glyph.tx, glyph.ty);
    ctx.scale(layout.k, layout.k);
    ctx.fill(new Path2D(NUMERAL_PATHS[glyph.digit]), 'evenodd');
    ctx.restore();
  }
  tex.refresh();
  return texKey;
}

export interface PipSpec {
  texture: string;
  /** Generic amount. `texture` is then its numeral bead, which a consumer
   * bakes with `ensureNumeralPip(scene, number)` before drawing it. */
  number?: number;
}

/** Right-to-left pip order for a cost: colored pips first (rightmost), generic last. */
export function pipsFor(cost: ManaCost): PipSpec[] {
  const out: PipSpec[] = [];
  if (cost.generic > 0) out.push({ texture: numeralPipKey(cost.generic), number: cost.generic });
  for (const c of ['W', 'U', 'B', 'R', 'G'] as const) {
    for (let i = 0; i < (cost.pips[c] ?? 0); i++) out.push({ texture: `pip-${c}` });
  }
  return out;
}
