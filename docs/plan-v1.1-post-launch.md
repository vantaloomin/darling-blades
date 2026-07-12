<!-- source-of-truth: docs/plan-road-to-1.0.md, docs/claude-playbook.md, src/scenes/MainMenuScene.ts, src/scenes/DuelScene.ts, src/scenes/GauntletScene.ts, src/data/opponents.ts, src/ai/personality.ts, src/ui/BoardCardView.ts, src/meta/gauntletSeed.ts, scripts/balance-matrix.ts, src/engine/types.ts, src/data/catalog.ts, src/meta/collectionFilter.ts, src/meta/PackOpener.ts · last-verified: 2026-07-11 · design/plan doc — re-verify when the referenced code changes -->

# Post-launch (v1.1) — deferred backlog

> **Update (2026-07-10, post-1.0-cut):** the 1.1 program is now scoped in
> [plan-1.1.md](plan-1.1.md), and the user made the calls this doc was
> waiting on: **Feature 1 (opponent picker) is scheduled into 1.1**;
> **Feature 3 is decided — seeded daily rotation — and scheduled** (with its
> balance re-baseline); **Feature 4 is decided — relabel only, data stays
> disjoint — and scheduled**; **Feature 5 (Limited) releases with the Celtic
> Fae expansion in 1.1**. Feature 2 (drag-reorder) remains unscheduled. The
> detailed analyses below stay authoritative for implementation.

The 1.0 program is scoped by [plan-road-to-1.0.md](plan-road-to-1.0.md), and as
of 2026-07-08 all five of its features are shipped (tutorial, achievements,
daily quests + streaks, Sealed/Draft Limited, and deck share codes); what
remains of 1.0 is the human polish/validation backlog, while **deterministic
replays are deferred into this doc's horizon (1.1/1.2)** and — as of
2026-07-10 — **the public Limited release is descoped to a post-1.0
expansion release** (Feature 5 below). This doc is the
**other list** — four smaller deferred items that came up during
the road-to-1.0 planning review, were looked at seriously, and were
**deliberately pushed past 1.0** rather than dropped. Each was deferred for a
concrete reason: one is a nice-to-have UI polish that competes for the same
menu real estate as bigger features; one is genuinely risky against an iron
invariant (engine determinism); one drags a balance-revalidation tail behind it;
and one is really a product/data decision wearing an engineering costume, so it
shouldn't be built until the call is made. None is on the critical path to 1.0,
and none should block it — but each is real, cheap-ish, and worth not losing.

The point of writing them down now, with the current-state ground truth
confirmed against the code, is so v1.1 planning starts from facts rather than a
re-discovery pass. Where a feature brushes against one of the four iron
invariants (engine/AI purity, redacted `PlayerView`, seeded determinism, and
test-floor-only-ratchets-up), that's called out explicitly — the drag-reorder
feature in particular is a determinism hazard and is flagged as large/risky for
exactly that reason. Open product decisions are marked as such; they are the
gating question for their feature, not an implementation detail.

## Feature 1 — Practice-mode opponent / persona picker

**Why deferred.** Pure quality-of-life, not a 1.0 gap. The backend already does
everything; the missing piece is one more picker UI, and the MainMenu row budget
was already spoken for by the road-to-1.0 modes. Cheap, but it competes for menu
space and attention with things that actually move retention, so it waits.

### Problem

Practice today is difficulty-only. The three practice rows in
`MainMenuScene.ts` (`MENU_ITEMS`, lines 17-26) launch the Duel with just
`{ difficulty: 'easy' | 'medium' | 'hard' }` — no opponent identity. `DuelScene`
is built to accept one: `create(data: { difficulty?, opponentId?, gauntletRung? })`
sets `this.opponent = data.opponentId ? avatarById(data.opponentId) : null`
(DuelScene.ts ~line 242). With no `opponentId`, practice falls through the
`null` branch, so:

