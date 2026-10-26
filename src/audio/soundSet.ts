/**
 * The "New" sound style's file list — pure data, no browser APIs, testable
 * headless (the same discipline as recipes.ts and musicPatterns.ts).
 *
 * Every file is a CC0 placeholder from packs the owner already downloaded
 * (Kenney and Not Jam; picks in the 2026-10-16 audio thread). Each entry names
 * its source so `scripts/build-sound-set.ts` can rebuild the processed files
 * under `public/assets/audio/` and the notices page can credit them as a
 * courtesy (CC0 needs no credit).
 *
 * Anything missing here, or not loaded yet, plays the Classic sound instead.
 */
import type { MoodName } from './musicPatterns';
import type { SfxName } from './recipes';

export type SoundPack =
  | 'kenney-casino'
  | 'kenney-impact'
  | 'kenney-interface'
  | 'kenney-jingles'
  | 'kenney-rpg'
  | 'kenney-ui'
  | 'notjam-1'
  | 'notjam-2';

export interface SoundSource {
  pack: SoundPack;
  /** Path inside the pack's download, as the pack ships it. */
  file: string;
}

/** Card-handling moments only the New style voices (Classic has no sound for them). */
export type TextureCue = 'shuffle' | 'draw' | 'packOpen' | 'packTakeOut';
export const TEXTURE_CUES: readonly TextureCue[] = ['shuffle', 'draw', 'packOpen', 'packTakeOut'];

export const PACKS: Record<SoundPack, { title: string; author: string; url: string }> = {
  'kenney-casino': { title: 'Casino Audio', author: 'Kenney', url: 'https://kenney.nl/assets/casino-audio' },
  'kenney-impact': { title: 'Impact Sounds', author: 'Kenney', url: 'https://kenney.nl/assets/impact-sounds' },
  'kenney-interface': { title: 'Interface Sounds', author: 'Kenney', url: 'https://kenney.nl/assets/interface-sounds' },
  'kenney-jingles': { title: 'Music Jingles', author: 'Kenney', url: 'https://kenney.nl/assets/music-jingles' },
  'kenney-rpg': { title: 'RPG Audio', author: 'Kenney', url: 'https://kenney.nl/assets/rpg-audio' },
  'kenney-ui': { title: 'UI Audio', author: 'Kenney', url: 'https://kenney.nl/assets/ui-audio' },
  'notjam-1': { title: 'Not Jam Music Pack', author: 'Not Jam', url: 'https://not-jam.itch.io/not-jam-music-pack' },
  'notjam-2': { title: 'Not Jam Music Pack 2', author: 'Not Jam', url: 'https://not-jam.itch.io/not-jam-music-pack-2' },
};

/** One looping track per music mood. */
export const MOOD_TRACKS: Record<MoodName, SoundSource> = {
  menu: { pack: 'notjam-1', file: 'Loopable_ogg/ChillMenu_Loopable.ogg' },
  duel: { pack: 'notjam-2', file: 'Loopable/leading_the_charge_loopable.ogg' },
  duelTense: { pack: 'notjam-2', file: 'Loopable/battle_commences_loopable.ogg' },
  duelLethal: { pack: 'notjam-1', file: 'Loopable_ogg/CriticalTheme_Loopable.ogg' },
  gauntlet: { pack: 'notjam-2', file: 'Loopable/solemn_advance_loopable.ogg' },
  shop: { pack: 'notjam-2', file: 'Loopable/grumpy_shopkeep_loopable.ogg' },
};

