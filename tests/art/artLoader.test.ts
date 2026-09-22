import { beforeEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../src/data/art-manifest.json';
import {
  ArtQueue,
  artFileUrl,
  artKeyFor,
  artQueueOrder,
  defaultArtOrder,
  type ArtBatchHooks,
  type ArtFile,
} from '../../src/art/artLoader';
import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import {
  TUTORIAL_AI_DECK,
  TUTORIAL_LAND_RESERVE,
  TUTORIAL_PLAYER_DECK,
} from '../../src/data/tutorial';
import { setQualityTier } from '../../src/platform/quality';

/**
 * A hand-driven stand-in for the scene's LoaderPlugin: it records each batch
 * and settles only when the test says so, which is what makes the batching and
 * the priority lane observable. Phaser is never imported here — the queue, the
 * ordering rule and the `ensure` semantics are the Phaser-free half by design
 * (the scene is a thin shell over exactly this interface).
 */
class FakeSink {
  batches: ArtFile[][] = [];
  private hooks: ArtBatchHooks[] = [];

  load(files: readonly ArtFile[], hooks: ArtBatchHooks): void {
    this.batches.push([...files]);
    this.hooks.push(hooks);
  }

  /** Ids of the oldest open batch. */
  get openIds(): string[] {
    return (this.batches[0] ?? []).map((file) => file.id);
  }

  /** Report every file of the oldest open batch, then finish it. */
  finishBatch(options: { skip?: readonly string[] } = {}): void {
    const files = this.batches.shift();
    const hooks = this.hooks.shift();
    if (files === undefined || hooks === undefined) throw new Error('no open batch');
    for (const file of files) {
      if (options.skip?.includes(file.id)) continue;
      hooks.onFile(file.id);
    }
    hooks.onDone();
  }
}

const KEYS = ['k0', 'k1', 'k2', 'k3', 'k4', 'k5'];

function queueOf(sink: FakeSink, batchSize = 2): ArtQueue {
  return new ArtQueue({
    order: KEYS,
    sink: { load: (files, hooks) => sink.load(files, hooks) },
    fileUrl: (key) => `assets/art/cards/${key}.webp`,
    // 'donor' stands in for a card whose art is another card's file (artRef).
    artKeyFor: (id) => (id === 'donor' ? 'k3' : id),
    batchSize,
  });
}

describe('artQueueOrder', () => {
  it('puts the priority groups first, in order, deduplicated', () => {
    const order = artQueueOrder({
      manifest: ['a', 'b', 'c', 'd'],
      artKeyFor: (id) => id,
      isCardKey: () => true,
      groups: [['c'], ['a', 'c'], ['d']],
    });

    expect(order).toEqual(['c', 'a', 'd', 'b']);
  });

  it('maps a priority card id through artRef and drops ids with no file', () => {
    const order = artQueueOrder({
      manifest: ['donor-file', 'other'],
      artKeyFor: (id) => (id === 'borrower' ? 'donor-file' : id),
      isCardKey: () => true,
      groups: [['nothing-listed', 'borrower']],
    });

    expect(order).toEqual(['donor-file', 'other']);
  });

  it('sends every non-card manifest key to the tail', () => {
    const order = artQueueOrder({
      manifest: ['land-forest--base', 'card-a', 'land-plains--ragnarok', 'card-b'],
      artKeyFor: (id) => id,
      isCardKey: (key) => !key.includes('--'),
      groups: [['card-b']],
    });

    expect(order).toEqual(['card-b', 'card-a', 'land-forest--base', 'land-plains--ragnarok']);
  });
});

describe('defaultArtOrder', () => {
  const manifestKeys = new Set<string>(manifest.cards);
  const order = defaultArtOrder();

  it('covers the manifest exactly once', () => {
    expect(order).toHaveLength(manifest.cards.length);
    expect(new Set(order).size).toBe(order.length);
    expect(new Set(order)).toEqual(manifestKeys);
  });

  it('leads with the tutorial duel', () => {
    const tutorial = new Set(
      [...TUTORIAL_PLAYER_DECK, ...TUTORIAL_AI_DECK, ...TUTORIAL_LAND_RESERVE]
        .map(artKeyFor)
        .filter((key) => manifestKeys.has(key)),
    );
    expect(tutorial.size).toBeGreaterThan(0);
    expect(new Set(order.slice(0, tutorial.size))).toEqual(tutorial);
  });

  it('puts the starter decks ahead of the avatar portraits', () => {
    const starters = new Set(
      STARTER_DECKS.flatMap((deck) => [
        ...(deck.reserveCards ?? deck.cards),
        ...(deck.landReserve ?? []),
      ])
        .map(artKeyFor)
        .filter((key) => manifestKeys.has(key)),
    );
    const portraitsOutsideStarters = AVATARS.map((avatar) => artKeyFor(avatar.portraitCardId))
      .filter((key) => manifestKeys.has(key) && !starters.has(key));

    const lastStarter = Math.max(...[...starters].map((key) => order.indexOf(key)));
    const firstPortrait = Math.min(...portraitsOutsideStarters.map((key) => order.indexOf(key)));
    expect(portraitsOutsideStarters.length).toBeGreaterThan(0);
    expect(lastStarter).toBeLessThan(firstPortrait);
  });

  it('keeps the styled basic-land files last', () => {
    const styled = order.filter((key) => CARD_DB[key] === undefined);
    expect(styled.length).toBeGreaterThan(0);
    expect(order.slice(order.length - styled.length)).toEqual(styled);
  });

  it('moves the save’s own decks ahead of the rest of the manifest', () => {
    const plain = defaultArtOrder();
    const lateCard = plain[plain.length - 200];
    const withSave = defaultArtOrder([lateCard]);
    expect(withSave.indexOf(lateCard)).toBeLessThan(plain.indexOf(lateCard));
  });
});

describe('artFileUrl', () => {
  beforeEach(() => setQualityTier(null));

  it('loads the full-res set on the full tier', () => {
    expect(artFileUrl(manifest.cards[0], 'full')).toBe(`assets/art/cards/${manifest.cards[0]}.webp`);
  });

  it('prefers the half-res set on the lite tier where a half file exists', () => {
    // The manifest's `half` list is generated from local disk, so the lookup is
    // injected rather than read from it — the rule is what is under test.
    const hasHalf = (key: string): boolean => key === 'has-half';
    expect(artFileUrl('has-half', 'lite', hasHalf)).toBe('assets/art/cards-half/has-half.webp');
    expect(artFileUrl('no-half-file', 'lite', hasHalf)).toBe('assets/art/cards/no-half-file.webp');
    expect(artFileUrl('has-half', 'full', hasHalf)).toBe('assets/art/cards/has-half.webp');
  });

  it('defaults to the detected tier (full under vitest)', () => {
    expect(artFileUrl(manifest.cards[0])).toContain('/cards/');
  });
});

describe('ArtQueue', () => {
  it('loads in batches and never re-queues a settled file', () => {
    const sink = new FakeSink();
    const queue = queueOf(sink);
    queue.start();

    expect(sink.openIds).toEqual(['k0', 'k1']);
    sink.finishBatch();
    expect(sink.openIds).toEqual(['k2', 'k3']);
    sink.finishBatch();
    expect(sink.openIds).toEqual(['k4', 'k5']);
    sink.finishBatch();
    expect(sink.batches).toHaveLength(0);
    expect(queue.progress()).toEqual({ loaded: 6, total: 6 });
  });

  it('reports isLoaded per file and treats an unlisted id as loaded', () => {
    const sink = new FakeSink();
    const queue = queueOf(sink);
    queue.start();

    expect(queue.isLoaded('k0')).toBe(false);
    expect(queue.isLoaded('not-in-the-manifest')).toBe(true);
    sink.finishBatch();
    expect(queue.isLoaded('k0')).toBe(true);
    expect(queue.isLoaded('k4')).toBe(false);
  });

  it('follows artRef when asked about a borrowed art file', () => {
    const sink = new FakeSink();
    const queue = queueOf(sink);
    queue.start();
    sink.finishBatch();
    expect(queue.isLoaded('donor')).toBe(false);
    sink.finishBatch();
    expect(queue.isLoaded('donor')).toBe(true);
  });

  it('moves a requested file to the front of the very next batch', () => {
    const sink = new FakeSink();
    const queue = queueOf(sink);
    queue.start();
    expect(sink.openIds).toEqual(['k0', 'k1']);

    queue.request(['k5']);
    sink.finishBatch();
    expect(sink.openIds).toEqual(['k5', 'k2']);

    sink.finishBatch();
    expect(sink.openIds).toEqual(['k3', 'k4']);
    sink.finishBatch();
    expect(sink.batches).toHaveLength(0);
    expect(queue.progress()).toEqual({ loaded: 6, total: 6 });
  });

  it('resolves ensure once every requested file is in', async () => {
    const sink = new FakeSink();
    const queue = queueOf(sink);
    queue.start();

    const settled = vi.fn();
    const waiting = queue.ensure(['k5', 'k4']).then(settled);
    sink.finishBatch();
    expect(sink.openIds).toEqual(['k5', 'k4']);
    expect(settled).not.toHaveBeenCalled();

    sink.finishBatch();
    await waiting;
    expect(settled).toHaveBeenCalledOnce();
  });

  it('resolves ensure immediately for ids with no real art file', async () => {
    const sink = new FakeSink();
    const queue = queueOf(sink);
    queue.start();

    await expect(queue.ensure(['placeholder-only'])).resolves.toBeUndefined();
    expect(sink.batches).toHaveLength(1);
  });

  it('resolves ensure for a file the loader failed on, so a gate cannot hang', async () => {
    const sink = new FakeSink();
    const queue = queueOf(sink);
    queue.start();

    const waiting = queue.ensure(['k0']);
    // The 404 path: the loader reports an error instead of a file, so only the
    // batch's completion settles it.
    sink.finishBatch({ skip: ['k0'] });
    await expect(waiting).resolves.toBeUndefined();
    expect(queue.isLoaded('k0')).toBe(true);
  });

  it('reports progress per file and completes exactly once', () => {
    const sink = new FakeSink();
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const onFile = vi.fn();
    const queue = new ArtQueue({
      order: KEYS,
      sink: { load: (files, hooks) => sink.load(files, hooks) },
      fileUrl: (key) => key,
      artKeyFor: (id) => id,
      batchSize: 6,
      onFile,
      onProgress,
      onComplete,
    });
    queue.start();
    sink.finishBatch();

    expect(onFile).toHaveBeenCalledTimes(6);
    expect(onProgress).toHaveBeenLastCalledWith({ loaded: 6, total: 6 });
    expect(onComplete).toHaveBeenCalledOnce();

    queue.request(['k0']);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('lists what a gate is still waiting on, and nothing once it is in', () => {
    const sink = new FakeSink();
    const queue = queueOf(sink);
    queue.start();

    expect(queue.missing(['k0', 'unlisted', 'k0'])).toEqual(['k0']);
    expect(queue.missing(null)).toHaveLength(6);
    sink.finishBatch();
    expect(queue.missing(['k0', 'k1'])).toEqual([]);
    expect(queue.missing(null)).toEqual(['k2', 'k3', 'k4', 'k5']);
  });
});
