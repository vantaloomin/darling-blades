<!-- source-of-truth: docs/plan-1.9.md, docs/plan-expansion-slate.md, docs/plan-road-to-2.0.md, docs/expansions/drafts/drowned-deep-brief.md, docs/rules.md, docs/art-bible/index.md, docs/keyword-map.md, docs/card-building-guide.md, src/engine/types.ts, src/engine/sba.ts, src/engine/effects/EffectInterpreter.ts, src/data/axes.ts, src/data/opponents.ts, scripts/personas/templates.ts · last-verified: 2026-09-28 · set identity brief — the owner-approval gate before the First Dawn overplan is authored; its Provoked and Hunt fine print are working assumptions for the engine spec to confirm; nothing here is a card -->

# First Dawn: set identity brief

Lane B, step 1 of the 1.9 train ([plan-1.9.md](../../plan-1.9.md)). This
brief fixes what the set *is* so that the overplan of about 210 candidates
can be written against it. **Approved by the owner 2026-09-28**, with three
changes folded in: dinosaurs are a tribe with lords (Dinokin, section 2),
Hunt may target your own creatures (H1), and Hunt damage counts for every
damage keyword and trigger (H4). The rulings are listed in section 12.

The order is new for this set (owner ruling D16, 2026-09-28): **the cards
come before the engine spec.** The overplan is designed first, a concretion
audit maps its rows to engine vocabulary, and only then is the spec for
Provoked, Hunt and every gap written. So this brief also carries **working
assumptions** for the mechanics' fine print (section 9), for the owner to
confirm or change, and a **vocabulary discipline** rule (section 10) that
keeps engine work off the critical path.

Fixed by the rulings: the name, the prehistoric concept (adult cavewomen and
dinosaurs), a fresh set of 150-165 cards overplanned to about 200-215 (R2,
D2), Provoked and Hunt (R1, D1), no new engine feature, no flavor text (R13),
and every row costed on the 1.8.5 scorer.

## 1. The world

**The morning the sun first rose.** The clans of the Cradle, a green valley
inside a ring of smoking mountains, believe the sun was born this morning and
everything alive is waking to it. Ferns taller than a woman, rivers running
warm off the volcanoes, and beasts that are the largest things that will
ever live. The cards show that morning: long low light, steam off the fern
forest, a herd crossing the Long Grass, a hunter crouched in the reeds.

**The people** are five clans of cavewomen, every one an adult woman:
chiefs, hunters, trackers, fire-keepers, seers, elders. They are this world's
protagonists, never its captives. Hide, fur, woven grass, bone, shell and
stone; flint spears, atlatls, bolas, stone axes. No metal, no wheel, no
writing. **The beasts** are dinosaurs first (raptor packs, horned herds,
long-necks, armoured walls, tyrants; on the card face, the Dinokin tribe),
with pterosaurs, sea-lizards,
mammoths, sabre-cats and cave bears beside them: genre pastiche in the
*One Million Years B.C.* tradition, not paleontology.

**The mechanics are the valley's two laws.** *Provoked*: what is struck and
survives comes back angrier. *Hunt*: a hunt is a fight both sides can lose.
Hunt is the set's way to provoke on your own terms: your hunter takes the
prey's Attack in damage, and if she survives it, she is Provoked.

**Tone**: sunlit wonder with teeth; primal and heroic, never grim, never
comic. No gore, no Flintstones gags, none of the caveman-drags-woman
clichés. The face carries name, art, type line, rules and stats; the art
takes the room flavor used to hold.

## 2. The colour pie

Each colour has a job with each mechanic, and a colour that prints a
mechanic's payoffs also prints the means to turn it on (the Starborne
lesson, 2026-08-25).

