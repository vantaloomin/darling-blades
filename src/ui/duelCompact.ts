/**
 * Phaser-free geometry of the phone Duel (docs/plan-mobile-overhaul.md C4,
 * the Version C mocks T-03a, T-03b, T-10 and T-13a). The desktop board keeps
 * src/ui/duelLayout.ts; this module lays the same game out in the compact
 * design space (one design px per CSS px) inside the screen's content box:
 *
 * - a 96 px left column: the foe's portrait and life on top, her resource
 *   block (mana, then hand, library and graveyard counts), the History and
 *   Menu buttons in the middle, your block, then your portrait at the foot;
 * - the centre: each side's creatures as up to two rows of round medallions,
 *   a strip of smaller discs for its other permanents at the outer edge, and
 *   the turn and phase line between the halves;
 * - the 230 px command column: the hand as named rows (M10, M27), End turn
 *   and the primary action at the foot under the right thumb.
 *
 * `duelPhoneReadback` restates the phone positions in the desktop layout's
 * shape, so the scene's travel animations and target arrows (which read
 * piles, life badges and rows from that shape) land on the phone's own
 * places.
 */

import { COMPACT, compactList, type CompactListLayout } from './compactLayout';
import type { DUEL_LAYOUT } from './duelLayout';
import { deckRowDetail } from './deckBuilderCompact';
import type { Rect } from './layout';

export const DUEL_PHONE = {
  /** The mocks' DUEL_L: a 96 px left column, the centre, a 230 px command column. */
  leftW: 96,
  gap: 8,
  columnW: COMPACT.columnW,
  /** A resource block: the mana line over the zone counts. */
  blockH: 50,
  blockHLarge: 56,
  /** The History and Menu buttons side by side. */
  buttonH: COMPACT.touch,
  /** Air between the left column's parts. */
  stackGap: 6,
  /** The turn and phase line between the board halves. */
  lineH: 22,
  lineHLarge: 26,
  /** A creature medallion's diameter, and the floor it shrinks to on a crowded, narrow board. */
  medallion: 52,
  medallionMin: 36,
  /** Space between neighbouring medallions in a row. */
  medallionGap: 14,
  /** The P/T pill hangs this far below a medallion. */
  pillDrop: 10,
  /** The outer strip of other permanents. */
  stripD: 34,
  stripPitch: 44,
  stripInset: 4,
  /** The hand list's rows (M27): 40 tall on a 44 pitch; 52 on 56 at the largest text. */
  handRowH: 40,
  handRowHLarge: 52,
  /** End turn's share of the foot; the primary takes the rest. */
  endTurnW: 85,
} as const;

export interface DuelPhoneLayout {
  content: Rect;
  left: Rect;
  main: Rect;
  column: Rect;
  oppPortrait: Rect;
  myPortrait: Rect;
  /** The framed resource blocks (M15): one button each. */
  oppBlock: Rect;
  myBlock: Rect;
  history: Rect;
  menu: Rect;
  /** The two board halves drawn as panels, the foe's on top. */
  oppHalf: Rect;
  myHalf: Rect;
  /** The turn and phase line between them. */
  line: Rect;
  /** The hand list's pane: the column above the foot. */
  hand: Rect;
  handRowH: number;
  /** The foot of the column. */
  endTurn: Rect;
  primary: Rect;
  /** The whole foot (End turn and the primary together), for a status line that replaces both. */
  foot: Rect;
}

export interface DuelPhoneOptions {
  /** The largest text size (130%): taller blocks, line and hand rows. */
  largeText?: boolean;
}