- **No persona.** The AI is constructed as
  `buildAI(this.difficulty, CARD_DB, seed ^ 0x5eed, this.opponent?.personality)`
  — `this.opponent?.personality` is `undefined`, so the brain runs the neutral
  `DEFAULT_PERSONALITY` (no `subtypeBias`, no `burnFaceLife`, no `holdback`).
- **A generic deck.** The AI deck is
  `STARTER_DECKS.find((d) => d.id !== save.activeDeckId)?.cards ?? STARTER_DECKS[1].cards`
  (DuelScene.ts ~line 307) — i.e. whichever starter you're *not* running, not a
  curated themed list.
- **A flavorless label.** The opponent strip reads
  `Practice — vs ${this.difficulty} AI` (DuelScene.ts ~line 415) rather than a
  name.

So a player who wants to practice against, say, Cao Cao's Wei swarm or Zeus's
mono-red burn before a gauntlet run has no way to select it outside of actually
climbing the tower to that rung.

### Design

A small pre-duel **opponent picker**: either a dedicated select screen reached
from a single "Practice" MainMenu entry, or a lightweight overlay on the
existing practice rows. The player picks a difficulty (or inherits it from the
chosen avatar) and an opponent from the `AVATARS` roster, and the picker calls
`scene.start('Duel', { difficulty, opponentId })`. That's essentially the exact
call `GauntletScene.startFight` already makes —
`this.scene.start('Duel', { opponentId: av.id, gauntletRung: av.tier })`
(GauntletScene.ts ~line 393) — minus the `gauntletRung`, so the run stays a
one-off practice duel with no tower/reward plumbing.

A natural build reuses the gauntlet's own avatar-card presentation
(`GauntletScene.buildPanel` renders portrait + name + title + theme chip +
difficulty pips + blurb from an `Avatar`), so the picker can look like a
"free play" version of the tower without the rung-locking.

### Architecture fit

Almost entirely additive UI. The data contract, the roster, and the AI
construction are all in place:

- **Roster:** `AVATARS` and `avatarById` in `src/data/opponents.ts` — each entry
  already carries `name`, `title`, `blurb`, `theme`, `difficulty`, `deck`,
  `personality`, `portraitCardId`.
- **Personalities:** `makePersonality` in `src/ai/personality.ts` (line 83); the
  avatars already pass their spreads through it.
- **Duel plumbing:** no `DuelScene` change needed — `opponentId` already selects
  the deck (`this.opponent.deck`), portrait (`this.opponent.portraitCardId`),
  and persona. The label branch already prints the opponent's name when
  `this.opponent` is non-null.

The only judgement call is what happens to the **human** deck: practice uses
`save.activeDeckId`, same as before, so no change there.

### SaveData impact

