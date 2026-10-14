import Phaser from 'phaser';
import { liveArtStore } from '../art/artLoader';
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
import { Services } from '../meta/services';
import {
  isPlainVariant,
  type CardVariant,
  type FrameStyle,
  type HoloFinish,
} from '../meta/variants';
import { bindTapButton, inflateHitArea, isTouchDevice } from '../platform/gestures';
import { IS_DEV } from '../platform/env';
import type { SaveData } from '../meta/SaveManager';
import { makeCardThumb, thumbArtWanted } from '../ui/CardThumbCache';
import { FRAME_TREATMENTS } from '../ui/CardFrameFactory';
import { CardView } from '../ui/CardView';
import { computeDeckStats, CURVE_MAX, PIE_COLORS } from '../ui/deckStats';
import { addKeywordGlossaryPanel } from '../ui/KeywordGlossaryPanel';
import { rarityLine } from '../ui/CardZoomPreview';
import { cardGlossaryEntries } from '../ui/rulesText';
import { leaveDraftPrompt } from '../ui/leaveDraftPrompt';
import {
  LIMITED_PICKS_PANEL,
  limitedPicksLayout,
  PICK_THUMB_SCALE,
  premiumGrantSummary,
  premiumOwnershipLine,
  type LimitedBuilderEntry,
  type LimitedDraftA11yFixture,
  type PremiumGrantSummary,
} from '../ui/limitedDraftPresentation';
import { bakeManaSymbols } from '../ui/ManaSymbols';
import { ModalGuard } from '../ui/Modal';
import { fitMenuName, type MenuDensity } from '../ui/menuText';
import { gateOnArt, PagedArt } from '../ui/artGate';
import { addPortraitArt } from '../ui/portraitArt';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { CARD_H, CARD_W } from '../ui/CardView';
import { COMPACT } from '../ui/compactLayout';
import { COMPACT_DRAG_SLOP, compactButton, compactDialog, compactHeader, coverFitImage, type CompactButton } from '../ui/compactWidgets';
import { medallionRim } from '../ui/duelCompact';
import { dashedRoundRect } from '../ui/DuelPhoneChrome';
import { limitedTileGrid } from '../ui/limitedBuilderCompact';
import { draftPicksGrid, LIMITED_DRAFT_COMPACT, limitedDraftLayout, type LimitedDraftLayout } from '../ui/limitedDraftCompact';
import { bindMenuScroll } from '../ui/menuScroll';
import { PackTile } from '../ui/PackTile';
import { ellipsizeText } from '../ui/textFit';
import { bakeUiIcon } from '../ui/uiIcons';
import type { Rect } from '../ui/layout';
import { sceneTitle } from '../ui/sceneTitle';
import { colorInt, theme } from '../ui/theme';
import { currentAccessibility } from '../ui/accessibility';
import { TRIGGER_SELECTED_MARK } from '../ui/controlStyle';
import {
  backButton,
  modalShell,
  panel,
  registerSceneBackNavigation,
  themedButton,
  type ModalShell,
  type ThemedButton,
} from '../ui/themeWidgets';

