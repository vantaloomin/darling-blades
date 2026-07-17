<!-- source-of-truth: docs/plan-1.1.md, docs/plan-v1.1-post-launch.md, src/data/opponents.ts, src/ai/personality.ts, src/meta/gauntletSeed.ts, src/meta/SaveManager.ts, src/data/starterDecks.ts, scripts/balance-matrix.ts, docs/land-art.md · last-verified: 2026-07-17 · program doc — re-verify when the referenced code or plans change -->

# Darling Blades 1.3 — program plan

User decisions locked 2026-07-17 (this doc is their record; do not
relitigate without the user). Scope: the daily tower rotation with a
floor-scaled AI model, the deck-builder land-style selector, the
"Hardcore MTG Fan" balance personas, plus the riders inherited from the
Planned backlog. Starts after PR #85 lands and the 1.1/1.2 release
mechanics (version bumps + tags + README notes) are cleared.

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
- Surfaced via the Practice picker roster (their own row or grouping);
  NOT part of the gauntlet rotation roster unless the user later says
  so.
- The balance harness gains a mode that runs the fan decks against the
  prefab field (the 2026-07-17 `--prefabs` idiom) so "how does our
  balance hold against tuned-archetype pressure" becomes a repeatable
  measurement, not a one-off.

## Riders (inherited from Planned, cheap)

- **"Mark" counter retheme** — copy-only, ready since 2026-07-13.
- **Sealed dead-code cleanup** — cancelled feature's unoffered
  meta/scene/tests removed.

## Explicitly out (user decisions 2026-07-17)

- **Failure screen round 2** (run stats, reassurance line, next-target
  hook, same-seed retry, softer title): dropped. The screen ships as the
  PR #85 functional pass; "we don't need to necessarily be polite."
- Quest claim-rate fairness stays parked (its own item, unscheduled).
