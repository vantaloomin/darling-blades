<!-- source-of-truth: scripts/progression-sim.ts, scripts/balance-matrix.ts, src/config/rules.ts, src/meta/Economy.ts, src/meta/Limited.ts, src/meta/Collection.ts, src/meta/Quests.ts, tests/meta/progressionSim.test.ts · last-verified: 2026-07-15 · design/plan doc — re-verify when the economy code or harnesses change -->

# Economy testing at scale — plan

> **Status (2026-07-15, same day):** Phases 0 and 1 SHIPPED as two
> concurrent Codex streams (disjoint file sets, orchestrator-verified).
> The sim is draft-only on the real `scorePick`/`DEFAULT_PICKER` with
> persona-Personality opponents, Premium Draft (real
> `payPremiumDraftEntry` + `grantPremiumDraftPool`), and shard income;
> `src/meta/economyModel.ts` ships the EV surface + 4 hard invariants
> (computed full-completion pack dupe-EV: **67.5g** — the ≈68g claim
> verified). Next: Phase 2 (baseline + gates) needs the doc's decision
> points 1–2; Phase 3 needs Phase 1 (done).

_Authored 2026-07-15 (user-directed). This is the instrumentation half of the
1.1 Limited economy tuning pass: build the measurement + regression layer
FIRST, then turn the knobs against it (playbook §6:
instrument-then-hypothesize). Tuning decisions themselves are out of scope
here — this plan produces the instruments and the gates._

## Why now

The economy has three open, player-facing questions (plan-v1.1-post-launch
Feature 5) and no automated guardrails around any of them:

1. **Free Draft pays `limitedRunGold` [40/100/180/300] on a free entry.** A
   measured 2-persona smoke run (1 seed × 7 days, 0.8 s) already flags it:
   the Limited Fan persona reaches 1.00 packs/day vs 0.43 for non-Limited
   personas — the harness's own "Free Limited is ahead" verdict, confirmed
   live before any tuning.
2. **Premium Draft: 1,000g buys ~45 kept cards + the same run gold**, versus
   three 450g boosters = 27 rolls. Priced by user direction; needs a measured
   value comparison before revisiting.
3. **Nothing gates regressions.** `tests/meta/progressionSim.test.ts` pins
   determinism and the persona roster shape only — no economy number anywhere
   fails CI if a change makes a faucet 3× too generous.

## What exists (the foundation is good)

- **`scripts/progression-sim.ts`** — 10 scripted personas playing the real
  engine + AI + meta reward systems over simulated days, with a per-source
  reward ledger (practice/gauntlet/limited/firstWin/streak/daily/
  achievements/dupes), a spend ledger, a minutes-based time model, and an
  advisory prose verdict. Deterministic by construction. Fast: ~0.02 s per
  simulated game (measured 2026-07-15).
- **`scripts/balance-matrix.ts`** — the pattern to copy for heavy runs:
  deterministic per-cell seeds, FLAGS against guidance bands, a date-stamped
  baseline comment living next to the data it describes, and a skipped
  vitest suite sharing the code path.
- **The pack Monte-Carlo precedent** (2M-pack DROPS verification, 2026-07-10)
  for closed-form-vs-simulated cross-checks.

## Harness debt to clear first (Phase 0 — prerequisite)

The sim predates the 2026-07-14 Limited rework. Before any gate is trusted:

- **Sealed is still simulated** (`startSealedRun`, `mode: 'mixed'`) — Sealed
  is cancelled outright; the sim must go draft-only or its Limited numbers
  describe a mode players can't reach.
- **The sim's human drafter is a stale third copy** of the pick heuristic
  (`chooseDraftPick`/`draftScore` inline). Replace with the real
  `scoreDraftPick`/`DEFAULT_PICKER` from `src/meta/draftPicker.ts` — the
  lockstep-pinned scorer the game actually runs. Optionally add a
  skill spread by piloting picks with different `PickerProfile`s.
- **Opponent fidelity**: `limitedDuelData` already hands the sim
  persona-drafted opponent pools; the sim builds the opposing brain without
  the persona's `Personality`, though — wire it through so match difficulty
  matches the live game.
- **Premium Draft doesn't exist in the sim.** Add it: `payPremiumDraftEntry`,
  variant-rolling packs, the 45 kept picks granted via `Collection.addCard`
  at completion. Without it, question 2 above can't be measured.
- **Manual shard income isn't modeled** (`shardExcess` exists since v6; the
  Collector persona should sell beyond-playset specials).

## The three layers

### Layer 1 — analytic EV suite (pure, milliseconds, always in CI)

Closed-form or small-Monte-Carlo expected values with NO engine matches —
pure functions over `ECONOMY`, `DROPS`, and the card pool, in a new
`src/meta/economyModel.ts` (headless, unit-tested like `deckStats`):

- **Pack EV curve**: expected dupe refund per 450g pack as a function of
  collection completion (the rules.ts comment claims ≈68g at full
  completion — turn the claim into a computed, asserted number).
