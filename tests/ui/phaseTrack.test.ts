import { describe, expect, it } from 'vitest';
import { phaseTrackRowForStep } from '../../src/ui/phaseTrack';

describe('phaseTrackRowForStep', () => {
  it('maps every engine step to its phase-track row', () => {
    expect(phaseTrackRowForStep('untap')).toBe('DAWN');
    expect(phaseTrackRowForStep('dawn')).toBe('DAWN');
    expect(phaseTrackRowForStep('draw')).toBe('DAWN');
    expect(phaseTrackRowForStep('main1')).toBe('MORNING');
    expect(phaseTrackRowForStep('combat')).toBe('COMBAT');
    expect(phaseTrackRowForStep('main2')).toBe('AFTERNOON');
    expect(phaseTrackRowForStep('end')).toBe('SUNSET');
    expect(phaseTrackRowForStep('cleanup')).toBe('SUNSET');
  });
});
