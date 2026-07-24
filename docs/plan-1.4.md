<!-- source-of-truth: docs/plan-1.3.md, docs/plan-1.3-pillar3.md, docs/expansions/dark-tales.md, docs/keyword-map.md, src/data/opponents.ts, src/ai/tiers.ts, src/meta/SaveManager.ts, scripts/balance-matrix.ts, scripts/personas/ · last-verified: 2026-07-23 · program doc — re-verify when the referenced code or plans change -->

# Darling Blades 1.4 — program plan

**Status 2026-07-23:** Pillar 2 SHIPPED (PR #104, metagame loop).
Pillar 0 largely SHIPPED (engine #108, card data #110 at pool 638,
land style #111, duel UI + glossary #112; concretion record in
[plan-1.4-pillar0.md](plan-1.4-pillar0.md)); remaining: bosses 17-18,
the art PR (staged + user-audited on claude/1-4-art-staging), land-pick
staging, and the one end-of-set re-baseline. Pillar 1 (board-answer
pass) not started by design — it measures against the completed set.
Riders: doc-sync shipped (#106); the eyes-on checklist rides the user's
ongoing playtest passes. Tooling grown mid-train: the codex-dash stream
board (#107, #109).

User decisions locked 2026-07-23 (this doc is their record; do not
relitigate without the user). Scope: the Dark Tales expansion (the
headline — the biggest set to date), a board-answer balance pass that
folds in the balance-workbench recost proposals, the persona harness
metagame loop, plus doc-sync and eyes-on riders. 1.3.0 released
2026-07-21; 1.4 is the active program.

**Release mechanics:** same train as 1.3 — a fresh long-lived
`release/1.4` branch off main; feature branches PR back into it; CI
gates every PR; the final `release/1.4` → main merge + `v1.4.0` tag is
held for the user's explicit go; sync main → release/1.4 after any
hotfix merge. The user authorizes every merge.

## Pillar 0 — Dark Tales: The Cursed Storybook (Expansion 5)

The concept doc is [expansions/dark-tales.md](expansions/dark-tales.md)
(120 booster cards, `dt-` prefix, parody fairy-tale / adult gothic
glamour; primary U/B/W with R rebellious heroines and G cursed forests;
60C/36R/11SR/8SSR/5UR — half again bigger than any prior set).
Mechanical identity: value-control, graveyard spell recursion, hand
smoothing, long-game inevitability. It follows the release pattern
every prior set used: engine mechanics land pure and tested first, then
card data, then booster SKU + precon + achievements + boss rungs + art
run + glossary + measured balance bands.

Known gaps between the concept doc and the engine (the AC/GM
precedent — a concretion pass is required before any card data):

- **Cycling and Flashback are the set's two signature mechanics and
  neither exists in the engine.** Both are Magic-distinctive keywords,
  so both are renamed per the keyword-map distinctiveness rule (the one
  that retired "saga" and picked Empower over Surge/Escalate).
  **Names locked 2026-07-23: Cycling = Skim, Flashback = Retell.**
  - **Skim** (cycling): "{cost}, discard this card: draw a card." A
    hand-side activated discard-to-draw — new casting-surface code
    (a non-cast action from hand), mana payment outside a cast, and AI
    understanding of when smoothing beats casting, at all three
    difficulties.
  - **Retell** (flashback): "Retell {cost}: you may cast this from your
    graveyard, then sever it." A graveyard-side cast permission —
    cast-from-zone legality, an alternative-cost path, the post-resolve
    sever (the severed zone already exists and is one-way), and AI
    valuation of graveyard spells as virtual card advantage.
  - Both touch invariant-adjacent engine code (actions/legality, mana
    solving, resolve, the AI value heuristics) and land headless,
    seeded-deterministic, and fully tested BEFORE card data, per the
    quests/awakening and Dreaded/Empower precedents. Exact semantics
    (timing windows, Skim at instant speed or not, Retell + cancel
    interactions, stack/history/replay surfaces) are the concretion
    doc's job, defaulting to MTG-accurate behavior.
- The 2026-07-10/13 card table uses retired or nonexistent vocabulary
  (scry vs foresee, menace vs dreaded, "exile" vs sever, "cycling"/
  "flashback" vs the locked names, activated taps, modal notes, generic
  multicolor rows against the legends-only multicolor invariant). The
  concretion pass rewrites all 120 rows in real vocabulary, exactly as
  arthurian-court.md and gothic-monsters.md were concretized.
- **Bosses: rungs 17-18 (locked 2026-07-23)** — Glass-Coffin Queen and
  Abyssal Songstress per the summit-pair pattern; the tower grows to 18
  floors with calibrated bands and the honest-residual discipline.
- Precon: **Midnight Storybook** (U/B/W value-control per the concept
  doc), booster SKU at the 525g set-scoped price point, set icon, 8
  schema-free achievements, art bible + art run per the art-pipeline
  lanes (serialized across token refresh, halt-on-auth rails).
- **SaveData:** expect a v22 → v23 bump if any new run/collection state
  is needed (real `migrate()` + test; old blobs keep loading). Do not
  bump speculatively — the concretion pass decides.
- Pool grows 518 → 638; the economy baseline re-measures after the set
  (every prior set shifted persona completion; dashboards re-date).

Sequencing inside 1.4: the set lands BEFORE the tower re-baseline so
the 18-floor roster, the balance-pass card changes (Pillar 1), and the
floor-tier calibration are all measured in ONE pass (the 1.3 lesson:
measure the tower once, after all deck/card changes; tier gates need
80+ seeds).

## Pillar 1 — Board-answer balance pass

**The structural finding (plan-1.3-pillar3.md §8): the field cannot
punish go-wide.** The crafted weenie deck hit 77.6% aggregate with a
73% WORST matchup — nothing in the pool answers a wide board.
Sweeper-class effects and anthem-hate are the flagged answer classes,
and Dark Tales' U/B/W control identity is their natural home (The
Sleeping Curse is already spec'd as a control sweeper; a
damage-sweeper and/or anthem answer slot into the set's R/B lanes).

**Locked 2026-07-23: the pass also applies the balance-workbench
MTG-analog audit** (local gitignored `balance/` workbench, findings
recorded in session memory): the Ragnarök chase-legendary overshoots
and Celtic-Fae value-engine undershoots whose recost proposals were
never applied. One coherent pass, one re-baseline.

Implications (design latitude within these):

- Go-wide answers ship primarily as Dark Tales cards; if measurement
  says older sets still need answers (color-pie-appropriate), a small
  cross-set cycle is in scope per the 1.3 removal-cycle precedent.
- Workbench recosts are re-derived against the CURRENT pool before
  applying (the audit predates AC/GM and the 1.3 tunings); apply err-
  conservative, then measure.
- Everything is measured through the shipped instruments: the persona
  harness (`scripts/personas/`, including the new metagame loop from
  Pillar 2), the prefab round-robin, and the floor matrix. Success
  criterion: weenie's aggregate and worst-matchup numbers come down
  materially (target band set in the concretion doc after a fresh
  sweep, not invented here); no persona quota shortfalls introduced.
- Card-data edits desync art-bible "Card facts" lines — run the full
  doc-checker trio after any card edit (the CI gate learned 2026-07-12).
- Test gate floors only ratchet upward, with fresh measured numbers.

## Pillar 2 — Persona harness v2: the metagame loop (dev-only)

**Locked 2026-07-23: the metagame loop ships in 1.4 as an
INFORMATIONAL instrument; CI-gate promotion is explicitly deferred**
until the loop has proven stable across a full release cycle.

The shipped v1 harness crafts each persona against the static
prefab/starter field. v2 adds the loop: personas iterate against each
other's RETAINED lists (craft → field includes the other five
artifacts → re-craft → converge or oscillate honestly), so the
committed artifacts approximate a metagame equilibrium instead of six
independent best-responses. Design latitude on convergence policy
(fixed round count vs stability threshold), but determinism and
artifact provenance (seed/template/measurement stamps) are invariant,
and honesty reporting stays: an oscillating archetype is a finding,
not a failure to hide. Never player-facing.

The 1.4 balance pass (Pillar 1) is measured with v2 — the loop's
whole point is that "weenie beats the field" claims survive the field
fighting back.

## Riders (cheap, folded in)

- **Doc-sync pass:** docs/art-pipeline.md counts are stale-by-content
  (spells 52 → 91, lands 15 → 22, totals to 537+ with tokens). Sweep
  alongside the set's own doc updates.
- **keyword-map.md** gains planned rows for Skim/Retell now (done with
  this plan), flipped to Shipped when the mechanics land.
- **1.3 eyes-on checklist (scheduled EARLY in the train):** a staged
  playtest build + one-page checklist for the owed human-review items —
  tower lineup feel + noisy-tier calibration in real play, styled lands
  in a real duel, the Empower cast chooser, stack display +
  counterspell targeting, inline mana-pip typography. All shipped as
  code in 1.3; what is owed is the user's eyes. Findings route to
  hotfix PRs to main (then sync to release/1.4) or 1.4 riders by
  severity. Ops note: copy `src/dev/cheats.local.ts` into any worktree
  served for playtest (gitignored, does not propagate).

## Explicitly out (user decisions 2026-07-23)

- **"Darlings" commander format stays at 1.5** (kept, not pulled
  forward; no partial engine pull either).
- **Persona CI balance gate** — deferred with the trust criterion
  above.
- **Cyberpunk Yokai Nights** (Expansion 6) — concept only, unscheduled.
- **MOD/UGC card packs** — 2.0.
