<!-- source-of-truth: src/engine/Game.ts, src/engine/types.ts, src/engine/events.ts, src/engine/view.ts, src/engine/resolve.ts, src/engine/phases.ts, src/engine/rng.ts, src/main.ts, src/scenes/DuelScene.ts, src/scenes/GauntletScene.ts, src/scenes/AchievementsScene.ts, src/meta/services.ts, src/meta/SaveManager.ts, src/meta/Economy.ts, src/meta/Achievements.ts, src/meta/collectionFilter.ts, src/meta/deckColorIdentity.ts, src/ui/CardView.ts, src/ui/BoardCardView.ts, src/ui/LandStackView.ts, src/ui/CardZoomPreview.ts, src/ui/HistoryPanel.ts, src/ui/CombatFx.ts, src/ui/CommanderPortrait.ts, src/ui/PileView.ts, src/ui/handFan.ts, src/ui/handSort.ts, src/meta/deckFace.ts, src/data/attackFx.ts, src/ui/CardThumbCache.ts, src/audio/, tests/helpers.ts · last-verified: 2026-07-08
     If you change those files, update this doc or re-verify the date. -->

# Architecture

Darling Blades is layered so the game rules never depend on how the game looks.

```
        data ──────────────────┐
          │                    │
          ▼                    │
        engine  ───────────────┤
        ╱      ╲               │
      ai        meta           │
        ╲      ╱   ╲           │
       scenes / ui  audio ◄────┘
```

Read it top-down: `data` supplies card definitions; `engine` is the pure rules
core; `ai` and `meta` sit on top of the engine; `scenes`/`ui` (Phaser) and
`audio` (raw WebAudio, no Phaser) are the presentation layer that consumes
everything and renders/sounds.

## The iron rule: the engine is pure

Everything under `src/engine/` is **pure TypeScript with zero Phaser imports**.
The rules are a function of data:

> `(decklists, seed, action sequence) → identical GameState + event stream`

on every machine, every run. This is what makes replays, the AI's simulation,
and the determinism tests possible.

Concretely:

- **State is plain JSON.** `GameState` (`src/engine/types.ts`) holds only
  numbers, strings, arrays, and plain objects — no class instances, no
  functions, no `Map`/`Set` inside the state.
- **`structuredClone` is the whole cloning story.** `Game.clone()` is literally
  `Game.restore(structuredClone(this.st), this.db)` (`src/engine/Game.ts`).
  Because state is plain JSON, a structural clone is a perfect deep copy — no
  hand-written clone logic to drift out of sync.
- **Randomness lives in the state.** The PRNG is a 4-number
  xoshiro128** array stored at `state.rng` (`src/engine/rng.ts`), mutated in
  place. Cloning the state clones the RNG, so a cloned game replays identically.

## The `Game` facade

`src/engine/Game.ts` is the only public entry point to the engine. Its contract
is **validate → apply → emit**:

```ts
submit(player, action): GameEvent[]   // throws if the action is illegal
```

- `validateAction` (`src/engine/actions.ts`) returns an error string or `null`;
  `submit` throws on any error before mutating anything.
- `apply` mutates `state` and pushes `GameEvent`s into a buffer.
- The buffer of events is returned to the caller (the scene, or the AI's
  simulation).

Other facade methods:

- `state` / `awaiting` — read-only accessors.
- `legalActions(player)` — the full legal action menu for a decision point.
- `viewFor(player)` — the **redacted** view (see below).
- `clone()` / `static restore(state, db)` — deep-copy / reconstruct a game from
  a bare state.
- `initialEvents` — the events produced during setup (first-player roll, shuffles,
  opening hands), available immediately after construction.

**The `CardDb` is injected, not imported.** `Game`'s constructor takes
`{ decks, seed, db }`. The engine never imports `src/data/catalog.ts`; it only
ever reads the `db` it was handed. This is what lets tests inject a tiny pool —
`TEST_DB` in `tests/helpers.ts` is ~40 cards, and every engine test runs against
it. Production passes `CARD_DB` (282 cards — the 210-card `base` set plus the
69-card + 3-token Ragnarök expansion).

## The event stream

