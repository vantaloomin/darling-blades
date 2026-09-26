import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import { translateLabel, translatePart } from '../../src/forge/ledger';
import { TRIGGERS } from '../../src/forge/vocab';
import { scoreCard } from '../../src/power/scoreCore';

const COLLECTIBLE = ALL_CARDS.filter((card) => !card.token);

/** Magic's names for things the game calls something else. */
const MTG_WORDS = /\b(scry|mill|exile|bounce|counter|reanimate|regrowth|wrath|fog|flying|instant)\b/i;

/** Why a translated label is not fit to show a player, or null when it is. */
function problemWith(text: string): string | null {
  if (text.includes('§')) return 'a section sign';
  if (/NEEDS MATH/i.test(text)) return 'NEEDS MATH';
  if (/\bMEP\b/.test(text)) return 'MEP';
  if (text.includes('—')) return 'an em-dash';
  if (MTG_WORDS.test(text)) return `the Magic word "${MTG_WORDS.exec(text)![1]}"`;
  // The scorer's machine form: an engine trigger id straight up against its
  // colon and the effect (`arrives:scry 1`), or leading the label.
  for (const trigger of TRIGGERS) {
    if (new RegExp(`(^|[^\\w ])${trigger}:|\\b${trigger}:\\S`).test(text)) return `the trigger id "${trigger}:"`;
  }
  const camel = /\b[a-z]+[A-Z][A-Za-z]*\b/.exec(text);
  if (camel) return `the id "${camel[0]}"`;
  return null;
}

describe('Power Breakdown labels', () => {
  // A rule, not a copy snapshot: whatever the wording, a label shown to a
  // player never carries the scorer's internals or Magic's vocabulary.
  it('translates every part of every collectible card into player words', () => {
    const problems = new Set<string>();
    let parts = 0;
    for (const card of COLLECTIBLE) {
      for (const part of scoreCard(card).parts) {
        parts += 1;
        const line = translatePart(card, part);
        const problem = problemWith(line.text);
        if (problem) problems.add(`${part.label} -> "${line.text}" (${problem})`);
        if (!line.text.trim()) problems.add(`${part.label} -> empty`);
      }
    }
    expect(parts).toBeGreaterThan(0);
    expect([...problems]).toEqual([]);
  });

  it('flags every provisional rate as an estimate, and only those', () => {
    const mismatches: string[] = [];
    for (const card of COLLECTIBLE) {
      for (const part of scoreCard(card).parts) {
        if (translatePart(card, part).estimate !== /NEEDS MATH/.test(part.label)) mismatches.push(part.label);
      }
    }
    expect(mismatches).toEqual([]);
  });

  // The scorer's static labels carry only the stat change (`anthem +0/+0`); a
  // static whose value is a granted keyword must say so, not claim +0/+0.
  it('names the keywords a static grants', () => {
    const grantsOnly = ALL_CARDS.filter((card) => (card.abilities ?? []).some((ability) => (
      ability.when === 'static' && (ability.static?.grantKeywords?.length ?? 0) > 0
      && !(ability.static?.p ?? 0) && !(ability.static?.t ?? 0)
    )));
    expect(grantsOnly.length).toBeGreaterThan(0);
    for (const card of grantsOnly) {
      const lines = scoreCard(card).parts
        .filter((part) => /^(anthem|enemy anthem|aura|self) [+-]?0\/[+-]?0$/.test(part.label))
        .map((part) => translatePart(card, part).text);
      for (const text of lines) {
        expect(text, card.name).not.toMatch(/[+-]0\/[+-]0/);
        expect(text, card.name).toMatch(/ (gain|has) /);
      }
    }
  });

  it('turns label shapes it has never seen into clean plain words', () => {
    for (const label of [
      'someNewTrigger:frob the widget 3 (§4z, NEEDS MATH)',
      'arrives:brandNewEffect ×2',
      'exile the flying counter — instant (§9)',
      'awaken(self, no rider — inert)',
    ]) {
      const line = translateLabel(label);
      expect(problemWith(line.text), `${label} -> ${line.text}`).toBeNull();
      expect(line.estimate).toBe(/NEEDS MATH/.test(label));
    }
  });
});
