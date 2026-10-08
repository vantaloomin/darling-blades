import { describe, expect, it } from 'vitest';
import { cardRoles, rateCard } from '../../scripts/personas/score';
import { cardTermNames } from '../../src/data/glossary';
import type { CardDef, EffectOp, TargetSpec } from '../../src/engine/types';
import { DEFAULT_PICKER, scoreBasePick } from '../../src/meta/draftPicker';

/**
 * The effects inside an "If it survived" gate (A1.6) are the card's effects
 * everywhere the catalog is read, as an If-marked branch's are: the draft
 * picker's pick score, the glossary's terms (which the keyword-coverage check
 * reads), and the persona rate and roles. Fixture cards only.
 */
const HUNT_TARGETS: TargetSpec[] = [{ what: 'yourCreature' }, { what: 'opponentCreature' }];
const PUMP_AND_HUNT: EffectOp[] = [{ op: 'boost', p: 1, t: 1, scope: 'target' }, { op: 'hunt', hunter: 'target' }];
const gate = (then: EffectOp[]): EffectOp => ({ op: 'ifTargetSurvives', then });
const ritual = (id: string, ops: EffectOp[], targets: TargetSpec[] = HUNT_TARGETS): CardDef => ({
  id, name: id, types: ['ritual'], subtypes: [], colors: ['G'], rarity: 'r',
  cost: { generic: 3, pips: { G: 1 } }, abilities: [{ when: 'spell', targets, ops }],
});

describe('effects inside If it survived', () => {
  it('count toward the draft pick: Ambush drafts above the same card with no draw', () => {
    const ambush = ritual('ambush', [...PUMP_AND_HUNT, gate([{ op: 'draw', n: 1 }])]);
    const bare = ritual('bare', PUMP_AND_HUNT);
    expect(scoreBasePick(ambush, DEFAULT_PICKER)).toBeGreaterThan(scoreBasePick(bare, DEFAULT_PICKER));
  });

  it('teach the keywords they grant (the glossary terms the keyword-coverage check reads)', () => {
    const grant = ritual('grant', [gate([{ op: 'boost', p: 1, t: 1, scope: 'target', keywords: ['skyborne'] }])], [{ what: 'yourCreature' }]);
    expect(cardTermNames(grant)).toContain('Skyborne');
  });

  it('are priced and give roles in the persona score', () => {
    const drawn = ritual('drawn', [...PUMP_AND_HUNT, gate([{ op: 'draw', n: 1 }])]);
    const empty = ritual('empty', [...PUMP_AND_HUNT, gate([])]);
    expect(rateCard(drawn)).toBeGreaterThan(rateCard(empty));
    const kill = ritual('kill', [gate([{ op: 'destroy', to: 'target' }])], [{ what: 'creature' }]);
    expect(cardRoles(kill)).toContain('removal');
  });
});
