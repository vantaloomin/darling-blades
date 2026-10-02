/**
 * The rendered half of the scale-and-contrast gate (1.9 lane C, C5; plan
 * "Gates", item 1): boots each scene of a wave's list in each of the six
 * cells (text size 100, 115, 130% by standard and high contrast), walks the
 * display list and reports every visible Text that
 * - sits outside the title-safe frame (x 64-1216, y 36-684),
 * - sits outside its modal panel, or outside a box it declares
 *   (`text.setData('a11yBox', rect)`),
 * - overlaps another visible Text on the same layer, or
 * - is drawn scaled below 1 without declaring itself fit-to-box
 *   (`text.setData('a11yFitToBox', true)`).
 * Full menu identities declare `a11yFullText` and `a11yMaxLines`; removing
 * characters, capping lines or clipping their unmasked bounds is a finding.
 * Scrolling blurbs declare `a11yWholeLines`, so a partial glyph line at a
 * mask edge is also a finding, even though its visible fragment fits.
 * Card faces are exempt (plan: card faces never scale; `CardView` and
 * `BoardCardView` text is card-internal geometry and shrinks to fit by rule).
 * A Text marked `setData('a11yExpendable', true)` (the design system's
 * expendable edge content, such as the build stamp) is not held to the
 * title-safe frame; every other rule still applies to it. A Toast showing
 * over a scene's text when the probe measures reports as an overlap.
 *
 * DEV ONLY, and never in a production bundle: nothing in the app imports this
 * module. It is loaded by hand through the dev server, the playbook's probe
 * recipe (docs/claude-playbook.md, section 8):
 *
 *   const probe = await import('/src/dev/a11yProbe.ts');
 *   const report = await probe.runA11yProbe(window.__game, { snapshots: true });
 *
 * so a production build (whose entry is `src/main.ts`) never reaches it; the
 * runtime check below refuses to run outside a dev server as a second guard.
 * It never touches the save: Profile's fixture replays go in through the
 * scene's start data. It restores the text size and contrast in force and
 * restarts the scene that was running, which is why it refuses to start from
 * anything but a menu scene that needs no start data (`PROBE_RESTARTABLE`):
 * restarting a Duel, a draft or a pack opening without its data would throw
 * away the game in progress.
 */

import Phaser from 'phaser';
import { REPLAY_LOG_VERSION, replayDbStamp, type ReplayLog } from '../meta/Replay';
import { AVATARS } from '../data/opponents';
import { wave2BFixtureSave, WAVE_2B_FIXTURE_IDS, WAVE_2B_LONGEST_CARD_IDS } from './deckCollectionFixtures';
import type { DeckBuilderSceneData } from '../scenes/DeckBuilderScene';
import type { SavedDeck } from '../meta/SaveManager';
import { CLASSIC_RETIRED_ISSUE } from '../meta/deckRepair';
import { CARD_DB } from '../data/catalog';
import { currentAccessibility, setAccessibility, TEXT_SCALES } from '../ui/accessibility';
import { BoardCardView } from '../ui/BoardCardView';
import { CardView } from '../ui/CardView';
import { theme } from '../ui/theme';
import { menuTextFindings, menuTextOverlap, type MenuTextSurface } from '../ui/menuText';

export interface ProbeCell {
  readonly textScale: number;
  readonly highContrast: boolean;
}

export interface ProbeScene {
  /** How the report names it, e.g. "Settings / Audio". */
  readonly label: string;
  readonly key: string;
  readonly data?: object;
  /** Hand the scene the fixture replay list in its start data (Profile). */
  readonly replayFixtures?: boolean;
  /** Copy whose presence is part of this fixture, independently of its geometry. */
  readonly requiredText?: readonly string[];
}

export interface ProbeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type ProbeFindingKind = 'outsideFrame' | 'outsidePanel' | 'outsideDeclaredBox' | 'overlap' | 'scaledDown' | 'missingText' | 'truncatedText' | 'clippedText';

