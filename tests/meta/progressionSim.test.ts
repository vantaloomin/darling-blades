import { describe, expect, it } from 'vitest';
import {
  PLAYER_PERSONAS,
  renderProgressionReport,
  runProgressionSimulation,
} from '../../scripts/progression-sim';

describe('progression simulation harness', () => {
  it('defines 10 unique named player personas', () => {
    expect(PLAYER_PERSONAS).toHaveLength(10);
    expect(new Set(PLAYER_PERSONAS.map((p) => p.id)).size).toBe(10);
    expect(new Set(PLAYER_PERSONAS.map((p) => p.name)).size).toBe(10);
  });

  it('runs deterministically across fixed seeds', () => {
    const personas = [PLAYER_PERSONAS[0], PLAYER_PERSONAS[8]];
    const options = { seeds: 1, days: [1], baseSeed: 12345, personas };
    const a = runProgressionSimulation(options);
    const b = runProgressionSimulation(options);

    expect(a.snapshots).toEqual(b.snapshots);
    expect(a.aggregates).toEqual(b.aggregates);
    expect(a.snapshots).toHaveLength(personas.length);
    expect(renderProgressionReport(a)).toContain('VERDICT:');
  });
});
