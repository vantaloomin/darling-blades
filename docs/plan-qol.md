<!-- source-of-truth: docs/roadmap.md, docs/plan-road-to-1.0.md, src/scenes/DuelScene.ts, src/scenes/DeckBuilderScene.ts, src/scenes/CollectionScene.ts, src/scenes/ShopScene.ts, src/scenes/PackOpeningScene.ts, src/scenes/MainMenuScene.ts, src/scenes/SettingsScene.ts, src/scenes/GauntletScene.ts, src/meta/SaveManager.ts, src/meta/DeckStorage.ts, src/meta/collectionFilter.ts, src/meta/Collection.ts, src/meta/Economy.ts, src/meta/PackOpener.ts, src/engine/actions.ts, src/engine/Game.ts, src/engine/types.ts, src/engine/statics.ts, src/engine/combat/damage.ts, src/engine/effects/targeting.ts, src/config/rules.ts, src/ui/rulesText.ts, src/ui/CardView.ts, src/ui/CardZoomPreview.ts, src/ui/KeywordGlossaryPanel.ts, src/ui/binder/FilterBar.ts, src/ui/SearchInput.ts, src/meta/DeckStorage.ts, src/meta/profileStats.ts, src/ui/deckStats.ts, src/engine/combat/damage.ts · last-verified: 2026-07-09 · design/plan doc (SHIPPED — see status banner) · re-verify when the referenced code changes -->

# Quality-of-life plan — closing the daily-friction gap

