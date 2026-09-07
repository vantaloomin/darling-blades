<!-- source-of-truth: docs/plan-road-to-2.0.md, docs/plan-expansion-slate.md, docs/expansions/drafts/drowned-deep-overplan.md, docs/rollout-telemetry-and-accounts.md, docs/plan-1.6.md, docs/plan-tribal-pass.md, docs/release-notes/v1.7.2.md, src/engine/types.ts, src/meta/warchest.ts, src/meta/SaveManager.ts · last-verified: 2026-09-07 · program doc — the 1.8 train proposal; re-verify when the owner rules on the open decisions or a lane lands -->

# Darling Blades 1.8 — program plan (proposal)

**Status 2026-09-07: DRAFT, awaiting owner rulings. Nothing here is
implemented or authorized.** This is the "work out the plan" pass that opens a
train: what the spine already committed 1.8 to, what 1.7.x left on the table,
what the docs say each piece needs, and the decisions only the owner can make.
It follows the "Add to the list != build it" rule: plan doc plus roadmap entry,
then stop.

The release spine is [plan-road-to-2.0.md](plan-road-to-2.0.md). Its 1.8 row,
agreed 2026-08-24 and never re-opened:

| Set | Mechanics | Engine feature | Non-card headline |
| --- | --- | --- | --- |
| **Drowned Deep** (cosmic horror), Large 250+ | Whispers | **Activated abilities with tap costs** | Land economy treatment |

Plus one feature the spine placed at 1.8 after the fact: **anonymous
telemetry** (ruled 2026-08-28, all eight decisions locked, no code). The
cadence rule that shapes everything else: *a Large release carries the set,
the engine feature, and little else.* Duat was 245 cards and consumed the whole
1.6 train including its art run.

## Where 1.8 starts from