None required. The picker is transient scene state. (Optionally you could
remember the last-picked opponent for convenience — a single `string | null`
field with a defaulted migration — but that's a nicety, not a requirement.)

### Effort & risk

**Medium effort, low risk — and the backend is nearly free.** The whole cost is
the picker UI and wiring one `scene.start` call; there is no engine, AI, economy,
or determinism surface touched. No iron invariant is in play. The main design
question is menu placement (dedicated screen vs. overlay on the practice rows),
which is a layout call, not an engineering one.

## Feature 2 — Battlefield card drag-and-drop reorder

**Why deferred.** This is the risky one. Board-creature display order is derived
from the engine's `battlefield` array every sync, and there is no
client-side order layer to hang a reorder on. Doing it right means building that
layer *without* touching the engine array — because that array's order feeds
seeded determinism, the AI, and replay reproducibility, all iron invariants.
That's a large, careful piece of work for a cosmetic affordance, so it's a
post-launch item, explicitly flagged as a determinism hazard.

### Problem

The player cannot rearrange their creatures on the board. Layout is recomputed
from scratch on every `DuelScene.sync()` (line ~1298): the non-land, non-attached
permanents are filtered out of `st.battlefield`, split by controller, and each
row is positioned **by its index in that filtered array** —
`const x = BOARD_CENTER_X - ((n - 1) * spacing) / 2 + i * spacing`
(DuelScene.ts ~line 1349), with `y` from `creatureY(perm.iid, y)`. Existing tiles
are re-tweened to the freshly computed `x`/`y` every sync
(the `else` branch, ~line 1390). So the visual order **is** the engine array
order, and there is **no persisted per-card display order** anywhere.

A board tile is a `BoardCardView` — a 132×146 (`TILE_W`/`TILE_H`) **scaled
`Container`**. Its input is deliberately routed through an invisible child
`Zone` (`enableInput`, lines 333-353) rather than `setInteractive` on the
container itself; the class header (lines 13-15) and playbook §11 both call this
out as a hard trap ("never `setInteractive` a scaled Container"). Any drag
handling has to live on that Zone, not the container.

### Design

A **client-side, iid-keyed display-order override** that the layout loop honors,
never a mutation of the engine array:

1. **Order map.** Keep a `Map<number, number>` (or an ordered `iid[]`) in
   `DuelScene` recording the player's preferred slot for each battlefield `iid`.
   The `sync()` row-layout sorts the human's row by this override before
   computing `x` (opponent row stays engine-ordered). Absent an override, fall
   back to engine order so nothing changes until the player drags.
2. **Drag on the Zone.** Add Phaser drag handling to the `BoardCardView` input
   Zone (the existing `pointerdown/up/over/out` re-emission already threads the
   `Pointer` through). On drag, move the tile with the pointer and reorder the
   override map by drop position.
3. **Suppress the every-sync tween mid-drag.** The `else` branch that re-tweens
   every existing view to its computed `x`/`y` will fight a live drag. The tile
   being dragged (and ideally its row during the settle) must be exempted from
   that tween until drop, then snapped/tweened to its new computed slot.
4. **Reconcile on churn.** Creatures die, are summoned, and are bounced
   constantly. The override map must be pruned when an `iid` leaves the board
   (the existing `seen`-set cleanup at ~line 1420 is the hook) and must place
   newly-arrived `iid`s sanely (append, or nearest-slot) so a summon doesn't
   scramble the player's arrangement.

### Architecture fit — and the determinism hazard

The **entire feature must stay in the Phaser UI layer.** The tempting shortcut —
reorder `st.battlefield` itself — is forbidden: that array's order is part of
the deterministic engine state. Reordering it would change iteration order for
combat, triggered-ability sequencing, and RNG-consuming resolution, which breaks
the seeded-determinism iron invariant (`(decklists, seed, actions) → identical
GameState + event stream`), desyncs the AI (which reads a `PlayerView` derived
from that state), and would invalidate any future replay logs. So the override is
**purely a rendering permutation**: same engine state, same events, same AI
decisions — only the on-screen left-to-right position of the human's own tiles
differs. A test worth writing is a self-play/headless assertion that toggling the
display override produces byte-identical `GameState` and event stream, pinning
the "view-only" contract.

### SaveData impact

None. Display order is transient per-duel UI state; it does not survive the duel
and never touches the save blob.

### Effort & risk

**Large effort, high risk — the biggest caveat in this doc.** Not because any
one piece is hard, but because the drag interaction has to coexist with a layout
loop that authoritatively repositions every tile every sync, on a scaled
Container whose input model is already a documented trap, while the board churns
underneath it — and it must never leak into engine order. Recommend building it
behind the view-only determinism test above, and only after the higher-value 1.0
content ships. If it proves fiddly, it's an easy cut: it's a cosmetic nicety, not
a capability.

## Feature 3 — Randomized tower tiers

**Why deferred.** Not hard to code, but it decouples the gauntlet's rung index
from its curated deck/difficulty banding, which means the whole tower-balance
baseline has to be re-validated. That balance tail — plus an open design question
about *how* random it should be — is why it waits for a v1.1 pass with time for a
measured re-baseline, rather than riding along in the 1.0 crunch.

### Problem

The gauntlet is a **fixed 1:1 rung→avatar map.** `GauntletScene.buildTower`
looks up each rung with `avatarForRung(rung)` (GauntletScene.ts ~line 137), which
in `src/data/opponents.ts` finds the single `AVATARS` entry whose
`tier === rung` (`avatarForRung`, ~line 437). Every avatar is hand-tuned as a
*rung*: a curated 60-card themed deck, a `personality`, and a fixed `difficulty`
banded by position (rungs 1-3 `easy`, 4-6 `medium`, 7-10 `hard`; 9-10 are the
Ragnarök bosses — see the class header and each avatar's `tier`/`difficulty`).
The run's reproducibility rides a **per-rung seed**: `DuelScene` derives the duel
seed as `rungSeed(save.gauntlet.run.seed, this.gauntletRung)`
(DuelScene.ts ~line 301, `src/meta/gauntletSeed.ts`) so a whole tower run is one
deterministic playthrough.

Because rung index *is* the difficulty curve, there's no variety across runs: the
tower is the same ten opponents in the same order every time.

### Design — options, because "randomize" is underspecified

1. **Fully random.** Shuffle which avatar appears at each rung. Simplest to
   describe, worst for balance: a rung-1 slot could draw Brunhild (the summit
   boss, measured ~88% AI win-rate), making the curve nonsensical.
2. **Random-within-difficulty-band (recommended).** Preserve the easy/medium/hard
   banding — shuffle *within* each band so rungs 1-3 stay easy, 4-6 medium, 7-10
   hard, but which easy avatar lands on which low rung varies. This keeps the
   curve monotonic-ish and keeps `RUNG_BANDS` meaningful, but the current roster
   has exactly one avatar per rung, so this needs **more avatars per band** (or
   accepts a small pool) to actually produce variety.
3. **Seeded daily rotation.** Derive the roster deterministically from
   `todayString()` (the daily-quest idiom already proposed in road-to-1.0), so
   everyone gets the same shuffled tower each day and a seed can reproduce it.
   Friendliest to testing and to "share your run" — the run seed already exists.

### Architecture fit

The launch plumbing barely changes: `startFight` and the "Next Foe" flow already
pass `{ opponentId, gauntletRung }`, so the only real change is **how
`buildTower`/`avatarForRung` choose the avatar for a rung** — from a fixed
`tier === rung` lookup to a seeded permutation. Keep the per-rung seed derivation
(`rungSeed`) so within a chosen roster the duels stay reproducible.

The cost is not the lookup change; it's everything downstream of decoupling
index from deck:

- **Balance re-validation (iron invariant territory).** The tower balance
  baseline is a date-stamped matrix comment in `src/data/opponents.ts`
  (measured with `npx tsx scripts/balance-matrix.ts --avatars`), gated by
  `RUNG_BANDS` in `scripts/balance-matrix.ts` (rungs 1-3 `maxAvg 0.45`,
  escalating to rung 10 `minAvg 0.60`) and the skipped
  `tests/ai/balance.test.ts`. Those bands are keyed to `avatar.tier`. If avatars
  move between rungs, the "rung N should win ~X%" bands no longer describe a
  fixed opponent — either the bands re-key to the *avatar's own* target rather
  than the slot, or every reachable (avatar, slot) placement gets measured.
  Because the test-floor iron invariant says floors "only ratchet upward with
  fresh measured numbers," this is a real measurement pass, not a code tweak.
- **Roster depth.** Band-preserving shuffles need more than one avatar per band
  to be interesting, which is new curated-deck authoring.

### SaveData impact

**Likely a consideration, not yet a spec.** If the chosen roster must be stable
across a reload mid-run (so re-opening the app doesn't re-roll which boss is on
rung 7), the run needs to persist its roster — either the full avatar-id
ordering, or (cleaner) a single roster seed that regenerates the same permutation
deterministically, mirroring how `gauntlet.run.seed` already works. The daily-
rotation option (3) needs the least persistence since the day string re-derives
it. Flagging this; not over-specifying until the option is chosen.

### Effort & risk

**Medium effort, but data/balance-touching.** The code change is small; the
balance re-baseline is the real work and is gated by the same measured-floors
discipline as the existing tower. **Open product decision:** which randomization
model (fully random / band-preserving / seeded-daily), and whether v1.1 also
funds the extra avatars a band-preserving shuffle wants. Don't build until that's
answered — it changes both the balance surface and the SaveData shape.

## Feature 4 — "Base Set includes expansion" set semantics

**Why deferred.** This one is a **product/data decision** first and a small code
change second. Base and Ragnarök are currently modeled as strictly disjoint sets
— in the collection filter *and* in the pack pools — so "should Base include the
expansion" has real consequences for collection percentages, achievements, and
pack economics. Making the code change before the product call is made would just
bake in a guess. So it waits for the decision.

### Problem — the current model is strictly disjoint

`CardDef.set` is `'base' | 'ragnarok'` (optional; absent ⇒ `'base'`) —
`src/engine/types.ts` line 106. It's stamped centrally in `src/data/catalog.ts`:
`SET_GROUPS` (lines 25-41) tags each card group, and `buildDb` writes
`set: card.set ?? group.set` (line 48). Only the `RAGNAROK` array is
`'ragnarok'`; everything else is `'base'`. So the tag is reliable and central.

The disjointness shows up in **two** places, and the second is the one with teeth:

- **Collection filter.** `CollectionFilterState.set` is
  `'base' | 'ragnarok' | 'all'`, defaulting to `'all'`
  (`src/meta/collectionFilter.ts` lines 63, 71). `applyFilters` treats them as
  mutually exclusive: `(state.set === 'all' || (d.set ?? 'base') === state.set)`
  (line 109). Picking "Base" hides every Ragnarök card and vice-versa.
- **Pack pool.** `PackOpener.packPool(db, tier, set?)` filters the booster pool
  by set with the same disjoint test —
  `(set === undefined || (d.set ?? 'base') === set)`
  (`src/meta/PackOpener.ts` line 17), and `openPack` threads `set` through
  (line 47). So **base boosters can only ever contain `set:'base'` cards, and
  Ragnarök boosters only `'ragnarok'`.** This isn't just a display facet — it's
  the economy: which pack yields which cards.

So "should the Base Set include the expansion cards?" is not a one-line filter
tweak; it's a decision about what a "Base" booster contains and what "collection
complete" means.

### Design — the options, and what each costs

1. **Keep them disjoint (status quo).** Cleanest mental model, no code. "Base"
   and "Ragnarök" are separate products you complete separately. The only wart is
   a UI-clarity one: a "Base" label can read as "all cards" to a new player when
   it actually excludes the expansion.
2. **Relabel the filter for clarity, keep the data disjoint.** Rename the `'base'`
   collection facet to something like "Core Set (excl. expansion)" so the
   disjointness is obvious. Pure copy change in the filter UI; no pool or economy
   change.
3. **Add an "All / Core+Expansion" grouping.** Keep `'base'` and `'ragnarok'` as
   the granular facets but make the default/"complete" view explicitly the union.
   The filter already supports `'all'`; this is mostly about which view is
   primary and how completion is computed.
4. **Fold Ragnarök into base boosters.** Make base boosters pull from
   `set:'base' ∪ 'ragnarok'`. This is the big one: it changes **pack
   economics** (Ragnarök cards become obtainable from the cheap/default pack, so
   the dedicated Ragnarök booster loses its purpose or becomes redundant) and
   **collection math** (the "Base" completion denominator grows to include the
   69 Ragnarök cards). Small code (widen the pool filter), large product
   consequence.

### Cross-cutting consequences to weigh

- **Collection %.** Whatever "Base" means sets the denominator for pool-
  completion, which the shipped **achievements** catalog already keys off for
  pool-percentage goals. Folding expansion into base moves those thresholds.
- **Achievements.** Set-completion achievements ("complete Base", "complete
  Ragnarök") only make sense if the sets stay distinct; a union view needs its
  achievement definitions rethought.
- **Pack economics.** Only option 4 touches this, and it touches it hard — it's
  the difference between two priced products and one.

### SaveData impact

None forced. The collection is stored per card-id; set membership is derived from
`CARD_DB`, not persisted, so re-defining what "Base" *shows* or what a base
booster *contains* doesn't migrate the save. Future set-completion achievements
can reuse the v11 `achievements` save shape unless they add new reward state.

### Effort & risk

**Small code, real design call.** Every option except (4) is a filter/label/view
change; (4) is a one-line pool widening with outsized economic fallout. The risk
isn't the code — it's shipping a semantics decision by accident. **Open product
decision, and the gating one for this feature:** what should "Base Set" mean
relative to the expansion, and should Ragnarök stay a separately-priced /
separately-completed product? Resolve that first; the implementation follows in
an afternoon.

## Feature 5 — Limited public release (with a future expansion)

**Why deferred.** User decision 2026-07-10: Limited is code-complete and tested
(Sealed + Bot Draft, `SaveData` v14, `src/meta/Limited.ts`, four scenes,
`tests/meta/limited.test.ts`), but it isn't ready for players — PR #54 removed
its MainMenu entry, leaving everything else in place. It ships in its own
post-1.0 release alongside a future expansion, after more testing.

### Blockers to re-enable

- **Balance/economy.** Auto-built limited decks' balance texture has never been
  tuned with play data — run the balance harness against limited pools and
  revisit `ECONOMY.limitedRunGold` ([40, 100, 180, 300]) against the retuned
  9-card/450g constructed economy (the progression-sim harness from PR #35 can
  model the inflow).
- **General polish.** The Limited flow (reveal, draft picker, 40-card builder,
  three-match run) predates the 2026-07-10 UI-refresh theme system's duel-board
  rebuild; it needs a flow-polish pass to match the refreshed game.

### Re-enable mechanics

One line: restore the Limited entry in `MainMenuScene.ts`'s menu list (removed
in PR #54). Verify with a browser-preview probe of a full Sealed run and a full
Bot Draft run end-to-end. No save migration — the v14 `limited` block never
left the schema.

## Summary

| # | Feature | Deferral reason | Effort / risk | Touches an invariant? |
| --- | --- | --- | --- | --- |
| 1 | Practice opponent/persona picker | QOL, competes for menu space; backend already done | Medium / low | No |
| 2 | Battlefield drag-reorder | Determinism hazard; no display-order layer exists | Large / high | **Yes — seeded determinism** (must stay view-only) |
| 3 | Randomized tower tiers | Decouples rung from curated banding → balance re-validation; design undecided | Medium / balance-touching | **Yes — test-floor / balance gates** |
| 4 | "Base includes expansion" semantics | Product/data decision with pack-economy implications | Small code / real design call | No (but affects achievement completion math) |
| 5 | Limited public release | User-descoped from 1.0 (2026-07-10); balance/economy + polish before player exposure | Small re-enable / balance-touching | **Yes — balance gates** (limited-pool measurement before exposure) |

All five are off the 1.0 critical path by choice, per
[plan-road-to-1.0.md](plan-road-to-1.0.md). Features 3 and 4 are **blocked on a
product decision** and should not be built until it's made; Feature 2 is blocked
on nothing but should ride behind a view-only determinism test given the hazard;
Feature 1 is buildable whenever the menu has room for it; Feature 5 waits on
its balance/polish blockers and rides with a future expansion release.
