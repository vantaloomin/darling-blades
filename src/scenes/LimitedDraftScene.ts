import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { draftPersonaById, type DraftPersona } from '../data/draftPersonas';
import type { CardDef } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import {
  completeDraftRun,
  currentDraftPack,
  DRAFT_PACKS,
  draftDirection,
  pickDraftCard,
  type LimitedRun,
} from '../meta/Limited';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea, isTouchDevice } from '../platform/gestures';
import { makeCardThumb } from '../ui/CardThumbCache';
import { CardView } from '../ui/CardView';
import { computeDeckStats, CURVE_MAX, PIE_COLORS } from '../ui/deckStats';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import {
  modalShell,
  panel,
  themedButton,
  type ModalShell,
  type ThemedButton,
} from '../ui/themeWidgets';

const DESIGN_W = theme.design.width;
const DESIGN_H = theme.design.height;
const PACK_THUMB_SCALE = 0.25;
const PICK_THUMB_SCALE = 0.09;
const PACK_COLS = 5;
const PICK_COLS = 9;

/** MouseManager installs a game-lifetime DOM listener, so install it once. */
let contextMenuDisabled = false;

interface SeatIdentity {
  name: string;
  title: string;
  blurb: string;
  portraitCardId: string | null;
  human: boolean;
}

interface PackCell {
  plate: Phaser.GameObjects.Rectangle;
  thumb: Phaser.GameObjects.Image;
}

