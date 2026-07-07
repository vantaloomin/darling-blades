<!-- source-of-truth: src-tauri/tauri.conf.json, src-tauri/Cargo.toml, src-tauri/src/lib.rs, src-tauri/capabilities/default.json, src/platform/desktopWindow.ts, package.json, vite.config.ts · last-verified: 2026-07-06 · re-verify when the Tauri config or build scripts change -->

# Desktop build (Tauri)

Darling Blades ships as a standalone desktop app via **[Tauri 2](https://tauri.app)**.
Tauri wraps the existing Vite/Phaser build in a native window backed by the OS
webview (WebView2 on Windows), so the installer is a few MB of native code plus
the game's own assets — no bundled Chromium the way Electron does it.

**The web frontend is almost entirely Tauri-agnostic.** The desktop app loads the
exact same `dist/` that `npm run build` produces and that `npm run play:lan`
serves to phones. The **one** exception is `src/platform/desktopWindow.ts`: when
the render-resolution setting changes, it resizes the OS window to match — the
chosen resolution lives in the webview's `localStorage`, so only the frontend can
drive the resize. It is a guarded no-op in a plain browser (which can't resize its
own window) and pulls the Tauri window API in via a **dynamic import**, so a
browser build lazy-chunks it and never loads it. The only other game-visible
difference is that the app has its own `localStorage`, so a save made in a browser
does **not** carry into the desktop app (and vice-versa) — each is a separate
storage origin.

**Render size drives the window.** The Settings "Render size" chips
(720p/1080p/1440p) set both the render backing store (`1280·k × 720·k`) **and**
the desktop window's logical size, clamped to the screen work area and re-centered
(`desktopWindowSize` in `src/platform/renderScale.ts`). Picking a resolution the
display can't hold shrinks-to-fit and the surplus becomes supersampling. The
default window (`tauri.conf.json`) is 1920×1080 to match the default 1080p setting
so a fresh launch doesn't visibly resize.

## Prerequisites

- **Rust toolchain** (`rustup`, `cargo`) with the `x86_64-pc-windows-msvc` target.
- **MSVC C++ build tools** (Visual Studio Build Tools 2022, "Desktop development
  with C++"). Cargo auto-detects them via `vswhere`; they need not be on `PATH`.
- **WebView2 runtime** — preinstalled on Windows 11. The installer also carries a
  download-bootstrapper that fetches it on older machines that lack it.

The Tauri CLI is a dev dependency (`@tauri-apps/cli`) and the JS window API is a
runtime dependency (`@tauri-apps/api`, used only by `desktopWindow.ts`), so
`npm install` provides both — no global install needed.

## Commands

| Command | What it does |
| --- | --- |
| `npm run app:dev` | `tauri dev` — runs `npm run dev` (Vite on :5173) and opens the app in a live-reloading native window pointed at the dev server. |
| `npm run app:build` | `tauri build` — runs `npm run build` (typecheck + `vite build` → `dist/`), compiles the Rust shell in release, and bundles an **NSIS installer**. |
| `npm run tauri -- <args>` | raw passthrough to the Tauri CLI (e.g. `npm run tauri -- icon <png>`). |

Output of `app:build`:

- Installer: `src-tauri/target/release/bundle/nsis/Darling Blades_<version>_x64-setup.exe`
- Raw executable: `src-tauri/target/release/app.exe` — the Cargo binary (the crate
  is named `app`); it is a self-contained, portable exe (the `dist/` frontend is
  embedded at compile time) and runs directly if WebView2 is present. The friendly
  "Darling Blades.exe" name only applies to the copy the NSIS installer lays down
  in Program Files; rename `app.exe` yourself if you want a branded portable build.

> The **first** `app:build` compiles ~400 Rust crates and downloads the NSIS
> tooling — expect 10–20 minutes and a multi-GB `src-tauri/target/`. Subsequent
> builds are incremental (seconds to a couple of minutes). `src-tauri/target/` is
> build cache — safe to delete, never edit.

## Configuration (`src-tauri/`)

- **`tauri.conf.json`** — the app manifest. `productName` "Darling Blades",
  `identifier` `com.loominvanta.darlingblades`, a **1920×1080** centered,
  resizable, dark-titlebar window (min 960×540 — the game FITs any 16:9-ish size;
  the default matches the default 1080p render setting and `desktopWindow.ts`
  resizes it live to whatever resolution is picked), and
  `bundle.targets: ["nsis"]`. `build.frontendDist` is `../dist`; `beforeBuildCommand`
  is `npm run build`. `security.csp` is `null` — the game is fully offline and
  makes no network requests, so no CSP is injected (a strict CSP risks breaking
  Phaser's canvas/WebGL/blob usage; revisit only if remote content is ever added).
- **`Cargo.toml` / `src/{main,lib}.rs`** — the stock Tauri 2 shell. `lib.rs` wires
  `tauri-plugin-log` in debug builds only and otherwise just runs the webview; the
  game needs no custom Rust commands or native APIs.
- **`capabilities/default.json`** — `core:default` plus
  `core:window:allow-set-size` and `core:window:allow-center` (the only Tauri JS
  APIs the game calls, from `desktopWindow.ts`, to resize the window to the render
  resolution).
- **`icons/`** — generated by `tauri icon` from the card-back emblem
  (`public/assets/art/scenes/card-back.png`, center-cropped square). Regenerate
  with `npm run tauri -- icon <1024²-png>` if the brand art changes.

## The asset weight

`public/assets/art/` is ~350 MB (282 full-res + 282 half-res card arts — the
210-card base pool plus the 69-card Ragnarök expansion and effect tokens — plus
scene backdrops and the hero portrait), all copied into `dist/` and bundled into
the installer, so the setup
`.exe` is correspondingly large (hundreds of MB). That is expected for a
fully-offline art-complete game; if a lean installer is ever wanted, the lever is
shipping only the half-res set (the `lite` tier art) rather than trimming code.

## Mobile (deferred)

`tauri icon` also emitted iOS/Android icon sets, but no mobile Tauri target is
configured. Phone play today is the LAN path (`npm run play:lan`, see
[mobile-lan-plan.md](mobile-lan-plan.md)); a real Tauri mobile target is a future
option, not a shipped one.
