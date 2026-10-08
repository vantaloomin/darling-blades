import type { AnimationLevel } from '../platform/animPolicy';
import { theme } from './theme';

export interface AchievementClaimMotion {
  stampMs: number;
  settleMs: number;
  staggerMs: number;
  scaleFrom: number;
  angleFrom: number;
  angleTo: number;
}

const CLAIM_MOTION: Record<AnimationLevel, AchievementClaimMotion> = {
  full: {
    stampMs: theme.motion.base,
    settleMs: theme.motion.fast,
    staggerMs: 70,
    scaleFrom: 1.12,
    angleFrom: -8,
    angleTo: -3,
  },
  reduced: {
    stampMs: theme.motion.fast,
    settleMs: 0,
    staggerMs: 50,
    scaleFrom: 1,
    angleFrom: 0,
    angleTo: 0,
  },
  off: {
    stampMs: 0,
    settleMs: 0,
    staggerMs: 0,
    scaleFrom: 1,
    angleFrom: 0,
    angleTo: 0,
  },
};

export function achievementClaimMotion(level: AnimationLevel): AchievementClaimMotion {
  return CLAIM_MOTION[level];
}

export function achievementCascadeDelay(index: number, level: AnimationLevel): number {
  return Math.max(0, index) * CLAIM_MOTION[level].staggerMs;
}

export function achievementCascadeDuration(count: number, level: AnimationLevel): number {
  if (count <= 0) return 0;
  const motion = CLAIM_MOTION[level];
  return achievementCascadeDelay(count - 1, level) + motion.stampMs + motion.settleMs;
}

/** Rise by a perfect fifth from the first seal to the last. */
export function achievementClaimPitch(index: number, count: number): number {
  if (count <= 1) return 1;
  const position = Math.min(1, Math.max(0, index / (count - 1)));
  return 2 ** ((position * 7) / 12);
}

// ── Trophy Hall (Wave C): five wings, one per bucket ─────────────────────────

export const HALL_BUCKETS = ['collection', 'variants', 'theme', 'mastery', 'economy'] as const;
export type HallBucket = (typeof HALL_BUCKETS)[number];

export interface WingStatusLite {
  def: { id: string; bucket: string };
  unlocked: boolean;
  claimed: boolean;
}

export interface WingSummary {
  bucket: HallBucket;
  total: number;
  claimed: number;
  ready: number;
  /** Claimed fraction, 0..1 — the wing's ring gauge. */
  percent: number;
  /** The plinth piece: the first ready achievement, else the last claimed. */
  featuredId: string | null;
}

/** One summary per wing, in fixed hall order, from the evaluated statuses. */
export function wingSummaries(statuses: readonly WingStatusLite[]): WingSummary[] {
  return HALL_BUCKETS.map((bucket) => {
    const inWing = statuses.filter((status) => status.def.bucket === bucket);
    const claimed = inWing.filter((status) => status.claimed);
    const ready = inWing.filter((status) => status.unlocked && !status.claimed);
    return {
      bucket,
      total: inWing.length,
      claimed: claimed.length,
      ready: ready.length,
      percent: inWing.length > 0 ? claimed.length / inWing.length : 0,
      featuredId: ready[0]?.def.id ?? claimed[claimed.length - 1]?.def.id ?? null,
    };
  });
}

export interface WingFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Five plinth frames: three wings up, two centered beneath, inside 72..1208. */
export function hallWingFrames(): WingFrame[] {
  const w = 362;
  const h = 208;
  const gap = 25;
  const topY = 196;
  const bottomY = topY + h + 24;
  const bottomX0 = 72 + (1136 - (2 * w + gap)) / 2;
  return [
    { x: 72, y: topY, w, h },
    { x: 72 + w + gap, y: topY, w, h },
    { x: 72 + 2 * (w + gap), y: topY, w, h },
    { x: bottomX0, y: bottomY, w, h },
    { x: bottomX0 + w + gap, y: bottomY, w, h },
  ];
}

export const SHOWCASE_CAP = 3;

/**
 * Toggle a showcase pin. Pinning past the cap evicts the OLDEST pin, so the
 * showcase never dead-ends; unpinning simply removes.
 */
export function togglePin(pinned: readonly string[], id: string): string[] {
  if (pinned.includes(id)) return pinned.filter((pin) => pin !== id);
  const next = [...pinned, id];
  return next.slice(Math.max(0, next.length - SHOWCASE_CAP));
}

/** Deterministic furnishing picks: which owned cards decorate a wing. */
export function wingFurnishings(
  bucket: HallBucket,
  ownedCardIds: readonly string[],
  count = 2,
): string[] {
  if (ownedCardIds.length === 0) return [];
  let hash = 0;
  for (let i = 0; i < bucket.length; i++) hash = (hash * 31 + bucket.charCodeAt(i)) >>> 0;
  const picks: string[] = [];
  for (let i = 0; i < Math.min(count, ownedCardIds.length); i++) {
    picks.push(ownedCardIds[(hash + i * 7919) % ownedCardIds.length]);
  }
  return [...new Set(picks)];
}

