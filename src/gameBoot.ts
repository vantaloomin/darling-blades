import Phaser from 'phaser';
import { CARD_DB } from './data/catalog';
import { syncAchievements } from './meta/Achievements';
import { Services } from './meta/services';
import { applyBrowserOptOutDefault } from './meta/statsNotice';
import { signals } from './net/signals';
import { browserOptsOutOfTracking } from './net/signalsGate';
import { applyDesktopWindowSize } from './platform/desktopWindow';
import { IS_DEV } from './platform/env';
import { qualityTier } from './platform/quality';
import {
  RENDER_SCALE_UNLOCKED,
  resolveRenderScale,
  type RenderK,
  setActiveRenderScale,
  setActiveSceneZoom,
} from './platform/renderScale';
import {
  compactCanvasSize,
  compactLayoutRequested,
  designWindowZoom,
  resolveScreenMetrics,
  type ScreenMetrics,
} from './platform/screenMetrics';
import { screenFixtureNamed } from './platform/screenFixtures';
import { BootScene } from './scenes/BootScene';
import { AchievementsScene } from './scenes/AchievementsScene';
import { ArtLoaderScene } from './scenes/ArtLoaderScene';
import { CardShowcaseScene } from './scenes/CardShowcaseScene';
import { CollectionScene } from './scenes/CollectionScene';
import { DeckBuilderScene } from './scenes/DeckBuilderScene';
import { DuelScene } from './scenes/DuelScene';
import { GauntletScene } from './scenes/GauntletScene';
import { GlossaryScene } from './scenes/GlossaryScene';
import { LimitedDeckBuilderScene } from './scenes/LimitedDeckBuilderScene';
import { LimitedDraftScene } from './scenes/LimitedDraftScene';
import { LimitedScene } from './scenes/LimitedScene';
import { PackOpeningScene } from './scenes/PackOpeningScene';
import { PlayScene } from './scenes/PlayScene';
import { PracticePickerScene } from './scenes/PracticePickerScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ProfileScene } from './scenes/ProfileScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ShopScene } from './scenes/ShopScene';
import { applySavedAccessibility } from './ui/settingsPresentation';
import { installTextRasterGuards } from './ui/textRaster';

declare global {
  interface Window {
    __game: Phaser.Game;
  }
}