- **Run EVs**: free draft (0 entry → record-distribution-weighted
  `limitedRunGold`), premium draft (−1,000 + kept-card value + run gold),
  gauntlet climb (rung gold + completion bonus weighted by measured
  win-rate bands, including the loss-resets-run risk), practice
  (win/loss gold + first-win + streak amortization), daily quest ceiling
  (3 × 50 + streak table).
- **Card-value model** (the one genuinely new design piece): to compare
  "45 kept cards" against "27 booster rolls" both convert to a common unit —
  report BOTH new-unique-count EV and shard-value EV at several completion
  levels, so the premium question gets a two-axis answer instead of a fudged
  scalar.
- **Hard invariants as unit tests** (examples; all ratchet-up):
  - No pack-opening sequence is gold-positive at any completion level (the
    sim's inline guard, promoted to a real test).
  - `buyThemeDeck` + shard-everything-granted round trip is strictly
    gold-negative for every SKU.
  - Practice losses before `minTurnsForLossGold` pay 0 (the concede-farm
    fix, pinned).
  - Expected plain-dupe refund per pack < pack price at 100% completion.

### Layer 2 — macro progression sim, modernized and gated

After Phase 0, promote the sim from advisory to gated:

- **CI-fast configuration** in vitest: ~4 personas × 2 seeds × 14 days
  (projected single-digit seconds from the measured 0.02 s/game; measure and
  state the real number before wiring). Gates are COARSE bands only — e.g.
  packs/day median within [0.5, 3.0], no persona's gold/game exceeding a
  stated multiple of the cohort median, quest claim-rate floor — so routine
  balance drift doesn't flap CI.
- **Full matrix as a script run** (the balance-matrix pattern):
  10 personas × 8 seeds × 60 days via
  `npx tsx scripts/progression-sim.ts --check`, FLAGS against the same bands
  plus the fine ones, and a **date-stamped baseline table committed next to
  `ECONOMY` in src/config/rules.ts** — refreshed after any AI/deck/economy
  change, exactly like the opponents.ts balance table.
- The prose verdict stays, but every sentence it can emit corresponds to a
  band that either gates (CI config) or flags (full matrix).

### Layer 3 — adversarial exploit probes

Scripted personas play fair; exploits don't. Two additions:

- **A greedy gold-per-minute optimizer persona**: each day it picks the
  action sequence with the best measured g/min from Layer 1's EV tables
  (not a fixed script), so if any faucet dominates, this persona finds and
  exercises it, and its divergence from the honest cohort becomes a gated
  metric: `optimizer g/min ≤ K × best honest persona g/min` (K to be chosen
  at baseline time).
- **Named exploit regression tests**, one per closed loophole and one per
  suspected loop, so they stay closed: concede-farm variants (practice AND
  the limited match path), free-draft spam as a pack-buying substitute
  (the question-1 farmability bound, expressed as g/hour vs practice
  grinding), retire-scumming (already blocked for familiarity; assert the
  economy side pays nothing), shard-loop searches (no buy→shard cycle is
  gold-positive — property-tested across all SKUs and variant tables).

## Design decisions this plan needs (user calls, marked)

1. **The intended faucet ordering.** The gates need a design statement of
   which mode SHOULD pay best per hour. Current documented intent: gauntlet
   full clear ≈ +40% over practice grinding (rules.ts comment). Where should
   free draft and premium draft sit relative to those? The instruments
   measure; the ordering is a taste call the tests then enforce as
   inequalities (robust to small drift, unlike absolute floors).
2. **Gate strictness in CI**: recommended split above (Layer 1 + coarse
   Layer 2 in CI; fine bands flag-only in the full matrix). Confirm or move
   the line.
3. **The card-value model weighting** for the premium comparison (report
   both axes, or pick one as the headline).
4. **Whether the tuning pass follows immediately** once baselines exist, in
   the same effort or a separate session.

## Sequencing

1. **Phase 0 — modernize the harness** (drop Sealed, real `DEFAULT_PICKER`,
   persona Personality, Premium Draft, shard behavior). Medium; touches only
   scripts/ + one new meta module; no engine surface.
2. **Phase 1 — Layer 1 EV suite** (`src/meta/economyModel.ts` + tests).
   Small, pure, immediately CI-gated; also produces the EV tables Layer 3's
   optimizer consumes.
3. **Phase 2 — run the full matrix, date-stamp the baseline, set bands**,
   wire the CI-fast Layer 2 gates with fresh measured numbers (never
   invented ones — §9 honesty).
4. **Phase 3 — Layer 3 optimizer + exploit regression tests.**
5. **Then the tuning pass** (separate, user-directed): adjust
   `limitedRunGold` / `premiumDraftEntry` / whatever the baseline indicts,
   re-measure, ratchet the gates to the new numbers.

Phases 0+1 are independent and can run as parallel workstreams (disjoint
file sets); 2 needs both; 3 needs 1.

## Explicitly out of scope

- Tuning any economy constant (that's the follow-up pass this plan arms).
- Auto-rebuilding constructed decks from opened packs inside the sim — the
  existing deliberate assumption stands so the measurement isolates reward
  pacing from deck-power snowball.
- Wall-clock realism: the minutes model stays a declared approximation.
