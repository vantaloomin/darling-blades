import type { RngState } from './rng';

export type PlayerId = 0 | 1;
export type Color = 'W' | 'U' | 'B' | 'R' | 'G';

export type Keyword =
  | 'skyborne'
  | 'wardingGaze'
  | 'firstBlade'
  | 'twinBlades'
  | 'warcry'
  | 'overrun'
  | 'sentinel'
  | 'bulwark'
  | 'deathblade'
  | 'bloodoath'
  | 'untouchable';

export type CardType = 'creature' | 'charm' | 'ritual' | 'enchantment' | 'artifact' | 'land';
export type Rarity = 'c' | 'r' | 'sr' | 'ssr' | 'ur';

export interface ManaCost {
  generic: number;
  pips: Partial<Record<Color, number>>;
}

// ---------------------------------------------------------------------------
// Effects — data-driven descriptors interpreted by the EffectInterpreter.
// Triggers never target (v1 rule): trigger resolution needs no decision point.
// All targeted effects are single-target (targets[0]).
// ---------------------------------------------------------------------------

export type TriggerWhen =
  | 'spell' // charm/ritual body, runs on resolution
  | 'arrives'
  | 'dies'
  | 'dawn'
  | 'combatDamageToPlayer'
  | 'attacks'
  | 'static';

export interface TargetSpec {
  what: 'creature' | 'player' | 'any' | 'spell' | 'yourCreature' | 'yourGraveCreature';
}

export type EffectOp =
  | { op: 'damage'; n: number | 'X'; to: 'target' | 'opponent' | 'controller' }
  | { op: 'gainLife'; n: number }
  | { op: 'loseLife'; n: number; who: 'opponent' }
  | { op: 'draw'; n: number }
  | { op: 'discardRandom'; n: number; who: 'opponent' }
  | { op: 'destroy'; to: 'target' }
  | { op: 'recall'; to: 'target' }
  | { op: 'cancel'; to: 'target' } // target is a stack item
  | { op: 'boost'; p: number; t: number; keywords?: Keyword[]; scope: 'target' | 'allYours' }
  | { op: 'addCounters'; n: number; to: 'target' | 'self' }
  | { op: 'tap'; to: 'target' }
  | { op: 'fetchLand' } // a basic land from deck → battlefield tapped
  | { op: 'createToken'; token: string; count: number }
  | { op: 'massDestroy'; filter: 'allCreatures' | 'allFliers' }
  | { op: 'preventCombat' } // prevent all combat damage this turn
  | { op: 'reclaim' } // return target creature card from your graveyard to hand
  | { op: 'grind'; n: number; who: 'self' | 'opponent' } // top n of deck → graveyard
  | { op: 'raise'; to?: 'target' | 'top' }; // your grave creature → battlefield (target, or trigger-safe top)

export interface StaticDef {
  scope: 'attached' | 'filter';
  /** filter scope: your creatures matching; `other` excludes the source. */
  filter?: { subtype?: string; other?: boolean };
  p?: number;
  t?: number;
  grantKeywords?: Keyword[];
}

export interface AbilityDef {
  when: TriggerWhen;
  targets?: TargetSpec[];
  ops?: EffectOp[];
  static?: StaticDef;
}

// ---------------------------------------------------------------------------
// Card definitions (static data). The engine receives a CardDb via the Game
// constructor — it never imports the catalog, so tests can inject tiny pools.
// ---------------------------------------------------------------------------

export interface CardDef {
  id: string;
  name: string;
  types: CardType[];
  subtypes: string[];
  supertypes?: ('legendary' | 'basic')[];
  cost?: ManaCost; // absent on lands
  colors: Color[];
  attack?: number;
  defense?: number;
  keywords?: Keyword[];
  x?: { min: number }; // X spells
  abilities?: AbilityDef[];
  manaAbility?: Color[]; // lands & mana creatures
  entersTapped?: boolean; // dual taplands
  rarity: Rarity;
  flavor?: string;
  artRef?: string;
  token?: boolean; // non-collectible
  set?: 'base' | 'ragnarok'; // expansion grouping; absent ⇒ 'base' (stamped in catalog.buildDb)
}

export type CardDb = Readonly<Record<string, CardDef>>;

export function def(db: CardDb, cardId: string): CardDef {
  const d = db[cardId];
  if (!d) throw new Error(`Unknown card id: ${cardId}`);
  return d;
}

