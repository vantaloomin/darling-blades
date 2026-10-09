<!-- source-of-truth: docs/plan-2.0.md, docs/mobile-support-matrix.md, docs/mobile-lan-plan.md, docs/plan-accessibility-i18n.md, docs/plan-art-streaming.md, docs/design-system.md, index.html, vite.config.ts, src/gameBoot.ts, src/platform/gestureCore.ts, src/platform/gestures.ts, src/platform/quality.ts, src/platform/renderScale.ts, src/platform/clientProfile.ts, src/ui/accessibility.ts, src/ui/theme.ts, src/ui/layout.ts, src/ui/duelLayout.ts, src/ui/SceneBackdrop.ts, src/art/ArtResolver.ts, src/art/artBudget.ts, src/config/cardFaceGeometry.ts, src/ui/handFan.ts, src/forge/scene.ts, src/dev/a11yProbe.ts, src/scenes/ · last-verified: 2026-10-09 · plan doc, DRAFT for the 2.0 wave-1 sitting: rewritten for 2.0 lane C; P11 (M1-M4), P1 and P2 ruled 2026-10-08, the rest is proposed; re-verify when the owner rules the M decisions, and when each wave ships -->

# Mobile overhaul: the 2.0 plan (draft)

**Status 2026-10-08: DRAFT for the owner's 2.0 wave-1 sitting.** This is
lane C of [plan-2.0.md](plan-2.0.md), priority 2 in the owner's 2.0 order and one of its hard requirements (P1).
It replaces the 1.8-era body of this file, which listed scenes and
dependencies that have since changed. The older slot notes are kept, short,
under [History](#history). The device list it depends on is its companion,
[mobile-support-matrix.md](mobile-support-matrix.md).

## What is ruled

**Ruled:**

- **Phone play is landscape** and the Duel is **Version C, "Command column
  (hand-first)"** (owner, 2026-09-25). The portraits, life, mana and piles
  sit in a narrow left column. The battlefield is the centre, two rows of
  circular medallions per side with a "Board full" chip at the cap and the
  turn and phase line between them. The hand is a list of named rows with
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
| Distribution | **Browser only.** No PWA, no offline mode, no app-store package |
| Phone card face | **Art-first (a).** Name, art at the desktop band, cost, P/T and a keyword row; full rules in the panel beside the enlarged card |

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
  reports as a tablet. The device list is chosen from market share and the
  build's own floor instead.

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

### C1. A second design space for phones (M5)

**Recommended:** phones get a **compact-landscape profile** whose design
space is the phone's own content box in CSS px, so **one design pixel is one
CSS pixel.** On the 6.1-inch iPhone that is about 750x310. The 44 px hit
floor then means 44 pt on the glass, the type ramp reads at its stated size,
and the research session's measurements (a 240 pt card face, taken in
headless Edge on 2026-09-25) carry over unchanged.

- **Height sets the scale, width follows the phone.** The compact design
  space takes the content box as it is, so a 19.5:9 phone gets its full
  width instead of the letterbox bars `Scale.FIT` leaves today.
- **Sharp on the glass.** The canvas backing store renders at the device
  pixel ratio, capped at 2 (a new cap; today `lite` is clamped to 1). At
  750x310 and a factor of 2 that is about 0.9 megapixels, under the desktop's
  3.7 at k = 2. Text rasterizes at the same factor through the existing hook
  in `gameBoot.ts`. Most iPhones are 3x screens, so the cap leaves a 1.5x
  upscale: slightly soft, accepted for fill rate and memory on weak phones.
  A 2.625x Android screen snaps to 2, so `RenderK` stays `1 | 1.5 | 2`.
- **Desktop and tablets are untouched.** They keep the **wide** profile,
  1280x720 fit to the window. A tablet in landscape draws the canvas at
  about 0.9 (an 11-inch iPad is 1180x820), which already reads.
- **Two profiles, not three.** The 1.8 draft's `short-landscape` profile is
  dropped: the compact space follows the content height, so a short phone
  gets a short layout from the same rules. Layout code reads one
  `ScreenMetrics` (width, height, safe insets, touch) and composes from it.
