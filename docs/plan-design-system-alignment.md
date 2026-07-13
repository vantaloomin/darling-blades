<!-- source-of-truth: docs/design-system.md, src/ui/, src/scenes/, src/platform/gestures.ts, src/platform/animPolicy.ts, index.html, tests/ui/, tests/platform/ · last-verified: 2026-07-12 · implementation plan — re-audit after each completed wave -->

# Design-system alignment plan

## Status and scope

This plan records the changes required to bring the current Darling Blades UI
into conformance with [the core design system](design-system.md). It is based on
a file-by-file static audit of all 18 scenes, shared UI components, platform
input helpers, and current UI tests on 2026-07-12.

The audit itself changed no runtime code. Baseline on the reviewed worktree:

- `npx.cmd tsc --noEmit`: pass
- `npm.cmd run lint`: pass
- `npx.cmd vitest run`: 639 passed, 3 skipped across 64 files

There is no P0/blocking defect. The highest-priority debt is geometric rather
than stylistic: invisible hit targets overlap, persistent controls sit outside
the title-safe frame, and overlay/focus ownership is inconsistent. Most
non-Duel scenes already consume the color and font tokens successfully.

`DeckBuilderScene.ts` contained user-owned changes during this audit. Its wave
must start from the then-current file and must not overwrite or revert adjacent
work.

## Priority definitions

- **P0** — blocks play, loses data, or creates an unavoidable accessibility
  barrier. None confirmed in this audit.
- **P1** — overlapping or unreachable input, protected information outside
  safe bounds, broken modal isolation, or a destructive action that bypasses
  the established confirmation policy. Required before calling the system
  aligned.
- **P2** — inconsistent shared chrome, zero isolation space, semantic type or
  depth drift, missing focus/motion behavior, or an edge case likely to fail on
  touch/localization. Required for full conformance; may follow the P1 fixes.
- **P3** — polish or maintainability issue that does not currently impede the
  primary path. Address when its owning component is already open.

## Preserve these existing decisions

Alignment is not permission to redesign game content. Preserve:

- the 1280×720 design canvas, Phaser FIT behavior, and the CSS safe-area
  insets already applied to `#app` in `index.html`;
- Collection's binder metaphor and repeated gutters;
- Profile's trailing-aligned numeric column;
- Glossary's paired-panel structure;
- Settings' two-column label axes;
- the Duel hand fan, battlefield plates, card-choice grids, commander-art
  composition, and current engine/state synchronization seams;
- specialist WUBRG, rarity, card-material, combat, holo, and illustration
  palettes. Centralize them in specialist modules; do not flatten them into
  application-chrome tokens;
- current gameplay, economy, save schema, AI behavior, and deterministic rules.

## Measured audit snapshot

### Scene literal adoption

All feature scenes except Preload use tokenized application colors and font
families. The only actionable non-Duel chrome literals are one raw color and
one raw font family in `PreloadScene.ts:36-53`. The `0x7fffffff` values in
Shop and Pack Opening are RNG masks, not colors.

`DuelScene.ts` remains the concentrated legacy surface:

| File | Raw color occurrences | Unique raw colors | Raw font literals | Raw numeric depths |
| --- | ---: | ---: | ---: | ---: |
| `src/scenes/DuelScene.ts` | 63 | 43 | 25 | 19 |
| `src/ui/BoardCardView.ts` | 29 | 27 | 3 | 0 |
| `src/ui/CommanderPortrait.ts` | 11 | 9 | 1 | 0 |
| `src/ui/HistoryPanel.ts` | 15 | 10 | 3 | 0 |
| `src/ui/PileView.ts` | 3 | 3 | 1 | 0 |
| `src/ui/CoachMark.ts` | 7 | 7 | 3 | 0 |

These counts include sanctioned specialist colors and comments. They are an
inventory, not a blanket replacement target. Generic chrome and typography
must use core tokens; material and gameplay-state colors must become named
specialist values.

### Confirmed input overlap and isolation failures

