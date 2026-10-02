/** Offline fixture for a cold first navigation. No Phaser or browser boot. */
import { ALL_CARDS, CARD_DB } from '../src/data/catalog';
import { STARTER_DECKS } from '../src/data/starterDecks';
import { collectiblePool } from '../src/meta/collectionFilter';
import { freshSave } from '../src/meta/SaveManager';
import { PLAIN_VARIANT, variantKey } from '../src/meta/variants';

const save = freshSave(0);
const plain = variantKey(PLAIN_VARIANT);
for (const card of collectiblePool(ALL_CARDS)) {
  save.collection[card.id] = 4;
  save.collectionVariants[card.id] = { [plain]: 4 };
}
const starter = STARTER_DECKS[0];
const cards = (starter.reserveCards ?? starter.cards).filter(id => !CARD_DB[id].types.includes('land'));
save.decks = [{ id: 'probe-warchest', name: starter.name, cards, format: 'warchest',
  landReserve: starter.landReserve ?? starter.cards.filter(id => CARD_DB[id].types.includes('land')).slice(0, 10),
  darlingId: null, heroCardId: null, landStyle: null, variantPins: cards.map(() => null), cardBack: null, playmat: null }];
save.activeDeckId = save.decks[0].id;
save.starterChosen = starter.id;
save.gold = 100000;
save.tutorialDone = true;
save.darlingsTutorialSeen = true;
save.settings.animations = 'reduced';
process.stdout.write(JSON.stringify(save));
