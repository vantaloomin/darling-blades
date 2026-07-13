import Phaser from 'phaser';
import type { CardDef } from '../engine/types';
import { cardGlossaryEntries } from './rulesText';
import {
  keywordGlossaryViewport,
  measuredRowsLayout,
  scrollOffsetByDelta,
} from './layout';
import { panel } from './themeWidgets';
import { theme } from './theme';

interface KeywordGlossaryOpts {
  x: number;
  y: number;
  width: number;
  title?: string;
  /** Optional caller cap; the host policy remains the hard upper bound. */
  maxHeight?: number;
}

/** Contextual keyword reference for full-card inspect overlays. */
export function addKeywordGlossaryPanel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  card: CardDef,
  opts: KeywordGlossaryOpts,
): void {
  // Keywords AND named mechanics (Foresee/Sever) the card's text references —
  // keep this data source aligned with the card face's generated rules text.
  const entries = cardGlossaryEntries(card);
  if (entries.length === 0) return;

  const compact = opts.width < 220;
  const pad = compact ? theme.space(2) : theme.space(3);
  const titleHeight = theme.space(8);
  const policy = keywordGlossaryViewport(opts.width);
  // Overflow policy: keep the panel inside its host cap and scroll the
  // measured content with wheel or pointer-drag touch input.
  const maxHeight = Math.min(policy.maxHeight, Math.max(0, opts.maxHeight ?? policy.maxHeight));
  const textWidth = Math.max(0, opts.width - pad * 2);
  const titleFontSize = compact ? theme.type.label : theme.type.h2;
  const termFontSize = compact ? theme.type.caption : theme.type.label;
  const reminderFontSize = compact ? theme.type.micro : theme.type.caption;

  // Phaser is the renderer-side measurement authority. Create wrapped texts,
  // read their actual heights, then pass those measurements to the headless
  // layout helper instead of deriving a row from the current copy or a line
  // count assumption.
  const textRows = entries.map((entry) => {
    const term = scene.add
      .text(0, 0, entry.name, {
        fontFamily: theme.fonts.ui,
        fontSize: `${termFontSize}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
        wordWrap: { width: textWidth },
      })
      .setOrigin(0, 0);
    const reminder = scene.add
      .text(0, 0, entry.reminder, {
        fontFamily: theme.fonts.ui,
        fontSize: `${reminderFontSize}px`,
        color: theme.colors.body,
        lineSpacing: theme.space(1),
        wordWrap: { width: textWidth },
      })
      .setOrigin(0, 0);
    return { term, reminder };
  });
  const layout = measuredRowsLayout(
    textRows.map(({ term, reminder }) => ({
      primaryHeight: term.height,
      secondaryHeight: reminder.height,
    })),
    opts.width,
    maxHeight,
    {
      titleHeight,
      horizontalPadding: pad,
      contentTopPadding: theme.space(2),
      contentBottomPadding: theme.space(2),
      rowGap: theme.space(2),
      rowPadding: theme.space(1),
      textGap: theme.space(1),
    },
  );

  const background = panel(scene, opts.x, opts.y, opts.width, layout.totalHeight);
  const title = scene.add
    .text(opts.x + pad, opts.y + titleHeight / 2, opts.title ?? 'Keyword Guide', {
      fontFamily: theme.fonts.display,
      fontSize: `${titleFontSize}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.heading,
      wordWrap: { width: textWidth },
    })
    .setOrigin(0, 0.5);
  const content = scene.add.container(opts.x, opts.y);
  textRows.forEach(({ term, reminder }, index) => {
    const row = layout.rows[index];
    term.setPosition(row.x, row.primaryY);
    reminder.setPosition(row.x, row.secondaryY);
    content.add([term, reminder]);
  });

  const viewport = layout.contentViewport;
  const maskShape = scene.add
    .graphics()
    .fillStyle(theme.graphics.panelFill, 1)
    .fillRect(opts.x + viewport.x, opts.y + viewport.y, viewport.width, viewport.height)
    .setVisible(false);
  content.setMask(maskShape.createGeometryMask());

  let scrollOffset = 0;
  let dragging = false;
  let dragPointerId: number | null = null;
  let dragStartY = 0;
  let dragStartOffset = 0;
  const scrollRange = layout.maxScroll;
  const railX = opts.x + opts.width - Math.max(theme.space(1), pad / 2);
  const scrollbar = scrollRange > 0 ? scene.add.graphics() : null;
  const scrollThumb = scrollRange > 0 ? scene.add.graphics() : null;
  const scrollZone = scrollRange > 0
    ? scene.add
      .zone(
        opts.x + opts.width / 2,
        opts.y + viewport.y + viewport.height / 2,
        opts.width,
        viewport.height,
      )
      .setInteractive()
    : null;

  const redrawScrollbar = (): void => {
    if (!scrollRange || viewport.height <= 0 || !scrollbar || !scrollThumb) return;
    const thumbHeight = Math.max(
      theme.space(4),
      viewport.height * (viewport.height / Math.max(viewport.height, layout.contentHeight)),
    );
    const thumbTravel = Math.max(0, viewport.height - thumbHeight);
    const thumbY = opts.y + viewport.y + (scrollOffset / scrollRange) * thumbTravel;
    scrollbar
      .clear()
      .fillStyle(theme.graphics.panelStroke, theme.alpha.subtle)
      .fillRoundedRect(railX, opts.y + viewport.y, theme.space(0.5), viewport.height, theme.radius.control);
    scrollThumb
      .clear()
      .fillStyle(theme.graphics.rowFillActive, theme.alpha.chrome)
      .fillRoundedRect(railX - theme.space(0.5), thumbY, theme.space(1.5), thumbHeight, theme.radius.control);
  };
  const setScroll = (next: number): void => {
    scrollOffset = scrollOffsetByDelta(0, next, scrollRange);
    content.setPosition(opts.x, opts.y - scrollOffset);
    redrawScrollbar();
  };
  const endDrag = (pointer: Phaser.Input.Pointer): void => {
    if (dragPointerId === pointer.id) {
      dragging = false;
      dragPointerId = null;
    }
  };
  const moveDrag = (pointer: Phaser.Input.Pointer): void => {
    if (!dragging || dragPointerId !== pointer.id) return;
    setScroll(dragStartOffset - (pointer.worldY - dragStartY));
  };

  if (scrollZone) {
    scrollZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      dragging = true;
      dragPointerId = pointer.id;
      dragStartY = pointer.worldY;
      dragStartOffset = scrollOffset;
    });
    scrollZone.on('wheel', (_pointer: Phaser.Input.Pointer, _deltaX: number, deltaY: number) => {
      setScroll(scrollOffset + deltaY);
    });
    scene.input.on('pointermove', moveDrag);
    scene.input.on('pointerup', endDrag);
    parent.once('destroy', () => {
      scene.input.off('pointermove', moveDrag);
      scene.input.off('pointerup', endDrag);
    });
    redrawScrollbar();
  }

  parent.add([background, title, content, maskShape]);
  if (scrollRange > 0 && scrollbar && scrollThumb && scrollZone) {
    parent.add([scrollbar, scrollThumb, scrollZone]);
  }
}
