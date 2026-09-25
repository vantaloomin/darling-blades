<!-- source-of-truth: docs/plan-road-to-2.0.md, docs/plan-expansion-slate.md, docs/plan-accessibility-i18n.md, docs/plan-mechanic-usage-audit.md, docs/plan-sweep-speed.md, docs/plan-art-regen-2026-09-22.md, docs/metagame-sweep.md, src/engine/types.ts, src/art/artLoader.ts, src/art/ArtResolver.ts, src/ui/CardThumbCache.ts, src/ai/activatedPolicy.ts, src/meta/SaveManager.ts, src/meta/Replay.ts, scripts/audit-overlap.ts, scripts/personas/craft.ts · last-verified: 2026-09-25 · program doc — the 1.9 train, opened on the owner's scope rulings of 2026-09-25; re-verify when the owner rules on the open decisions or a lane lands -->

# Darling Blades 1.9 — program plan

**Status 2026-09-25: scope RULED, build not started.** The owner ruled the
1.9 scope on 2026-09-25 (the table below), then the same day grouped the 1.8.x
items with every open 1.8 review finding as the 1.8.1 patch (lane 0) and ruled
D1-D6, D8, D10 and D11. D7 and D9 remain open. This document turns those rulings into lanes, waves and
the decisions that are still open. Build starts wave by wave on the owner's
word; each open decision gates only the lane that names it.

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

Lanes are ordered by dependency, not by size. Lane 0 is the 1.8.1 patch and
ships first; the review carry-over rides in it, and its items keep their G
numbers. A is the engine and rules work that must exist before card data. B
is the set. C, D, E and F are independent of the set and run beside it. H is
measurement and release mechanics.

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
| G8 | A held dies trigger ends a spell early | With a Hauntlink payable, a dies trigger raised mid-spell is held, and the op loop then returns without carrying the spell's remaining ops. Read in `EffectInterpreter.ts` (the rev-4 hold and the loop's pending branches); no test pins it | M; a failing test first; if it confirms, a live rules bug | engine |
| **AI** | | | | |
| G9 | Paid Duties never used in main phase 1 | `activatedPolicy.ts` drops any Duty that costs mana in main 1, by design at the time | S, plus a floor re-measure (a brain change) | AI |
| **Art** | | | | |
| G10 | Cards drawn with the loading stand-in never redraw | The `art-file` event is emitted and nothing listens; `CardThumbCache` keeps a thumb baked from the stand-in | M | art |
| G11 | The half-resolution tier is not built for Pages | `deploy.yml` runs only the manifest step; the half-res script needs Python | S | art |
| **Menus and meta** | | | | |
| G12 | Starborne and Drowned Deep have no set achievements | Sands of the Duat has 3; Silver Veil, Dark Tales and Yokai Nights have 8 each | S-M; names and text authored by the design model, not Codex, before the code | menus and meta |
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

Two constraints hold the patch to patch size. **No save schema change:** G1
is designed without a new deck field (legality is already computed), and if
it cannot be, it comes back to the owner. **One replay bump (v15) costs
players nothing extra:** #436 already changes the card-database stamp every
saved replay is checked against, so saved replays go stale with 1.8.1 either
way. G9 changes the brain, so the patch re-measures the floors, and the
release notes say the sweep measured the pre-fix brain. The notes follow the
shape accepted for 1.8.0.

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

The authoring order is the one Starborne and Drowned Deep used. The rows
cannot start until lane A's rates exist:

1. **Identity brief**, approved by the owner before any rows: setting, the
   colour pie, what each colour does with Provoked, Hunt and Duty, enabler
   density per colour (the Drowned Deep cut failed it in white and red),
   the precon's plan, and the metagame it lands in. An attack-forward set
   meets a field where go-wide trails and reanimator is the weakest persona;
   the brief should say which of those it means to move.
2. **Overplan of about 200-215 candidates** for a cut of 150-165 (D2,
   ruled), every row
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
- **Set achievements.** Starborne and Drowned Deep get theirs in 1.8.1
  (G12); First Dawn ships with its own.
- An art-bible section, set icon, booster blurb, land style, the
  `SET_TITLES` entry, glossary and dictionary rows, and a blades-db rebuild.
- **Art is the long pole**: 150-165 card arts, the tokens and two boss
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
  art arrives. The redraw on arrival lands in 1.8.1 (G10); streaming makes
  it the normal case, so this lane builds on it.
- A texture destroyed while a game object still references it is a crash,
  or Phaser's green square. Pack opening needs its art before the flip; a
  duel preloads both decks.
- The half-resolution tier reaches the Pages deploy in 1.8.1 (G11); this
  lane's budget counts on it for the phone tier. Half-resolution art on
  desktop was rejected in 1.8,
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
and one test proves identical win counts with and without it. U2-U5 were
ruled 2026-09-25 as the plan recommended (D5): the code lives in `scripts/`,
passive mechanics stay out of waves 0-2, there is no usage gate in CI until a
full audit shows what normal is, and Hard goes first, then one Medium pass.

