/**
 * Phaser-free presentation fixtures for the dev-only accessibility probe.
 * Every call owns its save and deck arrays; no fixture is installed in Services.
 */
import { ALL_CARDS, CARD_DB } from '../data/catalog';
import { STARTER_DECKS, THEME_DECKS } from '../data/starterDecks';
import { collectiblePool } from '../meta/collectionFilter';
import { darlingsCardError } from '../meta/darlings';
import { freshSave, type SaveData, type SavedDeck } from '../meta/SaveManager';
import { PLAIN_VARIANT, variantKey } from '../meta/variants';
import { DARLINGS_DECK_SIZE, LAND_RESERVE_SIZE } from '../meta/warchest';

export const WAVE_2B_FIXTURE_IDS = {
  darlings: 'a11y-darlings',
  fullCatalog: 'a11y-full-catalog',
  empty: 'a11y-empty',
} as const;

const SOURCE_DECKS = [...STARTER_DECKS, ...THEME_DECKS];
const DARLING_ID = 'sd-bastet-mistress-of-the-ninth-return';
const longestDeckLength = Math.max(...SOURCE_DECKS.map((deck) => deck.name.length));
const longestCardLength = Math.max(...collectiblePool(ALL_CARDS).map((card) => card.name.length));

/** Source identities, never invented or padded player copy. */
export const WAVE_2B_LONGEST_DECK_NAMES: readonly string[] = SOURCE_DECKS
  .filter((deck) => deck.name.length === longestDeckLength)
  .map((deck) => deck.name);
export const WAVE_2B_LONGEST_CARD_IDS: readonly string[] = collectiblePool(ALL_CARDS)
  .filter((card) => card.name.length === longestCardLength)
  .map((card) => card.id);

function deck(
  id: string,
  name: string,
  cards: readonly string[],
  landReserve: readonly string[],
  darlingId: string | null = null,
): SavedDeck {
  return {
    id,
    name,
    cards: [...cards],
    heroCardId: null,
    landStyle: null,
    format: darlingId ? 'darlings' : 'warchest',
    darlingId,
    landReserve: [...landReserve],
    variantPins: cards.map(() => null),
  };
}

/**
 * Own the complete collectible pool and exercise both legal and oversized lists.
 * The editor and save have no list/deck-count ceiling: the full-catalog deck is
 * a finite stress fixture, not a claimed maximum or a playable deck. DeckCode's
 * separate serialization limit does not constrain an editor presentation probe.
 */
export function wave2BFixtureSave(): SaveData {
  const save = freshSave(0);
  save.gold = 9_999_999;
  save.tutorialDone = true;
  save.darlingsTutorialSeen = true;
  const pool = collectiblePool(ALL_CARDS);
  const plain = variantKey(PLAIN_VARIANT);
  for (const card of pool) {
    save.collection[card.id] = 4;
    save.collectionVariants[card.id] = { [plain]: 4 };
  }
  const reserve = Array<string>(LAND_RESERVE_SIZE).fill('land-mountain');
  const darlings = pool
    .filter((card) => card.id !== DARLING_ID && !card.types.includes('land') &&
      darlingsCardError(CARD_DB, DARLING_ID, card.id) === null)
    .sort((a, b) => b.name.length - a.name.length || a.id.localeCompare(b.id))
    .slice(0, DARLINGS_DECK_SIZE)
    .map((card) => card.id);
  const longestName = WAVE_2B_LONGEST_DECK_NAMES[0];
  save.decks = [
    deck(WAVE_2B_FIXTURE_IDS.darlings, longestName, darlings, reserve, DARLING_ID),
    deck(WAVE_2B_FIXTURE_IDS.fullCatalog, WAVE_2B_LONGEST_DECK_NAMES[WAVE_2B_LONGEST_DECK_NAMES.length - 1] ?? longestName,
      pool.map((card) => card.id), reserve),
    deck(WAVE_2B_FIXTURE_IDS.empty, SOURCE_DECKS[0].name, [], []),
    ...SOURCE_DECKS.map((source) => deck(`a11y-${source.id}`, source.name,
      source.reserveCards ?? [], source.landReserve ?? [])),
  ];
  save.activeDeckId = WAVE_2B_FIXTURE_IDS.darlings;
  return save;
}
