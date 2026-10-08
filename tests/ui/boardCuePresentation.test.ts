import { describe, expect, it } from 'vitest';
import {
  BOARD_CUES,
  BOARD_CUE_STATES,
  CUE_CONTEXTS,
  TILE_FEATURES,
  coPresentPairs,
  awakeningRingVisible,
  cueColour,
  cueIn,
  featuresMeet,
  nonColourDifferences,
  pickBadgeLabel,
  cueCounterScale,
  cueScreenSize,
  CUE_MIN_SCREEN_PX,
  statsCue,
  sickSwirlBounds,
  tileChipBounds,
  tileChipLabel,
  type BoardCueState,
  type CueContext,
  type ScaledCue,
  type StatsCueInput,
  type TileChip,
  type TileChipInput,
  type TileFeature,
} from '../../src/ui/boardCuePresentation';
import { permanentActionLabel } from '../../src/ui/duelPresentation';
import { deltaE2000, deltaE2000Lab, rgbToLab, simulateVision, VISION_KINDS, type Lab } from './colourVision';

/**
 * The cue gate (plan-accessibility-i18n.md, "Gates", headless half): every
 * pair of duel states that can be on screen together differs in a non-colour
 * channel, or stays 10 or more apart in CIEDE2000 under normal vision and
 * simulated protanopia, deuteranopia and tritanopia, in both palettes. Plus
 * the two constraints the plan left to this module: the P/T cues no longer
 * exclusive, and the tile chip's priority.
 */

/** The gate's colour floor: the plan's "weak" threshold. */
const MIN_DELTA_E = 10;
const PALETTES = [
  { name: 'standard', highContrast: false },
  { name: 'high contrast', highContrast: true },
] as const;

describe('the colour-vision helper', () => {
  /** Sharma, Wu & Dalal (2005), Table 1: seven of the supplementary CIEDE2000 test pairs. */
  const SHARMA_2005: [Lab, Lab, number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];

  it("reproduces Sharma's published CIEDE2000 test data to four places, in either order", () => {
    for (const [a, b, expected] of SHARMA_2005) {
      expect(deltaE2000Lab(a, b)).toBeCloseTo(expected, 4);
      expect(deltaE2000Lab(b, a)).toBeCloseTo(expected, 4);
    }
  });

  it('converts sRGB to Lab under D65 (white, black and the sRGB red primary)', () => {
    const white = rgbToLab([255, 255, 255]);
    expect(white[0]).toBeCloseTo(100, 3);
    expect(Math.abs(white[1]) + Math.abs(white[2])).toBeLessThan(1e-3);
    expect(rgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 6);
    const red = rgbToLab([255, 0, 0]);
    expect(red[0]).toBeCloseTo(53.24, 2);
    expect(red[1]).toBeCloseTo(80.09, 2);
    expect(red[2]).toBeCloseTo(67.2, 2);
  });

  it('keeps greys grey and loses the axis each deficiency loses', () => {
    for (const kind of VISION_KINDS) {
      for (const channel of simulateVision([128, 128, 128], kind)) expect(channel, kind).toBeCloseTo(128, 2);
    }
    // A red and a green: collapse for protans and deutans, survive for tritans.
    const redGreen = (kind: (typeof VISION_KINDS)[number]) => deltaE2000('#d03030', '#30a030', kind);
    expect(redGreen('protanopia')).toBeLessThan(0.5 * redGreen('normal'));
    expect(redGreen('deuteranopia')).toBeLessThan(0.2 * redGreen('normal'));
    expect(redGreen('tritanopia')).toBeGreaterThan(0.8 * redGreen('normal'));
    // A yellow and a pink: the tritan confusion, clear for protans and deutans.
    const yellowPink = (kind: (typeof VISION_KINDS)[number]) => deltaE2000('#ffe28a', '#ffb0ff', kind);
    expect(yellowPink('tritanopia')).toBeLessThan(0.3 * yellowPink('normal'));
    expect(yellowPink('protanopia')).toBeGreaterThan(0.7 * yellowPink('normal'));
    expect(yellowPink('deuteranopia')).toBeGreaterThan(0.7 * yellowPink('normal'));
  });
});

