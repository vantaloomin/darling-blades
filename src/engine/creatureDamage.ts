import type { Emit } from './battlefield';
import { firePlayerObservers } from './effects/EffectInterpreter';
import { getEffectiveStats } from './statics';
import type { CardDb, CardDef, GameState, Keyword, Permanent, PlayerId, TargetRef } from './types';
import { def } from './types';

/**
 * The one "a creature deals damage" path (the owner's evergreen ruling, 1.9).
 * Combat's damage step and Hunt both land their damage here, so every
 * damage-reading keyword and trigger (Deathblade, Blood Oath, Provoked, and
 * any added later) applies to both from this one place, with nothing
 * Hunt-specific. Combat-defined keywords (First Blade, Twin Blades, Overrun)
 * shape combat's hit list before it gets here and mean nothing to a Hunt.
 * Other creature ability damage ("Arrives: deal 2 damage") stays off this
 * path in 1.9 (E8).
 */
export interface CreatureDamageHit {
  /** The creature dealing the damage. */
  source: number;
  sourceController: PlayerId;
  target: TargetRef;
  amount: number;
}

const provokedCarriers = new WeakMap<CardDef, boolean>();

/** Does this card print a Provoked ability? Cached per definition. */
export function cardHasProvoked(d: CardDef): boolean {
  let cached = provokedCarriers.get(d);
  if (cached === undefined) {
    cached = (d.abilities ?? []).some((ability) => ability.when === 'provoked');
    provokedCarriers.set(d, cached);
  }
  return cached;
}

/**
 * Record that a creature was dealt damage, for the state-based check that
 * judges Provoked. Only a Provoked carrier is ever marked, so a game with none
 * keeps exactly the state it had before Provoked existed.
 */
export function markStruck(db: CardDb, perm: Permanent, amount: number): void {
  if (amount > 0 && cardHasProvoked(def(db, perm.cardId))) perm.struck = true;
}

/**
 * Apply a batch of creature damage at once, in the order given: each hit's
 * damage to its creature or player, then that hit's Blood Oath gain, hit by
 * hit (combat's own interleaving), then the Blood Oath life-gain observers.
 * Each source's keywords are read once, from its effective keywords, before
 * any hit lands. Deaths are left to the caller's state-based check.
 */
export function applyCreatureDamage(
  state: GameState,
  db: CardDb,
  emit: Emit,
  hits: readonly CreatureDamageHit[],
): void {
  const keywordsOf = new Map<number, ReadonlySet<Keyword>>();
  for (const hit of hits) {
    if (keywordsOf.has(hit.source)) continue;
    const onBoard = state.battlefield.some((perm) => perm.iid === hit.source);
    keywordsOf.set(hit.source, onBoard ? getEffectiveStats(state, db, hit.source).keywords : new Set());
  }
  const deathblade = (hit: CreatureDamageHit): boolean => keywordsOf.get(hit.source)!.has('deathblade');
  const bloodOath = (hit: CreatureDamageHit): boolean => keywordsOf.get(hit.source)!.has('bloodoath');

  for (const hit of hits) {
    if (hit.target.kind === 'permanent') {
      const targetIid = hit.target.iid;
      const perm = state.battlefield.find((p) => p.iid === targetIid);
      if (perm) {
        perm.damage += hit.amount;
        if (deathblade(hit)) perm.deathtouched = true;
        markStruck(db, perm, hit.amount);
        emit({ e: 'damageMarked', iid: perm.iid, amount: hit.amount });
      }
    } else if (hit.target.kind === 'player') {
      const p = state.players[hit.target.player];
      p.life -= hit.amount;
      emit({ e: 'lifeChanged', player: hit.target.player, delta: -hit.amount, now: p.life });
    }
    if (bloodOath(hit) && hit.amount > 0) {
      const healed = state.players[hit.sourceController];
      healed.life += hit.amount;
      emit({ e: 'lifeChanged', player: hit.sourceController, delta: hit.amount, now: healed.life });
    }
  }

  // Every positive source of Blood Oath gains life separately. Observe only
  // after the whole simultaneous damage/life-gain batch has been applied.
  for (const hit of hits) {
    if (state.winner !== null) return;
    if (bloodOath(hit) && hit.amount > 0) {
      firePlayerObservers(state, db, emit, 'youGainLife', hit.sourceController);
    }
  }
}
