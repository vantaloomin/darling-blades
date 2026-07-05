import type { RngState } from './rng';

export type PlayerId = 0 | 1;
export type Color = 'W' | 'U' | 'B' | 'R' | 'G';

export type Keyword =
  | 'flying'
  | 'reach'
  | 'firstStrike'
  | 'doubleStrike'
  | 'haste'
  | 'trample'
  | 'vigilance'
  | 'defender'
  | 'deathtouch'
  | 'lifelink'
  | 'hexproof';

export type CardType = 'creature' | 'instant' | 'sorcery' | 'enchantment' | 'artifact' | 'land';
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
  | 'spell' // instant/sorcery body, runs on resolution
  | 'etb'
  | 'dies'
  | 'upkeep'
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
  | { op: 'bounce'; to: 'target' }
  | { op: 'counter'; to: 'target' } // target is a stack item
  | { op: 'pump'; p: number; t: number; keywords?: Keyword[]; scope: 'target' | 'allYours' }
  | { op: 'addCounters'; n: number; to: 'target' | 'self' }
  | { op: 'tap'; to: 'target' }
  | { op: 'rampBasic' } // a basic land from library → battlefield tapped
  | { op: 'createToken'; token: string; count: number }
  | { op: 'massDestroy'; filter: 'allCreatures' | 'allFliers' }
  | { op: 'fog' } // prevent all combat damage this turn
  | { op: 'regrowth' } // return target creature card from your graveyard to hand
  | { op: 'mill'; n: number; who: 'self' | 'opponent' } // top n of library → graveyard
  | { op: 'reanimate'; to?: 'target' | 'top' }; // your grave creature → battlefield (target, or trigger-safe top)

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
  power?: number;
  toughness?: number;
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
  | 'upkeep'
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
  | { kind: 'gameOver' };

export interface PlayerState {
  life: number;
  library: string[]; // cardIds; LAST element is the top of the library
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
