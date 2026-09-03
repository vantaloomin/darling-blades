<!-- source-of-truth: src/ui/themeWidgets.ts, src/ui/modalDismissPresentation.ts, src/ui/Toast.ts, src/ui/toastQueue.ts, src/ui/navigation.ts, src/ui/deckBuilderHelpers.ts, src/ui/Dropdown.ts, src/ui/CardView.ts, src/ui/ManaText.ts, src/ui/CardThumbCache.ts, src/ui/CardZoomPreview.ts, src/ui/ZoneContentsModal.ts, src/ui/inspectHotkeys.ts, src/ui/OverlayCoordinator.ts, src/ui/CoachMark.ts, src/ui/KeywordGlossaryPanel.ts, src/ui/KeywordIcons.ts, src/scenes/GlossaryScene.ts, src/ui/MultilineInput.ts, src/platform/gestures.ts, src/ui/layout.ts, src/ui/theme.ts · last-verified: 2026-09-03
     If you change those files, update this doc or re-verify the date. -->

# Reusable UI components

The catalog of shared presentation building blocks. **Check here before
building new UI**: if a scene needs a button, modal, dropdown, card
rendering, tap handling, or inspect behavior, one of these already does
it with the design-system rules (docs/design-system.md) baked in. When
you extract a new reusable piece, add its row here in the same commit -
this doc is the discovery surface that keeps five scenes from growing
five slightly different modals (which is exactly how the pre-1.3 inspect
hotkeys drifted apart).

All components read tokens from `src/ui/theme.ts` (colors, spacing grid,
type scale, depths, hit floors). Never hand-roll a color or a hit size a
token already names.

## Buttons, panels, modals - `src/ui/themeWidgets.ts`

| Export | What it is |
| --- | --- |
| `themedButton` | The standard button (primary / emphasis / ghost / danger variants, sm sizing, min-width, enabled state, measured bounds, inflated hit zone). |
| `roundedTrigger` | Chip-style trigger (the dropdown face): auto-sizes to its label, `setLabel` re-measures, selected/hover states. With `parts` it renders a muted label, a gold value (`setValue`) and a fixed chevron slot that flips while open (`setOpen`), sized once to `maxValueWidth` so a filter row never reflows on selection. |
| `modalShell` | The one modal: dim layer, panel, title/content/footer tracks, one named `dismissal` preset resolved by `modalDismissPresentation`, `onClose`, OverlayCoordinator registration, and `close()`. Presets derive Esc, tap-dim, and close-button behavior. The old flags remain deprecated only for shared helpers outside this migration. Every dialog uses this - OddsModal, deck previews, the pack-pull inspect, the touch land-styles picker. |
| `registerSceneBackNavigation` | One scene-lifetime ESC route. It dismisses the topmost registered modal, then invokes the screen's back action, and removes its keyboard listener on SHUTDOWN. |
| `createMultilineInput` | DOM textarea with selectable long text, keyboard/touch input, and OverlayCoordinator suppression support. Use it for save-code or other bounded multiline fields. |
| `pager` | The ‹ N/M › page control (deck lists, collection pages). |
| `panel` / `backButton` / `goldBadge` | Framed surface, the standard top-left destination-named back control, the gold readout with flash/shake affordance. `backButton` requires the destination label. |

## Selection - `src/ui/Dropdown.ts`, `src/ui/binder/FilterBar.ts`

`Dropdown<T>` is the compact select (trigger + popover rows, outside-click
close, sibling-close via `onOpen`). Since 2026-09-03 the popover is one
surface sized to its content (`dropdownPanelWidth`: the longer of the trigger
and the longest option label plus the check slot), rows are unpainted at rest
with `rowFill` on hover and `rowFillActive` plus a gold check on the selection,
and a list of more than seven options puts its first entry on a full-width
row above a hairline and the rest in two column-major columns
(`dropdownColumnCount`, `dropdownPopoverLayout` returns the row rects and the
separator for both shapes). The trigger is fixed to its longest value at
construction, so a row of dropdowns no longer resizes on selection; the
`hitBounds`/`setX`/`containerX` reflow path in FilterBar stays as the safety
net, keeping 8px between inflated hit rects.

## Card rendering - `CardView`, `CardThumbCache`, `CardZoomPreview`

- `CardView` is the single card renderer (frame, art, stats, set icon,
  variants, full-art, land styles via `landStyle`). Never draw a card by
  hand.
- `renderManaText` / `segmentManaText` compose brace-token mana costs into
  wrapped text with baked pip images. Use this anywhere player-facing copy
  contains `{2}{B}`-style interchange tokens; keep the returned Text and pips
  in the same container so dynamic-texture bakes retain them.
- `ensureCardThumb` / `makeCardThumb` bake-and-cache static thumbnails;
  the cache key includes every render-affecting input (card id + land
  style today) - extend the key when you add one, or stale thumbs leak
  across contexts.
