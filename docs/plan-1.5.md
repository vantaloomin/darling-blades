<!-- source-of-truth: docs/plan-1.4.md, docs/roadmap.md, docs/plan-darlings.md, docs/plan-variant-decks.md, docs/plan-dt-power-pass.md, docs/plan-save-portability.md, docs/expansions/drafts/yokai-nights-overplan.md, src/data/opponents.ts, src/meta/SaveManager.ts, scripts/balance-matrix.ts, scripts/personas/ · last-verified: 2026-07-28 · program doc — re-verify when the referenced code or plans change -->

# Darling Blades 1.5 — program plan

**Status 2026-07-28:** ACTIVE. Decisions locked by the user this date
(this doc is their record; do not relitigate without the user).
v1.4.0 released 2026-07-28 (tag on main `5685bbd`); 1.5 is the active
program.

**Release mechanics:** same train as 1.3/1.4 — a fresh long-lived
`release/1.5` branch off main; feature branches PR back into it; CI
gates every PR; the final `release/1.5` → main merge + `v1.5.0` tag is
held for the user's explicit go (note: `main` now requires PRs — the
cut itself goes through a PR, per the 1.4 release record); sync
main → release/1.5 after any hotfix merge. The user authorizes every
merge. The metagame deep sweep runs LAST, at release-prep, against the
final field (standing rule, 2026-07-24).

## Decisions locked 2026-07-28

