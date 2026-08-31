import Phaser from 'phaser';
import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import {
  GLOSSARY_SECTIONS,
  sectionOfTerm,
  termMatchesQuery,
  type GlossaryIcon,
  type GlossarySection,
  type GlossarySectionId,
  type GlossaryTerm,
} from '../data/glossary';
import { bakeCardFrames } from '../ui/CardFrameFactory';
import { CARD_TYPE_ICON_KEY, KEYWORD_ICON_KEY, MECHANIC_ICON_KEY, PHASE_ICON_KEY, bakeKeywordIcons } from '../ui/KeywordIcons';
import {
  glossaryFrame,
  glossaryRowsLayout,
  scrollOffsetByDelta,
  type GlossaryFrame,
  type GlossaryRowsLayout,
} from '../ui/layout';
import { bakeManaSymbols } from '../ui/ManaSymbols';
import { applyBackdrop } from '../ui/SceneBackdrop';
import { createSearchInput, type SearchInputHandle } from '../ui/SearchInput';
import { colorInt, theme } from '../ui/theme';
import { backButton, panel, registerSceneBackNavigation } from '../ui/themeWidgets';
import { backLabelFor, type BackDestination } from '../ui/navigation';

/** `null` is the cross-section results view; anything else is one tab. */
type ActiveTab = GlossarySectionId | null;

interface GlossaryRow {
  term: GlossaryTerm;
  section: GlossarySection;
}

export interface GlossarySceneData {
  /** Term name to select and scroll into view, e.g. 'Darlings'. */
  focus?: string;
  /** Where the back affordance returns to; defaults to the Main Menu. */
  returnTo?: { scene: BackDestination; data?: object };
}

const ALL_TAB_LABEL = 'All Terms';

/**
 * The permanent rules reference, opened from the Main Menu and deep-linked
 * from the tutorial cards.
 *
 * Every term comes from `src/data/glossary.ts` and every position comes from
 * `glossaryFrame` / `glossaryRowsLayout`, so adding a keyword is a one-line
 * data edit: the rail count, the list, and the search index all follow, and
 * nothing can collide with a heading the way the old fixed-coordinate page did
 * once Combat Traits outgrew its band.
 */
export class GlossaryScene extends Phaser.Scene {
  private focus: string | null = null;
  private returnTo: { scene: BackDestination; data?: object } = { scene: 'MainMenu' };

  private frame!: GlossaryFrame;
  private activeTab: ActiveTab = 'combat';
  private query = '';
  private scrollOffset = 0;
  private layout: GlossaryRowsLayout | null = null;

