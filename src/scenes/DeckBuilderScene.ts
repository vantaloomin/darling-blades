import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { RULES } from '../config/rules';
import { ALL_CARDS, CARD_DB, byId } from '../data/catalog';
import type { CardDef } from '../engine/types';
import { def, isType, manaValue } from '../engine/types';
import { isBasic, ownedCount } from '../meta/Collection';
import { saveDeck, validateDeck } from '../meta/DeckStorage';
import { Services } from '../meta/services';
import { bindTapButton, inflateHitArea, isTouchDevice } from '../platform/gestures';
import { makeCardThumb } from '../ui/CardThumbCache';
import { clampDeckPage, deckPageCount, deckPageSlice } from '../ui/deckListPaging';
import { computeDeckStats, PIE_COLORS } from '../ui/deckStats';
import { applyBackdrop } from '../ui/SceneBackdrop';

const GRID_COLS = 4;
const GRID_ROWS = 3;
const GRID_SIZE = GRID_COLS * GRID_ROWS;
const BASICS = ['land-plains', 'land-island', 'land-swamp', 'land-mountain', 'land-forest'];
/** Touch profile: deck-list rows per page and their pitch (plan §1.4). */
const TOUCH_DECK_ROWS = 5;
const TOUCH_DECK_PITCH = 44;
/** Desktop profile: denser tap-to-remove rows, same paging model (no hard clip). */
const DESKTOP_DECK_ROWS = 11;
const DESKTOP_DECK_PITCH = 22;
const DESKTOP_DECK_Y0 = 240;
/** Deck-list pager row + the stats block below it (F13), both cleared by the shorter list. */
const DECK_PAGER_Y = 480;
const DECK_STATS_Y = 510;

/**
 * Edit the active deck: paged owned-card pool left, deck list + basics right.
 *
 * The deck list has two profiles (mobile-lan-plan §1.4). Desktop keeps the
 * dense 22px rows where the row itself is tap-to-remove. On touch devices the
 * audited hazard — 1.6mm-tall rows where every tap is a DESTRUCTIVE remove —
 * is replaced wholesale: bigger row pitch, removal only via an explicit
 * per-row − button (90px hit box), and page controls instead of the y>560
 * hard clip. Basics rows also widen their pitch slightly on touch so the ±
 * steppers can carry pitch-filling hit boxes.
 */
export class DeckBuilderScene extends Phaser.Scene {
  private deck: string[] = [];
  private page = 0;
  private deckPage = 0;
  private touch = false;
  private cells: Phaser.GameObjects.GameObject[] = [];
  private rightPane: Phaser.GameObjects.GameObject[] = [];
  private pageText!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;

  constructor() {
    super('DeckBuilder');
  }

