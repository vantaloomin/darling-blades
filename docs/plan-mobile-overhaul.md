<!-- source-of-truth: docs/plan-2.0.md, docs/mobile-support-matrix.md, docs/mobile-lan-plan.md, docs/plan-accessibility-i18n.md, docs/plan-art-streaming.md, docs/design-system.md, index.html, vite.config.ts, src/gameBoot.ts, src/platform/gestureCore.ts, src/platform/gestures.ts, src/platform/quality.ts, src/platform/renderScale.ts, src/platform/clientProfile.ts, src/platform/screenMetrics.ts, src/platform/screenFixtures.ts, src/platform/homeScreen.ts, src/platform/fullscreen.ts, src/ui/accessibility.ts, src/ui/theme.ts, src/ui/layout.ts, src/ui/compactLayout.ts, src/ui/duelLayout.ts, src/ui/SceneBackdrop.ts, src/art/ArtResolver.ts, src/art/artBudget.ts, src/config/cardFaceGeometry.ts, src/ui/handFan.ts, src/forge/scene.ts, src/dev/a11yProbe.ts, src/scenes/ · last-verified: 2026-10-10 · plan doc, ruled in the 2.0 wave-1 sitting: rewritten for 2.0 lane C on the Version C mock set; P11 (M1-M4), P1 and P2 ruled 2026-10-08, M5-M29 ruled 2026-10-09, M30-M34 ruled 2026-10-10; re-verify when the owner rules the M decisions, and when each wave ships -->

# Mobile overhaul: the 2.0 plan

