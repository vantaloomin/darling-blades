/**
 * The duel's state cues as data (1.9 lane C, C5): which board, graveyard and
 * portrait states a player must read to make a legal choice, which of them can
 * be on screen together, and the non-colour channel each one carries so that
 * nobody has to tell two hues apart to play (plan-accessibility-i18n.md,
 * "Cues", and the cue policy: always on, no vision profiles).
 *
 * Phaser-free and not yet wired: `BoardCardView` and `DuelScene` move onto
 * this table in the Duel pass (accessibility wave 2), after the owner has seen
 * the cue mock. Until then the tile still draws its own copy of these colours
 * (`BoardCardView`'s `BORDER_COLORS`), so a colour change must land in both.
 *
 * Two constraints the plan asked the mock to settle are settled here as API:
 * - `statsCue` takes damage, the stat change and the Mark count as separate
 *   inputs and returns a glyph set, so damage no longer hides a buff and a
 *   Mark is counted on its own badge (today's `StatsMood` is one exclusive
 *   value; `damaged` wins).
 * - `tileChipLabel` fixes which chip a tile shows when more than one action
 *   applies (`TILE_CHIP_PRIORITY`, with the reason beside it).
 */

import { resolveTokens, type Palette } from './accessibility';

// ---------------------------------------------------------------------------
// States and when they share the screen
// ---------------------------------------------------------------------------

/**
 * The decision the duel is waiting on, as far as the cues are concerned. Two
 * states can be on screen together exactly when they share a context.
 * - `targeting`: a spell or ability is choosing targets (a pending cast, or
 *   the engine's mandatory `chooseTarget`), including edict picks.
 * - `declareAttackers` / `declareBlockers`: your combat declarations.
 * - `idle`: a main phase or response window with nothing pending, where a
 *   permanent may offer an action (Link, Relink, Duty) and, in combat, the
 *   declared attackers are still attacking.
 * - `gravePicking`: the graveyard target picker is open.
 */
export type CueContext = 'targeting' | 'declareAttackers' | 'declareBlockers' | 'idle' | 'gravePicking';

export const CUE_CONTEXTS: readonly CueContext[] = ['targeting', 'declareAttackers', 'declareBlockers', 'idle', 'gravePicking'];

/** What carries the cue: a battlefield tile, a card in the graveyard picker, or a player's portrait. */
export type CueSurface = 'tile' | 'graveCard' | 'portrait';

export type BoardCueState =
  /** A legal target on your side (the friendly ring). */
  | 'legalTarget'
  /** A legal target on the opponent's side (the hostile ring). */
  | 'legalTargetOpponent'
  /** A target already picked for the pending spell (first or second pick). */
  | 'pickedTarget'
  /** The keyboard's current target, on top of whatever ring the tile has. */
  | 'keyboardFocus'
  /** A creature picked for a sacrifice cost or an edict. */
  | 'selectedSacrifice'
  /** Your creature that can attack, in declare attackers. */
  | 'eligibleAttacker'
  /** Your creature picked to attack, before the declaration is confirmed. */
  | 'selectedAttacker'
  /** A declared attacker, for the rest of combat. */
  | 'attacking'
  /** Your creature picked to block, before it is pointed at an attacker. */
  | 'pendingBlocker'
  /** Your creature assigned to block an attacker. */
  | 'assignedBlocker'
  /** Your permanent that can take an action now (Link, Relink or Duty). */
  | 'actionReady'
  /** A graveyard card the picker offers. */
  | 'graveLegal'
  /** A graveyard card already picked. */
  | 'gravePicked'
  /** A player the pending spell may target (the portrait's ring). */
  | 'playerLegal'
  /** A player already picked as a target. */
  | 'playerPicked';

/** Where a state sits on the board, from your point of view. */
export type CueSide = 'yours' | 'theirs' | 'either';

/**
 * The colour a state's ring or border draws in. Tokens resolve through the
 * palette in force (`cueColour`); the fixed hexes are board specialist colours
 * that high contrast leaves alone (it thickens the stroke instead).
 */
export type CueColour =
  | { readonly token: keyof Palette }
  | { readonly hex: string };

/**
 * One state's cue. Colour is `rim`; every other field is a non-colour channel
 * (the plan's shape, label, badge, icon and position).
 */
