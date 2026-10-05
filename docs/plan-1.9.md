<!-- source-of-truth: docs/plan-road-to-2.0.md, docs/plan-expansion-slate.md, docs/plan-accessibility-i18n.md, docs/plan-mechanic-usage-audit.md, docs/plan-sweep-speed.md, docs/plan-art-regen-2026-09-22.md, docs/plan-1.8.5.md, docs/metagame-sweep.md, src/engine/types.ts, src/art/artLoader.ts, src/art/ArtResolver.ts, src/ui/CardThumbCache.ts, src/ai/activatedPolicy.ts, src/meta/SaveManager.ts, src/meta/Replay.ts, scripts/audit-overlap.ts, scripts/personas/craft.ts · last-verified: 2026-10-02 · program doc — the 1.9 train through lane B transcription; re-verify when the owner rules on an open decision or another lane lands -->

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
1.9's minimum scope named (D17). **The second sitting, in wave 2, ruled the
First Dawn engine spec, the overplan's questions, the D8 review, the usage
read's questions, the accessibility picks, the sweep personas, the duel cues
and the art pilot** (see "The wave-2 sitting" under Decisions); A1 starts
on it. This document turns the rulings into lanes and waves. Each
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
| **The AI values ramp at 0** | Fixed with the §4v cast-turn shape from live battlefield lands, reserve and turn: cast effects, Empower, Retell and a Dawn engine's remaining productive firings. The historical lab mean was 6.9; matched usage measurements and every unchanged gate are recorded in the usage audit | Lane E; **LANDED 2026-10-02 (D13 / U4), last and alone in wave 3** |
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
| G7 | "An activation cannot defer" throw (**fixed in 1.8.1, #451**: Duties now defer like spells) | `EffectInterpreter.ts` throws when a Duty raises anything but Foresee; the validator only catches a target after Foresee, and a test card passes the catalog check and still throws. No shipped Duty reaches it (census 2026-09-25: no Duty destroys or sacrifices) | S-M; fixed before First Dawn prints any Duty that removes a creature | engine |
| G8 | A held dies trigger ends a spell early | With a Hauntlink payable, a dies trigger raised mid-spell is held, and the op loop then returns without carrying the spell's remaining ops. Read in `EffectInterpreter.ts` (the rev-4 hold and the loop's pending branches); no test pins it | M; **confirmed 2026-09-25 by a failing test: seven shipped spells lost their remaining ops whenever a link was payable.** Fixed so a held trigger resolves where it would have resolved inline; rules.md records the rule | engine Inside combat the order still differs: a trigger held in the first-strike step resolves after the regular damage step (`combat/damage.ts:38-46`; measured 2026-09-28 for the engine spec, which records it as a known gap) |
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

