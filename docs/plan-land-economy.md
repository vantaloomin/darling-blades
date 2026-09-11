<!-- source-of-truth: src/meta/warchest.ts, src/meta/PackOpener.ts, src/data/cards/, src/engine/types.ts, docs/plan-1.8.md, docs/plan-tap-abilities.md · last-verified: 2026-09-10 · decision brief + conversion slate for lane D of 1.8 (the 27 utility taplands become Duty artifacts); owner approves the slate, Codex transcribes -->

# Land economy: the 27 utility taplands become Duty artifacts

Lane D of [plan-1.8.md](plan-1.8.md), the one 1.8 item that had no spec.
**Ruled 2026-09-11 (D3): convert the 27 utility taplands into Duty artifacts
with a tap ability.** This brief records the measurement, the ruling against
the two alternatives, the per-card conversion slate for approval, and the
blast radius the transcription wave has to cover. Nothing here is built.

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
7. **Repeatable draw is out.** `{1},{T}: draw` on an artifact has no
   precedent in any era and the formula reads it three mana hot at common;
   the colourless card gets Foresee 2 instead.
8. **The pinger stays slow.** `{T}: 1 damage to your opponent` is a
   real clock against a pool with five artifact answers (section 4i), so it
   prints at two mana, never one, and only one per set.

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
| `ac-lowland-fort` | Lowland Fort | **Lowland Fort Banner** | {W} | {1},{T}: You gain 2 life. | -0.30 | The fort is low, the walls are tired, and the banner still flies. |
| `ac-red-tournament-ground` | Red Tournament Ground | **Tournament Pennant** | {R} | {T}: Foresee 1. | +0.26 | Dust rises where champions promise they are not afraid. (kept) |
| `ac-court-of-whispers` | Court of Whispers | **Listeners' Curtain** | {B} | {T}: Put the top card of your deck into your graveyard. | -0.65 | The court has no throne, only a hundred listeners behind the curtains. (kept) |
| `ac-mirror-lake` | Mirror Lake | **Mirror-Lake Glass** | {U} | {1},{T}: Foresee 2. | +0.15 | The glass shows the face you bring and the one you leave behind. |

Court of Whispers is renamed because "Whispers" is now a taught mechanic;
the card must not read as a Whispers card.

### Nocturne Manor (5)

| Id | Was | Becomes | Cost | Duty (rules line) | Delta | Flavor |
| --- | --- | --- | --- | --- | --- | --- |
| `gm-moor-path` | Moor Path | **Moorlight Lantern** | {1}{B} | {T}: Your opponent loses 1 life. | -0.42 | The light is warm, the path is damp, and something walks behind it. |
| `gm-chapel-yard` | Chapel Yard | **Chapel-Yard Rosary** | {W} | {T}: Sever the top card of your opponent's graveyard. | +0.40 | The graves are tidy and the roses have opinions. (kept) |
| `gm-lab-annex` | Lab Annex | **Annex Notebook** | {U} | {T}: Foresee 1. | +0.10 | The main lab exploded, so this is the responsible record. |
| `gm-red-roof-village` | Red-Roof Village | **Festival Rocket** | {1}{R} | {T}: Deal 1 damage to your opponent. | -0.57 | The roofs are red from paint, weather, and one regrettable festival. (kept) |
| `gm-thorned-cemetery` | Thorned Cemetery | **Cemetery Thorn** | {G} | {T}: Put the top card of your deck into your graveyard. | -0.65 | The vines keep visitors from leaving with the wrong memories. (kept) |

### Dark Tales (8)

