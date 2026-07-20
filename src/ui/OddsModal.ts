import Phaser from 'phaser';
import { DROPS } from '../config/rules';
import { modalGuardTarget } from './Modal';
import { OverlayCoordinator } from './OverlayCoordinator';
import { measuredRowsLayout } from './layout';
import { theme } from './theme';
import { modalShell, themedButton, type ModalShell } from './themeWidgets';

export type BoosterSku = 'base' | 'ragnarok' | 'celtic-fae' | 'arthurian-court' | 'gothic-monsters';

interface PackOddsMeta {
  packName: string;
  setName: string;
}

interface OddsSection {
  heading: string;
  rows: ReadonlyArray<readonly [string, number]>;
  labelFor: (value: string) => string;
  colorFor: (value: string) => string;
}

const PACK_ODDS_META: Record<BoosterSku, PackOddsMeta> = {
  base: { packName: 'Core Set', setName: 'Core Set' },
  ragnarok: { packName: 'Ragnarök', setName: 'Ragnarök' },
  'celtic-fae': { packName: 'Silver Veil', setName: 'Celtic Fae' },
  'arthurian-court': { packName: 'Grail Oath', setName: 'Arthurian Court' },
  'gothic-monsters': { packName: 'Nocturne Manor', setName: 'Gothic Monsters' },
};

const TIER_LABELS: Record<string, string> = { c: 'C', r: 'R', sr: 'SR', ssr: 'SSR', ur: 'UR' };
const FRAME_LABELS: Record<string, string> = {
  white: 'White',
  blue: 'Blue',
  red: 'Red',
  gold: 'Gold',
  rainbow: 'Rainbow',
  black: 'Black',
};
const HOLO_LABELS: Record<string, string> = {
  none: 'None',
  shiny: 'Shiny',
  rainbow: 'Rainbow',
  pearlescent: 'Pearlescent',
  fractal: 'Fractal',
  void: 'Void',
};
const FULL_ART_LABELS: Record<string, string> = { 'full-art': 'Full Art' };

const cap = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
const percent = (weight: number): string => `${weight}%`;

