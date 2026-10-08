<!-- source-of-truth: docs/plan-mobile-overhaul.md, vite.config.ts, package.json, index.html, src/gameBoot.ts, src/platform/clientProfile.ts, src/platform/quality.ts, src/platform/gestures.ts · last-verified: 2026-10-08 · DRAFT device list for the 2.0 mobile pass (decision M7); re-verify at each mobile wave, at the 2.0 cut, and when a new iOS or Android major ships -->

# Mobile support matrix (draft)

**Status 2026-10-08: DRAFT, decision M7 of
[plan-mobile-overhaul.md](plan-mobile-overhaul.md).** Nothing here is ruled.
The 1.8 draft asked for "a small named matrix before wave 1" and "no generic
`mobile` label"; this is that list. It assumes P11's recommendation
(landscape phones, browser only) and is marked where it depends on it.

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
2026-10-08). The two newest platform features the game relies on sit under
that line: `structuredClone` (56 call sites in `src/`; Safari 15.4, Chrome
98) and `dvh` units in `index.html` (Safari 15.4, Chrome 108). WebGL is
needed for the tested levels.

**Proposed: an old-browser message.** Below the floor the game's script fails
to parse and the player sees the dark page and nothing else. A few lines of
plain inline script in `index.html`, run before the game's module, can check
for the floor's features and show "This browser is too old to run Darling
Blades" with the supported list. Small and reversible; mobile wave 1.

## Phones (landscape, compact profile)

| Device class | Screen in landscape (CSS px) | Browser | Level | Why it is here |
| --- | ---: | --- | --- | --- |
| **6.1-inch iPhone** (iPhone 12 to 17, 16e) | 844x390 to 874x402 | Safari, current iOS | **Tested** | The most common iPhone size; the main design target |
| **Android, 360 px class** (many Samsung Galaxy A and S phones) | about 780x360 | Chrome and Samsung Internet, current | **Tested** | The shortest common screen, so the design minimum. A Galaxy A phone is also the weakest common hardware, so it sets the performance floor (M14) |
| iPhone SE, 2nd and 3rd generation | 667x375 | Safari | Supported | The narrowest screen (16:9); Version C's three columns must fit it |
| iPhone 12 and 13 mini | 812x375 | Safari | Supported | Short and notched |
| Large iPhones (Plus and Pro Max) | 926x428 to 956x440 | Safari | Supported | The largest phone layout |
| Pixel and other 412 px Android | about 915x412 | Chrome | Supported | Common Android size above the minimum |
| Any phone on Firefox for Android | | Firefox 114+ | Works, not tested | Small share |
| Chrome, Edge or Firefox on iPhone | | Same WebKit engine as Safari | Works, not tested | Safari's testing covers the engine |
| iOS 16.4 to the version before last | | Safari | Works, not tested | Above the build floor; outside the tested pair |
| Below Safari 16.4 or Chrome 111 | | | Not supported | The build floor |

**OS versions (proposed):** Tested and Supported mean **the current iOS
and the one before** (iOS 26 and iOS 18 when written; the pair moves each
September), and **Android 10 or later with an up-to-date Chrome or Samsung
Internet.** iOS 26 runs on the iPhone 11 and later, including the second and
third generation SE.

**Phones held upright** [P11]: the rotate screen, as today.

## Tablets (wide profile)

Tablets keep the desktop composition, fit to the screen. In landscape that
draws at about 0.9 scale on an 11-inch iPad, which reads today.

| Device class | Screen (CSS px) | Browser | Level |
| --- | ---: | --- | --- |
| iPad, 10.9 to 11 inch, landscape | 1180x820 | Safari | **Tested** if the owner has one, else Supported |
| iPad mini, landscape | 1133x744 | Safari | Supported |
| Any tablet held upright (M11) | e.g. 820x1180 | Safari, Chrome | Supported if M11 is ruled yes; today it shows the rotate screen |
| Android tablets, landscape | 1280 wide and up | Chrome | Works, not tested |

The profile rule's 500 px threshold (plan C1) is checked against this table:
the iPad mini's 744 px height must land in the wide profile and every phone
above in compact.

## Desktop (unchanged, listed for completeness)

Chrome, Edge, Firefox and Safari on Mac, current versions, and the desktop
app (Windows, WebView2). A touchscreen laptop is a desktop: the play stats'
classifier already treats a touch device 1280 px wide or more as one
(`src/platform/clientProfile.ts`). Desktop gets the wide profile and touch
works on it as today. No new desktop testing comes from this plan.

## The layout fixtures

The automated checks render each compact scene at these sizes. They start
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
| `phone-large` | 956x440 | 62, 62, 21 | Pro Max class |
| `tablet-mini` | 1133x744 | 0, 0, 20 | iPad mini (must resolve to wide) |
| `tablet-upright` | 820x1180 | 0, 0, 20 | Upright tablet (M11) |

Each runs at 100%, 115% and 130% text, and in high contrast for the Duel.

**One thing to measure first.** `index.html` reserves 32 px at the top and
48 px at the bottom for browser bars on every touch device in landscape. It
was tuned for Safari's bars. If Android Chrome already leaves its address
bar out of the page height, the reserve takes another 80 px off the
`phone-short` screen and leaves it about 200 px tall. This is inferred, not
measured; the baseline settles it, and the reserve becomes per-browser if
so.

## What the real-device testing needs

The owner tests on real devices. The two Tested phones are the minimum: one
iPhone and one Android of the 360 px class. If the owner has no Android
phone, the options are a second-hand Galaxy A phone, or a paid real-device
cloud service for spot checks. Emulation and a resized desktop window find
layout bugs but never count as the device pass: they miss touch, memory,
browser bars and audio.

Each pass records device, OS and browser version, text size, scene, and any
issue in the QA sheet mobile wave 1 adds.

## Open for the owner

- **Which phones and tablets do you have?** The Tested rows are written for
  one iPhone and one Galaxy A or S phone; they change to what you own.
- **The OS pair** (current and previous iOS, Android 10+) is a proposal.
- **The old-browser message** above is a proposal.