- **Alternative (not recommended):** keep 1280x720 for phones and double
  every size inside it. It needs no canvas change, but it keeps the
  letterbox and turns every token into a per-profile pair, the per-scene
  fork the accessibility plan ruled out (plan-accessibility-i18n, "For 2.0").

**Profile rule (proposed; automatic layout is ruled, M2):** compact when the device is touch,
landscape, and the content box is under 500 CSS px tall; wide otherwise.
Portrait phones keep the rotate screen. Nothing is saved: the profile is
worked out on each load, so moving a save between devices cannot strand
it. A resize while playing (rotation, browser bars) re-fits the canvas but
changes the profile only at the next scene start, and a resize while a text
field has focus is ignored, because the phone's keyboard shrinks the
viewport (C6). The threshold is set from the matrix's fixtures in
wave 1, so no listed tablet lands in compact and no listed phone lands in
wide.

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

### C4. The Duel on Version C

Built on a new geometry module beside `src/ui/duelLayout.ts` (the desktop
one stays as it is), Phaser-free and rule-tested the same way:

- **Left column:** both portraits, life, mana, library, graveyard and Sever
  counts. Life badges are legal targets, so their targeting ring is inside
  the column's hit area. **The Mandate marker** sits beside its holder's
  portrait here (lane B4 builds it on the desktop Duel first; this wave
  places it).
- **Centre:** each side's battlefield as two rows of medallions, creatures
  on the inner row and lands and other permanents on the outer row, at the
  worst-case board of 9 against 8 creatures plus the permanent rows. A full
  side shows the "Board full" chip. The turn and phase line runs between the
  halves.
- **Right column:** the hand as named rows with cost pips; a row that cannot
  be cast is dimmed (proposed). End turn and To combat
  sit at the bottom, under the right thumb. This closes the 1.8 draft's open
  question (fan, tray or pages): Version C chose rows.
- **Inspecting a card:** a long press opens the enlarged face with the
  rules panel beside it. Opening it never fires the action under the finger
  (the existing sticky-preview rule in `src/platform/gestures.ts`).
- **Overlays** become sheets that cover the centre and leave the left column
  visible, so life and mana stay readable while choosing: targeting, stack
  responses, Foresee, Overcharge, marks, Hunt, sacrifice choices, the
  mulligan, the history log, zone contents, results, replay controls and the
  tutorials. Only one is open at a time (the existing `OverlayCoordinator`).
- **The research session's mocks of every scene and Duel state on Version C
  are not in the repo.** Wave 1 either brings them in, if the owner still has
  them, or re-mocks the Duel's worst cases first (full boards, a targeting
  prompt with the stack open, Foresee, 130% text) so the owner approves the
  shapes before code.

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

One shared set of compact primitives on `src/ui/layout.ts`: a header with
back and title, a bottom action bar, tabs, a search field, a pager, a card
grid sized from the content box, and sheets in place of fixed-height
modals. The game's text fields are real page inputs (`SearchInput`,
`MultilineInput`, two in `DeckBuilderScene`, and the save-card code in
`saveCard.ts`). Focusing one raises the phone's keyboard, so each compact
scene keeps its focused field above the keyboard, read from
`window.visualViewport`, and the profile ignores that resize (C1). List scenes page or scroll
in bounded regions with their filters kept on screen. Dense dialogs become
pages or sheets, never smaller text.

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
- **Play stats (proposed):** the form factor label classifies by the
  viewport's shorter side instead of its width, so a landscape phone reports
  as a phone. A one-line change in `classifyFormFactor`; the privacy policy's
  "phone, tablet or computer" wording stays true. Mobile wave 1.

## Scenes

The game has 20 scenes today (`src/scenes/`). Story Mode's scenes do not
exist yet; lane E builds them on these primitives from the start, so they
need no migration. (The 2.0 plan's lane C lists Story in mobile wave 4; this plan
reads it as built compact-ready instead, and wave 4 only checks it.)

