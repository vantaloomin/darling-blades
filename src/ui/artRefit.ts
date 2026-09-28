import type { ArtRef } from '../art/ArtResolver';

/**
 * Card art on a plain image, kept right when the art streams in late (1.9, I9).
 *
 * `ArtResolver.getArt` answers with the loading stand-in while a real art file
 * is still in the loader queue, and names the texture it is waiting for in
 * `pending`. CardView and BoardCardView redraw their whole face when it lands
 * (`src/art/artWatch.ts`); the portrait surfaces (tower portraits, the duel's
 * commander frames, the versus bumper, the practice and shop tiles, the draft
 * seats) are a single image each, cover-fitted into a window. For them the
 * redraw is: swap in the real texture, then run the same fit again, because
 * the fit depends on the texture's size (the stand-in is 640x800, the `lite`
 * tier's files are 320x400).
 *
 * Phaser-free at runtime so the rule is tested headless: the image is anything
 * with `active` and `setTexture` (a Phaser Image is), and the wait is injected.
 * `src/ui/portraitArt.ts` binds it to `redrawWhenArtLands`, which ends the
 * wait when the image is destroyed or its scene shuts down.
 */

/** What the refit needs from an image. A Phaser Image satisfies it. */
export interface ArtImage {
  /** False once the image is destroyed. */
  readonly active: boolean;
  setTexture(key: string, frame?: string | number): unknown;
}

/**
 * Register `redraw` to run once when `textureKey` arrives; returns a cancel.
 * In the game this is `redrawWhenArtLands`, which also cancels the wait when
 * `owner` is destroyed or its scene shuts down.
 */
export type ArtArrivalWait<T> = (owner: T, textureKey: string, redraw: () => void) => () => void;

/**
 * Fit `image` now and, if it is showing the stand-in, again once the real
 * texture lands, after swapping that texture in. `fit` must be idempotent: it
 * sets the image's scale, crop and position from its current texture size,
 * never relative to what they were. Returns a cancel for the wait (a no-op
 * when the art was already in).
 *
 * The arrival callback checks `image.active` itself as well: the wait is
 * expected to end with the image, but a redraw on a destroyed GameObject
 * throws inside the loader's event and stalls the art queue, so the guard
 * does not rely on the caller's wait being wired right.
 */
export function fitNowAndWhenArtLands<T extends ArtImage>(
  image: T,
  ref: ArtRef,
  fit: (image: T) => void,
  wait: ArtArrivalWait<T>,
): () => void {
  fit(image);
  const pending = ref.pending;
  if (pending === undefined) return () => {};
  return wait(image, pending, () => {
    if (!image.active) return;
    // A real art file is one whole texture: no atlas frame.
    image.setTexture(pending);
    fit(image);
  });
}
