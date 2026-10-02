import Phaser from 'phaser';
import type { CardDef } from '../engine/types';
import type { Action } from '../engine/actions';
import type { CardVariant } from '../meta/variants';
import { bindTapButton } from '../platform/gestures';
import { CardView, CARD_H } from './CardView';
import { renderManaText } from './ManaText';
import { theme, colorInt } from './theme';
import { themedButton } from './themeWidgets';
import {
  DUTY_CHOOSER_LAYOUT, LOOT_PICKER_LAYOUT, lootPickerPage,
  toggleLootDiscard, type DutyChoice, type MandatorySelection,
} from './drownedDeepChoices';
import { dutyRowPips } from './duelPresentation';
import { duelPanelAlpha, duelPanelType, dutyPanelPages } from './duelPanelPresentation';
import { fitMenuName } from './menuText';

/** Input is routed by DuelScene so keyboard and pointer share these callbacks. */
export interface ChoiceOverlay {
  container: Phaser.GameObjects.Container;
  confirm(): void;
  move(delta: number): void;
  toggle?(): void;
}

export interface ChoiceCard {
  card: CardDef;
  variant?: CardVariant;
  landStyle?: string;
}

export function showLootPicker(scene: Phaser.Scene, options: {
  cards: readonly ChoiceCard[];
  /** A touch player has no keyboard, so the keyboard hint is dropped. */
  touch: boolean;
  selection(picked: readonly number[]): MandatorySelection<Extract<Action, { type: 'discard' }>> | null;
  submit(action: Extract<Action, { type: 'discard' }>): void;
  decorate(view: CardView, entry: ChoiceCard, toggle: () => void): void;
}): ChoiceOverlay {
  const l = LOOT_PICKER_LAYOUT;
  const container = scene.add.container(0, 0).setDepth(theme.depth.overlay);
  container.add(scene.add.rectangle(l.width / 2, l.height / 2, l.width, l.height,
    theme.graphics.dim, theme.alpha.chrome).setInteractive());
  const body = scene.add.container(0, 0);
  container.add(body);
  let selected: number[] = [];
  let focus = 0;
  let page = 0;
  const confirm = (): void => {
    if (!container.active) return;
    const action = options.selection(selected)?.action;
    if (action) options.submit(action);
  };
  const toggle = (index: number): void => {
    const model = options.selection(selected);
    if (!container.active || !model) return;
    selected = toggleLootDiscard(selected, index, model.candidates, model.count);
    focus = index;
    draw();
  };
  const draw = (): void => {
    if (!container.active) return;
    body.removeAll(true);
    const model = options.selection(selected);
    if (!model) return;
    const sheet = lootPickerPage(options.cards.length, page);
    page = sheet.page;
    body.add(scene.add.text(l.width / 2, l.titleY, model.prompt, {
      fontFamily: theme.fonts.display, fontSize: `${theme.type.h1}px`,
      color: theme.colors.heading, resolution: 2,
    }).setOrigin(0.5));
    body.add(scene.add.text(l.width / 2, l.progressY,
      options.touch ? model.progress : `${model.progress} · Arrows to browse, Space to select, Enter to confirm`, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`,
        color: theme.colors.body, resolution: 2,
      }).setOrigin(0.5));
    for (const slot of sheet.slots) {
      const entry = options.cards[slot.index];
      const picked = selected.includes(slot.index);
      const view = new CardView(scene, slot.x, slot.y - (picked ? l.selectedLift : 0)).setScale(slot.scale);
      view.setCard(entry.card, { fx: 'none', variant: entry.variant, fullArt: entry.variant?.fullArt, landStyle: entry.landStyle });
      view.setAlpha(picked ? theme.alpha.subtle : 1);
      body.add(view);
      // The focus frame is decoration; only CardView's child Zone receives input.
      if (focus === slot.index) {
        const frame = scene.add.graphics().lineStyle(2, colorInt(theme.colors.gold), 1);
        frame.strokeRoundedRect(slot.x - 96, view.y - CARD_H * slot.scale / 2 - 4,
          192, CARD_H * slot.scale + 8, 6);
        body.add(frame);
      }
      if (picked) body.add(scene.add.text(slot.x, slot.y + CARD_H * slot.scale / 2 + l.badgeOffset, 'Discard', {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.caption}px`,
        color: theme.colors.danger, backgroundColor: theme.colors.dangerBg, padding: { x: 8, y: 4 },
      }).setOrigin(0.5));
      view.enableInput();
      options.decorate(view, entry, () => toggle(slot.index));
    }
    body.add(themedButton(scene, l.confirm.x, l.confirm.y, 'Confirm', {
      variant: 'primary', minWidth: l.confirm.width, enabled: model.action !== null,
      onTap: pointer => { if (!pointer.rightButtonReleased()) confirm(); },
    }).container);
    if (sheet.pageCount > 1) {
      const turnPage = (delta: number): void => {
        page = lootPickerPage(options.cards.length, page + delta).page;
        focus = page * l.pageSize;
        draw();
      };
      body.add(themedButton(scene, l.previous.x, l.previous.y, 'Previous', {
        minWidth: l.previous.width, enabled: sheet.canPrevious,
        onTap: pointer => { if (!pointer.rightButtonReleased()) turnPage(-1); },
      }).container);
      body.add(themedButton(scene, l.next.x, l.next.y, 'Next', {
        minWidth: l.next.width, enabled: sheet.canNext,
        onTap: pointer => { if (!pointer.rightButtonReleased()) turnPage(1); },
      }).container);
      body.add(scene.add.text(l.width / 2, 652, `${page + 1} / ${sheet.pageCount}`, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.muted,
      }).setOrigin(0.5));
    }
  };
  draw();
  return {
    container, confirm,
    move: delta => {
      focus = Math.max(0, Math.min(options.cards.length - 1, focus + delta));
      page = Math.floor(focus / l.pageSize);
      draw();
    },
    toggle: () => toggle(focus),
  };
}

