import { describe, expect, it } from 'vitest';
import { phaseTrackRowForStep } from '../../src/ui/phaseTrack';

describe('phaseTrackRowForStep', () => {
  it('maps every engine step to its phase-track row', () => {
    expect(phaseTrackRowForStep('untap')).toBe('UPKEEP');
    expect(phaseTrackRowForStep('dawn')).toBe('UPKEEP');
    expect(phaseTrackRowForStep('draw')).toBe('UPKEEP');
    expect(phaseTrackRowForStep('main1')).toBe('MAIN 1');
    expect(phaseTrackRowForStep('combat')).toBe('COMBAT');
    expect(phaseTrackRowForStep('main2')).toBe('MAIN 2');
    expect(phaseTrackRowForStep('end')).toBe('END');
    expect(phaseTrackRowForStep('cleanup')).toBe('END');
  });
});
