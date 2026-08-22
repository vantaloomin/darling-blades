<!-- source-of-truth: docs/plan-1.6.md, docs/plan-1.6-large-set.md, docs/plan-dt-companion.md, src/meta/SaveManager.ts, src/config/features.ts · last-verified: 2026-08-22 · ruling record: committed 2026-08-22 from the session scratchpad so the calls survive; the to-do consequences are tracked in plan-1.6.md, never here -->

# Darling Blades 1.6 — open-decision rulings (chat session 2026-08-19)

**Committed 2026-08-22** (it lived only in a session scratchpad until then).
The rulings are the owner's and are locked; which of the §3 to-do items have
since landed is tracked in `docs/plan-1.6.md`, not by editing this record.

---

## 1. Status snapshot at the time of the ruling

- Branch `release/1.6` @ `6f28ac3`, in sync with origin, 26 commits ahead of `main`. No open PRs.
- Health: `tsc --noEmit` clean; `tests/data` + `tests/meta` = 753 passing / 55 files; `check-art-bible` 544/544; `check-docs` 0 warnings but 89 of 99 docs stale-stamped.
- **Uncommitted in the working tree:** Duat **Wave C, 28 cards** (`sd-jackal-priest-of-the-long-count` through `sd-empty-every-jar`) plus the matching test updates (`ALL_CARDS` 878, collectible pool 579). Green, but unlanded and currently braided with the art stream's files.
- Duat card data: **79 of ~245** (Wave A 18, Wave B 33, Wave C 28 uncommitted).
- Save version currently `CURRENT_SAVE_VERSION = 32`.