**Status 2026-10-09: RULED.** Every decision below was ruled in the owner's 2.0 wave-1 sitting (2026-10-08 and 10-09). This is
lane C of [plan-2.0.md](plan-2.0.md), priority 2 in the owner's 2.0 order and one of its hard requirements (P1).
It replaces the 1.8-era body of this file, which listed scenes and
dependencies that have since changed. The older slot notes are kept, short,
under [History](#history). The device list it depends on is its companion,
[mobile-support-matrix.md](mobile-support-matrix.md).

**The design source is the Version C mock set** (owner-picked 2026-09-25):
139 frames covering every scene and Duel state at the iPhone 15/16
landscape reference (852x393 pt, one frame px = one CSS px), with Largest
text variants and itch.io, short-viewport and tablet frames. Each frame
carries a scene note for its implementer. They live outside the repo: the
private Design canvas "Darling Blades mobile: Version C, every screen", and
the owner's bundle `darling-blades-mobile-version-c.zip` under
`research/mobile-tcg-ux/` (gitignored). Its `VERSION-C.md` is the design
contract (content box, the 230 px command column, the 11 pt text floor, the
44 pt touch floor), `FRAMES.md` the per-frame notes, and `DECISIONS.md` the
open questions listed below as M15-M29. Where this plan and a frame
disagree, the frame wins unless a ruling below says otherwise. The mocks
predate 1.9 and 2.0 content (First Dawn, Provoked, Hunt, the Mandate,
Overcharge, life above 20, Story Mode, Core Set II), which needs new frames.

## What is ruled

**Ruled:**

- **Phone play is landscape** and the Duel is **Version C, "Command column
  (hand-first)"** (owner, 2026-09-25). The portraits, life, mana and piles
  sit in a narrow left column. The battlefield is the centre, two rows of
  circular creature medallions per side plus a strip for other permanents,
  with the turn and phase line between them. The hand is a list of named rows with
  cost pips in a right-hand column, with End turn and To combat beneath it.
- **Mobile ships in 2.0**, priority 2 (owner, 2026-10-08), on the site and
  the desktop build. It is no longer framed as launch-critical for itch.io:
  **the itch.io launch is a 2.0.x**, once 2.0 is stable on the site, with
  the itch build target landing in 2.0 behind a flag (owner, 2026-10-08,
  P2).
- **Gameplay does not change.** Touch and desktop input produce the same
  engine actions.

- **Mobile is a hard requirement for 2.0** (owner, 2026-10-08, P1): with
  Core Set II and its mechanics, the Mandate and the fixes, it is not cut if
  2.0 runs long. Everything else can be discussed.
- **The mobile scope, P11** (owner, 2026-10-08, as recommended; these are
  M1-M4 below):

| P11 part | Ruled |
| --- | --- |
| Orientation | **Landscape only.** Portrait phones keep the rotate screen |
| Layout choice | **Automatic only.** No save field, no setting |
| Distribution | **Browser only.** No PWA, no offline mode, no app-store package. Amended 2026-10-09 by M9: a home-screen manifest is in; offline play stays out (owner) |
| Phone card face | **Art-first (a).** Name, art at the desktop band, cost, P/T and a keyword row; full rules in the panel beside the enlarged card |

- **Ruled 2026-10-09 in the wave-1 sitting** (owner, in the plan thread):
  M5 to M29, each as recommended except M16; among
  them M5 (the compact design space, scaled as each screen needs), M8 (a
  full-screen button where the browser allows it), M9 (home-screen mode
  in 2.0, with a bring-your-save-over message), M11 (upright tablets
  follow the mocks: the phone layout letterboxed), M12 (a scene image on
  the rotate screen) and the tablet question, M22: **touch tablets get the
  phone layout scaled up** for now, ideally a taller tablet composition
  later. The owner's Galaxy Tab A8 report decided it: today's desktop
  composition on that tablet was unreadable and its buttons hard to hit.

## Where mobile stands today

- **Tier 1 shipped in July 2026** ([mobile-lan-plan.md](mobile-lan-plan.md)): the
  game loads and plays by touch on a phone, over the network or from the
  site. It shows the desktop composition, shrunk.
- **One fixed canvas.** Every scene draws in a 1280x720 design space
  (`src/ui/theme.ts`), and Phaser's `Scale.FIT` shrinks that into the page
  (`src/gameBoot.ts`). Phones get no layout of their own.
- **Touch landscape reserves 80 px** for browser bars (`--chrome-top: 32px`,
  `--chrome-bottom: 48px` in `index.html`): the top and bottom take the
  larger of that reserve and the safe-area inset, and the side insets come
  off the width. Portrait phones see a rotate screen (a CSS media query in
  `index.html`).
- **Phones run the `lite` tier** (`src/platform/quality.ts`): no heavy card
  effects, half-resolution 320x400 art, render scale clamped to 1
  (`src/platform/renderScale.ts`), and an art texture budget of 208 MiB at
  base, scaled by `navigator.deviceMemory` where the browser reports it
  (Android, never iOS) to between 104 and 312 MiB (`src/art/artBudget.ts`,
  [plan-art-streaming.md](plan-art-streaming.md) section 3).
- **Gestures** are settled and tested (`src/platform/gestureCore.ts`): a tap
  is under 250 ms and within 10 design px, a long press is 450 ms, and the
  gap between them is a dead zone that does nothing. On a phone today the
  10 px slop is only about 4 CSS px, because the canvas is shrunk.
- **1.9 built the hooks this pass uses:** the accessibility resolver
  (`src/ui/accessibility.ts`) that makes every type, colour and alpha token
  a live read, the shared layout functions in `src/ui/layout.ts`, the Duel
  geometry module `src/ui/duelLayout.ts`, and the dev probe with per-scene
  fixtures (`src/dev/a11yProbe.ts`, `src/dev/*Fixtures.ts`).
- **The play stats cannot say how many players use phones yet.** The
  heartbeat reports a phone, tablet or computer label
  (`src/platform/clientProfile.ts`), but every daily total since 2026-09-24
  has been held back by the k = 10 privacy floor (`signals-data` branch,
  `rollups/`). The label also splits touch devices by viewport **width**
  (767 and 1279 px), so a phone held in landscape (780 to 956 px wide)
  reports as a tablet (fixed in wave 1: phones are now told by the shorter
  side). The device list is chosen from market share and the build's own
  floor instead.

### The problem in numbers

On a common phone the 1280x720 canvas is drawn at about 0.4 to 0.5 of its
size. A 6.1-inch iPhone in landscape is at most 844x390 CSS px (less while
Safari's bar shows, since the page uses `dvh`). After the 80 px reserve and
the 47 px side insets the game gets about 750x310, so the scale is
310 / 720 = 0.43:

| Design value | Design px | On that phone | Platform guidance |
| --- | ---: | ---: | --- |
| Body text | 16 | **6.9 px** | Apple's default body is 17 pt; 11 pt is its floor |
| Micro text | 11 | **4.7 px** | |
| Hit floor | 44 | **19 px** | Apple 44 pt, Android 48 dp |
| A hand card | 252 tall (0.6 of the 420 px face, `src/ui/handFan.ts`) | 108 px | |

Larger text size (130%) does not rescue this: 21 px body becomes 9 px. The
fix is a layout that is drawn for the phone's own size, which is what
Version C is.

## The design

### C1. A second design space for touch screens (M5, ruled)

**Ruled 2026-10-09:** phones get a **compact profile** whose design
space is the phone's own content box in CSS px, so **one design pixel is one
CSS pixel.** The mocks' reference content box is 718x356 (x 67..785,
y 8..364 on the 852x393 iPhone 15/16, inside its 59 px side and 21 px bottom
safe areas). The 44 px hit floor then means 44 pt on the glass, the type
ramp reads at its stated size, and the mocks' measurements (the 240 pt
card face, the 230 px command column) carry over unchanged. "Scaled as
necessary" (the owner's words): the space follows each phone's content box,
so every phone from the SE to the Pro Max gets more or less room, never
smaller text; and above the largest phone box (tablets) the compact
composition is drawn larger rather than stretched.

- **Height sets the scale, width follows the phone.** The compact design
  space takes the content box as it is, so a 19.5:9 phone gets its full
  width instead of the letterbox bars `Scale.FIT` leaves today.
- **Sharp on the glass.** The canvas backing store renders at the device
  pixel ratio, capped at 2 (a new cap; today `lite` is clamped to 1). At
  718x356 and a factor of 2 that is about 1 megapixel, under the desktop's
  3.7 at k = 2. A tablet's larger screen lowers the factor so its backing
  store stays at or under that 3.7. Text rasterizes at the same factor through the existing hook
  in `gameBoot.ts`. Most iPhones are 3x screens, so the cap leaves a 1.5x
  upscale: slightly soft, accepted for fill rate and memory on weak phones.
  A 2.625x Android screen snaps to 2, so `RenderK` stays `1 | 1.5 | 2`.
