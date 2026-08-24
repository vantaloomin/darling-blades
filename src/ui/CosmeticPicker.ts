import Phaser from 'phaser';
import {
  CARD_BACKS,
  DEFAULT_CARD_BACK_ID,
  DEFAULT_PLAYMAT_ID,
  PLAYMATS,
  cardBackTextureKey,
  isCosmeticOwned,
  type CardBackDefinition,
  type PlaymatDefinition,
} from '../meta/cosmetics';
import { modalShell, themedButton, type ModalShell } from './themeWidgets';
import { modalGuardTarget } from './Modal';
import type { OverlayCoordinator } from './OverlayCoordinator';
import { theme } from './theme';

/**
 * The card-back / playmat chooser.
 *
 * It lived inside ProfileScene until 2026-08-24, when style became a property
 * of the deck (save v33) and the chooser had to open from the Deck Builder
 * instead. It takes the current value and an equip callback rather than
 * reading and writing `save.cosmetics` itself, so the same modal serves an
 * account-level setting and a per-deck one without knowing which it is.
 */

export type CosmeticKind = 'cardBack' | 'playmat';

export interface CosmeticPickerOptions {
  kind: CosmeticKind;
  /** Currently equipped id, or null for the catalog default. */
  currentId: string | null;
  /** Non-default ids the player has earned. */
  owned: readonly string[];
  /** Called with the chosen id; the caller persists it and may re-render. */
  onEquip: (id: string) => void;
  /** Optional heading override; defaults to the kind's name. */
  title?: string;
  subtitle?: string;
  coordinator?: OverlayCoordinator;
  guardTargets?: readonly Phaser.GameObjects.GameObject[];
  onClose?: () => void;
}

/** Texture keys are game-global, so a lightweight probe may reach a scene before the bake. */
export function safeCardBackTexture(scene: Phaser.Scene, entry: CardBackDefinition): string {
  const key = cardBackTextureKey(entry.id);
  return scene.textures.exists(key) ? key : 'cardback';
}

/** A miniature of the duel stage: backdrop, both zones, and the stage light. */
export function paintPlaymatSwatch(
  target: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  playmat: PlaymatDefinition,
  width: number,
  height: number,
): void {
  const colors = playmat.colors;
  target.clear();
  target.fillStyle(colors.backdrop.tint, 1);
  target.fillRoundedRect(x - width / 2, y - height / 2, width, height, 4);
  target.fillStyle(colors.opponentZone.fill, 0.9);
  target.fillRoundedRect(x - width / 2 + 2, y - height / 2 + 2, width - 4, height / 2 - 2, 2);
  target.fillStyle(colors.playerZone.fill, 0.95);
  target.fillRoundedRect(x - width / 2 + 2, y + 1, width - 4, height / 2 - 3, 2);
  target.fillStyle(colors.stageLight, Math.min(1, colors.stageLightAlpha + 0.22));
  target.fillEllipse(x, y, width * 0.5, height * 0.7);
  target.lineStyle(1, colors.zoneStroke, colors.zoneStrokeAlpha);
  target.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 4);
}

export function defaultIdFor(kind: CosmeticKind): string {
  return kind === 'cardBack' ? DEFAULT_CARD_BACK_ID : DEFAULT_PLAYMAT_ID;
}

