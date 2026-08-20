import { describe, expect, it } from 'vitest';
import {
  aggregatePlayerTelemetry,
  populationStandardDeviation,
  type GameTelemetryRecord,
  type PlayerGameTelemetry,
} from '../../src/meta/telemetry';

function player(over: Partial<PlayerGameTelemetry> = {}): PlayerGameTelemetry {
  return {
    deckName: 'Deck A',
    cleanupDiscards: 0,
    cleanupDiscardsFirst6: 0,
    cleanupDiscardsByTurn: {},
    handCloggedTurns: 0,
    turnsSampled: 0,
    graveyardCasts: 0,
    graveyardReturns: 0,
    riteCasts: {},
    preserveActivations: 0,
    nineLivesReturns: 0,
    graveyardFuel: { cleanupDiscard: 0, died: 0, milled: 0, other: 0 },
    deadWeightAtEnd: 0,
    unspentManaTurns: 0,
    unspentManaTotal: 0,
    colorStrandedTurns: 0,
    reserveExhaustedTurn: null,
    missedLandDropsAfterExhaustion: 0,
    tappedLandTempoTurns: 0,
    mulligans: 0,
    ...over,
  };
}

function game(turns: number, p0: PlayerGameTelemetry): GameTelemetryRecord {
  return {
    turns,
    winner: 0,
    wonOnTurn: turns,
    players: [p0, player({ deckName: 'Deck B' })],
  };
}

describe('telemetry aggregation math', () => {
  it('computes means, rates, cleanup-fuel share, and population stddev', () => {
    const a = game(8, player({
      cleanupDiscards: 2,
      handCloggedTurns: 4,
      turnsSampled: 5,
      graveyardCasts: 2,
      riteCasts: { '1': 2 },
      preserveActivations: 2,
      nineLivesReturns: 1,
      graveyardFuel: { cleanupDiscard: 1, died: 1, milled: 0, other: 0 },
      deadWeightAtEnd: 6,
      colorStrandedTurns: 2,
      mulligans: 1,
    }));
    const b = game(12, player({
      cleanupDiscards: 4,
      handCloggedTurns: 2,
      turnsSampled: 5,
      graveyardCasts: 1,
      riteCasts: { '2': 1 },
      nineLivesReturns: 3,
      graveyardFuel: { cleanupDiscard: 1, died: 0, milled: 1, other: 0 },
      deadWeightAtEnd: 4,
      colorStrandedTurns: 1,
    }));

    const aggregate = aggregatePlayerTelemetry([
      { game: a, player: 0 },
      { game: b, player: 0 },
    ]);
    expect(aggregate.games).toBe(2);
    expect(aggregate.meanCleanupDiscards).toBe(3);
    expect(aggregate.meanHandCloggedTurns).toBe(3);
    expect(aggregate.meanTurns).toBe(10);
    expect(aggregate.meanGraveyardCasts).toBe(1.5);
    expect(aggregate.meanRiteCasts).toEqual({ '1': 1, '2': 0.5 });
    expect(aggregate.meanPreserveActivations).toBe(1);
    expect(aggregate.meanNineLivesReturns).toBe(2);
    expect(aggregate.graveyardFuelFromCleanupShare).toBe(0.5);
    expect(aggregate.meanDeadWeightAtEnd).toBe(5);
    expect(aggregate.colorStrandedTurnsRate).toBe(0.3);
    expect(aggregate.mulliganRate).toBe(0.5);
    expect(populationStandardDeviation([0, 1, 0, 1])).toBe(0.5);
    expect(populationStandardDeviation([1])).toBe(0);
  });
});
