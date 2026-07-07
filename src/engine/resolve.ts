import type { Emit } from './battlefield';
import { enterBattlefield } from './battlefield';
import { fireTriggers, runOps, targetSpecsOf } from './effects/EffectInterpreter';
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

  const specs = castTargetSpecs(d);
  if (specs.length > 0) {
    const anyLegal = item.targets.some(
      (ref, i) => specs[i] && isLegalTarget(state, db, item.controller, specs[i], ref),
    );
    if (!anyLegal) {
      state.players[item.controller].graveyard.push(item.cardId);
      emit({ e: 'targetsFizzled', sid: item.sid });
      return;
    }
  }

  emit({ e: 'spellResolved', sid: item.sid });

  if (isType(d, 'creature') || isType(d, 'artifact') || isType(d, 'enchantment')) {
    const attachedTo =
      isAura(d) && item.targets[0]?.kind === 'permanent' ? item.targets[0].iid : undefined;
    const perm = enterBattlefield(state, db, item.cardId, item.controller, emit, { attachedTo });
    fireTriggers(state, db, emit, 'etb', perm);
    return;
  }

  if (isType(d, 'charm') || isType(d, 'ritual')) {
    for (const ab of d.abilities ?? []) {
      if (ab.when === 'spell' && ab.ops) {
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
    state.players[item.controller].graveyard.push(item.cardId);
    return;
  }

  throw new Error(`resolveStackItem: cannot resolve card type of ${item.cardId}`);
}