| Id | Was | Becomes | Cost | Duty (rules line) | Delta | Flavor |
| --- | --- | --- | --- | --- | --- | --- |
| `dt-wolf-path` | Wolf Path | **Wolf-Path Charm** | {G} | {T}: You gain 1 life. | -0.42 | The safest road is the one the wolf has not noticed. (kept) |
| `dt-palace-steps` | Palace Steps | **Glass Slipper** | {W} | {1},{T}: You gain 2 life. | -0.30 | Every guest climbs the steps. Not every guest reaches the ballroom. |
| `dt-hearth-cinders` | Hearth Cinders | **Banked Cinders** | {1}{R} | {T}: Deal 1 damage to your opponent. | -0.57 | The fire is out, but the coals are still warm enough to bite. |
| `dt-midnight-road` | Midnight Road | **Midnight Invitation** | {B} | {T}: Put the top card of your deck into your graveyard. | -0.65 | The road is empty because the invitation was accepted elsewhere. (kept) |
| `dt-riverbend-trail` | Riverbend Trail | **Riverbend Waterwheel** | {G} | {1},{T}: Put the top two cards of your deck into your graveyard. | -0.60 | The wheel turns the river and every sensible conclusion. |
| `dt-sea-cave` | Sea Cave | **Sea-Cave Pearl** | {U} | {T}: Foresee 1. | +0.10 | Foam hides the entrance and the price of leaving. (kept) |
| `dt-desert-rooftop` | Desert Rooftop | **Rooftop Spyglass** | {R} | {1},{T}: Foresee 2. | +0.37 | The city roof catches moonlight and runaway wishes. (kept) |
| `dt-winter-bridge` | Winter Bridge | **Winter-Bridge Toll** | {U} | {T}: Sever the top card of your opponent's graveyard. | +0.40 | The bridge is clear until the palace decides otherwise. (kept) |

Dark Tales gains five Whispers-relevant enablers (two self-mill Duties and
three that touch the graveyard) in the set whose discard engine 1.8's
headline mechanic is built to pay off.

### Starborne (6)

| Id | Was | Becomes | Cost | Duty (rules line) | Delta | Flavor |
| --- | --- | --- | --- | --- | --- | --- |
| `sb-pale-nebula` | Pale Nebula | **Nebula Beacon** | {1}{W} | {T}: Target creature you control gets +1/+1 until Sunset. | +0.18 | The cloud looks soft until you try to navigate it. (kept) |
| `sb-deepfield-lands` | Deepfield Lands | **Deepfield Array** | {U} | {1},{T}: Move a Mark from target creature to target creature you control. | +0.00 | The deep field is quiet because everything there is listening. (kept) |
| `sb-darkside-landing` | Darkside Landing | **Violet Landing Light** | {1}{B} | {T}: Remove the Marks from target Marked creature. | -0.12 | The landing lights are violet because red would look too hopeful. (kept) |
| `sb-ember-lane` | Ember Lane | **Ember-Lane Flare** | {R} | {1},{T}: Deal 1 damage to your opponent. | -0.15 | The lane is hot, crowded, and officially one-way. (kept) |
| `sb-overcanopy` | Overcanopy | **Overcanopy Trellis** | {1}{G} | {1},{T}: Put a Mark on target creature you control. | -0.22 (NEEDS MATH: the `{T}: counter` band) | A green aurora hangs low enough to touch from the watch deck. (kept) |
| `sb-interstellar-crossing` | Interstellar Crossing | **Crossing Beacon** | {2} | {1},{T}: Foresee 2. | -0.05 (NEEDS MATH: non-creature `{T}: scry`) | The crossing takes three days if you walk and one blink if you trust it. (kept) |

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
- **Converter output**: 27 one- and two-mana artifacts become legal
  singletons in their colours, so `scripts/avatarReserveDecks.ts` may pull
  them into avatar reserve decks. **Any change to committed converter output
  stops the wave for an owner decision** (the Starborne rule): the
  transcription report must diff the converter's `--print` output before
  and after and list every avatar it would change.
- **AI**: `activatedPolicy` (#359) already plays free non-creature Duties in
  Morning and paid ones in Afternoon; no new policy. The mark-aware brains
  see Overcanopy Trellis and Deepfield Array through the existing
  `addCounters` / `moveMark` valuation.
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
