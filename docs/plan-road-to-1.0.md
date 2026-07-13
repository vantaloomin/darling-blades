<!-- source-of-truth: docs/roadmap.md, docs/architecture.md, docs/mobile-lan-plan.md, src/engine/rng.ts, src/engine/Game.ts, src/engine/actions.ts, src/engine/view.ts, src/engine/events.ts, src/meta/SaveManager.ts, src/meta/Achievements.ts, src/meta/collectionFilter.ts, src/meta/deckColorIdentity.ts, src/meta/Economy.ts, src/meta/PackOpener.ts, src/meta/Limited.ts, src/meta/DeckCode.ts, src/meta/DeckStorage.ts, src/meta/deckFace.ts, src/scenes/AchievementsScene.ts, tests/meta/achievements.test.ts, tests/meta/deckColorIdentity.test.ts, tests/meta/collectionFilter.test.ts, tests/meta/limited.test.ts, tests/meta/deckCode.test.ts, src/data/catalog.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/config/rules.ts, src/scenes/, src/ai/personality.ts · last-verified: 2026-07-12 · design/plan doc — re-verify when the referenced code changes -->

# Road to 1.0 — feature plan

> **Update (2026-07-08):** `SaveData` is now **v15**. Feature 1 (optional
> tutorial/onboarding) shipped as v9 → v10, Feature 5 (Achievements +
> collection goals) shipped as v10 → v11, and the themed achievement follow-up
> shipped as v11 → v12 (`gauntlet.clearStyles`). A later schema-free catalog pass
> expanded Greek, Beastkin, and Ragnarök achievement coverage. Feature 2 (daily
> quests + win streaks) shipped as v12 -> v13, and Feature 3 (Sealed / Draft
> Limited) shipped as v13 -> v14, and Feature 4 deck share codes shipped
> schema-free. Per-deck hero images shipped as v14 -> v15. Deterministic replay
> logs/viewer are deferred to 1.1/1.2. Future migration numbers below should be
> read as "next free version after v15" unless
> the feature section has already been marked shipped.
>
> **Update (2026-07-10):** **Limited is descoped from the 1.0 launch** (user
> decision). The implementation stays complete and tested in the codebase, but
> PR #54 removed its MainMenu entry — it ships in a post-1.0 release alongside
> a future expansion after more testing (balance/economy + polish blockers
> recorded in [plan-v1.1-post-launch.md](plan-v1.1-post-launch.md)). The 1.0
> definition below is amended accordingly: criterion 3 is satisfied by
> achievements/collection goals + the gauntlet.

Darling Blades is playable end-to-end, art-complete, and stable (`SaveData` v15 -
see the update note above). What separates the current build from a polished 1.0 is
not more systems but the connective tissue that turns a working prototype into a
game people keep coming back to: a **reason to log in tomorrow**, a **first
session that teaches**, a **shareable moment**, a **content mode with high
replay-to-effort ratio**, and the **goal scaffolding** that gives the 210-card
pool meaning. The tutorial, goal scaffolding, Limited, and deck-share slice are
now shipped; this doc keeps the shipped record plus the remaining polish gates.

## Current 1.0 status (2026-07-08)

