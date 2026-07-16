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
    // 2026-07-02 mirror-balance tweak: -2 gk-nike, -1 bk-bunny-vanguard,
    // +3 in-wild-surge. Communion was the only starter with zero instants;
    // after MediumAI's trick respect became evidence-gated (see
    // MediumAI.trickBuff), every pilot correctly stopped fearing its open
    // mana and its mirror row collapsed (20%/21% vs Tides/Harvest at 40
    // seeds/cell). A real namesake combat trick restores both the combat
    // value and the earned respect while keeping the creature-deck identity.
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
      ['gk-athena', 2],
      ['gk-hoplite', 4],
      ['in-wild-surge', 3],
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
      ['gk-gaia', 2],
      ['gk-thanatos', 4],
      ['gk-demeter', 3],
      ['bk-lamia-nightblade', 4],
      ['bk-spiderkin-weaver', 4],
      ['bk-crowkin-shrike', 4],
      ['bk-batkin-duskwing', 4],
      ['so-raise-dead', 3],
      ['in-doom-bolt', 3],
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
 * Questing Table — W/U/R Arthurian heroic midrange: build a knight court,
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
      ['land-island', 9],
      ['land-swamp', 8],
      ['land-forest', 7],
      ['cf-morrigan-black-wing', 2],
      ['cf-mistwing-pixie', 3],
      ['cf-selkie-runner', 4],
      ['cf-omen-raven', 2],
      ['cf-silver-branch-oracle', 3],
      ['cf-moon-pool-selkie', 3],
      ['cf-raven-torc-envoy', 3],
      ['cf-crowbone-prophet', 2],
      ['cf-otter-familiar', 2],
      ['cf-blackthorn-duelist', 2],
      ['cf-selkie-tide-queen', 2],
      ['cf-glimmerdust-trick', 3],
      ['cf-bargain-for-time', 3],
      ['cf-clouded-memory', 1],
      ['cf-cold-iron-nail', 1],
    ]),
  },
  {
    id: 'theme-arthurian-court',
    name: 'Questing Table',
    cards: expand([
      ['land-plains', 9],
      ['land-island', 6],
      ['land-mountain', 3],
      ['ac-holy-well', 2],
      ['ac-avalon-shore', 2],
      ['ac-lowland-fort', 1],
      ['ac-red-tournament-ground', 1],
      ['ac-artoria-once-future', 2],
      ['ac-lancelot-moonlit-shame', 2],
      ['ac-guinevere-court-sun', 2],
      ['ac-gawain-noonblade', 2],
      ['ac-camelot-banneret', 3],
      ['ac-lakeblade-initiate', 3],
      ['ac-tournament-favorite', 3],
      ['ac-torchbearer-knight', 3],
      ['ac-novice-squire', 3],
      ['ac-quest-for-the-grail', 2],
      ['ac-round-table-vow', 2],
      ['ac-squire-to-champion', 2],
      ['ac-steel-prayer', 2],
      ['ac-moonlit-joust', 2],
      ['ac-shieldwall-call', 2],
      ['ac-grail-procession', 1],
    ]),
  },
];
