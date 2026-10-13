import type Phaser from 'phaser';
import type { StoryNodeKind } from '../data/story/types';
import { STORY_SPEAKERS } from '../data/story/script';
import { portraitArtId } from './storyDialogue';
import { theme } from './theme';
import type { UiIconName } from './uiIcons';

/**
 * The Story map's stops as struck medallions (owner request 2026-10-13: icons,
 * not words; circles, not squares). Each kind has its own icon and tint
 * (`theme.storyStop`), a raised rim, a bevelled face and a drop shadow, baked
 * once per kind, state and contrast setting to a canvas at twice its display
 * size. A stop the run has passed through is pressed (the bevel inverted, the
 * face darker); one it can no longer reach is greyed. The boss's face is her
 * dialogue portrait in a gold ring, or the crown when the art is not loaded.
 * The map's side panel names the stop; the medallion itself carries no word.
 */

export const STOP_ICON: Readonly<Record<StoryNodeKind, UiIconName>> = {
  fight: 'swords',
  elite: 'helm',
  event: 'scroll',
  shop: 'purse',
  rest: 'campfire',
  boss: 'crown',
};

/** How a stop is drawn: as it stands, pressed (passed through), or greyed (out of reach). */
export type StopFace = 'live' | 'pressed' | 'locked';

/**
 * Every node the run can still reach: from the start, all of them; otherwise
 * whatever lies forward of the current node along its edges.
 */
export function reachableNodeIds(
  nodes: readonly { id: string; nextNodeIds: readonly string[] }[],
  currentId: string | null,
): Set<string> {
  if (currentId === null) return new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const queue = [...(byId.get(currentId)?.nextNodeIds ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(byId.get(id)?.nextNodeIds ?? []));
  }
  return seen;
}

/** A stop's face: visited ones pressed, ones the run cannot reach greyed, the rest live. */
export function stopFace(id: string, visited: ReadonlySet<string>, reachable: ReadonlySet<string>): StopFace {
  if (visited.has(id)) return 'pressed';
  return reachable.has(id) ? 'live' : 'locked';
}

/**
 * The dots of a trail between two medallions (centres and radii), spaced about
 * `pitch` apart, clear of both rims by `margin`.
 */
export function trailDots(
  a: { x: number; y: number }, ra: number,
  b: { x: number; y: number }, rb: number,
  pitch: number, margin = 4,
): { x: number; y: number }[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const start = ra + margin;
  const run = len - rb - margin - start;
  if (run <= 0) return [];
  const n = Math.max(1, Math.round(run / pitch));
  const dots: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (start + (run * i) / n) / len;
    dots.push({ x: a.x + dx * t, y: a.y + dy * t });
  }
  return dots;
}

/** The dialogue portrait (default expression) of the speaker an avatar is, by name; null if she has none. */
export function bossPortraitArtId(avatarName: string): string | null {
  const speaker = STORY_SPEAKERS.find((s) => s.name === avatarName);
  return speaker ? portraitArtId(speaker.id, speaker.expressions[0]) : null;
}

/**
 * Where the face sits in a story portrait (fractions of the image: the
 * square crop's centre and side as a share of the width). The portraits are
 * 2:3 busts with the face a little under the top quarter.
 */
export const PORTRAIT_FACE_CROP = { cx: 0.52, cy: 0.3, side: 0.35 } as const;

// ------------------------------------------------------------------ baking