- `CardZoomPreview` is the hold-Z zoom; `gestures.ts`'s sticky-preview
  host is the long-press equivalent on touch.
- `showZoneContents` is the shared public-zone browser. It owns paged card
  thumbnails, inspect callbacks, and optional action chips such as a graveyard
  card's Retell cost; action input lives on a child Zone, never its Container.

## Input - `src/platform/gestures.ts`, `src/ui/inspectHotkeys.ts`

- `bindTapButton` is the ONLY sanctioned tap binding (pointer-up
  discipline, touch pressed states). Never raw `setInteractive` +
  `pointerdown` - and never `setInteractive` on a scaled Container
  (playbook trap #1).
- `inflateHitArea` applies the documented minimum hit region; pair it
  with the design system's 8px/12-16px separation rules.
- `bindInspectHotkeys` is the shared card-inspect keyboard convention
  (LEFT/RIGHT step, ESC close). Bind when an inspect surface opens,
  call the returned unbind when it closes. PackOpening uses it;
  Collection and Shop predate it with scene-lifetime bindings of the
  same convention - migrate opportunistically, never double-bind.

## Overlays and guidance

- `OverlayCoordinator` + `Modal.modalGuardTarget`: overlay stacking,
  dismissal precedence, and input guarding for whatever sits beneath.
  Anything that floats registers here or fights the ESC ordering.
- `Toast`: the shared right-rail engraved-plaque host. It enters with a gold
  shine sweep, stacks up to three notices, collapses larger bursts to a
  caller-supplied summary, and pauses behind a `ModalGuard` or an owner-supplied
  blocking predicate. Notices persist across scene handoffs until a host can
  present them at a safe boundary.
- `modalShell` also participates in the scene-local modal stack used by
  `registerSceneBackNavigation`, so a modal opened after scene creation still
  wins the next ESC press. Its named dismissal preset determines whether the
  shell closes by Esc, tap-dim, or close button. A non-dismissible modal
  consumes ESC without navigating away.
- `CoachMark`: tutorial cue ring + info cards; anchors via live
  `getBounds()` so layout changes never orphan it.
- `GlossaryScene` (`src/scenes/GlossaryScene.ts`): the full rules reference.
  Category rail plus one measured, scrolling, searchable term list. Every term
  comes from `src/data/glossary.ts` and every coordinate from `glossaryFrame` /
  `glossaryRowsLayout` (`src/ui/layout.ts`), so adding a keyword changes how far
  the list scrolls and nothing else. It replaced a fixed-coordinate two-panel
  page that pinned a Y per section heading; once Combat Traits reached twelve
  entries its measured rows ran under the Mechanics heading and that section's
  two-at-a-time pager (user report 2026-08-24). Growth must never move chrome:
  `tests/ui/layout.test.ts` gates the frame ordering and row non-overlap.
- `KeywordIcons`: three total icon records baked to one shared chip helper -
  `KEYWORD_ICON_KEY` (per engine keyword), `MECHANIC_ICON_KEY` (per named
  mechanic plus the Warchest and Darlings zone terms), and `CARD_TYPE_ICON_KEY`
  (per card type). Every record is total over its union, so a new term cannot
  ship without a glyph; until 2026-08-24 only Champion Awakening had a mechanic
  glyph and the Glossary drew nineteen empty gutters beside it.
- `KeywordGlossaryPanel`: the tap-a-keyword explainer strip used by
  Collection and duels.

## Scene chrome and data display

- `SceneBackdrop.applyBackdrop`: the standard scene background + vignette.
- `layout.ts`: `measuredRowsLayout`, control-bounds types, popover
  geometry - measure-then-place, no magic offsets.
- `phaseTrack.ts`: the duel phase rows (display-only).
- `PileView`, `HistoryPanel`: duel piles and the slide-out log.
- `deckListPaging.ts`, `deckStats.ts`: pure paging math and deck
  statistics shared by builder/shop previews.
- `navigation.ts`: pure canonical destination-label mapping for back links.
- `deckBuilderHelpers.ts`: pure dirty-deck comparison over ordered cards,
  positional treatment pins, reserve lands, and hero selection. Deck Builder compares its
  working state with a snapshot of the saved record instead of a mutation
  flag, so edits made through any path remain detectable.

## Governance

1. New scene code composes these; a scene-local widget is a smell unless
   it is genuinely one-off.
2. Extracting a second copy of anything into a shared component is
   ALWAYS in scope for the PR that would have created the copy.
3. Every component obeys docs/design-system.md (isolation, hit floors,
   focus/hover clearance) internally, so composition inherits
   compliance - hand-rolled equivalents forfeit that.
4. Add the row here in the commit that adds the component; the checker
   date above anchors the anti-rot sweep.