| Colour | Its clan | Provoked | Hunt | Duty |
| --- | --- | --- | --- | --- |
| **Green** | the Fern clan: trackers, beast-callers, horned herds, tyrants | **primary**: big bodies that grow when struck (Mark this) | **primary**: the Hunt spells and most hunters; green's first real removal (the live pool's ~250 mono-green cards carry two creature-removal effects) | trackers (a paid Hunt Duty, SR and above), herd-callers (Mark target creature you control) |
| **Red** | the Ember clan: fire-walkers, war-painters, raptor packs | **primary**: attackers that rage when struck (burn, +Attack, Warcry), and **the main self-damage sources** | **secondary**: high Attack, low Defense hunters that usually trade | the fire-pit: a paid ping at your own creature or theirs |
| **White** | the Hearth clan: fire-keepers, elders, shepherdesses of the long-necks | **secondary**: walls and herd-guardians provoked by blocking (gain life, Mark the herd, make a Hatchling) | none | **the showcase**: the Hearth (gain life), the Drum (tap target creature), the Standing Stone (damage your own creature 1 and Mark it), the Painted Cave (target creature you control gets +0/+2 until Sunset) |
| **Blue** | the Sky and Ice clans: pterosaur riders of the Cliff Nests, frost-seers of the Ice Wall | none | none | scouts (Foresee), frost-seers (tap target creature) |
| **Black** | the Tar clan: bone-callers of the Tar Flats, ash-witches, cave sabre-cats | a few: drains when struck | at most one, SR or above | bone-callers (grind self, raise from the tar) |

- **Blue and black answer without damage**: blue taps and recalls (a
  recalled creature loses its damage), black destroys, severs and edicts.
  Deathblade is black's counter to a Provoked creature in combat, except
  against Twin Blades, which strikes first.
- **Duty prints in all five colours** and on all three carrier types; every
  colour gets at least two Duty creatures.
- **Multicolour under ten percent, at R or above.** Signposted pairs: R/G
  (the core), G/W (the herd), R/W (the warband), B/G (Hunt plus fossils),
  U/B (the fossil line), W/U (pterosaur fliers and taps).
- **Returning mechanics**: Marks (creature-scoped), Rage (raptor packs),
  Empower (an optional arrival Hunt, section 10), Foresee, a little Skim and
  Retell. Nine Lives, Hauntlink, Whispers, Tithe, Rite, Preserve and Quest
  stay out.
- **No card carries First Blade and Provoked** (First Blade avoids the
  damage Provoked needs).

### The Dinokin tribe (owner ruling 2026-09-28: dinosaurs are an Axis with lords)

**The name.** *Dinokin*, on the Beastkin pattern: a creature type that is an
Axis (`src/data/axes.ts`, recorded in `docs/plan-tribal-pass.md` when the set
lands), with a species flavour subtype beside it as Beastkin cards carry
Wolfkin or Deerkin (Raptor, Hornback, Longneck, Armourback, Tyrant, Skywing;
inert). *Recommended*: **Dinokin replaces "dinosaur-kin" and the separate
Dinosaur subtype everywhere**, so one word means "a dinosaur body" and the
lords read on every card that looks like one. It goes on the dinosaur
monster-girls and on the dinosaur tokens (the Fox Spirit precedent: an animal
token typed Beastkin). A rider stays typed after the woman (Human Hunter),
because her card is a woman who rides, not a dinosaur; riders are SR and
above and few. Tar-Bones is a Skeleton, not Dinokin: the fossil is dead, the
tribe is the living herd.

**The size.** The tribal pass puts a real tribal deck at about ten distinct
in-pair cards; Drowned Deep's Horror Axis printed 33 of 252 (9 C / 12 R / 4 SR
/ 3 SSR / 5 UR across B, U and G) with one lord at R. Dinosaurs are this
set's headline, so **about 40 of 165 collectible cards are Dinokin**: G 14,
R 11, W 7, U 3 (the pterosaur-kin), B 2, multicolour 3; by rarity about 18 C /
13 R / 4 SR / 3 SSR / 2 UR. That puts about 27 in R/G and 22 in G/W, well
past the floor, before tokens.

**The lords: three, plus three other payoffs.** The tribal pass found 19 of
23 shipped lords are flat anthems, so each lord carries texture:

| Card (shape) | Rarity | Colour | Static | Why |
| --- | --- | --- | --- | --- |
| The herd-caller lord | R | G | Your other Dinokin have Overrun | the draftable lord; no stat change, so Hunt is untouched |
| The long-neck matriarch | SR | W | Your other Dinokin get +0/+1 and have Sentinel | Defense is a Provoked shield: the herd survives the blow and is provoked |
| The Tyrant Queen's card | UR | R/G, legendary | Your other Dinokin get +1/+1 | the one Attack lord, R28's portrait and finisher |