| Surface | Current geometry | Required result |
| --- | --- | --- |
| Deck picker actions | 82px center pitch, 90px hit width; 8px overlap (`DeckBuilderScene.ts:578-659`) | no overlap; at least 8px inactive gap, 24px/different track for Delete |
| Basic-land steppers | 30px desktop / 40px touch pitch, 44px hit height; 14px / 4px overlap (`DeckBuilderScene.ts:47-52,1039-1070`) | reflow rows or controls to non-overlapping targets |
| Deck nonbasic rows | 22px desktop pitch with 36px hero-star targets; 14px overlap. Touch uses 44px pitch/targets with zero gap (`DeckBuilderScene.ts:47-53,1084-1158`) | isolated row target and separate star/minus action tracks |
| Deck pool playset chip | `+N` action overlays the independently interactive card thumbnail (`DeckBuilderScene.ts:400-440`) | reserve a non-overlapping playset-action track |
| Deck picker tile | whole tile selects while four child actions occupy the same footprint (`DeckBuilderScene.ts:582-679`) | exclude child-control bounds from tile selection or use a dedicated select action |
| Limited deck rows | 31px pitch, 44px action targets; 13px overlap (`LimitedDeckBuilderScene.ts:114-168,272-303`) | isolated row/action tracks |
| Limited reveal rows | 20px pitch, 30px targets; 10px overlap (`LimitedRevealScene.ts:97-112`) | minimum target plus inactive gap, or paged/list selection |
| Shop quantity chips | 80px pitch, 90px targets; 10px overlap (`ShopScene.ts:403-424`) | wider pitch or smaller visible group with isolated hit boxes |
| Main-menu items | 42px dev / 50px production pitch, 44px targets; overlap or only 6px gap (`MainMenuScene.ts:140-161`) | at least 8px ordinary inactive gap |
| Settings chips | 90/92px pitch, 90px targets; 0/2px gap (`SettingsScene.ts:134-165`) | at least 8px inactive gap |
| Gauntlet rungs | hit height equals row pitch (`GauntletScene.ts:109-162`) | separate row targets or use one isolated row surface |
| Limited draft cards | 44px pitch and hit height (`LimitedDraftScene.ts:86-127`) | at least 8px gap or alternate list geometry |
| Collection variant rows | 48px pitch with 44px targets; only 4px inactive gap (`CollectionScene.ts:442-494`) | at least 8px inactive separation |
| Duel player severed/deck | severed is inflated to 90px at y=482; default deck zone begins near y=526, producing about 1px overlap (`DuelScene.ts:854-871`; `PileView.ts:41-48,82-95`) | separate the confirmed pair; do not assume every pile uses a 90px target |
| Duel Menu/grave | nominal overlap near bottom-right (`DuelScene.ts:1040-1048`; `PileView.ts:82-95`) | separate tracks and title-safe bounds |
| Duel End Turn/smart button | about 3px gap (`DuelScene.ts:987-1003,1068-1090`) | 12–16px touch-cluster gap |

### Title-safe violations

The design-system title-safe frame is `x 64–1216, y 36–684`. The CSS device
safe area shrinks the Phaser parent on supported touch devices, but it does not
replace the in-canvas title-safe contract.

Systemic violations:

- `backButton()` starts at `(28,28)` and inflates to at least 90×44
  (`themeWidgets.ts:217-243`), so every caller inherits an off-safe target.
- Currency is repeatedly anchored at `x=1250`/`width-30`: Achievements `:118`,
  Collection `:163`, Gauntlet `:98`, Limited `:64`, MainMenu `:101`,
  PackOpening `:215`, Settings `:83`, and Shop `:289`.
- Bottom actions/pagers extend below safe bounds in Achievements `:216-218`,
  Collection `:500-578`, DeckBuilder `:753-758,1172-1190`, PackOpening
  `:738-765`, and Settings `:269-295`.
- `modalShell()` puts the close button only 16px inside the panel corner while
  its hit width inflates to 90px (`themeWidgets.ts:202-209`); the target extends
  outside the panel and consumes the title track.
- Duel life badges, piles, Undo, Menu, and portrait labels sit outside the
  safe frame (`DuelScene.ts:120-137,1040-1111`; `CommanderPortrait.ts:109-134`).

These are P1 where the element is a persistent control, status, or decision.
Expendable build/version metadata may remain outside title-safe by design and
is not promoted to P1 merely because of its coordinates.

