/**
 * The mode chooser for a modal Ritual or Charm (2.0, "Choose up to N"),
 * Phaser-free. The engine enumerates one cast action per legal set of modes
 * (and per target list); the chooser only narrows those actions, so it can
 * never offer a set the engine would refuse.
 */
import type { Action } from '../engine/actions';
import type { CardDef } from '../engine/types';
import { modalText } from './rulesText';

type CastAction = Extract<Action, { type: 'castSpell' }>;

export interface ModeRow {
  index: number;
  /** The mode's own rules sentence, as the card face prints it after its bullet. */
  line: string;
  /** False when no legal cast includes this mode (no legal target for it right now). */
  available: boolean;
}

/** The chooser's heading, the card face's head without its dash: "Choose one", "Choose up to two". */
export function modeChooserTitle(card: CardDef): string {
  return (modalText(card)?.split('\n')[0] ?? 'Choose').replace(/\s*—\s*$/, '');
}

export function modeRows(card: CardDef, casts: readonly CastAction[]): ModeRow[] {
  // The card face's own bullet lines, so the chooser and the card never disagree.
  const lines = (modalText(card)?.split('\n') ?? []).slice(1).map((line) => line.replace(/^•\s*/, ''));
  return (card.modal?.modes ?? []).map((_, index) => ({
    index,
    line: lines[index] ?? '',
    available: casts.some((cast) => cast.modes?.includes(index) === true),
  }));
}

/**
 * Tap a mode row. With one mode to choose, a tap picks that mode alone; with
 * more, it toggles the mode, and a tap that would choose past the limit
 * changes nothing. The result is always in printed order, as the engine wants.
 */
export function toggleMode(selected: readonly number[], index: number, upTo: number): number[] {
  if (upTo <= 1) return [index];
  if (selected.includes(index)) return selected.filter((i) => i !== index);
  if (selected.length >= upTo) return [...selected];
  return [...selected, index].sort((a, b) => a - b);
}

/** The legal casts for exactly these modes (one per target list); empty when the set is not legal. */
export function castsForModes(casts: readonly CastAction[], selected: readonly number[]): CastAction[] {
  return casts.filter((cast) =>
    cast.modes !== undefined && cast.modes.length === selected.length && cast.modes.every((m, i) => m === selected[i]));
}