export class LimitedDraftScene extends Phaser.Scene {
  private selectedId: string | null = null;
  private selectedCell = -1;
  private packCells: PackCell[] = [];
  private interactiveTargets: Phaser.GameObjects.GameObject[] = [];
  private modal: ModalShell | null = null;
  private guard = new ModalGuard();
  private pickButton: ThemedButton | null = null;
  /** Pack index shown in the card-inspect modal; null when no inspect is open. */
  private inspectIndex: number | null = null;
  private inspectHint: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('LimitedDraft');
  }

  create(): void {
    this.selectedId = null;
    this.selectedCell = -1;
    this.packCells = [];
    this.interactiveTargets = [];
    this.modal = null;
    this.guard = new ModalGuard();
    this.pickButton = null;
    this.inspectIndex = null;
    this.inspectHint = null;

    applyBackdrop(this, 'packopening', {
      dim: theme.graphics.dim,
      dimAlpha: 0.66,
      fallback: (scene) => {
        const g = scene.add.graphics();
        g.fillGradientStyle(
          theme.graphics.panelFill,
          theme.graphics.panelFill,
          theme.graphics.dim,
          theme.graphics.dim,
          1,
        );
        g.fillRect(0, 0, DESIGN_W, DESIGN_H);
      },
    });

    this.input.on('gameobjectover', this.onGameObjectOver);
    this.input.on('gameobjectup', this.onGameObjectUp);
    // Inspect-modal hotkeys: arrows browse the pack, Space/Enter selects then
    // confirms. Scene-plugin keyboard listeners bypass ModalGuard (playbook
    // §11), so every handler self-guards on inspectIndex — they are inert
    // unless a pack-card inspect is the open modal.
    this.input.keyboard?.on('keydown-LEFT', this.onInspectPrev);
    this.input.keyboard?.on('keydown-RIGHT', this.onInspectNext);
    this.input.keyboard?.on('keydown-SPACE', this.onInspectSelect);
    this.input.keyboard?.on('keydown-ENTER', this.onInspectSelect);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    if (!contextMenuDisabled) {
      this.input.mouse?.disableContextMenu();
      contextMenuDisabled = true;
    }
    Music.setMood('menu');

    const run = Services.save.data.limited.activeRun;
    if (!run || run.mode !== 'draft' || !run.draft) {
      this.scene.start('Limited');
      return;
    }
    if (run.draft.completed) {
      Services.save.data.limited.activeRun = completeDraftRun(CARD_DB, run);
      Services.save.flush();
      this.scene.start('LimitedDeckBuilder');
      return;
    }

    const pack = currentDraftPack(run.draft);
    this.drawHeader(run, pack.length);
    this.drawSeatTable(run);
    this.drawPack(pack);
    this.drawPicks(run);
    this.drawActions(run);
  }

  private drawHeader(run: LimitedRun, remainingCards: number): void {
    const draft = run.draft!;
    const packSize = Math.max(ECONOMY.limitedPackSize, remainingCards + draft.pickIndex);
    this.add
      .text(DESIGN_W / 2, 44, 'Bot Draft', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(
        DESIGN_W / 2,
        76,
        `Pack ${draft.packIndex + 1}/${DRAFT_PACKS} - Pick ${draft.pickIndex + 1}/${packSize}`,
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          fontStyle: theme.weight.w600,
          color: theme.colors.gold,
        },
      )
      .setOrigin(0.5);
  }

  private drawSeatTable(run: LimitedRun): void {
    const draft = run.draft!;
    const x = theme.design.safeLeft;
    const y = 96;
    const width = theme.design.safeWidth;
    const height = 116;
    const firstX = 140;
    const pitch = 142;
    const seatY = 163;
    const direction = draftDirection(draft.packIndex);
    // passDraftPacks moves packs seat k -> k+1 for 'left' (Limited.ts), which
    // flows RIGHTWARD along this rendered row — chevrons point at the seat that
    // receives your pack, so signal-readers watch the correct neighbor.
    const chevron = direction === 'left' ? '>' : '<';

    panel(this, x, y, width, height, { alpha: 0.96 });
    this.add.text(x + 16, y + 9, 'Draft Table', {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.label}px`,
      color: theme.colors.heading,
    });
    this.add
      .text(x + width - 16, y + 10, `PACKS PASS  ${chevron}${chevron}${chevron}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
      })
      .setOrigin(1, 0);

    for (let seat = 0; seat < 8; seat++) {
      const identity = this.identityForSeat(run, seat);
      const cx = firstX + seat * pitch;
      const fill = identity.human ? theme.graphics.rowFillActive : theme.graphics.rowFill;
      const stroke = identity.human ? theme.colors.gold : theme.colors.panelStroke;
      const seatPlate = this.add
        .rectangle(cx, seatY, 116, 80, fill, 0.98)
        .setStrokeStyle(identity.human ? 2 : 1, colorInt(stroke), 1)
        .setInteractive({ useHandCursor: true });
      inflateHitArea(seatPlate, 116, 90);
      bindTapButton(this, seatPlate, () => this.showPersona(identity));
      seatPlate.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch) seatPlate.setStrokeStyle(2, colorInt(theme.colors.goldHover), 1);
      });
      seatPlate.on('pointerout', () => {
        seatPlate.setStrokeStyle(identity.human ? 2 : 1, colorInt(stroke), 1);
      });
      this.interactiveTargets.push(seatPlate);

      const portraitBg = this.add
        .circle(cx, seatY - 10, 25, theme.graphics.dim, 1)
        .setStrokeStyle(1, colorInt(stroke), 1);
      const initials = this.add
        .text(cx, seatY - 10, identity.human ? 'YOU' : initial(identity.name), {
          fontFamily: theme.fonts.ui,
          fontSize: `${identity.human ? theme.type.micro : theme.type.label}px`,
          fontStyle: theme.weight.w700,
          color: identity.human ? theme.colors.gold : theme.colors.muted,
        })
        .setOrigin(0.5);
      const portraitGroup = this.add.container(0, 0, [portraitBg, initials]);
      this.addPortrait(portraitGroup, identity.portraitCardId, cx, seatY - 10, 48, 48, true);
      portraitGroup.add(
        this.add.circle(cx, seatY - 10, 25, theme.graphics.dim, 0).setStrokeStyle(2, colorInt(stroke), 1),
      );

      this.add
        .text(cx, seatY + 27, identity.human ? 'You' : firstName(identity.name), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: identity.human ? theme.weight.w700 : theme.weight.w600,
          color: identity.human ? theme.colors.gold : theme.colors.body,
        })
        .setOrigin(0.5);

      if (seat < 7) {
        this.add
          .text(cx + pitch / 2, seatY - 9, chevron, {
            fontFamily: theme.fonts.display,
            fontSize: `${theme.type.body}px`,
            color: theme.colors.gold,
          })
          .setOrigin(0.5);
      }
    }
  }

  private drawPack(pack: readonly string[]): void {
    const x = theme.design.safeLeft;
    const y = 224;
    // Panel 224..640; the title band ends ~264, so the first plate row (top =
    // 330 − 58) starts at 272 — no overlap; the last row bottom (574 + 58 =
    // 632) stays inside, and the footer hint at y=660 clears the 640 edge.
    panel(this, x, y, 760, 416, { alpha: 0.96 });
    this.add.text(x + 16, y + 12, `Current Pack (${pack.length})`, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h2}px`,
      color: theme.colors.heading,
    });

    pack.forEach((id, index) => {
      const card = def(CARD_DB, id);
      const col = index % PACK_COLS;
      const row = Math.floor(index / PACK_COLS);
      const cx = 128 + col * 150;
      const cy = 330 + row * 122;
      const plate = this.add
        .rectangle(cx, cy, 86, 116, theme.graphics.rowFill, 0.92)
        .setStrokeStyle(1, theme.graphics.panelStroke, theme.alpha.chrome);
      const thumb = makeCardThumb(this, cx, cy, card, PACK_THUMB_SCALE).setInteractive({
        useHandCursor: true,
      });
      inflateHitArea(thumb, 90, 90);
      bindTapButton(
        this,
        thumb,
        (pointer) => {
          if (pointer.rightButtonReleased()) this.showCardInspect(card, index);
          else this.selectCard(index, id);
        },
        { onLongPress: () => this.showCardInspect(card, index) },
      );
      thumb.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch && index !== this.selectedCell) {
          plate.setStrokeStyle(2, colorInt(theme.colors.goldHover), 1);
        }
      });
      thumb.on('pointerout', () => this.refreshPackSelection());
      this.packCells.push({ plate, thumb });
      this.interactiveTargets.push(thumb);
    });
  }

  private drawPicks(run: LimitedRun): void {
    const picks = [...(run.draft?.picks[0] ?? [])].reverse();
    const stats = computeDeckStats([...picks], CARD_DB);
    const x = 848;
    const y = 224;
    panel(this, x, y, 368, 404, { alpha: 0.96 });
    this.add.text(x + 16, y + 12, `Your Picks (${picks.length})`, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h2}px`,
      color: theme.colors.heading,
    });

    this.add.text(x + 16, y + 49, 'COLOR PIPS', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.muted,
    });
    this.add.text(
      x + 16,
      y + 67,
      PIE_COLORS.map((color) => `${color} ${stats.colorPips[color]}`).join('    '),
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: theme.colors.body,
      },
    );

    this.add.text(x + 16, y + 91, 'MANA CURVE', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.muted,
    });
    for (let mv = 0; mv <= CURVE_MAX; mv++) {
      const cx = x + 32 + mv * 41;
      this.add
        .text(cx, y + 111, mv === CURVE_MAX ? '7+' : String(mv), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5);
      this.add
        .text(cx, y + 130, String(stats.curve[mv]), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w700,
          color: stats.curve[mv] > 0 ? theme.colors.gold : theme.colors.body,
        })
        .setOrigin(0.5);
    }

    this.add.rectangle(x + 184, y + 153, 336, 1, theme.graphics.panelStroke, 1);
    this.add.text(x + 16, y + 164, 'DRAFTED CARDS  -  MOST RECENT FIRST', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.muted,
    });

    picks.forEach((id, index) => {
      const col = index % PICK_COLS;
      const row = Math.floor(index / PICK_COLS);
      makeCardThumb(this, x + 35 + col * 37, y + 204 + row * 43, def(CARD_DB, id), PICK_THUMB_SCALE);
    });
    if (picks.length === 0) {
      this.add
        .text(x + 184, y + 285, 'Your picks will collect here.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5);
    }
  }

  private drawActions(run: LimitedRun): void {
    this.add.text(
      theme.design.safeLeft,
      660,
      isTouchDevice()
        ? 'Tap a card to select  -  long-press to inspect'
        : 'Click selects  -  right-click inspects  -  in inspect: arrows browse, Space/Enter selects then picks',
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      },
    ).setOrigin(0, 0.5);

    const hub = themedButton(this, 918, 660, 'Hub', {
      variant: 'ghost',
      minWidth: 100,
      onTap: () => this.scene.start('Limited'),
    });
    this.pickButton = themedButton(this, 1106, 660, 'Pick Selected', {
      variant: 'primary',
      minWidth: 180,
      enabled: false,
      onTap: () => this.confirmPick(run),
    });
    this.interactiveTargets.push(hub.inputZone, this.pickButton.inputZone);
  }

  private selectCard(index: number, id: string): void {
    // No modal guard here: pointer paths are already deadened by ModalGuard
    // while a modal is open, and the inspect-modal hotkeys select on purpose.
    this.selectedCell = index;
    this.selectedId = id;
    this.pickButton?.setEnabled(true);
    this.refreshPackSelection();
  }

  /** The pack shown by the current draft state (empty when no run). */
  private currentPack(): readonly string[] {
    const run = Services.save.data.limited.activeRun;
    return run?.draft ? currentDraftPack(run.draft) : [];
  }

  private stepInspect(delta: number): void {
    if (this.inspectIndex === null || !this.modal) return;
    const pack = this.currentPack();
    if (pack.length === 0) return;
    const next = (this.inspectIndex + delta + pack.length) % pack.length;
    this.showCardInspect(def(CARD_DB, pack[next]), next);
  }

  private readonly onInspectPrev = (): void => this.stepInspect(-1);
  private readonly onInspectNext = (): void => this.stepInspect(1);

  /** Space/Enter in the inspect modal: first press selects, second confirms. */
  private readonly onInspectSelect = (): void => {
    if (this.inspectIndex === null || !this.modal) return;
    const pack = this.currentPack();
    const id = pack[this.inspectIndex];
    if (!id) return;
    if (this.selectedCell !== this.inspectIndex) {
      this.selectCard(this.inspectIndex, id);
      this.refreshInspectHint();
      return;
    }
    const run = Services.save.data.limited.activeRun;
    if (!run) return;
    this.closeModal();
    this.confirmPick(run);
  };

  private refreshInspectHint(): void {
    if (!this.inspectHint?.active || this.inspectIndex === null) return;
    const selected = this.selectedCell === this.inspectIndex;
    this.inspectHint
      .setText(
        selected
          ? 'SELECTED — Space/Enter again to pick it'
          : '←/→ browse the pack · Space/Enter to select',
      )
      .setColor(selected ? theme.colors.gold : theme.colors.muted);
  }

  private refreshPackSelection(): void {
    this.packCells.forEach(({ plate }, index) => {
      const selected = index === this.selectedCell;
      plate
        .setFillStyle(selected ? theme.graphics.rowFillActive : theme.graphics.rowFill, selected ? 1 : 0.92)
        .setStrokeStyle(
          selected ? 3 : 1,
          selected ? colorInt(theme.colors.gold) : theme.graphics.panelStroke,
          selected ? 1 : theme.alpha.chrome,
        );
    });
  }

  private showPersona(identity: SeatIdentity): void {
    this.closeModal();
    const shell = modalShell(this, {
      width: 700,
      height: 420,
      dimAlpha: 0.76,
      depth: theme.depth.modal,
      showClose: true,
      tapDimToClose: true,
      onClose: () => this.onModalClosed(shell),
    });
    this.modal = shell;
    this.guard.open(this.interactiveTargets);
    const c = shell.container;

    c.add(panel(this, 322, 194, 224, 292, { alpha: 1 }));
    c.add(
      this.add
        .text(434, 340, identity.human ? 'YOU' : initial(identity.name), {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.display}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5),
    );
    this.addPortrait(c, identity.portraitCardId, 434, 340, 212, 280, false);
    c.add(
      this.add.rectangle(434, 340, 212, 280, theme.graphics.dim, 0).setStrokeStyle(2, colorInt(theme.colors.gold), 1),
    );
    c.add(
      this.add.text(582, 214, identity.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.heading,
        wordWrap: { width: 330 },
      }),
    );
    c.add(
      this.add.text(582, 259, identity.title, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.body}px`,
        fontStyle: 'italic',
        color: theme.colors.gold,
        wordWrap: { width: 330 },
      }),
    );
    c.add(
      this.add.text(582, 310, identity.blurb, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.body,
        lineSpacing: 6,
        wordWrap: { width: 330 },
      }),
    );
    c.add(
      this.add.text(582, 465, 'Seat profile', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.muted,
      }),
    );
  }

  private showCardInspect(card: CardDef, packIndex: number): void {
    this.closeModal();
    const shell = modalShell(this, {
      width: 980,
      height: 610,
      dimAlpha: 0.8,
      depth: theme.depth.inspect,
      showClose: true,
      tapDimToClose: true,
      onClose: () => this.onModalClosed(shell),
    });
    this.modal = shell;
    this.inspectIndex = packIndex;
    this.guard.open(this.interactiveTargets);
    const c = shell.container;
    c.add(new CardView(this, 430, 360).setScale(1.25).setCard(card, { fx: 'full' }));
    c.add(
      this.add.text(690, 150, card.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(690, 220, detailLine(card), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.heading,
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(690, 290, card.keywords?.join(', ') || 'No keyword abilities', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.body,
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(690, 350, card.flavor ?? '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: 'italic',
        color: theme.colors.muted,
        lineSpacing: 5,
        wordWrap: { width: 380 },
      }),
    );
    this.inspectHint = this.add
      .text(640, 634, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: theme.weight.w600,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    c.add(this.inspectHint);
    this.refreshInspectHint();
    c.add(
      this.add
        .text(884, 598, 'Click outside or use X to close', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5),
    );
  }

  private identityForSeat(run: LimitedRun, seat: number): SeatIdentity {
    if (seat === 0) {
      return {
        name: 'You',
        title: 'the Human Drafter',
        blurb: 'Your seat at the table. Read the signals, build a curve, and choose one card before the pack moves on.',
        portraitCardId: null,
        human: true,
      };
    }
    const persona: DraftPersona | null = draftPersonaById(run.draft?.personaIds[seat] ?? '');
    if (!persona) {
      return {
        name: 'Drafter',
        title: 'the Unknown Seat',
        blurb: 'A quiet drafter with an unreadable plan. Their missing profile will not interrupt this run.',
        portraitCardId: null,
        human: false,
      };
    }
    return {
      name: persona.name,
      title: persona.title,
      blurb: persona.blurb,
      portraitCardId: persona.portraitCardId,
      human: false,
    };
  }

  /** Cover-fit card art behind a face-biased geometry mask; fallback stays visible. */
  private addPortrait(
    container: Phaser.GameObjects.Container,
    cardId: string | null,
    x: number,
    y: number,
    targetW: number,
    targetH: number,
    circular: boolean,
  ): void {
    if (!cardId) return;
    try {
      const ref = Art.resolver?.getArt(cardId);
      if (!ref) return;
      const image = this.add.image(x, y, ref.textureKey, ref.frameName);
      // Overscan must cover the face-bias shift below: (1.16-1)/2 = 0.08 per
      // side >= the 0.08*targetH upward shift, or the mask bottom shows bare
      // panel behind height-bound fits (all card art is 320x400).
      const scale = Math.max(targetW / image.width, targetH / image.height) * 1.16;
      image.setScale(scale);
      image.y = y - targetH * 0.08;
      const maskShape = circular
        ? this.add.circle(x, y, Math.min(targetW, targetH) / 2, theme.graphics.dim).setVisible(false)
        : this.add.rectangle(x, y, targetW, targetH, theme.graphics.dim).setVisible(false);
      image.setMask(maskShape.createGeometryMask());
      container.add([image, maskShape]);
    } catch {
      // The fallback initials/frame are already present, so missing art is safe.
    }
  }

  private closeModal(): void {
    this.modal?.close();
  }

  private onModalClosed(shell: ModalShell): void {
    if (this.modal !== shell) return;
    this.guard.close();
    this.modal = null;
    // The hint Text died with the shell container; the index must not leak
    // into the persona modal (the hotkey handlers key off it).
    this.inspectIndex = null;
    this.inspectHint = null;
  }

  private confirmPick(run: LimitedRun): void {
    if (!this.selectedId || !run.draft) return;
    const updated: LimitedRun = {
      ...run,
      draft: pickDraftCard(CARD_DB, run.draft, this.selectedId),
    };
    Services.save.data.limited.activeRun = updated.draft?.completed
      ? completeDraftRun(CARD_DB, updated)
      : updated;
    Services.save.flush();
    this.scene.start(updated.draft?.completed ? 'LimitedDeckBuilder' : 'LimitedDraft');
  }

  private readonly onGameObjectOver = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.wasTouch) Sfx.play('hover');
  };

  private readonly onGameObjectUp = (): void => {
    Sfx.play('click');
  };

  private onShutdown(): void {
    this.input.off('gameobjectover', this.onGameObjectOver);
    this.input.off('gameobjectup', this.onGameObjectUp);
    this.input.keyboard?.off('keydown-LEFT', this.onInspectPrev);
    this.input.keyboard?.off('keydown-RIGHT', this.onInspectNext);
    this.input.keyboard?.off('keydown-SPACE', this.onInspectSelect);
    this.input.keyboard?.off('keydown-ENTER', this.onInspectSelect);
    this.closeModal();
  }
}

function detailLine(card: CardDef): string {
  const stats = isType(card, 'creature') ? ` - ${card.attack}/${card.defense}` : '';
  return `${card.rarity.toUpperCase()} - ${card.types.join(' ')} - MV ${manaValue(card.cost)}${stats}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Drafter';
}

function initial(name: string): string {
  return firstName(name).slice(0, 1).toUpperCase() || '?';
}