export interface ProbeFinding {
  readonly kind: ProbeFindingKind;
  readonly text: string;
  readonly bounds: ProbeRect;
  /** The other Text (overlap), the panel or declared box (outside), or the scale (scaledDown). */
  readonly detail: string;
}

export interface ProbeSceneReport {
  readonly scene: string;
  /** Visible Texts checked (card faces excluded). */
  readonly texts: number;
  readonly cardFaceTexts: number;
  /** Texts a mask hides entirely (the off-screen rows of a scrolling list). */
  readonly maskedOut: number;
  readonly findings: readonly ProbeFinding[];
  readonly error?: string;
}

export interface ProbeCellReport {
  readonly cell: ProbeCell;
  readonly name: string;
  readonly scenes: readonly ProbeSceneReport[];
  /** One PNG data URL per scene, when `snapshots` was asked for. */
  readonly snapshots?: Readonly<Record<string, string>>;
}

export interface ProbeReport {
  readonly startedAt: string;
  readonly cells: readonly ProbeCellReport[];
  readonly totalFindings: number;
  /** Scenes of the wave's list the probe cannot boot on its own, and why. */
  readonly skipped: readonly { scene: string; reason: string }[];
}

export interface ProbeOptions {
  readonly cells?: readonly ProbeCell[];
  readonly scenes?: readonly ProbeScene[];
  readonly snapshots?: boolean;
  /** Milliseconds to let a scene settle after it becomes active (tweens, art). */
  readonly settleMs?: number;
}

/** The six cells. */
export const PROBE_CELLS: readonly ProbeCell[] = TEXT_SCALES.flatMap((textScale) =>
  [false, true].map((highContrast) => ({ textScale, highContrast })),
);

/**
 * Wave 1's list: Settings on each tab, Profile, and every scene whose header
 * uses `SCENE_TITLE` (`sceneTitle`) that boots on the save as it is.
 */
export const WAVE_1_SCENES: readonly ProbeScene[] = [
  { label: 'Settings / Game', key: 'Settings', data: { tab: 'game' } },
  { label: 'Settings / Audio', key: 'Settings', data: { tab: 'audio' } },
  { label: 'Settings / Accessibility', key: 'Settings', data: { tab: 'accessibility' } },
  { label: 'Profile', key: 'Profile', replayFixtures: true },
  { label: 'Collection', key: 'Collection' },
  { label: 'Gauntlet', key: 'Gauntlet' },
  { label: 'Glossary', key: 'Glossary' },
  { label: 'Limited', key: 'Limited' },
  { label: 'Practice picker', key: 'PracticePicker' },
  { label: 'Shop', key: 'Shop' },
];

/** This batch's measured surfaces, including touch copy, dialogs and full lists. */
const PLAY_FIXTURE_DECKS: SavedDeck[] = AVATARS.map((avatar, i) => ({
  id: `a11y-${i}`, name: avatar.name, cards: [avatar.portraitCardId], heroCardId: avatar.portraitCardId,
  landStyle: null, format: i % 2 ? 'darlings' : 'warchest', darlingId: avatar.portraitCardId, landReserve: [],
}));
export const WAVE_2A_SCENES: readonly ProbeScene[] = [
  { label: 'Settings / Game', key: 'Settings', data: { tab: 'game' } },
  { label: 'Settings / Accessibility / touch', key: 'Settings', data: { tab: 'accessibility', a11yTouch: true },
    requiredText: ['Makes menus and help text larger. Hold a card to read it up close.'] },
  { label: 'Main menu / daily quests', key: 'MainMenu', data: { a11yFixture: true } },
  { label: 'Main menu / tutorial', key: 'MainMenu', data: { a11yFixture: true, tutorial: true } },
  { label: 'Main menu / repair', key: 'MainMenu', data: { a11yFixture: true,
    repair: [{ deckId: 'a11y', name: '', issues: [], firstIssue: '' }] } },
  { label: 'Play / empty', key: 'Play', data: { a11yDecks: [] } },
  { label: 'Play / active deck', key: 'Play', data: { a11yDecks: PLAY_FIXTURE_DECKS } },
  { label: 'Play / deck picker', key: 'Play', data: { a11yDecks: PLAY_FIXTURE_DECKS, a11yPicker: true } },
  { label: 'Play / launch notice', key: 'Play', data: { a11yDecks: PLAY_FIXTURE_DECKS, launchNotice: CLASSIC_RETIRED_ISSUE } },
  { label: 'Practice picker', key: 'PracticePicker', data: { a11yFixture: true } },
  ...AVATARS.filter((av) => ['anubis-who-holds-the-scale', 'bastet-mistress-of-the-ninth-return'].includes(av.id)).map((av) => ({
    label: `Practice picker / ${av.name}`, key: 'PracticePicker', data: { a11yFixture: true, a11yAvatarId: av.id }, requiredText: [av.name],
  })),
  ...[21, 22].map((rung) => ({ label: `Gauntlet / rung ${rung}`, key: 'Gauntlet', data: { a11yRung: rung },
    requiredText: [AVATARS[rung - 1].name, AVATARS[rung - 1].title] })),
  { label: 'Gauntlet / rung 1', key: 'Gauntlet', data: { a11yRung: 1 } },
  { label: 'Gauntlet / rung 28', key: 'Gauntlet', data: { a11yRung: 28 } },
];

