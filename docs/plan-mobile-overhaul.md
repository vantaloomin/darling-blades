<!-- source-of-truth: docs/plan-2.0.md, docs/mobile-support-matrix.md, docs/mobile-lan-plan.md, docs/plan-accessibility-i18n.md, docs/plan-art-streaming.md, docs/design-system.md, index.html, vite.config.ts, src/gameBoot.ts, src/platform/gestureCore.ts, src/platform/gestures.ts, src/platform/quality.ts, src/platform/renderScale.ts, src/platform/clientProfile.ts, src/platform/screenMetrics.ts, src/platform/screenFixtures.ts, src/platform/homeScreen.ts, src/platform/fullscreen.ts, src/ui/accessibility.ts, src/ui/theme.ts, src/ui/layout.ts, src/ui/compactLayout.ts, src/platform/compactScenes.ts, src/ui/compactWidgets.ts, src/ui/mainMenuCompact.ts, src/ui/playCompact.ts, src/ui/practiceCompact.ts, src/ui/gauntletCompact.ts, src/ui/settingsCompact.ts, src/ui/profileCompact.ts, src/ui/achievementsCompact.ts, src/ui/glossaryCompact.ts, src/ui/collectionCompact.ts, src/ui/shopCompact.ts, src/ui/duelCompact.ts, src/ui/DuelPhoneChrome.ts, src/ui/medallionArt.ts, src/ui/artGate.ts, src/ui/DarlingsTutorial.ts, src/ui/Toast.ts, src/ui/duelLayout.ts, src/ui/SceneBackdrop.ts, src/art/ArtResolver.ts, src/art/artBudget.ts, src/config/cardFaceGeometry.ts, src/ui/handFan.ts, src/forge/scene.ts, src/dev/a11yProbe.ts, src/scenes/ · last-verified: 2026-10-14 · plan doc, ruled in the 2.0 wave-1 sitting: rewritten for 2.0 lane C on the Version C mock set; P11 (M1-M4), P1 and P2 ruled 2026-10-08, M5-M29 ruled 2026-10-09, M30-M34 ruled 2026-10-10; re-verify when the owner rules the M decisions, and when each wave ships -->

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

- **Desktop moves onto the phone menus** (owner, 2026-10-14, after the comparison in the "Desktop and mobile UX" thread). S1 B: inside 2.0, the desktop's menu scenes draw the same Version C compositions as phones, tuned for desktop, and their old desktop layouts are retired. S2 A: the Duel stays two layouts, desktop keeping card faces and the fanned hand; the two share wording, prompts and icons. S3 A: the Shop sells from the column everywhere (pick a product, one gold Buy beside it), replacing the 2026-10-09 UI-review ruling of a gold Buy on every tile.
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
- **Desktop keeps the wide profile,** 1280x720 fit to the window, but its
  menu scenes draw the compact compositions at desktop density (the desktop
  pass, ruled 2026-10-14; see "Desktop pass" under the waves).
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

**Built in wave 1, behind `?layout=compact` until 2026-10-14, now on for every phone and tablet** (`?layout=desktop` keeps the desktop profile for a load, for comparisons; the owner's iPhone over LAN showed the plain address still booting the desktop profile): the canvas is the screen
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
cap of 2 on a 2.625x screen remains (accepted in C1). Safari's bars,
measured on the owner's iPhone 17 Pro Max in landscape (1.9.2, 2026-10-10,
from a screenshot): the address bar and tab bar take the top 110 of 438
CSS px and cannot be hidden, leaving a 956x328 content box; 1.9.2 drew the
game at 443x249, because the 80 px reserve came off a height that already
left the bars out (328 - 80 = 248). With the reserve dropped under the
compact profile the same box fits the window at 583x328. Home-screen mode
(M9) has no bars at all.

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
  it is found here, not in the Duel wave. **Measured in wave 1** (1.9.2 live site, 2026-10-10, from the owner's
  screen recordings): on the Tab A8 in Chrome, eight Hard AI turns against the
  Hestia practice opponent (game turns 1 to 16, up to seven AI creatures in play) showed
  no freeze: no still screen of 0.45 s or more fell inside the AI's own
  stretches (every longer one waited on the player: blocks, targets, the
  Warchest), and each turn's first action came about a second after the
  turn banner. Late games with full boards are not covered yet. Chrome's
  tab strip and address bar take the top 15% of the A8's screen, and the
  80 px reserve showed there too, as on the iPhone (see C2).
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
  (`src/platform/fullscreen.ts`). The compact canvas refits when the
  screen changes size after load (full screen, turning the device, a
  browser bar); the 2026-10-12 emulator recheck found it kept its load
  size in full screen.
- **New frames for what the mocks predate,** for the owner to approve
  before the wave that builds them: the Mandate marker and its swings,
  Overcharge, Hunt, Provoked, First Dawn, life totals above 20 in the 96 px
  column, Core Set II's new mechanics, and Story Mode's run shell. Drawn
  with the mocks' own generator and contract (`VERSION-C.md`). **Done
  2026-10-10:** 29 frames (N1-N21 Duel, N30-N38 Story), approved with
  M30-M34.
- The upright-tablet letterbox (M11) and the rotate screen's scene image
  (M12), both ruled. **Built in wave 1**: an
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

**Built so far (2026-10-13):** the per-scene switch, the Main menu, Loading, the Play hub, the Practice picker, the Avatar Gauntlet, Settings, Profile, Achievements, the Glossary, the Collection, the Shop and the Deck builder.

