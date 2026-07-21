import { describe, expect, it } from 'vitest';
import { byId } from '../../src/data/catalog';
import { cardRoles, rateCard, scoreCard, type PersonaDeckState } from '../../scripts/personas/score';
import { personaTemplate, type PersonaTemplate } from '../../scripts/personas/templates';

const emptyState = (): PersonaDeckState => ({
  cards: [],
  roleCounts: { threats: 0, removal: 0, interaction: 0, draw: 0, finishers: 0, lands: 24 },
  curveCounts: { early: 0, mid: 0, late: 0 },
  selectedColors: ['R', 'B'],
});

describe('persona card scoring', () => {
  it('is deterministic for the same card, template, and deck state', () => {
    const card = byId('in-doom-bolt');
    const template = personaTemplate('attrition');
    expect(scoreCard(card, template, emptyState())).toEqual(scoreCard(card, template, emptyState()));
  });

  it('preserves a higher catalog rate for comparable hand-picked threats', () => {
    const efficient = byId('bk-bunny-vanguard');
    const slower = byId('rg-brunhild');
    const template = personaTemplate('midrange');
    expect(rateCard(efficient)).toBeGreaterThan(rateCard(slower));
    expect(scoreCard(efficient, template, emptyState()).total).toBeGreaterThan(
      scoreCard(slower, template, emptyState()).total,
    );
  });

  it('prices efficient removal above an expensive damage finisher by raw rate', () => {
    expect(rateCard(byId('in-doom-bolt'))).toBeGreaterThan(rateCard(byId('so-lava-axe')));
  });

  it('rewards an unmet role more than an already-filled role', () => {
    const card = byId('so-divination');
    const template = personaTemplate('draw-go');
    const unmet = emptyState();
    const filled: PersonaDeckState = {
      ...unmet,
      roleCounts: { ...unmet.roleCounts, draw: template.quotas.draw },
    };
    expect(scoreCard(card, template, unmet).roleFit).toBeGreaterThan(scoreCard(card, template, filled).roleFit);
  });

  it('reports synergy as a distinct positive component', () => {
    const card = byId('in-doom-bolt');
    const attrition = personaTemplate('attrition');
    const neutral: PersonaTemplate = { ...attrition, synergy: { subtypes: [], keywords: [], effectOps: [] } };
    expect(scoreCard(card, attrition, emptyState()).synergy).toBeGreaterThan(
      scoreCard(card, neutral, emptyState()).synergy,
    );
  });

  it('classifies multi-role cards without assigning lands or tokens', () => {
    expect(cardRoles(byId('in-sudden-insight'))).toEqual(['interaction', 'draw']);
    expect(cardRoles(byId('land-island'))).toEqual([]);
  });
});
