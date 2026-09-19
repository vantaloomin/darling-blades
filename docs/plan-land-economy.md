<!-- source-of-truth: src/meta/warchest.ts, src/meta/PackOpener.ts, src/data/cards/, src/engine/types.ts, docs/plan-1.8.md, docs/plan-tap-abilities.md · last-verified: 2026-09-18 · decision brief + conversion slate for lane D of 1.8 (the 27 utility taplands become Duty artifacts); slate approved 2026-09-17, transcribed 2026-09-18 -->

# Land economy: the 27 utility taplands become Duty artifacts

Lane D of [plan-1.8.md](plan-1.8.md), the one 1.8 item that had no spec.
**Ruled 2026-09-11 (D3): convert the 27 utility taplands into Duty artifacts
with a tap ability.** This brief records the measurement, the ruling against
the two alternatives, the per-card conversion slate for approval, and the
blast radius the transcription wave had to cover.

**Slate APPROVED 2026-09-17, with seven rows re-authored the same day.** The
owner's direction: no Duty on the first slate cost more than one mana to
activate, so a handful move to a tap cost of two or three with a heavier
effect. The seven are marked **(heavier)** in section 4, ruled in design
rule 9 and costed in section 5. The other twenty rows stand as first
written.

**BUILT 2026-09-18.** All 27 rows are transcribed in the five set files and
pinned by `tests/data/landEconomy.test.ts`: shape, printed cost, colour, the
generated rules line, the pools, design rule 4, one headless resolution test
per Duty shape, and proof that all three brains activate each of the seven
heavier rows. What the build found, and how the owner ruled the same day:

- **The converter moved ten avatars, and the owner accepted its output.**
  Nine avatars' Darlings lists swap two to nine fill cards for converted
  commons in their colours, and those are regenerated. The tenth is Artoria:
  her source list carried the old land twice, the converter retains a legal
  spell as a playset, and its new cut ran four Lowland Fort Banners over two
  Quest for the Grail and two catalog singletons. Measured at 200 seeds
  across the 14 player decks, that cut scored 60% against the standing
  list's 68%, lower in every column. So her standing list is kept and she is
  registered as hand-tuned in `tests/data/avatarReserveDecks.test.ts`, the
  same way Morgan, Hel and Bastet are.
- **Deepfield Array moves Marks between your own creatures only.** The engine
  restricts `moveMark` to two creatures the activator controls and the rules
  line is fixed to match, so the slate's "from target creature" could not
  ship without an engine change. Ruled: ship the own-side mover, which is what
  the three blue Starborne Mark-movers already are. Taking a Mark off an
  opposing creature every turn for one mana is a stronger card than this row
  was costed as, and belongs to a later set at a higher rarity if it is ever
  printed. The row in section 4 now carries the generated line.
- **Section 1 was stale on one point.** The code already retired the taplands
  from boosters, crafting, the collectible pool and set completion
  (`isUtilityTapland` in `PackOpener`, `Collection` and `collectionFilter`).
  Converting them re-admits all 27 everywhere, so four set-completion targets
  rise: Celtic Fae 81 to 84, Grail Oath 78 to 83, Nocturne Manor 78 to 83,
  Dark Tales 172 to 180. Ruled: accepted, with a line in the 1.8 release
  notes. The collectible pool goes 1,455 to 1,482 and the common pack pool 716
  to 743. The three guards stay in place, matching nothing, as the rule that
  no later set prints a utility tapland.
- **Two starter lists still name a converted card in their legacy 60-card
  column** (Questing Table carries Lowland Fort three times, Midnight
  Storybook carries Palace Steps twice). No player is affected: a claimed
  deck is built from the Warchest columns. The lists are the owner's measured
  decks and were left alone; the land-count test reads 21 and 22 for those
  two.
- **Cost order.** The generator prints `{T}, {2}:` where this slate and Magic
  convention read `{2}, {T}:`. Ruled: mana first, as a separate change to the
  text renderer, because it touches every Duty card in the game.
- **Still owed:** the local card database rebuild and the Assay rows, an
  eyes-on pass for the 27 landscape arts in artifact frames, and the seeded
  matrix watch on Festival Rocket and Crossing Beacon once players can draft
  them.

## 1. The problem, measured

