<!-- source-of-truth: docs/roadmap.md, docs/rules.md, src/data/opponents.ts, src/config/rules.ts, src/meta/Economy.ts, src/meta/variants.ts, scripts/balance-matrix.ts, scripts/progression-sim.ts, scripts/personas/craft.ts, scripts/personas/decks/2026-07-21-weenie-all.json · last-verified: 2026-07-26 · design/plan doc - re-verify when the referenced code changes -->

# Dark Tales power and crafting-price pass

## Goal

Release 1.5 pays down two measured balance debts without hiding them behind broad buffs: Midnight Storybook finished the retained Dark Tales pass at 30.5% over 13,500 games at 300 seeds per cell, while the retained all-pool go-wide artifact measured 78.1% over 1,500 games and 72.7% in its worst 150-game matchup. The same release answers whether `craftedUniques = 0.0` across the dated 10-persona, 8-seed, 60-day progression baseline is healthy intent or a crafting-price defect. Changes ship only from controlled candidate matrices and progression comparisons.

## Non-goals

This is not a promise to force every deck to 50%, homogenize archetypes, lower an existing gate, or change several systems until a favored result appears. It does not infer a crafting conclusion from zero uses alone, and it does not treat the metagame hill climb as a trusted product gate before its outputs are reviewed. Cosmetics, Darlings rules, and new Dark Tales mechanics are outside this pass.

## Player-facing spec

Players see only retained card text, costs, starter or opponent list changes, and any crafting price that survives measurement. Patch notes name the purpose in game vocabulary:

> Midnight Storybook now has more room to set up Skim and Retell turns. Fast go-wide decks give slower rivals a fairer chance to answer. Crafting prices were reviewed against full 60-day collection runs.

That copy is a template, not approval of a particular buff or price cut. It may ship only when the retained patch actually supports every sentence. Card text keeps original Darling Blades names such as Skim, Retell, Sever, Foresee, and marks. No player-facing note cites internal persona labels, test seeds, or a target the patch did not reach.

## System touchpoints

### Engine

Prefer data-only cost, stat, count, or list changes. A rules or effect-operation change is allowed only if every data-only candidate fails and a separate engine-first specification proves deterministic ordering. Any engine candidate touches `src/engine/Game.ts`, `src/engine/types.ts`, or effect interpreters only through an executable rules test. The pure engine, seeded RNG, and replay compatibility contract remain intact.

### Meta, save, and economy

Craft price candidates live in the canonical economy constants used by `src/meta/Economy.ts` and must stay consistent with sharding and the variant multipliers in `src/meta/variants.ts`. Existing collection, gold, and crafted cards are never retroactively clawed back. A price change alone needs no save field. If the team chooses a one-time rebate, that is a separate reward ledger requiring an idempotent save field, a version bump, migration, and test; it is not silently included here.

### AI

The rule brains do not learn a new mechanic for data-only tuning. Every changed card and prefab still needs to be understood by the current value, target, and rollout paths through `PlayerView`. If Midnight is strengthened through a sequencing-sensitive list change, inspect hard-AI decisions in replay logs before trusting aggregate wins. The craft harness's six templates and hill climb are useful adversaries, not proof that a human-readable deck is healthy.

### UI scenes

No new scene is required. `src/scenes/ShopScene.ts`, crafting controls in collection/deck surfaces, rules text, and patch-note surfaces update only if the retained candidate changes displayed prices or card definitions. Confirm buttons show the final price from the same economy function that performs the transaction.

### Tooling and invariants

`scripts/balance-matrix.ts` is the primary duel measurement tool. `scripts/progression-sim.ts` is the primary economy measurement tool. `scripts/personas/craft.ts` supplies the retained go-wide artifact and the metagame sweep. Preserve opponent baseline comments in `src/data/opponents.ts`; never replace a dated baseline without the command, seeds, game count, candidate diff, and retained/rejected result. Gates only ratchet upward, Node-worker speed is not a gameplay result, and AI never reads hidden engine state.

## Save-schema impact

No schema bump is planned. Retained card/list/cost constants apply prospectively to a v22 save. The migration sketch is therefore `none`.

If the user selects a rebate, add exactly:

```ts
economyGrants: {
  craftingReprice1Claimed: boolean;
};
```

That alternative requires the next SaveData version, migration default `false`, a one-time deterministic eligibility calculation, and tests proving reload cannot duplicate gold. It should be avoided unless the measured price change is large enough that prior purchasers are materially disadvantaged.

## AI and balance impact

Three dated facts anchor this pass:

- Midnight Storybook: 30.5%, 300 seeds per matchup cell, 13,500 games, improved from 6.7% but below the requested 40% to 55% band.
- Retained all-pool go-wide artifact `2026-07-21-weenie-all.json`: 1,172 wins in 1,500 games, 78.1%, zero draws, with a worst matchup of 109 wins in 150 games, 72.7%. The prior reference was 77.6% aggregate and 73% worst.
- Post-Dark-Tales progression: 10 personas times 8 seeds times 60 days, 4,800 day snapshots; day-60 medians were 60.2665% collection and 1.2167 packs per day, with `craftedUniques = 0.0` for every persona.

The isolated Dark Tales sweeper experiment is negative evidence, not a recommendation: changing the sweeper from `5B` to `4B` and placing two copies in Midnight moved a 60-seed probe from 34.3% to 33.3%, so it was not retained.

