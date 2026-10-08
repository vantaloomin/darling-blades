<!-- source-of-truth: docs/mobile-support-matrix.md, docs/mobile-lan-plan.md, docs/plan-accessibility-i18n.md, docs/plan-art-streaming.md, docs/design-system.md, index.html, vite.config.ts, src/gameBoot.ts, src/platform/gestureCore.ts, src/platform/gestures.ts, src/platform/quality.ts, src/platform/renderScale.ts, src/platform/clientProfile.ts, src/ui/accessibility.ts, src/ui/theme.ts, src/ui/layout.ts, src/ui/duelLayout.ts, src/ui/SceneBackdrop.ts, src/art/ArtResolver.ts, src/dev/a11yProbe.ts, src/scenes/ · last-verified: 2026-10-08 · plan doc, DRAFT for the 2.0 wave-1 sitting: rewritten for 2.0 lane C; nothing below is ruled except what it quotes with a date; re-verify when the owner rules P11 or the M decisions, and when each wave ships -->

# Mobile overhaul: the 2.0 plan (draft)

**Status 2026-10-08: DRAFT for the owner's 2.0 wave-1 sitting.** This is
lane C of [plan-2.0.md](plan-2.0.md), priority 2 in the owner's 2.0 order.
It replaces the 1.8-era body of this file, which listed scenes and
dependencies that have since changed. The older slot notes are kept, short,
under [History](#history). The device list it depends on is its companion,
[mobile-support-matrix.md](mobile-support-matrix.md).

## What is ruled, and what this draft assumes

**Ruled:**

- **Phone play is landscape** and the Duel is **Version C, "Command column
  (hand-first)"** (owner, 2026-09-25). The portraits, life, mana and piles
  sit in a narrow left column. The battlefield is the centre, two rows of
  circular medallions per side with a "Board full" chip at the cap and the
  turn and phase line between them. The hand is a list of named rows with
  cost pips in a right-hand column, with End turn and To combat beneath it.
- **Mobile ships in 2.0**, priority 2 (owner, 2026-10-08), on the site and
  the desktop build first. itch.io follows once 2.0 is stable there
  (proposed P2 in the 2.0 plan).
- **Gameplay does not change.** Touch and desktop input produce the same
  engine actions.

**Assumed until the owner rules P11** (the 2.0 plan's mobile scope
recommendation). Every line that depends on one of these is marked
**[P11]**:

| P11 part | This draft assumes | If ruled the other way |
| --- | --- | --- |
| Orientation | **Landscape only.** Portrait phones keep the rotate screen | Portrait layouts for every scene: roughly doubles waves 2-4 |
| Layout choice | **Automatic only.** No save field, no setting | A `settings.layoutPreference` field rides Story's v37 bump (P10) |
| Distribution | **Browser only.** No PWA, no offline mode, no app-store package | A separate spike; see M9 for why the home-screen mode is not free |
| Phone card face | **Art-first (a).** Name, art at the desktop band, cost, P/T and a keyword row; full rules in the panel beside the enlarged card | (b) rules on the face at a ~46% art band, or (c) a rules box sized per card ([plan-1.9.md](plan-1.9.md), "Mobile (2.0)") |

## Where mobile stands today

- **Tier 1 shipped in July 2026** ([mobile-lan-plan.md](mobile-lan-plan.md)): the
  game loads and plays by touch on a phone, over the network or from the
  site. It shows the desktop composition, shrunk.
- **One fixed canvas.** Every scene draws in a 1280x720 design space
  (`src/ui/theme.ts`), and Phaser's `Scale.FIT` shrinks that into the page
  (`src/gameBoot.ts`). Phones get no layout of their own.
- **Touch landscape reserves 80 px** for browser bars (`--chrome-top: 32px`,
  `--chrome-bottom: 48px` in `index.html`), on top of the safe areas.
  Portrait phones see a rotate screen.
- **Phones run the `lite` tier** (`src/platform/quality.ts`): no heavy card
  effects, half-resolution 320x400 art, render scale clamped to 1
  (`src/platform/renderScale.ts`), and a 208 MiB art texture budget
  ([plan-art-streaming.md](plan-art-streaming.md) section 3).
- **Gestures** are settled and tested (`src/platform/gestureCore.ts`): a tap
  is under 250 ms and within 10 px, a long press is 450 ms, and the gap
  between them is a dead zone that does nothing.
- **1.9 built the hooks this pass uses:** the accessibility resolver
  (`src/ui/accessibility.ts`) that makes every type, colour and alpha token
  a live read, the shared layout functions in `src/ui/layout.ts`, the Duel
  geometry module `src/ui/duelLayout.ts`, and the dev probe with per-scene
  fixtures (`src/dev/a11yProbe.ts`, `src/dev/*Fixtures.ts`).
- **The play stats cannot say how many players use phones yet.** The
  heartbeat reports a phone, tablet or computer label
  (`src/platform/clientProfile.ts`), but every daily total since 2026-09-24
  has been held back by the k = 10 privacy floor (`signals-data` branch,
  `rollups/`). The device list is chosen from market share and the build's
  own floor instead.

### The problem in numbers

On a common phone the 1280x720 canvas is drawn at about 0.4 to 0.5 of its
size. A 6.1-inch iPhone in landscape is 844x390 CSS px. After the 80 px
reserve the game gets 310 px of height, so the scale is 310 / 720 = 0.43:

| Design value | Design px | On that phone | Platform guidance |
| --- | ---: | ---: | --- |
| Body text | 16 | **6.9 px** | Apple's default body is 17 pt; 11 pt is its floor |
| Micro text | 11 | **4.7 px** | |
| Hit floor | 44 | **19 px** | Apple 44 pt, Android 48 dp |
| A hand card | 170 tall | 73 px | |

Larger text size (130%) does not rescue this: 21 px body becomes 9 px. The
fix is a layout that is drawn for the phone's own size, which is what
Version C is.

## The design

### C1. A second design space for phones (M5)

**Recommended:** phones get a **compact-landscape profile** whose design
space is the phone's own content box in CSS px, so **one design pixel is one
CSS pixel.** On the 6.1-inch iPhone that is about 844x310. The 44 px hit
floor then means 44 pt on the glass, the type ramp reads at its stated size,
and the research session's measurements (a 240 pt card face, taken in
headless Edge on 2026-09-25) carry over unchanged.