  private searchInput: SearchInputHandle | null = null;
  private railRows: { id: ActiveTab; plate: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; count: Phaser.GameObjects.Text }[] = [];
  private heading: Phaser.GameObjects.Text | null = null;
  private note: Phaser.GameObjects.Text | null = null;
  private emptyNotice: Phaser.GameObjects.Text | null = null;
  private listContent: Phaser.GameObjects.Container | null = null;
  private listMask: Phaser.GameObjects.Graphics | null = null;
  private scrollTrack: Phaser.GameObjects.Graphics | null = null;
  private scrollThumb: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super('Glossary');
  }

  init(data: GlossarySceneData = {}): void {
    this.focus = data.focus ?? null;
    this.returnTo = data.returnTo ?? { scene: 'MainMenu' };
    this.activeTab = this.focus ? sectionOfTerm(this.focus) ?? 'combat' : 'combat';
    this.query = '';
    this.scrollOffset = 0;
    this.railRows = [];
    this.layout = null;
  }

  create(): void {
    this.frame = glossaryFrame();
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
        bg.fillRect(0, 0, theme.design.width, theme.design.height);
      },
    });
    this.input.on('gameobjectover', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) Sfx.play('hover');
    });
    this.input.on('gameobjectup', () => Sfx.play('click'));
    Music.setMood('menu');

    // Safe on restarts, and it keeps this reference scene self-sufficient if a
    // future boot flow reaches it before a card view has baked anything.
    bakeKeywordIcons(this);
    bakeManaSymbols(this);
    bakeCardFrames(this);

    this.add
      .text(theme.design.centerX, 48, 'Glossary of Terms', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.display}px`,
        color: theme.colors.heading,
      })
      .setOrigin(0.5);
    this.add
      .text(theme.design.centerX, 84, 'A field guide for every duel.', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.body}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0.5);

    const goBack = (): void => {
      this.scene.start(this.returnTo.scene, this.returnTo.data);
    };
    backButton(this, backLabelFor(this.returnTo.scene), goBack);
    registerSceneBackNavigation(this, goBack);

    panel(this, this.frame.rail.x, this.frame.rail.y, this.frame.rail.width, this.frame.rail.height);
    panel(this, this.frame.content.x, this.frame.content.y, this.frame.content.width, this.frame.content.height);

    this.buildRail();
    this.buildContentChrome();
    this.buildSearchInput();
    this.bindScrollInput();
    this.render();
  }

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  /** Rows for one tab, or every section's matches in the results view. */
  private rowsFor(tab: ActiveTab): GlossaryRow[] {
    const sections = tab === null ? GLOSSARY_SECTIONS : [GLOSSARY_SECTIONS.find((s) => s.id === tab)!];
    return sections.flatMap((section) =>
      section.terms
        .filter((term) => termMatchesQuery(term, this.query))
        .map((term) => ({ term, section })),
    );
  }

  private countFor(tab: ActiveTab): number {
    return this.rowsFor(tab).length;
  }

  private activeSection(): GlossarySection | null {
    return this.activeTab === null ? null : GLOSSARY_SECTIONS.find((s) => s.id === this.activeTab) ?? null;
  }

  // -------------------------------------------------------------------------
  // Chrome
  // -------------------------------------------------------------------------

  private buildRail(): void {
    const tabs: ActiveTab[] = [null, ...GLOSSARY_SECTIONS.map((section) => section.id)];
    tabs.forEach((id, index) => {
      const y = this.frame.railFirstRowY + index * this.frame.railRowPitch;
      const x = this.frame.rail.x + theme.space(3);
      const width = this.frame.rail.width - theme.space(6);
      const height = this.frame.railRowHeight;
      const plate = this.add.graphics();
      const label = this.add
        .text(x + theme.space(3), y + height / 2, id === null ? ALL_TAB_LABEL : this.sectionTitleFor(id), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          fontStyle: theme.weight.w600,
          color: theme.colors.body,
        })
        .setOrigin(0, 0.5);
      const count = this.add
        .text(x + width - theme.space(3), y + height / 2, '0', {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.muted,
        })
        .setOrigin(1, 0.5);
      const hit = this.add
        .zone(x + width / 2, y + height / 2, width, height)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this.activeTab === id) return;
        this.activeTab = id;
        this.scrollOffset = 0;
        this.focus = null;
        this.render();
      });
      this.railRows.push({ id, plate, label, count });
    });
  }

  private sectionTitleFor(id: GlossarySectionId): string {
    return GLOSSARY_SECTIONS.find((section) => section.id === id)!.title;
  }

  private buildContentChrome(): void {
    this.heading = this.add
      .text(this.frame.heading.x, this.frame.heading.y, '', {
        fontFamily: theme.fonts.display,
        fontSize: `${theme.type.h2}px`,
        color: theme.colors.gold,
      })
      .setOrigin(0, 0.5);
    this.note = this.add
      .text(this.frame.note.x, this.frame.note.y, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.type.caption}px`,
        color: theme.colors.muted,
      })
      .setOrigin(0, 0);
    this.add
      .graphics()
      .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
      .lineBetween(
        this.frame.content.x + theme.space(5),
        this.frame.dividerY,
        this.frame.content.x + this.frame.content.width - theme.space(5),
        this.frame.dividerY,
      );
    this.emptyNotice = this.add
      .text(
        this.frame.list.x + this.frame.list.width / 2,
        this.frame.list.y + theme.space(12),
        '',
        {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.body}px`,
          color: theme.colors.muted,
        },
      )
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.scrollTrack = this.add.graphics();
    this.scrollThumb = this.add.graphics();
  }

  private buildSearchInput(): void {
    const { search } = this.frame;
    this.searchInput = createSearchInput(this, search.x + search.width / 2, search.y + search.height / 2, {
      width: search.width,
      placeholder: 'Search terms…',
      accessibleName: 'Search glossary terms',
      onChange: (value) => {
        this.query = value;
        // A query is a request to look everywhere, not inside the tab you
        // happened to be reading; clearing it returns you to that tab.
        this.activeTab = value.trim() === '' ? this.activeTab ?? 'combat' : null;
        this.scrollOffset = 0;
        this.focus = null;
        this.render();
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.searchInput?.teardown());
  }

  // -------------------------------------------------------------------------
  // List rendering
  // -------------------------------------------------------------------------

  private render(): void {
    const section = this.activeSection();
    const rows = this.rowsFor(this.activeTab);
    this.heading?.setText(section ? section.title : this.query.trim() === '' ? ALL_TAB_LABEL : 'Search Results');
    this.note?.setText(section?.note ?? (this.query.trim() === '' ? '' : `${rows.length} matching ${rows.length === 1 ? 'term' : 'terms'}.`));
    this.renderRail();
    this.renderRows(rows, section);
  }

  private renderRail(): void {
    this.railRows.forEach((row, index) => {
      const active = row.id === this.activeTab;
      const x = this.frame.rail.x + theme.space(3);
      const width = this.frame.rail.width - theme.space(6);
      const y = this.frame.railFirstRowY + index * this.frame.railRowPitch;
      row.plate
        .clear()
        .fillStyle(active ? theme.graphics.rowFillActive : theme.graphics.rowFill, active ? theme.alpha.chrome : theme.alpha.subtle)
        .fillRoundedRect(x, y, width, this.frame.railRowHeight, theme.radius.control)
        .lineStyle(1, theme.graphics.panelStroke, active ? theme.alpha.chrome : theme.alpha.ghost)
        .strokeRoundedRect(x, y, width, this.frame.railRowHeight, theme.radius.control);
      row.label.setColor(active ? theme.colors.gold : theme.colors.body);
      row.count.setText(String(this.countFor(row.id)));
    });
  }

  private renderRows(rows: readonly GlossaryRow[], section: GlossarySection | null): void {
    this.listContent?.destroy(true);
    this.listContent = null;

    const showBadge = section === null;
    const hasIcons = rows.some((row) => row.term.icon.kind !== 'none');
    const { list } = this.frame;

    this.emptyNotice?.setVisible(rows.length === 0);
    if (rows.length === 0) {
      this.emptyNotice?.setText(`No term matches “${this.query.trim()}”.`);
      this.scrollTrack?.clear();
      this.scrollThumb?.clear();
      this.layout = null;
      return;
    }

    // Measure first, position second: Phaser owns text metrics, the headless
    // helper owns the geometry around them.
    const probe = glossaryRowsLayout([], list, { hasIcons, hasBadge: showBadge });
    const texts = rows.map((row) => {
      const compact = row.section.compact === true;
      const name = this.add
        .text(0, 0, row.term.name, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.label}px`,
          fontStyle: theme.weight.w700,
          color: theme.colors.heading,
          wordWrap: { width: probe.columns.nameWidth },
        })
        .setOrigin(0, 0.5);
      const description = this.add
        .text(0, 0, compact ? '' : row.term.description, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.type.caption}px`,
          color: theme.colors.body,
          lineSpacing: 2,
          wordWrap: { width: probe.columns.descriptionWidth },
        })
        .setOrigin(0, 0.5);
      return { name, description };
    });

    const layout = glossaryRowsLayout(
      texts.map(({ name, description }) => ({
        nameHeight: name.height,
        descriptionHeight: description.height,
      })),
      list,
      { hasIcons, hasBadge: showBadge },
    );
    this.layout = layout;

    const content = this.add.container(list.x, list.y);
    rows.forEach((row, index) => {
      const rect = layout.rows[index];
      const plate = this.add.graphics();
      plate
        .fillStyle(theme.graphics.rowFill, theme.alpha.subtle)
        .fillRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.control)
        .lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
        .strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.control);
      content.add(plate);

      const icon = this.iconImage(row.term.icon, layout.columns.iconX, rect.centerY);
      if (icon) content.add(icon);

      const { name, description } = texts[index];
      name.setPosition(layout.columns.nameX, rect.centerY);
      description.setPosition(layout.columns.descriptionX, rect.centerY);
      content.add([name, description]);

      // The compact sections (mana, rarity) carry their letter code where the
      // longer sections carry their reminder copy.
      if (row.section.compact && row.term.shortLabel) {
        content.add(
          this.add
            .text(layout.columns.descriptionX, rect.centerY, row.term.shortLabel, {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.caption}px`,
              color: theme.colors.muted,
            })
            .setOrigin(0, 0.5),
        );
      }
      if (showBadge) {
        content.add(
          this.add
            .text(layout.columns.badgeX, rect.centerY, row.section.title, {
              fontFamily: theme.fonts.ui,
              fontSize: `${theme.type.micro}px`,
              color: theme.colors.muted,
            })
            .setOrigin(1, 0.5),
        );
      }
      if (this.focus && row.term.name === this.focus) {
        plate
          .lineStyle(2, colorInt(theme.colors.gold), theme.alpha.chrome)
          .strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, theme.radius.control);
        this.scrollOffset = Math.min(layout.maxScroll, Math.max(0, rect.y - theme.space(4)));
      }
    });

    // The mask must NOT be parented to the container it clips: the container is
    // what moves when the list scrolls, and a child mask would scroll with it
    // and clip nothing. It is a scene-level child with its own lifetime.
    this.listMask?.destroy();
    this.listMask = this.add
      .graphics()
      .fillStyle(theme.graphics.panelFill, 1)
      .fillRect(list.x, list.y, list.width, list.height)
      .setVisible(false);
    content.setMask(this.listMask.createGeometryMask());
    this.listContent = content;

    this.setScroll(this.scrollOffset);
  }

  private iconImage(icon: GlossaryIcon, x: number, y: number): Phaser.GameObjects.Image | null {
    switch (icon.kind) {
      case 'keyword':
        return this.add.image(x, y, KEYWORD_ICON_KEY[icon.key]).setDisplaySize(30, 30);
      case 'mechanic':
        return this.add.image(x, y, MECHANIC_ICON_KEY[icon.key]).setDisplaySize(30, 30);
      case 'phase':
        return this.add.image(x, y, PHASE_ICON_KEY[icon.key]).setDisplaySize(30, 30);
      case 'type':
        return this.add.image(x, y, CARD_TYPE_ICON_KEY[icon.key]).setDisplaySize(30, 30);
      case 'mana':
        return this.add.image(x, y, `pip-${icon.key}`).setDisplaySize(26, 26);
      case 'rarity':
        // Base-set symbol in the tier tint, matching what card faces show.
        return this.add.image(x, y, `seticon-base-${icon.key}`).setDisplaySize(26, 26);
      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // Scrolling
  // -------------------------------------------------------------------------

  private bindScrollInput(): void {
    const { list } = this.frame;
    const zone = this.add
      .zone(list.x + list.width / 2, list.y + list.height / 2, list.width, list.height)
      .setInteractive();
    zone.on('wheel', (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => {
      this.setScroll(this.scrollOffset + dy);
    });

    let dragging = false;
    let dragPointerId: number | null = null;
    let dragStartY = 0;
    let dragStartOffset = 0;
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      dragging = true;
      dragPointerId = pointer.id;
      dragStartY = pointer.worldY;
      dragStartOffset = this.scrollOffset;
    });
    const moveDrag = (pointer: Phaser.Input.Pointer): void => {
      if (!dragging || dragPointerId !== pointer.id) return;
      this.setScroll(dragStartOffset - (pointer.worldY - dragStartY));
    };
    const endDrag = (pointer: Phaser.Input.Pointer): void => {
      if (dragPointerId === pointer.id) {
        dragging = false;
        dragPointerId = null;
      }
    };
    this.input.on('pointermove', moveDrag);
    this.input.on('pointerup', endDrag);

    // Arrow keys scroll the list, but only when the DOM search field does not
    // own the caret; otherwise Home/End would fight the text cursor.
    const onKey = (event: KeyboardEvent): void => {
      if (this.searchInput && document.activeElement === this.searchInput.inputElement) return;
      const step = theme.space(14);
      if (event.key === 'ArrowDown') this.setScroll(this.scrollOffset + step);
      else if (event.key === 'ArrowUp') this.setScroll(this.scrollOffset - step);
      else if (event.key === 'PageDown') this.setScroll(this.scrollOffset + this.frame.list.height);
      else if (event.key === 'PageUp') this.setScroll(this.scrollOffset - this.frame.list.height);
      else return;
      event.preventDefault();
    };
    this.input.keyboard?.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove', moveDrag);
      this.input.off('pointerup', endDrag);
      this.input.keyboard?.off('keydown', onKey);
    });
  }

  private setScroll(next: number): void {
    const maxScroll = this.layout?.maxScroll ?? 0;
    this.scrollOffset = scrollOffsetByDelta(0, next, maxScroll);
    this.listContent?.setPosition(this.frame.list.x, this.frame.list.y - this.scrollOffset);
    this.redrawScrollbar();
  }

  private redrawScrollbar(): void {
    const { list } = this.frame;
    const layout = this.layout;
    this.scrollTrack?.clear();
    this.scrollThumb?.clear();
    if (!layout || layout.maxScroll <= 0 || !this.scrollTrack || !this.scrollThumb) return;
    const railX = list.x + list.width - theme.space(2);
    const thumbHeight = Math.max(
      theme.space(8),
      list.height * (list.height / Math.max(list.height, layout.contentHeight)),
    );
    const thumbY = list.y + (this.scrollOffset / layout.maxScroll) * Math.max(0, list.height - thumbHeight);
    this.scrollTrack
      .fillStyle(theme.graphics.panelStroke, theme.alpha.subtle)
      .fillRoundedRect(railX, list.y, theme.space(0.5), list.height, theme.radius.control);
    this.scrollThumb
      .fillStyle(theme.graphics.rowFillActive, theme.alpha.chrome)
      .fillRoundedRect(railX - theme.space(0.5), thumbY, theme.space(1.5), thumbHeight, theme.radius.control);
  }
}
