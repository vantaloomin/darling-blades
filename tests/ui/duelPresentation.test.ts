import { describe, expect, it } from 'vitest';
import {
  CARD_TRAVEL_MOTION,
  HAUNTLINK_OVERLAP,
  OPPONENT_RESERVE_CLEARANCE,
  OPPONENT_RESERVE_PILE_LAYOUT,
  SHARD_HOLD_BUTTON_PROGRESS,
  TARGET_ARROW_HEAD_LENGTH,
  hauntlinkActionLabel,
  graveActionChoice,
  hauntlinkOverlap,
  landDropGuardApplies,
  LAND_DROP_CONFIRM_LABEL,
  LAND_DROP_NOTICE,
  opponentReservePileBounds,
  orderedGraveyardSlots,
  shouldArmLandDrop,
  presentationRectsOverlap,
  targetArrowShaftEnd,
  targetRingTone,
} from '../../src/ui/duelPresentation';
import { packRow } from '../../src/ui/rowPacking';

describe('duel presentation rules', () => {
  it('tucks Hauntlink cards upward with an exposed header on either battlefield row', () => {
    expect(HAUNTLINK_OVERLAP.scale).toBe(0.64);
    expect(hauntlinkOverlap('you')).toEqual({ x: -18, y: -56, scale: 0.64 });
    expect(hauntlinkOverlap('opponent')).toEqual({ x: 18, y: -56, scale: 0.64 });
  });

  it('fans multiple Hauntlinks without changing their under-host direction', () => {
    expect(hauntlinkOverlap('you', 2)).toEqual({ x: 2, y: -68, scale: 0.64 });
    expect(hauntlinkOverlap('opponent', 2)).toEqual({ x: 38, y: -68, scale: 0.64 });
  });

  it('labels only currently payable Hauntlink actions', () => {
    expect(hauntlinkActionLabel(false, false)).toBeNull();
    expect(hauntlinkActionLabel(true, false)).toBe('Link');
    expect(hauntlinkActionLabel(true, true)).toBe('Relink');
  });

  it('uses red only for legal targets controlled by the opponent', () => {
    expect(targetRingTone('you')).toBe('friendly');
    expect(targetRingTone('opponent')).toBe('hostile');
  });

  it('stops the targeting shaft one full head length before its point', () => {
    expect(targetArrowShaftEnd({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ x: 84, y: 0 });
    expect(targetArrowShaftEnd({ x: 10, y: 10 }, { x: 10, y: 50 })).toEqual({ x: 10, y: 34 });
    const diagonal = targetArrowShaftEnd({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(Math.hypot(30 - diagonal.x, 40 - diagonal.y)).toBeCloseTo(TARGET_ARROW_HEAD_LENGTH);
  });

  it('keeps the opponent reserve pile inside its plate and clear of every neighboring zone', () => {
    const pile = opponentReservePileBounds();
    const geometry = OPPONENT_RESERVE_CLEARANCE;
    expect(pile.left).toBeGreaterThanOrEqual(geometry.plate.left);
    expect(pile.right).toBeLessThanOrEqual(geometry.plate.right);
    expect(pile.top).toBeGreaterThanOrEqual(geometry.plate.top);
    expect(pile.bottom).toBeLessThanOrEqual(geometry.plate.bottom);

    const fixedObstacles = [
      geometry.permanentBand,
      geometry.portrait,
      geometry.darling,
    ].map((rect) => ({
      left: rect.left,
      right: rect.right,
      top: 'top' in rect ? rect.top : rect.cy - rect.halfHeight,
      bottom: 'bottom' in rect ? rect.bottom : rect.cy + rect.halfHeight,
    }));
    for (const obstacle of fixedObstacles) expect(presentationRectsOverlap(pile, obstacle)).toBe(false);

    for (let beadCount = 1; beadCount <= 8; beadCount++) {
      const manaLeft = geometry.manaStrip.x0 - (beadCount - 1) * geometry.manaStrip.step - 22;
      const mana = {
        left: manaLeft,
        right: geometry.plate.right,
        top: geometry.manaStrip.cy - geometry.manaStrip.halfHeight,
        bottom: geometry.manaStrip.cy + geometry.manaStrip.halfHeight,
      };
      expect(presentationRectsOverlap(pile, mana), `mana beads: ${beadCount}`).toBe(false);

      const packed = packRow(
        beadCount,
        geometry.creatureBand.usable,
        geometry.creatureBand.tileWidth,
        geometry.creatureBand.maxSpacing,
        geometry.creatureBand.gutter,
      );
      const halfWidth = geometry.creatureBand.tileWidth * packed.scale / 2;
      const creatures = {
        left: geometry.creatureBand.x + packed.offsets[0] - halfWidth,
        right: geometry.creatureBand.x + packed.offsets[beadCount - 1] + halfWidth,
        top: geometry.creatureBand.cy - geometry.creatureBand.tileHeight * packed.scale / 2,
        bottom: geometry.creatureBand.cy + geometry.creatureBand.tileHeight * packed.scale / 2,
      };
      expect(presentationRectsOverlap(pile, creatures), `creature count: ${beadCount}`).toBe(false);
    }
    expect(OPPONENT_RESERVE_PILE_LAYOUT.y).toBe(132);
  });

  it('keeps reduced-motion paths out of the slower full-motion tuning block', () => {
    expect(CARD_TRAVEL_MOTION.drawToHand.duration).toBe(280);
    expect(CARD_TRAVEL_MOTION.playToStation.duration).toBe(420);
    expect(CARD_TRAVEL_MOTION.stationToBattlefield.duration).toBe(420);
  });

  it('keeps hold progress inside the action button instead of using a cursor halo', () => {
    expect(SHARD_HOLD_BUTTON_PROGRESS.inset).toBe(3);
    expect(SHARD_HOLD_BUTTON_PROGRESS.fillAlpha).toBeGreaterThan(0);
  });
});

describe('graveyard pile order', () => {
  it('reads newest first and marks the top of the pile', () => {
    // Engine order is oldest -> newest, so the last buried card is the top.
    const slots = orderedGraveyardSlots(['a', 'b', 'c']);
    expect(slots.map((s) => s.cardId)).toEqual(['c', 'b', 'a']);
    expect(slots.map((s) => s.index)).toEqual([2, 1, 0]);
    expect(slots.map((s) => s.top)).toEqual([true, false, false]);
  });

  it('keeps duplicates as separate slots so position stays truthful', () => {
    // The reported symptom: a cycled card then two mills. Collapsing copies
    // put the cycled card in the middle of the grid; ordered slots cannot.
    const slots = orderedGraveyardSlots(['cycled', 'mill1', 'mill1']);
    expect(slots).toHaveLength(3);
    expect(slots.map((s) => s.index)).toEqual([2, 1, 0]);
    expect(slots[2]).toEqual({ cardId: 'cycled', index: 0, top: false });
  });

  it('handles the empty and single-card piles', () => {
    expect(orderedGraveyardSlots([])).toEqual([]);
    expect(orderedGraveyardSlots(['only'])).toEqual([{ cardId: 'only', index: 0, top: true }]);
  });
});

describe('land-drop guard', () => {
  const pending = {
    landDropAvailable: true,
    turnEnds: true,
    confirmEnabled: true,
    armed: false,
    suppressed: false,
  };

  it('arms the first press that would end the turn on an unused drop', () => {
    expect(landDropGuardApplies(pending)).toBe(true);
    expect(shouldArmLandDrop(pending)).toBe(true);
  });

  it('lets the second press through', () => {
    const armed = { ...pending, armed: true };
    // The guard still APPLIES (that is what keeps the button red), but the
    // press commits rather than arming again.
    expect(landDropGuardApplies(armed)).toBe(true);
    expect(shouldArmLandDrop(armed)).toBe(false);
  });

  it('says nothing when the turn is not ending', () => {
    // main1 still has a whole second main phase to play the land in.
    expect(shouldArmLandDrop({ ...pending, turnEnds: false })).toBe(false);
    expect(landDropGuardApplies({ ...pending, turnEnds: false })).toBe(false);
  });

  it('says nothing when there is no drop left to make', () => {
    expect(shouldArmLandDrop({ ...pending, landDropAvailable: false })).toBe(false);
  });

  it('respects the setting and never interrupts a tutorial or a replay', () => {
    expect(shouldArmLandDrop({ ...pending, confirmEnabled: false })).toBe(false);
    expect(shouldArmLandDrop({ ...pending, suppressed: true })).toBe(false);
  });

  it('keeps its copy terse and free of em-dashes', () => {
    expect(LAND_DROP_CONFIRM_LABEL.startsWith('Confirm: ')).toBe(true);
    expect(LAND_DROP_CONFIRM_LABEL.length).toBeLessThanOrEqual(20);
    for (const copy of [LAND_DROP_CONFIRM_LABEL, LAND_DROP_NOTICE]) {
      expect(copy).not.toContain('\u2014');
    }
  });
});

describe('graveyard action chips', () => {
  it('offers nothing when neither action is legal', () => {
    expect(graveActionChoice(false, false)).toBeNull();
  });

  it('offers each action on its own', () => {
    expect(graveActionChoice(true, false)).toBe('retell');
    expect(graveActionChoice(false, true)).toBe('preserve');
  });

  it('prefers Retell when a card somehow offers both', () => {
    // One action slot per tile. Retell wins because it puts a spell on the
    // stack; Preserve is still there next time the modal opens.
    expect(graveActionChoice(true, true)).toBe('retell');
  });
});
