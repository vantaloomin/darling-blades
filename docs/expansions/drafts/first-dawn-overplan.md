<!-- source-of-truth: docs/plan-1.9.md, docs/expansions/drafts/first-dawn-brief.md, docs/expansions/drafts/drowned-deep-overplan.md, docs/keyword-map.md, docs/card-building-guide.md, src/engine/types.ts, src/data/axes.ts, src/power/scoreCore.ts, scripts/audit-overlap.ts, docs/plan-first-dawn-engine.md · last-verified: 2026-09-29 · concept draft: the 211-candidate First Dawn overplan for the 166-card cut (lane B step 2, D16: cards before the engine spec; 210 for 165 as authored, and the owner added a ninth Ultra Rare, Vyra, on 2026-09-29); every row scored on the v4 scorer with provisional Provoked and Hunt rates (NEEDS MATH) and run through the duplicate comparator; its questions and the engine spec ruled at the owner's second sitting 2026-09-28; awaiting A1, the lab's rates, the rescore and the owner's cut; nothing here is implemented -->

# First Dawn: overplan (2026-09-28)

The 211-candidate pool for the 166-card cut (authored as 210 for 165; the
owner added a ninth Ultra Rare on 2026-09-29, see below), written against
the approved identity brief (`docs/expansions/drafts/first-dawn-brief.md`, approved
2026-09-28) and the owner's rulings through 2026-09-28. Under D16 the cards
come before the engine spec: this document is lane B step 2. What follows it
is the concretion audit (step 3: every row mapped to engine vocabulary, the
gap list with its row counts), then the engine spec for Provoked, Hunt and
every kept gap (lane A), then the lab's measured rates for Provoked and Hunt,
a rescore of every mechanic row, and the owner's cut (step 5).