export function isType(d: CardDef, t: CardType): boolean {
  return d.types.includes(t);
}

export function manaValue(cost: ManaCost | undefined): number {
  if (!cost) return 0;
  let v = cost.generic;
  for (const c of Object.values(cost.pips)) v += c;
  return v;
}

// ---------------------------------------------------------------------------
// Runtime state — plain JSON throughout; structuredClone is the whole cloning
// story. Effective P/T and keywords are ALWAYS computed on read (statics.ts).
// ---------------------------------------------------------------------------

export interface UntilEotMod {
  p: number;
  t: number;
  keywords: Keyword[];
}

export interface Permanent {
  iid: number;
  cardId: string;
  owner: PlayerId;
  controller: PlayerId;
  tapped: boolean;
  enteredThisTurn: boolean; // summoning sickness, checked vs haste on read
  damage: number; // marked damage, cleared at cleanup
  deathtouched: boolean; // took damage from a deathtouch source this turn
  attachments: number[]; // aura iids attached to me
  attachedTo?: number; // set if I am an aura
  plusOneCounters: number;
  untilEotMods: UntilEotMod[];
}

export interface StackItem {
  sid: number;
  cardId: string;
  controller: PlayerId;
  targets: TargetRef[];
  x?: number;
}

export type TargetRef =
  | { kind: 'permanent'; iid: number }
  | { kind: 'player'; player: PlayerId }
  | { kind: 'stackItem'; sid: number }
  | { kind: 'grave'; player: PlayerId; index: number };

export interface CombatState {
  attackers: number[]; // iids
  blocks: { blocker: number; attacker: number }[];
  phase: 'attackersDeclared' | 'blockersDeclared' | 'firstStrikeDone';
  /** fog effect active this turn — combat damage prevented */
  damagePrevented: boolean;
}

export type Step =
  | 'untap'
  | 'dawn'
  | 'draw'
  | 'main1'
  | 'combat'
  | 'main2'
  | 'end'
  | 'cleanup';

export type Awaiting =
  | { player: PlayerId; kind: 'mulligan' }
  | { player: PlayerId; kind: 'bottomCards'; count: number }
  | { player: PlayerId; kind: 'main' } // main1 or main2 (see state.step)
  | { player: PlayerId; kind: 'declareAttackers' }
  | { player: PlayerId; kind: 'declareBlockers' }
  | {
      player: PlayerId;
      kind: 'respond';
      over: { type: 'spell'; sid: number } | { type: 'attackers' } | { type: 'blockers' };
    }
  | { player: PlayerId; kind: 'endStepWindow' }
  | { player: PlayerId; kind: 'discardToHandSize'; count: number }
  // Resolution-time choice: which basic land a `fetchLand` effect grabs when the
  // deck holds >1 distinct basic type. Deferred (see pendingFetch) so the
  // synchronous interpreter never has to suspend mid-flush.
  | { player: PlayerId; kind: 'chooseBasicLand' }
  | { kind: 'gameOver' };

export interface PlayerState {
  life: number;
  deck: string[]; // the draw pile (cardIds; LAST element is the top). Distinct from the meta-layer SaveData.decks (built decklists).
  hand: string[];
  graveyard: string[];
  landPlayedThisTurn: boolean;
  mulligans: number;
  keptHand: boolean;
}

export interface GameState {
  rng: RngState;
  turn: number;
  startingPlayer: PlayerId; // skips their turn-1 draw
  activePlayer: PlayerId;
  step: Step;
  players: [PlayerState, PlayerState];
  battlefield: Permanent[];
  stack: StackItem[];
  stackClosed: boolean; // true once someone passed a window → flush mode
  combat: CombatState | null;
  fogThisTurn: boolean; // a fog effect prevents all combat damage this turn
  awaiting: Awaiting;
  // Controllers with a pending fetchLand basic-land choice (FIFO), queued when a
  // fetchLand op sees >1 distinct basic type. Surfaced as a `chooseBasicLand`
  // awaiting after the current stack flush finishes. Plain JSON — clones/serializes.
  pendingFetch: PlayerId[];
  nextIid: number;
  nextSid: number;
  winner: PlayerId | 'draw' | null;
  winReason: 'life' | 'deck' | 'concede' | 'turnLimit' | null;
}

export function opponentOf(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}

export function findPermanent(state: GameState, iid: number): Permanent | undefined {
  return state.battlefield.find((p) => p.iid === iid);
}
