/**
 * The Limited hub's compact composition, Phaser-free (mocks S-Limited-Hub,
 * S-Limited-Run, S-Limited-Retire; docs/plan-mobile-overhaul.md, wave 4).
 *
 * The main pane: the format's one-paragraph rules, the active run's panel (the
 * next rival's portrait beside its status while matches are being played),
 * and the draft records, scrolling, under them. The command column: New Run
 * with the Premium Draft entry as a card and Free Draft as the gold foot; with
 * a run active both entries are shown off and the foot is Retire run beside
 * Continue. One composition serves the phone and the desktop: sizes are
 * compact design px inside the content box.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';

export const LIMITED_COMPACT = {
  /** A panel's inner inset. */
  pad: 12,
  /** The run panel's portrait: width over height (the mock's 100 x 128). */
  portraitAspect: 100 / 128,
  portraitH: 128,
  /** A record row and the gap under it. */
  get rowH(): number { return COMPACT.touch; },
  rowGap: 4,
  /** Retire run's share of the foot beside Continue (the mock's 104 of 230). */
  retireShare: 0.45,
  /** The Premium Draft card's floor. */
  premiumMinH: 96,
} as const;

export interface LimitedHubLayout {
  shell: CompactShell;
  /** The rules paragraph's box, at its measured height. */
  intro: Rect;
  /** The active run's panel. */
  run: Rect;
  /** The run panel's portrait (inside `run`), or null with no rival to show. */
  portrait: Rect | null;
  /** Where the run panel's text starts and how wide it may run. */
  runText: Rect;
  /** The records panel, under the run panel to the pane's foot. */
  records: Rect;
  /** The command column. */
  column: Rect;
  /** The column's foot: one gold action, or Retire and Continue side by side. */
  foot: Rect;
  retire: Rect;
  next: Rect;
}

/**
 * `introH` is the rules paragraph's measured height and `runTextH` the run
 * panel's measured text stack; `portrait` asks for the rival's portrait, which
 * sets the panel's floor.
 */
export function limitedHubLayout(content: Rect, introH: number, runTextH: number, portrait: boolean): LimitedHubLayout {
  const L = LIMITED_COMPACT;
  const shell = compactShell(content, { back: true });
  const main = shell.main;
  const column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };
  const intro = { x: main.x, y: main.y, width: main.width, height: introH };
  const runTop = intro.y + introH + COMPACT.gap;
  // The run panel never takes more than half of what is left, so the records keep room to show.
  const room = main.y + main.height - runTop;
  const portraitH = portrait ? Math.min(L.portraitH, Math.floor(room / 2) - 2 * L.pad) : 0;
  const runH = Math.min(Math.max(runTextH, portraitH) + 2 * L.pad, Math.floor(room / 2));
  const run = { x: main.x, y: runTop, width: main.width, height: runH };
  const pic = portrait && portraitH > 0
    ? { x: run.x + L.pad, y: run.y + L.pad, width: Math.round(portraitH * L.portraitAspect), height: portraitH }
    : null;
  const textX = pic ? pic.x + pic.width + L.pad : run.x + L.pad;
  const runText = { x: textX, y: run.y + L.pad, width: Math.max(0, run.x + run.width - L.pad - textX), height: runH - 2 * L.pad };
  const recordsTop = run.y + runH + COMPACT.gap;
  const records = { x: main.x, y: recordsTop, width: main.width, height: Math.max(0, main.y + main.height - recordsTop) };
  const foot = shell.primary?.visual ?? { x: column.x, y: column.y + column.height - COMPACT.primaryH, width: column.width, height: COMPACT.primaryH };
  const retireW = Math.round(foot.width * L.retireShare);
  const retire = { ...foot, width: retireW };
  const next = { ...foot, x: foot.x + retireW + COMPACT.gap, width: foot.width - retireW - COMPACT.gap };
  return { shell, intro, run, portrait: pic, runText, records, column, foot, retire, next };
}
