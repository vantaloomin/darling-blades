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
      dim: 0x0b0812,
      dimAlpha: 0.62,
      fallback: (scene) => {
        const g = scene.add.graphics();
        g.fillGradientStyle(0x1c1230, 0x1c1230, 0x0b0812, 0x0b0812, 1);
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
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '44px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);
    this.add
      .text(
        width / 2,
        82,
        `Pack ${run.draft.packIndex + 1}/3 - Pick ${run.draft.pickIndex + 1}/${pack.length + run.draft.pickIndex} - passing ${draftDirection(run.draft.packIndex)}`,
        {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '16px',
          color: '#a89cc6',
        },
      )
      .setOrigin(0.5);

    this.add.text(70, 116, 'Current Pack', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '24px',
      color: '#ffd88a',
    });
    pack.forEach((id, i) => this.cardButton(70 + (i % 3) * 250, 154 + Math.floor(i / 3) * 44, id));

    this.drawPicked(run);
    this.drawDetail(run);

    this.button(1015, 626, 'Pick Selected', true, () => this.confirmPick(run));
    this.button(1160, 626, 'Hub', false, () => this.scene.start('Limited'));
  }

  private cardButton(x: number, y: number, id: string): void {
    const card = def(CARD_DB, id);
    const label = `${card.rarity.toUpperCase()} ${short(card.name, 22)}`;
    const btn = this.add
      .text(x, y, label, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        fontStyle: '700',
        color: '#f0e6ff',
        backgroundColor: '#241d3a',
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
    const g = this.add.graphics();
    g.fillStyle(0x130f22, 0.88);
    g.lineStyle(1, 0x4e4266, 0.9);
    g.fillRoundedRect(x, y, 730, 210, 8);
    g.strokeRoundedRect(x, y, 730, 210, 8);
    this.add.text(x + 18, y + 16, `Your Picks (${run.draft?.picks[0].length ?? 0})`, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '22px',
      color: '#f0e6ff',
    });
    const picks = [...(run.draft?.picks[0] ?? [])].reverse().slice(0, 18);
    picks.forEach((id, i) => {
      const card = def(CARD_DB, id);
      this.add.text(x + 18 + (i % 3) * 230, y + 54 + Math.floor(i / 3) * 24, `${card.rarity.toUpperCase()} ${short(card.name, 20)}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#a89cc6',
      });
    });
  }

  private drawDetail(run: LimitedRun): void {
    this.detail?.destroy();
    const x = 840;
    const y = 140;
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x130f22, 0.9);
    g.lineStyle(1, 0x4e4266, 0.9);
    g.fillRoundedRect(x, y, 370, 450, 8);
    g.strokeRoundedRect(x, y, 370, 450, 8);
    c.add(g);

    if (!this.selectedId) {
      c.add(
        this.add.text(x + 22, y + 24, 'Select a card from the pack.', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '17px',
          color: '#a89cc6',
        }),
      );
      this.detail = c;
      return;
    }

    const card = def(CARD_DB, this.selectedId);
    c.add(this.add.text(x + 22, y + 22, card.name, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '24px',
      color: '#ffd88a',
      wordWrap: { width: 326 },
    }));
    c.add(this.add.text(x + 22, y + 82, detailLine(this.selectedId), {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '15px',
      color: '#f0e6ff',
      wordWrap: { width: 326 },
    }));
    c.add(this.add.text(x + 22, y + 122, card.keywords?.join(', ') || 'No keyword abilities', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '14px',
      color: '#a89cc6',
      wordWrap: { width: 326 },
    }));
    c.add(this.add.text(x + 22, y + 168, card.flavor ?? '', {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'italic',
      color: '#8f83a8',
      wordWrap: { width: 326 },
    }));
    c.add(this.add.text(x + 22, y + 360, `Seat 1 pool: ${run.draft?.picks[0].length ?? 0} cards`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '14px',
      color: '#c9bde0',
    }));
    this.detail = c;
  }

  private confirmPick(run: LimitedRun): void {
    if (!this.selectedId || !run.draft) return;
    const updated: LimitedRun = { ...run, draft: pickDraftCard(CARD_DB, run.draft, this.selectedId) };
    Services.save.data.limited.activeRun = updated.draft?.completed ? completeDraftRun(CARD_DB, updated) : updated;
    Services.save.flush();
    this.scene.start(updated.draft?.completed ? 'LimitedDeckBuilder' : 'LimitedDraft');
  }

  private button(x: number, y: number, label: string, primary: boolean, cb: () => void): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: primary ? '#ffd88a' : '#c9bde0',
        backgroundColor: primary ? '#2c2344' : '#241d3a',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, btn, cb);
    inflateHitArea(btn, 90, 80);
    return btn;
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
