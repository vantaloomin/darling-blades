/**
 * Phaser-free geometry of the live Duel board (wireframe 1a "immersive fan",
 * 1280×720 design space). DuelScene reads every placement from here, so the
 * HUD's title-safe contract (docs/design-system.md, "Safe-area model") can be
 * checked by a rule test without importing a scene.
 *
 * Layout: a mirrored opponent play mat on top (portrait, life, icon piles,
 * mana and a full zone plate), two inset battlefield zone plates (each holding
 * its land row at the outer edge and its creature row at the inner edge,
 * Arena-style), a sparse left rail, and a bottom stage: commander portrait
 * (bottom-left), arced hand fan (center), smart-button cluster + piles
 * (right). The backdrop art shows through around the plates.
 *
 * The battlefield plates, rows and bands are gameplay geometry and are not
 * anchored to the title-safe frame. The HUD beside them (pile columns, life
 * badges) is anchored to the frame's edges, never typed as edge offsets.
 */

import { OPPONENT_RESERVE_PILE_LAYOUT } from './duelPresentation';
import type { Rect } from './layout';
import { theme } from './theme';

const SAFE = theme.design.titleSafe;

/** Life-total plate (DuelScene.addLifeBadgePlate): a square badge, centered. */
export const LIFE_BADGE_SIZE = 40;

/**
 * The legal-target ring around a life badge (DuelScene.drawLifeTargetRing):
 * a rounded rect `inset` px outside the badge, stroked `stroke` px wide on
 * that path. It is part of the targeting decision, so it counts toward the
 * frame as much as the badge does.
 */
export const LIFE_TARGET_RING = { inset: 3, stroke: 3 } as const;

/** Half the width (and height) a life badge reaches, its target ring included. */
export const LIFE_BADGE_REACH = LIFE_BADGE_SIZE / 2 + LIFE_TARGET_RING.inset + LIFE_TARGET_RING.stroke / 2;

/**
 * PileView at its default 32px icon, measured in container space: the icon
 * sits above a 40×16 count badge (4px apart), so the pair spans ±26px
 * vertically and the badge sets the width. Its input zone is 44 wide and 52
 * tall (the 44px floor on the width). Not covered: the castable-alert ring
 * and count chip (PileView.setAlert, your grave pile only), which reach 34px
 * right of the pile's centre, 14px past the frame on your column.
 */
export const PILE_VISUAL = { halfWidth: 20, top: -26, bottom: 26, hitHalfWidth: 22 } as const;

/** Every pile column steps at the same pitch: 18px of air between neighbours. */
const PILE_PITCH = 70;

/**
 * Anchors for the two pile columns. Each sits with its visible edge on the
 * frame line (the convention the currency badge uses), and the foe's column
 * starts with its top on the frame's top edge.
 */
const OPP_PILES_X = SAFE.left + PILE_VISUAL.halfWidth;
const OPP_PILES_TOP_Y = SAFE.top - PILE_VISUAL.top;
const MY_PILES_X = SAFE.right - PILE_VISUAL.halfWidth;