After Warchest, a collectible land is playable only if it is a basic or a
dual (`isAllowedReserveLand`, owner ruling 2026-08-25, recorded in
[plan-1.8.md](plan-1.8.md) lane D). The pool
holds **27 utility taplands** (`isUtilityTapland` over `CARD_DB`,
2026-09-07): common, single-colour, arrives tapped, most with a one-shot
arrival effect. They open from packs, count toward collection, shard, and
cannot be put in any deck.

| Set | Count | Arrival effects |
| --- | --- | --- |
| Celtic Fae | 3 | Foresee 1 x2, gain 1 life |
| Grail Oath (arthurian-court) | 5 | Foresee 1 x2, gain 1 life x2, self-mill 1 |
| Nocturne Manor (gothic-monsters) | 5 | Foresee 1, gain 1 life x2, self-mill 1, sever opponent's grave 1 |
| Dark Tales | 8 | Foresee 1 x2, gain 1 life x3, self-mill 1 x2, sever opponent's grave 1 |
| Starborne | 6 | none (plain taplands, printed after the reserve ruling) |
| Sands of the Duat | 0 | the first set authored under the rule |

`packPool` already excludes them from draft packs; booster drops, the
binder, collection percentage and the Assay still carry them.

## 2. The three options and the ruling

- **(a) Retire them** from packs and drops, keep owned copies shard-only.
  Cheapest; leaves 27 dead cards in every existing collection and a hole in
  five sets' common rows (the per-set rarity histograms are locked).
- **(b) Convert each into the non-land shape its effect implies**: a
  tap-cost artifact, now that the tap-ability engine exists (#355). The
  arrival effect becomes the Duty, the mana colour becomes the pip, the card
  keeps its id, its set, its rarity and its art. Every existing copy in every
  save becomes a playable card without a migration.
- **(c) Leave them collectible**, binder-marked as reserve-ineligible.
  Honest but still dead.

**RULED: (b).** Fable authors the slate below (name, cost, Duty per card);
the owner approves; Codex transcribes the data, the tests and the docs in one
batch; drop tables, collection percentage and the Assay follow the pool
change. Duat printed none, and no set after this one prints a utility
tapland: the reserve rule is an engine-level rule
([plan-1.8.md](plan-1.8.md) lane D).

## 3. Design rules for the slate

1. **Id, set, rarity and art stay.** The card keeps its id (saves, art keys
   and drop weights need nothing), its set membership and its common slot.
   Type becomes `artifact`; `manaAbility` and `entersTapped` go
   (a Duty carrier can never also be a mana source, D2e).
2. **The mana colour becomes the pip.** Coloured artifacts are established
   (37 of the 82 collectible artifacts carry pips), so a `{U}` tapland
   becomes a `{U}` artifact and each set's colour balance is unchanged.
   Interstellar Crossing stays colourless.
3. **The arrival effect becomes the Duty**, made repeatable: Foresee 1
   becomes `{T}: Foresee 1`, and so on. The six Starborne blanks get a Duty
   from their colour's Starborne role (green marks, blue moves marks, black
   removes marks, red and white support).
4. **One rules text per set.** Two cards in one set never share a Duty
   line (the one-printing-per-set copy cap), so a set's second Foresee
   tapland becomes `{1},{T}: Foresee 2`, its second life tapland
   `{1},{T}: You gain 2 life`, and so on. Across sets a line may repeat.
5. **Costed by the formula's Duty rate** (power-formula section 4q, the
   plan-tap-abilities section 5 comparative: a tap ability prices like a Dawn
   trigger the player chooses to fire, 3.0x on a non-creature, minus 0.4 per
   activation mana). Every row below carries its measured delta; all 27 sit
   inside the fair band, most within half a mana of zero. Two shapes carry
   the section's `NEEDS MATH` flags (the Mark tapper and `{T}: Foresee` on
   a non-creature) and are marked.
6. **Names become objects.** A road cannot be an artifact; each card is
   renamed to a thing found at the place, so the existing landscape art
   still reads (the object is in the scene, or the scene is what the object
   shows). Flavor text is kept where it still lands and refreshed where the
   object changes it. No em-dashes.
