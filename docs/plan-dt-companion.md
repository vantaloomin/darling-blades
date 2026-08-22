<!-- source-of-truth: docs/expansions/dark-tales.md, src/data/cards/dark-tales.ts, src/data/cards/dark-tales-companion.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/engine/types.ts, scripts/blades-db.ts · last-verified: 2026-08-21 · design/plan doc -->

**Status: DATA LANDED 2026-08-21 behind FEATURES.dtCompanionLive.**

# Dark Tales companion wave (60 cards): design plan

The one retrofit pilot the set-size policy allows (plan-1.6-draft.md, "Set-size
policy"; ratified to ride the Duat train in plan-1.6-large-set.md gate item 7).
It exists to pay two documented balance debts: Midnight Storybook's thin pool
(the 1.5 pass closed it as "the honest miss": the set "lacks rate-efficient
threats" and "survivable early bodies that this set does not print") and the
R19 inversion (Queen of the Lanterned Roof, 56% on the Warchest ladder under
R18's 86%, "needs in-color tools from a future set"). Every row below is
written in the shipped engine vocabulary only; costs and stats are committed,
and every non-vanilla row cites the precedent it was priced against.

Evidence base (all run 2026-08-21 against `balance/cards.sqlite` built
2026-08-21T13:27Z from `CARD_DB`, 1,044 cards / 1,019 collectible, and
`mtg-cache/cards.sqlite`):

| Label | Query | What it returned |
| --- | --- | --- |
| W1 | `npx tsx scripts/blades-db.ts curve` | our common creature curve, mv1-6: 0.92/1.46 (n=13), 1.69/1.78 (n=101), 2.12/2.50 (n=113), 2.93/3.44 (n=41), 3.92/4.23 (n=13), 5.40/5.40 (n=5); p+t medians 2/4/5/6/8/10 |
| W2 | `blades-db query`: every collectible mono W/U/B creature at mv 1-3 with cost, P/T, keywords, ops, Skim flag | 199 rows: the efficient frontier the wave must not dominate |
| W3 | same for R/G at mv 1-4, W/U/B at mv 4, colorless creatures | 234 + 8 rows |
| W4 | every collectible Charm and Ritual with its op list | 222 rows |
| W5 | every collectible non-creature Artifact and Enchantment at mv 1-4 | 116 rows |
| W6 | `blades-db dupes --set dark-tales`, `dupes --tier NEAR --near 2 --set dark-tales`, `blades-db dominated --limit 800` | quoted in §4 |
| W7 | mechanic counts: `has_retell` by set and rarity, `has_skim` creature vs non-creature by set, `has_empower` by set | Retell: DARK 12 (5c/4r/2sr/1ssr), DUAT 7, CORE 1, NOCT 1; Skim: DARK 14 creature / 23 non-creature, DUAT 2/2, CORE 0/1, VEIL 0/1; Empower: NOCT 20, DUAT 8, CORE/GRAL/VEIL 1 each |
| M-A..M-P | `npx tsx scripts/mtg-db.ts query` with `funny=0` and `released_at < '2015-01-01'` (or `< '2010-01-01'`) per the era discipline (mtg-db-playbook.md §5) | cited per row in §4 |
| Duat bands | plan-duat-cards-mechanical.md §2: Nine Lives (undying, n=22), Preserve (embalm n=15, eternalize n=13), Retell house band (n=12), Empower ({1}+pip on 2-mv commons, {2}+pip elsewhere, 19 of 21), Skyborne premium (playbook §6) | reused unchanged; the companion does not re-derive them |

---

## 1. Frame

**Rarity.** Half of the shipped 60/36/11/8/5 is 30/18/5.5/4/2.5. Kept as
**30 C / 18 R / 6 SR / 4 SSR / 2 UR = 60**, rounding SR up and UR down. Two UR,
not three: the combined set's UR share falls from 4.2% to 3.9% (7 of 180),
which keeps the 525g Dark Tales booster's chase density almost where it
shipped, and the pack-pool dupe-protection floor (`ur` pool of at least 4) is
already satisfied by the shipped five. The alternative (3 UR) is owner decision
4 in §7.

**Color spread.** The shipped set is U 25 / B 19 / W 14 / G 13 / R 10, 16
multicolor, 9 colorless, 14 lands. The wave rebalances toward W on purpose,
because goals (b) and (e) both want W/U and W/G tools and the shipped W is the
thinnest of the three primaries:

| | W | U | B | R | G | Multi | Colorless | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| UR | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 2 |
| SSR | 0 | 0 | 1 | 0 | 0 | 3 | 0 | 4 |
| SR | 1 | 1 | 1 | 0 | 0 | 3 | 0 | 6 |
| R | 5 | 4 | 4 | 2 | 2 | 0 | 1 | 18 |
| C | 7 | 8 | 7 | 3 | 3 | 0 | 2 | 30 |
| **Total** | **13** | **13** | **13** | **5** | **5** | **8** | **3** | **60** |

Multicolor rows are all legendary (the catalog invariant). The eight legends
are U/W, U/B, U/R, G/W, W/B, U/G, W/R, U/W: every heroine package in goal (e)
gets exactly one legend, Midnight Storybook gets two (U/B and W/B), and R19 gets
two U/W bodies.

**Type mix.** 40 of 60 are creatures (67%), deliberately far above the shipped
45/120 (37.5%); combined, Dark Tales lands at 85/180 = 47%, roughly where the
other sets sit. The 20 non-creatures are 15 Retell Rituals/Charms (goal c), one
Aura, one Enchantment, one Artifact, one Empower Charm, one Empower Ritual.

**Lands: zero.** The set already ships 14, and no package below needs a pair the
shipped cycle lacks (Tide Cavern U/B and Oceanic Islet U/G carry Midnight and
the wayfinder package; R19 already runs `ld-misty-palace-terrace`).

**Mechanic density after the wave** (shipped, then combined): Retell 12 to 27
(15 new, 8 at common); Skim 37 to 62, and Skim on creatures 14 to 37 (23 of the
40 new bodies carry it); Nine Lives 9 new; Preserve 7 new; Empower 3 new. Four
set-unique tokens reused (Hearth Spirit x4 makers, Masked Guest x4, Firefly x1,
Shadow Miner x1); no new token.

---

## 2. Goals, ranked, with the measurement that shows each worked

**a. Midnight Storybook fields a dt-native 40.** Today 18 of its 40 reserve
spells are Dark Tales; the other 22 are bk/tk/gk/in/so splash bodies and
removal, and the 2026-08-09 baseline has it at 56.9% head-to-head (200
seeds/cell). Target: the §5 candidate (40 dt- spells, 10-land Warchest) measures
**inside 45-60%** on `--player-decks` at 200 seeds, with its old aggro holes
(Crimson 19 / Harvest 24 / Tides 25 in the W2 like-for-like) each above 35%.
Rows that serve it: every U/B/W body at mv 1-3 (17 of them), the two legends,
Poisoned Comb, Laced Too Tight, Drown the Pages, Drowned Library.

**b. In-color W/U tools for R19.** Queen of the Lanterned Roof is a W/U Kitsune
Hauntlink tempo-control shell; her low Warchest-ladder cells are the aggro and
midrange columns (Tides 47, Mandate 61, Muster 66 in the 2026-07-31 table; 56%
average on the 2026-08-09 ladder). What she lacks in color is cheap blockers
that trade twice, a sweep-proof evasive body, and removal that is not a bounce.
Rows she can adopt without touching her Hauntlink package (none carry Skim or
Retell restrictions she would trip, because Hauntlink lives on her Artifacts,
not these creatures): Swan-Lake Sovereign, Duchess of the Lost Winter, Empress
of the Mirror Shards, Glass-Mountain Knight, Frost-Sleigh Maiden, Gerda of the
Long Road, Frozen-Heart Sister, Handmaid Who Woke Twice, Pea-Mattress Sentry,
Banished from the Ball, Frozen to the Floor. Measurement: `--avatars-reserve
--only queen-of-the-lanterned-roof` moves from 56 to **at least 64** at 200
seeds with Tides and Mandate no longer the floor cells. Closing the full 22pp to
R18 is not claimed; an 8pp climb in color is.

**c. The Retell/Skim retrofit.** "Skim stocks the graveyard and Retell cashes
it" was under-printed on both halves: 12 Retell carriers and only 14 Skim
bodies. The wave adds 15 Retell spells (8 common, 5 rare, 2 SR) and 23 Skim
bodies, plus Preserve on 7 bodies, which is the graveyard cashing a *creature*
for the first time in this set (Skim the body away early, Preserve it later).
Measurement: `blades-db query` counts after the rebuild (27 Retell, 37 Skim
creatures), and Retell casts per game in the Midnight candidate logged the way
the Duat pass logged Rite casts (telemetry run on the §5 commands).

**d. Returning-mechanics quota.** Three returning mechanics at c/r (§2d below):
**Nine Lives** (7 of 9 carriers at c/r), **Preserve** (all 7 at c/r),
**Empower** (2 c, 1 r). Measurement: `dupes` and `dominated` clean against the
shipped efficient versions after the data lands (§4 lists the repricings that
already happened at design time).

**e. The four heroine packages.** W/R heroine tempo gets 6 rows (Bell-Tower
Dancer, Woodcutter's Daughter, Carpet Escape, Hearth-Ember Dancer, Balcony-Leap
Runner, Rose-Thorn Parry); U/W frost control gets 7 (Swan-Lake Sovereign,
Duchess of the Lost Winter, Empress of the Mirror Shards, Frost-Sleigh Maiden,
Frozen-Heart Sister, Frozen to the Floor, Glass-Mountain Knight); W/G token
lifegain gets 8 (Rose-Red of the Winter Hearth, The Twelve Dancing Heiresses,
Casita Hearth, Hearth Blessing, Sunrise Over the Ballroom, Masquerade Chaperone,
Bayou Lamplighter, Goose-Girl of the Wind Meadow); U/G wayfinder gets 5
(Tide-Reader of the Far Reef, Chart the Reef Road, Star-Chart Navigator,
Canoe-Carver of the Reef, Drown the Pages). Measurement: one authored 40+10 list
per package in the 28-deck layer (the `duatArchetypeDecks.ts` pattern), each
above 35% in the prefab field so none is a dead archetype; no higher bar is set
for packages that were optional in the shipped spec.

**f. Survivable early bodies and rate-efficient threats in U/B/W.** 17 new
U/B/W bodies at mv 1-3, all priced on the modern curve (W1) and each one notch
under the shipped efficient vanilla at its cost, with the mechanic (Skim, Nine
Lives, Preserve) making up the gap, so no shipped card is dominated (§4). The
rate threats are the double-pip rares (Gerda 3/4 at {2}{U}{U}, Sugar-Cottage
Witch 3/4 deathblade at {2}{B}{B}) and the two legends. Measurement: goal (a)'s
aggro cells.

### 2d. Returning-mechanic evaluation

Legality constraints applied (from `src/engine/types.ts` validators and the
documented Retell rule): Rite never combines with X, Retell, Skim, or
Hauntlink and carries no cast targets (`validateRiteDef`); Hauntlink is
Artifact/Enchantment only, never an Aura, never with X, Empower, Skim, or
Retell, and never beside an attached static (`validateHauntlinkDef`); Nine
Lives and Preserve are creature-only and never with Hauntlink
(`validateNineLivesDef`, `validatePreserveDef`); Retell lives on Rituals and
Charms only (keyword-map.md), never on creatures, never on X, never with
Empower (adding-cards.md).

| Mechanic | Verdict | Why |
| --- | --- | --- |
| **Nine Lives** | **PICK (9 carriers, 7 at c/r)** | The whole set is women who come back: the sleeper wakes, the coffin opens, the swan turns back. It is also exactly the "survivable early body" class the 1.5 pass asked for, and the AI pilots it for free. Legal beside Skim, so the bodies still feed the graveyard plan. |
| **Preserve** | **PICK (7, all c/r)** | The graveyard engine finally cashes a body, not only a spell; Skim-then-Preserve is a two-card loop on one card. `preservePolicy` already ships in every brain. Band from the Duat doc: printed +2 at common, +1 at rare. |
| **Empower** | **PICK (3: 2 c, 1 r)** | The late-game mana sink a control deck wants once the Warchest has all ten lands down; legal beside Skim (Carpet Escape, Sunrise Over the Ballroom, Masquerade Chaperone). Kept off every Retell card by rule. Nocturne Manor is the neighbouring night set, so the voice fits. |
| Quests | Alternate (decision 1) | A fairy tale is three chapters, so the fit is real, but plan-1.6 parked Quests with the Arthurian voice and one Quest would bring no body; offered as the B option. |
| Champion Awakening | No | Already in the set (Thorn-Palace Heiress); a second one-off is not a quota carrier. |
| Dreaded | No | Already in the set (3 carriers); an evergreen keyword, not a returning named mechanic. |
| twinBlades | No | An aggro keyword; the set's R heroine tempo is its smallest slice and the Duat wave already owns the common twinBlades sprinkle. |
| Hauntlink | No | Cannot sit beside Skim or Retell, is Artifact/Enchantment only, and R19 already has four Hauntlink carriers; the help she needs is bodies, which Hauntlink cannot be. |
| Rite | No | Needs token fodder density the set does not have and cannot combine with Skim or Retell. |

---

## 3. The 60 rows

Table format matches docs/expansions/dark-tales.md. The **Princess Adjacent**
column is the internal art-QA reference only; no protected name appears in a
card name. Every subject is an adult-coded woman. Costs use the `cost()`
reading (`{2}{U}` = `cost(2, 'U')`). "Skim {1}" is `skim: { cost: cost(1) }`;
"Retell {3}{U}" is `retell: { cost: cost(3, 'U') }` with no ops override;
"Preserve {4}{U}" is `preserve: { cost: cost(4, 'U') }`; "Empower {2}{W}: ..."
is `empower: { cost, ops }`.

### UR

| ID | Name | Rarity | Color | Type | Subject | Princess Adjacent | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dt-swan-lake-sovereign | Swan-Lake Sovereign | UR | U/W | Legendary Creature | Swan-cursed princess who returns at dawn | Odette / Swan Lake | {4}{U}{W} 4/5; skyborne, sentinel; Nine Lives; dawn: foresee 1 | Frost-control finisher, R19-adoptable |
| dt-sea-witch-of-the-drowned-bargain | Sea Witch of the Drowned Bargain | UR | U/B | Legendary Creature | Sea witch who buys voices by contract | Ursula / Little Mermaid | {4}{U}{B} 5/5; deathblade; arrives: draw 2 + grind self 2; Skim {2} | Midnight Storybook finisher that refuels |

### SSR

| ID | Name | Rarity | Color | Type | Subject | Princess Adjacent | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dt-thorn-fairy-uninvited | Thorn Fairy, Uninvited | SSR | B | Legendary Creature | The curse-fairy nobody invited to the christening | Maleficent / Sleeping Beauty | {3}{B}{B} 4/4; skyborne, deathblade; arrives: discardRandom opponent 1 | Villain control threat |
| dt-teller-of-a-thousand-nights | Teller of a Thousand Nights | SSR | U/R | Legendary Creature | Storyteller who survives by the next tale | Scheherazade / Arabian Nights | {3}{U}{R} 3/4; arrives: foresee 2 + draw 1; Skim {1} | Spells-tempo legend, the Retell deck's face |
| dt-rose-red-of-the-winter-hearth | Rose-Red of the Winter Hearth | SSR | G/W | Legendary Creature | Hearth sister who shelters the bear through winter | Rose-Red / Snow-White and Rose-Red | {3}{G}{W} 3/4; sentinel; arrives: createToken Hearth Spirit x2; dawn: gainLife 1 | W/G token-lifegain legend |
| dt-bluebeards-last-bride | Bluebeard's Last Bride | SSR | W/B | Legendary Creature | The bride who opened the forbidden door and lived | Bluebeard's wife | {2}{W}{B} 3/3; bloodoath; Nine Lives; dies: loseLife opponent 2 | Attrition legend, R17-adoptable |

### SR

| ID | Name | Rarity | Color | Type | Subject | Princess Adjacent | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dt-twelve-dancing-heiresses | The Twelve Dancing Heiresses | SR | W | Ritual | Sisters who wear through their slippers every night | Twelve Dancing Princesses | {3}{W}: createToken Masked Guest x3; Retell {5}{W} | Go-wide payoff |
| dt-poisoned-comb | Poisoned Comb | SR | B | Ritual | The queen's second attempt | Snow White / Evil Queen | {3}{B}: destroy target creature; Retell {5}{B} | Premium Retell removal |
| dt-empress-of-the-mirror-shards | Empress of the Mirror Shards | SR | U | Legendary Creature | Winter empress whose mirror splinters hearts | Snow Queen | {2}{U}{U} 2/4; skyborne, untouchable; arrives: foresee 1; Skim {1} | Frost-control threat, R19-adoptable |
| dt-tide-reader-of-the-far-reef | Tide-Reader of the Far Reef | SR | U/G | Legendary Creature | Grandmother who reads the tide as a map | Gramma Tala / Moana | {2}{U}{G} 2/4; arrives: extraLandDrop + foresee 1; Skim {1} | Wayfinder ramp legend |
| dt-bell-tower-dancer | Bell-Tower Dancer | SR | W/R | Legendary Creature | Street dancer who defies the cathedral court | Esmeralda | {1}{W}{R} 2/2; warcry, firstBlade; Skim {1} | W/R heroine tempo legend |
| dt-duchess-of-the-lost-winter | Duchess of the Lost Winter | SR | U/W | Legendary Creature | Lost grand duchess of a frozen court | Anastasia | {2}{U}{W} 2/4; untouchable; arrives: foresee 2; Skim {1} | Frost-control body, R19-adoptable |

### R

| ID | Name | Rarity | Color | Type | Subject | Princess Adjacent | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dt-glass-mountain-knight | Glass-Mountain Knight | R | W | Creature | Knight who rides the glass mountain for the princess | Princess on the Glass Mountain | {2}{W} 2/2; sentinel; Nine Lives | Survivable W body, blocks twice |
| dt-ball-before-midnight | Ball Before Midnight | R | W | Ritual | The last dance before the chime | Cinderella | {3}{W}: boost allYours +2/+2; Retell {5}{W} | Go-wide finisher |
| dt-goose-girl-of-the-wind-meadow | Goose-Girl of the Wind Meadow | R | W | Creature | Princess living disguised as a goose-girl | The Goose Girl | {3}{W} 2/3; skyborne; arrives: gainLife 2; Preserve {4}{W} | Evasive value body |
| dt-banished-from-the-ball | Banished from the Ball | R | W | Ritual | The guest struck from the list | Cinderella / Stepfamily | {3}{W}: sever target creature; Retell {5}{W} | W removal, R19-adoptable |
| dt-casita-hearth | Casita Hearth | R | W | Enchantment | Living house that sets one more place each morning | Mirabel | {3}{W}; dawn: createToken Hearth Spirit x1 + gainLife 1 | Token-lifegain engine |
| dt-swan-feather-scout | Swan-Feather Scout | R | U | Creature | Swan maiden scouting the lake shore | Swan Maiden / Swan Lake | {2}{U} 2/1; skyborne; Skim {1}; Preserve {3}{U} | Evasive recursion body |
| dt-gerda-of-the-long-road | Gerda of the Long Road | R | U | Creature | The woman who walked to the winter palace (adult-coded) | Gerda / The Snow Queen | {2}{U}{U} 3/4; arrives: foresee 1; Preserve {4}{U} | U rate body |
| dt-drowned-library | Drowned Library | R | U | Ritual | A library under the tide line | Little Mermaid / Belle | {3}{U}: draw 2; Retell {4}{U} | Card advantage |
| dt-frost-sleigh-maiden | Frost-Sleigh Maiden | R | U | Creature | Sleigh-driver of the winter court | The Snow Queen | {3}{U} 2/4; skyborne; Skim {1} | Evasive blocker, R19-adoptable |
| dt-glass-coffin-sleeper | Glass-Coffin Sleeper | R | B | Creature | The sleeper in the glass coffin | Snow White | {2}{B} 2/2; Nine Lives; dies: grind self 2 | Grave-stocking body |
| dt-laced-too-tight | Laced Too Tight | R | B | Charm | The queen's bodice-lace trick | Snow White / Evil Queen | {2}{B}: boost target -2/-2; Retell {3}{B} | Retell removal |
| dt-sugar-cottage-witch | Sugar-Cottage Witch | R | B | Creature | Witch of the gingerbread cottage | Hansel and Gretel | {2}{B}{B} 3/4; deathblade; Preserve {4}{B} | Rate-efficient B threat |
| dt-raven-mother-of-the-mirror | Raven-Mother of the Mirror | R | B | Creature | Keeper of the mirror's ravens | Snow White / Evil Queen | {1}{B} 1/2; Skim {1}; Preserve {3}{B} | Early body, Skim-then-Preserve loop |
| dt-woodcutters-daughter | Woodcutter's Daughter | R | R | Creature | Axe-bearing daughter who ends the wolf | Red Riding Hood | {2}{R} 3/1; firstBlade; Nine Lives | W/R tempo threat |
| dt-carpet-escape | Carpet Escape | R | R | Charm | Rooftop escape on a flying carpet | Jasmine | {1}{R}: boost target +2/+0 with skyborne; Empower {1}{R}: damage opponent 2 | W/R tempo trick |
| dt-briar-hedge-matriarch | Briar-Hedge Matriarch | R | G | Creature | Matriarch of the thorn hedge | Sleeping Beauty | {1}{G}{G} 2/4; wardingGaze; Preserve {3}{G} | Defensive recursion |
| dt-chart-the-reef-road | Chart the Reef Road | R | G | Ritual | Plotting the course past the reef | Moana | {3}{G}: extraLandDrop + foresee 2 + draw 1; Retell {4}{G} | Wayfinder ramp |
| dt-clockwork-coachwoman | Clockwork Coachwoman | R | C | Artifact Creature | Clockwork driver of the midnight coach | Cinderella | {3} 2/3; Skim {1} | Any-deck body |

### C

| ID | Name | Rarity | Color | Type | Subject | Princess Adjacent | Keywords / Ops | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dt-pea-mattress-sentry | Pea-Mattress Sentry | C | W | Creature | Sentry of the twenty mattresses | Princess and the Pea | {1}{W} 1/3; Skim {1} | Early blocker |
| dt-handmaid-who-woke-twice | Handmaid Who Woke Twice | C | W | Creature | Handmaid who woke from the castle sleep | Sleeping Beauty | {1}{W} 1/2; bloodoath; Nine Lives | Early blocker that returns |
| dt-masquerade-chaperone | Masquerade Chaperone | C | W | Creature | Chaperone who brings her own guests | Cinderella | {2}{W} 1/3; Empower {2}{W}: createToken Masked Guest x2 | Go-wide body |
| dt-tower-chatelaine | Tower Chatelaine | C | W | Creature | Keeper of the tower keys | Rapunzel / Mother Gothel | {3}{W} 2/5; Skim {1} | Survivable body |
| dt-rose-thorn-parry | Rose-Thorn Parry | C | W | Charm | A rose held like a blade | Belle | {1}{W}: boost target +2/+0 with firstBlade; Retell {2}{W} | Combat trick |
| dt-hearth-blessing | Hearth Blessing | C | W | Ritual | Blessing of the household spirit | Mirabel | {2}{W}: createToken Hearth Spirit x1 + gainLife 2; Retell {4}{W} | Token-lifegain |
| dt-sunrise-over-the-ballroom | Sunrise Over the Ballroom | C | W | Ritual | Dawn after the ball | Cinderella | {1}{W}: gainLife 3 + foresee 1; Empower {2}{W}: createToken Masked Guest x2 | Stabilizer with a late mode |
| dt-frog-pond-bride | Frog-Pond Bride | C | U | Creature | Bride of the frog bargain | The Frog Prince | {1}{U} 1/2; Nine Lives | Early blocker that returns |
| dt-tide-sister-of-the-deep | Tide-Sister of the Deep | C | U | Creature (Mermaid) | Mermaid sister of the undersea court | Little Mermaid | {2}{U} 1/3; skyborne; Skim {1} | Evasive blocker, fifth Mermaid |
| dt-swallow-borne-bride | Swallow-Borne Bride | C | U | Creature | Thumb-sized bride carried south by a swallow | Thumbelina | {2}{U} 3/2; Skim {1} | Tempo body |
| dt-frozen-heart-sister | Frozen-Heart Sister | C | U | Creature | Sister whose frozen heart thawed | Anna / Frozen | {2}{U} 2/2; Skim {1}; Preserve {4}{U} | Skim-then-Preserve loop |
| dt-star-chart-navigator | Star-Chart Navigator | C | U | Creature | Navigator who reads the stars from the prow | Moana | {3}{U} 2/5; Skim {1} | Survivable body |
| dt-drown-the-pages | Drown the Pages | C | U | Ritual | Pages given to the sea | Little Mermaid | {2}{U}: grind self 3 + draw 1; Retell {3}{U} | Engine cantrip |
| dt-second-verse | Second Verse | C | U | Charm | The lullaby's second verse | Sleeping Beauty | {1}{U}: draw 1 + grind self 1; Retell {2}{U} | Cantrip |
| dt-frozen-to-the-floor | Frozen to the Floor | C | U | Enchantment Aura | Frost pinning a guest to the ballroom floor | Elsa / Frozen Queen | {1}{U} Aura: attached bulwark and -1/-0; Skim {1} | U pacifism |
| dt-eel-twin-of-the-sea-witch | Eel-Twin of the Sea Witch | C | B | Creature | Eel-familiar twin of the sea witch | Ursula / Little Mermaid | {1}{B} 1/3; Skim {1} | Early blocker |
| dt-elder-stepsister | Elder Stepsister | C | B | Creature | Eldest of the cruel stepsisters | Cinderella / Stepfamily | {2}{B} 1/4; Skim {1} | Survivable body |
| dt-gingerbread-crumb-girl | Gingerbread-Crumb Girl | C | B | Creature | The woman who marked the path with crumbs (adult-coded) | Gretel | {2}{B} 1/3; Nine Lives; Skim {1} | Blocker that returns |
| dt-ink-contract-clerk | Ink-Contract Clerk | C | B | Creature | Clerk of the sea witch's contracts | Little Mermaid / Sea Witch | {2}{B} 2/2; arrives: draw 1 + damage controller 1 | Value body |
| dt-huntress-who-spared-her | Huntress Who Spared Her | C | B | Creature | Royal huntress who let the princess go | Snow White / Huntsman | {3}{B} 4/2; Skim {1} | Rate threat |
| dt-apple-half-exchange | Apple-Half Exchange | C | B | Ritual | Sharing the poisoned apple | Snow White / Evil Queen | {2}{B}: loseLife opponent 2 + gainLife 2; Retell {3}{B} | Drain |
| dt-shadow-miners-dirge | Shadow-Miner's Dirge | C | B | Ritual | The miners' dirge from below | Snow White / Seven Dwarfs | {2}{B}: createToken Shadow Miner x1 + grind self 2; Retell {3}{B} | Token plus grave |
| dt-hearth-ember-dancer | Hearth-Ember Dancer | C | R | Creature | Cinder girl dancing in the hearth ash | Cinderella | {1}{R} 2/1; Skim {1} | Tempo body |
| dt-balcony-leap-runner | Balcony-Leap Runner | C | R | Creature | Princess leaping from the palace balcony | Jasmine | {3}{R} 3/3; warcry; Skim {1} | Tempo threat |
| dt-ember-lantern-toss | Ember-Lantern Toss | C | R | Charm | A thrown festival lantern | Rapunzel | {2}{R}: damage target 2 (any); Retell {3}{R} | Retell burn |
| dt-bayou-lamplighter | Bayou Lamplighter | C | G | Creature | Lamplighter whose lamp is a firefly | Tiana | {1}{G} 1/1; arrives: createToken Firefly x1 | Two bodies for two |
| dt-canoe-carver-of-the-reef | Canoe-Carver of the Reef | C | G | Creature | Island canoe-carver | Moana | {2}{G} 2/4; Skim {1} | Survivable body |
| dt-grandmothers-remedy | Grandmother's Remedy | C | G | Charm | Grandmother's herbal remedy | Red Riding Hood | {1}{G}: boost target +2/+2 with wardingGaze; Retell {2}{G} | Combat trick |
| dt-paper-ballerina | Paper Ballerina | C | C | Artifact Creature | Paper dancer who survives the stove | The Tin Soldier's ballerina | {2} 1/2; Nine Lives | Any-deck blocker |
| dt-pumpkin-shell-lantern | Pumpkin-Shell Lantern | C | C | Artifact | Hollowed pumpkin lantern | Cinderella | {2}; Skim {1}; dawn: grind self 1 + gainLife 1 | Grave setup |

**Totals check**: UR 2, SSR 4, SR 6, R 18, C 30 = 60. W 13, U 13, B 13, R 5,
G 5, multicolor 8, colorless 3 = 60. Creatures 40 (UR 2/2, SSR 4/4, SR 4/6, R
11/18, C 19/30). Retell 15, Skim 25 (23 on bodies), Nine Lives 9, Preserve 7,
Empower 3. Mermaid creatures 4 to 5.

---

## 4. Costing evidence

### 4.1 Per-row precedent and notch

The notch rule (adding-cards.md, "Returning named mechanics"): the base effect
sits one notch above the shipped efficient version so no shipped card is
dominated; the mechanic is the payoff. "Frontier" below names the shipped card
from W2-W5 that the row was priced against.

| ID | Band and precedent | Chosen cost, notch |
| --- | --- | --- |
| dt-swan-lake-sovereign | W1 mythic mv6 4.94/4.91 (n=33); Skyborne premium ~1.0 attack at 5+ (playbook §6); Nine Lives band 1 stat point; M-O found no 6-mv U/W flying legend in the corpus (n=0), so the frontier is ours: Ice-Crown Sovereign {6}{U}{W} 4/6 skyborne, Winter-Palace Duchess {4}{U}{W} 3/5 untouchable | {4}{U}{W} 4/5 with two keywords plus Nine Lives: p+t 9 sits under the mv6 mythic mean; keyword sets differ from the Duchess so neither dominates |
| dt-sea-witch-of-the-drowned-bargain | W1 mythic mv6 4.94/4.91; frontier Abyssal Songstress {5}{U}{B} 4/5 skyborne dawn value; Skim band {2} on legends (Lantern-Tower Witch, Bayou-Star Proprietor) | {4}{U}{B} 5/5 deathblade, arrival draw 2 + grind 2 (the Sea-Witch Contract's draw without the self-damage, on a body), Skim {2} |
| dt-thorn-fairy-uninvited | W1 mythic mv5 4.08/4.28 (n=25); frontier Poison-Mirror Regent {4}{B} 4/4 deathblade untouchable; discard-on-arrival precedent Jia Xu {2}{B} 2/2 (W2) | {3}{B}{B} 4/4, two keywords plus a 1-card discard; double pip is the notch over the Regent |
| dt-teller-of-a-thousand-nights | frontier Lantern-Tower Witch {4}{U}{R} 4/4 Skim {2} arrives damage 2 + draw 1; Noir Godmother {2}{U} 2/3 foresee 1 + draw 1 | {3}{U}{R} 3/4 foresee 2 + draw 1, Skim {1}: one mana and one stat point under the Witch for a filtering instead of a burning arrival |
| dt-rose-red-of-the-winter-hearth | frontier Casita Miracle Keeper {3}{W}{G} 3/5 one Hearth Spirit + dawn foresee; Beza-class two-token bodies are 2018+ mythic (M-I2 n=3), so the era anchor is Seller of Songbirds {2}{W} 1/2 plus one token (M-I, n=1 pre-2015) | {3}{G}{W} 3/4 sentinel, two Hearth Spirits, dawn gainLife 1: one stat point under the Keeper for the second token |
| dt-bluebeards-last-bride | Nine Lives rare band NINE-SR-06 {2}{W}{B} 3/3 bloodoath (Duat doc §3.2); dies-riders priced twice | {2}{W}{B} 3/3 bloodoath Nine Lives, dies drain 2 (priced as a 4-point drain over two deaths); frontier Nine-Marked Vanguard {2}{W}{G} 3/3 sentinel Nine Lives is the same shape in other colors |
| dt-twelve-dancing-heiresses | three 1/1 tokens W sorcery pre-2015: M-G n=4 avg mv 4.75; frontier Parade of Heroes {2}{W} three tokens (CORE r) and Grail Procession {3}{W} two tokens + gainLife 3 | {3}{W} for three tokens, Retell {5}{W} (+2, the SR stretch): Parade is cheaper so the wave does not dominate it |
| dt-poisoned-comb | B sorcery "destroy target creature" pre-2010: M-C2 n=18 avg mv 3.72; the only B flashback destroy in the corpus is Strangling Soot {2}{B} (2006); frontier Apple of Endless Sleep {3}{B} sever + Skim {1}, Doom Bolt / One Clean Cut {1}{B}{B} Charm | {3}{B} Ritual, Retell {5}{B} (+2): same cost as the Apple on a weaker op with the other mechanic |
| dt-empress-of-the-mirror-shards | U hexproof+flying pre-2015: M (n=1, mv 4); frontier Zhong Hui {2}{U}{U} 3/3 skyborne (r), Zhuge Liang {2}{U}{U} 2/4 draw (ssr) | {2}{U}{U} 2/4 skyborne untouchable, foresee 1, Skim {1}: attack held to 2 so Zhong Hui is not dominated |
| dt-tide-reader-of-the-far-reef | frontier Ocean Wayfinder {4}{U}{G} 3/4 extraLandDrop + foresee 1 Skim {2}; Silt-Pool Reader {2}{U}{G} 2/3 foresee Preserve {3}{U}{G} | {2}{U}{G} 2/4, same arrival as the Wayfinder at two less mana and one less attack, Skim {1}; the first draft carried Preserve and foresee 2 and would have dominated Silt-Pool Reader, so both were cut |
| dt-bell-tower-dancer | frontier Sidhe Silver-Lancer {2}{W} 3/3 sentinel firstBlade (r), Tournament Favorite {2}{R} 3/2 firstBlade warcry (r) | {1}{W}{R} 2/2 warcry firstBlade Skim {1}: gold pips and a 2/2 body are the notch under both |
| dt-duchess-of-the-lost-winter | frontier Winter-Palace Duchess {4}{U}{W} 3/5 untouchable dawn foresee 1 | {2}{U}{W} 2/4 untouchable arrives foresee 2, Skim {1}: the early-game version of the same card |
| dt-glass-mountain-knight | Nine Lives band: one stat point off W1 mv3 2.12/2.50; frontier White Horse / Paper-Mask Sentinel {2}{W} 2/3 sentinel (c) | {2}{W} 2/2 sentinel Nine Lives: the first draft 2/3 sentinel would have dominated White Horse; the defense point pays for the return |
| dt-ball-before-midnight | team +2/+2 W sorcery pre-2015: M-K n=2 avg mv 4.0; frontier Weigh the Room {2}{W} +1/+1 allYours Ritual (DUAT c), Stand as One {1}{W} +1/+1 Charm (r) | {3}{W} +2/+2, Retell {5}{W} (+2 at rare for a finisher); the first draft {2}{W} +1/+1 Retell would have dominated Weigh the Room |
| dt-goose-girl-of-the-wind-meadow | Preserve rare band printed +1; Skyborne premium ~0.7 attack at mv4; frontier Chooser of the Slain {3}{W} 2/3 skyborne + one token (r) | {3}{W} 2/3 skyborne, gainLife 2, Preserve {4}{W}: a different arrival op from the Chooser at the same body |
| dt-banished-from-the-ball | W "exile target creature" sorcery pre-2015: M-B n=3 avg mv 4.33 (instant n=10 avg 2.1); frontier Briar-Veil Banishing {2}{W} Ritual sever (r), Sealed Doorway {3}{W} Charm sever (c) | {3}{W} Ritual, Retell {5}{W} (+2): the first draft was a {3}{W} Charm and would have dominated Sealed Doorway; as a Ritual it costs one more than Briar-Veil Banishing |
| dt-casita-hearth | token-each-upkeep enchantments pre-2015: M-A n=7 avg mv 4.14 (range 3-5; the 3-mana ones carry an upkeep or forced-attack drawback); frontier Cathedral of Bats {3}{B} dawn one token (sr) | {3}{W} dawn one Hearth Spirit + gainLife 1: the gainLife rider breaks the REDESKIN with Cathedral of Bats and is the W/G package's payoff |
| dt-swan-feather-scout | frontier Mistwing Pixie / Zhang He {1}{U} 2/1 skyborne (c), Waterclock Watcher {3}{U} 3/2 skyborne Preserve {3}{U} (r); Preserve rare band +1 | {2}{U} 2/1 skyborne Skim {1} Preserve {3}{U}: the first draft at {1}{U} would have dominated the Pixie, so the body moved up a mana and gained Preserve |
| dt-gerda-of-the-long-road | frontier Lianshi {2}{U}{U} 3/4 wardingGaze (c), Bookside Ferrywoman {3}{U} 2/4 foresee (c), Moon-Pool Selkie {2}{U} 2/3 foresee (r) | {2}{U}{U} 3/4 foresee 1 Preserve {4}{U}: the {2}{U} 2/3 draft would have dominated the Selkie and a {3}{U} 2/4 draft the Ferrywoman; the double pip is the notch |
| dt-drowned-library | draw-two sorceries U (mtg-db `like --text`, top analogs Divination {2}{U}, Counsel of the Soratami {2}{U}, Touch of Brilliance {3}{U}); frontier Twice-Read Water {2}{U} draw 2 (c), Undersea Bargain {3}{U} draw 2 Skim {1} (r) | {3}{U}, Retell {4}{U} (+1): one mana over the plain version for the recast, the Skim twin of the Bargain |
| dt-frost-sleigh-maiden | Skyborne premium ~0.7 attack at mv4 on W1 2.93/3.44; frontier Skyline Yokai / Tidecaller {3}{U} 3/3 skyborne (r), Skyline Ferrywoman {3}{U} 2/4 skyborne foresee (r) | {3}{U} 2/4 skyborne Skim {1}: the 3/3 draft would have dominated the Yokai; defense over attack is the control shape |
| dt-glass-coffin-sleeper | Nine Lives rare band NINE-R-04 {2}{B} 3/2 dies drain (Duat doc, shipped as Tomb-Toll Veteran) | {2}{B} 2/2 Nine Lives, dies grind self 2 (fires twice, so four cards of stocking); a different dies op from the Veteran |
| dt-laced-too-tight | B "-2/-2" instant pre-2015: M-J2 n=2 avg mv 2.0 (no flashback version exists, M-J n=0); frontier Grave Chill {B}, Hollow the Chest {1}{B} (c) | {2}{B}, Retell {3}{B} (+1): the {1}{B} draft would have dominated Hollow the Chest |
| dt-sugar-cottage-witch | W1 uncommon mv4 3.04/3.18; B deathtouch 3/4 at any cost pre-2015: M n=0, so the frontier is ours: Zhuge Dan {3}{B} 3/4 (c), Plaguebearer Draugr {3}{B} 2/3 deathblade (c), Barrow-Wight {3}{B} 4/3 deathblade (r) | {2}{B}{B} 3/4 deathblade Preserve {4}{B}: every {3}{B} statline with deathblade and Preserve dominated a shipped common, so the pip doubled |
| dt-raven-mother-of-the-mirror | Preserve rare band +1 (Linen-Kept Echo {2}{B} 2/2 Preserve {2}{B}); frontier Black Cat Familiar {1}{B} 1/2 deathblade (c) | {1}{B} 1/2 Skim {1} Preserve {3}{B}: no keyword, so the Familiar is not dominated |
| dt-woodcutters-daughter | Nine Lives band; frontier Errant Duelist / Rain-Soaked Ronin {2}{R} 2/2 firstBlade (c), Berserker Initiate {2}{R} 3/1 warcry (c) | {2}{R} 3/1 firstBlade Nine Lives: the 2/2 draft would have dominated the Duelist |
| dt-carpet-escape | R "+2/+0 and flying" instants pre-2015: M n=0 with that exact phrasing; frontier Fae Spark {R} +2/+0 (c), Boar Rush {R} +2/+0 overrun (c); Empower band {1}+pip on 2-mv | {1}{R} with the skyborne grant (a structural difference from Boar Rush), Empower {1}{R}: damage opponent 2 (the Kicked Door rider at the 2-mv rate) |
| dt-briar-hedge-matriarch | Preserve rare band +1; frontier Granary Sentinel {2}{G} 2/3 wardingGaze (c), Thornmaze Patrol {2}{G} 3/4 wardingGaze foresee (r), Jiang Wei {1}{G}{G} 3/3 (c) | {1}{G}{G} 2/4 wardingGaze Preserve {3}{G}: at {2}{G} the 2/4 dominated Granary Sentinel; the double pip is the notch |
| dt-chart-the-reef-road | extra-land-plus-draw G sorceries: M-N Explore {1}{G} (2010), Scale the Heights {2}{G} (2020); frontier Harvest After Rain {2}{G} draw 1 + extraLandDrop (c), Forked-Road Choice {2}{G} extraLandDrop + foresee 1 (c) | {3}{G} with foresee 2 added, Retell {4}{G} (+1): the {2}{G} drafts dominated one shipped common each |
| dt-clockwork-coachwoman | W3 colorless creatures: Terracotta Soldier {2} 2/2, Terracotta Guardian {4} 3/4; nothing at {3} | {3} 2/3 Skim {1}: fills the empty rung between the two Terracottas |
| dt-pea-mattress-sentry | W1 mv2 1.69/1.78; frontier Guan Suo {1}{W} 2/2 (c), Alabaster Usher / Chapel Guard / Sidhe Page {1}{W} 1/3 sentinel (c) | {1}{W} 1/3 Skim {1}: the 2/2 Skim draft dominated Guan Suo; no keyword so the 1/3 sentinels stand |
| dt-handmaid-who-woke-twice | Nine Lives common band NINE-C-01/02 (Duat doc; shipped Sand-Pawed Guard {1}{W} 2/1 Nine Lives) | {1}{W} 1/2 bloodoath Nine Lives: the 2/1 draft was IDENTICAL to Sand-Pawed Guard |
| dt-masquerade-chaperone | Empower band {2}+pip; two-token arrivals are Okoye/Knight-Captain class (M-I2, 4-5 mv); frontier Collar-Bound Warden {2}{W} 2/3 (c), Linen Processioner {2}{W} 2/3 + one token (c) | {2}{W} 1/3 with the tokens behind Empower {2}{W}: the 2/3 draft dominated Collar-Bound Warden |
| dt-tower-chatelaine | W1 mv4 2.93/3.44; frontier Warden of the Kept {3}{W} 3/4 (r), Xu Chu {3}{W} 3/5 (c) | {3}{W} 2/5 Skim {1}: the 3/4 Skim draft dominated the Warden |
| dt-rose-thorn-parry | Retell house band +1; frontier Silver Knife {1}{W} +1/+1 firstBlade (c), Tilting Lance {1}{R} +2/+0 firstBlade (c) | {1}{W} +2/+0 firstBlade Retell {2}{W}: the +1/+1 draft dominated Silver Knife |
| dt-hearth-blessing | frontier Grail Procession {3}{W} two tokens + gainLife 3 (r), Hill Feast {1}{G} gainLife 4 + token (c) | {2}{W} one token + gainLife 2, Retell {4}{W} (+2 because the recast makes a second body; the common stretch is flagged for the pass) |
| dt-sunrise-over-the-ballroom | frontier Roadside Shrine {1}{W} gainLife 4 Skim (c, the sprinkle's own notch card), Blessed Respite {W} gainLife 4 (c); Empower band {2}+pip | {1}{W} gainLife 3 + foresee 1, Empower {2}{W} two Masked Guests: less life than the Shrine, a different rider |
| dt-frog-pond-bride | Nine Lives common band; frontier Mist Wraith {1}{U} 1/2 skyborne (c), Li Dian {1}{U} 2/2 (c) | {1}{U} 1/2 Nine Lives: the 2/2 Preserve draft dominated Li Dian |
| dt-tide-sister-of-the-deep | Skyborne premium ~0.5 attack at mv2-3; frontier Silt-Bank Pilot {1}{U} 1/3 Skim (c), River-Sky Reader {2}{U} 1/4 skyborne (c) | {2}{U} 1/3 skyborne Skim {1}: under the Reader on defense, over the Pilot on cost |
| dt-swallow-borne-bride | frontier Raven Courier {2}{U} 2/2 skyborne (c), no {2}{U} 3/2 in the corpus | {2}{U} 3/2 Skim {1}: the 2/2 skyborne draft was IDENTICAL to Raven Courier |
| dt-frozen-heart-sister | Preserve common band printed +2; frontier Charted Crossing Guide {2}{U} 2/3 Preserve {3}{U} (c), Reedway Surveyor {2}{U} 2/2 foresee (c) | {2}{U} 2/2 Skim {1} Preserve {4}{U}: one less defense and one more Preserve mana than the Guide, Skim on top |
| dt-star-chart-navigator | W1 mv4; frontier Xu Sheng {3}{U} 3/4 (c), Man Chong {3}{U} 2/4 (c) | {3}{U} 2/5 Skim {1}: the 3/4 Skim draft dominated Xu Sheng |
| dt-drown-the-pages | mill-2-draw-1 instants: M-F Mental Note {U}, Thought Scour {U}, Predict {1}{U}; frontier Read the Runes {1}{U} grind 3 + draw 1 (c) | {2}{U} grind 3 + draw 1, Retell {3}{U} (+1): one mana over Read the Runes for the recast |
| dt-second-verse | frontier Page Torn Free {1}{U} draw 1 Retell {2}{U} (c) | {1}{U} draw 1 + grind self 1, Retell {2}{U}: same price, the grind rider is what the engine wants; the tool suppresses a verdict on self-grind, recorded here as a deliberate near pair |
| dt-frozen-to-the-floor | frontier Clouded Mind {U} Aura -3/-0 (c), Gilded Cage {2}{W} Aura -2/-0 bulwark (r) | {1}{U} Aura bulwark and -1/-0, Skim {1}: the bulwark grant is structural (never compared to Clouded Mind), the smaller debuff is the notch under the Cage |
| dt-eel-twin-of-the-sea-witch | frontier Black Cat Familiar {1}{B} 1/2 deathblade (c), Silt-Bank Pilot {1}{U} 1/3 Skim (c) | {1}{B} 1/3 Skim {1}: the deathblade drafts dominated the Familiar or Lamia Nightblade; this is the B twin of the Pilot (a cross-set REDESKIN, accepted) |
| dt-elder-stepsister | frontier Jia Chong {2}{B} 2/3 (c), Cheng Yu {2}{B} 3/2 (c) | {2}{B} 1/4 Skim {1}: no {2}{B} 1/4 exists; both 2/3 and 3/2 Skim drafts dominated a CORE common |
| dt-gingerbread-crumb-girl | Nine Lives common band; frontier Spiderkin Weaver {2}{B} 1/3 deathblade wardingGaze (c) | {2}{B} 1/3 Nine Lives Skim {1}: no keyword overlap with the Weaver |
| dt-ink-contract-clerk | Phyrexian Rager {2}{B} 2/2 (M-H, the only pre-2015 hit, 2000) | {2}{B} 2/2 draw 1 + damage controller 1: the era card at the era price |
| dt-huntress-who-spared-her | W1 mv4; frontier Zhuge Dan {3}{B} 3/4, Ding Feng {3}{B} 4/3, Bog-Fen Lurker {3}{B} 3/3 (all c) | {3}{B} 4/2 Skim {1}: the only 4-power statline at {3}{B} not already printed vanilla |
| dt-apple-half-exchange | frontier Retold by Candlelight {1}{B} loseLife 2 Retell {2}{B} (NOCT c), Treasonous Glance {1}{B} loseLife 2 + foresee 1 (c); no drain-2 flashback in the corpus (M-L n=0) | {2}{B} drain 2 + gain 2, Retell {3}{B} (+1): one mana over Candlelight for the lifegain half |
| dt-shadow-miners-dirge | frontier Bayou Masquerade {2}{B} two Fireflies Retell {3}{B} (r), Candlelit Seance {2}{B} grind 2 + draw (c) | {2}{B} one Shadow Miner + grind self 2, Retell {3}{B} (+1): one fewer token than the Masquerade for the grind rider |
| dt-hearth-ember-dancer | frontier Guanqiu Jian / Ling Tong {1}{R} 2/2 (c), Pumpkin Attendant {1}{R} 2/1 warcry (c) | {1}{R} 2/1 Skim {1}: both the 2/2 Skim and 2/1 warcry Skim drafts dominated a shipped common |
| dt-balcony-leap-runner | frontier Sunfire Warcaller {3}{R} 4/3 warcry (r), Merya {3}{R} 4/2 warcry (r), Dragon-Gem Guardian {3}{R} 3/3 firstBlade warcry (r) | {3}{R} 3/3 warcry Skim {1}: the 4/3 and 4/2 drafts each dominated a rare |
| dt-ember-lantern-toss | frontier Noon Judgment {2}{R} Ritual damage 3 Retell {3}{R} (r, the first draft was IDENTICAL to it), Prowfire Volley {2}{R} Charm damage 3 (c), Fire Attack {R} Charm damage 2 (c) | {2}{R} Charm damage 2, Retell {3}{R} (+1): one point under the Volley for the recast |
| dt-bayou-lamplighter | Seller of Songbirds {2}{W} 1/2 + token (M-I); frontier Fae Court Reveler {2}{G} 2/3 + token (c), Hazelwand Mystic {1}{G} 1/2 (c) | {1}{G} 1/1 + Firefly: the {2}{G} drafts sat under or on the Reveler; at two mana the 1/1 leaves Hazelwand Mystic alone |
| dt-canoe-carver-of-the-reef | frontier Pan / Zhang Bao {2}{G} 3/3 (c), Silt-Crown Guardian {2}{G} 2/4 sentinel (c) | {2}{G} 2/4 Skim {1}: the 3/3 Skim draft dominated two CORE commons |
| dt-grandmothers-remedy | frontier Root Through the Ruin {G} +2/+2 wardingGaze (DUAT c), Rose-Vine Snare {2}{G} +2/+2 (DARK c, already dominated by Wild Surge) | {1}{G} +2/+2 wardingGaze, Retell {2}{G} (+1): one mana over Root Through the Ruin |
| dt-paper-ballerina | Nine Lives common band; W3 colorless: Terracotta Soldier {2} 2/2, Haunted Doll {2} 1/1 sentinel | {2} 1/2 Nine Lives: between the two shipped {2} constructs |
| dt-pumpkin-shell-lantern | frontier Ink-Black Carriage {1}{B} dawn grind 1 (c), Empty Heart Jar {1} grind 1 (DUAT c), Candle in the Window {1}{W} dawn gainLife 1 (c) | {2} Skim {1}, dawn grind 1 + gainLife 1: a {2} with either rider alone plus Skim would have dominated the Carriage or the Candle, since {2} is payable wherever {1}{B} or {1}{W} is |

### 4.2 `dupes` and `dominated` against the shipped catalog

`npx tsx scripts/blades-db.ts dupes --set dark-tales` (120 cards): **0
IDENTICAL, 5 REDESKIN, 2 NEAR** (Apple Basket / Ragged Ballgown; Bookmark
Charm / Wayfinder Oar; Brass Lamp Charm / Jade Dragon Egg and / Singing Shell;
Jade Dragon Egg / Singing Shell; NEAR: Bookmark Charm / Brass Lamp Charm
foresee 2 vs 1, Singing Shell / Wayfinder Oar foresee 1 vs 2). With
`--near 2` a third NEAR appears: Once More With Magic / Rose-Petal Shield.
The shipped set's own dupes are all inside its Skim-relic family; the wave adds
no relic of that shape.

`npx tsx scripts/blades-db.ts dominated --limit 800` (1,019 collectible):
**750 pairs, 551 at identical cost.** Shipped Dark Tales cards that already
appear as the dominated side, unchanged by this plan: Rose-Vine Snare (by Wild
Surge), Plaid Arrow (by Thornsnare), Pumpkin Attendant and Red-Cloak Runner (by
Laughing Pooka, Sun Ce, Sun-Rope Hauler), Poisoned Courtier (by Batcloak
Cutthroat, Oathbroken Knight), Noir Godmother (by Blue-Ghost Broadcaster,
Silver-Branch Oracle), Foam-Silk Siren (by Bend-of-the-River Seer), Once More
With Magic (by Salt and Linen), Mirror Shard and Singing Shell and Jade Dragon
Egg (by Questing Map / Bookmark Charm), and The Book Opens Twice is dominated
by Echo's Refrain on the Retell axis. Dark Tales cards on the dominating side:
Thorn-Castle Warden (over Harvest Cobra), Dragon-Gem Guardian (over Lion-Sand
Vanguard), Bookmark Charm (over Jade Dragon Egg and Singing Shell).

**Tool limitation found while reading the report (record it in
blades-card-db.md when the wave lands):** `dominated` does not treat Nine
Lives, Preserve, or Rite as axes. It reports Shieldmaiden of Sparta {1}{W} 2/2
firstBlade as dominating Sand-Pawed Guard {1}{W} 2/1 Nine Lives, and Pumpkin
Attendant as dominating Prideclaw Skirmisher {2}{R} 2/1 Nine Lives. Every Nine
Lives and Preserve row above will therefore show up on the dominated side of
some pair after the rebuild (Paper Ballerina under Terracotta Soldier, Frog-Pond
Bride under Mist Wraith, and so on); those are tool artifacts, not findings.
Skim and Retell cost ARE axes (`has_skim`, `retell.cost`), which is why the
Skim-body repricings below were necessary.

**Would any wave row dominate a shipped card?** The rows are not in the
database yet, so the tool's rule (same or cheaper pip-wise, at least as good on
every axis, strictly better on one, same shape) was applied by hand against
W2-W5 for every row. **Thirty-nine first-draft rows were repriced or cut**
because they would have dominated a shipped card or duplicated one; the
per-row notes in §4.1 name each frontier card. The recurring lesson, worth
stating once: the base set's mono W/U/B commons already occupy every vanilla
statline at mv 2-3 ({1}{W} 2/2, {1}{U} 2/2 and 2/1 and 1/3, {1}{B} 2/2 and
2/1, {2}{W} 2/3 and 3/3, {2}{U} 2/3, {2}{B} 2/3 and 3/2 and 3/3 sentinel), so a
Skim or Preserve body at those costs must take a statline the base never
printed vanilla (1/3, 1/4, 2/5, 3/2 in U, 4/2 in B) or pay a second pip. That
is the honest shape of goal (f): the wave's early bodies are survivable
because they return or recur, not because they out-stat the base set.

Three deliberate near pairs remain and are accepted: Eel-Twin of the Sea Witch
is the B REDESKIN of Silt-Bank Pilot ({1}{U} 1/3 Skim); Second Verse sits
beside Page Torn Free with a self-grind rider the tool suppresses a verdict on;
Hearth Blessing's Retell is +2 at common (the recast makes a body) and is
flagged for the balance pass.

---

## 5. Archetype plan

### 5.1 Midnight Storybook, dt-native candidate (40 spells + 10 lands)

All forty are `dt-` ids (20 from the wave, 20 shipped). U/B core with a two-card
W splash, the shipped deck's shape.

```
reserveCards (40):
  dt-frog-pond-bride 2            dt-eel-twin-of-the-sea-witch 2
  dt-raven-mother-of-the-mirror 2 dt-frozen-heart-sister 3
  dt-glass-coffin-sleeper 3       dt-gingerbread-crumb-girl 2
  dt-gerda-of-the-long-road 2     dt-sugar-cottage-witch 2
  dt-poison-mirror-regent 2       dt-sea-witch-of-the-drowned-bargain 1
  dt-bluebeards-last-bride 1
  dt-poisoned-comb 2              dt-laced-too-tight 3
  dt-apple-of-endless-sleep 2     dt-drown-the-pages 3
  dt-drowned-library 2            dt-page-torn-free 2
  dt-apple-half-exchange 2        dt-banished-from-the-ball 1
  dt-sleeping-curse 1
landReserve (10): dt-tide-cavern 4, land-island 2, land-swamp 2, land-plains 2
```

22 bodies (8 Nine Lives copies, 9 Preserve copies, 13 Skim bodies), 18 spells
(13 Retell copies, 2 Skim rituals). The deck self-grinds through Glass-Coffin
Sleeper, Drown the Pages, and the Sea Witch, and cashes the graveyard three
ways: Retell, Preserve, and The Sleeping Curse followed by a Preserve. Versus
the shipped list it drops all 22 splash cards (bk-kitsune-illusionist x4,
tk-shu-zhaoyun, tk-jin-simayi, tk-wei-guojia, gk-hades, in-doom-bolt x4,
in-undertow x4, so-creeping-malaise x2) and the six shipped DT bodies that
were filler (Tower-Window Seer, Gilded Stepmother, Glass-Stair Duelist,
Foam-Silk Siren x4, Rose-Petal Knight). Copy counts are all 4 or under; the
W splash is one Plains lighter than the shipped deck because only three cards
need it.

Classic `cards` list: left as shipped behind `FEATURES.classicRetired`
(decision 2). If the owner rebuilds it too, `tests/data/dark-tales.test.ts`
pins `offSetNonlands === 20` and must move to 0.

### 5.2 R17 and R18: what they could adopt

Both summit lists splashed Gothic bodies and base removal because the
all-Dark-Tales first cuts measured 19% and 0%. Swap candidates, one for one by
role (decision 3):

- **R17 Glass-Coffin Queen (W/B)**: gm-black-cat-familiar to Handmaid Who Woke
  Twice; gm-chapel-exorcist to Glass-Mountain Knight; gm-batcloak-cutthroat to
  Glass-Coffin Sleeper; gm-ravenloft-heiress to Sugar-Cottage Witch;
  gm-silver-bullet-duelist and tk-shu-zhaoyun to Bluebeard's Last Bride and
  Goose-Girl of the Wind Meadow; in-reapers-due to Poisoned Comb. Keep
  in-doom-bolt until the matrix says otherwise; the tuning note says removal
  density is what lifted her from 19% to 46%.
- **R18 Abyssal Songstress (U/B)**: gm-black-cat-familiar to Eel-Twin;
  gm-batcloak-cutthroat to Swan-Feather Scout; gm-blood-opera-soloist to
  Frozen-Heart Sister; gm-ravenloft-heiress to Gerda of the Long Road;
  gm-black-veil-matron to Sugar-Cottage Witch; gm-stormglass-golem to Sea Witch
  of the Drowned Bargain; in-grave-chill to Laced Too Tight; keep in-undertow
  and in-doom-bolt. Empress of the Mirror Shards is her natural skyborne
  control threat.

### 5.3 R19 adoption list

Queen of the Lanterned Roof keeps all four Hauntlink carriers and the Kitsune
spine; the swaps target her 4x dt-sea-glass-knife (a bounce that never answers
anything) and her softest bodies:

- dt-sea-glass-knife x4 to Banished from the Ball x2 + Frozen to the Floor x2
  (answers, not tempo).
- yn-bluewire-illusionist x4 (or the weakest four Kitsune bodies by the
  builder's ranking) to Glass-Mountain Knight x2 + Frozen-Heart Sister x2:
  blockers that trade twice into Tides and Muster.
- yn-circuit-foretelling x4 to Duchess of the Lost Winter x2 + Frost-Sleigh
  Maiden x2: the filtering moves onto bodies that block.
- One yn-queen-of-the-lanterned-roof slot or yn-bastion-lantern slot to
  Swan-Lake Sovereign as a second sweep-proof finisher.

Why these cells: Tides (47) and Muster (66) are low because her early turns are
lanterns and 2/2s; Nine Lives blockers cost the aggressor two attacks each, and
a Ritual sever plus an Aura pacifism give her the two answers the Kitsune pool
does not print in W/U.

### 5.4 Measurement protocol (the one balance touch)

`scripts/balance-matrix.ts` (header and dispatch read 2026-08-21):

1. `npx tsx scripts/balance-matrix.ts --player-decks --seeds 40`: the 11
   shipped Warchest player decks round-robin, hard AI both sides (`--ai`
   defaults to hard), cell base 210_000. There is **no row filter** on this
   matrix; it is 55 cells, so 40 seeds is a fast probe and 200 seeds is the
   dated re-baseline.
2. `npx tsx scripts/balance-matrix.ts --avatars-reserve --only
   glass-coffin-queen,abyssal-songstress,queen-of-the-lanterned-roof --seeds 40`:
   the `--only` id filter IS plumbed into `runAvatarReserveMatrix` (dispatch
   line 1848), so this runs exactly rungs 17-19 against the 11 Warchest
   columns (33 cells). Cell seeds are keyed by (rung, column), so filtered runs
   reproduce the full-run cells.
3. After the gate flips, re-run both at 200 seeds plus `--avatars-darlings
   --only` the same three, because every `darlingsDeck` re-ranks (§6).

Lanes: commands 1 and 2 are one process each (~2.7 processes per shard per the
CPU note), so both may run together as two lanes under the 65% cap; never
alongside the vitest suite. Record before/after tables in the
`src/data/opponents.ts` header with the command, seeds, and game counts, per
the W7 convention.

---

## 5.5 Balance touch: the measured record (2026-08-22)

**Executed once, gate closed, on release/1.6 tip `6e724aa`.** Every number is
40 seeds/cell unless stated. Failures are retained here on purpose: this is the
evidence that decided what shipped.

**Correction to §5.4's sample description:** the player-decks matrix is now
**12 decks / 66 cells**, not the 11 / 55 the section states. Pride at the Ninth
Gate joined the ladder with Sands of the Duat.

### Midnight Storybook

| Build | Aggregate | Worst cell | Verdict |
| --- | ---: | ---: | --- |
| Shipped cross-set shell (baseline) | 55.5% (244/440) | 38% | already inside the 45-60 band |
| §5.1 dt-native rebuild (decision 2A) | **31.4%** (138/440) | **10%** | **REJECTED** |
| Option B, 8 filler copies swapped (decision 2B) | **58.2%** (256/440) | 40% | **ACCEPTED** |
| Option B re-confirmed at 200 seeds | **57.5%** (1266/2200) | 40% | **SHIPS** |

The dt-native rebuild missed the band floor by 13.6pp, which is **6.2 standard
errors** over 440 decided games, so it is not seed noise; it also broke the
"no cell under 20" rule three times (Pride 10%, Burning Tides 15%, Crimson
Muster 18%). A 200-seed confirmation was not spent on a result that far out.

Option B swaps exactly eight copies, every one at **identical mana value and
colour**, leaving the removal spine, the W splash and the curve untouched:

- `dt-foam-silk-siren` x4 (mv4 2/3 U skyborne) to `dt-empress-of-the-mirror-shards` x2 + `dt-frost-sleigh-maiden` x2 (both mv4 2/4 U skyborne, one also untouchable, both Skim)
- `dt-tower-window-seer` x2 (mv3 1/3 U Skim) to `dt-tide-sister-of-the-deep` x2 (mv3 1/3 U skyborne Skim)
- `dt-gilded-stepmother` x2 (mv3 2/2 B) to `dt-glass-coffin-sleeper` x2 (mv3 2/2 B, Nine Lives + dies:grind)

The 200-seed confirmation §5.4 reserves for an in-band result was run and
agrees with the probe (57.5% against 58.2%, same 40% worst cell, 13,200
games, zero draws, zero engine exceptions).

Mana parity was deliberate. The first draft of this swap moved four mv3 slots to
mv4, and curve creep is a plausible contributor to the dt-native collapse;
holding mana value constant makes this a test of card quality, not of curve.

### Rungs 17-19

Builder baseline, then each allowed iteration. The floors are the shipped
`tests/ai/winrate.test.ts` values.

| Rung | Baseline | Iteration 1 | Iteration 2 | Floor | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| R17 Glass-Coffin Queen | 76% | - | - | 70.5 | **79%, KEPT** |
| R18 Abyssal Songstress | 86% | 66% | 73% | 77.5 | **REVERTED** |
| R19 Queen of the Lanterned Roof | 60% | 55% | 51% | 55.5 | **REVERTED** |

R17's §5.2 list swapped 22 of 40 cards and gained 3pp. R18's swapped **26 of
40** and lost 25pp: it traded the deck's two best bodies
(`gm-black-veil-matron` 4/3 skyborne+dreaded, `gm-blood-opera-soloist` 3/3
dreaded+bloodoath) for a 2/1 skyborne and a 2/2 vanilla, and the loss was
uniform across all twelve columns and worst against aggro. Iteration 1 restored
the Matron (+5pp) and iteration 2 the Soloist (+7pp), which was not enough.
R19 lost its cheap filtering and never recovered; iteration 2 moved it further
down. Both exhausted the two-iteration allowance, so the standing rule decided
them: **a hand tune only holds while it still measures better than the
builder** (the rule that dropped Hel's first tune, 21 vs 33).

`HAND_TUNED_WARCHEST` is therefore `{morgan, hel, glass-coffin-queen}`.
R20 Kitsune Neon Tyrant measured **89%** as an unchanged control in the same run.

### What this says about the wave

The companion wave's balance premise did not hold. It was slated partly to close
Midnight Storybook's documented thin-pool debt, and an all-`dt-` Midnight is
**24pp worse** than the cross-set build. The wave's value is collection, the
achievement family, draft depth and set identity, not raising the power ceiling;
a themed pool measuring below a cross-set goodstuff pile is not a defect, but it
must not be sold as a balance fix. Owner ruling 2026-08-22: **the flip proceeds
as planned.**

**Owed at the flip (PR B):** the builders cannot reach companion cards while the
gate is closed, so R17's exemption was measured against the gate-closed builder.
The flip must re-test R17 against the gate-**open** builder and drop the tune if
it no longer wins.

**Two latitudes in §5.2/§5.3 that were not exercised**, recorded so they are not
mistaken for oversights: Empress of the Mirror Shards is named as R18's "natural
skyborne control threat" with no card to cut, so she was never added there (she
is in the accepted Midnight list instead); and §5.3's "one Queen slot or one
Bastion Lantern slot" for Swan-Lake Sovereign was resolved as Bastion Lantern
4 to 3, in the list that was ultimately reverted.

---

## 6. Ripples and gating (for the implementation contract)

**Liveness gate, minimal shape (read against `src/data/liveness.ts` and
`src/config/features.ts`, 2026-08-21).** The wave shares `set: 'dark-tales'`
with the shipped 120, so the set-level gate cannot distinguish it; the gate must
be an id set:

```ts
// src/config/features.ts
dtCompanionLive: false,   // Dark Tales companion wave; flips with its balance pass

// src/data/liveness.ts
import { DARK_TALES_COMPANION } from './cards/dark-tales-companion';
const DT_COMPANION_IDS: ReadonlySet<string> = new Set(DARK_TALES_COMPANION.map((c) => c.id));
export function isLiveCollectible(card: CardDef): boolean {
  if (card.token || card.supertypes?.includes('basic')) return false;
  if (DT_COMPANION_IDS.has(card.id)) return FEATURES.dtCompanionLive;
  return String(card.set) !== DUAT_SET || FEATURES.duatLive;
}
// isLiveSet is unchanged: 'dark-tales' stays live, so the binder filter,
// shop strip, and set booster keep working; the booster simply cannot roll a
// gated card because packPool consults isLiveCollectible.
```

`catalog.ts`: add `{ set: 'dark-tales', cards: DARK_TALES_COMPANION }` to
`SET_GROUPS` directly after `DARK_TALES`. No import cycle: the new cards file
imports only `engine/types` and `cardTypes`; `liveness.ts` importing a cards
file is new but acyclic (`catalog.ts` imports `liveness.ts`, never the
reverse). The `CardDef.set` union does not widen. `src/dev/cheats.local.ts`
gets a `dtCompanionLive` toggle beside `duatLive` (local file, not committed).
`tests/meta/duatLiveness.test.ts` gets a companion twin.

**Every consumer the sprinkle and Duat waves taught us about:**

| Consumer | What the wave touches | When |
| --- | --- | --- |
| `src/data/cards/dark-tales-companion.ts` | NEW, exports `DARK_TALES_COMPANION` (60 rows, `as const satisfies readonly CardDef[]`), `dt-` prefix, `set: 'dark-tales'` | with data |
| `src/data/catalog.ts` `SET_GROUPS` | one entry | with data |
| `src/data/liveness.ts`, `src/config/features.ts` | the gate above | with data |
| `tests/data/catalog.test.ts` | the prefix-convention and one-set-membership tests must know the new file; mana value 1-8 and P/T 0-10 hold for every row | with data |
| `tests/data/dark-tales.test.ts` | `DARK_TALES` stays 120 and the Mermaid count stays 4 (separate array); `applyFilters(set: 'dark-tales')` equals `DARK_TALES` only while gated (collectionFilter consults `isLiveCollectible`); at flip the expectation becomes the union, and the Midnight precon pin changes if the classic list is rebuilt | with data, again at flip |
| `scripts/check-art-bible.ts` `FILE_MAP` | the `dark-tales.md` entry must list `DARK_TALES_COMPANION` beside `DARK_TALES` and the tokens; 60 hand-authored 13-field entries are therefore required with the data, like the Duat waves | with data |
| `scripts/gen-darktales-artbible.ts` | regenerates the WHOLE bible with draft prose from the spec table in docs/expansions/dark-tales.md and reads Subject from that table; it would overwrite the hand-authored entries. Recommend retiring it (decision 6) | with data |
| `scripts/gen-spell-art.ts` `EXPECTED_IDS` + `docs/spell-art.md` | 20 non-creature rows (The Twelve Dancing Heiresses, Poisoned Comb, Ball Before Midnight, Banished from the Ball, Casita Hearth, Drowned Library, Laced Too Tight, Carpet Escape, Chart the Reef Road, Rose-Thorn Parry, Hearth Blessing, Sunrise Over the Ballroom, Drown the Pages, Second Verse, Frozen to the Floor, Apple-Half Exchange, Shadow-Miner's Dirge, Ember-Lantern Toss, Grandmother's Remedy, Pumpkin-Shell Lantern). Recommend they join the roster (decision 5) | with art |
| `src/data/attackFx.ts` `ATTACK_FX_MAP` | 40 creature entries (46 `dt-` entries today) | with data |
| `src/meta/Achievements.ts` | `theme-dark-tales-25/50/complete/skim/retell/mermaids/bloodoath` are predicate-based over the live pool and re-scope themselves at flip ("Own every Dark Tales card" grows from 120 to 180); `DARK_TALES_HEADLINERS` may add the two UR (a copy change, no save bump) | at flip |
| `src/data/starterDecks.ts` `theme-dark-tales` | §5.1 list into `reserveCards`/`landReserve` (decision 2) | with the balance touch |
| `src/data/opponents.ts` R17-R19 | §5.2-5.3 swaps and dated before/after blocks | with the balance touch |
| `tests/data/avatarReserveDecks.test.ts` | committed reserve/Darlings data must equal the deterministic builders; the builders read `isLiveCollectible`, so nothing moves while gated, and at flip EVERY avatar's `reserveDeck` and `darlingsDeck` may re-rank (regenerate, or extend `HAND_TUNED_WARCHEST` for the three hand-touched rungs with the dated reason) | at flip |
| economy gates (`scripts/progression-sim.ts` canonical block, `collectionPct` absolute-cards) | unchanged while gated; the live collectible pool grows 1,019 to 1,079 at flip, so re-run and re-date | at flip |
| `balance/cards.sqlite` | `npx tsx scripts/blades-db.ts build` after the data lands; no new TERMS rows (no new keyword or mechanic), so `terms --check` is a no-op | with data |
| `docs/expansions/dark-tales.md` | the 60 rows appended as a "Companion wave" section so the spec-mirroring convention holds (decision 6); its stale "not implemented" header is re-dated at the same time | with data |
| `docs/plan-1.6-large-set.md` gate item 7, `docs/roadmap.md`, README "What's new" | status lines at each stage | per stage |

Nothing here bumps `SaveData.version`: no new durable counter is needed, and
card additions never touch the save schema.

---

## 7. Owner decisions (A is the recommendation)

1. **Returning-mechanic trio.** A: Nine Lives + Preserve + Empower as
   specified (19 carriers at c/r, all validator-legal beside Skim). B: Nine
   Lives + Preserve + one rare Quest enchantment ("a tale in three nights":
   grind self 2 / raise top / boost allYours +1/+1) in place of Casita Hearth,
   keeping Empower for a later set.
2. **Midnight Storybook.** A: rebuild the reserve list dt-native per §5.1 and
   let the 200-seed `--player-decks` re-baseline decide whether it ships;
   classic `cards` untouched behind `classicRetired`. B: keep the shipped list
   and swap only the eight filler DT bodies for wave bodies, preserving the
   measured 56.9% shell.
3. **R17/R18 splash.** A: swap the Gothic bodies for the §5.2 rows and keep
   in-doom-bolt / in-undertow until the matrix clears them, because removal
   density is what rescued both rungs. B: leave both lists alone until the flip
   re-baseline shows movement, and only then touch them.
4. **UR count.** A: 2 UR (Swan-Lake Sovereign, Sea Witch of the Drowned
   Bargain). B: 3 UR by promoting Thorn Fairy, Uninvited and adding a mono-B SSR
   body, keeping the booster's UR density at the shipped 4.2%.
5. **Spell-art roster.** A: the 20 non-creature rows join `gen-spell-art.ts`
   `EXPECTED_IDS` so their art rides the standard driver and the checker. B:
   one-off drivers, as the shipped Dark Tales spells were done.
6. **Where the rows live.** A: append the 60 rows to
   docs/expansions/dark-tales.md as a companion section, retire
   `scripts/gen-darktales-artbible.ts` (its draft-prose regeneration would
   clobber hand-authored entries), and hand-author the 60 bible entries. B:
   keep this plan as the only row source and teach `check-art-bible.ts` to read
   `DARK_TALES_COMPANION` directly, leaving the generator for the shipped 120.

---

### Vocabulary verified

Every keyword, op, field, trigger, and target used above exists in
`src/engine/types.ts` (read 2026-08-21):

- `Keyword` union (line 6): skyborne, wardingGaze, firstBlade, warcry,
  sentinel, bulwark, deathblade, bloodoath, untouchable. Not used: twinBlades,
  overrun, dreaded.
- `EffectOp` union (line 62): `damage` (to `target`, `opponent`,
  `controller`), `gainLife`, `loseLife` (who `opponent`), `draw`,
  `discardRandom` (who `opponent`), `destroy` (to `target`), `sever` (to
  `target`), `boost` (scope `target` / `allYours`, with `keywords`),
  `extraLandDrop`, `createToken`, `grind` (who `self`), `foresee`. Not used:
  severGrave, severTop, recall, destroyArtifactOrSeverEnchantment, cancel,
  addCounters, tap, destroyNewestOpponentArtifactOrEnchantment, massDestroy,
  preventCombat, reclaim, awaken, raise.
- `TriggerWhen`: spell, arrives, dies, dawn, static. Triggers never target:
  every arrives/dawn/dies op list above is target-free.
- `TargetSpec.what`: creature, any.
- `CardDef` fields: `supertypes: ['legendary']` on all eight multicolor rows
  and Empress of the Mirror Shards; `skim {cost}`; `retell {cost}` (no ops
  override, Rituals and Charms only); `preserve {cost}` (creatures only, no
  Hauntlink); `nineLives: true` (creatures only, no Hauntlink); `empower {cost,
  ops}` (never beside Retell or X); `subtypes: ['Aura']` with an attached static
  (`scope: 'attached'`, p -1, grantKeywords bulwark). No `chapters`, `awakening`,
  `hauntlink`, `rite`, or `x` anywhere. No `filter` static, so no Axis
  governance question (Tide-Sister carries the existing Mermaid subtype only as
  a subtype).
- Tokens: `tok-hearth-spirit`, `tok-masked-guest`, `tok-firefly`,
  `tok-shadow-miner` (all in `tokens.ts`, `token: true`).
- Ids: 60, unique, kebab-case, `dt-` prefix, none present in the shipped 120 or
  anywhere in `CARD_DB` (checked 2026-08-21 against the scratch dump and
  `src/data/cards/`).
