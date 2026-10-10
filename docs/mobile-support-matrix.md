<!-- source-of-truth: docs/plan-mobile-overhaul.md, vite.config.ts, package.json, index.html, src/gameBoot.ts, src/platform/clientProfile.ts, src/platform/screenMetrics.ts, src/platform/screenFixtures.ts, src/platform/quality.ts, src/platform/gestures.ts · last-verified: 2026-10-10 · device list for the 2.0 mobile pass (decision M7, ruled 2026-10-09); re-verify at each mobile wave, at the 2.0 cut, and when a new iOS or Android major ships -->

# Mobile support matrix

**Status 2026-10-09: RULED as decision M7 of
[plan-mobile-overhaul.md](plan-mobile-overhaul.md),** with the tablet rows
following M11 and M22. The fixtures and OS pair are re-checked at each
mobile wave.
The 1.8 draft asked for "a small named matrix before wave 1" and "no generic
`mobile` label"; this is that list. It follows P11, ruled 2026-10-08 as recommended
(landscape phones, browser only).

## The four levels

| Level | What it means |
| --- | --- |
| **Tested** | The owner plays it on a real device at the end of every mobile wave. A bug here blocks the wave |
| **Supported** | Covered by the automated layout fixtures at its screen size. A reported bug is fixed like any other |
| **Works, not tested** | Above the build's floor, so it should run. No fixtures, no device time. Crashes are fixed; layout issues are best effort |
| **Not supported** | Below the floor. The page says so instead of showing a blank screen (proposed, below) |

## The floor, and where it comes from

The floor is set by what the build emits, not by choice. `vite.config.ts`
sets no `build.target`, so Vite 8's default applies: **Chrome and Edge 111,
Firefox 114, Safari and iOS 16.4** (Vite 8.1.2's
`ESBUILD_BASELINE_WIDELY_AVAILABLE_TARGET`, read from the package
2026-10-08). That target only sets the syntax the build emits; it adds no
polyfills, so the real floor is whichever is newer, the target or the
newest browser feature the code calls. The ones checked sit under it:
`structuredClone` (about 55 call sites in `src/`; Safari 15.4, Chrome 98)
and `dvh` units in `index.html` (Safari 15.4, Chrome 108). No full audit of
browser features was done (inferred floor). WebGL is needed for the tested
levels.

**The old-browser message (ruled with M7).** Below the floor the game's script fails
to parse and the player sees the dark page and nothing else. A few lines of
plain inline script in `index.html`, run before the game's module, can check
for the floor's features and show "This browser is too old to run Darling
Blades" with the supported list. Small and reversible; mobile wave 1.

## Phones (landscape, compact profile)

The Version C mocks are drawn at the iPhone 15/16 landscape reference, 852x393, with a 718x356 content box.

