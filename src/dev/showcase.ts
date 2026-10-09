import type Phaser from 'phaser';
import type { ReplayLog } from '../meta/Replay';

/**
 * Showcase mode (dev server only): `?showcase=<name>` plays the replay log
 * `showcase/<name>.json` full screen with no replay chrome, for trailer
 * footage. scripts/showcase-match.ts writes the logs; scripts/showcase-capture.mjs
 * records the result. `&speed=2` halves the pause between actions; gameBoot
 * reads `&scale=` itself (it sizes the canvas before this module loads).
 *
 * The dev server serves files under the repo root, so the gitignored
 * `showcase/` folder needs no copy into public/. gameBoot imports this module
 * only inside its `import.meta.env.DEV` branch, so it never reaches a build.
 */

export interface ShowcaseParams {
  name: string;
  speed: number;
}

/** The showcase request in a query string, or null when there is none. */
export function showcaseParams(search: string): ShowcaseParams | null {
  const params = new URLSearchParams(search);
  const name = params.get('showcase');
  if (!name || !/^[a-z0-9-]+$/.test(name)) return null;
  const speed = Number(params.get('speed') ?? 1);
  return { name, speed: Number.isFinite(speed) && speed > 0 ? speed : 1 };
}

/** A showcase log: a replay plus what the duel screen should call the hero's deck. */
export type ShowcaseLog = ReplayLog & { showcase?: { deckName?: string } };

declare global {
  interface Window {
    /** Where the showcase is: the capture script records from `playing` to `done`. */
    __showcase?: { state: 'loading' | 'starting' | 'playing' | 'done' | 'failed'; error?: string };
    /**
     * Frame-stepped capture: `begin(fps)` stops the game's own loop, then each
     * `step()` advances exactly one frame of game time and draws it. Every
     * timer and tween runs on Phaser's clock, so the footage is smooth at any
     * fps however slowly the machine draws.
     */
    __showcaseStepper?: { begin(fps: number): void; step(frames?: number): string | undefined };
  }
}

function installStepper(game: Phaser.Game): void {
  let time = 0;
  let frameMs = 1000 / 60;
  window.__showcaseStepper = {
    begin(fps: number) {
      frameMs = 1000 / fps;
      time = game.loop.time;
      game.loop.sleep();
    },
    step(frames = 1) {
      for (let i = 0; i < frames; i++) {
        time += frameMs;
        game.step(time, frameMs);
      }
      return window.__showcase?.state;
    },
  };
}

/** Wait for the boot chain to reach the main menu, then open the showcase duel. */
export async function startShowcase(game: Phaser.Game, params: ShowcaseParams): Promise<void> {
  window.__showcase = { state: 'loading' };
  try {
    const response = await fetch(`/showcase/${params.name}.json`);
    if (!response.ok) throw new Error(`showcase/${params.name}.json: HTTP ${response.status}`);
    const log = (await response.json()) as ShowcaseLog;
    while (!game.scene.isActive('MainMenu')) await new Promise((r) => setTimeout(r, 100));
    for (const scene of game.scene.getScenes(true)) {
      const key = scene.sys.settings.key;
      if (key !== 'ArtLoader') game.scene.stop(key);
    }
    installStepper(game);
    const { showcase, ...replay } = log;
    game.scene.start('Duel', { replay, showcase: { speed: params.speed, deckName: showcase?.deckName ?? 'Showcase' } });
    // DuelScene moves this to `playing` once its art is in and the board is built.
    window.__showcase = { state: 'starting' };
  } catch (error) {
    window.__showcase = { state: 'failed', error: String(error) };
    console.error('[showcase]', error);
  }
}
