import type { Emit } from './battlefield';
import { enterBattlefield } from './battlefield';
import {
  conditionSatisfied,
  fireGraveyardTriggers,
  fireTriggers,
  runOps,
  targetSpecsOf,
} from './effects/EffectInterpreter';
import { isLegalTarget } from './effects/targeting';
import type { CardDb, CardDef, CardEntry, EffectOp, GameState, StackItem, TargetSpec } from './types';
import { def, isType } from './types';

export type { Emit };
export { enterBattlefield };

export function isAura(d: CardDef): boolean {
  return d.subtypes.includes('Aura');
}

/** Cast-time target specs: auras and Hauntlink casts target a creature. */
export function castTargetSpecs(d: CardDef): readonly TargetSpec[] {
  if (isAura(d)) return [{ what: 'creature' }];
  return targetSpecsOf(d.abilities);
}

/** Override casts use their own Retell ops and targets instead of the printed body. */
export function castTargetSpecsFor(
  d: CardDef,
  retell: boolean,
  hauntlinked = false,
  empowered = false,
): readonly TargetSpec[] {
  if (hauntlinked) return [{ what: 'yourCreature' }];
  if (retell && d.retell?.ops) return d.retell.targets ?? [];
  if (empowered && d.empower?.targets) return d.empower.targets;
  return castTargetSpecs(d);
}

function usesExplicitTargetSlot(ops: readonly EffectOp[]): boolean {
  return ops.some(op => ('targetIndex' in op && op.targetIndex !== undefined) ||
    (op.op === 'ifTargetMarked' && (usesExplicitTargetSlot(op.then) || usesExplicitTargetSlot(op.else ?? []))));
}

function moveSpellOnExit(state: GameState, db: CardDb, item: StackItem, emit: Emit): void {
  const card = stackCard(state, item);
  if (item.retell) {
    state.players[item.controller].severed.push(card);
    // Deferred: the event union has no `from: 'stack'`; the UI workstream owns that decision.
    emit({ e: 'severed', player: item.controller, cardId: item.cardId, from: 'graveyard' });
  } else {
    // Stack -> graveyard (resolution/fizzle), including Whispers: stackCard
    // reconstructs identity only, so no fresh-graveyard marker survives.
    state.players[item.controller].graveyard.push(card);
    fireGraveyardTriggers(state, db, emit, card, item.controller);
  }
}

/**
 * Resolve one stack item (already popped by the flush loop). If every target
 * has become illegal, the spell fizzles to the graveyard doing nothing.
 */
export function resolveStackItem(
  state: GameState,
  db: CardDb,
  item: StackItem,
  emit: Emit,
): void {
  const d = def(db, item.cardId);

  const specs = castTargetSpecsFor(
    d,
    item.retell === true,
    item.hauntlinked === true,
    item.empowered === true,
  );
  if (specs.length > 0) {
    const optionalTargets = specs.length === 1 && specs[0].upTo !== undefined;
    const batchTargets = optionalTargets || (specs.length === 1 && specs[0].exactly !== undefined);
    const anyLegal =
      (optionalTargets && item.targets.length === 0) ||
      item.targets.some((ref, i) => {
        const spec = batchTargets ? specs[0] : specs[i];
        return spec !== undefined && isLegalTarget(state, db, item.controller, spec, ref);
      });
    if (!anyLegal) {
      moveSpellOnExit(state, db, item, emit);
      emit({ e: 'targetsFizzled', sid: item.sid });
      return;
    }
  }

  emit({ e: 'spellResolved', sid: item.sid });

  if (!(item.retell && d.retell?.ops) && (
    isType(d, 'creature') ||
    isType(d, 'artifact') ||
    isType(d, 'enchantment') ||
    (isType(d, 'ritual') && d.chapters !== undefined)
  )) {
    const attachedTo =
      (isAura(d) || item.hauntlinked === true) && item.targets[0]?.kind === 'permanent'
        ? item.targets[0].iid
        : undefined;
    const perm = enterBattlefield(state, db, stackCard(state, item), item.controller, emit, { attachedTo });
    if (item.hauntlinked && attachedTo !== undefined) {
      emit({
        e: 'hauntlinkFormed',
        linkIid: perm.iid,
        hostIid: attachedTo,
        cardId: perm.cardId,
        controller: perm.controller,
      });
    }
    fireTriggers(state, db, emit, 'arrives', perm);
    runEmpowerRider(state, db, item, d, emit, perm.iid, specs);
    return;
  }

  if (isType(d, 'charm') || isType(d, 'ritual') || (item.retell && d.retell?.ops)) {
    if (item.retell && d.retell?.ops) {
      // A Retell override resolves its own ops and target slots, then severs.
      runOps(
        state,
        db,
        emit,
        { controller: item.controller, sourceCardId: item.cardId, targets: item.targets, x: item.x,
          ...(specs.length ? { targetSpecs: specs } : {}),
          ...(specs.length === 1 && (specs[0].upTo || specs[0].exactly) ? { targetBatch: true } : {}) },
        d.retell.ops,
      );
    } else {
      for (const ab of d.abilities ?? []) {
        if (
          ab.when === 'spell' &&
          ab.ops &&
          conditionSatisfied(state, db, item.controller, ab.condition)
        ) {
          runOps(
            state,
            db,
            emit,
            {
              controller: item.controller,
              sourceCardId: item.cardId,
              targets: item.targets,
              ...(usesExplicitTargetSlot(ab.ops) || specs.some(s => s.maxCost !== undefined || s.minAttack !== undefined || s.exactly) ? { targetSpecs: specs } : {}),
              ...(specs.length === 1 && (specs[0].upTo !== undefined || specs[0].exactly !== undefined) ? { targetBatch: true } : {}),
              x: item.x,
            },
            ab.ops,
          );
        }
      }
    }
    runEmpowerRider(state, db, item, d, emit, undefined, specs);
    moveSpellOnExit(state, db, item, emit);
    return;
  }

  throw new Error(`resolveStackItem: cannot resolve card type of ${item.cardId}`);
}

/** Empower rider: trigger-safe extra ops that run after the card's normal resolution. */
function runEmpowerRider(
  state: GameState,
  db: CardDb,
  item: StackItem,
  d: CardDef,
  emit: Emit,
  sourceIid?: number,
  specs: readonly TargetSpec[] = [],
): void {
  if (!item.empowered || !d.empower) return;
  runOps(
    state,
    db,
    emit,
    {
      controller: item.controller,
      sourceCardId: item.cardId,
      ...(sourceIid === undefined ? {} : { sourceIid }),
      targets: item.targets,
      ...(usesExplicitTargetSlot(d.empower.ops) || specs.some(spec => spec.maxCost !== undefined || spec.minAttack !== undefined || spec.exactly) ? { targetSpecs: specs } : {}),
      ...(specs.length === 1 && (specs[0].upTo !== undefined || specs[0].exactly !== undefined) ? { targetBatch: true } : {}),
    },
    d.empower.ops,
  );
}

function stackCard(state: GameState, item: StackItem): CardEntry {
  if (state.nextInstanceId === undefined) return item.cardId;
  return {
    instanceId: item.instanceId ?? state.nextInstanceId++,
    cardId: item.cardId,
    variantKey: item.variantKey ?? null,
  };
}
