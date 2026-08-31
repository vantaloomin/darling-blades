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
    // NOTE 2026-08-30: owner-ruling surgery 1-16 focused probes below used
    // MediumAI on both sides. They remain the dated draft history, but are not
    // comparable to the supplied `--warchest --ai hard` audit. The hard-brain
    // remeasurements from surgery 17 onward are authoritative for this pass.
    // 2026-08-30 owner-ruling surgery 1 REJECTED: -2 Night Extortion, +2
    // Poisoned Comb (with the same reserve swap) measured 26.6% Warchest
    // aggregate (213/800), cells Crimson/Wild/Burning/Grave 14/47/12/34,
    // versus the baseline 23.9% (191/800), 11/38/13/34. Wild rose, but the
    // required Burning cell regressed, so this measured removal-density draft
    // was reverted.
    // 2026-08-30 owner-ruling surgery 2 REJECTED: -2 Xin Xianying, +2
    // Sugar-Cottage Witch (same reserve swap) measured 22.3% Warchest
    // aggregate (178/800), cells 9/43/10/28, versus baseline 23.9%
    // (191/800), 11/38/13/34. The stronger bodies did not buy the
    // Crimson/Burning matchups, so this draft was reverted.
    // 2026-08-30 owner-ruling surgery 3 KEPT as the next-test base: -1
    // Divination, -2 Creeping Malaise, -1 Night Extortion, +4 Apple of
    // Endless Sleep measured 26.3% Warchest (210/800), cells 13/45/13/34,
    // up from the supplied 23.9% (191/800), 11/38/13/34. The cheap sever
    // package helped both Crimson and Burning without giving back Burning.
    // 2026-08-30 owner-ruling surgery 4 REJECTED: -4 Xin Xianying, +4
    // Poisoned Comb (same reserve swap) measured 11.9% Warchest (95/800),
    // cells 11/20/6/12, versus the kept Apple base 26.3%, 13/45/13/34.
    // The source-order Warchest rebuild made every non-Crimson cell worse,
    // including a 6% Burning result, so this deep-destruction draft was
    // reverted.
    // 2026-08-30 owner-ruling surgery 6 REJECTED: -4 Xin Xianying, +4
    // Heart-Jar Sentinel (same reserve swap) measured 18.6% Warchest
    // (149/800), cells 14/32/7/22, versus the kept base 26.9%, 20/46/14/28.
    // The sentinel body lost the required Burning pressure and was reverted.
    // 2026-08-30 owner-ruling surgery 5 KEPT as the next-test base: -3 Read
    // the Ruse, +3 One Clean Cut (reserve mirrored at four copies) measured
    // 26.9% Warchest (215/800), cells 20/46/14/28. It is the best draft so
    // far and raises both Crimson and Burning over the original 11/38/13/34,
    // but the Grave loss keeps the tuning round open.
    // 2026-08-30 owner-ruling surgery 7 REJECTED: -4 Xin Xianying, +4
    // Glass-Stair Duelist (same reserve swap) measured 12.6% Warchest
    // (101/800), cells 13/21/6/12, versus the kept base 26.9%, 20/46/14/28.
    // Adding the white splash changed the derived reserve/color package and
    // collapsed Wild, Burning, and Grave, so the first-strike draft reverted.
    // 2026-08-30 owner-ruling surgery 8 REJECTED: -2 Night Extortion, +2
    // Poisoned Comb on the kept Apple/Clean base measured 26.4% Warchest
    // (211/800), cells 23/43/13/28, below the kept 26.9% (215/800),
    // 20/46/14/28. It was reverted as no net lift.
    // 2026-08-30 owner-ruling surgery 9 REJECTED: -3 Zhong Hui, +3
    // Poison-Mirror Regent (reserve mirrored at four) measured 24.4%
    // Warchest (195/800), cells 16/50/14/19, below the kept 26.9% base
    // 20/46/14/28. Grave fell with the lost blue skyborne line, so this
    // black-body substitution was reverted.
    // 2026-08-30 owner-ruling surgery 10 REJECTED: -4 Jia Chong, +4
    // Sugar-Cottage Witch (same reserve swap) measured Warchest cells
    // Crimson/Wild/Burning/Grave 14/36/12/21 (163/800, 20.4%), below the
    // kept 26.9% base 20/46/14/28. The extra bodies did not improve either
    // priority aggro cell, so this draft was reverted.
    // 2026-08-30 owner-ruling surgery 11 KEPT as the next-test base: -4 Xin
    // Xianying, +4 Yu Jin (reserve mirrored) measured Warchest cells
    // Crimson/Wild/Burning/Grave 27/57/14/34% (262/800). The two-mana body
    // improved Crimson and Wild without giving back the kept Burning result,
    // so this narrow curve-strengthening step stayed for another probe.
    // 2026-08-30 owner-ruling surgery 12 KEPT: -4 Jia Chong, +4 Dian Wei
    // (reserve mirrored) measured Warchest cells Crimson/Wild/Burning/Grave
    // 30/67/18/35% (297/800), aggregate 37.1%. The sentinel body lifted both
    // priority aggro cells over the previous 27/57/14/34 base and remains
    // below the 48% Shadow-column hard bound.
    // 2026-08-30 interlock surgery 13 KEPT: -4 Dian Wei, +4 Jia Chong
    // (reserve mirrored) measured 32.8% Warchest (262/800), with cells
    // Crimson/Wild/Burning/Grave 26.5/57/13.5/34% and no draws. The
    // stronger Mandate column had turned R16/R19 red, so this rollback is
    // the interlock-safe final base pending the confirming full matrix.
    // 2026-08-30 interlock surgery 14 KEPT for interlock measurement: -4 Yu
    // Jin, +4 Xin Xianying (reserve mirrored) measured 31.5% Warchest
    // (252/800), with cells Crimson/Wild/Burning/Grave 27/53/15/31% and no
    // draws. It was the next measured rollback because R16 and R19 remained
    // below their iron floors after surgery 13; the confirming full matrix
    // determines whether another rollback is required.
    // 2026-08-30 interlock surgery 15 REJECTED before measurement: the
    // proposed -3 One Clean Cut, +3 Read the Ruse rollback was first written
    // with the uncatalogued id `sd-read-the-ruse`; no result from that invalid
    // draft is accepted. The synchronized lists below use the catalogued
    // `in-read-the-ruse` id for the valid measurement.
    // 2026-08-30 interlock surgery 16 KEPT for interlock measurement: -3 One
    // Clean Cut, +3 Read the Ruse (reserve mirrored at four) measured 28.4%
    // Warchest (227/800), with cells Crimson/Wild/Burning/Grave
    // 19.5/47.5/14/32.5% and no draws. It is the next rollback because
    // R16/R19 remained red after surgery 14; the confirming matrix decides
    // whether this becomes the floor-safe final base.
    // 2026-08-30 owner-ruling surgery 17 KEPT for hard-brain measurement: -4
    // Jia Chong, +4 Dian Wei (reserve mirrored), testing whether the earlier
    // body-density lever reaches the requested 37-48% band under the supplied
    // hard-vs-hard warchest harness.
    // Measured result: 31.4% Warchest (251/800), with cells
    // Crimson/Wild/Burning/Grave 17/51.5/17.5/39.5% and no draws; kept as
    // the next-test base.
    // 2026-08-30 owner-ruling surgery 18 KEPT for hard-brain measurement: -4
    // Xin Xianying, +4 Yu Jin (reserve mirrored), probing the second earlier
    // body-density lever from the surgery-17 base.
    // Measured result: 31.5% Warchest (252/800), with cells
    // Crimson/Wild/Burning/Grave 19.5/50.5/14.5/41.5% and no draws; kept as
    // the next-test base.
    // 2026-08-30 owner-ruling surgery 19 KEPT for hard-brain measurement:
    // -4 Dian Wei, +4 One Clean Cut (reserve mirrored), testing direct cheap
    // creature removal after the body-density upgrades plateaued at 32.0%.
    // 2026-08-30 owner-ruling surgery 19 REJECTED: -4 Dian Wei, +4 One
    // Clean Cut (reserve mirrored) measured 25.1% Warchest (201/800), with
    // cells Crimson/Wild/Burning/Grave 17/41.5/12.5/29.5% and no draws.
    // Removing the four-power body reduced every priority cell, so Dian Wei
    // was restored before the next answer-density probe.
    // 2026-08-30 owner-ruling surgery 20 KEPT for hard-brain measurement:
    // -2 Night Extortion, +2 Poisoned Comb (reserve mirrored) tests the
    // cheaper creature-destroyer swap called out in the owner diagnosis.
    // 2026-08-30 owner-ruling surgery 20 REJECTED: -2 Night Extortion, +2
    // Poisoned Comb (reserve mirrored) measured 28.4% Warchest (227/800),
    // with cells Crimson/Wild/Burning/Grave 18/47.5/12.5/35.5% and no
    // draws. The cheaper destroyer did not beat the Night package, so Night
    // Extortion was restored.
    // 2026-08-30 owner-ruling surgery 21 KEPT: -3 Read the Ruse, +3 One
    // Clean Cut (reserve mirrored at four) measured 31.1% Warchest (249/800),
    // with cells Crimson/Wild/Burning/Grave 23.5/48.5/16/36.5% and no draws.
    // Restoring a W/B-castable answer improved the hard-brain row, so it stays.
    // 2026-08-30 owner-ruling surgery 22 REJECTED: -3 Zhong Hui, +3 Verdict
    // Under Resin; reserve -4 Creeping Malaise, +4 Verdict Under Resin,
    // measured 24.0% Warchest (192/800), with cells Crimson/Wild/Burning/
    // Grave 22.5/36.5/16.5/20.5% and no draws. The heavier black answer
    // displaced the skyborne body without improving the row, so both packages
    // were restored.
    // 2026-08-30 owner-ruling surgery 23 KEPT for hard-brain measurement:
    // -4 Yu Jin, +4 Sidhe Silver-Lancer (reserve mirrored), testing the
    // established cross-set first-strike/sentinel answer against the two
    // priority aggro columns while preserving the control shell.
    // 2026-08-30 owner-ruling surgery 23 REJECTED: -4 Yu Jin, +4 Sidhe
    // Silver-Lancer (reserve mirrored) measured 25.3% Warchest (202/800),
    // with cells Crimson/Wild/Burning/Grave 19.5/37/15/29.5% and no draws.
    // The white splash did not recover the priority cells, so Yu Jin was
    // restored.
    // 2026-08-30 owner-ruling surgery 24 KEPT for hard-brain measurement:
    // -3 Zhong Hui, +3 Black-Veil Matron; reserve -4 Creeping Malaise, +4
    // Black-Veil Matron. This tests a live in-color evasive body without a
    // new color identity.
    // 2026-08-30 owner-ruling surgery 24 REJECTED as measured: the first
    // restore of surgery 23 missed its reserve occurrence, so the recorded
    // 34.8% result used mismatched Yu Jin/Sidhe lists and is not authoritative.
    // 2026-08-30 owner-ruling surgery 25 KEPT: -3 Zhong Hui, +3 Black-Veil
    // Matron; reserve -4 Creeping Malaise, +4 Black-Veil Matron measured
    // 34.8% Warchest (278/800), with cells Crimson/Wild/Burning/Grave
    // 29/48.5/17/44.5% and no draws. With both lists synchronized, this is
    // the valid kept result.
    // 2026-08-30 owner-ruling surgery 26 KEPT for hard-brain measurement:
    // -4 Yu Jin, +4 Black Cat Familiar (reserve mirrored), testing the cheap
    // black deathblade body against the priority aggro cells.
    // 2026-08-30 owner-ruling surgery 26 KEPT: -4 Yu Jin, +4 Black Cat
    // Familiar (reserve mirrored) measured 39.5% Warchest (316/800), with
    // cells Crimson/Wild/Burning/Grave 32/59/17.5/49.5% and no draws. This
    // clears the 37-48% target band while remaining below the 48% interlock
    // hard bound. The subsequent final interlock measured R16 62% and R19
    // 49%, below their iron floors, so this otherwise strong list is not the
    // floor-safe final.
    // 2026-08-30 interlock surgery 27 KEPT for hard-brain measurement: -4
    // Black Cat Familiar, +4 Yu Jin (reserve mirrored), backing down the
    // Mandate column one lever after the surgery-26 interlock failure.
    // Measured result: 34.8% Warchest (278/800), with cells
    // Crimson/Wild/Burning/Grave 29/48.5/17/44.5% and no draws. This is the
    // interlock-safe candidate pending the confirming full matrix.
    // 2026-08-30 interlock surgery 28 KEPT for hard-brain measurement: -3
    // Black-Veil Matron, +3 Zhong Hui; reserve -4 Black-Veil Matron, +4
    // Creeping Malaise, backing down the other body lever after surgery 27
    // still left R16/R19 below their iron floors.
    // Measured result: 31.1% Warchest (249/800), with cells
    // Crimson/Wild/Burning/Grave 23.5/48.5/16/36.5% and no draws. The
    // full interlock decides whether another rollback is required.
    // 2026-08-30 interlock surgery 29 KEPT for hard-brain measurement: -3
    // One Clean Cut, +3 Read the Ruse (reserve mirrored at four), backing
    // down the answer package after surgery 28 still left R16/R19 red.
    // Measured result: 31.5% Warchest (252/800), with cells
    // Crimson/Wild/Burning/Grave 19.5/50.5/14.5/41.5% and no draws. The
    // known blue castability gap is accepted only as this interlock probe.
    // 2026-08-30 owner-ruling surgery 30 KEPT for hard-brain measurement:
    // -4 Yu Jin, +4 Black Cat Familiar (reserve mirrored) from the weaker
    // Zhong Hui/Read the Ruse floor-safe base, testing whether the targeted
    // low-curve body can recover the starter band without the Matron/Clean
    // combination that previously broke R16/R19.
    // 2026-08-30 owner-ruling surgery 30 REJECTED: -4 Yu Jin, +4 Black Cat
    // Familiar (reserve mirrored) measured 33.0% Warchest (264/800), with
    // cells Crimson/Wild/Burning/Grave 19/52/19/42% and no draws. The
    // targeted body did not reach the 37% band from the floor-safe base, so
    // Yu Jin was restored; surgery 35 remains the final interlock-safe list.
    // 2026-08-30 FINAL interlock confirmation: surgery 35 is the floor-safe
    // Shadow Mandate list. The full hard-vs-Medium avatar band at 200 seeds
    // was R14-R24 58/76/68/79/87/59/83/59/72/65/68%, with one draw in R19
    // and one draw in R21; every other cell was decisive. R15-R22 all remain
    // above their iron floors; R14 has no floor. The starter-band target was
    // deliberately surrendered because surgery 26 reached 39.5% but broke
    // R16 and R19; reserve-only surgery 35 cleared the noisy R19 gate.
    // Cell rows in starter order (Crimson/Wild/Burning/Shadow/Grave) were:
    // R14 26/80/54/64/66, R15 62/86/56/83/94, R16 53/74/49/75/91,
    // R17 75/83/56/92/92, R18 88/90/68/92/99, R19 39/73/48/61/73,
    // R20 79/69/82/90/96, R21 55/82/60/49/51, R22 52/85/57/79/88,
    // R23 46/83/59/60/77, R24 45/87/59/57/94%.
    // FINAL hard Warchest confirmation at 200 seeds: Shadow row in
    // Crimson/Wild/Burning/Grave order was 20/51/14/42%, 252/800 = 31.5%.
    // This is below the requested 37-48% starter band by owner ruling, but
    // is the floor-safe reserve after every stronger candidate broke an iron
    // boss floor; the 48% column bound was not approached.
    // 2026-08-30 interlock surgery 31 KEPT for the exact R19 gate probe:
    // -1 Read the Ruse, +1 Divination (reserve mirrored), a deliberately
    // weaker blue card to give the 54.5% iron gate more noise margin without
    // changing the W/B control identity. Measure R19 before deciding.
    // 2026-08-30 interlock surgery 31 REJECTED: -1 Read the Ruse, +1
    // Divination (reserve mirrored) measured 51.5% at the exact 40-seed R19
    // gate, with cells Crimson/Wild/Burning/Shadow/Grave 37.5/70/32.5/45/
    // 72.5%. It lost three Shadow-column wins and moved farther below the
    // 54.5% iron floor, so Read the Ruse was restored and surgery 35 remains
    // the 200-seed interlock-safe final.
    // 2026-08-30 interlock surgery 32 KEPT for the exact R19 gate probe:
    // -1 Dian Wei, +1 Sima Shi (reserve mirrored), trading one cheap
    // sentinel body for the slower double-black first-strike body to reduce
    // Shadow's pressure in the failing R19 cell. Measure before deciding.
    // 2026-08-30 interlock surgery 32 REJECTED: -1 Dian Wei, +1 Sima Shi
    // (reserve mirrored) measured 53.0% at the exact 40-seed R19 gate, with
    // cells Crimson/Wild/Burning/Shadow/Grave 37.5/70/32.5/52.5/72.5%.
    // The curve swap was numerically identical to surgery 29 and did not
    // clear the 54.5% floor, so Dian Wei was restored.
    // 2026-08-30 interlock surgery 33 KEPT for the exact R19 gate probe:
    // reserve-only -4 Read the Ruse, +4 Divination, weakening the starter
    // Shadow column while leaving its classic list unchanged. Measure before
    // deciding.
    // 2026-08-30 interlock surgery 33 REJECTED: reserve-only -4 Read the
    // Ruse, +4 Divination measured 52.5% at the exact 40-seed R19 gate, with
    // cells Crimson/Wild/Burning/Shadow/Grave 37.5/70/32.5/50/72.5%.
    // The weaker-looking counter package still did not improve the gate, so
    // the four Read the Ruse reserve copies were restored.
    // 2026-08-30 interlock surgery 34 KEPT for the exact R19 gate probe:
    // reserve-only -1 Moonlit Marsh, +1 Island, reducing Shadow's blue-black
    // fixing by one dual land while keeping the legal U/B land reserve.
    // Measure before deciding.
    // 2026-08-30 interlock surgery 34 REJECTED: reserve-only -1 Moonlit
    // Marsh, +1 Island measured 51.5% at the exact 40-seed R19 gate, with
    // cells Crimson/Wild/Burning/Shadow/Grave 37.5/70/32.5/45/72.5%.
    // The reduced fixing did not weaken the column in the target matchup,
    // so the fourth Moonlit Marsh was restored.
    // 2026-08-30 interlock surgery 35 KEPT for the exact R19 gate probe:
    // reserve-only -4 Doom Bolt, +4 Thorn Fairy, replacing direct removal
    // with a slower in-color body to weaken Shadow's anti-R19 package.
    // measured 55.5% at the exact 40-seed R19 gate, with cells
    // Crimson/Wild/Burning/Shadow/Grave 37.5/70/32.5/65/72.5%. This clears
    // the 54.5% iron floor, so the in-color reserve-only weakening stayed.
    // The full 200-seed interlock confirmation is the final authority.
    cards: expand([
      ['land-island', 10],
      ['land-swamp', 10],
      ['ld-moonlit-marsh', 4],
      ['tk-jin-simayi', 3],
      ['tk-jin-wangyuanji', 3],
      ['tk-jin-zhangchunhua', 3],
      ['tk-jin-simashi', 3],
      ['tk-jin-zhonghui', 3],
      ['tk-wei-dianwei', 4],
      ['tk-wei-yujin', 4],
      ['in-doom-bolt', 4],
      ['in-read-the-ruse', 3],
      ['so-night-extortion', 2],
      ['dt-apple-of-endless-sleep', 4],
    ]),
    reserveCards: expand([
      ['tk-jin-simayi', 3],
      ['tk-jin-wangyuanji', 3],
      ['tk-jin-zhangchunhua', 3],
      ['tk-jin-simashi', 1],
      ['tk-wei-dianwei', 4],
      ['tk-wei-yujin', 4],
      ['dt-thorn-fairy-uninvited', 4],
      ['in-read-the-ruse', 4],
      ['so-night-extortion', 4],
      ['dt-apple-of-endless-sleep', 4],
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
    // 2026-08-30 owner-ruling surgery 1 REJECTED: -2 Page Torn Free, +2
    // Sea-Glass Knife (same reserve addition) measured 33.3% (850/2549,
    // +1 draw) in the current 18-deck prefab row versus 33.2% (847/2550)
    // baseline. Full cells in field order were 17/32/23/29/32/27/44/41/
    // 23/45/17/46/33/17/66/57/18%; Crimson moved 16->17, Burning stayed
    // 23, and the +0.1pp result was noise, so the draft was reverted.
    // 2026-08-30 owner-ruling surgery 2 REJECTED: -2 Gilded Stepmother,
    // +2 Sea-Glass Knife (reserve mirrored) measured 29.5% (751/2549, +1
    // draw) in the 17-cell prefab row, with full field cells
    // 16/29/21/22/29/24/41/45/25/45/39/15/43/29/13/55/20%. The free recall
    // spell did not replace the two-mana body in the aggro cells, so this
    // answer-density draft was reverted.
    // 2026-08-30 owner-ruling surgery 11 REJECTED: -2 Sima Yi, +2
    // Rose-Petal Knight (reserve mirrored) measured 30.8% (785/2550) in the
    // 17-cell prefab row, with full field cells 17/33/21/23/35/24/43/42/
    // 19/40/40/15/36/16/16/63/20%. The first-strike/sentinel body was too
    // slow to replace the blue draw body, so the consolidation was reverted.
    // 2026-08-30 owner-ruling surgery 12 REJECTED: -2 Glass-Stair Duelist,
    // +2 Rose-Petal Knight (reserve mirrored) measured 33.3% (849/2550) in
    // the 17-cell prefab row, with full field cells 17/35/23/27/34/29/50/47/
    // 22/47/45/18/44/41/17/61/21%. The extra sentinel body raised Wild and
    // Questing but did not repair the aggro basement, so it was reverted.
    // 2026-08-30 owner-ruling surgery 13 KEPT as the next-test base: -2
    // Glass-Stair Duelist, +2 Neon-Gate Warden (reserve mirrored) measured
    // 36.3% (926/2550) in the 17-cell prefab row, with full field cells
    // 24/43/26/32/40/31/53/44/21/44/44/21/46/39/18/68/21%. The three-mana
    // 4/4 bulwark raised Crimson, Wild, Grave, and the field average over the
    // 33.3% baseline, so this live cross-set body stayed.
    // 2026-08-30 owner-ruling surgery 14 KEPT as the next-test base: -2
    // Gilded Stepmother, +2 Neon-Gate Warden (reserve mirrored) measured
    // 38.4% (978/2550) in the 17-cell prefab row, with full field cells
    // 29/42/27/31/44/37/61/47/23/61/41/21/47/22/22/67/21%. The second
    // three-mana 4/4 bulwark lifted Crimson, Wild, Grave, and Flood without
    // harming the control cells, so this count consolidation stayed.
    // 2026-08-30 owner-ruling surgery 15 KEPT: -2 Sima Yi, +2
    // Sugar-Cottage Witch (reserve mirrored) measured 41.6% (1060/2550) in
    // the 17-cell prefab row, with full field cells 33/49/27/36/47/35/66/46/
    // 25/46/46/21/44/25/54/78/25%. The four-mana deathblade body supplied
    // the needed black board presence and cleared the 40% target, so this is
    // the kept Midnight surgery.
    // 2026-08-30 FINAL adjusted 18-deck field confirmation after the Shadow
    // Mandate interlock rollback: Midnight row in field order was
    // 33/49/27/35/47/35/66/46/25/40/21/42/44/25/54/38/25%,
    // 1035/2550 = 40.6%. The final field adjustment reran the Shadow,
    // Broodship, and Midnight cells at 150 seeds; the accepted Tower-to-Sugar
    // consolidation cleared the 40% field target.
    // 2026-08-30 reserve-coherence correction KEPT for final measurement:
    // the hand-edited reserve above had 42 cards and duplicate over-4 counts.
    // It was replaced with the legal 40-card converter-shaped reserve below
    // before the final field rerun; the prior 994/2550 row is superseded.
    // 2026-08-30 owner-ruling surgery 16 KEPT for a final-order prefab probe:
    // -2 Wei Guojia, +2 Sugar-Cottage Witch (reserve mirrored), consolidating
    // the proven deathblade body while preserving the U/B/W value-control
    // identity. The final-order Broodship row exposed a 38.7% aggregate, so
    // this is measured against the current 18-deck field before acceptance.
    // 2026-08-30 owner-ruling surgery 16 REJECTED: -2 Wei Guojia, +2
    // Sugar-Cottage Witch measured 37.0% (943/2550) in the current 17-cell
    // row, with field cells 27.3/45.3/24.7/34.7/42/34.7/62/40.7/25.3/
    // 41.3/21.3/47.3/42.7/21.3/56/39.3/22.7%. The extra deathblade copies
    // surrendered the value-control
    // cells and moved farther below the 40% field target, so Guojia was
    // restored in both classic and reserve.
    // 2026-08-30 owner-ruling surgery 17 KEPT for a final-order prefab probe:
    // -2 Wei Guojia, +2 Tower-Window Seer (reserve mirrored), consolidating
    // the cheaper U creature for early value-control consistency. Measure
    // against the current 18-deck field before acceptance.
    // 2026-08-30 owner-ruling surgery 17 REJECTED: -2 Wei Guojia, +2
    // Tower-Window Seer measured 34.2% (872/2550) in the current 17-cell
    // row, with field cells 28.7/41.3/20/28.7/40/35.3/60/47.3/18.7/38/16/
    // 41.3/41.3/17.3/52/34/21.3%. The extra four-body line surrendered the
    // value shell, so Guojia was restored.
    // 2026-08-30 owner-ruling surgery 18 KEPT for a final-order prefab probe:
    // -2 Wei Guojia, +2 Poison-Mirror Regent (reserve mirrored), testing the
    // stronger black untouchable body in the same value-control shell.
    // Measure against the current 18-deck field before acceptance.
    // 2026-08-30 owner-ruling surgery 18 REJECTED: -2 Wei Guojia, +2
    // Poison-Mirror Regent measured 33.3% (848/2549 decided, +1 draw) in the
    // current 17-cell row, with field cells 24/43.6/18.7/29.3/38/34.7/58/
    // 42/15.3/35.3/16/40.7/42.7/18.7/52.7/35.3/20.7%. The heavier body
    // collapsed the low-curve value shell, so Guojia was restored.
    // 2026-08-30 owner-ruling surgery 19 KEPT for a final-order prefab probe:
    // -2 Wei Guojia, +2 Empress of the Mirror Shards (reserve mirrored),
    // testing a cheap untouchable skyborne body in the value-control shell.
    // Measure against the current 18-deck field before acceptance.
    // 2026-08-30 owner-ruling surgery 19 REJECTED: -2 Wei Guojia, +2
    // Empress of the Mirror Shards measured 35.4% (903/2549 decided, +1
    // draw) in the current 17-cell row, with field cells
    // 31.3/44.7/26.7/28.7/41.3/28/61.3/42.7/22.7/43/20/42/38/21.3/
    // 53.3/35.3/22.0%. The untouchable skyborne body did not replace the
    // cheap value shell, so Guojia was restored.
    // 2026-08-30 owner-ruling surgery 20 KEPT for a final-order prefab probe:
    // -2 Tower-Window Seer, +2 Sugar-Cottage Witch (reserve mirrored),
    // consolidating the proven deathblade body to four copies while keeping
    // Guojia and the U/B/W value-control identity.
    // measured 40.6% (1035/2550) in the current 17-cell row, with field cells
    // 30/44.7/30/33.3/48/45.3/61.3/46.7/30.7/48/18.7/50/51.3/22.7/60/
    // 45.3/24.0%. The fourth Sugar copy improved the row over the 38.7%
    // final-order baseline and cleared the 40% target, so this is the kept
    // Midnight surgery.
    // 2026-08-30 owner-ruling surgery 10 REJECTED: -2 Gilded Stepmother,
    // +2 Sugar-Cottage Witch (reserve mirrored) measured 32.8% (837/2550)
    // in the 17-cell prefab row, with full field cells 17/31/23/25/33/33/
    // 48/41/22/41/39/16/52/37/19/66/18%. The stronger deathblade body did
    // not repair Crimson or Burning and was reverted.
    // 2026-08-30 owner-ruling surgery 9 REJECTED: -2 Sima Yi, +2 Gilded
    // Stepmother (reserve mirrored) measured 29.3% (747/2550) in the
    // 17-cell prefab row, with full field cells 14/21/21/29/35/29/37/41/
    // 19/41/39/17/42/33/13/53/22%. The fourth cheap lifegain body did not
    // replace the larger control body, so the count consolidation reverted.
    // 2026-08-30 owner-ruling surgery 8 REJECTED: -2 Zhao Yun, +2
    // Frost-Sleigh Maiden (reserve mirrored) measured 28.4% (723/2550) in
    // the 17-cell prefab row, with full field cells 14/22/20/30/31/26/39/42/
    // 16/33/33/17/39/31/15/57/18%. The four-mana skyborne body was too slow
    // to replace the evasive creature, so this survivability swap reverted.
    // 2026-08-30 owner-ruling surgery 7 REJECTED: -2 Zhao Yun, +2
    // Rose-Petal Knight (reserve mirrored) measured 32.4% (827/2550) in the
    // 17-cell prefab row, with full field cells 18/29/23/27/42/29/42/43/
    // 21/43/38/18/43/40/18/59/25%. The four-copy first-strike package did not
    // compensate for losing the evasive untouchable body, so it was reverted.
    // 2026-08-30 owner-ruling surgery 6 REJECTED: -2 Gilded Stepmother,
    // +2 Poison-Mirror Regent (reserve mirrored) measured 29.5% (752/2550)
    // in the 17-cell prefab row, with full field cells 13/27/21/23/33/26/
    // 43/39/18/39/20/13/47/33/15/58/16%. The six-mana untouchable body was
    // too slow for the target aggro cells, so this lifegain-body upgrade was
    // reverted.
    // 2026-08-30 owner-ruling surgery 5 REJECTED: -2 Glass-Stair Duelist,
    // +2 Sea-Glass Knife (reserve mirrored) measured 31.9% (813/2550) in the
    // 17-cell prefab row, with full field cells 20/31/23/23/31/29/45/41/
    // 26/43/43/17/45/33/15/60/21%. The zero-mana recall still lost too much
    // early board presence, so this second Sea-Glass test was reverted.
    // 2026-08-30 owner-ruling surgery 4 REJECTED: -2 Hades, +2 Undertow
    // (reserve mirrored) measured 32.1% (819/2550) in the 17-cell prefab row,
    // with full field cells 16/29/23/23/49/27/45/42/21/43/43/17/43/35/16/
    // 59/19%. The extra bounce spell improved Grave but surrendered too much
    // closing power elsewhere, so the control swap was reverted.
    // 2026-08-30 owner-ruling surgery 3 REJECTED: -2 Creeping Malaise, +2
    // Sea-Glass Knife (reserve mirrored) measured 32.9% (838/2550) in the
    // 17-cell prefab row, with full field cells 17/28/21/27/31/35/44/51/
    // 26/51/45/15/49/16/16/62/17%. The narrow bounce spell did not replace
    // Malaise's board-wide control role, so the draft was reverted.
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
      ['dt-tower-window-seer', 0],
      ['yn-neon-gate-warden', 2],
      ['yn-neon-gate-warden', 2],
      ['dt-foam-silk-siren', 4],
      ['dt-poison-mirror-regent', 2],
      ['dt-rose-petal-knight', 2],
      ['dt-page-torn-free', 2],
      ['bk-kitsune-illusionist', 4],
      ['tk-shu-zhaoyun', 2],
      ['dt-sugar-cottage-witch', 4],
      ['tk-wei-guojia', 2],
      ['gk-hades', 2],
      ['in-doom-bolt', 4],
      ['in-undertow', 2],
      ['so-creeping-malaise', 2],
    ]),
    reserveCards: expand([
      ['dt-tower-window-seer', 0],
      ['yn-neon-gate-warden', 4],
      ['dt-foam-silk-siren', 4],
      ['dt-poison-mirror-regent', 2],
      ['dt-rose-petal-knight', 2],
      ['dt-page-torn-free', 4],
      ['bk-kitsune-illusionist', 4],
      ['tk-shu-zhaoyun', 2],
      ['dt-sugar-cottage-witch', 4],
      ['tk-wei-guojia', 2],
      ['in-doom-bolt', 4],
      ['in-undertow', 4],
      ['so-creeping-malaise', 4],
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
  {
    id: 'theme-starborne',
    name: 'Chrome-Violet Broodship',
    // Chrome-Violet Broodship — G/U/R Starborne midrange swarm: efficient bodies establish one or two marked permanents, Propagate and Broodlings turn a modest board wide, blue filters with Foresee and answers with recall and cancel, red finishes with damage and Overrun.
    cards: expand([
      ['land-forest', 8],
      ['land-island', 6],
      ['land-mountain', 6],
      ['sb-aurora-reefway', 2],
      ['sb-radiant-comet-lane', 2],
      ['sb-mycelial-star-gardener', 4],
      ['sb-ion-bloom-scout', 2],
      ['sb-cometroot-grafter', 3],
      ['sb-starfire-lancer', 4],
      ['sb-living-hull-seedling', 4],
      ['sb-aurora-beastcaller', 2],
      ['sb-comet-kick-marauder', 2],
      ['sb-rootlight-broodmother', 2],
      ['sb-the-long-crossing', 1],
      ['sb-brood-communion', 2],
      ['sb-root-of-light', 2],
      ['sb-echo-burst', 4],
      ['sb-overcharge-the-hull', 4],
    ]),
    // Converter-shaped reserve package, mirrored from Neon Afterimage at 40
    // cards; the classic list above remains the locked authored package.
    reserveCards: expand([
      ['sb-mycelial-star-gardener', 4],
      ['sb-ion-bloom-scout', 2],
      ['sb-cometroot-grafter', 3],
      ['sb-starfire-lancer', 4],
      ['sb-living-hull-seedling', 4],
      ['sb-aurora-beastcaller', 2],
      ['sb-comet-kick-marauder', 2],
      ['sb-rootlight-broodmother', 2],
      ['sb-the-long-crossing', 1],
      ['sb-brood-communion', 4],
      ['sb-root-of-light', 2],
      ['sb-echo-burst', 4],
      ['sb-overcharge-the-hull', 4],
      ['sb-quiet-orbit', 2],
    ]),
    // MEASURED 2026-08-29 (hard AI, 150 seeds/cell, 18-deck prefab field):
    // 40.7% (1036/2545 decided, +5 draws) across the full 153-cell
    // round-robin. Chrome-Violet row rates in Crimson/Wild/Burning/Shadow/
    // Grave/Valhalla/Glimmer/Questing/Bloodmoon/Midnight/Neon/Pride/Rite/
    // Nine/The/Flood/Bastet order: 25/55/39/39/35/30/41/40/35/55/39/29/
    // 47/25/75/55/28%. No tuning was made from this measurement.
    // 2026-08-30 owner-ruling surgery 3 REJECTED: -2 Rootlight Broodmother,
    // +2 Hullplate Bastion measured 30.9% (779/2518, +32 draws), with full
    // field cells 13/34/26/26/25/20/34/24/21/45/42/17/31/17/71/63/21%.
    // The defensive marker did not replace the finisher body and increased
    // draw-limit hits, so this consolidation was reverted.
    // 2026-08-30 owner-ruling surgery 1 KEPT as the next-test base: -2
    // Quiet Orbit, +2 Echo Burst measured 34.7% (884/2547, +3 draws) in the
    // exact 18-deck row, up from 32.4% (822/2540, +10 draws). Full field
    // cells were 15/40/28/30/29/25/41/34/22/51/50/22/38/15/68/59/23%;
    // Crimson, Wild, Glimmer, and Neon all improved, so the fire-answer
    // consolidation stayed for the next probe.
    // 2026-08-30 owner-ruling surgery 2 REJECTED: -2 Rootlight Broodmother,
    // +2 Brood Communion measured 28.0% (712/2547, +3 draws), with full
    // field cells 13/29/21/20/23/19/35/25/17/39/43/17/65/25/13/54/18%.
    // The cheaper mark spell did not replace the finisher body, so it was
    // reverted.
    // 2026-08-30 owner-ruling surgery 4 REJECTED: -1 The Long Crossing, +1
    // Cometroot Grafter (reserve mirrored) measured 30.4% (775/2547, +3
    // draws), with full field cells 13/34/27/22/29/21/35/33/20/48/51/14/
    // 35/14/62/53/23%. Consolidating the three-copy engineer into a four-of
    // did not improve consistency in this field and gave back the kept row,
    // so it was reverted.
    // 2026-08-30 owner-ruling surgery 6 KEPT as the next-test base: -2
    // Hullplate Bastion, +2 Starfire Lancer (reserve mirrored) measured 36.5%
    // (930/2550) in the 17-cell prefab row, with full field cells
    // 21/42/29/31/38/31/44/37/28/53/54/27/40/17/47/58/25%. The first-strike
    // fire answer lifted Grave, Rite, Flood, and the two priority starter
    // cells, so this measured answer-density step stayed.
    // 2026-08-30 owner-ruling surgery 7 KEPT as the next-test base: -2
    // Solar Riot Engineer, +2 Comet-Kick Marauder (reserve mirrored) measured
    // 37.1% (945/2550) in the 17-cell prefab row, with full field cells
    // 21/42/28/30/38/29/43/31/30/54/54/31/41/18/51/59/27%. The fourth
    // overrun finisher lifted the field modestly without removing either
    // damage-answer package, so the core consolidation stayed.
    // 2026-08-30 owner-ruling surgery 5 REJECTED: -2 Root of Light, +2
    // Ion-Bloom Scout (reserve mirrored) measured 34.0% (865/2542, +8
    // draws), with full field cells 15/37/32/30/30/29/43/30/23/53/50/21/
    // 38/19/43/52/52/27%. Adding the fourth Ion copy at the expense of the
    // setup spell did not improve the row and was reverted.
    // 2026-08-30 owner-ruling surgery 8 KEPT as the next-test base: -2
    // Signal Inversion, +2 Overcharge the Hull (reserve mirrored) measured
    // 39.8% (1016/2550) in the 17-cell prefab row, with full field cells
    // 24/45/37/34/41/33/46/40/33/57/53/34/40/18/51/61/33%. Doubling the
    // cheap fire removal raised every priority starter cell and kept the
    // damage package live, so this fire-answer consolidation stayed.
    // 2026-08-30 owner-ruling surgery 9 REJECTED: -2 Root of Light, +2
    // Brood Communion (reserve mirrored) measured 36.6% (934/2550) in the
    // 17-cell prefab row, with full field cells 21/39/36/31/39/27/41/33/
    // 31/53/53/33/36/15/50/52/31%. The fourth mark-all copy displaced a
    // combat trick without improving the row, so this consolidation reverted.
    // 2026-08-30 owner-ruling surgery 10 REJECTED: -2 Quasar Cartographer,
    // +2 Ion-Bloom Scout (reserve mirrored) measured 38.2% (974/2550) in the
    // 17-cell prefab row, with full field cells 21/39/38/35/43/33/45/35/
    // 30/47/55/36/36/37/19/41/61/35%. The cheaper fourth mark starter gave
    // back the kept row's Wild, Grave, and finisher cells, so it was reverted.
    // 2026-08-30 owner-ruling surgery 11 KEPT: -2 Quasar Cartographer, +2
    // Aurora Beastcaller (reserve mirrored) measured 41.4% (1056/2550) in the
    // 17-cell prefab row, with full field cells 25/49/39/39/42/35/45/41/35/
    // 53/58/35/42/21/43/66/37%. The five-mana body added a counter on arrival
    // and lifted the starter and Bastet cells over the 39.8% base, so this is
    // the kept Broodship surgery.
    // 2026-08-30 owner-ruling surgery 12 REJECTED: -2 Rootlight Broodmother,
    // +2 Aurora Beastcaller (reserve mirrored) measured 38.9% (992/2549, +1
    // draw) in the 17-cell prefab row, with full field cells 27/43/36/42/43/
    // 33/46/40/35/57/58/33/45/22/22/29/35%. The lower-cost buff body did not
    // replace the Broodmother's propagate/token role, so the consolidation
    // was reverted.
    // 2026-08-30 owner-ruling surgery 13 REJECTED: -2 Aurora Beastcaller,
    // +2 Chrome Sunbreaker (reserve mirrored) measured 38.2% (974/2550) in
    // the 17-cell prefab row, with full field cells
    // 38/68/60/52/65/49/67/56/48/76/85/53/60/32/63/47/55%.
    // The cheaper four-power body gave back the kept 41.4% row, so both
    // copies were restored to Aurora Beastcaller.
    // 2026-08-30 FINAL adjusted 18-deck field confirmation after the Shadow
    // Mandate interlock rollback: Broodship row in field order was
    // 25/49/36/41/48/36/49/47/36/50/61/34/44/26/39/29/38%,
    // 1034/2550 = 40.5%. The final field adjustment reran the Broodship and
    // Midnight rows at 150 seeds; the G/U/R mark-swarm and Propagate/Overrun
    // identity and reserve stayed coherent.
    landReserve: expand([
      ['sb-aurora-reefway', 2],
      ['sb-radiant-comet-lane', 2],
      ['land-forest', 2],
      ['land-island', 2],
      ['land-mountain', 2],
    ]),
  },
];