- The switch is `COMPACT_SCENES` in `src/platform/compactScenes.ts`. A listed scene draws in the phone's own design space (one design px = one CSS px, inside `ScreenMetrics.content`), and `applySceneSettings` gives it a camera that fills the canvas instead of fitting 1280x720. `sceneStage(scene)` in `src/ui/SceneBackdrop.ts` tells a scene which space it is in; the backdrop, `modalShell`, the stats notice and the a11y probe read it. Text rasterizes and tap slop scales at the current scene's zoom (`currentSceneZoom` in `src/platform/renderScale.ts`), so a fitted scene after a compact one is unchanged.
- The Main menu is the first scene on the list (mocks M-MainMenu, M-MainMenu130, M-Toasts, M-NoticeRepair, M-StatsNotice, M-TutorialPrompt). Its Phaser-free layout is `src/ui/mainMenuCompact.ts`: the top bar, the Profile tile with the player's record, How to play and Glossary on the left, Daily Blades in the middle (quests that do not fit fold behind an "N more quests" row, so at 130% text no row is cut), and Shop, Collection, Decks, Achievements and Play in the command column. Toasts hang from the top of the command column (`rail` on `Toast`). The drawn controls are `src/ui/compactWidgets.ts`. The probe reports no findings and no small targets at phone-narrow, short, island, large and tablet-mini, at 100%, 115% and 130% text, and in high contrast.
- Loading and the Play hub (mocks M-Loading, M-ArtWait, M-Play, M-PlayDarlings). The boot loader and the art wait draw the loading line over a thin progress bar in the content box's middle; the wait screen carries the compact back control and the scene's name. The Play hub (`src/ui/playCompact.ts`) has one art tile per mode, each one tap into its mode, and the deck quick-select in the command column with Edit decks at its foot, so a deck switch never opens a dialog. A Gauntlet tile the active deck cannot climb says why before it is tapped. Four tiles (Story on) or a narrow phone take two rows of tiles rather than tiles under 150 px. Shared pieces in `src/ui/compactWidgets.ts`: the top bar (`compactHeader`), the gold pill, the dialog and the progress bar.
- The Practice picker (mocks M-Practice, M-Darlings; `src/ui/practiceCompact.ts`). The picked rival large on the left with her whole name and title, every rival in a grid that scrolls vertically (summit first, a check on the picked one), and the command column: her blurb, the Easy / Medium / Hard segments (Medium first) and "Face <rival>" at the foot. On a phone the difficulty is chosen first and the primary launches, where the desktop launched on a difficulty tap. Grid tiles carry the name before the comma ("Anubis"), as the mock does, in one size for every tile, on at most two lines broken at a space or after a hyphen. When a name will not fit, the picked rival's column narrows first, then the grid drops a column (Largest text). The chosen segment uses the selected style (gold outline and label), not the mock's gold fill, so "Face" stays the screen's one gold primary. The Darlings explainer is a compact dialog (Read more, Got it) whose text scrolls in whole lines when it is taller than the screen.
- The Avatar Gauntlet (mocks M-Gauntlet, M-GauntletFresh, M-GauntletAbandon; `src/ui/gauntletCompact.ts`). The selected rung's rival on the left with her deck's theme; in the centre her name, title, the rung's stars and brain, her blurb (scrolling in whole lines), the reward, the record, the seed and the lineup, with the run's actions at the foot, well away from Fight: Abandon run (the two-tap arm, its consequence line over the record while armed, standing down after 4 s), or Reroll and Set for a fresh run. The command column is the tower, top rung first, opened on the current rung (cleared rows a green check, the current one a gold play mark and border, future ones a dot; rows carry the short name), with Fight or Begin run at its foot, or the reason a selected rung cannot be fought. Set opens a compact dialog docked to the top with a real number field (M25), replacing `window.prompt` on phones; `compactDialog` gained the field. At Largest text the lineup line gives way before the blurb drops under two lines.
- Settings (mocks M-Settings, M-SettingsAccess, M-SettingsGameplay, M-SettingsReset, M-SettingsLegal, M-WhatIsSent; `src/ui/settingsCompact.ts`). The three desktop tabs become one list in the main pane, section by section (Audio, Your turn, Gameplay, Accessibility, Privacy, Save data; Animations and Render size join Gameplay as the mock has them, Full screen joins Audio where it is offered). The command column is the jump grid, two across, its current section drawn selected as the list scrolls, then the version and its update status, with Legal and Check for updates at the foot (stacked when the pair cannot share a row). A jump row whose labels cannot share equal halves splits unevenly before any label shortens. Rows: the On/Off switch (`compactSwitch`; the whole row toggles), segmented choices the row's width (`compactSegments` gained locked segments for the render sizes a lite device cannot take), the volume stepper, and the two-tap Reset. Legal is a sheet over the main pane with Read per page, and Read opens the in-game reader (M26, mock M-LegalReader; `src/ui/LegalReader.ts`): the published page's own text, read from the generated `public/*.html` (`src/ui/legalReaderText.ts`), so the game carries no second copy, with its sections as a jump list in the column and Open in browser at the foot; where the page cannot be fetched, Read opens it in the browser as before. "What is sent" is the disclosure in one scrolling column with its parts as a jump list beside it and the policy at the column's foot, the same allowlist walk as desktop, also opened from the main menu's first-run notice. A press that scrolled a list is never a tap (`compactButton` and `compactSegments` ignore a press that travelled more than 12 px). `bindMenuScroll` now returns a handle (`scrollTo`, `onScroll`) for jump lists.
- Profile (mocks M-Profile, M-ExportSave, M-SaveCard, M-ImportSave, M-ConfirmReplace; `src/ui/profileCompact.ts`). The main pane splits in two: the win record, its rate line and the showcase's seals (stacked; a seal that would run off the pane is left out) on the left, and the stat tabs over their rows in the centre, each row with its win rate in a column of its own so the rates line up down the tab (the tab's rows and note scroll where they run long, as Draft's do; at Largest text on the smallest phone the four tabs become two bars of two). The command column lists the replays as cards (the opponent's round portrait, or her initial for a drafter, the result and turns, the mode and date, and a gold play button; a replay this version cannot play says so instead), scrolling, with Import save and Export save at its foot. Tapping a card's words or a seal opens the full name and line. The save dialogs cover the main pane and the top bar with a sheet and keep the column beside it: Export has the code and the privacy line in the sheet and Create save card, the Include replays switch and Copy in the column; Import has the code and its preview in the sheet and the status, From save card, Preview save and Replace save in the column; Replace save confirms in a compact notice. The save card picker is a scrolling grid of owned cards' art, five across, whose rows near the view hold their art and ask the store for it; a tap previews the save card in the column, and Download save card writes it. `compactButton` gained `setEnabled`, `compactSegments` a `proportional` option (each segment its label's width), `compactDialog` an `overlay` option for scenes that route overlays through an `OverlayCoordinator`, and `uiIcons` play, copy, download and star. The probe takes `a11yPanel` on a modal's second plate (a dialog's column), so its text is checked against that plate rather than the sheet.
- Achievements (mocks M-Achievements, M-AchievementsList; `src/ui/achievementsCompact.ts`). The Trophy Hall's five wings fill the main pane, three over two, each a card with its ring gauge, its count (and how many are ready, in gold), a faded owned card leaning behind the count, and its featured trophy on a plinth at the foot; a tap opens the list on that wing. The List view scrolls every achievement of the filter in one column instead of pages, each row with its gauge (or, once claimed, the showcase pin), its title over its wing and goal, its reward, and its readout or a gold Claim; on a narrow row the reward goes under the readout so neither is cut. The command column carries the collection totals (the pool, the special cards and a count per colour, wrapping) in Hall, the Hall/List switch, the four filters and the wing's chip (tap to widen to every wing) in List, and Claim all at its foot. A claim or a pin comes back to the same scroll position.
- Glossary (mocks M-Glossary, M-GlossaryEntry, M-GlossarySearch; `src/ui/glossaryCompact.ts`). The main pane carries the open tab's heading and note over its terms, which scroll, each row an icon disc, the name, and the description beside it (or under it on a narrow row, where the search results' section name goes under too). A term opened from elsewhere (the tutorial's links) is outlined in gold and scrolled into view. The command column has the search field over the tabs, two across, each its name over its count; at Largest text on the smallest phone the tabs scroll. Searching looks across every tab, and clearing the search returns to the tab you were reading.
- Collection (mocks D-Binder, D-Binder130, D-BinderSet, D-Detail, D-Detail130, D-Craft, D-CraftConfirm, D-Shard; `src/ui/collectionCompact.ts`). The binder's two-page spreads become one vertical grid in the main pane, four or more across (one fewer at Largest text), built only near the view so the whole catalogue scrolls smoothly; tap a card to open it. The search field sits in the top bar between the title and the purse. The command column holds Set, Color and Type, Rarity and Owned only, and Sort (each criterion in both directions, one choice), with the collected counter at its foot; tapping a filter opens its picker over the column, a choice applies at once, and Done (or Reset filters) returns. A card opens full screen: the face on the left; the tier, set and copies, the booster-slot odds and the keyword guide in the middle over Previous and Next (at Largest text the face shrinks and the middle also sets the card's full rules at size); the owned variants with their pins, or the craft price, in the right column with Set default hero, the shard hold or Craft at its foot. With Confirm destructive actions on, Craft asks in a dialog instead of arming the button. The desktop finish comparison wipe stays desktop-only. The card-back, Darling picker and Darlings explainer frames (D-CardBackPicker, D-Darlings, D-DarlingPick, D-DarlingTutorial) belong to the deck builder and come with it.
- Shop (mocks S-Shop-Packs, S-Shop-Packs-130, S-Shop-Packs-Short, S-Shop-Decks, S-Shop-Darlings, S-Shop-DeckConfirm, S-Shop-DeckShort, S-Shop-Odds; `src/ui/shopCompact.ts`). Card Packs and Decks sit in the top bar beside the title. Card Packs is a strip of packs across the main pane: the chosen pack as tall as the pane in a gold outline, the rest smaller and named under it; drag to scroll, tap a pack to choose it. The column names the chosen pack over its blurb, a Drop rates row with the pool owned, the shortfall when you cannot buy, the quantity (×1, ×5, ×10) and Buy. Decks is a grid of deck tiles (art, name, colours, price, or Free or Owned), the chosen one outlined with a check; the column carries Standard Decks and Darling Decks, the chosen deck's name, size, archetype and how it plays, the free-claim, owned or shortfall note, Preview deck, and its one action (Buy, Claim free or Clone Deck). The drop rates and the deck preview open as sheets over the main pane and the top bar's left, with the column beside them still live: the preview's column says what the purchase adds and its price against your balance, with Close beside the action. A card tapped in the preview opens full screen with Previous and Next.
- Deck builder (mocks D-Cards, D-Cards130, D-PoolFilters, D-BuilderInspect, D-Warchest, D-WarchestSlot, D-Style, D-CardBackPicker, D-Decks, D-NewDeck, D-Rename, D-DeleteDeck, D-ExportCode, D-ImportCode, D-Unsaved, D-Darlings, D-DarlingPick, D-DarlingTutorial; `src/ui/deckBuilderCompact.ts`). The top bar carries the deck's name over its format and count (tap it for Your Decks), the pool search (an icon beside Filters at Largest text or beside a long name), Filters, and the Cards, Warchest and Style tabs over the command column. Cards: the pool's pages become one scrolling grid, each card over its in-deck count and a chip that fills it to the cap; tap a card to add one, hold it to inspect it. The column holds the deck list (each row its count, cost, stats and a minus), the first issue, the counts and the mana curve. Warchest puts the ten reserve slots in the centre (tap one to pick its land in the column) and the format choice in the column; a tab whose part of the deck has a problem carries a warning mark. Style previews the deck's own card back and playmat on a miniature table and lists card back, playmat and land styles, each with Change (a pencil at Largest text). Save deck (Fix deck while an issue blocks it, opening the list of issues) sits at the column's foot beside the deck code button, which opens one sheet with Export and Import as tabs and a Paste button. Filters takes over the column (each facet opens its choices in place); inspect, the deck code, the Darling, card back, playmat and land style choosers open as sheets over the main pane with their commands in the column. A Darlings deck keeps its Darling in a zone at the pool's left. Your Decks is its own screen: the previewed deck's face and facts with Copy, Rename and Delete, the decks in the column with New deck and Use (Edit deck for the one in the builder). New deck asks for a format first; rename docks to the top of the screen for the keyboard; leaving with unsaved changes offers Keep editing, Leave without saving and Save deck. The desktop builder is unchanged.

### Desktop pass (2.0): the menus at desktop density

Ruled 2026-10-14 (S1 B above). The scenes in `DESKTOP_SCENES` (`src/platform/compactScenes.ts`: Loading, Main menu, Play, Practice, Gauntlet, Settings, Profile, Achievements, Glossary, Collection, Shop, Deck builder, Pack opening, Limited hub, Limited draft, Limited deck builder, Story) draw their compact composition on the wide profile too, in 1280x720 divided by `DESKTOP_DENSITY` (1.2, so the compact body of 14 lands at about the desktop body of 16), inside a 20 by 14 px margin. The camera fits that space to the 1280x720 window as it does for a phone. Grids keep bigger faces on the wider pane instead of adding columns (`DESKTOP_GRID` in `src/ui/compactLayout.ts`: card faces at least 140, Shop deck tiles 220 so they sit three across, Practice tiles 112), and the Main menu's Daily Blades panel ends under its last quest. The Duel is not on the list (two Duels, S2 A); pack opening, Limited, the draft and Story were built as one composition that works at both sizes. `?desktop=classic` on the dev server draws the old desktop layouts, for before shots, until they are deleted scene by scene.


A desktop density review (2026-10-14; owner answered "implement all recommendations", R1 to R4 A) then tuned the pass for a mouse:

- **Pointer tier (R1):** `COMPACT.touch`, `rowPitch` and `switchTrack` are live tokens. `setCompactTier` (called from `SceneBackdrop` as each compact scene starts) picks the touch tier on phones and the pointer tier on desktop: controls 34 design px tall (40 px at a 1280 window, Material's dense desktop size), rows on a 38 pitch, a 37x20 switch. The top bar stays 44 so a title and subtitle fit.
- **Hover:** one pointer state for buttons, segments, switches and plain rows (`bindPointerState`, `compactRowHover` in `compactWidgets.ts`): a white wash at 8% on hover and 10% while pressed, touch pointers ignored.
- **Widths and panels:** Settings rows stop at 530 design px, Glossary terms go two across, Profile's stats stop near 480 with Replays beside them. Running text in a side column sits on a panel drawn on the column's own rect, the text inset 12 (`desktopTextPanel`). Destructive actions next to a gold one use the outlined `dangerOutline` style.
- **Deck builder (R2):** click a pool card to add one, right-click to remove one (the canvas's context menu is off); the deck list is slim rows with the full name and a minus that shows on hover; a magnifier on the hovered card opens inspect.
- **Settings (R3):** the section list leads on the left, the settings read to its right (list-detail), and the list fades out at its foot.
- **Shop (R4):** deck tiles three across, growing taller to fill a short list.
**Gate per scene:** probe captures at the smallest and largest phone
fixtures and at 130% text; hit targets at or above 44 px; one overlay at a
time; search, paging and scrolling by touch; the owner's pass on a real
phone.

### Mobile wave 3 (2.0 wave 3): the Duel

Version C (C4), with the Mandate marker from lane B4. The high-risk wave:
targeting, stack responses, Foresee, Overcharge, marks and the dead zone
between a tap and a long press.

**Built (2026-10-14), on for every phone since part 4f:** the phone Duel's board, hand and command column (mocks T-03a, T-03b, T-10, T-13a), casting, targets, inspect and Undo (T-04 to T-06, T-13b, M20), combat (T-07 to T-09), the Foresee and discard windows (W-Foresee, W-Loot, W-HandSize), the stack and Sunset windows (W-Stack, W-Stack130, W-Sunset), the zone sheets (W-GraveYours, W-GraveFoe, W-Severed, W-Reserves), and the cast and Duty choices (W-TitheHow, W-Tithe, W-Rite, W-Edict, W-Empower, W-Duty, W-DutyPick, W-HauntHost, W-HauntWindow), and the opening (T-01a, T-01b, T-02a, T-02b). `Duel` is in `COMPACT_SCENES`, so every phone gets it; the desktop keeps its own Duel (S2 A). A scene still being built can be opened early in a dev build with `?phone=<SceneKey>` (`enableDevCompactScene` in `src/platform/compactScenes.ts`).

- The geometry is `src/ui/duelCompact.ts`, Phaser-free: the left column (portraits with their life plates, the two resource blocks, History and Menu), the two board halves around the turn line, and the hand rows over End turn and the primary in the command column. `DuelScene` reads its geometry from an instance layout (`this.L`); on a phone `duelPhoneReadback` fills it from those regions, so the existing animations (draws, plays, deaths, damage numbers) find the phone's piles, life totals and rows without a second code path. Their stage spots (`this.fx`) shrink with the board.
- The phone chrome is `src/ui/DuelPhoneChrome.ts`. The desktop HUD's piles, phase rows, turn pill, smart button and End turn are built and kept in sync but hidden, and the foot mirrors them, so every action still goes through the desktop's handlers. While the foe acts, the foot is a dotted status line and a banner over the foe's half carries the latest history line (T-10). Each resource block is one button (M15): it opens the Warchest while the land drop is open, else the graveyard; a third colour folds into a "+N" pip (M16).
- Creatures draw as round medallions (`BoardCardView` with `round`), the art a disc baked once per card and size (`src/ui/medallionArt.ts`, drawn through the renderer since the art store can release a texture's bitmap). Badges sit where M28 and M33 put them: the first keyword top left, the summoning swirl top right, Marks on the right, Overcharge on the left edge, the spent Provoked badge right of the pill, the P/T pill at the bottom, a tapped mark in the centre instead of a turn. A Hauntlink is a small disc on its host's left. Other permanents take the outer strip, and the Darling zone's card sits at the strip's far end.
- The hand is a list of named rows in `handDisplayOrder`, with art, type or stats, and cost; a card that cannot be cast says why in two words ("Board full"); on the foe's turn only Charms stay lit. While a land drop is open a Warchest row is pinned on top (T-03b). At Largest text the rows are taller and a long hand ends in "N more in hand" (T-13a); a tap on it opens the whole hand on the sheet, one tile per card in the same order, and Open takes the picked card to its focus as a row tap would.
- Casting by touch (M17, T-04, T-13b): tapping a hand row opens the card over the dimmed board, and the column asks "Cast X?" with the untapped mana and what a cast (and an Empower, as a wide button above the foot) leaves; a land plays at once. A targeted spell then lists its picks in the column (T-06): the tapped target is selected, not cast, and Cast in the foot confirms; tapping the pick again clears it. Inspect (T-05) opens the same stage with the stats box (now and printed) and the Keyword Guide lines beside it. After each undoable move an Undo row is pinned at the top of the column naming the move ("Played Plains"), until priority leaves you (M20). The hover arrow to the pointer is off on the phone layout.
- Combat (T-07 to T-09): while you declare attackers the column lists them under "Your combat", each with × to take it out or a lock when Rage holds it in, over Clear and Attack (N). While you block, it names the attack ("Guan Xing attacks with 4"), says what the blocks as set leave you ("Incoming 5 · Life 20 → 15"), and lists the attackers with the blockers on each or what an unblocked one deals ("Takes 4"); with a blocker picked, the attackers it can block light up and a tap on the row assigns it. Attacking and blocking medallions carry a sword or shield disc at top right instead of the desktop's word chips (`uiIcons` gained `shield`), and the front row no longer lifts into the turn line. When damage lands the column tells it step by step in plain sentences (`combatRecap`), with the life it cost, until the strikes finish and a moment after; a tap puts the hand back.
- Windows (W-Foresee, W-Loot, W-HandSize): a window opens as a sheet over the left column and the centre (`duelSheet`; drawn by `src/ui/DuelPhoneSheet.ts`), and the command column beside it keeps the summary and one wide Confirm. Foresee shows the cards as full faces under their places (Top, 2nd, 3rd), and the column names the spell that cast it, its text, and what stays on top and what goes to the bottom. A discard shows the hand as art tiles (cost top left, a bolt or scroll for Charms and Rituals, the name broken between words), as large as `sheetGrid` can fit; a tap marks a card Discard, a long press reads it, and the column lists the picks, what is left to pick, and the Whispers or Retell line of a card that works from the graveyard. Confirm stays faded until the count is met. Hidden foot buttons now keep their input enabled, so a button shown again after the foe's turn answers taps.
- The stack (W-Stack, W-Stack130, W-Sunset): while you may respond, the spells waiting to resolve cover the foe's half (`src/ui/DuelPhoneStack.ts`, drawn by `StackDisplay` when it has a `phone` rect), the next one first: up to three side by side, each labelled "Next · Opponent", "Then · You", "Last · Opponent", with its text (mana as symbols) and what it is aimed at ("at Lu Bu") in place of the desktop's arrows. With more than three, or at Largest text, the next spell is large and the rest are a list under it, ending in "+N more"; a tap on it shows the next spells, and the last page offers "From the top". A tap targets a spell that can be targeted, or else opens it in full; a long press previews it. The column is captioned "Your response" (or "Hestia's Sunset" in an end-step window), and the primary reads "Let all 3 resolve", since passing closes the window and resolves the whole stack.
- Zones (W-GraveYours, W-GraveFoe, W-Severed, W-Reserves): the graveyard, Severed pile, Active Warchest and Warchest Reserves open on the same sheet in place of the desktop's zone modal, as art tiles with "Top" or "x2" in the corner and, in a graveyard, the card's chip ("Whispers", "Retell", "Preserve"), gold while it can be used and muted while it cannot. The column carries the zone's tabs (Graveyard and Severed, or Active and Reserves), the picked card's name, type, cost and text, the Whispers deadline, and any second action; the foot is the card's main action with its price ("Whisper for {R}", "Retell {2}{W}", "Play land") or Close. Under the Reserves the column says how the land drop works. A spell cast from the graveyard shows the Retell or Whispers price in its target prompt.
- Choices (W-TitheHow, W-Tithe, W-Rite, W-Edict, W-Empower, W-Duty, W-DutyPick): a cast or Duty choice takes the command column instead of a centred overlay, with the card's art, type, cost and text at the top. Another way to cast (Sacrifice to cast, Skim, Hauntlink, Empower) is a row with its price over the foot, and the plain cast is the foot's primary with its price beside Cancel; a way that can't be used now stays faded with the short reason ("Board full"). A permanent with several Duties shows them as radio rows under the card, and the foot performs the picked one; a modal spell's modes use the same rows (boxes for "choose up to"), though no card is modal yet. A single Duty shows its ability in a box, what it spends, and Perform Duty. While picking creatures to sacrifice for a Tithe, Rite or an Edict, the column counts the picks (with their total Defense for a Tithe), shows the price the picks bring a Tithe to, and holds Confirm. A picked creature on the board carries the mock's dashed gold ring, with no number; the column keeps the count.
- Hauntlink (W-HauntHost, W-HauntWindow): moving or linking a Hauntlink is select-then-confirm on the phone. The column shows the Hauntlink, where it is linked now and what the link gives; a tap on a creature picks the new host, and the foot links it with the price ("Relink {2}{R}"). In a Hauntlink window the column says what is next (combat damage or a trigger) and lists each of your Hauntlinks with its price and whether it would link or relink; a tap on one starts the pick, and Pass takes the whole foot. A foot button beside Cancel now shows its price too.
- Opening (T-01a, T-01b, T-02a, T-02b): the coin flip asks in the column, with Heads and Tails as coin tiles; the coin then lands large over the empty board, and the winner gets Draw first and Play first in the foot with a line on what each means. The opening hand lists in the column (rows tighten to one line when the whole hand would not fit), the tapped card stands large over the board beside the library, and Keep and Mulligan sit in the foot. Concede is a row under the hand when it fits, otherwise a button under the library. While bottoming, a tap marks a card Bottom, it tucks behind the library, and Confirm stays faded until the count is met; Concede moves to the foot. The foe's turn banner stays down until the first turn.
- Menu (T-12a, T-12b): the gear opens the menu in the column: the matchup, Auto-skip, Sound and Music as switch rows, then Concede (red, with a flag) over the foot and a wide Resume. The board stays in view but takes no taps. With destructive confirms on, Concede asks in a dialog (Keep playing or Concede); a gauntlet adds that the loss ends the run. The tutorial shows a plain Leave Tutorial in Concede's place.
- Results (T-11a, T-11b): the result stands in a band over the dimmed board (Victory, Defeat, Match won, Rung cleared, Failure and the rest), with the reason and the gold under it. The column lists the rewards row by row (the result's own pay, first win of the day, the daily streak) with the total, a line on what is next (Limited's next opponent), and your gold over the foot. The foot is the mode's way on: Menu and Rematch, Draft and Next Match, Tower and Next Foe, or Continue in Story. A failed or cleared Tower run keeps the result and rewards; the rung portrait recap stays desktop-only.
- The Mandate (N-02, N-04): the held seal sits right of the holder's life pill at 26 px, with a 44 px hit area. A tap or long press opens a sheet: the rules reminder, then each card on the board whose text reads the Mandate, with whether its condition is on now (a check and "Active", or an open ring and "Not active", never colour alone) and what it does, told from your side. A row opens the card; closing it comes back to the sheet. The column lists this duel's claims, newest first, with how each happened.
- Legends, Sworn and the cap (N-09, N-19): a legendary creature's medallion wears a small crown on its lower left (the right edge holds the Mark count and the spent Provoked glyph). A Sworn card in hand says "Sworn on" with a check or "Sworn off" with an open ring before its second line. "Board full" sits on a side's strip while it holds the creature cap.
- Boost and marks (N-17, N-21): a mana pump asks in the column with a minus and plus stepper, the count in a gold well and the most it can be paid ("Up to 2"), and the foot confirms "Activate once" or "Activate 2 times". A creature whose every Duty removes marks lists them as rows led by their price, each saying "Remove a mark" or why it can't be paid now ("No marks left", "Needs red mana"). A Duty's target prompt reads that ability's words, not the whole card. A tile with a Boost carries a bolt disc.
- Hunt (N-13, N-14): the prompt reads "Choose its prey." under the card row. The picked prey reads the trade ("Deals 4 · takes 4") with a Lethal chip when the hunter's blow kills it, and "Korru dies too" under it when the prey's blow kills the hunter. A Hunt spell's hunter reads "Hunter · 4/3". An arriving hunter is read at its printed stats.
- A waiting trigger's condition (N-08): the prompt drops the card's name (the card row names it), and a trigger that needs life gained this turn shows "Gained 4 life this turn" with a check and the life now.
- The short variant (M21, mock P3): when a landscape phone has 339 px of height or less (phone Safari with its bars showing), the left column keeps a 72 px portrait at each end with only the mana beside it, and the pile counts move to the menu, one line per side. Medallions are 44 px with their stat pills tucked into the row behind; the upper row draws over the lower so the pills stay readable, and a tile showing a word chip ("Duty") draws over both. The dev fixture is `phone-safari` (852x313).
- The action-log equivalence test is `scripts/duel-input-equivalence.mjs`, run by hand against the dev server. It plays seeded Practice duels with a starter deck in the Warchest format through real input: a seeded policy picks the human's move from the engine's legal actions, and the script taps (phone, as touch events) or clicks (desktop) the controls that move needs, read from the live scene. Every move must reach the engine as exactly the chosen action, and the phone and desktop runs of one seed must end with the same replay log. It drives the coin call, Keep, lands from hand and the Warchest, plain casts with or without targets, attacks, blocks, discards and passes; a duel that reaches a move it does not drive yet (a mulligan, a Duty, a cast choice, a graveyard cast, Foresee) stops there and says so.
- Phone frame fixes (from the probe's Duel fixtures at phone-narrow): a graveyard or stack target picks from the sheet's tiles, each badged with its pick number, and a long graveyard scrolls inside the sheet. The tutorial coach's bubble and info card sit inside the phone's frame, and its spotlight lands on the phone's own controls (the foot's primary button, the hand row, or "N more in hand"). A replay's end shows in the result band with Exit, and the result band hides the turn line. A foe's attacker keeps its Attack sword while you pick targets. The pile counts, the Darling thumbnail and the sheet's close button take 44 px taps, and a long hand name steps down to 85% before it ends in an ellipsis.
- Replays on the phone: the foot is Speed (x1, x2, x4) beside Pause while it plays, and Step beside Play while paused. The gear opens a short menu (Sound, Music, Leave replay). A replay's column never shows a decision panel, and its hand rows open nothing.
- Known gaps at the narrowest phone (667 px wide): at 100% text a long hand name can still end in an ellipsis ("The Marsh Rememb…"); the full name is on the card. The stack's "Then" rows tap at 22 to 24 px high.
- Still to come: the Undo entry in the duel menu; a waiting trigger's pick-then-Confirm and its stat preview ("7/3 becomes 8/4"); the board's Lethal badge on the prey; and the short variant for the other scenes.

**Gate:** the action-log equivalence test; a capture of every Duel state in
the probe's Duel fixtures (`src/dev/duelA11yFixtures.ts`) at the smallest
phone and at 130%; replay mode has no side effects; the avatar and floor
matrices unchanged; full Vitest; and longer real-device sessions by the
owner, including a full tower climb on a phone.

**Pack opening (mocks S-Pack-Tear, S-Pack-Reveal, S-Pack-Spotlight, S-Pack-Inspect, S-Pack-Results; `src/ui/packCompact.ts`, `src/ui/PackTile.ts`).** Built in parts behind `?phone=PackOpening` on the dev server, one composition for the phone and the desktop: every size is the mock's times the content box over the reference phone (718x356), up to 1.6.

- Single pack (part 1): the pack centred over "Tap to tear it open", the back chevron at the top left. The Commons and Rares deal into one to three rows of art tiles (cost top left, stats over the name, rim in the rolled frame's colour or the card's), with "★ New", "★ New variant" or the melted duplicate's "+5" in a pill above; a melted duplicate is dimmed. The specials wait face down in the column with their tier tab and glow, Skip in the foot; the column widens into the main area when three or more specials would otherwise shrink. The best card's spotlight shows the full card centred over a dim, its New chip at the corner, its tier and finish beside it, "tap to skip" under it. Face up, each special keeps its tab and shows its New pill and finish under it; the foot becomes Menu and Open another with its price (faded when short). A tapped pull opens full size over the main area with its pull details at the top of the column and Previous, Next and Close in the foot.
- Ten packs (part 2): with animations off, or after the ride, the summary (S-Pack-Batch) shows every SR, SSR and UR, best first, as a scrolling grid of the same tiles with the tier in a pill left of the stats and a star disc for a new card (green) or a new variant (violet). The column counts the pulls, the specials, the new cards and the gold from duplicates over Menu and "Open ×10 more" with its price.
- The runway: the ride keeps its rail, gate, minimap and spotlight, re-measured from the content box (`compactRunway` in `src/ui/packRunwayPresentation.ts`): the top bar holds the back chevron, the heading and Skip (Resume reveal while paused), the minimap sits under it, and the rail fills the room left below, centred, its cards up to 0.9 of their design size. The best pull's spotlight uses the single pack's. Finishing lands on the summary.
- Pack opening is in `COMPACT_SCENES` and `DESKTOP_SCENES`: phones and the desktop both draw this composition; `?desktop=classic` draws the old one for before shots.

**Limited (mocks S-Limited-Hub, S-Limited-Run, S-Limited-Retire, S-Limited-Builder, S-Limited-BuilderDeck; `src/ui/limitedCompact.ts`, `src/ui/limitedBuilderCompact.ts`).** One composition for the phone and the desktop, in `COMPACT_SCENES` and `DESKTOP_SCENES`. `?phone=Scene` on the dev server now draws a scene's compact composition on the desktop too, so a scene being built can be checked at both sizes before its switch flips.

- The hub: the title and gold in the top bar; the format's rules over the Active Run panel (with the next rival's portrait while matches are being played) and the Draft Records, scrolling, each a row with its record, a Premium pill, the deck's colours and the gold it paid. The column is New Run: the Premium Draft entry as a card (price, this week's allowance, that every pick is kept; faded when it can't be bought) over the Free Draft's payout line and Free Draft in gold. With a run active both entries are shown off over "Finish active run first", and the foot is Retire run beside the run's next step (Resume draft, Build deck or Continue match). With Confirm destructive actions on, Retire arms first: its label becomes "Tap again to retire" on two lines and the run panel names what is lost.
- The deck builder: the title over the format's rules, with Clear deck and Clear Warchest in the top bar's right slot. Pool and Deck are two tabs over a scrolling grid of art tiles; a Pool tile carries its count in the deck over the copies drafted and a check once any are in, and a tap adds one (or takes every copy out once all are in); a Deck tile carries its copies, and a tap takes one out. A hold or a right-click opens the card over the main pane with its line and Add to deck or Take out in the column. Details holds the mana curve with the colour pips, the deck's shape, the Warchest and its lands, the first issue (or Deck is legal) and, for a Premium run, what the draft added to the collection; Auto build and Start match share the foot. Leaving asks in a compact dialog.
- The Duel's Limited results were already in the phone Duel (part 3h); Next match is now in sentence case.
- The phone Duel's opening (the coin flip and mulligans) hides the empty board frames and the turn line until the first turn (owner's call, 2026-10-14).

**Limited draft (mocks S-Draft-Pick, S-Draft-Pick-130, S-Draft-Drafter, S-Draft-Inspect; `src/ui/limitedDraftCompact.ts`).** One composition for the phone and the desktop, in `COMPACT_SCENES` and `DESKTOP_SCENES`.

- The top bar: the format over the pack and pick, and the pass direction over the main pane's right edge (at larger text, where the header keeps only its title, the pack and pick move over the pass direction). The main pane: the table's eight seats as round portraits over first names with arrows the way packs flow (You, then seats 7 to 1, as on desktop), then the current pack as a scrolling grid of art tiles, six across at the reference phone. A tap selects a tile (a gold rim and a check disc); a hold or a right-click opens its pick impact. The column is Your Picks: the pool's colours, the mana curve, and the drafted cards most recent first as square thumbs, with "+N" in the last cell for those that do not fit, over Pick selected.
- A seat opens the drafter's profile as a sheet over the main pane: the portrait, the name, and what familiarity has revealed (title, colours, the full read or the hint), with Familiarity at the foot. A pack card opens its pick impact the same way: the card, the pool's colours and curve before and after taking it, its rarity, its terms one box each, a Premium draft's print and ownership lines, and Select at the foot. On the desktop the arrow keys still browse the pack in it and Space or Enter selects, then picks. The pass animation runs along the compact seat row; leaving asks in a compact dialog.

**Story (frames N-31 to N-38; `src/ui/storyCompact.ts`, `src/scenes/StoryCompact.ts`).** One composition for the phone and the desktop, in `COMPACT_SCENES` and `DESKTOP_SCENES`. Frame N-30 (a hub) has no screen in the game's flow, since a run opens straight onto the map; rows for features not in the game (Endless, a daily run, permanent card buys) are left out.

- Every run screen is the Version C shell: back, the screen's title over one line of context, and the run deck's size and run gold in the right slot. The heroine pick shows three portrait tiles (a locked heroine dimmed with the lock and her unlock progress), the chosen one's colours, record and unlock notes in the column, over View deck and Begin run. Boons are three tiles with an icon medallion; card rewards, event picks and the shop show the offered cards in one row (the shop with prices under them and a cart: Leave and "Buy N"). Rest and the kept card show the run deck as a scrolling grid. A tap chooses a card; a hold or a right-click opens it in full.
- The map draws the act's floors left to right (M1) with #683's medallions and dotted trails, the boss largest; the column reads the stop in view, over Abandon run (tapped twice), View deck and Map key, and the stop's action. The map key and the deck open as full sheets.
- A scene's lines put the speaker's portrait down the left, the line beside it, and the read-on hint and "n / N" left of Continue; Backlog and Skip sit in the right slot, and a tap anywhere, Space or Enter reads on. An event's choices list in the column over Choose. A dark band under the top bar keeps the title readable over bright stills.

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
| **M14** | Performance targets | Set from the wave-1 baseline on the weakest tested device, then only raised **(ruled 2026-10-09)**. Set 2026-10-10: on the Galaxy Tab A8, no still screen longer than 1.5 s during an AI turn |
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
- **2026-10-13:** the owner noted the phone build was still the desktop menus, smaller. Mobile wave 2 started: the per-scene switch and the compact Main menu.
- **2026-10-14:** the owner's iPhone over LAN booted every screen in the desktop layout: the compact profile was still behind wave 1's `?layout=compact`. It is now on by default for coarse-pointer compact screens, with `?layout=desktop` as the opt-out.
