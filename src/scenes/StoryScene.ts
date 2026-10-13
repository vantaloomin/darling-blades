import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { FEATURES } from '../config/features';
import { CARD_DB } from '../data/catalog';
import { avatarById } from '../data/opponents';
import { STORY_BOONS } from '../data/story/act1';
import { storyCharacterById } from '../data/story/characters';
import type { StoryBoonId, StoryCharacter } from '../data/story/types';
import { def, type CardDef } from '../engine/types';
import type { SaveData } from '../meta/SaveManager';
import { Services } from '../meta/services';
import {
  abandonRun,
  chooseBoon,
  claimKeep,
  enterNode,
  eventCard,
  keepOptions,
  legalNextNodes,
  resolveEvent,
  resolveRest,
  resolveShop,
  shopStock,
  startRun,
  takeCardReward,
} from '../meta/story/StoryProgress';
import { finishClearedRun, storyRoster, storyScreen, type StoryScreen } from '../meta/story/storyFlow';
import { isDuelNode, storyMapNodes, type StoryNode } from '../meta/story/storyMap';
import { runMap, storyActByNumber, type StoryRun, type StoryState } from '../meta/story/storyState';
import { IS_DEV } from '../platform/env';
import { bindTapButton, isTouchDevice, setStickyHost } from '../platform/gestures';
import { gateOnArt } from '../ui/artGate';
import { makeCardThumb } from '../ui/CardThumbCache';
import { CardZoomPreview } from '../ui/CardZoomPreview';
import { ModalGuard } from '../ui/Modal';
import { addPortraitArt } from '../ui/portraitArt';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { sceneSubtitle, sceneTitle } from '../ui/sceneTitle';
import {
  abandonNote,
  cardCount,
  colourWords,
  deckEntries,
  EVENT_LINE,
  eventGoldLabel,
  NODE_KIND_LABEL,
  nodeActionLabel,
  nodeSummary,
  recordLine,
  shopCartState,
  shortName,
  togglePick,
  unlockLines,
} from '../ui/storyPresentation';
import {
  cardSize,
  storyCaptionBand,
  storyCardGridLayout,
  storyCardRowScale,
  storyChoiceRow,
  storyContentBottom,
  storyContentTop,
  storyFooterRow,
  storyMapLayout,
  storyMapPanelLayout,
  storySelectLayout,
  type StoryCardGridLayout,
} from '../ui/storyLayout';
import { colorInt, theme } from '../ui/theme';
import { bakeUiIcon } from '../ui/uiIcons';
import {
  backButton,
  modalShell,
  pager,
  panel,
  registerSceneBackNavigation,
  themedButton,
  type ThemedButton,
} from '../ui/themeWidgets';

export interface StorySceneData {
  /** Dev only: an in-memory story record shown instead of the save's, never persisted (probe and screenshots). */
  a11yFixture?: { story: StoryState };
  /** The card the keep just granted, named on the cleared summary (this visit only). */
  keptCardId?: string;
}

/** How long an armed Abandon waits for its second press, as Limited's Retire does. */
const ABANDON_ARM_MS = 4000;
const PRIMARY_MIN_W = 240;
const PRIMARY_TEXT_W = 380;

interface CardPick {
  /** The card ids picked, in pick order (a card may repeat when the deck holds copies). */
  picked: string[];
  limit: number;
}

/**
 * Story Mode's run screens (docs/plan-story-mode.md, wave 2), behind
 * `FEATURES.storyLive`. Every visit reads `save.story` and shows the one
 * screen the run is at (`storyScreen`); every change goes through the meta
 * functions, is flushed, and restarts the scene onto the next screen, so
 * leaving at any point and coming back resumes exactly. Duel nodes hand off
 * to DuelScene with `{ story: { runId, nodeId } }`, which records the result
 * and comes back here.
 */
export class StoryScene extends Phaser.Scene {
  private fixtureSave: SaveData | null = null;
  private keptCardId: string | null = null;
  private zoom!: CardZoomPreview;
  private guard = new ModalGuard();
  private selectedCharacterId: string | null = null;

  constructor() {
    super('Story');
  }

  private get save(): SaveData {
    return this.fixtureSave ?? Services.save.data;
  }

  private get story(): StoryState {
    return this.save.story;
  }

  create(data: StorySceneData = {}): void {
    if (!FEATURES.storyLive) {
      this.scene.start('Play');
      return;
    }
    const fixture = IS_DEV ? data.a11yFixture ?? null : null;
    this.fixtureSave = fixture ? { ...structuredClone(Services.save.data), story: structuredClone(fixture.story) } : null;
    this.keptCardId = data.keptCardId ?? null;
    // Phaser keeps a start's data for the next start that passes none.
    this.sys.settings.data = {};
    this.guard = new ModalGuard();
    const screen = storyScreen(this.story);
    gateOnArt(this, this.artFor(screen), () => this.build(screen));
  }

  /** The card art a screen draws (portraits, thumbs and the run deck for the deck view). */
  private artFor(screen: StoryScreen): string[] {
    const ids = new Set<string>();
    if (screen.kind === 'select') {
      for (const entry of storyRoster(this.story)) ids.add(entry.character.darlingId);
      return [...ids];
    }
    const run = screen.run;
    const character = storyCharacterById(run.characterId);
    if (character) ids.add(character.darlingId);
    for (const id of run.deck) ids.add(id);
    if (screen.kind === 'reward') for (const id of screen.options) ids.add(id);
    if (screen.kind === 'event') ids.add(eventCard(run, screen.node));
    if (screen.kind === 'shop') for (const offer of shopStock(run, screen.node, CARD_DB)) ids.add(offer.cardId);
    if (this.keptCardId) ids.add(this.keptCardId);
    return [...ids];
  }