  create(): void {
    this.page = 0;
    this.deckPage = 0;
    this.touch = isTouchDevice();
    this.cells = [];
    this.rightPane = [];

    const save = Services.save.data;
    const active = save.decks.find((d) => d.id === save.activeDeckId);
    this.deck = active ? [...active.cards] : [];

    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;
    const height = 720;
    // Backdrop first (docs/scene-art.md §3); the base gradient is the fallback.
    // The right-panel fill stays ON TOP of the backdrop (the deck panel covers
    // the right 400px), so it's drawn after applyBackdrop, not inside it.
    applyBackdrop(this, 'deckbuilder', {
      dim: 0x0b0812,
      dimAlpha: 0.55,
      fallback: () => {
        const grad = this.add.graphics();
        grad.fillGradientStyle(0x171222, 0x171222, 0x0b0812, 0x0b0812, 1);
        grad.fillRect(0, 0, width, height);
      },
    });
    const panel = this.add.graphics();
    panel.fillStyle(0x1c1730, 0.85);
    panel.fillRect(width - 400, 0, 400, height);
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('shop'); // the light browsing bed

    this.add
      .text(340, 40, 'Deck Builder', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '30px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);

    // Gold badge (top-right, over the deck panel) — see your balance while you
    // weigh what to build. Static here (deckbuilding never spends gold).
    this.goldText = this.add
      .text(width - 30, 30, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '18px',
        fontStyle: '600',
        color: '#ffd88a',
      })
      .setOrigin(1, 0.5);
    this.refreshGold();

    const back = this.add
      .text(28, 28, '← Menu', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '18px', color: '#c9bde0' })
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, back, () => this.scene.start('MainMenu'));
    inflateHitArea(back, 90, 90);

    // pool pager (‹ › audited at ~2.1mm wide — inflate to the 90px minimum;
    // their columns are clear of the pool grid at x 118+/628–)
    const prev = this.add
      .text(50, 380, '‹', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '54px', color: '#c9bde0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const next = this.add
      .text(830, 380, '›', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '54px', color: '#c9bde0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bindTapButton(this, prev, () => this.turnPage(-1));
    bindTapButton(this, next, () => this.turnPage(1));
    inflateHitArea(prev, 90, 90);
    inflateHitArea(next, 90, 90);
    this.pageText = this.add
      .text(440, height - 22, '', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '13px', color: '#8f83a8' })
      .setOrigin(0.5);

    this.status = this.add
      .text(width - 380, height - 90, '', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        color: '#f0b0a0',
        wordWrap: { width: 360 },
      })
      .setOrigin(0, 1);

    this.renderPool();
    this.renderDeck();
  }

  private pool(): CardDef[] {
    const save = Services.save.data;
    return ALL_CARDS.filter(
      (d) => !d.token && !d.supertypes?.includes('basic') && ownedCount(save, d.id) > 0,
    ).sort(
      (a, b) => manaValue(a.cost) - manaValue(b.cost) || a.name.localeCompare(b.name),
    );
  }

  private turnPage(dir: number): void {
    const pages = Math.max(1, Math.ceil(this.pool().length / GRID_SIZE));
    this.page = Phaser.Math.Clamp(this.page + dir, 0, pages - 1);
    this.renderPool();
  }

  private countIn(deck: readonly string[], id: string): number {
    return deck.filter((c) => c === id).length;
  }

  private renderPool(): void {
    for (const c of this.cells) c.destroy();
    this.cells = [];
    const save = Services.save.data;
    const pool = this.pool();
    const pages = Math.max(1, Math.ceil(pool.length / GRID_SIZE));
    this.pageText.setText(`Page ${this.page + 1}/${pages} — click a card to add it`);

    pool.slice(this.page * GRID_SIZE, (this.page + 1) * GRID_SIZE).forEach((d, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = 190 + col * 170;
      const y = 190 + row * 218;
      // Cached-thumbnail Image instead of a live CardView — cheap to churn per page.
      const thumb = makeCardThumb(this, x, y, d, 0.48);
      thumb.setInteractive({ useHandCursor: true });
      // Tap-classified on touch so a drag across the grid can't add cards.
      bindTapButton(this, thumb, () => this.addCard(d.id));
      this.cells.push(thumb);
      const inDeck = this.countIn(this.deck, d.id);
      const badge = this.add
        .text(x + 60, y - 92, `${inDeck}/${Math.min(RULES.maxCopies, ownedCount(save, d.id))}`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          fontStyle: '700',
          color: inDeck > 0 ? '#9be6a8' : '#8f83a8',
          backgroundColor: '#1c1730',
          padding: { x: 6, y: 2 },
        })
        .setOrigin(0.5);
      this.cells.push(badge);
      // Add-a-playset chip (top-left corner) — one tap fills this card to the
      // cap. Shown only when ≥2 are addable (a single card tap already adds one).
      const addable = Math.min(RULES.maxCopies, ownedCount(save, d.id)) - inDeck;
      if (addable > 1) {
        const addAll = this.add
          .text(x - 58, y - 92, `+${addable}`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            fontStyle: '700',
            color: '#9be6a8',
            backgroundColor: '#1c1730',
            padding: { x: 6, y: 2 },
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        bindTapButton(this, addAll, () => this.addPlayset(d.id));
        inflateHitArea(addAll, 52, 44);
        this.cells.push(addAll);
      }
    });
  }

  private addCard(id: string): void {
    const save = Services.save.data;
    const inDeck = this.countIn(this.deck, id);
    if (inDeck >= Math.min(RULES.maxCopies, ownedCount(save, id))) return;
    this.deck.push(id);
    this.renderPool();
    this.renderDeck();
  }

  /** Add-a-playset: fill this card up to the per-card cap in one tap. */
  private addPlayset(id: string): void {
    const cap = Math.min(RULES.maxCopies, ownedCount(Services.save.data, id));
    while (this.countIn(this.deck, id) < cap) this.deck.push(id);
    this.renderPool();
    this.renderDeck();
  }

  private removeCard(id: string): void {
    const idx = this.deck.indexOf(id);
    if (idx >= 0) this.deck.splice(idx, 1);
    this.renderPool();
    this.renderDeck();
  }

  private refreshGold(): void {
    this.goldText.setText(`🪙 ${Services.save.data.gold}`);
  }

  /** ‹ N/M › deck-list pager, shared by both profiles; sits below the list. */
  private renderDeckPagers(x0: number, pages: number): void {
    const mkPager = (px: number, glyph: string, dir: number): void => {
      const b = this.add
        .text(px, DECK_PAGER_Y, glyph, { fontFamily: 'Cinzel, Georgia, serif', fontSize: '26px', color: '#c9bde0' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, b, () => {
        this.deckPage = Phaser.Math.Clamp(this.deckPage + dir, 0, pages - 1);
        this.renderDeck();
      });
      inflateHitArea(b, 90, 56);
      this.rightPane.push(b);
    };
    mkPager(x0 + 250, '‹', -1);
    mkPager(x0 + 340, '›', 1);
    const pageLabel = this.add
      .text(x0 + 295, DECK_PAGER_Y, `${this.deckPage + 1}/${pages}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: '#8f83a8',
      })
      .setOrigin(0.5);
    this.rightPane.push(pageLabel);
  }

  /** Compact deck-stats block (mana curve + type/color counts) below the list. */
  private renderDeckStats(x0: number): void {
    const s = computeDeckStats(this.deck, CARD_DB);
    const push = (o: Phaser.GameObjects.GameObject): void => void this.rightPane.push(o);

    push(
      this.add
        .text(x0, DECK_STATS_Y, 'Mana curve', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '15px',
          color: '#c7a8f0',
        })
        .setOrigin(0, 0.5),
    );

    const baseY = DECK_STATS_Y + 50; // bar baseline (bars grow upward)
    const maxCount = Math.max(1, ...s.curve);
    s.curve.forEach((count, mv) => {
      const bx = x0 + 16 + mv * 22;
      const h = count > 0 ? Math.max(3, Math.round((count / maxCount) * 30)) : 2;
      push(this.add.rectangle(bx, baseY, 15, h, count > 0 ? 0xffd88a : 0x3a3355).setOrigin(0.5, 1));
      if (count > 0) {
        push(
          this.add
            .text(bx, baseY - h - 8, `${count}`, {
              fontFamily: 'Inter, Arial, sans-serif',
              fontSize: '11px',
              color: '#e0d8f0',
            })
            .setOrigin(0.5),
        );
      }
      push(
        this.add
          .text(bx, baseY + 9, mv === 7 ? '7+' : `${mv}`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '11px',
            color: '#8f83a8',
          })
          .setOrigin(0.5),
      );
    });

    const other = s.nonlands - s.typeCounts.creature;
    push(
      this.add
        .text(x0, baseY + 34, `${s.typeCounts.creature} creatures · ${s.lands} lands · ${other} other`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          color: '#c9bde0',
        })
        .setOrigin(0, 0.5),
    );
    const pips = PIE_COLORS.filter((c) => s.colorPips[c] > 0)
      .map((c) => `${c}·${s.colorPips[c]}`)
      .join('   ');
    push(
      this.add
        .text(x0, baseY + 56, pips || 'colorless', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          color: '#8f83a8',
        })
        .setOrigin(0, 0.5),
    );
  }

  private renderDeck(): void {
    for (const c of this.rightPane) c.destroy();
    this.rightPane = [];
    const width = 1280; // design-space width (see create())
    const x0 = width - 380;

    const title = this.add.text(x0, 24, `Deck — ${this.deck.length}/${RULES.deckSize}`, {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '22px',
      color: this.deck.length === RULES.deckSize ? '#9be6a8' : '#ffd88a',
    });
    this.rightPane.push(title);

    // basics steppers. The ± pair was an audited adjacent-target mis-tap
    // (centers 40px apart) — respaced to ≥90px centers with hit boxes that
    // fill the row pitch (30px, widened to 40 on touch — plan §1.4).
    const basicsPitch = this.touch ? 40 : 30;
    BASICS.forEach((id, i) => {
      const d = byId(id);
      const y = 70 + i * basicsPitch;
      const n = this.countIn(this.deck, id);
      const row = this.add.text(x0, y, `${d.name}: ${n}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '15px',
        color: '#c9bde0',
      });
      const minus = this.add
        .text(x0 + 190, y, ' − ', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '15px', color: '#f0b0a0', backgroundColor: '#241d3a' })
        .setInteractive({ useHandCursor: true });
      const plus = this.add
        .text(x0 + 290, y, ' + ', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '15px', color: '#9be6a8', backgroundColor: '#241d3a' })
        .setInteractive({ useHandCursor: true });
      bindTapButton(this, minus, () => this.removeCard(id));
      bindTapButton(this, plus, () => {
        this.deck.push(id);
        this.renderDeck();
      });
      inflateHitArea(minus, 90, basicsPitch);
      inflateHitArea(plus, 90, basicsPitch);
      this.rightPane.push(row, minus, plus);
    });

    // nonbasic list grouped with counts
    const counts = new Map<string, number>();
    for (const id of this.deck) {
      if (!isBasic(CARD_DB, id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const entries = [...counts.entries()].sort((a, b) => {
      const da = def(CARD_DB, a[0]);
      const dbb = def(CARD_DB, b[0]);
      const landDiff = Number(isType(dbb, 'land')) - Number(isType(da, 'land'));
      return landDiff || manaValue(da.cost) - manaValue(dbb.cost) || da.name.localeCompare(dbb.name);
    });
    if (!this.touch) {
      // Desktop: dense tap-to-remove list — now PAGED so a long, singleton-heavy
      // deck never silently drops rows past the old y>560 hard clip.
      const pages = deckPageCount(entries.length, DESKTOP_DECK_ROWS);
      this.deckPage = clampDeckPage(this.deckPage, entries.length, DESKTOP_DECK_ROWS);
      deckPageSlice(entries, this.deckPage, DESKTOP_DECK_ROWS).forEach(([id, n], i) => {
        const d = def(CARD_DB, id);
        const y = DESKTOP_DECK_Y0 + i * DESKTOP_DECK_PITCH;
        const row = this.add
          .text(x0, y, `${n}× ${d.name}  (${manaValue(d.cost)})`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            color: '#e0d8f0',
          })
          .setInteractive({ useHandCursor: true });
        row.on('pointerover', () => row.setColor('#f0b0a0'));
        row.on('pointerout', () => row.setColor('#e0d8f0'));
        row.on('pointerup', () => this.removeCard(id));
        this.rightPane.push(row);
      });
      if (pages > 1) this.renderDeckPagers(x0, pages);
    } else {
      // Touch: rows are read-only; removal happens on an explicit, inflated
      // − button per row (the audited destructive-row hazard), with paging
      // instead of the hard clip.
      const pages = deckPageCount(entries.length, TOUCH_DECK_ROWS);
      this.deckPage = clampDeckPage(this.deckPage, entries.length, TOUCH_DECK_ROWS);
      const listY0 = 270;
      deckPageSlice(entries, this.deckPage, TOUCH_DECK_ROWS).forEach(([id, n], i) => {
          const d = def(CARD_DB, id);
          const y = listY0 + i * TOUCH_DECK_PITCH;
          const row = this.add.text(x0, y, `${n}× ${d.name}  (${manaValue(d.cost)})`, {
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
            color: '#e0d8f0',
          });
          const minus = this.add
            .text(x0 + 335, y + 8, ' − ', {
              fontFamily: 'Inter, Arial, sans-serif',
              fontSize: '16px',
              color: '#f0b0a0',
              backgroundColor: '#241d3a',
              padding: { x: 8, y: 3 },
            })
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });
          bindTapButton(this, minus, () => this.removeCard(id));
          inflateHitArea(minus, 90, TOUCH_DECK_PITCH);
          this.rightPane.push(row, minus);
        });
      if (pages > 1) this.renderDeckPagers(x0, pages);
    }

    this.renderDeckStats(x0);

    // validation + save
    const issues = validateDeck(CARD_DB, Services.save.data, this.deck);
    this.status.setText(
      issues
        .slice(0, 4)
        .map((i) => `${i.kind === 'error' ? '✕' : '⚠'} ${i.message}`)
        .join('\n'),
    );
    const canSave = issues.every((i) => i.kind !== 'error');
    const saveBtn = this.add
      .text(x0 + 180, 720 - 40, 'Save Deck', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: canSave ? '#ffd88a' : '#57506b',
        backgroundColor: '#2c2344',
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    inflateHitArea(saveBtn, 90, 90);
    bindTapButton(this, saveBtn, () => {
      if (!canSave) return;
      const save = Services.save.data;
      const id = save.activeDeckId ?? 'custom-1';
      const name = save.decks.find((d) => d.id === id)?.name ?? 'Custom Deck';
      saveDeck(save, { id, name, cards: [...this.deck] });
      save.activeDeckId = id;
      Services.save.flush();
      saveBtn.setText('Saved ✓');
      // renderDeck() may destroy this button before the revert fires; calling
      // setText on a destroyed Text kills the game loop, so guard on .active.
      this.time.delayedCall(900, () => {
        if (saveBtn.active) saveBtn.setText('Save Deck');
      });
    });
    this.rightPane.push(saveBtn);
  }
}
