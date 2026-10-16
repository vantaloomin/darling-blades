/**
 * The stored sound-style setting, shared by the save (src/meta/SaveManager.ts)
 * and the audio layer (src/audio/) so the two can never disagree. No imports.
 *
 * - `classic`: the procedural WebAudio sounds and generative music the game
 *   has always made (src/audio/recipes.ts, src/audio/musicPatterns.ts).
 * - `new`: recorded CC0 samples and music loops (src/audio/soundSet.ts),
 *   falling back to the classic sound for anything not loaded yet.
 */
export const SOUND_STYLES = ['classic', 'new'] as const;
export type SoundStyle = (typeof SOUND_STYLES)[number];

/** A fresh save's sound style, and the answer for any stored value off the list. */
export const DEFAULT_SOUND_STYLE: SoundStyle = 'classic';

export function normalizeSoundStyle(value: unknown): SoundStyle {
  return (SOUND_STYLES as readonly unknown[]).includes(value) ? (value as SoundStyle) : DEFAULT_SOUND_STYLE;
}
