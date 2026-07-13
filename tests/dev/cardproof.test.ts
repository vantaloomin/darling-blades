import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import { collectiblePool } from '../../src/meta/collectionFilter';
import {
  CARDPROOF_PAGE_SIZE,
  createInitialState,
  filteredCards,
  variantForChoices,
  visiblePage,
  withPage,
} from '../../src/dev/cardproof/logic';

describe('card proof-sheet logic', () => {
  it('starts on the complete collectible pool and slices deterministic pages', () => {
    const state = createInitialState();
    const cards = filteredCards(state);
    const page = visiblePage(state);

    expect(cards).toHaveLength(collectiblePool(ALL_CARDS).length);
    expect(page.matches).toHaveLength(Math.min(CARDPROOF_PAGE_SIZE, cards.length));
    expect(withPage(state, Number.MAX_SAFE_INTEGER).page).toBe(page.pages - 1);
  });

  it('maps the default selectors to the real variant contract', () => {
    const state = createInitialState();
    expect(variantForChoices(state)).toBeUndefined();
    expect(variantForChoices({ ...state, frame: 'gold' })).toEqual({ frame: 'gold', holo: 'none' });
    expect(variantForChoices({ ...state, holo: 'void' })).toEqual({ frame: 'white', holo: 'void' });
  });
});
