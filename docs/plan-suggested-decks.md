<!-- source-of-truth: docs/roadmap.md, docs/architecture.md, docs/ai.md, scripts/personas/craft.ts, scripts/personas/templates.ts, scripts/personas/score.ts, src/meta/DeckStorage.ts, src/meta/SaveManager.ts, src/meta/Replay.ts, src/engine/view.ts, src/scenes/DeckBuilderScene.ts, src/scenes/ProfileScene.ts · last-verified: 2026-07-26 · design/plan doc - re-verify when the referenced code changes -->

# Suggested decks and replay coach arc

## Goal

Release 1.6 ships Tutor v1: deterministic, collection-aware deck suggestions powered by the same greedy seed plus hill-climb engine currently exercised by `scripts/personas/craft.ts`. Release 2.0 extends that shared evaluation core into Coach v2, which annotates a completed replay with legal, redacted alternatives and concise reasons. Both features produce advice, never hidden-information advantages, and both must be fast enough for their actual client surface before being promised.

## Non-goals

Tutor v1 does not grant cards, spend gold, silently replace an active deck, promise a globally optimal list, or run the current Node worker pool unchanged in a browser. Coach v2 does not reveal the opponent's hand or deck, grade player identity, alter a completed result, or claim strategic certainty from one recommendation. Neither feature changes the duel AI merely because it shares scoring concepts with the persona harness.

## Player-facing spec

In 1.6, the deck builder adds `Suggest a deck`. The player chooses a style in Darling Blades vocabulary:

- `Fast pressure`
- `Hold the line`
- `Wear them down`
- `Return from the grave`
- `Go wide`
- `Balanced`

They may optionally choose colors and, for a Darlings deck, a Darling. The result screen shows a legal 60-card proposal using only owned non-basic copies, with basic lands supplied freely. It explains the broad shape with compact facts such as `24 lands`, `18 early plays`, `6 ways to draw`, and `Built from 47 cards you own`. Exact explanation metrics must come from deterministic classifiers, not generated prose.

The actions are `Save as new deck`, `Replace current deck`, `Try another seed`, and `Cancel`. Replacement uses the normal destructive-confirmation setting. A progress view can say `Building`, `Testing changes`, and `Finishing your list`; it must not show fake percentages. If the device budget expires, return the best legal candidate found so far and label it `Quick suggestion`.

In 2.0, a completed replay can open `Coach`. The timeline marks selected player turns and offers advice such as:

> Turn 6: Doom Bolt before combat kept your attack open.

> Turn 9: Holding one blocker reduced the strongest return attack.

Each note can reveal `What you played`, `Suggested line`, and `Why`. The coach may say `No clear change found`. It never shows an opponent card that was hidden at that decision time.

## System touchpoints

### Engine

Tutor v1 runs headless games through the existing pure `Game` API. Extract no browser or filesystem concerns into the engine. Coach v2 reconstructs replay state before a chosen human action, derives that seat's `PlayerView` and legal actions, and evaluates alternatives from that boundary. Although replay reconstruction internally knows full state, the coach input is the same redacted view and legal-action surface available to a brain. Seeded rollouts derive their seeds from the suggestion request or replay log plus decision index, never from wall-clock timing.

### Meta, save, and economy

Extract the reusable pure algorithm from `scripts/personas/craft.ts` into modules such as `src/meta/deckTutor/core.ts`, `templates.ts`, and `score.ts`; keep Node orchestration, files, CPU detection, and worker threads under `scripts/`. A browser worker adapter lives outside pure meta, for example `src/workers/deckTutor.worker.ts`. The core accepts a candidate card pool, per-card maximum counts, format validator, field decks, seed, iteration budget, and cancellation checks. The Node craft harness must import the same core after extraction so the two implementations cannot drift.

The player pool is exact: non-basic count limits come from `collection`, basic lands are unlimited, and tokens are excluded. Saving a result calls ordinary `DeckStorage` helpers. No cards are reserved, crafted, or purchased. Coach annotations are derived artifacts and are not economic state.

### AI

The six internal persona templates can remain burn, draw-go, attrition, reanimator, weenie, and midrange in code, while the UI maps them to original player vocabulary. The existing greedy quota builder and strictly improving hill climb are the engine. Before browser reuse, remove implicit filesystem/global catalog assumptions and make scoring inputs explicit.

Tutor quality is evaluated against current fixed fields without giving the algorithm hidden match state. Coach v2 needs a separate decision evaluator that accepts only `PlayerView`, legal actions, public history, and a deterministic rollout budget. It returns structured reason codes such as `preserve_blocker`, `use_mana`, `remove_before_combat`, or `avoid_overcommit`; UI owns wording. The live duel brains are unchanged unless a shared bug fix is separately proven through the AI gates.

### UI scenes

`src/scenes/DeckBuilderScene.ts` owns the request form, progress/cancel state, preview, legality explanations, and save/replace actions. A dedicated scene is optional only if the results do not fit the established overlay limits. `src/scenes/ProfileScene.ts` or the replay viewer owns Coach v2 entry and annotations. Worker messages are serializable data; Phaser objects never cross the boundary. Mobile layout follows `docs/plan-mobile-overhaul.md`.

### Tooling and invariants

Keep `scripts/personas/craft.ts` as the CLI and artifact writer, but route deck construction and scoring through the extracted core. Add golden tests showing identical candidates/scores for the old and new paths under fixed inputs before deleting duplicate logic. Add ownership, format, cancellation, timeout, and deterministic seed tests. Benchmark Node and each supported browser/device independently; the measured 4.61x metagame speedup at 14 Node workers does not predict a single browser worker. Engine and meta stay Phaser/browser-free; AI reads only `PlayerView`; tests do not import Phaser; balance floors only ratchet from dated evidence.

