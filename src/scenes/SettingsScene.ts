import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { qualityTier } from '../platform/quality';
import { applyBackdrop } from '../ui/SceneBackdrop';
import type { RenderScaleSetting } from '../platform/renderScale';
import type { AnimationLevel } from '../platform/animPolicy';
import { VERSION_LABEL, checkForUpdate } from '../version';

const SEGMENTS = 10;
const STEP = 0.1;
/** Minimum hit-box side / control pitch (mobile audit: ≥90 design px). */
const HIT_MIN = 90;

/** Column geometry on the 1280×720 design canvas. */
const LABEL_X = 220;
const CONTROL_X = 520;
/** Row pitch — 90 px so inflated 90-px hit rects on adjacent rows never overlap. */
const ROW0_Y = 170;
const ROW_PITCH = 90;

const ANIM_CHIPS: { value: AnimationLevel; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'off', label: 'Off' },
];

/** Hard-coded 16:9 resolutions in ascending cost (no "Automatic" — v5). */
const RENDER_CHIPS: { value: RenderScaleSetting; label: string; heavy: boolean }[] = [
  { value: 1, label: '1280×720', heavy: false },
  { value: 1.5, label: '1920×1080', heavy: true },
  { value: 2, label: '2560×1440', heavy: true },
];

/**
 * Full settings menu (gear button on MainMenu). Every control writes through
 * the SaveManager and drives a real consumer:
 *
 * - SFX on/off      → settings.sfxOn, gates AudioManager.play().
 * - Volume −/+ bar  → Sfx.setVolume (master gain: SFX and music).
 * - Music on/off    → Music.setEnabled (persists settings.musicOn).
 * - Animations      → settings.animations; FXSupport.fxPolicy intersects it
 *                     and SceneBackdrop.applySceneSettings sets the tween
 *                     time-scale — both read at scene create(), hence the
 *                     visible "applies on scene change" note.
 * - Render size     → settings.renderScale; the canvas is sized at boot and,
 *                     in the desktop app, the OS window is resized to the
 *                     chosen 16:9 resolution — so picking a chip persists,
 *                     flushes, and reloads the page.
 * - Auto-skip       → settings.autoSkip, gates DuelScene.maybeAutoSkip.
 *
 * Mobile-audit rules: every control is bindTapButton'd, hit boxes inflated to
 * ≥90 design px, re-inflated after any setText, control pitch ≥90 px.
 */
export class SettingsScene extends Phaser.Scene {
  private sfxChip!: Phaser.GameObjects.Text;
  private musicChip!: Phaser.GameObjects.Text;
  private skipChip!: Phaser.GameObjects.Text;
  private volumeBar!: Phaser.GameObjects.Text;
  private animChips = new Map<AnimationLevel, Phaser.GameObjects.Text>();
  private renderChips = new Map<RenderScaleSetting, Phaser.GameObjects.Text>();

  constructor() {
    super('Settings');
  }

