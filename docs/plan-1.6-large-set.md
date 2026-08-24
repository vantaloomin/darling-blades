<!-- source-of-truth: docs/plan-expansion-slate.md, docs/plan-1.6-draft.md, docs/plan-tribal-pass.md, src/data/cards/*.ts, src/engine/types.ts · last-verified: 2026-08-17 · design/plan doc — DRAFT, nothing here is implemented -->

# Sands of the Duat — the 1.6 large set (concretion draft)

**Status 2026-08-17: NAMES RATIFIED, gate open.** Theme locked by the
owner 2026-08-17 from the two slate favorites (Cosmic Horror stays a
future small-set candidate; its Whispers headline is the AI-risky value
family and its strongest identity piece, the Sanity track, is tabled).
Ratified the same session: set name **Sands of the Duat**; mechanic names
**Rite** / **Nine Lives** / **Preserve**; the **Dark Tales companion wave
rides this train**. Remaining gate items are build work, not decisions.

## Frame (inherited commitments)

- **First large set: ~240-250 cards**, the large/small rhythm's opening
  move (owner direction 2026-07-31). Roughly 2x a shipped set (Yokai
  Nights is 120); mirror the shipped per-set rarity/color distribution at
  2x rather than inventing a new curve — verify the exact distribution
  from `src/data/cards/*.ts` at build time.
- **Reserve-native from concretion.** Every archetype list is designed as
  40 spells + a 10-land Warchest; the set ships its own **draftable dual
  cycle** (5 duals, the #213 class: arrive tapped, die for good) and its
  ramp lives on the `extraLandDrop` op, never on land-fetch.
- **Carries the returning-mechanics quota** (2-3 returning named
  mechanics at low rarity, owner policy 2026-07-31).
- **House rules**: original mechanic names only (never real MTG/Yugioh
  keyword names); engine-first (ops merged and tested before any card
  data); AI-pilotable (prefer greedy heuristics; the Midnight Storybook
  6.7% measurement is the cautionary tale).

## Identity

The Duat: judgment, tribute, and return. Three pillars:

1. **The price of power** — god-tier bodies demand offerings (sacrifice
   as additional cost).
2. **Death is a door** — the graveyard is a place cards come back FROM
   (token rebirth, recursion, nine lives).
3. **The Bastet** — a catgirl warrior tribe, the set's aggressive spine
   and its face for the gacha cast.

Visual register: gold, lapis, sandstone, and sun-barge fire — deliberate
contrast after three consecutive night sets (Gothic, Dark Tales, Yokai).

## New mechanics (three, engine-first order — names RATIFIED 2026-08-17)

MTG/YGO collisions were excluded before naming ("Tribute" is a real
Theros keyword, "Embalm"/"Eternalize" are real Amonkhet keywords,
"Ascend" is a real Rivals keyword). Record all three in keyword-map.md
(Rite ≈ tribute-summon family, Nine Lives ≈ undying, Preserve ≈ embalm).

1. **Rite N** (slate: tribute summoning) — "As an additional cost to cast
   this, sacrifice N creatures." Engine: cheap (additional-cost plumbing
   shipped with Retell; sacrifice op exists). AI: affordability check plus
   a floor on what it will feed (never sacrifice its best body). UI: the
   existing multi-pick overlay family covers the sacrifice picker.
2. **Nine Lives** (slate: undying reskin) — "When this dies without a
   life mark, return it to the battlefield with a life mark." One return,
   mark-gated. Engine: cheap (dies-triggers + marks exist). AI: free
   value, zero planning.
3. **Preserve {cost}** (slate: embalm reskin, un-tabled at large-set
   scale) — "Sever this from your graveyard and pay {cost}: create a
   token copy of it." Sorcery-speed, main phase. Engine: cheap (Retell's
   grave-cost infra + createToken). AI: moderate — reuse the post-Retell
   grave-awareness muscle; policy is "preserve the biggest affordable
   body when the board wants one". Owner picked the portable name over
   Mummify: the mechanic survives if it ever returns outside Egypt.

Engine build order: Rite → Nine Lives → Preserve, each landing with tests
and an AI heuristic before any card names it.

## Returning-mechanics quota (from the 2026-07-31 audit)

- **Retell** (Dark Tales, zero reuse) — cast from the graveyard IS the
  underworld; 6-8 cards at common/rare. Bridges the Dark Tales pool.
- **Empower** (Gothic, zero reuse) — pay-more scaling on god bodies; 5-6
  cards. Pairs with the extraLandDrop ramp class as its payoff.
- **twinBlades** (Ragnarök, zero reuse) — keyword sprinkle on Bastet
  dual-wielders; 4-5 cards at common.

Deliberately NOT returning here: Quests and Champion Awakening (both want
the Arthurian voice; save them for a set that can hold it).

## Tribal + archetype skeleton (measured later, like every set)

- **Bastet** enters as a new tribal Axis under the tribal-pass governance
  rule (a static's `filter.subtype` may only name an Axis). Aggro spine,
  twinBlades carriers, a lord or two per the tribal-pass patterns.
- Archetype targets for the 28-deck layer and the balance pass:
  - Rite sacrifice engine (token fodder in, god bodies out).
  - Nine Lives attrition aggro (Bastet-adjacent; blocks are bad news).
  - Mummify grave value (plays the long game with Retell reuse).
  - Empower ramp (extraLandDrop into scaled finishers).
  - Bastet tribal proper.
- Cross-pool hooks: Ragnarök's graveyard faction and Dark Tales
  Skim/Retell both feed and are fed by the underworld pillar — priced at
  the balance pass, not assumed.

## Structure targets

- ~240-250 collectible cards; 5-color spread mirroring shipped sets at
  2x; one 5-dual draftable cycle; set-scoped booster + pack art like
  Yokai Nights; drop odds unchanged (the Atelier plate reads them live).
- Art: ~250 finished pieces through the art pipeline — the true long
  pole; batch planning belongs to the art-bible session, not this doc.

## Concretion gate (must ALL be true before card data)

Companion documents (2026-08-17, both owner-session reviewed):
[plan-duat-cards-mechanical.md](plan-duat-cards-mechanical.md) owns the
frame, the precedent costing bands, and 45 mechanical exemplar slots;
[plan-duat-creative.md](plan-duat-creative.md) owns voice, cast, the
137-name bank, and art direction (mythic-weight register ruled
2026-08-17; ALL SIX taste questions RULED 2026-08-18: heart-red kept, lapis badge vetoed, daylight ~1/3, Anuket added as the 13th legend/mono-U face, geography stays mythic, Kesi lineage is a rumor).

1. ~~The three new ops merged engine-first with tests + AI heuristics.~~
   **DONE 2026-08-17: Rite (#223), Nine Lives (#224), Preserve (#225), each
   with tests + an AI heuristic, suite 1,553 green.** (The design note held:
   no observer-dies trigger was added — Rite payoffs live on the fodder's own
   dies-triggers; adding an observer trigger remains a separate decision only
   if the archetype measures weak. Owed to the card-data wave: the Rite
   sacrifice-picker and Preserve graveyard-chip UI.)
2. ~~Mechanic names locked~~ RATIFIED: Rite / Nine Lives / Preserve.
3. ~~Set name locked~~ RATIFIED: Sands of the Duat (prefix sd-).
4. ~~Bastet Axis added under tribal governance.~~ **DONE 2026-08-17: `AXES`
   export in `src/data/axes.ts` (19 incl. Bastet) with a catalog test
   enforcing the governance rule for the first time (its first run caught
   Mermaid as an unlisted de-facto Axis).**
5. ~~Rarity/color skeleton~~ DERIVED: 245 = 122c/74r/23sr/16ssr/10ur,
   40 per mono color, 19 multicolor legends, 21 artifacts, 5 enemy-pair
   duals inside the common count, 34 Bastet creatures + 3 lords.
6. ~~Art-bible section drafted for the gold/lapis register.~~ **DONE
   2026-08-18: binding set register in art-bible/index.md §4a** (palette
   with reserved heart-red, value floor, lighting doctrine,
   blank-cartouche rule, per-mechanic composition, Bastet tells; the
   three art-binding taste questions carried as OWNER-PENDING flags).
   Companion drafts in art-bible/sands-of-the-duat-drafts.md (13 cast
   entries + 5 dual landscapes + pack face, checker-excluded until the
   card-data wave lands).
7. ~~The Dark Tales companion-wave rider decided~~ **RATIFIED 2026-08-17:
   the ~60-card companion wave RIDES THIS TRAIN** — it answers its two
   documented balance debts (Midnight Storybook thin pool, R19 inversion
   in-color tools) and shares the large set's single balance pass.

## Owner decisions — ALL RATIFIED 2026-08-17

- Set name: **Sands of the Duat**.
- Mechanic names: **Rite** · **Nine Lives** · **Preserve**.
- Companion wave: **in this train**.