The event stream is the **only** thing the presentation layer animates from.
Events carry full information; redaction happens separately in `viewFor`, and
the presenter is responsible for not *displaying* hidden cards.

The full `GameEvent` union (`src/engine/events.ts`):

<!-- BEGIN GENERATED: GameEvent table (events from src/engine/events.ts · run: npm run gen-docs-tables · payload/meaning prose is hand-maintained) -->

| Event                  | Payload (besides `e`)                           | Meaning                                                                                                                    |
| ---------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `firstPlayerChosen`    | `player`                                        | The seeded coin flip picked the starting player.                                                                           |
| `turnBegan`            | `player`, `turn`                                | A new turn started for `player`.                                                                                           |
| `stepChanged`          | `step`                                          | The turn advanced to a new step.                                                                                           |
| `untapped`             | `iids`                                          | These permanents untapped during the untap step.                                                                           |
| `drew`                 | `player`, `cardId`                              | `player` drew a card (full info — presenter hides opponent's).                                                             |
| `mulliganTaken`        | `player`, `count`                               | `player` mulliganed; `count` is their running mulligan total.                                                              |
| `handKept`             | `player`                                        | `player` kept their opening hand.                                                                                          |
| `cardsBottomed`        | `player`, `count`                               | `player` put `count` cards on the bottom (London mulligan). Also emitted with `count: 0` by `recall` as a UI resync nudge. |
| `landPlayed`           | `player`, `iid`, `cardId`                       | A land entered under `player`.                                                                                             |
| `manaTapped`           | `player`, `iids`                                | These sources tapped to pay for a spell.                                                                                   |
| `spellCast`            | `sid`, `cardId`, `controller`, `targets`        | A spell went on the stack.                                                                                                 |
| `responseWindowOpened` | `player`                                        | A response window opened for `player` (they hold an instant).                                                              |
| `spellResolved`        | `sid`                                           | A stack item resolved.                                                                                                     |
| `spellCountered`       | `sid`                                           | A stack item was countered off the stack.                                                                                  |
| `targetsFizzled`       | `sid`                                           | Every target became illegal; the spell fizzled to the graveyard.                                                           |
| `permanentEntered`     | `perm`                                          | A non-token permanent entered the battlefield.                                                                             |
| `attackersDeclared`    | `iids`                                          | The active player declared these attackers.                                                                                |
| `blockersDeclared`     | `blocks`                                        | The defender declared these blocker→attacker pairs.                                                                        |
| `combatDamage`         | `hits[{source, target, amount}]`, `firstStrike` | A batch of simultaneous combat damage was computed.                                                                        |
| `damageMarked`         | `iid`, `amount`                                 | Damage was marked on a permanent.                                                                                          |
| `lifeChanged`          | `player`, `delta`, `now`                        | A player's life total changed.                                                                                             |
| `died`                 | `iid`, `cardId`, `owner`                        | A permanent left the battlefield to the graveyard (also used by `recall`).                                                 |
| `discarded`            | `player`, `cardId`                              | A card went from hand to graveyard.                                                                                        |
| `milled`               | `player`, `cardId`                              | A card went from the top of a deck to the graveyard (the `grind` op).                                                      |
| `triggerFired`         | `iid`, `when`                                   | A permanent's triggered ability fired.                                                                                     |
| `effectApplied`        | `op`, `detail?`                                 | One `EffectOp` executed (op name for logging).                                                                             |
| `tokenCreated`         | `perm`                                          | A token permanent entered.                                                                                                 |
| `positionNote`         | `note`                                          | Debug/log line only — never load-bearing.                                                                                  |
| `gameEnded`            | `winner`, `reason`                              | The game ended (`reason`: `life`/`deck`/`concede`/`turnLimit`).                                                            |

<!-- END GENERATED -->

## Hidden information: `viewFor` redaction

AIs — at *every* difficulty — receive only a `PlayerView` from
`viewFor(state, player)` (`src/engine/view.ts`), never the raw `GameState`.
Redaction:

- **Your own hand** is exact (`SelfView.hand`), but **your deck becomes a
  count** (`deckCount`) — you know your decklist, not its draw order.
- **The opponent's hand and deck become counts** (`OpponentView.handCount`,
  `deckCount`).