/** Batch B: isolated full-catalog saves, full names, every owned scene modal. */
const BATCH_B_SAVE = wave2BFixtureSave();
const BATCH_B_CLASSIC = wave2BFixtureSave();
BATCH_B_CLASSIC.decks[0].format = undefined;
BATCH_B_CLASSIC.decks[0].darlingId = null;
BATCH_B_CLASSIC.decks[0].cards.push(...Array<string>(20).fill('land-mountain'));
const BATCH_B_VARIANTS = wave2BFixtureSave();
const BATCH_B_CARD = WAVE_2B_LONGEST_CARD_IDS[0];
const ownedFinishes: Record<string, number> = {};
for (const frame of ['white', 'blue', 'red', 'gold', 'rainbow', 'black']) {
  for (const holo of ['none', 'shiny', 'rainbow', 'pearlescent', 'fractal', 'void']) {
    for (const fullArt of [false, true]) ownedFinishes[`${frame}|${holo}|${fullArt ? 'full-art' : 'standard'}`] = 5;
  }
}
BATCH_B_VARIANTS.collectionVariants[BATCH_B_CARD] = ownedFinishes;
BATCH_B_VARIANTS.collection[BATCH_B_CARD] = Object.values(ownedFinishes).reduce((a, b) => a + b, 0);
const builderFixture = (extra: Partial<NonNullable<DeckBuilderSceneData['a11yFixture']>> = {}, deckId = WAVE_2B_FIXTURE_IDS.darlings as string): DeckBuilderSceneData => ({
  deckId, a11yFixture: { save: BATCH_B_SAVE, ...extra },
});
export const WAVE_2B_SCENES: readonly ProbeScene[] = [
  { label: 'Deck Builder / Darlings 79', key: 'DeckBuilder', data: builderFixture() },
  { label: 'Deck Builder / full catalog', key: 'DeckBuilder', data: builderFixture({}, WAVE_2B_FIXTURE_IDS.fullCatalog) },
  { label: 'Deck Builder / full catalog / last page', key: 'DeckBuilder', data: builderFixture({ page: Number.MAX_SAFE_INTEGER }, WAVE_2B_FIXTURE_IDS.fullCatalog) },
  { label: 'Deck Builder / decks / last page', key: 'DeckBuilder', data: builderFixture({ modal: 'decks', pickerPage: Number.MAX_SAFE_INTEGER }) },
  { label: 'Deck Builder / classic basics', key: 'DeckBuilder', data: builderFixture({ save: BATCH_B_CLASSIC }) },
  { label: 'Deck Builder / empty', key: 'DeckBuilder', data: builderFixture({}, WAVE_2B_FIXTURE_IDS.empty) },
  ...WAVE_2B_LONGEST_CARD_IDS.flatMap((focusCardId) => [false, true].map((touch) => ({
    label: `Deck Builder / longest card / ${touch ? 'touch' : 'desktop'}`, key: 'DeckBuilder',
    data: builderFixture({ focusCardId, touch }), requiredText: [CARD_DB[focusCardId].name],
  }))),
  ...(['warchest', 'style'] as const).map((mode) => ({ label: `Deck Builder / ${mode}`, key: 'DeckBuilder', data: builderFixture({ mode }) })),
  ...(['decks', 'darling', 'reserve', 'landStyles', 'repair', 'rename', 'format', 'export', 'import', 'unsaved', 'filters'] as const)
    .map((modal) => ({ label: `Deck Builder / ${modal}`, key: 'DeckBuilder', data: builderFixture({ modal }, modal === 'repair' ? WAVE_2B_FIXTURE_IDS.fullCatalog : WAVE_2B_FIXTURE_IDS.darlings) })),
  { label: 'Deck Builder / set options', key: 'DeckBuilder', data: builderFixture({ modal: 'filters', filter: 'set' }) },
  { label: 'Collection / full catalog', key: 'Collection', data: { a11yFixture: { save: BATCH_B_SAVE } } },
  { label: 'Collection / empty', key: 'Collection', data: { a11yFixture: { save: BATCH_B_SAVE, cards: [] } } },
  ...(['set', 'color', 'type', 'rarity', 'sort'] as const).map((openFilter) => ({
    label: `Collection / ${openFilter} options`, key: 'Collection', data: { a11yFixture: { save: BATCH_B_SAVE, openFilter } },
  })),
  ...[0, 9, 71].map((variantPage) => ({ label: `Collection / all finishes / page ${variantPage}`, key: 'Collection',
    data: { a11yFixture: { save: BATCH_B_VARIANTS, inspectCardId: BATCH_B_CARD, variantPage } } })),
  { label: 'Collection / finish comparison', key: 'Collection', data: { a11yFixture: {
    save: BATCH_B_VARIANTS, inspectCardId: BATCH_B_CARD, compareVariantIndex: 9 } } },
  ...WAVE_2B_LONGEST_CARD_IDS.map((inspectCardId) => ({ label: 'Collection / longest card inspect', key: 'Collection',
    data: { a11yFixture: { save: BATCH_B_SAVE, inspectCardId } }, requiredText: [CARD_DB[inspectCardId].name] })),
];

