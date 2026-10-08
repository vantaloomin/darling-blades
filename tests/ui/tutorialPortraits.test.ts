import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import manifest from '../../src/data/art-manifest.json';
import { TUTORIAL_OPPONENT_PORTRAIT, TUTORIAL_PLAYER_DECK } from '../../src/data/tutorial';
import { isType } from '../../src/engine/types';
import { faceCardFor } from '../../src/meta/deckFace';

/**
 * The tutorial duel's two portraits (1.9, I6). A new player's commander
 * portrait is their deck's face card (`faceCardFor`), and the teaching
 * opponent's is the tutorial's own pick, so the first duel anyone plays shows
 * two different people across the board.
 */
describe('the tutorial duel portraits', () => {
  it("never show the player's own face on the teaching opponent", () => {
    expect(TUTORIAL_OPPONENT_PORTRAIT).not.toBe(faceCardFor(TUTORIAL_PLAYER_DECK, CARD_DB));
  });

  it('front the teaching opponent with a creature that has real art', () => {
    const card = CARD_DB[TUTORIAL_OPPONENT_PORTRAIT];
    expect(card, `${TUTORIAL_OPPONENT_PORTRAIT} is not a card`).toBeDefined();
    expect(isType(card, 'creature')).toBe(true);
    expect(manifest.cards).toContain(card.artRef ?? card.id);
  });
});