The four per-feature implementation docs (from PR #130) are the specs;
this list resolves their Open Decisions sections. Where a doc offered a
recommendation, "accepted" means that recommendation ships as written.

- **Darlings** ([plan-darlings.md](plan-darlings.md)) — all four
  recommendations accepted: strict colorless identity (no one-color
  exception; a purpose-built colorless roster is future work),
  player-built-only launch scope (Waves 1–2 committed; the curated
  rival ladder is NOT a 1.5 promise and needs measured evidence first),
  portrait locked to the Darling, and a dedicated Darlings practice row
  that rejects Constructed decks and records the format in replays.
- **Variant decks** ([plan-variant-decks.md](plan-variant-decks.md)) —
  the storage shape (positional `variantPins` vs slot objects) is
  decided by the Wave 1 card-instance spike's mutation tests, not
  pre-picked; the other three recommendations accepted: Auto resolves
  to best-currently-owned deterministically, sharding a pinned copy
  clears the minimum pins to Auto with a pre-confirmation summary, and
  data-authored pins are permitted on showcase rivals (cosmetic only).
- **Crafting intent** ([plan-dt-power-pass.md](plan-dt-power-pass.md))
  — **endgame sink** (user pick, over the doc's bad-luck-valve
  recommendation). Crafting is deliberately expensive, for finished
  collectors chasing their last uniques. The measured
  `craftedUniques = 0.0` at pool 638 is therefore working as intended:
  the 6× multiplier is RETAINED, the price sweep is descoped from the
  power pass, and the zero is documented as intended behavior. No
  rebate (nothing changes to rebate).
- **Midnight Storybook target** — the 40–55% band is direction, not a
  release requirement: retain the best non-distorting candidate
  package and publish the honest final number, naming any remaining
  debt.
- **Go-wide response** — answer density first: strengthen broadly
  useful sweeper/answer availability across the field, and directly
  weaken the retained weenie list only if it remains dominant on
  re-measure.
- **Yokai Nights** — **Hauntlink confirmed as the headline mechanic**;
  the ~80-row cull from the 200-candidate overplan happens at the
  engine-first concretion pass using the existing core/flex/stretch +
  `(AI-risk)` tags (the Dark Tales Pillar 0 pattern).
- **Save codes** ([plan-save-portability.md](plan-save-portability.md))
  — all three recommendations accepted: replays excluded by default
  with an explicit `Include replays` option, whole-profile replacement
  only (selective merge is an exploit surface), checksum-only codes
  with the keep-this-private warning (encryption deferred until a
  recoverable-key UX is specified).
- **Metagame-loop CI promotion — CLOSED for 1.5: stays
  informational-only.** The 1.4 release sweep hit max-rounds 4/4
  without convergence — precisely the not-yet-trusted signal the
  promotion gate was defined on. Revisit after the 1.5 release sweep,
  ideally with a larger round budget to test for convergence.
- **Battle Box mana system (SCOPE INCREASE, locked 2026-07-28):** both
  new formats use a chosen land reserve instead of drawn lands — 50-card
  all-spell decks, per-deck reserve of 10 lands with max 5 duals, duals
  enter tapped, asymmetric destruction (duals die to the graveyard,
  basics return to the reserve), land-fetch cards audited out. Darlings
  adopts it wholesale (superseding its 60-card basics-unlimited shape
  and its no-engine-change property, knowingly); a third `battlebox`
  format ships it with Constructed copy limits. Classic Constructed is
  untouched and must be proven byte-identical. Spec:
  [plan-battle-box.md](plan-battle-box.md).

## Pillar 0 — Cyberpunk Yokai Nights (Expansion 6)

The candidate pool is
[expansions/drafts/yokai-nights-overplan.md](expansions/drafts/yokai-nights-overplan.md)
(200 rows: 100C/60R/18SR/14SSR/8UR, cut-priority tagged, targeting the
standard 120-card set at 60C/36R/11SR/8SSR/5UR). Neon-noir yokai city;
primary identity around possession, tempo, and network-spirit value.

- **Hauntlink is the set's one new mechanic** and does not exist in the
  engine. `Hauntlink {cost}` is an alternate play mode on an Artifact
  or Enchantment: pay the Hauntlink cost, choose one creature you
  control, and the card arrives linked to that creature, granting its
  printed Linked rider. Exactly one host, no reattach or move, goes to
  its owner's graveyard when the host leaves play. Playing the card
  for its normal cost keeps it standalone. Engine surface: a host
  pointer, one cleanup rule, a second casting mode (the Retell
  alternative-cost seam is precedent), and AI host-selection value at
  all three difficulties.
- **Engine-first, concretion-first** (the AC/GM/DT precedent): a
  concretion pass produces the Hauntlink engine dossier + the
   120-row concretized card table (real house vocabulary only) BEFORE
  any engine or card-data build; the user approves the package before
  the engine hand-off. The cull uses the overplan's tags: core rows
  survive by default, stretch rows die first, `(AI-risk)` rows need an
  explicit pilotability argument to survive.
- Set completion follows the established pattern: card data + tokens →
  booster SKU (525g set-scoped) + precon + 8 schema-free achievements
  → duel-UI affordances + glossary row → art bible + art run (cel-gacha
  style preamble, serialized lanes) → boss rungs per the summit-pair
  precedent (rungs 19–20, tower to 20 floors — CONFIRM at concretion;
  the PracticePicker's ~24+ pagination escape hatch is already flagged)
  → the ONE end-of-set re-baseline (80+ seeds for tier gates),
  measured after Pillar 1's card changes (the 1.3/1.4 lesson: measure
  the tower once, after all deck/card changes).
- **SaveData:** the v22 → v23 bump is owned by Pillars 2/3 (below);
  the set itself should not need schema state — the concretion pass
  confirms.
- Pool grows 638 → ~758; the economy baseline re-dates after the set
  (every prior set shifted persona completion).

## Pillar 1 — Dark Tales power pass

Spec: [plan-dt-power-pass.md](plan-dt-power-pass.md), with the
crafting wave DESCOPED by the endgame-sink decision (Wave 3 reduces to
documenting the retained 6× price and the intended zero). The three
anchors stand: Midnight Storybook 30.5% (300 seeds/cell, 13,500
games), weenie 78.1% static / 74.5% adapted-metagame (worst matchup
72.7%), and the sweep's max-rounds non-convergence corroborating the
go-wide gap through an independent instrument.

- Wave 1 (debt board): reproduce or document drift on the anchors
  against the CURRENT pool — after Yokai card data lands, since the
  pool change stales every baseline; classify Midnight losses and
  go-wide wins from replays before touching data.
- Wave 2 (candidates): one coherent lever per candidate. Midnight
  package per the band-as-direction decision; go-wide package per the
  answer-density-first decision. Yokai concretion should deliberately
  consider sweeper/anthem-answer slots in-set (the Dark Tales U/B/W
  lesson: the set's answer classes were the plan, and the gap did not
  close — design them on purpose this time, then measure).
- Wave 4 (combined regression + publication) as spec'd; patch notes
  name only retained changes, no em-dashes.

## Pillar 2 — Darlings + Battle Box formats

Specs: [plan-darlings.md](plan-darlings.md) (as respec'd 2026-07-28) +
[plan-battle-box.md](plan-battle-box.md) (the shared land-reserve
system). Committed scope: the pure format validators (Battle Box
reserve rules shared by both formats), the reserve engine wave
(sequenced after the card-instance spike merges and serialized against
the Hauntlink engine build — shared engine files), and the builder +
duel UI for both formats, each with its own dedicated practice row.
Curated rivals and any reserve-format matrix remain explicitly NOT
promised for 1.5. The parked `claude/commander-naming-review-ee50e3`
draft is historical rationale only; plan-darlings.md is the authority
and the draft is never merged.

## Pillar 3 — Variant deck building

Spec: [plan-variant-decks.md](plan-variant-decks.md). Wave 1 is the
card-instance engine spike — the train's largest technical risk — and
its equivalence/transition evidence picks the storage shape. Waves 2–3
(schema + deck ops, picker + shared duel resolver) follow. **The v22 →
v23 migration is ONE atomic step adding both Pillar 2's
`format`/`darlingId` and this pillar's variant fields** (whichever
shape wins), sequenced so both pillars' Wave 2s land through a single
migration PR with tests. If the spike cannot prove deterministic,
replay-safe instance movement, the pillar stops for redesign rather
than shipping parallel arrays that drift.

## Pillar 4 — Save export codes

Spec: [plan-save-portability.md](plan-save-portability.md), Waves 1–2
only (pure `SaveCode` envelope + the Profile export/import flow); the
1.8 cloud waves are out of scope. No SaveData bump. Lands AFTER the
v23 migration so codes serialize the final 1.5 schema. Size limits are
measured (`scripts/measure-save-code.ts`) before any QR claim.

## Sequencing

1. **Concretion first:** Yokai concretion package (Hauntlink dossier +
   120-row table) → user approval gate.
2. **Parallel engineering on disjoint files:** Hauntlink engine build;
   variant-deck Wave 1 spike; format validators (Darlings + Battle Box
   reserve rules); save-code Wave 1 envelope. THREE engine jobs now
   exist (spike, Hauntlink, reserve engine) and share files — the spike
   runs first, then Hauntlink and the reserve engine serialize.
3. **The atomic v23 migration** (format + darlingId + landReserve +
   the variant fields, one bump), then the UI waves; save-code Waves
   land after v23.
4. **Yokai card data + set completion + art**, then Pillar 1 measured
   against the completed pool, then the ONE re-baseline.
5. **Release prep:** doc package, economy re-date, then the metagame
   deep sweep LAST against the final field (informational; its
   convergence behavior feeds the next promotion review).

## Riders (cheap, folded in)

- **keyword-map.md** gains a planned-mechanics row for Hauntlink now
  (done with this plan), flipped to Shipped when the engine lands.
- **roadmap.md cadence fix** (done with this plan): the 1.5→2.0 ladder
  intro still called 1.5's set slot "a health pass rather than a new
  set", contradicting the Yokai move-up recorded three lines later;
  reworded to match the decided scope.
- **1.4 eyes-on carry-over** rides the user's normal play: the batch-3
  visual list (icons, batch holo, pearlescent, variant pager, sort
  feel). Findings route to hotfix PRs or 1.5 riders by severity.

## Explicitly out (user decisions 2026-07-28)

- **Metagame-loop CI promotion** — closed for 1.5 (see Decisions).
- **Curated Darlings rival ladder** — not promised; evidence first.
- **Crafting price change / rebate** — crafting is an endgame sink;
  6× retained.
- **Cloud sync (1.8), player-facing replay share (1.6), suggested
  decks (1.6), story mode (1.7)** — later rungs per the roadmap
  ladder.
- **Expansion 7 ideation** — its own planning discussion, not this
  train.