The other payoffs use existing vocabulary: an arrival Hunt conditioned on
"if you control another Dinokin" (`controlsOther`), a "whenever another
Dinokin you control attacks" observer (`allyAttacks` with a subtype filter),
and one "whenever another Dinokin you control dies" (`allyDies`). Lords are
costed on the 1.8.5 scorer's flat creature-lord factor (x2.0, measured
in-engine in 1.8.5's lane 2 and ruled flat, D10); observer filters take its
subtype multiplier.

**With Provoked and Hunt.** Lords grant keywords and Defense, not Attack,
except the UR, because every point of Attack a lord adds is a point of
removal on every Dinokin hunter (the H5 cap reads printed Attack; the lab
measures Hunt with each lord on the board). Defense lords feed Provoked by
keeping the damaged alive. No lord grants Provoked (P5).

**Density the tribe needs at the cut**: at least ten Dinokin in each of R/G
and G/W at C and R, at least eight Dinokin commons in green, five in red and
three in white, and all three lords.

**Tooling.** The duplicate comparator counts a subtype only when some card
pays it off. Once the Dinokin lords exist, the type splits otherwise
identical cards, so a Dinokin body and a non-Dinokin body with the same line
are no longer flagged. The overplan must not use the type to launder a
duplicate; that pair is a manual read.

## 3. Budget and enabler density

- **Payoff**: a card that prints Provoked.
- **Source**: a card whose controller damages a creature on their own terms:
  every Hunt card, a ping that may target your own creature, "damage target
  creature you control", a sweep of 1 that hits your own side. Sources are
  what the Drowned Deep cut lacked, for Whispers, in white and red.
- **Shields** (a Defense trick, a Mark, a high-Defense body) and combat (the
  opponent's choice) do not count toward the minimums.

**Budget at 165** (overplan targets, not the cut):

| Mechanic | Cards | Notes |
| --- | ---: | --- |
| **Provoked** | 26 | G 9, R 8, W 5, B 2, multicolour 2 |
| **Hunt** | 18 | G 10, R 5, B 1, multicolour 2; about 7 spells, 8 arrival hunters, 2 Duty hunters (SR+), 1 attack-trigger hunter |
| **Other sources** | 15 | R 7, W 4, B 2, G 1, colourless 1 |
| **Duty** | 18 | 7 artifacts and enchantments (W 3, U 1, R 1, B 1, colourless 1), 11 creatures |
| **Token minters** | 12 | section 6 |
| Vanilla and french-vanilla commons | at most 30% of commons | the Starborne line |

**Minimums the cut must hold** (a cut constraint, as for Starborne):

| Colour | Payoffs (all / C) | Sources incl. Hunt (all / C) | Hunt |
| --- | --- | --- | --- |
| **Green** | 8 / 4 | 10 / 5 | 8 |
| **Red** | 7 / 4 | 9 / 5 | 4 |
| **White** | 4 / 2 | 3 / 2 | 0 |
| **Black** | 2 / 1 | 2 / 1 | at most 1 |

In every colour that prints Provoked, sources are at least three quarters of
payoffs, and white's payoffs are block-shaped (high Defense, Bulwark or
Sentinel).

## 4. The metagame, and what the set means to move

The field (the 1.8.0 pool, pre-release round 0, 2026-09-24): control and
midrange lead and go-wide trails (attrition 78.2%, burn 84.2, draw-go 83.6,
midrange 88.9 against the prefabs); **reanimator is the weakest persona** at
63.3%; **the Starborne and Silver Veil theme decks** (Chrome-Violet
Broodship, G/U/R; Glimmer Bargain, U/B/G) **conceded 95-97%**. Both are
three-colour decks whose plans need assembly, the likely cause but not a
measured one. The starter columns field 22 Deathblade creatures and 21
Skyborne against 9 Warding Gaze.

What First Dawn moves:

1. **Go-wide, directly**: the G/W herd (Hatchling makers, a stampede turn of
   +1/+0 and Overrun, Provoked walls, and the Dinokin lords on a board of
   Dinokin Hatchlings). No new mass sweeper, and at most three
   sweeps of 1 (R and above), since each kills Hatchlings.
