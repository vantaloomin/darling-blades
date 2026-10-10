import type { Emit } from './battlefield';
import { firePlayerObservers } from './effects/EffectInterpreter';
import type { CardDb, GameState, PlayerId } from './types';

/**
 * The Mandate (2.0, Core Set II): one public, contested marker. It begins
 * unclaimed (`mandateHolder` absent). Its holder draws a card at their dawn,
 * before ordinary dawn triggers (`startTurn`); combat damage to the holder
 * passes it to the attacker, once per damage batch (`combat/damage.ts`); and
 * `claimMandate` gives it to the effect's controller. Claiming consumes no RNG
 * and opens no window. Claiming the Mandate you already hold changes nothing
 * and emits nothing. Spec: docs/plan-core-set-2-engine.md.
 */
export function mandateHolderOf(state: Pick<GameState, 'mandateHolder'>): PlayerId | null {
  return state.mandateHolder ?? null;
}

/**
 * Give the Mandate to `player`, then fire their "whenever you claim the
 * Mandate" abilities in battlefield order. Returns whether the holder changed.
 */
export function claimMandate(
  state: GameState,
  db: CardDb,
  emit: Emit,
  player: PlayerId,
  reason: 'effect' | 'combat',
): boolean {
  const from = mandateHolderOf(state);
  if (from === player) return false;
  state.mandateHolder = player;
  emit({ e: 'mandateChanged', from, to: player, reason });
  firePlayerObservers(state, db, emit, 'youClaimMandate', player);
  return true;
}
