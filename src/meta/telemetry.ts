import { RULES } from '../config/rules';
import type { GameEvent } from '../engine/events';
import { canPay, manaSources } from '../engine/mana';
import type {
  CardDb,
  CardEntry,
  GameState,
  PlayerId,
  Step,
} from '../engine/types';
import { cardIdOf, def, isCardInstance, manaValue } from '../engine/types';

export type GraveyardFuelSource = 'cleanupDiscard' | 'died' | 'milled' | 'other';

export interface GraveyardFuelTelemetry {
  cleanupDiscard: number;
  died: number;
  milled: number;
  other: number;
}

export interface PlayerGameTelemetry {
  deckName: string;
  cleanupDiscards: number;
  cleanupDiscardsFirst6: number;
  cleanupDiscardsByTurn: Record<string, number>;
  handCloggedTurns: number;
  turnsSampled: number;
  graveyardCasts: number;
  graveyardReturns: number;
  graveyardFuel: GraveyardFuelTelemetry;
  deadWeightAtEnd: number;
  unspentManaTurns: number;
  unspentManaTotal: number;
  colorStrandedTurns: number;
  reserveExhaustedTurn: number | null;
  missedLandDropsAfterExhaustion: number;
  tappedLandTempoTurns: number;
  mulligans: number;
}

export interface GameTelemetryRecord {
  turns: number;
  winner: PlayerId | 'draw';
  wonOnTurn: number | null;
  players: [PlayerGameTelemetry, PlayerGameTelemetry];
}

export interface PlayerTelemetrySample {
  game: GameTelemetryRecord;
  player: PlayerId;
}

export interface PlayerTelemetryAggregate {
  deckName: string;
  games: number;
  meanCleanupDiscards: number;
  meanCleanupDiscardsFirst6: number;
  meanCleanupDiscardsByTurn: Record<string, number>;
  meanHandCloggedTurns: number;
  meanTurnsSampled: number;
  meanTurns: number;
  meanGraveyardCasts: number;
  meanGraveyardReturns: number;
  meanGraveyardFuel: GraveyardFuelTelemetry;
  graveyardFuelTotals: GraveyardFuelTelemetry;
  graveyardFuelFromCleanupShare: number;
  meanDeadWeightAtEnd: number;
  meanUnspentManaTurns: number;
  meanUnspentManaTotal: number;
  meanColorStrandedTurns: number;
  colorStrandedTurnsRate: number;
  meanReserveExhaustedTurn: number | null;
  meanMissedLandDropsAfterExhaustion: number;
  meanTappedLandTempoTurns: number;
  meanMulligans: number;
  mulliganRate: number;
}

interface GraveSnapshot {
  cardId: string;
  instanceId?: number;
}

function freshFuel(): GraveyardFuelTelemetry {
  return { cleanupDiscard: 0, died: 0, milled: 0, other: 0 };
}

function freshPlayer(deckName: string): PlayerGameTelemetry {
  return {
    deckName,
    cleanupDiscards: 0,
    cleanupDiscardsFirst6: 0,
    cleanupDiscardsByTurn: {},
    handCloggedTurns: 0,
    turnsSampled: 0,
    graveyardCasts: 0,
    graveyardReturns: 0,
    graveyardFuel: freshFuel(),
    deadWeightAtEnd: 0,
    unspentManaTurns: 0,
    unspentManaTotal: 0,
    colorStrandedTurns: 0,
    reserveExhaustedTurn: null,
    missedLandDropsAfterExhaustion: 0,
    tappedLandTempoTurns: 0,
    mulligans: 0,
  };
}

function snapshotGrave(cards: readonly CardEntry[]): GraveSnapshot[] {
  return cards.map((card) => ({
    cardId: cardIdOf(card),
    ...(isCardInstance(card) ? { instanceId: card.instanceId } : {}),
  }));
}

function hasInstance(cards: readonly CardEntry[], instanceId: number): boolean {
  return cards.some((card) => isCardInstance(card) && card.instanceId === instanceId);
}

function sumFuel(fuel: GraveyardFuelTelemetry): number {
  return fuel.cleanupDiscard + fuel.died + fuel.milled + fuel.other;
}

