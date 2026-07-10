import type { Step } from '../engine/types';

export const PHASE_TRACK_ROWS = ['UPKEEP', 'MAIN 1', 'COMBAT', 'MAIN 2', 'END'] as const;

export type PhaseTrackRow = (typeof PHASE_TRACK_ROWS)[number];

/** Maps every engine step onto the compact five-row duel phase track. */
export function phaseTrackRowForStep(step: Step): PhaseTrackRow {
  switch (step) {
    case 'untap':
    case 'dawn':
    case 'draw':
      return 'UPKEEP';
    case 'main1':
      return 'MAIN 1';
    case 'combat':
      return 'COMBAT';
    case 'main2':
      return 'MAIN 2';
    case 'end':
    case 'cleanup':
      return 'END';
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}