- **Battlefield, stack, combat, and both graveyards are public** and cloned into
  the view (`structuredClone`), so an AI can mutate its view freely.

This is the single choke point for hidden information: if it's not in the view,
no AI can see it.

## The decision-state machine: `Awaiting`

At any moment the engine is waiting on exactly one decision, encoded in
`state.awaiting` (`Awaiting` in `src/engine/types.ts`). Each variant names the
player who must act and the kind of choice:

| `Awaiting.kind`       | Extra fields         | The player must…                                        |
| --------------------- | -------------------- | ------------------------------------------------------- |
| `mulligan`            | —                    | keep or mulligan the opening hand.                      |
| `bottomCards`         | `count`              | put `count` cards on the bottom (London mulligan).      |
| `main`                | —                    | act in main 1 or main 2 (which one is in `state.step`). |
| `declareAttackers`    | —                    | pick an attacker set (`[]` skips combat).               |
| `declareBlockers`     | —                    | assign blockers.                                        |
| `respond`             | `over` (spell/attackers/blockers) | respond to the named item or pass.        |
| `endStepWindow`       | —                    | cast an instant at end of turn, or pass.                |
| `discardToHandSize`   | `count`              | discard down to the max hand size at cleanup.           |
| `gameOver`            | —                    | nothing — the game is over (no `player` field).         |

`legalActions` reads `awaiting` and enumerates exactly the actions valid for that
decision; `validateAction` cross-checks any submitted action against it.

## Scene map

Scenes are registered in `src/main.ts` and flow:

```
Boot → Preload → MainMenu → { Gauntlet→Duel, Duel, Shop→PackOpening, Collection, DeckBuilder, Achievements, Showcase }
```

- **Boot** (`BootScene.ts`) — registers the WebGL post-FX pipeline, then jumps
  to Preload.
- **Preload** (`PreloadScene.ts`) — waits for webfonts, bakes shared textures
  (frames, mana pips, FX), builds the placeholder art atlas, queues real art,
  then starts MainMenu.
- **MainMenu** (`MainMenuScene.ts`) — the menu + starter picker.
- **Gauntlet** (`GauntletScene.ts`) — the Avatar Gauntlet ladder, reached from
  the MainMenu "Avatar Gauntlet" item; shows the ten rungs and launches
  gauntlet duels.
- **Duel / Shop / PackOpening / Collection / DeckBuilder / Achievements / Showcase** — the
  feature scenes.

**Scene-data passing** uses Phaser's `scene.start(name, data)`:

- **Duel's full init contract** is
  `{ difficulty?, opponentId?, gauntletRung? }` (`DuelScene.create`).
  MainMenu's Practice items pass just `{ difficulty }`; the Gauntlet passes
  `{ opponentId, gauntletRung }`, and an `opponentId` puts the duel in gauntlet
  mode — the avatar's themed deck, brain difficulty, and personality override
  any `difficulty` passed. After a gauntlet win, "next rung" restarts the Duel
  scene in place with the next avatar
  (`scene.restart({ opponentId, gauntletRung })`) instead of routing back
  through the menu.
- Shop → PackOpening passes the `PackResult` (the rolled cards) directly, so
  the opening scene animates a reveal without re-rolling.

## Anatomy of one turn in `DuelScene`

`src/scenes/DuelScene.ts` is a thin controller over the engine. The loop for a
single human action:

1. **Input → Action.** A click handler (`onHandClick`, `onBattlefieldClick`,
   `onButton`) builds a concrete `Action`. Targeted spells enter a "pending
   cast" state (`pendingCasts`) and wait for the player to click a target.
2. **Submit.** `act(action)` calls `this.duel.submit(HUMAN, action)`, which
   returns the event batch.
3. **Narrate the batch.** `processEvents(events)` walks the events (via
   `narrateEvent`) to spawn floating damage/life numbers and log lines — it does
   *not* rebuild the board from events. A batch that lands combat damage is
   instead **choreographed** (see *Sequenced combat* below) at `animations:
   'full'`; every other batch narrates instantly.
