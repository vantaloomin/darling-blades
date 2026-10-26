import Phaser from 'phaser';
import type { StoryLine } from '../data/story/types';
import { qualityTier } from '../platform/quality';
import { bindTapButton } from '../platform/gestures';
import { ART_WAIT_TEXT_STYLE } from '../ui/artGate';
import type { Rect } from '../ui/layout';
import { menuLineHeight } from '../ui/mainMenuPresentation';
import { sceneStage } from '../ui/SceneBackdrop';
import { ModalGuard } from '../ui/Modal';
import {
  backlogEntries,
  backlogPages,
  nextLineIndex,
  portraitArtId,
  storyArtUrl,
  storyChoicePanelLayout,
  storyChoiceTextWidth,
  storyDialogueLayout,
  storyDialogueLineSpacing,
  storyDialogueNameSize,
  storyDialogueTextSize,
  storyDialogueTextWidth,
  storyDialogueTitleMaxWidth,
  storyDialogueTitleSize,
  storyLineView,
  type StoryPortrait,
} from '../ui/storyDialogue';
import { colorInt, theme } from '../ui/theme';
import { modalShell, pager, PAGER_CENTER_OFFSET, sceneHasOpenModal, themedButton } from '../ui/themeWidgets';

/**
 * Story Mode's scene player (docs/plan-story-mode.md, "story spine"): the
 * Phaser half of src/ui/storyDialogue.ts. A still background, the speaker's
 * portrait beside the dialogue box, the name plate and the line, with
 * Continue, Backlog and Skip; and the event choice panel over the same still.
 * V1 is stills only: nothing here animates.
 *
 * Story art loads on demand through the scene's own loader, full size or the
 * half set by quality tier, under texture keys with one prefix, and is freed
 * by prefix (`releaseStoryArt`) so nothing outlives the Story scene.
 */

const TEXTURE_PREFIX = 'story-art:';

export function storyTextureKey(id: string): string {
  return TEXTURE_PREFIX + id;
}

/** Files that failed this session; not asked for again (the stand-in shows instead). */
const failedArt = new Set<string>();

/**
 * Load story art (`bg-*`, `pt-*` ids), then call `onDone`, also when a file
 * fails (the caller draws without it). `onDone` never fires into a scene that
 * has shut down.
 */