/** Build the shared, SKU-parameterized odds disclosure used by every booster plate. */
export function createOddsModal(
  scene: Phaser.Scene,
  coordinator: OverlayCoordinator,
  sku: BoosterSku,
  pool: { poolSize: number; ownedDistinct: number },
  guardTargets: readonly Phaser.GameObjects.GameObject[],
  onClose: () => void,
): ModalShell {
  const meta = PACK_ODDS_META[sku];
  const sections: readonly OddsSection[] = [
    {
      heading: 'RARITY',
      rows: DROPS.tier,
      labelFor: (value) => TIER_LABELS[value] ?? value,
      colorFor: (value) => theme.rarity[value as keyof typeof theme.rarity] ?? theme.colors.body,
    },
    {
      heading: 'FRAME',
      rows: DROPS.frame,
      labelFor: (value) => FRAME_LABELS[value] ?? cap(value),
      colorFor: () => theme.colors.body,
    },
    {
      heading: 'HOLO FINISH',
      rows: DROPS.holo,
      labelFor: (value) => HOLO_LABELS[value] ?? cap(value),
      colorFor: () => theme.colors.body,
    },
    {
      heading: 'FULL ART',
      rows: DROPS.fullArt.filter(([value]) => value === 'full-art'),
      labelFor: (value) => FULL_ART_LABELS[value] ?? cap(value),
      colorFor: () => theme.colors.body,
    },
  ];
  const rowHeight = theme.space(5);
  const columnGap = theme.space(3);
  const shell = modalShell(scene, {
    width: 860,
    height: 520,
    dimAlpha: 0.52,
    depth: theme.depth.modal,
    showClose: false,
    tapDimToClose: true,
    escToClose: false,
    coordinator,
    registration: {
      dismissible: true,
      guardTargets: guardTargets.map(modalGuardTarget),
    },
    onClose,
  });

  const content = shell.tracks.contentBounds;
  const container = shell.container;
  const titleTrack = shell.tracks.titleTrack;
  container.add(
    scene.add
      .text(titleTrack.x + titleTrack.width / 2, titleTrack.y + titleTrack.height / 2, `${meta.packName} Drop Rates`, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h1}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0.5),
  );

  const lead = scene.add
    .text(content.x, content.y, 'Per card. Each slot rolls rarity, frame, holo finish, and Full Art independently.', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.body}px`,
      color: theme.colors.body,
      wordWrap: { width: content.width },
    })
    .setOrigin(0, 0);
  // Pool-first summary band: rates are global, the pool is what differs.
  const poolLine = scene.add
    .text(
      content.x,
      content.y + lead.height + theme.space(1),
      `Pool: ${pool.poolSize} cards · You own ${pool.ownedDistinct} of ${pool.poolSize}`,
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
        wordWrap: { width: content.width },
      },
    )
    .setOrigin(0, 0);
  const source = scene.add
    .text(
      content.x,
      poolLine.y + poolLine.height + theme.space(1),
      sku === 'base'
        ? 'Drop rates are the same in every booster. This pack pulls from every set.'
        : `Drop rates are the same in every booster. This pack pulls only ${meta.setName} cards.`,
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
        wordWrap: { width: content.width },
      },
    )
    .setOrigin(0, 0);
  container.add([lead, poolLine, source]);

  const sectionTop = source.y + source.height + theme.space(3);
  const columnWidth = (content.width - columnGap * (sections.length - 1)) / sections.length;
  const sectionLayouts = sections.map((section) => {
    const heading = scene.add
      .text(0, 0, section.heading, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.label}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0);
    const layout = measuredRowsLayout(
      [{ primaryHeight: heading.height, secondaryHeight: section.rows.length * rowHeight }],
      columnWidth,
      content.height,
      {
        horizontalPadding: 0,
        rowGap: 0,
        rowPadding: 0,
        textGap: theme.space(1),
        contentTopPadding: 0,
        contentBottomPadding: 0,
      },
    );
    return { section, heading, layout };
  });

  sectionLayouts.forEach(({ section, heading, layout }, column) => {
    const x = content.x + column * (columnWidth + columnGap);
    const sectionRow = layout.rows[0];
    if (!sectionRow) return;
    heading.setPosition(x, sectionTop + sectionRow.primaryY);
    container.add(heading);
    const rowTop = sectionTop + sectionRow.secondaryY;
    section.rows.forEach(([value, weight], index) => {
      const y = rowTop + index * rowHeight;
      const band = scene.add.graphics();
      band.fillStyle(theme.graphics.rowFill, theme.alpha.subtle);
      band.fillRoundedRect(x, y, columnWidth, rowHeight, theme.radius.control);
      const label = scene.add
        .text(x + theme.space(2), y + rowHeight / 2, section.labelFor(value), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: section.colorFor(value),
        })
        .setOrigin(0, 0.5);
      const odds = scene.add
        .text(x + columnWidth - theme.space(2), y + rowHeight / 2, percent(weight), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.heading,
        })
        .setOrigin(1, 0.5);
      container.add([band, label, odds]);
    });
  });

  const tallestSection = Math.max(...sectionLayouts.map(({ layout }) => layout.contentHeight));
  const notesTop = sectionTop + tallestSection + theme.space(3);
  const notesLabel = scene.add
    .text(content.x, notesTop, 'NOTES', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.label}px`,
      fontStyle: theme.weight.w700,
      color: theme.colors.gold,
    })
    .setOrigin(0, 0);
  const noteOne = scene.add
    .text(content.x, notesTop + notesLabel.height + theme.space(1), 'SR, SSR, and UR slots only roll cards you own fewer than 4 copies of, until the whole tier is complete.', {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.type.caption}px`,
      color: theme.colors.muted,
      wordWrap: { width: content.width },
    })
    .setOrigin(0, 0);
  const noteTwo = scene.add
    .text(
      content.x,
      noteOne.y + noteOne.height + theme.space(1),
      'If a set has no cards in a rolled tier, the slot falls back to the next lower tier.',
      {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
        wordWrap: { width: content.width },
      },
    )
    .setOrigin(0, 0);
  container.add([notesLabel, noteOne, noteTwo]);

  const footer = shell.tracks.footerTrack;
  const close = themedButton(scene, footer.x + footer.width - theme.space(15), footer.y + footer.height / 2, 'Close', {
    variant: 'ghost',
    minWidth: 90,
    onTap: () => shell.close(),
  });
  container.add(close.container);
  shell.interactiveChildren.push(close.inputZone);
  return shell;
}
