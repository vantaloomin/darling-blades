<!-- source-of-truth: docs/plan-road-to-2.0.md, docs/plan-expansion-slate.md, docs/plan-accessibility-i18n.md, docs/plan-mechanic-usage-audit.md, docs/plan-sweep-speed.md, docs/plan-art-regen-2026-09-22.md, docs/metagame-sweep.md, src/engine/types.ts, src/art/artLoader.ts, src/art/ArtResolver.ts, src/ui/CardThumbCache.ts, src/ai/activatedPolicy.ts, src/meta/SaveManager.ts, src/meta/Replay.ts, scripts/audit-overlap.ts, scripts/personas/craft.ts · last-verified: 2026-09-25 · program doc — the 1.9 train, opened on the owner's scope rulings of 2026-09-25; re-verify when the owner rules on the open decisions or a lane lands -->

# Darling Blades 1.9 — program plan

**Status 2026-09-25: scope RULED, build not started.** The owner ruled the
1.9 scope on 2026-09-25 (the table below). This document turns those rulings
into lanes, waves and the decisions that are still open. Build starts wave by
wave on the owner's word; each open decision gates only the lane that names
it.

The release spine is [plan-road-to-2.0.md](plan-road-to-2.0.md). Its 1.9 row,
as agreed 2026-08-24, and as it stands after the owner's rulings:

| | Set | Mechanics | Engine feature | Non-card headline |
| --- | --- | --- | --- | --- |
| Spine (2026-08-24) | **First Dawn** (prehistoric), Small ~150 | Provoked, Hunt | none | Accessibility + Mobile |
| **Ruled (2026-09-25)** | **First Dawn**, authored fresh | Provoked, Hunt | none (mechanic engine work only) | **Accessibility**, card art streaming, measurement |

## The owner's scope rulings (2026-09-25)

| # | Ruling | Where it lands |
| --- | --- | --- |
| R1 | The two new mechanics, **Provoked** ("Provoke" in the ruling) and **Hunt**, are approved | Lane A; the keyword's final form is D1 |
| R2 | **First Dawn is a fresh set**, drafted by an Opus 5.5 agent. The July overplan is retired | Lane B |
| R3 | **Accessibility is approved** | Lane C |
| R4 | **The mobile overhaul moves to 2.0** | Moved out; see D4 |
| R5 | **AI suggested decks move to after 2.0** | Moved out |
| R6 | **The editable Limited Warchest moves to after 2.0** | Moved out |
| R7 | **Dynamic card art loading and unloading is approved** | Lane D |
| R8 | **The mechanic usage audit** is on the list (its decision U1) | Lane E |
| R9 | **Fix weenie's cost in the sweep** (the Hard brain on wide boards) | Lane F |
| R10 | **Sweep improvements** (levers 2 and 3 of the sweep plan) | Lane F |
| R11 | **Every 1.8 review finding still open is implemented** | Lane G |
| R12 | **The 1.8.x items** | Lane 0 |

## Where 1.9 starts from

