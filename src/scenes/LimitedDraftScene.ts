import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { CARD_DB } from '../data/catalog';
import { def, isType, manaValue } from '../engine/types';
import {
  completeDraftRun,
  currentDraftPack,
  draftDirection,
  pickDraftCard,
  type LimitedRun,
} from '../meta/Limited';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { theme } from '../ui/theme';
import { panel, themedButton } from '../ui/themeWidgets';

export class LimitedDraftScene extends Phaser.Scene {
  private selectedId: string | null = null;
  private detail: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('LimitedDraft');
  }

  create(): void {
    this.selectedId = null;
    this.detail = null;
    const width = 1280;
    const height = 720;
    applyBackdrop(this, 'packopening', {
      dim: theme.graphics.dim,
      dimAlpha: 0.62,
      fallback: (scene) => {
        const g = scene.add.graphics();
        g.fillGradientStyle(
          theme.graphics.panelFill,
          theme.graphics.panelFill,
          theme.graphics.dim,
          theme.graphics.dim,
          1,
        );
        g.fillRect(0, 0, width, height);
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
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
    this.add
      .text(width / 2, 46, 'Bot Draft', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(
        width / 2,
        82,
        `Pack ${run.draft.packIndex + 1}/3 - Pick ${run.draft.pickIndex + 1}/${pack.length + run.draft.pickIndex} - passing ${draftDirection(run.draft.packIndex)}`,
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.muted,
        },
      )
      .setOrigin(0.5);

    this.add.text(70, 116, 'Current Pack', {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h2}px`,
      color: theme.colors.gold,
    });
    pack.forEach((id, i) => this.cardButton(70 + (i % 3) * 250, 154 + Math.floor(i / 3) * 44, id));

    this.drawPicked(run);
    this.drawDetail(run);

    themedButton(this, 1015, 626, 'Pick Selected', {
      variant: 'primary',
      minWidth: 180,
      onTap: () => this.confirmPick(run),
    });
    themedButton(this, 1160, 626, 'Hub', {
      variant: 'ghost',
      minWidth: 100,
      onTap: () => this.scene.start('Limited'),
    });
  }

  private cardButton(x: number, y: number, id: string): void {
    const card = def(CARD_DB, id);
    const label = `${card.rarity.toUpperCase()} ${short(card.name, 22)}`;
    const btn = this.add
      .text(x, y, label, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: '700',
        color: theme.colors.heading,
        backgroundColor: theme.colors.btnGhostBg,
        padding: { x: 10, y: 7 },
      })
      .setFixedSize(225, 34)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, btn, () => {
      this.selectedId = id;
      this.drawDetail(Services.save.data.limited.activeRun!);
    });
    inflateHitArea(btn, 90, 44);
  }

  private drawPicked(run: LimitedRun): void {
    const x = 70;
    const y = 410;
    panel(this, x, y, 730, 210);
    this.add.text(x + 18, y + 16, `Your Picks (${run.draft?.picks[0].length ?? 0})`, {
      fontFamily: theme.fonts.display,
      fontSize: `${theme.type.h2}px`,
      color: theme.colors.heading,
    });
    const picks = [...(run.draft?.picks[0] ?? [])].reverse().slice(0, 18);
    picks.forEach((id, i) => {
      const card = def(CARD_DB, id);
      this.add.text(
        x + 18 + (i % 3) * 230,
        y + 54 + Math.floor(i / 3) * 24,
        `${card.rarity.toUpperCase()} ${short(card.name, 20)}`,
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        },
      );
    });
  }

  private drawDetail(run: LimitedRun): void {
    this.detail?.destroy();
    const x = 840;
    const y = 140;
    const c = this.add.container(0, 0);
    c.add(panel(this, x, y, 370, 450));

    if (!this.selectedId) {
      c.add(
        this.add.text(x + 22, y + 24, 'Select a card from the pack.', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.muted,
        }),
      );
      this.detail = c;
      return;
    }

    const card = def(CARD_DB, this.selectedId);
    c.add(
      this.add.text(x + 22, y + 22, card.name, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
        wordWrap: { width: 326 },
      }),
    );
    c.add(
      this.add.text(x + 22, y + 82, detailLine(this.selectedId), {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.heading,
        wordWrap: { width: 326 },
      }),
    );
    c.add(
      this.add.text(x + 22, y + 122, card.keywords?.join(', ') || 'No keyword abilities', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.muted,
        wordWrap: { width: 326 },
      }),
    );
    c.add(
      this.add.text(x + 22, y + 168, card.flavor ?? '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: 'italic',
        color: theme.colors.muted,
        wordWrap: { width: 326 },
      }),
    );
    c.add(
      this.add.text(x + 22, y + 360, `Seat 1 pool: ${run.draft?.picks[0].length ?? 0} cards`, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        color: theme.colors.body,
      }),
    );
    this.detail = c;
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
}

function detailLine(id: string): string {
  const card = def(CARD_DB, id);
  const type = card.types.join(' ');
  const stats = isType(card, 'creature') ? ` ${card.attack}/${card.defense}` : '';
  return `${card.rarity.toUpperCase()} - ${type} - MV ${manaValue(card.cost)}${stats}`;
}

function short(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}...`;
}
