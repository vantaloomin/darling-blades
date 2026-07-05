<!-- source-of-truth: docs/roadmap.md, docs/architecture.md, docs/mobile-lan-plan.md, src/engine/rng.ts, src/engine/Game.ts, src/engine/actions.ts, src/engine/view.ts, src/engine/events.ts, src/meta/SaveManager.ts, src/meta/Economy.ts, src/meta/PackOpener.ts, src/meta/DeckStorage.ts, src/meta/deckFace.ts, src/data/catalog.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/config/rules.ts, src/scenes/, src/ai/personality.ts · last-verified: 2026-07-05 · design/plan doc — re-verify when the referenced code changes -->

# Road to 1.0 — five new features

> **Update (2026-07-05):** the baseline moved on. `SaveData` is now **v6**
> (the v5 → v6 hero-image bump shipped), so this doc's v5 → v10 migration walk
> is off by one — read every "vN → vN+1" below as one higher. Of the four
> "shipping this session" candidates, **three shipped** (hero-image selection,
> manual shard/sell, gauntlet run-seed); only sequenced combat animations was
> already partly done earlier. Day-to-day quality-of-life gaps (search, keyword
> glossary, undo, bulk packs, …) are tracked separately in
> [plan-qol.md](plan-qol.md).

Darling Blades is playable end-to-end, art-complete, and stable (370 tests
green, `SaveData` v6 — see the update note above). What separates the current build from a polished 1.0 is
not more systems but the connective tissue that turns a working prototype into a
game people keep coming back to: a **reason to log in tomorrow**, a **first
session that teaches**, a **shareable moment**, a **content mode with high
replay-to-effort ratio**, and the **goal scaffolding** that gives the 210-card
pool meaning. This doc proposes five features that target exactly those gaps,
each grounded in APIs the code already exposes. Four adjacent features are being
planned by sibling agents (Commander mode + themed decks, a MOD/UGC pack system,
MTG-keyword rethemes) and four more are shipping this session (hero-image
selection, manual shard/sell, seeded Tower/Gauntlet runs, sequenced combat
animations); those are treated here as assumed-upcoming and are not re-proposed.

## Feature 1 — Interactive tutorial + onboarding flow

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

Add `save.tutorialDone: boolean` (default `false`). This is a **v5 → v6**
migration in `src/meta/SaveManager.ts`: the new step spreads `tutorialDone:
false` into any older blob, and existing players (nonzero win/loss) get it set
`true` immediately on load so veterans skip it. A migration test asserts a v5
save carries a nonzero-record player straight past the tutorial.

### Phased build plan

1. **Milestone A (runnable):** `TutorialScene` boots the engine with a fixed
   seed + `ScriptAI`, renders via existing `DuelScene` components, no coach marks
   yet — a scripted duel you can play. Testable headless: `ScriptAI` line + fixed
   seed reaches the authored end-state.
2. **Milestone B:** `CoachMark` overlay + the 6–8 authored beats (mana, cast,
   attack, block, response window, end turn).
3. **Milestone C:** first-run detection, MainMenu "Replay tutorial", reward grant
   + route to shop, v6 migration.

### Test strategy

Headless: `ScriptAI` determinism (seed + line → fixed end-state), the v6
migration (fresh sets `false`, veteran coerces `true`), and a first-run predicate
unit test. Coach-mark visuals fall under the existing by-eye polish caveat.

### Effort / risk

**Medium effort, low risk.** No engine changes, no economy changes. The main
cost is authoring good copy and a clean scripted line; risk is scope creep on the
number of taught beats — cap at eight.

## Feature 2 — Daily quests + login streak (retention loop)

### Problem

There is exactly one recurring incentive today: the first-win-of-day gold bonus
(`stats.lastWinDay` in `SaveData`, applied in `src/meta/Economy.ts`). That is a
seed, not a loop. A 1.0 needs a **daily reason to open the app** and a
**medium-term goal ladder** so the gold economy (packs, and this session's
shard/sell sink) has steady inflow. This is the classic F2P retention spine,
adapted for a single-player offline game.

### Design