- `main` is `a1c8f91`: v1.8.0 (the two-parent merge `fd29724`, tag `v1.8.0`,
  2026-09-24) plus the custom domain and link preview (#435). One PR is
  open: #436, the Drowned Deep duplicate split, green, into `main`, merge on
  the owner's word.
- Pool: 1,482 collectible cards across ten sets, a 26-rung tower, 5 starter
  precons, 9 theme decks and 5 Darlings precons, 82 Duty carriers.
  `SaveData` is v35, `REPLAY_LOG_VERSION` is 14. The suite at the cut: 3,961
  tests plus 4 skipped across 259 files, about 13 minutes on an idle machine.
- **The post-release metagame sweep is still running**: run 36017324764 on
  `main` at `fd29724`, five personas (weenie excluded for cost), started
  2026-09-24 15:03 UTC. The pre-release round 0 (run 35858624583 at
  `69d9d22`, the same field) read nothing egregious. Reanimator was the
  weakest persona (63.3% against the prefab field), and the Starborne and
  Silver Veil shop decks conceded 95-97% of games, the same as the 1.7
  reading. Both readings feed the First Dawn identity brief (lane B).
- The two expansion mechanics have **no engine vocabulary yet**, measured
  2026-09-25: `TriggerWhen` in `src/engine/types.ts` has no damage-received
  event (only `combatDamageToPlayer`), and `EffectOp` has no mutual-damage
  op. The slate's "Engine: trivial (damage events exist)" undersells both.
  Each is new vocabulary with the Starborne wave's blast radius, which is
  still well short of a Large release's engine feature.
- `scripts/audit-overlap.ts`, the duplicate comparator every set is run
  through, is blind to Duty, Tithe and Whispers: its `bodyKey` has no
  `activated`, `tithe` or `whispers` field. That is how three same-cost
  duplicates reached the shipped Drowned Deep (the 2026-09-24 review, #436).

## Lanes

Lanes are ordered by dependency, not by size. Lane 0 ships first as a
patch. A is the engine and rules work that must exist before card data. B is
the set. C, D, E and F are independent of the set and run beside it. G is the
review carry-over. H is measurement and release mechanics.

### Lane 0 — the 1.8.1 patch

The 1.7.1 precedent: a short train of small PRs, a version bump, a tag,
release notes, cut from `main` once its contents are green.

| Item | State | Note |
| --- | --- | --- |
| The seventeen art regenerations | Briefs authored and merged: [plan-art-regen-2026-09-22.md](plan-art-regen-2026-09-22.md) | Codex runs the pipeline on one lane; the owner's eyes on every image |
| Drowned Deep duplicate split | **PR #436 open**, green: ten cards reworded with ids, costs, rarities, stats and art unchanged, plus a catalog guard against rules-identical printings in one set | Merge on the owner's word; `main` auto-deploys |
| Play-stats card batch covers only play before the first tab-hide (G21, review E6) | Copy fixed in #428; behaviour open | Re-arm per launch with the card ids de-duplicated per launch, because the rollup's k=10 floor counts one card row per session and a plain re-arm lets one tab-switcher lift a rare card over it. The privacy page's wording follows the code |
| A held dies trigger ends a spell early (G8) | Found by reading 2026-09-25 | A failing test first; if it confirms, the fix rides 1.8.1 with a replay-golden check |
| Anything egregious the post-release sweep finds | Sweep still running | A hotfix only if egregious, the standing 1.8 ruling |

Recommendation (D6): cut 1.8.1 when the post-release sweep's reading is in,
so one patch carries everything, and cut `release/1.9` from `main` after it,
so the train starts with the patch already inside it.

### Lane A — the mechanics: Provoked and Hunt

**The spec comes first:** `plan-first-dawn-engine.md`, authored by an Opus
5.5 agent (design documents are never Codex's), with the owner ruling its
questions before any card row is written. The questions it has to settle,
from the slate, the retired overplan's own risk list, and today's code:

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
   one ordering rule. That rule touches G8 (a held dies trigger ending a
   spell early), so the two are specified together.

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

- **Costing before rows** (the owner's rule): an MEP rate in the power
  formula for each, anchored to Magic precedent. Both Magic analogs postdate
  the 8th-10th-edition era the costing normally anchors to (fight became a
  keyword action in 2011, enrage appeared in 2017), so the derivation must
  say how it handles the era filter, per the MTG-db playbook, or cite older
  fight-shaped printings. No rate is quoted here; none exists until it is
  scored.
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

### Lane B — the set: First Dawn, about 150 cards, authored fresh

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

The authoring order is the one Starborne and Drowned Deep used. The rows
cannot start until lane A's rates exist:

1. **Identity brief**, approved by the owner before any rows: setting, the
   colour pie, what each colour does with Provoked, Hunt and Duty, enabler
   density per colour (the Drowned Deep cut failed it in white and red),
   the precon's plan, and the metagame it lands in. An attack-forward set
   meets a field where go-wide trails and reanimator is the weakest persona;
   the brief should say which of those it means to move.
2. **Overplan of about 200 candidates** for a ~150 cut (D2), every row
   scored by the power formula at authoring time and run through the
   duplicate comparator against the live pool. **The comparator learns Duty,
   Tithe and Whispers first** (a small tooling fix, wave 0), and the #436
   catalog guard (no rules-identical printings in one set) applies from the
   first row.
3. **Cut**, with the owner's review of the upper rarities first (the
   Drowned Deep cut board worked this way), a protect list, enabler density
   as a cut constraint, and the AI-watch family named.
4. **Concretion** to the engine's vocabulary. The approved artifact is then
   transcribed into data, by Codex or an Opus agent under contract; Codex
   never authors the prose.

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
  per-test budget; a 28-avatar tower needs its gate shape decided before the
  rungs land.
- **Set achievements.** Starborne and Drowned Deep shipped without any (a
  1.8 review finding, lane G); First Dawn ships with them.
- An art-bible section, set icon, booster blurb, land style, the
  `SET_TITLES` entry, glossary and dictionary rows, and a blades-db rebuild.
- **Art is the long pole**: about 150 card arts, the tokens and two boss
  portraits. Prompts are authored by the Opus agent, and Codex runs the
  pipeline on one lane. Large non-humanoid subjects (dinosaurs) are new
  territory for the prompt recipes, so a pilot batch of about ten goes
  through the owner's eyes before the full run. The art run starts the day
  the cut locks. Frame geometry stays deferred to 2.0 (D8 of 1.8), so First
  Dawn's art is cropped to today's frame.

### Lane C — accessibility

**Approved 2026-09-25.** The spec is
[plan-accessibility-i18n.md](plan-accessibility-i18n.md), written for 1.7 and
never started. It needs a re-verification pass against today's code before
wave 1: since it was written, Settings gained one layout rhythm (#411), every
menu control moved inside the title-safe frame (#412, #431), and
[design-system.md](design-system.md) became the token reference.

Scope, per the plan: always-on cues that do not rely on colour (mana pip
shape, rarity, legal targets, selection, warnings); text size at Standard,
Large and Largest (100, 115, 130%); high contrast; and a reflow and
readability audit across every scene. Its waves 1-3 are this lane. The Story
scene it names does not exist yet and drops out of wave 3.

Three consequences of the rulings:

- **The localization decision is overdue** (D3). The plan set it for
  2026-08-15, before Story Mode's text is written; no ruling was recorded.
  It has to come before accessibility wave 1, because option B adds
  `settings.locale` to the same save bump, and its key extraction touches
  the same strings as the text-size audit, in the same scene sweep.
- **Mobile no longer rides with it.** The spine paired the two because both
  sweep every scene for reflow, so splitting them costs a second full sweep
  in 2.0. The mitigation is to build text scaling on the shared layout
  primitives (the design-system tokens and the title-safe frame) and never
  on per-scene literals, so the mobile pass reuses them. ProfileScene,
  still all-literal coordinates (QC day 2026-09-22), is the case in point.
- **One save bump.** v35 to v36 adds `settings.textScale` and
  `settings.highContrast` (and `settings.locale` if D3 is B or C), with a
  real `migrate()` and a test. Anything else in 1.9 that wants a schema
  change rides it, and it lands once.

Gates: the plan's scale-and-contrast fixture matrix, a human colour-vision
and clipping review, and no gameplay re-measure unless duel dispatch changes.

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
  art arrives (a 1.8 review finding, lane G). Streaming makes that the
  normal case, so the redraw on arrival is part of this lane.
- A texture destroyed while a game object still references it is a crash,
  or Phaser's green square. Pack opening needs its art before the flip; a
  duel preloads both decks.
- The half-resolution tier is not built for the Pages deploy (a 1.8 review
  finding, lane G). Half-resolution art on desktop was rejected in 1.8,
  because the zoom preview draws up to 733x1045 px at 1440p.
- The desktop app loads over its own protocol and needs its own run, with
  the second-pass retry from #432 in place.

Gates: GPU residency and time-to-Collection measured before and after on the
desktop and phone tiers; no stand-in left on screen after arrival across
every scene at two sizes; a desktop app run.

### Lane E — measurement: the mechanic usage audit

**On the list by the owner's ruling (U1, 2026-09-25).** The spec is
[plan-mechanic-usage-audit.md](plan-mechanic-usage-audit.md): a read-only
decorator on the row AI behind `--usage` on the balance matrices, counting
per boss and per mechanic the turns with a chance, the turns taken,
cast-when-seen per card, and uses per cast. It changes no shipped behaviour,
and one test proves identical win counts with and without it. U2-U5 remain
(D5).

Sequencing: its waves 0-1 (the classifier, the wrapper, `--usage`) land
before lane A's AI work, so Provoked and Hunt ship with their usage rows. Its
wave 2, the first full audit of rungs 1-26, is read into a findings note.
Wave 3 fixes what that note justifies, behind the unchanged gates. One
finding is already known: `src/ai/activatedPolicy.ts` filters out Duties
that cost mana in main phase 1, so paid Duties are used only after combat
(RC review, 2026-09-23). Any brain change re-baselines the floors it moves.

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
   games before and after. A fix that must change decisions is a brain
   change: it re-baselines the floors and needs the owner's word. Then weenie
   rejoins the sweep, six personas again.
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
   become the default and the hosted workflow gains the inputs.

The target is a sweep that fits in a night again, so the 1.9 sweep can run
last before the cut, the standing rule the 1.8 ruling suspended (D9).

### Lane G — the 1.8 review carry-over

**Owner ruling 2026-09-25: every 1.8 review finding still open is
implemented in 1.9.** Sources: the release-candidate review of 2026-09-23
(its unruled items and its 1.9 notes), the follow-ups reported with the
title-safe work (#431), the QC-day survey of 2026-09-22, and the Drowned Deep
duplicate review of 2026-09-24 (its older-set leftovers are D8; its tooling
fix is wave 0). Every item was re-checked against `main` (`a1c8f91`) on
2026-09-25. Ten were already fixed by #423 to #429 (the Whispers docs, the
own-turn fog test, the Esc router, the Limited redraw, and the copy fixes)
and are not listed; four new ones found by the re-check are. G8 was found by
reading only and starts with a failing test.

| # | Finding | State on `main`, 2026-09-25 | Size | Lands in |
| --- | --- | --- | --- | --- |
| **Decks** | | | | |
| G1 | An unfinished deck cannot be saved, so leaving discards it (review T6) | Save refuses while any error stands; "Leave Without Saving" restores the last saved list; the Decks menu writes the working deck with no check, as do the format switch and the Darling pick; a never-saved deck is dropped without a prompt when another is opened. `DeckBuilderScene.ts`, `DeckStorage.ts` | M, one design question: the review's recommendation is to allow saving an incomplete deck as a draft marked unplayable | lane G |
| **Duel** | | | | |
| G2 | Undo can reveal hidden cards | Undo keeps the pre-action snapshot after a Skim or a draw Duty; nothing checks for a draw or Skim event. `DuelScene.ts` | XS-S | lane G |
| G3 | No Duty badge | A usable Duty shares the attackers' gold ring; `BoardCardView.setActionLabel` exists and only Hauntlink uses it | S | lane G |
| G4 | The opponent's Duty says who, not what | The log names the card; the ability index is ignored, so it never says which Duty or its effect | S | lane G |
| G5 | Concede reads "Tap to confirm" with a mouse and never disarms | Found by the 2026-09-25 re-check. `DuelScene.ts` | XS | lane G |
| **Engine and replay** | | | | |
| G6 | Graveyard targets are stored by position | `{ kind: 'grave'; player; index }` and `graveIndex` on cast and Preserve actions, though graveyard entries carry an `instanceId` | M; rides the replay bump (v15) with lane A | lane A's wave |
| G7 | "An activation cannot defer" throw, latent | `EffectInterpreter.ts` throws when a Duty raises anything but Foresee; the validator only catches a target after Foresee, and a test card passes the catalog check and still throws. No shipped Duty reaches it (census 2026-09-25: no Duty destroys or sacrifices) | S-M; lands before First Dawn prints any Duty that removes a creature | lane A's wave |
| G8 | A held dies trigger ends a spell early | With a Hauntlink payable, a dies trigger raised mid-spell is held, and the op loop then returns without carrying the spell's remaining ops. Read in `EffectInterpreter.ts` (the rev-4 hold and the loop's pending branches); no test pins it | M; **if the failing test confirms it, it is a live rules bug and belongs in 1.8.1** | lane 0, then with Provoked ordering |
| **AI** | | | | |
| G9 | Paid Duties never used in main phase 1 | `activatedPolicy.ts` drops any Duty that costs mana in main 1, by design at the time | S, plus floors if they move | lane E wave 3 |
| **Art** | | | | |
| G10 | Cards drawn with the loading stand-in never redraw | The `art-file` event is emitted and nothing listens; `CardThumbCache` keeps a thumb baked from the stand-in | M | lane D |
| G11 | The half-resolution tier is not built for Pages | `deploy.yml` runs only the manifest step; the half-res script needs Python | S | lane D |
| **Menus and meta** | | | | |
| G12 | Starborne and Drowned Deep have no set achievements | Sands of the Duat has 3; Silver Veil, Dark Tales and Yokai Nights have 8 each | S-M; names and text authored by the design model, not Codex | lane G, beside First Dawn's |
| G13 | Achievements round 99.5% up to "100%" | `Math.round` in `AchievementsScene.ts` | XS | lane G |
| G14 | The Premium draft inspector counts every treatment as "plain" | "You own N/4 plain" adds copies across treatments; only plain copies melt | XS | lane G |
| G15 | Letter codes ("U·56 R·36") in the Limited Deck Builder | `deckStats.ts` via `LimitedDeckBuilderScene.ts`; "0 lands" is fixed | XS-S | lane G |
| G16 | Two copies of the "Leave draft?" dialog | Line-for-line copies in the two Limited scenes | S | lane G |
| G17 | Confirms that never disarm: Decks menu delete, Collection craft | Found by the 2026-09-25 re-check | XS | lane G |
| G18 | "colours" in the stats panel | Everything else in the UI says "color". Found by the re-check | XS | lane G |
| **Layout** | | | | |
| G19 | ProfileScene is all literal coordinates | About 30 calls, no presentation module; Settings got one in #411 | M | lane C, as its first scene |
| G20 | Title-safe misses left after #431 (the frame is x 64-1216, y 36-684) | Titles above y 36 in eight scenes (Gauntlet, Glossary, Limited, Practice, Shop, Limited Deck Builder, Limited Draft, the Deck Builder's Decks view); the Deck Builder title row at y 32 and its pool pager at y 688; the Duel HUD (portraits, life, piles and Undo at the edges); the Practice peek tile, inside the frame but 59 px wide against the 90 px tap floor | M; the Duel HUD part is layout-sensitive, so before-and-after screenshots go to the owner | lane C |
| **Telemetry** | | | | |
| G21 | The play-stats card batch covers only play before the first tab-hide (review E6) | The copy was fixed in #428; the behaviour is unchanged, and the ruling in [plan-telemetry-and-accounts.md](plan-telemetry-and-accounts.md) reads "once when the session ends" | M, a design question against that ruling | lane 0 |

Most of these touch the same scenes as accessibility (lane C) and art
streaming (lane D). They land by file set before those lanes' scene passes
reach the same files, or inside them, never in parallel on one file.

### Lane H — measurement and release mechanics

- **One save bump** (v36, lane C) and **one replay log bump** (v15, lane A
  plus any action-format change from lane G), each landing once.
- Every new mechanic gets its rate before card data. The balance matrices
  re-run when the AI or decks move; floors only ratchet up.
- **The tower at 28 rungs**: the win-rate gate shape for 27-28 is decided
  before the rungs land (lane B).
- **The sweep runs last** against the final field, on six personas (D9).
- The cut follows the checklist that works: three version surfaces plus
  `Cargo.lock`, `app:build` before tagging, `docs/release-notes/v1.9.0.md`
  in the shape the owner accepted for 1.8.0 as the release body, README
  figures re-measured, the two manual matrices, a two-parent merge into
  `main`.

## Moved out of 1.9

| Item | New slot | What that means |
| --- | --- | --- |
| **Mobile overhaul** ([plan](plan-mobile-overhaul.md)) | **2.0** (ruled 2026-09-25; D4 asks to confirm against the spine's 2.1 valve) | The 2026-09-23 competitive research and the eleven mockups wait for it, with the four mobile decisions (portrait duel, the portrait art viewer, menu orientation, recording the verdict). The two cheap proposals (stop blocking upright tablets, art on the rotate screen) park with it. The standing Tier 1 real-device pass is unchanged |
| **AI suggested decks** ([plan](plan-suggested-decks.md)) | **After 2.0** | Tutor v1 and the replay coach stay on one arc. A browser tutor needs a cheap evaluator; lane F's Medium screen is the nearest thing to one |
| **Editable Limited Warchest** | **After 2.0** | The pip-demand-weighted automatic fill from #279 stays the only build |
| Live spectating ([plan-player-replays.md](plan-player-replays.md) wave 4) | Cancelled | It rode multiplayer, cancelled 2026-08-24 |

## Sequencing

Waves are dependency-ordered. Within a wave, lanes run in parallel in
separate worktrees, by file set.

| Wave | Contents | Gate |
| ---: | --- | --- |
| **0** | Lane 0 (1.8.1) off `main`; this plan and the roadmap and spine sync; `release/1.9` cut from `main` after 1.8.1; the main checkout fast-forwarded on the owner's word (uncommitted `.gitignore` and `run-sweep.ps1` edits sit there); the duplicate comparator learns Duty, Tithe and Whispers | 1.8.1 on the cut checklist; ladder rungs 1-6 |
| **1** | Specs and briefs: `plan-first-dawn-engine.md` and the First Dawn identity brief (Opus 5.5); the accessibility plan re-verified and the localization ruling (D3); usage audit waves 0-1; weenie profiling; the art streaming design | owner approval of each spec |
| **2** | Engine: Provoked and Hunt with rates, AI at three difficulties, converter, replay bump, glossary. Accessibility wave 1 with the v36 bump. Art streaming built. Sweep levers 2-3 and their one-persona comparison. Lane G code fixes, by file set | full ladder, win-rate gates unchanged, replay goldens, the no-change test |
| **3** | Set: the ~200 overplan, the owner's cut, concretion, transcription. The art pilot, then the art run from the day the cut locks. Accessibility wave 2 (core scenes) | check-art-bible green, every token minted, duplicate audit filed |
| **4** | Metagame content: the theme deck, rungs 27-28 with Darlings decks, floors from the final band. The usage audit's full read (wave 2) and its fixes (wave 3), paid Duties first. Accessibility wave 3 (long tail). The balance items of D7 | matrices, precon and boss floors, fixture matrix |
| **5** | QC day, the sweep last on six personas, release notes, the 1.9.0 cut | the cut checklist |

For scale: the 1.7 train (151 cards plus an engine wave) ran 2026-08-24 to
09-03. 1.9 is that shape plus accessibility, art streaming and the
measurement work.

## Decisions for the owner

Numbered so rulings can cite them. Recommendations are the first option.

1. **D1 The keyword's form.** The ruling says "Provoke"; the slate, the spine
   and the retired list say **Provoked**. Recommendation: **Provoked**, the
   condition the creature is in, which reads as a trigger ("Provoked: draw a
   card"). It also avoids Magic's own Provoke (Legions, 2003), an unrelated
   forced-block keyword that the blades-db translation would otherwise
   mis-map.
2. **D2 Set size.** Recommendation: **about 150, overplanned to about 200**
   (Starborne cut 151 from 200), with Starborne's rarity shares as the
   default histogram: 75 C / 45 R / 14 SR / 10 SSR / 7 UR at 151. The
   histogram locks at the overplan.
3. **D3 Localization, before accessibility wave 1.** A English-only, B
   catalog-ready English (strings routed through stable keys, English
   shipped, no translation), C a second locale. The plan recommends **B**:
   it buys reversibility before Story Mode's text exists, and its extraction
   rides the same scene sweep as accessibility. A is the cheapest now and
   the most expensive after Story Mode.
4. **D4 Mobile in 2.0 or 2.1.** 2.0 already carries a Large set (Core Set II),
   The Mandate, the shared-game-state engine feature and Story Mode, and the
   cadence rule says a Large release carries the set, the engine feature and
   little else. The spine's own valve for mobile was 2.1. Recommendation:
   **2.1**, unless mobile is wanted before Story Mode. If it stays at 2.0,
   Story Mode is the spine's named separable piece.
5. **D5 Usage audit U2-U5.** Recommendation: the audit plan's own answers.
   Code in `scripts/`; no passive mechanics in waves 0-2; no usage gate in CI
   until a full audit shows what normal is; Hard first, then one Medium pass
   for the player-side starter columns.
6. **D6 1.8.1 timing.** Recommendation: **cut 1.8.1 when the post-release
   sweep's reading is in**, carrying lane 0 in one patch; `release/1.9` is
   cut from `main` after it. The alternative, folding lane 0 into 1.9,
   leaves the seventeen regenerated arts and the #436 fixes unshipped for a
   whole train.
7. **D7 The balance items found in 1.8 but not on the ruled list.**
   Hauntlink Apex effectively costs 8 mana since rules revision 4 made the
   link an ability paid after casting, and it is cast in 7% of games (AI
   audit, 2026-09-19). The tower's top tier T6 read 64.9% with its band
   re-centred to .585 on QC day, and its tune-up was left for 1.9. The Queen
   of the Lanterned Roof (rung 19) is the one converter defect measured
   (58.6 to 63.9 with her authored cards) and the thinnest untuned boss.
   Reanimator is the weakest sweep persona. The collection-dilution revisit
   was waiting on a finished sweep. Recommendation: **one balance pass in
   wave 4, after the usage audit's first read**, so each fix aims at a
   measured cause. The Apex fix is a card slate, authored by the design
   model and picked by the owner.
8. **D8 The older-set near-duplicates** from the 2026-09-24 review: six
   same-tribe stat ladders (Ragnarök and Duat twice each, Starborne twice),
   and two pairs that differ only by a rider's cost (Duat's The Debt Is
   Called against Two Jars, One Heart, Retell {2}{B} against {3}{B}; Dark
   Tales' Ocean Wayfinder against Tide-Reader of the Far Reef, Skim {2}
   against {1}). Recommendation: **leave the stat ladders** (a curve of
   bodies is ordinary Magic practice) **and split the two rider-cost pairs**,
   with a slate the owner approves, mana-neutral as in #317.
9. **D9 Where the sweep runs.** Recommendation: **back to last before the
   cut**, the standing rule, once lane F brings a six-persona sweep under a
   night. If it still takes days, the owner rules as for 1.8.

## Non-goals

- No relitigating the spine: First Dawn is the Small set, Core Set II the 2.0
  Large, Brass Court stays 2.1, multiplayer is cancelled.
- No mobile overhaul, suggested decks or editable Limited Warchest (ruled out
  of 1.9 on 2026-09-25).
- No taplands or utility lands in First Dawn while the reserve rule stands.
- No player telemetry of mechanic usage; the audit is a harness tool.
- No floors lowered. No mid-train sweep.
- No cloud accounts code; that is 2.1.