| Scene | Wave | Notes |
| --- | ---: | --- |
| Boot, Preload, ArtLoader | 2 | Loading screens; the art-loader progress bar re-anchors |
| MainMenu, Play, PracticePicker, Gauntlet | 2 | Menus on the shared header and action bar |
| Settings, Profile, Achievements, Glossary | 2 | Settings' chip groups were made to place by measurement in 1.9 (accessibility C4) |
| Collection, Shop | 2 | Grids sized from the content box; Shop's shelves page |
| DeckBuilder | 2 | The densest list scene: pool grid, deck list and filters cannot all show; the deck list becomes a sheet |
| Duel | 3 | Version C (C4) |
| PackOpening | 4 | The reveal runway re-composed; effects already gated by `lite` |
| Limited, LimitedDraft, LimitedDeckBuilder | 4 | Draft picks as a grid with a pick sheet; deck builder reuses wave 2's |
| CardShowcase | none | A frame and finish QA surface, not a player journey |

## Waves

Mapped to the 2.0 plan's sequencing (wave 1 is this plan and its decisions;
lane C's build waves run in 2.0 waves 2 to 4). Each starts on the owner's
word.

### Mobile wave 1 (2.0 wave 2): profiles, primitives, device baseline

- `ScreenMetrics` and the profile rule, Phaser-free and unit-tested over the
  matrix's viewport fixtures.
- The per-scene camera fit (C2), proven on the owner's phone first.
- The compact design space and the render factor (C1); the resolver's
  device term (C3).
- The shared compact primitives (C6), with hit-target checks on every one.
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
  profile and viewport axis so it can render the matrix's fixtures.
- **Small fixes that ride this wave:** the form factor label (above), the
  old-browser message ([mobile-support-matrix.md](mobile-support-matrix.md)),
  and the tap slop re-expressed in CSS px (C1 makes the 10 px slop 10 CSS px
  instead of about 4; Android's own slop is 8 dp, so 10 is kept unless the
  devices say otherwise).
- The Duel mocks (C4), for the owner to approve before wave 3.
- The cheap proposals parked on 2026-09-25 (M11, M12) if the owner takes
  them.

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

M1-M4 were ruled 2026-10-08 as P11. The rest each have a recommendation and are not ruled.

| # | Decision | Recommendation |
| --- | --- | --- |
| **M1** | Portrait | Landscape only; the rotate screen stays **(ruled 2026-10-08, P11)** |
| **M2** | Layout choice | Automatic, by the profile rule in C1; no setting, no save field **(ruled 2026-10-08, P11)** |
| **M3** | Distribution | Browser only in 2.0 **(ruled 2026-10-08, P11)** |
| **M4** | Phone card face | Art-first (a) **(ruled 2026-10-08, P11)** |
| **M5** | How phones get their own layout | A compact design space where one design pixel is one CSS pixel, rendered at up to 2x (C1) |
| **M6** | Ship scenes one at a time | Yes, each behind its own switch; unmigrated scenes fit by camera zoom inside a canvas sized once (C2) |
| **M7** | The supported devices | The matrix in [mobile-support-matrix.md](mobile-support-matrix.md) |
| **M8** | A full-screen button | Yes, where the browser allows it (Android Chrome, iPad Safari). iPhone Safari allows full screen only for video, so on iPhone the only way past Safari's bars is M9 |
| **M9** | Home-screen mode (a web app manifest) | Not in 2.0. On iPhone (as of current iOS) a home-screen web app keeps its own storage, so a player's save would not follow them from Safari. Android shares Chrome's storage, so the problem is iPhone's; revisit with save codes in front |
| **M10** | The Duel hand | Closed by Version C: named rows |
| **M11** | Upright tablets (parked 2026-09-25) | Stop blocking them: a tablet held upright gets the wide profile instead of the rotate screen. Wave 1 |
| **M12** | Art on the rotate screen (parked 2026-09-25) | Yes, one scene image behind the message. Wave 1 |
| **M13** | Art resolution on phones | Half art on the board and hand; the full texture for the one card being inspected |
| **M14** | Performance targets | Set from the wave-1 baseline on the weakest tested device, then only raised |

## Not in 2.0

- Portrait layouts.
- An installable app, offline play or an app-store package.
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