- **Tablets get the compact profile, scaled up (ruled 2026-10-09, M22).**
  The 1.8 assumption that a tablet reads the desktop composition at about
  0.9 scale was wrong on a real device: the owner's Galaxy Tab A8 was
  unreadable with hard-to-hit buttons. In landscape the compact
  composition is scaled to the width (mock P5: 138% on an 11-inch iPad,
  11 pt text landing at 15.2 pt); held upright it is letterboxed at about
  96% width-fit with the commanders' art in the bands (mock P4, M11). A
  taller tablet composition (a bigger board, the hand as cards) is the
  owner's stated ideal and a later item, not 2.0 scope.
- **Desktop is untouched:** the **wide** profile, 1280x720 fit to the
  window.
- **The short viewport is open (M21).** Phone Safari leaves about 297 pt
  of height (mock P3), and the mocks recommend a short variant of the
  compact profile (72 pt portraits, 44 pt medallions, pile counts behind
  the menu). This plan had proposed that the compact rules absorb short
  screens with no second profile; the mock shows they need a denser
  variant. Either way layout code reads one `ScreenMetrics` (width, height,
  safe insets, touch) and composes from it.
- **Alternative (not recommended):** keep 1280x720 for phones and double
  every size inside it. It needs no canvas change, but it keeps the
  letterbox and turns every token into a per-profile pair, the per-scene
  fork the accessibility plan ruled out (plan-accessibility-i18n, "For 2.0").

**Profile rule (automatic layout is ruled, M2; the rule follows M22):**
compact when the primary pointer is coarse (`(pointer: coarse)`: phones and
tablets, not a touchscreen laptop driven by its trackpad); wide otherwise.
A phone held upright keeps the rotate screen; a tablet held upright is
letterboxed (M11). Phone versus tablet is told by the screen's shorter
side, the same split the play-stats label uses. Nothing is saved: the profile is
worked out on each load, so moving a save between devices cannot strand
it. A resize while playing (rotation, browser bars) re-fits the canvas but
changes the profile only at the next scene start, and a resize while a text
field has focus is ignored, because the phone's keyboard shrinks the
viewport (C6). The phone and tablet split is set from the matrix's
fixtures in wave 1.

### C2. Scenes move one at a time (M6)

**Recommended:** each scene declares whether it has a compact composition.
A scene that does not yet keeps its 1280x720 design space on a phone,
shrunk as today. This lets every migration wave ship on its own, behind the
scene's own switch, with no half-built phone scene in front of players.

**How, without resizing the game:** on a phone the canvas is sized once, at
load, to the content box times the render factor, and never changes size
after that. A migrated scene draws in the content box. An unmigrated scene
keeps drawing in 1280x720, and its camera zooms and centres it to fit, with
the background colour as the letterbox. The repo already works this way at
desktop scale: `SceneBackdrop.applySceneSettings` zooms every scene's
camera by the render factor and centres it on the 1280x720 middle, and
pointer input reads world coordinates, so hit areas follow. No runtime
`setGameSize`, so no texture or camera reset and no DOM-layer refresh.

Two things to prove in wave 1: text stays crisp with `roundPixels` on under
a fractional camera zoom (today's zoom is a whole or half factor), and the
always-running art loader scene sets its own camera. If the camera approach
fails, the fallback is Phaser's `setGameSize` at scene start, which the
Forge already uses (`src/forge/scene.ts`).

**Built in wave 1, behind `?layout=compact`:** the canvas is the screen
times the render factor, and every scene's base zoom is the one that fits
1280x720 inside it (`activeSceneZoom` in `src/platform/renderScale.ts`,
which PackOpening's zoom escalation now composes with). The art loader
and Boot scenes draw nothing, so neither needs a camera. Text stayed crisp
at a fractional zoom in desktop Chromium emulating a 3x phone.

**The emulator run (2026-10-10, Android 360 class, Chrome):** every tap
landed, but text was soft and the board no bigger than today's. Three
causes, all fixed under the switch: index.html's 80 px bar reserve counted
Chrome's visible bar twice (the 100dvh page already leaves it out), so the
game got 780x176 of a 780x256 page, and the reserve is now dropped under
the compact profile; text rasterized at k = 2 and then shrunk by a 0.49
camera zoom smeared, so text now rasterizes at the scene's zoom (never
below 1; on desktop that is still k); and the camera's view was wider than
the stage, showing a panel parked right of x 1280, so the camera is now
clipped to the fitted 1280x720 window. The 1.3x upscale from the ruled
cap of 2 on a 2.625x screen remains (accepted in C1). Safari's bars are
not measured yet.

### C3. The resolver gets a device term, not a fork

The accessibility plan already says how ([plan-accessibility-i18n.md](plan-accessibility-i18n.md),
"For 2.0"): the mobile pass adds a device term to the same resolver and
never forks sizes per scene. That plan's example was a phone type floor;
C1 makes it unnecessary, because a design pixel is already a CSS pixel, so
this plan supersedes the example. The term itself is a `profile` input
beside text size and contrast (the resolver reads only those two today,
`src/ui/accessibility.ts`). What the profile
changes is **which roles a compact scene picks** (no 64 px marquee in a
310 px tall screen) and **the spacing scale**, both read through the
resolver. The three text sizes (100, 115, 130%) and high contrast apply on
phones exactly as on desktop, and every compact scene is checked at 130%.
**Built in wave 1:** `TYPE_BASE_COMPACT` in `src/ui/accessibility.ts`, read
as `theme.compactType` by migrated compact scenes only: the same roles at
the mocks' sizes (h1 20, h2 18, body 14, label 12, caption and micro 11;
the display roles 28 and 24, inferred, as the mocks draw no marquee), with
the same text-size policy. The spacing needs no term: the mocks' 8 px gap
and 44 px touch row are the existing 4 px unit (`theme.space(2)`), and
the compact composition lives in `src/ui/compactLayout.ts`.