2. **Big bodies**: Hunt is green's removal and answers the 1/3 Deathblade
   blockers that punish fatties, at the hunter's cost (Deathblade applies to
   Hunt damage, H4).
3. **Reanimator, modestly**: the Tar clan's fossil line, four to six black
   and blue cards that grind your own deck and raise or reclaim.
4. **Not the two folding theme decks**: new cards do not change fixed shop
   lists (a deck-list pass is an FYI in section 12). The set owes them a
   tenth theme deck that does not fold.

**Colour split at 165**: G 34, R 32, W 29, U 25, B 25, multicolour 12,
colourless 8.

**The sweep cannot see those colours today**: no persona plays green or
red-white. D12's new personas should play **R/G** (the core pair, where a
broken Hunt-plus-Provoked deck would show) and **R/W** (the gap D12 names;
it tests the self-damage sources), with **B/G** as a third if lane F's
budget allows. G/W is covered only if weenie rejoins, and weenie's return
rests on lane F's fix, which is not yet proven; without it the herd goes
unmeasured.

## 5. Theme deck and summit pair

**The tenth theme deck: R/G, "the Stampede"** (working name): a Dinokin
deck, hunters and horned herds on a steady curve with the green Overrun lord, Hunt and burn as six to eight removal slots,
red's sources to provoke on its own terms, one or two tyrants on top. It
avoids what sank the two folding decks: two colours, not three; every
creature an honest body without its trigger; no multi-turn engine to
assemble. It plays the personas in wave 4, and a list below the median
prefab of the latest reading is reworked before it ships.

**Rungs 27-28**, above R25 The Drowned Deacon (U/B) and R26 The Marsh-Mother
(B/G). Working names.

- **R27, The Shepherdess of Thunder (G/W, the herd).** She goes wide with
  Dinokin Hatchlings and long-neck walls whose Provoked gains life, Marks
  the herd or makes a Hatchling; the long-neck matriarch lord keeps the herd
  alive and Sentinel, and a stampede turn finishes. Attacking into her feeds
  her; not attacking lets her grow. The tower has never fielded green-white.
- **R28, The Tyrant Queen (R/G, the final rung).** Hunt removal on big
  bodies, red sources and self-Hunts that provoke her own tyrants, Provoked
  payoffs that grow and burn, and her own UR, the +1/+1 Dinokin lord, as
  finisher and portrait.

With these, four of the top six rungs play green (23, 26, 27, 28), and R28
repeats R23's pair. Defended: a summit pair shows off its set, and First
Dawn is a green set; R23 is a go-wide Mark swarm while R28 is big-body
removal, so they play differently. The alternative, if the owner wants the
colours spread, is R28 as R/W (the warband), leaving R/G to the theme deck.
Both rungs get converter-owned Darlings decks, their own gate test, and
floors from the final band.

## 6. Tokens

Each with at least two minters in the cut, checked by test.

| Token | Body | Minters (shapes) |
| --- | --- | --- |
| **Hatchling** | G 1/1 Dinokin | green nest commons (arrival), white's Herd-Horn Duty artifact, a Provoked wall ("Provoked: create a Hatchling"), R27's herd cards |
| **Pack Raptor** | R 2/1 Dinokin, Warcry | red pack-callers (arrival), a Ritual that calls two, one red Provoked rare |
| **Tar-Bones** | B 2/2 Skeleton, a fossil from the tar (not Dinokin) | black tar Rituals, a black dies-trigger body, the B/G fossil rare |
| **Glider** | U 1/1 Dinokin, Skyborne (a pterosaur) | blue Cliff Nest commons, the W/U sky rider; the flex token, cut first |

## 7. Rarity histogram

**Proposed: 165**, the top of the range, because two new mechanics plus the
source minimums need the room. From Starborne's shares: **82 C / 49 R / 15
SR / 11 SSR / 8 UR.** Overplan at about 1.27x: **104 / 62 / 19 / 14 / 11 =
210.** At 151: 75 / 45 / 14 / 10 / 7. Locked at the cut (D2).

## 8. The rules the rows are written against

