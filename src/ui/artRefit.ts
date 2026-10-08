import type { ArtRef } from '../art/ArtResolver';

/**
 * Card art on a plain image, kept right when the art streams in late or is
 * unloaded (1.9: I9, then lane D's S4).
 *
 * `ArtResolver.getArt` answers with the best resident texture (the half file
 * on desktop while art streams through the store) or the loading stand-in
 * while a real art file is still on its way, and names the texture it is
 * waiting for in `pending`. CardView and BoardCardView redraw their whole face
 * (`src/art/artWatch.ts` `holdArt`); the portrait surfaces (tower portraits,
 * the duel's commander frames, the versus bumper, the practice and shop tiles,
 * the draft seats) are a single image each, cover-fitted into a window. For
 * them a redraw is: resolve the card's art again, swap that texture in, and
 * run the same fit again, because the fit depends on the texture's size (the
 * stand-in and the full file are 640x800, a half file is 320x400).
 *
 * It resolves again rather than swapping in the literal `pending` key because
 * a redraw also comes from the removal belt: when the texture the image draws
 * is removed (evicted, or swept at a WebGL context restore), the answer is the
 * half texture or the stand-in, not the key that was just removed.
 *
 * Phaser-free at runtime so the rule is tested headless: the image is anything
 * with `active` and `setTexture` (a Phaser Image is), and the hold is
 * injected. `src/ui/portraitArt.ts` binds it to `holdArt`, which leases what
 * the image draws and ends when the image is destroyed or its scene shuts
 * down.
 */

/** What the refit needs from an image. A Phaser Image satisfies it. */
export interface ArtImage {
  /** False once the image is destroyed. */
  readonly active: boolean;
  setTexture(key: string, frame?: string | number): unknown;
}

/**
 * Hold what `owner` draws (`ref`) and call `reapply` once, when better art
 * lands or the drawn texture is removed; returns a cancel. In the game this is
 * `holdArt`, which also ends the hold when `owner` is destroyed or its scene
 * shuts down.
 */
export type ArtHold<T> = (owner: T, ref: ArtRef, reapply: () => void) => () => void;

/**
 * Fit `image`, which already shows `first`, and hold it: whenever the hold
 * fires, resolve the art again, swap that texture in, fit again and hold the
 * new answer. `fit` must be idempotent: it sets the image's scale, crop and
 * position from its current texture size, never relative to what they were.
 *
 * The redraw checks `image.active` itself as well: the hold is expected to end
 * with the image, but a redraw on a destroyed GameObject throws inside the
 * texture manager's event, so the guard does not rely on the caller's hold
 * being wired right.
 */
export function fitAndHoldArt<T extends ArtImage>(
  image: T,
  first: ArtRef,
  resolve: () => ArtRef,
  fit: (image: T) => void,
  hold: ArtHold<T>,
): void {
  const draw = (ref: ArtRef): void => {
    fit(image);
    hold(image, ref, () => {
      if (!image.active) return;
      const next = resolve();
      image.setTexture(next.textureKey, next.frameName);
      draw(next);
    });
  };
  draw(first);
}
