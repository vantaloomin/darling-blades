import type { Action } from '../engine/actions';
import { createRngState, rngFloat, rngInt, type RngState } from '../engine/rng';
import type { PlayerView } from '../engine/view';
import type { AIPlayer } from './AIPlayer';

/** Seeded decision-noise wrapper. The inner brain always advances first. */
export class NoisyAI implements AIPlayer {
  private readonly rng: RngState;

  constructor(
    private readonly inner: AIPlayer,
    seed: number,
    private readonly noise: number,
  ) {
    this.rng = createRngState(seed);
  }

  chooseAction(view: PlayerView, legal: Action[]): Action {
    const innerChoice = this.inner.chooseAction(view, legal);
    if (rngFloat(this.rng) >= this.noise) return innerChoice;

    // Conceding is never a random mistake. An inner brain may still choose it.
    // Nor is a mana pump (A1.5): its legal entry carries the full count, so a
    // random pick would dump every land into it, in any phase. The inner
    // brain's pump policy still uses it.
    const pool = legal.filter((action) => action.type !== 'concede' && action.type !== 'activateMana');
    if (pool.length === 0) return innerChoice;
    return pool[rngInt(this.rng, pool.length)];
  }
}
