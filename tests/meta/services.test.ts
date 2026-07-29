import { describe, expect, it } from 'vitest';
import { replaceSave } from '../../src/meta/services';
import { freshSave, SaveManager, type SaveData } from '../../src/meta/SaveManager';

const NOW = 1_700_000_000_000;

function storageStub(): {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  getStored: () => SaveData | null;
  failNextWrite: () => void;
} {
  let blob: string | null = null;
  let fail = false;
  return {
    storage: {
      getItem: () => blob,
      setItem: (_key, value) => {
        if (fail) {
          fail = false;
          throw new Error('storage full');
        }
        blob = value;
      },
      removeItem: () => {
        blob = null;
      },
    },
    getStored: () => (blob ? (JSON.parse(blob) as SaveData) : null),
    failNextWrite: () => {
      fail = true;
    },
  };
}

describe('save service replacement', () => {
  it('writes the imported profile and refreshes the shared data object in place', () => {
    const stub = storageStub();
    const manager = new SaveManager(stub.storage, NOW);
    manager.data.gold = 12;
    manager.flush();
    const sharedReference = manager.data;

    const imported = freshSave(NOW + 1);
    imported.gold = 987;
    imported.stats.wins = 4;

    expect(replaceSave(imported, manager)).toBe(true);
    expect(manager.data).toBe(sharedReference);
    expect(manager.data.gold).toBe(987);
    expect(manager.data.stats.wins).toBe(4);
    expect(stub.getStored()?.gold).toBe(987);
  });

  it('restores the prior profile when the replacement write fails', () => {
    const stub = storageStub();
    const manager = new SaveManager(stub.storage, NOW);
    manager.data.gold = 123;
    manager.data.stats.losses = 2;
    manager.flush();
    const before = JSON.parse(JSON.stringify(manager.data)) as SaveData;

    const imported = freshSave(NOW + 1);
    imported.gold = 9999;
    imported.stats.losses = 40;
    stub.failNextWrite();

    expect(replaceSave(imported, manager)).toBe(false);
    expect(manager.data).toEqual(before);
    expect(stub.getStored()).toEqual(before);
  });
});
