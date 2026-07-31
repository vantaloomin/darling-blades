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
}

export const TOAST_STACK_LIMIT = 3;

export type ToastBatch =
  | { kind: 'stack'; notices: readonly ToastNotice[] }
  | { kind: 'summary'; notice: ToastSummary };

/** Collapse a simultaneous burst before the Phaser host renders it. */
export function collapseToastBatch(notices: readonly ToastNotice[]): ToastBatch {
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