/** Population standard deviation. Empty and singleton samples are exactly 0. */
export function populationStandardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Aggregate one deck's appearances, regardless of which physical seat it occupied. */
export function aggregatePlayerTelemetry(
  samples: readonly PlayerTelemetrySample[],
): PlayerTelemetryAggregate {
  if (samples.length === 0) throw new Error('Cannot aggregate an empty telemetry sample');
  const rows = samples.map(({ game, player }) => ({ game, player: game.players[player] }));
  const deckName = rows[0].player.deckName;
  if (rows.some((row) => row.player.deckName !== deckName)) {
    throw new Error('Telemetry aggregate samples must all describe the same deck');
  }
  const total = (pick: (row: (typeof rows)[number]) => number): number =>
    rows.reduce((sum, row) => sum + pick(row), 0);
  const avg = (pick: (row: (typeof rows)[number]) => number): number => total(pick) / rows.length;
  const graveyardFuelTotals = freshFuel();
  for (const row of rows) {
    for (const source of Object.keys(graveyardFuelTotals) as GraveyardFuelSource[]) {
      graveyardFuelTotals[source] += row.player.graveyardFuel[source];
    }
  }
  const cleanupTurns = new Set(
    rows.flatMap((row) => Object.keys(row.player.cleanupDiscardsByTurn)),
  );
  const meanCleanupDiscardsByTurn = Object.fromEntries(
    [...cleanupTurns]
      .sort((a, b) => Number(a) - Number(b))
      .map((turn) => [
        turn,
        avg((row) => row.player.cleanupDiscardsByTurn[turn] ?? 0),
      ]),
  );
  const meanGraveyardFuel = freshFuel();
  for (const source of Object.keys(meanGraveyardFuel) as GraveyardFuelSource[]) {
    meanGraveyardFuel[source] = graveyardFuelTotals[source] / rows.length;
  }
  const exhausted = rows
    .map((row) => row.player.reserveExhaustedTurn)
    .filter((turn): turn is number => turn !== null);
  const sampledTurns = total((row) => row.player.turnsSampled);
  return {
    deckName,
    games: rows.length,
    meanCleanupDiscards: avg((row) => row.player.cleanupDiscards),
    meanCleanupDiscardsFirst6: avg((row) => row.player.cleanupDiscardsFirst6),
    meanCleanupDiscardsByTurn,
    meanHandCloggedTurns: avg((row) => row.player.handCloggedTurns),
    meanTurnsSampled: avg((row) => row.player.turnsSampled),
    meanTurns: avg((row) => row.game.turns),
    meanGraveyardCasts: avg((row) => row.player.graveyardCasts),
    meanGraveyardReturns: avg((row) => row.player.graveyardReturns),
    meanGraveyardFuel,
    graveyardFuelTotals,
    graveyardFuelFromCleanupShare:
      sumFuel(graveyardFuelTotals) === 0
        ? 0
        : graveyardFuelTotals.cleanupDiscard / sumFuel(graveyardFuelTotals),
    meanDeadWeightAtEnd: avg((row) => row.player.deadWeightAtEnd),
    meanUnspentManaTurns: avg((row) => row.player.unspentManaTurns),
    meanUnspentManaTotal: avg((row) => row.player.unspentManaTotal),
    meanColorStrandedTurns: avg((row) => row.player.colorStrandedTurns),
    colorStrandedTurnsRate:
      sampledTurns === 0 ? 0 : total((row) => row.player.colorStrandedTurns) / sampledTurns,
    meanReserveExhaustedTurn:
      exhausted.length === 0
        ? null
        : exhausted.reduce((sum, turn) => sum + turn, 0) / exhausted.length,
    meanMissedLandDropsAfterExhaustion: avg(
      (row) => row.player.missedLandDropsAfterExhaustion,
    ),
    meanTappedLandTempoTurns: avg((row) => row.player.tappedLandTempoTurns),
    meanMulligans: avg((row) => row.player.mulligans),
    mulliganRate: rows.filter((row) => row.player.mulligans > 0).length / rows.length,
  };
}

/**
 * Read-only game observer used by headless simulations. It consumes the exact
 * state at each emit point and never calls RNG-bearing or mutating helpers.
 */
export class GameTelemetry {
  private readonly players: [PlayerGameTelemetry, PlayerGameTelemetry];
  private readonly provenanceByInstance = new Map<number, GraveyardFuelSource>();
  // Legacy hand-built states may carry only card ids. In that case provenance
  // is consumed FIFO per card id, the approximation allowed by the telemetry contract.
  private readonly fallbackProvenance: [Map<string, GraveyardFuelSource[]>, Map<string, GraveyardFuelSource[]>] = [
    new Map(),
    new Map(),
  ];
  private previousGraves: [GraveSnapshot[], GraveSnapshot[]] = [[], []];
  private readonly permanentInstances = new Map<number, number>();
  private readonly sampledCleanupTurns = new Set<string>();
  private readonly tappedLandsByTurn = new Map<string, number[]>();
  private currentStep: Step = 'untap';
  private maxTurn = 0;
  private wonOnTurn: number | null = null;

  constructor(
    private readonly db: CardDb,
    deckNames: readonly [string, string] = ['P0', 'P1'],
  ) {
    this.players = [freshPlayer(deckNames[0]), freshPlayer(deckNames[1])];
  }

