import type Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import { holdArt } from '../art/artWatch';
import { fitAndHoldArt } from './artRefit';

/**
 * A card's art as a single cover-fitted image: the portrait surfaces' one way
 * to draw card art (1.9: I9, then lane D's S4). The image is created with
 * whatever `ArtResolver.getArt` has for `cardId` now, and `fit` places it. The
 * image holds what it draws (`holdArt`, docs/plan-art-streaming.md sections 3
 * and 4): a lease while art streams through the store, a redraw when better
 * art lands (the stand-in or the half texture giving way to the full file),
 * and, when the drawn texture is removed (evicted, or swept at a WebGL context
 * restore), a redraw in the same tick onto whatever is resident. Each redraw
 * resolves the card's art again, swaps it in and runs `fit` again. The hold
 * ends by itself when the image is destroyed or its scene shuts down. The rule
 * lives in `src/ui/artRefit.ts`, tested headless.
 *
 * `fit` must set scale, crop and position from the image's current texture
 * size (`image.width`, `image.frame`), never relative to their current values,
 * because it runs again on a texture of a different size.
 *
 * Returns null when there is no resolver (nothing has booted the art). Throws
 * what `getArt` throws for a card with no art at all, as the lookup always did,
 * so a caller's fallback for missing art still applies.
 */
export function addPortraitArt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cardId: string,
  fit: (image: Phaser.GameObjects.Image) => void,
): Phaser.GameObjects.Image | null {
  const resolver = Art.resolver;
  if (resolver === null) return null;
  const ref = resolver.getArt(cardId);
  const image = scene.add.image(x, y, ref.textureKey, ref.frameName);
  fitAndHoldArt(image, ref, () => resolver.getArt(cardId), fit, holdArt);
  return image;
}
