<!-- source-of-truth: src/scenes/DuelScene.ts, src/ui/BoardCardView.ts, src/ui/handFan.ts, src/ui/CombatFx.ts, src/ui/CardView.ts, src/ui/Dropdown.ts, src/ui/binder/FilterBar.ts, src/ui/SearchInput.ts, src/ui/SceneBackdrop.ts, src/ui/HistoryPanel.ts, src/ui/CommanderPortrait.ts, src/ui/LandStackView.ts, src/ui/PileView.ts, src/platform/gestures.ts, src/platform/renderScale.ts, src/scenes/MainMenuScene.ts, src/scenes/SettingsScene.ts, src/scenes/DeckBuilderScene.ts, index.html, src/main.ts, docs/architecture.md · last-verified: 2026-07-09 · design/plan doc — re-verify when the referenced code changes -->

# UI/UX refresh — theme system + play-field modernization

User verdict (2026-07-09): the UI "feels dated and clunky, especially the play
field." Two code audits ground this plan: a DuelScene composition map and a
cross-scene design-system inventory. Locked user picks (2026-07-09, not to be
relitigated): **modernize the Immersive Fan in place** (no re-wireframe),
**refined-current art direction** (keep dark-violet + gold + Cinzel identity,
consolidated into a real token system), and **larger battlefield tiles**.

## What the audits found

**Play field — "clunky" is mostly missing motion, not layout.** The hand fan
is destroyed and rebuilt on every sync (`DuelScene.syncHand`), so drawn/played
cards pop in with zero animation and nothing ever travels from hand to
battlefield. Hand hover snaps instantly (no tween). Land stacks and mana pips
rebuild in place. Life totals change via bare `setText`. The block/targeting
arrows are flat 4px `lineBetween` strokes. Zone plates are flat 1px-stroked
rects over a backdrop dimmed to 0.55. The most important combat information
(the forecast line, the decision hints) renders smallest.

**Game-wide — the UI has no shared design language in code.** There is no
theme/tokens module: the gold accent `#ffd88a` appears ~93 times as a literal
alongside two competing golds (`#ffd700`, `#ffd44a`); three greens, two
danger-reds, and two muted grays split the same semantic roles; 25 distinct
font sizes exist with per-scene H1 sizes from 26 to 72px; ~15 private
per-scene button factories restyle the same recipe, with primary-button
polarity inverted between adjacent screens; five back-button variants, three
gold-badge formats, four panel fill/stroke recipes, and one alien cyan
(`#18c7d7`) on two DOM inputs. Buttons are square (Phaser `Text`
`backgroundColor`) while every panel is rounded.

## Design principles

1. **One token module** (`src/ui/theme.ts`); every wave consumes it. Colors,
   type scale, spacing, radii, alphas, and the duel depth ladder become named
   constants; the refresh is a styling consolidation, not a rebrand.
2. **Motion masks state sync.** The engine-driven destroy-and-rebuild sync
   pattern stays (it is correct and simple); tweens and enter/exit animation
   hide it. No engine or sync-architecture change.
3. **Geometry moves only where this plan says** (Wave 2's tile growth and HUD
   blocks). Everything else keeps the audited Immersive Fan coordinates.
4. **The iron traps ride along in every contract**: never `setInteractive` a
   scaled Container (Zone-child pattern); re-`inflateHitArea` after every
   `setText`; new interactive controls join `overlayGuardTargets()`; listeners
   and timers follow the gauntlet-restart SHUTDOWN lifecycle; tween callbacks
   check `.active`.

## Wave 0 — theme foundation

**`src/ui/theme.ts`** (Phaser-allowed layer; engine purity untouched):

- **Palette**: one gold accent (`#ffd88a`, dark-on-gold for filled controls),
  one success green, one danger red (+ its `#3a1f28` fill), one muted caption
  gray, one body lavender, one near-white heading; panel recipe collapsed to a
  single fill/stroke pair with a defined alpha step; the rarity text ramp
  absorbed from `FilterBar.TIER_TEXT_COLOR` as the canonical export. The cyan
  DOM-input accent dies.
- **Type scale**: 8 sizes max (display/heading/subheading in Cinzel;
  body/label/caption in Inter), replacing the current 25.
- **Spacing / radius / alpha / depth**: 4px spacing grid; radius 8 (panels)
  and 6 (controls); named alpha steps; the duel depth ladder as named consts.
- **Factories**: `themedButton()` (rounded Graphics bg + Text label;
  primary/secondary/danger/chip variants; owns `bindTapButton`,
  `inflateHitArea`, and re-inflation on relabel — retiring the most-repeated
  trap comment in the codebase), `panel()`, `modalShell()` (standard dim,
  panel, close affordances incl. Esc, ModalGuard wiring), `backButton()`,
  `goldBadge()`, `pager()`.
- **Shared-widget migration**: `Dropdown`, `FilterBar`, `SearchInput` (CSS
  string generated from tokens), `OddsDrawer`, `KeywordGlossaryPanel`.

No scene redesigns in this wave; visual deltas are limited to the normalized
tokens showing through the migrated shared widgets. **Effort: medium. Risk:
low.**

## Wave 1 — play-field feel (motion + depth; zero geometry)

All items from the duel audit's quick-win list, on unchanged coordinates:

