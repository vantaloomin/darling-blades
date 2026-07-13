import Phaser from 'phaser';
import type { CardDef } from '../engine/types';
import { cardGlossaryEntries } from './rulesText';
import { theme } from './theme';

interface KeywordGlossaryOpts {
  x: number;
  y: number;
  width: number;
  title?: string;
}

/** Contextual keyword reference for full-card inspect overlays. */
export function addKeywordGlossaryPanel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  card: CardDef,
  opts: KeywordGlossaryOpts,
): void {
  // Keywords AND named mechanics (Foresee/Sever) the card's text references —
  // the old card.keywords-only read hid mechanics (e.g. Morrigan's Foresee).
  const entries = cardGlossaryEntries(card);
  if (entries.length === 0) return;

  const compact = opts.width < 220;
  const pad = compact ? 10 : 14;
  const rowH = compact ? 86 : 68;
  const titleH = 36;
  const height = titleH + entries.length * rowH + pad;

  parent.add(
    scene.add
      .rectangle(opts.x, opts.y, opts.width, height, theme.graphics.panelFill, theme.alpha.panel)
      .setOrigin(0, 0)
      .setStrokeStyle(1, theme.graphics.panelStroke, theme.alpha.chrome),
  );
  parent.add(
    scene.add
      .text(opts.x + pad, opts.y + 18, opts.title ?? 'Keyword Guide', {
        fontFamily: theme.fonts.display,
        fontSize: compact ? '14px' : '17px',
        color: theme.colors.heading,
      })
      .setOrigin(0, 0.5),
  );

  entries.forEach((entry, i) => {
    const rowY = opts.y + titleH + i * rowH;
    parent.add(
      scene.add
        .text(opts.x + pad, rowY + 10, entry.name, {
          fontFamily: theme.fonts.ui,
          fontSize: compact ? '12px' : '13px',
          fontStyle: theme.weight.w700,
          color: theme.colors.gold,
        })
        .setOrigin(0, 0),
    );
    parent.add(
      scene.add
        .text(opts.x + pad, rowY + 30, entry.reminder, {
          fontFamily: theme.fonts.ui,
          fontSize: compact ? '11px' : '12px',
          color: theme.colors.body,
          lineSpacing: 2,
          wordWrap: { width: opts.width - pad * 2 },
        })
        .setOrigin(0, 0),
    );
  });
}