  onEvent(event: Readonly<GameEvent>, state: Readonly<GameState>): void {
    this.cachePermanentInstances(event, state);
    this.reconcileGraveyardRemovals(event, state);

    if (event.e === 'stepChanged') this.currentStep = event.step;
    if (event.e === 'turnBegan') this.maxTurn = Math.max(this.maxTurn, event.turn);
    if (event.e === 'mulliganTaken') this.players[event.player].mulligans = event.count;

    if (event.e === 'discarded') {
      const player = this.players[event.player];
      const cleanup = this.currentStep === 'cleanup';
      if (cleanup) {
        player.cleanupDiscards++;
        if (state.turn <= 6) player.cleanupDiscardsFirst6++;
        const turn = String(state.turn);
        player.cleanupDiscardsByTurn[turn] = (player.cleanupDiscardsByTurn[turn] ?? 0) + 1;
      }
      this.tagNewestGraveCard(state, event.player, event.cardId, cleanup ? 'cleanupDiscard' : 'other');
    } else if (event.e === 'milled') {
      this.tagNewestGraveCard(state, event.player, event.cardId, 'milled');
    } else if (event.e === 'died') {
      this.tagDiedCard(state, event.owner, event.iid, event.cardId);
    } else if (event.e === 'landPlayed') {
      const reserve = state.players[event.player].landReserve;
      const player = this.players[event.player];
      if (reserve !== undefined && reserve.length === 0 && player.reserveExhaustedTurn === null) {
        player.reserveExhaustedTurn = state.turn;
      }
      const perm = state.battlefield.find((candidate) => candidate.iid === event.iid);
      if (perm?.tapped) {
        const key = this.turnKey(event.player, state.turn);
        const lands = this.tappedLandsByTurn.get(key) ?? [];
        lands.push(event.iid);
        this.tappedLandsByTurn.set(key, lands);
      }
    } else if (event.e === 'stepChanged' && event.step === 'cleanup') {
      this.sampleCleanup(state);
    } else if (event.e === 'gameEnded') {
      this.wonOnTurn = event.winner === 'draw' ? null : state.turn;
    }

    this.tagUnclassifiedGraveyardAdditions(state);
    this.previousGraves = [
      snapshotGrave(state.players[0].graveyard),
      snapshotGrave(state.players[1].graveyard),
    ];
  }

  finish(
    state: Readonly<GameState>,
    winner: PlayerId | 'draw' = state.winner ?? 'draw',
  ): GameTelemetryRecord {
    for (const player of [0, 1] as const) {
      this.players[player].deadWeightAtEnd = state.players[player].hand.length;
    }
    return {
      turns: Math.max(this.maxTurn, state.turn),
      winner,
      wonOnTurn: winner === 'draw' ? null : (this.wonOnTurn ?? state.turn),
      players: structuredClone(this.players),
    };
  }

  private turnKey(player: PlayerId, turn: number): string {
    return `${player}:${turn}`;
  }

  private cachePermanentInstances(event: Readonly<GameEvent>, state: Readonly<GameState>): void {
    for (const perm of state.battlefield) {
      if (perm.instanceId !== undefined) this.permanentInstances.set(perm.iid, perm.instanceId);
    }
    if ((event.e === 'permanentEntered' || event.e === 'tokenCreated') && event.perm.instanceId !== undefined) {
      this.permanentInstances.set(event.perm.iid, event.perm.instanceId);
    }
  }

  private reconcileGraveyardRemovals(
    event: Readonly<GameEvent>,
    state: Readonly<GameState>,
  ): void {
    for (const player of [0, 1] as const) {
      const current = snapshotGrave(state.players[player].graveyard);
      const currentInstances = new Set(
        current.flatMap((card) => card.instanceId === undefined ? [] : [card.instanceId]),
      );
      for (const card of this.previousGraves[player]) {
        if (card.instanceId === undefined || currentInstances.has(card.instanceId)) continue;
        const retellItem = event.e === 'spellCast'
          ? state.stack.find((item) => item.sid === event.sid && item.retell === true)
          : undefined;
        if (retellItem?.instanceId === card.instanceId) {
          this.players[player].graveyardCasts++;
          this.consumeProvenance(player, card);
        } else if (hasInstance(state.players[player].hand, card.instanceId)) {
          this.players[player].graveyardReturns++;
          this.consumeProvenance(player, card);
        }
      }

      // Card-id-only legacy fixtures cannot distinguish copies. Detect the
      // one removal relevant to Retell and consume its provenance FIFO.
      if (event.e === 'spellCast') {
        const retellItem = state.stack.find((item) => item.sid === event.sid && item.retell === true);
        if (retellItem && retellItem.controller === player && retellItem.instanceId === undefined) {
          this.players[player].graveyardCasts++;
          this.consumeFallbackProvenance(player, retellItem.cardId);
        }
      }
    }
  }

