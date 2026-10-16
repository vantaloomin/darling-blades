import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { FEATURES } from '../config/features';
import { CARD_DB } from '../data/catalog';
import { manaValue, type Color } from '../engine/types';
import { deckColorIdentity } from '../meta/deckColorIdentity';
import { DECK_CODE_LEVELS, deckCodeOpponent, deckCodeSeatIssue, type DeckCodeLevel, type DeckCodeOpponent } from '../meta/deckCodeDuel';
import { faceCardFor } from '../meta/deckFace';
import { firstDuelLaunchIssue } from '../meta/duelSetup';
import { Services } from '../meta/services';
import { bakeUiIcon } from '../ui/uiIcons';
import { COMPACT } from '../ui/compactLayout';
import { compactButton, compactHeader, compactSegments, coverFitImage, type CompactButton } from '../ui/compactWidgets';
import { DECK_CODE_COMPACT, deckCodeLayout, type DeckCodeLayout } from '../ui/deckCodeCompact';
import { activeVisibleSavedDeck, builderFormatForDeck, formatDeckSize, formatLabel } from '../ui/deckBuilderHelpers';
import { addPortraitArt } from '../ui/portraitArt';
import { awaitArt } from '../ui/artGate';
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { ellipsizeText } from '../ui/textFit';
import { colorInt, theme } from '../ui/theme';
import { registerSceneBackNavigation } from '../ui/themeWidgets';
import type { Rect } from '../ui/layout';

/** Every card id this build reads, for decoding. */
const CARD_IDS: readonly string[] = Object.keys(CARD_DB);
/** The level names on the selector. */
const LEVEL_LABELS: Record<DeckCodeLevel, string> = { hard: 'Hard' };
/** A deck's colors as the preview names them. */
const COLOR_NAMES: Record<Color, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
/** The opposing deck's preview names this many of its costliest cards. */
const PREVIEW_THREATS = 3;
/** The content box when the scene draws in the 1280x720 window (the dev-only classic desktop). */
const WIDE_CONTENT: Rect = { x: 20, y: 14, width: 1240, height: 692 };

/** The last code on this screen, kept for the session so a deck change or a finished duel comes back to it. */
let rememberedCode = '';

export interface DeckCodeSceneData {
  /** A code to show, replacing the remembered one (a duel's way back). */
  code?: string;
  /** Why a launch was refused, shown in place of the check's line. */
  notice?: string;
}

type Tone = 'muted' | 'success' | 'danger';

/**
 * Duel Deck Codes (2.0): paste a deck code, someone else's or your own, and
 * duel it with the AI piloting it. The code is checked as it is typed or
 * pasted; the opposing deck is previewed; the player's active deck (changed on
 * the Play screen, where decks are picked) must be of the code's format. One
 * composition for phone and desktop, as every menu screen since the S1 B ruling.
 */
export class DeckCodeScene extends Phaser.Scene {
  private layout!: DeckCodeLayout;
  private field: HTMLTextAreaElement | null = null;
  private statusIcon: Phaser.GameObjects.Image | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private preview: Phaser.GameObjects.Container | null = null;
  private previewDeck: DeckCodeOpponent | null = null;
  private duelButton: CompactButton | null = null;
  private ready: string | null = null;
  private level: DeckCodeLevel = 'hard';

  constructor() {
    super('DeckCode');
  }

  create(data: DeckCodeSceneData = {}): void {
    this.sys.settings.data = {};
    if (data.code !== undefined) rememberedCode = data.code;
    this.field = null;
    this.preview = null;
    this.ready = null;
    this.level = DECK_CODE_LEVELS[0];
    applyBackdrop(this, 'mainmenu', { dim: theme.graphics.dim, dimAlpha: 0.5, fallback: () => {} });
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');
    this.build();
    this.check();
    if (data.notice) this.setStatus(data.notice, 'danger');
  }

