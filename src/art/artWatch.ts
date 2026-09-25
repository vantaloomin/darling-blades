import Phaser from 'phaser';
import { ArtArrivals } from './artArrivals';

/**
 * The Phaser side of `src/art/artArrivals.ts` (1.8.1): redraw what was drawn
 * with the loading stand-in once its real card art lands.
 *
 * One book per TextureManager (so one per game), fed by the manager's own
 * `addtexture` event. That event is the ground truth for "this texture can be
 * drawn now", whichever loader path added it: the session queue, its retry
 * pass, or the card-proof harness. It fires after the texture is registered,
 * so a callback can use it straight away.
 *
 * The book's listener lives as long as the game. What waits in it is bounded
 * by lifetimes: a view's wait ends when the view is destroyed or its scene
 * shuts down, whichever comes first, so a restarted scene never inherits a
 * dead scene's waits.
 *
 * Built for the 1.9 art-streaming lane too: a redraw goes back through
 * `ArtResolver.getArt`, which answers with the stand-in and a fresh wait
 * whenever the texture is absent, so a texture that is unloaded and loaded
 * again only needs its views re-applied on the manager's `removetexture`.
 */

const books = new WeakMap<Phaser.Textures.TextureManager, ArtArrivals>();

function bookFor(textures: Phaser.Textures.TextureManager): ArtArrivals {
  const existing = books.get(textures);
  if (existing !== undefined) return existing;
  const book = new ArtArrivals();
  textures.on(Phaser.Textures.Events.ADD, (key: string) => book.arrived(key));
  books.set(textures, book);
  return book;
}

/**
 * Run `onArrive` once, when `textureKey` is added to `textures`. Not tied to
 * any scene: for game-global consumers such as the thumbnail cache, whose
 * textures outlive the scene that baked them. Returns a cancel.
 */
export function whenTextureArrives(
  textures: Phaser.Textures.TextureManager,
  textureKey: string,
  onArrive: () => void,
): () => void {
  return bookFor(textures).watch(textureKey, onArrive);
}

/**
 * Call `redraw` when `textureKey` arrives, provided `owner` is still alive.
 * The wait ends by itself when `owner` is destroyed or its scene shuts down.
 * Returns a cancel for an owner that changes what it shows before the art
 * lands (a CardView given another card); safe to call more than once.
 */
export function redrawWhenArtLands(
  owner: Phaser.GameObjects.GameObject,
  textureKey: string,
  redraw: () => void,
): () => void {
  const scene = owner.scene;
  let done = false;
  let stopWaiting: () => void = () => {};
  const cancel = (): void => {
    if (done) return;
    done = true;
    stopWaiting();
    owner.off(Phaser.GameObjects.Events.DESTROY, cancel);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
  };
  stopWaiting = whenTextureArrives(scene.textures, textureKey, () => {
    cancel();
    if (owner.active) redraw();
  });
  owner.once(Phaser.GameObjects.Events.DESTROY, cancel);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
  return cancel;
}
