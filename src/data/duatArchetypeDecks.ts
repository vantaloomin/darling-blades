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
  // 2026-08-30 owner-ruling surgery 1 REJECTED: -4 Waterclock Watcher,
  // +4 Heart-Jar Sentinel (same reserve swap) measured 15.2% (388/2550)
  // against the current 18-deck prefab row, down from 23.3% (595/2549).
  // Crimson/Wild/Burning/Grave were 4/12/14/9; the lower-curve body did not
  // replace the lost blue/value slot, so the draft was reverted.
  // 2026-08-30 owner-ruling surgery 2 REJECTED: -4 Waterclock Watcher,
  // +4 One Clean Cut (same reserve swap) measured 15.8% (404/2550) in the
  // current prefab row, with full field cells 4/13/11/25/5/13/15/15/15/31/
  // 29/7/25/20/15/19/9. It did not repair Crimson or Grave and was reverted.
  // 2026-08-30 owner-ruling surgery 4 REJECTED: -4 Waterclock Watcher,
  // +4 Charted Crossing Guide (same reserve swap) measured 11.9% (303/2550),
  // with full field cells 2/12/11/17/7/13/9/9/8/22/19/8/15/18/14/12/7.
  // The cheaper Preserve body lost Waterclock's skyborne role in this field,
  // so the draft was reverted.
  // 2026-08-30 owner-ruling surgery 5 REJECTED: -4 Keeper of the Long Debt,
  // +4 Canopic Grave Warden (same reserve swap) measured 22.0% (560/2550),
  // with full field cells 2/22/17/33/14/33/24/23/13/35/25/16/29/33/23/23/11.
  // The same-role self-mill body did not lift the field, so the draft was
  // reverted.
  // 2026-08-30 owner-ruling surgery 8 KEPT as the next-test base: -4
  // Waterclock Watcher, +4 Navigator of the Last Channel (same reserve swap)
  // measured 32.6% (832/2550) in the 17-cell prefab row; target wins by field
  // order were 20/48/28/71/43/64/53/56/30/72/48/19/84/60/40/70/26.
  // The stronger Preserve skyborne body raised the row across the field, so
  // this pressure step stayed for another measured lever.
  // 2026-08-30 owner-ruling surgery 7 REJECTED: -2 Tomb Seal, +2 Two Jars,
  // One Heart measured 21.2% (540/2550) in the 17-cell prefab row; target
  // wins by field order were 6/30/23/59/17/39/27/37/23/49/37/21/43/40/37/
  // 38/14. It was below the 23.3% baseline, so the count consolidation was
  // reverted.
  // 2026-08-30 owner-ruling surgery 6 REJECTED: -4 Waterclock Watcher,
  // +4 Devourer's Retainer (same reserve swap) measured 13.5% (344/2550),
  // with full field cells 2/11/12/13/6/13/13/10/11/22/23/9/20/15/13/32/7.
  // The heavier black body did not close games and destroyed the blue
  // skyborne role, so the draft was reverted.
  // 2026-08-30 owner-ruling surgery 3 REJECTED: -2 Tomb Seal, -2 Two Jars,
  // +4 Empty Every Jar (same reserve swap) measured 21.8% (557/2550), with
  // full field cells 5/19/16/37/14/26/19/25/15/32/22/13/37/27/21/34/9.
  // The slower mass reset did not repair the aggro cells, so this draft was
  // reverted.
  // 2026-08-30 owner-ruling surgery 9 KEPT as the next-test base: -4
  // Resin-Handed Embalmer, +4 Canopic Grave Warden (reserve mirrored)
  // measured 34.7% (884/2550) in the 17-cell prefab row; target wins by
  // field order were 24/46/34/78/39/75/51/55/30/81/50/23/89/63/40/75/31.
  // This same-role body improved the kept Navigator base from 32.6% to
  // 34.7%, so the measured pressure step stayed.
  // 2026-08-30 owner-ruling surgery 10 REJECTED: -2 Two Jars, One Heart,
  // +2 Copy Kept in Resin (reserve mirrored) measured 34.7% (886/2550), with
  // target wins 22/49/32/76/43/78/46/60/32/80/47/23/83/63/38/83/31.
  // The two-game aggregate increase was noise and it gave back the kept
    // body's Crimson, Burning, and Rite cells, so the finisher-count draft was
    // reverted.
  // 2026-08-30 owner-ruling surgery 11 KEPT as the next-test base: -4 Resin
  // Archive, +4 Tollgate of the Fourth Hall (reserve mirrored) measured 36.7%
  // (936/2550) in the 17-cell prefab row; target wins by field order were
  // 24/46/36/74/52/74/58/56/33/97/56/21/83/63/45/88/30. The grave-sever
  // and lifegain artifact improved the aggro cells over the 34.7% Warden base,
  // so the live Preserve support stayed.
  // 2026-08-30 owner-ruling surgery 12 KEPT as the next-test base: -4
  // Keeper of the Long Debt, +4 The Fourth Weighing (reserve mirrored)
  // measured 39.8% (1015/2550) in the 17-cell prefab row, with target wins
  // 23/55/46/77/45/88/59/73/28/90/54/28/94/76/62/84/33. The four-mana
  // bulwark and scarab death trigger lifted the aggro and midrange cells over
  // the 36.7% Tollgate base, so this Preserve artifact body stayed.
  // 2026-08-30 owner-ruling surgery 13 KEPT: -4 Empty Heart Jar, +4
  // Resin-Wrapped Beetle (reserve mirrored) measured 43.4% (1106/2550) in
  // the 17-cell prefab row, with target wins by field order
  // 28/74/45/85/55/89/65/76/31/93/58/31/90/83/62/102/39. The cheap
  // Preserve body and death-triggered Scarab improved the four aggro cells
  // and cleared the 40% floor, so this list is the kept Copy surgery.
  // 2026-08-30 FINAL adjusted 18-deck field confirmation after the Shadow
  // Mandate interlock rollback: Copy row in field order was
  // 19/49/30/61/37/59/43/51/21/40/39/21/61/55/41/56/26%,
  // 1063/2550 = 41.7%. The final field adjustment reran the Shadow, Midnight,
  // final-order Broodship cells at 150 seeds; Preserve/copy identity and the
  // reserve stayed coherent.
  cards: expand([
    ['land-swamp', 12],
    ['land-island', 8],
    ['sd-resin-wrapped-beetle', 4],
    ['sd-reed-bound-canopic', 4],
    ['sd-tomb-seal', 2],
    ['sd-the-debt-is-called', 4],
    ['sd-archivist-of-the-fourth-hall', 4],
    ['sd-tollgate-of-the-fourth-hall', 4],
    ['sd-canopic-grave-warden', 4],
    ['sd-the-copy-kept-in-linen', 4],
    ['sd-two-jars-one-heart', 2],
    ['sd-fourth-weighing', 4],
    ['sd-navigator-of-the-last-channel', 4],
  ]),
  reserveCards: expand([
    ['sd-resin-wrapped-beetle', 4],
    ['sd-reed-bound-canopic', 4],
    ['sd-tomb-seal', 2],
    ['sd-the-debt-is-called', 4],
    ['sd-archivist-of-the-fourth-hall', 4],
    ['sd-tollgate-of-the-fourth-hall', 4],
    ['sd-canopic-grave-warden', 4],
    ['sd-the-copy-kept-in-linen', 4],
    ['sd-two-jars-one-heart', 2],
    ['sd-fourth-weighing', 4],
    ['sd-navigator-of-the-last-channel', 4],
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
  // 2026-08-30 owner-ruling surgery 1 REJECTED: -4 Deep-Flood Behemoth,
  // +4 Silt-Crown Guardian (same reserve swap) measured 19.3% (489/2533,
  // +17 draws) in the current prefab row, with full field cells
  // 7/9/25/11/11/9/20/17/13/29/20/7/26/23/11/79/12%, versus the 28.6%
  // (724/2535, +15 draws) baseline. The early sentinel body did not replace
  // the overrun top end, so the draft was reverted.
  // 2026-08-30 owner-ruling surgery 2 KEPT as the next-test base: -2
  // Palm-Root Warden, +2 Floodgate Warden (reserve mirrored) measured 29.2%
  // (741/2537, +13 draws), with full field cells 25/26/27/17/21/18/25/26/
  // 23/41/33/19/41/31/15/89/19. Burning rose 26->27 while the Behemoth
  // finish stayed intact, so this narrow defensive consolidation stayed.
  // 2026-08-30 owner-ruling surgery 3 REJECTED: -4 Levee-Foot Scout, +4
  // Give the Field Its Due (same reserve swap) measured 22.5% (572/2543,
  // +7 draws), with full field cells 19/22/21/9/14/15/13/21/17/31/24/17/
  // 36/26/13/67/17. The free ramp did not create a board or finish, so it was
  // reverted.
  // 2026-08-30 owner-ruling surgery 4 REJECTED: -2 Floodgate Warden, +2
  // Silt-Field Champion (reserve mirrored) measured 28.6% (727/2541, +9
  // draws), with full field cells 19/28/23/17/24/19/25/26/25/39/31/20/41/
  // 35/17/75/20. It was below the kept 29.2% Floodgate base, so the second
  // pressure body was reverted.
  // 2026-08-30 owner-ruling surgery 5 REJECTED: -4 Granary Sentinel, +4
  // High-Water Cultivator (reserve mirrored) measured 26.8% (683/2547, +3
  // draws), with full field cells 23/25/28/15/21/19/23/28/20/39/32/16/48/
  // 33/16/43/20%. The extra-land body was too slow for the prefab field and
  // gave back the kept Burning and Copy pressure, so it was reverted.
  // 2026-08-30 owner-ruling surgery 6 REJECTED: -4 Levee-Foot Scout, +4
  // Silt-Field Champion (reserve mirrored) measured 31.1% (793/2547, +3
  // draws), with full field cells 25/33/32/13/30/21/29/29/29/48/39/23/50/
  // 35/23/52/23%. The overrun body improved Crimson but lost too much early
  // ramp and control-field stability, so this curve swap was reverted.
  // 2026-08-30 owner-ruling surgery 7 REJECTED: -4 Granary Sentinel, +4
  // Harvest-Tide Keeper (reserve mirrored) measured 26.9% (682/2536, +14
  // draws) in the 17-cell prefab row, with full field cells 24/27/33/15/24/
  // 20/25/30/21/26/31/27/45/35/19/27/25%. The five-mana lifegain body was
  // too slow despite its defensive trigger, so the ramp shell was restored.
  // 2026-08-30 owner-ruling surgery 8 REJECTED: -2 Palm-Root Warden, +2
  // Silt-Field Champion (reserve mirrored) measured 25.1% (639/2547, +3
  // draws) in the 17-cell prefab row, with full field cells 21/27/27/15/23/
  // 17/23/26/23/25/35/22/39/36/16/31/20%. The five-mana finisher was too
  // slow when it replaced the four-mana stabilizer, so it was reverted.
  // 2026-08-30 owner-ruling surgery 10 KEPT as the next-test base: -4
  // Flood-Gauge Runner, +4 Silt-Field Champion (reserve mirrored) measured
  // 39.0% (993/2548, +2 draws) in the 17-cell prefab row, with full field
  // cells 30/47/41/37/41/33/35/44/27/48/41/31/61/53/23/37/33%. The second
  // overrun body repaired Crimson, Wild, Burning, Grave, and Copy over the
  // 34.6% base while retaining the Floodgate core, so this pressure step
  // stayed.
  // 2026-08-30 owner-ruling surgery 11 KEPT as the next-test base: -2
  // Palm-Root Warden, +2 Harvest-Tide Keeper (reserve mirrored) measured
  // 39.7% (1012/2548, +2 draws) in the 17-cell prefab row, with full field
  // cells 31/47/42/33/43/35/33/45/29/53/43/31/63/53/23/39/32%. The five-
  // mana 3-life stabilizer lifted Crimson, Wild, Burning, Grave, and Bastet
  // over the 39.0% Silt-Field base, so this lifegain step stayed.
  // 2026-08-30 owner-ruling surgery 12 REJECTED: -4 Furrow-Water Tender,
  // +4 High-Water Cultivator (reserve mirrored) measured 39.3% (1002/2550)
  // in the 17-cell prefab row, with full field cells 26/41/37/38/44/38/42/
  // 42/28/51/47/27/58/51/25/43/29%. The heavier extra-land body gave back
  // the kept Crimson, Wild, Burning, and Copy cells, so this ramp swap was
  // reverted.
  // 2026-08-30 owner-ruling surgery 9 KEPT as the next-test base: -4
  // Granary Sentinel, +4 Flood-Line Survivor (reserve mirrored) measured
  // 34.6% (882/2546, +4 draws) in the 17-cell prefab row, with full field
  // cells 25/41/39/37/39/27/27/40/24/40/38/27/54/49/21/30/28%. The four-mana
  // 4/3 body improved the two starter cells and Copy while retaining the
  // Floodgate and Behemoth shell, so this in-identity pressure swap stayed.
  // 2026-08-30 owner-ruling surgery 13 KEPT: -4 Levee-Foot Scout, +4
  // Pride-Root Warden (reserve mirrored) measured 46.4% (1183/2550) in the
  // 17-cell prefab row, with full field cells 31/48/51/51/49/44/40/47/30/
  // 62/52/38/69/59/33/44/41%. The four-mana 4/3 body closed the remaining
  // aggro gap and put Flood in the requested mid-40s band, so this is the
  // kept Flood surgery.
  // 2026-08-30 FINAL adjusted 18-deck field confirmation after the Shadow
  // Mandate interlock rollback: Flood row in field order was
  // 31/48/51/44/49/44/40/47/30/55/52/38/71/59/33/44/41%,
  // 1164/2550 = 45.6%. The final field adjustment reran the Shadow, Midnight,
  // final-order Broodship cells at 150 seeds; the flood-control list and
  // reserve stayed coherent.
  cards: expand([
    ['land-forest', 20],
    ['sd-siltfield-forager', 4],
    ['sd-flood-line-survivor', 4],
    ['sd-pride-root-warden', 4],
    ['sd-furrow-water-tender', 4],
    ['sd-silt-field-champion', 4],
    ['sd-harvest-tide-keeper', 2],
    ['sd-floodgate-warden', 4],
    ['sd-deep-flood-behemoth', 4],
    ['sd-measure-the-silt', 4],
    ['sd-harvest-after-rain', 4],
    ['sd-ward-the-floodgate', 2],
  ]),
  reserveCards: expand([
    ['sd-siltfield-forager', 4],
    ['sd-flood-line-survivor', 4],
    ['sd-pride-root-warden', 4],
    ['sd-furrow-water-tender', 4],
    ['sd-silt-field-champion', 4],
    ['sd-harvest-tide-keeper', 2],
    ['sd-floodgate-warden', 4],
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
