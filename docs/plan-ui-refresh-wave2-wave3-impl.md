<!-- source-of-truth: docs/plan-ui-ux-refresh.md, docs/architecture.md, src/scenes/DuelScene.ts, src/ui/BoardCardView.ts, src/ui/theme.ts, src/ui/themeWidgets.ts, src/ui/phaseTrack.ts, src/ui/KeywordIcons.ts, src/ui/handFan.ts, src/meta/SaveManager.ts, src/scenes/SettingsScene.ts, src/scenes/DeckBuilderScene.ts, docs/claude-playbook.md · last-verified: 2026-07-10 · implementation contract — re-verify when the referenced code changes -->

# UI refresh — Wave 2 & Wave 3 implementation contracts

Session-handoff document: everything a fresh orchestration session needs to
execute the remaining refresh waves without re-deriving context. The design
plan is [plan-ui-ux-refresh.md](plan-ui-ux-refresh.md); this doc is the
execution layer. Read docs/claude-playbook.md first, as always.

## State of the world (2026-07-09, Wave 2 shipped)

Shipped, in order: Wave 0 theme foundation (PR #40) · Wave 1 play-field
motion/depth (PR #41) · Wave 1.5a mirrored play-mat + phase track +
auto-skip cleanup (PR #42) · Wave 1.5b play-reveal transition + keyword
trait icons (PR #43) · Wave 1.5c layout polish: label purge, symmetric
plates, right sidebar (PR #44) · turn-pill/life-corner refinements (PR #45)
· **Wave 2** larger tiles (156×170 @ cy 389, pure unit-tested
`src/ui/rowPacking.ts`) + in-duel pause/end screens on `modalShell`
(which gained `dimAlpha`/`escToClose`/`depth` and an always-swallowing
dim; `themedButton` gained `setVariant`) — PR #47.
Wave 3 execution status (2026-07-10): ALL FOUR batches implemented on
branches stacked serially on the Wave 2 branch, every ladder green,
zero hex literals in every migrated scene, awaiting the PR-#47 merge
to open the PRs one by one: PR A DeckBuilder (−125 lines) · PR B
Shop/MainMenu/PackOpening (−209) · PR C Collection/Gauntlet/
Achievements/Profile (−113, one row recipe, 0.70/0.32 calibrations
kept) · PR D Settings two-column + both QOL toggles round-trip-probed
(single-tap concede honored live) + Limited×4 + CardShowcase.
LimitedReveal/Draft verified by review only (probing needs an active
run, which would mutate the save); flagged for eyes on deploy.

Shared modules that now exist and MUST be consumed (no new hex literals):
`src/ui/theme.ts` (tokens; Phaser-free import), `src/ui/themeWidgets.ts`
(themedButton / panel / modalShell / backButton / goldBadge / pager),
`src/ui/phaseTrack.ts`, `src/ui/KeywordIcons.ts`.

**Locked user decisions (do not relitigate):** modernize in place (no
re-wireframe) · refined-current art direction · larger battlefield tiles ·
stay 16:9 / 1280×720 (re-open resolution ONLY if Wave 2's measured tile
budget disappoints the user — their call, with evidence).

### Current duel geometry (the LAYOUT const, DuelScene.ts — verify on read)

| Element | Anchor |
|---|---|
| Opp plate / your plate | (108,16)–(1046,292) / (108,312)–(1046,532) — 20px inter-plate gap |
| Creature rows (both) | center x 577, usable 860, opp cy 200 (7px bottom inset) / yours cy 404 (7px top inset) |
| Tiles (BoardCardView) | 156×170, art window 148×162; packRow gutter 6px (tiles never touch) |
| Mana strips (clickable → lands modal) | yours left-aligned x0 210 cy 500 · opp right-aligned from x1006 cy 56 — land stacks are GONE (LandStackView deleted 2026-07-10) |
| Artifact/enchantment bands (non-creature permanents, 0.55-scale tiles, depth 4) | yours right-aligned ending x1006 cy 500, usable 380 · opp left-aligned from x120 cy 63, usable 380 |
| Portraits (200×180) | yours (14,540) · opp (1056,8) |
| Life squares (burn targets, depth 56, 40×40) | yours (40,566) upper-left inside portrait · opp (1230,162) bottom-right inside portrait |
| Turn pill / phase track | (1113,322) / (1113, 356..492 step 34) |
| Cluster / your piles / opp piles | End Turn (1108,548), smart circle (1108,642,r46) / icon stacks: yours x1242 (exile 482 hidden / deck 552 / grave 622) / opp x38 (hand 40 / grave 110 / deck 180 / exile 250 hidden) — `EXILE_ENABLED` gates both exile slots |
| Turn banner / forecast | (640,74) / (640,130) |
| Hand fan | rest bottom ≈714, base scale 0.46, fan top ≈521; no land badges since 2026-07-10 |
| Opp hand indicator | hand icon + count in the left pile column (the old (640,24) hand-backs strip is gone — 2026-07-10 follow-up) |

---

## Wave 2 — larger tiles + modal shell adoption — ✅ SHIPPED 2026-07-09

What remained of the plan's original Wave 2 after Wave 1.5 absorbed the
opponent identity block, the phase ribbon, and the control-cluster grouping.
**Landed at 156×170 @ cy 389, not the sketched 156×172 @ 390**: at tile
height 172 the plate-poke + land-overlap sum is a fixed 40px, so the two
budget caps below (≤8px poke, ≤30px overlap) cannot both hold — 170 is the
max height satisfying both (measured live: spans 304–474, poke 8px,
overlap 30px, five tiles full-scale at the 174 spacing cap).

### 2A. Larger battlefield tiles (the user's locked pick)

**The honest vertical budget — this is the hard part; put the final table
in the PR description:**

- Opp plate is 266px tall; a 180px tile at cy 214 spans 124–304 — fits.
- **Your plate is the constraint**: 220px tall; tile at cy 386 has only
  74px above (plate top 312) and 146 below. A 180-tall tile pokes 16px
  above the plate edge; today's 146-tall tile already overlaps your land
  thumb band (444–524) by ~15px where columns align (tiles draw over at
  depth 5 vs stacks 0 — existing, accepted).
- Realistic landing zone: **~156×172 at cy ~390** (≈4–8px plate-edge poke,
  which may read as intentional "pieces sit on the mat"), or 148×164 for
  zero poke. Growing your land overlap beyond ~30px or pushing `myLands.cy`
  past 492 (badge 516 vs fan top 521) is NOT acceptable without moving the
  fan — don't.
- Row packing: extract a **pure, unit-tested packing function** (slot
  centers for N tiles in `usable` width with shrink-to-fit below a spacing
  floor). 860px usable fits five 160-wide tiles at full size; 6+ shrink.
  Wire BOTH rows through it.

BoardCardView scaling: art window, name scrim, P/T badge, trait icon
column, aura badge, sick badge all scale/re-anchor from TILE_W/TILE_H
consts — keep them derived, not re-hardcoded. Input stays on the Zone
child (iron trap). CardZoomPreview, CombatFx, CoachMark read live
positions/bounds — no changes needed, but verify in the probe.

### 2B. In-duel modals onto `modalShell()`

The pause menu and the victory/defeat end screens are still hand-rolled
(the defeat screen had text/button collisions with board tiles in the
2026-07-09 baseline). Rebuild both on `themeWidgets.modalShell` +
`themedButton`: pause menu (Resume / Auto-skip / Sound / Music / matchup
subtitle / Concede with its two-tap arm), end screens (result, gold line,
Rematch / Menu, gauntlet recap variant with portrait). ModalGuard lists
stay scene-owned; every relabeled Text keeps its re-inflate call.

### Wave 2 verification gate

Ladder (tsc / lint / vitest / build / check-docs) + packing-function tests
+ live probe: crowded-board scenario (6–8 creatures per side — dev cheat
`__cheat.grantAllCards()` exists; or scripted casts), tiles inside plate
budget, both lives still targetable, pause + defeat screens on the shell,
tutorial boot, gauntlet-rung restart. Screenshot for the user's eyeball.

---

## Wave 3 — all-scene theme migration + Settings relayout

Mechanical consolidation; the 2026-07-09 design-system audit's numbers.
Suggested PR batching (each PR runs the full ladder):

1. **PR A — DeckBuilder** (~75 call sites; delete its four private button
   helpers: `action`, `modalButton`, `chip`, `deckCodeButton`; kill the
   cyan `#18c7d7` DOM-input styling — rename input + deck-code textarea
   restyle from tokens like SearchInput).
2. **PR B — Shop + MainMenu + PackOpening** (~35+35+30 sites; Shop tab bar
   and qty chips onto themedButton chips; MainMenu dailyButton polarity
   normalized to the primary variant; PackOpening batch/inspect buttons).
3. **PR C — Collection + Gauntlet + Achievements + Profile** (~30+30+20+12;
   one row-highlight recipe; Collection keeps its 0.70 backdrop dim — it is
   a deliberate legibility calibration against 0.32 unowned-thumb ghosts).
4. **PR D — Settings relayout + Limited×4 + CardShowcase** (~28+90+15).
   **Settings goes two-column** and exposes the existing
   `settings.confirmDestructive` and `settings.keywordReminders` toggles —
   this closes the last tracked QOL follow-up (plan-qol.md). Fields exist
   since v7/v8: NO schema bump.

Unify across all four PRs: `backButton()` (5 variants today → 1),
`goldBadge()` (3 formats → 1), headers to the type scale (H1s 26–72 →
`display`/`h1`), `pager()` (6 styles → 1), `modalShell()` (4 dim/close
recipes → 1), panel + row recipes to tokens. Backdrop dims normalize toward
0.45–0.55 art-visible EXCEPT documented calibrations (Collection family).
`index.html`'s rotate-overlay colors stay hand-synced to tokens (CSS can't
import theme.ts) — leave a comment pointing at theme.ts.

No engine/ai/meta/config changes anywhere in Wave 3. No SaveData impact.

### Wave 3 verification gate

Ladder per PR + a per-scene screenshot sweep (MainMenu, Shop both tabs,
Collection, DeckBuilder, PackOpening, Gauntlet, Settings, Achievements,
Limited hub, Profile) + the Settings toggles round-trip (flip → persists →
DuelScene honors confirmDestructive on Concede, keywordReminders on card
faces). Flag pure-taste items to the user; never fake-verify.

---

## Orchestration ops (learned this cycle, the hard way)

- **Duet**: Claude orchestrates, reviews, owns ALL git; Codex executes via
  the companion runtime:
  `node "C:/Users/Jim/.claude/plugins/cache/openai-codex/codex/<ver>/scripts/codex-companion.mjs" task --model <m> "<contract>"`
  launched through the `codex:codex-rescue` subagent (never
  `Skill(codex:rescue)` from inside the command — it re-enters).
- **Model choice**: `gpt-5.6-terra` died silently on 3 of 4 runs against
  the 3,400-line DuelScene; `gpt-5.5 --effort xhigh` also died once
  (post-implementation). For DuelScene-heavy waves expect deaths; for
  scene-by-scene Wave 3 files (<1,600 lines) terra has been fine.
- **Death diagnosis**: the status table lies ("running" zombies). Truth =
  job JSON `"pid"` (tasklist it) + log-file mtime (>10 min silent = dead).
  **Salvage protocol**: `git status` first — every death so far left
  usable-to-complete work in the tree; verify per-spec-item, finish gaps
  orchestrator-side, run the gate yourself. Never blind-relaunch over a
  dirty tree.
- **Watcher pattern**: background bash loop polling companion `status
  <job-id>` every 30s, ~17 laps per run (Bash timeout ceiling), relaunch
  per lap. Codex runs take 10–25 min.
- **Hidden preview pane**: RAF stalls (Boot/Preload hang, screenshots time
  out). Recipe: manual pump `setInterval(() => game.loop.step(t += 16.7),
  45)` + `loader.checkLoadQueue()` kick when `state===1 && inflight===0`,
  drive input by `obj.emit('pointerdown'/'pointerup', fakePtr)` with a
  full fake-pointer stub (`rightButtonReleased`, `leftButtonReleased`,
  `getDuration` included), verify by STATE (world transforms, text scans),
  and treat the deployed build as the user's visual surface. Vite reloads
  wipe `window` helpers — make probes self-contained per eval.
- **Git flow**: `main` is branch-protected (required `verify` check, direct
  push rejects with GH013). Branch → PR → `gh pr checks --watch` →
  squash-merge. Green main auto-deploys to Pages.
- **Session memory** lives in the Claude memory dir (`MEMORY.md` index →
  `project-decision-point.md` has wave status + these ops facts).