Lanes already closed: format gate (40 cards / hand 5 / uncapped reserve colors), the migration + classic retirement, priority-window reopening (rules rev 2 / replay v7), Premium UX Waves B and C (C pending owner device pass), eye-test batches 1-2, the returning-mechanics sprinkle (#229), cosmetics v1 (#233), and all three Duat engine mechanics (#223-#226).

---

## 2. The rulings (25 in this session, in the order they were asked)

### 2.1 Draft's reserve-native design → **editable reserve in the build step**

**Ruled:** keep the automatic reserve as the default, but expose the 10 land slots in the Limited build screen. The player sets the basic split and chooses which drafted duals ride.

**What already exists (don't rebuild it):** Limited is already reserve-native. `src/meta/Limited.ts` runs `LIMITED_DECK_SIZE = 25` spells with no lands; `limitedLandReserve()` grants a 10-land reserve derived from the deck's colors via `buildAiLandReserve`, with up to `MAX_DUAL_LANDS = 5` drafted duals slotted first. `completeDraftRun()` already threads a `selectedDuals` parameter through — an omitted selection defaults to the first five drafted dual occurrences, and an *explicit empty* selection already means "basics only". The plumbing for player choice is in place; what is missing is the UI that sets it.

**So the work is:**
- A build-step UI for the 10 reserve slots: basic-color split plus which of the drafted duals to include.
- Persist the selection on the `LimitedRun` (`run.landReserve` already exists on the type) so it survives save/load and feeds `landReserveOverride` into the duel.
- Keep the auto-build as the default fill, so a player who ignores the screen is never worse off than today.

**Explicitly NOT ruled in:** a dedicated land slot in Limited packs. Lands stay out of the pick stream, so pack composition, Premium's 45-kept-card value, and the 3.4% Premium shard cushion are all untouched — **no economy gate re-run needed for this item.**

**Why:** Draft becomes the place the Warchest is taught, and color-screw becomes a player decision instead of a builder decision, without moving any economy number.

---

### 2.2 Land cards' economy/collection treatment → **status quo**

**Ruled:** duals keep riding ordinary booster slots and keep requiring ownership to enter a Warchest. Basics stay free. No dedicated land slot, no free-infrastructure duals, no special land craft tier.

**Current shape (unchanged):** `packPool()` in `src/meta/PackOpener.ts` admits duals (`cost !== undefined || isType(d, 'land')`), excludes basics and tokens, and already excludes `isUtilityTapland`. `validateLandReserve` in `src/meta/warchest.ts` enforces `ownedCount` against every reserve entry.

**Zero implementation cost. Accepted risks, worth watching in the 1.6 balance pass:**
- Mana fixing is now mandatory infrastructure for every deck, and pack slots are what pays for it, so the cost lands hardest on a thin collection.
- That tax pushes the equilibrium toward mono decks. The format gate's clean 2026-08-07 run already measured a mono > 2c > 3c > 5c gradient, with **mono goodstuff around 73% in every config**, and flagged it as a card-pool problem for the migration balance pass. If the balance pass shows the dual tax deepening that gradient rather than the card pool doing it, this ruling is the first thing to reopen.

---

### 2.3 The 21 retired taplands → **one-time shard refund at migration**

**Ruled:** the next save migration converts every owned retired tapland to shards and removes the rows.

**The affected set (21 cards, all common, all already invisible to packs and to `collectionPct`):**

| Set | Cards |
| --- | --- |
| celtic-fae | `cf-mist-road`, `cf-mossy-ring`, `cf-raven-stone` |
| arthurian-court | `ac-bramble-chapel`, `ac-lowland-fort`, `ac-red-tournament-ground`, `ac-court-of-whispers`, `ac-mirror-lake` |
| gothic-monsters | `gm-moor-path`, `gm-chapel-yard`, `gm-lab-annex`, `gm-red-roof-village`, `gm-thorned-cemetery` |
| dark-tales | `dt-wolf-path`, `dt-palace-steps`, `dt-midnight-road`, `dt-sea-cave`, `dt-hearth-cinders`, `dt-winter-bridge`, `dt-desert-rooftop`, `dt-riverbend-trail` |

They are caught today by `isUtilityTapland()` in `src/meta/warchest.ts` (non-token, non-basic, produces at most one color) and filtered out of `packPool`, `Collection.ts:137`, and `collectionFilter.ts:96`.

**Work implied:**
- `SaveData` version bump **32 → 33** with a real `migrate()` plus test (iron invariant).
- Refund maths should reuse the existing manual-shard formula — `ECONOMY.dupeGold[tier] × shardFrameMult × shardHoloMult`, with `shardFullArtMult` where it applies — so premium tapland printings are not refunded at plain rates.
- Price the total refund against the Layer-1 economy bands and re-run the economy gates: this is a one-time faucet, and the gates are locked.
- Player-facing copy for the conversion (no em-dashes; house style).
- Decide whether the refund is silent or shown once at load. Recommendation: a single one-time notice, so the value is visibly honored rather than quietly deposited.

**Payout shape RULED in 2.11:** shards at the full manual-shard rate. See that entry for the consequence.

---

### 2.4 1.6 scope → **hold full scope as ratified**

**Ruled:** no cuts to the card content. 245-card Duat plus the ~60-card Dark Tales companion wave plus the small-debts batch, then **one** balance pass at the end. (Courts was in this scope when the question was asked and was subsequently cut to 1.7 in 2.8 — the card scope is what was held.)

**Remaining author volume: ~226 cards.** 166 Duat (245 target minus the 79 authored) plus ~60 companion.

**What this preserves:** the single-baseline principle the 1.6 north star was written around ("all 1.6 balance work happens once, on the reserve field"), the "first large set at 2x the 120 template" framing from the concretion, and the companion wave's two documented balance debts (Midnight Storybook's thin pool, the R19 inversion's in-color tools).

**What it costs:** the balance pass cannot begin until the last card lands, so card authoring is the critical path end to end.

---

### 2.5 The 39% inert-permanent finding → **hard cap on ETB-only permanents in Duat, enforced by a test**

**Ruled:** Duat authors under a ceiling on ETB-only non-creature permanents, and the ceiling is enforced by a detector in the suite the way the Duat liveness gate is.

**The number being fixed:** 39% of our non-creature permanents do nothing after the turn they land, against 0% in the 8th/9th/10th-edition target era and 2% across all of Magic. It is the card-health audit's single most important structural finding, and it is a design-pattern finding rather than a per-card one.

**Why it is urgent now rather than later:** Duat's frame allocates **21 artifacts** (DARK-scale, deliberately, because relics feed Rite fodder and Preserve value). DARK's artifact wave is exactly where the 39% came from. Authoring 21 more artifacts without the rule reproduces the pattern at scale.

**Work implied:**
- Pick the ceiling number. The audit does not name one; 10-15% of Duat's non-creature permanents is the band I would propose against a 0-2% precedent.
- A detector test (the `inert` detector already exists in the workbench tooling — check whether it can be lifted into the suite rather than rewritten).
- Applies to the ~226 cards still to author, so it wants to land **before** Wave D.

---

### 2.6 The 1.6 dup-audit adjudication → **the full triage list**

**Ruled:** everything in the audit lands in 1.6 — the urgent five, the named duplicates, the blank artifacts, and the ~50 dominance/costing triage cards.

**The urgent items, with fixes already specified in `balance/card-health-audit.md`:**

1. **Divination and Lava Axe** — 1:1 reproductions of real Wizards commons (same name, cost, rarity, type, effect) in a public repo whose `main` auto-deploys to Pages. The project already did this rename by hand in commit `2fe9a33` (PR #73, Rampant Growth → Verdant Invitation, Raise Dead → Summon the Dead) **four lines away in the same file** and missed these two. Fix: rename `name` at `src/data/cards/sorceries.ts:12` and `:47` only, **ids untouched** (`so-divination`, `so-lava-axe` are opaque save keys) — migration-free, test-safe, deck-safe, art-safe. Two constraints: the new names must fit the existing art (a scrying pool over still water; a molten axe hurled at a fortress), and `docs/spell-art.md` plus `docs/plan-commander-mode.md` headings sync in the same commit. Do NOT rename the other 12 name collisions — all differ on cost and effect, and Peach Garden Oath is public-domain Three Kingdoms and load-bearing set identity. The guard should be a **functional-collision** check (same name AND cost AND rarity band AND translated type, using `type_line_mtg`), which returns exactly these two today and zero after the rename.
2. **Fogbell Chime / Glimmerdust Trick** — byte-identical Silver Veil `{U}` commons 95 lines apart (`celtic-fae.ts:308-311` and `:403-406`). Documented implementation drift: the set's own table already specifies Fogbell Chime as an Artifact. Fix: restore it to a common Artifact doing blue utility. `deck_count 0`, nil blast radius. Do NOT use the originally-proposed Take into Custody text (2017 rate; the target era has no 1-mana blue instant tapper). Process trap: `docs/expansions/celtic-fae.md` is hand-maintained and NOT covered by `gen-docs-tables.ts`, so `check-docs` will not catch a missed table update.
3. **4 cards whose text can never resolve.**
4. **28 blank artifacts** — overlaps directly with 2.5's ceiling.
5. **21 taplands** — already ruled in 2.3.

**Then the named duplicates and triage:** Lake Attendant / Prophecy Attendant (fix: Prophecy Attendant pays off its name with a Quest-conditional Foresee 2; also a tooling fix — key the `dupes` subtype axis on the ~11 payoff tribes, not on any subtype string), Candle in the Window / Candlelit Vigil, Zhang Jiao (a rare vanilla beaten by seven commons at the same cost in its own set; give it text at `{1}{B}` rare, do not just bump the body to 2/2 — three commons are already `{1}{B}` 2/2 vanillas), and the ~50 dominance/costing cards including the Wolfsbane Ward and Laughing Pooka watchlist.

**Cost accepted:** this is a real corpus pass, and it implies a re-measure that the single 1.6 balance pass has to absorb. Most of the named fixes are `deck_count 0`, which limits how much actually moves.

---

### 2.7 Nine Lives × Empower marks → **the tension is intended design**

**Ruled:** the anti-synergy is the cost. Nine Lives decks pay by giving up mark payoffs, and that is a legitimate deckbuilding choice. Author Wave D+ freely into that space; the balance pass confirms it is not degenerate.

**What this unblocks:** the mechanical plan's instruction to decide before authoring any Empower-marks card next to Nine Lives is now answered, so Wave D+ is not gated on a targeted matrix.

**What the balance pass still owes:** the plan's measurement list is unchanged and still runs — Rite cast rate by AI tier (against the Midnight Storybook 6.7% cautionary bar), Nine Lives × marks win-rate delta (now a confirmation rather than a gate), Preserve activations per game measured as a package, the 28-deck archetype layer, and twinBlades anthem stacking in the Bastet list. Reversible if the pass shows it degenerate.

---

### 2.8 Courts → **deferred to 1.7**

**Ruled:** Courts does not ship in 1.6. Cosmetics v1 (#233) already shipped with the unlock seam, so Courts can land later without rework.

**Why it is a clean cut:** it is the largest remaining UI item on a train already carrying ~226 cards plus a full card-health pass, and its prerequisite is satisfied rather than pending.

**Carry these notes forward to the 1.7 build:**
- The cheap path (S) is `completion.bySet` (~8 lines, headless, testable) plus 28 milestone AchievementDefs on the shipped claim plumbing. Milestone claim state needs a SaveData bump with a real `migrate()` and test.
- The **100% reward is flagged DANGEROUS**: a special-variant copy is a shard-farm vector at 500 × 15 × 12. The audit's mitigations are a fixed mid-tier variant, a non-shardable copy, or a display copy outside shard accounting. Recommendation on record: **the display copy — trophies should not be liquid.** Not ruled, because Courts moved out of scope.
- The 75% gold reward needs modeling against the dated day-60 baseline before it ships.

---

### 2.9 Dark Tales companion wave scope → **lightweight frame, debts first**

**Ruled:** one short plan doc fixing the rarity and color frame plus a one-line theme (the Dark Tales voice already exists, so no full creative concretion), then author the two balance debts first and fill the rest to frame.

**The debts it exists to pay:**
- **Midnight Storybook**: 30.5% over 13,500 games at 300 seeds per cell, against a requested 40-55% band. Improved from 6.7% but still the honest miss. It wants sharper Dark Tales tools, in its colors.
- **The R19 inversion**: in-color answers.

**Not doing:** a full Duat-style concretion gate. It is a retrofit pilot inside an established set, not a new set.

---

### 2.10 The inert-permanent ceiling → **15%**

**Ruled:** no more than 15% of Duat's non-creature permanents may be ETB-only, enforced by a detector test.

Roughly a third of our current 39%. Leaves room for a handful of deliberately simple commons without letting the pattern spread, and it is achievable while authoring 21 artifacts, so it should not force awkward text onto cards that do not want it. Precedent for reference: 0% in the 8th/9th/10th-edition target era, 2% across all of Magic.

---

### 2.11 Tapland refund shape → **shards at the full manual-shard rate**

**Ruled:** the existing `dupeGold[tier] × shardFrameMult × shardHoloMult` formula exactly (with `shardFullArtMult` where it applies), so a premium tapland printing refunds at premium value. Most honest to what the player owned.

**Consequence to manage, not re-decide:** this is the largest version of the faucet, it lands directly on the crafting sink, and crafting is explicitly an endgame sink. The economy gates are locked, so the total must be priced and the gates re-run. If the gates break, the fix is elsewhere in the economy, not a quieter refund.

---

### 2.12 Wave D+ batching → **owner declined; the running stream owns it**

Wave sequencing for the remaining 166 Duat cards is handled automatically by the parallel authoring stream. No owner call, no batching scheme to impose. Removed from the owed list.

---

### 2.13 Duat booster SKU → **525g, the standard expansion price**

**Ruled:** Duat sells at 525g with the standard pack size — the same as every other expansion, no exceptions, no economy re-derivation.

**Correction on record:** this was first asked with the wrong premise ("every set is 450g"). The real prices are **base 450g, every expansion 525g** (`ECONOMY.packPrice` vs the six per-set entries at `rules.ts:47-53`). The precedent is strong for uniformity: a 70-card Ragnarök pack and a 120-card Dark Tales pack are both 525g, so **set size has never moved the price**. Ruling re-confirmed against the corrected facts.

**Accepted consequence:** at 2x the pool and the same price and pack size, a player completes Duat at roughly half the rate of Yokai Nights. That is the endgame-set position, and `collectionPct` already counts absolute cards, so the metric handles it honestly.

**Work owed (currently missing entirely):** Duat has a `SET_IDS` entry and a `SET_TITLES` entry, but **no `BoosterSku` member** (`src/ui/OddsModal.ts:10` still lists seven sets), no `PACK_ODDS_META` row, no pack art constant in `PackOpeningScene.ts`, and no shop tile. All of that is 1.6 work.

---

### 2.14 `FEATURES.duatLive` → **flip once, at release**

**Ruled:** the whole 245-card set appears at 1.6 launch. The single balance pass measures exactly the pool that ships, and the set stays a launch reveal.

**Consequence to plan around:** the flag stays `false` through the whole authoring run, so nothing Duat-facing is exercised in the real client until the end. Compensate with the local-dev flip and the browser module probe rather than by weakening the gate. The liveness test (`tests/meta/duatLiveness.test.ts`) is what keeps the gate honest meanwhile.

---

### 2.15 Companion wave set identity → **extend `dark-tales` in place**

**Ruled:** the ~60 cards carry `set: 'dark-tales'` and drop into the existing booster pool. This is the whole point of the debt payment: Midnight Storybook's sharper tools become pullable from the pack that needs them, so set self-sufficiency improves directly.

**Consequence:** the Dark Tales set grows 120 → 180, which moves its completion goals and achievement thresholds. See the open follow-up in §4 about players who have already completed Dark Tales.

---

### 2.16 Duat achievements → **the full theme family, matching shipped sets**

**Ruled:** headliner ownership, special-variant tier, rainbow-border tier, and completion goals — the same shape Dark Tales and Nocturne Manor carry. Consistency across sets, and the biggest set in the game gets something to chase even with Courts deferred.

**Work:** achievement data plus a Duat headliner array, on the shipped claim plumbing. `AchievementDef.progress` already takes the completion summary. Mechanic-specific goals (win with a Rite deck, N Nine Lives triggers) were NOT ruled in — they would need engine-side counters that may not exist.

---

### 2.17 Dark Tales achievement regression → **claimed stays claimed, goals widen for everyone else**

**Ruled:** a claimed achievement never un-claims. The underlying goal counts the full 180 cards for anyone who has not finished yet.

**Good news — this is already how the plumbing works.** Verified in `src/meta/Achievements.ts`: `evaluateAchievements` computes `unlocked: unlocked.has(def.id) || current >= target`, so `unlocked` is sticky from the persisted array rather than recomputed from live progress, and `syncAchievements` only ever dedups and filters unknown ids — it never removes an unlocked entry. `claimed` is filtered to ids present in `unlocked`, which stays satisfied. **So the ruling costs a regression test, not an implementation.**

**One display consequence to check by eye:** a player who claimed `theme-dark-tales-complete` will keep the claimed state while the progress bar underneath reads something like 120/180. Worth confirming that reads as "claimed, and there is more now" rather than as a bug.

---

### 2.18 Duat mechanic-family goals → **yes: Rite, Nine Lives, Preserve, and Bastet**

**Ruled:** four extra goals on the ownership-filter pattern Dark Tales already uses (`themedCollectionProgress` with a predicate like `card.skim !== undefined`). No engine counters involved, so this is cheap achievement data.

Matches precedent exactly: Dark Tales ships `theme-dark-tales-skim`, `-retell`, and `-mermaids` on the same shape. A Rite-deck *play* goal was considered and NOT ruled in — that is the one variant that would need engine-side counters.

---

### 2.19 Duat in the Limited pool → **let it in, and re-measure draft-pick composition**

**Ruled:** Duat joins mixed-set Limited like every other set (which happens automatically — `packPool` with no set argument is the mixed pool, so the `duatLive` flip does this by itself), AND the draft-pick composition gets re-measured in the same pass.

**Why the re-measure is mandatory, not optional:** the pool expands roughly 30% in one step. Premium Draft's 1000g entry is pinned against a measured 966.5g shard EV — a **3.4% cushion** held by `economyGates`. Duat also adds 5 common duals and 21 artifacts, which changes pick quality directly. **Re-running the economy gates is a hard release prerequisite.**

**Bonus:** the same measurement replaces the stale "6.2% of draft picks are nonbasic lands" figure in `plan-1.6.md` (see §4).

---

### 2.20 Metagame deep sweep → **it runs for 1.6**

**Ruled:** the multi-hour persona sweep runs. A game-wide mana system change plus a 245-card set plus a retired format is the largest metagame shift the project has shipped, and that is what the sweep exists for. It was waived for 1.5; it is not waived here.

**Operational constraints (unchanged standing rules):** it runs **last**, after the balance pass and after the field stabilizes, never as a mid-train gate. It needs an idle machine — the CPU cap is 65% (3 balance lanes max), and the full suite alone runs ~3 minutes at pool 638 and should not share the box with sweeps.

**History worth carrying in:** the 1.4 release sweep hit max-rounds without converging, which is why the loop was ruled informational-only on 2026-07-28. Running it is now decided; whether a non-converging result can block the release was not asked and is not currently blocking anything.

---

### 2.21 Avatar and starter decks vs the Duat pool → **regenerate, plus new Duat-themed avatars**

**Ruled:** run the deterministic builders over the full post-Duat pool and commit the result, AND add new avatars built around the Duat archetypes.

**Why this is forced work rather than optional:** the builders re-pick from the whole pool (`CARD_DB`), and a test asserts committed data equals builder output. Once `duatLive` flips, leaving the decks unregenerated is not a stable state — the test would fail. The only real choice was regenerate vs pin, and the ruling is regenerate.

**Consequences:**
- All 20 avatar decks change at once, so the **entire ladder re-measures** in the balance pass. The dated 2026-08-09 reserve baseline is superseded by that re-measure.
- New Duat-themed avatars should follow the §3 archetype list the plan already demands as authored decks for the 28-deck measurement layer: **Rite engine, Nine Lives attrition, Preserve value, Empower ramp, Bastet tribal.** Building them as avatars and as the measurement layer is the same work done once.
- **Trap from the plan, do not rediscover it:** the deck builders are archetype-blind, and the Warchest converter's curve cap `{4:10, 5:4, 6:2}` deletes the expensive payoffs a reanimator or ramp deck exists to cheat into play. Hel is hand-built and exempt for exactly this reason. A **Rite engine** or **Preserve value** avatar is likely to need the same exemption — and the standing rule is that a hand tune only earns its exception while it still measures better than the builder (Hel's lost 21 vs 33 and was dropped; Morgan's won 52 vs 46 and was kept).

---

### 2.22 Merge cadence → **one merge at release**

**Ruled:** `release/1.6` stays a long-lived branch and lands as a single release PR when the train is done. Clean release boundary; nothing half-finished reaches production.

**Accepted cost:** a very large final PR and a long divergence from `main` (already 26 commits). Finished work — cosmetics v1, Premium UX Waves B and C, the migration, the sprinkle — stays undeployed until the release cut.

**Mitigation worth doing anyway, since it does not violate the ruling:** merge `main` INTO the branch periodically if anything lands on `main` independently, so the final merge never becomes a conflict archaeology project.

---

### 2.23 What "fixed" means for mono goodstuff → **relative, not absolute**

**Ruled:** success is the **gradient flattening** — mono must stop being strictly best — rather than any particular win-rate number. The measured shape to break is mono > 2c > 3c > 5c.

**Why this framing:** it targets the actual complaint (the format collapsing to one shape) rather than a number that may not be the real problem. The format gate already refuted the five-color-pile fear and measured ~21% color-stranded turns for greedy piles, so the fix is making 2-3 color competitive, not punishing mono.

**Implementation note:** this is harder to express as a CI gate than a win-rate band, so expect the gate to stay a floor on individual archetypes while the gradient check lives in the balance-pass report. Do not let that turn it into an unmeasured claim — the gradient should be a printed number in the pass output.

---

### 2.24 Sweep authority → **informational, never blocks the cut**

**Ruled:** the metagame sweep runs (2.20), its results are read and filed, and the release ships regardless of what it says. Consistent with the 2026-07-28 ruling that the loop stays informational-only.

Anything alarming it surfaces becomes 1.6.5 or 1.7 work rather than a hold on 1.6.

---

### 2.25 Doc hygiene → **full re-verification sweep before the cut**

**Ruled:** walk all 89 stale-stamped docs and re-stamp them before 1.6 is cut. The docs are the spec on this project, and a release is the honest moment to make that true again.

**Cost accepted:** real hours, competing directly with authoring ~226 cards. Worth sequencing as a late lane rather than a final-week scramble.

---

### 2.26 Desktop build → **cut an NSIS installer with the release**

**Ruled:** 1.6 ships a Tauri desktop build alongside the web deploy.

**Prerequisites to line up EARLY, not on release day:** the build box needs Rust plus MSVC (see `docs/desktop-build.md`), and the installer is large (~260 MB). Add a real verification pass on the actual desktop window to the release checklist — the Tauri shell has its own resolution-clamping behavior that the web build does not exercise.

---

### 2.27 Teaching the Duat mechanics → **card text carries it, no tutorial change**

**Ruled:** the tutorial stays pinned exactly as it is. It teaches the mana system, which is the hard part, and Rite / Nine Lives / Preserve teach themselves through card text the way every previous set's keywords have.

**Why this is the safe call:** the tutorial line is pinned to rules revision 1 with seed 2 holding the whole script, and the 1.6 rewrite established that no beat after the land drop changed. Touching it re-opens all of that for a benefit card text already provides.

**Not ruled but nearly free, worth doing anyway:** make sure all three mechanics land in `docs/keyword-map.md` and carry solid reminder text, which is the discipline the existing keywords already follow.

---

## 2A. Roadmap changes beyond 1.6 (ruled this session)

These came out of the parked-items question and reshape the road past this train. **None of them change 1.6's contents.**

### 2A.1 Multiplayer → **removed: P2P and spectating both cut**

**Ruled:** drop the 1.9 P2P multiplayer and spectating items, and drop the DECIDE-BY-1.8 P2P trust-model decision along with them.

**Explicitly KEPT:**
- **Cloud save sync stays at 1.8**, on its own merits — cross-device save portability is useful in a single-player game, and it is the natural growth of 1.5's export/import codes.
- **The seeded-deterministic engine and `PlayerView` redaction stay.** They were lockstep-ready foundations, but they are good engine hygiene independent of networking, and the AI-reads-only-redacted-state rule is an iron invariant.

### 2A.2 Story Mode → **moves from 1.7 to 1.9**

**Ruled:** Story Mode vacates 1.7 and takes the freed 1.9 slot, with more runway to be a bigger feature. **1.7 then leads with Expansion 8 plus the accessibility wave** (colorblind-safe mana/rarity cues, text scaling), plus the two parked items below.

Note the knock-on: the DECIDE-BY-1.7 **localization** question (every string is hardcoded English; "English forever" is a valid answer but must be chosen) is unaffected and still due at 1.7 — and it matters more now that 1.7 is the accessibility release.

### 2A.3 The two parked items → **both land in 1.7**

**Ruled:** suggested decks v1 and player-facing replays v1 both go to 1.7, resolving two releases of drift.

- **Suggested decks v1** — deferred from 1.6 as asked.
- **Player-facing replays v1** — no longer paired with spectating, which is now cut. Most of the work is presentation: the replay layer already runs at v7 with byte-identical action streams. It also feeds the 2.0 persona tutor (a replay-annotating coach), so building v1 at 1.7 gives that two releases of runway.

**Resulting shape:** 1.7 = Expansion 8 + accessibility wave 1 + suggested decks v1 + replays v1 (+ the localization decision) · 1.8 = mobile overhaul + Expansion 9 + cloud save sync · 1.9 = **Story Mode** + Expansion 10 · 2.0 = MOD/UGC + Core Set II + persona tutor.

### 2A.4 Expansion slate → **order the remaining concepts now; the fourth falls past 2.0**

**Ruled:** pick an explicit order for Expansion 8 (1.7), 9 (1.8), and 10 (1.9), and let the fourth concept sit post-2.0 rather than being cancelled. This makes real what the original slate already said — five concepts for four slots, one falls past 2.0 — now that Egyptian has been consumed by Duat in 1.6.

**Remaining concepts:** Cosmic Horror · sci-fi alien girls · prehistoric cavewomen + dinosaurs · steampunk. (Slavic, Mesoamerican, and Hindu-epic were passed on 2026-07-24 and stay passed on.)

**Order ruled 2026-08-19:**

| Slot | Release | Concept |
| --- | --- | --- |
| Expansion 8 | 1.7 | **sci-fi alien girls** |
| Expansion 9 | 1.8 | **Cosmic Horror** |
| Expansion 10 | 1.9 (with Story Mode) | **steampunk** |
| — | post-2.0 | prehistoric cavewomen + dinosaurs |

Sci-fi first is the biggest visual departure from everything shipped, which makes it the strongest growth statement right after a large mythological set. It is also furthest from the established art bible, so **the art pipeline works hardest first** — worth knowing while Duat's art stream is still fresh in mind.

Note against 2A.4's own logic: steampunk at 1.9 means the artifact-family debt the card-health audit names (39% inert permanents, 28 blank artifacts) does not get its structural home until then. The 2.10 ceiling and the 2.6 triage pass are what carry that in the meantime.

### 2A.5 Version → **1.6.0, marketed as the big one**

**Ruled:** ship as 1.6.0. Every doc, plan, branch, and decision record since 2026-07-31 calls this train 1.6, and renaming it invalidates that history for a cosmetic gain. The scale gets acknowledged where players actually read it — release notes and README frame it as **the Warchest release**, not as "version 1.6".

`package.json` still reads 1.5.5 and gets bumped at the cut.

---

### 2.28 Duat precons → **a curated subset ships in the shop**

**Ruled:** two or three of the five Duat archetype decks ship as buyable theme decks; the rest stay measurement-only lists.

**Why this is cheap:** all five decks have to exist regardless for the 28-deck measurement layer (Rite engine, Nine Lives attrition, Preserve value, Empower ramp, Bastet tribal). Promoting a subset is packaging and pricing, on the shipped `ECONOMY.preconPrice` / `buyDeck` plumbing.

**Why a subset rather than all five:** a purchasable deck is one players judge you on, so each one shipped is balance surface. Fewer, better on-ramps.

**Ruled 2026-08-19: the two shipped precons are Bastet tribal and Rite engine.** The headline tribe and the headline mechanic — Bastet is the set's aggressive spine (34 creatures, W/R center of mass) and the most legible deck a new player can pick up; Rite is what the set is named around. Nine Lives attrition, Preserve value, and Empower ramp stay measurement-only.

**Watch item:** the plan warns the deck builders are archetype-blind and the Warchest converter's curve cap `{4:10, 5:4, 6:2}` deletes expensive payoffs. A **Rite engine** precon is the most likely of the two to need the hand-built exemption Hel has — and the standing rule is that a hand tune only earns its exception while it still measures better than the builder.

---

### 2.29 Warrior as a tribe → **deferred, with a trigger**

**Ruled:** decide after the Duat balance pass reads Bastet. If Bastet underperforms in the W/R aggressive space, a Warrior tribe is a lever; if Bastet holds or dominates, the question answers itself.

This is a deferral with a **specific trigger** rather than an open-ended one, which is the fix for an item the tribal pass has carried across several trains. The overlap is real: Bastet ships 34 creatures with a W/R center of mass plus 3 typal payoff statics, into exactly the space a Warrior tribe would occupy, and the Bastet Axis was added under tribal governance that exists to prevent that kind of collision.

---

### 2.30 Settings toggles → **ruled to expose both; ALREADY SHIPPED**

**Ruled:** expose `confirmDestructive` and `keywordReminders` in Settings, doing the relayout in 1.6.

**No work required — this is already done.** The QoL doc's "still open" entry is stale. `src/scenes/SettingsScene.ts` carries both toggles (lines ~203 and ~210, with the sync pairs at ~355), and the roadmap records the Settings two-column relayout as shipped, explicitly noting it "closed the last QOL follow-up: in-Settings `confirmDestructive` + `keywordReminders` toggles".

**Action:** strike the stale "Still open" item from `docs/plan-qol.md` during the doc sweep (2.25). The ruling's substance is satisfied — reminder text, which the teaching ruling (2.27) depends on, is already player-controllable.

---

### 2.31 Collection / deck-builder filter state → **persist fully, saved to the profile**

**Ruled:** filter state is durable across sessions, not just across scene exits. Strongest quality-of-life for a collection that reaches 878 cards in 1.6.

**Work:** a `SaveData` bump with a real `migrate()` and test. **Consolidation opportunity:** this can ride the same version bump as the tapland refund (2.3/2.11) rather than spending two — one v33 carrying both the refund and the persisted filter state.

**Risk to design against:** a player returning after a week to a filtered view can read it as missing cards. Even though the plain-persistence option was ruled rather than the "visible clear affordance" variant, make sure the active-filter state is unmistakable on entry.

---

## 3. What the rulings add to the 1.6 to-do list

**New work created by these decisions:**

1. Limited build-step reserve editor (UI plus persistence on `LimitedRun`). No economy re-run (2.1).
2. **Save v33**, carrying BOTH the tapland shard refund (2.3 / 2.11) and persisted collection/deck-builder filter state (2.31) — one migration, one test, rather than two version bumps.
3. **Inert-permanent ceiling at 15% plus a detector test — before Wave D**, since it constrains the ~226 cards still to author (2.5 / 2.10).
4. **The full card-health triage pass**, Wizards renames first (2.6).
5. **Duat shop presence, currently missing entirely**: a `BoosterSku` member, `PACK_ODDS_META` row, pack art, and shop tile at 525g (2.13).
6. **Duat achievement family**: headliners, variant tiers, completion, plus four mechanic/tribe goals (Rite, Nine Lives, Preserve, Bastet) (2.16 / 2.18).
7. **Regenerate all 20 avatar decks and the starters**, plus new Duat-archetype avatars doubling as the 28-deck measurement layer (2.21).
8. **Two Duat precons** in the shop: Bastet tribal and Rite engine (2.28).
9. **Dark Tales companion wave**: a lightweight frame doc, then ~60 cards authored debts-first, carrying `set: 'dark-tales'` (2.9 / 2.15).
10. **Economy gates re-run**, driven by three separate changes: the tapland refund faucet, the Limited pool expanding ~30% with Duat, and the draft-pick composition re-measure (2.11 / 2.19).
11. **Full doc re-verification sweep** across all 89 stale-stamped docs before the cut (2.25).
12. **Tauri NSIS installer** cut with the release; line up Rust + MSVC on the build box early (2.26).
13. Regression test that claimed Dark Tales achievements survive the 120 → 180 expansion (2.17 — the plumbing already behaves correctly).

**Removed from 1.6 by these decisions:**

14. **Courts → 1.7** (2.8). Cosmetics v1 already shipped the seam, so no rework cost.
15. **Suggested decks v1 → 1.7** (2A.3).

**Already-known work these do not touch:**

16. ~226 more cards (166 Duat, ~60 Dark Tales companion). Wave sequencing is owned by the running stream (2.12).
17. Small-debts remainder: Limited retune, modalShell dismiss consolidation, scoreLand rider credit.
18. The single 1.6 balance pass once the pool is final — the five Duat measurements, the full ladder re-measure the avatar regeneration forces, and the mono-gradient read.
19. Metagame deep sweep, last, informational only (2.20 / 2.24).
20. Release mechanics: bump `package.json` from 1.5.5 to 1.6.0, release notes framing it as **the Warchest release**, roadmap close-out (2A.5).
21. Owner device pass on Premium UX Wave C.

**Immediate housekeeping, not a decision:** land Duat Wave C as its own commit. It is authored, tested, and green, and it currently shares a working tree with the art stream's files.

---

## 4. Roadmap after 1.6 (as re-ruled this session)

| Release | Contents |
| --- | --- |
| **1.7** | Expansion 8 = **sci-fi alien girls** · accessibility wave 1 · **suggested decks v1** · **player-facing replays v1** · **Courts** · DECIDE-BY: localization |
| **1.8** | Mobile UX overhaul · Expansion 9 = **Cosmic Horror** · cloud save sync |
| **1.9** | **Story Mode** (moved from 1.7) · Expansion 10 = **steampunk** |
| **2.0** | MOD/UGC packs · Core Set II · the persona tutor |
| post-2.0 | prehistoric cavewomen + dinosaurs |

**Cut entirely:** P2P multiplayer, spectating, and the DECIDE-BY-1.8 P2P trust-model decision. Cloud save sync and the seeded-deterministic / `PlayerView` discipline both stay.

---

## 5. Still owed, and what is not a decision

**Decisions still owed:**

- **Whether Warrior becomes a tribe** (2.29) — deferred with a trigger: decide once the Duat balance pass reads Bastet in the W/R space.
- **The Courts 100% reward form** (2.8) — moot until 1.7. Recommendation on record: the non-liquid display copy, since trophies should not be liquid.

**Reads to take during the balance pass, not decisions to make now:**

- Whether the dual-land pack tax is deepening the mono gradient (2.2).
- Whether the Nine Lives / Empower-marks tension is degenerate rather than interesting (2.7).
- Whether the gradient actually flattens — mono must stop being strictly best (2.23).

**Judged NOT to need an owner call:**

- Limited retune, modalShell dismiss consolidation, scoreLand rider credit — mechanical.
- Wave D+ card batching — owned by the running authoring stream (2.12).
- The Premium UX Wave C device pass — needs your hands, not a ruling.
- Landing Duat Wave C as its own commit — housekeeping.

---

## 6. Stale facts found while sweeping (fix during the doc sweep)

1. `docs/plan-1.6.md` still records "6.2% of draft picks are nonbasic lands that reserve-native Limited cannot play." That predates BOTH the dual-selection feature (duals are playable now, up to 5 per reserve) and the exclusion of utility taplands from `packPool`. The 2.19 re-measure replaces it.
2. `docs/plan-qol.md` lists the `confirmDestructive` / `keywordReminders` Settings toggles as "still open". They shipped with the Settings two-column relayout (2.30).
3. `docs/plan-1.6-draft.md` and `docs/plan-1.6.md` list the parked roadmap items and the small-debts batch in forms these rulings supersede.