export function loadStoryArt(scene: Phaser.Scene, ids: readonly string[], onDone: () => void): void {
  const missing = ids.filter((id) => !scene.textures.exists(storyTextureKey(id)) && !failedArt.has(id));
  if (missing.length === 0) {
    onDone();
    return;
  }
  // An image already on its way (a Play screen started again before its
  // first load landed: a stopped scene's loader still finishes the file) is
  // waited for, not queued twice, which Phaser refuses ("Texture key already in use").
  const fresh = missing.filter((id) => !loadingArt.has(id));
  for (const id of fresh) loadingArt.set(id, storyArtArrival(scene, id));
  let live = true;
  const cancel = (): void => {
    live = false;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
  if (fresh.length > 0) {
    const tier = qualityTier();
    for (const id of fresh) scene.load.image(storyTextureKey(id), storyArtUrl(id, tier));
    scene.load.start();
  }
  void Promise.all(missing.map((id) => loadingArt.get(id))).then(() => {
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
    if (live && scene.sys.isActive()) onDone();
  });
}

/** Story images on their way, each settling when its texture lands, its load fails, or after 20 s. */
const loadingArt = new Map<string, Promise<void>>();

function storyArtArrival(scene: Phaser.Scene, id: string): Promise<void> {
  const key = storyTextureKey(id);
  const textures = scene.textures;
  const loader = scene.load;
  return new Promise<void>((resolve) => {
    const settle = (): void => {
      textures.off(Phaser.Textures.Events.ADD_KEY + key, settle);
      loader.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      window.clearTimeout(timer);
      loadingArt.delete(id);
      resolve();
    };
    const onError = (file: Phaser.Loader.File): void => {
      if (String(file.key) !== key) return;
      failedArt.add(id);
      console.warn(`Story art did not load: ${String(file.url)}`);
      settle();
    };
    const timer = window.setTimeout(settle, 20_000);
    textures.once(Phaser.Textures.Events.ADD_KEY + key, settle);
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
  });
}

/** Free every loaded story texture except those for `keepIds`. */
export function releaseStoryArt(textures: Phaser.Textures.TextureManager, keepIds: Iterable<string> = []): void {
  const keep = new Set([...keepIds].map(storyTextureKey));
  for (const key of textures.getTextureKeys()) {
    if (key.startsWith(TEXTURE_PREFIX) && !keep.has(key)) textures.remove(key);
  }
}

/** The loading line over the backdrop while a scene's art comes in. */
export function storyArtWaitLabel(scene: Phaser.Scene): Phaser.GameObjects.Text {
  const stage = sceneStage(scene);
  return scene.add.text(stage.width / 2, stage.height / 2, 'Unsheathing Blades…', ART_WAIT_TEXT_STYLE).setOrigin(0.5).setDepth(DEPTH.layer);
}

/**
 * Draw order: the still, its shade and the portrait under everything the
 * scene draws at the default depth (so a step's cards and captions sit over
 * the still); the tap-anywhere surface, then the box; the scene's back button
 * on top.
 */
export const DEPTH = { still: -3, shade: -2, portrait: -1, tap: 1, layer: 2, chrome: 6 } as const;

/**
 * The still behind a scene: the background cover-fit to the 16:9 frame (the
 * Story backdrop stays when it is missing) and one portrait.
 */
export class StoryStage {
  private background: Phaser.GameObjects.Image | null = null;
  private shade: Phaser.GameObjects.Rectangle | null = null;
  private portrait: Phaser.GameObjects.Image | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Show the background; false (the Story backdrop stays) when its art is missing. */
  setBackground(id: string): boolean {
    this.background?.destroy();
    this.background = null;
    const key = storyTextureKey(id);
    if (!this.scene.textures.exists(key)) return false;
    // The whole design space: the 1280x720 window, or a compact scene's own.
    const stage = sceneStage(this.scene);
    const img = this.scene.add.image(stage.width / 2, stage.height / 2, key).setDepth(DEPTH.still);
    img.setScale(Math.max(stage.width / img.width, stage.height / img.height));
    this.background = img;
    return true;
  }

  /** A dim over the still (the pick step reads card text over it); 0 removes it. */
  setShade(alpha: number): void {
    this.shade?.destroy();
    const stage = sceneStage(this.scene);
    this.shade = alpha > 0
      ? this.scene.add.rectangle(stage.width / 2, stage.height / 2, stage.width, stage.height, theme.graphics.dim, alpha).setDepth(DEPTH.shade)
      : null;
  }

  /** Show `portrait` filling `rect` (null hides it). A missing file shows nothing. */
  setPortrait(portrait: StoryPortrait | null, rect: Rect | null): void {
    const key = portrait ? storyTextureKey(portraitArtId(portrait.speakerId, portrait.expression)) : null;
    if (!portrait || !rect || !key || !this.scene.textures.exists(key)) {
      this.portrait?.destroy();
      this.portrait = null;
      return;
    }
    if (!this.portrait?.active) this.portrait = this.scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH.portrait);
    else this.portrait.setTexture(key);
    // Left-hand speakers face into the scene as drawn; the art is not mirrored.
    this.portrait.setPosition(rect.x, rect.y).setDisplaySize(rect.width, rect.height);
  }

  destroy(): void {
    this.background?.destroy();
    this.shade?.destroy();
    this.portrait?.destroy();
    this.background = this.shade = this.portrait = null;
  }
}

export interface DialogueOptions {
  lines: readonly StoryLine[];
  heroineId: string | null;
  /** The script heading, shown on the first line; null for none. */
  title: string | null;
  /** The back button's hit rect: the title centres clear of it. */
  backHit: Rect;
  /** The line to open on (dev fixtures); clamped to the scene. */
  startAt?: number;
  /** Offer Backlog and Skip (every scene; the event result offers neither). */
  extras: boolean;
  /** Continue's label on the last line (the next thing that happens). */
  finalLabel?: string;
  /** Replace a line's portrait (the event result shows the reacting speaker over a narrated line). */
  portraitFor?: (index: number) => StoryPortrait | null;
  /** Open the backlog at once (dev fixtures). */
  openBacklog?: boolean;
  /** The scene finished: the last line was continued past, or Skip was pressed. */
  onDone: (skipped: boolean) => void;
}

/**
 * Plays a scene's lines one tap at a time over a `StoryStage`. Continue is the
 * button, a tap anywhere outside another control, or Space or Enter; Backlog
 * opens the lines so far in a paged modal; Skip ends the scene.
 */