/** Boots the original Phaser application only after the tab session is held. */
export function bootGame(): void {

// Render scale (settings.renderScale): resolved synchronously pre-boot —
// Services is Phaser-free and localStorage-backed, so the save is already
// loaded. The canvas is built at 1280·k × 720·k (Scale.FIT keeps the CSS
// size identical); every scene's create() re-establishes its 1280×720
// logical space via the camera-zoom hook in SceneBackdrop.applySceneSettings.
// Changing the setting persists + reloads (SettingsScene owns that flow).
// RENDER_SCALE_UNLOCKED is the kill-switch that re-clamps k to 1 — live
// (true) since the scene-layout migration; see src/platform/renderScale.ts.
// Dev-only showcase mode (src/dev/showcase.ts) films at a fixed scale,
// `&scale=` 1, 1.5 or 2, default 1.5 (1920x1080), whatever the save says.
const showcaseScale = import.meta.env.DEV && new URLSearchParams(window.location.search).has('showcase')
  ? ([1, 1.5, 2] as const satisfies readonly RenderK[])
    .find((s) => s === Number(new URLSearchParams(window.location.search).get('scale') ?? 1.5)) ?? 1.5
  : null;
// The compact profile (docs/plan-mobile-overhaul.md C1, C2), behind its
// `?layout=compact` switch until the camera fit is proven on a real phone. On
// a touch screen it sizes the canvas to the screen at the device's own pixel
// ratio (capped at 2), and every scene, none of them migrated yet, fits its
// 1280×720 design window inside by camera zoom. The `layout-compact` class
// drops index.html's browser-bar reserve first (the 100dvh page already
// leaves out a visible bar), so the #app box read here is the screen less
// only its safe areas, and the insets read as zero. The profile is worked out
// once per load and never saved.
// Dev only: `&viewport=<fixture>` stands the page in for a fixture screen from
// the support matrix (src/platform/screenFixtures.ts) on any browser, the a11y
// probe's viewport axis: #app is sized to the fixture and its pixel ratio and
// safe areas are the fixture's.
const compact: ScreenMetrics | null = (() => {
  if (showcaseScale !== null || !compactLayoutRequested(window.location.search)) return null;
  const app = document.getElementById('app');
  const fixture = import.meta.env.DEV ? screenFixtureNamed(window.location.search) : null;
  if (fixture) {
    document.documentElement.classList.add('layout-compact');
    if (app) Object.assign(app.style, { inset: 'auto', left: '0', top: '0', width: `${fixture.viewportWidth}px`, height: `${fixture.viewportHeight}px` });
    return resolveScreenMetrics(fixture);
  }
  if (window.matchMedia?.('(pointer: coarse)').matches !== true) return null;
  document.documentElement.classList.add('layout-compact');
  const m = resolveScreenMetrics({
    viewportWidth: app?.clientWidth || window.innerWidth,
    viewportHeight: app?.clientHeight || window.innerHeight,
    coarsePointer: true,
    devicePixelRatio: window.devicePixelRatio,
  });
  if (m.profile === 'compact') return m;
  document.documentElement.classList.remove('layout-compact');
  return null;
})();
const k = compact?.renderK ?? showcaseScale ?? (RENDER_SCALE_UNLOCKED
  ? resolveRenderScale(Services.save.data.settings.renderScale, qualityTier())
  : 1);
setActiveRenderScale(k);
const canvas = compact ? compactCanvasSize(compact) : { width: 1280 * k, height: 720 * k };
const sceneZoom = compact ? designWindowZoom(canvas.width, canvas.height) : k;
setActiveSceneZoom(compact ? sceneZoom : null);
// Text rasterizes at the scene's zoom (canvas px per design px), never below
// 1: on desktop that is k, as before. Under the compact profile a text drawn
// at k and then shrunk by a fractional zoom smeared, measured on the Android
// emulator 2026-10-10; at the zoom it lands on the canvas about 1:1.
const textResolution = Math.max(1, sceneZoom);

// Desktop (Tauri) only: make the chosen resolution the actual OS window size
// (1280·k × 720·k, clamped to the screen). Fire-and-forget and a hard no-op in
// a plain browser — the render factor keeps its supersampling meaning there.
void applyDesktopWindowSize(k);

// Text crispness at k>1: Phaser 3.90 Texts rasterize their canvas at
// `style.resolution`, which defaults to 1 (the "Game Config resolution"
// fallback the docs mention was removed in 3.16 — Text.js forces 0 → 1, and
// core/Config.js has no resolution entry; verified against the pinned
// node_modules). There is no global default, so hook Text creation centrally:
// every Text constructor builds a TextStyle, whose setStyle() runs before the
// first rasterize — bumping an unset resolution there makes every Text render
// its glyphs at k× and stay sharp under the camera's k zoom. Explicit
// per-Text resolutions (none in this repo today) are respected. Object
// width/height stay in logical units (Text.js divides by resolution), so
// layout and inflated hit areas are unaffected.
if (textResolution > 1) {
  type TextStyleLike = { resolution: number };
  type SetStyleFn = (
    this: TextStyleLike,
    style: object | null,
    updateText?: boolean,
    setDefaults?: boolean,
  ) => unknown;
  const proto = Phaser.GameObjects.TextStyle.prototype as unknown as { setStyle: SetStyleFn };
  const origSetStyle = proto.setStyle;
  proto.setStyle = function (style, updateText, setDefaults) {
    const explicit =
      !!style && ((style as { resolution?: number }).resolution ?? 0) > 0;
    const out = origSetStyle.call(this, style, updateText, setDefaults);
    if (!explicit && (!this.resolution || this.resolution <= 1)) this.resolution = textResolution;
    return out;
  };
}

// Descender room for every Text (src/ui/textRaster.ts), before any is built.
installTextRasterGuards();

// Accessibility (settings.textScale, settings.highContrast): the loaded save's
// text size and contrast go in force before the first scene builds, through
// the controls' ship gates (src/ui/settingsPresentation.ts). A reset reloads
// the page, so it comes back through here with the defaults.
applySavedAccessibility(Services.save.data.settings, IS_DEV);

// Do Not Track and Global Privacy Control: a save that has never seen the
// stats notice still holds the fresh default (sharing on), which src/meta
// decides without being able to read the browser. Here, before any scene or
// send, a browser that opts out makes that starting choice Off, so the toggle
// and the notice say what the browser asked for. A choice the player has
// already made is never touched (src/meta/statsNotice.ts).
if (applyBrowserOptOutDefault(Services.save.data.settings, browserOptsOutOfTracking())) Services.save.flush();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: canvas.width,
  height: canvas.height,
  backgroundColor: '#0d0a14',
  // Snap every draw to whole pixels: kills the sub-pixel sampling that softens
  // text glyphs and sprite edges (compounds with the Scale.FIT CSS upscale).
  // Trade-off: tweened motion quantises to integer pixels, so slow drifts can
  // look faintly stepped — acceptable here, and the crispness win is global.
  roundPixels: true,
  // All audio is synthesized through src/audio (raw WebAudio). Disabling
  // Phaser's sound manager stops it creating a second, pre-gesture
  // AudioContext that Chrome flags with an autoplay warning at boot.
  audio: { noAudio: true },
  // DOM support (Feature 8 card search): overlays an HTML container above the
  // canvas so scenes can mount a real <input>. src/ui/SearchInput.ts is the only
  // consumer; nothing else uses this.add.dom.
  dom: { createContainer: true },
  // A per-file request timeout. Phaser's default is none, so one stalled
  // request held every later file in the art queue, and any scene gated on
  // that art, until the page closed. A timed-out file becomes a load error,
  // which the art gate already counts as settled.
  loader: { timeout: 30_000 },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    PreloadScene,
    // Registered, never auto-started (Phaser starts only the first entry):
    // PreloadScene launches it once the menu's own assets are in.
    ArtLoaderScene,
    MainMenuScene,
    PlayScene,
    PracticePickerScene,
    SettingsScene,
    GlossaryScene,
    // Card Showcase (variant QA) registers only on dev/local builds — see
    // src/platform/env.ts. On the public build it is never reachable.
    ...(IS_DEV ? [CardShowcaseScene] : []),
    GauntletScene,
    LimitedScene,
    LimitedDraftScene,
    LimitedDeckBuilderScene,
    ProfileScene,
    AchievementsScene,
    DuelScene,
    ShopScene,
    PackOpeningScene,
    CollectionScene,
    DeckBuilderScene,
  ],
});

