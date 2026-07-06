import Phaser from 'phaser';
import { Services } from './meta/services';
import { applyDesktopWindowSize } from './platform/desktopWindow';
import { qualityTier } from './platform/quality';
import {
  RENDER_SCALE_UNLOCKED,
  resolveRenderScale,
  setActiveRenderScale,
} from './platform/renderScale';
import { BootScene } from './scenes/BootScene';
import { CardShowcaseScene } from './scenes/CardShowcaseScene';
import { CollectionScene } from './scenes/CollectionScene';
import { DeckBuilderScene } from './scenes/DeckBuilderScene';
import { DuelScene } from './scenes/DuelScene';
import { GauntletScene } from './scenes/GauntletScene';
import { PackOpeningScene } from './scenes/PackOpeningScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ProfileScene } from './scenes/ProfileScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ShopScene } from './scenes/ShopScene';

// Render scale (settings.renderScale): resolved synchronously pre-boot —
// Services is Phaser-free and localStorage-backed, so the save is already
// loaded. The canvas is built at 1280·k × 720·k (Scale.FIT keeps the CSS
// size identical); every scene's create() re-establishes its 1280×720
// logical space via the camera-zoom hook in SceneBackdrop.applySceneSettings.
// Changing the setting persists + reloads (SettingsScene owns that flow).
// RENDER_SCALE_UNLOCKED is the kill-switch that re-clamps k to 1 — live
// (true) since the scene-layout migration; see src/platform/renderScale.ts.
const k = RENDER_SCALE_UNLOCKED
  ? resolveRenderScale(Services.save.data.settings.renderScale, qualityTier())
  : 1;
setActiveRenderScale(k);

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
if (k > 1) {
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
    if (!explicit && (!this.resolution || this.resolution <= 1)) this.resolution = k;
    return out;
  };
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280 * k,
  height: 720 * k,
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
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    SettingsScene,
    CardShowcaseScene,
    GauntletScene,
    ProfileScene,
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
window.addEventListener('pagehide', () => Services.save.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') Services.save.flush();
});

// Dev-tool access (scene jumps, state inspection from the console).
declare global {
  interface Window {
    __game: Phaser.Game;
  }
}
window.__game = game;

// Dev-only: eagerly run any local, git-ignored dev modules
// (src/dev/*.local.ts — personal cheats / scratch tools). No-op when none
// exist. import.meta.env.DEV is false in the production Pages build, so this
// whole block (and the glob) is dead-code-eliminated — nothing local ships.
if (import.meta.env.DEV) {
  import.meta.glob('./dev/*.local.ts', { eager: true });
}