- **Height sets the scale, width follows the phone.** The compact design
  space takes the content box as it is, so a 19.5:9 phone gets its full
  width instead of the letterbox bars `Scale.FIT` leaves today.
- **Sharp on the glass.** The canvas backing store renders at the device
  pixel ratio, capped at 2 (a new cap; today `lite` is clamped to 1). At
  844x310 and a factor of 2 that is about 1.0 megapixels, under the desktop's
  2560x1440 at k = 2. Text rasterizes at the same factor through the
  existing hook in `gameBoot.ts`.
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
  fork the accessibility plan ruled out.

**Profile rule (proposed, M2 [P11]):** compact when the device is touch,
landscape, and the content box is under 500 CSS px tall; wide otherwise.
Portrait phones keep the rotate screen. Nothing is saved: the profile is
worked out on each load and on each resize, so moving a save between
devices cannot strand it. The threshold is set from the matrix's fixtures in
wave 1, so no listed tablet lands in compact and no listed phone lands in
wide.

### C2. Scenes move one at a time (M6)

**Recommended:** each scene declares whether it has a compact composition.
A scene that does not yet keeps running in the wide profile on a phone,
shrunk as today. The game switches its size when a scene starts. This lets
every migration wave ship on its own, behind the scene's own switch, with no
half-built phone scene in front of players.

The risk is the size switch itself: changing Phaser's game size between
scenes on a real phone (texture memory, camera reset, the `SceneBackdrop`
camera-zoom hook that assumes 1280x720). **Wave 1 proves it with a spike on
the owner's phone before any scene moves.** If it fails, the fallback is to
move all scenes in one release, and waves 2-4 stop shipping separately.

### C3. The resolver gets a device term, not a fork

The accessibility plan already says how ([plan-accessibility-i18n.md](plan-accessibility-i18n.md),
"For 2.0"): the mobile pass adds a device term to the same resolver and
never forks sizes per scene. With C1 that term is small. Type sizes need no
phone floor, because a design pixel is already a CSS pixel. What the profile
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

### C5. The phone card face [P11]

Art-first (a): the name, the art at the desktop band (216 px window in
desktop terms, 65% of the image shown), the cost, P/T and a keyword row. The
full rules sit in the panel beside the enlarged face, and grids keep
tap-to-inspect. The reusable geometry is `src/ui/cardFaceGeometry.ts` on the
1.9 prototype branch `proto/19-r13-mock` (not merged).

**Art resolution (proposed, M13):** at a factor of 2 a 240 pt face is 480
device px tall, so the half-resolution art (400 px tall) is slightly soft
when enlarged. Proposed: the board and hand stay on half art inside the
208 MiB budget, and the one enlarged card asks the art store for its full
texture, pinned while it is open. That costs one full texture (2 MiB) at a
time.

