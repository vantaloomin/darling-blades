<!-- source-of-truth: tests/data/keywordCoverage.test.ts, src/data/glossary.ts, src/power/scoreCore.ts, src/forge/vocab.ts, scripts/audit-overlap.ts, src/data/cards/, src/data/opponents.ts, src/data/starterDecks.ts, src/data/darlingsPrecons.ts, src/data/duatArchetypeDecks.ts, docs/d8-near-duplicate-review.md · last-verified: 2026-10-08 · the keyword backfill of the shipped sets (plan-1.9): APPROVED 2026-10-08; the slate is APPLIED in the 1.9.1 patch -->

# The keyword backfill of the shipped sets (proposed and approved 2026-10-08)

**Status: APPROVED 2026-10-08 and APPLIED in the 1.9.1 patch.** The owner took every question
below as recommended: the primary slate P1 to P18 (P13 is D8's A5), the Twin Blades stat trades
(P9, P10, P17), two Arthurian Court cards (P7, P8), Hecate for Base, the re-gates (Queen Below, Sable
Warballad, Chrome Broodmother, P16 as written), and the art prose and prompts updated now with the
regeneration left to the next art pass. Applied against the live pool with D8 merged: every rendered
text and Δ matches its row, the D8 rule rejects 0 pairs, `GRANDFATHERED_GAPS` is gone, and the themed
builder re-synced four boss Darlings lists (Laughing Pooka into Zhurong, Carmilla and The Tyrant
Queen; Oni Neon Marshal into Lupa).

The owner approved the backfill on 2026-09-29: each of
the ten shipped sets gains the evergreen keywords it lacks, "either a handful of extra cards, or
adding keywords to underpowered cards that fit thematically". This slate takes the second lever
everywhere: **17 existing cards change, no new card, so no set's rarity histogram moves.** The
eighteenth gap (Sands of the Duat, First Blade) is already closed by D8's row A5. The owner's questions are at the end, all answered as recommended.

## How it was measured

- **Gaps:** re-derived from the live catalog with the coverage test's own reading (`cardTermNames`
  over every collectible, non-basic card of the set, so a keyword a card grants counts). They match
  the plan row and `GRANDFATHERED_GAPS` exactly: 18 gaps across the ten sets (table below).
- **Scores:** the v4 scorer, `scoreCard` in `src/power/scoreCore.ts`, with each edit applied in
  memory. The fair band is Δ within ±0.75. Every row lands inside it.
- **Colour fit:** the keyword map has no colour column, so fit was read from the Forge's
  `COLOR_PIE_KEYWORDS` (`src/forge/vocab.ts`) and the "Colour home" column of
  [card-building-guide.md](card-building-guide.md) §4. Rage is in no colour's Forge list; its home is
  red (10 of 11 printings), so every Rage row is red. Bulwark's home is green, white and blue; Dreaded
  black, then red; Untouchable blue, then white; Twin Blades red, then white; First Blade white and
  red; Deathblade black, then green; Blood Oath white and black.
- **Cascade check:** `statLadders`, `worseTwins` and `dominates` from `scripts/audit-overlap.ts`, run
  on the pool before and after each edit, both on the live pool and on the live pool with D8's
  keyword and stat rows applied (A2, A3, A5, A8 to A18, A22, A30, B1, B2, B8). Every edit was checked
  alone, then the whole slate together. Because `worseTwins` keys on paid-off tribes, a twin whose
  winner carries a tribe the loser lacks is invisible to it; those were read by hand from the
  DOMINATED output against D8's rule 1 (one candidate failed that way, below).
- **Decks:** every card was checked against the boss lists (`deck`, `reserveDeck`, `darlingsDeck`),
  the starter and theme decks, the Darlings precons and the Duat archetype decks. "Generated Darlings
  lists" are boss `darlingsDeck` lists alone, the D8 convention.
- **Not run:** no matches. Rows in measured decks re-gate those floors in the patch (D8's D10 ruling
  applies the same way).

### The gaps (plan row against live data)

