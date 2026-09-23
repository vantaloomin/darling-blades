import Phaser from 'phaser';
import {
  ART_EVENT_COMPLETE,
  ART_EVENT_FILE,
  ART_EVENT_PROGRESS,
  ArtQueue,
  defaultArtOrder,
  setArtLoader,
  type ArtBatchHooks,
  type ArtFile,
} from '../art/artLoader';
import { loadBatchWithRetry, type ArtPassHooks } from '../art/artRetry';
import { Services } from '../meta/services';

/**
 * The session's card-art loader (1.8). A visual-free scene, `launch`ed by
 * `PreloadScene` so it runs beside every other scene for the life of the game:
 * the menu appears in well under a second and the 1,537 card images stream in
 * behind it, tutorial and starter decks first.
 *
 * The scene is deliberately a thin shell — the queue, the priority lane and
 * the `ensure` semantics all live in the Phaser-free `src/art/artLoader.ts`,
 * which is where their tests live too. All this adds is Phaser's loader and
 * the `game.events` re-emit that `src/ui/artGate.ts` listens to.
 */
export class ArtLoaderScene extends Phaser.Scene {
  private queue: ArtQueue | null = null;

  constructor() {
    super('ArtLoader');
  }

  create(): void {
    // Every card in every saved deck rides just behind the starters and the
    // avatar portraits: the player's own deck is what their first duel draws.
    const saveDeckCards = Services.save.data.decks.flatMap((deck) => [
      ...deck.cards,
      ...(deck.landReserve ?? []),
    ]);
    const queue = new ArtQueue({
      order: defaultArtOrder(saveDeckCards),
      sink: { load: (files, hooks) => this.loadBatch(files, hooks) },
      onFile: (id) => this.game.events.emit(ART_EVENT_FILE, id),
      onProgress: (progress) => this.game.events.emit(ART_EVENT_PROGRESS, progress),
      onComplete: () => this.game.events.emit(ART_EVENT_COMPLETE),
    });
    this.queue = queue;
    setArtLoader(queue);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
    queue.start();
  }

  private onShutdown(): void {
    // Nothing stops this scene in the shipped flow; clear the singleton anyway
    // so a stopped loader can never answer for a live one.
    if (this.queue !== null) setArtLoader(null);
    this.queue = null;
  }

  /**
   * One batch, with one retry for any file that did not arrive
   * (`src/art/artRetry.ts`): a transient failure is asked for again before
   * the batch settles, so a gate never builds over it. A file that fails twice
   * settles without its art (the resolver falls back to the neutral loading
   * texture, and `ensure` must never hang on a 404).
   */
  private loadBatch(files: readonly ArtFile[], hooks: ArtBatchHooks): void {
    loadBatchWithRetry(files, (pending, pass) => this.loadPass(pending, pass), hooks, {
      onRetry: (missing, attempt) =>
        console.warn(
          `ArtLoader: retrying ${missing.length} card art file(s), attempt ${attempt}: ${missing.map((file) => file.id).join(', ')}`,
        ),
    });
  }

  /**
   * One pass of files through this scene's own LoaderPlugin. A file reports
   * only when it actually arrived; whatever did not (an error, a timeout, an
   * image that would not decode) is left for the retry rule to see.
   *
   * The pass ends from a zero-delay timer rather than from inside the COMPLETE
   * handler: `LoaderPlugin.start()`, for the next batch or for a retry, would
   * re-enter the emit it is being called from, and yielding a frame between
   * passes keeps decode and GPU upload from starving the scene on screen.
   */
  private loadPass(files: readonly ArtFile[], pass: ArtPassHooks): void {
    const ids = new Map(files.map((file) => [file.textureKey, file.id]));
    const onFileComplete = (key: string): void => {
      const id = ids.get(key);
      if (id !== undefined) pass.onLoaded(id);
    };
    const onLoadError = (file: Phaser.Loader.File): void => {
      console.warn(`ArtLoader: card art failed to load (${file.key})`);
    };
    const onComplete = (): void => {
      this.load.off('filecomplete', onFileComplete);
      this.load.off('loaderror', onLoadError);
      this.time.delayedCall(0, () => pass.onDone());
    };
    this.load.on('filecomplete', onFileComplete);
    this.load.on('loaderror', onLoadError);
    this.load.once('complete', onComplete);
    for (const file of files) this.load.image(file.textureKey, file.url);
    this.load.start();
  }
}
