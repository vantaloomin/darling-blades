import { describe, expect, it } from 'vitest';
import type { CardDb, Permanent } from '../../src/engine/types';
import {
  MARKED_BODY_PREMIUM,
  hasMarkPayoff,
  markBoardAdjust,
  markedBoardValue,
  markedBodyValue,
  permValue,
} from '../../src/ai/value';

/**
 * The 2026-09-03 seeded pass on the Starborne threshold cards found the hard
 * AI valued a mark at exactly its +1/+1 and nothing more, cast Propagate and
 * mark-all into empty boards, and could not see a dawn threshold pay off
 * inside its one-turn lookahead. These pin the terms that changed that.
 */
const db: CardDb = {
  body: { id: 'body', name: 'Body', types: ['creature'], subtypes: [], cost: { generic: 2, pips: {} }, colors: [], attack: 2, defense: 2, rarity: 'c' },
  'big-body': { id: 'big-body', name: 'Big Body', types: ['creature'], subtypes: [], cost: { generic: 2, pips: {} }, colors: [], attack: 3, defense: 3, rarity: 'c' },
  cathedral: {
    id: 'cathedral', name: 'Cathedral', types: ['artifact'], subtypes: [], cost: { generic: 5, pips: {} }, colors: [], rarity: 'ssr',
    abilities: [{ when: 'dawn', condition: { kind: 'markedThreshold', n: 5, subject: 'creatures' }, ops: [{ op: 'draw', n: 1 }] }],
  },
  'propagate-body': {
    id: 'propagate-body', name: 'Propagate Body', types: ['creature'], subtypes: [], cost: { generic: 3, pips: {} }, colors: [], attack: 2, defense: 2, rarity: 'c',
    abilities: [{ when: 'arrives', ops: [{ op: 'propagate' }] }],
  },
  'mark-all': {
    id: 'mark-all', name: 'Mark All', types: ['ritual'], subtypes: [], cost: { generic: 1, pips: {} }, colors: [], rarity: 'c',
    abilities: [{ when: 'spell', ops: [{ op: 'markAll', scope: 'yourCreatures' }] }],
  },
};

let nextIid = 1;
function perm(cardId: string, controller: 0 | 1, plusOneCounters = 0): Permanent {
  return {
    iid: nextIid++, cardId, owner: controller, controller, tapped: false, enteredThisTurn: false,
    damage: 0, deathtouched: false, severBranded: false, attachments: [], plusOneCounters, untilEotMods: [],
  };
}

describe('marks are worth more than their stats', () => {
  it('a marked 2/2 outvalues an unmarked 3/3 by exactly the body premium', () => {
    const marked = perm('body', 0, 1);
    const printed = perm('big-body', 0);
    const bf = [marked, printed];
    expect(permValue(bf, db, marked.iid) - permValue(bf, db, printed.iid)).toBeCloseTo(MARKED_BODY_PREMIUM, 6);
    expect(markedBodyValue(0)).toBe(0);
    expect(markedBodyValue(3)).toBeGreaterThan(markedBodyValue(1));
  });

  it('threshold progress is convex and pays out in full only at the gate', () => {
    const board = (marked: number): Permanent[] => [
      perm('cathedral', 0),
      ...Array.from({ length: 5 }, (_, i) => perm('body', 0, i < marked ? 1 : 0)),
    ];
    const at = (marked: number): number => markedBoardValue(board(marked), db, 0);
    expect(at(0)).toBe(0);
    expect(at(2)).toBeGreaterThan(at(1));
    expect(at(4) - at(3)).toBeGreaterThan(at(2) - at(1));
    // draw 1 = 1.25 impact, x1.5 once the gate is met.
    expect(at(5)).toBeCloseTo(1.25 * 1.5, 6);
    // Unmarked bodies alone earn nothing: the term is about marks, not width.
    expect(markedBoardValue(Array.from({ length: 5 }, () => perm('body', 0)), db, 0)).toBe(0);
  });

  it('a payoff still in hand counts at half weight, and Propagate in hand values marks on board', () => {
    const bf = [perm('body', 0, 1), perm('body', 0, 1)];
    const inPlay = markedBoardValue([perm('cathedral', 0), ...bf], db, 0);
    const inHand = markedBoardValue(bf, db, 0, ['cathedral']);
    expect(inHand).toBeCloseTo(inPlay / 2, 6);
    expect(markedBoardValue(bf, db, 0, ['propagate-body'])).toBeCloseTo(0.3 * 2, 6);
    // Capped at two sources so a hand full of Propagate does not hoard.
    expect(markedBoardValue(bf, db, 0, ['propagate-body', 'propagate-body', 'propagate-body']))
      .toBeCloseTo(0.6 * 2, 6);
  });

  it('reads a payoff in play or in hand, never in the opponent hand it cannot see', () => {
    expect(hasMarkPayoff([perm('cathedral', 1)], db, 0)).toBe(false);
    expect(hasMarkPayoff([perm('cathedral', 0)], db, 0)).toBe(true);
    expect(hasMarkPayoff([], db, 0, ['cathedral'])).toBe(true);
    expect(hasMarkPayoff([], db, 0, ['body'])).toBe(false);
  });
});

describe('mark cards wait for the board that multiplies them', () => {
  it('Propagate is held below printed value on a board with nothing marked', () => {
    expect(markBoardAdjust([], db, 0, 'propagate-body')).toBeLessThan(0);
    expect(markBoardAdjust([perm('body', 0, 1)], db, 0, 'propagate-body')).toBe(0);
    expect(markBoardAdjust([perm('body', 0, 1), perm('body', 0, 1), perm('body', 0, 1)], db, 0, 'propagate-body'))
      .toBeGreaterThan(0);
    // The opponent's marks are not ours to compound.
    expect(markBoardAdjust([perm('body', 1, 1), perm('body', 1, 1)], db, 0, 'propagate-body')).toBeLessThan(0);
  });

  it('mark-all scales with the creatures it will touch', () => {
    expect(markBoardAdjust([], db, 0, 'mark-all')).toBeLessThan(0);
    expect(markBoardAdjust([perm('body', 0)], db, 0, 'mark-all')).toBeLessThan(0);
    expect(markBoardAdjust([perm('body', 0), perm('body', 0), perm('body', 0)], db, 0, 'mark-all')).toBeGreaterThan(0);
  });

  it('cards without mark ops are untouched', () => {
    expect(markBoardAdjust([], db, 0, 'body')).toBe(0);
    expect(markBoardAdjust([perm('body', 0, 2)], db, 0, 'cathedral')).toBe(0);
  });
});
