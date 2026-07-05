import { Services } from '../meta/services';
import { AudioManager } from './AudioManager';

/**
 * UI-layer audio singleton, mirroring how Services exposes the meta layer:
 * scenes import { Sfx } directly. Volume reads/writes route through the
 * SaveManager so the setting persists like everything else.
 */
export const Sfx = new AudioManager(
  {
    get: () => Services.save.data.settings.volume,
    set: (v) => {
      Services.save.data.settings.volume = v;
      Services.save.touch();
    },
  },
  // Persisted SFX toggle: gates play() only (music rides the same master gain
  // and stays governed by settings.musicOn instead).
  () => Services.save.data.settings.sfxOn,
);

// Dev-tool access (trigger counts, unlock state) — mirrors window.__game.
declare global {
  interface Window {
    __sfx: AudioManager;
  }
}
if (typeof window !== 'undefined') window.__sfx = Sfx;
