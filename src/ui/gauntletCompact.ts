/**
 * The Avatar Gauntlet's compact (phone) composition, Phaser-free (mocks
 * M-Gauntlet, M-GauntletFresh, M-GauntletAbandon; docs/plan-mobile-overhaul.md,
 * mobile wave 2).
 *
 * Left: the selected rung's rival, large, with her deck's theme under her.
 * Centre: who she is, the rung's stars and brain, her blurb, the reward, the
 * record and the run's seed, with the run's own actions at the foot (Abandon
 * run, or Reroll and Set for a fresh run). The command column: the tower,
 * scrolling, opened on the current rung, with Fight (or Begin run) at its foot.
 * Coordinates are compact design px inside the content box.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';

export const GAUNTLET_COMPACT = {
  /** The rival's column: a share of the main pane, inside a floor and ceiling. */
  heroShare: 0.34,
  heroMin: 130,
  heroMax: 170,
  /** Portrait height over width (the mock's 163 x 222). */
  portraitAspect: 1.36,
  /** Between the rival's column and the centre's text. */
  infoGap: 12,
  /** Between two stacked lines of the centre's text. */
  lineGap: 4,
  /** A tower row (the touch floor) and the gap between two rows. */
  rowH: 44,
  rowGap: 8,
} as const;

export interface CompactGauntletLayout {
  shell: CompactShell;
  /** The rival's column (portrait, then her deck's theme). */
  hero: Rect;
  /** The centre's text column, its foot row included. */
  info: Rect;
  /** The run's actions row at the centre's foot (Abandon run, or Reroll and Set). */
  actions: Rect;
  /** Where the tower scrolls (above the primary). */
  tower: Rect;
  /** Fight / Begin run, the column's foot. */
  launch: Rect;
}

export function compactGauntletLayout(content: Rect): CompactGauntletLayout {
  const G = GAUNTLET_COMPACT;
  const shell = compactShell(content, { back: true });
  const main = shell.main;
  const column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };
  const heroW = Math.round(Math.min(G.heroMax, Math.max(G.heroMin, main.width * G.heroShare)));
  const hero = { x: main.x, y: main.y, width: heroW, height: main.height };
  const infoX = main.x + heroW + G.infoGap;
  const info = { x: infoX, y: main.y, width: Math.max(0, main.x + main.width - infoX), height: main.height };
  const actions = { x: info.x, y: info.y + info.height - COMPACT.touch, width: info.width, height: COMPACT.touch };
  const launch = shell.primary?.visual ?? { x: column.x, y: column.y + column.height - COMPACT.touch, width: column.width, height: COMPACT.touch };
  const tower = { x: column.x, y: column.y, width: column.width, height: Math.max(0, launch.y - COMPACT.gap - column.y) };
  return { shell, hero, info, actions, tower, launch };
}

export interface GauntletInfoStack {
  /** Tops of the lines stacked down from the centre's top (name, title, rung). */
  topYs: number[];
  /** The blurb's viewport between the two stacks. */
  blurb: Rect;
  /** Tops of the lines stacked up from the actions row (reward, record, seed, lineup). */
  bottomYs: number[];
}

/**
 * Stack the centre's measured lines: `top` from the column's top down, `bottom`
 * up from the actions row, and the blurb in what is left between them (it
 * scrolls when it runs longer).
 */
export function gauntletInfoStack(info: Rect, actionsTop: number, top: readonly number[], bottom: readonly number[]): GauntletInfoStack {
  const gap = GAUNTLET_COMPACT.lineGap;
  let y = info.y;
  const topYs = top.map((h) => {
    const at = y;
    y += h + gap;
    return at;
  });
  const blurbTop = y;
  let b = actionsTop - COMPACT.gap;
  const bottomYs = [...bottom].reverse().map((h) => {
    b -= h;
    const at = b;
    b -= gap;
    return at;
  }).reverse();
  const blurbBottom = b;
  return { topYs, blurb: { x: info.x, y: blurbTop, width: info.width, height: Math.max(0, blurbBottom - blurbTop) }, bottomYs };
}

/** A tower row's top inside the scrolled content, rungs bottom-up (the top rung first). */
export function gauntletRowTop(rung: number, rungs: number): number {
  return (rungs - rung) * (GAUNTLET_COMPACT.rowH + GAUNTLET_COMPACT.rowGap);
}

/** The tower's content height. */
export function gauntletTowerHeight(rungs: number): number {
  return rungs > 0 ? rungs * GAUNTLET_COMPACT.rowH + (rungs - 1) * GAUNTLET_COMPACT.rowGap : 0;
}

/** The scroll offset that centres `rung` in a viewport `height` tall, clamped to the content. */
export function gauntletTowerOffset(rung: number, rungs: number, height: number): number {
  const max = Math.max(0, gauntletTowerHeight(rungs) - height);
  const centred = gauntletRowTop(rung, rungs) - (height - GAUNTLET_COMPACT.rowH) / 2;
  return Math.max(0, Math.min(max, Math.round(centred)));
}