/** The phone Duel's regions inside the content box. */
export function duelPhoneLayout(content: Rect, opts: DuelPhoneOptions = {}): DuelPhoneLayout {
  const P = DUEL_PHONE;
  const large = opts.largeText === true;
  const top = content.y;
  const bottom = content.y + content.height;
  const H = content.height;
  const columnW = Math.min(P.columnW, Math.max(0, content.width - P.leftW - 2 * P.gap));
  const left: Rect = { x: content.x, y: top, width: P.leftW, height: H };
  const column: Rect = { x: content.x + content.width - columnW, y: top, width: columnW, height: H };
  const mainX = left.x + left.width + P.gap;
  const main: Rect = { x: mainX, y: top, width: Math.max(0, column.x - P.gap - mainX), height: H };

  // The left column, top to bottom: portrait, block, the two buttons on the
  // midline, block, portrait.
  const blockH = large ? P.blockHLarge : P.blockH;
  const g = P.stackGap;
  const portraitH = Math.max(0, Math.floor((H - 2 * blockH - P.buttonH - 4 * g) / 2));
  const buttonsY = top + Math.round((H - P.buttonH) / 2);
  const oppPortrait: Rect = { x: left.x, y: top, width: left.width, height: portraitH };
  const myPortrait: Rect = { x: left.x, y: bottom - portraitH, width: left.width, height: portraitH };
  const oppBlock: Rect = { x: left.x, y: buttonsY - g - blockH, width: left.width, height: blockH };
  const myBlock: Rect = { x: left.x, y: buttonsY + P.buttonH + g, width: left.width, height: blockH };
  const buttonW = (left.width - P.gap) / 2;
  const history: Rect = { x: left.x, y: buttonsY, width: buttonW, height: P.buttonH };
  const menu: Rect = { x: left.x + buttonW + P.gap, y: buttonsY, width: buttonW, height: P.buttonH };

  // The centre: two equal halves around the turn line.
  const lineH = large ? P.lineHLarge : P.lineH;
  const halfH = Math.floor((H - lineH) / 2);
  const oppHalf: Rect = { x: main.x, y: top, width: main.width, height: halfH };
  const myHalf: Rect = { x: main.x, y: bottom - halfH, width: main.width, height: halfH };
  const line: Rect = { x: main.x, y: top + halfH, width: main.width, height: bottom - halfH - (top + halfH) };

  // The command column: the hand over the foot.
  const foot: Rect = { x: column.x, y: bottom - COMPACT.touch, width: column.width, height: COMPACT.touch };
  const endW = Math.min(P.endTurnW, Math.max(0, (column.width - P.gap) / 2));
  const endTurn: Rect = { x: column.x, y: foot.y, width: endW, height: foot.height };
  const primary: Rect = { x: column.x + endW + P.gap, y: foot.y, width: column.width - endW - P.gap, height: foot.height };
  const hand: Rect = { x: column.x, y: top, width: column.width, height: Math.max(0, foot.y - P.gap - top) };

  return {
    content: { ...content }, left, main, column, oppPortrait, myPortrait, oppBlock, myBlock, history, menu,
    oppHalf, myHalf, line, hand, handRowH: large ? P.handRowHLarge : P.handRowH, endTurn, primary, foot,
  };
}

// ------------------------------------------------------------------ the board

export interface MedallionSpot {
  x: number;
  y: number;
}

export interface SideBoard {
  /** One diameter for every creature on the side. */
  d: number;
  /** Creature centres in the order given: the front row (nearer the turn line) first, then the back row. */
  creatures: MedallionSpot[];
  /** The y of each row's centre, front row first. */
  rowY: [number, number];
  /** The outer strip of other permanents, left to right. */
  strip: MedallionSpot[];
  stripD: number;
  stripY: number;
}

/**
 * How a side's creatures split between the two rows: everything in the front
 * row while it fits, else the front row takes the larger half (T-03a: 9 makes
 * 5 in front, 4 behind; 8 makes 4 and 4).
 */
export function medallionRows(count: number, perRow: number): [number, number] {
  const n = Math.max(0, Math.floor(count));
  if (n <= Math.max(1, perRow)) return [n, 0];
  return [Math.ceil(n / 2), Math.floor(n / 2)];
}

/** Centres for `count` items of pitch `pitch`, centred on `cx`. */
function centredRow(count: number, cx: number, pitch: number): number[] {
  return Array.from({ length: count }, (_, i) => cx + (i - (count - 1) / 2) * pitch);
}

/**
 * Lay one side of the board out in its half. `side` is 'opp' for the half
 * above the line (its strip on top, its front row at the bottom) or 'mine'
 * (front row at the top, strip at the foot).
 */