export interface BoardCueSpec {
  readonly surface: CueSurface;
  readonly contexts: readonly CueContext[];
  /** The ring or border colour, or null when the state draws no ring. */
  readonly rim: CueColour | null;
  /**
   * Contexts in which this state's ring is not drawn. While targeting, the
   * ring means "legal" and nothing else: a declared attacker keeps its lift
   * but gives up its ring, so a ring's presence never has to be read by hue.
   */
  readonly rimYieldsIn?: readonly CueContext[];
  /** Position: which side of the board it can be on. */
  readonly side: CueSide;
  /** Position in a given context, where it is narrower than `side`. */
  readonly sideIn?: Partial<Record<CueContext, CueSide>>;
  /** Position: the tile stands forward of its row (the 12px lift selected attackers use today). */
  readonly lift?: boolean;
  /** Badge: the pick order (1, 2) on a round badge. */
  readonly pickBadge?: boolean;
  /** Label: the tile's action chip. `action` is whichever of Link, Relink or Duty applies. */
  readonly chip?: TileChip | 'action';
  /** Shape: corner brackets outside the tile, drawn over any ring. */
  readonly focusBrackets?: boolean;
}

const HEX = (hex: string): CueColour => ({ hex });
const TOKEN = (token: keyof Palette): CueColour => ({ token });

/**
 * The board specialist colours, as `BoardCardView` draws them today. The
 * attacker and pending-blocker hues are not changed here: the cues below stop
 * depending on them.
 */
export const BOARD_CUE_HEX = {
  legalTarget: '#6ee87d',
  picked: '#ff8a6a',
  sacrifice: '#d4a3ff',
  attacking: '#ffb09a',
  blocking: '#7fb0ff',
  pendingBlocker: '#5a9aff',
  eligible: '#ffe28a',
} as const;

/**
 * The state-to-cue table. Recommended designs, one per state, for the owner's
 * mock review (plan Q5); the Duel pass builds them.
 */
export const BOARD_CUES: Readonly<Record<BoardCueState, BoardCueSpec>> = {
  legalTarget: { surface: 'tile', contexts: ['targeting'], rim: HEX(BOARD_CUE_HEX.legalTarget), side: 'yours' },
  legalTargetOpponent: { surface: 'tile', contexts: ['targeting'], rim: TOKEN('dangerArmed'), side: 'theirs' },
  pickedTarget: {
    surface: 'tile',
    contexts: ['targeting'],
    rim: HEX(BOARD_CUE_HEX.picked),
    side: 'either',
    pickBadge: true,
  },
  // An overlay: the focused tile is always a legal or picked target and keeps
  // that ring; the brackets (in the heading colour, `outline.focus` thick) are
  // the focus cue, so it no longer borrows the pending-blocker hue.
  keyboardFocus: { surface: 'tile', contexts: ['targeting'], rim: null, side: 'either', focusBrackets: true },
  // A pick like any other (DuelScene keeps the edict's picks in order,
  // `edictPicks`), so it carries the pick badge rather than resting on its hue.
  selectedSacrifice: {
    surface: 'tile',
    contexts: ['targeting'],
    rim: HEX(BOARD_CUE_HEX.sacrifice),
    side: 'yours',
    pickBadge: true,
  },
  eligibleAttacker: {
    surface: 'tile',
    contexts: ['declareAttackers'],
    rim: HEX(BOARD_CUE_HEX.eligible),
    side: 'yours',
    chip: 'Attack',
  },
  selectedAttacker: {
    surface: 'tile',
    contexts: ['declareAttackers'],
    rim: HEX(BOARD_CUE_HEX.picked),
    side: 'yours',
    lift: true,
    chip: 'Attack',
  },
  attacking: {
    surface: 'tile',
    contexts: ['declareBlockers', 'idle', 'targeting'],
    rim: HEX(BOARD_CUE_HEX.attacking),
    rimYieldsIn: ['targeting'],
    side: 'either',
    // While you declare blockers, the attackers are the opponent's.
    sideIn: { declareBlockers: 'theirs' },
    lift: true,
  },
  pendingBlocker: {
    surface: 'tile',
    contexts: ['declareBlockers'],
    rim: HEX(BOARD_CUE_HEX.pendingBlocker),
    side: 'yours',
    lift: true,
  },
  assignedBlocker: {
    surface: 'tile',
    contexts: ['declareBlockers'],
    rim: HEX(BOARD_CUE_HEX.blocking),
    side: 'yours',
    chip: 'Blocks',
  },
  // Not listed while targeting: a pending cast hides every action (DuelScene's
  // `activateActionsFor` and `hauntlinkActionsFor` return none), so the gold
  // ring and a legal target's green one never meet. For the Duel pass:
  // DuelScene's 350ms gold flash when a Duty resolves (`dutyHighlights`) is an
  // event, not a decision state, and must never paint a ring while targeting,
  // where a ring means "legal".
  actionReady: { surface: 'tile', contexts: ['idle'], rim: HEX(BOARD_CUE_HEX.eligible), side: 'yours', chip: 'action' },
  // Today a picked graveyard card is only faded to `alpha.subtle`, which reads
  // as "unavailable"; the badge replaces the fade.
  graveLegal: { surface: 'graveCard', contexts: ['gravePicking'], rim: null, side: 'either' },
  gravePicked: { surface: 'graveCard', contexts: ['gravePicking'], rim: null, side: 'either', pickBadge: true },
  // The ring's tone follows the player (`playerRingColour`); today it is the
  // same before and after the pick, so the badge is the pick's only cue.
  playerLegal: { surface: 'portrait', contexts: ['targeting'], rim: TOKEN('success'), side: 'either' },
  playerPicked: { surface: 'portrait', contexts: ['targeting'], rim: TOKEN('success'), side: 'either', pickBadge: true },
};

