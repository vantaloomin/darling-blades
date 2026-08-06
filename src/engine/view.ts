import type {
  Awaiting,
  CombatState,
  GameState,
  Permanent,
  PlayerId,
  StackItem,
  Step,
} from './types';
import { cardIdOf, opponentOf } from './types';

/**
 * Hidden-information redaction. AIs (at every difficulty) receive ONLY this
 * view: the opponent's hand and both libraries become counts. Graveyards and
 * the battlefield are public. Own deck order is hidden too — you know your
 * decklist, not its order.
 */
export interface SelfView {
  life: number;
  hand: string[];
  deckCount: number;
  graveyard: string[];
  severed: string[];
  /** Public ordered reserve. Omitted for classic games. */
  landReserve?: string[];
  /** Public command zone. Present only in Darlings games. */
  darlingZone?: string | null;
  darlingTax?: number;
  darlingInstanceId?: number;
  darlingCastable?: boolean;
  landPlayedThisTurn: boolean;
  mulligans: number;
}

export interface OpponentView {
  life: number;
  handCount: number;
  deckCount: number;
  graveyard: string[];
  severed: string[];
  /** Public ordered reserve. Omitted for classic games. */
  landReserve?: string[];
  /** Public command zone. Present only in Darlings games. */
  darlingZone?: string | null;
  darlingTax?: number;
  darlingInstanceId?: number;
  darlingCastable?: boolean;
  landPlayedThisTurn: boolean;
  mulligans: number;
}

export interface PlayerView {
  /** Absent means revision 1, matching GameState's compatibility contract. */
  rulesRev?: number;
  myId: PlayerId;
  turn: number;
  step: Step;
  activePlayer: PlayerId;
  startingPlayer: PlayerId;
  you: SelfView;
  opp: OpponentView;
  battlefield: Permanent[];
  stack: StackItem[];
  combat: CombatState | null;
  fogThisTurn: boolean;
  awaiting: Awaiting;
  winner: PlayerId | 'draw' | null;
}

export function viewFor(
  state: GameState,
  player: PlayerId,
  darlingCastable?: [boolean, boolean],
): PlayerView {
  const me = state.players[player];
  const them = state.players[opponentOf(player)];
  const awaiting =
    state.awaiting.kind === 'foresee' && state.awaiting.player !== player
      ? { ...state.awaiting, cards: [] }
      : state.awaiting.kind === 'foresee'
        ? { ...state.awaiting, cards: state.awaiting.cards.map(cardIdOf) }
        : structuredClone(state.awaiting);
  return {
    ...(state.rulesRev === undefined ? {} : { rulesRev: state.rulesRev }),
    myId: player,
    turn: state.turn,
    step: state.step,
    activePlayer: state.activePlayer,
    startingPlayer: state.startingPlayer,
    you: {
      life: me.life,
      hand: me.hand.map(cardIdOf),
      deckCount: me.deck.length,
      graveyard: me.graveyard.map(cardIdOf),
      severed: me.severed.map(cardIdOf),
      ...(me.landReserve !== undefined ? { landReserve: me.landReserve.map(cardIdOf) } : {}),
      ...(me.darlingZone !== undefined
        ? {
            darlingZone: me.darlingZone === null ? null : cardIdOf(me.darlingZone),
            darlingTax: me.darlingTax ?? 0,
            ...(me.darlingInstanceId === undefined ? {} : { darlingInstanceId: me.darlingInstanceId }),
            darlingCastable: darlingCastable?.[player] ?? false,
          }
        : {}),
      landPlayedThisTurn: me.landPlayedThisTurn,
      mulligans: me.mulligans,
    },
    opp: {
      life: them.life,
      handCount: them.hand.length,
      deckCount: them.deck.length,
      graveyard: them.graveyard.map(cardIdOf),
      severed: them.severed.map(cardIdOf),
      ...(them.landReserve !== undefined ? { landReserve: them.landReserve.map(cardIdOf) } : {}),
      ...(them.darlingZone !== undefined
        ? {
            darlingZone: them.darlingZone === null ? null : cardIdOf(them.darlingZone),
            darlingTax: them.darlingTax ?? 0,
            ...(them.darlingInstanceId === undefined ? {} : { darlingInstanceId: them.darlingInstanceId }),
            darlingCastable: darlingCastable?.[opponentOf(player)] ?? false,
          }
        : {}),
      landPlayedThisTurn: them.landPlayedThisTurn,
      mulligans: them.mulligans,
    },
    battlefield: structuredClone(state.battlefield),
    stack: structuredClone(state.stack),
    combat: structuredClone(state.combat),
    fogThisTurn: state.fogThisTurn,
    awaiting,
    winner: state.winner,
  };
}
