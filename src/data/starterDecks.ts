export interface DeckList {
  id: string;
  name: string;
  cards: string[]; // 60 cardIds — classic
  /*
   * Reserve-native build (1.6 migration, scripted first cut 2026-08-08 via
   * scripts/avatarReserveDecks.ts, same deterministic rule as the avatar
   * decks). Carried by every granted deck, STARTER_DECKS and THEME_DECKS
   * alike. These are the real columns the dated reserve re-baseline measures
   * against, replacing the derived proxy fleets.
   *
   * DECIDED 2026-08-10 (classic retirement): this IS what a granted deck
   * hands the player. `Economy.grantedDeckBuild` grants it at the shop, and
   * the save v28 migration converts decks already granted when the player
   * never edited them. An edited deck keeps the player's choices and routes
   * to the flag-and-fix flow instead.
   */
  reserveCards?: string[]; // exactly WARCHEST_DECK_SIZE no-land cards
  landReserve?: string[]; // exactly 10 lands, ≤5 duals
}

/** Expand [id, count] pairs into a flat cardId list. Shared with opponents.ts. */
export function expand(entries: [string, number][]): string[] {
  const out: string[] = [];
  for (const [id, n] of entries) for (let i = 0; i < n; i++) out.push(id);
  return out;
}

/**
 * 60-card two-color precons (24 lands, max 4 copies, legendaries at 2-3).
 * Five decks cover all five colors — each color appears in exactly two lists:
 *   Crimson Muster  R/W  aggro (warband + Olympian support)
 *   Wild Communion  G/W  creatures (Beastkin tribal)
 *   Burning Tides   U/R  Wu tribal tempo-burn
 *   Shadow Mandate  U/B  Jin control/attrition
 *   Grave Harvest   B/G  underworld deathtouch attrition
 */
