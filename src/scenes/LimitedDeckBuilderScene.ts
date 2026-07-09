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
  limitedDuelData,
  type LimitedRun,
} from '../meta/Limited';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { CardView } from '../ui/CardView';
import { applyBackdrop } from '../ui/SceneBackdrop';

const ROWS = 13;

export class LimitedDeckBuilderScene extends Phaser.Scene {
  private deck: string[] = [];
  private poolPage = 0;
  private deckPage = 0;
  private selectedId: string | null = null;
  private cardInspect: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('LimitedDeckBuilder');
  }

  create(): void {
    this.poolPage = 0;
    this.deckPage = 0;
    this.cardInspect = null;
    const width = 1280;
    const height = 720;
    applyBackdrop(this, 'deckbuilder', {
      dim: 0x0b0812,
      dimAlpha: 0.58,
      fallback: (scene) => {
        const g = scene.add.graphics();
        g.fillGradientStyle(0x171222, 0x171222, 0x0b0812, 0x0b0812, 1);
        g.fillRect(0, 0, width, height);
      },
    });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    let run = Services.save.data.limited.activeRun;
    if (!run) {
      this.scene.start('Limited');
      return;
    }
    if (run.mode === 'draft' && run.status === 'draft' && run.draft?.completed) {
      run = completeDraftRun(CARD_DB, run);
      Services.save.data.limited.activeRun = run;
    }
    if (run.status === 'draft') {
      this.scene.start('LimitedDraft');
      return;
    }
    if (run.deck.length === 0) {
      run.deck = buildLimitedDeck(CARD_DB, run.pool);
      Services.save.flush();
    }
    this.deck = [...run.deck];
    this.selectedId = this.deck[0] ?? run.pool[0] ?? null;

    this.draw(run);
  }

  private draw(run: LimitedRun): void {
    this.children.removeAll(true);
    this.cardInspect = null;
    applyBackdrop(this, 'deckbuilder', {
      dim: 0x0b0812,
      dimAlpha: 0.58,
      fallback: (scene) => {
        const g = scene.add.graphics();
        g.fillGradientStyle(0x171222, 0x171222, 0x0b0812, 0x0b0812, 1);
        g.fillRect(0, 0, 1280, 720);
      },
    });

    this.add
      .text(640, 42, `${run.mode === 'sealed' ? 'Sealed' : 'Draft'} Deck`, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '40px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);
    this.add
      .text(640, 76, `Exactly ${LIMITED_DECK_SIZE} cards - pool ${run.pool.length} - record ${run.wins}-${run.losses}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        color: '#a89cc6',
      })
      .setOrigin(0.5);

    this.drawPool(run);
    this.drawDeck(run);
    this.drawInspector(run);
    this.drawActions(run);
  }

  private drawPool(run: LimitedRun): void {
    const x = 40;
    const y = 116;
    this.panel(x, y, 385, 500);
    this.add.text(x + 18, y + 16, 'Pool', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '24px',
      color: '#ffd88a',
    });

    const poolCounts = countCards(run.pool);
    const deckCounts = countCards(this.deck);
    const ids = [...poolCounts.keys()]
      .filter((id) => !isBasic(CARD_DB, id))
      .sort((a, b) => sortCards(a, b));
    const maxPage = Math.max(0, Math.ceil(ids.length / ROWS) - 1);
    this.poolPage = Math.min(this.poolPage, maxPage);
    ids.slice(this.poolPage * ROWS, this.poolPage * ROWS + ROWS).forEach((id, i) => {
      const owned = poolCounts.get(id) ?? 0;
      const used = deckCounts.get(id) ?? 0;
      this.cardRow(x + 18, y + 56 + i * 31, `${used}/${owned} ${cardLine(id)}`, id, '+', used < owned, () => {
        if (this.deck.length >= LIMITED_DECK_SIZE || used >= owned) return;
        this.deck.push(id);
        this.selectedId = id;
        this.persistAndRedraw(run);
      });
    });
    this.pager(x + 18, y + 466, this.poolPage, maxPage, (delta) => {
      this.poolPage = Math.max(0, Math.min(maxPage, this.poolPage + delta));
      this.draw(run);
    });
  }

  private drawDeck(run: LimitedRun): void {
    const x = 448;
    const y = 116;
    this.panel(x, y, 385, 500);
    this.add.text(x + 18, y + 16, `Deck ${this.deck.length}/${LIMITED_DECK_SIZE}`, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '24px',
      color: this.deck.length === LIMITED_DECK_SIZE ? '#ffd88a' : '#f0b0b0',
    });

    const deckCounts = countCards(this.deck);
    const ids = [...deckCounts.keys()].sort((a, b) => sortCards(a, b));
    const maxPage = Math.max(0, Math.ceil(ids.length / ROWS) - 1);
    this.deckPage = Math.min(this.deckPage, maxPage);
    ids.slice(this.deckPage * ROWS, this.deckPage * ROWS + ROWS).forEach((id, i) => {
      const n = deckCounts.get(id) ?? 0;
      this.cardRow(x + 18, y + 56 + i * 31, `${n}x ${cardLine(id)}`, id, '-', true, () => {
        this.removeOne(id);
        this.selectedId = id;
        this.persistAndRedraw(run);
      });
    });
    this.pager(x + 18, y + 466, this.deckPage, maxPage, (delta) => {
      this.deckPage = Math.max(0, Math.min(maxPage, this.deckPage + delta));
      this.draw(run);
    });
  }

  private drawInspector(run: LimitedRun): void {
    const x = 858;
    const y = 116;
    this.panel(x, y, 382, 500);
    const issues = validateLimitedDeck(CARD_DB, run.pool, this.deck);
    const errors = issues.filter((i) => i.kind === 'error');
    this.add.text(x + 18, y + 16, 'Details', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '24px',
      color: errors.length === 0 ? '#ffd88a' : '#f0b0b0',
    });
    this.add.text(x + 18, y + 52, deckSummary(this.deck), {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '14px',
      color: '#c9bde0',
    });

    if (this.selectedId) {
      const card = def(CARD_DB, this.selectedId);
      this.add.text(x + 18, y + 92, card.name, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '22px',
        color: '#f0e6ff',
        wordWrap: { width: 330 },
      });
      this.add.text(x + 18, y + 148, detailLine(card), {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        color: '#a89cc6',
        wordWrap: { width: 330 },
      });
      this.add.text(x + 18, y + 206, card.flavor ?? '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'italic',
        color: '#8f83a8',
        wordWrap: { width: 330 },
      });
    }

    const issueText = issues.length === 0 ? 'Deck is legal.' : issues.map((i) => `${i.kind}: ${i.message}`).join('\n');
    this.add.text(x + 18, y + 348, issueText, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      color: errors.length === 0 ? '#9be6a8' : '#f0b0b0',
      wordWrap: { width: 340 },
      lineSpacing: 4,
    });
  }

  private drawActions(run: LimitedRun): void {
    const basics = Object.values(CARD_DB)
      .filter((card) => isBasic(CARD_DB, card.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    basics.forEach((card, i) => {
      this.button(64 + i * 126, 642, `+ ${card.name}`, false, () => {
        if (this.deck.length >= LIMITED_DECK_SIZE) return;
        this.deck.push(card.id);
        this.selectedId = card.id;
        this.persistAndRedraw(run);
      });
    });
    this.button(730, 642, 'Auto Build', false, () => {
      this.deck = buildLimitedDeck(CARD_DB, run.pool);
      this.selectedId = this.deck[0] ?? null;
      this.persistAndRedraw(run);
    });
    this.button(870, 642, 'Clear', false, () => {
      this.deck = [];
      this.persistAndRedraw(run);
    });
    this.button(1000, 642, 'Start Match', true, () => this.startMatch(run));
    this.button(1160, 642, 'Hub', false, () => this.scene.start('Limited'));
  }

  private startMatch(run: LimitedRun): void {
    const errors = validateLimitedDeck(CARD_DB, run.pool, this.deck).filter((i) => i.kind === 'error');
    if (errors.length > 0) return;
    const save = Services.save.data;
    const updated = run.mode === 'draft' ? completeDraftRun(CARD_DB, run) : run;
    updated.deck = [...this.deck];
    updated.status = 'matches';
    save.limited.activeRun = updated;
    Services.save.flush();
    this.scene.start('Duel', limitedDuelData(updated));
  }

  private persistAndRedraw(run: LimitedRun): void {
    run.deck = [...this.deck];
    Services.save.data.limited.activeRun = run;
    Services.save.flush();
    this.draw(run);
  }

  private removeOne(id: string): void {
    const i = this.deck.indexOf(id);
    if (i >= 0) this.deck.splice(i, 1);
  }

  private panel(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x130f22, 0.9);
    g.lineStyle(1, 0x4e4266, 0.9);
    g.fillRoundedRect(x, y, w, h, 8);
    g.strokeRoundedRect(x, y, w, h, 8);
  }

  private cardRow(
    x: number,
    y: number,
    label: string,
    id: string,
    actionLabel: '+' | '-',
    actionEnabled: boolean,
    onAction: () => void,
  ): void {
    const row = this.add
      .text(x, y, short(label, 39), {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#f0e6ff',
        backgroundColor: '#241d3a',
        padding: { x: 8, y: 5 },
      })
      .setFixedSize(296, 25)
      .setInteractive({ useHandCursor: true });
    row.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) row.setColor('#ffd88a');
    });
    row.on('pointerout', () => row.setColor('#f0e6ff'));
    bindTapButton(this, row, () => {
      this.selectedId = id;
      this.showCardInspect(id);
    });
    inflateHitArea(row, 250, 31);

    const action = this.add
      .text(x + 306, y, actionLabel, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        fontStyle: '700',
        color: actionEnabled ? (actionLabel === '+' ? '#9be6a8' : '#f0b0a0') : '#6d6288',
        backgroundColor: actionEnabled ? '#241d3a' : '#171320',
        padding: { x: 8, y: 4 },
      })
      .setFixedSize(39, 25);
    if (actionEnabled) {
      action.setInteractive({ useHandCursor: true });
      bindTapButton(this, action, onAction);
      inflateHitArea(action, 52, 31);
    }
  }

  private showCardInspect(id: string): void {
    this.closeCardInspect();
    const card = def(CARD_DB, id);
    const c = this.add.container(0, 0).setDepth(120);
    const dim = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.82).setInteractive();
    bindTapButton(this, dim, () => this.closeCardInspect());
    c.add(dim);

    const view = new CardView(this, 455, 360).setScale(1.35).setCard(card, { fx: 'full' });
    c.add(view);
    c.add(
      this.add.text(730, 154, card.name, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '28px',
        color: '#ffd88a',
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(730, 218, detailLine(card), {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '16px',
        color: '#f0e6ff',
        wordWrap: { width: 380 },
      }),
    );
    c.add(
      this.add.text(730, 274, card.flavor ?? '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'italic',
        color: '#a89cc6',
        wordWrap: { width: 380 },
        lineSpacing: 5,
      }),
    );
    c.add(
      this.add
        .text(640, 682, 'Click anywhere to close', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '14px',
          color: '#8f83a8',
        })
        .setOrigin(0.5),
    );
    this.cardInspect = c;
  }

  private closeCardInspect(): void {
    this.cardInspect?.destroy();
    this.cardInspect = null;
  }

  private pager(x: number, y: number, page: number, maxPage: number, cb: (delta: number) => void): void {
    this.button(x, y, 'Prev', false, () => cb(-1), page <= 0);
    this.add.text(x + 80, y + 10, `${page + 1}/${maxPage + 1}`, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      color: '#a89cc6',
    });
    this.button(x + 140, y, 'Next', false, () => cb(1), page >= maxPage);
  }

  private button(
    x: number,
    y: number,
    label: string,
    primary: boolean,
    cb: () => void,
    disabled = false,
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: primary ? 'Cinzel, Georgia, serif' : 'Inter, Arial, sans-serif',
        fontSize: primary ? '21px' : '14px',
        color: disabled ? '#6d6288' : primary ? '#ffd88a' : '#c9bde0',
        backgroundColor: disabled ? '#1b1726' : primary ? '#2c2344' : '#241d3a',
        padding: { x: primary ? 16 : 10, y: primary ? 10 : 7 },
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: !disabled });
    if (!disabled) bindTapButton(this, btn, cb);
    inflateHitArea(btn, 90, 54);
    return btn;
  }
}

function sortCards(a: string, b: string): number {
  const da = def(CARD_DB, a);
  const db = def(CARD_DB, b);
  const typeA = isType(da, 'land') ? 2 : isType(da, 'creature') ? 0 : 1;
  const typeB = isType(db, 'land') ? 2 : isType(db, 'creature') ? 0 : 1;
  return typeA - typeB || manaValue(da.cost) - manaValue(db.cost) || da.name.localeCompare(db.name);
}

function cardLine(id: string): string {
  const card = def(CARD_DB, id);
  const mv = isType(card, 'land') ? 'L' : `MV${manaValue(card.cost)}`;
  return `${mv} ${short(card.name, 25)}`;
}

function detailLine(card: CardDef): string {
  const type = card.types.join(' ');
  const stats = isType(card, 'creature') ? ` - ${card.attack}/${card.defense}` : '';
  return `${card.rarity.toUpperCase()} - ${type} - MV ${manaValue(card.cost)}${stats}`;
}

function deckSummary(deck: readonly string[]): string {
  let lands = 0;
  let creatures = 0;
  let spells = 0;
  for (const id of deck) {
    const card = def(CARD_DB, id);
    if (isType(card, 'land')) lands++;
    else if (isType(card, 'creature')) creatures++;
    else spells++;
  }
  return `${lands} lands   ${creatures} creatures   ${spells} other spells`;
}

function short(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 3))}...`;
}
