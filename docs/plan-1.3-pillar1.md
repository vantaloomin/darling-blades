<!-- source-of-truth: docs/plan-1.3.md, src/meta/gauntletSeed.ts, src/ai/personality.ts, src/meta/SaveManager.ts, src/data/opponents.ts, scripts/balance-matrix.ts · last-verified: 2026-07-20 · concretion of Pillar 1 — APPROVED 2026-07-20 (all five flags at recommended) and BUILT: headless core + scene wiring shipped on this branch; measured ladder stamped in src/ai/tiers.ts; the 16-floor re-baseline (section 4) awaits the Pillar 0 merge -->

# 1.3 Pillar 1 concretion - seeded daily tower rotation with floor-scaled AI

Concretizes plan-1.3.md Pillar 1 against the real code (2026-07-20).
Locked upstream: FULL random shuffle from the daily seed; the floor sets
the brain, the avatar brings its deck and personality flavor; rewards
stay positional. Everything below is the proposed how; flagged items
need the user before the build starts.

STATUS 2026-07-20: all five flagged decisions were answered at the
recommended option (six tiers; the decision-noise decorator; legacy
runs finish on the old fixed roster; today-only roster preview; the
dial is tower-only). The build shipped on this branch. The accepted
ladder moved T3/T4 off the starting guesses: T3 medium/0.32, T4
medium/0 (measured at 80 seeds/cell after 40-seed runs flip-flopped a
4pp boundary; medium responds shallowly to noise below ~0.3). Section 4
remains open until Pillar 0 lands in release/1.3.

## 1. The strength dial: a seeded decision-noise decorator

Today three brains (Easy/Medium/Hard) band by fixed rung. Proposal: ONE
new mechanism, an `AIPlayer` decorator that with probability `p`
replaces the chosen action with a uniformly random legal action drawn
from the same seeded rng stream. Tiers become (brain, p) pairs:

| Tier | Brain | noise p (starting guess) |
| --- | --- | --- |
| T1 | Easy | 0.35 |
| T2 | Easy | 0.10 |
| T3 | Medium | 0.20 |
| T4 | Medium | 0.05 |
| T5 | Hard | 0.12 |
| T6 | Hard | 0 |

Why this dial and not a Hard search-budget throttle: it is one small
pure wrapper over all three existing brains (AI honesty and determinism
preserved for free — the decorator sees only the legal-action list and
the PlayerView-driven choice), it grades Easy and Medium too (a budget
dial only grades Hard), and it is measurable per (brain, p) cell with
the existing matrix harness. The negative-result ledger in
determinize.ts stays untouched.

The p values are STARTING GUESSES. Measurement protocol
(instrument-then-hypothesize, playbook §6): matrix every candidate tier
vs the five reference starters at 40 seeds/cell; require a monotonic
average win-rate gradient T1 < T2 < ... < T6 with >= 4pp separation
between adjacent tiers; iterate p until monotonic; date-stamp the
accepted ladder next to the tier table in opponents.ts. Floors then map
to tiers in a FLOOR_TIERS table (floors 1-16 over T1..T6; roughly
floors 1-3 T1, 4-6 T2, 7-9 T3, 10-12 T4, 13-15 T5, 16 T6 — measured,
not asserted).

## 2. Daily seed and roster derivation

`daySeed(dateKey)`: splitmix-style avalanche of the local YYYYMMDD
integer through the existing 31-bit clamp (gauntletSeed.ts owns it, same
purity rules). Roster = Fisher-Yates over the 16 avatars driven by the
engine's seeded rng from daySeed. Full shuffle, no constraints (locked).
The run's duels keep deriving per-rung seeds exactly as today; only the
avatar-to-floor assignment rotates daily.

## 3. Save schema: ONE v22 bump shared with Pillar 2

`SaveData.version` 21 -> 22:

- `gauntlet.run` gains `{ rosterDay, rosterSeed }` stamped at run
  start; an active run keeps its roster across reloads and midnight.
- The SAME migration adds Pillar 2's per-deck land-style field
  (SavedDeck, absent = default art), so 1.3 ships one migration, one
  migration test, not two.
- migrate() for a legacy in-flight run: stamp it with the legacy FIXED
  roster order under a sentinel day so it finishes exactly as started.

## 4. Tower re-baseline (the big measurement pass)

RUNG_BANDS re-keys from "slot expects avatar X" to "floor expects tier
strength Y" (FLOOR_BANDS). The whole 16-floor tower re-measures in one
pass, folding in the parked prefab tuning (Questing Table 24.4%, Wild
Communion 39.7% on the 2026-07-17 Hard round-robin) and the removal
answer cycle now in the pool. Win-rate floors set fresh from these
measurements (ratchet discipline; honest residuals recorded).
`gauntletRungGold` stays positional, untouched.

## 5. Flagged for the user before the build

1. **Tier count six** (three brains x two noise levels) - or five/seven?
2. **The decision-noise dial itself** (recommended above) vs a Hard
   search-budget throttle vs hand-tuned personality sets per floor.
3. **Legacy-run migration**: finish the in-flight run on the old fixed
   roster (proposed) vs re-roster it on first load after update.
4. **UI surface**: does the tower screen show today's roster before a
   run starts (cheap, recommended), and is tomorrow's hidden (yes,
   proposed)?
5. Practice mode and prefab opponents are untouched by the dial (
   proposed; the tiers exist only for tower floors).