export const STARTER_DECKS: DeckList[] = [
  {
    id: 'starter-crimson',
    name: 'Crimson Muster',
    cards: expand([
      ['land-mountain', 15],
      ['land-plains', 9],
      ['tk-other-huaxiong', 4],
      ['tk-other-lulingqi', 4],
      ['bk-wolfkin-raider', 4],
      ['bk-harpy-skirmisher', 4],
      ['gk-hoplite', 4],
      ['bk-dragonmaid', 4],
      ['gk-ares', 2],
      ['tk-other-lubu', 2],
      ['gk-nike', 4],
      ['gk-hestia', 4],
    ]),
    reserveCards: expand([
      ['tk-other-huaxiong', 4],
      ['tk-other-lulingqi', 4],
      ['bk-wolfkin-raider', 4],
      ['bk-harpy-skirmisher', 4],
      ['gk-hoplite', 4],
      ['bk-dragonmaid', 4],
      ['gk-ares', 4],
      ['tk-other-lubu', 4],
      ['gk-nike', 4],
      ['gk-hestia', 4],
    ]),
    landReserve: expand([
      ['land-mountain', 6],
      ['land-plains', 4],
    ]),
  },
  {
    id: 'starter-wild',
    name: 'Wild Communion',
    // 2026-07-20 1.3 prefab tune: Wild Surge became +1 Athena / +2 Liu Bei,
    // preserving the zero-charm creature identity. Final hard-AI aggregate:
    // 42.1% at 300 seeds/cell (baseline 42.0%). Boarkin and Zhao Yun variants
    // measured 38.8% and 37.1% at 100 seeds/cell, so this is the best small swap.
    cards: expand([
      ['land-forest', 15],
      ['land-plains', 9],
      ['bk-nekomata-scout', 4],
      ['bk-bearkin-guardian', 4],
      ['bk-bunny-vanguard', 3],
      ['gk-artemis', 4],
      ['bk-rhinokin-charger', 4],
      ['bk-packmother', 4],
      ['gk-hestia', 4],
      ['gk-athena', 3],
      ['gk-hoplite', 4],
      ['tk-shu-liubei', 2],
    ]),
    reserveCards: expand([
      ['bk-nekomata-scout', 4],
      ['bk-bearkin-guardian', 4],
      ['bk-bunny-vanguard', 4],
      ['gk-artemis', 4],
      ['bk-rhinokin-charger', 4],
      ['bk-packmother', 4],
      ['gk-hestia', 4],
      ['gk-athena', 4],
      ['gk-hoplite', 4],
      ['tk-shu-liubei', 2],
      ['sd-renenutet-who-measures-the-flood', 1],
      ['gk-gaia', 1],
    ]),
    landReserve: expand([
      ['land-forest', 6],
      ['land-plains', 4],
    ]),
  },
  {
    id: 'starter-tides',
    name: 'Burning Tides',
    cards: expand([
      ['land-island', 10],
      ['land-mountain', 10],
      ['ld-red-cliffs-anchorage', 4],
      ['tk-wu-sunquan', 3],
      ['tk-wu-zhouyu', 3],
      ['tk-wu-lumeng', 4],
      ['tk-wu-sunce', 4],
      ['tk-wu-ganning', 4],
      ['tk-wu-huanggai', 4],
      ['tk-wu-taishici', 3],
      ['tk-wu-luxun', 3],
      ['in-fire-attack', 4],
      ['in-undertow', 4],
    ]),
    reserveCards: expand([
      ['tk-wu-sunquan', 4],
      ['tk-wu-zhouyu', 4],
      ['tk-wu-lumeng', 4],
      ['tk-wu-sunce', 4],
      ['tk-wu-ganning', 4],
      ['tk-wu-huanggai', 4],
      ['tk-wu-taishici', 4],
      ['tk-wu-luxun', 4],
      ['in-fire-attack', 4],
      ['in-undertow', 4],
    ]),
    landReserve: expand([
      ['ld-red-cliffs-anchorage', 4],
      ['land-island', 3],
      ['land-mountain', 3],
    ]),
  },
  {
    id: 'starter-mandate',
    name: 'Shadow Mandate',
    // 2026-07-30 W3 answer-density pass: -2 Twice-Read Water, +2 Creeping
    // Malaise. The attrition shell keeps Doom Bolt, counters, and Night
    // Extortion, trading redundant slow draw for a turn-two broad reset
    // against go-wide decks. Risk: Malaise also clips smaller Jin bodies, so
    // the package stays at two copies rather than reshaping the deck around it.
    cards: expand([
      ['land-island', 10],
      ['land-swamp', 10],
      ['ld-moonlit-marsh', 4],
      ['tk-jin-simayi', 3],
      ['tk-jin-wangyuanji', 3],
      ['tk-jin-zhangchunhua', 3],
      ['tk-jin-simashi', 3],
      ['tk-jin-zhonghui', 3],
      ['tk-jin-jiachong', 4],
      ['tk-jin-xinxianying', 4],
      ['in-doom-bolt', 4],
      ['in-read-the-ruse', 3],
      ['so-night-extortion', 3],
      ['so-divination', 1],
      ['so-creeping-malaise', 2],
    ]),
    reserveCards: expand([
      ['tk-jin-simayi', 3],
      ['tk-jin-wangyuanji', 3],
      ['tk-jin-zhangchunhua', 3],
      ['tk-jin-simashi', 1],
      ['tk-jin-jiachong', 4],
      ['tk-jin-xinxianying', 4],
      ['in-doom-bolt', 4],
      ['in-read-the-ruse', 4],
      ['so-night-extortion', 4],
      ['so-divination', 4],
      ['so-creeping-malaise', 4],
      ['yn-oni-underboss-of-rain', 1],
      ['sd-two-for-the-ferrywoman', 1],
    ]),
    landReserve: expand([
      ['ld-moonlit-marsh', 4],
      ['land-island', 3],
      ['land-swamp', 3],
    ]),
  },
  {
    id: 'starter-harvest',
    name: 'Grave Harvest',
    cards: expand([
      ['land-swamp', 10],
      ['land-forest', 10],
      ['ld-asphodel-meadow', 4],
      ['gk-persephone', 3],
      ['gk-hades', 2],
      ['gk-pan', 1],
      ['gk-thanatos', 3],
      ['bk-turtlekin-bulwark', 1],
      ['gk-demeter', 3],
      ['bk-lamia-nightblade', 4],
      ['bk-spiderkin-weaver', 4],
      ['bk-crowkin-shrike', 4],
      ['bk-batkin-duskwing', 4],
      ['bk-sheepkin-dreamherd', 1],
      ['so-raise-dead', 3],
      ['in-doom-bolt', 2],
      ['in-grave-chill', 1],
    ]),
    reserveCards: expand([
      ['gk-persephone', 3],
      ['gk-hades', 2],
      ['gk-pan', 1],
      ['gk-thanatos', 3],
      ['bk-turtlekin-bulwark', 1],
      ['gk-demeter', 3],
      ['bk-lamia-nightblade', 4],
      ['bk-spiderkin-weaver', 4],
      ['bk-crowkin-shrike', 4],
      ['bk-batkin-duskwing', 4],
      ['bk-sheepkin-dreamherd', 1],
      ['so-raise-dead', 4],
      ['in-doom-bolt', 2],
      ['in-grave-chill', 4],
    ]),
    landReserve: expand([
      ['ld-asphodel-meadow', 4],
      ['land-swamp', 3],
      ['land-forest', 3],
    ]),
  },
];

