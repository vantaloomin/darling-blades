import Phaser from 'phaser';
import { Sfx } from '../audio/sfx';
import { bindTapButton } from '../platform/gestures';
import { ModalGuard } from './Modal';
import { colorInt, theme } from './theme';
import { collapseToastBatch, TOAST_CARD, toastCardLayout, toastStackCenters, type ToastNotice } from './toastQueue';

const TOAST_W = TOAST_CARD.width;
const TOAST_X = theme.design.safeRight - TOAST_W / 2;
const TOAST_ENTRY_MS = 220;
const TOAST_HOLD_MS = 3200;
const TOAST_STAGGER_MS = 140;

export interface ToastOptions {
  /** A scene-local ModalGuard pauses the rail and disables its tap targets. */
  modalGuard?: ModalGuard;
  /** For modal implementations that do not use ModalGuard. */
  isBlocked?: () => boolean;
  /** Holds notices until the owner releases a safe presentation boundary. */
  held?: boolean;
}

interface ToastCard {
  notice: ToastNotice;
  container: Phaser.GameObjects.Container;
  input: Phaser.GameObjects.Zone;
  timer: Phaser.Time.TimerEvent | null;
}

let activeToast: Toast | null = null;
const pendingToasts: ToastNotice[] = [];

function setActiveToast(toast: Toast | null): void {
  activeToast = toast;
}

/** Queue a generic notice. It survives a scene handoff until another host mounts. */
export function queueToast(notice: ToastNotice): void {
  if (activeToast?.isLive()) activeToast.enqueue(notice);
  else pendingToasts.push(notice);
}

/**
 * Dev probe fixtures only: forget every notice waiting for a host, so a
 * fixture's toasts never follow it into the next fixture's scene. The game
 * never calls this; a real scene handoff carries its notices on, by design.
 */
export function discardPendingToasts(): void {
  pendingToasts.length = 0;
}

