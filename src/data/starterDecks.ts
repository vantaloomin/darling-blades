export interface DeckList {
  id: string;
  name: string;
  cards: string[]; // 60 cardIds
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
  },
  {
    id: 'starter-mandate',
    name: 'Shadow Mandate',
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
      ['so-divination', 3],
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
  },
  {
    id: 'theme-gothic-monsters',
    name: 'Bloodmoon Masquerade',
    // 2026-07-20 1.3 prefab tune: shaved the over-rate Heiress, Cutthroat, and
    // Kicked Door packages for slower Vampire/Monster/Empower cards. Final
    // hard-AI aggregate: 57.3% at 300 seeds/cell (baseline 69.6%).
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
      ['gm-tattered-invitation', 4],
      ['gm-red-curtain-cut', 1],
      ['gm-dracula-ball-invite', 3],
      ['gm-black-lace-pact', 2],
      ['gm-funeral-bell', 2],
    ]),
  },
];
