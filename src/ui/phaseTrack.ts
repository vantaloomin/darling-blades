import type { Step } from '../engine/types';

export const PHASE_TRACK_ROWS = ['DAWN', 'MORNING', 'COMBAT', 'AFTERNOON', 'SUNSET'] as const;

export type PhaseTrackRow = (typeof PHASE_TRACK_ROWS)[number];

/** Maps every engine step onto the compact five-row duel phase track. */
export function phaseTrackRowForStep(step: Step): PhaseTrackRow {
  switch (step) {
    case 'untap':
    case 'dawn':
    case 'draw':
      return 'DAWN';
    case 'main1':
      return 'MORNING';
    case 'combat':
      return 'COMBAT';
    case 'main2':
      return 'AFTERNOON';
    case 'end':
    case 'cleanup':
      return 'SUNSET';
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}