- **Hand**: tween the hover pose (~100ms, `killTweensOf`-guarded); animate
  fan entries/exits so the per-sync rebuild reads as motion; a cast-to-board
  travel ghost (a temporary `CardView` flying to the destination tile) and a
  draw slide-in from the deck pile.
- **Board**: soft inner gradient/vignette on the two zone plates; backdrop
  dim lifted (~0.55 → ~0.45) with a subtle radial stage light behind the
  midfield; land-stack and mana-pip changes crossfade instead of popping.
- **Feedback**: life-total pulse on change (both burn discs); smart-button
  idle breathe (slow stroke-alpha) plus state color shift (attack vs pass);
  phase-pill slide/fade on step change; turn banner accent + slide; curved
  targeting/block arrows (reuse the aerial-FX bezier idiom in `CombatFx`)
  with filled heads.
- **Prompts**: forecast line promoted (larger pill, lethal state prominent);
  skip toast restyled via tokens.

Tween lifecycle discipline per trap #4. **Effort: medium. Risk: low-medium
(tween/destroy races — every callback checks `.active`).**

## Wave 2 — play-field hierarchy + larger tiles (geometry, duel only)

The one wave that moves audited coordinates; each move re-derives its
documented dependents.

- **Larger battlefield tiles** (user pick): `BoardCardView` grows from
  132×146 toward ~160×180 with shrink-to-fit row packing (extracted as a
  pure, unit-tested function) so 7+ creature rows scale down gracefully.
  Constraints to re-derive: row fit inside `ROW_USABLE` (1000px), vertical
  clearance inside both zone plates, the your-tiles vs land-row band, hand-fan
  rest-top clearance (`myLands.cy`/badge/fan-top math), CoachMark
  `getBounds()` targets, and the ≥90px touch floors.
- **Opponent identity block**: the thin strip's avatar/life/hand/piles/pips
  become a coherent left-anchored block with a visible name and larger life.
- **Phase rail → phase ribbon**: turn/step/owner pills and the hint line
  restyled and repositioned for hierarchy (hint promoted near the action).
- **Control cluster**: End Turn, smart button, auto-skip, concede, and piles
  visually grouped; auto-skip input-lock race respected.
- **In-duel menu, victory/defeat screens**: rebuilt on `modalShell()` — fixes
  the end-screen text/button collisions with board tiles.

**Effort: medium-large. Risk: medium (load-bearing coordinates; collision
re-audit is part of the wave's definition of done).**

## Wave 3 — scene sweep (theme migration)

Mechanical migration of all non-duel scenes to the Wave-0 factories, largest
first: DeckBuilder (~75 call sites, four internal button helpers deleted),
Shop, MainMenu, PackOpening, Collection, Gauntlet, Settings, the four Limited
scenes, Achievements, Profile, CardShowcase. Unify back button, gold badge,
headers to the type scale, pagers, modal chrome, panel recipe, row-highlight
treatment; normalize backdrop dims (art-visible target ≈0.45–0.55 except
where the audit documented a legibility calibration, e.g. Collection's 0.70
vs the 0.32 unowned-thumb ghosts).

**Settings gets its wider two-column relayout and exposes the existing
`confirmDestructive` + `keywordReminders` toggles — closing the last tracked
QOL follow-up (plan-qol.md). No schema change (fields exist since v7/v8).**

**Effort: large but mechanical. Risk: low.**

## Wave 4 — stretch (explicitly optional, needs its own go/no-go)

Colorblind-safe highlight redundancy, separate music/SFX sliders (this one is
a `SaveData` bump: next free version after v15, with `migrate()` + test),
UI text scaling seam, sticky filter persistence (open decision in
plan-qol.md). Not scheduled by this plan.

## SaveData impact

**None in Waves 0–3.** Wave 4's sliders would take the next free version
after v15 with a real migration + test, per the iron invariant.

## Test strategy

- The 555-test suite must stay green every wave; no engine/AI/balance surface
  is touched, so no win-rate re-measure is expected (re-run the matrix only
  if a wave unexpectedly grazes `src/ai` or timing-sensitive code — it
  shouldn't).
- **Pure additions get unit tests**: the Wave-2 row-packing function; theme
  token exports (a coverage test that every palette/type token is consumed
  keeps dead tokens out).
- **By-eye/preview-probe checklist per wave**, run via the playbook recipe
  (drive the loop, verify state, screenshot): hand motion, travel ghost,
  pulse/breathe affordances, tile growth on crowded boards (7+ creatures),
  modal chrome, backdrop lift, and the end-screen collision fix. Anything
  needing real eyes/ears (FX taste, SFX) is flagged for the human explicitly.
- Lint layer purity is unaffected (`theme.ts` lives in `src/ui`, which may
  import Phaser).

## Sequencing & delegation

Waves land in order, one PR per wave through the protected-`main` flow
(branch → PR → `verify` → squash-merge). Codex executes each wave as a
fresh, tightly-scoped contract (files, constraints, hazards, definition of
done); Claude reviews every diff, runs the ladder, and owns git. After Wave 1
lands, the user eyeballs the play field before Wave 2's geometry work begins
— if "dated" persists at that checkpoint, the re-wireframe option reopens
with real data.

## Open questions

None blocking Waves 0–1. Wave 2's exact tile dimensions are proposed at build
time with the collision math attached. Wave 4 items each need a go/no-go
when they come up.
