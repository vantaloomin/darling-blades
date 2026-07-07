import { getEffectiveStats } from '../statics';
import type {
  CardDb,
  GameState,
  PlayerId,
  TargetRef,
  TargetSpec,
} from '../types';
import { def, isType, opponentOf } from '../types';

/**
 * Target legality — one place. Hexproof: your creatures can't be targeted by
 * the OPPONENT's spells. All effects are single-target in v1 (targets[0]).
 */

function creatureTargetable(
  state: GameState,
  db: CardDb,
  caster: PlayerId,
  iid: number,
): boolean {
  const perm = state.battlefield.find((p) => p.iid === iid);
  if (!perm) return false;
  if (!isType(def(db, perm.cardId), 'creature')) return false;
  if (
    perm.controller !== caster &&
    getEffectiveStats(state.battlefield, db, iid).keywords.has('untouchable')
  ) {
    return false;
  }
  return true;
}

export function isLegalTarget(
  state: GameState,
  db: CardDb,
  caster: PlayerId,
  spec: TargetSpec,
  ref: TargetRef,
): boolean {
  switch (spec.what) {
    case 'creature':
      return ref.kind === 'permanent' && creatureTargetable(state, db, caster, ref.iid);
    case 'yourCreature': {
      if (ref.kind !== 'permanent') return false;
      const perm = state.battlefield.find((p) => p.iid === ref.iid);
      return (
        !!perm &&
        perm.controller === caster &&
        isType(def(db, perm.cardId), 'creature')
      );
    }
    case 'player':
      return ref.kind === 'player';
    case 'any':
      return (
        ref.kind === 'player' ||
        (ref.kind === 'permanent' && creatureTargetable(state, db, caster, ref.iid))
      );
    case 'spell':
      return ref.kind === 'stackItem' && state.stack.some((s) => s.sid === ref.sid);
    case 'yourGraveCreature': {
      if (ref.kind !== 'grave' || ref.player !== caster) return false;
      const cardId = state.players[caster].graveyard[ref.index];
      return cardId !== undefined && isType(def(db, cardId), 'creature');
    }
  }
}

/** All legal target refs for a spec (deduped for graveyard cards). */
export function enumerateTargets(
  state: GameState,
  db: CardDb,
  caster: PlayerId,
  spec: TargetSpec,
): TargetRef[] {
  const out: TargetRef[] = [];
  switch (spec.what) {
    case 'creature':
    case 'yourCreature':
    case 'any': {
      for (const perm of state.battlefield) {
        const ref: TargetRef = { kind: 'permanent', iid: perm.iid };
        if (isLegalTarget(state, db, caster, spec, ref)) out.push(ref);
      }
      if (spec.what === 'any') {
        out.push({ kind: 'player', player: caster }, { kind: 'player', player: opponentOf(caster) });
      }
      break;
    }
    case 'player':
      out.push({ kind: 'player', player: caster }, { kind: 'player', player: opponentOf(caster) });
      break;
    case 'spell':
      for (const item of state.stack) out.push({ kind: 'stackItem', sid: item.sid });
      break;
    case 'yourGraveCreature': {
      const seen = new Set<string>();
      state.players[caster].graveyard.forEach((cardId, index) => {
        if (seen.has(cardId)) return;
        if (isType(def(db, cardId), 'creature')) {
          seen.add(cardId);
          out.push({ kind: 'grave', player: caster, index });
        }
      });
      break;
    }
  }
  return out;
}