## Required shared-system changes

### DS-01 — Title-safe and alignment geometry (P1)

**Problem:** `theme.design` exposes only viewport and center. Every scene
recreates edge anchors, so unsafe values recur.

**Required change:**

- Add Phaser-free title-safe geometry: left 64, right 1216, top 36, bottom 684,
  safe center, safe width/height, and standard header/footer centerlines.
- Add pure helpers for anchored rectangles, containment, full visual/hit bounds,
  and pairwise inactive gaps.
- Add a development-only `LayoutDebugOverlay` capable of drawing title-safe bounds,
  visual bounds, inflated hit bounds, and named depth bands.
- Keep platform/device safe-area behavior in `index.html`; document the
  relationship instead of adding a second competing runtime inset.

**Files:** `src/ui/theme.ts`; new Phaser-free layout helper under `src/ui/`;
new `src/ui/LayoutDebugOverlay.ts`; `tests/ui/theme.test.ts`; new layout-helper
tests. The debug renderer is a separate Phaser consumer of the pure math.

**Acceptance:** every persistent critical control or status rect is contained
by the title-safe frame; tests prove the 90% derivation and containment math.

### DS-02 — Measurable control isolation (P1)

**Problem:** `themedButton()` inflates input internally but callers cannot
measure the final target. Visually separated controls can overlap invisibly.

**Required change:**

- Expose measured visual and hit dimensions from shared controls, or provide a
  pure layout function that computes them before placement.
- Add cluster helpers/assertions for 8px ordinary gaps, 12–16px compact touch
  clusters, and 24px/different-track destructive isolation.
- Preserve the Zone-child input invariant; never make a scaled Container
  interactive.

**Files:** `src/ui/themeWidgets.ts`; pure layout helper; tests.

**Acceptance:** every compact cluster named in this plan has pairwise
non-intersecting hit rectangles and the required inactive gap.

### DS-03 — Safe modal tracks and lifecycle ownership (P1)

**Problem:** modal close geometry invades titles, and callers inconsistently
own `ModalGuard`, DOM visibility, focus, and scene-level input blocking.

**Required change:**

- Give `modalShell()` reserved title, content, footer, and close tracks with at
  least 24px panel padding and full hit-box containment.
- Expose content bounds so card grids and detail panels cannot intrude into
  title/close/footer tracks.
- Add an overlay coordinator or explicit shell options for guard targets,
  invoking control, DOM overlays, mandatory-choice semantics, logical invoker
  identity/state restoration, and future focus hooks/metadata.
- Make guard ownership stack/reference-count safe and restore the exact prior
  interactive configuration, including custom hit areas and cursor state.
- Centralize Escape and scene-level input priority so one keypress causes one
  transition: inspect/popover → modal/side sheet → pending targeting → no-op.
- Keep mandatory decisions non-dismissible; do not add Esc/tap-dim paths to
  mulligan, bottoming, Foresee, fetch, or discard decisions.

**Files:** `src/ui/themeWidgets.ts`, `src/ui/Modal.ts`, pure modal geometry
helper/tests, then scene consumers.

**Acceptance:** close hit rect remains inside the panel and outside the title;
background canvas/DOM/scene-level input cannot fire while open; close is
idempotent; Wave 1 restores logical invoker/state ownership. Actual
keyboard/controller focus restoration becomes mandatory when DS-06 lands.

### DS-04 — Rounded select/toggle and edge-aware popover (P1)

**Problem:** Dropdown and FilterBar's Owned control retain square Text
backgrounds. Dropdown rows touch with zero inactive space and the panel neither
clamps nor flips near safe edges (`Dropdown.ts:19,45-135`; `FilterBar.ts:111-155`).

**Required change:**

- Build one rounded Graphics + unscaled Zone trigger used by selects and
  compact toggles.
- Keep option hit height at least 44px but use at least 52px row pitch.
- Compute panel bounds in a pure helper; clamp horizontally and open up/down to
  remain inside safe bounds.
- Add disabled, selected, hover, touch, and future focus states without layout
  changes.

**Files:** `src/ui/Dropdown.ts`, `src/ui/binder/FilterBar.ts`, shared primitive,
new pure dropdown geometry helper/tests.