// ── The goal list and the hall plinths: measured rows (accessibility wave 3) ──

/**
 * The list's frame: two columns of rows from y 196 down to 638, above the
 * pager on the footer line. At standard text the release geometry holds
 * (eight 50px rows per column at a 56px pitch, 16 per page); larger text
 * grows the rows and pages fewer of them.
 */
export const ACHIEVEMENT_LIST = {
  x: 72,
  width: 1136,
  columnGap: 32,
  top: 196,
  bottom: 638,
  rowHeight: 50,
  rowGap: 6,
  columns: 2,
} as const;

/**
 * Inside a row, left to right: the copy block (title line, then the goal),
 * the gauge, and the progress column (the readout, or Claim). The x offsets
 * are the release ones; the two line centres (14 and 35) are where a
 * single-line title and goal sat in release, and stay so at standard text.
 */
export const ACHIEVEMENT_ROW = {
  pad: 14,
  copyRight: 384,
  gaugeCenter: 410,
  progressLeft: 432,
  claimMinWidth: 90,
  titleCenter: 14,
  goalCenter: 35,
  /** The least space between a row's edge and its text, and between its two lines. */
  inset: theme.space(1),
  bottomInset: theme.space(1.5),
} as const;

/** Rendered heights (Phaser measures them): the whole block and one line of it. */
export interface AchievementRowMeasure {
  titleHeight: number;
  titleLineHeight: number;
  goalHeight: number;
  goalLineHeight: number;
  /** The progress column's tallest content (the readout or Claim). */
  progressHeight: number;
}

export interface AchievementRowLayout {
  height: number;
  /** Tops of the title block and the goal, from the row's top. */
  titleTop: number;
  goalTop: number;
}

/**
 * One row from its measured text. Single lines keep their release centres;
 * a wrapped title pushes the goal down, and the row grows to hold both and
 * the progress column, never below the release 50px.
 */
export function achievementRowLayout(m: AchievementRowMeasure): AchievementRowLayout {
  const R = ACHIEVEMENT_ROW;
  const titleTop = Math.max(R.inset, R.titleCenter - m.titleLineHeight / 2);
  const goalTop = Math.max(R.goalCenter - m.goalLineHeight / 2, titleTop + m.titleHeight + R.inset);
  const height = Math.max(
    ACHIEVEMENT_LIST.rowHeight,
    goalTop + m.goalHeight + R.bottomInset,
    m.progressHeight + 2 * R.inset,
  );
  return { height, titleTop, goalTop };
}

export interface AchievementListLayout {
  rowsPerColumn: number;
  perPage: number;
  rowHeight: number;
  rowWidth: number;
  pitch: number;
  /** Top-left of the page's `index`-th row: the left column fills first. */
  cell(index: number): { x: number; y: number };
}

/** As many rows of `rowHeight` as fit each column, at the release gap. */
export function achievementListLayout(rowHeight: number): AchievementListLayout {
  const L = ACHIEVEMENT_LIST;
  const height = Math.max(L.rowHeight, rowHeight);
  const pitch = height + L.rowGap;
  const rowsPerColumn = Math.max(1, Math.floor((L.bottom - L.top + L.rowGap) / pitch));
  const rowWidth = (L.width - (L.columns - 1) * L.columnGap) / L.columns;
  return {
    rowsPerColumn,
    perPage: rowsPerColumn * L.columns,
    rowHeight: height,
    rowWidth,
    pitch,
    cell: (index) => ({
      x: L.x + Math.floor(index / rowsPerColumn) * (rowWidth + L.columnGap),
      y: L.top + (index % rowsPerColumn) * pitch,
    }),
  };
}

/** A wing's featured plinth: measured title and status lines (release: 54px tall, 16px above the frame's foot). */
export interface HallPlinthMeasure {
  titleHeight: number;
  titleLineHeight: number;
  statusHeight: number;
  statusLineHeight: number;
}

export interface HallPlinthLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The title wraps inside this width. */
  textWidth: number;
  titleTop: number;
  statusTop: number;
}

export const HALL_PLINTH = {
  inset: 14,
  rightReserve: 130,
  footInset: 16,
  minHeight: 54,
  textInset: 12,
  titleCenter: 18,
  statusCenter: 39,
} as const;

/** The plinth keeps its foot; a wrapped title grows it upward. */
export function hallPlinthLayout(frame: WingFrame, m: HallPlinthMeasure): HallPlinthLayout {
  const P = HALL_PLINTH;
  const width = frame.w - P.rightReserve;
  const titleTop = Math.max(ACHIEVEMENT_ROW.inset, P.titleCenter - m.titleLineHeight / 2);
  const statusTop = Math.max(P.statusCenter - m.statusLineHeight / 2, titleTop + m.titleHeight + ACHIEVEMENT_ROW.inset);
  const height = Math.max(P.minHeight, statusTop + m.statusHeight + ACHIEVEMENT_ROW.bottomInset);
  return {
    x: frame.x + P.inset,
    y: frame.y + frame.h - P.footInset - height,
    width,
    height,
    textWidth: width - 2 * P.textInset,
    titleTop,
    statusTop,
  };
}