  private build(screen: StoryScreen): void {
    applyBackdrop(this, 'gauntlet', {
      dim: theme.graphics.dim,
      dimAlpha: 0.55,
      fallback: () => {
        this.add.graphics()
          .fillGradientStyle(theme.graphics.panelFill, theme.graphics.panelFill, theme.graphics.dim, theme.graphics.dim, 1)
          .fillRect(0, 0, theme.design.width, theme.design.height);
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');
    this.zoom = new CardZoomPreview(this, { scale: 1.12, depth: theme.depth.inspect + 5, delayMs: 250 });
    setStickyHost(this, this.zoom);

    sceneTitle(this, 'Story');
    backButton(this, 'Play', () => this.leave());
    registerSceneBackNavigation(this, () => this.leave());

    switch (screen.kind) {
      case 'select': return this.buildSelect();
      case 'boon': return this.buildBoon(screen.run, screen.offers);
      case 'reward': return this.buildReward(screen.run, screen.options, screen.waiting);
      case 'keep': return this.buildKeep(screen.run);
      case 'cleared': return this.buildCleared(screen.run);
      case 'event': return this.buildEvent(screen.run, screen.node);
      case 'shop': return this.buildShop(screen.run, screen.node);
      case 'rest': return this.buildRest(screen.run, screen.node);
      case 'duel':
      case 'map': return this.buildMap(screen.run, screen.kind === 'duel' ? screen.node : null);
    }
  }

  // ------------------------------------------------------------------ plumbing

  private leave(): void {
    this.scene.start('Play');
  }

  /** Save the run (never a fixture) and show the screen it is now at. */
  private commit(data: Omit<StorySceneData, 'a11yFixture'> = {}): void {
    if (!this.fixtureSave) Services.save.flush();
    this.scene.restart(this.fixtureSave ? { ...data, a11yFixture: { story: this.story } } : data);
  }

  /** A refused meta call is shown, never worked around. */
  private refused(reason: string): void {
    this.subtitleLine?.setText(reason).setColor(theme.colors.danger);
  }

  private subtitleLine: Phaser.GameObjects.Text | null = null;

  /** The line under the title; returns where content may start. */
  private subtitle(copy: string): number {
    this.subtitleLine = sceneSubtitle(this, copy, { fontSize: theme.type.body })
      .setAlign('center')
      .setWordWrapWidth(theme.design.safeWidth, true);
    return storyContentTop(this.subtitleLine.getBounds().bottom);
  }

  private text(x: number, y: number, copy: string, size: number, color: string, opts: { display?: boolean; wrap?: number; bold?: boolean } = {}): Phaser.GameObjects.Text {
    return this.add.text(x, y, copy, {
      fontFamily: opts.display ? theme.fonts.display : theme.fonts.ui,
      fontSize: `${size}px`,
      color,
      ...(opts.bold ? { fontStyle: theme.weight.w700 } : {}),
      ...(opts.wrap ? { wordWrap: { width: opts.wrap, useAdvancedWrap: true } } : {}),
    });
  }

  private button(label: string, variant: 'primary' | 'ghost' | 'danger', onTap: (p: Phaser.Input.Pointer) => void, enabled = true): ThemedButton {
    return themedButton(this, 0, 0, label, { variant, minWidth: PRIMARY_MIN_W, maxTextWidth: PRIMARY_TEXT_W, enabled, onTap });
  }

  /** Place footer buttons in one centred row on the footer line, from their measured widths. */
  private placeFooter(buttons: readonly ThemedButton[]): void {
    const row = storyFooterRow(buttons.map((b) => b.getMeasuredSize().hit.width));
    buttons.forEach((b, i) => b.container.setPosition(row.xs[i], row.y));
  }

  /** Every enabled input target, containers included (for the modal guard). */
  private interactiveTargets(): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [];
    const walk = (list: readonly Phaser.GameObjects.GameObject[]): void => {
      for (const obj of list) {
        if (obj.input?.enabled) out.push(obj);
        if (obj instanceof Phaser.GameObjects.Container) walk(obj.list);
      }
    };
    walk(this.children.list);
    return out;
  }

  /** A card thumbnail that zooms on hover or long-press and calls `onTap` on a tap. */
  private cardThumb(cx: number, cy: number, card: CardDef, scale: number, onTap?: () => void): Phaser.GameObjects.Image {
    const thumb = makeCardThumb(this, cx, cy, card, scale);
    thumb.setInteractive({ useHandCursor: !!onTap });
    this.zoom.attach(thumb, card);
    bindTapButton(this, thumb, () => onTap?.(), { card });
    return thumb;
  }

  /** The gold frame round a picked item; callers pair it with a word ("Selected", "In cart"), never colour alone. */
  private selectionFrame(): { frame: Phaser.GameObjects.Graphics; show(rect: { x: number; y: number; width: number; height: number } | null): void } {
    const frame = this.add.graphics();
    return {
      frame,
      show: (rect) => {
        frame.clear();
        if (!rect) return;
        frame.lineStyle(theme.outline.state, colorInt(theme.colors.goldHover), 1)
          .strokeRoundedRect(rect.x - 4, rect.y - 4, rect.width + 8, rect.height + 8, theme.radius.control);
      },
    };
  }

  // ------------------------------------------------------------------ character select

  private buildSelect(): void {
    const top = this.subtitle('Choose a heroine and set out after the Fallen Mandate.');
    const roster = storyRoster(this.story);
    if (!this.selectedCharacterId || !roster.some((r) => r.unlocked && r.character.id === this.selectedCharacterId)) {
      this.selectedCharacterId = roster.find((r) => r.unlocked)?.character.id ?? null;
    }
    const textW = 300 - 2 * theme.space(3);
    const gap = theme.space(2);
    const blocks = roster.map((entry) => {
      const name = this.text(0, 0, entry.character.name, theme.type.h2, theme.colors.heading, { display: true, wrap: textW });
      const colours = this.text(0, 0, colourWords(entry.character.colors), theme.type.label, theme.colors.muted, { wrap: textW });
      const lines: Phaser.GameObjects.Text[] = [name, colours];
      if (entry.unlocked) {
        const wins = this.story.wins[entry.character.id] ?? 0;
        const runs = this.story.countedRuns[entry.character.id] ?? 0;
        lines.push(this.text(0, 0, recordLine(wins, runs), theme.type.caption, theme.colors.body, { wrap: textW }));
      } else {
        const copy = unlockLines(entry);
        lines.push(this.text(0, 0, copy.condition, theme.type.caption, theme.colors.body, { wrap: textW }));
        lines.push(this.text(0, 0, copy.progress, theme.type.label, theme.colors.gold, { bold: true, wrap: textW }));
      }
      const height = lines.reduce((sum, t) => sum + t.height, 0) + gap * (lines.length - 1);
      return { entry, lines, height };
    });
    const layout = storySelectLayout(top, Math.max(...blocks.map((b) => b.height)), roster.length);
    const marks: { id: string; box: Phaser.GameObjects.Graphics; name: Phaser.GameObjects.Text; rect: typeof layout.tiles[number] }[] = [];
    const start = this.button('Start Run', 'primary', () => this.startSelected());
    const refresh = (): void => {
      for (const mark of marks) {
        const selected = mark.id === this.selectedCharacterId;
        mark.box.clear()
          .fillStyle(selected ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
          .fillRoundedRect(mark.rect.x, mark.rect.y, mark.rect.width, mark.rect.height, theme.radius.panel)
          .lineStyle(selected ? theme.outline.state : theme.control.borderWidth, selected ? colorInt(theme.colors.goldHover) : theme.graphics.panelStroke, 1)
          .strokeRoundedRect(mark.rect.x, mark.rect.y, mark.rect.width, mark.rect.height, theme.radius.panel);
        mark.name.setColor(selected ? theme.colors.gold : theme.colors.heading);
      }
      const chosen = this.selectedCharacterId ? storyCharacterById(this.selectedCharacterId) : undefined;
      start.setLabel(chosen ? `Start Run as ${shortName(chosen)}` : 'Start Run');
      start.setEnabled(!!chosen);
      this.placeFooter([start]);
    };
    blocks.forEach((block, i) => {
      const tile = layout.tiles[i];
      const box = this.add.graphics();
      const portraitRect = layout.portraits[i];
      const portrait = this.portrait(block.entry.character, portraitRect);
      if (!block.entry.unlocked) {
        portrait?.setAlpha(0.3);
        const lockSize = 40;
        this.add.image(portraitRect.x + portraitRect.width / 2, portraitRect.y + portraitRect.height / 2 - 14, bakeUiIcon(this, 'lock'))
          .setDisplaySize(lockSize, lockSize).setTint(colorInt(theme.colors.body));
        this.text(portraitRect.x + portraitRect.width / 2, portraitRect.y + portraitRect.height / 2 + 22, 'Locked', theme.type.label, theme.colors.body, { bold: true }).setOrigin(0.5);
      }
      let y = layout.texts[i].y;
      for (const line of block.lines) {
        // Measured before the plate existed: lift each line above it.
        this.children.bringToTop(line.setPosition(layout.texts[i].x, y));
        y += line.height + gap;
      }
      marks.push({ id: block.entry.character.id, box, name: block.lines[0], rect: tile });
      if (block.entry.unlocked) {
        const zone = this.add.zone(tile.x + tile.width / 2, tile.y + tile.height / 2, tile.width, tile.height).setInteractive({ useHandCursor: true });
        bindTapButton(this, zone, () => {
          this.selectedCharacterId = block.entry.character.id;
          refresh();
        });
      }
    });
    this.children.bringToTop(start.container);
    refresh();
  }

  /** A heroine's Darling art cover-fitted into `rect` (cropped, faces biased up). */
  private portrait(character: StoryCharacter, rect: { x: number; y: number; width: number; height: number }): Phaser.GameObjects.Image | null {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    try {
      return addPortraitArt(this, cx, cy, character.darlingId, (art) => {
        const scale = Math.max(rect.width / art.width, rect.height / art.height);
        art.setScale(scale);
        const cropW = Math.min(art.width, rect.width / scale);
        const cropH = Math.min(art.height, rect.height / scale);
        const cropX = (art.width - cropW) / 2;
        const cropY = Math.max(0, Math.min(art.height - cropH, (art.height - cropH) / 2 - (rect.height * 0.12) / scale));
        art.setCrop(cropX, cropY, cropW, cropH);
        art.setPosition(cx - (cropX + cropW / 2 - art.width / 2) * scale, cy - (cropY + cropH / 2 - art.height / 2) * scale);
      });
    } catch {
      return null;
    }
  }

  private startSelected(): void {
    const id = this.selectedCharacterId;
    if (!id) return;
    // UI may roll the seed; the run derives everything else from it.
    const seed = Math.floor(Math.random() * 2 ** 31);
    const result = startRun(this.story, id, seed, Date.now());
    if (!result.ok) return this.refused(result.reason);
    this.commit();
  }

  // ------------------------------------------------------------------ opening boon

  private buildBoon(run: StoryRun, offers: readonly StoryBoonId[]): void {
    const character = storyCharacterById(run.characterId);
    const top = this.subtitle(`${character ? shortName(character) : 'Your heroine'} sets out. Choose one opening boon for this run.`);
    const boons = offers.map((id) => STORY_BOONS.find((b) => b.id === id)!).filter(Boolean);
    const tileW = 320;
    const inset = theme.space(5);
    const textW = tileW - 2 * inset;
    let selected: StoryBoonId | null = null;
    const blocks = boons.map((boon) => {
      const name = this.text(0, 0, boon.name, theme.type.h2, theme.colors.heading, { display: true, wrap: textW });
      const body = this.text(0, 0, boon.text, theme.type.body, theme.colors.body, { wrap: textW });
      return { boon, name, body, height: name.height + theme.space(3) + body.height };
    });
    const tileH = Math.max(160, ...blocks.map((b) => b.height + 2 * inset));
    const rects = storyChoiceRow(blocks.length, tileW, tileH, top);
    const frame = this.selectionFrame();
    const take = this.button('Take Boon', 'primary', () => {
      if (!selected) return;
      if (selected === 'trim-two') {
        this.openDeckPicker(run, {
          title: 'Travel Light',
          note: 'Choose two cards to remove from your starter deck.',
          limit: 2,
          confirm: (ids) => `Remove ${ids.length} of 2`,
          onConfirm: (ids) => {
            if (ids.length !== 2) return;
            const result = chooseBoon(this.story, CARD_DB, 'trim-two', { removeCardIds: [ids[0], ids[1]] });
            if (!result.ok) return this.refused(result.reason);
            this.commit();
          },
        });
        return;
      }
      const result = chooseBoon(this.story, CARD_DB, selected);
      if (!result.ok) return this.refused(result.reason);
      this.commit();
    }, false);
    const plates: Phaser.GameObjects.Graphics[] = [];
    const refresh = (): void => {
      blocks.forEach((block, i) => {
        const on = block.boon.id === selected;
        const r = rects[i];
        plates[i].clear().fillStyle(on ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
          .fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel)
          .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, 1)
          .strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel);
        block.name.setColor(on ? theme.colors.gold : theme.colors.heading);
      });
      const i = blocks.findIndex((b) => b.boon.id === selected);
      frame.show(i >= 0 ? rects[i] : null);
      take.setEnabled(selected !== null);
      take.setLabel(selected === 'trim-two' ? 'Choose 2 Cards to Remove' : selected ? 'Take Boon' : 'Choose a Boon');
      this.placeFooter([take]);
    };
    blocks.forEach((block, i) => {
      const r = rects[i];
      plates.push(this.add.graphics());
      this.children.bringToTop(block.name);
      this.children.bringToTop(block.body);
      block.name.setPosition(r.x + inset, r.y + inset);
      block.body.setPosition(r.x + inset, block.name.y + block.name.height + theme.space(3));
      const zone = this.add.zone(r.x + r.width / 2, r.y + r.height / 2, r.width, r.height).setInteractive({ useHandCursor: true });
      bindTapButton(this, zone, () => {
        selected = block.boon.id;
        refresh();
      });
    });
    this.children.bringToTop(frame.frame);
    this.children.bringToTop(take.container);
    refresh();
  }

  // ------------------------------------------------------------------ card reward

  private buildReward(run: StoryRun, options: readonly string[], waiting: number): void {
    const after = waiting > 1 ? ` ${waiting - 1} more after this one.` : '';
    const top = this.subtitle(`Card reward: add one card to your run deck, or skip it.${after}`);
    let selected: string | null = null;
    const take = this.button('Choose a Card', 'primary', () => {
      if (!selected) return;
      const result = takeCardReward(this.story, selected);
      if (!result.ok) return this.refused(result.reason);
      this.commit();
    }, false);
    const skip = this.button('Skip', 'ghost', () => {
      const result = takeCardReward(this.story, null);
      if (!result.ok) return this.refused(result.reason);
      this.commit();
    });
    this.cardRow(options, top, (id) => {
      selected = selected === id ? null : id;
      take.setEnabled(selected !== null);
      take.setLabel(selected ? `Take ${def(CARD_DB, selected).name}` : 'Choose a Card');
      this.placeFooter([skip, take]);
      return selected;
    });
    this.deckLine(run, top);
    this.placeFooter([skip, take]);
  }

  /**
   * A centred row of offered cards with a caption band; a tap selects one
   * (`onPick` returns the selection now in force).
   */
  private cardRow(ids: readonly string[], top: number, onPick: (id: string) => string | null, caption?: (id: string, selected: boolean) => string): void {
    const band = storyCaptionBand(1);
    const scale = storyCardRowScale(ids.length, rowTop(top), band, 0.6);
    const size = cardSize(scale);
    const rects = storyChoiceRow(ids.length, size.width, size.height + band, rowTop(top));
    const frame = this.selectionFrame();
    const captions = ids.map((id, i) => this.text(rects[i].x + size.width / 2, rects[i].y + size.height + theme.space(2), caption?.(id, false) ?? '', theme.type.caption, theme.colors.muted).setOrigin(0.5, 0));
    ids.forEach((id, i) => {
      const r = rects[i];
      this.cardThumb(r.x + size.width / 2, r.y + size.height / 2, def(CARD_DB, id), scale, () => {
        const now = onPick(id);
        const at = now ? ids.indexOf(now) : -1;
        frame.show(at >= 0 ? { ...rects[at], height: size.height } : null);
        ids.forEach((other, j) => {
          const on = other === now;
          captions[j].setText(caption?.(other, on) ?? (on ? 'Selected' : '')).setColor(on ? theme.colors.gold : theme.colors.muted);
        });
      });
    });
    this.children.bringToTop(frame.frame);
  }

  /** The run's deck size and gold, one line at the top of the content band, with View Deck. */
  private deckLine(run: StoryRun, top: number): void {
    const line = this.text(theme.design.safeLeft, top + theme.control.minHitHeight / 2, `Run deck ${cardCount(run.deck.length)} · Run gold ${run.gold}`, theme.type.label, theme.colors.muted).setOrigin(0, 0.5);
    const view = themedButton(this, 0, top + theme.control.minHitHeight / 2, 'View Deck', { variant: 'ghost', size: 'sm', minWidth: 120, onTap: () => this.openDeckView(run) });
    const w = view.getMeasuredSize().hit.width;
    view.container.setX(theme.design.safeRight - w / 2);
    line.setWordWrapWidth(theme.design.safeWidth - w - theme.space(4));
  }

  // ------------------------------------------------------------------ act cleared

  private buildKeep(run: StoryRun): void {
    const top = this.subtitle('Act 1 cleared. Keep one card from your run deck: it joins your collection for good.');
    const pick: CardPick = { picked: [], limit: 1 };
    const keep = this.button('Choose a Card', 'primary', () => {
      const id = pick.picked[0];
      if (!id) return;
      const result = claimKeep(this.save, CARD_DB, id);
      if (!result.ok) return this.refused(result.reason);
      this.commit({ keptCardId: id });
    }, false);
    const area = { x: theme.design.safeLeft, y: top, width: theme.design.safeWidth, height: storyContentBottom() - top };
    this.cardGrid(area, keepOptions(run).map((id) => ({ id, count: 1 })), pick, () => {
      const id = pick.picked[0];
      keep.setEnabled(!!id);
      keep.setLabel(id ? `Keep ${def(CARD_DB, id).name}` : 'Choose a Card');
      this.placeFooter([keep]);
    });
    this.placeFooter([keep]);
  }

  private buildCleared(run: StoryRun): void {
    const character = storyCharacterById(run.characterId);
    const act = storyActByNumber(run.act);
    const boss = act ? avatarById(act.bossAvatarId) : null;
    const top = this.subtitle('Act 1 cleared.');
    const lines = [
      `${character ? shortName(character) : 'Your heroine'} defeated ${boss?.name ?? 'the boss'}.`,
      `Fights ${run.fightsPlayed} · Run deck ${cardCount(run.deck.length)}`,
      ...(this.keptCardId && CARD_DB[this.keptCardId] ? [`Kept for your collection: ${CARD_DB[this.keptCardId].name}`] : ['Your kept card is in your collection.']),
    ];
    const w = 640;
    const texts = lines.map((copy, i) => this.text(0, 0, copy, i === 0 ? theme.type.h2 : theme.type.body, i === 0 ? theme.colors.heading : theme.colors.body, { display: i === 0, wrap: w - 2 * theme.space(6) }).setOrigin(0.5, 0));
    const thumbH = this.keptCardId && CARD_DB[this.keptCardId] ? cardSize(0.4).height + theme.space(4) : 0;
    const gap = theme.space(3);
    const height = texts.reduce((s, t) => s + t.height, 0) + gap * (texts.length - 1) + thumbH + 2 * theme.space(6);
    const y0 = top + Math.max(0, (storyContentBottom() - top - height) / 2);
    panel(this, theme.design.centerX - w / 2, y0, w, height);
    let y = y0 + theme.space(6);
    for (const t of texts) {
      this.children.bringToTop(t.setPosition(theme.design.centerX, y));
      y += t.height + gap;
    }
    if (thumbH) this.cardThumb(theme.design.centerX, y + cardSize(0.4).height / 2, def(CARD_DB, this.keptCardId!), 0.4);
    const finish = this.button('Finish Run', 'primary', () => {
      const result = finishClearedRun(this.story);
      if (!result.ok) return this.refused(result.reason);
      this.commit();
    });
    this.placeFooter([finish]);
  }

  // ------------------------------------------------------------------ event, shop, rest

  private buildEvent(run: StoryRun, node: StoryNode): void {
    const act = storyActByNumber(run.act)!;
    const top = this.subtitle(`${EVENT_LINE} Take the gold or the card.`);
    const cardId = eventCard(run, node);
    const band = storyCaptionBand(1);
    const scale = storyCardRowScale(2, rowTop(top), band, 0.6);
    const size = cardSize(scale);
    const rects = storyChoiceRow(2, size.width, size.height + band, rowTop(top));
    let choice: 'gold' | 'card' | null = null;
    const frame = this.selectionFrame();
    const take = this.button('Choose One', 'primary', () => {
      if (!choice) return;
      const result = resolveEvent(this.story, choice);
      if (!result.ok) return this.refused(result.reason);
      this.commit();
    }, false);
    const goldLabel = eventGoldLabel(act.economy);
    const captions = [
      this.text(rects[0].x + size.width / 2, rects[0].y + size.height + theme.space(2), '', theme.type.caption, theme.colors.gold).setOrigin(0.5, 0),
      this.text(rects[1].x + size.width / 2, rects[1].y + size.height + theme.space(2), '', theme.type.caption, theme.colors.gold).setOrigin(0.5, 0),
    ];
    const pickChoice = (next: 'gold' | 'card'): void => {
      choice = choice === next ? null : next;
      const i = choice === 'gold' ? 0 : choice === 'card' ? 1 : -1;
      frame.show(i >= 0 ? { ...rects[i], height: size.height } : null);
      captions[0].setText(choice === 'gold' ? 'Selected' : '');
      captions[1].setText(choice === 'card' ? 'Selected' : '');
      take.setEnabled(choice !== null);
      take.setLabel(choice === 'gold' ? `Take ${goldLabel}` : choice === 'card' ? `Take ${def(CARD_DB, cardId).name}` : 'Choose One');
      this.placeFooter([take]);
    };
    // The gold: a plate the size of the card beside it.
    const g = rects[0];
    panel(this, g.x, g.y, size.width, size.height);
    this.add.image(g.x + size.width / 2, g.y + size.height / 2 - 24, bakeUiIcon(this, 'gold')).setDisplaySize(56, 56);
    this.text(g.x + size.width / 2, g.y + size.height / 2 + 24, goldLabel, theme.type.h2, theme.colors.gold, { display: true, wrap: size.width - 24 }).setOrigin(0.5, 0).setAlign('center');
    const goldZone = this.add.zone(g.x + size.width / 2, g.y + size.height / 2, size.width, size.height).setInteractive({ useHandCursor: true });
    bindTapButton(this, goldZone, () => pickChoice('gold'));
    this.cardThumb(rects[1].x + size.width / 2, rects[1].y + size.height / 2, def(CARD_DB, cardId), scale, () => pickChoice('card'));
    this.children.bringToTop(frame.frame);
    this.deckLine(run, top);
    this.placeFooter([take]);
  }

  private buildShop(run: StoryRun, node: StoryNode): void {
    const top = this.subtitle('A shop on the road. Buy cards for this run with run gold, then leave. Tap a card to add it to your cart.');
    const stock = shopStock(run, node, CARD_DB);
    let cart: string[] = [];
    const status = this.text(theme.design.centerX, top + theme.control.minHitHeight / 2, '', theme.type.label, theme.colors.gold, { bold: true }).setOrigin(0.5);
    const leave = this.button('Leave Shop', 'primary', () => {
      const result = resolveShop(this.story, CARD_DB, cart);
      if (!result.ok) return this.refused(result.reason);
      this.commit();
    });
    const band = storyCaptionBand(2);
    const scale = storyCardRowScale(stock.length, rowTop(top), band, 0.6);
    const size = cardSize(scale);
    const rects = storyChoiceRow(stock.length, size.width, size.height + band, rowTop(top));
    const frames = stock.map(() => this.selectionFrame());
    const captions = stock.map((_, i) => this.text(rects[i].x + size.width / 2, rects[i].y + size.height + theme.space(2), '', theme.type.caption, theme.colors.body, { wrap: size.width }).setOrigin(0.5, 0).setAlign('center'));
    const thumbs: Phaser.GameObjects.Image[] = [];
    const refresh = (): void => {
      const state = shopCartState(run.gold, stock, cart);
      stock.forEach((offer, i) => {
        const inCart = cart.includes(offer.cardId);
        const can = state.addable.has(offer.cardId);
        frames[i].show(inCart ? { ...rects[i], height: size.height } : null);
        thumbs[i]?.setAlpha(can ? 1 : 0.45);
        captions[i].setText(`${offer.price} gold${inCart ? ' · In cart' : can ? '' : ' · Not enough gold'}`)
          .setColor(inCart ? theme.colors.gold : can ? theme.colors.body : theme.colors.muted);
      });
      status.setText(`Run gold ${run.gold} · Cart ${state.spent} · Left ${state.left}`);
      leave.setLabel(cart.length ? `Buy ${cardCount(cart.length)} and Leave` : 'Leave Shop');
      this.placeFooter([leave]);
    };
    stock.forEach((offer, i) => {
      const r = rects[i];
      thumbs.push(this.cardThumb(r.x + size.width / 2, r.y + size.height / 2, def(CARD_DB, offer.cardId), scale, () => {
        if (cart.includes(offer.cardId)) cart = cart.filter((id) => id !== offer.cardId);
        else if (shopCartState(run.gold, stock, cart).addable.has(offer.cardId)) cart = [...cart, offer.cardId];
        refresh();
      }));
    });
    for (const f of frames) this.children.bringToTop(f.frame);
    refresh();
  }

  private buildRest(run: StoryRun, node: StoryNode): void {
    void node;
    const minDeck = storyActByNumber(run.act)?.economy.minDeckSize ?? 0;
    const canTrim = run.deck.length - 1 >= minDeck;
    const top = this.subtitle(canTrim
      ? 'You rest. You may remove one card from your run deck, or keep it whole.'
      : `You rest. Your run deck is at its smallest (${cardCount(minDeck)}), so no card can be removed.`);
    const pick: CardPick = { picked: [], limit: canTrim ? 1 : 0 };
    const rest = this.button('Rest', 'primary', () => {
      const result = resolveRest(this.story, pick.picked[0] ?? null);
      if (!result.ok) return this.refused(result.reason);
      this.commit();
    });
    const area = { x: theme.design.safeLeft, y: top, width: theme.design.safeWidth, height: storyContentBottom() - top };
    this.cardGrid(area, deckEntries(run.deck), pick, () => {
      const id = pick.picked[0];
      rest.setLabel(id ? `Remove ${def(CARD_DB, id).name} and Rest` : 'Rest');
      this.placeFooter([rest]);
    });
    this.placeFooter([rest]);
  }

  /**
   * A paged grid of run-deck cards inside `area`. With a pick limit above 0 a
   * tap picks (the frame and the caption mark it); otherwise the grid only
   * shows, with hover or long-press zoom. With `parent` (a modal's container)
   * everything it draws goes into that container and closes with it.
   */
  private cardGrid(
    area: { x: number; y: number; width: number; height: number },
    entries: readonly { id: string; count: number }[],
    pick: CardPick,
    onChange: () => void,
    deck: readonly string[] = entries.flatMap((e) => Array<string>(e.count).fill(e.id)),
    parent: Phaser.GameObjects.Container | null = null,
  ): void {
    const layout: StoryCardGridLayout = storyCardGridLayout(area, entries.length);
    const place = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      parent?.add(obj);
      return obj;
    };
    let page = 0;
    let drawn: Phaser.GameObjects.GameObject[] = [];
    let pageControl: ReturnType<typeof pager> | null = null;
    const render = (): void => {
      for (const obj of drawn) obj.destroy();
      drawn = [];
      const frames: Phaser.GameObjects.Graphics[] = [];
      const shown = entries.slice(page * layout.pageSize, (page + 1) * layout.pageSize);
      shown.forEach((entry, i) => {
        const rect = layout.cell(i);
        const captionRect = layout.caption(i);
        const picked = pick.picked.filter((id) => id === entry.id).length;
        const copies = entry.count > 1 ? `${entry.count} copies` : '';
        const caption = picked > 1 ? `Selected ×${picked}` : picked === 1 ? 'Selected' : copies;
        const thumb = place(this.cardThumb(rect.x + rect.width / 2, rect.y + rect.height / 2, def(CARD_DB, entry.id), layout.scale,
          pick.limit > 0 ? () => {
            pick.picked = togglePick(pick.picked, entry.id, pick.limit, deck);
            onChange();
            render();
          } : undefined));
        const label = place(this.text(captionRect.x + captionRect.width / 2, captionRect.y, caption, theme.type.caption,
          picked > 0 ? theme.colors.gold : theme.colors.muted).setOrigin(0.5, 0));
        drawn.push(thumb, label);
        if (picked > 0) {
          const f = this.selectionFrame();
          f.show(rect);
          frames.push(f.frame);
        }
      });
      for (const f of frames) {
        place(f);
        drawn.push(f);
      }
      pageControl?.refresh(page, layout.pages);
    };
    if (layout.pages > 1) {
      pageControl = pager(this, theme.design.centerX - 44, layout.pagerY, 0, layout.pages, (next) => {
        page = next;
        render();
      });
      place(pageControl.container);
    }
    render();
  }