1. **A new op with two targets**: the hunter, one of yours, and the prey
   (the final Hunt ruling, 2026-09-28, superseding E6's fallback): a
   creature an opponent controls, with no fallback, unless the card declares
   its own prey, `any` (any other creature, yours included) or `yours`
   (another creature you control). On the card Hunt is a bare verb keyword
   like Mark: "When this arrives, Hunt."; the spell form "Target creature
   you control Hunts."; an override names its prey (APPROVED 2026-09-29:
   "Hunt any other creature.", spell "Target creature you control Hunts any
   other creature.", and "Hunt another creature you control."). **An arrival
   Hunt chooses its prey at cast:** the creature can't be cast unless it has
   prey under its own rule, hunts as it arrives, and still arrives without
   hunting if the prey is gone by then; attack, Dawn and Empower Hunts are
   unchanged (A1.1b). The uncastable reason "It can't be cast: it has no
   prey to hunt." is APPROVED (2026-09-29). **A conditional arrival Hunt
   checks its condition at cast** (ruled 2026-09-29, A1.1c; "When this
   arrives, if you control another Dinokin, Hunt."): while the condition
   holds, the rule above; while it fails, the creature is cast with no prey,
   castable with or without prey, and hunts on arrival only if the condition
   has become true by then, as an ordinary arrival trigger
   ([As built (A1.1c)](plan-first-dawn-engine.md#as-built-a11c-a-conditional-arrival-hunt-checks-its-condition-at-cast)). The ruled description: "Your creature and its prey each deal damage equal to their Attack to the other. The prey is a creature an opponent controls, unless the card says otherwise. A creature with Bulwark cannot hunt. A creature that hunts when it arrives can't be cast unless it has prey."
   `TargetSpec` already has `yourCreature` and `opponentCreature`; Hunt
   uses two ordered specs (hunter, then prey), which the multi-spec path
   already enumerates, not `exactly: 2` (that is one spec for an unordered
   pair of the same kind; corrected by the engine spec). The "arrives: Hunt
   target creature with this" shape uses
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
  keyword matcher must not light up the existing card names that contain
  "hunt": ten contain the letters, four the whole word (Alpha of the Wild
  Hunt, Rune of the Hunt, Wild Hunt Matriarch, Hunt the Boar; corrected by
  the engine spec).
- **A usage row from the first day** (lane E), so the new mechanics are not
  judged by win rate alone.

**The build splits in two (D15, amended by D16, ruled 2026-09-28).** Only
part of the list above stands between the spec and the owner's cut, so the
lane lands in two halves:

- **A1, on the critical path, after the spec is ruled:** the Provoked
  trigger and the Hunt op (on the v16 replay version I1 took in wave 0),
  every other vocabulary gap the concretion audit found and the spec kept,
  and the Hard brain's Hunt targeting and Provoked survival reads (A1.2; a
  hand-off from A1.1b's review: the AI's cast-target policy (`src/ai/targeting.ts`, `vocabularyCastTargetValue`) reads only `when === 'spell'` abilities, so an arrival Hunt's prey variants all score 0 (undefined for an `any` card), and `applyVocabularyTargetPolicy` keeps only the first: every AI level casts an arrival hunter at the first opponent creature in battlefield order. A1.2 values the hunt op from the arrival ability, or exempts hunt specs from the collapse). The Hard
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

**The spec is RULED (the wave-2 sitting, 2026-09-28):**
[plan-first-dawn-engine.md](plan-first-dawn-engine.md), its questions Q1-Q10
(E1-E10 on the sheet), and A1 starts on it. All as recommended but one:
**E6, whose prey for the seven arrival and attack Hunts** (Fern-Crown
Tyrant, Kesh, Grave-Fern Stalker, Frill-Neck Stalker, Fern-and-Fire Raptor,
Fern-Shadow Stalker, Spear-Thrower of the Ember Clan). They hunt a creature
an opponent controls if a legal one exists; only when none does are they
forced to hunt another creature you control; with neither, the trigger does
nothing. Spells, Duties and Empower keep a free choice (B5). **Superseded
later on 2026-09-28 (the bare-keyword ruling):** that prey rule held for
every Hunt, and Hunt prints as a bare keyword. **Superseded again the same
day (the final Hunt ruling), E6's fallback entirely:** the generic prey is a
creature an opponent controls, with no fallback, and a card may declare
`any` or `yours` instead. What follows:

- **A1** builds the prey rule and the two overrides (A1.1b; the A1.1
  fallback construct is removed); no optional trigger is built. The lab
  (A1.3) drops the forced-self-hunt arm; the self-Hunt arm, through an `any`
  card, is live.
- **A1.2** (Hard's reads, 2026-09-29) values Hunt and Provoked in the shared AI layer, arrival hunters cast at their best prey, with 0 divergences on the weenie and broad presets ([As built (A1.2)](plan-first-dawn-engine.md#as-built-a12-hards-reads)).
- **A2.c** (the words, 2026-09-29) prints the approved templates, teaches Provoked and Hunt in the glossary (detected from the ability and the op, never a name), gives each a glyph, and writes both into `rules.md` with the Empower correction and G8's combat gap ([As built (A2.c)](plan-first-dawn-engine.md#as-built-a2c-the-words)).
- **A1.5** (the repeatable mana pump, ruled 2026-09-29, for the red Ultra Rare "Vyra, Ember-Sky Rider"): `CardDef.manaActivated`, a non-tap mana-only self boost used at Charm speed any number of times, one `activateMana` action carrying the count; a payable pump keeps only the combat windows open; Hard, Medium and Easy spend it in combat; the ticker is A2.a's, the rate A1.4's, the card lane B's ([As built (A1.5)](plan-first-dawn-engine.md#as-built-a15-the-repeatable-mana-pump)).
- **A1.4** (the rates, 2026-09-29) prices Hunt as a step on the hunter's survival, Provoked as its effect times a survival factor on Defense, the self-provoke engine and white self-damage sources from the A1.3 lab; the conditional arrival Hunt and the mana pump stayed NEEDS MATH until the lab's re-run; P3's "never damages its own creatures" is now enforced by `validateProvokedDef`; no shipped card's score moves ([As built (A1.4)](plan-first-dawn-engine.md#as-built-a14-the-rates)).
- **A1.4b** (the re-run's rates, 2026-09-29) prices the conditional arrival Hunt at 0.85 of the unconditional one when its condition names the card's own type (measured in the Dinokin decks; a Hunt gated on another type stays at 0.6, NEEDS MATH), and Vyra's pump at the measured 0.83 a card (other pump shapes at the same value, NEEDS MATH); no shipped card moves; of First Dawn's 166, four move, and Fern-and-Fire Raptor, Fern-Shadow Stalker and Fern-Crown Tyrant read hot and get proposals for the owner ([A1.4b](plan-first-dawn-engine.md#a14b-the-re-runs-rates)).
- **A1.6** (the owner's First Dawn reworks, ruled 2026-09-29): an `attacking` target qualifier for The Elders' Verdict and Bring Down the Beast, an `ifTargetSurvives` gate for Ambush at the River, and Ash-Rite's "then you create" (words only, no shipped card's text changed); the AI's reads are zero on today's pool, the gate's rate is A1.4's, the cards lane B's ([As built (A1.6)](plan-first-dawn-engine.md#as-built-a16-attacking-targets-and-if-it-survived)).
- **A1.7** (Overcharge, ruled 2026-09-29 from the board-cap study): a token refused at the creature cap gives one same-name token its controller controls +1/+1 instead, the fewest-Overcharges namesake first (ties to the oldest); never another creature, tokens only, at most `RULES.overchargeLimit` (3, measured and approved 2026-09-29) on one creature, and not a Mark (its own `Permanent.overcharge`, which no Mark rule sees); an `overcharged` event, a duel-log line and a tile badge; no new AI read ([As built (A1.7)](plan-first-dawn-engine.md#as-built-a17-overcharge)).
- **A2.a** (the Duel UI, 2026-09-29): a spent-Provoked badge on the tile with "Provoked this turn." on hover and in inspect; the prompts "Choose the hunter." and "Choose its prey."; the Hunt exchange as a step of the combat sequence, both creatures striking at once; the mana pump's count ticker and a Boost chip, with one notice a combat when a pump is payable; history lines for a Hunt, a Provoked fire and a pump ([As built (A2.a)](plan-first-dawn-engine.md#as-built-a2a-the-duel-ui)).
- **A2.b** (Medium, Easy and the draft, 2026-09-29): Easy never hunts its own creature *by choice* and skips friendly Provoked sources (the owner's B5); Medium takes either only past a one-card margin; Medium ranks an arrival hunter by its Hunt, and both cast an arrival-Hunt Darling at its best prey; Medium's counter forecast reads the Hunt pair rule; the draft picker weighs Provoked payoffs and sources by each other and a Hunt spell by the creatures drafted; inert on today's pool ([As built (A2.b)](plan-first-dawn-engine.md#as-built-a2b-medium-easy-and-the-draft)).
- **A2.d** (the tools, 2026-09-29): the converter's target walk judges whose creature a Hunt needs (a Hunt spell is dead without a non-Bulwark creature of your own, every generic Hunt without an opponent's creature, a conditional arrival Hunt alike) and reads an attacking-only target as live wherever something could attack; the usage audit gains a Hunt row, an `any` self-hunt counted apart, a wasted-Hunt check and a Provoked fire tally; no shipped deck or usage row moved ([As built (A2.d)](plan-first-dawn-engine.md#as-built-a2d-the-tools)).
- **B, transcription** (2026-10-01): First Dawn's 166 cards and 4 tokens in data, registered across the catalog, collection surfaces and converter-owned boss lists; the locked cut and scoped data tests are the transcription record ([Final locked cut](expansions/drafts/first-dawn-overplan.md#final-locked-cut-2026-09-29)).
  Owner rulings of 2026-10-01: Cinder-Crest Raptor gains Warcry with cost and stats unchanged; Mammothkin Matron's Provoked Marks itself before Propagate; `fd-tahla-shepherdess` is named Tahla, Shepherdess of Giants. The cut remains 9 UR / 11 SSR / 15 SR / 49 R / 82 C = 166.
- **The words.** The spec's player copy is approved (E10). The seven's
  proposed template is superseded: Hunt is a bare keyword ("When this
  arrives, Hunt."; "Target creature you control Hunts."), and the Hunt
  description, as the final Hunt ruling leaves it, is RULED (2026-09-28): "Your creature and its prey each deal damage equal to their Attack to the other. The prey is a creature an opponent controls, unless the card says otherwise. A creature with Bulwark cannot hunt. A creature that hunts when it arrives can't be cast unless it has prey."

The rest, in one line each: Provoked in the state-based check with the
Hauntlink exception (E1); Hunt's targeting rules inside the Hunt op, no
keyword qualifier (E2); "damage each creature you control" kept (E3);
Empower may Hunt as a validator change (E4); an empowered creature whose
target leaves resolves and loses only its rider, with a replay-note line
(E5); Deathblade hunters accepted and costed in the lab (E7); other creature
ability damage stays off the shared path in 1.9 (E8); Scar-Knife Witch
reads "another target creature you control" (E9).

### Lane B — the set: First Dawn, 166 cards, authored fresh

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

**Steps 2-4 are done and ruled (the wave-2 sitting, 2026-09-28).** The
overplan ([first-dawn-overplan.md](expansions/drafts/first-dawn-overplan.md))
and the engine spec are ruled; the overplan records each answer on its
questions. F1: the provisional rates stand until the lab. F2: Oru's Dinosaur
half is Dreaded. **F3: the Duty count trims toward the brief's 18, and
landing around 20 is acceptable** ("Trim TOWARDS 18 but if we land around
20 that's fine"); the trim happens at the cut, after the lab. F4: keep 12
Hatchling makers. F5: the every-turn engines are measured in the lab before
the cut. F6: the cut starts from the projected board, upper rarities card by
card, with the Great Drum kept and Fern-Crown Tyrant dropped (R28's draft
list loses that slot; its replacement is open until the cut). F7: R28 stays
red-green. F8: Long-Neck Matriarch reaches Dinokin only. The rulings changed
row text in two places only (the Hunt template, now the ruled bare keyword
on every Hunt row, and Scar-Knife Witch's "another"); no row is re-costed or
trimmed before the cut.

**A ninth Ultra Rare (owner, 2026-09-29).** The owner asked for a red
Ultra Rare like Shivan Dragon with a repeatable pump-attack ability, the
set's sole red Skyborne card (a red rider on a pterosaur), whose pump works
as a Charm with a +/- ticker. **The cut's histogram becomes 82 / 49 / 15 /
11 / 9 = 166** (B3 ruled 8 Ultra Rares and 165; the owner changed it
deliberately, one card over D2's 150-165). The session's working draft:
**Vyra, Ember-Sky Rider**, {4}{R}{R} 5/5, Legendary Creature: Human Rider
(D2), Skyborne, "{R}: This gets +1/+0 until Sunset.", an Ember-clan woman
on a plain pterosaur (a pie exception at Ultra Rare in the session's
framing; the brief gives the sky to W/U), protected. The session scheduled
the pump as **A1.5** (lane A); on the v4 scorer without it she reads 6.43
against a budget of 7.44 (Δ -1.01), and the pump is NEEDS MATH, valued 0
until the lab. The overplan carries her row (overlap not yet run) and the
art bible her entry, whose prompt Fable reviews before the art run.

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
  Built 2026-10-01: Hooves and Fire and the summit pair, rungs 27-28; theme: Frill-Flare Hornback -> Fern-Crest Raptor, Flint-Spear Toss -> Hurled Firebrand; R27: Shepherdess of the Long Grass -> Longneck Calf-Guard x2 + Nest-Guard Longneck, Hearth-Shield Maiden uses `fdr-hearth-shield-bulwark`; R28: Frill-Neck Stalker -> Spear-Sister, Fang and Horn -> Grip of the Old Beast, Flint-Spear Toss -> Hurled Firebrand, Fern-Crown Tyrant is back in the cut. Win-rate floors remain provisional until wave 4.
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
- **The art pilot, RULED (the wave-2 sitting, 2026-09-28; P10-P16 on its
  sheet).** The owner saw every pilot image.
  - **P10** The two regenerations are approved and ship: Swan-Lake
    Sovereign's and Brood Communion's new art replaces the shipped art.
  - **P11** The pilot's recipe reads as First Dawn: "Mostly, yes. I think
    it's a good look overall." The misses, as settled the same day
    (recorded in `docs/art-bible/` on PR #494):
    - **Scorch-Tail**'s tail tip rose above the card window. The main
      session puts it on the art run's redo list, and **Pack-Caller** is
      redone for its count (P15).
    - **Tar-Bones**' skull rose above the window. The main session
      re-crops its retained raw instead of regenerating it (offset -239;
      the skull top lands at about y 197), accepted as the pilot's fix.
    - **Great-Horn Herder:** asked whether the image joins the redo list
      (its sauropod's head, the pterosaurs and the raised crook sit above
      the window), the owner answered "Re-Do".
    - **Species tells:** asked whether at least two of a character's three
      tells must show inside the card window, the owner answered "Yes, 2/3
      sounds good". A third may sit in the zoom-only margin. Applying it to
      new art only, without re-auditing shipped art, is the main session's
      scope.
  - **P12** Marks keep the cyan bead in First Dawn, as in Starborne and
    Drowned Deep.
  - **P13** Case 2 (a woman beside a sauropod) lives on Great-Horn Herder,
    a woman's card; The Walking Mountain (a Dinosaur card) gets a beast-only
    image at the cut.
  - **P14** One Hatchling design (the horned calf) for every card that makes
    Hatchlings, the long-neck makers included.
  - **P15** Pack-Caller's art shows one Pack Raptor, since the card makes
    one (the pilot drew three as a count test).
  - **P16** **Re-crop the shipped catalogue now**, the recommendation
    reversed (it was "not now; revisit at QC day"): shipped art moves to the
    216 px window's head line (y 179) wherever its raw source is still
    cached, at no image quota. Art whose raw is not cached keeps its crop
    until it is regenerated.
- **The P16 re-crop is its own lane B art task in wave 2, with its own PR**,
  on the one art lane, sequenced with the pilot's own crops, and off A1's
  path. It records which cards were re-cropped and which kept their old
  crop for want of a cached raw. **The gate:** the main session reviews
  every staged sheet before anything is applied, and the owner sees the
  biggest-movers sheet before merge. The art register
  (`docs/art-bible/*`) and `docs/art-pipeline.md` are being edited on
  another branch, so the re-crop PR rebases onto that work rather than
  editing those files beside it.
- **Cold-Boot Mask joins the regeneration list (RULED, owner, 2026-09-29).**
  Its art file has a pale bar; the card gets a new image on the art run, as
  the other regenerations do, and ships its current art until then.

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

**The picks C4's build raised, RULED at the wave-2 sitting (2026-09-28;
A9-A14 on its sheet), all as recommended** (the plan records each):

- **Proposed C6, one small PR in program wave 2** (accessibility wave 1,
  after C4 and C5, both merged; it touches C3's and C4's files, so it waits
  for no scene pass): A9, a 2 px hover border on primary and danger buttons
  in standard contrast, hover only (`themeWidgets.ts`); A11, the Game tab's
  two columns end level, Privacy beside Save data, when that fits
  (`settingsPresentation.ts`, `SettingsScene.ts`); A12, the approved touch
  caption, "Makes menus and help text larger. Hold a card to read it up
  close.", which C4 already draws, so C6 only confirms it shows on touch.
  If the owner prefers, C6 rides the first wave-3 scene pass instead.
- **No change:** A10 keeps the tab heading "Display"; A14, Settings opens on
  Game and does not remember the last tab.
- **A13 goes on the cut checklist** (lane H): a hidden control's saved value
  is not applied, as C4 built it, so the release that flips a ship gate
  (`textSizeLive`, `highContrastLive`) applies the stored values, and its
  release notes carry a line saying so.
- **The duel cues (M1-M6, the cue mock), RULED as recommended:** the chip
  moves to a tab on the tile's top edge; declared attackers stay lifted and
  drop their ring while targeting; a one-target pick shows "1"; a picked
  graveyard card takes the badge, not a fade; the P/T arrows count Marks; a
  picked attacker keeps "Attack". All six are built in the Duel pass
  (program wave 3), after A2's two-target flow.

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

**The first audit's note is in, and its questions are RULED (the wave-2
sitting, 2026-09-28; U1-U4, all as recommended):**
[usage-audit-2026-09.md](usage-audit-2026-09.md). The fixes land in
**wave 3**, behind the unchanged gates:

- **U1** Easy calls her Darling on purpose (today every call is the noise
  roll): fixed. Rungs 1-3 have no floors, so only their Darlings bands are
  re-read.
- **U2** Granted keywords priced by the body (D13) land on the win-rate
  gates, on the code's evidence; the keyword-grant reading is added for
  wave 4's read, not as a precondition.
- **U3** The main-two tap of an enemy creature that untaps before it matters
  is fixed for every source, artifacts included, and `landEconomy.test.ts`
  is re-pinned to the intended behaviour, since the action it pins does
  nothing.
- **U4** The ramp fix (D13) lands **last in wave 3, and alone**: it moves
  the Medium proxy and every floor from rung 15 up, and a floor it breaks
  blocks it until wave 4's tune lifts that boss. Floors never come down.

The note backs D13's ramp and Brood Communion fixes; Starborne Apotheosis
lands with the Brood Communion fix (the same fix family). The note's other
proposals (team pumps in Medium's respond ladder, the lost blocker of a
creature Duty in main two, the harness additions) were not put to this
sitting and stay as it proposes them.

- **As built (wave 3, first usage-audit fixes, 2026-10-02):** U1 adds the
  Darling to Easy's deliberate casts; U3 values the useless main-two enemy
  tap at zero for every source, with both approved test re-pins; D13 holds
  Brood Communion and Apotheosis until their Mark payoffs have recipients,
  while still casting creature bodies; U2 prices the four keyword-grant
  sites with the existing printed-keyword valuation on the receiving body.
  Thirteen new documented behaviours pass, including the seeded P2-P4
  positions. The brain gates remain 82.5% / 71.5% over 200 games each and
  all rung gates pass without a floor change. The focused 500-game usage
  read takes Communion's empty-board share from 30.8% to 0% and useless
  main-two taps from 107 to 0; Easy's Darling calls and the unfloored
  Darlings rungs 1-3 are re-read in [the audit's section 7](usage-audit-2026-09.md#7-for-the-owner-ruled-2026-09-28).
  Ramp still lands last and alone (U4); no card, list or harness change.

- **As built (wave 3, second usage-audit fixes, 2026-10-02):** item 1 gives
  Medium a post-block team-pump rule using the existing combat forecast and
  mana cost; item 7 adds meaningful Darling-tax chances, uses for Skim,
  Retell and Whispers, non-creature Mark-payoff checks, Duty by main step,
  safe blocks lost on the next opposing attack, keyword recipients' Attack,
  and `--usage-columns`. The seeded Hera positions, counter-cases, Hard
  baseline comparison and unchanged gates are recorded in
  [the usage audit](usage-audit-2026-09.md). No band, floor, card or list changes;
  ramp still lands last and alone (U4).

- **As built (wave 3, ramp valuation, U4, 2026-10-02):** ramp casts,
  Empower and Retell use the scorer's §4v constants on the live land and
  reserve schedule; Dawn engines start next Dawn and stop earning value
  when normal drops catch up. Pure ramp bodies lose the generic trigger
  premium, so an exhausted or one-land reserve leaves only the body.
  The 1.9 anchor and mana-value-2 card floor stay. The seeded turn-two
  Seiðr-Weaver decision, counter-cases, matched cast-turn means and every
  before/after gate are recorded in
  [the U4 usage read](usage-audit-2026-09.md#9-ramp-by-cast-turn-u4-2026-10-02).

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
   and measures the new set. **Built 2026-09-28:** `stompy` (R/G, with an
   opt-in floor of half green, since every red persona otherwise opens on the
   same red core) and `warband` (R/W) join the hosted default list; each game
   costs about 0.9x a midrange game. B/G waits for wave 4, once the
   eight-persona sweep is shown to fit a night. Of the 15 gap nerfs, 11 are
   now pickable; Granary of Rising Years and Old Growth have no deck role and
   Skadi (U/G) and Morrigan (B/G) no persona, so those four need per-card
   in-engine checks. **RULED at the wave-2 sitting (2026-09-28; W1-W3, all
   as recommended):** W1, `stompy` gets no curve floor beside its half-green
   floor, since its climb measuring what wins is the sweep's job; W2, the
   black-green persona waits for wave 4, once the eight-persona sweep is
   shown to fit a night; W3, `warband` scores 92.4% before any tuning and
   the shared red core (Barge-Fire Brazier, Ember-Lane Flare, Lu Bu,
   Wreck-Runner) opens every red deck, which is flagged to the wave-4
   balance review.

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
  `main`. **Added by the wave-2 sitting (A13, 2026-09-28):** if the cut
  flips an accessibility ship gate (`textSizeLive`, `highContrastLive`),
  the release notes carry a line that a stored text size or contrast value
  now applies (the gate held it back while the control was hidden).
- **Release-note line owed (owner ruling 2026-10-01):** "Older expansion
  boosters now cost 450 gold, the same as the base set. The three newest
  sets stay at 525." The tier counts only sets a player can buy, with hidden
  SKUs excluded; `BOOSTER_SKUS` release order drives the automatic step-down.

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
| I7 | The Premium draft note shows on the first Deck Builder visit only; keeping it needs its summary stored | The Limited scenes, `SaveManager.ts` | 2 | A save change, so it rides the one v36 bump (lane C). **Built 2026-09-28:** the grant stores the note (`grantPremiumDraftPool`), and the Deck Builder reads it through `storedPremiumGrant` on every Build-step visit, reloads included |
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
| **Older-set near-duplicates** (D8) | **1.9.x** | A whole-pool review and resolution plan once the comparator is fixed (wave 0); the owner approves the rule and the slate; fixes ship in a 1.9.x patch. **Rule and slate RULED 2026-09-28** (41 cards; [d8-near-duplicate-review.md](d8-near-duplicate-review.md)). First Dawn transcription also flagged Blood-Horn Brute / Hot-Blooded Hornback, Cliff-Top Scout / Egg-Snatcher, Tracker of the Long Grass / Tall-Grass Tracker, and the set's clustered fern-raptor commons for that patch review |
| **Keyword backfill of the shipped sets** (the owner approved it 2026-09-29; see the decisions record) | **1.9.x** (proposed, beside D8) | Each shipped set gains the evergreen keywords it lacks, as a handful of extra cards or as keywords added to underpowered cards that fit. The gaps (a keyword a card grants counts, as on the card face): Base (Dreaded); Ragnarok (Bulwark, Untouchable, Dreaded); Celtic Fae (Twin Blades, Rage); Arthurian Court (Dreaded, Rage); Gothic Monsters (Twin Blades); Dark Tales (Twin Blades, Rage); Yokai Nights (Rage); Sands of the Duat (First Blade, Deathblade, Rage); Starborne (Rage); Drowned Deep (Twin Blades, Blood Oath). A backfilled set leaves the data check's grandfather list |

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
| **2** | The design-first overplan (provisional NEEDS MATH rates on the mechanic rows), its concretion audit and gap list, then `plan-first-dawn-engine.md` (Provoked, Hunt and the kept gaps) and **a second owner sitting** to rule it; then A1: the vocabulary, the Hard reads (after the weenie fix, proven identical on the current pool), the lab rates on the overplan's shapes entered in the scorer, and the mechanic rows rescored. In series beside it: R13 built, then the two 1.8.5 regenerations on the new window, then the art pilot with the boss portraits; the second sitting ruled the spec, the overplan's questions and the pilot (2026-09-28), then the catalogue re-crop to the y 179 head line (P16, its own PR) | The weenie fix; the first full usage audit and its findings note; the colour-gap personas (after the brief) and the levers' one-persona acceptance run; accessibility wave 1 with the v36 bump (and I7), then C6 (A9, A11, A12; proposed); art streaming built; the D8 whole-pool near-duplicate review, with a stat-ladder pass added to the comparator first (its fixes ship in 1.9.x) | full ladder, win-rate gates unchanged, replay goldens, the no-change tests, the owner's eyes on the pilot |
| **3** | The owner's cut on fully scored rows, the art bible, the art run, transcription (carrying the converter regen of the boss lists) | A2 (before transcription); the usage audit's fixes (D13; U1-U3 with the local fixes, the ramp fix last and alone, U4); accessibility wave 2 (core scenes, the Duel pass building the cue mock's M1-M6) | check-art-bible green, every token minted, duplicate audit filed, standing floors cleared |
| **4** | In order: the balance card edits (the 1.8.5 items and D7's), one converter regen, rungs 27-28 and the theme deck, the targeted usage read, the tunes (the top tier, rung 19, the Darlings summit R23-R26, the ladder inversions, Festival Rocket, the RUNG_BANDS 1-13 re-centre; the balance review reads the shared red core the sweep's warband persona flagged, W3), one measurement, then the floors ratchet once and the new gates land (rungs 27-28, the summit's Darlings rows) | Accessibility wave 3 (long tail) | matrices, precon and boss floors, fixture matrix |
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
  proposed 2026-09-28 in
  [d8-near-duplicate-review.md](d8-near-duplicate-review.md): 51 pairs, 41
  cards. **RULED 2026-09-28** (the wave-2 sitting): the rule and the whole
  slate as drafted, the fixes in a 1.9.x patch that re-gates its boss
  floors; the one-sided tribe rescue is a follow-up of about seven cards,
  not drafted, and the four out-of-band cards go to the balance track.
  The First Dawn transcription adds four review clusters without changing
  this release: Blood-Horn Brute / Hot-Blooded Hornback, Cliff-Top Scout /
  Egg-Snatcher, Tracker of the Long Grass / Tall-Grass Tracker, and the
  fern-raptor commons.
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
  a measured one: if a full eight-persona sweep finishes in about a night on
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
    never does (B5; narrowed by the final Hunt ruling of 2026-09-28: the
    generic Hunt takes only an opponent's creature, and only a card that
    declares `any` or `yours` reaches your own side), and Hunt damage counts for every damage-reading keyword
    and trigger (B6), evergreen: any such keyword the game adds later
    applies to Hunt with no Hunt-specific code, while combat-defined
    keywords (First Blade, Twin Blades, Overrun) do not. Also ruled: Bulwark prevents Hunt at any rarity (a
    Bulwark creature can be prey, never the hunter); no reserved Provoked
    art tell; 165 cards (superseded 2026-09-29: 166); Provoked at most once per turn per creature; the
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
- **The wave-2 sitting (the owner, 2026-09-28).** One decision sheet and
  its addendum, sections E, F, D, U, A, W, M and P, each item as
  recommended except where noted.
  - **The First Dawn engine spec is RULED**
    ([plan-first-dawn-engine.md](plan-first-dawn-engine.md), E1-E10), and
    A1 starts on it. **E6 went the other way in part:** the seven arrival
    and attack Hunts hunt a creature an opponent controls if a legal one
    exists, and only when none does are they forced to hunt another
    creature you control; spells, Duties and Empower keep a free choice.
    Their template was proposed pending the owner's wording (E10 approves
    the rest of the spec's copy). **E6 and E10 superseded later that day
    (the bare-keyword ruling):** Hunt is a bare verb keyword like Mark ("When
    this arrives, Hunt.", "During your Dawn, Hunt.", "Whenever this attacks,
    Hunt.", Duties and Empower with their usual opener; the spell form
    "Target creature you control Hunts."), and every Hunt took an
    opponent's creature if able, else another of yours. **Superseded again
    that day (the final Hunt ruling):** the generic prey is an opponent's
    creature only, with no fallback; a card may declare `any` or `yours`;
    an arrival hunter chooses its prey at cast and can't be cast without
    one; the ruled description: "Your creature and its prey each deal damage equal to their Attack to the other. The prey is a creature an opponent controls, unless the card says otherwise. A creature with Bulwark cannot hunt. A creature that hunts when it arrives can't be cast unless it has prey." E3 "Keep", E4 "Validator
    change", E7 "Cost them in lab", E8 "Not in 1.9". See lane A.
  - **The overplan's questions** (F1-F8): the provisional rates until the
    lab; Oru's Dinosaur half is Dreaded; the Duty count trims toward 18,
    about 20 acceptable, at the cut (F3); keep 12 Hatchling makers; the
    every-turn engines lab first; the projected board with the Great Drum
    kept and Fern-Crown Tyrant dropped (F6); R28 red-green; the matriarch
    reaches Dinokin only. See lane B.
  - **D8's rule and slate are RULED** (D1-D12): only strictly-worse twins
    across sets (D2), Rage only on Wreck-Runner (D4), A33 folded in (D6),
    Plaguebearer Draugr 1/5 (D9), the boss floors re-gated in the 1.9.x
    patch (D10), the one-sided tribe rescue as a follow-up (D11, about
    seven cards, not drafted), the out-of-band cards to the balance track
    (D12). See D8 above.
  - **The usage read's questions** (U1-U4): Easy's Darling fixed; granted
    keywords land on the gates; the main-two tap re-pinned; the ramp fix
    last and alone. See lane E.
  - **Accessibility picks** (A9-A14) and **the duel cues** (M1-M6): see
    lane C; C6 is proposed for A9, A11 and A12, and A13's release-note line
    is on the cut checklist (lane H).
  - **Sweep personas** (W1-W3): no curve floor, B/G in wave 4, the shared
    red core flagged to wave 4's balance review. See lane F.
  - **The art pilot** (P10-P16): the two regenerations ship, the recipe
    reads as First Dawn ("Mostly, yes. I think it's a good look overall."),
    the cyan Mark bead stays, case 2 on Great-Horn Herder, one Hatchling
    design, one Pack Raptor, and **P16 went the other way:** the shipped
    catalogue is re-cropped to the y 179 head line now, wherever the raw
    is cached. See lane B.
- **A ninth Ultra Rare, the set's Shivan Dragon (the owner, 2026-09-29).**
  The owner asked for "a Red UR card similar to Shivan Dragon, with a
  repeatable Pump-Attack ability", then ruled three questions:
  - **The sky.** She is the sole red Skyborne card: a red rider, a woman on
    a Skyborne pterosaur.
  - **The pump.** It works as a Charm (Charm speed; in the rules that
    includes after blockers), and the Duel UI gives it a small +/- ticker
    for a "single cast" pump instead of asking about every mana.
  - **The count.** Ultra Rare rises from 8 to 9: 82 / 49 / 15 / 11 / 9 =
    166, a deliberate change to the B3 histogram, and one card over D2's
    150-165 range (the wave-1 sitting's "165 cards" is superseded).

  **The working draft (the session's, not ruled):** Vyra, Ember-Sky Rider,
  {4}{R}{R} 5/5, Legendary Creature: Human Rider (D2), Skyborne, "{R}: This
  gets +1/+0 until Sunset.", of the Ember clan; red Skyborne framed as a
  pie exception at Ultra Rare; the pump scheduled as A1.5, narrow, and
  priced at 0 (NEEDS MATH) until the lab. On the v4 scorer without the pump
  she reads 6.43 against a budget of 7.44 (Δ -1.01). Owed: the overlap
  comparator, the rescore, and Fable's review of the art prompt. See lane
  B.
- **Starting life: a 2.0 change, so 1.9 stays at 20 (the owner, 2026-09-29).** The owner
  aimed a 5-10 increase in starting life at 2.0, with Core Set II
  ([plan-road-to-2.0.md](plan-road-to-2.0.md#starting-life-a-20-direction)).
  First Dawn's costs, the A1.4 rates and every 1.9 gate are measured at 20.
- **Keyword coverage in every set (the owner, 2026-09-29).** "My goal is for
  every keyword to have SOME representation in all sets; but we've been bad
  about it. Maybe we pick a handful of missing "Set Keywords" to incorporate
  as onsies-twosies in "small" sets, and we look to have the full gambit in
  "Large" sets?"
  - **First Dawn** (a Small set) carries all 13 keywords. Today it lacks
    First Blade, Twin Blades and Blood Oath.
  - It also takes a handful of returning set mechanics as one- or two-card
    cameos, the owner's pick from a proposal (in progress). This supersedes,
    in part, the brief's "Nine Lives, Hauntlink, Whispers, Tithe, Rite,
    Preserve and Quest stay out".
  - **Large sets** (2.0's Core Set II) carry every keyword and named
    mechanic.
  - **Backfill of the shipped sets: approved** (the owner: "either a handful
    of extra cards, or adding keywords to underpowered cards that fit
    thematically"). None of the ten shipped sets carries all 13 keywords.
    - Extra cards change a shipped set's rarity histogram, which the owner
      had locked. This approval covers that.
    - The session proposes the 1.9.x patch, beside the D8 near-duplicate
      fixes. See the table under "Moved out of 1.9".
  - **A data check (the owner):** every new set must carry all 13 keywords,
    starting with First Dawn. The shipped sets are grandfathered until their
    backfill lands, then leave the list.
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

## Handoff (2026-10-04)

The owner moved 1.9 orchestration to the project coordinator session on 2026-10-04. This section is the state at the handoff, written so the train can be picked up from GitHub alone. The full wave-4 measurement records are [plan-1.9-wave4-tunes.md](plan-1.9-wave4-tunes.md) (the tower baseline and the tunes), [plan-1.9-wave4-card-slate.md](plan-1.9-wave4-card-slate.md), [plan-1.9-wave4-usage-read.md](plan-1.9-wave4-usage-read.md) and [plan-1.9-wave4-two-cards.md](plan-1.9-wave4-two-cards.md).

### Done

- **Waves 0-3.** Wave 3 closed with lane D's S6 (#531): art streaming is on by default, and every gate is measured in [plan-art-streaming.md](plan-art-streaming.md) except gate 7, which waits for the 1.9 cut.
- **Wave 4 so far, on `release/1.9`:**
  - **#532, the card edits** (owner, 2026-10-04): Black Tide Rising goes to -2/-2, and Morrigan to {4}{B}{G}.
  - **#533, the Medium-AI fixes from the targeted usage read** (owner: "M1 + M3 + the low items"). Every gate is unchanged and nothing moved more than 2 points.
  - **#534, vector numerals** for the cost pips, the pick badges, the pile chip and the Forge (owner request).
- **In the tunes PR** (branch `feat/19-w4-tunes`). The AI is frozen at #533. No floor, `RUNG_BANDS` or `FLOOR_BANDS` entry changed.
  - **Hearth-Shield Maiden {1}{W} -> {W}** (owner, 2026-10-04, from a measured lab: -0.77 in play at {1}{W}, +0.11 at {W}), with the converter regen. Wild Communion is registered hand-tuned so it keeps Mother of the Long-Necks, the gate columns' only Mark source.
  - **A Darlings builder rule:** a card is dropped when fewer than 6 other creatures in the list meet its own-side condition.
  - **R23-R28 Darlings lists now come from the themed builder:** R23-R26 rise from 10-30% to 55-58%, and R27's turn-limit stall falls from 45 draws in 200 to 3.
  - **Reserve tunes at 200 seeds**, confirmed on the 15-column matrix: R11 40.9 -> 64.8, R13 47.4 -> 54.4, R24 71.5 -> 72.9, R28 63.6 -> 68.5, then 76.0 after the 2026-10-05 rebuild (below).
  - **R15 Carmilla is unchanged:** eleven levers all read inside the noise.
  - **Verification:** `winrate.test.ts` 8/8; `tests/data` and `tests/power` green; tsc, lint and the doc checkers clean.

### Rulings made in wave 4 (2026-10-04)

**Owner:**
- **The card slate:** Black Tide Rising goes to -2/-2, and Morrigan to {4}{B}{G}.
- **The AI fixes:** M1 + M3 + the low items.
- **The two-card lab:** Hearth-Shield Maiden goes to {W}. Ember-Flick is unchanged.
- **Q3, summit order in Darlings:** lift R28 by a list tune. If she still falls short, R27 stays above R28 in Darlings only, and R27 is never weakened. Every R28 Darlings lever read inside the noise, so R27 stays above her there.
- **Q4, the top tier:** accept about 66% against the .585 band. A tier-dial retune goes to 1.9.x or 2.0.
- **Q6, RUNG_BANDS 1-13:** re-centre on the end-of-wave reading at mean - 6.5, rounded down to the half point, with downs allowed. List each band that comes down in the PR. These are harness bands, not CI floors; gate floors still only rise.

**Main session:**
- **Q1:** Wild Communion keeps Mother of the Long-Necks.
- **Q2:** the summit's Darlings lists come from the themed builder.
- **Q5:** the Darlings gate terminates on a draw ceiling, not on zero draws.
- **Q7:** R8 stays under R7, the documented "wall at rung 7".

### Wave 4's end-of-wave measurement (done 2026-10-05)

Measured at cb335b10, after #535 (the tunes, with R28's gate rebuild) merged. The record, with every table, is [plan-1.9-wave4-end-of-wave.md](plan-1.9-wave4-end-of-wave.md); the end-of-wave PR carries the ratchet, the gates and the bands.

- **Summit:** R28 tops the gate (76.0 against R26's 75.0) and the wide matrix (81.0); R27 stays above her in Darlings.
- **Floors:** R19 .675 -> .68 and R24 .645 -> .66; R27 .62 and R28 .695 are new. Every other floor is kept. R15 Carmilla's margin is still 2.1.
- **Darlings summit gate:** new, R23-R28 at 40 seeds in two tests, with floors and per-row draw ceilings.
- **Bands:** `RUNG_BANDS` 1-13 re-centred (only R10 comes down, .69 -> .655); 14-28 synced up to the gate floors; `FLOOR_BANDS` 27-28 at .585. F21 re-read 67.0 at 200 seeds.

The steps as planned, kept for the next end-of-wave run:

**CPU rules (owner):**
- one heavy job at a time;
- at most 4 workers;
- set `OMP_NUM_THREADS=1` and `ORT_NUM_THREADS=1`;
- close every process afterwards.

The stock CLI runs every row in one process. The 4-worker sharded run took about 20 minutes wall per matrix at 200 seeds.

1. **Gate format (what CI gates):** `npx tsx scripts/balance-matrix.ts --avatars --seeds 200`
   - **Ratchet the floors** in `tests/ai/winrate.test.ts` for R15-R26 to max(standing floor, 200-seed mean - 6.5, rounded down to the half point).
   - **Add floors for R27 and R28** by the same rule, in the "First Dawn rungs 27-28" test.
   - **`RUNG_BANDS` in `scripts/balance-matrix.ts`:**
     - add rungs 27 and 28;
     - sync 14-26 up to the gate floors (R16, R17, R18, R19, R20, R23 and R25 have fallen behind them; the table is in the tunes record, section 6);
     - re-centre 1-13 per Q6.
2. **Wide matrix (confirms the tunes):** `npx tsx scripts/balance-matrix.ts --avatars-reserve --seeds 200`. Check at least R11, R13, R24 and R28 against the tunes record, section 11.
3. **Darlings:** `npx tsx scripts/balance-matrix.ts --avatars-darlings --seeds 200`
   - **Add a Darlings gate for R23-R28** at 40 seeds, with floors = mean - 6.5 rounded down.
   - **Split it into two tests** (R23-R25 and R26-R28). At 40 seeds it is about 430 s locally and about 680 s on CI.
   - **Terminate on a per-row draw ceiling** set from this reading (Q5). The themed R23 list draws 18 of 200 against Sunwell Ledger today.
4. **Floors (the tier dial):** `npx tsx scripts/balance-matrix.ts --floors --seeds 80`
   - Add `FLOOR_BANDS` 27-28 at .585.
   - Re-read F21 at 200 seeds. It read 58.8 at 80 seeds, 0.3 over its band, and is probably noise.
5. **Gates:**
   - `npx vitest run tests/ai/winrate.test.ts` alone (about 530 s);
   - `npx vitest run tests/data tests/power`;
   - then the full suite on an idle machine (about 13 min).
6. **One PR** carries the ratchet, the new gates and the band changes, with the measured tables in its body.

### Open for the owner

- **Answered 2026-10-05: R28 tops the gate ladder too** (owner: "Yes, it should"). Her reserve list was rebuilt in the tunes PR: gate 68.5 -> 76.0, wide 76.0 -> 81.0, 0 draws, against R26's 75.0 and 78.4. The end-of-wave reading confirmed it. The gate margin is about one point, inside the 40-seed noise, so no ordering assertion gates it.
- **R15 Carmilla has a 2.1-point margin over her floor** at 200 seeds. Her 40-seed gate reads 69.0 against .655. No list lever helped, because the drop came with the wave 2-3 brain changes. The 2026-10-05 ratchet kept her floor at .655 (her candidate is 61.0), so the margin is unchanged; she is the first row to watch if the AI moves again.

### Carried, not blocking

- **AI gaps, logged for later:**
  - Medium never aims a target-creature damage spell at its own Provoked creature (Ember-Flick), and Foresee is worth 0 to Medium;
  - a creature Duty used in main phase two leaves its creature tapped;
  - Festival Rocket activations are net-negative in Medium's hands.
- **Numeral follow-ups: done.** The numerals gained a comma and a plus, so repeated picks ("1, 2"), the Mark "+2" badge (on a rounded plate) and the pile counts draw vector numerals too.
- **Local-only tooling, not in the repo:**
  - the Forge's `power-scores.json` was not rescored after the Maiden recost;
  - the local `blades-db terms --check` fails on a pre-existing "arrives" leak (Orbital Graft, Salt Chapel, Tahla).
- **Alongside wave 4:**
  - accessibility wave 3's long tail;
  - the Hard perf profile on First Dawn decks;
  - the collection dilution revisit.
- **Wave 5:**
  - QC;
  - the metagame sweep, run last with all six personas;
  - the release notes, including the pack-price line;
  - the 1.9.0 cut: art-streaming gate 7 on the deployed pack ranges, and the db-signals Worker redeploy, which needs the owner's Cloudflare token.
