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
   * One batch through this scene's own LoaderPlugin. A failed file is logged
   * and counted as settled (the resolver falls back to the neutral loading
   * texture, and `ensure` must never hang on a 404).
   *
   * The next batch is kicked from a zero-delay timer rather than from inside
   * the COMPLETE handler: `LoaderPlugin.start()` would re-enter the emit it is
   * being called from, and yielding a frame between batches keeps decode and
   * GPU upload from starving the scene that is actually on screen.
   */
  private loadBatch(files: readonly ArtFile[], hooks: ArtBatchHooks): void {
    const ids = new Map(files.map((file) => [file.textureKey, file.id]));
    const onFileComplete = (key: string): void => {
      const id = ids.get(key);
      if (id !== undefined) hooks.onFile(id);
    };
    const onLoadError = (file: Phaser.Loader.File): void => {
      console.warn(`ArtLoader: card art failed to load (${file.key})`);
      onFileComplete(file.key);
    };
    const onComplete = (): void => {
      this.load.off('filecomplete', onFileComplete);
      this.load.off('loaderror', onLoadError);
      this.time.delayedCall(0, () => hooks.onDone());
    };
    this.load.on('filecomplete', onFileComplete);
    this.load.on('loaderror', onLoadError);
    this.load.once('complete', onComplete);
    for (const file of files) this.load.image(file.textureKey, file.url);
    this.load.start();
  }
}
