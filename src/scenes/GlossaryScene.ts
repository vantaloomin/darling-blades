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
import { applyBackdrop, sceneStage } from '../ui/SceneBackdrop';
import { COMPACT, compactShell } from '../ui/compactLayout';
import { compactHeader, COMPACT_DRAG_SLOP } from '../ui/compactWidgets';
import { GLOSSARY_COMPACT, glossaryRowColumns, glossaryTabTiles } from '../ui/glossaryCompact';
import type { Rect } from '../ui/layout';
import { bindMenuScroll } from '../ui/menuScroll';
import { bindTapButton } from '../platform/gestures';
import { sceneSubtitle, sceneTitle } from '../ui/sceneTitle';
import { createSearchInput, type SearchInputHandle } from '../ui/SearchInput';
import { colorInt, theme } from '../ui/theme';
import { backButton, panel, registerSceneBackNavigation, type ThemedButton } from '../ui/themeWidgets';
import { backLabelFor, type BackDestination } from '../ui/navigation';
import { IS_DEV } from '../platform/env';

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
  /**
   * Dev probe only (`src/dev/wave3PackGlossaryFixtures.ts`): open a rail tab
   * (`'all'` for All Terms) or a search, optionally scrolled to the list's end.
   */
  a11yFixture?: { tab?: GlossarySectionId | 'all'; query?: string; scroll?: 'end' };
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
  private fixture: GlossarySceneData['a11yFixture'] | null = null;
  private returnTo: { scene: BackDestination; data?: object } = { scene: 'MainMenu' };

  private frame!: GlossaryFrame;
  private activeTab: ActiveTab = 'combat';
  /** The tab open when the current search began; clearing the query returns to it. */
  private tabBeforeSearch: ActiveTab = 'combat';
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
  /** Edge fades on the list's clipped sides: they say there is more that way. */
  private scrollFades: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super('Glossary');
  }

  init(data: GlossarySceneData = {}): void {
    this.focus = data.focus ?? null;
    this.fixture = IS_DEV ? data.a11yFixture ?? null : null;
    this.returnTo = data.returnTo ?? { scene: 'MainMenu' };
    this.activeTab = this.focus ? sectionOfTerm(this.focus) ?? 'combat' : 'combat';
    if (this.fixture?.tab) this.activeTab = this.fixture.tab === 'all' ? null : this.fixture.tab;
    this.tabBeforeSearch = this.activeTab;
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

    if (sceneStage(this).compact) {
      this.createCompact();
      return;
    }

    sceneTitle(this, 'Glossary of Terms');
    sceneSubtitle(this, 'A field guide for every duel.', { fontSize: theme.type.body });

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
    const query = this.fixture?.query;
    if (query && this.searchInput) {
      this.searchInput.inputElement.value = query;
      this.query = query;
      this.activeTab = null;
    }
    this.render();
    if (this.fixture?.scroll === 'end') this.setScroll(this.layout?.maxScroll ?? 0);
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
        // A rail pick during a search is where clearing the query should land.
        if (this.query.trim() !== '') this.tabBeforeSearch = id;
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
    // Above the list content, which is built later on every tab change.
    this.scrollFades = this.add.graphics().setDepth(1);
    this.scrollTrack = this.add.graphics().setDepth(1);
    this.scrollThumb = this.add.graphics().setDepth(1);
  }

  private buildSearchInput(): void {
    const { search } = this.frame;
    this.searchInput = createSearchInput(this, search.x + search.width / 2, search.y + search.height / 2, {
      width: search.width,
      placeholder: 'Search terms…',
      accessibleName: 'Search glossary terms',
      onChange: (value) => {
        const searching = value.trim() !== '';
        // Remember the tab being read as the search starts. Once typing flips
        // the view to results (activeTab null), that tab was otherwise lost
        // and clearing always fell back to Combat Traits.
        if (searching && this.query.trim() === '') this.tabBeforeSearch = this.activeTab;
        this.query = value;
        // A query is a request to look everywhere, not inside the tab you
        // happened to be reading; clearing it returns you to that tab, or to
        // the tab you picked from the rail while the query was up.
        this.activeTab = searching ? null : this.activeTab ?? this.tabBeforeSearch;
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
      this.scrollFades?.clear();
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
    this.scrollFades?.clear();
    if (!layout || layout.maxScroll <= 0 || !this.scrollTrack || !this.scrollThumb) return;
    const railX = list.x + layout.railX;
    const thumbHeight = Math.max(
      theme.space(8),
      list.height * (list.height / Math.max(list.height, layout.contentHeight)),
    );
    const thumbY = list.y + (this.scrollOffset / layout.maxScroll) * Math.max(0, list.height - thumbHeight);
    const trackWidth = theme.space(1);
    const thumbWidth = theme.space(1.5);
    this.scrollTrack
      .fillStyle(theme.graphics.panelStroke, 1)
      .fillRoundedRect(railX - trackWidth / 2, list.y, trackWidth, list.height, trackWidth / 2);
    this.scrollThumb
      .fillStyle(colorInt(theme.colors.muted), 1)
      .fillRoundedRect(railX - thumbWidth / 2, thumbY, thumbWidth, thumbHeight, thumbWidth / 2);
    // A fade over whichever edge still hides rows, drawn as stepped bands of
    // the panel colour so it works on the canvas renderer too.
    const fades = this.scrollFades;
    if (!fades) return;
    const fadeHeight = theme.space(8);
    const steps = 8;
    const rowsWidth = layout.railX - theme.space(2);
    const band = (edgeY: number, direction: 1 | -1): void => {
      for (let i = 0; i < steps; i++) {
        const alpha = 0.85 * (1 - i / steps);
        const y = direction === 1 ? edgeY + (i * fadeHeight) / steps : edgeY - ((i + 1) * fadeHeight) / steps;
        fades.fillStyle(theme.graphics.panelFill, alpha).fillRect(list.x, y, rowsWidth, fadeHeight / steps);
      }
    };
    if (this.scrollOffset > 0) band(list.y, 1);
    if (this.scrollOffset < layout.maxScroll) band(list.y + list.height, -1);
  }

  // -------------------------------------------------------------------------
  // Phones
  // -------------------------------------------------------------------------

  /** The compact composition's main pane, rebuilt on every tab or search change. */
  private compactMain: Phaser.GameObjects.Container | null = null;
  private compactTiles: { id: ActiveTab; rect: Rect; plate: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; count: Phaser.GameObjects.Text }[] = [];

  /**
   * The phone composition (mocks M-Glossary, M-GlossaryEntry,
   * M-GlossarySearch): the open tab's terms scrolling in the main pane, the
   * search field and the tabs, two across with their counts, in the column.
   */
  private createCompact(): void {
    const type = theme.compactType;
    const G = GLOSSARY_COMPACT;
    const shell = compactShell(sceneStage(this).content, { back: true });
    const col = shell.column ?? { x: shell.main.x + shell.main.width, y: shell.main.y, width: 0, height: shell.main.height };
    const goBack = (): void => {
      this.scene.start(this.returnTo.scene, this.returnTo.data);
    };
    compactHeader(this, shell, { title: 'Glossary of Terms', subtitle: 'A field guide for every duel.', onBack: goBack });
    registerSceneBackNavigation(this, goBack);

    // The search field heads the column.
    this.searchInput = createSearchInput(this, col.x + col.width / 2, col.y + COMPACT.touch / 2, {
      width: col.width,
      placeholder: 'Search terms…',
      accessibleName: 'Search glossary terms',
      onChange: (value) => {
        const searching = value.trim() !== '';
        if (searching && this.query.trim() === '') this.tabBeforeSearch = this.activeTab;
        this.query = value;
        this.activeTab = searching ? null : this.activeTab ?? this.tabBeforeSearch;
        this.focus = null;
        this.renderCompact(shell.main, 0);
      },
    });
    Object.assign(this.searchInput.inputElement.style, { height: `${COMPACT.touch}px`, fontSize: `${Math.max(16, type.body)}px` });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.searchInput?.teardown());

    // The tabs under it, two across, each its name over its count.
    const tabs: ActiveTab[] = [null, ...GLOSSARY_SECTIONS.map((section) => section.id)];
    const area = { x: col.x, y: col.y + COMPACT.touch + G.tabsGap, width: col.width, height: 0 };
    area.height = Math.max(0, col.y + col.height - area.y);
    const tileW = (area.width - COMPACT.gap) / 2;
    const grid = this.add.container(0, area.y);
    const built = tabs.map((id) => {
      const label = this.add.text(G.tilePadX, G.tilePadY, id === null ? ALL_TAB_LABEL : this.sectionTitleFor(id), {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w600, color: theme.colors.body,
        wordWrap: { width: tileW - G.tilePadX * 2 },
      });
      const count = this.add.text(G.tilePadX, label.y + label.height, '0', {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted,
      });
      return { id, label, count, need: G.tilePadY * 2 + label.height + count.height };
    });
    const layout = glossaryTabTiles(area.width, built.map((b) => b.need));
    const adapters: ThemedButton[] = [];
    this.compactTiles = built.map(({ id, label, count }, i) => {
      const t = layout.tiles[i];
      const rect = { x: area.x + t.x, y: t.y, width: t.width, height: t.height };
      const tile = this.add.container(rect.x, rect.y);
      const plate = this.add.graphics();
      // The name and count sit centred down the tile, whatever its height.
      const block = label.height + count.height;
      label.setY((rect.height - block) / 2);
      count.setY(label.y + label.height);
      const zone = this.add.zone(rect.width / 2, rect.height / 2, rect.width, rect.height).setInteractive({ useHandCursor: true });
      bindTapButton(this, zone, (pointer) => {
        if (Math.abs(pointer.upY - pointer.downY) > COMPACT_DRAG_SLOP || this.activeTab === id) return;
        this.activeTab = id;
        if (this.query.trim() !== '') this.tabBeforeSearch = id;
        this.focus = null;
        this.renderCompact(shell.main, 0);
      });
      tile.add([plate, label, count, zone]);
      grid.add(tile);
      adapters.push({
        container: grid, inputZone: zone,
        getMeasuredBounds: () => ({ hit: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }),
        setEnabled: (on: boolean) => { if (on) zone.setInteractive({ useHandCursor: true }); else zone.disableInteractive(); },
      } as unknown as ThemedButton);
      return { id, rect, plate, label, count };
    });
    // At the largest text on the smallest phone the tiles outgrow the column, and scroll.
    if (layout.height > area.height) bindMenuScroll(this, grid, area, layout.height, undefined, adapters);

    const query = this.fixture?.query;
    if (query) {
      this.searchInput.inputElement.value = query;
      this.query = query;
      this.activeTab = null;
    }
    this.renderCompact(shell.main, this.fixture?.scroll === 'end' ? Number.MAX_SAFE_INTEGER : 0);
  }

  /** Redraw the tabs' state and rebuild the main pane for the open tab or search. */
  private renderCompact(main: Rect, scrollTo: number): void {
    const type = theme.compactType;
    const G = GLOSSARY_COMPACT;
    for (const tile of this.compactTiles) {
      const active = tile.id === this.activeTab;
      const { width, height } = tile.rect;
      tile.plate.clear()
        .fillStyle(active ? theme.graphics.rowFillActive : theme.graphics.rowFill, theme.alpha.panel)
        .fillRoundedRect(0, 0, width, height, theme.radius.control)
        .lineStyle(theme.control.borderWidth, active ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, active ? 1 : theme.alpha.chrome)
        .strokeRoundedRect(0, 0, width, height, theme.radius.control);
      tile.label.setColor(active ? theme.colors.gold : theme.colors.body);
      tile.count.setText(String(this.countFor(tile.id)));
    }

    this.compactMain?.destroy(true);
    const pane = this.add.container(0, 0);
    this.compactMain = pane;
    const section = this.activeSection();
    const rows = this.rowsFor(this.activeTab);
    const searching = this.query.trim() !== '';
    const heading = this.add.text(main.x, main.y, section ? section.title : searching ? 'Search Results' : ALL_TAB_LABEL, {
      fontFamily: theme.fonts.display, fontSize: `${type.h2}px`, fontStyle: theme.weight.w700, color: theme.colors.gold,
      wordWrap: { width: main.width },
    });
    const noteText = section?.note ?? (searching ? `${rows.length} matching ${rows.length === 1 ? 'term' : 'terms'}.` : '');
    const note = noteText
      ? this.add.text(main.x, heading.y + heading.height, noteText, {
        fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: theme.colors.muted, wordWrap: { width: main.width },
      })
      : null;
    const dividerY = (note ? note.y + note.height : heading.y + heading.height) + G.headGap;
    const divider = this.add.graphics().lineStyle(1, theme.graphics.panelStroke, theme.alpha.chrome)
      .lineBetween(main.x, dividerY, main.x + main.width, dividerY);
    pane.add([heading, ...(note ? [note] : []), divider]);
    const view = { x: main.x, y: dividerY + G.headGap, width: main.width, height: Math.max(0, main.y + main.height - dividerY - G.headGap) };

    if (rows.length === 0) {
      pane.add(this.add.text(view.x + view.width / 2, view.y + COMPACT.touch, `No term matches “${this.query.trim()}”.`, {
        fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, color: theme.colors.muted, wordWrap: { width: view.width },
      }).setOrigin(0.5, 0));
      return;
    }

    const hasIcons = rows.some((row) => row.term.icon.kind !== 'none');
    const showBadge = section === null;
    const nameStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.body}px`, fontStyle: theme.weight.w700 };
    const badgeStyle = { fontFamily: theme.fonts.ui, fontSize: `${type.label}px` };
    const measure = (text: string, style: object): number => {
      const t = this.add.text(0, 0, text, style);
      const w = t.width;
      t.destroy();
      return w;
    };
    const nameNeed = Math.max(...rows.map((row) => measure(row.term.name, nameStyle)));
    const badgeNeed = showBadge ? Math.max(...rows.map((row) => measure(row.section.title, badgeStyle))) : 0;
    let focusTop: number | null = null;
    const build = (rowW: number): { list: Phaser.GameObjects.Container; height: number } => {
      const cols = glossaryRowColumns(rowW, hasIcons, nameNeed, badgeNeed);
      const list = this.add.container(0, view.y);
      let y = 0;
      focusTop = null;
      for (const row of rows) {
        const compactRow = row.section.compact === true;
        const r = this.add.container(view.x, y);
        const name = this.add.text(cols.nameX, 0, row.term.name, {
          ...nameStyle, color: theme.colors.heading, wordWrap: { width: cols.nameWidth },
        });
        const description = this.add.text(cols.descriptionX, 0, compactRow ? row.term.shortLabel ?? '' : row.term.description, {
          fontFamily: theme.fonts.ui, fontSize: `${type.label}px`, color: compactRow ? theme.colors.muted : theme.colors.body,
          lineSpacing: 2, wordWrap: { width: cols.descriptionWidth },
        });
        const badge = showBadge
          ? this.add.text(cols.badgeX, 0, row.section.title, { ...badgeStyle, color: theme.colors.muted, ...(cols.stacked ? { wordWrap: { width: cols.descriptionWidth } } : {}) })
          : null;
        let h: number;
        if (cols.stacked) {
          const block = name.height + 2 + (description.text ? description.height : 0) + (badge ? 2 + badge.height : 0);
          h = Math.max(COMPACT.touch + 12, block + G.rowPadY * 2);
          name.setY((h - block) / 2);
          description.setY(name.y + name.height + 2);
          badge?.setY((description.text ? description.y + description.height : name.y + name.height) + 2);
        } else {
          h = Math.max(COMPACT.touch + 12, name.height + G.rowPadY * 2, description.height + G.rowPadY * 2, (badge?.height ?? 0) + G.rowPadY * 2);
          name.setY((h - name.height) / 2);
          description.setY((h - description.height) / 2);
          badge?.setOrigin(1, 0).setY((h - badge.height) / 2);
        }
        const focused = this.focus !== null && row.term.name === this.focus;
        const plate = this.add.graphics()
          .fillStyle(theme.graphics.rowFill, theme.alpha.panel).fillRoundedRect(0, 0, rowW, h, theme.radius.control)
          .lineStyle(focused ? 2 : theme.control.borderWidth, focused ? colorInt(theme.colors.gold) : theme.graphics.panelStroke, focused ? 1 : theme.alpha.chrome)
          .strokeRoundedRect(0, 0, rowW, h, theme.radius.control);
        r.add([plate, name, description, ...(badge ? [badge] : [])]);
        if (cols.iconX !== null) {
          const disc = this.add.graphics()
            .fillStyle(theme.graphics.panelFill, 1).fillCircle(cols.iconX, h / 2, G.disc / 2)
            .lineStyle(2, colorInt(theme.colors.gold), 0.9).strokeCircle(cols.iconX, h / 2, G.disc / 2);
          r.add(disc);
          const icon = this.iconImage(row.term.icon, cols.iconX, h / 2);
          if (icon) r.add(icon.setDisplaySize(Math.min(icon.displayWidth, G.disc - 12), Math.min(icon.displayHeight, G.disc - 12)));
        }
        if (focused) focusTop = y;
        list.add(r);
        y += h + G.rowGap;
      }
      return { list, height: Math.max(0, y - G.rowGap) };
    };
    let built = build(view.width);
    if (built.height > view.height) {
      built.list.destroy();
      built = build(view.width - G.thumbLane);
    }
    pane.add(built.list);
    const target = focusTop !== null ? Math.max(0, (focusTop as number) - G.rowGap) : scrollTo;
    bindMenuScroll(this, built.list, view, built.height, undefined, [], 0, undefined, target);
  }
}
