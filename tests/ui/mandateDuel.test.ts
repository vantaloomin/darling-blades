import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine/events';
import { sequencedBatchRoutes } from '../../src/ui/combatSequence';
import { eventHistoryLine, type EventLineLookup } from '../../src/ui/duelPresentation';
import { DUEL_LAYOUT, LIFE_BADGE_REACH } from '../../src/ui/duelLayout';
import {
  MANDATE_SEAL_HIT, MANDATE_SEAL_SIZE, mandateSealCenter, mandateShown, mandateSpot, type MandateSpot,
} from '../../src/ui/mandatePresentation';
import { theme } from '../../src/ui/theme';
import { board, card, dbOf, spell } from '../drownedDeepFixture';

/**
 * The Mandate on the duel board (2.0 lane B4): when the seal shows at all,
 * where it docks, and what the history says when it changes hands.
 */

const usurp = spell('usurp', [{ op: 'claimMandate' }]);
const banner = card('banner', {
  abilities: [{ when: 'static', static: { scope: 'self', p: 1, t: 0, condition: 'youHoldMandate' } }],
});
const db = dbOf(usurp, banner);

describe('whether the duel shows the Mandate', () => {
  it('stays hidden in a duel where no card the human can see names it', () => {
    expect(mandateShown(board(), db, 0)).toBe(false);
  });

  it('shows once someone holds it', () => {
    const state = board();
    state.mandateHolder = 1;
    expect(mandateShown(state, db, 0)).toBe(true);
  });

  it('shows unclaimed when the human\'s own deck names it, wherever the card is', () => {
    const inDeck = board();
    inDeck.players[0].deck.push('usurp');
    expect(mandateShown(inDeck, db, 0)).toBe(true);
    expect(mandateShown(board([['usurp'], []]), db, 0)).toBe(true);
  });

  it('never reveals the opponent\'s hidden cards: only their public ones count', () => {
    const hidden = board([[], ['usurp']]);
    hidden.players[1].deck.push('banner');
    expect(mandateShown(hidden, db, 0)).toBe(false);
    expect(mandateShown(board([[], []], [{ iid: 5, cardId: 'banner', controller: 1, owner: 1 }]), db, 0)).toBe(true);
    const grave = board();
    grave.players[1].graveyard.push('usurp');
    expect(mandateShown(grave, db, 0)).toBe(true);
  });
});

describe('where the seal docks', () => {
  const center = (spot: MandateSpot) => mandateSealCenter(spot, 52);
  const lifeOf = { you: DUEL_LAYOUT.myLife, opponent: DUEL_LAYOUT.oppLife } as const;

  it('beside the holder\'s life badge, clear of the badge and its target ring', () => {
    for (const spot of ['you', 'opponent'] as const) {
      const seal = center(spot);
      const life = lifeOf[spot];
      expect(seal.y).toBe(life.y);
      expect(Math.abs(seal.x - life.x) - MANDATE_SEAL_SIZE / 2).toBeGreaterThan(LIFE_BADGE_REACH);
    }
  });

  it('inside the title-safe frame with its whole touch area, held or unclaimed', () => {
    const safe = theme.design.titleSafe;
    for (const spot of ['you', 'opponent', 'unclaimed'] as const) {
      const { x, y } = center(spot);
      expect(x - MANDATE_SEAL_HIT / 2).toBeGreaterThanOrEqual(safe.left);
      expect(x + MANDATE_SEAL_HIT / 2).toBeLessThanOrEqual(safe.right);
      expect(y - MANDATE_SEAL_SIZE / 2).toBeGreaterThanOrEqual(safe.top);
      expect(y + MANDATE_SEAL_SIZE / 2).toBeLessThanOrEqual(safe.bottom);
    }
  });

  it('unclaimed, past the turn chip however wide its turn number draws', () => {
    for (const width of [52, 70]) {
      const { x, y } = mandateSealCenter('unclaimed', width);
      expect(y).toBe(DUEL_LAYOUT.turnPill.y);
      expect(x - MANDATE_SEAL_SIZE / 2).toBeGreaterThan(DUEL_LAYOUT.turnPill.x + width / 2);
    }
  });

  it('follows the holder from the human\'s side of the table', () => {
    expect(mandateSpot(undefined, 0)).toBe('unclaimed');
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
