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

/**
 * Bake circular mana-pip textures once at boot: pip-W … pip-G, pip-C, pip-T.
 * The face of each bead is a hand-authored vector icon (src/art/iconPaths.ts)
 * filled via Path2D — no webfont dependency; generic-cost numerals stay Text
 * objects at the consumers.
 */
export function bakeManaSymbols(scene: Phaser.Scene): void {
  for (const key of Object.keys(PIP_COLORS) as IconKey[]) {
    const style = PIP_COLORS[key];
    const texKey = `pip-${key}`;
    if (scene.textures.exists(texKey)) continue;
    const tex = scene.textures.createCanvas(texKey, PIP_SIZE, PIP_SIZE)!;
    const ctx = tex.getContext();
    const c = PIP_SIZE / 2;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fillStyle = style.bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();
    // inner shading for a bead feel
    const g = ctx.createRadialGradient(c - 10, c - 13, 3, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fill();
    // Vector icon on top of the bead, in the fg color. evenodd fill: the
    // icon subpaths never overlap, so every nested subpath is a punched
    // hole (skull eyes, flame tongue, hexagon ring). pip-C stays faint so
    // the 13px generic-cost numeral drawn over it (CardView) stays legible.
    ctx.save();
    if (key === 'C') ctx.globalAlpha = 0.34;
    ctx.translate(c, c);
    const k = (PIP_SIZE / 100) * 0.78; // icon box is 100×100, centered 50,50
    ctx.scale(k, k);
    ctx.translate(-50, -50);
    ctx.fillStyle = style.fg;
    ctx.fill(new Path2D(ICON_PATHS[key]), 'evenodd');
    ctx.restore();
    tex.refresh();
  }
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