/** `SCENE_TITLE` scenes this probe cannot open without a fixture it does not build. */
export const WAVE_1_SKIPPED: readonly { scene: string; reason: string }[] = [
  { scene: 'LimitedDraft', reason: 'needs a draft in progress; the Limited pass (accessibility wave 3) enrols it with a fixture' },
  { scene: 'LimitedDeckBuilder', reason: 'needs a drafted pool; the Limited pass (accessibility wave 3) enrols it with a fixture' },
];

export function cellName(cell: ProbeCell): string {
  return `${Math.round(cell.textScale * 100)}${cell.highContrast ? 'hc' : ''}`;
}

/** Positions compare at half a pixel: antialiasing, not layout. */
const EPS = 0.5;

function contains(outer: ProbeRect, inner: ProbeRect): boolean {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.width <= outer.x + outer.width + EPS &&
    inner.y + inner.height <= outer.y + outer.height + EPS
  );
}

const round = (r: Phaser.Geom.Rectangle): ProbeRect => ({
  x: Math.round(r.x * 10) / 10,
  y: Math.round(r.y * 10) / 10,
  width: Math.round(r.width * 10) / 10,
  height: Math.round(r.height * 10) / 10,
});

/**
 * The extent of a Graphics' straight path segments, arcs and filled rects, in
 * its own space (Phaser 3.90's Graphics command buffer). Enough for the shapes
 * the chrome draws: `fillRoundedRect` panels and `fillRect` mask shapes.
 */