  private build(): void {
    const type = theme.compactType;
    const stage = sceneStage(this);
    const content = stage.compact ? stage.content : WIDE_CONTENT;
    const label = (text: string): Phaser.GameObjects.Text => this.add.text(0, 0, text, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, fontStyle: theme.weight.w600, color: theme.colors.muted,
    });
    const codeLabel = label('Deck code');
    // Two body lines held for the check's line, so a long reason never moves the preview.
    const probe = this.add.text(0, 0, 'Ag\nAg', { fontFamily: theme.fonts.ui, fontSize: `${type.body}px` });
    const statusH = probe.height;
    probe.destroy();
    this.layout = deckCodeLayout(content, codeLabel.height, statusH);
    const L = this.layout;
    codeLabel.setPosition(L.codeLabel.x, L.codeLabel.y);
    label('Your deck').setPosition(L.deckLabel.x, L.deckLabel.y);
    label('Opponent AI').setPosition(L.levelLabel.x, L.levelLabel.y);

    const back = (): void => { this.scene.start('Play'); };
    compactHeader(this, L.shell, {
      title: 'Deck Code',
      subtitle: 'Paste a shared deck and duel it.',
      gold: Services.save.data.gold,
      onBack: back,
    });
    registerSceneBackNavigation(this, back);

    this.buildField(L.field);
    compactButton(this, L.paste, 'Paste', { icon: 'copy', onTap: () => this.pasteFromClipboard() });
    const iconSize = Math.round(type.body * 1.1);
    this.statusIcon = this.add.image(L.status.x + iconSize / 2, L.status.y, bakeUiIcon(this, 'info'))
      .setDisplaySize(iconSize, iconSize).setVisible(false);
    this.statusText = this.add.text(L.status.x + iconSize + 8, L.status.y, '', {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted,
      wordWrap: { width: L.status.width - iconSize - 8 },
    });

