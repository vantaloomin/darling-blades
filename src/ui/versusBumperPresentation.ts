import type { AnimationLevel } from '../platform/animPolicy';
import { theme } from './theme';

export interface VersusBumperGate {
  animations: AnimationLevel;
  tutorial: boolean;
  replay: boolean;
  internalRestart: boolean;
}

export interface VersusBumperMotion {
  totalMs: number;
  entranceMs: number;
  exitMs: number;
  exitAtMs: number;
  panelSlidePx: number;
  versusScaleFrom: number;
}

const TOTAL_MS = 1_400;

const MOTION: Record<Exclude<AnimationLevel, 'off'>, VersusBumperMotion> = {
  full: {
    totalMs: TOTAL_MS,
    entranceMs: theme.motion.slow,
    exitMs: theme.motion.slow,
    exitAtMs: TOTAL_MS - theme.motion.slow,
    panelSlidePx: 88,
    versusScaleFrom: 0.96,
  },
  reduced: {
    totalMs: TOTAL_MS,
    entranceMs: theme.motion.base,
    exitMs: theme.motion.base,
    exitAtMs: TOTAL_MS - theme.motion.base,
    panelSlidePx: 0,
    versusScaleFrom: 1,
  },
};

/** The intro belongs to duel entry, never to playback, teaching, or scene reuse. */
export function shouldPlayVersusBumper(gate: VersusBumperGate): boolean {
  return gate.animations !== 'off' && !gate.tutorial && !gate.replay && !gate.internalRestart;
}

export function versusBumperMotion(level: Exclude<AnimationLevel, 'off'>): VersusBumperMotion {
  return MOTION[level];
}

/**
 * Give each opponent a stable nearby transposition without creating another
 * pitch implementation. AudioManager owns the final 0.5..2 clamp.
 */
export function versusLeitmotifPitch(identity: string): number {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) hash = (hash * 31 + identity.charCodeAt(i)) >>> 0;
  const semitones = [-2, -1, 0, 1, 2] as const;
  return 2 ** (semitones[hash % semitones.length] / 12);
}