7. **Cheap repeatable draw is out.** `{1},{T}: draw` on an artifact has no
   precedent in any era and the formula reads it three mana hot at common.
   Revised 2026-09-17: the colourless card draws at `{3},{T}` on a `{4}`
   body, the shape Drowned Deep already ships as Net of Glass, which the
   formula reads at +0.99. It is the hottest row on the slate and the one
   the seeded matrix watches first; the fallback is `{2},{T}: Foresee 3` at
   `{2}`.
8. **The pinger stays slow.** `{T}: 1 damage to your opponent` is a
   real clock against a pool with five artifact answers (section 4i), so it
   prints at two mana, never one, and only one per set.
9. **Seven rows carry a heavier Duty** (owner direction 2026-09-17). Rule 3
   made every arrival effect a small repeatable rider, which left all 27
   activating for one mana or none. Seven rows instead pay two or three to
   activate for an effect a deck is built around: board control in white, a
   pump in white, creature removal in red, a drain in black, creature
   recursion in green, a deeper Foresee in blue and the colourless draw.
   The printed cost rises with the effect, so these seven are two- to
   four-mana commons, not one-drops. Three mirror shapes Drowned Deep
   already ships on its own Duty artifacts (The Bell That Will Not Ring,
   The Drowned Forge, Net of Glass); a line may repeat across sets, never
   within one (rule 4).

## 4. The slate (27 rows, for approval)

Delta = formula power minus budget at the printed cost (fair band is plus
or minus 1.5; negative reads cold, which is where a common utility rock
belongs). "Text" is the generated rules line; Duty renders the tap pip, not
the word.

### Celtic Fae (3)

| Id | Was | Becomes | Cost | Duty (rules line) | Delta | Flavor |
| --- | --- | --- | --- | --- | --- | --- |
| `cf-mist-road` | Mist Road | **Mist-Road Waymark** | {U} | {T}: Foresee 1. | +0.10 | It points the way you need and forgets it once you have gone. |
| `cf-mossy-ring` | Mossy Ring | **Ring-Stone Moss** | {G} | {T}: You gain 1 life. | -0.42 | The moss grows in a circle because the circle asked nicely. (kept) |
| `cf-raven-stone` | Raven Stone | **Raven Stone** (kept) | {B} | {T}: Foresee 1, then put the top card of your deck into your graveyard. | +0.71 | Leave an offering. The raven will tell you whether it was enough. (kept) |

Raven Stone is the set's Whispers enabler: look, keep or bottom, then mill
one. Its op list is `foresee` then `grind`, a target-free tail after a
Foresee, which the validator allows and the engine resumes under the
activator's context; it is the first shipping card to exercise that path,
so the transcription test suite pins it.

### Grail Oath (5)

| Id | Was | Becomes | Cost | Duty (rules line) | Delta | Flavor |
| --- | --- | --- | --- | --- | --- | --- |
| `ac-bramble-chapel` | Bramble Chapel | **Bramble Reliquary** | {G} | {T}: You gain 1 life. | -0.42 | Thorns frame the altar; the roots keep the old vows. (kept) |
| `ac-lowland-fort` | Lowland Fort | **Lowland Fort Banner** (heavier) | {2}{W} | {2},{T}: Tap target creature an opponent controls. | -0.54 | The fort is low, the walls are tired, and the banner still flies. |
| `ac-red-tournament-ground` | Red Tournament Ground | **Tournament Pennant** | {R} | {T}: Foresee 1. | +0.26 | Dust rises where champions promise they are not afraid. (kept) |
| `ac-court-of-whispers` | Court of Whispers | **Listeners' Curtain** | {B} | {T}: Put the top card of your deck into your graveyard. | -0.65 | The court has no throne, only a hundred listeners behind the curtains. (kept) |
| `ac-mirror-lake` | Mirror Lake | **Mirror-Lake Glass** (heavier) | {U} | {2},{T}: Foresee 3. | +0.20 | The glass shows the face you bring and the one you leave behind. |

Court of Whispers is renamed because "Whispers" is now a taught mechanic;
the card must not read as a Whispers card.

### Nocturne Manor (5)