Sequencing: its waves 0-1 (the classifier, the wrapper, `--usage`) land
before lane A's AI work, so Provoked and Hunt ship with their usage rows. Its
wave 2, the first full audit of rungs 1-26, is read into a findings note.
Wave 3 fixes what that note justifies, behind the unchanged gates. The one
finding already known, paid Duties unused in main phase 1, is fixed in 1.8.1
(G9), so the first audit measures the fixed brain. Any brain change
re-baselines the floors it moves.

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

### Lane H — measurement and release mechanics

- **One save bump** (v36, lane C); 1.8.1 carries none. **Replay log bumps**:
  v15 in 1.8.1 (G6) and v16 with lane A, the two new mechanics.
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
| **Mobile overhaul** ([plan](plan-mobile-overhaul.md)) | **2.0**, the itch.io launch (D4, ruled 2026-09-25) | The 2026-09-23 competitive research and the eleven mockups wait for it, with the four mobile decisions (portrait duel, the portrait art viewer, menu orientation, recording the verdict). The two cheap proposals (stop blocking upright tablets, art on the rotate screen) park with it. The standing Tier 1 real-device pass is unchanged |
| **AI suggested decks** ([plan](plan-suggested-decks.md)) | **After 2.0** | Tutor v1 and the replay coach stay on one arc. A browser tutor needs a cheap evaluator; lane F's Medium screen is the nearest thing to one |
| **Editable Limited Warchest** | **After 2.0** | The pip-demand-weighted automatic fill from #279 stays the only build |
| Live spectating ([plan-player-replays.md](plan-player-replays.md) wave 4) | Cancelled | It rode multiplayer, cancelled 2026-08-24 |
| **Older-set near-duplicates** (D8) | **1.9.x** | A whole-pool review and resolution plan once the comparator is fixed (wave 0); the owner approves the rule and the slate; fixes ship in a 1.9.x patch |

## Sequencing

Waves are dependency-ordered. Within a wave, lanes run in parallel in
separate worktrees, by file set.

| Wave | Contents | Gate |
| ---: | --- | --- |
| **0** | The 1.8.1 train (lane 0) on `release/1.8.1`, cut when the sweep reads; this plan and the roadmap and spine sync; `release/1.9` cut from `main` after 1.8.1; the main checkout fast-forwarded on the owner's word (uncommitted `.gitignore` and `run-sweep.ps1` edits sit there); the duplicate comparator learns Duty, Tithe and Whispers | 1.8.1 on the cut checklist, its floors re-measured |
| **1** | Specs and briefs: `plan-first-dawn-engine.md` and the First Dawn identity brief (Opus 5.5); the accessibility plan re-verified; usage audit waves 0-1; weenie profiling; the art streaming design | owner approval of each spec |
| **2** | Engine: Provoked and Hunt with rates, AI at three difficulties, converter, replay bump, glossary. Accessibility wave 1 with the v36 bump. Art streaming built. Sweep levers 2-3 and their one-persona comparison | full ladder, win-rate gates unchanged, replay goldens, the no-change test |
| **3** | Set: the ~200 overplan, the owner's cut, concretion, transcription. The art pilot, then the art run from the day the cut locks. Accessibility wave 2 (core scenes) | check-art-bible green, every token minted, duplicate audit filed |
| **4** | Metagame content: the theme deck, rungs 27-28 with Darlings decks, floors from the final band. The usage audit's full read (wave 2) and its fixes (wave 3). Accessibility wave 3 (long tail). The balance items of D7 | matrices, precon and boss floors, fixture matrix |
| **5** | QC day, the sweep last on six personas, release notes, the 1.9.0 cut | the cut checklist |

For scale: the 1.7 train (151 cards plus an engine wave) ran 2026-08-24 to
09-03. 1.9 is that shape plus accessibility, art streaming and the
measurement work.

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
  `release/1.9` is cut from `main` after it.
- **D8 The older-set near-duplicates. RULED: a review and a resolution plan,
  resolved in a 1.9.x patch.** Known today, from the 2026-09-24 review: six
  same-tribe stat ladders (Ragnarök and Duat twice each, Starborne twice),
  and two pairs that differ only by a rider's cost (Duat's The Debt Is Called
  against Two Jars, One Heart, Retell {2}{B} against {3}{B}; Dark Tales'
  Ocean Wayfinder against Tide-Reader of the Far Reef, Skim {2} against
  {1}). The review covers the whole pool, not only these rows, and can run
  any time after wave 0 teaches the comparator Duty, Tithe and Whispers. It
  writes the rule (which kinds of sameness are acceptable) and a slate, the
  owner approves both, and the fixes ship in 1.9.x.
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

**Open:**

- **D7 The balance items found in 1.8 but not on the ruled list.** Five
  items, one recommendation each:
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
- **D9 Where the sweep runs.** The standing rule is that the metagame sweep
  runs last before a cut, so the balance numbers describe the field players
  get. 1.8 set it aside because a sweep took days; it ran after launch with
  five personas. Recommendation: **back to last before the 1.9.0 cut, all six
  personas**, once lane F's weenie fix and the two levers are in. The test is
  a measured one: if a full six-persona sweep finishes in about a night on
  the hosted runners, it runs before the cut and a degenerate deck is caught
  before players see it. If it still takes days, the 1.8 arrangement repeats
  (after launch, a hotfix only if egregious). It runs on GitHub-hosted
  runners either way, so the owner's machine is free.

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
