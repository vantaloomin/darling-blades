import type Phaser from 'phaser';
import { bakeCardFrames } from '../../../../src/ui/CardFrameFactory';
import { bakeManaSymbols, ensureNumeralPip } from '../../../../src/ui/ManaSymbols';
const store: Record<string, HTMLCanvasElement> = {};
// A stand-in scene: just enough of the texture manager for the bake functions.
const scene = { textures: {
  exists: (k: string) => k in store,
  createCanvas: (k: string, w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; store[k] = c; const ctx = c.getContext('2d')!; return { getContext: () => ctx, refresh: () => {}, context: ctx }; },
  get: () => ({ getSourceImage: () => document.createElement('canvas') }),
} } as unknown as Phaser.Scene;
bakeCardFrames(scene);
bakeManaSymbols(scene);
for (let n=0;n<=9;n++) ensureNumeralPip(scene,n);
const out: Record<string, string> = {};
for (const [k, c] of Object.entries(store)) if (/^(frame-|pt-plate|crown|seticon-base|pip-)/.test(k)) out[k] = c.toDataURL('image/png');
const pre = document.createElement('pre'); pre.id = 'out'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
