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
