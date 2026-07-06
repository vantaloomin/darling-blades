import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { ECONOMY } from '../config/rules';
import { CARD_DB } from '../data/catalog';
import { STARTER_DECKS } from '../data/starterDecks';
import { def } from '../engine/types';
import { addCard } from '../meta/Collection';
import { Services } from '../meta/services';
import { PLAIN_VARIANT } from '../meta/variants';
import { IS_DEV } from '../platform/env';
import { bindTapButton, inflateHitArea } from '../platform/gestures';
import { ModalGuard } from '../ui/Modal';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { VERSION_LABEL } from '../version';

const MENU_ITEMS: { label: string; scene?: string; data?: object }[] = [
  { label: 'Avatar Gauntlet', scene: 'Gauntlet' },
  { label: 'Practice — Easy', scene: 'Duel', data: { difficulty: 'easy' } },
  { label: 'Practice — Medium', scene: 'Duel', data: { difficulty: 'medium' } },
  { label: 'Practice — Hard', scene: 'Duel', data: { difficulty: 'hard' } },
  { label: 'Open Packs', scene: 'Shop' },
  { label: 'Collection', scene: 'Collection' },
  { label: 'Deck Builder', scene: 'DeckBuilder' },
  { label: 'Card Showcase', scene: 'Showcase' },
];

export class MainMenuScene extends Phaser.Scene {
  private menuItems: Phaser.GameObjects.Text[] = [];
  private guard = new ModalGuard();

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.menuItems = [];
    this.guard = new ModalGuard();
    // Design-space constants, NOT this.scale (= game size = 1280k×720k under
    // render scale; the camera shows the 1280×720 design window — see
    // src/platform/renderScale.ts). Identical at k=1.
    const width = 1280;

    // Backdrop first so all UI renders above it (docs/scene-art.md §3). No
    // real art → the scene keeps its bare #0d0a14 clear colour (the canvas
    // backgroundColor); today's look is unchanged.
    applyBackdrop(this, 'mainmenu', {
      dim: 0x0d0a14,
      // 0.50, raised from the 0.35 starting point (2026-07-03): the generated
      // vista's horizon glow reaches the bottom menu items; 0.35 left the
      // central column at ~35% luminance vs the ≤28% cap (scene-art.md §2).
      dimAlpha: 0.5,
      fallback: () => {
        /* scene had no background of its own — the #0d0a14 clear shows */
      },
    });

    // One tick/click for every interactive object; rapid duplicates dedupe in
    // Sfx. Hover SFX is mouse-only — touch fires pointerover on finger-down
    // and must stay silent (mobile-lan-plan §1.3).
    this.input.on('gameobjectover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    this.add
      .text(width / 2, 140, 'Darling Blades', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '72px',
        color: '#f0e6ff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 205, 'Three Kingdoms · Olympus · The Wilds', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        color: '#8f83a8',
      })
      .setOrigin(0.5);

