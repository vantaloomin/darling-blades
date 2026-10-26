import { describe, expect, it } from 'vitest';
import { saveOverNoticeOwed } from '../../src/platform/homeScreen';

describe('saveOverNoticeOwed (M9)', () => {
  it('is owed only in an iOS home-screen app, on a fresh save, the first time', () => {
    expect(saveOverNoticeOwed({ standalone: true, shown: false, freshSave: true })).toBe(true);
    expect(saveOverNoticeOwed({ standalone: true, shown: true, freshSave: true })).toBe(false);
    expect(saveOverNoticeOwed({ standalone: true, shown: false, freshSave: false })).toBe(false);
  });

  it('is never owed in a browser tab or on Android, where standalone is missing or false', () => {
    for (const standalone of [undefined, false, 'true', 1]) {
      expect(saveOverNoticeOwed({ standalone, shown: false, freshSave: true }), String(standalone)).toBe(false);
    }
  });
});
