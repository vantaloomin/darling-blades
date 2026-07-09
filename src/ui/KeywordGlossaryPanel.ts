import Phaser from 'phaser';
import type { CardDef, Keyword } from '../engine/types';
import { KEYWORD_NAMES, KEYWORD_REMINDER } from './rulesText';

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
  const keywords = [...new Set(card.keywords ?? [])] as Keyword[];
  if (keywords.length === 0) return;

  const compact = opts.width < 220;
  const pad = compact ? 10 : 14;
  const rowH = compact ? 86 : 68;
  const titleH = 36;
  const height = titleH + keywords.length * rowH + pad;

  parent.add(
    scene.add
      .rectangle(opts.x, opts.y, opts.width, height, 0x151122, 0.94)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x6f5aa8, 0.72),
  );
  parent.add(
    scene.add
      .text(opts.x + pad, opts.y + 18, opts.title ?? 'Keyword Guide', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: compact ? '14px' : '17px',
        color: '#f0e6ff',
      })
      .setOrigin(0, 0.5),
  );

  keywords.forEach((keyword, i) => {
    const rowY = opts.y + titleH + i * rowH;
    parent.add(
      scene.add
        .text(opts.x + pad, rowY + 10, KEYWORD_NAMES[keyword], {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: compact ? '12px' : '13px',
          fontStyle: '700',
          color: '#ffd88a',
        })
        .setOrigin(0, 0),
    );
    parent.add(
      scene.add
        .text(opts.x + pad, rowY + 30, KEYWORD_REMINDER[keyword], {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: compact ? '11px' : '12px',
          color: '#c9bde0',
          lineSpacing: 2,
          wordWrap: { width: opts.width - pad * 2 },
        })
        .setOrigin(0, 0),
    );
  });
}