4. **Declarative re-render.** `sync()` reads the *current* `GameState` and
   reconciles the whole board: it diffs battlefield `iid`s against the live
   `BoardCardView` tile map (adding/removing/tweening), rebuilds the land
   stacks, the available-mana pips, the hand, the HUD, targeting arrows, and
   any overlay. Rendering is a pure function of state; events only drive the
   transient floats.
5. **Hand off to the AI.** The post-batch tail (`sync` + `maybeRunAI` +
   `maybeAutoSkip` + `endTurnTick`) runs through one `afterEvents()` seam so a
   playing combat sequence can defer it. `maybeRunAI()` schedules a delayed
   call; when the AI is to act it calls `ai.chooseAction(viewFor(AI),
   legalActions(AI))`, submits, and repeats the narrate + sync cycle.

**Sequenced combat.** The engine resolves all combat damage in one atomic step
and emits it as a single `combatDamage` batch (all hits at once). To let the
player watch attackers strike the defenders one at a time, a pure planner
(`src/ui/combatSequence.ts` `planCombat`) orders the hits per attacker, and
`playCombatSequence` plays each step (lunge + themed strike + damage float) on a
stagger while **deferring** `afterEvents()` (the sync + AI/auto-skip/end-turn
follow-ups) until the last strike lands — so the pre-combat board stays up and a
combat-lethal game-end shows only once the dust settles. `animatingCombat` gates
the act loop meanwhile. The engine is untouched; reduced/off motion keeps the
instant all-at-once path.

The split — *events animate the deltas, state renders the board* — keeps the UI
from ever desyncing from the engine.

### The duel board: the "Immersive Fan" stage (2026-07-04 redesign, wireframe 1a)

The board follows the user-picked **wireframe 1a "Immersive Fan"** (Arena-pole,
casual density — the old full-width bands and gold phase seam are gone; the
stage backdrop shows through around two inset zone plates). Layout regions (the
`LAYOUT` const in `DuelScene.ts`, 1280×720 design res):

- **Opponent strip** (full-width, y 0–56): matchup label, a circular **avatar
  disc** (the gauntlet avatar's `portraitCardId` art, or the AI deck's derived
  face card in practice), their targetable life total, hidden-hand **card-back
  fan ×N**, deck/grave **`PileView`** piles, their per-color mana pips, and the
  live **⏩ Auto-skip** toggle chip.
- **Two zone plates** (inset rounded rects): each holds that player's land
  stacks at its outer edge and creature-tile row at its inner edge,
  Arena-style. The **skip toast and the stack readout** float in the gap
  between the plates.
- **Phase rail** (left edge): a turn pill (`T6`), the current-step pill (gold
  on your turn), a whose-turn tag, and the wrapped hint + log lines.
- **Bottom stage**: the **`CommanderPortrait`** (bottom-left, rising from the
  screen edge) shows your deck's **face card** — derived by the pure
  `faceCardFor` (`src/meta/deckFace.ts`: legendary creatures first, then copy
  count / rarity / mana value / name) — with your deck's name on its plate and
  your targetable life total riding its corner; it **reacts** to your plays
  (cast glow) and your pain (damage flinch), pure decoration. Center: the
  **arced hand fan** (pure math in `src/ui/handFan.ts`). Right: the **⏭ End
  Turn** chip above the **circular smart button** (the 1a "PASS" circle — an
  `Arc` carries the input so relabeling the separate label Text can never hit
  the Text hit-area trap), your deck/grave piles, and Concede.

Seven dedicated ui components carry the board:

