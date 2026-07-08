import Phaser from 'phaser';

/**
 * The tutorial's coach-mark layer (see docs/plan-road-to-1.0.md Feature 1).
 * Two surfaces, both at design-space coords (1280×720; never read scale.*):
 *
 *  - `showCue(target, text)` — an advisory pulsing highlight ring around a live
 *    UI object plus a short speech bubble. Non-interactive by design: the player
 *    still taps the real control underneath (learning-by-doing), so there is no
 *    scaled-container hit area to trip the playbook §11 trap and no ModalGuard.
 *  - `showInfoCard(text, onDismiss)` — a centered tap-to-continue card over a
 *    dimmer, for the two pure-info beats (goal, summoning sickness).
 *
 * Every tween callback checks `.active` (objects can be torn down by a duel
 * re-render mid-tween), and the whole thing self-destroys on scene SHUTDOWN so
 * a restart can never stack it.
 */
const DEPTH = 95;
const RING_COLOR = 0xffd166;
const BUBBLE_BG = 0x1c1730;
const BUBBLE_STROKE = 0xffd88a;

export class CoachMark {
  private ring: Phaser.GameObjects.Graphics | null = null;
  private bubble: Phaser.GameObjects.Container | null = null;
  private info: Phaser.GameObjects.Container | null = null;
  /** Skip a rebuild when the same (target, text) is requested again — no flicker. */
  private cueKey = '';

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Advisory ring + bubble pointing at a live control. Idempotent per (target,text). */
  showCue(target: Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle }, text: string): void {
    const b = target.getBounds();
    const key = `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}|${text}`;
    if (key === this.cueKey && this.ring?.active && this.bubble?.active) return;
    this.cueKey = key;
    this.clearCue();

    const pad = 8;
    const rx = b.x - pad;
    const ry = b.y - pad;
    const rw = b.width + pad * 2;
    const rh = b.height + pad * 2;

    const ring = this.scene.add.graphics().setDepth(DEPTH);
    ring.lineStyle(3, RING_COLOR, 0.95);
    ring.strokeRoundedRect(rx, ry, rw, rh, 10);
    this.ring = ring;
    this.scene.tweens.add({
      targets: ring,
      alpha: { from: 1, to: 0.35 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Bubble above the target when it sits low on screen, else below it.
    const cx = Phaser.Math.Clamp(b.centerX, 150, 1130);
    const above = b.centerY > 360;
    const by = above ? ry - 34 : ry + rh + 34;
    this.bubble = this.buildBubble(cx, Phaser.Math.Clamp(by, 40, 680), text, 280);
  }

  /** Full-screen tap-to-continue info card for a pure-info beat. */
  showInfoCard(text: string, onDismiss: () => void): void {
    this.clearInfo();
    const c = this.scene.add.container(0, 0).setDepth(DEPTH + 1);
    const dim = this.scene.add
      .rectangle(640, 360, 1280, 720, 0x0a0812, 0.66)
      .setInteractive({ useHandCursor: true });
    const panel = this.scene.add.graphics();
    panel.fillStyle(BUBBLE_BG, 0.98);
    panel.lineStyle(2, BUBBLE_STROKE, 0.9);
    panel.fillRoundedRect(430, 300, 420, 130, 14);
    panel.strokeRoundedRect(430, 300, 420, 130, 14);
    const body = this.scene.add
      .text(640, 348, text, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f0e6ff',
        align: 'center',
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5);
    const hint = this.scene.add
      .text(640, 402, 'tap to continue ▸', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#a89cc6',
      })
      .setOrigin(0.5);
    c.add([dim, panel, body, hint]);
    this.info = c;
    dim.on('pointerup', () => {
      this.clearInfo();
      onDismiss();
    });
  }

  /** Clear the advisory ring + bubble (leaves any info card up). */
  hide(): void {
    this.cueKey = '';
    this.clearCue();
  }

  destroy(): void {
    this.clearCue();
    this.clearInfo();
  }

  private buildBubble(cx: number, cy: number, text: string, width: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(cx, cy).setDepth(DEPTH);
    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        fontStyle: '600',
        color: '#ffe9b8',
        align: 'center',
        wordWrap: { width: width - 28 },
      })
      .setOrigin(0.5);
    const h = Math.max(44, label.height + 22);
    const bg = this.scene.add.graphics();
    bg.fillStyle(BUBBLE_BG, 0.96);
    bg.lineStyle(2, BUBBLE_STROKE, 0.85);
    bg.fillRoundedRect(-width / 2, -h / 2, width, h, 10);
    bg.strokeRoundedRect(-width / 2, -h / 2, width, h, 10);
    c.add([bg, label]);
    c.setAlpha(0);
    this.scene.tweens.add({ targets: c, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
    return c;
  }

  private clearCue(): void {
    if (this.ring) {
      this.scene.tweens.killTweensOf(this.ring);
      this.ring.destroy();
      this.ring = null;
    }
    if (this.bubble) {
      this.scene.tweens.killTweensOf(this.bubble);
      this.bubble.destroy();
      this.bubble = null;
    }
  }

  private clearInfo(): void {
    if (this.info) {
      this.info.destroy();
      this.info = null;
    }
  }
}
