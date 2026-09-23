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
  DUTY_CHOOSER_LAYOUT, LOOT_PICKER_LAYOUT, dutyChooserRows, lootPickerPage,
  toggleLootDiscard, type DutyChoice, type MandatorySelection,
} from './drownedDeepChoices';
import { dutyRowText } from './duelPresentation';

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
        fontFamily: theme.fonts.ui, fontSize: '16px', color: theme.colors.muted,
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
  const container = scene.add.container(0, 0).setDepth(105);
  const dim = scene.add.rectangle(640, 360, 1280, 720, theme.graphics.dim, 0.82).setInteractive();
  // Tapping outside cancels, as it does on every other cast chooser.
  bindTapButton(scene, dim, pointer => { if (!pointer.rightButtonReleased()) options.cancel(); });
  container.add(dim);
  const body = scene.add.container(0, 0);
  container.add(body);
  let focus = 0;
  const choose = (index: number): void => {
    if (container.active && options.choices()[index]?.enabled) options.choose(index);
  };
  const draw = (): void => {
    if (!container.active) return;
    body.removeAll(true);
    const choices = options.choices();
    const sheet = dutyChooserRows(choices.length, Math.floor(focus / l.pageSize));
    body.add(scene.add.text(l.x, l.titleY, `${options.card.name}: choose a Duty`, {
      fontFamily: theme.fonts.display, fontSize: '26px', color: theme.colors.heading,
      wordWrap: { width: 850 }, align: 'center', resolution: 2,
    }).setOrigin(0.5));
    for (const row of sheet.rows) {
      const choice = choices[row.abilityIndex];
      const alpha = choice.enabled ? 1 : theme.alpha.subtle;
      const plate = scene.add.rectangle(row.x, row.y, row.width, row.height, theme.graphics.rowFillActive)
        .setStrokeStyle(2, colorInt(focus === row.abilityIndex ? theme.colors.gold : theme.colors.panelStroke))
        .setAlpha(alpha);
      body.add(plate);
      // The tap is the image; the text continues it with any mana as pips
      // (", {2}: Draw a card."), the reading order of the Duty confirmation.
      const text = renderManaText(scene, body, row.left + 40, row.top + 14, dutyRowText(choice.line, choice.cost.mana), {
        fontFamily: theme.fonts.ui, fontSize: '18px', color: theme.colors.body,
        wordWrap: { width: row.width - 60 }, resolution: 2,
      });
      text.text.setScale(Math.min(1, (row.height - 28) / Math.max(1, text.text.height)));
      text.reflow();
      text.setAlpha(alpha);
      body.add(scene.add.image(row.left + 27, row.top + 25, 'pip-T').setDisplaySize(22, 22).setAlpha(alpha));
      // Disabled rows still consume the hit, so their click cannot dismiss the dim behind them.
      const zone = scene.add.zone(row.x, row.y, row.width, row.height).setInteractive({ useHandCursor: choice.enabled });
      body.add(zone);
      bindTapButton(scene, zone, pointer => { if (!pointer.rightButtonReleased()) choose(row.abilityIndex); });
    }
    if (!options.touch) {
      body.add(scene.add.text(l.x, 180, 'Arrows to choose · Enter to select', {
        fontFamily: theme.fonts.ui, fontSize: '16px', color: theme.colors.muted,
      }).setOrigin(0.5));
    }
    if (sheet.pageCount > 1) {
      body.add(scene.add.text(l.x, l.footerY, `${sheet.page + 1}/${sheet.pageCount}`, {
        fontFamily: theme.fonts.ui, fontSize: '16px', color: theme.colors.muted,
      }).setOrigin(0.5));
      for (const delta of [-1, 1]) {
        const nav = delta < 0 ? l.previous : l.next;
        body.add(themedButton(scene, nav.x, nav.y,
        delta < 0 ? 'Previous' : 'Next', {
          enabled: delta < 0 ? sheet.canPrevious : sheet.canNext, minWidth: nav.width,
          onTap: pointer => {
            if (pointer.rightButtonReleased()) return;
            focus = Math.max(0, Math.min(choices.length - 1, (sheet.page + delta) * l.pageSize));
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