/** One sample per existing sound cue. */
export const SFX_SAMPLES: Record<SfxName, SoundSource> = {
  click: { pack: 'kenney-interface', file: 'click_003.ogg' },
  hover: { pack: 'kenney-ui', file: 'rollover2.ogg' },
  cast: { pack: 'kenney-interface', file: 'maximize_003.ogg' },
  land: { pack: 'kenney-impact', file: 'impactSoft_medium_001.ogg' },
  attack: { pack: 'kenney-rpg', file: 'drawKnife1.ogg' },
  hit: { pack: 'kenney-impact', file: 'impactPunch_medium_001.ogg' },
  death: { pack: 'kenney-impact', file: 'impactSoft_heavy_002.ogg' },
  lifeLoss: { pack: 'kenney-impact', file: 'impactPunch_heavy_001.ogg' },
  win: { pack: 'kenney-jingles', file: 'Pizzicato jingles/jingles_PIZZI02.ogg' },
  loss: { pack: 'kenney-jingles', file: 'Pizzicato jingles/jingles_PIZZI01.ogg' },
  coin: { pack: 'kenney-rpg', file: 'handleCoins.ogg' },
  seal: { pack: 'kenney-jingles', file: 'Pizzicato jingles/jingles_PIZZI10.ogg' },
  flip: { pack: 'kenney-casino', file: 'card-slide-1.ogg' },
  shimmer: { pack: 'kenney-jingles', file: 'Steel jingles/jingles_STEEL02.ogg' },
  yourTurn: { pack: 'kenney-jingles', file: 'Pizzicato jingles/jingles_PIZZI08.ogg' },
  rungClear: { pack: 'kenney-jingles', file: 'Pizzicato jingles/jingles_PIZZI04.ogg' },
  shatter: { pack: 'kenney-interface', file: 'glass_004.ogg' },
  warn: { pack: 'kenney-interface', file: 'error_004.ogg' },
  versus: { pack: 'kenney-jingles', file: 'Hit jingles/jingles_HIT11.ogg' },
};

/** Card-handling texture the New style adds. */
export const TEXTURE_SAMPLES: Record<TextureCue, SoundSource> = {
  shuffle: { pack: 'kenney-casino', file: 'card-shuffle.ogg' },
  draw: { pack: 'kenney-casino', file: 'card-slide-5.ogg' },
  packOpen: { pack: 'kenney-casino', file: 'cards-pack-open-1.ogg' },
  packTakeOut: { pack: 'kenney-casino', file: 'cards-pack-take-out-1.ogg' },
};

/** Served-file stem for a slot: `music/<mood>`, `sfx/<cue>`. */
export function musicStem(mood: MoodName): string {
  return `music/${mood}`;
}
export function sfxStem(cue: SfxName | TextureCue): string {
  return `sfx/${cue}`;
}

/** Every processed file the build writes, by stem. */
export function allSoundStems(): { stem: string; source: SoundSource; kind: 'music' | 'sfx' }[] {
  return [
    ...(Object.keys(MOOD_TRACKS) as MoodName[]).map((m) => ({ stem: musicStem(m), source: MOOD_TRACKS[m], kind: 'music' as const })),
    ...(Object.keys(SFX_SAMPLES) as SfxName[]).map((c) => ({ stem: sfxStem(c), source: SFX_SAMPLES[c], kind: 'sfx' as const })),
    ...TEXTURE_CUES.map((c) => ({ stem: sfxStem(c), source: TEXTURE_SAMPLES[c], kind: 'sfx' as const })),
  ];
}

/** The two encodings each file ships in; the client picks one per browser. */
export const SOUND_FORMATS = ['ogg', 'm4a'] as const;
export type SoundFormat = (typeof SOUND_FORMATS)[number];

/**
 * Pick the encoding a browser can decode: Ogg Vorbis where supported (gapless
 * loops), AAC in .m4a otherwise (older Safari). `canPlay` is
 * `HTMLMediaElement.canPlayType`, injected so this stays headless.
 */
export function pickSoundFormat(canPlay: (mime: string) => string): SoundFormat {
  return canPlay('audio/ogg; codecs="vorbis"') !== '' ? 'ogg' : 'm4a';
}

/**
 * Playback gains, set by measurement rather than by ear (nobody has listened
 * yet): sound effects are built to a -3 dBFS peak and play under the master
 * bus at this gain, landing near the Classic recipes' peaks (well under 0.4).
 */
export const SAMPLE_SFX_LEVEL = 0.45;
/** Music loops are built to -18 LUFS and play at this gain inside the music bus (itself ~0.3 of master). */
export const SAMPLE_MUSIC_GAIN = 1;
