import type { Action } from '../engine/actions';
import type { PlayerView } from '../engine/view';

/**
 * Every difficulty implements this. The AI receives ONLY the redacted view
 * and the legal action menu — no difficulty reads hidden information.
 */
export interface AIPlayer {
  chooseAction(view: PlayerView, legal: Action[]): Action;
}