### DS-05 — DOM input handle and overlay integration (P1)

**Problem:** `SearchInput` returns a raw DOMElement, uses placeholder as its
only accessible name, disables the normal focus outline, and can remain above
canvas modals (`SearchInput.ts:19-39`). Collection hides it manually; Deck
Builder does not cover every rename/code modal.

**Required change:**

- Return a `SearchInputHandle` that owns accessible label, visibility,
  enabled state, focus/blur, restore, and teardown.
- Provide a visible focus treatment that does not rely on a 1px color swap.
- Register DOM handles with the overlay coordinator so opening any blocking
  modal hides/disables them and close restores only the prior state.
- Use the same styling/lifecycle seam for rename, import, and export inputs
  instead of more scene-local DOM construction.

**Files:** `src/ui/SearchInput.ts`, modal/overlay coordinator,
`CollectionScene.ts`, `DeckBuilderScene.ts`; browser probes required.

### DS-06 — Focus and keyboard/controller navigation (P2)

**Problem:** canvas controls have no shared focus traversal, focus ring, Enter/A
activation, B/Esc return, or modal trap. Visual and focus order cannot yet be
proven equivalent.

**Required change:**

- Add a core focus manager with explicit ordered groups, visible focus,
  directional navigation, activation, cancel/back, modal trapping, and invoker
  restoration.
- Enable and normalize gamepad input in `src/main.ts`; add a Phaser-free
  navigation/action mapping module, a Phaser focus binder/manager, and a
  device-mode policy so pointer, keyboard, and active controller glyphs do not
  fight for ownership.
- Make themed buttons, Back, Pager, Dropdown, and modal controls the first
  consumers; then adopt scene by scene.
- Disabled pager directions must also disable input and focus, not merely no-op.

**Files:** `src/main.ts`; new headless navigation/action module under
`src/platform/`; new Phaser binder/manager under `src/ui/`; shared controls;
focused unit tests and a runtime controller probe.

This is a separate accessibility wave. Do not fake conformance with hover-only
states or scene-local keyboard shortcuts.

### DS-07 — Semantic type and specialist material ownership (P2/P3)

**Required change:**

- Add semantic text recipes if needed to stop family/size/weight recombination
  from drifting.
- Replace raw font-family literals in generic chrome with the appropriate core
  family token. CardView/BoardCardView may instead consume a named,
  specialist-owned card typography recipe; raw repeated family strings are
  still not the owning contract.
- Centralize card-frame/material colors inside the card specialist system;
  centralize Duel target/damage/opponent/recap colors in a named Duel visual
  palette. Do not move those domain colors into generic button/panel tokens.
- Replace raw numeric depths with named bands; add narrowly named bands only
  where the current ladder has no valid semantic role.

### DS-08 — Measured glossary and drawer content (P2)

`KeywordGlossaryPanel.ts:23-66` invents square chrome, ad-hoc type sizes, and
fixed row heights that depend on current English copy. Rebuild it on the shared
panel/type system with measured row heights and an explicit max-height policy:
scroll, page, or columns. Apply the same measured-row principle to other
drawers instead of shrinking text to preserve a fixed count.

**Files:** `src/ui/KeywordGlossaryPanel.ts`, a pure measured-layout helper/test,
and consumers only if the API must change.

### DS-09 — Reproducible layout-stress mode (P2)

Add a development-only, deterministic stress harness that can expand
operational UI copy by a defined factor (target 35%) and scale UI text to a
defined test level (target 125%) without mutating saves or card data. It must
cover Phaser Text and registered DOM controls and expose a repeatable query/dev
toggle. This turns longest-copy/text-scale acceptance from a subjective promise
into a reproducible probe.

**Files:** new dev-only layout-stress module under `src/ui/` or `src/dev/`,
minimal bootstrap wiring, and pure transformation tests. Production builds must
tree-shake or gate it out.

## Required scene changes

### SC-01 — Shared header/footer migration (P1)

After DS-01, migrate Back, currency, page titles, top actions, pagers, and
footer actions to safe tracks. A shared scene-header composition is preferred
over repeating coordinates.

