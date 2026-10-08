<!-- source-of-truth: scripts/audit-overlap.ts, tests/scripts/auditOverlap.test.ts, src/data/cards/, src/power/scoreCore.ts, src/data/opponents.ts, src/data/starterDecks.ts, src/data/darlingsPrecons.ts, src/data/duatArchetypeDecks.ts · last-verified: 2026-10-08 · D8 of plan-1.9: the rule and the slate RULED 2026-09-28; the slate is APPLIED in the 1.9.1 patch -->

# D8: the older-set near-duplicate review (proposed and ruled 2026-09-28)

**Status: APPLIED in the 1.9.1 patch** (2026-10-08): all 41 rows are in the card data as drafted,
every rendered text and Δ matching its row. **RULED 2026-09-28** (the owner's second 1.9 sitting).
The rule is approved as written and the whole slate as drafted: the 41 cards, A1 to A33 and B1 to
B8, with no row's text changed by a ruling. Plan-1.9 ruling D8 (2026-09-25): the older-set near-duplicates get a whole-pool review and a
resolution plan; the owner approves the rule (which kinds of sameness are acceptable) and the slate;
the fixes ship in a 1.9.x patch, not in 1.9.0 (they shipped in 1.9.1). The owner's
questions are at the end, each with its answer; two leave follow-ups (D11, a one-sided tribe rescue
of about seven cards, not drafted; D12, four out-of-band cards, to the balance track).

## How it was measured

- **Pool:** `release/1.9` at 4290e37, the comparator's own count: 1,482 collectible cards, 1,444 of
  them non-land.
- **Tool:** `npx tsx scripts/audit-overlap.ts all`, with the new LADDER pass (below). The passes this
  review reads: IDENTICAL (45 clusters), SAME TEXT (77), REDESKIN (57), LADDER (159 groups, 106 of
  them holding two cards from one set), SPEED, and STRICTLY-WORSE TWIN.
- **Scores:** the v4 scorer, `scoreCard` in `src/power/scoreCore.ts`. The fair band is
  Δ within ±0.75.
- **Decks:** every card was checked against the boss lists (`deck`, `reserveDeck`, `darlingsDeck` in
  `src/data/opponents.ts`), the starter and theme decks (`src/data/starterDecks.ts`), the Darlings
  precons (`src/data/darlingsPrecons.ts`) and the Duat archetype decks
  (`src/data/duatArchetypeDecks.ts`, which the balance matrix fields).
- **Verification:** the slate was applied in memory to the live pool and every check re-run on the
  result (numbers under "What the slate does to the pool"). A Fable review reproduced every Δ, the
  new domination pairs, the twin and Charm counts and the rendered text of the first draft; this
  draft folds in its fixes.

### What the comparator sees, and what it does not

The LADDER pass (`statLadders` in `scripts/audit-overlap.ts`) groups cards whose **card data** matches
once the stat line, every mana cost (printed, rider, Duty), the size of every effect (Foresee 1
against Foresee 3, +1/+3 against +3/+3, cost 2 or less against 3), every tribe and legendary status
are set aside. It keeps an effect's sign, so a -2/-2 removal never groups with a +2/+2 pump. It keeps
op order, except that a run of ops whose order never matters (mill, discard, life loss and gain) is
compared as a set; "Foresee 1, then draw a card" never matches "draw a card, then Foresee 1".
Numbers in a condition or a Rite count are kept, since they gate a card rather than size it. For
every pair it reports whether the two share a set, a printed cost and a tribe and legendary status,
and whether one dominates the other; a winner's colours must fit inside the loser's (a colourless
card can beat a blue one, never the reverse). The domination test now also ranks a looser target
cap above a tighter one (The Price, cost 3 or less, over What the Sea Wants, cost 2 or less).

The same change fixes the STRICTLY-WORSE TWIN pass, which compared every printing only against the
lowest mana value in its group and so missed a heavier-pip printing at the same mana value ({2}{R}{R}
against {3}{R}). It now finds 14 dead printings where it found 10.

**Limits that remain,** so every count below is a floor:

- Two texts that say the same thing through different ops, or through ops in a different order
  outside a commuting run, key apart.
- A card that adds a rider to another card's text is a different text, so the rule below does not
  see it: Still Harbour (DD C, cancel cost 2 or less) under Cold Current (DD SR, cost 3 or less, plus
  Whispers) is one such pair inside one set.
- A paid-off tribe or legendary status tells a pair apart whichever card carries it (the 2026-08-31
  ruling). Nine pairs are told apart only by a tribe on the winning card (question 11).
- The DOMINATED pass (920 pairs) holds cards whose text differs by more than numbers. Those are
  "just better" cards, a costing question, and outside the rule.
- The scorer does not price a Skim or Retell cost, or a target's `maxCost` (10 cards carry one).

## The rule (approved 2026-09-28)

Two cards are **the same text** when the LADDER pass groups them, or when the SPEED pass finds a Charm
that does everything a Ritual does. For every such pair:

1. **Across sets, sameness is acceptable,** reprints included (Court Archer and Grave Gardener), with
   one exception: **a strictly-worse twin.** That is a card with the same text as another that costs
   more somewhere (printed cost, rider or Duty) and is no bigger anywhere, where the dead card is **at
   least as rare** as the card that beats it and has no paid-off tribe or legendary status the other
   lacks. A rare that is a worse copy of a common is a mistake; a common that is a worse copy of a rare
   is a rarity upgrade, and stays. A bigger number at the same price across sets (a 3/3 where another
   set prints a 2/3) is the ordinary variety of a pool built over years; the scorer prices it, and D8
   leaves it alone.
2. **Within one set, a paid-off tribe or legendary status tells two printings apart** (the 2026-08-31
   one-printing-per-set ruling; two legendary cards with different names share a legendary status).
   Two printings with the same tribe and legendary status:
   - **may not have one beat the other:** a bigger stat line, a bigger effect, a looser target cap, a
     cheaper price or Charm speed, whatever the rarities (the 2026-09-24 Drowned Deep rarity ladders
     were fixed on the same ground);
   - **may trade off only when the text is keywords alone.** A keyword-only body's stat line is the
     card, so a 3/2 and a 2/3 at one cost are two cards. When the two share an ability and differ only
     in stats or a price, they read as one card (Ocean Wayfinder and Tide-Reader of the Far Reef);
   - **may differ in an effect's size when neither beats the other,** as the approved 2026-09-24 slate
     did with Drowned Scholar of the Reach (draw 2, discard 2) against Low Street Looter;
   - **may sit on a curve or a colour cycle:** the same text at another printed cost with a different
     stat line, or in another colour, when neither beats the other.
3. **Resolutions:** the smallest lever first (a rider, then a rewording, then a stat change, then a
   cost change); ids, art, rarity and set stay; no card is deleted; every changed card lands inside
   ±0.75. **No cascade:** a fix may not make its card beat another card of the same or higher rarity
   that shares its text elsewhere in the pool (the 2026-08-31 lesson: every stat buff cascaded, every
   drawback held). A drawback keyword is a lever only on a card that is otherwise no smaller than its
   rival; on the smaller card it makes the loser worse still. A keyword-only body is therefore usually
   fixed with a stat trade, which rule 2 accepts, and an ability card with a rider.

### What the rule accepts, by name

- **45 IDENTICAL clusters,** all across sets (none inside one set), Court Archer = Grave Gardener among
  them.
- **Cross-set bigger numbers at the same price: 32 pairs** today (27 distinct beaten cards), for
  example Castle Blackguard (3/2 Deathblade) over Poisoned Courtier and Void-Blood Scavenger (2/2),
  Grail Glimpse (Foresee 4) over Circuit Foretelling and Silt Reading, Wild Surge over Rose-Vine
  Snare, Orbit Breaker over Breakwater Veteran, and Blessed Respite (gain 4, Charm) over Censer of the
  Last Gate (gain 3, Ritual).
- **Twins beaten by a rarer card:** Ogham Fate-Stones (SR) over Chrome Medallion (C), Hellion of the
  Redshift (SSR) over Redline Oni Queen (SR, both legendary), The Drowned Ledger (R) over Drown the
  Pages (C).
- **Colour identity:** Tide-Glass costs {1} but is a blue card, and Chrome Medallion is colourless, so
  Tide-Glass cannot be the upgrade for a deck without blue.
- **Six keyword-only trade-offs inside one set:** Jia Chong / Sima Zhao, Wildwood Bearkin / Squirrelkin
  Hoarder, Iris / Nike (Base), Current-Bend Navigator / River-Sky Reader (Duat), Reef Crab / Tidepool
  Wall (Drowned Deep), Berserker Initiate / Raiding Shieldmaiden (Ragnarok).

## The slate

The rule rejects **51 pairs** today (46 in the first draft; the looser-cap test adds The Price over What
the Sea Wants and over The Deep Collects, and the tightened twin definition adds Lake Attendant under
Star Reader, Current-Caller under Velvet Void Cartographer and Row Against the Hour under Prism
Current). The slate changes **41 cards**: 33 fix a pair inside one set (A1 to A33) and 8 fix a
strictly-worse twin across sets (B1 to B8). Two changes fix more than one pair: Wreck-Runner (B1)
frees four older commons, and Signal Bridge (B4) frees two.

| Set | Same set | Across sets | Cards |
| --- | --- | --- | --- |
| Sands of the Duat | 12 | 0 | 12 |
| Drowned Deep | 4 | 4 | 8 |
| Starborne | 5 | 0 | 5 |
| Dark Tales | 3 | 1 | 4 |
| Yokai Nights | 3 | 1 | 4 |
| Arthurian Court | 1 | 2 | 3 |
| Ragnarok | 2 | 0 | 2 |
| Gothic Monsters | 2 | 0 | 2 |
| Base | 1 | 0 | 1 |
| Celtic Fae | 0 | 0 | 0 |
| **Total** | **33** | **8** | **41** |

Rules text below is what the game renders from the proposed data. Δ is the v4 score before and after.
"Generated Darlings lists" are boss `darlingsDeck` lists the generator builds from the pool; a change
can move a slot in them. Every other deck named is hand-built and measured.

### A. Inside one set

| Row | Card | Set | Beaten by, or paired with | Lever | Now | Proposed | Δ | Decks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Court Minstrel `ac-court-minstrel` | Arthurian Court C | Lady of Lilies (R, 3/3). Satisfies the comparator more than the design: see question 8 | rider | {4}{U} · 2/2<br>During your Dawn: While a Quest is active, draw a card. | {4}{U} · 2/2<br>When this arrives, Foresee 1.<br>During your Dawn: While a Quest is active, draw a card. | -0.07 → 0.23 | none |
| A2 | Holo-Lantern Adept `yn-holo-lantern-adept` | Yokai Nights C | Lantern Fixer (R, 2/2) | keyword | {1}{W} · 2/1<br>When this arrives, Foresee 1. | {1}{W} · 2/1<br>Sentinel<br>When this arrives, Foresee 1. | 0.06 → 0.36 | none |
| A3 | Mycelial Star Gardener `sb-mycelial-star-gardener` | Starborne C | Radiant Moss Mender (R, 3/3) | keyword | {2}{G} · 2/2<br>When this arrives, Mark another target creature. | {2}{G} · 2/2<br>Warding Gaze<br>When this arrives, Mark another target creature. | -0.23 → -0.03 | boss Chrome Broodmother (deck+reserve+darlings); theme Chrome-Violet Broodship (classic+reserve) |
| A4 | Natron Kit-Caller `sd-natron-kit-caller` | Sands of the Duat C | Linen Processioner (C, 2/3) | effect size | {2}{W} · 1/2<br>When this arrives, create one 1/1 Lion-Gate Kit token. | {2}{W} · 1/2<br>When this arrives, create two 1/1 Lion-Gate Kit tokens. | -0.45 → 0.42 | none |
| A5 | Ninth-Step Duelist `sd-ninth-step-duelist` | Sands of the Duat C | Sand-Pawed Guard (C, 2/1) | keyword | {1}{W} · 1/1<br>Nine Lives. | {1}{W} · 1/1<br>First Blade<br>Nine Lives. | -0.05 → 0.37 | Duat archetype Nine Lives at Dusk; 2 generated Darlings lists |
| A6 | Two Jars, One Heart `sd-two-jars-one-heart` | Sands of the Duat C | The Debt Is Called (C, Retell {2}{B}). Lands one Retell and one mill away from The Wharf's Due (DD C) | reword | {B} · Ritual<br>Put the top 2 cards of your deck into your graveyard, then your opponent loses 1 life.<br>Retell {3}{B}: You may cast this from your graveyard, then sever it. | {B} · Ritual<br>Put the top 2 cards of your deck into your graveyard, then your opponent discards a card at random.<br>Retell {3}{B}: You may cast this from your graveyard, then sever it. | 0.96 → 0.54 | Duat archetype The Copy Kept in Linen |
| A7 | White-Crown Marshal `sd-white-crown-marshal` | Sands of the Duat R | White-Gate Adjudicator (SR, 3/5). Satisfies the comparator more than the design: see question 8 | rider | {4}{W}{W} · 3/4<br>Sentinel<br>During your Dawn, create one 1/1 Lion-Gate Kit token. | {4}{W}{W} · 3/4<br>Sentinel<br>During your Dawn, create one 1/1 Lion-Gate Kit token, then you gain 1 life. | 0.01 → 0.41 | 1 generated Darlings list |
| A8 | Ash-Coil Prowler `sd-ash-coil-prowler` | Sands of the Duat C | Barge-Deck Raider (C, 3/3) | stat trade | {2}{R} · 3/2<br>(no rules text) | {2}{R} · 4/1<br>(no rules text) | -0.28 → -0.18 | 1 generated Darlings list |
| A9 | Bao Sanniang, Cat-Loving Duelist `tk-shu-baosanniang` | Base C | Ma Dai, Reliable Shadow (C, 2/2) | keyword | {1}{G} · 2/1<br>(no rules text) | {1}{G} · 2/1<br>Overrun | -0.40 → -0.10 | boss Lupa, Wolfqueen (deck+reserve+darlings); 1 generated Darlings list |
| A10 | Comet-Kick Marauder `sb-comet-kick-marauder` | Starborne C | Chrome Sunbreaker (R, 4/4); also frees Wrecker Mate (DD) from it | stat trade | {3}{R} · 4/3<br>Overrun | {3}{R} · 5/2<br>Overrun | 0.07 → 0.17 | boss Chrome Broodmother (deck+darlings); theme Chrome-Violet Broodship (classic+reserve) |
| A11 | Cosmic Shieldmaiden `sb-cosmic-shieldmaiden` | Starborne C | Ivory Orbit Vanguard (R, 3/4) | keyword | {3}{W} · 3/3<br>First Blade | {3}{W} · 3/3<br>First Blade, Sentinel | 0.15 → 0.45 | none |
| A12 | Jotun Warleader `rg-jotun-warleader` | Ragnarok R | Bergelmir, Earthshaker (SR, 5/5) | stat trade | {4}{G} · 4/5<br>Overrun | {4}{G} · 6/4<br>Overrun | -0.35 → 0.23 | theme Valhalla's Muster (classic) |
| A13 | Palm-Root Warden `sd-palm-root-warden` | Sands of the Duat C | Floodgate Warden (R, 3/5) | stat trade | {3}{G} · 3/4<br>Warding Gaze | {3}{G} · 4/3<br>Warding Gaze | -0.13 → -0.03 | none |
| A14 | Plaguebearer Draugr `rg-plaguebearer-draugr` | Ragnarok C | Barrow-Wight (R, 4/3) | stat trade | {3}{B} · 2/3<br>Deathblade | {3}{B} · 1/5<br>Deathblade | -0.49 → -0.06 | boss Hel, Queen of Mist (deck+reserve); theme Valhalla's Muster (classic+reserve); Darlings precon Queen Below |
| A15 | Shrine-Vine Warden `yn-shrine-vine-warden` | Yokai Nights C | Moss Oni Guardian (R, 3/5) | stat trade | {3}{G} · 3/4<br>Sentinel | {3}{G} · 4/3<br>Sentinel | -0.03 → 0.07 | none |
| A16 | Stitched Footman `gm-stitched-footman` | Gothic Monsters C | Screaming Staircase (C, 1/5) | reword | {1}{U} · 1/4<br>Bulwark | {1}{U} · 1/4<br>(no rules text) | -0.37 → 0.33 | 7 generated Darlings lists |
| A17 | Sun-Rope Charger `sd-sun-rope-charger` | Sands of the Duat C | Emberwake Runner (C, 2/2) | stat trade | {1}{R} · 2/1<br>Warcry | {1}{R} · 1/3<br>Warcry | -0.05 → 0.20 | 2 generated Darlings lists |
| A18 | Widow of the West Wing `gm-widow-of-the-west-wing` | Gothic Monsters R | Black-Veil Matron (SR, 4/3) | stat trade | {3}{B} · 3/3<br>Skyborne, Dreaded | {3}{B} · 2/4<br>Skyborne, Dreaded | 0.73 → 0.36 | Darlings precon Queen Below; Darlings precon Mirror-Blood Rush; 5 generated Darlings lists |
| A19 | Bookside Ferrywoman `sd-bookside-ferrywoman` | Sands of the Duat C | Bend-of-the-River Pilot (C, 3/3); same ability, stats trade. Becomes a reprint of Drowned Deep's Tidewater Scholar | reword | {3}{U} · 2/4<br>When this arrives, Foresee 1. | {3}{U} · 2/4<br>When this arrives, draw a card, then discard a card. | -0.51 → -0.43 | none |
| A20 | Deep One Acolyte `dd-deep-one-acolyte` | Drowned Deep C | The Drowned (C, 2/1); same ability, stats trade | rider | {1}{B} · 1/3<br>When this arrives, put the top card of your deck into your graveyard. | {1}{B} · 1/3<br>When this arrives, put the top card of your deck into your graveyard, then your opponent loses 1 life. | 0.06 → 0.44 | none |
| A21 | Tide-Reader of the Far Reef `dt-tide-reader-of-the-far-reef` | Dark Tales SR | Ocean Wayfinder (SR, 3/4, Skim {2}); same ability, body against Skim price | reword | {2}{U}{G} · 2/4<br>Skim {1}<br>When this arrives, you may play an additional land this turn, then Foresee 1. | {2}{U}{G} · 2/4<br>Skim {1}<br>When this arrives, Foresee 2, then draw a card. | -0.19 → 0.27 | none |
| A22 | Flare-Orbit Captain `sb-flare-orbit-captain` | Starborne R | Ember-Orbit Exarch (SR, {3}{R}); Storm Horror (DD C) across sets | stat trade | {2}{R}{R} · 4/3<br>Warcry | {2}{R}{R} · 5/2<br>Warcry | -0.32 → -0.12 | none |
| A23 | The Deep Collects `dd-the-deep-collects` | Drowned Deep C | What the Sea Wants (C, Charm with Whispers); The Price (R) | rider | {2}{B} · Ritual<br>Destroy target creature with cost 2 or less. | {2}{B} · Ritual<br>Destroy target creature with cost 2 or less, then put the top 2 cards of your deck into your graveyard. | -0.06 → 0.24 | none |
| A24 | Circuit Foretelling `yn-circuit-foretelling` | Yokai Nights C | Foresee the Fall (R, Charm, Foresee 3) | effect size | {U} · Ritual<br>Foresee 2. | {U} · Ritual<br>Foresee 4. | -0.59 → -0.29 | boss Queen of the Lanterned Roof (deck+darlings); Darlings precon Queen Below |
| A25 | Silt Reading `sd-silt-reading` | Sands of the Duat C | Route Beyond the Gate (R, Charm, Foresee 3) | effect size | {U} · Ritual<br>Foresee 2. | {U} · Ritual<br>Foresee 4. | -0.59 → -0.29 | none |
| A26 | Row Against the Hour `sd-row-against-the-hour` | Sands of the Duat C | Read the Two Ways (C, {1}{U}, Foresee 3); The Last Chart of the Duat (SSR); Prism Current (SB C) across sets | rider | {U}{U} · Ritual<br>Foresee 1, then draw a card. | {U}{U} · Ritual<br>Foresee 1, then draw a card.<br>Retell {2}{U}: You may cast this from your graveyard, then sever it. | -0.17 → 0.65 | none |
| A27 | Satin Slipper `dt-satin-slipper` | Dark Tales C | Ragged Ballgown (C, gain 2) | reword | {1} · Ritual<br>Skim {1}<br>You gain 1 life. | {1} · Ritual<br>Skim {1}<br>Target creature you control gets +1/+1 until Sunset. | -0.24 → 0.18 | Darlings precon Sunwell Ledger; 4 generated Darlings lists |
| A28 | Singing Shell `dt-singing-shell` | Dark Tales C | Bookmark Charm (C, {1}, Foresee 2) | effect size | {U} · Ritual<br>Skim {1}<br>Foresee 1, then put the top card of your deck into your graveyard. | {U} · Ritual<br>Skim {1}<br>Foresee 2. | -0.24 → -0.24 | Darlings precon Queen Below; 2 generated Darlings lists |
| A29 | Lamp and Ledger `dd-lamp-and-ledger` | Drowned Deep C | Oil for the Lamps (R, gain 4) | speed | {2}{W} · Ritual<br>You gain 3 life, then draw a card. | {2}{W} · Charm<br>You gain 3 life, then draw a card. | 0.34 → 0.61 | none |
| A30 | Lapis-Route Seer `sd-lapis-route-seer` | Sands of the Duat C | Skyline Ferrywoman (R, 2/4, Foresee 2) | stat trade | {3}{U} · 2/3<br>Skyborne<br>Whenever this deals combat damage to a player, Foresee 1. | {3}{U} · 3/2<br>Skyborne<br>Whenever this deals combat damage to a player, Foresee 1. | 0.13 → 0.50 | none |
| A31 | Ward the Floodgate `sd-ward-the-floodgate` | Sands of the Duat C | Warding of the First Furrow (R, +3/+3) | effect size | {1}{G} · Charm<br>Target creature you control gets +1/+3 and gains Warding Gaze until Sunset. | {1}{G} · Charm<br>Target creature you control gets +2/+4 and gains Warding Gaze until Sunset. | -0.83 → -0.38 | Duat archetype Flood Measures the Sky |
| A32 | Sky Map `sb-sky-map` | Starborne C | Blue-Echo Array (R, Foresee 2) | reword | {1} · Ritual<br>Skim {1}<br>Foresee 1. | {1} · Ritual<br>Foresee 3. | 0.04 → 0.11 | 2 generated Darlings lists |
| A33 | What the Sea Wants `dd-what-the-sea-wants` | Drowned Deep C | The Price (DD R, cost 3 or less) | drawback | {2}{B} · Charm<br>Destroy target creature with cost 2 or less.<br>Whispers {1}{B}. | {2}{B} · Charm<br>Destroy target creature with cost 2 or less, then this deals 2 damage to you.<br>Whispers {1}{B}. | 0.76 → 0.43 | theme Lanterns Below (reserve) |

### B. Strictly-worse twins across sets

| Row | Card | Set | Beaten by, or what it beats | Lever | Now | Proposed | Δ | Decks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | Wreck-Runner `dd-wreck-runner` | Drowned Deep C | beats Muspel Emberkin (RG), Pumpkin Attendant (DT), Street Oni Scrapper (YN), Flarewing Raider (SB), all {1}{R} | drawback | {R} · 2/1<br>Warcry | {R} · 2/1<br>Warcry, Rage | 0.76 → 0.61 | 7 generated Darlings lists |
| B2 | Lake Attendant `ac-lake-attendant` | Arthurian Court C | Tide-Clerk (DD C, {1}{U}) | keyword | {2}{U} · 1/3<br>When this arrives, Foresee 1. | {2}{U} · 1/3<br>Skyborne<br>When this arrives, Foresee 1. | -0.56 → 0.21 | none |
| B3 | Mirror of Avalon `ac-mirror-of-avalon` | Arthurian Court R | Tide-Glass (DD C, {1}) | effect size | {U} · Artifact<br>During your Dawn, Foresee 1. | {U} · Artifact<br>During your Dawn, Foresee 2. | -0.31 → 0.14 | 2 generated Darlings lists |
| B4 | Signal Bridge `yn-signal-bridge` | Yokai Nights C | beats Read the Ruse (Base) and Hold the Crossing (Duat), both {1}{U}{U}. Null Route (YN R) then beats it in its own set: see question 6 | price match | {2}{U} · Charm<br>Cancel target spell. | {1}{U}{U} · Charm<br>Cancel target spell. | 0.26 → -0.01 | boss Queen of the Lanterned Roof (deck+reserve+darlings); Darlings precon Red Cliffs Refrain |
| B5 | Ember-Lantern Toss `dt-ember-lantern-toss` | Dark Tales C | Echo Burst (SB C, Retell {2}{R}) | price match | {1}{R} · Charm<br>Deal 2 damage to any target.<br>Retell {3}{R}: You may cast this from your graveyard, then sever it. | {1}{R} · Charm<br>Deal 2 damage to any target.<br>Retell {2}{R}: You may cast this from your graveyard, then sever it. | 0.03 → 0.03 | none |
| B6 | Squall-Witch `dd-storm-witch-lesser` | Drowned Deep C | Starfire Lancer (SB C, {2}{R}) | rider | {1}{R}{R} · 3/2<br>First Blade | {1}{R}{R} · 3/2<br>First Blade<br>When this arrives, tap target creature. | 0.31 → 0.61 | none |
| B7 | Forge-Master of the Reach `dd-drowned-forge-master` | Drowned Deep C | Orbit Breaker (SB C, {4}{R}) | reword | {3}{R}{R} · 4/4<br>When this arrives, deal 2 damage to target creature. | {3}{R}{R} · 4/4<br>When this arrives, deal 2 damage to any target. | -0.03 → 0.04 | none |
| B8 | Current-Caller `dd-current-caller` | Drowned Deep R | Velvet Void Cartographer (SB R, Foresee 2, Skim {1}) | stat trade | {2}{U} · 2/3<br>Skim {U}<br>When this arrives, Foresee 1. | {2}{U} · 3/2<br>Skim {U}<br>When this arrives, Foresee 1. | -0.10 → 0.00 | boss The Drowned Deacon (deck+reserve+darlings) |

### Why these levers

- **Stat trades (A8, A10, A12 to A15, A17, A18, A22, A30, B8).** Each is a keyword-only body or a card
  whose text is shared with reprints in other sets. A new keyword would make it beat those reprints
  (Palm-Root Warden plus Overrun beats Starborne's Solar Canopy Guardian; Sun-Rope Charger plus First
  Blade beats eight older 2/1 Warcry commons). A stat trade makes it the other half of an acceptable
  trade-off and beats nothing new.
- **One drawback (B1).** Wreck-Runner at {R} beats four older {1}{R} 2/1 Warcry commons. It is the
  cheaper card, so Rage costs it something without leaving it smaller than anything: with Rage it
  beats none of them and keeps its place as the Drowned Deep's red one-drop. A price match to {1}{R}
  would make it a reprint, but Wrecker's Lookout ({1}{R} 2/1 Warcry with Skim) would then beat it in
  its own set. The first draft also gave Rage to Comet-Kick Marauder and Sun-Rope Charger; both were
  the smaller card of their pair, so Rage only made them worse, and both now take stat trades.
- **Price matches (B4, B5).** Signal Bridge at {1}{U}{U} and Ember-Lantern Toss with Retell {2}{R}
  become reprints of the cards they matched, which rule 1 accepts (question 5).
- **Identity changes worth a look (question 7):** Tide-Reader of the Far Reef (A21) gives the extra
  land drop to Ocean Wayfinder and becomes the card-draw half of the pair; Stitched Footman (A16) loses
  Bulwark and can attack, while Screaming Staircase stays the wall; Sky Map (A32) trades its Skim for a
  bigger Foresee; Lamp and Ledger (A29) becomes a Charm; Singing Shell (A28) drops its mill for
  Foresee 2; Row Against the Hour (A26) gains Retell {2}{U}, the one change that beats neither Read the
  Two Ways, The Last Chart of the Duat nor Prism Current and is beaten by none of them.
- **A1 and A7 satisfy the comparator more than the design.** Court Minstrel gains an arrival Foresee
  and White-Crown Marshal a point of life each Dawn: enough that neither is a smaller copy of its
  rare, not enough to give either a job of its own (question 8).

## What the slate does to the pool

Measured by applying the slate in memory (scratch scripts over the exported comparator functions):

| Check | Before | After |
| --- | --- | --- |
| Pairs the rule rejects | 51 | 0 |
| Slate cards outside ±0.75 | 4 (Two Jars, One Heart +0.96, Wreck-Runner +0.76, What the Sea Wants +0.76, Ward the Floodgate −0.83) | 0 |
| Strictly-worse twins (STRICTLY-WORSE TWIN pass) | 14 | 2, both beaten by a rarer card (accepted) |
| Rituals a Charm outclasses (SPEED pass) | 5 | 1, Censer of the Last Gate, across sets (accepted) |
| Same-set IDENTICAL clusters | 0 | 0 |
| Same-set rules-identical printings, every subtype counted (the #436 catalog guard's rule) | 0 | 0 |
| Cross-set IDENTICAL clusters created | | 4 (below) |
| Accepted keyword-only trade-offs inside one set | 6 | 14 |

The four new cross-set reprint clusters: Signal Bridge = Read the Ruse = Hold the Crossing; Circuit
Foretelling = Silt Reading = Grail Glimpse (AC C); Ember-Lantern Toss = Echo Burst; Bookside Ferrywoman
= Tidewater Scholar (DD C). Sky Map leaves its old cluster with Brass Lamp Charm and Lapis Funerary
Mask, which stay a pair.

Four domination pairs are new after the slate, all in classes the rule accepts: Holo-Lantern Adept
(A2) over Lion-Gate Sentry and Bao Sanniang (A9) over Dire Wolf Pup, each told apart by a paid-off
tribe (Bastet, Wolf); Jotun Warleader (A12) over Delta Bull, a rare over a common across sets; and
Blue-Echo Array (SB R) over Singing Shell (A28), a rare over a common across sets.

## The known cases

- **The six same-tribe stat ladders of 2026-09-24:** Ragnarok's Jotun Warleader / Bergelmir (A12) and
  Plaguebearer Draugr / Barrow-Wight (A14); the Duat's Natron Kit-Caller / Linen Processioner (A4) and
  Palm-Root Warden / Floodgate Warden (A13); Starborne's Mycelial Star Gardener / Radiant Moss Mender
  (A3) and Cosmic Shieldmaiden / Ivory Orbit Vanguard (A11).
- **The two rider-price pairs:** Two Jars, One Heart (A6) and Tide-Reader of the Far Reef (A21).
- **The wave-0 comparator's finds:** Court Archer and Grave Gardener, accepted as a cross-set reprint;
  The Debt Is Called over Two Jars, One Heart (A6); Echo Burst over Ember-Lantern Toss (B5); The
  Drowned Ledger over Drown the Pages, accepted (a rare over a common across sets).
- **Found by the review's fixes:** The Price over What the Sea Wants (A33) and over The Deep Collects
  (A23).

## Cards in measured decks

No starter deck moves. These rows touch a hand-built measured list, so the boss floors and the matrix
field move with them:

- **Bosses:** Chrome Broodmother (A3 deck and reserve, A10 deck), Lupa, Wolfqueen (A9 deck and
  reserve), Hel, Queen of Mist (A14 deck and reserve), Queen of the Lanterned Roof (A24 deck, B4 deck
  and reserve), The Drowned Deacon (B8 deck and reserve).
- **Theme decks:** Chrome-Violet Broodship (A3, A10), Valhalla's Muster (A12, A14), Lanterns Below
  (A33 reserve).
- **Darlings precons:** Queen Below (A14, A18, A24, A28), Mirror-Blood Rush (A18), Sunwell Ledger (A27),
  Red Cliffs Refrain (B4).
- **Duat archetype decks:** Nine Lives at Dusk (A5), The Copy Kept in Linen (A6), Flood Measures the
  Sky (A31).
- **Generated Darlings lists** hold 17 of the 41 cards (counts per row in the tables); they re-sync
  from the generator.

## For the 1.9.x patch that applies it

- The Drowned Deep rows (A20, A23, A29, A33, B1, B6, B7, B8) are transcribed from
  `docs/expansions/drafts/drowned-deep-overplan.md`, and the transcription test reads those rows as
  the spec: edit the rows, not the test.
- Art-bible Card facts lines carry keywords and stat lines, and `check-art-bible` fails on a changed
  keyword: every row needs its line.
- Yokai Nights is compiled from JSON spec rows (A2, A15, A24, B4).
- The generated Darlings lists (`tests/data/avatarReserveDecks.test.ts`) will shift; re-sync them with
  a minimal edit.
- No rarity moves, so the locked per-set rarity histograms hold. No new keyword or mechanic, so
  `terms --check` has nothing new; rebuild the local corpus after the data edit.
- Measured decks move (above): the full ladder with the win-rate gates, on an idle machine.
- **What the rulings (2026-09-28) add to the patch:** the boss floors of the rows in measured decks
  are re-gated in it (D10); Court Minstrel (A1) and White-Crown Marshal (A7) get their taste pass
  while it is written (D8). Not in this slate: the one-sided tribe rescue (D11, a follow-up of about
  seven cards, not drafted, its timing open) and the four out-of-band cards (D12, the balance track).

## Seen on the way, not D8's to fix

- **Already outside the fair band and left alone:** The Debt Is Called (+0.96), Black-Veil Matron
  (+1.20, on nine boss lists, a theme deck and two Darlings precons), Still Harbour (+1.07) and Cold
  Current (+0.92). What the Sea Wants (+0.76) lands at +0.43 with A33, which the owner folded into
  the slate (question 6). The other four belong to the balance track (question 12, ruled).
- **Scorer blind spots:** Skim and Retell prices read the same at any cost (Skim {1} and Skim {2} both
  0.35), so B5's Retell change reads Δ 0.00 and A6's pair scored identically; `maxCost` is ignored, so
  "destroy target creature with cost 2 or less" prices as unrestricted removal.

## Proposed plan-1.9 text

For the comparator bullet in "Where 1.9 starts from", replacing its last two sentences ("No cluster
pass groups cards whose stat lines differ, so D8's stat ladders, and Ocean Wayfinder against
Tide-Reader of the Far Reef (Attack and Skim both differ), stay a manual read."):

> The domination pass also ranks a looser target cap as better (cost 3 or less over cost 2 or less).
> Wave 2 added the LADDER pass: it groups cards whose data matches once stats, prices and effect sizes
> are set aside (signs kept, commuting ops compared as a set), and reports each pair's set, cost,
> tribe and legendary status and any winner, whose colours must fit inside the loser's. The
> STRICTLY-WORSE TWIN pass now compares every printing, not only the cheapest. The D8 review reads
> both: [d8-near-duplicate-review.md](d8-near-duplicate-review.md).

For the D8 entry, appended: "Review and slate PROPOSED 2026-09-28 in
[d8-near-duplicate-review.md](d8-near-duplicate-review.md): 51 pairs, 41 cards; awaiting the owner's
rulings." (Both applied; the D8 entry now reads RULED, from the owner's second sitting.)

## Owner questions (recommendation first; RULED 2026-09-28)

The sitting's sheet numbered these D1-D12; each answer leads its question.

1. *Ruled (D1): approved.*
   **Approve the rule as written?** Recommended: yes. It keeps the 2026-08-31 one-printing-per-set
   ruling, generalises the 2026-09-24 rarity-ladder fixes, and accepts the Scholar and Looter slate.
   It still cannot see the limits listed under "How it was measured" (texts that differ only in op
   choice or order, added riders, the one-sided tribe rescue), so 51 is a floor.
2. *Ruled (D2): "Strictly Worse."* Only the strictly-worse twins, rows B1 to B8; the 32 accepted
   cross-set pairs stay accepted.
   **How far across sets?** Recommended: only strictly-worse twins (rows B1 to B8). The alternatives:
   nothing across sets (drop B1 to B8), or every same-text domination at the same or a lower rarity
   (adds the 32 accepted pairs above, 24 cards not already in the slate, not drafted).
3. *Ruled (D3): accept.*
   **Keyword-only trade-offs inside one set?** Recommended: accept them (the six pairs listed, and
   the eleven stat trades in the slate). Rejecting them adds six rows and forces riders on the stat
   trades, which then beat cross-set reprints.
4. *Ruled (D4): "Only on Wreck-Runner."* B1 as drafted.
   **Rage as a lever.** After the redraft it is used once, on Wreck-Runner (B1), the cheaper card of
   its pairs. Recommended: yes. The alternative is {1}{R}, which makes it a reprint but lets Wrecker's
   Lookout beat it in its own set. Rage on the smaller card of a pair (the first draft's A10 and A17)
   is withdrawn.
5. *Ruled (D5): accept.* The five reprints stand, B4 as drafted (Read the Ruse and Hold the
   Crossing are not touched).
   **Five cards become cross-set reprints** (Signal Bridge, Circuit Foretelling, Silt Reading,
   Ember-Lantern Toss, Bookside Ferrywoman; four new IDENTICAL clusters). Accept reprints as the fix,
   or differentiate? Recommended: accept; rule 1 accepts reprints, and each is the smallest lever. For
   B4 the alternative is to fix the two dead cards instead: Read the Ruse and Hold the Crossing become
   "Cancel target spell, then Foresee 1." (Δ −0.01 → +0.44 each), leaving Signal Bridge alone. That
   keeps Signal Bridge out of Null Route's shadow in Yokai Nights, but it touches a starter deck (Read
   the Ruse is in Shadow Mandate), the Yohime boss list and two precons, where B4 touches one boss list
   and one precon. Recommended: B4 as drafted; Null Route beating it is a rare with an extra line, the
   costing class the rule leaves alone.
6. *Ruled (D6): "Fold into fix."* The row that changes is A33, kept in the slate as drafted: What
   the Sea Wants gains "then this deals 2 damage to you" (Δ 0.76 to 0.43), and the Lanterns Below
   reserve list carries the new text. No other row changes: A23 (The Deep Collects, the other card
   The Price beat) was already in. The slate stays 41 cards.
   **The Price over What the Sea Wants:** fold A33 into this slate (recommended: it separates the pair
   and brings What the Sea Wants from +0.76 into the band), or send it to the balance track with the
   other out-of-band cards?
7. *Ruled (D7): yes.* A16, A21, A26, A28, A29 and A32 as drafted.
   **The identity changes** (Tide-Reader loses the land drop, Stitched Footman loses Bulwark, Sky Map
   loses Skim, Lamp and Ledger becomes a Charm, Singing Shell loses its mill, Row Against the Hour
   gains Retell)? Recommended: yes; each alternative tried either left the pair one card or made a new
   near-duplicate.
8. *Ruled (D8): approve.* A1 and A7 are approved for the patch, and both get a taste pass when the
   patch is written.
   **A1 Court Minstrel and A7 White-Crown Marshal** pass the comparator without gaining a real job.
   Recommended: approve them for the patch, and give both a taste pass when the patch is written.
9. *Ruled (D9): 1/5.* A14 as drafted.
   **Plaguebearer Draugr (A14):** 1/5 (recommended: no cascade) or "When this dies, your opponent loses
   2 life" (Δ +0.11, more flavour, but it makes Yokai Nights' Shrine-Debt Enforcer a strictly worse
   card). It sits in Hel's deck and reserve either way.
10. *Ruled (D10): "Re-gate."* The 1.9.x patch re-gates the boss floors on the full ladder, on an
    idle machine; no row is held back for a balance pass.
    **Rows in measured decks** (A3, A5, A6, A9, A10, A12, A14, A18, A24, A27, A28, A31, A33, B4, B8):
    re-gate the boss floors in the 1.9.x patch (recommended: the moves are small and the patch runs
    the full ladder anyway), or hold those rows for a balance pass?
11. *Ruled (D11): "Yes, as a follow up."* A dominated pair's loser needs its own reason, a tribe
    on the winner no longer rescues it. The follow-up (about seven cards, from the nine pairs below
    less the two A4 and A22 already fix) is not drafted, and when it runs is open.
    **Tribe rescue one-sided?** Nine pairs are told apart only by a tribe on the winning card, so the
    loser has nothing the winner lacks: Jiang Wei under Zhang Bao (Base), Current-Bend Navigator and
    River-Sky Reader under Chart-Keeper of the Two Ways and Debt-Beetle Swarm under Tomb-Toll Taker
    (Duat), Ghostline Diviner under Echo-Fox Informant (Yokai Nights), Natron Kit-Caller under
    Lintel-Paw Warden (Duat, A4 already fixes it), and across sets Flare-Orbit Captain under Sunfire
    Warcaller (A22 already fixes it), Wrecker Mate under Chrome-Tailed Raider and False-Lamp Bearer
    under Tournament Favorite. Recommended: make the rescue one-sided for dominated pairs (a loser needs
    its own reason) in a follow-up; that adds seven cards, not drafted here.
12. *Ruled (D12): "Balance pass."* The four go to the balance track, not this patch.
    **The out-of-band cards seen on the way** (The Debt Is Called, Black-Veil Matron, Still Harbour,
    Cold Current): leave them to the balance track (recommended), or fold them into this patch?
