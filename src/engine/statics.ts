import type { AbilityDef, CardDb, CardDef, Keyword, Permanent, PlayerId } from './types';

/**
 * What a static ability can read: the public battlefield and the public
 * Mandate holder. `GameState` and `PlayerView` both are one. A bare
 * battlefield array is still accepted, and reads the Mandate as unclaimed,
 * so callers holding only a hypothetical board keep working; every engine
 * call passes its state.
 */
export interface StaticBoard {
  readonly battlefield: readonly Permanent[];
  readonly mandateHolder?: PlayerId;
}
export type BoardInput = readonly Permanent[] | StaticBoard;
export const boardOf = (input: BoardInput): StaticBoard =>
  Array.isArray(input) ? { battlefield: input as readonly Permanent[] } : input as StaticBoard;
import { def, isType, opponentOf } from './types';

export interface EffectiveStats {
  attack: number;
  defense: number;
  keywords: ReadonlySet<Keyword>;
}

/**
 * Quest identity is data-driven by `CardDef.chapters` being present. The
 * `Quest` subtype is the authoring convention, but it is not what activates
 * `questActive`; this keeps the condition tied to executable chapter data.
 */
export function isQuestActive(
  battlefield: readonly Permanent[],
  db: CardDb,
  controller: PlayerId,
): boolean {
  return battlefield.some(
    (perm) => perm.controller === controller && def(db, perm.cardId).chapters !== undefined,
  );
}

/**
 * Sworn (2.0, P6, ruled 2026-10-08) is active while `controller` controls a
 * legendary creature: any one, the source itself included. In Darlings the
 * Darling enables it once she is cast, not from the command zone.
 */
export function isSwornActive(
  battlefield: readonly Permanent[],
  db: CardDb,
  controller: PlayerId,
): boolean {
  return battlefield.some((perm) => {
    if (perm.controller !== controller) return false;
    const d = def(db, perm.cardId);
    return isType(d, 'creature') && (d.supertypes?.includes('legendary') ?? false);
  });
}

function staticConditionSatisfied(
  board: StaticBoard,
  db: CardDb,
  controller: PlayerId,
  condition: AbilityDef['condition'] | undefined,
  sourceIid: number,
): boolean {
  if (condition === undefined) return true;
  const battlefield = board.battlefield;
  if (condition === 'youHoldMandate') return board.mandateHolder === controller;
  if (condition === 'youDontHoldMandate') return board.mandateHolder !== controller;
  if (condition === 'questActive') return isQuestActive(battlefield, db, controller);
  if (condition === 'swornActive') return isSwornActive(battlefield, db, controller);
  // Turn-history conditions belong to triggered abilities, not static layers.
  if (condition === 'creatureDiedThisTurn' || condition === 'youGainedLifeThisTurn') return false;
  if (typeof condition === 'object' && condition.kind === 'controlsOther') {
    return battlefield.some((perm) => perm.controller === controller &&
      perm.iid !== sourceIid && isType(def(db, perm.cardId), 'creature') &&
      def(db, perm.cardId).subtypes.includes(condition.subtype));
  }
  if (condition === 'controlMarked') {
    // Keep the legacy condition name, but only marked creatures satisfy it.
    return battlefield.some((perm) =>
      perm.controller === controller &&
      perm.plusOneCounters > 0 &&
      isType(def(db, perm.cardId), 'creature'),
    );
  }
  return battlefield.filter(
    (perm) => perm.controller === controller &&
      perm.plusOneCounters > 0 &&
      isType(def(db, perm.cardId), 'creature'),
  ).length >= condition.n;
}

/**
 * A card's static abilities in printed order, or null when it has none and no
 * Hauntlink rider: the only parts of a card a static read looks at, found
 * once per card (as `cardHasProvoked` does) rather than on every read.
 */
const staticLayers = new WeakMap<CardDef, readonly AbilityDef[] | null>();
function staticLayersOf(d: CardDef): readonly AbilityDef[] | null {
  let layers = staticLayers.get(d);
  if (layers === undefined) {
    const found = (d.abilities ?? []).filter((ab) => ab.when === 'static' && ab.static);
    layers = found.length === 0 && !d.hauntlink ? null : found;
    staticLayers.set(d, layers);
  }
  return layers;
}

/**
 * A read-only scope over one board: while `fn` runs, stats read from exactly
 * this battlefield array (with this Mandate holder and card db) are computed
 * once per permanent and then remembered. The AI opens one per decision on
 * the view it was handed, which nothing mutates while it decides; a simulated
 * game, a scratch board or any other array is a different array and reads
 * fresh, so the engine's own reads on mutable state are never memoised. The
 * memo dies with the scope, and scopes nest (a rollout's decision opens its
 * own on its own view).
 */
interface StatsScope {
  readonly battlefield: readonly Permanent[];
  readonly mandateHolder: PlayerId | undefined;
  readonly db: CardDb;
  readonly stats: Map<number, EffectiveStats>;
}
let statsScope: StatsScope | null = null;

export function withStatsMemo<T>(board: StaticBoard, db: CardDb, fn: () => T): T {
  const outer = statsScope;
  statsScope = { battlefield: board.battlefield, mandateHolder: board.mandateHolder, db, stats: new Map() };
  try {
    return fn();
  } finally {
    statsScope = outer;
  }
}

