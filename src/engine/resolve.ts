import type { Emit } from './battlefield';
import { enterBattlefield } from './battlefield';
import { conditionSatisfied, fireTriggers, runOps, targetSpecsOf } from './effects/EffectInterpreter';
import { isLegalTarget } from './effects/targeting';
import type { CardDb, CardDef, GameState, StackItem, TargetSpec } from './types';
import { def, isType } from './types';

export type { Emit };
export { enterBattlefield };

export function isAura(d: CardDef): boolean {
  return d.subtypes.includes('Aura');
}

/** Cast-time target specs: auras implicitly target a creature to enchant. */
export function castTargetSpecs(d: CardDef): readonly TargetSpec[] {
  if (isAura(d)) return [{ what: 'creature' }];
  return targetSpecsOf(d.abilities);
}

/** R4 override casts use their target-free Retell ops instead of printed body. */
export function castTargetSpecsFor(d: CardDef, retell: boolean): readonly TargetSpec[] {
  return retell && d.retell?.ops ? [] : castTargetSpecs(d);
}

function moveSpellOnExit(state: GameState, item: StackItem, emit: Emit): void {
  if (item.retell) {
    state.players[item.controller].severed.push(item.cardId);
    // Deferred: the event union has no `from: 'stack'`; the UI workstream owns that decision.
    emit({ e: 'severed', player: item.controller, cardId: item.cardId, from: 'graveyard' });
  } else {
    state.players[item.controller].graveyard.push(item.cardId);
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

  const specs = castTargetSpecsFor(d, item.retell === true);
  if (specs.length > 0) {
    const anyLegal = item.targets.some(
      (ref, i) => specs[i] && isLegalTarget(state, db, item.controller, specs[i], ref),
    );
    if (!anyLegal) {
      moveSpellOnExit(state, item, emit);
      emit({ e: 'targetsFizzled', sid: item.sid });
      return;
    }
  }

  emit({ e: 'spellResolved', sid: item.sid });

  if (isType(d, 'creature') || isType(d, 'artifact') || isType(d, 'enchantment')) {
    const attachedTo =
      isAura(d) && item.targets[0]?.kind === 'permanent' ? item.targets[0].iid : undefined;
    const perm = enterBattlefield(state, db, item.cardId, item.controller, emit, { attachedTo });
    fireTriggers(state, db, emit, 'arrives', perm);
    runEmpowerRider(state, db, item, d, emit, perm.iid);
    return;
  }

  if (isType(d, 'charm') || isType(d, 'ritual')) {
    if (item.retell && d.retell?.ops) {
      // R4 contract: Retell override ops are trigger-safe and target-free.
      runOps(
        state,
        db,
        emit,
        { controller: item.controller, sourceCardId: item.cardId, targets: [], x: item.x },
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
              x: item.x,
            },
            ab.ops,
          );
        }
      }
    }
    runEmpowerRider(state, db, item, d, emit);
    moveSpellOnExit(state, item, emit);
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
      targets: [],
    },
    d.empower.ops,
  );
}