/**
 * Theme/precon decks — buyable expansion decks, deliberately kept OUT of
 * STARTER_DECKS so the one-free-starter picker (MainMenuScene, 5-panel layout)
 * and the balance harness (which measures the 5 starters) are untouched. Sold
 * in the shop for ECONOMY.preconPrice via Economy.buyThemeDeck.
 *
 * Valhalla's Muster — B/G Ragnarök reanimator: mill your own creatures into the
 * yard, then return the fattest Jotun with Call the Einherjar / Barrow-Jarl.
 * Glimmer Bargain — U/B/G Celtic Fae tempo-control: evasive fae pressure while
 * foresee and recall effects keep the next draw and opposing board constrained.
 * Questing Table — W/U Arthurian heroic midrange: build a knight court,
 * advance Quests, then turn awakened champions into the closing pressure.
 * Midnight Storybook — U/B/W Dark Tales value-control: Skim early, fill the
 * graveyard, and Retell efficient Rituals and Charms after stabilizing.
 * Neon Afterimage — W/U Yokai Nights pressure with black support: curve into
 * legendary finishers, link durable evasive hosts, and use black Sever effects
 * to keep the street manageable. Measured 60.4% at 300 seeds/cell 2026-07-30
 * (the dated block on its list below carries the full record).
 */
