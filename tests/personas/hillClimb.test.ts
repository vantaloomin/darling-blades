import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import {
  buildGreedyDeck,
  cardsForPool,
  runHillClimb,
  type GreedyBuild,
  type MeasuredRecord,
  type ProposedSwap,
} from '../../scripts/personas/craft';
import { cardRoles } from '../../scripts/personas/score';
import { personaTemplate } from '../../scripts/personas/templates';

const measured = (score: number): MeasuredRecord => ({
  field: 'starters',
  seeds: 1,
  matchups: [],
  rowWins: Math.round(score * 100),
  losses: 100 - Math.round(score * 100),
  draws: 0,
  games: 100,
  score,
});

function swapFirst(build: GreedyBuild, incoming: string): ProposedSwap {
  const outgoing = build.assigned[0];
  const assigned = build.assigned.map((entry, index) => index === 0 ? { ...entry, cardId: incoming } : { ...entry });
  return {
    build: { ...build, assigned, deck: [...assigned.map((entry) => entry.cardId), ...build.deck.slice(build.assigned.length)] },
    out: outgoing.cardId,
    in: incoming,
    role: outgoing.role,
  };
}

describe('seeded hill climb retention', () => {
  it('keeps an improvement, rejects a regression, and records only the accepted swap', () => {
    const template = personaTemplate('draw-go');
    const pool = cardsForPool('all');
    const initial = buildGreedyDeck(template, pool, 91);
    const role = initial.assigned[0].role;
    const alternatives = pool.filter((card) =>
      card.id !== initial.assigned[0].cardId &&
      card.colors.every((color) => initial.selectedColors.includes(color)) &&
      cardRoles(card).includes(role) &&
      !initial.deck.includes(card.id));
    const improvement = alternatives[0].id;
    const regression = alternatives[1].id;

    const result = runHillClimb({
      initial,
      pool,
      template,
      iterations: 2,
      seed: 44,
      measure: (deck) => measured(deck[0] === improvement ? 0.6 : deck[0] === regression ? 0.4 : 0.5),
      propose: (current, _pool, _template, _rng, iteration) =>
        swapFirst(current, iteration === 1 ? improvement : regression),
    });

    expect(result.build.deck[0]).toBe(improvement);
    expect(result.finalMeasurement.score).toBe(0.6);
    expect(result.log.acceptedSwaps).toHaveLength(1);
    expect(result.log.acceptedSwaps[0]).toEqual(
      expect.objectContaining({ iteration: 1, out: initial.deck[0], in: improvement }),
    );
    expect(result.log.acceptedSwaps[0].scoreDelta).toBeCloseTo(0.1);
    expect(result.log.rejectedSwaps).toBe(1);
  });

  it('records iterations where no quota-legal proposal exists', () => {
    const template = personaTemplate('burn');
    const pool = cardsForPool('all');
    const initial = buildGreedyDeck(template, pool, 7);
    const result = runHillClimb({
      initial,
      pool,
      template,
      iterations: 3,
      seed: 8,
      measure: () => measured(0.5),
      propose: () => null,
    });
    expect(result.log.unproposedIterations).toBe(3);
    expect(result.log.acceptedSwaps).toEqual([]);
  });

  it('never reports greedy-beats-final after strict improvements', () => {
    const template = personaTemplate('midrange');
    const pool = cardsForPool('all');
    const initial = buildGreedyDeck(template, pool, 1);
    const result = runHillClimb({
      initial,
      pool,
      template,
      iterations: 0,
      seed: 1,
      measure: () => measured(0.5),
    });
    expect(result.greedyBeatsFinal).toBe(false);
    expect(result.nonMonotonicClimb).toBe(false);
    expect(CARD_DB[result.build.deck[0]]).toBeDefined();
  });
});