  /** The run deck, view only, in a modal. */
  private openDeckView(run: StoryRun): void {
    this.openDeckPicker(run, { title: 'Run Deck', note: `${cardCount(run.deck.length)}. Hover or hold a card to read it.`, limit: 0 });
  }

  /** The run deck in a modal; with a limit above 0, pick exactly that many and confirm. */
  private openDeckPicker(run: StoryRun, opts: { title: string; note: string; limit: number; confirm?: (ids: string[]) => string; onConfirm?: (ids: string[]) => void }): void {
    const width = theme.design.safeWidth - theme.space(8);
    const height = theme.design.safeHeight;
    this.guard.open(this.interactiveTargets());
    const shell = modalShell(this, {
      width,
      height,
      titleTrackHeight: Math.max(theme.control.minHitHeight, Math.ceil(theme.type.h1 * 4 / 3)),
      footerTrackHeight: opts.limit > 0 ? theme.control.minHitHeight : undefined,
      dismissal: 'dismissible',
      onClose: () => {
        this.zoom.cancel();
        this.guard.close();
      },
    });
    const c = shell.container;
    c.add(this.text(shell.tracks.titleTrack.x, shell.tracks.titleTrack.y, opts.title, theme.type.h1, theme.colors.heading, { display: true }));
    const content = shell.tracks.contentBounds;
    const note = this.text(content.x, content.y, opts.note, theme.type.label, theme.colors.muted, { wrap: content.width });
    c.add(note);
    const gridArea = { x: content.x, y: content.y + note.height + theme.space(3), width: content.width, height: content.height - note.height - theme.space(3) };
    const pick: CardPick = { picked: [], limit: opts.limit };
    let confirm: ThemedButton | null = null;
    this.cardGrid(gridArea, deckEntries(run.deck), pick, () => {
      if (!confirm || !opts.confirm) return;
      confirm.setEnabled(pick.picked.length === opts.limit);
      confirm.setLabel(opts.confirm(pick.picked));
    }, run.deck, c);
    if (opts.limit > 0 && opts.onConfirm) {
      const footer = shell.tracks.footerTrack;
      confirm = themedButton(this, footer.x + footer.width / 2, footer.y + footer.height / 2, opts.confirm?.([]) ?? 'Confirm', {
        variant: 'primary', minWidth: PRIMARY_MIN_W, enabled: false,
        onTap: () => {
          const ids = [...pick.picked];
          shell.close();
          opts.onConfirm?.(ids);
        },
      });
      c.add(confirm.container);
    }
  }