    this.add
      .text(width - 30, 30, `🪙 ${Services.save.data.gold}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        fontStyle: '600',
        color: '#ffd88a',
      })
      .setOrigin(1, 0.5);

    // Settings entry: a gear under the gold counter (the 8-row menu list is
    // full). The gold text above is non-interactive, so the 90px inflated hit
    // rect has no interactive neighbor to collide with. It joins menuItems so
    // the starter-picker ModalGuard disables it too. (The old VolumeControl
    // widget is gone — SettingsScene owns all audio controls now.)
    const gear = this.add
      .text(width - 30, 82, '⚙ Settings', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        color: '#c9bde0',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    gear.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) gear.setColor('#ffd700');
    });
    gear.on('pointerout', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) gear.setColor('#c9bde0');
    });
    bindTapButton(this, gear, () => this.scene.start('Settings'));
    inflateHitArea(gear, 90, 90);
    this.menuItems.push(gear);

    // Profile entry: top-left corner, balancing the top-right gold+gear cluster.
    // Like the gear, it lives in the corner because the 8-row menu list is full;
    // joins menuItems so the starter-picker ModalGuard disables it too.
    const profile = this.add
      .text(30, 30, '👤 Profile', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '20px',
        color: '#c9bde0',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    profile.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) profile.setColor('#ffd700');
    });
    profile.on('pointerout', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) profile.setColor('#c9bde0');
    });
    bindTapButton(this, profile, () => this.scene.start('Profile'));
    inflateHitArea(profile, 90, 90);
    this.menuItems.push(profile);

    // Card Showcase is a variant-QA surface — dev/local builds only (IS_DEV);
    // filtering (not hiding) keeps the row layout gap-free on the public build.
    const items = MENU_ITEMS.filter((entry) => entry.scene !== 'Showcase' || IS_DEV);
    items.forEach((entry, i) => {
      const item = this.add
        .text(width / 2, 300 + i * 56, entry.label, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '29px',
          color: '#c9bde0',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      item.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) item.setColor('#ffd700');
      });
      item.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) item.setColor('#c9bde0');
      });
      if (entry.scene) {
        bindTapButton(this, item, () => this.scene.start(entry.scene!, entry.data));
      }
      // Hit boxes fill the full 56px row pitch (the audited 15px dead gaps
      // between rows are the fix column's target — plan §1.4).
      inflateHitArea(item, 90, 56);
      this.menuItems.push(item);
    });

    // Build identity, bottom-left corner (non-interactive, low-contrast). The
    // Settings screen hosts the on-demand "Check for updates" action.
    this.add.text(14, 702, VERSION_LABEL, {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      color: '#6a6482',
    });

    if (Services.save.data.starterChosen === null) this.showStarterPicker();
  }

  private showStarterPicker(): void {
    // Design-space constants (see create()) — the full-screen dim rect must
    // cover the design window the camera shows, not the k-scaled canvas.
    const width = 1280;
    const height = 720;
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(width / 2, height / 2, width, height, 0x0a0812, 0.92).setInteractive());
    c.add(
      this.add
        .text(width / 2, 130, 'Choose your starter deck', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '38px',
          color: '#f0e6ff',
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(width / 2, 180, `Your deck is free — and ${ECONOMY.startingGold} gold to get you started.`, {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '16px',
          color: '#8f83a8',
        })
        .setOrigin(0.5),
    );

    // Five panels in one row: 4×245 span + 230 width = 1210px inside the
    // 1280px design width (340px spacing only fits three).
    const panelW = 230;
    const spacing = 245;
    STARTER_DECKS.forEach((deck, i) => {
      const x = width / 2 - ((STARTER_DECKS.length - 1) * spacing) / 2 + i * spacing;
      const panel = this.add
        .rectangle(x, 400, panelW, 320, 0x241d3a, 1)
        .setStrokeStyle(3, 0x8a6d1f)
        .setInteractive({ useHandCursor: true });
      const title = this.add
        .text(x, 300, deck.name, {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '22px',
          color: '#ffd88a',
          align: 'center',
          wordWrap: { width: panelW - 20 },
        })
        .setOrigin(0.5);
      // headline cards (short names — up to the epithet comma — to fit the panel)
      const nonlands = [...new Set(deck.cards.filter((id) => !def(CARD_DB, id).types.includes('land')))];
      const preview = nonlands
        .slice(0, 6)
        .map((id) => def(CARD_DB, id).name.split(',')[0])
        .join('\n');
      const body = this.add
        .text(x, 430, preview + '\n…', {
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: '13px',
          color: '#c9bde0',
          align: 'center',
        })
        .setOrigin(0.5);
      c.add([panel, title, body]);
      panel.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) panel.setStrokeStyle(3, 0xffd700);
      });
      panel.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) panel.setStrokeStyle(3, 0x8a6d1f);
      });
      // 230×320 panels already dwarf the 90px minimum; tap-classified so a
      // stray drag can't pick a starter (it's a one-shot decision).
      bindTapButton(this, panel, () => {
        this.grantStarter(deck.id);
        this.scene.restart();
      });
    });
    // picker only closes via scene.restart(), which rebuilds the menu fresh
    this.guard.open(this.menuItems);
  }

  private grantStarter(deckId: string): void {
    const deck = STARTER_DECKS.find((d) => d.id === deckId)!;
    const save = Services.save.data;
    const counts = new Map<string, number>();
    for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, n] of counts) {
      if (def(CARD_DB, id).supertypes?.includes('basic')) continue; // basics are free
      // Grant PLAIN copies via the variant-aware API (seeds collectionVariants
      // too); top up to the deck's count, never removing copies already owned.
      const have = save.collection[id] ?? 0;
      for (let i = have; i < n; i++) addCard(save, CARD_DB, id, PLAIN_VARIANT);
    }
    save.decks.push({ id: deck.id, name: deck.name, cards: [...deck.cards] });
    save.activeDeckId = deck.id;
    save.starterChosen = deck.id;
    save.gold += ECONOMY.startingGold;
    Services.save.flush();
  }
}
