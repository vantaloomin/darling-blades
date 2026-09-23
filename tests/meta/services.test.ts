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

  describe('the anonymous-stats choice', () => {
    /** A device and an import, each with its own sharing choice and notice stamp. */
    function importInto(
      device: { share: boolean; notice: number },
      incoming: { share: boolean; notice: number },
    ): { manager: SaveManager; stored: SaveData | null } {
      const stub = storageStub();
      const manager = new SaveManager(stub.storage, NOW);
      manager.data.settings.shareAnonStats = device.share;
      manager.data.settings.statsNoticeVersion = device.notice;
      manager.flush();
      const imported = freshSave(NOW + 1);
      imported.gold = 555;
      imported.settings.shareAnonStats = incoming.share;
      imported.settings.statsNoticeVersion = incoming.notice;
      expect(replaceSave(imported, manager)).toBe(true);
      return { manager, stored: stub.getStored() };
    }

    it('never switches sharing back on for a device where it is off', () => {
      const { manager, stored } = importInto({ share: false, notice: 1 }, { share: true, notice: 1 });
      expect(manager.data.settings.shareAnonStats).toBe(false);
      expect(stored?.settings.shareAnonStats).toBe(false);
      // The rest of the import still lands.
      expect(manager.data.gold).toBe(555);
    });

    it('carries an imported "off" onto a device where sharing is on', () => {
      const { manager } = importInto({ share: true, notice: 1 }, { share: false, notice: 1 });
      expect(manager.data.settings.shareAnonStats).toBe(false);
    });

    it('keeps sharing on when both sides have it on', () => {
      const { manager } = importInto({ share: true, notice: 1 }, { share: true, notice: 1 });
      expect(manager.data.settings.shareAnonStats).toBe(true);
    });

    it('keeps the higher notice stamp, whichever side holds it', () => {
      const deviceHigher = importInto({ share: true, notice: 1 }, { share: true, notice: 0 });
      expect(deviceHigher.manager.data.settings.statsNoticeVersion).toBe(1);
      expect(deviceHigher.stored?.settings.statsNoticeVersion).toBe(1);
      const importHigher = importInto({ share: true, notice: 0 }, { share: true, notice: 2 });
      expect(importHigher.manager.data.settings.statsNoticeVersion).toBe(2);
    });
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
