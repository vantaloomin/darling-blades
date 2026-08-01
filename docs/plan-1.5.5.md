<!-- source-of-truth: docs/plan-1.6-draft.md, docs/plan-battle-box.md, docs/plan-darlings.md, src/config/features.ts, src/meta/warchest.ts, src/meta/SaveManager.ts, scripts/balance-matrix.ts, scripts/progression-sim.ts · last-verified: 2026-07-31 · program doc — re-verify when the referenced code or plans change -->

# Darling Blades 1.5.5 — program plan

**Status 2026-07-31: ACTIVE.** The train opened the day of the 1.5.0 cut
(`release/1.5.5` off main `0d363b5`). Owner framing: *"the missing
features, after we test them"* — small on purpose. The larger docket
(priority-window reopening, the Warchest migration, Premium UX Waves B–D,
the large set) belongs to 1.6; its draft program is
[plan-1.6-draft.md](plan-1.6-draft.md), which also records the ratified
north star this train serves.

## The north star (owner-ratified 2026-07-31)

**Warchest** is the product name for the land-reserve mana system (10
lands, max 5 duals, chosen not drawn). It replaces the borrowed "Battle
Box" working title in everything player-facing. Warchest becomes THE mana
system of the game: **1.5.5 reveals Warchest and Darlings** (both on the
reserve system, after measurement); **1.6 launches Warchest everywhere and
classic constructed retires.** There is deliberately no dual-balance era.
This train does NOT touch classic constructed in any way.

## Scope

### 1 · Measurement gate (blocks the reveal)

Both formats are engine- and UI-complete but have never been
balance-measured (the reason they shipped hidden). Before any flag flip:

- **Matrix tooling rung**: `scripts/balance-matrix.ts` has no reserve
  mode. Add reserve-format matrix modes (Warchest and Darlings) that
  drive legitimately built 50-card all-spell decks + 10-land reserves
  through the real engine reserve path. Decks are built legally through
  the validators (`src/meta/warchest.ts` / `darlings.ts`), never
  planted: the boot path PRUNES invalid decks from a save, and a matrix
  that bypasses validation measures decks a player cannot hold.
- **Warchest matrix** and **Darlings matrix**: dated baselines at a
  defensible seed count, published in the standard baseline home. These
  are the two `TO MEASURE` markers the 1.5 release split created.
- **Losslessness probe**: a legitimately built 50-card all-spell deck
  plays complete games with no dead states — no mana screw or flood by
  construction, land play stops being offered when the reserve empties,
  and no seed produces a stuck game across the probe set.
- Classic byte-identity was already proven when the reserve engine
  landed (#148) and is re-asserted by the existing avatar/floor gates on
  every PR; no new classic measurement is owed.

Reserve-format results justify **no classic-pool card changes**
(plan-battle-box.md's standing rule). If measurement finds a broken
matchup *inside* the reserve field, the fix is data measured against the
reserve matrices, and the classic gates must stay green.

### 2 · The reveal (after the gate)

- Flip `FEATURES.reserveFormats` in `src/config/features.ts`.
- **Reveal copy carries the Warchest name** everywhere player-facing:
  format switch, rules panels, launch guards, validator error strings,
  glossary row, patch notes. Player copy rules apply in full (no
  em-dashes, no AI prose patterns); the owner taste-gates all reveal
  copy before merge.
- **Casing-debt collapse**: internal `'battleBox' | 'battlebox'` ids
  collapse to `'warchest'`. `SavedDeck.format` is persisted state, so
  the rename is a real `SaveData` migration (v24 → v25) mapping
  `'battlebox'` → `'warchest'`, with normalization still coercing
  unknown formats to `'constructed'`, plus a migration test. Replay
  metadata that recorded the old format id must keep loading.
- The curated Darlings rival ladder stays **explicitly not promised**
  (standing decision; player-built duels only).
- **Darlings command-zone respec:** each 79-spell Darlings deck carries its
  legendary Darling outside the list, with public cast, tax, pay-down, replay,
  builder, migration, tutorial, and glossary presentation as specified in
  [plan-darlings.md](plan-darlings.md)'s 2026-08-01 section.
- **Next wave, not this scope:** five dual-legend Darlings precons, with Zhou
  Yu free. They require their own card-list and balance approval before data
  work begins.

### 3 · Progression bands: absolute owned-unique cards

Must land before any future set ships. The owner selected **absolute
owned-unique card counts on 2026-07-31**. The old whole-pool percentage
decayed mechanically with every new set and forced economically meaningless
band re-centres (including the 2026-07-29 re-centre). A reachable-relative
percentage would not solve that problem: seven of ten personas are mixed
buyers whose reachable pool is the whole pool.

Fine bands convert once as `round(original percentage edge × 764
collectible cards)`, preserving their historical tolerance to whole-card
precision. The CI-fast coarse band is separately re-derived from its
measurement. Fine bands remain flag-only and the coarse band remains the
only exit-affecting band. `collectionPct` remains percent-based for policy
inputs and informational completion display; it no longer decides persona
band outcomes. Future sets leave the count bands untouched unless a measured
flag or deliberate economy change warrants a re-centre.

### 4 · Riders

- **Sweeper + tribal card art**: the six 1.5 balance-pass cards shipped
  with staged prompts and no art (Ember Squall, Creeping Malaise, Yang
  Huiyu Patient Regent, Porcelain Governess, Sable Warband Captain,
  Moundlight Midwife). Imagegen lane per the art pipeline, smart-crop,
  art-bible entries, `check-art-bible` green, owner taste gate.
- Doc sweep: keyword-map / glossary rows that graduate from "hidden"
  to shipped language; roadmap Planned→shipped moves at close.

## Explicitly out (owner decisions, 2026-07-31)

- **Priority-window reopening** — committed docket item, but it lands
  inside the **1.6 train** so its re-baseline and the Warchest
  migration's are the same measurement (supersedes the 2026-07-30 note
  that had it beside the reveal in 1.5.5).
- **The Warchest migration itself** (starters, avatar decks, Draft,
  land-fetch redesign, deck-invalidation flag-and-fix flow) — 1.6.
- **Premium UX Waves B–D** — 1.6 per the ratified draft order.
- **Curated Darlings rival ladder** — evidence first, still not
  promised.
- **Metagame deep sweep** — the standing sweep-runs-last rule applies
  to releases whose field persists; the 1.6 migration invalidates this
  field, so the sweep decision is made at 1.5.5 release-prep with the
  owner.

## Sequencing

1. Matrix tooling rung (reserve modes + losslessness probe harness).
2. The two matrices + the probe, detached long runs, dated baselines.
3. Reveal engineering (flag flip + Warchest copy + v25 casing collapse),
   gated on the owner's copy taste call.
4. collectionPct rework (proposal → owner pick → implementation).
5. Art riders in parallel (imagegen lane is independent of 1–4).
6. Release prep: docs, patch notes, the cut PR — every merge
   owner-authorized on green checks, as always.

## Acceptance criteria

- Both reserve formats have dated, checked-in measured baselines and a
  losslessness result before `FEATURES.reserveFormats` flips.
- Every player-facing surface says Warchest; no player copy contains an
  em-dash; the owner approved the copy.
- No internal id spells `battleBox` or `battlebox` after the collapse;
  v24 saves round-trip through v25 with formats intact.
- Persona progression bands use absolute owned-unique counts and no longer
  decay mechanically with pool growth; progression-sim and all checkers are
  green under the new metric.
- The six cards have approved art, smart-crops, and art-bible entries.
- Classic constructed is untouched: avatar/floor gates green throughout.