describe('cue distinctness (the gate)', () => {
  it('covers every context: each has at least one pair of states on screen together', () => {
    const contexts = new Set(coPresentPairs().map((pair) => pair.context));
    for (const context of CUE_CONTEXTS) expect(contexts.has(context), context).toBe(true);
  });

  it('tells apart every pair of states on screen together, by a non-colour channel or by 10+ CIEDE2000 under every simulation, in both palettes', () => {
    const failures: string[] = [];
    for (const { a, b, context } of coPresentPairs()) {
      const cueA = cueIn(a, context)!;
      const cueB = cueIn(b, context)!;
      if (nonColourDifferences(cueA, cueB).length > 0) continue;
      if (cueA.rim === null || cueB.rim === null) {
        failures.push(`${a} / ${b} (${context}): no non-colour difference and no rings to compare`);
        continue;
      }
      for (const { name, highContrast } of PALETTES) {
        for (const kind of VISION_KINDS) {
          const de = deltaE2000(cueColour(cueA.rim, highContrast), cueColour(cueB.rim, highContrast), kind);
          if (de < MIN_DELTA_E) failures.push(`${a} / ${b} (${context}, ${name}, ${kind}): colour only, dE ${de.toFixed(1)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('gives every tile state a cue a plain tile does not have, whatever its colour', () => {
    for (const state of BOARD_CUE_STATES) {
      if (BOARD_CUES[state].surface !== 'tile') continue;
      for (const context of BOARD_CUES[state].contexts) {
        const cue = cueIn(state, context)!;
        const plain = { ...cue, rim: null, lift: false, pickBadge: false, chip: undefined, focusBrackets: false };
        expect(nonColourDifferences(cue, plain), `${state} in ${context}`).not.toEqual([]);
      }
    }
  });

  it('reads position where it is the real channel: while you declare blockers, attackers are across the board from your blockers', () => {
    const attacking = cueIn('attacking', 'declareBlockers')!;
    for (const blocker of ['pendingBlocker', 'assignedBlocker'] as const) {
      expect(nonColourDifferences(attacking, cueIn(blocker, 'declareBlockers')!), blocker).toContain('position');
    }
  });

  it('keeps the ring meaning "legal" while targeting: a declared attacker gives up its ring there but keeps its lift', () => {
    const targeting = BOARD_CUE_STATES.map((state) => cueIn(state, 'targeting')).filter((cue) => cue !== null);
    const ringed = targeting.filter((cue) => cue.surface === 'tile' && cue.rim !== null).map((cue) => cue.state);
    expect(ringed.sort()).toEqual(['legalTarget', 'legalTargetOpponent', 'pickedTarget', 'selectedSacrifice']);
    expect(cueIn('attacking', 'targeting')!.lift).toBe(true);
    expect(cueIn('attacking', 'declareBlockers')!.rim).not.toBeNull();
    // Declaration, responses and target choices may alternate throughout
    // combat; the position continues to record the declaration in all three.
    for (const context of ['declareBlockers', 'idle', 'targeting'] as const) {
      expect(cueIn('attacking', context)!.lift, context).toBe(true);
    }
    // An awakened attacker must not retain its other perimeter ring while
    // the combat ring yields; after choosing, its persistent ring returns.
    expect(awakeningRingVisible(true, 'targeting')).toBe(false);
    expect(awakeningRingVisible(true, 'idle')).toBe(true);
    expect(awakeningRingVisible(false, 'idle')).toBe(false);
  });
});

describe('the pick badge', () => {
  it('numbers picks from 1 in pick order and is absent for anything not picked', () => {
    expect(pickBadgeLabel(0)).toBe('1');
    expect(pickBadgeLabel(1)).toBe('2');
    // Independent slots may choose the same creature: keep both slot numbers
    // on that creature, rather than losing the second pick to findIndex.
    expect(pickBadgeLabel([0, 1])).toBe('1, 2');
    expect(pickBadgeLabel([1, 2])).toBe('2, 3');
    expect(pickBadgeLabel([])).toBeNull();
    for (const none of [null, undefined, -1, 0.5]) expect(pickBadgeLabel(none)).toBeNull();
  });

  /**
   * The plan's picks (plan "Cues": a picked target on either side, a picked
   * graveyard card, a picked player) and the edict's sacrifice picks.
   */
  const PICKS: readonly BoardCueState[] = ['pickedTarget', 'selectedSacrifice', 'gravePicked', 'playerPicked'];

  it('marks every pick with the badge, on a tile, a graveyard card and a portrait, and nothing that is not a pick', () => {
    for (const state of BOARD_CUE_STATES) expect(Boolean(BOARD_CUES[state].pickBadge), state).toBe(PICKS.includes(state));
  });
});

describe('the P/T cues (no longer one exclusive mood)', () => {
  const input = (partial: Partial<StatsCueInput>): StatsCueInput => ({ damage: 0, attackDelta: 0, defenseDelta: 0, marks: 0, ...partial });

  it('shows damage and a raise together: damage no longer hides a buff', () => {
    // A 2/2 with two Marks, dealt 1: plate 4/3, damaged and raised, two Marks.
    const cue = statsCue(input({ damage: 1, attackDelta: 2, defenseDelta: 2, marks: 2 }));
    expect(cue.glyphs).toContain('damage');
    expect(cue.glyphs).toContain('raised');
    expect(cue.markBadge).toBe(2);
    // A temporary boost adds to the same effective-stat arrow; the badge
    // still counts only the two Marks rather than every point of the boost.
    const boosted = statsCue(input({ damage: 1, attackDelta: 5, defenseDelta: 2, marks: 2 }));
    expect(boosted.glyphs).toEqual(['damage', 'raised']);
    expect(boosted.markBadge).toBe(2);
  });

  it('shows both chevrons when one stat is up and the other down', () => {
    // A 3/3 given -2/-0 with one Mark: 2/4, attack down and defense up.
    const cue = statsCue(input({ attackDelta: -1, defenseDelta: 1, marks: 1 }));
    expect(cue.glyphs).toEqual(expect.arrayContaining(['raised', 'lowered']));
    expect(cue.markBadge).toBe(1);
  });

  it('counts Marks on their own badge even when other effects cancel them out on the plate', () => {
    // One Mark (+1/+1) and a -1/-1: the plate shows the printed numbers, no chevron, and the Mark is still visible.
    const cue = statsCue(input({ attackDelta: 0, defenseDelta: 0, marks: 1 }));
    expect(cue.glyphs).toEqual([]);
    expect(cue.markBadge).toBe(1);
    expect(statsCue(input({ marks: 0 })).markBadge).toBeNull();
  });

  it('gives each combination of damaged, raised, lowered and Mark count its own look', () => {
    const seen = new Map<string, string>();
    for (const damage of [0, 2]) {
      for (const attackDelta of [-1, 0, 1]) {
        for (const defenseDelta of [-1, 0, 1]) {
          for (const marks of [0, 1, 3]) {
            const facts = JSON.stringify({
              damaged: damage > 0,
              up: attackDelta > 0 || defenseDelta > 0,
              down: attackDelta < 0 || defenseDelta < 0,
              marks,
            });
            const cue = statsCue({ damage, attackDelta, defenseDelta, marks });
            const look = JSON.stringify({ glyphs: [...cue.glyphs].sort(), markBadge: cue.markBadge });
            const earlier = seen.get(look);
            expect(earlier === undefined || earlier === facts, `${facts} looks like ${earlier}`).toBe(true);
            seen.set(look, facts);
          }
        }
      }
    }
  });

  it("keeps the plate's hue for each kind of change, as the board shows it today", () => {
    const cases: [string, Partial<StatsCueInput>, string][] = [
      ['an untouched creature', {}, 'normal'],
      ['a 2/2 given +1/+1 and dealt 1', { damage: 1, attackDelta: 1, defenseDelta: 1 }, 'damaged'],
      ['a 2/2 dealt 1 and given -1/-1', { damage: 1, attackDelta: -1, defenseDelta: -1 }, 'damaged'],
      ['a creature given +1/+0', { attackDelta: 1 }, 'buffed'],
      ['a creature with one Mark', { attackDelta: 1, defenseDelta: 1, marks: 1 }, 'buffed'],
      ['a creature given +2/-1', { attackDelta: 2, defenseDelta: -1 }, 'buffed'],
      ['a creature given -0/-2', { defenseDelta: -2 }, 'weakened'],
    ];
    for (const [what, partial, tone] of cases) expect(statsCue(input(partial)).tone, what).toBe(tone);
  });
});

describe('the tile chip and its priority', () => {
  const none = { link: null, dutyUsable: false, canAttack: false, assignedBlocker: false } as const;

  it('names the action the tile is part of, and when two apply, the one a tap would take: a Hauntlink move, then a Duty, then the pump, then the attack toggle, then a block record', () => {
    expect(tileChipLabel({ ...none, link: 'Link', dutyUsable: true, canAttack: true })).toBe('Link');
    expect(tileChipLabel({ ...none, link: 'Relink', dutyUsable: true, boostUsable: true })).toBe('Relink');
    expect(tileChipLabel({ ...none, dutyUsable: true, boostUsable: true, canAttack: true })).toBe('Duty');
    expect(tileChipLabel({ ...none, boostUsable: true, canAttack: true })).toBe('Boost');
    expect(tileChipLabel({ ...none, boostUsable: true })).toBe('Boost');
    expect(tileChipLabel({ ...none, canAttack: true, assignedBlocker: true })).toBe('Attack');
    expect(tileChipLabel({ ...none, canAttack: true })).toBe('Attack');
    expect(tileChipLabel({ ...none, assignedBlocker: true })).toBe('Blocks');
    expect(tileChipLabel(none)).toBeNull();
    expect(cueIn('selectedAttacker', 'declareAttackers')!.chip).toBe('Attack');
  });

  it("agrees with today's permanentActionLabel wherever combat adds no chip", () => {
    for (const link of [null, 'Link', 'Relink'] as const) {
      for (const dutyUsable of [false, true]) {
        for (const boostUsable of [false, true]) {
          expect(tileChipLabel({ ...none, link, dutyUsable, boostUsable }), `${link} ${dutyUsable} ${boostUsable}`)
            .toBe(permanentActionLabel(link, dutyUsable, boostUsable));
        }
      }
    }
  });

  /**
   * What can be true of a tile in each context (the engine offers Link,
   * Relink and Duty only outside the combat declarations, and a pending cast
   * hides every action), and so which chips `tileChipLabel` can return there.
   */
  const CHIP_INPUTS: Record<CueContext, readonly Partial<TileChipInput>[]> = {
    targeting: [],
    declareAttackers: [{ canAttack: true }],
    declareBlockers: [{ assignedBlocker: true }],
    idle: [{ link: 'Link' }, { link: 'Relink' }, { dutyUsable: true }, { boostUsable: true }],
    gravePicking: [],
  };

  it('puts a chip on a state only where tileChipLabel can name it in that context', () => {
    const actions: readonly TileChip[] = ['Link', 'Relink', 'Duty', 'Boost'];
    for (const state of BOARD_CUE_STATES) {
      const chip = BOARD_CUES[state].chip;
      if (!chip) continue;
      for (const context of BOARD_CUES[state].contexts) {
        const possible = CHIP_INPUTS[context].map((partial) => tileChipLabel({ ...none, ...partial }));
        const named = chip === 'action' ? actions : [chip];
        expect(named.some((label) => possible.includes(label)), `${state} in ${context}`).toBe(true);
      }
    }
  });
});

describe('cue size on a shrunken tile', () => {
  it('draws every cue at least its minimum size on screen at any tile scale, and no larger than that on a small tile', () => {
    for (let tileScale = 0.3; tileScale <= 1.5 + 1e-9; tileScale += 0.05) {
      for (const cue of Object.keys(CUE_MIN_SCREEN_PX) as ScaledCue[]) {
        const onScreen = cueScreenSize(cue, tileScale);
        expect(onScreen, `${cue} at ${tileScale.toFixed(2)}`).toBeGreaterThanOrEqual(CUE_MIN_SCREEN_PX[cue] - 1e-9);
        if (tileScale <= 1) expect(onScreen, `${cue} at ${tileScale.toFixed(2)}`).toBeCloseTo(CUE_MIN_SCREEN_PX[cue], 9);
      }
    }
    // The board's own scales: a 0.45 tile draws its cues at 1/0.45.
    expect(cueCounterScale(0.45)).toBeCloseTo(1 / 0.45, 9);
    expect(cueCounterScale(1.5)).toBe(1);
  });
});

describe('where the cues sit on a tile', () => {
  it('keeps a readable top-edge action tab clear of the sick swirl even when the tile shrinks', () => {
    const swirl = sickSwirlBounds(156, 170);
    for (const scale of [0.3, 0.45, 0.55, 0.8, 1]) {
      for (const width of [35, 48, 64]) {
        const chip = tileChipBounds(156, 170, width, 16, scale);
        expect(chip.x + chip.width / 2).toBe(0);
        expect(chip.y).toBeLessThan(-170 / 2);
        expect(chip.width * scale).toBeGreaterThanOrEqual(width);
        const overlapX = Math.min(chip.x + chip.width, swirl.x + swirl.width) - Math.max(chip.x, swirl.x);
        const overlapY = Math.min(chip.y + chip.height, swirl.y + swirl.height) - Math.max(chip.y, swirl.y);
        expect(overlapX <= 0 || overlapY <= 0, `chip ${width}px at ${scale}`).toBe(true);
      }
    }
  });

  it('never puts two features that can share a tile on the same spot', () => {
    const features = Object.keys(TILE_FEATURES) as TileFeature[];
    for (let i = 0; i < features.length; i++) {
      for (let j = i + 1; j < features.length; j++) {
        const [a, b] = [features[i], features[j]];
        if (!featuresMeet(a, b)) continue;
        expect(TILE_FEATURES[a].anchor, `${a} / ${b}`).not.toBe(TILE_FEATURES[b].anchor);
      }
    }
  });
});
