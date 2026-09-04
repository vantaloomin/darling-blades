<!-- source-of-truth: src/data/cards/*.ts, src/engine/statics.ts, src/engine/types.ts · last-verified: 2026-09-04
     If you change those files, update this doc or re-verify the date. -->

# Tribal pass — audit and plan

A full disposition of all 157 creature types, and a plan to make tribal decks
both stronger and more interesting to play.

Measured 2026-07-28 over 392 creature cards (374 collectible + 18 tokens) and
662 subtype assignments.

## What the audit found

**1. The engine expresses exactly one tribal shape.** `statics.ts:82` is the
only subtype-aware line in the whole engine:

```ts
(!st.filter?.subtype || d.subtypes.includes(st.filter.subtype))
```

A static filter granting P/T and optionally keywords. That is the entire tribal
vocabulary. All 23 tribal cards in the game are lords, and **19 of the 23 are
flat +1/+1 or +1/+0 anthems** - only four grant a keyword (Excalibur From the
Lake, Howling Gallery, Seafoam Dagger, Silvered Rapier).

Tribal feels flat because the game has one tribal card design printed 23 times.
That is the root cause, and no amount of type consolidation fixes it.

**2. The umbrella system already exists and is largely correct.** Roughly 100 of
the 157 types are >=90% contained inside a larger type, and the containment is
clean - every `-kin` type is 100% co-tagged `Beastkin`. Consolidation is
therefore mostly *already done*; the sub-types are flavor riding on a working
umbrella.

**3. Only 13 types are buildable, and 6 of them have no support.** A tribe is
viable only if enough of it is castable inside one colour pair (our decks are
two-colour, 60 cards, 24 lands, max 4 copies - so ~10 distinct in-pair cards is
the floor for a real tribal deck).

| Axis | Cards | In best pair | Payoffs |
| --- | ---: | ---: | ---: |
| Warrior | 53 | 33 (RW) | **0** |
| Fae | 42 | 22 (BG) | 1 |
| Human | 35 | 12 (GW) | **0** |
| Strategist | 28 | 23 (BU) | **0** |
| Beastkin | 28 | 15 (GU) | 2 |
| Wei | 26 | 15 (BU) | 3 |
| Olympian | 25 | 13 (BW) | 3 |
| Shu | 24 | 17 (GW) | 2 |
| God | 24 | 12 (BW) | **0** |
| Wu | 23 | 21 (RU) | 2 |
| Knight | 18 | 10 (RW) | 3 |
| Construct | 17 | 16 (UW) | **0** |
| Jin | 13 | 10 (BU) | **0** |

**The three largest tribes in the game have zero tribal support.** Meanwhile
`Wolfkin`, at 3 cards, has a dedicated lord. Support was printed for the narrow
types and never for the broad ones.

**4. `God` and `Olympian` are 88-92% the same 22 cards** - a larger redundancy
than Wolf/Wolfkin, and neither carries a payoff. The Norse gods do not use
`God` at all; they are `Aesir`/`Vanir`.

## The type model

Three tiers, with one governing rule that prevents this recurring:

- **Axis** - the only types a `filter.subtype` may name. The live list is the
  code's `AXES` export (`src/data/axes.ts`, enforced by a catalog test since
  2026-08-17): the audit table's 13 plus Wolf (Tier 0), plus the set-headline
  Axes later sets added mechanically (Hunter 1.3, Mermaid 1.4, Kitsune 1.5,
  Valkyrie CORE), plus **Bastet** (owner-ratified 2026-08-17 for Sands of the
  Duat, concretion gate item 4; enters at 0 cards until the `sd-` waves land,
  planned density 34 creatures + 3 typal payoffs per
  plan-duat-cards-mechanical §1.2), plus **Yokai** (owner pick 2026-09-04: Jade-Crown Elder is the green Yokai lord, "Your other Yokai get +1/+0 and gain Overrun"; 11 Yokai Nights creatures carry the type) - 20 declared Axes in all. This doc's
  "(14 after Tier 0)" count predates those set additions; the code list is
  the truth now. (Mermaid was caught by the enforcement test's first run:
  dt-seafoam-dagger's static filtered on it while no audit listed it.)
- **Sub-type** - >=90% contained in an Axis. Prints on the face for flavour,
  never referenced mechanically.
- **Flavour** - everything else. Free to print, mechanically inert.

**Rule: a static's `filter.subtype` may only name an Axis.** That single
constraint is what stops the next 80 singletons from fragmenting support again.

## Tier 0 - consolidations (data only)

> **Status 2026-07-29: SHIPPED.** All five subtype edits and Lupa's
> `filter.subtype` change landed in PR #142 (the 2026-07-28 player-feedback
> hygiene riders) before this doc entered the tree; the table below is the
> audit record. The governance rule (a static's `filter.subtype` may only
> name an Axis) remains the live, binding part of this tier.

Exactly **five cards** change subtype, plus one static filter. Everything else in
this tier is governance, not edits.

| Card | id | Now | Becomes |
| --- | --- | --- | --- |
| Wolfkin Raider | `bk-wolfkin-raider` | Beastkin, Wolfkin | Beastkin, **Wolf** |
| Beastkin Packmother | `bk-packmother` | Beastkin, Wolfkin | Beastkin, **Wolf** |
| Wolfqueen Lupa | `bk-wolfqueen` | Beastkin, Wolfkin | Beastkin, **Wolf** |
| Harpy Skirmisher | `bk-harpy-skirmisher` | Beastkin, Avian | Beastkin, **Bird** |
| Crowkin Shrike | `bk-crowkin-shrike` | Beastkin, Avian | Beastkin, **Bird** |

Plus: **Wolfqueen Lupa's** static `filter.subtype` changes `Wolfkin` -> `Wolf`.
All five cards are in `src/data/cards/beastkin.ts`.

`Werewolf` and `Predator` need **no edit** - nothing references them, so they are
already flavour. They are listed in the audit only so the classification is
complete.

**On `God`/`Olympian`, I now recommend the lower-churn option.** Merging
`Aesir`+`Vanir` into `God` measures at 28 cards but still only **12 in-pair** -
no better than `Olympian` alone at 13. The umbrella would deduplicate without
creating a better tribe. So instead: **demote `God` to flavour and keep
`Olympian` as the Greek axis.** Zero card edits, the 88% duplicate stops
mattering the moment only one of the pair is mechanically referenced, and Norse
already has its own tribes (Valkyrie 8, Jotun 10, Draugr 9, Einherjar 6) without
needing a shared god type.

## Tier 1 - fill the payoff gaps (data only, current engine)

### The costing template

Our existing lords cluster tightly, and the MTG corpus confirms the line:

| Shape | Our cards | Real precedent |
| --- | --- | --- |
| mv3 2/2 creature, +1/+1 to other X | Xun Yu `{1}{W}{W}`, Lu Meng `{1}{U}{U}`, Apollo `{1}{W}{W}`, Beastkin Packmother `{1}{G}{G}` - all `r` | Elvish Archdruid `{1}{G}{G}` 2/2, Goblin Chieftain `{1}{R}{R}` 2/2, Stromkirk Captain `{1}{B}{R}` 2/2 |
| mv2 enchantment, +1/+1 to X | Call of the Wilds `{1}{G}`, Banner of the Hegemon `{1}{B}`, Peach Garden Oath `{1}{W}` - all `r` | (anthem band, 2-3 mana) |

**New tribal cards use these two shapes unless there is a stated reason not to.**

### Proposed cards

Colour and set are set by where each tribe actually lives, measured:

| # | Tribe | Proposed card | Cost | Body | Effect | Rarity | Set | Why this shape |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Jin (13, B:5 U:3) | Jin faction lord | `{1}{B}{B}` | 2/2 | Other Jin you control get +1/+1 | `r` | CORE | Exactly matches the Wei/Wu/Shu lords. Closes a visible four-faction asymmetry |
| 2 | Warrior (53, R:18 W:13) | Warrior warband leader | `{2}{R}` | 2/2 | Other Warriors you control have **Warcry** | `sr` | CORE | **Deliberately not a stat anthem.** Warrior is 13.5% of all creatures; a keyword grant is narrow where +1/+1 would be set-wide |
| 3 | Construct (17, C:8 U:6) | Construct overseer | `{2}{U}` | 2/3 | Other Constructs you control get +1/+0 | `r` | NOCT | Colourless-heavy tribe, so a blue shell; +1/+0 because Constructs already skew defensive |
| 4 | Strategist (28, U:15) | Strategist payoff | `{1}{U}{U}` | 2/2 | *Holds for Tier 3* - see below | `r` | CORE | The control tribe wants a non-combat payoff, which needs E2. Do not ship a fourth anthem here |
| 5 | Olympian | (already has 3) | - | - | - | - | - | No action |
| 6 | Human (35, DARK-only) | **Defer** | - | - | - | - | - | All 35 are Dark Tales; a Human lord only works inside that set's decks |

Ship 1 and 3 immediately. Ship 2 with a matrix re-run because of tribe size.
Hold 4 for the engine tier rather than printing a fourth identical anthem.

## Tier 2 - variety without engine work

Two shapes are available today and unused:

- **Keyword-granting lords.** Only 4 of 23 payoffs grant a keyword. A Fae lord
  granting Skyborne, or a Warrior lord granting Overrun, is the same engine
  feature with a completely different feel, at zero implementation cost.
- **Tribal token generation.** `createToken` already works, and tokens already
  exist with `Wolf`, `Fae`, `Beastkin`, `Kitsune`, `Valkyrie`, `Draugr`,
  `Construct` and `Spirit` types. (Correction 2026-07-31: this doc's original
  "no tribal card makes them" claim was stale when written - Fae, Yohime, and
  Ragnarok lord-adjacent cards already made typed tokens, and the W5 balance
  wave added more. The shape remains under-used rather than unused.)

This tier is where the fastest "fun" wins are, because it needs no engine change.

## Tier 3 - engine work

Ranked by fun per unit of cost. **Build E1, then E2. Do not build all four.**

### E1 - dynamic tribal scaling (build first)

"This gets +1/+1 for each other Wolf you control."

Fits our architecture unusually well: effective P/T is *already* always computed
on read (`statics.ts`), so a count-derived bonus extends the existing path
rather than adding plumbing. It is the smallest engine change that visibly
changes how tribal plays, which makes it the right one to prove the approach
through the balance gates before attempting E2.

*Shape (design is the implementer's, this is the contract):* `StaticDef` gains
an optional way to say "p/t are multiplied by the number of matching creatures I
control". It must stay trigger-safe, deterministic, and computed on read like
every other static - never cached onto the card instance.

Cards it unlocks: a Wolf or Beastkin payoff that snowballs; the top-end
Olympian/God card that is currently missing.

### E2 - tribal triggers (build second)

"Whenever another Fae you control arrives, foresee 1."

This is where the fun actually lives: it turns a tribe from a stat bonus into an
engine. Needs a new trigger that fires on *another* permanent arriving, carrying
a subtype filter. Respects the v1 "triggers never target" rule as long as the
ops stay trigger-safe, which is the same constraint Empower riders already meet.

Cards it unlocks: the **Strategist** payoff held back from Tier 1, plus the
first genuinely non-combat tribal cards in the game.

### E3 - tribal tutor

`{ op: 'tutor', subtype }`. `fetchLand` already proves the search-deck-to-zone
shape, so this is the smallest new op of the three. Consistency is most of what
makes a tribal deck feel good, but it is a power increase across every tribe at
once - hold until E1 and E2 have been through the gates.

### E4 - tribal cost reduction

**Defer indefinitely.** Touches `validateAction` and the mana solver, the most
delicate code in the engine, for the least differentiated payoff of the four.

## Sequencing

Each phase is independently shippable and independently revertible. Nothing
later depends on a card from an earlier phase surviving the gates.

| Phase | Contents | Files | Gate |
| ---: | --- | --- | --- |
| **1** | Tier 0: five subtype edits + Lupa's filter. New **Jin lord** and **Construct overseer** | `src/data/cards/beastkin.ts`, `tk-jin.ts`, `gothic-monsters.ts` | `balance-matrix --avatars --seeds 40`, lint, build, vitest |
| **2** | **Warrior warband leader** (keyword grant). Tribal **token** payoffs using existing tokens | `src/data/cards/*.ts` only | matrix re-run; Warrior is 13.5% of creatures so this gate is not optional |
| **3** | **E1** dynamic scaling + the 1-2 cards that use it | `src/engine/types.ts`, `statics.ts`, then data | full ladder + win-rate gates |
| **4** | **E2** tribal triggers + the Strategist payoff | `src/engine/types.ts`, trigger dispatch, then data | full ladder + win-rate gates |
| 5 | E3 tutor, Tier 1 remainder (God/Human) | - | full ladder |

Phases 1 and 2 are **data-only** and need no engine change, so they can land
while the engine phases are still being designed.

**Status 2026-07-31: Phases 1-2 SHIPPED as W5 of the 1.5 balance pass**
(Yang Huiyu, Patient Regent - Jin lord; Porcelain Governess - Construct
overseer; Sable, Warband Captain - Warrior keyword lord, nonlegendary per file
precedent; Moundlight Midwife - token payoff). Pool 758 -> 787 with the W3.5
sweepers; CORE 209; measurements in the W7 tables (`src/data/opponents.ts`,
2026-07-31 block). Tier 0's five subtype edits + Lupa filter had already
shipped in PR #142. E1/E2 engine tiers remain out of 1.5 scope per the user's
2026-07-29 call.

## Risks

- **Consolidation raises power on its own.** After `Wolfkin -> Wolf`, Howling
  Gallery and Wolfqueen Lupa each buff 12 creatures instead of 9 and 3. This is
  a balance change wearing a data-cleanup costume - the matrix re-run is
  mandatory, not optional.
- **Warrior is 53 cards.** Any Warrior payoff is a set-wide effect. Treat it as
  a design problem, not a slot to fill.
- **Set-locked tribes.** Human is DARK-only, Vampire NOCT-only, Jotun RAGN-only.
  Payoffs for those work in draft and barely in constructed.
- Test gate floors only ratchet upward, with freshly measured numbers.
- **No save migration needed** - decks and saves reference card ids, not
  subtypes. This is a data change, not a schema change.

## Non-goals

- **Do not merge Wu/Shu/Wei/Jin.** Combined they are 86 cards, 42 in one colour
  pair - 13% of the collectible pool. That is a second colour pie, not a tribe,
  and it erases the faction identity the base set is built on. All four are
  already individually viable.
- **Do not delete flavour sub-types.** They cost nothing and carry the setting.
- **Do not print payoffs for non-Axis types.** That is what produced a 3-card
  tribe with its own lord.

## Calls made in this draft

Recorded so they can be overturned deliberately rather than drifted past:

1. **`God` is demoted to flavour, `Olympian` stays the axis.** The umbrella
   alternative measured no better (12 in-pair vs 13) and costs six card edits.
2. **Warrior gets a keyword grant, not a stat anthem.** At 13.5% of all
   creatures, +1/+1 is a set-wide effect wearing a tribal costume.
3. **E1 before E2.** E2 is where the fun is, but E1 is the cheapest change that
   proves the plumbing through the balance gates first.
4. **No fourth anthem for Strategist.** It is held for E2 rather than shipped as
   another copy of the one card we already have 19 of.

## Still open

- **Card names and flavour text are not drafted here.** Every new card needs a
  name that clears the collision rules and copy that follows the content voice -
  including no em-dashes in player-facing text. That is a separate pass.
- **Whether Warrior should be a tribe at all.** The draft assumes yes with a
  narrow payoff; the alternative is accepting it as a flavour type and letting
  RW aggro be an archetype rather than a tribe.

## Appendix - full type disposition

**Axes (13, plus `Wolf` after Tier 0):** Warrior, Fae, Human, Strategist,
Beastkin, Wei, Olympian, Shu, God, Wu, Knight, Construct, Jin.

**Near-viable (8)** - 6-9 in-pair, would need ~3 more cards each: Warlord,
Jotun, Draugr, Vampire, Wolf, Valkyrie, Norn, Einherjar. (`Vanir` looks close at
5 cards, but only 3 are castable in any one pair, so it stays flavour.)

**Sub-types, by umbrella (~100):**

| Umbrella | Sub-types |
| --- | --- |
| Human (16) | Architect, Captain, Duchess, Elder, Godmother, Guardian, Keeper, Maiden, Princess, Proprietor, Regent, Rider, Runner, Sailor, Scholar, Wayfinder |
| Fae (15) | Adept, Banshee, Fomorian, Goddess, Hart, Oracle, Otter, Pixie, Pooka, Redcap, Reveler, Selkie, Sidhe, Sprite, Wisp |
| Beastkin (15) | Avian, Batkin, Boarkin, Deerkin, Draconic, Holstaur, Kitsune, Mousekin, Nekomata, Serpent, Sheepkin, Spiderkin, Squirrelkin, Turtlekin, Wolfkin |
| Vampire (7) | Assassin, Countess, Heiress, Hostess, Matron, Performer, Servant |
| Knight (5) | Banneret, Champion, Fallen, Grail-Seeker, Rebel |
| Construct (4) | Bride, Doll, Figure, Staircase |
| Plant (4) | Gardener, Giant, Monster, Warden |
| Mermaid (4) | Diver, Messenger, Siren, Songstress |
| Wolf (2) | Predator, Werewolf |
| Bird (2) | Courier, Omen |
| Revenant (2) | Ghost, Saint |
| Hunter (2) | Beast, Patrol |
| Scientist (2) | Assistant, Heir |
| singles | God->Olympian, Aesir->God, Poet->Wei, Dancer->Wu, Frog->Noble, Dwarf->Miner, Spy->Courtier, Mystic->Guide, Quest-Seeker->Cleric |

**Flavour and singletons (47)** - mechanically inert, keep for setting:
Queen, Hunter, Attendant, Bird, Guard, Mermaid, Revenant, Vanir, Witch, Cleric,
Mage, Noble, Shieldmaiden, Soldier, Spirit, Archer, Courtier, Duelist, Hound,
Raven, Seer, Bat, Diplomat, Druid, Guide, Initiate, Miner, Ranger, Rat,
Scientist, Scout, Sentinel, Sorcerer, Sovereign, Squire, Worker, Bard, Cat,
Familiar, Guest, Helper, Horse, Huntress, Insect, Mouse, Sage, Wizard.

**Note:** `Sentinel` is both a creature type (2 cards) and a keyword
(vigilance). Harmless today since nothing keys off the subtype, but a
`typal-sentinel` card would read ambiguously. The keyword-map's collision rules
should be extended to cover subtypes.