**Status 2026-09-28: the questions are RULED** (the owner's second sitting;
answers under "Questions for the owner", F1-F8 on the sitting's sheet), and
so is the engine spec (`docs/plan-first-dawn-engine.md`), which corrects six
things this draft said (recorded where each is said, marked "Corrected by
the engine spec"). The rulings changed row text in two places only: every
Hunt row prints the ruled bare keyword (E6/E10, superseded later on
2026-09-28: "When this arrives, Hunt."; the spell form "Target creature you
control Hunts.") and Scar-Knife Witch reads "another target creature you
control" (E9). No row is re-costed, re-rated or trimmed here: the cut does that after
the lab. The projected cut moves by one swap (F6: the Great Drum in,
Fern-Crown Tyrant out).

**Status 2026-09-29: the owner asked for a red Ultra Rare like Shivan
Dragon, with a repeatable pump-attack ability,** the set's sole red
Skyborne card, and raised the Ultra Rare count from 8 to 9, so the
histogram becomes **82 / 49 / 15 / 11 / 9 = 166**: a deliberate change to
the ruled B3 histogram, and one card over D2's 150-165 range. The session's
working draft of the card is **Vyra, Ember-Sky Rider**, {4}{R}{R} 5/5, a
legendary Human Rider with Skyborne and "{R}: This gets +1/+0 until
Sunset." Her repeatable pump is a new engine construct, scheduled by the
session as A1.5 and valued at 0 until the lab prices it. Every count below that she changes is updated; where a number
is quoted as history (the B3 histogram, the F6 swap, the balance pass as
run), it says so. Her row is in the Ultra Rare table, and the rulings are
under "Questions for the owner".

Every row here is scored on the committed v4 scorer
(`src/power/scoreCore.ts`, the Forge's own code) with provisional rates for
the two new mechanics, and run through the duplicate comparator
(`scripts/audit-overlap.ts`) against the live pool. The row data behind the
tables (the sketches, the parsed card data, the scores and the overlap
results) is kept as machine-readable files with the session's scratch
tooling, so transcription can be mechanical; the tables here are rendered
from it.

**Batches.** 1: Ultra Rares and Double Super Rares, the identity layer, with
the split lord. 2: Super Rares. 3: Rares. 4: Commons. 5: the tokens, the
Stampede theme deck, the summit pair and the self-audit. The protect-first
list and a projected cut close the document, so the owner's cut starts from a
proposal.

## Rarity and colour targets

Cut: **82 C / 49 R / 15 SR / 11 SSR / 9 UR = 166** (B3 ruled 8 UR and
165; the owner raised Ultra Rare to 9 for Vyra on 2026-09-29). Overplan:
104 / 62 / 19 / 14 / 12 = 211. Colour split at 165 (brief section 4): G 34,
R 32, W 29, U 25, B 25, multicolour 12, colourless 8; at 166 red is 33, the
added card being Vyra. Multicolour only at R and above.

Counts are overplan with the projected cut in brackets:

| Rarity | Overplan | W | U | B | R | G | Multi | Colourless | Projected cut | Target |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| UR | 12 | 2 (1) | 1 (1) | 1 (1) | 3 (2) | 2 (2) | 3 (2) | 0 (0) | 9 | 9 |
| SSR | 14 | 2 (2) | 2 (1) | 2 (2) | 3 (2) | 3 (2) | 2 (2) | 0 (0) | 11 | 11 |
| SR | 19 | 3 (3) | 3 (2) | 3 (2) | 4 (3) | 4 (3) | 1 (1) | 1 (1) | 15 | 15 |
| R | 62 | 10 (8) | 9 (7) | 9 (7) | 11 (8) | 12 (9) | 9 (8) | 2 (2) | 49 | 49 |
| C | 104 | 21 (16) | 17 (14) | 17 (13) | 21 (18) | 24 (17) | 0 (0) | 4 (4) | 82 | 82 |
| **Total** | **211** | **38 (30)** | **32 (25)** | **32 (25)** | **42 (33)** | **45 (33)** | **15 (13)** | **7 (7)** | **166** | **166** |

The projected cut lands on the histogram exactly and on the brief's colour
split within one card (white 30 for 29, green 33 for 34, multicolour 13 for
12, colourless 7 for 8: every colourless row that survived the overlap audit
is kept; red 33 for 32, the one card being Vyra). The bracketed counts
include the owner's F6 swap (2026-09-28): the Great Drum (W, SSR) in,
Fern-Crown Tyrant (G, SSR) out; and Vyra (R, UR, 2026-09-29) in. The
self-audit tables below still show the board before the F6 swap (Vyra is
folded into their Rows column); the swap's deltas are listed there.

## How to read a row

- **Mechanics sketch** is written in the engine's vocabulary so transcription
  is mechanical, in the Drowned Deep overplan's form: `Arrives:`, `Dies:`,
  `During your Dawn:`, `At Sunset:`, `Whenever this attacks,`, `Duty:` (a tap
  ability; `Duty, {1}:` when mana is also paid; the face shows the tap pip),
  `Empower {N}:`, `Skim {N}`, `Retell {N}`, the thirteen keywords by name,
  and `Mark` as the verb. Damage is written `damage <recipient> N`, as the op
  reads (`damage target creature 2`, `damage opponent 1`). `grind self N`
  mills your own deck.
- **The two new mechanics** use the brief's working assumptions (section 9):
  `Provoked: [effect]` triggers when this creature survives damage, at most
  once each turn per creature (B4). Hunt has two forms: the source-bound
  `this hunts another target creature` (on an arrival, an attack, a Duty or
  an Empower) and the spell form `target creature you control hunts another
  target creature`. The prey may be any other creature, yours included (B5);
  `an opponent controls` narrows it where written. **Ruled 2026-09-28 (E6):**
  an arrival or attack Hunt that may reach your side is a forced trigger, so
  it hunts a creature an opponent controls if a legal one exists and is
  forced to hunt another creature you control only when none does (with
  neither, it does nothing); spells, Duties and Empower keep the free
  choice. **Superseded later on 2026-09-28 (the bare-keyword ruling):**
  Hunt is a bare verb keyword like Mark (`[opener], Hunt.`; the spell form
  `Target creature you control Hunts.`), and every Hunt, in every carrier,
  hunts a creature an opponent controls if a legal one exists, otherwise
  another creature you control. **Superseded again the same day (the final
  Hunt ruling):** the generic Hunt's prey is a creature an opponent
  controls, with no fallback (an arrival hunter can't be cast without one);
  card text may override it, declared per card: `any` (any other creature,
  yours included) or `yours` (another creature you control), in templates
  PROPOSED to the owner ("Hunt any other creature.", "Hunt another creature
  you control."). The rows that wanted other prey keep their original
  designs: four through `any` (Korru, Tracker of the Long Grass, Thorn-Hide
  Armourback, Spear and Fang), the three opponent-only rows (Ambusher of the
  Tar Flats, Spear-Sister, Horn-Crest Charger) through the default.
- **Type lines** carry the tribes. **Dinokin** (the dinosaur monster-girls,
  an Axis with lords) always sits beside an inert species (Raptor, Hornback,
  Longneck, Armourback, Tyrant, Skywing, Swimmer). **Dinosaur** is the plain
  beast, on the three dinosaur tokens and eight to nine creature cards.
  **Beastkin** is on exactly four megafauna girls, none a Beastkin payoff.
  The cavewomen are Human with an inert role (Tracker, Shepherd, Firekeeper,
  Elder, Seer, Shaman, Witch, Rider, Scout, Spearwoman, Chief). No row uses
  an existing Axis beyond Dinokin, Dinosaur and Beastkin (Hunter, Warrior and
  Warden are Axes; they are avoided so that old tribal decks do not pick up
  new bodies by accident).
- **Flags.** `VOCAB` names a construct the engine lacks (the construct table
  in the self-audit says exactly what). `NEEDS MATH` names every provisional
  term in the row's score: Provoked, Hunt, the flat lord factor, an observer's
  subtype filter, a `controlsOther` gate, a target limit, or a source aimed
  at your own creature (priced at 0, see below).
- **Δ** is power minus budget on the v4 scorer with the provisional terms
  added; the fair band is plus or minus 0.75 (the Forge's Accurate band).
- **Overlap** is the comparator's finding against the live pool and the rest
  of the set: `clear`, or what it found. "Advisory" marks a creature whose
  body and text beat a shipped vanilla or french-vanilla body at the same
  cost: floors are advisory for creatures (the Drowned Deep rule).
- **Cut** is the cut-priority (`core`: protect; `flex`: cut to make the
  histogram; `stretch`: cut first), `protect` for the protect-first list, and
  `**cut**` when the projected cut drops the row.
- Names are working names until the cut. None contains "Hunt", "Provoke" or
  "Enraged" (checked), none repeats a live card's name (checked against the
  1,500-card catalog), and no card carries flavor text (R13).

## The provisional rates

Provoked and Hunt have no measured rate, and the owner's rule is that a new
mechanic is weighed before cards carrying it ship. Every row that carries
either is flagged NEEDS MATH and is rescored when the lab (A1) measures the
real rates on these shapes.

**Hunt, in two lines.** A Hunt is priced as creature burn equal to the
hunter's Attack on the scorer's own curve, times a survival factor on the
hunter's Defense: `burnCreature(A) × (0.8 + 0.05 × (D − 3))`, held between
0.6 and 0.95. Source-bound hunters use their printed stats; a Hunt spell uses
the scorer's nominal 3/3.2 host plus any pump or Mark on the same card; the
trigger's own multiplier applies on top (arrival 0.75, attack 0.8, spell 1.0
with the Charm premium, Duty at the §4q Duty rate, Empower at the 0.15 rider
share); prey limited to an opponent's creature is 0.95 (no self-provoke
option; since the final Hunt ruling, 2026-09-28, this applies again to the
three opponent-only rows, and whether it now reads on every generic Hunt is
A1.4's to settle). Hunt is primary in green and red (no colour-pie premium), 0.4 in
black, 0.85 elsewhere.

**Provoked, in two lines.** A Provoked effect is priced at the scorer's value
for that effect times how often the creature survives a blow, by Defense:
`0.2 + 0.15 × D`, held between 0.35 and 0.85 (Defense 2: 0.5; 3: 0.65; 4:
0.8; 5 or more: 0.85). A creature whose own Duty can damage it (a
self-provoke engine: Ashka, Sefa) prices its Provoked at the Duty rate (2.0 a
fire less the Duty's mana discount) when that is higher.

**How the constants were set.** Both Magic keywords postdate the anchor era
(fight 2011, enrage 2017), so the anchors are the brief's in-era printings,
scored as our cards on the provisional rate. The Hunt constant 0.8 puts three
of the four fight-shaped creatures inside the band; Tahngarth (a legend with
Sentinel and a paid fight) reads hot at Rare. That reading is partly a
budget artefact: Karplusan Yeti, Tracker and Tahngarth are Magic rares, and
the budget reads rarity, so the table scores every anchor at our Rare and
the Magic rares again at Super Rare; Tahngarth still reads hot at Super
Rare, which the lab's Duty measurement settles. The plain Hunt spell reads fair at {1}{G} or
{G}; the brief's era filter keeps Prey Upon ({G}, 2011) as shape only, so the
common prints at {1}{G}. Rivals' Duel fights two creatures of any controller,
a removal spell our Hunt is not, so it is left out. Provoked's anchors are
the bonus-shaped ones only (brief section 9): Wall of Hope, Saber Ants and
Spitemare pay out even when the creature dies, so they bound the rate from
above and read fair; Fungusaur, Dromad Purebred and Kami of the Honored Dead
read cold, which is the era's own verdict on them (weak rares and filler, not
fair cards).

| Anchor (as our card) | Cost | Stats | Sketch | Δ scored at R | Δ scored at SR (Magic rares) |
| --- | --- | --- | --- | ---: | ---: |
| Stalking Yeti (CSP 2006, uncommon) | {2}{R}{R} | 3/3 | Arrives: this hunts another target creature an opponent controls. | -0.38 |  |
| Karplusan Yeti (9ED 2005, rare) | {3}{R}{R} | 3/3 | Duty: this hunts another target creature. | +0.56 | +0.28 |
| Tracker (DRK 1994, rare) | {2}{G} | 2/2 | Duty, {G}{G}: this hunts another target creature. | -0.13 | -0.41 |
| Tahngarth, Talruum Hero (PLS 2001, rare) | {3}{R}{R} | 4/4 | Sentinel. Duty, {1}{R}: this hunts another target creature. | +1.94 | +1.66 |
| A plain Hunt Ritual at {1}{G}, common | {1}{G} | none | Target creature you control hunts another target creature. | -0.57 |  |
| The same at {G} (Prey Upon's cost, 2011, shape only) | {G} | none | Target creature you control hunts another target creature. | +0.24 |  |
| Wall of Hope (LGN 2003, common; about 2 life a fire) | {W} | 0/3 | Bulwark. Provoked: gain 2 life. | -0.03 |  |
| Saber Ants (MMQ 1999, uncommon; about 2 tokens) | {3}{G} | 2/3 | Provoked: create two Hatchling tokens. | -0.07 |  |
| Spitemare (EVE 2008, uncommon; about 3 damage) | {2}{R}{W} | 3/3 | Provoked: damage any target 3. | +0.14 |  |
| Fungusaur (8ED 2003, rare) | {3}{G} | 2/2 | Provoked: Mark this. | -1.59 | -1.87 |
| Dromad Purebred (RAV 2005, common) | {4}{W} | 1/5 | Provoked: gain 1 life. | -1.55 |  |
| Kami of the Honored Dead (BOK 2005, uncommon; about 3 life) | {5}{W}{W} | 3/5 | Skyborne. Provoked: gain 3 life. | -1.20 |  |

**The two rates' known biases (review, 2026-09-28), stated rather than
corrected.** The owner should read these before ruling on question 1.

- **Hunt puts survival on the burn, not on the body.** When a hunter dies,
  its damage has still been dealt; what is lost is the body. The rate instead
  discounts the burn by the hunter's Defense and charges nothing for the
  lost body, so a glass-cannon hunter (high Attack, low Defense) reads hotter
  than it likely is. Four rows were costed on that reading: Spear-Thrower of
  the Ember Clan, Kesh, Ridge-Raptor and Crag-Leaper. The rate is kept for
  this overplan (switching it now would re-cost every hunter before the lab
  has a number); those four are flagged LAB FIRST and are not moved again on
  any new reading until the lab measures them.
- **Provoked's curve conflates survival with exposure.** High Defense earns
  the top rate, but a wall is also the creature least often damaged when no
  source is aimed at it, so walls may read hot and attackers cold. Two-card
  engines fire every turn but are priced at the passive rate: Vessa with the
  Standing Stone (or any free source), The Walking Mountain and Mother of the
  Long-Necks with a free source, and the whole-side provokes (Ring of
  Embers, War Drums, both on R28's list). They are flagged LAB FIRST, and
  their bodies are not moved again on the provisional rate.

**What the lab replaces** (plan-1.9 lane A, A1): the survival curve on
Defense (how often a creature is damaged and survives is the blind spot the
brief names), the Hunt survival factor and its attack slope, the self-provoke
engine (a Duty or spell that damages your own creature to fire its Provoked;
the self-Hunt arm through an `any` card is live again, A1.3),
and Hunt with each lord on the board (Oru's +1/+1 adds Attack to every
Dinokin hunter).

**Other scorer blind spots, flagged on their rows.** The scorer prices a lord
flat (x2.0 on a creature, x2.8 on an enchantment or artifact; 1.8.5's D10);
an observer's subtype filter at x0.5 and a `controlsOther` gate at x0.6 (both
§4t NEEDS MATH; the scorer ignores a condition on a static, so this overplan
applies the 0.6 by hand); a removal spell's target limit at 0.75 (cost) or
0.8 (Attack), the "cost limit" item plan-1.9 carries from 1.8.5; and damage
aimed only at your own creature at 0, because it is a source, not removal
(the scorer would otherwise price it as creature burn and charge white the
off-pie burn premium). The self-sweep construct (`damageEachYours`) is priced
at 0 for the same reason. **Those 18 rows are cold by construction
and lab-priced:** their cost is set by design and by pool precedent, never
by their delta, and the audit script pins their cost, stats and sketch to a
baseline so that no delta-driven lever can move them unnoticed (the review
of 2026-09-28 reverted four cuts that had been made on that reading).
**Vyra (2026-09-29) is lab-priced for a different reason:** her repeatable
pump has no rate yet and is valued at 0 (NEEDS MATH, A1.5), so her delta is
not evidence either. Her cost is the owner's; the script's pinned baseline
predates her row.

## The split lord (owner ruling 2026-09-28)

**Oru, the Tyrant Queen** takes the Tyrant Queen's slot (UR, R/G,
legendary, R28's portrait and Darling): {4}{R}{G} 5/5, Overrun. *Your other
Dinokin get +1/+1. Your Dinosaurs have Dreaded.*

- The Dinokin half is the brief's own UR line (the one Attack lord).
- The Dinosaur half is a keyword, not a stat: Dreaded on Pack Raptors,
  Hatchlings, Gliders and the plain beast cards makes a token swarm hard to
  block without adding Attack to it, so the anthem-on-swarm trap
  (card-building-guide section 3) stays closed and a Dinosaur hunter's
  removal does not grow.
- It makes Dinosaur an Axis (an `axes.ts` entry, no new construct: one
  subtype per static, two statics on the card). Every other lord stays
  Dinokin only, which settles the brief's open question 1: the matriarch no
  longer reaches Dinosaurs.
- Why this slot and not a new UR: R28's deck plays Pack Raptors and Dinokin
  both, and the Stampede note in the brief ("the Overrun lord skips them")
  names the gap the split fills. A new UR would make a fourth lord and push
  the UR count past the histogram.
- The alternatives, for the owner: Warcry (Pack Raptors already have it),
  +0/+1 and Sentinel (the matriarch's shape, which the ruling keeps on
  Dinokin), Overrun (near-blank on 1/1s). **Ruled 2026-09-28 (F2):
  Dreaded**, and the matriarch stays Dinokin only (F8).

## Ultra Rare (12; cut keeps 9)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-sefa-first-fire` | Sefa, Keeper of the First Fire | W | Creature, Human Firekeeper, legendary | {2}{W}{W} | 2/5 | Sentinel. Duty, {1}: damage target creature you control 1, then gain 1 life. Provoked: create a Hatchling token and gain 2 life. | NEEDS MATH: Provoked (self-provoke engine), self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | -0.08 | clear | core | White's block-shaped Provoked flagship and a source at once: she can burn herself at the fire for a Hatchling a turn, or provoke a wall. Hatchling minter. Priced as a self-provoke engine (the Duty rate, NEEDS MATH). |
| `fd-painted-cave` | The Painted Cave | W | Enchantment, legendary | {1}{W}{W} | none | Your creatures get +0/+1. Duty: target creature you control gets +0/+2 until Sunset. During your Dawn: Mark target creature you control. |  | -0.01 | clear | flex, **cut** | The white Duty showcase from the brief: a Defense shield that keeps provoked creatures alive, a Mark each Dawn for the herd. Ongoing board text (no one-shot non-creature). Pilot art case 9 (cave art, no text, no tally). |
| `fd-nyra-cliff-nests` | Nyra, Queen of the Cliff Nests | U | Creature, Dinokin Skywing, legendary | {4}{U}{U} | 4/4 | Skyborne. Arrives: create a Glider token. Duty, {2}: tap target creature. |  | +0.50 | clear | core | Blue's pterosaur Dinokin and the Sky clan's top: a flier, a Glider, and a tapper. Blue answers without damage. Blue's Dinokin flagship; Glider minter. |
| `fd-oshka-tar-mother` | Oshka, Mother of the Tar Flats | B | Creature, Human Shaman, legendary | {3}{B}{B} | 3/5 | Arrives: grind self 3. Duty, {1}{B}: return target creature card from your graveyard to your hand. Dies: create a Tar-Bones token. |  | -0.18 | clear | core | The fossil line's apex (brief section 4, item 3): grinds her own deck and reclaims from it every turn. Reclaim, not raise, so the engine is card advantage, not a free body a turn. Tar-Bones minter. |
| `fd-ashka-fire-walker` | Ashka, Who Walks in Fire | R | Creature, Human Firekeeper, legendary | {2}{R}{R} | 3/3 | Warcry. Duty, {R}: damage target creature 1. Provoked: damage opponent 2. | NEEDS MATH: Provoked (self-provoke engine) | +0.39 | clear | core | Red's self-damage showcase: the Duty is a ping for their X/1s or a source for your own Provoked creatures, herself included (tap, 1 to herself, 2 to the face; P2 caps it at once a turn). No Provoked effect hits your own side (P3). |
| `fd-rakka-red-pack` | Rakka, Queen of the Red Pack | R | Creature, Dinokin Raptor, legendary | {3}{R}{R} | 4/4 | Warcry. Whenever this attacks, create a Pack Raptor token. Whenever another Dinokin you control attacks, damage opponent 1. | NEEDS MATH: observer filter x0.5 | -0.09 | clear | flex, **cut** | The raptor warband's top: every attack grows the pack. Pack Raptors are Dinosaurs, so they do not feed her second line; the Dinokin observer is the `allyAttacks` subtype filter the brief lists. Pack Raptor minter. |
| `fd-vessa-great-horn` | Vessa, the Great Horn | G | Creature, Dinokin Hornback, legendary | {3}{G}{G} | 5/6 | Warding Gaze. Your creatures with Marks have Overrun. Provoked: Mark each other creature you control. | NEEDS MATH: Provoked; LAB FIRST: Two-card engine: with the Standing Stone (or any free source) she fires every turn, priced at the passive rate | +0.08 | clear | core | Green's Provoked flagship: striking her marks the herd. Six Defense means she survives almost every blow, so Provoked fires often; the Overrun static turns the Marks into reach. Not a lord (no subtype filter). |
| `fd-korru-eldest-tracker` | Korru, Eldest of the Trackers | G | Creature, Human Tracker, legendary | {3}{G}{G} | 4/5 | Duty, {1}{G}: Hunt any other creature. | OVERRIDE `any` (ruled 2026-09-28: card text may state its prey; restores the original self-hunt design; PROPOSED template); NEEDS MATH: Hunt | +0.63 | clear | core | Duty Hunt 1 of 2 (H5: SR and above, mana in the Duty). Tahngarth's shape ({3}{R}{R} 4/4, {1}{R}, {T}: fight) moved to green, where Hunt is primary. May hunt her own Provoked creatures (B5). Five Defense: she survives most prey. |
| `fd-oru-tyrant-queen` | Oru, the Tyrant Queen | R/G | Creature, Dinokin Tyrant, legendary | {4}{R}{G} | 5/5 | Overrun. Your other Dinokin get +1/+1. Your Dinosaurs have Dreaded. | NEEDS MATH: lord x2.0 (flat, D10) | +0.34 | clear | core, protect | THE SPLIT LORD (owner ruling 2026-09-28), in the Tyrant Queen's slot: R28's portrait and Darling, the one Attack lord. Dinokin get +1/+1; plain Dinosaurs (Pack Raptors, Hatchlings, Gliders, the beast cards) get Dreaded instead, which makes a token swarm hard to block without adding Attack to it (the anthem-on-swarm trap stays closed). Makes Dinosaur an Axis. |
| `fd-tahla-shepherdess` | Tahla, Shepherdess of Thunder | G/W | Creature, Human Shepherd, legendary | {2}{G}{W} | 3/4 | Sentinel. During your Dawn: create a Hatchling token. Whenever a creature arrives under your control, gain 1 life. |  | +0.32 | clear | core, protect | R27's portrait and Darling (the G/W herd): a Hatchling every Dawn and life for every body. Hatchling minter. |
| `fd-venna-red-hand` | Venna Red-Hand, War-Chief | R/W | Creature, Human Chief, legendary | {2}{R}{W} | 3/3 | Your other creatures get +1/+0 and have Sentinel. Duty, {1}{R}: damage target creature 1. |  | -0.26 | clear | flex, **cut** | The R/W warband's chief (the sweep persona D12 names): an anthem for the war-party and a paid ping that provokes her own walls or finishes theirs. Not a Dinokin lord (no subtype). |
| `fd-vyra-ember-sky-rider` | Vyra, Ember-Sky Rider | R | Creature, Human Rider, legendary | {4}{R}{R} | 5/5 | Skyborne. {R}: this gets +1/+0 until Sunset (no tap; any number of times, at Charm speed). | NEEDS MATH: repeatable mana pump (A1.5) | -1.01 | not yet run | core, protect (owner, 2026-09-29) | The owner's addition (2026-09-29), the set's Shivan Dragon, the 8th-10th edition anchor ({4}{R}{R} 5/5 flying, firebreathing). The set's only red Skyborne card, a pie exception at Ultra Rare (the brief gives the sky to W/U). A Human Rider on a plain pterosaur (D2: riders are not Dinokin; the mount is a plain Dinosaur beast, not a second card). Scored without the pump: power 6.43 against a budget of 7.44 (body 5/5 +4.58, Skyborne at Attack 5 +1.85); the pump is valued 0 until the lab, so the row is lab-priced and its delta is not evidence, and the priced pump fills the gap. The pump is a new construct (A1.5): one action pays for N activations, which the Duel UI shows as a +/- ticker. Carries no Provoked, no Hunt, no source, no Duty and no token. Working name. |

## Double Super Rare (14; cut keeps 11)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-long-neck-mother` | Mother of the Long-Necks | W | Creature, Dinokin Longneck | {4}{W}{W} | 4/7 | Sentinel. Provoked: create a Hatchling token and Mark target creature you control. | NEEDS MATH: Provoked; LAB FIRST: Two-card engine: with a free source she calves and marks every turn, priced at the passive rate | +0.15 | clear | core | White's block-shaped Provoked Dinokin: a seven-Defense long-neck that makes and marks the herd every time she is struck and lives. Hatchling minter. |
| `fd-great-drum` | The Great Drum of the Hearth | W | Artifact, legendary | {3}{W} | none | Your creatures get +0/+1. Duty, {1}: tap target creature. Duty, {2}{W}: create a Hatchling token. |  | -0.24 | clear | flex; kept (F6, 2026-09-28) | The Drum from the brief's white Duty row, at its top: tap an attacker or call a Hatchling, one a turn (the two Duties share the tap). Hatchling minter. Back on the projected board by the owner's F6: a white Duty showcase card, in place of Fern-Crown Tyrant. |
| `fd-frost-seer` | Frost-Seer of the Ice Wall | U | Creature, Human Seer | {3}{U}{U} | 2/5 | Duty: tap target creature. During your Dawn: Foresee 1. |  | +0.17 | clear | core | The Ice clan's frost-seer (blue Duty: tap target creature). Blue answers without damage, so she stops a Provoked attacker without provoking it. |
| `fd-kree-wind-crest` | Kree of the Wind-Crest | U | Creature, Dinokin Skywing | {2}{U}{U} | 3/3 | Skyborne. Arrives: recall target creature an opponent controls with cost 3 or less. Whenever another Dinokin you control attacks, Foresee 1. | NEEDS MATH: observer filter x0.5, target limit | +0.27 | advisory: a creature above 1 shipped body (Zhong Hui, Gilded Prodigy) | flex, **cut** | A blue Dinokin pterosaur that clears a small blocker and scouts for the herd. Recall wipes damage (a recalled creature loses its damage), blue's quiet answer to Provoked. |
| `fd-rise-from-tar` | Rise From the Tar | B | Ritual | {3}{B}{B} | none | Return target creature card from your graveyard to the battlefield. Create a Tar-Bones token. |  | -0.12 | clear | core | The fossil line's reanimation spell (reanimator is the weakest persona, brief section 4): a body back and a fossil beside it. Tar-Bones minter. |
| `fd-nirra-ash-witch` | Nirra the Ash-Witch | B | Creature, Human Witch | {2}{B}{B} | 3/3 | Deathblade. Provoked: opponent loses 2 life and you gain 2 life. | NEEDS MATH: Provoked | -0.48 | clear | core | Black's Provoked (a few: drains when struck). Deathblade kills what she fights, but it does nothing for her own survival: at Defense 3 she is provoked by pings and small attackers, and dies to anything big that blocks or is blocked by her. |
| `fd-ember-crest-tyrant` | Ember-Crest Tyrant | R | Creature, Dinokin Tyrant | {3}{R}{R} | 5/4 | Warcry. Provoked: damage target creature an opponent controls 2. | NEEDS MATH: Provoked | +0.04 | clear | core | Red's Provoked tyrant: strike her and she burns back (never your own side, P3). Warcry makes her attack into blocks the turn she lands. |
| `fd-kesh-raptor-rider` | Kesh, Raptor-Rider | R | Creature, Human Rider | {2}{R} | 3/2 | Warcry. Whenever this attacks, Hunt. | RULED template (bare keyword, 2026-09-28); NEEDS MATH: Hunt; LAB FIRST: Hunt-rate bias: a glass-cannon hunter (see Spear-Thrower) | +0.07 | clear | core | The set's attack-trigger hunter (brief: 1): she clears a blocker as she charges, and usually trades with anything of Attack 2 or more. A rider, typed after the woman (D2). Pilot art case 1. |
| `fd-uzza-war-painter` | Uzza the War-Painter | R | Creature, Human Shaman | {2}{R}{R} | 3/3 | Arrives: damage each other creature you control 1, then your creatures get +2/+0 until Sunset. | VOCAB damageEachYours; NEEDS MATH: self-sweep at 0; LAB-PRICED: cold by construction, never moved by its delta | -1.05 | clear | flex, **cut** | Cold by construction, lab-priced: its main term is a source aimed at your own side, which the scorer prices at 0, so its cost is set by design and pool precedent, never by its delta. The war-drum source (VOCAB damageEachYours, 1 of 4): she paints the whole war-party at once, provoking every survivor and sending them in two points bigger. Anti-synergy with Hatchlings is the point: this is red, not the G/W herd. |
| `fd-walking-mountain` | The Walking Mountain | G | Creature, Dinosaur Longneck | {5}{G}{G} | 6/7 | Warding Gaze. Provoked: create two Hatchling tokens. | NEEDS MATH: Provoked; LAB FIRST: Two-card engine: with a free source it calves two Hatchlings a turn, priced at the passive rate | +0.59 | clear | core | The SSR plain Dinosaur (brief: 1 SSR): a sauropod big enough that every blow it survives hatches the herd. Hatchling minter. Pilot art case 2 (scale). |
| `fd-fang-and-horn` | Fang and Horn | G | Charm | {1}{G}{G} | none | Target creature you control gets +2/+2 until Sunset, then it Hunts. | RULED template (bare keyword, 2026-09-28); VOCAB keywordTarget, distinctSpellTargets; NEEDS MATH: Hunt; LAB FIRST: Deathblade host: Nirra the Ash-Witch hunting with this kills and is provoked | -0.17 | clear | core | The flagship Hunt spell: the pump makes the hunter survive and win, at Charm speed (a combat trick that is also removal). Costed on a nominal 3/3.2 hunter plus the pump. |
| `fd-fern-crown-tyrant` | Fern-Crown Tyrant | G | Creature, Dinokin Tyrant | {4}{G}{G} | 5/5 | Arrives, if you control another Dinokin: Hunt. Provoked: Mark this twice. | RULED template (bare keyword, 2026-09-28); NEEDS MATH: Provoked, Hunt | +0.28 | clear | core, **cut** (F6, 2026-09-28) | The Dinokin-conditioned arrival Hunt the brief lists (`controlsOther`), on a tyrant that grows when it survives its own hunt (B7: a hunter provoked by its own Hunt damage is intended). Attack 5 is allowed at SSR (the H5 cap is below SR). Dropped from the projected board by the owner's F6 so the Great Drum stays; green keeps two Double Super Rares. The condition is checked at cast (A1.1c, ruled 2026-09-29): without another Dinokin the card is cast with no prey and is castable whether or not prey exists; with one, it needs prey to be cast. |
| `fd-sky-riders-pact` | Asha and Shree, Sky-Riders | W/U | Creature, Human Rider | {4}{W}{U} | 3/3 | Skyborne. Arrives: create two Glider tokens. |  | +0.47 | clear | core | The W/U sky rider the token plan names (Glider minter): three fliers in one card for the pterosaur-and-taps pair. |
| `fd-grave-fern-stalker` | Grave-Fern Stalker | B/G | Creature, Human Tracker | {3}{B}{G} | 4/4 | Arrives: Hunt. Dies: create a Tar-Bones token. | RULED template (bare keyword, 2026-09-28); NEEDS MATH: Hunt | +0.64 | clear | core | B/G (Hunt plus fossils): a hunter whose death leaves a fossil, so a Hunt that trades still leaves a body. A multicolour Hunt row; Tar-Bones minter. |

## Super Rare (19; cut keeps 15)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-long-neck-matriarch` | Long-Neck Matriarch | W | Creature, Dinokin Longneck | {3}{W} | 2/5 | Your other Dinokin get +0/+1 and have Sentinel. | NEEDS MATH: lord x2.0 (flat, D10) | +0.72 | clear | core, protect | THE MATRIARCH LORD (brief section 2): Defense is a Provoked shield, so the herd survives the blow and is provoked. Dinokin only (owner ruling 2026-09-28, which settles the brief's open question 1; the one lord that reaches Dinosaurs is Oru). |
| `fd-standing-stone` | The Standing Stone | W | Artifact | {2}{W} | none | Duty: damage target creature you control 1, then Mark it. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | -1.31 | clear | core | Cold by construction, lab-priced: its main term is a source aimed at your own side, which the scorer prices at 0, so its cost is set by design and pool precedent, never by its delta. The brief's white Duty source: strike your own creature at the stone and mark it, so the blow provokes and the Mark keeps it alive. White's repeatable source (white needs 3 sources, 2 at C). |
| `fd-bone-wall-elder` | Elder of the Bone Wall | W | Creature, Human Elder | {2}{W} | 1/5 | Bulwark. Provoked: gain 2 life and Mark target creature you control. | NEEDS MATH: Provoked | -0.51 | clear | flex | White's block-shaped payoff: a wall that is never the hunter (Bulwark, H3a) and pays the herd a Mark whenever it is struck and holds. |
| `fd-sea-lizard` | The Deep Swimmer | U | Creature, Dinosaur Swimmer | {4}{U}{U} | 5/5 | Untouchable. Arrives: recall target creature an opponent controls. |  | -0.18 | clear | core | The blue plain Dinosaur (brief: the sea-lizard). Recall wipes damage and tempo at once. Pilot art: a sea-lizard alone. |
| `fd-ice-keeper` | Keeper of the Ice Wall | U | Creature, Human Seer | {3}{U} | 1/4 | Arrives: grind self 3. Duty: Foresee 1, then draw a card, then discard a card. |  | +0.20 | clear | core | Blue's side of the fossil line: grinds and loots, feeding the Tar clan's raise and reclaim cards. |
| `fd-frozen-in-the-ice` | Frozen in the Ice | U | Charm | {U}{U} | none | Tap target creature. Draw a card. Foresee 1. |  | -0.13 | clear | flex, **cut** | The frost-seer's answer at Charm speed: a tap that does not provoke, plus a card. |
| `fd-tar-flat-ambusher` | Ambusher of the Tar Flats | B | Creature, Human Tracker | {4}{B} | 3/3 | Arrives: Hunt. Dies: create a Tar-Bones token. | RULED template (bare keyword, 2026-09-28); the default prey, an opponent's creature only, restores the original opponent-only design; the provisional 0.95 opponent-only factor applies again; NEEDS MATH: Hunt | +0.49 | clear | core | Black's one Hunt (brief: at most one, SR or above), on the Stalking Yeti shape (prey an opponent's creature). No Deathblade on a hunter (H5). Tar-Bones minter. |
| `fd-bone-caller` | Bone-Caller of the Tar | B | Creature, Human Shaman | {3}{B}{B} | 2/4 | Arrives: grind self 3. Whenever another creature you control dies, create a Tar-Bones token. |  | +0.38 | clear | core | The black dies-trigger body the token plan names: every death on your side raises a fossil. Tar-Bones minter; fossil line. |
| `fd-ash-witch-edict` | Ash on the Wind | B | Charm | {1}{B} | none | Opponent sacrifices a creature. Grind self 2. |  | -0.14 | clear | flex, **cut** | Black answers without damage (brief section 2): an edict never provokes and ignores Mark shields. |
| `fd-fire-pit` | The Fire-Pit | R | Artifact | {2} | none | Duty, {R}: damage target creature you control 1, then it gets +2/+0 until Sunset. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | -0.03 | clear | core | The red Duty artifact from the brief ("a paid ping at your own creature"): a pure source that pays itself back as a pump, so a Provoked attacker walks into combat struck and bigger. Aimed only at your own side, so it is never removal. |
| `fd-ring-of-embers` | Ring of Embers | R | Ritual | {1}{R} | none | Damage each creature 1. Your creatures get +1/+0 until Sunset. | LAB FIRST: Two-card engine: provokes every Provoked creature on your side at once (on R28's list) | -0.45 | clear | core | Sweep of 1, number 1 of at most 3 (brief section 4): provokes every survivor on both sides, then your side swings harder. It kills Hatchlings, which keeps it out of the G/W herd. |
| `fd-blood-horn-brute` | Blood-Horn Brute | R | Creature, Dinokin Hornback | {3}{R} | 3/4 | Provoked: create a Pack Raptor token. | NEEDS MATH: Provoked | +0.66 | clear | core | The red Provoked rare shape the token plan names (Pack Raptor minter): strike it and the pack answers. |
| `fd-crag-leaper` | Crag-Leaper | R | Creature, Dinokin Raptor | {2}{R}{R} | 4/3 | Warcry. Arrives, if you control another Dinokin: Hunt. | RULED template (bare keyword, 2026-09-28); NEEDS MATH: Hunt; LAB FIRST: Hunt-rate bias: a glass-cannon hunter (see Spear-Thrower) | +0.19 | clear | flex, **cut** | Red's Hunt is high Attack, low Defense (brief section 2). Warcry: she hunts, then attacks the same turn if she lives. Dinokin-conditioned (`controlsOther`). The condition is checked at cast (A1.1c, ruled 2026-09-29): without another Dinokin the card is cast with no prey and is castable whether or not prey exists; with one, it needs prey to be cast. |
| `fd-tracker-long-grass` | Tracker of the Long Grass | G | Creature, Human Tracker | {2}{G}{G} | 2/4 | Warding Gaze. Duty, {2}{G}: Hunt any other creature. | OVERRIDE `any` (ruled 2026-09-28: card text may state its prey; restores the original self-hunt design; PROPOSED template); NEEDS MATH: Hunt | -0.69 | clear | core | Duty Hunt 2 of 2 (H5: SR and above, with mana in the Duty). The brief's "tracker": a paid Hunt a turn at Attack 2, so she picks off X/2s and sets up self-provokes rather than killing big things (Korru is the big one). Green's repeatable answer to fliers too (Warding Gaze). |
| `fd-wild-tyrant` | The Wild Tyrant | G | Creature, Dinosaur Tyrant | {4}{G}{G} | 7/5 | Rage. Provoked: Mark this. | NEEDS MATH: Provoked | -0.42 | clear | core | A plain Dinosaur at SR (brief: 2 SR): the beast alone, answering to no one (Rage). Every blow it survives makes it bigger. Pilot art case 3 is a hunter facing one of these. |
| `fd-ambush-at-the-river` | Ambush at the River | G | Ritual | {3}{G} | none | Target creature you control gets +1/+1 until Sunset, then it Hunts. Draw a card. | RULED template (bare keyword, 2026-09-28); VOCAB keywordTarget, distinctSpellTargets; NEEDS MATH: Hunt | +0.42 | clear | core | The card-advantage Hunt spell: removal that replaces itself. Ritual speed, so it is never a combat trick (Fang and Horn is the trick). |
| `fd-nest-keeper` | Nest-Keeper of the Fern | G | Creature, Human Shepherd | {2}{G} | 1/3 | Duty, {1}{G}: create a Hatchling token. |  | -0.01 | clear | flex, **cut** | The repeatable Hatchling Duty for the G/W herd (green herd-caller). Priced like Drowned Deep's Kelp-Shade Caller for a 1/1 instead of a 2/2. Hatchling minter. |
| `fd-ice-and-tar` | Ice-and-Tar Seer | U/B | Creature, Human Seer | {2}{U}{B} | 2/4 | Arrives: grind self 3. Duty, {1}: return target creature card from your graveyard to your hand. |  | +0.21 | clear | core | U/B, the fossil line (brief item 3): the pair's grind-and-reclaim engine. |
| `fd-obsidian-knife` | The Obsidian Knife | C | Artifact | {3} | none | Duty, {3}: damage target creature 1, then it gets +1/+0 until Sunset. |  | +0.35 | clear | flex | The colourless source (brief: 1): cut your own creature to provoke and sharpen it, or finish an X/1. (A bare ping reprinted Forge-Lamp at a colourless Duty.) |

## Rare (62; cut keeps 49)

### White (10; cut keeps 8)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-clan-hearth` | The Clan Hearth | W | Enchantment | {1}{W} | none | Duty: gain 2 life. At Sunset, if a creature died this turn: gain 2 life. |  | -0.16 | clear | core | The Hearth from the brief's white Duty row: life every turn, more on a turn something fell. Ongoing text. |
| `fd-longneck-herd` | The Long-Neck Herd | W | Creature, Dinosaur Longneck | {4}{W} | 3/6 | Sentinel. Provoked: create a Hatchling token. | NEEDS MATH: Provoked | +0.53 | clear | core | The white plain Dinosaur (brief: W 1): a herd that calves when it is struck and holds. Hatchling minter. |
| `fd-brow-plate` | Brow-Plate Armourback | W | Creature, Dinokin Armourback | {2}{W} | 1/4 | Sentinel. Duty: target creature you control gets +0/+2 until Sunset. |  | +0.45 | clear | flex, **cut** | The Painted Cave's shield on a body (a white Duty creature): the struck creature survives to be provoked. A shield, not a payoff (density revision). |
| `fd-woolly-rhinokin` | Woolly Rhinokin Guard | W | Creature, Beastkin Rhino | {3}{W} | 3/4 | Sentinel. Provoked: gain 2 life and this gets +0/+2 until Sunset. | NEEDS MATH: Provoked | +0.53 | clear | core | Beastkin 4 of 4 (the Woolly Rhino girl). A white wall that hardens when struck. Not a Beastkin payoff. |
| `fd-elders-verdict` | The Elders' Verdict | W | Ritual | {2}{W}{W} | none | Sever target creature with attack 4 or more. Gain 2 life. | NEEDS MATH: target limit | -0.64 | clear | core | White's answer to the big beasts. Sever, so a Provoked tyrant does not come back. |
| `fd-drum-keeper` | Drum-Keeper of the Hearth | W | Creature, Human Elder | {2}{W} | 2/2 | Duty, {1}: tap target creature. |  | +0.47 | clear | core | White Duty creature 2 (every colour at least two): the Drum on a body. |
| `fd-scar-rite-elder` | Scar-Rite Elder | W | Creature, Human Elder | {1}{W} | 2/2 | Arrives: damage target creature you control 1, then Mark it. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | +0.20 | advisory: a creature above 1 shipped body (Guan Suo, Blossom Blade) | core | White's one-shot source: the scarring rite. The damage provokes, the Mark keeps the creature alive and bigger. If she is the only creature, she marks herself. |
| `fd-herd-horn` | The Herd-Horn | W | Artifact | {3} | none | Duty, {2}{W}: create a Hatchling token. |  | -0.61 | clear | core | The Herd-Horn Duty artifact the token plan names. The {2}-rider rule for paid Duties on artifacts (Drowned Deep, 2026-09-11). Hatchling minter. |
| `fd-trial-by-ember` | Trial by Ember | W | Ritual | {1}{W} | none | Damage each creature you control 1. Mark each creature you control. | VOCAB damageEachYours; NEEDS MATH: self-sweep at 0; LAB-PRICED: cold by construction, never moved by its delta | -1.32 | clear | core | Cold by construction, lab-priced: its main term is a source aimed at your own side, which the scorer prices at 0, so its cost is set by design and pool precedent, never by its delta. The herd's scarring rite: every creature is struck and marked at once, so every survivor is provoked and bigger. White's war-drum source (VOCAB damageEachYours, 4 of 4). Kills your own X/1s, Hatchlings included, before the Mark lands: the cost of the rite. (Replaces Dawn-Wing Skywing in the density revision: white had 14 payoffs and 6 sources.) |
| `fd-sun-hold` | Hold Until Sunrise | W | Charm | {W} | none | Target creature you control gets +1/+3 until Sunset. Gain 2 life. |  | -0.05 | clear | flex, **cut** | White's combat shield: a blocker that survives is a blocker that is provoked. |

### Blue (9; cut keeps 7)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-nest-mother` | Nest-Mother of the Cliffs | U | Creature, Human Rider | {3}{U} | 1/3 | Duty, {2}{U}: create a Glider token. |  | +0.60 | clear | core | The repeatable Glider maker (Glider minter). Blue Duty creature. |
| `fd-meltwater` | Swept by the Meltwater | U | Charm | {2}{U} | none | Recall target creature. Draw a card. Grind self 1. |  | +0.01 | clear | core | Blue's answer to a Provoked creature: a recalled creature loses its damage and its Marks, the card replaces itself, and the melt feeds the fossil line. (Recall and draw alone reprinted two shipped Super Rares.) |
| `fd-thaw-old-bones` | Thaw the Old Bones | U | Ritual | {1}{U} | none | Return target creature card from your graveyard to your hand, then grind self 4. |  | -0.72 | clear | core | The blue fossil card: dig into the ice and bring one back. (Grind 4 and draw reprinted The Long Drying at a new cost.) |
| `fd-ice-speaker` | Ice-Speaker | U | Creature, Human Seer | {1}{U} | 1/2 | Duty, {2}: tap target creature. |  | +0.33 | clear | core | The cheap frost-seer (blue Duty: tap target creature). |
| `fd-wind-over-nests` | Wind Over the Cliff Nests | U | Ritual | {2}{U} | none | Create a Glider token. Draw a card. |  | +0.44 | clear | core | A flier and a card (Glider minter). |
| `fd-cliff-top-scout` | Cliff-Top Scout | U | Creature, Human Scout | {1}{U} | 1/1 | Skyborne. Arrives: Foresee 2. |  | -0.14 | clear | flex | The blue scout (brief: scouts, Foresee). |
| `fd-ice-wall-denial` | The Ice Wall Holds | U | Charm | {3}{U}{U} | none | Cancel target spell. Create a Glider token. |  | +0.15 | clear | core | Blue's hard counter at Rare. (Cancel and draw reprinted two shipped Super Rares; cancel and Foresee 2 reprinted Collapse the Lane at a new cost. Cancel and grind 2 reprinted Wrong Door. Here the counter leaves a pterosaur behind: a Glider minter.) |
| `fd-river-lurker` | River-Lurker | U | Creature, Dinokin Swimmer | {2}{U} | 2/3 | Whenever this attacks, tap target creature an opponent controls. |  | -0.43 | advisory: a creature above 2 shipped bodies (Lu Su, Generous Diplomat; Xiahou Hui, Wary Bride) | flex, **cut** | A blue swimming Dinokin that pulls a blocker under as it comes: one of blue's few Dinokin. |
| `fd-ice-mirror-seer` | Ice-Mirror Seer | U | Creature, Human Seer | {1}{U}{U} | 1/3 | Duty, {2}{U}: Foresee 1, then draw a card. |  | +0.35 | clear | flex, **cut** | A blue Duty draw engine on a body (replaces Frost-Bite, which reprinted three commons). |

### Black (9; cut keeps 7)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-sabrekin-prowler` | Sabrekin Prowler | B | Creature, Beastkin Sabretooth | {2}{B}{B} | 3/2 | Deathblade. Dreaded. Skim {B}. |  | -0.33 | clear | core | Beastkin 3 of 4 (the Sabertooth girl, the Tar clan's cave cats). No Hunt (black's one Hunt is the Ambusher; never Deathblade on a hunter below SR). |
| `fd-tar-bubbles` | The Tar Bubbles | B | Ritual | {2}{B} | none | Grind self 3. Create a Tar-Bones token. Retell {3}{B}. |  | +0.51 | clear | core | The black tar Ritual the token plan names: a fossil from the tar and three cards for the graveyard, and it comes back up once more. Tar-Bones minter. |
| `fd-bones-in-the-tar` | Bones in the Tar | B | Ritual | {1}{B} | none | Return target creature card with cost 3 or less from your graveyard to the battlefield. | NEEDS MATH: target limit | -0.39 | clear | flex, **cut** | The cheap raise (fossil line), capped at cost 3 by the existing `maxCost` target limit. |
| `fd-tar-fang-raptor` | Tar-Fang Raptor | B | Creature, Dinokin Raptor | {1}{B}{B} | 2/2 | Deathblade. Dies: grind self 2. |  | -0.52 | clear | core | Black Dinokin 1 of 2 (brief: B 2): a raptor that stains the tar. Deathblade is black's counter to a Provoked creature in combat. |
| `fd-swallowed-by-tar` | Swallowed by the Tar | B | Charm | {2}{B} | none | Destroy target creature with cost 4 or less. Grind self 2. | NEEDS MATH: target limit | -0.45 | clear | core | Black's mid-cost kill. Destroy, not damage, so it never provokes. |
| `fd-ash-witch-drain` | Ash-Witch of the Flats | B | Creature, Human Witch | {2}{B} | 1/3 | Duty, {1}{B}: opponent loses 1 life and you gain 1 life. |  | -0.55 | clear | core | Black Duty creature 2 (every colour at least two). |
| `fd-tar-pit` | The Tar Pit | B | Enchantment | {4}{B} | none | Duty, {3}{B}: create a Tar-Bones token. |  | +0.20 | clear | core | The black Duty enchantment (brief: B 1): a fossil a turn, priced on the Drowned Deep Deep-Spawn Hatchery lesson (a repeatable 2/2 on a non-creature is dear). Tar-Bones minter. |
| `fd-ash-rite` | Ash-Rite | B | Ritual | {2}{B} | none | Each player sacrifices a creature. Create a Tar-Bones token. |  | +0.02 | clear | flex, **cut** | The symmetric edict that leaves you a fossil: sacrifice a Hatchling, keep the bones. |
| `fd-tar-skin-brute` | Tar-Skin Brute | B | Creature, Human Spearwoman | {3}{B} | 2/5 | Provoked: opponent loses 1 life and you gain 1 life. | NEEDS MATH: Provoked | -0.12 | clear | core | Black's second Provoked payoff (brief: black needs two, one at common, which is Tar-Skin Wall): a tar-smeared wall that drains when struck. |

### Red (11; cut keeps 8)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-call-the-pack` | Call the Pack | R | Ritual | {3}{R} | none | Create two Pack Raptor tokens. |  | +0.16 | clear | core | The Ritual that calls two (token plan). Pack Raptor minter. |
| `fd-magma-back` | Magma-Back Armourback | R | Creature, Dinokin Armourback | {3}{R} | 2/5 | Provoked: damage opponent 2. | NEEDS MATH: Provoked | +0.05 | clear | core | A red wall that burns back at the player whenever it survives a hit: the attacker has to kill it or pay. |
| `fd-rage-horn` | Rage-Horn Tyrant | R | Creature, Dinokin Tyrant | {1}{R}{R} | 4/3 | Rage. Provoked: Mark this. | NEEDS MATH: Provoked | -0.05 | clear | core | A red tyrant that must attack and grows each time it survives: Rage and Provoked pull the same way. |
| `fd-war-drums` | War Drums of the Ember Clan | R | Ritual | {1}{R} | none | Damage each creature you control 1. Your creatures get +2/+0 and gain Warcry until Sunset. | VOCAB damageEachYours; NEEDS MATH: self-sweep at 0; LAB-PRICED: cold by construction, never moved by its delta; LAB FIRST: Two-card engine: provokes the whole side at once; also cold by construction | -0.57 | clear | core | The war-drum source (VOCAB damageEachYours, 2 of 4): provoke the whole war-party at once and send it in. Kills your own X/1s, Pack Raptors included; red pays for it. |
| `fd-kindler` | Kindler of the Ember Clan | R | Creature, Human Firekeeper | {1}{R} | 1/2 | Duty, {R}: damage target creature 1. |  | +0.43 | clear | core | Red's cheap repeatable source (the fire-pit on a body): provoke your own creature every turn or finish their X/1s. Red Duty creature. |
| `fd-spear-sister` | Spear-Sister of the Ember Clan | R | Creature, Human Spearwoman | {2}{R}{R} | 3/3 | Arrives: Hunt. | RULED template (bare keyword, 2026-09-28); the default prey, an opponent's creature only, restores the original opponent-only design; the provisional 0.95 opponent-only factor applies again; NEEDS MATH: Hunt | -0.38 | clear | core | Stalking Yeti exactly ({2}{R}{R} 3/3, arrives and fights a creature an opponent controls: the brief's arrival anchor), in red where the era printed it. |
| `fd-duel-on-the-ridge` | Duel on the Ridge | R | Charm | {2}{R} | none | Target creature you control gets +2/+0 until Sunset, then it Hunts. | RULED template (bare keyword, 2026-09-28); VOCAB keywordTarget, distinctSpellTargets; NEEDS MATH: Hunt | +0.33 | clear | core | The red Hunt trick: more Attack, no more Defense, so the hunter usually trades (red's Hunt is high Attack, low Defense). |
| `fd-raptor-pack` | The Raptor Pack | R | Creature, Dinosaur Raptor | {3}{R} | 3/2 | Warcry. Arrives: create a Pack Raptor token. |  | +0.53 | clear | core | A plain Dinosaur (brief: R 2): the pack itself. Pack Raptor minter. Pilot art case 10 (count control) is its pack-caller cousin. |
| `fd-hurled-firebrand` | Hurled Firebrand | R | Ritual | {2}{R} | none | Damage target creature 3 and damage opponent 2. |  | +0.27 | clear | flex, **cut** | Plain red removal with reach. Not a source (3 damage is removal, brief section 3). |
| `fd-obsidian-tooth` | Obsidian-Tooth Tyrant | R | Creature, Dinokin Tyrant | {4}{R}{R} | 6/5 | Provoked: this gets +2/+0 until Sunset. | NEEDS MATH: Provoked | +0.05 | clear | flex, **cut** | A red top-end tyrant: ping it before combat (Kindler, the Fire-Pit) and it swings for eight. The Provoked line is only live with a source, which is the point. |
| `fd-raptor-ambush` | Raptor Ambush | R | Charm | {2}{R} | none | Create a Pack Raptor token. Damage target creature 1. |  | +0.12 | clear | flex, **cut** | A raptor out of the ferns at Charm speed, and a ping that provokes your own creature or finishes an X/1. Pack Raptor minter, red source. (Replaces Ember-Scale Raptor in the density revision: red had 13 payoffs against a budget of about 10.) |

### Green (12; cut keeps 9)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-herd-caller-hornback` | Herd-Caller Hornback | G | Creature, Dinokin Hornback | {2}{G} | 2/3 | Your other Dinokin have Overrun. | NEEDS MATH: lord x2.0 (flat, D10) | -0.05 | clear | core, protect | THE OVERRUN LORD (brief section 2): the draftable lord. No stat change, so Hunt is untouched and the herd tramples over chump blocks. Dinokin only. |
| `fd-mammothkin-matron` | Mammothkin Matron | G | Creature, Beastkin Mammoth | {4}{G} | 4/5 | Sentinel. Provoked: Mark this. | NEEDS MATH: Provoked | +0.24 | advisory: a creature above 1 shipped body (River-Silt Giant) | core | Beastkin 1 of 4 (the Woolly Mammoth girl, brief D3). A Provoked body, not a Beastkin payoff: the base set's Packmother and Call of the Wilds absorb her without re-costing. |
| `fd-frill-neck-stalker` | Frill-Neck Stalker | G | Creature, Dinokin Hornback | {3}{G}{G} | 4/4 | Arrives: Hunt. | RULED template (bare keyword, 2026-09-28); NEEDS MATH: Hunt | +0.10 | clear | core | The green arrival hunter at Rare: Stalking Yeti's shape a mana up with any prey (yours only when the opponent has no legal prey, E6). Attack 4, the H5 cap below SR. |
| `fd-horned-herd` | The Horned Herd | G | Creature, Dinosaur Hornback | {4}{G} | 3/3 | Arrives: create two Hatchling tokens. |  | -0.16 | clear | core | A plain Dinosaur (brief: the horned herd): a beast and its calves. Hatchling minter; three Dinosaurs for Oru's Dreaded. |
| `fd-thorn-hide-armourback` | Thorn-Hide Armourback | G | Creature, Dinokin Armourback | {2}{G}{G} | 2/5 | Provoked: Mark target creature you control. Empower {2}: Hunt any other creature. | OVERRIDE `any` (ruled 2026-09-28: card text may state its prey; restores the original self-hunt design; PROPOSED template); VOCAB empowerHunt; NEEDS MATH: Provoked, Hunt | -0.31 | clear | core | The herd's shield-body: struck, it marks whoever needs it most (itself included). Empowered, it hunts one of your own creatures to provoke both (the self-provoke line, H1), or picks off an X/2 (VOCAB empowerHunt, 3 of 3). Printed plus Empower 6. |
| `fd-old-bull` | Old Bull of the Herd | G | Creature, Dinokin Hornback | {3}{G} | 3/4 | Whenever another Dinokin you control dies, Mark this and gain 2 life. | NEEDS MATH: observer filter x0.5 | +0.12 | clear | flex, **cut** | The one "whenever another Dinokin you control dies" payoff the brief lists (`allyDies`, subtype filter x0.5). |
| `fd-grip-of-the-old-beast` | Grip of the Old Beast | G | Ritual | {2}{G} | none | Mark target creature you control, then it Hunts. | RULED template (bare keyword, 2026-09-28); VOCAB keywordTarget, distinctSpellTargets; NEEDS MATH: Hunt | -0.54 | clear | core | The permanent Hunt spell: the Mark stays after the hunt, so a hunter that wins is bigger for good. Costed on a nominal hunter plus one. |
| `fd-herd-singer` | Herd-Singer of the Fern | G | Creature, Human Shepherd | {2}{G} | 1/3 | Whenever another Dinokin you control attacks, Mark target creature you control. | NEEDS MATH: observer filter x0.5 | -0.35 | clear | flex, **cut** | A Dinokin payoff on a non-Dinokin (`allyAttacks` with a subtype filter, a targeted observer: legal since the Starborne ruling). Replaces a ramp row that reprinted Verdant Seidr-Weaver. |
| `fd-tusk-and-claw` | Tusk-and-Claw Hornback | G | Creature, Dinokin Hornback | {4}{G}{G} | 4/5 | Arrives: Hunt. Provoked: Mark this. | RULED template (bare keyword, 2026-09-28); NEEDS MATH: Provoked, Hunt | +0.35 | clear | flex, **cut** | Hunt and Provoked on one card multiply (H5): the hunter survives its prey and grows. Compared against shipped six-drops in the self-audit; the lab measures this shape. |
| `fd-hide-like-stone` | Hide Like Stone | G | Charm | {G} | none | Target creature you control gets +0/+3 until Sunset, then Mark it. |  | -0.05 | clear | core | A shield (brief: shields do not count toward the minimums): the struck creature lives to be provoked and keeps a Mark. |
| `fd-great-horn-herder` | Great-Horn Herder | G | Creature, Human Shepherd | {1}{G} | 1/2 | Duty, {1}: Mark target creature you control with attack 4 or more. |  | +0.13 | clear | core | The herd-caller Duty (green: Mark target creature you control), sized for the big beasts with the existing `minAttack` target limit, which also keeps her from printing Reef-Tender's rules box. |
| `fd-thunder-of-hooves` | Thunder of Hooves | G | Ritual | {1}{G}{G} | none | Your creatures get +1/+0 and gain Overrun until Sunset. Draw a card. |  | -0.35 | clear | core | The stampede turn (brief section 4, item 1: +1/+0 and Overrun), with a card so it is never blank on a thin board. |

### Multicolour (9; cut keeps 8)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-fern-and-fire` | Fern-and-Fire Raptor | R/G | Creature, Dinokin Raptor | {1}{R}{G} | 3/3 | Warcry. Arrives, if you control another Dinokin: Hunt. | RULED template (bare keyword, 2026-09-28); NEEDS MATH: Hunt | +0.52 | clear | core | R/G, the core pair: the Stampede theme deck's curve hunter. The condition is checked at cast (A1.1c, ruled 2026-09-29): without another Dinokin the card is cast with no prey and is castable whether or not prey exists; with one, it needs prey to be cast. |
| `fd-tusk-rage` | Tusk-Rage Tyrant | R/G | Creature, Dinokin Tyrant | {3}{R}{G} | 5/5 | Provoked: Mark this and damage opponent 1. | NEEDS MATH: Provoked | +0.58 | clear | core | R/G Provoked tyrant: every blow it survives grows it and burns the player. |
| `fd-herd-guardian` | Herd-Guardian Longneck | G/W | Creature, Dinokin Longneck | {3}{G}{W} | 2/6 | Sentinel. Provoked: create a Hatchling token and Mark target creature you control. | NEEDS MATH: Provoked | +0.37 | clear | core | G/W, the herd: R27's wall. Attacking into it feeds the herd (brief section 5). Hatchling minter. |
| `fd-stampede-long-grass` | Stampede of the Long Grass | G/W | Ritual | {1}{G}{W} | none | Create two Hatchling tokens. Your creatures get +1/+0 and gain Overrun until Sunset. |  | -0.10 | clear | core | G/W finisher: the herd arrives and runs in the same turn. Hatchling minter. |
| `fd-warband-drummer` | Warband Drummer | R/W | Creature, Human Firekeeper | {1}{R}{W} | 2/3 | Sentinel. Duty, {1}: damage target creature you control 1, then it gets +1/+1 until Sunset. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | +0.28 | clear | core | R/W, the warband (a source for the D12 persona): drum your own soldier into a rage and a shield at once. |
| `fd-tar-fossil-seeker` | Fossil-Seeker of the Tar | B/G | Creature, Human Tracker | {2}{B}{G} | 3/3 | Arrives: grind self 3. Dies: create a Tar-Bones token. |  | +0.28 | clear | core | The B/G fossil rare the token plan names (Tar-Bones minter). Brief B/G is Hunt plus fossils; the Hunt half sits on Grave-Fern Stalker. (Renamed: no name carries "Hunt".) |
| `fd-sky-herder` | Sky-Herder of the Cliffs | W/U | Creature, Human Rider | {2}{W}{U} | 2/3 | Skyborne. Duty, {2}: tap target creature. |  | +0.41 | clear | flex, **cut** | W/U (pterosaur fliers and taps): the rider who taps the biggest attacker every turn. |
| `fd-blaze-horn-charge` | Blaze-Horn Charge | R/G | Ritual | {1}{R}{G} | none | Damage target creature you control 1, then it Hunts. | RULED template (bare keyword, 2026-09-28); VOCAB keywordTarget, distinctSpellTargets; NEEDS MATH: Hunt, self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | -2.02 | clear | core | Cold by construction, lab-priced: its main term is a source aimed at your own side, which the scorer prices at 0, so its cost is set by design and pool precedent, never by its delta. R/G's self-provoke Hunt: strike your own creature first (it is provoked before it hunts), then send it at the prey. The source and the Hunt on one card, in the core pair. |
| `fd-scar-proud-veteran` | Scar-Proud Veteran | R/W | Creature, Human Spearwoman | {2}{R}{W} | 3/4 | Sentinel. Provoked: this gets +2/+0 until Sunset and gain 2 life. | NEEDS MATH: Provoked | +0.42 | clear | core | R/W's Provoked payoff for the warband's pings: struck before combat, she attacks for five and gains life; struck in combat, she holds. |

### Colourless (2; cut keeps 2)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-egg-of-first-dawn` | Egg of the First Dawn | C | Artifact | {2} | none | During your Dawn: Mark target creature you control. |  | +0.05 | clear | flex | A colourless Mark engine for the herd (replaces Amber Idol, which reprinted Chrome Medallion). |
| `fd-bone-totem` | Bone Totem | C | Artifact | {2} | none | Your creatures with Marks have Warding Gaze. Duty, {2}: Mark target creature you control. |  | -0.19 | clear | core | The colourless Duty artifact (brief: colourless 1). The Warding Gaze line keeps it off Reef-Lantern's rules box at a lower price. |

## Common (104; cut keeps 82)

No multicolour at common (brief section 2). The common band carries the
set's enabler density (the Hunt spells, the pings, the arrival hunters, the
walls), the go-wide bodies and the token makers.

### White (21; cut keeps 16)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-hearth-shield` | Hearth-Shield Maiden | W | Creature, Human Firekeeper | {1}{W} | 1/4 | Provoked: gain 2 life. | NEEDS MATH: Provoked | +0.65 | clear | core, protect | White common payoff, block-shaped (Wall of Hope's shape with a body). |
| `fd-reed-wall-keeper` | Reed-Wall Keeper | W | Creature, Human Elder | {1}{W} | 0/5 | Bulwark. Provoked: Mark target creature you control. | NEEDS MATH: Provoked | +0.33 | clear | core | A white wall (Bulwark: never the hunter, H3a) that marks the herd whenever it holds. |
| `fd-plated-longneck` | Plated Longneck | W | Creature, Dinokin Longneck | {3}{W} | 2/5 | Sentinel. Whenever another Dinokin you control dies, gain 2 life. | NEEDS MATH: observer filter x0.5 | +0.11 | advisory: a creature above 1 shipped body (White-Crown Sentinel) | core | A white Dinokin that mourns the herd (the `allyDies` subtype observer at common). No longer a payoff (density revision). |
| `fd-hearth-tender` | Hearth-Tender | W | Creature, Human Firekeeper | {2}{W} | 1/3 | Duty, {1}: damage target creature you control 1, then gain 2 life. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | -0.46 | clear | core, protect | The white common Duty source (white needs 2 sources at C): burn a wall at the hearth to provoke it. White Duty creature. |
| `fd-test-of-the-hearth` | Test of the Hearth | W | Charm | {W} | none | Damage target creature you control 1, then Mark it. Gain 1 life. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | -0.13 | clear | core | The white spell source: the scarring rite at Charm speed, a Mark that keeps the struck creature alive. |
| `fd-shepherdess-long-grass` | Shepherdess of the Long Grass | W | Creature, Human Shepherd | {2}{W} | 2/2 | Arrives: create a Hatchling token. |  | +0.10 | clear | core | The white nest common. Hatchling minter. |
| `fd-guard-the-nest` | Guard the Nest | W | Ritual | {2}{W} | none | Create a Hatchling token. Your creatures get +0/+2 until Sunset. |  | -0.51 | clear | flex | A Hatchling and a wall-up turn. Hatchling minter. |
| `fd-calf-guard` | Longneck Calf-Guard | W | Creature, Dinokin Longneck | {1}{W} | 1/3 | Sentinel. Arrives: gain 2 life. |  | +0.55 | advisory: a creature above 7 shipped bodies (Einherjar Shieldbearer; Oathbound Cleric; Sidhe Page; Chapel Guard; Alabaster Usher; Censer-Bearer of the Low Hall; Chapel Sister) | flex | A white Dinokin two-drop, block-shaped. (As a plain 1/3 Sentinel it was a pool body told apart only by the Dinokin type: the laundering the brief forbids.) |
| `fd-shield-crest` | Shield-Crest Armourback | W | Creature, Dinokin Armourback | {3}{W} | 1/6 | Provoked: this gets +2/+0 until Sunset. | NEEDS MATH: Provoked | +0.29 | clear | flex, **cut** | A white wall that hits back after it is struck: the blocker that becomes an attacker. |
| `fd-dawn-crest` | Dawn-Crest Skywing | W | Creature, Dinokin Skywing | {3}{W} | 2/2 | Skyborne. Arrives: Mark target creature you control. |  | -0.01 | clear | flex | A white pterosaur Dinokin that marks the herd as it lands. |
| `fd-stand-behind-horns` | Stand Behind the Horns | W | Charm | {1}{W} | none | Prevent combat damage to target creature you control this turn. Gain 2 life. |  | -0.38 | clear | flex, **cut** | A white fog for one creature, usable on either player's turn (no own-turn-only fog, #429). |
| `fd-hearth-guard` | Hearth-Guard | W | Creature, Human Spearwoman | {2}{W} | 2/3 | Sentinel. Arrives: Mark target creature you control. |  | +0.44 | advisory: a creature above 5 shipped bodies (Wang Ping, Mountain Reader; Moorland Guide; White Horse; Paper-Mask Sentinel; Collar-Bound Warden) | flex, **cut** | A white common that marks the herd (a french vanilla 2/3 Sentinel reprinted White Horse). |
| `fd-elder-of-embers` | Elder of the Last Embers | W | Creature, Human Elder | {3}{W} | 2/3 | Arrives: gain 3 life. Dies: create a Hatchling token. |  | -0.05 | clear | flex | A white body that leaves a Hatchling. Hatchling minter. |
| `fd-sun-stare` | Stare of the Sun | W | Charm | {1}{W} | none | Tap target creature. Gain 2 life. Foresee 1. |  | -0.45 | clear | core | White's common tap (the Drum at Charm speed). |
| `fd-bring-it-down` | Bring Down the Beast | W | Ritual | {3}{W} | none | Destroy target creature with attack 4 or more. | NEEDS MATH: target limit | -0.56 | clear | core | White common removal for the big beasts. |
| `fd-herd-wall` | Herd-Wall | W | Creature, Dinokin Longneck | {4}{W} | 3/6 | Sentinel. Warding Gaze. |  | +0.12 | clear | flex | A tall white Dinokin blocker. |
| `fd-scar-singer` | Scar-Singer of the Hearth | W | Creature, Human Firekeeper | {1}{W} | 1/2 | Duty, {W}: damage target creature you control 1, then it gets +0/+2 until Sunset. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | +0.10 | clear | flex | A second white common Duty source: the struck creature is provoked and shielded at once. (Replaces Sky-Patrol Rider, which Goose-Girl of the Wind Meadow outclassed.) |
| `fd-wall-kin` | Wall-Kin Shieldbearer | W | Creature, Dinokin Armourback | {2}{W} | 1/4 | Provoked: create a Hatchling token. | NEEDS MATH: Provoked | +0.44 | clear | core | White common Dinokin payoff, block-shaped: struck and holding, it calves. Hatchling minter. |
| `fd-herd-mother-blessing` | Blessing of the Herd-Mother | W | Ritual | {W} | none | Mark target creature you control. Gain 3 life. |  | +0.16 | clear | flex, **cut** | A cheap white Mark for the Provoked shields. |
| `fd-bone-bead-elder` | Bone-Bead Elder | W | Creature, Human Elder | {W} | 1/1 | Arrives: gain 2 life. |  | +0.16 | advisory: a creature above 2 shipped bodies (Mousekin Pantry-Guard; Whisker-Count Scout) | stretch, **cut** | A white one-drop. |
| `fd-nest-guard` | Nest-Guard Longneck | W | Creature, Dinokin Longneck | {4}{W} | 2/5 | Sentinel. Arrives: create a Hatchling token. |  | -0.08 | clear | flex | A white long-neck with her calf. Hatchling minter. (Replaces Trail Markers, a colourless Foresee Duty that reprinted four commons at new costs.) |

### Blue (17; cut keeps 14)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-cliff-nest-rider` | Cliff-Nest Rider | U | Creature, Human Rider | {3}{U} | 1/2 | Skyborne. Arrives: create a Glider token. |  | +0.09 | clear | core, protect | The blue Cliff Nest common (token plan). Glider minter. |
| `fd-nest-caller` | Nest-Caller | U | Ritual | {3}{U} | none | Create two Glider tokens. |  | +0.27 | clear | flex | Two pterosaurs. Glider minter. |
| `fd-frost-rime-wall` | Frost-Rime Wall | U | Creature, Human Seer | {1}{U} | 0/4 | Bulwark. Arrives: grind self 2. |  | -0.43 | clear | flex | A blue wall that feeds the fossil line. (Replaces Ice-Bound, which reprinted Tidal Slip.) |
| `fd-frost-glare` | Frost-Glare Seer | U | Creature, Human Seer | {2}{U} | 1/3 | Arrives: tap target creature an opponent controls. |  | -0.56 | clear | core | The common frost-seer. |
| `fd-glide-wing-ambush` | Glide-Wing Ambush | U | Charm | {2}{U} | none | Create a Glider token. Tap target creature. |  | -0.16 | clear | flex | A pterosaur out of the sun at Charm speed. Glider minter. (Replaces Meltwater Rush, which reprinted Slack Water.) |
| `fd-thaw-and-grind` | Grind of the Glacier | U | Ritual | {U} | none | Grind self 3. Foresee 1. |  | -0.29 | clear | core | The common blue self-mill (fossil line enabler). |
| `fd-ice-wall-scout` | Ice-Wall Scout | U | Creature, Human Scout | {2}{U} | 1/4 | Arrives: Foresee 2. |  | -0.07 | advisory: a creature above 1 shipped body (Lake Attendant) | core | The blue scout common. (At {1}{U} 1/3 it reprinted Star Reader.) |
| `fd-river-snapper` | River-Snapper | U | Creature, Dinokin Swimmer | {3}{U} | 3/3 | Arrives: grind self 2, then Foresee 1. |  | -0.19 | clear | flex | A blue swimming Dinokin that stirs up the riverbed (the Foresee keeps it clear of Cold-Water Diver). |
| `fd-glacier-memory` | Glacier Memory | U | Ritual | {2}{U} | none | Draw 2. Grind self 1. |  | +0.39 | clear | core | Blue common draw. |
| `fd-cold-refusal` | Cold Refusal | U | Charm | {2}{U} | none | Cancel target spell. Grind self 1. |  | +0.43 | clear | core | Blue common counter. |
| `fd-frozen-looter` | Ice-Cave Diver | U | Creature, Human Scout | {2}{U} | 1/2 | Duty: grind self 1, then draw a card, then discard a card. |  | -0.01 | clear | core | The blue common looter (fossil line): grinds as it filters. Blue Duty creature. |
| `fd-egg-snatcher` | Egg-Snatcher | U | Creature, Human Scout | {1}{U} | 1/1 | Skyborne. Whenever this deals combat damage to a player, Foresee 2. |  | +0.21 | clear | flex | A cheap blue flier that scouts as it raids the nests. |
| `fd-sea-lizard-wake` | In the Sea-Lizard's Wake | U | Charm | {2}{U} | none | Recall target creature you control. Draw a card. |  | +0.21 | clear | flex | Save your own struck creature (it loses its damage) or replay an arrival. (Replaces Glacier Tomb, which a shipped Charm outclassed.) |
| `fd-tidal-lizard` | Tide-Pool Lizard | U | Creature, Dinosaur Swimmer | {4}{U} | 4/4 | Untouchable. |  | -0.06 | clear | flex, **cut** | A plain Dinosaur at common (a river sea-lizard; the brief's blue Dinosaur is the SR). |
| `fd-sky-harrier` | Sky-Harrier | U | Creature, Dinokin Skywing | {2}{U} | 2/2 | Skyborne. Arrives: Foresee 1. |  | +0.58 | advisory: a creature above 3 shipped bodies (Raven Courier; Snowcourt Attendant; Waterclock Diviner) | flex | A blue pterosaur Dinokin at common (a plain 2/2 flier was outclassed six ways). |
| `fd-ice-lens` | Ice-Lens Totem | U | Artifact | {3}{U} | none | During your Dawn: grind self 1. Duty, {3}: draw a card. |  | +0.63 | clear | stretch, **cut** | Blue's Duty artifact (brief: U 1): the Jayemdae Tome shape Drowned Deep settled on. |
| `fd-frost-bitten-seer` | Frost-Bitten Seer | U | Creature, Human Seer | {4}{U} | 2/5 | Duty, {1}: tap target creature. |  | +0.36 | clear | flex, **cut** | A blue common Duty tapper. |

### Black (17; cut keeps 13)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-tar-rite` | Tar-Rite | B | Ritual | {2}{B} | none | Create a Tar-Bones token. Grind self 2. |  | -0.31 | clear | core, protect | The common black tar Ritual (token plan). Tar-Bones minter. |
| `fd-bone-picker` | Bone-Picker of the Flats | B | Creature, Human Scout | {2}{B} | 2/2 | Arrives: grind self 2. Dies: create a Tar-Bones token. |  | +0.75 | clear | core | The black dies-trigger body at common. Tar-Bones minter. |
| `fd-tar-flat-grave` | Pulled From the Tar | B | Ritual | {2}{B} | none | Return target creature card from your graveyard to your hand. Opponent loses 1 life. |  | -0.56 | clear | core | The common reclaim (fossil line). |
| `fd-ash-cat` | Ash-Cat Ambusher | B | Creature, Human Witch | {1}{B} | 1/1 | Deathblade. Dies: grind self 2. |  | +0.08 | clear | core | Black's common Deathblade blocker, its counter to a Provoked attacker, and a fossil enabler. (A 1/2 reprinted Black Cat Familiar.) |
| `fd-tar-drowned` | Tar-Choke | B | Ritual | {1}{B} | none | Target creature gets -2/-2 until Sunset. Grind self 1. |  | -0.70 | clear | core | Black common removal that never provokes. (A cost-capped destroy was outclassed by The Price.) |
| `fd-bitter-blood` | Bitter-Blood Brute | B | Creature, Human Spearwoman | {3}{B} | 3/4 | Arrives: damage target creature you control 1, then opponent loses 2 life. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | +0.42 | advisory: a creature above 1 shipped body (Zhuge Dan, Cornered Loyalist) | flex | Black's second common source: a blood-letting that provokes your own creature and drains (density revision: black had 4 payoffs and 2 sources). |
| `fd-tar-skin-wall` | Tar-Skin Wall | B | Creature, Human Spearwoman | {2}{B} | 1/4 | Provoked: opponent loses 1 life. | NEEDS MATH: Provoked | -0.08 | clear | core | Black's common payoff (brief: B 1 at C): drains when struck. |
| `fd-ash-brand` | Ash-Brand | B | Charm | {B} | none | Target creature gets -1/-1 until Sunset. Grind self 1. |  | -0.19 | clear | flex, **cut** | A small black answer. |
| `fd-fossil-dreamer` | Fossil-Dreamer | B | Creature, Human Shaman | {3}{B} | 2/3 | Arrives: return target creature card from your graveyard to your hand, then grind self 3. |  | -0.10 | clear | flex | A fossil-line body that reclaims, then fills. (Was a targeted dies-reclaim, which could target the dying card itself: the targeted path has no self-exclusion, so it moved to the arrival.) |
| `fd-tar-fang` | Tar-Fang Stalker | B | Creature, Dinokin Raptor | {3}{B} | 3/2 | Dreaded. Dies: grind self 2. |  | -0.41 | clear | flex | Black Dinokin 2 of 2 at common. |
| `fd-scar-knife` | Scar-Knife Witch | B | Creature, Human Witch | {1}{B} | 2/1 | Arrives: damage another target creature you control 1, then opponent loses 1 life. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | -0.02 | advisory: a creature above 1 shipped body (Draugr Raider) | core | Black's common source (brief: B 1 at C): a blood-letting that provokes your own creature and drains. "Another" ruled 2026-09-28 (E9): as first sketched it could only target itself when it arrived alone, and died; now it does nothing alone. Δ and overlap are the pre-ruling reading, not re-run. |
| `fd-grave-dust` | Grave-Dust | B | Ritual | {B} | none | Grind self 3. Opponent loses 1 life. |  | +0.51 | clear | flex, **cut** | Cheap self-mill for the fossil line. |
| `fd-bone-heap` | Bone-Heap Shaman | B | Creature, Human Shaman | {4}{B} | 3/4 | Arrives: create a Tar-Bones token. |  | +0.47 | clear | flex | A body and a fossil. Tar-Bones minter. |
| `fd-ash-choked` | Ash-Choked Breath | B | Ritual | {1}{B} | none | Opponent discards a card at random. Opponent loses 1 life. |  | +0.15 | clear | flex, **cut** | Black common discard. (Discard and grind 1 at {B} reprinted The Wharf's Due.) |
| `fd-tar-pit-lurker` | Tar-Pit Lurker | B | Creature, Human Witch | {3}{B}{B} | 4/3 | Deathblade. Dreaded. |  | -0.41 | clear | flex | A black top-end threat. |
| `fd-marrow-drinker` | Marrow-Drinker | B | Creature, Human Witch | {2}{B} | 2/3 | Duty, {2}{B}: opponent loses 1 life and you gain 1 life. |  | -0.10 | advisory: a creature above 1 shipped body (Jia Chong, Unclean Hands) | stretch, **cut** | A black common Duty drain; cut first (Ash-Witch is the Rare). |
| `fd-grave-mourner` | Grave-Mourner | B | Creature, Human Witch | {2}{B} | 2/2 | Whenever another creature you control dies, opponent loses 1 life. |  | -0.16 | clear | flex | A black common payoff for fodder (Hatchlings, Tar-Bones): the `allyDies` observer at common. |

### Red (21; cut keeps 18)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-challenge-the-beast` | Challenge the Beast | R | Ritual | {1}{R} | none | Target creature you control gets +1/+0 until Sunset, then it Hunts. | RULED template (bare keyword, 2026-09-28); VOCAB keywordTarget, distinctSpellTargets; NEEDS MATH: Hunt; LAB FIRST: Deathblade host: any Deathblade creature plus this is a two-mana kill (H4) | +0.43 | clear | core, protect | The red common Hunt spell (H5: at most one red at common). |
| `fd-spear-thrower` | Spear-Thrower of the Ember Clan | R | Creature, Human Spearwoman | {3}{R} | 4/2 | Arrives: Hunt. | RULED template (bare keyword, 2026-09-28); NEEDS MATH: Hunt; LAB FIRST: Hunt-rate bias: a glass-cannon hunter, costed on a rate that discounts the burn by survival rather than charging the lost body; not moved again on any new reading | +0.63 | clear | core | Red's common hunter: four Attack, two Defense, so she trades with most prey (brief: red Hunt usually trades). |
| `fd-ridge-raptor` | Ridge-Raptor | R | Creature, Dinokin Raptor | {2}{R} | 3/1 | Warcry. Empower {1}{R}: Hunt. | RULED template (bare keyword, 2026-09-28); VOCAB empowerHunt; NEEDS MATH: Hunt; LAB FIRST: Hunt-rate bias: a glass-cannon hunter (see Spear-Thrower) | -0.03 | clear | flex | A red raptor that attacks at once or, paid up, snaps at an X/3 first and usually dies doing it (VOCAB empowerHunt, 2 of 3). Printed plus Empower 5. |
| `fd-coal-thrower` | Coal-Thrower | R | Creature, Human Firekeeper | {2}{R} | 1/3 | Arrives: damage target creature 1. |  | -0.22 | clear | core, protect | The red common arrival ping: a source aimed at your own Provoked creature, or removal for an X/1. (2/2 reprinted Forge-Hand.) |
| `fd-ember-flick` | Ember-Flick | R | Charm | {R} | none | Damage target creature 1. Foresee 1. |  | +0.42 | clear | core | The one-mana source at Charm speed: provoke your creature mid-combat, after blocks. |
| `fd-drum-beater` | Drum-Beater of the Ember Clan | R | Creature, Human Firekeeper | {2}{R} | 2/3 | Arrives: damage each other creature you control 1, then your creatures get +1/+0 until Sunset. | VOCAB damageEachYours; NEEDS MATH: self-sweep at 0; LAB-PRICED: cold by construction, never moved by its delta | +0.37 | clear | core | The war-drum source at common (VOCAB damageEachYours, 3 of 4; three survive the projected cut). |
| `fd-fire-brand-initiate` | Firebrand Initiate | R | Creature, Human Firekeeper | {1}{R} | 2/1 | Duty, {1}{R}: damage target creature you control 1, then it gets +1/+0 until Sunset. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | +0.00 | clear | flex | A red common Duty source (red Duty creature 3): the fire-pit on a two-drop body. |
| `fd-cinder-crest` | Cinder-Crest Raptor | R | Creature, Dinokin Raptor | {1}{R} | 2/2 | Provoked: this gets +2/+0 until Sunset. | NEEDS MATH: Provoked | +0.53 | clear | core, protect | The red two-drop payoff: pinged before combat (Coal-Thrower, Ember-Flick), it attacks for four. |
| `fd-hot-blooded` | Hot-Blooded Hornback | R | Creature, Dinokin Hornback | {3}{R} | 3/4 | Provoked: damage opponent 1. | NEEDS MATH: Provoked | +0.07 | clear | core | Red common payoff that burns back at the player. |
| `fd-scorch-tail` | Scorch-Tail Raptor | R | Creature, Dinokin Raptor | {2}{R} | 2/3 | Provoked: damage target creature an opponent controls 1. | NEEDS MATH: Provoked | +0.17 | clear | core | Red common payoff that shoots back (never at your own side, P3). |
| `fd-rage-kin-brawler` | Rage-Kin Brawler | R | Creature, Dinokin Tyrant | {4}{R} | 4/4 | Rage. Provoked: create a Pack Raptor token. | NEEDS MATH: Provoked | +0.53 | clear | flex | A common tyrant that must attack and calls the pack when it survives the fight. Pack Raptor minter. |
| `fd-war-painted` | War-Painted Raptor | R | Creature, Dinokin Raptor | {3}{R} | 3/3 | Warcry. Whenever this attacks, this gets +1/+0 until Sunset. |  | +0.12 | clear | flex | A red common attacker (no longer a payoff: density revision). |
| `fd-pack-caller` | Pack-Caller of the Red Cliffs | R | Creature, Human Shepherd | {2}{R} | 1/1 | Arrives: create a Pack Raptor token. |  | -0.22 | clear | core | The red pack-caller (token plan: arrival). Pack Raptor minter. Pilot art case 10. |
| `fd-raptor-whistler` | Raptor-Whistler | R | Creature, Human Rider | {5}{R} | 2/3 | Arrives: create two Pack Raptor tokens. |  | +0.27 | clear | flex, **cut** | The bigger pack-caller: two raptors at once. Pack Raptor minter. |
| `fd-wild-raptors` | Wild Raptors | R | Creature, Dinosaur Raptor | {1}{R} | 2/1 | Warcry. Dies: damage opponent 1. |  | +0.25 | advisory: a creature above 8 shipped bodies (Wolfkin Raider; Muspel Emberkin; Pumpkin Attendant; Red-Cloak Runner; Street Oni Scrapper; Dune-Pawed Outrider; Sun-Rope Charger; Flarewing Raider) | flex | A plain Dinosaur at common (brief: R 2): the raptor alone. |
| `fd-ember-tongue` | Ember-Tongue | R | Charm | {R} | none | Damage target creature you control 1, then it gets +2/+0 until Sunset. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | -0.13 | clear | core | The red Charm-speed source: after blocks, strike your own creature to provoke it and send it two points bigger. Never removal. (Replaces Scorching Ember, which reprinted Solar Arc.) |
| `fd-flint-spear` | Flint-Spear Toss | R | Charm | {2}{R} | none | Damage target creature 3. Foresee 1. |  | -0.25 | clear | core | Plain red common removal (not a source: 3 damage kills). Pool floor: a bigger effect than the best shipped common (Ember of Brigid, 2) costs one more, so it carries Foresee 1 at {2}{R}; {1}{R} reprinted Red-Solar Lash. |
| `fd-fire-runner` | Fire-Runner Raptor | R | Creature, Dinokin Raptor | {1}{R} | 2/1 | Warcry. Rage. |  | -0.20 | clear | flex | A french-vanilla raptor for the Stampede's curve. |
| `fd-blaze-crest` | Blaze-Crest Tyrant | R | Creature, Dinokin Tyrant | {4}{R}{R} | 5/5 | Warcry. Dreaded. |  | +0.27 | clear | flex | The common top-end tyrant (5/4 was outclassed by Gale Horror). |
| `fd-ember-fury` | Ember Fury | R | Charm | {R} | none | Target creature gets +3/+0 until Sunset. |  | +0.20 | clear | flex, **cut** | A red common trick; with a Provoked +X/+0 line it stacks. |
| `fd-pack-runner` | Pack-Runner Raptor | R | Creature, Dinokin Raptor | {2}{R} | 3/2 | As long as you control another Dinokin, this has Warcry. | NEEDS MATH: controlsOther x0.6 | -0.01 | clear | flex, **cut** | A red Dinokin common with the herd line (replaces Smoulder-Back Hornback in the density revision). |

### Green (24; cut keeps 17)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-spear-and-fang` | Spear and Fang | G | Ritual | {1}{G} | none | Target creature you control Hunts any other creature. | OVERRIDE `any` (ruled 2026-09-28: card text may state its prey; restores the original self-hunt design; PROPOSED template); VOCAB keywordTarget, distinctSpellTargets; NEEDS MATH: Hunt; LAB FIRST: Deathblade host: any Deathblade creature plus this is a two-mana kill (H4); costed on a nominal 3/3.2 hunter | -0.57 | clear | core, protect | The plain Hunt spell, green common 1 of 2 (H5). Costed on the better of its two uses (brief H5): removal, or a self-Hunt that provokes two of your own creatures. |
| `fd-stalk-the-ferns` | Stalk the Ferns | G | Charm | {2}{G} | none | Target creature you control gets +1/+1 until Sunset, then it Hunts. | RULED template (bare keyword, 2026-09-28); VOCAB keywordTarget, distinctSpellTargets; NEEDS MATH: Hunt; LAB FIRST: Deathblade host: any Deathblade creature plus this is a kill at Charm speed (H4) | +0.14 | clear | core | Green common Hunt spell 2 of 2: the Charm-speed version, a combat trick that is also removal. |
| `fd-fern-shadow-stalker` | Fern-Shadow Stalker | G | Creature, Dinokin Raptor | {3}{G} | 3/4 | Arrives, if you control another Dinokin: Hunt. | RULED template (bare keyword, 2026-09-28); NEEDS MATH: Hunt | +0.32 | clear | core | The common Dinokin arrival hunter (`controlsOther`): a Dinokin payoff and a source. The condition is checked at cast (A1.1c, ruled 2026-09-29): without another Dinokin the card is cast with no prey and is castable whether or not prey exists; with one, it needs prey to be cast. |
| `fd-horn-crest-charger` | Horn-Crest Charger | G | Creature, Dinokin Hornback | {4}{G} | 4/4 | Arrives: Hunt. | RULED template (bare keyword, 2026-09-28); the default prey, an opponent's creature only, restores the original opponent-only design; the provisional 0.95 opponent-only factor applies again; NEEDS MATH: Hunt | +0.67 | clear | core | The unconditional common hunter at five mana, Attack 4 (the H5 cap). |
| `fd-tall-grass-tracker` | Tall-Grass Tracker | G | Creature, Human Tracker | {2}{G} | 2/3 | Empower {2}: Hunt. | RULED template (bare keyword, 2026-09-28); VOCAB empowerHunt; NEEDS MATH: Hunt | -0.24 | clear | flex | Empower as an optional arrival Hunt (brief section 2; VOCAB empowerHunt, 1 of 3): a three-drop body early, a hunter late. Printed plus Empower is 5, under the ceiling of 9. |
| `fd-fern-back-grazer` | Fern-Back Grazer | G | Creature, Dinokin Longneck | {2}{G} | 1/4 | Provoked: Mark this. | NEEDS MATH: Provoked | +0.08 | clear | core, protect | The common Fungusaur: a grazer that grows each time it survives a blow. Green common payoff. |
| `fd-moss-hide-hornback` | Moss-Hide Hornback | G | Creature, Dinokin Hornback | {3}{G} | 3/4 | Provoked: create a Hatchling token. | NEEDS MATH: Provoked | +0.59 | clear | core | Green common payoff that feeds the herd. Hatchling minter. |
| `fd-frill-flare` | Frill-Flare Hornback | G | Creature, Dinokin Hornback | {1}{G} | 2/2 | Provoked: this gets +1/+1 until Sunset. | NEEDS MATH: Provoked | +0.48 | clear | core | The two-drop Provoked body: blocked or pinged, it wins the next fight that turn. |
| `fd-river-wader` | River-Wader Longneck | G | Creature, Dinokin Longneck | {4}{G} | 2/6 | Warding Gaze. Provoked: Mark target creature you control. | NEEDS MATH: Provoked | -0.06 | clear | flex, **cut** | A long-neck that blocks fliers and passes its Mark to the herd. |
| `fd-stubborn-armourback` | Stubborn Armourback | G | Creature, Dinokin Armourback | {4}{G} | 3/5 | Provoked: Mark this twice. | NEEDS MATH: Provoked | +0.43 | clear | flex, **cut** | The biggest common Provoked grower: two Marks each time it survives. |
| `fd-nest-warden` | Nest-Warden of the Fern | G | Creature, Human Shepherd | {2}{G} | 1/2 | Arrives: create a Hatchling token. |  | -0.45 | clear | core | The green nest common (token plan: green nest commons, arrival). Hatchling minter. |
| `fd-egg-clutch` | Egg-Clutch | G | Ritual | {2}{G} | none | Create two Hatchling tokens. Retell {4}{G}. |  | +0.46 | clear | core | Two Hatchlings for the herd deck, and two more late. Hatchling minter. |
| `fd-hatchling-mother` | Hatchling-Mother | G | Creature, Dinokin Longneck | {4}{G} | 3/4 | Arrives: create a Hatchling token. |  | -0.28 | clear | flex, **cut** | A Dinokin long-neck with her calf. Hatchling minter. |
| `fd-cave-bearkin` | Cave Bearkin Mother | G | Creature, Beastkin Bear | {3}{G} | 3/4 | Warding Gaze. Provoked: this gets +2/+0 until Sunset. | NEEDS MATH: Provoked | +0.64 | clear | core | Beastkin 2 of 4 (the Cave Bear girl, the one common): struck, she rears up. No Beastkin payoff. (As a plain 3/5 Warding Gaze she was Floodgate Warden told apart only by the Beastkin type.) |
| `fd-plated-grazer` | Plated Grazer | G | Creature, Dinosaur Armourback | {3}{G} | 1/6 | Warding Gaze. |  | -0.33 | clear | flex | A plain Dinosaur at common (brief: 2 C): the armoured wall, alone. A Dreaded body under Oru. |
| `fd-thick-hide` | Thick Hide | G | Charm | {G} | none | Target creature you control gets +1/+3 until Sunset. |  | -0.13 | clear | core | The common shield: a creature that survives the blow is provoked. |
| `fd-call-of-first-dawn` | Call of the First Dawn | G | Ritual | {3}{G} | none | Mark each creature you control. Draw a card. |  | -0.52 | clear | flex, **cut** | The morning the sun first rose: the herd grows at once, and the card replaces itself. |
| `fd-horn-bearer` | Horn-Bearer of the Herd | G | Creature, Dinokin Hornback | {2}{G} | 2/3 | As long as you control another Dinokin, this gets +1/+1. | NEEDS MATH: controlsOther x0.6 | +0.14 | clear | core | The common Dinokin payoff shape with existing vocabulary (a self static gated by `controlsOther`). |
| `fd-grazing-hornback` | Grazing Hornback | G | Creature, Dinokin Hornback | {3}{G} | 4/4 | As long as you control another Dinokin, this has Overrun. | NEEDS MATH: controlsOther x0.6 | +0.33 | clear | flex, **cut** | A Dinokin body with a small herd line (a vanilla 4/3 was outclassed by Frost Jotun). |
| `fd-long-tail-grazer` | Long-Tail Grazer | G | Creature, Dinokin Longneck | {5}{G} | 5/5 | Warding Gaze. Skim {G}. |  | +0.39 | clear | flex | The common top-end long-neck: a big body for Hunt to spend, and a Skim so it is never stuck in hand (a set of expensive cards wants Skim). |
| `fd-fern-crest-raptor` | Fern-Crest Raptor | G | Creature, Dinokin Raptor | {1}{G} | 2/2 | Whenever another Dinokin you control attacks, this gets +1/+0 until Sunset. | NEEDS MATH: observer filter x0.5 | +0.65 | clear | flex | The common `allyAttacks` Dinokin observer: the pack runs together. |
| `fd-bone-snap` | Bone-Snap Ambush | G | Charm | {2}{G} | none | Destroy target creature with Skyborne. | VOCAB keywordTarget | +0.03 | clear | stretch, **cut** | Green's Plummet: the only way the Fern clan fights a pterosaur. VOCAB keywordTarget (the brief's keyword qualifier); drop unless three cheap rows want it. |
| `fd-trample-path` | Stampede Path | G | Charm | {1}{G} | none | Your creatures get +1/+1 and gain Overrun until Sunset. |  | -0.38 | clear | flex, **cut** | The herd's common alpha strike (the stampede turn at common). |
| `fd-fern-nest-raider` | Fern-Nest Raider | G | Creature, Dinokin Raptor | {2}{G} | 3/2 | Arrives, if you control another Dinokin: Mark this. |  | +0.32 | advisory: a creature above 2 shipped bodies (Whisker-Field Reaper; Levee-Foot Scout) | flex | A green raptor that arrives bigger in a herd: the `controlsOther` arrival at its simplest. |

### Colourless (4; cut keeps 4)

| ID | Name | Colour | Type | Cost | Stats | Mechanics sketch | Flags | Δ | Overlap | Cut | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `fd-bone-whistle` | Bone Whistle | C | Artifact | {2} | none | Duty, {3}: tap target creature. |  | +0.12 | clear | flex | A colourless tapper for any deck. |
| `fd-ember-pot` | Ember-Pot | C | Artifact | {1} | none | Duty, {2}: damage target creature you control 1, then it gets +1/+1 until Sunset. | NEEDS MATH: self-source at 0; LAB-PRICED: cold by construction, never moved by its delta | +0.43 | clear | core | The colourless source at common: any colour can provoke its own creature, which also survives the blow a little better. |
| `fd-carved-tusk` | Carved Tusk | C | Artifact | {2} | none | Your creatures with Marks get +1/+0. |  | -0.28 | clear | flex | A colourless marked anthem for the herd decks (was a Duty pump: the density revision trimmed incidental Duties toward the brief's budget). |
| `fd-resin-cast` | Amber Resin | C | Artifact | {1} | none | Duty, {2}: target creature you control gets +0/+2 until Sunset. |  | -0.17 | clear | flex | A colourless shield: keeps a struck creature alive to be provoked. |

## Tokens

Four tokens, each with at least two minters in the cut (the 2026-09-03
minterless-token lesson; checked below on the projected cut).

| Token | Colour | Type | Stats | Rules | Minters in the projected cut | Overplan minters | Note |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| Hatchling (`fd-tok-hatchling`) | G | Creature, Dinosaur | 1/1 | none | 17: Sefa, Keeper of the First Fire; Tahla, Shepherdess of Thunder; The Walking Mountain; Mother of the Long-Necks; The Horned Herd; The Long-Neck Herd; The Herd-Horn; Herd-Guardian Longneck; Stampede of the Long Grass; Moss-Hide Hornback; Nest-Warden of the Fern; Egg-Clutch; Shepherdess of the Long Grass; Guard the Nest; Elder of the Last Embers; Wall-Kin Shieldbearer; Nest-Guard Longneck | 20 | Young, never a child (art rule). A Dinosaur, so Oru gives it Dreaded; no Dinokin lord reaches it. |
| Pack Raptor (`fd-tok-pack-raptor`) | R | Creature, Dinosaur | 2/1 | Warcry | 5: Blood-Horn Brute; Call the Pack; The Raptor Pack; Rage-Kin Brawler; Pack-Caller of the Red Cliffs | 8 | Dies to every war-drum source (damage each creature you control 1): red pays for its own rite. |
| Tar-Bones (`fd-tok-tar-bones`) | B | Creature, Skeleton | 2/2 | none | 11: Oshka, Mother of the Tar Flats; Rise From the Tar; Grave-Fern Stalker; Ambusher of the Tar Flats; Bone-Caller of the Tar; The Tar Bubbles; The Tar Pit; Fossil-Seeker of the Tar; Tar-Rite; Bone-Picker of the Flats; Bone-Heap Shaman | 12 | A fossil from the tar: clean stone-coloured bone (art rule). Not a Dinosaur: the fossil is dead. |
| Glider (`fd-tok-glider`) | U | Creature, Dinosaur | 1/1 | Skyborne | 8: Nyra, Queen of the Cliff Nests; Asha and Shree, Sky-Riders; Nest-Mother of the Cliffs; Wind Over the Cliff Nests; The Ice Wall Holds; Cliff-Nest Rider; Nest-Caller; Glide-Wing Ambush | 8 | A pterosaur; the flex token, cut first if its minters fall under two. |

Hatchling has the most minters by far: the G/W herd is built on it. If the
owner wants fewer, the stretch and flex Hatchling commons go first.

## The tenth theme deck: the Stampede (R/G Dinokin)

The brief's plan (section 5): a Dinokin deck on a steady curve with the green
Overrun lord, Hunt and burn as six to eight removal slots, red's sources to
provoke on its own terms, one or two tyrants on top. It avoids what sank the
two folding theme decks: two colours, not three; every creature an honest
body without its trigger; no multi-turn engine to assemble. Pack Raptors are
Dinosaurs, so the Overrun lord skips them and the list plays none. Every card
is in the projected cut; the list is mostly commons, as a theme deck's is.
60 cards, at most four copies, the legendary at one. It plays the personas in
wave 4, and a list below the median prefab of the latest reading is reworked
before it ships.

24 basics: 12 Mountain, 12 Forest.

| Count | Card | Cost | Rarity | Role |
| ---: | --- | --- | --- | --- |
| 3 | Frill-Flare Hornback (`fd-frill-flare`) | {1}{G} | C | Provoked |
| 3 | Cinder-Crest Raptor (`fd-cinder-crest`) | {1}{R} | C | Provoked |
| 3 | Horn-Bearer of the Herd (`fd-horn-bearer`) | {2}{G} | C | body |
| 2 | Herd-Caller Hornback (`fd-herd-caller-hornback`) | {2}{G} | R | lord |
| 2 | Coal-Thrower (`fd-coal-thrower`) | {2}{R} | C | source |
| 2 | Ridge-Raptor (`fd-ridge-raptor`) | {2}{R} | C | Hunt |
| 2 | Fern-and-Fire Raptor (`fd-fern-and-fire`) | {1}{R}{G} | R | Hunt |
| 2 | Fern-Shadow Stalker (`fd-fern-shadow-stalker`) | {3}{G} | C | Hunt |
| 2 | Hot-Blooded Hornback (`fd-hot-blooded`) | {3}{R} | C | Provoked |
| 2 | Horn-Crest Charger (`fd-horn-crest-charger`) | {4}{G} | C | Hunt |
| 1 | Tusk-Rage Tyrant (`fd-tusk-rage`) | {3}{R}{G} | R | Provoked |
| 1 | Blaze-Crest Tyrant (`fd-blaze-crest`) | {4}{R}{R} | C | body |
| 1 | Rage-Kin Brawler (`fd-rage-kin-brawler`) | {4}{R} | C | Provoked |
| 2 | Spear and Fang (`fd-spear-and-fang`) | {1}{G} | C | Hunt |
| 2 | Challenge the Beast (`fd-challenge-the-beast`) | {1}{R} | C | Hunt |
| 2 | Flint-Spear Toss (`fd-flint-spear`) | {2}{R} | C | spell |
| 2 | Ember-Flick (`fd-ember-flick`) | {R} | C | source |
| 1 | Thunder of Hooves (`fd-thunder-of-hooves`) | {1}{G}{G} | R | spell |
| 1 | Blaze-Horn Charge (`fd-blaze-horn-charge`) | {1}{R}{G} | R | Hunt |

Spells: 36.

Removal: Spear and Fang, Challenge the Beast, Flint-Spear Toss (two each) and
Blaze-Horn Charge (one): seven slots. Sources: Coal-Thrower, Ember-Flick,
Blaze-Horn Charge and the Empower on Ridge-Raptor. Top: Tusk-Rage Tyrant and
Blaze-Crest Tyrant.

## The summit pair, rungs 27 and 28 (draft lists)

Working names from the brief. These are draft lists to show the decks exist
in the projected cut; the reserve decks, land reserves and Darlings decks are
the converter's (generate, then sync), the gate is the one-test-per-pair
pattern ruled for rungs 27-28, and the floors come from the measured band,
never from these lists.

### Rung 27: The Shepherdess of Thunder (G/W, the herd)

- Portrait and Darling: Tahla, Shepherdess of Thunder (`fd-tahla-shepherdess`).
- Plan: Hatchlings from the nest commons and Tahla's Dawn, walls whose
  Provoked gains life, marks the herd or calves (Hearth-Shield Maiden,
  Reed-Wall Keeper, Wall-Kin Shieldbearer, Herd-Guardian Longneck), the
  matriarch keeping the Dinokin alive and Sentinel, and the stampede turn
  (Stampede of the Long Grass, Thunder of Hooves) to finish. Attacking into
  her feeds her; not attacking lets her grow. The tower has never fielded
  green-white.
- R27 is the closer twin of R23 (a go-wide Mark swarm): Hatchlings plus Marks
  is R23's plan with walls. Defended: R27 wins by blocking and punishing
  attacks (Provoked walls, the matriarch's Sentinel and Defense), where R23
  wins by attacking wide, and R27's Marks come from being struck rather than
  from a Mark engine. If the owner wants them further apart, the lever is to
  cut R27's Mark payoffs (Reed-Wall Keeper, Herd-Guardian Longneck's Mark)
  for more lifegain walls.

24 basics: 12 Forest, 12 Plains.

| Count | Card | Cost | Rarity | Role |
| ---: | --- | --- | --- | --- |
| 3 | Nest-Warden of the Fern (`fd-nest-warden`) | {2}{G} | C | tokens |
| 3 | Shepherdess of the Long Grass (`fd-shepherdess-long-grass`) | {2}{W} | C | tokens |
| 3 | Hearth-Shield Maiden (`fd-hearth-shield`) | {1}{W} | C | Provoked |
| 2 | Reed-Wall Keeper (`fd-reed-wall-keeper`) | {1}{W} | C | Provoked |
| 2 | Wall-Kin Shieldbearer (`fd-wall-kin`) | {2}{W} | C | Provoked |
| 2 | Horn-Bearer of the Herd (`fd-horn-bearer`) | {2}{G} | C | body |
| 2 | Long-Neck Matriarch (`fd-long-neck-matriarch`) | {3}{W} | SR | lord |
| 2 | Herd-Guardian Longneck (`fd-herd-guardian`) | {3}{G}{W} | R | Provoked |
| 2 | Moss-Hide Hornback (`fd-moss-hide-hornback`) | {3}{G} | C | Provoked |
| 1 | The Horned Herd (`fd-horned-herd`) | {4}{G} | R | tokens |
| 1 | The Long-Neck Herd (`fd-longneck-herd`) | {4}{W} | R | Provoked |
| 1 | Mother of the Long-Necks (`fd-long-neck-mother`) | {4}{W}{W} | SSR | Provoked |
| 1 | Tahla, Shepherdess of Thunder (`fd-tahla-shepherdess`) | {2}{G}{W} | UR | tokens |
| 1 | The Walking Mountain (`fd-walking-mountain`) | {5}{G}{G} | SSR | Provoked |
| 2 | Egg-Clutch (`fd-egg-clutch`) | {2}{G} | C | tokens |
| 2 | Stampede of the Long Grass (`fd-stampede-long-grass`) | {1}{G}{W} | R | tokens |
| 1 | Thunder of Hooves (`fd-thunder-of-hooves`) | {1}{G}{G} | R | spell |
| 2 | Test of the Hearth (`fd-test-of-the-hearth`) | {W} | C | source |
| 1 | The Standing Stone (`fd-standing-stone`) | {2}{W} | SR | source |
| 1 | The Clan Hearth (`fd-clan-hearth`) | {1}{W} | R | spell |
| 1 | Stare of the Sun (`fd-sun-stare`) | {1}{W} | C | spell |

Spells: 36.

### Rung 28: The Tyrant Queen (R/G, the final rung)

- Portrait and Darling: Oru, the Tyrant Queen (`fd-oru-tyrant-queen`).
- Plan: Hunt removal on big bodies (Frill-Neck Stalker, Fang and Horn,
  Korru's Duty), red sources and self-Hunts that provoke her own tyrants
  (Kindler, Coal-Thrower, the Fire-Pit, Blaze-Horn Charge; a self-Hunt
  proper is Korru's `any` Duty since the final Hunt ruling), Provoked payoffs
  that grow and burn (Tusk-Rage Tyrant, Magma-Back Armourback, Blood-Horn
  Brute), and Oru as finisher.

24 basics: 12 Mountain, 12 Forest.

| Count | Card | Cost | Rarity | Role |
| ---: | --- | --- | --- | --- |
| 2 | Kindler of the Ember Clan (`fd-kindler`) | {1}{R} | R | source |
| 2 | Coal-Thrower (`fd-coal-thrower`) | {2}{R} | C | source |
| 3 | Cinder-Crest Raptor (`fd-cinder-crest`) | {1}{R} | C | Provoked |
| 2 | Magma-Back Armourback (`fd-magma-back`) | {3}{R} | R | Provoked |
| 2 | Blood-Horn Brute (`fd-blood-horn-brute`) | {3}{R} | SR | Provoked |
| 2 | Frill-Neck Stalker (`fd-frill-neck-stalker`) | {3}{G}{G} | R | Hunt |
| 2 | Fern-and-Fire Raptor (`fd-fern-and-fire`) | {1}{R}{G} | R | Hunt |
| 2 | Tusk-Rage Tyrant (`fd-tusk-rage`) | {3}{R}{G} | R | Provoked |
| 1 | Ember-Crest Tyrant (`fd-ember-crest-tyrant`) | {3}{R}{R} | SSR | Provoked |
| 1 | Fern-Crown Tyrant (`fd-fern-crown-tyrant`) | {4}{G}{G} | SSR | Hunt; **off the projected board since F6** (2026-09-28): this slot needs a replacement from the board, open until the cut |
| 1 | Vessa, the Great Horn (`fd-vessa-great-horn`) | {3}{G}{G} | UR | Provoked |
| 1 | Korru, Eldest of the Trackers (`fd-korru-eldest-tracker`) | {3}{G}{G} | UR | Hunt |
| 1 | Oru, the Tyrant Queen (`fd-oru-tyrant-queen`) | {4}{R}{G} | UR | lord |
| 2 | Thorn-Hide Armourback (`fd-thorn-hide-armourback`) | {2}{G}{G} | R | Hunt |
| 2 | Spear and Fang (`fd-spear-and-fang`) | {1}{G} | C | Hunt |
| 2 | Fang and Horn (`fd-fang-and-horn`) | {1}{G}{G} | SSR | Hunt |
| 2 | Blaze-Horn Charge (`fd-blaze-horn-charge`) | {1}{R}{G} | R | Hunt |
| 2 | Duel on the Ridge (`fd-duel-on-the-ridge`) | {2}{R} | R | Hunt |
| 1 | The Fire-Pit (`fd-fire-pit`) | {2} | SR | source |
| 2 | Flint-Spear Toss (`fd-flint-spear`) | {2}{R} | C | spell |
| 1 | Ring of Embers (`fd-ring-of-embers`) | {1}{R} | SR | source |

Spells: 36.

R28 repeats R23's pair (R/G). Defended in the brief (a summit pair shows off
its set; R23 is a go-wide Mark swarm, R28 is big-body removal); the owner's
alternative there, R28 as R/W, would move Oru's portrait to a new R/W
legendary, which this overplan does not carry beyond Venna Red-Hand (a UR the
projected cut drops).

## Balance pass (2026-09-28, before any card exists in the engine)

Every row was scored while it was authored, and every row outside the band
was brought back by the smallest design-preserving lever: cost, a stat, the
mana on a Duty, a rider, or a hand redesign. The two rules the Drowned Deep
pass ran under apply unchanged (owner, 2026-09-11):

1. **Pool precedent.** A new card is never strictly better than the best
   shipped card of its effect class at the same or lower rarity; a bigger
   effect than the best shipped one costs at least one more. Hard for spells
   and non-creature permanents, advisory for creatures. It set Flint-Spear
   Toss at {2}{R} (a {1}{R} three-damage Charm reprinted Red-Solar Lash, and
   a bigger effect than Ember of Brigid's two costs one more), kept Stare of
   the Sun at {1}{W} (at {W} it would have outclassed Salt Line), deleted Fog
   of Steam (it outclassed its own set's Rare), and redesigned the colourless
   ping and Mark artifacts that undercut Forge-Lamp and Reef-Lantern.
2. **Rarity is earned by doing more, never by costing less.** The Great Drum
   gained an anthem rather than a discount; Tracker of the Long Grass (a
   strictly worse Korru) and the Crag-Leaper and Ridge-Raptor pair (the Super
   Rare was the common with bigger numbers) were redesigned so each rarity's
   card does something its sibling does not.

**Result: all 192 delta-priced rows sit inside the band.** The
19 lab-priced rows are listed apart; five of them read cold, by
construction. The nineteenth, Vyra, joined on 2026-09-29, after the pass:
her pump is valued at 0 until the lab, and no lever was pulled on her.

| Rarity | Rows | Delta-priced | Fair (±0.75) | Hot | Cold | Median Δ | Widest | Lab-priced (of which cold) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| UR | 12 | 10 | 10 | 0 | 0 | +0.32 | `fd-korru-eldest-tracker` +0.63 | 2 (1) |
| SSR | 14 | 13 | 13 | 0 | 0 | +0.15 | `fd-grave-fern-stalker` +0.64 | 1 (1) |
| SR | 19 | 17 | 17 | 0 | 0 | +0.19 | `fd-long-neck-matriarch` +0.72 | 2 (1) |
| R | 62 | 57 | 57 | 0 | 0 | +0.05 | `fd-thaw-old-bones` -0.72 | 5 (2) |
| C | 104 | 95 | 95 | 0 | 0 | +0.10 | `fd-bone-picker` +0.75 | 9 (0) |
| **All** | **211** | **192** | **192** | **0** | **0** | | | **19 (5)** |

The lab-priced rows, with their deltas: Sefa, Keeper of the First Fire -0.08; Uzza the War-Painter -1.05; The Fire-Pit -0.03; The Standing Stone -1.31; War Drums of the Ember Clan -0.57; Scar-Rite Elder +0.20; Trial by Ember -1.32; Warband Drummer +0.28; Blaze-Horn Charge -2.02; Drum-Beater of the Ember Clan +0.37; Firebrand Initiate +0.00; Ember-Tongue -0.13; Hearth-Tender -0.46; Test of the Hearth -0.13; Scar-Singer of the Hearth +0.10; Bitter-Blood Brute +0.42; Scar-Knife Witch -0.02; Ember-Pot +0.43; Vyra, Ember-Sky Rider -1.01 (added 2026-09-29, the pump at 0).

**The rows the pass moved** (first score, then the lever; the row tables hold
the final numbers):

| Row | First Δ | Lever |
| --- | ---: | --- |
| `fd-nyra-cliff-nests` | +0.90 | Duty {1} to {2} |
| `fd-great-drum` | -1.64 | rider: your creatures get +0/+1 |
| `fd-sky-riders-pact` | +1.96 | {3}{W}{U} 3/4 Sentinel to {4}{W}{U} 3/3 |
| `fd-grave-fern-stalker` | +1.93 | dies: two Tar-Bones to one |
| `fd-ambush-at-the-river` | +1.23 | {2}{G} to {3}{G} |
| `fd-fire-pit` | +0.78 | {1} to {2} |
| `fd-blood-horn-brute` | +1.14 | 4/4 to 3/4 |
| `fd-ice-keeper` | +1.01 | {2}{U} to {3}{U} (Net-Mender of Low Street prints the Duty at {2}{U} 1/3) |
| `fd-frozen-in-the-ice` | -0.94 | {1}{U}{U} to {U}{U} |
| `fd-tar-flat-ambusher` | +1.30 | {3}{B} to {4}{B} |
| `fd-bone-caller` | +0.86 | 3/4 to 2/4 |
| `fd-ash-witch-edict` | -0.95 | {2}{B} to {1}{B} |
| `fd-tusk-and-claw` | +0.81 | 4/6 to 4/5 |
| `fd-rage-horn` | -0.86 | {2}{R}{R} to {1}{R}{R} |
| `fd-duel-on-the-ridge` | +1.14 | {1}{R} to {2}{R} |
| `fd-obsidian-tooth` | +0.80 | Warcry removed |
| `fd-clan-hearth` | -0.97 | {2}{W} to {1}{W} |
| `fd-sun-hold` | -0.86 | {1}{W} to {W} |
| `fd-wind-over-nests` | +1.55 | two Gliders at {3}{U} to one at {2}{U} |
| `fd-tusk-rage` | +0.88 | Overrun removed |
| `fd-herd-guardian` | +1.18 | {2}{G}{W} to {3}{G}{W} |
| `fd-tar-fossil-seeker` | +1.57 | dies: two Tar-Bones to one |
| `fd-sky-herder` | +0.81 | Duty {1} to {2} |
| `fd-thunder-of-hooves` | -1.16 | {2}{G}{G} to {1}{G}{G} |
| `fd-stampede-long-grass` | -1.72 | {3}{G}{W} to {1}{G}{W} |
| `fd-tar-bubbles` | +1.32 | {1}{B} to {2}{B} once Retell was added |
| `fd-raptor-ambush` | +0.93 | {1}{R} to {2}{R} |
| `fd-frill-flare` | +0.99 | 2/3 to 2/2 |
| `fd-stubborn-armourback` | +0.81 | 3/6 to 3/5 |
| `fd-bone-snap` | +0.84 | {1}{G} to {2}{G} |
| `fd-raptor-whistler` | +1.08 | {4}{R} to {5}{R} |
| `fd-herd-mother-blessing` | -1.46 | {2}{W} to {W} |
| `fd-cliff-nest-rider` | +0.91 | 2/2 to 1/2 |
| `fd-nest-caller` | +1.08 | {2}{U} to {3}{U} |
| `fd-ice-lens` | +3.00 | {1}{U} with a Dawn Foresee to {3}{U} with a Dawn grind (the Jayemdae Tome shape) |
| `fd-wall-kin` | +0.88 | 1/5 to 1/4 |
| `fd-long-tail-grazer` | +0.77 | 5/6 to 5/5 once Skim was added |
| `fd-walking-mountain` | +1.39 | Skim removed again (it read hot with it) |

**Reverted after the review (2026-09-28):** four levers had been pulled on
rows whose main term is priced at 0 by construction, so their deltas were
never evidence. The Standing Stone is back at {2}{W} (at {1}{W} it undercut
Reef-Lantern), Trial by Ember back at {1}{W} (at {W} it matched Brood
Communion plus a board-wide provoke), Uzza back at {2}{R}{R}, and
Blaze-Horn Charge loses the +2/+0 added to warm it. All four are labelled
cold by construction and lab-priced.

Deleted in the pass: Fire-Stone and Mammoth-Ivory Horn (cold, and cost-shifted
copies of the Obsidian Knife and the Herd-Horn), Warmth of the Hearth
(Widow's Lantern outclassed it), Rain of Black Ash (a new mass sweeper; the
brief allows none).

## Overlap audit

Every row was parsed into card data and run through `scripts/audit-overlap.ts`
against the 1,500-card live pool and against the rest of the set, with
`typalSubtypes([...ALL_CARDS, ...candidates])` so this set's own lords count.
The paid-off subtypes are then Dinokin and Dinosaur beside the shipped Axes;
Human is not paid off by any live card, so it never splits a pair. Provoked
and Hunt are carried as a new trigger kind and a new op, which the comparator
compares exactly (it never guesses that an unknown op is upside).

**Result: no identical printing, no same-card-at-another-cost (REDESKIN), no
row strictly worse than a shipped card, no Ritual outclassed by a Charm, and
no row dominated by another row of the set.** The #436 guard (no
rules-identical printings in one set) holds. The Dinokin type launders no
duplicate: the comparator's "same text told apart by a tribe" list is empty
for this set, after two rows that were (a 1/3 Sentinel Dinokin and a 3/5
Warding Gaze Beastkin) gained real text. **Vyra (added 2026-09-29) has not
been run:** her row reads `not yet run` until the comparator learns the A1.5
pump, and the name collision check against the pool is owed with it.

The first overlap run found 48 rows with findings. The fixes, by kind:

- **Reprints of shipped cards, redesigned or replaced (15):** Fern-Path Scout
  (Verdant Seiðr-Weaver), Swept by the Meltwater (three commons, then two
  Super Rares), Frost-Bite (three commons), Amber Idol (Chrome Medallion),
  Thaw the Old Bones (The Long Drying), The Ice Wall Holds (two Super Rares,
  Collapse the Lane, then Wrong Door), Coal-Thrower (Forge-Hand), Flint-Spear
  Toss (Red-Solar Lash), Scorching Ember (Solar Arc), Hearth-Guard (White
  Horse), Ice-Bound (Tidal Slip), Meltwater Rush (Slack Water), Ice-Wall
  Scout (Star Reader), Ash-Cat Ambusher (Black Cat Familiar), Ash-Choked
  Breath (The Wharf's Due).
- **Strictly worse than a shipped card, redesigned (10):** Plated Grazer,
  Grazing Hornback, Blaze-Crest Tyrant, Dawn-Crest Skywing, Sky-Patrol Rider,
  River-Snapper, Wind-Rider Scout, Sky-Harrier, Tar-Choke (and Pulled From
  the Tar, which What Was Promised outclassed).
- **Same card at another cost, redesigned or replaced (7):** the Obsidian Knife, Bone
  Totem, Sun-Stone, Tusk Horn, Trail Markers, Smoke-Choke, and Trial by Ember
  once its self-damage was visible to the comparator.
- **Dominated inside the set (4):** Tracker of the Long Grass (by Korru),
  Ridge-Raptor (by Crag-Leaper), Pack-Caller (by The Raptor Pack),
  Frost-Glare Seer (by River-Lurker): each pair now differs in shape.

**What remains is advisory (15 rows):** creatures whose body and
text beat a shipped vanilla or french-vanilla body at the same cost. The
Drowned Deep rule keeps creature floors advisory, and each is a set card with
a mechanic line over a plain body, so none is a reprint. For the owner's
read:

| ID | Name | Rarity | Above these shipped bodies (the comparator's note) |
| --- | --- | --- | --- |
| `fd-kree-wind-crest` | Kree of the Wind-Crest | SSR | Zhong Hui, Gilded Prodigy (tk-jin-zhonghui, R, base): extra ability: arrives[recall(to=target)] \| allyAttacks[foresee(n=1)] |
| `fd-mammothkin-matron` | Mammothkin Matron | R | River-Silt Giant (sd-river-silt-giant, C, sands-of-the-duat): extra ability: provoked[addCounters(n=1,to=self)] |
| `fd-scar-rite-elder` | Scar-Rite Elder | R | Guan Suo, Blossom Blade (tk-shu-guansuo, C, base): extra ability: arrives[damage(n=1,to=target); addCounters(n=1,to=target)] |
| `fd-river-lurker` | River-Lurker | R | Lu Su, Generous Diplomat (tk-wu-lusu, C, base): extra ability: attacks[tap(to=target)]; Xiahou Hui, Wary Bride (tk-jin-xiahouhui, C, base): extra ability: attacks[tap(to=target)] |
| `fd-fern-nest-raider` | Fern-Nest Raider | C | Whisker-Field Reaper (sd-whisker-field-reaper, C, sands-of-the-duat): extra ability: arrives[addCounters(n=1,to=self)]; Levee-Foot Scout (sd-levee-foot-scout, C, sands-of-the-duat): extra ability: arrives[addCounters(n=1,to=self)] |
| `fd-wild-raptors` | Wild Raptors | C | Wolfkin Raider (bk-wolfkin-raider, C, base): extra ability: dies[damage(n=1,to=opponent)]; Muspel Emberkin (rg-muspel-emberkin, C, ragnarok): extra ability: dies[damage(n=1,to=opponent)]; Pumpkin Attendant (dt-pumpkin-attendant, C, dark-tales): extra ability: dies[damage(n=1,to=opponent)]; Red-Cloak Runner (dt-red-cloak-runner, C, dark-tales): extra ability: dies[damage(n=1,to=opponent)]; Street Oni Scrapper (yn-street-oni-scrapper, C, yokai-nights): extra ability: dies[damage(n=1,to=opponent)]; Dune-Pawed Outrider (sd-dune-pawed-outrider, C, sands-of-the-duat): extra ability: dies[damage(n=1,to=opponent)]; Sun-Rope Charger (sd-sun-rope-charger, C, sands-of-the-duat): extra ability: dies[damage(n=1,to=opponent)]; Flarewing Raider (sb-flarewing-raider, C, starborne): extra ability: dies[damage(n=1,to=opponent)] |
| `fd-plated-longneck` | Plated Longneck | C | White-Crown Sentinel (sd-white-crown-sentinel, C, sands-of-the-duat): stats 2/5 vs 2/4 · extra ability: allyDies[gainLife(n=2)] |
| `fd-calf-guard` | Longneck Calf-Guard | C | Einherjar Shieldbearer (rg-einherjar-shieldbearer, C, ragnarok): extra ability: arrives[gainLife(n=2)]; Oathbound Cleric (rg-oathbound-cleric, C, ragnarok): stats 1/3 vs 1/2 · also sentinel; Sidhe Page (cf-sidhe-page, C, celtic-fae): extra ability: arrives[gainLife(n=2)]; Chapel Guard (gm-chapel-guard, C, gothic-monsters): extra ability: arrives[gainLife(n=2)]; Alabaster Usher (sd-alabaster-usher, C, sands-of-the-duat): extra ability: arrives[gainLife(n=2)]; Censer-Bearer of the Low Hall (sd-censer-bearer-of-the-low-hall, C, sands-of-the-duat): also sentinel; Chapel Sister (dd-chapel-sister, C, drowned-deep): also sentinel |
| `fd-hearth-guard` | Hearth-Guard | C | Wang Ping, Mountain Reader (tk-shu-wangping, C, base): also sentinel · extra ability: arrives[addCounters(n=1,to=target)]; Moorland Guide (cf-moorland-guide, C, celtic-fae): extra ability: arrives[addCounters(n=1,to=target)]; White Horse (ac-white-horse, C, arthurian-court): extra ability: arrives[addCounters(n=1,to=target)]; Paper-Mask Sentinel (yn-paper-mask-sentinel, C, yokai-nights): extra ability: arrives[addCounters(n=1,to=target)]; Collar-Bound Warden (sd-collar-bound-warden, C, sands-of-the-duat): also sentinel · extra ability: arrives[addCounters(n=1,to=target)] |
| `fd-bone-bead-elder` | Bone-Bead Elder | C | Mousekin Pantry-Guard (bk-mousekin-pantry-guard, C, base): extra ability: arrives[gainLife(n=2)]; Whisker-Count Scout (sd-whisker-count-scout, C, sands-of-the-duat): extra ability: arrives[gainLife(n=2)] |
| `fd-ice-wall-scout` | Ice-Wall Scout | C | Lake Attendant (ac-lake-attendant, C, arthurian-court): stats 1/4 vs 1/3 · foresee(n=2) beats foresee(n=1) |
| `fd-sky-harrier` | Sky-Harrier | C | Raven Courier (gm-raven-courier, C, gothic-monsters): extra ability: arrives[foresee(n=1)]; Snowcourt Attendant (dt-snowcourt-attendant, C, dark-tales): also skyborne; Waterclock Diviner (sd-waterclock-diviner, C, sands-of-the-duat): also skyborne |
| `fd-bitter-blood` | Bitter-Blood Brute | C | Zhuge Dan, Cornered Loyalist (tk-jin-zhugedan, C, base): extra ability: arrives[damage(n=1,to=target); loseLife(n=2,who=opponent)] |
| `fd-scar-knife` | Scar-Knife Witch | C | Draugr Raider (rg-draugr-raider, C, ragnarok): extra ability: arrives[damage(n=1,to=target); loseLife(n=1,who=opponent)] |
| `fd-marrow-drinker` | Marrow-Drinker | C | Jia Chong, Unclean Hands (tk-jin-jiachong, C, base): extra Duty: {2}{B}{T} loseLife(n=1,who=opponent); gainLife(n=1) |

## Self-audit

### Counts by colour (overplan, projected cut in brackets)

| Colour | Rows (cut) | Provoked | Hunt | Sources | Duty (creature / other) | Token minters | Dinokin (C) | Dinosaur creatures | Beastkin |
| --- | ---: | ---: | ---: | ---: | --- | ---: | --- | ---: | ---: |
| White | 38 (29) | 9 (8) | 0 (0) | 7 (7) | 10 (7): 5 / 5 | 10 (9) | 10 (8); C 7 | 1 (1) | 1 (1) |
| Blue | 32 (25) | 0 (0) | 0 (0) | 0 (0) | 9 (6): 8 / 1 | 7 (7) | 5 (3); C 2 | 2 (1) | 0 (0) |
| Black | 32 (25) | 3 (3) | 1 (1) | 3 (3) | 4 (3): 3 / 1 | 10 (9) | 2 (2); C 1 | 0 (0) | 1 (1) |
| Red | 42 (33) | 10 (9) | 7 (6) | 19 (16) | 4 (4): 3 / 1 | 8 (5) | 16 (12); C 9 | 2 (2) | 0 (0) |
| Green | 45 (34) | 13 (10) | 14 (13) | 14 (13) | 4 (3): 4 / 0 | 7 (5) | 20 (14); C 13 | 4 (4) | 2 (2) |
| Multicolour | 15 (13) | 3 (3) | 3 (3) | 5 (4) | 4 (2): 4 / 0 | 6 (6) | 4 (4); C 0 | 0 (0) | 0 (0) |
| Colourless | 7 (7) | 0 (0) | 0 (0) | 2 (2) | 5 (5): 0 / 5 | 0 (0) | 0 (0); C 0 | 0 (0) | 0 (0) |
| **Pool** | **211 (166)** | **38 (33)** | **25 (23)** | **50 (45)** | **40 (30)** | **48 (41)** | **57 (43)** | **9 (8)** | **4 (4)** |

Against the brief's budget (computed at 165): Provoked 38 rows in the
overplan and 33 in the projected cut (budget 26); Hunt
25 and 23 (budget 18); Duty 40 and 30
(budget 18). The cut keeps more of each than the budget: the rarity histogram
and the colour split bind first, and the owner's cut can trim toward the
budget (question 6 below). Other sources, Dinokin, Dinosaur creatures,
Beastkin and token minters sit at or above their budgets. **Vyra
(2026-09-29) is folded into the Rows column only** (red 41 to 42, 32 to 33
in the cut; the pool 210 to 211, 165 to 166): she carries none of the
counted mechanics, so no other column and no density table below moves.

**The F6 swap (owner, 2026-09-28), not yet folded into the tables in this
self-audit.** The Great Drum (W, SSR: an artifact with two Duties, a
Hatchling minter) is back on the projected board and Fern-Crown Tyrant (G,
SSR: Dinokin, Provoked, Hunt, so a source) is off it. Counted from the two
rows, the projected cut moves: white 29 to 30 rows, Duty 7 to 8 and token
minters 9 to 10; green 34 to 33 rows, Provoked 10 to 9, Hunt 13 to 12,
sources 13 to 12 and Dinokin 14 to 13. Projected-cut totals after the swap:
Provoked 32, Hunt 22, sources
44, Duty 31, token minters 42 (Hatchling 18), Dinokin 42. Every density
minimum and tribe floor below still holds (green payoffs 9 against 8,
sources 12 against 10, Hunt 12 against 8; Dinokin 42 against 38). **Duty is
ruled (F3):** trim toward 18, and landing around 20 is acceptable; the trim
happens at the cut, after the lab.

### Enabler density against the brief's minimums

A payoff is a card that prints Provoked; a source is a card whose controller
damages a creature on their own terms (every Hunt card, a ping of 1 that may
target your own creature, any damage to "target creature you control", a
sweep of 1, the war-drum self-sweep). Shields, Marks and combat do not count.
Colour counts are mono-coloured cards; multicolour and colourless are
listed apart and are extra.

| Colour | Payoffs all / C (min) | Sources incl. Hunt all / C (min) | Hunt (min) | Sources ≥ 3/4 payoffs | White block-shaped |
| --- | --- | --- | --- | --- | --- |
| Green | overplan 13 / 6; cut 10 / 4 (8 / 4) | overplan 14 / 5; cut 13 / 5 (10 / 5) | overplan 14; cut 13 (8) | yes / yes |  |
| Red | overplan 10 / 4; cut 9 / 4 (7 / 4) | overplan 19 / 8; cut 16 / 8 (9 / 5) | overplan 7; cut 6 (4) | yes / yes |  |
| White | overplan 9 / 4; cut 8 / 3 (4 / 2) | overplan 7 / 3; cut 7 / 3 (3 / 2) | overplan 0; cut 0 (0) | yes / yes | 8 of 8 |
| Black | overplan 3 / 1; cut 3 / 1 (2 / 1) | overplan 3 / 2; cut 3 / 2 (2 / 1) | overplan 1; cut 1 (at most 1) | yes / yes |  |
| Multicolour (extra, not counted above) | overplan 3; cut 3 | overplan 5; cut 4 | overplan 3; cut 3 | | |
| Colourless (extra) | | overplan 2; cut 2 | | | |

Failures against the brief's minimums: overplan none; projected cut none.

The Drowned Deep cut failed this check in white and red. Here white carries
seven sources (Sefa, the Standing Stone, Scar-Rite Elder, Trial by Ember,
Hearth-Tender, Test of the Hearth, Scar-Singer of the Hearth) against eight
or nine payoffs, all of them block-shaped; red carries sixteen sources in
the projected cut. The density revision that got there: Provoked payoffs
were 47 at first, with white at 14 payoffs against 6 sources and black at 4
against 2. White and red lost payoffs (Brow-Plate, Plated Longneck, Calf-Guard,
Hearth-Guard, War-Painted Raptor and Pack-Runner Raptor became other shapes;
Dawn-Wing Skywing, Ember-Scale Raptor and Smoulder-Back Hornback were
replaced), and white and black gained sources (Trial by Ember, Bitter-Blood
Brute).

### The tribe

| Measure (brief section 2) | Overplan | Projected cut | Brief |
| --- | ---: | ---: | --- |
| Dinokin cards | 57 | 43 | 38 (the brief's number, computed at 165) |
| Dinokin at C and R playable in R/G | 32 | 24 | at least 10 |
| Dinokin at C and R playable in G/W | 27 | 19 | at least 10 |
| Dinokin commons: green / red / white | 13 / 9 / 7 | 9 / 8 / 6 | at least 8 / 5 / 3 |
| The three lords | 3 | 3 | all three |
| Dinosaur creatures | 9 | 8 | at most 8 |
| Beastkin | 4 | 4 | at most 4 |
| Vanilla and french-vanilla commons | 6 of 104 | 5 of 82 | at most 30% |
| Multicolour (all at R and above) | 15 of 211 | 13 of 166 | under 10% |

### Rule checks

Each checked by script over the parsed card data:

- Holds: H5: source-bound hunters below SR print Attack 4 or less.
- Holds: H5: never Hunt and Deathblade on one card below SR.
- Holds: H3a: Bulwark never on a hunter.
- Holds: H5: Duty Hunt only at SR and above.
- Holds: H5: at most two Duty Hunts in the set.
- Holds: H5: a Duty Hunt has mana in the Duty or a body of mana value 5+.
- Holds: H5: Hunt spells at common: at most two green.
- Holds: H5: Hunt spells at common: at most one red.
- Holds: P3: no Provoked effect damages its controller's creatures or Hunts.
- Holds: P5: Provoked printed on creatures only.
- Holds: No card carries First Blade and Provoked.
- Holds: Sweeps of 1: at most three, at R and above.
- Holds: No new mass sweeper (destroy all / damage each creature 2+).
- Holds: Empower ceiling: printed plus Empower at most 9.
- Holds: Multicolour only at R and above.
- Holds: No non-creature permanent is a one-time effect (every artifact and enchantment has ongoing text).
- Holds: extraLandDrop keeps its mana value 2 floor.
- Holds: Names avoid "Hunt", "Provoke", "Enraged".
- Holds: No em-dash in any name, sketch or note.
- Holds: Lords affect Dinokin only, except the one split lord (owner 2026-09-28).
- Holds: No lord grants Provoked (P5) and no Beastkin payoff (D3).
- Holds: Riders are not Dinokin (D2).
- Holds: Lab-priced rows (self-source at 0) are never moved by their delta: cost, stats and sketch match the pinned baseline.

Two more, read by hand: every multicolour card is at R or above in a
signposted pair (R/G, G/W, R/W, B/G, U/B, W/U); and the returning mechanics
the brief lists are present in small numbers (Marks throughout, Rage on four
raptor and tyrant bodies, Empower as an optional Hunt on three, Skim on two,
Retell on two, Foresee throughout), with Nine Lives, Hauntlink, Whispers,
Tithe, Rite, Preserve and Quest absent.

### The construct table

The input to the concretion audit and the engine spec. The ruled mechanics
come first; the rest is every construct a row needs that
`src/engine/types.ts` does not have today.

| Construct | Rows (overplan / projected cut) | Clears the threshold? | Note |
| --- | --- | --- | --- |
| **Provoked** trigger (a new `TriggerWhen`, P1-P5) | 38 / 33 | ruled | Every targeted Provoked effect aims at an opponent's creature or player (P3, checked); the loop cap must reach the Provoked path (P3, A1 work); P4's placement (in the state-based pass, not inline at damage) is load-bearing, see G7 and P4 below. **Corrected by the engine spec** (its items 2 and 5, and 11 for the brief): five of the seven targeted Provoked effects in the cut target your own creature, to Mark it (Long-Neck Mother, Elder of the Bone Wall, Thorn-Hide Armourback, Herd-Guardian Longneck, Reed-Wall Keeper), and P3 is about damage, so it still holds; the state-based placement is for survival, not for the Duties; the loop cap need not reach this path, since once each turn bounds it (the pass budget is raised instead). Ruled with the spec's Q1, 2026-09-28 |
| **Hunt** op, both forms (H1-H5) | 25 / 23 | ruled | The op refuses a hunter that has gained Bulwark by resolution (H3a); two Duty Hunts (Korru UR, Tracker SR) and the Duty pings are G7-gated, see below. **Corrected by the engine spec** (item 1): G7 shipped fixed in 1.8.1 (#451), so nothing here is gated |
| **Hunt spell targets** (H1, H3a): the hunter spec excludes Bulwark, and the two targets are distinct | `fd-fang-and-horn`, `fd-ambush-at-the-river`, `fd-grip-of-the-old-beast`, `fd-duel-on-the-ridge`, `fd-blaze-horn-charge`, `fd-spear-and-fang`, `fd-stalk-the-ferns`, `fd-challenge-the-beast` | yes, eight rows | Two engine items, `keywordTarget` and `distinctSpellTargets` in the table below. Without them the AI's target enumeration offers a Bulwark hunter, and a spell may name one creature as hunter and prey. **Corrected by the engine spec** (item 4), ruled 2026-09-28 (E2): both are the Hunt op's own targeting rules, on the Mark-moving precedent, not constructs |
| **Dinokin** Axis | 57 carriers overplan, 43 cut; 3 lords, 14 other payoffs | ruled | An `axes.ts` entry. Payoffs use `filter.subtype` (the lords), `controlsOther` (the conditional arrivals and the `As long as you control another Dinokin` statics), `allyAttacks` and `allyDies` with a subtype filter |
| **Dinosaur** Axis | 9 creature cards and 3 tokens; 1 payoff (Oru) | ruled by the split lord | An `axes.ts` entry, no new construct |

| Construct | What the engine lacks (checked in `src/engine/types.ts`) | Overplan rows | Projected-cut rows | Clears the three-row threshold? | Recommendation |
| --- | --- | ---: | ---: | --- | --- |
| `keywordTarget` | a target qualified by a keyword, with or without it (the hunter of a Hunt spell is "target creature you control without Bulwark", H3a; "target creature with Skyborne"); TargetSpec has maxCost, minAttack, marked and tapped only, and the AI target enumeration would offer a Bulwark hunter | 9 (`fd-fang-and-horn`, `fd-ambush-at-the-river`, `fd-grip-of-the-old-beast`, `fd-duel-on-the-ridge`, `fd-blaze-horn-charge`, `fd-spear-and-fang`, `fd-stalk-the-ferns`, `fd-bone-snap`, `fd-challenge-the-beast`) | 8 | yes | Admit (reversed from the first draft): every Hunt spell's hunter must be "target creature you control without Bulwark" (H3a), a keyword-qualified target the engine lacks and the AI's target enumeration would violate, so the construct clears the threshold on the eight Hunt spells alone. A creature that gains Bulwark after targeting must also be refused at resolution (an H3a check in the Hunt op). Bone-Snap Ambush ("with Skyborne") then rides it at no extra engine cost; it stays a stretch row. **Corrected by the engine spec** (item 4), ruled 2026-09-28 (E2): not built. The Bulwark rule lives in the Hunt op, so the general qualifier would serve 0 cut rows (only Bone-Snap Ambush, which stays cut) |
| `distinctSpellTargets` | the two creature targets of a spell must be different creatures; `other` excludes only the source permanent of an ability, and a spell has none (targeting.ts:156) | 8 (`fd-fang-and-horn`, `fd-ambush-at-the-river`, `fd-grip-of-the-old-beast`, `fd-duel-on-the-ridge`, `fd-blaze-horn-charge`, `fd-spear-and-fang`, `fd-stalk-the-ferns`, `fd-challenge-the-beast`) | 8 | yes | Admit with the Hunt op: a spell's hunter and prey must be two different creatures (H1), and `other` excludes only the source permanent of an ability, which a spell does not have (targeting.ts, around line 156). **Corrected by the engine spec** (items 4 and 6), ruled 2026-09-28 (E2): distinctness is the Hunt op's own rule, not a construct; the spell's prey spec still carries `other: true`, which excludes nothing on a spell and stays in the data only because it prints "another target" |
| `damageEachYours` | "damage each creature you control N" (no op; the damage op reaches eachCreature or eachOpponentCreature only) | 4 (`fd-uzza-war-painter`, `fd-war-drums`, `fd-trial-by-ember`, `fd-drum-beater`) | 3 | yes | Admit: red's war-drum and white's scarring rite, the source shape the brief expected (2-3 rows). A new `damage` target, `eachYourCreature` (with an optional `other`), beside `eachCreature` and `eachOpponentCreature`. Drum-Beater of the Ember Clan is the only common on it and teaches board-wide self-damage: your own Pack Raptors and Hatchlings die to it. **Ruled 2026-09-28 (E3): keep** (built in A1 as the `eachYourCreature` recipient); if the cut drops one of the three rows, it falls below the threshold and the question returns |
| `manaPump` (A1.5) | a non-tap, mana-only activated ability, repeatable, at Charm speed (after blockers too): `ActivatedDef`'s cost is `{ tap: true; mana? }` in `src/engine/types.ts`, so every activation today is a Duty and taps | 1 (`fd-vyra-ember-sky-rider`) | 1 | no, one row | **The owner's ruling (2026-09-29):** the ability works as a Charm (Charm speed; in the rules that includes after blockers), and the Duel UI shows a +/- ticker so one activation commits N (A2.a). **The session's calls:** build it below the threshold for this one card, as A1.5, narrow (an untargeted effect on the creature itself, creatures only). The scorer carries it as NEEDS MATH at 0 until the lab prices it |
| `empowerHunt` | Empower may Hunt (the Empower validator allowlist is moveMark, reclaim, destroy) | 3 (`fd-thorn-hide-armourback`, `fd-tall-grass-tracker`, `fd-ridge-raptor`) | 3 | yes | Admit with the Hunt op, but it is not an allowlist-only change: Empower riders are contractually trigger-safe (types.ts, EmpowerDef; resolve.ts), and a Hunt can kill and so raise a dies trigger or a deferred choice. P4's state-based placement of Provoked keeps the Hunt's own Provoked out of the rider; the dies triggers still need the rider to allow a deferred choice. Rows: fd-thorn-hide-armourback, fd-tall-grass-tracker, fd-ridge-raptor. **Corrected by the engine spec** (item 3), ruled 2026-09-28 (E4): it is an allowlist-only validator change; Hunt damage only marks damage, and the deaths come in the state-based check after the rider. Also ruled (E5): an empowered creature whose prey leaves still resolves and loses only the rider |

**Not needed after all** (the brief's section 10 estimates): the size
condition ("if you control a creature with Attack 4 or more") was reworded to
Hunt and to the existing `minAttack` target limit (Great-Horn Herder, the
Elders' Verdict, Bring Down the Beast), so no row needs it; the "whenever a
creature you control is provoked" observer, "deals that much damage",
Provoked granted by a static, the one-sided bite and an untap op are used by
no row. **Existing vocabulary to confirm at concretion** (no new construct,
but first use in these shapes): a condition on a self static (`As long as you
control another Dinokin, this gets +1/+1`, which the engine's static layer
reads and the scorer ignores); a targeted `allyAttacks` observer (Herd-Singer
of the Fern, cut in the proposal); and `minAttack` on a Mark target. **Not
existing vocabulary, and no longer used:** a targeted dies trigger that
returns a card from the graveyard can target the dying card itself (the
targeted path exempts graveyard references from `other`, and the
self-exclusion exists only on the untargeted raise). Fossil-Dreamer, the one
row that used it, now reclaims on arrival; a future card that wants the shape
needs that self-exclusion as an engine item.

### G7 and P4: what about 24 rows (22 in the projected cut) hang on

**Corrected by the engine spec (its items 1-3), ruled 2026-09-28: this risk
is retired.** G7 shipped fixed in 1.8.1 (#451): an activation runs through
the same deferral queue a spell uses, and `tests/engine/activated.test.ts`
covers a Duty that kills a creature whose dies trigger is held, so none of
the rows below is gated. The validator forbids an inline target only after a
Foresee, and a targeted trigger raised mid-effect carries the effect's
targets in its continuation, so the tail Duties would be legal either way;
Provoked sits in the state-based check for survival (the spec's Q1, ruled as
recommended). Empower-Hunt is an allowlist-only change (E4). The three
bullets below are the draft's reading, kept as written.

- **G7** (an activation that raises a dies trigger or a deferred choice; the
  engine throws today, and plan-1.9 requires it fixed before First Dawn
  prints a Duty that removes a creature) gates every Duty that deals damage
  or Hunts: `fd-korru-eldest-tracker`, `fd-ashka-fire-walker`, `fd-sefa-first-fire`, `fd-venna-red-hand`, `fd-tracker-long-grass`, `fd-fire-pit`, `fd-standing-stone`, `fd-obsidian-knife`, `fd-kindler`, `fd-warband-drummer`, `fd-fire-brand-initiate`, `fd-hearth-tender`, `fd-scar-singer`, `fd-ember-pot`.
- **P4's state-based placement of Provoked** keeps the "damage or Hunt, then
  a tail" Duties legal. An activation may not defer a tail that needs an
  inline target (the rule noted in `types.ts` beside `validateActivatedDef`).
  If Provoked fired inline at damage time, a targeted Provoked on the struck
  creature would defer mid-Duty and the tail would be illegal. The tail
  Duties: `fd-sefa-first-fire`, `fd-fire-pit`, `fd-standing-stone`, `fd-obsidian-knife`, `fd-warband-drummer`, `fd-fire-brand-initiate`, `fd-hearth-tender`, `fd-scar-singer`, `fd-ember-pot`. The targeted Provoked rows: `fd-ember-crest-tyrant`, `fd-long-neck-mother`, `fd-bone-wall-elder`, `fd-thorn-hide-armourback`, `fd-herd-guardian`, `fd-river-wader`, `fd-scorch-tail`, `fd-reed-wall-keeper`.
- **Empower-Hunt** is not an allowlist-only validator change. Empower riders
  are contractually trigger-safe (`EmpowerDef` in `types.ts`, and
  `resolve.ts`), and a Hunt can kill and so raise a dies trigger or a
  deferred choice. Rows: `fd-thorn-hide-armourback`, `fd-tall-grass-tracker`, `fd-ridge-raptor`.

## Protect-first (kept whatever the histogram says)

1. **Oru, the Tyrant Queen**: the split lord, R28's portrait and Darling.
2. **Tahla, Shepherdess of Thunder**: R27's portrait and Darling.
3. **Herd-Caller Hornback** and **Long-Neck Matriarch**: the two other lords
   (the brief keeps all three).
4. **Spear and Fang** and **Challenge the Beast**: the common Hunt spells that
   teach the mechanic (both also LAB FIRST: see question A).
5. **Fern-Back Grazer** and **Cinder-Crest Raptor**: the common Provoked
   payoffs in the two primary colours.
6. **Coal-Thrower** and **Hearth-Tender**: the common sources in red and
   white (white needs two at common).
7. **Hearth-Shield Maiden**: white's common block-shaped payoff.
8. **Tar-Rite** and **Cliff-Nest Rider**: the common minters for Tar-Bones
   and Glider.
9. **Vyra, Ember-Sky Rider**: the owner's ninth Ultra Rare, the set's
   Shivan Dragon (2026-09-29).

## The cut, in order

1. Every `stretch` row.
2. `flex` rows by the histogram, colour by colour, until 82 / 49 / 15 / 11 /
   9 (8 Ultra Rares as B3 ruled; 9 since the owner's Vyra ruling,
   2026-09-29), holding enabler density (the minimums above, and sources at least three
   quarters of payoffs in every Provoked colour), the token-minter floor (two
   per token), the tribe's floors, at most eight Dinosaur creatures and four
   Beastkin.
3. Then the overlap audit again, and the name collision check against the
   pool at that date.
4. Then costing: the rescore on the lab's rates, before transcription.

### The projected cut (a proposal for the owner's review)

Upper rarities first, as the Drowned Deep cut board did. 45 rows out; the
projected cut meets the histogram, every density minimum, the tribe's floors,
the token-minter floor and the construct thresholds above (the war-drum
self-sweep keeps three rows, Empower-Hunt three, the Hunt spell targets
eight).

**UR, cut 3:** Rakka, Queen of the Red Pack (R, flex); The Painted Cave (W, flex); Venna Red-Hand, War-Chief (R/W, flex). Vyra, Ember-Sky Rider (R, core, protect) was added on 2026-09-29 and is kept, so 12 Ultra Rares become 9, and the 45 rows out leave 166.

**SSR, cut 3:** Uzza the War-Painter (R, flex); Kree of the Wind-Crest (U, flex); Fern-Crown Tyrant (G, core). *As ruled 2026-09-28 (F6): the proposal cut The Great Drum of the Hearth (W, flex) here; the owner kept it and dropped Fern-Crown Tyrant instead.*

**SR, cut 4:** Crag-Leaper (R, flex); Frozen in the Ice (U, flex); Ash on the Wind (B, flex); Nest-Keeper of the Fern (G, flex).

**R, cut 13:** Old Bull of the Herd (G, flex); Tusk-and-Claw Hornback (G, flex); Herd-Singer of the Fern (G, flex); Hurled Firebrand (R, flex); Obsidian-Tooth Tyrant (R, flex); Raptor Ambush (R, flex); Hold Until Sunrise (W, flex); Brow-Plate Armourback (W, flex); Ice-Mirror Seer (U, flex); River-Lurker (U, flex); Ash-Rite (B, flex); Bones in the Tar (B, flex); Sky-Herder of the Cliffs (W/U, flex).

**C, cut 22:** Bone-Snap Ambush (G, stretch); River-Wader Longneck (G, flex); Hatchling-Mother (G, flex); Call of the First Dawn (G, flex); Stampede Path (G, flex); Grazing Hornback (G, flex); Stubborn Armourback (G, flex); Ember Fury (R, flex); Raptor-Whistler (R, flex); Pack-Runner Raptor (R, flex); Bone-Bead Elder (W, stretch); Blessing of the Herd-Mother (W, flex); Stand Behind the Horns (W, flex); Shield-Crest Armourback (W, flex); Hearth-Guard (W, flex); Tide-Pool Lizard (U, flex); Ice-Lens Totem (U, stretch); Frost-Bitten Seer (U, flex); Marrow-Drinker (B, stretch); Ash-Brand (B, flex); Grave-Dust (B, flex); Ash-Choked Breath (B, flex).

**Weak spots the review named, as cut candidates.** Blue's rare band is
filler-heavy: Nest-Mother of the Cliffs, Wind Over the Cliff Nests,
Ice-Speaker, Cliff-Top Scout and The Ice Wall Holds read as commons with a
rider, and blue has no build-around at Rare (blue carries neither mechanic by
the brief's pie, so its identity is taps, fliers and the fossil line). Drum-Keeper of the
Hearth and Call the Pack are quota fillers. All seven are the first
candidates if the owner's cut wants the rare band tighter; a blue fossil or
flier build-around at Rare would be a new row, not a rewrite.

**The white Duty showcase.** The brief names four white Duty showcase cards
(the Hearth, the Drum, the Standing Stone, the Painted Cave). The projected
cut drops two of them (The Painted Cave at Ultra Rare, The Great Drum at
Double Super Rare), leaving The Clan Hearth, the Standing Stone and the
Herd-Horn. Keeping one is recommended in question 9. **Ruled 2026-09-28
(F6):** the Great Drum is kept, so three of the four showcase cards the
brief names are on the board (the Hearth, the Drum, the Standing Stone).

## Questions for the owner

Each leads with the recommendation. **All RULED at the owner's second
sitting, 2026-09-28** (the sheet's F1-F8 for the card questions; the engine
questions 3, 4, 5, 11 and 13 were answered by the engine spec's rulings,
E3, E4, E2, E7 and E1). Each answer leads its question below.

1. *Ruled (F1): yes.* The provisional rates stand until the lab replaces
   them; the flagged rows are not moved on them.
   **Provisional rates: use them for the concretion audit and the engine
   spec, and let the lab replace them before the cut, knowing their two
   biases.** Hunt discounts the burn by survival instead of charging the lost
   body, so glass-cannon hunters read hot (four rows, not moved again);
   Provoked's curve rewards Defense for survival but ignores that walls are
   struck least without a source, and prices two-card engines at the passive
   rate (five rows). Both are stated in "The provisional rates"; the flagged
   rows are LAB FIRST.
2. *Ruled (F2): "Dreaded is good."* Oru's Dinosaur half is Dreaded, as
   written. **The split lord's Dinosaur bonus: Dreaded.** It keeps the anthem off a
   token swarm's Attack. Alternatives: Warcry, +0/+1 and Sentinel, Overrun
   (see the split-lord section).
3. *Ruled (E3): "Keep."* `eachYourCreature` is built in A1 for the three
   rows. **Admit `damageEachYours` ("damage each creature you control N").** Four
   rows in the overplan, three in the projected cut (War Drums, Drum-Beater,
   Trial by Ember): red's war-drum and white's scarring rite. It clears the
   three-row threshold. Drum-Beater is the only common on it and teaches
   board-wide self-damage (your own Pack Raptors and Hatchlings die to it).
   The alternative is to reword them to "damage target creature you control
   N", which loses the provoke-the-whole-team turn.
4. *Ruled (E4): "Validator change."* The engine spec showed it is an
   allowlist line after all (see the construct table), and the owner took
   that. **Admit Empower-Hunt with the Hunt op, as a real engine change, not an
   allowlist line:** a Hunt inside a trigger-safe rider can raise a dies
   trigger. Three rows, all kept in the proposal.
5. *Ruled (E2), the other way from this recommendation:* the Hunt op
   carries its own Bulwark and distinctness rules, and no general
   keyword-qualified target is built; Bone-Snap Ambush stays cut, or
   returns reworded into existing limits.
   **Admit the keyword-qualified target (reversed from the first draft).**
   Every Hunt spell's hunter must exclude Bulwark (H3a), so the construct
   clears the threshold on eight rows; Bone-Snap Ambush ("with Skyborne")
   then rides it at no extra engine cost, and the owner may restore it from
   the stretch rows.
6. *Ruled (F3): "Trim TOWARDS 18 but if we land around 20 that's fine."*
   The target is 18 and about 20 is acceptable; the trim happens at the cut,
   after the lab. (F6 puts the projected cut at 31 Duty rows; G7 is no
   longer a reason to trim, see "G7 and P4".) **Trim Duty toward the brief's
   18 in the cut.** The projected cut keeps
   30 Duty rows (budget 18), and every Duty is an AI decision
   node and G7-gated when it deals damage or Hunts. The candidates: the
   colourless Duty commons (Bone Whistle, Amber Resin, Ember-Pot), a white
   Duty creature (Drum-Keeper), a blue Duty tapper (Ice-Speaker), and Oshka's
   or the Ice-and-Tar Seer's reclaim. Provoked (33, budget 26)
   and Hunt (23, budget 18) are over by less and can stay over in
   the overplan.
7. *Ruled (F4): "Keep 12."* The flex Hatchling commons go first, at the
   cut (the projected cut holds 18 makers after F6).
   **Hatchling minters: keep about twelve in the cut, not 17.**
   The herd is built on them, but 17 makers is more than a
   go-wide pair needs; the flex Hatchling commons are the first to go.
8. *Ruled (F5): "Lab first."* Each is measured before the cut.
   **The engines that fire every turn stay lab-first.** The self-provoke
   engines (Ashka and Sefa, Ultra Rare only: a Duty that damages its own
   carrier), and the two-card engines priced at the passive rate: Vessa with
   the Standing Stone or any free source, The Walking Mountain and Mother of
   the Long-Necks with a free source, and the whole-side provokes (Ring of
   Embers, War Drums). The lab measures each before the cut.
9. *Ruled (F6): yes.* The cut starts from the projected board, upper
   rarities card by card, with the Great Drum kept and Fern-Crown Tyrant
   dropped (recorded on both rows, the projected cut and the self-audit).
   Fern-Crown Tyrant's slot on R28's draft list is open until the cut.
   **The projected cut as the starting board, keeping one more white Duty
   showcase card.** The owner reviews Ultra Rare, Double Super Rare and
   Super Rare card by card first, as for Drowned Deep. The proposal drops
   Rakka, the Painted Cave and Venna Red-Hand at Ultra Rare, and Uzza, Kree
   and the Great Drum at Double Super Rare; two of the four white Duty
   showcase cards the brief names go with them. Recommended: keep the Great
   Drum and drop Fern-Crown Tyrant instead (green keeps two Double Super
   Rares; white rises to 30 cards, green falls to 33).
10. *Ruled (F7): yes.* **R28 stays R/G (Oru).** Defended in the brief; the R/W alternative has no
    Ultra Rare legendary in the projected cut.
11. *Ruled (E7), the other way from this recommendation: "Cost them in
    lab."* Deathblade hunters are accepted, in every form, and the lab prices
    the Hunt spells and both Duty hunters on a Deathblade-dense field (the
    spell-only exclusion would have left the Duty hunters open). "A creature
    with Deathblade can't hunt", in every form, is the fallback if the lab
    finds the pairing over band. **(A) Deathblade hunters through the Hunt
    spells: exclude Deathblade from the spell form's hunter, the same
    keyword-qualified target as question 5.** Hunt damage carries Deathblade (H4), so any Deathblade body
    plus Spear and Fang ({1}{G}) is an unconditional kill for two mana;
    Ash-Cat Ambusher ({1}{B} 1/1 Deathblade) plus Spear and Fang kills
    anything for three in the signposted B/G pair, against 22 Deathblade
    bodies already in the starter columns; Nirra hunting with Fang and Horn
    kills and is provoked. The Hunt spells are costed on a nominal 3/3.2
    hunter, which prices none of this. The alternative is to accept it as
    the B/G payoff (deathtouch plus fight is a Magic staple) and cost the
    spells on the Deathblade case. Either way, the common Hunt spells are
    flagged LAB FIRST on a Deathblade host.
12. *Ruled (F8): "Dinokin only."* Long-Neck Matriarch's static reaches
    Dinokin, not Dinosaurs; Oru is the one lord that reaches Dinosaurs.
    **(B) The matriarch's reach: Dinokin only.** The brief's open question 1
    (does Long-Neck Matriarch also give Dinosaurs +0/+1 and Sentinel) was
    settled by the split-lord ruling only by implication. Now that Oru
    reaches Dinosaurs, a second Dinosaur lord would stack two statics on the
    token swarm; recommended: the matriarch stays Dinokin only. The
    alternative is the brief's original recommendation, which makes
    Hatchlings 1/2 Sentinel under her.
13. *Retired (E1, with the engine spec):* G7 shipped fixed in 1.8.1, and
    the owner ruled Provoked's state-based placement as the spec
    recommended. No row is gated. **(C) Risk: 24 rows (22 in the projected
    cut) depend on
    G7 and on P4's state-based placement of Provoked** (the Duty pings and
    Duty Hunts, the "damage or Hunt, then a tail" Duties, the Empower-Hunts
    and the targeted Provoked rows; listed under "G7 and P4"). Recommended:
    rule P4 as written before the spec, and schedule G7 ahead of A1; if
    either slips, those rows are the ones to reword or cut.

**Ruled 2026-09-29 (the owner): a ninth Ultra Rare, the set's Shivan
Dragon.** The owner asked for "a Red UR card similar to Shivan Dragon, with
a repeatable Pump-Attack ability", then ruled three questions:

- **The sky.** She is the sole red Skyborne card: a red rider, a woman on a
  Skyborne pterosaur.
- **The pump.** It works as a Charm (Charm speed; in the rules that
  includes after blockers), and the Duel UI gives it a small +/- ticker, so
  the player makes a "single cast" pump instead of being asked about every
  mana.
- **The count.** Ultra Rare rises from 8 to 9, so the histogram is 82 / 49
  / 15 / 11 / 9 = 166, a deliberate change to B3, and one card over D2's
  150-165 range.

**The working draft (the session's, not ruled):**

- **The card.** Vyra, Ember-Sky Rider, {4}{R}{R} 5/5, Legendary Creature:
  Human Rider, Skyborne, "{R}: This gets +1/+0 until Sunset." An Ember-clan
  woman on a plain pterosaur; Human, not Dinokin, per D2, and the mount a
  plain Dinosaur beast. The session frames red Skyborne as a pie exception
  at Ultra Rare (the brief gives the sky to W/U). Core, protected.
- **The engine work.** Scheduled as A1.5: a non-tap, mana-only ability,
  repeatable, one action paying for N activations, narrow (an untargeted
  effect on the creature itself, creatures only).
- **The score.** On the v4 scorer without the pump: power 6.43 against a
  budget of 7.44, Δ -1.01 (body 5/5 +4.58, Skyborne at Attack 5 +1.85). The
  pump is NEEDS MATH, valued 0 until the lab; priced, it fills the gap.
  Shivan Dragon is the 8th-10th edition anchor.
- **Owed on her row:** the overlap comparator and the name check (`not yet
  run`), and the rescore once the lab prices the pump. Her art entry is in
  `docs/art-bible/first-dawn.md`, with a draft prompt that Fable reviews
  before any image is generated.

**For the engine spec (lane A), not the owner** (superseded: the engine
spec answered each point, and corrected the G7, P4 and Empower-Hunt readings
here; see its "What this spec corrects"): G7 gates every Duty that
deals damage or Hunts, and P4's state-based placement is what keeps the tail
Duties and the Empower-Hunts legal (both listed under "G7 and P4"); the Hunt
spell's hunter spec excludes Bulwark and its two targets must be distinct
creatures (two constructs above), and the Hunt op refuses a hunter that has
gained Bulwark by resolution (H3a); Empower-Hunt needs the trigger-safe
contract relaxed for a Hunt, not only the allowlist; a targeted dies-reclaim
needs a self-exclusion if a future card wants it; and the converter's target
walk needs the two-sided dead-target case.