export function sideBoard(half: Rect, side: 'opp' | 'mine', creatureCount: number, otherCount: number): SideBoard {
  const P = DUEL_PHONE;
  const pad = P.gap;
  const usableW = Math.max(0, half.width - 2 * pad);
  const stripZone = P.stripD + 2 * P.stripInset;
  const rowsH = Math.max(0, half.height - stripZone);
  // Two rows of a medallion plus its hanging pill share what is left.
  const rowFitD = Math.floor(rowsH / 2) - P.pillDrop;
  const maxPerRow = Math.max(1, Math.floor((usableW + P.medallionGap) / (P.medallion + P.medallionGap)));
  const [front, back] = medallionRows(creatureCount, maxPerRow);
  const widest = Math.max(front, back, 1);
  const widthFitD = Math.floor((usableW + P.medallionGap) / widest) - P.medallionGap;
  const d = Math.max(P.medallionMin, Math.min(P.medallion, rowFitD, widthFitD));
  const pitchX = Math.min(d + P.medallionGap, widest > 1 ? (usableW - d) / (widest - 1) : d + P.medallionGap);
  const rowPitch = d + P.pillDrop;
  // The rows sit centred in their band; the strip hugs the outer edge.
  const rowsTop = side === 'opp' ? half.y + stripZone : half.y;
  const slack = Math.max(0, rowsH - 2 * rowPitch);
  const firstRowY = rowsTop + slack / 2 + d / 2;
  const secondRowY = firstRowY + rowPitch;
  // The opponent's front row is the lower one, nearer the line.
  const rowY: [number, number] = side === 'opp' ? [secondRowY, firstRowY] : [firstRowY, secondRowY];
  const cx = half.x + half.width / 2;
  const creatures: MedallionSpot[] = [
    ...centredRow(front, cx, pitchX).map((x) => ({ x, y: rowY[0] })),
    ...centredRow(back, cx, pitchX).map((x) => ({ x, y: rowY[1] })),
  ];

  const stripY = side === 'opp' ? half.y + P.stripInset + P.stripD / 2 : half.y + half.height - P.stripInset - P.stripD / 2;
  const others = Math.max(0, Math.floor(otherCount));
  // The strip starts at the left and packs tighter once it would run out of room.
  const stripPitch = others > 1 ? Math.min(P.stripPitch, (usableW - P.stripD) / (others - 1)) : P.stripPitch;
  const strip = Array.from({ length: others }, (_, i) => ({ x: half.x + pad + P.stripD / 2 + i * stripPitch, y: stripY }));
  return { d, creatures, rowY, strip, stripD: P.stripD, stripY };
}

// ------------------------------------------------------------------ the hand list

export interface HandListLayout extends CompactListLayout {
  /** A pinned row above the hand (the Warchest drop, T-03b), or null. */
  pinned: Rect | null;
}

/**
 * The hand's rows down the column (M27). A pinned row (the Warchest while a
 * land drop is open) takes the first slot; a hand longer than the pane ends in
 * an "N more in hand" row (T-13a).
 */
export function handList(L: DuelPhoneLayout, count: number, pinned: boolean): HandListLayout {
  const rowH = L.handRowH;
  const pitch = rowH + (COMPACT.rowPitch - COMPACT.touch);
  const pinnedRect = pinned ? { x: L.hand.x, y: L.hand.y, width: L.hand.width, height: rowH } : null;
  const pane = pinned
    ? { ...L.hand, y: L.hand.y + pitch, height: Math.max(0, L.hand.height - pitch) }
    : L.hand;
  return { ...compactList(pane, count, rowH), pinned: pinnedRect };
}

// ------------------------------------------------------------------ the left column

/** The life total's plate, centred on the portrait's lower edge (T-03a). */
export const LIFE_PLATE = { width: 46, height: 28, inset: 2 } as const;

export function lifePlate(portrait: Rect): Rect {
  return {
    x: portrait.x + (portrait.width - LIFE_PLATE.width) / 2,
    y: portrait.y + portrait.height - LIFE_PLATE.height - LIFE_PLATE.inset,
    width: LIFE_PLATE.width,
    height: LIFE_PLATE.height,
  };
}

export type ZoneCount = 'hand' | 'deck' | 'grave';
export const ZONE_COUNTS: readonly ZoneCount[] = ['hand', 'deck', 'grave'];

/** The zone counts across a block's lower line, hand, library and graveyard: each count's centre. */
export function blockCounts(block: Rect, side: 'opp' | 'mine' = 'opp'): { kind: ZoneCount; x: number; y: number }[] {
  const third = block.width / 3;
  const y = block.y + block.height * (side === 'opp' ? 0.72 : 0.28);
  return ZONE_COUNTS.map((kind, i) => ({ kind, x: block.x + third * (i + 0.5), y }));
}

/** The mana line's centre y in a block: the blocks mirror, so mana faces each portrait's board edge (T-03a). */
export function blockManaY(block: Rect, side: 'opp' | 'mine' = 'opp'): number {
  return block.y + block.height * (side === 'opp' ? 0.28 : 0.72);
}

// ------------------------------------------------------------------ read-backs

type Widen<T> = T extends number ? number : T extends string ? string : T extends boolean ? boolean : { -readonly [K in keyof T]: Widen<T[K]> };

/** The desktop layout's shape with plain numbers: what the scene's read-backs take. */
export type DuelLayoutShape = Widen<typeof DUEL_LAYOUT>;

/**
 * The phone's places in the desktop layout's shape. Piles map to the zone
 * counts in each block, life badges to the portraits' life plates, the
 * creature rows to each side's front row, the gap to the turn line and the
 * smart button to the primary action. Fields the phone does not draw (the
 * phase track, the desktop menu and undo anchors) keep sensible spots so a
 * stray read never sends a card off screen.
 */