| Id | Was | Becomes | Cost | Duty (rules line) | Delta | Flavor |
| --- | --- | --- | --- | --- | --- | --- |
| `gm-moor-path` | Moor Path | **Moorlight Lantern** (heavier) | {2}{B} | {3},{T}: Your opponent loses 2 life and you gain 2 life. | +0.42 | The light is warm, the path is damp, and something walks behind it. |
| `gm-chapel-yard` | Chapel Yard | **Chapel-Yard Rosary** | {W} | {T}: Sever the top card of your opponent's graveyard. | +0.40 | The graves are tidy and the roses have opinions. (kept) |
| `gm-lab-annex` | Lab Annex | **Annex Notebook** | {U} | {T}: Foresee 1. | +0.10 | The main lab exploded, so this is the responsible record. |
| `gm-red-roof-village` | Red-Roof Village | **Festival Rocket** (heavier) | {2}{R} | {2},{T}: Deal 2 damage to target creature. | +0.06 | The roofs are red from paint, weather, and one regrettable festival. (kept) |
| `gm-thorned-cemetery` | Thorned Cemetery | **Cemetery Thorn** | {G} | {T}: Put the top card of your deck into your graveyard. | -0.65 | The vines keep visitors from leaving with the wrong memories. (kept) |

### Dark Tales (8)

| Id | Was | Becomes | Cost | Duty (rules line) | Delta | Flavor |
| --- | --- | --- | --- | --- | --- | --- |
| `dt-wolf-path` | Wolf Path | **Wolf-Path Charm** | {G} | {T}: You gain 1 life. | -0.42 | The safest road is the one the wolf has not noticed. (kept) |
| `dt-palace-steps` | Palace Steps | **Glass Slipper** | {W} | {1},{T}: You gain 2 life. | -0.30 | Every guest climbs the steps. Not every guest reaches the ballroom. |
| `dt-hearth-cinders` | Hearth Cinders | **Banked Cinders** | {1}{R} | {T}: Deal 1 damage to your opponent. | -0.57 | The fire is out, but the coals are still warm enough to bite. |
| `dt-midnight-road` | Midnight Road | **Midnight Invitation** | {B} | {T}: Put the top card of your deck into your graveyard. | -0.65 | The road is empty because the invitation was accepted elsewhere. (kept) |
| `dt-riverbend-trail` | Riverbend Trail | **Riverbend Waterwheel** (heavier) | {2}{G} | {3},{T}: Return target creature card from your graveyard to your hand. | -0.94 | The wheel turns the river and every sensible conclusion. |
| `dt-sea-cave` | Sea Cave | **Sea-Cave Pearl** | {U} | {T}: Foresee 1. | +0.10 | Foam hides the entrance and the price of leaving. (kept) |
| `dt-desert-rooftop` | Desert Rooftop | **Rooftop Spyglass** | {R} | {1},{T}: Foresee 2. | +0.37 | The city roof catches moonlight and runaway wishes. (kept) |
| `dt-winter-bridge` | Winter Bridge | **Winter-Bridge Toll** | {U} | {T}: Sever the top card of your opponent's graveyard. | +0.40 | The bridge is clear until the palace decides otherwise. (kept) |

