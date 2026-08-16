import { describe, expect, it } from 'vitest';
import {
  bottomingTitle,
  cardsLabel,
  discardTitle,
  dragMoved,
  libraryStackPlates,
  mulliganTitle,
  riffleShuffleMotion,
  stagedDropAccepted,
  stagedSlots,
} from '../../src/ui/mulliganRitualPresentation';

describe('copy', () => {
  it('never shows the player a "(s)"', () => {
    expect(cardsLabel(1)).toBe('1 card');
    expect(cardsLabel(2)).toBe('2 cards');
    expect(bottomingTitle(1)).toBe('Put 1 card on the bottom');
    expect(bottomingTitle(3)).toBe('Put 3 cards on the bottom');
    expect(discardTitle(1)).toBe('Discard 1 card');
    expect(discardTitle(2)).toBe('Discard 2 cards');
  });

  it('keeps the cap-aware mulligan title', () => {
    expect(mulliganTitle(2)).toBe('Keep this hand?  ·  2 mulligans left');
    expect(mulliganTitle(1)).toBe('Keep this hand?  ·  1 mulligan left');
    expect(mulliganTitle(0)).toBe('Keep this hand?  ·  no mulligans left');
  });
});

describe('stagedDropAccepted', () => {
  const rect = { x: 1080, y: 380, halfW: 90, halfH: 110 };
  it('accepts inside and on the edge, rejects outside', () => {
    expect(stagedDropAccepted(1080, 380, rect)).toBe(true);
    expect(stagedDropAccepted(1170, 490, rect)).toBe(true);
    expect(stagedDropAccepted(1171, 380, rect)).toBe(false);
    expect(stagedDropAccepted(1080, 491, rect)).toBe(false);
    expect(stagedDropAccepted(600, 360, rect)).toBe(false);
  });
});

describe('libraryStackPlates', () => {
  it('scales plate count with deck size within bounds', () => {
    expect(libraryStackPlates(0)).toHaveLength(2);
    expect(libraryStackPlates(10)).toHaveLength(2);
    expect(libraryStackPlates(24)).toHaveLength(3);
    expect(libraryStackPlates(40)).toHaveLength(5);
    expect(libraryStackPlates(200)).toHaveLength(5);
  });

  it('stacks upward with the top plate last', () => {
    const plates = libraryStackPlates(40);
    for (let i = 1; i < plates.length; i++) {
      expect(plates[i].dy).toBeLessThan(plates[i - 1].dy);
    }
  });
});

describe('riffleShuffleMotion', () => {
  it('riffles on full, abbreviates on reduced, vanishes on off', () => {
    const full = riffleShuffleMotion('full');
    expect(full.cuts).toBe(3);
    expect(full.totalMs).toBe(full.cuts * full.cutMs + full.gatherMs);
    const reduced = riffleShuffleMotion('reduced');
    expect(reduced.cuts).toBe(1);
    expect(reduced.totalMs).toBeLessThan(full.totalMs);
    expect(riffleShuffleMotion('off')).toEqual({ cuts: 0, cutMs: 0, gatherMs: 0, splitDx: 0, totalMs: 0 });
  });
});

describe('stagedSlots', () => {
  it('grows left from the stack at the given pitch', () => {
    expect(stagedSlots(3, 1000, 46)).toEqual([1000, 954, 908]);
    expect(stagedSlots(0, 1000, 46)).toEqual([]);
  });
});

describe('dragMoved', () => {
  it('classifies a press by travel distance', () => {
    expect(dragMoved(100, 100, 103, 103)).toBe(false);
    expect(dragMoved(100, 100, 100, 106)).toBe(true);
    expect(dragMoved(100, 100, 94, 100)).toBe(true);
    expect(dragMoved(100, 100, 104, 104, 6)).toBe(false);
  });
});
