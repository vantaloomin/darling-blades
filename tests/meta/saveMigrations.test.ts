import { describe, expect, it } from 'vitest';
import { freshSave, SaveManager } from '../../src/meta/SaveManager';

function fakeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => void raw.set(key, value),
    removeItem: (key) => void raw.delete(key),
  };
}

describe('SaveData v19 migration', () => {
  it('migrates a v18 blob with no weekly allowance to zero entries', () => {
    const storage = fakeStorage();
    const old = freshSave(123);
    const oldLimited = { ...old.limited } as Record<string, unknown>;
    delete oldLimited.premiumWeek;
    storage.raw.set('darlingblades.save.v1', JSON.stringify({ ...old, version: 18, limited: oldLimited }));

    const manager = new SaveManager(storage, 456);
    expect(manager.data.version).toBe(19);
    expect(manager.data.limited.premiumWeek).toEqual({ week: 0, entries: 0 });
    expect(manager.data.createdAt).toBe(123);
  });

  it('normalizes a malformed v19 allowance without wiping the rest of the save', () => {
    const storage = fakeStorage();
    const current = freshSave(123);
    current.gold = 777;
    storage.raw.set(
      'darlingblades.save.v1',
      JSON.stringify({ ...current, limited: { ...current.limited, premiumWeek: { week: 'bad', entries: -4 } } }),
    );

    const manager = new SaveManager(storage, 456);
    expect(manager.data.version).toBe(19);
    expect(manager.data.gold).toBe(777);
    expect(manager.data.limited.premiumWeek).toEqual({ week: 0, entries: 0 });
  });
});
