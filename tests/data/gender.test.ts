import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';

/**
 * Every card subject and avatar boss in Darling Blades is a woman, so their own
 * authored prose must never misgender them with a masculine pronoun. This gate
 * scans the prose surfaces — card `flavor` and avatar `title`/`blurb` — for the
 * pronouns he / him / his / himself (word-boundary, case-insensitive, so "the",
 * "she", "History" are not false positives, while "he's"/"he'll" are caught).
 *
 * Scope (locked with the user 2026-07-05): PRONOUNS ONLY. Male THIRD PARTIES are
 * legitimate lore — a heroine can have a father, a husband, a male foe, or duel
 * a male god — so masculine NOUNS (father, husband, king, god…) are deliberately
 * NOT flagged. In practice he/him/his/himself only ever refer to the (female)
 * subject. Card/avatar NAMES are excluded from the scan because real names
 * collide with the pronoun list (e.g. "Zhang He", "Man Chong").
 *
 * If a future card ever needs a masculine pronoun for a genuine male third party
 * ("She dared him to try."), register its id in ALLOW below with the reason.
 */
const MASC_PRONOUN = /\b(?:he|him|his|himself)\b/gi;

/** id -> why a masculine pronoun is legitimately present in this subject's prose. */
const ALLOW: Readonly<Record<string, string>> = {
  // 'rg-example': 'flavor quotes a male foe: "She told him no."',
};

interface Prose {
  id: string;
  field: string;
  text: string;
}

/** The authored prose surfaces the gate scans (names are intentionally excluded). */
function proseSurfaces(): Prose[] {
  const out: Prose[] = [];
  for (const card of ALL_CARDS) {
    if (card.flavor) out.push({ id: card.id, field: 'flavor', text: card.flavor });
  }
  for (const a of AVATARS) {
    out.push({ id: a.id, field: 'title', text: a.title });
    out.push({ id: a.id, field: 'blurb', text: a.blurb });
  }
  return out;
}

describe('gendered prose — all card/avatar subjects are women', () => {
  it('no masculine pronoun (he/him/his/himself) refers to a subject', () => {
    const offenders: string[] = [];
    for (const { id, field, text } of proseSurfaces()) {
      if (id in ALLOW) continue;
      const hits = text.match(MASC_PRONOUN);
      if (hits) {
        const words = [...new Set(hits.map((h) => h.toLowerCase()))].join(', ');
        offenders.push(`${id}.${field}: [${words}] — "${text}"`);
      }
    }
    expect(
      offenders,
      `masculine pronoun(s) referring to a female subject (convert to she/her, ` +
        `or register the id in ALLOW if it is a genuine male third party):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('the ALLOW registry is not stale (ids exist and still contain a masculine pronoun)', () => {
    const surfaces = proseSurfaces();
    const allIds = new Set<string>([...ALL_CARDS.map((c) => c.id), ...AVATARS.map((a) => a.id)]);
    for (const id of Object.keys(ALLOW)) {
      expect(allIds.has(id), `ALLOW references unknown id "${id}"`).toBe(true);
      // A whitelisted id whose prose no longer has a masculine pronoun is a stale
      // exception hiding future regressions — drop it from ALLOW. (.match with a
      // /g regex is stateless, unlike .test, so it is safe to reuse here.)
      const stillHasPronoun = surfaces.some((p) => p.id === id && p.text.match(MASC_PRONOUN));
      expect(stillHasPronoun, `ALLOW entry "${id}" is stale — no masculine pronoun in its prose`).toBe(true);
    }
  });
});
