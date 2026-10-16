/**
 * The Duel Deck Codes screen's composition (phone and desktop, Version C),
 * Phaser-free. The main pane takes the code: its label, the field, Paste and My decks, the
 * check's one line and the opposing deck's preview. The command column holds
 * the player's deck, the AI level and Duel at its foot. Coordinates are
 * compact design px inside the content box.
 */

import { COMPACT, compactShell, type CompactShell } from './compactLayout';
import type { Rect } from './layout';

export const DECK_CODE_COMPACT = {
  /** Under a section label, before what it names. */
  labelGap: 6,
  /** Between two blocks in a pane. */
  blockGap: 14,
  /** The field's height: two code lines at the least, four at the most. */
  fieldMinH: 72,
  fieldMaxH: 112,
  /** Paste's width. */
  pasteW: 120,
  /** My decks' width, beside Paste. */
  myDecksW: 150,
  /** The deck picker's width, at most. */
  pickerW: 560,
  /** The deck plate in the column: two lines and their padding. */
  plateH: 64,
  /** The preview's portrait side, at most. */
  previewThumbMax: 132,
} as const;

export interface DeckCodeLayout {
  shell: CompactShell;
  codeLabel: { x: number; y: number; width: number };
  field: Rect;
  paste: Rect;
  /** Beside Paste: pick one of the player's own decks to duel. */
  myDecks: Rect;
  /** The check's line: its top-left and width. */
  status: { x: number; y: number; width: number };
  /** What is left of the main pane under the status line, for the preview. */
  preview: Rect;
  deckLabel: { x: number; y: number; width: number };
  deckPlate: Rect;
  changeDeck: Rect;
  levelLabel: { x: number; y: number; width: number };
  level: Rect;
  duel: Rect;
}

/** `labelH` is a measured section label; `statusH` the status line's reserved height (one or two lines). */
export function deckCodeLayout(content: Rect, labelH: number, statusH: number): DeckCodeLayout {
  const { gap, touch } = COMPACT;
  const k = DECK_CODE_COMPACT;
  const shell = compactShell(content, { back: true });
  const main = shell.main;
  const column = shell.column ?? { x: main.x + main.width, y: main.y, width: 0, height: main.height };

  const codeLabel = { x: main.x, y: main.y, width: main.width };
  const fieldTop = main.y + labelH + k.labelGap;
  const fieldH = Math.round(Math.max(k.fieldMinH, Math.min(k.fieldMaxH, main.height * 0.28)));
  const field = { x: main.x, y: fieldTop, width: main.width, height: fieldH };
  const paste = { x: main.x, y: field.y + field.height + gap, width: Math.min(k.pasteW, main.width), height: touch };
  const myDecksX = paste.x + paste.width + gap;
  const myDecks = { x: myDecksX, y: paste.y, width: Math.max(0, Math.min(k.myDecksW, main.x + main.width - myDecksX)), height: touch };
  const status = { x: main.x, y: paste.y + paste.height + gap, width: main.width };
  const previewTop = status.y + statusH + k.blockGap;
  const preview = { x: main.x, y: previewTop, width: main.width, height: Math.max(0, main.y + main.height - previewTop) };

  const duel = shell.primary?.visual ?? { x: column.x, y: column.y + column.height - COMPACT.primaryH, width: column.width, height: COMPACT.primaryH };
  const deckLabel = { x: column.x, y: column.y, width: column.width };
  const deckPlate = { x: column.x, y: column.y + labelH + k.labelGap, width: column.width, height: k.plateH };
  const changeDeck = { x: column.x, y: deckPlate.y + deckPlate.height + gap, width: column.width, height: touch };
  const levelLabel = { x: column.x, y: changeDeck.y + changeDeck.height + k.blockGap, width: column.width };
  const level = { x: column.x, y: levelLabel.y + labelH + k.labelGap, width: column.width, height: touch };
  return { shell, codeLabel, field, paste, myDecks, status, preview, deckLabel, deckPlate, changeDeck, levelLabel, level, duel };
}
