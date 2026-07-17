export const COIN_FLIP_ACTION_WIDTH = 160;
export const COIN_FLIP_ACTION_CENTERS = [552, 728] as const;
export const COIN_FLIP_CALL_Y = 430;
export const COIN_FLIP_RESULT_Y = 490;

export const COIN_FLIP_SIDES = ['heads', 'tails'] as const;
export type CoinFlipSide = (typeof COIN_FLIP_SIDES)[number];

export const COIN_FLIP_FACE_TEXTURES: Record<CoinFlipSide, string> = {
  heads: 'coin-face-heads',
  tails: 'coin-face-tails',
};

export const COIN_FLIP_FACE_ASSETS: Record<CoinFlipSide, string> = {
  heads: 'assets/art/ui/coin-heads.png',
  tails: 'assets/art/ui/coin-tails.png',
};

/** Pure visual rectangles for the two-button coin-flip action row. */
export function coinFlipActionRects(centerY: number): { x: number; y: number; width: number; height: number }[] {
  const height = 40;
  return COIN_FLIP_ACTION_CENTERS.map((centerX) => ({
    x: centerX - COIN_FLIP_ACTION_WIDTH / 2,
    y: centerY - height / 2,
    width: COIN_FLIP_ACTION_WIDTH,
    height,
  }));
}
