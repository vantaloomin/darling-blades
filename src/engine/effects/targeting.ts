import { getEffectiveStats } from '../statics';
import type {
  CardDb,
  GameState,
  PlayerId,
  TargetRef,
  TargetSpec,
} from '../types';
import { cardIdOf, def, isType, opponentOf } from '../types';

/**
 * Target legality — one place. Untouchable applies only to creature-targeting
 * specs. Artifact/enchantment specs deliberately ignore it, including when a
 * future multi-typed artifact creature is targeted through its non-creature
 * type. Spell upTo specs are expanded by the cast action and interpreter.
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

function permanentWithTypeTargetable(
  state: GameState,
  db: CardDb,
  iid: number,
  type: 'artifact' | 'enchantment',
): boolean {
  const perm = state.battlefield.find((p) => p.iid === iid);
  return !!perm && isType(def(db, perm.cardId), type);
}

function artifactOrEnchantmentTargetable(
  state: GameState,
  db: CardDb,
  iid: number,
): boolean {
  const perm = state.battlefield.find((p) => p.iid === iid);
  if (!perm) return false;
  const d = def(db, perm.cardId);
  return isType(d, 'artifact') || isType(d, 'enchantment');
}

function satisfiesPermanentQualifiers(
  state: GameState,
  db: CardDb,
  spec: TargetSpec,
  ref: TargetRef,
): boolean {
  if (!spec.marked && !spec.tapped) return true;
  if (ref.kind !== 'permanent') return false;
  const perm = state.battlefield.find((candidate) => candidate.iid === ref.iid);
  if (!perm) return false;
  // Marks are creature-scoped. Keep the qualifier name broad for replay and
  // data compatibility, but never make a noncreature permanent a legal
  // marked target.
  if (spec.marked && !isType(def(db, perm.cardId), 'creature')) return false;
  if (spec.marked && perm.plusOneCounters <= 0) return false;
  if (spec.tapped && !perm.tapped) return false;
  return true;
}

export function isLegalTarget(
  state: GameState,
  db: CardDb,
  caster: PlayerId,
  spec: TargetSpec,
  ref: TargetRef,
  sourceIid?: number,
): boolean {
  let legal: boolean;
  switch (spec.what) {
    case 'creature':
      legal = ref.kind === 'permanent' && creatureTargetable(state, db, caster, ref.iid);
      break;
    case 'yourCreature': {
      if (ref.kind !== 'permanent') return false;
      const perm = state.battlefield.find((p) => p.iid === ref.iid);
      legal = (
        !!perm &&
        perm.controller === caster &&
        isType(def(db, perm.cardId), 'creature')
      );
      break;
    }
    case 'yourPermanent': {
      if (ref.kind !== 'permanent') return false;
      const perm = state.battlefield.find((p) => p.iid === ref.iid);
      legal = !!perm && perm.controller === caster;
      break;
    }
    case 'player':
      legal = ref.kind === 'player';
      break;
    case 'any':
      legal = (
        ref.kind === 'player' ||
        (ref.kind === 'permanent' && creatureTargetable(state, db, caster, ref.iid))
      );
      break;
    case 'spell':
      legal = ref.kind === 'stackItem' && state.stack.some((s) => s.sid === ref.sid);
      break;
    case 'yourGraveCreature': {
      if (ref.kind !== 'grave' || ref.player !== caster) return false;
      const cardId = state.players[caster].graveyard[ref.index];
      legal = cardId !== undefined && isType(def(db, cardId), 'creature');
      break;
    }
    case 'artifact':
      legal = ref.kind === 'permanent' && permanentWithTypeTargetable(state, db, ref.iid, 'artifact');
      break;
    case 'enchantment':
      legal = ref.kind === 'permanent' && permanentWithTypeTargetable(state, db, ref.iid, 'enchantment');
      break;
    case 'artifactOrEnchantment':
      legal = ref.kind === 'permanent' && artifactOrEnchantmentTargetable(state, db, ref.iid);
      break;
  }
  if (!legal) return false;
  if (!spec.marked && !spec.tapped && !spec.other) return true;
  if (!satisfiesPermanentQualifiers(state, db, spec, ref)) return false;
  return !spec.other || sourceIid === undefined || ref.kind !== 'permanent' || ref.iid !== sourceIid;
}

/** All legal target refs for a spec (deduped for graveyard cards). */
export function enumerateTargets(
  state: GameState,
  db: CardDb,
  caster: PlayerId,
  spec: TargetSpec,
  sourceIid?: number,
): TargetRef[] {
  const out: TargetRef[] = [];
  switch (spec.what) {
    case 'creature':
    case 'yourCreature':
    case 'yourPermanent':
    case 'any': {
      for (const perm of state.battlefield) {
        const ref: TargetRef = { kind: 'permanent', iid: perm.iid };
        if (isLegalTarget(state, db, caster, spec, ref, sourceIid)) out.push(ref);
      }
      if (spec.what === 'any') {
        out.push({ kind: 'player', player: caster }, { kind: 'player', player: opponentOf(caster) });
      }
      break;
    }
    case 'player':
      out.push({ kind: 'player', player: caster }, { kind: 'player', player: opponentOf(caster) });
      break;
    case 'artifact':
    case 'enchantment':
    case 'artifactOrEnchantment':
      for (const perm of state.battlefield) {
        const ref: TargetRef = { kind: 'permanent', iid: perm.iid };
        if (isLegalTarget(state, db, caster, spec, ref, sourceIid)) out.push(ref);
      }
      break;
    case 'spell':
      for (const item of state.stack) out.push({ kind: 'stackItem', sid: item.sid });
      break;
    case 'yourGraveCreature': {
      const seen = new Set<string>();
      state.players[caster].graveyard.forEach((card, index) => {
        const cardId = cardIdOf(card);
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
