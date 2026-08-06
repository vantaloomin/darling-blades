<!-- source-of-truth: docs/plan-1.6-draft.md, docs/plan-1.5.5.md, docs/plan-battle-box.md, docs/plan-darlings.md, src/config/rules.ts, src/meta/warchest.ts, scripts/balance-matrix.ts · last-verified: 2026-08-06 · program doc — re-verify when the referenced code or plans change -->

# Darling Blades 1.6 — program plan

**Status 2026-08-06: OPEN, gated.** The train opened by owner decision
2026-08-06 in gated form: the parameter-independent lanes (priority-window
reopening, the deck-invalidation flag-and-fix flow, Premium UX Wave B)
start immediately; every lane that does balance work on the reserve field
(the migration deck redesigns, the sprinkle wave, the large set) is
blocked behind the **Warchest format-parameter gate** below. Scope and
sequencing graduate from [plan-1.6-draft.md](plan-1.6-draft.md), which
remains the fuller reference for wave details and the mechanic-reuse
audit.

## The north star (owner-ratified 2026-07-31, unchanged)

**Warchest becomes THE mana system of Darling Blades.** 1.5.5 revealed
Warchest and Darlings on the reserve system; 1.6 launches Warchest
everywhere and classic constructed retires. There is deliberately no
dual-balance era, and all 1.6 balance work happens **once**, on the
reserve field. That "once" is exactly why this train opens gated: the
reserve field's own parameters are under review, and re-baselining twice
would break the ratified principle.

## The Warchest format-parameter gate (blocks all reserve-field balance work)

Playtest feedback (owner, 2026-08-06) surfaced three structural concerns
with the shipped Warchest constructed format:

1. **Hand clog**: with every draw live, the inherited 7-card opening hand
   and 7-card max produce cleanup discards for non-aggro decks, slow the
   game, and hand graveyard-recursion decks (retell, reclaim) free fuel.
   Proposed lever: a smaller per-format opening hand (test 5 before 4).
2. **Dilution**: 50 no-land cards is +14 spells over a classic deck's ~36
   live cards; 40 is +4. Proposed lever: 40-card Warchest decks.
   (The 50-card size was owner-locked 2026-07-28; the owner reopened it
   with this feedback, so revisiting it is legitimate.)
3. **Five-color pull**: unrestricted reserve colors plus a guaranteed
   land drop delete the consistency cost of splashing, so the format's
   equilibrium is a five-color goodstuff pile. Candidate levers, in
   preference order: a reserve color cap (deck must fit the reserve's
   colors), a lower dual cap, or embracing the pile identity.

The gate resolves in three steps:

- **Telemetry instrumentation** (in flight on `feat/warchest-telemetry`):
  a pure `GameTelemetry` event-stream collector plus a
  `balance-matrix.ts --telemetry` mode measuring cleanup discards,
  hand-clogged turns, game length, graveyard-fuel provenance, dead-weight
  draws, seed-to-seed win-rate variance, color-stranded turns, tapped-land
  tempo loss, reserve exhaustion, and mulligan impact.
- **Tuning matrices**: dated runs at 50/7 (current), 40/5, and 40/4, with
  and without a reserve color cap, plus color-count test decks (mono
  through five-color) to price the splash incentive. Requires small
  sim-only variant-rules plumbing (per-format hand/deck size and reserve
  color cap behind the existing rules-level format flag).
- **Owner ratification** of the final deck size, opening-hand size, and
  reserve color rule. Only then does the migration lane open, so its
  re-baseline happens once, on the ratified parameters, together with the
  priority-window re-baseline.

Gate output: three ratified numbers/rules recorded here and in
[rules.md](rules.md), and the migration lane unblocked.

## Lanes open now (parameter-independent)

1. **Priority-window reopening - IMPLEMENTED 2026-08-06.** Current rules
   revision 2 re-offers bounded response windows after paid combat/end-step
   flushes when the non-active player has a castable Charm. Replay v7 selects
   the new path; v6 remains stream-exact under preserved revision 1. AI
   determinization carries the revision, and the tutorial is pinned to rev 1.
2. **Deck-invalidation flag-and-fix flow**: the current boot path PRUNES
   invalid decks and resets `activeDeckId`; replace it with a
   flag-and-fix flow (decks preserved and flagged, never deleted; a
   warning routes to the Deck Builder). The 1.6 migration invalidates
   every player-made classic deck, so this flow is its prerequisite and
   is correct regardless of the gate's outcome.
3. **Premium UX Wave B** (presentation-only, parallel with engine work):
   carry-cast phase 1 on the shared CastIntent state, Card Atelier,
   Versus bumpers, Trophy Hall S. Details live in the local-only,
   gitignored `plan-premium-ux.md` (copy it forward between worktrees).

## Lanes gated behind the parameter gate

4. **The migration**: starters, all 20 avatar decks, and Draft redesigned
   reserve-native; the land-fetch card class redesigned; land cards'
   economy/collection treatment decided (pack slots, land styles,
   existing collections never clawed back); the flag-and-fix flow wired
   to the format switch; classic retires.
5. **Keyword sprinkle wave + returning-mechanics quota** (rides the 1.6
   balance pass; audit table in the draft doc).
6. **Cosmetics layer** (card backs, playmats) — sequenced before Courts.
7. **The first large set (~240-250 cards), reserve-native from
   concretion**, candidate rider: the Dark Tales companion wave (~60).
8. **Premium UX Wave C + Courts**, then the **small-debts batch** (Limited
   retune, modalShell dismiss consolidation, scoreLand rider credit, the
   1.6 dup-audit adjudication, Fogbell Chime redesign, Laughing Pooka /
   Wolfsbane Ward watchlist, metagame deep sweep once the reserve field
   stabilizes).

## Open decisions

- The format-parameter gate itself (deck size, hand size, color rule) —
  owner ratifies after the tuning matrices.
- Draft's reserve-native design (the hardest migration sub-problem).
- Land cards' economy/collection treatment post-migration.
- Whether starters auto-convert at migration or use the fix-it flow.
- The large set's theme and concretion gate.

## Non-goals

Until the migration lane opens, classic constructed is untouched: same
decks, same in-deck lands, same balance baselines. No classic-pool card
changes are justified by reserve-format measurements. The curated
Darlings rival ladder remains explicitly not promised.