**Affected scenes:** Achievements, Collection, DeckBuilder, Gauntlet, Limited,
MainMenu, PackOpening, Settings, Shop, CardShowcase, Glossary, Profile, and the
Limited sub-scenes where they own persistent navigation.

**Specific corrections:**

- Back target fully inside safe bounds.
- Gold, title, and navigation visual/hit rectangles fully contained by the
  safe frame; a baseline or center coordinate alone is not sufficient.
- **Currency placement decision (user, 2026-07-12):** the gold badge shows
  ONLY on the main menu and the Shop. All other scenes omit it (removed
  2026-07-12); Wave 2 lanes must not re-add per-scene currency, and actions
  that pay out gold name the amount on their own control instead.
- Bottom control centers at or above y=662 for 44px targets.
- CardShowcase right cycle target inside x<=1216.
- Pack inspect modal and Deck picker modal contained in safe bounds.

Wave 1 owns the shared header/footer primitive only. Each Wave 2 lane owns
SC-01 adoption in its listed scenes; the header-only lane owns the remaining
scenes.

### SC-02 — Deck Builder isolation pass (P1)

**Files:** `src/scenes/DeckBuilderScene.ts` plus pure geometry tests/helpers.
Do not combine with unrelated Deck Builder behavior or current user changes.

Required:

- eliminate the 8px deck-action overlap and separate Delete from routine
  actions;
- re-pitch/restructure basic-land steppers for both desktop and touch;
- eliminate desktop hero-star overlap and zero-gap touch nonbasic rows;
- move the pool-card `+N` playset action out of the thumbnail's independent
  input footprint;
- prevent the deck-picker tile selection target from sitting underneath
  Use/Copy/Rename/Delete, or move selection to its own control;
- arm deck deletion with danger semantics and a reset/timeout rather than an
  indefinite primary-style `Delete?` state;
- move bottom Export/Import/Save actions above the safe footer;
- contain the deck-picker modal and its Close action;
- separate filter Close from the first dropdown;
- route search/rename/code DOM elements through DS-05;
- attach modal guard/logical-invoker ownership and future focus metadata to deck
  picker, rename, and code shells.

### SC-03 — Limited-flow interaction pass (P1/P2)

**Files:** `LimitedDeckBuilderScene.ts`, `LimitedDraftScene.ts`,
`LimitedRevealScene.ts`, `LimitedScene.ts`.

Required:

- replace 31px/20px/44px zero-gap selection rows with isolated rows, paging,
  or a detail/action pattern;
- replace square Text-background controls with shared rounded controls;
- treat **Clear** as destructive and honor `confirmDestructive`;
- guard inspection overlays and restore logical invoker state; DS-06 later
  restores actual keyboard/controller focus;
- place Current Pack operational information on a stable surface;
- use the UI face for dense history/row labels, retaining display type only for
  ceremonial headings.

### SC-04 — Menu, economy, and progression clusters (P1/P2)

**Files:** `MainMenuScene.ts`, `ShopScene.ts`, `GauntletScene.ts`,
`SettingsScene.ts`.

Required:

- Main Menu: make every production/dev menu pitch provide >=8px inactive gap
  and correct the stale pitch comment.
- Shop: re-layout quantity chips to remove the 10px target overlap; retain pack
  and product-art composition.
- Gauntlet: separate rung targets without disturbing the ladder metaphor; move
  seed/status inside safe bounds; use UI type for dense rung labels.
- Settings: separate animation/render chips; keep the two-column axes; move
  update/version controls according to critical versus expendable status.
- All: adopt shared safe header/currency/navigation and overlay ownership.

### SC-05 — Collection and pack-overlay composition (P1/P2)

**Files:** `CollectionScene.ts`, `PackOpeningScene.ts`, with shared modal/input
infrastructure already landed.

Required:

- move destructive shard/footer actions and close guidance inside safe bounds;
- give variant rows at least 8px inactive separation;
- use danger/armed-danger semantics for shard destruction rather than
  emphasis-to-primary styling;
- keep Collection search disabled/hidden for every blocking overlay;
- reduce or recompose the 680px pack inspect shell so close, details, and
  footer all remain in their reserved tracks;
- move pack result actions inside the safe footer while preserving reveal
  choreography and focal isolation;
