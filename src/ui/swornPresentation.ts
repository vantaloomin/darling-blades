/**
 * Sworn on the duel's hand (2.0, Core Set II): a Sworn card says whether its
 * condition holds right now, by a mark and a word, never by colour alone (the
 * 1.9 accessibility rule; the mobile frames' N19 "Sworn on" / "Sworn off").
 * Phaser-free; DuelScene draws the chip.
 */
import { cardMechanics } from '../data/glossary';
import type { CardDef } from '../engine/types';

export interface SwornChip {
  active: boolean;
  label: 'Sworn on' | 'Sworn off';
}

/** The chip for a card in hand, or null when nothing on the card is Sworn. */
export function swornChip(card: CardDef, active: boolean): SwornChip | null {
  if (!cardMechanics(card).includes('sworn')) return null;
  return { active, label: active ? 'Sworn on' : 'Sworn off' };
}