  create(): void {
    this.animChips.clear();
    this.renderChips.clear();

    // Backdrop first (display-list order keeps it under everything). Reuses
    // the main-menu vista with a slightly heavier dim than MainMenu's 0.50 —
    // this screen is denser text, so readability wins over the art.
    applyBackdrop(this, 'mainmenu', {
      dim: 0x0d0a14,
      dimAlpha: 0.62,
      fallback: () => {
        /* no art on disk — the #0d0a14 canvas clear colour shows */
      },
    });

    // Same audio conventions as MainMenu: hover is mouse-only, one click per
    // activation (Sfx dedupes rapid duplicates; play() gates on sfxOn).
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    this.add
      .text(640, 84, 'Settings', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '44px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);

    // Gold badge (top-right) — keep the balance visible across meta screens.
    // Static here: nothing on this screen spends or earns gold.
    this.add
      .text(1250, 30, `🪙 ${Services.save.data.gold}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '18px',
        fontStyle: '600',
        color: '#ffd88a',
      })
      .setOrigin(1, 0.5);

    const rowY = (i: number): number => ROW0_Y + i * ROW_PITCH;

    // -- Row 0: SFX toggle + master volume ---------------------------------
    this.rowLabel(rowY(0), 'Sound effects');
    this.sfxChip = this.chip(CONTROL_X, rowY(0), 'Off');
    bindTapButton(this, this.sfxChip, () => {
      const s = Services.save.data.settings;
      s.sfxOn = !s.sfxOn;
      Services.save.touch();
      this.refreshToggles();
      if (s.sfxOn) Sfx.play('click'); // audible confirmation the gate opened
    });

    const minus = this.chip(660, rowY(0), '−');
    // ▰/▱ render via OS font fallback with unpredictable advance widths —
    // measure the full bar before placing the + button (playbook §11: glyph
    // advance widths are font-fallback-dependent on Windows — never hardcode).
    this.volumeBar = this.add
      .text(minus.x + minus.width + 24, rowY(0), '▰'.repeat(SEGMENTS), {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        color: '#c9bde0',
      })
      .setOrigin(0, 0.5);
    const plus = this.chip(this.volumeBar.x + this.volumeBar.width + 24, rowY(0), '+');
    bindTapButton(this, minus, () => this.stepVolume(-STEP));
    bindTapButton(this, plus, () => this.stepVolume(+STEP));
    inflateHitArea(minus, HIT_MIN, HIT_MIN);
    inflateHitArea(plus, HIT_MIN, HIT_MIN);
    this.note(rowY(0) + 34, 'Volume is the master level — music follows it too.');

    // -- Row 1: music toggle ------------------------------------------------
    this.rowLabel(rowY(1), 'Music');
    this.musicChip = this.chip(CONTROL_X, rowY(1), 'Off');
    bindTapButton(this, this.musicChip, () => {
      Music.setEnabled(!Music.enabled);
      this.refreshToggles();
    });

    // -- Row 2: animation level --------------------------------------------
    this.rowLabel(rowY(2), 'Animations');
    let ax = CONTROL_X;
    for (const { value, label } of ANIM_CHIPS) {
      const c = this.chip(ax, rowY(2), label);
      this.animChips.set(value, c);
      bindTapButton(this, c, () => {
        Services.save.data.settings.animations = value;
        Services.save.touch();
        this.refreshChipGroups();
      });
      ax += Math.max(HIT_MIN, c.width + 18); // ≥90 px control pitch
    }
    this.note(rowY(2) + 34, 'Effect changes apply when you next change screens.');

    // -- Row 3: render size --------------------------------------------------
    // Live: persist → flush → reload; main.ts resolves the factor pre-boot and
    // (in the desktop app) resizes the OS window to match (see
    // src/platform/renderScale.ts + desktopWindow.ts). On lite tier the
    // high-res chips stay disabled — resolveRenderScale caps k at 1 there
    // (VRAM/fill-rate budget), so an enabled chip would be a lie.
    const lite = qualityTier() === 'lite';
    this.rowLabel(rowY(3), 'Render size');
    let rx = CONTROL_X;
    for (const { value, label, heavy } of RENDER_CHIPS) {
      const c = this.chip(rx, rowY(3), label);
      this.renderChips.set(value, c);
      if (lite && heavy) {
        c.disableInteractive();
        c.setStyle({ color: '#57506b', backgroundColor: '#1a1426' });
      } else {
        bindTapButton(this, c, () => this.pickRenderScale(value));
      }
      rx += Math.max(HIT_MIN, c.width + 18);
    }
    this.note(
      rowY(3) + 34,
      lite
        ? 'Resizes the window (desktop) and reloads. High resolutions are disabled on this device.'
        : 'Resizes the desktop window and reloads to apply.',
    );

    // -- Row 4: auto-skip ----------------------------------------------------
    this.rowLabel(rowY(4), 'Auto-skip forced turns');
    this.skipChip = this.chip(CONTROL_X, rowY(4), 'Off');
    bindTapButton(this, this.skipChip, () => {
      const s = Services.save.data.settings;
      s.autoSkip = !s.autoSkip;
      Services.save.touch();
      this.refreshToggles();
    });
    this.note(rowY(4) + 34, 'Skips duel phases where you have no possible action.');

    // -- Back ----------------------------------------------------------------
    const back = this.add
      .text(640, 648, '← Back', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '28px',
        color: '#c9bde0',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) back.setColor('#ffd700');
    });
    back.on('pointerout', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) back.setColor('#c9bde0');
    });
    bindTapButton(this, back, () => this.scene.start('MainMenu'));
    inflateHitArea(back, HIT_MIN, HIT_MIN);

    this.buildVersionFooter();

    this.refreshToggles();
    this.refreshChipGroups();
    this.refreshVolume();
  }

  /**
   * Bottom-of-screen build identity + an on-demand update check. The check only
   * fires on tap (no boot-time network) and degrades gracefully offline; the
   * status text guards against an in-flight resolve after the scene is gone.
   */
  private buildVersionFooter(): void {
    this.add
      .text(14, 702, VERSION_LABEL, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#6a6482',
      })
      .setOrigin(0, 0.5);

    const status = this.add
      .text(640, 702, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#8f83a8',
      })
      .setOrigin(0.5);

    const btn = this.add
      .text(1266, 702, 'Check for updates', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        color: '#c9bde0',
        backgroundColor: '#241d3a',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, btn, () => {
      status.setText('Checking…').setColor('#8f83a8');
      void checkForUpdate().then((r) => {
        if (!status.active) return; // scene left mid-fetch
        const color =
          r.state === 'available' ? '#ffd88a' : r.state === 'error' ? '#e0a0a0' : '#8ad0a0';
        status.setText(r.message).setColor(color);
      });
    });
    inflateHitArea(btn, HIT_MIN, HIT_MIN);
  }

  // -------------------------------------------------------------------------

  private rowLabel(y: number, text: string): Phaser.GameObjects.Text {
    return this.add
      .text(LABEL_X, y, text, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        color: '#c9bde0',
      })
      .setOrigin(0, 0.5);
  }

  private note(y: number, text: string): Phaser.GameObjects.Text {
    return this.add
      .text(CONTROL_X, y, text, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#8f83a8',
      })
      .setOrigin(0, 0.5);
  }

  private chip(x: number, y: number, label: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, label, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '18px',
        color: '#c9bde0',
        backgroundColor: '#241d3a',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
  }

  private stepVolume(delta: number): void {
    Sfx.setVolume(Sfx.volume + delta);
    this.refreshVolume();
    Sfx.play('click'); // the tick sounds at the freshly applied level
  }

  private refreshVolume(): void {
    const filled = Math.round(Sfx.volume * SEGMENTS);
    this.volumeBar
      .setText('▰'.repeat(filled) + '▱'.repeat(SEGMENTS - filled))
      .setColor(filled <= 0 ? '#57506b' : '#c9bde0');
  }

  /** On/Off single chips. Re-inflates after setText (mobile-audit rule). */
  private refreshToggles(): void {
    const s = Services.save.data.settings;
    this.setToggle(this.sfxChip, s.sfxOn);
    this.setToggle(this.musicChip, s.musicOn);
    this.setToggle(this.skipChip, s.autoSkip);
  }

  private setToggle(chipObj: Phaser.GameObjects.Text, on: boolean): void {
    chipObj.setText(on ? 'On' : 'Off');
    chipObj.setStyle(
      on
        ? { color: '#1a1426', backgroundColor: '#ffd88a' }
        : { color: '#c9bde0', backgroundColor: '#241d3a' },
    );
    inflateHitArea(chipObj, HIT_MIN, HIT_MIN); // text changed — re-inflate
  }

  /** Exclusive chip groups (animations, render size) highlight the selection. */
  private refreshChipGroups(): void {
    const s = Services.save.data.settings;
    const lite = qualityTier() === 'lite';
    for (const [value, c] of this.animChips) {
      c.setStyle(
        value === s.animations
          ? { color: '#1a1426', backgroundColor: '#ffd88a' }
          : { color: '#c9bde0', backgroundColor: '#241d3a' },
      );
      inflateHitArea(c, HIT_MIN, HIT_MIN);
    }
    // On lite the applied factor is always 1 (resolveRenderScale caps it), so
    // highlight 720p as the effective selection even if the save holds a
    // higher value — otherwise the disabled 1080p/1440p chips would leave the
    // row with nothing highlighted.
    const effectiveRender = lite ? 1 : s.renderScale;
    for (const [value, c] of this.renderChips) {
      const disabled = lite && (value === 1.5 || value === 2);
      c.setStyle(
        disabled
          ? { color: '#57506b', backgroundColor: '#1a1426' }
          : value === effectiveRender
            ? { color: '#1a1426', backgroundColor: '#ffd88a' }
            : { color: '#c9bde0', backgroundColor: '#241d3a' },
      );
      if (!disabled) inflateHitArea(c, HIT_MIN, HIT_MIN);
    }
  }

  /** Persist → flush → reload: the canvas is sized at boot, so a reload applies it. */
  private pickRenderScale(value: RenderScaleSetting): void {
    const s = Services.save.data.settings;
    if (s.renderScale === value) return;
    s.renderScale = value;
    Services.save.flush();
    window.location.reload();
  }
}
