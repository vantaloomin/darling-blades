import Phaser from 'phaser';

/**
 * Round card art for the phone Duel's medallions (docs/plan-mobile-overhaul.md
 * C4, M28). A disc of art is baked once per source texture and size into a
 * dynamic texture, so the board draws plain images: no per-tile geometry mask,
 * which would stencil in world space and cost a batch flush per medallion.
 *
 * The square is cut from the 4:5 art centred across and biased toward the
 * top, where the faces sit (the mocks' object-position 50% 14%). The bake
 * draws through the renderer, never the source image: the art store can
 * release a texture's bitmap once it is on the GPU. Bakes are shared and
 * counted: the last holder to release one removes the texture.
 */

/** Bakes are this many texture pixels per design pixel (a 2x render plus headroom for a zoomed camera). */
const OVERSAMPLE = 2.5;
/** Sizes round up to a step so close diameters share one bake. */
const SIZE_STEP = 16;
const TOP_BIAS = 0.14;

const holders = new Map<string, number>();

export function medallionTexturePx(diameter: number): number {
  return Math.max(SIZE_STEP, Math.ceil((diameter * OVERSAMPLE) / SIZE_STEP) * SIZE_STEP);
}

/**
 * The key of a disc of `textureKey`'s art for a `diameter` px medallion,
 * baking it on first use. Each call takes a hold; give it back with
 * `releaseMedallionArt` when the medallion is redrawn or destroyed.
 */
export function holdMedallionArt(scene: Phaser.Scene, textureKey: string, frameName: string | undefined, diameter: number): string {
  const px = medallionTexturePx(diameter);
  const key = `medallion|${textureKey}|${frameName ?? ''}|${px}`;
  if (!scene.textures.exists(key)) {
    const dt = scene.textures.addDynamicTexture(key, px, px);
    if (dt) {
      const image = scene.make.image({ key: textureKey, frame: frameName }, false);
      const side = Math.min(image.width, image.height);
      const scale = px / side;
      image.setOrigin(0).setScale(scale);
      dt.draw(image, -((image.width - side) / 2) * scale, -((image.height - side) * TOP_BIAS) * scale);
      image.destroy();
      const corners = scene.make.graphics({}, false);
      corners.fillStyle(0xffffff, 1);
      for (const quadrant of cornerPolygons(px)) corners.fillPoints(quadrant, true);
      dt.erase(corners);
      corners.destroy();
    }
  }
  holders.set(key, (holders.get(key) ?? 0) + 1);
  return key;
}

export function releaseMedallionArt(scene: Phaser.Scene, key: string): void {
  const count = (holders.get(key) ?? 0) - 1;
  if (count > 0) {
    holders.set(key, count);
    return;
  }
  holders.delete(key);
  if (scene.textures.exists(key)) scene.textures.remove(key);
}

/** The four regions between a px square's corners and its inscribed circle, as polygons. */
function cornerPolygons(px: number): Phaser.Math.Vector2[][] {
  const r = px / 2;
  const steps = 16;
  return [[0, 0, Math.PI, 1.5 * Math.PI], [px, 0, 1.5 * Math.PI, 2 * Math.PI], [px, px, 0, 0.5 * Math.PI], [0, px, 0.5 * Math.PI, Math.PI]]
    .map(([cx, cy, from, to]) => {
      const points = [new Phaser.Math.Vector2(cx, cy)];
      for (let i = 0; i <= steps; i++) {
        const a = from + ((to - from) * i) / steps;
        points.push(new Phaser.Math.Vector2(r + Math.cos(a) * (r + 0.5), r + Math.sin(a) * (r + 0.5)));
      }
      return points;
    });
}