export const THEME_DECKS: DeckList[] = [
  {
    id: 'theme-ragnarok',
    name: "Valhalla's Muster",
    cards: expand([
      ['land-swamp', 10],
      ['land-forest', 10],
      ['ld-asphodel-meadow', 4],
      ['rg-corpse-taker', 4],
      ['rg-hels-handmaiden', 3],
      ['rg-verdant-seidr', 3],
      ['rg-worldroot-tender', 2],
      ['rg-plaguebearer-draugr', 3],
      ['rg-barrow-wight', 3],
      ['rg-draugr-jarl', 3],
      ['rg-deaths-herald', 3],
      ['rg-jotun-earthshaker', 3],
      ['rg-jotun-warleader', 2],
      ['rg-dianwei', 2],
      ['rg-thanatos', 2],
      ['rg-call-the-einherjar', 3],
    ]),
    reserveCards: expand([
      ['rg-corpse-taker', 4],
      ['rg-hels-handmaiden', 3],
      ['rg-verdant-seidr', 3],
      ['rg-worldroot-tender', 2],
      ['rg-plaguebearer-draugr', 3],
      ['rg-barrow-wight', 2],
      ['rg-draugr-jarl', 3],
      ['rg-jotun-earthshaker', 1],
      ['rg-thanatos', 2],
      ['rg-call-the-einherjar', 4],
      ['rg-verdant-seidr', 1],
      ['cf-badb-cathas-warning', 1],
      ['gk-artemis', 1],
      ['cf-blackthorn-duelist', 1],
      ['cf-cauldron-of-dagda', 1],
      ['cf-hounds-of-annwn', 1],
      ['cf-thornmaze-patrol', 1],
      ['gm-madame-macabre', 1],
      ['gm-ravenloft-heiress', 1],
      ['ac-ashwood-ranger', 1],
      ['ac-oathbroken-knight', 1],
      ['gm-batcloak-cutthroat', 1],
      ['cf-raven-torc-envoy', 1],
    ]),
    landReserve: expand([
      ['ld-asphodel-meadow', 4],
      ['land-swamp', 3],
      ['land-forest', 3],
    ]),
  },
  {
    id: 'theme-celtic-fae',
    name: 'Glimmer Bargain',
    cards: expand([
      ['land-island', 7],
      ['land-swamp', 5],
      ['land-forest', 6],
      ['cf-moonlit-barrow', 3],
      ['cf-blackthorn-crossing', 3],
      ['cf-morrigan-black-wing', 2],
      ['cf-queen-mab-midnight', 2],
      ['cf-selkie-tide-queen', 2],
      ['cf-mistwing-pixie', 4],
      ['cf-selkie-runner', 4],
      ['cf-blackthorn-duelist', 4],
      ['cf-silver-branch-oracle', 4],
      ['cf-moon-pool-selkie', 3],
      ['cf-hounds-of-annwn', 3],
      ['cf-raven-torc-envoy', 2],
      ['cf-glimmerdust-trick', 3],
      ['cf-bargain-for-time', 3],
    ]),
    reserveCards: expand([
      ['cf-morrigan-black-wing', 2],
      ['cf-queen-mab-midnight', 2],
      ['cf-selkie-tide-queen', 2],
      ['cf-mistwing-pixie', 4],
      ['cf-selkie-runner', 4],
      ['cf-blackthorn-duelist', 4],
      ['cf-silver-branch-oracle', 4],
      ['cf-moon-pool-selkie', 3],
      ['cf-hounds-of-annwn', 3],
      ['cf-raven-torc-envoy', 2],
      ['cf-glimmerdust-trick', 3],
      ['cf-bargain-for-time', 4],
      ['cf-glimmerdust-trick', 1],
      ['cf-hounds-of-annwn', 1],
      ['cf-moon-pool-selkie', 1],
    ]),
    landReserve: expand([
      ['cf-moonlit-barrow', 3],
      ['cf-blackthorn-crossing', 2],
      ['land-island', 2],
      ['land-swamp', 1],
      ['land-forest', 2],
    ]),
  },
  {
    id: 'theme-arthurian-court',
    name: 'Questing Table',
    // 2026-07-20 1.3 prefab tune: rebuilt the red/slow slots into the measured
    // W/U pressure shell (Undertow, Shieldwall, max Banneret/Lakeblade, anthems).
    // Final hard-AI aggregate: 45.2% at 300 seeds/cell (baseline 23.5%).
    cards: expand([
      ['land-plains', 9],
      ['land-island', 8],
      ['ac-avalon-shore', 4],
      ['ac-lowland-fort', 3],
      ['ac-artoria-once-future', 2],
      ['ac-galahad-silver-oath', 2],
      ['ac-camelot-banneret', 4],
      ['ac-lakeblade-initiate', 4],
      ['ac-pennant-carrier', 4],
      ['ac-novice-squire', 4],
      ['ac-excalibur-from-lake', 2],
      ['ac-lion-standard', 1],
      ['ac-quest-for-the-grail', 2],
      ['ac-round-table-vow', 2],
      ['ac-squire-to-champion', 2],
      ['in-undertow', 4],
      ['in-shieldwall', 3],
    ]),
    reserveCards: expand([
      ['ac-artoria-once-future', 2],
      ['ac-galahad-silver-oath', 2],
      ['ac-camelot-banneret', 4],
      ['ac-lakeblade-initiate', 4],
      ['ac-pennant-carrier', 4],
      ['ac-novice-squire', 4],
      ['ac-excalibur-from-lake', 2],
      ['ac-lion-standard', 1],
      ['ac-quest-for-the-grail', 2],
      ['ac-round-table-vow', 2],
      ['ac-squire-to-champion', 2],
      ['in-undertow', 4],
      ['in-shieldwall', 4],
      ['ac-squire-to-champion', 2],
      ['ac-excalibur-from-lake', 1],
    ]),
    landReserve: expand([
      ['ac-avalon-shore', 4],
      ['land-plains', 3],
      ['land-island', 3],
    ]),
  },
  {
    id: 'theme-gothic-monsters',
    name: 'Bloodmoon Masquerade',
    // 2026-07-20 1.3 prefab tune: shaved the over-rate Heiress, Cutthroat, and
    // Kicked Door packages for slower Vampire/Monster/Empower cards. Final
    // hard-AI aggregate: 57.3% at 300 seeds/cell (baseline 69.6%).
    // 2026-07-30 W3 answer-density pass: -2 Tattered Invitation, +2 Ember
    // Squall. The B/R pressure shell retains two discard spells while gaining
    // a cheap reset against go-wide boards. Risk: Squall also damages its
    // small Vampire starts, so this stays at two copies and does not replace
    // the list's sturdier midgame creature package.
    cards: expand([
      ['land-swamp', 14],
      ['land-mountain', 10],
      ['gm-carmilla-crimson-host', 2],
      ['gm-elizabeth-blood-mirror', 2],
      ['gm-blood-drop-initiate', 4],
      ['gm-black-veil-matron', 3],
      ['gm-stormglass-golem', 4],
      ['gm-blood-opera-soloist', 3],
      ['gm-manor-thrall', 4],
      ['gm-stitched-hound', 2],
      ['gm-tattered-invitation', 2],
      ['gm-red-curtain-cut', 1],
      ['gm-dracula-ball-invite', 3],
      ['gm-black-lace-pact', 2],
      ['gm-funeral-bell', 2],
      ['so-ember-squall', 2],
    ]),
    reserveCards: expand([
      ['gm-carmilla-crimson-host', 2],
      ['gm-elizabeth-blood-mirror', 2],
      ['gm-blood-drop-initiate', 4],
      ['gm-black-veil-matron', 3],
      ['gm-stormglass-golem', 4],
      ['gm-blood-opera-soloist', 3],
      ['gm-manor-thrall', 4],
      ['gm-stitched-hound', 2],
      ['gm-tattered-invitation', 2],
      ['gm-red-curtain-cut', 1],
      ['gm-funeral-bell', 2],
      ['so-ember-squall', 4],
      ['gm-red-curtain-cut', 3],
      ['gm-tattered-invitation', 2],
      ['gm-funeral-bell', 2],
    ]),
    landReserve: expand([
      ['land-swamp', 6],
      ['land-mountain', 4],
    ]),
  },
  {
    id: 'theme-dark-tales',
    name: 'Midnight Storybook',
    // W2 tuning history (2026-07-30, post-W0-AI-fix field). Control at 300
    // seeds/cell: 35.3% aggregate, but 29.9% like-for-like excluding the free
    // 84% cell vs the broken Neon Afterimage — unchanged from the 1.4 anchor
    // (30.5%). Worst cells: Crimson 19, Harvest 24, Tides 25 (the control
    // deck's aggro hole). REJECTED candidate at a 60-seed probe: -2 Gilded
    // Stepmother -2 Rose-Petal Knight -2 Foam-Silk Siren, +4 Mirror-Apple
    // Curse +2 The Sleeping Curse measured 23.7% like-for-like (aggregate
    // 28.7%), with the target cells WORSE (Tides 25->15, Harvest 24->13) and
    // Glimmer 36->20: trading six bodies for six answers costs more pressure
    // than the removal converts. The 1.4-era negative stands too (sweeper
    // 5B->4B, 34.3%->33.3%). Any future candidate must add interaction
    // without shrinking the body count this far. Round 2 (surgical: Hades x2
    // -> Aphrodite x2) probed NEUTRAL: 30.6% like-for-like vs 29.9% control,
    // aggro cells unmoved (Crimson 20, Tides 25, Harvest 22) — rejected
    // rather than confirmed at 300 seeds, because a +0.7pp delta on 540
    // games is noise. W2 CLOSED 2026-07-30 as the honest miss the
    // band-as-direction decision anticipated: published at 29.9%, the deck
    // unchanged. What a real fix likely needs (documented for the next
    // pass): either survivable early bodies that this set does not print,
    // or the common sweepers arriving in W3.5 giving the field cheap
    // partial resets this deck can splash.
    // 2026-07-30 W3 answer-density pass: -2 Judgment of Heaven, +2 Creeping
    // Malaise. This keeps the W2 body floor and its single-target answers,
    // exchanging the slow double-white reset for affordable early partial
    // resets. Malaise has no Skim/Retell synergy; it is here strictly as an
    // answer. Risk: it can shrink this deck's small bodies and leave larger
    // opposing boards intact.
    cards: expand([
      ['land-island', 8],
      ['land-swamp', 7],
      ['land-plains', 5],
      ['dt-tide-cavern', 2],
      ['dt-palace-steps', 2],
      ['dt-tower-window-seer', 2],
      ['dt-gilded-stepmother', 2],
      ['dt-glass-stair-duelist', 2],
      ['dt-foam-silk-siren', 4],
      ['dt-poison-mirror-regent', 2],
      ['dt-rose-petal-knight', 2],
      ['dt-page-torn-free', 2],
      ['bk-kitsune-illusionist', 4],
      ['tk-shu-zhaoyun', 2],
      ['tk-jin-simayi', 2],
      ['tk-wei-guojia', 2],
      ['gk-hades', 2],
      ['in-doom-bolt', 4],
      ['in-undertow', 2],
      ['so-creeping-malaise', 2],
    ]),
    reserveCards: expand([
      ['dt-glass-stair-duelist', 2],
      ['dt-poison-mirror-regent', 2],
      ['dt-rose-petal-knight', 2],
      ['dt-page-torn-free', 2],
      ['bk-kitsune-illusionist', 4],
      ['tk-shu-zhaoyun', 2],
      ['tk-jin-simayi', 2],
      ['tk-wei-guojia', 2],
      ['gk-hades', 2],
      ['in-doom-bolt', 4],
      ['in-undertow', 2],
      ['so-creeping-malaise', 2],
      ['in-undertow', 2],
      ['dt-page-torn-free', 2],
      ['dt-tide-sister-of-the-deep', 2],
      ['dt-glass-coffin-sleeper', 2],
      ['dt-empress-of-the-mirror-shards', 2],
      ['dt-frost-sleigh-maiden', 2],
    ]),
    landReserve: expand([
      ['dt-tide-cavern', 2],
      ['land-island', 3],
      ['land-swamp', 3],
      ['land-plains', 2],
    ]),
  },
  {
    id: 'theme-yokai-nights',
    name: 'Neon Afterimage',
    // 2026-07-30 W6 rebuild, MEASURED: 60.4% aggregate (1811/3000) at 300
    // seeds/cell hard AI (`balance-matrix --prefabs --ai hard --seeds 300`),
    // up from the shipped list's 10.5% — the worst prefab ever recorded here
    // (largest creature 2/3, max attack 2, no top-end). Second in the field,
    // 0.8pp behind Crimson Muster (61.2%); worst cell a decided 33% vs
    // Burning Tides. Top-of-band on purpose: the field's true ceiling is
    // 61.2%, so this is inside the real spread, and W7's combined re-baseline
    // re-measures it against the sweepers and tapland riders that landed
    // after this matrix. Shape: a W/U pressure shell builds through the
    // middle turns, then legendary closers and evasive hosts turn Hauntlink
    // into an attack rather than a small-body patch. A light black package
    // supplies removal and an Oni finisher without stressing the W/U core.
    cards: expand([
      ['land-plains', 7],
      ['land-island', 8],
      ['land-swamp', 5],
      ['yn-lantern-canal-junction', 2],
      ['yn-midnight-data-market', 2],
      ['yn-queen-of-the-lanterned-roof', 2],
      ['yn-ghost-net-archon', 2],
      ['yn-oni-underboss-of-rain', 2],
      ['yn-white-lantern-vanguard', 4],
      ['yn-moonlit-data-duelist', 4],
      ['yn-skyline-yokai', 4],
      ['yn-echo-fox-informant', 4],
      ['yn-lantern-fixer', 4],
      ['yn-hauntlink-apex', 2],
      ['yn-unanswered-signal', 2],
      ['yn-hauntlink-signal-lure', 2],
      ['yn-alleyway-sever', 2],
      ['yn-sever-the-signal', 2],
    ]),
    reserveCards: expand([
      ['yn-queen-of-the-lanterned-roof', 2],
      ['yn-oni-underboss-of-rain', 2],
      ['yn-white-lantern-vanguard', 4],
      ['yn-moonlit-data-duelist', 4],
      ['yn-skyline-yokai', 4],
      ['yn-echo-fox-informant', 4],
      ['yn-lantern-fixer', 4],
      ['yn-unanswered-signal', 2],
      ['yn-hauntlink-signal-lure', 2],
      ['yn-alleyway-sever', 4],
      ['yn-hauntlink-signal-lure', 2],
      ['yn-oni-underboss-of-rain', 2],
      ['gk-aphrodite', 1],
      ['ac-quest-for-the-grail', 1],
      ['cf-badb-cathas-warning', 1],
      ['gm-silver-bullet-duelist', 1],
    ]),
    landReserve: expand([
      ['yn-lantern-canal-junction', 2],
      ['yn-midnight-data-market', 2],
      ['land-plains', 2],
      ['land-island', 2],
      ['land-swamp', 2],
    ]),
  },
  {
    id: 'theme-sands-of-the-duat',
    name: 'Pride at the Ninth Gate',
    // 2026-08-21 Duat balance pass, MEASURED: 64.7% aggregate (1553/2400) at
    // 150 seeds/cell hard AI across the 17-deck prefab field (`balance-matrix
    // --prefabs --ai hard --seeds 150`), down from 68.3% at the first cut via
    // the War-Priestess cost bump ({3}{W}{R} -> {4}{W}{R}) and her anthem going
    // defensive (+1/+1 -> +0/+1, so twinBlades stops doubling it). Field-best
    // on purpose as the new set's face; next lever if it must come down is the
    // four-copy Standard Bearer attack anthem.
    cards: expand([
      ['land-plains', 10],
      ['land-mountain', 10],
      ['sd-land-noon-barge-landing', 4],
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
      ['sd-bastet-mistress-of-the-ninth-return', 2],
    ]),
    reserveCards: expand([
      ['sd-whisker-count-scout', 4],
      ['sd-lion-gate-sentry', 4],
      ['sd-claw-thread-lancer', 4],
      ['sd-pridewall-runner', 4],
      ['sd-dune-pawed-outrider', 4],
      ['sd-ember-maned-lioness', 4],
      ['sd-blade-dancer', 4],
      ['sd-standard-bearer', 4],
      ['sd-war-priestess', 2],
      ['sd-bastet-gate-chorus', 2],
      ['sd-twinblade-at-the-prow', 2],
      ['sd-bastet-mistress-of-the-ninth-return', 2],
    ]),
    landReserve: expand([
      ['sd-land-noon-barge-landing', 4],
      ['land-plains', 3],
      ['land-mountain', 3],
    ]),
  },
];
