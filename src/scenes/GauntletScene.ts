import Phaser from 'phaser';
import { floorBrain, floorDifficultyPips } from '../ai/tiers';
import { fitMenuName } from '../ui/menuText';
import { currentAccessibility } from '../ui/accessibility';
import { gauntletPresentation, gauntletDetailLayout, gauntletNameLineLimit } from '../ui/playPresentation';
import { bindMenuScroll } from '../ui/menuScroll';
import { listRowAccentBar } from '../ui/controlStyle';
import { IS_DEV } from '../platform/env';
import type { SaveData } from '../meta/SaveManager';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { AVATARS, type Avatar } from '../data/opponents';
import {
  clampSeed,
  localDateKey,
  resolveGauntletRoster,
  type ResolvedGauntletRoster,
} from '../meta/gauntletSeed';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea, isTouchDevice } from '../platform/gestures';
import {
  GAUNTLET_TOWER_SCROLLBAR,
  gauntletScrollToRung,
  gauntletFittedRowGap,
  gauntletTowerLayout,
  scrollOffsetByDelta,
  type GauntletTowerLayout,
} from '../ui/layout';
import { gateOnArt } from '../ui/artGate';
import { prefetchDuelArt } from '../ui/duelArt';
import { addPortraitArt } from '../ui/portraitArt';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { sceneSubtitle, sceneTitle } from '../ui/sceneTitle';
import { ellipsizeText } from '../ui/textFit';
import { colorInt, theme } from '../ui/theme';
import { Toast } from '../ui/Toast';
import { backButton, panel, registerSceneBackNavigation, themedButton, type ThemedButton } from '../ui/themeWidgets';

/** How long an armed Abandon waits for its second press, as Settings' Reset does. */
const ABANDON_ARM_MS = 4000;

/**
 * The Avatar Gauntlet tower. A count-aware right-rail ladder (cleared ✓ /
 * current highlighted / future dimmed) and a left panel showing the selected
 * avatar — portrait, name/title/blurb, theme chip, difficulty pips, and the
 * rung's reward. Fight launches the duel; a loss resets the run, a full clear
 * pays the completion bonus.
 *
 * The "current" rung is the in-progress run's rung, or rung 1 for a fresh run.
 * Only the current rung is fightable — you climb one rung at a time.
 */
export class GauntletScene extends Phaser.Scene {
  private fixtureRun: SaveData['gauntlet'] | null = null;
  private get gauntlet(): SaveData['gauntlet'] { return this.fixtureRun ?? Services.save.data.gauntlet; }
  private selectedRung = 1;
  private currentRung = 1; // the rung you may actually fight
  private panel: Phaser.GameObjects.Container | null = null;
  private rowNodes: { rung: number; box: Phaser.GameObjects.Rectangle; mark: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }[] = [];
  /** Scrolling ladder state; the tower outgrew a fixed 500px column at 22 rungs. */
  private towerLayout: GauntletTowerLayout | null = null;
  private towerContent: Phaser.GameObjects.Container | null = null;
  private towerScroll = 0;
  private towerThumb: Phaser.GameObjects.Graphics | null = null;
  /** Set once a pointer drag passes the threshold, so the release does not also select a rung. */
  private towerDragged = false;
  private abandonArmed = false;
  private abandonBtn: ThemedButton | null = null;
  /** The consequence line under Abandon, visible only while it is armed. */
  private abandonWarning: Phaser.GameObjects.Text | null = null;
  /** Abandon's left edge, shared with Fight, so a longer label grows rightward. */
  private abandonLeft = 0;
  /** Seed the NEXT run will use (rerollable / player-settable until it begins). */
  private pendingSeed = 1;
  private seedBar: Phaser.GameObjects.Container | null = null;
  /** One create-time roster resolution, shared by the rail and detail pane. */
  private roster!: ResolvedGauntletRoster;

  constructor() {
    super('Gauntlet');
  }