- **`BoardCardView`** (`src/ui/BoardCardView.ts`) — a compact 132×146
  battlefield tile whose **art fills the whole tile** (a near-square 124×138
  window inset by a 4px frame margin, cover-cropped with a slight upward bias)
  with the readouts **overlaid** on it: a translucent **name-scrim band + name
  text**, and an **effective-P/T badge in the bottom-right corner**
  (creatures only). The P/T badge is color-coded by state (damaged /
  buffed / weakened / normal, fed from `getEffectiveStats`); a `✦N` badge marks
  attached auras (top-left corner); 90° tap rotation and highlight states mirror
  the old full-card tint predicates (legal target, selected/declared attacker,
  blocker, eligible). A **summoning-sick** creature (entered this turn, no
  haste — the engine's `isSummoningSick` is the source of truth) gets a
  moonlight-swirl badge in the art's top-right corner and a slight art fade
  (`setSummoningSick`), so a glance shows which creatures can't attack yet; the
  fade rides the art's own alpha, independent of the container-alpha enter/exit
  tweens and the highlight tint. Every non-land permanent that isn't an attached aura gets a tile —
  so global enchantments and artifacts have board presence. Deliberately NOT a
  `CardView`: rules text is unreadable at tile size; the full card is one hover
  or right-click away.
- **`LandStackView`** (`src/ui/LandStackView.ts`) — lands render as per-type
  piles of cached thumbnails (`makeCardThumb`) with mana-color pips and an
  `untapped/total` badge that reads gold while mana is available; a fully
  tapped pile dims and turns its top card sideways. Your stacks tuck under the
  hand fan's left cards on wide hands — the authoritative "what can I cast"
  readout is the mana pip row, not the badges.
- **`CommanderPortrait`** (`src/ui/CommanderPortrait.ts`) — the 1a "waifu on
  stage": a rounded-top frame with cover-cropped, face-biased card art behind a
  world-space geometry mask (the panel is pinned; the in-code comment documents
  the move-invalidates-mask limitation), a name plate, and two idempotent
  fire-and-forget reactions (`reactDamage` shake+flash, `reactCast` glow) that
  tolerate `tweens.timeScale = 20` and rapid re-triggering.
- **`PileView`** (`src/ui/PileView.ts`) — display-only deck piles (stacked
  card-backs + count badge), grave slots (outline + count), and the opponent's
  overlapped hand-backs `×N` row; `setCount` is cheap to call every sync.
- **`CardZoomPreview`** (`src/ui/CardZoomPreview.ts`) — reusable hover-zoom:
  dwelling on any card for 400 ms (or instantly while **Z** is held) shows an
  enlarged `CardView` docked to the screen side away from the pointer, at
  depth 105 — above the pick overlays (depth 100), so hover-reading works
  during mulligan/discard decisions, and below the inspect modal (110). Hosts
  suppress it while their own modals are open.
- **`HistoryPanel`** (`src/ui/HistoryPanel.ts`) — a right-edge move-history
  slide-out: a vertical "History" tab (plain interactive Text, inflated hit
  area — never `setInteractive` on the scaled container) toggles a translucent
  log panel (depth 70) in/out. `DuelScene.log()` mirrors every feed line into
  `push()` (newest first, last ~14). The tab joins `overlayGuardTargets()` so
  modal decisions deaden it.
- **`CombatFx`** (`src/ui/CombatFx.ts`) — the attack-animation renderer, driven
  off the event stream: `lunge()` on `attackersDeclared` (each attacker tile
  jabs toward the enemy side) and `strike()` on `combatDamage` (a themed impact
  flourish from source to target). At `animations: 'full'` the `combatDamage`
  batch is sequenced attacker-by-attacker (`src/ui/combatSequence.ts` +
  `playCombatSequence`); reduced/off fires them all at once. The theme is
  the attacking card's **attack archetype** — one of 12 (slash/cleave/pierce/
  arcane/fire/frost/shadow/venom/claw/radiance/aerial/impact) resolved by the
  pure `attackFxFor` (`src/data/attackFx.ts`, explicit per-creature map +
  keyword/subtype/color fallback), hue-tinted by card color. Every effect draws
  its core motion with a short-lived `Graphics` + tweens that self-dispose
  (guarding `.active`); particle bursts are optional enrichment gated on
  `fxPolicy(scene).particleScale` (0 → graphics-only). "Tasteful & quick"
  (~300–450 ms), pure decoration — never drives game logic.

**Input conventions.** Right-click on any card — hand, battlefield tile, or
land stack — opens the full inspect modal instantly (a live `CardView` with
full FX); right-click also cancels a pending targeted cast. Inspect-open keys
off the **initiating button** of the press (`p.button === 2` on `pointerdown`),
never the live `rightButtonDown()` bitmask (true for a chorded left press);
conversely every `pointerup` handler gates on `rightButtonReleased()` so the
release of a right-click never fires a left-click action (concede, the seam
button, closing the inspect it just opened). The browser context menu is
disabled **once per game lifetime** via a module flag — `disableContextMenu()`
adds an undeduped DOM listener and DuelScene restarts per gauntlet rung.