export const BOARD_CUE_STATES = Object.keys(BOARD_CUES) as BoardCueState[];

/**
 * A player's ring takes the tone of the player (the friendly ring on your
 * portrait, the hostile one on the opponent's, as `targetRingTone` rules
 * today); the portrait's position is the non-colour cue for whose it is.
 */
export function playerRingColour(side: 'yours' | 'theirs'): CueColour {
  return side === 'theirs' ? TOKEN('dangerArmed') : TOKEN('success');
}

/** A cue colour as `#rrggbb` in the standard or high-contrast palette. */
export function cueColour(colour: CueColour, highContrast: boolean): string {
  return 'hex' in colour ? colour.hex : resolveTokens({ highContrast }).colors[colour.token];
}

/** A state as it appears in one context: its ring (null when absent or yielded) and its other channels. */
export interface ResolvedCue extends BoardCueSpec {
  readonly state: BoardCueState;
  readonly context: CueContext;
  readonly rim: CueColour | null;
}

export function cueIn(state: BoardCueState, context: CueContext): ResolvedCue | null {
  const spec = BOARD_CUES[state];
  if (!spec.contexts.includes(context)) return null;
  const rim = spec.rimYieldsIn?.includes(context) ? null : spec.rim;
  return { ...spec, state, context, rim, side: spec.sideIn?.[context] ?? spec.side };
}

/** Every pair of states on the same surface that can be on screen together, with the context they share. */
export function coPresentPairs(): { a: BoardCueState; b: BoardCueState; context: CueContext }[] {
  const out: { a: BoardCueState; b: BoardCueState; context: CueContext }[] = [];
  for (const context of CUE_CONTEXTS) {
    const present = BOARD_CUE_STATES.filter((state) => BOARD_CUES[state].contexts.includes(context));
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        if (BOARD_CUES[present[i]].surface === BOARD_CUES[present[j]].surface) out.push({ a: present[i], b: present[j], context });
      }
    }
  }
  return out;
}

export type NonColourChannel = 'ring' | 'position' | 'lift' | 'badge' | 'label' | 'brackets';

function sidesOverlap(a: CueSide, b: CueSide): boolean {
  return a === 'either' || b === 'either' || a === b;
}

/**
 * The non-colour channels that tell two resolved cues apart: a ring on one and
 * not the other (shape), board sides that cannot overlap (position), a lift,
 * a pick badge, a different chip label, or focus brackets. Empty when
 * only colour could separate them.
 */
export function nonColourDifferences(a: ResolvedCue, b: ResolvedCue): NonColourChannel[] {
  const out: NonColourChannel[] = [];
  if ((a.rim === null) !== (b.rim === null)) out.push('ring');
  if (!sidesOverlap(a.side, b.side)) out.push('position');
  if (Boolean(a.lift) !== Boolean(b.lift)) out.push('lift');
  if (Boolean(a.pickBadge) !== Boolean(b.pickBadge)) out.push('badge');
  if ((a.chip ?? null) !== (b.chip ?? null)) out.push('label');
  if (Boolean(a.focusBrackets) !== Boolean(b.focusBrackets)) out.push('brackets');
  return out;
}

// ---------------------------------------------------------------------------
// The pick badge
// ---------------------------------------------------------------------------

/**
 * The pick badge's text: the pick's 1-based order. A one-target spell shows
 * "1" too, so the badge reads the same whether a spell takes one target or
 * two (A2's two-target flow). Null for anything not picked.
 */
export function pickBadgeLabel(pickIndex: number | null | undefined): string | null {
  if (pickIndex === null || pickIndex === undefined || !Number.isInteger(pickIndex) || pickIndex < 0) return null;
  return String(pickIndex + 1);
}