- add complete guard and logical invoker restoration; actual focus restoration
  becomes required in Wave 5.

### SC-06 — Preload boundary cleanup (P2)

**File:** `PreloadScene.ts` only.

- Use core font/color tokens.
- Give operational loading text a stable plate or re-verify and document a
  guaranteed low-frequency safe zone.
- Keep Boot/Preload lifecycle and render-scale application unchanged.

## Duel-specific alignment program

`DuelScene.ts` is high-risk and must remain surgical. Do not combine all Duel
items into one rewrite.

### DU-00 — Overlay and input-priority migration (P1 prerequisite)

Before History or additional modal migration, route Duel's current Space,
Enter, Esc, pointerdown, pointermove, Undo, and dynamically created input
carriers through the shared topmost-overlay coordinator. `ModalGuard` alone
cannot block scene-level listeners, and `modalShell()` plus Duel's global Esc
listener can otherwise close/cancel two layers from one keypress.

Required priority is stack-based: the topmost active overlay owns input,
regardless of category. Pending targeting and then the board receive input only
when the overlay stack is empty. A permitted nested inspect closes back to the
mandatory chooser or side sheet beneath it. Nested History→Inspect and
zone→Inspect must restore exact input state/custom hit areas.

**Files:** `DuelScene.ts`, shared coordinator already landed in Wave 1, focused
input-priority tests. Include Undo and every scene-level listener explicitly.

### DU-01 — Persistent HUD safety and isolation (P1)

Recalibrate `LAYOUT` and the portrait label contract only where necessary:

- bring life badges, pile/count columns, Undo, Menu, and identity labels inside
  title-safe;
- allow portrait art to remain full bleed, but move its operational label to a
  safe track;
- align phase/turn/action axes (currently x=1113 versus x=1108);
- move End Turn and the smart button to provide 12–16px inactive separation and
  keep the smart-button target above y=684;
- move Menu away from the grave pile and into the right-sidebar hierarchy;
- re-check hand-fan clearance and maximum label width after every move.

**Files:** `DuelScene.ts`, `CommanderPortrait.ts`, focused safe-layout tests.
DU-01 owns pile-column x placement only; DU-02 owns pile y/input pitch.

Do not move battlefield plates or creature rows in this sub-wave. Recheck
`overlayGuardTargets`, tutorial target bounds, hand-clearance math, and History
tab clearance after the new anchors land.

### DU-02 — Pile and battlefield target geometry (P1)

- Separate the confirmed player severed/deck collision using measured actual
  hit sizes. Do not inflate every pile to 90px without a product decision;
  ordinary compact icons may use the documented 44px floor.
- Re-derive `rowPacking` against world-space target width and isolation, not
  visual tile width alone.
- First derive the maximum direct-target count from available width, required
  target size, and gutter, then define a supported stress cap from rules/deck
  constraints. For denser rows, specify whether the fallback is touch-only or
  universal and use a deliberate zone/row chooser. Never solve density by
  overlapping invisible targets.
- Preserve `BoardCardView` visuals, child-Zone input, combat selection, tapped
  rotation, inspect, and long-press behavior.

**Files:** `DuelScene.ts`, `BoardCardView.ts`, `rowPacking.ts`, a possible
specialist chooser module, overlay coordinator consumers, and focused tests.
Tests must prove that direct and fallback paths submit the same permanent IID /
action, tutorial mode cannot deadlock, and no fallback changes engine state
before confirmation.

### DU-03 — History as an isolated interaction context (P1)

History currently covers the decision controls while leaving most board input
live (`HistoryPanel.ts:73-84`). Convert it to an observable side sheet or
modal-like context:

- guard the board while open;
- provide explicit close/Esc and invoker restoration;
- bring the closed tab inside title-safe;
- give tappable records stable >=44px targets and scrolling/paging as needed;
- preserve linked-card inspection and return to History after inspect closes.

This wave consumes DU-00's coordinator; it must not stack another scene-local
`ModalGuard`. Space/Enter/pointer actions beneath History must no-op.

**Files:** `DuelScene.ts`, `HistoryPanel.ts`, shared coordinator consumers, and
focused History/input-priority tests.

### DU-04 — Collision-aware Coach Marks (P1/P2)