  // ------------------------------------------------------------------ the map

  private buildMap(run: StoryRun, openDuel: StoryNode | null): void {
    const character = storyCharacterById(run.characterId);
    const map = runMap(run);
    const legal = openDuel ? [] : legalNextNodes(this.story);
    const top = this.subtitle(openDuel
      ? 'Your next duel is waiting.'
      : run.nodeId === null ? 'Choose where to begin. The path runs left to right, to the boss.' : 'Choose your next stop.');
    const geo = storyMapLayout(map.floors, top);
    const path = new Set(run.visitedNodeIds);
    const legalIds = new Set(legal.map((n) => n.id));
    let selected: StoryNode | null = openDuel ?? (legal.length === 1 ? legal[0] : null);

    // Edges first, under the nodes.
    const edges = this.add.graphics();
    for (const node of storyMapNodes(map)) {
      const from = geo.nodes.get(node.id)!;
      for (const nextId of node.nextNodeIds) {
        const to = geo.nodes.get(nextId)!;
        const walked = path.has(node.id) && path.has(nextId);
        const open = node.id === run.nodeId && legalIds.has(nextId);
        edges.lineStyle(walked ? 4 : open ? 3 : 2, walked || open ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, walked || open ? 1 : 0.9)
          .lineBetween(from.x + from.width, from.y + from.height / 2, to.x, to.y + to.height / 2);
      }
    }

    const plates = new Map<string, Phaser.GameObjects.Graphics>();
    const drawNode = (node: StoryNode): void => {
      const r = geo.nodes.get(node.id)!;
      const isCurrent = node.id === run.nodeId;
      const visited = path.has(node.id);
      const isLegal = legalIds.has(node.id);
      const isSelected = selected?.id === node.id;
      const g = plates.get(node.id)!;
      const stroke = isSelected ? theme.outline.state + 1 : isCurrent ? theme.outline.state : isLegal ? 2 : theme.control.borderWidth;
      const strokeColour = isSelected || isCurrent ? colorInt(theme.colors.goldHover) : isLegal ? colorInt(theme.colors.gold) : theme.graphics.panelStroke;
      g.clear()
        .fillStyle(isCurrent || visited || isSelected ? theme.graphics.rowFillActive : theme.graphics.rowFill, 1)
        .fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control)
        .lineStyle(stroke, strokeColour, 1)
        .strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control);
    };
    for (const node of storyMapNodes(map)) {
      const r = geo.nodes.get(node.id)!;
      const plate = this.add.graphics();
      plates.set(node.id, plate);
      const reachable = legalIds.has(node.id) || path.has(node.id) || node.id === run.nodeId;
      const label = this.text(r.x + r.width / 2, r.y + r.height / 2, NODE_KIND_LABEL[node.kind], theme.type.label,
        node.kind === 'boss' ? theme.colors.gold : node.kind === 'elite' ? theme.colors.danger : theme.colors.heading, { bold: true }).setOrigin(0.5);
      const faded = !reachable && run.nodeId !== null && node.floor <= (storyNodeFloor(map, run.nodeId) ?? 0);
      plate.setAlpha(faded ? 0.45 : 1);
      label.setAlpha(faded ? 0.5 : 1);
      const under = [legalIds.has(node.id) ? 'Next' : '', node.kind === 'boss' && node.avatarId ? avatarById(node.avatarId).name : '']
        .filter(Boolean).join(': ');
      if (under) this.text(r.x + r.width / 2, r.y + r.height + theme.space(1), under, theme.type.caption, theme.colors.gold).setOrigin(0.5, 0);
      // Words, not only the border colour, mark where the run stands and where it can go.
      if (node.id === run.nodeId) {
        this.text(r.x + r.width / 2, r.y - theme.space(1), 'You', theme.type.caption, theme.colors.gold, { bold: true }).setOrigin(0.5, 1);
      }
      if (legalIds.has(node.id)) {
        const zone = this.add.zone(r.x + r.width / 2, r.y + r.height / 2, r.width, r.height).setInteractive({ useHandCursor: true });
        bindTapButton(this, zone, () => {
          const was = selected;
          selected = node;
          if (was) drawNode(was);
          drawNode(node);
          refreshPanel();
        });
      }
      drawNode(node);
    }

    // The run panel.
    const p = geo.panel;
    panel(this, p.x, p.y, p.width, p.height);
    const pl = storyMapPanelLayout(p);
    const thumbScale = 0.25;
    const thumb = cardSize(thumbScale);
    if (character) this.cardThumb(pl.info.x + thumb.width / 2, pl.info.y + thumb.height / 2, def(CARD_DB, character.darlingId), thumbScale);
    const infoX = pl.info.x + thumb.width + theme.space(3);
    const infoW = pl.info.x + pl.info.width - infoX;
    const floorNow = run.nodeId ? storyNodeFloor(map, run.nodeId) ?? 0 : 0;
    const infoLines = [
      this.text(infoX, 0, character ? shortName(character) : '', theme.type.h2, theme.colors.heading, { display: true, wrap: infoW }),
      this.text(infoX, 0, `Run gold ${run.gold}`, theme.type.label, theme.colors.gold, { bold: true, wrap: infoW }),
      this.text(infoX, 0, `Deck ${cardCount(run.deck.length)}`, theme.type.label, theme.colors.body, { wrap: infoW }),
      this.text(infoX, 0, `Fights ${run.fightsPlayed}`, theme.type.label, theme.colors.body, { wrap: infoW }),
      this.text(infoX, 0, floorNow > 0 ? `Floor ${floorNow} of ${map.floors.length}` : `Act ${run.act} · ${map.floors.length} floors`, theme.type.label, theme.colors.body, { wrap: infoW }),
    ];
    let iy = pl.info.y;
    for (const t of infoLines) {
      t.setY(iy);
      iy += t.height + theme.space(1);
    }
    themedButton(this, p.x + p.width / 2, pl.viewDeckY, 'View Deck', { variant: 'ghost', minWidth: pl.buttonWidth, onTap: () => this.openDeckView(run) });
    const detailName = this.text(pl.detail.x, pl.detail.y, '', theme.type.label, theme.colors.heading, { bold: true, wrap: pl.detail.width });
    const detailBody = this.text(pl.detail.x, pl.detail.y, '', theme.type.caption, theme.colors.body, { wrap: pl.detail.width });
    const go = themedButton(this, p.x + p.width / 2, pl.primaryY, 'Choose a Stop', {
      variant: 'primary', minWidth: pl.buttonWidth, maxTextWidth: pl.buttonWidth - theme.space(4), enabled: false,
      onTap: () => this.goTo(run, selected, openDuel !== null),
    });
    const note = this.text(pl.note.x, pl.note.y, abandonNote(run, false), theme.type.caption, theme.colors.muted, { wrap: pl.note.width });
    let armed = false;
    let disarm: Phaser.Time.TimerEvent | null = null;
    const abandon = themedButton(this, p.x + p.width / 2, pl.abandonY, 'Abandon Run', {
      variant: 'danger', minWidth: pl.buttonWidth,
      onTap: (pointer) => {
        if (this.save.settings.confirmDestructive && !armed) {
          armed = true;
          abandon.setLabel(`${pointer?.wasTouch ?? isTouchDevice() ? 'Tap' : 'Click'} again to abandon`);
          note.setText(abandonNote(run, true)).setColor(theme.colors.danger);
          disarm?.remove(false);
          disarm = this.time.delayedCall(ABANDON_ARM_MS, () => {
            disarm = null;
            armed = false;
            if (abandon.container.active) abandon.setLabel('Abandon Run');
            if (note.active) note.setText(abandonNote(run, false)).setColor(theme.colors.muted);
          });
          return;
        }
        disarm?.remove(false);
        disarm = null;
        const result = abandonRun(this.story);
        if (!result.ok) return this.refused(result.reason);
        this.commit();
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => disarm?.remove(false));

    const refreshPanel = (): void => {
      if (!selected) {
        detailName.setText('No stop chosen');
        detailBody.setText('Tap a stop marked Next to choose it.');
      } else {
        const avatar = selected.avatarId ? avatarById(selected.avatarId) : null;
        detailName.setText(avatar ? `${NODE_KIND_LABEL[selected.kind]}: ${avatar.name}` : NODE_KIND_LABEL[selected.kind]);
        detailBody.setText(avatar ? `${avatar.title}. ${nodeSummary(selected.kind)}` : nodeSummary(selected.kind));
      }
      detailBody.setY(detailName.y + detailName.height + theme.space(1));
      go.setEnabled(!!selected);
      go.setLabel(selected ? nodeActionLabel(selected.kind) : 'Choose a Stop');
    };
    refreshPanel();
  }

  /** Enter the chosen node (a duel launches at once) or re-launch the open duel. */
  private goTo(run: StoryRun, node: StoryNode | null, alreadyEntered: boolean): void {
    if (!node) return;
    if (!alreadyEntered) {
      const result = enterNode(this.story, node.id);
      if (!result.ok) return this.refused(result.reason);
    }
    if (!isDuelNode(node)) return this.commit();
    if (this.fixtureSave) return this.commit();
    // Saved at the node boundary first, so the run resumes here if the duel never starts.
    Services.save.flush();
    this.scene.start('Duel', { story: { runId: run.runId, nodeId: node.id } });
  }
}

/** A card row starts under the content band's first line (the deck line, the shop's gold line). */
function rowTop(top: number): number {
  return top + theme.control.minHitHeight + theme.space(3);
}

function storyNodeFloor(map: ReturnType<typeof runMap>, id: string): number | null {
  for (const floor of map.floors) for (const node of floor) if (node.id === id) return node.floor;
  return null;
}
