import Phaser from 'phaser';
import { Art } from '../art/ArtResolver';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { draftPersonaById, type DraftPersona } from '../data/draftPersonas';
import type { CardDef } from '../engine/types';
import { def, manaValue } from '../engine/types';
import {
  completeDraftRun,
  currentDraftPack,
  DRAFT_PACKS,
  DRAFT_SEATS,
  draftDirection,
  grantPremiumDraftPool,
  personaRevealTier,
  pickDraftCard,
  recordDraftEncounters,
  type LimitedRun,
  type PersonaRevealTier,
} from '../meta/Limited';
import { ownedCount, PLAYSET } from '../meta/Collection';
import { Services } from '../meta/services';
import {
  isPlainVariant,
  type CardVariant,
  type FrameStyle,
  type HoloFinish,
} from '../meta/variants';
import { bindTapButton, inflateHitArea, isTouchDevice } from '../platform/gestures';
import { makeCardThumb } from '../ui/CardThumbCache';
import { FRAME_TREATMENTS } from '../ui/CardFrameFactory';
import { CardView } from '../ui/CardView';
import { computeDeckStats, CURVE_MAX, PIE_COLORS } from '../ui/deckStats';
import { addKeywordGlossaryPanel } from '../ui/KeywordGlossaryPanel';
import { bakeManaSymbols } from '../ui/ManaSymbols';
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
/** Seat-table geometry, shared by the row layout and the pass animation. */
const SEAT_FIRST_X = 140;
const SEAT_PITCH = 142;

/** MouseManager installs a game-lifetime DOM listener, so install it once. */
let contextMenuDisabled = false;

interface SeatIdentity {
  name: string;
  title: string;
  blurb: string;
  colorHint: string;
  /** Familiarity reveal: 1 name+portrait · 2 +colors · 3 +theme · 4 full. */
  tier: PersonaRevealTier;
  portraitCardId: string | null;
  human: boolean;
}

interface PackCell {
  plate: Phaser.GameObjects.Rectangle;
  thumb: Phaser.GameObjects.Image;
  baseStroke: number;
  baseStrokeWidth: number;
  baseStrokeAlpha: number;
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
  /** True while the pass animation plays — re-entry guard for confirmPick. */
  private passing = false;

  /**
   * Visual column for a seat: You, 7, 6, … 1 left-to-right, so the engine's
   * seat k -> k+1 pass renders as leftward motion (see drawSeatTable).
   */
  private seatColumnX(seat: number): number {
    const column = seat === 0 ? 0 : DRAFT_SEATS - seat;
    return SEAT_FIRST_X + column * SEAT_PITCH;
  }

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
    this.passing = false;

