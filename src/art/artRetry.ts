import type { ArtBatchHooks, ArtFile } from './artLoader';

/**
 * One more pass for a card-art file that did not arrive (1.8).
 *
 * The session loader (`src/scenes/ArtLoaderScene.ts`) used to count a failed
 * file as settled the moment Phaser gave up on it. Settled is what `ensureArt`
 * waits for, so a gated scene built over the neutral stand-in, and the card
 * kept that stand-in for the rest of the session: nothing asked again.
 *
 * Phaser already re-sends a request that fails at the network level, twice
 * and at once (`loader.maxRetries`, 2 by default); on the desktop build that
 * is what recovered every `ERR_CONNECTION_REFUSED` measured on 2026-09-23 (see
 * docs/desktop-build.md for when those happen). What got past it: an error
 * status or an image that would not decode, which Phaser does not retry, and
 * a failure that outlasts three back-to-back attempts. Proven with injected
 * failures on a release build: three files failing three sends in a row never
 * arrived before this rule and all arrived with it.
 *
 * So a batch is now loaded in passes. A file that did not arrive in the first
 * pass, for any reason, is asked for once more in a second pass made of only
 * those files, after the rest of the batch is done, which also puts time
 * between the attempts. Only then does the batch settle, and a file that fails
 * the second pass settles without its art exactly as before, so a gate can
 * still never hang. The same loader runs on the web.
 *
 * Phaser-free, so the rule is tested headless; the scene supplies the pass.
 */

/** Passes per file before it settles without its art: the first and one more. */
export const ART_LOAD_ATTEMPTS = 2;

/** What one pass reports back: each file that arrived, then that the pass is over. */
export interface ArtPassHooks {
  onLoaded: (id: string) => void;
  onDone: () => void;
}

/** Load these files through the real loader, once each. */
export type ArtLoadPass = (files: readonly ArtFile[], hooks: ArtPassHooks) => void;

export interface ArtRetryOptions {
  /** Defaults to `ART_LOAD_ATTEMPTS`; anything below 1 is treated as 1. */
  attempts?: number;
  /** Told which files are about to be asked for again, and which attempt that is. */
  onRetry?: (files: readonly ArtFile[], attempt: number) => void;
}

/**
 * Load `files` through `pass`, retrying what did not arrive, and report to
 * `hooks` exactly as a single-pass loader would: `onFile` once for each file
 * that arrived, then `onDone` once, after the last pass.
 */
export function loadBatchWithRetry(
  files: readonly ArtFile[],
  pass: ArtLoadPass,
  hooks: ArtBatchHooks,
  opts: ArtRetryOptions = {},
): void {
  const attempts = Math.max(1, Math.floor(opts.attempts ?? ART_LOAD_ATTEMPTS));
  const arrived = new Set<string>();

  const run = (pending: readonly ArtFile[], attempt: number): void => {
    const asked = new Set(pending.map((file) => file.id));
    let over = false;
    pass(pending, {
      onLoaded: (id) => {
        if (over || !asked.has(id) || arrived.has(id)) return;
        arrived.add(id);
        hooks.onFile(id);
      },
      onDone: () => {
        if (over) return;
        over = true;
        const missing = pending.filter((file) => !arrived.has(file.id));
        if (missing.length > 0 && attempt < attempts) {
          opts.onRetry?.(missing, attempt + 1);
          run(missing, attempt + 1);
          return;
        }
        hooks.onDone();
      },
    });
  };

  if (files.length === 0) {
    hooks.onDone();
    return;
  }
  run(files, 1);
}