**The hand** is an **arced fan** (`fanLayout` in `src/ui/handFan.ts`, a pure
unit-tested module): spacing shrinks to fit the span first, and only when
cards would overlap past readability does the card scale drop (0.46 → 0.4 —
kept small so the fan's top edge clears the player land row rather than
burying it); on top of that flat-row math each card tilts up to ±10° and edge
cards drop parabolically below the center baseline (they may slightly overhang
the screen bottom — the 1a rising-fan look). The fan span widens on touch
(760 → 900) to keep adjacent tap-target centers ≥90px through 9-card hands.
The hand is **auto-organized** for readability — lands first, then ascending
mana value, then like colors clustered (WUBRG) — by the pure, unit-tested
`handDisplayOrder` (`src/ui/handSort.ts`). That function returns a *display*
permutation of hand slots only: the engine's hand array (and the `handIndex`
every click, cast, and pick addresses) is never reordered, so `syncHand`
carries both a visual `pos` and the true `handIdx`, and organizing is purely
cosmetic and determinism-safe. The mulligan / bottom-cards / discard pick
overlay (`buildPickOverlay`) shares the same ordering, and its `discardPicks`
still store true hand indices.
Hovering **straightens** the card upright, lifts and enlarges it; a gold dot
above a card means "castable right now", driven by the same engine
`legalActions` that will handle the click. Above the smart button, per-color
**WUBRG mana pips** show how many of your untapped sources can produce each
color (engine `manaSources` — public info, which is why the opponent's strip
carries the same row for their lands).

## The meta layer

`src/meta/` is Phaser-free so it can be unit-tested headless and reused
anywhere:

- **`Services`** (`services.ts`) — a plain module singleton wiring the meta
  layer. Scenes `import { Services }` directly rather than routing through a
  Phaser registry or event bus. It holds a single `SaveManager`. Tests construct
  their own `SaveManager` with a fake storage instead.
- **`SaveManager`** (`SaveManager.ts`) — one versioned JSON blob
  (`SaveData`, `version: 12`) in `localStorage` under the key `darlingblades.save.v1`.
  The key is a storage slot name, not the schema version — the version lives
  inside the blob, and the key deliberately never changes so older builds and
  newer builds read the same slot (the legacy `waifutcg.save.v1` key is still
  read once for save migration — see `src/meta/SaveManager.ts`). Writes are debounced (`touch()` → 250 ms →
  `flush()`); corrupt or missing data falls back to a fresh save. Any blob that
  isn't `version: 12` routes through `migrate()`, which forward-migrates
  **stepwise** so a v1 save walks the whole chain: v1 → v2 (gold / collection /
  decks / stats / settings preserved, `gauntlet` defaults spread in), then
  v2 → v3 (grows `settings.musicOn`, defaulting on), then v3 → v4 (seeds
  `collectionVariants` — every pre-variant copy becomes the plain `white|none`
  variant — and rebuilds `settings` as
  `{ volume, sfxOn, musicOn, animations, renderScale, autoSkip }`, dropping the
  dead `animSpeed` field), then v4 → v5 (coerces the removed
  `renderScale: 'auto'` — and any out-of-range value — to the hard-coded
  1080p default; explicit 720p/1080p/1440p choices pass through), then
  v5 → v6 (adds `heroCardId`, and seeds any in-progress gauntlet run a
  deterministic `seed`), then v6 → v7 (adds `settings.confirmDestructive`,
  default on), then v7 → v8 (adds `settings.keywordReminders`, default on),
  then v8 → v9 (adds the premium `heroPortraitId`, default `null`), then
  v9 → v10 (adds `tutorialDone`, deriving veteran saves from win/loss history),
  then v10 → v11 (adds `achievements: { unlocked, claimed }`), then v11 → v12
  (adds `gauntlet.clearStyles` counters for mono-/dual-color tower clears); an unknown
  or garbage version starts fresh rather than crash. Storage is injected, so
  tests pass a plain object.
