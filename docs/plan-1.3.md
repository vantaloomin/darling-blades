<!-- source-of-truth: docs/plan-1.1.md, docs/plan-v1.1-post-launch.md, docs/expansions/gothic-monsters.md, src/data/opponents.ts, src/ai/personality.ts, src/meta/gauntletSeed.ts, src/meta/SaveManager.ts, src/data/starterDecks.ts, scripts/balance-matrix.ts, docs/land-art.md · last-verified: 2026-07-17 · program doc — re-verify when the referenced code or plans change -->

# Darling Blades 1.3 — program plan

User decisions locked 2026-07-17 (this doc is their record; do not
relitigate without the user). Scope: the Gothic Monsters expansion
(added by user decision 2026-07-17), the daily tower rotation with a
floor-scaled AI model, the deck-builder land-style selector, the
"Hardcore MTG Fan" balance personas, plus the riders inherited from the
Planned backlog. 1.2.0 released 2026-07-17; 1.3 is the active program.

## Pillar 0 — Gothic Monsters: Nocturne Manor (Expansion 4)

**Locked 2026-07-17: the set ships in 1.3.** The concept doc is
[expansions/gothic-monsters.md](expansions/gothic-monsters.md) (80
cards, `gm-` prefix, vampire courts / stitched brides / wolf-cursed
nobility; primary B/R/W with U mad science and G plant horror;
40C/24R/7SR/5SSR/4UR). It follows the release pattern every prior set
used: engine mechanics land pure and tested first, then card data, then
booster SKU + precon + achievements + boss rungs + art run + glossary +
measured balance bands.

Known gaps between the concept doc and the engine (the AC precedent —
a concretion pass is required before any card data):

- **Menace and Kicker are the set's two signature mechanics and neither
  exists in the engine.** Per the two-new-mechanics-per-set precedent
  (Ragnarök: twinBlades/mill/reanimate; CF: sever/foresee; AC:
  quests/awakening) the default is to BUILD both: menace is a combat-
  legality change (multi-blocker constraint), kicker an optional-cost
  change in casting (validateAction/castSpell/mana solving + AI
  understanding at all difficulties). Both touch invariant-adjacent
  engine code and need full headless coverage before card data.
- The 2026-07-10 card table uses retired/nonexistent vocabulary (scry
  vs foresee, "exile grave" vs sever, activated tap abilities, generic
  multicolor rows against the legends-only multicolor invariant). The
  concretion pass rewrites every row in real vocabulary, exactly as
  arthurian-court.md was concretized on 2026-07-16.
- Bosses: rungs 15-16 (Carmilla and one more marquee per the summit-
  pair pattern) with calibrated bands and the honest-residual
  discipline; the tower grows to 16 rungs.

Sequencing inside 1.3: the set lands BEFORE the tower rotation's
re-baseline (Pillar 1) so the 16-rung roster, the prefab tuning
(Questing Table / Wild Communion), and the floor-tier calibration are
all measured in one pass instead of twice. The economy baseline
re-measures after the set (pool grows to 509 cards; every prior set
shifted persona completion and the dashboards re-date).

## Pillar 1 — Seeded daily tower rotation with floor-scaled AI

**Locked:** rotation is a FULL random shuffle of the avatar roster from
the daily seed. The difficulty curve survives the shuffle because it no
longer travels with the avatar: **the floor sets the brain, the avatar
brings its deck and personality flavor.** Lower floors get weaker AI
tiers, higher floors stronger, whatever deck lands there.

Implications (design latitude within these):

- **AI strength tiers.** Today's ladder has three brains (Easy/Medium/
  Hard) banded by fixed rung. Fourteen floors sharing three coarse tiers
  would make floors within a band interchangeable, so 1.3 needs a
  graded strength dial: more tiers than three, ideally derived
  parametrically (e.g. noise/pass-rate injection over the existing
  brains, the knobs `easyNoise`/`easyPassRate`/aggression already in
  `src/ai/personality.ts`, or a search-budget dial on Hard) rather than
  N hand-written brains. The exact tier count and dial are an
  instrument-then-hypothesize measurement task (playbook §6): propose a
  dial, measure a strength ladder with the balance harness, keep what
  produces a monotonic win-rate gradient. AI honesty invariant holds:
  every tier reads only the redacted PlayerView.
- **Roster stamping.** An active run keeps its roster across reloads and
  midnight: stamp `gauntlet.run` with the roster day/seed at run start
  (SaveData bump + real migrate() + test, per the 1.1 plan's Pillar 5.1
  analysis).
- **Balance re-baseline.** RUNG_BANDS re-keys from "slot expects avatar
  X" to "floor expects tier strength Y"; the whole tower re-measures
  (the date-stamped opponents.ts baseline moves to a floor-tier model).
  Fold the pending prefab tuning (Questing Table 24.4%, Wild Communion
  39.7% on the 2026-07-17 Hard round-robin) into the same measurement
  pass so the tower is measured once, after all deck changes.
- **Rewards.** `gauntletRungGold` is positional and stays positional
  (floor risk pays, not avatar identity) unless measurement says
  otherwise.

## Pillar 2 — Deck-builder land-style selector

**Locked:** the 30 vaulted basic-land art variants ship as a **selector
in the deck builder when adding basic lands. Cosmetic only: no catalog
entries, no booster presence, not collectible.**

Implications: per-deck land-style storage (a small SavedDeck addition
riding the next open SaveData bump, with migration + test; absent field
= current default art). UI: a style choice on the deck builder's basics
row (design latitude on whether the style is per basic type or per
deck). Duel/thumb rendering reads the style at CardView bake time; art
files stage per docs/land-art.md §3. Supersedes the roadmap's open A/B
decision (B-lite chosen).

## Pillar 3 — "Hardcore MTG Fan" personas

**New (user-directed 2026-07-17):** a few AI personalities that build
unique decks modeled on comparative MTG competitive archetypes, both as
opponents and as a standing probe of overall balance (the game's
MTG-analog overlap is already mapped in the local balance workbench).

Implications (design latitude within these):

- Decks are built strictly from the existing card pool (no new cards);
  each persona's list mirrors a classic competitive archetype the pool
  can express (candidates: mono-R burn/Sligh, U/x draw-go control, B/G
  attrition midrange, reanimator, W-weenie/tempo). Persona flavor text
  and names are player-facing copy (no em-dashes).
- **Corrected 2026-07-20 (user): the personas are a TESTING instrument
  for the developers, not a production feature.** No Practice picker
  row, no player-facing surface, no gauntlet presence. They live only
  in the balance harness (dev-side deck definitions + the matrix mode
  below); the original Practice-picker bullet is superseded.
- The balance harness gains a mode that runs the fan decks against the
  prefab field (the 2026-07-17 `--prefabs` idiom) so "how does our
  balance hold against tuned-archetype pressure" becomes a repeatable
  measurement, not a one-off.

## Riders (inherited from Planned, cheap)

- **"Mark" counter retheme** — copy-only, ready since 2026-07-13.
- **Sealed dead-code cleanup — ✅ SHIPPED 2026-07-20.** The cancelled
  feature's unoffered meta core, reveal scene, mode branches, strings, and
  feature tests were removed. SaveData stays v22: legacy history and
  `bestSealedWins` survive inert, while an active legacy Sealed run loads as no
  active run.

## Explicitly out (user decisions 2026-07-17)

- **Failure screen round 2** (run stats, reassurance line, next-target
  hook, same-seed retry, softer title): dropped. The screen ships as the
  PR #85 functional pass; "we don't need to necessarily be polite."
- Quest claim-rate fairness stays parked (its own item, unscheduled).