    this.buildDeckPlate(L.deckPlate);
    compactButton(this, L.changeDeck, 'Change deck', { icon: 'deck', onTap: back });
    compactSegments(this, L.level, DECK_CODE_LEVELS.map((level) => LEVEL_LABELS[level]), 0, (i) => {
      this.level = DECK_CODE_LEVELS[i] ?? this.level;
    });
    this.duelButton = compactButton(this, L.duel, 'Duel', {
      variant: 'primary', icon: 'swords', fontSize: type.h2, onTap: () => this.launch(),
    });
    this.duelButton.setEnabled(false);
  }

  /** The code field: a DOM textarea, 16 px or more so a phone's browser does not zoom when it takes focus. */
  private buildField(rect: Rect): void {
    const type = theme.compactType;
    const area = document.createElement('textarea');
    area.value = rememberedCode;
    area.spellcheck = false;
    area.placeholder = 'Paste a deck code here...';
    area.setAttribute('aria-label', 'Deck code to duel');
    area.setAttribute('style', [
      `width:${rect.width}px`, `height:${rect.height}px`, 'box-sizing:border-box', 'resize:none', 'padding:10px 12px',
      `font:${Math.max(16, type.body)}px ${theme.fonts.ui}`, 'line-height:1.35', `color:${theme.colors.body}`,
      `background:${theme.colors.panelFill}`, `border:1px solid ${theme.colors.gold}`, `border-radius:${theme.radius.control}px`,
      'outline:none', 'word-break:break-all',
    ].join(';'));
    // A check is a decode and a deck-rules pass: cheap enough to run on every keystroke.
    area.addEventListener('input', () => this.check());
    this.add.dom(rect.x + rect.width / 2, rect.y + rect.height / 2, area).setOrigin(0.5);
    this.field = area;
  }

  private pasteFromClipboard(): void {
    const unavailable = 'Paste is not available here. Long-press the field and paste.';
    if (!navigator.clipboard?.readText) {
      this.setStatus(unavailable, 'danger');
      return;
    }
    void navigator.clipboard.readText().then((text) => {
      if (!this.field?.isConnected) return;
      this.field.value = text;
      this.check();
    }, () => this.setStatus(unavailable, 'danger'));
  }

  /** Read the field: the check's line, the opposing deck's preview, and whether Duel is on. */
  private check(): void {
    const raw = this.field?.value ?? rememberedCode;
    rememberedCode = raw;
    const code = raw.trim();
    this.ready = null;
    this.drawPreview(null);
    if (code.length === 0) {
      this.setStatus('Paste a code someone shared, or export one of your own from the deck builder.', 'muted');
      this.duelButton?.setEnabled(false);
      return;
    }
    const result = deckCodeOpponent(code, CARD_DB, CARD_IDS);
    if (!result.ok) {
      this.setStatus(result.message, 'danger');
      this.duelButton?.setEnabled(false);
      return;
    }
    this.drawPreview(result.deck);
    // The face is art no other screen asked for: draw again once it is in (synchronous when it already is).
    const shown = result.deck;
    const faceId = shown.darlingId ?? faceCardFor(shown.cards, CARD_DB);
    if (faceId) awaitArt(this, [faceId], { onReady: () => { if (this.previewDeck === shown) this.drawPreview(shown); } });
    const save = Services.save.data;
    const mine = activeVisibleSavedDeck(save.decks, save.activeDeckId, FEATURES.reserveFormats);
    const issue = deckCodeSeatIssue(result.deck, mine) ?? firstDuelLaunchIssue(CARD_DB, save, mine);
    if (issue) {
      this.setStatus(issue, 'danger');
      this.duelButton?.setEnabled(false);
      return;
    }
    this.ready = code;
    this.setStatus('Ready. The AI will pilot this deck.', 'success');
    this.duelButton?.setEnabled(true);
  }

  private setStatus(text: string, tone: Tone): void {
    if (!this.statusText?.active || !this.statusIcon) return;
    const color = tone === 'success' ? theme.colors.success : tone === 'danger' ? theme.colors.danger : theme.colors.muted;
    this.statusText.setText(text).setColor(color);
    const lineH = this.statusText.height / Math.max(1, this.statusText.getWrappedText().length);
    const size = this.statusIcon.displayWidth;
    this.statusIcon.setTexture(bakeUiIcon(this, tone === 'success' ? 'check' : tone === 'danger' ? 'warning' : 'info'))
      .setDisplaySize(size, size).setTint(colorInt(color)).setY(this.statusText.y + lineH / 2).setVisible(true);
  }

  /** The opposing deck: its face (the Darling, or its most telling card), format, colors and costliest cards. */
  private drawPreview(deck: DeckCodeOpponent | null): void {
    this.preview?.destroy();
    this.preview = null;
    this.previewDeck = deck;
    if (!deck) return;
    const type = theme.compactType;
    const rect = this.layout.preview;
    if (rect.height < COMPACT.touch) return;
    const c = this.add.container(0, 0);
    this.preview = c;
    const pad = 12;
    const plate = this.add.graphics();
    c.add(plate);
    const thumb = Math.min(DECK_CODE_COMPACT.previewThumbMax, rect.height - 2 * pad, Math.floor(rect.width * 0.4));
    const faceId = deck.darlingId ?? faceCardFor(deck.cards, CARD_DB);
    let textX = rect.x + pad;
    let artH = 0;
    if (faceId && thumb >= COMPACT.touch) {
      artH = thumb;
      const box = { x: rect.x + pad, y: rect.y + pad, width: thumb, height: thumb };
      try {
        const art = addPortraitArt(this, 0, 0, faceId, (image) => coverFitImage(image, box, 0.15));
        if (art) c.add(art);
      } catch {
        // the plate shows through
      }
      c.add(this.add.graphics().lineStyle(1, theme.graphics.panelStroke, 1).strokeRoundedRect(box.x, box.y, thumb, thumb, 4));
      textX = box.x + thumb + pad;
    }
    const textW = rect.x + rect.width - pad - textX;
    const darling = deck.darlingId ? CARD_DB[deck.darlingId]?.name ?? null : null;
    const title = this.add.text(textX, rect.y + pad, darling ? `Darlings · ${darling}` : 'Standard deck', {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.heading,
    });
    ellipsizeText(title, textW);
    const colors = deckColorIdentity([...deck.cards, ...(deck.darlingId ? [deck.darlingId] : [])], CARD_DB);
    const facts = this.add.text(textX, title.y + title.height + 2,
      `${deck.cards.length} cards · ${colors.length > 0 ? colors.map((color) => COLOR_NAMES[color]).join(', ') : 'Colorless'}`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
      });
    const threats = [...new Set(deck.cards)]
      .filter((id) => !CARD_DB[id]?.types.includes('land'))
      .sort((a, b) => manaValue(CARD_DB[b].cost) - manaValue(CARD_DB[a].cost) || CARD_DB[a].name.localeCompare(CARD_DB[b].name))
      .slice(0, PREVIEW_THREATS)
      .map((id) => CARD_DB[id].name);
    const top = this.add.text(textX, facts.y + facts.height + 8, `Costliest: ${threats.join(', ')}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.body, wordWrap: { width: textW },
    });
    c.add([title, facts, top]);
    // The plate holds what it shows, so a short deck summary is not a tall empty box.
    const h = Math.min(rect.height, Math.max(artH, top.y + top.height - rect.y - pad) + 2 * pad);
    plate.fillStyle(theme.graphics.panelFill, theme.alpha.panel).fillRoundedRect(rect.x, rect.y, rect.width, h, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(rect.x, rect.y, rect.width, h, theme.radius.panel);
  }

  /** The active deck, as the Play screen's rows show it. */
  private buildDeckPlate(rect: Rect): void {
    const type = theme.compactType;
    const save = Services.save.data;
    const deck = activeVisibleSavedDeck(save.decks, save.activeDeckId, FEATURES.reserveFormats);
    this.add.graphics()
      .fillStyle(theme.graphics.panelFill, theme.alpha.panel).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel)
      .lineStyle(theme.control.borderWidth, colorInt(theme.colors.gold), 0.55)
      .strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.panel);
    if (!deck) {
      this.add.text(rect.x + 10, rect.y + rect.height / 2, 'No deck chosen', {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted,
      }).setOrigin(0, 0.5);
      return;
    }
    const thumb = rect.height - 16;
    const faceId = deck.format === 'darlings' && deck.darlingId ? deck.darlingId : deck.heroCardId ?? faceCardFor(deck.cards, CARD_DB);
    const box = { x: rect.x + 8, y: rect.y + 8, width: thumb, height: thumb };
    if (faceId) {
      try {
        addPortraitArt(this, 0, 0, faceId, (image) => coverFitImage(image, box, 0.15));
      } catch {
        // the plate shows through
      }
    }
    const textX = box.x + thumb + 10;
    const textW = rect.x + rect.width - 10 - textX;
    const format = builderFormatForDeck(deck, FEATURES.reserveFormats);
    const name = this.add.text(textX, 0, deck.name, {
      fontFamily: theme.fonts.display, fontSize: `${type.body}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
    });
    ellipsizeText(name, textW);
    const meta = this.add.text(textX, 0, `${formatLabel(format)} · ${deck.cards.length}/${formatDeckSize(format)}`, {
      fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
    });
    ellipsizeText(meta, textW);
    const top = rect.y + (rect.height - name.height - meta.height) / 2;
    name.setY(top);
    meta.setY(top + name.height);
  }

  private launch(): void {
    if (!this.ready) return;
    this.scene.start('Duel', { deckCode: { code: this.ready, level: this.level } });
  }
}
