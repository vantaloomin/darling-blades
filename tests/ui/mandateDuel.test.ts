import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import { sequencedBatchRoutes } from '../../src/ui/combatSequence';
import { eventHistoryLine, type EventLineLookup } from '../../src/ui/duelPresentation';
import { DUEL_LAYOUT, LIFE_BADGE_REACH } from '../../src/ui/duelLayout';
import {
  MANDATE_SEAL_HIT, MANDATE_SEAL_SIZE, mandateSealCenter, mandateSpot,
} from '../../src/ui/mandatePresentation';
import { swornChip } from '../../src/ui/swornPresentation';
import { theme } from '../../src/ui/theme';
import { card, dbOf, spell } from '../drownedDeepFixture';

/**
 * The Mandate on the duel board (2.0 lane B4): where the seal docks, and
 * what the history says when it changes hands.
 */

const usurp = spell('usurp', [{ op: 'claimMandate' }]);
const banner = card('banner', {
  abilities: [{ when: 'static', static: { scope: 'self', p: 1, t: 0, condition: 'youHoldMandate' } }],
});
const db = dbOf(usurp, banner);

describe('where the seal docks', () => {
  const lifeOf = { you: DUEL_LAYOUT.myLife, opponent: DUEL_LAYOUT.oppLife } as const;

  it('beside the holder\'s life badge, clear of the badge and its target ring', () => {
    for (const spot of ['you', 'opponent'] as const) {
      const seal = mandateSealCenter(spot);
      const life = lifeOf[spot];
      expect(seal.y).toBe(life.y);
      expect(Math.abs(seal.x - life.x) - MANDATE_SEAL_SIZE / 2).toBeGreaterThan(LIFE_BADGE_REACH);
    }
  });

  it('inside the title-safe frame with its whole touch area', () => {
    const safe = theme.design.titleSafe;
    for (const spot of ['you', 'opponent'] as const) {
      const { x, y } = mandateSealCenter(spot);
      expect(x - MANDATE_SEAL_HIT / 2).toBeGreaterThanOrEqual(safe.left);
      expect(x + MANDATE_SEAL_HIT / 2).toBeLessThanOrEqual(safe.right);
      expect(y - MANDATE_SEAL_SIZE / 2).toBeGreaterThanOrEqual(safe.top);
      expect(y + MANDATE_SEAL_SIZE / 2).toBeLessThanOrEqual(safe.bottom);
    }
  });

  it('follows the holder from the human\'s side of the table, and shows nothing while unclaimed', () => {
    expect(mandateSpot(undefined, 0)).toBeNull();
    expect(mandateSpot(0, 0)).toBe('you');
    expect(mandateSpot(0, 1)).toBe('opponent');
  });
});

describe('the Mandate in the history', () => {
  const lookup: EventLineLookup = {
    permanent: () => null,
    cardRef: (id) => `[${id}]`,
    card: (id) => db[id],
    sideOf: (player) => (player === 0 ? 'you' : 'opponent'),
    overchargeLimit: 3,
  };
  const line = (e: GameEvent) => eventHistoryLine(e, lookup);

  it('says who claimed it, and when combat took it', () => {
    expect(line({ e: 'mandateChanged', from: null, to: 0, reason: 'effect' })).toBe('You claim the Mandate');
    expect(line({ e: 'mandateChanged', from: 0, to: 1, reason: 'combat' })).toBe('Your opponent takes the Mandate in combat');
    expect(line({ e: 'mandateChanged', from: 1, to: 0, reason: 'combat' })).toBe('You take the Mandate in combat');
  });

  it('names the holder\'s extra dawn draw', () => {
    expect(line({ e: 'mandateDraw', player: 0 })).toBe('You hold the Mandate: draw a card');
    expect(line({ e: 'mandateDraw', player: 1 })).toBe('Your opponent holds the Mandate: they draw a card');
  });

  it('flies the seal after combat\'s blows land, and at once for a claim effect', () => {
    const events: GameEvent[] = [
      { e: 'combatDamage', hits: [{ source: 1, target: { kind: 'player', player: 1 }, amount: 3 }], firstStrike: false },
      { e: 'mandateChanged', from: 1, to: 0, reason: 'combat' },
      { e: 'mandateChanged', from: 0, to: 1, reason: 'effect' },
    ];
    expect(sequencedBatchRoutes(events, { combat: true, huntDrawn: new Set() }))
      .toEqual(['combatRound', 'afterStrikes', 'narrate']);
  });
});

describe('Sworn on a hand card', () => {
  it('says whether it is on, in words, and only on a card with a Sworn ability', () => {
    const oath = card('oath', { abilities: [{ when: 'dawn', condition: 'swornActive', ops: [{ op: 'draw', n: 1 }] }] });
    expect(swornChip(oath, true)).toEqual({ active: true, label: 'Sworn on' });
    expect(swornChip(oath, false)).toEqual({ active: false, label: 'Sworn off' });
    expect(swornChip(banner, true)).toBeNull();
  });
});
