import { describe, expect, it, vi } from 'vitest';
import { ArtQueue, type ArtBatchHooks, type ArtFile } from '../../src/art/artLoader';
import { ART_LOAD_ATTEMPTS, loadBatchWithRetry, type ArtPassHooks } from '../../src/art/artRetry';

/**
 * The one-retry rule for card art: a file that did not arrive is asked for once
 * more before its batch settles, so a gate never builds a scene over a
 * transient failure, and a file that fails twice still settles so a gate can
 * never hang. The pass is a hand-driven stand-in for the scene's LoaderPlugin.
 */

const file = (id: string): ArtFile => ({ id, textureKey: `artfile-${id}`, url: `assets/art/cards/${id}.webp` });

/** A loader pass whose outcome per file is scripted: `fails[id]` = how many requests fail before one succeeds. */
function scriptedPass(fails: Record<string, number>) {
  const requests: string[][] = [];
  const seen: Record<string, number> = {};
  const pass = (files: readonly ArtFile[], hooks: ArtPassHooks): void => {
    requests.push(files.map((f) => f.id));
    for (const f of files) {
      seen[f.id] = (seen[f.id] ?? 0) + 1;
      if (seen[f.id] > (fails[f.id] ?? 0)) hooks.onLoaded(f.id);
    }
    hooks.onDone();
  };
  return { pass, requests };
}

function recordingHooks(): ArtBatchHooks & { files: string[]; done: number } {
  const hooks = {
    files: [] as string[],
    done: 0,
    onFile: (id: string) => void hooks.files.push(id),
    onDone: () => void (hooks.done += 1),
  };
  return hooks;
}

describe('loading a batch with one retry', () => {
  it('asks once when everything arrives', () => {
    const { pass, requests } = scriptedPass({});
    const hooks = recordingHooks();
    loadBatchWithRetry([file('a'), file('b')], pass, hooks);
    expect(requests).toEqual([['a', 'b']]);
    expect(hooks.files.sort()).toEqual(['a', 'b']);
    expect(hooks.done).toBe(1);
  });

  it('asks again for only the files that did not arrive, then settles with them in', () => {
    const { pass, requests } = scriptedPass({ b: 1 });
    const hooks = recordingHooks();
    const onRetry = vi.fn();
    loadBatchWithRetry([file('a'), file('b'), file('c')], pass, hooks, { onRetry });
    expect(requests).toEqual([['a', 'b', 'c'], ['b']]);
    expect(hooks.files.sort()).toEqual(['a', 'b', 'c']);
    expect(hooks.done).toBe(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0].map((f: ArtFile) => f.id)).toEqual(['b']);
  });

  it('settles a file that fails every attempt without it, after exactly the allowed attempts', () => {
    const { pass, requests } = scriptedPass({ b: 99 });
    const hooks = recordingHooks();
    loadBatchWithRetry([file('a'), file('b')], pass, hooks);
    expect(requests).toHaveLength(ART_LOAD_ATTEMPTS);
    expect(ART_LOAD_ATTEMPTS).toBeGreaterThanOrEqual(2);
    expect(hooks.files).toEqual(['a']);
    expect(hooks.done).toBe(1);
  });

  it('does not settle the batch while a retry is still out', () => {
    // The retry pass is left open: the batch must not be over yet.
    const passes: { files: string[]; hooks: ArtPassHooks }[] = [];
    const hooks = recordingHooks();
    loadBatchWithRetry([file('a'), file('b')], (files, h) => void passes.push({ files: files.map((f) => f.id), hooks: h }), hooks);
    passes[0].hooks.onLoaded('a');
    passes[0].hooks.onDone();
    expect(passes).toHaveLength(2);
    expect(hooks.done).toBe(0);
    passes[1].hooks.onLoaded('b');
    passes[1].hooks.onDone();
    expect(hooks.done).toBe(1);
    expect(hooks.files).toEqual(['a', 'b']);
  });

  it('reports each file once and ignores anything a pass was not asked for', () => {
    const hooks = recordingHooks();
    loadBatchWithRetry(
      [file('a')],
      (_files, h) => {
        h.onLoaded('a');
        h.onLoaded('a');
        h.onLoaded('stranger');
        h.onDone();
        h.onDone();
      },
      hooks,
    );
    expect(hooks.files).toEqual(['a']);
    expect(hooks.done).toBe(1);
  });

  it('settles an empty batch without asking the loader', () => {
    const pass = vi.fn();
    const hooks = recordingHooks();
    loadBatchWithRetry([], pass, hooks);
    expect(pass).not.toHaveBeenCalled();
    expect(hooks.done).toBe(1);
  });
});

describe('what a gate sees through the art queue', () => {
  /** An ArtQueue whose batches go through the retry rule and a hand-driven pass. */
  function queueWithManualPasses(order: string[]) {
    const passes: { files: string[]; hooks: ArtPassHooks }[] = [];
    const queue = new ArtQueue({
      order,
      artKeyFor: (id) => id,
      batchSize: 8,
      sink: {
        load: (files, hooks) =>
          loadBatchWithRetry(files, (pending, h) => void passes.push({ files: pending.map((f) => f.id), hooks: h }), hooks),
      },
    });
    return { queue, passes };
  }

  it('keeps a gate waiting through a transient failure and opens it once the retry lands', async () => {
    const { queue, passes } = queueWithManualPasses(['a', 'b']);
    let open = false;
    void queue.ensure(['b']).then(() => (open = true));
    passes[0].hooks.onLoaded('a');
    passes[0].hooks.onDone(); // b failed once
    await Promise.resolve();
    expect(open).toBe(false);
    expect(queue.isLoaded('b')).toBe(false);
    passes[1].hooks.onLoaded('b');
    passes[1].hooks.onDone();
    await Promise.resolve();
    expect(open).toBe(true);
  });

  it('still opens the gate when a file fails both attempts', async () => {
    const { queue, passes } = queueWithManualPasses(['a']);
    let open = false;
    void queue.ensure(['a']).then(() => (open = true));
    passes[0].hooks.onDone();
    passes[1].hooks.onDone();
    await Promise.resolve();
    expect(open).toBe(true);
  });
});