export class StoryDialoguePlayer {
  private index: number;
  private layer: Phaser.GameObjects.Container | null = null;
  private readonly tapZone: Phaser.GameObjects.Zone;
  private readonly guard = new ModalGuard();
  private finished = false;
  /** The tallest line of the scene, measured once, so the box keeps one size through it. */
  private textHeight = 0;
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.repeat || this.finished || sceneHasOpenModal(this.scene)) return;
    if (event.code === 'Space' || event.code === 'Enter' || event.code === 'NumpadEnter' || event.key === ' ' || event.key === 'Enter') {
      event.preventDefault?.();
      this.advance();
    }
  };

  constructor(private readonly scene: Phaser.Scene, private readonly stage: StoryStage, private readonly opts: DialogueOptions) {
    this.index = Math.max(0, Math.min(opts.lines.length - 1, opts.startAt ?? 0));
    for (const line of opts.lines) {
      const probe = this.text(line.text, storyDialogueTextSize(), theme.colors.heading, { wrap: storyDialogueTextWidth() });
      this.textHeight = Math.max(this.textHeight, probe.height);
      probe.destroy();
    }
    this.tapZone = scene.add.zone(theme.design.centerX, theme.design.centerY, theme.design.width, theme.design.height)
      .setInteractive().setDepth(DEPTH.tap);
    bindTapButton(scene, this.tapZone, () => this.advance());
    scene.input.keyboard?.on('keydown', this.onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.show();
    if (opts.openBacklog) this.openBacklog();
  }

  advance(): void {
    if (this.finished) return;
    const next = nextLineIndex(this.index, this.opts.lines.length);
    if (next === 'done') return this.finish(false);
    this.index = next;
    this.show();
  }

  skip(): void {
    if (!this.finished) this.finish(true);
  }

  destroy(): void {
    this.finished = true;
    this.scene.input.keyboard?.off('keydown', this.onKey);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.guard.close();
    this.layer?.destroy();
    this.layer = null;
    if (this.tapZone.active) this.tapZone.destroy();
  }

  private finish(skipped: boolean): void {
    this.destroy();
    this.opts.onDone(skipped);
  }

  private text(copy: string, size: number, color: string, opts: { display?: boolean; bold?: boolean; wrap?: number } = {}): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, copy, {
      fontFamily: opts.display ? theme.fonts.display : theme.fonts.ui,
      fontSize: `${size}px`,
      color,
      ...(opts.bold ? { fontStyle: theme.weight.w700 } : {}),
      ...(opts.wrap ? { wordWrap: { width: opts.wrap, useAdvancedWrap: true } } : {}),
      lineSpacing: storyDialogueLineSpacing(size),
    });
  }

  /** Draw the current line: measure the text, name and title, place, then draw. */
  private show(): void {
    this.layer?.destroy();
    const layer = this.scene.add.container(0, 0).setDepth(DEPTH.layer);
    this.layer = layer;
    const line = this.opts.lines[this.index];
    const view = storyLineView(line, this.opts.heroineId);
    const portrait = this.opts.portraitFor ? this.opts.portraitFor(this.index) : view.portrait;
    const last = this.index === this.opts.lines.length - 1;

    const body = this.text(view.text, storyDialogueTextSize(), theme.colors.heading, { wrap: storyDialogueTextWidth() });
    const name = view.name ? this.text(view.name, storyDialogueNameSize(), theme.colors.gold, { display: true, bold: true }) : null;
    const titleCopy = this.index === 0 ? this.opts.title : null;
    const title = titleCopy
      ? this.text(titleCopy, storyDialogueTitleSize(), theme.colors.heading, { display: true, bold: true, wrap: storyDialogueTitleMaxWidth(this.opts.backHit) }).setAlign('center')
      : null;
    const go = themedButton(this.scene, 0, 0, last ? this.opts.finalLabel ?? 'Continue' : 'Continue', {
      variant: 'primary', minWidth: 160, onTap: () => this.advance(),
    });
    const backlog = this.opts.extras ? themedButton(this.scene, 0, 0, 'Backlog', { variant: 'ghost', minWidth: 120, onTap: () => this.openBacklog() }) : null;
    const skip = this.opts.extras ? themedButton(this.scene, 0, 0, 'Skip', { variant: 'ghost', minWidth: 120, onTap: () => this.skip() }) : null;
    const hit = (b: ReturnType<typeof themedButton> | null): { width: number; height: number } | null => (b ? b.getMeasuredSize().hit : null);

    const l = storyDialogueLayout({
      side: portrait?.side ?? null,
      textHeight: Math.max(this.textHeight, body.height),
      nameWidth: name ? name.width : null,
      continueHit: hit(go)!,
      backlogHit: hit(backlog),
      skipHit: hit(skip),
      title: title ? { width: title.width, height: title.height } : null,
    });
    this.stage.setPortrait(portrait, l.portrait);

    const g = this.scene.add.graphics();
    // Opaque, like every modal panel: the portrait's lower half stands behind it.
    g.fillStyle(theme.graphics.panelFill, 1).fillRoundedRect(l.box.x, l.box.y, l.box.width, l.box.height, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(l.box.x, l.box.y, l.box.width, l.box.height, theme.radius.panel);
    if (l.namePlate) {
      const p = l.namePlate;
      g.fillStyle(theme.graphics.rowFillActive, 1).fillRoundedRect(p.x, p.y, p.width, p.height, theme.radius.control)
        .lineStyle(theme.control.borderWidth, colorInt(theme.colors.gold), 1).strokeRoundedRect(p.x, p.y, p.width, p.height, theme.radius.control);
    }
    if (l.title) {
      const t = l.title;
      g.fillStyle(theme.graphics.panelFill, theme.alpha.panel).fillRoundedRect(t.x, t.y, t.width, t.height, theme.radius.panel)
        .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome).strokeRoundedRect(t.x, t.y, t.width, t.height, theme.radius.panel);
    }
    layer.add(g);
    layer.add(body.setPosition(l.text.x, l.text.y));
    if (name && l.namePlate) layer.add(name.setOrigin(0.5).setPosition(l.namePlate.x + l.namePlate.width / 2, l.namePlate.y + l.namePlate.height / 2));
    if (title && l.title) layer.add(title.setOrigin(0.5).setPosition(l.title.x + l.title.width / 2, l.title.y + l.title.height / 2));
    const place = (b: ReturnType<typeof themedButton> | null, r: Rect | null): void => {
      if (!b || !r) return;
      layer.add(b.container.setPosition(r.x + r.width / 2, r.y + r.height / 2));
    };
    place(go, l.continue);
    place(backlog, l.backlog);
    place(skip, l.skip);
  }

  /** The lines so far, newest page first shown, in a dismissible modal. */
  openBacklog(): void {
    if (this.finished || sceneHasOpenModal(this.scene)) return;
    const width = Math.min(theme.design.safeWidth, 960);
    const height = theme.design.safeHeight;
    this.guard.open(interactiveTargets(this.scene));
    const shell = modalShell(this.scene, {
      width,
      height,
      titleTrackHeight: Math.max(theme.control.minHitHeight, menuLineHeight(theme.type.h1)),
      dismissal: 'dismissible',
      onClose: () => this.guard.close(),
    });
    const c = shell.container;
    c.add(this.text('Backlog', theme.type.h1, theme.colors.heading, { display: true }).setPosition(shell.tracks.titleTrack.x, shell.tracks.titleTrack.y));
    const content = shell.tracks.contentBounds;
    const gap = theme.space(4);
    const entries = backlogEntries(this.opts.lines, this.index, this.opts.heroineId).map((entry) => {
      const parts: Phaser.GameObjects.Text[] = [];
      if (entry.name) parts.push(this.text(entry.name, theme.type.label, theme.colors.gold, { bold: true, wrap: content.width }));
      parts.push(this.text(entry.text, theme.type.body, entry.name ? theme.colors.heading : theme.colors.body, { wrap: content.width }));
      const height = parts.reduce((s, t) => s + t.height, 0) + theme.space(1) * (parts.length - 1);
      for (const part of parts) c.add(part.setVisible(false));
      return { parts, height };
    });
    const pages = backlogPages(entries.map((e) => e.height), content.height, gap);
    const render = (page: number): void => {
      for (const e of entries) for (const p of e.parts) p.setVisible(false);
      let y = content.y;
      for (const i of pages[page]) {
        let py = y;
        for (const part of entries[i].parts) {
          part.setPosition(content.x, py).setVisible(true);
          py += part.height + theme.space(1);
        }
        y += entries[i].height + gap;
      }
    };
    const last = pages.length - 1;
    if (pages.length > 1) {
      const footer = shell.tracks.footerTrack;
      const control = pager(this.scene, footer.x + footer.width / 2 - PAGER_CENTER_OFFSET, footer.y + footer.height / 2, last, pages.length, (next) => {
        render(next);
        control.refresh(next, pages.length);
      });
      c.add(control.container);
    }
    render(last);
  }
}