> **STATUS — SHIPPED ✅ (2026-07-06).** All 15 features below are live on `main`
> (auto-deployed to GitHub Pages), landed across three waves of PRs off the
> Ragnarök-integrated `main`. This doc is retained as the design record; what
> shipped, by feature:
>
> - **Wave 1 (F1–F4, F6, F7):** F1 concede-confirm (adds
>   `settings.confirmDestructive`, **v6 → v7**) · F2 `reasonUncastable` feedback ·
>   F3 cast-targeting arrow · F4 always-visible gold · F6 pass/confirm/cancel
>   hotkeys · F7 desktop deck-list paging (the latent clip bug). _(F5 pack-odds
>   display shipped separately, with the Ragnarök expansion.)_
> - **Wave 2 (F9–F14, PR #5):** F14 Profile scene · F13 deck-stats + add-a-playset ·
>   F11 undo-before-commit · F12 combat/lethal forecast (pure `previewCombat`) ·
>   F9 keyword reminder text (adds `settings.keywordReminders`, **v7 → v8**) ·
>   F10 bulk buy/open N packs.
> - **Final wave (F8, F15, PR #6):** F8 card-text search (name/type/subtype/keyword)
>   via the codebase's **first Phaser `this.add.dom` `<input>` overlay**
>   (reusable `src/ui/SearchInput.ts`) · F15 multiple saved decks (`DeckStorage`
>   `deleteDeck` / `copyDeck` / `renameDeck` / `generateDeckId`, activeDeckId
>   invariant preserved, + a "☰ Decks" picker modal).
>
> The plan's projected single **v6 → v7** bump became **two** in execution (v7 for
> F1, v8 for F9); later roadmap work carried the live schema to **v15** (v9 → v10
> tutorial, v10 → v11 achievements, v11 → v12 themed achievement counters,
> v12 → v13 daily quests/streaks, v13 → v14 Limited, v14 → v15 per-deck hero
> images).
>
> **Post-ship follow-up status (2026-07-08):** F13's remove-all gap is closed:
> Shift+Click on a pool card fills to the constructed cap / owned count, and
> Shift+Click on a deck row removes all copies. F9's separate inspect-overlay
> glossary is closed via `KeywordGlossaryPanel` in Duel and Collection inspect
> overlays; card faces now keep compact keyword names while inspect surfaces the
> reminder text. The Gauntlet post-run recap is also shipped as a success/failure
> screen with Main Menu and Start Over actions. The remaining QOL follow-up is
> exposing in-Settings toggles for `confirmDestructive` + `keywordReminders`;
> the settings values exist, but the Settings UI still needs a wider relayout
> before those controls are added.

Darling Blades is playable end-to-end, art-complete, and stable. It already
ships a lot of quality-of-life polish — phase auto-skip + End-Turn
fast-forward, hand auto-organize, summoning-sick badges, castable-now gold dots,
hover-dwell card zoom + right-click inspect, a History move-log slide-out, a
settings menu, vector mana icons, a filter/sort collection binder, and a full
touch-gesture layer. What it is **missing** is a different category from the
content backlog the other plan docs cover ([daily + sealed + replays, with
tutorial and achievements now shipped](plan-road-to-1.0.md), [commander](plan-commander-mode.md),
[keyword rethemes](plan-keyword-rethemes.md), [mod/UGC](plan-mod-ugc.md)):
the small, high-frequency **conveniences a player of a modern digital TCG**
(MTG Arena, Hearthstone, Legends of Runeterra, Marvel Snap, YuGiOh Master Duel)
reaches for every single session — finding a card, understanding a card, and
moving through packs / decks / turns without friction.

This doc originally proposed **15 QOL features**, each grounded in a code seam
that already existed, organized into three shippable waves by effort and
leverage. The feature list below is now a shipped design record rather than the
live backlog. Remaining QOL work is called out in the status banner and
Deferred/Open sections.

## Baseline corrections (verified 2026-07-05; historical; superseded by live v15)

Two sibling docs and the session memory carried stale facts that affected the
QOL SaveData math below; these notes are retained as the QOL execution history.
The current live schema is v15 (see roadmap.md and SaveManager.ts).

- **`SaveData` is at v6, not v5.** `src/meta/SaveManager.ts:17,64` declares
  `version: 6`; the migrate chain ends at the `version === 6` step. The
  **v5 → v6** step already shipped and added `heroCardId`
  (`SaveManager.ts:34,72,211`). road-to-1.0's "SaveData v5" header and its
  Feature-1 "v5 → v6 `tutorialDone`" migration are therefore off by one — any
  new field in *this* plan is a **v6 → v7** bump.
- **Already shipped (do not treat as gaps):** hero-image selection
  (`heroCardId` + the set-as-hero action at `CollectionScene.ts:508`), manual
  per-card shard/sell (two-tap confirm at `CollectionScene.ts:525-541`), and the
  gauntlet run-seed readout (`GauntletScene.ts`). road-to-1.0 lists these as
  "shipping this session" candidates; they are done. Only the **bulk shard-all**
  variant remains open (deferred below).
- **At planning time, no DOM text input existed anywhere in `src/`, and
  `DeckCode.ts` did not exist yet.** That shared cost is now paid: the reusable
  Phaser `<input>` overlay ships as `SearchInput`, and deck export/import ships
  through `DeckCode.ts`.

## The one-migration story

The original target was one QOL schema bump, but the actual execution split the
settings additions across two migrations: **v6 → v7** for
`settings.confirmDestructive` and **v7 → v8** for
`settings.keywordReminders`. Later roadmap work moved the live schema to **v15**.
Multiple saved decks still needed no migration because the `decks[]` +
`activeDeckId` model already existed; later per-deck hero images added a
separate v14 → v15 field.

---

## Wave 1 — Quick wins

Small, high-frequency, low-risk. Six conveniences plus one latent bug, shippable
as a single sprint behind one v6 → v7 migration (for the confirm-destructive
flag). None touch the engine, AI, decks, or balance.

### 1. Concede confirmation + confirm-destructive toggle

- **Problem.** The Concede button fires on a single deliberate tap
  (`DuelScene.ts:576`) with no guard; in a gauntlet run a loss ends the *whole
  run*. On touch, Concede sits near a corner. An accidental concede is a
  maximal-cost misclick with no take-back.
- **Design & code fit.** Wrap the concede handler in the two-tap "arm → confirm"
  pattern the codebase already uses in two places —
  `GauntletScene.onAbandon` (`GauntletScene.ts:370-377`, `abandonArmed` field,
  relabels to "Click again to confirm") and the Collection shard button
  (`CollectionScene.ts:525-541`). Route all three through one new
  `settings.confirmDestructive` flag so destructive actions share one policy.
- **SaveData.** New `settings.confirmDestructive: boolean` → **v6 → v7** with a
  `migrate()` step (default `true`) + a migration test. This is the only schema
  change in Wave 1.
- **Effort / risk.** Small. The two existing arm implementations are
  inconsistent (scene-field vs closure-local); unifying them on one flag is
  marginally more than copy-paste.
- **Tests.** Migration (fresh + veteran), and the pure guard state machine if
  factored out. The visual relabel falls under the by-eye caveat.

### 2. "Why can't I play this?" — unplayable-reason feedback

- **Problem.** Clicking a dimmed hand card is a **silent no-op**
  (`DuelScene.onHandClick` returns at `:1691`/`:1702`); `syncHand` (`:1441`)
  only computes a binary playable set and fades the rest to alpha 0.75
  (`:1504`). The player can't tell mana vs timing vs no-target — a classic
  new-player trap and low-grade confusion around instant speed.
- **Design & code fit.** The engine already computes the exact reasons but keeps
  them private: `castableNow` (`actions.ts:109`) and `castBlockers`
  (`actions.ts:126`) are used only to *exclude* actions in `legalActions`
  (`:181-182`). There is a working template in `hasCastableInstant`
  (`actions.ts:366`), which chains `castBlockers` + `enumerateTargets`
  (`targeting.ts:71`) and returns a bool — mirror it as an exported
  `reasonUncastable(state, db, player, handIndex): string | null`. Surface it on
  the existing transient skip-toast (`showSkipNotice`, `DuelScene.ts:834`).
- **Invariant.** View-safe: reads only public/redacted state, lives in
  `src/engine/actions.ts`, no Phaser. No determinism impact.
- **Effort / risk.** Small. Caveat: `castBlockers` returns dev-ish strings
  ("cannot pay cost", "…cap reached") — add a small player-facing copy map, and
  reconstruct the "ritual-speed only" vs "already played a land" distinction
  (the land case is handled outside `castableNow`, in `legalActions:177-179`).
- **Tests.** Pure `reasonUncastable` against crafted states (no mana / no target
  / wrong phase / land-already-played) — fully vitest-gate-able.

### 3. Targeting arrow from spell → hovered target

- **Problem.** While a targeted spell is pending, targeting is conveyed only by a
  green tile highlight + a "Pick a target" text hint. Burn-to-face vs
  burn-a-creature is ambiguous — the arrow idiom (Hearthstone / Snap / LoR /
  Arena) makes intent unmistakable.
- **Design & code fit.** `DuelScene` already owns `this.arrows` (a Graphics at
  depth 50) and `drawArrows()` (`:1618`), which draws **block** arrows with
  `lineStyle`/`lineBetween` between two board views; it holds `pendingCasts`
  (`:173`) and resolves the pick in `tryTarget` (`:746`); legal targets are
  already tagged by `highlightFor`. Extend `drawArrows` to render a pending-cast
  arrow to the pointer, snapping to a hovered legal target's view.
- **Effort / risk.** Small, with one wrinkle: block arrows connect two *board*
  views, but a cast originates from a *hand* card — and during targeting the
  hand fan is deliberately hidden. So synthesize a fixed source anchor (near the
  rail/hint or bottom-center) rather than reuse `this.views.get`, and add a
  `pointermove` listener active only while `pendingCasts` is set.
- **Tests.** Visual — by-eye / preview-probe.

### 4. Gold always visible in Collection & Deckbuilder

- **Problem.** The gold badge shows on MainMenu / Gauntlet / Shop / PackOpening
  but **not** on Collection, Deckbuilder, or Settings — exactly the screens
  where you shard *for* gold and weigh purchases while building. Sharding with no
  on-screen balance makes the payout feel abstract.
- **Design & code fit.** Reuse the `goldText` + `refreshGold` pattern from
  `ShopScene.ts:170-178,226-235` (it even flashes on change) in each scene's
  `create()`. In Collection, call `refreshGold()` right after the existing shard
  flush (`CollectionScene.ts:541-543`, which already plays the `coin` SFX) so the
  badge updates live.
- **Effort / risk.** Small (~8 lines/scene). `Services.save.data.gold` is
  already accessible everywhere. No schema.
- **Tests.** Visual.

### 5. Pack odds display + pity/dupe-protection surfacing

- **Problem.** No drop-rate disclosure anywhere (a baseline expectation, and a
  legal norm in several markets) — the only hint is a baked pack-art string of
  axis *counts* (`ShopScene.ts:131`), not *rates*. Worse, the SR/SSR/UR
  dupe-protection that already runs (`PackOpener.ts:57-59`, skips completed
  playsets) is invisible, so players get none of its trust/retention value.
- **Design & code fit.** `DROPS` (`rules.ts:54-78`) is a clean `[value, weight][]`
  per axis (tier / frame / holo), each summing to 100 — render it read-only near
  the price in `ShopScene.create` (space is free after `:224`). Add a one-line
  pity note reusing `ownedCount`/`PLAYSET` from `Collection.ts`, phrased to match
  that protection applies to sr/ssr/ur only.
- **Effort / risk.** Small. Read-only render of an existing config const; no new
  state; respects the config-is-spec pattern.
- **Tests.** Visual, plus an optional assertion that each `DROPS` axis sums to
  100 (guards the displayed odds against drift).

### 6. Keyboard hotkeys — pass / confirm / cancel

- **Problem.** This is a desktop-first Tauri app, yet the only key bound in a
  duel is Z-to-zoom (`CardZoomPreview.ts:89`). Clicking a corner button every
  phase is dated and slow; desktop TCG players expect Space = pass/confirm and
  Esc = cancel. Also an RSI/accessibility aid.
- **Design & code fit.** `onButton()` (`DuelScene.ts:1646`) already dispatches
  the correct action per `awaiting.kind` (pass / to-combat / confirm-attackers /
  confirm-blocks) — bind Space/Enter straight to it (it inherits the
  auto-skip input lock and `isHumanTurnDecision` guards for free). Bind Esc to
  the existing cancel path (`pendingCasts = null; sync()`, mirroring the
  right-click cancel at `:565-568`) and to close overlay/inspect. Register in
  `create()`/`buildHud` and add a `SHUTDOWN` cleanup, exactly as
  `CardZoomPreview.ts:89-91` already does.
- **Effort / risk.** Small; fixed defaults only. (Full rebinding would be larger
  — deferred.)
- **Tests.** Interaction — preview-probe by emitting keydown events.

### 7. (Bug) Scrollable / unclipped desktop deck list

- **Problem.** Not strictly QOL — a **latent correctness bug**. The desktop deck
  list hard-clips at `y > 560` (`DeckBuilderScene.ts:254`), so a long,
  singleton-heavy 60-card deck **silently drops rows** the player can neither see
  nor remove. (Touch already pages the list; desktop does not.)
- **Design & code fit.** Add scroll/paging to the desktop `renderDeck` list
  region, mirroring the touch paging already present. Small.
- **Effort / risk.** Small; worth doing regardless of the QOL waves. Naturally
  rides along with Features 13/15 (same scene, same `renderDeck` lifecycle).
- **Tests.** Render a 60-card list and assert all rows are reachable
  (state-level), plus a by-eye pass.

---

## Wave 2 — Flagship medium features

The items that move the needle most for both new and returning players. Each is
grounded in an existing seam; the recurring cost is new UI, not new engine.

### 8. Card text search box (deckbuilder + collection)

- **Problem.** There is **no free-text search anywhere in the game** — the single
  most-used affordance in every modern TCG. With ~210 cards, a full owned pool is
  15+ pages of 12, and the only path to a specific card is guessing
  color/type/rarity facets and paging. Hit on every deckbuilding and collection
  session, so it counts double.
- **Design & code fit.** Two seams take the filter cleanly: `pool()`
  (`DeckBuilderScene.ts:127-134`) and `applyFilters` + `defaultFilterState`
  (`collectionFilter.ts`, which both `CollectionScene` filter routes already
  flow through). Add a `search` clause to the pure filter layer (trivial,
  unit-testable) and build **one reusable Phaser `this.add.dom` `<input>`
  overlay** mounted in both scenes — the first DOM input in the codebase, and the
  real cost of the feature (focus/blur, mobile keyboard, positioning under the
  render-size setting; a DOM overlay sidesteps the "never `setInteractive` a
  scaled Container" trap but has its own quirks).
- **Invariant caveat.** `CardDef` has **no stored rules text** — oracle text is
  generated at display time by `rulesText()` in the Phaser UI layer, which the
  pure `src/meta` layer cannot import without breaking layer purity. So
  **name / keyword / type / subtype** search is clean in the pure layer;
  full **rules-text** search is a stretch goal needing a small headless
  text-generator refactor. Ship structured-field search first.
- **Effort / risk.** Medium — the pure clause is a few lines; the DOM overlay is
  the work and it amortizes across Features 15 and deck-code import.
- **Tests.** Pure filter clause (name/keyword/type substring, case-insensitive);
  the DOM overlay is by-eye.

### 9. Keyword reminder text + hover/tap glossary

- **Problem.** The single biggest **comprehension** gap. A new player facing the
  ten evergreen keywords has no in-app way to learn what deathblade / overrun /
  first blade / sentinel / untouchable do — board tiles deliberately omit rules
  text and `rulesText()` prints only the bare keyword line (`rulesText.ts:108`).
  Felt on essentially every creature and constantly in combat.
- **Design & code fit.** `rulesText.ts:3` already defines
  `KEYWORD_NAMES: Record<Keyword, string>` covering exactly the 10 keywords in
  the `Keyword` union (`types.ts:6-16`). Add a parallel `KEYWORD_REMINDER` map
  and (a) append italic reminder text after the keyword line on the card face —
  `CardView` already shrink-to-fits its rules box (`CardView.ts:240-242`), so
  longer text degrades gracefully — and (b) render a keyword **legend** in the
  inspect overlay (`DuelScene.showInspect:1796` / `CollectionScene.showInspect:373`).
- **Design caveat.** The glossary is harder than "make keywords tappable": the
  keyword text is *baked into the CardView graphics* via `rulesText()`, not
  separate hittable objects, so (b) means rendering a **new** legend/list beside
  the card, not re-wiring existing text. That is the bulk of the effort.
- **SaveData.** Gate the on-card reminder text behind
  `settings.keywordReminders: boolean` (default on) so veterans can turn it off →
  folds into the **v6 → v7** bump alongside Feature 1.
- **Distinct from** plan-keyword-rethemes.md, which only *renames* keywords
  (display-only) and does not explain them. This is the higher-impact half that
  plan omits; the two compose (rename the label, then define it).
- **Effort / risk.** Medium. No engine change.
- **Tests.** `KEYWORD_REMINDER` covers every `Keyword` union member (a coverage
  test like the existing keyword tests); the settings toggle migration.

### 10. Buy / open N packs at once

- **Problem.** The single biggest **economy** friction. A player sitting on
  thousands of gold must click through ~12 separate tear → reveal → "Open
  Another" cycles (`PackOpeningScene` takes one `PackResult` at `:74`; the only
  continuation is "Open Another" at `:499-507`). This actively discourages
  spending — starving the economy the game is built around. Bulk open is standard
  everywhere.
- **Design & code fit.** `openPack(save, db, rng)` (`PackOpener.ts:66`) is pure,
  repeatable, and already increments `stats.packsOpened`; `ShopScene.buyPack`
  (`:230-243`) is a single `spendGold` + `openPack`. Add a quantity control
  (x1 / x5 / x10 + buy-max-affordable over `ECONOMY.packPrice`, `rules.ts:17`) in
  the Shop and a new **batch summary reveal** path in `PackOpeningScene` that
  accepts a `PackResult[]`.
- **Effort / risk.** Medium (upper end). The engine side is trivial (call
  `openPack` N times, sum gold); the cost is that the current reveal is heavily
  choreographed for exactly one pack (per-card cascade, specials row,
  best-card slow-mo), so the batch summary is a genuinely new render mode, not a
  tweak. Pairs naturally with a **batch shard-all** (deferred list) afterward.
- **Tests.** Deterministic multi-pack roll (seed → fixed batch) + gold math;
  the reveal is by-eye.

### 11. Undo-before-commit (local decisions)

- **Problem.** Misclicks are the #1 in-duel friction, and land-per-turn + tapped
  mana make one stray tap genuinely punishing several times a game. Targeted
  casts have a Cancel, but a *committed* action (play a land, cast an untargeted
  spell, add an attacker/blocker) cannot be taken back.
- **Design & code fit.** **The engine already supports it fully:** `Game.clone()`
  (`Game.ts:119`) and static `Game.restore()` (`:123`) are structuredClone-based,
  and the RNG lives in state (`Game.ts:53,62,67`) so restore is deterministic —
  this is exactly what the AI determinizer (`src/ai/determinize.ts`) leans on.
  `DuelScene.act()` (`:709`) is the single funnel for local submits. Keep a
  one-deep pre-action `Game` snapshot, add an Undo button to the HUD rail, and on
  undo reassign `this.duel` + re-`sync()`.
- **Invariant / scope.** Local-only by design — invalidate the snapshot the
  moment priority passes to the AI, the stack flushes, or combat animates
  (`animatingCombat`/`maybeRunAI`), and clear the scene-side selection state
  (`selectedAttackers`, `blockAssignments`, `pendingBlocker`, `pendingCasts`).
  Zero engine change; this is the strongest advertisement for the determinism
  rule (and a different feature from the planned record/playback **replays**).
- **Effort / risk.** Medium — the invalidation-boundary bookkeeping and the
  full re-sync/re-render are the real cost, which is why this is medium, not
  small.
- **Tests.** Headless: snapshot → act → restore returns a byte-identical
  `GameState` (doubles as a determinism guard); invalidation predicate unit test.

### 12. Combat / lethal-damage forecast preview

- **Problem.** Combat is where games are won and misjudged trades hurt most, yet
  players must mentally simulate first blade / deathblade / overrun against
  *effective* (buffed) P/T. The confirm flow (`DuelScene.ts:1600-1668`) shows
  only a bare count. Every modern TCG previews combat math on hover.
- **Design & code fit.** `getEffectiveStats` (`statics.ts:17`) already returns
  effective P/T + keywords on a read (and is view-safe). `resolveCombatDamage`
  (`combat/damage.ts:24`, called from `Game.ts:360`) computes the real outcome
  but *mutates and emits*. Cleanest: factor a **pure** `previewCombat(state, db,
  attackers, blocks)` out of it — the `Hit[]` build (`damage.ts:62-156`) already
  runs before the mutation loop (`:167-192`), so a predictor can reuse it plus
  first-strike sub-stepping (`:30-45`) and `killCost` (`:204-215`) to derive
  deaths/life deltas without emitting. Cheaper stopgap: `clone()` the game, submit
  a trial declaration, read events, discard.
- **Effort / risk.** Medium. The trickiest part of the pure factor is
  first-strike death ordering (the normal step depends on SBA deaths from the
  first-strike step). Note: the AI (`combatPlans.ts`) currently uses its own
  *approximate* combat math and does **not** call `resolveCombatDamage`, so
  "reusable by the AI" is a real future benefit but a refactor, not a drop-in.
- **Tests.** Golden `previewCombat` outcomes vs `resolveCombatDamage` on crafted
  boards (deathblade, overrun, first blade, gang blocks) — high-value headless
  coverage.

### 13. Deck statistics + add-a-playset in the builder

- **Problem.** The mana curve is *the* primary tool for evaluating a constructed
  deck (second only to search); today the only feedback is "N/60" + two crude
  `<20`/`<12` warnings (`renderDeck`, `DeckBuilderScene.ts:196`). And building
  means ~40 single-copy clicks per deck.
- **Design & code fit.** All data is local: iterate `this.deck` with
  `manaValue(d.cost)` (`types.ts:117`) for the curve, `d.cost.pips` for the color
  pie, `d.types` for type counts; render a compact panel in the builder's dead
  vertical space (the desktop list clips at `y > 560`, leaving the lower-right
  column open). Add a one-click **add-a-playset** on pool cards (loop the
  `Math.min(RULES.maxCopies, owned)` cap `addCard` already computes at `:183`)
  and **remove-all** on deck rows (loop `removeCard`).
- **Effort / risk.** Medium — aggregation is trivial loops; drawing the
  histogram + counts inside the destroy-and-rebuild `rightPane` lifecycle is the
  UI work. No engine API.
- **Tests.** Pure aggregation (curve/pie/counts) over a known decklist; the
  batch add/remove against the copy cap.

### 14. Profile / stats screen

- **Problem.** `stats.{wins, losses, byDifficulty, packsOpened}` are **tracked
  but read by no UI** (only written in `Economy.ts`/`PackOpener.ts`; the only
  surfaced progression is the Gauntlet "Best · Clears" line at
  `GauntletScene.ts:125`). Progression that's invisible feels like it doesn't
  exist.
- **Design & code fit.** Add a `Profile` entry to `MENU_ITEMS`
  (`MainMenuScene.ts:15-24`; each entry drives `scene.start` via `bindTapButton`
  at `:130`) launching a new read-only `ProfileScene`, registered in
  `src/main.ts` alongside `GauntletScene`. It reads `Services.save.data.stats`
  and `.gauntlet` — `byDifficulty` is already keyed `easy/medium/hard`, so
  win-rate-by-difficulty renders directly.
- **Effort / risk.** Medium — a brand-new scene (following the
  `applyBackdrop`/menu/back-button conventions of `GauntletScene`/`SettingsScene`),
  but zero engine/save/schema change (pure read).
- **Distinct from** road-to-1.0 Feature 5 (Achievements), which adds *new* goal
  scaffolding; this just surfaces the career record that already exists, and is a
  natural host for the achievement grid later.
- **Tests.** Pure win-rate computation from a crafted `stats` blob; the scene is
  by-eye.

---

## Wave 3 — Structural

### 15. Multiple saved decks — picker + rename / copy / delete

- **Problem.** The player can edit exactly **one** deck; saving silently
  overwrites the active deck (`DeckBuilderScene.ts:347` hard-codes
  `id = activeDeckId ?? 'custom-1'` and reuses the existing name at `:348`), and
  a second deck can only appear via a starter grant (`MainMenuScene.ts:230`). No
  modern TCG imposes a one-deck limit — players keep an aggro, a control, and a
  jank pile.
- **Design & code fit.** The data model is already there:
  `SaveData.decks: {id,name,cards}[]` + `activeDeckId` (`SaveManager.ts:26-27`),
  and `saveDeck()` already upserts by id (`DeckStorage.ts:50-56`). Missing:
  a `deleteDeck()` export (confirmed only `validateDeck` + `saveDeck` are
  exported), a **deck picker** UI (rail or small scene), and a **rename** field
  (shares the DOM `<input>` from Feature 8).
- **SaveData.** **None** — the schema already models multiple decks. This is a
  UI + one storage helper, not a migration.
- **Effort / risk.** Medium-large (downgraded from "large" once the existing data
  model is credited). Mostly UI; the risk is the picker/rename interaction and
  making "which deck is active" unambiguous in the duel/gauntlet launch paths
  (`DuelScene.ts` reads `activeDeckId`).
- **Tests.** `deleteDeck` (remove by id, reassign `activeDeckId` if it was the
  deleted one), copy (new id, deep-cloned cards), rename — all pure over
  `DeckStorage`.

---

## Deferred (tracked, not scheduled)

Real value, but larger, lower-frequency, or a design decision rather than pure
friction-reduction:

- **Colorblind mode** — a genuine accessibility gap (combat highlights and card
  frames are hue-only), but large: the palette must thread through `PIP_COLORS`
  (`ManaSymbols`), `CardFrameFactory`, and `BoardCardView`
  `BORDER_COLORS`/`EDGE_COLORS`. Partial redundancy already exists (mana beads
  carry distinct glyphs). Deferred on effort, not value.
- **Separate music / SFX / ambient sliders** — today only a master volume + a
  music on/off toggle exist (a fixed `MUSIC_LEVEL` sub-gain). Medium, additive
  (`setMusicLevel` + `settings.musicVolume` + a schema bump).
- **Batch shard-all excess** — loop `shardExcess` over the collection with a
  total preview + one confirm. Small; value rises sharply once bulk-open
  (Feature 10) lands, so pair them.
- **Crafting / wildcards** — high player value but a genuine **economy-design
  change**, not a QOL add: no reverse of shard exists, so it needs a craft-cost
  table, a `spendGold` + `addCard` path, and balance tuning. Flag as a decision;
  the inspect overlay's unowned branch (`CollectionScene.ts:462`) is the natural
  surface.
- **Manual mana-source override** — the engine is fully ready
  (`Action.manaPlan` + `validateManaPlan` + `manaSources` all exist; the UI never
  sets `manaPlan`), but it only bites instant-heavy play with dual sources —
  lower frequency.
- **Priority-stop customization / full-control mode** — power-user value, but
  large and engine-adjacent (response windows gate solely on
  `hasCastableInstant` with no per-player stop prefs in `GameState`).
- **Card-back selection & UI text scaling** — both blocked by a missing central
  seam (no font-size factory; card-backs need art variants), larger than they
  look.
- **Precon/starter store** — shipped with the Ragnarök shop restructure:
  Boosters / Decks tabs, free starter claim, and a buyable theme deck now read
  the precon economy seam.
- **"New" markers and pack inspect details** — shipped in the pack-opening polish
  pass: pack cards use star markers for new cards / new variants, suppress the
  old text badges, and surface rarity/frame/holo details from the inspect modal.
- **Sticky filter persistence and continue-run shortcut** — still deferred.
  They are small on the render side but need an explicit persistence choice.
- **Attack-with-all / clear-all-attackers shortcut** — small and clean
  (`eligibleAttackers` returns the full set; `declareAttackers` takes any
  subset); a fast-follow to the combat-preview work.

Deck share codes are shipped under road-to-1.0 Feature 4 and reuse Feature 8's
DOM input seam. Match history / deterministic replays are deferred to 1.1/1.2.

## Suggested sequencing

Historical execution matched the intended dependency shape:

1. **Wave 1 (Features 1–6) + the deck-list bug (7)** shipped first.
2. **Feature 8 (search)** shipped before multi-deck and deck-code import, giving
   those flows the reusable DOM input seam.
3. **Feature 9** shipped in two steps: compact keyword names on card faces, then
   a separate inspect-overlay glossary legend.
4. **Features 10–14** shipped independently; undo and combat preview were the
   determinism-heavy pieces.
5. **Feature 15 (multi-deck)** shipped after search, then later picked up
   per-deck hero images and the redesigned deck selector.

## SaveData version walk

Historical actual: the QOL plan used **v6 → v7** for
`settings.confirmDestructive` and **v7 → v8** for `settings.keywordReminders`,
each with a real migration + test. Later 1.0 work moved the live schema to
**v15**. The remaining settings-toggle UI follow-up needs no new schema field
unless the settings model changes.

## Test strategy (cross-cutting)

Headless-heavy, the way the repo rewards: `reasonUncastable` (Feature 2), the
search filter clause (8), `KEYWORD_REMINDER` coverage (9), the undo
snapshot/restore round-trip (11, doubles as a determinism guard), `previewCombat`
golden outcomes vs `resolveCombatDamage` (12), deck-stats aggregation (13),
`ProfileScene` win-rate math (14), `deleteDeck`/copy/rename (15), and the
v6 → v8 QOL migrations. The genuinely visual/interaction pieces (arrows, hotkeys,
gold badge, odds panel, batch reveal, glossary legend) fall under the existing
by-eye / preview-probe caveat and get flagged for the human, not fake-verified.
No feature moves the AI or balance baselines.

## Open questions / decisions for the user

Resolved by implementation:

1. **Confirm-destructive default** shipped on.
2. **Keyword presentation** moved to compact keyword names on card faces plus
   inspect-overlay glossary panels.
3. **Search depth** shipped as structured-field search (name/type/subtype/keyword),
   intentionally leaving full rules-text search out of the pure filter layer.
4. **Undo scope** shipped as one-deep local take-back.
5. **Combat preview** shipped as pure `previewCombat`.
6. **Batch pack reveal** shipped as a summary path.

Still open:

1. **Settings controls** — expose `confirmDestructive` and `keywordReminders` in
   Settings once the panel has a wider / two-column relayout.
2. **Sticky filter persistence** — decide whether collection/deck-builder filter
   state should persist across scene exits or stay session-local.