- `main` is v1.7.2 (merge commit `085a17d`, 2026-09-05). Three 1.7 releases
  shipped in three days: 1.7.0 on 09-03, 1.7.1 (card fixes, Hauntlink windows,
  the extra-land floor, Clone Deck) on 09-04, 1.7.2 (the Hauntlink pass
  hardlock) on 09-05. No open issues; one open PR (#342, the Node 24 proposal).
- Pool: 1,235 collectible cards (1,259 with tokens) across nine sets, 24-rung
  tower, 28 authored decks, README figures 1,973 tests in 188 files, suite
  about 11 minutes.
- The 1.7 metagame sweep ran to completion for the first time on the
  reserve-native harness. Two readings carry into 1.8 design: the archetype
  order has inverted since 1.3 (control and midrange lead, go-wide trails), and
  the prefab columns split sharply (Duat and Crimson Muster hold the personas
  to 70-74%, Celtic Fae, Starborne and Ragnarok concede 92-95%). A "coastal
  control" set with a discard payoff leans into the side that already leads.
- The engine already has four activation-shaped seams to build on, all in
  `src/engine/types.ts`: Empower (optional additional cast cost), Skim (hand
  activation, no stack), Preserve (main-phase graveyard activation), Hauntlink
  (Charm-speed battlefield action with its own window since rules revision 4),
  plus `manaAbility` on lands and mana creatures. Tap-cost abilities are the
  fifth seam, not the first.

## What the 1.8 spine item needs, lane by lane

Lanes are ordered by dependency, not by size. A, B and D are the engine and
rules work that must exist before card data; C is the set; E is the parallel
telemetry lane; F is the debt block; G is measurement and release mechanics.

### Lane A — the engine feature: activated abilities with tap costs

Set-agnostic by ruling (2026-08-24): a capability every later set draws on,
which Brass Court's Union rigs and contraptions wait on. It also unlocks the
artifact design space the slate records as blocked (Fogbell Chime sat parked
for months because artifacts carry no targeted or activated abilities).

Nothing is specced yet. **A `plan-tap-abilities.md` engine spec is the first
deliverable of the train**, Fable-authored, owner-ruled, Codex-implemented, the
same shape as the Starborne engine wave. What the spec has to settle:

1. **Timing.** Recommendation: v1 is main-phase, own turn, empty stack, the
   Preserve precedent. Charm-speed activation is a per-ability flag for later;
   it would ride the existing response windows (a new `legalActions` kind, not
   a new `Awaiting` kind), so it does not need to block v1.
2. **Which permanents.** Recommendation: stage 1 is **artifacts and
   enchantments only**, stage 2 adds creatures. On a non-creature there is no
   attack-versus-activate trade-off, which is precisely the tempo decision the
   slate's AI-pilotable rule warns about (the reason Pilot/Crew was tabled).
   Creatures then arrive with a summoning-sickness rule (no tap ability the
   turn it arrives; Warcry lifts it, the haste precedent) and a greedy
   heuristic: activate when the creature would not attack profitably.
   **Lands are excluded by construction**: the reserve accepts only basics and
   duals (`isAllowedReserveLand` in `src/meta/warchest.ts`, owner ruling
   2026-08-25), so a land with a tap ability can never be played. See lane D.
3. **Cost shapes.** `{T}` alone, `{T}` plus mana, `{T}` plus a Rite-style
   sacrifice. Recommendation: tap and tap-plus-mana in v1; sacrifice riders
   only if a Drowned Deep card needs one.
4. **Costing.** Per the owner rule that every new mechanic is costed from a
   comparative before it ships, the MEP rate comes from MTG tap-ability
   precedent in the local corpus (pingers, tappers, tap-to-draw, tap-to-mark),
   sanity-checked at both ends of the plausible range. Lands in the corpus are
   excluded from the anchor set because ours cannot carry the ability.
5. **Blast radius**, the same list the Starborne wave paid: the AI at all three
   difficulties (activation is a new action class in `legalActions`), the
   converter's target-supply walk, `PlayerView` exposure of activation legality,
   the replay log version, and the DuelScene click path, which already routes a
   permanent click to Hauntlink linking. The playbook trap from 1.7.2 applies:
   any new `Awaiting` kind is not done until every DuelScene `switch` knows it.

### Lane B — the set mechanics: Whispers, and Dread of the Deep if kept

**Whispers** (the slate's madness analog): a card with Whispers that is
discarded from hand may be cast immediately for its Whispers cost. It closes an
existing loop: Dark Tales shipped a discard engine (Skim) with no discard
payoff. Engine shape: a discard event with an owner decision, so a new
`Awaiting` kind (`whispersWindow`) with the DuelScene audit above; AI is a
greedy cost comparison (cast if affordable now and the normal cost is not). The
overplan's own risk list applies: a cast-versus-Whispers affordability audit
and a deck-out guard review before card data commits.

**Dread of the Deep** (the emerge analog): sacrifice a creature as you cast a
Horror, reduce its cost by the sacrificed creature's cost. Rite already shipped
the additional-sacrifice-cost plumbing, so this is an optional Rite variant
with a discount, a small lift. The overplan marks it deliberately sparse so the
set still works as a control set without the Horror package assembled.

**Decision for the owner (D4):** the slate table says Whispers only; the
overplan carries both. A Large set has room for two, and Dread is cheap, but
each is a costed mechanic, an AI heuristic, and a glossary entry.

### Lane C — the set: Drowned Deep, 250+ cards, authored fresh

**Owner decision 2026-09-07: the Drowned Deep overplan is retired and the set
is authored fresh.** The draft (`docs/expansions/drafts/drowned-deep-overplan.md`,
deleted on this branch; history keeps it) was not Fable-authored, which is
the owner's rule for card text, names, flavor and design docs. It was also
wrong for the job on its own terms: 200 candidates for a 120-card Small cut,
written 2026-07-28 before the Large ruling, the Warchest reserve and the 1.7
rules, with zero tap-ability cards beyond five unplayable rare lands, 20
common single-colour taplands, an arrival-only artifact, and a retired
fetchLand ritual. What survives of it is only what the spine and the slate
already fixed: the name, cosmic horror, and Whispers as the headline mechanic.

The fresh authoring pass is Fable's, in the order the Starborne concretion
used, and it cannot start until lanes A and B have a spec, because the set
must print the engine feature it ships:

1. **Set identity brief** (owner-approved before any rows): setting, colour
   pie, what each colour does with Whispers and with tap abilities, the
   Horror package, the go-wide answer to the sweep's control-leaning field.
2. **Overplan of ~320 candidates** for a 250+ cut, every row costed by the
   power formula at authoring time and run through the overlap comparator
   against the live pool (`scripts/audit-overlap.ts`), so the design-health
   duplicate rate is a constraint from the first row and not an audit at the
   end. Per-set rarity histogram chosen here and locked; Starborne's shares
   scaled to 250 give **124 C / 75 R / 23 SR / 16 SSR / 12 UR** as the default.
3. **Cut list**, with the protect-first list, cut priorities, enabler density
   as a cut constraint (the Starborne lesson), and the AI-watch family named.
4. **Concretion** to the engine's vocabulary, then Codex transcribes.

The rules the rows are written against, all post-dating the old draft: the
reserve accepts only basics and duals; no non-creature permanent is a one-time
effect; `extraLandDrop` with the mv-2 floor; creature-scoped marks; the Empower
ceiling; one printing per set, stricter for tempo effects; every token minted
in the shipped cut.

What the set carries besides cards, every one of which Starborne needed:

- Six proposed tokens; the minterless-token lesson from 2026-09-03 means every
  token in the shipped cut has a minter in the shipped cut, checked by test.
- The precon **Lanterns Below** (U/B midrange-control) and a summit pair at
  **rungs 25-26** (the overplan says 17-18; the tower is at 24). Floors set
  from the final post-everything band, and the CI 900s per-test budget already
  forced the summit gate to split at 24 avatars, so a 26-avatar matrix needs
  its own gate shape decided up front.
- Converter-owned Darlings decks for both bosses, regenerated on every pool
  change (the gen-then-sync order from 1.7.1).
- Art register section in the art bible, set icon, booster blurb, land style,
  glossary entries for both mechanics, `terms --check` for the blades-db
  dictionary, and the AI watch list for any threshold-shaped payoff.
- **Art is the long pole.** 250+ card arts plus tokens plus the summit pair's
  portraits. Starborne's 151 took the pipeline from 2026-08-25 to 08-28 with
  the traps now written down; Duat's 245 filled its train. The art run starts
  the moment the cut list locks, and it must start *after* decision D8 below.

### Lane D — the non-card headline: land economy treatment

This is the one 1.8 item with **no spec and no decision brief**. It is the
last open decision `plan-1.6.md` still carries: "land cards' economy/collection
treatment post-migration." After Warchest, a collectible land is playable only
if it is a basic or a dual; the pool holds **27 utility taplands** (measured
2026-09-07 with `isUtilityTapland` over the live catalog: Celtic Fae 3, Grail
Oath 5, Nocturne Manor 5, Dark Tales 8, Starborne 6; Duat printed none) that
open from packs, count toward collection, shard, and cannot be put in any
deck. Starborne printed six of them *after* the reserve ruling, which is the
clearest sign the question needs an answer before another set. The owner ruled
them OUT of reserves (2026-08-25), and the Anubis repair recorded the tapland
tax as the largest single lever against her, so re-admitting them is not the
answer.

Recommendation: a short decision brief (`plan-land-economy.md`) with the
measured count per set and three costed options: (a) retire them from packs
and drops, keep owned copies as shard-only; (b) convert each into the
non-land shape its effect implies, most naturally a tap-cost artifact once lane
A exists, which is the strongest argument for treating this as a 1.8 item; (c)
leave them collectible and mark them in the binder as reserve-ineligible. Any
option that changes the collectible pool touches drop tables, collectionPct,
draft packs (`packPool` already excludes them), and the Assay.

### Lane E — anonymous telemetry (T0 to T3), parallel

The execution plan is written: [rollout-telemetry-and-accounts.md](rollout-telemetry-and-accounts.md).
It is independent of the set and can run alongside it. What it needs from
1.8, in order:

- **Wave 0a**, the `telemetry.ts` to `balanceTelemetry.ts` rename (3 import
  sites). Can land any time.
- **Wave 0b, the v35 save bump.** Adds `settings.shareAnonStats` and
  `statsNoticeSeen` and finally carries the `CosmeticsSave.cardBack`/`playmat`
  removal parked since v33. The three traps are written on the type in
  `SaveManager.ts`. This is the only save bump 1.8 is known to need, so
  anything else that wants a schema change (a deck field for lane D, a
  replay-related field) rides it, and it lands once.
- **T0 spike** is blocked on owner-only prerequisites: a Cloudflare account and
  the Worker hostname. **T2** is blocked on the privacy page being live before
  the first event. These want doing a week before their waves open.
- T2 also owes the two pre-existing disclosures a privacy page has never
  covered: the `src/version.ts` update check calls `api.github.com`, and Pages
  logs request IPs.
- The harness trap is structural: the emit call lives in the scene layer only,
  with a test that a headless duel emits nothing, or one sweep burns the daily
  quota.

### Lane F — carried debts and small fixes

Small items 1.7.x left behind, with a recommended slot each:

| Item | Source | Recommendation |
| --- | --- | --- |
| **Node 24 for the toolchain and CI** | PR #342, docs only, verify green | **Land before the train opens.** GitHub removes Node 20 from the runner on 2026-09-23; the next `v*` tag exercises `release.yml`. Three owner decisions sit in the doc |
| Card frame geometry (taller window, "Art Window Fit") | tabled 2026-09-03, 77 `CARD_W/H` refs across 12 files, 19 files of 5:7 literals, six card backs | **Decide before the Drowned Deep art run** (D8). Doing it after means re-cropping 250 new arts |
| Editable Limited Warchest after auto-fill | ruled 2026-08-19, reconfirmed 08-28, not scoped | 1.8 candidate if the train has slack; otherwise 1.9 with the other scene sweeps |
| Converter checks target supply but not mana castability | flagged 2026-08-31, not fixed | 1.8, alongside the converter's tap-ability walk (lane A touches the same code) |
| R19/R20 floor margins 4.5/2.5pp, under the 6.5pp noise band; Abyssal Songstress at 81% vs a 0.795 floor | 1.7 balance lane | Re-baseline with fresh 200-seed numbers when the 1.8 pool is final; floors only ratchet up |
| `run-sweep.ps1` never syncs its hardcoded worktree | 1.7 review | Small PR before the 1.8 sweep |
| Reserve summary line needs one in-game look | 1.7 review | QC day |
| Apotheosis faces small at card scale; Lancer banner emblem | 1.7 visual pass | Art QC alongside the DD run |
| Nine Lives x Propagate: a Propagate deck disables all 30 Nine Lives creatures | open question, by-design pins exist | Owner call: tension to keep, or a rule |
| `scripts/audit-overlap.ts` is untracked on `main` | `git status` today | Commit it; the set audit depends on it |
| Roadmap drift | the Planned ladder still says "1.8 = mobile overhaul + cloud sync"; 1.7.1 and 1.7.2 have no Recently-shipped block; dated 2026-08-25, review monthly | Docs sweep in wave 0 |

Explicitly **not** in 1.8, per the spine: the mobile overhaul and accessibility
(1.9), Story Mode (2.0), cloud accounts, UGC and replay coaching (2.1), the
tribal E1/E2 engine tiers (unscheduled; a Large release carries little else),
and multiplayer (cancelled).

### Lane G — measurement and release mechanics

- Every new mechanic gets its MEP rate before card data (owner rule); the
  Assay rescore follows the transcription; the balance matrices re-run when
  the AI or decks move; **the metagame sweep runs last** against the final
  field, never as a mid-train gate.
- The suite is at 11 minutes and the win-rate gates dominate it. Two more
  rungs and 250 more cards push CI toward its per-test budget; decide the
  summit gate shape (split, sampled, or a separate job) before the rungs land.
- Release cut follows the checklist that works: three version surfaces,
  `cargo update --workspace`, `app:build` before tagging, `docs/release-notes/v1.8.0.md`
  as the release body (`check-release-notes` fails the PR without it), README
  figures re-measured, a two-parent merge into `main`.

## Sequencing

Waves are dependency-ordered. Within a wave, lanes run in parallel in separate
worktrees, by file set.

| Wave | Contents | Gate |
| ---: | --- | --- |
| **0** | Node 24 (#342 implemented), roadmap sync, telemetry 0a rename, `audit-overlap.ts` committed, `run-sweep.ps1` sync fix | ladder rungs 1-6; the next tag proves `release.yml` |
| **1** | Specs, Fable-authored: `plan-tap-abilities.md`, the Drowned Deep engine-wave spec (Whispers, Dread), `plan-land-economy.md`, then the fresh Drowned Deep identity brief and ~320-candidate overplan once the engine specs are approved. Owner rulings D1-D8. Frame geometry decided | owner approval of each spec |
| **2** | Engine, Codex under contract: tap abilities stage 1 (artifacts, enchantments), then stage 2 (creatures), then Whispers, then Dread. Each with rates, AI at three difficulties, converter, replay bump, DuelScene switch audit, tests. v35 save bump (0b) lands here so lane D's schema needs ride it | full ladder, win-rate gates unchanged, replay goldens |
| **3** | Set concretion: the 250+ cut locked, transcription, tokens, glossary, terms. **Art run starts the day the cut locks** and runs the length of the wave | check-art-bible green, every token minted, dup audit filed |
| **4** | Metagame content: Lanterns Below, rungs 25-26 with Darlings decks, floors from the final band; land-economy implementation per D3; Assay rescore; balance pass | matrices, precon and boss floors, Assay fair-rate |
| **5** | Telemetry T1-T3 (parallel from wave 2 once T0's owner prerequisites exist); Settings layout pass; privacy page live before T2 ships | probe: toggle off shows zero requests |
| **6** | QC day, the metagame sweep last, release notes, the 1.8.0 cut | the cut checklist |

For scale: the 1.6 train (245 cards plus the Warchest migration) ran
2026-08-06 to 08-23; the 1.7 train (151 cards plus an engine wave) ran
2026-08-24 to 09-03. 1.8 is the larger of the two shapes.

## Decisions for the owner

Numbered so rulings can cite them. Recommendations are the first option.

1. **D1 Set size.** Author a fresh ~320-candidate overplan for a 250+ cut
   (the cadence), or accept a smaller Drowned Deep and move the difference to
   2.0. (The old overplan is retired; the question is only the target.)
2. **D2 Tap abilities v1 shape.** Main-phase own-turn only, artifacts and
   enchantments first, creatures in stage 2 with summoning sickness and the
   Warcry exception; tap and tap-plus-mana costs. Charm-speed activation
   deferred to a flag.
3. **D3 Land economy.** Which of the three options in lane D, after the brief
   measures the count. The recommendation leans on lane A: convert the
   utility taplands into the tap-cost artifacts they already want to be.
4. **D4 Dread of the Deep.** In (cheap on the Rite plumbing, gives the Horror
   package a spine) or out (one costed mechanic fewer).
5. **D5 Telemetry prerequisites.** Create the Cloudflare account and pick the
   Worker hostname so T0 can spike early in the train; decide when the
   privacy page goes live.
6. **D6 Node 24 now.** Implement #342's one-PR change before 2026-09-23 and
   before the train opens, per the doc's three choices (smallest action majors,
   `engines` as a warning, timing).
7. **D7 Editable Limited Warchest.** 1.8 with slack, or 1.9 with the scene
   sweeps.
8. **D8 Frame geometry.** Take the tabled taller-window change now, before
   250 arts are generated to the old geometry, or retire it. This is the one
   decision whose cost doubles if it is made late.
9. **D9 Floors.** Authorize the 200-seed re-baseline of R19/R20 and Abyssal
   Songstress once the 1.8 pool is final, rather than absorbing flakes.
10. **D10 Nine Lives x Propagate.** Keep the tension as designed, or rule.

## Non-goals

- No relitigating the spine: Drowned Deep is the Large, Brass Court stays 2.1,
  accessibility precedes Story Mode, multiplayer is cancelled.
- No tap abilities on lands while the reserve rule stands.
- No Sanity track and no double-faced cards (tabled in the slate for cause).
- No mid-train sweep. No floors lowered.
- No cloud accounts code, even though the spec is written; that is 2.1.