export function openCosmeticPicker(scene: Phaser.Scene, opts: CosmeticPickerOptions): ModalShell {
  const entries: readonly (CardBackDefinition | PlaymatDefinition)[] =
    opts.kind === 'cardBack' ? CARD_BACKS : PLAYMATS;
  const shell = modalShell(scene, {
    width: 1120,
    // Sized so contentBounds leaves the plate its natural height:
    // contentBounds.height == height - 168 (24x2 padding, 44 title, 44 footer,
    // two 16 track gaps), and the grid takes that less the subtitle band. 596
    // lands the plate at ~392 and keeps Equip off the floor.
    height: 596,
    dimAlpha: 0.86,
    depth: theme.depth.modal,
    dismissal: 'dismissible',
    coordinator: opts.coordinator,
    registration: {
      dismissible: true,
      guardTargets: (opts.guardTargets ?? []).map(modalGuardTarget),
    },
    onClose: opts.onClose,
  });

  // Laid out from the shell's OWN tracks. An earlier version hardcoded the
  // title at y=92 (above the panel's padded inner edge, so it collided with the
  // dimmed heading behind it) and the plate grid at `132 + i * 220`, which
  // centred five plates on x=572 inside a panel centred on 640.
  const content = shell.contentBounds;
  const titleTrack = shell.tracks.titleTrack;
  const panelCenterX = content.x + content.width / 2;
  shell.container.add([
    scene.add
      .text(
        panelCenterX,
        titleTrack.y + titleTrack.height / 2,
        opts.title ?? (opts.kind === 'cardBack' ? 'Card back' : 'Playmat'),
        {
          fontFamily: theme.fonts.display,
          fontSize: `${theme.type.h1}px`,
          color: theme.colors.gold,
        },
      )
      .setOrigin(0.5),
    scene.add
      .text(
        panelCenterX,
        content.y + theme.space(3),
        opts.subtitle ?? 'Choose a style. Courts can add earned rewards later.',
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        },
      )
      .setOrigin(0.5, 0),
  ]);

  const gridTop = content.y + theme.space(9);
  const gridHeight = content.y + content.height - gridTop;
  const gap = theme.space(5);
  const plateW = Math.floor((content.width - gap * (entries.length - 1)) / entries.length);
  const step = plateW + gap;
  const firstCenter = content.x + plateW / 2;
  // ONE shared equipped id for the whole grid. Per-plate copies would each be
  // reset from the opts value captured at open time, undoing the equip that
  // just happened.
  let equippedId = opts.currentId ?? defaultIdFor(opts.kind);
  const refreshers: (() => void)[] = [];

  entries.forEach((entry, index) => {
    const x = firstCenter + index * step;
    const plate = scene.add.graphics();
    plate.fillStyle(theme.graphics.rowFill, theme.alpha.panel);
    plate.fillRoundedRect(x - plateW / 2, gridTop, plateW, gridHeight, theme.radius.control);
    plate.lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome);
    plate.strokeRoundedRect(x - plateW / 2, gridTop, plateW, gridHeight, theme.radius.control);
    shell.container.add(plate);

    if (opts.kind === 'cardBack') {
      shell.container.add(
        scene.add
          .image(x, gridTop + theme.space(21), safeCardBackTexture(scene, entry as CardBackDefinition))
          .setDisplaySize(62, 87),
      );
    } else {
      const swatch = scene.add.graphics();
      paintPlaymatSwatch(swatch, x, gridTop + theme.space(21), entry as PlaymatDefinition, 154, 84);
      shell.container.add(swatch);
    }

    shell.container.add([
      scene.add
        .text(x, gridTop + theme.space(38), entry.name, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.heading,
          wordWrap: { width: plateW - theme.space(4) },
          align: 'center',
        })
        .setOrigin(0.5, 0),
      scene.add
        .text(x, gridTop + theme.space(47.5), entry.blurb, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          color: theme.colors.muted,
          wordWrap: { width: plateW - theme.space(6) },
          align: 'center',
          lineSpacing: 2,
        })
        .setOrigin(0.5, 0),
    ]);
    const tag = scene.add
      .text(x, gridTop + theme.space(67), '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.success,
      })
      .setOrigin(0.5);
    shell.container.add(tag);

    const button = themedButton(scene, x, gridTop + gridHeight - theme.space(11), 'Equip', {
      variant: 'ghost',
      size: 'sm',
      minWidth: Math.min(132, plateW - theme.space(8)),
      onTap: () => {
        if (!isCosmeticOwned(entry.id, opts.owned)) return;
        opts.onEquip(entry.id);
        equippedId = entry.id;
        for (const refresh of refreshers) refresh();
      },
    });
    shell.container.add(button.container);

    const refresh = (): void => {
      const owned = isCosmeticOwned(entry.id, opts.owned);
      const equipped = equippedId === entry.id;
      tag.setText(equipped ? 'EQUIPPED' : owned ? '' : 'LOCKED');
      tag.setColor(equipped ? theme.colors.success : theme.colors.danger);
      button.setVariant(equipped ? 'primary' : 'ghost');
      button.setLabel(owned ? (equipped ? 'Equipped' : 'Equip') : 'Locked');
      button.setEnabled(owned);
    };
    refreshers.push(refresh);
    refresh();
  });

  return shell;
}
