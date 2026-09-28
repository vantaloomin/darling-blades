<!-- source-of-truth: docs/plan-road-to-2.0.md, docs/plan-expansion-slate.md, docs/plan-accessibility-i18n.md, docs/plan-mechanic-usage-audit.md, docs/plan-sweep-speed.md, docs/plan-art-regen-2026-09-22.md, docs/plan-1.8.5.md, docs/metagame-sweep.md, src/engine/types.ts, src/art/artLoader.ts, src/art/ArtResolver.ts, src/ui/CardThumbCache.ts, src/ai/activatedPolicy.ts, src/meta/SaveManager.ts, src/meta/Replay.ts, scripts/audit-overlap.ts, scripts/personas/craft.ts · last-verified: 2026-09-28 · program doc — the 1.9 train, opened on the owner's scope rulings of 2026-09-25; re-verify when the owner rules on the open decisions or a lane lands -->

# Darling Blades 1.9 — program plan

**Status 2026-09-28: every decision RULED. 1.8.1 (lane 0) shipped
2026-09-25 and 1.8.5, the scaling rebalance, shipped 2026-09-28. Wave 0 is
under way (owner, 2026-09-28).** The owner ruled the 1.9 scope on 2026-09-25
(the table below), then the same day grouped the 1.8.x items with every open
1.8 review finding as the 1.8.1 patch, ruled D1-D11, and said go on 1.8.1.
1.8.5 was inserted before wave 0 on 2026-09-26 (its D8), so First Dawn is
costed on the new scorer from its first card. On 2026-09-28 the owner ruled
D12-D15: the waves are re-ordered around the critical path (see Sequencing),
the follow-ups logged at the 1.8.1 cut become lane I and land early, the
sweep gains personas in First Dawn's colours, and the AI fixes 1.8.5 handed
on are approved. Later that day, after wave 0 closed, D16 put the cards
before the engine spec: a design-first overplan and its concretion audit
decide what the engine builds. **Wave 1 closed at the owner's sitting the
same evening:** the First Dawn brief, the accessibility plan and the art
streaming design were approved, the art window set at 216 px (D18), and
1.9's minimum scope named (D17). This document turns the rulings into lanes and waves. Each
wave starts on the owner's word.

The release spine is [plan-road-to-2.0.md](plan-road-to-2.0.md). Its 1.9 row,
as agreed 2026-08-24, and as it stands after the owner's rulings:

| | Set | Mechanics | Engine feature | Non-card headline |
| --- | --- | --- | --- | --- |
| Spine (2026-08-24) | **First Dawn** (prehistoric), Small ~150 | Provoked, Hunt | none | Accessibility + Mobile |
| **Ruled (2026-09-25)** | **First Dawn**, authored fresh, 150-165 | Provoked, Hunt | none (mechanic engine work only) | **Accessibility**, card art streaming, measurement |

## The owner's scope rulings (2026-09-25)

| # | Ruling | Where it lands |
| --- | --- | --- |
| R1 | The two new mechanics, **Provoked** and **Hunt**, are approved | Lane A; the form Provoked is D1, ruled |
| R2 | **First Dawn is a fresh set**, drafted by an Opus 5.5 agent. The July overplan is retired | Lane B |
| R3 | **Accessibility is approved** | Lane C |
| R4 | **The mobile overhaul moves to 2.0**, the itch.io launch (D4, ruled) | Moved out |
| R5 | **AI suggested decks move to after 2.0** | Moved out |
| R6 | **The editable Limited Warchest moves to after 2.0** | Moved out |
| R7 | **Dynamic card art loading and unloading is approved** | Lane D |
| R8 | **The mechanic usage audit** is on the list (its decision U1) | Lane E |
| R9 | **Fix weenie's cost in the sweep** (the Hard brain on wide boards) | Lane F |
| R10 | **Sweep improvements** (levers 2 and 3 of the sweep plan) | Lane F |
| R11 | **Every 1.8 review finding still open is implemented**, in 1.8.1 (second ruling) | Lane 0 |
| R12 | **The 1.8.x items**, grouped with R11 as 1.8.1 (second ruling) | Lane 0 |
| R13 | **Flavor text is removed entirely** (third ruling, same day): "an MTG-clone holdover". Off every card face, the enlarged view and the collection detail included, and out of the card data and the authoring pipeline; the art takes the room | Lane C, card face |

## Where 1.9 starts from

- `main` is `ed1cb26`: v1.8.5, the two-parent merge of `release/1.8.5`
  (tag `v1.8.5`, 2026-09-28), on top of v1.8.1 (`b4973a9`, 2026-09-25).
  No PR is open.
- Pool: 1,482 collectible cards across ten sets, a 26-rung tower, 5 starter
  precons, 9 theme decks and 5 Darlings precons, 82 Duty carriers.
  - `SaveData` is v35; neither 1.8.1 nor 1.8.5 bumped it.
  - `REPLAY_LOG_VERSION` is 15, since 1.8.1's G6. 1.8.5 changed card data
    only, so its card-db stamp alone refuses older replays.
  - The suite at the 1.8.5 cut: 4,238 tests plus 4 skipped across 278 files,
    about 13 minutes on an idle machine.
- **The post-release metagame sweep has ended.**
  - Run 36017324764 on `main` at `fd29724` lost a runner in round 1. The
    watcher resumed it as run 36196954110 at `3bc6d2b`.
  - Both runs finished as "failure" from lost chunks. The rounds that did
    finish, 0 to 2, are published on `sweep-data`: `sweeps/2026-09-22`
    through `2026-09-25-13003`, 47 crafted decks.
  - They measured the 1.8.0 pool. 1.8.5 used those crafts as its play
    evidence (its D11).
  - The pre-release round 0 read nothing egregious. Reanimator was the
    weakest persona (63.3% against the prefab field), and the Starborne and
    Silver Veil shop decks conceded 95-97% of games, the same as the 1.7
    reading. Both readings feed the First Dawn identity brief (lane B).
  - **Coverage gap:** no persona plays green or red-white, so the sweep says
    nothing about those cards (see "Carried from 1.8.5").
- The two expansion mechanics have **no engine vocabulary yet**, measured
  2026-09-25: `TriggerWhen` in `src/engine/types.ts` has no damage-received
  event (only `combatDamageToPlayer`), and `EffectOp` has no mutual-damage
  op. The slate's "Engine: trivial (damage events exist)" undersells both.
  Each is new vocabulary with the Starborne wave's blast radius, which is
  still well short of a Large release's engine feature.