| Set | Lacks (plan) | Lacks (live, 2026-10-08) | After D8 lands |
| --- | --- | --- | --- |
| Base | Dreaded | Dreaded | Dreaded |
| Ragnarok | Bulwark, Untouchable, Dreaded | same | same |
| Celtic Fae | Twin Blades, Rage | same | same |
| Arthurian Court | Dreaded, Rage | same | same |
| Gothic Monsters | Twin Blades | same | same (A16's Bulwark removal leaves Iron-Gate Sentinel and Wolfsbane Ward) |
| Dark Tales | Twin Blades, Rage | same | same |
| Yokai Nights | Rage | same | same |
| Sands of the Duat | First Blade, Deathblade, Rage | same | **Deathblade, Rage** (A5 gives Ninth-Step Duelist First Blade) |
| Starborne | Rage | same | same |
| Drowned Deep | Twin Blades, Blood Oath | same | same (B1's Rage on Wreck-Runner is not a gap: Gale-Rider and Brenna Gale carry it) |

The plan's list is correct. One consequence it does not state: **D8 row A5 alone fails the coverage
test**, because the grandfather list is a ratchet in both directions. Whichever patch lands A5 must
strike `firstBlade` from the `sands-of-the-duat` entry in `tests/data/keywordCoverage.test.ts`.

## How the cards were picked

- **Positive keywords** (Dreaded, Untouchable, Twin Blades, First Blade, Deathblade, Blood Oath) go
  on cards below the band's middle, preferring the lowest Δ that fits the name and art.
- **Drawback keywords** (Rage, Bulwark) go on cards in the upper half of the band or over it, so the
  keyword pulls them toward the middle, or ride with a stat bump (Prow-Fire Lioness). Rage costs
  -0.45, or -0.15 on a card that already has Twin Blades, Warcry, Overrun or First Blade.
- **Twin Blades** is the hard gap. On almost every candidate in the four sets that lack it, +1.25 plus
  0.40 a point of Attack throws the card out of the band. Each Twin Blades row is therefore a keyword
  swap, a stat trade, or a granted Twin Blades, and keeps the guide's §3 rule: low Attack on commons,
  no self-marking.
- **No card from D8's 41** is used, apart from A5, which this slate leans on rather than changes.
- **Rejected for a cascade:** Redcap Skirmisher (+Rage) would make Berserker Initiate (Ragnarok C,
  {2}{R} 3/1 Warcry, Rage) a strictly-worse twin under D8's rule 1. The Redcap carries the paid-off
  Fae tribe and Einherjar is not paid off, so `worseTwins` misses it. Every {1}{R} 2/1 Warcry common
  (Pumpkin Attendant, Red-Cloak Runner, Street Oni Scrapper, Flarewing Raider, Muspel Emberkin) is out
  for Rage too: once D8's B1 gives Wreck-Runner ({R}, 2/1 Warcry) Rage, each would become its
  strictly-worse twin again, which `worseTwins` confirms.

## The slate

Rules text below is what the game renders from the proposed data. Δ is the v4 score before and after.

| Row | Card id | Set rarity | Gap keyword | Now | Proposed | Δ | Decks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | Hecate, Crossroads Witch `gk-hecate` | Base R | Dreaded | {2}{B}{B} · 3/3<br>When this arrives, your opponent discards a card at random. | {2}{B}{B} · 3/3<br>Dreaded<br>When this arrives, your opponent discards a card at random. | -0.67 → -0.17 | 1 generated Darlings list |
| P2 | Keeper of the Well of Urd `rg-well-keeper` | Ragnarok C | Bulwark | {3}{U} · 2/4<br>When this arrives, draw a card. | {3}{U} · 2/4<br>Bulwark<br>When this arrives, draw a card. | 0.43 → -0.47 | Darlings precon Queen Below |
| P3 | Runecarver Adept `rg-runecarver` | Ragnarok C | Untouchable | {2}{U} · 1/3<br>When this arrives, put the top 3 cards of your deck into your graveyard. | {2}{U} · 1/3<br>Untouchable<br>When this arrives, put the top 3 cards of your deck into your graveyard. | -0.52 → 0.08 | Darlings precon Queen Below |
| P4 | Hungry Shade `rg-hungry-shade` | Ragnarok C | Dreaded | {2}{B} · 2/2<br>When this dies, your opponent loses 1 life. | {2}{B} · 2/2<br>Dreaded<br>When this dies, your opponent loses 1 life. | -0.46 → 0.04 | Darlings precon Queen Below |
| P5 | Brigid's Ember Blessing `cf-brigid-ember-blessing` | Celtic Fae R | Twin Blades (granted) | {1}{R} · Charm<br>Target creature gets +1/+1 and gains First Blade until Sunset, then Foresee 1. | {1}{R} · Charm<br>Target creature gets +1/+1 and gains Twin Blades until Sunset, then Foresee 1. | -0.32 → 0.39 | 1 generated Darlings list |
| P6 | Laughing Pooka `cf-laughing-pooka` | Celtic Fae C | Rage | {R}{R} · 4/1<br>(no rules text) | {R}{R} · 4/1<br>Rage | 0.36 → -0.09 | 4 generated Darlings lists |
| P7 | Mordred, Bastard Star `ac-mordred-bastard-star` | Arthurian Court SR | Dreaded | {3}{B}{R} · 4/4<br>Overrun, Warcry<br>Whenever this attacks, this deals 2 damage to your opponent. | {3}{B}{R} · 4/4<br>Overrun, Warcry, Dreaded<br>Whenever this attacks, this deals 2 damage to your opponent. | 0.07 → 0.17 | none |
| P8 | Errant Duelist `ac-errant-duelist` | Arthurian Court C | Rage | {2}{R} · 2/2<br>First Blade<br>Awakening: +1/+1, Untouchable | {2}{R} · 2/2<br>First Blade, Rage<br>Awakening: +1/+1, Untouchable | 0.32 → 0.17 | Darlings precon Sable Warballad |
| P9 | Lantern Patrol `gm-lantern-patrol` | Gothic Monsters C | Twin Blades | {2}{W} · 2/2<br>First Blade | {2}{W} · 1/3<br>Twin Blades | -0.12 → 0.29 | none |
| P10 | Bell-Tower Dancer `dt-bell-tower-dancer` | Dark Tales SR | Twin Blades | {1}{W}{R} · 2/2<br>Skim {1}<br>Warcry, First Blade | {1}{W}{R} · 2/2<br>Skim {1}<br>Warcry, Twin Blades | -0.34 → 0.57 | none |
| P11 | Red Hood Wolfslayer `dt-red-hood-wolfslayer` | Dark Tales SR | Rage | {2}{R}{G} · 4/4<br>First Blade, Overrun | {2}{R}{G} · 4/4<br>First Blade, Overrun, Rage | 0.61 → 0.46 | none |
| P12 | Oni Neon Marshal `yn-oni-neon-marshal` | Yokai Nights R | Rage | {3}{R} · 4/3<br>Warcry<br>Whenever this attacks, your opponent loses 1 life. | {3}{R} · 4/3<br>Warcry, Rage<br>Whenever this attacks, your opponent loses 1 life. | 0.78 → 0.63 | 2 generated Darlings lists |
| P13 | Ninth-Step Duelist `sd-ninth-step-duelist` | Sands of the Duat C | First Blade | {1}{W} · 1/1<br>Nine Lives. | {1}{W} · 1/1<br>First Blade<br>Nine Lives. | -0.05 → 0.37 | Duat archetype Nine Lives at Dusk; Duat archetype Nine Lives at Dusk (+reserve); 2 generated Darlings lists |
| P14 | Debt-Beetle Swarm `sd-debt-beetle-swarm` | Sands of the Duat C | Deathblade | {1}{B} · 1/1<br>When this dies, your opponent loses 1 life. | {1}{B} · 1/1<br>Deathblade<br>When this dies, your opponent loses 1 life. | -0.65 → 0.20 | none |
| P15 | Prow-Fire Lioness `sd-prow-fire-lioness` | Sands of the Duat C | Rage | {3}{R} · 4/3<br>(no rules text) | {3}{R} · 5/3<br>Rage | -0.23 → -0.20 | none |
| P16 | Lance of Two Suns `sb-lance-of-two-suns` | Starborne C | Rage | {2}{R} · 2/1<br>Twin Blades<br>When this arrives, Mark another target creature. | {2}{R} · 2/1<br>Twin Blades, Rage<br>When this arrives, Mark another target creature. | 0.87 → 0.71 | boss Chrome Broodmother (deck+reserve+darlings) |
| P17 | Wrecker Mate `dd-wrecker-captain-lesser` | Drowned Deep C | Twin Blades | {2}{R}{R} · 4/3<br>Overrun | {2}{R}{R} · 2/3<br>Overrun, Twin Blades | -0.20 → 0.39 | none |
| P18 | Marsh-Widow `dd-marsh-widow` | Drowned Deep C | Blood Oath | {3}{B} · 2/3<br>Whenever another creature you control dies, your opponent loses 1 life. | {3}{B} · 2/3<br>Blood Oath<br>Whenever another creature you control dies, your opponent loses 1 life. | -0.59 → 0.11 | none |

P13 is D8's row A5 and is listed only so the table covers every gap. This patch does not change it again.

### Why these cards

- **P1 Hecate** is the dread goddess of the crossroads and the lowest-Δ black body in Base that fits.
  She reaches -0.17, still the lower half. Zhang Liao, "Terror of Hefei", is the better name (A1),
  but he is in the Cao Cao boss's hand-built lists.
- **P2 to P4 (Ragnarok)** are three Queen Below precon cards, so the set costs one re-gate. P2 is
  the Wall of Blossoms shape: a well-keeper that guards and draws, with no attack text for Bulwark to
  kill. P3's runes ward her (Untouchable). P4 frees Hungry Shade from Dong Zhuo's ladder.
- **P5 Brigid's Ember Blessing** swaps a granted First Blade for a granted Twin Blades. Brigid is the
  smith-goddess, and a +1/+1 Twin Blades trick at {1}{R} follows Magic's common Double Cleave.
  Celtic Fae keeps First Blade through Sidhe Silver-Lancer. A charm has no art-bible Card facts
  line.
- **P6 Laughing Pooka**: the trickster horse that runs its rider wild. A 4/1 for {R}{R} wants to
  attack anyway. Its card text adds nothing else.
- **P7 Mordred** is the traitor no one wants to block alone, and has no measured deck. P8, the
  knight-errant who "wanders from joust to joust looking for a worthy ending", takes Rage.
- **P9 Lantern Patrol** becomes a 1/3 Twin Blades for {2}{W}, two damage a swing, the guide's safe
  shape for a common. It also frees the card from Shieldwall Maiden's ladder.
- **P10 Bell-Tower Dancer** is a keyword swap only: a 2/2 Warcry, Twin Blades legend at mv3 deals
  four, as every shipped mv3 Twin Blades body does (three of the four are
  rare). A 2/1 variant reads +0.12 if the owner wants it lower.
- **P11 Red Hood** hunts wolves without rest. **P12 Oni Neon Marshal** is over the band now (+0.78)
  and lands inside it. The change also clears eight "just better" dominations it holds, Flare-Orbit
  Captain's among them.
- **P14 Debt-Beetle Swarm** is a venomous swarm. Deathblade also gives it the "own reason" that
  D8's D11 follow-up asks of a dominated loser: it now leaves Tomb-Toll Taker's ladder.
- **P15 Prow-Fire Lioness** takes Rage plus a stat bump, the shape the brief prefers for Rage, at
  common and outside every measured deck.
- **P16 Lance of Two Suns** is the over-band Twin Blades common the card-building guide names in §3.
  Rage brings it to +0.71, but it sits in the Chrome Broodmother boss's lists. A16 is the deck-free
  alternative.
- **P17 Wrecker Mate** keeps Overrun and trades two Attack for Twin Blades: four trampling damage at
  mv4, a common. The trade clears its strictly-worse twin under Comet-Kick Marauder (D8's A10 also
  clears that one), both rare ladders over it, and six dominations over it, D11's Chrome-Tailed
  Raider pair among them.
- **P18 Marsh-Widow**, the drain witch of the salt marsh, takes Blood Oath at the bottom of the band.

### Alternates (one for each gap)

| Row | Card id | Set rarity | Gap keyword | Now | Proposed | Δ | Decks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Zhang Liao, Terror of Hefei `tk-wei-zhangliao` | Base R | Dreaded | {2}{B}{B} · 4/3<br>Whenever this attacks, your opponent loses 1 life. | {2}{B}{B} · 4/3<br>Dreaded<br>Whenever this attacks, your opponent loses 1 life. | -0.47 → 0.03 | boss Cao Cao (deck+reserve+darlings) |
| A2 | Einherjar Shieldbearer `rg-einherjar-shieldbearer` | Ragnarok C | Bulwark | {1}{W} · 1/3<br>Sentinel | {1}{W} · 1/4<br>Bulwark | 0.25 → -0.37 | Darlings precon Sable Warballad; 2 generated Darlings lists |
| A3 | Iðunn, Keeper of Apples `rg-idun` | Ragnarok SR | Untouchable | {3}{G}{W} · 3/4<br>When this arrives, you gain 4 life.<br>During your Dawn, Mark this. | {3}{G}{W} · 3/4<br>Untouchable<br>When this arrives, you gain 4 life.<br>During your Dawn, Mark this. | -0.06 → 0.54 | none |
| A4 | Draugr Raider `rg-draugr-raider` | Ragnarok C | Dreaded | {1}{B} · 2/1<br>(no rules text) | {1}{B} · 2/1<br>Dreaded | -0.40 → 0.10 | Darlings precon Queen Below; 1 generated Darlings list |
| A5 | Redcap Blood-Host `cf-redcap-blood-host` | Celtic Fae SR | Twin Blades | {2}{R}{R} · 4/4<br>Warcry | {2}{R}{R} · 2/4<br>Warcry, Twin Blades | -0.22 → 0.17 | 2 generated Darlings lists |
| A6 | Fomorian Raider `cf-fomorian-raider` | Celtic Fae R | Rage | {2}{R}{R} · 5/3<br>Overrun<br>When this arrives, this deals 2 damage to you. | {2}{R}{R} · 6/3<br>Overrun, Rage<br>When this arrives, this deals 2 damage to you. | -0.32 → 0.02 | 7 generated Darlings lists |
| A7 | Morgan of the Thorn Crown `ac-morgan-thorn-crown` | Arthurian Court UR | Dreaded | {4}{U}{B} · 4/6<br>When this arrives, Sever the top 2 cards of your opponent's graveyard.<br>During your Dawn, Foresee 1.<br>While a Quest is active, your opponent loses 2 life. | {4}{U}{B} · 4/6<br>Dreaded<br>When this arrives, Sever the top 2 cards of your opponent's graveyard.<br>During your Dawn, Foresee 1.<br>While a Quest is active, your opponent loses 2 life. | -0.31 → 0.19 | boss Morgan of the Thorn Crown (deck+reserve) |
| A8 | Gawain of the Noonblade `ac-gawain-noonblade` | Arthurian Court SSR | Rage | {2}{R}{W} · 4/4<br>First Blade<br>While a Quest is active, whenever this attacks, this deals 2 damage to your opponent. | {2}{R}{W} · 4/4<br>First Blade, Rage<br>While a Quest is active, whenever this attacks, this deals 2 damage to your opponent. | 0.40 → 0.25 | Darlings precon Sable Warballad |
| A9 | Moonlit Werewolf `gm-moonlit-werewolf` | Gothic Monsters R | Twin Blades | {3}{R} · 4/3<br>Dreaded, Overrun | {3}{R} · 2/3<br>Dreaded, Twin Blades | 0.20 → 0.49 | boss Carmilla, Crimson Host (deck+darlings); Darlings precon Mirror-Blood Rush; 2 generated Darlings lists |
| A10 | Glass-Stair Duelist `dt-glass-stair-duelist` | Dark Tales R | Twin Blades | {2}{W} · 2/3<br>Skim {1}<br>First Blade | {2}{W} · 1/3<br>Skim {1}<br>Twin Blades | 0.24 → 0.27 | 7 generated Darlings lists |
| A11 | Woodcutter's Daughter `dt-woodcutters-daughter` | Dark Tales R | Rage | {2}{R} · 3/1<br>First Blade<br>Nine Lives. | {2}{R} · 3/1<br>First Blade, Rage<br>Nine Lives. | 0.73 → 0.58 | 1 generated Darlings list |
| A12 | Glitchhorn Enforcer `yn-glitchhorn-enforcer` | Yokai Nights C | Rage | {5}{R} · 5/5<br>Warcry, Overrun | {5}{R} · 5/5<br>Warcry, Overrun, Rage | 0.34 → 0.19 | none |
| A13 | White-Crown Sentinel `sd-white-crown-sentinel` | Sands of the Duat C | First Blade | {3}{W} · 2/4<br>Sentinel | {3}{W} · 2/4<br>Sentinel, First Blade | -0.51 → 0.13 | 1 generated Darlings list |
| A14 | Resin-Wrapped Beetle `sd-resin-wrapped-beetle` | Sands of the Duat C | Deathblade | {2}{B} · 1/2<br>When this dies, create one 1/1 Duat Scarab token. | {2}{B} · 1/2<br>Deathblade<br>When this dies, create one 1/1 Duat Scarab token. | -0.62 → 0.23 | Duat archetype The Copy Kept in Linen; Duat archetype The Copy Kept in Linen (+reserve) |
| A15 | Zahira, Who Lights the Prow `sd-zahira-who-lights-the-prow` | Sands of the Duat UR | Rage | {3}{R}{R} · 7/5<br>Warcry<br>Whenever this attacks, this deals 2 damage to your opponent. | {3}{R}{R} · 7/5<br>Warcry, Rage<br>Whenever this attacks, this deals 2 damage to your opponent. | 0.56 → 0.41 | none |
| A16 | Violet Thruster Ace `sb-violet-thruster-ace` | Starborne C | Rage | {3}{R} · 3/3<br>Skyborne | {3}{R} · 3/3<br>Skyborne, Rage | 0.60 → 0.15 | none |
| A17 | Salt-Fire Witch `dd-salt-fire-witch` | Drowned Deep SR | Twin Blades | {2}{R}{R} · 4/2<br>Skim {R}<br>First Blade | {2}{R}{R} · 3/2<br>Skim {R}<br>Twin Blades | -0.10 → 0.29 | 6 generated Darlings lists |
| A18 | Gravedigger of the Flats `dd-drowned-sexton-lesser` | Drowned Deep C | Blood Oath | {3}{B} · 3/3<br>When this arrives, put the top 3 cards of your deck into your graveyard. | {3}{B} · 3/3<br>Blood Oath<br>When this arrives, put the top 3 cards of your deck into your graveyard. | -0.37 → 0.58 | none |

Redcap Blood-Host is also a Celtic Fae Rage option (5/4 Warcry, Rage, +0.21, no new pair), but one
card should fill only one of the set's two gaps, so A6 is Fomorian Raider. A13 matters only if
D8's A5 changes before it lands.

## What the slate does to the pool

Applied together in memory, on the live pool and on the D8-applied pool:

- **Coverage:** every set carries all 13 keywords (P13 counted through D8 A5). `GRANDFATHERED_GAPS`
  empties, so the whole constant and its test branch can go.
- **New pairs:** one. Debt-Beetle Swarm ({1}{B} 1/1 Deathblade plus a dies trigger) now dominates
  Lamia Nightblade (Base C, {1}{B} 1/1 Deathblade, in the Sima Yi boss lists and the Grave Harvest starter). That is a "just better"
  card, so it falls under the DOMINATED pass, which D8's rule leaves to costing. It is not a ladder or a
  twin. A14 (Resin-Wrapped Beetle) has no new pair but sits in a Duat archetype deck.
- **Pairs removed:** seven ladder or twin pairs and eleven dominations, listed in the rows above. Of
  those, two are D11 follow-up pairs (Debt-Beetle Swarm, Wrecker Mate), and Lantern Patrol no longer
  sits under Shieldwall Maiden.
- **Alternates** add one acceptable cross-set pair: Draugr Raider (A4) under Manor Thrall (GM C,
  2/2 Dreaded, same price), the ordinary cross-set variety D8's rule accepts. A2 leaves Einherjar
  Shieldbearer dominated by First Dawn's Hearth-Shield Maiden.
- **Rarity histogram:** unchanged. No card is added, removed or re-rarified.
- **Measured decks touched by the primary slate:** the Queen Below precon (P2, P3, P4), the Sable
  Warballad precon (P8), and the Chrome Broodmother boss's deck, reserve and Darlings list (P16).
  Four rows sit only in generated Darlings lists (P1, P5, P6, P12). The other eight touch no deck.
  P13 (D8's A5) is in the Nine Lives at Dusk Duat archetype deck, which D8 already re-gates.

## Docs and data the patch also changes

- `tests/data/keywordCoverage.test.ts`: remove `GRANDFATHERED_GAPS` (it is empty once the slate and
  D8 A5 land), or strike each keyword as its row lands.
- The art bible's Card facts lines (`npm run check-art-bible` compares keywords, as a set, and P/T):

  | Row | File:line | Card facts change | Prose |
  | --- | --- | --- | --- |
  | P1 | greek.md:242 | add `dreaded` | fine (twin torches, crossroads dread) |
  | P2 | ragnarok.md:649 | add `bulwark` | "a straightforward body": say "guards the well" |
  | P3 | ragnarok.md:664 | add `untouchable` | fine |
  | P4 | ragnarok.md:724 | add `dreaded` | fine |
  | P6 | celtic-fae.md:587 | add `rage` | fine ("aggressive hunt leader") |
  | P7 | arthurian-court.md:153 | `overrun, warcry, dreaded` | fine |
  | P8 | arthurian-court.md:498 | `firstBlade, rage` | fine ("wanders from joust to joust") |
  | P9 | gothic-monsters.md:620 | `1/3 · twinBlades` | rewrite: "the Hunter-tribal firstBlade filler", "first strike as readiness"; the art shows one sabre |
  | P10 | dark-tales.md:824 | `warcry, twinBlades` | rewrite: "a thin dagger leading (firstBlade)"; the art shows one dagger and a tambourine |
  | P11 | dark-tales.md:179 | add `rage` | fine |
  | P12 | yokai-nights.md:520 | add `rage` | fine |
  | P13 | sands-of-the-duat.md:761 | add `firstBlade` (D8's row) | fine |
  | P14 | sands-of-the-duat.md:1713 | add `deathblade` | fine |
  | P15 | sands-of-the-duat.md:1932 | `5/3 · rage` | fine ("delighted ferocity") |
  | P16 | starborne.md:1259 | `twinBlades, rage` | fine |
  | P17 | drowned-deep.md:2240 | `2/3 · overrun, twinBlades` | the art shows one iron pry bar; a second tool (a boat hook) in the prompt, or leave the art |
  | P18 | drowned-deep.md:1730 | add `bloodoath` | fine |

  P5 is a Charm and has no Card facts line.
- [card-building-guide.md](card-building-guide.md) §4: the keyword table's Cards and Sets counts, and
  the coverage paragraph's "the ten shipped sets all fell short" sentence. Rage goes from 4 sets to all
  10.
- [plan-1.9.md](plan-1.9.md): the "Keyword backfill" row points here.
- After the card-data edit: `npx tsx scripts/blades-db.ts build`, then `terms --check`, then the
  doc checkers.

## Owner questions (recommendation first; all taken as recommended 2026-10-08)

1. **Take the primary slate (P1 to P18), keywords on existing cards with no new card?**
   Recommended: yes. It closes all 18 gaps with 17 card edits, keeps every set's rarity histogram, and
   adds no ladder or twin pair. The alternative the approval allowed is one new card a gap, which
   reopens the histograms.
2. **Close Duat's First Blade through D8's A5 (Ninth-Step Duelist) rather than a separate card?**
   Recommended: yes, landing A5 and this slate in one patch so the ratchet entry goes once. If A5 lands
   first, it must strike `firstBlade` from the grandfather list itself. A13 (White-Crown Sentinel) is
   the standalone fallback.
3. **Approve the Twin Blades stat trades?** Lantern Patrol 2/2 First Blade to 1/3 Twin Blades, Wrecker
   Mate 4/3 to 2/3 Overrun, Twin Blades, and Bell-Tower Dancer's swap at 2/2.
   Recommended: yes. Adding the keyword alone overshoots the band on all three. The alternative is
   one new low-Attack Twin Blades common for each of those three gaps (Celtic Fae's is the P5 Charm).
4. **Arthurian Court: two cards or one?** Recommended: two, Mordred takes Dreaded (P7) and Errant
   Duelist takes Rage (P8). The alternative is Mordred taking both (Overrun, Warcry, Dreaded, Rage,
   +0.07 to +0.02), which touches no measured deck at all but piles four keywords on one legend.
5. **Accept the re-gates?** The Queen Below precon (three Ragnarok rows), Sable Warballad (P8) and the
   Chrome Broodmother boss (P16).
   Recommended: yes, and take P16 as written, since it is the over-band common the guide calls out.
   To avoid the boss re-gate, use A16, Violet Thruster Ace, which is in no deck.
6. **Base: Hecate or Zhang Liao?** Recommended: Hecate (P1), who is outside every hand-built deck.
   Zhang Liao's epithet is literally "Terror", but he sits in the Cao Cao boss's three lists.
7. **Art for the three Twin Blades bodies whose art shows one weapon** (P9, P10, P17)?
   Recommended: update the prose and prompts now and leave the approved art, as the Card facts
   checker requires only the facts line. A regen can go to the next art pass.
