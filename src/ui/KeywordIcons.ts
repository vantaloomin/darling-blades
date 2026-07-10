import type Phaser from 'phaser';
import type { Keyword } from '../engine/types';
import { theme } from './theme';

export const KEYWORD_ICON_SIZE = 44;

/** Texture keys are total over the engine keyword union: future keywords must add an icon. */
export const KEYWORD_ICON_KEY: Record<Keyword, string> = {
  skyborne: 'keyword-skyborne',
  wardingGaze: 'keyword-wardingGaze',
  firstBlade: 'keyword-firstBlade',
  twinBlades: 'keyword-twinBlades',
  warcry: 'keyword-warcry',
  overrun: 'keyword-overrun',
  sentinel: 'keyword-sentinel',
  bulwark: 'keyword-bulwark',
  deathblade: 'keyword-deathblade',
  bloodoath: 'keyword-bloodoath',
  untouchable: 'keyword-untouchable',
};

/** Deliberately bold silhouettes; these are read at a 16px display size. */
const KEYWORD_ICON_PATH: Record<Keyword, string> = {
  skyborne: 'M4 24 L15 15 L22 22 L29 15 L40 24 L35 32 L27 28 L22 35 L17 28 L9 32 Z',
  wardingGaze: 'M3 22 Q12 9 22 9 Q32 9 41 22 Q32 35 22 35 Q12 35 3 22 Z M17 22 A5 5 0 1 0 27 22 A5 5 0 1 0 17 22',
  firstBlade: 'M22 4 L28 19 L25 37 L19 37 L16 19 Z M18 20 L26 20 L22 25 Z',
  twinBlades: 'M8 6 L14 20 L31 37 L26 42 L10 25 L4 11 Z M36 6 L40 11 L34 25 L18 42 L13 37 L30 20 Z',
  warcry: 'M5 18 L16 18 L22 10 L22 34 L16 26 L5 26 Z M27 15 Q37 22 27 29 L30 25 Q35 22 30 19 Z',
  overrun: 'M4 25 L25 25 L25 17 L41 22 L25 27 L25 31 L12 31 Z',
  sentinel: 'M11 8 L33 8 L39 17 L36 37 L22 42 L8 37 L5 17 Z M10 23 Q16 17 22 17 Q28 17 34 23 Q28 29 22 29 Q16 29 10 23 Z M19 23 A3 3 0 1 0 25 23 A3 3 0 1 0 19 23',
  bulwark: 'M22 3 L38 10 L35 30 Q31 38 22 42 Q13 38 9 30 L6 10 Z M22 9 L22 35',
  deathblade: 'M22 3 L28 17 L25 30 L22 38 L19 30 L16 17 Z M15 29 Q22 24 29 29 L29 37 L25 41 L19 41 L15 37 Z M18 32 A2 2 0 1 0 22 32 A2 2 0 1 0 18 32 M22 32 A2 2 0 1 0 26 32 A2 2 0 1 0 22 32',
  bloodoath: 'M22 3 C22 3 10 19 10 28 A12 12 0 0 0 34 28 C34 19 22 3 22 3 Z',
  untouchable: 'M5 7 L39 37 M39 7 L5 37 M8 10 Q22 1 36 10 L39 22 Q34 37 22 42 Q10 37 5 22 Z',
};

/** Bake one small dark trait chip per keyword. Safe to call on every scene create/restart. */
export function bakeKeywordIcons(scene: Phaser.Scene): void {
  for (const keyword of Object.keys(KEYWORD_ICON_KEY) as Keyword[]) {
    const key = KEYWORD_ICON_KEY[keyword];
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, KEYWORD_ICON_SIZE, KEYWORD_ICON_SIZE)!;
    const ctx = tex.getContext();
    const m = 2;
    const r = 8;
    const s = KEYWORD_ICON_SIZE;
    ctx.beginPath();
    ctx.moveTo(m + r, m);
    ctx.lineTo(s - m - r, m);
    ctx.quadraticCurveTo(s - m, m, s - m, m + r);
    ctx.lineTo(s - m, s - m - r);
    ctx.quadraticCurveTo(s - m, s - m, s - m - r, s - m);
    ctx.lineTo(m + r, s - m);
    ctx.quadraticCurveTo(m, s - m, m, s - m - r);
    ctx.lineTo(m, m + r);
    ctx.quadraticCurveTo(m, m, m + r, m);
    ctx.fillStyle = theme.colors.rowFill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.colors.panelStroke;
    ctx.stroke();
    ctx.fillStyle = theme.colors.gold;
    ctx.fill(new Path2D(KEYWORD_ICON_PATH[keyword]), 'evenodd');
    tex.refresh();
  }
}
