<!-- source-of-truth: index.html, vite.config.ts, package.json, src/main.ts, src/scenes/, src/ui/CardZoomPreview.ts, src/ui/CardView.ts, src/ui/BoardCardView.ts, src/scenes/SettingsScene.ts, src/ui/fx/FXSupport.ts, src/audio/AudioManager.ts, src/meta/SaveManager.ts, src/meta/services.ts, src/engine/Game.ts, src/engine/actions.ts, src/engine/view.ts, src/engine/events.ts, src/engine/types.ts, src/ai/AIPlayer.ts, src/ai/determinize.ts, src/art/ArtResolver.ts, src/config/rules.ts · last-verified: 2026-07-09 · plan doc — grounded in the 2026-07-02/03 mobile audits; Tier 1 shipped (2026-07-06 status note below), Tier 2 still a plan; re-verify when each tier ships -->

# Mobile / LAN plan

The design doc for playing Darling Blades on a phone over the local network — first
the existing single-player game (Tier 1), then LAN PvP duels (Tier 2). Every
claim below is grounded in the four codebase audits run 2026-07-02/03
(touch input, layout/scale, net seam, perf/compat); citations are file:line
from those audits. **Note (2026-07-04): `DuelScene.ts` line numbers and screen
coordinates cited below predate the 1a "Immersive Fan" relayout — the touch
SEMANTICS they document (gesture rules, 90px floors, guard behavior) shipped
and still hold, but positions moved; see architecture.md "The duel board" for
current geometry.** Each tier ends runnable and testable on its own, per the
playbook (§3). **Status (2026-07-06): Tier 1 has since shipped** — LAN serving
(`npm run play:lan` → `scripts/serve-lan.ts`, statically serving the build with
a terminal QR via the `qrcode-terminal` dep), the self-hosted webfonts
(`public/assets/fonts/*.woff2`, the CDN links are gone), and the touch-gesture
layer (`src/platform/gestureCore.ts` + `src/platform/gestures.ts`, note the
`src/platform/` seat rather than the `src/ui/` one this plan proposed) are all
live. **Tier 2 (LAN PvP) is not built** — there is still no `src/net/`,
`server/`, or `pvp` script — so §2 below remains the live design spec, and the
Tier 1 sections read as historical design record for what shipped.

## Goals

1. **Tier 1** — a phone on the same LAN loads the game from the desktop and
   plays the entire existing single-player loop (menu → gauntlet/practice →
   shop → packs → collection → deck builder) comfortably by touch alone.
2. **Tier 2** — two devices duel each other over LAN, host-authoritative,
   preserving the hidden-information honesty model the AI already lives
   under (redacted `PlayerView` as the only thing a non-host party sees).
3. Throughout: the iron invariants hold — pure headless engine, seeded
   determinism, redacted views, save-schema migrations, Phaser pinned to 3.x.

## Non-goals

- Internet/WAN play: no NAT traversal, TLS, accounts, or matchmaking.
- Anti-cheat beyond the view boundary — LAN couch play trusts decklists.
- Native app wrappers, app stores.
- Portrait mode and PWA install are **decisions, not commitments** (see
  Decision points); the default plan is landscape-only, plain browser.
- Server-side persistence / shared accounts (Tier 3 discussion only).

## Baseline facts the plan builds on

- Design res 1280×720, `Scale.FIT` + `CENTER_BOTH` (`src/main.ts:16-26`). On
  common phones in landscape the game renders at **0.50–0.60 scale**
  (693×390 CSS on an iPhone 15); portrait collapses to ~0.31 scale with the
  game strip occupying ~26% of screen height — unusable (layout audit §2).
- Phaser 3.90 touch semantics: `pointerover` fires at touch-down,
  `pointerup` fires **before** `pointerout` and is hit-tested at the
  **release** position; 1 touch pointer registered; touch on canvas is
  preventDefaulted (touch audit §1). These four facts drive the whole
  gesture design.
- The engine is already a host-authoritative server core: seat-checked
  `submit` (`src/engine/actions.ts:254`), JSON-safe
  `Action`/`PlayerView`/`GameEvent`, RNG sealed inside `GameState` and
  excluded from views (`src/engine/view.ts:52-84`), and a proven
  view-only reconstruction path (`src/ai/determinize.ts:230-293`)
  (net-seam audit, bottom line).
- No networking code of any kind exists in `src/` today (grep-verified);
  Vite binds localhost-only (`vite.config.ts:4-13`, no `--host` anywhere).
- Save is one `localStorage` blob per device **and per origin**
  (`src/meta/SaveManager.ts:55,127-137`, bound in
  `src/meta/services.ts:17-21`) — a phone joining over LAN starts fresh.

---

## Tier 1 — phone plays the existing single-player game over LAN

Everything in this tier is client-side + config; no server code, no engine
changes (except one save-schema bump for the quality setting).

### 1.1 LAN serving and join