// Flush the debounced save the moment the tab is backgrounded: iOS discards
// frozen tabs without firing beforeunload, so a save touched < 250 ms before
// an app switch would otherwise be lost (mobile-lan-plan §1.5). The listener
// lives here in the browser layer — src/meta stays free of browser APIs.
// The same two moments carry the anonymous card batch off the device
// (src/net/signals.ts), at EVERY hide rather than only the first, so play after
// a tab switch is counted too. Each call sends only the cards no earlier batch
// this launch carried. visibilitychange is the reliable one on mobile, where
// a backgrounded tab is often discarded without a pagehide; when both fire,
// the first sends and the second finds nothing new. Both calls are gated,
// silent when the gate is closed, and cannot throw into the handler.
window.addEventListener('pagehide', () => {
  Services.save.flush();
  signals.sessionEnding();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    Services.save.flush();
    signals.sessionEnding();
  }
});

// Anonymous play stats: one heartbeat per launch, if every suppressor in
// src/net/signalsGate.ts lets it through. A save that has not seen the current
// notice sends nothing here and sends on signals.noticeAcknowledged() instead.
// Latch achievements first: a release can add some that a returning save has
// already earned (1.8.1 added 21), and the heartbeat reports the unlocked share,
// so without this the first launch after an update reports less than the player
// sees a moment later. Same recovery sync the main menu runs; no toast here.
if (syncAchievements(Services.save.data, CARD_DB).length > 0) Services.save.flush();
signals.start();

// Dev-tool access (scene jumps, state inspection from the console).
window.__game = game;

// Dev-only: load any local, git-ignored dev modules (src/dev/*.local.ts —
// personal cheats / scratch tools). NON-eager glob on purpose: eager glob
// hoists static imports that bundle regardless of this guard, leaking the
// module into prod. Non-eager yields dynamic-import thunks that live inside
// this `if (import.meta.env.DEV)` branch — false in the Pages build, so the
// whole block (and the thunks) is tree-shaken out even when a *.local.ts
// exists at build time. On a clean checkout the glob matches nothing → no-op.
if (import.meta.env.DEV) {
  for (const loadDevModule of Object.values(import.meta.glob('./dev/*.local.ts'))) {
    void loadDevModule();
  }
  // `?showcase=<name>`: play a recorded showcase duel for trailer footage.
  void import('./dev/showcase').then(({ showcaseParams, startShowcase }) => {
    const params = showcaseParams(window.location.search);
    if (params) void startShowcase(game, params);
  });
}

}