/**
 * Effective P/T and keywords are ALWAYS computed on read — base printed stats
 * + +1/+1 counters (Marks, then Overcharges) + until-EOT mods + static layers (auras attached to the
 * creature, and battlefield-wide lord filters). Nothing is ever cached on
 * game state, so statics can never desync; the one memo is an AI decision's
 * read-only scope (`withStatsMemo`). Operates on the battlefield array (public
 * information), so AI code can call it on a redacted view too.
 */
export function getEffectiveStats(
  boardInput: BoardInput,
  db: CardDb,
  iid: number,
): EffectiveStats {
  const board = boardOf(boardInput);
  const scope = statsScope;
  if (scope !== null && scope.battlefield === board.battlefield &&
      scope.mandateHolder === board.mandateHolder && scope.db === db) {
    let stats = scope.stats.get(iid);
    if (stats === undefined) {
      stats = computeEffectiveStats(board, db, iid);
      scope.stats.set(iid, stats);
    }
    return stats;
  }
  return computeEffectiveStats(board, db, iid);
}

function computeEffectiveStats(board: StaticBoard, db: CardDb, iid: number): EffectiveStats {
  const battlefield = board.battlefield;
  const perm = battlefield.find((p) => p.iid === iid);
  if (!perm) throw new Error(`getEffectiveStats: no permanent ${iid}`);
  const d = def(db, perm.cardId);
  const targetIsCreature = isType(d, 'creature');

  let attack = d.attack ?? 0;
  let defense = d.defense ?? 0;
  const keywords = new Set<Keyword>(d.keywords ?? []);
  for (const keyword of perm.grantedKeywords ?? []) keywords.add(keyword);

  // Marks are creature-only. Ignore legacy counters on noncreature snapshots
  // so an old replay cannot make a noncreature read as marked power.
  if (targetIsCreature) {
    attack += perm.plusOneCounters;
    defense += perm.plusOneCounters;
    // Overcharge is its own +1/+1 each, never a Mark (A1.7).
    attack += perm.overcharge ?? 0;
    defense += perm.overcharge ?? 0;
  }

  if (perm.awakened && d.awakening) {
    attack += d.awakening.p ?? 0;
    defense += d.awakening.t ?? 0;
    for (const k of d.awakening.keywords ?? []) keywords.add(k);
  }

  for (const mod of perm.untilEotMods) {
    attack += mod.p;
    defense += mod.t;
    for (const k of mod.keywords) keywords.add(k);
  }

  // Static layers from other permanents (auras on me, lords on the field).
  for (const src of battlefield) {
    const srcDef = def(db, src.cardId);
    const layers = staticLayersOf(srcDef);
    if (layers === null) continue;
    for (const ab of layers) {
      const st = ab.static!;
      const condition = ab.condition ?? st.condition;
      if (condition !== undefined && !staticConditionSatisfied(board, db, src.controller, condition, src.iid)) continue;

      let applies: boolean;
      if (st.scope === 'self') {
        applies = src.iid === iid;
      } else if (st.scope === 'attached') {
        applies = src.attachedTo === iid;
      } else {
        // filter scope: source controller's creatures matching the filter
        const filter = st.filter;
        if (!filter?.marked && !filter?.who) {
          applies =
            src.controller === perm.controller &&
            targetIsCreature &&
            (!filter?.other || src.iid !== iid) &&
            (!filter?.token || perm.isToken === true || (perm.isToken === undefined && d.token === true)) &&
            (!filter?.subtype || d.subtypes.includes(filter.subtype));
        } else {
          const who = filter.who ?? 'yours';
          applies =
            (who === 'yours'
              ? src.controller === perm.controller
              : opponentOf(src.controller) === perm.controller) &&
            targetIsCreature &&
            (!filter.other || src.iid !== iid) &&
            (!filter.token || perm.isToken === true || (perm.isToken === undefined && d.token === true)) &&
            (!filter.subtype || d.subtypes.includes(filter.subtype)) &&
            (!filter.marked || perm.plusOneCounters > 0);
        }
      }

      if (applies) {
        attack += st.p ?? 0;
        defense += st.t ?? 0;
        for (const k of st.grantKeywords ?? []) keywords.add(k);
      }
    }

    // Hauntlink's Linked rider is the same attached-static layer as an Aura,
    // but its authoring surface is explicit on CardDef and the source is
    // always a noncreature Artifact or Enchantment.
    if (srcDef.hauntlink && src.attachedTo === iid) {
      attack += srcDef.hauntlink.linked.p ?? 0;
      defense += srcDef.hauntlink.linked.t ?? 0;
      for (const k of srcDef.hauntlink.linked.grantKeywords ?? []) keywords.add(k);
    }
  }

  return { attack, defense, keywords };
}

export function hasKeyword(
  board: BoardInput,
  db: CardDb,
  iid: number,
  k: Keyword,
): boolean {
  return getEffectiveStats(board, db, iid).keywords.has(k);
}

/** A creature is summoning-sick if it entered this turn and lacks Warcry (checked on read). */
export function isSummoningSick(
  board: BoardInput,
  db: CardDb,
  perm: Permanent,
): boolean {
  return perm.enteredThisTurn && !hasKeyword(board, db, perm.iid, 'warcry');
}