- **Serving:** add `server: { host: true }` and `preview: { host: true }` to
  `vite.config.ts`, exposed via new npm scripts (`dev:lan`, `play:lan` =
  build + `vite preview --host`) so plain `npm run dev` stays
  localhost-only. For play sessions prefer the built `dist/` via preview —
  no HMR websocket churn on the phone; `base: './'` already makes `dist/`
  relocatable (`vite.config.ts:5`).
- **Join UX:** print the LAN URL **and a terminal QR code** on server start
  (`qrcode-terminal` dev-dependency, invoked from a tiny Vite plugin or a
  `scripts/lan-qr.ts` wrapper). Scanning the QR is the join flow; the URL
  itself is the fallback.
- **Firewall (environmental, document in README):** first `--host` run
  triggers the Windows Defender allow prompt for node.exe — must be allowed
  on Private networks.
- **No HTTPS needed:** localStorage, WebAudio, canvas, and fonts all work on
  insecure LAN origins; only service workers/PWA would need HTTPS (layout
  audit §7). 
- **Save-origin gotcha:** the desktop should keep playing on
  `localhost:5173` (its existing save origin) while the phone uses the LAN
  IP — `--host` serves both simultaneously. The phone's save is its own;
  the onboarding/free-starter flow reruns there (layout audit §6). Accepted for Tier 1;
  export/import is a Tier 3 topic.
- **Fonts must be self-hosted:** the two Google-CDN webfonts
  (`index.html:7-11`) fail on a phone without internet and fall back to
  system serif (`src/scenes/PreloadScene.ts:36-45`). Vendor the two woff2
  files into `public/` and drop the CDN links.

### 1.2 Host page: viewport, CSS, orientation

`index.html` changes (all cited gaps from layout audit §1):