  /** The tower rail and detail pane draw all 28 avatar portrait cards. */
  create(data: { a11yRung?: number } = {}): void {
    this.sys.settings.data = {};
    this.fixtureRun = IS_DEV && data.a11yRung ? { ...Services.save.data.gauntlet,
      run: { rung: data.a11yRung, seed: 2147483647, startedAt: 0, rosterDay: 0, rosterSeed: 0 } } : null;
    gateOnArt(this, AVATARS.map((avatar) => avatar.portraitCardId), () => this.build());
  }
  private build(): void {
    this.rowNodes = [];
    this.towerLayout = null;
    this.towerContent = null;
    this.towerScroll = 0;
    this.towerThumb = null;
    this.towerDragged = false;
    this.panel = null;
    this.abandonArmed = false;
    this.abandonBtn = null;
    this.abandonWarning = null;
    this.seedBar = null;

    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;
    const height = 720;
    // Backdrop first (docs/scene-art.md §3); the gradient is the fallback.
    applyBackdrop(this, 'gauntlet', {
      dim: colorInt(theme.colors.dim),
      dimAlpha: 0.5,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(
          colorInt(theme.colors.panelFill),
          colorInt(theme.colors.panelFill),
          colorInt(theme.colors.dim),
          colorInt(theme.colors.dim),
          1,
        );
        bg.fillRect(0, 0, width, height);
      },
    });

    const g = this.gauntlet;
    this.currentRung = g.run?.rung ?? 1;
    this.selectedRung = this.currentRung;
    const todayDay = localDateKey(Date.now());
    this.roster = resolveGauntletRoster(g.run, todayDay, AVATARS.length);
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
    new Toast(this);

    sceneTitle(this, 'Avatar Gauntlet');
    sceneSubtitle(
      this,
      `Climb ${ECONOMY.gauntletRungGold.length} rungs. A loss ends the run: the tower resets, your collection does not.`,
      { fontSize: theme.type.label },
    );

    const { detailPanel } = gauntletPresentation();
    panel(this, detailPanel.x, detailPanel.y, detailPanel.width, detailPanel.height);
    this.buildTower();
    this.buildPanel();
    this.buildSeedBar();