### C6. Lists, menus and dialogs

One shared set of compact primitives on `src/ui/layout.ts`: a header with
back and title, a bottom action bar, tabs, a search field (the DOM input
already used by `SearchInput`), a pager, a card grid sized from the content
box, and sheets in place of fixed-height modals. List scenes page or scroll
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
- **Save:** none, under P11's automatic layout. No viewport size or inset is
  ever stored.
- **Play stats:** none needed. The heartbeat's form factor label already
  says which profile class a player is in.

## Scenes

The game has 20 scenes today (`src/scenes/`). Story Mode's scenes do not
exist yet; lane E builds them on these primitives from the start, so they
need no migration.

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
- The scene size switch, proven on the owner's phone first (C2).
- The compact design space and the render factor (C1); the resolver's
  device term (C3).
- The shared compact primitives (C6), with hit-target checks on every one.
- **The device baseline:** on each tested device in the matrix, a capture
  of today's game (what clips, what is too small) and the real content box,
  to check the 80 px browser-bar reserve. It was tuned for Safari's bars; on
  Android Chrome the page height may already exclude the address bar, in
  which case the reserve takes another 80 px off an already short screen
  (inferred, not measured).
- The Duel mocks (C4), for the owner to approve before wave 3.
- The cheap proposals parked on 2026-09-25 (M11, M12) if the owner takes
  them.

**Gate:** unit tests for the metrics and profile rule; the probe's fixtures
render at every matrix viewport with no control outside the safe box; the
size switch works on the owner's phone; build, lint, docs green.

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
- `src/gameBoot.ts` and `index.html`: mobile wave 1, then lane F's itch
  build target, in that order.
- Story Mode's run shell (lane E, 2.0 wave 2) needs mobile wave 1's
  primitives; it starts on the wide profile and adopts compact when they
  land.

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

Each has a recommendation. None is ruled. M1-M4 are P11's parts.

| # | Decision | Recommendation |
| --- | --- | --- |
| **M1** [P11] | Portrait | Landscape only; the rotate screen stays |
| **M2** [P11] | Layout choice | Automatic, by the profile rule in C1; no setting, no save field |
| **M3** [P11] | Distribution | Browser only in 2.0 |
| **M4** [P11] | Phone card face | Art-first (a) |
| **M5** | How phones get their own layout | A compact design space where one design pixel is one CSS pixel, rendered at up to 2x (C1) |
| **M6** | Ship scenes one at a time | Yes, each behind its own switch, if wave 1's size-switch spike works on a real phone (C2) |
| **M7** | The supported devices | The matrix in [mobile-support-matrix.md](mobile-support-matrix.md) |
| **M8** | A full-screen button | Yes, where the browser allows it (Android Chrome, iPad Safari). iPhone Safari does not allow it for games |
| **M9** | Home-screen mode (a web app manifest) | Not in 2.0. On iPhone a home-screen web app keeps its own storage, so a player's save would not follow them from Safari |
| **M10** | The Duel hand | Closed by Version C: named rows |
| **M11** | Upright tablets (parked 2026-09-25) | Stop blocking them: a tablet held upright gets the wide profile instead of the rotate screen. Wave 1 |
| **M12** | Art on the rotate screen (parked 2026-09-25) | Yes, one scene image behind the message. Wave 1 |
| **M13** | Art resolution on phones | Half art on the board and hand; the full texture for the one card being inspected |
| **M14** | Performance targets | Set from the wave-1 baseline on the weakest tested device, then only raised |

## Not in 2.0

- Portrait layouts [P11].
- An installable app, offline play or an app-store package [P11].
- A saved layout preference [P11].
- LAN PvP and any multiplayer (cancelled 2026-08-24).
- Changes to the gesture thresholds without device evidence.
- The itch.io embed check, which moves with the itch launch (P2). itch can
  launch a game full screen on phones, so the embed is a lane F check on
  this plan's layouts, not a separate layout.

## Risks

- **The Duel is the risk.** Overlapping gestures and a dense board make a
  wrong action the worst failure. The dead-zone rule, the sticky preview
  and the equivalence test are the guards; the owner's long sessions are the
  proof.
- **The size switch (C2) may not hold up on real phones.** The spike is
  first for that reason, and the fallback is a single release of all scenes.
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
- **2026-10-08:** the owner ranked mobile second for 2.0 and moved the itch
  launch after 2.0 ([plan-2.0.md](plan-2.0.md)). This rewrite follows.
