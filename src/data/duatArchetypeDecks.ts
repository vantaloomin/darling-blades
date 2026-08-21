import { expand, type DeckList } from './starterDecks';

/**
 * Rite engine. The balance pass measures how often the Rite curve is cast and
 * whether twenty token-producing fodder cards are enough to keep its three
 * sacrifice rungs live.
 */
const RITE_ENGINE: DeckList = {
  id: 'duat-archetype-rite',
  name: 'Rite of the Heavier Offering',
  // MEASURED 2026-08-21 (hard AI, 150 seeds/cell, 17-deck prefab field): 42.2% (1013/2399). Rite fires: Rite-1 2.24 and Rite-2 0.48 casts per game at hard, RISING with AI tier (easy 1.20/0.13) - no hand rot, far clear of the Midnight Storybook 6.7% bar.
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
  // MEASURED 2026-08-21 (hard AI, 150 seeds/cell, 17-deck prefab field): 62.6% (1502/2399). 3.63 Nine Lives returns per game in a marks deck - the feared marks anti-synergy does not materialize at list level.
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
 * Preserve value. This low-curve rebuild keeps a twenty-six-card self-mill
 * package beside cheap Preserve bodies, so the graveyard payoffs stay live
 * without asking a ten-land reserve to carry a six-mana curve.
 */
const PRESERVE_VALUE: DeckList = {
  id: 'duat-archetype-preserve',
  name: 'The Copy Kept in Linen',
  // MEASURED 2026-08-21 (hard AI, 150 seeds/cell, 17-deck prefab field): 19.7% (473/2400) - ACCEPTED FLOOR, owner-ruled 2026-08-21. The rebuild fixed the deck (clog 2.05 -> 0.26, Preserve 1.49 -> 2.67 activations per game) and the set-wide Preserve rate cut lifted it from 14.8%, but the archetype lacks card-pool depth; a future support wave deepens it. The mechanic itself measures healthy.
  cards: expand([
    ['land-swamp', 12],
    ['land-island', 8],
    ['sd-empty-heart-jar', 4],
    ['sd-reed-bound-canopic', 4],
    ['sd-tomb-seal', 2],
    ['sd-the-debt-is-called', 4],
    ['sd-archivist-of-the-fourth-hall', 4],
    ['sd-resin-archive', 4],
    ['sd-resin-handed-embalmer', 4],
    ['sd-the-copy-kept-in-linen', 4],
    ['sd-two-jars-one-heart', 2],
    ['sd-keeper-of-the-long-debt', 4],
    ['sd-waterclock-watcher', 4],
  ]),
  reserveCards: expand([
    ['sd-empty-heart-jar', 4],
    ['sd-reed-bound-canopic', 4],
    ['sd-tomb-seal', 2],
    ['sd-the-debt-is-called', 4],
    ['sd-archivist-of-the-fourth-hall', 4],
    ['sd-resin-archive', 4],
    ['sd-resin-handed-embalmer', 4],
    ['sd-the-copy-kept-in-linen', 4],
    ['sd-two-jars-one-heart', 2],
    ['sd-keeper-of-the-long-debt', 4],
    ['sd-waterclock-watcher', 4],
  ]),
  landReserve: expand([
    ['land-swamp', 6],
    ['land-island', 4],
  ]),
};

/**
 * Empower ramp. Cheap green ramp bodies keep producing a board after the
 * land reserve is exhausted; Harvest After Rain supplies the card flow, and
 * Deep-Flood Behemoth is the only five-mana top-end.
 */
const EMPOWER_RAMP: DeckList = {
  id: 'duat-archetype-empower',
  name: 'Flood Measures the Sky',
  // MEASURED 2026-08-21 (hard AI, 150 seeds/cell, 17-deck prefab field): 35.3% (845/2397), lifted from 14.5% by the rebuild (reserve-aware ramp, repriced Harvest After Rain and Behemoth) - a soft floor beside Midnight Storybook, not a dead one.
  cards: expand([
    ['land-forest', 20],
    ['sd-siltfield-forager', 4],
    ['sd-granary-sentinel', 4],
    ['sd-levee-foot-scout', 4],
    ['sd-furrow-water-tender', 4],
    ['sd-flood-gauge-runner', 4],
    ['sd-palm-root-warden', 4],
    ['sd-floodgate-warden', 2],
    ['sd-deep-flood-behemoth', 4],
    ['sd-measure-the-silt', 4],
    ['sd-harvest-after-rain', 4],
    ['sd-ward-the-floodgate', 2],
  ]),
  reserveCards: expand([
    ['sd-siltfield-forager', 4],
    ['sd-granary-sentinel', 4],
    ['sd-levee-foot-scout', 4],
    ['sd-furrow-water-tender', 4],
    ['sd-flood-gauge-runner', 4],
    ['sd-palm-root-warden', 4],
    ['sd-floodgate-warden', 2],
    ['sd-deep-flood-behemoth', 4],
    ['sd-measure-the-silt', 4],
    ['sd-harvest-after-rain', 4],
    ['sd-ward-the-floodgate', 2],
  ]),
  landReserve: expand([
    ['land-forest', 10],
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
  // MEASURED 2026-08-21 (hard AI, 150 seeds/cell, 17-deck prefab field): 62.5% (1500/2400), down from 66.1% with the War-Priestess trim - the twinBlades anthem stack at the historical top-of-band.
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