  private consumeProvenance(player: PlayerId, card: GraveSnapshot): void {
    const source = card.instanceId === undefined
      ? this.consumeFallbackProvenance(player, card.cardId)
      : (this.provenanceByInstance.get(card.instanceId) ?? 'other');
    this.players[player].graveyardFuel[source]++;
    if (card.instanceId !== undefined) this.provenanceByInstance.delete(card.instanceId);
  }

  private consumeFallbackProvenance(player: PlayerId, cardId: string): GraveyardFuelSource {
    const queue = this.fallbackProvenance[player].get(cardId);
    return queue?.shift() ?? 'other';
  }

  private tagNewestGraveCard(
    state: Readonly<GameState>,
    player: PlayerId,
    cardId: string,
    source: GraveyardFuelSource,
  ): void {
    const card = [...state.players[player].graveyard]
      .reverse()
      .find((candidate) => cardIdOf(candidate) === cardId);
    if (!card) return;
    this.setProvenance(player, card, source);
  }

  private tagDiedCard(
    state: Readonly<GameState>,
    player: PlayerId,
    iid: number,
    cardId: string,
  ): void {
    const instanceId = this.permanentInstances.get(iid);
    const card = instanceId === undefined
      ? [...state.players[player].graveyard].reverse().find((candidate) => cardIdOf(candidate) === cardId)
      : state.players[player].graveyard.find(
        (candidate) => isCardInstance(candidate) && candidate.instanceId === instanceId,
      );
    if (card) this.setProvenance(player, card, 'died');
  }

  private setProvenance(
    player: PlayerId,
    card: CardEntry,
    source: GraveyardFuelSource,
  ): void {
    if (isCardInstance(card)) this.provenanceByInstance.set(card.instanceId, source);
    else {
      const queue = this.fallbackProvenance[player].get(card) ?? [];
      queue.push(source);
      this.fallbackProvenance[player].set(card, queue);
    }
  }

  private tagUnclassifiedGraveyardAdditions(state: Readonly<GameState>): void {
    for (const player of [0, 1] as const) {
      const previousInstances = new Set(
        this.previousGraves[player].flatMap((card) =>
          card.instanceId === undefined ? [] : [card.instanceId]
        ),
      );
      for (const card of state.players[player].graveyard) {
        if (!isCardInstance(card) || previousInstances.has(card.instanceId)) continue;
        if (!this.provenanceByInstance.has(card.instanceId)) {
          this.provenanceByInstance.set(card.instanceId, 'other');
        }
      }
    }
  }

  private sampleCleanup(state: Readonly<GameState>): void {
    const player = state.activePlayer;
    const key = this.turnKey(player, state.turn);
    if (this.sampledCleanupTurns.has(key)) return;
    this.sampledCleanupTurns.add(key);
    const out = this.players[player];
    out.turnsSampled++;
    const hand = state.players[player].hand;
    if (hand.length >= RULES.maxHandSize) out.handCloggedTurns++;

    const sources = manaSources(state as GameState, this.db, player);
    if (state.turn > 2 && sources.length > 0) {
      out.unspentManaTurns++;
      out.unspentManaTotal += sources.length;
    }
    if (hand.some((card) => {
      const cost = def(this.db, card).cost;
      return cost !== undefined && manaValue(cost) <= sources.length &&
        !canPay(state as GameState, this.db, player, cost);
    })) {
      out.colorStrandedTurns++;
    }

    const exhaustedTurn = out.reserveExhaustedTurn;
    if (
      exhaustedTurn !== null &&
      state.turn > exhaustedTurn &&
      state.players[player].landDropsUsed < 1 + state.players[player].extraLandDrops
    ) {
      out.missedLandDropsAfterExhaustion++;
    }

    const tappedLands = this.tappedLandsByTurn.get(key) ?? [];
    if (tappedLands.some((iid) => this.tappedLandCostOpportunity(state, player, iid))) {
      out.tappedLandTempoTurns++;
    }
  }

  private tappedLandCostOpportunity(
    state: Readonly<GameState>,
    player: PlayerId,
    iid: number,
  ): boolean {
    const original = state.battlefield.find((perm) => perm.iid === iid);
    if (!original?.tapped) return false;
    const counterfactual = structuredClone(state) as GameState;
    const land = counterfactual.battlefield.find((perm) => perm.iid === iid);
    if (!land) return false;
    land.tapped = false;
    return state.players[player].hand.some((card) => {
      const cost = def(this.db, card).cost;
      return cost !== undefined &&
        !canPay(state as GameState, this.db, player, cost) &&
        canPay(counterfactual, this.db, player, cost);
    });
  }
}
