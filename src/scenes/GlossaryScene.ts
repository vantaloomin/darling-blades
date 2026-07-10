import Phaser from 'phaser';
import type { Color, Keyword, Rarity } from '../engine/types';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { bakeCardFrames } from '../ui/CardFrameFactory';
import { KEYWORD_ICON_KEY, bakeKeywordIcons } from '../ui/KeywordIcons';
import { bakeManaSymbols } from '../ui/ManaSymbols';
import { CARD_TYPE_DEFINITIONS, KEYWORD_NAMES, KEYWORD_REMINDER } from '../ui/rulesText';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { colorInt, theme } from '../ui/theme';
import { backButton, panel } from '../ui/themeWidgets';

const DESIGN_W = 1280;
const DESIGN_H = 720;
const PANEL_Y = 112;
const PANEL_H = 572;
const LEFT_X = 48;
const RIGHT_X = 664;
const PANEL_W = 568;

type GlossaryIcon =
  | { kind: 'keyword'; key: Keyword }
  | { kind: 'mana'; key: Color }
  | { kind: 'rarity'; key: Rarity }
  | { kind: 'none' };

interface GlossaryEntry {
  name: string;
  description?: string;
  shortLabel?: string;
  icon: GlossaryIcon;
}

interface GlossarySection {
  id: 'combat' | 'types' | 'mana' | 'rarity';
  title: string;
  entries: GlossaryEntry[];
}

/**
 * The scene is deliberately data-driven: adding the next rules term is a
 * single entry here (or, for card types and traits, in its shared copy table).
 */
const GLOSSARY_SECTIONS: GlossarySection[] = [
  {
    id: 'combat',
    title: 'Combat Traits',
    entries: (Object.keys(KEYWORD_NAMES) as Keyword[]).map((keyword) => ({
      name: KEYWORD_NAMES[keyword],
      description: KEYWORD_REMINDER[keyword],
      icon: { kind: 'keyword', key: keyword },
    })),
  },
  {
    id: 'types',
    title: 'Card Types',
    entries: [
      { name: 'Creature', description: CARD_TYPE_DEFINITIONS.creature, icon: { kind: 'none' } },
      { name: 'Charm', description: CARD_TYPE_DEFINITIONS.charm, icon: { kind: 'none' } },
      { name: 'Ritual', description: CARD_TYPE_DEFINITIONS.ritual, icon: { kind: 'none' } },
      { name: 'Enchantment', description: CARD_TYPE_DEFINITIONS.enchantment, icon: { kind: 'none' } },
      { name: 'Artifact', description: CARD_TYPE_DEFINITIONS.artifact, icon: { kind: 'none' } },
      { name: 'Land', description: CARD_TYPE_DEFINITIONS.land, icon: { kind: 'none' } },
    ],
  },
  {
    id: 'mana',
    title: 'Mana Colors',
    entries: [
      { name: 'White', shortLabel: 'W', icon: { kind: 'mana', key: 'W' } },
      { name: 'Blue', shortLabel: 'U', icon: { kind: 'mana', key: 'U' } },
      { name: 'Black', shortLabel: 'B', icon: { kind: 'mana', key: 'B' } },
      { name: 'Red', shortLabel: 'R', icon: { kind: 'mana', key: 'R' } },
      { name: 'Green', shortLabel: 'G', icon: { kind: 'mana', key: 'G' } },
    ],
  },
  {
    id: 'rarity',
    title: 'Rarity Tiers',
    entries: [
      { name: 'Common', shortLabel: 'C', icon: { kind: 'rarity', key: 'c' } },
      { name: 'Rare', shortLabel: 'R', icon: { kind: 'rarity', key: 'r' } },
      { name: 'Super Rare', shortLabel: 'SR', icon: { kind: 'rarity', key: 'sr' } },
      { name: 'Super Special Rare', shortLabel: 'SSR', icon: { kind: 'rarity', key: 'ssr' } },
      { name: 'Ultra Rare', shortLabel: 'UR', icon: { kind: 'rarity', key: 'ur' } },
    ],
  },
];

