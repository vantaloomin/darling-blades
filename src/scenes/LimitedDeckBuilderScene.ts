import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { CARD_DB } from '../data/catalog';
import type { CardDef } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import { isBasic } from '../meta/Collection';
import { LIMITED_DECK_SIZE, validateLimitedDeck } from '../meta/DeckStorage';
import {
  buildLimitedDeck,
  completeDraftRun,
  countCards,
  limitedDraftDuals,
  limitedDuelData,
  limitedLandReserve,
  type LimitedRun,
} from '../meta/Limited';
import { isDualLand, LAND_RESERVE_SIZE, MAX_DUAL_LANDS } from '../meta/warchest';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { CardView } from '../ui/CardView';
import { computeDeckStats, curveBars, deckShapeLine } from '../ui/deckStats';
import { LIMITED_DETAILS_PANEL } from '../ui/limitedPanePresentation';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { backButton, modalShell, pager, panel, registerSceneBackNavigation, themedButton, type ModalShell } from '../ui/themeWidgets';

const ROWS = 13;
/**
 * Spell out the whole Warchest, not just the duals.
 *
 * Basics are apportioned by the deck's pip demand, so the split is a real
 * decision the game is making for the player. Showing it beats "Basics fill
 * the Warchest automatically", which told them nothing and left the reserve
 * invisible until the duel began.
 */
