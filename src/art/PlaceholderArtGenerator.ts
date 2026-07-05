import type { CardDef, Color } from '../engine/types';
import { isType } from '../engine/types';
import { SeededRandom } from './SeededRandom';
import { emblemFor, TRIBE_EMBLEMS } from './TribeEmblems';

export const ART_W = 320;
export const ART_H = 400;

/** Color-identity palettes: [gradient top, gradient bottom, accent]. */
const PALETTES: Record<Color | 'C' | 'gold' | 'land', [string, string, string]> = {
  W: ['#f2e8cf', '#c9a84c', '#fffef2'],
  U: ['#4a90d9', '#16294f', '#a8d4f7'],
  B: ['#5a3a70', '#140d1c', '#9b6fc4'],
  R: ['#d95436', '#5e0f0f', '#f7b267'],
  G: ['#4fa06a', '#123a22', '#a9dcae'],
  C: ['#a9adb5', '#4e535c', '#dfe3ea'],
  gold: ['#e8c95a', '#7a5a18', '#fff2b8'],
  land: ['#b09468', '#4a3a26', '#e0cfa8'],
};

const HAIR_SHAPES = [
  'long',
  'ponytail',
  'twintails',
  'bun',
  'short',
  'foxears',
  'horns',
] as const;

export function paletteFor(d: CardDef): [string, string, string] {
  if (isType(d, 'land')) return PALETTES.land;
  if (d.colors.length >= 2) return PALETTES.gold;
  if (d.colors.length === 0) return PALETTES.C;
  return PALETTES[d.colors[0]];
}

/**
 * Draws a card's deterministic placeholder art onto a 2D canvas context at
 * (0,0)–(320,400): color-identity gradient, seeded decorative pattern, tribe
 * emblem, character bust silhouette (creatures) with a seeded hair/feature
 * shape, embossed monogram, and a sub-faction corner ribbon.
 */