- Viewport meta → `width=device-width, initial-scale=1, viewport-fit=cover,
  user-scalable=no, maximum-scale=1` (kills iOS double-tap zoom on the
  letterbox; the canvas is already protected by Phaser's touch capture).
- CSS: `height: 100dvh` instead of `height:100%` (stops FIT re-letterboxing
  when the address bar collapses mid-play), `overscroll-behavior: none`,
  `touch-action: none` on body (kills pull-to-refresh from the letterbox
  gutters — Phaser only preventDefaults the canvas), `user-select: none` +
  `-webkit-touch-callout: none`, a `theme-color` meta.
- **Landscape-first, portrait-blocked:** add a DOM "rotate your device"
  overlay driven by a resize/orientation listener (none exists today —
  grep-confirmed, layout audit §2). Portrait FIT is ~0.31 scale — blocking
  it is the honest option. Offer a fullscreen button (Phaser
  `startFullscreen()`, currently uncalled) on the main menu for touch
  devices; on Android, follow with `screen.orientation.lock('landscape')`
  (no-op on iOS, fine).
- **DPR: deliberately unchanged.** The 1280×720 backing store upscales
  ~1.6× on a 3×-DPR phone — mild softness, but it keeps GPU cost flat and
  most Text already renders at `resolution: 2` (layout audit §1). Revisit
  only if a real phone looks bad.

### 1.3 Touch input mapping — the UX pattern (centerpiece)

**Problem being solved** (touch audit §1–§3): on touch, every tap fires the
hover handlers; a hover-dwell zoom "works" as hold-to-preview but releasing
the finger fires `pointerup` and **casts the card**; `pointerup` is
hit-tested at the release position so dragging a finger across the hand and
lifting casts whatever it lands on; and all three duel inspection
affordances (hover-dwell zoom, Z hotkey, right-click inspect —
`src/ui/CardZoomPreview.ts:58-71`, `src/scenes/DuelScene.ts:530,631,749`)
are unreachable, leaving **no way to read a card in the duel**.

**Canonical gesture table** (applies to every scene; thresholds are new
constants defined once in the gesture module — initial values below, tune
on device):

| Gesture | Recognition | Result | Replaces |
| --- | --- | --- | --- |
| **Tap** | down→up within `TAP_MAX_MS` (~250 ms), movement ≤ `TAP_SLOP_PX` (~10 design px), release over the same object as the press | **Activate** — exactly today's click semantics (cast / toggle attacker / press button / pick) | left-click |
| **Long-press** | held ≥ `LONGPRESS_MS` (~450 ms) within slop | Docked **zoom preview** (`CardZoomPreview`) opens and the pointer is *consumed* — release does **not** activate. Preview stays open (sticky) after release | 400 ms hover-dwell + the Z hotkey |
| **Tap on the open preview** | — | **Full inspect overlay** (the `showInspect` treatment, `DuelScene.ts:943`); tap anywhere closes. The docked preview is a huge target (~211×295 CSS on a 6.1″ phone) | right-click inspect |
| **Tap on an action-less card** (land-stack tops `DuelScene.ts:629-634`; opponent permanents when not targeting) | — | Full inspect directly — the in-repo precedent is Collection's tap-to-inspect (`src/scenes/CollectionScene.ts:175`) | right-click inspect |
| **Drag** | movement > slop before release | **No action** — the classifier kills the release. Fixes the drag-across-the-hand accidental cast | (new safety) |
| **Double-tap** | — | **Not used.** Rejected: tap must activate immediately; disambiguating a double-tap adds a ~250 ms delay to casting, the game's highest-frequency action, and the first tap of a pair is irreversible | — |
| **Swipe** (Collection grid, stretch) | horizontal > ~60 design px | Page the grid | mouse wheel (`CollectionScene.ts:105-107`) |
| **Hover-lift / hover-SFX / hover-tints** | `pointer.wasTouch` → hover handlers early-return; a pressed-state tint (and small lift for hand cards) on `pointerdown` replaces them, restored on up/out | — | `pointerover` feedback (`DuelScene.ts:735-744`, hover SFX `MainMenuScene.ts:37`, all hover tints) |

Notes:

- **Mouse path unchanged.** All classification is gated on
  `pointer.wasTouch`; desktop keeps hover-lift, hover-dwell, Z, and
  right-click exactly as today. Right-click handlers stay (they already
  degrade gracefully — touch audit §3).
- **Implementation seat:** a pure pointer-sequence state machine
  (`src/ui/gestureCore.ts` — no Phaser import, consumes plain
  `{x, y, t, phase}` samples, emits `tap | longpress | drag`) plus a thin
  Phaser binder (`src/ui/gestures.ts`) that wraps an interactive object's
  pointer events. Pure core = headless unit tests (tests never import
  Phaser). Respect the container trap — bind to the objects that are
  already interactive (Text/Image/`CardView.enableInput()` zones), never a
  scaled Container (playbook §11).
- **Multi-touch:** leave the pointer default alone (1 mouse + 1 touch —
  touch audit §1). Nothing needs two fingers; a second finger staying
  silently ignored is the desired behavior.
- **`topOnly` stays true** — overlapped hand cards get their exposed strip
  as the tap target, which passes at ≤ 9 cards (touch audit §7); the
  long-press peek + sticky preview makes crowded hands safe to read.
- **Copy fixes:** device-conditional hint text — "right-click cancels"
  (`DuelScene.ts:776`) and "Click anywhere to close" (`DuelScene.ts:958`,
  `CollectionScene.ts:213`) are wrong on touch.
- The foil `pointermove` parallax degrades to rub-to-shimmer on touch
  (works, cosmetic — touch audit §6). No change.

### 1.4 Hit-target minimums

**Standard:** every interactive object gets a hit area of at least
**90×90 design px per dimension it can afford, minimum 90 px in the short
dimension** — that is ≥ 44 CSS px at the worst supported FIT scale (~0.50 on
a 360×800 Android, layout audit §2). Mechanism: a shared
`inflateHitArea(obj, minW, minH)` helper (`src/ui/`) that sets an explicit
centered `Phaser.Geom.Rectangle` hit area larger than the glyph bounds —
**visuals unchanged**, so desktop is untouched. Respacing only where
adjacency forces it. Adjacent targets: centers ≥ 90 design px apart or
merged into one control.

Priority offenders and fixes (full table in the touch audit §7; everything
card-shaped already passes, essentially all text-button chrome fails):

| Element | Where | Why it's first | Fix |
| --- | --- | --- | --- |
| Volume −/+/♪/mute | `VolumeControl` (widget since deleted — audio controls live in `src/scenes/SettingsScene.ts` as of 2026-07-04, built to the 90 px rules) | Smallest targets in the game (~2.0×2.4 mm) | Rebuild the widget at ~2× spacing + inflated hit rects |
| DeckBuilder deck rows | `src/scenes/DeckBuilderScene.ts:206-219` | 1.6 mm tall and **tap = destructive remove**; list also hard-clips at y>560 (`:209`) with no scrolling | Touch profile: bigger row pitch, remove via an explicit per-row − button, add paging/scroll |
| DeckBuilder basics ± steppers | `DeckBuilderScene.ts:181-192` | Adjacent-target mis-tap (pair centers 40 px apart) | Respace to ≥ 90 px, inflate |
| Duel HUD phase button | `DuelScene.ts:271-280` | The core loop — highest-frequency button, ~3.7 mm tall | Inflate hit height to ≥ 90 px |
| Concede | `DuelScene.ts:318-321` | ~1.5 mm tall **and** 16 px from the canvas corner (browser gesture zone) | Inflate + move inboard |
| Collection/DeckBuilder pagers ‹ › | `CollectionScene.ts:95-103`, `DeckBuilderScene.ts:63-70` | 2.1–2.5 mm wide, and Collection's are the only touch paging path | Inflate width; Collection swipe as stretch |
| Main menu items | `src/scenes/MainMenuScene.ts:68-75` | 15 px dead gap between rows | Hit boxes fill the full 56 px pitch |
| Back buttons (5 scenes) | `GauntletScene.ts:77-79`, `CollectionScene.ts:116-118`, `DeckBuilderScene.ts:57-59`, `ShopScene.ts:144-150`, `CardShowcaseScene.ts:67-73` | ~2.3 mm tall, every scene exit | One helper call each |
| Life totals + stack readout | `DuelScene.ts:246-266,281-300,303-309` | Burn/cancel **targets** during targeting mode | Inflate |
| Filter chips | `CollectionScene.ts:74-91` | ~2.8 mm tall | Inflate to the 90 px pitch |
| Overlay/results/pack/save/gauntlet buttons | `DuelScene.ts:1064-1141`, `PackOpeningScene.ts:174-180,309-323` (respace the adjacent Shop/Menu pair), `DeckBuilderScene.ts:232-241`, `GauntletScene.ts:269-306` | 3.8–5.2 mm heights | Sweep with the helper |

Acceptance is mechanical: a preview probe walks every scene's interactive
objects and asserts world-space hit dimensions ≥ the minimum (see §1.7).

### 1.5 Audio on iOS (unlock is fine; resume is broken)

The gesture unlock already works on touch (`src/audio/AudioManager.ts:40-50`
— capture-phase pointerdown, listeners removed only once the context reads
`running`). What's missing is **recovery** (perf audit §4):

- iOS Safari puts the AudioContext into the non-standard `'interrupted'`
  state on screen lock / app switch / calls; nothing ever calls `resume()`
  again, and `ensureContext()`'s resume condition only matches
  `'suspended'` (`AudioManager.ts:117`) → **permanent silence** for the
  session. Fix: resume whenever `state !== 'running'`, and add
  `visibilitychange` + `pageshow` + `focus` handlers that attempt resume
  and, on failure, re-arm the unlock gesture listeners. (There are
  currently zero visibility/lifecycle listeners in `src/` — grep-confirmed.)
- **Save flush on backgrounding:** the write debounce
  (`src/meta/SaveManager.ts:64,124`) can lose a save made < 250 ms before
  an app switch — iOS discards frozen tabs without `beforeunload`. Add a
  `pagehide`/`visibilitychange`→hidden listener that calls the existing
  `flush()`. The listener lives in the browser layer (`src/main.ts` or a
  boot scene) calling into `Services.save` — `src/meta` stays free of
  browser APIs per the purity invariant.

### 1.6 Mobile FX / performance profile

**Quality tier.** `fxAvailable()` is renderer-type-only
(`src/ui/fx/FXSupport.ts:4-6`) and is the designed choke point — extend it
to a `Quality` tier (`full | lite`): auto-detected (touch +
`navigator.deviceMemory`/UA heuristics) with a manual override persisted in
`SaveData.settings` (**schema bump → v4 with a real `migrate()` + test**,
per the save invariant). The three direct
`renderer.type === Phaser.WEBGL` checks that bypass the choke point
(`PackOpeningScene.ts:61,156`, `ShopScene.ts:126`) must be routed through
it (perf audit §2).

**`lite` disables/downgrades** (the duel is already effectively lite —
board/hand are `fx:'none'`, `DuelScene.ts:719,1043`):

- No `IridescencePostFX` attachment (`src/ui/CardView.ts:203-206`,
  `src/ui/fx/HoloEffects.ts:106-139`) → the existing gold-tint canvas
  fallback branch (`CardView.ts:208`).
- No `preFX.addShine` (`CardView.ts:197-199`, `HoloEffects.ts:121-123`,
  `ShopScene.ts:126-127`, `PackOpeningScene.ts:61`).
- PackOpening's 4 simultaneous pulsing `postFX.addGlow` — the single most
  expensive FX moment in the game (`PackOpeningScene.ts:156-165`) → tinted
  ring-sprite pulses.
- Keep: galaxy TileSprite, sparkle emitters, all particles (measured
  trivial — perf audit §2–3).

**Texture strategy for the 152-card art program** (82 of 152 PNGs shipped
at audit time). The math (perf audit §1): 640×800 RGBA = 2.05 MB/card →
**~311 MB of card-art VRAM at 152**, worst-case ~370–400 MB GPU plus the
browser's CPU-side decoded copies — into iOS Safari's tab-kill territory.
Meanwhile the largest render the game ever does is the inspect overlay at
~356×259 px (art window 264×192 card-local, `CardView.ts:16`, × 1.35), so
the sources are ≥ 2.4× oversampled *everywhere*:

1. **Required: a half-res 320×400 mobile set** — generated by a build
   script (Pillow, same toolchain as `scripts/gen-card-art.ts`) into a
   sibling art dir + manifest entry; `ArtResolver`
   (`src/art/ArtResolver.ts:24-28,39-46`) picks the set by quality tier at
   preload. 311 → **78 MB** VRAM at 152 cards; download ~144 → ~40 MB;
   visually lossless at the 1280×720 backing store.
2. Stretch: lazy per-scene loading (today everything loads upfront in
   `PreloadScene.preload()` — `ArtResolver.ts:24-28`).
3. Cheap win, gated: `render.mipmapFilter` for board-tile minification
   shimmer (`BoardCardView.ts:17-18,96-106`) — **WebGL2 only** (the art is
   non-power-of-two; WebGL1 can't mipmap NPOT).

`syncHand()`'s destroy-and-rebuild churn (`DuelScene.ts:686-753`) is a
known cost on budget Androids — **do not pre-optimize**; instrument on a
real phone first (playbook §6).

### 1.7 Tier 1 exit criteria (runnable/testable)

- `npm run play:lan` serves the build on the LAN and prints a QR; a phone scans
  it and completes the full loop (menu → optional tutorial → free starter claim
  → gauntlet duel → rewards → shop → pack → collection → deck edit) by touch
  alone.
- Long-press never activates a card; every duel card is readable via the
  gesture table above.
- Every interactive object ≥ 90 design px minimum hit dimension (probe).
- iOS: lock the screen mid-duel, unlock — SFX and music return.
- `lite` profile: zero PostFX pipelines attached; 320-set textures active.
- Full ladder green: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `npm run build`, doc checkers with zero warnings.

### 1.8 Tier 1 verification plan (playbook ladder)

**Headless (vitest):**
- `gestureCore` unit tests: synthetic pointer sequences → classification,
  including boundary cases at exactly the slop/timing thresholds, and the
  "up over a different object" case.
- Quality-tier decision function unit tests; SaveData v3→v4 migration test.
- Build-script test: mobile art set exists, every file 320×400, manifest
  parity.

**Preview probes** (hidden-tab recipe, playbook §8 — drive
`window.__game.loop.step`, emit events on objects, assert state not pixels,
snapshot/restore the save):
- Hand card: emit a long-press-shaped sequence → assert **no** `spellCast`
  event and the zoom preview object exists; emit a tap sequence → assert
  the cast happened.
- Hit-area sweep: for each scene, walk interactive objects and assert
  world-space hit dims ≥ minimum.
- PackOpening under `lite`: children scan asserts no glow FX attached.
- Texture probe: art texture dimensions are 320×400 under `lite`.

**Needs a real phone — flag for the human, never fake-verified:**
touch feel and threshold tuning; iOS Safari audio interruption/resume;
dvh/address-bar behavior; FIT letterboxing at real aspect ratios; memory
headroom with the full art set (Safari tab kills); QR join + the one-time
firewall prompt; `lite` FX visual acceptability.

---

## Tier 2 — LAN PvP duels

### 2.1 Architecture: host-authoritative, and why lockstep is disqualified

**One authoritative `Game`, thin clients.** The host runs the single engine
instance; clients receive per-seat redacted state and submit `Action`s; the
host validates and broadcasts. This is not a preference — the engine's
design forces it:

- **Lockstep cannot work under hidden information.** For two clients to
  simulate the same game both need the seed, and the seed deterministically
  produces both decks' full order at construction
  (`src/engine/Game.ts:53-59`) with the PRNG living inside `GameState`
  (`src/engine/types.ts:210`, `src/engine/rng.ts:7-22`). Sharing the seed
  = either client can enumerate the opponent's deck order and hand.
  Lockstep is structurally open-handed play (net-seam audit §4).
- **`viewFor` is the anti-peek boundary**, exactly as it is the AI-honesty
  boundary today ("AI reads only the redacted `PlayerView`" — CLAUDE.md
  iron invariants; "if it's not in the view, no AI can see it" —
  `docs/architecture.md`). `viewFor(state, seat)`
  (`src/engine/view.ts:52-84`) hides your own deck order, the
  opponent's hand and deck, and **omits `state.rng` entirely** — a
  remote client that only ever receives `viewFor(theirSeat)` cannot cheat
  even with a hacked client, because the wire never carried hidden zones or
  the seed.
- **The engine already validates seats:** the first check in
  `validateAction` rejects any action whose `player` isn't the one named in
  `awaiting` (`src/engine/actions.ts:254`) — host-side anti-cheat for free.
- **Proof by precedent that a view is enough to act on:**
  `determinize(view, db, seed)` rebuilds a fully simulatable game from
  nothing but a redacted view (`src/ai/determinize.ts:230-293`), and HardAI
  runs whole playout searches on it. A remote human needs strictly less.
  The headless two-seat pump loop in `scripts/balance-matrix.ts:60-74`
  (awaiting → `(viewFor, legalActions)` → `submit`) is the server's main
  loop, already written.

**Seat contract:** everything the engine needs from a seat is
`(view, legal) in → one Action out` — the exact `AIPlayer.chooseAction`
shape (`src/ai/AIPlayer.ts:8-11`). A remote seat is another implementer of
that contract. Clients **cannot** compute their own action menu —
`legalActions` requires full `GameState` (`actions.ts:151`) — so the host
ships `legal` alongside `view` in every update.

### 2.2 Topology and transport

**Chosen: a tiny authoritative Node server in a new top-level `server/`
dir; both players are thin browser clients.** The engine is pure TS and
already runs headless under node (`balance-matrix` precedent), so
`server/` imports `src/engine` + `src/data` directly. The alternative —
desktop browser hosts the `Game` and a server merely relays — was
rejected: it forks DuelScene into host/guest code paths, while the
symmetric design needs only the one view-driven renderer that the guest
requires anyway (net-seam audit §6), and it yields reconnect + spectator
naturally later.

- **Transport: WebSocket** (`ws` package server-side; native `WebSocket`
  client-side — also native in Node ≥ 22, so tests can run real sockets
  headless). No WebRTC/mDNS complexity has any payoff on a LAN.
- The server also **serves `dist/` statically on the same port** (plain
  `node:http` + WS upgrade): one process, one port, one QR for both
  joining and playing. `npm run pvp` = build + start server.
- **Seed provenance:** the server rolls the seed (today it's client-side
  `Math.random()` in `DuelScene.ts:132`); the seed never appears in any
  client-bound payload (it is already absent from `PlayerView`).
- **Layering:** new `src/net/` holds the client networking layer —
  **Phaser-free** (extend the ESLint layer-purity rules to enforce it).
  Protocol types + redaction are additionally browser-free pure modules so
  vitest exercises them directly.

### 2.3 Protocol and serialization

Plain JSON messages; the audit verified the payload types are JSON-safe
end-to-end (net-seam audit §3): `Action`, `PlayerView`, and `GameEvent` are
plain data; optional fields (`targets?`, `x?`, `manaPlan?`,
`attachedTo?`) follow the absent-key pattern and all consumers distinguish
`undefined` the same way after a JSON round-trip (`actions.ts:286-287`,
`Game.ts:197,211`). **`GameState` itself is never serialized to a client**
— it contains both hands, both deck orders, and the RNG.

Sketch (`src/net/protocol.ts`, design latitude on names):

- Client → server: `hello {room, token?, deck}` · `act {action, seq}` ·
  `ping`
- Server → client: `joined {seat, token}` ·
  `update {view, legal, events, seq}` · `rejected {reason, view, legal}`
  (resync-on-illegal) · `peer {connected}` · `ended {winner, reason}`

Every `update` carries the **full** `view` + `legal` — a few KB of JSON.
Resync-by-default; no delta protocol on a LAN. `rejected` replies mirror
the human-path try/catch idiom (`DuelScene.ts:347-349`) instead of the
currently-uncaught non-human submit path (`DuelScene.ts:383`) — a
malformed or raced remote action must produce a resync, never a throw out
of a timer callback.

### 2.4 Wire redaction: events leak by design and need a per-seat redactor

Events deliberately carry full information — redaction is `viewFor`'s job
and "the presenter is responsible for not displaying hidden cards"
(`src/engine/events.ts:3-7`, `docs/architecture.md`). That contract is fine
in-process and **wrong on a wire**: `drew` carries `cardId` for both
players (`events.ts:13`), and `initialEvents` contains both opening hands
as 7 `drew`s each (`Game.ts:82-84`). Today's renderer doesn't even consume
`drew`, but the leak is at the wire, not the display (net-seam audit §6).

Fix: `redactEventsFor(events, seat)` in `src/net/` (pure): blank
`drew.cardId` when `e.player !== seat`; everything else passes
(`discarded`/`landPlayed`/`spellCast` reveal cards that become public
anyway). Test-gated (§2.10) — this function is the second half of the
anti-peek boundary and gets the same respect as `viewFor`.

**Known accepted tell:** response/end-step windows only open when the
responder actually holds a castable Charm (`Game.ts:308-319`,
`src/engine/phases.ts:86-96`), and `responseWindowOpened` is emitted to
everyone — the pause itself says "they have a Charm." Exists today vs
the AI (harmless); in PvP it's a real but *couch-acceptable* tell.
Documented, deferred (a fix — always-open windows with fixed delay — costs
pacing; Tier 3 decision).

### 2.5 DuelScene changes: the remote seam and the view-driven renderer

The net-seam audit located the seam precisely:

- **The pump:** the duel loop is already callback-driven with an async gap
  — `maybeRunAI()` re-checks `ended`/`awaiting` inside a 400 ms
  `delayedCall` before acting (`DuelScene.ts:372-388`). Adopt the audit's
  **push model** (its option 2, the better fit for PvP): introduce a
  `DuelSession` interface — `submit(action)`, plus an
  `onUpdate(view, legal, events)` callback into the scene. `LocalSession`
  wraps today's in-process `Game` + `AIPlayer` (the sync
  `chooseAction` stays sync inside it); `RemoteSession` wraps the
  WebSocket, where incoming `update` messages play the role the human
  input handler's `act()` plays today. Staleness/shutdown guards extend
  the existing re-check idiom to in-flight network messages (gauntlet
  `scene.restart` hazard, playbook §11 timer trap).
- **The renderer:** `sync()` renders from raw `GameState` and hardcodes
  `HUMAN = 0` / `AI = 1` (`DuelScene.ts:25-26,484-491`). Refactor it to
  consume `PlayerView` with a seat parameter — the view already carries
  everything `sync()` displays (`deckCount`/`handCount` replace the raw
  reads, `view.ts:64,71-72`; `awaiting` drives `syncButton`/`syncOverlay`,
  `view.ts:48`). Client-side affordability checks (the playable dot,
  castable menus) come **from the host-shipped `legal` menu**, not from
  `manaSources(state, …)` — `legalActions` already enumerates
  fully-specified casts (`actions.ts:170-186`), which is cleaner than
  porting mana math to views.
- Local single-player runs through `LocalSession` unchanged in behavior —
  this refactor must land green against the existing test suite before any
  socket exists (it's independently verifiable, and it's the wave boundary:
  DuelScene is the no-git collision hotspot and gets a single owner per
  playbook §3).
- **Waiting UX:** the guest needs a visible "waiting for opponent" state —
  today the overlay only builds when `awaiting.player === HUMAN`
  (`DuelScene.ts:1019`), and mulligan resolution is strictly sequential
  (`Game.ts:377-389`).

### 2.6 Engine gaps to close (small, test-gated)

1. **Concede-while-waiting:** `validateAction` rejects everything from the
   non-acting player (`actions.ts:254-255`), so you cannot concede while
   the opponent thinks. Extend validation to accept `concede` from either
   seat at any decision point (+ tests). Needed for the disconnect story
   and basic PvP courtesy.
2. **Timeout policy: none in the engine, by design** — the only anti-stall
   is `turnLimit` (`src/config/rules.ts:12`), and a disconnected opponent
   stalls forever (net-seam audit §7). Tier 2 keeps clocks out of the
   engine: the *server* owns policy (disconnect grace period → host UI
   offers "end match", resolving via the now-legal `concede` submit).
   Response clocks are Tier 3.
3. **PvP meta side-effects: none.** Match results/gold write to the local
   save today (`DuelScene.ts:133`); PvP duels award nothing in Tier 2
   (decision point below). Deck legality: the server validates submitted
   decklists against `CARD_DB` + construction rules; collection
   *ownership* is unverifiable across devices and explicitly trusted.

### 2.7 Discovery / join UX

- Host starts the server → console + a host lobby page show the LAN URL,
  a **QR code, and a 4–6 char room code**; guests scan or type
  `ip:port` manually (the fallback for QR-less devices).
- **No mDNS/zeroconf, deliberately:** browsers cannot discover mDNS
  services from a web page, Windows multicast + firewall behavior is
  flaky, and it would add a native dependency to solve a problem the QR
  already solves better on a LAN.
- Room code maps to the one hosted match (single-match server is fine for
  Tier 2); seat tokens (random, issued on join) authenticate rejoins.

### 2.8 Disconnect / reconnect — minimal story

- WS ping/pong heartbeat; on drop the server marks the seat disconnected,
  notifies the peer (`peer {connected:false}`), and **keeps the game in
  memory** — no engine timers exist to expire it (`rules.ts:12` is the
  only backstop).
- Reconnect = `hello` with room + seat token → server re-sends a full
  `update` (the resync-by-default protocol makes reconnect free — every
  update is already a complete view).
- Server process death = match lost. Accepted for Tier 2; durable resume
  is Tier 3.

### 2.9 Tier 2 exit criteria (runnable/testable)

- `npm run pvp` builds, serves, and prints QR + room code; a desktop
  browser and a phone (or two phones) join and complete a full duel over
  LAN, mulligans through `gameEnded`.
- Kill and reopen one client mid-duel → it rejoins via token and play
  continues from a full resync.
- Wrong-seat, malformed, and stale actions are rejected with a resync and
  never desync or crash either client.
- No payload sent to a client ever contains the seed, either deck, or
  the opponent's hand/draw identities (schema-walk + leak tests green).
- Single-player is behaviorally unchanged through `LocalSession` (full
  existing suite green).

### 2.10 Tier 2 verification plan (playbook ladder)

**Headless (vitest — the bulk of the proof):**
- Serialization: JSON round-trip property tests over `Action`/`PlayerView`/
  `GameEvent` harvested from full seeded games — round-tripped values
  behave identically (the absent-optional pattern, net-seam audit §3).
- **Leak tests (the anti-peek gate):** play N seeded games; assert
  `redactEventsFor` never emits an opponent `drew.cardId` (including
  `initialEvents`), and a schema walk over every `update` payload finds no
  `rng`, no deck arrays, no opponent hand contents.
- Engine: concede-from-non-acting-player tests; determinism suite stays
  green (no engine behavior may drift).
- **Full-stack headless integration:** start the server on an ephemeral
  port inside a test (Node ≥ 22 native WebSocket client), drive both seats
  with scripted AI brains implementing the `(view, legal) → Action`
  contract, play seeded matches to completion; replay the recorded action
  log into a local `Game` with the same seed and assert identical
  winner/final state (the determinism contract, `Game.ts:39-43`).
- Anti-cheat: wrong-seat submit rejected (`actions.ts:254` surfaced as
  `rejected`), occupied-seat join refused, malformed JSON → error, not a
  crash.
- Ladder: tsc, lint (including the new `src/net` purity rule), full vitest,
  build, doc checkers.

**Preview probes:** `RemoteSession` against a local server — join, play a
scripted opening, assert rendered counts match the shipped view; guest
"waiting for opponent" state visible.

**Needs real devices — flag for the human:** two-phone join UX end to end;
Wi-Fi drop (airplane-mode toggle) → reconnect resumes; perceived latency of
the resync-every-action model; simultaneous-tap feel at response windows.

---

## Tier 3 — polish / stretch (unordered menu, each its own decision)

- **Reconnect resilience:** durable match state (serialize `GameState`
  server-side — it's plain JSON, `Game.restore` exists, `Game.ts:123-127`),
  sequence-numbered event backlog, survive server restart.
- **Spectator:** needs a third redaction variant (both hands hidden — a
  `viewFor` for "no seat"); the symmetric-server topology makes the
  transport free.
- **Response clocks / always-open windows** to kill the Charm-in-hand
  tell (§2.4) — pacing cost, measure with real players first.
- **Save portability:** export/import the save blob (string or QR) between
  devices, or server-stored saves; interacts with the per-origin fact
  (§ Baseline). Any schema touch = version bump + migration per invariant.
- **Portrait support:** a real second layout, not a scale tweak (portrait
  FIT is ~0.31 — layout audit §2). Only if phone-first play becomes the
  norm.
- **PWA/install:** requires HTTPS for service workers — on LAN that means a
  local CA or accepting no-SW installs; revisit only if "add to home
  screen" demand materializes.
- **Collection-page swipe**, hand-fan max-size cap on touch, DPR-aware
  render sharpening — each cheap, none blocking.

---

## Decision points for the user

1. **Tier order — Tier 1 first, or jump toward PvP?** Recommended: Tier 1
   first. Every hour of it (touch mapping, viewport, hit targets, FX
   profile) is a prerequisite for phones in PvP anyway, and it ships value
   without any server code.
2. **Portrait support?** Recommended: no — landscape-only with a rotate
   overlay (portrait is ~0.31 scale, layout audit §2). Portrait is a Tier 3
   relayout if ever.
3. **Dedicated phone layout profile vs accepting FIT letterboxing?**
   Recommended: accept FIT at 0.50–0.60 scale with hit-area inflation
   (Tier 1 as planned). A phone-specific layout (bigger HUD, reflowed
   zones) is a large DuelScene fork — only revisit if on-device play feels
   cramped after Tier 1.
4. **PWA install story?** Recommended: skip (HTTP LAN blocks service
   workers); plain-browser + QR join is the product for now.
5. **PvP topology confirmation:** Node authoritative server in `server/`
   (recommended, §2.2) vs desktop-browser-as-host with a relay.
6. **PvP rewards:** none (recommended) vs gold-for-playing — touches the
   save/economy design if yes.
7. **Half-res art pipeline placement:** fold into `scripts/gen-card-art.ts`
   (resize at generation time) vs a separate build step over
   `public/assets/art/cards/` — interacts with the pending 152-card full
   art run (roadmap Planned).

## Risks (with the audit evidence)

- **GPU/tab-kill on phones at full art:** ~311 MB card-art VRAM at 152
  cards (2.05 MB × 152 @ 640×800 RGBA), worst-case ~370–400 MB GPU plus
  CPU-side decoded copies; iOS Safari kills tabs on memory pressure
  counting both (perf audit §1, measured 2026-07-03). Mitigation is the
  half-res set (§1.6) — treat it as required, not optional.
- **Permanent audio silence on iOS:** `'interrupted'` state is never
  resumed — the resume condition matches only `'suspended'`
  (`AudioManager.ts:117`) and zero lifecycle listeners exist in `src/`
  (perf audit §4). Without §1.5, one screen lock mutes the session.
- **Hit sizes are 2–4× under threshold across all button chrome** (touch
  audit §7, computed at FIT ~0.54 on a 6.1″ landscape phone): smallest =
  VolumeControl at ~2.0×2.4 mm (`VolumeControl.ts:40-50`); most dangerous =
  DeckBuilder's 1.6 mm-tall tap-to-remove rows
  (`DeckBuilderScene.ts:206-219`); highest-frequency = the HUD phase button
  at ~3.7 mm (`DuelScene.ts:271-280`).
- **Accidental casts are the default touch behavior** until the gesture
  layer lands: `pointerup` is hit-tested at release with no tap/drag
  discrimination, and hold-to-preview release fires the action
  (touch audit §1–2). Conversely, the gesture layer risks desktop
  regressions — every classifier path must be `wasTouch`-gated and the
  mouse path probe-verified unchanged.
- **Save loss on app switch:** 250 ms write debounce with no
  `pagehide` flush (`SaveManager.ts:64,124`) — fix is small (§1.5) but
  easy to forget.
- **PvP wire leaks are one missed redaction away:** `drew` carries both
  players' `cardId` (`events.ts:13`) and `initialEvents` contains the
  full opening hands (`Game.ts:82-84`). The leak tests in §2.10 are the
  gate; treat them like the AI-honesty invariant.
- **Stalls in PvP:** no engine timers (`rules.ts:12` only), and the
  non-acting player can't concede today (`actions.ts:254-255`) — without
  §2.6 a disconnected opponent locks the match forever.
- **No git:** the DuelScene session/renderer refactor (§2.5) is the
  collision hotspot; it must be a single-owner workstream, and waves
  decompose by file set (playbook §3).
- **Phaser stays pinned 3.x** — all gesture/FX work uses 3.90 APIs
  (playbook §11); the input-ordering facts this plan relies on
  (over-on-down, up-before-out, release-position hit test) were verified
  against the pinned 3.90 internals (touch audit §1) and must be
  re-verified if the pin ever moves.