function graphicsLocalRect(graphics: Phaser.GameObjects.Graphics): ProbeRect | null {
  const buffer = graphics.commandBuffer as number[];
  // Command ids and argument counts from phaser/src/gameobjects/graphics/Commands.js and Graphics.js.
  const ARC = 0;
  const FILL_RECT = 3;
  const LINE_TO = 4;
  const MOVE_TO = 5;
  const arity: Record<number, number> = { 0: 7, 3: 4, 4: 2, 5: 2, 6: 3, 7: 2, 10: 6, 11: 6, 16: 2, 17: 2, 18: 1, 21: 8, 22: 6 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < buffer.length; ) {
    const command = buffer[i];
    if (command === MOVE_TO || command === LINE_TO) {
      minX = Math.min(minX, buffer[i + 1]);
      maxX = Math.max(maxX, buffer[i + 1]);
      minY = Math.min(minY, buffer[i + 2]);
      maxY = Math.max(maxY, buffer[i + 2]);
    } else if (command === FILL_RECT) {
      minX = Math.min(minX, buffer[i + 1]);
      minY = Math.min(minY, buffer[i + 2]);
      maxX = Math.max(maxX, buffer[i + 1] + buffer[i + 3]);
      maxY = Math.max(maxY, buffer[i + 2] + buffer[i + 4]);
    } else if (command === ARC) {
      const [x, y, r] = [buffer[i + 1], buffer[i + 2], buffer[i + 3]];
      minX = Math.min(minX, x - r);
      maxX = Math.max(maxX, x + r);
      minY = Math.min(minY, y - r);
      maxY = Math.max(maxY, y + r);
    }
    i += 1 + (arity[command] ?? 0);
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
}

function toWorld(object: Phaser.GameObjects.Components.Transform, local: ProbeRect): ProbeRect {
  const m = object.getWorldTransformMatrix();
  return { x: local.x * m.scaleX + m.tx, y: local.y * m.scaleY + m.ty, width: local.width * m.scaleX, height: local.height * m.scaleY };
}

/**
 * A `modalShell`'s panel rectangle. The shell is a container whose first child
 * is the full-canvas dim and whose second is the panel Graphics.
 */
function modalPanelRect(container: Phaser.GameObjects.Container): ProbeRect | null {
  const [dim, chrome] = container.list;
  if (!(dim instanceof Phaser.GameObjects.Rectangle) || !(chrome instanceof Phaser.GameObjects.Graphics)) return null;
  if (dim.width < theme.design.width || dim.height < theme.design.height) return null;
  const local = graphicsLocalRect(chrome);
  return local ? toWorld(chrome, local) : null;
}

/** The visible rectangle a mask leaves (geometry masks from their shape, bitmap masks from their bounds). */
function maskRect(object: Phaser.GameObjects.GameObject): ProbeRect | null {
  const mask = (object as Partial<Phaser.GameObjects.Components.Mask>).mask;
  if (!mask) return null;
  if (mask instanceof Phaser.Display.Masks.GeometryMask) {
    // The mask shape is a Graphics or a Shape (a Rectangle, an Arc...).
    const shape: unknown = mask.geometryMask;
    if (shape instanceof Phaser.GameObjects.Graphics) {
      const local = graphicsLocalRect(shape);
      return local ? toWorld(shape, local) : null;
    }
    return shape instanceof Phaser.GameObjects.Shape ? round(shape.getBounds()) : null;
  }
  const source = (mask as Phaser.Display.Masks.BitmapMask).bitmapMask as Partial<Phaser.GameObjects.Components.GetBounds> | undefined;
  return source?.getBounds ? round(source.getBounds()) : null;
}

function intersection(a: ProbeRect, b: ProbeRect): ProbeRect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right - x <= EPS || bottom - y <= EPS) return null;
  const r1 = (v: number): number => Math.round(v * 10) / 10;
  return { x: r1(x), y: r1(y), width: r1(right - x), height: r1(bottom - y) };
}