The smart-button bubble overlaps End Turn and extends past safe right. Add a
pure placement helper that measures the final bubble, clamps its whole rect to
title-safe, and rejects reserved HUD/control rectangles. Prefer a left-side
bubble for the smart-button cue. Respect full/reduced/off animation.

**Files:** `CoachMark.ts`, small pure placement helper/tests, surgical cue
integration in `DuelScene.ts`.

### DU-05 — Generic overlay migration (P2)

Use the already-migrated pause/results overlays as precedent. Before migrating,
separate interaction ownership from panel chrome: add a panel-less/full-bleed
guarded shell mode where specialist card composition needs the full stage.
Classify each surface as panel modal, full-bleed guarded chooser, or inspection
composition. Move only shell, title, footer, and button chrome for:

- tutorial completion (`DuelScene.ts:727-768`);
- inspect (`:3203-3234`);
- grave picker (`:3429-3493`);
- Foresee (`:3578-3678`);
- basic-land chooser (`:3687-3723`);
- mulligan/bottom/discard chooser (`:3726-3833`).

Preserve card rows, gestures, mandatory/cancel semantics, action dispatch, and
guard timing. Mandatory decisions use no Esc, no close affordance, and no
tap-dim dismissal. The Concede relabel must remain isolated when it expands to
“Tap to confirm.” Measure title/footer/card-row capacity for every chosen shell
mode; mandatory semantics belong to the coordinator, not the presence of a
close button.

### DU-06 — Bounded token/depth/motion cleanup (P2/P3)

- Migrate generic fonts, panels, buttons, and named depth roles.
- Migrate badge/label chrome in PileView and CommanderPortrait while preserving
  iconography and material reactions.
- Keep BoardCardView combat/rarity/P-T colors specialist-owned.
- Gate CommanderPortrait damage/cast reactions through the animation policy;
  off returns immediately to stable rest state; reduced uses no shake and may
  retain only a brief/static state cue.
- Finish with classified audits, not a blind zero-hex requirement.

## Execution waves and file ownership

Each wave must end independently green. Concurrent agents never edit the same
file, and only the main session runs git.

### Wave 0 — Pure geometry foundation

**Owns:** `src/ui/theme.ts`, new pure layout/geometry helper(s), new
`src/ui/LayoutDebugOverlay.ts`, `tests/ui/theme.test.ts`, new geometry tests.

**Delivers:** DS-01, the debug renderer, and the pure portion of DS-02.

**Forbids:** scenes, Duel, widgets, gameplay, save/meta.

### Wave 1 — Shared control and overlay primitives

Run sequentially where files overlap:

1. `themeWidgets.ts` safe buttons/header/footer/modal tracks, Pager behavior,
   and focus hooks/metadata only (not traversal or scene adoption).
2. `Dropdown.ts` + `FilterBar.ts` select/toggle geometry.
3. `Modal.ts` + `SearchInput.ts` overlay/DOM lifecycle primitives.
4. `OddsDrawer.ts`, `KeywordGlossaryPanel.ts`, and remaining
   focus-hook-ready shared-control cleanup.

**Delivers:** DS-02 measurement primitives, DS-03 through DS-05 coordinator /
component contracts, DS-08 shared measured layout, and P3 Pager behavior. It
does not complete scene-owned isolation. End-to-end
DOM suppression in Collection/DeckBuilder lands with their Wave 2 consumer
migrations; Wave 1 proves the primitive contract with isolated tests.

### Wave 2 — Critical non-Duel collisions

Parallelizable by disjoint file set after Wave 1:

- **2A Deck Builder:** SC-01 adoption + SC-02. Re-read current user changes first.
- **2B Limited:** SC-01 adoption + SC-03.
- **2C Menu/economy:** SC-01 adoption + SC-04.
- **2D Collection/Pack:** SC-01 adoption + SC-05.
- **2E Preload:** SC-06.
- **2F Header-only scenes:** SC-01 adoption in Achievements, CardShowcase,
  Glossary, and Profile.

Shared files are forbidden in Wave 2; surface any missing primitive instead of
inventing scene-local chrome. Wave 1 supplies the shared SC-01 header/footer
primitives; each Wave 2 lane owns adoption only in its listed scenes. Each lane
may add a uniquely named scene-specific test file, but must consume rather than
edit the Wave 0 geometry helper or another lane's tests.

