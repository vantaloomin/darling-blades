<!-- source-of-truth: scripts/progression-sim.ts, scripts/balance-matrix.ts, src/config/rules.ts, src/meta/Economy.ts, src/meta/Limited.ts, src/meta/Collection.ts, src/meta/Quests.ts, tests/meta/progressionSim.test.ts · last-verified: 2026-07-16 · design/plan doc — re-verify when the economy code or harnesses change -->

# Economy testing at scale — plan

> **Status (2026-07-15, same day):** Phases 0 and 1 SHIPPED as two
> concurrent Codex streams (disjoint file sets, orchestrator-verified).
> The sim is draft-only on the real `scorePick`/`DEFAULT_PICKER` with
> persona-Personality opponents, Premium Draft (real
> `payPremiumDraftEntry` + `grantPremiumDraftPool`), and shard income;
> `src/meta/economyModel.ts` ships the EV surface + 4 hard invariants
> (computed full-completion pack dupe-EV: **67.5g** — the ≈68g claim
> verified). **Phases 2a, 2b, and 3 ALL SHIPPED 2026-07-15** (2a:
> baseline + dashboard; 2b: the locked decisions as CI gates — Layer-1 EV
> inequalities, coarse CI-fast bands, `--check` with flag-only fine bands,
> the date-stamped baseline table next to `ECONOMY`, and a dynamic-policy
> seam; 3: the greedy g/min optimizer + cap gate + named exploit
> regressions, which surfaced the premium shard-farm finding below).
>
> **TUNING PASS SHIPPED 2026-07-16 — the plan is complete.** The knobs were
> chosen by measurement (a 12-candidate sim sweep at 4 seeds × 60 days, then
> a 9-config finalist sweep at 6 seeds × 75 days; harness committed as
> `scripts/tuning-sweep.ts`, experiment knobs in the sim) and picked by the
> user (2026-07-16, locked):
>
> 1. **Premium weekly allowance — 2 entries per UTC week**
>    (`ECONOMY.premiumWeeklyCap`, `premiumEntryStatus` /
>    `payPremiumDraftEntry(save, today)`, persisted as
>    `limited.premiumWeek`, **SaveData v18 → v19** with migration + tests).
>    Measured: Limited Fan 35.38 → **18** premium runs/60d with collection
>    HELD at 97.3% (crafting compensates); first premium stays day 3. The
>    2-day/3-day cooldown shapes measured nearly identical; weekly allowance
>    chosen for player feel (burst-friendly quota).
> 2. **Premium runs pay no run-end gold** (`applyLimitedMatchResult`; the
>    1,000g entry buys the 45 kept picks; free-draft payouts untouched).
>    The only lever that closes the premium shard-farm: mean 1,127.5g →
>    **827.5g** vs the 1,000g entry (max 1,295g — a one-off jackpot, not a
>    repeatable cycle; the hard gate in exploits.test.ts asserts the mean,
>    and the old `it.fails` pin is FLIPPED). The measured-weak alternative
>    (`limitedRunGold` trim −40%) left the farm at 1,007g and moved global
>    generosity not at all, so `limitedRunGold` stays [40/100/180/300].
>    Consequence recorded honestly: the decision-1 clause "successful
>    Premium ≥ 1.35× practice" as a GOLD faucet is intentionally void
>    (premium's value is cards now); that inequality was removed from
>    economyGates.test.ts. The gauntlet lead gate is intact and easier
>    (measured ratio 1.32× → 2.488× against the unchanged 1.20× floor).
> 3. **Shard-crafting catch-up — craft one plain copy of any wholly
>    unowned collectible at 6× its dupe value** (`ECONOMY.craftCostMult`,
>    `craftCard`/`craftCost` in Collection.ts; Craft chip in the Collection
>    inspect, honoring `confirmDestructive`). Fixes the measured ~90%
>    pack-route asymptote: finalist sweep (75d × 6 seeds) puts Hardcore
>    Optimizer completion at **day 68 median (4/6 seeds)** and
>    Completionist at day 63.5 (6/6) — inside the locked 50–75-day window.
>    K=10 measured too stingy (0/6 complete by d75); craft-then-shard is
>    gate-pinned gold-negative at every tier.
>
> Post-tuning canonical baseline (10×8×60, daily snapshots) is date-stamped
> beside `ECONOMY` in rules.ts; the dashboard Artifact is refreshed from it
> (generator: `npx tsx scripts/econ-dashboard/prep-baseline.ts report.json
> data.js`, then inline into `dashboard-template.html` at `/*__DATA__*/`).
> Known accepted properties (adversarially reviewed, 2 dimensions + probes,
> zero confirmed findings): a clock rollback can re-mint the weekly
> allowance (same clock-trust posture as dailies/streaks — spending, not a
> faucet); the farm max (1,295g) stays above entry on jackpot seeds while
> the EV gate holds; hub pay-before-start would strand 1,000g only if the
> booster pool emptied (impossible with the shipped CARD_DB — revisit if
> set-filtered drafts ever ship).
>
> Remaining follow-ups live OUTSIDE this plan: the quest claim-rate spread
> (41–89%, its own item) and the visual by-eye pass of the new hub/craft
> copy (flagged; hidden-pane screenshots time out).

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

## Decision points — RESOLVED (user calls 2026-07-15, locked)

1. **Faucet ordering (gold income):** Full Gauntlet Run >>> FULL (successful)
   Premium Draft >> Practice >= Free Draft > FAILED Premium Draft. The ">>"
   marks are intent about magnitude gaps, not just order.
2. **Free-draft farmability bound:** free draft gold/hour <= 1.0x practice
   grinding (per the ordering + accepted recommendation).
3. **Premium value:** a fully successful premium run's total gold value stays
   BELOW a full gauntlet clear (2,170g). Onboarding note (user): a fresh
   player should reach their first 1,000g premium entry "semi-quickly"
   through daily quests + achievements — days-to-first-premium is a tracked
   baseline metric for the new-player personas.
4. **Premium gate axis:** gate on new-uniques per gold; shard-value reported
   advisory (default accepted).
5. **Completion targets:** a hardcore grinder completes a standard collection
   (one of each card) in 50-75 days; a full casual who cannot beat the
   gauntlet lands near 50% on the same horizon. Tuning edges toward a
   friendly economy, never overpowered.
6. **Benchmarks:** headline checkpoints at 1/7/14/30/45/60 days covering
   completion, gold income (by source), packs opened, rarity-tier
   acquisition rates, and any other graph-worthy series; the baseline run
   snapshots daily so the site can draw full curves.
7. **Optimizer cap (Phase 3):** greedy optimizer <= 1.5x the best honest
   persona (default accepted).
8. **Sequencing:** baseline FIRST, presented as a standalone, filterable,
   professional data-insights website; gates and tuning are decided from
   that view. Phase 2 therefore splits: 2a = metrics + full matrix +
   dashboard (now); 2b = gates (after the user reviews the data).

> **Phase 2a SHIPPED (2026-07-15).** The sim snapshots per-rarity owned
> uniques; the full 10 personas × 8 seeds × 60 days matrix ran with DAILY
> snapshots (9.4 MB report, ~50 min detached); the dashboard is published
> as a private Artifact and its generator is repeatable in-repo:
> `npx tsx scripts/progression-sim.ts --seeds 8 --days 1,…,60 --json >
> report.json`, then `npx tsx scripts/econ-dashboard/prep-baseline.ts
> report.json data.js`, then inline `data.js` into
> `scripts/econ-dashboard/dashboard-template.html` at the `/*__DATA__*/`
> marker. Headline baseline findings: Limited Fan reaches 97% collection
> by day 60 on 35 premium drafts with only 4 boosters ever bought (first
> premium entry: day 3 median) — premium dominance confirmed in play, not
> just in EV; casual personas land 53–57% (on the ≈50% target); Hardcore
> Optimizer reaches 90% (slightly behind the 50–75-day completion window);
> harness verdict UNEVEN (median 1.22 packs/day, 80% median collection is
> high; quest claim rates spread 41–89% by deck/style).

> **Tuning direction — SET (user calls 2026-07-15, post-baseline review):**
> the pass is led by a **premium-draft frequency limiter** (the baseline
> indicts the run *rate* — 35 premium runs in 60 days — not the per-run
> experience; `premiumDraftEntry` stays at 1,000g so first-premium
> onboarding keeps its day-3 median), with a **`limitedRunGold` trim** as
> the second lever for the global generosity reading (1.22 packs/day
> median, ~80% median collection at day 60). The Hardcore-Optimizer
> completion gap (90% at day 60 vs the 50–75-day window) waited on a
> completion-curve slope check from the daily-snapshot baseline —
> **measured 2026-07-15 (8 seeds, daily snapshots): the window is missed
> badly, not slightly.** Hardcore Optimizer gains only ~0.68 new
> uniques/day over days 55–60 and decelerating (313/349 at day 60, 36
> missing); linear extrapolation puts completion past day 110, and the
> true curve is convex (each remaining unique is rarer). The pack-only
> route asymptotes near ~90%: Hardcore Optimizer and Completionist run 0
> premium drafts and open 137–144 packs to reach 90–91%, while Limited
> Fan reaches 97% on 35 premium runs and 3.6 packs — picked cards, not
> pack rolls, are the only working late-game unique source. A late-game
> catch-up mechanism (e.g. shard-crafting a chosen card) is therefore ON
> the tuning-pass agenda, and matters more once the premium limiter
> lands, since the limiter also drags the one persona that currently
> completes fastest. **Also on the agenda — a measured live finding from
> the Phase-3 exploit probes (2026-07-15, 10 seeds): the premium-draft
> shard-farm.** A finished collector (plain playsets) who drafts premium
> purely for melt value realizes a mean 1,127.5g / max 1,595g against the
> 1,000g entry with a best-record run (~827.5g melt + 300g run gold) —
> net-positive, violating the endgame no-gold-positive-cycle principle,
> though unattractive as a faucet (~2.3 g/min vs practice ~6) and
> net-negative on a failed run. Pinned as `it.fails` in
> tests/meta/exploits.test.ts; the `limitedRunGold` trim shrinks it
> directly, and the tuning pass should re-measure and flip the test to a
> hard gate once closed. The quest claim-rate spread (41–89% by
> deck/style) is explicitly OUT of this pass: it is a quest-pool fairness
> design item, tracked separately. Exact constants/mechanics are decided
> at tuning time against the Phase 2b gates.

## Design decisions this plan needed (original list, kept for context)

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
