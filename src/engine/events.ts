import type { Permanent, PlayerId, Step, TargetRef } from './types';

/**
 * The event stream is the ONLY thing the presentation layer animates from.
 * Events carry full information; `viewFor` redacts *state* for AIs, and the
 * presenter is responsible for not displaying the opponent's hidden cards.
 */
export type GameEvent =
  | { e: 'firstPlayerChosen'; player: PlayerId }
  | { e: 'turnBegan'; player: PlayerId; turn: number }
  | { e: 'stepChanged'; step: Step }
  | { e: 'untapped'; iids: number[] }
  | { e: 'drew'; player: PlayerId; cardId: string }
  | { e: 'mulliganTaken'; player: PlayerId; count: number }
  | { e: 'handKept'; player: PlayerId }
  | { e: 'cardsBottomed'; player: PlayerId; count: number }
  | { e: 'landPlayed'; player: PlayerId; iid: number; cardId: string }
  | { e: 'manaTapped'; player: PlayerId; iids: number[] }
  | { e: 'spellCast'; sid: number; cardId: string; controller: PlayerId; targets: TargetRef[] }
  | { e: 'responseWindowOpened'; player: PlayerId }
  | { e: 'spellResolved'; sid: number }
  | { e: 'spellCountered'; sid: number }
  | { e: 'targetsFizzled'; sid: number }
  | { e: 'permanentEntered'; perm: Permanent }
  | { e: 'attackersDeclared'; iids: number[] }
  | { e: 'blockersDeclared'; blocks: { blocker: number; attacker: number }[] }
  | {
      e: 'combatDamage';
      hits: { source: number; target: TargetRef; amount: number }[];
      firstStrike: boolean;
    }
  | { e: 'damageMarked'; iid: number; amount: number }
  | { e: 'lifeChanged'; player: PlayerId; delta: number; now: number }
  | { e: 'died'; iid: number; cardId: string; owner: PlayerId }
  | { e: 'discarded'; player: PlayerId; cardId: string }
  | { e: 'milled'; player: PlayerId; cardId: string }
  | {
      e: 'severed';
      player: PlayerId;
      cardId: string;
      from: 'battlefield' | 'graveyard' | 'deck';
      iid?: number;
    }
  | { e: 'triggerFired'; iid: number; when: string }
  | { e: 'effectApplied'; op: string; detail?: unknown }
  | { e: 'tokenCreated'; perm: Permanent }
  | { e: 'positionNote'; note: string } // debug/log line, never load-bearing
  | {
      e: 'gameEnded';
      winner: PlayerId | 'draw';
      reason: 'life' | 'deck' | 'concede' | 'turnLimit';
    };