export function drawPlaceholderArt(ctx: CanvasRenderingContext2D, d: CardDef): void {
  const rnd = new SeededRandom(d.artRef ?? d.id);
  const [top, bottom, accent] = paletteFor(d);

  // 1. Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, ART_H);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ART_W, ART_H);

  // 2. Seeded decorative pattern (1 of 5)
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = accent;
  ctx.fillStyle = accent;
  const pattern = rnd.int(5);
  switch (pattern) {
    case 0: {
      // diagonal rays
      ctx.lineWidth = 10;
      const off = rnd.range(0, 60);
      for (let x = -ART_H; x < ART_W + ART_H; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x + off, 0);
        ctx.lineTo(x + off + ART_H, ART_H);
        ctx.stroke();
      }
      break;
    }
    case 1: {
      // concentric arcs
      ctx.lineWidth = 5;
      const cx = rnd.range(60, 260);
      const cy = rnd.range(60, 160);
      for (let r = 30; r < 420; r += 34) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 2: {
      // hex lattice
      ctx.lineWidth = 3;
      const s = 30;
      for (let row = -1; row < 10; row++) {
        for (let col = -1; col < 8; col++) {
          const cx = col * s * 1.75 + (row % 2 ? s * 0.875 : 0);
          const cy = row * s * 1.5;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i + Math.PI / 6;
            const px = cx + Math.cos(a) * s;
            const py = cy + Math.sin(a) * s;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;
    }
    case 3: {
      // cloud scrolls
      ctx.lineWidth = 6;
      for (let i = 0; i < 7; i++) {
        const cx = rnd.range(20, 300);
        const cy = rnd.range(20, 380);
        const r = rnd.range(14, 30);
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI * 0.2, Math.PI * 1.6);
        ctx.arc(cx + r * 1.2, cy - r * 0.35, r * 0.6, Math.PI, Math.PI * 2.4);
        ctx.stroke();
      }
      break;
    }
    default: {
      // meander key strip
      ctx.lineWidth = 5;
      const y0 = rnd.range(40, 320);
      ctx.beginPath();
      let x = -10;
      const y = y0;
      while (x < ART_W + 10) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 18, y);
        ctx.lineTo(x + 18, y - 18);
        ctx.lineTo(x + 36, y - 18);
        ctx.lineTo(x + 36, y);
        x += 36;
      }
      ctx.stroke();
      break;
    }
  }
  ctx.restore();

  // 3. Tribe emblem, large and centered
  const emblemKey = emblemFor(d.subtypes, d.types);
  const isCharacter = isType(d, 'creature');
  ctx.save();
  ctx.globalAlpha = isCharacter ? 0.16 : 0.32;
  ctx.fillStyle = accent;
  const scale = isCharacter ? 2.6 : 3.1;
  ctx.translate(ART_W / 2 - 50 * scale, (isCharacter ? 120 : ART_H / 2) - 50 * scale);
  ctx.scale(scale, scale);
  ctx.fill(new Path2D(TRIBE_EMBLEMS[emblemKey]));
  ctx.restore();

  // 4. Character bust silhouette (creatures only)
  if (isCharacter) {
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = shade(bottom, -22);
    const cx = ART_W / 2;
    const headY = 190;
    const headR = 52;

    const hair = rnd.pick(HAIR_SHAPES);
    // hair behind the head
    ctx.beginPath();
    switch (hair) {
      case 'long':
        ctx.ellipse(cx, headY + 60, headR + 26, 130, 0, 0, Math.PI * 2);
        break;
      case 'ponytail':
        ctx.ellipse(cx, headY - 6, headR + 12, headR + 16, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + headR + 22, headY + 46, 20, 72, -0.28, 0, Math.PI * 2);
        break;
      case 'twintails':
        ctx.ellipse(cx, headY - 6, headR + 12, headR + 14, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - headR - 26, headY + 40, 17, 78, 0.3, 0, Math.PI * 2);
        ctx.ellipse(cx + headR + 26, headY + 40, 17, 78, -0.3, 0, Math.PI * 2);
        break;
      case 'bun':
        ctx.ellipse(cx, headY - 8, headR + 10, headR + 12, 0, 0, Math.PI * 2);
        ctx.arc(cx, headY - headR - 22, 22, 0, Math.PI * 2);
        break;
      case 'short':
        ctx.ellipse(cx, headY - 10, headR + 14, headR + 10, 0, 0, Math.PI * 2);
        break;
      case 'foxears':
        ctx.ellipse(cx, headY - 4, headR + 10, headR + 12, 0, 0, Math.PI * 2);
        ctx.moveTo(cx - headR + 4, headY - headR + 6);
        ctx.lineTo(cx - headR - 16, headY - headR - 44);
        ctx.lineTo(cx - 10, headY - headR - 6);
        ctx.moveTo(cx + headR - 4, headY - headR + 6);
        ctx.lineTo(cx + headR + 16, headY - headR - 44);
        ctx.lineTo(cx + 10, headY - headR - 6);
        break;
      case 'horns':
        ctx.ellipse(cx, headY - 4, headR + 10, headR + 12, 0, 0, Math.PI * 2);
        ctx.moveTo(cx - headR + 6, headY - headR);
        ctx.quadraticCurveTo(cx - headR - 34, headY - headR - 20, cx - headR - 18, headY - headR - 56);
        ctx.quadraticCurveTo(cx - headR - 6, headY - headR - 24, cx - headR + 22, headY - headR - 12);
        ctx.moveTo(cx + headR - 6, headY - headR);
        ctx.quadraticCurveTo(cx + headR + 34, headY - headR - 20, cx + headR + 18, headY - headR - 56);
        ctx.quadraticCurveTo(cx + headR + 6, headY - headR - 24, cx + headR - 22, headY - headR - 12);
        break;
    }
    ctx.fill();

    // head
    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    // neck + shoulders
    ctx.beginPath();
    ctx.moveTo(cx - 16, headY + headR - 8);
    ctx.lineTo(cx + 16, headY + headR - 8);
    ctx.lineTo(cx + 22, headY + headR + 26);
    ctx.lineTo(cx - 22, headY + headR + 26);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 100, ART_H);
    ctx.quadraticCurveTo(cx - 92, headY + headR + 18, cx - 30, headY + headR + 16);
    ctx.lineTo(cx + 30, headY + headR + 16);
    ctx.quadraticCurveTo(cx + 92, headY + headR + 18, cx + 100, ART_H);
    ctx.closePath();
    ctx.fill();

    // rim light on the silhouette
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, headY, headR, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  // 5. Embossed monogram, bottom-right
  const initials = (d.name.match(/\p{Lu}/gu) ?? [d.name[0]]).slice(0, 2).join('');
  ctx.save();
  ctx.font = '700 64px Cinzel, Georgia, serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = shade(bottom, -30);
  ctx.fillText(initials, ART_W - 16, ART_H - 18);
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = accent;
  ctx.fillText(initials, ART_W - 18, ART_H - 21);
  ctx.restore();

  // 6. Corner ribbon accent
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(64, 0);
  ctx.lineTo(0, 64);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = shade(bottom, -18);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(46, 0);
  ctx.lineTo(0, 46);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Lighten (+) / darken (−) a #rrggbb color by `amt` (0–100). */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number): number =>
    Math.max(0, Math.min(255, Math.round(v + (amt / 100) * 255)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
