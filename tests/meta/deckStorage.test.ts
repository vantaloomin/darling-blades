import { describe, expect, it } from 'vitest';
import { copyDeck, deleteDeck, generateDeckId, renameDeck, saveDeck } from '../../src/meta/DeckStorage';
import { freshSave, type SaveData } from '../../src/meta/SaveManager';

function saveWithDecks(): SaveData {
  const save = freshSave(0);
  save.decks = [
    { id: 'deck-1', name: 'Aggro', cards: ['a', 'b'], heroCardId: 'b' },
    { id: 'deck-2', name: 'Control', cards: ['c'], heroCardId: null },
  ];
  save.activeDeckId = 'deck-1';
  return save;
}

/** F15: multiple saved decks — the pure DeckStorage operations behind the picker. */
describe('deck storage', () => {
  it('generateDeckId skips existing ids', () => {
    const save = saveWithDecks();
    expect(generateDeckId(save)).toBe('deck-3');
    save.decks.push({ id: 'deck-3', name: 'x', cards: [], heroCardId: null });
    expect(generateDeckId(save)).toBe('deck-4');
  });

  it('deleteDeck removes a non-active deck and leaves activeDeckId', () => {
    const save = saveWithDecks();
    deleteDeck(save, 'deck-2');
    expect(save.decks.map((d) => d.id)).toEqual(['deck-1']);
    expect(save.activeDeckId).toBe('deck-1');
  });

  it('deleteDeck reassigns activeDeckId when the active deck is deleted', () => {
    const save = saveWithDecks();
    deleteDeck(save, 'deck-1');
    expect(save.decks.map((d) => d.id)).toEqual(['deck-2']);
    expect(save.activeDeckId).toBe('deck-2');
  });

  it('deleting the last deck nulls activeDeckId', () => {
    const save = saveWithDecks();
    deleteDeck(save, 'deck-1');
    deleteDeck(save, 'deck-2');
    expect(save.decks).toEqual([]);
    expect(save.activeDeckId).toBeNull();
  });

  it('deleteDeck of an unknown id is a no-op', () => {
    const save = saveWithDecks();
    deleteDeck(save, 'nope');
    expect(save.decks).toHaveLength(2);
    expect(save.activeDeckId).toBe('deck-1');
  });

  it('copyDeck makes an independent, deep-cloned copy with a new id', () => {
    const save = saveWithDecks();
    const id = copyDeck(save, 'deck-1');
    expect(id).toBe('deck-3');
    const copy = save.decks.find((d) => d.id === id)!;
    expect(copy.name).toBe('Aggro copy');
    expect(copy.cards).toEqual(['a', 'b']);
    expect(copy.heroCardId).toBe('b');
    save.decks[0].cards.push('z'); // mutate the original…
    expect(copy.cards).toEqual(['a', 'b']); // …the copy is unaffected
    expect(copyDeck(save, 'nope')).toBeNull();
  });

  it('saveDeck preserves a valid hero and clears one no longer in the deck', () => {
    const save = saveWithDecks();

    saveDeck(save, { id: 'deck-1', name: 'Aggro+', cards: ['a', 'b', 'd'] });
    expect(save.decks.find((d) => d.id === 'deck-1')).toMatchObject({
      name: 'Aggro+',
      cards: ['a', 'b', 'd'],
      heroCardId: 'b',
    });

    saveDeck(save, { id: 'deck-1', name: 'Aggro-', cards: ['a'] });
    expect(save.decks.find((d) => d.id === 'deck-1')!.heroCardId).toBeNull();

    saveDeck(save, { id: 'deck-3', name: 'New', cards: ['x'], heroCardId: 'x' });
    expect(save.decks.find((d) => d.id === 'deck-3')!.heroCardId).toBe('x');
  });

  it('renameDeck mutates the name in place', () => {
    const save = saveWithDecks();
    renameDeck(save, 'deck-2', 'Midrange');
    expect(save.decks.find((d) => d.id === 'deck-2')!.name).toBe('Midrange');
    renameDeck(save, 'nope', 'x');
    expect(save.decks).toHaveLength(2);
  });

  it('activeDeckId always points to an existing deck or is null', () => {
    const save = saveWithDecks();
    const ok = (): boolean =>
      save.activeDeckId === null || save.decks.some((d) => d.id === save.activeDeckId);
    copyDeck(save, 'deck-1');
    expect(ok()).toBe(true);
    deleteDeck(save, 'deck-1');
    expect(ok()).toBe(true);
    deleteDeck(save, save.activeDeckId!);
    expect(ok()).toBe(true);
  });
});