    backButton(this, 'Play', () => this.scene.start('Play'));
    registerSceneBackNavigation(this, () => this.scene.start('Play'));
  }

  // ---------------------------------------------------------------------
  private buildTower(): void {
    const g = this.gauntlet;
    // The ladder's right edge, scrollbar included, sits on the title-safe edge.
    const base = gauntletPresentation();
    const railX = base.tower.x + base.tower.width / 2;
    const rungs = ECONOMY.gauntletRungGold.length;

    // Two caption lines centred between the scene subtitle (which ends near
    // y 101) and the tower viewport (156); centred at 122 until 1.8.1 the block
    // began 5px under the subtitle once it hung below the header track.
    const heading = this.add
      .text(
        railX,
        base.railHeadingTop,
        `Best: ${g.bestRung > 0 ? `Rung ${g.bestRung}` : 'None'}   ·   Clears: ${g.completions}\n${this.rosterHeading(!!g.run)}`,
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
          align: 'center',
          wordWrap: { width: base.tower.width },
          lineSpacing: theme.space(0.5),
        },
      )
      .setOrigin(0.5, 0);

    // The ladder scrolls instead of compressing. Rows keep a readable pitch at
    // any tower length, and the layout subtracts the star column from the name
    // budget so the two can never overlap (they did at 22 rungs).
    const viewport = gauntletPresentation(heading.height).tower;
    const starMeasure = this.add.text(0, 0, '★★★', { fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px` });
    const labelMeasure = this.add.text(0, 0, 'Rung', { fontFamily: theme.fonts.display, fontSize: `${theme.type.body}px` });
    const rowHeight = Math.max(theme.control.minHitHeight, labelMeasure.height + theme.space(4), starMeasure.height + theme.space(4));
    const layout = gauntletTowerLayout(rungs, viewport, {
      starColumnWidth: starMeasure.width,
      rowHeight,
      rowGap: gauntletFittedRowGap(viewport.height, rowHeight),
    });
    starMeasure.destroy(); labelMeasure.destroy();
    this.towerLayout = layout;
    const content = this.add.container(viewport.x, viewport.y);
    this.towerContent = content;

    // Rungs render bottom-up: rung 1 at the bottom, the top rung at the top.
    for (let rung = rungs; rung >= 1; rung--) {
      const rowIndex = rungs - rung; // 0 at top
      const y = rowIndex * layout.rowPitch + layout.rowHeight / 2;
      const av = this.avatarForFloor(rung);
      const cleared = rung < this.currentRung;
      const isCurrent = rung === this.currentRung;

      const box = this.add
        .rectangle(layout.rowWidth / 2, y, layout.rowWidth, layout.rowHeight, this.rowColor(rung), theme.alpha.panel)
        .setStrokeStyle(2, colorInt(isCurrent ? theme.colors.gold : theme.colors.panelStroke))
        .setInteractive({ useHandCursor: true });
      const status = cleared ? '✓' : isCurrent ? '▶' : '·';
      const label = this.add
        .text(layout.labelX, y, `${status}  Rung ${rung} · ${av.name}`, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.body}px`,
          color: this.rowTextColor(rung),
        })
        .setOrigin(0, 0.5);
      ellipsizeText(label, layout.labelWidth);
      const stars = this.add
        .text(layout.starRightX, y, '★'.repeat(floorDifficultyPips(rung)), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.gold,
        })
        .setOrigin(1, 0.5);

      bindTapButton(this, box, () => {
        if (this.towerDragged) return; // a drag must not also pick a rung
        this.selectedRung = rung;
        this.refreshTower();
        this.buildPanel();
      });
      inflateHitArea(box, 90, layout.rowHeight);
      box.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch && rung !== this.selectedRung) box.setStrokeStyle(2, theme.graphics.rowFillActive);
      });
      box.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) this.refreshTower();
      });
      const mark = this.add.graphics();
      content.add([box, label, stars, mark]);
      this.rowNodes.push({ rung, box, mark, label });
    }

    // The mask is a scene-level child on purpose: parenting it to the container
    // it clips would scroll it along with the rows and clip nothing.
    const maskShape = this.add
      .graphics()
      .fillStyle(theme.graphics.panelFill, 1)
      .fillRect(viewport.x, viewport.y, viewport.width, viewport.height)
      .setVisible(false);
    content.setMask(maskShape.createGeometryMask());

    if (layout.overflow) this.bindTowerScroll(layout);
    // Open on the rung you are actually climbing, not on the summit.
    this.setTowerScroll(gauntletScrollToRung(this.currentRung, rungs, layout));
    this.refreshTower();
  }

  private bindTowerScroll(layout: GauntletTowerLayout): void {
    const { viewport } = layout;
    this.towerThumb = this.add.graphics();
    const zone = this.add
      .zone(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2, viewport.width, viewport.height)
      .setInteractive();
    zone.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => {
      this.setTowerScroll(this.towerScroll + dy);
    });

    let dragPointerId: number | null = null;
    let dragStartY = 0;
    let dragStartOffset = 0;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragPointerId = p.id;
      dragStartY = p.worldY;
      dragStartOffset = this.towerScroll;
      this.towerDragged = false;
    });
    const moveDrag = (p: Phaser.Input.Pointer): void => {
      if (dragPointerId !== p.id) return;
      const travel = p.worldY - dragStartY;
      // Past the threshold this is a scroll, not a tap, so the row under the
      // finger must not select when the pointer comes up.
      if (Math.abs(travel) > 6) this.towerDragged = true;
      this.setTowerScroll(dragStartOffset - travel);
    };
    const endDrag = (p: Phaser.Input.Pointer): void => {
      if (dragPointerId === p.id) dragPointerId = null;
    };
    this.input.on('pointermove', moveDrag);
    this.input.on('pointerup', endDrag);

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowDown') this.setTowerScroll(this.towerScroll + layout.rowPitch);
      else if (event.key === 'ArrowUp') this.setTowerScroll(this.towerScroll - layout.rowPitch);
      else if (event.key === 'PageDown') this.setTowerScroll(this.towerScroll + viewport.height);
      else if (event.key === 'PageUp') this.setTowerScroll(this.towerScroll - viewport.height);
      else return;
      event.preventDefault();
    };
    this.input.keyboard?.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', moveDrag);
      this.input.off('pointerup', endDrag);
      this.input.keyboard?.off('keydown', onKey);
    });
  }

  private setTowerScroll(next: number): void {
    const layout = this.towerLayout;
    if (!layout || !this.towerContent) return;
    this.towerScroll = scrollOffsetByDelta(0, next, layout.maxScroll);
    this.towerContent.setPosition(layout.viewport.x, layout.viewport.y - this.towerScroll);
    for (const node of this.rowNodes) {
      const top = node.box.y - layout.rowHeight / 2 - this.towerScroll;
      if (top >= 0 && top + layout.rowHeight <= layout.viewport.height) node.box.setInteractive({ useHandCursor: true });
      else node.box.disableInteractive();
    }
    this.redrawTowerScrollbar();
  }

  private redrawTowerScrollbar(): void {
    const layout = this.towerLayout;
    if (!layout || !this.towerThumb || layout.maxScroll <= 0) return;
    const { viewport, scrollbar } = layout;
    const { railWidth, thumbWidth } = GAUNTLET_TOWER_SCROLLBAR;
    const railX = scrollbar.x + (thumbWidth - railWidth) / 2;
    const thumbHeight = Math.max(
      theme.space(8),
      viewport.height * (viewport.height / Math.max(viewport.height, layout.contentHeight)),
    );
    const thumbY = viewport.y + (this.towerScroll / layout.maxScroll) * Math.max(0, viewport.height - thumbHeight);
    this.towerThumb
      .clear()
      .fillStyle(theme.graphics.panelStroke, theme.alpha.subtle)
      .fillRoundedRect(railX, viewport.y, railWidth, viewport.height, theme.radius.control)
      .fillStyle(theme.graphics.rowFillActive, theme.alpha.chrome)
      .fillRoundedRect(scrollbar.x, thumbY, thumbWidth, thumbHeight, theme.radius.control);
  }

  private refreshTower(): void {
    for (const node of this.rowNodes) {
      const isSelected = node.rung === this.selectedRung;
      const isCurrent = node.rung === this.currentRung;
      node.box.setFillStyle(this.rowColor(node.rung), 1);
      node.box.setStrokeStyle(
        isSelected ? theme.outline.state : 2,
        colorInt(isSelected ? theme.colors.goldHover : isCurrent ? theme.colors.gold : theme.colors.panelStroke),
      );
      node.mark.clear();
      if (isSelected) {
        const mark = listRowAccentBar({ x: 0, y: node.box.y - node.box.height / 2,
          width: node.box.width, height: node.box.height }, theme.outline.state);
        node.mark.fillStyle(colorInt(theme.colors.gold), 1).fillRect(mark.x, mark.y, mark.width, mark.height);
      }
    }
  }

  private rowColor(rung: number): number {
    if (rung === this.currentRung) return theme.graphics.rowFillActive;
    return theme.graphics.rowFill;
  }

  private rowTextColor(rung: number): string {
    if (rung < this.currentRung) return theme.colors.success;
    if (rung === this.currentRung) return theme.colors.gold;
    return theme.colors.muted;
  }

  private avatarForFloor(floor: number): Avatar {
    const index = this.roster.order[floor - 1];
    const avatar = index === undefined ? undefined : AVATARS[index];
    if (!avatar) throw new Error(`No avatar assigned to Tower floor ${floor}`);
    return avatar;
  }

  private rosterHeading(active: boolean): string {
    if (this.roster.fixed) return 'Run lineup · fixed order';
    const day = String(this.roster.rosterDay).padStart(8, '0');
    const date = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
    return `${active ? 'Run lineup' : "Today's lineup"} · ${date}`;
  }

  // ---------------------------------------------------------------------
  private buildPanel(): void {
    this.panel?.destroy();
    this.abandonArmed = false;
    this.abandonBtn = null;
    this.abandonWarning = null;
    const floor = this.selectedRung;
    const av = this.avatarForFloor(floor);
    const c = this.add.container(0, 0);

    const layout = gauntletPresentation();
    const px = layout.portraitX;
    const portraitY = layout.portraitY;
    c.add(panel(this, px - 134, portraitY - 168, 268, 336, { alpha: 1 }));
    this.addPortrait(c, av.portraitCardId, px, portraitY);
    c.add(this.add.text(px - layout.themeWidth / 2, layout.themeTop, av.theme, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`, fontStyle: theme.weight.w600,
      color: theme.colors.body, wordWrap: { width: layout.themeWidth }, align: 'center',
    }));
    const textX = layout.textX;
    const COL_W = layout.textWidth;
    const copyWidth = COL_W - (currentAccessibility().textScale > 1 ? theme.space(2) : 0);

    const name = this.add.text(textX, 0, av.name, {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`, color: theme.colors.heading,
    });
    fitMenuName(name, copyWidth, gauntletNameLineLimit());
    const title = this.add.text(textX, 0, av.title, {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.body}px`, fontStyle: 'italic',
      color: theme.colors.gold, wordWrap: { width: COL_W },
    });
    fitMenuName(title, copyWidth);
    // Spare canvas space protects italic overhangs without moving the column.
    if (currentAccessibility().textScale > 1) title.setPadding({ right: theme.space(1) });
    title.setData('a11yTextWidth', COL_W);
    const rung = this.add.text(textX, 0, `Rung ${floor}   ${'★'.repeat(floorDifficultyPips(floor))}   (${floorBrain(floor)})`, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, color: theme.colors.gold,
      wordWrap: { width: COL_W },
    });
    const blurb = this.add.text(textX, 0, av.blurb, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.label}px`, color: theme.colors.body,
      lineSpacing: theme.space(1), wordWrap: { width: copyWidth },
    });
    const reward = ECONOMY.gauntletRungGold[floor - 1];
    const rewardLine = floor === ECONOMY.gauntletRungGold.length
      ? `Reward: 🪙 ${reward}  +  🪙 ${ECONOMY.gauntletCompletionBonus} completion bonus` : `Reward: 🪙 ${reward}`;
    const rewardText = this.add.text(textX, 0, rewardLine, {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, fontStyle: theme.weight.w600,
      color: theme.colors.gold, wordWrap: { width: COL_W },
    });
    const blurbLines = blurb.getWrappedText().length;
    const lineHeight = (blurb.height - blurb.lineSpacing * (blurbLines - 1)) / blurbLines;
    const linePitch = lineHeight + blurb.lineSpacing;
    const detail = gauntletDetailLayout({ name: name.height, title: title.height, rung: rung.height,
      blurb: blurb.height, reward: rewardText.height, lineHeight, linePitch });
    name.setY(detail.nameY); title.setY(detail.titleY); rung.setY(detail.rungY); rewardText.setY(detail.rewardY);
    for (const text of [name, title]) text.setData('a11yBox', {
      x: textX, y: text.y, width: COL_W, height: text.height,
    });
    rewardText.setData('a11yFullText', rewardLine).setData('a11yBox', {
      x: textX, y: detail.rewardY, width: COL_W, height: layout.detailViewport.y + layout.detailViewport.height - detail.rewardY,
    });
    c.add([name, title, rung, rewardText]);
    const textContent = this.add.container(0, 0);
    blurb.setData('a11yWholeLines', { lineHeight, linePitch });
    textContent.add(blurb);
    c.add(textContent);
    bindMenuScroll(this, textContent, detail.blurb, blurb.height, undefined, undefined, linePitch);

    // Fight / locked
    const fightable = floor === this.currentRung;
    if (fightable) {
      prefetchDuelArt(this, { opponentId: av.id, gauntletRung: floor });
      const fight = themedButton(this, textX + 104, layout.fightY, this.gauntlet.run ? 'Fight' : 'Begin Run', {
        variant: 'primary',
        minWidth: 208,
        onTap: () => this.startFight(av, floor),
      });
      c.add(fight.container);
    } else {
      const locked =
        floor < this.currentRung ? 'Already cleared this run' : 'Clear the rungs below first';
      c.add(
        this.add
          .text(textX, layout.fightY, `🔒 ${locked}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.label}px`,
            color: theme.colors.muted,
            wordWrap: { width: COL_W },
          })
          .setOrigin(0, 0.5),
      );
    }

    // Abandon Run (two-press confirm) — only while a run is in progress. Now a
    // distinct destructive button (was a bare text link) set well below Fight
    // (y 556 vs 456): their inflated 90px hit rects were near-adjacent, so a
    // slip could abandon instead of fight. Kept below the fight line, not to its
    // right — the armed label is wide and would run under the tower rail, so it
    // grows rightward from the Fight button's left edge.
    if (this.gauntlet.run) {
      const abandon = themedButton(this, textX + 104, layout.abandonY, 'Abandon Run', {
        variant: 'danger',
        minWidth: 208,
        onTap: (pointer) => this.onAbandon(pointer),
      });
      this.abandonBtn = abandon;
      this.abandonLeft = textX;
      // Destructive: keeps its two-tap arm/confirm on top of tap classification.
      c.add(abandon.container);
      // What the second press loses, shown only while armed.
      this.abandonWarning = this.add
        .text(textX, layout.warningY, 'Your climb restarts at rung 1. Gold already won is kept.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.danger,
          wordWrap: { width: COL_W },
        })
        .setOrigin(0, 0)
        .setVisible(false);
      c.add(this.abandonWarning);
    }

    this.panel = c;
  }

  private onAbandon(pointer?: Phaser.Input.Pointer): void {
    const button = this.abandonBtn;
    if (!button) return;
    // Shared destructive-confirm policy: two-tap unless the player opted out.
    if (Services.save.data.settings.confirmDestructive && !this.abandonArmed) {
      this.abandonArmed = true;
      const verb = (pointer?.wasTouch ?? isTouchDevice()) ? 'Tap' : 'Click';
      this.setAbandonLabel(button, `${verb} again to abandon`);
      this.abandonWarning?.setVisible(true);
      // Stand down after a few seconds unanswered, as Settings' Reset does. A
      // rebuilt panel has a new button and has already disarmed, so a timer
      // from the old one leaves it alone.
      this.time.delayedCall(ABANDON_ARM_MS, () => {
        if (this.abandonBtn !== button || !button.container.active || !this.abandonArmed) return;
        this.abandonArmed = false;
        this.setAbandonLabel(button, 'Abandon Run');
        if (this.abandonWarning?.active) this.abandonWarning.setVisible(false);
      });
      return;
    }
    this.gauntlet.run = null;
    if (!this.fixtureRun) Services.save.flush();
    this.scene.restart();
  }

  /** Relabel Abandon, keeping its left edge on the Fight button's. */
  private setAbandonLabel(button: ThemedButton, label: string): void {
    button.setLabel(label);
    button.container.setX(this.abandonLeft + button.getMeasuredSize().visual.width / 2);
  }

  private startFight(av: Avatar, floor: number): void {
    // Begin (or resume) the run at this rung. A fresh run locks in the chosen
    // seed (every rung derives its duel seed from it — reproducible playthrough).
    const g = this.gauntlet;
    if (!g.run) {
      g.run = {
        rung: floor,
        startedAt: Date.now(),
        seed: this.pendingSeed,
        rosterDay: this.roster.rosterDay,
        rosterSeed: this.roster.rosterSeed,
      };
    }
    if (!this.fixtureRun) Services.save.flush();
    this.scene.start('Duel', { opponentId: av.id, gauntletRung: floor });
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
    const g = this.gauntlet;
    const active = !!g.run;
    const seed = active ? g.run!.seed : this.pendingSeed;
    // On the shared footer line at the title-safe left edge. It sat at
    // (30, 690) until the 1.8 cut (2026-09-23), outside the frame on two sides.
    const y = theme.design.footerCenterY;

    const label = this.add
      .text(theme.design.safeLeft, y, `🎲 ${active ? 'Run seed' : 'Next run seed'} ${seed}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: theme.weight.w600,
        color: active ? theme.colors.gold : theme.colors.body,
      })
      .setOrigin(0, 0.5);
    c.add(label);

    if (active) {
      c.add(
        this.add
          .text(label.x + label.width + 14, y, '· locked for this run', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.muted,
          })
          .setOrigin(0, 0.5),
      );
    } else {
      let x = label.x + label.width + 16;
      const chip = (text: string, onTap: () => void): void => {
        const minWidth = 90;
        const t = themedButton(this, x + minWidth / 2, y, text, { variant: 'emphasis', size: 'sm', minWidth, onTap });
        c.add(t.container);
        const width = t.getMeasuredSize().hit.width;
        t.container.setX(x + width / 2);
        x += width + theme.space(3);
      };
      chip('↻ Reroll', () => {
        this.pendingSeed = clampSeed(Math.floor(Math.random() * 2 ** 31));
        this.buildSeedBar();
      });
      chip('⌨ Set Seed…', () => this.promptSeed());
    }

    this.seedBar = c;
  }

  /** Prompt for a custom run seed (share/replay a playthrough). Prompt-less webviews no-op. */
  private promptSeed(): void {
    try {
      const input = window.prompt(
        'Enter a run seed (whole number). The same seed always plays out the same run. Share it to replay.',
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
      // Cover-fit the art into the 260×328 window, biased to the top so the
      // face reads. A geometry mask crops the overflow to the frame.
      const targetW = 260;
      const targetH = 328;
      const img = addPortraitArt(this, x, y - 26, cardId, (image) => {
        image.setScale(Math.max(targetW / image.width, targetH / image.height) * 1.12);
      });
      if (!img) return;
      const maskShape = this.add
        .rectangle(x, y, targetW, targetH, colorInt(theme.colors.heading))
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