function describeReserve(reserve: readonly string[], duals: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const id of reserve) counts.set(id, (counts.get(id) ?? 0) + 1);
  const dualSet = new Set(duals);
  const parts: string[] = [];
  for (const [id, count] of counts) {
    if (!dualSet.has(id)) continue;
    parts.push(count > 1 ? `${count}x ${def(CARD_DB, id).name}` : def(CARD_DB, id).name);
  }
  for (const [id, count] of counts) {
    if (dualSet.has(id)) continue;
    parts.push(`${count}x ${def(CARD_DB, id).name}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No lands in the Warchest yet';
}

export class LimitedDeckBuilderScene extends Phaser.Scene {
  private deck: string[] = [];
  private selectedDuals: string[] = [];
  private poolPage = 0;
  private deckPage = 0;
  private selectedId: string | null = null;
  private cardInspect: Phaser.GameObjects.Container | null = null;
  private leavePrompt: ModalShell | null = null;
  constructor() {
    super('LimitedDeckBuilder');
  }
  create(): void {
    this.cardInspect = null;
    this.leavePrompt = null;
    applyBackdrop(this, 'deckbuilder', {
      dim: theme.graphics.dim,
      dimAlpha: 0.6,
      fallback: (scene) => {
        const g = scene.add.graphics();
        g.fillGradientStyle(
          theme.graphics.panelFill,
          theme.graphics.panelFill,
          theme.graphics.dim,
          theme.graphics.dim,
          1,
        );
        g.fillRect(0, 0, 1280, 720);
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');
    const run = Services.save.data.limited.activeRun;
    if (!run) {
      this.scene.start('Limited');
      return;
    }
    backButton(this, 'Draft', () => this.leaveDraft());
    registerSceneBackNavigation(this, () => this.leaveDraft());
    this.deck = [...run.deck];
    this.selectedDuals = run.landReserve?.filter((id) => CARD_DB[id] && isDualLand(CARD_DB[id])) ?? [];
    this.draw(run);
  }
  private draw(run: LimitedRun): void {
    this.children.removeAll(true);
    applyBackdrop(this, 'deckbuilder', {
      dim: theme.graphics.dim,
      dimAlpha: 0.6,
      fallback: (scene) => {
        const g = scene.add.graphics();
        g.fillGradientStyle(
          theme.graphics.panelFill,
          theme.graphics.panelFill,
          theme.graphics.dim,
          theme.graphics.dim,
          1,
        );
        g.fillRect(0, 0, 1280, 720);
      },
    });
    this.add
      .text(640, 52, 'Limited Deck Builder', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(
        640,
        76,
        `Exactly ${LIMITED_DECK_SIZE} spells, no lands · Warchest provided · pool ${run.pool.length} · record ${run.wins}-${run.losses}`,
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.muted,
        },
      )
      .setOrigin(0.5);
    if (run.premium) {
      this.add
        .text(640, 99, 'Your 45 drafted cards were added to your collection.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.gold,
        })
        .setOrigin(0.5);
    }
    this.drawPool(run);
    this.drawDeck(run);
    this.drawInspector(run);
    this.drawActions(run);
  }
  private drawPool(run: LimitedRun): void {
    const x = 40;
    const y = 116;
    panel(this, x, y, 385, 500);
    this.heading(x + 18, y + 16, 'Pool');
    const poolCounts = countCards(run.pool);
    const deckCounts = countCards(this.deck);
    const reserveCounts = countCards(this.selectedDuals);
    const ids = [...poolCounts.keys()].filter((id) => !isBasic(CARD_DB, id)).sort(sortCards);
    const maxPage = Math.max(0, Math.ceil(ids.length / ROWS) - 1);
    this.poolPage = Math.min(this.poolPage, maxPage);
    ids.slice(this.poolPage * ROWS, this.poolPage * ROWS + ROWS).forEach((id, i) => {
      const owned = poolCounts.get(id) ?? 0;
      const used = deckCounts.get(id) ?? 0;
      const dual = isDualLand(CARD_DB[id]);
      const reserveUsed = reserveCounts.get(id) ?? 0;
      this.cardRow(
        x + 18,
        y + 56 + i * 31,
        `${dual ? reserveUsed : used}/${owned} ${cardLine(id)}`,
        id,
        dual && reserveUsed > 0 ? '−' : '+',
        dual ? reserveUsed > 0 || this.selectedDuals.length < MAX_DUAL_LANDS : !isType(CARD_DB[id], 'land') && used < owned,
        () => {
          if (dual) {
            if (reserveUsed > 0) {
              this.removeOne(id, this.selectedDuals);
              this.persistAndRedraw(run);
            } else if (this.selectedDuals.length < MAX_DUAL_LANDS) {
              this.selectedDuals.push(id);
              this.persistAndRedraw(run);
            }
          } else if (this.deck.length < LIMITED_DECK_SIZE && used < owned) {
            this.deck.push(id);
            this.selectedId = id;
            this.persistAndRedraw(run);
          }
        },
      );
    });
    pager(this, x + 18, y + 477, this.poolPage, maxPage + 1, (page) => {
      this.poolPage = page;
      this.draw(run);
    });
  }
  private drawDeck(run: LimitedRun): void {
    const x = 448;
    const y = 116;
    panel(this, x, y, 385, 500);
    this.heading(
      x + 18,
      y + 16,
      `Deck ${this.deck.length}/${LIMITED_DECK_SIZE}`,
      this.deck.length === LIMITED_DECK_SIZE ? theme.colors.gold : theme.colors.danger,
    );
    const counts = countCards(this.deck);
    const ids = [...counts.keys()].sort(sortCards);
    const maxPage = Math.max(0, Math.ceil(ids.length / ROWS) - 1);
    this.deckPage = Math.min(this.deckPage, maxPage);
    ids.slice(this.deckPage * ROWS, this.deckPage * ROWS + ROWS).forEach((id, i) =>
      this.cardRow(
        x + 18,
        y + 56 + i * 31,
        `${counts.get(id) ?? 0}x ${cardLine(id)}`,
        id,
        '−',
        true,
        () => {
          this.removeOne(id);
          this.selectedId = id;
          this.persistAndRedraw(run);
        },
      ),
    );
    pager(this, x + 18, y + 477, this.deckPage, maxPage + 1, (page) => {
      this.deckPage = page;
      this.draw(run);
    });
  }
  private drawInspector(run: LimitedRun): void {
    const L = LIMITED_DETAILS_PANEL;
    const issues = validateLimitedDeck(CARD_DB, run.pool, this.deck);
    const errors = issues.filter((issue) => issue.kind === 'error');
    const reserve = limitedLandReserve(CARD_DB, this.deck, run.pool, this.selectedDuals);
    const reserveDuals = reserve.filter((id) => isDualLand(CARD_DB[id]));
    panel(this, L.x, L.y, L.width, L.height);
    this.heading(
      L.contentX,
      L.headingY,
      'Details',
      errors.length ? theme.colors.danger : theme.colors.gold,
    );
    this.drawCurve();
    this.text(
      L.contentX,
      L.warchestY,
      `Warchest ${reserve.length}/${LAND_RESERVE_SIZE} · ${reserveDuals.length}/${MAX_DUAL_LANDS} duals`,
      theme.type.label,
      theme.colors.gold,
    );
    this.text(
      L.contentX,
      L.dualsY,
      describeReserve(reserve, reserveDuals),
      theme.type.caption,
      theme.colors.muted,
    );
    if (this.selectedId) {
      const card = def(CARD_DB, this.selectedId);
      this.add.text(L.contentX, L.selected.nameY, card.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.heading,
        wordWrap: { width: L.wrapWidth },
      });
      this.text(L.contentX, L.selected.detailY, detailLine(card), theme.type.label, theme.colors.muted);
      this.add
        .text(L.contentX, L.selected.flavorY, card.flavor ?? '', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          fontStyle: 'italic',
          color: theme.colors.muted,
          wordWrap: { width: L.wrapWidth },
        })
        .setMaxLines(L.selected.flavorMaxLines);
    }
    this.add.text(
      L.contentX,
      L.issuesY,
      issues.length
        ? issues.map((issue) => `${issue.kind}: ${issue.message}`).join('\n')
        : 'Deck is legal.',
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: errors.length ? theme.colors.danger : theme.colors.success,
        wordWrap: { width: 340 },
        lineSpacing: 4,
      },
    );
  }

  /**
   * The mana curve, the one chart a draft deck is actually built by: the pool
   * is fixed, so the curve and the colour split ARE the deck decisions. The
   * panel had neither until 2026-08-25.
   */
  private drawCurve(): void {
    const L = LIMITED_DETAILS_PANEL;
    const stats = computeDeckStats(this.deck, CARD_DB);
    this.text(L.contentX, L.curve.headingY, 'Mana curve', theme.type.label, theme.colors.gold);
    for (const bar of curveBars(stats.curve, {
      firstX: L.curve.firstX,
      pitch: L.curve.pitch,
      maxHeight: L.curve.maxHeight,
    })) {
      this.add
        .rectangle(
          bar.x,
          L.curve.baseY,
          L.curve.barWidth,
          bar.height,
          bar.count > 0 ? colorInt(theme.colors.gold) : theme.graphics.rowFill,
        )
        .setOrigin(0.5, 1);
      if (bar.count > 0) {
        this.add
          .text(bar.x, L.curve.baseY - bar.height - L.curve.countGap, `${bar.count}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.type.micro}px`,
            color: theme.colors.body,
          })
          .setOrigin(0.5);
      }
      this.add
        .text(bar.x, L.curve.baseY + L.curve.axisGap, bar.label, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5);
    }
    // Reserve-native Limited holds no lands in the deck list, so the shape line
    // names the granted Warchest instead of a land count that reads zero
    // forever.
    this.text(
      L.contentX,
      L.shapeLineY,
      `${deckShapeLine(stats, { lands: false })}   Warchest provided`,
      theme.type.caption,
      theme.colors.body,
    );
  }
  private drawActions(run: LimitedRun): void {
    Object.values(CARD_DB)
      .filter((card) => isBasic(CARD_DB, card.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((card, i) =>
        themedButton(this, 110 + i * 130, 642, `+ ${card.name}`, {
          variant: 'ghost',
          size: 'sm',
          minWidth: 118,
          onTap: () => {
            if (this.deck.length < LIMITED_DECK_SIZE) {
              this.deck.push(card.id);
              this.selectedId = card.id;
              this.persistAndRedraw(run);
            }
          },
        }),
      );
    themedButton(this, 760, 642, 'Auto Build', {
      variant: 'ghost',
      minWidth: 120,
      onTap: () => {
        this.deck = buildLimitedDeck(CARD_DB, run.pool);
        this.selectedDuals = limitedDraftDuals(CARD_DB, run.pool).slice(0, MAX_DUAL_LANDS);
        this.selectedId = this.deck[0] ?? null;
        this.persistAndRedraw(run);
      },
    });
    themedButton(this, 760, 680, 'Clear Warchest', {
      variant: 'ghost',
      minWidth: 120,
      onTap: () => {
        this.selectedDuals = [];
        this.persistAndRedraw(run);
      },
    });
    themedButton(this, 900, 642, 'Clear', {
      variant: 'ghost',
      minWidth: 100,
      onTap: () => {
        this.deck = [];
    this.persistAndRedraw(run);
      },
    });
    themedButton(this, 1050, 642, 'Start Match', {
      variant: 'primary',
      minWidth: 140,
      onTap: () => this.startMatch(run),
    });
  }

  private leaveDraft(): void {
    const run = Services.save.data.limited.activeRun;
    if (!run) {
      this.scene.start('Limited');
      return;
    }
    if (this.leavePrompt) return;
    const shell = modalShell(this, {
      width: 620,
      height: 250,
      dimAlpha: 0.84,
      dismissal: 'dismissible',
      onClose: () => {
        if (this.leavePrompt === shell) this.leavePrompt = null;
      },
    });
    this.leavePrompt = shell;
    const c = shell.container;
    c.add(this.add.text(640, 260, 'Leave Draft?', {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h1}px`,
      color: theme.colors.heading,
    }).setOrigin(0.5));
    c.add(this.add.text(640, 312, 'Your draft run is saved and can be resumed from the Draft hub. Leave now?', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.body}px`,
      color: theme.colors.body,
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5));
    const stay = themedButton(this, 460, 398, 'Keep Building', {
      variant: 'ghost',
      minWidth: 160,
      onTap: shell.close,
    });
    const leave = themedButton(this, 820, 398, 'Leave Draft', {
      variant: 'primary',
      minWidth: 160,
      onTap: () => {
        shell.close();
        this.scene.start('Limited');
      },
    });
    c.add([stay.container, leave.container]);
  }
  private cardRow(
    x: number,
    y: number,
    label: string,
    id: string,
    actionLabel: '+' | '−',
    enabled: boolean,
    onAction: () => void,
  ): void {
    const row = this.add
      .text(x, y, short(label, 39), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.heading,
        backgroundColor: theme.colors.rowFill,
        padding: { x: 8, y: 5 },
      })
      .setFixedSize(296, 25)
      .setInteractive({ useHandCursor: true });
    row.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) {
        row.setColor(theme.colors.gold);
        inflateHitArea(row, 250, 31);
      }
    });
    row.on('pointerout', () => {
      row.setColor(theme.colors.heading);
      inflateHitArea(row, 250, 31);
    });
    bindTapButton(this, row, () => {
      this.selectedId = id;
      this.showCardInspect(id);
    });
    inflateHitArea(row, 250, 31);
    const action = themedButton(this, x + 326, y + 12, actionLabel, {
      variant: actionLabel === '+' ? 'emphasis' : 'danger',
      size: 'sm',
      minWidth: 39,
      enabled,
      onTap: onAction,
    });
    void action;
  }
  private showCardInspect(id: string): void {
    this.closeCardInspect();
    const card = def(CARD_DB, id);
    const shell = modalShell(this, {
      width: 940,
      height: 560,
      dimAlpha: 0.52,
      depth: theme.depth.inspect,
      dismissal: 'esc-and-dim',
      onClose: () => {
        this.cardInspect = null;
      },
    });
    const c = shell.container;
    c.add(new CardView(this, 455, 360).setScale(1.35).setCard(card, { fx: 'full' }));
    c.add(
      this.add.text(730, 154, card.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(730, 218, detailLine(card), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.heading,
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(730, 274, card.flavor ?? '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: 'italic',
        color: theme.colors.muted,
        wordWrap: { width: 380 },
        lineSpacing: 5,
      }),
    );
    c.add(
      this.add
        .text(640, 682, 'Click anywhere to close', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          color: theme.colors.muted,
        })
        .setOrigin(0.5),
    );
    this.cardInspect = c;
  }
  private closeCardInspect(): void {
    this.cardInspect?.destroy();
    this.cardInspect = null;
  }
  private startMatch(run: LimitedRun): void {
    if (validateLimitedDeck(CARD_DB, run.pool, this.deck).some((issue) => issue.kind === 'error'))
      return;
    const updated = completeDraftRun(CARD_DB, run);
    updated.deck = [...this.deck];
    updated.landReserve = limitedLandReserve(CARD_DB, updated.deck, updated.pool, this.selectedDuals);
    updated.status = 'matches';
    Services.save.data.limited.activeRun = updated;
    Services.save.flush();
    this.scene.start('Duel', limitedDuelData(updated));
  }
  private persistAndRedraw(run: LimitedRun): void {
    run.deck = [...this.deck];
    run.landReserve = limitedLandReserve(CARD_DB, this.deck, run.pool, this.selectedDuals);
    Services.save.data.limited.activeRun = run;
    Services.save.flush();
    this.draw(run);
  }
  private removeOne(id: string, from: string[] = this.deck): void {
    const index = from.indexOf(id);
    if (index >= 0) from.splice(index, 1);
  }
  private heading(x: number, y: number, label: string, color: string = theme.colors.gold): void {
    this.add.text(x, y, label, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h2}px`,
      color,
    });
  }
  private text(x: number, y: number, label: string, size: number, color: string): void {
    this.add.text(x, y, label, { fontFamily: theme.fonts.ui, fontSize: `${size}px`, color });
  }
}
function sortCards(a: string, b: string): number {
  const da = def(CARD_DB, a);
  const db = def(CARD_DB, b);
  const ta = isType(da, 'land') ? 2 : isType(da, 'creature') ? 0 : 1;
  const tb = isType(db, 'land') ? 2 : isType(db, 'creature') ? 0 : 1;
  return ta - tb || manaValue(da.cost) - manaValue(db.cost) || da.name.localeCompare(db.name);
}
function cardLine(id: string): string {
  const card = def(CARD_DB, id);
  // Duals are playable in the Warchest. Any retired utility land remains in
  // the pool and collection, but cannot be assigned to the spell deck.
  if (isType(card, 'land')) return `${isDualLand(card) ? 'W' : '-'} ${short(card.name, 22)}${isDualLand(card) ? ' (Warchest)' : ' (kept)'}`;
  return `MV${manaValue(card.cost)} ${short(card.name, 25)}`;
}
function detailLine(card: CardDef): string {
  return `${card.rarity.toUpperCase()} · ${card.types.join(' ')} · MV ${manaValue(card.cost)}${isType(card, 'creature') ? ` · ${card.attack}/${card.defense}` : ''}`;
}
function short(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 3))}...`;
}
