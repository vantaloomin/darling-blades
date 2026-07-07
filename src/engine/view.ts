import type {
  Awaiting,
  CombatState,
  GameState,
  Permanent,
  PlayerId,
  StackItem,
  Step,
} from './types';
import { opponentOf } from './types';

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
  landPlayedThisTurn: boolean;
  mulligans: number;
}

export interface OpponentView {
  life: number;
  handCount: number;
  deckCount: number;
  graveyard: string[];
  landPlayedThisTurn: boolean;
  mulligans: number;
}

export interface PlayerView {
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

export function viewFor(state: GameState, player: PlayerId): PlayerView {
  const me = state.players[player];
  const them = state.players[opponentOf(player)];
  return {
    myId: player,
    turn: state.turn,
    step: state.step,
    activePlayer: state.activePlayer,
    startingPlayer: state.startingPlayer,
    you: {
      life: me.life,
      hand: [...me.hand],
      deckCount: me.deck.length,
      graveyard: [...me.graveyard],
      landPlayedThisTurn: me.landPlayedThisTurn,
      mulligans: me.mulligans,
    },
    opp: {
      life: them.life,
      handCount: them.hand.length,
      deckCount: them.deck.length,
      graveyard: [...them.graveyard],
      landPlayedThisTurn: them.landPlayedThisTurn,
      mulligans: them.mulligans,
    },
    battlefield: structuredClone(state.battlefield),
    stack: structuredClone(state.stack),
    combat: structuredClone(state.combat),
    fogThisTurn: state.fogThisTurn,
    awaiting: structuredClone(state.awaiting),
    winner: state.winner,
  };
}