| Device class | Screen in landscape (CSS px) | Browser | Level | Why it is here |
| --- | ---: | --- | --- | --- |
| **iPhone 17 Pro Max** (the owner's phone) | 956x440 | Safari, current iOS | **Tested** | The owner's device: the largest phone layout, and the only real-phone pass |
| 6.1 to 6.3-inch iPhone (iPhone 12 to 17, 16e) | 844x390 to 874x402 | Safari | Supported | The most common iPhone size; the main design target, checked by fixtures |
| Android, 360 px class (many Samsung Galaxy A and S phones) | about 780x360 | Chrome and Samsung Internet, current (the Chrome 111 floor is about Samsung Internet 22, which trails Chrome) | Supported, **no device yet** | The shortest common screen, so the design minimum. Without a phone it is checked by fixtures only; see the gap below |
| iPhone SE, 2nd and 3rd generation | 667x375 | Safari | Supported | The narrowest screen (16:9); Version C's three columns must fit it |
| iPhone 12 and 13 mini | 812x375 | Safari | Supported | Short and notched |
| Other large iPhones (Plus and Pro Max) | 926x428, 932x430 | Safari | Supported | Covered by the owner's Pro Max |
| Pixel and other 412 px Android | about 915x412 | Chrome | Supported | Common Android size above the minimum |
| Any phone on Firefox for Android | | Firefox 114+ | Works, not tested | Small share |
| Chrome, Edge or Firefox on iPhone | | Same WebKit engine as Safari (other engines are allowed only in the EU, and none is widely shipped) | Works, not tested | Safari's testing covers the engine |
| iOS 16.4 to the version before last | | Safari | Works, not tested | Above the build floor; outside the tested pair |
| Below Safari 16.4 or Chrome 111 | | | Not supported | The build floor |

**OS versions (ruled with M7):** Tested and Supported mean **the current iOS
and the one before** (iOS 26 and iOS 18 at the last check this doc could
make; if iOS 27 shipped in September 2026 the pair is 27 and 26, to confirm
at the sitting), and **Android 10 or later with an up-to-date Chrome or Samsung
Internet.** iOS 26 runs on the iPhone 11 and later, including the second and
third generation SE.

**Phones held upright** (ruled, P11): the rotate screen, as today.

## Tablets (compact profile, scaled up)

Ruled 2026-10-09 (M22, M11): touch tablets get the phone layout drawn
larger, not the desktop composition. The owner tried today's desktop
composition on the Galaxy Tab A8 and could not read it or hit its buttons
reliably. In landscape the compact layout is scaled to the width (138% on
an 11-inch iPad, mock P5); held upright it is letterboxed at about 96%
width-fit with the commanders' art above and below (mock P4).

| Device class | Screen (CSS px) | Browser | Level |
| --- | ---: | --- | --- |
| **The owner's Galaxy Tab A8** (Android 14, One UI 6.1), landscape and upright | about 1280x800 (to measure) | Chrome and Samsung Internet | **Tested** | The only Android device: it covers Android's browsers, and as older hardware it stands in as the weak-device floor (M14) until an Android phone joins |
| iPad, 10.9 to 11 inch, landscape | 1180x820 | Safari | Supported |
| iPad mini, landscape | 1133x744 | Safari | Supported |
| Any tablet held upright (M11, ruled) | e.g. 820x1180 | Safari, Chrome | Supported, letterboxed; today it shows the rotate screen (a CSS media query in `index.html`; unblocking adds a minimum-size clause to it) |
| Other Android tablets, landscape | | Chrome | Works, not tested |

Every row here and above is compact; the plan's phone and tablet split
(by the screen's shorter side, C1) is checked against these tables so the
iPad mini lands as a tablet and every phone above as a phone.

## Desktop (unchanged)

Current Chrome, Edge, Firefox and Mac Safari, and the desktop app, all on
the wide profile; touchscreen laptops included (their primary pointer is the trackpad). No new desktop testing.

## The layout fixtures

The automated checks render each compact scene at these sizes (as data
in `src/platform/screenFixtures.ts`; keep the two in step). They start
from published screen sizes and typical insets; mobile wave 1's device
baseline replaces them with the content boxes measured on the Tested
devices, browser bars included.

| Fixture | Viewport | Safe insets (left, right, bottom) | Stands for |
| --- | ---: | --- | --- |
| `phone-narrow` | 667x375 | 0, 0, 0 | iPhone SE |
| `phone-short` | 780x360 | 0, 0, 0 | Android 360 class |
| `phone-mini` | 812x375 | 50, 50, 21 | iPhone mini |
| `phone-main` | 844x390 | 47, 47, 21 | 6.1-inch iPhone |
| `phone-island` | 852x393 | 59, 59, 21 | 6.1-inch iPhone with the Dynamic Island |
| `phone-android` | 915x412 | 0, 0, 0 | Pixel class |
| `phone-large` | 956x440 | 62, 62, 21 | Pro Max class (16 and 17) |
| `tablet-mini` | 1133x744 | 0, 0, 20 | iPad mini (must resolve to a tablet, compact scaled up) |
| `tablet-upright` | 820x1180 | 0, 0, 20 | Upright tablet, letterboxed (M11) |

Android rows are 0 because Chrome reports a nonzero safe-area inset only
in full screen on a phone with a camera cutout; with M8's full-screen
button the baseline adds a full-screen Android fixture. Each fixture runs
at 100%, 115% and 130% text, and in high contrast for the Duel.

**One thing to measure first.** `index.html` reserves 32 px at the top and
48 px at the bottom for browser bars on every touch device in landscape.
The page height is `100dvh`, which in Safari and Chrome alike already
leaves out a visible bar. If so, the reserve counts a showing bar twice,
and on `phone-short` with Chrome's address bar up that leaves about 220 px.
This is inferred, not measured; the baseline measures both browsers and
the reserve changes to match.

## What the real-device testing needs

The owner tests on real devices: an **iPhone 17 Pro Max** and a **Galaxy
Tab A8** on Android 14 (owner, 2026-10-08 and 10-09). Emulation and a resized desktop window
find layout bugs but never count as the device pass: they miss touch,
memory, browser bars and audio.

**The gap: no small or Android phone.** The Pro Max is the roomiest phone
there is (956x440), so the cramped cases, the 360 px Android screen, the
iPhone SE's 667 px width and Chrome's address bar on a phone, are covered
only by fixtures. The tablet covers Android's browsers and older hardware,
but at tablet size, not a phone's.

**Closing most of it for free (ruled with M7):**

- **Android Studio's phone emulator** on the owner's PC, set to a 360 px
  Galaxy-class screen: real Chrome on Android, address bar and keyboard
  included. It stands in for the 360 px Android row and Chrome's bar.
- **Display Zoom on the owner's iPhone** (Settings, Display & Brightness,
  Display Zoom, Larger Text): Safari then reports a smaller phone's
  viewport, with real touch. The size it reports is measured in the
  baseline, not assumed.
- **Chrome's device mode** (DevTools) for quick layout checks only; it is
  desktop Chrome, so it misses the bars and touch.

None of these measures weak hardware: speed and memory stay with the Galaxy
Tab A8. **A second-hand Galaxy A phone** stays optional, to close
real touch on a small Android phone and weak phone hardware at once.

Each pass records device, OS and browser version, text size, scene, and any
issue in the QA sheet mobile wave 1 adds.

## Ruled with M7

The owner took the matrix as drafted (2026-10-09), so these are ruled:

- **The small-phone checks:** the emulator and Display Zoom, with a used Galaxy A phone optional.
- **The OS pair:** current and previous iOS, Android 10 or later.
- **The old-browser message,** in mobile wave 1.