    bakeManaSymbols(this);
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
      // Interrupted-save path (confirmPick normally records before this).
      grantPremiumDraftPool(Services.save.data, CARD_DB, run);
      recordDraftEncounters(Services.save.data.limited, run);
      Services.save.data.limited.activeRun = completeDraftRun(CARD_DB, run);
      Services.save.flush();
      this.scene.start('LimitedDeckBuilder');
      return;
    }

    const pack = currentDraftPack(run.draft);
    this.drawHeader(run, pack.length);
    this.drawSeatTable(run);
    this.drawPack(run, pack);
    this.drawPicks(run);
    this.drawActions(run);
  }

  private drawHeader(run: LimitedRun, remainingCards: number): void {
    const draft = run.draft!;
    const packSize = Math.max(ECONOMY.limitedPackSize, remainingCards + draft.pickIndex);
    this.add
      .text(DESIGN_W / 2, 44, run.premium ? 'Premium Draft' : 'Free Draft', {
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
    const seatY = 163;
    const direction = draftDirection(draft.packIndex);
    // The row is drawn You, 7, 6, … 1 (seatColumnX) so that the engine's
    // seat k -> k+1 hand-off (passDraftPacks, 'left') moves VISUALLY LEFT —
    // you hand your pack toward the left edge (wrapping to seat 1 at the far
    // right) and receive from the neighbor on your right, exactly like a real
    // table. Chevrons, the label, and the pass animation all share this frame.
    const arrow = direction === 'left' ? '←' : '→';

    panel(this, x, y, width, height, { alpha: 0.96 });
    this.add.text(x + 16, y + 9, 'Draft Table', {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.label}px`,
      color: theme.colors.heading,
    });
    this.add
      .text(x + width / 2, y + 10, `${arrow}  PASS ${direction.toUpperCase()}  ${arrow}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
      })
      .setOrigin(0.5, 0);

    for (let seat = 0; seat < 8; seat++) {
      const identity = this.identityForSeat(run, seat);
      const cx = this.seatColumnX(seat);
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

    }

    // Arrows live between visual COLUMNS (the seat order is remapped), all
    // pointing the way the packs flow this pack.
    for (let col = 0; col < 7; col++) {
      this.add
        .text(SEAT_FIRST_X + col * SEAT_PITCH + SEAT_PITCH / 2, seatY - 9, arrow, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
        })
        .setOrigin(0.5);
    }
  }

  private drawPack(run: LimitedRun, pack: readonly string[]): void {
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
      const variant = run.premium ? run.draft?.currentPackVariants?.[0]?.[index] : undefined;
      const special = variant !== undefined && !isPlainVariant(variant);
      const baseStroke = special ? frameIndicatorColor(variant.frame) : theme.graphics.panelStroke;
      const baseStrokeWidth = special ? 2 : 1;
      const baseStrokeAlpha = special ? 1 : theme.alpha.chrome;
      const col = index % PACK_COLS;
      const row = Math.floor(index / PACK_COLS);
      const cx = 128 + col * 150;
      const cy = 330 + row * 122;
      const plate = this.add
        .rectangle(cx, cy, 86, 116, theme.graphics.rowFill, 0.92)
        .setStrokeStyle(baseStrokeWidth, baseStroke, baseStrokeAlpha);
      if (special) {
        this.add
          .circle(cx + 33, cy - 48, 5, colorInt(holoIndicatorColor(variant.holo)), 1)
          .setStrokeStyle(1, colorInt(theme.colors.heading), theme.alpha.chrome);
      }
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
      this.packCells.push({ plate, thumb, baseStroke, baseStrokeWidth, baseStrokeAlpha });
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

    this.add.text(x + 16, y + 49, 'COLORS', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.muted,
    });
    PIE_COLORS.forEach((color, index) => {
      const pipX = x + 27 + index * 67;
      this.add.image(pipX, y + 70, `pip-${color}`).setDisplaySize(18, 18);
      this.add
        .text(pipX + 13, y + 70, String(stats.colorPips[color]), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w600,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
    });

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
          ? 'SELECTED. Space/Enter again to pick it'
          : '←/→ browse the pack · Space/Enter to select',
      )
      .setColor(selected ? theme.colors.gold : theme.colors.muted);
  }

  private refreshPackSelection(): void {
    this.packCells.forEach(({ plate, baseStroke, baseStrokeWidth, baseStrokeAlpha }, index) => {
      const selected = index === this.selectedCell;
      plate
        .setFillStyle(selected ? theme.graphics.rowFillActive : theme.graphics.rowFill, selected ? 1 : 0.92)
        .setStrokeStyle(
          selected ? 3 : baseStrokeWidth,
          selected ? colorInt(theme.colors.gold) : baseStroke,
          selected ? 1 : baseStrokeAlpha,
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
    // Progressive reveal: tier 2 shows color habits, tier 3 the theme, tier 4
    // the full read. Below the threshold each slot shows what's still hidden.
    if (identity.tier >= 3) {
      c.add(
        this.add.text(582, 259, identity.title, {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.body}px`,
          fontStyle: 'italic',
          color: theme.colors.gold,
          wordWrap: { width: 330 },
        }),
      );
    }
    if (identity.tier >= 2) {
      c.add(
        this.add.text(582, identity.tier >= 3 ? 302 : 259, `Colors: ${identity.colorHint}`, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.body,
          lineSpacing: 5,
          wordWrap: { width: 330 },
        }),
      );
    }
    if (identity.tier >= 4) {
      c.add(
        this.add.text(582, 352, identity.blurb, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.body,
          lineSpacing: 6,
          wordWrap: { width: 330 },
        }),
      );
    } else {
      c.add(
        this.add.text(582, identity.tier >= 2 ? 352 : 259, revealHint(identity.tier), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          fontStyle: 'italic',
          color: theme.colors.muted,
          lineSpacing: 5,
          wordWrap: { width: 330 },
        }),
      );
    }
    const pips = '◆'.repeat(identity.tier) + '◇'.repeat(4 - identity.tier);
    c.add(
      this.add.text(582, 465, `Familiarity ${pips}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w700,
        color: identity.tier >= 4 ? theme.colors.gold : theme.colors.muted,
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
    const cardView = new CardView(this, 430, 360).setScale(1.25);
    const variant = this.currentPackVariant(packIndex);
    cardView.setCard(
      card,
      variant ? { fx: 'full', variant, fullArt: variant.fullArt } : { fx: 'full' },
    );
    c.add(cardView);

    // The close button hugs the shell's INNER top-right corner (user-directed
    // 2026-07-14); the shared shell places it on its own title track, so this
    // modal repositions the exposed button after creation.
    if (shell.closeButton) {
      // Align the VISIBLE button to the corner — the inflated hit area may
      // overflow the shell edge, which is fine (hit boxes are invisible).
      const visual = shell.closeButton.getMeasuredSize().visual;
      shell.closeButton.container.setPosition(1130 - 10 - visual.width / 2, 55 + 10 + visual.height / 2);
    }

    // No title line — the card face carries the identity; the column opens
    // straight into PICK IMPACT with generous spacing (room reserved for
    // future rarity-rate lines).
    const columnX = 650;
    const columnWidth = 430;
    c.add(
      this.add.text(columnX, 104, 'PICK IMPACT', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.muted,
      }),
    );

    const run = Services.save.data.limited.activeRun;
    const stats = computeDeckStats([...(run?.draft?.picks[0] ?? [])], CARD_DB);
    c.add(
      this.add
        .text(columnX, 160, 'POOL COLORS', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.muted,
        })
        .setOrigin(0, 0.5),
    );
    PIE_COLORS.forEach((color, index) => {
      const pipX = columnX + 112 + index * 68;
      const before = stats.colorPips[color];
      const contribution = card.colors.includes(color) ? (card.cost?.pips[color] ?? 0) : 0;
      c.add(this.add.image(pipX, 160, `pip-${color}`).setDisplaySize(18, 18));
      c.add(
        this.add
          .text(
            pipX + 13,
            160,
            contribution > 0 ? `${before}→${before + contribution}` : String(before),
            {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.caption}px`,
              fontStyle: contribution > 0 ? theme.weight.w700 : theme.weight.w600,
              color: contribution > 0 ? theme.colors.gold : theme.colors.body,
            },
          )
          .setOrigin(0, 0.5),
      );
    });

    c.add(
      this.add
        .text(columnX, 232, 'CURVE', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.muted,
        })
        .setOrigin(0, 0.5),
    );
    const curveBucket = card.types.includes('land') ? null : Math.min(manaValue(card.cost), CURVE_MAX);
    for (let mv = 0; mv <= CURVE_MAX; mv++) {
      const bucketX = columnX + 94 + mv * 47;
      const highlighted = mv === curveBucket;
      c.add(
        this.add
          .text(bucketX, 218, mv === CURVE_MAX ? '7+' : String(mv), {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: highlighted ? theme.colors.gold : theme.colors.muted,
          })
          .setOrigin(0.5),
      );
      c.add(
        this.add
          .text(bucketX, 244, highlighted ? `${stats.curve[mv]}→${stats.curve[mv] + 1}` : String(stats.curve[mv]), {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            fontStyle: highlighted ? theme.weight.w700 : theme.weight.w600,
            color: highlighted ? theme.colors.gold : theme.colors.body,
          })
          .setOrigin(0.5),
      );
    }

    if (card.keywords && card.keywords.length > 0) {
      addKeywordGlossaryPanel(this, c, card, {
        x: columnX,
        y: 300,
        width: columnWidth,
        maxHeight: run?.premium ? 200 : 280,
      });
    }

    if (run?.premium) {
      c.add(
        this.add.text(columnX, 520, premiumVariantLine(variant), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w600,
          color: !variant || isPlainVariant(variant) ? theme.colors.body : theme.colors.gold,
          wordWrap: { width: columnWidth },
        }),
      );
      const owned = ownedCount(Services.save.data, card.id);
      c.add(
        this.add.text(
          columnX,
          550,
          owned >= PLAYSET - 1
            ? `You own ${owned}/${PLAYSET} plain, a 5th plain copy melts to gold`
            : `You own ${owned}/${PLAYSET}`,
          {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.caption}px`,
            color: theme.colors.muted,
            wordWrap: { width: columnWidth },
          },
        ),
      );
    }
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
        colorHint: 'Whatever you make of the packs.',
        tier: 4,
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
        colorHint: 'Unreadable.',
        tier: 4,
        portraitCardId: null,
        human: false,
      };
    }
    return {
      name: persona.name,
      title: persona.title,
      blurb: persona.blurb,
      colorHint: persona.colorHint,
      // Familiarity is earned: profiles unlock over completed drafts together
      // (the current run counts as the first meeting).
      tier: personaRevealTier(Services.save.data.limited, persona.id),
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
    if (this.passing || !this.selectedId || !run.draft) return;
    const prevPackIndex = run.draft.packIndex;
    const updated: LimitedRun = {
      ...run,
      draft: pickDraftCard(CARD_DB, run.draft, this.selectedId, this.selectedCell),
    };
    if (updated.draft?.completed) {
      // A finished draft (all 45 picks) is what teaches you the table —
      // familiarity advances exactly once per completed draft per persona.
      grantPremiumDraftPool(Services.save.data, CARD_DB, updated);
      recordDraftEncounters(Services.save.data.limited, updated);
    }
    Services.save.data.limited.activeRun = updated.draft?.completed
      ? completeDraftRun(CARD_DB, updated)
      : updated;
    Services.save.flush();
    if (updated.draft?.completed) {
      this.scene.start('LimitedDeckBuilder');
      return;
    }
    // Within a pack, sell the table illusion: every seat's pack visibly slides
    // one seat over before the next pick appears. Pack boundaries (fresh packs
    // are opened, nothing passes) and non-full animation settings skip it.
    const samePack = updated.draft!.packIndex === prevPackIndex;
    if (!samePack || Services.save.data.settings.animations !== 'full') {
      this.scene.start('LimitedDraft');
      return;
    }
    this.passing = true;
    this.guard.open(this.interactiveTargets);
    this.playPassAnimation(draftDirection(prevPackIndex), () => this.scene.start('LimitedDraft'));
  }

  /**
   * Slide a pack token from every seat to its neighbor in the pass direction.
   * The visual row is You,7,6,…1 (seatColumnX), so engine-'left' hand-offs move
   * one column LEFT; the edge token wraps by fading out while a twin fades in
   * on the opposite edge. Pure decoration: state is already committed and
   * input is guard-deadened until the scene restarts in `done`.
   */
  private playPassAnimation(direction: 'left' | 'right', done: () => void): void {
    const seatY = 163;
    const step = direction === 'left' ? -SEAT_PITCH : SEAT_PITCH;
    const cols = Array.from({ length: 8 }, (_, col) => SEAT_FIRST_X + col * SEAT_PITCH);
    const duration = 380;
    const makeToken = (tx: number, alpha = 1): Phaser.GameObjects.Rectangle =>
      this.add
        .rectangle(tx, seatY, 34, 44, theme.graphics.rowFillActive, 0.96)
        .setStrokeStyle(1.5, colorInt(theme.colors.gold), 1)
        .setDepth(60)
        .setAlpha(alpha);
    for (const cx of cols) {
      const wrapsOut = direction === 'left' ? cx === cols[0] : cx === cols[cols.length - 1];
      const token = makeToken(cx);
      this.tweens.add({
        targets: token,
        x: cx + step,
        alpha: wrapsOut ? 0 : 1,
        duration,
        ease: 'Cubic.easeInOut',
      });
    }
    // The wrap twin: enters from beyond the far edge toward the edge seat.
    const enterTo = direction === 'left' ? cols[cols.length - 1] : cols[0];
    const twin = makeToken(enterTo - step, 0);
    this.tweens.add({ targets: twin, x: enterTo, alpha: 1, duration, ease: 'Cubic.easeInOut' });
    this.time.delayedCall(duration + 40, done);
  }

  private currentPackVariant(index: number): CardVariant | undefined {
    const run = Services.save.data.limited.activeRun;
    return run?.premium ? run.draft?.currentPackVariants?.[0]?.[index] : undefined;
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

function frameIndicatorColor(frame: FrameStyle): number {
  return FRAME_TREATMENTS[frame].ring ?? colorInt(theme.colors.heading);
}

function holoIndicatorColor(holo: HoloFinish): string {
  switch (holo) {
    case 'none': return theme.colors.body;
    case 'shiny': return theme.colors.heading;
    case 'rainbow': return theme.colors.success;
    case 'pearlescent': return theme.colors.muted;
    case 'fractal': return theme.colors.gold;
    case 'void': return theme.colors.danger;
  }
}

function revealHint(tier: PersonaRevealTier): string {
  return tier <= 1
    ? 'A new face at the table. Finish drafts with them to learn how they pick.'
    : tier === 2
      ? 'Their deeper habits are still a mystery; keep drafting together.'
      : 'One more draft together and you will have their full read.';
}

function premiumVariantLine(variant: CardVariant | undefined): string {
  if (!variant || isPlainVariant(variant)) return 'Standard print';
  const frame = capitalize(variant.frame);
  const holo = variant.holo === 'none' ? 'No holo' : `${capitalize(variant.holo)} holo`;
  const fullArt = variant.fullArt ? 'Full Art - ' : '';
  return `${fullArt}${frame} frame - ${holo} - yours when the draft completes`;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Drafter';
}

function initial(name: string): string {
  return firstName(name).slice(0, 1).toUpperCase() || '?';
}