export function duelPhoneReadback(L: DuelPhoneLayout): DuelLayoutShape {
  const opp = sideBoard(L.oppHalf, 'opp', 0, 0);
  const mine = sideBoard(L.myHalf, 'mine', 0, 0);
  const blockCx = L.left.x + L.left.width / 2;
  const oppCountsY = blockCounts(L.oppBlock)[0].y;
  const myCountsY = blockCounts(L.myBlock, 'mine')[0].y;
  const oppManaY = blockManaY(L.oppBlock);
  const myManaY = blockManaY(L.myBlock, 'mine');
  const countX = (i: number): number => blockCounts(L.oppBlock)[i].x;
  const lifeY = (portrait: Rect): number => lifePlate(portrait).y + LIFE_PLATE.height / 2;
  const mainCx = L.main.x + L.main.width / 2;
  const primaryCx = L.primary.x + L.primary.width / 2;
  const primaryCy = L.primary.y + L.primary.height / 2;
  // The Darling zone's card sits in the strip's band at its far end, clear of the medallion rows.
  const darlingX = (half: Rect): number => half.x + half.width - 20;
  const myDarlingY = mine.stripY;
  const oppDarlingY = opp.stripY;
  const zone = (half: Rect) => ({ x0: half.x, x1: half.x + half.width, y0: half.y, y1: half.y + half.height });
  return {
    oppZone: zone(L.oppHalf),
    oppManaStrip: { cy: oppManaY, x0: L.oppBlock.x + 16, step: 46, pipSize: 20 },
    oppPermanentBand: { cy: opp.stripY, x0: L.oppHalf.x + DUEL_PHONE.gap, usable: L.oppHalf.width - 2 * DUEL_PHONE.gap },
    oppCreatures: { cy: opp.rowY[0], x: mainCx, usable: L.main.width },
    gap: { cy: L.line.y + L.line.height / 2, stackX: L.main.x + L.main.width - 60, stackY: L.oppHalf.y + L.oppHalf.height / 2 },
    myZone: zone(L.myHalf),
    myCreatures: { cy: mine.rowY[0], x: mainCx, usable: L.main.width },
    myManaStrip: { cy: myManaY, x0: L.myBlock.x + 16, step: 46, pipSize: 20 },
    reservePiles: {
      human: { x: blockCx, y: L.myBlock.y + L.myBlock.height / 2, cardScale: 0.08 },
      opponent: { x: blockCx, y: L.oppBlock.y + L.oppBlock.height / 2, cardScale: 0.08, visualHalfWidth: L.left.width / 2, visualTop: -L.oppBlock.height / 2, visualBottom: L.oppBlock.height / 2 },
    },
    myPermanentBand: { cy: mine.stripY, x1: L.myHalf.x + L.myHalf.width - DUEL_PHONE.gap, usable: L.myHalf.width - 2 * DUEL_PHONE.gap },
    portrait: { x: L.myPortrait.x, y: L.myPortrait.y, w: L.myPortrait.width, h: L.myPortrait.height },
    myLife: { x: blockCx, y: lifeY(L.myPortrait) },
    oppPortrait: { x: L.oppPortrait.x, y: L.oppPortrait.y, w: L.oppPortrait.width, h: L.oppPortrait.height },
    oppLife: { x: blockCx, y: lifeY(L.oppPortrait) },
    darlingZone: {
      human: {
        x: darlingX(L.myHalf), y: myDarlingY, labelX: darlingX(L.myHalf), labelY: myDarlingY - 30,
        taxX: darlingX(L.myHalf) - 26, taxY: myDarlingY - 18, taxOriginX: 1,
        castX: darlingX(L.myHalf), castY: myDarlingY - 34, payDownX: darlingX(L.myHalf) - 90, payDownY: myDarlingY,
      },
      opponent: {
        x: darlingX(L.oppHalf), y: oppDarlingY, labelX: darlingX(L.oppHalf), labelY: oppDarlingY + 30,
        taxX: darlingX(L.oppHalf) - 26, taxY: oppDarlingY + 18, taxOriginX: 1,
        castX: darlingX(L.oppHalf), castY: 0, payDownX: 0, payDownY: 0,
      },
    },
    turnPill: { x: mainCx, y: L.line.y + L.line.height / 2 },
    phaseTrack: { x: mainCx, firstRowY: L.line.y + L.line.height / 2, rowStep: 0 },
    cluster: { x: primaryCx, passY: primaryCy, endTurnY: primaryCy, passR: L.primary.height / 2 },
    oppPiles: { x: countX(0), handY: oppCountsY, graveY: oppCountsY, deckY: oppCountsY, severedY: oppCountsY },
    piles: { x: countX(2), severedY: myCountsY, deckY: myCountsY, graveY: myCountsY },
    undo: { x: L.column.x + L.column.width / 2, y: L.column.y + 22 },
    menu: { x: L.menu.x + L.menu.width / 2, y: L.menu.y + L.menu.height / 2 },
  };
}