### Wave 3 — Duel geometry and interaction

Sequential, because `DuelScene.ts` is shared:

1. DU-00 overlay/input priority.
2. DU-01 persistent HUD.
3. DU-02 target geometry.
4. DU-03 History isolation.
5. DU-04 Coach placement.

Every sub-wave gets targeted geometry tests and a runtime probe before the
next begins.

### Wave 4 — Duel overlay and specialist cleanup

1. DU-05 generic overlays.
2. DU-06 token/depth/motion cleanup.

No battlefield/hand geometry changes in this wave.

### Wave 5 — Focus adoption and final audit

Land DS-06 traversal, focus state, and activation as its own accessibility
feature, then adopt it across scenes in
bounded batches. Land DS-09's reproducible copy/text-scale stress mode before
the final visual audit. Run the final literal, title-safe, hit-overlap,
focus-order, modal, motion, and layout-stress audits.

## Acceptance criteria

The alignment program is complete only when all are true:

### Geometry and isolation

- Every persistent critical UI rect and hit rect is inside title-safe.
- Every ordinary neighboring target has >=8px inactive separation.
- Compact touch action clusters have 12–16px separation.
- Destructive actions have >=24px separation, a divider, or a different track.
- No scaled Container is interactive.
- Dense battlefield/list layouts use an explicit fallback instead of
  overlapping targets.
- Modal close, title, content, and footer tracks never intersect.

### Interaction and accessibility

- Every blocking overlay disables canvas, scene-level, and DOM input behind it.
- Esc/cancel/mandatory semantics are explicit and tested.
- Focus is highly visible, traversal matches visual order, disabled controls
  are skipped, and modal close restores the invoker.
- Mouse hover is optional enhancement; touch and keyboard/controller paths do
  not depend on it.
- Full/reduced/off motion remains correct and cannot deadlock callbacks.
- On-device checks confirm physical touch comfort; design pixels alone are not
  accepted as proof of the 15mm phone-target recommendation.

### Visual system

- Generic application chrome contains no raw color or font-family literals.
- Specialist colors are named and owned by their domain module.
- Shared page headers/footers and numeric columns align to stable tracks.
- Operational text over artwork has a plate/scrim or verified quiet zone.
- Longest current copy, empty/max data, and DS-09's deterministic 35% copy /
  125% text stress do not break layout or focus order. Real localization
  remains unverified until locale support exists.

## Verification ladder

Every implementation wave runs, in order:

1. `npx.cmd tsc --noEmit`
2. `npm.cmd run lint`
3. targeted Vitest for the changed geometry/component
4. `npx.cmd vitest run`
5. `npm.cmd run build`
6. `npm.cmd run check-docs`
7. `npm.cmd run check-art-bible`
8. `npm.cmd run gen-docs-tables -- --check`

Runtime/browser verification must include:

- temporary title-safe, visual-bound, hit-bound, and depth overlays;
- desktop FIT, touch profile, 90% crop, resized/custom aspect ratio, and both
  landscape mobile orientations;
- longest labels, empty state, maximum data, and DS-09 copy/text-scale stress;
- every modal open/close path, DOM input suppression, Esc, invoker restore, and
  stacked inspect path;
- Duel maximum pile counts, crowded hands, 1 through the derived direct-target
  cap plus the rules-supported stress cap,
  End Turn/smart button/Menu/History, all tutorial cues, and all mandatory
  chooser kinds;
- full/reduced/off motion and rapid scene shutdown/restart.

Use state/object-bound evidence for input and lifecycle claims. Record by-eye
alignment, readable contrast, physical touch comfort, and optical balance as
human-reviewed items; do not infer them from a green build.

## Non-goals

- No engine, AI, economy, save schema, or card-data changes.
- No rebrand, new palette, new card frame, or new backdrop program.
- No opportunistic Duel rewrite.
- No blanket replacement of specialist material/FX colors with application
  theme tokens.
- No geometry change without measured visual and hit rectangles.
- No claim of controller, localization, or physical-device conformance until
  those paths are implemented and tested.
