import type Phaser from 'phaser';
import type { FrameStyle } from '../meta/variants';

/**
 * Bakes card frame textures once at boot, drawn at 2× (600×840) so frames
 * stay crisp when CardViews scale down. Eight bases: one per color identity
 * plus gold (multicolor), colorless/artifact, and land. Rarity rings, the P/T
 * plate, rarity gems, the legendary crown, and the variant frame wash are
 * separate overlay textures.
 */

export const FRAME_W = 600;
export const FRAME_H = 840;

interface FramePalette {
  edge: string; // outer border metal
  faceTop: string;
  faceBottom: string;
  panel: string; // name/type band fill
  text: string; // textbox parchment
  accent: string;
}

const FRAME_PALETTES: Record<string, FramePalette> = {
  W: { edge: '#8d7b45', faceTop: '#f0e7cd', faceBottom: '#b6a05e', panel: '#fdf8e7', text: '#f7f1dc', accent: '#7a6428' },
  U: { edge: '#274a73', faceTop: '#6ea3d8', faceBottom: '#1d3a5f', panel: '#dcebf7', text: '#e8f1f9', accent: '#173c66' },
  B: { edge: '#3c2b4a', faceTop: '#6d5a80', faceBottom: '#221631', panel: '#d9d2e0', text: '#e4dfe9', accent: '#2c1a3d' },
  R: { edge: '#6e2318', faceTop: '#d97a5a', faceBottom: '#5e1410', panel: '#f6ded3', text: '#f9e8de', accent: '#5e150d' },
  G: { edge: '#2a5232', faceTop: '#7fb98a', faceBottom: '#1c3f26', panel: '#ddecdc', text: '#e9f2e5', accent: '#1c4526' },
  gold: { edge: '#8a6d1f', faceTop: '#eed77a', faceBottom: '#8a6a20', panel: '#faf0c8', text: '#f9f2d4', accent: '#6e5314' },
  C: { edge: '#565b63', faceTop: '#b9bdc4', faceBottom: '#5f646d', panel: '#e6e8ec', text: '#eceef1', accent: '#43474e' },
  land: { edge: '#5c4c34', faceTop: '#c3ab7e', faceBottom: '#57452c', panel: '#efe4c8', text: '#f2ead2', accent: '#4c3d24' },
};

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Procedural card back (the fallback when no real card-back art is on disk). */
function bakeProceduralCardBack(ctx: CanvasRenderingContext2D): void {
  rr(ctx, 0, 0, FRAME_W, FRAME_H, 34);
  ctx.fillStyle = '#141318';
  ctx.fill();
  const g = ctx.createRadialGradient(FRAME_W / 2, FRAME_H / 2, 40, FRAME_W / 2, FRAME_H / 2, 560);
  g.addColorStop(0, '#3a2a55');
  g.addColorStop(1, '#171024');
  rr(ctx, 14, 14, FRAME_W - 28, FRAME_H - 28, 26);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#8a6d1f';
  ctx.stroke();
  rr(ctx, 34, 34, FRAME_W - 68, FRAME_H - 68, 20);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(200,170,80,0.5)';
  ctx.stroke();
  // central diamond sigil
  ctx.save();
  ctx.translate(FRAME_W / 2, FRAME_H / 2);
  for (const [r, alpha] of [
    [150, 0.5],
    [110, 0.7],
    [70, 0.95],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.72, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.72, 0);
    ctx.closePath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = `rgba(212, 175, 55, ${alpha})`;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fillStyle = '#d4af37';
  ctx.fill();
  ctx.restore();
}

/**
 * Real card-back art (docs/scene-art.md `card-back`): cover-crop the 640×800
 * source into the 600×840 canvas inside the rounded-rect clip (r 34). Cutting
 * ≈34px off each side — the doc keeps all border ornament inside x 34–606.
 */
function bakeRealCardBack(scene: Phaser.Scene, ctx: CanvasRenderingContext2D): void {
  const src = scene.textures.get('scene-card-back').getSourceImage() as CanvasImageSource;
  const sw = (src as { width: number }).width;
  const sh = (src as { height: number }).height;
  ctx.save();
  rr(ctx, 0, 0, FRAME_W, FRAME_H, 34);
  ctx.clip();
  // Cover-fit: scale up to fill both axes, center-crop the overflow.
  const scale = Math.max(FRAME_W / sw, FRAME_H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, (FRAME_W - dw) / 2, (FRAME_H - dh) / 2, dw, dh);
  ctx.restore();
}

export function bakeCardFrames(scene: Phaser.Scene): void {
  for (const [key, pal] of Object.entries(FRAME_PALETTES)) {
    const texKey = `frame-${key}`;
    if (scene.textures.exists(texKey)) continue;
    const tex = scene.textures.createCanvas(texKey, FRAME_W, FRAME_H)!;
    const ctx = tex.getContext();

    // Card body
    rr(ctx, 0, 0, FRAME_W, FRAME_H, 34);
    ctx.fillStyle = '#141318';
    ctx.fill();

    // Outer metal edge
    rr(ctx, 6, 6, FRAME_W - 12, FRAME_H - 12, 30);
    ctx.lineWidth = 10;
    ctx.strokeStyle = pal.edge;
    ctx.stroke();

    // Face gradient
    const face = ctx.createLinearGradient(0, 0, 0, FRAME_H);
    face.addColorStop(0, pal.faceTop);
    face.addColorStop(1, pal.faceBottom);
    rr(ctx, 18, 18, FRAME_W - 36, FRAME_H - 36, 24);
    ctx.fillStyle = face;
    ctx.fill();

    // Name band
    rr(ctx, 32, 30, FRAME_W - 64, 52, 14);
    ctx.fillStyle = pal.panel;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.accent;
    ctx.stroke();

    // Art window (near-black backing; art renders on top)
    rr(ctx, 36, 92, FRAME_W - 72, 384, 10);
    ctx.fillStyle = '#0a090d';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = pal.accent;
    ctx.stroke();

    // Type band
    rr(ctx, 32, 488, FRAME_W - 64, 44, 12);
    ctx.fillStyle = pal.panel;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.accent;
    ctx.stroke();

    // Text box
    rr(ctx, 32, 544, FRAME_W - 64, 260, 12);
    ctx.fillStyle = pal.text;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.accent;
    ctx.stroke();

    tex.refresh();
  }

  // P/T plate (only shown on creatures)
  if (!scene.textures.exists('pt-plate')) {
    const tex = scene.textures.createCanvas('pt-plate', 150, 62)!;
    const ctx = tex.getContext();
    rr(ctx, 2, 2, 146, 58, 16);
    const g = ctx.createLinearGradient(0, 0, 0, 62);
    g.addColorStop(0, '#efe6cf');
    g.addColorStop(1, '#b5a06a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#4c4022';
    ctx.stroke();
    tex.refresh();
  }

  // Rarity ring — white rounded-rect ring; tinted (uncommon) or shader-cycled (rare)
  if (!scene.textures.exists('frame-ring')) {
    const tex = scene.textures.createCanvas('frame-ring', FRAME_W, FRAME_H)!;
    const ctx = tex.getContext();
    rr(ctx, 8, 8, FRAME_W - 16, FRAME_H - 16, 30);
    ctx.lineWidth = 13;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    tex.refresh();
  }

  // Variant frame wash — a WHITE card-shaped overlay with the art window cut
  // out, tinted+alpha'd per frame style at the Image level (one parameterized
  // bake instead of one bake per FrameStyle). Covers the face and panels but
  // never the art; texts sit above it in CardView's child order.
  if (!scene.textures.exists('frame-tint')) {
    const tex = scene.textures.createCanvas('frame-tint', FRAME_W, FRAME_H)!;
    const ctx = tex.getContext();
    rr(ctx, 6, 6, FRAME_W - 12, FRAME_H - 12, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // cut the art window out (same rect the frame bake uses)
    ctx.globalCompositeOperation = 'destination-out';
    rr(ctx, 36, 92, FRAME_W - 72, 384, 10);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    tex.refresh();
  }

  // Rarity gems — one per tier (proper redesign is wave 2; same diamond bake)
  const gems: [string, string, string][] = [
    ['gem-c', '#2b2b30', '#101013'], // grey
    ['gem-r', '#dfe6f2', '#7d8aa3'], // silver-blue
    ['gem-sr', '#ffe08a', '#b8860b'], // gold
    ['gem-ssr', '#d9a8ff', '#5c1d8a'], // violet
    ['gem-ur', '#ff9a8a', '#7a0e2e'], // crimson
  ];
  for (const [key, light, dark] of gems) {
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, 40, 40)!;
    const ctx = tex.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    ctx.beginPath();
    ctx.moveTo(20, 2);
    ctx.lineTo(38, 20);
    ctx.lineTo(20, 38);
    ctx.lineTo(2, 20);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    tex.refresh();
  }

  // Card back — real art when the scene-art PNG is on disk (docs/scene-art.md
  // `card-back`), else the procedural dark-violet/gold-sigil back. Both bake
  // into the same 600×840 `cardback` canvas; CardView needs no change.
  if (!scene.textures.exists('cardback')) {
    const tex = scene.textures.createCanvas('cardback', FRAME_W, FRAME_H)!;
    const ctx = tex.getContext();
    if (scene.textures.exists('scene-card-back')) {
      bakeRealCardBack(scene, ctx);
    } else {
      bakeProceduralCardBack(ctx);
    }
    tex.refresh();
  }

  // Legendary crown
  if (!scene.textures.exists('crown')) {
    const tex = scene.textures.createCanvas('crown', 120, 44)!;
    const ctx = tex.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 44);
    g.addColorStop(0, '#ffe9a0');
    g.addColorStop(1, '#b8860b');
    ctx.beginPath();
    ctx.moveTo(8, 38);
    ctx.lineTo(4, 12);
    ctx.lineTo(30, 26);
    ctx.lineTo(46, 6);
    ctx.lineTo(60, 22);
    ctx.lineTo(74, 6);
    ctx.lineTo(90, 26);
    ctx.lineTo(116, 12);
    ctx.lineTo(112, 38);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#5e4a10';
    ctx.stroke();
    tex.refresh();
  }
}

/**
 * Axis-B frame treatments (per-copy variant cosmetics, src/meta/variants.ts).
 * All six styles reuse TWO baked textures — the white `frame-ring` and the
 * white `frame-tint` wash — parameterized by tint/alpha here, instead of six
 * separate bakes. `white` is the standard frame: no ring, no wash.
 */
export interface FrameTreatment {
  /** `frame-ring` tint (null = no ring — the standard frame). */
  ring: number | null;
  /** `frame-tint` wash tint over the frame, never the art (null = none). */
  wash: number | null;
  washAlpha: number;
  /** metallic shine sweep on the ring (gold's luster; fx:'full' + WebGL). */
  luster: boolean;
  /** animated RGB-cycle ring (IridescencePostFX mode 0 / tint-cycle fallback). */
  rainbow: boolean;
}

export const FRAME_TREATMENTS: Record<FrameStyle, FrameTreatment> = {
  white: { ring: null, wash: null, washAlpha: 0, luster: false, rainbow: false },
  blue: { ring: 0x4d8fe0, wash: 0x6699dd, washAlpha: 0.16, luster: false, rainbow: false },
  red: { ring: 0xe0604d, wash: 0xdd7755, washAlpha: 0.16, luster: false, rainbow: false },
  gold: { ring: 0xffd44a, wash: 0xd4af37, washAlpha: 0.14, luster: true, rainbow: false },
  rainbow: { ring: 0xffffff, wash: null, washAlpha: 0, luster: false, rainbow: true },
  black: { ring: 0x17171c, wash: 0x000000, washAlpha: 0.28, luster: false, rainbow: false },
};

export function frameKeyFor(colors: readonly string[], types: readonly string[]): string {
  if (types.includes('land')) return 'frame-land';
  if (colors.length >= 2) return 'frame-gold';
  if (colors.length === 0) return 'frame-C';
  return `frame-${colors[0]}`;
}