Candidate protocol:

1. Freeze the current decks and seed schedule as control.
2. Change one coherent lever per candidate: Midnight list/cost package, go-wide answer density or list package, or crafting multiplier.
3. Run quick directional probes, then the full relevant baseline before retaining.
4. Inspect matchup distribution, draws, turn length, and replay examples. An aggregate improvement that creates a hard inversion is rejected.
5. Run cross-checks after combining independently retained candidates.

Commands:

```text
npx tsx scripts/balance-matrix.ts --prefabs --ai hard --seeds 300
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
npx tsx scripts/progression-sim.ts --seeds 8 --days 60
npx tsx scripts/progression-sim.ts --seeds 8 --days 60 --crafting --craft-cost-mult <K>
npx tsx scripts/personas/craft.ts --all --pool all --field prefabs --seeds 150 --iterations 80 --seed 20260720 --workers 14
npx tsx scripts/personas/craft.ts --metagame --all --pool all --field prefabs --seeds 150 --iterations 80 --rounds 4 --workers 14
```

The exact outcomes for every new candidate are `TO MEASURE` with those commands. The metagame mode is now measured 4.61x faster at 14 workers, but its deck-quality results remain informational until a dated review promotes a gate. Do not set the new crafting multiplier `<K>` by intuition; compare a user-approved candidate set and include gold balances, collection progress, packs per day, crafted uniques, and persona spread.

## Phased implementation plan

### Wave 1: reproducible debt board

Codify the three anchors, exact fixtures, and commands in a dated working artifact; replay representative Midnight and go-wide games; classify loss/win causes. No gameplay change ships. Verification: reproduce the named baselines or document drift before proceeding, run focused harness tests, then lint and docs checks.

### Wave 2: isolated gameplay candidates

Test small Midnight and go-wide packages independently. Retain at most one coherent package for each debt, with before/after matrix files and no lowered floors. Verification: targeted probe, full 300-seed prefab matrix, avatar matrix, floor matrix, full Vitest, build, lint, and replay spot checks.

### Wave 3: crafting-price decision

Run the canonical progression baseline plus each approved multiplier candidate. If no candidate improves meaningful crafting use without breaking the established collection and pack cadence, retain the current price and document the zero as intended behavior or redesign crafting in a later economy pillar. Verification: progression simulator unit tests, full 10-by-8-by-60 runs for control and candidates, diffed output, full Vitest, build, lint, docs.

### Wave 4: combined regression and publication

Combine only retained changes, rerun duel and progression controls, update dated baseline blocks, and write exact patch notes. Verification: all named matrices, canonical progression simulation, informational metagame sweep, full Vitest, build, lint, docs anti-rot checks. Any material regression sends only the responsible candidate back, not the whole pass.

## Open decisions for the user

- **Midnight target:** keep the historical 40% to 55% requested band as a release requirement, or accept a smaller measured gain with healthy matchup spread. **Recommendation:** keep the band as direction, but retain the best non-distorting candidate and document any remaining debt honestly.
- **Go-wide response:** weaken the crafted list, strengthen multiple prefab answers, or do both in small amounts. **Recommendation:** improve broadly useful answer density first; directly weaken the list only if the same artifact remains dominant.
- **Crafting intent:** crafting should be a frequent collection tool, an occasional bad-luck valve, or an endgame sink. **Recommendation:** choose occasional bad-luck valve, then measure prices against that behavior rather than optimizing for a nonzero count alone.
- **Craft price candidates:** select the multipliers to compare against the current value of 6. **Recommendation:** approve a narrow candidate sweep around the current value before any UI promise.
- **Rebate policy:** no retroactive compensation, or one idempotent grant if prices fall materially. **Recommendation:** no rebate for a modest change; require a separately specified grant for a large change.

## Risks and dependencies

Small samples can reverse, aggregate wins can hide polar matchups, and tuning two sides at once can erase causal evidence. Crafting use is coupled to pack income, collection completion, persona goals, variant sharding, and deck desirability; `craftedUniques = 0.0` alone does not prove price is wrong. This plan depends on the current dated baselines in `src/data/opponents.ts`, the canonical progression block in `scripts/progression-sim.ts`, and the retained craft artifact. Darlings (`docs/plan-darlings.md`) and Core Set II (`docs/plan-core-set-2.md`) must consume the retained 1.5 baseline rather than retune it concurrently. Suggested Decks (`docs/plan-suggested-decks.md`) must not train its recommendations on a transient candidate field.

## Acceptance criteria

- Every retained gameplay change has control and candidate outputs with exact commands, seeds, cell/game counts, matchup distribution, and replay spot checks.
- Midnight's final measured result is published; if it remains outside 40% to 55%, the release notes say so and preserve the remaining debt.
- The go-wide artifact's aggregate and worst-matchup results are remeasured, with no hidden hard inversion and no existing floor lowered.
- Craft price is either retained with an explicit product rationale or changed after full control/candidate progression runs; `TO MEASURE` is replaced by dated results.
- The avatar matrix and floor matrix pass after the combined patch.
- Save version remains unchanged unless the user separately approves a rebate ledger, in which case migration and idempotency tests pass.
- Player-facing notes describe only changes actually retained and contain no em dash.

