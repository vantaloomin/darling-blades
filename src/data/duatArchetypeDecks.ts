import { expand, type DeckList } from './starterDecks';

/**
 * Rite engine. The balance pass measures how often the Rite curve is cast and
 * whether twenty token-producing fodder cards are enough to keep its three
 * sacrifice rungs live.
 */
const RITE_ENGINE: DeckList = {
  id: 'duat-archetype-rite',
  name: 'Rite of the Heavier Offering',
  cards: expand([
    ['land-swamp', 12],
    ['land-mountain', 8],
    ['sd-jackal-priest-of-the-long-count', 4],
    ['sd-priestess-of-the-emptied-jar', 4],
    ['sd-give-it-the-better-one', 4],
    ['sd-hollow-jar-attendant', 4],
    ['sd-rite-fed-jackal', 4],
    ['sd-devourers-retainer', 4],
    ['sd-sun-rope-hauler', 4],
    ['sd-bring-two-leave-one', 4],
    ['sd-gatekeeper-judge', 2],
    ['sd-the-heavier-offering', 2],
    ['sd-cut-the-wrappings', 2],
    ['sd-one-clean-cut', 2],
  ]),
  reserveCards: expand([
    ['sd-jackal-priest-of-the-long-count', 4],
    ['sd-priestess-of-the-emptied-jar', 4],
    ['sd-give-it-the-better-one', 4],
    ['sd-hollow-jar-attendant', 4],
    ['sd-rite-fed-jackal', 4],
    ['sd-devourers-retainer', 4],
    ['sd-sun-rope-hauler', 4],
    ['sd-bring-two-leave-one', 4],
    ['sd-gatekeeper-judge', 2],
    ['sd-the-heavier-offering', 2],
    ['sd-cut-the-wrappings', 2],
    ['sd-one-clean-cut', 2],
  ]),
  landReserve: expand([
    ['ld-burning-luoyang', 4],
    ['land-swamp', 3],
    ['land-mountain', 3],
  ]),
};

/**
 * Nine Lives attrition. The balance pass measures the two-death pressure of
 * the W/B/R/G shell and keeps mark-adding Empower cards out of this control
 * so the Nine Lives anti-synergy remains observable.
 */
const NINE_LIVES_ATTRITION: DeckList = {
  id: 'duat-archetype-nine-lives',
  name: 'Nine Lives at Dusk',
  cards: expand([
    ['land-plains', 7],
    ['land-swamp', 5],
    ['land-mountain', 5],
    ['land-forest', 3],
    ['sd-ninth-step-duelist', 4],
    ['sd-sand-pawed-guard', 4],
    ['sd-twice-buried-lancer', 4],
    ['sd-paw-toll-taker', 4],
    ['sd-sand-pawed-skirmisher', 4],
    ['sd-tomb-toll-veteran', 4],
    ['sd-prideclaw-skirmisher', 4],
    ['sd-nine-marked-vanguard', 4],
    ['sd-keeper-of-the-last-mark', 2],
    ['sd-bastet-mistress-of-the-ninth-return', 2],
    ['sd-hollow-the-chest', 4],
  ]),
  reserveCards: expand([
    ['sd-ninth-step-duelist', 4],
    ['sd-sand-pawed-guard', 4],
    ['sd-twice-buried-lancer', 4],
    ['sd-paw-toll-taker', 4],
    ['sd-sand-pawed-skirmisher', 4],
    ['sd-tomb-toll-veteran', 4],
    ['sd-prideclaw-skirmisher', 4],
    ['sd-nine-marked-vanguard', 4],
    ['sd-keeper-of-the-last-mark', 2],
    ['sd-bastet-mistress-of-the-ninth-return', 2],
    ['sd-hollow-the-chest', 4],
  ]),
  landReserve: expand([
    ['sd-land-the-weighing-hall', 2],
    ['sd-land-silt-tomb-terrace', 2],
    ['sd-land-noon-barge-landing', 1],
    ['land-plains', 2],
    ['land-swamp', 1],
    ['land-mountain', 1],
    ['land-forest', 1],
  ]),
};

/**
 * Preserve value. The balance pass measures Preserve activations together
 * with a twenty-two-card self-mill package, rather than evaluating graveyard
 * payoffs after stripping away their enablers.
 */
const PRESERVE_VALUE: DeckList = {
  id: 'duat-archetype-preserve',
  name: 'The Copy Kept in Linen',
  cards: expand([
    ['land-plains', 8],
    ['land-island', 6],
    ['land-swamp', 4],
    ['land-forest', 2],
    ['sd-resin-archive', 4],
    ['sd-keeper-of-the-long-debt', 4],
    ['sd-resin-handed-embalmer', 4],
    ['sd-the-debt-is-called', 4],
    ['sd-two-jars-one-heart', 4],
    ['sd-the-long-drying', 2],
    ['sd-waterclock-watcher', 4],
    ['sd-the-copy-kept-in-linen', 4],
    ['sd-twice-wrapped-champion', 2],
    ['sd-silt-pool-reader', 2],
    ['sd-flood-fed-colossus', 2],
    ['sd-keeper-of-the-sealed-jar', 2],
    ['sd-sealed-doorway', 2],
  ]),
  reserveCards: expand([
    ['sd-resin-archive', 4],
    ['sd-keeper-of-the-long-debt', 4],
    ['sd-resin-handed-embalmer', 4],
    ['sd-the-debt-is-called', 4],
    ['sd-two-jars-one-heart', 4],
    ['sd-the-long-drying', 2],
    ['sd-waterclock-watcher', 4],
    ['sd-the-copy-kept-in-linen', 4],
    ['sd-twice-wrapped-champion', 2],
    ['sd-silt-pool-reader', 2],
    ['sd-flood-fed-colossus', 2],
    ['sd-keeper-of-the-sealed-jar', 2],
    ['sd-sealed-doorway', 2],
  ]),
  landReserve: expand([
    ['sd-land-the-weighing-hall', 2],
    ['sd-land-silt-tomb-terrace', 1],
    ['sd-land-reedway-delta', 2],
    ['land-plains', 2],
    ['land-island', 1],
    ['land-swamp', 1],
    ['land-forest', 1],
  ]),
};

