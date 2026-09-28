import type Phaser from 'phaser';
import type { ArtRef } from '../art/ArtResolver';
import { redrawWhenArtLands } from '../art/artWatch';
import { fitNowAndWhenArtLands } from './artRefit';

/**
 * A card's art as a single cover-fitted image: the portrait surfaces' way to
 * draw `ArtResolver.getArt`'s answer (1.9, I9). The image is created with
 * whatever the resolver has now, `fit` places it, and if that was the loading
 * stand-in the real texture is swapped in and `fit` runs again when it lands.
 * The wait ends by itself when the image is destroyed or its scene shuts
 * down. The rule lives in `src/ui/artRefit.ts`, tested headless.
 *
 * `fit` must set scale, crop and position from the image's current texture
 * size (`image.width`, `image.frame`), never relative to their current values,
 * because it runs a second time on a texture of a different size.
 *
 * This covers art that arrives late, once: the swap is to the literal
 * `pending` key, and nothing here calls `getArt` again. Art evicted after it
 * landed would leave the image on a destroyed texture; re-applying on texture
 * removal is lane D's job (its streaming design adds leases), not this
 * helper's.
 */
export function addPortraitArt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  ref: ArtRef,
  fit: (image: Phaser.GameObjects.Image) => void,
): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, ref.textureKey, ref.frameName);
  fitNowAndWhenArtLands(image, ref, fit, redrawWhenArtLands);
  return image;
}
