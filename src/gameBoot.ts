import Phaser from 'phaser';
import { CARD_DB } from './data/catalog';
import { syncAchievements } from './meta/Achievements';
import { Services } from './meta/services';
import { applyBrowserOptOutDefault } from './meta/statsNotice';
import { signals } from './net/signals';
import { browserOptsOutOfTracking } from './net/signalsGate';
import { showBlockingNotice } from './platform/blockingNotice';
import { applyDesktopWindowSize, isTauri } from './platform/desktopWindow';
import { IS_DEV } from './platform/env';
import { requestPersistentStorage } from './platform/persistentStorage';
import { qualityTier } from './platform/quality';
import {
  RENDER_SCALE_UNLOCKED,
  resolveRenderScale,
  type RenderK,
  setActiveRenderScale,
  setActiveSceneZoom,
  textRasterResolution,
} from './platform/renderScale';
import { designOutgrown, enableDevCompactScene, disableDesktopCompactScenes, RELAYOUT_SCENES, setActiveCompactMetrics } from './platform/compactScenes';
import { onFullScreenChange } from './platform/fullscreen';
import {
  compactFit,
  compactLayoutAllowed,
  compactLayoutRequested,
  resolveScreenMetrics,
  type ScreenMetrics,
} from './platform/screenMetrics';
import { screenFixtureNamed } from './platform/screenFixtures';
import { applySceneSettings, CANVAS_CLEAR, sceneStage } from './ui/SceneBackdrop';
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
import { DeckCodeScene } from './scenes/DeckCodeScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ProfileScene } from './scenes/ProfileScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ShopScene } from './scenes/ShopScene';
import { StoryScene } from './scenes/StoryScene';
import { newerSaveCopy, saveWriteFailedNotice } from './ui/saveNoticeCopy';
import { applySavedAccessibility } from './ui/settingsPresentation';
import { installTextRasterGuards } from './ui/textRaster';
import { queueToast } from './ui/Toast';

declare global {
  interface Window {
    __game: Phaser.Game;
  }
}