/** Mount one right-rail host for the current scene. */
export class Toast {
  private readonly queued: ToastNotice[] = [];
  private readonly visible: ToastCard[] = [];
  private held: boolean;
  private live = true;
  private hidden = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: ToastOptions = {},
  ) {
    if (activeToast && activeToast !== this) pendingToasts.unshift(...activeToast.detach());
    setActiveToast(this);
    this.held = opts.held ?? false;
    this.queued.push(...pendingToasts.splice(0));
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.pump();
  }

  isLive(): boolean {
    return this.live;
  }

  /**
   * Whether a notice handed to `enqueue` right now would be built on screen
   * before that call returns. A caller that must not let its notice travel to
   * another scene (the anonymous-stats notice belongs on the main menu and
   * nowhere else) asks this first and simply waits for the next visit instead
   * of queueing behind a rail that is blocked or already showing something.
   */
  canPresentImmediately(): boolean {
    return this.live && !this.isBlocked() && this.visible.length === 0;
  }

  enqueue(notice: ToastNotice): void {
    if (!this.live) {
      pendingToasts.push(notice);
      return;
    }
    this.queued.push(notice);
    this.pump();
  }

  setHeld(held: boolean): void {
    this.held = held;
    this.syncVisibility();
    this.pump();
  }

  release(): void {
    this.setHeld(false);
  }

  private isBlocked(): boolean {
    return this.held || this.opts.modalGuard?.isOpen === true || this.opts.isBlocked?.() === true;
  }

  private update(): void {
    if (!this.live) return;
    this.syncVisibility();
    this.pump();
  }

  private syncVisibility(): void {
    const shouldHide = this.isBlocked();
    if (shouldHide === this.hidden) return;
    this.hidden = shouldHide;
    for (const card of this.visible) {
      card.container.setVisible(!shouldHide);
      if (shouldHide) card.input.disableInteractive();
      else card.input.setInteractive({ useHandCursor: true });
    }
  }

  private pump(): void {
    if (!this.live || this.isBlocked() || this.visible.length > 0 || this.queued.length === 0) return;
    const batch = collapseToastBatch(this.queued.splice(0));
    const notices = batch.kind === 'stack' ? batch.notices : [batch.notice];
    // Stack by the cards' own measured heights, hung from the release stack's
    // top edge. Cards at the release height walk the same y's the fixed
    // `82 + index * (86 + 12)` used to produce.
    const cards = notices.map((notice, index) => this.present(notice, index));
    toastStackCenters(cards.map((card) => card.height)).forEach((y, index) => cards[index].container.setY(y));
  }

  /** Builds one card (the caller places it on the stack) and returns it with its height. */
  private present(notice: ToastNotice, index: number): { container: Phaser.GameObjects.Container; height: number } {
    const container = this.scene.add
      .container(theme.design.width + TOAST_W / 2, 0)
      .setDepth(theme.depth.toast)
      .setAlpha(0);
    const title = this.scene.add
      .text(-TOAST_W / 2 + 18, 0, notice.title, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
        wordWrap: { width: TOAST_W - 36 },
      })
      .setOrigin(0, 0);
    const body = this.scene.add
      .text(-TOAST_W / 2 + 18, 0, notice.body, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.body,
        wordWrap: { width: TOAST_W - 36 },
      })
      .setOrigin(0, 0);
    const detail = notice.detail
      ? this.scene.add
          .text(-TOAST_W / 2 + 18, 0, notice.detail, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.muted,
            wordWrap: { width: TOAST_W - 36 },
          })
          .setOrigin(0, 0)
      : undefined;

    // Measure-then-place (toastCardLayout): the release card keeps its slots
    // while its lines fit them; a wrapped body or larger text stacks the lines
    // from their measured heights and the card grows, so none lands on another.
    // `fitBody` (copy to be read in full) keeps its own growing rule.
    const layout = toastCardLayout({
      title: title.height,
      body: body.height,
      detail: detail ? detail.height : null,
      fitBody: notice.fitBody === true,
    });
    const height = layout.height;
    const top = -height / 2;
    title.setY(top + layout.titleTop);
    body.setY(top + layout.bodyTop);
    if (detail && layout.detailTop !== null) detail.setY(top + layout.detailTop);

    const plaque = this.scene.add.graphics();
    plaque.fillStyle(theme.graphics.panelFill, 0.96);
    plaque.fillRoundedRect(-TOAST_W / 2, top, TOAST_W, height, theme.radius.panel);
    plaque.lineStyle(2, colorInt(theme.colors.gold), 0.92);
    plaque.strokeRoundedRect(-TOAST_W / 2 + 1, top + 1, TOAST_W - 2, height - 2, theme.radius.panel);
    plaque.lineStyle(1, theme.graphics.panelStroke, 0.9);
    plaque.strokeRoundedRect(-TOAST_W / 2 + 7, top + 7, TOAST_W - 14, height - 14, theme.radius.control);

    const shine = this.scene.add.graphics();
    shine.fillStyle(colorInt(theme.colors.gold), 0.2);
    shine.fillRoundedRect(-TOAST_W / 2 + 14, top + 10, 22, height - 20, theme.radius.control);
    shine.setX(-TOAST_W / 2 + 14);
    const input = this.scene.add.zone(0, 0, TOAST_W, height).setInteractive({ useHandCursor: true });
    const card: ToastCard = { notice, container, input, timer: null };
    bindTapButton(this.scene, input, (pointer) => {
      if (pointer.rightButtonReleased()) return;
      this.dismiss(card, true);
      if (notice.action) this.scene.scene.start(notice.action.scene, notice.action.data);
    });
    container.add([plaque, shine, title, body, ...(detail ? [detail] : []), input]);
    this.visible.push(card);

    this.scene.tweens.add({
      targets: container,
      x: TOAST_X,
      alpha: 1,
      duration: TOAST_ENTRY_MS,
      delay: index * TOAST_STAGGER_MS,
      ease: 'Back.easeOut',
      onStart: () => {
        if (notice.cue) Sfx.play(notice.cue);
      },
    });
    this.scene.tweens.add({
      targets: shine,
      x: TOAST_W / 2 - 36,
      alpha: 0,
      duration: 620,
      delay: index * TOAST_STAGGER_MS + 80,
      ease: 'Sine.easeInOut',
    });
    card.timer = this.scene.time.delayedCall(
      (notice.holdMs ?? TOAST_HOLD_MS) + index * TOAST_STAGGER_MS,
      () => this.dismiss(card),
    );
    this.syncVisibility();
    // Last, and only now: the card exists on screen. A caller that records
    // having shown something records it here and nowhere earlier.
    notice.onShown?.();
    return { container, height };
  }

  private dismiss(card: ToastCard, immediate = false): void {
    if (!this.live || !this.visible.includes(card)) return;
    if (!immediate && this.isBlocked()) {
      card.timer = this.scene.time.delayedCall(120, () => this.dismiss(card));
      return;
    }
    card.timer?.remove(false);
    card.timer = null;
    const remove = (): void => {
      if (card.container.active) card.container.destroy();
      const index = this.visible.indexOf(card);
      if (index >= 0) this.visible.splice(index, 1);
      this.pump();
    };
    if (immediate) remove();
    else {
      card.input.disableInteractive();
      this.scene.tweens.add({
        targets: card.container,
        x: TOAST_X + 48,
        alpha: 0,
        duration: 180,
        ease: 'Cubic.easeIn',
        onComplete: remove,
      });
    }
  }

  private onShutdown(): void {
    pendingToasts.unshift(...this.detach());
  }

  private detach(): ToastNotice[] {
    if (!this.live) return [];
    this.live = false;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    const notices = [...this.visible.map((card) => card.notice), ...this.queued];
    for (const card of this.visible) {
      card.timer?.remove(false);
      if (card.container.active) card.container.destroy();
    }
    this.visible.length = 0;
    this.queued.length = 0;
    if (activeToast === this) setActiveToast(null);
    return notices;
  }
}
