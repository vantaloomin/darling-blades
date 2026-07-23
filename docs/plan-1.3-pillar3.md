<!-- source-of-truth: docs/plan-1.3.md, scripts/balance-matrix.ts, src/meta/DeckStorage.ts, src/meta/deckColorIdentity.ts, src/ai/value.ts, src/ai/evaluate.ts, src/engine/rng.ts · last-verified: 2026-07-23 · concretion of Pillar 3 — flags ANSWERED 2026-07-20; harness BUILT and the INAUGURAL SWEEP COMPLETE 2026-07-21 (section 8) -->

# 1.3 Pillar 3 concretion - persona deck-crafting harness (dev-only)

Concretizes plan-1.3.md Pillar 3 as RESCOPED by the user 2026-07-20:
the Hardcore MTG Fan personas are a dev-side testing instrument that
simulates PRO-LEVEL players CRAFTING THEIR OWN DECKS from card pools
and testing them at scale. Never player-facing: no Practice picker row,
no scene code, nothing in the shipped bundle. Crafted deck lists are
RETAINED as reviewable artifacts. Supersedes the earlier "decks
mirroring archetypes from the existing pool" reading (hand-built lists)
recorded in plan-1.3.md.

## 1. What "simulating a pro deckbuilder" means here

A pro does three things we can model headlessly, and one we cannot:

1. **Archetype intent** - they set out to build burn, draw-go,
   attrition, reanimator, or weenie, and evaluate every card against
   that plan, not in a vacuum. MODEL: per-persona archetype templates
   (color identity, curve envelope, slot quotas: threats / removal /
   interaction / draw / finishers / lands, synergy tags to overweight).
2. **Card evaluation** - they price cards by rate and role. MODEL: a
   deterministic card score = the balance workbench's rarity-scaled
   power baseline blended with role fit (does this card fill an unmet
   quota?) and synergy tags (subtype/keyword matches the template
   rewards). The AI layer's `value.ts` pricing is a cross-check, not
   the driver - it prices battlefield value, not deck value.
3. **Playtest iteration** - they jam candidate lists against the
   field and cut what underperforms. MODEL: seeded hill-climb. Build
   the greedy list from (1)+(2), measure it with the existing matrix
   harness (`runCell` plumbing, Hard brain both sides) vs a fixed
   reference gauntlet, then N swap-iterations: propose a quota-legal
   swap from the pool, re-measure, keep on improvement. Every step
   seeded and logged so a run is reproducible bit-for-bit.
4. **Metagame reading** (shipped in 1.4): pros tune against an evolving
   field. The metagame mode starts from the static field, then iterates
   every persona against the other personas' retained lists. It stops on
   all-deck stability, reports a repeated non-stable deck as oscillation,
   or reports the fixed round cap. Scores are never averaged away.

## 2. The personas (proposed roster, 5)

| Persona | Archetype | Colors (from the pool audit) | Signature bias |
| --- | --- | --- | --- |
| The Burn Player | burn / face aggro | R, R/B splash | damage-per-mana above all; curve tops at 4 |
| The Draw-Go Player | counter-control | U/W | interaction + draw quotas doubled; wins late |
| The Attrition Player | grind / removal | B/W | 2-for-1s, removal density, recursion |
| The Reanimator | graveyard combo | U/B | enablers + payoffs tagged, mana ramps to 6+ |
| The Weenie Player | go-wide aggro | W, W/G | 1-2 drop density, anthem effects |

Archetype viability per pool is itself a finding: if the Reanimator
cannot assemble a functional deck from a 518-card pool, that is a
design signal about the pool, and the harness should SAY so (a
quota-shortfall report), not silently produce a bad deck.

## 3. Where it lives, what is retained

- Code: `scripts/personas/` (build + measure CLI, archetype templates)
  plus pure helpers in `scripts/` shared with balance-matrix. Nothing
  under `src/` - the shipped bundle never sees personas (lint layer
  rules keep it out of the game; scripts/ is already dev-land).
- **Retained lists: COMMITTED, not gitignored** (proposed - flag 2):
  `scripts/personas/decks/<date>-<persona>-<pool>.json` for single-round
  artifacts and `<date>-metagame-<persona>-<pool>.json` for metagame
  artifacts, each with the
  full 60-card list, the generator seed + template version, the
  measured record vs the reference field, and the hill-climb log
  (initial list, every accepted swap, score deltas). Committed lists
  make findings reviewable in PRs and reproducible on any machine; the
  gitignored `balance/` workbench stays for scratch runs.
- Metagame artifacts add a `metagame` object without changing schema v1.
  Every recorded round carries its craft seed, template version, field
  composition including full opponent deck lists, measured record, and
  hill-climb log. Existing v1 artifacts remain valid single-round inputs
  to `--check`.
- CLI: `npx tsx scripts/personas/craft.ts --persona burn --pool all
  --seeds 100 --iterations 40 --seed 12345` and a `--all` sweep mode;
  `--check <deck.json>` re-measures a retained list against the
  current codebase (drift detection after balance changes).

## 4. Scale testing (what the lists are FOR)

