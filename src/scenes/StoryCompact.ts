import Phaser from 'phaser';
import { CARD_DB } from '../data/catalog';
import { STORY_BOONS } from '../data/story/act1';
import { storyCharacterById } from '../data/story/characters';
import { storyAvatarById } from '../data/story/opponents';
import type { StoryBoonId, StoryCharacter, StoryLine } from '../data/story/types';
import { def, type CardDef } from '../engine/types';
import type { SaveData } from '../meta/SaveManager';
import { Services } from '../meta/services';
import {
  abandonRun,
  chooseBoon,
  claimKeep,
  dailyBestLoop,
  dailyEndlessSeed,
  endlessDateKey,
  enterEndless,
  isEndlessOpen,
  keepOptions,
  legalNextNodes,
  mapKeyDue,
  markMapKeySeen,
  nextEndlessLoop,
  resolveRest,
  resolveShop,
  shopStock,
  startEndlessRun,
  startRun,
  takeCardReward,
} from '../meta/story/StoryProgress';
import { endingSceneFor, endlessIntroSceneDue } from '../meta/story/storyEvents';
import { ENDLESS_HEAD_START_GOLD, ENDLESS_HEAD_START_PICKS } from '../data/story/endless';
import { finishClearedRun, storyRoster } from '../meta/story/storyFlow';
import { storyMapNodes, type StoryNode } from '../meta/story/storyMap';
import { runMap, storyActByNumber, type StoryRun, type StoryState } from '../meta/story/storyState';
import { prefersReducedMotion } from '../platform/clientProfile';
import { bindTapButton, isTouchDevice } from '../platform/gestures';
import { currentAccessibility } from '../ui/accessibility';
import { awaitArt } from '../ui/artGate';
import { CARD_H, CARD_W, CardView } from '../ui/CardView';
import { COMPACT, type CompactShell } from '../ui/compactLayout';
import { dutyRowPips } from '../ui/duelPresentation';
import { COMPACT_DRAG_SLOP, compactButton, compactDialog, compactHeader, compactScrim, compactSegments, coverFitImage, type CompactButton } from '../ui/compactWidgets';
import type { Rect } from '../ui/layout';
import { limitedTileGrid } from '../ui/limitedBuilderCompact';
import { ensureNumeralPip, pipsFor } from '../ui/ManaSymbols';
import { renderManaText } from '../ui/ManaText';
import { bindMenuScroll } from '../ui/menuScroll';
import { fitMenuListName } from '../ui/menuText';
import { ModalGuard } from '../ui/Modal';
import { PackTile } from '../ui/PackTile';
import { addPortraitArt } from '../ui/portraitArt';
import { rulesText, typeLine } from '../ui/rulesText';
import { sceneStage } from '../ui/SceneBackdrop';
import { STORY_COMPACT, storyCardRow, storyMapPlan, storySceneLayout, storyScreenLayout, storyTiles, type StoryScreenLayout } from '../ui/storyCompact';
import { addStopMedallion, bakeStopGlow, reachableNodeIds, stopFace, trailDots, type StopFace } from '../ui/storyMapStops';
import {
  abandonNote,
  cardCount,
  colourWords,
  dailyBestLine,
  deckEntries,
  ENDLESS_GO_ON_NOTE,
  ENDLESS_SUBTITLE,
  endlessBestLine,
  endlessSeedCopy,
  endlessStartNote,
  loopsCleared,
  MAP_KEY_CLOSE,
  MAP_KEY_TITLE,
  mapKeyRows,
  mapStopStanding,
  NODE_KIND_LABEL,
  nodeActionLabel,
  nodeSummary,
  recordLine,
  shopCartState,
  shortName,
  stageLabel,
  STORY_SELECT_MODES,
  togglePick,
  unlockLines,
  type StorySelectMode,
} from '../ui/storyPresentation';
import { colorInt, theme } from '../ui/theme';
import { modalShell, panel, sceneHasOpenModal, type ModalShell } from '../ui/themeWidgets';
import { Toast } from '../ui/Toast';
import { ellipsizeText } from '../ui/textFit';
import { backlogEntries, nextLineIndex, portraitArtId, storyLineView, type StoryLineView, type StoryPortrait } from '../ui/storyDialogue';
import { DEPTH, storyTextureKey, type ChoiceRowSpec, type DialogueOptions, type StoryStage } from './StoryDialogue';
import { bakeUiIcon, type UiIconName } from '../ui/uiIcons';

/** What the scene keeps of a compact dialogue: Continue, Skip, and putting it away. */
export interface StoryDialogueHandle {
  advance(): void;
  skip(): void;
  destroy(): void;
}

/** How long an armed Abandon waits for its second press (the desktop's own). */
const ABANDON_ARM_MS = 4000;
/** A hold this long on a card opens it in full. */
const HOLD_MS = 450;

/** What the compact screens need from the Story scene. */
export interface StoryCompactHost {
  readonly scene: Phaser.Scene;
  readonly save: SaveData;
  readonly story: StoryState;
  /** A dev fixture: never saved. */
  readonly fixture: boolean;
  readonly guard: ModalGuard;
  readonly keptCardId: string | null;
  selectedCharacterId: string | null;
  /** Character select's mode (Act 1, endless or the daily); kept by the scene across restarts. */
  selectMode: StorySelectMode;
  /** The endless screen's seed: the shared daily (default) or a random one. */
  endlessDaily: boolean;
  commit(data?: { keptCardId?: string; storyScene?: { id: string; then: 'screen' | 'duel' } }): void;
  leave(): void;
  goTo(run: StoryRun, node: StoryNode | null, alreadyEntered: boolean): void;
  /** Where a refused meta call is written. */
  setNotice(line: Phaser.GameObjects.Text | null): void;
  refused(reason: string): void;
  interactiveTargets(): Phaser.GameObjects.GameObject[];
  bossPortraitKey(avatarName: string | null, face: StopFace, d: number, highContrast: boolean): string | null;
}

interface TextOpts {
  display?: boolean;
  bold?: boolean;
  wrap?: number;
  align?: 'left' | 'center' | 'right';
}

/** Story's boons as the boon tiles draw them. */
const BOON_ICON: Readonly<Record<StoryBoonId, UiIconName>> = {
  'run-gold': 'gold',
  'sr-card': 'cards',
  'trim-two': 'deck',
  'first-fight-reward': 'trophy',
};

/** How a card is read in full: a hold on touch, a right-click with a mouse. */
function readHint(): string {
  return isTouchDevice() ? 'hold one to read it in full' : 'right-click one to read it in full';
}

/** "Got It" → "Got it": the compact screens write their labels in sentence case. */
function sentenceCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

/** "Guan Yu, Saint of War" → "Saint of War" (a name without a title gives ''). */
function heroineTitle(character: Pick<StoryCharacter, 'name'>): string {
  const at = character.name.indexOf(',');
  return at < 0 ? '' : character.name.slice(at + 1).trim();
}

/**
 * Story Mode's compact screens (docs/plan-mobile-overhaul.md, wave 4; frames
 * N-31 to N-37): the heroine pick, the opening boon, card rewards, the shop,
 * rest, the keep, the act-cleared summary and the map, in the Version C shell
 * on the phone and the desktop alike. The run logic stays in the meta
 * functions; the scene's commit, refusal and duel launch are the host's.
 */
export class StoryCompact {
  private readonly type = theme.compactType;
  private notice: Phaser.GameObjects.Text | null = null;
  private sheet: ModalShell | null = null;
  private inspecting: ModalShell | null = null;
  /** The card in full keeps its own guard, so closing it leaves a sheet under it guarded. */
  private readonly inspectGuard = new ModalGuard();

  constructor(private readonly host: StoryCompactHost) {}

  private get scene(): Phaser.Scene {
    return this.host.scene;
  }

  private get stage(): ReturnType<typeof sceneStage> {
    return sceneStage(this.scene);
  }

  private layout(): StoryScreenLayout {
    return storyScreenLayout(this.stage.content);
  }

  // ------------------------------------------------------------------ shared pieces

