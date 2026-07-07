import { SaveManager } from './SaveManager';

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
};