### C4. The Duel on Version C

Drawn in the mocks' T (turn flow) and W (windows, pickers and zones)
frames, all at the worst-case board. Built on a new geometry module beside
`src/ui/duelLayout.ts` (the desktop one stays as it is), Phaser-free and
rule-tested the same way. The mocks' geometry (`DUEL_L` in the bundle's
`lib.mjs`): a 96 px left column, a 376 px centre, the 230 px command column.

- **Left column:** both portraits with life, and between them each side's
  mana and library, graveyard and Severed counts, plus the history and menu
  buttons. Life badges are legal targets, so their targeting ring is inside
  the column's hit area. The mana and zone counts are one framed button
  that opens the zone sheet (M15), and a third colour folds into a
  neutral "more" pip, with every colour at full size in the zone sheet
  (M16). **The Mandate marker** sits beside its holder's life total on
  the portrait's inner corner, and nothing is drawn while it is unclaimed
  (M30, M31; lane B4 builds it on the desktop Duel first).
- **Centre:** each side's creatures as two rows of medallions, with a
  strip of smaller medallions for lands and other permanents at the outer
  edge, at the worst-case board of 9 against 8 creatures plus 4 other
  permanents each. The turn and phase line runs between the halves.
  Badge positions on a medallion are fixed (M28). The 2.0 additions follow
  the new frames: a crown badge on legendary creatures (M32), Overcharge
  on the left edge and the spent Provoked badge on the right (M33), and a
  gold bolt for a ready Boost (M34).
- **Command column:** the hand as named rows with art, type and cost pips,
  at a 44 to 48 px pitch with touching hit areas (M27); a card that cannot
  be cast says why ("Board full"). End turn and To combat sit at the
  bottom, under the right thumb. This closes the 1.8 draft's open question
  (fan, tray or pages): Version C chose rows.
- **Casting:** a tap on a hand row opens the card with Cast and Empower;
  a single-target spell then picks its target on the board and Cast
  confirms (M17; today one tap casts).
- **Undo:** the one-deep Undo moves off the desktop's left rail to a
  toast at the top of the command column after each undoable action, plus
  a duel menu entry (M20).
- **Inspecting a card:** a long press opens the enlarged face with the
  rules panel beside it, and a tap on an opposing permanent with no action
  for the player does the same. Opening it never fires the action under the
  finger (the existing sticky-preview rule in `src/platform/gestures.ts`).
- **Prompts take over the command column and the board stays visible.**
  Choices made on the board (targets, attackers, blockers, sacrifices,
  Hauntlink hosts) happen on the medallions while the column explains and
  holds Confirm and Cancel. Choices that show cards (Foresee, loot, discard,
  Whispers, zone viewers, the mulligan) use a sheet over the centre and
  left, or the column itself. Only one is open at a time (the existing
  `OverlayCoordinator`). Mechanics newer than the mocks (Overcharge, Hunt,
  Provoked, First Dawn, the Mandate) follow the same pattern in new
  frames.

### C5. The phone card face (ruled, M4)

Art-first (a): the name, the art at the desktop band (216 px window in
desktop terms, 65% of the image shown), the cost, P/T and a keyword row. The
full rules sit in the panel beside the enlarged face, and grids keep
tap-to-inspect. The face geometry to build from is
`src/config/cardFaceGeometry.ts` (the 300x420 face and its 264x216 art
window), which landed in 1.9 from the R13 mock.

**Art resolution (proposed, M13):** at a factor of 2 a 240 pt face is 480
device px tall, so the half-resolution art (400 px tall) is slightly soft
when enlarged. Proposed: the board and hand stay on half art inside the
phone budget, and the one enlarged card asks the art store for its full
texture, pinned while it is open. That costs one full texture (2 MiB) at a
time.

### C6. Lists, menus and dialogs

