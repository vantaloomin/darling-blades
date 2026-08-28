import { describe, expect, it } from 'vitest';
import { selectCurrentArtifactFiles } from '../../scripts/sweep-dash/run.mjs';

const candidate = (file, datePrefix, personaId, mtimeMs) => ({
  file, datePrefix, personaId, mtimeMs,
});

describe('sweep dashboard artifact selection', () => {
  it('selects only the newest dated run and the newest file per persona', () => {
    const selected = selectCurrentArtifactFiles([
      candidate('2026-08-27-metagame-burn-all.json', '2026-08-27', 'burn', 900),
      candidate('2026-08-28-metagame-burn-all.json', '2026-08-28', 'burn', 1000),
      candidate('2026-08-28-metagame-burn-starters.json', '2026-08-28', 'burn', 1100),
      candidate('2026-08-28-metagame-weenie-all.json', '2026-08-28', 'weenie', 1050),
    ]);

    expect(selected.map((entry) => entry.file)).toEqual([
      '2026-08-28-metagame-burn-starters.json',
      '2026-08-28-metagame-weenie-all.json',
    ]);
  });

  it('excludes older same-date artifacts when a run start is known', () => {
    const selected = selectCurrentArtifactFiles([
      candidate('2026-08-28-metagame-burn-all.json', '2026-08-28', 'burn', 100),
      candidate('2026-08-28-metagame-weenie-all.json', '2026-08-28', 'weenie', 200),
    ], 150);

    expect(selected.map((entry) => entry.file)).toEqual([
      '2026-08-28-metagame-weenie-all.json',
    ]);
  });
});