  text(x: number, y: number, copy: string, size: number, color: string, opts: TextOpts = {}): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, copy, {
      fontFamily: opts.display ? theme.fonts.display : theme.fonts.ui,
      fontSize: `${size}px`,
      color,
      ...(opts.bold ? { fontStyle: theme.weight.w700 } : {}),
      ...(opts.wrap ? { wordWrap: { width: opts.wrap, useAdvancedWrap: true } } : {}),
      ...(opts.align ? { align: opts.align } : {}),
    });
  }

  /**
   * A card's rules with real mana and tap pips (CardView's look, not "{T}"),
   * cut to `room` px. Returns the box holding them and the drawn height.
   */
  private rules(x: number, y: number, raw: string, size: number, color: string, wrap: number, room: number): { box: Phaser.GameObjects.Container; height: number } | null {
    const box = this.scene.add.container(0, 0);
    const { raw: pipped, tapPips } = dutyRowPips(raw);
    const r = renderManaText(this.scene, box, x, y, pipped, { fontFamily: theme.fonts.ui, fontSize: `${size}px`, color, wordWrap: { width: wrap, useAdvancedWrap: true } });
    for (const index of tapPips) r.pips[index]?.setTexture('pip-T');
    const lineH = r.text.height / Math.max(1, r.text.getWrappedText().length);
    const lines = Math.floor(room / lineH);
    if (lines < 1) {
      box.destroy();
      return null;
    }
    if (lines < r.text.getWrappedText().length) r.text.setMaxLines(lines);
    r.reflow();
    return { box, height: r.text.height };
  }

  /** The top bar: back, the title over its line, and the run's gold and deck size when given. */
  header(layout: { shell: CompactShell }, title: string, subtitle: string, run: StoryRun | null): void {
    const shell = layout.shell;
    compactHeader(this.scene, shell, { title, subtitle, gold: run?.gold, onBack: () => this.host.leave() });
    if (!run) return;
    // The deck chip sits left of the gold pill; the title already stops short of the right slot.
    const pill = 38;
    const cy = shell.right.y + shell.right.height / 2;
    const count = this.text(0, cy, String(run.deck.length), this.type.h2, theme.colors.heading, { bold: true }).setOrigin(0, 0.5);
    const icon = Math.round(this.type.h2 * 1.05);
    const w = 12 + icon + 6 + count.width + 12;
    const goldW = this.goldPillWidth(run.gold);
    const right = shell.right.x + shell.right.width - goldW - COMPACT.gap;
    const left = right - w;
    this.scene.add.graphics()
      .fillStyle(theme.graphics.panelFill, theme.alpha.panel)
      .fillRoundedRect(left, cy - pill / 2, w, pill, theme.radius.control)
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(left, cy - pill / 2, w, pill, theme.radius.control);
    this.scene.children.bringToTop(count);
    this.scene.add.image(left + 12 + icon / 2, cy, bakeUiIcon(this.scene, 'deck')).setDisplaySize(icon, icon).setTint(colorInt(theme.colors.body));
    count.setX(left + 12 + icon + 6);
  }

  /** The gold pill's width as compactGoldPill draws it (padding, coin, gap, amount). */
  private goldPillWidth(gold: number): number {
    const probe = this.text(0, 0, gold.toLocaleString('en-US'), this.type.h2, theme.colors.gold, { bold: true });
    const w = 14 + Math.round(this.type.h2 * 1.15) + 8 + probe.width + 14;
    probe.destroy();
    return w;
  }

  /** The toasts' rail over the command column. */
  toasts(): void {
    const column = this.layout().shell.column;
    new Toast(this.scene, { modalGuard: this.host.guard, ...(column ? { rail: { right: column.x + column.width, top: column.y, width: column.width } } : {}) });
  }

  /** A gold eyebrow ("YOUR PICK") at `y`; returns the line under it. */
  private eyebrow(x: number, y: number, copy: string, wrap: number): number {
    const t = this.text(x, y, copy.toUpperCase(), this.type.label, theme.colors.gold, { bold: true, wrap });
    t.setLetterSpacing(1);
    return y + t.height + 6;
  }

  /** The refusal line, at the foot of the column's text. */
  private noticeLine(body: Rect): Phaser.GameObjects.Text {
    const line = this.text(body.x, body.y + body.height, '', this.type.label, theme.colors.danger, { bold: true, wrap: body.width }).setOrigin(0, 1);
    this.notice = line;
    this.host.setNotice(line);
    return line;
  }

  private panelAt(r: Rect, alpha: number = theme.alpha.panel): Phaser.GameObjects.Graphics {
    return panel(this.scene, r.x, r.y, r.width, r.height, { alpha });
  }

  /** A card's cost pips in a row from (x, cy); returns the row's right edge. */
  private pips(card: CardDef, x: number, cy: number, size: number, into?: Phaser.GameObjects.Container): number {
    let px = x;
    for (const spec of card.cost ? pipsFor(card.cost) : []) {
      const key = spec.number !== undefined ? ensureNumeralPip(this.scene, spec.number) : spec.texture;
      if (!this.scene.textures.exists(key)) continue;
      const pip = this.scene.add.image(px + size / 2, cy, key).setDisplaySize(size, size);
      into?.add(pip);
      px += size + 3;
    }
    return px;
  }

  /**
   * A card in the column: its name, its cost beside its type line, then its
   * rules text cut to the room left above `bottom`, then `extra` lines.
   * Returns everything drawn, so a re-selection can clear it.
   */
  private cardDetail(body: Rect, eyebrow: string, card: CardDef, extra: { copy: string; color: string }[], bottom: number): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [];
    const before = new Set(this.scene.children.list);
    let y = this.eyebrow(body.x, body.y, eyebrow, body.width);
    const name = this.text(body.x, y, card.name, this.type.h1, theme.colors.heading, { display: true, bold: true, wrap: body.width });
    y += name.height + 6;
    const pip = Math.round(this.type.body * 1.2);
    const pipsRight = this.pips(card, body.x, y + pip / 2, pip);
    const lineX = pipsRight > body.x ? pipsRight + 4 : body.x;
    const kind = this.text(lineX, y, typeLine(card), this.type.label, theme.colors.body, { wrap: Math.max(40, body.x + body.width - lineX) });
    kind.setY(y + Math.max(0, (pip - kind.height) / 2));
    y += Math.max(pip, kind.height) + 6;
    const extras = extra.map((e) => this.text(body.x, 0, e.copy, this.type.label, e.color, { wrap: body.width }));
    const extrasH = extras.reduce((s, t) => s + t.height + 4, 0);
    const rules = rulesText(card);
    if (rules) {
      const r = this.rules(body.x, y, rules, this.type.label, theme.colors.muted, body.width, bottom - extrasH - y);
      if (r) y += r.height + 6;
    }
    for (const t of extras) {
      t.setY(y);
      y += t.height + 4;
    }
    for (const obj of this.scene.children.list) if (!before.has(obj)) out.push(obj);
    return out;
  }

  /**
   * A grid or row of card tiles under one zone: a tap calls `onTap`, a hold
   * (or a right-click) opens the card in full. `indexAt` maps a pointer to a tile.
   */
  private tileInput(area: Rect, indexAt: (p: Phaser.Input.Pointer) => number, ids: readonly string[], onTap: (index: number) => void, parent: Phaser.GameObjects.Container | null = null): void {
    const zone = this.scene.add.zone(area.x + area.width / 2, area.y + area.height / 2, area.width, area.height).setInteractive({ useHandCursor: true });
    parent?.add(zone);
    const blocked = (): boolean => this.inspecting !== null;
    let hold: Phaser.Time.TimerEvent | null = null;
    let held = false;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      held = false;
      hold?.remove(false);
      if (blocked() || p.rightButtonDown()) return;
      const index = indexAt(p);
      if (index < 0) return;
      hold = this.scene.time.delayedCall(HOLD_MS, () => {
        hold = null;
        if (Math.abs(p.y - p.downY) > COMPACT_DRAG_SLOP) return;
        held = true;
        this.inspect(ids[index]);
      });
    });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      hold?.remove(false);
      hold = null;
      if (blocked() || held || Math.abs(p.upY - p.downY) > COMPACT_DRAG_SLOP) return;
      const index = indexAt(p);
      if (index < 0) return;
      if (p.rightButtonReleased()) return this.inspect(ids[index]);
      onTap(index);
    });
    zone.on('pointerout', () => {
      hold?.remove(false);
      hold = null;
    });
  }

  /** A selected tile's mark: a gold rim and a check disc at its top right. */
  private markTile(g: Phaser.GameObjects.Graphics, r: Rect | null, check = true, inside = false): void {
    if (!inside) g.clear();
    if (!r) return;
    const gold = colorInt(theme.colors.gold);
    // Inside a scrolling grid the mark stays within the tile, clear of the scroll's clip.
    const out = inside ? -1.5 : 2;
    g.lineStyle(3, gold, 1).strokeRoundedRect(r.x - out, r.y - out, r.width + 2 * out, r.height + 2 * out, theme.radius.panel + out);
    if (!check) return;
    const d = Math.max(18, Math.round(r.width * 0.22));
    const cx = inside ? r.x + r.width - d * 0.62 : r.x + r.width - d * 0.35;
    const cy = inside ? r.y + d * 0.62 : r.y + d * 0.35;
    g.fillStyle(gold, 1).fillCircle(cx, cy, d / 2);
    g.lineStyle(2.5, colorInt(theme.colors.onGold), 1)
      .beginPath().moveTo(cx - d * 0.22, cy).lineTo(cx - d * 0.05, cy + d * 0.18).lineTo(cx + d * 0.24, cy - d * 0.16).strokePath();
  }

  // ------------------------------------------------------------------ the card in full

  /** A card held or right-clicked: the card over the screen, its name and rules in the column, Close. */
  inspect(id: string): void {
    if (this.inspecting) return;
    const card = def(CARD_DB, id);
    const stage = this.stage;
    const { shell: frame, column } = this.layout();
    const type = this.type;
    const shell = modalShell(this.scene, {
      width: stage.width, height: stage.height, x: stage.width / 2, y: stage.height / 2,
      dimAlpha: 0.84, depth: theme.depth.inspect, dismissal: 'dismissible',
      onClose: () => {
        this.inspecting = null;
        this.inspectGuard.close();
      },
    });
    shell.panel.clear();
    this.inspecting = shell;
    this.inspectGuard.open(this.host.interactiveTargets());
    const c = shell.container;
    c.setData('a11ySurface', { x: 0, y: 0, width: stage.width, height: stage.height }).setData('a11yPanel', stage.content);
    awaitArt(c, [id], { onReady: () => undefined });
    const main: Rect = { x: frame.main.x, y: stage.content.y, width: frame.main.width, height: stage.content.height };
    const scale = Math.min(main.height / CARD_H, main.width / CARD_W);
    c.add(new CardView(this.scene, main.x + main.width / 2, main.y + main.height / 2).setScale(scale).setCard(card, { fx: 'full', artTier: 'primary' }));
    const col = column.body;
    const name = this.text(col.x, stage.content.y, card.name, type.h1, theme.colors.gold, { display: true, bold: true, wrap: col.width });
    c.add(name);
    const kind = this.text(col.x, name.y + name.height + 6, typeLine(card), type.body, theme.colors.heading, { wrap: col.width });
    c.add(kind);
    const rules = rulesText(card);
    if (rules) {
      const y = kind.y + kind.height + 8;
      const r = this.rules(col.x, y, rules, type.label, theme.colors.body, col.width, column.foot.y - COMPACT.gap - y);
      if (r) c.add(r.box);
    }
    c.add(compactButton(this.scene, column.foot, 'Close', { onTap: () => shell.close() }).container);
    if (shell.closeButton) shell.closeButton.container.setVisible(false);
  }

  private opened(shell: ModalShell): void {
    this.sheet = shell;
    this.host.guard.open(this.host.interactiveTargets());
  }

  private closed(shell: ModalShell): void {
    if (this.sheet === shell) this.sheet = null;
    this.host.guard.close();
  }

  /**
   * A sheet over the whole content box (the run deck, the map key): its own
   * shell, its title in the top bar, Close at the top right.
   */
  private fullSheet(title: string, subtitle: string, onClose?: () => void): { shell: ModalShell; layout: StoryScreenLayout } {
    const stage = this.stage;
    const shell = modalShell(this.scene, {
      width: stage.width, height: stage.height, x: stage.width / 2, y: stage.height / 2,
      dimAlpha: 0.9, depth: theme.depth.modal, dismissal: 'dismissible',
      onClose: () => {
        this.closed(shell);
        onClose?.();
      },
    });
    shell.panel.clear();
    this.opened(shell);
    const c = shell.container;
    c.setData('a11ySurface', { x: 0, y: 0, width: stage.width, height: stage.height }).setData('a11yPanel', stage.content);
    // Opaque: the screen under it never shows through the sheet's own top bar.
    c.addAt(this.scene.add.rectangle(stage.width / 2, stage.height / 2, stage.width, stage.height, theme.graphics.panelFill, 1), 1);
    const layout = this.layout();
    const shellRect = layout.shell;
    const before = new Set(this.scene.children.list);
    const head = this.text(shellRect.title.x, 0, title, this.type.h1, theme.colors.heading, { display: true, bold: true });
    const sub = this.text(shellRect.title.x, 0, subtitle, this.type.label, theme.colors.muted);
    const room = shellRect.title.width + shellRect.right.width;
    if (sub.width > room) sub.setWordWrapWidth(room, true).setMaxLines(1);
    const block = head.height + sub.height;
    head.setY(shellRect.title.y + Math.max(0, (shellRect.title.height - block) / 2));
    sub.setY(head.y + head.height);
    if (block > shellRect.title.height) sub.setVisible(false);
    if (shell.closeButton) {
      const back = layout.shell.back?.visual ?? { x: stage.content.x, y: stage.content.y, width: COMPACT.touch, height: COMPACT.touch };
      const visual = shell.closeButton.getMeasuredSize().visual;
      shell.closeButton.container.setPosition(back.x + visual.width / 2, back.y + back.height / 2);
    }
    c.add(this.scene.children.list.filter((obj) => !before.has(obj)));
    if (shell.closeButton) c.bringToTop(shell.closeButton.container);
    return { shell, layout };
  }

  // ------------------------------------------------------------------ choose a character

  /** The heroines (N-31): three portrait cards, the chosen one's record in the column, View deck and Begin run. */
  buildSelect(): void {
    const story = this.host.story;
    const roster = storyRoster(story);
    if (!this.host.selectedCharacterId || !roster.some((r) => r.unlocked && r.character.id === this.host.selectedCharacterId)) {
      this.host.selectedCharacterId = roster.find((r) => r.unlocked)?.character.id ?? null;
    }
    // Endless opens once any heroine has cleared Act 1 (P9).
    const endlessOpen = isEndlessOpen(story);
    if (!endlessOpen) this.host.selectMode = 'act';
    if (this.host.selectMode === 'endless') return this.buildEndlessSelect(roster);
    const layout = this.layout();
    const type = this.type;
    this.header(layout, 'Choose a character', 'Each has her own run deck and story', null);
    const tiles = storyTiles(layout.shell.main, roster.length);
    const marks = this.scene.add.graphics();
    const nameTexts: Phaser.GameObjects.Text[] = [];
    roster.forEach((entry, i) => {
      const r = tiles[i];
      this.scene.add.graphics().fillStyle(theme.graphics.dim, 1).fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel);
      const art = this.portrait(entry.character.darlingId, { x: r.x + 2, y: r.y + 2, width: r.width - 4, height: r.height - 4 });
      // Locked heroines show dimmed, with the lock (owner ruling M2).
      if (!entry.unlocked) art?.setAlpha(0.35);
      compactScrim(this.scene, r, 0.5);
      this.scene.add.graphics().lineStyle(1.5, theme.graphics.panelStroke, 1).strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel);
      const inner = r.width - 2 * STORY_COMPACT.pad;
      const lines: Phaser.GameObjects.Text[] = [];
      // One line, shrunk to the tile: a wrapped name breaks mid-word at large text.
      const name = this.text(0, 0, shortName(entry.character), type.h2, theme.colors.heading, { display: true, bold: true });
      fitMenuListName(name, inner, type.h2, type.h2);
      const sub = this.text(0, 0, heroineTitle(entry.character), type.label, entry.unlocked ? theme.colors.gold : theme.colors.body, { wrap: inner });
      if (!entry.unlocked) {
        const lock = this.text(0, 0, 'Locked', type.label, theme.colors.gold, { bold: true });
        lock.setText('LOCKED').setLetterSpacing(1);
        lines.push(lock);
      }
      lines.push(name, sub);
      if (!entry.unlocked) lines.push(this.text(0, 0, unlockLines(entry).progress, type.label, theme.colors.body, { wrap: inner }));
      nameTexts.push(name);
      let y = r.y + r.height - STORY_COMPACT.pad - lines.reduce((s, t) => s + t.displayHeight + 2, 0) + 2;
      for (const t of lines) {
        const indent = t.text === 'LOCKED' ? Math.round(type.label * 1.25) : 0;
        t.setPosition(r.x + STORY_COMPACT.pad + indent, y);
        if (indent) this.scene.add.image(r.x + STORY_COMPACT.pad + indent / 2 - 1, y + t.displayHeight / 2, bakeUiIcon(this.scene, 'lock')).setDisplaySize(type.label, type.label).setTint(colorInt(theme.colors.gold));
        y += t.displayHeight + 2;
      }
      if (entry.unlocked) {
        const zone = this.scene.add.zone(r.x + r.width / 2, r.y + r.height / 2, r.width, r.height).setInteractive({ useHandCursor: true });
        bindTapButton(this.scene, zone, () => {
          this.host.selectedCharacterId = entry.character.id;
          refresh();
        });
      }
    });
    this.scene.children.bringToTop(marks);
    const col = layout.column;
    const body = endlessOpen ? this.modeSwitch(col.body) : col.body;
    let detail: Phaser.GameObjects.GameObject[] = [];
    const view = compactButton(this.scene, col.secondary, 'View deck', { onTap: () => this.viewStarter() });
    const begin = compactButton(this.scene, col.primary, 'Begin run', { variant: 'primary', onTap: () => this.beginRun() });
    this.noticeLine(col.body);
    const refresh = (): void => {
      for (const obj of detail) obj.destroy();
      const id = this.host.selectedCharacterId;
      const i = roster.findIndex((r) => r.character.id === id);
      this.markTile(marks, i >= 0 ? tiles[i] : null, false);
      nameTexts.forEach((t, j) => t.setColor(j === i ? theme.colors.gold : theme.colors.heading));
      begin.setEnabled(i >= 0);
      view.setEnabled(i >= 0);
      detail = i >= 0 ? this.selectDetail(body, roster[i], roster) : [];
    };
    refresh();
  }

  /** The chosen heroine in the column: her name and title, colours, record, and what the next heroine asks. */
  private selectDetail(body: Rect, entry: ReturnType<typeof storyRoster>[number], roster: ReturnType<typeof storyRoster>): Phaser.GameObjects.GameObject[] {
    const before = new Set(this.scene.children.list);
    const type = this.type;
    const c = entry.character;
    let y = this.eyebrow(body.x, body.y, shortName(c), body.width);
    const title = this.text(body.x, y, heroineTitle(c) || shortName(c), type.h1, theme.colors.heading, { display: true, bold: true, wrap: body.width });
    y += title.height + 8;
    const pip = Math.round(type.body * 1.3);
    let px = body.x;
    for (const colour of c.colors) {
      if (this.scene.textures.exists(`pip-${colour}`)) this.scene.add.image(px + pip / 2, y + pip / 2, `pip-${colour}`).setDisplaySize(pip, pip);
      px += pip + 4;
    }
    const facts = this.text(px + 2, y, `${colourWords(c.colors)} · ${cardCount(c.starterDeck.length)}`, type.label, theme.colors.body, { wrap: body.x + body.width - px - 2 });
    facts.setY(y + Math.max(0, (pip - facts.height) / 2));
    y += Math.max(pip, facts.height) + 8;
    const story = this.host.story;
    const record = this.text(body.x, y, recordLine(story.wins[c.id] ?? 0, story.countedRuns[c.id] ?? 0), type.label, theme.colors.body, { wrap: body.width });
    y += record.height + 8;
    const next = roster.find((r) => !r.unlocked && r.predecessor?.id === c.id);
    if (next) {
      this.scene.add.graphics().lineStyle(1, theme.graphics.panelStroke, 1).lineBetween(body.x, y, body.x + body.width, y);
      y += 8;
      const copy = unlockLines(next);
      const lock = Math.round(type.label * 1.1);
      this.scene.add.image(body.x + lock / 2, y + lock / 2 + 1, bakeUiIcon(this.scene, 'lock')).setDisplaySize(lock, lock).setTint(colorInt(theme.colors.muted));
      this.text(body.x + lock + 6, y, `${shortName(next.character)}: ${copy.condition} (${copy.progress})`, type.label, theme.colors.muted, { wrap: body.width - lock - 6 });
    }
    return this.scene.children.list.filter((o) => !before.has(o));
  }

  /** Act 1 or Endless, at the top of character select's column; returns the column left under it. */
  private modeSwitch(body: Rect): Rect {
    const bar = { x: body.x, y: body.y, width: body.width, height: COMPACT.touch };
    const at = STORY_SELECT_MODES.findIndex((m) => m.mode === this.host.selectMode);
    compactSegments(this.scene, bar, STORY_SELECT_MODES.map((m) => m.label), Math.max(0, at), (i) => {
      if (STORY_SELECT_MODES[i].mode === this.host.selectMode) return;
      this.host.selectMode = STORY_SELECT_MODES[i].mode;
      this.host.commit();
    });
    const drop = bar.height + COMPACT.gap;
    return { ...body, y: body.y + drop, height: Math.max(0, body.height - drop) };
  }

  /**
   * Endless and the daily seed (N-38): the chosen heroine's portrait beside
   * the seed choice, what it means and her records; the column switches back
   * to Act 1, lists the heroines and starts the run.
   */
  private buildEndlessSelect(roster: ReturnType<typeof storyRoster>): void {
    const layout = this.layout();
    const type = this.type;
    const story = this.host.story;
    this.header(layout, 'Endless', ENDLESS_SUBTITLE, null);
    const main = layout.shell.main;
    const daily = this.host.endlessDaily;
    const dateKey = endlessDateKey(Date.now());
    const chosen = roster.find((r) => r.character.id === this.host.selectedCharacterId)?.character ?? null;
    // The portrait: 3:4, as tall as the pane allows but never more than a third of its width.
    const picH = Math.min(main.height, Math.round((main.width / 3) * (4 / 3)));
    const pic = { x: main.x, y: main.y, width: Math.round(picH * 0.75), height: picH };
    this.scene.add.graphics().fillStyle(theme.graphics.dim, 1).fillRoundedRect(pic.x, pic.y, pic.width, pic.height, theme.radius.panel);
    if (chosen) this.portrait(chosen.darlingId, { x: pic.x + 2, y: pic.y + 2, width: pic.width - 4, height: pic.height - 4 });
    this.scene.add.graphics().lineStyle(2, colorInt(theme.colors.gold), 1).strokeRoundedRect(pic.x, pic.y, pic.width, pic.height, theme.radius.panel);
    const tx = pic.x + pic.width + COMPACT.gap * 2;
    const tw = main.x + main.width - tx;
    const segW = Math.min(tw, Math.round(300 * Math.min(layout.k, 1.25)));
    compactSegments(this.scene, { x: tx, y: main.y, width: segW, height: COMPACT.touch }, ['Daily seed', 'Random seed'], daily ? 0 : 1, (i) => {
      if ((i === 0) === this.host.endlessDaily) return;
      this.host.endlessDaily = i === 0;
      this.host.commit();
    });
    let y = main.y + COMPACT.touch + 10;
    const seed = endlessSeedCopy(daily, dateKey);
    const heading = this.text(tx, y, seed.heading, type.h2, theme.colors.heading, { display: true, bold: true, wrap: tw });
    y += heading.height + 6;
    const best = chosen ? story.endless.bestLoop[chosen.id] ?? 0 : 0;
    const lines: { copy: string; color: string; size: number }[] = [
      { copy: seed.note, color: theme.colors.body, size: type.body },
      { copy: endlessBestLine(best), color: theme.colors.body, size: type.body },
      ...(daily ? [{ copy: dailyBestLine(dailyBestLoop(story, dateKey)), color: theme.colors.body, size: type.body }] : []),
      { copy: endlessStartNote(ENDLESS_HEAD_START_PICKS, ENDLESS_HEAD_START_GOLD), color: theme.colors.muted, size: type.label },
    ];
    for (const line of lines) {
      const t = this.text(tx, y, line.copy, line.size, line.color, { wrap: tw });
      const room = main.y + main.height - y;
      if (t.height > room) {
        const lineH = t.height / Math.max(1, t.getWrappedText().length);
        if (room < lineH) {
          t.destroy();
          break;
        }
        t.setMaxLines(Math.floor(room / lineH));
      }
      y += t.height + 6;
    }

    const col = layout.column;
    const body = this.modeSwitch(col.body);
    const rowsTop = this.eyebrow(body.x, body.y, 'Character', body.width);
    const room = body.y + body.height - rowsTop;
    const rowH = Math.max(COMPACT.touch, Math.min(Math.round(56 * Math.min(layout.k, 1.25)), Math.floor((room - COMPACT.gap * (roster.length - 1)) / roster.length)));
    roster.forEach((entry, i) => {
      const r = { x: body.x, y: rowsTop + i * (rowH + COMPACT.gap), width: body.width, height: rowH };
      const selected = entry.character.id === chosen?.id;
      this.scene.add.graphics()
        .fillStyle(selected ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
        .fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control)
        .lineStyle(selected ? theme.outline.state : theme.control.borderWidth, selected ? colorInt(theme.colors.goldHover) : theme.graphics.panelStroke, 1)
        .strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control);
      const d = r.height - 12;
      const face = { x: r.x + 6, y: r.y + 6, width: d, height: d };
      this.portrait(entry.character.darlingId, face)?.setAlpha(entry.unlocked ? 1 : 0.35);
      const nx = face.x + d + 8;
      const lock = entry.unlocked ? 0 : Math.round(type.body * 1.1) + 8;
      const nw = r.x + r.width - nx - 8 - lock;
      const name = this.text(nx, 0, shortName(entry.character), type.body, entry.unlocked ? theme.colors.heading : theme.colors.muted, { bold: true });
      fitMenuListName(name, nw, type.body, type.label);
      const sub = this.text(nx, 0, entry.unlocked ? heroineTitle(entry.character) : 'Locked', type.label, theme.colors.muted);
      ellipsizeText(sub, nw);
      const block = name.height + sub.height;
      name.setY(r.y + (r.height - block) / 2);
      sub.setY(name.y + name.height);
      if (sub.y + sub.height > r.y + r.height) sub.setVisible(false);
      if (!entry.unlocked) {
        const size = Math.round(type.body * 1.1);
        this.scene.add.image(r.x + r.width - 8 - size / 2, r.y + r.height / 2, bakeUiIcon(this.scene, 'lock')).setDisplaySize(size, size).setTint(colorInt(theme.colors.muted));
        return;
      }
      const zone = this.scene.add.zone(r.x + r.width / 2, r.y + r.height / 2, r.width, r.height).setInteractive({ useHandCursor: true });
      bindTapButton(this.scene, zone, () => {
        if (this.host.selectedCharacterId === entry.character.id) return;
        this.host.selectedCharacterId = entry.character.id;
        this.host.commit();
      });
    });
    this.noticeLine(col.body);
    const start = compactButton(this.scene, col.foot, daily ? 'Start daily run' : 'Start random run', { variant: 'primary', onTap: () => this.beginEndless(daily) });
    start.setEnabled(!!chosen);
  }

  /** Start endless from the menu (P9, E3): the day's shared seed for the daily, else a random one. */
  private beginEndless(daily: boolean): void {
    const id = this.host.selectedCharacterId;
    if (!id) return;
    const now = Date.now();
    const dateKey = endlessDateKey(now);
    // UI may roll the seed; the run derives everything else from it.
    const seed = daily ? dailyEndlessSeed(dateKey) : Math.floor(Math.random() * 2 ** 31);
    const result = startEndlessRun(this.host.story, id, seed, now, daily ? { dailyDateKey: dateKey } : {});
    if (!result.ok) return this.host.refused(result.reason);
    const intro = endlessIntroSceneDue(this.host.story);
    this.host.commit(intro ? { storyScene: { id: intro.id, then: 'screen' } } : {});
  }

  /** A Darling's art cover-fitted into `rect`, faces biased up. */
  private portrait(darlingId: string, rect: Rect): Phaser.GameObjects.Image | null {
    try {
      return addPortraitArt(this.scene, rect.x + rect.width / 2, rect.y + rect.height / 2, darlingId, (art) => coverFitImage(art, rect, 0.12));
    } catch {
      return null;
    }
  }

  private beginRun(): void {
    const id = this.host.selectedCharacterId;
    if (!id) return;
    // UI may roll the seed; the run derives everything else from it.
    const seed = Math.floor(Math.random() * 2 ** 31);
    const result = startRun(this.host.story, id, seed, Date.now());
    if (!result.ok) return this.host.refused(result.reason);
    this.host.commit();
  }

  private viewStarter(): void {
    const c = this.host.selectedCharacterId ? storyCharacterById(this.host.selectedCharacterId) : undefined;
    if (!c) return;
    this.deckSheet({ title: `${shortName(c)}'s deck`, note: `${cardCount(c.starterDeck.length)} to start the run`, deck: c.starterDeck, limit: 0 });
  }

  // ------------------------------------------------------------------ the opening boon

  /** The opening boon (N-32): the offers as tiles, the chosen one's words in the column, Take this boon. */
  buildBoon(run: StoryRun, offers: readonly StoryBoonId[], openDeckPicker: (onIds: (ids: string[]) => void) => void): void {
    const character = storyCharacterById(run.characterId);
    const layout = this.layout();
    const type = this.type;
    this.header(layout, 'Choose an opening boon', `${character ? shortName(character) : 'Your heroine'} · ${stageLabel(run)}`, run);
    const boons = offers.map((id) => STORY_BOONS.find((b) => b.id === id)!).filter(Boolean);
    const tiles = storyTiles(layout.shell.main, boons.length);
    let selected: StoryBoonId | null = null;
    const plates: Phaser.GameObjects.Graphics[] = [];
    const names: Phaser.GameObjects.Text[] = [];
    const marks = this.scene.add.graphics();
    for (let i = 0; i < boons.length; i++) plates.push(this.scene.add.graphics());
    boons.forEach((boon, i) => {
      const r = tiles[i];
      const inner = r.width - 2 * STORY_COMPACT.pad;
      const disc = Math.round(Math.min(r.width * 0.42, 66 * layout.k));
      const name = this.text(r.x + r.width / 2, 0, boon.name, type.h2, theme.colors.heading, { display: true, bold: true, wrap: inner, align: 'center' }).setOrigin(0.5, 0);
      const text = this.text(r.x + r.width / 2, 0, boon.text, type.body, theme.colors.body, { wrap: inner, align: 'center' }).setOrigin(0.5, 0);
      const block = disc + 12 + name.height + 8 + text.height;
      const top = r.y + Math.max(STORY_COMPACT.pad, (r.height - block) / 2);
      const cx = r.x + r.width / 2;
      this.scene.add.graphics()
        .fillStyle(theme.graphics.dim, 0.9).fillCircle(cx, top + disc / 2, disc / 2)
        .lineStyle(2, colorInt(theme.colors.gold), 1).strokeCircle(cx, top + disc / 2, disc / 2);
      this.scene.add.image(cx, top + disc / 2, bakeUiIcon(this.scene, BOON_ICON[boon.id] ?? 'star')).setDisplaySize(disc * 0.42, disc * 0.42).setTint(colorInt(theme.colors.gold));
      name.setY(top + disc + 12);
      text.setY(name.y + name.height + 8);
      // At large text a long line runs past the tile: it is cut, and the column says it in full.
      const room = r.y + r.height - STORY_COMPACT.pad - text.y;
      const lineH = text.height / Math.max(1, text.getWrappedText().length);
      if (text.height > room) text.setMaxLines(Math.max(1, Math.floor(room / lineH)));
      names.push(name);
      const zone = this.scene.add.zone(r.x + r.width / 2, r.y + r.height / 2, r.width, r.height).setInteractive({ useHandCursor: true });
      bindTapButton(this.scene, zone, () => {
        selected = boon.id;
        refresh();
      });
    });
    this.scene.children.bringToTop(marks);
    const col = layout.column;
    const take = compactButton(this.scene, col.foot, 'Choose a boon', {
      variant: 'primary',
      onTap: () => {
        if (!selected) return;
        if (selected === 'trim-two') {
          openDeckPicker((ids) => {
            if (ids.length !== 2) return;
            const result = chooseBoon(this.host.story, CARD_DB, 'trim-two', { removeCardIds: [ids[0], ids[1]] });
            if (!result.ok) return this.host.refused(result.reason);
            this.host.commit();
          });
          return;
        }
        const result = chooseBoon(this.host.story, CARD_DB, selected);
        if (!result.ok) return this.host.refused(result.reason);
        this.host.commit();
      },
    });
    this.noticeLine(col.body);
    let detail: Phaser.GameObjects.GameObject[] = [];
    const refresh = (): void => {
      boons.forEach((boon, i) => {
        const on = boon.id === selected;
        const r = tiles[i];
        plates[i].clear().fillStyle(on ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
          .fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel)
          .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, 1)
          .strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel);
        names[i].setColor(on ? theme.colors.gold : theme.colors.heading);
      });
      const i = boons.findIndex((b) => b.id === selected);
      this.markTile(marks, i >= 0 ? tiles[i] : null);
      take.setEnabled(selected !== null);
      take.setLabel(selected === 'trim-two' ? 'Choose 2 to remove' : selected ? 'Take this boon' : 'Choose a boon');
      for (const obj of detail) obj.destroy();
      detail = [];
      if (i < 0) {
        detail = [this.text(col.body.x, col.body.y, 'Tap a boon to read it here. It lasts for this run.', type.body, theme.colors.muted, { wrap: col.body.width })];
        return;
      }
      const before = new Set(this.scene.children.list);
      let y = this.eyebrow(col.body.x, col.body.y, 'Your boon', col.body.width);
      const name = this.text(col.body.x, y, boons[i].name, type.h1, theme.colors.heading, { display: true, bold: true, wrap: col.body.width });
      y += name.height + 8;
      this.text(col.body.x, y, boons[i].text, type.body, theme.colors.body, { wrap: col.body.width });
      detail = this.scene.children.list.filter((o) => !before.has(o));
    };
    refresh();
  }

  // ------------------------------------------------------------------ rows of offered cards

  /**
   * Offered cards in a row (a reward, an event's pick, the shop): the heading
   * line over the tiles, a tap selecting (the shop's toggling its cart), a
   * hold reading a card in full. Returns the tiles' rects and their captions.
   */
  private cardRowScreen(layout: StoryScreenLayout, heading: string, ids: readonly string[], captions: boolean, onTap: (index: number) => void): { tiles: Rect[]; captionRects: Rect[]; marks: Phaser.GameObjects.Graphics; art: PackTile[] } {
    const main = layout.shell.main;
    const head = this.text(main.x + main.width / 2, main.y, heading, this.type.body, theme.colors.body, { wrap: main.width, align: 'center' }).setOrigin(0.5, 0);
    const area = { x: main.x, y: head.y + head.height + COMPACT.gap, width: main.width, height: Math.max(0, main.y + main.height - head.y - head.height - COMPACT.gap) };
    const row = storyCardRow(area, ids.length, layout.k, captions);
    const art = ids.map((id, i) => new PackTile(this.scene, row.tiles[i]).showFace(def(CARD_DB, id), 'white'));
    const marks = this.scene.add.graphics();
    const indexAt = (p: Phaser.Input.Pointer): number => row.tiles.findIndex((t) => p.worldX >= t.x && p.worldX <= t.x + t.width && p.worldY >= t.y && p.worldY <= t.y + t.height + (captions ? STORY_COMPACT.captionH : 0));
    this.tileInput(area, indexAt, ids, onTap);
    return { tiles: row.tiles, captionRects: row.captions, marks, art };
  }

  /** The card reward (N-35): the offers, the pick in the column, Skip and Add to deck. */
  buildReward(run: StoryRun, options: readonly string[], waiting: number): void {
    const layout = this.layout();
    const after = waiting > 1 ? ` · ${waiting - 1} more after this` : '';
    this.header(layout, 'Victory', `Card reward${after}`, run);
    this.pickScreen(layout, run, 'Add one card to your run deck, or skip it', options, 'Skip', () => {
      const result = takeCardReward(this.host.story, null);
      if (!result.ok) return this.host.refused(result.reason);
      this.host.commit();
    }, (id) => {
      const result = takeCardReward(this.host.story, id);
      if (!result.ok) return this.host.refused(result.reason);
      this.host.commit();
    });
  }

  /** An event's "add a card of your choice" step: the offers, the pick, Back and Add to deck. */
  buildEventPick(run: StoryRun, title: string, options: readonly string[], back: () => void, take: (id: string) => void): void {
    const layout = this.layout();
    this.header(layout, title, 'Choose a card to add to your run deck', run);
    this.pickScreen(layout, run, 'Choose a card to add to your run deck', options, 'Back', back, take);
  }

  private pickScreen(layout: StoryScreenLayout, run: StoryRun, heading: string, options: readonly string[], secondary: string, onSecondary: () => void, onTake: (id: string) => void): void {
    let selected = -1;
    const col = layout.column;
    let detail: Phaser.GameObjects.GameObject[] = [];
    const row = this.cardRowScreen(layout, heading, options, false, (i) => {
      selected = selected === i ? -1 : i;
      refresh();
    });
    compactButton(this.scene, col.secondary, secondary, { onTap: onSecondary });
    const add = compactButton(this.scene, col.primary, 'Add to deck', { variant: 'primary', onTap: () => {
      if (selected >= 0) onTake(options[selected]);
    } });
    const notice = this.noticeLine(col.body);
    const refresh = (): void => {
      this.markTile(row.marks, selected >= 0 ? row.tiles[selected] : null);
      add.setEnabled(selected >= 0);
      for (const obj of detail) obj.destroy();
      if (selected < 0) {
        detail = [this.text(col.body.x, col.body.y, `Tap a card to choose it; ${readHint()}.\n\nRun deck ${cardCount(run.deck.length)}.`, this.type.body, theme.colors.muted, { wrap: col.body.width })];
        return;
      }
      detail = this.cardDetail(col.body, 'Your pick', def(CARD_DB, options[selected]),
        [{ copy: `Run deck ${run.deck.length} → ${cardCount(run.deck.length + 1)}.`, color: theme.colors.muted }], notice.y - notice.height - 4);
    };
    refresh();
  }

  // ------------------------------------------------------------------ the shop

  /** The shop (N-36): the stock with prices, the last card tapped in the column, Leave and Buy. */
  buildShop(run: StoryRun, node: StoryNode): void {
    const layout = this.layout();
    const type = this.type;
    const stock = shopStock(run, node, CARD_DB);
    const floor = runMap(run).floors.findIndex((f) => f.some((n) => n.id === node.id)) + 1;
    this.header(layout, 'Shop', `${floor > 0 ? `Floor ${floor} · ` : ''}spend run gold, then leave`, run);
    let cart: string[] = [];
    let focus = -1;
    const ids = stock.map((o) => o.cardId);
    const row = this.cardRowScreen(layout, 'Tap cards to add them to your cart', ids, true, (i) => {
      const id = ids[i];
      if (cart.includes(id)) cart = cart.filter((c) => c !== id);
      else if (shopCartState(run.gold, stock, cart).addable.has(id)) cart = [...cart, id];
      focus = i;
      refresh();
    });
    const coin = Math.round(type.label * 1.2);
    const prices = stock.map((offer, i) => {
      const r = row.captionRects[i];
      const t = this.text(0, r.y + r.height / 2, String(offer.price), type.label, theme.colors.gold, { bold: true }).setOrigin(0, 0.5);
      const w = coin + 4 + t.width;
      const x = r.x + (r.width - w) / 2;
      const icon = this.scene.add.image(x + coin / 2, r.y + r.height / 2, bakeUiIcon(this.scene, 'gold')).setDisplaySize(coin, coin);
      t.setX(x + coin + 4);
      return { t, icon };
    });
    const col = layout.column;
    compactButton(this.scene, col.secondary, 'Leave', { onTap: () => {
      const result = resolveShop(this.host.story, CARD_DB, []);
      if (!result.ok) return this.host.refused(result.reason);
      this.host.commit();
    } });
    const buy = compactButton(this.scene, col.primary, 'Buy', { variant: 'primary', onTap: () => {
      if (cart.length === 0) return;
      const result = resolveShop(this.host.story, CARD_DB, cart);
      if (!result.ok) return this.host.refused(result.reason);
      this.host.commit();
    } });
    const notice = this.noticeLine(col.body);
    let detail: Phaser.GameObjects.GameObject[] = [];
    let cartMarks: Phaser.GameObjects.Graphics[] = [];
    const refresh = (): void => {
      const state = shopCartState(run.gold, stock, cart);
      for (const g of cartMarks) g.destroy();
      cartMarks = [];
      stock.forEach((offer, i) => {
        const inCart = cart.includes(offer.cardId);
        const can = state.addable.has(offer.cardId);
        row.art[i].setAlpha(inCart || can ? 1 : 0.45);
        prices[i].t.setColor(inCart ? theme.colors.gold : can ? theme.colors.heading : theme.colors.muted);
        prices[i].icon.setAlpha(inCart || can ? 1 : 0.45);
        if (!inCart) return;
        const g = this.scene.add.graphics();
        this.markTile(g, row.tiles[i]);
        cartMarks.push(g);
      });
      buy.setEnabled(cart.length > 0);
      buy.setLabel(cart.length ? `Buy ${cart.length} · ${state.spent}` : 'Buy');
      for (const obj of detail) obj.destroy();
      const status = `Cart ${cardCount(cart.length)} · ${state.spent} gold. ${state.left} of ${run.gold} left.`;
      if (focus < 0) {
        detail = [this.text(col.body.x, col.body.y, `Tap a card to add it to your cart; ${readHint()}.\n\n${status}`, type.body, theme.colors.muted, { wrap: col.body.width })];
        return;
      }
      const offer = stock[focus];
      const inCart = cart.includes(offer.cardId);
      const can = state.addable.has(offer.cardId);
      detail = this.cardDetail(col.body, inCart ? 'In your cart' : 'Selected', def(CARD_DB, offer.cardId), [
        { copy: inCart || can ? `${offer.price} gold. Adds to this run's deck only.` : `${offer.price} gold: not enough left.`, color: inCart || can ? theme.colors.muted : theme.colors.danger },
        { copy: status, color: theme.colors.gold },
      ], notice.y - notice.height - 4);
    };
    refresh();
  }

  // ------------------------------------------------------------------ the run deck as a grid

  /**
   * Run-deck cards as a scrolling grid of tiles in `area` (copies counted on
   * the tile); a tap calls `onTap`, a hold reads the card. Returns the redraw
   * for the picked marks (`picked` counts a card's picks).
   */
  private deckGrid(area: Rect, k: number, entries: readonly { id: string; count: number }[], picked: (id: string) => number, onTap: ((id: string) => void) | null, parent: Phaser.GameObjects.Container | null = null): () => void {
    const grid = limitedTileGrid(area, entries.length, k, { minW: STORY_COMPACT.tileMinW, aspect: STORY_COMPACT.tileAspect });
    const list = this.scene.add.container(0, area.y);
    parent?.add(list);
    entries.forEach((e, i) => list.add(new PackTile(this.scene, grid.cells[i]).showFace(def(CARD_DB, e.id), 'white', e.count > 1 ? { chip: `${e.count}×` } : {})));
    const marks = this.scene.add.graphics();
    list.add(marks);
    const scroll = bindMenuScroll(this.scene, list, area, grid.contentH, () => this.inspecting !== null);
    const ids = entries.map((e) => e.id);
    const indexAt = (p: Phaser.Input.Pointer): number => {
      const y = p.worldY - area.y + scroll.offset();
      return grid.cells.findIndex((c) => p.worldX >= c.x && p.worldX <= c.x + c.width && y >= c.y && y <= c.y + c.height);
    };
    this.tileInput(area, indexAt, ids, (i) => onTap?.(ids[i]), parent);
    const redraw = (): void => {
      marks.clear();
      entries.forEach((e, i) => {
        if (picked(e.id) > 0) this.markTile(marks, grid.cells[i], true, true);
      });
    };
    redraw();
    return redraw;
  }

  /** A card picked from a grid, in the column, or the hint while none is. */
  private gridDetail(body: Rect, bottom: number, eyebrow: string, id: string | null, hint: string, extra: { copy: string; color: string }[] = []): Phaser.GameObjects.GameObject[] {
    if (!id) return [this.text(body.x, body.y, hint, this.type.body, theme.colors.muted, { wrap: body.width })];
    return this.cardDetail(body, eyebrow, def(CARD_DB, id), extra, bottom);
  }

  /** Rest: the run deck, one card to remove or none, Rest. */
  buildRest(run: StoryRun): void {
    const layout = this.layout();
    const minDeck = storyActByNumber(run.act)?.economy.minDeckSize ?? 0;
    const canTrim = run.deck.length - 1 >= minDeck;
    this.header(layout, 'Rest', canTrim ? 'Remove one card from your run deck, or keep it whole' : 'Your run deck is at its smallest', run);
    let picked: string | null = null;
    const col = layout.column;
    const rest = compactButton(this.scene, col.foot, 'Rest', { variant: 'primary', onTap: () => {
      const result = resolveRest(this.host.story, picked);
      if (!result.ok) return this.host.refused(result.reason);
      this.host.commit();
    } });
    const notice = this.noticeLine(col.body);
    let detail: Phaser.GameObjects.GameObject[] = [];
    const hint = canTrim
      ? `Tap a card to remove it as you rest; ${readHint()}.\n\nRun deck ${cardCount(run.deck.length)}.`
      : `No card can be removed below ${cardCount(minDeck)}. Rest to go on.`;
    const redraw = this.deckGrid(layout.shell.main, layout.k, deckEntries(run.deck), (id) => (id === picked ? 1 : 0), canTrim ? (id) => {
      picked = picked === id ? null : id;
      refresh();
    } : null);
    const refresh = (): void => {
      redraw();
      rest.setLabel(picked ? 'Remove and rest' : 'Rest');
      for (const obj of detail) obj.destroy();
      detail = this.gridDetail(col.body, notice.y - notice.height - 4, 'Remove', picked, hint, [{ copy: `Run deck ${run.deck.length} → ${cardCount(run.deck.length - 1)}.`, color: theme.colors.muted }]);
    };
    refresh();
  }

  /** Act cleared (N-37): the run deck, one card kept for the collection, Keep this card. */
  buildKeep(run: StoryRun): void {
    const layout = this.layout();
    this.header(layout, `Act ${run.act} cleared`, 'Keep one card from your run deck', run);
    let picked: string | null = null;
    const col = layout.column;
    const keep = compactButton(this.scene, col.foot, 'Choose a card', { variant: 'primary', onTap: () => {
      if (!picked) return;
      const result = claimKeep(this.host.save, CARD_DB, picked);
      if (!result.ok) return this.host.refused(result.reason);
      const ending = endingSceneFor(run.characterId);
      this.host.commit({ keptCardId: picked, ...(ending ? { storyScene: { id: ending.id, then: 'screen' as const } } : {}) });
    } });
    const notice = this.noticeLine(col.body);
    let detail: Phaser.GameObjects.GameObject[] = [];
    const redraw = this.deckGrid(layout.shell.main, layout.k, keepOptions(run).map((id) => ({ id, count: 1 })), (id) => (id === picked ? 1 : 0), (id) => {
      picked = picked === id ? null : id;
      refresh();
    });
    const refresh = (): void => {
      redraw();
      keep.setEnabled(!!picked);
      keep.setLabel(picked ? 'Keep this card' : 'Choose a card');
      for (const obj of detail) obj.destroy();
      detail = this.gridDetail(col.body, notice.y - notice.height - 4, 'You keep', picked,
        'Tap the card to keep: it joins your collection for good. The rest of the run deck stays with the run.',
        [{ copy: 'Joins your collection for good. The rest of the run deck stays with the run.', color: theme.colors.muted }]);
    };
    refresh();
  }

  /** The run's end: the heroine, who fell, the run's numbers, the kept card, Finish run. */
  buildCleared(run: StoryRun): void {
    const layout = this.layout();
    const type = this.type;
    const character = storyCharacterById(run.characterId);
    const act = storyActByNumber(run.act);
    const boss = act ? storyAvatarById(act.bossAvatarId) : null;
    this.header(layout, `Act ${run.act} cleared`, character ? `${shortName(character)} · the run is won` : 'The run is won', run);
    const main = layout.shell.main;
    const picW = Math.min(Math.round(main.height * STORY_COMPACT.portraitShare), Math.round(main.width * 0.4));
    const pic = { x: main.x, y: main.y, width: picW, height: main.height };
    this.scene.add.graphics().fillStyle(theme.graphics.dim, 1).fillRoundedRect(pic.x, pic.y, pic.width, pic.height, theme.radius.panel);
    if (character) this.portrait(character.darlingId, { x: pic.x + 2, y: pic.y + 2, width: pic.width - 4, height: pic.height - 4 });
    this.scene.add.graphics().lineStyle(2, colorInt(theme.colors.gold), 1).strokeRoundedRect(pic.x, pic.y, pic.width, pic.height, theme.radius.panel);
    const box = { x: pic.x + pic.width + COMPACT.gap, y: main.y, width: main.width - pic.width - COMPACT.gap, height: main.height };
    this.panelAt(box);
    const inner = box.width - 2 * STORY_COMPACT.pad;
    let y = box.y + STORY_COMPACT.pad;
    const head = this.text(box.x + STORY_COMPACT.pad, y, `${character ? shortName(character) : 'Your heroine'} defeated ${boss?.name ?? 'the boss'}.`, type.h2, theme.colors.heading, { display: true, bold: true, wrap: inner });
    y += head.height + 10;
    for (const copy of [`Fights played: ${run.fightsPlayed}`, `Run deck: ${cardCount(run.deck.length)}`]) {
      const t = this.text(box.x + STORY_COMPACT.pad, y, copy, type.body, theme.colors.body, { wrap: inner });
      y += t.height + 4;
    }
    y += 8;
    const offer = this.text(box.x + STORY_COMPACT.pad, y, ENDLESS_GO_ON_NOTE, type.label, theme.colors.muted, { wrap: inner });
    const lineH = offer.height / Math.max(1, offer.getWrappedText().length);
    const room = box.y + box.height - STORY_COMPACT.pad - y;
    if (offer.height > room) offer.setMaxLines(Math.max(1, Math.floor(room / lineH)));
    const col = layout.column;
    const kept = this.host.keptCardId && CARD_DB[this.host.keptCardId] ? this.host.keptCardId : null;
    let cy = this.eyebrow(col.body.x, col.body.y, 'Kept for your collection', col.body.width);
    if (kept) {
      const name = this.text(col.body.x, cy, def(CARD_DB, kept).name, type.h2, theme.colors.heading, { display: true, bold: true, wrap: col.body.width });
      cy += name.height + 8;
      const room = col.body.y + col.body.height - cy;
      const h = Math.max(0, Math.min(room, Math.round(col.body.width * 0.55 * STORY_COMPACT.tileAspect)));
      const w = Math.round(h / STORY_COMPACT.tileAspect);
      if (h > 40) {
        const cell = { x: col.body.x, y: cy, width: w, height: h };
        new PackTile(this.scene, cell).showFace(def(CARD_DB, kept), 'white');
        this.tileInput(cell, () => 0, [kept], () => this.inspect(kept));
      }
    } else {
      this.text(col.body.x, cy, 'Your kept card is in your collection.', type.body, theme.colors.body, { wrap: col.body.width });
    }
    this.noticeLine(col.body);
    compactButton(this.scene, col.secondary, 'Finish run', { onTap: () => {
      const result = finishClearedRun(this.host.story);
      if (!result.ok) return this.host.refused(result.reason);
      this.host.commit();
    } });
    compactButton(this.scene, col.primary, 'Continue', { variant: 'primary', onTap: () => {
      const result = enterEndless(this.host.story);
      if (!result.ok) return this.host.refused(result.reason);
      const intro = endlessIntroSceneDue(this.host.story);
      this.host.commit(intro ? { storyScene: { id: intro.id, then: 'screen' } } : {});
    } });
  }

  /**
   * A beaten endless claimant: the heroine, who fell, the run's numbers and
   * records, then go on to the next loop or end the run there (asked first:
   * ending cannot be undone).
   */
  buildLoopCleared(run: StoryRun, loop: number): void {
    const layout = this.layout();
    const type = this.type;
    const story = this.host.story;
    const character = storyCharacterById(run.characterId);
    const who = character ? shortName(character) : 'Your heroine';
    const boss = storyMapNodes(runMap(run)).find((node) => node.kind === 'boss');
    const claimant = boss?.avatarId ? storyAvatarById(boss.avatarId).name : 'the claimant';
    this.header(layout, `Loop ${loop} cleared`, `${who} · ${loopsCleared(loop)}`, run);
    const main = layout.shell.main;
    const picW = Math.min(Math.round(main.height * STORY_COMPACT.portraitShare), Math.round(main.width * 0.4));
    const pic = { x: main.x, y: main.y, width: picW, height: main.height };
    this.scene.add.graphics().fillStyle(theme.graphics.dim, 1).fillRoundedRect(pic.x, pic.y, pic.width, pic.height, theme.radius.panel);
    if (character) this.portrait(character.darlingId, { x: pic.x + 2, y: pic.y + 2, width: pic.width - 4, height: pic.height - 4 });
    this.scene.add.graphics().lineStyle(2, colorInt(theme.colors.gold), 1).strokeRoundedRect(pic.x, pic.y, pic.width, pic.height, theme.radius.panel);
    const box = { x: pic.x + pic.width + COMPACT.gap, y: main.y, width: main.width - pic.width - COMPACT.gap, height: main.height };
    this.panelAt(box);
    const inner = box.width - 2 * STORY_COMPACT.pad;
    let y = box.y + STORY_COMPACT.pad;
    const head = this.text(box.x + STORY_COMPACT.pad, y, `${who} defeated ${claimant}.`, type.h2, theme.colors.heading, { display: true, bold: true, wrap: inner });
    y += head.height + 10;
    for (const copy of [`Fights played: ${run.fightsPlayed}`, `Run deck: ${cardCount(run.deck.length)}`]) {
      const t = this.text(box.x + STORY_COMPACT.pad, y, copy, type.body, theme.colors.body, { wrap: inner });
      y += t.height + 4;
    }
    const col = layout.column;
    let cy = this.eyebrow(col.body.x, col.body.y, 'Records', col.body.width);
    const records = [endlessBestLine(story.endless.bestLoop[run.characterId] ?? 0)];
    if (run.dailyDateKey !== null) records.push(dailyBestLine(dailyBestLoop(story, run.dailyDateKey)));
    for (const copy of records) {
      const t = this.text(col.body.x, cy, copy, type.body, theme.colors.body, { wrap: col.body.width });
      cy += t.height + 6;
    }
    this.noticeLine(col.body);
    compactButton(this.scene, col.secondary, 'End run', { onTap: () => this.confirmEndRun(loop) });
    compactButton(this.scene, col.primary, `Go on to loop ${loop + 1}`, { variant: 'primary', onTap: () => {
      const result = nextEndlessLoop(story);
      if (!result.ok) return this.host.refused(result.reason);
      this.host.commit();
    } });
  }

  /** Ask before ending an endless run between loops; the records are already kept. */
  private confirmEndRun(loop: number): void {
    if (this.sheet) return;
    const under = this.host.interactiveTargets();
    compactDialog(this.scene, {
      title: 'End this run?',
      message: `The run ends here with ${loopsCleared(loop)}. Your best run is already saved.`,
      secondary: { label: 'Keep going', onTap: (close) => close() },
      primary: { label: 'End run', variant: 'danger', onTap: (close) => {
        close();
        const result = abandonRun(this.host.story);
        if (!result.ok) return this.host.refused(result.reason);
        this.host.commit();
      } },
      dismissal: 'dismissible',
      onClose: () => this.host.guard.close(),
    });
    this.host.guard.open(under);
  }

  // ------------------------------------------------------------------ the run deck sheet

  /**
   * The run deck over the screen: view only (`limit` 0), or pick between
   * `min` and `limit` cards and confirm (Travel Light, an event's removal).
   */
  deckSheet(opts: { title: string; note: string; deck: readonly string[]; limit: number; min?: number; confirm?: (ids: string[]) => string; onConfirm?: (ids: string[]) => void }): void {
    if (this.sheet) return;
    const min = Math.min(opts.limit, opts.min ?? opts.limit);
    const ready = (n: number): boolean => n >= min && n <= opts.limit;
    const { shell, layout } = this.fullSheet(opts.title, opts.note);
    const c = shell.container;
    const col = layout.column;
    let picked: string[] = [];
    const before = new Set(this.scene.children.list);
    let detail: Phaser.GameObjects.GameObject[] = [];
    let confirm: CompactButton | null = null;
    const redraw = this.deckGrid(layout.shell.main, layout.k, deckEntries(opts.deck), (id) => picked.filter((p) => p === id).length, opts.limit > 0 ? (id) => {
      picked = togglePick(picked, id, opts.limit, opts.deck);
      refresh();
    } : null, c);
    if (opts.limit > 0 && opts.onConfirm) {
      confirm = compactButton(this.scene, col.foot, opts.confirm?.([]) ?? 'Confirm', { variant: 'primary', onTap: () => {
        if (!ready(picked.length)) return;
        const ids = [...picked];
        shell.close();
        opts.onConfirm?.(ids);
      } });
    } else {
      compactButton(this.scene, col.foot, 'Close', { onTap: () => shell.close() });
    }
    const refresh = (): void => {
      redraw();
      for (const obj of detail) obj.destroy();
      const pre = new Set(this.scene.children.list);
      const last = picked[picked.length - 1] ?? null;
      if (opts.limit > 0) {
        let y = this.eyebrow(col.body.x, col.body.y, `Chosen ${picked.length} of ${opts.limit}`, col.body.width);
        for (const id of picked) {
          const t = this.text(col.body.x, y, def(CARD_DB, id).name, this.type.body, theme.colors.heading, { wrap: col.body.width });
          y += t.height + 2;
        }
        if (!last) this.text(col.body.x, y, `Tap cards to choose them; ${readHint()}.`, this.type.body, theme.colors.muted, { wrap: col.body.width });
      } else {
        this.text(col.body.x, col.body.y, `${readHint().charAt(0).toUpperCase()}${readHint().slice(1)}.`, this.type.body, theme.colors.muted, { wrap: col.body.width });
      }
      detail = this.scene.children.list.filter((o) => !pre.has(o));
      for (const obj of detail) c.add(obj);
      confirm?.setEnabled(ready(picked.length));
      if (confirm && opts.confirm) confirm.setLabel(opts.confirm(picked));
    };
    c.add(this.scene.children.list.filter((obj) => !before.has(obj)));
    refresh();
  }

  /** The run's deck, view only. */
  viewDeck(run: StoryRun): void {
    this.deckSheet({ title: 'Run deck', note: `${cardCount(run.deck.length)} for this run`, deck: run.deck, limit: 0 });
  }

  // ------------------------------------------------------------------ the map

  /**
   * The act's map (N-33): floors left to right with #654's medallions and
   * dotted trails, the stop in view in the column, View deck and Abandon run
   * over the stop's action. The map key opens from the top bar, and by
   * itself the first time.
   */
  buildMap(run: StoryRun, openDuel: StoryNode | null): void {
    const layout = this.layout();
    const type = this.type;
    const character = storyCharacterById(run.characterId);
    const map = runMap(run);
    const legal = openDuel ? [] : legalNextNodes(this.host.story);
    const floorNow = run.nodeId ? map.floors.findIndex((f) => f.some((n) => n.id === run.nodeId)) + 1 : 0;
    const goal = run.phase === 'endless' ? 'the claimant' : 'the boss';
    const where = floorNow > 0 ? `Floor ${floorNow} of ${map.floors.length}` : `${map.floors.length} floors to ${goal}`;
    this.header(layout, stageLabel(run), `${character ? shortName(character) : 'Story'} · ${where}`, run);
    // The map key's button left of the deck chip would crowd the title: it lives in the column instead.
    const main = layout.shell.main;
    this.panelAt(main);
    const plan = storyMapPlan(main, map.floors, layout.k);
    const path = new Set(run.visitedNodeIds);
    const legalIds = new Set(legal.map((n) => n.id));
    let selected: StoryNode | null = openDuel ?? (legal.length === 1 ? legal[0] : null);
    const nodes = storyMapNodes(map);
    const reachable = reachableNodeIds(nodes, run.nodeId);
    const bossNode = nodes.find((n) => n.kind === 'boss' && n.avatarId);
    const bossName = bossNode?.avatarId ? storyAvatarById(bossNode.avatarId)?.name ?? null : null;
    const highContrast = currentAccessibility().highContrast;
    const pulse = this.host.save.settings.animations === 'full' && !prefersReducedMotion();
    const gold = colorInt(theme.colors.gold);
    const at = (id: string): { x: number; y: number; r: number } => {
      const s = plan.stops.get(id)!;
      return { x: s.x, y: s.y, r: s.d / 2 };
    };
    const trails = this.scene.add.graphics();
    const spacing = Math.max(7, Math.round(9 * Math.min(layout.k, 1.3)));
    for (const node of nodes) {
      const a = at(node.id);
      for (const nextId of node.nextNodeIds) {
        const b = at(nextId);
        const walked = path.has(node.id) && path.has(nextId);
        const open = node.id === run.nodeId && legalIds.has(nextId);
        const ahead = reachable.has(nextId) && (reachable.has(node.id) || node.id === run.nodeId);
        const colour = walked || open ? gold : ahead ? colorInt(theme.colors.body) : theme.graphics.panelStroke;
        const alpha = walked || open ? 1 : ahead ? 0.75 : 0.6;
        const dot = walked ? 2.6 : open ? 2.3 : 1.8;
        for (const d of trailDots(a, a.r, b, b.r, walked || open ? spacing : spacing + 2, 4)) {
          trails.fillStyle(theme.graphics.dim, 0.75 * alpha).fillCircle(d.x, d.y + 0.6, dot + 1.1);
          trails.fillStyle(colour, alpha).fillCircle(d.x, d.y, dot);
        }
      }
    }
    let peek: StoryNode | null = null;
    let hovered: StoryNode | null = null;
    const rings = new Map<string, Phaser.GameObjects.Graphics>();
    const drawRing = (node: StoryNode): void => {
      const c = at(node.id);
      const g = rings.get(node.id)!.clear();
      if (selected?.id === node.id) g.lineStyle(theme.outline.state + 1, colorInt(theme.colors.goldHover), 1).strokeCircle(c.x, c.y, c.r + 3);
      else if (node.id === run.nodeId) g.lineStyle(theme.outline.state, gold, 1).strokeCircle(c.x, c.y, c.r + 3);
      else if (legalIds.has(node.id)) g.lineStyle(2, gold, 1).strokeCircle(c.x, c.y, c.r + 2);
      if ((hovered?.id === node.id || peek?.id === node.id) && selected?.id !== node.id) {
        g.lineStyle(2, colorInt(theme.colors.heading), 0.9).strokeCircle(c.x, c.y, c.r + (legalIds.has(node.id) || node.id === run.nodeId ? 6 : 3));
      }
    };
    const glowKey = bakeStopGlow(this.scene, 128);
    for (const node of nodes) {
      const c = at(node.id);
      const d = c.r * 2;
      const face = stopFace(node.id, path, reachable);
      const isLegal = legalIds.has(node.id);
      const isCurrent = node.id === run.nodeId;
      if (isLegal || isCurrent) {
        const halo = this.scene.add.image(c.x, c.y, glowKey).setTint(colorInt(isCurrent ? theme.colors.goldHover : theme.colors.gold));
        halo.setDisplaySize(d * 1.75, d * 1.75).setAlpha(isCurrent ? 0.75 : 0.6);
        if (isLegal && pulse) {
          const sc = halo.scaleX;
          this.scene.tweens.add({ targets: halo, alpha: { from: 0.3, to: 0.85 }, scale: { from: sc * 0.9, to: sc * 1.08 }, duration: 1100, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
        }
      }
      const avatar = node.kind === 'boss' && node.avatarId ? storyAvatarById(node.avatarId) : null;
      const portraitKey = this.host.bossPortraitKey(avatar?.name ?? null, face, d, highContrast);
      const name = avatar ? `${NODE_KIND_LABEL[node.kind]}: ${avatar.name}` : NODE_KIND_LABEL[node.kind];
      addStopMedallion(this.scene, c.x, c.y, node.kind, face, d, highContrast, portraitKey)[0].setName(name);
      rings.set(node.id, this.scene.add.graphics());
      if (isCurrent) this.text(c.x, c.y - c.r - 4, 'You', type.caption, theme.colors.gold, { bold: true }).setOrigin(0.5, 1);
      else if (isLegal) this.text(c.x, c.y + c.r + 3, 'Next', type.caption, theme.colors.gold, { bold: true }).setOrigin(0.5, 0);
      const zone = this.scene.add.zone(c.x, c.y, plan.hit, plan.hit).setName(name).setInteractive({ useHandCursor: isLegal });
      zone.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) return;
        hovered = node;
        drawRing(node);
        refreshPanel();
      });
      zone.on('pointerout', () => {
        if (hovered?.id !== node.id) return;
        hovered = null;
        drawRing(node);
        refreshPanel();
      });
      bindTapButton(this.scene, zone, () => {
        const was = [selected, peek];
        if (isLegal) {
          selected = node;
          peek = null;
        } else {
          peek = peek?.id === node.id ? null : node;
        }
        for (const n of was) if (n) drawRing(n);
        drawRing(node);
        refreshPanel();
      });
      drawRing(node);
    }

    // The column: the stop in view, then View deck and Map key, Abandon run, and the stop's action.
    const col = layout.column;
    const rowY = col.foot.y - COMPACT.gap - COMPACT.touch;
    const abandonY = rowY - COMPACT.gap - COMPACT.touch;
    const half = Math.floor((col.foot.width - COMPACT.gap) / 2);
    // The icons drop when a label and its icon would overrun the button (large text).
    const probe = this.scene.add.text(0, 0, 'View deck', { fontFamily: theme.fonts.ui, fontSize: `${theme.compactType.body}px`, fontStyle: theme.weight.w600 });
    const withIcons = probe.width + theme.compactType.body * 1.45 + 10 + 8 <= half;
    probe.destroy();
    compactButton(this.scene, { x: col.foot.x, y: rowY, width: half, height: COMPACT.touch }, 'View deck', { icon: withIcons ? 'deck' : undefined, onTap: () => this.viewDeck(run) });
    compactButton(this.scene, { x: col.foot.x + half + COMPACT.gap, y: rowY, width: col.foot.width - half - COMPACT.gap, height: COMPACT.touch }, 'Map key', { icon: withIcons ? 'help' : undefined, onTap: () => this.mapKey(bossName) });
    let armed = false;
    let disarm: Phaser.Time.TimerEvent | null = null;
    const body: Rect = { x: col.body.x, y: col.body.y, width: col.body.width, height: Math.max(0, abandonY - COMPACT.gap - col.body.y) };
    const note = this.text(body.x, body.y + body.height, abandonNote(run, false), type.caption, theme.colors.muted, { wrap: body.width }).setOrigin(0, 1);
    const abandon = compactButton(this.scene, { x: col.foot.x, y: abandonY, width: col.foot.width, height: COMPACT.touch }, 'Abandon run', {
      variant: 'danger',
      onTap: (pointer) => {
        if (this.host.save.settings.confirmDestructive && !armed) {
          armed = true;
          abandon.setLabel(`${pointer?.wasTouch ?? isTouchDevice() ? 'Tap' : 'Click'} again to abandon`);
          note.setText(abandonNote(run, true)).setColor(theme.colors.danger);
          disarm?.remove(false);
          disarm = this.scene.time.delayedCall(ABANDON_ARM_MS, () => {
            disarm = null;
            armed = false;
            if (abandon.container.active) abandon.setLabel('Abandon run');
            if (note.active) note.setText(abandonNote(run, false)).setColor(theme.colors.muted);
          });
          return;
        }
        disarm?.remove(false);
        disarm = null;
        const result = abandonRun(this.host.story);
        if (!result.ok) return this.host.refused(result.reason);
        this.host.commit();
      },
    });
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => disarm?.remove(false));
    const go = compactButton(this.scene, col.foot, 'Choose a stop', { variant: 'primary', onTap: () => this.host.goTo(run, selected, openDuel !== null) });
    const eyebrow = this.text(body.x, body.y, '', type.label, theme.colors.gold, { bold: true, wrap: body.width }).setLetterSpacing(1);
    const detailName = this.text(body.x, 0, '', type.h2, theme.colors.heading, { display: true, bold: true, wrap: body.width });
    const detailBody = this.text(body.x, 0, '', type.label, theme.colors.body, { wrap: body.width });
    const notice = this.text(body.x, 0, '', type.label, theme.colors.danger, { bold: true, wrap: body.width });
    this.notice = notice;
    this.host.setNotice(notice);
    const refreshPanel = (): void => {
      const shown = hovered ?? peek ?? selected;
      if (!shown) {
        eyebrow.setText('NEXT STOP');
        detailName.setText('Choose a stop');
        detailBody.setText('Tap a stop marked Next. Tap any other stop to read it.');
      } else {
        const avatar = shown.avatarId ? storyAvatarById(shown.avatarId) : null;
        eyebrow.setText(shown === selected ? (openDuel ? 'YOUR DUEL' : 'NEXT STOP') : 'STOP');
        detailName.setText(avatar ? `${NODE_KIND_LABEL[shown.kind]}: ${avatar.name}` : NODE_KIND_LABEL[shown.kind]);
        const summary = avatar ? `${avatar.title}. ${nodeSummary(shown.kind)}` : nodeSummary(shown.kind);
        const standing = mapStopStanding(shown.id === run.nodeId, legalIds.has(shown.id), stopFace(shown.id, path, reachable));
        detailBody.setText(shown === selected || legalIds.has(shown.id) ? summary : `${standing} ${summary}`);
      }
      detailName.setY(eyebrow.y + eyebrow.height + 4);
      detailBody.setY(detailName.y + detailName.height + 4);
      notice.setY(detailBody.y + detailBody.height + 4);
      // The abandon note gives way when the stop's words reach it.
      note.setVisible(detailBody.y + detailBody.height + 4 <= note.y - note.height);
      go.setEnabled(!!selected);
      go.setLabel(selected ? nodeActionLabel(selected.kind) : 'Choose a stop');
    };
    refreshPanel();
    if (mapKeyDue(this.host.story)) this.mapKey(bossName, true);
  }

  /** The map key: every stop's medallion, name and line, two columns; Got it. `first` marks it seen. */
  mapKey(bossName: string | null, first = false): void {
    if (this.sheet) return;
    const { shell, layout } = this.fullSheet(MAP_KEY_TITLE, 'Next marks where you can go now. Tap any stop to read it.', () => {
      if (!first) return;
      markMapKeySeen(this.host.story);
      if (!this.host.fixture) Services.save.flush();
    });
    const c = shell.container;
    const type = this.type;
    const highContrast = currentAccessibility().highContrast;
    const rows = mapKeyRows();
    const area = { x: layout.shell.main.x, y: layout.shell.main.y, width: layout.column.foot.x + layout.column.foot.width - layout.shell.main.x, height: layout.column.foot.y - COMPACT.gap - layout.shell.main.y };
    const perCol = Math.ceil(rows.length / 2);
    const colW = Math.floor((area.width - COMPACT.gap) / 2);
    const rowH = Math.floor((area.height - COMPACT.gap * (perCol - 1)) / perCol);
    const d = Math.max(24, Math.min(Math.round(STORY_COMPACT.stopD * layout.k), rowH - 8));
    rows.forEach((row, i) => {
      const r = { x: area.x + Math.floor(i / perCol) * (colW + COMPACT.gap), y: area.y + (i % perCol) * (rowH + COMPACT.gap), width: colW, height: rowH };
      c.add(this.scene.add.graphics()
        .fillStyle(theme.graphics.rowFill, 1).fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control)
        .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome).strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control));
      const portrait = row.kind === 'boss' ? this.host.bossPortraitKey(bossName, 'live', d, highContrast) : null;
      c.add(addStopMedallion(this.scene, r.x + 8 + d / 2, r.y + r.height / 2, row.kind, 'live', d, highContrast, portrait));
      const tx = r.x + 8 + d + 10;
      const tw = r.x + r.width - 8 - tx;
      const name = this.text(tx, 0, row.name, type.body, theme.colors.heading, { bold: true, wrap: tw });
      const sum = this.text(tx, 0, row.summary, type.label, theme.colors.body, { wrap: tw });
      const room = r.height - 8 - name.height - 2;
      const lineH = sum.height / Math.max(1, sum.getWrappedText().length);
      if (sum.height > room) sum.setMaxLines(Math.max(1, Math.floor(room / lineH)));
      const top = r.y + (r.height - name.height - 2 - sum.height) / 2;
      name.setY(top);
      sum.setY(top + name.height + 2);
      c.add([name, sum]);
    });
    c.add(compactButton(this.scene, layout.column.foot, sentenceCase(MAP_KEY_CLOSE), { variant: 'primary', onTap: () => shell.close() }).container);
  }

  // ------------------------------------------------------------------ scenes and events

  /** A speaker's portrait in its panel (the cutout over the still), the name on a plate at its foot. */
  private scenePortrait(r: Rect, portrait: StoryPortrait, name: string | null): void {
    const key = storyTextureKey(portraitArtId(portrait.speakerId, portrait.expression));
    this.scene.add.graphics().fillStyle(theme.graphics.dim, 0.55).fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel);
    if (this.scene.textures.exists(key)) {
      const img = this.scene.add.image(0, 0, key);
      coverFitImage(img, { x: r.x + 2, y: r.y + 2, width: r.width - 4, height: r.height - 4 }, 0.08);
    }
    this.scene.add.graphics().lineStyle(2, colorInt(theme.colors.gold), 0.9).strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.panel);
    if (!name) return;
    const t = this.text(0, 0, name, this.type.label, theme.colors.gold, { display: true, bold: true });
    const plateW = Math.min(r.width - 12, t.width + 20);
    const plateH = t.height + 8;
    const px = r.x + (r.width - plateW) / 2;
    const py = r.y + r.height - 6 - plateH;
    this.scene.add.graphics().fillStyle(theme.graphics.panelFill, 0.92).fillRoundedRect(px, py, plateW, plateH, theme.radius.control);
    this.scene.children.bringToTop(t);
    if (t.width > plateW - 12) ellipsizeText(t, plateW - 12);
    t.setOrigin(0.5).setPosition(r.x + r.width / 2, py + plateH / 2);
  }

  /** A dark band down from the top over a scene's bright still, so the top bar reads. */
  private headerScrim(shell: CompactShell): void {
    const bottom = shell.main.y;
    const g = this.scene.add.graphics();
    const bands = 10;
    const full = bottom * 0.6;
    g.fillStyle(theme.graphics.dim, 0.7).fillRect(0, 0, this.stage.width, full);
    const step = (bottom - full) / bands;
    for (let i = 0; i < bands; i++) g.fillStyle(theme.graphics.dim, 0.7 * (1 - (i + 1) / (bands + 1))).fillRect(0, full + i * step, this.stage.width, step + 0.5);
  }

  /** Whether a portrait's art is loaded (a missing file shows the text alone). */
  private hasPortrait(portrait: StoryPortrait | null): portrait is StoryPortrait {
    return !!portrait && this.scene.textures.exists(storyTextureKey(portraitArtId(portrait.speakerId, portrait.expression)));
  }

  /**
   * A scene's lines (frame N-34's left two thirds): the speaker's portrait,
   * the line's panel, the read-on hint, and Continue at the column's foot;
   * Backlog and Skip in the top bar. Continue is the button, a tap anywhere,
   * or Space or Enter. Everything it draws sits over the tap surface.
   */
  dialogue(stage: StoryStage, opts: DialogueOptions & { header: string; subtitle: string }): StoryDialogueHandle {
    const scene = this.scene;
    const content = this.stage.content;
    const type = this.type;
    const lineSize = Math.round(type.body * 1.15);
    let index = Math.max(0, Math.min(opts.lines.length - 1, opts.startAt ?? 0));
    let finished = false;
    let line: Phaser.GameObjects.GameObject[] = [];
    const lift = (from: Set<Phaser.GameObjects.GameObject>): Phaser.GameObjects.GameObject[] => {
      const added = scene.children.list.filter((o) => !from.has(o));
      for (const o of added) (o as unknown as { setDepth?: (d: number) => void }).setDepth?.(DEPTH.layer);
      return added;
    };
    stage.setShade(0.5);
    const probe = this.text(0, 0, 'Tap', type.label, theme.colors.muted);
    const hintH = probe.height;
    probe.destroy();
    const frame = storySceneLayout(content, true, false, hintH);
    const tapZone = scene.add.zone(this.stage.width / 2, this.stage.height / 2, this.stage.width, this.stage.height).setInteractive().setDepth(DEPTH.tap);
    const base = new Set(scene.children.list);
    this.headerScrim(frame.shell);
    compactHeader(scene, frame.shell, { title: opts.header, subtitle: opts.subtitle, onBack: () => this.host.leave() });
    if (opts.extras) {
      const right = frame.shell.right;
      const w = Math.floor((right.width - COMPACT.gap) / 2);
      const y = right.y + (right.height - COMPACT.touch) / 2;
      compactButton(scene, { x: right.x, y, width: w, height: COMPACT.touch }, 'Backlog', { onTap: () => this.backlog(opts.lines, index, opts.heroineId, opts.header) });
      compactButton(scene, { x: right.x + w + COMPACT.gap, y, width: right.width - w - COMPACT.gap, height: COMPACT.touch }, 'Skip', { onTap: () => finish(true) });
    }
    const chrome = lift(base);
    const finish = (skipped: boolean): void => {
      if (finished) return;
      handle.destroy();
      opts.onDone(skipped);
    };
    const advance = (): void => {
      if (finished || this.sheet) return;
      const next = nextLineIndex(index, opts.lines.length);
      if (next === 'done') return finish(false);
      index = next;
      show();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat || finished || this.sheet || sceneHasOpenModal(scene)) return;
      if (event.code === 'Space' || event.code === 'Enter' || event.code === 'NumpadEnter' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault?.();
        advance();
      }
    };
    bindTapButton(scene, tapZone, advance);
    scene.input.keyboard?.on('keydown', onKey);
    const show = (): void => {
      for (const o of line) o.destroy();
      const from = new Set(scene.children.list);
      const view = storyLineView(opts.lines[index], opts.heroineId);
      const portrait = opts.portraitFor ? opts.portraitFor(index) : view.portrait;
      const shown = this.hasPortrait(portrait) ? portrait : null;
      const l = storySceneLayout(content, shown !== null, false, hintH);
      stage.setPortrait(null, null);
      if (shown && l.portrait) this.scenePortrait(l.portrait, shown, view.name);
      this.panelAt(l.text, 0.94);
      const pad = STORY_COMPACT.pad + 4;
      let y = l.text.y + pad;
      // Narration, or a speaker without art, names the speaker in the panel instead.
      if (view.name && !shown) {
        const name = this.text(l.text.x + pad, y, view.name.toUpperCase(), type.label, theme.colors.gold, { bold: true });
        name.setLetterSpacing(1);
        y += name.height + 6;
      }
      const body = this.text(l.text.x + pad, y, view.text, lineSize, view.name ? theme.colors.heading : theme.colors.body, { wrap: l.text.width - 2 * pad });
      body.setLineSpacing(Math.round(lineSize * 0.35));
      const last = index === opts.lines.length - 1;
      const count = this.text(l.hint.x + l.hint.width, l.hint.y, `${index + 1} / ${opts.lines.length}`, type.label, theme.colors.muted).setOrigin(1, 0);
      const hint = this.text(l.hint.x, l.hint.y, last ? 'Tap anywhere or press Continue' : 'Tap anywhere or Continue to read on', type.label, theme.colors.muted);
      if (hint.width > l.hint.width - count.width - 12) ellipsizeText(hint, Math.max(0, l.hint.width - count.width - 12));
      compactButton(scene, l.column.foot, last ? opts.finalLabel ?? 'Continue' : 'Continue', { variant: 'primary', onTap: advance });
      line = lift(from);
      void body;
    };
    const handle: StoryDialogueHandle = {
      advance,
      skip: () => finish(true),
      destroy: () => {
        finished = true;
        scene.input.keyboard?.off('keydown', onKey);
        for (const o of [...line, ...chrome]) o.destroy();
        line = [];
        if (tapZone.active) tapZone.destroy();
      },
    };
    show();
    if (opts.openBacklog) this.backlog(opts.lines, index, opts.heroineId, opts.header);
    return handle;
  }

  /** The lines so far, scrolling, newest at the foot (shown first). */
  private backlog(lines: readonly StoryLine[], upTo: number, heroineId: string | null, title: string): void {
    if (this.sheet) return;
    const { shell, layout } = this.fullSheet('Backlog', title);
    const c = shell.container;
    const area: Rect = { x: layout.shell.main.x, y: layout.shell.main.y, width: layout.column.foot.x + layout.column.foot.width - layout.shell.main.x, height: layout.column.foot.y - COMPACT.gap - layout.shell.main.y };
    const list = this.scene.add.container(0, area.y);
    c.add(list);
    let y = 0;
    for (const entry of backlogEntries(lines, upTo, heroineId)) {
      if (entry.name) {
        const name = this.text(area.x, y, entry.name, this.type.label, theme.colors.gold, { bold: true, wrap: area.width - 12 });
        list.add(name);
        y += name.height + 2;
      }
      const t = this.text(area.x, y, entry.text, this.type.body, entry.name ? theme.colors.heading : theme.colors.body, { wrap: area.width - 12 });
      list.add(t);
      y += t.height + 14;
    }
    const contentH = Math.max(0, y - 14);
    bindMenuScroll(this.scene, list, area, contentH, () => false, [], 0, undefined, Math.max(0, contentH - area.height));
    c.add(compactButton(this.scene, layout.column.foot, 'Close', { onTap: () => shell.close() }).container);
  }

  /**
   * An event's choices (frame N-34): the speaker and the scene's last line,
   * then the choices in the column, a tap choosing and Choose going on. A
   * choice that cannot be taken is faded and says why. Returns the notice line.
   */
  choices(stage: StoryStage, opts: { header: string; subtitle: string; run: StoryRun; speaker: StoryPortrait | null; line: StoryLineView | null; rows: readonly ChoiceRowSpec[]; onChoose: (index: number) => void }): Phaser.GameObjects.Text {
    const type = this.type;
    const shown = this.hasPortrait(opts.speaker) ? opts.speaker : null;
    stage.setPortrait(null, null);
    stage.setShade(0.5);
    const l = storySceneLayout(this.stage.content, shown !== null, true, 0);
    this.headerScrim(l.shell);
    this.header(l, opts.header, opts.subtitle, opts.run);
    if (shown && l.portrait) this.scenePortrait(l.portrait, shown, opts.line?.name ?? null);
    this.panelAt(l.text, 0.94);
    const pad = STORY_COMPACT.pad + 4;
    if (opts.line) {
      const lineSize = Math.round(type.body * 1.15);
      const t = this.text(l.text.x + pad, l.text.y + pad, opts.line.text, lineSize, theme.colors.heading, { wrap: l.text.width - 2 * pad });
      t.setLineSpacing(Math.round(lineSize * 0.35));
    }
    const col = l.column;
    let y = this.eyebrow(col.body.x, col.body.y, 'Choose', col.body.width);
    let picked = -1;
    const inset = 12;
    const plates: { g: Phaser.GameObjects.Graphics; r: Rect; enabled: boolean }[] = [];
    opts.rows.forEach((row, i) => {
      const enabled = row.reason === null;
      const label = this.text(col.body.x + inset, 0, row.label, type.body, enabled ? theme.colors.heading : theme.colors.body, { bold: true, wrap: col.body.width - 2 * inset });
      const reason = row.reason ? this.text(col.body.x + inset, 0, row.reason, type.label, theme.colors.danger, { wrap: col.body.width - 2 * inset }) : null;
      const h = Math.max(COMPACT.touch, label.height + (reason ? 2 + reason.height : 0) + 16);
      const r = { x: col.body.x, y, width: col.body.width, height: h };
      const g = this.scene.add.graphics();
      plates.push({ g, r, enabled });
      this.scene.children.bringToTop(label);
      label.setY(r.y + (h - label.height - (reason ? 2 + reason.height : 0)) / 2);
      if (reason) {
        this.scene.children.bringToTop(reason);
        reason.setY(label.y + label.height + 2);
      }
      if (!enabled) label.setAlpha(0.8);
      else {
        const zone = this.scene.add.zone(r.x + r.width / 2, r.y + r.height / 2, r.width, r.height).setInteractive({ useHandCursor: true });
        bindTapButton(this.scene, zone, () => {
          picked = i;
          draw();
        });
      }
      y += h + COMPACT.gap;
    });
    const choose = compactButton(this.scene, col.foot, 'Choose', { variant: 'primary', onTap: () => {
      if (picked >= 0) opts.onChoose(picked);
    } });
    const draw = (): void => {
      for (const [i, p] of plates.entries()) {
        const on = i === picked;
        p.g.clear()
          .fillStyle(on ? theme.graphics.rowFillActive : theme.graphics.rowFill, p.enabled ? 0.96 : theme.alpha.subtle)
          .fillRoundedRect(p.r.x, p.r.y, p.r.width, p.r.height, theme.radius.panel)
          .lineStyle(on ? 2.5 : 1.5, on ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, p.enabled ? 1 : theme.alpha.subtle)
          .strokeRoundedRect(p.r.x, p.r.y, p.r.width, p.r.height, theme.radius.panel);
      }
      choose.setEnabled(picked >= 0);
    };
    draw();
    const notice = this.text(col.body.x, Math.min(y, col.body.y + col.body.height), '', type.label, theme.colors.danger, { bold: true, wrap: col.body.width });
    this.notice = notice;
    this.host.setNotice(notice);
    return notice;
  }
}
