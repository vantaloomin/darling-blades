import type { AnimationLevel } from '../platform/animPolicy';
import { theme } from './theme';

export interface VersusBumperGate {
  animations: AnimationLevel;
  tutorial: boolean;
  replay: boolean;
  internalRestart: boolean;
}

export interface VersusBumperMotion {
  entranceMs: number;
  holdMs: number;
  exitMs: number;
  panelSlidePx: number;
  versusScaleFrom: number;
}

export type VersusBumperSide = 'left' | 'right';
export interface VersusBumperPoint { x: number; y: number }

export const VERSUS_BUMPER_LAYOUT = {
  width: theme.design.width,
  height: theme.design.height,
  splitTopX: 704,
  splitBottomX: 576,
} as const;

/** Design-space polygons shared by the cover plates and portrait masks. */
export function versusBumperMaskPoints(side: VersusBumperSide): VersusBumperPoint[] {
  const { width, height, splitTopX, splitBottomX } = VERSUS_BUMPER_LAYOUT;
  return side === 'left'
    ? [{ x: 0, y: 0 }, { x: splitTopX, y: 0 }, { x: splitBottomX, y: height }, { x: 0, y: height }]
    : [
      { x: splitTopX, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: splitBottomX, y: height },
    ];
}

/** The camera applies this exact design-to-backing-store transform. */
export function versusBumperCanvasMaskPoints(
  side: VersusBumperSide,
  renderScale: 1 | 1.5 | 2,
): VersusBumperPoint[] {
  return versusBumperMaskPoints(side).map(({ x, y }) => ({ x: x * renderScale, y: y * renderScale }));
}

const HOLD_MS = 10_000;

const MOTION: Record<Exclude<AnimationLevel, 'off'>, VersusBumperMotion> = {
  full: {
    entranceMs: theme.motion.slow,
    holdMs: HOLD_MS,
    exitMs: theme.motion.slow,
    panelSlidePx: 88,
    versusScaleFrom: 0.96,
  },
  reduced: {
    entranceMs: theme.motion.base,
    holdMs: HOLD_MS,
    exitMs: theme.motion.base,
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