/**
 * Empower ramp. The balance pass measures the extraLandDrop class against a
 * real ramp curve, then observes whether Empower turns that mana into a
 * credible late-game payoff without borrowing Nine Lives marks.
 */
const EMPOWER_RAMP: DeckList = {
  id: 'duat-archetype-empower',
  name: 'Flood Measures the Sky',
  cards: expand([
    ['land-forest', 8],
    ['land-mountain', 5],
    ['land-island', 4],
    ['land-plains', 3],
    ['sd-give-the-field-its-due', 4],
    ['sd-furrow-water-tender', 4],
    ['sd-measure-the-silt', 4],
    ['sd-flood-before-noon', 4],
    ['sd-flood-mark-shaman', 4],
    ['sd-harvest-line-shaman', 4],
    ['sd-deeper-than-last-year', 2],
    ['sd-silt-fat-behemoth', 2],
    ['sd-silt-crowned-harvester', 2],
    ['sd-renenutet-who-measures-the-flood', 2],
    ['sd-ra-helm-of-the-night-barge', 2],
    ['sd-barge-sail-ascendant', 2],
    ['sd-harvest-after-rain', 2],
    ['sd-ward-the-floodgate', 2],
  ]),
  reserveCards: expand([
    ['sd-give-the-field-its-due', 4],
    ['sd-furrow-water-tender', 4],
    ['sd-measure-the-silt', 4],
    ['sd-flood-before-noon', 4],
    ['sd-flood-mark-shaman', 4],
    ['sd-harvest-line-shaman', 4],
    ['sd-deeper-than-last-year', 2],
    ['sd-silt-fat-behemoth', 2],
    ['sd-silt-crowned-harvester', 2],
    ['sd-renenutet-who-measures-the-flood', 2],
    ['sd-ra-helm-of-the-night-barge', 2],
    ['sd-barge-sail-ascendant', 2],
    ['sd-harvest-after-rain', 2],
    ['sd-ward-the-floodgate', 2],
  ]),
  landReserve: expand([
    ['sd-land-reedway-delta', 2],
    ['sd-land-emberwake-channel', 2],
    ['sd-land-noon-barge-landing', 1],
    ['land-forest', 2],
    ['land-island', 1],
    ['land-mountain', 1],
    ['land-plains', 1],
  ]),
};

/**
 * Bastet tribal. The balance pass measures twinBlades anthem stacking here:
 * eight anthem sources stay beside low-attack carriers so the multiplicative
 * lord effect is visible without turning the list into a generic aggro deck.
 */
const BASTET_TRIBAL: DeckList = {
  id: 'duat-archetype-bastet',
  name: 'Bastet Under the Red Sun',
  cards: expand([
    ['land-plains', 10],
    ['land-mountain', 10],
    ['sd-whisker-count-scout', 4],
    ['sd-lion-gate-sentry', 4],
    ['sd-claw-thread-lancer', 4],
    ['sd-pridewall-runner', 4],
    ['sd-dune-pawed-outrider', 4],
    ['sd-ember-maned-lioness', 2],
    ['sd-blade-dancer', 4],
    ['sd-standard-bearer', 4],
    ['sd-war-priestess', 2],
    ['sd-bastet-gate-chorus', 2],
    ['sd-twinblade-at-the-prow', 2],
    ['sd-ashwake-twinblade', 2],
    ['sd-burn-the-rope', 2],
  ]),
  reserveCards: expand([
    ['sd-whisker-count-scout', 4],
    ['sd-lion-gate-sentry', 4],
    ['sd-claw-thread-lancer', 4],
    ['sd-pridewall-runner', 4],
    ['sd-dune-pawed-outrider', 4],
    ['sd-ember-maned-lioness', 2],
    ['sd-blade-dancer', 4],
    ['sd-standard-bearer', 4],
    ['sd-war-priestess', 2],
    ['sd-bastet-gate-chorus', 2],
    ['sd-twinblade-at-the-prow', 2],
    ['sd-ashwake-twinblade', 2],
    ['sd-burn-the-rope', 2],
  ]),
  landReserve: expand([
    ['sd-land-noon-barge-landing', 4],
    ['land-plains', 3],
    ['land-mountain', 3],
  ]),
};

export const DUAT_ARCHETYPE_DECKS: DeckList[] = [
  RITE_ENGINE,
  NINE_LIVES_ATTRITION,
  PRESERVE_VALUE,
  EMPOWER_RAMP,
  BASTET_TRIBAL,
];
