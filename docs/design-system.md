<!-- source-of-truth: src/ui/theme.ts, src/ui/themeWidgets.ts, src/ui/SceneBackdrop.ts, src/ui/Dropdown.ts, src/ui/SearchInput.ts, src/ui/binder/FilterBar.ts, src/platform/gestures.ts, src/platform/animPolicy.ts, src/ui/CardFrameFactory.ts, docs/art-bible/index.md, docs/scene-art.md, docs/plan-ui-ux-refresh.md · last-verified: 2026-07-12 · core UI and visual-language contract -->

# Darling Blades core design system

This is the source of truth for the game's player-facing visual language and
application chrome. It records the system already established by the shipped
UI refresh; it is a consolidation, not a rebrand.

The implementation has two halves:

- `src/ui/theme.ts` is the Phaser-free token contract. Tests and headless tools
  may import it.
- `src/ui/themeWidgets.ts` owns Phaser factories for shared chrome. Scenes
  should compose these factories rather than inventing local button, panel, modal,
  navigation, currency, or paging recipes.

Card materials, mana identity, combat effects, and generated artwork use
specialist palettes described under [System boundaries](#system-boundaries).
They are not application chrome and must not be flattened into the UI palette.

## North star

**Refined mythic strategy:** dark royal stages create atmosphere; cards and
characters own saturation; warm gold communicates value and action; orderly
layout keeps a collectible card game readable.

Darling Blades should feel like heroic anime key art held inside disciplined
tabletop framing. The interface is ceremonial in headings, direct in controls,
and quiet enough that the collection remains the star.

Three principles govern new work:

1. **Hierarchy before decoration.** Contrast, scale, spacing, and depth must
   explain what matters before glow, particles, or ornament are added.
2. **Motion explains state.** Animation connects deterministic state changes;
   it does not delay decisions or become the only carrier of information.
3. **Shared chrome, specialist content.** Reuse the core primitives for
   navigation and controls. Keep card, faction, mana, rarity, and FX language
   in named domain modules.

## Visual layers

Render and tune screens in this order:

1. **Atmospheric stage** — a cover-fitted, desaturated scene backdrop with
   low-frequency safe zones under interface content.
2. **Structural chrome** — near-black violet panels, rows, strokes, and dim
   layers. Chrome groups information but does not compete with it.
3. **Primary content** — cards, character art, key numbers, and the current
   decision. This layer owns saturation and sharp detail.
4. **Status and action** — semantic text colors, gold value/action accents,
   success, danger, selection, and progress.
5. **Transient feedback** — combat FX, toasts, banners, reveals, overlays,
   modals, inspection, and results, ordered by `theme.depth`.

Do not fix a layering problem with an arbitrary local depth. Add or reuse a
named depth band and verify every surface that it must sit above and below.

## Foundations

### Color

The interface uses one semantic gold family plus violet-neutral surfaces.
`goldHover` is the brighter interaction state of the same interface accent,
not a second brand color.

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Primary action/value | `colors.gold` | `#ffd88a` | Primary controls, currency, selected emphasis |
| Hover accent | `colors.goldHover` | `#ffd700` | Pointer-hover feedback only |
| Text on gold | `colors.onGold` | `#1a1426` | Filled primary-control labels |
| Heading | `colors.heading` | `#f0e6ff` | High-emphasis titles and values |
| Body | `colors.body` | `#c9bde0` | Default readable UI copy |
| Muted | `colors.muted` | `#8f83a8` | Secondary copy and inactive metadata |
| Success | `colors.success` | `#9be6a8` | Completion and positive confirmation |
| Danger | `colors.danger` | `#f0b0a0` | Destructive labels and errors |
| Armed danger | `colors.dangerArmed` | `#f08a8a` | Explicit destructive confirmation state |
| Panel | `colors.panelFill` | `#161226` | Primary structural surface |
| Panel stroke | `colors.panelStroke` | `#4a3f6e` | Borders and separators |
| Passive control | `colors.btnGhostBg` | `#241d3a` | Low-emphasis actions |
| Emphasis/active row | `colors.btnEmphasisBg` | `#2c2344` | Secondary actions and selection |
| Dim | `colors.dim` | `#0a0812` | Backdrop dim and modal scrim |

Use `theme.colors` for Phaser Text, DOM/CSS, and canvas string colors. Use
`theme.graphics` for Phaser Graphics numeric colors. Numeric counterparts are
derived from the string tokens so the two representations cannot drift.

Rarity colors are a categorical ramp, not generic status colors. Set-symbol
**shape** identifies the set and symbol **fill** identifies rarity. Compact card
faces use that color coding; textual collection, filter, and detail surfaces
pair it with the written tier name.

### Typography

Use Cinzel (`theme.fonts.display`) for mythic hierarchy and Inter
(`theme.fonts.ui`) for operation and reading.

| Role | Family | Size token | Weight/color guidance |
| --- | --- | --- | --- |
| Game title / marquee | Display | `displayXL` (64) | Heading or gold; rare |
| Major scene statement | Display | `display` (44) | Heading |
| Page or modal title | Display | `h1` (28) | Heading |
| Section heading | Display | `h2` (20) | Gold or heading |
| Body/instruction | UI | `body` (16) | Body |
| Control/status label | UI | `label` (14) | 600; body or semantic color |
| Supporting metadata | UI | `caption` (12) | Muted |
| Dense board metadata | UI | `micro` (11) | Muted or body |

Do not use Cinzel for paragraphs or dense status readouts. Do not invent a new
font size when the nearest role works. Card faces and compact board tiles may
use measured, scale-to-fit typography because their geometry is a specialist
content system.

### Layout and spacing

- Author against the `1280 × 720` design viewport in `theme.design`; Phaser
  FIT and render scale handle the physical backing store.
- Use `theme.space(n)` for the 4px spacing grid. Prefer 8, 12, 16, 24, and 32px
  intervals for local rhythm.
- Panels use an 8px radius; controls use 6px.
- Standard control heights are 30px (`sm`) and 40px (`md`). The interactive
  hit region may be larger than the visible control.
- Preserve calm safe zones behind dense UI. Backdrop detail belongs at edges,
  below the fold of attention, or behind opaque structure.

Screen geometry that teaches gameplay—battlefield zones, hand fan, card
windows, and inspect composition—is a feature contract, not a generic spacing
token. Change it through the owning plan and measurement, not casual cleanup.

### Alignment and isolation space

Game UI has to survive fast scanning, controller focus, couch distance, touch
imprecision, animated backgrounds, and multiple display shapes. Alignment and
empty space are therefore functional: they establish reading order, keep
targets distinct, and protect gameplay information from visual noise.

#### Safe-area model

Treat the screen as three nested regions:

1. **Full-bleed stage (1280 × 720).** Backdrops, atmosphere, vignettes, and
   nonessential ornament may extend to every edge.
2. **Title-safe frame (inner 90%).** Keep persistent HUD, navigation, labels,
   currency, and critical status inside `x 64–1216, y 36–684`. This follows the
   long-standing HDTV game convention of reserving the outer 5% on every side.
3. **Composition safe zones.** Each screen may define stricter quiet regions
   around cards, decision prompts, modal content, or device obstructions. A
   runtime platform safe area always overrides the generic title-safe frame.

Content outside title-safe must be genuinely expendable. A player must not lose
a control, timer, objective, card count, life total, or decision explanation if
the outer band is cropped or obstructed. Test landscape mobile in both physical
orientations, streamed/custom aspect ratios, window resizing, and HDTV output;
do not assume a centered 16:9 screenshot proves safe placement.

#### Alignment rules

- Give every region one primary alignment axis. A column of labels, values,
  cards, or controls should share an edge, centerline, or baseline; avoid a
  chain of almost-aligned local coordinates.
- Align paragraph text, instructions, settings labels, lists, and multi-line
  descriptions to the language-leading edge. Reserve centered text for short
  titles, single values, empty states, and brief ceremonial statements.
- Match visual order, reading order, and focus order. If controls read
  top-to-bottom and left-to-right, controller/keyboard navigation must follow
  the same path without surprising diagonal jumps.
- Align labels by text baseline, not bounding-box center. Align icons and
  controller glyphs to the optical center of the adjacent cap height.
- Use trailing alignment for comparable numbers and a shared column for units,
  costs, percentages, and counts. Do not center a column of changing numeric
  values; the moving edges slow comparison.
- Repeated cards, rows, chips, and stat blocks share a common outer box and
  gutter even when their internal art or text differs. Empty and locked states
  occupy the same geometry as populated states so the grid does not jump.
- Mirror directional layout for right-to-left localization where feasible, but
  do not mirror established game-space meaning such as player/opponent sides or
  canonical WUBRG order without a specific localization decision.

Geometric alignment is the starting point, not the final verdict. Asymmetric
icons, serif capitals, chevrons, circular badges, and illustrated silhouettes
may need an optical nudge. Keep that correction to one spacing unit (4 design
pixels) or less and record it beside the component. If a larger correction is
needed, fix the asset bounds or layout model instead of accumulating offsets.

#### Spacing and grouping

Use proximity to communicate ownership:

- **Within one control or datum:** 4–8px between icon, label, shortcut, or unit.
- **Within one related group:** 8–12px between sibling controls or rows.
- **Between distinct groups:** 16–24px, plus a heading, surface, or separator
  when proximity alone is ambiguous.
- **Between major screen regions:** 24–32px or a clearly different panel/zone.

Internal spacing must be smaller than the space separating the group from its
neighbors. If two unrelated groups are closer than the items inside either
group, the screen communicates the wrong structure. Prefer more empty space
around the primary decision rather than filling every available slot with
status or ornament.

Use one gutter value across a repeated grid. Partial next-page content may hint
at scrolling only when it is intentional and symmetrical; accidental clipping
is not progressive disclosure.

#### Interactive isolation

- Visual bounds and hit bounds are different contracts. Keep the documented
  minimum hit region, then leave inactive space between neighboring targets so
  enlarged hit areas never overlap.
- Use at least 8 design pixels of inactive separation between ordinary menu
  targets after hit-area inflation. Use 12–16px for compact touch action
  clusters, or restructure the cluster if that cannot fit.
- Physical touch size must be checked on device. The design-space minimum is a
  code floor, not proof of the Xbox accessibility recommendation of roughly
  15mm square default phone targets. Important or repeated gameplay actions
  should exceed the floor and avoid screen-edge hand positions.
- Separate destructive actions from routine actions by at least 24px, a
  divider, or a different row. Never place **Delete/Reset/Concede** directly
  between high-frequency positive controls.
- A focused or hovered control needs clear space for its outline, scale, glow,
  tooltip, and label without covering a neighbor. Focus treatment must remain
  visible over every background and must not change the control's layout size.
- Do not stack two actions in the same visual footprint and reveal one only on
  hover. Touch, controller, and assistive inputs need stable, discoverable
  targets.

#### Content isolation

- Operational text over artwork requires a stable scrim, plate, or verified
  low-frequency safe zone. A drop shadow alone is not reliable isolation.
- Keep the current decision visually separate from historical information.
  Combat prompts, legal targets, and confirmation controls must not compete
  with logs, flavor, economy, or collection progress.
- Give a hero card, rare reveal, commander portrait, or pack product a quiet
  perimeter free of other saturated art and gold accents. One focal object owns
  the local contrast peak.
- Badges belong to the object they describe and must not bridge two cards,
  rows, or panels. If ownership is ambiguous at a glance, move the badge inward
  or add a containing surface.
- Never let animation cross an unrelated control cluster unless it is a brief,
  noninteractive transition and cannot be mistaken for selection or focus.

#### Modal and overlay isolation

- A modal is its own temporary alignment context. Dim and guard the entire
  parent screen, move focus into the modal, and restore focus to the invoking
  control on close.
- Use at least 24px internal panel padding; use 32px around a title, a long
  explanation, or a destructive decision when space permits.
- Keep the title and close affordance on separate reserved tracks. The close
  target must not overlap the title's wrapping width or the content scroll area.
- Keep primary and secondary actions in a consistent footer track. A destructive
  confirmation gets additional separation and explicit consequence copy.
- Tooltips and popovers belong visually to their invoking control but remain
  below modal depth. They close before a modal takes focus.

#### Alignment review checklist

Before approving a screen, inspect it with temporary guides and hit-area
overlays, then verify:

- critical UI stays inside title-safe and any device-provided safe area;
- each region has a clear shared edge, centerline, or baseline;
- numeric values compare along a stable edge;
- internal, group, and regional spacing form a visible hierarchy;
- inflated targets and focus treatments do not overlap;
- destructive controls are isolated from routine actions;
- backdrop detail, badges, and animation do not invade operational content;
- reading order and focus movement match the visual arrangement;
- the layout remains recognizable with longest expected copy, text scaling,
  empty data, maximum data, and reduced motion.

This guidance is informed by the Xbox Accessibility Guidelines for
[input and touch-target isolation](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107),
[consistent UI navigation](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112),
and [visible focus handling](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/113);
Microsoft's game-streaming guidance for
[device-provided safe areas](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/game-streaming-custom-resolution-best-practices);
the established Microsoft HDTV
[90% title-safe convention](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/introduction-to-the-10-foot-experience-for-windows-game-developers);
and Apple's game/layout guidance on
[safe areas, alignment, grouping, and adaptable layouts](https://developer.apple.com/design/human-interface-guidelines/layout).

### Alpha and surface hierarchy

Use named alpha steps rather than visually similar local decimals:

- `overlayDim` (0.92): default modal separation.
- `panel` (0.90): structural surface opacity.
- `chrome` (0.85): borders and idle control chrome.
- `subtle` (0.50): disabled or secondary information.
- `ghost` (0.32): intentionally receded content such as unowned cards.

Per-scene backdrop dims are calibrated readability values and may differ.
Document them in `docs/scene-art.md`; do not turn every calibration into a
global token.

### Motion

The core timing vocabulary is `fast` (100ms), `base` (180ms), and `slow`
(220ms), with `Cubic.easeOut` as the default settling curve. Use them for hover
feedback, short state transitions, and drawers. Longer combat, reveal, and
card-travel choreography remains feature-owned.

All motion must respect the persisted full/reduced/off setting. Tween timing is
controlled through the global time scale; FX capability policy separately
reduces or removes shaders, particles, glows, and other non-tween spectacle.
Even with motion off, callbacks must complete and the flow must remain
playable. Never make color, motion, or sound the sole carrier of a state change.

## Components

### Buttons

Use `themedButton()` for scene actions.

| Variant | Meaning | Treatment |
| --- | --- | --- |
| `primary` | One preferred action in the current decision | Gold fill, dark label |
| `emphasis` | Secondary action, selected tab, or important toggle | Violet fill, gold label |
| `ghost` | Tertiary, reversible, or quiet navigation | Low-contrast violet, body label |
| `danger` | Destructive action | Dark red fill, danger label |

The component owns label measurement, the child input Zone, hover response,
tap binding, hit inflation, disabled alpha, relabeling, and variant changes.
Use `setEnabled`, `setLabel`, and `setVariant`; do not reach into its children
to simulate state. A destructive action that needs confirmation changes to an
armed danger state and names the consequence.

### Panels and rows

Use `panel()` for primary grouping and tokenized row fills/strokes for repeated
content. A panel is structure, not decoration: avoid nesting multiple bordered
panels when spacing or a single separator would explain the grouping.

Use `rowFillActive` plus a text or icon change for selection. Do not signal
selection only with a subtle background change.

### Modals and inspection

Use `modalShell()` for the dim, panel, close affordance, Esc lifecycle, and
depth. The caller owns content and `ModalGuard`: pass every underlying
interactive object to the guard on open, restore it on close, and include
scene-plugin-level handlers such as wheel input in explicit guards.

Inspection may use the higher `inspect` band and results the `results` band.
Dropdowns/popovers use `popover`. A modal close path must be idempotent and
clean up keyboard listeners when the container is destroyed.

### Navigation, currency, and paging

- Use `backButton()` for return-to-menu navigation unless the flow has a
  specific parent destination.
- Use `goldBadge()` for currency display and its optional change flash.
- Use `pager()` for bounded paging. The current page is one-based in copy and
  zero-based in code; unavailable directions are visibly subdued and must not
  change page state.

### Inputs, selects, filters, and drawers

Reuse `SearchInput`, `Dropdown`, `FilterBar`, `OddsDrawer`, and
`KeywordGlossaryPanel`. Their DOM or specialist rendering is an implementation
detail; their semantic colors, font families, interaction floors, and depth
come from the core theme. Extend the shared component when a new state is
general. Do not create a scene-local square `Text.backgroundColor` control
beside rounded core controls.

### Cards and game-specific readouts

`CardView`, `BoardCardView`, `CommanderPortrait`, `PileView`, mana symbols,
keyword icons, set symbols, card-frame treatments, and combat FX are sanctioned
specialist components. Reuse them in their intended context. Their internal
geometry and palettes should be named and centralized in their owning module,
but they do not need to use application-chrome colors for material identity.

**Color identity is always shown with mana pips, never letter codes.**
Anywhere the UI presents the colors of a deck, card, avatar, or archetype
(shop plates and previews, deck builder, draft screens, achievements,
glossary), render the baked `pip-<W|U|B|R|G|C>` bead textures
(`src/ui/ManaSymbols.ts`, typically 16-20px via `setDisplaySize`) instead of
text like "U/B/G". Letter strings such as `DeckInfo.colors` are data to parse
into pips, not display copy. (User-directed 2026-07-17.)

## Interaction and accessibility contract

- Core button hit regions are at least 90 × 44 design pixels. Smaller icons
  receive at least a 44 × 44 inflated region.
- Never call `setInteractive` on a scaled Container. Put input on an unscaled
  child Zone or Image.
- Phaser Text resets its glyph-sized hit area after `setText` or style changes.
  Use the custom hit-area helper and re-inflate after every such update.
- Mouse hover is enhancement only. Every action must have touch tap parity;
  touch must not depend on hover or right-click.
- Prevent input behind overlays with `ModalGuard` plus explicit guards for
  scene-level listeners.
- Disabled controls remain legible, look inactive, and do not invoke their
  action.
- Destructive controls use two-step confirmation when the persisted setting
  requires it, and confirmation copy names what will be lost.
- Keep operational copy short and literal. Explain consequences before lore.

Keyboard focus traversal is not yet a shared Phaser capability. New controls
must at least preserve Esc-to-close where applicable and must not make existing
keyboard paths worse; a future keyboard-navigation primitive belongs in the
core layer, not in one scene.

## Imagery and material language

### Scene stages

Scene art is desaturated, environment-first cel-gacha key art. Readable
characters and faces are excluded; only explicitly allowed distant,
unreadable silhouettes may appear. Embedded text is forbidden. Interest is
pushed to the edges and atmospheric depth so centered UI remains readable. Add stage art via
`applyBackdrop()` and its procedural fallback, then tune the documented dim
calibration before requesting darker art.

### Card art

Card illustrations are saturated, character-led, silhouette-readable anime
key art. Color identity supplies the tonal anchor; faction accents layer over
it without replacing it. Rarity increases narrative and compositional ambition,
not merely particle count.

### Card materials

Frames use identity-colored metal, pale name/type bands, a parchment rules
field, a set-shaped rarity symbol, and optional cosmetic frame/holo treatments.
Material golds, WUBRG colors, foil spectra, and impact colors are domain values,
not substitutions for interface action/status colors.

## Content voice

- Headings may be mythic and ceremonial: **Darling Blades**, **Daily Blades**,
  **The Silver Veil**.
- Controls are verb-first and concrete: **End Turn**, **Claim**, **Confirm**,
  **Cancel**, **How to Play**.
- Instructions are plain, brief, and reassuring. State cost, consequence, and
  reversibility directly.
- Flavor can be confident and lightly wry, but operational UI avoids lore
  dumps, faux-archaic prose, and vague corporate labels.
- **No em-dashes (—) in player-facing prose** (user direction 2026-07-15).
  Use a period, semicolon, colon, comma, or parentheses instead; stat lines
  separate segments with the interpunct (·). Exempt: code comments and
  internal docs, the standalone "—" empty-value placeholder glyph (profile
  stats, turn label, best-rung readouts), and the card type-line separator
  ("Creature — Beastkin"), which is typographic structure, not prose. Quote
  this rule into any agent contract that authors player-facing text.
- Match established game terms exactly; do not reintroduce superseded MTG
  names in player-facing copy.

## System boundaries

Use this decision order for new UI:

1. **Compose an existing primitive.** This is the default for application
   chrome and familiar interactions.
2. **Extend the shared primitive.** Do this when the missing state or option
   would serve more than one screen.
3. **Create a specialist component.** This is appropriate when geometry,
   material, or behavior is intrinsic to card-game content. Keep it reusable
   and give its palette/constants an owning module.
4. **Use a scene-local treatment only for calibrated composition.** Document
   why it is unique. Do not duplicate a generic control locally.

Raw interface hex colors and font-family literals are forbidden outside token
or compatibility boundaries. Raw values are allowed inside named specialist
palettes for card frames, mana symbols, illustration generation, and FX. The
test is semantic ownership: if the value means “button,” “panel,” “heading,”
or “danger,” it belongs in the core theme.

## Current adoption and known gaps

As of this verification, every feature scene consumes the core theme; the only
exceptions are the boot/preload lifecycle surfaces. Shared theme widgets are
also broadly adopted across the menu, collection, deck builder, shop,
settings, gauntlet, Limited, and migrated Duel overlays.

The audited implementation sequence, file ownership, and acceptance criteria
live in [the design-system alignment plan](plan-design-system-alignment.md).
The next design-system work should be incremental:

- migrate remaining application-chrome literals in `DuelScene`, coach marks,
  history, piles, and preload without absorbing specialist FX/material colors;
- finish migrating the remaining square dropdown/filter triggers to rounded
  Graphics-backed controls;
- add a shared keyboard/focus model when keyboard navigation is scheduled;
- encode semantic text recipes if repeated family/size/weight combinations
  begin to drift again;
- keep scene-art calibrations synchronized with current runtime values.

These are tracked gaps, not permission for an opportunistic scene sweep.

## Definition of done for new UI

- Uses named tokens and the nearest shared primitive.
- Has an explicit primary action and readable state hierarchy.
- Works with mouse and touch; hit regions meet the interaction floor.
- Does not make a scaled Container interactive.
- Re-inflates mutable Text hit areas.
- Guards background input while overlays are open.
- Respects full/reduced/off animation and remains correct at off.
- Uses named depth bands and cleans up listeners/timers on shutdown.
- Keeps application chrome free of raw hex and ad-hoc font families.
- Passes typecheck, lint, relevant tests, build, and doc checks; visual taste
  claims that were not checked by eye are reported as unverified.
