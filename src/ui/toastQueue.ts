import type { SfxName } from '../audio/recipes';

export interface ToastAction {
  scene: string;
  data?: object;
}

export interface ToastSummary {
  title: string;
  body: string;
  detail?: string;
  cue?: SfxName;
  action?: ToastAction;
}

export interface ToastNotice extends ToastSummary {
  /** Caller-owned copy for a 4+ notice collapse. */
  collapseSummary?: ToastSummary;
  /**
   * Hold this notice for a different time than the rail's default. For copy
   * that has to be READ rather than glanced at (the anonymous-stats notice is
   * two sentences the player is owed). Absent means the default.
   */
  holdMs?: number;
  /**
   * Grow the plaque to the measured body instead of using the fixed card
   * height. Absent means the fixed card, which is what every notice short
   * enough for one line wants.
   */
  fitBody?: boolean;
  /**
   * Never fold this notice into a "several notices" summary. A consent notice
   * that a busy return to the menu quietly replaced with "4 updates ready"
   * would not have been shown at all.
   */
  neverCollapse?: boolean;
  /**
   * Called once, when the card has actually been built on screen. The
   * anonymous-stats notice stamps its save version from here, so a player who
   * leaves before the notice renders is still owed it.
   */
  onShown?: () => void;
}

export const TOAST_STACK_LIMIT = 3;

export type ToastBatch =
  | { kind: 'stack'; notices: readonly ToastNotice[] }
  | { kind: 'summary'; notice: ToastSummary };

/** Collapse a simultaneous burst before the Phaser host renders it. */
export function collapseToastBatch(notices: readonly ToastNotice[]): ToastBatch {
  const protectedNotices = notices.filter((notice) => notice.neverCollapse === true);
  if (protectedNotices.length > 0) {
    // A protected notice is presented whole; the rest collapse among
    // themselves by exactly the rule below, so the summary still counts only
    // the notices it actually stands in for.
    const rest = collapseToastBatch(notices.filter((notice) => notice.neverCollapse !== true));
    return {
      kind: 'stack',
      notices: [...protectedNotices, ...(rest.kind === 'stack' ? rest.notices : [rest.notice])],
    };
  }
  if (notices.length <= TOAST_STACK_LIMIT) return { kind: 'stack', notices };
  const summary = notices.find((notice) => notice.collapseSummary)?.collapseSummary;
  return {
    kind: 'summary',
    notice: summary ?? {
      title: `${notices.length} updates ready`,
      body: 'Several updates arrived together.',
      detail: 'Tap to review.',
    },
  };
}

// ---------------------------------------------------------------------------
// The card's measured layout (1.9 accessibility wave 3)
// ---------------------------------------------------------------------------

/**
 * The right-rail plaque. `height` is the release card; the insets reproduce
 * the -28 / -5 / +25 offsets the rail has always drawn at that height.
 */
export const TOAST_CARD = {
  width: 344,
  height: 86,
  /** The release stack's first centre; its top edge is `stackTop`. */
  firstCenterY: 82,
  gap: 12,
  titleCenter: 15,
  bodyCenter: 38,
  /** A `fitBody` card's body top. */
  bodyTop: 30,
  detailFromBottom: 18,
  bottomPad: 14,
  /** A grown card's detail sits this far under its body (the fitBody rule). */
  detailGap: 12,
  /** Inside the plaque's inner stroke, which is 7px in from the edge. */
  innerInset: 8,
  /** The least space between two lines of a card, for both the release and the stacked layout. */
  lineGap: 4,
  /** Between the lines of a card that had to be stacked from measured heights. */
  stackGap: 6,
} as const;

export interface ToastMeasured {
  title: number;
  body: number;
  detail: number | null;
  fitBody: boolean;
}

/** Tops (from the card's top edge) of each line, and the card's height. */
export interface ToastCardLayout {
  height: number;
  titleTop: number;
  bodyTop: number;
  detailTop: number | null;
}

/**
 * Lay out one card from its measured line heights. A card whose lines fit the
 * release slots (at least `lineGap` apart and inside the inner stroke) keeps
 * them exactly; one that does not (a body that wrapped, or larger text) stacks
 * its lines from their measured heights and grows, so no line lands on another.
 */
export function toastCardLayout(m: ToastMeasured): ToastCardLayout {
  const C = TOAST_CARD;
  const releaseHeight = m.fitBody
    ? Math.max(C.height, Math.ceil(C.bodyTop + m.body + (m.detail !== null ? m.detail + C.detailGap : 0) + C.bottomPad))
    : C.height;
  const release: ToastCardLayout = {
    height: releaseHeight,
    titleTop: C.titleCenter - m.title / 2,
    bodyTop: m.fitBody ? C.bodyTop : C.bodyCenter - m.body / 2,
    detailTop: m.detail === null ? null : releaseHeight - C.detailFromBottom - m.detail / 2,
  };
  const lastBottom = release.detailTop !== null && m.detail !== null ? release.detailTop + m.detail : release.bodyTop + m.body;
  const fits = release.titleTop >= C.innerInset - C.lineGap
    && release.titleTop + m.title + C.lineGap <= release.bodyTop
    && (release.detailTop === null || release.bodyTop + m.body + C.lineGap <= release.detailTop)
    && lastBottom <= releaseHeight - C.innerInset + C.lineGap;
  if (fits) return release;
  const titleTop = C.innerInset;
  const bodyTop = titleTop + m.title + C.stackGap;
  const detailTop = m.detail === null ? null : bodyTop + m.body + C.stackGap;
  const bottom = detailTop !== null && m.detail !== null ? detailTop + m.detail : bodyTop + m.body;
  return { height: Math.max(C.height, Math.ceil(bottom + C.bottomPad)), titleTop, bodyTop, detailTop };
}

/** The release stack's top edge: every card hangs from it, whatever its height. */
export function toastStackCenters(heights: readonly number[]): number[] {
  let top = TOAST_CARD.firstCenterY - TOAST_CARD.height / 2;
  return heights.map((height) => {
    const center = top + height / 2;
    top += height + TOAST_CARD.gap;
    return center;
  });
}