/** Boots the original Phaser application only after the tab session is held. */
export function bootGame(): void {

// A save written by a newer build than this one: this build would replace it
// with a fresh save, so the manager refuses every write and the game does not
// start (src/meta/SaveManager.ts `SaveLoadStatus`).
if (Services.save.readOnly) {
  const copy = newerSaveCopy(isTauri());
  showBlockingNotice({
    id: 'darlingblades-newer-save',
    ...copy,
    onAction: () => window.location.reload(),
  });
  return;
}
// An unreadable save (loadStatus 'recovered') is reported by the main menu's
// arrival chain, ahead of the first-run dialogs.
Services.save.onWriteFailure = () => queueToast(saveWriteFailedNotice());
requestPersistentStorage({ desktop: isTauri() });

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
// The compact profile (docs/plan-mobile-overhaul.md C1, C2), on for every
// phone and tablet; `?layout=desktop` keeps the desktop profile for a load. On
// a touch screen it sizes the canvas to the screen at the device's own pixel
// ratio (capped at 2); a scene with a compact composition draws in the
// content box, and any other fits its 1280×720 design window by camera zoom. The `layout-compact` class
// drops index.html's browser-bar reserve first (the 100dvh page already
// leaves out a visible bar), so the #app box read here is the screen less
// only its safe areas, and the insets read as zero. The profile is worked out
// once per load and never saved.
// Dev only: `&viewport=<fixture>` stands the page in for a fixture screen from
// the support matrix (src/platform/screenFixtures.ts) on any browser, the a11y
// probe's viewport axis: #app is sized to the fixture and its pixel ratio and
// safe areas are the fixture's.
// Read the real screen (not a fixture) as compact metrics, or null when it is
// not a compact screen.
function readCompactScreen(): ScreenMetrics | null {
  const app = document.getElementById('app');
  const m = resolveScreenMetrics({
    viewportWidth: app?.clientWidth || window.innerWidth,
    viewportHeight: app?.clientHeight || window.innerHeight,
    coarsePointer: true,
    devicePixelRatio: window.devicePixelRatio,
  });
  return m.profile === 'compact' ? m : null;
}
// Dev only: `?phone=Draft,Story` lays scenes out in the compact space while
// their phone layouts are still being built (docs/plan-mobile-overhaul.md C4).
if (import.meta.env.DEV) for (const key of (new URLSearchParams(window.location.search).get('phone') ?? '').split(',')) if (key) enableDevCompactScene(key);
// Dev only: `?desktop=classic` keeps the old desktop menu layouts, for before shots.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('desktop') === 'classic') disableDesktopCompactScenes();
const compactFixture = import.meta.env.DEV && compactLayoutRequested(window.location.search)
  ? screenFixtureNamed(window.location.search) : null;
const compact: ScreenMetrics | null = (() => {
  if (showcaseScale !== null || !compactLayoutAllowed(window.location.search)) return null;
  const app = document.getElementById('app');
  const fixture = compactFixture;
  if (fixture) {
    document.documentElement.classList.add('layout-compact');
    if (app) Object.assign(app.style, { inset: 'auto', left: '0', top: '0', width: `${fixture.viewportWidth}px`, height: `${fixture.viewportHeight}px` });
    return resolveScreenMetrics(fixture);
  }
  if (window.matchMedia?.('(pointer: coarse)').matches !== true) return null;
  document.documentElement.classList.add('layout-compact');
  const m = readCompactScreen();
  if (!m) document.documentElement.classList.remove('layout-compact');
  return m;
})();
const k = compact?.renderK ?? showcaseScale ?? (RENDER_SCALE_UNLOCKED
  ? resolveRenderScale(Services.save.data.settings.renderScale, qualityTier())
  : 1);
setActiveRenderScale(k);
// An upright tablet letterboxes the window at 96% of its width (M11), with
// the page's scene image in the bands: the game clears to transparent there.
const fit = compact ? compactFit(compact) : null;
const canvas = fit?.canvas ?? { width: 1280 * k, height: 720 * k };
const letterbox = fit?.letterbox ?? false;
document.documentElement.classList.toggle('layout-letterbox', letterbox);
const sceneZoom = fit?.zoom ?? k;
setActiveSceneZoom(fit ? sceneZoom : null, fit?.widthShare ?? 1);
// Text rasterizes at the scene's zoom (canvas px per design px), never below
// 1: on desktop that is k, as before. Under the compact profile a text drawn
// at k and then shrunk by a fractional zoom smeared, measured on the Android
// emulator 2026-10-10; at the zoom it lands on the canvas about 1:1. A scene
// with its own compact composition has its own zoom (src/platform/
// compactScenes.ts), which SceneBackdrop records as the scene starts, so
// `textRasterResolution` follows whichever scene is building its Texts.
setActiveCompactMetrics(compact);

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
if (textRasterResolution() > 1 || compact) {
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
    if (!explicit && (!this.resolution || this.resolution <= 1)) this.resolution = textRasterResolution();
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
  backgroundColor: CANVAS_CLEAR,
  transparent: letterbox,
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
    DeckCodeScene,
    SettingsScene,
    GlossaryScene,
    // Card Showcase (variant QA) registers only on dev/local builds — see
    // src/platform/env.ts. On the public build it is never reachable.
    ...(IS_DEV ? [CardShowcaseScene] : []),
    GauntletScene,
    LimitedScene,
    LimitedDraftScene,
    LimitedDeckBuilderScene,
    // Story Mode (2.0): reached only from Play's Story row, behind FEATURES.storyLive.
    StoryScene,
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

// The compact canvas follows the screen when it changes size after load:
// entering or leaving full screen (M8; the 2026-10-12 emulator recheck found
// the canvas stayed at its load size), turning the device, or a browser bar
// coming or going. Each running scene re-fits its camera to the new window;
// texts drawn from then on rasterize at the new zoom.
// A phone held upright shows the rotate screen over the game, so a refit to an
// upright screen is skipped: the scenes keep the landscape layout they will be
// seen in. A compact scene lays itself out once, in the content box it was
// built for, so a scene built for a different screen is restarted: every
// compact scene after a page loaded upright, and a menu scene whose design
// space changed by more than a few percent (the owner's iPhone, 2026-10-14,
// kept a narrow main menu after turning, and again after a landscape refresh,
// where Safari can report the old size while the page loads). Scenes holding
// a game in progress keep their layout and only re-fit the camera.
if (compact && !compactFixture) {
  let pending: number | undefined;
  let builtUpright = compact.presentation === 'rotate';
  const refit = (): void => {
    pending = undefined;
    const m = readCompactScreen();
    if (!m || m.presentation === 'rotate') return;
    const next = compactFit(m);
    const restartAll = builtUpright;
    const outgrown = game.scene.getScenes(true).filter((scene) => {
      const stage = sceneStage(scene);
      return stage.compact && (restartAll || (RELAYOUT_SCENES.has(scene.sys.settings.key) && designOutgrown(stage, m)));
    });
    if (outgrown.length === 0 && next.canvas.width === game.scale.width && next.canvas.height === game.scale.height
      && next.letterbox === document.documentElement.classList.contains('layout-letterbox')) return;
    document.documentElement.classList.toggle('layout-letterbox', next.letterbox);
    setActiveSceneZoom(next.zoom, next.widthShare);
    setActiveCompactMetrics(m);
    // setGameSize, not resize: under FIT, resize keeps the load's aspect ratio, so
    // a turn from upright drew the canvas at portrait width in a landscape window.
    game.scale.setGameSize(next.canvas.width, next.canvas.height);
    builtUpright = false;
    for (const scene of game.scene.getScenes(true)) {
      if (outgrown.includes(scene)) scene.scene.restart();
      else applySceneSettings(scene, { refit: true });
    }
  };
  const schedule = (): void => {
    if (pending !== undefined) window.clearTimeout(pending);
    pending = window.setTimeout(refit, 150);
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  onFullScreenChange(schedule);
  // Safari can settle the window's size after load without a resize event.
  for (const ms of [500, 1500]) window.setTimeout(schedule, ms);
}

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