/** Every enabled input target, containers walked (for the modal guard). */
export function interactiveTargets(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const walk = (list: readonly Phaser.GameObjects.GameObject[]): void => {
    for (const obj of list) {
      if (obj.input?.enabled) out.push(obj);
      if (obj instanceof Phaser.GameObjects.Container) walk(obj.list);
    }
  };
  walk(scene.children.list);
  return out;
}

export interface ChoiceRowSpec {
  label: string;
  /** Why the choice cannot be taken; null when it can. */
  reason: string | null;
}

export interface ChoicePanel {
  container: Phaser.GameObjects.Container;
  /** The header's prompt, where a refused resolve is shown. */
  prompt: Phaser.GameObjects.Text;
  destroy(): void;
}

/**
 * The event's choice panel in the dialogue box's place: the prompt and the
 * run's gold and deck, then one row per choice with its label as the script
 * words it. An unavailable choice is faded, does nothing, and says why.
 */
export function drawChoicePanel(
  scene: Phaser.Scene,
  stage: StoryStage,
  speaker: StoryPortrait | null,
  status: string,
  rows: readonly ChoiceRowSpec[],
  onChoose: (index: number) => void,
): ChoicePanel {
  const container = scene.add.container(0, 0).setDepth(DEPTH.layer);
  const width = storyChoiceTextWidth();
  const mk = (copy: string, size: number, color: string, wrap?: number, bold = false): Phaser.GameObjects.Text => scene.add.text(0, 0, copy, {
    fontFamily: theme.fonts.ui, fontSize: `${size}px`, color,
    ...(bold ? { fontStyle: theme.weight.w700 } : {}),
    ...(wrap ? { wordWrap: { width: wrap, useAdvancedWrap: true } } : {}),
  });
  const prompt = mk('Choose one.', theme.type.label, theme.colors.gold, undefined, true);
  const gold = mk(status, theme.type.label, theme.colors.body);
  const blocks = rows.map((row) => {
    const label = mk(row.label, theme.type.body, row.reason ? theme.colors.body : theme.colors.heading, width);
    const reason = row.reason ? mk(row.reason, theme.type.label, theme.colors.danger, width, true) : null;
    return { label, reason, height: label.height + (reason ? theme.space(1) + reason.height : 0) };
  });
  const l = storyChoicePanelLayout(speaker?.side ?? null, Math.max(prompt.height, gold.height), blocks.map((b) => b.height));
  stage.setPortrait(speaker, l.portrait);
  const g = scene.add.graphics()
    .fillStyle(theme.graphics.panelFill, 1).fillRoundedRect(l.box.x, l.box.y, l.box.width, l.box.height, theme.radius.panel)
    .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
    .strokeRoundedRect(l.box.x, l.box.y, l.box.width, l.box.height, theme.radius.panel);
  container.add(g);
  container.add(prompt.setPosition(l.header.x, l.header.y));
  container.add(gold.setOrigin(1, 0).setPosition(l.header.x + l.header.width, l.header.y));
  // The prompt gives way to the status line when both would meet.
  prompt.setWordWrapWidth(Math.max(80, l.header.width - gold.width - theme.space(4)), true);
  blocks.forEach((block, i) => {
    const r = l.rows[i];
    const enabled = rows[i].reason === null;
    const plate = scene.add.graphics();
    const draw = (hover: boolean): void => {
      plate.clear()
        .fillStyle(hover ? theme.graphics.rowFillActive : theme.graphics.rowFill, enabled ? 1 : theme.alpha.subtle)
        .fillRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control)
        .lineStyle(hover ? theme.outline.state : theme.control.borderWidth, hover ? colorInt(theme.colors.goldHover) : enabled ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, enabled ? 1 : theme.alpha.subtle)
        .strokeRoundedRect(r.x, r.y, r.width, r.height, theme.radius.control);
    };
    draw(false);
    container.add(plate);
    container.add(block.label.setPosition(r.x + l.rowInset.x, r.y + l.rowInset.y));
    if (block.reason) container.add(block.reason.setPosition(r.x + l.rowInset.x, block.label.y + block.label.height + theme.space(1)));
    if (!enabled) {
      block.label.setAlpha(0.8);
      return;
    }
    const zone = scene.add.zone(r.x + r.width / 2, r.y + r.height / 2, r.width, r.height).setInteractive({ useHandCursor: true });
    zone.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) draw(true);
    });
    zone.on('pointerout', () => draw(false));
    bindTapButton(scene, zone, () => onChoose(i));
    container.add(zone);
  });
  return {
    container,
    prompt,
    destroy: () => container.destroy(),
  };
}