// ---------------------------------------------------------------------------
// The tile chip and its priority
// ---------------------------------------------------------------------------

/** Chip text a tile can carry. "Attack" and "Blocks" are new in 1.9 (player copy for approval). */
export type TileChip = 'Link' | 'Relink' | 'Duty' | 'Attack' | 'Blocks';

export const ATTACK_CHIP_LABEL = 'Attack';
export const BLOCKS_CHIP_LABEL = 'Blocks';

/**
 * When more than one chip applies, the first in this list shows.
 *
 * A chip names the action the tile is part of: the move it can make
 * (Link, Relink, Duty), the attack it can join or has joined (a tap on a
 * selected attacker withdraws it while the chip still says Attack), the block
 * it is assigned to.
 *
 * Why this order: when two could apply, the chip names what a tap would do, so
 * it follows the order `DuelScene.onBattlefieldClick` dispatches a tap in: a
 * legal Hauntlink move first, then a Duty, then the attacker toggle. "Blocks"
 * comes last because it records an assignment rather than offering an
 * action. Today the rules never offer two of these at once (the engine's
 * declare-attackers and declare-blockers decisions list only their own
 * declarations, so Link, Relink and Duty are never legal beside Attack or
 * Blocks); the order is the answer if a later rule opens a window where they
 * overlap, and it keeps the chip truthful about the tap in that case.
 */
export const TILE_CHIP_PRIORITY: readonly TileChip[] = ['Link', 'Relink', 'Duty', 'Attack', 'Blocks'];

export interface TileChipInput {
  /** A legal Hauntlink move, as `hauntlinkActionLabel` names it. */
  readonly link: 'Link' | 'Relink' | null;
  /** A Duty that can be performed now. */
  readonly dutyUsable: boolean;
  /** Declaring attackers, and this creature can attack (selected or not). */
  readonly canAttack: boolean;
  /** Declaring blockers, and this creature is assigned to block. */
  readonly assignedBlocker: boolean;
}

/** The chip a tile shows, by `TILE_CHIP_PRIORITY`; null for none. */
export function tileChipLabel(input: TileChipInput): TileChip | null {
  const applies: Record<TileChip, boolean> = {
    Link: input.link === 'Link',
    Relink: input.link === 'Relink',
    Duty: input.dutyUsable,
    Attack: input.canAttack,
    Blocks: input.assignedBlocker,
  };
  return TILE_CHIP_PRIORITY.find((chip) => applies[chip]) ?? null;
}

// ---------------------------------------------------------------------------
// P/T glyphs and the Mark badge (replaces the exclusive StatsMood)
// ---------------------------------------------------------------------------

export interface StatsCueInput {
  /** Damage marked on the creature this turn. */
  readonly damage: number;
  /** Effective attack minus printed attack (Marks and every other effect included). */
  readonly attackDelta: number;
  /** Effective defense minus printed defense, before damage (Marks and every other effect included). */
  readonly defenseDelta: number;
  /** Marks (+1/+1) on the creature. */
  readonly marks: number;
}

/**
 * A glyph at the P/T plate: a damage mark (a bold slash cut through the
 * plate's left end), an up chevron, a down chevron.
 */
export type StatGlyph = 'damage' | 'raised' | 'lowered';

/** Today's P/T text colours, kept as a second channel beside the glyphs. */
export type StatsTone = 'normal' | 'damaged' | 'buffed' | 'weakened';

export interface StatsCue {
  /** In drawing order along the plate. Both chevrons show when one stat is up and the other down. */
  readonly glyphs: readonly StatGlyph[];
  /** The Mark badge's count, or null when the creature has no Marks. */
  readonly markBadge: number | null;
  /**
   * The P/T text colour. It keeps today's precedence (damaged, then buffed,
   * then weakened) so the plate's hue does not change for any creature; the
   * glyphs now carry what the hue alone used to.
   */
  readonly tone: StatsTone;
}

/**
 * The P/T plate's cues from separate inputs. The chevrons read the numbers
 * the plate prints against the printed card (Marks included), so a chevron
 * always agrees with the numbers; the Mark badge says how many of that change
 * are Marks. Damage adds its own mark and never hides a chevron.
 */