const RES = 2;

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `hex` moved toward white (t > 0) or black (t < 0). */
function shade(hex: string, t: number): string {
  const target = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return `#${hexRgb(hex).map((v) => Math.round(v + (target - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

/** The canvas margin round a medallion for its shadow and the glow rings drawn over it. */
export function stopPad(diameter: number): number {
  return Math.round(diameter * 0.18);
}

function circle(ctx: CanvasRenderingContext2D, c: number, r: number): void {
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
}

/** Rim, groove and shadow: everything but the face. Returns the face's radius. */
function drawRim(ctx: CanvasRenderingContext2D, c: number, r: number, rim: string, face: StopFace, highContrast: boolean): number {
  // The drop shadow, cast down and a little soft; a pressed stop sits lower.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = (face === 'pressed' ? 3 : 7) * RES;
  ctx.shadowOffsetY = (face === 'pressed' ? 1 : 3.5) * RES;
  circle(ctx, c, r);
  ctx.fillStyle = shade(rim, -0.5);
  ctx.fill();
  ctx.restore();
  // The rim: lit from the top.
  const g = ctx.createLinearGradient(0, c - r, 0, c + r);
  g.addColorStop(0, shade(rim, 0.45));
  g.addColorStop(0.45, rim);
  g.addColorStop(1, shade(rim, -0.5));
  circle(ctx, c, r);
  ctx.fillStyle = g;
  ctx.fill();
  // A fine highlight on the rim's top edge.
  ctx.beginPath();
  ctx.arc(c, c, r - 1.2 * RES, Math.PI * 1.12, Math.PI * 1.88);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1.2 * RES;
  ctx.stroke();
  // The groove between rim and face.
  const inner = r * 0.8;
  circle(ctx, c, inner);
  ctx.fillStyle = shade(rim, -0.68);
  ctx.fill();
  if (highContrast) {
    circle(ctx, c, r - 0.9 * RES);
    ctx.strokeStyle = theme.colors.heading;
    ctx.lineWidth = 1.8 * RES;
    ctx.stroke();
  }
  return inner - 1.5 * RES;
}

/** The face's inner bevel: light above and dark below when raised, the other way round when pressed. */
function drawBevel(ctx: CanvasRenderingContext2D, c: number, r: number, pressed: boolean): void {
  const light = 'rgba(255, 255, 255, 0.38)';
  const dark = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 1.6 * RES;
  ctx.beginPath();
  ctx.arc(c, c, r - 0.9 * RES, Math.PI * 1.05, Math.PI * 1.95);
  ctx.strokeStyle = pressed ? dark : light;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, r - 0.9 * RES, Math.PI * 0.05, Math.PI * 0.95);
  ctx.strokeStyle = pressed ? light : dark;
  ctx.stroke();
}

/** A kind's tints for a face: greyed when out of reach, the rim dulled and the face sunk when pressed. */
function stopColours(kind: StoryNodeKind, face: StopFace): { face: string; rim: string } {
  if (face === 'locked') return theme.storyStop.locked;
  const tint = theme.storyStop[kind];
  return face === 'pressed' ? { face: shade(tint.face, -0.42), rim: shade(tint.rim, -0.38) } : tint;
}

/** Bake (once) a stop's medallion without its icon, `diameter` px across; the texture includes `stopPad` on every side. */
export function bakeStopMedallion(scene: Phaser.Scene, kind: StoryNodeKind, face: StopFace, diameter: number, highContrast: boolean): string {
  const key = `story-stop-${kind}-${face}-${diameter}${highContrast ? '-hc' : ''}`;
  if (scene.textures.exists(key)) return key;
  const size = (diameter + 2 * stopPad(diameter)) * RES;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return key;
  const ctx = tex.getContext();
  const c = size / 2;
  const r = (diameter / 2) * RES;
  const colours = stopColours(kind, face);
  const fr = drawRim(ctx, c, r, colours.rim, face, highContrast);
  const pressed = face === 'pressed';
  const base = colours.face;
  const g = ctx.createRadialGradient(c - fr * 0.3, c - fr * (pressed ? -0.35 : 0.4), fr * 0.1, c, c, fr * 1.05);
  g.addColorStop(0, shade(base, pressed ? 0.08 : 0.3));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade(base, -0.4));
  circle(ctx, c, fr);
  ctx.fillStyle = g;
  ctx.fill();
  drawBevel(ctx, c, fr, pressed);
  tex.refresh();
  return key;
}

/**
 * Bake (once) the boss's medallion with her portrait's face clipped into it,
 * from a loaded texture; null when the texture is missing (the caller draws
 * the plain medallion and the crown instead).
 */
export function bakeBossPortraitMedallion(scene: Phaser.Scene, textureKey: string, face: StopFace, diameter: number, highContrast: boolean): string | null {
  if (!scene.textures.exists(textureKey)) return null;
  const key = `story-stop-portrait-${textureKey}-${face}-${diameter}${highContrast ? '-hc' : ''}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(textureKey).getSourceImage() as CanvasImageSource & { width: number; height: number };
  if (!source || !source.width) return null;
  const size = (diameter + 2 * stopPad(diameter)) * RES;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return null;
  const ctx = tex.getContext();
  const c = size / 2;
  const r = (diameter / 2) * RES;
  const colours = stopColours('boss', face);
  const fr = drawRim(ctx, c, r, colours.rim, face, highContrast);
  // The face behind the art (the portraits are cut out), then the crop.
  const g = ctx.createRadialGradient(c, c - fr * 0.3, fr * 0.1, c, c, fr);
  g.addColorStop(0, shade(theme.storyStop.boss.rim, -0.55));
  g.addColorStop(1, theme.storyStop.boss.face);
  ctx.save();
  circle(ctx, c, fr);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(c - fr, c - fr, fr * 2, fr * 2);
  const side = source.width * PORTRAIT_FACE_CROP.side;
  const sx = source.width * PORTRAIT_FACE_CROP.cx - side / 2;
  const sy = source.height * PORTRAIT_FACE_CROP.cy - side / 2;
  if (face === 'locked') ctx.filter = 'grayscale(1) brightness(0.7)';
  ctx.drawImage(source, sx, sy, side, side, c - fr, c - fr, fr * 2, fr * 2);
  ctx.filter = 'none';
  // A soft vignette so the rim's edge reads over the art.
  const v = ctx.createRadialGradient(c, c, fr * 0.6, c, c, fr);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(c - fr, c - fr, fr * 2, fr * 2);
  ctx.restore();
  // The inner gold ring.
  circle(ctx, c, fr);
  ctx.strokeStyle = shade(theme.storyStop.boss.rim, 0.2);
  ctx.lineWidth = 1.6 * RES;
  ctx.stroke();
  drawBevel(ctx, c, fr, face === 'pressed');
  tex.refresh();
  return key;
}

/** Bake (once) a soft white halo `diameter` px across (tinted gold behind the Next stops and round "You"). */
export function bakeStopGlow(scene: Phaser.Scene, diameter: number): string {
  const key = `story-stop-glow-${diameter}`;
  if (scene.textures.exists(key)) return key;
  const size = diameter * RES;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return key;
  const ctx = tex.getContext();
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, c * 0.45, c, c, c);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  g.addColorStop(0.35, 'rgba(255, 255, 255, 0.5)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return key;
}