interface WalkedText {
  readonly object: Phaser.GameObjects.Text;
  readonly bounds: ProbeRect;
  readonly unclippedBounds: ProbeRect;
  readonly clip: ProbeRect | null;
  readonly scale: number;
  /** The nearest enclosing modal panel, if the Text is inside a modalShell. */
  readonly panel: ProbeRect | null;
  /** The display-list layer: the index of its top-level ancestor (a modal is its own layer). */
  readonly layer: string;
  readonly surface?: MenuTextSurface;
  readonly depth: number;
  readonly order: number;
}

function walkTexts(scene: Phaser.Scene): { texts: WalkedText[]; cardFaceTexts: number; maskedOut: number } {
  const texts: WalkedText[] = [];
  let cardFaceTexts = 0;
  let maskedOut = 0;
  const hidden: ProbeRect = { x: 0, y: 0, width: 0, height: 0 };
  const visit = (
    object: Phaser.GameObjects.GameObject,
    panel: ProbeRect | null,
    layer: string,
    onCard: boolean,
    clip: ProbeRect | null,
    depth: number, order: number, surface?: MenuTextSurface,
  ): void => {
    const shown = object as Phaser.GameObjects.GameObject & Partial<Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.Alpha>;
    if (shown.visible === false || shown.alpha === 0) return;
    const own = maskRect(object);
    const visibleArea = own ? (clip ? intersection(clip, own) ?? hidden : own) : clip;
    if (object instanceof Phaser.GameObjects.Container) {
      const card = onCard || object instanceof CardView || object instanceof BoardCardView;
      const modal = modalPanelRect(object);
      const nextLayer = modal ? `${layer}/modal` : layer;
      const plate = modal ?? object.getData('a11ySurface') as ProbeRect | undefined;
      const nextSurface = plate ? { id: layer, bounds: plate, depth, order } : surface;
      for (const child of object.list) visit(child, modal ?? panel, nextLayer, card, visibleArea, depth, order, nextSurface);
      return;
    }
    if (!(object instanceof Phaser.GameObjects.Text) || object.text.trim() === '') return;
    if (onCard) {
      cardFaceTexts++;
      return;
    }
    // A mask shows only part of a scrolling list: check what shows, skip what it hides.
    const bounds = visibleArea ? intersection(round(object.getBounds()), visibleArea) : round(object.getBounds());
    if (!bounds) {
      maskedOut++;
      return;
    }
    const m = object.getWorldTransformMatrix();
    texts.push({ object, bounds, unclippedBounds: round(object.getBounds()), clip: visibleArea, scale: Math.min(Math.abs(m.scaleX), Math.abs(m.scaleY)), panel, layer, surface, depth, order });
  };
  scene.children.list.forEach((child, index) => visit(child, null, String(index), false, null, (child as Phaser.GameObjects.GameObject & Partial<Phaser.GameObjects.Components.Depth>).depth ?? 0, index));
  return { texts, cardFaceTexts, maskedOut };
}

const FRAME: ProbeRect = {
  x: theme.design.titleSafe.left,
  y: theme.design.titleSafe.top,
  width: theme.design.titleSafe.right - theme.design.titleSafe.left,
  height: theme.design.titleSafe.bottom - theme.design.titleSafe.top,
};

const label = (text: Phaser.GameObjects.Text): string => text.text.replace(/\s+/g, ' ').slice(0, 60);