- `scripts/audit-overlap.ts`, the duplicate comparator every set is run
  through, was blind to Duty, Tithe and Whispers: its `bodyKey` listed the
  fields it compared and had no `activated`, `tithe` or `whispers`. That is
  how three same-cost duplicates reached the shipped Drowned Deep (the
  2026-09-24 review, #436). Wave 0 fixed it: the body key now keeps every
  field except presentation, printed cost and colours, so a mechanic added
  later is compared without a code change; subtypes count only where a rule
  reads them (Aura, or a tribe some card pays off; a token-only lord does
  not count), and `legendary` counts. The domination pass now ranks the same
  Duty or rider at a cheaper price as better (it finds The Debt Is Called
  over Two Jars, One Heart), and a looser target cap as better (cost 3 or
  less over cost 2 or less). Wave 2 added the LADDER pass: it groups cards
  whose data matches once stats, prices and effect sizes are set aside
  (signs kept, commuting ops compared as a set), and reports each pair's
  set, cost, tribe and legendary status and any winner, whose colours must
  fit inside the loser's. The STRICTLY-WORSE TWIN pass now compares every
  printing, not only the cheapest. The D8 review reads both:
  [d8-near-duplicate-review.md](d8-near-duplicate-review.md).

## Carried from 1.8.5 (2026-09-28)

1.8.5 rebuilt the power scorer and re-priced the pool
([plan-1.8.5.md](plan-1.8.5.md), rulings D1-D17). What that changes for 1.9,
and what it hands on:

**How cards are costed from now on (lanes A and B).**

- Keywords are priced on the creature carrying them (§4u of the local power
  formula):
  - Twin Blades 0.75 + 0.40 per point of Attack
  - Skyborne 0.50 + 0.27
  - First Blade 0.20 + 0.22
  - Blood Oath 0.20 + 0.25
  - Warcry 0.15 + 0.10
  - Bulwark's penalty grows with Attack
  - Deathblade shrinks with it
- The body is priced 0.55 per Attack and 0.45 per Defense, with a taper.
- Extra land drops are priced by the turn they are cast, against the 10-land
  reserve (§4v).
- **Every First Dawn card, and the rates for Provoked and Hunt, are costed on
  this scorer.** The Forge uses the same code, so a card the Forge calls
  Accurate is Accurate in the game's own numbers.
- A new combat keyword that hits harder on a bigger body gets an attack slope,
  measured the way 1.8.5 measured its keywords. The in-engine lab harnesses
  sit in the local `balance/study/lab/`. The standing rule is that no mechanic
  ships unweighed.

**Balance items handed on** (they join D7's wave 4 unless a lane owns them):

| Item | What 1.8.5 found | Where it lands |
| --- | --- | --- |
| **The AI values ramp at 0** | `opImpactValue` has no `extraLandDrop` case, so Medium casts a two-mana ramp spell on its own turn 6.9 on average, and a Dawn ramp engine earns only the triggered-ability premium. A flat case would reintroduce the scorer's old defect; the target is the §4v cast-turn shape. It changes play, so it re-measures the gates | Lane E (the usage audit); **the AI change is approved (D13, 2026-09-28)** |
| **The ramp anchor** | One extra land at mana value 2 stays at the Rampant Growth anchor, 1.9; the ramp lab measured it at 1.22 [0.95, 1.60]. Lowering it would make every ramp card read cheaper in the Forge | **RULED 2026-09-28: keep 1.9.** The anchor does not move; the lab reading is recorded in §4v |
| **48 reverted nerfs** | 1.8.5 shipped only the 27 nerfs the sweep backs with play. 48 cards the new scorer calls over budget were never picked by the sweep's optimizer, 15 of them because no persona plays their colours (green, red-white). They stay as in 1.8.1, and the Forge reads some as Over Value | A measure-later pass: per-card in-engine checks, or the sweep with green and red-white personas (lane F, ruled D12); the list is `balance/study/slate/reverted-48.json` |
| **Starborne Apotheosis still under** | Measured about 1.6 below its budget after its buff. The AI casts it as "gain 8 life" with no Marked creature on the board in 72% of casts | AI mark-awareness first (lane E), then re-measure |
| **Brood Communion on empty boards** | Fair as a card, but cast with no creature of its own in 32-39% of casts | Lane E |
| **Black Tide Rising** | Shipped at {B}{B}, -3/-3 (D15). Fair in Shadow Mandate, over-tuned in Midnight Storybook (+1.22; the precon goes 61.5% to 71.2% with four copies) | Watch in the 1.9 sweep and the player stats |
| **Granted keywords the AI still prices flat** | Boost ops and non-creature static grants were outside 1.8.5's attack-scaling pass | Lane E |
| **The lower-tower bands** | Sima Yi rose 25 to 43 on buffed cards in his converter list (owner-accepted; it closes the R6/R5 inversion). Floor 15 sits on its band minimum (50.0) | The RUNG_BANDS 1-13 re-centre already recorded for 1.9 (an owner call) |
| **Scorer rates still NEEDS MATH** | controlMarked, markedThreshold, recurring self-damage, Whispers' fire rate, the X-spell tax, the Duty coefficient, the cost limit on a removal spell's target, and the Hauntlink link cost (#403) | Costed when a First Dawn card or a balance item needs one |
| **Still Harbour and Signal Drown** | Still Harbour was flagged by the new pricing and held. Signal Drown is a dead card in the Violet Signal Queen's deck, which has no Mark sources | Wave 4 balance pass |

**Art.** Swan-Lake Sovereign and Brood Communion no longer match their
art, and both are queued in lane B's art run (below). Freya and Siege
Juggernaut were reverted, so their art still matches.

## Lanes

Lanes are ordered by dependency, not by size. Lane 0 is the 1.8.1 patch and
ships first; the review carry-over rides in it, and its items keep their G
numbers. A is the engine and rules work that must exist before card data. B
is the set. C, D, E and F are independent of the set and run beside it. H is
measurement and release mechanics. I is the follow-ups logged at the 1.8.1
cut, placed as early as their file sets allow (D14).

### Lane 0 — the 1.8.1 patch: the 1.8.x items and the 1.8 review carry-over

**Owner ruling 2026-09-25: the 1.8.x items and every open 1.8 review finding
ship together as 1.8.1**, cut when the post-release sweep's reading is in
(D6). On 2026-09-25 that sweep was in round 1 of 4; the train builds while it
runs.

The 1.7.1 precedent: a `release/1.8.1` train branch cut from `main`, small
PRs into it by file set, a release PR merged into `main` as a two-parent
commit, and the tag on that merge. #436 retargets from `main` to the train, so
nothing deploys ahead of the patch.

**The 1.8.x items**

| Item | State | Note |
| --- | --- | --- |
| The seventeen art regenerations | Briefs authored and merged: [plan-art-regen-2026-09-22.md](plan-art-regen-2026-09-22.md) | Codex runs the pipeline on one lane; the owner's eyes on every image |
| Drowned Deep duplicate split | **PR #436 open**, green: ten cards reworded with ids, costs, rarities, stats and art unchanged, plus a catalog guard against rules-identical printings in one set | Retargets to the train |
| Anything egregious the post-release sweep finds | Sweep running | A fix only if egregious, the standing 1.8 ruling |
| Hauntlink Apex (D7) | **Option A ruled 2026-09-25**: {3}{U}, "During your Dawn, Foresee 1", the {3}{U} link and its +3/+3 Skyborne Untouchable rider unchanged (workbench +0.46 to -0.01) | Only live carrier: the Kitsune boss (2 in her reserve list, 1 in her Darlings list); re-measure her rows and the Hauntlink usage count after integration |

**The 1.8 review carry-over (R11).** Sources: the release-candidate review
of 2026-09-23 (its unruled items and its 1.9 notes), the follow-ups reported
with the title-safe work (#431), the QC-day survey of 2026-09-22, and the
Drowned Deep duplicate review of 2026-09-24 (its older-set leftovers are D8;
its tooling fix is wave 0). Every item was re-checked against `main`
(`a1c8f91`) on 2026-09-25. Ten were already fixed by #423 to #429 (the
Whispers docs, the own-turn fog test, the Esc router, the Limited redraw, and
the copy fixes) and are not listed; four new ones found by the re-check are.
G8 was found by reading only and starts with a failing test.

| # | Finding | State on `main`, 2026-09-25 | Size | 1.8.1 PR |
| --- | --- | --- | --- | --- |
| **Decks** | | | | |
| G1 | An unfinished deck cannot be saved, so leaving discards it (review T6) | Save refuses while any error stands; "Leave Without Saving" restores the last saved list; the Decks menu writes the working deck with no check, as do the format switch and the Darling pick; a never-saved deck is dropped without a prompt when another is opened. `DeckBuilderScene.ts`, `DeckStorage.ts` | M; D10 ruled | decks |
| **Duel** | | | | |
| G2 | Undo can reveal hidden cards | Undo keeps the pre-action snapshot after a Skim or a draw Duty; nothing checks for a draw or Skim event. `DuelScene.ts` | XS-S | duel |
| G3 | No Duty badge | A usable Duty shares the attackers' gold ring; `BoardCardView.setActionLabel` exists and only Hauntlink uses it | S | duel |
| G4 | The opponent's Duty says who, not what | The log names the card; the ability index is ignored, so it never says which Duty or its effect | S | duel |
| G5 | Concede reads "Tap to confirm" with a mouse and never disarms | Found by the 2026-09-25 re-check. `DuelScene.ts` | XS | duel |
| **Engine and replay** | | | | |
| G6 | Graveyard targets are stored by position | `{ kind: 'grave'; player; index }` and `graveIndex` on cast and Preserve actions, though graveyard entries carry an `instanceId` | M; the replay log bump to v15 | engine |
| G7 | "An activation cannot defer" throw, latent | `EffectInterpreter.ts` throws when a Duty raises anything but Foresee; the validator only catches a target after Foresee, and a test card passes the catalog check and still throws. No shipped Duty reaches it (census 2026-09-25: no Duty destroys or sacrifices) | S-M; fixed before First Dawn prints any Duty that removes a creature | engine |
| G8 | A held dies trigger ends a spell early | With a Hauntlink payable, a dies trigger raised mid-spell is held, and the op loop then returns without carrying the spell's remaining ops. Read in `EffectInterpreter.ts` (the rev-4 hold and the loop's pending branches); no test pins it | M; **confirmed 2026-09-25 by a failing test: seven shipped spells lost their remaining ops whenever a link was payable.** Fixed so a held trigger resolves where it would have resolved inline; rules.md records the rule | engine |
| **AI** | | | | |
| G9 | Paid Duties never used in main phase 1 | `activatedPolicy.ts` drops any Duty that costs mana in main 1, by design at the time | S, plus a floor re-measure (a brain change) | AI |
| **Art** | | | | |
| G10 | Cards drawn with the loading stand-in never redraw | The `art-file` event is emitted and nothing listens; `CardThumbCache` keeps a thumb baked from the stand-in | M | art |
| G11 | The half-resolution tier is not built for Pages | `deploy.yml` runs only the manifest step; the half-res script needs Python | S | art |
| **Menus and meta** | | | | |
| G12 | Starborne and Drowned Deep have no set achievements | Sands of the Duat has 3; Silver Veil, Dark Tales and Yokai Nights have 8 each | S-M; 15 names approved as written on 2026-09-25 and the Drowned Deep UR goal renamed "All Who Seek the Deep"; Sands of the Duat brought up to 8 in the same PR (five rows, names to approve); three stale descriptions fixed alongside | menus and meta |
| G13 | Achievements round 99.5% up to "100%" | `Math.round` in `AchievementsScene.ts` | XS | menus and meta |
| G14 | The Premium draft inspector counts every treatment as "plain" | "You own N/4 plain" adds copies across treatments; only plain copies melt | XS | menus and meta |
| G15 | Letter codes ("U·56 R·36") in the Limited Deck Builder | `deckStats.ts` via `LimitedDeckBuilderScene.ts`; "0 lands" is fixed | XS-S | menus and meta |
| G16 | Two copies of the "Leave draft?" dialog | Line-for-line copies in the two Limited scenes | S | menus and meta |
| G17 | Confirms that never disarm: Decks menu delete, Collection craft | Found by the 2026-09-25 re-check | XS | decks; menus and meta |
| G18 | "colours" in the stats panel | Everything else in the UI says "color". Found by the re-check | XS | menus and meta |
| **Layout** | | | | |
| G19 | ProfileScene is all literal coordinates | About 30 calls, no presentation module; Settings got one in #411 | M | profile |
| G20 | Title-safe misses left after #431 (the frame is x 64-1216, y 36-684) | Titles above y 36 in eight scenes (Gauntlet, Glossary, Limited, Practice, Shop, Limited Deck Builder, Limited Draft, the Deck Builder's Decks view); the Deck Builder title row at y 32 and its pool pager at y 688; the Duel HUD (portraits, life, piles and Undo at the edges); the Practice peek tile, inside the frame but 59 px wide against the 90 px tap floor | M; the Duel HUD part is layout-sensitive, so before-and-after screenshots go to the owner | duel; decks; menus and meta |
| **Telemetry** | | | | |
| G21 | The play-stats card batch covers only play before the first tab-hide (review E6) | The copy was fixed in #428; the behaviour is unchanged, and the ruling in [plan-telemetry-and-accounts.md](plan-telemetry-and-accounts.md) reads "once when the session ends" | M; D11 ruled | telemetry |
| G22 | The Keyword Guide and binder search miss Mark and Propagate on 29 cards | Found 2026-09-25 while designing G12: 27 Starborne and 2 Drowned Deep cards print "Marked", "gets a Mark" or "Whenever you Propagate", but `cardMechanics` does not report the mechanic, so the inspect panel does not explain the word and binder search misses them | S; every consumer of `cardMechanics` checked, the draft picker included | glossary |

**The 1.8.1 PRs, by file set.** Parallel agents never share a file; where two
groups touch one file, the second rebases onto the first.

| PR | Items | Files | Gate beyond the ladder |
| --- | --- | --- | --- |
| engine | G8, G7, G6 | `EffectInterpreter.ts`, `types.ts`, `actions.ts`, `Game.ts`, `view.ts`, `Replay.ts`, the AI's graveyard targeting | replay goldens; `REPLAY_LOG_VERSION` 15 |
| duel | G2-G5, G20's Duel HUD | `DuelScene.ts` (rebased on the engine PR's targeting change), `BoardCardView.ts`, `duelPresentation.ts` | before-and-after HUD screenshots to the owner |
| decks | G1, G17's delete confirm, G20's Deck Builder rows | `DeckBuilderScene.ts`, `DeckStorage.ts`, `deckBuilderHelpers.ts` | every discard path prompts (D10) |
| menus and meta | G12-G16, G17's craft confirm, G18, G20's other seven scenes and the Practice peek tile | `Achievements.ts`, `AchievementsScene.ts`, the two Limited scenes, `deckStats.ts`, `CollectionScene.ts`, `statsPrivacyPresentation.ts`, the scene title rows | G12's names and text authored first |
| profile | G19 | `ProfileScene.ts`, a new `profilePresentation.ts` | screenshots |
| art | G10, G11 | `ArtLoaderScene.ts`, `CardThumbCache.ts`, `CardView.ts`, `ArtResolver.ts`, `deploy.yml` (`BoardCardView.ts` after the duel PR) | no stand-in left on screen, a Pages build with the half tier |
| AI | G9 | `activatedPolicy.ts`, `tests/ai` | the two manual matrices; floors only ratchet up |
| telemetry | G21 | `signals.ts`, `gameBoot.ts`, `playSignals.ts`, the telemetry plan's line | a card counts once per launch (D11) |
| regens | the seventeen images | art files, `docs/spell-art.md` | the owner's eyes |
| Apex | Hauntlink Apex, option A | `src/data/cards/yokai-nights.ts`, a dated note in `src/data/opponents.ts` | Kitsune's matrix rows and the usage count |
| glossary | G22 | `src/data/glossary.ts` | every consumer of `cardMechanics` checked, the draft picker included |

Two constraints hold the patch to patch size. **No save schema change:** G1
is designed without a new deck field (legality is already computed), and if
it cannot be, it comes back to the owner. **One replay bump (v15) costs
players nothing extra:** #436 already changes the card-database stamp every
saved replay is checked against, so saved replays go stale with 1.8.1 either
way. G9 changes the brain, so the patch re-measures the floors, and the
release notes say the sweep measured the pre-fix brain. The notes follow the
shape accepted for 1.8.0.

**Shipped 2026-09-25** as v1.8.1, cut on the owner's word before the sweep's
later rounds (main carried a live crash; the sweep measures 1.8.0). Found at
the cut and carried here, with D7 in wave 4 (owner: "we can tune bosses
later"): **the Darlings summit.** In the Darlings format, R23 Chrome
Broodmother wins 21%, R24 The Violet Signal Queen 17%, R25 The Drowned Deacon
10% and R26 The Marsh-Mother 28%, against 62-77% for R19-R22. No gate covers
the Darlings rows, so tune those four lists and gate the Darlings rows (the
measurement is dated in `src/data/opponents.ts`).

### Lane A — the mechanics: Provoked and Hunt

**The cards come first, then the spec (D16, ruled 2026-09-28).** The spec,
`plan-first-dawn-engine.md`, is authored by an Opus 5.5 agent (design
documents are never Codex's) after the design-first overplan and its
concretion audit (lane B, steps 2-3), so it covers what the cards actually
need: Provoked, Hunt and every gap the concretion finds, with the fine print
answered from real cards. Starborne (64 of 151 cards the engine could not
express, found at transcription) and Drowned Deep (an extra effect-vocabulary
PR found at concretion) both showed that most of a set's engine work is what
its cards ask for, not its headline mechanics. The identity brief states
working assumptions for the questions below so the overplan can be designed
against them; the spec rules them. The questions, from the slate, the retired
overplan's own risk list, and today's code:

**Provoked** (the slate's Magic analog is enrage): *"Provoked: [effect]"
triggers when this creature survives damage.*

1. **The event boundary.** A new trigger kind, checked after the
   state-based pass that follows damage, so a creature that dies is never
   provoked. Combat and non-combat damage both count unless the spec says
   otherwise.
2. **Once per what.** Once per damage event, per damage step, or per turn.
   First Blade's two damage steps and several simultaneous sources are the
   cases the choice has to answer.
3. **Loops.** A Provoked effect that deals damage can provoke again. The
   overplan named this its first design risk. The spec needs a hard guard
   (once per turn is the simplest) or a data rule that no Provoked effect
   deals damage to your own creatures.
4. **Ordering.** Provoked and dies triggers from the same damage pass share
   one ordering rule, specified on top of G8's fix (a held dies trigger
   ending a spell early, fixed in 1.8.1).

**Hunt** (Magic's fight): *your creature and target creature each deal
damage equal to their Attack to the other.*

1. **A new op with two targets**, one of yours and one of theirs.
   `TargetSpec` already has `yourCreature`, `opponentCreature` and
   `exactly: 2`. The "arrives: Hunt target creature with this" shape uses
   targeted arrival triggers, legal since the Starborne ruling.
2. **Fizzle.** If either creature is gone at resolution, nothing is dealt,
   as in Magic.
3. **Keyword interplay.** Hunt damage is not combat damage. The recommended
   reading, as in Magic: First Blade does not apply, Deathblade and Blood
   Oath do, and Untouchable restricts the target as it does for any targeted
   effect.
4. **Efficiency.** The overplan's second risk: Hunt must not turn every
   green and red body into unconditional removal. That is a costing
   question as much as a design one.

**Both mechanics** carry the full blast radius the Starborne and Drowned
Deep waves paid:

- **Costing before cards ship** (the owner's rule, 2026-08-28): an MEP rate
  in the power formula for each, anchored to Magic precedent. Both Magic
  analogs postdate the 8th-10th-edition era the costing normally anchors to
  (fight became a keyword action in 2011, enrage appeared in 2017), so the
  derivation must say how it handles the era filter, per the MTG-db
  playbook, or cite older fight-shaped printings. Under D16 the overplan's
  Provoked and Hunt rows carry a provisional rate from that precedent,
  flagged NEEDS MATH as the rule requires, and the in-engine measurement
  replaces it before the owner's cut. No rate is quoted here; none exists
  until it is scored.
- **The AI at all three difficulties.** Hunt picks a target the hunter is
  favoured to survive. Provoked adds a survival bonus to block and attack
  evaluation. Each gets documented-behaviour entries and draft-picker
  weights.
- **Everything else the waves touched:** the deck converter's target walk
  (Hunt needs a creature on both sides, a two-sided dead-target case), the
  replay log version bump, the DuelScene two-target flow and its `switch`
  audit, rules-text templates and glossary entries with icons, and the
  blades-db dictionary rows (`terms --check`, the coverage guard). The
  keyword matcher must not light up the four existing card names that
  contain "Hunt".
- **A usage row from the first day** (lane E), so the new mechanics are not
  judged by win rate alone.

**The build splits in two (D15, amended by D16, ruled 2026-09-28).** Only
part of the list above stands between the spec and the owner's cut, so the
lane lands in two halves:

- **A1, on the critical path, after the spec is ruled:** the Provoked
  trigger and the Hunt op (on the v16 replay version I1 took in wave 0),
  every other vocabulary gap the concretion audit found and the spec kept,
  and the Hard brain's Hunt targeting and Provoked survival reads. The Hard
  reads belong here because the rates are measured in-engine by games the AI
  plays, and a naive target policy would price Hunt low. They read only the
  new trigger and op, which no shipped card carries, so they must leave the
  current pool's games unchanged; A1 proves that with the identical-action-log
  harness lane F builds in wave 1, rather than asserting it. Then the lab
  runs that produce both MEP rates, on the overplan's real card shapes (a
  Provoked 2/4 that draws, a Hunt on a five-Attack body), and the overplan's
  mechanic rows are rescored on them. The harnesses (`balance/study/lab/`) are
  gitignored and absent from a fresh worktree, so the lab runs from the main
  checkout or the harness is copied in, as `cheats.local.ts` is. A1 also owns
  entering the rates in the scorer: Provoked is a trigger and Hunt an op, so
  they are new terms in `src/power/scoreCore.ts` (not `KEYWORD_RATE` rows)
  and new sections in the local power formula, and the Forge reads them from
  the same code.
- **The damage path is evergreen (owner, 2026-09-28).** Hunt damage goes
  through the same source-creature damage path combat uses, so every
  damage-reading keyword and trigger, present or future, applies to it
  with no Hunt-specific code; combat-defined keywords (First Blade, Twin
  Blades, Overrun) do not. A1 builds that shared path; whether other ability
  damage from a creature joins it is a spec question (it would change
  shipped cards).
- **A2, beside the set work:** Medium and Easy, draft-picker weights, the
  DuelScene two-target flow and its `switch` audit, the converter's target
  walk, rules-text templates, glossary entries and icons, and the blades-db
  rows. A2 lands before transcription (wave 3), not before the overplan.

### Lane B — the set: First Dawn, 150-165 cards, authored fresh

**Owner ruling 2026-09-25: a fresh set, drafted by an Opus 5.5 agent.** The
July candidate list (`docs/expansions/drafts/first-dawn-overplan.md`,
deleted on this branch; history keeps it) had the same provenance as the
Drowned Deep list retired 2026-09-07: one commit on 2026-07-26, written
before the Warchest reserve, Duty and the 1.7 and 1.8 rulings. It carries 15
single-colour taplands the reserve cannot hold, no Duty cards, and boss rungs
19-20 on a tower that now stands at 26. What survives is what the
spine and slate fixed: the name, the prehistoric theme (adult cavewomen and
dinosaurs), and the two mechanics. Its three design risks are carried into
lane A: Provoked loops, Hunt efficiency, and marks-plus-Dawn engines that
wait several turns.

The authoring order is design first (D16, ruled 2026-09-28): the cards are
designed before the engine spec, so the engine builds what they need. The
rows carry no flavor text (R13):

1. **Identity brief**, approved by the owner before any rows: setting, the
   colour pie, what each colour does with Provoked, Hunt and Duty, enabler
   density per colour (the Drowned Deep cut failed it in white and red),
   the precon's plan, and the metagame it lands in. An attack-forward set
   meets a field where go-wide trails and reanimator is the weakest persona;
   the brief should say which of those it means to move. It also states
   **working assumptions** for the Provoked and Hunt fine print (lane A's
   questions), a **vocabulary discipline** rule (prefer the engine's
   existing vocabulary; each new trigger, op, static or condition must be
   justified by the cards that need it), and the colour pairs the new sweep
   personas play (D12).
2. **Overplan of about 200-215 candidates** for a cut of 150-165 (D2,
   ruled), designed against the brief. Every ordinary row is scored by the
   power formula at authoring time; Provoked and Hunt rows carry provisional
   rates flagged NEEDS MATH. Every row runs through the duplicate comparator
   against the live pool (it learned Duty, Tithe and Whispers in wave 0,
   #469), and the #436 catalog guard (no rules-identical printings in one
   set) applies from the first row.
3. **Concretion audit.** Every row is mapped to the engine's vocabulary; the
   output is the gap list, with the number of cards that need each gap, so
   the owner can drop expensive vocabulary by cutting the few cards that
   need it.
4. **The engine spec** (lane A) covers Provoked, Hunt and every kept gap;
   the owner rules it, A1 builds it, the lab measures the two rates on the
   overplan's shapes, and the mechanic rows are rescored.
5. **Cut**, on fully scored rows, with the owner's review of the upper
   rarities first (the Drowned Deep cut board worked this way), a protect
   list, enabler density as a cut constraint, and the AI-watch family named.
6. **Transcription.** The approved artifact is transcribed into data, by
   Codex or an Opus agent under contract; Codex never authors the prose. A2
   lands before it.

The rules the rows are written against, all postdating the old list: the
reserve takes only basics and duals, so the set prints no taplands and no
utility lands; Duty exists on artifacts, enchantments and creatures; no
non-creature permanent is a one-time effect; `extraLandDrop` keeps its mana
value 2 floor; marks are creature-scoped; the Empower ceiling holds; one
printing per set; no rules-identical printings in one set; every token has a
minter in the shipped cut; no "prevent combat damage" fog usable only on its
controller's own turn (the pattern shipped four times; `catalog.test.ts` has
enforced it since #429);
the 2026-08-30 text templates.

What the set carries besides cards:

- **Tokens**, each with a minter in the cut, checked by test.
- **A theme deck** (the tenth), built to hold the personas. Starborne's and
  Silver Veil's theme decks conceded 95-97% of sweep games; a precon that
  folds is a finding, not a flavour.
- **A summit pair at rungs 27-28**, with converter-owned Darlings decks
  regenerated on every pool change (generate, then sync), and floors set from
  the final band. The win-rate gates are split to fit CI's 900-second
  per-test budget. **Gate shape, decided 2026-09-28:** rungs 27-28 get their
  own test, the one-test-per-pair pattern `tests/ai/winrate.test.ts` already
  uses for rungs 23-24 and 25-26. The Darlings rows gain a gate in the same
  wave (the summit finding carried from 1.8.1, lane 0 above), scoped to the
  summit, rungs 23-28: at about 77 seconds a rung at 40 seeds (measured on
  rungs 14-22), the whole 28-rung tower would take about 2,150 seconds
  against the 900-second budget, and the summit about 460.
- **Set achievements.** Starborne and Drowned Deep get theirs in 1.8.1
  (G12); First Dawn ships with its own.
- An art-bible section, set icon, booster blurb, land style, the
  `SET_TITLES` entry, glossary and dictionary rows, and a blades-db rebuild.
- **Art is the long pole**: 150-165 card arts, the tokens and two boss
  portraits. Prompts are authored by the Opus agent, and Codex runs the
  pipeline on one lane. Large non-humanoid subjects (dinosaurs) are new
  territory for the prompt recipes, so a pilot batch of about ten goes
  through the owner's eyes before the full run. **The pilot runs before the
  cut (D15):** it tests the recipe, which needs subjects from the approved
  identity brief, not final rows. It runs in wave 2, once the art window
  height is picked (R13), together with the two rung 27-28 boss portraits.
  The two 1.8.5 regenerations below shake the pipeline down on the new
  window first. The full run then starts the day the cut locks. For scale,
  Drowned Deep's 256 images generated in about five hours on one lane
  (2026-09-14); the owner's review rounds, not generation, set the pace.
  Frame geometry stays deferred to 2.0 (D8 of 1.8), so First Dawn's art is
  cropped to today's frame.
- **Two 1.8.5 regenerations ride the art pilot** (owner, 2026-09-26:
  "Queue for regen in the 1.9"). Each gets a new brief and a new image, and
  its art entry is rewritten to match. Until then both ship with their
  current art.
  - **Swan-Lake Sovereign** lost Sentinel in the 1.8.5 rebalance, but its
    art still shows the pose, a wall of wings. Its art-bible entry changes.
  - **Brood Communion** dropped its Rite, but its spell art in
    `docs/spell-art.md` still depicts the sacrifice. It was added in 1.8.5's
    lane 5 (2026-09-28).

  Freya and Siege Juggernaut were queued too, but 1.8.5's D11 (2026-09-27)
  reverted both cards, so their art still matches.

### Lane C — accessibility

**Approved 2026-09-25.** The spec is
[plan-accessibility-i18n.md](plan-accessibility-i18n.md), written for 1.7 and
never started. It needed a re-verification pass against today's code before
wave 1: since it was written, Settings gained one layout rhythm (#411), every
menu control moved inside the title-safe frame (#412, #431), and
[design-system.md](design-system.md) became the token reference. **Re-verified
in wave 1 and approved by the owner on 2026-09-28**, every question as
recommended: three Settings tabs (Game, Audio, Accessibility), 100/115/130%,
scaling by text role, high contrast on chrome at 7:1, always-on cues, a
lighter `muted`, settings travel with an imported save, no telemetry fields.
Its measured inventory, the five disjoint C-workstreams, the per-control
ship gate (controls hidden until every scene passes) and the contrast gate
are in the plan itself.

Scope, per the plan: always-on cues that do not rely on colour (mana pip
shape, rarity, legal targets, selection, warnings); text size at Standard,
Large and Largest (100, 115, 130%); high contrast; and a reflow and
readability audit across every scene. Its waves 1-3 are this lane. The Story
scene it names does not exist yet and drops out of wave 3.

Three consequences of the rulings:

- **English only** (D3, ruled 2026-09-25). No `settings.locale`, no string
  catalog and no pseudo-locale: the plan's wave 4 closes by recording option
  A, and 2.0 carries no localization promise. Its pseudo-long English strings
  stay in the wave 3 fixtures, because text size needs them either way.
- **Mobile no longer rides with it.** The spine paired the two because both
  sweep every scene for reflow, so splitting them costs a second full sweep
  in 2.0. The mitigation is to build text scaling on the shared layout
  primitives (the design-system tokens and the title-safe frame) and never
  on per-scene literals, so the mobile pass reuses them. ProfileScene's
  presentation module (G19) and the last title-safe misses (G20) land in
  1.8.1, so this lane starts from a clean frame.
- **One save bump.** v35 to v36 adds `settings.textScale` and
  `settings.highContrast`, with a real `migrate()` and a test. Anything else in 1.9 that wants a schema
  change rides it, and it lands once. The one rider known today is I7, the
  stored Premium draft note (lane I). The bump lands in wave 2, before the
  fixtures of accessibility waves 2-3 have proven that 130% reflows, and the
  accessibility plan wants the scale values adjustable until then. So
  `textScale` is stored as a number and the allowed set (100, 115 and 130%
  today) is a normalization rule: changing the set later snaps old values
  to the nearest allowed one and is not a schema change.

Gates: the plan's scale-and-contrast fixture matrix, a human colour-vision
and clipping review, and no gameplay re-measure unless duel dispatch changes.

#### Card face: no flavor text, a taller art window (R13)

**Owner ruling 2026-09-25: remove flavor entirely.** It came from Magic and
does no work here. The owner's aim is larger art, and the freed room goes to
it. It sits in this lane because it is also a legibility change: the rules
text stops sharing its box.

What changes:

- **The card face.** `CardView` loses the flavor block and its hairline, and
  the rules text keeps the whole box. The art window grows from 264x192 into
  the freed room, and the type line and text box move down with it. The
  frame is drawn in code (`CardFrameFactory`), so this is a geometry change,
  not new frame art. Full-art variants already drop flavor and do not change.
- **The card data.** `flavor` leaves `CardDef` (`src/engine/types.ts`) and
  every row that carries it: 1,486 of 1,487 cards, tokens included. Its other
  readers go with it: the Limited pane (`limitedPanePresentation`,
  `LimitedDeckBuilderScene`), the card-layout and set data tests, the
  art-bible generator scripts, the [adding-cards.md](adding-cards.md)
  template, and the card anatomy in [design-system.md](design-system.md).
  The replay db stamp hashes whole definitions, so it changes. Lane A's new
  cards change it anyway.
- **The art band.** A card shows the middle band of each 640x800 image, rows
  21% to 79% today. At 216 px it would show 17% to 83%: more room above every
  head across the catalog, with no regeneration. The art bible's window band
  and its head-top rule (§3, head top at or below y 208) move with it, and so
  does `audit-art-window.py`. The newly visible top and bottom strips get one
  automated pass for artifacts and seams, plus a spot check. That is not a
  catalog audit, which the owner ruled out on 2026-09-25.
- **Lane B.** First Dawn rows carry no flavor. Its art briefs compose for the
  new window, so the height must lock before the art run starts.
- **Mobile (2.0).** The Version C canvas dropped flavor on the owner's
  direction (version 3). The no-flavor renderer carries over. **The art band
  does not**, measured by the mobile research session on 2026-09-25 in
  headless Edge. A 240 pt phone face (the largest the phone's content height
  allows) shows 46% of the art height today, and it clips at 7 lines of
  rules. At desktop's 58% band it holds 3 lines of rules. At 65% (the 216 px
  pick) and 69% (the 228 px pick) it holds 1, and 0 or 1 at 130% text. A
  phone face cannot show the desktop band and also carry the rules. The
  options, for a 2.0 ruling, with the research session's recommendation
  first:
  - **(a) An art-first phone face.** The face shows the name, the art at the
    desktop band, the cost, P/T and a keyword row. The full rules live in the
    panel Version C already puts beside every enlarged face. Grids keep a
    tap-to-inspect.
  - **(b) The rules stay on the phone face** at a narrower band, about 46%.
    The art grows on desktop only.
  - **(c) The rules box sizes to its content,** so the art grows only on
    short-rules cards and the crop varies from card to card.

  The desktop work does not wait on this ruling.

The first step is a mock, and the owner picks the height from it: before and
after captures at 216 and 228 px, on the densest rules text and the images
whose heads sit near the crop. Beside them sits one phone face in option (a),
so the owner can see the mobile trade-off at the same sitting. A rough estimate from text length, to be
confirmed in the renderer: about 133 cards shrink their rules text today to
make room for flavor. With no flavor, about 45 would shrink at a 76 px box
(art at 216) and about 132 at a 64 px box (art at 228).

Gate: the owner approves the mock; the renderer counts cards shrunk below
13 px at the chosen height; `check-art-bible` and `check-docs` are green; and
no `flavor` reader is left (`git grep` clean outside history docs).

**RULED 2026-09-28: the art window is 216 px** (D18). The wave-1 mock
(prototype branch `proto/19-r13-mock`, not merged; its
`src/ui/cardFaceGeometry.ts` is the reusable part) measured it in the
renderer over all 1,482 collectible cards:

| Art window | Image rows shown | Rules text shrunk below 13 px |
| --- | --- | --- |
| 192, today, with flavor | 20.9% to 79.1% | 157 |
| **216** | 17.3% to 82.7% (y 138-662) | **50** |
| 228 | 15.5% to 84.5% | 141 |

At 216 the rules box holds four lines at 13 px; at 228 it holds three. The
art bible's head-top rule moves with the band to about y 179 of 640x800. The
wave-2 build also points the Forge's own copy of the art rect
(`src/forge/framing.ts`, `CARD_ART_RECTS.standard`) at the shared geometry.
One card, Umbral Antenna, has no flavor to give up and shrinks to about 8 px
at 216; its text is shortened in a wave-2 design pass (the owner's call on
what to cut is open).

### Lane D — card art streaming: load on demand, unload under a budget

**Approved 2026-09-25**, the named follow-up to the 1.8 boot work (#410,
#432). Where it starts: `src/art/artLoader.ts` streams the whole manifest
behind the menu in batches of 48 with a front lane for gated scenes, so the
menu opens in about a second, but all 1,537 card textures still end up
resident (3.0 GB of GPU memory, measured 2026-09-21), and Collection and the
Decks view wait on the whole manifest.

1.9 makes a card's texture load when a surface asks for it and unload when
it falls out of a texture budget. That bounds residency and makes
Collection open at once. Known traps from the 1.8 build:

- `CardThumbCache` bakes are permanent, so evicting a source texture must
  invalidate its bakes or leave them alone deliberately. A missed gate
  already bakes a dim thumb for the session.
- Cards first drawn with the loading stand-in never redraw when the real
  art arrives. The redraw on arrival lands in 1.8.1 (G10); streaming makes
  it the normal case, so this lane builds on it. Portraits did not get it
  (I9, lane I); that fix lands in wave 1, before this lane.
- A texture destroyed while a game object still references it is a crash,
  or Phaser's green square. Pack opening needs its art before the flip; a
  duel preloads both decks.
- **The itch.io build caps the design (researched 2026-09-25).** itch hosts an
  HTML5 game as at most 1,000 files (500 MB total, 200 MB a file); the web
  build holds about 3,100 today, about 1,600 without the half tier, so card
  art ships in a few pack files plus an offset index. itch's CDN serves byte
  ranges, so a card can still be fetched on demand, but packs need an
  extension itch does not pre-gzip (not `.js`, `.css`, `.pck`) and a content
  hash in the name, since its caching varies. The same packs serve Pages.
- The half-resolution tier reaches the Pages deploy in 1.8.1 (G11); this
  lane's budget counts on it for the phone tier. Half-resolution art on
  desktop was rejected in 1.8,
  because the zoom preview draws up to 733x1045 px at 1440p.
- The desktop app loads over its own protocol and needs its own run, with
  the second-pass retry from #432 in place.

Gates: GPU residency and time-to-Collection measured before and after on the
desktop and phone tiers; no stand-in left on screen after arrival across
every scene at two sizes; a desktop app run.

**The design is [plan-art-streaming.md](plan-art-streaming.md)**, approved
by the owner on 2026-09-28 with its questions answered as recommended (S-Q5,
a persistent art cache, not in 1.9). It measured the "before" state:
Collection waits 16 s locally and 44 s at 50 Mbps, with 3,002 MiB of card
textures resident on desktop and 750 MiB on the phone tier. The design caps
texture memory at about 832 MiB on desktop and 208 MiB on phones, and ships
as PRs S1-S6.

**Scope (D17, ruled 2026-09-28).** 1.9 has no fixed date. Its minimum is the
expansion with its engine work, accessibility, and bug fixes. This lane sits
outside that minimum, and nothing in it is deferred in advance; if 1.9 runs
long, the design names S2 (the packs) and the long tail of S5a as the parts
that can move to 2.0 without making the itch build harder.

### Lane E — measurement: the mechanic usage audit

**On the list by the owner's ruling (U1, 2026-09-25).** The spec is
[plan-mechanic-usage-audit.md](plan-mechanic-usage-audit.md): a read-only
decorator on the row AI behind `--usage` on the balance matrices, counting
per boss and per mechanic the turns with a chance, the turns taken,
cast-when-seen per card, and uses per cast. It changes no shipped behaviour,
and one test proves identical win counts with and without it. U2-U5 were
ruled 2026-09-25 as the plan recommended (D5): the code lives in `scripts/`,
passive mechanics stay out of waves 0-2, there is no usage gate in CI until a
full audit shows what normal is, and Hard goes first, then one Medium pass.

Sequencing (D15, re-ordered 2026-09-28): its waves 0-1 (the classifier, the
wrapper, `--usage`) are scripts only, so they start the day `release/1.9` is
cut and land before lane A's AI work, so Provoked and Hunt ship with their
usage rows. Its wave 2, the first full audit of rungs 1-26, runs in the
program's wave 2, not wave 4, and is read into a findings note. Its wave 3
fixes what that note justifies, behind the unchanged gates, in the program's
wave 3. The tower is then tuned once, in wave 4, on a brain that has stopped
moving (D7's intent). The one finding already known, paid Duties unused in
main phase 1, is fixed in 1.8.1 (G9), so the first audit measures the fixed
brain.

- **The wave-1 gate is re-based.** The audit plan's wave-1 gate reproduces
  the hand counts in [ai.md](ai.md) for Kitsune and the Queen of the
  Lanterned Roof, but those were taken on 2026-09-19. G9, Apex option A and
  1.8.5 have moved them since. The gate is a fresh hand count on the
  current tip, taken the same way, that the wrapper must match.
- **A second, targeted read opens wave 4.** The first audit predates First
  Dawn's rows and rungs 27-28, and the audit plan says it runs once per set
  before the tuning passes. So wave 4 opens with a read of rungs 27-28 and
  of every boss whose regenerated list gained First Dawn cards, about ten
  minutes, before any tune. Provoked and Hunt are then judged by use as
  well as by win rate.
- **Brain changes and floors** follow the rule in Sequencing: each wave-2
  and wave-3 change is measured and must clear the standing floors, and the
  floors ratchet once, at the end of wave 4.

**Carried from 1.8.5**, three findings from the 1.8.5 labs the first audit
should count. Each fix is a wave-3 AI change behind the gates. **Approved by
the owner 2026-09-28 (D13)**, so they need no further go once the audit's
note backs each one:
- **Ramp** is valued at 0 and cast late.
- **Starborne Apotheosis** is cast with no Marked creature, and Brood
  Communion on empty boards.
- Some **granted keywords** are still priced flat.

The details are in [ai.md](ai.md) ("Gaps the 1.8.5 labs found") and in
"Carried from 1.8.5" above.

**Carried from the 1.8.1 cut**, for the first audit to count. None is
approved as a change yet; each needs the audit's evidence first. The first
three are recorded as known limits in [ai.md](ai.md); the fourth was logged
by the 1.8.1 AI review and is recorded here:

- A chump block that kills nothing reads as worthless before combat.
- Lethal is judged against greedy blocks.
- Medium's re-pick after a Hard veto skips Hard's search.
- A Duty used in main phase 2 leaves its creature tapped through the
  opponent's turn, and nothing counts that cost.

### Lane F — the sweep: weenie's cost, racing, and the Medium screen

Where it stands: the sweep runs on GitHub-hosted runners
([metagame-sweep.md](metagame-sweep.md)), fanned out per persona, with
crafts that span jobs on a time budget (#418, #421, #422), byte-identical to
the in-process loop.

1. **Weenie's cost in the Hard brain** (R9). Measured 2026-09-23 on the
   hosted runners: a weenie game costs the Hard brain about ten times a
   midrange game (long go-wide boards), about 20 minutes per 150-seed
   measurement and about 27 hours per craft; its round-0 chunk hit the
   351-minute job timeout. The work: profile the Hard brain's combat
   evaluation on wide boards, and fix it without changing decisions where
   possible. The proof is identical action logs on a seeded set of weenie
   games before and after. The harness that proves it (seeded games, action
   logs compared line by line) is built in wave 1 with the profiling, because
   A1 needs the same proof in wave 2. A fix that must change decisions is a
   brain change: it needs the owner's word, and it is measured against the
   standing floors like every other mid-train brain change. Then weenie
   rejoins the sweep, six personas again; its return is proven by the wave-5
   sweep, not by a mid-train one.
2. **Racing the swaps** (lever 2 of [plan-sweep-speed.md](plan-sweep-speed.md)),
   behind `--race`: measure a candidate swap in batches and stop once it is
   outside the incumbent by more than the noise at that sample size. The
   accepted swap keeps its full-precision measurement.
3. **The Medium screen** (lever 3), behind `--screen medium`: a swap that is
   clearly worse under Medium, which is six times cheaper, never reaches the
   Hard measurement, and only the Hard measurement accepts a swap.
4. **Acceptance**, per that plan's third decision: one persona, the same
   seed, raced and screened against unraced, with the accepted lists and
   their final win rates side by side. If they agree within noise, the flags
   become the default and the hosted workflow gains the inputs. This is two
   crafts of one persona, not a sweep, so it does not break the "no
   mid-train sweep" rule.
5. **Close the sweep's colour gap (D12, ruled 2026-09-28).** The personas
   play black-white, red-black, white-blue, black-red and blue-black.
   Weenie's green-white ran on the first day only. So the sweep has nothing
   to say about green or red-white cards, and 15 of the 48 nerfs 1.8.5
   reverted sit in that gap. First Dawn will likely lean the same way: Hunt
   is Magic's fight, a green mechanic, and Provoked is its enrage, red and
   green. A sweep blind to those colours cannot catch a degenerate First
   Dawn deck, which is the whole reason it runs last. So the sweep gains
   personas that play First Dawn's colours, matched to the colour pie the
   identity brief sets (green and red-white at least). They are built in
   wave 2, once the owner has approved the brief, beside the levers'
   acceptance run. The 1.9 sweep then backs or clears those nerfs with play,
   and measures the new set.

The levers (`scripts/personas/craft.ts`), the personas
(`scripts/personas/templates.ts`) and the hosted workflow's inputs and
default persona list (`.github/workflows/metagame-sweep.yml`) share files, so
one agent owns lane F's files at a time.

The target is a sweep that fits in a night again, so the 1.9 sweep can run
last before the cut, the standing rule the 1.8 ruling suspended (D9).

### Lane H — measurement and release mechanics

- **One save bump** (v36, lane C, carrying I7); 1.8.1 and 1.8.5 carry none.
  **Replay log bumps**: v15 in 1.8.1 (G6), and one bump to v16 in 1.9.
  `src/meta/Replay.ts` bumps the version for any observable engine change,
  and I1's fix is observable (a draw and a deck-out loss that were skipped
  now happen), so I1 takes v16 in wave 0, on `release/1.9`, and lane A's
  mechanics ride it. No player loses a replay early: `release/1.9` deploys
  only at the cut, and R13 and First Dawn change the card-database stamp at
  the same cut anyway. The bump must add v15 to the literal version lists
  in `payloadShape` and `valid`, or v15 logs fall to the legacy shape.
- Every new mechanic gets its rate before card data. The balance matrices
  re-run when the AI or decks move; floors only ratchet up.
- **The tower at 28 rungs**: rungs 27-28 get their own gate test, and the
  summit's Darlings rows (23-28) gain one (lane B, decided 2026-09-28).
- **The sweep runs last** against the final field, on six personas plus
  the colour-gap personas (D9, D12).
- The cut follows the checklist that works: three version surfaces plus
  `Cargo.lock`, `app:build` before tagging, `docs/release-notes/v1.9.0.md`
  in the shape the owner accepted for 1.8.0 as the release body, README
  figures re-measured, the two manual matrices, a two-parent merge into
  `main`.

### Lane I — the follow-ups logged at the 1.8.1 cut

**Owner ruling 2026-09-28 (D14): place them where they make sense, earlier
is better.** The 1.8.1 build and its reviews logged these for 1.9 on
2026-09-25; until now they were in the session notes only. Each is
re-checked against the code when it is picked up. The wave is the earliest
one whose file set does not collide with work already running.

| # | Finding | Where | Wave | Why then |
| --- | --- | --- | --- | --- |
| I1 | A queued Foresee whose deck empties before it is offered drops the rest of its effect, so a draw is lost and the deck-out loss is skipped | `src/engine` (the foresee op in `EffectInterpreter.ts`, the offer in `Game.ts` ~575) | **0**, into `release/1.9` | A rules bug, and lane A builds on this machinery. Failing test first. Takes the v16 replay bump (lane H) |
| I2 | Three UI helpers still compare graveyard targets by position (`sameDutyTarget` in `duelPresentation.ts`, `drownedDeepChoices.ts`, `targetSelection.ts`). They compare by `instanceId` when present and fall back to position, as DuelScene's `sameGraveCard` already does. The engine's `TargetRef.instanceId` stays optional, because v6-v14 replay logs carry position-only references | Duel UI helpers | 1 | Before A2's two-target flow touches targeting |
| I3 | Deck codes carry neither the Warchest nor the Darling, and importing one replaces the open deck without asking | `DeckCode.ts`, the Deck Builder's import | 1 | A share-code format change: new codes carry both, old codes still import (golden fixtures) |
| I4 | Land styles cannot be reached for Standard and Darlings decks | Deck Builder | 1 | Same file set as I3 |
| I5 | The Free Draft payout copy | The Limited scenes | 1 | Copy; the wording goes to the owner, no em-dashes |
| I6 | The tutorial opponent shares the Mousekin portrait | Where the tutorial opponent's portrait is picked (not `src/data/tutorial.ts`, which holds only the two fixed decks; likely DuelScene's tutorial branch), found at pickup | 1 | If an existing unused portrait fits; a new one rides the wave-2 art pilot |
| I7 | The Premium draft note shows on the first Deck Builder visit only; keeping it needs its summary stored | The Limited scenes, `SaveManager.ts` | 2 | A save change, so it rides the one v36 bump (lane C) |
| I8 | Achievement evaluation rebuilds the goal pool on every call (about 20 ms more on the menu since the catalog grew to 108) | `src/meta/Achievements.ts` | 1 | Independent |
| I9 | Portrait art never redraws when it arrives; 1.8.1 gave cards `redrawWhenArtLands` (G10) but not the portrait call sites | Eight sites: `DuelScene.ts`, `GauntletScene.ts`, `LimitedDraftScene.ts`, `PracticePickerScene.ts`, `ShopScene.ts`, `CommanderPortrait.ts`, `saveCard.ts`, `VersusBumper.ts` | 1 | Before lane D makes late arrival the normal case |

The wave-1 items go out as PRs by file set: I6 with I9 (both touch the
portrait sites, `DuelScene.ts` among them), then I5 after them (it shares
`LimitedDraftScene.ts` with I9); I3 with I4 (the Deck Builder); I2 (the duel
helpers); I8 (achievements). Everything but I5 can run at once.

Two more carried items join existing lanes: the four AI limits above go to
lane E's first audit, and the six avatar ladder inversions and the Festival
Rocket x4 re-measure ([ai.md](ai.md)) join D7's wave-4 pass.

## Moved out of 1.9

| Item | New slot | What that means |
| --- | --- | --- |
| **Mobile overhaul** ([plan](plan-mobile-overhaul.md)) | **2.0**, the itch.io launch (D4, ruled 2026-09-25) | **Duel layout decided 2026-09-25: Version C, "Command column (hand-first)"**; the research session mocks every scene and Duel state on it next. The two cheap proposals (stop blocking upright tablets, art on the rotate screen) park with it. The standing Tier 1 real-device pass is unchanged |
| **AI suggested decks** ([plan](plan-suggested-decks.md)) | **After 2.0** | Tutor v1 and the replay coach stay on one arc. A browser tutor needs a cheap evaluator; lane F's Medium screen is the nearest thing to one |
| **Editable Limited Warchest** | **After 2.0** | The pip-demand-weighted automatic fill from #279 stays the only build |
| Live spectating ([plan-player-replays.md](plan-player-replays.md) wave 4) | Cancelled | It rode multiplayer, cancelled 2026-08-24 |
| **Older-set near-duplicates** (D8) | **1.9.x** | A whole-pool review and resolution plan once the comparator is fixed (wave 0); the owner approves the rule and the slate; fixes ship in a 1.9.x patch |

## Sequencing

Waves are dependency-ordered. Within a wave, lanes run in parallel in
separate worktrees, by file set.

**What sets the pace (D15, re-ordered 2026-09-28; D16 the same day).** The
critical path runs through First Dawn: the comparator fix, then the identity
brief and the owner's approval, the design-first overplan and its concretion
audit, the engine spec and the owner's rulings, A1 and the measured rates,
the rescore, the owner's cut, the art bible, the art run, transcription, the
tower content, the wave-4 tune, the sweep and the cut. Machine time on that path is short:
Drowned Deep's engine core took Codex about 40 minutes once its questions
were answered, and its 256 images about five hours. What took days was
spec, ruling, brief, cut and art review. So the waves put everything the
owner reviews in front of the owner early, in as few sittings as possible,
and run lanes C, D, E, F and I underneath those waits.

| Wave | Critical path | Alongside | Gate |
| ---: | --- | --- | --- |
| **0** | 1.8.1 and 1.8.5 shipped; this plan synced (2026-09-28, a PR into `main` with the workbench-skill chore); then `release/1.9` cut from `main`; then, into `release/1.9`, the duplicate comparator learning Duty, Tithe and Whispers | I1 (Foresee on an empty deck, failing test first, v16) into `release/1.9`. Nothing in wave 0 but docs and the chore reaches `main` | the ladder on each PR |
| **1** | The First Dawn identity brief (Opus 5.5; it names the rung 27-28 bosses, the colour pie, the colour pairs for the new sweep personas, and the working assumptions for Provoked and Hunt); the card-face mock at 216 and 228 px with one phone face (R13) | Usage audit waves 0-1 (gate: a fresh hand count on the tip); weenie profiling and the identical-action-log harness; sweep levers 2-3 built; the accessibility plan re-verified; the art streaming design within itch.io's limits; lane I's wave-1 PRs | **one owner sitting** for the brief, the art window height, the accessibility plan and the streaming design |
| **2** | The design-first overplan (provisional NEEDS MATH rates on the mechanic rows), its concretion audit and gap list, then `plan-first-dawn-engine.md` (Provoked, Hunt and the kept gaps) and **a second owner sitting** to rule it; then A1: the vocabulary, the Hard reads (after the weenie fix, proven identical on the current pool), the lab rates on the overplan's shapes entered in the scorer, and the mechanic rows rescored. In series beside it: R13 built, then the two 1.8.5 regenerations on the new window, then the art pilot with the boss portraits | The weenie fix; the first full usage audit and its findings note; the colour-gap personas (after the brief) and the levers' one-persona acceptance run; accessibility wave 1 with the v36 bump (and I7); art streaming built; the D8 whole-pool near-duplicate review, with a stat-ladder pass added to the comparator first (its fixes ship in 1.9.x) | full ladder, win-rate gates unchanged, replay goldens, the no-change tests, the owner's eyes on the pilot |
| **3** | The owner's cut on fully scored rows, the art bible, the art run, transcription (carrying the converter regen of the boss lists) | A2 (before transcription); the usage audit's fixes (D13); accessibility wave 2 (core scenes) | check-art-bible green, every token minted, duplicate audit filed, standing floors cleared |
| **4** | In order: the balance card edits (the 1.8.5 items and D7's), one converter regen, rungs 27-28 and the theme deck, the targeted usage read, the tunes (the top tier, rung 19, the Darlings summit R23-R26, the ladder inversions, Festival Rocket, the RUNG_BANDS 1-13 re-centre), one measurement, then the floors ratchet once and the new gates land (rungs 27-28, the summit's Darlings rows) | Accessibility wave 3 (long tail) | matrices, precon and boss floors, fixture matrix |
| **5** | QC day, the sweep last (six personas plus the colour-gap personas), release notes, the 1.9.0 cut | | the cut checklist |

**Shared files, in order.** Parallel agents never share a file; where two
lanes touch one, the order is fixed here:

- `src/ui/CardView.ts`: R13 first, then lane D's redraw and eviction hooks,
  then accessibility's card surfaces.
- `src/engine/types.ts`: A1's new trigger and op first (the critical path),
  then R13's removal of `flavor`, which rebases as a one-line change.
- The card data files under `src/data/cards/`: R13's flavor strip touches
  every set file, so it lands before any wave-4 balance edit and before
  First Dawn is transcribed.
- `src/ai` (`combatPlans.ts`, `HardAI.ts`, `evaluate.ts`, `targeting.ts`,
  `value.ts`): the weenie speed fix, then A1's Hard reads, then A2, then the
  usage audit's fixes. The weenie fix goes first because its proof
  (identical action logs before and after) needs a brain nobody else is
  changing, and A1's reads then prove the same against it.
- `src/scenes/DuelScene.ts`: I6 and I9 (wave 1), then lane D's duel preload
  (wave 2), then A2's two-target flow, then accessibility's Duel pass (both
  wave 3).
- `src/data/opponents.ts`, `tests/ai/winrate.test.ts` and
  `scripts/balance-matrix.ts`: one agent at a time, in wave 4's order. The
  converter rewrites the untuned boss lists in `opponents.ts` in place, and
  `tests/data/avatarReserveDecks.test.ts` pins them to its output, so a
  regeneration and a hand edit cannot run side by side.

**Brain changes and floors.** Floors only ratchet up, and the tower is tuned
once. So every brain change before wave 4 (the weenie fix if it must change
decisions, A1's Hard reads, which must not, A2, and the usage audit's fixes)
is measured on the matrices and must clear the standing floors; none of them
raises a floor. If one drops a boss below her floor, the change is reverted
or her list tune is pulled forward, never the floor lowered. First Dawn's
transcription regenerates the converter-owned boss lists, so it carries that
regeneration, and the drift it causes is read in wave 4. The floors ratchet
once, at the end of wave 4, on the measurement that follows the tunes.

For scale: the 1.7 train (151 cards plus an engine wave) ran 2026-08-24 to
09-03, and 1.8 (252 cards, Duty and telemetry) ran 2026-09-07 to 09-24. 1.9
is the 1.7 shape plus accessibility, art streaming and the measurement work;
the owner's review turnaround decides most of the calendar.

## Decisions for the owner

Numbered so rulings can cite them. Recommendations are the first option.

**Ruled 2026-09-25:**

- **D1 The keyword's form. RULED: Provoked.** It reads as a trigger
  ("Provoked: draw a card") and keeps clear of Magic's own Provoke (Legions,
  2003), an unrelated forced-block keyword the blades-db translation would
  otherwise mis-map.
- **D2 Set size. RULED: 150-165**, overplanned to about 200-215. The exact
  count and its rarity histogram lock at the cut. Starborne's shares give
  75 C / 45 R / 14 SR / 10 SSR / 7 UR at 151 and 82 / 49 / 15 / 11 / 8 at
  165; the brief proposes the histogram with the count.
- **D3 Localization. RULED: English only** (option A). No locale field, no
  string catalog, no pseudo-locale; 2.0 carries no localization promise.
  Accessibility still precedes Story Mode, for text size.
- **D4 Mobile. RULED: 2.0.** The owner's framing: 2.0 is the largest update
  the game has had, the release that goes to itch.io and is advertised, so
  the phone experience ships with it. This sets aside, for 2.0 only and by
  design, the cadence rule that a Large release carries little besides its
  set and engine feature. If 2.0 needs relief, Story Mode stays the spine's
  separable piece. The itch.io launch has no plan yet; one is owed when 2.0
  opens (see the roadmap entry).
- **D5 Usage audit U2-U5. RULED: the audit plan's own answers.** Code in
  `scripts/`; no passive mechanics in waves 0-2; no usage gate in CI until a
  full audit shows what normal is; Hard first, then one Medium pass for the
  player-side starter columns.
- **D6 1.8.1 timing. RULED: cut 1.8.1 when the post-release sweep's reading
  is in**, carrying lane 0 (the 1.8.x items and the review carry-over);
  `release/1.9` is cut from `main` after it. **Superseded in part:** 1.8.1
  was cut on 2026-09-25 ahead of the sweep, on the owner's word. 1.8.5 was
  then inserted before wave 0 (plan-1.8.5 D8), so `release/1.9` is cut after
  1.8.5.
- **D8 The older-set near-duplicates. RULED: a review and a resolution plan,
  resolved in a 1.9.x patch.** Known today, from the 2026-09-24 review: six
  same-tribe stat ladders (Ragnarök and Duat twice each, Starborne twice),
  and two pairs that differ only by a rider's cost (Duat's The Debt Is Called
  against Two Jars, One Heart, Retell {2}{B} against {3}{B}; Dark Tales'
  Ocean Wayfinder against Tide-Reader of the Far Reef, Skim {2} against
  {1}). The review covers the whole pool, not only these rows, and can run
  any time after wave 0 teaches the comparator Duty, Tithe and Whispers. It
  writes the rule (which kinds of sameness are acceptable) and a slate, the
  owner approves both, and the fixes ship in 1.9.x. Review and slate
  PROPOSED 2026-09-28 in
  [d8-near-duplicate-review.md](d8-near-duplicate-review.md): 51 pairs, 41
  cards; awaiting the owner's rulings.
- **D10 An unfinished deck (G1). RULED as recommended:** save always works;
  an incomplete deck saves as it stands and shows as unplayable where decks
  are picked; every path that would drop unsaved work asks first (the Decks
  menu, opening another deck, the format switch, the Darling pick). Legality
  is already computed, so no save field is needed.
- **D11 The play-stats card batch (G21). RULED as recommended:** send at
  every hide, but only the cards not yet sent this launch, so a card still
  counts once per session and the rollup's k=10 floor keeps its meaning. The
  privacy copy since #428 ("when you leave or close the game") already reads
  that way; the telemetry plan's "once when the session ends" line is updated
  to match in the same PR.

**Ruled 2026-09-25, the last two:**

- **D7 The balance items found in 1.8 but not on the ruled list. RULED as
  recommended**, item by item:
  - **Hauntlink Apex.** Since rules revision 4 made a link an ability paid
    after casting, it effectively costs 8 mana in a ten-land format, and it
    is cast in 7% of games (AI audit, 2026-09-19). The cause is already
    measured, so waiting for the audit adds nothing: **a small card slate,
    authored by the design model and picked by the owner, riding 1.8.1**.
  - **The tower's top tier (T6)** read 64.9% on QC day, down from 72.0%
    during 1.7; its band was re-centred to .585 and the tune-up left for
    1.9. **Tune in wave 4**, after 1.8.1's paid-Duty fix and lane F's weenie
    work have moved the brains, so it is tuned once, not twice.
  - **The Queen of the Lanterned Roof (rung 19)**, the one converter defect
    measured (58.6 to 63.9 with her authored cards restored) and the
    thinnest untuned boss. **Tune in wave 4** with the same pass: restore her
    list, confirm on the wide matrix, raise her floor toward .57.
  - **Reanimator**, the weakest sweep persona. **No direct change**; the
    full sweep reading and the First Dawn brief decide whether the pool
    needs graveyard tools.
  - **Collection dilution**, deferred until a finished sweep. **Revisit in
    wave 4**, once First Dawn's count is final, because every set dilutes
    the pool further.
- **D9 Where the sweep runs. RULED as recommended.** The standing rule is that the metagame sweep
  runs last before a cut, so the balance numbers describe the field players
  get. 1.8 set it aside because a sweep took days; it ran after launch with
  five personas. Recommendation: **back to last before the 1.9.0 cut, all six
  personas**, once lane F's weenie fix and the two levers are in. The test is
  a measured one: if a full six-persona sweep finishes in about a night on
  the hosted runners, it runs before the cut and a degenerate deck is caught
  before players see it. If it still takes days, the 1.8 arrangement repeats
  (after launch, a hotfix only if egregious). It runs on GitHub-hosted
  runners either way, so the owner's machine is free.

**Ruled 2026-09-28, at the start of wave 0:**

- **D12 The sweep's colour gap. RULED: close it.** The sweep gains personas
  in First Dawn's colours (green and red-white at least, matched to the
  identity brief's colour pie), built in lane F in wave 2. See lane F item 5.
- **D13 The AI fixes 1.8.5 handed on. APPROVED:** ramp valued by cast turn
  instead of 0, Starborne Apotheosis and Brood Communion cast only when they
  do something, and granted keywords priced by the body. Each lands as a
  lane E wave-3 change behind the unchanged gates, once the first audit's
  note backs it.
- **D14 The follow-ups logged at the 1.8.1 cut. RULED:** placed where they
  make sense, earlier being better. They are lane I; I1 runs in wave 0.
- **D15 The waves re-ordered around the critical path. RULED as
  recommended:** lane A splits into A1 and A2; the art pilot runs before the
  cut; the first full usage audit moves to wave 2; the shared-file order in
  Sequencing holds. Lane D is the lane to defer if 1.9 runs long.

**Ruled 2026-09-28, after wave 0 closed:**

- **D16 The cards before the engine spec. RULED:** the owner asked whether
  the cards should come first so the engine builds what they need, and
  approved the order that follows: the identity brief (with working
  assumptions for the fine print and a vocabulary discipline rule), a
  design-first overplan with provisional NEEDS MATH rates on the mechanic
  rows, a concretion audit listing the vocabulary gaps with card counts, the
  engine spec covering Provoked, Hunt and the kept gaps, A1 and the lab on
  the overplan's real shapes, the rescore, then the cut. It costs the owner
  one more review sitting and removes the risk of an unplanned engine wave
  at transcription, which Starborne paid. It amends D15's A1 placement.
- **The comparator follow-ups (#469), as recommended:** the #436 catalog
  guard keeps its own rule (every subtype counts), separate from the
  comparator's paid-off-tribe rule; a stat-ladder pass (same text and cost,
  different stats) joins the comparator ahead of the D8 review in wave 2.
- **The wave-1 sitting (the owner, 2026-09-28).**
  - **The First Dawn brief is APPROVED**
    ([first-dawn-brief.md](expansions/drafts/first-dawn-brief.md)), with
    three reversals it now carries: dinosaur-kin are the **Dinokin** Axis
    with lords (B2; with D1-D3 the set has two types, Dinokin for the
    monster-girls and Dinosaur for plain dinosaurs on tokens and a few
    creature cards, riders are not Dinokin, and a few Beastkin megafauna
    girls sit beside them), Hunt may target your own creatures, which Easy AI
    never does (B5), and Hunt damage counts for every damage-reading keyword
    and trigger (B6), evergreen: any such keyword the game adds later
    applies to Hunt with no Hunt-specific code, while combat-defined
    keywords (First Blade, Twin Blades, Overrun) do not. Also ruled: Bulwark prevents Hunt at any rarity (a
    Bulwark creature can be prey, never the hunter); no reserved Provoked
    art tell; 165 cards; Provoked at most once per turn per creature; the
    red-green and red-white sweep personas (D12); the three-row vocabulary
    threshold.
  - **The accessibility plan and the art streaming design are APPROVED**
    as recommended (lanes C and D above).
  - **D17 1.9's scope.** No fixed date. The minimum is the expansion with
    its engine work, accessibility, and bug fixes; nothing is deferred in
    advance.
  - **D18 the art window is 216 px** (lane C, card face).
  - **Lane I picks:** the tutorial opponent is Watch-Sergeant Alder,
    portrait and name ("Alder" on her plate instead of "easy AI"); the
    Free Draft caption reads "Pays 40g to 300g after three matches, by
    wins." with Premium gaining a no-gold caption; the retire warning, the
    deck-import strings and the save-card line are approved as written; a
    new-format code may convert a retired Constructed deck.
  - **Card text:** Umbral Antenna drops its arrival line (its first mill
    is then at the controller's next Dawn; rescored), and the rules-text
    template reads "Marked creatures" instead of "creatures with Marks"
    on every card that uses it.
- **The `research/` ignore rule** from the owner's local `.gitignore` is
  committed, so third-party research material never reaches the public
  repo.

## Non-goals

- No relitigating the spine: First Dawn is the Small set, Core Set II the 2.0
  Large, Brass Court stays 2.1, multiplayer is cancelled.
- No mobile overhaul, suggested decks or editable Limited Warchest (ruled out
  of 1.9 on 2026-09-25).
- No taplands or utility lands in First Dawn while the reserve rule stands.
- No localization scaffold: English only (D3).
- No player telemetry of mechanic usage; the audit is a harness tool.
- No floors lowered. No mid-train sweep.
- No cloud accounts code; that is 2.1.