One shared set of compact primitives on `src/ui/layout.ts`, matching the
mocks' shell (top bar, main pane, command column with the primary action
at its bottom): a top bar with a back chevron and title (M23), tabs in the
top bar, a search field, a card grid sized from the content box, list rows,
switches, sheets in place of fixed-height modals, and dialogs (cancel left,
primary right, a danger kind for destructive actions; M18). Paging becomes
vertical scroll, dropdowns open as a takeover of the command column, and
ceremony screens (pack opening, results) drop the column (M24). The game's text fields are real page inputs (`SearchInput`,
`MultilineInput`, two in `DeckBuilderScene`, and the save-card code in
`saveCard.ts`). Focusing one raises the phone's keyboard, so each compact
scene keeps its focused field above the keyboard, read from
`window.visualViewport`, and the profile ignores that resize (C1). The
mocks dock text-entry dialogs to the top of the screen, replace the
Gauntlet seed's `window.prompt` with an in-game field, and give Import a
Paste button (M25). List scenes scroll in bounded regions with their
filters kept on screen. Dense dialogs become pages or sheets, never
smaller text.

### Engine, AI, save and balance

- **Engine and AI:** no change. Layout, device class, frame rate and touch
  timing never reach the engine, the AI or a seed. The AI still reads only
  `PlayerView`.
- **The one gameplay check:** a test that runs the same sequence of choices
  through the compact and the wide Duel input paths and gets the same action
  log. The AI matrices run only after the Duel input work lands (wave 3), as
  a regression check, not because pixels moved.
- **Save:** none, under the ruled automatic layout. No viewport size or inset is
  ever stored.
- **Play stats (built in wave 1):** the form factor label classifies by the
  viewport's shorter side instead of its width, so a landscape phone reports
  as a phone. A one-line change in `classifyFormFactor`; the privacy policy's
  "phone, tablet or computer" wording stays true. Mobile wave 1.

## Scenes

The game has 20 scenes today (`src/scenes/`). Story Mode's scenes do not
exist yet; lane E builds them on these primitives from the start, so they
need no migration. (The 2.0 plan's lane C lists Story in mobile wave 4; this plan
reads it as built compact-ready instead, and wave 4 only checks it.)

Mock frames are named by file (`M-` start, menus and meta; `D-` collection
and deck builder; `S-` shop, packs and Limited; `T-` Duel turn flow; `W-`
Duel windows; `P-` platform). Their titles also carry codes like "M3",
which are frame numbers, not this plan's decisions.

| Scene | Wave | Mock frames | Notes |
| --- | ---: | --- | --- |
| Boot, Preload, ArtLoader | 2 | `M-Loading`, `M-ArtWait` | Loading screens; the art-loader progress bar re-anchors |
| MainMenu, Play, PracticePicker, Gauntlet | 2 | `M-MainMenu` to `M-GauntletAbandon`, first-run notices, toasts | The Play hub's column is the deck quick-select |
| Settings, Profile, Achievements, Glossary | 2 | `M-Profile` to `M-AchievementsList` | Settings is one scrolling pane with jump chips; legal pages in an in-game reader (M26) |
| Collection, Shop | 2 | `D-Binder` to `D-Shard`, `S-Shop-*` | The binder becomes one vertical grid; Shop's packs keep their strip |
| DeckBuilder | 2 | `D-Cards` to `D-Cards130` | The densest list scene: pool in the centre, deck list in the column, Warchest and Style as views; Export and Import merge into one Deck code sheet |
| Duel | 3 | `T-*`, `W-*`, tutorial `M-Tut*` | Version C (C4) |
| PackOpening | 4 | `S-Pack-*` | The reveal runway re-composed; the tear drops the column; effects already gated by `lite` |
| Limited, LimitedDraft, LimitedDeckBuilder | 4 | `S-Limited-*`, `S-Draft-*` | Draft picks as a grid with the pick under the thumb; Pool and Deck toggle in the builder |
| CardShowcase | none | none | A frame and finish QA surface, not a player journey |

## Waves

Mapped to the 2.0 plan's sequencing (wave 1 is this plan and its decisions;
lane C's build waves run in 2.0 waves 2 to 4). Each starts on the owner's
word.

### Mobile wave 1 (2.0 wave 2): profiles, primitives, device baseline

- `ScreenMetrics` and the profile rule, Phaser-free and unit-tested over the
  matrix's viewport fixtures (`src/platform/screenMetrics.ts`, fixtures in
  `src/platform/screenFixtures.ts`).
- The per-scene camera fit (C2), proven on the owner's phone first.
- The compact design space and the render factor (C1); the resolver's
  device term (C3).
- The shared compact primitives (C6), with hit-target checks on every one.
  The geometry is built (`src/ui/compactLayout.ts`: shell, list rows, card
  grid, tabs, settings switch, dialog, sheet, and `compactHitProblems`),
  checked on every landscape fixture; the Phaser widgets that draw them
  arrive with the first wave-2 scene that uses each one.
- **The emulator** (owner, 2026-10-08: set up at the start of this wave, not before): a session on the owner's PC installs the
  Android command-line tools (not the full Studio app), makes a 360 px
  Galaxy-class phone, and drives its Chrome over the debugging bridge for
  screenshots and scripted scene walks. It runs in short sessions, per the
  owner's rule on PC load; it needs Windows virtualization and about 10 GB.