/** The rules over one scene's visible Texts. */
export function checkScene(scene: Phaser.Scene): Omit<ProbeSceneReport, 'scene'> {
  const { texts, cardFaceTexts, maskedOut } = walkTexts(scene);
  const findings: ProbeFinding[] = [];
  for (const t of texts) {
    const text = label(t.object);
    if (!contains(FRAME, t.bounds) && t.object.getData('a11yExpendable') !== true) findings.push({ kind: 'outsideFrame', text, bounds: t.bounds, detail: 'title-safe frame x 64-1216, y 36-684' });
    if (t.panel && !contains(t.panel, t.bounds)) {
      findings.push({ kind: 'outsidePanel', text, bounds: t.bounds, detail: `panel ${JSON.stringify(t.panel)}` });
    }
    const declared = t.object.getData('a11yBox') as ProbeRect | undefined;
    const fullText = t.object.getData('a11yFullText') as string | undefined;
    const wholeLines = t.object.getData('a11yWholeLines') as { lineHeight: number; linePitch: number } | undefined;
    if (fullText !== undefined || wholeLines) {
      const maxWidth = t.object.getData('a11yTextWidth') as number | undefined;
      const maxHeight = t.object.getData('a11yTextHeight') as number | undefined;
      const box = declared ?? ((maxWidth !== undefined || maxHeight !== undefined) ? {
        ...t.unclippedBounds, width: maxWidth ?? t.unclippedBounds.width, height: maxHeight ?? t.unclippedBounds.height,
      } : undefined);
      for (const kind of menuTextFindings({ expected: fullText ?? t.object.text, actual: t.object.text,
        lines: t.object.getWrappedText(), drawnLines: t.object.style.maxLines,
        maxLines: t.object.getData('a11yMaxLines') as number | undefined,
        bounds: t.unclippedBounds, box, clip: t.clip ?? undefined, ...wholeLines })) {
        findings.push({ kind, text, bounds: t.unclippedBounds,
          detail: 'full source text, wrapped line count and unmasked glyph-line bounds' });
      }
    }

    if (declared && !contains(declared, t.bounds)) {
      findings.push({ kind: 'outsideDeclaredBox', text, bounds: t.bounds, detail: `box ${JSON.stringify(declared)}` });
    }
    if (t.scale < 1 - 1e-3 && t.object.getData('a11yFitToBox') !== true) {
      findings.push({ kind: 'scaledDown', text, bounds: t.bounds, detail: `scale ${t.scale.toFixed(3)}` });
    }
  }
  // A modal covers what is under it, so only Texts on one layer can collide.
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const [a, b] = [texts[i], texts[j]];
      if (menuTextOverlap(a, b)) {
        findings.push({ kind: 'overlap', text: label(a.object), bounds: a.bounds, detail: `"${label(b.object)}" ${JSON.stringify(b.bounds)}` });
      }
    }
  }
  return { texts: texts.length, cardFaceTexts, maskedOut, findings };
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function snapshot(game: Phaser.Game): Promise<string> {
  return new Promise((resolve) => {
    game.renderer.snapshot((image) => resolve(image instanceof HTMLImageElement ? image.src : ''));
  });
}

/**
 * Fixture replays for Profile: a full grid (ten), half replayable and half
 * recorded on an older version (the note line), with long opponent names and
 * one- and many-turn meta lines, so every line the replay cell can draw is on
 * screen.
 */
function fixtureReplays(): ReplayLog[] {
  const stamp = replayDbStamp(CARD_DB);
  const names = ['Seraphine of the Long Ember Road', 'Ash', 'Mirelle Vantablack-Ossuary', 'Queen Tamsin the Unhurried', 'Ro'];
  return Array.from({ length: 10 }, (_, i) => ({
    v: i % 2 === 0 ? REPLAY_LOG_VERSION : 1,
    dbStamp: i % 2 === 0 ? stamp : 'old',
    seed: i + 1,
    decks: [[], []],
    context: {
      mode: (['gauntlet', 'practice', 'limited'] as const)[i % 3],
      difficulty: 'hard',
      opponentId: null,
      opponentName: names[i % names.length],
      gauntletRung: null,
    },
    actions: [],
    result: i % 3 === 0 ? 'loss' : 'win',
    endedAt: Date.UTC(2026, 8, 28 - i),
    turns: i === 0 ? 1 : 10 + i,
  }));
}

/** Start a scene alone and wait until it has built and settled. */
async function openScene(game: Phaser.Game, spec: ProbeScene, settleMs: number): Promise<Phaser.Scene> {
  for (const running of game.scene.getScenes(true)) {
    const key = running.sys.settings.key;
    if (key !== spec.key && key !== 'ArtLoader') game.scene.stop(key);
  }
  if (game.scene.isActive(spec.key)) game.scene.stop(spec.key);
  const data = spec.replayFixtures ? { ...spec.data, replays: fixtureReplays() } : spec.data;
  game.scene.start(spec.key, data);
  for (let i = 0; i < 200 && !game.scene.isActive(spec.key); i++) await wait(25);
  const scene = game.scene.getScene(spec.key);
  if (spec.key === 'DeckBuilder' || spec.key === 'Collection') {
    for (let i = 0; i < 800 && scene.data.get('a11yReady') !== true; i++) await wait(25);
    if (scene.data.get('a11yReady') !== true) throw new Error(`${spec.key} did not finish building its fixture`);
  }
  await wait(settleMs);
  return scene;
}