Three rotating **daily quests** ("win 2 duels", "cast 10 creatures", "deal 15
combat damage", "win with a green deck") that grant gold on completion, plus a
**login streak** that escalates a daily bonus and awards a free pack at day 7.
Quests are drawn deterministically from `todayString()` so the same calendar day
always yields the same three quests (no reroll exploit, and testable). Progress
is tracked by subscribing to the engine's existing event stream.

### Architecture fit

- **New meta module** `src/meta/Quests.ts` (Phaser-free, unit-testable): a pure
  `QuestDef` catalog, `rollDailies(dateStr, seed)` using the same
  `createRngState`/`rngInt` primitives from `src/engine/rng.ts` seeded off a hash
  of `todayString()`, and `applyProgress(quest, events)` that folds a
  `GameEvent[]` batch into counters. Quest predicates read only public event
  fields (`combatDamage.hits`, `spellCast.cardId`, `gameEnded.winner`), so no new
  engine surface is needed.
- **Wiring**: `DuelScene` already receives event batches in `processEvents`; it
  forwards them to a `Services`-held quest tracker. Gauntlet/practice/tutorial all
  flow through the same batch, so quest progress is uniform.
- **UI surface**: a **Daily panel** on the MainMenu (a new `src/ui/DailyPanel.ts`
  card list with progress bars + a claim button) and a streak pip row. No new
  top-level scene needed.

### SaveData impact

**v6 → v7** (or fold into the tutorial bump if sequenced together). New:
`save.daily = { day: string, quests: { id, progress, target, claimed }[],
streak: { count: number, lastDay: string } }`. Migration seeds an empty
`daily` with today's rolled quests; a broken/absent block re-rolls on load. Add a
migration test and a **streak-break test** (a gap day resets `count` to 1).

### Determinism considerations

Quest rolling must be seeded, not `Math.random`, so tests are stable and there is
no client-side reroll cheat. Progress counters are pure folds over event batches
— no engine mutation, so win-rate baselines are untouched.

### Phased build plan

1. **Milestone A:** `Quests.ts` pure core + tests (roll, fold, complete).
2. **Milestone B:** save block + v7 migration + Economy grant hook.
3. **Milestone C:** MainMenu Daily panel + streak UI + claim flow.

### Test strategy

Headless-heavy: deterministic daily roll, event-fold progress for each predicate
type, streak increment/reset, claim idempotency (can't double-claim), migration.
This feature is almost entirely gate-able by vitest, which the repo rewards.

### Effort / risk

**Medium effort, low risk.** Purely additive economy. Risk: economy inflation —
gate quest gold against `ECONOMY` constants in `src/config/rules.ts` and keep
daily inflow modest relative to pack cost.

## Feature 3 — Sealed / Draft limited mode

### Problem

The only deckbuilding today is 60-card Constructed from the owned collection
(`src/meta/DeckStorage.ts` `validateDeck`). Limited (sealed/draft) is the
highest replay-to-effort content type in the genre: it generates a fresh puzzle
every run from the **existing 210-card pool and existing pack roller**, with no
new content authoring. It also gives lapsed players a reason to duel that doesn't
depend on their collection, and it exercises the whole card pool.

### Design

**Sealed** (v1 of the mode): open six seeded boosters, build a **40-card minimum**
deck from that pool plus unlimited basics, then run a short 3-duel gauntlet
against difficulty-scaled AI drafting from comparable pools. **Draft** (v2 stretch)
adds pick-one-pass over 3 packs. Rewards scale with wins. Sealed is the smaller
first slice because it skips the pick-loop UI.

### Architecture fit

- **Reuse `PackOpener`** (`src/meta/PackOpener.ts`) with a run seed to roll the
  sealed pool — but into a **temporary run pool, not the collection** (do not fold
  into `collection`/`collectionVariants`). This means a new `rollSealedPool(seed,
  count)` sibling that returns cards without the collection side-effect.
- **New deck validator** `validateLimitedDeck` in `DeckStorage.ts`: 40-card
  minimum, cards restricted to the run pool + basics, ≤4 non-basic copies
  (naturally satisfied by pool scarcity), no tokens — mirrors `validateDeck`'s
  shape so the DeckBuilder can be reused with a mode flag.
- **AI opponents**: reuse `src/ai/` brains; give the AI a **seeded auto-built**
  limited deck from a sibling pool via a simple curve heuristic (a new
  `buildLimitedDeck(pool, colors)` in `src/data/` — pure, testable), so no hand-
  authored decklists are needed.
- **New scenes/flow**: `src/scenes/LimitedScene.ts` for pool-open + build (reusing
  DeckBuilder grid components and `CardThumbCache`), then routes into `DuelScene`
  with the temporary deck passed in `scene.start` data — the Duel init contract
  (`{ difficulty?, opponentId?, gauntletRung? }`) extends with an optional
  `adhocDeck` field.

### SaveData impact

An active sealed run is transient run state, but persisting it across app close is
nice: **v7 → v8** adds `save.limited = { run: { seed, pool, deck, wins, losses }
| null, bestWins: number }`. Migration defaults `null`. A completed run's rewards
fold into `gold`/`collection` through the normal Economy path.

### Determinism considerations

Because the pool is rolled from a stored `seed` via the deterministic roller, a
run **survives reload byte-identically** — reopen the app mid-build and the same
pool is regenerated. AI limited decks are seeded off the run seed too, so a given
run is fully reproducible (and testable).

### Phased build plan

1. **Milestone A:** `rollSealedPool` + `validateLimitedDeck` + `buildLimitedDeck`
   pure cores with tests. No UI.
2. **Milestone B:** `LimitedScene` pool-open + build, `adhocDeck` Duel plumbing,
   playable sealed run against auto-built AI.
3. **Milestone C:** run persistence (v8), reward curve, MainMenu entry.
4. **Milestone D (stretch):** pick-one-pass draft UI.

### Test strategy

Deterministic pool roll (seed → fixed pool), limited-deck validation edges
(39-card reject, off-pool reject, basics allowed), auto-build legality +
termination (mirrors `starterDecks.test.ts`), and an AI-can-complete smoke on a
seeded pool. A **win-rate sanity check** on auto-built decks keeps the mode from
being unwinnable or trivial — reuse the balance-matrix harness.

### Effort / risk

**Large effort, medium risk.** The biggest of the five, but almost all leverage
comes from existing systems (roller, validator, DeckBuilder, AI). Risk: auto-
built AI limited decks being weak; mitigate with the balance harness and a curve
heuristic tuned like the gauntlet baselines in `src/data/opponents.ts`.

## Feature 4 — Deterministic replays + deck share codes

### Problem

The engine is **seeded and fully deterministic** — `(decklists, seed, action
sequence) → identical GameState + event stream` (architecture.md, the iron rule;
`src/engine/rng.ts` lives in state and clones with it). This is a gift the game
currently doesn't cash in. There is no way to **re-watch a great game**, **share a
deck**, or **report a bug reproducibly**. All three are near-free given the
determinism guarantee, and all three matter for a shareable, community-friendly
1.0.

### Design

Two related capabilities:

1. **Replays** — record `{ seed, deckA, deckB, actions[] }` for a completed duel,
   then play it back move-by-move in a viewer. Because replay = re-simulation, the
   stored artifact is tiny (a seed + an action list), not a video or a state dump.
2. **Deck share codes** — encode a decklist as a compact copy-paste string
   (base64 over a card-id + count list) so players can trade decks out-of-band.
   Import validates through the existing `validateDeck`.

### Architecture fit

- **Replay recorder** `src/meta/Replay.ts` (Phaser-free): a `ReplayLog` type
  `{ seed, decks: [string[], string[]], actions: {player, action}[] }` and a
  recorder that `DuelScene` appends to on every `submit`. Playback constructs a
  fresh `Game` from the same seed + decks (the constructor already takes
  `{ decks, seed, db }`) and replays the action list, emitting the same event
  batches into a read-only `DuelScene` variant (input disabled, auto-advance).
- **Determinism is the whole trick**: no state snapshots needed — cite
  `src/engine/rng.ts` (RNG in state) and `Game.clone()`/`restore`. If the engine
  is ever changed in a way that breaks replay of an old log, that's caught by a
  golden-replay test (see below), which doubles as a determinism regression guard.
- **Deck codes** `src/meta/DeckCode.ts` (pure): `encodeDeck(cards[]) → string`
  and `decodeDeck(string) → cards[] | error`. Import routes through
  `DeckStorage.validateDeck`. UI surface: a copy/paste pair of buttons in the
  DeckBuilder scene.
- **UI surfaces**: a "Save replay" prompt on the game-over overlay in
  `DuelScene`, a **Replays list** on the MainMenu (or a tab in Collection) that
  launches the read-only viewer; DeckBuilder gets Export/Import code buttons.

### SaveData impact

**v8 → v9**: `save.replays: ReplayLog[]` (cap to the last ~10, FIFO, since each is
tiny) and nothing for deck codes (they're transient strings). Migration defaults
`[]`. A guard caps stored replays so the blob can't grow unbounded.

### Determinism considerations

This feature is *only possible* because of the iron determinism rule and is its
strongest advertisement. It also hardens it: the golden-replay test pins engine
behavior. One caveat — a replay recorded on one `CARD_DB` version may diverge if a
card's rules text changes; store a small `dbVersion` stamp and refuse to play back
mismatched logs with a friendly message rather than desyncing.

### Phased build plan

1. **Milestone A:** `DeckCode.ts` encode/decode + DeckBuilder buttons (smallest,
   independently shippable, immediately useful).
2. **Milestone B:** `Replay.ts` recorder wired into `DuelScene.submit`; save the
   last game as a log; golden-replay test.
3. **Milestone C:** read-only replay viewer scene + MainMenu Replays list + v9
   persistence + `dbVersion` guard.

### Test strategy

Headless: deck-code round-trip (`decode(encode(x)) === x`), malformed-code
rejection, and the **golden replay** — a recorded log replays to a byte-identical
final `GameState` (this is the marquee determinism test). Migration test for v9.

### Effort / risk

**Deck codes: small. Replays: medium.** Low risk because it rides the existing
determinism guarantee. Risk: engine/db-version drift breaking old logs — handled
by the `dbVersion` stamp and a graceful refusal.

## Feature 5 — Achievements + collection goals

### Problem

The 210-card pool, five rarity tiers, and multi-axis variant system are a
completionist's dream with **no completion scaffolding**. `SaveData.stats`
already tracks wins/losses/packsOpened but nothing surfaces it, and there is no
long-horizon goal beyond "clear the gauntlet". For a 1.0, achievements convert
the existing systems (collection %, variant hunting, gauntlet completions, this
session's shard/sell) into durable goals — cheap to build, high perceived value.

### Design

A tiered **achievement set** across four buckets: collection ("own 50% of the
pool", "pull a black frame", "pull a void holo", "complete a color"), mastery
("beat the gauntlet on hard", "win with all five colors"), economy ("open 25
packs", "shard 100 duplicates"), and streaks ("7-day login"). Each awards gold
and/or a cosmetic (see below). A **collection-progress screen** shows pool
completion by color/rarity and variant coverage, computed from `collection` +
`collectionVariants` and the `CARD_DB` totals.

### Architecture fit

- **New meta module** `src/meta/Achievements.ts` (pure): an `AchievementDef`
  catalog and `evaluate(save, db)` returning the unlocked set. Evaluation reads
  only `SaveData` + `CARD_DB` aggregates (owned counts, variant keys via
  `variantKey`, `stats`, `gauntlet.completions`) — no engine coupling, so it's
  trivially testable. Progress can be recomputed on demand rather than tracked
  incrementally, avoiding drift.
- **Cosmetic rewards** tie into this session's assumed hero-image selection and
  the existing variant/frame cosmetics — an achievement can unlock a hero image
  or a card-back, a natural sink that doesn't inflate the gold economy.
- **UI surfaces**: an **Achievements scene** `src/scenes/AchievementsScene.ts`
  (grid of badges, locked/unlocked) reachable from MainMenu, and a
  **completion-progress** panel folded into the existing `CollectionScene` binder
  (it already computes owned/total via `collectionFilter.ts` — extend that pure
  module with per-color/per-rarity completion tallies).
- **Reuses `src/meta/collectionFilter.ts`** for the completion math and the
  variant specialness ranking in `src/meta/variants.ts` for "best variant"
  achievements.

### SaveData impact

**v9 → v10**: `save.achievements: { unlocked: string[], claimed: string[] }`. On
load, `evaluate` runs and newly-satisfied achievements move to `unlocked` (claim
is a separate user action for the reward, so a fresh install with an imported
save doesn't silently swallow rewards). Migration defaults both to `[]`. Because
evaluation is recomputed from durable state, even a hand-edited or migrated save
re-derives correctly.

### Determinism considerations

None on the engine — this is pure meta/UI, evaluated from the save blob. No
win-rate impact.

### Phased build plan

1. **Milestone A:** `Achievements.ts` catalog + `evaluate` + completion-tally
   extension to `collectionFilter.ts`, all tested.
2. **Milestone B:** `AchievementsScene` + collection completion panel.
3. **Milestone C:** claim flow + cosmetic-reward hookup + v10 migration.

### Test strategy

Headless: `evaluate` against crafted saves (each achievement's boundary — e.g.
49% vs 50% pool, first black frame, all-five-colors), claim idempotency,
completion-tally correctness against a known `CARD_DB` subset, migration. Strongly
vitest-gate-able.

### Effort / risk

**Medium effort, low risk.** Additive, pure, testable. Risk: reward balance
(cosmetic vs gold) — lean cosmetic to avoid economy inflation.

## Suggested sequencing

Order by dependency and leverage, not size:

1. **Tutorial (Feature 1)** first — it protects every other feature by keeping
   new players from bouncing before they see them. It's self-contained and low
   risk.
2. **Achievements + collection goals (Feature 5)** second — pure/testable, gives
   the existing pool and this session's shard/sell sink immediate meaning, and
   provides the cosmetic-unlock plumbing that Daily and Sealed rewards can reuse.
3. **Daily quests + streak (Feature 3's sibling, Feature 2)** third — the
   retention loop pays off most once there are goals (achievements) and content
   (tutorial done) to funnel players toward.
4. **Replays + deck codes (Feature 4)** fourth — ship the deck-code half early
   (it's tiny and independently useful); the replay viewer can trail. Best done
   before Sealed so Sealed runs are shareable/replayable.
5. **Sealed / Draft (Feature 3)** last — the largest, benefits from the reward
   and replay plumbing already existing, and is the strongest "reason to keep
   playing" content capstone.

The `SaveData` version walk implied by this order is **v5 → v10** (tutorial v6,
daily v7, sealed v8, replays v9, achievements v10). Sequencing matters because
each is a stepwise migration; if two ship together, fold their fields into one
bump rather than skipping versions. Every migration ships with a test, per the
iron invariant.

## Definition of 1.0

Darling Blades is release-ready when:

- **A cold-start player is taught** — first run routes through the tutorial, and
  the first ten minutes never leave them confused.
- **There is a daily reason to return** — daily quests + streak give a fresh,
  seeded goal every calendar day.
- **The card pool has a purpose beyond the gauntlet** — achievements/collection
  goals and a Limited mode give hundreds of hours of self-directed play.
- **Great games and great decks are shareable** — replays and deck codes turn
  the determinism guarantee into social currency.
- **The polish backlog is closed** — the by-ear/by-eye music/FX pass and the
  real-device mobile pass (both already tracked in roadmap.md's Planned section)
  are done.
- **The invariants still hold** — engine purity, redacted views, seeded
  determinism, and green migrations/tests through the whole v5→v10 walk.

Deliberately **out of scope for 1.0** (post-launch): Tier-2 LAN PvP (already
deferred in mobile-lan-plan.md), draft (the pick-loop; sealed ships first), and a
full story campaign (the tutorial + gauntlet + sealed cover single-player content
adequately for launch).

## Open questions / decisions for the user

1. **Economy tuning** — daily-quest and achievement gold inflow must be set
   against `ECONOMY` in `src/config/rules.ts`. Do you want cosmetic-only rewards
   for most achievements (economy-safe) or meaningful gold grants (faster
   progression, inflation risk)?
2. **Sealed rewards folding into the collection** — should sealed pulls be
   *kept* (fold the run pool into `collection` as a reward, powerful economy
   boost) or *ephemeral* (pool discarded at run end, pure gameplay)? This changes
   the SaveData shape and the economy math.
3. **Replay storage cap** — is last-10 acceptable, or do you want an explicit
   "pin favorite" so a great game survives the FIFO? Affects the v9 blob size.
4. **Migration cadence** — five sequential bumps (v6–v10) is clean but chatty;
   if features ship in one session, do you want them folded into fewer bumps?
   (Noted as a dependency, not edited here — `src/meta/SaveManager.ts` owns the
   chain.)
5. **Tutorial hard-gating** — force the tutorial on first run, or make it a
   skippable prompt? Hard-gating helps retention data but annoys returning-genre
   veterans; the first-run predicate supports either.
6. **`dbVersion` stamp for replays** — this requires a version constant somewhere
   in `src/data/` that bumps when card rules text changes. That's a new
   discipline; confirm you want replays to hard-refuse cross-version playback
   rather than best-effort.