Every rule in [plan-1.9.md](../../plan-1.9.md) Lane B ("The rules the rows
are written against") applies as written, with the #436 catalog guard and
`scripts/audit-overlap.ts` from the first row. Added for this set: no flavor
text (R13); every Provoked and Hunt row carries a provisional rate flagged
**NEEDS MATH**; names avoid the bare word "Hunt" (the keyword matcher
already steps around four live names), and none says "Provoke" or
"Enraged".

## 9. Working assumptions for Provoked and Hunt

**Assumptions for the owner to confirm or change**; the engine spec turns
the confirmed ones into rules, checked against the overplan's cards.

### Provoked ("Provoked: [effect]" triggers when this creature survives damage)

- **P1. The boundary.** A creature is provoked when it is dealt more than 0
  damage and is still on the battlefield after the state-based pass that
  follows. A creature that dies, Deathblade included, is never provoked.
  Combat and non-combat damage both count, from any source. Each combat
  damage step is its own event (First Blade's step and the regular step are
  two). *Recommended*: it is the ruled wording, and every source enables it.
- **P2. Once per what.** *Recommended: at most once each turn per creature*,
  as a rule of the mechanic on the existing `oncePerTurn` machinery (once on
  your turn, once on your opponent's). One line answers First Blade's two
  steps and simultaneous sources, and it bounds every loop: a chain is never
  longer than the number of Provoked creatures. Once per event plus a data
  rule cannot close the cross-board loop (two "Provoked: damage target
  creature an opponent controls 1" creatures facing each other, a Mark on
  each side absorbing the damage). The cost: a creature pinged twice in a
  turn fires once, so the reminder text must say so and the Duel card needs
  a visible spent state, or players read a bug (A2 work).
- **P3. Loops.** Closed by P2. The engine's eight-link chain cap
  (`MAX_MARK_TRIGGER_DEPTH` in `EffectInterpreter.ts`) covers only the mark
  observers and the life-gain observer today, and `checkStateBased` carries
  no depth, so **the cap must be extended to the Provoked path** (a depth
  carried through the state-based pass) as the runtime backstop: A1 work. A
  design rule on top, for legibility: no Provoked effect damages its
  controller's own creatures, and none Hunts.
- **P4. Ordering.** This engine resolves triggers the moment they fire,
  mid-effect, and a held trigger keeps that place (rules.md, "Where a held
  trigger resolves"). *Recommended*: Provoked fires **in the same
  state-based pass as the deaths it survived**, inline, in battlefield order
  after that pass's dies triggers. A targeted Provoked trigger defers its
  choice to its controller through the queue targeted attack and Dawn
  triggers use, and fizzles silently with no legal target. One from the
  first-strike step resolves before the regular step. **Open detail for the
  spec**: `checkStateBased` loops up to 30 passes with dies triggers inside,
  so a dies trigger can kill a "survivor" before its Provoked fires.
  *Recommended*: survival is judged at the pass that dealt the damage,
  Provoked resolves after that pass's dies triggers, and a creature killed
  by a dies trigger in between is never provoked.
- **P5. Scope.** Printed on creatures only, tokens included; never granted
  by a static or an aura.

### Hunt (your creature and target creature each deal damage equal to their Attack to the other)

- **H1. Shapes and prey (owner ruling 2026-09-28: you can hunt your own
  creatures).** One op, two forms: the **spell** ("Target creature you
  control hunts another target creature") and the **source-bound** form
  ("this hunts another target creature") on an arrival trigger, an attack
  trigger or a Duty. **The prey may be any other creature, yours included;
  a creature cannot hunt itself** (the source-bound form uses `other`; the
  spell's two targets must be different creatures, a detail for the spec).
  This opens the **self-provoke line**: hunt your own Provoked creature to
  provoke it, and the hunter too if both survive. P2 bounds it (each
  creature is provoked at most once a turn), so a self-Hunt is at most two
  Provoked triggers for one card. A self-Hunt can also kill your own
  creature, which makes it a sacrifice outlet for dies triggers; the lab
  watches that use.
- **H2. Fizzle.** If either creature is gone or no longer a legal target,
  neither deals damage.
- **H3. The numbers.** Each deals damage equal to its effective Attack at
  resolution, simultaneously; 0 or less deals none. The Hunt op itself
  neither taps nor checks readiness, so a spell or arrival Hunt works with a
  tapped or newly arrived creature. **A Duty hunter pays the Duty's tap and
  follows its rules**: not already tapped, not arrived this turn without
  Warcry, your own Morning or Afternoon only.
- **H3a. Bulwark prevents Hunt (owner ruling 2026-09-28, at any rarity).**
  A creature with Bulwark can never be the hunter. This is a rule, not a
  data guideline, so the engine spec makes the Hunt op refuse a Bulwark
  hunter: a spell's "target creature you control" excludes Bulwark
  creatures, "this hunts" is never printed on a Bulwark body, and a creature
  that gains Bulwark cannot hunt while it has it. Bulwark creatures can
  still be the prey. It closes by rule the costing hole the 1.8.5 scorer
  would otherwise open (Bulwark's penalty grows with Attack, so a Bulwark
  hunter would take the full cannot-attack discount and then spend that
  Attack as removal).
- **H4. Keywords (owner ruling 2026-09-28: Hunt damage can trigger other
  keywords).** **Hunt damage counts for every keyword and trigger that reads
  damage dealt or taken**: Deathblade, Blood Oath, Provoked, and any "is
  dealt damage" or "deals damage" trigger, carried by the Hunt op itself.
  Untouchable keeps an opponent's creature from being the prey (your own is
  still a legal prey). Keywords defined by combat itself (First Blade, Twin
  Blades, Overrun) do not apply, because Hunt is not combat (confirmed by
  the owner, 2026-09-28). **The rule is evergreen** (owner, same day): it
  covers every damage-reading keyword the game ever adds, such as a future
  Corruption, Poison or Radiation, not a list of today's. So the engine
  spec must not hard-code the list: Hunt damage goes through the same
  source-creature damage path that combat uses, where a keyword that reads
  damage is applied once for every kind of creature damage that path
  serves, and a new keyword that hooks that path works for Hunt with no
  Hunt-specific code. **Engine note**: today Deathblade and Blood Oath apply
  only in combat (`combat/damage.ts`; the `damage` op sets neither).
  Whether other ability damage from a creature (an arrival "deals 2 damage")
  should join that path is a separate question for the spec; it would
  change shipped cards, so the recommendation is not in 1.9.
- **H5. Keeping Hunt from being unconditional removal.**
  - Source-bound hunters below SR print Attack 4 or less (our bodies run
    bigger than the era's, so era anchors underprice a big hunter).
  - Never Hunt and Deathblade on one card below SR (the multiplication trap,
    card-building-guide §3).
  - Bulwark and Hunt never meet on a hunter: closed by rule (H3a).
  - A Duty Hunt only at SR and above, at most two in the set, with mana in
    the Duty or on a body of mana value 5 or more (Karplusan Yeti's free tap
    fight sits on a five-mana rare).
  - Hunt spells at common: at most two green, one red.
  - Hunt and Provoked on one card multiply (the hunter survives to be
    provoked): compare those rows against shipped cards at the same mana
    value; the lab measures Hunt with an Attack slope.
  - **The self-Hunt is a source and is costed as one.** A Hunt card counts
    toward the source minimums already; the lab's paired measurement covers
    the self-Hunt shape explicitly (hunter and prey both yours, both
    Provoked, one card), and Hunt spells at common are costed on the better
    of their two uses, removal or self-provoke.

**For the spec, not the overplan (lane A):** Hard's Hunt picks the prey the
hunter kills and survives, then one it kills, and declines a Hunt that only
provokes the prey; **Easy never hunts its own creature; Medium and Hard may,
when it wins value** (a self-provoke that pays more than the damage costs),
Hard's read in A1 and Medium's and Easy's in A2; Provoked adds a survival bonus to attacks and blocks and
a reason to aim a friendly source at your own creature; the converter's
target walk needs the two-sided dead-target case.

### The provisional rates and the era filter

Both Magic keywords postdate the 8th-10th-edition anchor era (fight 2011,
enrage 2017), but both shapes are older; the overplan anchors on in-era
printings (checked in mtg-db):

- **Hunt**: Tracker (DRK 1994, rare, `{G}{G}, {T}`: fight), Karplusan Yeti
  (9ED 2005, rare, {3}{R}{R} 3/3, `{T}`: fight, no mana), Stalking Yeti (CSP
  2006, uncommon, {2}{R}{R} 3/3, arrives and fights a creature an opponent
  controls: the anchor for the arrival hunters), Tahngarth, Talruum Hero
  (2001, rare), Rivals' Duel (2008, a four-mana fight Ritual), Predatory Urge
  (2009, rare). Prey Upon, Savage Punch and Pounce inform shape and colour
  only.
- **Provoked**, bonus-shaped anchors only (the drawback cards that damage
  their own controller are excluded): Fungusaur (8ED 2003, rare, a counter
  when damaged), Fungus Sliver (TSP 2006, rare), Wall of Hope (LGN 2003,
  common, {W} defender 0/3, gain 1 life when damaged: white's block-shaped
  Provoked), Saber Ants, Broodhatch Nantuko, Dromad Purebred, Kami of the
  Honored Dead, Spitemare. Whether survival discounts an anchor depends on
  its shape: Fungusaur's counter is delayed, so a dying Fungusaur already
  gets nothing, while Saber Ants pays out as it dies. The blind spot the lab
  measures: how often a creature is damaged and survives.

## 10. Vocabulary discipline

**The rule**: write every row in the engine's existing vocabulary
(`src/engine/types.ts`) plus the Provoked trigger and the Hunt op. A clause
that needs anything else is marked **VOCAB** in its row, naming the
construct. A new construct reaches the engine spec only when **at least
three rows in the cut need it**, or the owner rules a single card worth it;
try the reword that keeps the card's job first. This **departs from the
Drowned Deep ruling DC2** ("expand scope": build the pickers and one-card
shapes rather than reword), because under D16 every construct lands on the
critical path between the cut and transcription.

**Expected** (overplan estimates; the concretion audit counts the real ones):

| Construct | Rows | For | Recommendation |
| --- | ---: | --- | --- |
| **Provoked** trigger | ~30 | the mechanic | ruled |
| **Hunt** op, both forms | ~22 | the mechanic | ruled |
| **Dinokin** Axis | ~40 carriers, 6 payoffs | the tribe | ruled; no new construct (an `axes.ts` entry; lords and payoffs use `filter.subtype`, `controlsOther`, `allyAttacks` and `allyDies`) |
| "Damage each creature you control N" | 2-3 | red's war-drum sources | admit if three survive |
| Size condition, "if you control a creature with Attack 4 or more" | 3-6 | the apex payoffs | admit if three survive; else reword to Hunt |
| Empower may Hunt (the validator's allowlist) | 1-3 | the optional arrival Hunt | validator-only; admit with the Hunt op |
| Keyword qualifier, "Hunt target creature with Skyborne" | 0-2 | a narrower, cheaper Hunt (the Plummet shape) | a restriction, not an enabler (any Hunt already reaches a flier); drop unless three cheap rows want it |

**Kept out**: a "whenever a creature you control is provoked" observer;
"deals that much damage"; Provoked granted by a static or aura; the
one-sided bite; an untap op. **Stretch, cut first**: payoffs needing a
threshold of provoked creatures, walls whose only value is being attacked,
and sources whose value depends on the AI aiming at its own creature before
A1's reads exist.

## 11. Art direction

For art-bible section 4d, in outline; the global rules hold.

**A daylight set.** Every frame is lit by a low sun on the horizon (warm key
from one side, the cool sky as rim), with steam, long shadows and clear air.
Palette: fern green, basalt grey as the value floor (tar is glossy dark
brown, never true black), sandstone, dawn peach, sky blue, lava orange,
glacier white-blue, bone ivory, amber resin.

**How the beasts appear**, under the rule that every card subject is a woman:
(1) **Dinokin** in the Beastkin monster-girl idiom, at most three stated
species tells each, the bulk at C and R; (2) **a
woman with her dinosaur**, the beast as mount or partner, riders from SR and
big-beast pairings from R, typed after the woman; (3) **the beast alone** on
tokens and spell art only.

**Large non-humanoid subjects**: the dinosaur's head is a head (inside the
band, never cropped); horns, frills, crests and headwear count toward the
head top; a sauropod reads huge by distance, never by shrinking the woman;
tails state count, root and tip; mount and rider never fuse; Hatchlings read
young, and no human child appears.

**The 216 px window (R13, ruled 2026-09-28).** A card shows image rows
17.3% to 82.7%: y 138 to 662 of the 640x800 deliverable. The story sits
inside that band, and the head-top rule moves to about y 179: every head
top, human or dinosaur, at or below it. The pilot composes for this band.

**Costume and banned motifs.** Coverage rule, checkable in a prompt: the fur
or hide two-piece is allowed as the genre costume, with chest and hips fully
covered, visible ties or straps, and at least one more layer (a wrap, a
cloak, leg wraps or a shoulder pelt), never string-minimal or slipping. **No
real-world regalia or sacred styles**: no feathered war bonnets or Plains
headdresses, no Arctic peoples' dress, no dot-painting or real cave-art
styles; every costume is invented from hide, fur, bone, shell and stone. No
gore, wounds or butchery; fossils only as clean stone-coloured bone; no
captive or dragged women; no franchise creature designs or film hybrids; no
real-person likeness. **NO-TEXT**: cave paintings show animals and hunts
only, never pictograph rows; no tally marks; no carved symbols.

**The pilot, ten hard cases** (wave 2, with the rung 27-28 portraits and the
two 1.8.5 regenerations): (1) a raptor rider at a sprint; (2) a shepherdess
beside a sauropod (scale); (3) a hunter facing a tyrant (two creatures, no
gore); (4) a horned Dinokin warrior (frill against headroom); (5) a raptor
Dinokin (tail root and tip); (6) a pterosaur rider airborne; (7) a Hatchling token
(a dinosaur alone, visibly young); (8) a fossil rising from the tar; (9) the
Painted Cave (cave art, no text, no tally); (10) a pack-caller with exactly
three raptors at her side (several beasts in one frame: count control and
no fused bodies, which the Pack Raptor minters need).

## 12. Rulings and questions

**Ruled 2026-09-28** (the owner approved the brief):

- B1: no dinosaur-only creature cards; dinosaurs appear as Dinokin, as a
  woman's mount or partner, or alone on tokens and spell art.
- B2 (reversed): dinosaurs are a tribe with lords, the Dinokin Axis (section
  2).
- B3: 165 cards (82 / 49 / 15 / 11 / 8).
- B4: Provoked at most once each turn per creature (P2).
- B5 (reversed): Hunt may target your own creatures; a creature cannot hunt
  itself (H1).
- B6 (broadened, evergreen): Hunt damage counts for every damage keyword and
  trigger, present and future (H4); combat-defined keywords do not apply
  (confirmed).
- B7: a hunter provoked by its own Hunt damage is intended.
- B8: the fossil line for reanimator, four to six cards.
- B9: new sweep personas R/G and R/W, B/G third if lane F's budget allows.
- B10: the vocabulary threshold, three rows in the cut or a ruling on one
  card.
- Bulwark prevents Hunt at any rarity (H3a); a Bulwark creature can never be
  the hunter, only the prey.
- No reserved Provoked art tell; Provoked cards are recognised by their rules
  text only.
- The art window is 216 px (R13); the art composes for the 216 band.

**Open questions**, each leading with the recommendation:

1. **Dinokin replaces the Dinosaur subtype everywhere: yes** (section 2).
   The alternative keeps a separate Dinosaur subtype for tokens and mounts,
   which the lords would then miss.
2. **Riders are not Dinokin: yes**, typed after the woman, so the lords skip
   the few SR+ rider cards. The alternative types them Dinokin too, which
   stretches the word past "a dinosaur body".
3. **Dinokin is not also Beastkin: yes.** Every shipped -kin type is
   co-tagged Beastkin, but forty new Beastkin bodies would push the base
   set's two Beastkin anthems (Beastkin Packmother and the enchantment) and
   the decks that run them far past what they were costed and measured at.

**FYI, no ruling needed now**: megafauna sit beside the dinosaurs (about
two in five of the beasts); the Starborne and Silver Veil theme decks want a
deck-list pass, a wave-4 item outside this set; every name here is a working
name until the cut.

The next deliverable is the overplan of about 210
candidates: every row scored and overlap-checked, VOCAB rows marked, Provoked
and Hunt rows carrying provisional rates flagged NEEDS MATH, with
protect-first and cut-priority columns.