export const DUEL_LAYOUT = {
  /** Opponent's mirrored zone, narrowed for the top-right commander frame. */
  oppZone: { x0: 108, x1: 1046, y0: 16, y1: 292 },
  /** Foe mana strip takes the old land-stack anchor and steps leftward. */
  oppManaStrip: { cy: 56, x0: 1006, step: 44, pipSize: 18 },
  /** Non-creature permanent band shares the old top land lane, opposite mana. */
  oppPermanentBand: { cy: 63, x0: 120, usable: 380 },
  /** The opponent row stays at its audited y but centers in its narrower plate. */
  oppCreatures: { cy: 200, x: 577, usable: 860 },
  /** Between the zone plates: skip toast + stack readout float here. */
  gap: { cy: 298, stackX: 400, stackY: 283 },
  /** Player zone now matches the opponent plate's right edge for the sidebar. */
  myZone: { x0: 108, x1: 1046, y0: 312, y1: 532 },
  myCreatures: { cy: 404, x: 577, usable: 860 },
  /** Your mana strip takes the old land-stack anchor and steps rightward. */
  myManaStrip: { cy: 500, x0: 210, step: 54, pipSize: 22 },
  /** Reserve piles sit immediately outside their mirrored mana strips. */
  reservePiles: {
    human: { x: 170, y: 500, cardScale: 0.12 },
    opponent: OPPONENT_RESERVE_PILE_LAYOUT,
  },
  /** Non-creature permanent band shares the lower lane, opposite mana. */
  myPermanentBand: { cy: 500, x1: 1006, usable: 380 },
  // restY is computed in syncHand to anchor the fan's bottom near y=714 for
  // the active scale; the hover lift is computed per card so the raised
  // zone's bottom edge matches the resting zone's (no orphaned-pointer
  // flicker band — adversarial review 2026-07-04).
  /**
   * Commander portrait frame (top-left anchored, rises from screen bottom).
   * Outside the title-safe frame by design as full-bleed stage art; its
   * placement awaits the owner's ruling (1.8.1 G20).
   */
  portrait: { x: 14, y: 540, w: 200, h: 180 },
  /** Your targetable life badge: inside the portrait's upper-left corner, ring on the frame line. */
  myLife: { x: Math.ceil(SAFE.left + LIFE_BADGE_REACH), y: 566 },
  /** Mirrored commander frame (descends from the top edge); same pending ruling as `portrait`. */
  oppPortrait: { x: 1056, y: 8, w: 200, h: 180 },
  /** Foe targetable life badge: upper-right, clear of the portrait name plate, ring on the frame lines. */
  oppLife: { x: Math.floor(SAFE.right - LIFE_BADGE_REACH), y: Math.ceil(SAFE.top + LIFE_BADGE_REACH) },
  /** Command-zone cards sit in the portrait's board-facing gap, with attached controls. */
  darlingZone: {
    human: {
      x: 114, y: 476, labelX: 114, labelY: 420, taxX: 152, taxY: 422, taxOriginX: 0.5,
      castX: 114, castY: 528, payDownX: 200, payDownY: 452,
    },
    opponent: {
      // The tax chip hangs off the label's LEFT edge (right-anchored), 6px
      // clear of "Foe's Darling": the label's right side runs into the frame.
      x: 1156, y: 242, labelX: 1156, labelY: 194, taxX: 1114, taxY: 194, taxOriginX: 1,
      castX: 1156, castY: 0, payDownX: 0, payDownY: 0,
    },
  },
  /** Turn chip atop the phase track — all turn info lives in one column. */
  turnPill: { x: 1113, y: 292 },
  /** Display-only phase track in the right sidebar above End Turn. */
  phaseTrack: { x: 1113, firstRowY: 326, rowStep: 34 },
  /** Right-side control cluster: smart button · ⏭ End Turn chip (top→bottom). */
  cluster: { x: 1108, passY: 536, endTurnY: 639, passR: 46 },
  /** Opponent hand/grave/deck icon stack in the left pile column. */
  oppPiles: {
    x: OPP_PILES_X,
    handY: OPP_PILES_TOP_Y,
    graveY: OPP_PILES_TOP_Y + PILE_PITCH,
    deckY: OPP_PILES_TOP_Y + PILE_PITCH * 2,
    severedY: OPP_PILES_TOP_Y + PILE_PITCH * 3,
  },
  /** Your deck/grave icon stack, with a hidden severed slot reserved above deck. */
  piles: { x: MY_PILES_X, severedY: 482, deckY: 552, graveY: 622 },
  /**
   * Undo, the left rail's only control. Outside the frame: the rail is 44px
   * wide inside it (x 64-108) and the button is about 80. Pending the owner's
   * ruling (1.8.1 G20).
   */
  undo: { x: 52, y: 410 },
  /**
   * ⚙ Menu, the inboard corner spot. Its label straddles the frame's bottom
   * and right lines (about x 1182-1230, y 680-696); pending the same ruling.
   */
  menu: { x: 1206, y: 688 },
} as const;

/** A pile's visible icon-and-badge rectangle at its container position. */
export function pileBounds(x: number, y: number): Rect {
  return {
    x: x - PILE_VISUAL.halfWidth,
    y: y + PILE_VISUAL.top,
    width: PILE_VISUAL.halfWidth * 2,
    height: PILE_VISUAL.bottom - PILE_VISUAL.top,
  };
}

/** A pile's own input zone (before any scene-level inflation). */
export function pileHitBounds(x: number, y: number): Rect {
  return {
    x: x - PILE_VISUAL.hitHalfWidth,
    y: y + PILE_VISUAL.top,
    width: PILE_VISUAL.hitHalfWidth * 2,
    height: PILE_VISUAL.bottom - PILE_VISUAL.top,
  };
}

/** A life badge with its legal-target ring, the widest it ever draws. */
export function lifeBadgeBounds(center: { x: number; y: number }): Rect {
  return {
    x: center.x - LIFE_BADGE_REACH,
    y: center.y - LIFE_BADGE_REACH,
    width: LIFE_BADGE_REACH * 2,
    height: LIFE_BADGE_REACH * 2,
  };
}

/** The circular smart button's hit rectangle (Phaser's default Arc hit area). */
export function passButtonBounds(): Rect {
  const c = DUEL_LAYOUT.cluster;
  return { x: c.x - c.passR, y: c.passY - c.passR, width: c.passR * 2, height: c.passR * 2 };
}

/**
 * The severed piles carry a 90×90 touch target, wider than the pile. It is
 * pushed toward the screen edge by this much, so its inner edge matches the
 * pile's own input zone and the extra reach spreads into the outer band
 * instead of over the smart button (yours) or the battlefield plate (the
 * foe's).
 */
export const SEVERED_PILE_HIT = { size: 90, outwardBias: 90 / 2 - PILE_VISUAL.hitHalfWidth } as const;

/**
 * World rectangle of a severed pile's widened target: what
 * `inflateHitArea(zone, size, size, { biasX: outward * outwardBias })` makes
 * of the pile's own input zone. `outward` is -1 for the foe's (left) column
 * and 1 for yours (right).
 */
export function severedPileHitBounds(x: number, y: number, outward: -1 | 1): Rect {
  const half = SEVERED_PILE_HIT.size / 2;
  const cx = x + outward * SEVERED_PILE_HIT.outwardBias;
  const cy = y + (PILE_VISUAL.top + PILE_VISUAL.bottom) / 2;
  return { x: cx - half, y: cy - half, width: SEVERED_PILE_HIT.size, height: SEVERED_PILE_HIT.size };
}