// ------------------------------------------------------------------ medallion rims

/** A medallion's rim follows the card's frame colour (the mocks' frameOf): gold for two or more colours. */
const MEDALLION_RIMS: Record<string, string> = {
  W: '#e6cf86',
  U: '#6ea3d8',
  B: '#9b82b4',
  R: '#d0563f',
  G: '#5fae6e',
  gold: '#eed77a',
  C: '#9aa0a8',
  land: '#b39a6c',
};

export function medallionRim(colors: readonly string[], types: readonly string[]): string {
  if (types.includes('land')) return MEDALLION_RIMS.land;
  if (colors.length >= 2) return MEDALLION_RIMS.gold;
  if (colors.length === 0) return MEDALLION_RIMS.C;
  return MEDALLION_RIMS[colors[0]] ?? MEDALLION_RIMS.C;
}

// ------------------------------------------------------------------ hand rows

export type HandRowTone = 'gold' | 'muted' | 'danger';

export interface HandRowLook {
  /** The second line: stats and kind, the card type, or why it cannot go on the board. */
  detail: string;
  /** The type glyph before it: a bolt for a Charm, a scroll for a Ritual. */
  icon: 'bolt' | 'scroll' | null;
  tone: HandRowTone;
  /** Drawn faded: not playable on your decision, or (on the foe's turn) anything but a Charm. */
  dim: boolean;
}

/** The engine's reasons a row can say in two words, as the mocks write them ("Board full"). */
const SHORT_REASONS: Record<string, string> = {
  'Your side of the battlefield is full of creatures.': 'Board full',
  'You have too many noncreature permanents in play.': 'Board full',
  'There are no legal targets for this spell.': 'No targets',
  "It can't be cast: it has no prey to hunt.": 'No prey to hunt',
  'You do not control enough creatures to pay Rite.': 'Too few for Rite',
};

/**
 * A hand row's second line and its strength (T-03a, T-10). On your decision a
 * playable card is drawn at full strength and the rest fade; a card the board
 * itself refuses says why. On the foe's turn the Charms stay lit (they can
 * answer the moment a window opens) and everything else fades.
 */
export function handRowLook(
  card: { types: readonly string[]; subtypes: readonly string[]; attack?: number; defense?: number },
  opts: { playable: boolean; reason: string | null; yourDecision: boolean },
): HandRowLook {
  const charm = card.types.includes('charm');
  const dim = opts.yourDecision ? !opts.playable : !charm;
  const short = opts.yourDecision && !opts.playable && opts.reason ? SHORT_REASONS[opts.reason] : undefined;
  if (short) return { detail: short, icon: null, tone: 'danger', dim };
  return {
    detail: deckRowDetail(card),
    icon: charm ? 'bolt' : card.types.includes('ritual') ? 'scroll' : null,
    tone: charm ? 'gold' : 'muted',
    dim,
  };
}

// ------------------------------------------------------------------ words

/** The turn line (T-03a, T-10): "Turn 8 · Your Morning", or the foe's name in place of "Your". */
export function turnLineLabel(turn: number, phase: string | null, foeName: string | null): string {
  if (turn === 0 || phase === null) return '';
  const word = phase.charAt(0) + phase.slice(1).toLowerCase();
  return `Turn ${turn} · ${foeName === null ? 'Your' : `${foeName}'s`} ${word}`;
}

/**
 * The desktop smart button's label in the phone's sentence case (M29):
 * "To Combat" reads "To combat", the pass arrow goes, and a keyword in
 * brackets keeps its capital.
 */
export function phoneActionLabel(label: string): string {
  return label
    .replace(/\s*[▶⏭]\s*/g, ' ')
    .trim()
    .split(' · ')
    .map((part) => part.replace(/(^|\s)([A-Z])([a-z]+)/g, (match, space: string, first: string, rest: string, offset: number) =>
      offset === 0 ? match : `${space}${first.toLowerCase()}${rest}`))
    .join(' · ');
}

/** A history line for the banner: the [card] marks dropped. */
export function plainHistoryLine(line: string): string {
  return line.replace(/\[([^\]]+)\]/g, '$1');
}