/**
 * Scenes the probe may start from and put back: menus that build from the save
 * alone, with no start data to lose. Anything else (a Duel, a draft, a pack
 * opening) refuses the run.
 */
export const PROBE_RESTARTABLE: readonly string[] = [
  'MainMenu',
  'Play',
  'Settings',
  'Profile',
  'Collection',
  'Glossary',
  'Gauntlet',
  'Limited',
  'PracticePicker',
  'Shop',
  'Achievements',
];

/**
 * Run the probe. Returns the report; the caller (a CDP driver or the console)
 * saves it and the snapshots. Scenes listed but missing from the game, or
 * throwing on boot, are reported with an error rather than stopping the run.
 */
export async function runA11yProbe(game: Phaser.Game, options: ProbeOptions = {}): Promise<ProbeReport> {
  if (!import.meta.env.DEV) throw new Error('a11yProbe is a dev-server tool');
  const cells = options.cells ?? PROBE_CELLS;
  const scenes = options.scenes ?? WAVE_1_SCENES;
  const settleMs = options.settleMs ?? 700;
  const running = game.scene.getScenes(true).map((s) => s.sys.settings.key).filter((key) => key !== 'ArtLoader');
  const unsafe = running.filter((key) => !PROBE_RESTARTABLE.includes(key));
  if (unsafe.length > 0) {
    throw new Error(`a11yProbe: ${unsafe.join(', ')} is running and cannot be restarted without its data; go to the main menu first`);
  }
  const before = currentAccessibility();
  const returnTo = running[0] ?? 'MainMenu';
  const report: ProbeCellReport[] = [];
  let totalFindings = 0;
  try {
    // Warm-up: a scene's first visit may still be streaming art or fonts in.
    for (const spec of scenes) {
      try {
        await openScene(game, spec, settleMs);
      } catch {
        // Reported by the measured pass below.
      }
    }
    for (const cell of cells) {
      setAccessibility(cell);
      const sceneReports: ProbeSceneReport[] = [];
      const snapshots: Record<string, string> = {};
      for (const spec of scenes) {
        try {
          const scene = await openScene(game, spec, settleMs);
          const result = checkScene(scene);
          const visible = walkTexts(scene).texts;
          const missing: ProbeFinding[] = (spec.requiredText ?? []).filter((text) => !visible.some((entry) => entry.object.text === text))
            .map((text) => ({ kind: 'missingText', text, bounds: { x: 0, y: 0, width: 0, height: 0 }, detail: 'required visible fixture copy' }));
          const findings = [...result.findings, ...missing];
          totalFindings += findings.length;
          sceneReports.push({ scene: spec.label, ...result, findings });
          if (options.snapshots) snapshots[spec.label] = await snapshot(game);
        } catch (error) {
          totalFindings++;
          sceneReports.push({ scene: spec.label, texts: 0, cardFaceTexts: 0, maskedOut: 0, findings: [], error: String(error) });
        }
      }
      report.push({ cell, name: cellName(cell), scenes: sceneReports, ...(options.snapshots ? { snapshots } : {}) });
    }
  } finally {
    setAccessibility(before);
    for (const running of game.scene.getScenes(true)) {
      const key = running.sys.settings.key;
      if (key !== 'ArtLoader') game.scene.stop(key);
    }
    game.scene.start(returnTo);
  }
  return {
    startedAt: new Date().toISOString(),
    cells: report,
    totalFindings,
    skipped: options.scenes ? [] : WAVE_1_SKIPPED,
  };
}