Dark Tales keeps its graveyard-facing Duties (Midnight Invitation's
self-mill and Winter-Bridge Toll's sever) in the set whose discard engine
1.8's headline mechanic is built to pay off, and since 2026-09-17 the
Waterwheel turns from a second self-mill into the payoff beside them: a
creature back to hand each turn for three mana. It is deliberately printed
one mana colder than the formula asks (`{1}{G}` reads -0.12), because a
repeatable return is an inevitability engine in a long game and the
formula's recursion rate is a one-shot rate.

### Starborne (6)

| Id | Was | Becomes | Cost | Duty (rules line) | Delta | Flavor |
| --- | --- | --- | --- | --- | --- | --- |
| `sb-pale-nebula` | Pale Nebula | **Nebula Beacon** (heavier) | {2}{W} | {2},{T}: Target creature you control gets +2/+2 until Sunset. | -0.24 | The cloud looks soft until you try to navigate it. (kept) |
| `sb-deepfield-lands` | Deepfield Lands | **Deepfield Array** | {U} | {1},{T}: Move a Mark from a creature you control to another creature you control. | +0.00 | The deep field is quiet because everything there is listening. (kept) |
| `sb-darkside-landing` | Darkside Landing | **Violet Landing Light** | {1}{B} | {T}: Remove the Marks from target Marked creature. | -0.12 | The landing lights are violet because red would look too hopeful. (kept) |
| `sb-ember-lane` | Ember Lane | **Ember-Lane Flare** | {R} | {1},{T}: Deal 1 damage to your opponent. | -0.15 | The lane is hot, crowded, and officially one-way. (kept) |
| `sb-overcanopy` | Overcanopy | **Overcanopy Trellis** | {1}{G} | {1},{T}: Put a Mark on target creature you control. | -0.22 (NEEDS MATH: the `{T}: counter` band) | A green aurora hangs low enough to touch from the watch deck. (kept) |
| `sb-interstellar-crossing` | Interstellar Crossing | **Crossing Beacon** (heavier) | {4} | {3},{T}: Draw a card. | +0.99 (hottest row, see rule 7) | The crossing takes three days if you walk and one blink if you trust it. (kept) |

Starborne's six follow the set's colour rules
([plan-road-to-2.0.md](plan-road-to-2.0.md): green primary, red and white support,
blue copies and moves marks, black anti-mark). Overcanopy Trellis is the
set's first repeatable Mark source that is not a creature; it is priced
inside the fair band but the corpus has no era-clean `{T}: +1/+1 counter`
rate, so it ships flagged and the seeded matrix decides.

## 5. Costing notes (the section 9 rule)

All 27 rows were scored on the local workbench with the section 4q rate on
2026-09-10 (`balance/scoreCore.ts`, probe in the session scratchpad). The
shape ladder, for the record, at one printed mana with an on-pie pip:

| Duty | Delta at 1 mana | at 2 mana |
| --- | --- | --- |
| `{T}: Foresee 1` | +0.10 to +0.44 by colour | -0.72 to -0.38 |
| `{1},{T}: Foresee 2` | +0.15 to +0.62 | -0.67 to -0.20 |
| `{T}: gain 1 life` | -0.50 to -0.33 | -1.32 to -1.15 |
| `{1},{T}: gain 2 life` | -0.30 to +0.04 | -1.12 to -0.78 |
| `{T}: self-mill 1` | -0.65 | -1.47 |
| `{T}: sever opponent's grave 1` | +0.40 | -0.42 |
| `{T}: 1 damage to opponent` | +0.25 (red) to +0.63 | -0.57 to -0.19 |
| `{T}: opponent loses 1` | +0.83 | +0.01 |
| `{1},{T}: draw a card` | +3.45 (rejected) | +2.63 (rejected) |

Off-pie premiums are small at this size (blue Foresee is the cheapest,
green the dearest by 0.34) and never move a row out of the band, so the
slate keeps every card's original colour rather than chasing the premium.

**The seven heavier rows (2026-09-17).** Each candidate was scored at five
printed costs on the same workbench (`balance/scoreCore.ts`, probe in the
session scratchpad); the chosen cost is the one at or just under fair,
since a common utility artifact belongs slightly cold. Columns are the
printed cost: the pip alone, then one to four generic beside it (the
colourless card has no pip, so its columns are one to four generic).

| Card | Duty | pip | +1 | +2 | +3 | +4 | Chosen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mirror-Lake Glass | `{2},{T}: Foresee 3` | +0.20 | -0.62 | -1.44 | -2.26 | -3.08 | {U} |
| Lowland Fort Banner | `{2},{T}: tap target opposing creature` | +1.10 | +0.28 | -0.54 | -1.36 | -2.18 | {2}{W}, the Bell's cost |
| Festival Rocket | `{2},{T}: 2 damage to target creature` | +1.70 | +0.88 | +0.06 | -0.76 | -1.58 | {2}{R} |
| Moorlight Lantern | `{3},{T}: opponent loses 2, you gain 2` | +2.06 | +1.24 | +0.42 | -0.40 | -1.22 | {2}{B} |
| Riverbend Waterwheel | `{3},{T}: return a creature card to hand` | +0.70 | -0.12 | -0.94 | -1.76 | -2.58 | {2}{G}, one colder on purpose |
| Nebula Beacon | `{2},{T}: +2/+2 until Sunset` | +1.40 | +0.58 | -0.24 | -1.06 | -1.88 | {2}{W} |
| Crossing Beacon | `{3},{T}: draw a card` | n/a | +3.45 | +2.63 | +1.81 | +0.99 | {4}, Net of Glass's cost |

Alternates scored and not taken: `{3},{T}: Foresee 1, then draw` on the
Glass (+0.57 even at four generic), `{3},{T}: gain 4 life` on the Banner
(+0.10 at the pip, no more interesting than the row it replaced),
`{3},{T}: 2 damage to your opponent` on the Rocket (-0.05 at the pip, the
fallback if repeatable creature removal at common plays too hard),
`{2},{T}: opponent loses 2` on the Lantern (+0.28 at one generic),
`{2},{T}: mill three` on the Waterwheel (-0.55 at the pip), and
`{3},{T}: 2 damage to any target` on Ember-Lane Flare (-0.04 at two
generic; not taken, so Starborne keeps a cheap red pinger).

Caveat, stated plainly: section 4q discounts a Duty 0.4 per activation
mana, capped at 1.5, and that rate already carries a `NEEDS MATH` flag. A
three-mana activation eats most of an early turn, which a 1.2 discount
understates, so the formula reads these seven hotter than they will play
and the printed costs above err cold. That is the safe side for commons;
the seeded matrix after transcription is the check, and Festival Rocket
(repeatable creature removal at common) and Crossing Beacon (repeatable
draw) are the two rows it looks at first.

## 6. Blast radius for the transcription wave (grep, do not remember)

- **Card data**: five set files (`src/data/cards/`), 27 rows: type,
  colours, cost, `activated`, name, flavor; drop `manaAbility` and
  `entersTapped`. Ids unchanged.
- **Tests that pin the old shape**: `tests/meta/warchest.test.ts` (the
  utility-tapland enumeration becomes empty; keep the test as the guard that
  no set prints one), `tests/ui/rulesText.test.ts` (four tapland text pins
  become Duty pins), the per-set land-count tests
  (`tests/data/celtic-fae.test.ts` 6 lands to 3, `arthurian-court.test.ts`
  7 to 2, plus whichever Gothic, Dark Tales and Starborne assertions the
  grep finds), `tests/data/starborne.test.ts` (Interstellar Crossing),
  `tests/data/catalog.test.ts` mana-value bounds (all 27 now have a cost).
- **Converter output**: 27 one- to four-mana artifacts become legal
  singletons in their colours, so `scripts/avatarReserveDecks.ts` may pull
  them into avatar reserve decks. **Any change to committed converter output
  stops the wave for an owner decision** (the Starborne rule): the
  transcription report must diff the converter's `--print` output before
  and after and list every avatar it would change.
- **AI**: `activatedPolicy` (#359) already plays free non-creature Duties in
  Morning and paid ones in Afternoon; no new policy. The mark-aware brains
  see Overcanopy Trellis and Deepfield Array through the existing
  `addCounters` / `moveMark` valuation. The seven heavier rows add targeted
  Duties on artifacts outside Drowned Deep. Tap, creature damage and draw
  already ship there (the Bell, the Forge, Net of Glass); the pump, the
  drain and the graveyard return are new on a non-creature carrier. The
  validator already admits `yourGraveCreature` as an activated target
  (`validateActivatedDef`), so none needs an engine change, but the
  transcription proves all three brains activate each of the seven with a
  sensible target and hold the mana for a two- or three-mana Duty the way
  phase B's mana holding does.
- **Packs and drops**: `packPool` stops excluding them (they are no longer
  lands), so five sets gain commons in draft packs; the booster common row
  is unchanged in size. Collection percentage: unchanged count. Assay: 27
  new rows at the section 4q rate. blades-db: rebuild.
- **Docs**: `docs/land-art.md` (the seven Gothic land entries: five become
  artifact art notes, the land program shrinks to 15 cards),
  `docs/expansions/*.md` card tables for the five sets, `docs/rules.md` and
  `docs/adding-cards.md` need nothing (Duty is documented in tap PR 3), the
  Assay page and `README` figures if they quote land counts.
- **Art**: existing landscape art stays keyed by id; the artifact frame
  shows it as a scene. Eyes-on item for the 1.8 art run: any of the 27
  whose art reads wrong as an object gets a regen, decided per card, not
  as a batch.
- **Saves**: none. Ids and ownership are unchanged; a save that owns four
  Mist Roads owns four Mist-Road Waymarks.

## 7. What this is not

Not a land redesign: basics and duals are untouched, the reserve rule is
untouched, and the 1.6 dual cap stays. Not a Drowned Deep matter: the set
prints no utility taplands and its own Duty artifacts are in the overplan.
Not a licence to print more: any future one-shot land effect is a Duty
artifact from the start.
