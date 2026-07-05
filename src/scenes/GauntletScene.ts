import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { avatarForRung, type Avatar } from '../data/opponents';
import { clampSeed } from '../meta/gauntletSeed';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { applyBackdrop } from '../ui/SceneBackdrop';

/**
 * The Avatar Gauntlet tower. A right-rail ladder of ten rungs (cleared ✓ /
 * current highlighted / future dimmed) and a left panel showing the selected
 * avatar — portrait, name/title/blurb, theme chip, difficulty pips, and the
 * rung's reward. Fight launches the duel; a loss resets the run, a full clear
 * pays the completion bonus.
 *
 * The "current" rung is the in-progress run's rung, or rung 1 for a fresh run.
 * Only the current rung is fightable — you climb one rung at a time.
 */
export class GauntletScene extends Phaser.Scene {
  private selectedRung = 1;
  private currentRung = 1; // the rung you may actually fight
  private panel: Phaser.GameObjects.Container | null = null;
  private rowNodes: { rung: number; box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private abandonArmed = false;
  private abandonBtn: Phaser.GameObjects.Text | null = null;
  /** Seed the NEXT run will use (rerollable / player-settable until it begins). */
  private pendingSeed = 1;
  private seedBar: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Gauntlet');
  }

  create(): void {
    this.rowNodes = [];
    this.panel = null;
    this.abandonArmed = false;
    this.abandonBtn = null;
    this.seedBar = null;

    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;
    const height = 720;
    // Backdrop first (docs/scene-art.md §3); the gradient is the fallback.
    applyBackdrop(this, 'gauntlet', {
      dim: 0x0b0812,
      dimAlpha: 0.5,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x171222, 0x171222, 0x0b0812, 0x0b0812, 1);
        bg.fillRect(0, 0, width, height);
      },
    });

    const g = Services.save.data.gauntlet;
    this.currentRung = g.run?.rung ?? 1;
    this.selectedRung = this.currentRung;
    // A run in progress keeps its locked seed; otherwise pick a fresh one the
    // player may reroll or set before beginning (src/meta/gauntletSeed.ts).
    this.pendingSeed = g.run?.seed ?? clampSeed(Math.floor(Math.random() * 2 ** 31));

    // Hover SFX is mouse-only — touch fires pointerover on finger-down and
    // must stay silent (mobile-lan-plan §1.3).
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('gauntlet');

    this.add
      .text(width / 2, 46, 'Avatar Gauntlet', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '44px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 84, 'Climb ten rungs. A loss ends the run — the tower resets, your collection does not.', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        color: '#8f83a8',
      })
      .setOrigin(0.5);

    this.add
      .text(width - 30, 30, `🪙 ${Services.save.data.gold}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        fontStyle: '600',
        color: '#ffd88a',
      })
      .setOrigin(1, 0.5);

    this.buildTower();
    this.buildPanel();
    this.buildSeedBar();

    const back = this.add
      .text(28, 28, '← Menu', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '18px', color: '#c9bde0' })
      .setInteractive({ useHandCursor: true });
    back.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) back.setColor('#ffd700');
    });
    back.on('pointerout', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) back.setColor('#c9bde0');
    });
    bindTapButton(this, back, () => this.scene.start('MainMenu'));
    inflateHitArea(back, 90, 90);
  }

  // ---------------------------------------------------------------------
  private buildTower(): void {
    const width = 1280; // design-space width (see create())
    const g = Services.save.data.gauntlet;
    const railX = width - 250;
    const topY = 150;
    const rungs = ECONOMY.gauntletRungGold.length; // ladder length (10 with the Ragnarök bosses)
    const rowH = 52; // tightened from 62 so all 10 rows fit the 720px design height

    this.add
      .text(railX, topY - 34, `Best: ${g.bestRung > 0 ? `Rung ${g.bestRung}` : '—'}   ·   Clears: ${g.completions}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#8f83a8',
      })
      .setOrigin(0.5);

    // Rungs render bottom-up: rung 1 at the bottom, the top rung at the top.
    for (let rung = rungs; rung >= 1; rung--) {
      const rowIndex = rungs - rung; // 0 at top
      const y = topY + rowIndex * rowH;
      const av = avatarForRung(rung);
      const cleared = rung < this.currentRung; // rungs below the current one are done this run
      const isCurrent = rung === this.currentRung;

      const box = this.add
        .rectangle(railX, y, 420, rowH - 12, this.rowColor(rung), 1)
        .setStrokeStyle(2, isCurrent ? 0xffd700 : 0x3a3355)
        .setInteractive({ useHandCursor: true });
      const status = cleared ? '✓' : isCurrent ? '▶' : '·';
      const label = this.add
        .text(railX - 195, y, `${status}  Rung ${rung} — ${av.name}`, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '17px',
          color: this.rowTextColor(rung),
        })
        .setOrigin(0, 0.5);
      const stars = this.add
        .text(railX + 195, y, '★'.repeat(this.difficultyPips(av)), {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '14px',
          color: '#c7a8f0',
        })
        .setOrigin(1, 0.5);

      bindTapButton(this, box, () => {
        this.selectedRung = rung;
        this.refreshTower();
        this.buildPanel();
      });
      // Rung rows are 420px wide; hit height fills the row pitch (rowH).
      inflateHitArea(box, 90, rowH);
      box.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch && rung !== this.selectedRung) box.setStrokeStyle(2, 0x7a6da8);
      });
      box.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) this.refreshTower();
      });
      void stars;
      this.rowNodes.push({ rung, box, label });
    }
    this.refreshTower();
  }

  private refreshTower(): void {
    for (const node of this.rowNodes) {
      const isSelected = node.rung === this.selectedRung;
      const isCurrent = node.rung === this.currentRung;
      node.box.setFillStyle(this.rowColor(node.rung), 1);
      node.box.setStrokeStyle(
        isSelected ? 3 : 2,
        isSelected ? 0xffd700 : isCurrent ? 0xc9a84c : 0x3a3355,
      );
    }
  }

  private rowColor(rung: number): number {
    if (rung < this.currentRung) return 0x223322; // cleared
    if (rung === this.currentRung) return 0x2c2344; // current
    return 0x18142a; // future
  }

  private rowTextColor(rung: number): string {
    if (rung < this.currentRung) return '#8ad0a0';
    if (rung === this.currentRung) return '#ffd88a';
    return '#6d6288';
  }

  private difficultyPips(av: Avatar): number {
    // 1..3 pips scaling with tier: easy 1, medium 2, hard 3.
    return av.difficulty === 'easy' ? 1 : av.difficulty === 'medium' ? 2 : 3;
  }

  // ---------------------------------------------------------------------
  private buildPanel(): void {
    this.panel?.destroy();
    this.abandonArmed = false;
    const av = avatarForRung(this.selectedRung);
    const c = this.add.container(0, 0);

    const px = 300; // panel center x
    const portraitY = 300;

    // portrait bust (framed)
    const frame = this.add
      .rectangle(px, portraitY, 268, 336, 0x241d3a, 1)
      .setStrokeStyle(3, 0x8a6d1f);
    c.add(frame);
    this.addPortrait(c, av.portraitCardId, px, portraitY);

    // theme chip
    const chip = this.add
      .text(px, portraitY + 190, av.theme, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        fontStyle: '600',
        color: '#e8def7',
        backgroundColor: '#3a2f5a',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5);
    c.add(chip);

    // name + title. The text column must end before the tower rail's left edge
    // (rail rows are 420px wide centred at railX = width−250 = 1030 → left edge
    // ≈ 820), so everything here is capped to COL_W and wraps/scales rather than
    // bleeding over a rung label.
    const textX = px + 200;
    const COL_W = 300;
    const nameText = this.add
      .text(textX, 150, av.name, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '30px',
        color: '#f0e6ff',
      })
      .setOrigin(0, 0);
    // A long name (e.g. "Yohime, Kitsune Matriarch") shrinks to fit one line
    // instead of wrapping down into the title.
    nameText.setScale(Math.min(1, COL_W / Math.max(1, nameText.width)));
    c.add(nameText);
    c.add(
      this.add
        .text(textX, 196, av.title, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '17px',
          fontStyle: 'italic',
          color: '#c7a8f0',
          wordWrap: { width: COL_W },
        })
        .setOrigin(0, 0),
    );

    // difficulty pips + rung
    c.add(
      this.add
        .text(textX, 232, `Rung ${av.tier}   ${'★'.repeat(this.difficultyPips(av))}   (${av.difficulty})`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '15px',
          color: '#ffd88a',
        })
        .setOrigin(0, 0),
    );

    // blurb
    c.add(
      this.add
        .text(textX, 274, av.blurb, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '15px',
          color: '#c9bde0',
          lineSpacing: 4,
          wordWrap: { width: COL_W },
        })
        .setOrigin(0, 0),
    );

    // reward line
    const reward = ECONOMY.gauntletRungGold[av.tier - 1];
    const rewardLine =
      av.tier === ECONOMY.gauntletRungGold.length
        ? `Reward: 🪙 ${reward}  +  🪙 ${ECONOMY.gauntletCompletionBonus} completion bonus`
        : `Reward: 🪙 ${reward}`;
    c.add(
      this.add
        .text(textX, 400, rewardLine, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '16px',
          fontStyle: '600',
          color: '#ffd88a',
          // The final rung's line carries the completion bonus and is long — wrap
          // it in the column rather than letting it run under the rung rail.
          wordWrap: { width: COL_W },
        })
        .setOrigin(0, 0),
    );

    // Fight / locked
    const fightable = av.tier === this.currentRung;
    if (fightable) {
      const fight = this.add
        .text(textX, 456, Services.save.data.gauntlet.run ? 'Fight' : 'Begin Run', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '26px',
          color: '#ffd88a',
          backgroundColor: '#2c2344',
          padding: { x: 22, y: 11 },
        })
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      fight.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) fight.setColor('#ffffff');
      });
      fight.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) fight.setColor('#ffd88a');
      });
      bindTapButton(this, fight, () => this.startFight(av));
      inflateHitArea(fight, 90, 90);
      c.add(fight);
    } else {
      const locked =
        av.tier < this.currentRung ? 'Already cleared this run' : 'Clear the rungs below first';
      c.add(
        this.add
          .text(textX, 462, `🔒 ${locked}`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '15px',
            color: '#6d6288',
          })
          .setOrigin(0, 0),
      );
    }

    // Abandon Run (two-click confirm) — only while a run is in progress. On its
    // own line below the fight/locked line (not to the right of it): the armed
    // "Click again to confirm" label is wide and, placed rightward, would run
    // under the tower rail.
    if (Services.save.data.gauntlet.run) {
      const abandon = this.add
        .text(textX, 510, 'Abandon Run', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '15px',
          color: '#a06a6a',
        })
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      this.abandonBtn = abandon;
      // Destructive: keeps its two-tap arm/confirm on top of tap classification.
      bindTapButton(this, abandon, () => this.onAbandon());
      inflateHitArea(abandon, 90, 90);
      c.add(abandon);
    }

    this.panel = c;
  }

  private onAbandon(): void {
    if (!this.abandonBtn) return;
    if (!this.abandonArmed) {
      this.abandonArmed = true;
      this.abandonBtn.setText('Click again to confirm').setColor('#f08a8a');
      // The confirm label is wider than the armed one — regrow the (custom,
      // hence no longer auto-tracking) hit area to cover the new glyphs.
      inflateHitArea(this.abandonBtn, 90, 90);
      return;
    }
    Services.save.data.gauntlet.run = null;
    Services.save.flush();
    this.scene.restart();
  }

  private startFight(av: Avatar): void {
    // Begin (or resume) the run at this rung. A fresh run locks in the chosen
    // seed (every rung derives its duel seed from it — reproducible playthrough).
    const g = Services.save.data.gauntlet;
    if (!g.run) g.run = { rung: av.tier, startedAt: Date.now(), seed: this.pendingSeed };
    Services.save.flush();
    this.scene.start('Duel', { opponentId: av.id, gauntletRung: av.tier });
  }

  /**
   * Bottom-left run-seed readout. A run in progress shows its LOCKED seed
   * (every duel of the run derives from it — a single reproducible playthrough);
   * with no run active it shows the seed the next run will use, with Reroll and
   * Set… so the player can pick a fresh playthrough or replay a shared one.
   */
  private buildSeedBar(): void {
    this.seedBar?.destroy();
    const c = this.add.container(0, 0);
    const g = Services.save.data.gauntlet;
    const active = !!g.run;
    const seed = active ? g.run!.seed : this.pendingSeed;
    const y = 690;

    const label = this.add
      .text(30, y, `🎲 ${active ? 'Run seed' : 'Next run seed'} ${seed}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        fontStyle: '600',
        color: active ? '#c7a8f0' : '#e8def7',
      })
      .setOrigin(0, 0.5);
    c.add(label);

    if (active) {
      c.add(
        this.add
          .text(label.x + label.width + 14, y, '· locked for this run', {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            color: '#6d6288',
          })
          .setOrigin(0, 0.5),
      );
    } else {
      // Chip buttons — no hover recolor (would reset the custom hit area via the
      // Text.updateText trap); the backgroundColor makes them read as buttons.
      let x = label.x + label.width + 16;
      const chip = (text: string, onTap: () => void): Phaser.GameObjects.Text => {
        const t = this.add
          .text(x, y, text, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '14px',
            color: '#ffd88a',
            backgroundColor: '#2c2344',
            padding: { x: 10, y: 5 },
          })
          .setOrigin(0, 0.5)
          .setInteractive({ useHandCursor: true });
        bindTapButton(this, t, onTap);
        inflateHitArea(t, 90, 48);
        c.add(t);
        x += t.width + 10;
        return t;
      };
      chip('↻ Reroll', () => {
        this.pendingSeed = clampSeed(Math.floor(Math.random() * 2 ** 31));
        this.buildSeedBar();
      });
      chip('⌨ Set…', () => this.promptSeed());
    }

    this.seedBar = c;
  }

  /** Prompt for a custom run seed (share/replay a playthrough). Prompt-less webviews no-op. */
  private promptSeed(): void {
    try {
      const input = window.prompt(
        'Enter a run seed (whole number). The same seed always plays out the same run — share it to replay.',
        String(this.pendingSeed),
      );
      if (input == null) return; // cancelled
      const n = Number(input.trim());
      if (!Number.isFinite(n)) return; // ignore non-numeric input
      this.pendingSeed = clampSeed(n);
      this.buildSeedBar();
    } catch {
      // window.prompt unavailable in some embedded webviews — leave the seed as-is.
    }
  }

  /**
   * Render the avatar's portrait card art large, cropped to the upper "bust"
   * band. Falls back silently if the art isn't available (never crashes the
   * tower). The placeholder atlas has every card's art after Preload.
   */
  private addPortrait(c: Phaser.GameObjects.Container, cardId: string, x: number, y: number): void {
    try {
      const ref = Art.resolver?.getArt(cardId);
      if (!ref) return;
      const img = this.add.image(x, y, ref.textureKey, ref.frameName);
      // Cover-fit the 320×400 art into the 260×328 window, biased to the top so
      // the face reads. A geometry mask crops the overflow to the frame.
      const targetW = 260;
      const targetH = 328;
      const scale = Math.max(targetW / img.width, targetH / img.height) * 1.12;
      img.setScale(scale);
      img.y = y - 26; // bias upward toward the face
      const maskShape = this.add
        .rectangle(x, y, targetW, targetH, 0xffffff)
        .setVisible(false);
      const mask = maskShape.createGeometryMask();
      img.setMask(mask);
      c.add(img);
      c.add(maskShape);
    } catch {
      // no art — the framed panel alone is an acceptable fallback
    }
  }
}
