import type Phaser from 'phaser';
import type { FrameStyle } from '../meta/variants';
import { CARD_BACKS, DEFAULT_CARD_BACK_ID, cardBackTextureKey } from '../meta/cosmetics';
import { SET_ICON_PATHS, type CardSetId } from '../art/setIcons';

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
interface CardBackStyle {
  shell: string;
  innerTop: string;
  innerBottom: string;
  accent: string;
  softAccent: string;
  sigil: 'storm' | 'veil' | 'storybook' | 'neon';
}

const CARD_BACK_STYLES: Record<string, CardBackStyle> = {
  'back-ragnarok-storm-gold': {
    shell: '#17120d',
    innerTop: '#70531f',
    innerBottom: '#24180d',
    accent: '#f1c35b',
    softAccent: 'rgba(241,195,91,0.52)',
    sigil: 'storm',
  },
  'back-silver-veil-moonlit': {
    shell: '#0d1420',
    innerTop: '#324b70',
    innerBottom: '#101b31',
    accent: '#c4e0ff',
    softAccent: 'rgba(196,224,255,0.5)',
    sigil: 'veil',
  },
  'back-dark-tales-storybook': {
    shell: '#1a1018',
    innerTop: '#6b314f',
    innerBottom: '#261020',
    accent: '#e2a2bd',
    softAccent: 'rgba(226,162,189,0.48)',
    sigil: 'storybook',
  },
  'back-yokai-neon': {
    shell: '#071516',
    innerTop: '#0b5554',
    innerBottom: '#071d27',
    accent: '#68f3dc',
    softAccent: 'rgba(104,243,220,0.48)',
    sigil: 'neon',
  },
};

/** Every non-default back keeps the rounded card silhouette and gold border,
 * then changes its palette and centered sigil treatment. */
function bakeStyledCardBack(ctx: CanvasRenderingContext2D, style: CardBackStyle): void {
  rr(ctx, 0, 0, FRAME_W, FRAME_H, 34);
  ctx.fillStyle = style.shell;
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, FRAME_H);
  g.addColorStop(0, style.innerTop);
  g.addColorStop(1, style.innerBottom);
  rr(ctx, 14, 14, FRAME_W - 28, FRAME_H - 28, 26);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#8a6d1f';
  ctx.stroke();
  rr(ctx, 34, 34, FRAME_W - 68, FRAME_H - 68, 20);
  ctx.lineWidth = 3;
  ctx.strokeStyle = style.softAccent;
  ctx.stroke();

  ctx.save();
  ctx.translate(FRAME_W / 2, FRAME_H / 2);
  ctx.strokeStyle = style.accent;
  ctx.fillStyle = style.accent;
  ctx.lineCap = 'round';
  if (style.sigil === 'storm') {
    ctx.beginPath();
    ctx.moveTo(-24, -138);
    ctx.lineTo(20, -30);
    ctx.lineTo(-10, -30);
    ctx.lineTo(34, 138);
    ctx.lineTo(-20, 26);
    ctx.lineTo(8, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (style.sigil === 'veil') {
    ctx.beginPath();
    ctx.arc(0, 0, 116, -0.8, 2.2);
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(38, -26, 88, -0.75, 2.1);
    ctx.lineWidth = 5;
    ctx.strokeStyle = style.softAccent;
    ctx.stroke();
  } else if (style.sigil === 'storybook') {
    rr(ctx, -86, -126, 172, 252, 12);
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -112);
    ctx.lineTo(0, 112);
    ctx.moveTo(-58, -54);
    ctx.lineTo(-22, -80);
    ctx.moveTo(22, 74);
    ctx.lineTo(60, 48);
    ctx.lineWidth = 6;
    ctx.strokeStyle = style.softAccent;
    ctx.stroke();
  } else {
    for (const [x, y, radius] of [[-74, -72, 22], [76, -38, 14], [-52, 82, 15], [62, 72, 24]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-112, 0);
    ctx.lineTo(112, 0);
    ctx.lineWidth = 4;
    ctx.strokeStyle = style.softAccent;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The scene-art key for one card back. The default's asset is `card-back`; the
 * cosmetics are `card-<entry.id>`, whose ids already start with `back-`.
 */
function cardBackArtKey(entryId: string): string {
  return entryId === DEFAULT_CARD_BACK_ID ? 'scene-card-back' : `scene-card-${entryId}`;
}

function bakeRealCardBack(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, artKey: string): void {
  const src = scene.textures.get(artKey).getSourceImage() as CanvasImageSource;
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

  // Set symbols, MTG-style: the SHAPE names the set (src/art/setIcons.ts —
  // heart-and-blade for base, Mjölnir for Ragnarök, crescent-veil for Celtic
  // Fae, royal crown for Arthurian Court), the FILL tint names the rarity tier.
  // Replaced the old uniform
  // diamond gems (user-directed 2026-07-12); the tier gradients carry over.
  const tierTints: [string, string, string][] = [
    ['c', '#3a3a41', '#141417'], // grey (a touch lighter than the old gem — silhouettes need it)
    ['r', '#dfe6f2', '#7d8aa3'], // silver-blue
    ['sr', '#ffe08a', '#b8860b'], // gold
    ['ssr', '#d9a8ff', '#5c1d8a'], // violet
    ['ur', '#ff9a8a', '#7a0e2e'], // crimson
  ];
  for (const set of Object.keys(SET_ICON_PATHS) as CardSetId[]) {
    const path = new Path2D(SET_ICON_PATHS[set]);
    for (const [tier, light, dark] of tierTints) {
      const key = `seticon-${set}-${tier}`;
      if (scene.textures.exists(key)) continue;
      const tex = scene.textures.createCanvas(key, 40, 40)!;
      const ctx = tex.getContext();
      // gradient in ICON space (0..100): it is painted under the transform
      const g = ctx.createLinearGradient(0, 0, 0, 100);
      g.addColorStop(0, light);
      g.addColorStop(1, dark);
      ctx.save();
      ctx.translate(2, 2);
      ctx.scale(0.36, 0.36); // 100-box icon into a 36px area with 2px margin
      ctx.fillStyle = g;
      ctx.fill(path, 'evenodd');
      // dark contour so light tiers hold up on the parchment textbox
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.stroke(path);
      ctx.restore();
      tex.refresh();
    }
  }

  // Card back — real art when the scene-art WebP is on disk (docs/scene-art.md
  // `card-back`), else the procedural dark-violet/gold-sigil back. Both bake
  // into the same 600×840 `cardback` canvas; CardView needs no change.
  for (const entry of CARD_BACKS) {
    const textureKey = cardBackTextureKey(entry.id);
    if (scene.textures.exists(textureKey)) continue;
    const tex = scene.textures.createCanvas(textureKey, FRAME_W, FRAME_H)!;
    const ctx = tex.getContext();
    // Real art when the scene-art WebP is on disk, else the procedural painting.
    // Every back got real art on 2026-08-24; the procedural paths stay as the
    // fallback for a build where the art payload has not loaded.
    const artKey = cardBackArtKey(entry.id);
    if (scene.textures.exists(artKey)) {
      bakeRealCardBack(scene, ctx, artKey);
    } else if (entry.id === DEFAULT_CARD_BACK_ID) {
      bakeProceduralCardBack(ctx);
    } else {
      bakeStyledCardBack(ctx, CARD_BACK_STYLES[entry.id]);
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