- **Economy functions** (`Economy.ts`) — `applyMatchResult`, `spendGold`,
  `todayString`; all constants come from `ECONOMY` in `src/config/rules.ts`.
  Gauntlet completions can optionally record the completed deck's color style
  for themed achievements.
- **`variants`** (`variants.ts`) — the multi-axis drop system: `FrameStyle` /
  `HoloFinish` / `CardVariant` (`variantKey` = `frame|holo`), the specialness
  ranking (frame primary, holo tiebreak), and the seeded cumulative-weight
  rolls (`rollTier` / `rollFrame` / `rollHolo`) over the `DROPS` tables in
  `src/config/rules.ts`.
- **`PackOpener`** (`PackOpener.ts`) — rolls a booster of `ECONOMY.packSize`
  independent slots (tier → card → frame → holo), dupe-protects the sr/ssr/ur
  slots, falls back a tier when a pool is empty, and folds the results into
  the collection, sorted worst→best for the reveal.
- **`Collection`** (`Collection.ts`) — variant-aware `addCard`/`ownedCount`/
  `ownedVariants`/`bestOwnedVariant`. Aggregate counts live in `collection`;
  per-variant counts in `collectionVariants` (they always sum to the
  aggregate). Plain dupes past the `PLAYSET` melt to gold; special variants
  are always kept.
- **`Achievements`** (`Achievements.ts`) — pure achievement catalog/evaluator
  over durable save data plus `CARD_DB`: collection percentage, color
  completion, themed RoTK / Greek / Beastkin / Ragnarök goals, tower-clear
  goals, variant chase goals, mastery, and pack-opening economy goals.
  Unlocks are recomputed from the save, while claiming is explicit and
  idempotent. `collectionFilter.ts` owns the shared completion math used by
  both achievements and the Collection header.
- **`deckColorIdentity`** (`deckColorIdentity.ts`) — pure nonland deck-color
  classifier used by tower-clear achievements. Mana-fixing lands are ignored so
  a mono-color spell suite remains mono-color even with dual lands.
- **`DeckStorage`** (`DeckStorage.ts`) — `validateDeck` (60 cards, ≤4 copies,
  owned, no tokens) and `saveDeck`, plus the multi-deck ops
  (`generateDeckId`, `copyDeck`, `renameDeck`, `deleteDeck`) behind the
  saved-deck picker.

## Determinism & RNG — two separate streams

There are two independent seeded PRNGs, deliberately kept apart:

- **Engine RNG** (`src/engine/rng.ts`, xoshiro128**) lives inside `GameState`
  and drives shuffles, the first-player roll, and random discards. It is part of
  the state, so it clones with the state and replays exactly.
- **Art RNG** (`SeededRandom`, `src/art/SeededRandom.ts`, FNV-1a → mulberry32)
  is seeded per card by its id. It drives placeholder-art decisions only and
  never touches gameplay. A card looks identical every session because its art
  seed is its id — nothing gameplay-random leaks into visuals or vice-versa.

## `CardView` composition

`src/ui/CardView.ts` is the one reusable card component. Key facts:

- **Canonical size 300×420** (`CARD_W`/`CARD_H`) with a **center origin**, so a
  tapped card can rotate 90° cleanly around its middle.
- **Consumers scale the container.** The view is built once at full size;
  callers `setScale(...)` per context (inspect overlays 1.35, the duel's
  hover-zoom preview 1.3, pick overlays / pack-reveal rest ≈0.62, duel hand
  fan 0.52–0.6). Battlefield permanents no longer use `CardView` at all — they
  render as compact `BoardCardView` tiles (see the duel-board subsection
  above).
- **Composition** = baked frame image + art image (windowed and cropped) + name
  / type / rules texts + P/T plate + cost pips + rarity gem + optional legendary
  crown + optional per-copy variant treatments (frame ring/wash + holo FX).