The five 1.0 gameplay/product features are now implemented: tutorial/onboarding,
daily quests + win streaks, Achievements + collection goals, Sealed / Bot Draft
Limited, and deck share codes. The user-directed replay slice from Feature 4 is
explicitly deferred to 1.1/1.2 and is not a launch blocker. **As of 2026-07-10,
Limited is implemented but descoped from the launch** (hidden from MainMenu,
PR #54 — it ships post-1.0 with a future expansion). Constructed economy tuning
landed 2026-07-09/10 (PRs #35/#36: 9-card 450g/525g boosters, 50g dailies,
reduced streak payouts, dupe-refund tuning, backed by the
`scripts/progression-sim.ts` harness). What remains for a credible 1.0 is
polish and validation: a by-ear/by-eye pass for audio and
pack/foil/readability effects (now also covering the 2026-07-10 UI-refresh
theme system and rebuilt duel board), the real-device mobile pass, any final
bug fixes found while playing through the complete loop, and the release cut
itself (version stamps are still 0.1.0; tag + rebuilt desktop installer).

## Feature 1 — Interactive tutorial + onboarding flow (shipped 2026-07-08)

**Status:** shipped in PR #28. The implementation uses `src/ai/ScriptAI.ts`,
`src/ui/CoachMark.ts`, `src/data/tutorial.ts`, and `DuelScene` overrides rather
than a separate engine fork. First launch prompts for the optional tutorial; the
flow is replayable from the MainMenu "How to Play" entry. The old first-launch
starter picker was removed, and the shop now owns the one-free-starter flow.

### Problem

A new player lands on the MainMenu, picks a starter, and is dropped into a full
MTG-style duel — stack, priority windows, summoning sickness, combat steps —
with no scaffolding. The genre is famously unforgiving to newcomers. There is
currently **no first-run detection and no teaching surface at all**; the closest
thing is the summoning-sick badge and castable-now gold dots already in
`DuelScene`. For a 1.0 this is the single highest-leverage retention fix: most
churn happens in the first ten minutes.

### Design

A scripted, on-rails **tutorial duel** against a fixed fake opponent that plays a
pre-authored line, plus a lightweight **coach-mark layer** that points at real
UI regions ("this is your mana", "tap to attack", "hold to zoom"). It ends by
handing the player a small gold grant and routing them to the shop for a first
pack. First-run is detected from the save (`stats.wins + stats.losses === 0` and
`starterChosen === null`) so returning players never see it, with a "Replay
tutorial" entry added to the MainMenu for opt-in.

### Architecture fit

- **New scene** `src/scenes/TutorialScene.ts`, registered in `src/main.ts`
  between MainMenu and Duel. It reuses the real engine and real `DuelScene`
  rendering primitives but drives a **fixed seed** and a **scripted AI**.
- **Scripted opponent** as a new tiny brain `src/ai/ScriptAI.ts` implementing the
  same `chooseAction(view, legal)` contract the other AIs satisfy — it walks a
  hard-coded action list and falls back to "pass" if the human deviates. Because
  the engine is seeded (`src/engine/rng.ts`) and both decklists are fixed, the
  tutorial line is perfectly reproducible: the same seed + same actions →
  identical `GameState` every run, so the coach marks can key off known turns.
- **Coach-mark overlay** `src/ui/CoachMark.ts` — a dimmer + spotlight cutout +
  speech bubble, gated on `overlayGuardTargets()` like the existing pick
  overlays. It reads engine state (`awaiting.kind`, `state.step`) to advance,
  never hard-coded timers, so it can't desync.
- **Constraint gating**: the tutorial constrains `legalActions` presentation
  (dim everything except the taught action) without touching the engine — the
  engine still validates. This keeps the iron rule intact: the engine is not
  forked for the tutorial.

### SaveData impact

`save.tutorialDone: boolean` landed as the **v9 → v10** migration in
`src/meta/SaveManager.ts`: the step derives veteran saves from nonzero win/loss
history so returning players skip the prompt. Migration coverage lives in
`tests/meta/meta.test.ts`.

### Phased build plan

1. **Milestone A (runnable):** `TutorialScene` boots the engine with a fixed
   seed + `ScriptAI`, renders via existing `DuelScene` components, no coach marks
   yet — a scripted duel you can play. Testable headless: `ScriptAI` line + fixed
   seed reaches the authored end-state.
2. **Milestone B:** `CoachMark` overlay + the 6–8 authored beats (mana, cast,
   attack, block, response window, end turn).
3. **Milestone C:** first-run detection, MainMenu "Replay tutorial", reward grant
   + route to shop, v10 migration.

### Test strategy

Headless: `ScriptAI` determinism (seed + line → fixed end-state), the v10
migration (fresh sets `false`, veteran coerces `true`), and a first-run predicate
unit test. Coach-mark visuals fall under the existing by-eye polish caveat.

### Effort / risk

**Medium effort, low risk.** No engine changes, no economy changes. The main
cost is authoring good copy and a clean scripted line; risk is scope creep on the
number of taught beats — cap at eight.

## Feature 2 — Daily quests + win streak (shipped 2026-07-08)

**Status:** shipped as `SaveData` **v12 -> v13**. The implementation adds a
pure `src/meta/Quests.ts` bank of **25 daily objectives**, rolls **3 active
quests** per local calendar day, allows **3 total daily rerolls**, and grants
explicit claim rewards from the MainMenu daily panel. Streak rewards are paid
automatically only on the first **win** of a calendar day; merely playing a
game never advances the streak.

### Problem

There is exactly one recurring incentive today: the first-win-of-day gold bonus
(`stats.lastWinDay` in `SaveData`, applied in `src/meta/Economy.ts`). That is a
seed, not a loop. A 1.0 needs a **daily reason to open the app** and a
**medium-term goal ladder** so the gold economy (packs, and this session's
shard/sell sink) has steady inflow. This is the classic F2P retention spine,
adapted for a single-player offline game.

### Design

Three rotating **daily quests** grant gold on explicit claim, backed by a
25-objective bank that covers wins, games finished, land plays, spell casts by
type/color/rarity, damage, life gain, deaths, tokens, mill, discard, and
multicolor play. Quests are drawn deterministically from `todayString()` so the
same calendar day yields the same three quests unless the player spends one of
the day's three rerolls. Progress is tracked by subscribing to the engine's
existing event stream. The **win streak** escalates gold on the first win of
each calendar day; a day with only losses or unfinished games does not count.

### Architecture fit

- **New meta module** `src/meta/Quests.ts` (Phaser-free, unit-testable): a pure
  `DailyQuestDef` catalog, `rollDailyQuestIds(dateStr, seed)` using the same
  `createRngState`/`rngInt` primitives from `src/engine/rng.ts` seeded off a hash
  of `todayString()`, and `applyDailyQuestProgress(save, db, events, today)` that
  folds a `GameEvent[]` batch into counters. Quest predicates read only public
  event fields (`lifeChanged`, `spellCast.cardId`, `gameEnded.winner`, etc.), so
  no new engine surface is needed.
- **Wiring**: `DuelScene` already receives event batches in `processEvents`; it
  forwards them to a `Services`-held quest tracker. Gauntlet/practice/tutorial all
  flow through the same batch, so quest progress is uniform.
- **UI surface**: a **Daily Blades** panel on the MainMenu with progress bars,
  per-quest claim/reroll actions, rerolls remaining, and the current/next streak
  reward. No new top-level scene needed.

### SaveData impact

Shipped as **v12 -> v13**:
`save.daily = { day: string, quests: { id, progress, target, rewardGold,
claimed }[], rerollsUsed: number, streak: { count, lastWinDay } }`. Migration
seeds today's rolled quests; a broken/absent block re-rolls on load. Tests cover
the migration, deterministic rolls, reroll cap, claim idempotency, event folds,
and the win-only streak rule.

### Determinism considerations

Quest rolling must be seeded, not `Math.random`, so tests are stable and there is
no client-side reroll cheat. Progress counters are pure folds over event batches
— no engine mutation, so win-rate baselines are untouched.

### Phased build plan

1. **Milestone A:** `Quests.ts` pure core + tests (roll, fold, complete).
2. **Milestone B:** save block + v13 migration + Economy grant hook.
3. **Milestone C:** MainMenu Daily panel + streak UI + claim flow.

### Test strategy

Headless-heavy: deterministic daily roll, event-fold progress for each predicate
type, streak increment/reset, claim idempotency (can't double-claim), migration.
This feature is almost entirely gate-able by vitest, which the repo rewards.

### Effort / risk

**Medium effort, low risk.** Purely additive economy. Risk: economy inflation —
gate quest gold against `ECONOMY` constants in `src/config/rules.ts` and keep
daily inflow modest relative to pack cost.

## Feature 3 - Sealed / Draft limited mode (shipped 2026-07-08)

### Problem

The only deckbuilding outside Limited is 60-card Constructed from the owned
collection (`src/meta/DeckStorage.ts` `validateDeck`). Limited gives players a
fresh deckbuilding puzzle that does not depend on collection depth and reuses the
existing card pool, rarity table, AI, and duel engine.

### Design

Shipped as `SaveData` **v13 -> v14**. The implemented 1.0 Limited mode includes
both **Sealed** and **Bot Draft**. Sealed opens six seeded temporary boosters.
Draft seats the player with seven deterministic bots for three pick-one-pass
packs, passing left/right/left. Both modes build from an ephemeral run pool plus
unlimited basics, require an **exactly 40-card** deck, then play a three-match,
no-elimination run against easy/medium/hard AI. Limited cards never enter the
permanent collection; rewards are gold, stats, best records, and history entries.

### Architecture fit

- `src/meta/Limited.ts` owns side-effect-free pack rolling, sealed pools, bot
  draft state transitions, AI pick scoring, limited auto-builds, and duel launch
  payloads.
- `validateLimitedDeck` in `DeckStorage.ts` enforces exactly 40 cards, run-pool
  counts, unlimited basics, and no tokens.
- `applyLimitedMatchResult` in `Economy.ts` records stats/first-win state and pays
  `ECONOMY.limitedRunGold` after match 3.
- `LimitedScene`, `LimitedRevealScene`, `LimitedDraftScene`, and
  `LimitedDeckBuilderScene` cover the player flow, then `DuelScene` uses existing
  deck overrides plus a Limited result marker.

### SaveData impact

`SaveData` v14 adds `limited: { activeRun, history, bestSealedWins,
bestDraftWins }`. Active runs persist mode, seed, temporary pool/draft state,
deck, match index, record, opponent seeds, and opponent decks. Migration defaults
to no active run and empty history.

### Determinism considerations

Pools, draft packs, bot picks, AI pools, and duel seeds all derive from the stored
run seed plus compact active-run state, so a run survives reload byte-identically.
Limited uses the existing deterministic duel engine through deck overrides; no
engine fork was added.

### Phased build plan

1. **Shipped:** pure Limited core, validation, auto-build, rewards, and save v14.
2. **Shipped:** Sealed reveal, Bot Draft picker, Limited deck builder, MainMenu
   entry, and DuelScene result routing.
3. **Future polish:** richer card-grid reuse, draft pick animation, and Limited
   achievement hooks once more run-history goals are desired.

### Test strategy

Covered by `tests/meta/limited.test.ts` and migration coverage in
`tests/meta/meta.test.ts`: deterministic pack/sealed rolls, validation edges,
bot draft pass/pick determinism, completed draft pools, 40-seed auto-build
legality, Limited reward/history behavior, and v13 -> v14 migration.

### Effort / risk

**Shipped, medium residual risk.** Determinism and legality are covered; the
remaining risk is balance texture for auto-built limited decks, which can be
tuned with the balance harness after more play data.

## Feature 4 - Deck share codes (shipped 2026-07-08; replays deferred)

### Problem

The game had multiple saved decks but no low-friction way to share one. For 1.0,
the required shareability slice is deck export/import: a player can copy a code
from Deck Builder and another player can paste it into their Deck Builder, with
normal ownership and legality rules enforced on import.

Deterministic replay logs/viewer remain valuable, but they are now explicitly
deferred to 1.1/1.2 instead of gating 1.0.

### Design

Shipped as a schema-free pure meta feature:

- `src/meta/DeckCode.ts` encodes a decklist into a shorter versioned
  `DBD2-...` code, while still importing legacy `DBD1-...` codes. It decodes
  pasted codes into either `{ ok: true, cards }` or a friendly error.
- Codes preserve exact deck order and compress consecutive duplicate ids.
- Deck Builder has styled **Export Code** and **Import Code** buttons. Export
  requires a legal constructed deck; import decodes, then validates through
  `DeckStorage.validateDeck` so unowned cards, too many copies, wrong deck size,
  tokens, and unknown ids are rejected.
- Import updates the editor and leaves the existing **Save Deck** button as the
  explicit persistence step.

### Architecture fit

- **Deck codes** are pure and browser-free below the scene layer. They do not
  import Phaser, `CARD_DB`, save state, or browser clipboard APIs.
- **DeckBuilderScene** owns the styled copy/paste UI and routes import through
  the existing constructed validator.
- **Future replay work** should use a separate `src/meta/Replay.ts` module and a
  replay-specific save migration when it returns in 1.1/1.2.

### SaveData impact

No schema bump. Deck codes are transient strings and import into the existing
deck editor/save flow.

Future replay persistence should use the next free version after v15, likely
`save.replays: ReplayLog[]` capped to a small FIFO list, plus a migration test.

### Determinism considerations

Deck codes do not depend on engine determinism; they only serialize card ids.
Future deterministic replays remain the stronger determinism showcase and should
store a `dbVersion` stamp so card-rule drift can fail gracefully.

### Phased build plan

1. **Shipped:** `DeckCode.ts` encode/decode + DeckBuilder export/import buttons.
2. **Deferred to 1.1/1.2:** `Replay.ts` recorder wired into `DuelScene.submit`;
   save the last game as a log; golden-replay test.
3. **Deferred to 1.1/1.2:** read-only replay viewer scene + MainMenu Replays list
   + replay persistence + `dbVersion` guard.

### Test strategy

Covered in `tests/meta/deckCode.test.ts`: exact round-trip, non-consecutive
duplicate preservation, whitespace-tolerant paste, malformed-code rejection,
friendly error strings, and validation of decoded imports through constructed
deck ownership rules.

Future replay work still needs the **golden replay** test: a recorded log replays
to a byte-identical final `GameState`, plus migration coverage for replay
persistence.

### Effort / risk

**Deck codes shipped, low risk.** The remaining replay slice is medium risk and
post-1.0; its main risk is engine/db-version drift breaking old logs, handled by
the future `dbVersion` stamp and graceful refusal.

## Feature 5 — Achievements + collection goals (shipped 2026-07-08)

**Status:** shipped in the current Achievements + Collection Goals pass.
`src/meta/Achievements.ts` owns the pure catalog/evaluator/claim logic,
`src/meta/collectionFilter.ts` owns reusable completion summaries, and
`src/meta/deckColorIdentity.ts` owns the nonland deck-color classifier for tower
clear styles. `src/scenes/AchievementsScene.ts` is registered from MainMenu and
paged so the catalog can grow. Rewards are modest gold in the 1.0 slice;
cosmetic rewards remain a future extension because the game does not yet have a
general cosmetic-unlock save surface.

### Problem

The 210-card pool, five rarity tiers, and multi-axis variant system are a
completionist's dream with **no completion scaffolding**. `SaveData.stats`
already tracks wins/losses/packsOpened but nothing surfaces it, and there is no
long-horizon goal beyond "clear the gauntlet". For a 1.0, achievements convert
the existing systems (collection %, variant hunting, gauntlet completions, this
session's shard/sell) into durable goals — cheap to build, high perceived value.

### Design

A tiered **achievement set** across five buckets: collection, variants, theme,
mastery, and economy. The shipped catalog covers pool-percentage goals, five
color-completion goals, themed RoTK leader tiers, the legendary Greek god court,
the Beastkin leadership council, a larger Ragnarök pass scaled to its 69-card
expansion size (percentage completion, headline cast, Valkyries, Draugr, and
Jotun/Wolf goals), mono-/dual-color Avatar Gauntlet clear goals, variant chase
goals (first special, 10 special cards, black-frame card, void-holo card),
win/gauntlet mastery, and pack-opening economy milestones. Each achievement
awards gold through an explicit claim action. Collection completion is computed
from `collection` +
`collectionVariants` and `CARD_DB` totals, then shown in both the Achievements
scene and the Collection header.

### Architecture fit

- **New meta module** `src/meta/Achievements.ts` (pure): an `AchievementDef`
  catalog and `evaluateAchievements(save, db)` returning the status list. Evaluation reads
  only `SaveData` + `CARD_DB` aggregates (owned counts, variant keys via
  `variantKey`, `stats`, `gauntlet.completions`) — no engine coupling, so it's
  trivially testable. `syncAchievements(save, db)` recomputes newly unlocked ids
  on demand rather than tracking progress incrementally, avoiding drift.
- **Claim logic** is explicit and idempotent: `claimAchievement(save, id)` and
  `claimAllAchievements(save)` only pay rewards for unlocked, unclaimed ids.
- **UI surfaces**: an **Achievements scene** `src/scenes/AchievementsScene.ts`
  (locked/unlocked/claimed rows plus claim buttons) reachable from MainMenu, and
  a compact **completion-progress** readout in `CollectionScene`.
- **Reuses `src/meta/collectionFilter.ts`** for the completion math and the
  variant specialness ranking in `src/meta/variants.ts` for "best variant"
  achievements.

### SaveData impact

**v10 → v11**: `save.achievements: { unlocked: string[], claimed: string[] }`. On
load, `syncAchievements` runs and newly-satisfied achievements move to
`unlocked` (claim is a separate user action for the reward, so a fresh install
with an imported save doesn't silently swallow rewards). Migration defaults both
to `[]`. Because evaluation is recomputed from durable state, even a hand-edited
or migrated save re-derives correctly.

**v11 → v12**: `save.gauntlet.clearStyles: { monoColor, dualColor }`. The final
gauntlet rung records the active deck's nonland color style at completion time,
so mono-/dual-color tower-clear achievements remain durable history.

### Determinism considerations

None on the engine — this is pure meta/UI, evaluated from the save blob. No
win-rate impact.

### Phased build plan

1. **Milestone A:** shipped — `Achievements.ts` catalog/evaluator/claim logic +
   completion-tally extension to `collectionFilter.ts`, all tested.
2. **Milestone B:** shipped — `AchievementsScene` + Collection completion
   readout.
3. **Milestone C:** shipped — explicit gold claim flow + v11 migration.
4. **Milestone D:** shipped — themed RoTK leader tiers, mono-/dual-color tower
   clear achievements, paged Achievements scene, and v12 migration.
5. **Milestone E:** shipped — Greek, Beastkin, and scaled Ragnarök achievement
   passes derived from existing collection/variant data, with no schema bump.
6. **Future extension:** cosmetic rewards/card backs once a general cosmetic
   save/UI surface exists.

### Test strategy

Headless: `evaluateAchievements` against crafted saves (collection percentage,
color completion, variant chase, mastery/economy), claim idempotency,
completion-tally correctness against a known `CARD_DB` subset, themed
archetype/expansion targets, and the v10→v11 migration plus v11→v12 clear-style
migration. The current suite covers these in
`tests/meta/achievements.test.ts`, `tests/meta/deckColorIdentity.test.ts`,
`tests/meta/collectionFilter.test.ts`, and `tests/meta/meta.test.ts`.

### Effort / risk

**Medium effort, low risk.** Additive, pure, testable. Reward balance is kept
modest in the shipped slice by using small one-time gold grants and deferring
cosmetics.

## Suggested sequencing

Order by dependency and leverage, not size:

1. **Tutorial (Feature 1)** - shipped 2026-07-08 as `SaveData` v10.
2. **Achievements + collection goals (Feature 5)** - shipped 2026-07-08 as
   `SaveData` v11, with themed achievement history shipped as v12.
3. **Daily quests + streak (Feature 2)** - shipped 2026-07-08 as `SaveData` v13.
4. **Sealed / Draft Limited (Feature 3)** - shipped 2026-07-08 as `SaveData` v14.
5. **Deck share codes (Feature 4)** - shipped 2026-07-08 schema-free; the
   deterministic replay viewer is deferred to 1.1/1.2.
6. **Per-deck hero images** - shipped 2026-07-08 as `SaveData` v15.

The remaining `SaveData` version walk starts at **v15**. Post-1.0 replays use
the next free version if they persist replay history. Every migration ships with
a test, per the iron invariant.

## Definition of 1.0

Darling Blades is release-ready when:

- **A cold-start player is taught** — first run routes through the tutorial, and
  the first ten minutes never leave them confused.
- **There is a daily reason to return** — daily quests + streak give a fresh,
  seeded goal every calendar day. Shipped in v13.
- **The card pool has a purpose beyond the gauntlet** — achievements/collection
  goals are shipped. _(Amended 2026-07-10: Limited is implemented but descoped
  from the launch — it releases post-1.0 with a future expansion, so it no
  longer gates this criterion.)_
- **Great decks are shareable** — deck codes provide copy/paste deck export and
  import through the normal constructed validator. Deterministic game replays are
  deferred to 1.1/1.2.
- **The polish backlog is closed** — the by-ear/by-eye music/FX pass and the
  real-device mobile pass (both already tracked in roadmap.md's Planned section)
  are done.
- **The invariants still hold** — engine purity, redacted views, seeded
  determinism, and green migrations/tests through the whole version walk.

Deliberately **out of scope for 1.0** (post-launch): the **public Limited
release** (implemented, hidden from MainMenu since PR #54; ships with a future
expansion after balance/economy + polish work — see
[plan-v1.1-post-launch.md](plan-v1.1-post-launch.md)), deterministic replay
logs/viewer, Tier-2 LAN PvP (already deferred in mobile-lan-plan.md), human
multiplayer draft, and a
full story campaign (the tutorial + gauntlet cover single-player content
adequately for launch).

## Open questions / decisions for the user

1. **Economy tuning** - daily-quest, achievement, and Limited gold inflow should
   stay modest relative to `ECONOMY` pack costs.
2. **Replay storage cap (post-1.0)** - is last-10 acceptable, or do you want an explicit
   "pin favorite" so a great game survives the FIFO? Affects the future replay
   blob size.
3. **Migration cadence** - post-1.0 replay persistence likely means v15+.
4. **Tutorial hard-gating** - force the tutorial on first run, or keep the
   shipped skippable prompt?
5. **`dbVersion` stamp for replays** - confirm whether replays should
   hard-refuse cross-version playback rather than best-effort playback.
