<!-- source-of-truth: docs/plan-1.9.md, docs/roadmap.md, docs/design-system.md, src/meta/SaveManager.ts, src/scenes/SettingsScene.ts, src/ui/settingsPresentation.ts, src/ui/theme.ts, src/ui/themeWidgets.ts, src/ui/layout.ts, src/ui/sceneTitle.ts, src/ui/profilePresentation.ts, src/ui/CardView.ts, src/ui/BoardCardView.ts, src/ui/ManaSymbols.ts, src/ui/CardFrameFactory.ts, src/scenes/DuelScene.ts, src/gameBoot.ts, src/config/features.ts · last-verified: 2026-09-28 · design/plan doc: 1.9 lane C, re-verified against release/1.9 at 15ffe70, C4 lines (ship gate, C4 row, Settings geometry) re-verified against the C4 branch 2026-09-28; the second sitting's picks (A9-A14, the cue mock M1-M6) recorded 2026-09-28; re-verify when the referenced code changes or a wave lands -->

# Accessibility (1.9 lane C) and the localization record

> **Approved for 1.9** (owner ruling 2026-09-25, [plan-1.9.md](plan-1.9.md)
> lane C). Written for 1.7 on 2026-07-26, never started, and **re-verified
> against the code on 2026-09-28** (`release/1.9` at `15ffe70`): every claim
> below was checked against the source, and the numbers come from a measured
> inventory (see [Inventory](#inventory-measured-2026-09-28)).
> **Localization is RULED: option A, English only** (D3 in plan-1.9). No
> `settings.locale`, no string catalog, no pseudo-locale; wave 4 closes by
> recording that, and 2.0 carries no localization promise. Mobile moved to
> 2.0 (D4); this lane builds text scaling so the mobile pass reuses it.

## Goal

1.9 ships accessibility waves 1-3 as its non-card headline: cues that never
rely on colour alone for any state needed to play, player-selectable text
size, a high-contrast option, and a measured reflow and readability audit
across every player-facing scene. The three waves ride plan-1.9's program
waves 2, 3 and 4 (see [Waves](#waves-mapped-to-the-19-program)).

## Non-goals

- No formal compliance certification, no screen-reader operation inside
  Phaser, no remappable controls, no full motion or audio accessibility
  pass (the existing full/reduced/off animation setting stays as it is).
- No localization of any kind (D3). No translated strings, no catalog.
- No mobile or portrait layout (2.0, D4). The work must not make 2.0's pass
  harder: see [Text scale](#text-scale-built-on-the-shared-layout-primitives).
- **Card faces do not scale.** `CardView` and `BoardCardView` are
  card-internal geometry inside a scaled container (hand 0.55, battlefield
  0.45, inspect 1.5); their text already shrinks to fit its box. A player
  reads a card larger through the zoom preview (hover, or long-press on
  touch) and the inspect view, which exist today. Text size changes the
  interface around the cards.
- No shared keyboard-navigation primitive. The design system records it as
  future core work "when keyboard navigation is scheduled"; 1.9 does not
  schedule it. Existing keyboard paths (Duel targeting, inspect hotkeys, Esc)
  get a visible focus cue and must not get worse.
- No new telemetry field (see open question Q8).

## What changed since the 1.7 draft (the re-verification record)

| The 1.7 draft said | Today (verified 2026-09-28) | What this plan now says |
| --- | --- | --- |
| Ships in 1.7; localization decided by 2026-08-15 or before Story Mode script work | 1.9 lane C; localization ruled English only (D3, 2026-09-25); Story Mode is a 2.0 item on the spine | Waves 1-3 map onto program waves 2-4; wave 4 records option A |
| Waves 2-3 cover Story and a real-device mobile-landscape pass | No Story scene exists (`src/scenes/` has 20 scenes, none of them Story); mobile moved to 2.0 | Story drops out of wave 3; the mobile pass is 2.0's and reuses the shared primitives |
| "Settings gains an Accessibility group" | Settings is two equal panels on one rhythm (`src/ui/settingsPresentation.ts`, #411). **Both columns are full**: the test `is a pure function of the rhythm, and both columns are full` in `tests/ui/settingsPresentation.test.ts` asserts that one more plain row breaks the bottom inset. Measured slack to the panel bottom: 28 px left, 44 px right; against the test's 16 px `MIN_PANEL_INSET` the usable slack is 12 and 28. An Accessibility section needs 180 | Adding the group is a layout decision for the owner (Q1); the recommendation is three tabs, measured under Q1 |
| `src/ui/theme.ts` or a new resolver maps the setting to semantic tokens | `theme.ts` is a Phaser-free `as const` object: eight type roles (`displayXL` 64 to `micro` 11), the chrome colours, `theme.graphics` (numeric colours **computed once at module scope** from `colors`), `theme.alpha` (`panel: 0.9`) and `theme.rarity`. Every read is a plain property read, so 24 `theme.type` reads and 60 `theme.colors` reads at module scope elsewhere are frozen at import, and `theme.graphics` is frozen inside `theme.ts` itself | `type`, `colors`, `graphics` and `alpha` become live reads over one resolver; the module-scope reads are converted (wave 1); `rarity` is untouched |
| Controls may sit anywhere | Every menu control sits inside the title-safe frame, x 64-1216, y 36-684 (`theme.design.safe*`, #412, #431), held by the "title-safe frame: every placed control" block in `tests/ui/layout.test.ts`; menu titles use `src/ui/sceneTitle.ts` and `SCENE_TITLE` in `layout.ts` | Text scale is built on those primitives, and the fixture matrix re-runs the frame rule at every size |
| "Mana identity always uses both a pip shape/sigil and colour" | Already true: every pip bead carries its own vector sigil (`ICON_PATHS` in `src/art/iconPaths.ts`, drawn by `ManaSymbols.ts`), cost rows and land rows use pips, and deck colours render as pips by rule (design-system.md) | Kept as a standing rule; no work |
| "Rarity uses the set-mark shape plus fill" | The set symbol's **shape names the set**; its **fill names the tier** (`CardFrameFactory.ts` tier tints), with a tier-tinted ring from R up. The tier is written as text in Collection badges, the Pack Opening reveal lines and the Deck Builder rarity filter, not in the zoom preview, inspect or draft picks | Rarity is not needed to play; the policy is the tier name wherever rarity drives a decision (see Cues) |
| `CardView` and `BoardCardView` "contain local type sizes" | `CardView`: 8 literal sizes and 2 derived, rules text fit-to-box (`fitWrappedText`, readability floor 0.3), flavor sharing the box until R13 removes it. `BoardCardView`: 5 literal sizes; the tile has no rules text; its highlight is one 3 px border whose **hue alone** carries eight states; P/T mood is colour only; a Mark has no tile cue at all | Card-internal sizes stay (exempt); the board cues are the lane's biggest play-critical fix |
| Save: "the next available version", `textScale: 1 \| 1.15 \| 1.3`, combine with Story Mode | `CURRENT_SAVE_VERSION` is 35. 1.9 has exactly one bump, v35 to v36, and its one known rider is I7 (the Premium draft note) | `textScale: number` normalized to the allowed set; `highContrast: boolean`; I7 rides the same step |
| Settings persist through "save export/import, and cloud sync" | No cloud sync exists (cloud accounts are 2.1). Export/import is the save code and the save card (`SaveCode.ts`, `SaveImage.ts`, `saveCard.ts`) through `SaveManager.replace` | Acceptance says reload and export/import only |
| Audit command `scripts/accessibility-audit.ts --scenes all --scales ...` | Never existed | Replaced by the concrete two-half gate below |
| Settings copy mentions "story text" | There is no story text | New draft copy below, for the owner's approval |

Two stale code comments found on the way, reported rather than edited (they
sit outside this lane's files): `settingsPresentation.ts` labels
`theme.type.caption` as 14 (it is 12), and design-system.md's header is
last-verified 2026-08-22 and has no text-scale or high-contrast section yet
(wave 1's C5 adds one).

## Inventory (measured 2026-09-28)

Produced by a read-only, Phaser-free script run from the worktree root:

```text
npx tsx <scratchpad>/w1-a11y/a11y-inventory.ts        (or --json)
```

It parses `src/` with the TypeScript compiler API (`src/forge` and `src/dev`
excluded; 262 files) and imports only `theme.ts` and `settingsPresentation.ts`.
The script lives in the session scratchpad, not the repo; wave 1's C5 turns
its colour and layout checks into tests. Every number below is its output.

### Text sizes

464 font-size sites (`fontSize:`, `setFontSize`, CSS `font:Npx`):

| Where | Token (`theme.type.*`) | Literal px | Derived |
| --- | ---: | ---: | ---: |
| Scenes | 307 | 40 | 6 |
| Shared UI primitives | 62 | 17 | 8 |
| Card specialist (CardView, BoardCardView, PileView, CommanderPortrait, ManaText) | 2 | 16 | 3 |
| Other (`platform/tabGuard.ts`) | 3 | 0 | 0 |
| **Total** | **374** | **73** | **17** |

- 81% of sites already read a role token, so a live token reaches them with
  no call-site edit.
- Of the 73 literals, 31 equal a token value (a mechanical swap) and 42 sit off
  the scale (10, 13, 15, 17, 18, 22, 24, 26, 30, 34, 52 px).
- **DuelScene holds 36 of the 73 literals** (and 2 derived), plus 52 raw hex
  colour strings, 28 numeric colours and 32 raw `fontFamily` literals: the
  design system's known "remaining application-chrome literals in DuelScene"
  gap. Its tutorial-end, result and reveal overlays are written in raw values.
- The other literal sites: `CardView` 8, `BoardCardView` 5, `choiceOverlays`
  5, `themeWidgets` 3 (the gold badge 20 and the pager arrows 24),
  `CoachMark` 3, `HistoryPanel` 3, `PileView` 2, `ShopScene` 2, and one each
  in `AchievementsScene`, `PreloadScene`, `artGate`, `CommanderPortrait`,
  `MultilineInput` (a DOM `font:14px`) and `ZoneContentsModal`.
- The 17 derived sites: 10 resolve to role tokens (`KeywordGlossaryPanel` 3
  and `themeWidgets` 4 pick between roles; `LimitedScene`,
  `LimitedDeckBuilderScene` and `sceneSubtitle` pass token values through a
  helper); 3 are card-internal (`CardView`'s land-row arrow and "or",
  `ManaText`'s pip numerals); 4 are local constants: the Deck Builder's star
  and pin glyphs (20 and 14 in `deckPanePresentation`), DuelScene's mana-row
  pip text (22), and DuelScene's turn banner, whose 26 px title shrinks to a
  17 px floor when a long name would overflow its frame.

### Token reads frozen at import

`theme.type`: 24 module-scope reads, 408 inside functions. `theme.colors`:
60 module-scope, 757 inside functions. The module-scope reads, which a
runtime scale or palette change would never reach:

| File | `type` | `colors` | Phaser-free |
| --- | ---: | ---: | :---: |
| `src/scenes/ShopScene.ts` | 0 | 41 | |
| `src/ui/profilePresentation.ts` | 20 | 0 | yes |
| `src/ui/themeWidgets.ts` (`BUTTON_STYLE`) | 0 | 16 | |
| `src/ui/settingsPresentation.ts` | 3 | 0 | yes |
| `src/ui/BoardCardView.ts` | 0 | 2 | |
| `src/ui/layout.ts` (`SCENE_TITLE.fontSize`) | 1 | 0 | yes |
| `src/ui/artGate.ts` | 0 | 1 | |

Geometry derived from these at import (for example `SCENE_TITLE`,
`LIMITED_BUILDER_HEADER`) is frozen with them. `SETTINGS_LEFT` was one until
C4, which computes the Settings rhythm when the scene builds.

The other token groups: `theme.graphics` has 164 reads and `theme.alpha` 98,
**all inside functions** (live-able), but `theme.graphics` is itself built at
module scope inside `theme.ts` (lines 32-39, from `colors`), so a palette
swap never reaches it until it is resolved live; `theme.alpha.panel` is the
0.9 every panel uses. `theme.rarity` has 3 module-scope reads, all in
`PackOpeningScene.ts`'s reveal table, and 5 inside functions; rarity is a
specialist palette and stays untouched, so those are fine as they are.

These counts are **direct `theme.<group>.<name>` accesses only**: the script
does not follow aliases or derived constants, so they are a floor.

### Wrapped copy and fixed-height surfaces

- 104 `wordWrap` sites in 28 files. 15 of those files have no fit, ellipsis,
  scroll or pager anywhere: DuelScene (19 wrap sites), LimitedDraftScene (7),
  OddsModal (5), StatsNoticeDialog (3), and 2 or fewer in LimitedScene,
  choiceOverlays, CoachMark, CosmeticPicker, LegalPanel, MainMenuScene,
  SettingsScene, DarlingsTutorial, HistoryPanel, leaveDraftPrompt and Toast.
  These are the first clipping candidates at 115% and 130%.
- 39 `modalShell` call sites: **26 with a literal height**, 10 with a named
  layout constant, 3 sized from their content (the Deck Builder's legality
  modal, `DarlingsTutorial`, `StatsNoticeDialog`). A literal-height modal
  whose copy wraps longer at 130% clips unless it becomes content-sized or
  scrolls.
- **Settings** (a projection of the shipped rhythm with the type terms
  scaled; caption re-wrap not modelled, so the real numbers are worse):

  | Size | Left column bottom (panel 684) | Right column bottom | Accessibility section needs |
  | --- | --- | --- | --- |
  | 100% | 656 (slack 28) | 640 (slack 44) | 180 |
  | 115% | 674 (slack 10) | 651 (slack 33) | 187 |
  | 130% | 692 (**overflows by 8**) | 663 (slack 21) | 193 |

  The 100% re-run reproduces the shipped module's own numbers (656 and 640).
  Slack here is to the panel bottom; the Settings test also holds a 16 px
  `MIN_PANEL_INSET`, so the usable limit is 668 and the usable slack at 100%
  is 12 left and 28 right. The tab layouts are measured under Q1.
- **Literal row heights** are invisible to this scan and to any
  token-scaled test: `limitedPanePresentation.ts` fixes
  `LABEL_LINE_HEIGHT = 18` and `CAPTION_LINE_HEIGHT = 16`, and
  `settingsPresentation.ts` adds a fixed 4 px to its caption line. Each pass
  moves such terms onto the resolver; until then only the rendered probe sees
  their clipping.

### Chrome contrast (WCAG ratio, surfaces opaque)

| Text token | panelFill | btnGhostBg | rowFill | rowFillActive | dim |
| --- | ---: | ---: | ---: | ---: | ---: |
| heading | 15.21 | 13.32 | 13.84 | 12.21 | 16.54 |
| body | 10.31 | 9.02 | 9.38 | 8.27 | 11.21 |
| **muted** | 5.21 | 4.56 | 4.74 | **4.18** | 5.66 |
| gold | 13.44 | 11.77 | 12.24 | 10.79 | 14.62 |
| success | 12.43 | 10.88 | 11.31 | 9.98 | 13.52 |
| danger | 9.94 | 8.71 | 9.05 | 7.98 | 10.81 |
| dangerArmed | 7.58 | 6.64 | 6.90 | 6.08 | 8.24 |

`muted` (used for 12 px captions) misses the 4.5:1 normal-text floor on
`rowFillActive` / `btnEmphasisBg` (the same value) and clears `btnGhostBg`
by 0.06. Panels are drawn at alpha 0.9 over scene art, so real surfaces vary
around these figures. Q6 asks whether to fix the standard palette.

### States that rely on colour

CIEDE2000 distance between the two colours of a state pair, under normal
vision and simulated protanopia, deuteranopia and tritanopia (Machado 2009,
severity 1.0), with the pair's luminance ratio. The script's verdict marks a
worst case under 5 as indistinct and under 10 as weak; those thresholds are
the script's, and for a 3 px stroke on busy art even a larger distance reads
poorly. The non-colour cue column comes from reading the code.

| State pair (when both are on screen) | dE normal / protan / deutan / tritan | Lum. ratio | Non-colour cue today | Verdict |
| --- | --- | ---: | --- | --- |
| Legal target, opponent side, vs a **picked** target | 10.5 / 10.5 / 8.4 / 1.8 | 1.04 | **None.** A picked target reuses the `selectedAttacker` border (`DuelScene.highlightFor`); no badge, lift or count on the tile | **Indistinct** |
| Legal target, your side, vs a picked target | 61.3 / 17.5 / 6.0 / 64.2 | 1.48 | None | Weak |
| `eligible` (can attack / Duty / Link) vs legal target | 27.3 / 2.2 / 7.3 / 40.1 | 1.22 | The action chip names Duty and Link; plain attack eligibility has none | **Indistinct** (protan) |
| Blocking vs pending blocker (also the keyboard-target colour) | 6.5 / 6.3 / 7.4 / 5.0 | 1.27 | None on the tile | Weak |
| P/T damaged vs weakened | 11.8 / 10.3 / 8.1 / 4.8 | 1.27 | None | **Indistinct** (tritan) |
| P/T buffed vs weakened | 56.9 / 15.2 / 5.1 / 55.1 | 1.39 | None | Weak |
| P/T normal vs buffed (the only trace of a **Mark**) | 31.1 / 25.5 / 21.1 / 38.0 | 2.54 | None: `plusOneCounters` has no badge; Starborne rules read "creatures with Marks" | ok by colour, but the Mark count is invisible |
| Face target ring, you vs opponent | 55.7 / 19.6 / 9.1 / 55.6 | 1.64 | Position (whose portrait); the ring's presence means legal | Weak, cued by position |
| Legal target, your side vs opponent side | 64.3 / 23.7 / 10.2 / 63.2 | 1.55 | Board side | ok |
| Eligible vs selected attacker | 33.0 / 19.0 / 12.6 / 22.9 | 1.81 | Selected attackers lift 12 px | ok |
| Attacking vs blocking | 38.4 / 37.2 / 44.2 / 59.5 | 1.25 | Board side; block arrows | ok |
| Legal target vs sacrifice pick | 50.7 / 50.8 / 45.6 / 44.0 | 1.29 | None | ok by colour |
| Filter tab / chip selected (`roundedTrigger`): background | 2.5 / 2.4 / 2.4 / 2.4 | 1.09 | None; the label turns gold (38.5 / 37.5 / 37.2 / 16.4, lum. 1.30) | **Indistinct** background; colour-only label |
| Settings chip selected (`primary` fill vs `ghost`) | 84.5 / 82.0 / 85.2 / 75.3 | 11.77 | Toggles also relabel On/Off | ok |
| Rarity set-icon fill: C vs R / SR vs UR / SSR vs UR | 60.3 all / 32.0 to 11.8 / 30.7 to 17.4 | 8.99 / 1.59 / 1.07 | Tier name in Collection, Pack Opening, Deck Builder filter | ok by colour |
| Rarity tile border: C vs R / SR vs UR | 20.1 all / 35.0 to 10.8 | 2.24 / 1.61 | None on the tile | ok by colour |

States that already carry a non-colour cue: the playable-card dot in hand
(a shape) and the dimmed unplayable card; summoning sickness (a swirl icon);
tapped (rotation); auras (`✦N`); keywords (icons); Quest chapters (`II/III`);
Hauntlink broken (an X); Champion Awakening (a second ring); loot-discard
picks (a lift); destructive buttons (danger label, and an armed state that
names the consequence); warnings and deck-legality notices (they are words).

## Player-facing spec

**Settings.** A player finds an Accessibility group with:

- **Text size:** Standard, Large, Largest (100%, 115%, 130%).
- **High contrast:** Off, On (the existing toggle).

Choosing a size or contrast previews at once: the Settings scene rebuilds
under the new values, and every other scene reads them the next time it is
built. Where the group goes is Q1 (recommended: three tabs).

**The ship gate for a half-built state.** After wave 1 the controls would
offer 115%, 130% and high contrast while no scene has been reflowed. So:

- The two Settings controls are **hidden in production builds** (shown in dev
  builds, `IS_DEV`) until every player-facing scene clears the rendered probe
  in the cells that control opens. Each control has its own switch
  (`FEATURES.textSizeLive`, `FEATURES.highContrastLive` in
  `src/config/features.ts`): high contrast can ship when its three cells
  clear even if 130% text has not.
- The v36 fields land in wave 1 regardless, with their defaults; a hidden
  control leaves them at Standard and off. A stored non-default value is not
  applied while its control is hidden, and never rewritten; when a switch
  flips in a later release, a player carrying a stored value gets it applied
  on that update (a release-note line).
- If any scene misses the 1.9.0 cut, that control does not ship; the schema
  still does, and the control appears in the patch that clears the last
  scene.
- Testers on `release/1.9` will see clipping between waves when they turn the
  controls on in a dev build. That is acceptable only on the release branch;
  nothing on it deploys before the cut.

Draft copy, for the owner's approval (no em-dashes):

- Tab labels (Q1's recommendation): `Game`, `Audio`, `Accessibility`
- Text size caption: `Makes menus and help text larger. Hover over a card to read it up close.` (touch: `Hold a card to read it up close.`, chosen the way the Instant cast caption already picks tap or click)
- High contrast caption: `Brighter text and solid panels. Card art is unchanged.`

**Text size.** Scales the interface's reading text by role (see the policy
below). It does not scale the canvas, card faces, the battlefield, card art or
icons. If a surface no longer fits, it reflows, pages or scrolls; it never
quietly shrinks the text back down, and names keep the house rule (fixed
size, ellipsis).

**High contrast.** Strengthens chrome: brighter secondary text, opaque panels
and backplates, brighter strokes, thicker focus and state outlines. Card art
and card frames are untouched.

**Cue policy (always on, no vision profiles).** Every state a player needs to
make a legal choice has a non-colour cue: shape, label, badge, icon, position
or motion-independent geometry. Nobody has to tell red from green, or orange
from pink, to play. The per-state fixes are listed under Cues.

## Design

### Engine, AI, balance

No rules change. Cues and text size are UI projections of the same
deterministic state; the engine and `PlayerView` are untouched, and AI never
reads colours or rendered strings. Accessibility visuals must not change hit
regions or legal-action computation.

### Text scale, built on the shared layout primitives

Plan-1.9 requires text scaling to sit on the shared primitives (the
design-system tokens, the title-safe frame, `sceneTitle`) and never on
per-scene literals, so 2.0's mobile pass reuses it. Concretely:

1. **One Phaser-free resolver**, `src/ui/accessibility.ts`: the allowed
   scales, `normalizeTextScale`, the role policy, the current values, and a
   setter the boot path and Settings call. `theme.ts` keeps the base sizes as
   `theme.typeBase` (for card-internal geometry and tests) and turns
   `theme.type.<role>` into live reads through the resolver. Because 408 of
   the 432 `theme.type` reads happen inside functions (at scene build), those
   374 token sites scale with no edit. The same resolver makes
   `theme.colors`, `theme.graphics` (today computed once at module scope in
   `theme.ts`) and `theme.alpha` live, which is what lets high contrast reach
   panels: their 164 and 98 reads are already inside functions.
   `theme.rarity` is a specialist palette and is not touched.
2. **Role policy** (recommended, Q3). Reading roles scale fully; headings
   half as much; display sizes not at all (they are already large, and
   scaling a 64 px marquee eats the frame). Rounded to whole pixels:

   | Role | Base | Large (115%) | Largest (130%) |
   | --- | ---: | ---: | ---: |
   | `displayXL` | 64 | 64 | 64 |
   | `display` | 44 | 44 | 44 |
   | `h1` | 28 | 30 | 32 |
   | `h2` | 20 | 22 | 23 |
   | `body` | 16 | 18 | 21 |
   | `label` | 14 | 16 | 18 |
   | `caption` | 12 | 14 | 16 |
   | `micro` | 11 | 13 | 14 |

   Control heights (30 and 40 px) and the 44 px hit floor still contain the
   largest label and caption. `themedButton` measures its label, so a button
   widens past its `minWidth`; but any layout that places controls from
   **fixed widths** does not follow. Settings is the known case:
   `NO_BLOCK_WIDTHS = [80, 120, 70]`, `ANIM_CHIP_WIDTH = 82` and
   `RENDER_CHIP_WIDTH = 84` place the chips, and "Only when lethal" overruns
   120 px at 130%. C4 places every chip group measure-then-place (the header
   pair's rule) or from widths scaled with the resolver, and each scene pass
   does the same for its fixed-width groups.
3. **Module-scope reads become lazy.** The 24 frozen `type` reads and the 60
   frozen `colors` reads above are converted to getters or functions that keep
   their exported shapes, so consumers need no edit (`SCENE_TITLE.fontSize`
   becomes a getter; `profilePresentation`'s constants become getters;
   `BUTTON_STYLE` resolves per draw). Geometry derived from type sizes (the
   Settings rhythm, Limited's header bands) is computed when the scene
   builds, not at import.
4. **Literal sizes.** Each of the 73 literal and 17 derived sites gets one of
   three decisions, recorded in the wave that touches its file: a role token;
   card-internal geometry (the 16 specialist literals and 3 specialist
   derived sites stay, documented in their module); or HUD numerals that are
   deliberately fixed (a life total, the tutorial-end marquee), named as
   constants beside a comment. No new literal lands in chrome after wave 1.
5. **Fit rules.** Fit-to-box (`fitWrappedText`) stays the card-face rule only.
   Chrome copy reflows: a literal-height modal becomes content-sized, pages,
   or scrolls. DuelScene's turn-banner title keeps its shrink-past-the-cap
   rule (a single line naming the turn owner) with its 17 px floor.
6. **For 2.0.** The mobile pass adds a device term to the same resolver (for
   example a phone type floor) and reuses the layout functions; it never
   forks sizes per scene.

### High contrast

The same resolver serves a second value set for `theme.colors`, the
`theme.graphics` numbers derived from it, and `theme.alpha`, read live exactly
like the type roles:

- Every **used** text-on-surface pair reaches **7:1** (today `muted` and
  `dangerArmed` do not; the others already do, see the contrast table). The
  used set is the table's 35 pairs plus `onGold` on `btnPrimaryBg` (13.18:1)
  and `danger` on `dangerBg` (8.12:1). Pairs never drawn are not gated: `gold`
  on `btnPrimaryBg` is the same hex (1:1) and `muted` on it is 2.58:1.
- `theme.alpha.panel` (and the modal dim) go to 1, so scene art cannot lower
  contrast; `theme.graphics.panelStroke` brightens; focus and board state
  outlines thicken (3 to 5 px on tiles).
- Operational text over art gets a stronger backplate (the tile name scrim
  0.62 to 0.85).
- Card art, card frames, mana pips and rarity materials are not touched
  (the design system's specialist palettes).

Reach: raw colour and font literals bypass the tokens. Outside `theme.ts`,
scenes hold 65 hex strings, 44 numeric colours and 35 raw `fontFamily`
values in 6 files, 80 of the colours and 32 of the families in DuelScene;
shared primitives hold 9, 15 and 7 (HistoryPanel and CoachMark lead). The
numeric counts are a text match on `0x` plus six hex digits, so a few may be
non-colour constants. Each
scene pass tokenises its chrome literals; specialist palettes stay raw by
the design system's rule.

### Cues

| State | Fix (always on) | Where | Wave |
| --- | --- | --- | --- |
| A picked target (one or two targets, either side) | A pick badge on the tile showing the pick order (1, 2), plus the border; the prompt keeps its count | `BoardCardView` setter, fed by DuelScene's `targetPicks`; coordinate with A2's two-target flow, which lands just before | 2 (program 3) |
| Blocking vs pending blocker | The pending blocker lifts like a selected attacker, and carries a "Blocks" chip once assigned | DuelScene (`creatureY`), `BoardCardView` chip | 2 |
| Keyboard target | Its own focus cue (corner brackets), separate from every state colour; it no longer borrows the pending-blocker colour | `BoardCardView`, DuelScene | 2 |
| Eligible to attack | The action chip gains "Attack" in declare-attackers, as it already says "Duty" and "Link" | `permanentActionLabel` in `duelPresentation.ts`, called from DuelScene | 2 |
| Damage, buff, weaken on P/T | A glyph on the P/T plate: a damage mark when damaged, an up or down chevron when the printed stats are raised or lowered | `BoardCardView.setStats` | 2 |
| Marks | A Mark badge with the count, in the free corner (the same corner-plate look as the aura badge) | `BoardCardView`, DuelScene sync | 2 |
| Filter tab or chip selected | The shared trigger gains a non-colour selected mark (a gold underline bar, or a stroke plus a check), once, in the primitive | `themeWidgets.roundedTrigger` | 1 (program 2) |
| Rarity where it drives a decision | The tier name as text in the zoom/inspect preview and wherever shards or crafting read rarity; the face keeps its fill | `CardZoomPreview`, the relevant scenes | 3 (program 4) |
| A picked card in the graveyard target picker | Today only dimmed to `alpha.subtle` (DuelScene ~6931); it gets the same pick badge as the board | DuelScene's grave picker | 2 |
| A picked player target | Today the ring is identical before and after the pick (`syncFaceTargeting`, DuelScene ~1583-1592); the portrait and life badge get the same pick badge | DuelScene, `CommanderPortrait` | 2 |
| Face target ring (legal, you vs opponent) | Position already disambiguates; no change | | none |
| `ZoneContentsModal` actions | Out of scope: an action selects and closes the modal, so there is no picked state; an unavailable action is dimmed with no input, the design system's disabled rule | | none |
| Mana identity | Already sigil plus colour; no change | | none |

Two constraints the cue mock must settle before the Duel pass builds:

- **`StatsMood` is exclusive.** DuelScene (~4046-4049) passes one mood:
  `damaged` wins and hides `buffed` or `weakened`, and Marks fold into
  `buffed` through the effective stats. A damage mark plus a chevron, and a
  Mark badge separate from other buffs, need `setStats` to carry damage, the
  stat delta and the Mark count as separate inputs.
- **The "Attack" chip needs a priority** against the labels
  `permanentActionLabel` already returns (Link, Relink, Duty): the mock fixes
  which one a permanent shows when two apply.

The cue designs are drawn in a mock for the owner before the Duel pass
builds them (taste; Q5). The state-to-cue table lives in a Phaser-free
module (`src/ui/boardCuePresentation.ts`, wave 1) so tests can assert the
rule; `BoardCardView` moves onto it in the Duel pass.

**The cue mock, RULED 2026-09-28** (the owner's second sitting, M1-M6 on
its sheet, all as recommended). All six are built in the Duel pass
(program wave 3), after A2's two-target flow:

- **M1** The tile chip ("Attack", "Duty", "Blocks") moves from the top-right
  corner to a tab on the top edge, so a summoning-sick blocker's "Blocks"
  never sits on the swirl.
- **M2** Declared attackers stay lifted for all of combat and drop their
  ring while you choose targets: a ring cannot carry both "attacking" and
  "legal target" under the colour-vision check, so while targeting a ring
  means "legal" only.
- **M3** A one-target spell shows a "1" badge on its pick, as two-target
  spells do.
- **M4** A picked graveyard card gets the pick badge instead of today's fade
  (the fade reads as "unavailable").
- **M5** The P/T up and down arrows count Marks, so they agree with the
  numbers on the plate. (How this meets the `StatsMood` constraint above,
  e.g. whether the Mark badge also says how much of the change is Marks,
  is the Duel pass's call.)
- **M6** An attacker you have already picked keeps its "Attack" chip (the
  lift also shows it).

`boardCuePresentation.ts` already encodes M2-M6 (the ring yielded while
targeting, the "1" badge, the grave badge, chevrons from the effective
stats, the Attack chip on a selected attacker); M1 is placement, drawn in
`BoardCardView` by the Duel pass.

## Save-schema impact (v36, the one 1.9 bump)

```ts
settings: {
  // existing settings remain
  /** Stored as a number; the allowed set is a normalization rule. v36. */
  textScale: number;
  /** v36; defaults off. */
  highContrast: boolean;
};
```

- **One migration, v35 to v36.** It adds both fields (defaults `1` and
  `false`) and carries **I7's stored Premium draft note** (lane I). Nothing
  else in 1.9 changes the schema. C1 edits the `settings` interface
  (`SaveManager.ts` ~227 on), `freshSave`'s settings defaults (~346-363), the
  shared block's version list and the new step.
- **The step can be amended until the cut.** An unshipped schema is still one
  bump: C1 lands the v36 step with the accessibility fields, and I7's owner,
  who owns its field's shape, adds that field to the same v36 step (and its
  golden test) in one follow-up PR in the same program wave. The v36 golden
  blob updates with it. After the 1.9.0 cut the step is frozen and any further
  change is v37.
- **`textScale` normalization.** Not a finite number: `1`. Otherwise it snaps
  to the nearest allowed value (today 1, 1.15, 1.3; a tie takes the smaller).
  Changing the allowed set later only changes this rule, so a stored 1.3 that
  is no longer allowed snaps on the next load, with no schema change.
  `highContrast` is `=== true`.
- **Two traps in the chain** (`SaveManager.migrate`):
  - The shared block (at `cur.version === 22 || ... || cur.version === 34 ||
    cur.version === CURRENT_SAVE_VERSION`) enumerates every version from 22 up
    **by hand**. The bump must add `cur.version === 35` to that list, or every
    v35 save skips the block.
  - That block rewinds an up-to-date save to v22 and re-walks the chain, so the
    v35 to v36 step runs on **every load**, not once. It must normalize the
    value present (keep a stored 1.3 and `true`) and default only when the
    field is absent or garbage. It must not reset (the v34 to v35 step
    documents the same trap for the stats choice).
- **Tests.** A v35 golden blob migrates to `textScale 1`, `highContrast
  false` with every other setting unchanged; a v36 blob with 1.3 and `true`
  reloads unchanged; garbage (`'big'`, `NaN`, `2`, `-1`) normalizes to the
  rule's answer; the I7 field migrates. The save-code golden fixtures
  (`tests/meta/saveCode.fixtures.ts`) must still import.
- **Import.** A save code or save card carries both fields like every other
  setting (Q7).

## Waves mapped to the 1.9 program

Accessibility wave 1 lands in **program wave 2** with the v36 bump; wave 2 in
**program wave 3**; wave 3 in **program wave 4**. Program wave 1 carries only
this re-verification.

### Wave 1 (program wave 2): foundations, no broad scene edits

Five PRs. File sets are disjoint, so parallel agents never share a file.

| PR | Work | Files | Runs |
| --- | --- | --- | --- |
| **C1** Save v36 | The `settings` interface, `freshSave` defaults, the shared block's version list, the v35 to v36 step with both fields and normalization; the tests above | `src/meta/SaveManager.ts`, `tests/meta/saveMigrations.test.ts` | First in program wave 2; I7's owner then adds I7's field to the same step in one follow-up PR (same two files, so it runs after C1, never beside it) |
| **C2** Resolver | `accessibility.ts` (allowed scales, `normalizeTextScale`, role policy, palettes, setter); `theme.type`, `theme.colors`, `theme.graphics` (no longer computed once at import) and `theme.alpha` become live reads over `theme.typeBase` and the two palettes; `theme.rarity` untouched | NEW `src/ui/accessibility.ts`, `src/ui/theme.ts`, `tests/ui/theme.test.ts`, NEW `tests/ui/accessibility.test.ts` | Beside C1 |
| **C3** Live chrome | The module-scope reads made lazy with their export shapes kept; `BUTTON_STYLE` per draw; the `roundedTrigger` selected cue; the three `themeWidgets` literals and `MultilineInput`'s `font:14px` to tokens | `src/ui/themeWidgets.ts`, `src/ui/layout.ts`, `src/ui/profilePresentation.ts`, `src/ui/artGate.ts`, `src/ui/MultilineInput.ts`, `tests/ui/profilePresentation.test.ts` | Beside C1; merges after C2 |
| **C4** Settings | The Accessibility controls in the owner's chosen layout (Q1), hidden in production builds until the ship gate clears; the rhythm computed at build with every vertical term (including the caption line's fixed 4 px) on the resolver; every chip group measure-then-place or width-scaled; live preview by rebuilding the scene; the boot hook that applies the saved values | `src/scenes/SettingsScene.ts`, `src/ui/settingsPresentation.ts`, `tests/ui/settingsPresentation.test.ts`, `src/gameBoot.ts`, `src/config/features.ts` (the two switches), `src/scenes/ProfileScene.ts` (the import hook), `src/ui/statsPrivacyPresentation.ts` and its test (the Privacy row's y moves to the rhythm) | After C1, C2 and Q1; copy approved by the owner |
| **C5** The gate harness | The headless half of the fixture matrix (below), enrolling only the wave-1 modules (Settings after C4, `layout.ts` headers, Profile); `boardCuePresentation.ts`; the rendered probe; design-system.md's text-scale, high-contrast and selection-cue sections | NEW `tests/ui/accessibilityLayout.test.ts`, NEW `src/ui/boardCuePresentation.ts`, NEW `tests/ui/boardCuePresentation.test.ts`, NEW `tests/ui/colourVision.ts` (the CIEDE2000 and CVD helper), NEW `src/dev/a11yProbe.ts`, `docs/design-system.md` | Last, after C2-C4 |

`ShopScene`'s 41 module-scope colour reads wait for the Shop pass in wave 2.
`gameBoot.ts` may also be touched by lane D's streaming boot work in program
wave 2: whichever lands second rebases a one-line hook. `docs/design-system.md`
is edited in the same program wave by R13 (the card anatomy loses flavor) and
by C5: **R13 first**, then C5.

### Wave 2 (program wave 3): core scenes

One pass per scene: literal sizes and raw chrome colours to tokens,
literal-height modals made content-sized or scrolling, the cues applied, and
each scene cleared by the probe in all six cells. File sets:

- Main menu: `MainMenuScene.ts`, `mainMenuPresentation.ts`
- Play: `PlayScene.ts`, `PracticePickerScene.ts`, `GauntletScene.ts`
- Deck Builder: `DeckBuilderScene.ts` and its presentation modules (`deckPanePresentation`, `deckPoolLayout`, `deckListPaging`, `deckShopLayout`)
- Collection: `CollectionScene.ts`, `src/ui/binder/*`
- Shop: `ShopScene.ts`, `OddsModal.ts`
- Profile: `ProfileScene.ts` (its presentation module converts in C3)
- **Duel, last:** `DuelScene.ts`, `BoardCardView.ts`, `duelLayout.ts`,
  `duelPresentation.ts`, `choiceOverlays.ts`, `CoachMark.ts`,
  `HistoryPanel.ts`, `ZoneContentsModal.ts`, `StackDisplay.ts`,
  `CommanderPortrait.ts`, `PileView.ts`

**Shared-file order** (plan-1.9's Sequencing, restated with this lane's
reading):

- `src/scenes/DuelScene.ts`: I6 and I9 (program wave 1), then lane D's duel
  preload (program wave 2), then A2's two-target flow, then this Duel pass
  (both program wave 3). The pick badge lands after A2 so it numbers A2's
  picks.
- `src/ui/CardView.ts`: R13 first, then lane D's redraw and eviction hooks,
  then accessibility. **This lane plans no CardView change**: card faces are
  exempt, and rarity text goes in `CardZoomPreview`. If the wave-2 review
  finds one, it waits for both.
- `src/ui/BoardCardView.ts` is **not yet in plan-1.9's list** and should be:
  lane D's texture eviction may touch it in program wave 2; this lane's cues
  follow in the Duel pass.

### Wave 3 (program wave 4): the long tail

Limited (`LimitedScene`, `LimitedDraftScene`, `LimitedDeckBuilderScene`, the
limited presentation modules, `leaveDraftPrompt`), Pack Opening (with
`packRunwayPresentation`, `boosterStripLayout`), Achievements, Glossary and
`KeywordGlossaryPanel`, the tutorial surfaces (`DarlingsTutorial`, the
tutorial branch of the Duel after its pass), the dialogs (`StatsNoticeDialog`,
`StatsPrivacyPanel`, `LegalPanel`, `CosmeticPicker`, `Toast`,
`VersusBumper`), boot and preload surfaces, empty and error states, rarity
text in `CardZoomPreview`, and the pseudo-long English fixtures (longest deck
names, longest card names, seven-digit gold, maximum list lengths). R13 and
I7 touch the Limited files in program wave 2, before this.

### Wave 4: the localization record

Closes by recording option A (see the record below). No build work.

## Gates

**1. The scale-and-contrast fixture matrix.** Six cells: text size {100, 115,
130%} x contrast {standard, high}. Two halves, and no Phaser in tests:

- **Headless (Vitest, C5).** For each cell, with the resolver set:
  - every **enrolled** Phaser-free layout module keeps every placed control
    inside the title-safe frame, sibling hit boxes disjoint by the
    within-group gap, and content above each panel's bottom inset. These are
    rule assertions (inside the frame, a minimum gap), not pinned
    coordinates. **A module is enrolled when its pass lands**, never before:
    enrolling early makes the suite red on work not yet done (Settings is
    already at 692 against 684 at 130% before C4). C5 enrols the wave-1
    modules only (Settings, the `layout.ts` headers and `SCENE_TITLE`,
    Profile); each scene pass enrols its own modules (Limited panes, the duel
    layout, ...) in the same PR that moves their line heights onto the
    resolver;
  - what this half can prove: the rule, for modules whose **every vertical
    term derives from tokens**. A literal row height (`LABEL_LINE_HEIGHT = 18`
    in `limitedPanePresentation.ts`, the fixed 4 px in Settings' caption line)
    does not grow with the scale, so a token-scaled test passes while the
    rendered text clips. The rendered probe is the only clipping detector;
  - the resolver's rules: each role at each size, and normalization of
    arbitrary input to the rule's answer;
  - token contrast over the **used pair set** (the contrast table's 35 pairs
    plus `onGold` on `btnPrimaryBg` and `danger` on `dangerBg`): 4.5:1 or
    better in standard (after Q6) and 7:1 or better in high contrast. Pairs
    never drawn are not asserted (`gold` on `btnPrimaryBg` is 1:1 by design);
    a new pairing joins the set in the PR that draws it;
  - cue distinctness: every pair of states that can be on screen together
    (declared in `boardCuePresentation`) differs in a non-colour channel, or
    stays 10 or more apart in CIEDE2000 under simulated protanopia,
    deuteranopia and tritanopia, in both palettes;
  - the v36 migration goldens (C1).
- **Rendered (the probe, `src/dev/a11yProbe.ts`).** The main session imports
  it into the preview through the dev server and drives it with the
  playbook's probe recipe. It boots each scene of the wave's list with
  fixture data in each cell, walks the display list, and reports every
  visible Text that sits outside the title-safe frame, outside its modal
  panel or declared box, overlaps another visible Text, or is scaled below 1
  without being declared fit-to-box. It writes a JSON report and a canvas
  snapshot per cell. The gate: zero findings on the wave's scenes, or each
  remaining one listed in this doc and approved by the owner. Glyph widths are
  font-fallback dependent on Windows, so only this rendered half measures
  text; the headless half never estimates it.

**2. The human review.** Recorded here per wave (date, scenes, cells,
result). In the displayed browser with Chrome's vision-deficiency emulation
(protanopia, deuteranopia, tritanopia, achromatopsia): Duel targeting with
one and two targets on both sides, declare attackers and blockers, damage,
buffs, weakening and Marks on tiles, a pack reveal, and selection in Settings
and the filters. Then a clipping pass at 130% on every scene in the wave.
Automated checks are never presented as certification.

**3. No gameplay re-measure** unless duel dispatch changes. The cue work is
presentation. If the Duel pass changes `validateAction`, action dispatch or
targeting input (keyboard targeting included), run
`npx tsx scripts/balance-matrix.ts --avatars --seeds 40` and
`npx tsx scripts/balance-matrix.ts --floors --seeds 80` on an idle machine;
floors only ratchet. Progression simulation and the metagame sweep are not
gates here: prices, rewards, cards and AI do not change.

Every PR also runs the ladder: `npx tsc --noEmit`, `npm run lint`, targeted
Vitest, the full suite before merge, `npm run build`, `npm run check-docs`.

## Localization record (wave 4)

**RULED 2026-09-25: option A, English only** (D3). The 1.7 draft offered
three options: A English only, B catalog-ready English (keys, pseudo-locale,
formatter, fallback fonts), and C a full second locale; it recommended B to
buy reversibility before Story Mode's corpus. The owner chose A. What that
means:

- No `settings.locale`, no `src/i18n/`, no string catalog, no pseudo-locale,
  no hardcoded-string audit.
- 2.0 carries no localization promise. The retrofit risk the draft named
  (Story Mode and more sets adding thousands of strings) is accepted.
- The pseudo-long English strings stay in wave 3's fixtures, because text size
  needs them either way.
- Standing rules that cost nothing and keep a later reversal cheap: engine
  types, actions and events keep stable ids; nothing parses player-visible
  text to decide a rule; saves and share codes store ids, never names.

Wave 4 closes when this record is confirmed in the 1.9 release notes' scope
line. No other deliverable.

## Open questions for the owner

Recommendation first.

- **Q1 Where the Accessibility settings go (new; needed before C4).**
  Measured: both Settings columns are full (the test says so), and at 130%
  the left column overflows by 8 px before anything is added. A tab row
  costs at least 44 + 12 px above the panels (top 124 to 180). Column
  bottoms, projected with the shipped rhythm (read-only script
  `<scratchpad>/w1-a11y/settings-tabs.ts`), against the usable limit of 668
  (684 minus the 16 px inset); the last figure assumes every caption wraps
  one more line at 130%, which the projection cannot measure:

  | Layout | 100% | 115% | 130% | 130%, captions re-wrapped |
  | --- | --- | --- | --- | --- |
  | Shipped, no tabs (left / right) | 656 / 640 | 674 / 651 | 692 / 663 | 770 / 722 |
  | Two tabs, Game tab (Animations moved out) | **712** / 628 | 730 / 638 | 748 / 647 | 826 / 686 |
  | Two tabs in the header band, panels keep top 124 | 656 / 572 | 674 / 582 | 692 / 591 | 770 / 630 |
  | Three tabs (Game, Audio, Accessibility), Render size stays in Game | 488 / 628 | 501 / 638 | 514 / 647 | 573 / **686** |
  | **Three tabs, Render size moves with Animations** | 488 / 560 | 501 / 568 | 514 / 576 | 573 / 595 |
  | Its Accessibility tab (4 captioned rows, one column) | 496 | 506 | 516 | 595 |
  | Its Audio tab | 404 | 409 | 414 | 433 |

  Two tabs do not fit: the Game tab's left column overflows even at 100%,
  and moving Privacy right does not fit either (in the header-band layout the
  right column keeps 77 px of usable slack at 130% once Animations leaves;
  the Privacy section needs about 140). Tabs in the header band keep the left
  column's 130% overflow. **Recommendation: three tabs, `Game`,
  `Audio` and `Accessibility`**, with Text size, High contrast, Animations and
  Render size in the third (the owner may prefer to call it `Display`). It is
  the only measured layout that fits every cell with room (73 px or more even
  with every caption re-wrapped). Whatever the layout, C4 also puts the
  rhythm's vertical terms on the resolver; that is required, but it adds
  height rather than making room. The fallback if the rendered probe still
  clips: a scrolling column, which always fits at the cost of a scroll on the
  Settings page.
- **Q2 The scale values.** **Recommendation: keep 100, 115, 130%.**
  Storage as a number with the set as a normalization rule is already RULED
  (plan-1.9 lane C), so the set can change after the fixtures without a
  schema change.
- **Q3 Which text scales.** **Recommendation: the role policy above**
  (reading roles fully, headings half, display sizes not at all; card faces
  never, with the zoom preview as the way to read a card larger).
- **Q4 High-contrast scope.** **Recommendation: chrome, text backplates,
  focus and board state outlines; card art and frames untouched.** (The 1.7
  draft's recommendation, made concrete: 7:1 for chrome text.)
- **Q5 Cue policy.** **Recommendation: always-on cues, no vision profiles**
  (the 1.7 draft's recommendation; a profile toggle creates untested
  combinations). The specific designs (pick badge, P/T glyphs, Mark badge,
  focus brackets, the selected-trigger mark) go to the owner as a mock before
  the Duel pass builds them. (The mock was shown and ruled on 2026-09-28,
  M1-M6: see "Cues".)
- **Q6 The standard palette's `muted` (new).** Measured at 4.18:1 on the
  emphasis surfaces, under the 4.5:1 floor for its 12 px captions.
  **Recommendation: lighten `muted` in the standard palette just enough to
  clear 4.5:1 on every surface it is drawn on in the used set** (a small,
  visible change; the value is
  measured in C2).
- **Q7 Accessibility settings on import (new).** **Recommendation: they
  travel with the save** like every setting except the stats choice, because
  the person who set them owns the save. No special case in `replace`. As
  with every bump, a save code written at v36 will not import into an older
  build such as a desktop app not yet updated: `SaveCode.ts` refuses it with
  `future-version` ("created by a newer version").
- **Q8 Telemetry (new).** Adding the two settings to the heartbeat would show
  how many players use them, but it changes the fields sent and so re-arms the
  stats notice for every player. **Recommendation: not in 1.9.**

**Ruled at the owner's second sitting (2026-09-28): the picks C4's build
raised** (A9-A14 on its sheet), all as recommended:

- **A9 Button hover in standard contrast.** Primary and danger buttons
  barely change on hover today (1.17:1 and 1.66:1). They gain a 2 px hover
  border in standard contrast too, on hover only; the idle look is
  unchanged. (High contrast already has it.) *To build.*
- **A10 The Accessibility tab's heading** stays "Display" (Audio keeps
  "Audio"). *No change.*
- **A11 The Game tab's two columns end level** (Privacy beside Save data)
  when that fits. *To build.*
- **A12 The touch caption** reads "Makes menus and help text larger. Hold a
  card to read it up close." *Approved as written;* C4 already draws it on
  touch (`SettingsScene.ts`), so the build item is a check that it shows.
- **A13 A hidden control's saved value is not applied** (no player is stuck
  at a size they cannot undo), as C4 built it (`src/config/features.ts`).
  Flipping a ship gate later applies the stored values, so the release that
  flips `textSizeLive` or `highContrastLive` carries a release-note line
  saying a saved size or contrast choice takes effect. *On the cut
  checklist.*
- **A14 Settings does not remember the last tab** across visits: it opens on
  Game, one tap from Privacy. *No change.*

A9, A11 and A12 are small and share C4's files (`themeWidgets.ts` for the
hover border; `settingsPresentation.ts` and `SettingsScene.ts` for the
columns and the caption), so plan-1.9 proposes them as one small PR, C6.

**Already ruled:** localization, option A (D3, 2026-09-25); translation scope
and a second language (closed by D3); mobile at 2.0 (D4); one save bump, v36,
with I7 riding it; `textScale` stored as a number (plan-1.9 lane C).

## Risks and dependencies

- **Scaling a fixed 1280x720 canvas exposes hardcoded heights.** 26 modals
  have literal heights and 15 files wrap copy with no overflow handling; the
  probe finds the real clips, and the scene passes own the fixes.
- **DuelScene carries most of the debt** (36 literal sizes, 80 raw colours,
  32 raw font families, 19 unhandled wrap sites) and sits last in a
  four-lane file order. If program wave 3 slips, the Duel pass moves into
  program wave 4 beside the long tail; it does not start early.
- **High contrast can erase state distinction** if it recolours state cues;
  it only thickens them, and the cue test runs in both palettes.
- **The migration trap** (the hand-written version list and the every-load
  re-walk) is the one way C1 silently resets a player's settings.
- **The half-built state.** Between waves the controls would expose sizes no
  scene has been reflowed for; the ship gate keeps them hidden in production
  builds until the probe clears, and a scene that misses the cut holds its
  control back, not the schema.
- **Shared files with other lanes:** `DuelScene.ts`, `CardView.ts`,
  `BoardCardView.ts`, `gameBoot.ts` and `docs/design-system.md` (above);
  `SaveManager.ts` with I7 (C1, then I7's follow-up on the same v36 step); the
  Limited files with R13 and I7 (program wave 2, before wave 3).
- **2.0 mobile** multiplies reflow cases; building on the resolver and the
  layout functions is the mitigation, and `docs/plan-mobile-overhaul.md`
  should read this plan's resolver before it adds a phone profile.
- **Save portability** (`docs/plan-save-portability.md`): save codes and save
  cards carry the two fields; old codes still import.

## Acceptance criteria

- Every state needed to play (legal targets, picked targets, selection,
  attackers and blockers, damage, buffs and weakening, Marks, warnings and
  destructive actions) has a non-colour cue, and the cue test passes in both
  palettes. Mana identity keeps its sigils.
- Every player-facing scene clears the rendered probe in all six cells, or
  each remaining finding is listed here and approved.
- Existing saves migrate to Standard text and high contrast off with no other
  setting drift; the settings persist through reload and through save-code
  and save-card export and import.
- Changing either setting in Settings previews at once; other scenes use it
  when next built.
- Each control is visible in production builds only once every
  player-facing scene clears the probe in the cells it opens; the v36 fields
  ship either way.
- Every literal font size in chrome is a role token or a named, commented HUD
  constant; card-internal sizes are documented in their modules.
- Every used text-on-surface pair meets 4.5:1 in the standard palette and
  7:1 in high contrast.
- The human colour-vision and clipping review is recorded here for each wave.
- The localization record (option A) is confirmed in the 1.9 release notes.
