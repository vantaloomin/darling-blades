import { describe, expect, it } from 'vitest';
import { staleBuildReloadAllowed } from '../../src/platform/staleBuild';

describe('staleBuildReloadAllowed', () => {
  it('allows the first reload and refuses another inside a minute, so a missing script cannot loop the tab', () => {
    expect(staleBuildReloadAllowed(null, 100_000)).toBe(true);
    expect(staleBuildReloadAllowed('100000', 100_000 + 59_999)).toBe(false);
    expect(staleBuildReloadAllowed('100000', 100_000 + 60_000)).toBe(true);
    expect(staleBuildReloadAllowed('junk', 100_000)).toBe(true);
  });
});
