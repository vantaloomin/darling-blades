import { DARLINGS_PRECONS } from '../data/darlingsPrecons';
import { STARTER_DECKS, THEME_DECKS } from '../data/starterDecks';
import { ACHIEVEMENTS } from '../meta/Achievements';
import { freshSave } from '../meta/SaveManager';
import { wave2BFixtureSave } from './deckCollectionFixtures';

const decks = [...STARTER_DECKS, ...THEME_DECKS];
export const WAVE_2C_LONGEST_DECKS = decks.filter((deck) => deck.name.length === Math.max(...decks.map((d) => d.name.length)));
export const WAVE_2C_DARLINGS = DARLINGS_PRECONS.reduce((a, b) => a.name.length >= b.name.length ? a : b);

export function wave2CShopSave(gold = 9_999_999) {
  const save = freshSave(0);
  save.gold = gold;
  save.starterChosen = STARTER_DECKS[0].id;
  save.darlingsFreeDeckClaimed = true;
  return save;
}

export function wave2CProfileSave() {
  const save = wave2BFixtureSave();
  save.achievements.pinned = [...ACHIEVEMENTS].sort((a, b) => b.title.length - a.title.length).slice(0, 3).map((a) => a.id);
  save.achievements.claimed = [...save.achievements.pinned];
  return save;
}