- `--field prefabs` (default): persona deck vs the 9 prefab decks,
  Hard brain both sides, the prefab matrix's seed discipline.
- `--field starters`: vs the 5 reference starters (the tower's
  measurement currency).
- `--field personas`: round-robin of the retained lists - the
  metagame probe, and the seed of the v2 loop in section 1.4.
- Output: the familiar matrix table + aggregate, appended into the
  retained JSON. INFORMATIONAL ONLY - no CI gates in v1 (flag 5): the
  instrument should report imbalance, not block merges on it, until we
  trust its judgment.

## 5. Determinism and honesty rules

- No `Math.random` anywhere: builder and hill-climb draw from
  `createRngState(seed)`; identical (pool, template, seed, code) =>
  identical list. The retained JSON records everything needed to rerun.
- The hill-climb measures with the same `runCell`/`playOut` code path
  the balance suite uses - one simulator, no parallel truth.
- Quota shortfalls, non-monotonic climbs, and "the greedy list beat
  the final list" outcomes are REPORTED, not smoothed over.
- Deck legality via `validateDeck`'s rules (60 cards, 4-copy cap,
  basics exempt) minus the ownership check - personas own everything.

## 6. Flag resolutions (user, 2026-07-20)

1. **SIX personas**: the proposed five PLUS a Midrange goodstuff
   persona - a template-light "best rate at every slot" builder that
   serves as the power-level control group for the other templates.
2. **Committed JSON** under `scripts/personas/decks/`.
3. **Deep default budget: 80 swap-iterations x 150 seeds** per measure
   (multi-hour single-persona runs accepted; the CLI keeps
   --iterations/--seeds overrides for quick passes).
4. **Prefab reference field** by default.
5. **No CI gates in v1** (default accepted).

## 7. Original flags (for the record)

1. **Roster of five** as proposed above - or trim/extend (each persona
   is one template file; marginal cost is small)?
2. **Committed deck lists** under `scripts/personas/decks/` (proposed)
   - or the gitignored `balance/` workbench (private scratch, less
   reviewable)?
3. **Hill-climb budget default**: 40 swap-iterations at 100 seeds per
   measure (~roughly a prefab-matrix worth of games per persona) - or
   cheaper/deeper defaults?
4. **Reference field default**: prefabs (the shipped product decks,
   proposed) or starters (the tower's measurement currency)?
5. **No CI gates in v1** (proposed): the harness is a standing probe
   run by hand / by session, results reviewed like balance matrices.

## 8. Inaugural sweep findings (2026-07-21, seed 20260720, tuned field)

All six personas crafted legal decks with ZERO quota shortfalls and
clean honesty flags (monotonic climbs, final beats greedy everywhere) -
the 518 pool supports every modeled archetype, including graveyard
combo. Aggregates vs the nine tuned prefabs, 150 seeds per matchup:

| Persona | Aggregate | Best matchup | Worst matchup |
| --- | --- | --- | --- |
| Weenie (W/G go-wide) | **77.6%** | Wild Communion 82% | Bloodmoon Masquerade 73% |
| Midrange control group | 67.3% | Wild Communion 77% | Burning Tides 59% |
| Burn (R/B) | 67.1% | Burning Tides 74% | Crimson Muster 62% |
| Reanimator (U/B) | 64.0% | Wild Communion 75% | Burning Tides 53% |
| Attrition (B/W) | 63.7% | Questing Table 77% | Shadow Mandate 51% |
| Draw-Go (U/W) | 63.7% | Grave Harvest 70% | Bloodmoon Masquerade 55% |

Reads:

1. Crafted decks beat every prefab (63.7-77.6 vs the prefabs' internal
   42-60 spread) - the expected healthy gap; precons are not optimal.
2. Five of six land in a tight 63.7-67.3 band around the Midrange
   control, so the archetype templates cost little power vs
   unconstrained goodstuff - the scorer and quotas are calibrated.
3. **Weenie at 77.6% with NO matchup below 73% is the outlier and the
   pool's first structural finding: the field cannot punish go-wide.**
   The likely gap is answer density - board sweepers and go-wide
   punishment are scarce in the pool relative to spot removal (the
   removal-answer cycle shipped single-target tools). A 1.4 candidate:
   sweeper-class effects, or anthem-hate, measured through this same
   harness before shipping.
4. The hill-climb earns its budget: greedy control lists underperform
   badly (draw-go 31.5 greedy) and iteration recovers them fully.

## 9. 1.4 metagame loop concretion (2026-07-23)

The loop policy is deterministic and informational: round 0 is byte-identical
to the v1 static-field craft, then up to four best-response rounds run by
default. Round 0 uses the v1 seed directly; later rounds use a distinct
persona-and-round-derived craft seed.
Each round updates all selected personas simultaneously from the prior
round's retained lists. Stability means every deck is byte-for-byte unchanged
from the prior round. A non-adjacent repeated deck is an oscillation finding;
the loop stops immediately and records the persona, its first-ever occurrence
round, repeat round, and the period since its most recent occurrence. If
neither condition occurs, the artifact reports the round-cap finding.
`--rounds` changes only the deterministic cap.