/** Same modal guard and mana-pip composition as the existing cast chooser. */
export function showDutyPicker(scene: Phaser.Scene, options: {
  card: CardDef;
  /** A touch player has no keyboard, so the keyboard hint is dropped. */
  touch: boolean;
  choices(): DutyChoice[];
  choose(abilityIndex: number): void;
  cancel(): void;
}): ChoiceOverlay {
  const l = DUTY_CHOOSER_LAYOUT;
  const container = scene.add.container(0, 0).setDepth(theme.depth.modal);
  const dim = scene.add.rectangle(640, 360, 1280, 720, theme.graphics.dim, duelPanelAlpha(0.82)).setInteractive();
  // Tapping outside cancels, as it does on every other cast chooser.
  bindTapButton(scene, dim, pointer => { if (!pointer.rightButtonReleased()) options.cancel(); });
  container.add(dim);
  const body = scene.add.container(0, 0);
  container.add(body);
  let focus = 0;
  let pageStarts = [0];
  const choose = (index: number): void => {
    if (container.active && options.choices()[index]?.enabled) options.choose(index);
  };
  const draw = (): void => {
    if (!container.active) return;
    body.removeAll(true);
    const choices = options.choices();
    const title = scene.add.text(l.x, l.titleY, `${options.card.name}: choose a Duty`, {
      fontFamily: theme.fonts.display, fontSize: `${duelPanelType().dutyTitle}px`, color: theme.colors.heading,
      align: 'center', resolution: 2,
    }).setOrigin(0.5);
    fitMenuName(title, 850, 3);
    body.add(title);
    const hint = !options.touch ? scene.add.text(l.x, 180, 'Arrows to choose · Enter to select', {
      fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.muted,
    }).setOrigin(0.5) : null;
    if (hint) body.add(hint);
    const rendered = choices.map(choice => {
      const row = scene.add.container(0, 0).setVisible(false);
      body.add(row);
      const { raw, tapPips } = dutyRowPips(choice.line);
      const text = renderManaText(scene, row, 20, 14, raw, {
        fontFamily: theme.fonts.ui, fontSize: `${duelPanelType().dutyBody}px`, color: theme.colors.body,
        wordWrap: { width: l.width - 40, useAdvancedWrap: true }, resolution: 2,
      });
      text.text.setData('a11yFullText', text.text.text).setData('a11yTextWidth', l.width - 40).setData('a11yKeepVisible', true);
      for (const index of tapPips) text.pips[index]?.setTexture('pip-T');
      return { row, text };
    });
    const layout = dutyPanelPages(rendered.map(item => item.text.text.height), title.height, hint?.height ?? 0);
    hint?.setY(layout.hintY);
    pageStarts = layout.pages.map(rows => rows[0]?.index ?? 0);
    const page = Math.max(0, layout.pages.findIndex(rows => rows.some(row => row.index === focus)));
    const sheet = { page, pageCount: layout.pages.length, canPrevious: page > 0, canNext: page < layout.pages.length - 1 };
    const visibleRows = layout.pages[page];
    for (const row of visibleRows) {
      const choice = choices[row.index];
      const entry = rendered[row.index];
      entry.row.setVisible(true).setPosition(l.x - l.width / 2, row.top);
      const plate = scene.add.rectangle(l.width / 2, row.height / 2, l.width, row.height, theme.graphics.rowFillActive)
        .setStrokeStyle(2, colorInt(focus === row.index ? theme.colors.gold : theme.colors.panelStroke));
      entry.row.addAt(plate, 0).setAlpha(choice.enabled ? 1 : theme.alpha.subtle);
      // Content grows the row. The full effect and its mana cost are never shrunk or masked.
      entry.text.reflow();
      const zone = scene.add.zone(l.width / 2, row.height / 2, l.width, row.height).setInteractive({ useHandCursor: choice.enabled });
      entry.row.add(zone);
      bindTapButton(scene, zone, pointer => { if (!pointer.rightButtonReleased()) choose(row.index); });
    }
    container.setData('a11ySurface', { x: 0, y: 0, width: 1280, height: 720 });
    container.setData('a11yDensity', { actual: { id: 'duel-duty', rows: Math.max(...layout.pages.map(rows => rows.length)), columns: 1,
      pitch: (visibleRows[0]?.height ?? l.rowHeight) + l.rowGap, top: layout.top },
      release: { id: 'duel-duty', rows: Math.min(3, choices.length), columns: 1, pitch: 112, top: 210 } });
    if (sheet.pageCount > 1) {
      body.add(scene.add.text(l.x, l.footerY, `${sheet.page + 1}/${sheet.pageCount}`, {
        fontFamily: theme.fonts.ui, fontSize: `${theme.type.body}px`, color: theme.colors.muted,
      }).setOrigin(0.5));
      for (const delta of [-1, 1]) {
        const nav = delta < 0 ? l.previous : l.next;
        body.add(themedButton(scene, nav.x, nav.y,
        delta < 0 ? 'Previous' : 'Next', {
          enabled: delta < 0 ? sheet.canPrevious : sheet.canNext, minWidth: nav.width,
          onTap: pointer => {
            if (pointer.rightButtonReleased()) return;
            focus = Math.max(0, Math.min(choices.length - 1, pageStarts[sheet.page + delta] ?? focus));
            draw();
          },
        }).container);
      }
    }
    body.add(themedButton(scene, l.cancel.x, l.cancel.y, 'Cancel', {
      minWidth: l.cancel.width, onTap: pointer => { if (!pointer.rightButtonReleased()) options.cancel(); },
    }).container);
  };
  draw();
  return {
    container, confirm: () => choose(focus),
    move: delta => {
      focus = Math.max(0, Math.min(options.choices().length - 1, focus + delta));
      draw();
    },
  };
}
