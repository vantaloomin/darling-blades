import type { Permanent, PlayerId, Step, TargetRef } from './types';

/**
 * The event stream is the ONLY thing the presentation layer animates from.
 * Events carry full information; `viewFor` redacts *state* for AIs, and the
 * presenter is responsible for not displaying the opponent's hidden cards.
 */
export type GameEvent =
  | { e: 'coinFlipped'; winner: PlayerId }
  | { e: 'playDrawChosen'; player: PlayerId; play: boolean }
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
  | { e: 'chapterAdvanced'; iid: number; cardId: string; chapter: number }
  | { e: 'awakened'; iid: number; cardId: string }
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
  | {
      // Foresee resolution summary. Redaction mechanism (deliberate): per the
      // contract above, the event carries FULL identities and the presenter
      // redacts — DuelScene prints card names only when `player` is the local
      // human (they already saw these cards in the foresee overlay) and logs
      // bare counts for the opponent, so the CPU's foreseen identities never
      // reach player-visible text. Mirrors how `drew` carries the AI's cardId.
      e: 'foresaw';
      player: PlayerId;
      kept: string[]; // cardIds left on top, top-first
      bottomed: string[]; // cardIds moved to the bottom, former-top-first
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