## Save-schema impact

No SaveData fields and no schema bump are required for the recommended design. Applying a suggestion creates or replaces an ordinary `SavedDeck`, which already persists the result. Style, seed, progress, and candidate scores are ephemeral request data. Coach annotations are recomputed from a stored/imported `ReplayLog` and are not saved.

If the user later asks to persist favorite tutor settings, add a single settings object in the next available schema rather than attaching opaque optimizer state to each deck. If annotations must be shareable, version them inside the replay/share envelope, not SaveData. Migration sketch for the planned releases is therefore `none`.

## AI and balance impact

Tutor v1 must remeasure legality, strength, diversity, stability, and runtime. Use fixed input collections representing early, middle, and mature progression, plus Darlings constraints when enabled. Candidate deck outcomes are `TO MEASURE`:

```text
npx tsx scripts/personas/craft.ts --all --pool all --field prefabs --seeds 150 --iterations 80 --seed 20260720 --workers 14
npx tsx scripts/personas/craft.ts --metagame --all --pool all --field prefabs --seeds 150 --iterations 80 --rounds 4 --workers 14
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
npx tsx scripts/progression-sim.ts --seeds 8 --days 60
```

The progression run is required only if Tutor can trigger crafting or purchasing; the recommended v1 does neither, so use it as a regression spot check, not a Tutor-quality score. Add a benchmark command such as `npx tsx scripts/benchmark-deck-tutor.ts --fixtures all`; acceptable time/memory budgets are `TO MEASURE` on the user-approved device matrix.

Coach v2 is gated by a curated replay-decision corpus with human labels. Report top recommendation agreement, illegal recommendation count, hidden-information violations, abstention rate, and runtime. All thresholds are `TO MEASURE` before a shipping gate is set. A single whole-game win rate cannot validate explanatory advice.

## Phased implementation plan

### Wave 1: shared deterministic craft core

Extract pure construction/scoring/hill-climb modules and make the current CLI consume them with bit-for-bit or explicitly reviewed golden equivalence. Verification: focused golden/unit tests, current craft command on a fixed fixture, metagame smoke, full Vitest, build, lint, docs.

### Wave 2: Tutor v1 product slice

Add collection and format adapters, a cancellable browser worker, request UI, result preview, explanations, and normal deck saving. Ship with a conservative iteration/time budget based on measured devices. Verification: ownership/legality properties, deterministic same-request output, cancellation and worker-failure tests, browser/device benchmark, avatar/floor gates, full Vitest, build, lint, and manual responsive UI pass.

### Wave 3: Coach v2 evaluation spike

Define the decision snapshot interface, reconstruct `PlayerView` at selected replay actions, evaluate a narrow action family, and produce reason codes. No public promise until hidden-info audits and labeled-corpus results exist. Verification: adversarial redaction tests, legal-action-only property, deterministic annotation golden files, replay-version compatibility, performance benchmark, full Vitest, build, lint.

### Wave 4: Coach v2 replay experience

Add timeline marks, chosen/suggested comparisons, abstentions, wording, and share policy. Expand action families only when corpus measurements support them. Verification: labeled corpus gate with published `TO MEASURE` replacements, imported replay tests, accessibility/text-scale pass, full Vitest, build, lint, docs, and human strategy review.

## Open decisions for the user

- **Tutor runtime posture:** wait for the full configured hill climb, cap wall time and return best-so-far, or use a lightweight heuristic only. **Recommendation:** deterministic iteration cap plus device-specific wall-time safeguard, returning the best legal candidate.
- **Default result action:** create a new deck or replace the open deck. **Recommendation:** create a new deck so advice is reversible.
- **Style exposure:** show all six styles immediately or unlock advanced controls. **Recommendation:** show the six plain-language styles, with colors and Darling as the only initial constraints.
- **Use of crafting:** suggest only owned cards or also show an aspirational list. **Recommendation:** owned-only for v1; a separate wish-list mode can come after the crafting-price decision.
- **Coach confidence:** always recommend a line or allow abstention. **Recommendation:** allow `No clear change found` unless the best alternative clears a measured margin.
- **Coach scope at 2.0:** combat and obvious timing only, or all legal decisions. **Recommendation:** ship a narrow, well-labeled action set and expand from measured corpus accuracy.

## Risks and dependencies

The current craft harness is a Node CLI with worker/file assumptions and may be too slow for client use. Optimizing its score can also produce strong but unreadable piles, repeated outputs, or advice that appears authoritative. Coach reconstruction has access to full replay state internally, so an accidental direct read would leak hidden information even if the UI seems harmless. Tutor legality depends on `docs/plan-darlings.md` and the final per-slot representation in `docs/plan-variant-decks.md`. Runtime and cancellation UX depend on `docs/plan-mobile-overhaul.md`. Replay reconstruction and share semantics depend on `docs/plan-player-replays.md`. Craft price and aspirational recommendations depend on `docs/plan-dt-power-pass.md`. Core Set II requires the shared core to accept new cards without hardcoded IDs.

## Acceptance criteria

- The CLI and product worker call one shared pure craft core and produce deterministic results for fixed inputs.
- Every suggestion is legal for its format, uses no more non-basic copies than the player owns, excludes tokens, and needs no hidden state.
- Cancel, worker failure, and budget expiry leave the current deck/save unchanged; best-so-far is clearly labeled when returned.
- Runtime and memory targets are replaced from `TO MEASURE` with results on the approved browser/device matrix.
- Existing avatar and floor gates pass; no floor is lowered to admit a suggested deck.
- Coach recommendations are legal in the reconstructed redacted view, reveal no then-hidden card, use deterministic reason codes, and may abstain.
- Coach corpus metrics and supported action families are published before 2.0 release claims.
