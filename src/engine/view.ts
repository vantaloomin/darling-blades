import type {
  Awaiting,
  CombatState,
  GameState,
  Permanent,
  PendingDecision,
  PlayerId,
  StackItem,
  Step,
} from './types';
import { cardIdOf, isCardInstance, opponentOf } from './types';

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
  /**
   * Each graveyard entry's physical identity, index-aligned with `graveyard`
   * (null for a legacy entry that has none). Graveyards are public, and this
   * is the same identity the battlefield and the stack already show; graveyard
   * targets and Retell, Whispers and Preserve actions name cards by it.
   * Always present since 1.8.1 (earlier only while a choice queue was public).
   */
  graveyardInstances?: (number | null)[];
  /** Graveyard indices whose Whispers marker lasts until the owner's opponent's Dawn. */
  whispersLive: number[];
  severed: string[];
  /** Public ordered reserve. Omitted for classic games. */
  landReserve?: string[];
  /** Public command zone. Present only in Darlings games. */
  darlingZone?: string | null;
  darlingTax?: number;
  darlingInstanceId?: number;
  darlingCastable?: boolean;
  landDropsRemaining: number;
  mulligans: number;
}

export interface OpponentView {
  life: number;
  handCount: number;
  deckCount: number;
  graveyard: string[];
  /** Public graveyard identities, as on SelfView. */
  graveyardInstances?: (number | null)[];
  /** Public live Whispers indices into this side's graveyard. */
  whispersLive: number[];
  severed: string[];
  /** Public ordered reserve. Omitted for classic games. */
  landReserve?: string[];
  /** Public command zone. Present only in Darlings games. */
  darlingZone?: string | null;
  darlingTax?: number;
  darlingInstanceId?: number;
  darlingCastable?: boolean;
  landDropsRemaining: number;
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
  creatureDiedThisTurn?: true;
  sunsetPendingWindow?: true;
  decisionResume?: GameState['decisionResume'];
  pendingDecisions?: PendingDecision[];
  /** Public flush state while a new decision suspends the stack. */
  stackClosed?: boolean;
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
  // A held trigger is public, like the trigger that fired it: whenever one
  // waits, both seats see the queue and the flush state it is holding.
  const publicQueue = state.awaiting.kind === 'hauntlinkWindow' || state.pendingDecisions.some(p => p.kind === 'discard' || p.kind === 'sacrifice' || p.kind === 'resolveTrigger' || p.continuations !== undefined || (p.kind === 'chooseTarget' && p.triggerWhen !== undefined));
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
      graveyardInstances: me.graveyard.map(c => isCardInstance(c) ? c.instanceId : null),
      whispersLive: me.graveyard.flatMap((card, index) =>
        isCardInstance(card) && card.whispersUntilDawnOf === opponentOf(player) ? [index] : [],
      ),
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
      landDropsRemaining: Math.max(0, 1 + me.extraLandDrops - me.landDropsUsed),
      mulligans: me.mulligans,
    },
    opp: {
      life: them.life,
      handCount: them.hand.length,
      deckCount: them.deck.length,
      graveyard: them.graveyard.map(cardIdOf),
      graveyardInstances: them.graveyard.map(c => isCardInstance(c) ? c.instanceId : null),
      whispersLive: them.graveyard.flatMap((card, index) =>
        isCardInstance(card) && card.whispersUntilDawnOf === player ? [index] : [],
      ),
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
      landDropsRemaining: Math.max(0, 1 + them.extraLandDrops - them.landDropsUsed),
      mulligans: them.mulligans,
    },
    battlefield: structuredClone(state.battlefield),
    stack: structuredClone(state.stack),
    combat: structuredClone(state.combat),
    fogThisTurn: state.fogThisTurn,
    ...(state.creatureDiedThisTurn ? { creatureDiedThisTurn: true as const } : {}),
    ...(state.sunsetPendingWindow ? { sunsetPendingWindow: true as const } : {}),
    ...(state.decisionResume ? { decisionResume: structuredClone(state.decisionResume) } : {}),
    ...(publicQueue ? { pendingDecisions: structuredClone(state.pendingDecisions), stackClosed: state.stackClosed } : {}),
    awaiting,
    winner: state.winner,
  };
}