- **The device baseline:** on each tested device in the matrix, a capture
  of today's game (what clips, what is too small) and the real content box,
  to check the 80 px browser-bar reserve. The page height is `100dvh`, which
  in both Safari and Chrome already leaves out a visible browser bar, so the
  reserve may be taking 80 px twice whenever a bar shows (inferred, not
  measured). The baseline also times a Hard AI turn on the weakest tested
  device (the owner's Galaxy Tab A8, a budget tablet, until an Android phone joins): the engine and AI run on the page's main thread, and a long think
  freezes the screen. If it does, the fix touches `src/ai` or moves the AI
  to a worker, and the 2.0 plan freezes the AI at the end of 2.0 wave 2, so
  it is found here, not in the Duel wave.
- **The probe learns viewports.** `src/dev/a11yProbe.ts` renders the
  1280x720 window at three text sizes and two contrasts; it gains a
  profile and viewport axis so it can render the matrix's fixtures. **Built
  in wave 1:** a dev load of `?layout=compact&viewport=<fixture>` (names in
  `src/platform/screenFixtures.ts`) boots the compact profile as that
  screen on any browser, and the probe's report names the viewport and,
  under the compact profile, lists each scene's tap targets under 44 CSS px
  (measured, not findings: every unmigrated scene has them, and a migrated
  scene's list is empty).
- **Small items that ride this wave:** the full-screen button (M8), the
  home-screen manifest and its one-time "bring your save over" message
  (M9), the form factor label (above), the
  old-browser message ([mobile-support-matrix.md](mobile-support-matrix.md)),
  and the tap slop re-expressed in CSS px (C1 makes the 10 px slop 10 CSS px
  instead of about 4; Android's own slop is 8 dp, so 10 is kept unless the
  devices say otherwise). **Built in wave 1:** the manifest
  (`public/manifest.webmanifest`: full screen, landscape, the card-back
  emblem icons at 192 and 512 plus a maskable one) and the save message,
  shown once on the main menu when an iPhone or iPad home-screen app opens
  on a fresh save (`src/platform/homeScreen.ts`; Import code opens
  Profile's import dialog); the old-browser message (an inline check in
  `index.html`); the slop in CSS px under the compact profile
  (`tapSlopWorldPx` in `src/platform/renderScale.ts`, desktop unchanged).
  The full-screen button (M8, placed 2026-10-10): a corner-bracket icon
  left of Settings in the main menu's header, and a Full screen switch in
  a Screen section on Settings' Audio tab, which then reads "Audio &
  screen" (owner's pick, 2026-10-10; the Game and Accessibility tabs have
  no room for another row at 130% text). Both show only on a touch
  device whose browser allows full screen and that did not already launch
  full screen from the home screen; entering it also asks for landscape
  (`src/platform/fullscreen.ts`).
- **New frames for what the mocks predate,** for the owner to approve
  before the wave that builds them: the Mandate marker and its swings,
  Overcharge, Hunt, Provoked, First Dawn, life totals above 20 in the 96 px
  column, Core Set II's new mechanics, and Story Mode's run shell. Drawn
  with the mocks' own generator and contract (`VERSION-C.md`). **Done
  2026-10-10:** 29 frames (N1-N21 Duel, N30-N38 Story), approved with
  M30-M34.
- The upright-tablet letterbox (M11) and the rotate screen's scene image
  (M12), both ruled. **Built in wave 1** (under `?layout=compact`): an
  upright tablet never gets the rotate screen; its 1280x720 window fits
  96% of the width, and the game clears to transparent outside it so the
  main menu's vista fills the bands (`layout-letterbox` in `index.html`;
  the Duel wave puts the commanders' art there). A phone held upright
  shows the vista's pagoda edge behind the rotate message.

**Gate:** unit tests for the metrics and profile rule; the probe's fixtures
render at every matrix viewport with no control outside the safe box; the
camera fit works on the owner's phone; build, lint, docs green.

### Mobile wave 2 (2.0 wave 3): menus and list scenes

Every wave-2 scene in the table above, each behind its own switch.

**Gate per scene:** probe captures at the smallest and largest phone
fixtures and at 130% text; hit targets at or above 44 px; one overlay at a
time; search, paging and scrolling by touch; the owner's pass on a real
phone.

### Mobile wave 3 (2.0 wave 3): the Duel

Version C (C4), with the Mandate marker from lane B4. The high-risk wave:
targeting, stack responses, Foresee, Overcharge, marks and the dead zone
between a tap and a long press.

**Gate:** the action-log equivalence test; a capture of every Duel state in
the probe's Duel fixtures (`src/dev/duelA11yFixtures.ts`) at the smallest
phone and at 130%; replay mode has no side effects; the avatar and floor
matrices unchanged; full Vitest; and longer real-device sessions by the
owner, including a full tower climb on a phone.

### Mobile wave 4 (2.0 wave 4): spectacle, Limited, hardening

Pack Opening and the Limited scenes; reward reveals and the rarer overlays;
performance work, only from measured traces; the device issue list closed.

**Gate:** performance traces on the weakest tested device (M14); page hide
and resume, audio interruption, rotation, browser-bar changes, reload; the
owner's signed pass of every scene on every tested device, recorded
separately from the automated results.

### Shared files

- `src/scenes/DuelScene.ts`: lane B4's Mandate UI lands on the desktop Duel
  first; mobile wave 3 composes it into Version C. The two never run in
  parallel.
- `src/ui/accessibility.ts` and `src/ui/theme.ts`: only mobile wave 1
  changes them in 2.0.
- `src/gameBoot.ts` and `index.html` (the rotate query for M11, the
  browser-bar reserve, the old-browser message): mobile wave 1 only. Lane
  F's itch target (2.0 wave 1) changes `vite.config.ts` and
  `scripts/cspForTarget.ts`, which inject the page's connection policy at
  build, not `index.html` itself, so the two do not share a file.
- `src/ui/layout.ts`: mobile wave 1 adds the compact primitives. Story
  Mode's run shell (lane E, 2.0 wave 2) puts its own pieces in its own
  module and uses mobile's once they land; it starts on the wide profile.

## Testing

**Automated (each wave):** the metrics and profile rule; layout fixtures at
the matrix viewports and safe insets; hit-target and safe-box assertions;
one-overlay-at-a-time checks; the gesture recognizer's existing tests; the
action-log equivalence test; probe captures for review.

**On real devices (the owner):** the matrix names the phones. Desktop
browser resizing and device emulation never count as the real-device pass;
they find layout bugs, not touch, memory or browser-bar ones. Each pass
records the device, browser, text size, scene and any issue, in the QA
sheet wave 1 adds.

## Decisions for the owner

M1-M4 were ruled 2026-10-08 as P11, M5-M29 on 2026-10-09, and M30-M34
(from wave 1's new frames for 2.0 content) on 2026-10-10: every decision
in this plan is ruled. M15-M29 are the decisions the full
mock set forces (`DECISIONS.md` in the bundle); the owner took the mocks'
recommendation on each except M16, which takes the owner's variant.

| # | Decision | Recommendation |
| --- | --- | --- |
| **M1** | Portrait | Landscape only; the rotate screen stays **(ruled 2026-10-08, P11)** |
| **M2** | Layout choice | Automatic, by the profile rule in C1; no setting, no save field **(ruled 2026-10-08, P11)** |
| **M3** | Distribution | Browser only in 2.0 **(ruled 2026-10-08, P11;** amended by M9 to allow a home-screen manifest) |
| **M4** | Phone card face | Art-first (a) **(ruled 2026-10-08, P11)** |
| **M5** | How phones get their own layout | A compact design space where one design pixel is one CSS pixel, rendered at up to 2x, sized to each screen (C1) **(ruled 2026-10-09)** |
| **M6** | Ship scenes one at a time | Yes, each behind its own switch; unmigrated scenes fit by camera zoom inside a canvas sized once (C2) **(ruled 2026-10-09)** |
| **M7** | The supported devices | The matrix in [mobile-support-matrix.md](mobile-support-matrix.md) **(ruled 2026-10-09)** |
| **M8** | A full-screen button | Yes, where the browser allows it (Android Chrome, iPad Safari); iPhone Safari allows full screen only for video **(ruled 2026-10-09)** |
| **M9** | Home-screen mode (a web app manifest) | In 2.0. On iPhone a home-screen web app keeps its own storage and opens with an empty save, so the first time it does, a one-time "bring your save over" message points to Export and Import save codes **(ruled 2026-10-09)** |
| **M10** | The Duel hand | Closed by Version C: named rows |
| **M11** | Upright tablets | Follow the mocks: the compact layout letterboxed at about 96% width-fit, the commanders' art in the bands (mock P4) **(ruled 2026-10-09)** |
| **M12** | The rotate screen | A scene image behind the message **(ruled 2026-10-09;** mock P2 draws a card illustration, the ruling is a scene) |
| **M13** | Art resolution on phones | Half art on the board and hand; the full texture for the one card being inspected **(ruled 2026-10-09)** |
| **M14** | Performance targets | Set from the wave-1 baseline on the weakest tested device, then only raised **(ruled 2026-10-09)** |
| **M15** | The Duel's resources block | One framed button for mana and zone counts that opens the zone sheet; on a phone it is also the land drop **(ruled 2026-10-09)** |
| **M16** | Three-colour mana in the 96 px column | Two colours plus a neutral "more" pip in place of the third; tapping the block opens the zone sheet, which leads with every colour's mana at full size (owner, 2026-10-09: "a little full display"; the mocks drew "+1") **(ruled 2026-10-09)** |
| **M17** | Casting by touch | A tap opens the card (Cast, Empower); a single-target spell picks its target, then Cast confirms. The research backs it: Duel Links and Master Duel open options on a tap, and Slay the Spire's largest complaint cluster is cards played while being read **(ruled 2026-10-09)** |
| **M18** | Confirms | A dialog for anything that spends or destroys (craft, delete, retire run, replace save, concede); the two-tap arm only where the second tap sits away from the first (Reset save, Abandon run); Shard stays a hold **(ruled 2026-10-09)** |
| **M19** | "Stops · Auto" from the first C mock | Dropped for now; the duel menu's "Auto-skip forced turns" stays. **Revisit** after mobile wave 3's device sessions, when real play shows whether players want response stops **(ruled 2026-10-09)** |
| **M20** | Undo | The game has a one-deep Undo (`DuelScene`: the last committed action, until priority passes or a hidden card is shown). On phones an "Undo" toast sits at the top of the command column after each undoable action until the window closes, and the duel menu carries Undo too **(ruled 2026-10-09)** |
| **M21** | Short viewport | A short variant of the compact profile for about 297 pt of height: 72 pt portraits, 44 pt medallions, pile counts behind the menu (mock P3) **(ruled 2026-10-09)** |
| **M22** | Tablets in landscape | The compact layout scaled to the width (mock P5) for now; a taller tablet composition later **(ruled 2026-10-09)** |
| **M23** | Back button | Chevron only on phones, with the destination as its accessible name **(ruled 2026-10-09)** |
| **M24** | Paging and dropdowns | Paging becomes vertical scroll (binder, Practice, Achievements, save card, Gauntlet ladder); dropdowns take over the column; ceremony screens drop it **(ruled 2026-10-09)** |
| **M25** | Text entry | Dialogs dock above the keyboard; an in-game field replaces the Gauntlet seed's `window.prompt`; Import gets a Paste button **(ruled 2026-10-09)** |
| **M26** | Legal pages | An in-game reader with Open in browser (a new tab leaves an embed) **(ruled 2026-10-09)** |
| **M27** | List rows | 44 to 48 px pitch with touching 44 px hit areas, as table rows under the 8 px spacing rule **(ruled 2026-10-09)** |
| **M28** | Medallion badges | Keyword top-left; state top-right with the Rage lock beside it; Hauntlink left-middle; Marks right-middle; P/T bottom; tapped in the centre, or a corner badge on attackers **(ruled 2026-10-09)** |
| **M29** | Copy sign-off | Sentence-case buttons and the new strings each frame's note lists ("Face <rival>", "Open in browser", "Paste") **(ruled 2026-10-09)** |
| **M30** | Where the held Mandate sits | Beside the holder's life total on the portrait's inner corner, a 26 px seal with a 44 px hit area (new frame N2); the strip-end alternative is dropped **(ruled 2026-10-10)** |
| **M31** | The unclaimed Mandate | Nothing is drawn until someone claims it; its rules stay one tap away on any card that names it and in the glossary (N1) **(ruled 2026-10-10)** |
| **M32** | Legendary creatures | A small crown badge on the medallion, since Sworn makes "do I control a legend?" a question every turn (N19) **(ruled 2026-10-10)** |
| **M33** | Overcharge and Provoked badges | Overcharge on the left edge at mid-height, the spent Provoked badge on the right, clear of the Marks badge (N9, N11) **(ruled 2026-10-10)** |
| **M34** | A ready Boost | A gold bolt badge with the gold ring, in place of the desktop's "Boost" chip (N16) **(ruled 2026-10-10)** |

## Not in 2.0

- Portrait layouts for phones.
- A taller tablet composition (M22's later ideal).
- Offline play, a service worker or an app-store package (the home-screen manifest, M9, is in).
- A saved layout preference.
- LAN PvP and any multiplayer (cancelled 2026-08-24).
- Changes to the gesture times without device evidence (the slop's unit change is wave 1's, above).
- The itch.io embed check, which moves with the itch launch (2.0.x, P2). itch can
  launch a game full screen on phones, so the embed is a lane F check on
  this plan's layouts, not a separate layout.

## Risks

- **The Duel is the risk.** Overlapping gestures and a dense board make a
  wrong action the worst failure. The dead-zone rule, the sticky preview
  and the equivalence test are the guards; the owner's long sessions are the
  proof.
- **The camera fit (C2) may soften text** under a fractional zoom with
  `roundPixels`. Wave 1 checks it first; the fallback is `setGameSize` at
  scene start.
- **Hard AI on a weak phone** may freeze the screen while it thinks. Wave
  1's baseline times it, before the AI freezes.
- **Short Android screens.** Many Android phones are 360 CSS px tall in
  landscape, shorter than an iPhone SE (375). With the address bar showing,
  the content box can be under 300 px. The matrix makes 360 the design
  minimum.
- **Text at 130%** can break compact layouts; every scene's gate includes it.
- **Memory.** A Large set adds 250+ images. The art budget holds phones to
  208 MiB of textures whatever the pool size, so more cards mean more
  streaming, not more memory.
- **Three lanes touch the Duel** (mobile, the Mandate UI, Story's launch
  context). The shared-file order above is the guard.

## History

- **2026-08-24:** the pass moved from 1.8 to 1.9, paired with accessibility
  ([plan-road-to-2.0.md](plan-road-to-2.0.md)).
- **2026-09-25:** moved to 2.0 (D4 in [plan-1.9.md](plan-1.9.md)), then
  described as launch-critical for itch.io; accessibility shipped alone in
  1.9 and built the resolver this plan reuses. The same day the owner picked
  Version C from three phone-landscape options drawn at the worst-case board.
- **2026-10-08:** the owner ranked mobile second for 2.0, made it a hard
  requirement (P1), and moved the itch launch to a 2.0.x (P2), which retires
  the "launch-critical" framing ([plan-2.0.md](plan-2.0.md)). This rewrite
  follows.
- **2026-10-09:** the owner pointed this plan at the Version C mock set
  (the first draft wrongly said it was lost), ruled M5 to M29, and reported that the desktop composition was unreadable on the
  Galaxy Tab A8, which moved touch tablets to the compact profile.