- **FX budget:** `setCard(card, { fx, variant? })` takes
  `'full' | 'static' | 'none'` plus an optional `CardVariant`. Holo renders
  ONLY from a passed variant (per-copy pull cosmetics — no variant, no holo),
  and only `'full'` attaches the (expensive) holo shader/particle layer — keep
  **≤ ~15 `fx:'full'` instances** alive at once. In the duel, hand cards and
  the hover-zoom preview use `fx:'none'` (battlefield tiles have no FX layer
  at all); the inspect modals and the Showcase use `fx:'full'`.

**Grid thumbnails are baked, not live.** The Collection and DeckBuilder grids
do **not** build a `CardView` per cell — `src/ui/CardThumbCache.ts` bakes each
card once (throwaway `CardView` → `DynamicTexture` → destroy) and hands the
grids single lightweight `Image`s (`makeCardThumb`); the duel's land stacks
(`LandStackView`) reuse the same baked thumbs. Textures live in the
game-global `TextureManager`, so they survive scene restarts; baking is lazy
per cell and the ~280-card pool bounds the cache. Thumbs are always `fx:'none'`
static snapshots — the inspect overlays keep constructing live `CardView`s with
full FX. Being plain Images (not Containers), thumbs can be `setInteractive()`'d
directly without the `CardView` Zone-child hit-area workaround.

The art window, crop math, and holo details are owned by
[docs/art-pipeline.md](art-pipeline.md).

## The audio layer

`src/audio/` is presentation-layer sound with no Phaser dependency — Phaser's
own sound system is switched off entirely (`audio: { noAudio: true }` in
`src/main.ts`, which stops Phaser creating a second, pre-gesture AudioContext).

- **`recipes.ts`** — pure-data SFX recipes: 14 named cues (`click`, `hover`,
  `cast`, `land`, `attack`, `hit`, `death`, `lifeLoss`, `win`, `loss`, `coin`,
  `flip`, `shimmer`, `rungClear`), each a handful of oscillator/noise "voices"
  as plain numbers. No browser APIs, so the recipes are lint-testable headless.
- **`AudioManager.ts`** — schedules recipes on one shared WebAudio
  `AudioContext`. The context is created only inside the first user gesture
  (pointerdown/keydown, capture phase), so browsers never log an autoplay
  warning; until then `play()` silently no-ops, and in headless/test
  environments with no `AudioContext` everything no-ops. Identical SFX within
  45 ms collapse to one play (event batches thump once, not clip). A `bus`
  getter exposes the shared context + master gain to the music layer (null
  until the gesture unlock), so master volume, mute, the unlock, and headless
  no-op behavior apply to SFX and music alike.
- **`sfx.ts`** — the `Sfx` singleton, mirroring how `Services` exposes the meta
  layer. Volume reads/writes route through the `SaveManager`
  (`SaveData.settings.volume`), so the setting persists, and playback is gated
  on the persisted `settings.sfxOn` toggle; both are driven from the
  `SettingsScene` (gear button on the MainMenu).

On top of the SFX sits **generative ambient music** — same context, same
master gain, no assets:

- **`musicPatterns.ts`** — the pure pattern core (no browser APIs; unit-tested
  headless in `tests/audio/musicPatterns.test.ts`): a seeded Markov chord walk
  over diatonic triads that always excludes the previous **two** degrees (so
  period-1/period-2 cycles are impossible), classic nearest-neighbor voice
  leading, and sparse chord-tone plucks — parameterized by four `MOODS`
  presets: `menu` (C-major calm), `duel` (A-minor tenser), `gauntlet`
  (D-dorian mysterious), `shop` (light — also used by
  PackOpening/Collection/DeckBuilder).
- **`music.ts`** — `MusicDirector` and the `Music` singleton. A 300 ms
  scheduler with a 2.8 s lookahead queues chords ahead of background-tab timer
  throttling; each chord gets its own fade node, so `setMood()` crossfades
  (early-release the old chords while the new mood's long-attack first chord
  swells in). `setMood` is a no-op when the mood is unchanged — gauntlet
  rung-to-rung `DuelScene` restarts never stack oscillators — and
  `Music.duck()` briefly dips the bed under the win/loss stings. The music
  routes through a ~0.3 sub-gain hung off `AudioManager.bus`. Scenes call
  `Music.setMood(...)` from `create()`; the Music toggle in `SettingsScene`
  drives it, persisted as `SaveData.settings.musicOn`.