function section(id: GlossarySection['id']): GlossarySection {
  const found = GLOSSARY_SECTIONS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing glossary section: ${id}`);
  return found;
}

/** A permanent, read-only reference that players can open from the Main Menu. */
export class GlossaryScene extends Phaser.Scene {
  constructor() {
    super('Glossary');
  }

  create(): void {
    applyBackdrop(this, 'mainmenu', {
      dim: colorInt(theme.colors.dim),
      dimAlpha: 0.68,
      fallback: () => {
        const bg = this.add.graphics();
        bg.fillGradientStyle(
          theme.graphics.panelFill,
          theme.graphics.panelFill,
          theme.graphics.dim,
          theme.graphics.dim,
          1,
        );
        bg.fillRect(0, 0, DESIGN_W, DESIGN_H);
      },
    });
    this.input.on('gameobjectover', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    // These texture bakes are safe on restarts and make this reference scene
    // self-sufficient if a future boot flow reaches it before a card view does.
    bakeKeywordIcons(this);
    bakeManaSymbols(this);
    bakeCardFrames(this);

    this.add
      .text(DESIGN_W / 2, 48, 'Glossary of Terms', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(DESIGN_W / 2, 84, 'A field guide for every duel.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);
    backButton(this, () => this.scene.start('MainMenu'));

    panel(this, LEFT_X, PANEL_Y, PANEL_W, PANEL_H);
    panel(this, RIGHT_X, PANEL_Y, PANEL_W, PANEL_H);
    this.drawCombatTraits(section('combat'));
    this.drawCardTypes(section('types'));
    this.drawCompactReference(section('mana'), RIGHT_X + 20, 464, 246);
    this.drawCompactReference(section('rarity'), RIGHT_X + 302, 464, 246);
  }

  private drawCombatTraits(combat: GlossarySection): void {
    this.sectionTitle(LEFT_X + 20, 142, combat.title);
    const splitAt = Math.ceil(combat.entries.length / 2);
    const columns = [combat.entries.slice(0, splitAt), combat.entries.slice(splitAt)];
    columns.forEach((entries, column) => {
      const x = LEFT_X + (column === 0 ? 16 : 298);
      entries.forEach((entry, row) => this.drawCombatRow(entry, x, 164 + row * 74, 254));
    });
    this.add
      .text(LEFT_X + 20, 650, 'Traits appear in a creature’s rules text.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0.5);
  }

  private drawCombatRow(entry: GlossaryEntry, x: number, y: number, width: number): void {
    this.rowPlate(x, y, width, 66);
    if (entry.icon.kind === 'keyword') {
      this.add.image(x + 22, y + 33, KEYWORD_ICON_KEY[entry.icon.key]).setDisplaySize(34, 34);
    }
    this.add
      .text(x + 46, y + 15, entry.name, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        fontStyle: theme.weight.w700,
        color: theme.colors.heading,
      })
      .setOrigin(0, 0.5);
    this.add
      .text(x + 46, y + 27, entry.description ?? '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.micro}px`,
        color: theme.colors.body,
        lineSpacing: 1,
        wordWrap: { width: width - 58 },
      })
      .setOrigin(0, 0);
  }

  private drawCardTypes(types: GlossarySection): void {
    this.sectionTitle(RIGHT_X + 20, 142, types.title);
    types.entries.forEach((entry, index) => {
      const y = 166 + index * 42;
      this.rowPlate(RIGHT_X + 16, y, PANEL_W - 32, 36);
      this.add
        .text(RIGHT_X + 30, y + 18, entry.name, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.heading,
        })
        .setOrigin(0, 0.5);
      this.add
        .text(RIGHT_X + 142, y + 18, entry.description ?? '', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
    });
    this.add
      .graphics()
      .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
      .lineBetween(RIGHT_X + 20, 438, RIGHT_X + PANEL_W - 20, 438);
  }

  private drawCompactReference(sectionData: GlossarySection, x: number, y: number, width: number): void {
    this.sectionTitle(x, y - 12, sectionData.title);
    sectionData.entries.forEach((entry, index) => {
      const rowY = y + index * 36;
      this.rowPlate(x, rowY, width, 32);
      this.drawEntryIcon(entry, x + 18, rowY + 16, 26);
      this.add
        .text(x + 38, rowY + 16, entry.name, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.heading,
        })
        .setOrigin(0, 0.5);
      this.add
        .text(x + width - 12, rowY + 16, entry.shortLabel ?? '', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.micro}px`,
          color: theme.colors.muted,
        })
        .setOrigin(1, 0.5);
    });
  }

  private drawEntryIcon(entry: GlossaryEntry, x: number, y: number, size: number): void {
    if (entry.icon.kind === 'mana') {
      this.add.image(x, y, `pip-${entry.icon.key}`).setDisplaySize(size, size);
    } else if (entry.icon.kind === 'rarity') {
      this.add.image(x, y, `gem-${entry.icon.key}`).setDisplaySize(size, size);
    }
  }

  private sectionTitle(x: number, y: number, label: string): void {
    this.add
      .text(x, y, label, {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5);
  }

  private rowPlate(x: number, y: number, width: number, height: number): void {
    this.add
      .graphics()
      .fillStyle(theme.graphics.rowFill, theme.alpha.subtle)
      .fillRoundedRect(x, y, width, height, theme.radius.control)
      .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
      .strokeRoundedRect(x, y, width, height, theme.radius.control);
  }
}
