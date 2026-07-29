import { SaveManager } from './SaveManager';
import type { SaveData } from './SaveManager';

/**
 * Phaser-free module singleton wiring the meta layer. Scenes import this
 * directly — no Phaser registry, no event-bus spaghetti. Tests construct
 * their own SaveManager with a fake storage instead.
 */

const memoryStorage = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
};

export const Services = {
  save: new SaveManager(
    typeof localStorage !== 'undefined' ? localStorage : memoryStorage(),
  ),
  /** The Profile import boundary. Scenes never write or parse save payloads. */
  replaceSave(next: SaveData): boolean {
    return replaceSave(next);
  },
};

/**
 * Replace a decoded profile through the shared service boundary. The optional
 * manager is a headless seam for rollback tests; production callers use the
 * singleton above.
 */
export function replaceSave(next: SaveData, manager: SaveManager = Services.save): boolean {
  return manager.replace(next);
}
