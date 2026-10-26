/**
 * Builds the "New" sound style's files under `public/assets/audio/` from the
 * source packs named in `src/audio/soundSet.ts`.
 *
 *   npx tsx scripts/build-sound-set.ts <packs-dir>
 *
 * `<packs-dir>` holds the unzipped packs exactly as they download (the owner's
 * copy lives in `waifu-wars/assets/audio/src/`): `kenney_<name>/Audio/...`,
 * `not-jam-music-pack-1_ogg/NotJamMusicPack_ogg/...` and
 * `not-jam-music-pack-2_ogg/OGG/...`. The packs are not committed; the
 * processed files are.
 *
 * Per file, with ffmpeg on PATH:
 * - **Sound effects:** leading silence trimmed, then a flat gain so the peak
 *   sits at -3 dBFS. Mono, 44.1 kHz.
 * - **Music:** a flat gain to -18 LUFS integrated, capped so the true peak
 *   stays under -1 dBFS. Never trimmed, so the pack's loop seam survives.
 * - Both are written twice: Ogg Vorbis (gapless loops where the browser
 *   decodes it) and AAC in .m4a for browsers that cannot.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { allSoundStems, type SoundPack } from '../src/audio/soundSet';

const PACK_ROOTS: Record<SoundPack, string> = {
  'kenney-casino': 'kenney_casino-audio/Audio',
  'kenney-impact': 'kenney_impact-sounds/Audio',
  'kenney-interface': 'kenney_interface-sounds/Audio',
  'kenney-jingles': 'kenney_music-jingles/Audio',
  'kenney-rpg': 'kenney_rpg-audio/Audio',
  'kenney-ui': 'kenney_ui-audio/Audio',
  'notjam-1': 'not-jam-music-pack-1_ogg/NotJamMusicPack_ogg',
  'notjam-2': 'not-jam-music-pack-2_ogg/OGG',
};

const OUT_DIR = 'public/assets/audio';
const SFX_PEAK_DB = -3;
const MUSIC_LUFS = -18;
const MUSIC_PEAK_CEILING_DB = -1;

function ffmpeg(args: string[]): string {
  return execFileSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Run an analysis filter and return ffmpeg's stderr, where it prints the readings. */
function measure(input: string, filter: string): string {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-i', input, '-af', filter, '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed measuring ${input}: ${r.stderr}`);
  return r.stderr;
}

function peakDb(input: string): number {
  const m = /max_volume: (-?[\d.]+) dB/.exec(measure(input, 'volumedetect'));
  if (!m) throw new Error(`no peak reading for ${input}`);
  return Number(m[1]);
}

function loudness(input: string): { lufs: number; truePeak: number } {
  const out = measure(input, 'ebur128=peak=true');
  const i = /I:\s+(-?[\d.]+) LUFS/.exec(out.slice(out.lastIndexOf('Summary:')));
  const tp = /Peak:\s+(-?[\d.]+) dBFS/.exec(out.slice(out.lastIndexOf('Summary:')));
  if (!i || !tp) throw new Error(`no loudness reading for ${input}`);
  return { lufs: Number(i[1]), truePeak: Number(tp[1]) };
}

function main(): void {
  const packsDir = process.argv[2];
  if (!packsDir) throw new Error('usage: npx tsx scripts/build-sound-set.ts <packs-dir>');
  const tmp = join(OUT_DIR, '.tmp');
  mkdirSync(tmp, { recursive: true });
  try {
    for (const { stem, source, kind } of allSoundStems()) {
      const input = join(packsDir, PACK_ROOTS[source.pack], source.file);
      if (!existsSync(input)) throw new Error(`missing source for ${stem}: ${input}`);
      const out = join(OUT_DIR, stem);
      mkdirSync(dirname(out), { recursive: true });
      const wav = join(tmp, `${stem.replace('/', '_')}.wav`);
      let gainDb: number;
      if (kind === 'sfx') {
        ffmpeg(['-y', '-i', input, '-ac', '1', '-ar', '44100',
          '-af', 'silenceremove=start_periods=1:start_threshold=-50dB', wav]);
        gainDb = SFX_PEAK_DB - peakDb(wav);
      } else {
        ffmpeg(['-y', '-i', input, '-ar', '44100', wav]);
        const { lufs, truePeak } = loudness(wav);
        gainDb = Math.min(MUSIC_LUFS - lufs, MUSIC_PEAK_CEILING_DB - truePeak);
      }
      const vol = `volume=${gainDb.toFixed(2)}dB`;
      ffmpeg(['-y', '-i', wav, '-af', vol, '-c:a', 'libvorbis', '-q:a', kind === 'music' ? '4' : '5', `${out}.ogg`]);
      ffmpeg(['-y', '-i', wav, '-af', vol, '-c:a', 'aac', '-b:a', kind === 'music' ? '128k' : '96k', '-movflags', '+faststart', `${out}.m4a`]);
      console.log(`${stem}  ${gainDb >= 0 ? '+' : ''}${gainDb.toFixed(1)} dB`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