const DESIGN_W = theme.design.width;
const DESIGN_H = theme.design.height;
const PACK_THUMB_SCALE = 0.25;
const PACK_COLS = 5;
/** The pack grid (card faces, never scaled): three rows of five. */
const PACK_TOP = 330;
const PACK_ROW_PITCH = 122;
const PACK_PLATE = { width: 86, height: 116 } as const;
/** The persona modal: the release 700x420 panel, its top at y 150; it grows downward. */
const PERSONA_MODAL = { width: 700, height: 420, top: 150 } as const;
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
  /** The selected mark under the plate, so selection is not carried by colour alone. */
  mark: Phaser.GameObjects.Rectangle;
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
  private leavePrompt: ModalShell | null = null;
  /** True while the pass animation plays — re-entry guard for confirmPick. */
  private passing = false;
  /** Dev-only probe fixture: an in-memory save read instead of the real one, never persisted. */
  private fixture: LimitedDraftA11yFixture | null = null;
  private fixtureSave: SaveData | null = null;
  private touch = false;
  /** The compact composition's Pick selected, its selection mark, and where its seats sit (for the pass). */
  private compactPick: CompactButton | null = null;
  private compactMark: ((index: number) => void) | null = null;
  private compactSeats: { xs: number[]; y: number; d: number } | null = null;
  /** The compact inspect's Select, relabelled when the shown card is selected. */
  private inspectSelect: CompactButton | null = null;
  private get saveData(): SaveData {
    return this.fixtureSave ?? Services.save.data;
  }

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

  /**
   * Stream only the human's current pack at half tier and the table's
   * portraits at primary. The old loader keeps its whole-run gate.
   */
  create(data: { a11yFixture?: LimitedDraftA11yFixture } = {}): void {
    this.fixture = IS_DEV ? data.a11yFixture ?? null : null;
    this.fixtureSave = this.fixture ? structuredClone(this.fixture.save) : null;
    // Phaser keeps a start's data for the next start that passes none, so a
    // fixture must not outlive its probe visit.
    if (this.fixture) this.sys.settings.data = {};
    this.touch = this.fixture?.touch ?? isTouchDevice();
    this.data.set('a11yReady', false);
    const run = this.saveData.limited.activeRun;
    const draft = run?.draft;
    const portraits = (draft?.personaIds ?? [])
      .map((id) => draftPersonaById(id)?.portraitCardId)
      .filter((id): id is string => typeof id === 'string');
    if (liveArtStore() !== null) {
      gateOnArt(this, portraits, () => {
        gateOnArt(this, draft ? currentDraftPack(draft) : [], () => this.build(), { tier: 'half' });
      });
      return;
    }
    const ids = [
      ...(draft?.currentPacks.flat() ?? []),
      ...(draft?.packs.flat(2) ?? []),
      ...(draft?.picks.flat() ?? []),
      ...portraits,
    ];
    gateOnArt(this, ids, () => this.build());
  }
  private build(): void {
    this.selectedId = null;
    this.selectedCell = -1;
    this.packCells = [];
    this.interactiveTargets = [];
    this.modal = null;
    this.guard = new ModalGuard();
    this.pickButton = null;
    this.inspectIndex = null;
    this.inspectHint = null;
    this.leavePrompt = null;
    this.passing = false;
    this.compactPick = null;
    this.compactMark = null;
    this.compactSeats = null;
    this.inspectSelect = null;
    const compact = sceneStage(this).compact;

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

    const run = this.saveData.limited.activeRun;
    if (!run || !run.draft) {
      this.scene.start('Limited');
      return;
    }
    if (!compact) backButton(this, 'Draft', () => this.leaveDraft());
    registerSceneBackNavigation(this, () => this.leaveDraft());
    if (run.draft.completed) {
      // Interrupted-save path (confirmPick normally records before this).
      const grant = premiumGrantSummary(grantPremiumDraftPool(this.saveData, CARD_DB, run));
      recordDraftEncounters(this.saveData.limited, run);
      this.saveData.limited.activeRun = completeDraftRun(CARD_DB, run);
      this.persist();
      this.openBuilder(grant);
      return;
    }

    const pack = currentDraftPack(run.draft);
    if (compact) {
      this.drawCompact(run, pack);
    } else {
      this.drawHeader(run, pack.length);
      this.drawSeatTable(run);
      this.drawPack(run, pack);
      this.drawPicks(run);
      this.drawActions(run);
    }
    this.openFixtureState(run, pack);
    this.data.set('a11yReady', true);
  }

  /** The probe fixture's selection and modal, opened the way a player opens them. */
  private openFixtureState(run: LimitedRun, pack: readonly string[]): void {
    const f = this.fixture;
    if (!f) return;
    if (f.select !== undefined && pack[f.select]) this.selectCard(f.select, pack[f.select]);
    if (f.modal === 'leave') this.leaveDraft();
    if (f.modal === 'persona') this.showPersona(this.identityForSeat(run, f.seat ?? 0));
    if (f.modal === 'inspect' && pack[f.inspect ?? 0]) this.showCardInspect(def(CARD_DB, pack[f.inspect ?? 0]), f.inspect ?? 0);
  }

  /** The release grid density, the 100% contract the probe checks. */
  private recordDensity(actual: MenuDensity, release: MenuDensity): void {
    const density = (this.data.get('a11yDensity') as { actual: MenuDensity[]; release: MenuDensity[] } | undefined)
      ?? { actual: [], release: [] };
    this.data.set('a11yDensity', {
      actual: [...density.actual.filter((d) => d.id !== actual.id), actual],
      release: [...density.release.filter((d) => d.id !== release.id), release],
    });
  }

  /** Fixtures never reach storage. */
  private persist(): void {
    if (!this.fixture) Services.save.flush();
  }

  private drawHeader(run: LimitedRun, remainingCards: number): void {
    const draft = run.draft!;
    const packSize = Math.max(ECONOMY.limitedPackSize, remainingCards + draft.pickIndex);
    sceneTitle(this, run.premium ? 'Premium Draft' : 'Free Draft');
    // The pack and pick readout takes the header line's right slot (this
    // screen shows no gold). Under the title it had no room: the seat table
    // starts at y 96, one header track below the frame's top edge.
    this.add
      .text(
        theme.design.safeRight,
        theme.design.headerCenterY,
        `Pack ${draft.packIndex + 1}/${DRAFT_PACKS} · Pick ${draft.pickIndex + 1}/${packSize}`,
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          fontStyle: theme.weight.w600,
          color: theme.colors.gold,
        },
      )
      .setOrigin(1, 0.5);
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

    this.recordDensity({ id: 'pack', rows: 3, columns: PACK_COLS, pitch: PACK_ROW_PITCH, top: PACK_TOP },
      { id: 'pack', rows: 3, columns: 5, pitch: 122, top: 330 });
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
      const cy = PACK_TOP + row * PACK_ROW_PITCH;
      const plate = this.add
        .rectangle(cx, cy, PACK_PLATE.width, PACK_PLATE.height, theme.graphics.rowFill, 0.92)
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
      // A gold bar just under the plate, half its width (the filter
      // trigger's selected mark): the selected plate's gold stroke and fill
      // would otherwise be the only carriers, beside special prints' own
      // coloured strokes. It sits in the 6px gap above the next row.
      const thickness = currentAccessibility().highContrast
        ? TRIGGER_SELECTED_MARK.highContrastThickness
        : TRIGGER_SELECTED_MARK.thickness;
      const mark = this.add
        .rectangle(cx, cy + PACK_PLATE.height / 2 + 2 + thickness / 2, PACK_PLATE.width / 2, thickness, colorInt(theme.colors.gold), 1)
        .setVisible(false);
      this.packCells.push({ plate, thumb, mark, baseStroke, baseStrokeWidth, baseStrokeAlpha });
      this.interactiveTargets.push(thumb);
    });
  }

  private drawPicks(run: LimitedRun): void {
    const picks = [...(run.draft?.picks[0] ?? [])].reverse();
    const art = new PagedArt(this, 'draft-picks');
    const wanted = picks.flatMap((id) => {
      const request = thumbArtWanted(this, def(CARD_DB, id));
      return request === null ? [] : [request.key];
    });
    art.show(wanted);
    const stats = computeDeckStats([...picks], CARD_DB);
    const P = LIMITED_PICKS_PANEL;
    const L = limitedPicksLayout();
    const x = P.x;
    const y = P.y;
    panel(this, x, y, P.width, P.height, { alpha: 0.96 });
    this.add.text(x + 16, y + 12, `Your Picks (${picks.length})`, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h2}px`,
      color: theme.colors.heading,
    });

    this.add.text(x + 16, y + L.colorsTop, 'COLORS', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.muted,
    });
    PIE_COLORS.forEach((color, index) => {
      const pipX = x + 27 + index * 67;
      this.add.image(pipX, y + L.pipY, `pip-${color}`).setDisplaySize(18, 18);
      this.add
        .text(pipX + 13, y + L.pipY, String(stats.colorPips[color]), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w600,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
    });

    this.add.text(x + 16, y + L.curveTop, 'MANA CURVE', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.muted,
    });
    for (let mv = 0; mv <= CURVE_MAX; mv++) {
      const cx = x + 32 + mv * 41;
      this.add
        .text(cx, y + L.axisY, mv === CURVE_MAX ? '7+' : String(mv), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5);
      this.add
        .text(cx, y + L.countY, String(stats.curve[mv]), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w700,
          color: stats.curve[mv] > 0 ? theme.colors.gold : theme.colors.body,
        })
        .setOrigin(0.5);
    }

    this.add.rectangle(x + 184, y + L.ruleY, 336, 1, theme.graphics.panelStroke, 1);
    this.add.text(x + 16, y + L.listTop, 'DRAFTED CARDS · MOST RECENT FIRST', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.micro}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.muted,
    });

    picks.forEach((id, index) => {
      const col = index % L.columns;
      const row = Math.floor(index / L.columns);
      makeCardThumb(this, x + P.thumbInset + col * L.columnPitch, y + L.gridTop + row * L.rowPitch, def(CARD_DB, id), PICK_THUMB_SCALE);
    });
    this.recordDensity({ id: 'picks', rows: L.rows, columns: L.columns, pitch: L.rowPitch, top: y + L.gridTop },
      { id: 'picks', rows: 5, columns: 9, pitch: 43, top: 428 });
    if (picks.length === 0) {
      this.add
        .text(x + 184, y + L.emptyY, 'Your picks will collect here.', {
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
      this.touch
        ? 'Tap a card to select · long-press to inspect'
        : 'Click selects · right-click inspects · in inspect: arrows browse, Space/Enter selects then picks',
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      },
    ).setOrigin(0, 0.5);

    this.pickButton = themedButton(this, 1106, 660, 'Pick Selected', {
      variant: 'primary',
      minWidth: 180,
      enabled: false,
      onTap: () => this.confirmPick(run),
    });
    this.interactiveTargets.push(this.pickButton.inputZone);
  }

  private leaveDraft(): void {
    const run = this.saveData.limited.activeRun;
    if (!run) {
      this.scene.start('Limited');
      return;
    }
    if (this.leavePrompt) return;
    if (sceneStage(this).compact) {
      const dialog = compactDialog(this, {
        title: 'Leave Draft?',
        message: 'Your draft run is saved and can be resumed from the Draft hub. Leave now?',
        secondary: { label: 'Keep drafting', onTap: (close) => close() },
        primary: { label: 'Leave', onTap: (close) => { close(); this.scene.start('Limited'); } },
        dismissal: 'dismissible',
        onClose: () => {
          if (this.leavePrompt === dialog) this.leavePrompt = null;
        },
      });
      this.leavePrompt = dialog;
      return;
    }
    const shell = leaveDraftPrompt(this, {
      stayLabel: 'Keep Drafting',
      onLeave: () => this.scene.start('Limited'),
      onClose: () => {
        if (this.leavePrompt === shell) this.leavePrompt = null;
      },
    });
    this.leavePrompt = shell;
  }

  private selectCard(index: number, id: string): void {
    // No modal guard here: pointer paths are already deadened by ModalGuard
    // while a modal is open, and the inspect-modal hotkeys select on purpose.
    this.selectedCell = index;
    this.selectedId = id;
    this.pickButton?.setEnabled(true);
    this.compactPick?.setEnabled(true);
    this.compactMark?.(index);
    this.refreshPackSelection();
  }

  /** The pack shown by the current draft state (empty when no run). */
  private currentPack(): readonly string[] {
    const run = this.saveData.limited.activeRun;
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
    const run = this.saveData.limited.activeRun;
    if (!run) return;
    this.closeModal();
    this.confirmPick(run);
  };

  private refreshInspectHint(): void {
    if (this.inspectSelect && this.inspectIndex !== null) {
      this.inspectSelect.setLabel(this.selectedCell === this.inspectIndex ? 'Selected' : 'Select');
    }
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
    this.packCells.forEach(({ plate, mark, baseStroke, baseStrokeWidth, baseStrokeAlpha }, index) => {
      const selected = index === this.selectedCell;
      mark.setVisible(selected);
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
    if (sceneStage(this).compact) {
      this.showCompactPersona(identity);
      return;
    }
    // The reading column flows top to bottom from each line's measured
    // bottom; the release offsets (name 214, the next line 259, colours 302,
    // the blurb or hint 352, familiarity 465) are floors, so the standard
    // size draws as before and larger text pushes lines down instead of
    // over each other. The panel's top stays put and it grows downward.
    const columnX = 582;
    const wrap = { width: 330, useAdvancedWrap: true };
    const lines: Phaser.GameObjects.Text[] = [];
    let bottom = 0;
    const line = (floor: number, text: Phaser.GameObjects.Text): Phaser.GameObjects.Text => {
      text.setY(Math.max(floor, bottom === 0 ? floor : bottom + theme.space(2)));
      bottom = text.y + text.height;
      lines.push(text);
      return text;
    };
    const name = line(214, this.add.text(columnX, 0, identity.name, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h1}px`,
      color: theme.colors.heading,
    }));
    fitMenuName(name, wrap.width, 3);
    bottom = name.y + name.height;
    // Progressive reveal: tier 2 shows color habits, tier 3 the theme, tier 4
    // the full read. Below the threshold each slot shows what's still hidden.
    if (identity.tier >= 3) {
      fitMenuName(line(259, this.add.text(columnX, 0, identity.title, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.body}px`,
        fontStyle: 'italic',
        color: theme.colors.gold,
        wordWrap: wrap,
      })), wrap.width, 3);
    }
    if (identity.tier >= 2) {
      line(identity.tier >= 3 ? 302 : 259, this.add.text(columnX, 0, `Colors: ${identity.colorHint}`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.body,
        lineSpacing: 5,
        wordWrap: wrap,
      }));
    }
    if (identity.tier >= 4) {
      line(352, this.add.text(columnX, 0, identity.blurb, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.body,
        lineSpacing: 6,
        wordWrap: wrap,
      }));
    } else {
      line(identity.tier >= 2 ? 352 : 259, this.add.text(columnX, 0, revealHint(identity.tier), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: 'italic',
        color: theme.colors.muted,
        lineSpacing: 5,
        wordWrap: wrap,
      }));
    }
    const pips = '◆'.repeat(identity.tier) + '◇'.repeat(4 - identity.tier);
    line(465, this.add.text(columnX, 0, `Familiarity ${pips}`, {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.caption}px`,
      fontStyle: theme.weight.w700,
      color: identity.tier >= 4 ? theme.colors.gold : theme.colors.muted,
    }));
    for (const text of lines) text.setData('a11yFullText', text.text);

    const top = PERSONA_MODAL.top;
    const height = Math.max(PERSONA_MODAL.height, Math.ceil(bottom + theme.space(6) - top));
    const shell = modalShell(this, {
      width: PERSONA_MODAL.width,
      height,
      y: top + height / 2,
      dimAlpha: 0.76,
      depth: theme.depth.modal,
      dismissal: 'dismissible',
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
    c.add(lines);
  }
  private showCardInspect(card: CardDef, packIndex: number): void {
    this.closeModal();
    if (sceneStage(this).compact) {
      this.showCompactInspect(card, packIndex);
      return;
    }
    const shell = modalShell(this, {
      width: 980,
      height: 610,
      dimAlpha: 0.8,
      depth: theme.depth.inspect,
      dismissal: 'dismissible',
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

    const run = this.saveData.limited.activeRun;
    const stats = computeDeckStats([...(run?.draft?.picks[0] ?? [])], CARD_DB);
    const poolColors = this.add
      .text(columnX, 160, 'POOL COLORS', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
    c.add(poolColors);
    // The first pip (18px wide) keeps a grid step clear of the label as it grows.
    const firstPipX = Math.max(columnX + 112, poolColors.x + poolColors.width + theme.space(2) + 9);
    PIE_COLORS.forEach((color, index) => {
      const pipX = firstPipX + index * 68;
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
    let curveBottom = 244;
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
      const count = this.add
        .text(bucketX, 244, highlighted ? `${stats.curve[mv]}→${stats.curve[mv] + 1}` : String(stats.curve[mv]), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: highlighted ? theme.weight.w700 : theme.weight.w600,
          color: highlighted ? theme.colors.gold : theme.colors.body,
        })
        .setOrigin(0.5);
      curveBottom = Math.max(curveBottom, count.y + count.height / 2);
      c.add(count);
    }

    // The tier as words (the face shows it only as a gem colour), between the
    // curve and the glossary panel, which starts below its measured bottom.
    let glossaryTop = 300;
    if (!card.token) {
      const rarity = this.add.text(columnX, curveBottom + theme.space(3), rarityLine(card), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: theme.colors.body,
        wordWrap: { width: columnWidth },
      });
      glossaryTop = Math.max(glossaryTop, rarity.y + rarity.height + theme.space(4));
      c.add(rarity);
    }

    // Every glossary term the card uses, not only combat keywords: the panel
    // reads the same entries Collection's inspect shows (Duty, Foresee,
    // Sever...) and draws nothing for a card with none.
    const closeHint = this.add
      .text(884, 598, `${this.touch ? 'Tap' : 'Click'} outside or use × to close`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);

    // The Premium lines: the print at y 520 and the ownership line at 550 at
    // the standard size; a wrapped print line pushes the ownership line down,
    // and if the pair would reach the close hint the pair moves up instead,
    // taking the room out of the glossary panel above it.
    let glossaryBottom = run?.premium ? 500 : 580;
    if (run?.premium) {
      const print = this.add.text(columnX, 520, premiumVariantLine(variant), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w600,
        color: !variant || isPlainVariant(variant) ? theme.colors.body : theme.colors.gold,
        wordWrap: { width: columnWidth },
      });
      const ownership = this.add.text(
        columnX,
        0,
        premiumOwnershipLine(this.saveData, card.id, variant, {
          picks: run.draft?.picks[0] ?? [],
          pickVariants: run.draft?.pickVariants,
        }),
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
          wordWrap: { width: columnWidth },
        },
      );
      ownership.setY(Math.max(550, print.y + print.height + theme.space(2)));
      const limit = closeHint.y - closeHint.height / 2 - theme.space(2);
      const lift = Math.max(0, ownership.y + ownership.height - limit);
      print.y -= lift;
      ownership.y -= lift;
      glossaryBottom = Math.min(glossaryBottom, print.y - theme.space(5));
      c.add([print, ownership]);
    }
    addKeywordGlossaryPanel(this, c, card, {
      x: columnX,
      y: glossaryTop,
      width: columnWidth,
      maxHeight: glossaryBottom - glossaryTop,
    });
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
    c.add(closeHint);
  }

  // ------------------------------------------------------------------ compact (phone and desktop)

  /** The compact composition (S-Draft-Pick): seats over the pack's tiles, Your Picks in the column. */
  private drawCompact(run: LimitedRun, pack: readonly string[]): void {
    const stage = sceneStage(this);
    const type = theme.compactType;
    const draft = run.draft!;
    const probe = this.add.text(0, 0, 'Ag', { fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w600 });
    const nameH = probe.height;
    probe.destroy();
    const heading = this.add.text(0, 0, `Current Pack (${pack.length})`, {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    const layout = limitedDraftLayout(stage.content, nameH, heading.height);
    heading.setPosition(layout.packHeading.x, layout.packHeading.y);
    const packSize = Math.max(ECONOMY.limitedPackSize, pack.length + draft.pickIndex);
    const header = compactHeader(this, layout.shell, {
      title: run.premium ? 'Premium Draft' : 'Free Draft',
      subtitle: `Pack ${draft.packIndex + 1}/${DRAFT_PACKS} · Pick ${draft.pickIndex + 1}/${packSize}`,
      onBack: () => this.leaveDraft(),
    });
    header.subtitle?.setColor(theme.colors.gold).setFontStyle(theme.weight.w600);
    // The pass direction ends over the main pane's right edge, above the seats it describes.
    const direction = draftDirection(draft.packIndex);
    const arrow = direction === 'left' ? '←' : '→';
    const mainRight = layout.grid.x + layout.grid.width;
    const pass = this.add.text(mainRight, layout.shell.right.y + layout.shell.right.height / 2, `${arrow}  PASS ${direction.toUpperCase()}  ${arrow}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    }).setOrigin(1, 0.5).setLetterSpacing(1);
    let titleRight = pass.x - pass.width - COMPACT.gap;
    // At larger text the header keeps only the title; the pack and pick then ride over the pass direction.
    if (!header.subtitle) {
      const readout = this.add.text(mainRight, 0, `Pack ${draft.packIndex + 1}/${DRAFT_PACKS} · Pick ${draft.pickIndex + 1}/${packSize}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.gold,
      }).setOrigin(1, 0);
      const top = layout.shell.right.y + (layout.shell.right.height - readout.height - pass.height) / 2;
      readout.setY(top);
      pass.setY(top + readout.height + pass.height / 2);
      titleRight = Math.min(titleRight, readout.x - readout.width - COMPACT.gap);
    }
    ellipsizeText(header.title, titleRight - header.title.x);
    if (header.subtitle) ellipsizeText(header.subtitle, titleRight - header.subtitle.x);
    this.drawCompactSeats(run, layout, arrow);
    this.drawCompactPack(run, pack, layout);
    this.drawCompactPicks(run, layout);
    this.compactPick = compactButton(this, layout.foot, 'Pick selected', { variant: 'primary', onTap: () => this.confirmPick(run) });
    this.compactPick.setEnabled(false);
    this.interactiveTargets.push(this.compactPick.inputZone);
  }

  /** The table: You, then seats 7 to 1 (seatColumnX's order), round portraits over first names, arrows the way packs flow. */
  private drawCompactSeats(run: LimitedRun, layout: LimitedDraftLayout, arrow: string): void {
    const type = theme.compactType;
    const d = layout.seatD;
    const y = layout.seatY;
    const xs = layout.seatXs;
    const pitch = xs[1] - xs[0];
    this.compactSeats = { xs, y, d };
    for (let seat = 0; seat < DRAFT_SEATS; seat++) {
      const identity = this.identityForSeat(run, seat);
      const x = xs[seat === 0 ? 0 : DRAFT_SEATS - seat];
      const ring = identity.human ? colorInt(theme.colors.gold) : theme.graphics.panelStroke;
      const group = this.add.container(0, 0);
      group.add(this.add.circle(x, y, d / 2, theme.graphics.panelFill, 1));
      if (identity.human) {
        group.add(this.add.image(x, y, bakeUiIcon(this, 'profile')).setDisplaySize(d * 0.55, d * 0.55).setTint(colorInt(theme.colors.gold)));
      } else {
        group.add(this.add.text(x, y, initial(identity.name), {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.muted,
        }).setOrigin(0.5));
        this.addPortrait(group, identity.portraitCardId, x, y, d, d, true);
      }
      group.add(this.add.circle(x, y, d / 2, theme.graphics.dim, 0).setStrokeStyle(identity.human ? 2 : 1.5, ring, 1));
      const name = this.add.text(x, y + d / 2 + 2, identity.human ? 'You' : firstName(identity.name), {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: identity.human ? theme.weight.w700 : theme.weight.w600,
        color: identity.human ? theme.colors.gold : theme.colors.body,
      }).setOrigin(0.5, 0);
      ellipsizeText(name, pitch - 4);
      name.setData('a11yFullText', identity.name);
      const zone = this.add.zone(x, layout.seats.y + layout.seats.height / 2, pitch, Math.max(layout.seats.height, COMPACT.touch))
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, zone, () => this.showPersona(identity));
      this.interactiveTargets.push(zone);
    }
    for (let col = 0; col < DRAFT_SEATS - 1; col++) {
      this.add.text((xs[col] + xs[col + 1]) / 2, y, arrow, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      }).setOrigin(0.5);
    }
  }

  /** The pack as art tiles: a tap selects, a hold (or a right-click) opens the card's pick impact. */
  private drawCompactPack(run: LimitedRun, pack: readonly string[], layout: LimitedDraftLayout): void {
    const D = LIMITED_DRAFT_COMPACT;
    const type = theme.compactType;
    const area = layout.grid;
    const grid = limitedTileGrid(area, pack.length, layout.k, { minW: D.tileMinW, aspect: D.tileAspect });
    const list = this.add.container(0, area.y);
    new PagedArt(this, 'draft-pack').show([], pack);
    pack.forEach((id, index) => {
      const variant = this.currentPackVariant(index);
      list.add(new PackTile(this, grid.cells[index]).showFace(def(CARD_DB, id), variant?.frame ?? 'white'));
    });
    // The selection: a gold rim and a check disc in the tile's top-right corner.
    const mark = this.add.graphics();
    list.add(mark);
    const check = this.add.image(0, 0, bakeUiIcon(this, 'check')).setTint(colorInt(theme.colors.onGold)).setVisible(false);
    list.add(check);
    this.compactMark = (index: number): void => {
      mark.clear();
      const cell = grid.cells[index];
      if (!cell) {
        check.setVisible(false);
        return;
      }
      const disc = Math.round(Math.min(type.label * 1.8, cell.width * 0.3));
      const cx = cell.x + cell.width - disc / 2 - 3;
      const cy = cell.y + disc / 2 + 3;
      mark.lineStyle(3.5, colorInt(theme.colors.gold), 1).strokeRoundedRect(cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2, theme.radius.panel);
      mark.fillStyle(colorInt(theme.colors.gold), 1).fillCircle(cx, cy, disc / 2).lineStyle(1.5, theme.graphics.panelFill, 1).strokeCircle(cx, cy, disc / 2);
      check.setPosition(cx, cy).setDisplaySize(disc * 0.62, disc * 0.62).setVisible(true);
    };
    const blocked = (): boolean => this.modal !== null || this.leavePrompt !== null || this.passing;
    const scroll = bindMenuScroll(this, list, area, grid.contentH, blocked);
    const indexAt = (p: Phaser.Input.Pointer): number => {
      const y = p.worldY - area.y + scroll.offset();
      return grid.cells.findIndex((c) => p.worldX >= c.x && p.worldX <= c.x + c.width && y >= c.y && y <= c.y + c.height);
    };
    const zone = this.add.zone(area.x + area.width / 2, area.y + area.height / 2, area.width, area.height).setInteractive({ useHandCursor: true });
    this.interactiveTargets.push(zone);
    let hold: Phaser.Time.TimerEvent | null = null;
    let held = false;
    const inspect = (index: number): void => this.showCardInspect(def(CARD_DB, pack[index]), index);
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      held = false;
      hold?.remove(false);
      if (p.rightButtonDown()) return;
      const index = indexAt(p);
      if (index < 0) return;
      hold = this.time.delayedCall(450, () => {
        hold = null;
        if (Math.abs(p.y - p.downY) > COMPACT_DRAG_SLOP) return;
        held = true;
        inspect(index);
      });
    });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      hold?.remove(false);
      hold = null;
      if (held || blocked() || Math.abs(p.upY - p.downY) > COMPACT_DRAG_SLOP) return;
      const index = indexAt(p);
      if (index < 0) return;
      if (p.rightButtonReleased()) inspect(index);
      else this.selectCard(index, pack[index]);
    });
    zone.on('pointerout', () => {
      hold?.remove(false);
      hold = null;
    });
  }

  /** Your Picks: colours, the mana curve, then the drafted cards, most recent first, as many as fit and a "+N". */
  private drawCompactPicks(run: LimitedRun, layout: LimitedDraftLayout): void {
    const type = theme.compactType;
    const box = layout.picks;
    const picks = [...(run.draft?.picks[0] ?? [])].reverse();
    const stats = computeDeckStats([...picks], CARD_DB);
    let y = box.y;
    const heading = this.add.text(box.x, y, `Your Picks (${picks.length})`, {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    y += heading.height + 4;
    const label = (text: string): number => {
      const t = this.add.text(box.x, y, text, {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.muted,
        wordWrap: { width: box.width, useAdvancedWrap: true },
      });
      return t.height;
    };
    y += label('COLORS') + 4;
    const pip = Math.round(type.label * 1.3);
    const colorPitch = box.width / PIE_COLORS.length;
    let rowH = pip;
    PIE_COLORS.forEach((color, i) => {
      const px = box.x + i * colorPitch;
      this.add.image(px + pip / 2, y + pip / 2, `pip-${color}`).setDisplaySize(pip, pip);
      const count = this.add.text(px + pip + 4, y + pip / 2, String(stats.colorPips[color]), {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
      }).setOrigin(0, 0.5);
      rowH = Math.max(rowH, count.height);
    });
    y += rowH + 6;
    y += label('MANA CURVE') + 2;
    const curvePitch = box.width / (CURVE_MAX + 1);
    let axisH = 0;
    let countH = 0;
    for (let mv = 0; mv <= CURVE_MAX; mv++) {
      const cx = box.x + curvePitch * (mv + 0.5);
      const axis = this.add.text(cx, y, mv === CURVE_MAX ? '7+' : String(mv), {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: theme.colors.muted,
      }).setOrigin(0.5, 0);
      axisH = Math.max(axisH, axis.height);
      const count = this.add.text(cx, y + axis.height, String(stats.curve[mv]), {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700,
        color: stats.curve[mv] > 0 ? theme.colors.gold : theme.colors.body,
      }).setOrigin(0.5, 0);
      countH = Math.max(countH, count.height);
    }
    y += axisH + countH + 6;
    y += label('DRAFTED CARDS · MOST RECENT FIRST') + 6;
    const area: Rect = { x: box.x, y, width: box.width, height: Math.max(0, box.y + box.height - y) };
    if (picks.length === 0) {
      this.add.text(area.x, area.y, 'Your picks will collect here.', {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: area.width, useAdvancedWrap: true },
      });
      return;
    }
    const grid = draftPicksGrid(area, picks.length);
    new PagedArt(this, 'draft-picks').show([], picks.slice(0, grid.shown));
    const g = this.add.graphics();
    picks.slice(0, grid.shown).forEach((id, i) => {
      const card = def(CARD_DB, id);
      const cell = grid.cells[i];
      g.fillStyle(theme.graphics.panelFill, 1).fillRoundedRect(cell.x, cell.y, cell.width, cell.height, 4);
      const art = { x: cell.x + 2, y: cell.y + 2, width: cell.width - 4, height: cell.height - 4 };
      try {
        addPortraitArt(this, art.x + art.width / 2, art.y + art.height / 2, id, (img) => coverFitImage(img, art, 0.1), 'half');
      } catch {
        // No art: the rim alone marks the slot.
      }
      const rim = this.add.graphics();
      rim.lineStyle(2, colorInt(medallionRim(card.colors, card.types)), 1).strokeRoundedRect(cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2, 4);
    });
    if (grid.more > 0) {
      const cell = grid.cells[grid.cells.length - 1];
      const dash = this.add.graphics().lineStyle(1.5, colorInt(theme.colors.muted), 0.8);
      dashedRoundRect(dash, cell.x + 1, cell.y + 1, cell.width - 2, cell.height - 2, 4);
      const more = this.add.text(cell.x + cell.width / 2, cell.y + cell.height / 2, `+${grid.more}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      }).setOrigin(0.5);
      ellipsizeText(more, cell.width - 2);
    }
  }

  /**
   * A full-stage shell for a compact sheet over the main pane (the column
   * stays in view): its own panel, the close button in the sheet's corner.
   */
  private compactSheet(depth: number): { shell: ModalShell; sheet: Rect; closeW: number } {
    const stage = sceneStage(this);
    const sheet = limitedDraftLayout(stage.content, 0, 0).sheet;
    const shell = modalShell(this, {
      width: stage.width, height: stage.height, x: stage.width / 2, y: stage.height / 2,
      dimAlpha: 0, depth, dismissal: 'dismissible',
      onClose: () => this.onModalClosed(shell),
    });
    shell.panel.clear();
    const c = shell.container;
    c.setData('a11ySurface', { x: 0, y: 0, width: stage.width, height: stage.height }).setData('a11yPanel', sheet);
    const plate = panel(this, sheet.x, sheet.y, sheet.width, sheet.height, { alpha: 1 });
    c.addAt(plate, 2);
    let closeW = 0;
    if (shell.closeButton) {
      const visual = shell.closeButton.getMeasuredSize().visual;
      closeW = visual.width;
      shell.closeButton.container.setPosition(sheet.x + sheet.width - 8 - visual.width / 2, sheet.y + 8 + visual.height / 2);
      c.bringToTop(shell.closeButton.container);
    }
    this.modal = shell;
    this.guard.open(this.interactiveTargets);
    return { shell, sheet, closeW };
  }

  /** A drafter's profile (S-Draft-Drafter): the portrait, then what familiarity has revealed. */
  private showCompactPersona(identity: SeatIdentity): void {
    const type = theme.compactType;
    const { shell, sheet, closeW } = this.compactSheet(theme.depth.modal);
    const c = shell.container;
    const pad = 12;
    const picH = sheet.height - 2 * pad;
    const picW = Math.min(Math.round(picH * 0.65), Math.round(sheet.width * 0.45));
    const pic = { x: sheet.x + pad, y: sheet.y + pad, width: picW, height: picH };
    const picCx = pic.x + pic.width / 2;
    const picCy = pic.y + pic.height / 2;
    c.add(this.add.rectangle(picCx, picCy, pic.width, pic.height, theme.graphics.dim, 1));
    if (identity.human) {
      c.add(this.add.image(picCx, picCy, bakeUiIcon(this, 'profile')).setDisplaySize(picW * 0.4, picW * 0.4).setTint(colorInt(theme.colors.gold)));
    } else {
      c.add(this.add.text(picCx, picCy, initial(identity.name), {
        fontFamily: theme.fonts.display, fontSize: `${theme.type.display}px`, color: theme.colors.muted,
      }).setOrigin(0.5));
      this.addPortrait(c, identity.portraitCardId, picCx, picCy, pic.width, pic.height, false);
    }
    c.add(this.add.graphics().lineStyle(2, colorInt(theme.colors.gold), 1).strokeRoundedRect(pic.x, pic.y, pic.width, pic.height, theme.radius.panel));
    const x = pic.x + pic.width + 16;
    const width = sheet.x + sheet.width - pad - x;
    let y = sheet.y + pad + 4;
    const line = (text: string, style: Phaser.Types.GameObjects.Text.TextStyle, w = width, gapAfter = 10): Phaser.GameObjects.Text => {
      const t = this.add.text(x, y, text, { ...style, wordWrap: { width: w, useAdvancedWrap: true } });
      t.setData('a11yFullText', text);
      c.add(t);
      y += t.height + gapAfter;
      return t;
    };
    line(identity.name, { fontFamily: theme.fonts.display, fontSize: `${type.h1}px`, fontStyle: theme.weight.w700, color: theme.colors.heading },
      width - closeW - 8, 4);
    if (identity.tier >= 3) {
      line(identity.title, { fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: `italic ${theme.weight.w700}`, color: theme.colors.gold });
    }
    y += 6;
    if (identity.tier >= 2) line(`Colors: ${identity.colorHint}`, { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, lineSpacing: 4 }, width, 14);
    if (identity.tier >= 4) line(identity.blurb, { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, lineSpacing: 4 });
    else line(revealHint(identity.tier), { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: 'italic', color: theme.colors.muted, lineSpacing: 4 });
    const pips = '◆'.repeat(identity.tier) + '◇'.repeat(4 - identity.tier);
    const familiarity = this.add.text(x, 0, `Familiarity ${pips}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w700,
      color: identity.tier >= 4 ? theme.colors.gold : theme.colors.muted,
    });
    familiarity.setY(Math.max(y, pic.y + pic.height - familiarity.height));
    familiarity.setData('a11yFullText', familiarity.text);
    c.add(familiarity);
  }

  /**
   * A pack card's pick impact (S-Draft-Inspect): the card, then the pool's
   * colours and curve before and after taking it, its rarity, its keywords,
   * and Select at the foot.
   */
  private showCompactInspect(card: CardDef, packIndex: number): void {
    const type = theme.compactType;
    const { shell, sheet, closeW } = this.compactSheet(theme.depth.inspect);
    this.inspectIndex = packIndex;
    const c = shell.container;
    const pad = 12;
    const scale = Math.min((sheet.height - 2 * pad) / CARD_H, (sheet.width * 0.45) / CARD_W);
    const cardW = CARD_W * scale;
    const variant = this.currentPackVariant(packIndex);
    const view = new CardView(this, sheet.x + pad + cardW / 2, sheet.y + sheet.height / 2).setScale(scale);
    view.setCard(card, variant ? { fx: 'full', variant, fullArt: variant.fullArt } : { fx: 'full' });
    c.add(view);
    const x = sheet.x + pad + cardW + 16;
    const width = sheet.x + sheet.width - pad - x;
    let y = sheet.y + pad + 4;
    const label = (text: string): void => {
      const t = this.add.text(x, y, text, {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w700, color: theme.colors.muted,
      });
      c.add(t);
      y += t.height + 4;
    };
    label('PICK IMPACT');
    y = Math.max(y + 6, sheet.y + pad + closeW * 0.5);
    const run = this.saveData.limited.activeRun;
    const stats = computeDeckStats([...(run?.draft?.picks[0] ?? [])], CARD_DB);
    label('POOL COLORS');
    // The five colours flow left to right and wrap when a "12→13" will not fit.
    const pip = Math.round(type.label * 1.2);
    let px = x;
    let rowH = pip;
    PIE_COLORS.forEach((color) => {
      const before = stats.colorPips[color];
      const contribution = card.colors.includes(color) ? (card.cost?.pips[color] ?? 0) : 0;
      const count = this.add.text(0, 0, contribution > 0 ? `${before}→${before + contribution}` : String(before), {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: contribution > 0 ? theme.weight.w700 : theme.weight.w600,
        color: contribution > 0 ? theme.colors.gold : theme.colors.body,
      }).setOrigin(0, 0.5);
      const entryW = pip + 4 + count.width;
      if (px > x && px + entryW > x + width) {
        px = x;
        y += rowH + 6;
      }
      rowH = Math.max(pip, count.height);
      c.add(this.add.image(px + pip / 2, y + rowH / 2, `pip-${color}`).setDisplaySize(pip, pip));
      count.setPosition(px + pip + 4, y + rowH / 2);
      c.add(count);
      px += entryW + 12;
    });
    y += rowH + 10;
    label('CURVE');
    const bucket = card.types.includes('land') ? null : Math.min(manaValue(card.cost), CURVE_MAX);
    const curvePitch = width / (CURVE_MAX + 1);
    let curveH = 0;
    for (let mv = 0; mv <= CURVE_MAX; mv++) {
      const cx = x + curvePitch * (mv + 0.5);
      const hot = mv === bucket;
      const axis = this.add.text(cx, y, mv === CURVE_MAX ? '7+' : String(mv), {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: hot ? theme.colors.gold : theme.colors.muted,
      }).setOrigin(0.5, 0);
      const count = this.add.text(cx, y + axis.height, hot ? `${stats.curve[mv]}→${stats.curve[mv] + 1}` : String(stats.curve[mv]), {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: hot ? theme.weight.w700 : theme.weight.w600,
        color: hot ? theme.colors.gold : theme.colors.body,
      }).setOrigin(0.5, 0);
      // A "4→5" wider than its bucket steps down a size rather than run into its neighbours.
      if (count.width > curvePitch - 4) count.setFontSize(type.caption);
      curveH = Math.max(curveH, axis.height + count.height);
      c.add([axis, count]);
    }
    y += curveH + 8;
    if (!card.token) {
      const rarity = this.add.text(x, y, rarityLine(card), {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
        wordWrap: { width, useAdvancedWrap: true },
      });
      c.add(rarity);
      y += rarity.height + 8;
    }
    // Select at the foot; a Premium draft's print and ownership lines above it.
    const select: Rect = { x, y: sheet.y + sheet.height - pad - COMPACT.touch, width, height: COMPACT.touch };
    let bottom = select.y - 8;
    if (run?.premium) {
      const ownership = this.add.text(x, 0, premiumOwnershipLine(this.saveData, card.id, variant, {
        picks: run.draft?.picks[0] ?? [],
        pickVariants: run.draft?.pickVariants,
      }), { fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, color: theme.colors.muted, wordWrap: { width, useAdvancedWrap: true } });
      ownership.setY(bottom - ownership.height);
      const print = this.add.text(x, 0, premiumVariantLine(variant), {
        fontFamily: theme.fonts.ui, fontSize: `${type.caption}px`, fontStyle: theme.weight.w600,
        color: !variant || isPlainVariant(variant) ? theme.colors.body : theme.colors.gold, wordWrap: { width, useAdvancedWrap: true },
      });
      print.setY(ownership.y - 2 - print.height);
      c.add([print, ownership]);
      bottom = print.y - 8;
    }
    this.compactGlossary(c, card, { x, y, width, height: bottom - y });
    const id = this.currentPack()[packIndex];
    const button = compactButton(this, select, this.selectedCell === packIndex ? 'Selected' : 'Select', {
      icon: 'check',
      onTap: () => {
        if (id) this.selectCard(packIndex, id);
        shell.close();
      },
    });
    c.add(button.container);
    this.inspectSelect = button;
  }

  /** The card's terms as one box each (name over its reminder), as many as fit in `area`. */
  private compactGlossary(c: Phaser.GameObjects.Container, card: CardDef, area: Rect): void {
    const type = theme.compactType;
    const pad = 8;
    let y = area.y;
    for (const entry of cardGlossaryEntries(card)) {
      const room = area.y + area.height - y;
      const name = this.add.text(area.x + pad, y + pad, entry.name, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
      });
      const reminder = this.add.text(area.x + pad, name.y + name.height + 2, entry.reminder, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.body,
        wordWrap: { width: area.width - 2 * pad, useAdvancedWrap: true },
      });
      reminder.setData('a11yFullText', entry.reminder);
      // A reminder that does not fit is cut to the lines that do; a box without room for one line is left out.
      const lineH = reminder.height / Math.max(1, reminder.getWrappedText().length);
      const linesRoom = Math.floor((room - 2 * pad - name.height - 2) / lineH);
      if (linesRoom < 1) {
        name.destroy();
        reminder.destroy();
        break;
      }
      if (reminder.getWrappedText().length > linesRoom) reminder.setMaxLines(linesRoom);
      const h = name.height + 2 + reminder.height + 2 * pad;
      const box = this.add.graphics()
        .fillStyle(theme.graphics.rowFill, 0.9).fillRoundedRect(area.x, y, area.width, h, theme.radius.panel)
        .lineStyle(1, theme.graphics.panelStroke, 1).strokeRoundedRect(area.x, y, area.width, h, theme.radius.panel);
      c.add([box, name, reminder]);
      y += h + 6;
    }
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
      tier: personaRevealTier(this.saveData.limited, persona.id),
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
      // Overscan must cover the face-bias shift: (1.16-1)/2 = 0.08 per side >=
      // the 0.08*targetH upward shift, or the mask bottom shows bare panel
      // behind height-bound fits (all card art is 4:5).
      const image = addPortraitArt(this, x, y - targetH * 0.08, cardId, (art) => {
        art.setScale(Math.max(targetW / art.width, targetH / art.height) * 1.16);
      });
      if (!image) return;
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
    this.inspectSelect = null;
  }

  /**
   * On to the deck builder with what the grant did (the grant also stored it
   * on the save, so later visits read it back through `storedPremiumGrant`).
   * A free draft grants nothing (drafted 0) and the builder shows no note.
   */
  private openBuilder(grant: PremiumGrantSummary): void {
    const entry: LimitedBuilderEntry = grant.drafted > 0 ? { premiumGrant: grant } : {};
    this.scene.start('LimitedDeckBuilder', entry);
  }

  private confirmPick(run: LimitedRun): void {
    if (this.fixture) return;
    if (this.passing || !this.selectedId || !run.draft) return;
    const prevPackIndex = run.draft.packIndex;
    const updated: LimitedRun = {
      ...run,
      draft: pickDraftCard(CARD_DB, run.draft, this.selectedId, this.selectedCell),
    };
    let grant: PremiumGrantSummary | null = null;
    if (updated.draft?.completed) {
      // A finished draft (all 45 picks) is what teaches you the table —
      // familiarity advances exactly once per completed draft per persona.
      grant = premiumGrantSummary(grantPremiumDraftPool(this.saveData, CARD_DB, updated));
      recordDraftEncounters(this.saveData.limited, updated);
    }
    this.saveData.limited.activeRun = updated.draft?.completed
      ? completeDraftRun(CARD_DB, updated)
      : updated;
    this.persist();
    if (grant) {
      this.openBuilder(grant);
      return;
    }
    // Within a pack, sell the table illusion: every seat's pack visibly slides
    // one seat over before the next pick appears. Pack boundaries (fresh packs
    // are opened, nothing passes) and non-full animation settings skip it.
    const samePack = updated.draft!.packIndex === prevPackIndex;
    if (!samePack || this.saveData.settings.animations !== 'full') {
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
    const seats = this.compactSeats;
    const seatY = seats ? seats.y : 163;
    const pitch = seats ? seats.xs[1] - seats.xs[0] : SEAT_PITCH;
    const step = direction === 'left' ? -pitch : pitch;
    const cols = seats ? [...seats.xs] : Array.from({ length: 8 }, (_, col) => SEAT_FIRST_X + col * SEAT_PITCH);
    const token = seats ? { width: Math.round(seats.d * 0.62), height: Math.round(seats.d * 0.82) } : { width: 34, height: 44 };
    const duration = 380;
    const makeToken = (tx: number, alpha = 1): Phaser.GameObjects.Rectangle =>
      this.add
        .rectangle(tx, seatY, token.width, token.height, theme.graphics.rowFillActive, 0.96)
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
    const run = this.saveData.limited.activeRun;
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
    this.leavePrompt?.close();
    this.leavePrompt = null;
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
  const fullArt = variant.fullArt ? 'Full Art · ' : '';
  return `${fullArt}${frame} frame · ${holo} · yours when the draft completes`;
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