export function statsCue(input: StatsCueInput): StatsCue {
  const damaged = input.damage > 0;
  const raised = input.attackDelta > 0 || input.defenseDelta > 0;
  const lowered = input.attackDelta < 0 || input.defenseDelta < 0;
  const glyphs: StatGlyph[] = [];
  if (damaged) glyphs.push('damage');
  if (raised) glyphs.push('raised');
  if (lowered) glyphs.push('lowered');
  const marks = Number.isFinite(input.marks) ? Math.max(0, Math.floor(input.marks)) : 0;
  return {
    glyphs,
    markBadge: marks > 0 ? marks : null,
    tone: damaged ? 'damaged' : raised ? 'buffed' : lowered ? 'weakened' : 'normal',
  };
}

// ---------------------------------------------------------------------------
// Size on screen: cues keep a readable size on shrunken tiles
// ---------------------------------------------------------------------------

/**
 * The smallest a cue may draw on screen, in design pixels, whatever the tile's
 * scale (the board draws tiles at 0.45-0.55, the Hauntlink underlap smaller).
 * The chip's 10px type is today's floor (`BoardCardView.setActionLabel`);
 * the badge, glyphs and Mark badge are the proposals in the cue mock.
 */
export const CUE_MIN_SCREEN_PX = {
  /** Pick badge diameter. */
  pickBadge: 24,
  /** Chip type size. */
  chip: 10,
  /** P/T glyph height (the damage notch and the chevrons). */
  statGlyph: 11,
  /** Mark badge type size (its plus glyph matches it). */
  markBadge: 11,
} as const;

export type ScaledCue = keyof typeof CUE_MIN_SCREEN_PX;

/**
 * The counter-scale a cue drawn inside a tile takes, the chip's rule applied
 * to every cue: a tile shown below full size draws its cues at 1/tileScale, so
 * they keep their design size on screen; a tile at full size or larger draws
 * them at 1.
 */
export function cueCounterScale(tileScale: number): number {
  return tileScale > 0 ? Math.max(1, 1 / tileScale) : 1;
}

/** A cue's size on screen for a tile at `tileScale`, drawn at its minimum size inside the tile. */
export function cueScreenSize(cue: ScaledCue, tileScale: number): number {
  return CUE_MIN_SCREEN_PX[cue] * cueCounterScale(tileScale) * tileScale;
}

// ---------------------------------------------------------------------------
// Where each cue sits on a tile
// ---------------------------------------------------------------------------

/**
 * A spot on the 156x170 tile. `topEdge` is a tab centred on the top edge,
 * half outside the tile, clear of the keyword column (top left), the
 * summoning-sickness swirl (top right) and the name (under the top edge).
 * `outsideCorners` is outside the tile's rim, so brackets never cover a badge.
 */
export type TileAnchor =
  | 'rim'
  | 'outsideCorners'
  | 'center'
  | 'topEdge'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'
  | 'abovePtPlate';

/** What a tile can show, the cues above plus the ones it already draws. */
export type TileFeature =
  | 'stateRing'
  | 'focusBrackets'
  | 'pickBadge'
  | 'chip'
  | 'keywordColumn'
  | 'sickSwirl'
  | 'auraBadge'
  | 'markBadge'
  | 'ptPlate'
  | 'ptGlyphs'
  | 'chapterBadge';

/**
 * Anchors, and which kinds of permanent carry each feature. Features on the
 * same tile must not share an anchor; a creature-only and a quest-only
 * feature never meet. The chip moves from today's top-right corner to the top
 * edge: a summoning-sick creature can block, so "Blocks" and the swirl can
 * share a tile.
 */
export const TILE_FEATURES: Readonly<Record<TileFeature, { anchor: TileAnchor; on: 'any' | 'creature' | 'quest' }>> = {
  stateRing: { anchor: 'rim', on: 'any' },
  focusBrackets: { anchor: 'outsideCorners', on: 'any' },
  pickBadge: { anchor: 'center', on: 'any' },
  chip: { anchor: 'topEdge', on: 'any' },
  keywordColumn: { anchor: 'topLeft', on: 'any' },
  sickSwirl: { anchor: 'topRight', on: 'creature' },
  auraBadge: { anchor: 'bottomLeft', on: 'any' },
  markBadge: { anchor: 'bottomCenter', on: 'creature' },
  ptPlate: { anchor: 'bottomRight', on: 'creature' },
  ptGlyphs: { anchor: 'abovePtPlate', on: 'creature' },
  chapterBadge: { anchor: 'bottomRight', on: 'quest' },
};

/** Whether two features can be on one tile at once. */
export function featuresMeet(a: TileFeature, b: TileFeature): boolean {
  const on = [TILE_FEATURES[a].on, TILE_FEATURES[b].on];
  return !(on.includes('creature') && on.includes('quest'));
}
